/**
 * 录 README 用的页面动画素材：虚构数据（test/fixtures）＋本机假模型端点，在 DSH 之外的预览页上真跑一批，
 * 逐帧截图到 <outDir>/frames，再由 scripts/readme-demo.py 合成动画。不碰任何真实病历。
 *
 *   REACT_UMD_DIR=<含 react/umd 的 node_modules> PLAYWRIGHT_DIR=<含 playwright 的 node_modules> \
 *     node scripts/readme-demo.mjs <outDir> [文书数]
 */
import { spawn } from 'node:child_process'
import http from 'node:http'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmp, ruleModelEndpoint } from '../test/helpers.mjs'
import { synthNdjson } from '../test/fixtures/mdd.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = process.argv[2]
const count = Number(process.argv[3] ?? 1200)
if (!outDir || !process.env.REACT_UMD_DIR || !process.env.PLAYWRIGHT_DIR) { console.error('usage: REACT_UMD_DIR=… PLAYWRIGHT_DIR=… node scripts/readme-demo.mjs <outDir> [文书数]'); process.exit(1) }
const { chromium } = await import(pathToFileURL(join(process.env.PLAYWRIGHT_DIR, 'playwright', 'index.mjs')).href)

const work = await tmp('mx-demo-')
// 按月分成 12 个文件，切成多个数据块，进度才是一格一格走的
const input = join(work, '门诊病历')
await mkdir(input, { recursive: true })
for (let m = 1; m <= 12; m++) await synthNdjson(join(input, `2025-${String(m).padStart(2, '0')}.ndjson`), Math.ceil(count / 12), { seed: 11 + m, patients: 5 })

// 假模型端点前加一点延迟，让进度看得见
const fake = await ruleModelEndpoint()
const delay = Number(process.env.DEMO_DELAY_MS ?? 40)
const proxy = http.createServer((req, res) => {
  const up = http.request(new URL(req.url, fake.baseURL).href, { method: req.method, headers: req.headers }, (r) => { setTimeout(() => { res.writeHead(r.statusCode, r.headers); r.pipe(res) }, delay) })
  req.pipe(up)
})
await new Promise((r) => proxy.listen(0, '127.0.0.1', r))
const proxyURL = `http://127.0.0.1:${proxy.address().port}/v1`

const port = 18000 + Math.floor(Math.random() * 1000)
const config = { baseURL: proxyURL, model: 'extract-model', verifyBaseURL: proxyURL, verifyModel: 'verify-model', modelConcurrency: 6, verifyConcurrency: 6, workers: 3, shardUnits: 1, verifySampleRate: 0.05, autoConcurrency: false, formatRecognition: false }
const server = spawn(process.execPath, [join(root, 'scripts/preview-page.mjs'), join(work, 'state'), String(port)], {
  env: { ...process.env, PREVIEW_CONFIG: JSON.stringify(config), PREVIEW_VERSION: process.env.DEMO_VERSION ?? '0.1.0' }, stdio: ['ignore', 'pipe', 'inherit'],
})
await new Promise((r) => server.stdout.once('data', r))
const base = `http://127.0.0.1:${port}`
const rpc = async (m, p = {}) => (await (await fetch(`${base}/rpc/${m}`, { method: 'POST', body: JSON.stringify(p) })).json()).value

const frames = join(outDir, 'frames')
await rm(frames, { recursive: true, force: true }); await mkdir(frames, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
const timeline = []
let n = 0
const snap = async (ms) => { const f = `f${String(n++).padStart(4, '0')}.png`; await page.screenshot({ path: join(frames, f) }); timeline.push({ f, ms }) }
const tab = async (label) => { await page.locator('button, [role=tab], div, span').filter({ hasText: new RegExp(`^\\s*${label}`) }).last().click({ timeout: 5000 }).catch((e) => console.error('点不到', label, e.message.split('\n')[0])) }

try {
  await page.goto(`${base}/?theme=${process.env.DEMO_THEME ?? 'dark'}`)
  await page.waitForTimeout(1500)
  const { runId } = await rpc('start', { inputDir: input, outputRoot: join(work, 'out'), template: 'mdd' })
  console.log('批次', runId)
  await page.reload(); await page.waitForTimeout(800)
  for (;;) {
    await snap(500)
    const { run } = await rpc('status', { runId })
    if (run.status !== 'running') { console.log('结束', run.status); break }
    await page.waitForTimeout(450)
  }
  await page.waitForTimeout(1200)
  await snap(2600)
  for (const label of (process.env.DEMO_TABS ?? '模板|复核|报告').split('|')) { await tab(label); await page.waitForTimeout(1200); await snap(2400) }
  await tab('◈ 流水线'); await page.waitForTimeout(800); await snap(1500)
} finally {
  await writeFile(join(outDir, 'timeline.json'), JSON.stringify(timeline, null, 1))
  await browser.close(); server.kill(); proxy.close()
  await rm(work, { recursive: true, force: true })
}
console.log(`${timeline.length} 帧 → ${frames}`)
process.exit(0)
