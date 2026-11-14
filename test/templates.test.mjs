/**
 * 内置模板：全部校验通过；每个模板用一段虚构病历核对规则取值（仅规则，不调模型）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { compileTemplate, validateTemplate } from '../lib/template/load.js'
import { buildLexicon } from '../lib/engine/assertion.js'
import { extractDocument } from '../lib/engine/extract.js'
import { docLevel } from '../lib/engine/shard.js'
import { joinFields, splitSections } from '../lib/source/sections.js'
import { readPatient } from '../lib/source/pdoc.js'
import { writeMddPatients } from './fixtures/mdd.mjs'
import { tmp } from './helpers.mjs'

const dir = new URL('../templates/', import.meta.url)
const names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort()
const T = Object.fromEntries(await Promise.all(names.map(async (n) => { const t = JSON.parse(await readFile(new URL(n, dir), 'utf8')); return [t.id, t] })))

test('内置模板：7 个病种，全部校验通过，带依据', () => {
  assert.deepEqual(Object.keys(T).sort(), ['ad', 'ckd-hd', 'hf', 'mdd', 'nsclc', 'stroke-ais', 't2dm'])
  for (const t of Object.values(T)) {
    assert.deepEqual(validateTemplate(t), [], t.id)
    assert.ok(t.fields.length >= 45, `${t.id} 字段太少`)
    assert.ok(t.references?.length, `${t.id} 缺依据`)
    assert.ok(!/样例/.test(t.name), `${t.id} 名称不应再叫样例`)
  }
})

/** 一份虚构文书：sections = [[栏目, 内容]] */
function doc(recordType, sections, written = '2024-05-10 10:00') {
  const { text, sections: sec } = joinFields(sections)
  return { id: `d-${recordType}`, patient: 'p', encounter: 'e', recordType, written, text, sections: sec.length ? sec : splitSections(text) }
}
function check(tid, d, expect) {
  const tpl = compileTemplate(T[tid])
  const { values } = extractDocument(d, tpl, { lex: buildLexicon(tpl.lexicon), mode: 'rules' })
  for (const v of values) if (v.value != null) assert.equal(d.text.slice(v.s, v.e), v.quote)
  const got = {}; const bad = []
  for (const [fid, want] of Object.entries(expect)) {
    got[fid] = docLevel(tpl.byId.get(fid), values)
    if (got[fid] !== want) bad.push(`${fid} ${tpl.byId.get(fid).name}：期望 ${want}，得到 ${got[fid]}`)
  }
  assert.deepEqual(bad, [], `${tid}\n${bad.join('\n')}`)
}

test('急性缺血性卒中：严重程度、再灌注、时间节点、分型、危险因素', () => {
  check('stroke-ais', doc('入院记录', [
    ['主诉', '突发左侧肢体无力3小时。'],
    ['现病史', '患者3小时前无明显诱因下突发左侧肢体无力，NIHSS评分 12分。急诊头颅CT未见出血，ASPECTS 8分，CTA示右侧大脑中动脉M1段闭塞。予阿替普酶静脉溶栓，DNT 35分钟，后行机械取栓，术后mTICI 2b。'],
    ['既往史', '有高血压病史10年，否认糖尿病史。有房颤病史。'],
    ['诊断', '急性脑梗死（I63.4），心源性栓塞型'],
  ]), { C1: '12', C3: '8', C4: '有', D1: '有', D2: '阿替普酶', D3: '有', D4: '2b', B3: '35', G1: '有', G2: '无', G3: '有', A2: '心源性栓塞', A1c: 'I63.4' })
})

test('阿尔茨海默病：量表、生物标志物、影像、用药、家族史', () => {
  check('ad', doc('门诊病历', [
    ['主诉', '记忆力下降2年。'],
    ['现病史', '患者2年前出现近事遗忘，丢三落四，渐出现迷路。MMSE 18分，MoCA 12分，CDR 1。APOE基因型 ε3/ε4。脑脊液Aβ42 420 pg/mL，p-tau181 85 pg/mL。头颅MRI示双侧海马萎缩，MTA评分 3分。'],
    ['既往史', '有高血压病史。否认脑卒中史。'],
    ['家族史', '母亲有老年痴呆病史。'],
    ['诊断', '阿尔茨海默病性痴呆（轻度）'],
    ['处理意见', '多奈哌齐 5mg qn，美金刚 10mg bid。'],
  ]), { C1: '18', C2: '12', C3: '1', E1: 'ε3/ε4', E2: '有', E3: '420', E5: '85', F1: '3', F3: '有', D1: '有', D2: '有', H1: '有', H2: '有', H4: '无', G1: '多奈哌齐；美金刚', A2: '阿尔茨海默病', A3: '轻度痴呆' })
})

test('心力衰竭：LVEF（百分数与小数）、NYHA、利钠肽、新四联', () => {
  check('hf', doc('入院记录', [
    ['主诉', '反复胸闷气促3年，加重伴双下肢水肿1周。'],
    ['现病史', '心脏超声示LVEF 32%，LVEDD 65mm。NT-proBNP 4560 pg/mL。心功能III级。'],
    ['既往史', '有高血压病史15年，糖尿病史5年。否认冠心病史。有阵发性房颤。'],
    ['诊断', '慢性心力衰竭急性加重，射血分数降低的心衰（HFrEF）'],
  ]), { D1: '32', D2: '65', D3: '4560', B1: 'III', A2: 'HFrEF', A4: '慢性心衰急性失代偿', B2: '有', B3: '有', G1: '有', G2: '有', G3: '有', G5: '无' })
  check('hf', doc('超声报告', [['所见', '左室射血分数 0.35，左心室舒张末内径 62mm。']]), { D1: '35', D2: '62' })
  check('hf', doc('出院记录', [['出院医嘱', '沙库巴曲缬沙坦 50mg bid；琥珀酸美托洛尔 23.75mg qd；螺内酯 20mg qd；达格列净 10mg qd；呋塞米 20mg qd。']]),
    { E1: '沙库巴曲缬沙坦', E2: '美托洛尔', E3: '螺内酯', E4: '达格列净', E5: '呋塞米' })
})

test('2 型糖尿病：血糖指标、并发症、降糖药分类', () => {
  check('t2dm', doc('门诊病历', [
    ['主诉', '发现血糖升高8年，口干多饮1月。'],
    ['现病史', '患者8年前体检发现空腹血糖 9.2 mmol/L，诊断2型糖尿病。近查HbA1c 8.6%，餐后2小时血糖 14.3 mmol/L。有双下肢麻木。眼底检查示非增殖期糖尿病视网膜病变。否认低血糖发作。'],
    ['既往史', '有高血压病史。'],
    ['诊断', '2型糖尿病伴视网膜病变（E11.3）'],
    ['处理意见', '二甲双胍 0.5g tid，达格列净 10mg qd，司美格鲁肽 0.25mg 每周一次，甘精胰岛素 12U qn。'],
  ]), { B1: '8.6', B2: '9.2', B3: '14.3', C1: '有', C3: '有', E1: '无', H1: '有', F1: '二甲双胍；达格列净', F2: '司美格鲁肽', F3: '甘精胰岛素', A2: '2型糖尿病', A1c: 'E11.3' })
})

test('慢性肾脏病与血透：分期、通路、充分性、贫血与 CKD-MBD', () => {
  check('ckd-hd', doc('入院记录', [
    ['主诉', '规律血液透析5年，内瘘流量下降1周。'],
    ['现病史', '患者5年前因慢性肾小球肾炎、CKD 5期开始规律血液透析，每周3次，每次4小时，干体重 58.5kg，经左前臂自体动静脉内瘘透析。近1周内瘘震颤减弱。近期化验：血红蛋白 98 g/L，铁蛋白 320 ng/mL，TSAT 28%，iPTH 560 pg/mL，血磷 2.1 mmol/L，血钙 2.25 mmol/L，白蛋白 36 g/L，spKt/V 1.32，URR 68%。'],
    ['既往史', '有高血压病史。否认糖尿病史。'],
    ['诊断', '慢性肾脏病5期，维持性血液透析，肾性贫血，继发性甲状旁腺功能亢进'],
  ]), { A2: 'G5', B1: '血液透析', B4: '自体动静脉内瘘', B5: '有', C1: '1.32', C2: '68', C3: '3', C4: '4', D1: '58.5', E1: '98', E2: '320', E3: '28', F3: '560', F2: '2.1', F1: '2.25', G1: '36', A3: '慢性肾小球肾炎', F7: '有', J1: '无', J2: '有' })
})

test('非小细胞肺癌：病理、TNM 与分期、驱动基因、PD-L1、靶向、疗效、转移', () => {
  check('nsclc', doc('入院记录', [
    ['现病史', '患者2023年3月因咳嗽行胸部CT发现右肺上叶占位，穿刺病理示浸润性腺癌。基因检测示EGFR 19外显子缺失，ALK阴性，PD-L1 TPS 30%。予奥希替尼 80mg qd靶向治疗，疗效评价PR。2024年复查疗效评价PD，出现脑转移。'],
    ['既往史', '吸烟30年，20支/日，已戒烟5年。否认高血压史。'],
    ['诊断', '右肺上叶腺癌 cT2aN2bM1c1 IVB期 EGFR 19del'],
  ]), { A2: '腺癌', A3: '右肺', B1: 'cT2aN2bM1c1', B2: 'IVB', B3: '有', C1: '19外显子缺失', C2: '阴性', C5: '30', F1: '奥希替尼', G1: 'PD；PR', I1: '有' })
  // PD-1/PD-L1 不是疗效评价 PD；"高血压3级"不是 NYHA
  check('nsclc', doc('门诊病历', [['处理意见', '帕博利珠单抗（PD-1抑制剂）联合培美曲塞、卡铂。']]), { G1: '未提及', F3: '帕博利珠单抗', F4: '卡铂；培美曲塞' })
  check('hf', doc('门诊病历', [['诊断', '高血压3级（极高危）']]), { B1: '未提及' })
})

test('所有模板都能在同一批文书上跑通（不抛错、引语逐字）', async () => {
  const root = await tmp()
  const input = await writeMddPatients(join(root, 'in'))
  for (const p of ['MDD-A', 'MDD-B', 'MDD-C']) {
    const { documents } = await readPatient(join(input, p), input)
    for (const t of Object.values(T)) {
      const tpl = compileTemplate(t)
      const lex = buildLexicon(tpl.lexicon)
      for (const d of documents) {
        const { values } = extractDocument(d, tpl, { lex, mode: 'rules' })
        for (const v of values) if (v.value != null) assert.equal(d.text.slice(v.s, v.e), v.quote, `${t.id} ${v.field}`)
      }
    }
  }
})
