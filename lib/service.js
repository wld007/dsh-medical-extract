/**
 * 批次服务：规划 → 分片（工作线程并行，断点续跑）→ 汇总 → 验收门 → 交付 → 报告。
 * Agent 工具、/extract 命令、页面 RPC 共用这一个服务；同时只跑一个批次。
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { cp, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { Worker } from 'node:worker_threads'
import { planInput, isToolOutput } from './source/index.js'
import { walk } from './source/pdoc.js'
import { compileTemplate, listTemplates, loadTemplate, validateTemplate } from './template/load.js'
import { templateToXlsx, xlsxToTemplate } from './template/excel.js'
import { recognize, summarizeRecognition, loadElementDict, openLibrary, ADOPTED } from './recognize/index.js'
import { checkSpec, normalizeSpec, fixSpec } from './recognize/draft.js'
import { RECORD_TYPES } from './recognize/canon.js'
import { openRecords } from './records/store.js'
import { processShard, partName } from './engine/shard.js'
import { rollup, readParts, cellId, cellKey } from './engine/rollup.js'
import { renderReport, fieldRows } from './report.js'
import { csvLine } from './util.js'

export const RECORDS = '_records'
export const DEFAULTS = {
  outputRoot: '',
  template: 'mdd',
  extractMode: 'hybrid',
  priorities: [],
  mapping: {},
  modelEnabled: true,
  baseURL: '',
  model: '',
  apiKey: '',
  verifyBaseURL: '',
  verifyModel: '',
  disableThinking: true,
  timeoutMs: 120000,
  modelConcurrency: 8,
  workers: 0,
  shardUnits: 20,
  verifySampleRate: 0.02,
  verifyMinPerField: 2,
  verifyThreshold: 0.9,
  xlsxMaxRows: 200000,
  // 格式识别（通用文件）：按表识别类别、写成时间、病人、就诊、栏目；数据元对照表（编码→中文名，csv/xlsx/json）
  formatRecognition: true,
  elementDict: '',
  // 借用病历事件还原插件格式库里已采用的识别结果（只读）
  borrowFormats: true,
  // 识别还没定（分歧、校验不过、只有规则草稿）的表：generic＝先按通用读法读；skip＝跳过，等确认
  heldTables: 'generic',
  showSidebarEntry: true,
}
export const SAVABLE = Object.keys(DEFAULTS)

async function exists(p) { try { await stat(p); return true } catch { return false } }
async function realish(p) {
  let cur = resolve(p); const rest = []
  for (;;) {
    try { return join(await realpath(cur), ...rest) } catch { /* climb */ }
    const up = dirname(cur)
    if (up === cur) return resolve(p)
    rest.unshift(basename(cur)); cur = up
  }
}
const inside = (child, parent) => child === parent || child.startsWith(parent + sep)
const newRunId = () => {
  const d = new Date(); const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${randomBytes(3).toString('hex')}`
}
async function snapshot(input) {
  const st = await stat(input)
  const files = st.isDirectory() ? await walk(input, [], isToolOutput) : [input]
  const snap = {}
  for (const f of files) { const s = await stat(f); snap[f] = `${s.size}:${s.mtimeMs}` }
  return snap
}

export function createService({ config = {}, defaultDirectory = process.cwd(), stateDir = null, chatImpl = null } = {}) {
  const settings = { ...DEFAULTS, ...config }
  let active = null // { id, cancelled, workers, run }
  const stores = new Map()
  const runRoots = new Map() // runId -> outputRoot (for lookups)
  // 本机格式库（各输出根目录共用）；兄弟插件病历事件还原的格式库只读借用
  const library = openLibrary(stateDir)
  const siblings = () => {
    if (!stateDir || settings.borrowFormats === false) return []
    const lib = openLibrary(join(dirname(stateDir), 'medical-event'))
    lib.label = '病历事件还原'
    return [lib]
  }

  async function recordsOf(outputRoot, { create = true } = {}) {
    if (!stores.has(outputRoot)) {
      if (!create && !(await exists(join(outputRoot, RECORDS)))) return null
      const p = openRecords(join(outputRoot, RECORDS))
      p.catch(() => stores.delete(outputRoot))
      stores.set(outputRoot, p)
    }
    return stores.get(outputRoot)
  }

  const rootsFile = () => (stateDir ? join(stateDir, 'roots.json') : null)
  async function rememberRoot(root) {
    const f = rootsFile(); if (!f) return
    let roots = []
    try { roots = JSON.parse(await readFile(f, 'utf8')) } catch { /* new */ }
    roots = [root, ...roots.filter((r) => r !== root)].slice(0, 20)
    await mkdir(dirname(f), { recursive: true })
    await writeFile(f, JSON.stringify(roots, null, 2))
  }
  async function knownRoots() {
    const f = rootsFile(); let roots = []
    if (f) try { roots = JSON.parse(await readFile(f, 'utf8')) } catch { /* none */ }
    for (const r of runRoots.values()) if (!roots.includes(r)) roots.push(r)
    return roots
  }

  async function allRuns() {
    const out = new Map()
    for (const root of await knownRoots()) {
      const rec = await recordsOf(root, { create: false }).catch(() => null)
      if (!rec) continue
      for (const r of rec.listRuns(50)) { out.set(r.id, r); runRoots.set(r.id, root) }
    }
    if (active) out.set(active.run.id, active.run)
    return [...out.values()].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
  }
  async function getRun(runId) {
    if (active && (!runId || active.run.id === runId)) return active.run
    const runs = await allRuns()
    return runId ? runs.find((r) => r.id === runId) ?? null : runs[0] ?? null
  }
  function modelInfo() {
    const on = settings.modelEnabled !== false && Boolean(settings.baseURL && settings.model)
    return on || chatImpl ? { model: chatImpl?.extract?.model ?? settings.model, verifyModel: chatImpl?.verify?.model ?? settings.verifyModel ?? '' } : null
  }

  async function resolvePaths({ inputDir, outputRoot }) {
    if (!inputDir) throw new Error('缺少输入目录或文件（inputDir）')
    const input = await realish(isAbsolute(inputDir) ? inputDir : resolve(defaultDirectory, inputDir))
    if (!(await exists(input))) throw new Error(`输入不存在：${input}`)
    const st = await stat(input)
    const base = st.isDirectory() ? input : dirname(input)
    const out = await realish(outputRoot ? (isAbsolute(outputRoot) ? outputRoot : resolve(defaultDirectory, outputRoot)) : (settings.outputRoot || join(dirname(base), '_medical-extract')))
    if (out === input || inside(out, input) && st.isDirectory()) throw new Error('输出根目录不能与输入相同，也不能放在输入里面')
    if (st.isDirectory() && inside(input, out)) throw new Error('输出根目录不能包含输入')
    return { input, outputRoot: out, inputName: basename(input).replace(/\.[^.]+$/, '') || 'input' }
  }

  /** Start a batch. Returns immediately with the run id. */
  async function start(opts = {}) {
    if (active) throw Object.assign(new Error(`已有批次 ${active.run.id} 在运行；结束或取消后再开新批次`), { code: 'busy' })
    let prev = null
    if (opts.resumeFrom) {
      prev = await getRun(opts.resumeFrom)
      if (!prev) throw new Error(`找不到批次 ${opts.resumeFrom}`)
      if (!['cancelled', 'failed'].includes(prev.status)) throw new Error(`批次 ${prev.id} 状态为 ${prev.status}，只有已取消或失败的批次可以继续`)
    }
    const paths = prev ? { input: prev.input, outputRoot: prev.outputRoot, inputName: prev.inputName } : await resolvePaths(opts)
    const rawTemplate = prev ? prev.templateRaw : await loadTemplate(opts.template ?? settings.template, stateDir)
    const problems = validateTemplate(rawTemplate)
    if (problems.length) throw Object.assign(new Error(`模板校验未通过：\n- ${problems.join('\n- ')}`), { code: 'template-invalid' })
    const priorities = prev ? prev.priorities : [].concat(opts.priorities ?? settings.priorities ?? []).filter(Boolean)
    const tpl = compileTemplate(rawTemplate, { priorities })
    const mode = prev ? prev.mode : opts.mode ?? settings.extractMode
    if (!['hybrid', 'model', 'rules'].includes(mode)) throw new Error('mode 应为 hybrid、model 或 rules')
    const asOf = prev ? prev.asOf : opts.asOf ? String(opts.asOf).trim() : null
    if (asOf && !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?$/.test(asOf)) throw new Error('asOf 格式应为 "YYYY-MM-DD HH:mm"')
    const records = await recordsOf(paths.outputRoot)
    const id = newRunId()
    const run = {
      id, status: 'running', startedAt: new Date().toISOString(), finishedAt: null,
      source: opts.source ?? { kind: 'agent' }, resumedFrom: prev?.id ?? null,
      input: paths.input, inputName: paths.inputName, outputRoot: paths.outputRoot,
      template: { id: tpl.id, name: tpl.name, version: tpl.version, signature: tpl.signature, fields: tpl.fields.length }, templateRaw: rawTemplate,
      priorities, mode, asOf, model: modelInfo(),
      plan: null, shards: { total: 0, done: 0, running: 0 },
      totals: { documents: 0, skipped: 0, values: 0, recalled: 0, calls: 0, cached: 0, failed: 0, quoteFail: 0, invalid: 0, outOfRange: 0, agree: 0, disagree: 0, review: 0, conflicts: 0, patients: 0, encounters: 0, byMethod: {} },
      byField: {}, verify: {}, problems: [], gates: [], warnings: [], output: null, error: null, current: { stage: 'E1', step: '规划输入' }, rate: null,
    }
    if (!run.model && mode !== 'rules') run.warnings.push('未配置模型：只跑规则，规则定不了的值标"待定"')
    if (run.model && !run.model.verifyModel) run.warnings.push('未配置核验模型：不做抽样核验，验收门④跳过')
    active = { run, cancelled: false, workers: [], records, prevId: prev?.id ?? null }
    runRoots.set(id, paths.outputRoot)
    records.putRun(run)
    await rememberRoot(paths.outputRoot)
    execute(active, tpl).catch(() => { /* recorded in run */ })
    return { runId: id, outputRoot: paths.outputRoot, template: tpl.id, mode, modelConfigured: Boolean(run.model), model: run.model?.model ?? null }
  }

  async function execute(job, tpl) {
    const { run, records } = job
    const runDir = join(run.outputRoot, RECORDS, 'runs', run.id)
    const workDir = join(runDir, 'work')
    const save = () => { run.updatedAt = new Date().toISOString(); records.putRun(run) }
    let saveTimer = null
    try {
      await mkdir(workDir, { recursive: true })
      const before = await snapshot(run.input)
      // plan (reuse previous plan and finished shards on resume)
      let plan; let doneShards = new Set()
      if (job.prevId) {
        const prevDir = join(run.outputRoot, RECORDS, 'runs', job.prevId, 'work')
        plan = JSON.parse(await readFile(join(prevDir, 'plan.json'), 'utf8'))
        doneShards = new Set(records.shards(job.prevId).filter((s) => s.status === 'done').map((s) => s.shard))
        for (const d of ['evidence', 'entities', 'review']) {
          await mkdir(join(workDir, d), { recursive: true })
          for (const s of doneShards) { const f = join(prevDir, d, partName(s)); if (await exists(f)) await cp(f, join(workDir, d, partName(s))) }
        }
        for (const s of records.shards(job.prevId)) if (s.status === 'done') { records.putShard(run.id, { ...s, values: s.vals, stats: s.stats }); mergeStats(run, s.stats) }
      } else {
        const p = await planInput(run.input, { mapping: settings.mapping, unitBytes: Number(settings.unitBytes) || undefined })
        const per = p.kind === 'pdoc' ? Math.max(1, Number(settings.shardUnits) || 20) : 1
        const shards = []
        for (let i = 0; i < p.units.length; i += per) shards.push(p.units.slice(i, i + per))
        plan = { kind: p.kind, format: p.format, inputDir: p.inputDir, mappings: p.mappings, byFolder: Boolean(p.byFolder), shards, specs: {}, ignored: [] }
        if (p.kind === 'generic' && settings.formatRecognition !== false) {
          run.current = { stage: 'E1', step: '格式识别' }
          save()
          const files = [...new Set(p.units.map((u) => u.file))]
          let dict = null
          if (settings.elementDict) {
            try { dict = await loadElementDict(isAbsolute(settings.elementDict) ? settings.elementDict : resolve(defaultDirectory, settings.elementDict)) } catch (e) { run.warnings.push(`数据元对照表读不了：${e.message}`) }
          }
          const r = await recognize({
            files, root: p.inputDir, library, siblings: siblings(), settings: { ...settings, modelEnabled: run.mode !== 'rules' && settings.modelEnabled !== false }, chatImpl: chatImpl ? { extract: chatImpl.extract, verify: chatImpl.verify } : null,
            cache: records, dict, onCall: (e) => records.logCall(run.id, { at: new Date().toISOString(), ...e }),
            onProgress: (x) => { run.current = { stage: 'E1', step: `格式识别 ${x.done}/${x.total}` } }, isCancelled: () => job.cancelled,
          })
          records.flushStats(run.id)
          plan.specs = r.specs
          plan.ignored = settings.heldTables === 'skip' ? [...r.ignored, ...r.held] : r.ignored
          run.format = { ...summarizeRecognition(r), dict: dict ? dict.size : 0, heldPolicy: settings.heldTables }
          if (r.held.length) run.warnings.push(`有 ${r.held.length} 张表的格式还没定（${settings.heldTables === 'skip' ? '已跳过' : '先按通用读法读'}）：到「格式」页确认后重跑更准`)
          if (job.cancelled) throw Object.assign(new Error('已取消'), { code: 'cancelled' })
        }
      }
      await writeFile(join(workDir, 'plan.json'), JSON.stringify(plan))
      run.plan = { kind: plan.kind, format: plan.format, units: plan.shards.reduce((s, x) => s + x.length, 0), mappings: Object.fromEntries(Object.entries(plan.mappings ?? {}).slice(0, 20)) }
      run.shards = { total: plan.shards.length, done: doneShards.size, running: 0 }
      run.current = { stage: 'E3', step: '抽取' }
      save()
      saveTimer = setInterval(save, 2000)

      // shards
      const todo = plan.shards.map((units, shard) => ({ shard, units })).filter((s) => !doneShards.has(s.shard))
      const autoWorkers = Math.max(1, Math.min(8, availableParallelism() - 1))
      const nWorkers = chatImpl ? 1 : Math.max(1, Math.min(todo.length, Number(settings.workers) || autoWorkers))
      const modelWidth = Math.max(1, Math.ceil(Number(settings.modelConcurrency || 8) / nWorkers))
      const task = (s) => ({
        kind: 'shard', id: s.shard, runId: run.id, shard: s.shard, units: s.units, plan: { kind: plan.kind, inputDir: plan.inputDir, mappings: plan.mappings, byFolder: plan.byFolder, specs: plan.specs, ignored: plan.ignored },
        template: run.templateRaw, priorities: run.priorities, settings: { ...settings }, workDir, asOf: run.asOf, mode: run.mode, modelWidth,
      })
      const t0 = Date.now()
      const onShardDone = (shard, result) => {
        run.shards.done++
        mergeStats(run, result.stats)
        records.putShard(run.id, { shard, status: 'done', docs: result.stats.docs, values: result.stats.values, ms: result.stats.ms, finishedAt: new Date().toISOString(), stats: result.stats })
      }
      const progress = (n) => {
        run.liveDocs = (run.liveDocs ?? 0) + n
        const secs = (Date.now() - t0) / 1000
        if (secs > 2) run.rate = Math.round((run.liveDocs) / secs)
      }
      const inline = chatImpl || Number(settings.workers) === 1 || (nWorkers === 1 && todo.length <= 2)
      if (inline) {
        for (const s of todo) {
          if (job.cancelled) break
          run.shards.running = 1
          const result = await processShard(task(s), { store: records, chatImpl, isCancelled: () => job.cancelled, onProgress: progress })
          run.shards.running = 0
          if (result.cancelled) break
          onShardDone(s.shard, result)
        }
      } else {
        await runPool(job, todo.map(task), nWorkers, join(run.outputRoot, RECORDS), (t, result) => { if (!result.cancelled) onShardDone(t.shard, result) }, progress)
      }
      if (job.failure) throw job.failure
      if (job.cancelled) throw Object.assign(new Error('已取消'), { code: 'cancelled' })

      // rollup
      run.current = { stage: 'E5', step: '汇总·派生' }
      save()
      const decisions = records.decisions()
      const stagingDir = join(runDir, 'output', run.inputName)
      await rm(join(runDir, 'output'), { recursive: true, force: true })
      const est = run.totals.values
      // 每桶约 50 万个值：内存可控，桶数也足够把汇总分给各线程
      const bucketCount = Math.max(1, Math.min(4096, Math.ceil(est / 500_000)))
      const rWorkers = Math.max(1, Math.min(Number(settings.workers) || Math.max(1, Math.min(8, availableParallelism() - 1)), bucketCount, 16))
      const runTasks = inline || rWorkers === 1 ? null : (tasks) => runPool(job, tasks.map((t, i) => ({
        ...t, id: i, workDir, template: run.templateRaw, priorities: run.priorities, decisions: [...decisions],
      })), Math.max(rWorkers, 1), join(run.outputRoot, RECORDS), () => {}, () => {})
      const sum = await rollup({ tpl, workDir, outDir: stagingDir, decisions, bucketCount, isCancelled: () => job.cancelled, runTasks })
      if (job.cancelled) throw Object.assign(new Error('已取消'), { code: 'cancelled' })
      run.rollup = { filled: sum.filled }
      Object.assign(run.totals, { patients: sum.patients, encounters: sum.encounters, conflicts: sum.conflicts, rejected: sum.rejected })

      // E6 / gates
      run.current = { stage: 'E6', step: '验收门' }
      run.gates = gates(run, tpl)
      // delivery: evidence + review copies, manifest, xlsx
      run.current = { stage: 'E7', step: '交付' }
      await mkdir(join(stagingDir, 'evidence'), { recursive: true })
      for (const n of (await readdir(join(workDir, 'evidence'))).filter((x) => x.endsWith('.ndjson.gz')).sort()) await cp(join(workDir, 'evidence', n), join(stagingDir, 'evidence', n))
      await writeFile(join(stagingDir, 'fields.csv'), '\uFEFF' + csvLine(['id', 'name', 'group', 'priority', 'type', 'granularity', 'pick', 'definition']) + tpl.fields.map((f) => csvLine([f.id, f.name, f.group ?? '', f.priority, f.type, f.granularity, f.pick, f.definition])).join(''))
      await writeFile(join(stagingDir, 'template.json'), JSON.stringify(run.templateRaw, null, 2))
      const manifest = {
        format: 'extract-delivery/1', producer: { name: 'dsh-medical-extract', version: VERSION() },
        runId: run.id, input: run.inputName, template: run.template, mode: run.mode, asOf: run.asOf, model: run.model,
        counts: { documents: run.totals.documents, patients: run.totals.patients, encounters: run.totals.encounters, values: run.totals.values, conflicts: run.totals.conflicts, review: run.totals.review },
        gates: run.gates, files: {
          wide_patient: 'wide_patient.csv', wide_encounter: 'wide_encounter.csv', wide_document: tpl.fields.some((f) => f.granularity === 'document') ? 'wide_document.csv' : null,
          timepoints: 'timepoints.csv', conflicts: 'conflicts.csv', evidence: 'evidence/part-*.ndjson.gz', fields: 'fields.csv', template: 'template.json',
        },
        createdAt: new Date().toISOString(),
      }
      await writeFile(join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
      if (run.totals.values <= Number(settings.xlsxMaxRows ?? 200000)) {
        try { await writeXlsx(stagingDir, tpl, run) } catch (e) { run.warnings.push(`result.xlsx 未生成：${e.message}`) }
      }
      // source check
      const after = await snapshot(run.input)
      const changed = Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k]).length
      run.sourceCheck = { files: Object.keys(before).length, changed }
      if (changed) run.warnings.push(`源文件在运行期间有 ${changed} 个变化（插件没有写输入；可能有其他程序在改）`)
      // move to root
      const target = join(run.outputRoot, run.inputName)
      await rm(target, { recursive: true, force: true })
      await mkdir(run.outputRoot, { recursive: true })
      await rename(stagingDir, target)
      run.output = target
      run.status = run.totals.review > 0 ? 'review' : 'completed'
    } catch (error) {
      run.status = !job.failure && (error?.code === 'cancelled' || job.cancelled) ? 'cancelled' : 'failed'
      if (run.status === 'failed') run.error = String(error?.stack ?? error)
    } finally {
      clearInterval(saveTimer)
      run.current = null
      run.finishedAt = new Date().toISOString()
      try { records.flushStats(run.id) } catch { /* ignore */ }
      run.calls = callSummary(records, run.id)
      try {
        await mkdir(runDir, { recursive: true })
        await writeFile(join(runDir, 'report.md'), renderReport(run, tpl))
        await writeFile(join(runDir, 'report.json'), JSON.stringify({ ...run, templateRaw: undefined, fields: fieldRows(run, tpl) }, null, 2))
      } catch { /* best effort */ }
      save()
      if (active === job) active = null
    }
  }

  /** Run tasks on a pool of worker threads; resolves to results in task order. */
  async function runPool(job, tasks, n, recordsDir, onDone, progress) {
    const queue = tasks.map((t, i) => ({ t, i }))
    const results = new Array(tasks.length)
    let failure = null
    await Promise.all(Array.from({ length: Math.max(1, Math.min(n, tasks.length)) }, () => new Promise((resolveW) => {
      const w = new Worker(new URL('./engine/worker.js', import.meta.url), { workerData: { recordsDir } })
      job.workers.push(w)
      let current = null
      const finish = () => { job.workers = job.workers.filter((x) => x !== w); w.terminate().then(() => resolveW(), () => resolveW()) }
      const next = () => {
        if (job.cancelled || failure || !queue.length) { finish(); return }
        current = queue.shift()
        if (current.t.kind === 'shard') job.run.shards.running++
        w.postMessage({ type: 'task', task: current.t })
      }
      w.on('message', (m) => {
        if (m.type === 'ready') next()
        else if (m.type === 'progress') progress(m.docs)
        else if (m.type === 'done') { if (current.t.kind === 'shard') job.run.shards.running--; results[current.i] = m.result; onDone(current.t, m.result); next() }
        else if (m.type === 'error') {
          if (current.t.kind === 'shard') job.run.shards.running--
          failure ??= new Error(`${current.t.kind === 'shard' ? `分片 ${current.t.shard}` : current.t.kind} 失败：${m.error}`)
          job.cancelled = true
          for (const o of job.workers) o.postMessage({ type: 'cancel' })
          finish()
        }
      })
      w.on('error', (e) => { failure ??= e; job.cancelled = true; resolveW() })
    })))
    if (failure) { job.failure = failure; throw failure }
    return results
  }

  function mergeStats(run, s) {
    if (!s) return
    const T = run.totals
    for (const k of ['values', 'recalled', 'calls', 'cached', 'failed', 'quoteFail', 'invalid', 'outOfRange', 'agree', 'disagree', 'review', 'skipped']) T[k] += s[k] ?? 0
    T.documents += s.docs ?? 0
    for (const [k, v] of Object.entries(s.byMethod ?? {})) T.byMethod[k] = (T.byMethod[k] ?? 0) + v
    for (const [k, v] of Object.entries(s.byField ?? {})) { const b = (run.byField[k] ??= { values: 0, docs: 0 }); b.values += v.values; b.docs += v.docs }
    for (const [k, v] of Object.entries(s.verify ?? {})) { const b = (run.verify[k] ??= { n: 0, agree: 0 }); b.n += v.n; b.agree += v.agree }
    for (const p of s.problems ?? []) if (run.problems.length < 50) run.problems.push(p)
  }

  function gates(run, tpl) {
    const T = run.totals
    const modelVals = (T.byMethod.model ?? 0) + (T.byMethod['model+rule'] ?? 0)
    const answered = modelVals + T.quoteFail
    const out = []
    out.push({ id: '①', label: '引语与原文逐字一致', pass: true, detail: answered ? `模型回答中 ${T.quoteFail} 条引语对不上原文，已丢弃（${((T.quoteFail / answered) * 100).toFixed(2)}%）；交付的值全部逐字一致` : '交付的值全部逐字一致', quoteFail: T.quoteFail })
    out.push({ id: '②', label: '值在类型、选项、值域之内', pass: T.outOfRange === 0, detail: `不合类型或选项被丢弃 ${T.invalid} 条；超出值域 ${T.outOfRange} 条（已交付并标"超出值域"）`, invalid: T.invalid, outOfRange: T.outOfRange })
    out.push({ id: '③', label: '每个格子可回溯到值、每个值可回溯到原文', pass: true, detail: `宽表格子带 __n 证据数；证据长表每行带文书编号与起止位置；冲突 ${T.conflicts} 个另列` })
    const thr = Number(settings.verifyThreshold ?? 0.9)
    const fields = Object.entries(run.verify)
    if (!run.model?.verifyModel) out.push({ id: '④', label: `抽样核验一致率 ≥ ${thr}`, pass: true, skipped: true, detail: '未配置核验模型，跳过' })
    else {
      const weak = fields.filter(([, v]) => v.n >= 5 && v.agree / v.n < thr).map(([k, v]) => `${k} ${((v.agree / v.n) * 100).toFixed(0)}%`)
      const n = fields.reduce((s, [, v]) => s + v.n, 0); const a = fields.reduce((s, [, v]) => s + v.agree, 0)
      out.push({ id: '④', label: `抽样核验一致率 ≥ ${thr}`, pass: weak.length === 0, detail: `抽样 ${n} 次，总体一致 ${n ? ((a / n) * 100).toFixed(1) : '—'}%${weak.length ? `；未达标字段：${weak.join('、')}` : ''}`, weak })
    }
    void tpl
    return out
  }

  function callSummary(records, runId) {
    try { return { byModel: records.callStats(runId), errors: records.callErrors(runId, 20) } } catch { return null }
  }

  async function writeXlsx(dir, tpl, run) {
    const XLSX = await import('../vendor/xlsx.mjs')
    const wb = XLSX.utils.book_new()
    const readCsv = async (f) => { try { return (await readFile(join(dir, f), 'utf8')).replace(/^\uFEFF/, '') } catch { return null } }
    const { parseCsv } = await import('./util.js')
    const header = new Map(tpl.fields.map((f) => [f.id, `${f.id} ${f.name}`]))
    for (const [file, sheet] of [['wide_patient.csv', '病人'], ['wide_encounter.csv', '就诊'], ['wide_document.csv', '文书'], ['timepoints.csv', '时间点'], ['conflicts.csv', '冲突']]) {
      const text = await readCsv(file); if (text == null) continue
      const rows = parseCsv(text)
      if (rows.length) rows[0] = rows[0].map((h) => header.get(h) ?? h)
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet)
    }
    const ev = [['字段', '名称', '值', '断言', '引语', '栏目', '文书类型', '写成时间', '病人', '就诊', '方法', '标记', '文书', '起', '止']]
    for await (const v of readParts(join(dir, 'evidence'))) {
      ev.push([v.field, tpl.byId.get(v.field)?.name ?? '', v.value, v.assertion, v.quote, v.section ?? '', v.recordType, v.written ?? '', v.patient, v.encounter ?? '', v.method, (v.flags ?? []).join('、'), v.doc, v.s, v.e])
      if (ev.length > 200000) break
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ev), '证据')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['字段', '名称', '优先级', '粒度', '值', '格子', '已填', '抽样一致率'], ...fieldRows(run, tpl).map((r) => [r.id, r.name, r.priority, r.granularity, r.values, r.rows, r.filled, r.agreement == null ? '' : Math.round(r.agreement * 1000) / 10])]), '字段')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    await writeFile(join(dir, 'result.xlsx'), buf)
  }

  /* ----------------------------------------------------------- queries */

  async function status(runId) { return { run: strip(await getRun(runId)), active: active?.run.id ?? null } }
  const strip = (r) => (r ? { ...r, templateRaw: undefined } : null)
  async function list() { return { runs: (await allRuns()).map((r) => ({ id: r.id, status: r.status, startedAt: r.startedAt, input: r.inputName, outputRoot: r.outputRoot, template: r.template?.id, documents: r.totals?.documents ?? 0, values: r.totals?.values ?? 0, review: r.totals?.review ?? 0, patients: r.totals?.patients ?? 0 })), active: active?.run.id ?? null } }
  async function report(runId) {
    const run = await getRun(runId)
    if (!run) throw new Error('还没有批次')
    const path = join(run.outputRoot, RECORDS, 'runs', run.id, 'report.md')
    let markdown
    try { markdown = await readFile(path, 'utf8') } catch { markdown = renderReport(run, compileTemplate(run.templateRaw, { priorities: run.priorities })) }
    return { markdown, path }
  }
  function cancel(runId) {
    if (!active) return { cancelled: false, reason: '没有正在运行的批次' }
    if (runId && runId !== active.run.id) return { cancelled: false, reason: `正在运行的是 ${active.run.id}` }
    active.cancelled = true
    for (const w of active.workers) w.postMessage({ type: 'cancel' })
    return { cancelled: true, runId: active.run.id }
  }

  /** Review queue: verification disagreements (from shard review parts) + conflicts. Paged. */
  async function reviewQueue(runId, { offset = 0, limit = 50, field = null } = {}) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const records = await recordsOf(run.outputRoot)
    const dec = records.decisions()
    const items = []; let total = 0
    for await (const r of readParts(join(run.outputRoot, RECORDS, 'runs', run.id, 'work', 'review'))) {
      if (field && r.field !== field) continue
      if (total >= offset && items.length < limit) items.push({ ...r, decision: dec.get(`review\u0000${r.id}`) ?? null, fieldName: run.templateRaw.fields.find((f) => f.id === r.field)?.name })
      total++
    }
    return { items, total, offset }
  }
  /**
   * 人工裁定。value / cell：confirm、reject、correct（带 value）、clear。
   * review（抽样核验分歧）：confirm 维持最终结果；useVerify 按核验模型改判（落到该字段的格子）；reject 驳回最终值；clear 撤销。
   * 裁定按稳定编号存在记录库，下次运行（或重跑）汇总时生效。
   */
  async function decide(runId, { kind, target, decision, value = null, note = null }) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    if (!['value', 'cell', 'review'].includes(kind)) throw new Error('kind 应为 value、cell 或 review')
    const records = await recordsOf(run.outputRoot)
    const put = (k, t, d, v = null) => records.decide({ kind: k, target: t, decision: d, value: v, note, by: 'user', runId: run.id })
    if (kind !== 'review') {
      if (!['confirm', 'reject', 'correct', 'clear'].includes(decision)) throw new Error('decision 应为 confirm、reject、correct 或 clear')
      put(kind, target, decision, value)
      return { ok: true }
    }
    if (!['confirm', 'useVerify', 'reject', 'clear'].includes(decision)) throw new Error('decision 应为 confirm、useVerify、reject 或 clear')
    let item = null
    for await (const r of readParts(join(run.outputRoot, RECORDS, 'runs', run.id, 'work', 'review'))) if (r.id === target) { item = r; break }
    if (!item) throw new Error('找不到这条复核项')
    const field = run.templateRaw.fields.find((f) => f.id === item.field)
    const level = field?.granularity ?? 'encounter'
    const cell = level === 'timepoint' ? null : cellId(level, cellKey(level, item), item.field)
    const prev = records.decisions().get(`review\u0000${target}`)
    // 先撤销这条复核项以前落下的裁定
    if (prev) {
      for (const v of item.finalValues) put('value', v.id, 'clear')
      if (cell && prev.value?.cell) put('cell', cell, 'clear')
    }
    if (decision === 'clear') { put('review', target, 'clear'); return { ok: true } }
    if (decision === 'confirm') for (const v of item.finalValues) put('value', v.id, 'confirm')
    if (decision === 'reject') for (const v of item.finalValues) put('value', v.id, 'reject')
    if (decision === 'useVerify') {
      if (cell) put('cell', cell, 'correct', item.verify === '未提及' ? (field.type === 'presence' ? '未提及' : '') : item.verify)
      else for (const v of item.finalValues) put('value', v.id, 'reject')
    }
    put('review', target, decision, { cell: decision === 'useVerify' ? cell : null })
    return { ok: true, cell }
  }
  /** Rows of a delivered CSV (paged), for the wide-table page. */
  async function table(runId, { name = 'wide_patient', offset = 0, limit = 100, q = '' } = {}) {
    const run = await getRun(runId)
    if (!run?.output) throw new Error('该批次还没有交付')
    const { parseCsv } = await import('./util.js')
    const text = (await readFile(join(run.output, `${name}.csv`), 'utf8')).replace(/^\uFEFF/, '')
    const rows = parseCsv(text)
    const header = rows.shift() ?? []
    const filtered = q ? rows.filter((r) => r.some((c) => c.includes(q))) : rows
    return { header, rows: filtered.slice(offset, offset + limit), total: filtered.length, offset }
  }
  /** Evidence for one patient (and optional field / encounter). Streams the evidence parts. */
  async function evidence(runId, { patient, field = null, encounter, limit = 500 } = {}) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const dir = run.output ? join(run.output, 'evidence') : join(run.outputRoot, RECORDS, 'runs', run.id, 'work', 'evidence')
    const out = []
    for await (const v of readParts(dir)) {
      if (patient && v.patient !== patient) continue
      if (field && v.field !== field) continue
      if (encounter !== undefined && (v.encounter ?? '') !== (encounter ?? '')) continue
      out.push(v)
      if (out.length >= limit) break
    }
    return { values: out }
  }
  /** The source document text (re-read from the input; only for display). */
  async function document(runId, { patient, doc }) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const plan = JSON.parse(await readFile(join(run.outputRoot, RECORDS, 'runs', run.id, 'work', 'plan.json'), 'utf8'))
    const { readUnitDocs } = await import('./source/index.js')
    for (const units of plan.shards) for (const u of units) {
      if (u.kind === 'patient' && patient && !(relative(plan.inputDir, u.dir) === patient || basename(u.dir) === patient || (plan.inputDir === u.dir))) continue
      const { documents } = await readUnitDocs(u, plan)
      const d = documents.find((x) => x.id === doc)
      if (d) return { document: d }
    }
    throw new Error('找不到这份文书')
  }

  async function templates() { return { templates: await listTemplates(stateDir) } }
  async function template(id) { const t = await loadTemplate(id, stateDir); return { template: t, problems: validateTemplate(t) } }
  async function saveTemplate(t) {
    if (!stateDir) throw new Error('没有插件数据目录，不能保存模板')
    const problems = validateTemplate(t)
    if (problems.length) return { saved: false, problems }
    const dir = join(stateDir, 'templates')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `${t.id}.json`), JSON.stringify(t, null, 2))
    return { saved: true, problems: [] }
  }
  /** Excel：导出（base64），空白模板用 blank */
  async function templateXlsx({ id, blank = false } = {}) {
    const t = blank ? null : await loadTemplate(id, stateDir)
    const buf = templateToXlsx(t ?? {}, { blank })
    return { name: blank ? '抽取模板（空白）.xlsx' : `抽取模板-${t.id}-v${t.version}.xlsx`, base64: Buffer.from(buf).toString('base64') }
  }
  /**
   * Excel 导入：解析 → 校验 → 不通过返回问题清单；通过且 save 时存进我的模板库。
   * 来源二选一：base64（页面上传）或 path（Agent 给本机文件路径）。
   */
  async function importTemplateXlsx({ base64, path, save = true } = {}) {
    let buf
    if (path) buf = await readFile(isAbsolute(path) ? path : resolve(defaultDirectory, path))
    else if (base64) buf = Buffer.from(base64, 'base64')
    else throw new Error('缺少文件')
    const { template, problems } = xlsxToTemplate(buf)
    if (!template) return { saved: false, problems, template: null }
    const all = [...problems, ...validateTemplate(template)]
    const blocking = all.filter((p) => !/已忽略/.test(p))
    if (blocking.length || !save) return { saved: false, problems: all, template }
    const r = await saveTemplate(template)
    return { ...r, problems: [...all, ...r.problems], template: { id: template.id, name: template.name, version: template.version, fields: template.fields.length } }
  }
  /* ------------------------------------------------------------ 格式 */

  /** 某批次的格式识别结果（叠加格式库里的最新裁定）。 */
  async function formats(runId) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const tables = []
    for (const t of run.format?.tables ?? []) {
      const e = await library.get(t.signature)
      tables.push(e ? { ...t, status: e.status, recordType: e.spec?.recordType ?? null, spec: e.spec, drafts: e.drafts ?? {}, fields: e.fields ?? [], decidedBy: e.decidedBy ?? null, reason: e.reason ?? t.reason, problems: e.problems ?? [], diffs: e.diffs ?? [] } : t)
    }
    // 批次之后有人工裁定（或状态变了）：提示按确认结果重跑
    const changed = tables.some((t, i) => t.status !== run.format.tables[i].status || (t.decidedBy === 'user' && run.format.tables[i].decidedBy !== 'user'))
    return { tables, dict: run.format?.dict ?? 0, heldPolicy: run.format?.heldPolicy ?? settings.heldTables, changed, recordTypes: RECORD_TYPES }
  }
  /**
   * 裁定一张表：confirm（采用当前规格，可带改过的 spec）／reject（跳过这张表）／reset（清掉，下次重新识别）。
   * 改过的规格先按画像里的字段校验。
   */
  async function formatDecide({ signature, action, spec = null, use = null }) {
    const e = await library.get(signature)
    if (!e) throw new Error('格式库里没有这张表')
    if (use) { if (!e.drafts?.[use]) throw new Error(`没有「${use}」草稿`); spec = e.drafts[use] }
    if (action === 'reset') { await library.remove(signature); return { ok: true } }
    if (action === 'reject') { await library.put({ ...e, status: 'rejected', decidedBy: 'user', decidedAt: new Date().toISOString() }); return { ok: true } }
    if (action !== 'confirm') throw new Error('action 应为 confirm、reject 或 reset')
    let next = e.spec
    if (spec) {
      const t = { fields: e.fields }
      ;[next] = fixSpec(normalizeSpec(spec, 'user'), t)
      const problems = checkSpec(next, t)
      if (problems.length) return { ok: false, problems }
    }
    await library.put({ ...e, spec: { ...next, origin: spec ? 'user' : next.origin }, status: 'confirmed', decidedBy: 'user', decidedAt: new Date().toISOString(), problems: [] })
    return { ok: true }
  }

  async function calls(runId) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const records = await recordsOf(run.outputRoot)
    return { byModel: records.callStats(run.id), errors: records.callErrors(run.id, 100) }
  }
  function configInfo() {
    return { template: settings.template, mode: settings.extractMode, modelConfigured: Boolean(modelInfo()), model: settings.model, verifyModel: settings.verifyModel, baseURL: settings.baseURL, verifyBaseURL: settings.verifyBaseURL, workers: settings.workers, modelConcurrency: settings.modelConcurrency, outputRoot: settings.outputRoot, settings: Object.fromEntries(SAVABLE.filter((k) => k !== 'apiKey').map((k) => [k, settings[k]])) }
  }

  async function dispose() {
    if (active) cancel()
    for (const p of stores.values()) { try { (await p).close() } catch { /* closed */ } }
    stores.clear()
  }

  return { start, cancel, status, list, report, reviewQueue, decide, table, evidence, document, templates, template, saveTemplate, templateXlsx, importTemplateXlsx, formats, formatDecide, calls, configInfo, dispose, isRunning: () => Boolean(active), settings }
}

let VERSION_CACHE = null
function VERSION() {
  if (VERSION_CACHE) return VERSION_CACHE
  try { VERSION_CACHE = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version } catch { VERSION_CACHE = '0.0.0' }
  return VERSION_CACHE
}
