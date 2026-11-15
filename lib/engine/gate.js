/**
 * 模型并发闸门：两个模型（提取模型、核验模型）各自的并发上限与计数，放在一块 SharedArrayBuffer 里，
 * 所有工作线程和主线程（格式识别）共用；主线程每 2 秒采样，画模型房子的灯、管子和并发曲线。
 *
 * 槽（slot）＝一个模型服务：提取模型是 0；核验模型和提取模型同端点、同模型时也用 0（共用一个上限），否则是 1。
 * 工序（station）：0 格式识别、1 提取、2 核验、3 复判。
 *
 *   Int32   [s]            槽 s 在途
 *           [2+s]          槽 s 排队
 *           [4+s*4+st]     槽 s、工序 st 在途
 *   BigInt64（字节 64 起）[s] 槽 s 完成的调用数   [2+s] 槽 s 的 token 数
 *
 * 线程被强行结束时计数可能不归零——每个批次用新的一块，不影响下一批。
 */
export const GATE_BYTES = 128
export const STATIONS = ['format', 'extract', 'verify', 'adjudicate']
export const STATION_NM = { format: '格式识别', extract: '提取', verify: '核验', adjudicate: '复判' }

const hostOf = (u) => { try { return new URL(u).host } catch { return String(u ?? '') } }

/**
 * 两个模型分到哪个槽、各自的上限。
 * Returns { extract: { slot, max, model, host }, verify: { slot, max, model, host } | null, slots: [{ slot, max, model, host, roles }] }
 */
export function modelSlots(settings = {}, chatImpl = null) {
  const eModel = chatImpl?.extract?.model ?? settings.model
  const eBase = chatImpl?.extract ? 'local' : settings.baseURL
  const extract = { slot: 0, max: Math.max(1, Number(settings.modelConcurrency) || 8), model: eModel, host: chatImpl?.extract ? '测试' : hostOf(eBase) }
  let verify = null
  const vModel = chatImpl?.verify?.model ?? (settings.verifyModel || null)
  if (vModel) {
    const vBase = chatImpl?.verify ? 'local' : settings.verifyBaseURL || settings.baseURL
    const same = vModel === eModel && vBase === eBase
    verify = same ? { ...extract } : { slot: 1, max: Math.max(1, Number(settings.verifyConcurrency) || Number(settings.modelConcurrency) || 8), model: vModel, host: chatImpl?.verify ? '测试' : hostOf(vBase) }
  }
  const slots = [{ ...extract, roles: ['extract'] }]
  if (verify) { if (verify.slot === 0) slots[0].roles.push('verify'); else slots.push({ ...verify, roles: ['verify'] }) }
  return { extract, verify, slots }
}

/** 一个槽、一道工序的限流器：limit(fn)；limit.tally(tokens) 记一次完成的调用 */
export function gateLimiter(sab, { slot, max, station }) {
  const n = new Int32Array(sab, 0, 16)
  const big = new BigInt64Array(sab, 64, 8)
  const st = Math.max(0, STATIONS.indexOf(station))
  const acquire = async () => {
    Atomics.add(n, 2 + slot, 1)
    for (;;) {
      const cur = Atomics.load(n, slot)
      if (cur < max) { if (Atomics.compareExchange(n, slot, cur, cur + 1) === cur) break; continue }
      const r = Atomics.waitAsync(n, slot, cur, 1000)
      if (r.async) await r.value
    }
    Atomics.sub(n, 2 + slot, 1); Atomics.add(n, 4 + slot * 4 + st, 1)
  }
  const release = () => { Atomics.sub(n, 4 + slot * 4 + st, 1); Atomics.sub(n, slot, 1); Atomics.notify(n, slot, 1) }
  const limit = async (fn) => { await acquire(); try { return await fn() } finally { release() } }
  limit.tally = (tokens) => { Atomics.add(big, slot, 1n); Atomics.add(big, 2 + slot, BigInt(Math.max(0, Math.round(tokens || 0)))) }
  return limit
}

/** 把一个模型客户端包上限流（格式识别在主线程里用） */
export function gated(llm, limit) {
  return { ...llm, model: llm.model, chat: (m, o) => limit(async () => { const r = await llm.chat(m, o); limit.tally((r.usage?.prompt_tokens ?? 0) + (r.usage?.completion_tokens ?? 0)); return r }) }
}

/** 读一块计数（主线程采样用） */
export function readGate(sab) {
  const n = new Int32Array(sab, 0, 16); const big = new BigInt64Array(sab, 64, 8)
  const L = (i) => Atomics.load(n, i)
  return {
    inflight: [L(0), L(1)], waiting: [L(2), L(3)],
    done: [Number(Atomics.load(big, 0)), Number(Atomics.load(big, 1))], tokens: [Number(Atomics.load(big, 2)), Number(Atomics.load(big, 3))],
    byStation: [[L(4), L(5), L(6), L(7)], [L(8), L(9), L(10), L(11)]],
  }
}
