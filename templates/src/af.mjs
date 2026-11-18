/**
 * 心房颤动。
 * 依据：心房颤动诊断和治疗中国指南（2023）；2024 ESC 房颤管理指南（AF-CARE）；2023 ACC/AHA/ACCP/HRS 房颤指南。
 * 分型：首诊、阵发性、持续性、长程持续性、永久性；卒中风险 CHA2DS2-VASc（2024 ESC 为 CHA2DS2-VA）；出血风险 HAS-BLED；症状 EHRA。
 * 字段范围参考古脉 G-MPAS「心律失常专病」数据集目录。
 */
import { DUR, HX, ageNow, chief, date, derived, drugList, dxList, enumOf, hr, hx, icd, lab, listOf, measure, presence, sbp, scale } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
const EHRA_MAP = Object.fromEntries([['I', 'I'], ['IIa', 'IIa'], ['IIb', 'IIb'], ['II', 'IIa'], ['III', 'III'], ['IV', 'IV']].flatMap(([raw, v]) => {
  const full = raw.replace('IV', 'Ⅳ').replace('III', 'Ⅲ').replace('II', 'Ⅱ').replace(/^I(?=$|[ab])/, 'Ⅰ')
  const num = raw.replace('IV', '4').replace('III', '3').replace('II', '2').replace(/^I(?=$|[ab])/, '1')
  return [raw, full, num].map((k) => [k, v])
}))

export default {
  format: 'extract-template/1',
  id: 'af',
  name: '心房颤动（AF）',
  version: '0.1.0',
  domain: '心血管',
  description: '房颤研究与质控常用字段：房颤分型与病程、EHRA 症状分级、CHA2DS2-VASc／HAS-BLED、抗凝与 INR、室率与节律控制药物、电复律、导管消融、左心耳封堵、合并症、栓塞与出血结局、超声与关键检验。',
  references: [
    { title: '心房颤动诊断和治疗中国指南（2023），中华心血管病杂志 2023;51(6)' },
    { title: '2024 ESC Guidelines for the management of atrial fibrillation (AF-CARE)' },
    { title: '2023 ACC/AHA/ACCP/HRS Guideline for the Diagnosis and Management of Atrial Fibrillation' },
    { title: '古脉 G-MPAS 数据目录：心律失常专病（字段范围参考）', url: 'https://www.g-mpas.com/data.html' },
  ],
  groups: [
    { id: 'A', name: '诊断与分型' }, { id: 'B', name: '症状' }, { id: 'C', name: '卒中与出血风险' }, { id: 'D', name: '抗栓治疗' },
    { id: 'E', name: '室率与节律控制' }, { id: 'F', name: '介入与器械' }, { id: 'G', name: '合并症' }, { id: 'H', name: '结局' }, { id: 'K', name: '检查与检验' },
  ],
  fields: [
    /* A 诊断与分型 */
    dxList('A1', '房颤相关诊断', 'A', 'P0', '诊断栏写明的心房颤动／心房扑动诊断（原文写法）。', '房颤|心房颤动|心房扑动|房扑', ['房颤', '心房颤动', '心房扑动', '房扑']),
    icd('A1c', 'ICD-10 编码（I48）', 'A', 'P0', '心房颤动与扑动编码。', 'I48'),
    enumOf('A2', '房颤类型', 'A', 'P0', '首诊、阵发性、持续性、长程持续性、永久性。', [
      ['阵发性', '阵发性房颤', '阵发性心房颤动'], ['持续性', '持续性房颤', '持续性心房颤动'], ['长程持续性', '长程持续性房颤', '长程持续性心房颤动', '长期持续性房颤'],
      ['永久性', '永久性房颤', '永久性心房颤动', '慢性房颤', '慢性心房颤动'], ['首诊', '首诊房颤', '新发房颤', '新发心房颤动', '初发房颤'],
    ], { selfTerm: false, granularity: 'encounter', pick: 'last' }),
    enumOf('A3', '瓣膜性／非瓣膜性', 'A', 'P1', '瓣膜性房颤（中重度二尖瓣狭窄或机械瓣）或非瓣膜性房颤。', [['非瓣膜性', '非瓣膜性房颤', '非瓣膜性心房颤动', 'NVAF'], ['瓣膜性', '瓣膜性房颤', '瓣膜性心房颤动', '风湿性心脏病二尖瓣狭窄', '机械瓣置换术后']], { selfTerm: false, granularity: 'patient', pick: 'last' }),
    presence('A4', '心房扑动', 'A', 'P1', '心房扑动（含典型房扑）。', ['心房扑动', '房扑', '典型房扑'], { granularity: 'patient', accept: HX }),
    date('A5', '首次发现房颤时间', 'A', 'P0', '首次发现或诊断房颤的时间；"阵发心悸5年，诊断房颤"取 5 年前。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', sources: { sections: ['主诉', '现病史', '既往史'] }, recall: { terms: ['房颤', '心房颤动', '心悸'], regex: [DUR] } }),
    derived('A6', '房颤病程（月）', 'A', 'P1', '首次发现至本次就诊的月数。', { op: 'monthsBetween', from: 'A5', to: '$encounter.start' }, { granularity: 'encounter' }),

    /* B 症状 */
    presence('B1', '心悸', 'B', 'P0', '心悸、心慌、心跳不齐。', ['心悸', '心慌', '心跳不齐', '心律不齐', '心跳快']),
    presence('B2', '胸闷／气短', 'B', 'P1', '胸闷、气短、活动耐量下降。', ['胸闷', '气短', '气促', '活动后气促', '活动耐量下降']),
    presence('B3', '晕厥／黑蒙', 'B', 'P1', '晕厥、黑蒙、近乎晕厥。', ['晕厥', '黑蒙', '一过性意识丧失', '眼前发黑']),
    { id: 'B4', name: 'EHRA 症状分级', group: 'B', priority: 'P1', type: 'enum', granularity: 'encounter', pick: 'last', definition: 'EHRA 症状分级 I、IIa、IIb、III、IV（只写 II 的记 IIa）。',
      options: [{ value: 'I' }, { value: 'IIa' }, { value: 'IIb' }, { value: 'III' }, { value: 'IV' }],
      rules: [{ id: 'ehra', regex: 'EHRA\\s*(?:症状)?\\s*(?:分级|评分)?\\s*[:：为]?\\s*(?<v>(?:Ⅳ|Ⅲ|Ⅱ|Ⅰ|IV|III|II|I|[1-4])[ab]?)\\s*级?', map: EHRA_MAP }] },
    measure('B5', '心室率', 'B', 'P1', '心室率|平均心室率', { unit: '次/分', range: { min: 20, max: 300 }, value: '\\d{2,3}' }),

    /* C 卒中与出血风险 */
    scale('C1', 'CHA2DS2-VASc', 'C', 'P0', 'CHA(?:2|₂)?DS(?:2|₂)?\\s*-?\\s*VAS[Cc]', { min: 0, max: 9 }),
    scale('C2', 'HAS-BLED', 'C', 'P0', 'HAS-?BLED', { min: 0, max: 9 }),
    hx('C3', '既往卒中／TIA／血栓栓塞', 'C', 'P0', '既往缺血性卒中、TIA 或体循环栓塞。', ['脑梗死', '脑梗塞', '脑栓塞', '脑卒中', 'TIA', '短暂性脑缺血发作', '体循环栓塞', '外周动脉栓塞'], { accept: ['既往'] }),
    presence('C4', '左心耳／左房血栓', 'C', 'P0', '经食管超声或 CT 示左心耳或左房血栓。', ['左心耳血栓', '心耳血栓', '左房血栓', '左心房血栓', '左心耳内血栓'], { granularity: 'encounter' }),
    hx('C5', '既往大出血', 'C', 'P1', '既往大出血或出血倾向（颅内出血、消化道出血等）。', ['颅内出血', '脑出血', '消化道出血', '上消化道出血', '大出血'], { accept: ['既往'] }),

    /* D 抗栓治疗 */
    drugList('D1', '口服抗凝药', 'D', 'P0', '在用或出院带的抗凝药（华法林、NOAC、低分子肝素）。', ['anticoag']),
    measure('D2', 'INR', 'D', 'P0', 'INR|国际标准化比值', { unit: null, range: { min: 0.5, max: 15 }, value: '\\d(?:\\.\\d{1,2})?' }),
    measure('D3', 'TTR（INR 在目标范围内时间）', 'D', 'P2', 'TTR|INR(?:在)?目标范围内时间', { unit: '%', range: { min: 0, max: 100 } }),
    drugList('D4', '抗血小板药', 'D', 'P1', '在用抗血小板药。', ['antiplatelet']),
    presence('D5', '未抗凝或抗凝禁忌', 'D', 'P1', '医生写明未予抗凝、拒绝抗凝或存在抗凝禁忌。', ['抗凝禁忌', '拒绝抗凝', '未予抗凝', '不愿抗凝', '暂不抗凝', '未行抗凝'], { granularity: 'encounter' }),

    /* E 室率与节律控制 */
    enumOf('E1', '治疗策略', 'E', 'P1', '节律控制或室率控制。', [['节律控制', '转复窦律', '维持窦律', '复律治疗'], ['室率控制', '心室率控制', '控制心室率', '控制室率']], { granularity: 'encounter', pick: 'last' }),
    drugList('E2', '室率控制药', 'E', 'P0', 'β 受体阻滞剂、非二氢吡啶类 CCB、洋地黄类。', [[['美托洛尔', '倍他乐克', '琥珀酸美托洛尔', '酒石酸美托洛尔'], ['比索洛尔', '康忻', '博苏'], ['艾司洛尔'], ['地尔硫䓬', '合贝爽'], ['维拉帕米'], ['地高辛'], ['去乙酰毛花苷', '西地兰']]]),
    drugList('E3', '抗心律失常药', 'E', 'P0', '节律控制用抗心律失常药。', [[['胺碘酮', '可达龙'], ['普罗帕酮', '心律平'], ['决奈达隆', '迈达乐'], ['索他洛尔'], ['伊布利特', '欣无忧'], ['维纳卡兰'], ['氟卡尼'], ['多非利特'], ['莫雷西嗪'], ['稳心颗粒'], ['参松养心胶囊']]]),

    /* F 介入与器械 */
    presence('F1', '电复律', 'F', 'P1', '本次行同步电复律。', ['电复律', '同步电复律', '直流电复律', '电转复', '同步直流电复律'], { granularity: 'encounter' }),
    presence('F2', '本次导管消融', 'F', 'P0', '本次行房颤导管消融（射频、冷冻球囊、脉冲电场）。', ['导管消融', '射频消融', '冷冻消融', '冷冻球囊消融', '肺静脉隔离', 'PVI', '脉冲电场消融', 'PFA', '环肺静脉电隔离'], { granularity: 'encounter' }),
    presence('F3', '消融史', 'F', 'P1', '既往房颤／房扑导管消融史。', ['导管消融', '射频消融', '冷冻消融', '冷冻球囊消融', '肺静脉隔离'], { granularity: 'patient', accept: ['既往'] }),
    presence('F4', '左心耳封堵', 'F', 'P1', '左心耳封堵或夹闭。', ['左心耳封堵', '左心耳封堵术', 'LAAC', 'LAAO', 'Watchman', '左心耳夹闭', '左心耳切除'], { granularity: 'patient', accept: HX }),
    presence('F5', '起搏器／ICD', 'F', 'P2', '永久起搏器、ICD 或 CRT 植入。', ['起搏器', '永久起搏器', 'PPM', 'ICD', 'CRT', '房室结消融'], { granularity: 'patient', accept: HX }),
    presence('F6', '术后复发', 'F', 'P1', '消融或复律后房颤／房扑／房速复发。', ['房颤复发', '复发房颤', '心房颤动复发', '房速复发', '房扑复发', '术后复发'], { granularity: 'encounter' }),

    /* G 合并症 */
    hx('G1', '高血压', 'G', 'P0', '高血压病史。', ['高血压']),
    hx('G2', '糖尿病', 'G', 'P0', '糖尿病病史。', ['糖尿病', '2型糖尿病']),
    hx('G3', '心力衰竭', 'G', 'P0', '心力衰竭或左室收缩功能障碍。', ['心力衰竭', '心衰', '心功能不全']),
    hx('G4', '冠心病／血管疾病', 'G', 'P1', '冠心病、心肌梗死、外周动脉疾病或主动脉斑块（CHA2DS2-VASc 的 V）。', ['冠心病', '心肌梗死', '外周动脉疾病', '下肢动脉硬化闭塞', '主动脉斑块']),
    hx('G5', '慢性肾脏病', 'G', 'P1', '慢性肾脏病或肾功能不全。', ['慢性肾脏病', 'CKD', '肾功能不全', '慢性肾衰竭']),
    hx('G6', '甲状腺功能亢进', 'G', 'P2', '甲亢或甲状腺毒症。', ['甲状腺功能亢进', '甲亢', '甲状腺毒症', 'Graves病']),
    hx('G7', '阻塞性睡眠呼吸暂停', 'G', 'P2', 'OSA/OSAHS。', ['睡眠呼吸暂停', 'OSAHS', 'OSA']),
    hx('G8', '瓣膜病', 'G', 'P2', '心脏瓣膜病或瓣膜置换术后。', ['瓣膜病', '二尖瓣狭窄', '二尖瓣关闭不全', '主动脉瓣狭窄', '瓣膜置换', '风湿性心脏病']),
    hx('G9', '饮酒', 'G', 'P2', '饮酒（含已戒）。', ['饮酒', '喝酒', '酗酒']),

    /* H 结局 */
    presence('H1', '缺血性卒中／体循环栓塞', 'H', 'P0', '本次新发缺血性卒中、TIA 或体循环栓塞。', ['脑梗死', '脑栓塞', '心源性栓塞', '急性缺血性卒中', 'TIA', '体循环栓塞', '肠系膜动脉栓塞', '下肢动脉栓塞'], { granularity: 'encounter' }),
    presence('H2', '出血事件', 'H', 'P0', '本次出血事件（颅内、消化道、泌尿道等）。', ['颅内出血', '脑出血', '消化道出血', '上消化道出血', '血尿', '牙龈出血', '鼻出血', '大出血', '黑便'], { granularity: 'encounter' }),
    presence('H3', '心衰住院', 'H', 'P1', '本次因心力衰竭住院或心衰加重。', ['心衰加重', '心力衰竭加重', '急性左心衰', '急性心力衰竭'], { granularity: 'encounter' }),
    ageNow('H4', 'H', 'P0'),
    chief('H5', 'H', 'P1'),

    /* K 检查与检验 */
    measure('K1', '左房内径', 'K', 'P1', '左房(?:前后)?(?:内)?径|左心房(?:前后)?(?:内)?径|LA(?=\\s*[:：]?\\s*\\d)', { unit: 'mm', range: { min: 15, max: 90 } }),
    lab('K2', 'lvef', 'K', 'P0'),
    lab('K3', 'ntprobnp', 'K', 'P1'),
    hr('K4', 'K', 'P1'),
    sbp('K5', 'K', 'P1'),
    lab('K6', 'scr', 'K', 'P0', { definition: '肌酐（μmol/L）的测定值，每次测定一条（NOAC 剂量调整依据）。' }),
    lab('K7', 'egfr', 'K', 'P1'),
    lab('K8', 'tsh', 'K', 'P2'),
    lab('K9', 'hb', 'K', 'P2'),
    lab('K10', 'k', 'K', 'P2'),
    listOf('K11', '动态心电图所见', 'K', 'P2', 'Holter 记录到的心律失常。', [['阵发性房颤', '阵发性心房颤动'], ['房扑', '心房扑动'], ['长间歇', 'RR长间歇'], ['室性早搏', '室早', '频发室早'], ['房性早搏', '房早', '频发房早'], ['房速', '房性心动过速']], { granularity: 'encounter', sources: { sections: ['所见', '结论', '动态心电图', 'Holter', '辅助检查', '正文'] } }),
  ],
}
