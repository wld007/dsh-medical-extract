/**
 * 数据源入口：把输入（目录或文件）规划成"单元"（unit），每个单元可独立读出若干文书。
 *
 *   p_doc 导出   → 单元＝一位病人目录（人口信息、就诊一起读，供派生与就诊归属）
 *   通用文件     → 单元＝一个文件，或大 ndjson 文件的一段字节区间
 *
 * 单元按路径排序，顺序稳定；分片＝连续的若干单元。
 */
import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { patientRoots, readPatient, walk } from './pdoc.js'
import { GENERIC_EXT, mappingFor, planFile, readUnit as readGeneric } from './generic.js'

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
  const units = []; const mappings = {}
  for (const f of gen) {
    const m = await mappingFor(f, mapping)
    if (m.text == null) continue
    mappings[f] = m
    for (const u of await planFile(f, { unitBytes })) units.push(u)
  }
  if (!units.length) throw new Error('没有找到正文字段：请在设置或参数里指定 mapping.text')
  return { kind: 'generic', format: '通用文件', inputDir, units, mappings }
}

/** Read one unit → { persons: {patient: {birth, sex}}, encounters: [{patient, id, kind, start, end}], documents } */
export async function readUnitDocs(unit, plan) {
  if (unit.kind === 'patient') {
    const p = await readPatient(unit.dir, plan.inputDir)
    return { persons: { [p.patient]: p.person }, encounters: p.encounters.map((e) => ({ patient: p.patient, ...e })), documents: p.documents }
  }
  const documents = []
  await readGeneric(unit, plan.mappings[unit.file], plan.inputDir, (d) => { documents.push(d) })
  return { persons: {}, encounters: [], documents }
}

export const unitLabel = (u) => (u.kind === 'patient' ? u.dir : u.kind === 'range' ? `${u.file}@${u.start}-${u.end}` : u.file)
