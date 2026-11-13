import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGunzip } from 'node:zlib'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createService } from '../lib/service.js'
import { parseCsv } from '../lib/util.js'

export const tmp = (p = 'mx-') => mkdtemp(join(tmpdir(), p))

export async function runToEnd(svc, opts, timeoutMs = 120000) {
  const r = await svc.start(opts)
  const t0 = Date.now()
  for (;;) {
    await new Promise((s) => setTimeout(s, 100))
    const { run } = await svc.status(r.runId)
    if (run.status !== 'running') return run
    if (Date.now() - t0 > timeoutMs) throw new Error('timeout')
  }
}

export async function readCsv(file) {
  const rows = parseCsv((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''))
  const head = rows.shift()
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}

export async function readEvidence(dir) {
  const { readdir } = await import('node:fs/promises')
  const out = []
  for (const n of (await readdir(dir)).sort()) {
    const rl = createInterface({ input: createReadStream(join(dir, n)).pipe(createGunzip()) })
    for await (const l of rl) if (l) out.push(JSON.parse(l))
  }
  return out
}

export function service(config = {}, extra = {}) {
  return createService({ config: { workers: 1, ...config }, stateDir: extra.stateDir ?? null, chatImpl: extra.chatImpl ?? null })
}
