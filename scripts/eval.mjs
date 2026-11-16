/**
 * 评测：用虚构金标准（test/fixtures/eval-mdd.mjs）跑几种模型配置，按文书×字段打分。
 *
 *   node scripts/eval.mjs <输出目录> [配置名…]
 *
 * 端点、模型从环境变量读（不写进仓库）：
 *   EVAL_A_URL / EVAL_A_MODEL   模型 A（默认作提取模型）
 *   EVAL_B_URL / EVAL_B_MODEL   模型 B（默认作核验模型）
 * 同一输出目录下各配置共用模型缓存（温度 0、提示相同 → 同一模型第一遍的回答完全一样，比较只差在核验与复查）。
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { createService } from '../lib/service.js'
import { compileTemplate, loadTemplate } from '../lib/template/load.js'
import { docLevel, sameConclusion } from '../lib/engine/shard.js'
import { DOCS, EVAL_FIELDS, evalNdjson } from '../test/fixtures/eval-mdd.mjs'

const NM = '未提及'
const out = process.argv[2]
if (!out) { console.error('用法：node scripts/eval.mjs <输出目录> [配置名…]'); process.exit(2) }
const A = { url: process.env.EVAL_A_URL, model: process.env.EVAL_A_MODEL }
const B = { url: process.env.EVAL_B_URL, model: process.env.EVAL_B_MODEL }

const CONFIGS = {
  'A-only': { label: `单模型 ${A.model}`, baseURL: A.url, model: A.model, verifyModel: '' },
  'B-only': { label: `单模型 ${B.model}`, baseURL: B.url, model: B.model, verifyModel: '' },
  'AB-default': { label: `双模型 ${A.model}→${B.model}（默认抽样 2%＋每字段至少 2 次）`, baseURL: A.url, model: A.model, verifyBaseURL: B.url, verifyModel: B.model, verifySampleRate: 0.02 },
  'AB-full': { label: `双模型 ${A.model}→${B.model}（全部核验）`, baseURL: A.url, model: A.model, verifyBaseURL: B.url, verifyModel: B.model, verifySampleRate: 1 },
  'BA-full': { label: `双模型 ${B.model}→${A.model}（全部核验）`, baseURL: B.url, model: B.model, verifyBaseURL: A.url, verifyModel: A.model, verifySampleRate: 1 },
}
const names = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(CONFIGS)

async function* readGz(dir) {
  let files = []
  try { files = (await readdir(dir)).filter((f) => f.endsWith('.ndjson.gz')).sort() } catch { return }
  for (const f of files) {
    const rl = createInterface({ input: createReadStream(join(dir, f)).pipe(createGunzip()), crlfDelay: Infinity })
    for await (const line of rl) if (line.trim()) yield JSON.parse(line)
  }
}

const inputDir = join(out, 'input')
await mkdir(inputDir, { recursive: true })
await writeFile(join(inputDir, 'eval-mdd.ndjson'), evalNdjson())
const tpl = compileTemplate(await loadTemplate('mdd'))
const fields = EVAL_FIELDS.map((id) => { const f = tpl.byId.get(id); if (!f) throw new Error(`模板里没有字段 ${id}`); return f })

function score(values, openItems) {
  // 插件给文书的编号是散列；评测集里 病人＋写成时间 唯一，按它对上
  const keyOf = (x) => `${x.patient}|${x.written}`
  const byDoc = new Map()
  for (const v of values) { if (!byDoc.has(keyOf(v))) byDoc.set(keyOf(v), []); byDoc.get(keyOf(v)).push(v) }
  const open = new Set(openItems.map((it) => `${keyOf(it)}|${it.field}`))
  const cells = []
  for (const d of DOCS) {
    const docId = `${d.patient_id}|${d.record_time}`
    const vs = byDoc.get(docId) ?? []
    for (const f of fields) {
      const alts = [].concat(d.gold[f.id] ?? NM)
      const pred = docLevel(f, vs)
      const ok = alts.some((g) => sameConclusion(f, g, pred))
      cells.push({ doc: d.id, field: f.id, gold: alts, pred, ok, open: open.has(`${docId}|${f.id}`) })
    }
  }
  return cells
}

function metrics(cells, { oracle = false } = {}) {
  let tp = 0; let fp = 0; let req = 0; let reqOk = 0; let ok = 0; let miss = 0; let spur = 0; let wrong = 0
  for (const c of cells) {
    const good = c.ok || (oracle && c.open)
    const predSet = c.pred !== NM && !(oracle && c.open && !c.ok)
    const required = !c.gold.includes(NM)
    if (good) ok++
    if (required) { req++; if (good) reqOk++ }
    if (oracle && c.open && !c.ok) { if (!c.gold.includes(NM)) tp++; continue }
    if (predSet) { if (good) tp++; else fp++ }
    if (!good) { if (c.pred === NM) miss++; else if (c.gold.length === 1 && c.gold[0] === NM) spur++; else wrong++ }
  }
  const P = tp / (tp + fp || 1); const R = reqOk / (req || 1)
  return { cells: cells.length, acc: ok / cells.length, P, R, F1: 2 * P * R / (P + R || 1), miss, spur, wrong, errors: cells.length - ok }
}

const results = {}
for (const name of names) {
  const c = CONFIGS[name]
  if (!c) { console.error(`没有配置 ${name}`); continue }
  const svc = createService({ config: { ...c, formatRecognition: false, borrowFormats: false, autoConcurrency: false, modelConcurrency: 8, verifyConcurrency: 8, temperature: 0 }, stateDir: join(out, 'state') })
  const t0 = Date.now()
  const { runId } = await svc.start({ inputDir: join(inputDir, 'eval-mdd.ndjson'), outputRoot: join(out, 'root'), template: 'mdd' })
  let run
  for (;;) { await new Promise((r) => setTimeout(r, 1500)); run = (await svc.status(runId)).run; if (run.status !== 'running') break }
  const ms = Date.now() - t0
  const work = join(out, 'root', '_records', 'runs', runId, 'work')
  const values = []; for await (const v of readGz(join(work, 'evidence'))) values.push(v)
  const items = []; for await (const it of readGz(join(work, 'review'))) items.push(it)
  const openItems = items.filter((it) => !it.resolved)
  const cells = score(values, openItems)
  const perf = run.models ?? run.perf ?? null
  results[name] = {
    label: c.label, runId, status: run.status, ms, totals: { calls: run.totals.calls, cached: run.totals.cached, failed: run.totals.failed, values: run.totals.values, review: run.totals.review },
    verify: run.verify, adjudicated: items.length, resolved: items.length - openItems.length, open: openItems.length,
    auto: metrics(cells), withHuman: metrics(cells, { oracle: true }), perf, cells,
  }
  const m = results[name].auto
  console.log(`${name}\t${run.status}\tacc ${(m.acc * 100).toFixed(1)}\tP ${(m.P * 100).toFixed(1)}\tR ${(m.R * 100).toFixed(1)}\tF1 ${(m.F1 * 100).toFixed(1)}\t错 ${m.errors}（漏 ${m.miss} 多 ${m.spur} 值错 ${m.wrong}）\t复查 ${items.length} 自动一致 ${items.length - openItems.length} 转人工 ${openItems.length}\t调用 ${run.totals.calls}+缓存 ${run.totals.cached}\t${(ms / 1000).toFixed(0)}s`)
  await svc.dispose?.()
}
await writeFile(join(out, 'results.json'), JSON.stringify(results, null, 2))
console.log(`结果：${join(out, 'results.json')}`)
