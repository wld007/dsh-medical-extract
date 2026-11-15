/**
 * 批次服务：规划 → 数据块（工作线程并行，断点续跑）→ 汇总 → 质检 → 交付 → 报告。
 * Agent 工具、/extract 命令、页面 RPC 共用这一个服务；同时只跑一个批次。
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { getHeapStatistics } from 'node:v8'
import { cp, mkdir, readFile, readdir, realpath, rename, rm, stat, statfs, writeFile } from 'node:fs/promises'
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
import { GATE_BYTES, processShard, partName, readGate } from './engine/shard.js'
import { addPerf, LAT_BINS, newPerf } from './engine/model.js'
import { createServerProbe, createTuner, gated, gateLimiter, modelSlots, setLimit } from './engine/gate.js'
import { rollup, readParts, cellId, cellKey, headers } from './engine/rollup.js'
import { renderReport, fieldRows } from './report.js'
import { csvLine } from './util.js'
import { listModels } from './llm.js'

export const RECORDS = '_records'
/** 交付数据放在输出根目录的 output 里，和 _records 分开（同匿名化插件）；下游只读 output */
export const DELIVERED = 'output'
/** 批次运行中的结果：_records/runs/<批次>/staging；取消或失败时留在这里，不进 output */
export const STAGING = 'staging'
export const DEFAULTS = {
  outputRoot: '',
  template: 'mdd',
  extractMode: 'hybrid',
  priorities: [],
  mapping: {},
  baseURL: '',
  model: '',
  apiKey: '',
  verifyBaseURL: '',
  verifyModel: '',
  disableThinking: true,
  timeoutMs: 120000,
  modelConcurrency: 8,
  // 核验模型自己的并发上限（和提取模型同端点、同模型时共用 modelConcurrency）
  verifyConcurrency: 8,
  // 复查轮次上限（1–6）：核验分歧两个模型轮流复查，至多这么多轮，仍不一致转人工
  maxRounds: 3,
  // 自动调并发：上面两个并发只是起始值，每 30 秒按各模型的吞吐自动加减（最多 64）
  autoConcurrency: true,
  workers: 0,
  shardUnits: 20,
  // 提取：模型通读每份文书（分配成任务：每段不超过 readMaxChars 字、每组不超过 readMaxFields 个字段）
  readMaxChars: 6000,
  readMaxFields: 30,
  // 成本开关：一份文书里一个模板关键词都没出现，整份跳过（默认关：关键词漏掉的写法模型也就看不到）
  skipNoKeyword: false,
  verifySampleRate: 0.02,
  verifyMinPerField: 2,
  verifyThreshold: 0.9,
  xlsxMaxRows: 200000,
  // 格式识别（通用文件）：按表识别类别、写成时间、病人、就诊、栏目；数据元对照表（编码→中文名，csv/xlsx/json）
  formatRecognition: true,
  elementDict: '',
  // 借用病历事件还原插件格式库里已采用的识别结果（只读）
  borrowFormats: true,
  // 识别还没定（分歧、校验不过、只有规则的方案）的表：generic＝先按通用读法读；skip＝跳过，等确认
  heldTables: 'generic',
  showSidebarEntry: true,
}
export const SAVABLE = Object.keys(DEFAULTS)
export const NO_MODEL = '没有配置提取模型：本插件只用模型从文书里提取。请到「设置 → 病历文书提取」填写模型端点（baseURL）和模型名称（model）后再开始'

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
  let applying = null // 正在更新宽表（重新汇总）的批次
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
    const on = Boolean(settings.baseURL && settings.model)
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
    if (applying) throw Object.assign(new Error(`正在应用批次 ${applying} 的判断；稍等再开新批次`), { code: 'busy' })
    let prev = null
    if (opts.resumeFrom) {
      prev = await getRun(opts.resumeFrom)
      if (!prev) throw new Error(`找不到批次 ${opts.resumeFrom}`)
      if (!['cancelled', 'failed'].includes(prev.status)) throw new Error(`批次 ${prev.id} 状态为 ${prev.status}，只有已取消或失败的批次可以继续`)
    }
    // 本插件只用模型从文书里提取：没配提取模型不能开始
    if (!modelInfo()) throw Object.assign(new Error(NO_MODEL), { code: 'no-model' })
    if (prev && prev.flow !== 'read') throw new Error(`批次 ${prev.id} 用的是已停用的提取方式（${prev.flow === 'rules' ? '仅规则' : '关键词定位后送片段'}），不能继续；请重新开始一个批次`)
    const paths = prev ? { input: prev.input, outputRoot: prev.outputRoot, inputName: prev.inputName } : await resolvePaths(opts)
    const rawTemplate = prev ? prev.templateRaw : await loadTemplate(opts.template ?? settings.template, stateDir)
    const problems = validateTemplate(rawTemplate)
    if (problems.length) throw Object.assign(new Error(`模板校验未通过：\n- ${problems.join('\n- ')}`), { code: 'template-invalid' })
    const priorities = prev ? prev.priorities : [].concat(opts.priorities ?? settings.priorities ?? []).filter(Boolean)
    const tpl = compileTemplate(rawTemplate, { priorities })
    if (opts.mode === 'rules') throw new Error('仅规则模式已停用：本插件只用模型从文书里提取。mode 应为 hybrid 或 model')
    // 设置里存过 rules（旧版本）的按默认 hybrid
    const mode = prev ? prev.mode : opts.mode ?? (settings.extractMode === 'model' ? 'model' : 'hybrid')
    if (!['hybrid', 'model'].includes(mode)) throw new Error('mode 应为 hybrid（模型通读＋规则对照）或 model（模型通读）')
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
      flow: 'read', maxRounds: prev ? prev.maxRounds ?? 3 : Math.max(1, Math.min(6, Number(opts.maxRounds ?? settings.maxRounds) || 3)),
      plan: null, shards: { total: 0, done: 0, running: 0 },
      totals: { documents: 0, structured: 0, hollow: 0, decoded: 0, garbled: 0, media: 0, mediaKinds: {}, noKeyword: 0, tasks: 0, assigned: 0, votes: 0, ruleDisputes: 0, skipped: 0, values: 0, recalled: 0, calls: 0, cached: 0, failed: 0, quoteFail: 0, invalid: 0, outOfRange: 0, agree: 0, disagree: 0, review: 0, conflicts: 0, patients: 0, encounters: 0, byMethod: {} },
      byField: {}, verify: {}, problems: [], gates: [], warnings: [], output: null, error: null, current: { stage: 'E1', step: '规划输入' }, rate: null,
    }
    if (run.model && !run.model.verifyModel) run.warnings.push('未配置核验模型：不做抽样核验，质检④跳过')
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
    /**
     * 资源与进度采样（同匿名化插件）：堆内存（主线程）、进程常驻（含工作线程）、输出盘剩余空间（每 10 秒），
     * 以及已处理文书数的时间序列（画速率曲线；超过 240 点时隔点抽稀）。
     */
    const t00 = Date.now()
    // 模型闸门：两个模型各自的并发上限与计数（工作线程与主线程共用），见 engine/gate.js
    const slots = modelSlots(settings, chatImpl)
    job.modelGate = new SharedArrayBuffer(GATE_BYTES)
    run.modelHouses = slots.slots.map(({ slot, max, model, host, roles }) => ({ slot, max, model, host, roles }))
    run.modelConcurrency = slots.extract.max
    for (const x of slots.slots) setLimit(job.modelGate, x.slot, x.max)
    // 推理服务器负载（vLLM /metrics，只读）：每 5 秒读一次，给页面和自动调并发看
    run.server = {}
    const probes = slots.slots.filter((x) => x.base).map((x) => createServerProbe(run.server[x.slot] = {}, x.base, x.model))
    let probeAt = 0
    // 自动调并发（同匿名化插件）：设置里的并发只是起始值，每 30 秒按各模型的吞吐调一次
    run.autoConcurrency = settings.autoConcurrency !== false
    run.autoTune = {}
    const tuners = !run.autoConcurrency ? [] : slots.slots.map((x) => {
      const state = run.autoTune[x.slot] = { start: x.max, limit: x.max, ceiling: null, history: [] }
      return createTuner({
        state, windowMs: Number(settings.autoTuneMs) || 30000, server: () => run.server[x.slot],
        set: (v) => setLimit(job.modelGate, x.slot, v),
        read: () => { const g = readGate(job.modelGate); return { active: g.inflight[x.slot], queued: g.waiting[x.slot], limit: g.limits[x.slot], done: g.done[x.slot], tokens: g.tokens[x.slot], failed: g.failed[x.slot] } },
      })
    })
    /** 记一个进度点（相隔不到 0.4 秒的跳过，强制的除外） */
    const mark = (force = false) => {
      const ms = Date.now() - t00
      const series = run.series ??= []
      const last = series[series.length - 1]
      if (!force && last && ms - last[0] < 400) return
      // [毫秒, 累计文书, 槽0在途, 槽1在途, 槽0排队, 槽1排队, 槽0完成调用, 槽1完成调用, 槽0 token, 槽1 token,
      //  槽0 按工序在途（格式识别、提取、核验、复查）, 槽1 按工序在途, 槽0 失败调用, 槽1 失败调用,
      //  槽0 上限, 槽1 上限, 服务器0 在跑/排队/KV%, 服务器1 在跑/排队/KV%（读不到为 -1）]   槽＝模型服务，见 engine/gate.js
      const g = readGate(job.modelGate)
      const sv = (i) => { const e = run.server?.[i]; return e?.available && e.at && Date.now() - e.at < 15000 ? [e.running ?? 0, e.waiting ?? 0, Math.round((e.kv ?? 0) * 100)] : [-1, -1, -1] }
      series.push([ms, run.liveDocs ?? 0, ...g.inflight, ...g.waiting, ...g.done, ...g.tokens, ...g.byStation[0], ...g.byStation[1], ...g.failed, ...g.limits, ...sv(0), ...sv(1)])
      if (series.length > 240) run.series = series.filter((_, i) => i % 2 === 0 || i === series.length - 1)
    }
    const sample = () => {
      const u = process.memoryUsage()
      const m = run.memory ?? { peakHeap: 0, peakRss: 0 }
      Object.assign(m, { heapUsed: u.heapUsed, rss: u.rss, heapLimit: getHeapStatistics().heap_size_limit, peakHeap: Math.max(m.peakHeap, u.heapUsed), peakRss: Math.max(m.peakRss, u.rss) })
      run.memory = m
      if (Date.now() - probeAt >= 5000) { probeAt = Date.now(); for (const p of probes) p().catch(() => {}) }
      for (const tk of tuners) tk()
      mark(true)
      if (!(Date.now() - (sample.diskAt ?? 0) < 10000)) {
        sample.diskAt = Date.now()
        ;(async () => {
          for (const dir of [run.outputRoot, dirname(run.outputRoot)]) {
            try { const f = await statfs(dir); const free = Number(f.bavail) * Number(f.bsize); const total = Number(f.blocks) * Number(f.bsize); const d = run.disk ??= { minFree: free }; Object.assign(d, { free, total, minFree: Math.min(d.minFree ?? free, free) }); return } catch { /* 目录还没建：试上一级 */ }
          }
        })().catch(() => {})
      }
    }
    const save = () => { if (run.status === 'running') sample(); run.updatedAt = new Date().toISOString(); records.putRun(run) }
    let saveTimer = null
    try {
      await mkdir(workDir, { recursive: true })
      saveTimer = setInterval(save, 2000)
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
            files, root: p.inputDir, library, siblings: siblings(), settings: { ...settings, modelEnabled: true, maxRounds: run.maxRounds }, chatImpl: chatImpl ? { extract: chatImpl.extract, verify: chatImpl.verify } : null,
            cache: records, dict, onCall: (e) => { records.logCall(run.id, { at: new Date().toISOString(), ...e }); callPerf(run, e) },
            wrap: (role, llm) => gated(llm, gateLimiter(job.modelGate, { ...(role === 'verify' ? slots.verify ?? slots.extract : slots.extract), station: 'format' })),
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
      run.current = { stage: 'E3', step: '提取' }
      save()

      // shards
      const todo = plan.shards.map((units, shard) => ({ shard, units })).filter((s) => !doneShards.has(s.shard))
      const autoWorkers = Math.max(1, Math.min(8, availableParallelism() - 1))
      const nWorkers = chatImpl ? 1 : Math.max(1, Math.min(todo.length, Number(settings.workers) || autoWorkers))
      // 模型并发是全局的：各工作线程共用一个计数（SharedArrayBuffer），哪个数据块大就多用，不再按线程平分（大文件数据块会被卡成串行）
      const modelWidth = slots.extract.max
      const task = (s) => ({
        kind: 'shard', id: s.shard, runId: run.id, shard: s.shard, units: s.units, plan: { kind: plan.kind, inputDir: plan.inputDir, mappings: plan.mappings, byFolder: plan.byFolder, specs: plan.specs, ignored: plan.ignored },
        template: run.templateRaw, priorities: run.priorities, settings: { ...settings, maxRounds: run.maxRounds }, workDir, asOf: run.asOf, mode: run.mode, modelWidth,
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
        mark()
      }
      const inline = chatImpl || Number(settings.workers) === 1 || (nWorkers === 1 && todo.length <= 2)
      if (inline) {
        for (const s of todo) {
          if (job.cancelled) break
          run.shards.running = 1
          const result = await processShard(task(s), { store: records, chatImpl, modelGate: job.modelGate, isCancelled: () => job.cancelled, onProgress: progress })
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
      if (!run.totals.documents && run.totals.structured) run.warnings.push(`输入里只有结构化记录（${run.totals.structured} 条，如检验、医嘱、收费），没有文书：本插件只从文书里提取，结构化数据请用 HL7 标准化等插件处理`)
      run.current = { stage: 'E5', step: '汇总·计算' }
      save()
      const decisions = records.decisions()
      const stagingDir = join(runDir, STAGING, run.inputName)
      await rm(join(runDir, STAGING), { recursive: true, force: true })
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
      run.current = { stage: 'E6', step: '质检' }
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
      // 交付：<输出根目录>/output/<输入名>。同一输入重跑时以最新结果替换（每次的报告和记录仍在 _records 里）
      const deliveredRoot = join(run.outputRoot, DELIVERED)
      const target = join(deliveredRoot, run.inputName)
      await rm(target, { recursive: true, force: true })
      await mkdir(deliveredRoot, { recursive: true })
      await rename(stagingDir, target)
      await rm(join(runDir, STAGING), { recursive: true, force: true })
      run.output = target
      // 转人工的项按稳定编号沿用以前的判断：都判断过了（重跑）就不再待复核
      let left = run.totals.review
      if (left > 0 && decisions.size) {
        left = 0; let decided = 0
        for await (const r of readParts(join(workDir, 'review'))) { if (r.resolved) continue; if (decisions.has(`review\u0000${r.id}`)) decided++; else left++ }
        run.humanReview = { appliedAt: new Date().toISOString(), todo: left, decided, dirty: false, carried: true }
      }
      run.status = left > 0 ? 'review' : 'completed'
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
      const w = new Worker(new URL('./engine/worker.js', import.meta.url), { workerData: { recordsDir, modelGate: job.modelGate ?? null } })
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
          failure ??= new Error(`${current.t.kind === 'shard' ? `数据块 ${current.t.shard}` : current.t.kind} 失败：${m.error}`)
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

  /** 格式识别的一次调用记进模型表现（role：format＝提取模型、format-verify＝核验模型） */
  function callPerf(run, e) {
    run.models ??= {}
    const x = (run.models[e.role] ??= { model: e.model, ...newPerf() })
    if (e.cached) { x.cached++; return }
    x.calls++
    if (!e.ok) { x.failed++; return }
    const pt = e.usage?.prompt_tokens ?? 0; const ct = e.usage?.completion_tokens ?? 0
    x.ms += e.ms ?? 0; x.pt += pt; x.ct += ct; x.ptMax = Math.max(x.ptMax, pt)
    const sec = (e.ms ?? 0) / 1000; const i = LAT_BINS.findIndex((b) => sec < b)
    x.hist[i === -1 ? LAT_BINS.length : i]++
  }

  function mergeStats(run, s) {
    if (!s) return
    const T = run.totals
    for (const k of ['values', 'recalled', 'calls', 'cached', 'failed', 'quoteFail', 'invalid', 'outOfRange', 'agree', 'disagree', 'review', 'skipped', 'structured', 'hollow', 'hollowChars', 'freeChars', 'decoded', 'garbled', 'media', 'noKeyword', 'tasks', 'assigned', 'votes', 'ruleDisputes', 'ruleResolved', 'adjResolved', 'adjCalls']) T[k] = (T[k] ?? 0) + (s[k] ?? 0)
    T.documents += s.docs ?? 0
    for (const [k, v] of Object.entries(s.byMethod ?? {})) T.byMethod[k] = (T.byMethod[k] ?? 0) + v
    for (const [k, v] of Object.entries(s.mediaKinds ?? {})) { T.mediaKinds ??= {}; T.mediaKinds[k] = (T.mediaKinds[k] ?? 0) + v }
    // 分派明细（文书类型可能很多：超过 200 种时其余并入「其他」）
    for (const [k, v] of Object.entries(s.dispatch ?? {})) {
      run.dispatch ??= {}
      const key = run.dispatch[k] || Object.keys(run.dispatch).length < 200 ? k : '其他'
      const d = (run.dispatch[key] ??= { docs: 0, tasks: 0, fields: 0, split: 0, none: 0 })
      for (const x of ['docs', 'tasks', 'fields', 'split', 'none']) d[x] += v[x] ?? 0
    }
    for (const [k, v] of Object.entries(s.fieldDocs ?? {})) { run.fieldDocs ??= {}; run.fieldDocs[k] = (run.fieldDocs[k] ?? 0) + v }
    for (const [role, p] of Object.entries(s.models ?? {})) { run.models ??= {}; const x = (run.models[role] ??= { model: p.model }); x.model = p.model; addPerf(x, p) }
    for (const [k, v] of Object.entries(s.byField ?? {})) { const b = (run.byField[k] ??= { values: 0, docs: 0 }); b.values += v.values; b.docs += v.docs }
    for (const [k, v] of Object.entries(s.verify ?? {})) { const b = (run.verify[k] ??= { n: 0, agree: 0 }); for (const x of ['n', 'agree', 'adj', 'resolved', 'changed']) b[x] = (b[x] ?? 0) + (v[x] ?? 0) }
    if (s.adjByRound) T.adjByRound = (T.adjByRound ?? [0, 0, 0, 0, 0, 0]).map((x, i) => x + (s.adjByRound[i] ?? 0))
    for (const p of s.problems ?? []) if (run.problems.length < 50) run.problems.push(p)
  }

  function gates(run, tpl) {
    const T = run.totals
    const modelVals = (T.byMethod.model ?? 0) + (T.byMethod['model+rule'] ?? 0)
    const answered = modelVals + T.quoteFail
    const out = []
    out.push({ id: '①', label: '原文引用与原文逐字一致', pass: true, detail: answered ? `模型回答中 ${T.quoteFail} 条原文引用对不上原文，已丢弃（${((T.quoteFail / answered) * 100).toFixed(2)}%）；交付的值全部逐字一致` : '交付的值全部逐字一致', quoteFail: T.quoteFail })
    // 不合类型、选项的值已丢弃；超出值域的照常交付并标出，占比超过 1% 才算不过（多半是规则把别的数字当成了值）
    const oorRate = T.values ? T.outOfRange / T.values : 0
    out.push({ id: '②', label: '值在类型、选项、值域之内', pass: oorRate <= 0.01, detail: `不合类型或选项被丢弃 ${T.invalid} 条；超出值域 ${T.outOfRange} 条（${(oorRate * 100).toFixed(2)}%，已交付并标"超出值域"）`, invalid: T.invalid, outOfRange: T.outOfRange })
    out.push({ id: '③', label: '每个单元格可回溯到值、每个值可回溯到原文', pass: true, detail: `宽表单元格带 __n 证据数；证据长表每行带文书编号与起止位置；冲突 ${T.conflicts} 个另列` })
    const thr = Number(settings.verifyThreshold ?? 0.9)
    const fields = Object.entries(run.verify)
    if (!run.model?.verifyModel) out.push({ id: '④', label: `抽样核验一致率 ≥ ${thr}`, pass: true, skipped: true, detail: '未配置核验模型，跳过' })
    else {
      const weak = fields.filter(([, v]) => v.n >= 5 && v.agree / v.n < thr).map(([k, v]) => `${k} ${((v.agree / v.n) * 100).toFixed(0)}%`)
      const n = fields.reduce((s, [, v]) => s + v.n, 0); const a = fields.reduce((s, [, v]) => s + v.agree, 0)
      // 一致率按复查前算：衡量提取模型第一遍有多可靠（没被抽到的文书只有第一遍的结果）
      const adj = fields.reduce((s, [, v]) => s + (v.adj ?? 0), 0); const res = fields.reduce((s, [, v]) => s + (v.resolved ?? 0), 0)
      // 需要改字段定义：复查前一致率不达标的字段。复查只修好了被抽到的那几份，没被抽到的只有第一遍的结果
      run.needsDefinition = fields.filter(([, v]) => v.n >= 5 && v.agree / v.n < thr).map(([k, v]) => ({ field: k, n: v.n, agree: v.agree, adj: v.adj ?? 0, resolved: v.resolved ?? 0, changed: v.changed ?? 0,
        why: (v.adj ?? 0) && (v.changed ?? 0) / v.adj >= 0.5 ? `提取模型第一遍常出错（复查中改口 ${v.changed}/${v.adj}）` : '两个模型对这个字段的理解不一致' })).sort((x, y) => x.agree / x.n - y.agree / y.n)
      out.push({ id: '④', label: `抽样核验一致率 ≥ ${thr}（复查前）`, pass: weak.length === 0, detail: `抽样 ${n} 次，复查前总体一致 ${n ? ((a / n) * 100).toFixed(1) : '—'}%${weak.length ? `；未达标字段：${weak.join('、')}` : ''}${adj ? `；分歧 ${adj} 项，复查后自动一致 ${res}，转人工 ${adj - res}` : ''}`, weak })
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
    const ev = [['字段', '名称', '值', '提及方式', '原文引用', '栏目', '文书类型', '写成时间', '病人', '就诊', '方法', '标记', '文书', '起', '止']]
    for await (const v of readParts(join(dir, 'evidence'))) {
      ev.push([v.field, tpl.byId.get(v.field)?.name ?? '', v.value, v.assertion, v.quote, v.section ?? '', v.recordType, v.written ?? '', v.patient, v.encounter ?? '', v.method, (v.flags ?? []).join('、'), v.doc, v.s, v.e])
      if (ev.length > 200000) break
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ev), '证据')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['字段', '名称', '优先级', '汇总层级', '值', '单元格', '已填', '抽样一致率'], ...fieldRows(run, tpl).map((r) => [r.id, r.name, r.priority, r.granularity, r.values, r.rows, r.filled, r.agreement == null ? '' : Math.round(r.agreement * 1000) / 10])]), '字段')
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

  /* --------------------------------------------------------------- 复核 */
  /**
   * 复核项按「类别 × 字段 × 两边说法」分组：同一个字段、两边说法一样（如 最终「未提及」⇄ 规则匹配「医嘱离院」）的，
   * 多半是同一个原因（规则写宽了、字段定义含糊），一组可以一次判断（同匿名化插件「这个字段的 n 项都这样处理」）。
   * status：open＝转人工的（含已判断，默认）、todo＝转人工且还没判断、decided＝已判断、resolved＝复查后一致（供抽查）、all
   * 复核单逐行流式读，不整批载入；分组的两边说法每个字段最多记 500 种，其余只计数。
   */
  const reviewDirOf = (run) => join(run.outputRoot, RECORDS, 'runs', run.id, 'work', 'review')
  const patternOf = (r) => `${r.final}\u0000${r.verify}`
  const decidedOf = (dec, r) => dec.get(`review\u0000${r.id}`) ?? null
  const inStatus = (status, r, d) => (status === 'all' ? true
    : status === 'resolved' ? Boolean(r.resolved)
      : status === 'decided' ? Boolean(d)
        : status === 'todo' ? !r.resolved && !d
          : !r.resolved)
  const matches = (q, r) => (!q.field || r.field === q.field) && (!q.kind || r.kind === q.kind) && (q.pattern == null || q.pattern === '' || patternOf(r) === q.pattern)
  const tally = (c, r, d) => { c.all++; if (r.resolved) c.resolved++; else { c.open++; if (!d) c.todo++ } if (d) c.decided++ }
  const newCounts = () => ({ open: 0, todo: 0, decided: 0, resolved: 0, all: 0 })
  const clip = (s, n = 160) => { const t = String(s ?? ''); return t.length > n ? `${t.slice(0, n)}…` : t }

  /** 复核单（分页）。counts 是整批的（不受字段、分组筛选影响），total 是筛选后的项数。 */
  async function reviewQueue(runId, { offset = 0, limit = 50, field = null, kind = null, pattern = null, status = 'open' } = {}) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const records = await recordsOf(run.outputRoot)
    const dec = records.decisions()
    const names = new Map(run.templateRaw.fields.map((f) => [f.id, f.name]))
    const q = { field, kind, pattern }
    const items = []; let total = 0; const counts = newCounts()
    for await (const r of readParts(reviewDirOf(run))) {
      const d = decidedOf(dec, r)
      tally(counts, r, d)
      if (!inStatus(status, r, d) || !matches(q, r)) continue
      if (total >= offset && items.length < limit) items.push({ ...r, decision: d, fieldName: names.get(r.field) })
      total++
    }
    return { items, total, offset, counts }
  }

  /** 复核单的分组：字段（分规则匹配、核验两类）→ 两边说法。dirty＝上次更新宽表之后又改过判断。 */
  async function reviewGroups(runId, { status = 'open' } = {}) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const records = await recordsOf(run.outputRoot)
    const dec = records.decisions()
    const names = new Map(run.templateRaw.fields.map((f) => [f.id, f.name]))
    const counts = newCounts()
    const groups = new Map()
    for await (const r of readParts(reviewDirOf(run))) {
      const d = decidedOf(dec, r)
      tally(counts, r, d)
      if (!inStatus(status, r, d)) continue
      const k = `${r.kind}\u0000${r.field}`
      let g = groups.get(k)
      if (!g) groups.set(k, g = { kind: r.kind, field: r.field, fieldName: names.get(r.field) ?? '', n: 0, todo: 0, decided: 0, more: 0, patterns: new Map() })
      const todo = !r.resolved && !d
      g.n++; if (todo) g.todo++; if (d) g.decided++
      const pk = patternOf(r)
      let p = g.patterns.get(pk)
      if (!p) {
        if (g.patterns.size >= 500) { g.more++; continue }
        g.patterns.set(pk, p = { pattern: pk, final: clip(r.final), verify: clip(r.verify), n: 0, todo: 0, decided: 0, tally: {} })
      }
      p.n++; if (todo) p.todo++; if (d) { p.decided++; p.tally[d.decision] = (p.tally[d.decision] ?? 0) + 1 }
    }
    const out = [...groups.values()].map((g) => {
      const ps = [...g.patterns.values()].sort((a, b) => b.todo - a.todo || b.n - a.n)
      return { ...g, patterns: ps.slice(0, 50), patternCount: ps.length, more: g.more + ps.slice(50).reduce((s, p) => s + p.n, 0) }
    }).sort((a, b) => b.todo - a.todo || b.n - a.n || String(a.field).localeCompare(String(b.field)))
    return { groups: out, counts, status, dirty: Boolean(run.humanReview?.dirty), humanReview: run.humanReview ?? null, runStatus: run.status, hasOutput: Boolean(run.output) }
  }

  /**
   * 把一条复核项的判断落到值和单元格上（先撤销它以前的判断）。
   * confirm 维持最终结果；useVerify 按另一方（核验模型或规则匹配）改用，落到该字段的单元格；reject 不采用最终结果；clear 撤销。
   * cellMerge（批量时）：同一个单元格有几条「按另一方改用」时，可多值的字段（pick all、文本、列表）把几条的值合起来，不互相覆盖。
   */
  function applyReview(run, records, dec, item, decision, { note = null, cellMerge = null } = {}) {
    const put = (k, t, d, v = null) => records.decide({ kind: k, target: t, decision: d, value: v, note, by: 'user', runId: run.id })
    const field = run.templateRaw.fields.find((f) => f.id === item.field)
    const level = field?.granularity ?? 'encounter'
    const cell = level === 'timepoint' ? null : cellId(level, cellKey(level, item), item.field)
    const prev = dec.get(`review\u0000${item.id}`)
    if (prev) {
      for (const v of item.finalValues) put('value', v.id, 'clear')
      if (cell && prev.value?.cell) put('cell', cell, 'clear')
    }
    if (decision === 'clear') { put('review', item.id, 'clear'); return cell }
    if (decision === 'confirm') for (const v of item.finalValues) put('value', v.id, 'confirm')
    if (decision === 'reject') for (const v of item.finalValues) put('value', v.id, 'reject')
    if (decision === 'useVerify') {
      if (cell) {
        let value = item.verify === '未提及' ? (field?.type === 'presence' ? '未提及' : '') : item.verify
        const multi = field && (field.pick === 'all' || field.type === 'text' || field.type === 'list')
        if (cellMerge && multi && value) {
          const seen = cellMerge.get(cell) ?? []
          for (const x of String(value).split('；')) if (x && !seen.includes(x)) seen.push(x)
          cellMerge.set(cell, seen)
          value = seen.join('；')
        }
        put('cell', cell, 'correct', value)
      } else for (const v of item.finalValues) put('value', v.id, 'reject')
    }
    put('review', item.id, decision, { cell: decision === 'useVerify' ? cell : null })
    return cell
  }
  /** 改过判断：标记交付数据要重新汇总（更新宽表后清掉） */
  function markDirty(run, records) {
    run.humanReview = { ...(run.humanReview ?? {}), dirty: true }
    records.putRun(run)
  }

  /**
   * 人工判断。value / cell：confirm、reject、correct（带 value）、clear。
   * review（复核项）：confirm、useVerify、reject、clear，见 applyReview。
   * 判断按稳定编号存在记录库；「更新宽表」（applyDecisions）立即重新汇总交付数据，重跑也沿用。
   */
  async function decide(runId, { kind, target, decision, value = null, note = null }) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    if (!['value', 'cell', 'review'].includes(kind)) throw new Error('kind 应为 value、cell 或 review')
    const records = await recordsOf(run.outputRoot)
    if (kind !== 'review') {
      if (!['confirm', 'reject', 'correct', 'clear'].includes(decision)) throw new Error('decision 应为 confirm、reject、correct 或 clear')
      records.decide({ kind, target, decision, value, note, by: 'user', runId: run.id })
      markDirty(run, records)
      return { ok: true }
    }
    if (!['confirm', 'useVerify', 'reject', 'clear'].includes(decision)) throw new Error('decision 应为 confirm、useVerify、reject 或 clear')
    let item = null
    for await (const r of readParts(reviewDirOf(run))) if (r.id === target) { item = r; break }
    if (!item) throw new Error('找不到这条复核项')
    const cell = records.transaction(() => applyReview(run, records, records.decisions(), item, decision, { note }))
    markDirty(run, records)
    return { ok: true, cell }
  }

  /**
   * 批量判断：字段（必填）＋类别＋两边说法筛出的、还没判断的转人工项，一次判断。整批一个事务。
   * 只动还没判断的项（已判断的不覆盖）。
   */
  async function decideGroup(runId, { field = null, kind = null, pattern = null, decision, note = null } = {}) {
    if (!['confirm', 'useVerify', 'reject'].includes(decision)) throw new Error('decision 应为 confirm、useVerify 或 reject')
    if (!field) throw new Error('批量判断要指定字段')
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const records = await recordsOf(run.outputRoot)
    const dec = records.decisions()
    const q = { field, kind, pattern }
    const hits = []
    for await (const r of readParts(reviewDirOf(run))) if (!r.resolved && !decidedOf(dec, r) && matches(q, r)) hits.push(r)
    if (!hits.length) return { decided: 0 }
    const cellMerge = new Map()
    records.transaction(() => { for (const it of hits) applyReview(run, records, dec, it, decision, { note, cellMerge }) })
    markDirty(run, records)
    return { decided: hits.length }
  }

  /**
   * 更新宽表：不调模型，按记录库里的全部判断把这一批重新汇总，替换交付目录里的宽表、时间点、冲突表与 result.xlsx，
   * 更新 manifest、质检与报告。转人工的项都判断了，批次从「待复核」转为「完成」（同匿名化插件）。
   */
  async function applyDecisions(runId) {
    if (active) throw new Error('有批次在运行；等它结束再更新宽表')
    if (applying) throw new Error(`正在应用批次 ${applying} 的判断`)
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    if (!run.output || !(await exists(run.output))) throw new Error('该批次没有交付目录，不能更新宽表；请重跑批次')
    const runDir = join(run.outputRoot, RECORDS, 'runs', run.id)
    const workDir = join(runDir, 'work')
    if (!(await exists(join(workDir, 'evidence')))) throw new Error('该批次的工作文件已不在，不能只重新汇总；请重跑批次')
    applying = run.id
    try {
      const tpl = compileTemplate(run.templateRaw, { priorities: run.priorities })
      const records = await recordsOf(run.outputRoot)
      const decisions = records.decisions()
      const tmpOut = join(runDir, 'reapply')
      await rm(tmpOut, { recursive: true, force: true })
      const bucketCount = Math.max(1, Math.min(4096, Math.ceil((run.totals?.values ?? 0) / 500_000)))
      const rWorkers = chatImpl ? 1 : Math.max(1, Math.min(Number(settings.workers) || Math.max(1, Math.min(8, availableParallelism() - 1)), bucketCount, 16))
      const job = { cancelled: false, workers: [], run }
      const runTasks = rWorkers === 1 ? null : (tasks) => runPool(job, tasks.map((t, i) => ({
        ...t, id: i, workDir, template: run.templateRaw, priorities: run.priorities, decisions: [...decisions],
      })), rWorkers, join(run.outputRoot, RECORDS), () => {}, () => {})
      const sum = await rollup({ tpl, workDir, outDir: tmpOut, decisions, bucketCount, runTasks })
      for (const name of Object.keys(headers(tpl))) await rename(join(tmpOut, `${name}.csv`), join(run.output, `${name}.csv`))
      await rm(tmpOut, { recursive: true, force: true })
      run.rollup = { filled: sum.filled }
      Object.assign(run.totals, { patients: sum.patients, encounters: sum.encounters, conflicts: sum.conflicts, rejected: sum.rejected })
      run.gates = gates(run, tpl)
      // 还没判断的转人工项
      const dec = records.decisions()
      let todo = 0; let decided = 0
      for await (const r of readParts(reviewDirOf(run))) { if (r.resolved) continue; if (decidedOf(dec, r)) decided++; else todo++ }
      const at = new Date().toISOString()
      run.humanReview = { appliedAt: at, todo, decided, dirty: false }
      if (run.status === 'review' && todo === 0) run.status = 'completed'
      try {
        const mf = join(run.output, 'manifest.json')
        const manifest = JSON.parse(await readFile(mf, 'utf8'))
        Object.assign(manifest.counts, { patients: run.totals.patients, encounters: run.totals.encounters, conflicts: run.totals.conflicts, reviewOpen: todo, reviewDecided: decided })
        manifest.gates = run.gates
        manifest.decisionsAppliedAt = at
        await writeFile(mf, JSON.stringify(manifest, null, 2))
      } catch (e) { run.warnings.push(`manifest.json 未更新：${e.message}`) }
      if (run.totals.values <= Number(settings.xlsxMaxRows ?? 200000)) {
        try { await writeXlsx(run.output, tpl, run) } catch (e) { run.warnings.push(`result.xlsx 未更新：${e.message}`) }
      }
      try {
        await writeFile(join(runDir, 'report.md'), renderReport(run, tpl))
        await writeFile(join(runDir, 'report.json'), JSON.stringify({ ...run, templateRaw: undefined, fields: fieldRows(run, tpl) }, null, 2))
      } catch { /* best effort */ }
      records.putRun(run)
      return { status: run.status, todo, decided, conflicts: run.totals.conflicts, rejected: run.totals.rejected ?? 0 }
    } finally {
      applying = null
    }
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
    return { name: blank ? '提取模板（空白）.xlsx' : `提取模板-${t.id}-v${t.version}.xlsx`, base64: Buffer.from(buf).toString('base64') }
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

  /** 某批次的格式识别结果（叠加格式库里的最新判断）。 */
  async function formats(runId) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const tables = []
    for (const t of run.format?.tables ?? []) {
      const e = await library.get(t.signature)
      tables.push(e ? { ...t, status: e.status, recordType: e.spec?.recordType ?? null, spec: e.spec, drafts: e.drafts ?? {}, fields: e.fields ?? [], decidedBy: e.decidedBy ?? null, reason: e.reason ?? t.reason, problems: e.problems ?? [], diffs: e.diffs ?? [], firstDiffs: e.firstDiffs ?? [], rounds: e.rounds ?? [], adjudicated: e.adjudicated ?? null, scope: e.scope ?? null, partialDiffs: e.partialDiffs ?? [] } : t)
    }
    // 批次之后有人工判断（或状态变了）：提示按确认结果重跑
    const changed = tables.some((t, i) => t.status !== run.format.tables[i].status || (t.decidedBy === 'user' && run.format.tables[i].decidedBy !== 'user'))
    return { tables, dict: run.format?.dict ?? 0, heldPolicy: run.format?.heldPolicy ?? settings.heldTables, changed, recordTypes: RECORD_TYPES }
  }
  /**
   * 判断一张表：confirm（采用当前读法，可带改过的 spec）／reject（跳过这张表）／reset（清掉，下次重新识别）。
   * 改过的读法先按画像里的字段校验。
   */
  async function formatDecide({ signature, action, spec = null, use = null }) {
    const e = await library.get(signature)
    if (!e) throw new Error('格式库里没有这张表')
    if (use) { if (!e.drafts?.[use]) throw new Error(`没有「${use}」方案`); spec = e.drafts[use] }
    if (action === 'reset') { await library.remove(signature); return { ok: true } }
    // 人工判断过的条目不再是「只在本插件内采用」
    if (action === 'reject') { await library.put({ ...e, scope: undefined, status: 'rejected', decidedBy: 'user', decidedAt: new Date().toISOString() }); return { ok: true } }
    if (action !== 'confirm') throw new Error('action 应为 confirm、reject 或 reset')
    let next = e.spec
    if (spec) {
      const t = { fields: e.fields }
      ;[next] = fixSpec(normalizeSpec(spec, 'user'), t)
      const problems = checkSpec(next, t)
      if (problems.length) return { ok: false, problems }
    }
    await library.put({ ...e, scope: undefined, spec: { ...next, origin: spec ? 'user' : next.origin }, status: 'confirmed', decidedBy: 'user', decidedAt: new Date().toISOString(), problems: [] })
    return { ok: true }
  }

  async function calls(runId) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const records = await recordsOf(run.outputRoot)
    return { byModel: records.callStats(run.id), errors: records.callErrors(run.id, 100) }
  }
  /**
   * 设置页的模型下拉：读端点的 /models。已保存的 API Key 只发往已保存的端点（提取或核验），
   * 换了一个新地址时只用页面上新填的 Key，避免把 Key 发到别处。
   */
  async function models({ baseURL, apiKey } = {}) {
    const norm = (u) => String(u ?? '').trim().replace(/\/+$/, '')
    const base = norm(baseURL) || norm(settings.baseURL)
    const saved = [norm(settings.baseURL), norm(settings.verifyBaseURL)].filter(Boolean)
    const key = apiKey || (saved.includes(base) ? settings.apiKey : '')
    return listModels({ baseURL: base, apiKey: key })
  }

  function configInfo() {
    return { hasApiKey: Boolean(settings.apiKey), template: settings.template, mode: settings.extractMode === 'model' ? 'model' : 'hybrid', modelConfigured: Boolean(modelInfo()), model: settings.model, verifyModel: settings.verifyModel, baseURL: settings.baseURL, verifyBaseURL: settings.verifyBaseURL, workers: settings.workers, modelConcurrency: settings.modelConcurrency, outputRoot: settings.outputRoot, settings: Object.fromEntries(SAVABLE.filter((k) => k !== 'apiKey').map((k) => [k, settings[k]])) }
  }

  async function dispose() {
    if (active) cancel()
    for (const p of stores.values()) { try { (await p).close() } catch { /* closed */ } }
    stores.clear()
  }

  return { start, cancel, status, list, report, reviewQueue, reviewGroups, decide, decideGroup, applyDecisions, table, evidence, document, templates, template, saveTemplate, templateXlsx, importTemplateXlsx, formats, formatDecide, calls, models, configInfo, dispose, isRunning: () => Boolean(active), settings }
}

let VERSION_CACHE = null
function VERSION() {
  if (VERSION_CACHE) return VERSION_CACHE
  try { VERSION_CACHE = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version } catch { VERSION_CACHE = '0.0.0' }
  return VERSION_CACHE
}
