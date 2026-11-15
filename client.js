window.__ModuleLoader__.load({
  id: 'dsh-medical-extract',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useCallback } = React
    const CHANNEL = '/medical-extract'
    const PANEL_ID = 'medical-extract'
    const services = { ctx: null }

    /* ------------------------------------------------------------------ rpc */
    function call(endpoint, payload, signal) {
      const connection = services.ctx?.get('connection')
      if (!connection?.rpc) return Promise.reject(new Error('connection unavailable'))
      return connection.rpc.call(CHANNEL, endpoint, payload ?? {}, signal).then((r) => {
        if (!r || r.ok !== true) throw new Error(r?.error?.message ?? 'RPC failed')
        return r.value
      })
    }
    const msg = (e) => String(e?.message ?? e)
    function useAsync(fn, deps) {
      const [state, setState] = useState({ loading: true, value: null, error: null })
      const [tick, setTick] = useState(0)
      useEffect(() => {
        let alive = true
        setState((s) => ({ ...s, loading: true }))
        Promise.resolve().then(fn).then((value) => alive && setState({ loading: false, value, error: null }), (error) => alive && setState({ loading: false, value: null, error: msg(error) }))
        return () => { alive = false }
      }, [...deps, tick])
      return { ...state, reload: () => setTick((n) => n + 1) }
    }

    /* ---------------------------------------------------------------- style */
    // 主题与 2.5D 产线沿用病历事件还原（类名前缀 me- → mx-）
    const CSS = `.mx{--mono:"SF Mono","JetBrains Mono",Menlo,monospace;
  height:100%;box-sizing:border-box;background:var(--bg);color:var(--ink);font:12.5px -apple-system,"PingFang SC","Helvetica Neue",sans-serif;display:flex;flex-direction:column;gap:8px;padding:8px 10px 10px;color-scheme:dark;overflow:hidden}
.mx.mx-dark{--bg:#0c0b12;--panel:#12111b;--panel2:#181624;--panel3:#201d2e;--line:#221f31;--line2:#332e48;--ink:#ebe8f4;--ink2:#a49fba;--ink3:#6b6683;--teal:#8f6ef5;--teal2:#c9b8ff;--tealdim:rgba(143,110,245,.14);--fill:#6d4ae0;--ok:#62c27e;--warn:#f0a63a;--bad:#e5484d;--badink:#ff8a8d;--vio:#4cc9e0;--fact:#6cb4ff;--judge:#f38bc8;--decide:#4fd1a5;--visit:#8681a0;--tick:#514c68;--arrow:#423d58;--cell-ok:#62c27e;--top:#100f18;--st1:#161423;--st2:#100f18;--shade:rgba(12,11,18,.65);--sel:#ebe8f4;color-scheme:dark}
.mx.mx-light{--bg:#f1eff6;--panel:#fcfbfe;--panel2:#f5f3fa;--panel3:#eae6f3;--line:#e2dfec;--line2:#cdc7dc;--ink:#221d33;--ink2:#625b78;--ink3:#958fa9;--teal:#5b3cc4;--teal2:#45289e;--tealdim:rgba(91,60,196,.1);--fill:#5b3cc4;--ok:#2f9a55;--warn:#c27a12;--bad:#cf3a3f;--badink:#b83034;--vio:#0f8ea3;--fact:#1f7fd0;--judge:#c23d8c;--decide:#0f9d78;--visit:#8a84a2;--tick:#b3adc5;--arrow:#bcb6cc;--cell-ok:#3fb27a;--top:#f8f7fb;--st1:#faf9fd;--st2:#f2f0f7;--shade:rgba(241,239,246,.72);--sel:#221d33;color-scheme:light}
.mx *{box-sizing:border-box}
.mx-frame{border:1px solid var(--line);background:var(--panel);border-radius:6px}
.mx-top{display:flex;align-items:center;gap:14px;padding:6px 12px;background:linear-gradient(90deg,color-mix(in srgb,var(--teal) 10%,transparent),transparent 40%),var(--panel);flex:none}
.mx-logo{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#9a7bff,#4a27b0);display:grid;place-items:center;flex:none}
.mx-brand{display:flex;align-items:center;gap:10px;flex:none}.mx-brand b{display:block;font-size:15px;letter-spacing:2px}.mx-brand span{font-family:var(--mono);font-size:10px;color:var(--ink2);letter-spacing:1px}
.mx-status{display:flex;align-items:center;gap:8px;height:58px;padding:4px 12px 4px 10px;border-radius:8px;border:1px solid var(--line2);min-width:170px;max-width:340px}
.mx-status>div{display:flex;flex-direction:column;line-height:16px;min-width:0}.mx-status>div>*{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mx-status b{font-size:13px}.mx-status span{font-size:11px;color:var(--ink2)}.mx-status .mx-tl{color:var(--teal)}
.mx-lamp{width:9px;height:9px;border-radius:50%;background:var(--line2);flex:none}
.s-running .mx-lamp{background:var(--warn);box-shadow:0 0 0 3px color-mix(in srgb,var(--warn) 25%,transparent);animation:mx-pulse 1.2s infinite}
.s-completed .mx-lamp{background:var(--ok)}.s-review .mx-lamp{background:var(--warn)}.s-failed .mx-lamp,.s-cancelled .mx-lamp{background:var(--bad)}
.mx-clock{display:flex;flex-direction:column;align-items:flex-end;line-height:16px;padding:0 4px}
.mx-clock span{font-size:10px;color:var(--ink2);letter-spacing:1px}
.mx-clock b{font-family:var(--mono);font-size:18px;font-weight:600;letter-spacing:1px;line-height:22px}
.mx-clock.sep{padding-right:14px;margin-right:6px;border-right:1px solid var(--line)}
.mx-clock.pct b{color:var(--teal)}.mx-clock.pct small{font-size:11px;font-weight:400;margin-left:1px;color:var(--ink2)}
.mx-clock.ver{margin-right:6px}.mx-clock.ver b{font-size:12.5px;font-weight:500;letter-spacing:0;color:var(--ink2)}
.mx-top .mx-btn,.mx-icon{height:34px;border-radius:7px}
.mx-top .mx-btn{display:inline-flex;align-items:center;gap:5px;padding:0 14px;box-shadow:none}
.mx-stop{border-color:var(--bad);color:var(--badink)}
.mx-hbtn{padding:0 10px 0 11px!important}.mx-hbtn:hover,.mx-hbtn[aria-expanded="true"]{border-color:var(--teal);color:var(--teal2)}
.mx-hcount{font-style:normal;font-family:var(--mono);font-size:10.5px;line-height:15px;padding:0 5px;border-radius:8px;background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--ink2)}
.mx-icon{width:34px;border:1px solid var(--line2);background:var(--panel2);color:var(--ink2);font-size:15px;cursor:pointer;display:grid;place-items:center}
.mx-icon:hover{color:var(--teal);border-color:var(--teal)}
.mx-runs-pop{width:440px;max-height:min(560px,calc(100vh - 120px))}
.mx-runs{display:flex;flex-direction:column;gap:4px;overflow:auto;min-height:0}
.mx-run{padding:7px 10px;border:1px solid var(--line);border-radius:6px;cursor:pointer}
.mx-run:hover{border-color:var(--line2);background:var(--panel2)}.mx-run.on{border-color:var(--teal);background:var(--tealdim)}
.mx-run-top{display:flex;align-items:center;gap:8px}.mx-run-name{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mx-run-meta{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--ink2);margin-top:2px}
.mx-modal-back{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px}
.mx-modal{width:min(880px,100%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;border-radius:10px;background:var(--dsw-alias-bg-layer-1,var(--panel));border:1px solid var(--line2);box-shadow:0 18px 50px rgba(0,0,0,.35);overflow:hidden;color:var(--dsw-alias-label-primary,var(--ink))}
.mx-modal-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line2);border-top:3px solid var(--teal)}.mx-modal-head h3{flex:1;margin:0;font-size:15px}
.mx-modal-body{flex:1;min-height:0;overflow:auto;padding:16px 24px 20px}
.mx-sp{flex:1}
.mx-btn{border:1px solid var(--line2);border-radius:5px;padding:4px 11px;color:var(--ink);background:var(--panel2);font-size:12px;cursor:pointer;white-space:nowrap}
.mx-btn:hover{border-color:var(--teal)}.mx-btn:disabled{opacity:.45;cursor:default}
.mx-btn.pri{border-color:var(--teal);color:var(--teal2);background:var(--tealdim)}
.mx-btn.sm{padding:1px 7px;font-size:11px}
.mx-btn.on{border-color:var(--teal);color:var(--teal2)}
.mx-tabs{display:flex;gap:2px;padding:0 8px;flex:none;overflow-x:auto}
.mx-tab-sep{flex:none;align-self:center;width:1px;height:20px;margin:0 10px;background:var(--ink3);opacity:.55}
.mx-tab.mx-tab-gap{margin-left:14px}
.mx-tab{display:flex;align-items:center;padding:8px 12px;color:var(--ink2);font-size:13px;border:0;border-bottom:2px solid transparent;background:none;cursor:pointer;white-space:nowrap}
.mx-tab.on{color:var(--ink);border-bottom-color:var(--teal);font-weight:600}
.mx-tab i{font-style:normal;font-family:var(--mono);font-size:11px;margin-left:5px;color:var(--warn)}
.mx-body{flex:1;min-height:0;display:flex;gap:8px}
.mx-col{display:flex;flex-direction:column;gap:8px;min-height:0}
.mx-scroll{overflow:auto;min-height:0}
.mx-pad{padding:12px 14px}
.mx-h{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}.mx-h b{font-size:13px;letter-spacing:1px}
.mx-cap{font-family:var(--mono);font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink3)}
.mx-num{font-family:var(--mono)}
.mx-muted{color:var(--ink2)}.mx-faint{color:var(--ink3)}.mx-ok{color:var(--ok)}.mx-warn{color:var(--warn)}.mx-bad{color:var(--bad)}.mx-tl{color:var(--teal)}
.mx-chip{display:inline-block;border-radius:3px;padding:0 6px;font-size:10.5px;line-height:17px;border:1px solid var(--line2);color:var(--ink2);white-space:nowrap;margin-right:4px}
.mx-chip.f{color:var(--fact);border-color:color-mix(in srgb,var(--fact) 45%,transparent);background:color-mix(in srgb,var(--fact) 8%,transparent)}
.mx-chip.j{color:var(--judge);border-color:color-mix(in srgb,var(--judge) 45%,transparent);background:color-mix(in srgb,var(--judge) 8%,transparent)}
.mx-chip.d{color:var(--decide);border-color:color-mix(in srgb,var(--decide) 45%,transparent);background:color-mix(in srgb,var(--decide) 8%,transparent)}
.mx-chip.w{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 50%,transparent);background:color-mix(in srgb,var(--warn) 8%,transparent)}
.mx-chip.b{color:var(--badink);border-color:color-mix(in srgb,var(--bad) 50%,transparent);background:color-mix(in srgb,var(--bad) 8%,transparent)}
.mx-chip.ok{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 45%,transparent);background:color-mix(in srgb,var(--ok) 8%,transparent)}
.mx-chip.v{color:var(--vio);border-color:color-mix(in srgb,var(--vio) 45%,transparent);background:color-mix(in srgb,var(--vio) 8%,transparent)}
.mx-sec{border-left:3px solid var(--teal);background:linear-gradient(90deg,color-mix(in srgb,var(--teal) 16%,transparent),transparent 70%);padding:4px 10px;margin:10px 0 8px;display:flex;gap:8px;align-items:baseline}
.mx-sec b{font-size:12.5px}
.mx table{border-collapse:collapse;width:100%}
.mx td,.mx th{padding:5px 8px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
.mx th{font-weight:500;color:var(--ink3);font-size:11px;position:sticky;top:0;background:var(--panel)}
.mx tr.click{cursor:pointer}.mx tr.click:hover td{background:var(--panel2)}
.mx tr.sel td{background:var(--panel3)}
.mx-input{background:var(--panel2);border:1px solid var(--line2);border-radius:5px;color:var(--ink);padding:5px 8px;font-size:12px;min-width:0}
.mx-input:focus{outline:none;border-color:var(--teal)}
.mx-field{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--ink2)}
.mx-err{color:var(--badink);border:1px solid color-mix(in srgb,var(--bad) 40%,transparent);background:color-mix(in srgb,var(--bad) 8%,transparent);padding:6px 10px;border-radius:5px}
.mx-empty{color:var(--ink3);padding:30px;text-align:center}
.mx-bigs{display:flex;gap:22px;margin:4px 0 8px;flex-wrap:wrap}.mx-bigs div small{display:block;color:var(--ink3);font-size:11px}.mx-bigs div .mx-num{font-size:24px;font-weight:700}
.mx-pi{padding:6px 8px;border-radius:5px;cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:1px 6px}
.mx-pi:hover{background:var(--panel2)}.mx-pi.on{background:var(--panel3);box-shadow:inset 3px 0 0 var(--teal)}
.mx-pi b{font-family:var(--mono);font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mx-pi span{font-size:10.5px;color:var(--ink3)}
.mx-doc{font-size:13.5px;line-height:2.3;white-space:pre-wrap;word-break:break-all}
.mx-m{border-bottom:2px solid;padding:1px 1px;border-radius:2px;cursor:pointer}
.mx-m.f{border-color:var(--fact);background:color-mix(in srgb,var(--fact) 10%,transparent)}.mx-m.j{border-color:var(--judge);background:color-mix(in srgb,var(--judge) 11%,transparent)}.mx-m.d{border-color:var(--decide);background:color-mix(in srgb,var(--decide) 11%,transparent)}
.mx-m.n{border-bottom-style:dashed}.mx-m.t{opacity:.55}.mx-m.sel{outline:1.5px solid var(--sel);outline-offset:1px}
.mx-tm{font-family:var(--mono);font-size:9.5px;color:var(--warn);border:1px solid color-mix(in srgb,var(--warn) 40%,transparent);border-radius:3px;padding:0 3px;margin:0 2px;vertical-align:1px}
.mx-tm.inh{color:var(--ink3);border-color:var(--line2)}.mx-tm.q{color:var(--badink);border-color:color-mix(in srgb,var(--bad) 50%,transparent)}
.mx-kv{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:11.5px}
.mx-mrow{border-top:1px solid var(--line);padding:6px 0;font-size:11.5px}
.mx-opt{border:1px solid var(--line2);border-radius:6px;padding:6px 10px;margin-bottom:5px;cursor:pointer;display:flex;gap:8px;align-items:center}
.mx-opt.on{border-color:var(--teal);background:var(--tealdim)}
.mx-mo{border:1px solid color-mix(in srgb,var(--vio) 35%,transparent);background:color-mix(in srgb,var(--vio) 5%,transparent);border-radius:6px;padding:7px 10px;font-size:11.5px;line-height:1.6;margin-bottom:6px}
.mx-md{white-space:pre-wrap;font-family:var(--mono);font-size:12px;line-height:1.6}
.mx-settings{max-width:820px;display:flex;flex-direction:column;gap:12px;color:var(--dsw-alias-label-primary)}
.mx-settings .mx-input{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.mx-settings .mx-btn{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.mx-settings .mx-field{color:var(--dsw-alias-label-secondary)}
.mx-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.mx-grid2>*{min-width:0}
.mx-pop .mx-grid2.tm{grid-template-columns:minmax(0,1fr) max-content}
/* ---- 产线：等轴测工厂＋HUD 面板（参考工业监控大屏） ---- */
.mx.mx-dark{--lift:0 1px 0 rgba(255,255,255,.025) inset,0 12px 26px -22px #000}
.mx.mx-light{--lift:0 1px 0 rgba(255,255,255,.8) inset,0 10px 22px -20px rgba(40,20,80,.32)}
.mx-frame{box-shadow:var(--lift);border-radius:4px}
.mx-tab.on{color:var(--teal2);border-bottom-color:var(--teal)}
.mx-tab i{color:var(--ink3)}.mx-tab.on i{color:var(--teal)}
.mx-stack{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:6px 0 4px;background:var(--line2)}.mx-stack span{display:block;height:100%}
.mx-scene{display:block;width:100%;height:auto;overflow:visible;margin:0 auto}
.mx-scene text{pointer-events:none}
.mx-scene:focus{outline:none}.mx-scene:focus-visible{outline:1px dashed color-mix(in srgb,var(--teal) 60%,transparent);outline-offset:-2px;border-radius:3px}
.mx-hero{position:relative;padding:10px 12px 8px;min-height:560px;background:radial-gradient(120% 90% at 45% 55%,var(--panel2),var(--bg) 75%);display:flex;flex-direction:column;min-height:420px}
/* 产线页布局（同匿名化插件）：左＝产线＋底部三栏，右＝工序详情拉到底 */
.mx-line{flex:1;min-width:0;min-height:640px;display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:8px}
.mx-line-left{min-width:0;min-height:0;display:flex;flex-direction:column;gap:8px}
.mx-line .mx-hero{flex:1;min-height:360px}
.mx-line .mx-scene{flex:1 1 0;min-height:0;width:100%;height:100%}
.mx-line .mx-side{width:auto;min-height:0}
.mx-bottom{flex:none;display:grid;grid-template-columns:1.15fr 1.3fr .85fr}
.mx-ro{padding:10px 14px 11px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:9px;min-width:0;overflow:hidden}
.mx-ro:last-child{border-right:0}
.mx-ro .mx-legend{margin-top:-4px;padding-top:0}
.mx-ro .mx-stack{margin:0}
.mx-ro-h{display:flex;align-items:center;gap:8px;min-height:18px}
.mx-ro-h>b{font-size:12.5px}
.mx-big{display:flex;gap:6px 20px;flex-wrap:wrap;align-items:flex-end}
.mx-big>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.mx-big span{font-size:10.5px;color:var(--ink3)}
.mx-big b{font-family:var(--mono);font-size:21px;font-weight:600;color:var(--ink);line-height:1.1;white-space:nowrap}
.mx-big b.mx-dim{font-family:inherit;font-size:15px;color:var(--ink2);padding-bottom:2px}
.mx-big small{font-size:11px;color:var(--ink3);font-weight:400;margin-left:2px}
.mx-big .mx-big-pair{gap:1px}
.mx-big-pair p{margin:0;display:flex;gap:6px;align-items:baseline}
.mx-big-pair b{font-size:12.5px}
.mx-kv2{display:flex;gap:4px 18px;flex-wrap:wrap;font-size:11.5px;color:var(--ink3)}
.mx-kv2 p{margin:0;display:flex;gap:7px;align-items:baseline}
.mx-kv2 b{font-family:var(--mono);font-size:13px;font-weight:600;color:var(--ink)}
.mx-kv2 small{font-size:10.5px;color:var(--ink3)}
.mx-spark{margin-top:auto}
.mx-spark svg{display:block;width:100%;height:40px}
.mx-spark .grid{stroke:var(--line);stroke-width:1}
.mx-spark .area{fill:var(--tealdim)}
.mx-spark .line{fill:none;stroke:var(--teal);stroke-width:1.6;vector-effect:non-scaling-stroke}
.mx-spark .avg{stroke:var(--ink3);stroke-width:1;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}
.mx-spark-foot{display:flex;justify-content:space-between;font-size:10.5px;color:var(--ink3);margin-top:2px}
.mx-ro-line{display:flex;align-items:center;gap:6px 14px;flex-wrap:wrap;font-size:11.5px;color:var(--ink2)}
.mx-ro-line b{font-family:var(--mono);font-weight:600;color:var(--ink)}
.mx-link{padding:0;border:0;background:none;font:inherit;color:var(--ink2);cursor:pointer}
.mx-link:hover{color:var(--teal2)}
.mx-link.mx-warn b{color:var(--warn)}
.mx-types span{display:inline-flex;gap:5px;color:var(--ink3)}
.mx-types b{color:var(--ink2)}
.mx-gdots{display:inline-flex;align-items:center;gap:4px;margin-left:auto;color:var(--ink3)}
.mx-gdot{width:20px;height:20px;padding:0;border-radius:50%;border:1px solid var(--line2);background:none;font:inherit;font-size:11.5px;line-height:18px;color:var(--ink3);cursor:pointer}
.mx-gdot.ok{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 50%,transparent);background:color-mix(in srgb,var(--ok) 9%,transparent)}
.mx-gdot.bad{color:#fff;border-color:var(--bad);background:var(--bad)}
.mx-ro .mx-spath{margin-top:auto}
.mx-ro .mx-spath span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:10.5px;color:var(--ink3);min-width:0}
.mx-gauges{flex:1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;align-items:center}
.mx-gauge{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0;text-align:center}
.mx-gauge svg{width:58px;height:58px}
.mx-gauge .trk{fill:none;stroke:var(--line2);stroke-width:6}
.mx-gauge .arc{fill:none;stroke-width:6;stroke-linecap:round;transform:rotate(-90deg);transform-origin:50% 50%}
.mx-gauge .pk{fill:var(--ink2);stroke:var(--panel);stroke-width:1.2}
.mx-gauge text{font-family:var(--mono);font-size:12px;font-weight:600;fill:var(--ink)}
.mx-gauge span{font-size:11.5px;color:var(--ink2);white-space:nowrap}
.mx-gauge small{font-family:var(--mono);font-size:10.5px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.mx-res-line{display:flex;justify-content:center;align-items:baseline;gap:6px;font-size:11.5px;color:var(--ink2)}
.mx-res-line b{font-family:var(--mono);font-weight:600;color:var(--ink)}
.mx-res-line span{color:var(--ink3)}
@media (max-width:1200px){.mx-line{grid-template-columns:minmax(0,1fr) 290px}.mx-bottom{grid-template-columns:1fr 1fr}.mx-bottom .mx-ro:last-child{grid-column:1 / -1;border-top:1px solid var(--line)}}
.mx-hero .mx-scene{flex:1}
.mx-hud{position:absolute;z-index:1;font-size:11px;color:var(--ink2);pointer-events:none}
.mx-hud.tl{bottom:44px;left:14px;width:208px;padding:10px 12px;background:color-mix(in srgb,var(--panel) 82%,transparent);border:1px solid var(--line2);border-radius:3px;backdrop-filter:blur(3px)}
.mx-hud-id{font-size:9.5px;letter-spacing:1px;color:var(--ink3);margin-bottom:8px}.mx-hud-id b{color:var(--ink2);font-weight:500}
.mx-hud-row{display:grid;grid-template-columns:1fr auto;gap:0 8px;margin-bottom:7px}.mx-hud-row b{color:var(--ink);font-weight:500}
.mx-hud-row .mx-ticks{grid-column:1/3;height:9px;margin-top:3px}
.mx-hud-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line2);margin-top:4px}
.mx-hud-grid div{padding:6px 0 5px;border-bottom:1px solid var(--line)}.mx-hud-grid div:nth-child(even){padding-left:10px;border-left:1px solid var(--line)}
.mx-hud-grid small{display:block;font-family:var(--mono);font-size:9px;color:var(--ink3);letter-spacing:.5px}.mx-hud-grid b{font-size:15px;font-weight:400;color:var(--ink)}
.mx-hud-model{margin-top:8px;font-family:var(--mono);font-size:9.5px;color:var(--ink3);display:flex;align-items:center;gap:6px}
.mx-hud-model i{width:6px;height:6px;border-radius:50%;background:var(--ink3)}.mx-hud-model i.on{background:var(--ok);box-shadow:0 0 5px var(--ok)}
.mx-hud.br{right:14px;top:36px;display:flex;flex-direction:column;gap:4px;font-size:10px;color:var(--ink3)}
.mx-hud.br div{display:flex;align-items:center;gap:6px;justify-content:flex-end}
.mx-hud .sw{width:12px;height:8px;display:inline-block;border-radius:1px}
.mx-hud .sw.hot{background:var(--teal);box-shadow:0 0 5px var(--teal)}.mx-hud .sw.clay{background:#c9c4d6}
.mx-hud .sw.sel{border:1.5px solid var(--teal);border-right:0;border-bottom:0;background:transparent}
.mx-hud .sw.box{background:#e9e6f0;border-top:2px solid var(--teal)}.mx-hud .sw.red{background:var(--bad)}.mx-hud .sw.vio{background:var(--vio);box-shadow:0 0 5px var(--vio)}
.mx-hud .sw.flow{height:2px;background:repeating-linear-gradient(90deg,var(--ink2) 0 4px,transparent 4px 7px)}
.mx-act{position:relative}
.mx-new{border-color:var(--fill);background:var(--fill);color:#fff;font-weight:600}
.mx-new:hover:not(:disabled){filter:brightness(1.06)}
.mx-new:disabled{background:transparent;color:var(--ink2);border-color:var(--line2);font-weight:400}
.mx-caret{font-size:9px;opacity:.7;margin-left:5px}
.mx-shade{position:fixed;inset:0;z-index:940;background:rgba(0,0,0,.35)}
.mx-pop{position:absolute;right:0;top:36px;z-index:950;width:460px;padding:14px 16px;border:1px solid color-mix(in srgb,var(--teal) 50%,transparent);border-radius:8px;background:var(--panel);box-shadow:0 20px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:10px;text-align:left}
.mx-pop-h{display:flex;justify-content:space-between;align-items:center}.mx-pop-h b{font-size:12px;letter-spacing:2px;color:var(--teal2);font-weight:600}
.mx-pop .mx-field{gap:4px}
.mx-pick{display:flex;gap:8px;align-items:center;font-size:10.5px}
.mx-pop-act{display:flex;gap:8px;margin-top:2px}
.mx-pop-act .mx-btn{height:32px}
.mx-hero-cap{display:flex;align-items:center;gap:10px}
.mx-live{font-family:var(--mono);font-size:10.5px;letter-spacing:1px;color:var(--teal);display:inline-flex;align-items:center;gap:6px}
.mx-live i{width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 6px currentColor;animation:mx-pulse 1.6s ease-in-out infinite}
.mx-live.ok{color:var(--ok)}.mx-live.bad{color:var(--bad)}
.mx-hero-err{margin:8px 0 0;align-self:flex-start;max-width:720px;font-size:12px}
.mx-side{width:300px;flex:none;padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.mx-side-h{display:flex;align-items:center;gap:8px}.mx-side-h b{font-size:14px;font-weight:600;flex:1}
.mx-side-sec{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;letter-spacing:.5px;color:var(--ink3);margin-top:12px;padding-top:8px;border-top:1px solid var(--line2)}
.mx-side{overflow-y:auto;contain:size}.mx-side>*{flex:none}
.mx-sdesc{margin:6px 0 2px;font-size:11.5px;line-height:1.6;color:var(--ink2)}.mx-sdesc span{color:var(--ink3)}
.mx-shead{display:flex;flex-direction:column;gap:6px;margin-top:8px;padding-top:10px;border-top:1px solid var(--line2)}
.mx-ring{display:flex;align-items:center;gap:10px}.mx-ring div{display:flex;flex-direction:column;min-width:0}.mx-ring b{font-size:20px;font-weight:400;color:var(--ink)}.mx-ring small{font-size:10.5px;color:var(--ink3)}
.mx-skv{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}.mx-skv div{display:flex;flex-direction:column;min-width:0}
.mx-skv span{font-size:10px;color:var(--ink3)}.mx-skv b{font-size:12.5px;font-weight:500;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx-ssec{margin-top:10px;padding-top:8px;border-top:1px solid var(--line)}
.mx-ssec-h{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;color:var(--ink3);margin-bottom:4px}.mx-ssec-h b{font-weight:600}.mx-ssec-h>span:last-child:not(:first-child){flex:none;white-space:nowrap}
.mx-ssec .mx-legend{margin-top:0;padding-top:2px}
.mx-snote{margin:2px 0 0;font-size:11px;line-height:1.5;color:var(--ink2)}
.mx-rank{display:flex;flex-direction:column;gap:4px}
.mx-rank-r{display:grid;grid-template-columns:96px 1fr 52px;align-items:center;gap:6px;font-size:11px;color:var(--ink2)}
.mx-rank-r span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mx-rank-r div{height:6px;border-radius:3px;background:var(--line)}.mx-rank-r i{display:block;height:100%;border-radius:3px}
.mx-rank-r b{text-align:right;font-weight:500;color:var(--ink)}
.mx-spath{display:flex;gap:6px;align-items:center}.mx-spath span{flex:1;min-width:0;font-family:var(--mono);font-size:10.5px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
.mx-slist{margin:2px 0 0;padding-left:16px;font-size:11px;line-height:1.7;color:var(--ink2)}
.mx-saction{margin-top:12px;align-self:stretch;justify-content:center}
.mx-ticks{display:flex;gap:2px;height:13px;margin-top:5px}
.mx-ticks i{flex:1;max-width:3px;background:var(--line2);border-radius:.5px}
.mx-ticks i.on{background:var(--ink2)}.mx-ticks.hot i.on{background:var(--teal)}
.mx-panel{padding:12px 14px;display:flex;flex-direction:column;min-width:0}
.mx-panel-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}.mx-panel-h b{font-size:12.5px;letter-spacing:1px}
.mx-panel-foot{margin-top:auto;padding-top:8px;font-size:11px;color:var(--ink2)}
.mx-gl{margin-bottom:9px}
.mx-gl-h{display:flex;justify-content:space-between;font-size:11.5px}.mx-gl-h em{font-style:normal;font-family:var(--mono);color:var(--ink3);margin-right:6px}.mx-gl-h b{font-weight:500}
.mx-tagbox{font-family:var(--mono);font-size:9.5px;border:1px solid var(--line2);color:var(--ink2);padding:0 5px;border-radius:2px}
.mx-mets{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line)}
.mx-met{padding:8px 8px 10px 0;border-bottom:1px solid var(--line)}
.mx-met:not(:nth-child(3n+1)){padding-left:10px;border-left:1px solid var(--line)}
.mx-met small{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:1px;color:var(--ink3);margin-bottom:6px}
.mx-met .mx-num{font-size:24px;font-weight:300;letter-spacing:-.5px}.mx-met em{font-style:normal;font-size:10px;color:var(--ink3);margin-left:3px}
.mx-panel-sec{display:flex;justify-content:space-between;font-family:var(--mono);font-size:9.5px;color:var(--ink3);margin:10px 0 6px;gap:8px}
.mx-pchips{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.mx-pchips button{font-family:var(--mono);font-size:10px;padding:2px 0;width:42px;border:1px solid var(--line2);border-radius:2px;background:var(--panel2);color:var(--ink2);cursor:pointer}
.mx-pchips button:hover{border-color:var(--ink2);color:var(--ink)}
.mx-pchips button.w{border-color:color-mix(in srgb,var(--warn) 60%,transparent);color:var(--warn);background:color-mix(in srgb,var(--warn) 9%,transparent)}
.mx-pchips button.x{border-color:color-mix(in srgb,var(--bad) 60%,transparent);color:var(--badink);background:color-mix(in srgb,var(--bad) 10%,transparent)}
.mx-hero-num{display:flex;align-items:center;gap:10px;margin-bottom:6px}.mx-hero-num>.mx-num{font-size:40px;font-weight:200;letter-spacing:-1px;line-height:1}
.mx-hero-num small{display:block;font-family:var(--mono);font-size:10px;color:var(--ink2);letter-spacing:.5px}
.mx-vchips{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.mx-alerts{display:flex;flex-direction:column;gap:4px}
.mx-al{display:grid;grid-template-columns:5px 44px 1fr 46px 40px;gap:8px;align-items:center;padding:6px 8px 6px 0;border:1px solid var(--line);border-radius:3px;background:var(--panel2)}
.mx-al.click{cursor:pointer}.mx-al.click:hover{border-color:var(--line2);background:var(--panel3)}
.mx-al-bar{align-self:stretch;margin:-6px 0;border-radius:3px 0 0 3px;background:var(--line2)}
.mx-al.crit{background:color-mix(in srgb,var(--bad) 8%,var(--panel2));border-color:color-mix(in srgb,var(--bad) 30%,transparent)}
.mx-al.crit .mx-al-bar{background:repeating-linear-gradient(135deg,var(--bad) 0 3px,transparent 3px 6px)}
.mx-al.warn .mx-al-bar{background:repeating-linear-gradient(135deg,var(--warn) 0 3px,transparent 3px 6px)}
.mx-al-src{font-size:10px;color:var(--ink3)}
.mx-al-t{min-width:0}.mx-al-t b{display:block;font-size:11.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mx-al-t small{display:block;font-size:10px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mx-al .mx-ticks{margin:0;height:11px}
.mx-al-tag{font-family:var(--mono);font-size:9.5px;text-align:center;border:1px solid var(--line2);border-radius:2px;color:var(--ink2);padding:1px 0}
.mx-al.crit .mx-al-tag{color:var(--badink);border-color:var(--bad)}.mx-al.warn .mx-al-tag{color:var(--warn);border-color:var(--warn)}.mx-al.ok .mx-al-tag{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 60%,transparent)}
.mx-flow{animation:mx-flow 1.2s linear infinite}
@keyframes mx-flow{to{stroke-dashoffset:-30}}
.mx-breathe{animation:mx-breathe 2.4s ease-in-out infinite}
@keyframes mx-breathe{50%{opacity:.82}}
.mx-cardin{animation:mx-cardin .25s ease-out}
@keyframes mx-cardin{from{opacity:0;transform:translateY(4px)}}
.mx-pulse{animation:mx-pulse 1.4s ease-in-out infinite}
@keyframes mx-pulse{50%{opacity:.35}}

.mx-tpl{display:inline-flex;align-items:center;gap:8px;height:58px;padding:4px 12px 4px 10px;border:1px solid color-mix(in srgb,var(--teal) 45%,transparent);border-radius:8px;background:var(--tealdim);max-width:260px}
.mx-tpl>div{display:flex;flex-direction:column;line-height:16px;min-width:0}.mx-tpl b{font-size:12.5px;color:var(--teal2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mx-tpl span{font-size:10.5px;color:var(--ink2);white-space:nowrap}
.mx-fr{display:grid;grid-template-columns:92px 1fr 40px;gap:8px;align-items:center;font-size:11px;margin-bottom:6px}
.mx-fr>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mx-fr em{font-style:normal;font-family:var(--mono);color:var(--ink3);margin-right:4px}
.mx-fr .mx-stack{margin:0;height:7px}
.mx-fr b{font-family:var(--mono);font-weight:500;text-align:right;font-size:10.5px;color:var(--ink2)}
.mx-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:10.5px;color:var(--ink2);margin-top:auto;padding-top:6px}
.mx-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}
.mx-ev{display:grid;grid-template-columns:76px 1fr 44px;gap:8px;align-items:center;font-size:11px;margin-bottom:5px}
.mx-ev b{font-family:var(--mono);font-weight:500;text-align:right}
.mx-ev .mx-ticks{margin:0;height:10px}
.mx-q{border-bottom:2px solid var(--teal);background:color-mix(in srgb,var(--teal) 14%,transparent);border-radius:2px;cursor:pointer}
.mx-q.neg{border-color:var(--ink3);background:color-mix(in srgb,var(--ink3) 14%,transparent);border-bottom-style:dashed}
.mx-q.hx{border-color:var(--fact);background:color-mix(in srgb,var(--fact) 12%,transparent)}
.mx-q.fam{border-color:var(--judge);background:color-mix(in srgb,var(--judge) 12%,transparent)}
.mx-q.mdl{border-color:var(--vio)}
.mx-q.sel{outline:1.5px solid var(--sel);outline-offset:1px}
.mx-hl{background:color-mix(in srgb,var(--warn) 22%,transparent);border-radius:2px}
.mx-grid-tbl td,.mx-grid-tbl th{white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;font-size:11.5px}
.mx-grid-tbl td.none{color:var(--ink3)}
.mx-split{display:grid;grid-template-columns:320px 1fr;gap:8px;flex:1;min-height:0}
.mx-rv{border:1px solid var(--line2);border-radius:6px;padding:10px 12px;margin-bottom:8px;background:var(--panel2)}
.mx-rv-h{display:flex;gap:8px;align-items:center;margin-bottom:6px}
.mx-rv-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:11.5px}
.mx-rv-cols>div{border:1px solid var(--line);border-radius:4px;padding:6px 8px}
.mx-snip{font-size:12.5px;line-height:1.9;margin-top:6px;white-space:pre-wrap}
.mx-json{width:100%;min-height:420px;font-family:var(--mono);font-size:11.5px;background:var(--panel2);color:var(--ink);border:1px solid var(--line2);border-radius:5px;padding:8px}
`

    /* -------------------------------------------------------------- helpers */
    const PAL = {
      dark: { fact: '#6cb4ff', judge: '#f38bc8', decide: '#4fd1a5', ink: '#ebe8f4', ink2: '#a49fba', ink3: '#6b6683', bad: '#e5484d', warn: '#f0a63a', vio: '#4cc9e0', ok: '#62c27e', teal: '#8f6ef5' },
      light: { fact: '#1f7fd0', judge: '#c23d8c', decide: '#0f9d78', ink: '#221d33', ink2: '#625b78', ink3: '#958fa9', bad: '#cf3a3f', warn: '#c27a12', vio: '#0f8ea3', ok: '#2f9a55', teal: '#5b3cc4' },
    }
    const CLAY = {
      dark: { top: '#d8d5e2', left: '#b0abc0', right: '#88839a', edge: 'rgba(0,0,0,.28)', top2: '#e5e2ec', left2: '#bfbacd', right2: '#9a95ab', win: '#34303f', hole: '#433e50', pad: '#24212e', padL: '#1a1822', padR: '#15131c', grid: '#e8e5f0', floorShadow: '#000', card: 'rgba(12,11,18,.88)', cardLine: '#433d58', lamp: '#ece4ff' },
      light: { top: '#e9e6f0', left: '#c9c4d6', right: '#a8a2b8', edge: 'rgba(40,25,80,.2)', top2: '#f3f1f8', left2: '#d6d1e2', right2: '#b6b0c5', win: '#625b74', hole: '#827b96', pad: '#dcd8e5', padL: '#cac5d6', padR: '#b8b2c7', grid: '#5f5878', floorShadow: '#2c2050', card: 'rgba(253,252,255,.94)', cardLine: '#cdc7dc', lamp: '#d9c9ff' },
    }
    function shade(hex, k) {
      const m = /^#([0-9a-f]{6})$/i.exec(hex ?? ''); if (!m) return hex
      const n = parseInt(m[1], 16)
      const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)))
      return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`
    }
    const pts = (a) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    function hostIsDark() {
      try {
        let color = getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-base').trim()
        if (!color) color = getComputedStyle(document.body).backgroundColor
        const probe = document.createElement('span'); probe.style.color = color; document.body.appendChild(probe)
        const rgb = getComputedStyle(probe).color; probe.remove()
        const parts = (rgb.match(/[\d.]+/g) ?? []).map(Number)
        if (parts.length < 3 || /rgba\(0, 0, 0, 0\)|transparent/.test(rgb)) throw new Error('no colour')
        const scale = rgb.startsWith('color(') ? 255 : 1
        return (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) * scale / 255 < 0.5
      } catch { return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true }
    }
    function useHostDark() {
      const [dark, setDark] = useState(() => hostIsDark())
      useEffect(() => {
        const check = () => setDark(hostIsDark())
        const obs = new MutationObserver(check)
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'] })
        if (document.body) obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
        const media = window.matchMedia?.('(prefers-color-scheme: dark)'); media?.addEventListener?.('change', check)
        return () => { obs.disconnect(); media?.removeEventListener?.('change', check) }
      }, [])
      return dark
    }
    const ThemeCtx = React.createContext(PAL.dark)
    const useClay = () => { const P = React.useContext(ThemeCtx); return [P, P === PAL.light ? CLAY.light : CLAY.dark] }
    const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString())
    const big = (n) => (n == null ? '—' : n >= 1e8 ? `${(n / 1e8).toFixed(2)}亿` : n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e6 ? 0 : 1)}万` : fmt(n))
    const fmtTime = (s) => { if (!s) return '—'; try { return new Date(s).toLocaleString() } catch { return String(s) } }
    const pct = (x) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(1)}%`)
    const clock = (ms) => { if (ms == null) return '00:00'; const t = Math.floor(ms / 1000); const hh = Math.floor(t / 3600); const mm = Math.floor(t / 60) % 60; const ss = t % 60; const p = (n) => String(n).padStart(2, '0'); return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}` }
    const STATUS_LABEL = { completed: '完成', running: '运行中', review: '待复核', failed: '失败', cancelled: '已取消' }
    const statusChip = (s) => h('span', { className: `mx-chip ${s === 'completed' ? 'ok' : s === 'running' ? '' : s === 'review' ? 'w' : 'b'}` }, STATUS_LABEL[s] ?? s)
    const MODE_LABEL = { hybrid: '模型通读＋规则票', model: '仅模型通读' }
    // 旧批次（仅规则模式已停用）仍能查看
    const modeLabel = (m) => MODE_LABEL[m] ?? (m === 'rules' ? '仅规则（已停用）' : m)
    const STATE_LABEL = { run: '运行中', part: '进行中', hold: '待复核', done: '完成', idle: '未开始' }
    const MONO = 'SF Mono,JetBrains Mono,Menlo,monospace'
    const qCls = (v) => `mx-q${v.assertion === '否认' ? ' neg' : v.assertion === '既往' ? ' hx' : v.assertion === '家族' ? ' fam' : ''}${String(v.method).startsWith('model') ? ' mdl' : ''}`

    function Icon({ size = 16 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M5 6h9M5 11h6M5 16h4' }), h('circle', { cx: 16, cy: 15, r: 4 }), h('path', { d: 'M19 18l3 3' }))
    }

    /* ================================================================ page */
    function Page() {
      const [tab, setTab] = useState('line')
      const [runs, setRuns] = useState([])
      const [activeId, setActiveId] = useState(null)
      const [runId, setRunId] = useState(null)
      const [run, setRun] = useState(null)
      const [patient, setPatient] = useState(null)
      const [error, setError] = useState('')
      const [showNew, setShowNew] = useState(false)
      const [runsOpen, setRunsOpen] = useState(false)
      const [modal, setModal] = useState(null)
      const [version, setVersion] = useState(null)
      const [now, setNow] = useState(Date.now())
      useEffect(() => { call('config').then((c) => setVersion(c.version ?? null)).catch(() => {}) }, [])
      const refreshList = useCallback(async () => {
        try {
          const v = await call('list')
          setRuns(v.runs); setActiveId(v.active)
          setRunId((cur) => cur ?? v.active ?? v.runs[0]?.id ?? null)
          if (!v.runs.length) setShowNew(true)
        } catch (e) { setError(msg(e)) }
      }, [])
      useEffect(() => { refreshList() }, [])
      useEffect(() => {
        if (!runId) return undefined
        let alive = true; let timer = null
        const load = async () => {
          try {
            const v = await call('status', { runId })
            if (!alive) return
            setRun(v.run); setActiveId(v.active)
            if (v.run?.status === 'running') timer = setTimeout(load, 2000)
            else if (v.active === null) refreshList()
          } catch (e) { if (alive) setError(msg(e)) }
        }
        load()
        return () => { alive = false; clearTimeout(timer) }
      }, [runId])
      useEffect(() => {
        if (run?.status !== 'running') return undefined
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
      }, [run?.status])
      useEffect(() => {
        if (!modal && !runsOpen) return undefined
        const onKey = (e) => { if (e.key === 'Escape') { setModal(null); setRunsOpen(false) } }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [modal, runsOpen])
      const openPatient = (p) => { setPatient(p); setTab('source') }
      const selectRun = (id) => { setRunId(id); setRun(null); setPatient(null); setRunsOpen(false); setTab('line') }
      const elapsed = run?.startedAt ? Math.max(0, (run.status === 'running' ? now : Date.parse(run.finishedAt ?? run.startedAt)) - Date.parse(run.startedAt)) : null
      const percent = run?.shards?.total ? Math.round(run.shards.done / run.shards.total * 100) : null
      const lineStatus = run?.status ?? 'idle'
      const dark = useHostDark()
      const heldFormats = run?.format?.held ?? 0
      // 按流程顺序（同匿名化插件的分组）：产线｜模板 E0  格式 E1　复核 E6  宽表 E7  原文标注（从宽表看出处）　模型调用 报告（全程记录）
      const tabs = [['line', '◈ 产线'], ['template', '模板', run?.template?.fields, 'sep'], ...(run?.format ? [['formats', '格式', heldFormats]] : []), ['review', '复核', run?.totals?.review, 'gap'], ['wide', '宽表', run?.totals?.patients], ['source', '原文标注'], ['calls', '模型调用', null, 'gap'], ['report', '报告']]
      return h(ThemeCtx.Provider, { value: dark ? PAL.dark : PAL.light }, h('div', { className: `mx ${dark ? 'mx-dark' : 'mx-light'}` },
        h('style', {}, CSS),
        h('header', { className: 'mx-frame mx-top' },
          h('div', { className: 'mx-brand' },
            h('div', { className: 'mx-logo' }, h('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M5 6h8M5 11h5M5 16h4' }), h('circle', { cx: 16, cy: 15, r: 4.2 }), h('path', { d: 'M16 9v2M16 19v2M10 15h2M20 15h2' }))),
            h('div', {}, h('b', {}, '病历文书提取'), h('span', {}, 'MEDICAL DOCUMENT EXTRACTION'))),
          h('div', { className: `mx-status s-${lineStatus}` },
            h('span', { className: 'mx-lamp' }),
            h('div', {},
              h('b', {}, lineStatus === 'idle' ? '空闲' : STATUS_LABEL[lineStatus] ?? lineStatus),
              h('span', { className: 'mx-num' }, run?.id ?? '—'),
              run?.status === 'running' && run.current ? h('span', { className: 'mx-tl' }, `${run.current.stage} ${run.current.step}${run.rate ? ` · ${fmt(run.rate)} 份/秒` : ''}`)
                : run ? h('span', { title: run.input }, [modeLabel(run.mode), run.asOf ? `截至 ${run.asOf}` : null, run.inputName].filter(Boolean).join(' · ')) : null)),
          run ? h('div', { className: 'mx-tpl', title: run.template.id }, h('span', { style: { fontSize: 15, color: 'var(--teal)' } }, '▤'), h('div', {}, h('b', {}, `模板 ${run.template.name}`), h('span', {}, `v${run.template.version} · ${run.template.fields} 字段${run.priorities?.length ? ` · ${run.priorities.join('/')}` : ''}`))) : null,
          h('span', { className: 'mx-sp' }),
          h('div', { className: 'mx-clock sep' }, h('span', {}, '用时'), h('b', {}, clock(elapsed))),
          run ? h('div', { className: 'mx-clock sep pct', title: `${run.shards.done} / ${run.shards.total} 个分片` }, h('span', {}, '完成'), h('b', {}, percent == null ? '—' : String(percent), h('small', {}, '%'))) : null,
          version ? h('div', { className: 'mx-clock ver' }, h('span', {}, '版本'), h('b', {}, `v${version}`)) : null,
          h('div', { className: 'mx-act' },
            run?.status === 'running'
              ? h('button', { className: 'mx-btn mx-stop', onClick: () => call('cancel', { runId: run.id }).catch((e) => setError(msg(e))) }, '■ 停止批次')
              : h('button', { className: 'mx-btn mx-new', disabled: !!activeId, onClick: () => setShowNew((x) => !x) }, activeId ? '正在处理…' : h(React.Fragment, {}, '＋ 新批次', h('span', { className: 'mx-caret' }, '▾'))),
            showNew && !activeId ? h('div', { className: 'mx-shade', onMouseDown: () => setShowNew(false) }) : null,
            showNew && !activeId ? h(NewRun, {
              resumable: run && ['cancelled', 'failed'].includes(run.status) ? run : null,
              onClose: () => setShowNew(false),
              onStarted: (id) => { setShowNew(false); setRunId(id); setRun(null); refreshList(); setTab('line') },
              onError: setError,
              openSettings: () => { setShowNew(false); setModal('settings') },
            }) : null),
          h('div', { className: 'mx-act' },
            h('button', { className: 'mx-btn mx-hbtn', 'aria-expanded': runsOpen ? 'true' : 'false', onClick: () => { if (!runsOpen) refreshList(); setRunsOpen(!runsOpen) } }, '记录', runs.length ? h('i', { className: 'mx-hcount' }, String(runs.length)) : null),
            runsOpen ? h('div', { className: 'mx-shade', onMouseDown: () => setRunsOpen(false) }) : null,
            runsOpen ? h('div', { className: 'mx-pop mx-runs-pop', role: 'dialog', 'aria-label': '批次记录' },
              h('div', { className: 'mx-pop-h' }, h('b', {}, '批次记录'), h('span', { className: 'mx-sp' }), h('button', { className: 'mx-btn sm', onClick: refreshList }, '刷新')),
              !runs.length ? h('div', { className: 'mx-faint' }, '还没有批次。')
                : h('div', { className: 'mx-runs' }, runs.map((r) => h('div', { key: r.id, role: 'button', tabIndex: 0, className: `mx-run${r.id === runId ? ' on' : ''}`, onClick: () => selectRun(r.id) },
                  h('div', { className: 'mx-run-top' }, h('span', { className: 'mx-run-name', title: r.outputRoot }, `${r.input} · ${r.template}`), statusChip(r.status)),
                  h('div', { className: 'mx-run-meta' }, h('span', {}, fmtTime(r.startedAt)), h('span', { className: 'mx-num' }, `文书 ${big(r.documents)} · 值 ${big(r.values)}${r.review ? ` · 待复核 ${r.review}` : ''}`)))))) : null),
          h('button', { className: 'mx-icon', title: '设置', 'aria-label': '设置', onClick: () => setModal('settings') }, '⚙')),
        h('nav', { className: 'mx-frame mx-tabs', role: 'tablist' }, tabs.map(([k, label, n, group]) => h(React.Fragment, { key: k },
          group === 'sep' ? h('span', { className: 'mx-tab-sep', 'aria-hidden': 'true' }) : null,
          h('button', { role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', className: `mx-tab${tab === k ? ' on' : ''}${group === 'gap' ? ' mx-tab-gap' : ''}`, onClick: () => setTab(k) }, label, n ? h('i', {}, big(n)) : null)))),
        error ? h('div', { className: 'mx-err', onClick: () => setError('') }, error) : null,
        h('div', { className: 'mx-body' },
          tab === 'template' ? h(Templates, { run, onError: setError })
            : !run ? h('div', { className: 'mx-frame mx-empty', style: { flex: 1 } }, runs.length ? '加载中…' : '还没有批次。点右上角「＋ 新批次」选择病历目录或文件，选一个抽取模板开始。')
              : tab === 'line' ? h(Pipeline, { run, goto: setTab, openPatient })
                : tab === 'formats' ? h(Formats, { run, busy: !!activeId, onRerun: (id) => { setRunId(id); setRun(null); refreshList(); setTab('line') }, onError: setError })
                : tab === 'wide' ? h(Wide, { run, openPatient })
                  : tab === 'source' ? h(Source, { run, patient, setPatient })
                    : tab === 'review' ? h(Review, { run, onError: setError })
                      : tab === 'calls' ? h(Calls, { run })
                        : h(Report, { run })),
        modal === 'settings' ? h('div', { className: 'mx-modal-back', onMouseDown: (e) => { if (e.target === e.currentTarget) setModal(null) } },
          h('div', { className: 'mx-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '设置' },
            h('div', { className: 'mx-modal-head' }, h('h3', {}, '设置 · 病历文书提取'), h('button', { className: 'mx-btn sm', onClick: () => setModal(null), 'aria-label': '关闭' }, '✕')),
            h('div', { className: 'mx-modal-body' }, activeId ? h('div', { className: 'mx-err', style: { marginBottom: 10 } }, '有批次在运行：改动从下一个批次起生效。') : null, h(SettingsSection, { inModal: true })))) : null))
    }

    /* --------------------------------------------------------------- new run */
    function NewRun({ onStarted, onError, onClose, resumable, openSettings }) {
      const [inputDir, setInput] = useState('')
      const [outputRoot, setOut] = useState('')
      const [asOf, setAsOf] = useState('')
      const [template, setTemplate] = useState('')
      const [mode, setMode] = useState('')
      const [p0, setP0] = useState(false)
      const [busy, setBusy] = useState(false)
      const [picking, setPicking] = useState(false)
      const tpls = useAsync(() => call('templates'), [])
      const cfg = useAsync(() => call('config'), [])
      useEffect(() => { const onKey = (e) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [])
      const pick = async () => {
        setPicking(true)
        try { const v = await call('pickFolder'); if (v.path) setInput(v.path) } catch (cause) {
          try { const ws = services.ctx?.get('uiWorkspace'); if (!ws?.pickDirectory) throw cause; const picked = await ws.pickDirectory(); if (picked) setInput(picked) } catch (e) { onError(msg(e)) }
        } finally { setPicking(false) }
      }
      const go = async (payload) => { setBusy(true); try { const v = await call('start', payload); onStarted(v.runId) } catch (e) { onError(msg(e)) } finally { setBusy(false) } }
      const tplList = tpls.value?.templates ?? []
      // 本插件只用模型从文书里抽取：没配抽取模型不能开始
      const noModel = cfg.value && !cfg.value.modelConfigured
      const curMode = MODE_LABEL[mode] ? mode : MODE_LABEL[cfg.value?.mode] ? cfg.value.mode : 'hybrid'
      const resumeOk = resumable && resumable.flow === 'read'
      return h('div', { className: 'mx-pop', role: 'dialog', 'aria-label': '新批次' },
        h('div', { className: 'mx-pop-h' }, h('b', {}, '新批次'), h('button', { className: 'mx-btn sm', onClick: onClose, 'aria-label': '关闭' }, '✕')),
        noModel ? h('div', { className: 'mx-err', style: { margin: 0 } }, '还没有配置抽取模型。本插件只用模型从文书里抽取：先在设置里填写模型端点和模型名称。',
          openSettings ? h('button', { className: 'mx-btn sm', style: { marginLeft: 8 }, onClick: openSettings }, '去设置') : null) : null,
        h('label', { className: 'mx-field' }, '病历目录或文件',
          h('input', { className: 'mx-input', value: inputDir, onChange: (e) => setInput(e.target.value), placeholder: '/path/to/_medical-anonymizer/… 或 notes.ndjson', autoFocus: true }),
          h('div', { className: 'mx-pick' }, h('button', { className: 'mx-btn sm', onClick: pick, disabled: picking }, picking ? '请在弹出的窗口里选择…' : '选择文件夹…'), h('span', { className: 'mx-faint' }, 'p_doc 导出，或 json／ndjson／csv／txt 文书'))),
        h('div', { className: 'mx-grid2 tm' },
          h('label', { className: 'mx-field' }, '抽取模板',
            h('select', { className: 'mx-input', value: template, title: tplList.find((t) => t.id === template)?.name ?? '', onChange: (e) => setTemplate(e.target.value) },
              h('option', { value: '', disabled: true }, '请选择模板…'), tplList.map((t) => h('option', { key: t.id, value: t.id }, `${t.domain ? `${t.domain} · ` : ''}${t.name} · ${t.fields} 字段${t.origin === 'builtin' ? '' : '（我的）'}`)))),
          h('label', { className: 'mx-field' }, '模式',
            h('select', { className: 'mx-input', value: curMode, onChange: (e) => setMode(e.target.value) },
              Object.entries(MODE_LABEL).map(([k, l]) => h('option', { key: k, value: k }, l))))),
        h('label', { className: 'mx-pick', style: { fontSize: 11.5 } }, h('input', { type: 'checkbox', checked: p0, onChange: (e) => setP0(e.target.checked) }), '只抽 P0 字段'),
        h('label', { className: 'mx-field' }, '输出根目录', h('input', { className: 'mx-input', value: outputRoot, onChange: (e) => setOut(e.target.value), placeholder: '空＝设置里的默认值，再缺省为输入旁的 _medical-extract' })),
        h('label', { className: 'mx-field' }, '截至时刻（可空）', h('input', { className: 'mx-input', value: asOf, onChange: (e) => setAsOf(e.target.value), placeholder: 'YYYY-MM-DD HH:mm · 只用此刻以前写成的文书' })),
        h('div', { className: 'mx-pop-act' },
          h('button', { className: 'mx-btn mx-new', style: { flex: 1 }, disabled: !inputDir || !template || busy || noModel, title: noModel ? '先在设置里配置抽取模型' : !template ? '先选择抽取模板' : undefined, onClick: () => go({ inputDir, outputRoot, template, mode: curMode, asOf, priorities: p0 ? ['P0'] : undefined }) }, busy ? '启动中…' : '▶ 开始'),
          resumeOk ? h('button', { className: 'mx-btn', disabled: busy || noModel, title: `继续批次 ${resumable.id}：已完成的分片和模型调用直接复用`, onClick: () => go({ resumeFrom: resumable.id }) }, '↻ 继续') : null))
    }

    /* --------------------------------------------------------------- pipeline */
    function stationsOf(run) {
      const t = run.totals
      const running = run.status === 'running'
      const stage = running ? run.current?.stage : null
      const broken = !running && ['failed', 'cancelled'].includes(run.status)
      const shardFrac = run.shards.total ? run.shards.done / run.shards.total : 0
      const order = ['E3', 'E5', 'E6', 'E7']
      const after = (s) => !running || order.indexOf(stage) > order.indexOf(s)
      const stOf = (s) => (broken ? (s === 'E5' || s === 'E6' || s === 'E7' ? 'idle' : 'part') : !running ? 'done' : s === 'E3' ? (stage === 'E3' ? 'run' : 'done') : stage === s ? 'run' : after(s) ? 'done' : 'idle')
      const gate = (id) => run.gates?.find((g) => g.id === id)
      const gateRow = (id, label, v) => [label, v ?? (gate(id) ? (gate(id).pass ? '通过' : '未过') : '—'), gate(id) ? (gate(id).pass ? 'ok' : 'warn') : '']
      // ab＝场景里屋顶标签用的两字工序名；no（E0–E7）只留作内部编号，不在界面上显示
      const AB = { E0: '模板', E1: '读入', E2: '分派', E3: '取值', E4: '归一', E5: '汇总', E6: '核验', E7: '交付' }
      const st = (no, nm, sub, bigv, unit, rows, state, frac) => ({ no, ab: AB[no], nm, sub, big: bigv, unit, rows, state, frac })
      const methods = t.byMethod ?? {}
      const flow = run.flow ?? (run.model && run.mode !== 'rules' ? 'recall' : 'rules')
      return [
        st('E1', '读入·清洗', run.plan?.format ?? '规划输入', big(t.documents), '文书', [['分片', `${run.shards.done}/${run.shards.total}`, ''], ['结构化记录（不抽取）', t.structured == null ? '—' : big(t.structured), ''], ['速率', run.rate ? `${fmt(run.rate)}/秒` : '—', '']], stOf('E3'), shardFrac),
        st('E2', flow === 'read' ? '分派' : '关键词定位', flow === 'read' ? '按文书类型、栏目把字段派给文书，切成抽取任务' : '每个字段用关键词在文书里找命中', big(flow === 'read' ? t.tasks : t.recalled), flow === 'read' ? '任务' : '命中', [['跳过（截至时刻）', fmt(t.skipped), '']], stOf('E3'), shardFrac),
        st('E3', '取值', flow === 'read' ? '抽取模型通读每个任务，引语回原文定位；规则出规则票' : flow === 'rules' ? '规则对命中处取值' : '规则定值；定不了的片段送模型', big(t.values), '值', [gateRow('①', '验收①', `${fmt(t.quoteFail)} 丢弃`), ['规则', big(methods.rule), ''], ['模型', big((methods.model ?? 0) + (methods['model+rule'] ?? 0)), ''], ['模型调用', `${big(t.calls)}（缓存 ${big(t.cached)}）`, '']], stOf('E3'), shardFrac),
        st('E4', '归一·断言', '单位、日期、选项规范名；否认／既往／家族／计划', fmt(t.invalid + t.outOfRange), '不合规', [gateRow('②', '验收②')], stOf('E3'), shardFrac),
        st('E5', '汇总·派生', '按粒度与取值规则成格；派生字段；冲突登记', fmt(t.conflicts), '冲突', [['病人', big(t.patients), ''], gateRow('③', '验收③')], stOf('E5'), stage === 'E5' ? 0.5 : after('E5') ? 1 : 0),
        st('E6', '抽样核验·复核', run.model?.verifyModel ? `核验模型 ${run.model.verifyModel}` : '未配置核验模型', fmt(t.review), '待复核', [gateRow('④', '验收④')], t.review && !running ? 'hold' : stOf('E6'), after('E6') ? 1 : 0),
        st('E7', '交付', '宽表 → 证据长表 → 冲突表 → 只读核对', run.output ? '已写出' : '—', '', [['输出', run.output ? '已写出' : '未交付', run.output ? 'ok' : '']], run.output ? 'done' : stOf('E7'), run.output ? 1 : 0),
        st('E0', '模板', `${run.template.name} v${run.template.version}`, String(run.template.fields), '字段', [['模式', modeLabel(run.mode), '']], 'done', 1),
      ]
    }

    function Pipeline({ run, goto, openPatient }) {
      const stations = stationsOf(run)
      const hot = stations.filter((s) => s.state === 'run' || s.state === 'hold')
      const defSel = Math.max(0, stations.findIndex((s) => s.state === 'run' || s.state === 'hold'))
      const [selK, setSelK] = useState(null)
      const k = selK ?? (defSel >= 0 ? defSel : 2)
      // 布局同匿名化插件：左列＝2.5D 产线（撑满）＋底部「进展｜结果｜监控」；右列＝所选工序的详情，拉到底
      return h('div', { className: 'mx-scroll', style: { flex: 1, display: 'flex' } },
        h('div', { className: 'mx-line' },
          h('div', { className: 'mx-line-left' },
          h('div', { className: 'mx-frame mx-hero' },
            h('div', { className: 'mx-hero-cap' },
              h('span', { className: 'mx-cap', style: { color: 'var(--ink2)' } }, '处理流程'),
              h('span', { className: 'mx-sp' }),
              run.status === 'failed' ? h('span', { className: 'mx-live bad' }, h('i'), '批次失败') : run.status === 'cancelled' ? h('span', { className: 'mx-live bad' }, h('i'), '已取消') : hot.length ? h('span', { className: 'mx-live' }, h('i'), hot.map((s) => `${s.nm} ${STATE_LABEL[s.state]}`).join(' · ')) : h('span', { className: 'mx-live ok' }, h('i'), '全部完成')),
            run.status === 'failed' && run.error ? h('div', { className: 'mx-err mx-hero-err' }, h('b', {}, '批次失败：'), String(run.error).split('\n')[0].replace(/^Error:\s*/, '')) : null,
            h(PlantScene, { run, stations, sel: k, onSel: setSelK, goto }),
            h('div', { className: 'mx-hud br' },
              h('div', {}, h('i', { className: 'sw hot' }), '运行中／待复核'), h('div', {}, h('i', { className: 'sw clay' }), '已完成'),
              h('div', {}, h('i', { className: 'sw box' }), '箱子＝一个分片'), h('div', {}, h('i', { className: 'sw red' }), '红色＝验收门未过'),
              h('div', {}, h('i', { className: 'sw vio' }), '青灯＝抽取模型（取值时通读）'), h('div', {}, h('i', { className: 'sw flow' }), '紫色流线＝字段规格下发'))),
          h('div', { className: 'mx-frame mx-bottom' },
            h(ProgressPanel, { run }),
            h(ResultsPanel, { run, stations, onSel: setSelK, goto }),
            h(ResourcesPanel, { run }))),
          h(StationPanel, { run, s: stations[k], goto })))
    }

    /* 等轴测投影（与病历事件还原一致） */
    const IX = [0.94, 0.26]; const JX = [-0.66, 0.58]
    const iso = (i, j, z = 0) => [i * IX[0] + j * JX[0], i * IX[1] + j * JX[1] - z]
    const depthOf = (i, j) => i * IX[1] + j * JX[1]
    function isoBox(key, i, j, z, a, b, hh, { top, left, right, edge, props } = {}) {
      const s = edge ? { stroke: edge, strokeWidth: 0.6, strokeLinejoin: 'round' } : {}
      return [
        h('polygon', { key: `${key}l`, points: pts([iso(i, j + b, z), iso(i + a, j + b, z), iso(i + a, j + b, z + hh), iso(i, j + b, z + hh)]), fill: left, ...s, ...props }),
        h('polygon', { key: `${key}r`, points: pts([iso(i + a, j, z), iso(i + a, j + b, z), iso(i + a, j + b, z + hh), iso(i + a, j, z + hh)]), fill: right, ...s, ...props }),
        h('polygon', { key: `${key}t`, points: pts([iso(i, j, z + hh), iso(i + a, j, z + hh), iso(i + a, j + b, z + hh), iso(i, j + b, z + hh)]), fill: top, ...s, ...props }),
      ]
    }
    const leftPatch = (key, i0, i1, j, z0, z1, props) => h('polygon', { key, points: pts([iso(i0, j, z0), iso(i1, j, z0), iso(i1, j, z1), iso(i0, j, z1)]), ...props })
    const rightPatch = (key, i, j0, j1, z0, z1, props) => h('polygon', { key, points: pts([iso(i, j0, z0), iso(i, j1, z0), iso(i, j1, z1), iso(i, j0, z1)]), ...props })
    function isoCyl(key, ci, cj, z, r, hh, C) {
      const [x0, y0] = iso(ci, cj, z); const [, y1] = iso(ci, cj, z + hh)
      const rx = r * 1.12; const ry = r * 0.62
      return [
        h('ellipse', { key: `${key}b`, cx: x0, cy: y0, rx, ry, fill: C.right }),
        h('rect', { key: `${key}m`, x: x0 - rx, y: y1, width: rx * 2, height: y0 - y1, fill: 'url(#mx-cyl)' }),
        h('ellipse', { key: `${key}t`, cx: x0, cy: y1, rx, ry, fill: C.top, stroke: C.edge, strokeWidth: 0.6 }),
        h('ellipse', { key: `${key}h`, cx: x0, cy: y1, rx: rx * 0.62, ry: ry * 0.62, fill: C.hole }),
      ]
    }

    /**
     * 产线主视图：后方的模板塔（E0）经规格总线把字段规格下发到每道工序；
     * E1 读入楼 → E2–E6 五栋工序楼 → E7 交付堆场；箱子＝一个分片；抽取模型挂在取值楼旁。
     */
    function PlantScene({ run, stations, sel, onSel, goto }) {
      const [P, C] = useClay()
      const A = P.teal
      const t = run.totals
      const running = run.status === 'running'
      const tone = (s) => (s.state === 'hold' || s.state === 'run' ? A : null)
      const L = 150; const bw = 72; const D = 104; const H = 50
      const h0 = 84 + (L - bw)
      const bay0 = (k) => h0 + (k - 1) * L
      const hallEnd = bay0(5) + bw
      const yard = hallEnd + (L - bw)
      const els = []; const defs = []; const bb = []
      const click = (k) => ({ onClick: () => onSel(k), style: { cursor: 'pointer' } })
      const halo = { stroke: C.card, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }
      const AMB = { top: shade(A, 0.3), left: A, right: shade(A, -0.32) }
      const RED = { top: shade(P.bad, 0.3), left: P.bad, right: shade(P.bad, -0.35) }
      const CL = { top: C.top, left: C.left, right: C.right, edge: C.edge }
      const CL2 = { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }
      const TW = { i: 96, j: -236, a: 56, b: 56, hh: 128 }
      const gi0 = -140; const gi1 = yard + 220; const gj0 = -280; const gj1 = D + 170
      const grid = []
      for (let i = gi0; i <= gi1; i += 40) { const a = iso(i, gj0); const b = iso(i, gj1); grid.push(h('line', { key: `gi${i}`, x1: a[0], y1: a[1], x2: b[0], y2: b[1] })) }
      for (let j = gj0; j <= gj1; j += 40) { const a = iso(gi0, j); const b = iso(gi1, j); grid.push(h('line', { key: `gj${j}`, x1: a[0], y1: a[1], x2: b[0], y2: b[1] })) }
      defs.push(h('radialGradient', { key: 'rg', id: 'mx-fade', cx: '50%', cy: '55%', r: '55%' }, h('stop', { offset: 0, stopColor: '#fff', stopOpacity: 1 }), h('stop', { offset: 1, stopColor: '#fff', stopOpacity: 0 })))
      defs.push(h('filter', { key: 'bl', id: 'mx-blur', x: '-30%', y: '-30%', width: '160%', height: '160%' }, h('feGaussianBlur', { stdDeviation: 9 })))
      defs.push(h('filter', { key: 'gl', id: 'mx-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, h('feGaussianBlur', { stdDeviation: 3.5, result: 'b' }), h('feMerge', {}, h('feMergeNode', { in: 'b' }), h('feMergeNode', { in: 'SourceGraphic' }))))
      defs.push(h('marker', { key: 'ar', id: 'mx-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, h('path', { d: 'M0 0L10 5L0 10z', fill: P.ink2 })))
      defs.push(h('linearGradient', { key: 'cy', id: 'mx-cyl', x1: 0, x2: 1, y1: 0, y2: 0 }, h('stop', { offset: 0, stopColor: C.left2 }), h('stop', { offset: 0.55, stopColor: C.left }), h('stop', { offset: 1, stopColor: C.right })))
      els.push(h('g', { key: 'grid', stroke: C.grid, strokeOpacity: 0.07, strokeWidth: 0.8, mask: 'url(#mx-gridmask)' }, grid))
      const shadow = (key, i, j, a, b, push = 26) => h('polygon', { key, points: pts([iso(i + 6, j + 4), iso(i + a + push, j + 4), iso(i + a + push, j + b + push * 0.5), iso(i + 6, j + b + push * 0.5)]), fill: C.floorShadow, opacity: 0.55, filter: 'url(#mx-blur)' })
      els.push(shadow('sh1', 0, 8, 84, 100), shadow('sh3', yard, 6, 150, 130, 14), shadow('shT', TW.i, TW.j, TW.a, TW.b, 40))
      for (let k = 1; k <= 5; k++) els.push(shadow(`sb${k}`, bay0(k), 0, bw, D, 24))
      // 站序号 → 在场景里的位置：0=E1 楼，1–5=E2–E6，6=E7 堆场，7=E0 模板塔
      const footprint = (k) => (k === 0 ? [0, 8, 84, 100] : k === 6 ? [yard, 6, 150, 130] : k === 7 ? [TW.i, TW.j, TW.a, TW.b] : [bay0(k), 0, bw, D])
      {
        const [fi, fj, fa, fb] = footprint(sel); const m = 10
        const corners = [[fi - m, fj - m], [fi + fa + m, fj - m], [fi + fa + m, fj + fb + m], [fi - m, fj + fb + m]]
        els.push(h('polygon', { key: 'selfloor', points: pts(corners.map(([a, b]) => iso(a, b))), fill: A, opacity: 0.07 }))
        corners.forEach(([ci, cj], q) => {
          const di = q === 0 || q === 3 ? 1 : -1; const dj = q < 2 ? 1 : -1
          els.push(h('polyline', { key: `br${q}`, points: pts([iso(ci + di * 16, cj), iso(ci, cj), iso(ci, cj + dj * 16)]), fill: 'none', stroke: A, strokeWidth: 1.6, opacity: 0.9 }))
        })
      }
      // E0 模板塔：窗户＝字段（点亮＝本批抽到值的字段）
      {
        const { i, j, a, b, hh } = TW; const g = []
        g.push(...isoBox('tp', i - 10, j - 10, 0, a + 20, b + 20, 4, { top: C.pad, left: C.padL, right: C.padR }))
        g.push(...isoBox('t', i, j, 4, a, b, hh, CL))
        g.push(...isoBox('tc', i + 8, j + 8, hh + 4, a - 16, b - 16, 12, CL2))
        const nf = run.template.fields; const filled = Object.keys(run.byField ?? {}).length
        const litN = Math.round((nf ? filled / nf : 0) * 28)
        let q = 0
        for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) {
          const z = 18 + r * 15; const ii = i + 6 + c * 12; const lit = q++ < litN
          g.push(leftPatch(`tw${r}${c}`, ii, ii + 7, j + b, z, z + 9, { fill: lit ? C.lamp : C.win, opacity: lit ? 0.9 : 0.55 }))
        }
        for (let r = 0; r < 7; r++) g.push(rightPatch(`tr${r}`, i + a, j + 10, j + 46, 18 + r * 15, 18 + r * 15 + 3, { fill: C.win, opacity: 0.45 }))
        const z0 = hh + 22
        g.push(h('polygon', { key: 'holo', points: pts([iso(i + 6, j + 6, z0), iso(i + a - 6, j + 6, z0), iso(i + a - 6, j + b - 6, z0), iso(i + 6, j + b - 6, z0)]), fill: A, opacity: 0.16, stroke: A, strokeWidth: 1, filter: 'url(#mx-glow)' }))
        for (let r = 1; r < 4; r++) { const p1 = iso(i + 6, j + 6 + r * 11, z0); const p2 = iso(i + a - 6 - r * 6, j + 6 + r * 11, z0); g.push(h('line', { key: `hl${r}`, x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: A, strokeWidth: 1, opacity: 0.8 })) }
        const lp = iso(i + a / 2, j + b / 2, z0 + 2)
        g.push(h('text', { key: 'tl', x: lp[0], y: lp[1] - 4, textAnchor: 'middle', fill: A, fontSize: 10, fontWeight: 700, fontFamily: MONO, ...halo }, `${run.template.id} v${run.template.version}`))
        els.push(h('g', { key: 'tower', ...click(7) }, h('title', {}, `${stations[7].nm}：${stations[7].sub}`), g))
        bb.push(iso(i - 10, j - 10, 0), iso(i + a, j, z0 + 30), iso(i - 10, j + b + 10, 0))
      }
      // 规格总线
      const BUSJ = -24; const BUSZ = 74
      {
        const g = []
        const a = iso(TW.i + TW.a / 2, TW.j + TW.b, BUSZ + 26); const b = iso(TW.i + TW.a / 2, BUSJ, BUSZ); const c = iso(bay0(5) + bw / 2, BUSJ, BUSZ)
        for (let k = 1; k <= 5; k++) g.push(...isoBox(`pl${k}`, bay0(k) - 30, BUSJ - 3, 0, 5, 5, BUSZ, CL2))
        g.push(h('polyline', { key: 'bus', points: pts([a, b, c]), fill: 'none', stroke: C.left2, strokeWidth: 5, strokeLinejoin: 'round', strokeLinecap: 'round' }))
        g.push(h('polyline', { key: 'busf', points: pts([a, b, c]), fill: 'none', stroke: A, strokeWidth: 2, strokeDasharray: '2 8', className: 'mx-flow', style: { animationDuration: running ? '0.9s' : '3.2s' }, filter: 'url(#mx-glow)', strokeLinecap: 'round' }))
        for (let k = 1; k <= 5; k++) {
          const d0 = iso(bay0(k) - 30 + 2.5, BUSJ, BUSZ); const d1 = iso(bay0(k) + 4, 4, H + 1)
          g.push(h('path', { key: `dr${k}`, d: `M${d0[0].toFixed(1)} ${d0[1].toFixed(1)} Q${((d0[0] + d1[0]) / 2).toFixed(1)} ${(d0[1] - 6).toFixed(1)} ${d1[0].toFixed(1)} ${d1[1].toFixed(1)}`, fill: 'none', stroke: A, strokeWidth: 1.2, strokeDasharray: '2 4', opacity: 0.75 }))
        }
        els.push(h('g', { key: 'busg', pointerEvents: 'none' }, g))
      }
      // E1 读入楼：窗户＝分片进度
      {
        const s = stations[0]; const g = []
        g.push(...isoBox('ramp', -60, 44, 0, 60, 24, 8, CL))
        g.push(...isoBox('b', 0, 8, 0, 84, 100, 88, CL))
        g.push(...isoBox('cap', 8, 18, 88, 50, 40, 10, CL2))
        g.push(...isoBox('vent', 56, 70, 88, 18, 22, 14, CL2))
        const wins = []
        for (let z = 66; z >= 14; z -= 13) for (let i = 8; i < 78; i += 12) wins.push([i, z])
        const litN = Math.round((s.frac ?? 0) * wins.length)
        wins.forEach(([i, z], q) => { const lit = q < litN; g.push(leftPatch(`w${z}-${i}`, i, i + 7, 108, z, z + 6, { fill: lit ? (s.state === 'run' ? A : C.lamp) : C.win, opacity: lit ? 0.95 : 0.55, filter: lit && s.state === 'run' ? 'url(#mx-glow)' : undefined })) })
        els.push(h('g', { key: 'e1', ...click(0) }, h('title', {}, s.nm), g))
      }
      // 走廊与验收门：①在 E3 出口，②在 E4 出口，③在 E5 出口，④在 E6 出口
      const gateOf = (id) => run.gates?.find((x) => x.id === id)
      const GATE_AFTER = { 3: '①', 4: '②', 5: '③', 6: '④' }
      const corridor = (key, i0, i1, k) => {
        const cj = D - 30
        const a = iso(i0, cj + 24, 24); const b = iso(i1, cj + 24, 24)
        let gate = null
        const gid = GATE_AFTER[k]
        if (gid) {
          const g = gateOf(gid)
          const gc = !g ? P.ink3 : g.skipped ? P.ink2 : g.pass ? P.ok : P.bad
          // 整段传送带顶面染色（绿＝通过、红＝未过），出口接缝一个带编号的圆点；文字只在未过时出现
          const top = pts([iso(i0, cj, 32), iso(i1, cj, 32), iso(i1, cj + 24, 32), iso(i0, cj + 24, 32)])
          const e0 = iso(i0, cj + 24, 32); const e1 = iso(i1, cj + 24, 32)
          const dp = iso((i0 + i1) / 2, cj + 12, 32)
          const fail = g && !g.pass && !g.skipped
          gate = h('g', { key: 'gate' },
            h('title', {}, g ? `${g.label}：${g.skipped ? '跳过' : g.pass ? '通过' : '未过'}${g.detail ? `（${g.detail}）` : ''}` : '验收门：批次结束时判定'),
            h('polygon', { points: top, fill: gc, opacity: g ? 0.3 : 0.12 }),
            h('line', { x1: e0[0], y1: e0[1], x2: e1[0], y2: e1[1], stroke: gc, strokeWidth: 2, strokeLinecap: 'round', opacity: g ? 0.95 : 0.5 }),
            h('circle', { cx: dp[0], cy: dp[1], r: 7, fill: gc, stroke: C.card, strokeWidth: 1.5 }),
            h('text', { x: dp[0], y: dp[1] + 3.3, textAnchor: 'middle', fill: '#fff', fontSize: 9, fontWeight: 700, fontFamily: MONO }, gid.charCodeAt(0) - 0x245f),
            fail ? h('text', { x: dp[0] + 11, y: dp[1] - 6, fill: P.bad, fontSize: 10.5, fontWeight: 600, ...halo }, '未过') : null)
        }
        return h('g', { key },
          isoBox('c', i0, cj, 14, i1 - i0, 24, 18, CL2),
          leftPatch('cw', i0 + 2, i1 - 2, cj + 24, 19, 29, { fill: C.win, opacity: 0.6 }),
          h('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: running ? A : P.ink3, strokeWidth: 2.4, strokeLinecap: 'round', strokeDasharray: '2 8', className: 'mx-flow', style: { animationDuration: running ? '0.9s' : '3.2s' }, filter: running ? 'url(#mx-glow)' : undefined, opacity: running ? 1 : 0.7 }),
          gate)
      }
      for (let k = 1; k <= 5; k++) {
        const s = stations[k]; const i0 = bay0(k)
        const c = tone(s); const lit = !!c
        els.push(corridor(`co${k}`, k === 1 ? 84 : bay0(k - 1) + bw, i0, k))
        const g = []
        g.push(...isoBox('b', i0, 0, 0, bw, D, H, CL))
        g.push(leftPatch('plinth', i0, i0 + bw, D, 0, 5, { fill: C.right, opacity: 0.6 }))
        for (let w = 0; w < 3; w++) { const wi = i0 + 8 + w * 20; g.push(leftPatch(`hw${w}`, wi, wi + 12, D, 20, 36, { fill: lit ? A : C.win, opacity: lit ? 0.85 : 0.6, filter: lit ? 'url(#mx-glow)' : undefined })) }
        const roof = []
        for (let a = 0; a < 4; a++) for (let b2 = 0; b2 < 2; b2++) { if (k === 4 && b2 === 1) continue; if (k === 5 && b2 === 1 && a >= 2) continue; roof.push([b2, a]) }
        roof.sort((p, q) => depthOf(p[0] * 30, p[1] * 24) - depthOf(q[0] * 30, q[1] * 24))
        const litN = s.state === 'hold' ? roof.length : s.state === 'run' ? Math.max(1, Math.round((s.frac ?? 0) * roof.length)) : 0
        roof.forEach(([b2, a], idx) => {
          const ui = i0 + 8 + b2 * 30; const uj = 8 + a * 24; const on = idx < litN && c
          g.push(...isoBox(`u${a}${b2}`, ui, uj, H, 20, 18, 7, on ? { top: shade(c, 0.25), left: c, right: shade(c, -0.3), props: { filter: 'url(#mx-glow)' } } : CL2))
          const f = iso(ui + 10, uj + 9, H + 7)
          g.push(h('ellipse', { key: `f${a}${b2}`, cx: f[0], cy: f[1], rx: 7.5, ry: 4, fill: on ? shade(c, -0.45) : C.hole, opacity: 0.85 }))
        })
        if (k === 4) [[i0 + 50, 20], [i0 + 54, 50], [i0 + 50, 80]].forEach(([ci, cj], q) => g.push(...isoCyl(`st${q}`, ci, cj, H, 5, 30 + q * 6, C)))
        if (k === 5) g.push(...isoBox('ctl', i0 + 36, 56, H, 26, 36, 16, CL2), leftPatch('ctlw', i0 + 39, i0 + 59, 92, H + 6, H + 12, { fill: c ?? C.win, opacity: c ? 0.9 : 0.6 }))
        if (sel === k) g.push(h('polygon', { key: 'selroof', points: pts([iso(i0 + 2, 2, H + 0.5), iso(i0 + bw - 2, 2, H + 0.5), iso(i0 + bw - 2, D - 2, H + 0.5), iso(i0 + 2, D - 2, H + 0.5)]), fill: 'none', stroke: A, strokeWidth: 1.4, strokeDasharray: '5 4', opacity: 0.9 }))
        els.push(h('g', { key: `bay${k}`, className: s.state === 'hold' ? 'mx-breathe' : undefined, ...click(k) }, h('title', {}, `${s.nm}：${s.sub}`),
          h('polygon', { points: pts([iso(i0, 0, H), iso(i0 + bw, 0, H), iso(i0 + bw, D, H), iso(i0 + bw, D, 0), iso(i0, D, 0), iso(i0, D, H)]), fill: 'transparent' }), g))
      }
      els.push(corridor('co6', hallEnd, yard, 6))
      // E7 交付堆场：三台出货单元＝宽表、证据长表、冲突表；箱子＝已完成的分片
      {
        const s = stations[6]; const g = []
        g.push(...isoBox('pad', yard, 6, 0, 150, 130, 4, { top: C.pad, left: C.padL, right: C.padR }))
        const unit = (key, ui, uj, label) => {
          g.push(...isoBox(key, ui, uj, 4, 30, 30, 22, CL2))
          const f = iso(ui + 15, uj + 15, 26)
          g.push(h('ellipse', { key: `${key}f`, cx: f[0], cy: f[1], rx: 11.5, ry: 6.5, fill: C.hole }), h('ellipse', { key: `${key}g`, cx: f[0], cy: f[1], rx: 8, ry: 4.5, fill: 'none', stroke: C.left, strokeWidth: 1 }))
          const tp = iso(ui + 15, uj + 15, 40)
          g.push(h('text', { key: `${key}t`, x: tp[0], y: tp[1], textAnchor: 'middle', fill: P.ink2, fontSize: 9, ...halo }, label))
        }
        unit('du0', yard + 10, 14, '宽表'); unit('du1', yard + 60, 14, '证据长表'); unit('du2', yard + 110, 14, '冲突表')
        const crates = Math.min(run.shards.done, 12)
        const cells = []
        for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 4; c2++) cells.push([yard + 12 + c2 * 34, 58 + r * 24])
        cells.slice(0, crates).sort((a, b) => depthOf(a[0], a[1]) - depthOf(b[0], b[1])).forEach(([ci, cj], q) => {
          g.push(...isoBox(`cr${q}`, ci, cj, 4, 22, 18, 13, CL2))
          const a = iso(ci, cj + 9, 17); const b = iso(ci + 22, cj + 9, 17)
          g.push(h('line', { key: `ct${q}`, x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: A, strokeWidth: 1.4, opacity: 0.85 }))
        })
        if (run.output) {
          const m = [[yard + 4, 10], [yard + 146, 10], [yard + 146, 132], [yard + 4, 132]]
          m.forEach(([ci, cj], q) => { const di = q === 0 || q === 3 ? 1 : -1; const dj = q < 2 ? 1 : -1; g.push(h('polyline', { key: `dk${q}`, points: pts([iso(ci + di * 12, cj, 4), iso(ci, cj, 4), iso(ci, cj + dj * 12, 4)]), fill: 'none', stroke: A, strokeWidth: 1.8, filter: 'url(#mx-glow)' })) })
        }
        els.push(h('g', { key: 'e7', opacity: s.state === 'idle' ? 0.6 : 1, ...click(6) }, h('title', {}, s.nm), g))
        const [x, y] = iso(yard + 6, 150)
        els.push(h('g', { key: 'yardcap', transform: `matrix(${IX[0]} ${IX[1]} ${JX[0]} ${JX[1]} ${x.toFixed(1)} ${y.toFixed(1)})`, pointerEvents: 'none' },
          h('text', { x: 0, y: 0, fill: P.ink3, fontSize: 9.5 }, '每个值带原文引语 · 只读核对 · 移交')))
      }
      // 门前排队：箱子＝等待处理的分片
      {
        const waiting = Math.max(0, run.shards.total - run.shards.done - (run.shards.running ?? 0))
        const loads = [running ? waiting : 0, 0, 0, 0, 0, run.totals.review && !running ? Math.min(36, Math.ceil(run.totals.review / 10)) : 0]
        const label = ['等待读入（分片）', '', '', '', '', '待复核（每箱 10 项）']
        const pileAt = (k) => (k === 0 ? [12, 116] : [bay0(k) + 14, D + 12])
        loads.forEach((_, k) => { const [pi, pj] = pileAt(k); bb.push(iso(pi, pj + 24), iso(pi + 39, pj, 70)) })
        loads.forEach((n, k) => {
          if (!n) return
          const [pi, pj] = pileAt(k); const hot = k === 5
          const shown = Math.min(36, n); const g = []
          for (let q = 0; q < shown; q++) {
            const lv = Math.floor(q / 6); const a = q % 3; const c = Math.floor((q % 6) / 3)
            const ci = pi + a * 13; const cj = pj + c * 12; const z = lv * 9
            g.push(...isoBox(`p${q}`, ci, cj, z, 11, 10, 8, hot ? AMB : CL2))
            if (!hot) { const t1 = iso(ci, cj + 5, z + 8); const t2 = iso(ci + 11, cj + 5, z + 8); g.push(h('line', { key: `pt${q}`, x1: t1[0], y1: t1[1], x2: t2[0], y2: t2[1], stroke: A, strokeWidth: 1, opacity: 0.8 })) }
          }
          const top = iso(pi + 19, pj + 11, Math.ceil(shown / 6) * 9 + 10)
          const shownN = k === 5 ? run.totals.review : n
          els.push(h('g', { key: `q${k}`, ...click(k) }, g,
            h('text', { x: top[0], y: top[1], textAnchor: 'middle', fill: A, fontSize: 17, fontWeight: 700, fontFamily: MONO, stroke: C.card, strokeWidth: 3.5, paintOrder: 'stroke' }, fmt(shownN)),
            h('text', { x: top[0], y: top[1] + 13, textAnchor: 'middle', fill: P.ink, fontSize: 10, stroke: C.card, strokeWidth: 3, paintOrder: 'stroke' }, `排队 · ${label[k]}`)))
        })
      }
      // 验收门①：丢弃的引语（红箱）
      if (t.quoteFail) {
        const gi = (bay0(2) + bw + bay0(3)) / 2 - 7; const gg = []
        for (let q = 0; q < Math.min(4, Math.ceil(t.quoteFail / 10)); q++) gg.push(...isoBox(`rq${q}`, gi + (q % 2) * 15 - 4, D + 6 + Math.floor(q / 2) * 13, 0, 13, 12, 11, RED))
        // 标签放在红箱正上方：左下是去模型旁路的斜管，下方是回 E6 的横管
        const lp = iso(gi + 5, D + 12, 22)
        gg.push(h('text', { key: 't', x: lp[0], y: lp[1], textAnchor: 'middle', fill: P.bad, fontSize: 10, ...halo }, h('title', {}, '模型回答的引语在原文里找不到，或引语不支持所取的值：已丢弃，不进交付'), `${fmt(t.quoteFail)} 条模型回答已丢弃`))
        els.push(h('g', { key: 'redq' }, gg))
      }
      // 处理中：发光的箱子
      if (running && run.current?.stage === 'E3') {
        const at = [bay0(2) + 30, D + 6]; const tp = iso(at[0] + 8, at[1] + 14, 0)
        els.push(h('g', { key: 'cur' }, h('g', { filter: 'url(#mx-glow)', className: 'mx-pulse' }, isoBox('cc', at[0], at[1], 0, 16, 14, 13, AMB)),
          h('text', { x: tp[0] - 14, y: tp[1] + 16, textAnchor: 'end', fill: A, fontSize: 10.5, fontWeight: 700, ...halo }, `处理中 · ${run.shards.running ?? 0} 个分片${run.rate ? ` · ${fmt(run.rate)} 份/秒` : ''}`)))
      }
      // 抽取模型（取值时通读）
      {
        const on = !!run.model; const V = P.vio
        // 楼号：bay0(1)=分派 E2，bay0(2)=取值 E3（抽取模型在这里），bay0(5)=核验 E6（核验模型）
        const mi = bay0(2) + 30; const mj = D + 118; const ma = 70; const mb = 42; const mh = 28
        const g = []
        g.push(...isoBox('mp', mi - 6, mj - 6, -3, ma + 12, mb + 12, 3, { top: C.pad, left: C.padL, right: C.padR }))
        const pipe = (key, from, to) => { const a = iso(...from); const b = iso(...to); return h('line', { key, x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: on ? V : C.left2, strokeWidth: on ? 1.8 : 1.4, strokeDasharray: '3 6', className: on ? 'mx-flow' : undefined, filter: on ? 'url(#mx-glow)' : undefined, opacity: on ? 1 : 0.5 }) }
        g.push(pipe('p1', [bay0(2) + 40, D, 22], [mi + 14, mj, mh - 4]), pipe('p2', [mi + ma - 14, mj, mh - 4], [bay0(5) + 22, D, 22]))
        g.push(...isoBox('mb', mi, mj, 0, ma, mb, mh, CL))
        for (let w = 0; w < 3; w++) g.push(leftPatch(`mw${w}`, mi + 8 + w * 20, mi + 20 + w * 20, mj + mb, 9, 19, { fill: on ? V : C.win, opacity: on ? 0.9 : 0.55, filter: on ? 'url(#mx-glow)' : undefined }))
        g.push(...isoBox('mbk', mi + 48, mj + 14, mh, 10, 10, 7, on ? { top: shade(V, 0.3), left: V, right: shade(V, -0.3) } : CL2))
        const lt = iso(mi - 10, mj + mb + 10)
        g.push(h('text', { key: 't1', x: lt[0], y: lt[1] + 6, textAnchor: 'end', fill: on ? V : P.ink3, fontSize: 11, fontWeight: 600, ...halo }, '抽取模型（通读）'),
          h('text', { key: 't2', x: lt[0], y: lt[1] + 20, textAnchor: 'end', fill: P.ink2, fontSize: 9.5, ...halo }, on ? `调用 ${big(t.calls)} · 缓存 ${big(t.cached)} · 引语回原文核对` : '未配置模型 · 只跑规则'))
        els.push(h('g', { key: 'model', ...click(2) }, h('title', {}, on ? `抽取模型 ${run.model.model}${run.model.verifyModel ? `；核验模型 ${run.model.verifyModel}` : ''}` : '未配置模型'), g))
        bb.push(iso(mi - 6, mj + mb + 6), iso(mi - 160, mj + mb + 40), iso(mi + ma, mj + mb + 6))
      }
      // 裁定回流
      {
        const a = iso(bay0(5) + 40, D + 40); const b = iso(bay0(4) + 50, D + 40)
        const mx = (a[0] + b[0]) / 2; const my = Math.max(a[1], b[1]) + 34
        els.push(h('g', { key: 'loop', pointerEvents: 'none' },
          h('path', { d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`, fill: 'none', stroke: P.ink2, strokeWidth: 1.4, strokeDasharray: '5 5', markerEnd: 'url(#mx-arr)' }),
          h('text', { x: mx, y: my - 8, textAnchor: 'middle', fill: P.ink2, fontSize: 10, ...halo }, '裁定按稳定编号存 · 重跑沿用')))
      }
      // 屋顶标签：贴在每栋楼顶上方的胶囊，不用引线；只放两字工序名＋关键数＋单位，验收门一个色点；选中＝实心
      // 细节（阶段名、说明、各行数）在悬停提示和右侧阶段面板里
      const textW = (str, fs, mono) => [...String(str)].reduce((w, ch) => w + (/[\u2E80-\uFFFF]/.test(ch) ? fs : fs * (mono ? 0.62 : 0.56)), 0)
      const gateDot = { ok: P.ok, warn: P.bad, '': P.ink3 }
      const anchor = (k) => (k === 0 ? iso(42, 58, 122) : k === 6 ? iso(yard + 75, 40, 66) : k === 7 ? iso(TW.i + TW.a / 2, TW.j + TW.b / 2, TW.hh + 46) : iso(bay0(k) + bw / 2, D / 2, H + 36))
      stations.forEach((s, k) => {
        const [x, y] = anchor(k)
        const on = k === sel; const hotS = s.state === 'hold' || s.state === 'run'
        const g = s.rows.find((r) => /^验收/.test(r[0]))
        const w = 9 + textW(s.ab, 10.5) + 6 + textW(s.big, 12.5, true) + (s.unit ? textW(s.unit, 9.5) + 3 : 0) + (g ? 13 : 0) + 9
        const hh = 21; const x0 = x - w / 2; const y0 = y - hh - 5
        const bg = on ? A : C.card; const line = hotS || on ? A : C.cardLine
        bb.push([x0, y0], [x0 + w, y])
        els.push(h('g', { key: `tag${k}`, ...click(k) },
          h('title', {}, [`${s.nm}：${s.sub}`, ...s.rows.map(([l, v]) => `${l}：${v}`)].join('\n')),
          h('rect', { x: x0, y: y0, width: w, height: hh, rx: hh / 2, fill: bg, stroke: line, strokeWidth: hotS ? 1.4 : 1 }),
          h('path', { d: `M${x - 4} ${y0 + hh - 0.5}L${x} ${y - 1}L${x + 4} ${y0 + hh - 0.5}Z`, fill: bg, stroke: line, strokeWidth: 1 }),
          h('rect', { x: x - 4.6, y: y0 + hh - 2, width: 9.2, height: 2.4, fill: bg }),
          h('text', { x: x0 + 9, y: y0 + 14.5, fill: on ? '#fff' : hotS ? A : P.ink2, fontSize: 10.5, fontWeight: 600 }, s.ab,
            h('tspan', { dx: 6, fill: on ? '#fff' : P.ink, fontSize: 12.5, fontWeight: 700, fontFamily: MONO }, s.big),
            s.unit ? h('tspan', { dx: 3, fill: on ? 'rgba(255,255,255,.75)' : P.ink3, fontSize: 9.5, fontWeight: 400 }, s.unit) : null),
          g ? h('circle', { cx: x0 + w - 12, cy: y0 + hh / 2, r: 3.6, fill: gateDot[g[2]] ?? P.ink3, stroke: on ? '#fff' : 'none', strokeWidth: 1 }) : null))
      })
      for (const [i, j, a, b, z] of [[-60, 44, 60, 24, 8], [0, 8, 84, 100, 112], [h0, 0, hallEnd - h0, D, H + 70], [yard, 6, 150, 160, 30], [bay0(3) + 20, D + 110, 90, 60, 30]]) {
        for (const [di, dj] of [[0, 0], [a, 0], [a, b], [0, b]]) bb.push(iso(i + di, j + dj, 0), iso(i + di, j + dj, z))
      }
      const xs = bb.map((p) => p[0]); const ys = bb.map((p) => p[1])
      const x0 = Math.min(...xs) - 24; const y0 = Math.min(...ys) - 16; const x1 = Math.max(...xs) + 24; const y1 = Math.max(...ys) + 16
      defs.push(h('mask', { key: 'mk', id: 'mx-gridmask', maskUnits: 'userSpaceOnUse', x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, h('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'url(#mx-fade)' })))
      // 键盘：场景本身是一个 Tab 停靠点，←／→ 按工序顺序（模板塔在前）切换
      const ORDER = [7, 0, 1, 2, 3, 4, 5, 6]
      const onKeyDown = (e) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
        if (!d) return
        e.preventDefault()
        onSel(ORDER[(ORDER.indexOf(sel) + d + ORDER.length) % ORDER.length])
      }
      return h('svg', { className: 'mx-scene', tabIndex: 0, role: 'group', 'aria-label': `处理流程，当前 ${stations[sel].nm}（←／→ 切换工序）`, onKeyDown, viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, preserveAspectRatio: 'xMidYMin meet', style: { maxHeight: 620, overflow: 'hidden' } }, h('defs', {}, defs), els)
    }

    /* 每道工序：做什么 → 产出什么（引擎的通用工序说明，不含病种内容） */
    const STEP_HELP = {
      E0: ['载入抽取模板并校验：字段、取值类型、选项、召回词与规则', '字段规格，下发给后面每道工序'],
      E1: ['识别格式，按表判定类别：文书表读入，检验、医嘱、收费等结构化表只取人口与就诊，忽略的表不读。清洗：解码嵌入内容（base64、HTML／XML、RTF），去掉图片等二进制（不识别图片里的文字）和导出残留的乱码，切栏目，剔除清洗后没有内容的空壳文书；截至时刻以后写成的跳过', '干净的文书与栏目'],
      E2: ['按文书类型和栏目决定每份文书要抽哪些字段，不看关键词；字段多的分组（每组约 30 个），太长的文书按栏目分段。这一步是规则，不用模型', '抽取任务（文书或其中一段 × 一组字段）'],
      E3: ['抽取模型通读每个任务，返回值、断言（阳性／否认／既往／家族／计划）和逐字引语；插件在原文里定位引语，对不上的丢弃；模板写了明确规则的字段，规则另出一票对照；内容相同的任务只调一次模型', '值：每个都带原文引语、起止位置和出处'],
      E2rules: ['仅规则模式：每个字段用关键词（召回词、正则）在文书里找，只看限定的文书类型和栏目；没提到的记「未提及」', '命中的「字段 × 文书」'],
      E3rules: ['仅规则模式：规则对命中处取值，按上下文词判断否认、既往、家族史、计划；规则定不了的记「待定」', '值：每个都带原文引语、起止位置和规则编号'],
      E4: ['统一单位、日期和选项写法；按类型、选项、值域校验，不合的丢弃或标出', '规范值'],
      E5: ['按字段粒度（文书／就诊／病人／时间点）和汇总规则合并成格，计算派生字段；同一格互斥取值登记为冲突，不自动选边', '宽表、时间点长表、冲突表'],
      E6: ['核验模型抽样，对同样的任务背靠背通读重抽，按字段算一致率；核验分歧和规则票不一致的进人工复核；裁定按稳定编号保存，重跑沿用', '一致率与复核单'],
      E7: ['写出宽表、证据长表、冲突表和报告，再只读核对源文件没有被改动', '交付目录'],
    }

    /** 小进度环 */
    function Ring({ v, label, sub, hot }) {
      const r = 22; const c = 2 * Math.PI * r; const x = Math.max(0, Math.min(1, v ?? 0))
      return h('div', { className: 'mx-ring' },
        h('svg', { width: 56, height: 56, viewBox: '0 0 56 56', 'aria-hidden': 'true' },
          h('circle', { cx: 28, cy: 28, r, fill: 'none', stroke: 'var(--line2)', strokeWidth: 4 }),
          h('circle', { cx: 28, cy: 28, r, fill: 'none', stroke: hot ? 'var(--warn)' : 'var(--teal)', strokeWidth: 4, strokeLinecap: 'round', strokeDasharray: `${c * x} ${c}`, transform: 'rotate(-90 28 28)' })),
        h('div', {}, h('b', { className: 'mx-num' }, label), sub ? h('small', {}, sub) : null))
    }

    /** 带名字的横条：rows = [[名称, 数, 显示文本?, 颜色?, 提示?]] */
    function RankBars({ rows, max }) {
      const m = max ?? Math.max(1, ...rows.map((r) => r[1]))
      return h('div', { className: 'mx-rank' }, rows.map(([name, n, txt, color, tip], i) => h('div', { key: `${name}${i}`, className: 'mx-rank-r', title: tip ?? `${name}：${txt ?? fmt(n)}` },
        h('span', {}, name), h('div', {}, h('i', { style: { width: `${Math.max(2, (n / m) * 100)}%`, background: color ?? 'var(--teal)' } })), h('b', { className: 'mx-num' }, txt ?? big(n)))))
    }

    /** 分段条＋图例：parts = [[名称, 数, 颜色]] */
    function Split({ parts }) {
      const sum = parts.reduce((s, p) => s + p[1], 0)
      return h(React.Fragment, {},
        h('div', { className: 'mx-stack' }, sum ? parts.map(([k, n, c]) => (n ? h('span', { key: k, style: { width: `${(n / sum) * 100}%`, background: c } }) : null)) : null),
        h('div', { className: 'mx-legend' }, parts.map(([k, n, c]) => h('span', { key: k }, h('i', { style: { background: c } }), `${k} ${big(n)}`))))
    }

    function StationPanel({ run, s, goto }) {
      const t = run.totals
      const tpl = useAsync(() => call('template', { id: run.template.id }).catch(() => null), [run.template.id])
      const fields = tpl.value?.template?.fields ?? []
      const nameOf = (id) => fields.find((f) => f.id === id)?.name ?? id
      const [copied, setCopied] = useState(false)
      const id = s.no
      const flow = run.flow ?? (run.model && run.mode !== 'rules' ? 'recall' : 'rules')
      const [what, out] = STEP_HELP[flow === 'rules' && STEP_HELP[`${id}rules`] ? `${id}rules` : id] ?? ['', '']
      const hot = s.state === 'run' || s.state === 'hold'
      const stateCls = hot ? 'w' : s.state === 'done' ? 'ok' : ''
      const gate = (g) => run.gates?.find((x) => x.id === g)
      const sec = (title, body, aside) => h('div', { key: title, className: 'mx-ssec' }, h('div', { className: 'mx-ssec-h' }, h('span', {}, title), aside ? h('span', {}, aside) : null), body)
      const note = (text) => h('p', { className: 'mx-snote' }, text)
      const gateLine = (g, label) => {
        const x = gate(g)
        const txt = !x ? '—' : x.skipped ? '跳过' : x.pass ? '通过' : '未过'
        return sec(`验收${g} · ${x?.label ?? label}`, x?.detail ? note(x.detail) : null, h('b', { className: x && !x.skipped ? (x.pass ? 'mx-ok' : 'mx-warn') : '' }, txt))
      }
      const kv = (pairs) => h('div', { className: 'mx-skv' }, pairs.filter(Boolean).map(([l, v, cls]) => h('div', { key: l }, h('span', {}, l), h('b', { className: `mx-num ${cls === 'ok' ? 'mx-ok' : cls === 'warn' ? 'mx-warn' : ''}` }, v))))
      const shards = `${fmt(run.shards.done)} / ${fmt(run.shards.total)} 分片`
      const methods = t.byMethod ?? {}
      const mdl = (methods.model ?? 0) + (methods['model+rule'] ?? 0)
      const verify = Object.entries(run.verify ?? {})
      const vn = verify.reduce((a, [, x]) => a + x.n, 0); const va = verify.reduce((a, [, x]) => a + x.agree, 0)
      const top = (entries, key, n = 8) => entries.sort((a, b) => b[1][key] - a[1][key]).slice(0, n)

      let ring = null; let stats = []; const parts = []; let action = null
      if (id === 'E0') {
        // 不是模板本身的介绍（模板页有），而是这个模板在这批数据上用上了多少：哪些组一个值都没有，往往是模板选错或召回词没覆盖本院写法
        const pri = run.priorities?.length ? run.priorities : null
        const scope = fields.filter((f) => !pri || pri.includes(f.priority))
        const filledOf = run.rollup?.filled ?? {}
        const hasVal = (f) => (run.byField?.[f.id]?.values ?? 0) > 0 || (filledOf[f.id]?.filled ?? 0) > 0
        const nScope = fields.length ? scope.length : run.template.fields
        const nHit = fields.length ? scope.filter(hasVal).length : Object.keys(run.byField ?? {}).length
        const started = (t.documents ?? 0) > 0
        ring = h(Ring, { v: nScope ? nHit / nScope : 0, label: `${nHit}/${nScope}`, sub: '字段本批有值', hot: started && run.status !== 'running' && nScope > 0 && nHit / nScope < 0.5 })
        stats = [['模板', run.template.name], ['版本', `v${run.template.version}`], ['字段', pri ? `${fmt(nScope)} / ${fmt(run.template.fields)}（只抽 ${pri.join('／')}）` : fmt(run.template.fields)]]
        const groups = tpl.value?.template?.groups ?? []
        const byGroup = groups.map((g) => { const fs = scope.filter((f) => f.group === g.id); return [g.name, fs.length, fs.filter(hasVal).length, fs] }).filter((r) => r[1])
        if (byGroup.length) {
          const empty = byGroup.filter((r) => r[2] === 0).length
          parts.push(sec('各组有值字段', h(React.Fragment, {},
            h(RankBars, { max: 1, rows: byGroup.map(([n, all, hit, fs]) => [n, hit / all, `${hit} / ${all}`, started && !hit ? 'var(--warn)' : null,
              `${n}：${hit} / ${all} 个字段有值${hit < all ? `\n没有值：${fs.filter((f) => !hasVal(f)).map((f) => f.name).join('、')}` : ''}`]) }),
            started && empty ? note(`${empty} 个组一个值都没有：可能这批文书本来就不记录，也可能模板不对路或召回词没覆盖本院写法`) : null),
          started ? `${byGroup.length - empty} / ${byGroup.length} 组有值` : '尚未开始'))
        }
        if (scope.length) {
          const cnt = (key) => scope.reduce((m, f) => { const k = key(f); m[k] = (m[k] ?? 0) + 1; return m }, {})
          const never = scope.filter((f) => f.model === 'never').length
          const voted = scope.filter((f) => f.model !== 'never' && f.rules?.length).length
          const way = run.mode === 'rules' ? [['只用规则（旧批次）', scope.length]] : run.flow !== 'read' ? [['模型＋规则（旧流程）', scope.length]] : [['模型通读', scope.length - never - (run.mode === 'model' ? 0 : voted)], ...(run.mode === 'model' ? [] : [['模型通读＋规则票', voted]]), ['只用规则（model: never）', never]]
          const GR = { encounter: '就诊', patient: '病人', timepoint: '时间点', document: '文书' }
          const gr = cnt((f) => f.granularity ?? 'encounter')
          const line = (l, v) => h('p', { className: 'mx-snote' }, h('span', { style: { color: 'var(--ink3)', marginRight: 8 } }, l), v)
          parts.push(sec('字段怎么取、汇总到哪', h(React.Fragment, {},
            line('取值', way.filter((x) => x[1]).map(([k, n]) => `${k} ${n}`).join(' · ')),
            line('汇总到', Object.keys(GR).filter((k) => gr[k]).map((k) => `${GR[k]} ${gr[k]}`).join(' · ')))))
        }
        action = ['查看字段清单', 'template']
      } else if (id === 'E1') {
        ring = h(Ring, { v: s.frac, label: `${Math.round((s.frac ?? 0) * 100)}%`, sub: shards, hot })
        stats = [['文书', big(t.documents)], ['结构化记录（不抽取）', t.structured == null ? '—' : big(t.structured)], ['空壳文书（不抽取）', t.hollow == null ? '—' : big(t.hollow), t.hollow ? 'warn' : ''], ['速率', run.rate ? `${fmt(run.rate)} 份/秒` : '—'], ['跳过（截至时刻）', fmt(t.skipped)], ['输入格式', run.plan?.format ?? '—']]
        if (t.hollow != null) parts.push(sec('清洗', h(React.Fragment, {}, h(Split, { parts: [['进入抽取的文书', t.documents, 'var(--teal)'], ['空壳文书', t.hollow, 'var(--warn)']] }), note(`解码 ${fmt(t.decoded)} 个取值，去掉导出乱码 ${fmt(t.garbled)} 个取值，去掉图片与二进制 ${fmt(t.media ?? 0)} 处${Object.keys(t.mediaKinds ?? {}).length ? `（${Object.entries(t.mediaKinds).map(([k, v]) => `${k} ${fmt(v)}`).join('，')}）` : ''}，图片里的文字不识别。空壳文书＝清洗后各栏目加起来不到 2 个汉字，如「护理观察：-」、只有编码的记录`))))
        if (run.format) {
          parts.push(sec('格式识别', h(Split, { parts: [['采用', run.format.adopted ?? 0, 'var(--teal)'], ['待确认', run.format.held ?? 0, 'var(--warn)'], ['跳过', run.format.ignored ?? 0, 'var(--line2)']] }), `${fmt((run.format.adopted ?? 0) + (run.format.held ?? 0) + (run.format.ignored ?? 0))} 张表`))
          if (run.format.held) action = [`去确认 ${run.format.held} 张表`, 'formats']
        }
      } else if (id === 'E2') {
        ring = h(Ring, { v: s.frac, label: `${Math.round((s.frac ?? 0) * 100)}%`, sub: shards, hot })
        if (flow === 'read') {
          stats = [['抽取任务', big(t.tasks)], ['字段 × 文书', big(t.assigned)], ['文书', big(t.documents)], ['每份文书', t.documents ? `${(t.tasks / t.documents).toFixed(1)} 个任务` : '—']]
          parts.push(sec('数量对照', h(React.Fragment, {}, h(RankBars, { rows: [['文书', t.documents], ['抽取任务', t.tasks], ['取到的值', t.values]] }), note('任务＝文书（太长时为其中一段）× 一组字段，是送模型的最小单位。字段按文书类型和栏目派，不看关键词：原文换个写法也不会漏'))))
          if (t.noKeyword) parts.push(note(`成本开关已开：${fmt(t.noKeyword)} 份文书一个模板关键词都没有，整份跳过`))
        } else {
          stats = [['命中（字段 × 文书）', big(t.recalled)], ['文书', big(t.documents)]]
          parts.push(sec('数量对照', h(React.Fragment, {}, h(RankBars, { rows: [['文书', t.documents], ['命中', t.recalled], ['取到的值', t.values]] }), note('命中按「字段 × 文书」计：一个字段在一份文书里提到了算 1 个；一个命中里可能取出多个值，也可能一个都取不到（比如提到了但是否认）'))))
        }
      } else if (id === 'E3') {
        ring = h(Ring, { v: s.frac, label: `${Math.round((s.frac ?? 0) * 100)}%`, sub: shards, hot })
        stats = [['值', big(t.values)], ['模式', modeLabel(run.mode)], ['模型调用', big(t.calls)], ['命中缓存', big(t.cached)], ['调用失败', fmt(t.failed), t.failed ? 'warn' : '']]
        parts.push(sec('取值途径', h(Split, { parts: [['规则', methods.rule ?? 0, 'var(--fact)'], ['模型', methods.model ?? 0, 'var(--vio)'], ['模型＋规则', methods['model+rule'] ?? 0, 'var(--decide)']] })))
        if (flow === 'read' && t.votes) parts.push(sec('规则票', note(`规则对写了明确规则的字段出了 ${fmt(t.votes)} 票：与模型一致 ${fmt(t.agree)}，不一致进人工复核 ${fmt(t.ruleDisputes)} 项`)))
        parts.push(gateLine('①', '引语与原文逐字一致'))
        if (!gate('①')) parts.push(note(`模型回答 ${fmt(mdl + t.quoteFail)} 条，引语对不上丢弃 ${fmt(t.quoteFail)} 条`))
        const rows = top(Object.entries(run.byField ?? {}), 'values').map(([f, v]) => [nameOf(f), v.values, null, null, `${nameOf(f)}（${f}）：${fmt(v.values)} 个值，${fmt(v.docs)} 份文书`])
        parts.push(sec('取值最多的字段', rows.length ? h(RankBars, { rows }) : note('还没有值'), `${Object.keys(run.byField ?? {}).length} / ${run.template.fields} 个字段有值`))
        if (run.model) action = ['模型调用', 'calls']
      } else if (id === 'E4') {
        const bad = t.invalid + t.outOfRange
        ring = h(Ring, { v: t.values ? 1 - bad / t.values : 0, label: t.values ? pct(1 - bad / t.values) : '—', sub: '合规', hot: bad > 0 })
        stats = [['不合规', fmt(bad), bad ? 'warn' : ''], ['类型或选项不对', fmt(t.invalid)], ['超出值域', fmt(t.outOfRange)]]
        parts.push(sec('值的合规情况', h(Split, { parts: [['合规', Math.max(0, t.values - bad), 'var(--teal)'], ['类型或选项不对', t.invalid, 'var(--warn)'], ['超出值域', t.outOfRange, 'var(--bad)']] })))
        parts.push(gateLine('②', '值在类型、选项、值域之内'))
        action = ['报告', 'report']
      } else if (id === 'E5') {
        ring = h(Ring, { v: s.frac, label: `${Math.round((s.frac ?? 0) * 100)}%`, sub: s.state === 'done' ? '已汇总' : '汇总', hot })
        stats = [['病人', big(t.patients)], ['就诊', big(t.encounters)], ['冲突', fmt(t.conflicts), t.conflicts ? 'warn' : '']]
        const filled = Object.entries(run.rollup?.filled ?? {}).filter(([, x]) => x.rows > 0).map(([f, x]) => [f, x.filled / x.rows, x])
        const best = filled.filter(([, r]) => r > 0).sort((a, b) => b[1] - a[1]).slice(0, 6)
        const empty = filled.filter(([, r]) => r === 0).length
        parts.push(sec('填充率最高的字段', best.length ? h(RankBars, { max: 1, rows: best.map(([f, r, x]) => [nameOf(f), r, pct(r), null, `${nameOf(f)}（${f}）：${fmt(x.filled)} / ${fmt(x.rows)} 格有值`]) }) : note(run.status === 'running' ? '汇总后显示' : '没有字段取到值'),
          filled.length ? `${filled.length - empty} / ${filled.length} 个字段有值` : null))
        parts.push(gateLine('③', '可回溯原文'))
        action = ['宽表', 'wide']
      } else if (id === 'E6') {
        ring = h(Ring, { v: vn ? va / vn : 0, label: vn ? pct(va / vn) : '—', sub: '核验一致率', hot: vn > 0 && va / vn < 0.9 })
        stats = [['核验模型', run.model?.verifyModel ?? '未配置'], ['抽样', vn ? `${fmt(vn)} 次` : '—'], ['待复核', fmt(t.review), t.review ? 'warn' : '']]
        const weak = verify.filter(([, x]) => x.n >= 3).map(([f, x]) => [f, x.agree / x.n, x]).sort((a, b) => a[1] - b[1]).slice(0, 5)
        parts.push(sec('一致率最低的字段', weak.length ? h(RankBars, { max: 1, rows: weak.map(([f, r, x]) => [nameOf(f), r, r.toFixed(2), r < 0.9 ? 'var(--warn)' : 'var(--teal)', `${nameOf(f)}（${f}）：${x.agree} / ${x.n} 次一致`]) }) : note(run.model?.verifyModel ? '抽样不足（每个字段至少 3 次）' : '在设置里配置核验模型后才会抽样核验')))
        parts.push(gateLine('④', '抽样核验一致率'))
        action = [t.review ? `去复核 ${fmt(t.review)} 项` : '复核', 'review']
      } else if (id === 'E7') {
        ring = h(Ring, { v: run.output ? 1 : 0, label: run.output ? '已交付' : '—', sub: run.output ? null : '未交付' })
        stats = [['源文件核对', run.sourceCheck ? (run.sourceCheck.changed ? `${run.sourceCheck.changed} 个变化` : '一致') : '—', run.sourceCheck ? (run.sourceCheck.changed ? 'warn' : 'ok') : '']]
        if (run.output) parts.push(sec('输出位置', h('div', { className: 'mx-spath' }, h('span', { title: run.output }, run.output),
          h('button', { className: 'mx-btn sm', onClick: () => { navigator.clipboard?.writeText(run.output).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {}) } }, copied ? '已复制' : '复制'))))
        parts.push(sec('交付内容', h('ul', { className: 'mx-slist' }, ['宽表（病人／就诊／文书）', '时间点长表', '证据长表（每个值的原文引语与位置）', '冲突表', '报告'].map((x) => h('li', { key: x }, x)))))
        action = ['报告', 'report']
      }

      return h('div', { className: 'mx-frame mx-side' },
        h('div', { className: 'mx-side-h' }, h('b', {}, s.nm), h('span', { className: `mx-chip ${stateCls}` }, STATE_LABEL[s.state])),
        h('p', { className: 'mx-sdesc' }, what, h('br'), h('span', {}, `→ ${out}`)),
        h('div', { className: 'mx-shead' }, ring, kv(stats)),
        ...parts,
        action ? h('button', { className: `mx-btn mx-saction${id === 'E6' && t.review ? ' mx-new' : ''}`, onClick: () => goto(action[1]) }, `${action[0]} →`) : null)
    }

    /** 时长：秒 → 「42 秒」「3 分 05 秒」「1 小时 12 分」 */
    function dur(ms) {
      if (ms == null || !Number.isFinite(ms)) return '—'
      const sec = Math.round(ms / 1000)
      if (sec < 60) return `${sec} 秒`
      if (sec < 3600) return `${Math.floor(sec / 60)} 分 ${String(sec % 60).padStart(2, '0')} 秒`
      return `${Math.floor(sec / 3600)} 小时 ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')} 分`
    }
    /** 时长的大字写法：41 秒 → [41, 秒]；3 分 05 秒 → [3:05, 分]；1 小时 12 分 → [1:12, 时] */
    function clockParts(ms) {
      if (ms == null || !Number.isFinite(ms)) return ['—']
      const sec = Math.round(ms / 1000)
      if (sec < 60) return [String(sec), h('small', { key: 'u' }, '秒')]
      if (sec < 3600) return [`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, h('small', { key: 'u' }, '分')]
      return [`${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`, h('small', { key: 'u' }, '时')]
    }
    const roHead = (title, cap, aside) => h('div', { className: 'mx-ro-h' }, h('b', {}, title), h('span', { className: 'mx-cap' }, cap), h('span', { className: 'mx-sp' }), aside)

    /** 速率曲线（份/秒）：由 run.series［毫秒, 累计文书］分桶算出，虚线是平均。 */
    function Spark({ run }) {
      const pts0 = run.series ?? []
      const W = 260; const H = 40
      const span = pts0.length ? pts0[pts0.length - 1][0] : 0
      const B = Math.min(40, Math.max(1, pts0.length - 1))
      const bins = new Array(B).fill(0)
      for (let i = 1; i < pts0.length; i++) { const b = Math.min(B - 1, Math.floor((pts0[i][0] / Math.max(1, span)) * B)); bins[b] += pts0[i][1] - pts0[i - 1][1] }
      const binSec = span / B / 1000
      const series = bins.map((n) => (binSec > 0 ? n / binSec : 0))
      const has = pts0.length >= 6 && B >= 4 && series.some((x) => x > 0)
      const total = pts0.length ? pts0[pts0.length - 1][1] : 0
      const avg = span > 0 ? total / (span / 1000) : 0
      const max = Math.max(1, ...series)
      const yOf = (v) => H - 3 - (v / max) * (H - 8)
      // 桶中点连线，两端延到边上，面积图不出三角缺口
      const xy = has ? [`0,${yOf(series[0])}`, ...series.map((v, i) => `${((i + 0.5) / B) * W},${yOf(v)}`), `${W},${yOf(series[B - 1])}`] : [`0,${H - 3}`, `${W},${H - 3}`]
      const ay = H - 3 - (avg / max) * (H - 8)
      return h('div', { className: 'mx-spark', title: has ? `处理速率（份/秒）：平均 ${fmt(Math.round(avg))}，峰值 ${fmt(Math.round(Math.max(...series)))}` : '' },
        h('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' },
          [1, 2, 3].map((g) => h('path', { key: g, className: 'grid', d: `M0 ${(H / 4) * g}H${W}` })),
          has ? h('path', { className: 'area', d: `M0 ${H} L${xy.join(' L')} L${W} ${H} Z` }) : null,
          h('polyline', { className: 'line', points: xy.join(' ') }),
          has && avg > 0 ? h('path', { className: 'avg', d: `M0 ${ay}H${W}` }) : null),
        h('div', { className: 'mx-spark-foot' }, has ? h(React.Fragment, {}, h('span', {}, `平均 ${fmt(Math.round(avg))}`), h('span', {}, `峰值 ${fmt(Math.round(Math.max(...series)))}`)) : h('span', {}, run.status === 'running' ? '速率曲线：采样中…' : pts0.length ? '批次太短，没有速率曲线' : '这个批次没有记录速率（旧版本跑的）')))
    }

    /** 运行进度：完成、速率、用时（运行中为预计剩余）、分片与文书，速率曲线。 */
    function ProgressPanel({ run }) {
      const t = run.totals
      const running = run.status === 'running'
      const sh = run.shards
      const frac = sh.total ? sh.done / sh.total : 0
      const elapsed = run.startedAt ? (running ? Date.now() : Date.parse(run.finishedAt ?? run.startedAt)) - Date.parse(run.startedAt) : null
      const eta = running && sh.done > 0 && sh.total > sh.done && elapsed ? (elapsed / sh.done) * (sh.total - sh.done) : null
      // 批次很短（不到 2 秒）时引擎来不及记速率：结束后按文书数 ÷ 用时补上
      const rate = run.rate || (!running && elapsed > 0 && t.documents ? Math.round(t.documents / (elapsed / 1000)) : 0)
      return h('div', { className: 'mx-ro' },
        roHead('运行进度', 'PROGRESS', running ? h('span', { className: 'mx-live' }, h('i'), run.current?.step ?? '运行中') : null),
        h('div', { className: 'mx-big' },
          h('div', {}, h('span', {}, '完成'), h('b', {}, Math.round(frac * 100), h('small', {}, '%'))),
          h('div', {}, h('span', {}, '速率'), h('b', {}, rate ? fmt(rate) : '—', h('small', {}, '份/秒'))),
          h('div', { title: dur(running ? eta : elapsed) }, h('span', {}, running ? '预计剩余' : '用时'), h('b', {}, ...clockParts(running ? eta : elapsed)))),
        h('div', { className: 'mx-kv2' },
          h('p', {}, h('span', {}, '分片'), h('b', {}, fmt(sh.done), h('small', {}, ` / ${fmt(sh.total)}`))),
          h('p', {}, h('span', {}, '文书'), h('b', {}, big(t.documents)), t.structured ? h('small', {}, `（另有结构化记录 ${big(t.structured)}，不抽取）`) : null)),
        h(Spark, { run }))
    }

    /** 处理结果：值、病人、就诊，取值途径比例条，验收门，待复核与冲突，交付位置。 */
    function ResultsPanel({ run, stations, onSel, goto }) {
      const t = run.totals
      const [copied, setCopied] = useState(false)
      const m = t.byMethod ?? {}
      const way = [['规则', m.rule ?? 0, 'var(--fact)'], ['模型', m.model ?? 0, 'var(--vio)'], ['模型＋规则', m['model+rule'] ?? 0, 'var(--decide)']]
      const sum = way.reduce((a, x) => a + x[1], 0)
      const GATE_AT = { '①': 'E3', '②': 'E4', '③': 'E5', '④': 'E6' }
      const tag = run.status === 'review' ? h('span', { className: 'mx-chip w' }, '待复核') : run.status === 'failed' ? h('span', { className: 'mx-chip b' }, '失败') : run.status === 'cancelled' ? h('span', { className: 'mx-chip b' }, '已取消') : null
      return h('div', { className: 'mx-ro' },
        roHead('处理结果', 'RESULTS', tag),
        h('div', { className: 'mx-big' },
          h('div', {}, h('span', {}, '值'), h('b', {}, big(t.values))),
          h('div', {}, h('span', {}, '病人'), h('b', {}, big(t.patients))),
          h('div', {}, h('span', {}, '就诊'), h('b', {}, big(t.encounters)))),
        h('div', { className: 'mx-stack', title: way.map(([k, n]) => `${k} ${fmt(n)}`).join(' · ') }, sum ? way.map(([k, n, c]) => (n ? h('span', { key: k, style: { width: `${(n / sum) * 100}%`, background: c } }) : null)) : null),
        h('div', { className: 'mx-ro-line' },
          h('button', { className: `mx-link${t.review ? ' mx-warn' : ''}`, onClick: () => goto('review') }, '待复核 ', h('b', {}, fmt(t.review))),
          h('button', { className: `mx-link${t.conflicts ? ' mx-warn' : ''}`, onClick: () => goto('wide') }, '冲突 ', h('b', {}, fmt(t.conflicts))),
          h('span', { className: 'mx-gdots' }, '验收', ['①', '②', '③', '④'].map((id) => {
            const g = run.gates?.find((x) => x.id === id)
            const cls = !g || g.skipped ? '' : g.pass ? 'ok' : 'bad'
            return h('button', { key: id, className: `mx-gdot ${cls}`, title: g ? `${g.label}：${g.pass ? '通过' : g.skipped ? '跳过' : '未过'}\n${g.detail}` : '尚未验收', onClick: () => onSel(stations.findIndex((s) => s.no === GATE_AT[id])) }, id)
          }))),
        h('div', { className: 'mx-ro-line mx-types' }, way.filter(([, n]) => n).map(([k, n]) => h('span', { key: k }, k, h('b', {}, sum ? `${Math.round((n / sum) * 100)}%` : '—')))),
        run.output ? h('div', { className: 'mx-spath' }, h('span', { title: run.output }, run.output),
          h('button', { className: 'mx-btn sm', onClick: () => { navigator.clipboard?.writeText(run.output).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {}) } }, copied ? '已复制' : '复制')) : null)
    }

    /** 资源占用（同匿名化插件）：堆内存、输出盘，进程常驻。圈上的小点是本批峰值。 */
    function ResourcesPanel({ run }) {
      const GB = 1024 ** 3
      const running = run.status === 'running'
      const mem = run.memory; const disk = run.disk
      const gauge = (label, ratio, detail, tone, title, peak) => {
        const r = 23; const len = 2 * Math.PI * r
        const v = ratio == null || !Number.isFinite(ratio) ? null : Math.max(0, Math.min(1, ratio))
        const pk = peak == null || !Number.isFinite(peak) || v == null ? null : Math.max(v, Math.min(1, peak))
        const ang = pk == null ? 0 : pk * 2 * Math.PI - Math.PI / 2
        const color = tone === 'crit' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--teal)'
        return h('div', { className: 'mx-gauge', title },
          h('svg', { viewBox: '0 0 58 58' },
            h('circle', { className: 'trk', cx: 29, cy: 29, r }),
            v == null ? null : h('circle', { className: 'arc', cx: 29, cy: 29, r, stroke: color, strokeDasharray: `${(len * v).toFixed(1)} ${len.toFixed(1)}` }),
            pk != null && pk > 0 ? h('circle', { className: 'pk', cx: (29 + r * Math.cos(ang)).toFixed(2), cy: (29 + r * Math.sin(ang)).toFixed(2), r: 3.4 }, h('title', {}, `峰值 ${Math.round(pk * 100)}%`)) : null,
            h('text', { x: 29, y: 33, textAnchor: 'middle' }, v == null ? '—' : `${Math.round(v * 100)}%`)),
          h('span', {}, label), h('small', {}, detail))
      }
      const memRatio = mem?.heapLimit ? (running ? mem.heapUsed : mem.peakHeap) / mem.heapLimit : null
      return h('div', { className: 'mx-ro' },
        roHead('资源占用', 'RESOURCES', h('span', { className: 'mx-faint', style: { fontSize: 11 } }, '本机')),
        h('div', { className: 'mx-gauges' },
          gauge('堆内存', memRatio, mem?.heapLimit ? `${((running ? mem.heapUsed : mem.peakHeap) / GB).toFixed(1)} / ${(mem.heapLimit / GB).toFixed(1)}G` : '—', memRatio >= 0.85 ? 'crit' : memRatio >= 0.7 ? 'warn' : '', '主线程堆内存（结束后显示本批峰值）；分片在工作线程里处理，计入下方进程常驻', mem?.heapLimit && mem.peakHeap ? mem.peakHeap / mem.heapLimit : null),
          gauge('磁盘', disk?.total ? 1 - disk.free / disk.total : null, disk?.total ? `剩 ${(disk.free / GB).toFixed(disk.free < 10 * GB ? 1 : 0)}G` : '—', disk?.total && disk.free < 5 * GB ? 'crit' : disk?.total && disk.free < 20 * GB ? 'warn' : '', '输出目录所在磁盘；圈上的点是本批最满的时候', disk?.total && Number.isFinite(disk.minFree) ? 1 - disk.minFree / disk.total : null)),
        mem?.peakRss ? h('div', { className: 'mx-res-line', title: '整个进程的常驻内存（含工作线程）' }, '进程常驻', h('b', {}, `${((running ? mem.rss ?? mem.peakRss : mem.peakRss) / GB).toFixed(1)}G`), h('span', {}, running ? `峰值 ${(mem.peakRss / GB).toFixed(1)}G` : '峰值'))
          : h('div', { className: 'mx-res-line' }, h('span', {}, '这个批次没有记录资源（旧版本跑的），重跑后显示')))
    }

    /* --------------------------------------------------------------- formats */
    const FMT_STATUS = { agreed: ['自动采用', 'ok'], confirmed: ['已确认', 'ok'], disputed: ['有分歧', 'w'], invalid: ['校验未过', 'w'], pending: ['待确认', 'w'], failed: ['调用失败', 'b'], rejected: ['已跳过', ''] }
    const FMT_ORIGIN = { model: '抽取模型', verify: '核验模型', rule: '规则', user: '人工' }
    const DRAFT_LABEL = { model: '抽取模型草稿', verify: '核验模型草稿', rule: '规则草稿' }
    const FIELD_KIND = { time: '时间', number: '数', code: '代码', text: '短文', long: '长文', embedded: '嵌入文书', pseudonym: '假名' }
    const stripSpec = (s) => { if (!s) return {}; const { origin, accept, ...rest } = s; return rest }
    /** 规格的一句话小结；labels：字段 → 中文名（数据元对照表） */
    function specLine(spec, labels = {}) {
      if (!spec) return '—'
      const nm = (f) => (labels[f] ? `${labels[f]}（${f}）` : f)
      const parts = [spec.recordType ?? '（未定类别）']
      if (spec.written?.length) parts.push(`写成：${spec.written.map(nm).join(' › ')}`)
      if (spec.sections?.length) parts.push(`栏目：${spec.sections.map(([f, n]) => `${n}←${nm(f)}`).join('，')}`)
      const roles = Object.entries(spec.roles ?? {})
      if (roles.length) parts.push(`角色：${roles.map(([r, f]) => `${r}←${[].concat(f).map(nm).join('+')}`).join('，')}`)
      if (spec.measures?.length) parts.push(`测量：${spec.measures.map((m) => m[1]).join('、')}`)
      return parts.join('｜')
    }

    function Formats({ run, busy, onRerun, onError }) {
      const data = useAsync(() => call('formats', { runId: run.id }), [run.id])
      const [sel, setSel] = useState(null)
      // 有待确认的表才默认看待确认，否则看全部（不停在空列表上）
      const [filter, setFilter] = useState(() => ((run.format?.held ?? 0) > 0 ? 'held' : 'all'))
      const [rerunning, setRerunning] = useState(false)
      const rows = data.value?.tables ?? []
      const held = (r) => !['agreed', 'confirmed', 'rejected'].includes(r.status)
      const shown = rows.filter((r) => filter === 'all' || (filter === 'held' ? held(r) : !held(r)))
      const counts = { held: rows.filter(held).length, ok: rows.filter((r) => !held(r)).length, all: rows.length }
      const decide = async (payload) => {
        try { const r = await call('formatDecide', payload); if (r?.ok === false) onError(`没有保存：${r.problems.join('；')}`); data.reload() } catch (e) { onError(msg(e)) }
      }
      const rerun = async () => {
        setRerunning(true)
        try { const v = await call('start', { inputDir: run.input, outputRoot: run.outputRoot, template: run.template.id, mode: run.mode, priorities: run.priorities, asOf: run.asOf || undefined }); onRerun(v.runId) } catch (e) { onError(msg(e)) } finally { setRerunning(false) }
      }
      const changed = Boolean(data.value?.changed)
      const current = sel ? rows.find((r) => r.signature === sel) : null
      const policy = run.format?.heldPolicy === 'skip' ? '先跳过' : '先按通用读法读'
      return h('div', { style: { display: 'flex', gap: 8, flex: 1, minWidth: 0, minHeight: 0 } },
        h('div', { className: 'mx-frame mx-col', style: { flex: 1, minWidth: 0 } },
          h('div', { className: 'mx-pad', style: { borderBottom: '1px solid var(--line)' } },
            h('div', { className: 'mx-h' }, h('b', {}, '格式识别'), h('span', { className: 'mx-cap' }, 'FORMAT'),
              h('span', { className: 'mx-sp' }),
              h('button', { className: `mx-btn ${changed ? 'mx-new' : ''}`, disabled: busy || rerunning, title: busy ? '有批次在运行' : '用格式库里的最新结果重新跑这个输入', onClick: rerun }, rerunning ? '启动中…' : '↻ 按确认结果重新运行')),
            h('div', { className: 'mx-muted', style: { lineHeight: 1.7 } },
              `${rows.length} 张表：采用 ${run.format?.adopted ?? 0}，待确认 ${run.format?.held ?? 0}${run.format?.held ? `（${policy}）` : ''}，跳过 ${run.format?.ignored ?? 0}${run.format?.dict ? `；数据元对照表 ${fmt(run.format.dict)} 条` : ''}。`),
            h('div', { style: { display: 'flex', gap: 6, marginTop: 8 } },
              [['held', '待确认'], ['ok', '已采用／跳过'], ['all', '全部']].map(([k, l]) => h('button', { key: k, className: `mx-btn sm${filter === k ? ' on' : ''}`, onClick: () => setFilter(k) }, `${l} ${counts[k]}`)))),
          h('div', { className: 'mx-scroll', style: { flex: 1 } },
            !data.value ? h('div', { className: 'mx-empty' }, data.error ?? '加载中…')
              : !shown.length ? h('div', { className: 'mx-empty' }, filter === 'held' ? '没有待确认的表。' : '—')
                : h('table', {}, h('thead', {}, h('tr', {}, ['表', '行', '状态', '类别', '依据'].map((x) => h('th', { key: x }, x)))),
                  h('tbody', {}, shown.map((r) => {
                    const [label, cls] = FMT_STATUS[r.status] ?? [r.status, '']
                    return h('tr', { key: r.signature, className: `click${sel === r.signature ? ' sel' : ''}`, onClick: () => setSel(r.signature) },
                      h('td', { className: 'mx-num', style: { maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.table }, r.table),
                      h('td', { className: 'mx-num' }, fmt(r.rows)),
                      h('td', {}, h('span', { className: `mx-chip ${cls}` }, label)),
                      h('td', { style: { whiteSpace: 'nowrap' } }, r.spec?.recordType ?? r.recordType ?? '—', (r.spec?.origin ?? r.origin) ? h('span', { className: 'mx-faint', style: { marginLeft: 6, fontSize: 10.5 } }, FMT_ORIGIN[r.spec?.origin ?? r.origin] ?? '') : null),
                      h('td', { className: 'mx-muted', style: { fontSize: 11.5 } }, [r.borrowedFrom ? `沿用${r.borrowedFrom}` : r.reason, ...(r.diffs ?? []), ...(r.problems ?? []).slice(0, 2)].filter(Boolean).join('；') || '—'))
                  }))))),
        h('div', { className: 'mx-frame mx-scroll mx-pad', style: { width: 480, flex: 'none', overflowX: 'hidden' } },
          !current ? h('div', { className: 'mx-faint' }, '点左边的一张表，查看识别规格和各方草稿，并确认、修改或跳过。')
            : h(FormatDetail, { key: current.signature, row: current, recordTypes: data.value?.recordTypes ?? [], decide })))
    }

    function FormatDetail({ row, recordTypes, decide }) {
      const [editing, setEditing] = useState(false)
      const [text, setText] = useState(() => JSON.stringify(stripSpec(row.spec), null, 1))
      const [jsonErr, setJsonErr] = useState('')
      const [label, cls] = FMT_STATUS[row.status] ?? [row.status, '']
      const drafts = row.drafts ?? {}
      const labels = Object.fromEntries((row.fields ?? []).filter((f) => f.label).map((f) => [f.name, f.label]))
      return h('div', {},
        h('div', { className: 'mx-h' }, h('b', { className: 'mx-num', style: { wordBreak: 'break-all' } }, row.table), h('span', { className: `mx-chip ${cls}` }, label)),
        h('div', { className: 'mx-muted', style: { fontSize: 11.5, marginBottom: 8 } }, `${fmt(row.rows)} 行 · ${row.files} 个文件 · 字段 ${row.fields?.length ?? '—'}（空 ${row.fields?.filter((f) => f.kind === 'empty').length ?? '—'}）`),
        row.reason ? h('div', { className: 'mx-mo', style: { wordBreak: 'break-all' } }, row.reason, ...(row.diffs ?? []).map((d, i) => h('div', { key: i }, `· ${d}`)), ...(row.problems ?? []).map((d, i) => h('div', { key: `p${i}`, className: 'mx-warn' }, `· ${d}`))) : null,
        h('div', { className: 'mx-sec' }, h('b', {}, '当前规格'), h('span', { className: 'mx-cap' }, FMT_ORIGIN[row.spec?.origin] ?? '')),
        h('div', { style: { fontSize: 12, lineHeight: 1.7, wordBreak: 'break-all' } }, specLine(row.spec, labels)),
        row.spec?.note ? h('div', { className: 'mx-faint', style: { fontSize: 11, marginTop: 4 } }, `依据：${row.spec.note}`) : null,
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 } },
          h('button', { className: 'mx-btn mx-new', onClick: () => decide({ signature: row.signature, action: 'confirm' }) }, '✓ 采用当前规格'),
          h('button', { className: 'mx-btn', onClick: () => decide({ signature: row.signature, action: 'reject' }) }, '跳过这张表'),
          h('button', { className: 'mx-btn', title: '从格式库删掉，下次运行重新起草', onClick: () => decide({ signature: row.signature, action: 'reset' }) }, '重新起草'),
          h('button', { className: `mx-btn${editing ? ' on' : ''}`, onClick: () => setEditing(!editing) }, '编辑…')),
        editing ? h('div', { style: { marginTop: 8 } },
          h('textarea', { className: 'mx-json', style: { minHeight: 260 }, value: text, onChange: (e) => setText(e.target.value), spellCheck: false }),
          h('div', { className: 'mx-faint', style: { fontSize: 10.5, margin: '4px 0 6px' } }, `类别：${recordTypes.join('、')}。字段名必须是这张表里有的；保存时插件会校验。`),
          jsonErr ? h('div', { className: 'mx-err', style: { marginBottom: 6 } }, jsonErr) : null,
          h('button', { className: 'mx-btn mx-new', onClick: () => { let spec; try { spec = JSON.parse(text) } catch (e) { return setJsonErr(`不是合法的 JSON：${msg(e)}`) } setJsonErr(''); decide({ signature: row.signature, action: 'confirm', spec }) } }, '校验并确认')) : null,
        Object.keys(drafts).length ? h(React.Fragment, {},
          h('div', { className: 'mx-sec' }, h('b', {}, '各方草稿'), h('span', { className: 'mx-cap' }, 'DRAFTS')),
          Object.entries(DRAFT_LABEL).filter(([k]) => drafts[k]).map(([k, l]) => h('div', { key: k, className: 'mx-mrow' },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } }, h('b', { style: { fontSize: 12 } }, l), h('span', { className: 'mx-sp' }),
              h('button', { className: 'mx-btn sm', onClick: () => decide({ signature: row.signature, action: 'confirm', use: k }) }, '采用这份')),
            h('div', { className: 'mx-muted', style: { marginTop: 3, wordBreak: 'break-all' } }, specLine(drafts[k], labels))))) : null,
        row.fields?.length ? h(React.Fragment, {},
          h('div', { className: 'mx-sec' }, h('b', {}, '字段'), h('span', { className: 'mx-cap' }, 'FIELDS')),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } }, row.fields.filter((f) => f.kind !== 'empty').map((f) => h('span', { key: f.name, className: 'mx-chip', title: `${f.kind} · 填充 ${f.fill}%` }, `${f.label ? `${f.label}·` : ''}${f.name}·${FIELD_KIND[f.kind] ?? f.kind}`)))) : null)
    }

    /* -------------------------------------------------------------- template */
    /** 模板列表分组：内置按学科（domain），我的模板单独一组 */
    function tplGroups(xs) {
      const g = new Map()
      for (const x of xs) { const k = x.origin === 'builtin' ? `内置 · ${x.domain ?? '其他'}` : '我的模板'; if (!g.has(k)) g.set(k, []); g.get(k).push(x) }
      return [...g.entries()].sort((a, b) => (a[0] === '我的模板' ? 1 : b[0] === '我的模板' ? -1 : a[0].localeCompare(b[0], 'zh')))
    }
    function Templates({ run, onError }) {
      const list = useAsync(() => call('templates'), [])
      const [sel, setSel] = useState(run?.template?.id ?? null)
      const [view, setView] = useState('fields')
      const [draft, setDraft] = useState('')
      const [state, setState] = useState('')
      const id = sel ?? list.value?.templates?.[0]?.id
      const d = useAsync(() => (id ? call('template', { id }) : null), [id])
      useEffect(() => { if (d.value?.template) setDraft(JSON.stringify(d.value.template, null, 2)) }, [d.value])
      const t = d.value?.template
      const save = async () => {
        let obj
        try { obj = JSON.parse(draft) } catch (e) { setState(`JSON 有误：${msg(e)}`); return }
        try { const r = await call('saveTemplate', { template: obj }); setState(r.saved ? `已保存到模板库（${obj.id}）` : `未保存：\n- ${r.problems.join('\n- ')}`); if (r.saved) { list.reload(); setSel(obj.id) } } catch (e) { onError(msg(e)) }
      }
      const copyAsMine = () => {
        const ids = new Set((list.value?.templates ?? []).map((x) => x.id))
        let nid = `${t.id}-my`; let n = 2
        while (ids.has(nid)) nid = `${t.id}-my${n++}`
        setDraft(JSON.stringify({ ...t, id: nid, name: `${t.name}（我的）`, version: '0.1.0' }, null, 2))
        setView('json')
        setState(`已复制为 ${nid}：改好 id、名称和字段后点「校验并保存到模板库」。`)
      }
      const download = async (blank) => {
        try {
          const v = await call('templateXlsx', blank ? { blank: true } : { id: t.id })
          const bin = atob(v.base64); const bytes = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
          const a = document.createElement('a'); a.href = url; a.download = v.name; document.body.appendChild(a); a.click(); a.remove()
          setTimeout(() => URL.revokeObjectURL(url), 5000)
        } catch (e) { onError(msg(e)) }
      }
      const fileRef = React.useRef(null)
      const [importing, setImporting] = useState(false)
      const importFile = async (file) => {
        if (!file) return
        setImporting(true); setState('')
        try {
          const buf = new Uint8Array(await file.arrayBuffer())
          let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000))
          const r = await call('importTemplateXlsx', { base64: btoa(bin) })
          if (r.saved) { list.reload(); setSel(r.template.id); setView('fields'); setState(`已导入「${file.name}」：${r.template.name} v${r.template.version}，${r.template.fields} 个字段，存为我的模板 ${r.template.id}。${r.problems.length ? `\n提示：\n- ${r.problems.join('\n- ')}` : ''}`) }
          else setState(`「${file.name}」没有导入，请改好后再试：\n- ${r.problems.join('\n- ')}`)
        } catch (e) { onError(msg(e)) } finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
      }
      const groupName = Object.fromEntries((t?.groups ?? []).map((g) => [g.id, g.name]))
      const nw = { whiteSpace: 'nowrap' }
      return h('div', { className: 'mx-split' },
        h('div', { className: 'mx-frame mx-scroll mx-pad' },
          h('div', { className: 'mx-h' }, h('b', {}, '模板库'), h('span', { className: 'mx-cap' }, 'TEMPLATES')),
          h('div', { style: { display: 'flex', gap: 6, marginBottom: 4 } },
            h('button', { className: 'mx-btn sm pri', disabled: importing, onClick: () => fileRef.current?.click(), title: '导入用 Excel 编写的模板（模板、字段、规则三张表；格式同"下载 Excel"）' }, importing ? '导入中…' : '⇪ 导入 Excel'),
            h('button', { className: 'mx-btn sm', onClick: () => download(true), title: '下载带填写说明的空白 Excel 模板' }, '⇩ 空白模板'),
            h('input', { ref: fileRef, type: 'file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', style: { display: 'none' }, onChange: (e) => importFile(e.target.files?.[0]) })),
          state && view === 'fields' ? h('pre', { className: 'mx-md', style: { margin: '6px 0', fontSize: 11, whiteSpace: 'pre-wrap', color: /没有导入/.test(state) ? 'var(--badink)' : 'var(--ink2)' } }, state) : null,
          tplGroups(list.value?.templates ?? []).map(([label, xs]) => h(React.Fragment, { key: label },
            h('div', { className: 'mx-side-sec', style: { marginTop: 10 } }, h('span', {}, label), h('span', {}, String(xs.length))),
            xs.map((x) => h('div', { key: x.id, className: `mx-pi${x.id === id ? ' on' : ''}`, onClick: () => { setSel(x.id); setState('') } },
              h('b', {}, x.name), h('span', {}, `${x.fields} 字段`), h('span', { style: { gridColumn: '1 / 3' } }, `${x.id} v${x.version} · `, x.origin === 'builtin' ? h('span', { className: 'mx-chip', style: { marginLeft: 2 } }, '内置 · 只读') : h('span', { className: 'mx-chip v', style: { marginLeft: 2 } }, '我的模板')), x.origin === 'builtin' ? null : h('span', { className: 'mx-num', style: { gridColumn: '1 / 3', fontSize: 9.5, wordBreak: 'break-all' }, title: x.file }, x.file)))))),
        h('div', { className: 'mx-frame mx-col', style: { minWidth: 0 } },
          !t ? h('div', { className: 'mx-empty' }, d.error ?? '加载中…') : h(React.Fragment, {},
            h('div', { className: 'mx-pad', style: { borderBottom: '1px solid var(--line)' } },
              h('div', { className: 'mx-h' }, h('b', {}, t.name), h('span', { className: 'mx-cap' }, `${t.id} v${t.version}`), d.value.problems?.length ? h('span', { className: 'mx-chip b' }, `${d.value.problems.length} 个问题`) : h('span', { className: 'mx-chip ok' }, '校验通过')),
              h('div', { className: 'mx-muted', style: { fontSize: 12 } }, t.description),
              t.references?.length ? h('div', { style: { fontSize: 11, marginTop: 6, lineHeight: 1.7 } }, h('span', { className: 'mx-faint' }, '依据：'),
                t.references.map((r, i) => h('span', { key: i }, i ? h('span', { className: 'mx-faint' }, '；') : null, r.url ? h('a', { href: r.url, target: '_blank', rel: 'noreferrer', style: { color: 'var(--teal2)' } }, r.title) : r.title))) : null,
              h('div', { style: { display: 'flex', gap: 4, marginTop: 8 } }, [['fields', `字段 ${t.fields.length}`], ['json', 'JSON（编辑、另存）']].map(([k, l]) => h('button', { key: k, className: `mx-btn sm${view === k ? ' on' : ''}`, onClick: () => setView(k) }, l)), h('span', { className: 'mx-sp' }), h('button', { className: 'mx-btn sm', onClick: () => download(false), title: '把这个模板导出成 Excel，改好后用左侧「导入 Excel」导回来' }, '⇩ 下载 Excel'), h('button', { className: 'mx-btn sm pri', onClick: copyAsMine, title: '以当前模板为底稿，换一个新 id，在 JSON 里改好后保存到我的模板库' }, '＋ 复制为我的模板'))),
            view === 'fields' ? h('div', { className: 'mx-scroll', style: { flex: 1 } }, h('table', {},
              h('thead', {}, h('tr', {}, ['字段', '名称', '组', '优先级', '类型', '粒度', '模型', '定义', '召回／规则'].map((x) => h('th', { key: x, style: nw }, x)))),
              h('tbody', {}, t.fields.map((f) => h('tr', { key: f.id },
                h('td', { className: 'mx-num', style: nw }, f.id), h('td', { style: { minWidth: 120 } }, f.name), h('td', { className: 'mx-faint', style: nw }, groupName[f.group] ?? f.group ?? ''), h('td', { style: nw }, h('span', { className: `mx-chip ${f.priority === 'P0' ? 'v' : ''}` }, f.priority ?? 'P1')),
                h('td', { style: nw }, f.type), h('td', { className: 'mx-faint', style: nw }, f.granularity ?? 'encounter'), h('td', { className: 'mx-faint', style: nw }, f.model ?? 'auto'),
                h('td', { style: { maxWidth: 360, fontSize: 11.5 } }, f.definition),
                h('td', { className: 'mx-faint', style: { maxWidth: 280, fontSize: 11 } }, f.type === 'derived' ? `派生：${f.derive?.op}` : [...(f.recall?.terms ?? []), ...(f.options ?? []).map((o) => o.value)].slice(0, 8).join('、') + (f.rules?.length ? ` · 规则 ${f.rules.length}` : '')))))))
              : h('div', { className: 'mx-pad mx-col', style: { flex: 1 } },
                h('textarea', { className: 'mx-json', value: draft, onChange: (e) => setDraft(e.target.value), spellCheck: false }),
                h('div', { style: { display: 'flex', gap: 8, alignItems: 'flex-start' } }, h('button', { className: 'mx-btn pri', onClick: save }, '校验并保存到模板库'), h('pre', { className: 'mx-md', style: { margin: 0, color: 'var(--ink2)' } }, state))))))
    }

    /* ------------------------------------------------------------ wide table */
    function Wide({ run, openPatient }) {
      const [name, setName] = useState('wide_patient')
      const [q, setQ] = useState('')
      const [offset, setOffset] = useState(0)
      const tpl = useAsync(() => call('template', { id: run.template.id }).catch(() => null), [run.template.id])
      const fieldName = useMemo(() => Object.fromEntries((tpl.value?.template?.fields ?? []).map((f) => [f.id, f.name])), [tpl.value])
      const d = useAsync(() => (run.output ? call('table', { runId: run.id, name, offset, limit: 100, q }) : null), [run.id, run.output, name, offset, q])
      const v = d.value
      const hideN = name !== 'timepoints' && name !== 'conflicts'
      const cols = v ? v.header.map((hd, i) => [hd, i]).filter(([hd]) => !(hideN && hd.endsWith('__n'))) : []
      const pi = v ? v.header.indexOf('patient') : -1
      return h('div', { className: 'mx-frame mx-col', style: { flex: 1, minWidth: 0 } },
        h('div', { className: 'mx-pad', style: { display: 'flex', gap: 6, alignItems: 'center', borderBottom: '1px solid var(--line)' } },
          [['wide_patient', '病人'], ['wide_encounter', '就诊'], ['wide_document', '文书'], ['timepoints', '时间点'], ['conflicts', '冲突']].map(([k, l]) => h('button', { key: k, className: `mx-btn sm${name === k ? ' on' : ''}`, onClick: () => { setName(k); setOffset(0) } }, l)),
          h('span', { className: 'mx-sp' }),
          h('input', { className: 'mx-input', placeholder: '筛选（任意列包含）', value: q, onChange: (e) => { setQ(e.target.value); setOffset(0) }, style: { width: 220 } }),
          v ? h('span', { className: 'mx-faint mx-num' }, `${fmt(v.offset + 1)}–${fmt(Math.min(v.total, v.offset + 100))} / ${fmt(v.total)}`) : null,
          h('button', { className: 'mx-btn sm', disabled: !v || offset === 0, onClick: () => setOffset(Math.max(0, offset - 100)) }, '‹'),
          h('button', { className: 'mx-btn sm', disabled: !v || offset + 100 >= v.total, onClick: () => setOffset(offset + 100) }, '›')),
        !run.output ? h('div', { className: 'mx-empty' }, '批次交付后显示宽表。')
          : !v ? h('div', { className: 'mx-empty' }, d.error ?? '加载中…')
            : h('div', { className: 'mx-scroll', style: { flex: 1 } }, h('table', { className: 'mx-grid-tbl' },
              h('thead', {}, h('tr', {}, cols.map(([hd]) => h('th', { key: hd, title: fieldName[hd] ?? hd }, fieldName[hd] ? h(React.Fragment, {}, h('span', { className: 'mx-num' }, hd), ' ', fieldName[hd]) : hd)))),
              h('tbody', {}, v.rows.map((r, ri) => h('tr', { key: ri, className: pi >= 0 ? 'click' : '', onClick: pi >= 0 ? () => openPatient(r[pi]) : undefined, title: pi >= 0 ? '点击查看该病人的原文标注' : undefined },
                cols.map(([hd, i]) => h('td', { key: hd, className: !r[i] || r[i] === '未提及' ? 'none' : '', title: r[i] }, r[i] || '·'))))))))
    }

    /* --------------------------------------------------------------- source */
    function Source({ run, patient, setPatient }) {
      const [input, setInput] = useState(patient ?? '')
      const [doc, setDoc] = useState(null)
      const [sel, setSel] = useState(null)
      useEffect(() => { setInput(patient ?? '') }, [patient])
      const ev = useAsync(() => (patient ? call('evidence', { runId: run.id, patient, limit: 3000 }) : null), [run.id, patient])
      const tpl = useAsync(() => call('template', { id: run.template.id }).catch(() => null), [run.template.id])
      const fieldName = useMemo(() => Object.fromEntries((tpl.value?.template?.fields ?? []).map((f) => [f.id, f.name])), [tpl.value])
      const values = ev.value?.values ?? []
      const docs = useMemo(() => {
        const m = new Map()
        for (const v of values) { if (!m.has(v.doc)) m.set(v.doc, { id: v.doc, recordType: v.recordType, written: v.written, encounter: v.encounter, n: 0 }); m.get(v.doc).n++ }
        return [...m.values()].sort((a, b) => ((a.written ?? '') < (b.written ?? '') ? -1 : 1))
      }, [values])
      const curDoc = doc ?? docs[0]?.id
      const text = useAsync(() => (curDoc ? call('document', { runId: run.id, patient, doc: curDoc }) : null), [run.id, curDoc])
      const dv = values.filter((v) => v.doc === curDoc && v.e > v.s).sort((a, b) => a.s - b.s)
      const body = text.value?.document?.text ?? ''
      const parts = []
      let at = 0
      for (const v of dv) {
        if (v.s < at) continue
        parts.push(body.slice(at, v.s))
        parts.push(h('span', { key: v.id, className: `${qCls(v)}${sel === v.id ? ' sel' : ''}`, title: `${v.field} ${fieldName[v.field] ?? ''} = ${v.value ?? '待定'}（${v.assertion}，${v.method}）`, onClick: () => setSel(v.id) }, body.slice(v.s, v.e)))
        at = v.e
      }
      parts.push(body.slice(at))
      const selV = values.find((v) => v.id === sel)
      return h('div', { className: 'mx-split' },
        h('div', { className: 'mx-frame mx-col mx-pad', style: { minHeight: 0 } },
          h('div', { style: { display: 'flex', gap: 6 } }, h('input', { className: 'mx-input', style: { flex: 1 }, placeholder: '病人编号', value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') { setPatient(input.trim()); setDoc(null) } } }), h('button', { className: 'mx-btn', onClick: () => { setPatient(input.trim()); setDoc(null) } }, '查看')),
          !patient ? h('div', { className: 'mx-faint', style: { marginTop: 10 } }, '在「宽表」里点一行，或输入病人编号。') : ev.loading ? h('div', { className: 'mx-faint' }, '加载中…') : h('div', { className: 'mx-scroll', style: { marginTop: 8, flex: 1 } },
            h('div', { className: 'mx-faint', style: { fontSize: 11, marginBottom: 4 } }, `${docs.length} 份文书有抽取值 · 共 ${values.length} 个值`),
            docs.map((d) => h('div', { key: d.id, className: `mx-pi${d.id === curDoc ? ' on' : ''}`, onClick: () => { setDoc(d.id); setSel(null) } }, h('b', {}, d.recordType), h('span', {}, `${d.n} 值`), h('span', { style: { gridColumn: '1 / 3' } }, `${d.written ?? '时间不详'}${d.encounter ? ` · ${d.encounter}` : ''}`))))),
        h('div', { className: 'mx-frame mx-col', style: { minWidth: 0 } },
          h('div', { className: 'mx-pad', style: { borderBottom: '1px solid var(--line)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
            h('b', {}, '原文标注'), h('span', { className: 'mx-q' }, '阳性'), h('span', { className: 'mx-q neg' }, '否认'), h('span', { className: 'mx-q hx' }, '既往'), h('span', { className: 'mx-q fam' }, '家族'), h('span', { className: 'mx-q mdl' }, '模型取值（青边）'),
            h('span', { className: 'mx-sp' }), h('span', { className: 'mx-faint' }, '原文只在本机读取显示，不写入任何记录')),
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 300px', flex: 1, minHeight: 0 } },
            h('div', { className: 'mx-scroll mx-pad mx-doc', style: { lineHeight: 2 } }, text.loading ? '加载中…' : text.error ? h('div', { className: 'mx-err' }, text.error) : parts),
            h('div', { className: 'mx-scroll mx-pad', style: { borderLeft: '1px solid var(--line)' } },
              selV ? h('div', { className: 'mx-mo' }, h('b', {}, `${selV.field} ${fieldName[selV.field] ?? ''}`), h('div', {}, `值：${selV.value ?? '待定'}${selV.unit ? ` ${selV.unit}` : ''}${selV.variant ? `（${selV.variant}）` : ''}`), h('div', {}, `断言：${selV.assertion} · 栏目：${selV.section ?? '—'}`), h('div', {}, `方法：${selV.method}${selV.flags?.length ? ` · ${selV.flags.join('、')}` : ''}`), h('div', { className: 'mx-faint mx-num' }, selV.id)) : null,
              dv.map((v) => h('div', { key: v.id, className: 'mx-mrow', style: { cursor: 'pointer', background: sel === v.id ? 'var(--panel3)' : undefined }, onClick: () => setSel(v.id) },
                h('span', { className: 'mx-num mx-faint' }, v.field), ' ', fieldName[v.field] ?? '', ' = ', h('b', {}, String(v.value ?? '待定')), ' ', h('span', { className: `mx-chip ${v.assertion === '否认' ? '' : v.assertion === '阳性' ? 'ok' : 'v'}` }, v.assertion)))))))
    }

    /* --------------------------------------------------------------- review */
    function Review({ run, onError }) {
      const [offset, setOffset] = useState(0)
      const [field, setField] = useState('')
      const d = useAsync(() => call('reviewQueue', { runId: run.id, offset, limit: 20, field: field || null }), [run.id, offset, field])
      const decide = async (item, decision) => {
        try { await call('decide', { runId: run.id, kind: 'review', target: item.id, decision, item }); d.reload() } catch (e) { onError(msg(e)) }
      }
      const v = d.value
      const fieldsInQueue = Object.entries(run.verify ?? {}).filter(([, x]) => x.n > x.agree).map(([k]) => k)
      const mark = (snip, vals) => {
        const out = []; let at = snip.s
        for (const x of [...vals].filter((y) => y.s >= snip.s && y.e <= snip.e).sort((a, b) => a.s - b.s)) {
          if (x.s < at) continue
          out.push(snip.text.slice(at - snip.s, x.s - snip.s), h('span', { key: `${x.s}-${x.e}`, className: 'mx-hl' }, snip.text.slice(x.s - snip.s, x.e - snip.s))); at = x.e
        }
        out.push(snip.text.slice(at - snip.s))
        return out
      }
      return h('div', { className: 'mx-frame mx-col', style: { flex: 1 } },
        h('div', { className: 'mx-pad', style: { display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--line)' } },
          h('b', {}, '复核'), h('span', { className: 'mx-cap' }, 'REVIEW'), h('span', { className: 'mx-faint' }, '抽样核验时最终结果与核验模型不一致的项。裁定按稳定编号存，重跑沿用。'),
          h('span', { className: 'mx-sp' }),
          h('select', { className: 'mx-input', value: field, onChange: (e) => { setField(e.target.value); setOffset(0) } }, h('option', { value: '' }, '全部字段'), fieldsInQueue.map((f) => h('option', { key: f, value: f }, f))),
          v ? h('span', { className: 'mx-faint mx-num' }, `${fmt(v.total)} 项`) : null,
          h('button', { className: 'mx-btn sm', disabled: offset === 0, onClick: () => setOffset(Math.max(0, offset - 20)) }, '‹'),
          h('button', { className: 'mx-btn sm', disabled: !v || offset + 20 >= v.total, onClick: () => setOffset(offset + 20) }, '›')),
        h('div', { className: 'mx-scroll mx-pad', style: { flex: 1 } },
          !v ? h('div', { className: 'mx-faint' }, d.error ?? '加载中…') : !v.items.length ? h('div', { className: 'mx-empty' }, run.model?.verifyModel ? '没有待复核的项。' : '未配置核验模型，没有抽样核验。') : v.items.map((it) => h('div', { key: it.id, className: 'mx-rv' },
            h('div', { className: 'mx-rv-h' }, h('b', { className: 'mx-num' }, it.field), h('b', {}, it.fieldName ?? ''), h('span', { className: 'mx-faint' }, `${it.patient} · ${it.recordType} · ${it.written ?? ''}`), h('span', { className: 'mx-sp' }),
              it.decision ? h('span', { className: 'mx-chip ok' }, { confirm: '已维持', useVerify: '已按核验改判', reject: '已驳回全部' }[it.decision.decision] ?? it.decision.decision) : null),
            h('div', { className: 'mx-rv-cols' },
              h('div', {}, h('div', { className: 'mx-faint' }, '最终结果'), h('b', {}, it.final), it.finalValues.slice(0, 4).map((x, i) => h('div', { key: i, className: 'mx-faint' }, `「${x.quote}」 ${x.assertion} · ${x.method}`))),
              h('div', {}, h('div', { className: 'mx-faint' }, it.kind === 'rule' ? '规则票' : '核验模型'), h('b', {}, it.verify), it.verifyValues.slice(0, 4).map((x, i) => h('div', { key: i, className: 'mx-faint' }, `「${x.quote}」 ${x.assertion}`)))),
            it.snippets.slice(0, 3).map((s, i) => h('div', { key: i, className: 'mx-snip' }, mark(s, [...it.finalValues, ...it.verifyValues]))),
            h('div', { style: { display: 'flex', gap: 6, marginTop: 8 } },
              h('button', { className: 'mx-btn sm', onClick: () => decide(it, 'confirm') }, '维持最终结果'),
              h('button', { className: 'mx-btn sm pri', onClick: () => decide(it, 'useVerify') }, '按核验模型改判'),
              h('button', { className: 'mx-btn sm', onClick: () => decide(it, 'reject') }, '两者都不对（驳回）'),
              it.decision ? h('button', { className: 'mx-btn sm', onClick: () => decide(it, 'clear') }, '撤销裁定') : null)))))
    }

    /* ---------------------------------------------------------------- calls */
    function Calls({ run }) {
      const d = useAsync(() => call('calls', { runId: run.id }), [run.id, run.totals.calls])
      const v = d.value
      return h('div', { className: 'mx-frame mx-scroll mx-pad', style: { flex: 1 } },
        h('div', { className: 'mx-h' }, h('b', {}, '模型调用'), h('span', { className: 'mx-cap' }, 'MODELS'), h('span', { className: 'mx-faint' }, '按角色与模型累计；不记提示词与回复内容（回复缓存在记录库，供重跑复用）')),
        !v?.byModel?.length ? h('div', { className: 'mx-empty' }, run.model ? '还没有调用。' : '本批次未配置模型。') : h('table', {},
          h('thead', {}, h('tr', {}, ['角色', '模型', '调用', '失败', '缓存复用', '平均耗时', '输入 Token', '输出 Token'].map((x) => h('th', { key: x }, x)))),
          h('tbody', {}, v.byModel.map((m) => h('tr', { key: m.role + m.model }, h('td', {}, m.role === 'extract' ? '抽取' : '核验'), h('td', {}, m.model), h('td', { className: 'mx-num' }, fmt(m.calls)), h('td', { className: `mx-num ${m.failed ? 'mx-bad' : ''}` }, fmt(m.failed)), h('td', { className: 'mx-num' }, fmt(m.cached)),
            h('td', { className: 'mx-num' }, m.calls ? `${(m.ms / m.calls / 1000).toFixed(1)}s` : '—'), h('td', { className: 'mx-num' }, fmt(m.prompt_tokens)), h('td', { className: 'mx-num' }, fmt(m.completion_tokens)))))),
        v?.errors?.length ? h(React.Fragment, {}, h('div', { className: 'mx-sec' }, h('b', {}, '最近的失败')),
          h('table', {}, h('tbody', {}, v.errors.map((c, i) => h('tr', { key: i }, h('td', { className: 'mx-num mx-faint' }, fmtTime(c.at)), h('td', {}, c.role), h('td', {}, c.model), h('td', { className: 'mx-bad' }, c.error)))))) : null)
    }

    function Report({ run }) {
      const d = useAsync(() => call('report', { runId: run.id }), [run.id, run.status])
      return h('div', { className: 'mx-frame mx-scroll mx-pad', style: { flex: 1 } },
        d.value ? h(React.Fragment, {}, h('div', { className: 'mx-faint', style: { marginBottom: 8 } }, d.value.path), h('div', { className: 'mx-md' }, d.value.markdown)) : h('div', { className: 'mx-faint' }, d.error ?? '加载中…'))
    }

    /* --------------------------------------------------------------- settings */
    function SettingsSection({ inModal = false } = {}) {
      const [cfg, setCfg] = useState(null)
      const [form, setForm] = useState({})
      const [state, setState] = useState('')
      useEffect(() => { call('config').then((c) => { setCfg(c); setForm({ ...c.settings, priorities: [].concat(c.settings.priorities ?? []).join(','), mapping: JSON.stringify(c.settings.mapping ?? {}), apiKey: '' }) }).catch((e) => setState(msg(e))) }, [])
      if (!cfg) return h('div', { className: 'mx-settings' }, h('style', {}, CSS), state || '加载中…')
      const field = (k, label, props = {}) => h('label', { className: 'mx-field' }, label, h('input', { className: 'mx-input', value: form[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }), ...props }))
      const check = (k, label) => h('label', { style: { display: 'flex', gap: 6, alignItems: 'center' } }, h('input', { type: 'checkbox', checked: form[k] !== false, onChange: (e) => setForm({ ...form, [k]: e.target.checked }) }), label)
      const num = (k, d) => (form[k] === '' || form[k] == null ? d : Number(form[k]))
      const save = async () => {
        let mapping = {}
        try { mapping = form.mapping ? JSON.parse(form.mapping) : {} } catch { setState('字段映射不是合法 JSON'); return }
        const patch = {
          outputRoot: form.outputRoot ?? '', template: form.template || 'mdd', extractMode: MODE_LABEL[form.extractMode] ? form.extractMode : 'hybrid', priorities: String(form.priorities ?? '').split(/[,，\s]+/).filter(Boolean), mapping,
          baseURL: form.baseURL ?? '', model: form.model ?? '', verifyBaseURL: form.verifyBaseURL ?? '', verifyModel: form.verifyModel ?? '', disableThinking: form.disableThinking !== false,
          timeoutMs: num('timeoutMs', 120000), modelConcurrency: num('modelConcurrency', 8), workers: num('workers', 0), shardUnits: num('shardUnits', 20),
          verifySampleRate: num('verifySampleRate', 0.02), verifyMinPerField: num('verifyMinPerField', 2), verifyThreshold: num('verifyThreshold', 0.9), showSidebarEntry: form.showSidebarEntry !== false,
          formatRecognition: form.formatRecognition !== false, borrowFormats: form.borrowFormats !== false, elementDict: form.elementDict ?? '', heldTables: form.heldTables || 'generic',
        }
        if (form.apiKey) patch.apiKey = form.apiKey
        try { await call('saveDefaults', patch); setState('已保存（插件会重新加载）') } catch (e) { setState(msg(e)) }
      }
      return h('div', { className: 'mx-settings' }, h('style', {}, CSS),
        inModal ? null : h('p', { style: { margin: 0, color: 'var(--dsw-alias-label-secondary)' } }, '这里只放配置。运行批次、看宽表与复核，请到左侧栏的「病历文书提取」，或在聊天框使用 /extract。'),
        h('h3', { style: { margin: '6px 0 0' } }, '抽取'),
        h('div', { className: 'mx-grid2' },
          field('template', '默认模板 id'),
          h('label', { className: 'mx-field' }, '模式', h('select', { className: 'mx-input', value: MODE_LABEL[form.extractMode] ? form.extractMode : 'hybrid', onChange: (e) => setForm({ ...form, extractMode: e.target.value }) }, Object.entries(MODE_LABEL).map(([k, l]) => h('option', { key: k, value: k }, l)))),
          field('priorities', '只抽这些优先级（逗号分隔；空＝全部）'), field('mapping', '通用文件字段映射（JSON；空＝自动识别）', { placeholder: '{"text":"content","patient":"patient_id"}' })),
        h('h3', { style: { margin: '6px 0 0' } }, '模型'),
        h('p', { style: { margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, '规则定不了的片段送抽取模型；核验模型按字段抽样背靠背重抽。病历内容只发往这里配置的端点，Agent 不能更改。'),
        h('div', { className: 'mx-grid2' }, field('baseURL', '抽取模型端点（OpenAI 兼容）', { placeholder: 'http://127.0.0.1:11434/v1' }), field('model', '抽取模型'),
          field('verifyBaseURL', '核验模型端点（空＝同上）'), field('verifyModel', '核验模型（空＝不做抽样核验）'),
          field('apiKey', 'API Key（留空不修改）', { type: 'password' }), field('timeoutMs', '单次调用超时（毫秒）'),
          field('modelConcurrency', '全局同时进行的模型请求数'), field('verifySampleRate', '核验抽样比例（0–1）'),
          field('verifyMinPerField', '每字段每分片至少核验几份'), field('verifyThreshold', '验收门④一致率阈值')),
        check('disableThinking', '关闭思考模式（推理模型更快）'),
        h('h3', { style: { margin: '6px 0 0' } }, '格式识别（通用文件）'),
        h('p', { style: { margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, '按表识别类别、写成时间、病人、就诊与栏目：规则草稿＋抽取模型起草＋核验模型背靠背，一致才自动采用，其余在「格式」页确认。只发字段名、统计和截短样例，不发正文。'),
        check('formatRecognition', '启用格式识别'),
        check('borrowFormats', '借用病历事件还原插件已采用的识别结果'),
        h('div', { className: 'mx-grid2' }, field('elementDict', '数据元对照表（csv／xlsx／json，两列：编码、名称；可空）'),
          h('label', { className: 'mx-field' }, '格式未定的表', h('select', { className: 'mx-input', value: form.heldTables ?? 'generic', onChange: (e) => setForm({ ...form, heldTables: e.target.value }) }, h('option', { value: 'generic' }, '先按通用读法读'), h('option', { value: 'skip' }, '跳过，等确认')))),
        h('h3', { style: { margin: '6px 0 0' } }, '规模与批次'),
        h('div', { className: 'mx-grid2' }, field('outputRoot', '默认输出根目录（空＝输入旁的 _medical-extract）'), field('workers', '工作线程数（0＝自动）'), field('shardUnits', 'p_doc 导出：每个分片的病人数')),
        check('showSidebarEntry', '在左侧栏显示「病历文书提取」入口'),
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } }, h('button', { className: 'mx-btn', onClick: save }, '保存'), h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, state)))
    }

    /* ----------------------------------------------------------------- plugin */
    const plugin = {
      inject: ['slots'],
      apply(ctx) {
        services.ctx = ctx
        ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'medical-extract', order: 32, label: () => '病历文书提取' }, SettingsSection))
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, Page))
        let disposeEntry = null
        const setSidebar = (visible) => {
          if (visible && !disposeEntry) disposeEntry = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 32, label: () => '病历文书提取' }, Icon))
          else if (!visible && disposeEntry) { disposeEntry(); disposeEntry = null }
        }
        setSidebar(true)
        let stopped = false
        ;(async () => {
          for (let i = 0; i < 10 && !stopped; i++) {
            try { const c = await call('config'); if (!stopped) setSidebar(c.settings?.showSidebarEntry !== false); return } catch { await new Promise((r) => setTimeout(r, 1000)) }
          }
        })()
        ctx.effect?.(() => () => { stopped = true; setSidebar(false) })
      },
    }
    return plugin
  },
})
