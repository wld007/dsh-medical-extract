/**
 * 抑郁障碍（MDD）。依据见 docs/mdd-fields.md（ICD-10/11、DSM-5-TR、中国抑郁障碍防治指南第二版、CANMAT 2023、NICE NG222）。
 * 生成：node scripts/build-templates.mjs → templates/mdd.json
 */
import { lone } from './_lib.mjs'

const NUM = '[\\d一二两三四五六七八九十]+'
const DUR = '[\\d一二两三四五六七八九十半]+\\s*个?\\s*(?:年|月|周|星期|天)\\s*(?:余|多|左右|许)?'
const DX_SECTIONS = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
const HX = ['阳性', '既往']

const presence = (id, name, group, priority, definition, terms, extra = {}) => ({ id, name, group, priority, type: 'presence', definition, recall: { terms, ...(extra.regex ? { regex: extra.regex } : {}) }, ...extra, regex: undefined })
const score = (id, name, scale, head, range, extra = {}) => ({
  id, name, group: 'E', priority: extra.priority ?? 'P0', type: 'score', scale, granularity: 'timepoint',
  definition: `${name}总分（每次评定一条）。只取写明的总分，不取条目分、不取参考范围。`,
  range,
  rules: [{ id: `${id.toLowerCase()}-total`, regex: `(?:${head})\\s*(?:量表)?\\s*(?:[（(]?\\s*-?\\s*(?<variant>17|24)\\s*项?\\s*(?:版)?[)）]?)?\\s*(?:量表)?\\s*(?:评分|总分|得分|评定|测评|分值)?\\s*(?:结果)?\\s*[:：为是]?\\s*(?<v>\\d{1,3}(?:\\.\\d)?)\\s*分` }],
  recall: { regex: [head] },
  ...extra,
})
const drugs = (pairs) => pairs.map(([value, ...terms]) => ({ value, terms: [value, ...terms] }))

const ANTIDEPRESSANTS = drugs([
  ['舍曲林', '左洛复', '郁乐复', '唯他停'], ['氟西汀', '百忧解', '优克'], ['帕罗西汀', '赛乐特', '乐友'], ['西酞普兰', '喜普妙'],
  ['艾司西酞普兰', '来士普', '百洛特', '草酸艾司西酞普兰'], ['氟伏沙明', '兰释'], ['文拉法辛', '怡诺思', '博乐欣'], ['度洛西汀', '欣百达', '奥思平'],
  ['米那普仑', '诺伊'], ['米氮平', '瑞美隆', '派迪生'], ['伏硫西汀', '心达悦'], ['阿戈美拉汀', '维度新', '阿美宁'], ['安非他酮', '丁螺环酮以外的安非他酮', '乐孚亭'],
  ['曲唑酮', '美时玉'], ['阿米替林'], ['氯米帕明', '安拿芬尼'], ['多塞平'], ['马普替林'], ['米安色林'], ['噻奈普汀'], ['氟哌噻吨美利曲辛', '黛力新'], ['艾司氯胺酮'],
])
ANTIDEPRESSANTS.find((o) => o.value === '安非他酮').terms = ['安非他酮', '乐孚亭']
ANTIDEPRESSANTS.find((o) => o.value === '帕罗西汀').terms = ['帕罗西汀', '赛乐特']

export default {
  format: 'extract-template/1',
  id: 'mdd',
  name: '抑郁障碍（MDD）',
  version: '0.1.0',
  domain: '精神',
  references: [
    { title: '中国抑郁障碍防治指南（第二版），中华医学电子音像出版社 2015' },
    { title: '国家卫生健康委《精神障碍诊疗规范（2020 年版）》' },
    { title: 'CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults' },
    { title: 'NICE NG222 Depression in adults: treatment and management (2022)' },
    { title: 'DSM-5-TR；ICD-10 F32/F33；ICD-11 6A70/6A71' },
  ],
  description: '抑郁障碍研究队列的常用字段：诊断分型、病程、症状、自杀与安全、量表、药物与非药物治疗、疗效与转归、共病、人口学与危险因素、关键检验。',
  groups: [
    { id: 'A', name: '诊断与分型' }, { id: 'B', name: '病程' }, { id: 'C', name: '症状' }, { id: 'D', name: '自杀与安全' }, { id: 'E', name: '量表' },
    { id: 'F', name: '药物治疗' }, { id: 'G', name: '非药物治疗' }, { id: 'H', name: '疗效与转归' }, { id: 'I', name: '共病' }, { id: 'J', name: '人口学与危险因素' }, { id: 'K', name: '检验' },
  ],
  lexicon: { pseudoNegation: ['无明显好转', '无效', '无自知力', '无兴趣', '无愉快感'] },
  fields: [
    /* ---------------------------------------------------------- A 诊断与分型 */
    { id: 'A1', name: '抑郁相关诊断', group: 'A', priority: 'P0', type: 'list', definition: '诊断栏或诊断记录里写明的抑郁相关诊断名称（原文写法）。', sources: { sections: DX_SECTIONS }, rules: [{ id: 'dx', regex: '(?<v>[^\\n，,。；;：:]{0,16}(?:抑郁|心境障碍)[^\\n，,。；;：:]{0,16})' }], recall: { terms: ['抑郁', '心境障碍'] }, granularity: 'encounter' },
    { id: 'A1c', name: 'ICD-10 编码（F30–F39）', group: 'A', priority: 'P0', type: 'list', definition: '诊断编码中 F30–F39（心境障碍）的编码。', rules: [{ id: 'icd', regex: '(?<![A-Za-z0-9])(?<v>F3\\d(?:\\.\\d{1,2})?)(?![0-9A-Za-z])' }], recall: { regex: ['(?<![A-Za-z0-9])F3\\d'] }, granularity: 'encounter' },
    {
      id: 'A2', name: '发作类型', group: 'A', priority: 'P0', type: 'enum', definition: '本次诊断是单次发作还是复发性抑郁障碍。', granularity: 'encounter',
      options: [{ value: '单次发作', terms: ['单次发作', '首次发作', '首发抑郁'] }, { value: '复发性', terms: ['复发性抑郁', '复发性', '反复发作', '再次发作'] }],
      rules: [{ id: 'icd-f32', regex: '(?<![A-Za-z0-9])F32(?:\\.\\d+)?(?![0-9A-Za-z])', value: '单次发作' }, { id: 'icd-f33', regex: '(?<![A-Za-z0-9])F33(?:\\.\\d+)?(?![0-9A-Za-z])', value: '复发性' }],
      sources: { sections: [...DX_SECTIONS, '现病史'] },
    },
    {
      id: 'A3', name: '当前发作严重程度', group: 'A', priority: 'P0', type: 'enum', definition: '当前抑郁发作的严重程度（轻度、中度、重度）。', granularity: 'encounter',
      options: [{ value: '轻度', terms: ['轻度抑郁', '轻度发作', '目前为轻度'] }, { value: '中度', terms: ['中度抑郁', '中度发作', '目前为中度'] }, { value: '重度', terms: ['重度抑郁', '重度发作', '目前为重度', '重性抑郁'] }],
      rules: [{ id: 'icd-mild', regex: '(?<![A-Za-z0-9])F3[23]\\.0(?![0-9])', value: '轻度' }, { id: 'icd-moderate', regex: '(?<![A-Za-z0-9])F3[23]\\.1(?![0-9])', value: '中度' }, { id: 'icd-severe', regex: '(?<![A-Za-z0-9])F3[23]\\.[23](?![0-9])', value: '重度' }],
      sources: { sections: DX_SECTIONS },
    },
    presence('A4', '伴精神病性症状', 'A', 'P0', '诊断写明伴精神病性症状（或编码 F32.3/F33.3）。', ['精神病性症状'], { rules: [{ id: 'icd-psychotic', regex: '(?<![A-Za-z0-9])F3[23]\\.3(?![0-9])', value: '有' }], sources: { sections: DX_SECTIONS }, granularity: 'encounter' }),
    {
      id: 'A6', name: '特征标注', group: 'A', priority: 'P1', type: 'list', definition: '医生明确写出的 DSM-5 特征标注。', granularity: 'encounter',
      options: [{ value: '焦虑痛苦', terms: ['焦虑痛苦', '伴焦虑痛苦', '焦虑性抑郁'] }, { value: '混合特征', terms: ['混合特征', '伴混合特征'] }, { value: '忧郁特征', terms: ['忧郁特征', '伴忧郁特征', '内源性'] },
        { value: '非典型特征', terms: ['非典型特征', '不典型特征'] }, { value: '紧张症', terms: ['紧张症', '木僵'] }, { value: '围产期起病', terms: ['围产期', '产后抑郁', '产后起病'] }, { value: '季节性模式', terms: ['季节性'] }],
    },
    presence('A7', '双相诊断或躁狂发作史', 'A', 'P0', '曾诊断或转为双相情感障碍，或有躁狂/轻躁狂发作史（研究常用排除条件）。', ['双相情感障碍', '双相障碍', '双相', '躁狂发作', '轻躁狂发作', '躁狂相'], { accept: HX, granularity: 'patient', sources: { sections: [...DX_SECTIONS, '主诉', '现病史', '既往史', '正文', '病程记录', '诊疗经过'] } }),
    { id: 'A9', name: '主诉', group: 'A', priority: 'P1', type: 'text', definition: '本次就诊主诉原文。', sources: { sections: ['主诉'] }, rules: [{ id: 'chief', regex: '(?<v>[^\\n]{2,100})' }], recall: { regex: ['[^\\s]{2,}'] }, granularity: 'encounter', pick: 'first' },

    /* ---------------------------------------------------------------- B 病程 */
    {
      id: 'B1', name: '首次发病时间', group: 'B', priority: 'P0', type: 'date', granularity: 'patient', pick: 'earliest', accept: HX,
      definition: '抑郁（或心境障碍）第一次发病的时间。主诉里"反复情绪低落5年"的总病程可用；"加重1月"不是首次发病。',
      sources: { sections: ['主诉', '现病史'] },
      rules: [
        { id: 'first-abs', regex: '(?<date>\\d{4}\\s*年(?:\\s*\\d{1,2}\\s*月)?)[^。；\\n]{0,16}?(?:首次|初次|第一次)(?:发病|起病|出现)' },
        { id: 'first-rel', regex: '(?<date>' + DUR + '\\s*前)[^。；\\n]{0,10}?(?:首次|初次|第一次)?(?:发病|起病)' },
        { id: 'chief-total', regex: '^(?:反复|间断|持续)?[^，,。；\\d]{0,12}(?<date>' + DUR + ')(?=[，,。；]|$)', sections: ['主诉'] },
      ],
      recall: { terms: ['首次发病', '首次起病', '初次发病', '起病', '发病'], regex: [DUR] },
    },
    { id: 'B2', name: '首发年龄', group: 'B', priority: 'P0', type: 'derived', granularity: 'patient', definition: '首次发病时间时的年龄（由出生日期计算）。', derive: { op: 'ageAt', at: 'B1' } },
    {
      id: 'B3', name: '本次发作起病时间', group: 'B', priority: 'P0', type: 'date', granularity: 'encounter', pick: 'latest', model: 'always',
      definition: '本次发作（或本次加重）开始的时间；主诉"情绪低落3年，加重1月"取"1月"那次。', sources: { sections: ['主诉', '现病史'] },
      recall: { terms: ['加重', '再发', '复发', '起病', '出现'], regex: [DUR] },
    },
    { id: 'B4', name: '本次发作病程（月）', group: 'B', priority: 'P0', type: 'derived', granularity: 'encounter', definition: '本次发作起病到本次就诊的月数。', derive: { op: 'monthsBetween', from: 'B3', to: '$encounter.start' } },
    { id: 'B5', name: '既往发作次数', group: 'B', priority: 'P1', type: 'number', granularity: 'patient', pick: 'max', accept: HX, unit: '次', range: { min: 0, max: 50 }, definition: '既往抑郁（或躁狂）发作次数。', rules: [{ id: 'episodes-a', regex: '第\\s*(?<v>' + NUM + ')\\s*次(?:发作|发病|复发)' }, { id: 'episodes-b', regex: '(?:发作|复发|发病)\\s*(?<v>' + NUM + ')\\s*次' }], recall: { regex: ['第\\s*' + NUM + '\\s*次(?:发作|发病|复发)', '(?:发作|复发|发病)\\s*' + NUM + '\\s*次'] } },
    { id: 'B6', name: '既往精神科住院次数', group: 'B', priority: 'P1', type: 'number', granularity: 'patient', pick: 'max', accept: HX, unit: '次', range: { min: 0, max: 50 }, definition: '既往因精神障碍住院的次数（不含本次）。', rules: [{ id: 'adm', regex: '(?:住院|入院)\\s*(?<v>' + NUM + ')\\s*次' }], recall: { regex: ['(?:住院|入院)\\s*' + NUM + '\\s*次'] } },

    /* ---------------------------------------------------------------- C 症状 */
    presence('C1', '情绪低落', 'C', 'P0', '当前存在情绪低落、心情差、高兴不起来。', ['情绪低落', '心情低落', '心境低落', '心情差', '情绪差', '心情不好', '高兴不起来', '开心不起来', '郁郁寡欢', '闷闷不乐', '情绪低', '想哭', '哭泣']),
    presence('C2', '兴趣减退或快感缺失', 'C', 'P0', '对以前喜欢的事失去兴趣、体验不到乐趣。', ['兴趣减退', '兴趣下降', '兴趣缺乏', '不感兴趣', '提不起兴趣', '快感缺失', '愉快感缺失', '兴趣索然', '无兴趣', '无愉快感']),
    presence('C3', '精力下降或易疲劳', 'C', 'P0', '精力不足、容易疲乏、没力气。', ['精力下降', '精力差', '精力不足', '乏力', '疲乏', '易疲劳', '疲劳', '没力气', '懒动']),
    presence('C4', '注意力或思维能力下降', 'C', 'P0', '注意力不集中、记忆力下降、思维迟缓、犹豫不决。', ['注意力不集中', '注意力下降', '注意力差', '记忆力下降', '记忆力减退', '思维迟缓', '反应迟钝', '脑子变慢', '思考困难', '犹豫不决']),
    presence('C5', '自责自罪或自我评价低', 'C', 'P0', '自责、内疚、觉得自己没用、拖累家人。', ['自责', '自罪', '内疚', '自我评价低', '无用感', '无价值感', '觉得自己没用', '拖累家人', '自卑']),
    presence('C6', '无望或无助感', 'C', 'P1', '觉得没有希望、无助、绝望。', ['无望感', '无望', '无助感', '无助', '绝望', '看不到希望', '没有希望', '前途渺茫']),
    presence('C7', '睡眠障碍', 'C', 'P0', '失眠、入睡困难、眠浅易醒、早醒等睡眠问题。', ['睡眠障碍', '失眠', '睡眠差', '眠差', '夜眠差', '入睡困难', '难以入睡', '睡眠浅', '易醒', '多梦']),
    presence('C7b', '早醒', 'C', 'P1', '比平时早醒 2 小时以上、醒后难以再睡。', ['早醒', '凌晨即醒', '醒得早']),
    presence('C8', '食欲减退', 'C', 'P0', '食欲下降、进食减少。', ['食欲减退', '食欲下降', '食欲差', '食欲不振', '纳差', '胃纳差', '胃口差', '进食减少', '不想吃饭']),
    presence('C9', '体重下降', 'C', 'P1', '近期体重明显下降。', ['体重下降', '体重减轻', '体重减少', '消瘦']),
    presence('C10', '精神运动性迟滞', 'C', 'P0', '言语动作减少、迟缓。', ['精神运动性迟滞', '精神运动迟滞', '迟滞', '动作迟缓', '行动迟缓', '言语减少', '少语', '语速慢', '语速缓慢', '懒言少动']),
    presence('C10b', '激越', 'C', 'P1', '坐立不安、来回走动、搓手顿足等激越表现。', ['激越', '坐立不安', '来回踱步', '搓手顿足', '烦躁不安']),
    presence('C11', '焦虑或紧张', 'C', 'P0', '当前焦虑、紧张、担心、心烦。', ['焦虑', '紧张', '担心', '担忧', '心烦', '烦躁', '恐惧', '害怕'], { sources: { sections: ['主诉', '现病史', '精神检查', '正文', '入院情况', '病程记录', '体格检查'] } }),
    presence('C12', '躯体不适', 'C', 'P1', '伴随的躯体症状（头痛、头晕、胸闷、心慌、胃肠不适、全身不适）。', ['躯体不适', '躯体症状', '头痛', '头晕', '胸闷', '心慌', '心悸', '胃部不适', '腹胀', '全身不适', '周身不适'], { sources: { sections: ['主诉', '现病史', '精神检查'] } }),
    presence('C13', '幻觉', 'C', 'P0', '当前存在幻听、幻视等幻觉。', ['幻觉', '幻听', '幻视', '凭空闻声', '凭空视物']),
    presence('C13b', '妄想', 'C', 'P0', '当前存在妄想（被害、罪恶、虚无、疑病等）。', ['妄想', '被害感', '关系妄想', '罪恶妄想', '虚无妄想', '疑病妄想']),
    presence('C14', '晨重夜轻', 'C', 'P2', '情绪早上重、晚上轻的昼夜节律。', ['晨重夜轻', '昼重夜轻']),
    {
      id: 'C15', name: '自知力', group: 'C', priority: 'P1', type: 'enum', definition: '精神检查记录的自知力。', granularity: 'encounter', pick: 'last',
      options: [{ value: '完整', terms: ['自知力完整', '自知力存在', '有自知力', '自知力好', '自知力恢复'] }, { value: '部分', terms: ['自知力部分', '部分自知力', '自知力不完整', '自知力部分存在'] }, { value: '缺乏', terms: ['自知力缺乏', '无自知力', '自知力缺失', '自知力差', '自知力不存在'] }],
    },

    /* ------------------------------------------------------------ D 自杀与安全 */
    presence('D1', '自杀意念', 'D', 'P0', '当前存在自杀意念、消极观念（想死、不想活）。', ['自杀意念', '自杀观念', '自杀想法', '轻生念头', '轻生', '想死', '不想活', '活着没意思', '消极观念', '消极念头', '厌世', '结束生命']),
    presence('D2', '自杀计划', 'D', 'P0', '有具体的自杀计划或准备。', ['自杀计划', '计划自杀', '准备自杀', '写遗书', '囤积药物']),
    presence('D3', '自杀未遂史', 'D', 'P0', '曾有自杀行为（服药、割腕、跳楼、自缢等），含本次发作内。', ['自杀未遂', '自杀行为', '服药自杀', '割腕', '跳楼', '跳河', '自缢', '上吊', '过量服药', '服毒', '自杀史'], { accept: HX, granularity: 'patient' }),
    { id: 'D3n', name: '自杀未遂次数', group: 'D', priority: 'P1', type: 'number', granularity: 'patient', pick: 'max', accept: HX, unit: '次', range: { min: 0, max: 30 }, definition: '自杀未遂的次数。', rules: [{ id: 'count-a', regex: '(?:自杀未遂|自杀行为|自杀)[^。；\\n]{0,6}?(?<v>' + NUM + ')\\s*次' }, { id: 'count-b', regex: '(?<v>' + NUM + ')\\s*次[^。；\\n]{0,4}?(?:自杀未遂|自杀行为|自杀)' }], recall: { regex: ['自杀[^。；\\n]{0,6}' + NUM + '\\s*次', NUM + '\\s*次[^。；\\n]{0,4}自杀'] } },
    presence('D4', '本次发作自杀或自伤行为', 'D', 'P0', '本次发作期间发生的自杀或自伤行为（不含既往发作）。', ['自杀未遂', '自杀行为', '服药自杀', '割腕', '跳楼', '自缢', '过量服药', '自伤', '自残']),
    presence('D5', '非自杀性自伤', 'D', 'P1', '无自杀意图的自伤（划伤、撞头等）。', ['非自杀性自伤', '自伤', '自残', '划伤', '撞头', '用刀划']),
    {
      id: 'D6', name: '自杀风险评估等级', group: 'D', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'last', definition: '医生或量表评估的自杀风险等级。',
      options: [{ value: '高', terms: ['高风险', '高危', '风险高', '危险性高'] }, { value: '中', terms: ['中风险', '中危', '风险中等', '中度风险'] }, { value: '低', terms: ['低风险', '低危', '风险低', '危险性低'] }],
      recall: { regex: ['自杀(?:风险|危险)(?:评估)?[^。；\\n]{0,10}', '(?:高|中|低)(?:风险|危)[^。；\\n]{0,4}自杀'] },
    },

    /* ---------------------------------------------------------------- E 量表 */
    score('E1', 'HAMD', 'HAMD', 'HAMD|HAM-D|HRSD|汉密尔顿抑郁(?:量表)?|汉密顿抑郁(?:量表)?', { min: 0, max: 76 }, { variants: { 'HAMD-17': ['17'], 'HAMD-24': ['24'] } }),
    score('E2', 'HAMA', 'HAMA', 'HAMA|HAM-A|汉密尔顿焦虑(?:量表)?|汉密顿焦虑(?:量表)?', { min: 0, max: 56 }),
    score('E3', 'MADRS', 'MADRS', 'MADRS|蒙哥马利(?:抑郁)?(?:量表)?', { min: 0, max: 60 }, { priority: 'P1' }),
    score('E4', 'PHQ-9', 'PHQ-9', 'PHQ-?9|患者健康问卷', { min: 0, max: 27 }),
    score('E5', 'GAD-7', 'GAD-7', 'GAD-?7', { min: 0, max: 21 }, { priority: 'P1' }),
    score('E6', 'SDS', 'SDS', 'SDS|抑郁自评量表', { min: 20, max: 100 }, { priority: 'P1' }),
    score('E8', 'YMRS', 'YMRS', 'YMRS|杨氏躁狂(?:量表)?', { min: 0, max: 60 }, { priority: 'P1' }),

    /* ------------------------------------------------------------ F 药物治疗 */
    { id: 'F1', name: '抗抑郁药（当前）', group: 'F', priority: 'P0', type: 'list', granularity: 'encounter', model: 'always', definition: '本次就诊在用、新开或调整的抗抑郁药（通用名；商品名归一到通用名）。既往用过已停的不算。', options: ANTIDEPRESSANTS },
    { id: 'F2', name: '抗精神病药增效', group: 'F', priority: 'P0', type: 'list', granularity: 'encounter', definition: '在用的非典型抗精神病药（增效或伴精神病性症状时使用）。',
      options: drugs([['喹硫平', '思瑞康'], ['奥氮平', '再普乐', '欧兰宁'], ['阿立哌唑', '安立复', '博思清'], ['利培酮', '维思通'], ['布瑞哌唑'], ['齐拉西酮'], ['氨磺必利'], ['鲁拉西酮'], ['帕利哌酮'], ['舒必利']]) },
    { id: 'F3', name: '心境稳定剂', group: 'F', priority: 'P0', type: 'list', granularity: 'encounter', definition: '在用的心境稳定剂（锂盐、抗癫痫类）。', options: drugs([['碳酸锂', '锂盐'], ['丙戊酸', '丙戊酸钠', '德巴金'], ['拉莫三嗪', '利必通'], ['卡马西平'], ['奥卡西平']]) },
    { id: 'F4', name: '苯二氮䓬类及助眠药', group: 'F', priority: 'P1', type: 'list', granularity: 'encounter', definition: '在用的苯二氮䓬类与非苯二氮䓬类助眠药。',
      options: drugs([['劳拉西泮', '罗拉'], ['阿普唑仑'], ['氯硝西泮'], ['地西泮', '安定'], ['奥沙西泮'], ['艾司唑仑', '舒乐安定'], ['唑吡坦', '思诺思'], ['佐匹克隆'], ['右佐匹克隆']]) },
    { id: 'F5', name: '换药或停药原因', group: 'F', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'all', model: 'always', definition: '抗抑郁药换药、减药或停药的原因。',
      options: [{ value: '疗效不佳', terms: ['疗效欠佳', '疗效不佳', '效果不佳', '效果差', '无明显改善'] }, { value: '不良反应', terms: ['不良反应', '副作用', '副反应', '不能耐受', '难以耐受'] }, { value: '依从性差', terms: ['自行停药', '依从性差'] }, { value: '病情缓解', terms: ['病情稳定', '缓解后减量'] }, { value: '其他' }],
      recall: { terms: ['换用', '改用', '换为', '停用', '停药', '减量', '换药'] } },
    { id: 'F6', name: '出院带药', group: 'F', priority: 'P0', type: 'text', granularity: 'encounter', pick: 'all', definition: '出院医嘱里的带药（药名、剂量、用法原文）。', sources: { sections: ['出院医嘱'] }, rules: [{ id: 'discharge-meds', regex: '(?<v>[^。；\\n]{4,200})' }], recall: { regex: ['[^\\s]{4,}'] } },
    { id: 'F7', name: '服药依从性', group: 'F', priority: 'P1', type: 'enum', granularity: 'encounter', pick: 'last', definition: '病人服药依从性。',
      options: [{ value: '良好', terms: ['规律服药', '按时服药', '依从性好', '依从性良好', '坚持服药'] }, { value: '差', terms: ['依从性差', '不规律服药', '间断服药', '未规律服药', '服药不规律'] }, { value: '自行停药', terms: ['自行停药', '自行减药', '擅自停药', '自行停用'] }] },
    { id: 'F8', name: '抗抑郁药种数', group: 'F', priority: 'P1', type: 'derived', granularity: 'encounter', definition: '本次就诊记录的不同抗抑郁药种数。', derive: { op: 'countOf', field: 'F1' } },
    { id: 'F9', name: '既往抗抑郁药', group: 'F', priority: 'P0', type: 'list', granularity: 'patient', accept: ['既往'], model: 'always', definition: '既往用过、本次就诊前已停用的抗抑郁药（病史里写的"曾服用""当时予……后停药"，以及本次停用换掉的药）。', options: ANTIDEPRESSANTS },

    /* ---------------------------------------------------------- G 非药物治疗 */
    presence('G1', 'MECT', 'G', 'P0', '本次接受无抽搐电休克治疗（MECT/ECT）。', ['MECT', 'ECT', '无抽搐电休克', '改良电休克', '电休克治疗', '电痉挛治疗'], { granularity: 'encounter' }),
    { id: 'G2', name: 'MECT 次数', group: 'G', priority: 'P1', type: 'number', granularity: 'encounter', pick: 'max', unit: '次', range: { min: 1, max: 40 }, definition: 'MECT 治疗次数。', rules: [{ id: 'mect-n', regex: '(?:MECT|ECT|电休克|电痉挛)(?:治疗)?[^。；\\n]{0,8}?(?<v>' + NUM + ')\\s*次' }, { id: 'mect-n2', regex: '(?<v>' + NUM + ')\\s*次\\s*(?:MECT|ECT|电休克|电痉挛)' }], recall: { regex: ['(?:MECT|ECT|电休克|电痉挛)[^。；\\n]{0,10}' + NUM + '\\s*次', NUM + '\\s*次\\s*(?:MECT|ECT|电休克)'] } },
    presence('G3', 'rTMS', 'G', 'P1', '本次接受重复经颅磁刺激治疗。', ['rTMS', '经颅磁刺激', '重复经颅磁'], { granularity: 'encounter' }),
    { id: 'G4', name: '心理治疗', group: 'G', priority: 'P1', type: 'list', granularity: 'encounter', definition: '本次接受的心理治疗类型。',
      options: [{ value: '认知行为治疗', terms: ['认知行为治疗', '认知行为疗法', 'CBT'] }, { value: '人际心理治疗', terms: ['人际心理治疗', 'IPT'] }, { value: '支持性心理治疗', terms: ['支持性心理治疗', '支持性心理'] }, { value: '家庭治疗', terms: ['家庭治疗'] }, { value: '团体治疗', terms: ['团体治疗', '团体心理'] }, { value: '正念', terms: ['正念'] }, { value: '心理治疗（未分类）', terms: ['心理治疗', '心理疏导', '心理咨询'] }] },

    /* ---------------------------------------------------------- H 疗效与转归 */
    {
      id: 'H1', name: '出院疗效评价', group: 'H', priority: 'P0', type: 'enum', granularity: 'encounter', pick: 'last', definition: '出院时医生写的疗效评价。',
      options: [{ value: '痊愈', terms: ['痊愈', '治愈', '临床痊愈'] }, { value: '显效', terms: ['显效', '显著好转', '明显好转'] }, { value: '好转', terms: ['好转', '有所好转', '部分缓解'] }, { value: '无效', terms: ['无效', '未愈', '无明显好转'] }],
      sources: { recordTypes: ['出院记录'], sections: ['出院情况', '出院诊断', '正文'] },
    },
    { id: 'H2', name: 'HAMD 减分率（%）', group: 'H', priority: 'P0', type: 'derived', granularity: 'encounter', definition: '同次就诊内 HAMD 同版本 (首次−末次)/首次。', derive: { op: 'reduction', field: 'E1' } },
    { id: 'H3', name: '有效（减分率≥50%）', group: 'H', priority: 'P0', type: 'derived', granularity: 'encounter', definition: 'HAMD 减分率 ≥ 50%。', derive: { op: 'threshold', field: 'H2', cmp: '>=', value: 50 } },
    { id: 'H4', name: '临床缓解（末次 HAMD≤7）', group: 'H', priority: 'P0', type: 'derived', granularity: 'encounter', definition: '本次就诊末次 HAMD-17 ≤ 7。', derive: { op: 'threshold', field: 'E1', cmp: '<=', value: 7 } },
    presence('H5', '治疗中转躁', 'H', 'P0', '治疗过程中出现躁狂或轻躁狂（情绪高涨、兴奋话多）。', ['转躁', '转相', '躁狂', '轻躁狂', '情绪高涨', '兴奋话多'], { granularity: 'encounter', sources: { sections: ['诊疗经过', '病程记录', '出院情况', '现病史', '正文'] } }),
    { id: 'H6', name: '药物不良反应', group: 'H', priority: 'P1', type: 'list', granularity: 'encounter', model: 'always', definition: '记录的药物不良反应（名称）。',
      options: [{ value: '恶心呕吐', terms: ['恶心', '呕吐'] }, { value: '口干', terms: ['口干'] }, { value: '便秘', terms: ['便秘'] }, { value: '嗜睡', terms: ['嗜睡', '困倦'] }, { value: '头晕', terms: ['头晕'] }, { value: '体重增加', terms: ['体重增加', '体重增长'] },
        { value: '性功能障碍', terms: ['性功能障碍', '性欲减退'] }, { value: '震颤', terms: ['震颤', '手抖'] }, { value: '心悸', terms: ['心悸', '心慌'] }, { value: 'QTc 延长', terms: ['QTc延长', 'QT间期延长'] }, { value: '低钠血症', terms: ['低钠'] }, { value: '静坐不能', terms: ['静坐不能'] }],
      recall: { terms: ['不良反应', '副反应', '副作用', '药物反应'] } },

    /* ---------------------------------------------------------------- I 共病 */
    presence('I1', '焦虑障碍共病', 'I', 'P0', '诊断或病史中的焦虑障碍（广泛性焦虑、惊恐障碍等），不是症状层面的焦虑。', ['焦虑障碍', '焦虑症', '广泛性焦虑', '惊恐障碍', '惊恐发作', '社交焦虑'], { accept: HX, granularity: 'patient', sources: { sections: [...DX_SECTIONS, '既往史', '现病史'] } }),
    presence('I2', '物质使用障碍', 'I', 'P0', '酒精或其他物质依赖、滥用。', ['酒精依赖', '酒依赖', '酒精使用障碍', '物质滥用', '药物依赖', '酗酒'], { accept: HX, granularity: 'patient' }),
    presence('I3', '甲状腺疾病', 'I', 'P1', '甲状腺功能减退或亢进等甲状腺疾病。', ['甲状腺功能减退', '甲减', '甲状腺功能亢进', '甲亢', '桥本', '甲状腺炎'], { accept: HX, granularity: 'patient' }),

    /* ------------------------------------------------------ J 人口学与危险因素 */
    { id: 'J1', name: '就诊年龄', group: 'J', priority: 'P0', type: 'derived', granularity: 'encounter', definition: '本次就诊时的年龄（由出生日期计算）。', derive: { op: 'ageAt', at: '$encounter.start' } },
    { id: 'J2', name: '婚姻状况', group: 'J', priority: 'P1', type: 'enum', granularity: 'patient', pick: 'last', definition: '婚姻状况。',
      options: [{ value: '未婚', terms: ['未婚'] }, { value: '已婚', terms: ['已婚', '结婚', '婚后'] }, { value: '离异', terms: ['离异', '离婚'] }, { value: '丧偶', terms: ['丧偶'] }] },
    { id: 'J3', name: '职业', group: 'J', priority: 'P1', type: 'text', granularity: 'patient', pick: 'last', definition: '职业或就业状态。', rules: [{ id: 'occupation', regex: '职\\s*业\\s*[:：]\\s*(?<v>[^\\s，,。；|｜\\n]{1,20})' }], recall: { regex: ['职\\s*业\\s*[:：]'] } },
    { id: 'J4', name: '受教育程度', group: 'J', priority: 'P1', type: 'enum', granularity: 'patient', pick: 'last', definition: '最高学历。',
      options: [{ value: '文盲', terms: ['文盲'] }, { value: '小学', terms: ['小学'] }, { value: '初中', terms: ['初中'] }, { value: '高中/中专', terms: ['高中', '中专', '职高'] }, { value: '大专', terms: ['大专'] }, { value: '本科', terms: ['本科', '大学文化', '大学学历'] }, { value: '研究生', terms: ['研究生', '硕士', '博士'] }],
      recall: { regex: ['(?:文化程度|学历|文化)[^。；\\n]{0,8}', '(?:小学|初中|高中|中专|大专|本科|研究生|硕士|博士)(?:文化|学历|毕业)'] } },
    presence('J5', '精神疾病家族史', 'J', 'P0', '一、二级亲属中有精神疾病（抑郁、双相、精神分裂等）。', ['精神病', '精神疾病', '精神异常', '精神障碍', '抑郁', '双相', '精神分裂', '焦虑'], { accept: ['家族'], granularity: 'patient' }),
    presence('J6', '家族自杀史', 'J', 'P1', '亲属中有自杀死亡或自杀行为。', ['自杀'], { accept: ['家族'], granularity: 'patient' }),
    presence('J7', '吸烟', 'J', 'P1', '吸烟（含已戒）。', ['吸烟', '抽烟', '烟酒', '烟草'], { accept: HX, granularity: 'patient' }),
    presence('J8', '饮酒', 'J', 'P1', '饮酒（含已戒）。', ['饮酒', '喝酒', '烟酒', '酗酒'], { accept: HX, granularity: 'patient' }),

    /* ---------------------------------------------------------------- K 检验 */
    { id: 'K1', name: 'TSH', group: 'K', priority: 'P0', type: 'number', granularity: 'timepoint', unit: 'mIU/L', range: { min: 0, max: 150 }, definition: '促甲状腺激素检测值。', rules: [{ id: 'tsh', regex: '(?:TSH|促甲状腺(?:激素|素))[^。；\\n\\d]{0,24}?(?<v>\\d+(?:\\.\\d+)?)' }], recall: { regex: ['TSH', '促甲状腺(?:激素|素)'] } },
    { id: 'K2', name: '血钠', group: 'K', priority: 'P1', type: 'number', granularity: 'timepoint', unit: 'mmol/L', range: { min: 100, max: 180 }, definition: '血清钠检测值。', rules: [{ id: 'na', regex: '(?:血钠|血清钠|' + lone('钠') + ')[^。；\\n\\d]{0,24}?(?<v>1\\d{2}(?:\\.\\d+)?)\\s*mmol' }], recall: { regex: ['血钠', '血清钠', lone('钠')] } },
  ],
}
