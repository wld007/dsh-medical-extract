/**
 * 记录库：每个输出根目录一个 SQLite（<outputRoot>/_records/records.sqlite），各批次共用，WAL 模式，
 * 主线程与工作线程各开一个连接。
 *
 *   runs         批次（常用列 + data JSON）
 *   shards       分片进度（断点续跑：已完成的分片跳过）
 *   model_cache  模型回复缓存（key = sha256(模型＋提示)），各批次复用
 *   call_stats   模型调用统计（按批次×角色×模型累计；几千万次调用不逐条记）
 *   call_errors  最近的失败调用（每批次最多 500 条）
 *   decisions    人工裁定当前值（按值或格子的稳定编号，重跑沿用）
 *   decision_log 裁定的每一次改动（只追加）
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const RECORDS_FILE = 'records.sqlite'
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, status TEXT NOT NULL, started_at TEXT, finished_at TEXT, input TEXT, template TEXT,
  output TEXT, documents INTEGER, vals INTEGER, review INTEGER, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS runs_started ON runs (started_at);
CREATE TABLE IF NOT EXISTS shards (
  run_id TEXT NOT NULL, shard INTEGER NOT NULL, status TEXT NOT NULL, docs INTEGER, vals INTEGER,
  started_at TEXT, finished_at TEXT, ms INTEGER, stats TEXT, PRIMARY KEY (run_id, shard));
CREATE TABLE IF NOT EXISTS model_cache (key TEXT PRIMARY KEY, model TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS call_stats (
  run_id TEXT NOT NULL, role TEXT NOT NULL, model TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, cached INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0, ms INTEGER NOT NULL DEFAULT 0, prompt_tokens INTEGER NOT NULL DEFAULT 0, completion_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (run_id, role, model));
CREATE TABLE IF NOT EXISTS call_errors (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, at TEXT NOT NULL, doc TEXT, role TEXT, model TEXT, error TEXT);
CREATE TABLE IF NOT EXISTS decisions (kind TEXT NOT NULL, target TEXT NOT NULL, decision TEXT NOT NULL, value TEXT, note TEXT, by TEXT, at TEXT NOT NULL, run_id TEXT, PRIMARY KEY (kind, target));
CREATE TABLE IF NOT EXISTS decision_log (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, target TEXT NOT NULL, decision TEXT, value TEXT, note TEXT, by TEXT, at TEXT NOT NULL, run_id TEXT);
`

let sqlite = null
async function loadSqlite() {
  if (!sqlite) {
    const emit = process.emitWarning
    process.emitWarning = (w, ...rest) => { if (!String(w?.message ?? w).includes('SQLite')) emit.call(process, w, ...rest) }
    try { sqlite = await import('node:sqlite') } finally { process.emitWarning = emit }
  }
  return sqlite
}

export async function openRecords(recordsDir) {
  const { DatabaseSync } = await loadSqlite()
  mkdirSync(recordsDir, { recursive: true })
  const db = new DatabaseSync(join(recordsDir, RECORDS_FILE))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 30000;')
  db.exec(SCHEMA)
  const q = (sql) => db.prepare(sql)
  const S = {
    cacheGet: q('SELECT content FROM model_cache WHERE key = ?'),
    cachePut: q('INSERT OR IGNORE INTO model_cache (key, model, content, created_at) VALUES (?, ?, ?, ?)'),
    statAdd: q(`INSERT INTO call_stats (run_id, role, model, calls, cached, failed, ms, prompt_tokens, completion_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (run_id, role, model) DO UPDATE SET calls = calls + excluded.calls, cached = cached + excluded.cached, failed = failed + excluded.failed,
      ms = ms + excluded.ms, prompt_tokens = prompt_tokens + excluded.prompt_tokens, completion_tokens = completion_tokens + excluded.completion_tokens`),
    errCount: q('SELECT COUNT(*) AS n FROM call_errors WHERE run_id = ?'),
    errAdd: q('INSERT INTO call_errors (run_id, at, doc, role, model, error) VALUES (?, ?, ?, ?, ?, ?)'),
    runPut: q(`INSERT INTO runs (id, status, started_at, finished_at, input, template, output, documents, vals, review, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET status = excluded.status, finished_at = excluded.finished_at, output = excluded.output, documents = excluded.documents,
      vals = excluded.vals, review = excluded.review, data = excluded.data, updated_at = excluded.updated_at`),
    runGet: q('SELECT data FROM runs WHERE id = ?'),
    runList: q('SELECT data FROM runs ORDER BY started_at DESC LIMIT ?'),
    shardPut: q(`INSERT INTO shards (run_id, shard, status, docs, vals, started_at, finished_at, ms, stats) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (run_id, shard) DO UPDATE SET status = excluded.status, docs = excluded.docs, vals = excluded.vals, started_at = excluded.started_at,
      finished_at = excluded.finished_at, ms = excluded.ms, stats = excluded.stats`),
    shardsOf: q('SELECT shard, status, docs, vals, ms, stats FROM shards WHERE run_id = ? ORDER BY shard'),
    statsOf: q('SELECT role, model, calls, cached, failed, ms, prompt_tokens, completion_tokens FROM call_stats WHERE run_id = ?'),
    errorsOf: q('SELECT at, doc, role, model, error FROM call_errors WHERE run_id = ? ORDER BY id DESC LIMIT ?'),
    decPut: q(`INSERT INTO decisions (kind, target, decision, value, note, by, at, run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (kind, target) DO UPDATE SET decision = excluded.decision, value = excluded.value, note = excluded.note, by = excluded.by, at = excluded.at, run_id = excluded.run_id`),
    decDel: q('DELETE FROM decisions WHERE kind = ? AND target = ?'),
    decLog: q('INSERT INTO decision_log (kind, target, decision, value, note, by, at, run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    decAll: q('SELECT kind, target, decision, value, note, by, at FROM decisions'),
    runDel: q('DELETE FROM runs WHERE id = ?'), shardDel: q('DELETE FROM shards WHERE run_id = ?'),
    statDel: q('DELETE FROM call_stats WHERE run_id = ?'), errDel: q('DELETE FROM call_errors WHERE run_id = ?'),
  }
  const pendingStats = new Map()
  return {
    db,
    cacheGet: (key) => S.cacheGet.get(key)?.content ?? null,
    cachePut: (key, model, content) => { S.cachePut.run(key, model, content, new Date().toISOString()) },
    /** Accumulate in memory; flushStats() writes. */
    logCall(runId, e) {
      const k = `${e.role}\u0000${e.model}`
      const s = pendingStats.get(k) ?? { role: e.role, model: e.model, calls: 0, cached: 0, failed: 0, ms: 0, pt: 0, ct: 0 }
      if (e.cached) s.cached++
      else { s.calls++; if (!e.ok) s.failed++; s.ms += e.ms ?? 0; s.pt += e.usage?.prompt_tokens ?? 0; s.ct += e.usage?.completion_tokens ?? 0 }
      pendingStats.set(k, s)
      if (!e.ok && !e.cached && S.errCount.get(runId).n < 500) S.errAdd.run(runId, e.at, e.doc ?? null, e.role, e.model, String(e.error ?? '').slice(0, 500))
    },
    flushStats(runId) {
      for (const s of pendingStats.values()) S.statAdd.run(runId, s.role, s.model, s.calls, s.cached, s.failed, s.ms, s.pt, s.ct)
      pendingStats.clear()
    },
    putRun(run) {
      const t = run.totals ?? {}
      S.runPut.run(run.id, run.status, run.startedAt ?? null, run.finishedAt ?? null, run.input ?? null, run.template?.id ?? null, run.output ?? null,
        t.documents ?? 0, t.values ?? 0, t.review ?? 0, JSON.stringify(run), new Date().toISOString())
    },
    getRun: (id) => { const r = S.runGet.get(id); return r ? JSON.parse(r.data) : null },
    listRuns: (limit = 50) => S.runList.all(limit).map((r) => JSON.parse(r.data)),
    /** 删掉一个批次的行（批次、分片、调用统计、失败调用）。人工裁定和模型缓存按稳定编号跨批次共用，不删 */
    deleteRun(id) {
      db.exec('BEGIN')
      try { for (const st of [S.runDel, S.shardDel, S.statDel, S.errDel]) st.run(id); db.exec('COMMIT') } catch (e) { try { db.exec('ROLLBACK') } catch { /* none */ } throw e }
    },
    putShard(runId, s) { S.shardPut.run(runId, s.shard, s.status, s.docs ?? 0, s.values ?? 0, s.startedAt ?? null, s.finishedAt ?? null, s.ms ?? 0, JSON.stringify(s.stats ?? {})) },
    shards: (runId) => S.shardsOf.all(runId).map((r) => ({ ...r, stats: JSON.parse(r.stats ?? '{}') })),
    callStats: (runId) => S.statsOf.all(runId),
    callErrors: (runId, limit = 100) => S.errorsOf.all(runId, limit),
    decide({ kind, target, decision, value = null, note = null, by = null, runId = null }) {
      const at = new Date().toISOString()
      const v = value == null ? null : JSON.stringify(value)
      if (decision === 'clear') S.decDel.run(kind, target)
      else S.decPut.run(kind, target, decision, v, note, by, at, runId)
      S.decLog.run(kind, target, decision, v, note, by, at, runId)
    },
    decisions() {
      const out = new Map()
      for (const r of S.decAll.all()) out.set(`${r.kind}\u0000${r.target}`, { ...r, value: r.value == null ? null : JSON.parse(r.value) })
      return out
    },
    /** 一批写入合成一个事务（批量裁定等），出错整批回滚 */
    transaction(fn) {
      db.exec('BEGIN')
      try { const r = fn(); db.exec('COMMIT'); return r } catch (e) { try { db.exec('ROLLBACK') } catch { /* none */ } throw e }
    },
    close() { try { db.close() } catch { /* closed */ } },
  }
}
