/**
 * 急性缺血性卒中（AIS）。
 * 依据：中国急性缺血性卒中诊治指南 2023（中华神经科杂志 2024）；AHA/ASA 2019 早期管理指南；
 * TOAST 病因分型；ECASS 症状性颅内出血定义；mRS、NIHSS 量表。
 */
import { DUR, HX, date, derived, enumOf, listOf, measure, presence, scale, text } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']

export default {
  format: 'extract-template/1',
  id: 'stroke-ais',
  name: '急性缺血性卒中（AIS）',
  version: '0.1.0',
  domain: '神经',
  description: '急性缺血性卒中研究与质控常用字段：发病与到院时间、卒中严重程度、病因分型、再灌注治疗与时间节点、并发症、二级预防用药、危险因素、结局量表与关键检验。',
  references: [
    { title: '中国急性缺血性卒中诊治指南 2023（中华医学会神经病学分会，中华神经科杂志 2024）', url: 'https://case.cdn.medlive.cn/all/info-progress/show-215373_100.html' },
    { title: 'AHA/ASA Guidelines for the Early Management of Patients With Acute Ischemic Stroke (2019 update)' },
    { title: 'TOAST classification of subtypes of acute ischemic stroke (Adams 1993)' },
    { title: 'ECASS II/III symptomatic intracranial hemorrhage definitions' },
  ],
  documents: { excludeRecordTypes: ['门诊收费', '基本信息'] },
  groups: [
    { id: 'A', name: '诊断与分型' }, { id: 'B', name: '时间节点' }, { id: 'C', name: '严重程度与影像' }, { id: 'D', name: '再灌注治疗' },
    { id: 'E', name: '并发症' }, { id: 'F', name: '二级预防与出院用药' }, { id: 'G', name: '危险因素与既往史' }, { id: 'H', name: '结局' }, { id: 'K', name: '检验与生命体征' },
  ],
  fields: [
    /* A 诊断与分型 */
    { id: 'A1', name: '卒中相关诊断', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: '诊断栏写明的脑梗死／缺血性卒中／TIA 等诊断名称（原文写法）。', sources: { sections: DX }, rules: [{ id: 'dx', regex: '(?<v>[^\\n，,。；;：:]{0,14}(?:脑梗死|脑梗塞|缺血性卒中|缺血性脑卒中|脑栓塞|短暂性脑缺血发作|TIA)[^\\n，,。；;：:]{0,14})' }], recall: { terms: ['脑梗死', '脑梗塞', '缺血性卒中', '缺血性脑卒中', '脑栓塞', '短暂性脑缺血发作', 'TIA'] } },
    { id: 'A1c', name: 'ICD-10 编码（I63/G45）', group: 'A', priority: 'P0', type: 'list', granularity: 'encounter', definition: '脑梗死 I63.x、TIA G45.x 编码。', rules: [{ id: 'icd', regex: '(?<v>(?:I63|G45)(?:\\.\\d{1,3})?)' }], recall: { regex: ['I63', 'G45'] } },
    enumOf('A2', 'TOAST 病因分型', 'A', 'P0', 'TOAST 分型：大动脉粥样硬化、心源性栓塞、小血管闭塞、其他明确病因、不明原因。', [
      ['大动脉粥样硬化', '大动脉粥样硬化型'], ['心源性栓塞', '心源性栓塞型', '心源性脑栓塞'], ['小血管闭塞', '小动脉闭塞', '小血管闭塞型', '小动脉闭塞型', '腔隙性脑梗死'],
      ['其他明确病因', '其他明确病因型'], ['不明原因', '病因不明', '隐源性卒中', '隐源性'],
    ], { granularity: 'encounter', recall: { terms: ['TOAST', '分型', '大动脉粥样硬化', '心源性栓塞', '小动脉闭塞', '小血管闭塞', '腔隙性', '隐源性'] } }),
    enumOf('A3', 'OCSP 临床分型', 'A', 'P2', '牛津郡社区卒中项目分型。', [['完全前循环梗死', 'TACI'], ['部分前循环梗死', 'PACI'], ['后循环梗死', 'POCI'], ['腔隙性梗死', 'LACI']], { granularity: 'encounter' }),
    listOf('A4', '责任血管', 'A', 'P1', '影像或诊断写明的责任／闭塞血管。', [
      ['颈内动脉', 'ICA'], ['大脑中动脉M1段', 'M1段', 'MCA-M1'], ['大脑中动脉M2段', 'M2段'], ['大脑中动脉', 'MCA'], ['大脑前动脉', 'ACA'], ['大脑后动脉', 'PCA'], ['基底动脉', 'BA'], ['椎动脉', 'VA'],
    ], { granularity: 'encounter', recall: { terms: ['闭塞', '狭窄', '责任血管', '颈内动脉', '大脑中动脉', '大脑前动脉', '大脑后动脉', '基底动脉', '椎动脉', 'M1', 'M2'] } }),
    enumOf('A5', '病灶侧别', 'A', 'P2', '梗死灶所在半球。', [['左侧', '左侧半球', '左侧大脑'], ['右侧', '右侧半球', '右侧大脑'], ['双侧', '双侧半球']], { granularity: 'encounter', recall: { terms: ['梗死', '梗塞', '病灶'] } }),
    presence('A6', '醒后卒中／发病时间不明', 'A', 'P1', '晨起发现或发病时间不明的卒中。', ['醒后卒中', '晨起发现', '睡醒后发现', '起床时发现', '发病时间不明', '发病时间不详'], { granularity: 'encounter' }),

    /* B 时间节点 */
    date('B1', '发病（最后正常）时间', 'B', 'P0', '症状出现或最后看起来正常的时间；相对写法按文书写成时间换算。', { granularity: 'encounter', pick: 'earliest', model: 'always', sources: { sections: ['主诉', '现病史', '正文', '入院情况'] }, recall: { terms: ['发病', '起病', '突发', '最后正常', '出现'], regex: [DUR] } }),
    measure('B2', '发病至到院时间（小时）', 'B', 'P1', '发病(?:后|至)?(?:到院|入院|就诊|来院)|起病至(?:到院|就诊)', { unit: 'h', range: { min: 0, max: 720 }, granularity: 'encounter', pick: 'first', value: '\\d+(?:\\.\\d+)?', definition: '病历写明的发病到到院（就诊）时间，单位小时。' }),
    measure('B3', 'DNT（入院至溶栓，分钟）', 'B', 'P0', 'DNT|入院至(?:静脉)?溶栓(?:时间)?|门-针时间|进门(?:到|至)溶栓', { unit: 'min', range: { min: 0, max: 600 }, granularity: 'encounter', pick: 'first' }),
    measure('B4', 'DPT（入院至股动脉穿刺，分钟）', 'B', 'P1', 'DPT|入院至(?:股动脉)?穿刺|门-穿时间', { unit: 'min', range: { min: 0, max: 900 }, granularity: 'encounter', pick: 'first' }),
    measure('B5', '发病至溶栓时间（分钟）', 'B', 'P1', 'ONT|发病至溶栓(?:时间)?|OTT', { unit: 'min', range: { min: 0, max: 1440 }, granularity: 'encounter', pick: 'first' }),

    /* C 严重程度与影像 */
    scale('C1', 'NIHSS', 'C', 'P0', 'NIHSS|美国国立卫生研究院卒中量表|NIH卒中量表', { min: 0, max: 42 }),
    scale('C2', 'GCS', 'C', 'P2', 'GCS|格拉斯哥昏迷(?:评分|量表)', { min: 3, max: 15 }),
    scale('C3', 'ASPECTS', 'C', 'P1', 'ASPECTS|Alberta卒中项目早期CT评分', { min: 0, max: 10 }),
    presence('C4', '大血管闭塞（LVO）', 'C', 'P0', 'CTA/MRA/DSA 证实的颅内外大血管闭塞（颈内动脉、大脑中动脉 M1/M2、基底动脉等）。', ['大血管闭塞', 'LVO', '颈内动脉闭塞', '大脑中动脉闭塞', 'M1段闭塞', 'M2段闭塞', '基底动脉闭塞', '椎基底动脉闭塞'], { granularity: 'encounter' }),
    presence('C5', '出血转化', 'C', 'P0', '影像复查发现的梗死后出血转化（含无症状）。', ['出血转化', '梗死后出血', '出血性转化', 'HT', '渗血'], { granularity: 'encounter' }),

    /* D 再灌注治疗 */
    presence('D1', '静脉溶栓', 'D', 'P0', '本次给予静脉溶栓（阿替普酶、替奈普酶、尿激酶、瑞替普酶等）。', ['静脉溶栓', 'IVT', '阿替普酶', 'rt-PA', 'rtPA', '替奈普酶', 'TNK', '尿激酶', '瑞替普酶', '溶栓治疗'], { granularity: 'encounter' }),
    enumOf('D2', '溶栓药物', 'D', 'P0', '静脉溶栓所用药物。', [['阿替普酶', 'rt-PA', 'rtPA', '爱通立'], ['替奈普酶', 'TNK', 'rhTNK-tPA', '铭复乐'], ['尿激酶'], ['瑞替普酶']], { granularity: 'encounter', pick: 'all' }),
    presence('D3', '血管内治疗（取栓）', 'D', 'P0', '本次行机械取栓、动脉溶栓、血管成形或支架等血管内治疗。', ['血管内治疗', 'EVT', '机械取栓', '取栓术', '动脉取栓', '支架取栓', '抽吸取栓', '动脉溶栓', '血管内介入'], { granularity: 'encounter' }),
    enumOf('D4', '再通程度（mTICI／eTICI）', 'D', 'P0', '血管内治疗后的再灌注分级。', [['3'], ['2c'], ['2b'], ['2a'], ['1'], ['0']], { selfTerm: false, granularity: 'encounter', pick: 'last', recall: { regex: ['[me]?TICI\\s*\\d[abc]?'] }, rules: [{ id: 'tici', regex: '[me]?TICI\\s*(?:分级)?\\s*[:：为]?\\s*(?<v>3|2c|2b|2a|1|0)' }] }),
    presence('D5', '桥接治疗', 'D', 'P1', '静脉溶栓后桥接血管内治疗。', ['桥接', '桥接治疗', '溶栓后取栓'], { granularity: 'encounter' }),

    /* E 并发症 */
    presence('E1', '症状性颅内出血（sICH）', 'E', 'P0', '溶栓或取栓后出现、伴临床恶化（如 NIHSS 增加≥4 分）的颅内出血（ECASS 定义）。', ['症状性颅内出血', 'sICH', '症状性出血转化', '症状性脑出血'], { granularity: 'encounter' }),
    presence('E2', '卒中相关性肺炎', 'E', 'P0', '住院期间新发肺部感染／卒中相关性肺炎。', ['卒中相关性肺炎', 'SAP', '肺部感染', '吸入性肺炎', '坠积性肺炎', '肺炎'], { granularity: 'encounter' }),
    presence('E3', '吞咽障碍', 'E', 'P0', '吞咽功能障碍（洼田饮水试验异常等）。', ['吞咽障碍', '吞咽困难', '饮水呛咳', '洼田饮水试验'], { granularity: 'encounter' }),
    presence('E4', '早期神经功能恶化', 'E', 'P1', '病情进展／早期神经功能恶化（END）。', ['神经功能恶化', 'END', '病情进展', '症状加重', '病情加重'], { granularity: 'encounter' }),
    presence('E5', '恶性脑水肿／去骨瓣减压', 'E', 'P1', '大面积梗死伴恶性脑水肿或行去骨瓣减压。', ['恶性脑水肿', '脑疝', '去骨瓣减压', '中线移位'], { granularity: 'encounter' }),
    presence('E6', '深静脉血栓', 'E', 'P2', '住院期间下肢深静脉血栓。', ['深静脉血栓', 'DVT', '下肢静脉血栓'], { granularity: 'encounter' }),

    /* F 二级预防与出院用药 */
    listOf('F1', '抗血小板药', 'F', 'P0', '本次使用或出院带的抗血小板药（双抗写两条）。', [['阿司匹林', '拜阿司匹灵'], ['氯吡格雷', '波立维', '泰嘉'], ['替格瑞洛', '倍林达'], ['西洛他唑'], ['吲哚布芬'], ['替罗非班']], { granularity: 'encounter' }),
    listOf('F2', '抗凝药', 'F', 'P0', '本次使用或出院带的抗凝药。', [['华法林'], ['达比加群', '泰毕全'], ['利伐沙班', '拜瑞妥'], ['阿哌沙班', '艾乐妥'], ['艾多沙班'], ['低分子肝素', '依诺肝素', '那屈肝素', '达肝素']], { granularity: 'encounter' }),
    listOf('F3', '他汀类', 'F', 'P0', '本次使用或出院带的他汀类药物。', [['阿托伐他汀', '立普妥', '阿乐'], ['瑞舒伐他汀', '可定'], ['辛伐他汀'], ['普伐他汀'], ['匹伐他汀'], ['氟伐他汀']], { granularity: 'encounter' }),
    presence('F4', '双联抗血小板（DAPT）', 'F', 'P1', '阿司匹林联合氯吡格雷或替格瑞洛的双联抗血小板治疗。', ['双抗', '双联抗血小板', 'DAPT'], { granularity: 'encounter' }),
    { id: 'F5', name: '出院带药', group: 'F', priority: 'P0', type: 'text', granularity: 'encounter', pick: 'all', definition: '出院医嘱中的带药（原文）。', sources: { sections: ['出院医嘱'] }, rules: [{ id: 'discharge-meds', regex: '(?<v>[^。；\\n]{4,200})' }], recall: { regex: ['[^\\s]{4,}'] } },

    /* G 危险因素与既往史 */
    presence('G1', '高血压', 'G', 'P0', '高血压病史或诊断。', ['高血压', '高血压病'], { accept: HX, granularity: 'patient' }),
    presence('G2', '糖尿病', 'G', 'P0', '糖尿病病史或诊断。', ['糖尿病', '2型糖尿病', '1型糖尿病'], { accept: HX, granularity: 'patient' }),
    presence('G3', '心房颤动', 'G', 'P0', '心房颤动（含阵发性）。', ['心房颤动', '房颤', 'AF'], { accept: HX, granularity: 'patient' }),
    presence('G4', '既往卒中／TIA', 'G', 'P0', '既往脑梗死、脑出血或 TIA 病史。', ['脑梗死', '脑梗塞', '脑出血', '脑卒中', '卒中', 'TIA', '短暂性脑缺血发作'], { accept: ['既往'], granularity: 'patient' }),
    presence('G5', '冠心病', 'G', 'P1', '冠心病／心肌梗死病史。', ['冠心病', '冠状动脉粥样硬化性心脏病', '心肌梗死', '心梗', 'PCI术后', '冠脉支架'], { accept: HX, granularity: 'patient' }),
    presence('G6', '血脂异常', 'G', 'P1', '高脂血症／血脂异常病史。', ['高脂血症', '血脂异常', '高胆固醇血症', '高甘油三酯血症'], { accept: HX, granularity: 'patient' }),
    presence('G7', '吸烟', 'G', 'P1', '吸烟（含已戒）。', ['吸烟', '抽烟'], { accept: HX, granularity: 'patient' }),
    presence('G8', '饮酒', 'G', 'P2', '饮酒（含已戒）。', ['饮酒', '喝酒', '酗酒'], { accept: HX, granularity: 'patient' }),

    /* H 结局 */
    scale('H1', 'mRS', 'H', 'P0', 'mRS|改良Rankin(?:量表)?|改良RANKIN', { min: 0, max: 6 }),
    derived('H2', '入院年龄', 'H', 'P0', '本次就诊时年龄。', { op: 'ageAt', at: '$encounter.start' }, { granularity: 'encounter' }),
    measure('H3', '住院天数', 'H', 'P1', '住院(?:天数|日数)|共住院', { unit: '天', range: { min: 0, max: 365 }, granularity: 'encounter', pick: 'last', alt: [{ id: 'los-b', regex: '住院(?<v>\\d{1,3})\\s*天' }] }),
    presence('H4', '院内死亡', 'H', 'P0', '住院期间死亡。', ['死亡', '临床死亡', '宣告死亡', '抢救无效'], { granularity: 'encounter', sources: { sections: ['出院情况', '诊疗经过', '病程记录', '正文'] } }),
    enumOf('H5', '出院转归', 'H', 'P1', '出院时转归（原文写法归类）。', [['治愈', '痊愈'], ['好转', '明显好转', '症状好转'], ['未愈', '无好转'], ['死亡'], ['转院', '转上级医院', '转康复医院'], ['自动出院', '自动离院', '放弃治疗']], { granularity: 'encounter', pick: 'last', sources: { recordTypes: ['出院记录'] } }),

    /* K 检验与生命体征 */
    measure('K1', '入院收缩压', 'K', 'P1', '(?:BP|血压)\\s*[:：]?', { unit: 'mmHg', range: { min: 60, max: 280 }, value: '\\d{2,3}(?=\\s*/\\s*\\d{2,3})', definition: '血压记录中的收缩压（每次测量一条）。' }),
    measure('K2', 'LDL-C', 'K', 'P0', 'LDL-C|LDL|低密度脂蛋白(?:胆固醇)?', { unit: 'mmol/L', range: { min: 0.1, max: 15 } }),
    measure('K3', '糖化血红蛋白', 'K', 'P1', 'HbA1c|糖化血红蛋白', { unit: '%', range: { min: 3, max: 20 } }),
    measure('K4', '血糖', 'K', 'P2', '(?:随机|空腹|入院)?血糖|GLU|葡萄糖', { unit: 'mmol/L', range: { min: 1, max: 40 } }),
    measure('K5', '同型半胱氨酸', 'K', 'P2', '同型半胱氨酸|Hcy', { unit: 'μmol/L', range: { min: 1, max: 200 } }),
    measure('K6', 'INR', 'K', 'P2', 'INR|国际标准化比值', { unit: null, range: { min: 0.5, max: 10 } }),
    text('K7', '主诉', 'K', 'P1', '本次就诊主诉原文。', { granularity: 'encounter', pick: 'first', sources: { sections: ['主诉'] }, rules: [{ id: 'chief', regex: '(?<v>[^\\n]{2,100})' }], recall: { regex: ['[^\\s]{2,}'] } }),
  ],
}
