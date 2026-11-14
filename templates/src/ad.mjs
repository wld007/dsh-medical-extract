/**
 * 阿尔茨海默病与认知障碍。
 * 依据：中国阿尔茨海默病痴呆诊疗指南（2020 年版）；中国痴呆与认知障碍诊治指南（2018）；
 * Alzheimer's Association Workgroup 修订标准（2024，生物学 ATN 分期与临床分期）；NIA-AA 2011／2018。
 */
import { HX, date, derived, enumOf, listOf, measure, presence, scale, text } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']

export default {
  format: 'extract-template/1',
  id: 'ad',
  name: '阿尔茨海默病与认知障碍（AD）',
  version: '0.1.0',
  domain: '神经',
  description: '认知障碍研究队列常用字段：临床诊断与分期、起病与病程、认知与功能量表、核心症状与精神行为症状、生物标志物（脑脊液、血液、PET、APOE）、影像、治疗（胆碱酯酶抑制剂、美金刚、抗 Aβ 单抗及 ARIA）、危险因素。',
  references: [
    { title: '中国阿尔茨海默病痴呆诊疗指南（2020 年版），中华老年医学杂志 2021;40(3)', url: 'https://cs.medjournals.cn/article/doi/full/10.3760/cma.j.issn.0254-9026.2021.03.001' },
    { title: '2018 中国痴呆与认知障碍诊治指南' },
    { title: 'Revised criteria for diagnosis and staging of Alzheimer’s disease: Alzheimer’s Association Workgroup (2024)' },
    { title: 'NIA-AA Research Framework (2018)' },
  ],
  documents: { excludeRecordTypes: ['门诊收费', '基本信息'] },
  groups: [
    { id: 'A', name: '诊断与分期' }, { id: 'B', name: '起病与病程' }, { id: 'C', name: '认知与功能量表' }, { id: 'D', name: '症状' },
    { id: 'E', name: '生物标志物' }, { id: 'F', name: '影像' }, { id: 'G', name: '治疗' }, { id: 'H', name: '危险因素与共病' }, { id: 'K', name: '检验' },
  ],
  fields: [
    /* A 诊断与分期 */
    { id: 'A1', name: '认知障碍相关诊断', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: '诊断栏写明的痴呆、AD、MCI 等认知障碍诊断名称（原文写法）。', sources: { sections: DX }, rules: [{ id: 'dx', regex: '(?<v>[^\\n，,。；;：:]{0,14}(?:痴呆|阿尔茨海默|阿尔采末|老年性痴呆|认知障碍|认知功能障碍|认知损害|MCI|AD)[^\\n，,。；;：:]{0,14})' }], recall: { terms: ['痴呆', '阿尔茨海默', '认知障碍', '认知功能障碍', '认知损害', 'MCI'] } },
    { id: 'A1c', name: 'ICD-10 编码（F00–F03/G30/G31）', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: '痴呆相关编码。', rules: [{ id: 'icd', regex: '(?<v>(?:F0[0-3]|G30|G31)(?:\\.\\d{1,3})?)' }], recall: { regex: ['F0[0-3]', 'G3[01]'] } },
    enumOf('A2', '认知障碍病因类型', 'A', 'P0', '临床诊断的病因类型。', [
      ['阿尔茨海默病', '阿尔茨海默病性痴呆', 'AD痴呆', '阿尔茨海默症', '老年性痴呆'], ['血管性痴呆', '血管性认知障碍', 'VaD', 'VCI'], ['混合性痴呆', '混合型痴呆'],
      ['路易体痴呆', 'DLB', '路易体'], ['额颞叶痴呆', 'FTD', '额颞叶变性'], ['帕金森病痴呆', 'PDD'], ['其他'],
    ], { granularity: 'encounter', pick: 'last', sources: { sections: [...DX, '病例特点', '鉴别诊断', '诊疗经过'] } }),
    enumOf('A3', '临床阶段', 'A', 'P0', '认知功能的临床阶段：主观认知下降、轻度认知障碍、痴呆。', [
      ['主观认知下降', 'SCD', '主观认知减退'], ['轻度认知障碍', 'MCI', '轻度认知功能障碍', '轻度认知损害'], ['轻度痴呆', '痴呆（轻度）', '轻度阿尔茨海默'], ['中度痴呆', '中度阿尔茨海默'], ['重度痴呆', '重度阿尔茨海默'],
    ], { granularity: 'encounter', pick: 'last' }),
    presence('A4', '早发型（<65 岁起病）', 'A', 'P1', '医生写明早发型或 65 岁前起病。', ['早发型', '早老性痴呆', '早发性'], { granularity: 'patient', accept: HX }),
    enumOf('A5', 'AD 生物学分期（AA 2024）', 'A', 'P2', 'AA 2024 生物学分期 A–D（如病历写明）。', [['A期', '生物学A期'], ['B期', '生物学B期'], ['C期', '生物学C期'], ['D期', '生物学D期']], { selfTerm: false, granularity: 'patient' }),

    /* B 起病与病程 */
    date('B1', '认知症状首发时间', 'B', 'P0', '记忆或其他认知症状首次出现的时间；"记忆力下降3年"取 3 年前。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', sources: { sections: ['主诉', '现病史'] }, recall: { terms: ['记忆力下降', '记忆力减退', '健忘', '遗忘', '认知下降', '起病', '发病'] } }),
    derived('B2', '起病年龄', 'B', 'P0', '认知症状首发时的年龄。', { op: 'ageAt', at: 'B1' }, { granularity: 'patient' }),
    derived('B3', '病程（月）', 'B', 'P1', '首发至本次就诊的月数。', { op: 'monthsBetween', from: 'B1', to: '$encounter.start' }, { granularity: 'encounter' }),
    enumOf('B4', '起病方式', 'B', 'P2', '起病与进展方式。', [['隐匿起病', '隐匿起病、逐渐进展', '缓慢起病', '慢性起病'], ['急性起病', '突然起病'], ['阶梯样进展', '阶梯式']], { granularity: 'patient' }),
    measure('B5', '受教育年限', 'B', 'P0', '受教育(?:年限)?|教育年限|文化程度', { unit: '年', range: { min: 0, max: 25 }, granularity: 'patient', pick: 'last', alt: [{ id: 'edu-b', regex: '(?<v>\\d{1,2})\\s*年(?:的)?(?:教育|文化)' }] }),

    /* C 认知与功能量表 */
    scale('C1', 'MMSE', 'C', 'P0', 'MMSE|简易精神状态(?:检查|量表)|简易智能精神状态', { min: 0, max: 30 }),
    scale('C2', 'MoCA', 'C', 'P0', 'MoCA|MOCA|蒙特利尔认知评估', { min: 0, max: 30 }),
    { ...scale('C3', 'CDR', 'C', 'P0', 'CDR(?!-?SB)|临床痴呆评定量表', { min: 0, max: 3 }), rules: [{ id: 'cdr', regex: 'CDR(?!\\s*-?\\s*SB)\\s*(?:评分|分级)?\\s*[:：为=]?\\s*(?<v>0\\.5|[0-3])(?!\\d)' }] },
    scale('C4', 'CDR-SB', 'C', 'P1', 'CDR-?SB|CDR\\s*总和', { min: 0, max: 18 }),
    scale('C5', 'ADL', 'C', 'P1', 'ADL|日常生活(?:活动)?能力(?:量表)?', { min: 14, max: 100 }),
    scale('C6', 'NPI', 'C', 'P1', 'NPI|神经精神(?:问卷|量表)', { min: 0, max: 144 }),
    scale('C7', 'ADAS-Cog', 'C', 'P2', 'ADAS-?Cog|阿尔茨海默病评估量表', { min: 0, max: 85 }),
    scale('C8', 'GDS（总体衰退量表）', 'C', 'P2', 'GDS分期|总体衰退量表', { min: 1, max: 7 }),
    scale('C9', 'HAMD', 'C', 'P2', 'HAMD|汉密尔顿抑郁', { min: 0, max: 76 }),

    /* D 症状 */
    presence('D1', '记忆力下降', 'D', 'P0', '近记忆减退、健忘、遗忘。', ['记忆力下降', '记忆力减退', '记忆减退', '记忆差', '健忘', '遗忘', '丢三落四', '近事遗忘', '近记忆力下降']),
    presence('D2', '定向障碍', 'D', 'P1', '时间、地点、人物定向力障碍。', ['定向障碍', '定向力障碍', '定向力差', '迷路', '走失', '找不到家']),
    presence('D3', '语言障碍', 'D', 'P1', '找词困难、命名障碍、言语减少等。', ['语言障碍', '找词困难', '命名障碍', '失语', '言语减少', '表达困难']),
    presence('D4', '执行功能障碍', 'D', 'P1', '计划、计算、判断能力下降。', ['执行功能障碍', '执行功能下降', '计算力下降', '计算能力下降', '判断力下降']),
    presence('D5', '精神病性症状', 'D', 'P0', '幻觉、妄想（被窃妄想、嫉妒妄想等）。', ['幻觉', '幻视', '幻听', '妄想', '被窃妄想', '被偷窃妄想', '嫉妒妄想']),
    presence('D6', '激越／攻击行为', 'D', 'P0', '激越、易激惹、攻击行为。', ['激越', '攻击行为', '打人', '骂人', '易激惹', '冲动', '吵闹']),
    presence('D7', '抑郁症状', 'D', 'P1', '情绪低落、兴趣减退等抑郁症状。', ['抑郁', '情绪低落', '兴趣减退', '心情差']),
    presence('D8', '淡漠', 'D', 'P1', '淡漠、主动性下降。', ['淡漠', '主动性下降', '懒散', '不愿活动']),
    presence('D9', '睡眠障碍', 'D', 'P1', '失眠、昼夜颠倒等。', ['睡眠障碍', '失眠', '昼夜颠倒', '睡眠倒错', '夜间吵闹']),
    presence('D10', '日常生活需协助', 'D', 'P1', '日常生活需他人协助或照护。', ['生活不能自理', '生活需协助', '需人照顾', '需他人照料', '生活部分自理', '生活依赖']),

    /* E 生物标志物 */
    enumOf('E1', 'APOE 基因型', 'E', 'P0', 'APOE 基因分型。', [['ε4/ε4', 'E4/E4', 'ε4ε4'], ['ε3/ε4', 'E3/E4', 'ε3ε4'], ['ε2/ε4', 'E2/E4', 'ε2ε4'], ['ε3/ε3', 'E3/E3', 'ε3ε3'], ['ε2/ε3', 'E2/E3', 'ε2ε3'], ['ε2/ε2', 'E2/E2', 'ε2ε2']], { granularity: 'patient', recall: { regex: ['APOE[^。；\\n]{0,16}'] } }),
    presence('E2', 'APOE ε4 携带', 'E', 'P0', '携带至少一个 APOE ε4 等位基因。', ['ε4携带', 'E4携带', 'APOE4阳性', 'APOE ε4阳性'], { granularity: 'patient', rules: [{ id: 'e4', regex: 'APOE[^。；\\n]{0,10}(?:ε|E|e)4', value: '有' }] }),
    measure('E3', '脑脊液 Aβ42', 'E', 'P0', '(?:脑脊液|CSF)?\\s*A[βb]\\s*1?-?42(?!\\s*/)', { unit: 'pg/mL', range: { min: 50, max: 3000 } }),
    measure('E4', '脑脊液 Aβ42/40', 'E', 'P1', 'A[βb]\\s*42\\s*/\\s*(?:A[βb]\\s*)?40', { unit: null, range: { min: 0.01, max: 0.3 }, value: '0\\.\\d+' }),
    measure('E5', 'p-tau181', 'E', 'P0', 'p-?tau\\s*-?181|P-?tau181|磷酸化tau(?:蛋白)?181|p-tau', { unit: 'pg/mL', range: { min: 0.1, max: 500 } }),
    measure('E6', 'p-tau217', 'E', 'P1', 'p-?tau\\s*-?217|磷酸化tau(?:蛋白)?217', { unit: 'pg/mL', range: { min: 0.01, max: 50 } }),
    measure('E7', '总 tau（t-tau）', 'E', 'P1', 't-?tau|总tau(?:蛋白)?', { unit: 'pg/mL', range: { min: 20, max: 3000 } }),
    enumOf('E8', '淀粉样蛋白 PET', 'E', 'P0', 'Aβ-PET 结果（阳性／阴性）。', [['阳性', 'Aβ-PET阳性', '淀粉样蛋白PET阳性', 'Aβ沉积', '淀粉样蛋白沉积'], ['阴性', 'Aβ-PET阴性', '淀粉样蛋白PET阴性', '未见Aβ沉积', '未见淀粉样蛋白沉积']], { selfTerm: false, granularity: 'patient', pick: 'last', model: 'always', recall: { regex: ['(?:淀粉样蛋白|A[βb]|PiB|AV-?45|florbetapir|florbetaben|flutemetamol)[^。；\\n]{0,6}PET'] } }),
    enumOf('E9', 'tau PET', 'E', 'P2', 'tau-PET 结果（阳性／阴性）。', [['阳性', 'tau-PET阳性', 'tau沉积'], ['阴性', 'tau-PET阴性', '未见tau沉积']], { selfTerm: false, granularity: 'patient', pick: 'last', model: 'always', recall: { regex: ['tau[^。；\\n]{0,6}PET', '(?:AV-?1451|flortaucipir|MK-?6240|PI-?2620)'] } }),

    /* F 影像 */
    scale('F1', 'MTA 评分（内侧颞叶萎缩）', 'F', 'P0', 'MTA|内侧颞叶萎缩(?:评分)?|海马萎缩(?:评分)?', { min: 0, max: 4 }),
    scale('F2', 'Fazekas 评分', 'F', 'P1', 'Fazekas', { min: 0, max: 6 }),
    presence('F3', '海马萎缩', 'F', 'P0', 'MRI 示海马或内侧颞叶萎缩。', ['海马萎缩', '海马体积缩小', '内侧颞叶萎缩', '双侧海马萎缩']),
    presence('F4', '脑白质病变', 'F', 'P1', 'MRI/CT 示脑白质病变、脑白质高信号或脱髓鞘。', ['脑白质病变', '白质高信号', '脑白质疏松', '脱髓鞘', '缺血性白质病变']),
    presence('F5', 'FDG-PET 颞顶叶低代谢', 'F', 'P2', 'FDG-PET 示颞顶叶或后扣带回低代谢。', ['颞顶叶低代谢', '后扣带回低代谢', '葡萄糖代谢减低', '代谢减低']),

    /* G 治疗 */
    listOf('G1', '抗痴呆药物', 'G', 'P0', '本次使用的胆碱酯酶抑制剂、美金刚等。', [['多奈哌齐', '安理申', '思博海'], ['卡巴拉汀', '利斯的明', '艾斯能'], ['加兰他敏'], ['石杉碱甲', '哈伯因'], ['美金刚', '易倍申'], ['甘露特钠', 'GV-971', '九期一']], { granularity: 'encounter' }),
    listOf('G2', '抗 Aβ 单抗', 'G', 'P0', '抗淀粉样蛋白单克隆抗体治疗。', [['仑卡奈单抗', '仑卡奈', 'lecanemab', '乐意保'], ['多奈单抗', 'donanemab', '记能达'], ['阿杜卡奴单抗', 'aducanumab']], { granularity: 'encounter' }),
    presence('G3', 'ARIA（淀粉样蛋白相关影像异常）', 'G', 'P0', '抗 Aβ 治疗后 ARIA-E（水肿）或 ARIA-H（微出血）。', ['ARIA', 'ARIA-E', 'ARIA-H', '淀粉样蛋白相关影像异常'], { granularity: 'encounter' }),
    listOf('G4', '抗精神病药', 'G', 'P1', '用于 BPSD 的抗精神病药。', [['喹硫平', '思瑞康'], ['奥氮平', '再普乐'], ['利培酮', '维思通'], ['阿立哌唑'], ['氟哌啶醇']], { granularity: 'encounter' }),
    listOf('G5', '抗抑郁药', 'G', 'P2', '在用的抗抑郁药。', [['舍曲林', '左洛复'], ['西酞普兰'], ['艾司西酞普兰', '来士普'], ['米氮平'], ['曲唑酮'], ['帕罗西汀']], { granularity: 'encounter' }),
    presence('G6', '认知训练／康复', 'G', 'P2', '接受认知训练或认知康复。', ['认知训练', '认知康复', '记忆训练', '认知刺激'], { granularity: 'encounter' }),

    /* H 危险因素与共病 */
    presence('H1', '痴呆家族史', 'H', 'P0', '一、二级亲属有痴呆／AD 病史。', ['痴呆', '老年痴呆', '阿尔茨海默', '老年性痴呆', '记忆力下降'], { accept: ['家族'], granularity: 'patient' }),
    presence('H2', '高血压', 'H', 'P1', '高血压病史。', ['高血压'], { accept: HX, granularity: 'patient' }),
    presence('H3', '糖尿病', 'H', 'P1', '糖尿病病史。', ['糖尿病'], { accept: HX, granularity: 'patient' }),
    presence('H4', '卒中史', 'H', 'P1', '既往脑梗死／脑出血。', ['脑梗死', '脑梗塞', '脑出血', '脑卒中', '卒中'], { accept: HX, granularity: 'patient' }),
    presence('H5', '听力下降', 'H', 'P1', '听力减退或使用助听器（可干预危险因素）。', ['听力下降', '听力减退', '耳聋', '助听器', '耳背'], { accept: HX, granularity: 'patient' }),
    presence('H6', '抑郁病史', 'H', 'P2', '既往抑郁症／抑郁状态。', ['抑郁症', '抑郁状态', '抑郁障碍'], { accept: HX, granularity: 'patient' }),
    presence('H7', '颅脑外伤史', 'H', 'P2', '既往颅脑外伤。', ['颅脑外伤', '脑外伤', '头部外伤', '脑挫伤'], { accept: HX, granularity: 'patient' }),
    derived('H8', '就诊年龄', 'H', 'P0', '本次就诊时年龄。', { op: 'ageAt', at: '$encounter.start' }, { granularity: 'encounter' }),

    /* K 检验（可逆性病因筛查） */
    measure('K1', 'TSH', 'K', 'P1', 'TSH|促甲状腺(?:激素|素)', { unit: 'mIU/L', range: { min: 0, max: 150 } }),
    measure('K2', '维生素 B12', 'K', 'P1', '维生素\\s*B\\s*12|VitB12|VB12', { unit: 'pg/mL', range: { min: 20, max: 3000 } }),
    measure('K3', '叶酸', 'K', 'P2', '叶酸', { unit: 'ng/mL', range: { min: 0.1, max: 60 } }),
    measure('K4', '同型半胱氨酸', 'K', 'P2', '同型半胱氨酸|Hcy', { unit: 'μmol/L', range: { min: 1, max: 200 } }),
    text('K5', '主诉', 'K', 'P1', '本次就诊主诉原文。', { granularity: 'encounter', pick: 'first', sources: { sections: ['主诉'] }, rules: [{ id: 'chief', regex: '(?<v>[^\\n]{2,100})' }], recall: { regex: ['[^\\s]{2,}'] } }),
  ],
}
