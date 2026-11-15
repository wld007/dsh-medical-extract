/**
 * 识别规格 → 文书：一行记录按规格拼成一份带栏目的文书，供抽取引擎使用。
 *
 *   文书类别：sections 里的每个字段一个栏目（栏目名用标准栏目名）；"全文"字段按文内标题再切栏目；
 *             base64 嵌入的 XML／HTML 文书先解码。没列进 sections 的字段（编码、签名、机构……）不进正文。
 *   结构化类别（检验、医嘱、收费……）：不出文书——本插件只从文书里抽取，结构化数据的映射不在这里做；
 *             只交出人口信息与就诊，供汇总的粒度与派生字段使用。
 */
import { splitSections } from '../source/sections.js'
import { cleanValue, isPlaceholder } from '../source/clean.js'
import { normText, parseInstant, present, stableId } from '../util.js'
import { DOCUMENT_TYPES, kindOf } from './canon.js'
import { WHOLE } from './draft.js'

const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).filter(Boolean)
const first = (row, fields) => { for (const f of arr(fields)) if (present(row[f])) return String(row[f]).trim(); return null }
const SETTING_DEFAULT = { 1: '门诊', 2: '住院', 3: '体检', 门诊: '门诊', 住院: '住院', 急诊: '门诊', 体检: '体检' }

function settingOf(row, enc) {
  if (!enc?.setting || !present(row[enc.setting])) return null
  const v = String(row[enc.setting]).trim()
  return enc.settingValues?.[v] ?? SETTING_DEFAULT[v] ?? null
}

function documentParts(spec, row, cs) {
  const parts = []; const inner = []
  for (const [f, name] of spec.sections ?? []) {
    if (!present(row[f])) continue
    // 嵌入文书（base64、XML／HTML、RTF）转文字，图片等二进制丢掉，导出乱码去掉
    const v = normText(cleanValue(row[f], cs))
    if (isPlaceholder(v)) continue
    parts.push([name === WHOLE ? null : name, v])
    if (name === WHOLE) inner.push(parts.length - 1)
  }
  return { parts, inner }
}

/**
 * 一行 → { doc, person, encounter }（doc 可能为 null：作废或没有内容）。
 * ctx: { rel（文件相对路径）, index, patientFromPath(rel), table, clean（清洗计数，可选） }
 */
export function docFromSpec(spec, row, ctx) {
  if (spec.invalid?.field && spec.invalid.values?.map(String).includes(String(row[spec.invalid.field] ?? ''))) return { doc: null }
  const kind = kindOf(spec.recordType)
  let text = ''; let sections = []
  if (kind === '文书') {
    const { parts } = documentParts(spec, row, ctx.clean)
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
