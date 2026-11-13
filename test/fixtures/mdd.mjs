/**
 * 虚构 MDD 病人（区域平台导出格式，按月分文件）。内容全部编造，覆盖：否认／既往／家族／计划语境、
 * 商品名、HAMD 17/24 项、主诉时长、出院医嘱、诊断编码、前后矛盾（自杀未遂次数）、检验、作废记录、第二版入院记录。
 * 另有 synthNdjson：按模板句式批量生成通用 ndjson 文书，用来压测。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const ts = (s) => String(Date.parse(`${s.replace(' ', 'T')}:00+08:00`))
const cn = (s) => s.replace(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/, '$1年$2月$3日$4时$5分')

function admission({ record, chief, hpi, past, personal = '生于本地，否认烟酒嗜好。', marital = '已婚，育有1子。', family = '否认家族中精神疾病史。', exam, mental, aux = '无', dx }) {
  return [
    '入院记录', '姓    名:化名-000001      性     别:女', `入院时间 :${cn(record)}`, `病史陈述者:患者本人及家属      记录时间 :${cn(record)}`,
    `主  诉：${chief}`, `现病史：${hpi}`, `既往史：${past}`, `个人史：${personal}`, `婚育史：${marital}`, `家族史：${family}`,
    '', '体格检查', exam, '', `精神检查：${mental}`, '', '辅助检查', aux, '初步诊断:', ...dx.map((d) => `  ${d}`), '医生签名：医生-000003', `          ${record.slice(0, 10)}`, '',
  ].join('\n')
}

let seq = 0
const key = (p) => `${p}-${String(++seq).padStart(6, '0')}`

/** Returns { [patientDir]: { [relPath]: rows } } */
export function mddPatients() {
  seq = 0
  const P = {}
  const put = (pt, dir, month, file, rows) => { const p = `${dir}/${month}/${file}`; P[pt] ??= {}; P[pt][p] = [...(P[pt][p] ?? []), ...rows] }
  const visit = (no, t, tp, dept, extra = {}) => ({ PRM_KEY: key('就诊'), VST_TP: tp, VST_DT: ts(t), VST_DT_TM: ts(t), ...(tp === '2' ? { INHOS_NO: no, ADMN_DT_TM: ts(t), ADMN_DPT_NM: dept } : { OTPT_EMG_NO: no, VST_DPT_NM: dept }), MDC_ORG_NM: '医院-000009', ...extra })
  const lab = (t, panel, item, v, unit, ref, inhos) => ({ PRM_KEY: key('检验'), TEST_DT: ts(t), ADT_TM: ts(t), CRT_TM: ts(t), TEST_ITM_NM: panel, TEST_CHD_ITM_NM: item, TEST_RSLT_VLU: v, TEST_RSLT_VLU_UNT: unit, RFRC_VLU: ref, INHOS_NO: inhos })
  const diag = (t, name, icd, cgy, inhos, otpt) => ({ PRM_KEY: key('诊断'), DIAG_DT: ts(t), CRT_TM: ts(t), DIAG_DSCPT: name, DIAG_ICD10_CD: icd, DIAG_CGY_NM: cgy, VST_TP: inhos ? '2' : '1', INHOS_NO: inhos ?? null, OTPT_EMG_NO: otpt ?? null, INVLD_FLG: '0' })
  const otpt = (no, t, f) => ({ PRM_KEY: key('门诊'), OTPT_EMG_NO: no, CRT_TM: ts(t), INVLD_FLG: '0', ...f })

  /* ---------- MDD-A：复发性、重度、两次自杀未遂（门诊写"1次"，入院写"2次"→冲突）、舍曲林→文拉法辛、MECT、HAMD-17 30→9 */
  {
    const pt = 'MDD-A'
    put(pt, '人口信息学/病史', '190001', 'p_doc_dwd_psn_rcd.json', [{ PRM_KEY: key('人'), BTH_DT: '19880315', GDR_NM: '女性' }])
    put(pt, '就诊/就诊记录', '202403', 'p_doc_fact_vst_infmt.json', [
      visit('就诊-A1', '2024-03-02 09:00', '1', '精神科'),
      visit('住院-A1', '2024-04-10 10:00', '2', '精神科', { DSCG_DT_TM: ts('2024-05-08 10:00'), MRY_CDT_NM: '已婚', PFS_CGY_NM: '教师' }),
    ])
    put(pt, '病历记录/门诊病历', '202403', 'p_doc_fact_otpt_emg_mdc_htr_rcd.json', [
      otpt('就诊-A1', '2024-03-02 09:30', {
        CHF_COMPLNT: '反复情绪低落8年，再发2月。',
        PRST_ILLNS_HST: '患者2016年首次出现情绪低落，当时予舍曲林治疗半年后好转自行停药。近2月再次出现心情差，高兴不起来，兴趣减退，失眠早醒，食欲减退，体重下降约4kg。有自杀观念，曾自杀未遂1次。PHQ-9 评分22分。',
        PAST_HST: '否认高血压、糖尿病史。有甲减病史3年，口服左甲状腺素钠。',
        PSQ_EXAM: '神清，接触被动，情绪低落，语速慢，未引出幻觉妄想，自知力部分。',
        HDL_SGST: '1、舍曲林50mg qd起始\n2、必要时住院\n3、警惕自杀风险，家属24小时陪护',
      }),
      otpt('就诊-A0', '2024-02-20 09:30', { CHF_COMPLNT: '复诊', PRST_ILLNS_HST: '无殊。', INVLD_FLG: '1' }),
    ])
    const adm = admission({
      record: '2024-04-10 14:20', chief: '反复情绪低落8年，加重1月。',
      hpi: '患者2016年首次发病，表现为情绪低落、兴趣下降，在外院诊断"抑郁症"，予舍曲林100mg/d治疗后缓解。此后2019年再次发作1次。本次2024年2月起再发情绪低落，门诊予左洛复治疗1月，疗效欠佳，近1月加重，整日闷闷不乐，觉得自己拖累家人，有消极念头，1周前在家过量服药（具体不详），被家人发现送医。病程中精力差，注意力不集中，入睡困难，早醒，纳差，体重减轻约5kg。否认情绪高涨、兴奋话多。既往共有自杀未遂2次。',
      past: '有"甲状腺功能减退"病史3年。否认高血压、糖尿病史。否认药物过敏史。',
      personal: '本科学历，职业：教师。否认烟酒嗜好。',
      family: '母亲有"抑郁症"病史。否认家族中自杀史。',
      exam: '一般情况：神志清，T 36.5℃，P 82次/分，BP 118/76mmHg。心肺腹未见异常。',
      mental: '意识清，接触被动，言语减少，语速缓慢，情绪低落，自我评价低，有自责自罪，存在自杀观念，未引出幻觉、妄想。自知力部分存在。HAMD-17 评分 30分，HAMA 评分 18分。自杀风险评估：高风险。',
      aux: '（2024-04-09本院）TSH 6.8mIU/L',
      dx: ['复发性抑郁障碍，目前为不伴精神病性症状的重度发作（F33.2）', '甲状腺功能减退症'],
    })
    put(pt, '病历记录/住院病历', '202404', 'p_doc_fact_admn_mdc_htr_rcd.json', [{ PRM_KEY: key('入院'), INHOS_NO: '住院-A1', ADMN_DT_TM: ts('2024-04-10 10:00'), DSCG_DT_TM: ts('2024-05-08 10:00'), RCD_DT_TM: ts('2024-04-10 14:20'), CRT_TM: ts('2024-04-10 14:20'), CHF_COMPLNT: '反复情绪低落8年，加重1月。', PST_ILLNS_HST: adm }])
    put(pt, '病历记录/出院记录', '202405', 'p_doc_fact_dscg_rcd.json', [{
      PRM_KEY: key('出院'), INHOS_NO: '住院-A1', CRT_TM: ts('2024-05-08 15:00'), UPD_DT: '2024-05-08 14:00:00',
      ADMN_CDT: '患者因"反复情绪低落8年，加重1月"入院。入院时HAMD-17 30分，有自杀观念。',
      TRT_PRCS: '入院后停用舍曲林，换用文拉法辛缓释胶囊逐渐加量至225mg/d，联合喹硫平100mg qn增效，予MECT治疗8次，辅以认知行为治疗。治疗中出现恶心、口干，对症处理后缓解。未见转躁。',
      DSCG_CDT: '患者情绪明显好转，自杀观念消失，睡眠改善。出院前复评HAMD-17 9分。疗效评价：显效。',
      DSCG_ORDR: '文拉法辛缓释胶囊 225mg qd；喹硫平 100mg qn；左甲状腺素钠 50μg qd。门诊随访。',
    }])
    put(pt, '诊断/诊断记录', '202405', 'p_doc_fact_diag_infmt.json', [
      diag('2024-03-02 09:30', '抑郁发作', 'F32.2', 'mzzd', null, '就诊-A1'),
      diag('2024-05-08 10:00', '复发性抑郁障碍，目前为不伴有精神病性症状的重度发作', 'F33.2', 'cyzd', '住院-A1'),
    ])
    put(pt, '检验/检验记录', '202404', 'p_doc_fact_test_rcd.json', [
      lab('2024-04-11 08:00', '甲状腺功能', '促甲状腺激素', '6.8', 'mIU/L', '0.27-4.2', '住院-A1'),
      lab('2024-04-11 08:00', '电解质', '钠', '138', 'mmol/L', '137-147', '住院-A1'),
      lab('2024-05-02 08:00', '电解质', '钠', '131', 'mmol/L', '137-147', '住院-A1'),
    ])
  }

  /* ---------- MDD-B：首发、中度、门诊为主、否认自杀、父亲双相（家族史，不是本人双相）、艾司西酞普兰（来士普）、HAMD-24 */
  {
    const pt = 'MDD-B'
    put(pt, '人口信息学/病史', '190001', 'p_doc_dwd_psn_rcd.json', [{ PRM_KEY: key('人'), BTH_DT: '20010708', GDR_NM: '男性' }])
    put(pt, '就诊/就诊记录', '202501', 'p_doc_fact_vst_infmt.json', [visit('就诊-B1', '2025-01-06 10:00', '1', '心理科'), visit('就诊-B2', '2025-02-10 10:00', '1', '心理科')])
    put(pt, '病历记录/门诊病历', '202501', 'p_doc_fact_otpt_emg_mdc_htr_rcd.json', [
      otpt('就诊-B1', '2025-01-06 10:20', {
        CHF_COMPLNT: '情绪低落3月。',
        PRST_ILLNS_HST: '患者3月前无明显诱因下出现情绪低落，对打游戏也提不起兴趣，乏力，注意力下降，学习成绩下降，眠差多梦。否认自杀观念及自伤行为。否认幻觉。无躁狂发作史。汉密尔顿抑郁量表（24项）评分 26分，HAMA 15分。',
        PAST_HST: '体健。',
        PSN_HST: '大学在读，未婚。偶有饮酒，否认吸烟。',
        PSQ_EXAM: '神清，情绪低，有焦虑，自知力完整。',
        HDL_SGST: '1、来士普 10mg qd\n2、建议心理治疗\n3、如有消极念头及时就诊',
        DIAG_DSCPT: '中度抑郁发作',
      }),
      otpt('就诊-B2', '2025-02-10 10:20', {
        CHF_COMPLNT: '复诊。',
        PRST_ILLNS_HST: '服用艾司西酞普兰1月，情绪较前好转，睡眠改善，仍有乏力。规律服药。HAMD-24 评分 14分。',
        HDL_SGST: '1、艾司西酞普兰 15mg qd\n2、支持性心理治疗',
        DIAG_DSCPT: '中度抑郁发作',
      }),
    ])
    put(pt, '诊断/诊断记录', '202501', 'p_doc_fact_diag_infmt.json', [diag('2025-01-06 10:20', '中度抑郁发作', 'F32.1', 'mzzd', null, '就诊-B1')])
    // 家族史只出现在一份就诊登记的既往史里：父亲双相
    put(pt, '就诊/就诊记录', '202502', 'p_doc_fact_vst_infmt.json', [visit('就诊-B2', '2025-02-10 10:00', '1', '心理科', { DSES_HST: '父亲患双相情感障碍。' })])
  }

  /* ---------- MDD-C：伴精神病性症状、转躁 → 修订为双相；第二版入院记录（同主键另一月份文件） */
  {
    const pt = 'MDD-C'
    put(pt, '人口信息学/病史', '190001', 'p_doc_dwd_psn_rcd.json', [{ PRM_KEY: key('人'), BTH_DT: '19750102', GDR_NM: '女性' }])
    put(pt, '就诊/就诊记录', '202309', 'p_doc_fact_vst_infmt.json', [visit('住院-C1', '2023-09-05 09:00', '2', '精神科', { DSCG_DT_TM: ts('2023-10-20 10:00') })])
    const adm = admission({
      record: '2023-09-05 15:00', chief: '情绪低落、凭空闻声2月。',
      hpi: '患者2月前出现情绪低落，整日卧床，觉得自己罪孽深重，凭空听到有人骂她，认为邻居要害她。曾割腕1次。病程中食欲差，体重下降。既往无躁狂发作。',
      past: '有高血压病史5年。否认焦虑障碍史。', marital: '离异。', personal: '初中文化。吸烟20年，每日10支。',
      family: '否认家族中精神疾病史。',
      exam: '一般情况：神志清，BP 150/90mmHg。',
      mental: '意识清，情绪低落，有幻听，存在被害妄想、罪恶妄想，自知力缺乏。MADRS 38分。',
      dx: ['重度抑郁发作，伴精神病性症状（F32.3）', '高血压病'],
    })
    const k = key('入院')
    put(pt, '病历记录/住院病历', '202309', 'p_doc_fact_admn_mdc_htr_rcd.json', [{ PRM_KEY: k, INHOS_NO: '住院-C1', ADMN_DT_TM: ts('2023-09-05 09:00'), RCD_DT_TM: ts('2023-09-05 15:00'), CRT_TM: ts('2023-09-05 15:00'), PST_ILLNS_HST: adm }])
    put(pt, '病历记录/住院病历', '202310', 'p_doc_fact_admn_mdc_htr_rcd.json', [{ PRM_KEY: k, INHOS_NO: '住院-C1', ADMN_DT_TM: ts('2023-09-05 09:00'), CRT_TM: ts('2023-10-01 18:00'), PST_ILLNS_HST: adm.replace('自知力缺乏', '自知力部分') }])
    put(pt, '病历记录/出院记录', '202310', 'p_doc_fact_dscg_rcd.json', [{
      PRM_KEY: key('出院'), INHOS_NO: '住院-C1', CRT_TM: ts('2023-10-20 15:00'), UPD_DT: '2023-10-20 15:00:00',
      ADMN_CDT: '因"情绪低落、凭空闻声2月"入院。',
      TRT_PRCS: '予帕罗西汀联合奥氮平治疗。治疗第3周出现情绪高涨、兴奋话多、睡眠需求减少，考虑转躁，停用帕罗西汀，加用碳酸锂。修正诊断为双相情感障碍。',
      DSCG_CDT: '精神症状好转，幻听消失。疗效评价：好转。',
      DSCG_ORDR: '碳酸锂 0.5g bid；奥氮平 10mg qn。',
    }])
    put(pt, '诊断/诊断记录', '202310', 'p_doc_fact_diag_infmt.json', [diag('2023-10-20 10:00', '双相情感障碍，目前为伴有精神病性症状的重度抑郁发作', 'F31.5', 'cyzd', '住院-C1')])
  }
  return P
}

export async function writeMddPatients(dir) {
  const P = mddPatients()
  for (const [pt, files] of Object.entries(P)) {
    for (const [rel, rows] of Object.entries(files)) {
      const p = join(dir, pt, rel)
      await mkdir(join(p, '..'), { recursive: true })
      await writeFile(p, JSON.stringify(rows))
    }
  }
  return dir
}

/* ---------------------------------------------------------------- synth */

const SENT = [
  (r) => `患者${r.n(2, 10)}${r.pick(['月', '年'])}前出现情绪低落，${r.pick(['高兴不起来', '兴趣减退', '乏力', '失眠', '纳差'])}。`,
  (r) => r.pick(['否认自杀观念。', '有消极念头。', '否认幻觉妄想。', '存在自杀观念，曾自杀未遂1次。']),
  (r) => `HAMD-17 评分 ${r.n(5, 35)}分。`,
  (r) => `予${r.pick(['舍曲林', '来士普', '文拉法辛', '度洛西汀', '米氮平', '伏硫西汀'])}${r.n(1, 4) * 25}mg qd治疗。`,
  (r) => r.pick(['母亲有抑郁症病史。', '否认家族中精神疾病史。', '父亲患双相情感障碍。']),
  (r) => r.pick(['自知力完整。', '自知力部分。', '无自知力。']),
  (r) => `既往有${r.pick(['高血压', '甲减', '糖尿病'])}病史。`,
  (r) => r.pick(['睡眠差，早醒。', '睡眠可。', '入睡困难。']),
]
function rng(seed) {
  let s = seed >>> 0 || 1
  const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296
  return { next, n: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: (xs) => xs[Math.floor(next() * xs.length)] }
}

/** Write `count` synthetic documents as ndjson (id, patient_id, visit_id, doc_type, record_time, content). */
export async function synthNdjson(file, count, { seed = 7, patients = Math.max(1, Math.floor(count / 20)) } = {}) {
  const r = rng(seed)
  const { createWriteStream } = await import('node:fs')
  const out = createWriteStream(file)
  let buf = ''
  for (let i = 0; i < count; i++) {
    const p = r.n(1, patients)
    const text = `主诉：情绪低落${r.n(1, 12)}月。\n现病史：${SENT.map((f) => (r.next() < 0.7 ? f(r) : '')).join('')}\n诊断：${r.pick(['抑郁发作', '复发性抑郁障碍（F33.1）', '中度抑郁发作（F32.1）', '焦虑抑郁状态'])}`
    buf += `${JSON.stringify({ id: `doc-${i}`, patient_id: `P${p}`, visit_id: `V${p}-${r.n(1, 3)}`, doc_type: r.pick(['门诊病历', '入院记录', '病程记录']), record_time: `2025-${String(r.n(1, 12)).padStart(2, '0')}-${String(r.n(1, 28)).padStart(2, '0')} 10:00`, content: text })}\n`
    if (buf.length > 1 << 20) { if (!out.write(buf)) await new Promise((res) => out.once('drain', res)); buf = '' }
  }
  out.write(buf)
  await new Promise((res) => out.end(res))
  return file
}
