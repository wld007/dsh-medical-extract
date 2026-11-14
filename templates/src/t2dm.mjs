/**
 * 2 型糖尿病。
 * 依据：中国糖尿病防治指南（2024 版）（中华医学会糖尿病学分会）；ADA Standards of Care in Diabetes—2025；
 * KDIGO 2022 糖尿病与 CKD 指南。诊断：HbA1c ≥6.5%、FPG ≥7.0 mmol/L、OGTT 2hPG 或随机血糖 ≥11.1 mmol/L。
 */
import { DUR, HX, date, derived, enumOf, listOf, measure, presence, text } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']

export default {
  format: 'extract-template/1',
  id: 't2dm',
  name: '2 型糖尿病（T2DM）',
  version: '0.1.0',
  domain: '内分泌',
  description: '糖尿病研究与质控常用字段：诊断与病程、血糖与代谢指标、慢性并发症（视网膜病变、肾病、神经病变、下肢动脉病变、糖尿病足）、大血管病、急性并发症与低血糖、降糖药物（含 SGLT2i、GLP-1RA、胰岛素）、合并症与危险因素。',
  references: [
    { title: '中国糖尿病防治指南（2024 版），中华糖尿病杂志 2025;17(1)', url: 'https://www.sxcdc.cn/jkfw/jsbz/art/2025/art_a6322e70d224461f900e02e70b2a937c.html' },
    { title: 'ADA Standards of Care in Diabetes—2025, Diabetes Care 2025;48(Suppl 1)', url: 'https://diabetesjournals.org/care/issue/48/Supplement_1' },
    { title: 'KDIGO 2022 Clinical Practice Guideline for Diabetes Management in CKD' },
  ],
  documents: { excludeRecordTypes: ['门诊收费', '基本信息'] },
  groups: [
    { id: 'A', name: '诊断与病程' }, { id: 'B', name: '血糖与代谢' }, { id: 'C', name: '微血管并发症' }, { id: 'D', name: '大血管与足' },
    { id: 'E', name: '急性并发症与低血糖' }, { id: 'F', name: '降糖治疗' }, { id: 'G', name: '心肾保护与合并用药' }, { id: 'H', name: '合并症与危险因素' }, { id: 'K', name: '其他检验与体征' },
  ],
  fields: [
    /* A 诊断与病程 */
    { id: 'A1', name: '糖尿病相关诊断', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: '诊断栏写明的糖尿病及其并发症诊断（原文写法）。', sources: { sections: DX }, rules: [{ id: 'dx', regex: '(?<v>[^\\n，,。；;：:]{0,14}糖尿病[^\\n，,。；;：:]{0,16})' }], recall: { terms: ['糖尿病'] } },
    { id: 'A1c', name: 'ICD-10 编码（E10–E14）', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: '糖尿病编码。', rules: [{ id: 'icd', regex: '(?<v>E1[0-4](?:\\.\\d{1,3})?)' }], recall: { regex: ['E1[0-4]'] } },
    enumOf('A2', '糖尿病类型', 'A', 'P0', '糖尿病分型。', [['2型糖尿病', 'T2DM', '2型', 'Ⅱ型糖尿病', 'II型糖尿病'], ['1型糖尿病', 'T1DM', 'Ⅰ型糖尿病', 'I型糖尿病'], ['妊娠期糖尿病', 'GDM'], ['特殊类型糖尿病', '继发性糖尿病', '类固醇糖尿病', 'MODY', '胰源性糖尿病']], { granularity: 'patient', pick: 'mode', sources: { sections: DX } }),
    date('A3', '糖尿病诊断时间', 'A', 'P0', '首次诊断糖尿病的时间；"发现血糖升高10年"取 10 年前。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', sources: { sections: ['主诉', '现病史', '既往史'] }, recall: { terms: ['糖尿病', '血糖升高', '血糖高', '发现血糖'], regex: [DUR] } }),
    derived('A4', '糖尿病病程（月）', 'A', 'P0', '诊断至本次就诊的月数。', { op: 'monthsBetween', from: 'A3', to: '$encounter.start' }, { granularity: 'encounter' }),
    derived('A5', '诊断年龄', 'A', 'P1', '糖尿病诊断时年龄。', { op: 'ageAt', at: 'A3' }, { granularity: 'patient' }),
    presence('A6', '血糖控制不佳', 'A', 'P1', '医生写明血糖控制不佳／未达标。', ['血糖控制不佳', '血糖控制差', '血糖控制欠佳', '血糖未达标', '血糖波动大'], { granularity: 'encounter' }),

    /* B 血糖与代谢 */
    measure('B1', '糖化血红蛋白', 'B', 'P0', 'HbA1c|HBA1C|糖化血红蛋白|A1C', { unit: '%', range: { min: 3, max: 20 } }),
    measure('B2', '空腹血糖', 'B', 'P0', '空腹血糖|FPG|FBG|空腹葡萄糖|空腹血浆葡萄糖', { unit: 'mmol/L', range: { min: 1, max: 40 } }),
    measure('B3', '餐后 2 小时血糖', 'B', 'P1', '餐后\\s*2\\s*(?:小时|h)\\s*血糖|2hPG|2hPBG|OGTT\\s*2\\s*(?:小时|h)', { unit: 'mmol/L', range: { min: 1, max: 50 } }),
    measure('B4', '空腹 C 肽', 'B', 'P2', '(?:空腹)?C\\s*-?肽', { unit: 'nmol/L', range: { min: 0, max: 20 } }),
    measure('B5', '体重指数（BMI）', 'B', 'P0', 'BMI|体重指数', { unit: 'kg/m²', range: { min: 10, max: 70 } }),
    measure('B6', 'LDL-C', 'B', 'P0', 'LDL-C|LDL|低密度脂蛋白(?:胆固醇)?', { unit: 'mmol/L', range: { min: 0.1, max: 15 } }),
    measure('B7', '甘油三酯', 'B', 'P1', 'TG|甘油三酯|三酰甘油', { unit: 'mmol/L', range: { min: 0.1, max: 60 } }),
    measure('B8', '腰围', 'B', 'P2', '腰围', { unit: 'cm', range: { min: 40, max: 200 } }),

    /* C 微血管并发症 */
    presence('C1', '糖尿病视网膜病变', 'C', 'P0', '糖尿病视网膜病变（含非增殖期／增殖期、黄斑水肿）。', ['糖尿病视网膜病变', '糖尿病性视网膜病变', '视网膜病变', '增殖期视网膜病变', '非增殖期视网膜病变', '糖尿病黄斑水肿'], { accept: HX, granularity: 'patient' }),
    presence('C2', '糖尿病肾病', 'C', 'P0', '糖尿病肾脏病（DKD）。', ['糖尿病肾病', '糖尿病肾脏病', '糖尿病性肾病', 'DKD'], { accept: HX, granularity: 'patient' }),
    presence('C3', '糖尿病周围神经病变', 'C', 'P0', '远端对称性多发性神经病变等。', ['周围神经病变', '糖尿病周围神经病', '糖尿病神经病变', 'DPN', '四肢麻木', '手脚麻木', '双下肢麻木', '双足麻木', '肢体麻木', '手足麻木'], { accept: HX, granularity: 'patient' }),
    presence('C4', '自主神经病变', 'C', 'P2', '胃轻瘫、体位性低血压、神经源性膀胱等。', ['自主神经病变', '胃轻瘫', '体位性低血压', '神经源性膀胱'], { accept: HX, granularity: 'patient' }),
    measure('C5', '尿白蛋白/肌酐比值（UACR）', 'C', 'P0', 'UACR|ACR|尿白蛋白(?:\\/|与)?肌酐比(?:值)?|尿微量白蛋白(?:\\/|与)?肌酐', { unit: 'mg/g', range: { min: 0, max: 30000 } }),
    measure('C6', 'eGFR', 'C', 'P0', 'eGFR|估算肾小球滤过率|肾小球滤过率', { unit: 'mL/min/1.73m²', range: { min: 1, max: 200 } }),

    /* D 大血管与足 */
    presence('D1', '冠心病', 'D', 'P0', '冠心病或心肌梗死。', ['冠心病', '冠状动脉粥样硬化性心脏病', '心肌梗死', 'PCI', '冠脉支架'], { accept: HX, granularity: 'patient' }),
    presence('D2', '脑卒中', 'D', 'P0', '脑梗死、脑出血或 TIA。', ['脑梗死', '脑梗塞', '脑出血', '脑卒中', '卒中', 'TIA'], { accept: HX, granularity: 'patient' }),
    presence('D3', '下肢动脉病变', 'D', 'P1', '下肢动脉粥样硬化性病变（LEAD/PAD）。', ['下肢动脉病变', '下肢动脉硬化', '下肢动脉狭窄', '下肢动脉闭塞', 'PAD', '外周动脉疾病', '间歇性跛行'], { accept: HX, granularity: 'patient' }),
    presence('D4', '糖尿病足', 'D', 'P0', '糖尿病足溃疡、坏疽或截肢。', ['糖尿病足', '足溃疡', '足部溃疡', '坏疽', '截肢', '截趾'], { accept: HX, granularity: 'patient' }),
    presence('D5', '心力衰竭', 'D', 'P1', '心力衰竭。', ['心力衰竭', '心衰', '心功能不全'], { accept: HX, granularity: 'patient' }),

    /* E 急性并发症与低血糖 */
    presence('E1', '低血糖事件', 'E', 'P0', '本次就诊记录的低血糖（症状性或血糖 <3.9 mmol/L）。', ['低血糖', '低血糖反应', '低血糖昏迷', '低血糖发作'], { granularity: 'encounter' }),
    presence('E2', '严重低血糖', 'E', 'P1', '需他人帮助的严重低血糖（3 级）。', ['严重低血糖', '低血糖昏迷', '重度低血糖'], { accept: HX, granularity: 'patient' }),
    presence('E3', '糖尿病酮症／酮症酸中毒', 'E', 'P0', 'DKA 或酮症。', ['酮症酸中毒', 'DKA', '糖尿病酮症', '酮症'], { accept: HX, granularity: 'patient' }),
    presence('E4', '高渗高血糖状态', 'E', 'P1', 'HHS／高渗性昏迷。', ['高渗高血糖', '高渗性昏迷', 'HHS', '高渗状态'], { accept: HX, granularity: 'patient' }),

    /* F 降糖治疗 */
    listOf('F1', '口服降糖药', 'F', 'P0', '在用或出院带的口服降糖药（通用名）。', [
      ['二甲双胍', '格华止', '美迪康'], ['格列美脲', '亚莫利'], ['格列齐特', '达美康'], ['格列吡嗪', '瑞易宁', '美吡达'], ['格列喹酮', '糖适平'], ['瑞格列奈', '诺和龙'], ['那格列奈'],
      ['阿卡波糖', '拜糖平', '卡博平'], ['伏格列波糖'], ['吡格列酮'], ['罗格列酮'],
      ['西格列汀', '捷诺维'], ['沙格列汀', '安立泽'], ['利格列汀', '欧唐宁'], ['维格列汀', '佳维乐'], ['阿格列汀'],
      ['达格列净', '安达唐'], ['恩格列净', '欧唐静'], ['卡格列净'], ['西格列他钠'], ['多格列艾汀'],
    ], { granularity: 'encounter' }),
    listOf('F2', 'GLP-1 受体激动剂', 'F', 'P0', '在用 GLP-1RA（及双靶点激动剂）。', [['司美格鲁肽', '诺和泰', '诺和忻', '诺和盈'], ['利拉鲁肽', '诺和力'], ['度拉糖肽', '度易达'], ['艾塞那肽', '百泌达'], ['贝那鲁肽'], ['洛塞那肽'], ['替尔泊肽', '穆峰达'], ['利司那肽']], { granularity: 'encounter' }),
    listOf('F3', '胰岛素', 'F', 'P0', '在用胰岛素（按种类）。', [
      ['甘精胰岛素', '来得时', '长秀霖', '优乐灵'], ['地特胰岛素', '诺和平'], ['德谷胰岛素', '诺和达'], ['门冬胰岛素', '诺和锐'], ['赖脯胰岛素', '优泌乐'], ['谷赖胰岛素', '艾培达'],
      ['预混胰岛素', '门冬胰岛素30', '诺和锐30', '优泌乐25', '优泌乐50', '诺和灵30R', '甘舒霖30R', '精蛋白生物合成人胰岛素'], ['人胰岛素', '诺和灵R', '普通胰岛素', '生物合成人胰岛素'], ['德谷门冬双胰岛素', '诺和佳'], ['胰岛素泵', 'CSII'],
    ], { granularity: 'encounter' }),
    enumOf('F4', '治疗方案', 'F', 'P1', '本次的降糖治疗方案类别。', [['生活方式干预', '饮食运动控制', '单纯饮食控制'], ['口服药', '口服降糖药治疗'], ['胰岛素', '胰岛素治疗', '胰岛素强化治疗'], ['口服药联合胰岛素', '口服药+胰岛素', '联合胰岛素']], { granularity: 'encounter', model: 'always', recall: { terms: ['降糖', '治疗方案', '胰岛素', '口服'] } }),
    derived('F5', '口服降糖药种数', 'F', 'P1', '本次就诊记录的不同口服降糖药种数。', { op: 'countOf', field: 'F1' }, { granularity: 'encounter' }),

    /* G 心肾保护与合并用药 */
    listOf('G1', '他汀类', 'G', 'P0', '在用他汀类。', [['阿托伐他汀', '立普妥'], ['瑞舒伐他汀', '可定'], ['辛伐他汀'], ['普伐他汀'], ['匹伐他汀'], ['氟伐他汀']], { granularity: 'encounter' }),
    listOf('G2', 'ACEI／ARB', 'G', 'P0', '在用 ACEI 或 ARB。', [['依那普利'], ['贝那普利'], ['培哚普利'], ['缬沙坦', '代文'], ['厄贝沙坦', '安博维'], ['氯沙坦', '科素亚'], ['替米沙坦', '美卡素'], ['坎地沙坦'], ['奥美沙坦']], { granularity: 'encounter' }),
    listOf('G3', '抗血小板药', 'G', 'P1', '在用抗血小板药。', [['阿司匹林'], ['氯吡格雷'], ['替格瑞洛']], { granularity: 'encounter' }),
    listOf('G4', '非奈利酮', 'G', 'P2', '在用非甾体 MRA。', [['非奈利酮', '可申']], { granularity: 'encounter' }),

    /* H 合并症与危险因素 */
    presence('H1', '高血压', 'H', 'P0', '高血压病史。', ['高血压'], { accept: HX, granularity: 'patient' }),
    presence('H2', '血脂异常', 'H', 'P0', '高脂血症／血脂异常。', ['高脂血症', '血脂异常', '高胆固醇血症', '高甘油三酯血症'], { accept: HX, granularity: 'patient' }),
    presence('H3', '肥胖', 'H', 'P1', '肥胖或超重。', ['肥胖', '超重', '中心性肥胖'], { accept: HX, granularity: 'patient' }),
    presence('H4', '非酒精性脂肪肝／MASLD', 'H', 'P2', '脂肪肝、MAFLD、MASLD。', ['脂肪肝', '非酒精性脂肪性肝病', 'NAFLD', 'MAFLD', 'MASLD'], { accept: HX, granularity: 'patient' }),
    presence('H5', '糖尿病家族史', 'H', 'P1', '一级亲属有糖尿病。', ['糖尿病'], { accept: ['家族'], granularity: 'patient' }),
    presence('H6', '吸烟', 'H', 'P1', '吸烟（含已戒）。', ['吸烟', '抽烟'], { accept: HX, granularity: 'patient' }),
    derived('H7', '就诊年龄', 'H', 'P0', '本次就诊时年龄。', { op: 'ageAt', at: '$encounter.start' }, { granularity: 'encounter' }),

    /* K 其他检验与体征 */
    measure('K1', '收缩压', 'K', 'P1', '(?:BP|血压)\\s*[:：]?', { unit: 'mmHg', range: { min: 60, max: 280 }, value: '\\d{2,3}(?=\\s*/\\s*\\d{2,3})', definition: '血压记录中的收缩压（每次测量一条）。' }),
    measure('K2', '肌酐', 'K', 'P1', '肌酐|Scr|SCr', { unit: 'μmol/L', range: { min: 10, max: 2500 } }),
    measure('K3', '尿酸', 'K', 'P2', '尿酸|UA(?![a-zA-Z])', { unit: 'μmol/L', range: { min: 50, max: 1500 } }),
    measure('K4', '体重', 'K', 'P2', '体重', { unit: 'kg', range: { min: 25, max: 250 }, value: '\\d{2,3}(?:\\.\\d)?(?=\\s*(?:kg|Kg|KG|公斤))' }),
    text('K5', '主诉', 'K', 'P1', '本次就诊主诉原文。', { granularity: 'encounter', pick: 'first', sources: { sections: ['主诉'] }, rules: [{ id: 'chief', regex: '(?<v>[^\\n]{2,100})' }], recall: { regex: ['[^\\s]{2,}'] } }),
  ],
}
