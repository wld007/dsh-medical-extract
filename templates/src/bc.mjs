/**
 * 乳腺癌。
 * 依据：中国临床肿瘤学会（CSCO）乳腺癌诊疗指南 2024；中国抗癌协会乳腺癌诊治指南与规范（2024 年版）；
 * 国家卫生健康委《乳腺癌诊疗指南（2022 年版）》；AJCC 第 8 版分期；ASCO/CAP ER/PR（2020）与 HER2（2023）检测指南；
 * RECIST 1.1；CTCAE v5.0。ER/PR ≥1% 为阳性（1%–10% 为低表达）；HER2 IHC 3+ 或 2+ 且 ISH 扩增为阳性，IHC 1+ 或 2+/ISH 阴性为低表达。
 * 字段范围参考古脉 G-MPAS「乳腺癌专病」数据集目录。
 */
import { HX, ageNow, chief, cycles, date, death, derived, drugList, dxList, ecog, enumOf, fhx, icd, lab, lines, listOf, measure, presence, recist, scale, stageField, tnmText } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
const PATH = ['所见', '结论', '诊断', '病理诊断', '免疫组化', '正文', '辅助检查', '现病史', '病理']
const SIGN_MAP = { '+': '阳性', '++': '阳性', '+++': '阳性', '＋': '阳性', '＋＋': '阳性', '＋＋＋': '阳性', '-': '阴性', '－': '阴性', 阳性: '阳性', 阴性: '阴性' }
/** ER/PR 状态：只认标记后紧跟的 +/-/阳性/阴性（"疗效评价PR"不算） */
const receptor = (id, name, mark, priority) => ({
  id, name, group: 'C', priority, type: 'enum', granularity: 'patient', pick: 'last', definition: `${name}（≥1% 阳性；1%–10% 为低表达，仍记阳性）。`,
  options: [{ value: '阳性' }, { value: '阴性' }],
  rules: [{ id: `${id.toLowerCase()}-sign`, regex: `(?<![A-Za-z])(?:${mark})\\s*[:：]?\\s*[（(]?\\s*(?<v>\\+{1,3}|＋{1,3}|-|－|阳性|阴性)`, map: SIGN_MAP }],
})
const pct = (id, name, mark, priority) => measure(id, name, 'C', priority, `(?<![A-Za-z])(?:${mark})`, { unit: '%', range: { min: 0, max: 100 }, gap: 14, value: '\\d{1,3}(?=\\s*%)', granularity: 'patient', pick: 'last' })
const HER2 = '(?:HER-?2|Her-?2|C-?erbB-?2|CerbB-?2)'
const STAGES = ['0', 'IA', 'IB', 'IIA', 'IIB', 'IIIA', 'IIIB', 'IIIC', 'IV']

export default {
  format: 'extract-template/1',
  id: 'bc',
  name: '乳腺癌（BC）',
  version: '0.1.0',
  domain: '肿瘤',
  description: '乳腺癌真实世界研究常用字段：组织学类型与分级、TNM 与分期、ER/PR/HER2/Ki-67 与分子分型、BRCA、手术与腋窝处理、新辅助与 pCR、化疗／抗 HER2／内分泌／CDK4/6 抑制剂／ADC、放疗、疗效与复发转移、心脏毒性、家族史与月经状态、肿瘤标志物。',
  references: [
    { title: '中国临床肿瘤学会（CSCO）乳腺癌诊疗指南 2024（人民卫生出版社）' },
    { title: '中国抗癌协会乳腺癌诊治指南与规范（2024 年版），中国癌症杂志 2023;33(12)' },
    { title: '国家卫生健康委 乳腺癌诊疗指南（2022 年版）' },
    { title: 'ASCO/CAP Guideline Update: Testing for ER and PgR (2020); HER2 Testing in Breast Cancer (2023)' },
    { title: 'AJCC Cancer Staging Manual 8th ed.; RECIST 1.1; CTCAE v5.0' },
    { title: '古脉 G-MPAS 数据目录：乳腺癌专病（字段范围参考）', url: 'https://www.g-mpas.com/data.html' },
  ],
  groups: [
    { id: 'A', name: '诊断与病理' }, { id: 'B', name: '分期与转移' }, { id: 'C', name: '受体与分子分型' }, { id: 'D', name: '手术与新辅助' },
    { id: 'E', name: '系统治疗' }, { id: 'F', name: '放疗' }, { id: 'G', name: '疗效与结局' }, { id: 'H', name: '不良反应' }, { id: 'I', name: '危险因素与基线' }, { id: 'K', name: '肿瘤标志物' },
  ],
  fields: [
    /* A 诊断与病理 */
    dxList('A1', '乳腺癌相关诊断', 'A', 'P0', '诊断栏写明的乳腺癌诊断（原文写法）。', '乳腺癌|乳腺恶性肿瘤|乳腺浸润性|乳腺导管原位癌|乳腺Ca|乳房恶性肿瘤', ['乳腺癌', '乳腺恶性肿瘤', '乳腺浸润性', '乳腺导管原位癌', '乳房恶性肿瘤'], { after: 20 }),
    icd('A1c', 'ICD-10 编码（C50/D05）', 'A', 'P0', '乳腺恶性肿瘤与原位癌编码。', 'C50|D05'),
    enumOf('A2', '组织学类型', 'A', 'P0', 'WHO 乳腺肿瘤组织学类型。', [
      ['浸润性导管癌', '非特殊类型浸润性癌', '浸润性癌（非特殊类型）', '浸润性癌，非特殊类型', 'IDC'], ['浸润性小叶癌', 'ILC'], ['导管原位癌', 'DCIS'], ['小叶原位癌', 'LCIS'],
      ['黏液癌', '粘液癌', '黏液腺癌'], ['化生性癌'], ['髓样癌'], ['小管癌'], ['浸润性微乳头状癌', '微乳头状癌'], ['炎性乳腺癌'],
    ], { granularity: 'patient', pick: 'mode', sources: { sections: [...DX, ...PATH] } }),
    enumOf('A3', '侧别', 'A', 'P1', '肿瘤所在乳腺。', [['左侧', '左乳', '左侧乳腺', '左乳腺', '左乳房'], ['右侧', '右乳', '右侧乳腺', '右乳腺', '右乳房'], ['双侧', '双乳', '双侧乳腺']], { selfTerm: false, granularity: 'patient', pick: 'mode', sources: { sections: [...DX, ...PATH] } }),
    { id: 'A4', name: '组织学分级', group: 'A', priority: 'P1', type: 'enum', granularity: 'patient', pick: 'last', definition: 'Nottingham 组织学分级 I–III 级（G1–G3）。',
      options: [{ value: 'I级' }, { value: 'II级' }, { value: 'III级' }], sources: { sections: PATH },
      rules: [
        { id: 'grade', regex: '(?:组织学分级|组织学级别|Nottingham分级|SBR分级|分级)\\s*[:：]?\\s*(?<v>Ⅲ|Ⅱ|Ⅰ|III|II|I|[1-3])\\s*级', map: { 'Ⅰ': 'I级', 'Ⅱ': 'II级', 'Ⅲ': 'III级', I: 'I级', II: 'II级', III: 'III级', 1: 'I级', 2: 'II级', 3: 'III级' } },
        { id: 'grade-g', regex: '(?<![A-Za-z])G(?<v>[1-3])(?![0-9A-Za-z])', map: { 1: 'I级', 2: 'II级', 3: 'III级' } },
      ] },
    date('A5', '病理确诊时间', 'A', 'P0', '病理（穿刺或术后）确诊乳腺癌的时间。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', sources: { sections: ['现病史', '既往史', '诊疗经过', '病例特点'] }, recall: { terms: ['确诊', '病理', '穿刺', '活检', '术后病理'] } }),
    derived('A6', '确诊年龄', 'A', 'P0', '确诊时年龄。', { op: 'ageAt', at: 'A5' }, { granularity: 'patient' }),
    enumOf('A7', '绝经状态', 'A', 'P0', '确诊或治疗时的月经状态。', [['绝经前', '绝经前', '未绝经', '月经规律', '尚未绝经'], ['围绝经期', '围绝经期', '围绝经'], ['绝经后', '绝经后', '已绝经', '绝经后状态', '自然绝经', '人工绝经']], { selfTerm: false, granularity: 'patient', pick: 'last', accept: HX }),

    /* B 分期与转移 */
    tnmText('B1', 'B', 'P0', 'cT2N1M0、pT1cN0M0、ypT0N0'),
    stageField('B2', '临床／病理分期', 'B', 'P0', 'AJCC 第 8 版解剖分期 0–IV 期（只认与乳腺癌写在同一句里的分期）。', STAGES, '乳腺癌|乳腺恶性肿瘤|浸润性导管癌|浸润性癌|乳腺Ca'),
    measure('B3', '肿瘤最大径', 'B', 'P1', '最大(?:直)?径|肿瘤(?:最大径|大小)|肿物(?:最大径|大小)|肿块(?:最大径|大小)|病灶(?:最大径|大小)', { unit: 'cm', range: { min: 0.1, max: 30 }, value: '\\d{1,2}(?:\\.\\d{1,2})?(?=\\s*(?:cm|CM|厘米))', granularity: 'patient', pick: 'max' }),
    measure('B4', '阳性淋巴结数', 'B', 'P0', '(?:腋窝|前哨|区域)?淋巴结', { unit: '枚', range: { min: 0, max: 80 }, value: '\\d{1,2}(?=\\s*\\/\\s*\\d{1,2})', granularity: 'patient', pick: 'max', definition: '病理报告阳性淋巴结数（"淋巴结 3/15"取 3）。' }),
    listOf('B5', '远处转移部位', 'B', 'P0', '远处转移部位（复发转移时写）。', [['骨转移', '多发骨转移', '骨质破坏'], ['肺转移', '双肺转移'], ['肝转移'], ['脑转移', '颅内转移'], ['胸膜转移', '恶性胸腔积液'], ['远处淋巴结转移', '锁骨上淋巴结转移', '纵隔淋巴结转移']], { granularity: 'patient', accept: HX }),

    /* C 受体与分子分型 */
    receptor('C1', 'ER 状态', 'ER', 'P0'),
    pct('C2', 'ER 阳性百分比', 'ER', 'P1'),
    receptor('C3', 'PR 状态', 'PR|PgR', 'P0'),
    pct('C4', 'PR 阳性百分比', 'PR|PgR', 'P1'),
    { id: 'C5', name: 'HER2 免疫组化', group: 'C', priority: 'P0', type: 'enum', granularity: 'patient', pick: 'last', definition: 'HER2 IHC 评分：0、1+、2+、3+（"（+++）"记 3+，"（-）"记 0）。',
      options: [{ value: '0' }, { value: '1+' }, { value: '2+' }, { value: '3+' }],
      rules: [
        { id: 'her2-score', regex: `${HER2}\\s*[:：]?\\s*[（(]?\\s*(?:IHC)?\\s*[:：]?\\s*(?<v>[0-3])\\s*(?:[+＋](?![+＋])|(?=[）)，,。；;\\s]|$))`, map: { 0: '0', 1: '1+', 2: '2+', 3: '3+' } },
        { id: 'her2-plus', regex: `${HER2}\\s*[:：]?\\s*[（(]\\s*(?<v>[+＋]{1,3}|[-－])\\s*[)）]`, map: { '+': '1+', '++': '2+', '+++': '3+', '＋': '1+', '＋＋': '2+', '＋＋＋': '3+', '-': '0', '－': '0' } },
      ] },
    enumOf('C6', 'HER2 ISH（FISH）', 'C', 'P1', 'HER2 原位杂交结果：扩增或无扩增。', [['扩增', 'FISH阳性', 'FISH检测阳性', 'FISH（+）', '有扩增', 'HER2基因扩增'], ['无扩增', 'FISH阴性', 'FISH检测阴性', 'FISH（-）', '无扩增', '未见扩增', '未扩增']], { selfTerm: false, granularity: 'patient', pick: 'last' }),
    enumOf('C7', 'HER2 状态', 'C', 'P0', 'HER2 综合判定：阳性、低表达、阴性（0）。', [['阳性', 'HER2阳性', 'HER-2阳性', 'HER2（+++）', 'HER2过表达'], ['低表达', 'HER2低表达', 'HER2-low', 'HER2 low'], ['阴性', 'HER2阴性', 'HER-2阴性', 'HER2（-）', 'HER2 0']], { selfTerm: false, granularity: 'patient', pick: 'last' }),
    measure('C8', 'Ki-67', 'C', 'P0', 'Ki-?67', { unit: '%', range: { min: 0, max: 100 }, value: '\\d{1,3}(?=\\s*%)', granularity: 'patient', pick: 'last' }),
    enumOf('C9', '分子分型', 'C', 'P0', 'St. Gallen 分子分型（医生写明）。', [['Luminal A型', 'Luminal A', 'LuminalA', 'Luminal A样'], ['Luminal B型', 'Luminal B', 'LuminalB', 'Luminal B样'], ['HER2阳性（非Luminal）', 'HER2过表达型', 'HER2阳性型', 'HER2富集型', 'HER2扩增型'], ['三阴性', '三阴性乳腺癌', 'TNBC', '三阴型']], { selfTerm: false, granularity: 'patient', pick: 'last' }),
    presence('C10', 'BRCA1/2 致病突变', 'C', 'P1', '胚系 BRCA1/2 致病或可能致病突变。', ['BRCA1突变', 'BRCA2突变', 'BRCA突变', 'BRCA1/2突变', 'gBRCA突变', 'gBRCAm'], { granularity: 'patient', accept: HX }),
    presence('C11', 'PIK3CA 突变', 'C', 'P2', 'PIK3CA 激活突变。', ['PIK3CA突变', 'PIK3CA'], { granularity: 'patient', accept: HX }),
    scale('C12', '21 基因复发评分', 'C', 'P2', '21基因(?:检测)?(?:复发)?(?:风险)?(?:评分|RS)?|Oncotype\\s*DX|复发评分\\s*[（(]?RS[)）]?', { min: 0, max: 100 }),

    /* D 手术与新辅助 */
    enumOf('D1', '乳腺手术方式', 'D', 'P0', '乳腺原发灶手术方式。', [['保乳手术', '保乳术', '保乳', '乳腺区段切除', '乳腺癌保乳'], ['改良根治术', '乳腺癌改良根治', '改良根治'], ['全乳切除', '单纯乳房切除', '乳房切除术', '全乳房切除'], ['保留乳头乳晕的乳房切除', '保留乳头乳晕']], { granularity: 'patient', pick: 'all', accept: HX }),
    enumOf('D2', '腋窝处理', 'D', 'P0', '前哨淋巴结活检或腋窝淋巴结清扫。', [['前哨淋巴结活检', 'SLNB', '前哨淋巴结'], ['腋窝淋巴结清扫', 'ALND', '腋清', '腋窝清扫']], { granularity: 'patient', pick: 'all', accept: HX }),
    presence('D3', '乳房重建', 'D', 'P2', '即刻或延期乳房重建。', ['乳房重建', '假体重建', '扩张器', '背阔肌皮瓣', 'TRAM', 'DIEP'], { granularity: 'patient', accept: HX }),
    presence('D4', '新辅助治疗', 'D', 'P0', '术前新辅助化疗、靶向或内分泌治疗。', ['新辅助', '新辅助化疗', '新辅助治疗', '术前化疗'], { granularity: 'patient', accept: HX }),
    presence('D5', '病理完全缓解（pCR）', 'D', 'P0', '新辅助后乳腺及腋窝无浸润癌残留（ypT0/is ypN0）。', ['pCR', '病理完全缓解', '病理学完全缓解', '未见残余浸润癌', '未见浸润癌残留'], { granularity: 'patient', accept: HX }),
    scale('D6', 'Miller-Payne 分级', 'D', 'P1', 'Miller-?Payne(?:分级|系统)?|MP分级', { min: 1, max: 5 }),
    measure('D7', '手术切缘', 'D', 'P2', '切缘', { unit: 'mm', range: { min: 0, max: 100 }, value: '\\d{1,2}(?:\\.\\d)?(?=\\s*(?:mm|毫米))', granularity: 'patient', pick: 'min', definition: '保乳切缘距肿瘤最近距离（mm）。' }),

    /* E 系统治疗 */
    drugList('E1', '化疗药物', 'E', 'P0', '化疗药物（蒽环、紫杉、铂类、卡培他滨等）。', [[['表柔比星', '法玛新'], ['多柔比星', '阿霉素'], ['吡柔比星'], ['多柔比星脂质体', '脂质体多柔比星', '里葆多'], ['紫杉醇', '泰素'], ['白蛋白结合型紫杉醇', '白蛋白紫杉醇', '克艾力'], ['紫杉醇脂质体', '力扑素'], ['多西他赛', '泰索帝'], ['环磷酰胺'], ['卡培他滨', '希罗达'], ['卡铂'], ['顺铂'], ['吉西他滨'], ['长春瑞滨'], ['艾立布林', '海乐卫'], ['优替德隆']]], { accept: HX }),
    drugList('E2', '抗 HER2 药物', 'E', 'P0', '抗 HER2 单抗、TKI 与 ADC。', [[['曲妥珠单抗', '赫赛汀', '汉曲优', '赛妥'], ['帕妥珠单抗', '帕捷特'], ['帕妥珠曲妥珠单抗', '帕妥珠单抗曲妥珠单抗', '依优'], ['吡咯替尼', '艾瑞妮'], ['拉帕替尼'], ['奈拉替尼'], ['图卡替尼'], ['恩美曲妥珠单抗', 'T-DM1', '赫赛莱'], ['德曲妥珠单抗', 'T-DXd', 'DS-8201', '优赫得'], ['伊尼妥单抗'], ['维迪西妥单抗']]], { accept: HX }),
    drugList('E3', '内分泌治疗', 'E', 'P0', 'SERM、芳香化酶抑制剂、SERD 与卵巢功能抑制。', [[['他莫昔芬', '三苯氧胺'], ['托瑞米芬'], ['来曲唑', '弗隆'], ['阿那曲唑', '瑞宁得'], ['依西美坦', '阿诺新'], ['氟维司群', '芙仕得'], ['戈舍瑞林', '诺雷德'], ['亮丙瑞林', '抑那通', '贝依'], ['曲普瑞林', '达菲林']]], { accept: HX }),
    drugList('E4', 'CDK4/6 抑制剂', 'E', 'P0', 'CDK4/6 抑制剂。', [[['哌柏西利', '爱博新'], ['阿贝西利', '威佳达'], ['瑞波西利', '凯丽隆'], ['达尔西利', '艾瑞康']]], { accept: HX }),
    drugList('E5', '其他靶向／免疫治疗', 'E', 'P1', 'PARP 抑制剂、ADC、免疫检查点抑制剂、mTOR/PI3K 抑制剂等。', [[['奥拉帕利', '利普卓'], ['戈沙妥珠单抗', '拓达维'], ['帕博利珠单抗', '可瑞达', 'K药'], ['特瑞普利单抗', '拓益'], ['西达本胺', '爱谱沙'], ['依维莫司', '飞尼妥'], ['阿培利司'], ['贝伐珠单抗', '安维汀'], ['卡瑞利珠单抗']]], { accept: HX }),
    drugList('E6', '骨改良药物', 'E', 'P2', '双膦酸盐或地舒单抗。', [[['唑来膦酸', '择泰', '密固达'], ['地舒单抗', '安加维', '普罗力'], ['伊班膦酸'], ['帕米膦酸']]]),
    enumOf('E7', '治疗阶段', 'E', 'P1', '本次系统治疗所处阶段。', [['新辅助', '新辅助治疗'], ['辅助', '辅助治疗', '术后辅助'], ['晚期解救', '解救治疗', '姑息治疗', '复发转移后治疗']], { selfTerm: false, granularity: 'encounter', pick: 'last' }),
    lines('E8', 'E', 'P1'),
    cycles('E9', 'E', 'P1'),

    /* F 放疗 */
    presence('F1', '放疗', 'F', 'P0', '乳腺癌放疗（全乳、胸壁、区域淋巴结或转移灶）。', ['放疗', '放射治疗', '术后放疗', '全乳放疗', '胸壁放疗', '瘤床加量'], { granularity: 'patient', accept: HX }),
    measure('F2', '放疗总剂量', 'F', 'P2', '(?:放疗|DT|总剂量|处方剂量)', { unit: 'Gy', range: { min: 1, max: 80 }, gap: 16, value: '\\d{1,2}(?:\\.\\d{1,2})?(?=\\s*Gy)', granularity: 'patient', pick: 'max' }),

    /* G 疗效与结局 */
    recist('G1', 'G', 'P0'),
    presence('G2', '复发／转移', 'G', 'P0', '局部区域复发或远处转移（术后随访中）。', ['复发', '局部复发', '远处转移', '新发转移', '新增转移', '复发转移'], { granularity: 'encounter' }),
    date('G3', '复发转移时间', 'G', 'P1', '首次确认复发或远处转移的时间。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', recall: { terms: ['复发', '转移'] } }),
    presence('G4', '疾病进展', 'G', 'P1', '晚期治疗中影像或临床确认的进展。', ['疾病进展', '病情进展', '进展'], { granularity: 'encounter' }),
    death('G5', 'G', 'P0', 'patient'),

    /* H 不良反应 */
    presence('H1', '心脏毒性', 'H', 'P1', '抗 HER2 或蒽环治疗相关心脏毒性（LVEF 下降等）。', ['心脏毒性', 'LVEF下降', '射血分数下降', '心功能下降'], { granularity: 'encounter' }),
    lab('H2', 'lvef', 'H', 'P1'),
    listOf('H3', '治疗不良反应', 'H', 'P1', '记录的治疗不良反应。', [['骨髓抑制', '白细胞减少', '中性粒细胞减少', '粒缺', '血小板减少'], ['发热性中性粒细胞减少', '粒缺伴发热'], ['腹泻'], ['手足综合征'], ['周围神经毒性', '周围神经病变', '手足麻木'], ['间质性肺病', 'ILD', '间质性肺炎'], ['肝功能损害', '转氨酶升高'], ['恶心呕吐', '恶心', '呕吐'], ['脱发'], ['潮热'], ['关节痛'], ['骨质疏松']], { granularity: 'encounter', model: 'always', recall: { terms: ['不良反应', '毒副反应', '骨髓抑制', '腹泻', '手足', '麻木', '间质性', '转氨酶升高', '潮热', '关节痛'] } }),
    enumOf('H4', '最高 CTCAE 分级', 'H', 'P2', '记录的不良事件最高分级。', [['1级'], ['2级'], ['3级'], ['4级'], ['5级']], { selfTerm: false, granularity: 'encounter', pick: 'last', rules: [{ id: 'ctcae', regex: '(?:CTCAE|不良反应|不良事件|骨髓抑制)[^。；\\n]{0,12}?(?<v>[1-5])\\s*级', map: { 1: '1级', 2: '2级', 3: '3级', 4: '4级', 5: '5级' } }] }),

    /* I 危险因素与基线 */
    fhx('I1', '乳腺癌／卵巢癌家族史', 'I', 'P0', '亲属乳腺癌或卵巢癌史。', ['乳腺癌', '卵巢癌', '乳腺恶性肿瘤']),
    measure('I2', '月经初潮年龄', 'I', 'P2', '初潮(?:年龄)?', { unit: '岁', range: { min: 8, max: 20 }, value: '\\d{1,2}(?=\\s*岁)', granularity: 'patient', pick: 'first', alt: [{ id: 'menarche-b', regex: '(?<v>\\d{1,2})\\s*岁\\s*(?:月经)?初潮' }] }),
    lab('I3', 'bmi', 'I', 'P2'),
    ecog('I4', 'I', 'P1'),
    ageNow('I5', 'I', 'P0'),
    chief('I6', 'I', 'P1'),

    /* K 肿瘤标志物 */
    measure('K1', 'CA15-3', 'K', 'P0', 'CA\\s*-?15-?3|糖类抗原\\s*15-?3', { unit: 'U/mL', range: { min: 0, max: 10000 } }),
    lab('K2', 'cea', 'K', 'P0'),
    measure('K3', 'CA125', 'K', 'P2', 'CA\\s*-?125|糖类抗原\\s*125', { unit: 'U/mL', range: { min: 0, max: 50000 } }),
  ],
}
