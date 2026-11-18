/**
 * 写模板用的小工具（只在 templates/src 里用，不进插件运行时）。
 * 生成的都是 extract-template/1 的字段对象，见 docs/template.md。
 */
/** 名称两侧不能紧挨字母数字（PTH 不匹配 PTHlRen…，Ca 不匹配 CaO） */
export const bounded = (head) => `(?<![A-Za-z0-9])(?:${head})(?![A-Za-z])`
/** 单字检验项目（钙、磷、钾、钠）：前后不能是汉字，"碳酸钙""血钾正常"里的不算项目名 */
export const lone = (ch) => `(?<![\\u4e00-\\u9fff])${ch}(?![\\u4e00-\\u9fff])`

export const NUM = '[\\d一二两三四五六七八九十]+'
export const DUR = '[\\d一二两三四五六七八九十半]+\\s*个?\\s*(?:年|月|周|星期|天|日|小时|h)\\s*(?:余|多|左右|许)?'
export const DX_SECTIONS = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
export const HX = ['阳性', '既往']

/** 选项对象：没有写法时不带 terms（与 Excel 导入一致） */
const option = (value, terms) => (terms.length ? { value, terms } : { value })

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
  return { id, name, group, priority, type: 'enum', definition, options: opts.map(([value, ...terms]) => option(value, selfTerm ? [value, ...terms] : terms)), ...rest }
}

/** 多值列表（如药物）：opts = [[通用名, 商品名或别名…]] */
export function listOf(id, name, group, priority, definition, opts, extra = {}) {
  return { id, name, group, priority, type: 'list', definition, options: opts.map(([value, ...terms]) => option(value, [value, ...terms])), ...extra }
}

/**
 * 数值（检验、测量、评分）：head 为名称的正则写法；取其后 24 字内的第一个数。
 * extra.factor：数值换算系数（如分数写法 0.35 → 35%）；extra.alt：额外规则。
 */
export function measure(id, name, group, priority, head, { unit = null, range = null, granularity = 'timepoint', definition, pick, gap = 24, alt = [], value = '\\d+(?:\\.\\d+)?', ...rest } = {}) {
  return {
    id, name, group, priority, type: 'number', granularity, ...(unit ? { unit } : {}), ...(range ? { range } : {}), ...(pick ? { pick } : {}),
    definition: definition ?? `${name}${unit ? `（${unit}）` : ''}的测定值，每次测定一条。`,
    rules: [{ id: `${id.toLowerCase()}-v`, regex: `${bounded(head)}[^。；;\\n\\d]{0,${gap}}?(?<v>${value})` }, ...alt],
    recall: { regex: [bounded(head)] },
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

/* ---- 各模板共用的写法（后加的模板用；早先的模板保持原样） ---- */

const SEP = '[^\\n，,。；;：:]'
/** 诊断栏写明的诊断名称（原文写法）：core 为病名正则 */
export function dxList(id, name, group, priority, definition, core, terms, { before = 14, after = 16 } = {}) {
  return { id, name, group, priority, type: 'list', granularity: 'encounter', definition, sources: { sections: DX_SECTIONS }, rules: [{ id: 'dx', regex: `(?<v>${SEP}{0,${before}}(?:${core})${SEP}{0,${after}})` }], recall: { terms } }
}
/** ICD-10 编码：code 为编码主体正则（如 I1[0-5]） */
export function icd(id, name, group, priority, definition, code) {
  const re = `(?<![A-Za-z0-9])(?:${code})(?:\\.\\d{1,3})?(?![0-9A-Za-z])`
  return { id, name, group, priority, type: 'list', granularity: 'encounter', definition, rules: [{ id: 'icd', regex: re.replace('(?:', '(?<v>(?:').replace('(?![0-9A-Za-z])', ')(?![0-9A-Za-z])') }], recall: { regex: [re] } }
}
/** 病史类（有／无，病人级，既往也算） */
export const hx = (id, name, group, priority, definition, terms, extra = {}) => presence(id, name, group, priority, definition, terms, { accept: HX, granularity: 'patient', ...extra })
/** 家族史（只认亲属） */
export const fhx = (id, name, group, priority, definition, terms, extra = {}) => presence(id, name, group, priority, definition, terms, { accept: ['家族'], granularity: 'patient', ...extra })
export const chief = (id, group, priority = 'P1') => text(id, '主诉', group, priority, '本次就诊主诉原文。', { granularity: 'encounter', pick: 'first', sources: { sections: ['主诉'] }, rules: [{ id: 'chief', regex: '(?<v>[^\\n]{2,100})' }], recall: { regex: ['[^\\s]{2,}'] } })
export const ageNow = (id, group, priority = 'P0', name = '就诊年龄') => derived(id, name, group, priority, '本次就诊时年龄。', { op: 'ageAt', at: '$encounter.start' }, { granularity: 'encounter' })
export const death = (id, group, priority = 'P0', granularity = 'encounter') => presence(id, granularity === 'encounter' ? '院内死亡' : '死亡', group, priority, granularity === 'encounter' ? '住院期间死亡。' : '记录的死亡。', ['死亡', '临床死亡', '宣告死亡', '抢救无效'], { granularity, sources: { sections: ['出院情况', '诊疗经过', '病程记录', '正文'] } })
export const los = (id, group, priority = 'P1') => measure(id, '住院天数', group, priority, '住院(?:天数|日数)|共住院', { unit: '天', range: { min: 0, max: 365 }, granularity: 'encounter', pick: 'last', alt: [{ id: 'los-b', regex: '住院(?<v>\\d{1,3})\\s*天' }] })
export const smoking = (id, group, priority = 'P1') => hx(id, '吸烟', group, priority, '吸烟（含已戒）。', ['吸烟', '抽烟'])
export const drinking = (id, group, priority = 'P2') => hx(id, '饮酒', group, priority, '饮酒（含已戒）。', ['饮酒', '喝酒', '酗酒'])
export const ecog = (id, group, priority = 'P0') => scale(id, 'ECOG PS', group, priority, 'ECOG(?:\\s*PS)?|PS评分|体能状态评分', { min: 0, max: 5 })

const BP = '(?:BP|血压)\\s*[:：]?'
/** 收缩压／舒张压：取"血压 150/90mmHg"里的前后两个数 */
export const sbp = (id, group, priority = 'P1', name = '收缩压') => measure(id, name, group, priority, BP, { unit: 'mmHg', range: { min: 50, max: 300 }, value: '\\d{2,3}(?=\\s*/\\s*\\d{2,3})', definition: '血压记录中的收缩压（每次测量一条）。' })
export const dbp = (id, group, priority = 'P1', name = '舒张压') => ({
  id, name, group, priority, type: 'number', granularity: 'timepoint', unit: 'mmHg', range: { min: 20, max: 200 },
  definition: '血压记录中的舒张压（每次测量一条）。',
  rules: [{ id: `${id.toLowerCase()}-v`, regex: `${bounded(BP)}[^。；;\\n\\d]{0,24}?\\d{2,3}\\s*/\\s*(?<v>\\d{2,3})` }],
  recall: { regex: [bounded(BP)] },
})
export const hr = (id, group, priority = 'P1') => measure(id, '心率', group, priority, '心率|HR|脉搏', { unit: '次/分', range: { min: 20, max: 300 }, value: '\\d{2,3}(?=\\s*次)' })

/** 常用检验（数值，时间点级） */
export const LAB = {
  ldl: ['LDL-C', 'LDL-C|LDL|低密度脂蛋白(?:胆固醇)?', { unit: 'mmol/L', range: { min: 0.1, max: 15 } }],
  tc: ['总胆固醇', 'TC|总胆固醇|血清总胆固醇', { unit: 'mmol/L', range: { min: 0.5, max: 25 } }],
  tg: ['甘油三酯', 'TG|甘油三酯|三酰甘油', { unit: 'mmol/L', range: { min: 0.1, max: 60 } }],
  hba1c: ['糖化血红蛋白', 'HbA1c|HBA1C|糖化血红蛋白', { unit: '%', range: { min: 3, max: 20 } }],
  fpg: ['空腹血糖', '空腹血糖|FPG|FBG|空腹葡萄糖', { unit: 'mmol/L', range: { min: 1, max: 40 } }],
  scr: ['肌酐', '(?<!尿)肌酐|Scr|SCr|Cr(?![a-z])', { unit: 'μmol/L', range: { min: 10, max: 2500 } }],
  egfr: ['eGFR', 'eGFR|估算肾小球滤过率|肾小球滤过率', { unit: 'mL/min/1.73m²', range: { min: 1, max: 200 } }],
  k: ['血钾', '血钾|血清钾|' + lone('钾'), { unit: 'mmol/L', range: { min: 1.5, max: 9 }, value: '\\d\\.\\d{1,2}' }],
  ua: ['尿酸', '(?<!尿)尿酸|UA(?![a-zA-Z])', { unit: 'μmol/L', range: { min: 50, max: 1500 } }],
  hb: ['血红蛋白', '(?<!平均红细胞|红细胞平均|糖化|平均|碳氧|游离|高铁)血红蛋白(?!浓度)|Hb(?!A)|HGB', { unit: 'g/L', range: { min: 20, max: 250 } }],
  plt: ['血小板', 'PLT|血小板(?:计数)?', { unit: '×10⁹/L', range: { min: 1, max: 2000 } }],
  alb: ['白蛋白', '(?<!尿|前|微量)白蛋白(?![\\/与]|肌酐)|ALB', { unit: 'g/L', range: { min: 5, max: 70 } }],
  alt: ['ALT', 'ALT|丙氨酸(?:氨基)?转移酶|谷丙转氨酶', { unit: 'U/L', range: { min: 1, max: 10000 } }],
  ast: ['AST', 'AST|天(?:门)?冬氨酸(?:氨基)?转移酶|谷草转氨酶', { unit: 'U/L', range: { min: 1, max: 10000 } }],
  tbil: ['总胆红素', 'TBIL|TBil|T-BIL|总胆红素', { unit: 'μmol/L', range: { min: 1, max: 1000 } }],
  inr: ['INR', 'INR|国际标准化比值', { unit: null, range: { min: 0.5, max: 15 } }],
  ntprobnp: ['NT-proBNP', 'NT-?pro-?BNP|N末端(?:B型)?(?:利钠肽|脑钠肽)前体|氨基末端脑钠肽前体', { unit: 'pg/mL', range: { min: 5, max: 70000 } }],
  lvef: ['LVEF', '(?:LVEF|左室射血分数|左心室射血分数|射血分数|EF值?)', { unit: '%', range: { min: 5, max: 85 }, value: '\\d{1,2}(?:\\.\\d)?(?=\\s*%)' }],
  crp: ['C 反应蛋白', 'hs-?CRP|CRP|C\\s*-?反应蛋白|超敏C反应蛋白', { unit: 'mg/L', range: { min: 0, max: 500 } }],
  cea: ['CEA', 'CEA|癌胚抗原', { unit: 'ng/mL', range: { min: 0, max: 10000 } }],
  tsh: ['TSH', 'TSH|促甲状腺(?:激)?素', { unit: 'mIU/L', range: { min: 0, max: 200 } }],
  bmi: ['体重指数（BMI）', 'BMI|体重指数', { unit: 'kg/m²', range: { min: 10, max: 70 } }],
}
export const lab = (id, key, group, priority, extra = {}) => { const [name, head, opts] = LAB[key]; return measure(id, extra.name ?? name, group, priority, head, { ...opts, ...extra }) }

/**
 * 分期（罗马数字＋亚期）：stages 为规范值（如 IIIA）；原文全角／半角罗马数字、亚期大小写都映射到规范值。
 * anchor 为病名正则：只认与病名写在同一句里的分期。
 */
export function stageField(id, name, group, priority, definition, stages, anchor, extra = {}) {
  const map = Object.fromEntries(stages.flatMap((st) => {
    const base = st.replace(/[ABCabc]$/, ''); const sub = st.slice(base.length)
    const full = { 0: '0', I: 'Ⅰ', II: 'Ⅱ', III: 'Ⅲ', IV: 'Ⅳ' }[base]
    return [base, full].flatMap((b) => (sub ? [sub.toUpperCase(), sub.toLowerCase()] : ['']).map((x) => [b + x, st]))
  }))
  return {
    id, name, group, priority, type: 'enum', granularity: 'encounter', pick: 'last', definition,
    options: stages.map((value) => ({ value })),
    recall: { regex: [anchor] },
    rules: [{ id: 'stage', regex: `(?:${anchor})[^。；\\n]{0,40}?(?<![A-Za-zⅠⅡⅢⅣ0-9])(?<v>(?:Ⅳ|Ⅲ|Ⅱ|Ⅰ|IV|III|II|I|0)[ABCabc]?)[123]?\\s*期`, map }],
    ...extra,
  }
}
/** 原文 TNM（如 cT2aN1M0、ypT0N0、T4bN2bM1c） */
export const tnmText = (id, group, priority = 'P0', example = 'cT2N1M0、pT1cN0M0') => ({
  id, name: 'TNM 分期（原文）', group, priority, type: 'text', granularity: 'encounter', pick: 'last', definition: `写明的 TNM（如 ${example}），原文。`,
  rules: [{ id: 'tnm', regex: '(?<v>(?:yp|yc|[cpy])?T(?:is|[0-4x])[abcd]?\\s*N[0-3x][abc]?\\s*M[01x][abc]?[12]?)' }],
  recall: { regex: ['(?:yp|yc|[cpy])?T(?:is|[0-4x])[abcd]?\\s*N[0-3x]'] },
})
/** 罗马数字分级映射（Ⅰ/I/1 → I），用于 NYHA、Killip、EHRA 等 */
export const ROMAN = { 'Ⅰ': 'I', 'Ⅱ': 'II', 'Ⅲ': 'III', 'Ⅳ': 'IV', I: 'I', II: 'II', III: 'III', IV: 'IV', 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }
export const ROMAN_RE = 'Ⅳ|Ⅲ|Ⅱ|Ⅰ|IV|III|II|I|[1-4]'
/** RECIST 疗效（CR/PR/SD/PD 只在"疗效／评价…"后面认，避免 PD-1） */
export const recist = (id, group, priority = 'P0', name = '疗效评价（RECIST）', lead = '疗效|评价|评估|评效') => enumOf(id, name, group, priority, 'RECIST 1.1（或 mRECIST）疗效：CR、PR、SD、PD。', [['CR', '完全缓解'], ['PR', '部分缓解'], ['SD', '疾病稳定', '病情稳定'], ['PD', '疾病进展', '病情进展']], { selfTerm: false, granularity: 'timepoint', rules: [{ id: 'recist', regex: `(?:${lead})[^。；\\n]{0,8}?(?<v>CR|PR|SD|PD)(?![-A-Za-z0-9])` }] })
export const lines = (id, group, priority = 'P1') => enumOf(id, '治疗线数', group, priority, '当前系统治疗线数。', [['一线', '1线', '一线治疗'], ['二线', '2线', '二线治疗'], ['三线', '3线', '三线及以上', '后线']], { granularity: 'encounter', pick: 'last' })
export const cycles = (id, group, priority = 'P1') => measure(id, '化疗周期数', group, priority, '(?:化疗|治疗|免疫治疗)', { unit: '周期', range: { min: 1, max: 60 }, gap: 12, value: '\\d{1,2}(?=\\s*(?:个)?(?:周期|疗程|程))', granularity: 'encounter', pick: 'max' })

/** 常用药物清单（通用名在前，商品名、别名在后） */
export const DRUGS = {
  antiplatelet: [['阿司匹林', '拜阿司匹灵'], ['氯吡格雷', '波立维', '泰嘉'], ['替格瑞洛', '倍林达'], ['普拉格雷'], ['西洛他唑'], ['吲哚布芬']],
  anticoag: [['华法林'], ['达比加群', '泰毕全'], ['利伐沙班', '拜瑞妥'], ['阿哌沙班', '艾乐妥'], ['艾多沙班'], ['低分子肝素', '依诺肝素', '那屈肝素', '达肝素', '克赛', '速碧林'], ['磺达肝癸钠']],
  statin: [['阿托伐他汀', '立普妥', '阿乐'], ['瑞舒伐他汀', '可定'], ['辛伐他汀'], ['普伐他汀'], ['匹伐他汀'], ['氟伐他汀'], ['洛伐他汀']],
  acei: [['依那普利'], ['贝那普利', '洛汀新'], ['培哚普利', '雅施达'], ['雷米普利'], ['福辛普利', '蒙诺'], ['卡托普利'], ['赖诺普利'], ['咪达普利']],
  arb: [['沙库巴曲缬沙坦', '诺欣妥', 'ARNI'], ['缬沙坦', '代文'], ['氯沙坦', '科素亚'], ['厄贝沙坦', '安博维'], ['坎地沙坦'], ['替米沙坦', '美卡素'], ['奥美沙坦'], ['阿利沙坦', '信立坦'], ['阿齐沙坦']],
  bb: [['美托洛尔', '倍他乐克', '琥珀酸美托洛尔', '酒石酸美托洛尔'], ['比索洛尔', '康忻', '博苏'], ['卡维地洛', '络德'], ['阿替洛尔'], ['奈必洛尔'], ['阿罗洛尔'], ['拉贝洛尔'], ['普萘洛尔', '心得安'], ['艾司洛尔']],
  ccb: [['氨氯地平', '络活喜', '苯磺酸氨氯地平'], ['左旋氨氯地平', '施慧达'], ['硝苯地平', '拜新同', '硝苯地平控释片'], ['非洛地平', '波依定'], ['贝尼地平'], ['拉西地平'], ['乐卡地平'], ['西尼地平'], ['尼群地平'], ['地尔硫䓬', '合贝爽'], ['维拉帕米']],
  diuretic: [['氢氯噻嗪'], ['吲达帕胺', '纳催离'], ['氯噻酮'], ['呋塞米', '速尿'], ['托拉塞米'], ['布美他尼'], ['螺内酯', '安体舒通'], ['依普利酮'], ['阿米洛利'], ['氨苯蝶啶'], ['托伐普坦', '苏麦卡']],
  sglt2: [['达格列净', '安达唐'], ['恩格列净', '欧唐静'], ['卡格列净'], ['恒格列净']],
}
export const drugList = (id, name, group, priority, definition, keys, extra = {}) => listOf(id, name, group, priority, definition, [].concat(...keys.map((k) => (typeof k === 'string' ? DRUGS[k] : k))), { granularity: 'encounter', ...extra })
