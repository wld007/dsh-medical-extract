/**
 * 文书判定的兜底规则：格式识别定不了类别时（待确认、没开格式识别、区域平台导出里不认识的表），
 * 按表判断是不是"文书"（叙述性病历文本），不逐行判断——同一张表里的行性质相同，按表判断在千万级也几乎不花成本。
 *
 * 一行算"叙述"：它最长的一个取值至少 15 个汉字，并且带句读（，。；！？）。
 * 一张表算文书：抽样的非空行里至少 30% 是叙述。
 * 检验、医嘱、处方、收费、诊断这类结构化表，每个取值都是短词（项目名、药名、数值），过不了这条线。
 */
const CJK = /[\u4e00-\u9fff]/g
const PUNCT = /[，。；！？,;]/

export function isNarrativeValue(v) {
  if (typeof v !== 'string') return false
  return (v.match(CJK)?.length ?? 0) >= 15 && PUNCT.test(v)
}

/** rows: 抽样的行（对象）；cols: 只看这些列（省略＝全部列） */
export function isNarrativeTable(rows, cols = null) {
  let n = 0; let yes = 0
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const vals = (cols ?? Object.keys(r)).map((k) => r[k]).filter((v) => typeof v === 'string' && v.trim())
    if (!vals.length) continue
    n++
    if (vals.some(isNarrativeValue)) yes++
  }
  return n > 0 && yes / n >= 0.3
}
