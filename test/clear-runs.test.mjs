import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createService } from '../lib/service.js'
import { openRecords } from '../lib/records/store.js'

// 清空批次记录：删批次目录与批次行；人工裁定、模型缓存保留；交付数据只在勾选时删
test('clearRuns keeps decisions and cache; deliverables only on request', async () => {
  const base = await mkdtemp(join(tmpdir(), 'mx-clear-'))
  try {
    const state = join(base, 'state'); const root = join(base, 'out')
    await mkdir(state, { recursive: true })
    await writeFile(join(state, 'roots.json'), JSON.stringify([root]))
    const rec = await openRecords(join(root, '_records'))
    for (const id of ['r1', 'r2']) {
      rec.putRun({ id, status: 'completed', startedAt: `2026-01-0${id.at(-1)}`, outputRoot: root, output: join(root, 'output', 'in'), totals: {} })
      rec.putShard(id, { shard: 0, status: 'done' })
      await mkdir(join(root, '_records', 'runs', id), { recursive: true })
      await writeFile(join(root, '_records', 'runs', id, 'report.md'), 'x')
    }
    rec.decide({ kind: 'value', target: 'v1', decision: 'accept', runId: 'r1' })
    rec.cachePut('k', 'm', 'reply')
    await mkdir(join(root, 'output', 'in'), { recursive: true })
    rec.close()

    const s = createService({ stateDir: state, config: {} })
    assert.equal((await s.list()).runs.length, 2)
    const a = await s.clearRuns({})
    assert.equal(a.removed, 2); assert.deepEqual(a.failed, [])
    assert.equal((await s.list()).runs.length, 0)
    assert.deepEqual(await readdir(join(root, '_records', 'runs')), [])
    assert.ok(existsSync(join(root, 'output', 'in')), 'deliverable kept by default')
    const rec2 = await openRecords(join(root, '_records'))
    assert.equal(rec2.decisions().size, 1, 'decisions kept')
    assert.equal(rec2.cacheGet('k'), 'reply', 'model cache kept')
    assert.equal(rec2.shards('r1').length, 0)
    // with deliverable
    rec2.putRun({ id: 'r3', status: 'completed', startedAt: '2026-01-03', outputRoot: root, output: join(root, 'output', 'in'), totals: {} })
    rec2.close()
    const s2 = createService({ stateDir: state, config: {} })
    const b = await s2.clearRuns({ deliverable: true })
    assert.equal(b.removed, 1); assert.equal(b.outputsRemoved, 1)
    assert.ok(!existsSync(join(root, 'output', 'in')))
  } finally { await rm(base, { recursive: true, force: true }) }
})
