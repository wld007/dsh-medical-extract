/**
 * 复判：一份文书、一个字段上两边结论不一致时，让两个模型轮流看对方的答案，对照原文改或坚持。
 *
 *   核验分歧（kind: verify）：每轮先提取模型复判（看核验模型上一轮的答案），再核验模型复判（看提取模型这一轮的答案）。
 *     任一步后两边结论一致 → 采用（值来自提取模型这一轮的回答，标「复判第 N 轮」）；
 *     某一轮两边都没改 → 再跑也一样（温度 0、提示相同），提前交人工；到 maxRounds 还不一致 → 交人工。
 *   规则票不一致（kind: rule）：规则的结果不会变，只让提取模型看规则匹配到的那一处复判 1 轮：
 *     改成和规则一致 → 采用（model+rule）；坚持 → 交人工。
 *
 * 引语照样回原文核对（质检①），模型给的位置不用。每一轮双方的答案、引语和一句话理由都记下，交人工时一并给人看。
 */
import { askCached, fieldBrief, validateAnswer, VALUE_HINT } from './model.js'
import { makeValue } from './extract.js'
import { sectionAt } from '../source/sections.js'
import { extractJson } from '../llm.js'

export const ADJ_SYSTEM = '你是病历信息抽取的复核人。两份答案对同一个字段的结论不一致，你要逐字对照原文判断哪个对。只看原文，不因为对方这么说就改，也不为了坚持而坚持。每个值都必须逐字引用原文。只输出一个 JSON 对象，不要输出其他内容。'

const brief = (vals) => (vals.length ? vals.map((v) => ({ value: v.value, assertion: v.assertion, quote: v.quote })) : '（认为原文没有写这个字段）')

export function buildAdjPrompt(doc, field, ctx, own, other, { otherLabel = '另一位审阅者的答案' } = {}) {
  return `文书类型：${doc.recordType}；写成时间：${doc.written ?? '不详'}
要判断的字段：
${JSON.stringify(fieldBrief(field))}
原文：
<<<
${ctx.text}
>>>
你上一次的答案：
${JSON.stringify(brief(own))}
${otherLabel}：
${JSON.stringify(brief(other))}
要求：
- 两份答案对这个字段的结论不一致。逐字对照原文判断：可以坚持自己的、改成对方的，或者给出新的答案。
- 原文确实没有写这个字段，就输出空的 values。
- value：${VALUE_HINT[field.type] ?? '值'}；assertion：阳性、否认、可疑、既往、家族、计划 之一；quote：从原文中逐字抄出支撑该值的片段（不超过 100 字），必须与原文完全一致。
- reason：一句话说明判断依据（不超过 40 字）。
输出：{"values":[{"value":"…","assertion":"阳性","quote":"…","variant":null}],"reason":"…"}`
}

/** 一次复判调用 → { ok, values, reason } */
async function ask(runner, role, doc, field, ctx, own, other, opts, stats, sectionOk) {
  const prompt = buildAdjPrompt(doc, field, ctx, own, other, opts)
  const content = await askCached(runner, prompt, { doc, role, system: ADJ_SYSTEM, maxTokens: 1500, chars: ctx.text.length }, stats)
  if (content == null) return { ok: false, values: [], reason: '' }
  const data = extractJson(content)
  const items = Array.isArray(data?.values) ? data.values : []
  const byId = new Map([['T', { id: 'T', s: ctx.s, e: ctx.e, text: ctx.text }]])
  const out = []; const seen = new Set()
  for (const ans of items) {
    const r = validateAnswer(doc, field, { ...ans, field: field.id, snippet: 'T' }, byId, doc.written)
    if (!r.ok) { if (r.gate === '①') stats.quoteFail++; else stats.invalid++; continue }
    if (!r.value) continue
    if (sectionOk && !sectionOk(field, sectionAt(doc.sections, r.value.e - 1)?.name)) { stats.invalid++; continue }
    const k = `${r.value.s}|${r.value.e}|${r.value.value}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(makeValue(doc, field, { ...r.value, method: 'model', flags: r.value.flags ?? [] }))
  }
  return { ok: true, values: out, reason: typeof data?.reason === 'string' ? data.reason.slice(0, 80) : '' }
}

/**
 * opts: { doc, field, ctx: {s,e,text}, mine, other, extract: runner, verify: runner|null, kind: 'verify'|'rule',
 *         maxRounds, conclude(field, values) → 结论串, same(field, a, b) → bool, sectionOk }
 * Returns { resolved, round, final, rounds, extractorChanged, stats }
 */
export async function adjudicate({ doc, field, ctx, mine, other, extract, verify = null, kind = 'verify', maxRounds = 3, conclude, same, sectionOk }) {
  const stats = { calls: 0, cached: 0, failed: 0, quoteFail: 0, invalid: 0, perfE: null, perfV: null }
  const sE = { calls: 0, cached: 0, failed: 0, quoteFail: 0, invalid: 0 }; const sV = { calls: 0, cached: 0, failed: 0, quoteFail: 0, invalid: 0 }
  const c = (vals) => conclude(field, vals)
  const first = c(mine)
  let A = mine; let B = other; let lastE = null
  const rounds = []
  let result = { resolved: false, round: 0, final: mine }
  const limit = kind === 'rule' ? 1 : Math.max(1, Math.min(6, maxRounds))
  for (let r = 1; r <= limit; r++) {
    const a2 = await ask(extract, 'adj-extract', doc, field, ctx, A, B, kind === 'rule' ? { otherLabel: '规则匹配到的写法（规则只认固定写法，不一定对）' } : {}, sE, sectionOk)
    const row = { round: r, extract: a2.values.map(slim), extractReason: a2.reason, verify: null, verifyReason: '' }
    rounds.push(row)
    if (!a2.ok) break
    lastE = a2.values
    if (same(field, c(a2.values), c(B))) { result = { resolved: true, round: r, final: a2.values, by: 'extract' }; break }
    if (kind === 'rule' || !verify) { A = a2.values; break }
    const b2 = await ask(verify, 'adj-verify', doc, field, ctx, B, a2.values, {}, sV, sectionOk)
    row.verify = b2.values.map(slim); row.verifyReason = b2.reason
    if (!b2.ok) { A = a2.values; break }
    if (same(field, c(a2.values), c(b2.values))) { result = { resolved: true, round: r, final: a2.values, by: 'verify' }; break }
    const stuck = same(field, c(a2.values), c(A)) && same(field, c(b2.values), c(B))
    A = a2.values; B = b2.values
    if (stuck) break
  }
  if (!result.resolved) result.final = mine
  const extractorFinal = lastE ? c(lastE) : first
  for (const k of ['calls', 'cached', 'failed', 'quoteFail', 'invalid']) stats[k] = sE[k] + sV[k]
  stats.perfE = sE.perf ?? null; stats.perfV = sV.perf ?? null
  return { ...result, rounds, extractorChanged: lastE != null && !same(field, extractorFinal, first), stats }
}

const slim = (v) => ({ field: v.field, value: v.value, assertion: v.assertion, quote: v.quote, s: v.s, e: v.e })
