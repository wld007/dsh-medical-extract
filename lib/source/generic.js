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

/** Decide the field mapping from sample rows (objects). */
export function guessMapping(rows, given = {}) {
  const cols = new Map()
  for (const r of rows) for (const [k, v] of Object.entries(r)) {
    const c = cols.get(k) ?? { n: 0, len: 0 }
    if (typeof v === 'string' && v.trim()) { c.n++; c.len += v.length }
    cols.set(k, c)
  }
  const names = [...cols.keys()]
  const pick = (re) => names.find((k) => re.test(k)) ?? null
  const text = given.text ?? [...cols.entries()].filter(([, c]) => c.n).sort((a, b) => b[1].len / b[1].n - a[1].len / a[1].n)[0]?.[0] ?? null
  return {
    text,
    id: given.id ?? pick(GUESS.id),
    patient: given.patient ?? pick(GUESS.patient),
    encounter: given.encounter ?? pick(GUESS.encounter),
    type: given.type ?? pick(GUESS.type),
    time: given.time ?? pick(GUESS.time),
    title: given.title ?? pick(GUESS.title),
  }
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

function toDoc(row, map, file, index, inputDir) {
  const raw = map.text ? row[map.text] : null
  if (!present(raw)) return null
  const text = normText(raw)
  const rel = relative(inputDir, file)
  const key = map.id && present(row[map.id]) ? String(row[map.id]) : `${rel}#${index}`
  const patient = map.patient && present(row[map.patient]) ? String(row[map.patient]) : key
  return {
    id: stableId('D', rel, key),
    patient,
    encounter: map.encounter && present(row[map.encounter]) ? String(row[map.encounter]) : null,
    encounterKind: null,
    recordType: (map.type && present(row[map.type]) ? String(row[map.type]) : null) ?? (map.title && present(row[map.title]) ? String(row[map.title]) : null) ?? '文书',
    written: map.time ? parseInstant(row[map.time]) : null,
    text,
    sections: splitSections(text),
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
