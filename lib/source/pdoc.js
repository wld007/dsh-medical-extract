/**
 * 内置数据源：区域平台导出（p_doc_*.json，按月分文件，一位病人一个目录）。
 *
 * 一位病人目录 → { person, encounters, documents }。
 * 文书表按字段拼成一篇（栏目＝字段的中文名）；入院记录正文按标题切栏目；
 * 结构化表（诊断、检验、症状……）每行渲染成一份短文书，让模板用同一套召回与规则去抽。
 * 不认识的 p_doc 表：取 *_NM、*_DSCPT 与长文本字段渲染，识别号类字段一律不渲染。
 */
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, relative, sep } from 'node:path'
import { joinFields, splitSections } from './sections.js'
import { normText, parseInstant, present, stableId } from '../util.js'

export const PERSON_FILE = 'p_doc_dwd_psn_rcd.json'

const VST_TP = { 1: '门诊', 2: '住院', 3: '体检' }
const DIAG_CGY = { cbzd: '初步诊断', cyzd: '出院诊断', bczd: '补充诊断', ryzd: '入院诊断', mzzd: '门诊诊断' }

/** 识别号、编码、人名、来源等：不渲染进文书 */
const HIDDEN = /^(?:_id|PRM_KEY|ID_CRD_NO|PID|PTT_NM|RSDNT_NM|SLF_TEL_NO|CRD_NO|RSVT_NO|SOURCE_\w+|\w+_(?:NO|CD|FLG|STFF_NM|DCT_NM|SGNT|DCT_SGNT|TM|DT|DT_TM|TIME))$/

/** 文书表：fields 依次拼接；written 取第一个可解析的时间字段；encounter 取第一个有值的就诊号字段。 */
export const TABLES = {
  'p_doc_fact_admn_mdc_htr_rcd.json': {
    recordType: '入院记录', textField: 'PST_ILLNS_HST', split: true,
    written: ['RCD_DT_TM', 'CRT_TM'], recordTime: /记录时间\s*[:：]\s*(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})时(\d{1,2})分/,
    encounter: ['INHOS_NO'], encounterKind: '住院',
  },
  'p_doc_fact_dscg_rcd.json': {
    recordType: '出院记录',
    fields: [['ADMN_CDT', '入院情况'], ['TRT_PRCS', '诊疗经过'], ['DSCG_CDT', '出院情况'], ['DSCG_DIAG', '出院诊断'], ['DSCG_ORDR', '出院医嘱']],
    written: ['UPD_DT', 'CRT_TM'], writtenMin: true, encounter: ['INHOS_NO'], encounterKind: '住院', extraText: true,
  },
  'p_doc_fact_otpt_emg_mdc_htr_rcd.json': {
    recordType: '门诊病历',
    fields: [['CHF_COMPLNT', '主诉'], ['PRST_ILLNS_HST', '现病史'], ['PAST_HST', '既往史'], ['PSN_HST', '个人史'], ['MRTL_HST', '婚育史'],
      ['MST_HST', '月经史'], ['INFCT_HST', '传染病史'], ['ALGN_HST', '过敏史'], ['PSQ_EXAM', '体格检查'], ['AXLR_EXAM', '辅助检查'],
      ['DIAG_DSCPT', '诊断'], ['HDL_SGST', '处理意见'], ['ATNT_ITM', '注意事项']],
    written: ['$visit', 'CRT_TM'], encounter: ['OTPT_EMG_NO'], encounterKind: '门诊', extraText: true,
  },
  'p_doc_fact_exam_rcd.json': {
    recordType: '检查报告',
    fields: [['EXAM_ITM_NM', '检查项目'], ['EXAM_RPT_RSLT_OBJCT', '所见'], ['EXAM_RPT_RSLT_SBJCT', '结论']],
    written: ['EXAM_RPT_DT', 'EXAM_DT', 'CRT_TM'], encounter: ['INHOS_NO', 'OTPT_EMG_NO', 'EXAM_INHOS_NO', 'EXAM_OTPT_NO'],
  },
  'p_doc_fact_vst_infmt.json': {
    recordType: '就诊登记', visit: true, inline: true,
    fields: [['VST_TP', '就诊类型', VST_TP], ['VST_DPT_NM', '科室'], ['ADMN_DPT_NM', '入院科室'], ['ADMN_TNTTV_DIAG_DSCPT', '入院诊断'],
      ['DSES_HST', '既往史'], ['PAST_HST', '既往史'], ['OPRT_HST', '手术史'], ['TRSFS_BLD_HST', '输血史'], ['INFCT_HST', '传染病史'],
      ['ALGN_HST', '过敏史'], ['PSN_HST', '个人史'], ['MRTL_HST', '婚育史'], ['MST_HST', '月经史'], ['MRY_CDT_NM', '婚姻状况'],
      ['PFS_CGY_NM', '职业'], ['PE_RSLT', '体检结果'], ['HDL_GDC_SGST', '处理意见']],
    written: ['VST_DT_TM', 'ADMN_DT_TM', 'VST_DT', 'CRT_TM'], encounter: ['INHOS_NO', 'OTPT_EMG_NO'],
  },
  'p_doc_fact_diag_infmt.json': {
    recordType: '诊断记录', inline: true,
    fields: [['DIAG_DSCPT', '诊断'], ['DIAG_ICD10_NM', 'ICD-10 名称'], ['DIAG_ICD10_CD', 'ICD-10'], ['DIAG_CGY_NM', '诊断类别', DIAG_CGY],
      ['MAIN_DIAG_FLG', '主诊断', { 1: '是', 0: '否' }], ['VST_TP', '就诊类型', VST_TP], ['DIAG_DPT_NM', '科室'], ['TCM_DSES_NM', '中医病名'], ['RMRK', '备注']],
    written: ['DIAG_DT', 'CRT_TM'], encounter: ['INHOS_NO', 'OTPT_EMG_NO'],
  },
  'p_doc_fact_test_rcd.json': {
    recordType: '检验', inline: true,
    fields: [['TEST_ITM_NM', '检验组合'], ['TEST_CHD_ITM_NM', '项目'], ['STD_TEST_CHD_ITM_NM', '标准项目'], ['$result', '结果'], ['RFRC_VLU', '参考范围'], ['RSLT_DCD_NM', '结果判定'], ['SPCM_NM', '标本']],
    written: ['ADT_TM', 'TEST_DT', 'CRT_TM'], encounter: ['INHOS_NO', 'OTPT_EMG_NO', 'TEST_INHOS_NO', 'TEST_OTPT_NO'],
  },
  'p_doc_fact_oprt_rcd.json': {
    recordType: '手术记录', inline: true,
    fields: [['OPRT_NM', '手术名称'], ['OPRT_DPT_NM', '科室'], ['OPRT_LVL_NM', '手术级别'], ['ATHS_WAY_NM', '麻醉方式'], ['OPRT_INCS_CGY_NM', '切口类别']],
    written: ['OPRT_STRT_DT_TM', 'OPRT_DT_TM', 'CRT_TM'], encounter: ['INHOS_NO'],
  },
  'p_doc_dwd_psn_rcd.json': { recordType: '基本信息', inline: true, fields: [['GDR_NM', '性别'], ['BTH_DT', '出生日期']], written: [] },
  'p_doc_fact_otpt_fee_dtl.json': { skip: true },
}

const instant = (v) => (present(v) ? parseInstant(v) : null)

/** Recursively list files (sorted, deterministic). */
export async function walk(dir, out = [], skip = () => false) {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return out }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!skip(p)) await walk(p, out, skip) } else if (e.isFile()) out.push(p)
  }
  return out
}

/**
 * 病人目录：每个基本信息文件，向上取不含其他基本信息文件的最高祖先（在输入之下）。
 * 没有基本信息文件时：含 p_doc 文件的输入整体当一位病人。
 */
export function patientRoots(inputDir, files) {
  const persons = files.filter((f) => basename(f) === PERSON_FILE)
  if (!files.some((f) => /p_doc_\w+\.json$/.test(basename(f)))) return []
  if (persons.length <= 1) return [inputDir]
  const roots = new Set()
  for (const p of persons) {
    let cur = dirname(p)
    for (;;) {
      const up = dirname(cur)
      if (up === cur || relative(inputDir, up).startsWith('..')) break
      if (persons.some((q) => q !== p && (q + sep).startsWith(up + sep))) break
      cur = up
      if (cur === inputDir) break
    }
    roots.add(cur)
  }
  return [...roots].sort()
}

function renderField(row, field, codes) {
  if (field === '$result') {
    const v = row.TEST_RSLT_VLU
    return present(v) ? `${String(v).trim()}${present(row.TEST_RSLT_VLU_UNT) ? ` ${String(row.TEST_RSLT_VLU_UNT).trim()}` : ''}` : null
  }
  const v = row[field]
  if (!present(v)) return null
  const s = String(v).trim()
  return codes && codes[s] != null ? codes[s] : s
}

function writtenOf(spec, row, visitTime) {
  const list = spec.written ?? []
  if (spec.writtenMin) {
    const xs = list.map((f) => instant(row[f])).filter(Boolean).sort()
    return xs[0] ?? null
  }
  for (const f of list) {
    const t = f === '$visit' ? visitTime : instant(row[f])
    if (t) return t
  }
  return null
}

/**
 * Read one patient directory. Returns { patient, person, encounters, documents }.
 * Documents: { id, patient, encounter, encounterKind, recordType, written, text, sections, source:{file,key} }
 */
export async function readPatient(patientDir, inputDir, { invalidField = 'INVLD_FLG' } = {}) {
  const files = (await walk(patientDir)).filter((f) => /p_doc_\w+\.json$/.test(basename(f)))
  const patient = relative(inputDir, patientDir) || basename(patientDir)
  const tables = new Map()
  for (const f of files) {
    let rows
    try { rows = JSON.parse(await readFile(f, 'utf8')) } catch (e) { throw new Error(`读不了 ${relative(inputDir, f)}：${e.message}`) }
    if (!Array.isArray(rows)) rows = rows && typeof rows === 'object' ? (Array.isArray(rows.records) ? rows.records : [rows]) : []
    const name = basename(f)
    if (!tables.has(name)) tables.set(name, [])
    rows.forEach((row, index) => { if (row && typeof row === 'object') tables.get(name).push({ row, file: relative(inputDir, f), index, dir: basename(dirname(dirname(f))) }) })
  }

  // 人口信息
  const person = {}
  for (const { row } of tables.get(PERSON_FILE) ?? []) {
    person.birth ??= instant(row.BTH_DT)?.slice(0, 10) ?? null
    person.sex ??= present(row.GDR_NM) ? String(row.GDR_NM).trim() : null
  }
  // 就诊
  const encounters = new Map()
  const visitTime = new Map()
  for (const { row } of tables.get('p_doc_fact_vst_infmt.json') ?? []) {
    const kind = VST_TP[String(row.VST_TP)] ?? null
    const id = present(row.INHOS_NO) ? String(row.INHOS_NO) : present(row.OTPT_EMG_NO) ? String(row.OTPT_EMG_NO) : null
    if (!id) continue
    const start = instant(row.ADMN_DT_TM) ?? instant(row.VST_DT_TM) ?? instant(row.VST_DT)
    const end = instant(row.DSCG_DT_TM)
    const cur = encounters.get(id) ?? { id, kind, start, end, dept: null }
    cur.kind ??= kind
    if (start && (!cur.start || start < cur.start)) cur.start = start
    if (end && (!cur.end || end > cur.end)) cur.end = end
    cur.dept ??= [row.ADMN_DPT_NM, row.VST_DPT_NM].find(present) ?? null
    encounters.set(id, cur)
    if (present(row.OTPT_EMG_NO) && start) visitTime.set(String(row.OTPT_EMG_NO), instant(row.VST_DT_TM) ?? start)
  }

  const documents = []
  const seen = new Set()
  for (const [name, rows] of [...tables.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const spec = TABLES[name] ?? { recordType: null, generic: true, written: ['RCD_TIME', 'CRT_TM', 'UPD_DT'], encounter: ['INHOS_NO', 'OTPT_EMG_NO'] }
    if (spec.skip) continue
    for (const r of rows) {
      const row = r.row
      if (invalidField && String(row[invalidField] ?? '') === '1') continue
      let text = ''; let sections = []
      if (spec.textField) {
        text = normText(row[spec.textField])
        sections = spec.split ? splitSections(text) : [{ name: '正文', s: 0, e: text.length }]
      } else {
        const parts = (spec.generic ? genericFields(row) : spec.fields).map(([f, label, codes]) => [label, renderField(row, f, codes)])
        if (spec.extraText) for (const [f, v] of Object.entries(row)) if (!spec.fields.some(([x]) => x === f) && !HIDDEN.test(f) && typeof v === 'string' && v.trim().length >= 20) parts.push([f, v])
        ;({ text, sections } = joinFields(parts.map(([l, v]) => [l, v == null ? null : normText(v)]), spec.inline || spec.generic ? '，' : '\n'))
      }
      if (!text.trim()) continue
      const encKey = (spec.encounter ?? []).map((f) => row[f]).find(present)
      const encounter = encKey != null ? String(encKey) : null
      let written = writtenOf(spec, row, encounter ? visitTime.get(encounter) : null)
      if (spec.recordTime) {
        const m = text.match(spec.recordTime)
        if (m) written = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')} ${m[4].padStart(2, '0')}:${m[5].padStart(2, '0')}`
      }
      // 同主键出现在多个月份文件（如第二版入院记录）：后出现的加文件名
      let key = present(row.PRM_KEY) ? String(row.PRM_KEY) : `#${r.index}`
      if (seen.has(`${name}|${key}`)) key = `${key}@${r.file}`
      seen.add(`${name}|${key}`)
      const enc = encounter ? encounters.get(encounter) : null
      documents.push({
        id: stableId('D', patient, name, key),
        patient,
        encounter,
        encounterKind: enc?.kind ?? spec.encounterKind ?? null,
        recordType: spec.recordType ?? r.dir ?? name.replace(/^p_doc_|\.json$/g, ''),
        written,
        text,
        sections,
        source: { file: r.file, key },
      })
    }
  }
  documents.sort((a, b) => ((a.written ?? '') < (b.written ?? '') ? -1 : (a.written ?? '') > (b.written ?? '') ? 1 : a.id < b.id ? -1 : 1))
  return { patient, person, encounters: [...encounters.values()], documents }
}

function genericFields(row) {
  return Object.keys(row)
    .filter((f) => !HIDDEN.test(f) && (/_(?:NM|DSCPT|HST|RSLT|ADDR)$/.test(f) || (typeof row[f] === 'string' && row[f].length >= 20)))
    .map((f) => [f, f])
}
