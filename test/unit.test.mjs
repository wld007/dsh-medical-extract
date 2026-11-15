import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { assess, buildLexicon, presenceValue } from '../lib/engine/assertion.js'
import { parseDateText, cnNumber } from '../lib/engine/dates.js'
import { compileTemplate, validateTemplate } from '../lib/template/load.js'
import { joinFields, splitSections } from '../lib/source/sections.js'
import { extractDocument, optionsIn } from '../lib/engine/extract.js'
import { pickCell } from '../lib/engine/rollup.js'
import { sameConclusion } from '../lib/engine/shard.js'
import { parseInstant } from '../lib/util.js'
import { isNarrativeTable } from '../lib/source/narrative.js'

test('文书判定兜底：叙述性文字才算文书', () => {
  assert.equal(isNarrativeTable([{ a: '患者情绪低落3月，睡眠差，食欲减退，否认自杀观念。' }, { a: '患者情绪较前好转，睡眠改善。' }]), true)
  assert.equal(isNarrativeTable([{ item: '血红蛋白量', v: '98', u: 'g/L' }, { item: '平均红细胞血红蛋白量', v: '30.1' }]), false)
  assert.equal(isNarrativeTable([{ item: '阿莫西林胶囊', cat: '西药费', n: '2' }, { item: '心理测验（汉密尔顿抑郁量表）', cat: '检查费' }]), false)
  assert.equal(isNarrativeTable([{ name: '抑郁发作', icd: 'F32.1' }, { name: '焦虑状态', icd: 'F41.9' }]), false)
})

const lex = buildLexicon()
const mdd = JSON.parse(await readFile(new URL('../templates/mdd.json', import.meta.url), 'utf8'))
const at = (text, term, section = '现病史') => { const s = text.indexOf(term); return assess(text, s, s + term.length, section, lex).assertion }

test('断言：否认、作用域、伪否认、家族、既往、计划', () => {
  assert.equal(at('否认自杀观念及自伤行为。', '自伤'), '否认')
  assert.equal(at('无发热，咳嗽。', '咳嗽'), '阳性') // 逗号结束否认作用域
  assert.equal(at('无明显诱因下出现情绪低落。', '情绪低落'), '阳性') // 伪否认
  assert.equal(at('复发性抑郁障碍，目前为不伴精神病性症状的重度发作', '重度发作'), '阳性') // "的"结束作用域
  assert.equal(at('母亲有"抑郁症"病史。', '抑郁'), '家族')
  assert.equal(at('被家人发现送医，有消极念头。', '消极念头'), '阳性') // "家人"后没有"有/患"
  assert.equal(at('表现为情绪低落、兴趣下降。', '兴趣下降'), '阳性') // "表现为"不是亲属
  assert.equal(at('既往曾服用舍曲林。', '舍曲林'), '既往')
  assert.equal(at('高血压', '高血压', '既往史'), '既往')
  assert.equal(at('建议加用喹硫平。', '喹硫平'), '计划')
  assert.equal(at('注意力不集中，入睡困难。', '入睡困难'), '阳性') // "注意力"不是"注意"
  assert.equal(at('否认家族中精神疾病史。', '精神疾病', '家族史'), '否认')
  const f = (s) => { const i = s.indexOf('抑郁'); return assess(s, i, i + 2, '家族史', lex).flags }
  assert.equal(presenceValue(f('否认家族中精神疾病及抑郁史。'), new Set(['家族'])), '无')
  assert.equal(presenceValue(f('父亲患抑郁症。'), new Set(['阳性'])), null) // 亲属的不算本人
})

test('日期与数字', () => {
  assert.deepEqual(parseDateText('2019年3月', null), { date: '2019-03', precision: 'month' })
  assert.deepEqual(parseDateText('3月前', '2025-01-06'), { date: '2024-10', precision: 'month' })
  assert.deepEqual(parseDateText('情绪低落3月', '2025-01-06'), null) // 不是纯时长
  assert.deepEqual(parseDateText('3月余', '2025-01-06'), { date: '2024-10', precision: 'month' })
  assert.equal(parseDateText('2周前', '2025-01-15').date, '2025-01-01')
  assert.equal(cnNumber('两'), 2); assert.equal(cnNumber('十二'), 12); assert.equal(cnNumber('半'), 0.5)
  assert.equal(parseInstant('1712730000000'), '2024-04-10 14:20')
  assert.equal(parseInstant('20240410'), '2024-04-10 00:00')
  assert.equal(parseInstant('2024/4/10 8:05'), '2024-04-10 08:05')
})

test('栏目切分', () => {
  const t = '入院记录\n主  诉：情绪低落3月。\n现病史：患者……\n既往史：体健。\n精神检查：自知力完整。\n初步诊断:\n  抑郁发作'
  const names = splitSections(t).map((s) => s.name)
  assert.deepEqual(names, ['正文', '主诉', '现病史', '既往史', '精神检查', '初步诊断'])
  const { text, sections } = joinFields([['主诉', 'a'], ['现病史', ''], ['处理意见', 'b']], '，')
  assert.equal(text, '主诉：a，处理意见：b，')
  assert.deepEqual(sections.map((s) => text.slice(s.s, s.e)), ['a', 'b'])
})

test('模板：内置模板校验通过；错误模板列出问题', () => {
  assert.deepEqual(validateTemplate(mdd), [])
  assert.ok(mdd.fields.length >= 70)
  const bad = { format: 'extract-template/1', id: 'Bad', name: 'x', version: '1', description: 'x', fields: [
    { id: 'a', name: 'a', type: 'presence', definition: 'x', recall: { regex: ['(unclosed'] } },
    { id: 'a', name: 'b', type: 'nope', definition: 'x' },
    { id: 'd', name: 'd', type: 'derived', definition: 'x', derive: { op: 'ageAt', at: 'zz' } },
  ] }
  const p = validateTemplate(bad)
  assert.ok(p.some((x) => x.includes('id 应为')))
  assert.ok(p.some((x) => x.includes('不能编译')))
  assert.ok(p.some((x) => x.includes('重复')))
  assert.ok(p.some((x) => x.includes('zz 不存在')))
  assert.throws(() => compileTemplate(bad), /校验未通过/)
})

test('选项：长写法优先（艾司西酞普兰不是西酞普兰；明显好转是显效）', () => {
  const tpl = compileTemplate(mdd)
  const { text, sections } = joinFields([['处理意见', '艾司西酞普兰 15mg qd']])
  const r = extractDocument({ id: 'd', patient: 'p', encounter: 'e', recordType: '门诊病历', written: '2025-01-01 10:00', text, sections }, { ...tpl, fields: [tpl.byId.get('F4'), { ...tpl.byId.get('F1'), model: 'auto' }] }, { lex, mode: 'rules' })
  assert.deepEqual(r.values.map((v) => v.value), ['艾司西酞普兰'])
  assert.deepEqual(optionsIn(tpl.byId.get('H1'), '情绪明显好转'), ['显效'])
})

test('汇总规则与冲突', () => {
  const tpl = compileTemplate(mdd)
  const v = (value, written) => ({ value, written, s: 0 })
  assert.deepEqual(pickCell(tpl.byId.get('C1'), [v('无', '1'), v('有', '2')]), { value: '有', conflict: ['无', '有'] })
  assert.deepEqual(pickCell(tpl.byId.get('C1'), []).value, '未提及')
  assert.equal(pickCell(tpl.byId.get('B1'), [v('2016', '1'), v('2016-03', '2')]).value, '2016') // earliest，不算冲突
  assert.equal(pickCell(tpl.byId.get('B1'), [v('2016', '1'), v('2016-03', '2')]).conflict, null)
  assert.deepEqual(pickCell(tpl.byId.get('D3n'), [v(1, '1'), v(2, '2')]), { value: 2, conflict: null }) // max 不算冲突
  assert.deepEqual(pickCell(tpl.byId.get('C15'), [v('缺乏', '1'), v('部分', '2')]).conflict, ['缺乏', '部分'])
})

test('核验比较：忽略标点、顺序、拼接与日期精度', () => {
  const tpl = compileTemplate(mdd)
  assert.ok(sameConclusion(tpl.byId.get('A9'), '情绪低落3月。', '情绪低落3月'))
  assert.ok(sameConclusion(tpl.byId.get('F6'), '奥氮平 10mg qn；碳酸锂 0.5g bid', '碳酸锂 0.5g bid；奥氮平 10mg qn'))
  assert.ok(sameConclusion(tpl.byId.get('B3'), '2024-10', '2024-10-06'))
  assert.ok(!sameConclusion(tpl.byId.get('B3'), '2024-10', '2024-12'))
  assert.ok(!sameConclusion(tpl.byId.get('C1'), '无', '未提及'))
})
