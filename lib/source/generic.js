/**
 * 通用数据源：json（数组或 {records:[…]}）、ndjson/jsonl、csv、tsv、txt/md。
 *
 * 每行（或每个 txt 文件）是一份文书。字段映射（哪一列是正文、病人、时间……）可以在设置或批次参数里
 * 给出；没给就自动识别：正文＝平均最长的文本列，其余按列名猜。识别结果写进报告。
 *
 * 大的 ndjson 文件按字节区间切成多个单元（unit），各单元独立读，适合几千万行。
 */
import { createReadStream } from 'node:fs'
import { open, readFile, stat } from 'node:fs/promises'
import { basename, extname, relative } from 'node:path'
import { splitSections } from './sections.js'
import { normText, parseCsv, parseInstant, present, stableId } from '../util.js'

export const GENERIC_EXT = new Set(['.json', '.ndjson', '.jsonl', '.csv', '.tsv', '.txt', '.md'])

const GUESS = {
  id: /^(?:id|_id|doc_?id|record_?id|note_?id|prm_?key|文书id|记录id|文书编号|记录编号)$/i,
  patient: /^(?:patient(?:_?id)?|pat_?id|person_?id|subject_?id|mrn|empi|id_crd_no|pid|病人(?:id|编号)?|患者(?:id|编号)?)$/i,
  encounter: /^(?:encounter(?:_?id)?|visit(?:_?id)?|admission(?:_?id)?|hadm_?id|inhos_no|otpt_emg_no|住院号|门诊号|就诊号|就诊(?:id|编号))$/i,
  type: /^(?:type|doc_?type|record_?type|note_?type|category|文书类型|记录类型|类型|病历类型)$/i,
  time: /^(?:time|date|datetime|charttime|created_?at|crt_tm|rcd_dt_tm|written|记录时间|书写时间|时间|日期)$/i,
  title: /^(?:title|标题|文书名称)$/i,
}

const CJK = /[\u4e00-\u9fff]/
const SYSTEM = /^(?:_.*|.*(?:_ID|_NO|_CD|_KEY)|id)$/i
/** 匿名化假名（如 检验-F31EF4、医院-000009）：是标识符，不是正文 */
const PSEUDO = /^[\u4e00-\u9fff]{1,8}-[0-9A-Za-z]{4,}$/

/**
 * Decide the field mapping from sample rows (objects). Works on value shapes, not only column names,
 * so exports whose columns are data-element codes (WS05_10_133_01 …) still map:
 *   text   all columns that carry Chinese text (joined, one section per column), longest first-seen order kept
 *   time   a named time column, else the first column whose values parse as timestamps
 *   patient/encounter/type/title by name; patient may stay null (then taken from the folder, see toDoc)
 */
export function guessMapping(rows, given = {}) {
  const cols = new Map()
  for (const r of rows) for (const [k, v] of Object.entries(r)) {
    const c = cols.get(k) ?? { n: 0, len: 0, cjk: 0, time: 0, pseudo: 0 }
    if ((typeof v === 'string' || typeof v === 'number') && String(v).trim()) {
      const sv = String(v).trim()
      c.n++; c.len += sv.length
      if (CJK.test(sv)) c.cjk++
      if (PSEUDO.test(sv)) c.pseudo++
      if (/^\d{8,14}$|^\d{4}[-/.年]\d{1,2}/.test(sv) && parseInstant(sv)) c.time++
    }
    cols.set(k, c)
  }
  const names = [...cols.keys()]
  const pick = (re) => names.find((k) => re.test(k)) ?? null
  const roles = {
    id: given.id ?? pick(GUESS.id),
    patient: given.patient ?? pick(GUESS.patient),
    encounter: given.encounter ?? pick(GUESS.encounter),
    type: given.type ?? pick(GUESS.type),
    title: given.title ?? pick(GUESS.title),
  }
  roles.time = given.time ?? pick(GUESS.time) ?? names.find((k) => { const c = cols.get(k); return c.n && c.time / c.n >= 0.8 && !Object.values(roles).includes(k) }) ?? null
  const taken = new Set(Object.values(roles).filter(Boolean))
  let text = given.text ?? null
  if (!text) {
    // 含中文的列：至少一半的行有中文（编码、ID 列偶尔夹中文也不算），不是系统字段、也不是上面认出的角色列；按首次出现顺序
    text = names.filter((k) => { const c = cols.get(k); return c.n && c.cjk / c.n >= 0.5 && c.pseudo / c.n < 0.8 && !SYSTEM.test(k) && !taken.has(k) })
    if (!text.length) text = [...cols.entries()].filter(([k, c]) => c.n && !SYSTEM.test(k) && !taken.has(k)).sort((a, b) => b[1].len / b[1].n - a[1].len / a[1].n).slice(0, 1).map(([k]) => k)
  }
  const textCols = [].concat(text ?? [])
  return { text: textCols.length === 1 ? textCols[0] : textCols.length ? textCols : null, ...roles }
}

/** Record type from the file name: 'C0102_0515_02住院病程记录首次病程记录.json' → '住院病程记录首次病程记录' */
export function typeFromFile(file) {
  const b = basename(file).replace(/\.[^.]+$/, '')
  const t = b.replace(/^[A-Za-z]*\d+(?:[_-]\d+)*[_-]?/, '').trim()
  return CJK.test(t) ? t : null
}

async function sampleRows(file, n = 200) {
  const ext = extname(file).toLowerCase()
  if (ext === '.ndjson' || ext === '.jsonl') {
    const fh = await open(file, 'r')
    try {
      const buf = Buffer.alloc(Math.min(4 << 20, (await fh.stat()).size))
      await fh.read(buf, 0, buf.length, 0)
      return buf.toString('utf8').split('\n').slice(0, n).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter((x) => x && typeof x === 'object')
    } finally { await fh.close() }
  }
  if (ext === '.json') return jsonRows(await readFile(file, 'utf8')).slice(0, n)
  if (ext === '.csv' || ext === '.tsv') return csvRows(await readFile(file, 'utf8'), ext === '.tsv' ? '\t' : ',').slice(0, n)
  return []
}

function jsonRows(text) {
  const d = JSON.parse(text)
  if (Array.isArray(d)) return d.filter((x) => x && typeof x === 'object')
  if (d && typeof d === 'object') for (const k of ['records', 'data', 'rows', 'items', 'documents', 'notes']) if (Array.isArray(d[k])) return d[k]
  return d && typeof d === 'object' ? [d] : []
}
function csvRows(text, delim) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''), delim)
  const head = rows.shift() ?? []
  return rows.filter((r) => r.some((c) => c !== '')).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

/**
 * Plan units for one generic file. Big ndjson files are split into byte ranges of ~unitBytes
 * (aligned to line starts), so workers can read them independently.
 */
export async function planFile(file, { unitBytes = 32 << 20 } = {}) {
  const ext = extname(file).toLowerCase()
  const size = (await stat(file)).size
  if ((ext !== '.ndjson' && ext !== '.jsonl') || size <= unitBytes) return [{ kind: 'file', file, size }]
  const fh = await open(file, 'r')
  const units = []
  try {
    let start = 0
    const probe = Buffer.alloc(1 << 16)
    while (start < size) {
      let end = Math.min(size, start + unitBytes)
      if (end < size) {
        // advance to the next newline
        for (;;) {
          const { bytesRead } = await fh.read(probe, 0, probe.length, end)
          if (!bytesRead) { end = size; break }
          const i = probe.subarray(0, bytesRead).indexOf(10)
          if (i >= 0) { end += i + 1; break }
          end += bytesRead
        }
      }
      units.push({ kind: 'range', file, start, end, size: end - start })
      start = end
    }
  } finally { await fh.close() }
  return units
}

export async function mappingFor(file, given) {
  const ext = extname(file).toLowerCase()
  if (ext === '.txt' || ext === '.md') return { text: '$file' }
  return guessMapping(await sampleRows(file), given)
}

/** Text + sections from one or more text columns. A column's own inline headers (主诉：…) win over the column name. */
function textOf(row, cols) {
  if (!Array.isArray(cols)) {
    if (!present(row[cols])) return null
    const text = normText(row[cols])
    return { text, sections: splitSections(text) }
  }
  let text = ''; const sections = []
  for (const c of cols) {
    if (!present(row[c])) continue
    const v = normText(row[c])
    if (!v.trim()) continue
    const head = `${c}：`
    const s0 = text.length + head.length
    text += head + v
    const inner = splitSections(v)
    if (inner.length > 1 || inner[0]?.name !== '正文') for (const x of inner) sections.push({ name: x.name, s: s0 + x.s, e: s0 + x.e })
    else sections.push({ name: c, s: s0, e: text.length })
    text += '\n'
  }
  return text.trim() ? { text, sections } : null
}

/** Patient when the data has no patient column: the first folder under the input (one folder per patient), else the record key. */
function patientFromPath(rel) {
  const parts = rel.split(/[\\/]/)
  return parts.length > 1 ? parts[0] : null
}

function toDoc(row, map, file, index, inputDir) {
  if (!map.text) return null
  const t = textOf(row, map.text)
  if (!t) return null
  const rel = relative(inputDir, file)
  const key = map.id && present(row[map.id]) ? String(row[map.id]) : `${rel}#${index}`
  const patient = map.patient && present(row[map.patient]) ? String(row[map.patient]) : patientFromPath(rel) ?? key
  return {
    id: stableId('D', rel, key),
    patient,
    encounter: map.encounter && present(row[map.encounter]) ? String(row[map.encounter]) : null,
    encounterKind: null,
    recordType: (map.type && present(row[map.type]) ? String(row[map.type]) : null) ?? (map.title && present(row[map.title]) ? String(row[map.title]) : null) ?? typeFromFile(file) ?? '文书',
    written: map.time ? parseInstant(row[map.time]) : null,
    text: t.text,
    sections: t.sections,
    source: { file: rel, key },
  }
}

/** Read one unit; calls onDoc(doc) for each document (streaming for ndjson). */
export async function readUnit(unit, map, inputDir, onDoc) {
  const { file } = unit
  const ext = extname(file).toLowerCase()
  if (ext === '.txt' || ext === '.md') {
    const text = normText(await readFile(file, 'utf8'))
    if (!text.trim()) return
    const rel = relative(inputDir, file)
    const parent = relative(inputDir, file).split(/[\\/]/).slice(0, -1).join('/')
    await onDoc({ id: stableId('D', rel), patient: parent || basename(file, ext), encounter: null, encounterKind: null, recordType: '文书', written: null, text, sections: splitSections(text), source: { file: rel, key: rel } })
    return
  }
  if (ext === '.json' || ext === '.csv' || ext === '.tsv') {
    const text = await readFile(file, 'utf8')
    const rows = ext === '.json' ? jsonRows(text) : csvRows(text, ext === '.tsv' ? '\t' : ',')
    for (let i = 0; i < rows.length; i++) { const d = toDoc(rows[i], map, file, i, inputDir); if (d) await onDoc(d) }
    return
  }
  // ndjson: stream the byte range line by line; the row index is the absolute byte offset (stable)
  const stream = createReadStream(file, { encoding: 'utf8', start: unit.start ?? 0, end: unit.end != null ? unit.end - 1 : undefined })
  let rest = ''; let offset = unit.start ?? 0
  const handle = async (line, at) => {
    if (!line.trim()) return
    let row
    try { row = JSON.parse(line) } catch { return }
    const d = row && typeof row === 'object' ? toDoc(row, map, file, `@${at}`, inputDir) : null
    if (d) await onDoc(d)
  }
  for await (const chunk of stream) {
    rest += chunk
    let i
    while ((i = rest.indexOf('\n')) >= 0) {
      const line = rest.slice(0, i)
      await handle(line, offset)
      offset += Buffer.byteLength(line, 'utf8') + 1
      rest = rest.slice(i + 1)
    }
  }
  if (rest) await handle(rest, offset)
}
