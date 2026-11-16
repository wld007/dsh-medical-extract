/**
 * 把 scripts/eval.mjs 的结果画成一页 HTML 报告（自包含，无外部依赖）。
 *
 *   node scripts/eval-report.mjs <评测输出目录> [报告.html]     默认写到 <评测输出目录>/report.html
 *
 * 结论文字按结果自动生成（哪个配置最好、提取模型的影响、主要错误类型……），重跑后不用手改。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { compileTemplate, loadTemplate } from '../lib/template/load.js'
import { DOCS, EVAL_FIELDS } from '../test/fixtures/eval-mdd.mjs'

const dir = process.argv[2]
if (!dir) { console.error('用法：node scripts/eval-report.mjs <评测输出目录> [报告.html]'); process.exit(2) }
const outFile = process.argv[3] ?? join(dir, 'report.html')
const R = JSON.parse(await readFile(join(dir, 'results.json'), 'utf8'))
const tpl = compileTemplate(await loadTemplate('mdd'))
const fname = (id) => tpl.byId.get(id)?.name ?? id
const NM = '未提及'
const names = Object.keys(R)
const SHORT = { 'A-only': '单模型 A', 'B-only': '单模型 B', 'AB-default': '双模型 A→B 默认抽样', 'AB-full': '双模型 A→B 全部核验', 'BA-full': '双模型 B→A 全部核验' }
const COLOR = { 'A-only': '#e0a458', 'B-only': '#5fb3a3', 'AB-default': '#b39ddb', 'AB-full': '#7e57c2', 'BA-full': '#4527a0' }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const pct = (x) => (x * 100).toFixed(1)
const modelOf = (n, fb) => R[n]?.label?.match(/^单模型 (.+)$/)?.[1] ?? fb
const models = { A: modelOf('A-only', 'A'), B: modelOf('B-only', 'B') }

const GROUPS = { A: '诊断', C: '症状', D: '自杀', E: '量表', F: '用药', G: '非药物治疗', H: '疗效与不良反应', I: '共病', J: '人口与家族史' }
function prf(cells) {
  let tp = 0; let fp = 0; let req = 0; let reqOk = 0; let ok = 0
  for (const c of cells) {
    const required = !c.gold.includes(NM)
    if (c.ok) ok++
    if (required) { req++; if (c.ok) reqOk++ }
    if (c.pred !== NM) { if (c.ok) tp++; else fp++ }
  }
  const P = tp + fp ? tp / (tp + fp) : 1; const Rr = req ? reqOk / req : 1
  return { P, R: Rr, F1: P + Rr ? 2 * P * Rr / (P + Rr) : 0, acc: ok / (cells.length || 1), errors: cells.length - ok, n: cells.length }
}
const groupOf = (fid) => GROUPS[fid[0]] ?? '其他'

/* ---------- 汇总表与条形图 ---------- */
const maxCalls = Math.max(...names.map((n) => R[n].totals.calls + R[n].totals.cached))
const summaryRows = names.map((n) => {
  const r = R[n]; const a = r.auto; const h = r.withHuman
  const calls = r.totals.calls + r.totals.cached
  return `<tr><td><span class="dot" style="background:${COLOR[n]}"></span>${esc(SHORT[n])}<div class="sub">${esc(r.label)}</div></td>
  <td class="num">${pct(a.acc)}</td><td class="num">${pct(a.P)}</td><td class="num">${pct(a.R)}</td><td class="num big">${pct(a.F1)}</td>
  <td class="num">${a.errors}</td><td class="num">${r.adjudicated}</td><td class="num">${r.resolved}</td><td class="num">${r.open}</td><td class="num">${pct(h.F1)}</td>
  <td><div class="bar"><i style="width:${(calls / maxCalls) * 110}px;background:${COLOR[n]}"></i><b>${calls}</b></div></td></tr>`
}).join('')

const BAR_MIN = 80
const f1Bars = names.map((n) => {
  const a = R[n].auto.F1 * 100; const h = R[n].withHuman.F1 * 100
  const x = (v) => ((v - BAR_MIN) / (100 - BAR_MIN)) * 100
  return `<div class="hrow"><div class="hl">${esc(SHORT[n])}</div><div class="htrack">
    <i class="hum" style="width:${x(h)}%" title="人工判断后 ${h.toFixed(1)}"></i>
    <i style="width:${x(a)}%;background:${COLOR[n]}" title="自动 ${a.toFixed(1)}"></i>
    <span class="hv" style="left:${x(a)}%">${a.toFixed(1)}</span>${h - a > 0.05 ? `<span class="hv hh" style="left:${x(h)}%">${h.toFixed(1)}</span>` : ''}</div></div>`
}).join('')
const ticks = [80, 85, 90, 95, 100].map((t) => `<span style="left:${((t - BAR_MIN) / (100 - BAR_MIN)) * 100}%">${t}</span>`).join('')

/* ---------- 错误构成（堆叠） ---------- */
const maxErr = Math.max(...names.map((n) => R[n].auto.errors))
const errBars = names.map((n) => {
  const a = R[n].auto; const w = (v) => (v / maxErr) * 100
  return `<div class="hrow"><div class="hl">${esc(SHORT[n])}</div><div class="htrack plain">
    <i class="seg spur" style="width:${w(a.spur)}%" title="多提 ${a.spur}">${a.spur || ''}</i><i class="seg miss" style="width:${w(a.miss)}%" title="漏提 ${a.miss}">${a.miss || ''}</i><i class="seg wrong" style="width:${w(a.wrong)}%" title="值错 ${a.wrong}">${a.wrong || ''}</i>
    <span class="tot">${a.errors}</span></div></div>`
}).join('')

/* ---------- 复查：修好 / 改坏 / 转人工 ---------- */
function compare(a, b) {
  const A = R[a].cells; const B = R[b].cells
  let fix = 0; let brk = 0; let oR = 0; let oW = 0
  for (let i = 0; i < A.length; i++) { if (!A[i].ok && B[i].ok) fix++; if (A[i].ok && !B[i].ok) brk++; if (B[i].open) { if (B[i].ok) oR++; else oW++ } }
  return { fix, brk, oR, oW }
}
const pairs = [['A-only', 'AB-full'], ['B-only', 'BA-full'], ['A-only', 'AB-default']].filter(([a, b]) => R[a] && R[b])
const pairCards = pairs.map(([a, b]) => {
  const c = compare(a, b)
  const tot = c.oR + c.oW || 1
  return `<div class="card pc"><div class="pt">${esc(SHORT[a])} <span class="arr">→</span> ${esc(SHORT[b])}</div>
  <div class="kv"><div><b class="good">+${c.fix}</b><span>复查修好</span></div><div><b class="bad">−${c.brk}</b><span>复查改坏</span></div><div><b>${c.oR + c.oW}</b><span>转人工</span></div></div>
  <div class="split"><i class="good" style="width:${(c.oR / tot) * 100}%"></i><i class="bad" style="width:${(c.oW / tot) * 100}%"></i></div>
  <div class="sub">转人工的格子里：当前值已经对 <b>${c.oR}</b>，需要人工改 <b>${c.oW}</b></div></div>`
}).join('')

/* ---------- 按字段组的 F1 热力图 ---------- */
const groupNames = [...new Set(EVAL_FIELDS.map(groupOf))]
const heat = (v) => { const t = Math.max(0, Math.min(1, (v - 0.7) / 0.3)); return `hsl(${Math.round(t * 135)},58%,${44 - t * 6}%)` }
const heatHead = `<tr><th></th>${groupNames.map((g) => `<th>${esc(g)}<div class="sub">${EVAL_FIELDS.filter((f) => groupOf(f) === g).length} 字段</div></th>`).join('')}<th>全部</th></tr>`
const heatRows = names.map((n) => {
  const cells = R[n].cells
  const tds = groupNames.map((g) => { const m = prf(cells.filter((c) => groupOf(c.field) === g)); return `<td style="background:${heat(m.F1)}" title="P ${pct(m.P)} · R ${pct(m.R)} · 错 ${m.errors}/${m.n}">${pct(m.F1)}<div class="sub">错 ${m.errors}</div></td>` }).join('')
  const all = prf(cells)
  return `<tr><th class="rl">${esc(SHORT[n])}</th>${tds}<td style="background:${heat(all.F1)}">${pct(all.F1)}</td></tr>`
}).join('')

/* ---------- 逐字段 ---------- */
const fieldRows = EVAL_FIELDS.map((fid) => {
  const ms = names.map((n) => prf(R[n].cells.filter((c) => c.field === fid)))
  const any = ms.some((m) => m.errors)
  return { fid, ms, any, worst: Math.max(...ms.map((m) => m.errors)) }
}).sort((a, b) => b.worst - a.worst || a.fid.localeCompare(b.fid))
const fieldTable = fieldRows.map(({ fid, ms }) => `<tr><td class="mono">${fid}</td><td>${esc(fname(fid))}</td><td class="sub">${esc(groupOf(fid))}</td>${ms.map((m) => `<td class="ec ${m.errors ? '' : 'zero'}"><span style="--w:${Math.min(100, m.errors * 12)}%">${m.errors}</span></td>`).join('')}</tr>`).join('')

/* ---------- 错误格子明细 ---------- */
const docById = new Map(DOCS.map((d) => [d.id, d]))
const errCells = []
const base = R[names[0]].cells
for (let i = 0; i < base.length; i++) {
  const per = names.map((n) => R[n].cells[i])
  if (per.every((c) => c.ok)) continue
  errCells.push({ doc: base[i].doc, field: base[i].field, gold: base[i].gold, per, nWrong: per.filter((c) => !c.ok).length })
}
errCells.sort((a, b) => b.nWrong - a.nWrong || a.doc.localeCompare(b.doc) || a.field.localeCompare(b.field))
const errRows = errCells.map((e) => {
  const d = docById.get(e.doc)
  const kind = e.nWrong === names.length ? 'all' : e.nWrong === 1 ? 'one' : 'some'
  return `<tr class="er k-${kind}" data-doc="${e.doc}" data-n="${e.nWrong}"><td class="mono"><a href="#doc-${e.doc}">${e.doc}</a><div class="sub">${esc(d.doc_type)}</div></td><td><span class="mono">${e.field}</span> ${esc(fname(e.field))}</td>
  <td class="gold">${e.gold.map(esc).join('<span class="or">或</span>')}</td>
  ${e.per.map((c) => `<td class="${c.ok ? 'ok' : 'no'}${c.open ? ' open' : ''}" title="${c.open ? '转人工' : ''}">${esc(c.pred)}${c.open ? '<sup>人</sup>' : ''}</td>`).join('')}</tr>`
}).join('')
const nAll = errCells.filter((e) => e.nWrong === names.length).length

/* ---------- 文书原文 ---------- */
const docCards = DOCS.map((d) => {
  const g = Object.entries(d.gold).map(([k, v]) => `<span class="tag"><b>${k}</b> ${esc(fname(k))}：${[].concat(v).map(esc).join(' 或 ')}</span>`).join('')
  return `<details class="doc" id="doc-${d.id}"><summary><span class="mono">${d.id}</span> ${esc(d.patient_id)} · ${esc(d.doc_type)} · ${esc(d.record_time)}</summary><pre>${esc(d.content)}</pre><div class="tags">${g}</div></details>`
}).join('')

const totalCells = base.length
const best = names.reduce((a, b) => (R[b].auto.F1 > R[a].auto.F1 ? b : a))

/* ---------- 关键数字与结论（按结果生成） ---------- */
const singles = names.filter((n) => n.endsWith('-only'))
const fulls = names.filter((n) => n.endsWith('-full'))
const callsOf = (n) => R[n].totals.calls + R[n].totals.cached
const F = (n) => pct(R[n].auto.F1)
const kpiCards = [
  ...singles.map((n) => [F(n), `${SHORT[n]} 的 F1`]),
  [F(best), `最好：${SHORT[best]}（自动）`],
  ...(fulls.length && singles.length ? [[`${(Math.max(...fulls.map(callsOf)) / Math.min(...singles.map(callsOf))).toFixed(1)}×`, '全部核验的模型调用 / 单模型']] : []),
]
const kpis = `<div class="kpis" style="grid-template-columns:repeat(${kpiCards.length},1fr)">${kpiCards.map(([v, l]) => `<div class="card kpi"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>`
const pts = []
const roleText = (n) => { const m = n.match(/^([AB])([AB])-/); return m ? `${m[1]} 提取、${m[2]} 核验` : SHORT[n] }
const singleOf = (n) => `${n[0]}-only`
if (fulls.length) {
  const bf = fulls.reduce((a, b) => (R[b].auto.F1 > R[a].auto.F1 ? b : a))
  const c = R[singleOf(bf)] ? compare(singleOf(bf), bf) : null
  const tail = c && c.oR + c.oW ? (c.oR >= c.oW ? `转人工的 ${c.oR + c.oW} 个格子里 ${c.oR} 个当前值已经对，人工主要是确认` : `转人工的 ${c.oR + c.oW} 个格子里 ${c.oW} 个当前值是错的，人工要改`) : ''
  const vsSingle = singles.length ? `；最好的单模型是 ${F(singles.reduce((a, b) => (R[b].auto.F1 > R[a].auto.F1 ? b : a)))}` : ''
  pts.push(`<b>全部核验的双模型里，${esc(roleText(bf))}最好</b>：自动 F1 ${F(bf)}，人工判断后 ${pct(R[bf].withHuman.F1)}${vsSingle}。${tail ? `${tail}。` : ''}`)
}
if (singles.length === 2) {
  const [hi, lo] = [...singles].sort((a, b) => R[b].auto.F1 - R[a].auto.F1)
  const dualLoExtract = fulls.find((n) => n[0] === lo[0])
  const er = R[lo].auto; const top = [['多提', er.spur], ['漏提', er.miss], ['值错', er.wrong]].sort((a, b) => b[1] - a[1])[0]
  const beat = dualLoExtract && R[hi].auto.F1 > R[dualLoExtract].auto.F1
  pts.push(`<b>提取模型选哪个影响${beat ? '最大' : '很大'}</b>：单模型 ${hi[0]}（${F(hi)}）比单模型 ${lo[0]}（${F(lo)}）高 ${(R[hi].auto.F1 * 100 - R[lo].auto.F1 * 100).toFixed(1)} 个百分点${beat ? `，甚至比 ${lo[0]} 提取、${hi[0]} 核验的双模型（${F(dualLoExtract)}）还好` : ''}。${lo[0]} 的错误主要是<b>${top[0]}</b>（${top[1]} / ${er.errors}）。`)
}
const dflt = names.find((n) => n.endsWith('-default'))
if (dflt) {
  const ref = R[singleOf(dflt)]
  pts.push(`<b>默认抽样（2%＋每字段至少 2 次）主要是用来测质量的</b>：这里只有 ${DOCS.length} 份文书，保底次数让大量文书都被核验，${F(dflt)} 偏高；到几千万份时约 98% 的文书只有第一遍结果，整体接近提取模型的单模型水平${ref ? `（这里是 ${pct(ref.auto.F1)}）` : ''}。`)
}
if (nAll) pts.push(`<b>所有配置都错的有 ${nAll} 个格子</b>，往往是字段定义没写清，或者模型普遍理解偏了。看下面"所有配置都错"的筛选，多数可以通过改模板里的定义、算／不算的写法来修。`)
const conclusions = pts.length ? `<div class="callout"><b>结论</b><ul>${pts.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>病历文书提取 · 单模型与双模型评测</title>
<style>
:root{--bg:#f7f6fb;--card:#fff;--ink:#22202b;--mute:#6f6a80;--line:#e6e3ef;--accent:#6c4fd1;--good:#2e9e6e;--bad:#d4554a;--warn:#e0a458}
@media (prefers-color-scheme:dark){:root{--bg:#131219;--card:#1c1a25;--ink:#ece9f5;--mute:#a19bb5;--line:#2d2a3a;--accent:#a990ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 -apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 24px 80px}
h1{font-size:26px;margin:0 0 6px}h2{font-size:18px;margin:40px 0 12px;padding-left:10px;border-left:4px solid var(--accent)}
.lead{color:var(--mute);margin:0 0 24px}.sub{color:var(--mute);font-size:12px;font-weight:400}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi b{display:block;font-size:28px;line-height:1.2}.kpi span{color:var(--mute);font-size:12px}
.callout{border-left:4px solid var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--card));padding:14px 18px;border-radius:8px;margin:16px 0}
.callout ul{margin:6px 0 0;padding-left:20px}
table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-size:12px;color:var(--mute);font-weight:600;white-space:nowrap}
.num{text-align:right;font-variant-numeric:tabular-nums}.big{font-weight:700;font-size:16px}.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}
.dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}
.bar{display:flex;align-items:center;gap:6px;min-width:150px}.bar i{display:block;height:14px;border-radius:4px}.bar b{font-size:12px;font-weight:600}
.hrow{display:flex;align-items:center;gap:12px;margin:10px 0}.hl{width:170px;flex:none;font-size:13px}
.htrack{position:relative;flex:1;height:26px;background:var(--line);border-radius:6px}.htrack i{position:absolute;left:0;top:0;bottom:0;border-radius:6px}
.htrack i.hum{background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--accent) 30%,transparent) 0 6px,transparent 6px 12px)}
.hv{position:absolute;top:3px;transform:translateX(-100%);padding-right:6px;color:#fff;font-weight:700;font-size:12px}.hv.hh{color:var(--ink);transform:none;padding-left:6px;font-weight:500}
.axis{position:relative;height:18px;margin-left:182px;color:var(--mute);font-size:11px}.axis span{position:absolute;transform:translateX(-50%)}
.htrack.plain{display:flex;background:none}.seg{position:static!important;height:26px;border-radius:0!important;color:#fff;font-size:12px;text-align:center;line-height:26px;font-style:normal}
.seg.spur{background:var(--bad)}.seg.miss{background:var(--warn)}.seg.wrong{background:#8d6e63}.tot{margin-left:8px;line-height:26px;font-weight:700}
.legend{display:flex;gap:16px;font-size:12px;color:var(--mute);margin-top:8px}.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:4px;vertical-align:-2px}
.pcs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.pt{font-weight:600;margin-bottom:10px}.arr{color:var(--accent)}
.kv{display:flex;gap:18px;margin-bottom:10px}.kv b{display:block;font-size:24px}.kv span{font-size:12px;color:var(--mute)}.good{color:var(--good)}.bad{color:var(--bad)}
.split{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--line);margin-bottom:6px}.split i.good{background:var(--good)}.split i.bad{background:var(--bad)}
.heat td{color:#fff;text-align:center;font-weight:700;border:2px solid var(--card)}.heat td .sub{color:rgba(255,255,255,.8)}.heat th{text-align:center}.heat th.rl{text-align:left;color:var(--ink);font-size:13px}
.ec span{display:inline-block;width:80px;padding:0 6px;border-radius:4px;background:linear-gradient(90deg,color-mix(in srgb,var(--bad) 45%,transparent) var(--w),transparent var(--w))}.ec.zero{color:var(--mute)}
.er td.ok{color:var(--good)}.er td.no{color:var(--bad);font-weight:600}.er td.open{background:color-mix(in srgb,var(--warn) 14%,transparent)}.er sup{font-size:10px;color:var(--warn);margin-left:2px}
.gold{font-weight:600}.or{color:var(--mute);font-weight:400;margin:0 4px;font-size:12px}
.filters{display:flex;gap:8px;margin:0 0 10px}.filters button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:4px 12px;cursor:pointer;font:inherit;font-size:12px}.filters button.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.scroll{max-height:640px;overflow:auto}.scroll thead th{position:sticky;top:0;background:var(--card);z-index:1}
details.doc{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:8px 0;padding:10px 14px}details.doc summary{cursor:pointer}
details.doc pre{white-space:pre-wrap;font:13px/1.7 inherit;font-family:inherit;background:color-mix(in srgb,var(--accent) 5%,transparent);padding:10px 12px;border-radius:8px}
details.doc:target{outline:2px solid var(--accent)}.tags{display:flex;flex-wrap:wrap;gap:6px}.tag{font-size:12px;border:1px solid var(--line);border-radius:6px;padding:2px 8px}
.meth li{margin:4px 0}
</style></head><body><main>
<h1>病历文书提取 · 单模型与双模型评测</h1>
<p class="lead">MDD 模板 · ${DOCS.length} 份虚构文书（${new Set(DOCS.map((d) => d.patient_id)).size} 位虚构病人）× ${EVAL_FIELDS.length} 个字段 = ${totalCells} 个文书级结论 · 模型 A＝${esc(models.A)}，模型 B＝${esc(models.B)} · 温度 0</p>

${kpis}

${conclusions}

<h2>总览</h2>
<div class="card"><table><thead><tr><th>配置</th><th class="num">准确率</th><th class="num">精确率</th><th class="num">召回率</th><th class="num">F1</th><th class="num">错</th><th class="num">复查</th><th class="num">自动一致</th><th class="num">转人工</th><th class="num">人工后 F1</th><th>模型调用</th></tr></thead><tbody>${summaryRows}</tbody></table>
<p class="sub">准确率按全部 ${totalCells} 个格子算（含两边都未提及）；精确率＝有值的结论里对的比例；召回率＝金标准必须有值的格子里答对的比例。"人工后"假设转人工的项都判对，是上限。</p></div>

<h2>F1：自动 vs 人工判断后</h2>
<div class="card">${f1Bars}<div class="axis">${ticks}</div>
<div class="legend"><span><i style="background:var(--accent)"></i>自动（实色）</span><span><i style="background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--accent) 40%,transparent) 0 3px,transparent 3px 6px)"></i>转人工的项判对后（斜纹）</span><span>横轴从 80 起</span></div></div>

<h2>错误构成</h2>
<div class="card">${errBars}
<div class="legend"><span><i style="background:var(--bad)"></i>多提（金标准未提及，却给了值）</span><span><i style="background:var(--warn)"></i>漏提</span><span><i style="background:#8d6e63"></i>值错</span></div></div>

<h2>复查的作用</h2>
<div class="pcs">${pairCards}</div>

<h2>按字段组的 F1</h2>
<div class="card"><table class="heat">${heatHead}${heatRows}</table><p class="sub">悬停看精确率、召回率；颜色 70→100 由红到绿。</p></div>

<h2>逐字段错误数</h2>
<div class="card scroll"><table><thead><tr><th>字段</th><th>名称</th><th>组</th>${names.map((n) => `<th class="num">${esc(SHORT[n])}</th>`).join('')}</tr></thead><tbody>${fieldTable}</tbody></table></div>

<h2>出错的格子（${errCells.length}）</h2>
<div class="filters"><button class="on" data-f="all">全部</button><button data-f="k-all">所有配置都错（${nAll}）</button><button data-f="k-some">部分配置错</button><button data-f="k-one">只有一个配置错</button></div>
<div class="card scroll"><table id="errs"><thead><tr><th>文书</th><th>字段</th><th>金标准</th>${names.map((n) => `<th>${esc(SHORT[n])}</th>`).join('')}</tr></thead><tbody>${errRows}</tbody></table>
<p class="sub">绿＝对，红＝错；黄底<sup>人</sup>＝转了人工。点文书编号看原文。</p></div>

<h2>评测文书与金标准</h2>
${docCards}

<h2>方法</h2>
<div class="card"><ul class="meth">
<li>文书和病人全部虚构（<span class="mono">test/fixtures/eval-mdd.mjs</span>），覆盖否认、既往、家族、计划（建议、拟、必要时、若无效）、商品名、多次评分、换药原因、自伤与自杀、出院时已消失的症状。</li>
<li>每个配置都是一个完整批次（hybrid 模式：模型通读＋规则对照），结论按插件的文书级结论比（presence：有／无／可疑／未提及；列表：各项集合）。gold 里一格有两种合理读法的都算对。</li>
<li>各配置共用模型缓存：同一模型第一遍的回答完全一样，差别只来自核验与复查。单模型配置里，规则对照不一致的项由同一模型复查 1 轮。</li>
<li>第一轮跑完后按字段定义复核了出错格子的标注，5 处补了第二种合理读法，没有改主答案。</li>
<li>局限：样本小（${totalCells} 个格子）、单一病种、一人标注；相差 1 个百分点左右的配置不能算有差别。</li>
</ul></div>
</main>
<script>
document.querySelectorAll('.filters button').forEach((b)=>b.onclick=()=>{document.querySelectorAll('.filters button').forEach((x)=>x.classList.toggle('on',x===b));const f=b.dataset.f;document.querySelectorAll('#errs tbody tr').forEach((tr)=>{tr.style.display=f==='all'||tr.classList.contains(f)?'':'none'})})
document.querySelectorAll('a[href^="#doc-"]').forEach((a)=>a.onclick=()=>{const d=document.querySelector(a.getAttribute('href'));if(d)d.open=true})
</script></body></html>`
await writeFile(outFile, html)
console.log(outFile)
