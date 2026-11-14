import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeMddPatients, synthNdjson } from './fixtures/mdd.mjs'
import { readCsv, readEvidence, runToEnd, service, tmp } from './helpers.mjs'
import { sha256 } from '../lib/util.js'

async function hashTree(dir) {
  const out = {}
  const walk = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) await walk(p); else out[p] = sha256(await readFile(p)) } }
  await walk(dir)
  return out
}

test('p_doc 导出，仅规则：宽表取值、证据逐字、源文件不变', async () => {
  const root = await tmp()
  const input = await writeMddPatients(join(root, 'in'))
  const before = await hashTree(input)
  const svc = service({ extractMode: 'rules' })
  const run = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  await svc.dispose()
  assert.equal(run.status, 'completed', run.error)
  assert.deepEqual(await hashTree(input), before)
  const out = join(root, 'out', 'in')
  const P = Object.fromEntries((await readCsv(join(out, 'wide_patient.csv'))).map((r) => [r.patient, r]))
  const E = Object.fromEntries((await readCsv(join(out, 'wide_encounter.csv'))).map((r) => [r.encounter, r]))
  assert.equal(P['MDD-A'].B1, '2016'); assert.equal(P['MDD-A'].B2, '27')
  assert.equal(P['MDD-A'].J5, '有'); assert.equal(P['MDD-A'].J6, '无'); assert.equal(P['MDD-A'].I3, '有')
  assert.equal(P['MDD-B'].J5, '有'); assert.equal(P['MDD-B'].A7, '无') // 父亲双相：家族史，不是本人
  assert.equal(P['MDD-B'].B1, '2024-10')
  assert.equal(P['MDD-C'].A7, '有'); assert.equal(P['MDD-C'].J2, '离异')
  assert.equal(E['住院-A1'].A2, '复发性'); assert.equal(E['住院-A1'].A3, '重度'); assert.equal(E['住院-A1'].A4, '无')
  assert.equal(E['住院-A1'].H2, '70'); assert.equal(E['住院-A1'].H3, '是'); assert.equal(E['住院-A1'].H4, '否')
  assert.equal(E['住院-A1'].G2, '8'); assert.equal(E['住院-A1'].D6, '高'); assert.equal(E['住院-A1'].H1, '显效')
  assert.equal(E['住院-A1'].F6, '文拉法辛缓释胶囊 225mg qd；喹硫平 100mg qn；左甲状腺素钠 50μg qd；门诊随访')
  assert.equal(E['就诊-B1'].D1, '无'); assert.equal(E['就诊-B1'].C15, '完整'); assert.equal(E['就诊-B2'].F1, '艾司西酞普兰')
  assert.equal(E['住院-C1'].A4, '有'); assert.equal(E['住院-C1'].H5, '有'); assert.equal(E['住院-C1'].F3, '碳酸锂')
  // 门诊作废记录（INVLD_FLG=1）不读
  const ev = await readEvidence(join(out, 'evidence'))
  assert.ok(!ev.some((v) => v.quote === '无殊。'))
  // 时间点：HAMD 版本
  const tp = await readCsv(join(out, 'timepoints.csv'))
  assert.deepEqual(tp.filter((r) => r.patient === 'MDD-B' && r.field === 'E1').map((r) => [r.value, r.variant]), [['26', 'HAMD-24'], ['14', 'HAMD-24']])
  // 冲突：自知力两版入院记录不同
  const cf = await readCsv(join(out, 'conflicts.csv'))
  assert.ok(cf.some((r) => r.field === 'C15' && r.patient === 'MDD-C'))
  // manifest、报告
  const man = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'))
  assert.equal(man.format, 'extract-delivery/1'); assert.equal(man.template.id, 'mdd')
  const rep = await readFile(join(root, 'out', '_records', 'runs', run.id, 'report.md'), 'utf8')
  assert.match(rep, /验收门/)
  assert.ok((await stat(join(out, 'result.xlsx'))).size > 1000)
})

test('证据：每个值的引语等于原文 [s,e)', async () => {
  const root = await tmp()
  const input = await writeMddPatients(join(root, 'in'))
  const svc = service({ extractMode: 'rules' })
  const run = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  const ev = await readEvidence(join(root, 'out', 'in', 'evidence'))
  const docs = new Map()
  for (const v of ev.slice(0, 80)) {
    if (!docs.has(v.doc)) docs.set(v.doc, (await svc.document(run.id, { patient: v.patient, doc: v.doc })).document.text)
    assert.equal(docs.get(v.doc).slice(v.s, v.e), v.quote)
  }
  await svc.dispose()
})

/** 假模型：对提示里的每个字段，用片段里第一处出现的选项写法或"有"作答；另外故意给一条编造的引语。 */
function fakeModel(name = 'fake') {
  let calls = 0
  return {
    model: name,
    get calls() { return calls },
    async chat(messages) {
      calls++
      const prompt = messages.at(-1).content
      const fields = JSON.parse(prompt.match(/要抽取的字段：\n(.*)\n原文片段：/s)[1])
      const snippets = [...prompt.matchAll(/^(S\d+): (.*)$/gm)].map((m) => ({ id: m[1], text: m[2] }))
      const values = []
      for (const f of fields) {
        for (const sn of snippets) {
          const opt = (f.options ?? []).find((o) => sn.text.includes(o))
          if (f.options && opt) { values.push({ field: f.id, value: opt, assertion: '阳性', quote: opt, snippet: sn.id }); break }
          if (f.type === 'date') { const m = sn.text.match(/\d{4}年/); if (m) { values.push({ field: f.id, value: m[0].slice(0, 4), assertion: '阳性', quote: m[0], snippet: sn.id }); break } }
        }
      }
      values.push({ field: fields[0].id, value: '有', assertion: '阳性', quote: '这句话原文里没有', snippet: 'S1' })
      return { content: JSON.stringify({ values }), usage: { prompt_tokens: 10, completion_tokens: 10 }, ms: 1 }
    },
  }
}

test('模型抽取：引语核对丢弃编造、缓存复用、核验一致率', async () => {
  const root = await tmp()
  const input = await writeMddPatients(join(root, 'in'))
  const extract = fakeModel('fake-a'); const verify = fakeModel('fake-b')
  const svc = service({ extractMode: 'hybrid', verifySampleRate: 1 }, { chatImpl: { extract, verify } })
  const run = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  assert.ok(['completed', 'review'].includes(run.status), run.error)
  assert.ok(run.totals.calls > 0)
  assert.ok(run.totals.quoteFail > 0, '编造的引语应被丢弃')
  const ev = await readEvidence(join(root, 'out', 'in', 'evidence'))
  assert.ok(!ev.some((v) => v.quote === '这句话原文里没有'))
  assert.ok(ev.some((v) => v.method === 'model' || v.method === 'model+rule'))
  assert.equal(run.gates.find((g) => g.id === '④').skipped, undefined)
  assert.ok(Object.keys(run.verify).length > 0)
  // 第二次：全部命中缓存，不再调用
  const n = extract.calls + verify.calls
  const run2 = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  assert.equal(extract.calls + verify.calls, n)
  assert.equal(run2.totals.calls, 0); assert.ok(run2.totals.cached > 0)
  await svc.dispose()
})

test('通用 ndjson：自动识别字段、多分片多线程、取消后继续', async () => {
  const root = await tmp()
  const file = await synthNdjson(join(root, 'notes.ndjson'), 6000, { seed: 3 })
  // 小单元强制切成多段字节区间
  const svc = service({ extractMode: 'rules', workers: 3, unitBytes: 256 * 1024 })
  const r = await svc.start({ inputDir: file, outputRoot: join(root, 'out') })
  for (;;) { const { run } = await svc.status(r.runId); if (run.shards.done >= 1 || run.status !== 'running') break; await new Promise((s) => setTimeout(s, 20)) }
  svc.cancel(r.runId)
  let run
  for (;;) { ({ run } = await svc.status(r.runId)); if (run.status !== 'running') break; await new Promise((s) => setTimeout(s, 50)) }
  if (run.status === 'cancelled') {
    assert.ok(run.shards.total > 1)
    const run2 = await runToEnd(svc, { resumeFrom: r.runId })
    assert.equal(run2.status, 'completed', run2.error)
    run = run2
  }
  assert.equal(run.status, 'completed', run.error)
  assert.equal(run.totals.documents, 6000)
  assert.equal(run.plan.mappings['notes.ndjson'].text, 'content')
  assert.equal(run.plan.mappings['notes.ndjson'].patient, 'patient_id')
  const P = await readCsv(join(root, 'out', 'notes', 'wide_patient.csv'))
  assert.equal(P.length, 300)
  const E = await readCsv(join(root, 'out', 'notes', 'wide_encounter.csv'))
  assert.ok(E.length > 300)
  // 每份文书只算一次（继续处理不重复）
  const ev = await readEvidence(join(root, 'out', 'notes', 'evidence'))
  const keys = new Set(ev.map((v) => v.id))
  assert.equal(keys.size, ev.length)
  await svc.dispose()
})

test('截至时刻：只用此前写成的文书', async () => {
  const root = await tmp()
  const input = await writeMddPatients(join(root, 'in'))
  const svc = service({ extractMode: 'rules' })
  const run = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out'), asOf: '2024-04-30 00:00' })
  await svc.dispose()
  assert.equal(run.status, 'completed', run.error)
  assert.ok(run.totals.skipped > 0)
  const ev = await readEvidence(join(root, 'out', 'in', 'evidence'))
  assert.ok(ev.every((v) => !v.written || v.written <= '2024-04-30 00:00'))
})

test('人工裁定：改判值，重跑沿用', async () => {
  const root = await tmp()
  const input = await writeMddPatients(join(root, 'in'))
  const svc = service({ extractMode: 'rules' })
  const run = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  const ev = await readEvidence(join(root, 'out', 'in', 'evidence'))
  // 值级：两版入院记录各有一条"离异"，两条都改判
  for (const v of ev.filter((x) => x.field === 'J2' && x.patient === 'MDD-C')) await svc.decide(run.id, { kind: 'value', target: v.id, decision: 'correct', value: '已婚' })
  // 格子级：自知力冲突直接裁定
  const cell = (await readCsv(join(root, 'out', 'in', 'conflicts.csv'))).find((r) => r.field === 'C15' && r.patient === 'MDD-C').cell
  await svc.decide(run.id, { kind: 'cell', target: cell, decision: 'correct', value: '部分' })
  const run2 = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  const P = Object.fromEntries((await readCsv(join(root, 'out', 'in', 'wide_patient.csv'))).map((r) => [r.patient, r]))
  assert.equal(P['MDD-C'].J2, '已婚')
  const E = Object.fromEntries((await readCsv(join(root, 'out', 'in', 'wide_encounter.csv'))).map((r) => [r.encounter, r]))
  assert.equal(E['住院-C1'].C15, '部分')
  assert.ok(!(await readCsv(join(root, 'out', 'in', 'conflicts.csv'))).some((r) => r.cell === cell))
  assert.equal(run2.totals.conflicts, run.totals.conflicts - 1)
  await svc.dispose()
})

test('输入保护：输出不能在输入里；模板不存在报错', async () => {
  const root = await tmp()
  const input = await writeMddPatients(join(root, 'in'))
  const svc = service({ extractMode: 'rules' })
  await assert.rejects(svc.start({ inputDir: input, outputRoot: join(input, 'x') }), /不能/)
  await assert.rejects(svc.start({ inputDir: input, outputRoot: join(root, 'out'), template: 'nope' }), /找不到模板/)
  await writeFile(join(root, 'empty.txt'), '')
  await svc.dispose()
})

test('通用 json：数据元编码列名、病人按目录、多列正文、文件名作文书类型、按值认时间列', async () => {
  const root = await tmp()
  const input = join(root, 'export')
  // 虚构：两位病人，各一个文件夹；列名是数据元编码，正文分在多列
  for (const [pt, hpi] of [['证件-AAA', '患者3月前出现情绪低落，否认自杀观念。'], ['证件-BBB', '患者1年前出现心情差，有消极念头。']]) {
    await mkdir(join(input, pt, '住院病历与病程'), { recursive: true })
    await writeFile(join(input, pt, '住院病历与病程', 'C0102_0515_02住院病程记录首次病程记录.json'), JSON.stringify([
      { _id: `${pt}-1`, _SOURCE_DB: 'hisdb01', WS05_10_133_01: `病例特点：${hpi}`, WS05_01_070_02: '诊疗计划：予舍曲林50mg qd。', WS06_00_298_01: '20240310143000', JGID: '医院-000009' },
      { _id: `${pt}-2`, _SOURCE_DB: 'hisdb01', WS05_10_133_01: '病例特点：HAMD-17 评分 24分。', WS05_01_070_02: '', WS06_00_298_01: '20240311090000', JGID: '医院-000009' },
    ]))
  }
  const svc = service({ extractMode: 'rules' })
  const run = await runToEnd(svc, { inputDir: input, outputRoot: join(root, 'out') })
  await svc.dispose()
  assert.equal(run.status, 'completed', run.error)
  const m = Object.values(run.plan.mappings)[0]
  assert.deepEqual(m.text, ['WS05_10_133_01', 'WS05_01_070_02'])
  assert.equal(m.time, 'WS06_00_298_01')
  assert.equal(run.totals.documents, 4)
  assert.equal(run.totals.patients, 2)
  const ev = await readEvidence(join(root, 'out', 'export', 'evidence'))
  assert.ok(ev.every((v) => v.recordType === '住院病程记录首次病程记录'))
  assert.ok(ev.every((v) => v.written?.startsWith('2024-03-1')))
  assert.ok(ev.some((v) => v.field === 'F1' && v.value === '舍曲林'))
  assert.ok(ev.some((v) => v.field === 'E1' && v.value === 24))
  const P = Object.fromEntries((await readCsv(join(root, 'out', 'export', 'wide_patient.csv'))).map((r) => [r.patient, r]))
  assert.deepEqual(Object.keys(P).sort(), ['证件-AAA', '证件-BBB'])
})
