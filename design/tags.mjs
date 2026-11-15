// 产线标签的几种表现方式（效果图）：把 client.js 里的 PlantScene 原样拿来，只替换“标签卡”一段，渲染成静态 SVG 再截图。
//   node design/tags.mjs   → design/tags-<方案>.png
// 不改 client.js；假数据只用虚构数字。
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SRC = fs.readFileSync(path.join(HERE, '..', 'client.js'), 'utf8')

const START = '      // 标签卡\n'
const END = '      for (const [i, j, a, b, z] of [[-60'
const i0 = SRC.indexOf(START); const i1 = SRC.indexOf(END)
const patchable = i0 >= 0 && i1 >= 0 // client.js 已改成方案 1 后，只能出“现状”一张

/* ---------------------------------------------------------------- 三种方案 */
const COMMON = `
      const tw = (s, fs, mono) => [...String(s)].reduce((w, ch) => w + (/[\\u2E80-\\uFFFF]/.test(ch) ? fs : fs * (mono ? 0.62 : 0.56)), 0)
      const gateRowOf = (s) => s.rows.find((r) => /^验收/.test(r[0]))
      const gateCol = { ok: P.ok, warn: P.bad, '': P.ink3 }
`

const VARIANTS = {
  // 0：现状
  now: null,

  // 1：屋顶胶囊，不用引线；只放一个关键数，验收门是一个色点；选中＝实心
  pill: COMMON + `
      const anchor = (k) => (k === 0 ? iso(42, 58, 122) : k === 6 ? iso(yard + 75, 40, 66) : k === 7 ? iso(TW.i + TW.a / 2, TW.j + TW.b / 2, TW.hh + 46) : iso(bay0(k) + bw / 2, D / 2, H + 36))
      stations.forEach((s, k) => {
        const [x, y] = anchor(k)
        const on = k === sel; const hotS = s.state === 'hold' || s.state === 'run'
        const g = gateRowOf(s)
        const wNo = tw(s.no, 9, true); const wBig = tw(s.big, 12.5, true); const wU = s.unit ? tw(s.unit, 9.5) + 3 : 0
        const w = 9 + wNo + 6 + wBig + wU + (g ? 13 : 0) + 9; const hh = 21
        const x0 = x - w / 2; const y0 = y - hh - 5
        const ink = on ? '#fff' : P.ink; const sub = on ? 'rgba(255,255,255,.75)' : P.ink3
        bb.push([x0, y0], [x0 + w, y])
        els.push(h('g', { key: 'pill' + k, ...click(k) },
          h('title', {}, s.no + ' ' + s.nm + '：' + s.sub),
          h('rect', { x: x0, y: y0, width: w, height: hh, rx: hh / 2, fill: on ? A : C.card, stroke: hotS || on ? A : C.cardLine, strokeWidth: hotS ? 1.4 : 1 }),
          h('path', { d: 'M' + (x - 4) + ' ' + (y0 + hh - 0.5) + 'L' + x + ' ' + (y - 1) + 'L' + (x + 4) + ' ' + (y0 + hh - 0.5) + 'Z', fill: on ? A : C.card, stroke: hotS || on ? A : C.cardLine, strokeWidth: 1 }),
          h('rect', { x: x - 4.6, y: y0 + hh - 2, width: 9.2, height: 2.4, fill: on ? A : C.card }),
          h('text', { x: x0 + 9, y: y0 + 14.5, fill: on ? '#fff' : hotS ? A : P.ink3, fontSize: 9, fontFamily: MONO, fontWeight: 600 }, s.no,
            h('tspan', { dx: 6, fill: ink, fontSize: 12.5, fontWeight: 700 }, s.big),
            s.unit ? h('tspan', { dx: 3, fill: sub, fontSize: 9.5, fontWeight: 400, fontFamily: 'inherit' }, s.unit) : null),
          g ? h('circle', { cx: x0 + w - 12, cy: y0 + hh / 2, r: 3.6, fill: gateCol[g[2]] ?? P.ink3, stroke: on ? '#fff' : 'none', strokeWidth: 1 }) : null))
      })
`,

  // 2：场景下方一条阶段状态条，和建筑左右对齐；没有引线
  strip: COMMON + `
      const cx = (k) => (k === 0 ? iso(42, 58)[0] : k === 6 ? iso(yard + 75, 70)[0] : k === 7 ? iso(42, 58)[0] - 150 : iso(bay0(k) + bw / 2, D / 2)[0])
      const order = [7, 0, 1, 2, 3, 4, 5, 6]
      const cw = 128; const ch = 50; const yS = 392
      const stCol = { run: A, hold: P.warn, done: P.ok, part: P.warn, idle: P.ink3 }
      els.push(h('rect', { key: 'stripbg', x: cx(7) - cw / 2 - 10, y: yS - 10, width: cx(6) - cx(7) + cw + 20, height: ch + 20, rx: 6, fill: C.card, stroke: C.cardLine }))
      order.forEach((k, q) => {
        const s = stations[k]; const x = cx(k) - cw / 2; const on = k === sel
        const g = gateRowOf(s)
        if (q) els.push(h('text', { key: 'chev' + q, x: (cx(order[q - 1]) + cw / 2 + x) / 2, y: yS + ch / 2 + 4, textAnchor: 'middle', fill: P.ink3, fontSize: 12 }, '›'))
        els.push(h('g', { key: 'cell' + k, ...click(k) },
          h('title', {}, s.sub),
          h('rect', { x, y: yS, width: cw, height: ch, rx: 4, fill: on ? shade(A, 0.88) : 'transparent', stroke: on ? A : 'none' }),
          h('rect', { x: x + 8, y: yS + 7, width: 3, height: ch - 14, rx: 1.5, fill: stCol[s.state] ?? P.ink3 }),
          h('text', { x: x + 18, y: yS + 18, fill: P.ink3, fontSize: 9, fontFamily: MONO }, s.no, h('tspan', { dx: 5, fill: P.ink2, fontFamily: 'inherit', fontSize: 10 }, s.nm)),
          h('text', { x: x + 18, y: yS + 39, fill: P.ink, fontSize: 16, fontWeight: 700, fontFamily: MONO }, s.big, s.unit ? h('tspan', { dx: 4, fill: P.ink3, fontSize: 9.5, fontWeight: 400, fontFamily: 'inherit' }, s.unit) : null),
          g ? h('text', { x: x + cw - 8, y: yS + 39, textAnchor: 'end', fill: gateCol[g[2]] ?? P.ink3, fontSize: 9.5, fontFamily: MONO }, g[0].replace('验收', '') + ' ' + (g[2] === 'ok' ? '过' : g[2] === 'warn' ? '未过' : '—')) : null))
      })
      bb.push([cx(7) - cw / 2 - 14, yS + ch + 14], [cx(6) + cw / 2 + 14, yS + ch + 14])
`,

  // 3：数字做成立在屋檐上的招牌，贴着建筑正立面的透视
  sign: COMMON + `
      // 招牌立在 j＝jj 的平面上，从 (ia, z0) 到 (ib, z0 + 17)；文字用同一平面的仿射矩阵
      const sign = (k, ia, ib, jj, z0) => {
        const s = stations[k]; const on = k === sel; const hotS = s.state === 'hold' || s.state === 'run'
        const g = gateRowOf(s); const sh = 25
        const fill = on || hotS ? A : C.card; const ink = on || hotS ? '#fff' : P.ink; const sub = on || hotS ? 'rgba(255,255,255,.78)' : P.ink3
        const parts = []
        // 两根支脚 + 板子 + 顶面
        for (const li of [ia + 6, ib - 6]) { const a = iso(li, jj, z0 - 6); const b = iso(li, jj, z0); parts.push(h('line', { key: 'leg' + li, x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.right, strokeWidth: 1.6 })) }
        parts.push(h('polygon', { key: 'top', points: pts([iso(ia, jj - 3, z0 + sh), iso(ib, jj - 3, z0 + sh), iso(ib, jj, z0 + sh), iso(ia, jj, z0 + sh)]), fill: on || hotS ? shade(A, 0.3) : C.top2 }))
        parts.push(h('polygon', { key: 'side', points: pts([iso(ib, jj - 3, z0), iso(ib, jj, z0), iso(ib, jj, z0 + sh), iso(ib, jj - 3, z0 + sh)]), fill: on || hotS ? shade(A, -0.3) : C.right2 }))
        parts.push(h('polygon', { key: 'face', points: pts([iso(ia, jj, z0), iso(ib, jj, z0), iso(ib, jj, z0 + sh), iso(ia, jj, z0 + sh)]), fill, stroke: on || hotS ? A : C.cardLine, strokeWidth: 0.8 }))
        const [ex, ey] = iso(ia + 5, jj, z0 + sh)
        parts.push(h('g', { key: 'txt', transform: 'matrix(' + IX[0] + ' ' + IX[1] + ' 0 1 ' + ex.toFixed(1) + ' ' + ey.toFixed(1) + ')' },
          h('text', { x: 0, y: 9, fill: sub, fontSize: 7.5, fontFamily: MONO, fontWeight: 600 }, s.no, s.unit ? h('tspan', { dx: 3, fontWeight: 400, fontFamily: 'inherit' }, s.unit) : null),
          h('text', { x: 0, y: 21.5, fill: ink, fontSize: 13, fontFamily: MONO, fontWeight: 700 }, s.big)))
        if (g) { const d = iso(ib - 6, jj, z0 + 8); parts.push(h('circle', { key: 'gd', cx: d[0], cy: d[1], r: 3.2, fill: gateCol[g[2]] ?? P.ink3, stroke: on || hotS ? '#fff' : 'none', strokeWidth: 1 })) }
        els.push(h('g', { key: 'sign' + k, ...click(k) }, h('title', {}, s.no + ' ' + s.nm + '：' + s.sub), parts))
        bb.push(iso(ia, jj, z0 + sh + 2))
      }
      for (let k = 1; k <= 5; k++) sign(k, bay0(k) + 2, bay0(k) + bw - 2, D - 3, H + 7)
      sign(0, 4, 80, 105, 96)
      sign(6, yard + 30, yard + 110, 12, 46)
      sign(7, TW.i - 4, TW.i + TW.a + 4, TW.j + TW.b + 2, TW.hh - 30)
`,
}

const TITLE = { now: '当前 client.js', pill: '方案 1：屋顶胶囊（无引线）', strip: '方案 2：底部阶段状态条', sign: '方案 3：屋檐招牌（数字贴立面）' }

/* ---------------------------------------------------------------- 字符串版 React */
const RAW = new Set(['viewBox', 'preserveAspectRatio', 'refX', 'refY', 'markerWidth', 'markerHeight', 'stdDeviation', 'maskUnits'])
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
function h(tag, attrs, ...kids) {
  if (typeof tag === 'function') return tag({ ...(attrs || {}), children: kids })
  let s = '<' + tag
  for (let [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false || k === 'key' || typeof v === 'function') continue
    const name = k === 'className' ? 'class' : RAW.has(k) ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
    if (k === 'style' && typeof v === 'object') v = Object.entries(v).map(([a, b]) => a.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ':' + (typeof b === 'number' ? b + 'px' : b)).join(';')
    s += ` ${name}="${String(v).replace(/"/g, '&quot;')}"`
  }
  const inner = kids.flat(Infinity).filter((x) => x != null && x !== false).map((x) => (typeof x === 'string' && !x.startsWith('<') ? esc(x) : typeof x === 'number' ? String(x) : x)).join('')
  return s + '>' + inner + `</${tag}>`
}
const FakeReact = {
  createElement: h,
  createContext: (v) => ({ v }),
  useContext: (c) => c.v,
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {}, useMemo: (f) => f(), useCallback: (f) => f,
}

/* ---------------------------------------------------------------- 假批次（虚构数字） */
const run = {
  status: 'completed', input: 'demo', mode: 'hybrid',
  template: { id: 'mdd', name: '抑郁障碍', version: '0.1.0', fields: 78 },
  shards: { done: 94, total: 94, running: 0 },
  totals: { documents: 7962, recalled: 165, values: 178, quoteFail: 0, invalid: 0, outOfRange: 0, conflicts: 0, patients: 7946, review: 18, calls: 108, cached: 8, byMethod: { rule: 130, model: 48 } },
  byField: Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['f' + i, 1])),
  gates: [
    { id: '①', label: '验收①', pass: true, detail: '' }, { id: '②', label: '验收②', pass: true, detail: '' },
    { id: '③', label: '验收③', pass: true, detail: '' }, { id: '④', label: '验收④', pass: false, detail: '一致率未达阈值' },
  ],
  model: { model: 'local', verifyModel: 'local-verify' },
  output: '/demo/out',
}

for (const [name, code] of Object.entries(process.env.ONLY ? { [process.env.ONLY]: VARIANTS[process.env.ONLY] } : VARIANTS)) {
  if (code != null && !patchable) continue
  let src = code == null ? SRC : SRC.slice(0, i0) + code + SRC.slice(i1)
  src = src.replace('const ThemeCtx = React.createContext(PAL.dark)', 'const ThemeCtx = React.createContext(PAL.light)')
  src = src.replace(/return plugin\n  \},\n\}\)\s*$/, 'return { PlantScene, stationsOf }\n  },\n})\n')
  let mod
  const window = { __ModuleLoader__: { load: (m) => { mod = m.factory(() => FakeReact) } } }
  new Function('window', src)(window)
  if (!mod?.PlantScene) throw new Error('补丁没生效')
  const stations = mod.stationsOf(run)
  const svg = mod.PlantScene({ run, stations, sel: 5, onSel: () => {}, goto: () => {} })
  const [, , , vw, vh] = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg).map(Number)
  const W = 1400; const H = Math.ceil((W * vh) / vw) + 44
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fcfbfe;font:13px -apple-system,"PingFang SC",sans-serif;color:#221d33}
h1{font-size:14px;font-weight:600;margin:0;padding:14px 18px 0}svg{display:block;width:${W}px;height:auto}</style>
<h1>${TITLE[name]}</h1>${svg.replace('style="max-height:620px;overflow:hidden"', '')}`
  const file = path.join(HERE, `tags-${name}.html`)
  fs.writeFileSync(file, html)
  const png = path.join(HERE, `tags-${name}.png`)
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', `--window-size=${W},${H}`, `--screenshot=${png}`, 'file://' + file], { stdio: 'ignore' })
  console.log(png, vw.toFixed(0) + '×' + vh.toFixed(0))
}
