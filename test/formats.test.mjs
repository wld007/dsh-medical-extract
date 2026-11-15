/**
 * 格式识别：虚构的"数据元编码列名"导出（一个文件夹一位病人），假模型起草规格。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createService } from '../lib/service.js'
import { openLibrary } from '../lib/recognize/library.js'
import { loadElementDict } from '../lib/recognize/index.js'
import { readCsv, readEvidence, runToEnd, tmp } from './helpers.mjs'

const ts = (s) => s.replace(/[-: ]/g, '') + '00'
/** 两位虚构病人，三张表：首次病程记录（文书，正文分在三列）、检验结果（一行一项）、病案号表（无叙述，应被识别为忽略或其他）。 */
async function writeCoded(root) {
  const pts = [['证件-AAAAAA', '情绪低落3月，否认自杀观念。', '血红蛋白量', '98'], ['证件-BBBBBB', '心情差1年，有消极念头。', '血红蛋白量', '121']]
  for (const [pt, hpi, item, val] of pts) {
    const d = join(root, pt)
    await mkdir(join(d, '住院病历与病程'), { recursive: true }); await mkdir(join(d, '检验'), { recursive: true })
    await writeFile(join(d, '住院病历与病程', 'C0102_0515_02住院病程记录首次病程记录.json'), JSON.stringify([
      { _id: `${pt}-1`, WS01_00_014_01: '病历-000001', WS05_10_133_01: `患者${hpi}病程中睡眠差，食欲减退，体重下降约3kg，注意力不集中，兴趣减退，精力差。`, WS05_01_025_02: '诊疗计划：予舍曲林50mg qd。', WS04_01_119_01: '病例特点：HAMD-17 评分 24分。', WS99_99_903_40: '医院-000009', WS09_00_053_01: ts('2024-03-10 14:30') },
      { _id: `${pt}-2`, WS01_00_014_01: '病历-000002', WS05_10_133_01: '患者情绪较前好转。', WS05_01_025_02: '', WS04_01_119_01: '', WS99_99_903_40: '医院-000009', WS09_00_053_01: ts('2024-03-17 09:00') },
    ]))
    await writeFile(join(d, '检验', 'C0102_0303_0201住院检验常规报告.json'), JSON.stringify([
      { _id: `${pt}-L1`, WS04_30_020_01: item, WS04_30_009_03: val, WS04_30_016_01: 'g/L', WS04_50_902_01: '115-150', WS06_00_926_01: ts('2024-03-11 08:00'), WS02_10_916_01: '5377' },
      { _id: `${pt}-L2`, WS04_30_020_01: '平均红细胞血红蛋白量', WS04_30_009_03: '30.1', WS04_30_016_01: 'pg', WS04_50_902_01: '27-34', WS06_00_926_01: ts('2024-03-11 08:00'), WS02_10_916_01: '5377' },
    ]))
  }
  return root
}

const DOC_SPEC = { recordType: '病程记录', written: ['WS09_00_053_01'], key: ['_id'], sections: [['WS05_10_133_01', '病情记录'], ['WS04_01_119_01', '病例特点'], ['WS05_01_025_02', '诊疗计划']], note: '首次病程' }
const LAB_SPEC = { recordType: '检验', written: ['WS06_00_926_01'], key: ['_id'], roles: { item: 'WS04_30_020_01', value: 'WS04_30_009_03', unit: 'WS04_30_016_01', ref: 'WS04_50_902_01', panel: 'WS02_10_916_01' }, note: '检验明细' }

/** 假模型：格式提示按表名回答规格；其他提示（抽取）回空。variant 让核验模型在病程表上故意给不同的类别。 */
function fakeModel(name, { disagreeOnDoc = false } = {}) {
  const seen = []
  return {
    model: name, seen,
    async chat(messages) {
      const prompt = messages.find((m) => m.role === 'user').content
      seen.push(prompt)
      if (!prompt.includes('表画像')) return { content: '{"values":[]}', ms: 1 }
      const brief = JSON.parse(prompt.slice(prompt.lastIndexOf('表画像：') + 5))
      const spec = /病程/.test(brief.表) ? { ...DOC_SPEC, ...(disagreeOnDoc ? { recordType: '会诊记录', sections: [['WS05_10_133_01', '病情摘要']] } : {}) } : /检验/.test(brief.表) ? LAB_SPEC : { recordType: '忽略' }
      return { content: JSON.stringify(spec), ms: 1 }
    },
  }
}

test('格式识别：两模型一致自动采用，按规格出文书（栏目、时间、病人按文件夹），只发画像不发正文', async () => {
  const root = await tmp()
  const input = await writeCoded(join(root, 'export'))
  const extract = fakeModel('fake-a'); const verify = fakeModel('fake-b')
  const svc = createService({ config: { extractMode: 'hybrid', template: 'mdd', workers: 1, verifySampleRate: 0 }, stateDir: join(root, 'state', 'medical-extract'), chatImpl: { extract, verify } })
  const run = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  assert.ok(['completed', 'review'].includes(run.status), run.error)
  assert.equal(run.format.adopted, 2)
  assert.equal(run.format.held, 0)
  assert.equal(run.totals.patients, 2)
  // 发给模型的格式提示里没有正文
  for (const p of [...extract.seen, ...verify.seen].filter((x) => x.includes('表画像'))) {
    assert.ok(!p.includes('否认自杀观念') && !p.includes('消极念头') && !p.includes('食欲减退'), '格式提示不应含长文本正文')
    const brief = JSON.parse(p.slice(p.lastIndexOf('表画像：') + 5))
    for (const f of brief.字段) for (const x of f.样例 ?? []) assert.ok(x.length <= 21, `样例过长：${x}`)
  }
  const ev = await readEvidence(join(root, 'out', 'export', 'evidence'))
  const d1 = ev.find((v) => v.field === 'D1' && v.patient === '证件-AAAAAA')
  assert.equal(d1.value, '无'); assert.equal(d1.recordType, '病程记录'); assert.equal(d1.section, '病情记录'); assert.equal(d1.written, '2024-03-10 14:30')
  assert.ok(ev.some((v) => v.field === 'F1' && v.value === '舍曲林' && v.section === '诊疗计划'))
  assert.ok(ev.some((v) => v.field === 'E1' && v.value === 24 && v.section === '病例特点'))
  // 只从文书里抽：检验表（结构化）不出文书，只计数
  assert.equal(run.totals.documents, 4)
  assert.equal(run.totals.structured, 4)
  assert.ok(!ev.some((v) => v.recordType === '检验'))
  const fmts = await svc.formats(run.id)
  assert.deepEqual(fmts.tables.map((t) => t.status).sort(), ['agreed', 'agreed'])
  await svc.dispose()
})

test('格式识别：分歧暂扣，先按通用读法；人工裁定后重跑按规格', async () => {
  const root = await tmp()
  const input = await writeCoded(join(root, 'export'))
  const svc = createService({ config: { extractMode: 'hybrid', template: 'mdd', workers: 1, verifySampleRate: 0 }, stateDir: join(root, 'state', 'medical-extract'), chatImpl: { extract: fakeModel('fake-a'), verify: fakeModel('fake-b', { disagreeOnDoc: true }) } })
  const run = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  assert.equal(run.format.held, 1)
  assert.ok(run.warnings.some((w) => w.includes('格式还没定')))
  const t = (await svc.formats(run.id)).tables.find((x) => x.status === 'disputed')
  assert.ok(t.diffs.length)
  // 改过的规格要通过校验：字段不存在 → 不保存
  const bad = await svc.formatDecide({ signature: t.signature, action: 'confirm', spec: { ...DOC_SPEC, sections: [['NOPE', '病情记录']] } })
  assert.equal(bad.ok, false)
  assert.equal((await svc.formatDecide({ signature: t.signature, action: 'confirm', use: 'model' })).ok, true)
  assert.equal((await svc.formats(run.id)).changed, true)
  const run2 = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  assert.equal(run2.format.held, 0)
  const ev = await readEvidence(join(root, 'out', 'export', 'evidence'))
  assert.ok(ev.some((v) => v.recordType === '病程记录' && v.section === '病例特点'))
  await svc.dispose()
})

test('格式识别：不配模型只有规则草稿（待确认）；借用病历事件还原已采用的规格', async () => {
  const root = await tmp()
  const input = await writeCoded(join(root, 'export'))
  const stateDir = join(root, 'state', 'medical-extract')
  const svc = createService({ config: { extractMode: 'rules', template: 'mdd', workers: 1 }, stateDir })
  const run = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  assert.equal(run.format.adopted, 0)
  assert.ok(run.format.tables.every((t) => t.status === 'pending'))
  await svc.dispose()
  // 兄弟插件的格式库里有同一张表的已采用规格 → 直接借用
  const sib = openLibrary(join(root, 'state2', 'medical-event'))
  const mine = openLibrary(join(root, 'state2', 'medical-extract'))
  const fresh = createService({ config: { extractMode: 'rules', template: 'mdd', workers: 1 }, stateDir: join(root, 'state2', 'medical-extract') })
  for (const t of run.format.tables) {
    const spec = /病程/.test(t.table) ? DOC_SPEC : LAB_SPEC
    await sib.put({ signature: t.signature, table: t.table, status: 'agreed', spec: { ...spec, occur: [], patient: null, invalid: null, encounter: {}, measures: [], sections: spec.sections ?? [], roles: spec.roles ?? {}, origin: 'model' }, fields: [] })
  }
  const run2 = await runToEnd(fresh, { inputDir: input, outputRoot: join(root, 'out2') })
  assert.equal(run2.format.adopted, 2)
  assert.ok(run2.format.tables.every((t) => t.borrowedFrom === '病历事件还原'))
  assert.ok((await mine.all()).length === 2)
  await fresh.dispose()
})

test('没开格式识别：按叙述性判断，病程表是文书、检验表是结构化记录', async () => {
  const root = await tmp()
  const input = await writeCoded(join(root, 'export'))
  const svc = createService({ config: { extractMode: 'rules', template: 'mdd', workers: 1, formatRecognition: false }, stateDir: join(root, 'state', 'medical-extract') })
  const run = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  assert.ok(['completed', 'review'].includes(run.status), run.error)
  assert.equal(run.totals.documents, 4)
  assert.equal(run.totals.structured, 4)
  await svc.dispose()
})

test('只有结构化记录的输入：没有文书，给出提示', async () => {
  const root = await tmp()
  const d = join(root, 'export', '证件-AAAAAA', '检验'); await mkdir(d, { recursive: true })
  await writeFile(join(d, 'C0102_0303_0201住院检验常规报告.json'), JSON.stringify([
    { _id: 'L1', WS04_30_020_01: '血红蛋白量', WS04_30_009_03: '98', WS04_30_016_01: 'g/L', WS06_00_926_01: ts('2024-03-11 08:00') },
    { _id: 'L2', WS04_30_020_01: '血钾', WS04_30_009_03: '3.9', WS04_30_016_01: 'mmol/L', WS06_00_926_01: ts('2024-03-11 08:00') },
  ]))
  const svc = createService({ config: { extractMode: 'rules', template: 'mdd', workers: 1, formatRecognition: false }, stateDir: join(root, 'state', 'medical-extract') })
  const run = await runToEnd(svc, { inputDir: join(root, 'export'), outputRoot: join(root, 'out') })
  assert.equal(run.totals.documents, 0)
  assert.equal(run.totals.structured, 2)
  assert.ok(run.warnings.some((w) => w.includes('没有文书')))
  await svc.dispose()
})

test('数据元对照表：编码忽略分隔符；中文名进画像', async () => {
  const root = await tmp()
  const f = join(root, 'dict.csv')
  await writeFile(f, '编码,名称\nWS05.10.133.01,病情记录\nWS04_01_119_01,病例特点\n')
  const dict = await loadElementDict(f)
  assert.equal(dict.get('WS0510133' + '01'), '病情记录')
  const input = await writeCoded(join(root, 'export'))
  const seen = fakeModel('fake-a')
  const svc = createService({ config: { extractMode: 'hybrid', template: 'mdd', workers: 1, elementDict: f, verifySampleRate: 0 }, stateDir: join(root, 'state', 'medical-extract'), chatImpl: { extract: seen, verify: fakeModel('fake-b') } })
  const run = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  assert.equal(run.format.dict, 2)
  assert.ok(seen.seen.some((p) => p.includes('"中文名":"病情记录"')))
  const t = (await svc.formats(run.id)).tables.find((x) => /病程/.test(x.table))
  assert.equal(t.fields.find((x) => x.name === 'WS05_10_133_01').label, '病情记录')
  await svc.dispose()
})
