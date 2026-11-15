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

/**
 * 测试用的本机假模型端点（OpenAI 兼容，127.0.0.1 随机端口）：通读提示按规则引擎作答——
 * 把原文交给规则路径，规则取到的值连同逐字引语原样回给插件。这样整条模型通路（分派、提示、引语核对、
 * 缓存、多线程）都被走到，答案又是确定的。格式识别提示（表画像）回空对象，表按通用读法读。
 */
let ENDPOINT = null
export async function ruleModelEndpoint() {
  if (ENDPOINT) return ENDPOINT
  const http = await import('node:http')
  const { readdirSync, readFileSync } = await import('node:fs')
  const { compileTemplate } = await import('../lib/template/load.js')
  const { buildLexicon } = await import('../lib/engine/assertion.js')
  const { extractDocument, sentenceAt } = await import('../lib/engine/extract.js')
  const { splitSections } = await import('../lib/source/sections.js')
  const dir = new URL('../templates/', import.meta.url)
  // 栏目限定由插件在引语上核对，假模型像真模型一样不管栏目：编译时去掉字段和规则的栏目限定
  const loose = (t) => ({ ...t, fields: t.fields.map((f) => ({ ...f, ...(f.sources ? { sources: { ...f.sources, sections: [] } } : {}), ...(f.rules ? { rules: f.rules.map(({ sections, ...r }) => r) } : {}) })) })
  const tpls = readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => compileTemplate(loose(JSON.parse(readFileSync(new URL(n, dir), 'utf8')))))
  const lex = new Map(tpls.map((t) => [t, buildLexicon(t.lexicon)]))
  let calls = 0
  // 栏目：每行开头的"标题："（可能连着两层，如列名＋文内标题），取最后一层；没有这样的行就按通用切分
  const sectionsOf = (text) => {
    const out = []; let at = 0
    for (const line of text.split('\n')) {
      const m = line.match(/^(?:[^：:\n，。；,;]{1,20}[：:])+/)
      if (m) { const names = m[0].split(/[：:]/).filter(Boolean); out.push({ name: names.at(-1).trim(), s: at + m[0].length, e: at + line.length }) }
      at += line.length + 1
    }
    return out.length ? out : splitSections(text)
  }
  const answer = (prompt) => {
    if (!prompt.includes('原文：\n<<<')) return '{}' // 格式识别及其复判提示：回空，表按通用读法读
    const fields = JSON.parse(prompt.match(/要抽取的字段：\n(.*?)\n原文：/s)[1])
    const text = prompt.match(/原文：\n<<<\n([\s\S]*)\n>>>\n要求/)[1]
    const [, recordType, written] = prompt.match(/^文书类型：(.*?)；写成时间：([^；\n]*)/)
    const tpl = tpls.find((t) => fields.every((f) => t.byId.get(f.id)?.name === f.name))
    if (!tpl) return '{"values":[]}'
    const doc = { id: 'F', patient: 'P', text, sections: sectionsOf(text), recordType, written: written === '不详' ? null : written }
    const { values } = extractDocument(doc, tpl, { lex: lex.get(tpl), only: new Set(fields.map((f) => f.id)) })
    // 引语像真模型那样带上下文：取值所在的整句（同一个词在文中出现多次时也能定位到这一处）
    const quoteOf = (v) => { const [a, b] = sentenceAt(text, v.s, v.e); return text.slice(a, b).replace(/^\s+|[\s。；;]+$/g, '') || v.quote }
    return JSON.stringify({ values: values.filter((v) => v.value != null).map((v) => ({ field: v.field, value: v.value, assertion: v.assertion, quote: quoteOf(v), variant: v.variant ?? null })) })
  }
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      calls++
      const { messages } = JSON.parse(body)
      let content = '{}'
      try { content = answer(messages.at(-1).content) } catch (e) { if (process.env.FAKE_DEBUG) console.error('fake model: 不认识的提示', String(messages.at(-1).content).slice(0, 300), e) }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  server.unref()
  ENDPOINT = { baseURL: `http://127.0.0.1:${server.address().port}/v1`, model: 'rule-model', get calls() { return calls } }
  return ENDPOINT
}

/** 测试服务：没给 chatImpl、也没给模型端点时，接本机假模型端点 */
export async function service(config = {}, extra = {}) {
  const ep = extra.chatImpl || config.baseURL ? null : await ruleModelEndpoint()
  return createService({ config: { workers: 1, verifyModel: '', ...(ep ? { baseURL: ep.baseURL, model: ep.model } : {}), ...config }, stateDir: extra.stateDir ?? null, chatImpl: extra.chatImpl ?? null })
}
