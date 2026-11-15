/**
 * 识别规格 → 文书：一行记录按规格拼成一份带栏目的文书，供抽取引擎使用。
 *
 *   文书类别：sections 里的每个字段一个栏目（栏目名用标准栏目名）；"全文"字段按文内标题再切栏目；
 *             base64 嵌入的 XML／HTML 文书先解码。没列进 sections 的字段（编码、签名、机构……）不进正文。
 *   结构化类别：按角色拼成一行带标签的短文书（诊断：…，ICD-10：…；项目：…，结果：…），与区域平台导出的渲染一致。
 */
import { joinFields, splitSections } from '../source/sections.js'
import { normText, parseInstant, present, stableId } from '../util.js'
import { DOCUMENT_TYPES, STRUCTURED_TYPES, kindOf } from './canon.js'
import { decodeEmbedded, looksBase64 } from './read.js'
import { WHOLE } from './draft.js'

const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).filter(Boolean)
const first = (row, fields) => { for (const f of arr(fields)) if (present(row[f])) return String(row[f]).trim(); return null }
const SETTING_DEFAULT = { 1: '门诊', 2: '住院', 3: '体检', 门诊: '门诊', 住院: '住院', 急诊: '门诊', 体检: '体检' }

/** 角色 → 渲染标签（和模板里常用的栏目名对齐） */
const LABEL = {
  诊断记录: { name: '诊断', icd: 'ICD-10', category: '诊断类别', main: '主诊断' },
  检验: { panel: '检验组合', item: '项目', value: '结果', ref: '参考范围', flag: '结果判定', specimen: '标本' },
  医嘱: { orderType: '医嘱类型', item: '医嘱', route: '途径', frequency: '频次', category: '医嘱类别' },
  处方: { item: '处方', route: '途径', frequency: '频次', days: '天数', quantity: '数量' },
  用药记录: { item: '用药', route: '途径' },
  治疗记录: { item: '治疗', result: '结果' },
  申请单: { item: '申请项目', reason: '申请目的' },
  手术记录: { name: '手术名称', code: '手术编码', anesthesia: '麻醉方式' },
  就诊登记: { setting: '就诊类型', dept: '科室', org: '机构', reason: '入院诊断' },
  基本信息: { sex: '性别', birth: '出生日期' },
  收费: { item: '收费项目', category: '费用类别', quantity: '数量' },
  生命体征: { item: '项目', value: '测量值' },
}
const WITH_UNIT = new Set(['value', 'dose'])

function settingOf(row, enc) {
  if (!enc?.setting || !present(row[enc.setting])) return null
  const v = String(row[enc.setting]).trim()
  return enc.settingValues?.[v] ?? SETTING_DEFAULT[v] ?? null
}

function structuredParts(spec, row) {
  const rt = spec.recordType
  const roles = spec.roles ?? {}
  if (rt === '生命体征' && spec.measures?.length) return spec.measures.map(([f, name, unit]) => [name, present(row[f]) ? `${String(row[f]).trim()}${unit ? ` ${unit}` : ''}` : null])
  if (rt === '其他结构化') return arr(roles.text).map((f) => [f, first(row, f)])
  const labels = LABEL[rt] ?? Object.fromEntries(Object.entries(STRUCTURED_TYPES[rt]?.roles ?? {}).map(([r, d]) => [r, d.split(/[（(，,／]/)[0]]))
  const parts = []
  for (const [role, label] of Object.entries(labels)) {
    let v = first(row, roles[role])
    if (v == null) continue
    if (role === 'setting') v = settingOf(row, { setting: arr(roles.setting)[0], settingValues: spec.encounter?.settingValues }) ?? v
    if (role === 'item' && (rt === '医嘱' || rt === '处方' || rt === '用药记录')) {
      const extra = [first(row, roles.dose) && `${first(row, roles.dose)}${first(row, roles.unit) ?? ''}`].filter(Boolean)
      if (extra.length) v = `${v} ${extra.join(' ')}`
    }
    if (WITH_UNIT.has(role) && first(row, roles.unit) && rt === '检验') v = `${v} ${first(row, roles.unit)}`
    parts.push([label, v])
  }
  return parts
}

function documentParts(spec, row) {
  const parts = []; const inner = []
  for (const [f, name] of spec.sections ?? []) {
    if (!present(row[f])) continue
    let v = row[f]
    if (typeof v === 'string' && looksBase64(v.trim())) { const d = decodeEmbedded(v); if (!d) continue; v = d.text } else if (typeof v === 'string' && /^\s*<(?:\?xml|html|div|p\b|[A-Za-z]+[\s>])/.test(v)) { const d = decodeEmbedded(v); if (d) v = d.text }
    parts.push([name === WHOLE ? null : name, normText(v)])
    if (name === WHOLE) inner.push(parts.length - 1)
  }
  return { parts, inner }
}

/**
 * 一行 → { doc, person, encounter }（doc 可能为 null：作废或没有内容）。
 * ctx: { rel（文件相对路径）, index, patientFromPath(rel), table }
 */
export function docFromSpec(spec, row, ctx) {
  if (spec.invalid?.field && spec.invalid.values?.map(String).includes(String(row[spec.invalid.field] ?? ''))) return { doc: null }
  const kind = kindOf(spec.recordType)
  let text = ''; let sections = []
  if (kind === '文书') {
    const { parts } = documentParts(spec, row)
    // "全文"字段不加标题，直接按文内标题切
    for (const [name, v] of parts) {
      if (!v || !v.trim()) continue
      if (name == null) {
        const s0 = text.length
        const sub = splitSections(v)
        text += v
        for (const x of sub) sections.push({ name: x.name, s: s0 + x.s, e: s0 + x.e })
      } else {
        // 取值自己已经以栏目名开头（"诊疗计划：予…"）：不再加一遍标题
        const own = v.match(new RegExp(`^\\s*【?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}】?\\s*[:：]\\s*`))
        const head = own ? '' : `${name}：`
        const s = text.length + head.length + (own ? own[0].length : 0)
        text += head + v
        sections.push({ name, s, e: text.length })
      }
      text += '\n'
    }
  } else if (kind === '结构化') {
    ;({ text, sections } = joinFields(structuredParts(spec, row).map(([l, v]) => [l, v == null ? null : normText(v)]), '，'))
  }
  const enc = spec.encounter ?? {}
  const encounterId = first(row, enc.inpatient) ?? first(row, enc.outpatient)
  const encounterKind = settingOf(row, enc) ?? (first(row, enc.inpatient) ? '住院' : first(row, enc.outpatient) ? '门诊' : null)
  const keyParts = arr(spec.key).map((f) => (present(row[f]) ? String(row[f]) : '')).filter(Boolean)
  const key = keyParts.length ? keyParts.join('|') : `${ctx.rel}#${ctx.index}`
  const patient = (ctx.byFolder ? ctx.patientFromPath(ctx.rel) : null) ?? first(row, spec.patient) ?? ctx.patientFromPath(ctx.rel) ?? key
  const written = arr(spec.written).map((f) => parseInstant(row[f])).find(Boolean) ?? arr(spec.occur).map((f) => parseInstant(row[f])).find(Boolean) ?? null
  const roles = spec.roles ?? {}
  const person = roles.birth || roles.sex ? { birth: parseInstant(first(row, roles.birth))?.slice(0, 10) ?? null, sex: first(row, roles.sex) } : null
  const admit = enc.admit ? parseInstant(row[enc.admit]) : null
  const discharge = enc.discharge ? parseInstant(row[enc.discharge]) : null
  const encounter = encounterId && (admit || discharge || spec.recordType === '就诊登记') ? { id: encounterId, kind: encounterKind, start: admit ?? written, end: discharge } : null
  const doc = text.trim() ? {
    id: stableId('D', ctx.rel, key),
    patient, encounter: encounterId, encounterKind, recordType: spec.recordType === '其他文书' || spec.recordType === '其他结构化' ? ctx.table.replace(/^[A-Za-z]*\d+(?:[_-]\d+)*[_-]?/, '') || spec.recordType : spec.recordType,
    written, text, sections: sections.length ? sections : splitSections(text), source: { file: ctx.rel, key },
  } : null
  return { doc, person, encounter, patient }
}

export { DOCUMENT_TYPES }
