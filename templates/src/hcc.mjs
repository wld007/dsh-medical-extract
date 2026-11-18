/**
 * 原发性肝癌（以肝细胞癌为主）。
 * 依据：国家卫生健康委《原发性肝癌诊疗指南（2024 年版）》（CNLC 分期）；中国临床肿瘤学会（CSCO）原发性肝癌诊疗指南 2024；
 * BCLC 2022 更新；ACR LI-RADS v2018；mRECIST；慢性乙型肝炎防治指南（2022 年版）。
 * 字段范围参考古脉 G-MPAS「肝癌专病」「慢性肝病专病」数据集目录。
 */
import { HX, ageNow, chief, date, death, derived, drugList, dxList, ecog, enumOf, fhx, hx, icd, lab, lines, listOf, measure, presence, recist, text } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
const PATH = ['所见', '结论', '诊断', '病理诊断', '免疫组化', '正文', '辅助检查', '现病史', '病理']
const HCC = '肝癌|肝细胞癌|肝细胞肝癌|原发性肝癌|肝恶性肿瘤|HCC'
const ROMAN_SUB = (base, sub) => { const full = { I: 'Ⅰ', II: 'Ⅱ', III: 'Ⅲ', IV: 'Ⅳ' }[base]; return [base, full].flatMap((b) => (sub ? [b + sub, b + sub.toUpperCase()] : [b])) }
const CNLC = ['Ia', 'Ib', 'IIa', 'IIb', 'IIIa', 'IIIb', 'IV']
const CNLC_MAP = Object.fromEntries(CNLC.flatMap((st) => { const base = st.replace(/[ab]$/, ''); return ROMAN_SUB(base, st.slice(base.length)).map((k) => [k, st]) }))

export default {
  format: 'extract-template/1',
  id: 'hcc',
  name: '原发性肝癌（HCC）',
  version: '0.1.0',
  domain: '肿瘤',
  description: '肝癌真实世界研究常用字段：病理类型与分级、MVI、CNLC／BCLC 分期、Child-Pugh 与 ALBI、门静脉癌栓与肝外转移、病因（乙肝、丙肝、酒精、脂肪肝）与肝硬化、抗病毒治疗、影像与肿瘤负荷、肝切除／移植／消融／TACE／HAIC、靶向与免疫治疗、mRECIST 疗效、肝病并发症、AFP/PIVKA-II 与肝功能。',
  references: [
    { title: '国家卫生健康委 原发性肝癌诊疗指南（2024 年版）' },
    { title: '中国临床肿瘤学会（CSCO）原发性肝癌诊疗指南 2024（人民卫生出版社）' },
    { title: 'BCLC strategy for prognosis prediction and treatment recommendation: the 2022 update, J Hepatol 2022;76(3)' },
    { title: 'ACR LI-RADS v2018；mRECIST（Lencioni 2010）' },
    { title: '慢性乙型肝炎防治指南（2022 年版），中华传染病杂志 2023;41(1)' },
    { title: '古脉 G-MPAS 数据目录：肝癌专病、慢性肝病专病（字段范围参考）', url: 'https://www.g-mpas.com/data.html' },
  ],
  groups: [
    { id: 'A', name: '诊断与病理' }, { id: 'B', name: '分期与肝功能' }, { id: 'C', name: '病因与背景肝病' }, { id: 'D', name: '影像与肿瘤负荷' },
    { id: 'E', name: '手术与局部治疗' }, { id: 'F', name: '系统治疗' }, { id: 'G', name: '疗效与结局' }, { id: 'K', name: '标志物与检验' },
  ],
  fields: [
    /* A 诊断与病理 */
    dxList('A1', '肝癌相关诊断', 'A', 'P0', '诊断栏写明的肝癌诊断（原文写法）。', `${HCC}|肝内胆管(?:细胞)?癌`, ['肝癌', '肝细胞癌', '原发性肝癌', '肝恶性肿瘤', 'HCC', '肝内胆管癌'], { after: 20 }),
    icd('A1c', 'ICD-10 编码（C22）', 'A', 'P0', '肝和肝内胆管恶性肿瘤编码。', 'C22'),
    enumOf('A2', '病理／临床类型', 'A', 'P0', '肝细胞癌、肝内胆管癌或混合型。', [['肝细胞癌', '肝细胞肝癌', 'HCC'], ['肝内胆管癌', '肝内胆管细胞癌', 'ICC', 'iCCA', '胆管细胞癌'], ['混合型肝癌', '混合型肝细胞-胆管细胞癌', 'cHCC-CCA', '混合细胞型肝癌']], { granularity: 'patient', pick: 'mode', sources: { sections: [...DX, ...PATH] } }),
    enumOf('A3', '诊断依据', 'A', 'P1', '病理确诊或临床（影像＋AFP）诊断。', [['病理诊断', '病理确诊', '穿刺病理', '术后病理', '活检病理'], ['临床诊断', '临床诊断肝癌', '影像学诊断', '快进快出']], { selfTerm: false, granularity: 'patient', pick: 'first' }),
    { id: 'A4', name: 'Edmondson-Steiner 分级', group: 'A', priority: 'P2', type: 'enum', granularity: 'patient', pick: 'last', definition: '肝细胞癌 Edmondson-Steiner I–IV 级。',
      options: [{ value: 'I' }, { value: 'II' }, { value: 'III' }, { value: 'IV' }],
      rules: [{ id: 'es', regex: 'Edmondson(?:-?Steiner)?\\s*(?:分级)?\\s*[:：]?\\s*(?<v>Ⅳ|Ⅲ|Ⅱ|Ⅰ|IV|III|II|I|[1-4])\\s*级?', map: { 'Ⅰ': 'I', 'Ⅱ': 'II', 'Ⅲ': 'III', 'Ⅳ': 'IV', I: 'I', II: 'II', III: 'III', IV: 'IV', 1: 'I', 2: 'II', 3: 'III', 4: 'IV' } }] },
    { id: 'A5', name: '微血管侵犯（MVI）', group: 'A', priority: 'P0', type: 'enum', granularity: 'patient', pick: 'last', definition: 'MVI 病理分级 M0（无）、M1（低危）、M2（高危）。',
      options: [{ value: 'M0' }, { value: 'M1' }, { value: 'M2' }],
      recall: { terms: ['MVI', '微血管侵犯', '微血管癌栓'] },
      rules: [{ id: 'mvi', regex: '(?:MVI|微血管侵犯|微血管癌栓)[^。；\\n]{0,10}?(?<![A-Za-z])(?<v>M[0-2])(?![0-9])' }] },
    date('A6', '确诊时间', 'A', 'P0', '病理或临床确诊肝癌的时间。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', sources: { sections: ['现病史', '既往史', '诊疗经过', '病例特点'] }, recall: { terms: ['确诊', '病理', '穿刺', '发现肝占位', '肝癌'] } }),
    derived('A7', '确诊年龄', 'A', 'P0', '确诊时年龄。', { op: 'ageAt', at: 'A6' }, { granularity: 'patient' }),

    /* B 分期与肝功能 */
    { id: 'B1', name: 'CNLC 分期', group: 'B', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'last', definition: '中国肝癌分期（CNLC）Ia–IV 期（只认与肝癌或 CNLC 写在同一句里的罗马数字分期）。',
      options: CNLC.map((value) => ({ value })),
      recall: { regex: [`CNLC|中国肝癌分期|${HCC}`] },
      rules: [{ id: 'cnlc', regex: `(?:CNLC|中国肝癌分期|${HCC})[^。；\\n]{0,30}?(?<![A-Za-zⅠⅡⅢⅣ])(?<v>(?:Ⅳ|Ⅲ|Ⅱ|Ⅰ|IV|III|II|I)[ABab]?)\\s*期`, map: CNLC_MAP }] },
    { id: 'B2', name: 'BCLC 分期', group: 'B', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'last', definition: '巴塞罗那临床肝癌分期 0、A、B、C、D 期。',
      options: ['0期', 'A期', 'B期', 'C期', 'D期'].map((value) => ({ value })),
      rules: [{ id: 'bclc', regex: 'BCLC\\s*(?:分期)?\\s*[:：]?\\s*(?<v>[0ABCD])\\s*期?', map: { 0: '0期', A: 'A期', B: 'B期', C: 'C期', D: 'D期' } }] },
    { id: 'B3', name: 'Child-Pugh 分级', group: 'B', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'last', definition: 'Child-Pugh A、B、C 级。',
      options: ['A级', 'B级', 'C级'].map((value) => ({ value })),
      rules: [{ id: 'cp', regex: 'Child(?:-?Pugh)?\\s*(?:分级|评分|改良分级)?\\s*[:：]?\\s*(?<v>[ABC])\\s*级?', map: { A: 'A级', B: 'B级', C: 'C级' } }] },
    { id: 'B4', name: 'Child-Pugh 评分', group: 'B', priority: 'P1', type: 'score', scale: 'Child-Pugh', granularity: 'timepoint', range: { min: 5, max: 15 }, definition: 'Child-Pugh 总分（5–15）。',
      rules: [{ id: 'cp-score', regex: 'Child(?:-?Pugh)?\\s*(?:[ABC]\\s*级)?\\s*[（(]?\\s*(?:评分)?\\s*[:：为]?\\s*(?<v>1[0-5]|[5-9])\\s*分' }], recall: { regex: ['Child(?:-?Pugh)?'] } },
    { id: 'B5', name: 'ALBI 分级', group: 'B', priority: 'P2', type: 'enum', granularity: 'encounter', pick: 'last', definition: '白蛋白-胆红素（ALBI）1、2、3 级。',
      options: ['1级', '2级', '3级'].map((value) => ({ value })),
      rules: [{ id: 'albi', regex: 'ALBI\\s*(?:分级)?\\s*[:：]?\\s*(?<v>[1-3]|2a|2b)\\s*级?', map: { 1: '1级', 2: '2级', '2a': '2级', '2b': '2级', 3: '3级' } }] },
    ecog('B6', 'B', 'P0'),
    presence('B7', '门静脉癌栓', 'B', 'P0', '门静脉（主干或分支）癌栓。', ['门静脉癌栓', '门脉癌栓', 'PVTT', '门静脉瘤栓', '门静脉右支癌栓', '门静脉左支癌栓'], { granularity: 'patient', accept: HX }),
    { id: 'B8', name: '门静脉癌栓分型（程氏）', group: 'B', priority: 'P2', type: 'enum', granularity: 'patient', pick: 'last', definition: '程氏分型 I–IV 型（I0 记 I）。',
      options: ['I型', 'II型', 'III型', 'IV型'].map((value) => ({ value })),
      rules: [{ id: 'cheng', regex: '(?:程氏|PVTT|癌栓)[^。；\\n]{0,8}?(?<v>Ⅳ|Ⅲ|Ⅱ|Ⅰ|IV|III|II|I)\\s*0?\\s*型', map: { 'Ⅰ': 'I型', 'Ⅱ': 'II型', 'Ⅲ': 'III型', 'Ⅳ': 'IV型', I: 'I型', II: 'II型', III: 'III型', IV: 'IV型' } }] },
    presence('B9', '肝静脉／下腔静脉癌栓', 'B', 'P2', '肝静脉或下腔静脉癌栓。', ['肝静脉癌栓', '下腔静脉癌栓', 'HVTT', '下腔静脉瘤栓'], { granularity: 'patient', accept: HX }),
    listOf('B10', '肝外转移部位', 'B', 'P0', '肝外转移部位。', [['肺转移', '双肺转移'], ['骨转移'], ['淋巴结转移', '腹腔淋巴结转移', '肝门淋巴结转移', '腹膜后淋巴结转移'], ['肾上腺转移'], ['腹膜转移', '腹膜种植'], ['脑转移']], { granularity: 'patient', accept: HX }),

    /* C 病因与背景肝病 */
    hx('C1', '乙型肝炎', 'C', 'P0', '慢性乙型肝炎或 HBsAg 阳性（含乙肝肝硬化）。', ['乙肝', '乙型肝炎', '慢性乙型病毒性肝炎', 'HBsAg阳性', 'HBsAg（+）', 'HBsAg(+)', '大三阳', '小三阳', '乙肝肝硬化', 'HBV感染']),
    hx('C2', '丙型肝炎', 'C', 'P1', '慢性丙型肝炎或抗-HCV 阳性。', ['丙肝', '丙型肝炎', '丙型病毒性肝炎', '抗-HCV阳性', 'HCV感染', 'HCV抗体阳性']),
    hx('C3', '肝硬化', 'C', 'P0', '肝硬化（代偿或失代偿）。', ['肝硬化', '肝硬变', '肝炎后肝硬化']),
    hx('C4', '酒精性肝病／长期饮酒', 'C', 'P1', '酒精性肝病或长期大量饮酒。', ['酒精性肝病', '酒精性肝硬化', '长期饮酒', '嗜酒', '酗酒', '大量饮酒']),
    hx('C5', '脂肪性肝病（MASLD）', 'C', 'P2', '脂肪肝、NAFLD/MAFLD/MASLD。', ['脂肪肝', '非酒精性脂肪性肝病', 'NAFLD', 'MAFLD', 'MASLD', '代谢相关脂肪性肝病']),
    hx('C6', '糖尿病', 'C', 'P2', '糖尿病。', ['糖尿病']),
    fhx('C7', '肝癌家族史', 'C', 'P1', '亲属肝癌史。', ['肝癌', '肝细胞癌', '肝恶性肿瘤']),
    drugList('C8', '抗病毒药物', 'C', 'P0', '在用的抗 HBV／HCV 药物。', [[['恩替卡韦', '博路定', '润众'], ['富马酸替诺福韦二吡呋酯', '替诺福韦', 'TDF', '韦瑞德'], ['丙酚替诺福韦', 'TAF', '韦立德'], ['艾米替诺福韦', '恒沐'], ['拉米夫定', '贺普丁'], ['阿德福韦酯', '贺维力'], ['替比夫定', '素比伏'], ['聚乙二醇干扰素', '派罗欣', '派格宾'], ['索磷布韦维帕他韦', '丙通沙'], ['格卡瑞韦哌仑他韦', '艾诺全'], ['索磷布韦']]], { accept: HX }),
    text('C9', 'HBV DNA', 'C', 'P1', 'HBV DNA 定量结果原文（如 2.3×10^5 IU/mL、<20 IU/mL、低于检测下限）。', { granularity: 'timepoint', pick: 'all', rules: [{ id: 'hbvdna', regex: 'HBV[-\\s]?DNA[^。；;\\n\\d<＜>低未]{0,8}?(?<v>(?:[<＜>]\\s*)?\\d+(?:\\.\\d+)?\\s*(?:[×xX*]\\s*10\\s*\\^?\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]+|[eE][+]?\\d+)?\\s*(?:IU\\/m[lL]|拷贝\\/m[lL]|copies\\/m[lL])?|低于检测下限|未检出|阴性)' }], recall: { regex: ['HBV[-\\s]?DNA'] } }),
    presence('C10', 'HBsAg 阳性', 'C', 'P2', '检验或病史写明 HBsAg 阳性。', ['HBsAg阳性', 'HBsAg（+）', 'HBsAg(+)', '乙肝表面抗原阳性'], { granularity: 'patient', accept: HX }),

    /* D 影像与肿瘤负荷 */
    enumOf('D1', '肿瘤数目', 'D', 'P1', '肝内肿瘤单发或多发（2–3 个、≥4 个照原文记多发）。', [['单发', '单个', '孤立性', '单发结节', '单个病灶'], ['多发', '多发结节', '多个病灶', '多发病灶']], { granularity: 'encounter', pick: 'last', sources: { sections: [...DX, ...PATH, '影像', '超声', 'CT', 'MRI'] } }),
    measure('D2', '最大肿瘤直径', 'D', 'P0', '(?:最大)?(?:肿瘤|病灶|肿块|占位|结节|瘤体)(?:最大)?(?:直径|大小|径)|最大(?:直)?径', { unit: 'cm', range: { min: 0.1, max: 30 }, value: '\\d{1,2}(?:\\.\\d{1,2})?(?=\\s*(?:cm|CM|厘米))', granularity: 'encounter', pick: 'max', alt: [{ id: 'size-mm', regex: '(?:肿瘤|病灶|肿块|占位|结节)(?:大小|直径)?[^。；;\\n\\d]{0,8}?(?<v>\\d{1,3})\\s*(?:mm|毫米)', factor: 0.1 }] }),
    { id: 'D3', name: 'LI-RADS 分类', group: 'D', priority: 'P2', type: 'enum', granularity: 'encounter', pick: 'last', definition: 'LI-RADS v2018 分类 LR-1～LR-5、LR-M、LR-TIV。',
      options: ['LR-1', 'LR-2', 'LR-3', 'LR-4', 'LR-5', 'LR-M', 'LR-TIV'].map((value) => ({ value })),
      rules: [{ id: 'lirads', regex: '(?:LI-?RADS\\s*[:：]?\\s*(?:LR-?)?|(?<![A-Za-z])LR-?)(?<v>TIV|[1-5M])(?![0-9A-Za-z])', map: { 1: 'LR-1', 2: 'LR-2', 3: 'LR-3', 4: 'LR-4', 5: 'LR-5', M: 'LR-M', TIV: 'LR-TIV' } }] },
    presence('D4', '腹水', 'D', 'P1', '腹水／腹腔积液。', ['腹水', '腹腔积液'], { granularity: 'encounter' }),
    presence('D5', '食管胃底静脉曲张', 'D', 'P2', '胃镜或影像示食管胃底静脉曲张。', ['食管胃底静脉曲张', '食管静脉曲张', '胃底静脉曲张'], { granularity: 'patient', accept: HX }),
    presence('D6', '脾大／脾功能亢进', 'D', 'P2', '脾大或脾功能亢进（门静脉高压征象）。', ['脾大', '脾肿大', '脾功能亢进', '脾亢'], { granularity: 'patient', accept: HX }),

    /* E 手术与局部治疗 */
    enumOf('E1', '肝切除方式', 'E', 'P0', '肝切除术式。', [['解剖性肝切除', '肝叶切除', '半肝切除', '右半肝切除', '左半肝切除', '肝段切除', '解剖性肝段切除'], ['非解剖性肝切除', '局部切除', '肝部分切除', '楔形切除', '肝肿瘤局部切除']], { granularity: 'patient', pick: 'all', accept: HX }),
    presence('E2', '肝移植', 'E', 'P1', '肝移植。', ['肝移植', '肝脏移植', '原位肝移植'], { granularity: 'patient', accept: HX }),
    listOf('E3', '局部治疗', 'E', 'P0', '经动脉治疗、消融、放疗等局部治疗（每次一条）。', [
      ['TACE', '肝动脉化疗栓塞', '经肝动脉化疗栓塞', '肝动脉化疗栓塞术', 'cTACE', 'DEB-TACE', '载药微球'], ['HAIC', '肝动脉灌注化疗', 'FOLFOX-HAIC'], ['TAE', '肝动脉栓塞'],
      ['射频消融', 'RFA'], ['微波消融', 'MWA'], ['冷冻消融'], ['无水酒精注射', 'PEI'], ['SBRT', '立体定向放疗', '立体定向体部放疗'], ['钇-90放射栓塞', 'Y-90', 'SIRT', '放射性栓塞'], ['碘-125粒子植入', '125I粒子', '粒子植入'],
    ], { granularity: 'encounter', accept: HX }),
    measure('E4', 'TACE 次数', 'E', 'P2', 'TACE|介入治疗|化疗栓塞', { unit: '次', range: { min: 1, max: 50 }, gap: 12, value: '\\d{1,2}(?=\\s*次)', granularity: 'patient', pick: 'max', accept: HX }),
    enumOf('E5', '手术入路', 'E', 'P2', '腹腔镜、机器人或开腹。', [['腹腔镜', '腔镜', '腹腔镜下'], ['机器人', '达芬奇'], ['开腹', '开放手术']], { granularity: 'patient', pick: 'all', accept: HX }),

    /* F 系统治疗 */
    drugList('F1', '靶向药物', 'F', 'P0', '小分子 TKI 与抗血管生成单抗。', [[['索拉非尼', '多吉美'], ['仑伐替尼', '乐卫玛'], ['多纳非尼', '泽普生'], ['瑞戈非尼', '拜万戈'], ['阿帕替尼', '艾坦'], ['卡博替尼'], ['雷莫西尤单抗'], ['贝伐珠单抗', '安维汀', '达攸同', '安可达']]], { accept: HX }),
    drugList('F2', '免疫检查点抑制剂', 'F', 'P0', 'PD-1/PD-L1/CTLA-4 抑制剂。', [[['阿替利珠单抗', '泰圣奇', 'T药'], ['卡瑞利珠单抗', '艾瑞卡'], ['信迪利单抗', '达伯舒'], ['替雷利珠单抗', '百泽安'], ['帕博利珠单抗', '可瑞达', 'K药'], ['纳武利尤单抗', '欧狄沃', 'O药'], ['度伐利尤单抗', '英飞凡'], ['曲美木单抗', '替西木单抗'], ['特瑞普利单抗', '拓益'], ['卡度尼利单抗', '开坦尼'], ['伊匹木单抗'], ['斯鲁利单抗']]], { accept: HX }),
    drugList('F3', '系统化疗药物', 'F', 'P1', '系统或 HAIC 化疗药物（肝内胆管癌含吉西他滨、顺铂）。', [[['奥沙利铂', '乐沙定', '艾恒'], ['氟尿嘧啶', '5-FU'], ['亚叶酸钙'], ['卡培他滨', '希罗达'], ['吉西他滨', '健择'], ['顺铂'], ['亚砷酸', '三氧化二砷'], ['替吉奥', 'S-1']]], { accept: HX }),
    enumOf('F4', '治疗阶段', 'F', 'P2', '本次治疗所处阶段。', [['新辅助', '新辅助治疗', '术前治疗'], ['辅助', '术后辅助', '辅助治疗'], ['转化治疗', '转化'], ['晚期系统治疗', '姑息治疗', '一线治疗', '二线治疗']], { selfTerm: false, granularity: 'encounter', pick: 'last' }),
    lines('F5', 'F', 'P1'),

    /* G 疗效与结局 */
    recist('G1', 'G', 'P0', '疗效评价（mRECIST/RECIST）', 'mRECIST|RECIST|疗效|评价|评估|评效'),
    presence('G2', '复发', 'G', 'P0', '根治性治疗后肝内或肝外复发。', ['复发', '肝内复发', '新发病灶', '新发结节', '新发灶', '复发灶'], { granularity: 'encounter' }),
    date('G3', '复发时间', 'G', 'P1', '首次确认复发的时间。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', recall: { terms: ['复发', '新发病灶', '新发结节'] } }),
    presence('G4', '疾病进展', 'G', 'P1', '影像或临床确认的进展。', ['疾病进展', '病情进展', '进展'], { granularity: 'encounter' }),
    listOf('G5', '肝病并发症', 'G', 'P0', '肝功能失代偿与门静脉高压并发症。', [['肝功能衰竭', '肝衰竭', '肝功能失代偿'], ['肝性脑病'], ['静脉曲张破裂出血', '食管胃底静脉曲张破裂出血', '上消化道出血'], ['肝肾综合征'], ['自发性细菌性腹膜炎', 'SBP'], ['肿瘤破裂出血', '肝癌破裂出血', '肝癌破裂']], { granularity: 'encounter' }),
    listOf('G6', '治疗不良反应', 'G', 'P1', '记录的治疗不良反应。', [['手足皮肤反应', '手足综合征'], ['高血压'], ['蛋白尿'], ['腹泻'], ['乏力'], ['甲状腺功能减退', '甲减'], ['免疫相关性肝炎', '免疫性肝炎'], ['免疫相关性肺炎', '免疫性肺炎'], ['栓塞后综合征', '发热'], ['肝功能损害', '转氨酶升高', '胆红素升高'], ['反应性毛细血管增生症', 'RCCEP']], { granularity: 'encounter', model: 'always', recall: { terms: ['不良反应', '毒副反应', '手足', '蛋白尿', '腹泻', '甲减', '免疫相关', '栓塞后', '转氨酶升高', '毛细血管增生'] } }),
    death('G7', 'G', 'P0', 'patient'),
    ageNow('G8', 'G', 'P0'),
    chief('G9', 'G', 'P1'),

    /* K 标志物与检验 */
    measure('K1', 'AFP', 'K', 'P0', 'AFP(?!-?L3)|甲胎蛋白(?!异质体)', { unit: 'ng/mL', range: { min: 0, max: 1000000 } }),
    measure('K2', 'AFP-L3%', 'K', 'P2', 'AFP-?L3|甲胎蛋白异质体', { unit: '%', range: { min: 0, max: 100 }, value: '\\d{1,3}(?:\\.\\d+)?(?=\\s*%)' }),
    measure('K3', 'PIVKA-II（DCP）', 'K', 'P0', 'PIVKA-?(?:Ⅱ|II|2)|DCP|异常凝血酶原|维生素K缺乏或拮抗剂-?Ⅱ诱导的蛋白质', { unit: 'mAU/mL', range: { min: 0, max: 1000000 } }),
    lab('K4', 'tbil', 'K', 'P0'),
    lab('K5', 'alb', 'K', 'P0'),
    lab('K6', 'alt', 'K', 'P1'),
    lab('K7', 'ast', 'K', 'P1'),
    lab('K8', 'inr', 'K', 'P1'),
    lab('K9', 'plt', 'K', 'P1'),
    lab('K10', 'cea', 'K', 'P2'),
    measure('K11', 'CA19-9', 'K', 'P2', 'CA\\s*-?19-?9|糖类抗原\\s*19-?9', { unit: 'U/mL', range: { min: 0, max: 100000 } }),
  ],
}
