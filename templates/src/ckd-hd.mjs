/**
 * 慢性肾脏病与维持性血液透析。
 * 依据：KDIGO 2024 CKD 评估与管理指南（G1–G5、A1–A3）；KDOQI 血液透析充分性指南 2015 更新（spKt/V 目标 1.4、最低 1.2）；
 * 中国血液透析充分性临床实践指南（URR ≥65%）；KDIGO 2017 CKD-MBD 指南；KDIGO 贫血指南。
 */
import { DUR, HX, date, derived, enumOf, listOf, measure, presence, scale, text } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']

export default {
  format: 'extract-template/1',
  id: 'ckd-hd',
  name: '慢性肾脏病与血液透析（CKD/HD）',
  version: '0.1.0',
  domain: '肾脏',
  description: '慢性肾脏病与维持性血液透析常用字段：CKD 分期与原发病、透析起始与方式、血管通路、透析处方与充分性、容量、贫血、CKD-MBD、营养与炎症、用药、并发症与结局。',
  references: [
    { title: 'KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease, Kidney Int 2024;105(4S)' },
    { title: 'KDOQI Clinical Practice Guideline for Hemodialysis Adequacy: 2015 Update, Am J Kidney Dis 2015;66(5):884-930', url: 'https://news.medlive.cn/neph/info-progress/show-113381_161.html' },
    { title: '中国血液透析充分性临床实践指南' },
    { title: 'KDIGO 2017 Clinical Practice Guideline Update for CKD-MBD' },
  ],
  documents: { excludeRecordTypes: ['门诊收费', '基本信息'] },
  groups: [
    { id: 'A', name: '诊断与分期' }, { id: 'B', name: '透析与通路' }, { id: 'C', name: '透析处方与充分性' }, { id: 'D', name: '容量与血压' },
    { id: 'E', name: '贫血' }, { id: 'F', name: '矿物质与骨代谢' }, { id: 'G', name: '营养与炎症' }, { id: 'H', name: '用药' }, { id: 'I', name: '并发症与结局' }, { id: 'J', name: '合并症' },
  ],
  fields: [
    /* A 诊断与分期 */
    { id: 'A1', name: '肾脏病相关诊断', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: '诊断栏写明的 CKD、尿毒症、肾衰竭等诊断（原文写法）。', sources: { sections: DX }, rules: [{ id: 'dx', regex: '(?<v>[^\\n，,。；;：:]{0,14}(?:慢性肾脏病|慢性肾病|CKD|尿毒症|肾衰竭|肾功能衰竭|肾功能不全|终末期肾病|ESRD|ESKD)[^\\n，,。；;：:]{0,14})' }], recall: { terms: ['慢性肾脏病', '慢性肾病', 'CKD', '尿毒症', '肾衰竭', '肾功能衰竭', '肾功能不全', '终末期肾病', 'ESRD', 'ESKD'] } },
    { id: 'A1c', name: 'ICD-10 编码（N18/N19/Z99.2）', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: 'CKD 与透析状态编码。', rules: [{ id: 'icd', regex: '(?<v>(?:N18|N19|Z99\\.2|Z49)(?:\\.\\d{1,3})?)' }], recall: { regex: ['N1[89]', 'Z99\\.2', 'Z49'] } },
    { id: 'A2', name: 'CKD G 分期', group: 'A', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'last', definition: 'KDIGO eGFR 分期 G1–G5（或"CKD 5期"）。',
      options: [{ value: 'G1' }, { value: 'G2' }, { value: 'G3a' }, { value: 'G3b' }, { value: 'G4' }, { value: 'G5' }, { value: 'G5D', terms: ['CKD5D', 'CKD 5D', 'CKD5D期'] }],
      recall: { regex: ['(?:CKD|慢性肾脏病|慢性肾病)\\s*(?:G\\s*)?[1-5][abAB]?\\s*D?\\s*期?'] },
      rules: [{ id: 'g', regex: '(?:CKD|慢性肾脏病|慢性肾病)\\s*(?:G\\s*)?(?<v>[1-5][abAB]?\\s*D?)\\s*期?', map: { 1: 'G1', 2: 'G2', '3a': 'G3a', '3A': 'G3a', '3b': 'G3b', '3B': 'G3b', 3: 'G3a', 4: 'G4', 5: 'G5', '5D': 'G5D', '5 D': 'G5D' } }] },
    enumOf('A3', '原发病', 'A', 'P0', '导致 CKD 的原发病。', [
      ['糖尿病肾病', '糖尿病肾脏病', 'DKD'], ['高血压肾损害', '高血压肾病', '良性小动脉性肾硬化', '高血压肾硬化'], ['慢性肾小球肾炎', '肾小球肾炎', 'IgA肾病', '膜性肾病', '局灶节段性肾小球硬化', 'FSGS'],
      ['多囊肾', '多囊肾病', 'ADPKD'], ['狼疮性肾炎'], ['梗阻性肾病', '尿路梗阻'], ['间质性肾炎', '慢性间质性肾炎'], ['原发病不明', '病因不明'],
    ], { granularity: 'patient', pick: 'mode', sources: { sections: [...DX, '现病史', '既往史', '病例特点'] } }),
    measure('A4', 'eGFR', 'A', 'P0', 'eGFR|估算肾小球滤过率|肾小球滤过率', { unit: 'mL/min/1.73m²', range: { min: 1, max: 200 } }),
    measure('A5', '尿白蛋白/肌酐比值（UACR）', 'A', 'P1', 'UACR|ACR|尿白蛋白(?:\\/|与)?肌酐比(?:值)?', { unit: 'mg/g', range: { min: 0, max: 30000 } }),
    measure('A6', '24 小时尿蛋白定量', 'A', 'P2', '24\\s*(?:小时|h)\\s*尿蛋白(?:定量)?|24hUP', { unit: 'g/24h', range: { min: 0, max: 30 } }),

    /* B 透析与通路 */
    enumOf('B1', '肾脏替代治疗方式', 'B', 'P0', '当前透析或替代治疗方式。', [['血液透析', 'HD', '维持性血液透析', '规律血透', '血透'], ['血液透析滤过', 'HDF', '血液滤过'], ['腹膜透析', 'PD', 'CAPD', 'APD', '腹透'], ['肾移植', '肾移植术后', '移植肾']], { granularity: 'encounter', pick: 'last' }),
    date('B2', '开始透析时间', 'B', 'P0', '首次开始规律透析的时间；"规律血透5年"取 5 年前。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', sources: { sections: ['主诉', '现病史', '既往史', '入院情况'] }, recall: { terms: ['血透', '血液透析', '腹透', '腹膜透析', '透析'], regex: [DUR] } }),
    derived('B3', '透析龄（月）', 'B', 'P0', '开始透析至本次就诊的月数。', { op: 'monthsBetween', from: 'B2', to: '$encounter.start' }, { granularity: 'encounter' }),
    enumOf('B4', '当前血管通路', 'B', 'P0', '当前使用的血管通路类型。', [['自体动静脉内瘘', 'AVF', '动静脉内瘘', '自体内瘘', '内瘘'], ['移植物内瘘', 'AVG', '人工血管内瘘', '人工血管'], ['长期导管', '带隧道带涤纶套导管', 'TCC', '长期透析导管', '半永久导管'], ['临时导管', '临时透析导管', '无隧道导管', '股静脉置管', '颈内静脉置管']], { granularity: 'encounter', pick: 'last' }),
    presence('B5', '内瘘功能不良／狭窄', 'B', 'P0', '内瘘狭窄、流量下降、功能不良。', ['内瘘狭窄', '内瘘功能不良', '流量下降', '血流量不足', '震颤减弱', '杂音减弱', '吻合口狭窄'], { granularity: 'encounter' }),
    presence('B6', '通路血栓／闭塞', 'B', 'P0', '内瘘或导管血栓、闭塞。', ['内瘘血栓', '内瘘闭塞', '内瘘堵塞', '导管血栓', '导管堵塞', '血栓形成'], { granularity: 'encounter' }),
    presence('B7', '通路相关干预', 'B', 'P1', 'PTA、内瘘重建、取栓、导管置换等。', ['PTA', '经皮腔内血管成形', '球囊扩张', '内瘘重建', '内瘘修复', '内瘘成形', '导管置换', '换管'], { granularity: 'encounter' }),

    /* C 透析处方与充分性 */
    measure('C1', 'spKt/V', 'C', 'P0', 'sp?Kt\\s*/\\s*V', { unit: null, range: { min: 0.3, max: 3 } }),
    measure('C2', '尿素下降率（URR）', 'C', 'P0', 'URR|尿素下降率|尿素清除率', { unit: '%', range: { min: 20, max: 95 } }),
    measure('C3', '每周透析次数', 'C', 'P0', '(?:每周|一周|1周)', { unit: '次/周', range: { min: 1, max: 7 }, gap: 4, value: '[1-7一二三四五六七](?=\\s*次)', granularity: 'encounter', pick: 'last' }),
    measure('C4', '每次透析时长', 'C', 'P1', '(?:每次|透析时间)', { unit: 'h', range: { min: 1, max: 10 }, gap: 6, value: '\\d(?:\\.\\d)?(?=\\s*(?:小时|h|H))', granularity: 'encounter', pick: 'last' }),
    measure('C5', '残余尿量', 'C', 'P2', '(?:残余)?尿量|每日尿量|24\\s*小时尿量', { unit: 'mL/d', range: { min: 0, max: 5000 } }),
    listOf('C6', '抗凝方式', 'C', 'P2', '透析抗凝方式。', [['普通肝素', '肝素抗凝', '全身肝素化'], ['低分子肝素', '依诺肝素', '那屈肝素', '达肝素'], ['无肝素', '无抗凝'], ['枸橼酸', '局部枸橼酸抗凝'], ['阿加曲班']], { granularity: 'encounter' }),

    /* D 容量与血压 */
    measure('D1', '干体重', 'D', 'P0', '干体重', { unit: 'kg', range: { min: 25, max: 200 } }),
    measure('D2', '透析间期体重增长', 'D', 'P1', '(?:透析)?间期体重增(?:长|加)|IDWG', { unit: 'kg', range: { min: 0, max: 10 } }),
    measure('D3', '透析前收缩压', 'D', 'P1', '(?:透前|透析前)?(?:BP|血压)\\s*[:：]?', { unit: 'mmHg', range: { min: 60, max: 280 }, value: '\\d{2,3}(?=\\s*/\\s*\\d{2,3})' }),
    presence('D4', '透析中低血压', 'D', 'P0', '透析过程中低血压。', ['透析中低血压', '透析低血压', 'IDH', '透析过程中血压下降'], { granularity: 'encounter' }),
    presence('D5', '容量负荷过重', 'D', 'P1', '水肿、胸腔积液、心衰等容量负荷表现。', ['容量负荷过重', '容量超负荷', '水钠潴留', '胸腔积液', '水肿'], { granularity: 'encounter' }),

    /* E 贫血 */
    measure('E1', '血红蛋白', 'E', 'P0', '血红蛋白|Hb(?!A)|HGB', { unit: 'g/L', range: { min: 20, max: 250 } }),
    measure('E2', '血清铁蛋白', 'E', 'P0', '铁蛋白', { unit: 'ng/mL', range: { min: 1, max: 5000 } }),
    measure('E3', '转铁蛋白饱和度（TSAT）', 'E', 'P0', 'TSAT|转铁蛋白饱和度', { unit: '%', range: { min: 1, max: 100 } }),
    listOf('E4', '红细胞生成刺激剂／HIF-PHI', 'E', 'P0', '促红素、罗沙司他等。', [['重组人促红素', '促红素', '促红细胞生成素', 'EPO', '益比奥', '依倍', '利血宝'], ['达依泊汀α', '达依泊汀'], ['培促红素'], ['罗沙司他', '爱瑞卓'], ['恩那司他'], ['达普司他']], { granularity: 'encounter' }),
    listOf('E5', '铁剂', 'E', 'P1', '静脉或口服铁剂。', [['蔗糖铁', '维乐福'], ['右旋糖酐铁'], ['羧基麦芽糖铁'], ['异麦芽糖酐铁'], ['多糖铁复合物', '力蜚能'], ['琥珀酸亚铁', '速力菲'], ['硫酸亚铁']], { granularity: 'encounter' }),

    /* F 矿物质与骨代谢 */
    measure('F1', '血钙', 'F', 'P0', '血钙|血清钙|项目：钙|(?<![a-zA-Z])Ca(?![a-zA-Z])', { unit: 'mmol/L', range: { min: 0.8, max: 4 }, value: '\\d\\.\\d{1,2}' }),
    measure('F2', '血磷', 'F', 'P0', '血磷|血清磷|无机磷|项目：磷|(?<![a-zA-Z])P(?![a-zA-Z])', { unit: 'mmol/L', range: { min: 0.2, max: 5 }, value: '\\d\\.\\d{1,2}' }),
    measure('F3', 'iPTH', 'F', 'P0', 'i?PTH|甲状旁腺(?:激素|素)', { unit: 'pg/mL', range: { min: 1, max: 5000 } }),
    measure('F4', '碱性磷酸酶', 'F', 'P2', 'ALP|AKP|碱性磷酸酶', { unit: 'U/L', range: { min: 5, max: 3000 } }),
    listOf('F5', '磷结合剂', 'F', 'P0', '在用磷结合剂。', [['碳酸钙', '钙尔奇'], ['醋酸钙'], ['司维拉姆', '碳酸司维拉姆', '盐酸司维拉姆', '诺维乐'], ['碳酸镧', '福斯利诺'], ['蔗糖氧化铁', '维福瑞']], { granularity: 'encounter' }),
    listOf('F6', '活性维生素 D／拟钙剂', 'F', 'P0', '骨化三醇、帕立骨化醇、西那卡塞、依特卡肽等。', [['骨化三醇', '罗盖全'], ['阿法骨化醇', '阿法D3'], ['帕立骨化醇', '胜普乐'], ['西那卡塞', '盖平'], ['依特卡肽', '帕瑞肽'], ['伊伐卡塞']], { granularity: 'encounter' }),
    presence('F7', '继发性甲旁亢', 'F', 'P1', '继发性甲状旁腺功能亢进（或行甲状旁腺切除）。', ['继发性甲状旁腺功能亢进', '继发性甲旁亢', '甲旁亢', 'SHPT', '甲状旁腺切除'], { accept: HX, granularity: 'patient' }),

    /* G 营养与炎症 */
    measure('G1', '血白蛋白', 'G', 'P0', '(?:血清)?白蛋白|ALB(?![a-zA-Z])', { unit: 'g/L', range: { min: 10, max: 60 } }),
    measure('G2', '血钾', 'G', 'P0', '血钾|血清钾|项目：钾|(?<![a-zA-Z])K\\+?(?![a-zA-Z])', { unit: 'mmol/L', range: { min: 1.5, max: 9 }, value: '\\d\\.\\d{1,2}' }),
    measure('G3', 'C 反应蛋白', 'G', 'P2', 'CRP|C\\s*反应蛋白|hs-?CRP', { unit: 'mg/L', range: { min: 0, max: 500 } }),
    measure('G4', '透析前血肌酐', 'G', 'P2', '(?:透前|透析前)?(?:血)?肌酐|Scr|SCr', { unit: 'μmol/L', range: { min: 50, max: 3000 } }),
    measure('G5', 'β2 微球蛋白', 'G', 'P2', 'β\\s*2\\s*-?微球蛋白|β2-?MG|B2M', { unit: 'mg/L', range: { min: 0, max: 200 } }),
    scale('G6', 'SGA', 'G', 'P2', 'SGA|主观综合营养评估', { min: 1, max: 7 }),

    /* H 用药 */
    listOf('H1', '降压药', 'H', 'P1', '在用降压药（按通用名）。', [['硝苯地平', '拜新同', '伲福达'], ['氨氯地平', '络活喜'], ['非洛地平', '波依定'], ['贝尼地平'], ['美托洛尔', '倍他乐克'], ['比索洛尔', '康忻'], ['卡维地洛'], ['阿罗洛尔'], ['缬沙坦'], ['厄贝沙坦'], ['氯沙坦'], ['特拉唑嗪'], ['可乐定'], ['沙库巴曲缬沙坦', '诺欣妥']], { granularity: 'encounter' }),
    listOf('H2', '降钾药', 'H', 'P2', '降钾树脂或环硅酸锆钠。', [['环硅酸锆钠', '利倍卓'], ['聚苯乙烯磺酸钙', '聚磺苯乙烯'], ['帕替罗默']], { granularity: 'encounter' }),
    listOf('H3', '抗血小板／抗凝药', 'H', 'P2', '在用抗血小板或抗凝药。', [['阿司匹林'], ['氯吡格雷'], ['华法林'], ['利伐沙班'], ['阿哌沙班']], { granularity: 'encounter' }),

    /* I 并发症与结局 */
    presence('I1', '通路相关感染／导管相关血流感染', 'I', 'P0', '导管或内瘘相关感染、导管相关血流感染。', ['导管相关血流感染', 'CRBSI', '导管感染', '隧道感染', '出口感染', '内瘘感染'], { granularity: 'encounter' }),
    presence('I2', '高钾血症', 'I', 'P0', '高钾血症。', ['高钾血症', '高血钾'], { granularity: 'encounter' }),
    presence('I3', '心力衰竭', 'I', 'P1', '心力衰竭或急性左心衰。', ['心力衰竭', '心衰', '急性左心衰'], { granularity: 'encounter' }),
    presence('I4', '院内死亡', 'I', 'P0', '住院期间死亡。', ['死亡', '临床死亡', '宣告死亡', '抢救无效'], { granularity: 'encounter', sources: { sections: ['出院情况', '诊疗经过', '病程记录', '正文'] } }),
    derived('I5', '就诊年龄', 'I', 'P0', '本次就诊时年龄。', { op: 'ageAt', at: '$encounter.start' }, { granularity: 'encounter' }),
    text('I6', '主诉', 'I', 'P1', '本次就诊主诉原文。', { granularity: 'encounter', pick: 'first', sources: { sections: ['主诉'] }, rules: [{ id: 'chief', regex: '(?<v>[^\\n]{2,100})' }], recall: { regex: ['[^\\s]{2,}'] } }),

    /* J 合并症 */
    presence('J1', '糖尿病', 'J', 'P0', '糖尿病病史。', ['糖尿病'], { accept: HX, granularity: 'patient' }),
    presence('J2', '高血压', 'J', 'P0', '高血压病史。', ['高血压'], { accept: HX, granularity: 'patient' }),
    presence('J3', '冠心病', 'J', 'P1', '冠心病或心肌梗死。', ['冠心病', '心肌梗死', '冠状动脉粥样硬化性心脏病'], { accept: HX, granularity: 'patient' }),
    presence('J4', '心房颤动', 'J', 'P1', '心房颤动。', ['心房颤动', '房颤'], { accept: HX, granularity: 'patient' }),
    presence('J5', '脑卒中', 'J', 'P2', '脑梗死、脑出血。', ['脑梗死', '脑出血', '脑卒中'], { accept: HX, granularity: 'patient' }),
  ],
}
