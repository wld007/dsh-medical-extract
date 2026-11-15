/**
 * 分派：决定每份文书要提取哪些字段，并切成提取任务（文书或其中一段 × 一组字段）。不看关键词。
 *
 *   字段派给文书：模板接受这类文书；字段没限定文书类型或限定里有它；字段限定了栏目时文书里有这样的栏目；
 *                 派生字段不读原文；model: never 的字段只走规则。
 *   分段：文书不超过 maxChars 就整份一段；更长的按栏目边界切，单个栏目太长再按句末切。
 *   分组：字段按模板顺序每 maxFields 个一组。限定了栏目的字段只进含这些栏目的段。
 *
 * 编号稳定：任务＝文书编号＋段起止＋字段组。
 */
import { sectionAt } from '../source/sections.js'

const SENT_END = /[。！？!?\n]/

export const sectionOk = (field, name) => !field.sections || field.sections.some((x) => (name ?? '').includes(x))

/** 这份文书要提取的字段（交给模型的） */
export function fieldsFor(doc, tpl) {
  if (!tpl.acceptsDocument(doc)) return []
  const names = (doc.sections ?? []).map((x) => x.name)
  return tpl.fields.filter((f) => f.type !== 'derived' && f.model !== 'never'
    && (!f.recordTypes || f.recordTypes.includes(doc.recordType))
    && (!f.sections || names.some((n) => sectionOk(f, n))))
}

/** 文书切段：[{ s, e }]，每段 ≤ maxChars（单句超长时按 maxChars 硬切） */
export function segmentsOf(doc, maxChars = 6000) {
  const text = doc.text
  if (text.length <= maxChars) return [{ s: 0, e: text.length }]
  // 候选切点：栏目起点，其次句末
  const cuts = new Set([0, text.length])
  for (const x of doc.sections ?? []) { const h = text.lastIndexOf('\n', x.s); cuts.add(h >= 0 ? h + 1 : x.s) }
  const sorted = [...cuts].sort((a, b) => a - b)
  const segs = []
  let a = 0
  while (a < text.length) {
    let b = Math.min(text.length, a + maxChars)
    if (b < text.length) {
      const sec = sorted.filter((c) => c > a && c <= b).pop()
      if (sec && sec - a >= maxChars / 3) b = sec
      else {
        let k = b
        while (k > a + maxChars / 3 && !SENT_END.test(text[k - 1])) k--
        if (k > a + maxChars / 3) b = k
      }
    }
    segs.push({ s: a, e: b })
    a = b
  }
  return segs
}

/**
 * 一份文书 → 提取任务 [{ id, s, e, text, fields:[field] }]
 * opts: { maxChars, maxFields }
 */
export function tasksFor(doc, tpl, { maxChars = 6000, maxFields = 30 } = {}) {
  const fields = fieldsFor(doc, tpl)
  if (!fields.length) return []
  const out = []
  for (const seg of segmentsOf(doc, maxChars)) {
    const secNames = new Set()
    for (const x of doc.sections ?? []) if (x.s < seg.e && x.e > seg.s) secNames.add(x.name)
    if (!secNames.size) secNames.add(sectionAt(doc.sections, seg.s)?.name ?? null)
    const here = fields.filter((f) => !f.sections || [...secNames].some((n) => sectionOk(f, n)))
    for (let i = 0; i < here.length; i += maxFields) {
      const group = here.slice(i, i + maxFields)
      out.push({ id: `${doc.id}:${seg.s}-${seg.e}:${i / maxFields}`, s: seg.s, e: seg.e, text: doc.text.slice(seg.s, seg.e), fields: group })
    }
  }
  return out
}
