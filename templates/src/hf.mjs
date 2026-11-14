/**
 * 心力衰竭。
 * 依据：中国心力衰竭诊断和治疗指南 2024（中华心血管病杂志 2024;52(3)）；ESC 2021 心衰指南及 2023 重点更新；
 * AHA/ACC/HFSA 2022 心衰指南。LVEF 分型：HFrEF ≤40%，HFmrEF 41%–49%，HFpEF ≥50%。
 */
import { HX, derived, enumOf, listOf, measure, presence, scale, text } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
const LVEF = '(?:LVEF|左室射血分数|左心室射血分数|射血分数|EF值?)'

export default {
  format: 'extract-template/1',
  id: 'hf',
  name: '心力衰竭（HF）',
  version: '0.1.0',
  domain: '心血管',
  description: '心衰研究与质控常用字段：心衰分型（按 LVEF）、NYHA 心功能、病因、诱因、超声与利钠肽、指南导向药物治疗（"新四联"）、器械治疗、合并症、住院结局与关键检验。',
  references: [
    { title: '中国心力衰竭诊断和治疗指南 2024，中华心血管病杂志 2024;52(3):235-275', url: 'https://www.hnysfww.com/data/article/1710983533716760047.pdf' },
    { title: '2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure; 2023 Focused Update' },
    { title: '2022 AHA/ACC/HFSA Guideline for the Management of Heart Failure' },
  ],
  documents: { excludeRecordTypes: ['门诊收费', '基本信息'] },
  groups: [
    { id: 'A', name: '诊断与分型' }, { id: 'B', name: '心功能与症状体征' }, { id: 'C', name: '病因与诱因' }, { id: 'D', name: '超声与利钠肽' },
    { id: 'E', name: '药物治疗' }, { id: 'F', name: '器械与手术' }, { id: 'G', name: '合并症' }, { id: 'H', name: '结局' }, { id: 'K', name: '检验与生命体征' },
  ],
  fields: [
    /* A 诊断与分型 */
    { id: 'A1', name: '心衰相关诊断', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: '诊断栏写明的心力衰竭诊断（原文写法）。', sources: { sections: DX }, rules: [{ id: 'dx', regex: '(?<v>[^\\n，,。；;：:]{0,14}(?:心力衰竭|心衰|心功能不全)[^\\n，,。；;：:]{0,14})' }], recall: { terms: ['心力衰竭', '心衰', '心功能不全'] } },
    { id: 'A1c', name: 'ICD-10 编码（I50/I11.0/I13）', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: '心衰相关编码。', rules: [{ id: 'icd', regex: '(?<v>(?:I50|I11\\.0|I13\\.[02])(?:\\.\\d{1,3})?)' }], recall: { regex: ['I50', 'I11\\.0', 'I13'] } },
    enumOf('A2', '心衰分型（按 LVEF）', 'A', 'P0', '射血分数降低（HFrEF）、轻度降低（HFmrEF）、保留（HFpEF）、改善（HFimpEF）。', [
      ['HFrEF', '射血分数降低的心衰', '射血分数降低型心力衰竭', '射血分数降低的心力衰竭'], ['HFmrEF', '射血分数轻度降低', '射血分数中间值'], ['HFpEF', '射血分数保留的心衰', '射血分数保留型心力衰竭', '射血分数保留的心力衰竭'], ['HFimpEF', '射血分数改善'],
    ], { granularity: 'encounter', pick: 'last' }),
    derived('A3', 'LVEF ≤40%（按末次 LVEF）', 'A', 'P0', '末次 LVEF ≤40%（HFrEF 范围）。', { op: 'threshold', field: 'D1', cmp: '<=', value: 40 }, { granularity: 'encounter' }),
    enumOf('A4', '急慢性', 'A', 'P1', '急性心衰、慢性心衰急性失代偿或慢性心衰。', [['急性心衰', '急性心力衰竭', '急性左心衰', '急性左心衰竭'], ['慢性心衰急性失代偿', '急性失代偿', '慢性心力衰竭急性加重', '慢性心衰急性加重'], ['慢性心衰', '慢性心力衰竭', '慢性心功能不全']], { granularity: 'encounter', pick: 'last' }),
    enumOf('A5', '左心／右心／全心', 'A', 'P2', '心衰部位。', [['左心衰', '左心衰竭', '左心功能不全'], ['右心衰', '右心衰竭', '右心功能不全'], ['全心衰', '全心衰竭']], { granularity: 'encounter' }),
    { id: 'A6', name: 'ACC/AHA 心衰分期', group: 'A', priority: 'P2', type: 'enum', granularity: 'encounter', definition: 'A–D 期。', options: [{ value: 'A期' }, { value: 'B期' }, { value: 'C期' }, { value: 'D期', terms: ['终末期心衰', '晚期心衰'] }],
      rules: [{ id: 'stage', regex: '(?:心衰|心力衰竭)\\s*(?<v>[A-D])\\s*期|(?<v2>[A-D])期心衰'.replace('(?<v2>', '(?:'), map: { A: 'A期', B: 'B期', C: 'C期', D: 'D期' } }] },

    /* B 心功能与症状体征 */
    // 选项不带写法（"3级"之类会误召回"高血压3级"），只靠规则捕获再映射
    { id: 'B1', name: 'NYHA 心功能分级', group: 'B', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'last', definition: 'NYHA I–IV 级。',
      options: [{ value: 'I' }, { value: 'II' }, { value: 'III' }, { value: 'IV' }],
      recall: { regex: ['(?:NYHA|心功能)[^。；\\n]{0,8}(?:[ⅠⅡⅢⅣ]|IV|III|II|I|[1-4])\\s*级'] },
      rules: [{ id: 'nyha', regex: '(?:NYHA|心功能)[^。；\\n]{0,8}?(?<v>Ⅳ|Ⅲ|Ⅱ|Ⅰ|IV|III|II|I|[1-4])\\s*级', map: { 'Ⅰ': 'I', 'Ⅱ': 'II', 'Ⅲ': 'III', 'Ⅳ': 'IV', 1: 'I', 2: 'II', 3: 'III', 4: 'IV' } }] },
    presence('B2', '呼吸困难', 'B', 'P0', '劳力性／夜间阵发性呼吸困难、端坐呼吸、气促。', ['呼吸困难', '气促', '气急', '胸闷气促', '活动后气短', '夜间阵发性呼吸困难', '端坐呼吸', '不能平卧']),
    presence('B3', '下肢水肿', 'B', 'P0', '双下肢或凹陷性水肿。', ['下肢水肿', '双下肢水肿', '下肢浮肿', '凹陷性水肿', '水肿']),
    presence('B4', '肺部湿啰音', 'B', 'P1', '查体闻及湿啰音。', ['湿啰音', '湿性啰音', '水泡音']),
    presence('B5', '颈静脉怒张', 'B', 'P2', '颈静脉怒张或肝颈静脉回流征阳性。', ['颈静脉怒张', '颈静脉充盈', '肝颈静脉回流征阳性']),
    scale('B6', 'KCCQ', 'B', 'P2', 'KCCQ|堪萨斯城心肌病问卷', { min: 0, max: 100 }),
    measure('B7', '6 分钟步行距离', 'B', 'P2', '6\\s*分钟步行(?:距离|试验)?|6MWD|6MWT', { unit: 'm', range: { min: 10, max: 1000 } }),

    /* C 病因与诱因 */
    enumOf('C1', '主要病因', 'C', 'P0', '心衰主要病因。', [
      ['缺血性心肌病', '缺血性心脏病'], ['高血压性心脏病', '高血压心脏病'], ['扩张型心肌病', 'DCM'], ['肥厚型心肌病', 'HCM'], ['瓣膜性心脏病', '风湿性心脏病', '瓣膜病'],
      ['心肌炎'], ['先天性心脏病'], ['心律失常性心肌病', '心动过速性心肌病'], ['淀粉样变', '心肌淀粉样变'], ['围产期心肌病'],
    ], { granularity: 'patient', pick: 'mode', sources: { sections: [...DX, '既往史', '现病史', '病例特点'] } }),
    listOf('C2', '本次诱因', 'C', 'P1', '本次心衰加重的诱因。', [['感染', '肺部感染', '上呼吸道感染', '受凉'], ['心律失常', '快速房颤'], ['急性冠脉综合征', '急性心肌梗死', 'ACS'], ['血压控制不佳', '高血压未控制'], ['依从性差', '自行停药', '未规律服药'], ['液体摄入过多', '饮水过多', '摄盐过多', '高盐饮食'], ['劳累', '过度劳累']], { granularity: 'encounter', model: 'always', recall: { terms: ['诱因', '受凉', '感冒', '劳累', '停药', '感染'] } }),

    /* D 超声与利钠肽 */
    measure('D1', 'LVEF', 'D', 'P0', LVEF, { unit: '%', range: { min: 5, max: 85 }, value: '\\d{1,2}(?:\\.\\d)?(?=\\s*%)', alt: [{ id: 'lvef-fraction', regex: `${LVEF}[^。；;\\n\\d]{0,12}?(?<v>0\\.\\d{1,2})(?!\\d)`, factor: 100 }], definition: '超声心动图左室射血分数（%）；写成 0.35 的按 35% 记。' }),
    measure('D2', 'LVEDD', 'D', 'P1', 'LVEDD|左室舒张末(?:期)?(?:内)?径|左心室舒张末(?:期)?(?:内)?径', { unit: 'mm', range: { min: 20, max: 100 } }),
    measure('D3', 'NT-proBNP', 'D', 'P0', 'NT-?pro-?BNP|N末端(?:B型)?(?:利钠肽|脑钠肽)前体|氨基末端脑钠肽前体', { unit: 'pg/mL', range: { min: 5, max: 70000 } }),
    measure('D4', 'BNP', 'D', 'P1', '(?<!pro-?|NT-?)BNP|B型(?:利钠肽|钠尿肽)|脑钠肽(?!前体)', { unit: 'pg/mL', range: { min: 1, max: 10000 } }),
    measure('D5', '肺动脉收缩压', 'D', 'P2', 'PASP|肺动脉收缩压|估测肺动脉压', { unit: 'mmHg', range: { min: 10, max: 150 } }),

    /* E 药物治疗 */
    listOf('E1', 'ARNI／ACEI／ARB', 'E', 'P0', '在用或出院带的 RAS 抑制剂。', [['沙库巴曲缬沙坦', '诺欣妥', 'ARNI'], ['依那普利'], ['培哚普利', '雅施达'], ['贝那普利', '洛汀新'], ['雷米普利'], ['卡托普利'], ['缬沙坦', '代文'], ['氯沙坦', '科素亚'], ['厄贝沙坦', '安博维'], ['坎地沙坦'], ['替米沙坦', '美卡素'], ['奥美沙坦']], { granularity: 'encounter' }),
    listOf('E2', 'β 受体阻滞剂', 'E', 'P0', '在用或出院带的 β 受体阻滞剂。', [['美托洛尔', '倍他乐克', '琥珀酸美托洛尔', '酒石酸美托洛尔'], ['比索洛尔', '康忻', '博苏'], ['卡维地洛', '络德'], ['奈必洛尔']], { granularity: 'encounter' }),
    listOf('E3', 'MRA', 'E', 'P0', '盐皮质激素受体拮抗剂。', [['螺内酯', '安体舒通'], ['依普利酮'], ['非奈利酮', '可申']], { granularity: 'encounter' }),
    listOf('E4', 'SGLT2 抑制剂', 'E', 'P0', 'SGLT2 抑制剂。', [['达格列净', '安达唐'], ['恩格列净', '欧唐静'], ['卡格列净', '怡可安'], ['恒格列净'], ['索格列净']], { granularity: 'encounter' }),
    listOf('E5', '利尿剂', 'E', 'P0', '袢利尿剂、噻嗪类、托伐普坦等。', [['呋塞米', '速尿'], ['托拉塞米'], ['布美他尼'], ['氢氯噻嗪'], ['托伐普坦', '苏麦卡']], { granularity: 'encounter' }),
    listOf('E6', '其他心衰药物', 'E', 'P1', '伊伐布雷定、地高辛、维立西呱、新活素、正性肌力药等。', [['伊伐布雷定', '可兰特'], ['地高辛'], ['维立西呱'], ['重组人脑利钠肽', '新活素', '奈西立肽'], ['左西孟旦'], ['多巴酚丁胺'], ['米力农'], ['去乙酰毛花苷', '西地兰']], { granularity: 'encounter' }),
    derived('E7', '是否使用 SGLT2i', 'E', 'P1', '本次就诊是否记录 SGLT2 抑制剂（种数）。', { op: 'countOf', field: 'E4' }, { granularity: 'encounter' }),
    listOf('E8', '抗凝药', 'E', 'P1', '在用抗凝药（合并房颤等）。', [['华法林'], ['达比加群'], ['利伐沙班', '拜瑞妥'], ['阿哌沙班'], ['艾多沙班']], { granularity: 'encounter' }),

    /* F 器械与手术 */
    presence('F1', 'ICD', 'F', 'P0', '植入式心律转复除颤器。', ['ICD', '植入式心律转复除颤器', '埋藏式心律转复除颤器'], { accept: HX, granularity: 'patient' }),
    presence('F2', 'CRT', 'F', 'P0', '心脏再同步化治疗（CRT-P/CRT-D）。', ['CRT', 'CRT-D', 'CRT-P', '心脏再同步化治疗', '三腔起搏器'], { accept: HX, granularity: 'patient' }),
    presence('F3', 'PCI／CABG 史', 'F', 'P1', '冠脉介入或搭桥史。', ['PCI', '冠脉支架', '支架植入', 'CABG', '冠状动脉旁路移植', '搭桥'], { accept: HX, granularity: 'patient' }),
    presence('F4', '左室辅助装置／心脏移植', 'F', 'P2', 'LVAD 或心脏移植。', ['LVAD', '左心室辅助装置', '心室辅助装置', '心脏移植'], { accept: HX, granularity: 'patient' }),

    /* G 合并症 */
    presence('G1', '心房颤动', 'G', 'P0', '心房颤动（含阵发性）。', ['心房颤动', '房颤', 'AF'], { accept: HX, granularity: 'patient' }),
    presence('G2', '高血压', 'G', 'P0', '高血压病史。', ['高血压'], { accept: HX, granularity: 'patient' }),
    presence('G3', '糖尿病', 'G', 'P0', '糖尿病病史。', ['糖尿病'], { accept: HX, granularity: 'patient' }),
    presence('G4', '慢性肾脏病', 'G', 'P0', '慢性肾脏病或肾功能不全。', ['慢性肾脏病', 'CKD', '肾功能不全', '慢性肾衰竭', '肾衰竭'], { accept: HX, granularity: 'patient' }),
    presence('G5', '冠心病', 'G', 'P0', '冠心病或心肌梗死。', ['冠心病', '冠状动脉粥样硬化性心脏病', '心肌梗死', '陈旧性心肌梗死'], { accept: HX, granularity: 'patient' }),
    presence('G6', 'COPD', 'G', 'P2', '慢性阻塞性肺疾病。', ['慢性阻塞性肺疾病', 'COPD', '慢阻肺'], { accept: HX, granularity: 'patient' }),
    presence('G7', '贫血', 'G', 'P2', '贫血或缺铁。', ['贫血', '缺铁'], { accept: HX, granularity: 'patient' }),

    /* H 结局 */
    presence('H1', '院内死亡', 'H', 'P0', '住院期间死亡。', ['死亡', '临床死亡', '宣告死亡', '抢救无效'], { granularity: 'encounter', sources: { sections: ['出院情况', '诊疗经过', '病程记录', '正文'] } }),
    measure('H2', '住院天数', 'H', 'P1', '住院(?:天数|日数)|共住院', { unit: '天', range: { min: 0, max: 365 }, granularity: 'encounter', pick: 'last', alt: [{ id: 'los-b', regex: '住院(?<v>\\d{1,3})\\s*天' }] }),
    measure('H3', '既往心衰住院次数', 'H', 'P1', '(?:心衰|心力衰竭)[^。；\\n]{0,10}?住院', { unit: '次', range: { min: 0, max: 50 }, granularity: 'patient', pick: 'max', accept: HX, value: '\\d{1,2}(?=\\s*次)' }),
    derived('H4', '入院年龄', 'H', 'P0', '本次就诊时年龄。', { op: 'ageAt', at: '$encounter.start' }, { granularity: 'encounter' }),
    measure('H5', '出院体重', 'H', 'P2', '(?:出院|干)?体重', { unit: 'kg', range: { min: 25, max: 250 }, value: '\\d{2,3}(?:\\.\\d)?(?=\\s*(?:kg|Kg|KG|公斤))' }),

    /* K 检验与生命体征 */
    measure('K1', '血钾', 'K', 'P0', '血钾|血清钾|项目：钾|(?<![a-zA-Z])K\\+?', { unit: 'mmol/L', range: { min: 1.5, max: 9 }, value: '\\d\\.\\d{1,2}' }),
    measure('K2', '血钠', 'K', 'P0', '血钠|血清钠|项目：钠|Na\\+?', { unit: 'mmol/L', range: { min: 100, max: 180 }, value: '1\\d{2}(?:\\.\\d+)?' }),
    measure('K3', '肌酐', 'K', 'P0', '肌酐|Scr|SCr|Cr(?![a-z])', { unit: 'μmol/L', range: { min: 10, max: 2500 } }),
    measure('K4', 'eGFR', 'K', 'P0', 'eGFR|估算肾小球滤过率|肾小球滤过率', { unit: 'mL/min/1.73m²', range: { min: 1, max: 200 } }),
    measure('K5', '血红蛋白', 'K', 'P1', '血红蛋白|Hb(?!A)|HGB', { unit: 'g/L', range: { min: 20, max: 250 } }),
    measure('K6', '心率', 'K', 'P1', '心率|HR|脉搏', { unit: '次/分', range: { min: 20, max: 250 }, value: '\\d{2,3}(?=\\s*次)' }),
    measure('K7', '收缩压', 'K', 'P1', '(?:BP|血压)\\s*[:：]?', { unit: 'mmHg', range: { min: 50, max: 280 }, value: '\\d{2,3}(?=\\s*/\\s*\\d{2,3})', definition: '血压记录中的收缩压（每次测量一条）。' }),
    measure('K8', '血清铁蛋白', 'K', 'P2', '铁蛋白', { unit: 'ng/mL', range: { min: 1, max: 5000 } }),
    measure('K9', '肌钙蛋白', 'K', 'P2', 'cTnI|cTnT|hs-?cTn[IT]?|肌钙蛋白', { unit: null, range: { min: 0, max: 100000 } }),
    text('K10', '主诉', 'K', 'P1', '本次就诊主诉原文。', { granularity: 'encounter', pick: 'first', sources: { sections: ['主诉'] }, rules: [{ id: 'chief', regex: '(?<v>[^\\n]{2,100})' }], recall: { regex: ['[^\\s]{2,}'] } }),
  ],
}
