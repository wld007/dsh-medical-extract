/**
 * 一个分片：读若干单元的文书 → 抽取（规则＋模型）→ 抽样核验 → 写三份分片文件（先写临时文件，完成后改名）：
 *
 *   work/evidence/part-NNNNN.ndjson.gz   值（证据长表）
 *   work/entities/part-NNNNN.ndjson.gz   病人与就诊（人口信息、就诊起止、文书数），汇总时用
 *   work/review/part-NNNNN.ndjson.gz     抽样核验的分歧（进人工复核）
 *
 * 分片是断点单位：文件改名成功＝分片完成；继续处理时跳过已完成的分片。
 */
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createGzip } from 'node:zlib'
import { readUnitDocs } from '../source/index.js'
import { compileTemplate } from '../template/load.js'
import { createLlm } from '../llm.js'
import { fnv, pool, stableId } from '../util.js'
import { buildLexicon } from './assertion.js'
import { extractDocument } from './extract.js'
import { mergeVotes, modelExtract } from './model.js'

export const partName = (n) => `part-${String(n).padStart(5, '0')}.ndjson.gz`

function gzWriter(path) {
  const gz = createGzip({ level: 6 })
  const out = createWriteStream(path)
  gz.pipe(out)
  let buf = ''
  return {
    write(obj) { buf += `${JSON.stringify(obj)}\n`; if (buf.length > 1 << 20) { gz.write(buf); buf = '' } },
    close() { return new Promise((resolve, reject) => { if (buf) gz.write(buf); out.on('finish', resolve); out.on('error', reject); gz.end() }) },
  }
}

/** Simple concurrency limiter (shared by all documents of a shard). */
export function limiter(width) {
  let active = 0; const queue = []
  const next = () => { if (active >= width || !queue.length) return; active++; const { fn, resolve, reject } = queue.shift(); fn().then(resolve, reject).finally(() => { active--; next() }) }
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next() })
}

/** Document-level conclusion of one field (for comparing with the verifier). */
export function docLevel(field, values) {
  const vs = values.filter((v) => v.field === field.id && v.value != null)
  if (field.type === 'presence') return vs.some((v) => v.value === '有') ? '有' : vs.some((v) => v.value === '可疑') ? '可疑' : vs.some((v) => v.value === '无') ? '无' : '未提及'
  return [...new Set(vs.map((v) => String(v.value)))].sort().join('；') || '未提及'
}
const tokens = (s) => [...new Set(String(s).split(/[；;、，,\n]/).map((x) => x.replace(/[\s。.:："“”'‘’（）()]/g, '')).filter(Boolean))].sort()
/** Agreement ignoring punctuation, item order, joined-vs-split lists, and date precision (2024-10 ≈ 2024-10-06). */
export function sameConclusion(field, a, b) {
  if (a === b) return true
  if (a === '未提及' || b === '未提及') return false
  if (field.type === 'date') {
    const A = tokens(a); const B = tokens(b)
    const ok = (x, Y) => Y.some((y) => x.startsWith(y) || y.startsWith(x))
    return A.every((x) => ok(x, B)) && B.every((y) => ok(y, A))
  }
  if (field.type === 'number' || field.type === 'score') return tokens(a).map(Number).join() === tokens(b).map(Number).join()
  const A = tokens(a).join('|'); const B = tokens(b).join('|')
  if (A === B) return true
  if (field.type === 'text') return A.replace(/\|/g, '') === B.replace(/\|/g, '') || A.includes(B) || B.includes(A)
  return false
}

/**
 * task: { runId, shard, units, plan, template (raw), settings, workDir, asOf, priorities, mode }
 * env:  { store (records), chatImpl?, onProgress(docs), isCancelled() }
 */
export async function processShard(task, env) {
  const { settings } = task
  const tpl = compileTemplate(task.template, { priorities: task.priorities })
  const lex = buildLexicon(tpl.lexicon)
  const t0 = Date.now()
  const mode = task.mode ?? settings.extractMode ?? 'hybrid'
  const modelOn = mode !== 'rules' && (env.chatImpl?.extract || (settings.modelEnabled !== false && settings.baseURL && settings.model))
  const width = Math.max(1, Number(task.modelWidth ?? settings.modelConcurrency ?? 4))
  const limit = limiter(width)
  const store = {
    cacheGet: (k) => env.store.cacheGet(k), cachePut: (k, m, c) => env.store.cachePut(k, m, c),
    logCall: (e) => env.store.logCall(task.runId, e),
  }
  const mk = (base, model) => createLlm({ baseURL: base, model, apiKey: settings.apiKey, timeoutMs: settings.timeoutMs, disableThinking: settings.disableThinking })
  const extractLlm = modelOn ? (env.chatImpl?.extract ?? mk(settings.baseURL, settings.model)) : null
  const verifyLlm = modelOn && (env.chatImpl?.verify || settings.verifyModel) ? (env.chatImpl?.verify ?? mk(settings.verifyBaseURL || settings.baseURL, settings.verifyModel)) : null
  const runner = extractLlm ? { llm: extractLlm, store, limit } : null
  const vRunner = verifyLlm ? { llm: verifyLlm, store, limit } : null
  const sampleRate = Number(settings.verifySampleRate ?? 0.02)
  const minPerField = Number(settings.verifyMinPerField ?? 2)
  const fieldQuota = new Map()

  const dirs = ['evidence', 'entities', 'review'].map((d) => join(task.workDir, d))
  for (const d of dirs) await mkdir(d, { recursive: true })
  const name = partName(task.shard)
  const tmp = dirs.map((d) => join(d, `${name}.tmp`))
  const [ev, en, rv] = tmp.map(gzWriter)

  const stats = {
    docs: 0, structured: 0, skipped: 0, recalled: 0, values: 0, byMethod: {}, byField: {}, calls: 0, cached: 0, failed: 0,
    quoteFail: 0, invalid: 0, outOfRange: 0, agree: 0, disagree: 0, verify: {}, review: 0, problems: [],
  }
  const entities = new Map()
  const seenPersons = new Set()

  for (const unit of task.units) {
    if (env.isCancelled()) break
    const { persons, encounters, documents, structured } = await readUnitDocs(unit, task.plan)
    stats.structured += structured ?? 0
    for (const [patient, p] of Object.entries(persons)) if (!seenPersons.has(patient)) { seenPersons.add(patient); en.write({ t: 'p', patient, birth: p.birth ?? null, sex: p.sex ?? null }) }
    for (const e of encounters) entities.set(`${e.patient}\u0000${e.id}`, { t: 'e', patient: e.patient, encounter: e.id, kind: e.kind ?? null, start: e.start ?? null, end: e.end ?? null, docs: 0 })
    const docs = task.asOf ? documents.filter((d) => d.written && d.written <= task.asOf) : documents
    stats.skipped += documents.length - docs.length
    await pool(docs, Math.max(1, width * 2), async (doc) => {
      if (env.isCancelled()) return
      const k = `${doc.patient}\u0000${doc.encounter ?? ''}`
      const ent = entities.get(k) ?? { t: 'e', patient: doc.patient, encounter: doc.encounter ?? null, kind: doc.encounterKind ?? null, start: null, end: null, docs: 0 }
      ent.docs++
      if (doc.written) { if (!ent.first || doc.written < ent.first) ent.first = doc.written; if (!ent.last || doc.written > ent.last) ent.last = doc.written }
      entities.set(k, ent)

      const r = extractDocument(doc, tpl, { lex, mode: modelOn ? mode : 'rules' })
      stats.recalled += r.recalled
      let values = r.values
      if (r.pending && runner) {
        const m = await modelExtract(doc, tpl, r.pending, runner, { role: 'extract' })
        for (const k2 of ['calls', 'cached', 'failed', 'quoteFail', 'invalid']) stats[k2] += m.stats[k2]
        for (const p of m.stats.problems) if (stats.problems.length < 30) stats.problems.push(p)
        const merged = mergeVotes(values, m.values, m)
        values = merged.values; stats.agree += merged.agree; stats.disagree += merged.disagree
      }
      for (const v of values) {
        ev.write(v)
        stats.values++
        stats.byMethod[v.method.split(':')[0] === 'rule' ? 'rule' : v.method] = (stats.byMethod[v.method.split(':')[0] === 'rule' ? 'rule' : v.method] ?? 0) + 1
        const bf = (stats.byField[v.field] ??= { values: 0, docs: 0 }); bf.values++
        if (v.flags?.includes('超出值域')) stats.outOfRange++
      }
      for (const fid of new Set(values.map((v) => v.field))) stats.byField[fid].docs++

      // E6 抽样核验：核验模型按"全送模型"的方式背靠背重抽，按字段比文书级结论
      if (vRunner) {
        const full = extractDocument(doc, tpl, { lex, mode: 'model' })
        if (full.pending) {
          const docSampled = fnv(doc.id) / 0xffffffff < sampleRate
          const fields = full.pending.fields.filter((f) => docSampled || (fieldQuota.get(f) ?? 0) < minPerField)
          if (fields.length) {
            for (const f of fields) fieldQuota.set(f, (fieldQuota.get(f) ?? 0) + 1)
            const pend = { ...full.pending, fields }
            const vm = await modelExtract(doc, tpl, pend, vRunner, { role: 'verify' })
            for (const k2 of ['calls', 'cached', 'failed']) stats[k2] += vm.stats[k2]
            if (!vm.anyFailed) {
              for (const fid of fields) {
                const field = tpl.byId.get(fid)
                const a = docLevel(field, values); const b = docLevel(field, vm.values)
                const vs = (stats.verify[fid] ??= { n: 0, agree: 0 })
                vs.n++
                if (sameConclusion(field, a, b)) { vs.agree++; continue }
                stats.review++
                const snips = full.pending.byField[fid].map((id) => full.pending.snippets.find((s) => s.id === id)).slice(0, 6)
                rv.write({
                  id: stableId('R', doc.id, fid), kind: 'verify', doc: doc.id, patient: doc.patient, encounter: doc.encounter, recordType: doc.recordType,
                  written: doc.written, field: fid, final: a, verify: b,
                  finalValues: values.filter((v) => v.field === fid).map((v) => ({ id: v.id, value: v.value, assertion: v.assertion, quote: v.quote, s: v.s, e: v.e, method: v.method })),
                  verifyValues: vm.values.filter((v) => v.field === fid).map((v) => ({ value: v.value, assertion: v.assertion, quote: v.quote, s: v.s, e: v.e })),
                  snippets: snips.map((s) => ({ s: s.s, e: s.e, text: s.text })), source: doc.source,
                })
              }
            }
          }
        }
      }
      stats.docs++
      env.onProgress?.(1)
    }, env.isCancelled)
  }
  for (const e of entities.values()) en.write(e)
  await Promise.all([ev.close(), en.close(), rv.close()])
  if (env.isCancelled()) { await Promise.all(tmp.map((p) => rm(p, { force: true }))); return { cancelled: true, stats } }
  for (let i = 0; i < tmp.length; i++) await rename(tmp[i], join(dirs[i], name))
  env.store.flushStats?.(task.runId)
  stats.ms = Date.now() - t0
  return { cancelled: false, stats }
}
