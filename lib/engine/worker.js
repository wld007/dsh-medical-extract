/**
 * 工作线程：接分片任务，处理完回报统计。每个线程自己开记录库连接（模型缓存共用一个 SQLite，WAL）。
 *
 * 消息：
 *   → { type: 'shard', task }       处理一个分片
 *   → { type: 'cancel' }            取消（当前分片丢弃，不算完成）
 *   ← { type: 'progress', docs }    每处理若干份文书
 *   ← { type: 'done', shard, result } / { type: 'error', shard, error }
 */
import { parentPort, workerData } from 'node:worker_threads'
import { openRecords } from '../records/store.js'
import { processShard } from './shard.js'

let cancelled = false
const store = await openRecords(workerData.recordsDir)

parentPort.on('message', async (msg) => {
  if (msg.type === 'cancel') { cancelled = true; return }
  if (msg.type !== 'shard') return
  const { task } = msg
  let pending = 0
  const flush = () => { if (pending) { parentPort.postMessage({ type: 'progress', docs: pending }); pending = 0 } }
  const timer = setInterval(flush, 500)
  try {
    const result = await processShard(task, { store, isCancelled: () => cancelled, onProgress: (n) => { pending += n } })
    flush()
    parentPort.postMessage({ type: 'done', shard: task.shard, result })
  } catch (error) {
    flush()
    parentPort.postMessage({ type: 'error', shard: task.shard, error: String(error?.stack ?? error) })
  } finally {
    clearInterval(timer)
  }
})
parentPort.postMessage({ type: 'ready' })
