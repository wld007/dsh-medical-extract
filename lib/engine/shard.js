/**
 * 一个分片：读若干单元的文书 → 提取（规则＋模型）→ 抽样核验 → 写三份分片文件（先写临时文件，完成后改名）：
 *
 *   work/evidence/part-NNNNN.ndjson.gz   值（证据长表）
 *   work/entities/part-NNNNN.ndjson.gz   病人与就诊（人口信息、就诊起止、文书数），汇总时用
 *   work/review/part-NNNNN.ndjson.gz     抽样核验的分歧（进人工复核）
 *
 * 分片是断点单位：文件改名成功＝分片完成；继续处理时跳过已完成的分片。
 */
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createGzip } from 'node:zlib'
import { readUnitDocs } from '../source/index.js'
import { compileTemplate } from '../template/load.js'
import { createLlm } from '../llm.js'
import { fnv, pool, stableId } from '../util.js'
import { buildLexicon } from './assertion.js'
import { extractDocument, keywordHits, ruleVotes, sentenceAt } from './extract.js'
import { addPerf, mergeVotes, modelRead, newPerf } from './model.js'
import { sectionOk, tasksFor } from './dispatch.js'
import { GATE_BYTES, gateLimiter, modelSlots } from './gate.js'
import { adjudicate } from './adjudicate.js'

export const partName = (n) => `part-${String(n).padStart(5, '0')}.ndjson.gz`

function gzWriter(path) {
  const gz = createGzip({ level: 6 })
  const out = createWriteStream(path)
  gz.pipe(out)
  let buf = ''
  return {
    write(obj) { buf += `${JSON.stringify(obj)}\n`; if (buf.length > 1 << 20) { gz.write(buf); buf = '' } },
    close() { return new Promise((resolve, reject) => { if (buf) gz.write(buf); out.on('finish', resolve); out.on('error', reject); gz.end() }) },
  }
}

export { GATE_BYTES, gateLimiter, readGate } from './gate.js'

/** Simple concurrency limiter (shared by all documents of a shard). */
export function limiter(width) {
  let active = 0; const queue = []
  const next = () => { if (active >= width || !queue.length) return; active++; const { fn, resolve, reject } = queue.shift(); fn().then(resolve, reject).finally(() => { active--; next() }) }
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next() })
}

/** Document-level conclusion of one field (for comparing with the verifier). */
export function docLevel(field, values) {
  const vs = values.filter((v) => v.field === field.id && v.value != null)
  if (field.type === 'presence') return vs.some((v) => v.value === '有') ? '有' : vs.some((v) => v.value === '可疑') ? '可疑' : vs.some((v) => v.value === '无') ? '无' : '未提及'
  return [...new Set(vs.map((v) => String(v.value)))].sort().join('；') || '未提及'
}
const tokens = (s) => [...new Set(String(s).split(/[；;、，,\n]/).map((x) => x.replace(/[\s。.:："“”'‘’（）()]/g, '')).filter(Boolean))].sort()
/** Agreement ignoring punctuation, item order, joined-vs-split lists, and date precision (2024-10 ≈ 2024-10-06). */
export function sameConclusion(field, a, b) {
  if (a === b) return true
  if (a === '未提及' || b === '未提及') return false
  if (field.type === 'date') {
    const A = tokens(a); const B = tokens(b)
    const ok = (x, Y) => Y.some((y) => x.startsWith(y) || y.startsWith(x))
    return A.every((x) => ok(x, B)) && B.every((y) => ok(y, A))
  }
  if (field.type === 'number' || field.type === 'score') return tokens(a).map(Number).join() === tokens(b).map(Number).join()
  const A = tokens(a).join('|'); const B = tokens(b).join('|')
  if (A === B) return true
  if (field.type === 'text') return A.replace(/\|/g, '') === B.replace(/\|/g, '') || A.includes(B) || B.includes(A)
  return false
}

/** 复核项：kind＝verify（核验模型分歧）或 rule（规则票与模型不一致）；other＝核验模型或规则的值 */
function reviewItem(doc, field, kind, values, other, adj = null) {
  const mine = values.filter((v) => v.field === field.id)
  const spans = new Map()
  const roundVals = (adj?.rounds ?? []).flatMap((r) => [...(r.extract ?? []), ...(r.verify ?? [])])
  for (const v of [...mine, ...other, ...roundVals]) { const [a, b] = sentenceAt(doc.text, v.s, v.e); spans.set(`${a}:${b}`, [a, b]) }
  return {
    id: stableId('R', doc.id, field.id, ...(kind === 'rule' ? ['rule'] : [])), kind, doc: doc.id, patient: doc.patient, encounter: doc.encounter, recordType: doc.recordType,
    written: doc.written, field: field.id, final: docLevel(field, values), verify: docLevel(field, other),
    finalValues: mine.map((v) => ({ id: v.id, value: v.value, assertion: v.assertion, quote: v.quote, s: v.s, e: v.e, method: v.method })),
    verifyValues: other.map((v) => ({ value: v.value, assertion: v.assertion, quote: v.quote, s: v.s, e: v.e, method: v.method })),
    snippets: [...spans.values()].slice(0, 8).map(([a, b]) => ({ s: a, e: b, text: doc.text.slice(a, b) })), source: doc.source,
    // 复判：每一轮双方的答案、引语和理由；resolved＝复判已解决（不进复核单，复核页可筛出抽查）
    rounds: adj?.rounds ?? [], resolved: adj?.resolved ? { round: adj.round, by: adj.by } : null,
  }
}

/**
 * task: { runId, shard, units, plan, template (raw), settings, workDir, asOf, priorities, mode }
 * env:  { store (records), chatImpl?, onProgress(docs), isCancelled() }
 */
export async function processShard(task, env) {
  const { settings } = task
  const tpl = compileTemplate(task.template, { priorities: task.priorities })
  const lex = buildLexicon(tpl.lexicon)
  const t0 = Date.now()
  const mode = task.mode === 'model' ? 'model' : 'hybrid'
  if (!env.chatImpl?.extract && !(settings.baseURL && settings.model)) throw new Error('没有配置提取模型')
  const gate = env.modelGate ?? new SharedArrayBuffer(GATE_BYTES)
  const slots = modelSlots(settings, env.chatImpl)
  // 同时在处理的文书数要够把名额喂满；自动调并发时上限会涨，按 32 起算
  const width = Math.max(slots.extract.max + (slots.verify && slots.verify.slot !== 0 ? slots.verify.max : 0), settings.autoConcurrency !== false ? 32 : 0)
  const lim = (role, station) => gateLimiter(gate, { ...(role === 'verify' ? slots.verify : slots.extract), station })
  const store = {
    cacheGet: (k) => env.store.cacheGet(k), cachePut: (k, m, c) => env.store.cachePut(k, m, c),
    logCall: (e) => env.store.logCall(task.runId, e),
  }
  const mk = (base, model) => createLlm({ baseURL: base, model, apiKey: settings.apiKey, timeoutMs: settings.timeoutMs, disableThinking: settings.disableThinking })
  const extractLlm = env.chatImpl?.extract ?? mk(settings.baseURL, settings.model)
  const verifyLlm = env.chatImpl?.verify || settings.verifyModel ? (env.chatImpl?.verify ?? mk(settings.verifyBaseURL || settings.baseURL, settings.verifyModel)) : null
  const mkRunner = (llm, role, station) => { const l = lim(role, station); return { llm, store, limit: l, tally: l.tally, fail: l.fail } }
  const runner = mkRunner(extractLlm, 'extract', 'extract')
  const vRunner = verifyLlm ? mkRunner(verifyLlm, 'verify', 'verify') : null
  const adjE = mkRunner(extractLlm, 'extract', 'adjudicate')
  const adjV = verifyLlm ? mkRunner(verifyLlm, 'verify', 'adjudicate') : null
  const maxRounds = Math.max(1, Math.min(6, Number(settings.maxRounds) || 3))
  const readOpts = { maxChars: Number(settings.readMaxChars) || 6000, maxFields: Number(settings.readMaxFields) || 30 }
  const skipNoKeyword = settings.skipNoKeyword === true
  const neverIds = new Set(tpl.fields.filter((f) => f.model === 'never' && f.type !== 'derived').map((f) => f.id))
  const sampleRate = Number(settings.verifySampleRate ?? 0.02)
  const minPerField = Number(settings.verifyMinPerField ?? 2)
  const fieldQuota = new Map()
  const perfOf = (role, llm, m) => { const x = (stats.models[role] ??= { model: llm.model, ...newPerf() }); if (m.stats.perf) addPerf(x, m.stats.perf) }
  const replace = (arr, fid, vals) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i].field === fid) arr.splice(i, 1); arr.push(...vals) }
  /** 复判用的原文：含这个字段的任务里，覆盖两边引语最多的那一段 */
  const ctxFor = (tasks, fid, vals) => {
    const cand = tasks.filter((t) => t.fields.some((f) => f.id === fid))
    const pool0 = cand.length ? cand : tasks
    let best = pool0[0]; let bestN = -1
    for (const t of pool0) { const n = vals.filter((v) => v.s >= t.s && v.s < t.e).length; if (n > bestN) { best = t; bestN = n } }
    return { s: best.s, e: best.e, text: best.text }
  }
  const runAdj = async ({ doc, field, tasks, mine, other, kind }) => {
    const adj = await adjudicate({ doc, field, ctx: ctxFor(tasks, field.id, [...mine, ...other]), mine, other, extract: adjE, verify: adjV, kind, maxRounds, conclude: docLevel, same: sameConclusion, sectionOk })
    for (const k2 of ['calls', 'cached', 'failed', 'quoteFail', 'invalid']) stats[k2] += adj.stats[k2]
    if (adj.stats.quoteFail || adj.stats.invalid) { const dd = ((stats.dropped ??= {})[field.id] ??= { quote: 0, invalid: 0 }); dd.quote += adj.stats.quoteFail; dd.invalid += adj.stats.invalid }
    stats.adjCalls += adj.stats.calls
    if (adj.stats.perfE) addPerf((stats.models['adj-extract'] ??= { model: adjE.llm.model, ...newPerf() }), adj.stats.perfE)
    if (adj.stats.perfV) addPerf((stats.models['adj-verify'] ??= { model: adjV.llm.model, ...newPerf() }), adj.stats.perfV)
    return adj
  }

  // docs：每份进了提取的文书一行（编号、病人、类型、时间、在数据块里第几个单元、值数、待判断数），逐份核对页按它找文书
  const dirs = ['evidence', 'entities', 'review', 'docs'].map((d) => join(task.workDir, d))
  for (const d of dirs) await mkdir(d, { recursive: true })
  const name = partName(task.shard)
  const tmp = dirs.map((d) => join(d, `${name}.tmp`))
  const [ev, en, rv, dx] = tmp.map(gzWriter)
  // 每位病人：[文书数, 值数, 待判断数, 一个值都没提到的文书数]（随数据块记进记录库，逐份核对页列病人不用扫文件）
  const perPatient = new Map()
  const notePatient = (p, n, r) => { const x = perPatient.get(p) ?? [0, 0, 0, 0]; x[0]++; x[1] += n; x[2] += r; if (!n) x[3]++; perPatient.set(p, x) }

  const stats = {
    docs: 0, structured: 0, hollow: 0, decoded: 0, garbled: 0, media: 0, mediaKinds: {}, skipped: 0, noKeyword: 0, tasks: 0, hollowChars: 0, freeChars: 0, models: {}, ruleResolved: 0, adjResolved: 0, adjByRound: [0, 0, 0, 0, 0, 0], adjCalls: 0, assigned: 0, votes: 0, ruleDisputes: 0, values: 0, byMethod: {}, byField: {}, calls: 0, cached: 0, failed: 0,
    quoteFail: 0, invalid: 0, outOfRange: 0, agree: 0, disagree: 0, verify: {}, review: 0, problems: [],
    // 分派明细：按文书类型 { docs, tasks, fields, split, none }；按字段 派到的文书数
    dispatch: {}, fieldDocs: {},
  }
  const entities = new Map()
  const seenPersons = new Set()

  // 每个输入单元（p_doc 的一位病人文件夹、通用文件或其中一段）的小计，给「文件」页：文书、空白、结构化、值、待判断、用时；读不了的记原因，跳过这个单元接着处理
  const unitStats = []
  for (const [ui, unit] of task.units.entries()) {
    if (env.isCancelled()) break
    const u0 = Date.now()
    let read
    try { read = await readUnitDocs(unit, task.plan) } catch (e) {
      unitStats.push({ u: ui, error: String(e?.message ?? e).slice(0, 300), ms: Date.now() - u0 })
      stats.unitErrors = (stats.unitErrors ?? 0) + 1
      continue
    }
    const { persons, encounters, documents, structured, hollow, hollowChars, clean } = read
    stats.hollowChars += hollowChars ?? 0; stats.freeChars += hollowChars ?? 0
    stats.structured += structured ?? 0
    stats.hollow += hollow ?? 0
    stats.decoded += clean?.decoded ?? 0; stats.garbled += clean?.garbled ?? 0; stats.media += clean?.media ?? 0
    for (const [k, n] of Object.entries(clean?.mediaKinds ?? {})) stats.mediaKinds[k] = (stats.mediaKinds[k] ?? 0) + n
    for (const [patient, p] of Object.entries(persons)) if (!seenPersons.has(patient)) { seenPersons.add(patient); en.write({ t: 'p', patient, birth: p.birth ?? null, sex: p.sex ?? null }) }
    for (const e of encounters) entities.set(`${e.patient}\u0000${e.id}`, { t: 'e', patient: e.patient, encounter: e.id, kind: e.kind ?? null, start: e.start ?? null, end: e.end ?? null, docs: 0 })
    const docs = task.asOf ? documents.filter((d) => d.written && d.written <= task.asOf) : documents
    stats.skipped += documents.length - docs.length
    for (const d of documents) if (task.asOf && !(d.written && d.written <= task.asOf)) stats.freeChars += d.text.length
    const us = { u: ui, docs: 0, hollow: hollow ?? 0, structured: structured ?? 0, skipped: documents.length - docs.length, values: 0, review: 0, patients: 0, patient: null, ms: 0 }
    const unitPatients = new Set([...Object.keys(persons), ...docs.map((d) => d.patient)])
    us.patients = unitPatients.size; us.patient = unitPatients.size ? [...unitPatients][0] : null
    unitStats.push(us)
    await pool(docs, Math.max(1, width * 2), async (doc) => {
      if (env.isCancelled()) return
      const k = `${doc.patient}\u0000${doc.encounter ?? ''}`
      const ent = entities.get(k) ?? { t: 'e', patient: doc.patient, encounter: doc.encounter ?? null, kind: doc.encounterKind ?? null, start: null, end: null, docs: 0 }
      ent.docs++
      if (doc.written) { if (!ent.first || doc.written < ent.first) ent.first = doc.written; if (!ent.last || doc.written > ent.last) ent.last = doc.written }
      entities.set(k, ent)

      const values = []
      // 可选的成本开关：一份文书里一个模板关键词都没有，整份跳过
      const meta = { doc: doc.id, patient: doc.patient, encounter: doc.encounter ?? null, recordType: doc.recordType, written: doc.written ?? null, chars: doc.text.length, u: ui }
      if (skipNoKeyword && !tpl.fields.some((f) => keywordHits(doc, f).length)) { dx.write({ ...meta, n: 0, r: 0, skipped: 'noKeyword' }); notePatient(doc.patient, 0, 0); us.docs++; stats.noKeyword++; stats.freeChars += doc.text.length; stats.docs++; env.onProgress?.(1); return }
      // 分派：按文书类型、栏目定字段，切成任务（不看关键词）
      const tasks = tasksFor(doc, tpl, readOpts)
      stats.tasks += tasks.length
      const modelIds = new Set(tasks.flatMap((t) => t.fields.map((f) => f.id)))
      stats.assigned += modelIds.size
      if (!tasks.length) stats.freeChars += doc.text.length
      {
        const d = (stats.dispatch[doc.recordType || '文书'] ??= { docs: 0, tasks: 0, fields: 0, split: 0, none: 0 })
        d.docs++; d.tasks += tasks.length; d.fields += modelIds.size
        if (!tasks.length) d.none++
        else if (new Set(tasks.map((x) => x.s)).size > 1) d.split++
        for (const id of modelIds) stats.fieldDocs[id] = (stats.fieldDocs[id] ?? 0) + 1
      }
      // model: never 的字段只走规则
      if (neverIds.size) values.push(...extractDocument(doc, tpl, { lex, mode: 'rules', only: neverIds }).values)
      const items = [] // 复核项（交人工的和复判已解决的），值写完后再写
      if (tasks.length) {
        const votes = mode === 'model' ? [] : ruleVotes(doc, tpl.fields.filter((f) => modelIds.has(f.id)), lex)
        stats.votes += votes.length
        const m = await modelRead(doc, tpl, tasks, runner, { role: 'extract', sectionOk })
        perfOf('extract', runner.llm, m)
        for (const k2 of ['calls', 'cached', 'failed', 'quoteFail', 'invalid']) stats[k2] += m.stats[k2]
        for (const [fid, x] of Object.entries(m.stats.dropped ?? {})) { const dd = ((stats.dropped ??= {})[fid] ??= { quote: 0, invalid: 0 }); dd.quote += x.quote; dd.invalid += x.invalid }
        for (const p of m.stats.problems) if (stats.problems.length < 30) stats.problems.push(p)
        const merged = mergeVotes(votes, m.values, m)
        values.push(...merged.values); stats.agree += merged.agree; stats.disagree += merged.disagree
        // 规则票与模型不一致：提取模型看规则匹配到的那一处复判 1 轮；坚持的交人工
        const byField = new Map()
        for (const r of merged.disputes) byField.set(r.field, [...(byField.get(r.field) ?? []), r])
        for (const [fid, rs] of byField) {
          const field = tpl.byId.get(fid)
          stats.ruleDisputes++
          const mine = values.filter((v) => v.field === fid)
          const adj = await runAdj({ doc, field, tasks, mine, other: rs, kind: 'rule' })
          if (adj.resolved) {
            stats.ruleResolved++
            replace(values, fid, adj.final.map((v) => ({ ...v, method: 'model+rule', confidence: 'high' })))
          }
          items.push(reviewItem(doc, field, 'rule', values, rs, adj))
        }
      }

      // 核验：核验模型对同样的任务背靠背通读；按字段比文书级结论，两边都"未提及"的不计。
      // 一致率按复判前算（验收门④）；不一致的进复判，至多 maxRounds 轮，仍不一致交人工
      if (vRunner && tasks.length) {
        const docSampled = fnv(doc.id) / 0xffffffff < sampleRate
        const valued = [...new Set(values.filter((v) => v.value != null && modelIds.has(v.field)).map((v) => v.field))]
        const need = valued.filter((f) => (fieldQuota.get(f) ?? 0) < minPerField)
        if (docSampled || need.length) {
          for (const f of need) fieldQuota.set(f, (fieldQuota.get(f) ?? 0) + 1)
          const vtasks = docSampled ? tasks : tasks.filter((t) => t.fields.some((f) => need.includes(f.id)))
          const vm = await modelRead(doc, tpl, vtasks, vRunner, { role: 'verify', sectionOk })
          perfOf('verify', vRunner.llm, vm)
          for (const k2 of ['calls', 'cached', 'failed']) stats[k2] += vm.stats[k2]
          if (!vm.anyFailed) {
            for (const fid of new Set(vtasks.flatMap((t) => t.fields.map((f) => f.id)))) {
              const field = tpl.byId.get(fid)
              const a = docLevel(field, values); const b = docLevel(field, vm.values)
              if (a === '未提及' && b === '未提及') continue
              const vs = (stats.verify[fid] ??= { n: 0, agree: 0, adj: 0, resolved: 0, changed: 0 })
              vs.n++
              if (sameConclusion(field, a, b)) { vs.agree++; continue }
              const other = vm.values.filter((v) => v.field === fid)
              const adj = await runAdj({ doc, field, tasks, mine: values.filter((v) => v.field === fid), other, kind: 'verify' })
              vs.adj++
              if (adj.extractorChanged) vs.changed++
              if (adj.resolved) { vs.resolved = (vs.resolved ?? 0) + 1; replace(values, fid, adj.final.map((v) => ({ ...v, flags: [...v.flags.filter((x) => x !== '规则票'), '复判', `复判第${adj.round}轮`] }))) }
              items.push(reviewItem(doc, field, 'verify', values, other, adj))
            }
          }
        }
      }

      for (const v of values) {
        ev.write(v)
        stats.values++
        stats.byMethod[v.method.split(':')[0] === 'rule' ? 'rule' : v.method] = (stats.byMethod[v.method.split(':')[0] === 'rule' ? 'rule' : v.method] ?? 0) + 1
        const bf = (stats.byField[v.field] ??= { values: 0, docs: 0 }); bf.values++
        if (v.flags?.includes('超出值域')) { stats.outOfRange++; bf.oor = (bf.oor ?? 0) + 1 }
      }
      for (const fid of new Set(values.map((v) => v.field))) stats.byField[fid].docs++
      const open = items.filter((it) => !it.resolved).length
      dx.write({ ...meta, n: values.length, r: open })
      us.docs++; us.values += values.length; us.review += open
      notePatient(doc.patient, values.length, open)
      for (const it of items) {
        rv.write(it)
        if (it.resolved) { stats.adjResolved++; stats.adjByRound[it.resolved.round - 1] = (stats.adjByRound[it.resolved.round - 1] ?? 0) + 1 } else stats.review++
      }
      stats.docs++
      env.onProgress?.(1)
    }, env.isCancelled)
    us.ms = Date.now() - u0
  }
  for (const e of entities.values()) en.write(e)
  await Promise.all([ev.close(), en.close(), rv.close(), dx.close()])
  stats.patients = [...perPatient].map(([p, x]) => [p, ...x])
  stats.units = unitStats
  if (env.isCancelled()) { await Promise.all(tmp.map((p) => rm(p, { force: true }))); return { cancelled: true, stats } }
  for (let i = 0; i < tmp.length; i++) await rename(tmp[i], join(dirs[i], name))
  env.store.flushStats?.(task.runId)
  stats.ms = Date.now() - t0
  return { cancelled: false, stats }
}
