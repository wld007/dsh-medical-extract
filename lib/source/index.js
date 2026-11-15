/**
 * 数据源入口：把输入（目录或文件）规划成"单元"（unit），每个单元可独立读出若干文书。
 *
 *   p_doc 导出   → 单元＝一位病人目录（人口信息、就诊一起读，供派生与就诊归属）
 *   通用文件     → 单元＝一个文件，或大 ndjson 文件的一段字节区间
 *
 * 单元按路径排序，顺序稳定；分片＝连续的若干单元。
 */
import { stat } from 'node:fs/promises'
import { basename, extname, relative } from 'node:path'
import { patientRoots, readPatient, walk } from './pdoc.js'
import { GENERIC_EXT, mappingFor, planFile, readUnit as readGeneric } from './generic.js'
import { tableKeyOf } from '../recognize/read.js'

/** 本插件家族的输出目录与 _records：永远不当输入读。 */
export const isToolOutput = (p) => /^_medical-[\w-]+$/.test(basename(p)) || basename(p) === '_records'

export async function planInput(input, { mapping = {}, unitBytes } = {}) {
  const st = await stat(input)
  const files = st.isDirectory() ? await walk(input, [], isToolOutput) : [input]
  const inputDir = st.isDirectory() ? input : input.replace(/[\\/][^\\/]*$/, '')
  const pdoc = files.filter((f) => /p_doc_\w+\.json$/.test(basename(f)))
  if (pdoc.length && st.isDirectory()) {
    const roots = patientRoots(input, pdoc)
    return { kind: 'pdoc', format: '区域平台导出（p_doc_*）', inputDir, units: roots.map((dir) => ({ kind: 'patient', dir })), mappings: {} }
  }
  const gen = files.filter((f) => GENERIC_EXT.has(extname(f).toLowerCase()))
  if (!gen.length) throw new Error('输入里没有可读的文书：支持 p_doc_*.json 导出，或 json／ndjson／jsonl／csv／tsv／txt／md 文件')
  // 字段映射按表（同名文件在不同病人目录里是同一张表）各猜一次：千万份文书也只读每张表的第一个文件
  const units = []; const mappings = {}
  for (const f of gen) {
    const table = tableKeyOf(f)
    if (!(table in mappings)) { const m = await mappingFor(f, mapping); mappings[table] = m.text == null ? null : m }
    for (const u of await planFile(f, { unitBytes })) units.push(u)
  }
  if (!units.length) throw new Error('没有找到正文字段：请在设置或参数里指定 mapping.text')
  return { kind: 'generic', format: '通用文件', inputDir, units, mappings, byFolder: folderPerPatient(inputDir, gen) }
}

/**
 * Read one unit → { persons: {patient: {birth, sex}}, encounters: [{patient, id, kind, start, end}], documents, structured }
 * 只有文书进 documents；结构化记录（检验、医嘱、收费……）只计数（structured），只用其中的人口与就诊信息。
 */
export async function readUnitDocs(unit, plan) {
  if (unit.kind === 'patient') {
    const p = await readPatient(unit.dir, plan.inputDir)
    return { persons: { [p.patient]: p.person }, encounters: p.encounters.map((e) => ({ patient: p.patient, ...e })), documents: p.documents, structured: p.structured }
  }
  const documents = []; const persons = {}; const encounters = []; let structured = 0
  const table = tableKeyOf(unit.file)
  if (plan.ignored?.includes(table)) return { persons, encounters, documents, structured }
  const spec = plan.specs?.[table] ?? null
  const map = plan.mappings[table] ?? plan.mappings[unit.file] ?? null
  if (!spec && !map) return { persons, encounters, documents, structured }
  await readGeneric(unit, map, plan.inputDir, (d, meta) => {
    if (d) documents.push(d)
    else if (meta?.structured) structured++
    const patient = meta?.patient ?? d?.patient
    if (meta?.person && patient) persons[patient] = { ...persons[patient], ...Object.fromEntries(Object.entries(meta.person).filter(([, v]) => v)) }
    if (meta?.encounter && patient) encounters.push({ patient, ...meta.encounter })
  }, { spec, table, byFolder: Boolean(plan.byFolder) })
  return { persons, encounters, documents, structured }
}

/**
 * 一个文件夹一位病人？输入下一级有 ≥2 个子目录、各自含 ≥3 张表且表集合相近（与病历事件还原的分组口径一致）。
 * 是的话病人一律取文件夹名（匿名化插件的输出就是这样组织的），不信表里的"病人"字段。
 */
export function folderPerPatient(inputDir, files) {
  const top = new Map()
  for (const f of files) {
    const rel = relative(inputDir, f).split(/[\\/]/)
    if (rel.length < 2) continue
    if (!top.has(rel[0])) top.set(rel[0], new Set())
    top.get(rel[0]).add(tableKeyOf(f))
  }
  const sets = [...top.values()].filter((x) => x.size >= 3)
  if (sets.length < 2) return false
  let sim = 0; let n = 0
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < Math.min(sets.length, i + 6); j++) {
    const inter = [...sets[i]].filter((x) => sets[j].has(x)).length
    sim += inter / (sets[i].size + sets[j].size - inter); n++
  }
  return n > 0 && sim / n >= 0.4
}

export const unitLabel = (u) => (u.kind === 'patient' ? u.dir : u.kind === 'range' ? `${u.file}@${u.start}-${u.end}` : u.file)
