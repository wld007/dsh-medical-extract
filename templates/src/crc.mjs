/**
 * 结直肠癌。
 * 依据：国家卫生健康委《中国结直肠癌诊疗规范（2023 版）》；中国临床肿瘤学会（CSCO）结直肠癌诊疗指南 2024；
 * NCCN 结肠癌／直肠癌指南；AJCC 第 8 版分期；RECIST 1.1。RAS/BRAF 与 MMR/MSI 状态决定晚期一线靶向与免疫治疗选择。
 * 字段范围参考古脉 G-MPAS「结直肠癌专病」数据集目录。
 */
import { HX, ageNow, chief, cycles, date, death, derived, drugList, dxList, ecog, enumOf, fhx, hx, icd, lab, lines, listOf, measure, presence, recist, smoking, stageField, tnmText } from './_lib.mjs'

const DX = ['诊断', '初步诊断', '出院诊断', '入院诊断', 'ICD-10 名称', 'ICD-10']
const PATH = ['所见', '结论', '诊断', '病理诊断', '免疫组化', '正文', '辅助检查', '现病史', '病理', '手术经过']
const CRC = '(?:结肠|直肠|结直肠|盲肠|回盲部|乙状结肠|升结肠|降结肠|横结肠)[^\\n，,。；;：:]{0,6}?(?:癌|恶性肿瘤|Ca)'
const STAGES = ['0', 'I', 'IIA', 'IIB', 'IIC', 'IIIA', 'IIIB', 'IIIC', 'IVA', 'IVB', 'IVC']

export default {
  format: 'extract-template/1',
  id: 'crc',
  name: '结直肠癌（CRC）',
  version: '0.1.0',
  domain: '肿瘤',
  description: '结直肠癌真实世界研究常用字段：原发部位与距肛缘距离、组织学与分化、脉管／神经侵犯、TNM 与分期、淋巴结、转移部位、RAS/BRAF/MMR/MSI/HER2、手术方式与入路、造口与并发症、化疗方案与靶向／免疫药物、直肠癌放疗与等待观察、疗效与复发、症状与遗传背景、CEA/CA19-9。',
  references: [
    { title: '国家卫生健康委 中国结直肠癌诊疗规范（2023 版），中华外科杂志 2023;61(8)' },
    { title: '中国临床肿瘤学会（CSCO）结直肠癌诊疗指南 2024（人民卫生出版社）' },
    { title: 'NCCN Clinical Practice Guidelines in Oncology: Colon Cancer; Rectal Cancer' },
    { title: 'AJCC Cancer Staging Manual 8th ed.; RECIST 1.1' },
    { title: '古脉 G-MPAS 数据目录：结直肠癌专病（字段范围参考）', url: 'https://www.g-mpas.com/data.html' },
  ],
  groups: [
    { id: 'A', name: '诊断与病理' }, { id: 'B', name: '分期与转移' }, { id: 'C', name: '分子标志物' }, { id: 'D', name: '手术' },
    { id: 'E', name: '系统治疗' }, { id: 'F', name: '放疗与器官保留' }, { id: 'G', name: '疗效与结局' }, { id: 'H', name: '症状与危险因素' }, { id: 'K', name: '肿瘤标志物与检验' },
  ],
  fields: [
    /* A 诊断与病理 */
    dxList('A1', '结直肠癌相关诊断', 'A', 'P0', '诊断栏写明的结肠癌、直肠癌诊断（原文写法）。', CRC, ['结肠癌', '直肠癌', '结直肠癌', '肠癌', '结肠恶性肿瘤', '直肠恶性肿瘤', '结肠腺癌', '直肠腺癌', '乙状结肠癌', '升结肠癌', '降结肠癌', '横结肠癌', '盲肠癌'], { after: 20 }),
    icd('A1c', 'ICD-10 编码（C18–C20）', 'A', 'P0', '结肠、直肠乙状结肠连接处、直肠恶性肿瘤编码。', 'C1[89]|C20'),
    enumOf('A2', '原发部位', 'A', 'P0', '原发肿瘤部位：右半结肠（盲肠、升结肠、肝曲）、横结肠、左半结肠（脾曲、降结肠、乙状结肠）、直肠。', [
      ['右半结肠', '盲肠', '回盲部', '升结肠', '结肠肝曲', '肝曲'], ['横结肠'], ['左半结肠', '降结肠', '乙状结肠', '结肠脾曲', '脾曲'], ['直肠', '直肠乙状结肠交界', '直肠上段', '直肠中段', '直肠下段', '低位直肠'],
    ], { granularity: 'patient', pick: 'mode', sources: { sections: [...DX, ...PATH] } }),
    measure('A3', '肿瘤下缘距肛缘距离', 'A', 'P1', '距(?:离)?肛(?:缘|门)(?:约)?', { unit: 'cm', range: { min: 0, max: 30 }, value: '\\d{1,2}(?:\\.\\d)?(?=\\s*(?:cm|CM|厘米))', granularity: 'patient', pick: 'min', alt: [{ id: 'dist-b', regex: '(?<v>\\d{1,2}(?:\\.\\d)?)\\s*(?:cm|CM|厘米)\\s*(?:处)?[^。；\\n]{0,6}?距(?:离)?肛(?:缘|门)' }] }),
    enumOf('A4', '组织学类型', 'A', 'P0', 'WHO 组织学类型。', [['腺癌', '管状腺癌', '乳头状腺癌'], ['黏液腺癌', '粘液腺癌'], ['印戒细胞癌'], ['鳞状细胞癌', '鳞癌'], ['腺鳞癌'], ['神经内分泌癌', '神经内分泌肿瘤', 'NEC', '混合性腺神经内分泌癌', 'MANEC']], { granularity: 'patient', pick: 'mode', sources: { sections: [...DX, ...PATH] } }),
    enumOf('A5', '分化程度', 'A', 'P1', '组织学分化程度。', [['高分化'], ['中分化', '中-高分化', '中高分化'], ['低分化', '中-低分化', '中低分化'], ['未分化']], { granularity: 'patient', pick: 'mode', sources: { sections: [...DX, ...PATH] } }),
    presence('A6', '脉管侵犯', 'A', 'P1', '淋巴管／血管侵犯（LVI），含脉管内癌栓。', ['脉管侵犯', '脉管内癌栓', '脉管癌栓', 'LVI', '淋巴管侵犯', '血管侵犯'], { granularity: 'patient', sources: { sections: PATH } }),
    presence('A7', '神经侵犯', 'A', 'P1', '神经侵犯（PNI）。', ['神经侵犯', '神经束侵犯', '神经周围侵犯', 'PNI'], { granularity: 'patient', sources: { sections: PATH } }),
    measure('A8', '肿瘤出芽', 'A', 'P2', '肿瘤出芽|瘤芽|Bd', { unit: null, range: { min: 1, max: 3 }, value: '[1-3]', granularity: 'patient', pick: 'last', definition: '肿瘤出芽分级 Bd1–Bd3（记 1–3）。' }),
    date('A9', '病理确诊时间', 'A', 'P0', '病理（肠镜活检或术后）确诊的时间。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', sources: { sections: ['现病史', '既往史', '诊疗经过', '病例特点'] }, recall: { terms: ['确诊', '病理', '肠镜', '活检', '术后病理'] } }),
    derived('A10', '确诊年龄', 'A', 'P0', '确诊时年龄。', { op: 'ageAt', at: 'A9' }, { granularity: 'patient' }),

    /* B 分期与转移 */
    tnmText('B1', 'B', 'P0', 'cT3N1M0、pT4aN2bM0、ypT2N0M0'),
    stageField('B2', '临床／病理分期', 'B', 'P0', 'AJCC 第 8 版分期 0–IV 期及亚期（只认与结直肠癌写在同一句里的分期）。', STAGES, CRC),
    measure('B3', '阳性淋巴结数', 'B', 'P0', '(?:区域|肠周|系膜)?淋巴结', { unit: '枚', range: { min: 0, max: 80 }, value: '\\d{1,2}(?=\\s*\\/\\s*\\d{1,2})', granularity: 'patient', pick: 'max', definition: '病理报告阳性淋巴结数（"淋巴结 2/18"取 2）。' }),
    { id: 'B4', name: '检出淋巴结总数', group: 'B', priority: 'P1', type: 'number', granularity: 'patient', pick: 'max', unit: '枚', range: { min: 0, max: 150 }, definition: '病理检出淋巴结总数（"淋巴结 2/18"取 18；质控要求 ≥12 枚）。',
      rules: [{ id: 'ln-total', regex: '淋巴结[^。；;\\n]{0,12}?\\d{1,2}\\s*\\/\\s*(?<v>\\d{1,3})' }], recall: { regex: ['淋巴结'] } },
    presence('B5', '肝转移', 'B', 'P0', '肝转移。', ['肝转移', '肝脏转移', '肝多发转移'], { granularity: 'patient', accept: HX }),
    presence('B6', '肺转移', 'B', 'P0', '肺转移。', ['肺转移', '双肺转移', '肺多发转移'], { granularity: 'patient', accept: HX }),
    presence('B7', '腹膜转移', 'B', 'P0', '腹膜转移或腹膜种植。', ['腹膜转移', '腹膜种植', '腹膜播散', '腹腔种植', '网膜转移'], { granularity: 'patient', accept: HX }),
    presence('B8', '其他远处转移', 'B', 'P2', '骨、脑、卵巢、远处淋巴结等转移。', ['骨转移', '脑转移', '卵巢转移', '锁骨上淋巴结转移', '腹膜后淋巴结转移'], { granularity: 'patient', accept: HX }),
    enumOf('B9', '切除彻底性', 'B', 'P1', 'R0、R1、R2 切除。', [['R0', 'R0切除'], ['R1', 'R1切除'], ['R2', 'R2切除']], { selfTerm: false, granularity: 'patient', pick: 'last', rules: [{ id: 'r', regex: '(?<![A-Za-z0-9])(?<v>R[0-2])(?=\\s*切除|\\s*[，,。；;）)]|$)', map: { R0: 'R0', R1: 'R1', R2: 'R2' } }] }),
    presence('B10', '环周切缘阳性', 'B', 'P2', '直肠癌环周切缘（CRM）阳性（≤1 mm）。', ['环周切缘阳性', 'CRM阳性', 'CRM（+）', 'CRM(+)'], { granularity: 'patient' }),

    /* C 分子标志物 */
    enumOf('C1', 'RAS 状态', 'C', 'P0', 'KRAS/NRAS 状态：突变型或野生型（全 RAS 检测）。', [['突变型', 'KRAS突变', 'NRAS突变', 'RAS突变', 'KRAS基因突变', 'KRAS G12D', 'KRAS G12V', 'KRAS G12C', 'KRAS G13D', 'KRAS外显子2突变', 'KRAS第2外显子突变'], ['野生型', 'RAS野生型', 'KRAS野生型', '全RAS野生型', 'KRAS/NRAS野生型', '未见KRAS突变', 'RAS基因未见突变']], { selfTerm: false, granularity: 'patient', pick: 'last' }),
    enumOf('C2', 'BRAF V600E', 'C', 'P0', 'BRAF V600E 状态。', [['突变型', 'BRAF V600E突变', 'BRAF突变', 'BRAF V600E阳性', 'BRAF基因突变'], ['野生型', 'BRAF野生型', 'BRAF未见突变', 'BRAF V600E阴性', '未见BRAF突变']], { selfTerm: false, granularity: 'patient', pick: 'last' }),
    enumOf('C3', 'MMR 状态', 'C', 'P0', '错配修复蛋白免疫组化：pMMR 或 dMMR。', [['pMMR', '错配修复功能完整', 'MMR完整', '错配修复蛋白表达完整', 'MMR蛋白表达完整', '错配修复正常'], ['dMMR', '错配修复功能缺陷', 'MMR缺陷', '错配修复蛋白缺失', 'MLH1缺失', 'MSH2缺失', 'MSH6缺失', 'PMS2缺失', 'MLH1表达缺失', 'PMS2表达缺失']], { granularity: 'patient', pick: 'last' }),
    enumOf('C4', 'MSI 状态', 'C', 'P0', '微卫星状态：MSI-H、MSI-L 或 MSS。', [['MSI-H', '微卫星高度不稳定', '高度微卫星不稳定', 'MSI-high'], ['MSI-L', '微卫星低度不稳定', '低度微卫星不稳定'], ['MSS', '微卫星稳定']], { granularity: 'patient', pick: 'last' }),
    presence('C5', 'HER2 扩增／阳性', 'C', 'P1', 'HER2 扩增或 IHC 3+（RAS/BRAF 野生型时有意义）。', ['HER2扩增', 'HER2阳性', 'HER-2阳性', 'HER2（3+）', 'HER2（+++）', 'ERBB2扩增'], { granularity: 'patient' }),
    listOf('C6', '其他分子变异', 'C', 'P2', 'NTRK 融合、POLE 突变、PIK3CA 突变等。', [['NTRK融合'], ['POLE突变', 'POLE/POLD1突变'], ['PIK3CA突变'], ['RET融合'], ['TMB-H', 'TMB高']], { granularity: 'patient' }),

    /* D 手术 */
    listOf('D1', '手术方式', 'D', 'P0', '原发灶及转移灶手术方式。', [
      ['右半结肠切除', '右半结肠癌根治', '右半结肠根治'], ['横结肠切除', '横结肠癌根治'], ['左半结肠切除', '左半结肠癌根治'], ['乙状结肠切除', '乙状结肠癌根治'],
      ['直肠前切除', 'Dixon', 'Dixon术', '低位前切除', '超低位前切除', 'LAR'], ['腹会阴联合切除', 'Miles', 'Miles术', 'APR'], ['Hartmann', 'Hartmann术'],
      ['经括约肌间切除', 'ISR'], ['全直肠系膜切除', 'TME', 'taTME'], ['内镜下切除', 'ESD', 'EMR', '内镜黏膜下剥离'], ['经肛局部切除', 'TEM', 'TAMIS'], ['肝转移灶切除', '肝转移瘤切除', '肝部分切除'], ['肺转移灶切除'],
    ], { granularity: 'patient', accept: HX }),
    enumOf('D2', '手术入路', 'D', 'P1', '腹腔镜、机器人或开腹。', [['腹腔镜', '腔镜', '腹腔镜下'], ['机器人', '达芬奇', '机器人辅助'], ['开腹', '开放手术']], { granularity: 'patient', pick: 'all', accept: HX }),
    presence('D3', '造口', 'D', 'P0', '结肠或回肠造口（含预防性）。', ['造口', '造瘘', '回肠造口', '结肠造口', '回肠末端造口', '人工肛门', '肠造瘘'], { granularity: 'patient', accept: HX }),
    presence('D4', '吻合口瘘', 'D', 'P0', '术后吻合口瘘。', ['吻合口瘘', '吻合口漏'], { granularity: 'encounter' }),
    presence('D5', '肠梗阻', 'D', 'P1', '肿瘤性或术后肠梗阻。', ['肠梗阻', '不全性肠梗阻', '不完全性肠梗阻'], { granularity: 'encounter' }),
    presence('D6', '肠道支架', 'D', 'P2', '肠道支架置入（梗阻减压）。', ['肠道支架', '结肠支架', '肠梗阻支架'], { granularity: 'patient', accept: HX }),

    /* E 系统治疗 */
    drugList('E1', '化疗药物', 'E', 'P0', '化疗药物。', [[['奥沙利铂', '乐沙定', '艾恒', '奥正南'], ['伊立替康', '开普拓'], ['卡培他滨', '希罗达'], ['氟尿嘧啶', '5-FU', '5-氟尿嘧啶'], ['亚叶酸钙', '左亚叶酸钙'], ['替吉奥', 'S-1'], ['雷替曲塞', '赛维健'], ['曲氟尿苷替匹嘧啶', '朗斯弗', 'TAS-102'], ['伊立替康脂质体']]], { accept: HX }),
    listOf('E2', '化疗方案', 'E', 'P0', '写明的化疗方案名称。', [['FOLFOX', 'mFOLFOX6', 'FOLFOX4'], ['CAPEOX', 'XELOX'], ['FOLFIRI'], ['FOLFOXIRI', 'mFOLFOXIRI'], ['XELIRI', 'CAPIRI'], ['卡培他滨单药']], { granularity: 'encounter', accept: HX }),
    drugList('E3', '靶向药物', 'E', 'P0', '抗 VEGF、抗 EGFR 及其他靶向药物。', [[['贝伐珠单抗', '安维汀', '艾瑞妥', '达攸同', '安可达'], ['西妥昔单抗', '爱必妥'], ['帕尼单抗', '维克替比'], ['呋喹替尼', '爱优特'], ['瑞戈非尼', '拜万戈'], ['阿柏西普'], ['雷莫西尤单抗'], ['恩考芬尼'], ['索托拉西布'], ['阿达格拉西布'], ['曲妥珠单抗'], ['拉罗替尼'], ['恩曲替尼'], ['德曲妥珠单抗', 'T-DXd']]], { accept: HX }),
    drugList('E4', '免疫检查点抑制剂', 'E', 'P0', 'PD-1/PD-L1/CTLA-4 抑制剂。', [[['帕博利珠单抗', '可瑞达', 'K药'], ['纳武利尤单抗', '欧狄沃', 'O药'], ['伊匹木单抗'], ['恩沃利单抗', '恩维达'], ['替雷利珠单抗', '百泽安'], ['特瑞普利单抗', '拓益'], ['信迪利单抗', '达伯舒'], ['卡瑞利珠单抗', '艾瑞卡'], ['斯鲁利单抗'], ['卡度尼利单抗', '开坦尼']]], { accept: HX }),
    enumOf('E5', '治疗阶段', 'E', 'P1', '本次系统治疗所处阶段。', [['新辅助', '新辅助治疗', '新辅助化疗', '全程新辅助', 'TNT'], ['辅助', '辅助化疗', '术后辅助'], ['转化治疗', '转化化疗'], ['晚期姑息', '姑息化疗', '解救治疗', '一线治疗', '二线治疗', '维持治疗']], { selfTerm: false, granularity: 'encounter', pick: 'last' }),
    lines('E6', 'E', 'P1'),
    cycles('E7', 'E', 'P1'),

    /* F 放疗与器官保留 */
    listOf('F1', '放疗', 'F', 'P0', '直肠癌放疗方式及姑息放疗。', [['长程同步放化疗', '新辅助放化疗', '术前放化疗', '同步放化疗', '长程放化疗'], ['短程放疗', '短程放射治疗', '5×5Gy', '25Gy/5次', '25Gy/5f'], ['术后放化疗', '辅助放疗'], ['姑息放疗', '骨转移放疗'], ['立体定向放疗', 'SBRT', 'SABR']], { granularity: 'patient', accept: HX }),
    presence('F2', '临床完全缓解（cCR）', 'F', 'P1', '直肠癌新辅助后临床完全缓解。', ['临床完全缓解', 'cCR', '近完全临床缓解', 'near-cCR'], { granularity: 'patient', accept: HX }),
    presence('F3', '等待观察（W&W）', 'F', 'P2', 'cCR 后选择等待观察、非手术治疗。', ['等待观察', '观察等待', 'Watch and Wait', 'W&W', '非手术治疗'], { granularity: 'patient', accept: ['阳性', '既往', '计划'] }),
    presence('F4', '肝转移局部治疗', 'F', 'P2', '肝转移灶消融、TACE、HAIC 或 SBRT。', ['射频消融', '微波消融', 'TACE', 'HAIC', '肝动脉灌注化疗', '肝转移灶消融'], { granularity: 'patient', accept: HX }),

    /* G 疗效与结局 */
    recist('G1', 'G', 'P0'),
    presence('G2', '复发／转移', 'G', 'P0', '术后局部复发或新发远处转移。', ['复发', '局部复发', '吻合口复发', '远处转移', '新发转移', '新增转移', '复发转移'], { granularity: 'encounter' }),
    date('G3', '复发转移时间', 'G', 'P1', '首次确认复发或远处转移的时间。', { granularity: 'patient', pick: 'earliest', accept: HX, model: 'always', recall: { terms: ['复发', '转移'] } }),
    presence('G4', '疾病进展', 'G', 'P1', '晚期治疗中影像或临床确认的进展。', ['疾病进展', '病情进展', '进展'], { granularity: 'encounter' }),
    death('G5', 'G', 'P0', 'patient'),
    listOf('G6', '治疗不良反应', 'G', 'P1', '记录的治疗不良反应。', [['骨髓抑制', '白细胞减少', '中性粒细胞减少', '血小板减少'], ['周围神经毒性', '周围神经病变', '手足麻木', '神经毒性'], ['手足综合征'], ['腹泻'], ['痤疮样皮疹', '皮疹'], ['高血压'], ['蛋白尿'], ['肝功能损害', '转氨酶升高'], ['恶心呕吐', '恶心', '呕吐'], ['低镁血症'], ['免疫相关不良事件', 'irAE', '免疫相关性肺炎', '免疫性肝炎', '甲状腺功能减退']], { granularity: 'encounter', model: 'always', recall: { terms: ['不良反应', '毒副反应', '骨髓抑制', '腹泻', '手足', '麻木', '皮疹', '蛋白尿', '转氨酶升高', '免疫相关'] } }),

    /* H 症状与危险因素 */
    presence('H1', '便血', 'H', 'P0', '便血、黏液血便或大便带血。', ['便血', '血便', '黏液血便', '粘液血便', '大便带血', '黏液脓血便', '暗红色血便']),
    presence('H2', '排便习惯改变', 'H', 'P1', '排便次数增多、便秘腹泻交替、大便变细、里急后重。', ['排便习惯改变', '大便习惯改变', '大便次数增多', '排便次数增多', '便秘腹泻交替', '大便变细', '里急后重', '排便不尽感']),
    presence('H3', '腹痛', 'H', 'P2', '腹痛、腹胀。', ['腹痛', '腹胀', '腹部不适', '下腹痛']),
    presence('H4', '体重下降', 'H', 'P2', '近期体重明显下降。', ['体重下降', '消瘦', '体重减轻']),
    fhx('H5', '结直肠癌家族史', 'H', 'P0', '亲属结直肠癌史。', ['结直肠癌', '肠癌', '结肠癌', '直肠癌']),
    hx('H6', 'Lynch 综合征／遗传性肿瘤综合征', 'H', 'P1', 'Lynch 综合征、家族性腺瘤性息肉病等。', ['Lynch综合征', '林奇综合征', '遗传性非息肉病性结直肠癌', 'HNPCC', '家族性腺瘤性息肉病', 'FAP']),
    hx('H7', '炎症性肠病', 'H', 'P2', '溃疡性结肠炎或克罗恩病。', ['溃疡性结肠炎', '克罗恩病', '炎症性肠病']),
    hx('H8', '结直肠腺瘤／息肉史', 'H', 'P2', '既往结直肠腺瘤或息肉。', ['结肠息肉', '直肠息肉', '肠息肉', '腺瘤', '结肠腺瘤']),
    smoking('H9', 'H', 'P2'),
    ecog('H10', 'H', 'P1'),
    ageNow('H11', 'H', 'P0'),
    chief('H12', 'H', 'P1'),

    /* K 肿瘤标志物与检验 */
    lab('K1', 'cea', 'K', 'P0'),
    measure('K2', 'CA19-9', 'K', 'P0', 'CA\\s*-?19-?9|糖类抗原\\s*19-?9', { unit: 'U/mL', range: { min: 0, max: 100000 } }),
    measure('K3', 'CA72-4', 'K', 'P2', 'CA\\s*-?72-?4|糖类抗原\\s*72-?4', { unit: 'U/mL', range: { min: 0, max: 10000 } }),
    lab('K4', 'hb', 'K', 'P1'),
    lab('K5', 'alb', 'K', 'P2'),
  ],
}
