/**
 * 一个分片：读若干单元的文书 → 抽取（规则＋模型）→ 抽样核验 → 写三份分片文件（先写临时文件，完成后改名）：
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
import { mergeVotes, modelExtract, modelRead } from './model.js'
import { sectionOk, tasksFor } from './dispatch.js'

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

/**
 * 跨工作线程的全局限流：计数放在 SharedArrayBuffer 里，所有线程共用同一个上限。
 * 线程被强行结束时计数可能不归零——每个批次用新的计数，不影响下一批。
 */
export function sharedLimiter(sab, max) {
  const n = new Int32Array(sab)
  const acquire = async () => {
    for (;;) {
      const cur = Atomics.load(n, 0)
      if (cur < max) { if (Atomics.compareExchange(n, 0, cur, cur + 1) === cur) return; continue }
      const r = Atomics.waitAsync(n, 0, cur, 1000)
      if (r.async) await r.value
    }
  }
  const release = () => { Atomics.sub(n, 0, 1); Atomics.notify(n, 0, 1) }
  return async (fn) => { await acquire(); try { return await fn() } finally { release() } }
}

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
function reviewItem(doc, field, kind, values, other) {
  const mine = values.filter((v) => v.field === field.id)
  const spans = new Map()
  for (const v of [...mine, ...other]) { const [a, b] = sentenceAt(doc.text, v.s, v.e); spans.set(`${a}:${b}`, [a, b]) }
  return {
    id: stableId('R', doc.id, field.id, ...(kind === 'rule' ? ['rule'] : [])), kind, doc: doc.id, patient: doc.patient, encounter: doc.encounter, recordType: doc.recordType,
    written: doc.written, field: field.id, final: docLevel(field, values), verify: docLevel(field, other),
    finalValues: mine.map((v) => ({ id: v.id, value: v.value, assertion: v.assertion, quote: v.quote, s: v.s, e: v.e, method: v.method })),
    verifyValues: other.map((v) => ({ value: v.value, assertion: v.assertion, quote: v.quote, s: v.s, e: v.e, method: v.method })),
    snippets: [...spans.values()].slice(0, 6).map(([a, b]) => ({ s: a, e: b, text: doc.text.slice(a, b) })), source: doc.source,
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
  const mode = task.mode ?? settings.extractMode ?? 'hybrid'
  const modelOn = mode !== 'rules' && (env.chatImpl?.extract || (settings.modelEnabled !== false && settings.baseURL && settings.model))
  const width = Math.max(1, Number(task.modelWidth ?? settings.modelConcurrency ?? 4))
  const limit = env.modelGate ? sharedLimiter(env.modelGate, width) : limiter(width)
  const store = {
    cacheGet: (k) => env.store.cacheGet(k), cachePut: (k, m, c) => env.store.cachePut(k, m, c),
    logCall: (e) => env.store.logCall(task.runId, e),
  }
  const mk = (base, model) => createLlm({ baseURL: base, model, apiKey: settings.apiKey, timeoutMs: settings.timeoutMs, disableThinking: settings.disableThinking })
  const extractLlm = modelOn ? (env.chatImpl?.extract ?? mk(settings.baseURL, settings.model)) : null
  const verifyLlm = modelOn && (env.chatImpl?.verify || settings.verifyModel) ? (env.chatImpl?.verify ?? mk(settings.verifyBaseURL || settings.baseURL, settings.verifyModel)) : null
  const runner = extractLlm ? { llm: extractLlm, store, limit } : null
  const vRunner = verifyLlm ? { llm: verifyLlm, store, limit } : null
  // 取值方式：read＝分派后模型通读（默认）；rules＝仅规则（没配模型或选了仅规则）；recall＝旧流程（关键词定位后送片段），只为对比保留
  const flow = !modelOn ? 'rules' : settings.extractFlow === 'recall' ? 'recall' : 'read'
  const readOpts = { maxChars: Number(settings.readMaxChars) || 6000, maxFields: Number(settings.readMaxFields) || 30 }
  const skipNoKeyword = settings.skipNoKeyword === true
  const neverIds = new Set(tpl.fields.filter((f) => f.model === 'never' && f.type !== 'derived').map((f) => f.id))
  const sampleRate = Number(settings.verifySampleRate ?? 0.02)
  const minPerField = Number(settings.verifyMinPerField ?? 2)
  const fieldQuota = new Map()

  const dirs = ['evidence', 'entities', 'review'].map((d) => join(task.workDir, d))
  for (const d of dirs) await mkdir(d, { recursive: true })
  const name = partName(task.shard)
  const tmp = dirs.map((d) => join(d, `${name}.tmp`))
  const [ev, en, rv] = tmp.map(gzWriter)

  const stats = {
    docs: 0, structured: 0, hollow: 0, decoded: 0, garbled: 0, media: 0, mediaKinds: {}, skipped: 0, noKeyword: 0, recalled: 0, tasks: 0, assigned: 0, votes: 0, ruleDisputes: 0, values: 0, byMethod: {}, byField: {}, calls: 0, cached: 0, failed: 0,
    quoteFail: 0, invalid: 0, outOfRange: 0, agree: 0, disagree: 0, verify: {}, review: 0, problems: [],
  }
  const entities = new Map()
  const seenPersons = new Set()

  for (const unit of task.units) {
    if (env.isCancelled()) break
    const { persons, encounters, documents, structured, hollow, clean } = await readUnitDocs(unit, task.plan)
    stats.structured += structured ?? 0
    stats.hollow += hollow ?? 0
    stats.decoded += clean?.decoded ?? 0; stats.garbled += clean?.garbled ?? 0; stats.media += clean?.media ?? 0
    for (const [k, n] of Object.entries(clean?.mediaKinds ?? {})) stats.mediaKinds[k] = (stats.mediaKinds[k] ?? 0) + n
    for (const [patient, p] of Object.entries(persons)) if (!seenPersons.has(patient)) { seenPersons.add(patient); en.write({ t: 'p', patient, birth: p.birth ?? null, sex: p.sex ?? null }) }
    for (const e of encounters) entities.set(`${e.patient}\u0000${e.id}`, { t: 'e', patient: e.patient, encounter: e.id, kind: e.kind ?? null, start: e.start ?? null, end: e.end ?? null, docs: 0 })
    const docs = task.asOf ? documents.filter((d) => d.written && d.written <= task.asOf) : documents
    stats.skipped += documents.length - docs.length
    await pool(docs, Math.max(1, width * 2), async (doc) => {
      if (env.isCancelled()) return
      const k = `${doc.patient}\u0000${doc.encounter ?? ''}`
      const ent = entities.get(k) ?? { t: 'e', patient: doc.patient, encounter: doc.encounter ?? null, kind: doc.encounterKind ?? null, start: null, end: null, docs: 0 }
      ent.docs++
      if (doc.written) { if (!ent.first || doc.written < ent.first) ent.first = doc.written; if (!ent.last || doc.written > ent.last) ent.last = doc.written }
      entities.set(k, ent)

      let values = []; let tasks = []; let modelIds = new Set()
      if (flow === 'read') {
        // 可选的成本开关：一份文书里一个模板关键词都没有，整份跳过
        if (skipNoKeyword && !tpl.fields.some((f) => keywordHits(doc, f).length)) { stats.noKeyword++; stats.docs++; env.onProgress?.(1); return }
        // 分派：按文书类型、栏目定字段，切成任务（不看关键词）
        tasks = tasksFor(doc, tpl, readOpts)
        stats.tasks += tasks.length
        modelIds = new Set(tasks.flatMap((t) => t.fields.map((f) => f.id)))
        stats.assigned += modelIds.size
        // model: never 的字段只走规则
        if (neverIds.size) values.push(...extractDocument(doc, tpl, { lex, mode: 'rules', only: neverIds }).values)
        if (tasks.length) {
          const votes = mode === 'model' ? [] : ruleVotes(doc, tpl.fields.filter((f) => modelIds.has(f.id)), lex)
          stats.votes += votes.length
          const m = await modelRead(doc, tpl, tasks, runner, { role: 'extract', sectionOk })
          for (const k2 of ['calls', 'cached', 'failed', 'quoteFail', 'invalid']) stats[k2] += m.stats[k2]
          for (const p of m.stats.problems) if (stats.problems.length < 30) stats.problems.push(p)
          const merged = mergeVotes(votes, m.values, m)
          values.push(...merged.values); stats.agree += merged.agree; stats.disagree += merged.disagree
          // 规则票与模型不一致：进人工复核
          const byField = new Map()
          for (const r of merged.disputes) byField.set(r.field, [...(byField.get(r.field) ?? []), r])
          for (const [fid, rs] of byField) {
            const field = tpl.byId.get(fid)
            stats.review++; stats.ruleDisputes++
            rv.write(reviewItem(doc, field, 'rule', values, rs))
          }
        }
      } else {
        const r = extractDocument(doc, tpl, { lex, mode: flow === 'rules' ? 'rules' : mode })
        stats.recalled += r.recalled
        values = r.values
        if (r.pending && runner) {
          const m = await modelExtract(doc, tpl, r.pending, runner, { role: 'extract' })
          for (const k2 of ['calls', 'cached', 'failed', 'quoteFail', 'invalid']) stats[k2] += m.stats[k2]
          for (const p of m.stats.problems) if (stats.problems.length < 30) stats.problems.push(p)
          const merged = mergeVotes(values, m.values, m)
          values = merged.values; stats.agree += merged.agree; stats.disagree += merged.disagree
        }
      }
      for (const v of values) {
        ev.write(v)
        stats.values++
        stats.byMethod[v.method.split(':')[0] === 'rule' ? 'rule' : v.method] = (stats.byMethod[v.method.split(':')[0] === 'rule' ? 'rule' : v.method] ?? 0) + 1
        const bf = (stats.byField[v.field] ??= { values: 0, docs: 0 }); bf.values++
        if (v.flags?.includes('超出值域')) stats.outOfRange++
      }
      for (const fid of new Set(values.map((v) => v.field))) stats.byField[fid].docs++

      // 核验：核验模型对同样的任务背靠背通读；按字段比文书级结论，两边都"未提及"的不计
      if (vRunner && flow === 'read' && tasks.length) {
        const docSampled = fnv(doc.id) / 0xffffffff < sampleRate
        const valued = [...new Set(values.filter((v) => v.value != null && modelIds.has(v.field)).map((v) => v.field))]
        const need = valued.filter((f) => (fieldQuota.get(f) ?? 0) < minPerField)
        if (docSampled || need.length) {
          for (const f of need) fieldQuota.set(f, (fieldQuota.get(f) ?? 0) + 1)
          const vtasks = docSampled ? tasks : tasks.filter((t) => t.fields.some((f) => need.includes(f.id)))
          const vm = await modelRead(doc, tpl, vtasks, vRunner, { role: 'verify', sectionOk })
          for (const k2 of ['calls', 'cached', 'failed']) stats[k2] += vm.stats[k2]
          if (!vm.anyFailed) {
            for (const fid of new Set(vtasks.flatMap((t) => t.fields.map((f) => f.id)))) {
              const field = tpl.byId.get(fid)
              const a = docLevel(field, values); const b = docLevel(field, vm.values)
              if (a === '未提及' && b === '未提及') continue
              const vs = (stats.verify[fid] ??= { n: 0, agree: 0 })
              vs.n++
              if (sameConclusion(field, a, b)) { vs.agree++; continue }
              stats.review++
              rv.write(reviewItem(doc, field, 'verify', values, vm.values.filter((v) => v.field === fid)))
            }
          }
        }
      } else if (vRunner && flow === 'recall') {
        const full = extractDocument(doc, tpl, { lex, mode: 'model' })
        if (full.pending) {
          const docSampled = fnv(doc.id) / 0xffffffff < sampleRate
          const fields = full.pending.fields.filter((f) => docSampled || (fieldQuota.get(f) ?? 0) < minPerField)
          if (fields.length) {
            for (const f of fields) fieldQuota.set(f, (fieldQuota.get(f) ?? 0) + 1)
            const pend = { ...full.pending, fields }
            const vm = await modelExtract(doc, tpl, pend, vRunner, { role: 'verify' })
            for (const k2 of ['calls', 'cached', 'failed']) stats[k2] += vm.stats[k2]
            if (!vm.anyFailed) {
              for (const fid of fields) {
                const field = tpl.byId.get(fid)
                const a = docLevel(field, values); const b = docLevel(field, vm.values)
                const vs = (stats.verify[fid] ??= { n: 0, agree: 0 })
                vs.n++
                if (sameConclusion(field, a, b)) { vs.agree++; continue }
                stats.review++
                const snips = full.pending.byField[fid].map((id) => full.pending.snippets.find((s) => s.id === id)).slice(0, 6)
                rv.write({
                  id: stableId('R', doc.id, fid), kind: 'verify', doc: doc.id, patient: doc.patient, encounter: doc.encounter, recordType: doc.recordType,
                  written: doc.written, field: fid, final: a, verify: b,
                  finalValues: values.filter((v) => v.field === fid).map((v) => ({ id: v.id, value: v.value, assertion: v.assertion, quote: v.quote, s: v.s, e: v.e, method: v.method })),
                  verifyValues: vm.values.filter((v) => v.field === fid).map((v) => ({ value: v.value, assertion: v.assertion, quote: v.quote, s: v.s, e: v.e })),
                  snippets: snips.map((s) => ({ s: s.s, e: s.e, text: s.text })), source: doc.source,
                })
              }
            }
          }
        }
      }
      stats.docs++
      env.onProgress?.(1)
    }, env.isCancelled)
  }
  for (const e of entities.values()) en.write(e)
  await Promise.all([ev.close(), en.close(), rv.close()])
  if (env.isCancelled()) { await Promise.all(tmp.map((p) => rm(p, { force: true }))); return { cancelled: true, stats } }
  for (let i = 0; i < tmp.length; i++) await rename(tmp[i], join(dirs[i], name))
  env.store.flushStats?.(task.runId)
  stats.ms = Date.now() - t0
  return { cancelled: false, stats }
}
