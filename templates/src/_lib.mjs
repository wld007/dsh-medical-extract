/**
 * 写模板用的小工具（只在 templates/src 里用，不进插件运行时）。
 * 生成的都是 extract-template/1 的字段对象，见 docs/template.md。
 */
export const NUM = '[\\d一二两三四五六七八九十]+'
export const DUR = '[\\d一二两三四五六七八九十半]+\\s*个?\\s*(?:年|月|周|星期|天|日|小时|h)\\s*(?:余|多|左右|许)?'
export const DX_SECTIONS = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
export const HX = ['阳性', '既往']

/** 有／无／可疑 */
export function presence(id, name, group, priority, definition, terms, extra = {}) {
  const { regex, ...rest } = extra
  return { id, name, group, priority, type: 'presence', definition, recall: { terms, ...(regex ? { regex } : {}) }, ...rest }
}

/**
 * 选项：opts = [[规范值, 写法…]]。规范值默认也当写法；值是"阳性""3""PD"这类到处都有的短词时，
 * 传 extra.selfTerm = false，只用后面列出的写法（或规则）取值，避免误召回。
 */
export function enumOf(id, name, group, priority, definition, opts, extra = {}) {
  const { selfTerm = true, ...rest } = extra
  return { id, name, group, priority, type: 'enum', definition, options: opts.map(([value, ...terms]) => ({ value, terms: selfTerm ? [value, ...terms] : terms })), ...rest }
}

/** 多值列表（如药物）：opts = [[通用名, 商品名或别名…]] */
export function listOf(id, name, group, priority, definition, opts, extra = {}) {
  return { id, name, group, priority, type: 'list', definition, options: opts.map(([value, ...terms]) => ({ value, terms: [value, ...terms] })), ...extra }
}

/**
 * 数值（检验、测量、评分）：head 为名称的正则写法；取其后 24 字内的第一个数。
 * extra.factor：数值换算系数（如分数写法 0.35 → 35%）；extra.alt：额外规则。
 */
export function measure(id, name, group, priority, head, { unit = null, range = null, granularity = 'timepoint', definition, pick, gap = 24, alt = [], value = '\\d+(?:\\.\\d+)?', ...rest } = {}) {
  return {
    id, name, group, priority, type: 'number', granularity, unit, ...(range ? { range } : {}), ...(pick ? { pick } : {}),
    definition: definition ?? `${name}${unit ? `（${unit}）` : ''}的测定值，每次测定一条。`,
    rules: [{ id: `${id.toLowerCase()}-v`, regex: `(?:${head})[^。；;\\n\\d]{0,${gap}}?(?<v>${value})` }, ...alt],
    recall: { regex: [head] },
    ...rest,
  }
}

/** 量表总分 */
export function scale(id, name, group, priority, head, range, extra = {}) {
  return {
    id, name, group, priority, type: 'score', scale: name, granularity: 'timepoint', range,
    definition: `${name}总分（每次评定一条）。只取写明的总分，不取条目分、不取参考范围。`,
    rules: [{ id: `${id.toLowerCase()}-total`, regex: `(?:${head})\\s*(?:量表)?\\s*(?:评分|总分|得分|评定|测评|分值|评估)?\\s*(?:结果)?\\s*[:：为是]?\\s*(?<v>\\d{1,3}(?:\\.\\d)?)\\s*分?` }],
    recall: { regex: [head] },
    ...extra,
  }
}

export function date(id, name, group, priority, definition, extra = {}) {
  return { id, name, group, priority, type: 'date', definition, ...extra }
}

export const text = (id, name, group, priority, definition, extra = {}) => ({ id, name, group, priority, type: 'text', definition, ...extra })
export const derived = (id, name, group, priority, definition, derive, extra = {}) => ({ id, name, group, priority, type: 'derived', definition, derive, ...extra })
