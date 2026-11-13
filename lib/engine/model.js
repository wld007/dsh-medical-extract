/**
 * E3 模型抽取：一份文书的待定字段＋候选片段 → 一次调用（字段多时分批）→ 值。
 *
 * 模型给的位置一律不信：插件拿引语回原文片段里找，找不到就丢弃并计数（验收门①）。
 * 值不在类型、选项、值域内的丢弃或标出（验收门②）。
 * 回复按 sha256(模型＋提示) 缓存，同一输出根目录下各批次、各分片复用；相同片段的文书天然命中缓存。
 */
import { ASSERTIONS } from '../template/load.js'
import { sha256 } from '../util.js'
import { acceptsContext, flagsOf, presenceValue } from './assertion.js'
import { normalizeDateValue, parseDateText } from './dates.js'
import { bestOption, makeValue, normalizeNumber } from './extract.js'
import { extractJson } from '../llm.js'

export const SYSTEM = '你是病历信息抽取助手。只根据给出的原文片段抽取，不推断原文没有写的内容。每个值都必须逐字引用原文。只输出一个 JSON 对象，不要输出其他内容。'
const MAX_FIELDS_PER_CALL = 16

function fieldBrief(f) {
  const o = { id: f.id, name: f.name, type: f.type, definition: f.definition }
  if (f.include?.length) o.include = f.include
  if (f.exclude?.length) o.exclude = f.exclude
  if (f.options?.length) o.options = f.options.map((x) => x.value)
  if (f.unit) o.unit = f.unit
  if (f.scale) o.scale = f.scale
  if (f.variants) o.variants = Object.keys(f.variants)
  if (f.examples?.length) o.examples = f.examples.slice(0, 2)
  const acc = [...f.accept]
  if (acc.length !== 1 || acc[0] !== '阳性') o.accept = acc
  return o
}

const VALUE_HINT = {
  presence: '有／无／可疑', enum: 'options 之一', number: '数字（按 unit）', score: '数字（量表总分）；variant 填量表版本（若写明）',
  date: 'YYYY-MM-DD、YYYY-MM 或 YYYY；相对时间按写成时间换算', text: '原文里的简短表述（≤50字）', list: '一项一个值（如每种药物各一条）',
}

export function buildPrompt(doc, fields, snippets) {
  const types = [...new Set(fields.map((f) => f.type))]
  return `文书类型：${doc.recordType}；写成时间：${doc.written ?? '不详'}
要抽取的字段：
${JSON.stringify(fields.map(fieldBrief))}
原文片段：
${snippets.map((s) => `${s.id}: ${s.text.replace(/\n/g, ' ')}`).join('\n')}
要求：
- 只抽与字段定义相符、且在片段里写明的内容；片段里没有的字段不要输出。
- value：${types.map((t) => `${t} 填 ${VALUE_HINT[t] ?? '值'}`).join('；')}。
- assertion：阳性、否认、可疑、既往、家族、计划 之一（"无""否认"→否认；既往发作/病史→既往；亲属的情况→家族；计划 只用于尚未执行的打算，如建议、拟、必要时、如有……；本次直接开出的处方、医嘱、治疗算阳性）。
- quote：从片段中逐字抄出支撑该值的最短原文，必须与原文完全一致；snippet：quote 所在片段 id。
- 同一字段可以有多个值（多种药物、多次评分、不同时间）。
- presence 字段：片段里明确否认的（"无""否认""未引出"）也要输出，value 填"无"、assertion 填"否认"。
输出：{"values":[{"field":"字段id","value":"…","assertion":"阳性","quote":"…","snippet":"S1","variant":null}]}`
}

/** Does the quote contain the option's value or one of its terms? Options without terms (e.g. 其他) always pass. */
function quoteHas(o, quote, field) {
  if (quote.includes(o.value)) return true
  if (!o.re) return true
  o.re.lastIndex = 0
  if (o.re.test(quote)) return true
  // 没有任何选项的写法出现在引语里（如"疗效欠佳"之类的概括）：不拦
  return !field.optionsC.some((x) => x.re && (x.re.lastIndex = 0, x.re.test(quote)))
}

/** Validate one model answer item → { ok, value } | { ok:false, problem, gate } */
export function validateAnswer(doc, field, ans, snippetsById, written) {
  if (!ans || typeof ans !== 'object') return { ok: false, problem: '格式不对', gate: '②' }
  const quote = typeof ans.quote === 'string' ? ans.quote.trim() : ''
  if (!quote || quote.length > 400) return { ok: false, problem: '缺少引语', gate: '①' }
  let s = -1
  const snip = snippetsById.get(ans.snippet)
  if (snip) { const i = snip.text.indexOf(quote); if (i >= 0) s = snip.s + i }
  if (s < 0) {
    // 引语不在所报片段：在所有候选片段里找；再不行在全文找（同一处）
    for (const sn of snippetsById.values()) { const i = sn.text.indexOf(quote); if (i >= 0) { s = sn.s + i; break } }
    if (s < 0) { const i = doc.text.indexOf(quote); if (i >= 0) s = i }
  }
  if (s < 0) return { ok: false, problem: '引语不在原文中', gate: '①' }
  const e = s + quote.length
  const assertion = ASSERTIONS.includes(ans.assertion) ? ans.assertion : '阳性'
  const raw = ans.value
  const flags = []
  if (field.type !== 'presence' && field.type !== 'text' && (assertion === '否认' || !acceptsContext(flagsOf(assertion), field.accept))) return { ok: true, value: null }
  switch (field.type) {
    case 'presence': {
      const f = { neg: assertion === '否认' || raw === '无', family: assertion === '家族', history: assertion === '既往', plan: assertion === '计划', uncertain: assertion === '可疑' || raw === '可疑' }
      const v = presenceValue(f, field.accept)
      if (!v) return { ok: true, value: null }
      return { ok: true, value: { value: v, s, e, assertion } }
    }
    case 'enum': {
      if (assertion === '否认' || assertion === '计划') return { ok: true, value: null }
      const o = field.optionsC.find((x) => x.value === raw) ?? bestOption(field, String(raw ?? ''))
      if (!o) return { ok: false, problem: `值 ${raw} 不在选项内`, gate: '②' }
      if (!quoteHas(o, quote, field)) return { ok: false, problem: `引语里没有"${o.value}"的写法`, gate: '①' }
      return { ok: true, value: { value: o.value, s, e, assertion } }
    }
    case 'number': case 'score': {
      if (assertion === '否认' || assertion === '计划') return { ok: true, value: null }
      const n = normalizeNumber(field, raw, ans.unit)
      if (!n) return { ok: false, problem: `值 ${raw} 不是数字`, gate: '②' }
      if (/\d/.test(quote) && !quote.includes(String(raw).trim()) && !quote.includes(String(n.value))) return { ok: false, problem: `引语里没有数值 ${raw}`, gate: '①' }
      let variant = ans.variant ?? null
      if (variant && field.variants && !field.variants[variant]) variant = Object.entries(field.variants).find(([, alts]) => [].concat(alts).map(String).includes(String(variant)))?.[0] ?? null
      return { ok: true, value: { value: n.value, unit: n.unit, variant, s, e, assertion, flags: n.flags } }
    }
    case 'date': {
      if (assertion === '否认' || assertion === '计划') return { ok: true, value: null }
      const d = normalizeDateValue(raw) ?? parseDateText(quote, written)
      if (!d) return { ok: false, problem: `日期 ${raw} 不能解析`, gate: '②' }
      return { ok: true, value: { value: d.date, precision: d.precision, s, e, assertion } }
    }
    case 'list': {
      if (assertion === '否认' || assertion === '计划') return { ok: true, value: null }
      const t = String(raw ?? '').trim()
      if (!t) return { ok: false, problem: '空值', gate: '②' }
      const o = field.optionsC.find((x) => x.value === t) ?? bestOption(field, t)
      if (o && !quoteHas(o, quote, field)) return { ok: false, problem: `引语里没有"${o.value}"的写法`, gate: '①' }
      return { ok: true, value: { value: o ? o.value : t.slice(0, 200), s, e, assertion, flags } }
    }
    default: {
      if (assertion === '否认' && field.type !== 'text') return { ok: true, value: null }
      const t = String(raw ?? '').trim()
      if (!t) return { ok: false, problem: '空值', gate: '②' }
      return { ok: true, value: { value: t.slice(0, 200), s, e, assertion } }
    }
  }
}

/**
 * runner: { llm, store: {cacheGet, cachePut, logCall}, onCall }
 * Returns { values, stats: { calls, cached, failed, quoteFail, invalid, discarded:[…] } }
 */
export async function modelExtract(doc, tpl, pending, runner, { signal, role = 'extract' } = {}) {
  const stats = { calls: 0, cached: 0, failed: 0, quoteFail: 0, invalid: 0, problems: [] }
  const out = []
  const fieldIds = pending.fields
  const answered = new Set(); let anyFailed = false
  for (let i = 0; i < fieldIds.length; i += MAX_FIELDS_PER_CALL) {
    const ids = fieldIds.slice(i, i + MAX_FIELDS_PER_CALL)
    const fields = ids.map((id) => tpl.byId.get(id))
    const snipIds = new Set(ids.flatMap((id) => pending.byField[id]))
    const snippets = pending.snippets.filter((s) => snipIds.has(s.id))
    const prompt = buildPrompt(doc, fields, snippets)
    const content = await askCached(runner, prompt, { doc, role, signal }, stats)
    if (content == null) { anyFailed = true; continue }
    const data = extractJson(content)
    const items = Array.isArray(data?.values) ? data.values : Array.isArray(data) ? data : []
    const byId = new Map(snippets.map((s) => [s.id, s]))
    for (const ans of items) {
      const field = tpl.byId.get(ans?.field)
      if (!field || !ids.includes(field.id)) { stats.invalid++; continue }
      const r = validateAnswer(doc, field, ans, byId, doc.written)
      if (!r.ok) {
        if (r.gate === '①') stats.quoteFail++; else stats.invalid++
        if (stats.problems.length < 20) stats.problems.push({ doc: doc.id, field: field.id, problem: r.problem })
        continue
      }
      answered.add(field.id)
      if (r.value) out.push(makeValue(doc, field, { ...r.value, method: 'model', flags: r.value.flags ?? [] }))
    }
    for (const id of ids) answered.add(`considered:${id}`)
  }
  return { values: out, stats, answered, anyFailed }
}

async function askCached(runner, prompt, { doc, role, signal }, stats) {
  const { llm, store } = runner
  const key = sha256(`${llm.model}\u0000${prompt}`)
  const entry = { at: new Date().toISOString(), doc: doc.id, role, model: llm.model }
  const hit = store.cacheGet(key)
  if (hit != null) {
    stats.cached++
    store.logCall({ ...entry, cached: true, ok: true })
    return hit
  }
  stats.calls++
  let content = null
  try {
    const r = await runner.limit(() => llm.chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], { signal, maxTokens: 2000 }))
    content = r.content
    Object.assign(entry, { ms: r.ms, usage: r.usage, ok: true })
  } catch (error) {
    stats.failed++
    Object.assign(entry, { ok: false, error: String(error?.message ?? error) })
  }
  store.logCall(entry)
  if (content != null) store.cachePut(key, llm.model, content)
  runner.onCall?.(entry)
  return content
}

/**
 * Merge rule votes and model values for one document.
 * Fields sent with rule votes ('规则票'): model value agreeing with a rule value (same value, overlapping span) → 'model+rule'.
 * Rule votes the model did not confirm: dropped when the model answered that field; kept (low confidence) when the call failed
 * or the model returned nothing for the field.
 */
export function mergeVotes(ruleValues, modelValues, { answered, anyFailed }) {
  const out = []
  const votes = ruleValues.filter((v) => v.flags.includes('规则票'))
  const plain = ruleValues.filter((v) => !v.flags.includes('规则票'))
  out.push(...plain)
  const used = new Set()
  let agree = 0; let disagree = 0
  for (const mv of modelValues) {
    const hit = votes.find((r) => r.field === mv.field && String(r.value) === String(mv.value) && r.s < mv.e && mv.s < r.e)
    if (hit) { used.add(hit); agree++; out.push({ ...mv, method: 'model+rule', confidence: 'high' }) } else out.push(mv)
  }
  for (const r of votes) {
    if (used.has(r)) continue
    const flags = r.flags.filter((x) => x !== '规则票')
    if (anyFailed) out.push({ ...r, flags: [...flags, '模型失败'], confidence: 'normal' })
    else if (!answered.has(r.field)) out.push({ ...r, flags: [...flags, '模型未确认'], confidence: 'low' })
    else disagree++
  }
  return { values: out, agree, disagree }
}
