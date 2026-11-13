/**
 * 栏目切分：在文书正文里找"主诉：""现病史："这类标题，切成 [{name, s, e}]（s/e 为正文偏移，
 * 含标题之后到下一个标题之前的内容）。找不到任何标题时整篇是一个栏目"正文"。
 *
 * 通用标题表覆盖入院记录、门诊病历、出院记录、病程记录、检查报告的常见写法；数据源可以追加。
 */

export const HEADERS = [
  ['主诉', '主\\s*诉'], ['现病史', '现\\s*病\\s*史'], ['既往史', '既\\s*往\\s*史'], ['个人史', '个\\s*人\\s*史'],
  ['婚育史', '婚育史|婚姻史|生育史'], ['月经史', '月经史'], ['家族史', '家\\s*族\\s*史'], ['过敏史', '过敏史'],
  ['体格检查', '体\\s*格\\s*检\\s*查|查\\s*体'], ['精神检查', '精神检查|精神状况检查|精神状态检查|精神科检查|精神专科检查'],
  ['专科检查', '专科检查|专科情况|补充及专科情况'], ['神经系统检查', '神经系统检查'], ['辅助检查', '辅助检查'],
  ['量表评估', '量表评估|心理测评|心理评估|量表测评|评估量表'],
  ['初步诊断', '初步诊断|入院诊断|门诊诊断|拟诊'], ['出院诊断', '出院诊断|最后诊断|修正诊断|补充诊断'], ['诊断', '诊\\s*断'],
  ['诊疗经过', '诊疗经过|治疗经过|住院经过|诊治经过'], ['入院情况', '入院情况'], ['出院情况', '出院情况|出院时情况'],
  ['出院医嘱', '出院医嘱|出院带药|出院建议'], ['处理意见', '处理意见|处\\s*理|治疗计划|诊疗计划|医嘱'],
  ['病程记录', '病程记录|首次病程记录|日常病程记录|查房记录'], ['病例特点', '病例特点'], ['鉴别诊断', '鉴别诊断'],
  ['检查项目', '检查项目'], ['所见', '检查所见|所见|影像所见'], ['结论', '检查结论|结论|诊断意见|印象'],
]

/** 标题出现在行首（允许序号、空白），后接冒号；或独占一行。 */
function headerRegex(headers) {
  const alt = headers.map(([, re]) => `(?:${re})`).join('|')
  return new RegExp(`(?:^|\\n)[ \\t　]*(?:[一二三四五六七八九十\\d]+[、.．)]\\s*)?(${alt})[ \\t　]*(?:[:：]|(?=\\n))`, 'g')
}

const CACHE = new WeakMap()
function compiled(headers) {
  let c = CACHE.get(headers)
  if (!c) {
    const names = headers.map(([name, re]) => [name, new RegExp(`^(?:${re})$`)])
    c = { re: headerRegex(headers), names }
    CACHE.set(headers, c)
  }
  return c
}

export function splitSections(text, headers = HEADERS) {
  const { re, names } = compiled(headers)
  re.lastIndex = 0
  const hits = []
  let m
  while ((m = re.exec(text))) {
    const raw = m[1].replace(/\s+/g, '')
    const name = names.find(([, r]) => r.test(raw))?.[0] ?? raw
    hits.push({ name, s: m.index + m[0].length, h: m.index + (m[0].startsWith('\n') ? 1 : 0) })
  }
  if (!hits.length) return [{ name: '正文', s: 0, e: text.length }]
  const out = []
  if (hits[0].h > 0 && text.slice(0, hits[0].h).trim()) out.push({ name: '正文', s: 0, e: hits[0].h })
  hits.forEach((x, i) => out.push({ name: x.name, s: x.s, e: i + 1 < hits.length ? hits[i + 1].h : text.length }))
  return out
}

/** Section containing offset (or null). */
export function sectionAt(sections, offset) {
  for (const s of sections) if (offset >= s.s && offset < s.e) return s
  return sections.at(-1)?.e === offset ? sections.at(-1) : null
}

/**
 * 把多个字段拼成一篇：`标题：内容\n`，返回 { text, sections }。
 * parts: [[栏目名, 内容]]，空内容跳过。
 */
export function joinFields(parts, sep = '\n') {
  let text = ''; const sections = []
  for (const [name, value] of parts) {
    if (value == null || !String(value).trim()) continue
    const head = `${name}：`
    const s = text.length + head.length
    text += head + String(value)
    sections.push({ name, s, e: text.length })
    text += sep
  }
  return { text, sections }
}
