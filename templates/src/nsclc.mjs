/**
 * 非小细胞肺癌（NSCLC）。
 * 依据：CSCO 非小细胞肺癌诊疗指南 2024；NCCN NSCLC 指南；IASLC/AJCC 第 9 版 TNM 分期（2024 起，N2a/N2b、M1c1/M1c2）；
 * WHO 胸部肿瘤分类第 5 版；RECIST 1.1 疗效评价；CTCAE 不良事件分级。
 */
import { HX, date, derived, enumOf, listOf, measure, presence, scale, text } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
const PATH = ['所见', '结论', '诊断', '病理诊断', '正文', '辅助检查', '现病史']
const STAGES = ['I', 'IA', 'IB', 'II', 'IIA', 'IIB', 'III', 'IIIA', 'IIIB', 'IIIC', 'IV', 'IVA', 'IVB']
/** 原文写法（罗马数字全角／半角，亚期大小写）→ 规范分期 */
const STAGE_MAP = Object.fromEntries(STAGES.flatMap((st) => {
  const base = st.replace(/[ABC]$/, ''); const sub = st.slice(base.length)
  const full = { I: 'Ⅰ', II: 'Ⅱ', III: 'Ⅲ', IV: 'Ⅳ' }[base]
  return [base, full].flatMap((b) => (sub ? [sub, sub.toLowerCase()] : ['']).map((x) => [b + x, st]))
}))

export default {
  format: 'extract-template/1',
  id: 'nsclc',
  name: '非小细胞肺癌（NSCLC）',
  version: '0.1.0',
  domain: '肿瘤',
  description: '肺癌真实世界研究常用字段：组织学类型、TNM 与临床分期、转移部位、驱动基因与 PD-L1、体能状态、手术／化疗／靶向／免疫／放疗、疗效评价与进展、不良反应、吸烟史与肿瘤标志物。',
  references: [
    { title: '中国临床肿瘤学会（CSCO）非小细胞肺癌诊疗指南 2024（人民卫生出版社）', url: 'http://angen23.com/data/upload/2024-05-15/6644168208b74.pdf' },
    { title: 'IASLC/AJCC 第 9 版肺癌 TNM 分期（N2a/N2b、M1c1/M1c2）', url: 'https://onlinelibrary.wiley.com/doi/10.1002/resp.70243' },
    { title: 'NCCN Clinical Practice Guidelines in Oncology: Non-Small Cell Lung Cancer' },
    { title: 'RECIST 1.1；CTCAE v5.0' },
  ],
  documents: { excludeRecordTypes: ['门诊收费', '基本信息'] },
  groups: [
    { id: 'A', name: '诊断与病理' }, { id: 'B', name: '分期与转移' }, { id: 'C', name: '分子与免疫标志物' }, { id: 'D', name: '体能状态' },
    { id: 'E', name: '手术与放疗' }, { id: 'F', name: '系统治疗' }, { id: 'G', name: '疗效与进展' }, { id: 'H', name: '不良反应' }, { id: 'I', name: '危险因素与基线' }, { id: 'K', name: '肿瘤标志物' },
  ],
  fields: [
    /* A 诊断与病理 */
    { id: 'A1', name: '肺癌相关诊断', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: '诊断栏写明的肺癌诊断（原文写法）。', sources: { sections: DX }, rules: [{ id: 'dx', regex: '(?<v>[^\\n，,。；;：:]{0,14}(?:肺癌|肺腺癌|肺鳞癌|肺鳞状细胞癌|非小细胞肺癌|肺恶性肿瘤|NSCLC)[^\\n，,。；;：:]{0,18})' }], recall: { terms: ['肺癌', '肺腺癌', '肺鳞癌', '肺鳞状细胞癌', '非小细胞肺癌', '肺恶性肿瘤', 'NSCLC'] } },
    { id: 'A1c', name: 'ICD-10 编码（C34）', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: '肺恶性肿瘤编码。', rules: [{ id: 'icd', regex: '(?<v>C34(?:\\.\\d{1,3})?)' }], recall: { regex: ['C34'] } },
    enumOf('A2', '组织学类型', 'A', 'P0', 'WHO 组织学类型。', [['腺癌', '肺腺癌', '浸润性腺癌'], ['鳞状细胞癌', '鳞癌', '肺鳞癌'], ['腺鳞癌'], ['大细胞癌'], ['肉瘤样癌'], ['小细胞癌', '小细胞肺癌', 'SCLC'], ['非小细胞肺癌（未分型）', 'NSCLC-NOS', '非小细胞癌']], { granularity: 'patient', pick: 'mode', sources: { sections: [...DX, ...PATH] } }),
    enumOf('A3', '原发灶侧别', 'A', 'P1', '原发肿瘤所在肺。', [['左肺', '左上肺', '左下肺', '左肺上叶', '左肺下叶'], ['右肺', '右上肺', '右中肺', '右下肺', '右肺上叶', '右肺中叶', '右肺下叶'], ['双肺']], { granularity: 'patient', pick: 'mode', sources: { sections: [...DX, ...PATH] } }),
    date('A4', '病理确诊时间', 'A', 'P0', '病理或细胞学确诊肺癌的时间。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', sources: { sections: ['现病史', '既往史', '诊疗经过', '病例特点'] }, recall: { terms: ['确诊', '病理', '穿刺', '活检', '术后病理'] } }),
    derived('A5', '确诊年龄', 'A', 'P0', '确诊时年龄。', { op: 'ageAt', at: 'A4' }, { granularity: 'patient' }),

    /* B 分期与转移 */
    { id: 'B1', name: 'TNM 分期（原文）', group: 'B', priority: 'P0', type: 'text', granularity: 'encounter', pick: 'last', definition: '写明的 TNM（如 cT2aN2bM0、pT1cN0M0、T4N3M1c2），原文。', rules: [{ id: 'tnm', regex: '(?<v>[cpy]{0,2}T(?:is|[0-4x])[abc]?\\s*N[0-3x][ab]?\\s*M[01x][abc]?[12]?)' }], recall: { regex: ['[cpy]{0,2}T(?:is|[0-4x])[abc]?\\s*N[0-3x]'] } },
    { id: 'B2', name: '临床分期', group: 'B', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'last', definition: 'AJCC 分期 I–IV 期及亚期（IA1–3 记为 IA）。只认与肺癌写在同一句里的分期。',
      options: STAGES.map((value) => ({ value })),
      recall: { terms: ['肺癌', '腺癌', '鳞癌', 'NSCLC', '非小细胞'] },
      rules: [{ id: 'stage', regex: '(?:肺癌|腺癌|鳞癌|鳞状细胞癌|NSCLC|非小细胞)[^。；\\n]{0,40}?(?<![A-Za-zⅠⅡⅢⅣ])(?<v>(?:Ⅳ|Ⅲ|Ⅱ|Ⅰ|IV|III|II|I)[ABCabc]?)[123]?\\s*期', map: STAGE_MAP }] },
    presence('B3', '脑转移', 'B', 'P0', '脑转移。', ['脑转移', '颅内转移', '脑部转移'], { granularity: 'patient', accept: HX }),
    presence('B4', '骨转移', 'B', 'P0', '骨转移。', ['骨转移', '多发骨转移', '椎体转移', '骨质破坏'], { granularity: 'patient', accept: HX }),
    presence('B5', '肝转移', 'B', 'P0', '肝转移。', ['肝转移', '肝脏转移'], { granularity: 'patient', accept: HX }),
    presence('B6', '肾上腺转移', 'B', 'P1', '肾上腺转移。', ['肾上腺转移'], { granularity: 'patient', accept: HX }),
    presence('B7', '胸膜转移／恶性胸腔积液', 'B', 'P1', '胸膜转移或恶性胸腔积液（M1a）。', ['胸膜转移', '恶性胸腔积液', '胸膜播散', '心包积液'], { granularity: 'patient', accept: HX }),
    presence('B8', '对侧肺转移', 'B', 'P2', '对侧肺内转移。', ['对侧肺转移', '双肺转移', '肺内转移'], { granularity: 'patient', accept: HX }),

    /* C 分子与免疫标志物 */
    enumOf('C1', 'EGFR 突变', 'C', 'P0', 'EGFR 突变状态与类型。', [
      ['19外显子缺失', '19del', '19Del', 'Ex19del', '19号外显子缺失', 'exon 19 deletion'], ['L858R', '21外显子L858R', 'exon21 L858R'], ['T790M'], ['20外显子插入', '20ins', 'Ex20ins', 'exon 20 insertion'],
      ['少见突变', 'G719X', 'L861Q', 'S768I', 'G719'], ['野生型', 'EGFR阴性', 'EGFR野生型', '未见EGFR突变', 'EGFR未检测到突变'],
    ], { granularity: 'patient', pick: 'all', recall: { terms: ['EGFR'] } }),
    enumOf('C2', 'ALK 融合', 'C', 'P0', 'ALK 融合状态。', [['阳性', 'ALK阳性', 'ALK融合阳性', 'EML4-ALK', 'ALK重排', 'ALK(+)', 'ALK（+）'], ['阴性', 'ALK阴性', 'ALK融合阴性', '未见ALK', 'ALK(-)', 'ALK（-）']], { selfTerm: false, granularity: 'patient', pick: 'last', recall: { terms: ['ALK'] }, model: 'always' }),
    enumOf('C3', 'ROS1 融合', 'C', 'P1', 'ROS1 融合状态。', [['阳性', 'ROS1阳性', 'ROS1融合阳性', 'CD74-ROS1', 'ROS1(+)'], ['阴性', 'ROS1阴性', '未见ROS1', 'ROS1(-)']], { selfTerm: false, granularity: 'patient', pick: 'last', recall: { terms: ['ROS1'] }, model: 'always' }),
    listOf('C4', '其他驱动基因阳性', 'C', 'P0', '检出的其他驱动变异。', [['KRAS G12C', 'G12C'], ['KRAS突变', 'KRAS'], ['BRAF V600E', 'V600E'], ['MET 14外显子跳跃', 'MET14', 'METex14', 'MET 14号外显子跳跃'], ['MET扩增'], ['RET融合', 'RET重排'], ['HER2突变', 'ERBB2突变', 'HER2 20外显子插入'], ['NTRK融合', 'NTRK'], ['NRG1融合']], { granularity: 'patient' }),
    measure('C5', 'PD-L1 TPS', 'C', 'P0', 'PD-?L1[^。；\\n]{0,10}?(?:TPS|表达|阳性率)?', { unit: '%', range: { min: 0, max: 100 }, granularity: 'patient', pick: 'last', value: '\\d{1,3}(?:\\.\\d)?(?=\\s*%)', alt: [{ id: 'pdl1-lt1', regex: 'PD-?L1[^。；\\n]{0,10}?(?:TPS)?\\s*[<＜]\\s*1\\s*%', value: 0 }] }),
    measure('C6', 'TMB', 'C', 'P2', 'TMB|肿瘤突变负荷', { unit: 'mut/Mb', range: { min: 0, max: 500 }, granularity: 'patient', pick: 'last' }),

    /* D 体能状态 */
    scale('D1', 'ECOG PS', 'D', 'P0', 'ECOG(?:\\s*PS)?|PS评分|体能状态评分', { min: 0, max: 5 }),
    scale('D2', 'KPS', 'D', 'P2', 'KPS|卡氏评分|Karnofsky', { min: 0, max: 100 }),

    /* E 手术与放疗 */
    enumOf('E1', '手术方式', 'E', 'P0', '肺癌手术方式。', [['肺叶切除', '肺叶切除术', '根治术'], ['全肺切除', '全肺切除术'], ['亚肺叶切除', '肺段切除', '楔形切除', '肺段切除术', '楔形切除术'], ['袖式切除', '袖式肺叶切除']], { granularity: 'patient', pick: 'all', accept: HX }),
    presence('E2', '新辅助／辅助治疗', 'E', 'P1', '围手术期新辅助或辅助治疗。', ['新辅助', '辅助化疗', '辅助靶向', '辅助免疫', '术后辅助'], { granularity: 'patient', accept: HX }),
    listOf('E3', '放疗', 'E', 'P0', '放疗类型。', [['根治性放疗', '同步放化疗', '根治性同步放化疗'], ['SBRT', 'SABR', '立体定向放疗', '体部立体定向'], ['姑息放疗', '骨转移放疗'], ['全脑放疗', 'WBRT'], ['脑立体定向放疗', 'SRS', '伽马刀']], { granularity: 'patient', accept: HX }),

    /* F 系统治疗 */
    listOf('F1', 'EGFR-TKI', 'F', 'P0', 'EGFR 酪氨酸激酶抑制剂。', [['奥希替尼', '泰瑞沙'], ['阿美替尼', '阿美乐'], ['伏美替尼', '艾弗沙'], ['吉非替尼', '易瑞沙'], ['厄洛替尼', '特罗凯'], ['埃克替尼', '凯美纳'], ['阿法替尼', '吉泰瑞'], ['达可替尼', '多泽润'], ['舒沃替尼'], ['埃万妥单抗']], { granularity: 'encounter', accept: HX }),
    listOf('F2', 'ALK／ROS1 等其他靶向药', 'F', 'P0', '其他靶向治疗药物。', [['阿来替尼', '安圣莎'], ['克唑替尼', '赛可瑞'], ['塞瑞替尼'], ['布格替尼'], ['恩沙替尼', '贝美纳'], ['洛拉替尼', '博瑞纳'], ['恩曲替尼'], ['索托拉西布'], ['普拉替尼'], ['塞普替尼'], ['赛沃替尼'], ['特泊替尼'], ['谷美替尼'], ['达拉非尼'], ['曲美替尼'], ['安罗替尼', '福可维'], ['贝伐珠单抗', '安维汀'], ['恩度', '重组人血管内皮抑制素']], { granularity: 'encounter', accept: HX }),
    listOf('F3', '免疫检查点抑制剂', 'F', 'P0', 'PD-1/PD-L1 抑制剂等。', [['帕博利珠单抗', '可瑞达', 'K药'], ['纳武利尤单抗', '欧狄沃', 'O药'], ['替雷利珠单抗', '百泽安'], ['信迪利单抗', '达伯舒'], ['卡瑞利珠单抗', '艾瑞卡'], ['特瑞普利单抗', '拓益'], ['阿替利珠单抗', '泰圣奇'], ['度伐利尤单抗', '英飞凡'], ['舒格利单抗', '择捷美'], ['斯鲁利单抗', '汉斯状'], ['派安普利单抗'], ['依沃西单抗']], { granularity: 'encounter', accept: HX }),
    listOf('F4', '化疗药物', 'F', 'P0', '化疗药物。', [['培美曲塞', '力比泰', '普来乐'], ['紫杉醇', '泰素'], ['白蛋白结合型紫杉醇', '白蛋白紫杉醇', '克艾力'], ['多西他赛', '泰索帝'], ['吉西他滨', '健择'], ['长春瑞滨', '诺维本'], ['顺铂'], ['卡铂'], ['奈达铂'], ['依托泊苷', 'VP-16']], { granularity: 'encounter', accept: HX }),
    measure('F5', '化疗周期数', 'F', 'P1', '(?:化疗|治疗|免疫治疗)', { unit: '周期', range: { min: 1, max: 60 }, gap: 12, value: '\\d{1,2}(?=\\s*(?:个)?(?:周期|疗程|程))', granularity: 'encounter', pick: 'max' }),
    enumOf('F6', '治疗线数', 'F', 'P1', '当前系统治疗线数。', [['一线', '1线', '一线治疗'], ['二线', '2线', '二线治疗'], ['三线', '3线', '三线及以上', '后线']], { granularity: 'encounter', pick: 'last' }),

    /* G 疗效与进展 */
    // 缩写 CR/PR/SD/PD 到处都有（PD-1、PD-L1），只在"疗效评价…"后面认
    enumOf('G1', '疗效评价（RECIST）', 'G', 'P0', 'RECIST 1.1 疗效：CR、PR、SD、PD。', [['CR', '完全缓解'], ['PR', '部分缓解'], ['SD', '疾病稳定', '病情稳定'], ['PD', '疾病进展', '病情进展']], { selfTerm: false, granularity: 'timepoint', rules: [{ id: 'recist', regex: '(?:疗效|评价|评估|评效)[^。；\\n]{0,8}?(?<v>CR|PR|SD|PD)(?![-A-Za-z0-9])' }] }),
    presence('G2', '疾病进展', 'G', 'P0', '影像或临床确认的疾病进展。', ['疾病进展', '病情进展', '新发转移', '新增转移', '进展'], { granularity: 'encounter' }),
    presence('G3', '耐药', 'G', 'P1', '靶向或免疫治疗耐药。', ['耐药', '获得性耐药', '原发耐药'], { granularity: 'patient', accept: HX }),
    presence('G4', '死亡', 'G', 'P0', '记录的死亡。', ['死亡', '临床死亡', '宣告死亡', '抢救无效'], { granularity: 'patient', sources: { sections: ['出院情况', '诊疗经过', '病程记录', '正文'] } }),

    /* H 不良反应 */
    listOf('H1', '免疫相关不良事件（irAE）', 'H', 'P0', '免疫治疗相关不良事件。', [['免疫相关性肺炎', '免疫性肺炎', '检查点抑制剂相关肺炎', 'CIP'], ['免疫相关性心肌炎', '免疫性心肌炎'], ['免疫相关性肝炎', '免疫性肝炎'], ['甲状腺功能减退', '甲减'], ['甲状腺功能亢进', '甲亢'], ['免疫相关性结肠炎', '免疫性肠炎'], ['皮疹'], ['反应性毛细血管增生症', 'RCCEP']], { granularity: 'encounter', model: 'always', recall: { terms: ['免疫相关', 'irAE', '免疫性', '不良反应', '毛细血管增生', '甲减', '甲亢', '皮疹'] } }),
    listOf('H2', '靶向／化疗不良反应', 'H', 'P1', '其他治疗不良反应。', [['骨髓抑制', '白细胞减少', '中性粒细胞减少', '血小板减少'], ['间质性肺病', 'ILD', '间质性肺炎'], ['腹泻'], ['皮疹', '痤疮样皮疹'], ['甲沟炎'], ['肝功能损害', '转氨酶升高'], ['QTc间期延长', 'QT延长'], ['恶心呕吐', '恶心', '呕吐']], { granularity: 'encounter', model: 'always', recall: { terms: ['不良反应', '毒副反应', '骨髓抑制', '腹泻', '皮疹', '间质性', '甲沟炎', '转氨酶升高'] } }),
    enumOf('H3', '最高 CTCAE 分级', 'H', 'P2', '记录的不良事件最高分级。', [['1级'], ['2级'], ['3级'], ['4级'], ['5级']], { selfTerm: false, granularity: 'encounter', pick: 'last', recall: { regex: ['(?:CTCAE|不良反应|不良事件|irAE)[^。；\\n]{0,12}[1-5]\\s*级'] }, rules: [{ id: 'ctcae', regex: '(?:CTCAE|不良反应|不良事件|irAE)[^。；\\n]{0,12}?(?<v>[1-5])\\s*级', map: { 1: '1级', 2: '2级', 3: '3级', 4: '4级', 5: '5级' } }] }),

    /* I 危险因素与基线 */
    presence('I1', '吸烟', 'I', 'P0', '吸烟（含已戒）。', ['吸烟', '抽烟'], { accept: HX, granularity: 'patient' }),
    measure('I2', '吸烟包年', 'I', 'P1', '包年|包\\/年|吸烟指数|吸烟', { unit: '包年', range: { min: 0, max: 300 }, granularity: 'patient', pick: 'max', accept: HX, value: '\\d{1,3}(?=\\s*(?:包年|包\\/年|年包))' }),
    presence('I3', '肿瘤家族史', 'I', 'P1', '一级亲属恶性肿瘤史（尤其肺癌）。', ['肺癌', '恶性肿瘤', '癌'], { accept: ['家族'], granularity: 'patient' }),
    presence('I4', 'COPD／肺气肿', 'I', 'P2', '慢阻肺或肺气肿。', ['慢性阻塞性肺疾病', 'COPD', '慢阻肺', '肺气肿'], { accept: HX, granularity: 'patient' }),
    derived('I5', '就诊年龄', 'I', 'P0', '本次就诊时年龄。', { op: 'ageAt', at: '$encounter.start' }, { granularity: 'encounter' }),
    text('I6', '主诉', 'I', 'P1', '本次就诊主诉原文。', { granularity: 'encounter', pick: 'first', sources: { sections: ['主诉'] }, rules: [{ id: 'chief', regex: '(?<v>[^\\n]{2,100})' }], recall: { regex: ['[^\\s]{2,}'] } }),

    /* K 肿瘤标志物 */
    measure('K1', 'CEA', 'K', 'P0', 'CEA|癌胚抗原', { unit: 'ng/mL', range: { min: 0, max: 10000 } }),
    measure('K2', 'CYFRA21-1', 'K', 'P1', 'CYFRA\\s*21-?1|细胞角蛋白19片段|非小细胞肺癌相关抗原', { unit: 'ng/mL', range: { min: 0, max: 1000 } }),
    measure('K3', 'NSE', 'K', 'P2', 'NSE|神经元特异性烯醇化酶', { unit: 'ng/mL', range: { min: 0, max: 1000 } }),
    measure('K4', 'SCC', 'K', 'P2', 'SCC(?:-?Ag)?|鳞状上皮细胞癌抗原|鳞癌抗原', { unit: 'ng/mL', range: { min: 0, max: 1000 } }),
    measure('K5', 'ProGRP', 'K', 'P2', 'ProGRP|胃泌素释放肽前体', { unit: 'pg/mL', range: { min: 0, max: 50000 } }),
  ],
}
