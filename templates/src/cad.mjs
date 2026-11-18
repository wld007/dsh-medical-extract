/**
 * 冠心病（含急性冠脉综合征、PCI）。
 * 依据：急性 ST 段抬高型心肌梗死诊断和治疗指南（2019）；非 ST 段抬高型急性冠脉综合征诊断和治疗指南（2024）；
 * 中国经皮冠状动脉介入治疗指南；2023 ESC ACS 指南；2024 ESC 慢性冠脉综合征指南；第四版心肌梗死全球定义；中国血脂管理指南（2023）。
 * 字段范围参考古脉 G-MPAS「冠心病专病」数据集目录。
 */
import { HX, ROMAN, ROMAN_RE, ageNow, chief, death, drugList, dxList, enumOf, fhx, hr, hx, icd, lab, listOf, los, measure, presence, sbp, scale, smoking, date } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
const roman = (lead, suffix = '级') => [{ id: 'grade', regex: `(?:${lead})\\s*(?:分级|心功能)?\\s*[:：]?\\s*(?<v>${ROMAN_RE})\\s*${suffix}?`, map: ROMAN }]

export default {
  format: 'extract-template/1',
  id: 'cad',
  name: '冠心病（CAD/ACS）',
  version: '0.1.0',
  domain: '心血管',
  description: '冠心病研究与胸痛中心质控常用字段：临床类型（STEMI/NSTEMI/UA/稳定型心绞痛）、Killip 与 CCS 分级、心电图与冠脉造影、PCI/CABG/溶栓与时间节点、抗栓调脂与二级预防用药、危险因素、并发症与结局、心肌标志物与血脂。',
  references: [
    { title: '急性 ST 段抬高型心肌梗死诊断和治疗指南（2019），中华心血管病杂志 2019;47(10)' },
    { title: '非 ST 段抬高型急性冠脉综合征诊断和治疗指南（2024），中华心血管病杂志 2024;52(6)' },
    { title: '中国经皮冠状动脉介入治疗指南（2016），中华心血管病杂志 2016;44(5)' },
    { title: '2023 ESC Guidelines for the management of acute coronary syndromes; 2024 ESC Guidelines for chronic coronary syndromes' },
    { title: 'Fourth Universal Definition of Myocardial Infarction (2018)' },
    { title: '古脉 G-MPAS 数据目录：冠心病专病（字段范围参考）', url: 'https://www.g-mpas.com/data.html' },
  ],
  groups: [
    { id: 'A', name: '诊断与分型' }, { id: 'B', name: '症状与心功能' }, { id: 'C', name: '心电图与冠脉评估' }, { id: 'D', name: '再灌注与血运重建' },
    { id: 'E', name: '药物治疗' }, { id: 'F', name: '危险因素' }, { id: 'G', name: '并发症与结局' }, { id: 'K', name: '检验与生命体征' },
  ],
  fields: [
    /* A 诊断与分型 */
    dxList('A1', '冠心病相关诊断', 'A', 'P0', '诊断栏写明的冠心病、心绞痛、心肌梗死、ACS 等诊断（原文写法）。', '冠心病|冠状动脉粥样硬化|心绞痛|心肌梗死|心梗|急性冠脉综合征|急性冠状动脉综合征|STEMI|NSTEMI|ACS', ['冠心病', '冠状动脉粥样硬化', '心绞痛', '心肌梗死', '心梗', '急性冠脉综合征', 'STEMI', 'NSTEMI', 'ACS']),
    icd('A1c', 'ICD-10 编码（I20–I25）', 'A', 'P0', '缺血性心脏病编码。', 'I2[0-5]'),
    enumOf('A2', '临床类型', 'A', 'P0', '本次诊断的冠心病临床类型。', [
      ['STEMI', 'ST段抬高型心肌梗死', 'ST段抬高型急性心肌梗死', '急性ST段抬高型心肌梗死'], ['NSTEMI', '非ST段抬高型心肌梗死', '急性非ST段抬高型心肌梗死'],
      ['不稳定型心绞痛', '不稳定性心绞痛', '初发劳力型心绞痛', '恶化劳力型心绞痛'], ['稳定型心绞痛', '稳定性心绞痛', '慢性稳定型心绞痛', '慢性冠脉综合征', '慢性冠状动脉综合征'],
      ['陈旧性心肌梗死', '陈旧性心梗', '陈旧性前壁心肌梗死', '陈旧性下壁心肌梗死'], ['缺血性心肌病'], ['无症状心肌缺血', '隐匿型冠心病'], ['冠脉痉挛', '变异型心绞痛', '冠状动脉痉挛'], ['MINOCA', '非阻塞性冠状动脉心肌梗死'],
    ], { granularity: 'encounter', pick: 'last', sources: { sections: DX } }),
    listOf('A3', '心肌梗死部位', 'A', 'P1', '心肌梗死累及部位。', [['广泛前壁'], ['前壁'], ['前间壁'], ['下壁'], ['后壁'], ['侧壁', '高侧壁'], ['右室', '右心室']], { granularity: 'encounter', sources: { sections: DX }, recall: { regex: ['(?:广泛前壁|前间壁|前壁|下壁|后壁|高侧壁|侧壁|右室|右心室)[^。；\\n]{0,10}?(?:心肌梗死|心梗|STEMI|NSTEMI)'] } }),
    { id: 'A4', name: 'Killip 分级', group: 'A', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'first', definition: '急性心肌梗死 Killip I–IV 级（取入院时）。', options: [{ value: 'I' }, { value: 'II' }, { value: 'III' }, { value: 'IV' }], rules: roman('Killip') },
    { id: 'A5', name: 'CCS 心绞痛分级', group: 'A', priority: 'P2', type: 'enum', granularity: 'encounter', pick: 'last', definition: '加拿大心血管学会（CCS）心绞痛 I–IV 级。', options: [{ value: 'I' }, { value: 'II' }, { value: 'III' }, { value: 'IV' }], rules: roman('CCS') },
    date('A6', '本次胸痛发作时间', 'A', 'P1', '本次症状（胸痛、胸闷）开始的时间；"胸痛3小时"按文书写成时间换算。', { granularity: 'encounter', pick: 'earliest', model: 'always', sources: { sections: ['主诉', '现病史'] }, recall: { terms: ['胸痛', '胸闷', '心前区'] } }),
    scale('A7', 'GRACE 评分', 'A', 'P1', 'GRACE', { min: 0, max: 400 }),

    /* B 症状与心功能 */
    presence('B1', '胸痛／胸闷', 'B', 'P0', '胸痛、胸闷、心前区或胸骨后不适。', ['胸痛', '胸闷', '心前区疼痛', '心前区不适', '心前区闷痛', '胸骨后疼痛', '胸骨后不适', '压榨样疼痛']),
    presence('B2', '放射痛', 'B', 'P2', '疼痛放射至左肩、左上肢、颈部、下颌或后背。', ['放射至', '向左肩', '左上肢放射', '后背放射', '放射痛', '牵涉痛']),
    presence('B3', '含服硝酸甘油可缓解', 'B', 'P2', '症状含服硝酸甘油后缓解。', ['含服硝酸甘油后缓解', '硝酸甘油后缓解', '含服硝酸甘油可缓解', '舌下含服硝酸甘油后缓解', '含服硝酸甘油后好转']),
    { id: 'B4', name: 'NYHA 心功能分级', group: 'B', priority: 'P1', type: 'enum', granularity: 'encounter', pick: 'last', definition: 'NYHA I–IV 级。', options: [{ value: 'I' }, { value: 'II' }, { value: 'III' }, { value: 'IV' }],
      rules: [{ id: 'nyha', regex: `(?:NYHA|心功能)[^。；\\n]{0,8}?(?<v>${ROMAN_RE})\\s*级`, map: ROMAN }] },
    lab('B5', 'lvef', 'B', 'P0', { alt: [{ id: 'lvef-fraction', regex: '(?:LVEF|左室射血分数|左心室射血分数|射血分数|EF值?)[^。；;\\n\\d]{0,12}?(?<v>0\\.\\d{1,2})(?!\\d)', factor: 100 }], definition: '超声心动图左室射血分数（%）；写成 0.45 的按 45% 记。' }),
    presence('B6', '室壁运动异常', 'B', 'P2', '超声示节段性室壁运动异常或室壁瘤。', ['节段性室壁运动异常', '室壁运动异常', '室壁运动减弱', '室壁瘤'], { granularity: 'encounter' }),

    /* C 心电图与冠脉评估 */
    presence('C1', 'ST 段抬高', 'C', 'P0', '心电图示 ST 段抬高。', ['ST段抬高', 'ST段弓背向上抬高', 'ST抬高', 'ST段上抬'], { granularity: 'encounter' }),
    presence('C2', 'ST 段压低／T 波改变', 'C', 'P1', '心电图示 ST 段压低、T 波倒置或 ST-T 改变。', ['ST段压低', 'ST压低', 'ST段下移', 'T波倒置', 'ST-T改变', 'T波低平'], { granularity: 'encounter' }),
    listOf('C3', '冠脉造影病变血管', 'C', 'P0', '冠脉造影（或 CTA）示有意义狭窄（≥50%）或闭塞的血管。', [['左主干', 'LM'], ['前降支', 'LAD'], ['回旋支', 'LCX'], ['右冠状动脉', 'RCA', '右冠'], ['对角支'], ['钝缘支'], ['中间支']], { granularity: 'encounter', sources: { sections: ['所见', '结论', '诊疗经过', '现病史', '手术经过', '正文', '辅助检查', '病程记录'] } }),
    enumOf('C4', '病变支数', 'C', 'P1', '冠脉病变支数（单支／双支／三支）或左主干病变。', [['单支病变', '单支血管病变'], ['双支病变', '双支血管病变', '两支病变'], ['三支病变', '三支血管病变', '多支病变'], ['左主干病变', '左主干合并三支病变']], { granularity: 'encounter', pick: 'last' }),
    measure('C5', '最重狭窄程度', 'C', 'P1', '狭窄(?:程度)?(?:约|达)?', { unit: '%', range: { min: 10, max: 100 }, value: '\\d{2,3}(?=\\s*%)', granularity: 'encounter', pick: 'max', definition: '冠脉造影／CTA 写明的狭窄百分比，取本次最重；完全闭塞记 100。', alt: [{ id: 'occl', regex: '(?:完全闭塞|100%闭塞|闭塞性病变)', value: 100 }] }),
    scale('C6', 'SYNTAX 评分', 'C', 'P2', 'SYNTAX', { min: 0, max: 100 }),
    enumOf('C7', '运动负荷试验', 'C', 'P2', '运动平板（负荷）试验结果。', [['阳性', '平板运动试验阳性', '运动平板试验阳性', '平板试验阳性', '运动负荷试验阳性'], ['阴性', '平板运动试验阴性', '运动平板试验阴性', '平板试验阴性', '运动负荷试验阴性']], { selfTerm: false, granularity: 'patient', pick: 'last' }),

    /* D 再灌注与血运重建 */
    presence('D1', '本次 PCI', 'D', 'P0', '本次住院／就诊行经皮冠状动脉介入治疗（支架、球囊）。', ['PCI', '经皮冠状动脉介入', '冠脉支架植入', '支架植入术', '冠状动脉支架植入', '球囊扩张', 'PTCA', '直接PCI', 'pPCI'], { granularity: 'encounter' }),
    presence('D2', 'PCI／CABG 史', 'D', 'P0', '既往冠脉介入或搭桥史。', ['PCI', '冠脉支架', '支架植入', 'CABG', '冠状动脉旁路移植', '搭桥'], { accept: ['既往'], granularity: 'patient' }),
    measure('D3', '植入支架数', 'D', 'P1', '支架', { unit: '枚', range: { min: 1, max: 12 }, value: '\\d{1,2}(?=\\s*(?:枚|个|根|只))', granularity: 'encounter', pick: 'max', alt: [{ id: 'stent-n2', regex: '(?<v>\\d{1,2})\\s*(?:枚|个|根|只)\\s*(?:药物洗脱|药物涂层)?\\s*支架' }] }),
    listOf('D4', '支架／球囊类型', 'D', 'P2', '药物洗脱支架、药物涂层球囊等。', [['药物洗脱支架', 'DES', '药物支架'], ['药物涂层球囊', 'DCB', '药物球囊'], ['裸金属支架', 'BMS'], ['生物可吸收支架', 'BRS']], { granularity: 'encounter' }),
    presence('D5', '本次 CABG', 'D', 'P1', '本次行冠状动脉旁路移植术。', ['冠状动脉旁路移植', 'CABG', '冠脉搭桥', '搭桥术', 'OPCAB'], { granularity: 'encounter' }),
    presence('D6', '静脉溶栓', 'D', 'P0', '本次 STEMI 静脉溶栓。', ['静脉溶栓', '溶栓治疗', '尿激酶原', '阿替普酶', '替奈普酶', '瑞替普酶', '重组人尿激酶原'], { granularity: 'encounter' }),
    measure('D7', '门-球时间（D2B，分钟）', 'D', 'P1', 'D2B|D-to-B|DTB|门球时间|门-球时间|入门至球囊(?:扩张)?(?:时间)?', { unit: 'min', range: { min: 5, max: 1440 }, granularity: 'encounter' }),
    measure('D8', '首次医疗接触至导丝通过（分钟）', 'D', 'P2', 'FMC-?to-?(?:wire|W)|FMC2W|首次医疗接触至导丝通过(?:时间)?', { unit: 'min', range: { min: 5, max: 1440 }, granularity: 'encounter' }),
    enumOf('D9', '术后 TIMI 血流', 'D', 'P2', 'PCI 后罪犯血管 TIMI 血流分级（0–3 级）。', [['3级'], ['2级'], ['1级'], ['0级']], { selfTerm: false, granularity: 'encounter', pick: 'last', rules: [{ id: 'timi', regex: 'TIMI\\s*(?:血流)?\\s*(?<v>[0-3])\\s*级', map: { 0: '0级', 1: '1级', 2: '2级', 3: '3级' } }] }),

    /* E 药物治疗 */
    drugList('E1', '抗血小板药', 'E', 'P0', '在用或出院带的抗血小板药（双抗写两条）；含静脉 GP IIb/IIIa 抑制剂。', ['antiplatelet', [['替罗非班', '欣维宁'], ['依替巴肽']]]),
    presence('E2', '双联抗血小板（DAPT）', 'E', 'P1', '阿司匹林联合 P2Y12 抑制剂。', ['双抗', '双联抗血小板', 'DAPT'], { granularity: 'encounter' }),
    drugList('E3', '他汀类', 'E', 'P0', '在用或出院带的他汀类。', ['statin']),
    drugList('E4', '非他汀调脂药', 'E', 'P1', '依折麦布、PCSK9 抑制剂等。', [[['依折麦布', '益适纯'], ['依洛尤单抗', '瑞百安'], ['阿利西尤单抗', '波立达'], ['英克司兰', '乐可为'], ['托莱西单抗'], ['海博麦布'], ['二十碳五烯酸乙酯', 'IPE'], ['非诺贝特', '力平之']]]),
    drugList('E5', 'β 受体阻滞剂', 'E', 'P0', '在用或出院带的 β 受体阻滞剂。', ['bb']),
    drugList('E6', 'ACEI／ARB／ARNI', 'E', 'P0', '在用或出院带的 RAS 抑制剂。', ['acei', 'arb']),
    drugList('E7', '抗心绞痛药', 'E', 'P1', '硝酸酯类及其他抗心绞痛药。', [[['硝酸甘油'], ['单硝酸异山梨酯', '欣康', '依姆多'], ['硝酸异山梨酯', '消心痛'], ['尼可地尔', '喜格迈'], ['曲美他嗪', '万爽力'], ['雷诺嗪'], ['伊伐布雷定']]]),
    drugList('E8', '抗凝药', 'E', 'P1', '在用抗凝药（围术期或合并房颤等）。', ['anticoag', [['比伐芦定', '泰加宁'], ['普通肝素', '肝素钠']]]),
    drugList('E9', 'SGLT2 抑制剂', 'E', 'P2', 'SGLT2 抑制剂。', ['sglt2']),

    /* F 危险因素 */
    hx('F1', '高血压', 'F', 'P0', '高血压病史。', ['高血压']),
    hx('F2', '糖尿病', 'F', 'P0', '糖尿病病史。', ['糖尿病', '2型糖尿病']),
    hx('F3', '血脂异常', 'F', 'P0', '高脂血症／血脂异常。', ['高脂血症', '血脂异常', '高胆固醇血症', '高甘油三酯血症', '家族性高胆固醇血症']),
    smoking('F4', 'F', 'P0'),
    fhx('F5', '早发冠心病家族史', 'F', 'P1', '一级亲属早发冠心病或心肌梗死、猝死。', ['冠心病', '心肌梗死', '心梗', '猝死']),
    hx('F6', '慢性肾脏病', 'F', 'P1', '慢性肾脏病或肾功能不全。', ['慢性肾脏病', 'CKD', '肾功能不全', '慢性肾衰竭']),
    hx('F7', '既往脑卒中', 'F', 'P1', '脑梗死、脑出血或 TIA 病史。', ['脑梗死', '脑梗塞', '脑出血', '脑卒中', 'TIA', '短暂性脑缺血发作'], { accept: ['既往'] }),
    hx('F8', '肥胖', 'F', 'P2', '肥胖或超重。', ['肥胖', '超重', '中心性肥胖']),

    /* G 并发症与结局 */
    presence('G1', '心力衰竭', 'G', 'P0', '本次住院心力衰竭或急性左心衰。', ['心力衰竭', '心衰', '急性左心衰', '心功能不全', '肺水肿'], { granularity: 'encounter' }),
    presence('G2', '恶性心律失常／心脏骤停', 'G', 'P0', '室性心动过速、心室颤动或心脏骤停。', ['室颤', '心室颤动', '室速', '室性心动过速', '心脏骤停', '心搏骤停', '电除颤'], { granularity: 'encounter' }),
    presence('G3', '心源性休克', 'G', 'P0', '心源性休克。', ['心源性休克'], { granularity: 'encounter' }),
    presence('G4', '出血事件', 'G', 'P1', '消化道出血、颅内出血、穿刺部位出血等（BARC 出血）。', ['消化道出血', '上消化道出血', '颅内出血', '穿刺部位出血', '穿刺点出血', '腹膜后血肿', 'BARC'], { granularity: 'encounter' }),
    presence('G5', '支架内再狭窄／血栓', 'G', 'P1', '支架内再狭窄或支架内血栓。', ['支架内再狭窄', '支架内血栓', 'ISR', '支架血栓'], { granularity: 'patient', accept: HX }),
    presence('G6', '机械并发症', 'G', 'P2', '室间隔穿孔、乳头肌断裂、心脏破裂等。', ['室间隔穿孔', '乳头肌断裂', '乳头肌功能不全', '心脏破裂', '游离壁破裂'], { granularity: 'encounter' }),
    death('G7', 'G', 'P0'),
    los('G8', 'G', 'P1'),
    presence('G9', '心脏康复', 'G', 'P2', '参加或转介心脏康复。', ['心脏康复', '心脏康复治疗', 'Ⅰ期心脏康复', 'II期心脏康复'], { granularity: 'encounter', accept: ['阳性', '计划'] }),
    ageNow('G10', 'G', 'P0', '入院年龄'),
    chief('G11', 'G', 'P1'),

    /* K 检验与生命体征 */
    measure('K1', '肌钙蛋白', 'K', 'P0', 'hs-?cTn[IT]?|cTn[IT]|TnI|TnT|(?:高敏)?肌钙蛋白[IT]?', { unit: null, range: { min: 0, max: 100000 }, definition: '心肌肌钙蛋白（I 或 T，含高敏）的测定值；单位随原文。' }),
    measure('K2', 'CK-MB', 'K', 'P1', 'CK-?MB|肌酸激酶同工酶', { unit: 'U/L', range: { min: 0, max: 5000 } }),
    lab('K3', 'ldl', 'K', 'P0'),
    lab('K4', 'ntprobnp', 'K', 'P1'),
    lab('K5', 'scr', 'K', 'P1'),
    lab('K6', 'hba1c', 'K', 'P2'),
    sbp('K7', 'K', 'P1', '收缩压'),
    hr('K8', 'K', 'P1'),
    lab('K9', 'tc', 'K', 'P2'),
  ],
}
