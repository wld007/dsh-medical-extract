/**
 * 断言（docs/template.md §4）：命中所在分句里的语境——否认、可疑、家族、既往、计划。
 *
 * 只看命中所在分句（以 。；;！!？?\n 切）在命中之前的部分（否认词作用域会被"出现、伴、诉……"截断），
 * 再看命中之后紧跟的几个字（（-）、阴性、史）。模板可追加词（lexicon），不能删通用词。
 */

const BASE = {
  negation: ['否认', '没有', '未见', '未诉', '未述', '未闻', '未发现', '未出现', '未再', '不伴', '并无', '并未', '排除', '无', '未'],
  // 否认词在这些写法里不是否认（"无明显诱因下"、"未能入睡"）
  pseudoNegation: ['无明显诱因', '无诱因', '无明显原因', '无明确诱因', '无特殊诱因', '未能', '未予', '未经', '未规律', '未系统', '未行', '未曾就诊', '无法', '无力', '无助', '无望', '无用', '无价值', '无意义', '无精打采', '无兴趣', '无聊', '无故', '无缘无故', '未婚', '无业', '无殊'],
  // 否认作用域在这些词处结束
  scopeBreak: ['的', '，', ',', '出现', '开始', '感到', '自觉', '自感', '诉', '表现为', '表现出', '伴有', '伴', '但', '然', '仍有', '仍', '可见', '查见', '渐出现', '后', '继而', '并有', '且有', '有时', '时有', '经常'],
  negationAfter: ['（-）', '(-)', '（－）', '阴性', '已否认'],
  uncertain: ['疑似', '可疑', '待排', '不除外', '不排除', '可能', '疑为', '待查'],
  uncertainAfter: ['？', '?', '待排', '可能'],
  // 亲属称谓后面要跟"有、患、曾……"才算在说亲属（"被家人发现""拖累家人""表现为"都不是）
  relatives: ['父亲', '母亲', '父母', '父', '母', '哥哥', '姐姐', '弟弟', '妹妹', '兄', '弟', '姐', '妹', '儿子', '女儿', '祖父', '祖母', '外祖父', '外祖母', '爷爷', '奶奶', '外公', '外婆',
    '舅舅', '舅', '姨妈', '阿姨', '姨', '叔叔', '叔', '伯父', '伯', '姑姑', '姑', '堂兄', '堂姐', '堂弟', '堂妹', '表哥', '表姐', '表弟', '表妹', '家人', '亲属', '一级亲属', '二级亲属', '同胞'],
  relativeVerb: ['患有', '曾患', '亦有', '也有', '诊断为', '诊断', '有', '患', '曾', '因', '亦', '也', '：', ':'],
  family: ['家族中', '家族内', '家族史', '家系中'],
  history: ['既往', '曾经', '曾', '以往', '多年前', '年轻时', '幼时', '过去', '早年', '前次', '上次发作'],
  historyAfter: ['史', '病史'],
  plan: ['拟', '计划', '建议', '必要时', '如有', '如出现', '若有', '若出现', '若', '警惕', '预防', '宣教', '告知', '注意观察', '注意休息', '注意安全', '防止', '避免', '嘱'],
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const anyOf = (list) => new RegExp(`(?:${[...new Set(list)].sort((a, b) => b.length - a.length).map(esc).join('|')})`, 'g')

export function buildLexicon(extra = {}) {
  const L = {}
  for (const k of Object.keys(BASE)) L[k] = [...BASE[k], ...(extra[k] ?? [])]
  return {
    negation: anyOf(L.negation), pseudo: anyOf(L.pseudoNegation), scopeBreak: anyOf(L.scopeBreak),
    negationAfter: L.negationAfter, uncertain: anyOf(L.uncertain), uncertainAfter: L.uncertainAfter,
    family: anyOf(L.family),
    relative: new RegExp(`(?:${[...new Set(L.relatives)].sort((a, b) => b.length - a.length).map(esc).join('|')})\\s*(?:${[...new Set(L.relativeVerb)].sort((a, b) => b.length - a.length).map(esc).join('|')})`, 'g'),
    history: anyOf(L.history), historyAfter: L.historyAfter, plan: anyOf(L.plan),
  }
}

const CLAUSE_END = /[。；;！!？?\n]/

/** Clause bounds around [s, e) in text. */
export function clauseAt(text, s, e) {
  let a = s
  while (a > 0 && !CLAUSE_END.test(text[a - 1])) a--
  let b = e
  while (b < text.length && !CLAUSE_END.test(text[b])) b++
  return [a, b]
}

function lastMatch(re, str) {
  re.lastIndex = 0
  let m; let last = null
  while ((m = re.exec(str))) { last = m; if (m[0] === '') re.lastIndex++ }
  return last
}

/** Remove pseudo-negation phrases (replaced by same-length filler so offsets stay put). */
function maskPseudo(lex, str) {
  lex.pseudo.lastIndex = 0
  return str.replace(lex.pseudo, (m) => '＿'.repeat(m.length))
}

/**
 * Assess one hit. Returns { assertion, flags: {neg, uncertain, family, history, plan} }.
 * section: section name containing the hit (家族史/既往史 imply context).
 */
export function assess(text, s, e, sectionName, lex, lo = 0) {
  let [a, b] = clauseAt(text, s, e)
  a = Math.max(a, Math.min(lo, s)) // never look back into the section header
  const before = maskPseudo(lex, text.slice(a, s))
  const after = text.slice(e, Math.min(b + 1, e + 6))
  const flags = { neg: false, uncertain: false, family: false, history: false, plan: false }

  // 否认：最后一个否认词之后没有作用域截断词
  const n = lastMatch(lex.negation, before)
  if (n) {
    const tail = before.slice(n.index + n[0].length)
    lex.scopeBreak.lastIndex = 0
    if (!lex.scopeBreak.test(tail) && !/[，,、]\s*(?:有|伴)/.test(tail)) flags.neg = true
  }
  if (lex.negationAfter.some((w) => after.startsWith(w) || after.replace(/^\s+/, '').startsWith(w))) flags.neg = true

  lex.uncertain.lastIndex = 0
  if (lex.uncertain.test(before) || lex.uncertainAfter.some((w) => after.startsWith(w))) flags.uncertain = true
  lex.family.lastIndex = 0
  lex.relative.lastIndex = 0
  if (/家族史/.test(sectionName ?? '') || lex.family.test(before) || lex.relative.test(before)) flags.family = true
  lex.history.lastIndex = 0
  if (/既往史|过去史/.test(sectionName ?? '') || lex.history.test(before) || lex.historyAfter.some((w) => after.startsWith(w))) flags.history = true
  lex.plan.lastIndex = 0
  if (lex.plan.test(before)) flags.plan = true

  // 优先级：否认 ＞ 家族 ＞ 可疑 ＞ 计划 ＞ 既往 ＞ 阳性
  const assertion = flags.neg ? '否认' : flags.family ? '家族' : flags.uncertain ? '可疑' : flags.plan ? '计划' : flags.history ? '既往' : '阳性'
  return { assertion, flags }
}

/** Context of a hit (ignoring negation): 家族 ＞ 计划 ＞ 既往 ＞ 可疑 ＞ 阳性. */
export function contextOf(flags) {
  return flags.family ? '家族' : flags.plan ? '计划' : flags.history ? '既往' : flags.uncertain ? '可疑' : '阳性'
}
/** Non-presence types: is this hit's context one the field accepts? (可疑 counts when 阳性 is accepted) */
export function acceptsContext(flags, accept) {
  const c = contextOf(flags)
  return accept.has(c) || (c === '可疑' && accept.has('阳性'))
}
export const flagsOf = (assertion) => ({ neg: assertion === '否认', family: assertion === '家族', history: assertion === '既往', plan: assertion === '计划', uncertain: assertion === '可疑' })

/**
 * Map an assessed hit to a presence value under a field's `accept` set.
 * Returns '有' | '无' | '可疑' | null (null = not about this field's subject/time; drop).
 */
export function presenceValue(flags, accept) {
  const familyField = accept.has('家族') && !accept.has('阳性')
  if (flags.family && !familyField) return null
  if (!flags.family && familyField) return null
  if (flags.plan && !accept.has('计划')) return null
  if (flags.history && !accept.has('既往') && !familyField) return null
  if (flags.neg) return '无'
  if (flags.uncertain) return '可疑'
  return '有'
}
