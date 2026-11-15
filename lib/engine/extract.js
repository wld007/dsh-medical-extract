/**
 * 规则路径：关键词定位 → 规则取值。用于
 *   - 仅规则模式（没配模型或选了仅规则）：整条取值走这里；
 *   - 模型通读模式下：model: never 的字段，以及规则票（ruleVotes）；
 *   - 旧流程（flow: 'recall'，只为对比保留）：关键词定位后规则定不了的片段送模型。
 *
 *   presence 按断言定值；enum 按选项词；number/score/date/text 按规则捕获；list 按选项或捕获；
 *   单位换算、日期规范、选项规范名、值域检查。
 */
import { sectionAt } from '../source/sections.js'
import { stableId } from '../util.js'
import { acceptsContext, assess, clauseAt, flagsOf, presenceValue } from './assertion.js'
import { cnNumber, normalizeDateValue, parseDateText } from './dates.js'

const SENT_END = /[。！!？?\n]/

/** Sentence window (the sentence containing [s,e), widened to the previous sentence when short), ≤ 300 chars. */
export function sentenceAt(text, s, e) {
  let a = s
  while (a > 0 && !SENT_END.test(text[a - 1])) a--
  let b = e
  while (b < text.length && !SENT_END.test(text[b])) b++
  if (b < text.length) b++
  if (b - a < 30 && a > 0) { let a2 = a - 1; while (a2 > 0 && !SENT_END.test(text[a2 - 1])) a2--; a = a2 }
  if (b - a > 300) { a = Math.max(a, s - 150); b = Math.min(b, e + 150) }
  return [a, b]
}

const sectionOk = (field, name) => !field.sections || field.sections.some((x) => (name ?? '').includes(x))

export function makeValue(doc, field, { value, s, e, assertion = '阳性', method, unit = null, variant = null, precision = null, confidence = 'normal', flags = [] }) {
  const section = sectionAt(doc.sections, s)?.name ?? null
  return {
    id: stableId('V', doc.id, field.id, s, e, value),
    doc: doc.id, patient: doc.patient, encounter: doc.encounter, encounterKind: doc.encounterKind ?? null,
    recordType: doc.recordType, written: doc.written, section,
    field: field.id, value, unit, variant, precision, assertion,
    quote: doc.text.slice(s, e), s, e, method, confidence, flags,
  }
}

/** Number with unit conversion and range check → { value, unit, flags } */
export function normalizeNumber(field, raw, unitRaw) {
  const t = String(raw).trim().replace(/[，,]/g, '').replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  const n = /^-?\d+(?:\.\d+)?$/.test(t) ? Number(t) : cnNumber(t)
  if (n == null || !Number.isFinite(n)) return null
  let v = n
  const unit = field.unit ?? null
  if (unitRaw && field.units && field.units[unitRaw] != null) v = Math.round(n * field.units[unitRaw] * 1000) / 1000
  const flags = []
  if (field.range && ((field.range.min != null && v < field.range.min) || (field.range.max != null && v > field.range.max))) flags.push('超出值域')
  return { value: v, unit, flags }
}

/**
 * Extract from one document.
 * opts: { lex, mode: 'hybrid'|'model'|'rules' }
 * Returns { values, pending: { fields: [fieldId], snippets: [{id, s, e, text}], byField: {fieldId: [snippetId]} } | null, recalled: n }
 */
/** 关键词定位：字段的召回正则在允许的栏目里的命中（仅规则模式、规则票、可选的文书级跳过用） */
export function keywordHits(doc, field) {
  if (!field.recallRe) return []
  const text = doc.text
  const hits = []
  field.recallRe.lastIndex = 0
  let m
  while ((m = field.recallRe.exec(text))) {
    if (m[0] === '') { field.recallRe.lastIndex++; continue }
    // a hit may start inside a section header ("主诉：情绪低落3月"): locate by its last char, clamp the start
    const end = m.index + m[0].length
    const sec = sectionAt(doc.sections, end - 1)
    if (!sectionOk(field, sec?.name)) continue
    const s0 = sec ? Math.max(m.index, sec.s) : m.index
    if (s0 >= end) continue
    hits.push({ s: s0, e: end, section: sec?.name ?? null, lo: sec?.s ?? 0 })
    if (hits.length > 50) break
  }
  return hits
}

/**
 * 规则票：模板里写了明确规则（rules）的字段，规则捕获到的值（固定写法：量表分、数值、日期……），
 * 带 '规则票' 标记，与模型通读的结果对照。按关键词判断否认、选项的猜测不算规则票。
 */
export function ruleVotes(doc, fields, lex) {
  const out = []
  for (const field of fields) {
    if (!field.rulesC.length) continue
    const hits = keywordHits(doc, field)
    if (!hits.length) continue
    for (const v of ruleExtract(doc, field, hits, lex).values) {
      if (v.method === 'rule:term' || v.method === 'rule:option') continue
      out.push({ ...v, flags: [...v.flags, '规则票'] })
    }
  }
  return out
}

export function extractDocument(doc, tpl, { lex, mode = 'hybrid', only = null }) {
  const values = []
  const pendingFields = new Map() // fieldId -> Set of [a,b]
  let recalled = 0
  if (!tpl.acceptsDocument(doc)) return { values, pending: null, recalled }
  const text = doc.text
  for (const field of tpl.fields) {
    if (field.type === 'derived' || !field.recallRe) continue
    if (only && !only.has(field.id)) continue
    if (field.recordTypes && !field.recordTypes.includes(doc.recordType)) continue
    const hits = keywordHits(doc, field)
    if (!hits.length) continue
    recalled++
    const wantModel = mode !== 'rules' && (field.model === 'always' || (mode === 'model' && field.model !== 'never'))
    const ruleVals = ruleExtract(doc, field, hits, lex)
    const unresolved = ruleVals.unresolved
    if (wantModel) {
      for (const v of ruleVals.values) values.push({ ...v, flags: [...v.flags, '规则票'] })
      const set = pendingFields.get(field.id) ?? new Set()
      for (const h of hits) set.add(sentenceAt(text, h.s, h.e).join(':'))
      pendingFields.set(field.id, set)
    } else {
      values.push(...ruleVals.values)
      if (unresolved.length && mode !== 'rules' && field.model !== 'never') {
        const set = pendingFields.get(field.id) ?? new Set()
        for (const h of unresolved) set.add(sentenceAt(text, h.s, h.e).join(':'))
        pendingFields.set(field.id, set)
      } else if (unresolved.length && mode === 'rules') {
        // 规则定不了、又不调模型：记一个"待定"值，汇总时不算有
        const h = unresolved[0]
        values.push(makeValue(doc, field, { value: null, s: h.s, e: h.e, method: 'rule:unresolved', confidence: 'low', flags: ['待定'] }))
      }
    }
  }
  let pending = null
  if (pendingFields.size) {
    const ranges = new Map() // "a:b" -> snippet
    const byField = {}
    for (const [fid, set] of pendingFields) {
      byField[fid] = []
      for (const key of set) {
        if (!ranges.has(key)) { const [a, b] = key.split(':').map(Number); ranges.set(key, { id: `S${ranges.size + 1}`, s: a, e: b, text: text.slice(a, b) }) }
        byField[fid].push(ranges.get(key).id)
      }
    }
    pending = { fields: [...pendingFields.keys()], snippets: [...ranges.values()], byField }
  }
  return { values, pending, recalled }
}

/**
 * Clause around a hit. The start is clamped to the hit's section (captures never include the section header);
 * the end is not (a short structured row "项目：血红蛋白，结果：112 g/L" keeps the value in the next section).
 */
function clauseIn(doc, h) {
  let [a, b] = clauseAt(doc.text, h.s, h.e)
  const sec = sectionAt(doc.sections, h.s)
  if (sec) a = Math.max(a, sec.s)
  return [a, b]
}

/** Distinct option values matched in a clause; a match inside a longer match of another option does not count (明显好转 ⊃ 好转). */
export function optionsIn(field, clause) {
  const ms = []
  for (const o of field.optionsC) {
    if (!o.re) continue
    o.re.lastIndex = 0
    let m
    while ((m = o.re.exec(clause))) { if (m[0] === '') { o.re.lastIndex++; continue } ms.push({ v: o.value, s: m.index, e: m.index + m[0].length }) }
  }
  const kept = ms.filter((x) => !ms.some((y) => y !== x && y.v !== x.v && y.s <= x.s && y.e >= x.e && y.e - y.s > x.e - x.s))
  return [...new Set(kept.map((x) => x.v))]
}

/** The option whose terms cover the longest part of `s` (艾司西酞普兰 beats 西酞普兰). */
export function bestOption(field, s) {
  let best = null; let len = 0
  for (const o of field.optionsC) {
    if (!o.re) continue
    o.re.lastIndex = 0
    let m
    while ((m = o.re.exec(s))) { if (m[0].length > len) { best = o; len = m[0].length } if (m[0] === '') o.re.lastIndex++ }
  }
  return best
}

/** Rule extraction for one field. Returns { values, unresolved: hits needing the model }. */
function ruleExtract(doc, field, hits, lex) {
  const text = doc.text
  const values = []; const unresolved = []
  const written = doc.written?.slice(0, 10) ?? null
  // explicit rules first (fixed value or captures), over clauses that contain a hit
  const covered = new Set()
  if (field.rulesC.length) {
    const clauses = new Map()
    for (const h of hits) { const [a, b] = clauseIn(doc, h); clauses.set(`${a}:${b}`, [a, b, h]) }
    for (const [a, b, h0] of clauses.values()) {
      for (const r of field.rulesC) {
        if (r.sections && !r.sections.some((x) => (h0.section ?? '').includes(x))) continue
        r.re.lastIndex = 0
        const clause = text.slice(a, b)
        let m
        while ((m = r.re.exec(clause))) {
          if (m[0] === '') { r.re.lastIndex++; continue }
          const s = a + m.index; const e = s + m[0].length
          const g = m.groups ?? {}
          const sec = sectionAt(doc.sections, s)
          const as = r.assertion ? { assertion: r.assertion, flags: flagsOf(r.assertion) } : assess(text, s, e, sec?.name, lex, sec?.s ?? 0)
          const v = ruleValue(field, r, g, as, written)
          if (v === undefined) continue
          covered.add(`${a}:${b}`)
          if (v === null) continue
          // value span: the captured group when present (quote = evidence), else whole match
          values.push(makeValue(doc, field, { ...v, s, e, assertion: as.assertion, method: `rule:${r.id}`, confidence: 'high' }))
        }
      }
    }
  }
  for (const h of hits) {
    const [a, b] = clauseIn(doc, h)
    if (covered.has(`${a}:${b}`)) continue
    const as = assess(text, h.s, h.e, h.section, lex, h.lo)
    switch (field.type) {
      case 'presence': {
        const v = presenceValue(as.flags, field.accept)
        if (v) values.push(makeValue(doc, field, { value: v, s: h.s, e: h.e, assertion: as.assertion, method: 'rule:term' }))
        break
      }
      case 'enum': {
        if (as.flags.neg || !acceptsContext(as.flags, field.accept)) break
        const opts = optionsIn(field, text.slice(a, b))
        if (opts.length === 1) values.push(makeValue(doc, field, { value: opts[0], s: h.s, e: h.e, assertion: as.assertion, method: 'rule:option' }))
        else unresolved.push(h)
        break
      }
      case 'list': {
        if (as.flags.neg || !acceptsContext(as.flags, field.accept)) break
        const opt = bestOption(field, text.slice(h.s, h.e))
        if (opt) values.push(makeValue(doc, field, { value: opt.value, s: h.s, e: h.e, assertion: as.assertion, method: 'rule:option' }))
        else unresolved.push(h)
        break
      }
      default:
        unresolved.push(h)
    }
  }
  // de-duplicate same value at same span
  const seen = new Set()
  return { values: values.filter((v) => { const k = `${v.s}:${v.e}:${v.value}`; if (seen.has(k)) return false; seen.add(k); return true }), unresolved }
}

/** Value from a rule match. undefined = rule did not apply; null = applied but value dropped (e.g. negated). */
function ruleValue(field, r, g, as, written) {
  if (field.type === 'presence') {
    if (r.value != null) {
      if (r.assertion) return { value: r.value }
      const pv = presenceValue(as.flags, field.accept)
      if (!pv) return null
      return { value: pv === '有' ? r.value : pv }
    }
    return undefined
  }
  if (as.flags.neg || !acceptsContext(as.flags, field.accept)) return null
  if (r.value != null) return { value: r.value }
  let raw = g.v ?? g.date
  if (raw != null && r.map && r.map[raw] != null) raw = r.map[raw]
  if (raw == null) return undefined
  switch (field.type) {
    case 'number': case 'score': {
      const n = normalizeNumber(field, raw, g.unit)
      if (!n) return undefined
      if (typeof r.factor === 'number') {
        n.value = Math.round(n.value * r.factor * 1000) / 1000
        n.flags = n.flags.filter((x) => x !== '超出值域')
        if (field.range && ((field.range.min != null && n.value < field.range.min) || (field.range.max != null && n.value > field.range.max))) n.flags.push('超出值域')
      }
      let variant = g.variant ?? null
      if (variant && field.variants) variant = Object.entries(field.variants).find(([, alts]) => [].concat(alts).some((x) => String(x) === String(variant)))?.[0] ?? variant
      return { value: n.value, unit: n.unit, variant, flags: n.flags }
    }
    case 'date': {
      const d = parseDateText(raw, written) ?? normalizeDateValue(raw)
      return d ? { value: d.date, precision: d.precision } : undefined
    }
    case 'enum': {
      const o = field.optionsC.find((x) => x.value === raw || (x.re && (x.re.lastIndex = 0, x.re.test(raw))))
      return o ? { value: o.value } : undefined
    }
    case 'list': {
      const o = bestOption(field, String(raw))
      return { value: o ? o.value : String(raw).trim() }
    }
    default: return { value: String(raw).trim().slice(0, 200) }
  }
}
