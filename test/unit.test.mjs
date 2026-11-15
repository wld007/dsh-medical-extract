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
import { cleanValue, decodeShortBase64, isHollow, isPlaceholder } from '../lib/source/clean.js'
import { fieldsFor, segmentsOf, tasksFor } from '../lib/engine/dispatch.js'

test('读入·清洗：解码短 base64、去掉 Java 对象残留、占位与空壳', () => {
  assert.equal(decodeShortBase64('LQ=='), '-')
  assert.equal(decodeShortBase64('null'), null)
  assert.equal(decodeShortBase64('abcd'), null)
  const cs = {}
  assert.equal(cleanValue('瘤体约3"], org.dom4j.tree.DefaultText@3d859866 [Text: "×"], org.dom4j.tree.DefaultText@7486b6e2 [Text: "3cm"]]', cs), '瘤体约3×3cm')
  assert.equal(cs.garbled, 1)
  assert.equal(cleanValue('LQ==', cs), '-'); assert.equal(cs.decoded, 1)
  assert.ok(isPlaceholder('-')); assert.ok(isPlaceholder('null')); assert.ok(!isPlaceholder('130/80')); assert.ok(!isPlaceholder('无'))
  const doc = (text, sections) => ({ text, sections })
  assert.ok(isHollow(doc('护理观察：-\n', [{ name: '护理观察', s: 5, e: 6 }])))
  assert.ok(isHollow(doc('手术名称：43.7x00\n', [{ name: '手术名称', s: 5, e: 12 }])))
  assert.ok(!isHollow(doc('主诉：情绪低落3月\n', [{ name: '主诉', s: 3, e: 9 }])))
})


test('文书判定兜底：叙述性文字才算文书', () => {
  assert.equal(isNarrativeTable([{ a: '患者情绪低落3月，睡眠差，食欲减退，否认自杀观念。' }, { a: '患者情绪较前好转，睡眠改善。' }]), true)
  assert.equal(isNarrativeTable([{ item: '血红蛋白量', v: '98', u: 'g/L' }, { item: '平均红细胞血红蛋白量', v: '30.1' }]), false)
  assert.equal(isNarrativeTable([{ item: '阿莫西林胶囊', cat: '西药费', n: '2' }, { item: '心理测验（汉密尔顿抑郁量表）', cat: '检查费' }]), false)
  assert.equal(isNarrativeTable([{ name: '抑郁发作', icd: 'F32.1' }, { name: '焦虑状态', icd: 'F41.9' }]), false)
})

const lex = buildLexicon()
const mdd = JSON.parse(await readFile(new URL('../templates/mdd.json', import.meta.url), 'utf8'))
const at = (text, term, section = '现病史') => { const s = text.indexOf(term); return assess(text, s, s + term.length, section, lex).assertion }

test('分派：按文书类型、栏目派字段；长文书按栏目切段；字段分组', () => {
  const tpl = compileTemplate(mdd)
  const text = `主诉：情绪低落3月\n${'现病史：'}${'患者睡眠差。'.repeat(400)}\n家族史：母亲有抑郁症病史。\n`
  const sections = splitSections(text)
  const doc = { id: 'D1', recordType: '入院记录', text, sections }
  const fs = fieldsFor(doc, tpl)
  assert.ok(fs.length > 0 && fs.every((f) => f.type !== 'derived'))
  // 只限定出院记录的字段不派给入院记录
  assert.ok(!fs.some((f) => f.recordTypes && !f.recordTypes.includes('入院记录')))
  const segs = segmentsOf(doc, 1000)
  assert.ok(segs.length > 1)
  assert.equal(segs[0].s, 0); assert.equal(segs.at(-1).e, text.length)
  for (let i = 1; i < segs.length; i++) assert.equal(segs[i].s, segs[i - 1].e)
  assert.ok(segs.every((x) => x.e - x.s <= 1000))
  const tasks = tasksFor(doc, tpl, { maxChars: 1000, maxFields: 20 })
  assert.ok(tasks.every((t) => t.fields.length <= 20 && t.text === text.slice(t.s, t.e)))
  // 同样输入，任务编号稳定
  assert.deepEqual(tasks.map((t) => t.id), tasksFor(doc, tpl, { maxChars: 1000, maxFields: 20 }).map((t) => t.id))
})

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

test('规则票：与模型一致记 model+rule，模型答了别的值记为分歧（进复核）', async () => {
  const { mergeVotes } = await import('../lib/engine/model.js')
  const r = (value, s, e) => ({ field: 'E1', value, s, e, flags: ['规则票'], method: 'rule:hamd' })
  const m = (value, s, e) => ({ field: 'E1', value, s, e, flags: [], method: 'model' })
  const a = mergeVotes([r(24, 10, 20)], [m(24, 12, 18)], { answered: new Set(['E1']), anyFailed: false })
  assert.equal(a.agree, 1); assert.equal(a.values[0].method, 'model+rule'); assert.equal(a.disputes.length, 0)
  const b = mergeVotes([r(24, 10, 20)], [m(14, 40, 48)], { answered: new Set(['E1']), anyFailed: false })
  assert.equal(b.disagree, 1); assert.equal(b.disputes.length, 1)
  const c = mergeVotes([r(24, 10, 20)], [], { answered: new Set(), anyFailed: false })
  assert.ok(c.values[0].flags.includes('模型未确认'))
})

test('读入·清洗：图片与二进制丢掉、HTML／RTF 转文字（图片丢掉）', async () => {
  const { stripMedia, rtfToText } = await import('../lib/source/clean.js')
  // 1×1 PNG（虚构）整段 base64：丢掉并计数
  const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from(Array.from({ length: 96 }, (_, i) => (i * 97 + 13) % 256))]).toString('base64')
  const cs = {}
  assert.equal(cleanValue(png, cs), ''); assert.equal(cs.media, 1); assert.equal(cs.mediaKinds['图片'], 1)
  // HTML：图片标签与 data URI 丢掉，文字留下
  const html = `<div><p>主诉：情绪低落3月</p><img src="data:image/png;base64,${png}"/><p>否认自杀观念。</p></div>`
  const t = cleanValue(html, {})
  assert.ok(t.includes('情绪低落3月') && t.includes('否认自杀观念') && !t.includes('base64') && !t.includes('<'))
  // 文中夹的 data URI、长 base64 串
  const cs2 = {}
  assert.equal(stripMedia(`见附图 data:image/jpeg;base64,${png} 。`, cs2).replace(/\s+/g, ''), '见附图。'); assert.equal(cs2.media, 1)
  const big = Buffer.from(Array.from({ length: 300 }, (_, i) => (i * 131 + 7) % 256)).toString('base64')
  assert.equal(stripMedia(`心电图：${big}窦性心律`, {}), '心电图：窦性心律')
  // RTF：GBK 文字解码，\pict 图片整组丢掉
  const rtf = "{\\rtf1\\ansi\\ansicpg936{\\fonttbl{\\f0 \\'cb\\'ce\\'cc\\'e5;}}\\f0 \\'d6\\'f7\\'cb\\'df\\'a3\\'ba\\'d0\\'c4\\'c7\\'e9\\'b2\\'ee\\par{\\pict\\pngblip 89504e470d0a}\\'b7\\'f1\\'c8\\'cf\\par}"
  const cs3 = {}
  const r = rtfToText(rtf, cs3)
  assert.equal(r, '主诉：心情差\n否认'); assert.equal(cs3.media, 1)
  // 普通文字不受影响
  assert.equal(cleanValue('血压 130/80mmHg，否认胸痛。'), '血压 130/80mmHg，否认胸痛。')
})

test('全局模型并发：多个限流器共用一个计数，不超过上限', async () => {
  const { sharedLimiter, readGate, GATE_BYTES } = await import('../lib/engine/shard.js')
  const sab = new SharedArrayBuffer(GATE_BYTES)
  const a = sharedLimiter(sab, 3, 0); const b = sharedLimiter(sab, 3, 1)
  let now = 0; let peak = 0
  const job = (lim) => lim(async () => { now++; peak = Math.max(peak, now); await new Promise((r) => setTimeout(r, 5)); now-- })
  await Promise.all([...Array(10)].flatMap(() => [job(a), job(b)]))
  assert.equal(peak, 3); assert.equal(new Int32Array(sab)[0], 0)
  // 计数：在途、排队归零；完成调用与 token 按角色累计
  a.tally(10); a.tally(5); b.tally(7)
  const g = readGate(sab)
  assert.deepEqual(g.inflight, [0, 0]); assert.deepEqual(g.waiting, [0, 0]); assert.deepEqual(g.done, [2, 1]); assert.deepEqual(g.tokens, [15, 7])
})

test('读入·清洗：base64 的文字解出来；编码串、哈希不当二进制；压缩文书计数不解', async () => {
  const { stripMedia } = await import('../lib/source/clean.js')
  const txt = '护理观察：患者神志清，精神可，夜间睡眠差，诉心情低落，无自伤言行。'
  const cs = {}
  assert.equal(stripMedia(Buffer.from(txt).toString('base64'), cs), txt); assert.equal(cs.decoded, 1)
  const codes = 'LIS26504+LIS26507+LIS26506+LIS26505+LIS26508+LIS01887+LIS26502+LIS26501+LIS26500'
  assert.equal(stripMedia(codes, {}), codes)
  const hash = 'a3f1'.repeat(16)
  assert.equal(stripMedia(hash, {}), hash)
  const zipped = Buffer.from(`<document compression="7zip" type="" version="1"><content encoding="utf-8">${Buffer.alloc(120, 9).toString('base64')}</content></document>`).toString('base64')
  const cs2 = {}
  assert.equal(stripMedia(zipped, cs2), ''); assert.equal(cs2.mediaKinds['压缩文书（未解）'], 1)
})
