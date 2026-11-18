/**
 * 慢性乙型肝炎与肝硬化。
 * 依据：慢性乙型肝炎防治指南（2022 年版）；肝硬化诊治指南（2019）；肝硬化门静脉高压食管胃静脉曲张出血的防治指南（2022）；
 * 肝硬化腹水诊疗指南（2023）；EASL 2017 HBV 指南。2022 版中国指南扩大抗病毒指征：HBV DNA 阳性且 ALT 持续异常、
 * 或有肝硬化、或年龄 >30 岁、或有肝癌／肝硬化家族史等均建议治疗；一线药物恩替卡韦、TDF、TAF、TMF，或聚乙二醇干扰素。
 * 字段范围参考古脉 G-MPAS「慢性肝病专病」数据集目录。
 */
import { HX, ageNow, chief, date, death, derived, drugList, dxList, enumOf, fhx, hx, icd, lab, listOf, measure, presence, scale, text, drinking } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
const POS_NEG = { '+': '阳性', '＋': '阳性', '-': '阴性', '－': '阴性', 阳性: '阳性', 阴性: '阴性' }
/** 乙肝血清学标志物：标记后紧跟（+）／（-）／阳性／阴性 */
const serology = (id, name, mark, priority, extra = {}) => ({
  id, name, group: 'B', priority, type: 'enum', granularity: 'timepoint', pick: 'last', definition: `${name}（阳性／阴性）。`,
  options: [{ value: '阳性' }, { value: '阴性' }],
  rules: [{ id: `${id.toLowerCase()}-sign`, regex: `(?:${mark})\\s*[:：]?\\s*[（(]?\\s*(?<v>[+＋]|[-－]|阳性|阴性)`, map: POS_NEG }],
  ...extra,
})

export default {
  format: 'extract-template/1',
  id: 'chb',
  name: '慢性乙型肝炎与肝硬化（CHB）',
  version: '0.1.0',
  domain: '消化',
  description: '慢性乙肝与肝硬化研究常用字段：诊断与自然史分期、乙肝五项与 HBV DNA、ALT／AST、肝纤维化无创评估（LSM、APRI、FIB-4）、肝硬化代偿状态与 Child-Pugh／MELD、门静脉高压与并发症（腹水、静脉曲张出血、肝性脑病、SBP、肝肾综合征）、抗病毒治疗与应答、耐药、合并 HCV/HDV/HIV、脂肪肝与饮酒、肝癌监测与家族史。',
  references: [
    { title: '慢性乙型肝炎防治指南（2022 年版），中华肝脏病杂志 2022;30(12)' },
    { title: '肝硬化诊治指南（2019），中华肝脏病杂志 2019;27(11)' },
    { title: '肝硬化门静脉高压食管胃静脉曲张出血的防治指南（2022），中华内科杂志 2023;62(1)' },
    { title: '肝硬化腹水诊疗指南（2023 年版），中华肝脏病杂志 2023;31(8)' },
    { title: 'EASL 2017 Clinical Practice Guidelines on the management of hepatitis B virus infection' },
    { title: '古脉 G-MPAS 数据目录：慢性肝病专病（字段范围参考）', url: 'https://www.g-mpas.com/data.html' },
  ],
  groups: [
    { id: 'A', name: '诊断与分期' }, { id: 'B', name: '病毒学与血清学' }, { id: 'C', name: '肝功能与纤维化' }, { id: 'D', name: '肝硬化与并发症' },
    { id: 'E', name: '抗病毒治疗' }, { id: 'F', name: '合并因素与肝癌监测' }, { id: 'K', name: '其他检验' },
  ],
  fields: [
    /* A 诊断与分期 */
    dxList('A1', '乙肝／肝硬化相关诊断', 'A', 'P0', '诊断栏写明的乙肝、肝硬化及并发症诊断（原文写法）。', '乙型|乙肝|HBV|肝硬化|肝硬变|肝纤维化|肝衰竭', ['乙型肝炎', '乙肝', '慢性乙型病毒性肝炎', '乙肝肝硬化', '肝硬化', 'HBV', '肝衰竭']),
    icd('A1c', 'ICD-10 编码（B18.0–B18.1/K74/K70.3）', 'A', 'P0', '慢性乙肝与肝硬化编码。', 'B18\\.[01]|K74|K70\\.3|B19\\.1'),
    enumOf('A2', '自然史分期', 'A', 'P0', '2022 中国指南：HBeAg 阳性／阴性慢性 HBV 感染（免疫耐受期／非活动期）、HBeAg 阳性／阴性慢性乙型肝炎（免疫清除期／再活动期）、不确定期。', [
      ['HBeAg阳性慢性HBV感染', '免疫耐受期', 'HBeAg阳性慢性乙型肝炎病毒感染'], ['HBeAg阳性慢性乙型肝炎', '免疫清除期', 'HBeAg阳性CHB', '免疫活动期'],
      ['HBeAg阴性慢性HBV感染', '非活动期', '免疫控制期', '非活动性HBsAg携带', '非活动性携带者'], ['HBeAg阴性慢性乙型肝炎', '再活动期', 'HBeAg阴性CHB'], ['不确定期', '灰区'],
    ], { granularity: 'encounter', pick: 'last' }),
    enumOf('A3', '肝硬化状态', 'A', 'P0', '无肝硬化、代偿期或失代偿期肝硬化。', [['失代偿期肝硬化', '失代偿期', '肝硬化失代偿', '失代偿性肝硬化'], ['代偿期肝硬化', '肝硬化代偿期']], { selfTerm: false, granularity: 'encounter', pick: 'last', recall: { terms: ['肝硬化', '代偿期', '失代偿'] } }),
    presence('A4', '肝衰竭', 'A', 'P1', '急性、亚急性、慢加急性（ACLF）或慢性肝衰竭。', ['肝衰竭', '慢加急性肝衰竭', 'ACLF', '肝功能衰竭'], { granularity: 'encounter' }),
    date('A5', '发现乙肝时间', 'A', 'P1', '首次发现 HBsAg 阳性或诊断乙肝的时间；"发现乙肝20年"取 20 年前。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', sources: { sections: ['主诉', '现病史', '既往史'] }, recall: { terms: ['乙肝', 'HBsAg', '乙型肝炎', '大三阳', '小三阳'] } }),
    derived('A6', '感染病程（月）', 'A', 'P2', '发现乙肝至本次就诊的月数。', { op: 'monthsBetween', from: 'A5', to: '$encounter.start' }, { granularity: 'encounter' }),
    enumOf('A7', '传播途径', 'A', 'P2', '可能的传播途径。', [['母婴传播', '母婴垂直传播', '垂直传播'], ['血液传播', '输血', '血制品'], ['性传播'], ['不详', '途径不详']], { selfTerm: false, granularity: 'patient', pick: 'first' }),

    /* B 病毒学与血清学 */
    serology('B1', 'HBsAg', 'HBsAg|乙肝表面抗原|乙型肝炎表面抗原', 'P0'),
    measure('B2', 'HBsAg 定量', 'B', 'P1', 'HBsAg\\s*(?:定量)?', { unit: 'IU/mL', range: { min: 0, max: 1000000 }, gap: 10, value: '\\d+(?:\\.\\d+)?(?=\\s*IU\\/m[lL])' }),
    serology('B3', 'HBeAg', 'HBeAg|乙肝e抗原|乙型肝炎e抗原', 'P0'),
    serology('B4', '抗-HBe', '抗-?HBe|HBeAb|乙肝e抗体', 'P2'),
    serology('B5', '抗-HBc', '抗-?HBc|HBcAb|乙肝核心抗体', 'P2'),
    serology('B6', '抗-HBs', '抗-?HBs|HBsAb|乙肝表面抗体', 'P2'),
    text('B7', 'HBV DNA', 'B', 'P0', 'HBV DNA 定量结果原文（如 2.3×10^5 IU/mL、<20 IU/mL、低于检测下限）。', { granularity: 'timepoint', pick: 'all', rules: [{ id: 'hbvdna', regex: 'HBV[-\\s]?DNA[^。；;\\n\\d<＜>低未]{0,8}?(?<v>(?:[<＜>]\\s*)?\\d+(?:\\.\\d+)?\\s*(?:[×xX*]\\s*10\\s*\\^?\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]+|[eE][+]?\\d+)?\\s*(?:IU\\/m[lL]|拷贝\\/m[lL]|copies\\/m[lL])?|低于检测下限|未检出|阴性)' }], recall: { regex: ['HBV[-\\s]?DNA'] } }),
    enumOf('B8', 'HBV DNA 是否可测', 'B', 'P0', 'HBV DNA 阳性（可测到）或阴性（低于检测下限）。', [['阳性', 'HBV DNA阳性', 'HBV-DNA阳性', 'HBV DNA可测'], ['阴性', 'HBV DNA阴性', 'HBV-DNA阴性', 'HBV DNA低于检测下限', 'HBV DNA未检出', 'HBV-DNA低于检测下限', 'HBV DNA<20', 'HBV-DNA<20']], { selfTerm: false, granularity: 'timepoint', pick: 'last' }),
    hx('B9', 'HBeAg 血清学转换', 'B', 'P2', 'HBeAg 消失并出现抗-HBe。', ['e抗原血清学转换', 'HBeAg血清学转换', 'HBeAg血清转换', 'e系统转换']),
    hx('B10', 'HBsAg 消失（临床治愈）', 'B', 'P1', 'HBsAg 消失、功能性治愈。', ['HBsAg消失', 'HBsAg转阴', '表面抗原转阴', '功能性治愈', '临床治愈', 'HBsAg清除']),
    enumOf('B11', 'HBV 基因型', 'B', 'P2', 'HBV 基因型。', [['B型'], ['C型'], ['D型'], ['其他']], { selfTerm: false, granularity: 'patient', pick: 'last', rules: [{ id: 'genotype', regex: '(?:HBV)?\\s*基因型\\s*[:：为]?\\s*(?<v>[A-H])\\s*型?', map: { B: 'B型', C: 'C型', D: 'D型', A: '其他', E: '其他', F: '其他', G: '其他', H: '其他' } }] }),

    /* C 肝功能与纤维化 */
    lab('C1', 'alt', 'C', 'P0'),
    lab('C2', 'ast', 'C', 'P0'),
    lab('C3', 'tbil', 'C', 'P0'),
    lab('C4', 'alb', 'C', 'P0'),
    measure('C5', 'GGT', 'C', 'P2', 'GGT|γ-?GT|谷氨酰转(?:肽|移)酶', { unit: 'U/L', range: { min: 1, max: 5000 } }),
    measure('C6', '肝脏硬度（LSM）', 'C', 'P0', 'LSM|E值|肝脏?硬度(?:值|测定)?|FibroScan|弹性(?:测定|值)|硬度值', { unit: 'kPa', range: { min: 1, max: 80 }, value: '\\d{1,2}(?:\\.\\d{1,2})?(?=\\s*(?:kPa|KPa|kpa))' }),
    measure('C7', 'CAP（受控衰减参数）', 'C', 'P2', 'CAP|受控衰减参数', { unit: 'dB/m', range: { min: 100, max: 400 }, value: '\\d{3}' }),
    scale('C8', 'APRI', 'C', 'P2', 'APRI', { min: 0, max: 20 }),
    scale('C9', 'FIB-4', 'C', 'P1', 'FIB-?4', { min: 0, max: 30 }),
    enumOf('C10', '肝纤维化分期（病理）', 'C', 'P1', '肝穿病理纤维化分期（Metavir F0–F4 或 Scheuer S0–S4）。', ['F0', 'F1', 'F2', 'F3', 'F4'].map((v) => [v]), { selfTerm: false, granularity: 'patient', pick: 'last', rules: [{ id: 'fib', regex: '(?:Metavir|纤维化|Scheuer|G\\d\\s*)[^。；\\n]{0,6}?(?<![A-Za-z])(?<v>[FS][0-4])(?![0-9])', map: { F0: 'F0', F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', S0: 'F0', S1: 'F1', S2: 'F2', S3: 'F3', S4: 'F4' } }] }),

    /* D 肝硬化与并发症 */
    { id: 'D1', name: 'Child-Pugh 分级', group: 'D', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'last', definition: 'Child-Pugh A、B、C 级。', options: ['A级', 'B级', 'C级'].map((value) => ({ value })),
      rules: [{ id: 'cp', regex: 'Child(?:-?Pugh)?\\s*(?:分级|评分|改良分级)?\\s*[:：]?\\s*(?<v>[ABC])\\s*级?', map: { A: 'A级', B: 'B级', C: 'C级' } }] },
    scale('D2', 'MELD 评分', 'D', 'P1', 'MELD(?:-?Na)?', { min: 6, max: 40 }),
    presence('D3', '腹水', 'D', 'P0', '腹水／腹腔积液。', ['腹水', '腹腔积液'], { granularity: 'encounter' }),
    presence('D4', '食管胃底静脉曲张', 'D', 'P0', '胃镜或影像示食管胃底静脉曲张。', ['食管胃底静脉曲张', '食管静脉曲张', '胃底静脉曲张', '静脉曲张'], { granularity: 'patient', accept: HX }),
    presence('D5', '静脉曲张破裂出血', 'D', 'P0', '食管胃底静脉曲张破裂出血或上消化道出血。', ['静脉曲张破裂出血', '食管胃底静脉曲张破裂出血', '上消化道出血', '呕血', '黑便'], { granularity: 'encounter' }),
    presence('D6', '肝性脑病', 'D', 'P0', '肝性脑病（含轻微型）。', ['肝性脑病', '肝昏迷', '血氨升高伴意识障碍'], { granularity: 'encounter' }),
    presence('D7', '自发性细菌性腹膜炎', 'D', 'P1', '自发性细菌性腹膜炎（SBP）。', ['自发性细菌性腹膜炎', 'SBP', '腹腔感染'], { granularity: 'encounter' }),
    presence('D8', '肝肾综合征', 'D', 'P1', '肝肾综合征（HRS-AKI）。', ['肝肾综合征', 'HRS', 'HRS-AKI'], { granularity: 'encounter' }),
    presence('D9', '脾大／脾功能亢进', 'D', 'P2', '脾大或脾功能亢进。', ['脾大', '脾肿大', '脾功能亢进', '脾亢'], { granularity: 'patient', accept: HX }),
    presence('D10', '门静脉血栓', 'D', 'P2', '门静脉血栓（非癌栓）。', ['门静脉血栓', '门脉血栓', 'PVT'], { granularity: 'patient', accept: HX }),
    listOf('D11', '门静脉高压治疗', 'D', 'P1', '静脉曲张与门静脉高压治疗（每次一条）。', [['内镜下套扎', 'EVL', '套扎术'], ['内镜下组织胶注射', '组织胶注射', '硬化剂注射', 'EIS'], ['TIPS', '经颈静脉肝内门体分流'], ['非选择性β受体阻滞剂', '普萘洛尔', '卡维地洛'], ['脾切除', '断流术', '脾切除断流']], { granularity: 'encounter', accept: HX }),
    drugList('D12', '腹水与肝性脑病用药', 'D', 'P2', '利尿剂、白蛋白、特利加压素、乳果糖等。', [[['螺内酯', '安体舒通'], ['呋塞米', '速尿'], ['托伐普坦', '苏麦卡'], ['人血白蛋白', '人血清白蛋白'], ['特利加压素', '可利新'], ['乳果糖', '杜密克'], ['利福昔明'], ['门冬氨酸鸟氨酸', '雅博司']]]),
    presence('D13', '肝移植', 'D', 'P2', '肝移植或列入等待。', ['肝移植', '原位肝移植'], { granularity: 'patient', accept: ['阳性', '既往', '计划'] }),
    death('D14', 'D', 'P1', 'patient'),

    /* E 抗病毒治疗 */
    drugList('E1', '核苷（酸）类似物', 'E', 'P0', '在用或用过的核苷（酸）类似物。', [[['恩替卡韦', '博路定', '润众', 'ETV'], ['富马酸替诺福韦二吡呋酯', '替诺福韦酯', 'TDF', '韦瑞德'], ['丙酚替诺福韦', 'TAF', '韦立德'], ['艾米替诺福韦', 'TMF', '恒沐'], ['拉米夫定', '贺普丁', 'LAM'], ['阿德福韦酯', '贺维力', 'ADV'], ['替比夫定', '素比伏', 'LdT']]], { accept: HX }),
    drugList('E2', '干扰素', 'E', 'P0', '聚乙二醇干扰素或普通干扰素。', [[['聚乙二醇干扰素α-2a', '派罗欣', '聚乙二醇干扰素', 'PEG-IFN'], ['聚乙二醇干扰素α-2b', '派格宾'], ['普通干扰素', '干扰素α']]], { accept: HX }),
    date('E3', '抗病毒治疗开始时间', 'E', 'P1', '首次开始抗病毒治疗的时间。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', recall: { terms: ['抗病毒', '恩替卡韦', '替诺福韦', '干扰素', '拉米夫定', '阿德福韦'] } }),
    derived('E4', '抗病毒疗程（月）', 'E', 'P2', '开始抗病毒至本次就诊的月数。', { op: 'monthsBetween', from: 'E3', to: '$encounter.start' }, { granularity: 'encounter' }),
    enumOf('E5', '病毒学应答', 'E', 'P0', '抗病毒治疗病毒学应答（医生写明）。', [['完全应答', '病毒学应答', '完全病毒学应答', 'HBV DNA持续阴性'], ['部分应答', '部分病毒学应答'], ['低病毒血症', '低水平病毒血症', 'LLV'], ['原发性无应答', '无应答'], ['病毒学突破', '病毒学反弹']], { selfTerm: false, granularity: 'encounter', pick: 'last' }),
    hx('E6', '耐药', 'E', 'P1', '核苷（酸）类似物耐药或耐药突变。', ['耐药', 'YMDD变异', 'rtM204', 'rtA181', '耐药突变', '耐药位点']),
    presence('E7', '停药或自行停药', 'E', 'P1', '抗病毒治疗停药（含自行停药）。', ['停药', '自行停药', '停用恩替卡韦', '停用替诺福韦', '中断治疗'], { granularity: 'encounter' }),

    /* F 合并因素与肝癌监测 */
    hx('F1', '丙肝／丁肝合并感染', 'F', 'P1', '合并 HCV 或 HDV 感染。', ['丙肝', '丙型肝炎', 'HCV', '丁肝', '丁型肝炎', 'HDV']),
    hx('F2', 'HIV 合并感染', 'F', 'P2', '合并 HIV 感染。', ['HIV', '艾滋病', '人类免疫缺陷病毒']),
    hx('F3', '脂肪性肝病', 'F', 'P1', '脂肪肝、MAFLD/MASLD。', ['脂肪肝', 'MAFLD', 'MASLD', 'NAFLD', '代谢相关脂肪性肝病']),
    drinking('F4', 'F', 'P0'),
    hx('F5', '糖尿病', 'F', 'P2', '糖尿病。', ['糖尿病']),
    fhx('F6', '肝癌或肝硬化家族史', 'F', 'P0', '一级亲属肝癌或肝硬化。', ['肝癌', '肝硬化', '肝细胞癌']),
    fhx('F7', '乙肝家族史', 'F', 'P1', '母亲或家族中乙肝感染。', ['乙肝', '乙型肝炎', 'HBsAg阳性', '乙肝病毒携带']),
    hx('F8', '肝细胞癌', 'F', 'P0', '已诊断肝细胞癌。', ['肝细胞癌', '原发性肝癌', 'HCC']),
    measure('F9', 'AFP', 'F', 'P0', 'AFP(?!-?L3)|甲胎蛋白(?!异质体)', { unit: 'ng/mL', range: { min: 0, max: 1000000 } }),
    measure('F10', 'PIVKA-II', 'F', 'P2', 'PIVKA-?(?:Ⅱ|II|2)|DCP|异常凝血酶原', { unit: 'mAU/mL', range: { min: 0, max: 1000000 } }),
    presence('F11', '肝占位／结节', 'F', 'P1', '影像示肝内占位或结节。', ['肝占位', '肝内占位', '肝内结节', '肝脏占位', '肝内低密度灶', '肝内实性结节'], { granularity: 'encounter' }),
    presence('F12', '免疫抑制／化疗', 'F', 'P2', '正在或计划接受化疗、免疫抑制剂治疗（HBV 再激活风险）。', ['化疗', '免疫抑制剂', '利妥昔单抗', '糖皮质激素治疗', '生物制剂'], { granularity: 'encounter', accept: ['阳性', '计划'] }),

    /* K 其他检验 */
    lab('K1', 'plt', 'K', 'P0'),
    lab('K2', 'inr', 'K', 'P0'),
    measure('K3', '凝血酶原时间', 'K', 'P2', 'PT(?![A-Za-z])|凝血酶原时间', { unit: 's', range: { min: 5, max: 150 } }),
    measure('K4', '血氨', 'K', 'P2', '血氨|NH3', { unit: 'μmol/L', range: { min: 1, max: 500 } }),
    lab('K5', 'scr', 'K', 'P1'),
    measure('K6', '血钠', 'K', 'P2', '血钠|血清钠|(?<![\\u4e00-\\u9fff])钠(?![\\u4e00-\\u9fff])', { unit: 'mmol/L', range: { min: 100, max: 180 }, value: '1\\d{2}(?:\\.\\d+)?' }),
    lab('K7', 'hb', 'K', 'P2'),
    ageNow('K8', 'K', 'P0'),
    chief('K9', 'K', 'P1'),
  ],
}
