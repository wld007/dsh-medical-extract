/**
 * 工作线程：执行分片提取与汇总任务，完成后回报结果。每个线程自己开记录库连接（WAL）。
 *
 *   → { type: 'task', task: { kind: 'shard' | 'bucketize' | 'aggregate', … } }
 *   → { type: 'cancel' }
 *   ← { type: 'ready' } / { type: 'progress', docs } / { type: 'done', id, result } / { type: 'error', id, error }
 */
import { parentPort, workerData } from 'node:worker_threads'
import { openRecords } from '../records/store.js'
import { compileTemplate } from '../template/load.js'
import { processShard } from './shard.js'
import { aggregateBucket, bucketizePart } from './rollup.js'

let cancelled = false
let store = null
const tplCache = new Map()
const tplOf = (raw, priorities) => {
  const key = JSON.stringify([raw.id, raw.version, priorities])
  if (!tplCache.has(key)) tplCache.set(key, compileTemplate(raw, { priorities }))
  return tplCache.get(key)
}

parentPort.on('message', async (msg) => {
  if (msg.type === 'cancel') { cancelled = true; return }
  if (msg.type !== 'task') return
  const { task } = msg
  let pending = 0
  const flush = () => { if (pending) { parentPort.postMessage({ type: 'progress', docs: pending }); pending = 0 } }
  const timer = setInterval(flush, 500)
  try {
    let result
    if (task.kind === 'shard') {
      store ??= await openRecords(workerData.recordsDir)
      result = await processShard(task, { store, modelGate: workerData.modelGate, isCancelled: () => cancelled, onProgress: (n) => { pending += n } })
    } else if (task.kind === 'bucketize') {
      result = await bucketizePart(task)
    } else if (task.kind === 'aggregate') {
      result = await aggregateBucket({ ...task, tpl: tplOf(task.template, task.priorities) })
    } else throw new Error(`unknown task ${task.kind}`)
    flush()
    parentPort.postMessage({ type: 'done', id: task.id, result })
  } catch (error) {
    flush()
    parentPort.postMessage({ type: 'error', id: task.id, error: String(error?.stack ?? error) })
  } finally {
    clearInterval(timer)
  }
})
parentPort.postMessage({ type: 'ready' })
