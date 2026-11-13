/**
 * Host half of the 病历定向抽取 bundle.
 *
 * Registers agent tools, the /extract command and one authenticated browser RPC
 * channel. Every caller shares the same service.
 */
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createService, SAVABLE } from './lib/service.js'

export const name = 'medical-extract'
export const inject = ['tools']

const CHANNEL = '/medical-extract'
const ENTRY_ID = 'medical-extract'
const VERSION = (() => { try { return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version } catch { return null } })()
const DATA_BOUNDARY = '病历内容只发往用户在插件设置中配置的模型端点（通常为本机或内网）；未配置模型时只在本机用规则处理。'

export function apply(ctx, config = {}) {
  const workingDirectory = ctx.get('workingDirectory')
  const defaultDirectory = workingDirectory?.defaultDirectory ?? process.cwd()
  const stateDir = process.env.DSH_PROFILE_DIR
    ? join(process.env.DSH_PROFILE_DIR, 'plugin-data', 'medical-extract')
    : join(homedir(), '.dsh', 'plugin-data', 'medical-extract')
  const service = createService({ config, defaultDirectory, stateDir })
  if (typeof ctx.effect === 'function') ctx.effect(() => () => service.dispose(), 'medical-extract: cancel running batch')

  ctx.tools.register(tool({
    name: 'extract_start',
    description: `dsh-medical-extract 插件（病历定向抽取）：按抽取模板（字段清单，如自带的 mdd 样例）从病历文书里抽取内容，每个值带逐字原文引语与位置。输入可以是区域平台导出（p_doc_*.json，一位或多位病人）或通用文件（json／ndjson／jsonl／csv／tsv／txt／md，每行或每个文件一份文书），可到千万份文书：分片并行、可取消、可从取消或失败处继续。规则优先，规则定不了的片段送模型，引语回原文核对；可选核验模型做抽样核验。交付宽表（病人／就诊／文书）、时间点长表、证据长表、冲突表与报告；绝不修改源文件。${DATA_BOUNDARY}立即返回批次 id。`,
    parameters: {
      inputDir: { type: 'string', description: '输入目录或单个文件的绝对路径（或相对工作区）。' },
      template: { type: 'string', description: '模板 id（用 extract_templates 查看）；省略时用设置里的默认模板。' },
      outputRoot: { type: 'string', description: '输出根目录，不能与输入相同、不能放在输入里；省略时用设置里的默认值，再缺省为输入旁的 _medical-extract。' },
      mode: { type: 'string', description: 'hybrid（默认：规则优先，定不了才送模型）、model（召回到的字段都送模型，规则作第二票）或 rules（只跑规则）。' },
      priorities: { type: 'array', description: '只抽这些优先级的字段，如 ["P0"]；省略为全部。' },
      asOf: { type: 'string', description: '截至时刻 "YYYY-MM-DD HH:mm"：只用此刻以前写成的文书；省略则不截断。' },
      resumeFrom: { type: 'string', description: '继续一个已取消或失败的批次（填批次 id）；已完成的分片和模型调用直接复用。填写时可省略其他参数。' },
    },
    execute: async (args, exec) => service.start({ ...args, source: { kind: 'agent', sessionId: sessionIdOf(exec?.agent) } }),
    render: (args, v) => [{ type: 'text', text: `已启动批次 ${v.runId}（模板 ${v.template}，${v.mode}，${v.modelConfigured ? `模型 ${v.model}` : '未配置模型，仅规则'}），输出到 ${v.outputRoot}。用 extract_status 查看进度。` }],
  }))

  ctx.tools.register(tool({
    name: 'extract_status',
    description: '查看病历定向抽取批次的状态、进度（分片、文书、速率）、取值统计、验收门与待复核数。省略 runId 时看最近一批。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取最近一批。' } },
    execute: async (args) => service.status(args.runId),
    render: (args, value) => {
      const run = value.run
      if (!run) return [{ type: 'text', text: '还没有病历定向抽取批次。' }]
      const t = run.totals
      const lines = [
        `批次 ${run.id}: ${run.status}${run.current ? `（${run.current.stage} ${run.current.step}）` : ''}；模板 ${run.template.name} v${run.template.version}；${run.mode}`,
        `分片 ${run.shards.done}/${run.shards.total}；文书 ${t.documents}${run.rate ? `（${run.rate} 份/秒）` : ''}；值 ${t.values}；病人 ${t.patients}；冲突 ${t.conflicts}；待复核 ${t.review}`,
        `模型调用 ${t.calls}（缓存 ${t.cached}，失败 ${t.failed}）；引语对不上丢弃 ${t.quoteFail}；不合类型丢弃 ${t.invalid}`,
      ]
      for (const g of run.gates ?? []) lines.push(`验收门${g.id} ${g.label}：${g.pass ? '通过' : '未过'}（${g.detail}）`)
      for (const w of run.warnings ?? []) lines.push(`提示：${w}`)
      if (run.output) lines.push(`交付：${run.output}`)
      if (run.error) lines.push(`错误：${run.error.split('\n')[0]}`)
      return [{ type: 'text', text: lines.join('\n') }]
    },
  }))

  ctx.tools.register(tool({
    name: 'extract_report',
    description: '读取病历定向抽取批次的 Markdown 报告（汇总、验收门、各字段取值与填充率、抽样一致率）。报告不含病历原文。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取最近一批。' } },
    execute: async (args) => service.report(args.runId),
    render: (args, v) => [{ type: 'text', text: v.markdown.length > 8000 ? `${v.markdown.slice(0, 8000)}\n…（完整内容见 ${v.path}）` : v.markdown }],
  }))

  ctx.tools.register(tool({
    name: 'extract_runs',
    description: '列出最近的病历定向抽取批次（时间、状态、模板、文书数、值数、待复核数）。',
    parameters: {},
    execute: async () => service.list(),
    render: (args, v) => [{ type: 'text', text: v.runs.length ? v.runs.slice(0, 20).map((r) => `${r.id}  ${r.status}  模板 ${r.template}  文书 ${r.documents}  值 ${r.values}  待复核 ${r.review}  ${r.input}`).join('\n') : '还没有批次。' }],
  }))

  ctx.tools.register(tool({
    name: 'extract_cancel',
    description: '取消正在运行的病历定向抽取批次。已完成的分片保留，可用 extract_start 的 resumeFrom 继续。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取消当前批次。' } },
    execute: async (args) => service.cancel(args.runId),
    render: (args, v) => [{ type: 'text', text: v.cancelled ? `已请求取消批次 ${v.runId}。` : `没有取消：${v.reason}` }],
  }))

  ctx.tools.register(tool({
    name: 'extract_templates',
    description: '列出可用的抽取模板（插件自带样例与用户模板库），或给 id 查看一个模板的字段清单。',
    parameters: { id: { type: 'string', description: '模板 id；省略则列出全部。' } },
    execute: async (args) => (args.id ? service.template(args.id) : service.templates()),
    render: (args, v) => {
      if (v.templates) return [{ type: 'text', text: v.templates.map((t) => `${t.id}  ${t.name} v${t.version}  ${t.fields} 字段  ${t.origin === 'builtin' ? '自带' : '用户'}`).join('\n') || '没有模板。' }]
      const t = v.template
      return [{ type: 'text', text: [`${t.id} ${t.name} v${t.version}：${t.description}`, ...t.fields.map((f) => `- ${f.id} ${f.name}（${f.type}，${f.granularity ?? 'encounter'}，${f.priority ?? 'P1'}）：${f.definition}`), ...(v.problems.length ? ['校验问题：', ...v.problems] : [])].join('\n') }]
    },
  }))

  ctx.tools.register(tool({
    name: 'extract_save_template',
    description: '把一个抽取模板（JSON 对象，格式 extract-template/1，见插件 docs/template.md）校验后存入用户模板库；同 id 覆盖。校验不通过时返回问题清单，不保存。',
    parameters: { template: { type: 'object', description: '模板 JSON 对象。', required: true } },
    execute: async (args) => service.saveTemplate(args.template),
    render: (args, v) => [{ type: 'text', text: v.saved ? '已保存。' : `未保存，校验问题：\n- ${v.problems.join('\n- ')}` }],
  }))

  ctx.inject(['commands'], (cmdCtx) => {
    const usage = '用法：/extract <输入目录或文件> [--template 模板id] [--mode hybrid|model|rules] [--out 输出根目录] [--as-of "YYYY-MM-DD HH:mm"]'
    const dispose = cmdCtx.commands.register({
      name: 'extract',
      description: '病历定向抽取：/extract <输入> [--template mdd] [--mode hybrid|model|rules] [--out 输出根目录] [--as-of "YYYY-MM-DD HH:mm"]',
      input: { hint: '输入目录或文件 [--template mdd] [--mode hybrid] [--out 输出根目录]' },
      handler: async (invocation) => {
        const args = String(invocation.rawInput ?? '').match(/"[^"]*"|'[^']*'|\S+/g)?.map((x) => x.replace(/^["']|["']$/g, '')) ?? []
        const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : undefined }
        const outputRoot = flag('--out'); const asOf = flag('--as-of'); const template = flag('--template'); const mode = flag('--mode')
        if (!args[0]) return { kind: 'error', text: usage }
        try {
          const v = await service.start({ inputDir: args[0], outputRoot, asOf, template, mode, source: { kind: 'command', sessionId: sessionIdOf(invocation.agent) } })
          return { kind: 'success', text: `已启动批次 ${v.runId}（模板 ${v.template}，${v.modelConfigured ? `模型 ${v.model}` : '仅规则'}），输出到 ${v.outputRoot}。用 extract_status 或左侧栏「病历定向抽取」查看进度。` }
        } catch (error) {
          return { kind: 'error', text: String(error?.message ?? error) }
        }
      },
    })
    cmdCtx.effect(() => dispose, 'medical-extract: /extract command')
  })

  ctx.inject(['connection', 'webServer'], (rpcCtx) => {
    const route = {
      kind: 'prefix',
      path: CHANNEL,
      handler: async (req, res) => {
        const admission = rpcCtx.connection.admit(req)
        if ('rejection' in admission) { res.writeHead(admission.rejection); res.end(admission.rejection === 401 ? 'unauthorized' : 'forbidden'); return }
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const endpoint = new URL(req.url ?? '/', 'http://x').pathname.slice(CHANNEL.length + 1)
        if (!endpoint) { res.writeHead(404); res.end(); return }
        if (req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') { res.writeHead(415); res.end(); return }
        let body
        try {
          const chunks = []; let size = 0
          for await (const chunk of req) { size += chunk.length; if (size > 4_000_000) throw new Error('request body too large'); chunks.push(chunk) }
          body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        } catch (error) {
          res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(error?.message ?? error) })); return
        }
        const rpcId = typeof body?.rpcId === 'string' ? body.rpcId : 'invalid-request'
        if (body?.type !== 'client-request' || body?.method !== endpoint) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ type: 'server-response', rpcId, result: { ok: false, error: { code: 'bad-request', message: 'invalid client-request envelope', details: {} } } }))
          return
        }
        const result = await dispatch(endpoint, body.payload)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ type: 'server-response', rpcId, result }))
      },
    }
    rpcCtx.effect(() => rpcCtx.webServer.register(route), 'medical-extract: rpc route')
  })

  /** User-only (page): persists settings into the profile's patch layer. */
  async function saveDefaults(patch) {
    if (service.isRunning()) throw new Error('有批次在运行，保存设置会重新加载插件并中断批次；请等它结束')
    const editor = ctx.get('configEditor')
    if (!editor?.edit || !editor?.entries) throw new Error('当前 DSH 不支持从页面保存配置；请在 profile 的 cordis.patch.yml 中修改 medical-extract 的 config')
    const entries = editor.entries()
    let entry
    try { entry = entries.find((item) => item.fiber === ctx.fiber) } catch { /* fall back */ }
    entry ??= entries.find((item) => item.options?.id === ENTRY_ID)
    if (!entry) throw new Error(`找不到插件配置行 ${ENTRY_ID}`)
    const clean = Object.fromEntries(Object.entries(patch ?? {}).filter(([k]) => SAVABLE.includes(k)))
    await editor.edit(entry, (current) => ({ ...current, ...clean }))
    return { saved: true }
  }

  async function dispatch(endpoint, payload) {
    try {
      const r = payload && typeof payload === 'object' ? payload : {}
      const value = await (async () => {
        switch (endpoint) {
          case 'config': return { ...service.configInfo(), version: VERSION }
          case 'list': return service.list()
          case 'status': return service.status(r.runId)
          case 'report': return service.report(r.runId)
          case 'start': return service.start({ inputDir: r.inputDir, outputRoot: r.outputRoot || undefined, template: r.template || undefined, mode: r.mode || undefined, priorities: r.priorities, asOf: r.asOf || undefined, resumeFrom: r.resumeFrom, source: { kind: 'panel' } })
          case 'cancel': return service.cancel(r.runId)
          case 'templates': return service.templates()
          case 'template': return service.template(r.id)
          case 'saveTemplate': return service.saveTemplate(r.template)
          case 'reviewQueue': return service.reviewQueue(r.runId, r)
          case 'decide': return service.decide(r.runId, r)
          case 'table': return service.table(r.runId, r)
          case 'evidence': return service.evidence(r.runId, r)
          case 'document': return service.document(r.runId, r)
          case 'calls': return service.calls(r.runId)
          case 'pickFolder': return { path: await pickFolder() }
          case 'saveDefaults': return saveDefaults(r)
          default: throw Object.assign(new Error(`未知方法: ${endpoint}`), { code: 'unknown-endpoint' })
        }
      })()
      return { ok: true, value: plain(value) }
    } catch (error) {
      return { ok: false, error: { code: error?.code ?? 'medical-extract', message: String(error?.message ?? error), details: {} } }
    }
  }
}

function pickFolder() {
  if (process.platform !== 'darwin') return Promise.reject(Object.assign(new Error('系统文件夹对话框目前只支持 macOS；请直接在输入框里填写完整路径'), { code: 'unsupported' }))
  const script = 'POSIX path of (choose folder with prompt "选择要抽取的病历目录")'
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 10 * 60 * 1000 }, (error, stdout, stderr) => {
      if (error) {
        if (/-128/.test(String(stderr)) || /-128/.test(String(error.message))) resolve(null)
        else reject(new Error(String(stderr || error.message).trim()))
        return
      }
      resolve(String(stdout).trim().replace(/(.)\/$/, '$1') || null)
    })
  })
}

function sessionIdOf(agent) {
  try { const id = agent?.session?.id; return typeof id === 'string' ? id : undefined } catch { return undefined }
}

function tool(def) {
  const properties = {}; const required = []
  for (const [key, spec] of Object.entries(def.parameters ?? {})) {
    properties[key] = { type: spec.type, ...(spec.description ? { description: spec.description } : {}), ...(spec.type === 'array' ? { items: { type: 'string' } } : {}), ...(spec.type === 'object' ? { additionalProperties: true } : {}) }
    if (spec.required) required.push(key)
  }
  return {
    name: def.name,
    description: def.description,
    parameters: { type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render: def.render ?? ((args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]) },
    // 宿主要求输出是无损 JSON：去掉 undefined、SQLite 行的空原型等
    execute: async (...args) => plain(await def.execute(...args)),
  }
}

const plain = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)))
