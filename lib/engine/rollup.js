/**
 * E5 汇总：证据与实体先按病人哈希分桶（内存不随总量增长），再逐桶汇总成宽表格子。
 *
 *   粒度 document / encounter / patient → 宽表一行一份文书 / 一次就诊 / 一位病人
 *   粒度 timepoint → 长表（timepoints.csv），一值一行
 *   pick 规则给格子取值；互斥值登记冲突（不自动选边）；派生字段按 derive 计算；人工裁定在这里生效。
 */
import { createReadStream, createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'
import { csvLine, dayOf, fnv, fullDay, monthsBetween, stableId, yearsBetween } from '../util.js'

/** 逐行读 dir 下的 *.ndjson.gz；给了 only 时只读这一个文件（如某个数据块的 part） */
export async function* readParts(dir, only = null) {
  let names = []
  try { names = (await readdir(dir)).filter((n) => n.endsWith('.ndjson.gz') && (!only || n === only)).sort() } catch { return }
  for (const n of names) {
    const rl = createInterface({ input: createReadStream(join(dir, n)).pipe(createGunzip()), crlfDelay: Infinity })
    for await (const line of rl) if (line) yield JSON.parse(line)
  }
}

function writer(path) {
  const out = createWriteStream(path)
  let buf = ''
  return {
    write(s) { buf += s; if (buf.length > 1 << 20) { out.write(buf); buf = '' } },
    close() { return new Promise((resolve, reject) => { if (buf) out.write(buf); out.on('finish', resolve); out.on('error', reject); out.end() }) },
  }
}

const NONE = '未提及'
const byWritten = (a, b) => ((a.written ?? '') < (b.written ?? '') ? -1 : (a.written ?? '') > (b.written ?? '') ? 1 : a.s - b.s)

/** Pick a cell value from its values. Returns { value, conflict: [distinct values] | null } */
export function pickCell(field, vals) {
  const vs = vals.filter((v) => v.value != null)
  if (!vs.length) return { value: field.type === 'presence' ? NONE : '', conflict: null }
  const distinct = [...new Set(vs.map((v) => String(v.value)))]
  const sorted = [...vs].sort(byWritten)
  let value
  switch (field.pick) {
    case 'any': value = distinct.includes('有') ? '有' : distinct.includes('可疑') ? '可疑' : distinct.includes('无') ? '无' : distinct[0]; break
    case 'first': value = sorted[0].value; break
    case 'last': value = sorted.at(-1).value; break
    case 'max': value = Math.max(...vs.map((v) => Number(v.value))); break
    case 'min': value = Math.min(...vs.map((v) => Number(v.value))); break
    case 'earliest': value = [...distinct].sort()[0]; break
    case 'latest': value = [...distinct].sort().at(-1); break
    case 'mode': {
      const c = new Map(); for (const v of vs) c.set(String(v.value), (c.get(String(v.value)) ?? 0) + 1)
      const top = [...c.entries()].sort((a, b) => b[1] - a[1])
      value = top[0][0]
      break
    }
    default: value = distinct.join('；')
  }
  // 冲突：presence 同时有"有"和"无"；enum/number/score/date 不同值（日期按精度比较：2019 与 2019-03 不算冲突）
  let conflict = null
  if (field.pick !== 'all' && field.type !== 'text' && field.type !== 'list') {
    if (field.type === 'presence') conflict = distinct.includes('有') && distinct.includes('无') ? distinct : null
    else if (field.type === 'date') {
      if (field.pick === 'earliest' || field.pick === 'latest') return { value, conflict: null }
      const ds = distinct.sort()
      const clash = ds.some((a, i) => ds.some((b, j) => j > i && !b.startsWith(a) && !a.startsWith(b)))
      conflict = clash ? ds : null
    } else if (distinct.length > 1 && field.granularity !== 'timepoint') {
      // number/score 取最大、最小时多个值是预期的，不算冲突
      const expected = (field.type === 'number' || field.type === 'score') && (field.pick === 'max' || field.pick === 'min')
      if (!expected) conflict = distinct
    }
  }
  return { value, conflict }
}

function applyDecisions(v, decisions) {
  const d = decisions.get(`value\u0000${v.id}`)
  if (!d) return v
  if (d.decision === 'reject') return null
  if (d.decision === 'correct') return { ...v, value: d.value, flags: [...(v.flags ?? []), '人工改判'], method: `${v.method}→人工` }
  if (d.decision === 'confirm') return { ...v, flags: [...(v.flags ?? []), '已确认'], confidence: 'high' }
  return v
}

/**
 * Derived value for a row. ctx: { level, patient, row, get(fieldId) → {value, values}, encounterStart, person }
 */
function derive(field, ctx) {
  const d = field.derive
  const val = (id) => {
    if (id === '$encounter.start') return dayOf(ctx.encounterStart)
    if (id === '$document.written') return dayOf(ctx.written)
    return ctx.get(id)?.value
  }
  const unknown = '无法判断'
  switch (d.op) {
    case 'ageAt': {
      const at = val(d.at); const birth = ctx.person?.birth
      if (!at || !birth || at === NONE) return unknown
      return yearsBetween(birth, fullDay(at))
    }
    case 'monthsBetween': {
      const a = val(d.from); const b = val(d.to)
      if (!a || !b || a === NONE || b === NONE) return unknown
      return monthsBetween(a, b)
    }
    case 'reduction': {
      const vs = (ctx.get(d.field)?.values ?? []).filter((v) => v.value != null).sort(byWritten)
      if (vs.length < 2) return unknown
      const groups = new Map()
      for (const v of vs) { const k = v.variant ?? ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(v) }
      const g = [...groups.values()].sort((a, b) => b.length - a.length)[0]
      if (g.length < 2 || !Number(g[0].value)) return unknown
      return Math.round(((Number(g[0].value) - Number(g.at(-1).value)) / Number(g[0].value)) * 1000) / 10
    }
    case 'threshold': {
      const x = Number(val(d.field))
      const raw = val(d.field)
      if (raw == null || raw === '' || raw === unknown || !Number.isFinite(x)) return unknown
      const ok = { '>=': x >= d.value, '<=': x <= d.value, '>': x > d.value, '<': x < d.value, '==': x === d.value }[d.cmp]
      return ok ? '是' : '否'
    }
    case 'anyOf': {
      const xs = d.fields.map(val)
      if (xs.includes('有') || xs.includes('是')) return '有'
      if (xs.length && xs.every((x) => x === '无' || x === '否')) return '无'
      return NONE
    }
    case 'countOf': {
      const vs = ctx.get(d.field)?.values ?? []
      return new Set(vs.filter((v) => v.value != null).map((v) => String(v.value))).size
    }
    default: return unknown
  }
}

const BOM = '\uFEFF'
const fieldsAt = (tpl) => {
  const at = (g) => tpl.fields.filter((f) => f.granularity === g)
  return { patient: at('patient'), encounter: at('encounter'), document: at('document'), timepoint: at('timepoint') }
}
export function headers(tpl) {
  const F = fieldsAt(tpl)
  return {
    wide_patient: ['patient', 'sex', 'birth', 'encounters', 'docs', ...F.patient.flatMap((f) => [f.id, `${f.id}__n`])],
    wide_encounter: ['patient', 'encounter', 'kind', 'start', 'end', 'docs', ...F.encounter.flatMap((f) => [f.id, `${f.id}__n`])],
    ...(F.document.length ? { wide_document: ['patient', 'encounter', 'doc', 'recordType', 'written', ...F.document.flatMap((f) => [f.id, `${f.id}__n`])] } : {}),
    timepoints: ['patient', 'encounter', 'field', 'name', 'value', 'unit', 'variant', 'written', 'recordType', 'assertion', 'quote', 'doc', 'value_id'],
    conflicts: ['cell', 'level', 'patient', 'encounter', 'field', 'name', 'picked', 'values', 'value_ids'],
  }
}

/** Cell id: stable over re-runs (level + row key + field). */
export const cellKey = (level, { patient, encounter, doc }) => (level === 'patient' ? patient : level === 'document' ? doc : `${patient}\u0000${encounter ?? ''}`)
export const cellId = (level, key, fieldId) => stableId('C', level, key, fieldId)

/**
 * Phase 1 (parallel over shards): split one shard's evidence + entity parts into K bucket files by patient hash.
 * Files: <workDir>/buckets/b<k>/<part>.ndjson. Evidence lines are copied without re-serialising.
 */
export async function bucketizePart({ workDir, part, K }) {
  const bdir = join(workDir, 'buckets')
  const ws = new Map()
  const w = (k) => {
    if (!ws.has(k)) ws.set(k, (async () => { await mkdir(join(bdir, `b${k}`), { recursive: true }); return writer(join(bdir, `b${k}`, part.replace(/\.gz$/, ''))) })())
    return ws.get(k)
  }
  const bucketOf = (p) => (K === 1 ? 0 : fnv(String(p)) % K)
  for (const kind of ['entities', 'evidence']) {
    const file = join(workDir, kind, part)
    let rl
    try { rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity }) } catch { continue }
    try {
      for await (const line of rl) {
        if (!line) continue
        const x = JSON.parse(line)
        ;(await w(bucketOf(x.patient))).write(kind === 'evidence' ? `{"t":"v",${line.slice(1)}\n` : `${line}\n`)
      }
    } catch (e) { if (e.code !== 'ENOENT') throw e }
  }
  for (const p of ws.values()) await (await p).close()
  return { buckets: ws.size }
}

function newSummary(tpl) {
  const filled = {}
  for (const f of tpl.fields) filled[f.id] = { rows: 0, filled: 0, values: {} }
  return { patients: 0, encounters: 0, values: 0, rejected: 0, conflicts: 0, filled }
}
export function mergeSummary(a, b) {
  for (const k of ['patients', 'encounters', 'values', 'rejected', 'conflicts']) a[k] += b[k]
  for (const [id, s] of Object.entries(b.filled)) {
    const t = (a.filled[id] ??= { rows: 0, filled: 0, values: {} })
    t.rows += s.rows; t.filled += s.filled
    for (const [k, n] of Object.entries(s.values)) if (t.values[k] != null || Object.keys(t.values).length < 30) t.values[k] = (t.values[k] ?? 0) + n
  }
  return a
}

/**
 * Phase 2 (parallel over buckets): aggregate bucket k → <workDir>/rollup/<name>/<k>.csv (no header). Returns a summary.
 * decisions: Map or array of [key, decision].
 */
export async function aggregateBucket({ tpl, workDir, k, K = 1, decisions = new Map() }) {
  if (!(decisions instanceof Map)) decisions = new Map(decisions)
  const F = fieldsAt(tpl)
  const names = Object.keys(headers(tpl))
  const out = {}
  for (const n of names) { await mkdir(join(workDir, 'rollup', n), { recursive: true }); out[n] = writer(join(workDir, 'rollup', n, `${String(k).padStart(5, '0')}.csv`)) }
  const summary = newSummary(tpl)
  const count = (f, v) => {
    const s = summary.filled[f.id]
    s.rows++
    const key = v == null || v === '' ? '' : String(v)
    if (key && key !== NONE && key !== '无法判断') s.filled++
    if (s.values[key] != null || Object.keys(s.values).length < 30) s.values[key] = (s.values[key] ?? 0) + 1
  }
  const persons = new Map(); const encs = new Map(); const vals = new Map()
  const bdir = join(workDir, 'buckets', `b${k}`)
  let files = []
  try { files = (await readdir(bdir)).sort() } catch { /* empty bucket */ }
  for (const fname of files) {
    const rl = createInterface({ input: createReadStream(join(bdir, fname)), crlfDelay: Infinity })
    for await (const line of rl) {
      if (!line) continue
      const x = JSON.parse(line)
      if (x.t === 'p') persons.set(x.patient, x)
      else if (x.t === 'e') {
        if (!encs.has(x.patient)) encs.set(x.patient, new Map())
        const pe = encs.get(x.patient); const ek = x.encounter ?? ''
        const cur = pe.get(ek)
        if (!cur) pe.set(ek, { ...x })
        else {
          cur.docs = (cur.docs ?? 0) + (x.docs ?? 0)
          cur.kind ??= x.kind; cur.start ??= x.start; cur.end ??= x.end
          if (x.first && (!cur.first || x.first < cur.first)) cur.first = x.first
          if (x.last && (!cur.last || x.last > cur.last)) cur.last = x.last
        }
      } else {
        const v = applyDecisions(x, decisions)
        if (!v) { summary.rejected++; continue }
        if (!vals.has(v.patient)) vals.set(v.patient, [])
        vals.get(v.patient).push(v)
        summary.values++
      }
    }
  }
  // 人工补充的值（逐份核对里在原文上补的漏提）：按病人落到所在的桶
  for (const [key, d] of decisions) {
    if (!key.startsWith('add\u0000') || !d.value) continue
    const v = d.value
    if ((K === 1 ? 0 : fnv(String(v.patient)) % K) !== k || !tpl.byId.has(v.field)) continue
    if (!vals.has(v.patient)) vals.set(v.patient, [])
    vals.get(v.patient).push(v)
    summary.values++
  }
  const fieldOf = (id) => tpl.byId.get(id)
  const patients = new Set([...persons.keys(), ...encs.keys(), ...vals.keys()])
  for (const patient of [...patients].sort()) {
    summary.patients++
    const pv = vals.get(patient) ?? []
    const person = persons.get(patient) ?? {}
    const pEncs = [...(encs.get(patient)?.values() ?? [])].filter((e) => e.docs > 0 || e.encounter).sort((a, b) => ((a.start ?? a.first ?? '') < (b.start ?? b.first ?? '') ? -1 : 1))
    const byField = new Map(); const byEnc = new Map()
    for (const v of pv) {
      if (!byField.has(v.field)) byField.set(v.field, []); byField.get(v.field).push(v)
      const ek = v.encounter ?? ''
      if (!byEnc.has(ek)) byEnc.set(ek, new Map())
      const m = byEnc.get(ek); if (!m.has(v.field)) m.set(v.field, []); m.get(v.field).push(v)
    }
    const cell = (level, key, f, vs) => {
      const id = cellId(level, key, f.id)
      const d = decisions.get(`cell\u0000${id}`)
      if (d?.decision === 'correct') return { value: d.value, values: vs, conflict: null, cellId: id, decided: true }
      const r = pickCell(f, vs)
      if (r.conflict) {
        summary.conflicts++
        out.conflicts.write(csvLine([id, level, patient, level === 'encounter' ? key.split('\u0000')[1] : '', f.id, f.name, r.value, r.conflict.join('；'), vs.map((v) => v.id).join(' ')]))
      }
      return { ...r, values: vs, cellId: id }
    }
    const pCells = new Map()
    const patientCell = (f) => {
      if (!pCells.has(f.id)) pCells.set(f.id, f.type === 'derived' ? null : cell('patient', patient, f, byField.get(f.id) ?? []))
      return pCells.get(f.id)
    }
    for (const e of pEncs.length ? pEncs : [{ patient, encounter: null, docs: 0 }]) {
      const key = cellKey('encounter', { patient, encounter: e.encounter })
      const em = byEnc.get(e.encounter ?? '') ?? new Map()
      const eVals = (id) => em.get(id) ?? []
      const cells = new Map()
      const get = (id) => {
        const f = fieldOf(id); if (!f) return null
        if (f.granularity === 'patient') return patientCell(f)
        if (cells.has(id)) return cells.get(id)
        const c = f.type === 'derived' ? null : cell('encounter', key, f, eVals(id))
        cells.set(id, c)
        return c
      }
      const row = [patient, e.encounter ?? '', e.kind ?? '', e.start ?? e.first ?? '', e.end ?? '', e.docs ?? 0]
      for (const f of F.encounter) {
        let v; let n
        if (f.type === 'derived') { v = derive(f, { level: 'encounter', get, person, encounterStart: e.start ?? e.first }); n = '' } else { const c = get(f.id); v = c.value; n = c.values.length }
        cells.set(f.id, { value: v, values: cells.get(f.id)?.values ?? [] })
        row.push(v, n)
      }
      // 没有就诊号的文书（如基本信息）：只有当这些文书抽到了就诊级的值才出一行
      if (e.encounter != null || F.encounter.some((f) => f.type !== 'derived' && eVals(f.id).length)) {
        F.encounter.forEach((f, i) => count(f, row[6 + i * 2]))
        out.wide_encounter.write(csvLine(row)); summary.encounters++
      }
    }
    const pget = (id) => {
      const f = fieldOf(id); if (!f) return null
      if (f.type === 'derived') return pCells.get(id) ?? null
      return patientCell(f)
    }
    const firstStart = pEncs.map((e) => e.start ?? e.first).filter(Boolean).sort()[0] ?? null
    const prow = [patient, person.sex ?? '', person.birth ?? '', pEncs.filter((e) => e.encounter).length, pEncs.reduce((s, e) => s + (e.docs ?? 0), 0)]
    for (const f of F.patient) {
      let v; let n
      if (f.type === 'derived') { v = derive(f, { level: 'patient', get: pget, person, encounterStart: firstStart }); n = ''; pCells.set(f.id, { value: v, values: [] }) } else { const c = patientCell(f); v = c.value; n = c.values.length }
      count(f, v)
      prow.push(v, n)
    }
    out.wide_patient.write(csvLine(prow))
    if (out.wide_document) {
      const docs = new Map()
      const docFields = new Set(F.document.map((f) => f.id))
      for (const v of pv) if (docFields.has(v.field)) { if (!docs.has(v.doc)) docs.set(v.doc, []); docs.get(v.doc).push(v) }
      for (const [doc, dv] of docs) {
        const first = dv[0]
        const row = [patient, first.encounter ?? '', doc, first.recordType, first.written ?? '']
        for (const f of F.document) {
          if (f.type === 'derived') { row.push(derive(f, { level: 'document', get: () => null, person, written: first.written }), ''); continue }
          const c = cell('document', doc, f, dv.filter((v) => v.field === f.id))
          count(f, c.value); row.push(c.value, c.values.length)
        }
        out.wide_document.write(csvLine(row))
      }
    }
    for (const f of F.timepoint) {
      for (const v of (byField.get(f.id) ?? []).sort(byWritten)) {
        if (v.value == null) continue
        count(f, v.value)
        out.timepoints.write(csvLine([patient, v.encounter ?? '', f.id, f.name, v.value, v.unit ?? '', v.variant ?? '', v.written ?? '', v.recordType, v.assertion, v.quote, v.doc, v.id]))
      }
    }
  }
  await Promise.all(Object.values(out).map((w) => w.close()))
  return summary
}

/** Phase 3: header + per-bucket parts → delivery CSVs. */
export async function concatOutputs({ tpl, workDir, outDir }) {
  await mkdir(outDir, { recursive: true })
  for (const [name, head] of Object.entries(headers(tpl))) {
    const out = createWriteStream(join(outDir, `${name}.csv`))
    out.write(BOM + csvLine(head))
    let parts = []
    try { parts = (await readdir(join(workDir, 'rollup', name))).sort() } catch { /* none */ }
    for (const p of parts) for await (const chunk of createReadStream(join(workDir, 'rollup', name, p))) if (!out.write(chunk)) await once(out, 'drain')
    await new Promise((resolve, reject) => { out.on('error', reject); out.end(resolve) })
  }
}

/**
 * Whole rollup. runTasks(tasks) runs [{kind:'bucketize'|'aggregate', ...}] (in parallel workers or inline) and resolves to results.
 */
export async function rollup({ tpl, workDir, outDir, decisions = new Map(), bucketCount = 1, isCancelled = () => false, runTasks = null }) {
  await rm(join(workDir, 'buckets'), { recursive: true, force: true })
  await rm(join(workDir, 'rollup'), { recursive: true, force: true })
  const K = Math.max(1, bucketCount)
  let parts = []
  try { parts = (await readdir(join(workDir, 'evidence'))).filter((n) => n.endsWith('.ndjson.gz')).sort() } catch { /* none */ }
  const run = runTasks ?? (async (tasks) => {
    const out = []
    for (const t of tasks) {
      if (isCancelled()) break
      out.push(t.kind === 'bucketize' ? await bucketizePart({ workDir, part: t.part, K }) : await aggregateBucket({ tpl, workDir, k: t.k, K, decisions }))
    }
    return out
  })
  await run(parts.map((part) => ({ kind: 'bucketize', part, K })))
  if (isCancelled()) return null
  const sums = await run(Array.from({ length: K }, (_, k) => ({ kind: 'aggregate', k, K })))
  if (isCancelled()) return null
  const summary = sums.filter(Boolean).reduce(mergeSummary, newSummary(tpl))
  await concatOutputs({ tpl, workDir, outDir })
  await rm(join(workDir, 'buckets'), { recursive: true, force: true })
  await rm(join(workDir, 'rollup'), { recursive: true, force: true })
  return summary
}
