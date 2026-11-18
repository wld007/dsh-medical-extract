/**
 * 骨质疏松症。
 * 依据：原发性骨质疏松症诊疗指南（2022）（中华医学会骨质疏松和骨矿盐疾病分会）；中国老年骨质疏松症诊疗指南（2023）；
 * 骨质疏松性骨折诊疗指南（2022）。诊断：DXA 腰椎／股骨颈／全髋 T 值 ≤−2.5，或髋部／椎体脆性骨折，
 * 或骨量减少（−2.5<T<−1.0）伴肱骨近端、骨盆或前臂远端脆性骨折；T 值 ≤−2.5 伴脆性骨折为严重骨质疏松。
 * 字段范围参考古脉 G-MPAS「骨质疏松专病」数据集目录。
 */
import { HX, ageNow, chief, drugList, dxList, enumOf, fhx, hx, icd, lab, listOf, measure, presence, smoking, drinking } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
const DXA = ['所见', '结论', '骨密度', '辅助检查', '现病史', '正文', '诊断']
/** T 值：负号写法（-、－、−、负）都认 */
const tscore = (id, name, site, priority) => ({
  id, name, group: 'B', priority, type: 'number', granularity: 'timepoint', unit: 'SD', range: { min: -7, max: 5 },
  definition: `DXA ${name}（每次检查一条；负号原样保留）。`, sources: { sections: DXA },
  rules: [
    { id: `${id.toLowerCase()}-t`, regex: `(?:${site})[^。；;\\n，,]{0,16}?T\\s*值?\\s*(?:评分|分值)?\\s*[:：=为]?\\s*(?<v>-?\\d(?:\\.\\d{1,2})?)` },
    // 全角负号（－、−、负）：捕获数字，乘 −1
    { id: `${id.toLowerCase()}-tneg`, regex: `(?:${site})[^。；;\\n，,]{0,16}?T\\s*值?\\s*(?:评分|分值)?\\s*[:：=为]?\\s*[－−负]\\s*(?<v>\\d(?:\\.\\d{1,2})?)`, factor: -1 },
  ],
  recall: { regex: [`(?:${site})[^。；;\\n，,]{0,16}?T\\s*值?`] },
})

export default {
  format: 'extract-template/1',
  id: 'op',
  name: '骨质疏松症（OP）',
  version: '0.1.0',
  domain: '内分泌',
  description: '骨质疏松研究与随访常用字段：诊断与类型、DXA 腰椎／股骨颈／全髋 T 值、脆性骨折部位、FRAX 与 OSTA、跌倒风险、危险因素（绝经、糖皮质激素、父母髋骨折等）、继发性病因、钙剂与维生素 D、双膦酸盐／地舒单抗／特立帕肽等抗骨松药物、骨转换标志物与血钙磷。',
  references: [
    { title: '原发性骨质疏松症诊疗指南（2022），中国全科医学 2023;26(14)' },
    { title: '中国老年骨质疏松症诊疗指南（2023），中华骨与关节外科杂志 2023;16(10)' },
    { title: '骨质疏松性骨折诊疗指南（2022），中华骨科杂志 2022;42(22)' },
    { title: 'FRAX® 骨折风险评估工具；OSTA 亚洲人骨质疏松自我筛查工具' },
    { title: '古脉 G-MPAS 数据目录：骨质疏松专病（字段范围参考）', url: 'https://www.g-mpas.com/data.html' },
  ],
  groups: [
    { id: 'A', name: '诊断与分型' }, { id: 'B', name: '骨密度' }, { id: 'C', name: '骨折' }, { id: 'D', name: '风险评估' },
    { id: 'E', name: '危险因素与继发病因' }, { id: 'F', name: '治疗' }, { id: 'K', name: '检验' },
  ],
  fields: [
    /* A 诊断与分型 */
    dxList('A1', '骨质疏松相关诊断', 'A', 'P0', '诊断栏写明的骨质疏松、骨量减少、骨质疏松性骨折诊断（原文写法）。', '骨质疏松|骨量减少|骨量低下|骨质减少', ['骨质疏松', '骨量减少', '骨量低下', '骨质减少']),
    icd('A1c', 'ICD-10 编码（M80–M82）', 'A', 'P0', '骨质疏松编码（M80 伴病理骨折、M81 不伴病理骨折）。', 'M8[0-2]'),
    // "骨质疏松性骨折风险"不是诊断；"严重骨质疏松"另成一类
    { id: 'A2', name: '骨量状态', group: 'A', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'last', definition: '按 DXA 或诊断写明的骨量状态。', sources: { sections: [...DX, ...DXA] },
      options: [{ value: '严重骨质疏松', terms: ['严重骨质疏松', '重度骨质疏松'] }, { value: '骨质疏松', regex: ['(?<!严重|重度)骨质疏松(?!性)'] }, { value: '骨量减少', terms: ['骨量减少', '骨量低下', '骨质减少', '低骨量'] }, { value: '骨量正常', terms: ['骨量正常', '骨密度正常'] }] },
    enumOf('A3', '类型', 'A', 'P1', '原发性（绝经后、老年性、特发性）或继发性。', [['绝经后骨质疏松', '绝经后骨质疏松症', 'PMOP', 'Ⅰ型骨质疏松'], ['老年性骨质疏松', '老年骨质疏松', 'Ⅱ型骨质疏松'], ['特发性骨质疏松'], ['继发性骨质疏松', '糖皮质激素性骨质疏松', 'GIOP', '激素性骨质疏松']], { granularity: 'patient', pick: 'mode' }),

    /* B 骨密度 */
    tscore('B1', '腰椎 T 值', '腰椎|L1\\s*-\\s*L4|L1-4|L1～L4|L1~L4', 'P0'),
    tscore('B2', '股骨颈 T 值', '股骨颈', 'P0'),
    tscore('B3', '全髋 T 值', '全髋|髋部总体|全髋关节|左髋|右髋|总髋', 'P1'),
    { id: 'B4', name: '最低 T 值', group: 'B', priority: 'P0', type: 'number', granularity: 'timepoint', unit: 'SD', range: { min: -7, max: 5 }, pick: 'min',
      definition: '骨密度报告中写的 T 值（任何部位），汇总取最低。', sources: { sections: DXA },
      rules: [{ id: 'tmin', regex: '(?<![A-Za-z])T\\s*值\\s*(?:评分|分值)?\\s*[:：=为]?\\s*(?<v>-?\\d(?:\\.\\d{1,2})?)' }, { id: 'tmin-neg', regex: '(?<![A-Za-z])T\\s*值\\s*(?:评分|分值)?\\s*[:：=为]?\\s*[－−负]\\s*(?<v>\\d(?:\\.\\d{1,2})?)', factor: -1 }], recall: { regex: ['(?<![A-Za-z])T\\s*值'] } },
    measure('B5', '腰椎骨密度（g/cm²）', 'B', 'P2', '腰椎(?:骨密度|BMD)', { unit: 'g/cm²', range: { min: 0.2, max: 2 }, value: '[0-2]\\.\\d{2,3}', sources: { sections: DXA } }),
    presence('B6', 'DXA 检查', 'B', 'P2', '做过双能 X 线骨密度检查。', ['DXA', 'DEXA', '双能X线', '骨密度检查', '骨密度测定'], { granularity: 'encounter', accept: ['阳性', '既往', '计划'] }),

    /* C 骨折 */
    presence('C1', '脆性骨折史', 'C', 'P0', '低能量（站立高度跌倒或更低）所致骨折。', ['脆性骨折', '骨质疏松性骨折', '低能量骨折', '轻微外伤后骨折', '病理性骨折'], { granularity: 'patient', accept: HX }),
    // "髋部骨折风险"（FRAX）不是骨折
    { id: 'C2', name: '骨折部位', group: 'C', priority: 'P0', type: 'list', granularity: 'patient', accept: HX, definition: '骨质疏松性骨折部位。', options: [
      { value: '椎体骨折', terms: ['椎体骨折', '椎体压缩性骨折', '压缩性骨折', '腰椎压缩性骨折', '胸椎压缩性骨折', '椎体压缩骨折'] },
      { value: '髋部骨折', terms: ['股骨颈骨折', '股骨粗隆间骨折', '股骨转子间骨折'], regex: ['髋部骨折(?!风险|概率)'] },
      { value: '桡骨远端骨折', terms: ['桡骨远端骨折', 'Colles骨折', '腕部骨折'] }, { value: '肱骨近端骨折', terms: ['肱骨近端骨折', '肱骨外科颈骨折'] },
      { value: '骨盆骨折', terms: ['骨盆骨折'] }, { value: '肋骨骨折', terms: ['肋骨骨折'] },
    ] },
    measure('C3', '椎体骨折个数', 'C', 'P2', '椎体(?:压缩性?)?骨折', { unit: '个', range: { min: 1, max: 20 }, gap: 8, value: '\\d{1,2}(?=\\s*(?:个|处|节))', granularity: 'patient', pick: 'max', accept: HX }),
    presence('C4', '新发骨折', 'C', 'P0', '本次（治疗随访中）新发骨折。', ['新发骨折', '再骨折', '再次骨折', '新发椎体骨折'], { granularity: 'encounter' }),
    listOf('C5', '骨折手术／处理', 'C', 'P1', '骨质疏松性骨折的手术或处理。', [['椎体成形术', 'PVP', '经皮椎体成形'], ['椎体后凸成形术', 'PKP', '经皮椎体后凸成形'], ['髋关节置换', '人工股骨头置换', '全髋关节置换'], ['内固定', '切开复位内固定', 'PFNA', '髓内钉'], ['保守治疗', '卧床制动', '支具固定']], { granularity: 'encounter', accept: HX }),
    presence('C6', '腰背痛', 'C', 'P1', '腰背疼痛、身高变矮或驼背。', ['腰背痛', '腰背部疼痛', '腰痛', '背痛', '身高变矮', '身高缩短', '驼背']),

    /* D 风险评估 */
    measure('D1', 'FRAX 主要骨质疏松性骨折风险', 'D', 'P0', 'FRAX[^。；;\\n]{0,10}?主要(?:骨质疏松性)?骨折(?:风险|概率)?|主要骨质疏松性骨折(?:风险|概率)', { unit: '%', range: { min: 0, max: 100 }, value: '\\d{1,2}(?:\\.\\d{1,2})?(?=\\s*%)', granularity: 'encounter', pick: 'last' }),
    measure('D2', 'FRAX 髋部骨折风险', 'D', 'P0', 'FRAX[^。；;\\n]{0,10}?髋部骨折(?:风险|概率)?|髋部骨折(?:风险|概率)', { unit: '%', range: { min: 0, max: 100 }, value: '\\d{1,2}(?:\\.\\d{1,2})?(?=\\s*%)', granularity: 'encounter', pick: 'last' }),
    { id: 'D3', name: 'OSTA 指数', group: 'D', priority: 'P2', type: 'number', granularity: 'timepoint', range: { min: -30, max: 30 }, definition: 'OSTA 指数（(体重−年龄)×0.2）。',
      rules: [{ id: 'osta', regex: 'OSTA\\s*(?:指数|评分)?\\s*[:：=为]?\\s*(?<v>-?\\d{1,2}(?:\\.\\d)?)' }, { id: 'osta-neg', regex: 'OSTA\\s*(?:指数|评分)?\\s*[:：=为]?\\s*[－−负]\\s*(?<v>\\d{1,2}(?:\\.\\d)?)', factor: -1 }], recall: { regex: ['OSTA'] } },
    presence('D4', '跌倒史', 'D', 'P0', '近 1 年跌倒史或反复跌倒。', ['跌倒', '摔倒', '跌伤', '摔伤', '跌倒史'], { granularity: 'patient', accept: HX }),
    enumOf('D5', '跌倒风险', 'D', 'P2', '跌倒风险评估等级。', [['高风险', '跌倒高风险', '高危跌倒'], ['中风险', '跌倒中风险'], ['低风险', '跌倒低风险']], { selfTerm: false, granularity: 'encounter', pick: 'last' }),
    presence('D6', '骨折极高风险', 'D', 'P1', '医生写明骨折极高风险（需优先促骨形成药）。', ['骨折极高风险', '极高骨折风险', '极高危'], { granularity: 'encounter' }),

    /* E 危险因素与继发病因 */
    enumOf('E1', '绝经状态', 'E', 'P0', '女性月经状态。', [['绝经前', '绝经前', '未绝经', '月经规律'], ['围绝经期', '围绝经期', '围绝经'], ['绝经后', '绝经后', '已绝经', '自然绝经', '人工绝经']], { selfTerm: false, granularity: 'patient', pick: 'last', accept: HX }),
    hx('E2', '长期糖皮质激素使用', 'E', 'P0', '长期（≥3 个月）口服糖皮质激素。', ['长期服用激素', '长期使用激素', '长期口服激素', '长期糖皮质激素', '长期服用泼尼松', '长期服用甲泼尼龙']),
    fhx('E3', '父母髋部骨折史', 'E', 'P1', '父母髋部骨折。', ['髋部骨折', '股骨颈骨折', '股骨粗隆间骨折']),
    smoking('E4', 'E', 'P1'),
    drinking('E5', 'E', 'P1'),
    lab('E6', 'bmi', 'E', 'P1'),
    listOf('E7', '继发性病因', 'E', 'P1', '可致继发性骨质疏松的疾病。', [['类风湿关节炎'], ['甲状腺功能亢进', '甲亢'], ['甲状旁腺功能亢进', '甲旁亢'], ['糖尿病'], ['慢性肾脏病', 'CKD', '肾功能不全'], ['性腺功能减退'], ['库欣综合征'], ['多发性骨髓瘤'], ['慢性肝病', '肝硬化'], ['吸收不良', '胃大部切除', '炎症性肠病']], { granularity: 'patient', accept: HX }),
    drugList('E8', '影响骨代谢药物', 'E', 'P2', '可致骨量丢失的药物。', [[['芳香化酶抑制剂', '来曲唑', '阿那曲唑', '依西美坦'], ['质子泵抑制剂', '奥美拉唑', '泮托拉唑', '雷贝拉唑', '艾司奥美拉唑'], ['肝素'], ['抗癫痫药', '苯妥英钠', '卡马西平'], ['GnRH激动剂', '戈舍瑞林', '亮丙瑞林'], ['噻唑烷二酮', '吡格列酮']]], { accept: HX }),

    /* F 治疗 */
    { id: 'F1', name: '钙剂与维生素 D', group: 'F', priority: 'P0', type: 'list', granularity: 'encounter', accept: HX, definition: '基础补充：钙剂、普通维生素 D 与活性维生素 D（"25羟维生素D"是检验，不算）。', options: [
      { value: '碳酸钙', terms: ['碳酸钙', '钙尔奇', '钙尔奇D', '碳酸钙D3'] }, { value: '枸橼酸钙', terms: ['枸橼酸钙'] }, { value: '葡萄糖酸钙', terms: ['葡萄糖酸钙'] },
      { value: '维生素D3', terms: ['胆骨化醇'], regex: ['(?<!羟基?|羟化|25-?\\s*(?:\\(OH\\)|（OH）)?\\s*-?\\s*)维生素\\s*D[23]?'] },
      { value: '骨化三醇', terms: ['骨化三醇', '罗盖全'] }, { value: '阿法骨化醇', terms: ['阿法骨化醇', '阿法D3', '依安凡'] }, { value: '艾地骨化醇', terms: ['艾地骨化醇'] },
    ] },
    drugList('F2', '双膦酸盐', 'F', 'P0', '口服或静脉双膦酸盐。', [[['阿仑膦酸钠', '福善美', '固邦'], ['唑来膦酸', '密固达', '择泰', '依固'], ['利塞膦酸钠', '安妥良'], ['伊班膦酸钠', '邦罗力'], ['米诺膦酸']]], { accept: HX }),
    drugList('F3', '其他抗骨松药物', 'F', 'P0', 'RANKL 抑制剂、促骨形成药、SERM、降钙素、雌激素等。', [[['地舒单抗', '普罗力', '迪诺塞麦'], ['特立帕肽', '复泰奥', '欣复泰'], ['阿巴洛肽'], ['罗莫佐单抗', '罗莫单抗'], ['雷洛昔芬', '易维特'], ['巴多昔芬'], ['鲑鱼降钙素', '密钙息'], ['依降钙素', '益盖宁'], ['雌激素', '戊酸雌二醇', '替勃龙', '利维爱'], ['四烯甲萘醌', '维生素K2', '固力康']]], { accept: HX }),
    presence('F4', '药物假期', 'F', 'P2', '双膦酸盐治疗后的药物假期。', ['药物假期', '药物休息', '暂停双膦酸盐'], { granularity: 'encounter', accept: ['阳性', '计划'] }),
    listOf('F5', '药物不良反应', 'F', 'P1', '抗骨松药物不良反应。', [['急性期反应', '流感样症状', '发热'], ['低钙血症'], ['颌骨坏死', 'ONJ', '下颌骨坏死'], ['非典型股骨骨折', 'AFF'], ['上消化道不适', '反酸', '食管炎']], { granularity: 'encounter', model: 'always', recall: { terms: ['不良反应', '流感样', '发热', '低钙', '颌骨坏死', '非典型股骨骨折', '反酸'] } }),
    presence('F6', '防跌倒干预', 'F', 'P2', '防跌倒宣教、运动处方或康复训练。', ['防跌倒', '预防跌倒', '平衡训练', '抗阻训练', '运动处方'], { granularity: 'encounter', accept: ['阳性', '计划'] }),

    /* K 检验 */
    measure('K1', '25-羟维生素 D', 'K', 'P0', '25-?(?:\\(OH\\)|（OH）)?\\s*-?\\s*(?:羟基?)?(?:维生素\\s*D|VitD|VD)(?:3)?|25-?OH-?D', { unit: 'ng/mL', range: { min: 1, max: 200 } }),
    measure('K2', '血钙', 'K', 'P0', '血钙|血清钙|总钙|(?<![\\u4e00-\\u9fff])钙(?![\\u4e00-\\u9fff])|(?<![A-Za-z])Ca(?![A-Za-z])', { unit: 'mmol/L', range: { min: 1, max: 4.5 }, value: '[1-4]\\.\\d{1,2}' }),
    measure('K3', '血磷', 'K', 'P1', '血磷|血清磷|无机磷|(?<![\\u4e00-\\u9fff])磷(?![\\u4e00-\\u9fff])', { unit: 'mmol/L', range: { min: 0.2, max: 5 }, value: '[0-4]\\.\\d{1,2}' }),
    measure('K4', '甲状旁腺激素（PTH）', 'K', 'P1', 'iPTH|PTH|甲状旁腺(?:激)?素', { unit: 'pg/mL', range: { min: 1, max: 5000 } }),
    measure('K5', '碱性磷酸酶', 'K', 'P1', 'ALP|AKP|碱性磷酸酶', { unit: 'U/L', range: { min: 5, max: 3000 } }),
    measure('K6', 'β-CTX', 'K', 'P1', 'β-?CTX|S-?CTX|CTX|β胶原降解产物|Ⅰ型胶原C端肽|I型胶原羧基端肽', { unit: 'ng/mL', range: { min: 0, max: 10 } }),
    measure('K7', 'P1NP', 'K', 'P1', 'P1NP|PINP|tP1NP|总Ⅰ型胶原氨基端延长肽|I型前胶原氨基端前肽', { unit: 'ng/mL', range: { min: 0, max: 2000 } }),
    lab('K8', 'scr', 'K', 'P2'),
    ageNow('K9', 'K', 'P0'),
    chief('K10', 'K', 'P1'),
  ],
}
