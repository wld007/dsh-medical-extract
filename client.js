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
    // 主题与 2.5D 流水线沿用病历事件还原（类名前缀 me- → mx-）
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
.mx-clock.ver{margin-right:6px}.mx-clock.ver b{display:flex;align-items:baseline;gap:5px;white-space:nowrap;font-size:15px;font-weight:600;letter-spacing:0;color:var(--ink2)}
.mx-clock.ver small{font-size:10.5px;font-weight:500;color:var(--ink3);padding:0 5px;border:1px solid var(--line2);border-radius:3px;line-height:15px}
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
.mx-tab i.hot{color:var(--warn);font-weight:600}
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
.mx-stabs{display:flex;gap:2px;box-shadow:inset 0 -1px 0 var(--dsw-alias-border-l2,var(--line2));overflow-x:auto}
.mx-stab{position:relative;display:inline-flex;align-items:center;gap:6px;background:none;border:0;border-bottom:2px solid transparent;padding:8px 12px;font:inherit;font-size:13px;color:var(--dsw-alias-label-secondary,var(--ink2));cursor:pointer;white-space:nowrap}
.mx-stab[aria-selected="true"]{color:var(--dsw-alias-label-primary,var(--ink));font-weight:600;border-bottom-color:var(--teal,#5b3cc4)}
.mx-sdot{width:6px;height:6px;border-radius:50%;background:var(--warn,#c27a12)}
.mx-spanel{display:flex;flex-direction:column;gap:12px;min-height:240px}
.mx-scard{border:1px solid var(--dsw-alias-border-l2,var(--line2));border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:var(--dsw-alias-bg-layer-1,var(--panel))}
.mx-scard-h b{font-size:13.5px;color:var(--dsw-alias-label-primary,var(--ink))}.mx-scard-h p{margin:3px 0 0}
.mx-shint{display:block;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-tertiary,var(--ink3))}.mx-shint.ok{color:var(--ok,#2f9a55)}.mx-shint.bad{color:var(--bad,#cf3a3f)}
.mx-scheck{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:var(--dsw-alias-label-primary,var(--ink))}.mx-scheck input{margin-top:2px}
.mx-sact{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.mx-settings .mx-wide{grid-column:1/-1}
.mx-savebar{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;padding:10px 0 4px;border-top:1px solid var(--dsw-alias-border-l2,var(--line2));background:var(--dsw-alias-bg-base,var(--panel))}
.mx-mp{position:relative;width:100%}.mx-mp-row{display:flex;gap:6px}.mx-mp-row .mx-input{flex:1;min-width:0}.mx-mp-btn{flex:none;width:32px;padding:0}
.mx-mp-menu{position:absolute;z-index:30;left:0;right:0;top:calc(100% + 4px);max-height:240px;overflow:auto;padding:4px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,var(--line2));background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1,var(--panel)));box-shadow:0 8px 24px rgba(0,0,0,.16)}
.mx-mp-item{display:block;width:100%;text-align:left;padding:6px 8px;border:0;border-radius:5px;background:none;color:var(--dsw-alias-label-primary,var(--ink));font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}
.mx-mp-item:hover{background:var(--dsw-alias-bg-layer-2,var(--panel2))}.mx-mp-item.on{color:var(--teal,#5b3cc4);font-weight:600}
.mx-mp-clear{font-family:inherit;color:var(--dsw-alias-label-secondary,var(--ink2))}
.mx-mp-note{padding:6px 8px;font-size:12px;color:var(--dsw-alias-label-secondary,var(--ink2))}.mx-mp-note.bad{color:var(--bad,#cf3a3f)}
.mx-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.mx-grid2>*{min-width:0}
.mx-pop .mx-grid2.tm{grid-template-columns:minmax(0,1fr) max-content}
/* ---- 流水线：等轴测工厂＋HUD 面板（参考工业监控大屏） ---- */
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
/* 流水线页布局（同匿名化插件）：左＝流水线＋底部三栏，右＝工序详情拉到底 */
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
.mx-dtab{width:100%;border-collapse:collapse;font-size:11.5px}
.mx-dtab th{font-weight:400;font-size:10.5px;color:var(--ink3);text-align:right;padding:2px 4px;border-bottom:1px solid var(--line)}
.mx-dtab th:first-child,.mx-dtab td:first-child{text-align:left;padding-left:0;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx-dtab td{text-align:right;padding:3px 4px;border-bottom:1px solid var(--line);color:var(--ink)}
.mx-dtab td:last-child,.mx-dtab th:last-child{padding-right:0}
.mx-dz{display:flex;flex-direction:column;gap:2px;margin-bottom:6px;font-size:11.5px}
.mx-dz p{margin:0;display:flex;gap:8px;align-items:baseline;min-width:0}
.mx-dz p span{flex:none}
.mx-dz p b{flex:none;font-weight:600}
.mx-dz p small{color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.mx-mdv-bar{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line);padding-top:8px;padding-bottom:8px}
.mx-mdv-bar span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:11px}
.mx-mdv{font-size:13px;line-height:21px;color:var(--ink);max-width:960px;min-width:0}
.mx-mdv h1{font-size:18px;margin:6px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--teal)}
.mx-mdv h2{font-size:15px;margin:20px 0 8px;padding-left:8px;border-left:3px solid var(--teal)}
.mx-mdv h3{font-size:13.5px;margin:16px 0 6px}
.mx-mdv h4{font-size:13px;margin:12px 0 4px}
.mx-mdv p{margin:6px 0}
.mx-mdv ul,.mx-mdv ol{margin:4px 0 8px;padding-left:20px}
.mx-mdv li{margin:2px 0;word-break:break-word}
.mx-mdv blockquote{margin:8px 0;padding:6px 10px;border-left:3px solid var(--warn);background:color-mix(in srgb,var(--warn) 7%,transparent);color:var(--ink2)}
.mx-mdv code{font-family:var(--mono);font-size:11.5px;padding:1px 4px;border-radius:4px;background:var(--tealdim);word-break:break-all}
.mx-mdv-tw{overflow-x:auto;margin:6px 0 10px}
.mx-mdv table{border-collapse:collapse;font-size:12.5px;min-width:50%}
.mx-mdv th{text-align:left;font-weight:600;background:var(--tealdim);padding:5px 10px;border:1px solid var(--line)}
.mx-mdv td{padding:4px 10px;border:1px solid var(--line);vertical-align:top;word-break:break-word}
.mx-mdv table.kv th{font-weight:400;color:var(--ink2);background:var(--panel2);white-space:nowrap;width:1%}
.mx-mdv-layout{display:grid;grid-template-columns:minmax(0,960px) 240px;gap:28px;align-items:start}
.mx-mdv-toc{position:sticky;top:0;max-height:calc(100vh - 240px);overflow:auto;display:flex;flex-direction:column;gap:1px;padding:4px 0 4px 12px;border-left:1px solid var(--line)}
.mx-mdv-toc-h{font-size:11px;font-weight:600;letter-spacing:1px;color:var(--ink3);padding:2px 6px 6px}
.mx-mdv-toc-i{display:block;width:100%;padding:3px 6px;border:0;border-radius:4px;background:none;color:var(--ink2);font:inherit;font-size:12px;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx-mdv-toc-i.l2{font-weight:600;color:var(--ink);margin-top:4px}
.mx-mdv-toc-i.l3{padding-left:16px}
.mx-mdv-toc-i:hover{background:var(--tealdim)}
.mx-mdv-toc-i.on{color:var(--teal2);background:var(--tealdim);box-shadow:inset 2px 0 0 var(--teal)}
@media (max-width:1100px){.mx-mdv-layout{grid-template-columns:minmax(0,1fr)}.mx-mdv-toc{display:none}}
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
.mx-al-ov{position:absolute;z-index:2;top:10px;right:12px;width:300px;max-height:calc(100% - 36px);overflow:auto;display:flex;flex-direction:column;gap:2px;padding:6px 10px;background:color-mix(in srgb,var(--panel) 90%,transparent);border:1px solid var(--line2);border-radius:6px;backdrop-filter:blur(3px);font-size:11px}
.mx-al-ov.crit{border-color:var(--bad);box-shadow:inset 3px 0 0 var(--bad)}.mx-al-ov.crit .mx-al-dot{animation:mx-pulse 1.4s ease-in-out infinite}
.mx-al-ov.warn{box-shadow:inset 3px 0 0 var(--warn)}
.mx-al-ov.ok{flex-direction:row;align-items:center;gap:6px;width:auto;color:var(--ink2)}.mx-al-ov.shut{width:auto}
.mx-al-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.mx-al-head{display:flex;align-items:center;gap:6px;background:none;border:0;padding:2px 0;cursor:pointer;color:var(--ink);font:inherit}.mx-al-head b{font-size:12px}.mx-al-head .mx-cap{flex:1;text-align:left}
.mx-al-n{font-family:var(--mono);font-size:10.5px;color:var(--ink2);background:var(--panel3);border-radius:8px;padding:0 6px}
.mx-al-list{display:flex;flex-direction:column}
.mx-al-item{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;background:none;border:0;border-top:1px solid var(--line);padding:6px 2px;font:inherit;color:var(--ink);cursor:pointer}
.mx-al-item:disabled{cursor:default}.mx-al-item:not(:disabled):hover{background:var(--panel2)}
.mx-al-item>i{width:7px;height:7px;border-radius:50%}.mx-al-item b{display:block;font-weight:600;font-size:11.5px}.mx-al-item small{display:block;color:var(--ink3);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mx-al-more{align-self:flex-end;font-size:11px;padding-top:4px}
.mx-act{position:relative}
.mx-new{border-color:var(--fill);background:var(--fill);color:#fff;font-weight:600}
.mx-new:hover:not(:disabled){filter:brightness(1.06)}
.mx-new:disabled{background:transparent;color:var(--ink2);border-color:var(--line2);font-weight:400}
.mx-caret{font-size:9px;opacity:.7;margin-left:5px}
.mx-shade{position:fixed;inset:0;z-index:940;background:rgba(0,0,0,.35)}
.mx-pop{position:absolute;right:0;top:36px;z-index:950;width:460px;padding:14px 16px;border:1px solid color-mix(in srgb,var(--teal) 50%,transparent);border-radius:8px;background:var(--panel);box-shadow:0 20px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:10px;text-align:left}
.mx-pop-h{display:flex;justify-content:space-between;align-items:center;gap:6px}.mx-pop-h b{font-size:12px;letter-spacing:2px;color:var(--teal2);font-weight:600}
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
.mx-back{font-size:11px;margin-left:4px;white-space:nowrap}
.mx-ov{gap:8px}.mx-ov .mx-side-h .mx-cap{flex:1}
.mx-ob{border:1px solid var(--line2);border-radius:6px;overflow:hidden;flex:none}
.mx-ob-h{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--panel2);border-bottom:1px solid var(--line);border-left:3px solid var(--teal)}.mx-ob-h b{font-size:12.5px}
.mx-ob-b{padding:8px 10px;display:flex;flex-direction:column;gap:6px}.mx-ob-b .mx-legend{margin-top:0;padding-top:0}
.mx-ob-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.mx-ob-kv div{display:flex;justify-content:space-between;align-items:baseline;gap:6px;background:var(--panel2);border-radius:4px;padding:4px 8px;min-width:0}
.mx-ob-kv span{font-size:10.5px;color:var(--ink3)}.mx-ob-kv b{font-family:var(--mono);font-size:13px}
.mx-ob-models{display:grid;gap:5px 10px;align-items:center;font-size:11px}.mx-ob-models>span{color:var(--ink3)}.mx-ob-models>b{font-family:var(--mono);font-weight:600;text-align:right;font-size:12px}
.mx-ob-models b small{font-weight:400;color:var(--warn)}
.mx-ob-mh{display:flex;flex-direction:column;align-items:flex-end;min-width:0;border-bottom:1px solid var(--line);padding-bottom:3px}.mx-ob-mh small{font-family:var(--mono);font-size:10px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.mx-ob-mh small i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ok);margin-right:4px}.mx-ob-mh small i.bad{background:var(--bad)}
.mx-lat .bars{display:flex;align-items:flex-end;gap:2px;height:30px}.mx-lat .bars i{flex:1;background:color-mix(in srgb,var(--teal) 55%,transparent);border-radius:1px 1px 0 0}.mx-lat .bars i.slow{background:var(--bad)}
.mx-lat .lbl{display:flex;gap:2px;font-family:var(--mono);font-size:8.5px;color:var(--ink3)}.mx-lat .lbl span{flex:1;text-align:center}
.mx-ob-conc{display:flex;flex-direction:column;gap:2px}.mx-ob-ch{display:flex;gap:10px;align-items:baseline;font-size:11px;color:var(--ink3)}.mx-ob-ch>b{color:var(--ink);font-size:12px}.mx-ob-ch b{font-family:var(--mono)}.mx-ob-ch .tp{color:var(--vio)}
.mx-conc{width:100%;height:74px;display:block}.mx-conc path,.mx-conc polyline{fill:none;vector-effect:non-scaling-stroke}
.mx-conc .in{stroke:var(--teal);stroke-width:2}.mx-conc .lim{stroke:var(--ink3);stroke-dasharray:4 3;stroke-width:1}.mx-conc .zero{stroke:var(--line2);stroke-width:1}
.mx-conc .tp{stroke:color-mix(in srgb,var(--vio) 70%,transparent);stroke-width:1.2}.mx-conc .q{fill:color-mix(in srgb,var(--warn) 30%,transparent);stroke:none}
.mx-legend i.ln{width:12px;height:2px;border-radius:0}.mx-legend i.ln.in{background:var(--teal)}.mx-legend i.ln.lim{background:repeating-linear-gradient(90deg,var(--ink3) 0 3px,transparent 3px 5px)}.mx-legend i.ln.tp{background:var(--vio)}.mx-legend i.ln.q{background:color-mix(in srgb,var(--warn) 50%,transparent);height:6px}
.mx-rounds{display:flex;flex-direction:column;gap:4px;margin:8px 0;border-left:2px solid var(--line2);padding-left:8px}
.mx-round{display:grid;grid-template-columns:48px minmax(0,1fr) minmax(0,1fr);gap:10px;font-size:11.5px}.mx-round em{font-style:normal;font-family:var(--mono);font-size:10.5px;color:var(--ink3)}
.mx-round small{display:block;font-size:10px;color:var(--ink3)}.mx-why{font-size:10.5px;color:var(--ink2);margin-top:2px}
.mx-nd{display:grid;grid-template-columns:minmax(0,1fr) auto auto;grid-template-rows:auto auto;column-gap:8px;text-align:left;background:none;border:0;border-top:1px solid var(--line);padding:5px 2px;font:inherit;color:var(--ink);cursor:pointer}
.mx-nd:hover{background:var(--panel2)}.mx-nd span{font-size:11.5px;font-weight:600}.mx-nd small{grid-column:1;grid-row:2;font-size:10.5px;color:var(--ink3)}.mx-nd b{grid-column:2;grid-row:1/3;align-self:center}.mx-nd i{grid-column:3;grid-row:1/3;align-self:center;font-style:normal;font-size:11px;color:var(--teal)}
.mx-ob-models .z{background:var(--panel2)}
button.mx-ob-mh{background:none;border:0;border-bottom:1px solid var(--line);font:inherit;color:var(--ink);cursor:pointer;padding:0 0 3px;text-align:right}button.mx-ob-mh:hover b{color:var(--teal)}
.mx-conc2{display:flex;flex-direction:column;gap:3px;padding-top:4px}
.mx-conc2-h{display:flex;align-items:baseline;gap:10px;font-size:11px;color:var(--ink3);flex-wrap:wrap}.mx-conc2-h>b{color:var(--ink);font-size:12px}
.mx-conc2-h em{font-style:normal;font-family:var(--mono);font-weight:700;color:var(--ink);font-size:12.5px}.mx-conc2-h .thr,.mx-conc2-h .thr em{color:var(--vio)}
.mx-conc2-chip{margin-left:auto;font-size:10.5px;border-radius:3px;padding:0 6px;line-height:17px;border:1px solid var(--line2)}
.mx-conc2-chip.up{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 45%,transparent);background:color-mix(in srgb,var(--ok) 8%,transparent)}
.mx-conc2-chip.full{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,transparent);background:color-mix(in srgb,var(--warn) 8%,transparent)}
.mx-conc2-plot{position:relative;display:grid;grid-template-columns:22px minmax(0,1fr) 28px;align-items:stretch;height:76px}
.mx-conc2-plot .gut{display:flex;flex-direction:column;justify-content:space-between;font-family:var(--mono);font-size:9px;color:var(--ink3);text-align:right;padding-right:3px}.mx-conc2-plot .gut .z{margin-top:auto;margin-bottom:12px}
.mx-conc2-plot svg{width:100%;height:76px;display:block}.mx-conc2-plot svg path,.mx-conc2-plot svg line{vector-effect:non-scaling-stroke}
.mx-conc2-plot .fa{fill:color-mix(in srgb,var(--teal) 14%,transparent);stroke:none}.mx-conc2-plot .al{fill:none;stroke:var(--teal);stroke-width:2}
.mx-conc2-plot .lim{fill:none;stroke:var(--ink3);stroke-width:1;stroke-dasharray:4 3}.mx-conc2-plot .tl{fill:none;stroke:var(--vio);stroke-width:1.2;opacity:.8}
.mx-conc2-plot .q{fill:none;stroke:var(--teal);stroke-width:1;opacity:.55}.mx-conc2-plot .sq{fill:none;stroke:var(--warn);stroke-width:1.2;stroke-dasharray:3 2}.mx-conc2-plot .ax{stroke:var(--line2);stroke-width:1}
.mx-conc2-plot .rg{font-family:var(--mono);font-size:9px;color:var(--vio);padding-left:3px}.mx-conc2-plot .wait{position:absolute;left:30px;top:24px;font-size:10.5px;color:var(--ink3)}
.mx-conc2-srv{font-size:10.5px;color:var(--ink2)}.mx-conc2-srv .k{display:inline-block;background:var(--panel3);border-radius:3px;padding:0 5px;margin-right:6px;color:var(--ink3)}
.mx-conc2-f{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;color:var(--ink3)}.mx-conc2-f .mono{font-family:var(--mono);color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx-legend i.ln.sq{background:repeating-linear-gradient(90deg,var(--warn) 0 3px,transparent 3px 5px);height:2px}
.mx-ob-house{display:grid;grid-template-columns:8px minmax(0,1fr) auto 12px;gap:8px;align-items:center;text-align:left;background:none;border:0;border-top:1px solid var(--line);padding:6px 2px;font:inherit;color:var(--ink);cursor:pointer}
.mx-ob-house:first-child{border-top:0}.mx-ob-house:disabled{cursor:default;opacity:.7}.mx-ob-house:not(:disabled):hover{background:var(--panel2)}
.mx-ob-house>i{width:7px;height:7px;border-radius:50%;background:var(--ink3)}.mx-ob-house>i.on{background:var(--ok)}.mx-ob-house>i.bad{background:var(--bad)}
.mx-ob-house b{display:block;font-family:var(--mono);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mx-ob-house small{display:block;font-size:10.5px;color:var(--ink3)}
.mx-ob-house .mx-num{font-size:11px;color:var(--ink2);white-space:nowrap}.mx-ob-go{color:var(--ink3)}
.mx-ob .mx-link{align-self:flex-end;font-size:11px}
.mx-slegacy{margin:6px 0 0;font-size:11px;line-height:1.55;padding:6px 8px}
.mx-sdesc{margin:6px 0 2px;font-size:11.5px;line-height:1.6;color:var(--ink2)}.mx-sdesc span{color:var(--ink3)}
.mx-shead{display:flex;flex-direction:column;gap:6px;margin-top:8px;padding-top:10px;border-top:1px solid var(--line2)}
.mx-ring{display:flex;flex-direction:column;gap:6px;min-width:0}.mx-ring-t{display:flex;align-items:baseline;gap:10px;min-width:0}.mx-ring b{font-size:22px;font-weight:500;color:var(--ink);line-height:1.1;white-space:nowrap}.mx-ring small{font-size:11px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.mx-ring-bar{height:6px;border-radius:3px;background:var(--line2);overflow:hidden}.mx-ring-bar i{display:block;height:100%;border-radius:3px}
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
.mx-clear{margin:2px 0 8px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--bad) 45%,var(--line2));border-radius:6px;background:color-mix(in srgb,var(--bad) 6%,var(--panel));display:flex;flex-direction:column;gap:6px;font-size:12px}
.mx-clear p{margin:0;color:var(--ink2);line-height:1.5}.mx-clear-act{display:flex;justify-content:flex-end;gap:6px}
.mx-btn.mx-danger{background:var(--bad);border-color:var(--bad);color:#fff}.mx-btn.mx-danger:disabled{opacity:.6}
.mx-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:10.5px;color:var(--ink2);margin-top:auto;padding-top:6px}
.mx-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}
/* 一行放下：不折行，三项平分宽度，太窄时各自省略号（悬停看全） */
.mx-legend.mx-lg1{flex-wrap:nowrap;gap:8px;justify-content:space-between}.mx-legend.mx-lg1>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mx-ev{display:grid;grid-template-columns:76px 1fr 44px;gap:8px;align-items:center;font-size:11px;margin-bottom:5px}
.mx-ev b{font-family:var(--mono);font-weight:500;text-align:right}
.mx-ev .mx-ticks{margin:0;height:10px}
.mx-q{border-bottom:2px solid var(--teal);background:color-mix(in srgb,var(--teal) 14%,transparent);border-radius:2px;cursor:pointer}
.mx-q.neg{border-color:var(--ink3);background:color-mix(in srgb,var(--ink3) 14%,transparent);border-bottom-style:dashed}
.mx-q.hx{border-color:var(--fact);background:color-mix(in srgb,var(--fact) 12%,transparent)}
.mx-q.fam{border-color:var(--judge);background:color-mix(in srgb,var(--judge) 12%,transparent)}
.mx-q.mdl{border-color:var(--vio)}
.mx-q.sel{outline:1.5px solid var(--sel);outline-offset:1px}
.mx-split{display:grid;grid-template-columns:320px 1fr;gap:8px;flex:1;min-height:0}
.mx-fl{gap:0}
.mx-fl-bar{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);flex-wrap:wrap}
.mx-fl-tg{display:flex;gap:4px}.mx-fl-tg .mx-dc-tgb{flex:none}
.mx-dc-ff{display:flex;flex-wrap:wrap;gap:4px;padding:0 10px 8px;border-bottom:1px solid var(--line)}
.mx-dc-ffb{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line2);background:var(--panel2);color:var(--ink2);border-radius:999px;padding:2px 9px;font:inherit;font-size:11.5px;cursor:pointer}
.mx-dc-ffb i{font-style:normal;font-family:var(--mono);font-size:10.5px;color:var(--ink3)}
.mx-dc-ffb.on{border-color:var(--teal);color:var(--teal2);background:var(--tealdim)}
.mx-dc-ffb.on i{color:var(--teal2)}
.mx-dc-ffb.todo:not(.zero) i,.mx-dc-ffb.hint:not(.zero) i{color:var(--warn)}
.mx-dc-ffb.zero{opacity:.5}
.mx-fl-note{padding:6px 14px;font-size:11.5px;color:var(--warn);border-bottom:1px solid var(--line)}
.mx-fl-tbl{width:100%;border-collapse:collapse;font-size:12px}
.mx-fl-tbl th{position:sticky;top:0;background:var(--panel);text-align:left;font-weight:500;color:var(--ink3);font-size:11px;padding:7px 10px;border-bottom:1px solid var(--line);z-index:1}
.mx-fl-tbl td{padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.mx-fl-tbl .n{text-align:right;white-space:nowrap}.mx-fl-tbl td.z{color:var(--ink3)}
.mx-fl-tbl tr.click{cursor:pointer}.mx-fl-tbl tr.click:hover td{background:var(--panel2)}
.mx-fl-name{max-width:520px}.mx-fl-name span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mx-fl-name small{color:var(--ink3);font-size:10.5px;margin-right:8px}
.mx-fl-st{display:inline-flex;gap:5px;align-items:center;white-space:nowrap}.mx-fl-st i{width:7px;height:7px;border-radius:50%;background:var(--ink3)}
.mx-fl-st.ok i{background:var(--ok)}.mx-fl-st.run i{background:var(--warn);animation:mx-pulse 1.2s infinite}.mx-fl-st.bad{color:var(--badink)}.mx-fl-st.bad i{background:var(--bad)}.mx-fl-st.wait{color:var(--ink3)}.mx-fl-st.wait i{background:none;border:1.5px solid var(--ink3);box-sizing:border-box}
.mx-fl-err{font-size:10.5px;color:var(--badink);margin-top:2px;max-width:280px}
.mx-dc{display:grid;grid-template-columns:260px minmax(0,1fr) 380px;gap:8px;flex:1;min-height:0}
.mx-dc-side{padding:10px;gap:8px;min-height:0}
.mx-dc-list{flex:1;border-top:1px solid var(--line);padding-top:6px}
.mx-dc-search{display:flex;flex-direction:column;gap:6px}
.mx-dc-tgb{flex:1;border:1px solid var(--line2);background:var(--panel2);color:var(--ink2);border-radius:5px;padding:3px 6px;font:inherit;font-size:11.5px;cursor:pointer}
.mx-dc-tgb.on{border-color:var(--teal);color:var(--teal2);background:var(--tealdim)}.mx-dc-tgb.hot:not(.on){color:var(--warn)}
.mx-dc-pc{border-radius:7px;margin-bottom:4px;border:1px solid transparent}
.mx-dc-pc.open{border-color:var(--line2);background:var(--panel2);padding-bottom:6px}
.mx-dc-ph{display:flex;align-items:center;gap:5px;padding:7px 8px 2px;cursor:pointer;border-radius:6px}
.mx-dc-pc:not(.open) .mx-dc-ph:hover{background:var(--panel2)}
.mx-dc-ph b{font-size:12.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx-dc-caret{color:var(--ink3);font-size:10px;width:10px}
.mx-dc-pill{font-size:10px;line-height:16px;padding:0 6px;border-radius:8px;background:var(--panel3);color:var(--ink3);white-space:nowrap}
.mx-dc-pill.hot{background:color-mix(in srgb,var(--warn) 16%,transparent);color:var(--warn);font-weight:600}
.mx-dc-pm{font-size:10.5px;color:var(--ink3);padding:0 8px 6px 23px}
.mx-dc-prog{height:3px;margin:0 8px 6px 23px;border-radius:2px;background:var(--line)}.mx-dc-prog i{display:block;height:100%;border-radius:2px;background:var(--ok)}
.mx-dc-tl{padding:0 6px 0 10px}
.mx-dc-enc{position:relative;margin-top:4px}
.mx-dc-eh{display:flex;gap:6px;align-items:baseline;font-size:10.5px;color:var(--ink2);padding:2px 4px 2px 18px;font-weight:600}
.mx-dc-eh span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mx-dc-eh em{font-style:normal;font-weight:400;color:var(--ink3);font-family:var(--mono)}
.mx-dc-dr{position:relative;display:grid;grid-template-columns:14px minmax(0,1fr) auto auto;gap:6px;align-items:center;padding:4px 6px 4px 4px;border-radius:5px;cursor:pointer;font-size:11.5px}
.mx-dc-dr::before{content:'';position:absolute;left:10px;top:-4px;bottom:-4px;width:1px;background:var(--line2)}
.mx-dc-enc .mx-dc-dr:first-of-type::before{top:50%}.mx-dc-enc .mx-dc-dr:last-child::before{bottom:50%}.mx-dc-enc .mx-dc-dr:first-of-type:last-child::before{display:none}
.mx-dc-dr:hover{background:var(--panel3)}
.mx-dc-dr.on{background:var(--tealdim);box-shadow:inset 3px 0 0 var(--teal)}.mx-dc-dr.on b{color:var(--teal2)}
.mx-dc-dr b{font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx-dc-dot{position:relative;z-index:1;width:11px;height:11px;border-radius:50%;justify-self:center;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:8px;line-height:1;color:#fff}
.mx-dc-dr.todo .mx-dc-dot{background:var(--warn)}.mx-dc-dr.val .mx-dc-dot{background:var(--teal)}
.mx-dc-dr.seen .mx-dc-dot{background:var(--ok)}.mx-dc-dr.empty .mx-dc-dot{background:var(--panel);border:1.5px solid var(--ink3)}
.mx-dc-time{font-size:10px;color:var(--ink3)}
.mx-dc-st{font-size:10.5px;color:var(--ink3);font-family:var(--mono);min-width:34px;text-align:right}
.mx-dc-dr.todo .mx-dc-st{color:var(--warn);font-weight:700}.mx-dc-dr.empty .mx-dc-st{color:var(--ink3)}
.mx-dc-key{display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:6px;font-size:10.5px;color:var(--ink3)}
.mx-dc-key span::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:-1px;box-sizing:border-box}
.mx-dc-key .todo::before{background:var(--warn)}.mx-dc-key .seen::before{background:var(--ok)}.mx-dc-key .val::before{background:var(--teal)}.mx-dc-key .empty::before{border:1.5px solid var(--ink3)}
.mx-dc-bar2{padding:7px 12px}
.mx-dc-swatch{display:flex;gap:10px;flex-wrap:wrap;font-size:10.5px;color:var(--ink3)}
.mx-dc-swatch i{display:inline-block;width:12px;height:8px;border-radius:2px;margin-right:4px;vertical-align:0}
.mx-dc-swatch i.val{background:color-mix(in srgb,var(--teal) 35%,transparent);border-bottom:2px solid var(--teal)}
.mx-dc-swatch i.add{background:color-mix(in srgb,var(--decide) 35%,transparent);border-bottom:2px solid var(--decide)}
.mx-dc-swatch i.other{background:color-mix(in srgb,var(--warn) 30%,transparent);border-bottom:2px dashed var(--warn)}
.mx-dc-swatch i.rej{border-bottom:2px dotted var(--bad);height:4px}
.mx-dc-swatch i.hit{border-bottom:2px dotted var(--warn);height:4px}
.mx-dc-banner{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:7px 12px;background:color-mix(in srgb,var(--warn) 14%,transparent);color:var(--warn);font-size:12px;font-weight:600;border-bottom:1px solid color-mix(in srgb,var(--warn) 40%,transparent)}
.mx-dc-text{flex:1;position:relative;background:var(--panel);padding:0}
.mx-dc-paper{padding:14px 20px 12px}
.mx-dc-ttl{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:12px}
.mx-dc-ttl b{font-size:16px}.mx-dc-ttl span{color:var(--ink2);font-size:12px}.mx-dc-ttl small{margin-left:auto;color:var(--ink3);font-size:10px}
.mx-dc-body{font-size:13.5px;line-height:2.1}
.mx-dc-tip{margin-top:14px;padding-top:8px;border-top:1px dashed var(--line);font-size:10.5px;color:var(--ink3);text-align:center}
.mx-dc-page{display:flex;gap:6px;align-items:center;justify-content:center;padding:6px 0}
.mx-dc-legacy{font-size:11px;padding:8px;line-height:1.6}
.mx-dc-mid,.mx-dc-right{min-width:0;min-height:0;gap:0}
.mx-dc-bar{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line)}
.mx-dk{border-radius:2px;cursor:pointer}
.mx-dk.val{background:color-mix(in srgb,var(--teal) 14%,transparent);border-bottom:2px solid var(--teal)}
.mx-dk.add{background:color-mix(in srgb,var(--decide) 18%,transparent);border-bottom:2px solid var(--decide)}
.mx-dk.other{background:color-mix(in srgb,var(--warn) 18%,transparent);border-bottom:2px dashed var(--warn)}
.mx-dk.rej{text-decoration:line-through;text-decoration-color:var(--bad);border-bottom:1px dotted var(--ink3)}
.mx-dk.hit{border-bottom:2px dotted var(--warn)}
.mx-dk.on{background:color-mix(in srgb,var(--teal) 32%,transparent);border-bottom-width:3px;border-bottom-style:solid;border-bottom-color:var(--teal2)}
.mx-dc-add{position:absolute;z-index:5;width:290px;background:var(--panel);border:1px solid var(--teal);border-radius:7px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:10px;display:flex;flex-direction:column;gap:6px;font-size:12px;line-height:1.5}
.mx-dc-add label{display:grid;grid-template-columns:56px 1fr;align-items:center;gap:6px;color:var(--ink2)}
.mx-dc-addq{color:var(--ink2);font-size:11.5px}
.mx-dc-fields{flex:1;padding:8px 10px}
.mx-dc-f{border:1px solid var(--line);border-radius:6px;padding:6px 8px;margin-bottom:6px;background:var(--panel2)}
.mx-dc-f.none{background:transparent}.mx-dc-f.on{border-color:var(--teal)}.mx-dc-f.hot{border-color:var(--warn);box-shadow:inset 3px 0 0 var(--warn)}
.mx-dc-fh{display:flex;gap:6px;align-items:center;cursor:pointer}.mx-dc-fh b{font-size:12px}
.mx-dc-hint{display:block;margin-top:4px;border:0;background:none;padding:0;font:inherit;font-size:11px;color:var(--warn);cursor:pointer;text-align:left}
.mx-dc-v{margin-top:4px}
.mx-dc-vb{display:flex;gap:4px;align-items:center;flex-wrap:wrap;width:100%;border:1px solid var(--line2);border-radius:4px;background:var(--panel);padding:3px 6px;font:inherit;font-size:12px;color:var(--ink);cursor:pointer;text-align:left}
.mx-dc-v.on .mx-dc-vb{border-color:var(--teal)}.mx-dc-v.rej .mx-dc-vb b{text-decoration:line-through;color:var(--ink3)}
.mx-dc-va{padding:4px 2px 2px}.mx-dc-q{font-size:11px;margin-bottom:4px}
.mx-dc-btns{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
.mx-dc-edit{display:flex;gap:4px}.mx-dc-edit .mx-input{flex:1}
.mx-dc-rv{border:1px dashed var(--warn);border-radius:5px;padding:6px;margin-top:5px;background:color-mix(in srgb,var(--warn) 5%,transparent)}
.mx-dc-rvh{display:flex;gap:4px}.mx-dc-rvc{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px;font-size:11.5px}.mx-dc-rvc small{display:block;font-size:10px;color:var(--ink3)}
.mx-dc-other{margin:6px 2px;font-size:11.5px}
.mx-dc-foot{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-top:1px solid var(--line);font-size:11px}
.mx-rvx-note{padding:6px 14px;border-bottom:1px solid var(--line);color:var(--ok);font-size:12px;cursor:pointer}.mx-rvx-note.bad{color:var(--badink)}
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
    const MODE_LABEL = { hybrid: '模型通读＋规则对照', model: '仅模型通读' }
    // 旧批次（仅规则模式已停用）仍能查看
    const modeLabel = (m) => MODE_LABEL[m] ?? (m === 'rules' ? '仅规则（已停用）' : m)
    const STATE_LABEL = { run: '运行中', part: '进行中', hold: '待复核', done: '完成', idle: '未开始' }
    const MONO = 'SF Mono,JetBrains Mono,Menlo,monospace'
    // 值的来源与标记：数据里存的是代码或旧词，页面上换成好懂的说法
    const methodLabel = (m) => { const x = String(m ?? ''); const human = x.endsWith('→人工'); const base = human ? x.slice(0, -3) : x; const t = base === 'model' ? '模型' : base === 'model+rule' ? '模型（与规则一致）' : base.startsWith('rule') ? '规则' : base; return human ? `${t}，人工改值` : t }
    const flagLabel = (f) => String(f).replace('规则票', '规则匹配').replace('复判', '复查').replace('人工改判', '人工改值')
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
      // 复核页打开的病人、文书、字段
      const [focus, setFocus] = useState(null)
      const [error, setError] = useState('')
      const [showNew, setShowNew] = useState(false)
      const [runsOpen, setRunsOpen] = useState(false)
      // 清空批次记录：null＝没在确认；{ deliverable, busy, error }＝确认中
      const [clearing, setClearing] = useState(null)
      const [modal, setModal] = useState(null)
      const [version, setVersion] = useState(null)
      const [now, setNow] = useState(Date.now())
      const [runTick, setRunTick] = useState(0)
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
      }, [runId, runTick])
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
      const openPatient = (p) => { setFocus({ patient: p }); setTab('source') }
      const selectRun = (id) => { setRunId(id); setRun(null); setFocus(null); setRunsOpen(false); setTab('line') }
      const clearAll = async () => {
        setClearing((c) => ({ ...c, busy: true, error: '' }))
        try {
          const v = await call('clearRuns', { deliverable: clearing?.deliverable === true })
          setRun(null); setFocus(null); setRunId(activeId ?? null)
          await refreshList()
          setClearing(v.failed?.length ? { deliverable: false, busy: false, error: `已删除 ${v.removed} 个，${v.failed.length} 个失败：${v.failed[0].error}` } : null)
        } catch (e) { setClearing((c) => ({ ...c, busy: false, error: msg(e) })) }
      }
      const elapsed = run?.startedAt ? Math.max(0, (run.status === 'running' ? now : Date.parse(run.finishedAt ?? run.startedAt)) - Date.parse(run.startedAt)) : null
      const percent = run?.shards?.total ? Math.round(run.shards.done / run.shards.total * 100) : null
      const lineStatus = run?.status ?? 'idle'
      const dark = useHostDark()
      const heldFormats = run?.format?.held ?? 0
      // 按流程顺序（同匿名化插件的分组）：流水线｜模板 E0  格式 E1　复核 E6  结果表 E7  原文标注（从结果表看出处）　模型调用 报告（全程记录）
      const tabs = [['line', '◈ 流水线'], ['template', '模板', run?.template?.fields, 'sep'], ...(run?.format ? [['formats', '格式', heldFormats]] : []), ['files', '文件', run?.totals?.unitErrors, 'gap'], ['source', '复核', run?.humanReview?.todo ?? run?.totals?.review, null, true], ['calls', '模型调用', null, 'gap'], ['report', '报告']]
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
          run ? h('div', { className: 'mx-clock sep pct', title: `${run.shards.done} / ${run.shards.total} 个数据块` }, h('span', {}, '完成'), h('b', {}, percent == null ? '—' : String(percent), h('small', {}, '%'))) : null,
          version ? (() => {
            // 0.1.0-dev.42 → 大字 v0.1.0 ＋ 小字 dev.42（不折行，和用时、完成同一基线）
            const [main, pre] = String(version).split(/-(.+)/)
            return h('div', { className: 'mx-clock ver', title: `v${version}` }, h('span', {}, '版本'), h('b', {}, `v${main}`, pre ? h('small', {}, pre) : null))
          })() : null,
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
            h('button', { className: 'mx-btn mx-hbtn', 'aria-expanded': runsOpen ? 'true' : 'false', onClick: () => { if (!runsOpen) refreshList(); setClearing(null); setRunsOpen(!runsOpen) } }, '记录', runs.length ? h('i', { className: 'mx-hcount' }, String(runs.length)) : null),
            runsOpen ? h('div', { className: 'mx-shade', onMouseDown: () => setRunsOpen(false) }) : null,
            runsOpen ? h('div', { className: 'mx-pop mx-runs-pop', role: 'dialog', 'aria-label': '批次记录' },
              h('div', { className: 'mx-pop-h' }, h('b', {}, '批次记录'), h('span', { className: 'mx-sp' }), h('button', { className: 'mx-btn sm', onClick: refreshList }, '刷新'),
                h('button', { className: 'mx-btn sm', disabled: !runs.some((r) => r.id !== activeId) || !!clearing, title: '删除所有批次记录（正在运行的保留）', onClick: () => setClearing({ deliverable: false, busy: false, error: '' }) }, '清空')),
              clearing ? h('div', { className: 'mx-clear' },
                h('b', {}, `清空 ${runs.filter((r) => r.id !== activeId).length} 个批次记录${activeId ? '（正在运行的保留）' : ''}`),
                h('p', {}, '删除这些批次的报告、过程文件和调用记录，记录列表清空，已取消或失败的批次也不能再续跑。不可撤销。'),
                h('p', {}, '保留：人工裁定（重跑沿用）、模型回复缓存、格式库。'),
                h('label', { className: 'mx-pick' }, h('input', { type: 'checkbox', checked: clearing.deliverable === true, disabled: clearing.busy, onChange: (e) => setClearing({ ...clearing, deliverable: e.target.checked }) }), '同时删除交付数据（输出根目录 output 下的结果）'),
                clearing.error ? h('div', { className: 'mx-err' }, clearing.error) : null,
                h('div', { className: 'mx-clear-act' },
                  h('button', { className: 'mx-btn sm', disabled: clearing.busy, onClick: () => setClearing(null) }, '取消'),
                  h('button', { className: 'mx-btn sm mx-danger', disabled: clearing.busy, onClick: clearAll }, clearing.busy ? '正在删除…' : '全部删除'))) : null,
              !runs.length ? h('div', { className: 'mx-faint' }, '还没有批次。')
                : h('div', { className: 'mx-runs' }, runs.map((r) => h('div', { key: r.id, role: 'button', tabIndex: 0, className: `mx-run${r.id === runId ? ' on' : ''}`, onClick: () => selectRun(r.id) },
                  h('div', { className: 'mx-run-top' }, h('span', { className: 'mx-run-name', title: r.outputRoot }, `${r.input} · ${r.template}`), statusChip(r.status)),
                  h('div', { className: 'mx-run-meta' }, h('span', {}, fmtTime(r.startedAt)), h('span', { className: 'mx-num' }, `文书 ${big(r.documents)} · 值 ${big(r.values)}${r.review ? ` · 待复核 ${r.review}` : ''}`)))))) : null),
          h('button', { className: 'mx-icon', title: '设置', 'aria-label': '设置', onClick: () => setModal('settings') }, '⚙')),
        h('nav', { className: 'mx-frame mx-tabs', role: 'tablist' }, tabs.map(([k, label, n, group, hot]) => h(React.Fragment, { key: k },
          group === 'sep' ? h('span', { className: 'mx-tab-sep', 'aria-hidden': 'true' }) : null,
          h('button', { role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', className: `mx-tab${tab === k ? ' on' : ''}${group === 'gap' ? ' mx-tab-gap' : ''}`, onClick: () => setTab(k) }, label, n ? h('i', { className: hot ? 'hot' : '', title: hot ? `待判断 ${fmt(n)} 项` : undefined }, big(n)) : null)))),
        error ? h('div', { className: 'mx-err', onClick: () => setError('') }, error) : null,
        h('div', { className: 'mx-body' },
          tab === 'template' ? h(Templates, { run, onError: setError })
            : !run ? h('div', { className: 'mx-frame mx-empty', style: { flex: 1 } }, runs.length ? '加载中…' : '还没有批次。点右上角「＋ 新批次」选择病历目录或文件，选一个提取模板开始。')
              : tab === 'line' ? h(Pipeline, { run, goto: setTab, openPatient })
                : tab === 'formats' ? h(Formats, { run, busy: !!activeId, onRerun: (id) => { setRunId(id); setRun(null); refreshList(); setTab('line') }, onError: setError })
                  : tab === 'files' ? h(Files, { run, openPatient })
                  : tab === 'source' ? h(Source, { key: run.id, run, focus, setFocus, onError: setError, onRunChanged: () => { setRunTick((n) => n + 1); refreshList() } })
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
      // 本插件只用模型从文书里提取：没配提取模型不能开始
      const noModel = cfg.value && !cfg.value.modelConfigured
      const curMode = MODE_LABEL[mode] ? mode : MODE_LABEL[cfg.value?.mode] ? cfg.value.mode : 'hybrid'
      const resumeOk = resumable && resumable.flow === 'read'
      return h('div', { className: 'mx-pop', role: 'dialog', 'aria-label': '新批次' },
        h('div', { className: 'mx-pop-h' }, h('b', {}, '新批次'), h('button', { className: 'mx-btn sm', onClick: onClose, 'aria-label': '关闭' }, '✕')),
        noModel ? h('div', { className: 'mx-err', style: { margin: 0 } }, '还没有配置提取模型。本插件只用模型从文书里提取：先在设置里填写模型端点和模型名称。',
          openSettings ? h('button', { className: 'mx-btn sm', style: { marginLeft: 8 }, onClick: openSettings }, '去设置') : null) : null,
        h('label', { className: 'mx-field' }, '病历目录或文件',
          h('input', { className: 'mx-input', value: inputDir, onChange: (e) => setInput(e.target.value), placeholder: '/path/to/_medical-anonymizer/… 或 notes.ndjson', autoFocus: true }),
          h('div', { className: 'mx-pick' }, h('button', { className: 'mx-btn sm', onClick: pick, disabled: picking }, picking ? '请在弹出的窗口里选择…' : '选择文件夹…'), h('span', { className: 'mx-faint' }, 'p_doc 导出，或 json／ndjson／csv／txt 文书'))),
        h('div', { className: 'mx-grid2 tm' },
          h('label', { className: 'mx-field' }, '提取模板',
            h('select', { className: 'mx-input', value: template, title: tplList.find((t) => t.id === template)?.name ?? '', onChange: (e) => setTemplate(e.target.value) },
              h('option', { value: '', disabled: true }, '请选择模板…'), tplList.map((t) => h('option', { key: t.id, value: t.id }, `${t.domain ? `${t.domain} · ` : ''}${t.name} · ${t.fields} 字段${t.origin === 'builtin' ? '' : '（我的）'}`)))),
          h('label', { className: 'mx-field' }, '模式',
            h('select', { className: 'mx-input', value: curMode, onChange: (e) => setMode(e.target.value) },
              Object.entries(MODE_LABEL).map(([k, l]) => h('option', { key: k, value: k }, l))))),
        h('label', { className: 'mx-pick', style: { fontSize: 11.5 } }, h('input', { type: 'checkbox', checked: p0, onChange: (e) => setP0(e.target.checked) }), '只提取 P0 字段'),
        h('label', { className: 'mx-field' }, '输出根目录', h('input', { className: 'mx-input', value: outputRoot, onChange: (e) => setOut(e.target.value), placeholder: '空＝设置里的默认值，再缺省为输入旁的 _medical-extract' })),
        h('label', { className: 'mx-field' }, '截至时刻（可空）', h('input', { className: 'mx-input', value: asOf, onChange: (e) => setAsOf(e.target.value), placeholder: 'YYYY-MM-DD HH:mm · 只用此刻以前写成的文书' })),
        h('div', { className: 'mx-pop-act' },
          h('button', { className: 'mx-btn mx-new', style: { flex: 1 }, disabled: !inputDir || !template || busy || noModel, title: noModel ? '先在设置里配置提取模型' : !template ? '先选择提取模板' : undefined, onClick: () => go({ inputDir, outputRoot, template, mode: curMode, asOf, priorities: p0 ? ['P0'] : undefined }) }, busy ? '启动中…' : '▶ 开始'),
          resumeOk ? h('button', { className: 'mx-btn', disabled: busy || noModel, title: `继续批次 ${resumable.id}：已完成的数据块和模型调用直接复用`, onClick: () => go({ resumeFrom: resumable.id }) }, '↻ 继续') : null))
    }

    /* --------------------------------------------------------------- pipeline */
    /**
     * 工序（楼）按实际顺序排：读入·清洗 → 分配 → 提取 → 归一 → 核验·复查 是每份文书在数据块里依次走完的，
     * 所有数据块做完以后才汇总 → 交付。数据块阶段这五栋同时在跑（不同的数据块、不同的文书）。
     * 返回数组的下标就是场景里的位置：0 读入楼，1–5 五栋工序楼，6 交付堆场，7 模板塔。
     */
    function stationsOf(run) {
      const t = run.totals
      const running = run.status === 'running'
      const stage = running ? run.current?.stage : null
      const broken = !running && ['failed', 'cancelled'].includes(run.status)
      const shardFrac = run.shards.total ? run.shards.done / run.shards.total : 0
      const hasVerify = Boolean(run.model?.verifyModel)
      // 运行到哪一段：format（格式识别）→ shards（数据块）→ rollup（汇总、质检）→ deliver（交付）
      const phase = !running ? null : stage === 'E1' ? 'format' : stage === 'E3' ? 'shards' : stage === 'E7' ? 'deliver' : 'rollup'
      const PH = ['format', 'shards', 'rollup', 'deliver']
      const past = (p) => phase != null && PH.indexOf(phase) > PH.indexOf(p)
      const stShard = (no) => {
        if (broken) return 'part'
        if (!running) return 'done'
        if (phase === 'format') return no === 'E1' ? 'run' : 'idle'
        if (phase === 'shards') return no === 'E6' && !hasVerify ? 'idle' : 'run'
        return 'done'
      }
      const stLate = (p) => (broken ? 'idle' : !running ? 'done' : phase === p ? 'run' : past(p) ? 'done' : 'idle')
      const gate = (id) => run.gates?.find((g) => g.id === id)
      const gateRow = (id, label, v) => [label, v ?? (gate(id) ? (gate(id).skipped ? '跳过' : gate(id).pass ? '通过' : '未过') : '—'), gate(id) && !gate(id).skipped ? (gate(id).pass ? 'ok' : 'warn') : '']
      // ab＝场景里屋顶标签用的两字工序名；no（E0–E7）只留作内部编号，不在界面上显示
      const AB = { E0: '模板', E1: '读入', E2: '分配', E3: '提取', E4: '归一', E5: '汇总', E6: '核验', E7: '交付' }
      const st = (no, nm, sub, bigv, unit, rows, state, frac) => ({ no, ab: AB[no], nm, sub, big: bigv, unit, rows, state, frac })
      const legacy = run.flow !== 'read'
      const shardF = (no) => (phase === 'format' && no !== 'E1' ? 0 : shardFrac)
      return [
        st('E1', '读入·清洗', '只读文书；解码、去图片与乱码、剔除空白文书', big(t.documents), '文书', [['数据块', `${run.shards.done}/${run.shards.total}`, ''], ['结构化记录（不提取）', t.structured == null ? '—' : big(t.structured), ''], ['空白文书', t.hollow == null ? '—' : big(t.hollow), ''], ['跳过（截至时刻）', fmt(t.skipped), '']], stShard('E1'), shardF('E1')),
        legacy
          ? st('E2', '关键词定位（旧）', '旧批次：每个字段用关键词在文书里找命中', big(t.recalled), '命中', [], stShard('E2'), shardF('E2'))
          : st('E2', '分配', '按文书类型、栏目把字段派给文书，切成提取任务', big(t.tasks), '任务', [['字段 × 文书', big(t.assigned), '']], stShard('E2'), shardF('E2')),
        st('E3', '提取', legacy ? '旧批次：规则定值，定不了的片段送模型' : '提取模型通读每个任务，模型给的原文引用逐字回原文核对；有规则的字段再用规则对照', big(t.values), '值', [gateRow('①', '质检①', `${fmt(t.quoteFail)} 丢弃`), ['模型调用', `${big(t.calls)}（缓存 ${big(t.cached)}）`, ''], ...(legacy ? [] : [['规则与模型不符', fmt(t.ruleDisputes ?? 0), t.ruleDisputes ? 'warn' : '']])], stShard('E3'), shardF('E3')),
        st('E4', '归一', '单位、日期、选项写法统一；类型、选项、值域校验', fmt(t.invalid + t.outOfRange), '不合规', [gateRow('②', '质检②')], stShard('E4'), shardF('E4')),
        st('E6', '核验·复查', hasVerify ? `核验模型 ${run.model.verifyModel}；有分歧时复查，至多 ${run.maxRounds ?? 3} 轮` : '未配置核验模型：不做抽样核验', fmt(t.review), '待复核', [gateRow('④', '质检④'), ...(t.adjResolved ? [['复查后一致', fmt(t.adjResolved), 'ok']] : [])], t.review && !running ? 'hold' : stShard('E6'), hasVerify ? shardF('E6') : 0),
        st('E5', '汇总·计算', '所有数据块做完后：按汇总层级与取值规则填进结果表；计算字段；冲突登记', fmt(t.conflicts), '冲突', [['病人', big(t.patients), ''], gateRow('③', '质检③')], stLate('rollup'), phase === 'rollup' ? 0.5 : past('rollup') || !running ? (broken ? 0 : 1) : 0),
        st('E7', '交付', '结果表 → 证据长表 → 冲突表 → 只读核对', run.output ? '已写出' : '—', '', [['输出', run.output ? '已写出' : '未交付', run.output ? 'ok' : '']], run.output ? 'done' : stLate('deliver'), run.output ? 1 : 0),
        st('E0', '模板', `${run.template.name} v${run.template.version}`, String(run.template.fields), '字段', [['模式', modeLabel(run.mode), '']], 'done', 1),
      ]
    }

    function Pipeline({ run, goto, openPatient }) {
      const stations = stationsOf(run)
      // 没选工序时右列是批次概览（同匿名化插件）；点楼、标签或底部质检进工序详情
      const [selK, setSelK] = useState(null)
      const k = selK ?? -1
      // 布局同匿名化插件：左列＝2.5D 流水线（撑满）＋底部「进展｜结果｜监控」；右列＝所选工序的详情，拉到底
      return h('div', { className: 'mx-scroll', style: { flex: 1, display: 'flex' } },
        h('div', { className: 'mx-line' },
          h('div', { className: 'mx-line-left' },
          h('div', { className: 'mx-frame mx-hero' },
            h('div', { className: 'mx-hero-cap' },
              h('span', { className: 'mx-cap', style: { color: 'var(--ink2)' } }, '处理流程'),
              // 右上角原来的状态提示（「核验·复查 待复核」等）删掉：页头批次框、屋顶标签、底部处理结果都有同样的信息
            ),
            run.status === 'failed' && run.error ? h('div', { className: 'mx-err mx-hero-err' }, h('b', {}, '批次失败：'), String(run.error).split('\n')[0].replace(/^Error:\s*/, '')) : null,
            h(PlantScene, { run, stations, sel: k, onSel: setSelK, goto }),
            h(AlertsOverlay, { run, stations, goto, onSel: setSelK })),
          h('div', { className: 'mx-frame mx-bottom' },
            h(ProgressPanel, { run }),
            h(ResultsPanel, { run, stations, onSel: setSelK, goto }),
            h(ResourcesPanel, { run }))),
          k >= 8 ? h(ModelPanel, { run, house: modelHousesOf(run)[k - 8], goto, onBack: () => setSelK(null) })
            : k >= 0 ? h(StationPanel, { run, s: stations[k], goto, onBack: () => setSelK(null) }) : h(Overview, { run, goto, onSel: setSelK, stations })))
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
     * 流水线主视图：后方的模板塔（E0）经说明总线把字段说明下发到每道工序；
     * E1 读入楼 → E2–E6 五栋工序楼 → E7 交付堆场；箱子＝一个数据块；提取模型挂在提取楼旁，核验模型挂在核验楼旁。
     */
    const STATION_LABEL = { format: '格式识别', extract: '提取', verify: '核验', adjudicate: '复查' }
    const shortModel = (m) => { const x = String(m ?? ''); return x.length > 22 ? `${x.slice(0, 21)}…` : x }
    /** 模型房子：一栋＝一个模型服务。用的哪几道工序、各调用多少，按 run.models 的角色拆 */
    function modelHousesOf(run) {
      const M = run.models ?? {}
      const ROLE_ST = { format: ['extract', 'format'], extract: ['extract', 'extract'], 'adj-extract': ['extract', 'adjudicate'], 'format-verify': ['verify', 'format'], verify: ['verify', 'verify'], 'adj-verify': ['verify', 'adjudicate'] }
      const list = run.modelHouses ?? [{ slot: 0, max: run.modelConcurrency ?? 8, model: run.model?.model, host: '', roles: run.model?.verifyModel && run.model.verifyModel === run.model.model ? ['extract', 'verify'] : ['extract'] },
        ...(run.model?.verifyModel && run.model.verifyModel !== run.model.model ? [{ slot: 1, max: run.modelConcurrency ?? 8, model: run.model.verifyModel, host: '', roles: ['verify'] }] : [])]
      const houses = list.map((x) => ({ ...x, calls: {}, total: 0, failed: 0, perf: [], stations: [] }))
      if (houses.length === 1 && !houses[0].roles.includes('verify')) houses.push({ slot: 1, max: 0, model: null, host: '', roles: ['verify'], calls: {}, total: 0, failed: 0, perf: [], stations: ['format', 'verify', 'adjudicate'], label: '核验模型', why: '未配置 · 不做抽样核验' })
      for (const hs of houses) {
        if (hs.model) hs.stations = [...new Set(hs.roles.flatMap((r) => (r === 'extract' ? ['format', 'extract', 'adjudicate'] : ['format', 'verify', 'adjudicate'])))]
        hs.label ??= hs.roles.includes('extract') ? '提取模型' : '核验模型'
        hs.why ??= '未配置'
      }
      for (const [role, p] of Object.entries(M)) {
        const [r0, st] = ROLE_ST[role] ?? [null, null]; if (!r0) continue
        const hs = houses.find((x) => x.model && x.roles.includes(r0)); if (!hs) continue
        hs.calls[st] = (hs.calls[st] ?? 0) + (p.calls ?? 0); hs.cached = hs.cached ?? {}; hs.cached[st] = (hs.cached[st] ?? 0) + (p.cached ?? 0); hs.total += p.calls ?? 0; hs.failed += p.failed ?? 0; hs.perf.push([role, st, p])
      }
      for (const hs of houses) {
        // 格式识别只在通用文件、本批真的识别了表时才算（区域平台导出不做；格式库里已有结果、命中缓存的也不算这个模型干了活）
        const fmtNow = run.status === 'running' && String(run.current?.step ?? '').startsWith('格式识别')
        hs.didFormat = Boolean(hs.calls.format || fmtNow)
        // 两个模型拿同一份提示各自起草（各自独立，互相看不到），一致才采用；「核对」专指插件逐字对照，这里不用
        const FMT = hs.roles.includes('extract') && hs.roles.includes('verify') ? '格式识别' : hs.roles.includes('extract') ? '格式识别' : '格式识别（各自独立）'
        hs.roleText = hs.model ? hs.stations.filter((st) => st !== 'format' || hs.didFormat).map((st) => (st === 'format' ? FMT : STATION_LABEL[st])).join(' · ') : (hs.roles.includes('verify') ? '核验 · 复查' : '提取')
      }
      return houses
    }

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
      const TW = { i: 96, j: -190, a: 56, b: 56, hh: 128 }
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
      const footprint = (k) => (k === 0 ? [0, 8, 84, 100] : k === 6 ? [yard, 6, 150, 130] : k === 7 ? [TW.i, TW.j, TW.a, TW.b] : k === 8 ? [bay0(1) + 4, D + 118, 74, 44] : k === 9 ? [bay0(4) + 92, D + 118, 74, 44] : [bay0(k), 0, bw, D])
      {
        if (sel < 0) { /* 没选工序：不画选中框 */ } else {
        const [fi, fj, fa, fb] = footprint(sel); const m = 10
        const corners = [[fi - m, fj - m], [fi + fa + m, fj - m], [fi + fa + m, fj + fb + m], [fi - m, fj + fb + m]]
        els.push(h('polygon', { key: 'selfloor', points: pts(corners.map(([a, b]) => iso(a, b))), fill: A, opacity: 0.07 }))
        corners.forEach(([ci, cj], q) => {
          const di = q === 0 || q === 3 ? 1 : -1; const dj = q < 2 ? 1 : -1
          els.push(h('polyline', { key: `br${q}`, points: pts([iso(ci + di * 16, cj), iso(ci, cj), iso(ci, cj + dj * 16)]), fill: 'none', stroke: A, strokeWidth: 1.6, opacity: 0.9 }))
        })
        }
      }
      // E0 模板塔：窗户＝字段（点亮＝本批提取到值的字段）
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
      // 说明总线
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
        // 悬停说明（原图例里「紫色流线」那条）：透明粗线只用来接住鼠标
        els.push(h('polyline', { key: 'bushit', points: pts([a, b, c]), fill: 'none', stroke: 'transparent', strokeWidth: 12, pointerEvents: 'stroke' }, h('title', {}, '字段说明：模板里每个字段的关键词、规则和值类型，下发到每道工序')))
      }
      // 复查回环：核验 → 提取。分歧由两个模型轮流复查（回到提取那一步重读原文），人工判断按稳定编号存、重跑沿用。
      // 起止点在楼背后的空地正中（楼和总线之间、与楼左右居中），向后穿过说明总线拱起；画在总线之后、楼之前
      {
        const LJ = BUSJ / 2; const LZ = H + 10
        // 在画面上和楼左右居中：往后挪（j 变小）画面会右移，用 i 抵回去
        const shiftI = -(JX[0] * (LJ - D / 2)) / IX[0]
        const i1 = bay0(4) + bw / 2 + shiftI; const i0 = bay0(2) + bw / 2 + shiftI
        const a = iso(i1, LJ, LZ); const b = iso(i0, LJ, LZ)
        const c1 = iso(i1 - 10, BUSJ - 40, BUSZ + 25); const c2 = iso(i0 + 10, BUSJ - 40, BUSZ + 25)
        const d = `M${a[0].toFixed(1)} ${a[1].toFixed(1)} C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`
        const mid = [(a[0] + 3 * c1[0] + 3 * c2[0] + b[0]) / 8, (a[1] + 3 * c1[1] + 3 * c2[1] + b[1]) / 8]
        // 整根线在画面上右移一点（离开提取标签）
        els.push(h('g', { key: 'loop', transform: 'translate(34 0)' },
          h('title', {}, `分歧复查：核验分歧回到提取，由两个模型轮流重读原文复查，至多 ${run.maxRounds ?? 3} 轮；仍不一致的转人工\n人工判断按稳定编号保存，重跑沿用`),
          h('circle', { cx: a[0], cy: a[1], r: 2.6, fill: P.ink2 }),
          h('path', { d, fill: 'none', stroke: P.ink2, strokeWidth: 1.4, strokeDasharray: '5 5', markerEnd: 'url(#mx-arr)' }),
          h('path', { d, fill: 'none', stroke: 'transparent', strokeWidth: 12 }),
          h('text', { x: mid[0], y: mid[1] - 12, textAnchor: 'middle', fill: P.ink2, fontSize: 10, ...halo }, `有分歧时复查，至多 ${run.maxRounds ?? 3} 轮 · 人工判断重跑沿用`)))
        bb.push([mid[0] - 76, mid[1] - 26], [mid[0] + 144, mid[1] - 26])
      }
      // E1 读入楼：窗户＝数据块进度
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
      // 走廊与质检：①在提取出口，②在归一出口，④在核验出口，③在汇总出口（楼的顺序：分配、提取、归一、核验、汇总）
      const gateOf = (id) => run.gates?.find((x) => x.id === id)
      const GATE_AFTER = { 3: '①', 4: '②', 5: '④', 6: '③' }
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
            h('title', {}, g ? `${g.label}：${g.skipped ? '跳过' : g.pass ? '通过' : '未过'}${g.detail ? `（${g.detail}）` : ''}` : '质检：批次结束时判定'),
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
        for (let a = 0; a < 4; a++) for (let b2 = 0; b2 < 2; b2++) { if (k === 5 && b2 === 1) continue; if (k === 4 && b2 === 1 && a >= 2) continue; roof.push([b2, a]) }
        roof.sort((p, q) => depthOf(p[0] * 30, p[1] * 24) - depthOf(q[0] * 30, q[1] * 24))
        const litN = s.state === 'hold' ? roof.length : s.state === 'run' ? Math.max(1, Math.round((s.frac ?? 0) * roof.length)) : 0
        roof.forEach(([b2, a], idx) => {
          const ui = i0 + 8 + b2 * 30; const uj = 8 + a * 24; const on = idx < litN && c
          g.push(...isoBox(`u${a}${b2}`, ui, uj, H, 20, 18, 7, on ? { top: shade(c, 0.25), left: c, right: shade(c, -0.3), props: { filter: 'url(#mx-glow)' } } : CL2))
          const f = iso(ui + 10, uj + 9, H + 7)
          g.push(h('ellipse', { key: `f${a}${b2}`, cx: f[0], cy: f[1], rx: 7.5, ry: 4, fill: on ? shade(c, -0.45) : C.hole, opacity: 0.85 }))
        })
        if (k === 5) [[i0 + 50, 20], [i0 + 54, 50], [i0 + 50, 80]].forEach(([ci, cj], q) => g.push(...isoCyl(`st${q}`, ci, cj, H, 5, 30 + q * 6, C)))
        if (k === 4) g.push(...isoBox('ctl', i0 + 36, 56, H, 26, 36, 16, CL2), leftPatch('ctlw', i0 + 39, i0 + 59, 92, H + 6, H + 12, { fill: c ?? C.win, opacity: c ? 0.9 : 0.6 }))
        if (sel === k) g.push(h('polygon', { key: 'selroof', points: pts([iso(i0 + 2, 2, H + 0.5), iso(i0 + bw - 2, 2, H + 0.5), iso(i0 + bw - 2, D - 2, H + 0.5), iso(i0 + 2, D - 2, H + 0.5)]), fill: 'none', stroke: A, strokeWidth: 1.4, strokeDasharray: '5 4', opacity: 0.9 }))
        els.push(h('g', { key: `bay${k}`, className: s.state === 'hold' ? 'mx-breathe' : undefined, ...click(k) }, h('title', {}, `${s.nm}：${s.sub}`),
          h('polygon', { points: pts([iso(i0, 0, H), iso(i0 + bw, 0, H), iso(i0 + bw, D, H), iso(i0 + bw, D, 0), iso(i0, D, 0), iso(i0, D, H)]), fill: 'transparent' }), g))
      }
      els.push(corridor('co6', hallEnd, yard, 6))
      // E7 交付堆场：三台出货单元＝结果表、证据长表、冲突表；箱子＝已完成的数据块
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
        unit('du0', yard + 10, 14, '结果表'); unit('du1', yard + 60, 14, '证据长表'); unit('du2', yard + 110, 14, '冲突表')
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
          h('text', { x: 0, y: 0, fill: P.ink3, fontSize: 9.5 }, '每个值带原文引用 · 只读核对 · 移交')))
      }
      const underQueue = els.length // 模型小楼的连线画在排队箱子和数字下面，不压字
      // 门前排队：箱子＝等待处理的数据块
      {
        const waiting = Math.max(0, run.shards.total - run.shards.done - (run.shards.running ?? 0))
        const loads = [running ? waiting : 0, 0, 0, 0, run.totals.review && !running ? Math.min(36, Math.ceil(run.totals.review / 10)) : 0, 0]
        const label = ['等待读入（数据块）', '', '', '', '待复核（每箱 10 项）', '']
        const pileAt = (k) => (k === 0 ? [12, 116] : [bay0(k) + 14, D + 12])
        loads.forEach((_, k) => { const [pi, pj] = pileAt(k); bb.push(iso(pi, pj + 24), iso(pi + 39, pj, 70)) })
        loads.forEach((n, k) => {
          if (!n) return
          const [pi, pj] = pileAt(k); const hot = k === 4
          const shown = Math.min(36, n); const g = []
          for (let q = 0; q < shown; q++) {
            const lv = Math.floor(q / 6); const a = q % 3; const c = Math.floor((q % 6) / 3)
            const ci = pi + a * 13; const cj = pj + c * 12; const z = lv * 9
            g.push(...isoBox(`p${q}`, ci, cj, z, 11, 10, 8, hot ? AMB : CL2))
            if (!hot) { const t1 = iso(ci, cj + 5, z + 8); const t2 = iso(ci + 11, cj + 5, z + 8); g.push(h('line', { key: `pt${q}`, x1: t1[0], y1: t1[1], x2: t2[0], y2: t2[1], stroke: A, strokeWidth: 1, opacity: 0.8 })) }
          }
          const top = iso(pi + 19, pj + 11, Math.ceil(shown / 6) * 9 + 10)
          const shownN = k === 4 ? run.totals.review : n
          els.push(h('g', { key: `q${k}`, ...click(k) }, h('title', {}, k === 4 ? `待复核 ${fmt(run.totals.review)} 项：核验分歧、规则与模型不符，复查后仍不一致的，等人工判断\n箱子＝待复核的项，每箱 10 项\n点开核验工序，再去复核` : `等待读入的数据块 ${fmt(n)} 个，每箱一个数据块`), g,
            h('text', { x: top[0], y: top[1], textAnchor: 'middle', fill: A, fontSize: 17, fontWeight: 700, fontFamily: MONO, stroke: C.card, strokeWidth: 3.5, paintOrder: 'stroke' }, fmt(shownN)),
            // 待复核队列只留数字（和楼顶标签同一个数），说明在悬停提示里
            k === 4 ? null : h('text', { x: top[0], y: top[1] + 13, textAnchor: 'middle', fill: P.ink, fontSize: 10, stroke: C.card, strokeWidth: 3, paintOrder: 'stroke' }, `排队 · ${label[k]}`)))
        })
      }
      // 质检①：丢弃的原文引用（红箱）
      if (t.quoteFail) {
        const gi = (bay0(2) + bw + bay0(3)) / 2 - 7; const gg = []
        for (let q = 0; q < Math.min(4, Math.ceil(t.quoteFail / 10)); q++) gg.push(...isoBox(`rq${q}`, gi + (q % 2) * 15 - 4, D + 6 + Math.floor(q / 2) * 13, 0, 13, 12, 11, RED))
        // 标签放在红箱正上方：左下是去模型旁路的斜管，下方是回 E6 的横管
        const lp = iso(gi + 5, D + 12, 22)
        gg.push(h('text', { key: 't', x: lp[0], y: lp[1], textAnchor: 'middle', fill: P.bad, fontSize: 10, ...halo }, h('title', {}, '模型回答的原文引用在原文里找不到，或原文引用不支持所取的值：已丢弃，不进交付'), `${fmt(t.quoteFail)} 条模型回答已丢弃`))
        els.push(h('g', { key: 'redq' }, gg))
      }
      // 处理中：发光的箱子
      if (running && run.current?.stage === 'E3') {
        const at = [bay0(2) + 30, D + 6]; const tp = iso(at[0] + 8, at[1] + 14, 0)
        els.push(h('g', { key: 'cur' }, h('g', { filter: 'url(#mx-glow)', className: 'mx-pulse' }, isoBox('cc', at[0], at[1], 0, 16, 14, 13, AMB)),
          // 说明放在发光箱子左侧、和箱子齐高：下方是提取模型小楼，楼顶的排队数会和它重叠
          h('text', { x: tp[0] - 16, y: tp[1] - 4, textAnchor: 'end', fill: A, fontSize: 10.5, fontWeight: 700, ...halo }, `处理中 · ${run.shards.running ?? 0} 个数据块${run.rate ? ` · ${fmt(run.rate)} 份/秒` : ''}`)))
      }
      // 模型房子：一栋＝一个模型服务（按模型名；提取、核验同端点同模型时只有一栋）。
      // 管子只连真正调用模型的工序：读入（格式识别）、提取、核验（核验与复查）。哪道工序此刻有请求在途，那根管子就流动发光；
      // 窗户按在途数／并发上限点亮。点房子，右侧显示这个模型的状态
      const houses = modelHousesOf(run)
      const last = running ? (run.series ?? []).filter((p) => p.length >= 18).at(-1) : null
      const SPOT = { format: [42, 108, 26], extract: [bay0(2) + bw / 2, D, 20], verify: [bay0(4) + bw / 2, D, 20], adjudicate: [bay0(4) + bw / 2 - 14, D, 20] }
      // 两栋同一排（同一条斜线），各自正对所服务的楼：提取模型在提取楼前，核验模型在核验楼前，管子顺着地面网格笔直连过去；
      // 说明在房子左边：右下方的说明会把场景底边往下撑，整幅画就被缩小
      const HOUSE_MA = 74
      const HOUSE_AT = [[SPOT.extract[0] - HOUSE_MA / 2, D + 118], [SPOT.verify[0] - HOUSE_MA / 2, D + 118]]
      houses.forEach((hs, hi) => {
        const V = P.vio; const on = !!hs.model
        const [mi, mj] = HOUSE_AT[Math.min(hi, 1)]; const ma = HOUSE_MA; const mb = 44; const mh = 30
        const live = last ? { inflight: last[2 + hs.slot] ?? 0, waiting: last[4 + hs.slot] ?? 0, st: last.slice(10 + hs.slot * 4, 14 + hs.slot * 4) } : null
        // 最近 10 秒有调用失败（含重试后仍失败）：一扇窗闪红
        const recentFail = (() => { if (!running) return false; const ps = (run.series ?? []).filter((p) => p.length >= 20); if (ps.length < 2) return false; const z = ps.at(-1); const old = ps.filter((p) => z[0] - p[0] <= 10000)[0] ?? ps.at(-2); return (z[18 + hs.slot] ?? 0) > (old[18 + hs.slot] ?? 0) })()
        const g = []; const pipes = []
        g.push(...isoBox('mp', mi - 6, mj - 6, -3, ma + 12, mb + 12, 3, { top: C.pad, left: C.padL, right: C.padR }))
        // 管子（画在排队箱子和数字下面，不压字）：这个模型用在哪几道工序（格式识别只在通用文件、做了格式识别时画）
        const uses = hs.stations.filter((x) => x !== 'format' || hs.didFormat)
        const seenSpot = new Set()
        uses.forEach((st) => {
          const sp = st === 'verify' && uses.includes('adjudicate') ? SPOT.verify : SPOT[st]
          const key = sp.join(','); if (seenSpot.has(key) && st !== 'adjudicate') return; seenSpot.add(key)
          const stI = ['format', 'extract', 'verify', 'adjudicate'].indexOf(st)
          const hot = on && live && (live.st[stI] ?? 0) > 0
          const used = on && (hs.calls[st] ?? 0) > 0
          // 管子：从房子直接拉一条斜线到它服务的楼（正对的楼就是顺着网格的那条斜线；房子这头取和楼同一个 i，落在房子宽度内）
          const bi = Math.max(mi + 6, Math.min(mi + ma - 6, sp[0]))
          const z = sp[2]
          const d = 'M' + [[bi, mj + 4], [sp[0], sp[1]]].map(([i, j]) => iso(i, j, z).map((v) => v.toFixed(1)).join(' ')).join(' L')
          pipes.push(h('path', { key: `h${hi}p${st}`, d, strokeLinejoin: 'round', fill: 'none', stroke: hot || used ? V : C.left2, strokeWidth: hot ? 2.4 : used ? 1.7 : 1.3, strokeDasharray: hot ? '3 5' : '2 5', className: hot ? 'mx-flow' : undefined, filter: hot ? 'url(#mx-glow)' : undefined, opacity: hot ? 1 : used ? 0.7 : 0.4 }, h('title', {}, `${STATION_LABEL[st]}${on ? `：调用 ${fmt(hs.calls[st] ?? 0)} 次${live ? ` · 在途 ${live.st[stI] ?? 0}` : ''}` : ''}`)))
        })
        g.push(...isoBox('mb', mi, mj, 0, ma, mb, mh, on ? CL : CL2))
        // 窗户＝并发名额：一扇窗一个名额（上限多时两排；再多则一扇窗代表几个名额），亮几扇＝在途几个
        // 当前上限：自动调并发会改，取最新的采样点
        const cap = on ? Math.max(1, last?.length >= 22 && last[20 + hs.slot] > 0 ? last[20 + hs.slot] : run.autoTune?.[hs.slot]?.limit ?? hs.max) : 8
        const per = cap <= 32 ? 1 : Math.ceil(cap / 32)
        const nWin = Math.ceil(cap / per); const rowsW = nWin > 12 ? 2 : 1; const perRow = Math.ceil(nWin / rowsW)
        const litWin = on && live ? Math.min(nWin, Math.ceil(live.inflight / per)) : 0
        const ww = (ma - 8) / perRow; const wGap = Math.min(3, ww * 0.3); const wh = rowsW === 2 ? 8 : 15
        for (let k2 = 0; k2 < nWin; k2++) {
          const row = Math.floor(k2 / perRow); const col = k2 % perRow
          const wi = mi + 4 + col * ww; const z0 = rowsW === 2 ? (row === 0 ? 18 : 6) : 7
          const isLit = k2 < litWin; const isRed = recentFail && k2 === Math.max(0, litWin - 1)
          g.push(leftPatch(`mw${k2}`, wi, wi + ww - wGap, mj + mb, z0, z0 + wh, { fill: isRed ? P.bad : isLit ? V : C.win, opacity: isLit || isRed ? 0.95 : 0.55, filter: isLit || isRed ? 'url(#mx-glow)' : undefined, className: isRed ? 'mx-pulse' : undefined }))
        }
        // 屋顶的箱子＝排队的请求：一箱一个，从中间往外、一层层往上堆，最多 12 箱，多的在箱堆上方写数字
        const nQ = on && live ? live.waiting : 0
        const QMAX = 12; const shownQ = Math.min(QMAX, nQ)
        const QA = { top: shade(P.warn, 0.35), left: P.warn, right: shade(P.warn, -0.3), edge: shade(P.warn, -0.45) }
        const slots2 = [[2, 1], [1, 1], [3, 1], [2, 0], [1, 0], [3, 0], [0, 1], [4, 1], [0, 0], [4, 0]]
        const qb = []
        for (let q = 0; q < shownQ; q++) {
          const lv = q < 10 ? 0 : 1; const [cx, cy] = lv === 0 ? slots2[q] : [[2, 1], [2, 0]][q - 10]
          qb.push({ ci: mi + 6 + cx * 13, cj: mj + 6 + cy * 16, z: mh + lv * 8, q })
        }
        qb.sort((x, y) => x.z - y.z || depthOf(x.ci, x.cj) - depthOf(y.ci, y.cj)).forEach(({ ci, cj, z, q }) => g.push(...isoBox(`qb${q}`, ci, cj, z, 10, 12, 7, QA)))
        if (nQ > QMAX || (nQ > 0 && nQ > shownQ)) { const tp = iso(mi + ma / 2, mj + mb / 2, mh + 26); g.push(h('text', { key: 'qn', x: tp[0], y: tp[1], textAnchor: 'middle', fill: P.warn, fontSize: 13, fontWeight: 700, fontFamily: MONO, ...halo }, fmt(nQ))) }
        if (on && per > 1) { const tp = iso(mi + ma, mj + mb, 4); g.push(h('text', { key: 'per', x: tp[0] + 4, y: tp[1], fill: P.ink3, fontSize: 8.5, ...halo }, `每窗＝${per} 个`)) }
        if (sel === 8 + hi) g.push(h('polygon', { key: 'selroof', points: pts([iso(mi + 2, mj + 2, mh + 0.5), iso(mi + ma - 2, mj + 2, mh + 0.5), iso(mi + ma - 2, mj + mb - 2, mh + 0.5), iso(mi + 2, mj + mb - 2, mh + 0.5)]), fill: 'none', stroke: A, strokeWidth: 1.4, strokeDasharray: '5 4' }))
        const lt = iso(mi - 8, mj + mb + 12)
        const name = hs.model ? shortModel(hs.model) : hs.label
        const sub = !on ? hs.why : live ? `在途 ${live.inflight}／${cap}${live.waiting ? ` · 排队 ${live.waiting}` : ''}` : `调用 ${big(hs.total)}${hs.failed ? ` · 失败 ${fmt(hs.failed)}` : ''}`
        g.push(h('text', { key: 't1', x: lt[0], y: lt[1] + 4, textAnchor: 'end', fill: on ? V : P.ink3, fontSize: 11, fontWeight: 700, fontFamily: MONO, ...halo }, name),
          h('text', { key: 't2', x: lt[0], y: lt[1] + 17, textAnchor: 'end', fill: P.ink2, fontSize: 9.5, ...halo }, hs.roleText),
          h('text', { key: 't3', x: lt[0], y: lt[1] + 30, textAnchor: 'end', fill: live?.inflight ? V : P.ink3, fontSize: 9.5, fontWeight: live?.inflight ? 600 : 400, ...halo }, sub))
        els.splice(underQueue, 0, ...pipes)
        els.push(h('g', { key: `house${hi}`, ...click(8 + hi), style: { cursor: 'pointer' } }, h('title', {}, `${hs.model ?? hs.label}（${hs.roleText}）\n窗户＝并发名额（共 ${cap} 个${per > 1 ? `，每窗 ${per} 个` : ''}），亮着的＝在途${live ? ` ${live.inflight}` : ''}\n屋顶的箱子＝排队的请求${live ? ` ${live.waiting}` : ''}${recentFail ? '\n红窗＝最近 10 秒有调用失败' : ''}\n点开看模型状态`), g))
        bb.push(iso(mi - 6, mj + mb + 6), iso(mi - 170, mj + mb + 44), iso(mi + ma + 6, mj + mb + 6))
      })
      // 屋顶标签：贴在每栋楼顶上方的胶囊，不用引线；只放两字工序名＋关键数＋单位，质检一个色点；选中＝实心
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
      for (const [i, j, a, b, z] of [[-60, 44, 60, 24, 8], [0, 8, 84, 100, 112], [h0, 0, hallEnd - h0, D, H + 70], [yard, 6, 150, 160, 30]]) {
        for (const [di, dj] of [[0, 0], [a, 0], [a, b], [0, b]]) bb.push(iso(i + di, j + dj, 0), iso(i + di, j + dj, z))
      }
      const xs = bb.map((p) => p[0]); const ys = bb.map((p) => p[1])
      const x0 = Math.min(...xs) - 24; const y0 = Math.min(...ys) - 16; const x1 = Math.max(...xs) + 24; const y1 = Math.max(...ys) + 16
      defs.push(h('mask', { key: 'mk', id: 'mx-gridmask', maskUnits: 'userSpaceOnUse', x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, h('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'url(#mx-fade)' })))
      // 键盘：场景本身是一个 Tab 停靠点，←／→ 按工序顺序（模板塔在前）切换
      const ORDER = [7, 0, 1, 2, 3, 4, 5, 6, ...houses.map((_, i) => 8 + i)]
      const onKeyDown = (e) => {
        if (e.key === 'Escape') { onSel(null); return }
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
        if (!d) return
        e.preventDefault()
        onSel(sel < 0 ? ORDER[d > 0 ? 0 : ORDER.length - 1] : ORDER[(ORDER.indexOf(sel) + d + ORDER.length) % ORDER.length])
      }
      return h('svg', { className: 'mx-scene', tabIndex: 0, role: 'group', 'aria-label': `处理流程，当前 ${sel >= 8 ? '模型' : sel >= 0 ? stations[sel].nm : '批次概览'}（←／→ 切换工序）`, onKeyDown, viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, preserveAspectRatio: 'xMidYMid meet', style: { overflow: 'hidden' } }, h('defs', {}, defs), els)
    }

    /* 每道工序：做什么 → 产出什么（引擎的通用工序说明，不含病种内容） */
    /** 面板顶部的一句话；完整说明（STEP_HELP）放在悬停提示里 */
    const STEP_SHORT = {
      E0: '载入模板并校验，字段说明下发到各工序',
      E1: '识别表格式，读入文书，清洗并切栏目',
      E2: '按文书类型和栏目派字段，切成提取任务',
      E3: '模型通读任务取值，原文引用回原文核对',
      E4: '统一单位、日期、选项，按类型和值域校验',
      E5: '按汇总层级填结果表，算计算字段，登记冲突',
      E6: '核验模型抽样重抽比对，分歧复查后转人工',
      E7: '写出交付文件，核对源文件没有被改动',
    }
    const STEP_HELP = {
      E0: ['载入提取模板并校验：每个字段的定义、值类型、选项、值域、汇总层级，适用的文书类型和栏目，以及规则（用来和模型结果对照）', '字段说明，下发给后面每道工序'],
      E1: ['识别格式，按表判定类别：文书表读入，检验、医嘱、收费等结构化表只取人口与就诊，忽略的表不读。清洗：解码嵌入内容（base64、HTML／XML、RTF），去掉图片等二进制（不识别图片里的文字）和导出残留的乱码，切栏目，剔除清洗后没有内容的空白文书；截至时刻以后写成的跳过', '干净的文书与栏目'],
      E2: ['按文书类型和栏目给每份文书派字段，再切成提取任务（规则，不用模型）', '提取任务'],
      E3: ['提取模型通读每个任务，返回值、提及方式（阳性／否认／既往／家族／计划）和逐字的原文引用；插件在原文里定位原文引用，对不上的丢弃；模板写了明确规则的字段，规则再匹配一次作对照；内容相同的任务只调一次模型', '值：每个都带原文引用、起止位置和出处'],
      E2old: ['当时的做法：每个字段用关键词（词表、正则）在文书里找命中，只看限定的文书类型和栏目；没提到的记「未提及」', '命中的「字段 × 文书」'],
      E3old: ['当时的做法：规则对命中处定值，规则定不了的命中句送模型（仅规则模式下不送，记「待定」）', '值：每个都带原文引用、起止位置和出处'],
      E4: ['统一单位、日期和选项写法；按类型、选项、值域校验，不合的丢弃或标出', '规范值'],
      E5: ['按字段汇总层级（文书／就诊／病人／时间点）和汇总规则填进结果表单元格，算出计算字段；同一格互斥的值登记为冲突，不自动选边', '结果表、时间点长表、冲突表'],
      E6: ['核验模型抽样，对同样的任务各自独立通读重抽，按字段算一致率；核验分歧和规则与模型不符的进人工复核；判断按稳定编号保存，重跑沿用', '一致率与复核单'],
      E7: ['写出结果表、证据长表、冲突表和报告，再只读核对源文件没有被改动', '交付目录'],
    }

    /** 小进度环 */
    /** 面板头部的主指标：大字＋说明一行，下面一条占满宽度的横条（原来是小圆圈，右边空着） */
    function Ring({ v, label, sub, hot }) {
      const x = Math.max(0, Math.min(1, v ?? 0))
      return h('div', { className: 'mx-ring' },
        h('div', { className: 'mx-ring-t' }, h('b', { className: 'mx-num' }, label), sub ? h('small', {}, sub) : null),
        h('div', { className: 'mx-ring-bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${x * 100}%`, background: hot ? 'var(--warn)' : 'var(--teal)' } })))
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

    /* ------------------------------------------------------------- alerts */
    /** 待办告警（同匿名化插件）：流水线右上角，最严重的在前，最多 3 条（其余「再看 N 条」），点一条直接去处理；可收起 */
    function AlertsOverlay({ run, stations, goto, onSel }) {
      const [fold, setFold] = useState(false)
      const [all, setAll] = useState(false)
      const t = run.totals
      const running = run.status === 'running'
      const at = (no) => () => onSel(stations.findIndex((x) => x.no === no))
      const GB = 1024 ** 3
      const a = []
      if (run.status === 'failed') a.push({ tone: 'crit', tag: '失败', title: '批次失败', sub: String(run.error ?? '').split('\n')[0].replace(/^Error:\s*/, '').slice(0, 80) })
      if (run.sourceCheck?.changed) a.push({ tone: 'crit', tag: '源文件', title: `源文件有 ${fmt(run.sourceCheck.changed)} 个变化`, sub: '只读核对不一致：运行期间输入被改过', onClick: at('E7') })
      const disk = run.disk
      if (running && disk?.free != null && disk.free < 20 * GB) a.push({ tone: disk.free < 5 * GB ? 'crit' : 'warn', tag: '磁盘', title: `输出盘只剩 ${(disk.free / GB).toFixed(1)} GB`, sub: '空间不够时数据块写不出来' })
      const mem = run.memory
      const memR = running && mem?.heapLimit ? mem.heapUsed / mem.heapLimit : null
      if (memR != null && memR >= 0.7) a.push({ tone: memR >= 0.85 ? 'crit' : 'warn', tag: '内存', title: `堆内存用了 ${Math.round(memR * 100)}%`, sub: '可在设置里减少工作线程数' })
      if (!running) for (const g of run.gates ?? []) if (!g.pass && !g.skipped) a.push({ tone: 'warn', tag: `质检${g.id}`, title: `质检${g.id}未过`, sub: g.detail, onClick: at({ '①': 'E3', '②': 'E4', '③': 'E5', '④': 'E6' }[g.id]) })
      const rd = run.flow === 'read' ? t.ruleDisputes ?? 0 : 0
      if (t.review) a.push({ tone: 'warn', tag: '复核', title: `待复核 ${fmt(t.review)} 项`, sub: rd ? `核验分歧 ${fmt(Math.max(0, t.review - rd))} · 规则与模型不符 ${fmt(rd)}` : '核验分歧', onClick: () => goto('source') })
      if (run.format?.held) a.push({ tone: 'warn', tag: '格式', title: `${fmt(run.format.held)} 张表的格式待确认`, sub: run.format.heldPolicy === 'skip' ? '这些表先跳过了' : '先按通用读法读了，确认后重跑更准', onClick: () => goto('formats') })
      for (const role of ['extract', 'verify']) {
        const m = run.models?.[role]
        const fr = m?.calls ? m.failed / m.calls : 0
        if (m?.calls >= 20 && fr > 0.02) a.push({ tone: 'warn', tag: '模型', title: `${role === 'extract' ? '提取' : '核验'}模型失败率 ${(fr * 100).toFixed(1)}%`, sub: `已自动重试 ${fmt(m.retries ?? 0)} 次；失败的调用没有值`, onClick: () => goto('calls') })
      }
      if (t.quoteFail) a.push({ tone: 'warn', tag: '原文引用', title: `${fmt(t.quoteFail)} 条模型回答被丢弃`, sub: '原文引用在原文里找不到，或不支持所给的值', onClick: at('E3') })
      if (t.conflicts) a.push({ tone: 'info', tag: '冲突', title: `${fmt(t.conflicts)} 个单元格有冲突`, sub: '同一单元格互斥的值，不自动选边；见交付目录的 conflicts.csv' })
      const docsAll = (t.documents ?? 0) + (t.hollow ?? 0)
      if (t.hollow && docsAll && t.hollow / docsAll >= 0.3) a.push({ tone: 'info', tag: '读入', title: `空白文书 ${fmt(t.hollow)} 份（${Math.round((t.hollow / docsAll) * 100)}%）`, sub: '清洗后没有内容，没有交给模型', onClick: at('E1') })
      const zipped = t.mediaKinds?.['压缩文书（未解）']
      if (zipped) a.push({ tone: 'info', tag: '读入', title: `${fmt(zipped)} 份压缩文书没有解开`, sub: '内容没有读到', onClick: at('E1') })
      if (!run.model?.verifyModel && run.flow === 'read') a.push({ tone: 'info', tag: '核验', title: '未配置核验模型', sub: '不做抽样核验，质检④跳过' })
      if (run.warnings?.length) a.push({ tone: 'info', tag: '提示', title: `${fmt(run.warnings.length)} 条提示`, sub: run.warnings[0].slice(0, 60), onClick: () => goto('report') })
      if (run.status === 'cancelled') a.push({ tone: 'info', tag: '续跑', title: '批次已取消', sub: '点「＋ 新批次」里的「↻ 继续」接着跑，已完成的数据块直接复用' })
      const RANK = { crit: 0, warn: 1, info: 2 }
      a.sort((x, y) => RANK[x.tone] - RANK[y.tone])
      const COLOR = { crit: 'var(--bad)', warn: 'var(--warn)', info: 'var(--ink3)', ok: 'var(--ok)' }
      if (!a.length) return h('div', { className: 'mx-al-ov ok' }, h('i', { className: 'mx-al-dot', style: { background: COLOR.ok } }), running ? '运行正常' : '全部完成，没有待办')
      const worst = a[0].tone
      const shown = all ? a : a.slice(0, 3)
      return h('div', { className: `mx-al-ov ${worst}${fold ? ' shut' : ''}` },
        h('button', { type: 'button', className: 'mx-al-head', onClick: () => setFold(!fold), title: fold ? '展开' : '收起' },
          h('i', { className: 'mx-al-dot', style: { background: COLOR[worst] } }), h('b', {}, '待办告警'), h('span', { className: 'mx-cap' }, 'ALERTS'), h('span', { className: 'mx-al-n' }, String(a.length))),
        fold ? null : h('div', { className: 'mx-al-list' },
          shown.map((x, i) => h('button', { key: i, type: 'button', className: `mx-al-item ${x.tone}`, onClick: x.onClick, disabled: !x.onClick },
            h('i', { style: { background: COLOR[x.tone] } }),
            h('div', {}, h('b', {}, x.title), x.sub ? h('small', {}, x.sub) : null),
            h('span', { className: `mx-chip ${x.tone === 'crit' ? 'b' : x.tone === 'warn' ? 'w' : ''}` }, x.tag))),
          a.length > 3 ? h('button', { type: 'button', className: 'mx-link mx-al-more', onClick: () => setAll(!all) }, all ? '收起' : `再看 ${a.length - 3} 条`) : null))
    }

    /* ------------------------------------------------------------ overview */
    const kfmt = (n) => (n == null ? '—' : n >= 1e9 ? `${(n / 1e9).toFixed(1)}G` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : fmt(Math.round(n)))
    const ROLE_NM = { extract: '提取', verify: '核验' }
    const LAT_LABELS = ['<.5', '.5', '1', '2', '4', '8', '16+']


    /** 一栋模型房子（一个模型服务）的合计表现：各角色（格式识别、提取、核验、复查）加起来 */
    function houseAgg(hs) {
      const a = { calls: 0, cached: 0, failed: 0, retries: 0, ms: 0, pt: 0, ct: 0, ptMax: 0, sentChars: 0, reusedChars: 0, hist: [0, 0, 0, 0, 0, 0, 0] }
      for (const [, , p] of hs.perf) { for (const k of ['calls', 'cached', 'failed', 'retries', 'ms', 'pt', 'ct', 'sentChars', 'reusedChars']) a[k] += p[k] ?? 0; a.ptMax = Math.max(a.ptMax, p.ptMax ?? 0); a.hist = a.hist.map((x, i) => x + (p.hist?.[i] ?? 0)) }
      return a
    }
    const fmtTok = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v)))
    const TUNE_REASON = { up: '满载，加并发', flat: '加了吞吐不涨，退回', server: '服务器排队或 KV 将满，试降一档', back: '降了吞吐下降，回升', errors: '出现超时或连接错误，降低' }
    const TUNE_CHIP = { up: '↑ 满载，加并发', flat: '↺ 吞吐不涨，退回', server: '↓ 服务器满，试降', back: '↑ 吞吐下降，回升', errors: '↓ 出错，降低' }
    const hhmmss = (iso) => { const d = new Date(iso); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, '0')).join(':') }

    /**
     * 一个模型服务的并发曲线（同匿名化插件）：实线＋面积＝在途；虚线阶梯＝并发上限（自动调并发会移动它）；
     * 紫线＝吞吐（30 秒窗口内每秒完成的输入＋输出 token，右侧自己的刻度）；轴下方＝插件这边的排队，橙色虚线＝推理服务器自己的排队。
     */
    function ConcPanel({ run, hs, title }) {
      const running = run.status === 'running'
      const slot = hs.slot
      const pts = (run.series ?? []).filter((p) => p.length >= 10)
      const fixed = hs.max
      const limOf = (p) => (p.length >= 22 && p[20 + slot] > 0 ? p[20 + slot] : fixed)
      const empty = pts.length < 2
      const state = run.autoTune?.[slot] ?? null
      const steps = state?.history ?? []
      const last = steps.at(-1)
      const nowLimit = empty ? (state?.limit ?? fixed) : limOf(pts.at(-1))
      const top = Math.max(1, ...pts.map((p) => Math.max(p[2 + slot] ?? 0, limOf(p))))
      const srvQ = (p) => (p.length >= 28 && p[23 + slot * 3] >= 0 ? p[23 + slot * 3] : null)
      const srvSeen = pts.some((p) => srvQ(p) != null)
      const qMax = Math.max(1, ...pts.map((p) => p[4 + slot] ?? 0), ...pts.map((p) => srvQ(p) ?? 0))
      // 吞吐：30 秒窗口
      const thr = pts.map((p, i) => { let j = i; while (j > 0 && p[0] - pts[j - 1][0] <= 30000) j--; const dt = (p[0] - pts[j][0]) / 1000; return dt > 0 ? Math.max(0, (p[8 + slot] - pts[j][8 + slot]) / dt) : 0 })
      const thrMax = Math.max(1, ...thr); const thrNow = thr.at(-1) ?? 0; const thrPeak = Math.max(0, ...thr)
      const W = 300; const H = 72; const AX = 54
      const t1 = pts.at(-1)?.[0] || 1; const t0 = pts[0]?.[0] ?? 0
      const x = (p) => ((p[0] - t0) / Math.max(1, t1 - t0)) * W
      const up = (v) => AX - (Math.min(v, top) / top) * (AX - 3)
      const upT = (v) => AX - (v / thrMax) * (AX - 3)
      const down = (v) => AX + (v / qMax) * (H - AX - 2)
      const line = (pick) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)} ${pick(p, i).toFixed(1)}`).join(' ')
      const stepLine = pts.map((p, i) => (i ? `H${x(p).toFixed(1)} V${up(limOf(p)).toFixed(1)}` : `M0 ${up(limOf(p)).toFixed(1)}`)).join(' ')
      const peakA = Math.max(0, ...pts.map((p) => p[2 + slot] ?? 0)); const peakQ = Math.max(0, ...pts.map((p) => p[4 + slot] ?? 0))
      const lastP = running ? pts.at(-1) : null
      const sv = run.server?.[slot] ?? null
      const auto = run.autoConcurrency && state
      const tone = !state ? 'idle' : last?.reason === 'up' || last?.reason === 'back' ? 'up' : last ? 'full' : 'idle'
      const chip = auto ? (last ? TUNE_CHIP[last.reason] ?? last.reason : `保持 ${state.limit}`) : null
      const history = steps.length ? steps.map((st) => `${hhmmss(st.at)}  ${st.from}→${st.to}  ${TUNE_REASON[st.reason] ?? st.reason}（吞吐 ${fmtTok(st.thr)} token/秒）`).join('\n') : ''
      const path = state ? [state.start, ...steps.map((st) => st.to)].slice(-7).join('→') : String(fixed)
      return h('div', { className: 'mx-conc2', title: `${auto ? '自动调并发：每 30 秒看一次吞吐，只在名额跑满的窗口下结论；加并发吞吐涨 5% 才保留，服务器满时试降一档、吞吐不变才保留，出错降低。' : '并发固定（设置里关了自动调并发）。'}${history ? `\n\n${history}` : ''}` },
        h('div', { className: 'mx-conc2-h' },
          h('b', {}, title),
          h('span', {}, '并发 ', h('em', {}, String(nowLimit))),
          thr.some(Boolean) ? h('span', { className: 'thr' }, '吞吐 ', h('em', {}, fmtTok(running ? thrNow : thrPeak)), running ? '' : ' 峰值') : null,
          chip ? h('span', { className: `mx-conc2-chip ${tone}` }, chip) : null),
        h('div', { className: 'mx-conc2-plot' },
          h('div', { className: 'gut', 'aria-hidden': 'true' }, h('span', {}, String(top)), h('span', { className: 'z' }, '0'), h('span', {}, '排队')),
          h('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': `${title} 并发` },
            empty ? null : h('path', { className: 'fa', d: `${line((p) => up(p[2 + slot] ?? 0))} L${W} ${AX} L0 ${AX} Z` }),
            empty ? null : h('path', { className: 'q', d: line((p) => down(p[4 + slot] ?? 0)) }),
            srvSeen ? h('path', { className: 'sq', d: line((p) => down(srvQ(p) ?? 0)) }) : null,
            h('line', { className: 'ax', x1: 0, x2: W, y1: AX, y2: AX }),
            empty ? h('line', { className: 'lim', x1: 0, x2: W, y1: up(nowLimit), y2: up(nowLimit) }) : h('path', { className: 'lim', d: stepLine }),
            thr.length > 1 ? h('path', { className: 'tl', d: line((p, i) => upT(thr[i])) }) : null,
            empty ? null : h('path', { className: 'al', d: line((p) => up(p[2 + slot] ?? 0)) })),
          h('div', { className: 'rg', 'aria-hidden': 'true' }, thr.some(Boolean) ? h('span', {}, fmtTok(thrMax)) : null),
          empty ? h('span', { className: 'wait' }, running ? '采样中…' : '这个批次没有并发记录（旧版本跑的或太短）') : null),
        sv?.available === true
          ? h('div', { className: 'mx-conc2-srv', title: '推理服务器自己的指标（vLLM /metrics，含其他客户端的请求）：在跑＝服务器正在计算的请求数，排队＝服务器内部等待的请求数，KV＝KV 缓存占用。结束后显示峰值。' },
            h('span', { className: 'k' }, '服务器'),
            running ? `在跑 ${sv.running ?? 0} · 排队 ${sv.waiting ?? 0} · KV ${Math.round((sv.kv ?? 0) * 100)}%${sv.genRate != null ? ` · 生成 ${fmtTok(sv.genRate)}/秒` : ''}（整台）` : `峰值 在跑 ${sv.peakRunning ?? 0} · 排队 ${sv.peakWaiting ?? 0} · KV ${Math.round((sv.peakKv ?? 0) * 100)}%（整台）`)
          : sv?.available === false ? h('div', { className: 'mx-conc2-srv', title: '读不到服务器的 /metrics（不是 vLLM、没开放或要认证），只能看插件这边的数字。' }, h('span', { className: 'k' }, '服务器'), '读不到指标') : null,
        h('div', { className: 'mx-conc2-f' },
          h('span', { className: 'mono' }, auto ? path : `固定 ${fixed}`),
          lastP ? h('span', {}, `现在 在途 ${lastP[2 + slot]} · 排队 ${lastP[4 + slot]}`) : empty ? null : h('span', {}, `峰值 在途 ${peakA} · 排队 ${peakQ}`)))
    }

    function Overview({ run, goto, onSel, stations }) {
      const t = run.totals
      const legacy = run.flow !== 'read'
      const houses = modelHousesOf(run).filter((x) => x.model)
      const aggs = houses.map(houseAgg)
      const sum = (k) => aggs.reduce((a, x) => a + (x[k] ?? 0), 0)
      const sent = sum('sentChars'); const reused = sum('reusedChars'); const free = t.freeChars ?? 0
      const all = sent + reused + free
      const block = (title, cap, body, aside) => h('div', { className: 'mx-ob' }, h('div', { className: 'mx-ob-h' }, h('b', {}, title), h('span', { className: 'mx-cap' }, cap), h('span', { className: 'mx-sp' }), aside ?? null), h('div', { className: 'mx-ob-b' }, body))
      const pctOf = (n) => (all ? `${Math.round((n / all) * 100)}%` : '—')
      const roleOf = (hs) => (hs.roles.includes('extract') && hs.roles.includes('verify') ? '提取·核验' : hs.roles.includes('extract') ? '提取' : '核验')
      const vEntries = Object.values(run.verify ?? {}); const vn = vEntries.reduce((a, x) => a + x.n, 0); const va = vEntries.reduce((a, x) => a + x.agree, 0)
      const rd = legacy ? 0 : t.ruleDisputes ?? 0
      const cols = houses.length
      const cell = (hi, v, cls) => h('b', { key: hi, className: cls }, v)
      const rows = [
        ['调用', (a) => fmt(a.calls), '实际发给模型的调用（不含缓存复用），格式识别、提取、核验、复查合计'],
        ['失败率', (a) => (a.calls ? h('span', { className: a.failed ? 'mx-bad' : '' }, `${((a.failed / a.calls) * 100).toFixed(a.failed && a.failed / a.calls < 0.1 ? 1 : 0)}%`, a.retries ? h('small', { className: 'mx-warn' }, ` ↻${fmt(a.retries)}`) : null) : '—'), '重试后仍失败的调用占比；↻＝断线、超时、429／5xx 自动重试的次数'],
        ['耗时分布', (a) => { const mx = Math.max(1, ...a.hist); return a.calls ? h('div', { className: 'mx-lat', title: a.hist.map((n, i) => `${LAT_LABELS[i]}s：${n}`).join('\n') }, h('div', { className: 'bars' }, a.hist.map((n, i) => h('i', { key: i, className: i >= 5 && n ? 'slow' : '', style: { height: `${Math.max(n ? 6 : 2, (n / mx) * 100)}%` } }))), h('div', { className: 'lbl' }, LAT_LABELS.map((x) => h('span', { key: x }, x)))) : '—' }, '每次调用的耗时（秒），8 秒以上标红'],
        ['上下文 均/最大', (a) => (a.calls ? `${kfmt(a.pt / a.calls)} / ${a.ptMax ? kfmt(a.ptMax) : '—'}` : '—'), '每次调用的输入 token'],
        ['每次 输出/耗时', (a) => (a.calls ? `${fmt(Math.round(a.ct / a.calls))} / ${(a.ms / a.calls / 1000).toFixed(1)}s` : '—'), '每次调用平均输出 token 与平均耗时'],
      ]
      return h('div', { className: 'mx-frame mx-side mx-ov' },
        h('div', { className: 'mx-side-h' }, h('b', {}, '批次概览'), h('span', { className: 'mx-cap' }, 'BATCH OVERVIEW')),
        block('模型用量', 'WORKLOAD', all ? h(React.Fragment, {},
          h('div', { className: 'mx-stack', style: { height: 8 } }, [[sent, 'var(--teal)'], [reused, 'var(--ok)'], [free, 'var(--line2)']].map(([n, c], i) => (n ? h('span', { key: i, style: { width: `${(n / all) * 100}%`, background: c } }) : null))),
          h('div', { className: 'mx-legend mx-lg1' }, [['发送', sent, 'var(--teal)', '实际发给模型的文书字数（一份文书分几组字段、复查几轮就算几次）'], ['复用', reused, 'var(--ok)', '内容相同的调用直接用缓存的回复，不再发'], ['免送', free, 'var(--line2)', '不用交给模型的文书字数：空白文书、截至时刻以后的、没派到字段的、成本开关跳过的']].map(([k, n, c, tip]) => h('span', { key: k, title: tip }, h('i', { style: { background: c } }), `${k} ${kfmt(n)} · ${pctOf(n)}`))),
          h('div', { className: 'mx-ob-kv' },
            h('div', {}, h('span', {}, '调用'), h('b', {}, fmt(sum('calls')))),
            h('div', {}, h('span', {}, '复用'), h('b', {}, fmt(sum('cached')))),
            h('div', {}, h('span', {}, 'Token'), h('b', {}, kfmt(sum('pt') + sum('ct'))))),
          t.structured ? h('p', { className: 'mx-snote' }, `另有结构化记录 ${big(t.structured)} 条不提取，不计在内`) : null)
          : h('p', { className: 'mx-snote' }, legacy ? '这个批次没有记录字数（旧版本跑的）' : '还没有调用模型')),
        block('模型表现', 'MODELS', cols ? h('div', { className: 'mx-ob-models', style: { gridTemplateColumns: `86px repeat(${cols}, minmax(0,1fr))` } },
          h('span', {}), ...houses.map((hs, hi) => h('button', { key: hi, type: 'button', className: 'mx-ob-mh', title: `${hs.model}（${hs.roleText}）：点开看这个模型`, onClick: () => onSel(8 + modelHousesOf(run).findIndex((x) => x.slot === hs.slot)) }, h('b', {}, roleOf(hs)), h('small', {}, h('i', { className: aggs[hi].calls && aggs[hi].failed / aggs[hi].calls > 0.05 ? 'bad' : '' }), hs.model))),
          ...rows.flatMap(([label, val, tip], ri) => [h('span', { key: `l${ri}`, title: tip, className: ri % 2 ? 'z' : '' }, label), ...aggs.map((a, hi) => cell(`${ri}-${hi}`, val(a), ri % 2 ? 'z' : ''))]))
          : h('p', { className: 'mx-snote' }, '还没有模型调用'), h('button', { className: 'mx-link', onClick: () => goto('calls') }, '明细 →')),
        block('并发调度', 'CONCURRENCY', h(React.Fragment, {},
          h('div', { className: 'mx-legend mx-conc2-lg' }, h('span', {}, h('i', { className: 'ln in' }), '在途'), h('span', {}, h('i', { className: 'ln lim' }), '上限'), h('span', {}, h('i', { className: 'ln tp' }), '吞吐'), h('span', {}, h('i', { className: 'ln q' }), '排队'), h('span', { title: '推理服务器自己的排队（vLLM /metrics，整台服务器），画在轴下方与插件排队对照；读不到服务器指标时不画' }, h('i', { className: 'ln sq' }), '服务器排队')),
          houses.map((hs) => h(ConcPanel, { key: hs.slot, run, hs, title: roleOf(hs) })),
          !cols ? h('p', { className: 'mx-snote' }, '还没有模型') : null)),
        block('核验与复核', 'CROSS-CHECK', h(React.Fragment, {},
          h('p', { className: 'mx-snote' }, run.model?.verifyModel ? `抽样核验 ${fmt(vn)} 次（字段 × 文书）· 复查前一致 ${vn ? pct(va / vn) : '—'} · 核验分歧 ${fmt(vEntries.reduce((a, x) => a + (x.adj ?? (x.n - x.agree)), 0))}` : '未配置核验模型，不做抽样核验'),
          !legacy && run.mode !== 'model' ? h('p', { className: 'mx-snote' }, `规则匹配 ${fmt(t.votes ?? 0)} · 与模型一致 ${fmt(t.agree ?? 0)} · 不一致 ${fmt(rd)}`) : null,
          t.adjResolved || t.ruleResolved ? h('p', { className: 'mx-snote' }, `复查后自动一致 ${fmt(t.adjResolved ?? 0)}（至多 ${run.maxRounds ?? 3} 轮）`) : null,
          run.needsDefinition?.length ? h('p', { className: 'mx-snote mx-warn' }, `${run.needsDefinition.length} 个字段需要改定义（复查前一致率不达标）`) : null,
          h('p', { className: 'mx-snote' }, `待人工复核 ${fmt(t.review)} 项`)),
          h('button', { className: 'mx-link', onClick: () => goto('source') }, '去复核 →')))
    }

    /** 模型房子的面板：一个模型服务的负载、并发、耗时与按工序拆的调用 */
    function ModelPanel({ run, house: hs, goto, onBack }) {
      const calls = useAsync(() => call('calls', { runId: run.id }).catch(() => null), [run.id, hs?.total ?? 0])
      if (!hs) return h('div', { className: 'mx-frame mx-side' }, h('p', { className: 'mx-snote' }, '没有这个模型'))
      const running = run.status === 'running'
      const series = run.series ?? []
      const last = running ? series.filter((p) => p.length >= 18).at(-1) : null
      const inflight = last ? last[2 + hs.slot] : 0; const waiting = last ? last[4 + hs.slot] : 0
      const lim = Math.max(1, last?.length >= 22 && last[20 + hs.slot] > 0 ? last[20 + hs.slot] : run.autoTune?.[hs.slot]?.limit ?? hs.max)
      const tune = run.autoTune?.[hs.slot]
      const P0 = { calls: 0, cached: 0, failed: 0, retries: 0, ms: 0, pt: 0, ct: 0, ptMax: 0, hist: [0, 0, 0, 0, 0, 0, 0] }
      const agg = hs.perf.reduce((a, [, , p]) => { for (const k of ['calls', 'cached', 'failed', 'retries', 'ms', 'pt', 'ct']) a[k] += p[k] ?? 0; a.ptMax = Math.max(a.ptMax, p.ptMax ?? 0); a.hist = a.hist.map((x, i) => x + (p.hist?.[i] ?? 0)); return a }, { ...P0, hist: [...P0.hist] })
      const byStation = {}
      for (const [, st, p] of hs.perf) { const x = (byStation[st] ??= { calls: 0, cached: 0, failed: 0 }); x.calls += p.calls ?? 0; x.cached += p.cached ?? 0; x.failed += p.failed ?? 0 }
      const ps = series.filter((p) => p.length >= 10); let peak = 0; let peakT = 0
      for (let j = 0; j < ps.length; j++) { peak = Math.max(peak, ps[j][2 + hs.slot]); if (j) { const dt = (ps[j][0] - ps[j - 1][0]) / 1000; if (dt > 0) peakT = Math.max(peakT, (ps[j][8 + hs.slot] - ps[j - 1][8 + hs.slot]) / dt) } }
      const fr = agg.calls ? agg.failed / agg.calls : 0
      const sec = (title, body, aside) => h('div', { key: title, className: 'mx-ssec' }, h('div', { className: 'mx-ssec-h' }, h('span', {}, title), aside ? h('span', {}, aside) : null), body)
      const kv = (pairs) => h('div', { className: 'mx-skv' }, pairs.filter(Boolean).map(([l, v, cls]) => h('div', { key: l }, h('span', {}, l), h('b', { className: `mx-num ${cls === 'warn' ? 'mx-warn' : cls === 'bad' ? 'mx-bad' : ''}` }, v))))
      const errs = (calls.value?.errors ?? []).filter((e) => e.model === hs.model).slice(0, 5)
      const mx = Math.max(1, ...agg.hist)
      return h('div', { className: 'mx-frame mx-side' },
        h('div', { className: 'mx-side-h' }, h('b', { style: { fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: hs.model }, hs.model), h('span', { className: `mx-chip ${inflight ? 'w' : 'ok'}` }, running ? (inflight ? '处理中' : '空闲') : '已结束'), h('button', { className: 'mx-link mx-back', onClick: onBack }, '← 概览')),
        h('p', { className: 'mx-sdesc' }, `${hs.roles.includes('extract') && hs.roles.includes('verify') ? '提取模型兼核验模型' : hs.roles.includes('extract') ? '提取模型' : '核验模型'}：用于 ${hs.roleText}`, h('br'), h('span', {}, `端点 ${hs.host || '—'} · 并发 ${run.autoConcurrency ? `自动（起始 ${tune?.start ?? hs.max}，现在 ${lim}${tune?.ceiling ? `，上限 ${tune.ceiling}` : ''}）` : `固定 ${hs.max}`}`)),
        h('div', { className: 'mx-shead' },
          h(Ring, { v: running ? inflight / lim : peak / lim, label: running ? `${inflight}／${lim}` : `${peak}／${lim}`, sub: running ? `在途${waiting ? ` · 排队 ${waiting}` : ''}` : '在途峰值', hot: running && waiting > 0 }),
          kv([['调用', fmt(agg.calls)], ['缓存复用', fmt(agg.cached)], ['失败率', agg.calls ? `${(fr * 100).toFixed(fr && fr < 0.1 ? 1 : 0)}%` : '—', fr > 0.02 ? 'bad' : ''], ['自动重试', fmt(agg.retries)], ['Token', kfmt(agg.pt + agg.ct)], ['吞吐峰值', `${kfmt(peakT)} token/秒`]])),
        sec('按工序', h('div', { className: 'mx-ob-models', style: { gridTemplateColumns: '64px repeat(3, minmax(0,1fr))' } },
          h('span', {}), h('b', {}, '调用'), h('b', {}, '缓存'), h('b', {}, '失败'),
          ...hs.stations.filter((st) => st !== 'format' || hs.didFormat).flatMap((st) => { const x = byStation[st] ?? { calls: 0, cached: 0, failed: 0 }; return [h('span', { key: `${st}n` }, STATION_LABEL[st]), h('b', { key: `${st}c` }, fmt(x.calls)), h('b', { key: `${st}k` }, fmt(x.cached)), h('b', { key: `${st}f`, className: x.failed ? 'mx-bad' : '' }, fmt(x.failed))] }))),
        sec('并发', h(ConcPanel, { run, hs, title: '' })),
        sec('每次调用', h(React.Fragment, {},
          kv([['耗时 均', agg.calls ? `${(agg.ms / agg.calls / 1000).toFixed(1)}s` : '—'], ['输出 均', agg.calls ? `${fmt(Math.round(agg.ct / agg.calls))} token` : '—'], ['上下文 均', agg.calls ? kfmt(agg.pt / agg.calls) : '—'], ['上下文 最大', agg.ptMax ? kfmt(agg.ptMax) : '—']]),
          h('div', { className: 'mx-lat', style: { marginTop: 6 }, title: agg.hist.map((n, i) => `${LAT_LABELS[i]}s：${n}`).join('\n') }, h('div', { className: 'bars', style: { height: 44 } }, agg.hist.map((n, i) => h('i', { key: i, className: i >= 5 && n ? 'slow' : '', style: { height: `${Math.max(n ? 6 : 2, (n / mx) * 100)}%` } }))), h('div', { className: 'lbl' }, LAT_LABELS.map((x) => h('span', { key: x }, `${x}s`))))), '耗时分布'),
        errs.length ? sec('最近的失败', h('ul', { className: 'mx-slist' }, errs.map((e, i) => h('li', { key: i, title: e.error }, `${fmtTime(e.at)} · ${String(e.error).slice(0, 60)}`)))) : null,
        h('button', { className: 'mx-btn mx-saction', onClick: () => goto('calls') }, '模型调用明细 →'))
    }

    function StationPanel({ run, s, goto, onBack }) {
      const t = run.totals
      const tpl = useAsync(() => call('template', { id: run.template.id }).catch(() => null), [run.template.id])
      const fields = tpl.value?.template?.fields ?? []
      const nameOf = (id) => fields.find((f) => f.id === id)?.name ?? id
      const [copied, setCopied] = useState(false)
      const id = s.no
      const legacy = run.flow !== 'read'
      const [what, out] = STEP_HELP[legacy && STEP_HELP[`${id}old`] ? `${id}old` : id] ?? ['', '']
      const hot = s.state === 'run' || s.state === 'hold'
      const stateCls = hot ? 'w' : s.state === 'done' ? 'ok' : ''
      const gate = (g) => run.gates?.find((x) => x.id === g)
      const sec = (title, body, aside) => h('div', { key: title, className: 'mx-ssec' }, h('div', { className: 'mx-ssec-h' }, h('span', {}, title), aside ? h('span', {}, aside) : null), body)
      const note = (text) => h('p', { className: 'mx-snote' }, text)
      const gateLine = (g, label) => {
        const x = gate(g)
        const txt = !x ? '—' : x.skipped ? '跳过' : x.pass ? '通过' : '未过'
        return sec(`质检${g} · ${x?.label ?? label}`, x?.detail ? note(x.detail) : null, h('b', { className: x && !x.skipped ? (x.pass ? 'mx-ok' : 'mx-warn') : '' }, txt))
      }
      const kv = (pairs) => h('div', { className: 'mx-skv' }, pairs.filter(Boolean).map(([l, v, cls]) => h('div', { key: l }, h('span', {}, l), h('b', { className: `mx-num ${cls === 'ok' ? 'mx-ok' : cls === 'warn' ? 'mx-warn' : ''}` }, v))))
      const shards = `${fmt(run.shards.done)} / ${fmt(run.shards.total)} 数据块`
      const methods = t.byMethod ?? {}
      const mdl = (methods.model ?? 0) + (methods['model+rule'] ?? 0)
      const verify = Object.entries(run.verify ?? {})
      const vn = verify.reduce((a, [, x]) => a + x.n, 0); const va = verify.reduce((a, [, x]) => a + x.agree, 0)
      const top = (entries, key, n = 8) => entries.sort((a, b) => b[1][key] - a[1][key]).slice(0, n)

      /** 字段清单：[[字段 id, 主数字文本, 附注, 提示]]，名称＋数字＋附注一行 */
      const fieldList = (rows, warn) => h('div', { className: 'mx-dz' }, rows.map(([fid, txt, small, tip]) => h('p', { key: fid, title: tip ?? `${nameOf(fid)}（${fid}）` },
        h('span', {}, nameOf(fid)), txt != null ? h('b', { className: `mx-num${warn ? ' mx-warn' : ''}` }, txt) : null, small ? h('small', {}, small) : null)))
      const running = run.status === 'running'
      const progRing = h(Ring, { v: s.frac, label: `${Math.round((s.frac ?? 0) * 100)}%`, sub: shards, hot })
      let ring = null; let stats = []; const parts = []; let action = null
      if (id === 'E0') {
        // 不是模板本身的介绍（模板页有），而是这个模板在这批数据上用上了多少：哪些组一个值都没有，往往是模板选错或数据里本来没有
        const pri = run.priorities?.length ? run.priorities : null
        const scope = fields.filter((f) => !pri || pri.includes(f.priority))
        const filledOf = run.rollup?.filled ?? {}
        const hasVal = (f) => (run.byField?.[f.id]?.values ?? 0) > 0 || (filledOf[f.id]?.filled ?? 0) > 0
        const nScope = fields.length ? scope.length : run.template.fields
        const nHit = fields.length ? scope.filter(hasVal).length : Object.keys(run.byField ?? {}).length
        const started = (t.documents ?? 0) > 0
        ring = h(Ring, { v: nScope ? nHit / nScope : 0, label: `${nHit}/${nScope}`, sub: '字段本批有值', hot: started && run.status !== 'running' && nScope > 0 && nHit / nScope < 0.5 })
        stats = [['模板', run.template.name], ['版本', `v${run.template.version}`], ['字段', pri ? `${fmt(nScope)} / ${fmt(run.template.fields)}（只提取 ${pri.join('／')}）` : fmt(run.template.fields)], ['模式', legacy ? (run.mode === 'rules' ? '仅规则（已停用）' : '规则优先（已停用）') : modeLabel(run.mode)]]
        const groups = tpl.value?.template?.groups ?? []
        const byGroup = groups.map((g) => { const fs = scope.filter((f) => f.group === g.id); return [g.name, fs.length, fs.filter(hasVal).length, fs] }).filter((r) => r[1])
        if (byGroup.length) {
          const empty = byGroup.filter((r) => r[2] === 0).length
          parts.push(sec('各组有值字段', h(React.Fragment, {},
            h(RankBars, { max: 1, rows: byGroup.map(([n, all, hit, fs]) => [n, hit / all, `${hit} / ${all}`, started && !hit ? 'var(--warn)' : null,
              `${n}：${hit} / ${all} 个字段有值${hit < all ? `\n没有值：${fs.filter((f) => !hasVal(f)).map((f) => f.name).join('、')}` : ''}`]) }),
            null),
          started ? `${byGroup.length - empty} / ${byGroup.length} 组有值` : '尚未开始'))
        }
        if (scope.length) {
          const cnt = (key) => scope.reduce((m, f) => { const k = key(f); m[k] = (m[k] ?? 0) + 1; return m }, {})
          const never = scope.filter((f) => f.model === 'never').length
          const voted = scope.filter((f) => f.model !== 'never' && f.rules?.length).length
          const way = legacy ? [[run.mode === 'rules' ? '只用规则（旧批次）' : '关键词定位＋模型补充提取（旧批次）', scope.length]] : [['模型通读', scope.length - never - (run.mode === 'model' ? 0 : voted)], ...(run.mode === 'model' ? [] : [['模型通读＋规则对照', voted]]), ['只用规则（model: never）', never]]
          const GR = { encounter: '就诊', patient: '病人', timepoint: '时间点', document: '文书' }
          const gr = cnt((f) => f.granularity ?? 'encounter')
          const line = (l, v) => h('p', { className: 'mx-snote' }, h('span', { style: { color: 'var(--ink3)', marginRight: 8 } }, l), v)
          parts.push(sec('取值方式与汇总层级', h(React.Fragment, {},
            line('取值', way.filter((x) => x[1]).map(([k, n]) => `${k} ${n}`).join(' · ')),
            line('层级', Object.keys(GR).filter((k) => gr[k]).map((k) => `${GR[k]} ${gr[k]}`).join(' · ')))))
          // 本批无值的字段：宽表里这些列是空的（原因看「分配」的按字段，或这批文书本来不记录）
          const none = started && run.status !== 'running' ? scope.filter((f) => !hasVal(f)) : []
          if (none.length) parts.push(sec('无值字段', h(React.Fragment, {},
            fieldList(none.slice(0, 8).map((f) => [f.id, null, [f.sources?.recordTypes?.length ? `只看 ${f.sources.recordTypes.join('、')}` : '', f.sources?.sections?.length ? `栏目 ${f.sources.sections.join('、')}` : ''].filter(Boolean).join('；')])),
            none.length > 8 ? note(`还有 ${none.length - 8} 个`) : null), h('b', { className: 'mx-warn' }, `${none.length} 个`)))
        }
        action = ['查看字段清单', 'template']
      } else if (id === 'E1') {
        // 运行中看进度；结束后圈改成这一步的结果：多少文书进入提取
        const docAll = (t.documents ?? 0) + (t.hollow ?? 0)
        ring = running || !docAll ? progRing : h(Ring, { v: t.documents / docAll, label: pct(t.documents / docAll), sub: `文书进入提取（${fmt(t.documents)} / ${fmt(docAll)}）`, hot: t.documents / docAll < 0.5 })
        stats = [['进入提取的文书', big(t.documents)], ['结构化记录（不提取）', t.structured == null ? '—' : big(t.structured)], ['空白文书（不提取）', t.hollow == null ? '—' : big(t.hollow), t.hollow ? 'warn' : ''], ['跳过（截至时刻）', fmt(t.skipped)], ['速率', run.rate ? `${fmt(run.rate)} 份/秒` : '—'], ['输入格式', run.plan?.format ?? '—']]
        if (t.structured != null) parts.push(sec('记录构成', h(Split, { parts: [['文书', (t.documents ?? 0) + (t.hollow ?? 0), 'var(--teal)'], ['结构化记录', t.structured ?? 0, 'var(--line2)']] }), '按表判定'))
        if (t.hollow != null) parts.push(sec('清洗', h(React.Fragment, {},
          h(Split, { parts: [['进入提取', t.documents, 'var(--teal)'], ['空白文书', t.hollow, 'var(--warn)']] }),
          h('div', { title: '空白文书＝清洗后各栏目加起来不到 2 个汉字（如「护理观察：-」、只有编码的记录），不提取；图片里的文字不识别' },
            kv([['解码字段值', fmt(t.decoded)], ['去掉乱码', fmt(t.garbled)], ['去掉图片／二进制', `${fmt(t.media ?? 0)}${Object.keys(t.mediaKinds ?? {}).length ? `（${Object.entries(t.mediaKinds).map(([k, v]) => `${k} ${fmt(v)}`).join('，')}）` : ''}`]])))))
        if (run.format) {
          parts.push(sec('格式识别', h(Split, { parts: [['采用', run.format.adopted ?? 0, 'var(--teal)'], ['待确认', run.format.held ?? 0, 'var(--warn)'], ['跳过', run.format.ignored ?? 0, 'var(--line2)']] }), `${fmt((run.format.adopted ?? 0) + (run.format.held ?? 0) + (run.format.ignored ?? 0))} 张表`))
          if (run.format.scoped || run.format.adjudicated || run.format.adjDisputed) parts.push(h('div', { key: 'fmtkv', title: `两个模型各自独立起草，有分歧的表先复查（只重判有分歧的项，至多 ${run.maxRounds ?? 3} 轮）。\n仅本插件采用＝结构化表在本插件用得到的项（类别、病人、就诊）上一致、其余角色有分歧` },
            kv([run.format.adjudicated ? ['复查后一致', `${fmt(run.format.adjudicated)} 张`] : null, run.format.adjDisputed ? ['仍有分歧（转人工）', `${fmt(run.format.adjDisputed)} 张`, 'warn'] : null, run.format.scoped ? ['仅本插件采用', `${fmt(run.format.scoped)} 张`] : null])))
          if (run.format.held) action = [`去确认 ${run.format.held} 张表`, 'formats']
        }
      } else if (id === 'E2') {
        // 结束后：模板字段里有多少派到了文书（没派到的那列宽表必空）
        const dScope = fields.filter((f) => f.type !== 'derived' && f.model !== 'never' && (!run.priorities?.length || run.priorities.includes(f.priority)))
        const dHit = dScope.filter((f) => run.fieldDocs?.[f.id]).length
        ring = running || !run.fieldDocs || !dScope.length ? progRing : h(Ring, { v: dHit / dScope.length, label: `${dHit}/${dScope.length}`, sub: '字段派到了文书', hot: dHit < dScope.length })
        if (!legacy) {
          const per = (n, d = t.documents) => (d ? (n / d).toFixed(1) : '—')
          stats = [['文书', big(t.documents)], ['提取任务', big(t.tasks)], ['每份文书', `${per(t.assigned)} 字段 · ${per(t.tasks)} 任务`]]
          const disp = Object.entries(run.dispatch ?? {}).sort((a, b) => b[1].docs - a[1].docs)
          if (!run.dispatch) parts.push(note(run.status === 'running' ? '分派明细在第一个数据块做完后出现' : '这个批次没有记录分派明细（旧版本跑的），重跑后显示'))
          else {
            // 按文书类型：多少份、每份派到几个字段、几个任务；派不到字段的、切了段的标出来
            const top = disp.slice(0, 8); const rest = disp.slice(8)
            const row = ([k, d]) => h('tr', { key: k, title: `${k}：${fmt(d.docs)} 份，共派 ${fmt(d.fields)} 个字段次、${fmt(d.tasks)} 个任务${d.split ? `\n${fmt(d.split)} 份太长，按栏目切成几段` : ''}${d.none ? `\n${fmt(d.none)} 份一个字段都没派到（模板不读这类文书，或字段限定的栏目它没有）` : ''}` },
              h('td', {}, k), h('td', { className: 'mx-num' }, fmt(d.docs)),
              h('td', { className: `mx-num${d.none === d.docs ? ' mx-faint' : ''}` }, d.none === d.docs ? '不派' : Math.round(d.fields / (d.docs - d.none))),
              h('td', { className: 'mx-num' }, fmt(d.tasks)))
            const restSum = rest.reduce((m, [, d]) => { for (const x of ['docs', 'tasks', 'fields', 'split', 'none']) m[x] += d[x]; return m }, { docs: 0, tasks: 0, fields: 0, split: 0, none: 0 })
            const none = disp.reduce((n, [, d]) => n + d.none, 0); const split = disp.reduce((n, [, d]) => n + d.split, 0)
            parts.push(sec('按文书类型', h(React.Fragment, {},
              h('table', { className: 'mx-dtab' }, h('thead', {}, h('tr', {}, h('th', {}, '文书类型'), h('th', {}, '份'), h('th', { title: '每份派到的字段数（不含一个都没派到的）' }, '字段/份'), h('th', {}, '任务'))),
                h('tbody', {}, top.map(row), rest.length ? row([`其他 ${rest.length} 类`, restSum]) : null)),
              none || split ? note([none ? `${fmt(none)} 份没派到字段` : '', split ? `${fmt(split)} 份太长按栏目分段` : ''].filter(Boolean).join('；')) : null),
              `${disp.length} 类`))
            // 按字段：一份都没派到的（宽表里这列必空）与派得最少的，写明限定条件
            const fd = run.fieldDocs ?? {}
            const scope = fields.filter((f) => f.type !== 'derived' && f.model !== 'never' && (!run.priorities?.length || run.priorities.includes(f.priority)))
            const why = (f) => [f.sources?.recordTypes?.length ? `只派给 ${f.sources.recordTypes.join('、')}` : '', f.sources?.sections?.length ? `只看 ${f.sources.sections.join('、')}` : ''].filter(Boolean).join('；') || '不限'
            const zero = scope.filter((f) => !fd[f.id])
            const low = scope.filter((f) => fd[f.id]).sort((a, b) => fd[a.id] - fd[b.id]).slice(0, 5)
            if (scope.length && t.documents) parts.push(sec('按字段', h(React.Fragment, {},
              zero.length ? h('div', { className: 'mx-dz' }, h('b', { className: 'mx-warn' }, `${zero.length} 个字段一份都没派到`),
                zero.slice(0, 6).map((f) => h('p', { key: f.id, title: `${f.id} ${f.name}` }, h('span', {}, f.name), h('small', {}, why(f)))),
                zero.length > 6 ? h('p', { className: 'mx-faint' }, `还有 ${zero.length - 6} 个`) : null) : note(`${scope.length} 个字段都派到了文书`),
              low.length ? h('div', { className: 'mx-dz' }, low.map((f) => h('p', { key: f.id, title: `${f.name}（${f.id}）：派到 ${fmt(fd[f.id])} / ${fmt(t.documents)} 份文书\n${why(f)}` },
                h('span', {}, f.name), h('b', { className: 'mx-num' }, `${fmt(fd[f.id])} 份`), h('small', {}, why(f))))) : null),
              low.length ? '派得最少的' : null))
          }
          if (t.noKeyword) parts.push(sec('成本开关', note(`已开：${fmt(t.noKeyword)} 份文书一个模板关键词都没有，整份跳过（这些文书没有交给模型）`)))
        } else {
          stats = [['命中（字段 × 文书）', big(t.recalled)], ['文书', big(t.documents)]]
          parts.push(sec('数量对照', h(React.Fragment, {}, h(RankBars, { rows: [['文书', t.documents], ['命中', t.recalled], ['提取的值', t.values]] }), note('命中按「字段 × 文书」计：一个字段在一份文书里提到了算 1 个；一个命中里可能提取出多个值，也可能一个都没有（比如提到了但是否认）'))))
        }
      } else if (id === 'E3') {
        // 结束后：模型回答里原文引用核对通过的比例
        const answered = mdl + (t.quoteFail ?? 0)
        ring = running || !answered ? progRing : h(Ring, { v: mdl / answered, label: pct(mdl / answered), sub: `原文引用核对通过（丢弃 ${fmt(t.quoteFail)}）`, hot: t.quoteFail / answered > 0.05 })
        stats = [['值', big(t.values)], ['提取模型', run.model?.model ?? '—'], ['模型调用', big(t.calls)], ['命中缓存', big(t.cached)], ['调用失败', fmt(t.failed), t.failed ? 'warn' : ''], ['原文引用对不上丢弃', fmt(t.quoteFail), t.quoteFail ? 'warn' : '']]
        parts.push(sec('值的来源', h(Split, { parts: legacy
          ? [['规则', methods.rule ?? 0, 'var(--fact)'], ['模型', methods.model ?? 0, 'var(--vio)'], ['模型＋规则', methods['model+rule'] ?? 0, 'var(--decide)']]
          : [['模型', methods.model ?? 0, 'var(--vio)'], ['模型（与规则一致）', methods['model+rule'] ?? 0, 'var(--decide)'], ['只用规则的字段', methods.rule ?? 0, 'var(--fact)']] })))
        if (!legacy && run.mode !== 'model') parts.push(sec('规则对照', t.votes ? h('div', { title: '模板写了明确规则的字段，规则另匹配一次，与模型结果对照；不一致的进人工复核' }, kv([['规则结果', fmt(t.votes)], ['与模型一致', fmt(t.agree)], ['不一致', fmt(t.ruleDisputes), t.ruleDisputes ? 'warn' : '']])) : note('规则没有命中'), null))
        parts.push(gateLine('①', '原文引用与原文逐字一致'))
        if (!gate('①')) parts.push(note(`模型回答 ${fmt(mdl + t.quoteFail)} 条，原文引用对不上丢弃 ${fmt(t.quoteFail)} 条`))
        // 原文引用对不上最多的字段：模型常在这些字段上编引用或改写原文，往往是定义写得不清
        const dq = Object.entries(run.dropped ?? {}).filter(([, x]) => x.quote).sort((a, b) => b[1].quote - a[1].quote).slice(0, 5)
        if (dq.length) parts.push(sec('原文引用对不上的字段', fieldList(dq.map(([f, x]) => [f, `${fmt(x.quote)} 条`, null]), true), `共 ${fmt(t.quoteFail)} 条`))
        else {
          const qp = (run.problems ?? []).filter((x) => /引语|原文引用/.test(x.problem))
          if (qp.length) parts.push(sec('丢弃示例', h('ul', { className: 'mx-slist' }, qp.slice(0, 5).map((x, i) => h('li', { key: i }, `${nameOf(x.field)}：${x.problem}`)))))
        }
        const rows = top(Object.entries(run.byField ?? {}), 'values').map(([f, v]) => [nameOf(f), v.values, null, null, `${nameOf(f)}（${f}）：${fmt(v.values)} 个值，${fmt(v.docs)} 份文书`])
        parts.push(sec('提取值最多的字段', rows.length ? h(RankBars, { rows }) : note('还没有值'), `${Object.keys(run.byField ?? {}).length} / ${run.template.fields} 个字段有值`))
        if (run.model) action = ['模型调用', 'calls']
      } else if (id === 'E4') {
        const bad = t.invalid + t.outOfRange
        ring = h(Ring, { v: t.values ? 1 - bad / t.values : 0, label: t.values ? pct(1 - bad / t.values) : '—', sub: '合规', hot: bad > 0 })
        stats = [['不合规', fmt(bad), bad ? 'warn' : ''], ['类型或选项不对（丢弃）', fmt(t.invalid)], ['超出值域（标出，照常交付）', fmt(t.outOfRange)]]
        parts.push(sec('值的合规情况', h(Split, { parts: [['合规', Math.max(0, t.values - t.outOfRange), 'var(--teal)'], ['类型或选项不对', t.invalid, 'var(--warn)'], ['超出值域', t.outOfRange, 'var(--bad)']] })))
        // 不合规的字段：类型／选项／栏目不合（丢弃）＋超出值域（标出）
        const bf = {}
        for (const [f, x] of Object.entries(run.dropped ?? {})) if (x.invalid) (bf[f] ??= { inv: 0, oor: 0 }).inv += x.invalid
        for (const [f, x] of Object.entries(run.byField ?? {})) if (x.oor) (bf[f] ??= { inv: 0, oor: 0 }).oor += x.oor
        const worst = Object.entries(bf).sort((a, b) => (b[1].inv + b[1].oor) - (a[1].inv + a[1].oor)).slice(0, 6)
        if (worst.length) parts.push(sec('不合规的字段', fieldList(worst.map(([f, x]) => [f, fmt(x.inv + x.oor), [x.inv ? `丢弃 ${fmt(x.inv)}` : '', x.oor ? `超出值域 ${fmt(x.oor)}` : ''].filter(Boolean).join(' · ')]), true)))
        parts.push(gateLine('②', '值在类型、选项、值域之内'))
        const ip = (run.problems ?? []).filter((x) => !/引语|原文引用/.test(x.problem))
        if (ip.length) parts.push(sec('丢弃示例', h('ul', { className: 'mx-slist' }, ip.slice(0, 5).map((x, i) => h('li', { key: i }, `${nameOf(x.field)}：${x.problem}`)))))
        action = ['报告', 'report']
      } else if (id === 'E5') {
        // 结束后：宽表单元格填充率（有值或明确否认的格子 / 全部格子）
        const fl = Object.values(run.rollup?.filled ?? {}).reduce((a, x) => [a[0] + (x.filled ?? 0), a[1] + (x.rows ?? 0)], [0, 0])
        ring = running || !fl[1] ? h(Ring, { v: s.frac, label: `${Math.round((s.frac ?? 0) * 100)}%`, sub: '汇总', hot }) : h(Ring, { v: fl[0] / fl[1], label: pct(fl[0] / fl[1]), sub: `单元格有值（${big(fl[0])} / ${big(fl[1])}）` })
        stats = [['病人', big(t.patients)], ['就诊', big(t.encounters)], ['冲突', fmt(t.conflicts), t.conflicts ? 'warn' : '']]
        const filled = Object.entries(run.rollup?.filled ?? {}).filter(([, x]) => x.rows > 0).map(([f, x]) => [f, x.filled / x.rows, x])
        const best = filled.filter(([, r]) => r > 0).sort((a, b) => b[1] - a[1]).slice(0, 6)
        const empty = filled.filter(([, r]) => r === 0).length
        parts.push(sec('填充率最高的字段', best.length ? h(RankBars, { max: 1, rows: best.map(([f, r, x]) => [nameOf(f), r, pct(r), null, `${nameOf(f)}（${f}）：${fmt(x.filled)} / ${fmt(x.rows)} 格有值`]) }) : note(run.status === 'running' ? '汇总后显示' : '没有字段取到值'),
          filled.length ? `${filled.length - empty} / ${filled.length} 个字段有值` : null))
        const cf = Object.entries(run.rollup?.filled ?? {}).filter(([, x]) => x.conflicts).sort((a, b) => b[1].conflicts - a[1].conflicts).slice(0, 5)
        if (cf.length) parts.push(sec('冲突的字段', fieldList(cf.map(([f, x]) => [f, `${fmt(x.conflicts)} 格`, null, `${nameOf(f)}（${f}）：${fmt(x.conflicts)} 个单元格里有互斥的值，没有自动选边，见冲突表`]), true)))
        parts.push(gateLine('③', '可回溯原文'))
      } else if (id === 'E6') {
        ring = h(Ring, { v: vn ? va / vn : 0, label: vn ? pct(va / vn) : '—', sub: '核验一致率', hot: vn > 0 && va / vn < 0.9 })
        const rd = legacy ? 0 : t.ruleDisputes ?? 0
        stats = [['核验模型', run.model?.verifyModel || '未配置'], ['抽样（字段 × 文书）', vn ? `${fmt(vn)} 次` : '—'], ['待复核', fmt(t.review), t.review ? 'warn' : ''], ...(legacy ? [] : [['其中核验分歧', fmt(Math.max(0, t.review - rd))], ['其中规则与模型不符', fmt(rd)]])]
        const weak = verify.filter(([, x]) => x.n >= 3).map(([f, x]) => [f, x.agree / x.n, x]).sort((a, b) => a[1] - b[1]).slice(0, 5)
        parts.push(sec('一致率最低的字段', weak.length ? h(RankBars, { max: 1, rows: weak.map(([f, r, x]) => [nameOf(f), r, r.toFixed(2), r < 0.9 ? 'var(--warn)' : 'var(--teal)', `${nameOf(f)}（${f}）：${x.agree} / ${x.n} 次一致`]) }) : note(run.model?.verifyModel ? '抽样不足（每个字段至少 3 次）' : '在设置里配置核验模型后才会抽样核验')))
        // 复查：分歧两个模型轮流复查，一致即采用；质检④按复查前算
        const adjN = verify.reduce((a2, [, x]) => a2 + (x.adj ?? 0), 0); const adjOk = verify.reduce((a2, [, x]) => a2 + (x.resolved ?? 0), 0)
        if (!legacy && (adjN || t.ruleDisputes)) {
          const byR = (t.adjByRound ?? []).map((n, i) => [i + 1, n]).filter(([, n]) => n)
          parts.push(sec(`复查（至多 ${run.maxRounds ?? 3} 轮）`, h(React.Fragment, {},
            h(Split, { parts: [['复查后一致', adjOk + (t.ruleResolved ?? 0), 'var(--ok)'], ['转人工', Math.max(0, adjN - adjOk) + Math.max(0, (t.ruleDisputes ?? 0) - (t.ruleResolved ?? 0)), 'var(--warn)']] }),
            h('div', { title: '一致率按复查前算：复查只修好了被抽到的那几份' }, kv([['核验分歧', `${fmt(adjN)} 项`], ['复查后一致', `${fmt(adjOk)}${byR.length ? `（${byR.map(([rr, n]) => `第${rr}轮 ${n}`).join('，')}）` : ''}`], ['规则与模型不符', `${fmt(t.ruleDisputes ?? 0)} 项`], ['其中已解决', fmt(t.ruleResolved ?? 0)]]))),
            h('button', { className: 'mx-link', onClick: () => goto('source') }, '去复核 →')))
        }
        const nd = run.needsDefinition ?? []
        if (nd.length) parts.push(sec('需要改字段定义', h('div', { title: '复查前就对不上：没被抽到的文书只有第一遍的结果，重跑不会变（同样的提示命中缓存）。看复核里的分歧，改模板里这个字段的定义、算／不算的写法或例子' },
          h('div', { className: 'mx-rank' }, nd.slice(0, 8).map((x) => h('button', { key: x.field, type: 'button', className: 'mx-nd', title: `${x.why}；抽样 ${x.n} 次，一致 ${x.agree}`, onClick: () => { focusField.id = x.field; goto('template') } },
            h('span', {}, nameOf(x.field)), h('small', {}, x.why), h('b', { className: 'mx-num mx-warn' }, pct(x.agree / x.n)), h('i', {}, '改 →')))))))
        parts.push(gateLine('④', '抽样核验一致率'))
        action = [t.review ? `去复核 ${fmt(t.review)} 项` : '复核', 'source']
      } else if (id === 'E7') {
        // 交付没有比例可看：圈改成值的总数，源文件核对结果写在下面
        ring = run.output ? h(Ring, { v: run.sourceCheck?.changed ? 0.4 : 1, label: big(t.values), sub: `个值已交付 · ${fmt(t.patients)} 位病人`, hot: Boolean(run.sourceCheck?.changed) }) : h(Ring, { v: 0, label: '—', sub: '未交付' })
        stats = [['源文件核对', run.sourceCheck ? (run.sourceCheck.changed ? `${run.sourceCheck.changed} 个变化` : '一致') : '—', run.sourceCheck ? (run.sourceCheck.changed ? 'warn' : 'ok') : '']]
        if (run.output) parts.push(sec('输出位置', h('div', { className: 'mx-spath' }, h('span', { title: run.output }, run.output),
          h('button', { className: 'mx-btn sm', onClick: () => { navigator.clipboard?.writeText(run.output).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {}) } }, copied ? '已复制' : '复制'))))
        if (run.output) {
          const files = [['wide_patient.csv', '结果表·病人', t.patients], ['wide_encounter.csv', '结果表·就诊', t.encounters], ['timepoints.csv', '时间点长表', run.rollup?.timepoints], ['evidence/', '证据长表', t.values], ['conflicts.csv', '冲突表', t.conflicts], ...(run.xlsx ? [['result.xlsx', '以上合成一个 Excel', null]] : [])]
          parts.push(sec('交付文件', h('table', { className: 'mx-dtab' }, h('thead', {}, h('tr', {}, h('th', {}, '文件'), h('th', { style: { textAlign: 'left' } }, '内容'), h('th', {}, '行'))),
            h('tbody', {}, files.map(([f, d, n]) => h('tr', { key: f }, h('td', { className: 'mx-num', style: { fontSize: 11 } }, f), h('td', { style: { textAlign: 'left', color: 'var(--ink2)' } }, d), h('td', { className: 'mx-num' }, n == null ? '—' : fmt(n))))))))
        }
        action = ['报告', 'report']
      }

      return h('div', { className: 'mx-frame mx-side' },
        h('div', { className: 'mx-side-h' }, h('b', {}, s.nm), h('span', { className: `mx-chip ${stateCls}` }, STATE_LABEL[s.state]), onBack ? h('button', { className: 'mx-link mx-back', onClick: onBack }, '← 概览') : null),
        legacy ? h('div', { className: 'mx-err mx-slegacy' }, `旧版本跑的批次：${t.structured == null ? '那时检验、医嘱、收费等结构化记录也当文书读、没有清洗，' : ''}提取走关键词定位${run.mode === 'rules' ? '＋规则' : '＋模型补充提取'}，这些做法已停用。数字是当时的口径，重跑一次看新流程的结果`) : null,
        h('p', { className: 'mx-sdesc', title: `${what}\n→ ${out}` }, legacy || !STEP_SHORT[id] ? what : STEP_SHORT[id]),
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

    /** 运行进度：完成、速率、用时（运行中为预计剩余）、数据块与文书，速率曲线。 */
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
          h('p', {}, h('span', {}, '数据块'), h('b', {}, fmt(sh.done), h('small', {}, ` / ${fmt(sh.total)}`))),
          h('p', {}, h('span', {}, '文书'), h('b', {}, big(t.documents)), t.structured ? h('small', {}, `（另有结构化记录 ${big(t.structured)}，不提取）`) : null)),
        h(Spark, { run }))
    }

    /** 处理结果：值、病人、就诊，值的来源比例条，质检，待复核与冲突，交付位置。 */
    function ResultsPanel({ run, stations, onSel, goto }) {
      const t = run.totals
      const [copied, setCopied] = useState(false)
      const m = t.byMethod ?? {}
      const way = run.flow !== 'read' ? [['规则', m.rule ?? 0, 'var(--fact)'], ['模型', m.model ?? 0, 'var(--vio)'], ['模型＋规则', m['model+rule'] ?? 0, 'var(--decide)']]
        : [['模型', m.model ?? 0, 'var(--vio)'], ['与规则一致', m['model+rule'] ?? 0, 'var(--decide)'], ['只用规则', m.rule ?? 0, 'var(--fact)']]
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
          h('button', { className: `mx-link${t.review ? ' mx-warn' : ''}`, onClick: () => goto('source') }, '待判断 ', h('b', {}, fmt(t.review))),
          h('span', { className: t.conflicts ? 'mx-warn' : 'mx-faint', title: '同一单元格互斥的值，见交付目录的 conflicts.csv' }, '冲突 ', h('b', {}, fmt(t.conflicts))),
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
          gauge('堆内存', memRatio, mem?.heapLimit ? `${((running ? mem.heapUsed : mem.peakHeap) / GB).toFixed(1)} / ${(mem.heapLimit / GB).toFixed(1)}G` : '—', memRatio >= 0.85 ? 'crit' : memRatio >= 0.7 ? 'warn' : '', '主线程堆内存（结束后显示本批峰值）；数据块在工作线程里处理，计入下方进程常驻', mem?.heapLimit && mem.peakHeap ? mem.peakHeap / mem.heapLimit : null),
          gauge('磁盘', disk?.total ? 1 - disk.free / disk.total : null, disk?.total ? `剩 ${(disk.free / GB).toFixed(disk.free < 10 * GB ? 1 : 0)}G` : '—', disk?.total && disk.free < 5 * GB ? 'crit' : disk?.total && disk.free < 20 * GB ? 'warn' : '', '输出目录所在磁盘；圈上的点是本批最满的时候', disk?.total && Number.isFinite(disk.minFree) ? 1 - disk.minFree / disk.total : null)),
        mem?.peakRss ? h('div', { className: 'mx-res-line', title: '整个进程的常驻内存（含工作线程）' }, '进程常驻', h('b', {}, `${((running ? mem.rss ?? mem.peakRss : mem.peakRss) / GB).toFixed(1)}G`), h('span', {}, running ? `峰值 ${(mem.peakRss / GB).toFixed(1)}G` : '峰值'))
          : h('div', { className: 'mx-res-line' }, h('span', {}, '这个批次没有记录资源（旧版本跑的），重跑后显示')))
    }

    /* --------------------------------------------------------------- formats */
    const FMT_STATUS = { agreed: ['自动采用', 'ok'], confirmed: ['已确认', 'ok'], disputed: ['有分歧', 'w'], invalid: ['校验未过', 'w'], pending: ['待确认', 'w'], failed: ['调用失败', 'b'], rejected: ['已跳过', ''] }
    const FMT_ORIGIN = { model: '提取模型', verify: '核验模型', rule: '规则', user: '人工' }
    const DRAFT_LABEL = { model: '提取模型的方案', verify: '核验模型的方案', rule: '规则的方案' }
    const FIELD_KIND = { time: '时间', number: '数', code: '代码', text: '短文', long: '长文', embedded: '嵌入文书', pseudonym: '假名' }
    const stripSpec = (s) => { if (!s) return {}; const { origin, accept, ...rest } = s; return rest }
    /** 读法的一句话小结；labels：字段 → 中文名（数据元对照表） */
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
                    const [label, cls] = r.scope ? ['本插件内采用', 'ok'] : FMT_STATUS[r.status] ?? [r.status, '']
                    return h('tr', { key: r.signature, className: `click${sel === r.signature ? ' sel' : ''}`, onClick: () => setSel(r.signature) },
                      h('td', { className: 'mx-num', style: { maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.table }, r.table),
                      h('td', { className: 'mx-num' }, fmt(r.rows)),
                      h('td', {}, h('span', { className: `mx-chip ${cls}` }, label)),
                      h('td', { style: { whiteSpace: 'nowrap' } }, r.spec?.recordType ?? r.recordType ?? '—', (r.spec?.origin ?? r.origin) ? h('span', { className: 'mx-faint', style: { marginLeft: 6, fontSize: 10.5 } }, FMT_ORIGIN[r.spec?.origin ?? r.origin] ?? '') : null),
                      h('td', { className: 'mx-muted', style: { fontSize: 11.5 } }, [r.borrowedFrom ? `沿用${r.borrowedFrom}` : r.reason, ...(r.diffs ?? []), ...(r.problems ?? []).slice(0, 2)].filter(Boolean).join('；') || '—'))
                  }))))),
        h('div', { className: 'mx-frame mx-scroll mx-pad', style: { width: 480, flex: 'none', overflowX: 'hidden' } },
          !current ? h('div', { className: 'mx-faint' }, '点左边的一张表，查看识别出的读法和各方方案，并确认、修改或跳过。')
            : h(FormatDetail, { key: current.signature, row: current, recordTypes: data.value?.recordTypes ?? [], decide })))
    }

    function FormatDetail({ row, recordTypes, decide }) {
      const [editing, setEditing] = useState(false)
      const [text, setText] = useState(() => JSON.stringify(stripSpec(row.spec), null, 1))
      const [jsonErr, setJsonErr] = useState('')
      const [label, cls] = row.scope ? ['本插件内采用', 'ok'] : FMT_STATUS[row.status] ?? [row.status, '']
      const drafts = row.drafts ?? {}
      const labels = Object.fromEntries((row.fields ?? []).filter((f) => f.label).map((f) => [f.name, f.label]))
      return h('div', {},
        h('div', { className: 'mx-h' }, h('b', { className: 'mx-num', style: { wordBreak: 'break-all' } }, row.table), h('span', { className: `mx-chip ${cls}` }, label)),
        h('div', { className: 'mx-muted', style: { fontSize: 11.5, marginBottom: 8 } }, `${fmt(row.rows)} 行 · ${row.files} 个文件 · 字段 ${row.fields?.length ?? '—'}（空 ${row.fields?.filter((f) => f.kind === 'empty').length ?? '—'}）`),
        row.reason ? h('div', { className: 'mx-mo', style: { wordBreak: 'break-all' } }, row.reason, ...(row.diffs ?? []).map((d, i) => h('div', { key: i }, `· ${d}`)), ...(row.problems ?? []).map((d, i) => h('div', { key: `p${i}`, className: 'mx-warn' }, `· ${d}`))) : null,
        row.scope ? h('div', { className: 'mx-mo', style: { marginTop: 6 } }, '只在本插件内采用：这是结构化表，本插件只用类别、病人与就诊，这几项一致；下面这些角色有分歧，本插件用不到，病历事件还原不会借用这条结果。', ...(row.partialDiffs ?? []).map((d, i) => h('div', { key: i, className: 'mx-faint' }, `· ${d}`))) : null,
        row.rounds?.length ? h(React.Fragment, {},
          h('div', { className: 'mx-sec' }, h('b', {}, '复查经过'), h('span', { className: 'mx-cap' }, row.adjudicated ? `第 ${row.adjudicated} 轮一致` : `${row.rounds.length} 轮仍不一致`)),
          row.firstDiffs?.length ? h('div', { className: 'mx-faint', style: { fontSize: 11 } }, `起初的分歧：${row.firstDiffs.join('；')}`) : null,
          h('div', { className: 'mx-rounds' }, row.rounds.map((rd) => h('div', { key: rd.round, className: 'mx-round' },
            h('em', {}, `第 ${rd.round} 轮`),
            h('div', {}, h('small', {}, '提取模型'), h('div', { style: { wordBreak: 'break-all' } }, specLine(rd.extract, labels)), rd.extractReason ? h('div', { className: 'mx-why' }, rd.extractReason) : null, rd.extractInvalid ? h('div', { className: 'mx-warn', style: { fontSize: 10.5 } }, `改出的读法没过校验，当作坚持：${rd.extractInvalid[0]}`) : null),
            rd.verify ? h('div', {}, h('small', {}, '核验模型'), h('div', { style: { wordBreak: 'break-all' } }, specLine(rd.verify, labels)), rd.verifyReason ? h('div', { className: 'mx-why' }, rd.verifyReason) : null, rd.verifyInvalid ? h('div', { className: 'mx-warn', style: { fontSize: 10.5 } }, `改出的读法没过校验，当作坚持：${rd.verifyInvalid[0]}`) : null) : h('div', { className: 'mx-faint' }, rd.extract ? '（对照规则的方案，只复查 1 轮）' : ''))))) : null,
        h('div', { className: 'mx-sec' }, h('b', {}, '当前读法'), h('span', { className: 'mx-cap' }, FMT_ORIGIN[row.spec?.origin] ?? '')),
        h('div', { style: { fontSize: 12, lineHeight: 1.7, wordBreak: 'break-all' } }, specLine(row.spec, labels)),
        row.spec?.note ? h('div', { className: 'mx-faint', style: { fontSize: 11, marginTop: 4 } }, `依据：${row.spec.note}`) : null,
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 } },
          h('button', { className: 'mx-btn mx-new', onClick: () => decide({ signature: row.signature, action: 'confirm' }) }, '✓ 采用当前读法'),
          h('button', { className: 'mx-btn', onClick: () => decide({ signature: row.signature, action: 'reject' }) }, '跳过这张表'),
          h('button', { className: 'mx-btn', title: '从格式库删掉，下次运行重新起草', onClick: () => decide({ signature: row.signature, action: 'reset' }) }, '重新起草'),
          h('button', { className: `mx-btn${editing ? ' on' : ''}`, onClick: () => setEditing(!editing) }, '编辑…')),
        editing ? h('div', { style: { marginTop: 8 } },
          h('textarea', { className: 'mx-json', style: { minHeight: 260 }, value: text, onChange: (e) => setText(e.target.value), spellCheck: false }),
          h('div', { className: 'mx-faint', style: { fontSize: 10.5, margin: '4px 0 6px' } }, `类别：${recordTypes.join('、')}。字段名必须是这张表里有的；保存时插件会校验。`),
          jsonErr ? h('div', { className: 'mx-err', style: { marginBottom: 6 } }, jsonErr) : null,
          h('button', { className: 'mx-btn mx-new', onClick: () => { let spec; try { spec = JSON.parse(text) } catch (e) { return setJsonErr(`不是合法的 JSON：${msg(e)}`) } setJsonErr(''); decide({ signature: row.signature, action: 'confirm', spec }) } }, '校验并确认')) : null,
        Object.keys(drafts).length ? h(React.Fragment, {},
          h('div', { className: 'mx-sec' }, h('b', {}, '各方方案'), h('span', { className: 'mx-cap' }, 'DRAFTS')),
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
    /** 从核验面板跳到模板页的某个字段：记下要高亮的字段，模板页渲染后滚到它 */
    const focusField = { id: null }
    function Templates({ run, onError }) {
      const list = useAsync(() => call('templates'), [])
      const [focus] = useState(() => { const f = focusField.id; focusField.id = null; return f })
      useEffect(() => { if (!focus) return; const t0 = setTimeout(() => document.getElementById(`mx-f-${focus}`)?.scrollIntoView({ block: 'center' }), 300); return () => clearTimeout(t0) }, [focus])
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
              h('thead', {}, h('tr', {}, ['字段', '名称', '组', '优先级', '类型', '汇总层级', '模型', '定义', '关键词／规则'].map((x) => h('th', { key: x, style: nw }, x)))),
              h('tbody', {}, t.fields.map((f) => h('tr', { key: f.id, id: `mx-f-${f.id}`, className: focus === f.id ? 'sel' : undefined },
                h('td', { className: 'mx-num', style: nw }, f.id), h('td', { style: { minWidth: 120 } }, f.name), h('td', { className: 'mx-faint', style: nw }, groupName[f.group] ?? f.group ?? ''), h('td', { style: nw }, h('span', { className: `mx-chip ${f.priority === 'P0' ? 'v' : ''}` }, f.priority ?? 'P1')),
                h('td', { style: nw }, f.type), h('td', { className: 'mx-faint', style: nw }, f.granularity ?? 'encounter'), h('td', { className: 'mx-faint', style: nw }, f.model ?? 'auto'),
                h('td', { style: { maxWidth: 360, fontSize: 11.5 } }, f.definition),
                h('td', { className: 'mx-faint', style: { maxWidth: 280, fontSize: 11 } }, f.type === 'derived' ? `计算：${f.derive?.op}` : [...(f.recall?.terms ?? []), ...(f.options ?? []).map((o) => o.value)].slice(0, 8).join('、') + (f.rules?.length ? ` · 规则 ${f.rules.length}` : '')))))))
              : h('div', { className: 'mx-pad mx-col', style: { flex: 1 } },
                h('textarea', { className: 'mx-json', value: draft, onChange: (e) => setDraft(e.target.value), spellCheck: false }),
                h('div', { style: { display: 'flex', gap: 8, alignItems: 'flex-start' } }, h('button', { className: 'mx-btn pri', onClick: save }, '校验并保存到模板库'), h('pre', { className: 'mx-md', style: { margin: 0, color: 'var(--ink2)' } }, state))))))
    }

    /* ------------------------------------------------------------ wide table */
    /* ---------------------------------------------------------------- files */
    /** 文件：输入单元逐个列出处理状态与小计；运行中随批次刷新。点有文书的病人文件夹打开复核 */
    const FILE_STATUS = { done: ['完成', 'ok'], running: ['处理中', 'run'], failed: ['读不了', 'bad'], waiting: ['等待', 'wait'], stopped: ['未处理', 'wait'], skipped: ['未处理', 'wait'] }
    const fmtMs = (ms) => (ms == null ? '—' : ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} 秒` : `${Math.floor(ms / 60000)} 分 ${Math.round((ms % 60000) / 1000)} 秒`)
    const fmtSize = (n) => (n == null ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
    function Files({ run, openPatient }) {
      const [status, setStatus] = useState('all')
      const [q, setQ] = useState('')
      const [offset, setOffset] = useState(0)
      const d = useAsync(() => call('files', { runId: run.id, status, q: q.trim(), offset, limit: 100 }), [run.id, status, q, offset, run.status, run.shards?.done, (run.shards?.active ?? []).join(','), run.humanReview?.appliedAt])
      const v = d.value
      const c = v?.counts ?? {}
      const pdoc = v?.kind === 'patient'
      const FILTERS = [['all', '全部'], ['running', '处理中'], ['failed', '读不了'], ['empty', '没出文书'], ['todo', '有待判断'], ['waiting', run.status === 'running' ? '等待' : '未处理']]
      return h('div', { className: 'mx-frame mx-col mx-fl', style: { flex: 1, minWidth: 0 } },
        h('div', { className: 'mx-pad mx-fl-bar' },
          h('b', {}, '文件'), h('span', { className: 'mx-faint' }, pdoc ? '一位病人一个文件夹' : '一个文件一行；大文件切成几段，一段一行'),
          h('span', { className: 'mx-sp' }),
          h('div', { className: 'mx-fl-tg' }, FILTERS.map(([k, l]) => (k !== 'all' && !c[k] && status !== k ? null
            : h('button', { key: k, className: `mx-dc-tgb${status === k ? ' on' : ''}${(k === 'failed' || k === 'todo') && c[k] ? ' hot' : ''}`, onClick: () => { setStatus(k); setOffset(0) } }, `${l} ${fmt(c[k] ?? 0)}`)))),
          h('input', { className: 'mx-input', placeholder: pdoc ? '搜索病人' : '搜索文件名', value: q, onChange: (e) => { setQ(e.target.value); setOffset(0) }, style: { width: 180 } }),
          v ? h('span', { className: 'mx-faint mx-num' }, v.total ? `${fmt(offset + 1)}–${fmt(offset + v.items.length)} / ${fmt(v.total)}` : '0') : null,
          h('button', { className: 'mx-btn sm', disabled: offset === 0, onClick: () => setOffset(Math.max(0, offset - 100)) }, '‹'),
          h('button', { className: 'mx-btn sm', disabled: !v || offset + 100 >= v.total, onClick: () => setOffset(offset + 100) }, '›')),
        v?.legacy ? h('div', { className: 'mx-fl-note' }, '这个批次是旧版本跑的：只记了数据块的状态，每个文件的文书数、值数等要重跑后才有。') : null,
        h('div', { className: 'mx-scroll', style: { flex: 1 } },
          !v ? h('div', { className: 'mx-empty' }, d.error ?? '加载中…')
            : !v.items.length ? h('div', { className: 'mx-empty' }, run.status === 'running' && !c.all ? '正在规划输入…' : '没有符合的文件。')
              : h('table', { className: 'mx-fl-tbl' },
                h('thead', {}, h('tr', {}, [pdoc ? '病人文件夹' : '文件', '状态', '文书', '空白', '结构化记录', '值', '待判断', '用时'].map((x, i) => h('th', { key: x, className: i > 1 ? 'n' : '' }, x)))),
                h('tbody', {}, v.items.map((r) => {
                  const [label, tone] = FILE_STATUS[r.status] ?? [r.status, 'wait']
                  const canOpen = r.patient && r.patients === 1 && r.docs
                  const n = (x, warn = false) => h('td', { className: `n mx-num${warn ? ' mx-warn' : ''}${x === 0 ? ' z' : ''}` }, x == null ? '—' : fmt(x))
                  return h('tr', { key: `${r.shard}:${r.u}`, className: `${canOpen ? 'click' : ''} st-${tone}`, title: canOpen ? '点击打开复核' : r.error ?? '', onClick: canOpen ? () => openPatient(r.patient) : undefined },
                    h('td', { className: 'mx-fl-name' }, h('span', { className: 'mx-num', title: r.name }, r.name), r.size ? h('small', {}, fmtSize(r.size)) : null, !pdoc && r.patients ? h('small', {}, `${fmt(r.patients)} 位病人`) : null),
                    h('td', {}, h('span', { className: `mx-fl-st ${tone}` }, h('i'), label), r.error ? h('div', { className: 'mx-fl-err' }, r.error) : null),
                    n(r.docs, r.status === 'done' && r.docs === 0), n(r.hollow), n(r.structured), n(r.values), n(r.review, r.review > 0),
                    h('td', { className: 'n mx-num mx-faint' }, fmtMs(r.ms)))
                })))))
    }

    /* --------------------------------------------------------------- source */
    /**
     * 复核页（逐份核对）：左＝病人与文书（含一个值都没提到的文书），中＝原文（提取到的值高亮，可选中文字补漏提），
     * 右＝这份文书分到的全部模板字段（有值的显示值，没值的显示「未提及」并提示原文里出现的关键词）。
     * 值可以确认、去掉、改值；在原文上补的值出处记「人工」。判断后点「更新结果表」生效。
     */
    const ASSERTION_LIST = ['阳性', '否认', '可疑', '既往', '家族', '计划']
    const shortTime = (w) => (w ? String(w).slice(5, 16) : '时间不详')
    const valueText = (v) => `${v.value ?? '待定'}${v.unit ? ` ${v.unit}` : ''}`
    function Source({ run, focus, setFocus, onError, onRunChanged }) {
      const [q, setQ] = useState('')
      const [only, setOnly] = useState('all')
      const [offset, setOffset] = useState(0)
      const [selField, setSelField] = useState(focus?.field ?? null)
      const [selValue, setSelValue] = useState(null)
      const [adder, setAdder] = useState(null) // { s, e, text, x, y, field, value, assertion }
      const [pending, setPending] = useState(null) // 点了「补」的字段：等在原文里选文字
      const [edit, setEdit] = useState(null) // { id, value }
      const [busy, setBusy] = useState(false)
      const [note, setNote] = useState(null)
      const [showOther, setShowOther] = useState(false)
      // 右栏字段筛选：可多选（todo 待判断、val 有值、hint 可能漏提、none 未提及）；空集＝全部。本机记住，切文书、切病人保持
      const FF_KEY = 'mx-dc-ff'
      const [ff, setFf] = useState(() => { try { const x = JSON.parse(localStorage.getItem(FF_KEY) ?? 'null'); return Array.isArray(x) ? new Set(x) : new Set(['todo', 'val', 'hint']) } catch { return new Set(['todo', 'val', 'hint']) } })
      const setFfSave = (next) => { setFf(next); try { localStorage.setItem(FF_KEY, JSON.stringify([...next])) } catch { /* 隐私模式 */ } }
      // 收起当前病人（文书仍是它的）
      const [shut, setShut] = useState(false)
      const patient = focus?.patient ?? null
      const pl = useAsync(() => call('patients', { runId: run.id, offset, limit: 100, q: q.trim(), only: only === 'todo' ? 'todo' : null }), [run.id, offset, q, only])
      const dl = useAsync(() => (patient ? call('patientDocs', { runId: run.id, patient }) : null), [run.id, patient])
      // 按就诊分组后的顺序（组按第一份文书的时间），上一份／下一份也按这个顺序
      const docs = (() => { const m = new Map(); for (const d of dl.value?.docs ?? []) { const k = d.encounter ?? ''; if (!m.has(k)) m.set(k, []); m.get(k).push(d) } return [...m.values()].flat() })()
      const docId = focus?.doc ?? (docs.find((d) => d.todo) ?? docs[0])?.doc ?? null
      const dv = useAsync(() => (patient && docId ? call('docView', { runId: run.id, patient, doc: docId }) : null), [run.id, patient, docId])
      useEffect(() => { setSelValue(null); setAdder(null); setEdit(null); setPending(null); setSelField(focus?.field ?? null) }, [docId])
      // 首次进来没选病人：自动打开第一位（待判断多的在前）
      useEffect(() => { if (!patient && pl.value?.items?.length) setFocus({ patient: pl.value.items[0].patient }) }, [pl.value, patient])
      const v = dv.value
      const textRef = React.useRef(null)
      const reloadAll = () => { dv.reload(); dl.reload(); pl.reload() }
      const act = async (fn, okText) => {
        setBusy(true); setNote(null)
        try { await fn(); if (okText) setNote({ ok: true, text: okText }); reloadAll() } catch (e) { setNote({ ok: false, text: msg(e) }) } finally { setBusy(false) }
      }
      const decideValue = (val, decision, value = null) => act(() => call('decide', { runId: run.id, kind: 'value', target: val.id, decision, value }))
      const decideReview = (it, decision) => act(() => call('decide', { runId: run.id, kind: 'review', target: it.id, decision }))
      const removeAdded = (val) => act(() => call('decide', { runId: run.id, kind: 'add', target: val.id, decision: 'clear' }), '已撤销人工补充的值')
      const apply = () => act(async () => { const r = await call('applyDecisions', { runId: run.id }); onRunChanged?.(); return r }, '已按你的判断重新生成结果表')
      const scrollTo = (s) => {
        const box = textRef.current; if (!box) return
        const segs = [...box.querySelectorAll('[data-s]')]
        const el = segs.reverse().find((x) => Number(x.dataset.s) <= s)
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      useEffect(() => {
        if (!v || !focus?.field) return
        const val = v.values.find((x) => x.field === focus.field) ?? v.review.find((x) => x.field === focus.field)?.verifyValues?.[0]
        if (val?.s != null) setTimeout(() => scrollTo(val.s), 60)
      }, [v])

      // 原文：按所有值（含人工补充）和选中字段的关键词位置切段，每段带起点，选中文字时能换算回原文位置
      const body = v?.doc?.text ?? ''
      const spans = []
      if (v) {
        for (const x of v.values) if (x.e > x.s) spans.push({ s: x.s, e: x.e, id: x.id, kind: x.decision?.decision === 'reject' ? 'rej' : 'val', field: x.field, v: x })
        for (const x of v.added) spans.push({ s: x.s, e: x.e, id: x.id, kind: 'add', field: x.field, v: x })
        for (const it of v.review) for (const x of it.verifyValues ?? []) if (x.e > x.s) spans.push({ s: x.s, e: x.e, id: `${it.id}:${x.s}`, kind: 'other', field: it.field })
        const sf = v.fields.find((f) => f.id === selField)
        for (const hh of sf?.hits ?? []) spans.push({ s: hh.s, e: hh.e, id: `hit:${hh.s}`, kind: 'hit', field: sf.id })
      }
      const cuts = [...new Set([0, body.length, ...spans.flatMap((x) => [x.s, x.e])])].filter((n) => n >= 0 && n <= body.length).sort((a, b) => a - b)
      const RANK = { val: 4, add: 5, other: 3, rej: 1, hit: 2 }
      const segs = []
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i]; const b = cuts[i + 1]
        const cover = spans.filter((x) => x.s <= a && x.e >= b)
        const top = cover.sort((x, y) => (y.field === selField) - (x.field === selField) || RANK[y.kind] - RANK[x.kind])[0]
        const on = cover.some((x) => x.id === selValue) || (selField && cover.some((x) => x.field === selField && x.kind !== 'hit'))
        segs.push(h('span', {
          key: a, 'data-s': a,
          className: top ? `mx-dk ${top.kind}${on ? ' on' : ''}` : undefined,
          title: top ? cover.filter((x) => x.kind !== 'hit').map((x) => `${x.field} ${v.fields.find((f) => f.id === x.field)?.name ?? ''}${x.v ? ` = ${valueText(x.v)}（${x.v.assertion}）` : '（另一方的引用）'}`).join('\n') || '关键词' : undefined,
          onClick: top ? () => { setSelField(top.field); setSelValue(top.v ? top.id : null) } : undefined,
        }, body.slice(a, b)))
      }
      const posOf = (node, off) => {
        const el = node?.nodeType === 3 ? node.parentElement : node
        const seg = el?.closest?.('[data-s]')
        if (!seg || !textRef.current?.contains(seg)) return null
        return Number(seg.dataset.s) + (node.nodeType === 3 ? off : 0)
      }
      const onMouseUp = (ev) => {
        const sel = window.getSelection?.(); if (!sel || sel.isCollapsed) return
        let a = posOf(sel.anchorNode, sel.anchorOffset); let b = posOf(sel.focusNode, sel.focusOffset)
        if (a == null || b == null) return
        if (a > b) [a, b] = [b, a]
        while (a < b && /\s/.test(body[a])) a++
        while (b > a && /\s/.test(body[b - 1])) b--
        if (b - a < 1 || b - a > 400) return
        const text = body.slice(a, b)
        const fid = pending ?? (selField && v.fields.some((f) => f.id === selField) ? selField : (v.fields.find((f) => f.assigned)?.id ?? v.fields[0]?.id))
        const f = v.fields.find((x) => x.id === fid)
        const box = ev.currentTarget.getBoundingClientRect()
        setAdder({ s: a, e: b, text, x: Math.min(ev.clientX - box.left, box.width - 300), y: ev.clientY - box.top + ev.currentTarget.scrollTop + 14, field: fid, value: defaultValue(f, text), assertion: '阳性' })
      }
      const defaultValue = (f, text) => (!f ? text : f.type === 'presence' ? '有' : f.type === 'enum' ? (f.options.find((o) => text.includes(o)) ?? f.options[0] ?? '') : f.type === 'number' || f.type === 'score' ? (text.match(/-?\d+(?:\.\d+)?/)?.[0] ?? '') : f.type === 'date' ? (text.match(/\d{4}(?:-\d{2}(?:-\d{2})?)?/)?.[0] ?? '') : text)
      const saveAdd = () => act(async () => {
        await call('addValue', { runId: run.id, patient, doc: docId, field: adder.field, value: adder.value, s: adder.s, e: adder.e, assertion: adder.assertion })
        setAdder(null); setPending(null); setSelField(adder.field); window.getSelection?.().removeAllRanges()
      }, '已补上这个值；点「更新结果表」生效')

      // 右栏：字段卡
      const byField = (id) => v.values.filter((x) => x.field === id)
      const addedOf = (id) => v.added.filter((x) => x.field === id)
      const reviewOf = (id) => v.review.filter((x) => x.field === id)
      const DEC = { confirm: ['已确认', 'ok'], reject: ['已去掉', 'b'], correct: ['已改值', 'w'] }
      const valueChip = (x, added = false) => {
        const d = x.decision?.decision
        const on = selValue === x.id
        return h('div', { key: x.id, className: `mx-dc-v${on ? ' on' : ''}${d === 'reject' ? ' rej' : ''}` },
          h('button', { className: 'mx-dc-vb', title: `「${x.quote}」\n${x.section ?? ''} · ${methodLabel(x.method)}`, onClick: () => { setSelValue(x.id); setSelField(x.field); scrollTo(x.s) } },
            h('b', {}, d === 'correct' ? h(React.Fragment, {}, h('s', {}, valueText(x)), ' → ', String(x.decision.value)) : valueText(x)),
            h('span', { className: 'mx-faint' }, ` ${x.assertion}`),
            added ? h('span', { className: 'mx-chip d' }, '人工') : d ? h('span', { className: `mx-chip ${DEC[d]?.[1] ?? ''}` }, DEC[d]?.[0] ?? d) : null),
          on ? h('div', { className: 'mx-dc-va' },
            h('div', { className: 'mx-faint mx-dc-q' }, `「${x.quote}」`),
            edit?.id === x.id
              ? h('div', { className: 'mx-dc-edit' },
                h('input', { className: 'mx-input', autoFocus: true, value: edit.value, onChange: (e) => setEdit({ ...edit, value: e.target.value }), onKeyDown: (e) => { if (e.key === 'Enter') { decideValue(x, 'correct', edit.value); setEdit(null) } if (e.key === 'Escape') setEdit(null) } }),
                h('button', { className: 'mx-btn sm pri', disabled: busy || !String(edit.value).trim(), onClick: () => { decideValue(x, 'correct', edit.value); setEdit(null) } }, '保存'),
                h('button', { className: 'mx-btn sm', onClick: () => setEdit(null) }, '取消'))
              : added ? h('div', { className: 'mx-dc-btns' }, h('button', { className: 'mx-btn sm', disabled: busy, onClick: () => removeAdded(x) }, '撤销这个补充'))
                : h('div', { className: 'mx-dc-btns' },
                  d ? h('button', { className: 'mx-btn sm', disabled: busy, onClick: () => decideValue(x, 'clear') }, '撤销判断')
                    : h(React.Fragment, {},
                      h('button', { className: 'mx-btn sm', disabled: busy, title: '值对，出处也对', onClick: () => decideValue(x, 'confirm') }, '✓ 确认'),
                      h('button', { className: 'mx-btn sm', disabled: busy, title: '这个值不该提（结果表里不再用它）', onClick: () => decideValue(x, 'reject') }, '✗ 去掉'),
                      h('button', { className: 'mx-btn sm', disabled: busy, title: '位置对，值写错了', onClick: () => setEdit({ id: x.id, value: String(x.value ?? '') }) }, '✎ 改值')))) : null)
      }
      const reviewBox = (it) => h('div', { key: it.id, className: 'mx-dc-rv' },
        h('div', { className: 'mx-dc-rvh' }, h('span', { className: `mx-chip ${it.kind === 'rule' ? 'f' : 'v'}` }, it.kind === 'rule' ? '规则与模型不符' : '核验分歧'), it.decision ? h('span', { className: 'mx-chip ok' }, DECISION_LABEL(it.kind)[it.decision.decision] ?? it.decision.decision) : null),
        h('div', { className: 'mx-dc-rvc' },
          h('div', {}, h('small', {}, '当前结果'), h('b', {}, it.final)),
          h('div', {}, h('small', {}, it.kind === 'rule' ? '规则匹配' : '核验模型'), h('b', { className: 'mx-warn' }, it.verify))),
        it.rounds?.at(-1)?.extractReason ? h('div', { className: 'mx-why' }, `提取模型：${it.rounds.at(-1).extractReason}`) : null,
        h('div', { className: 'mx-dc-btns' }, it.decision
          ? h('button', { className: 'mx-btn sm', disabled: busy, onClick: () => decideReview(it, 'clear') }, '撤销判断')
          : h(React.Fragment, {},
            h('button', { className: 'mx-btn sm', disabled: busy, onClick: () => decideReview(it, 'confirm') }, '维持当前结果'),
            h('button', { className: 'mx-btn sm pri', disabled: busy, onClick: () => decideReview(it, 'useVerify') }, it.kind === 'rule' ? '改用规则匹配结果' : '改用核验模型的结果'),
            h('button', { className: 'mx-btn sm', disabled: busy || !it.finalValues.length, onClick: () => decideReview(it, 'reject') }, '两边都不对'))))
      const fieldCard = (f) => {
        const vals = byField(f.id); const adds = addedOf(f.id); const rvs = reviewOf(f.id)
        const none = !vals.length && !adds.length
        const open = rvs.some((x) => !x.decision)
        return h('div', { key: f.id, className: `mx-dc-f${selField === f.id ? ' on' : ''}${open ? ' hot' : ''}${none ? ' none' : ''}`, onClick: (e) => { if (e.target === e.currentTarget) setSelField(selField === f.id ? null : f.id) } },
          h('div', { className: 'mx-dc-fh', onClick: () => setSelField(selField === f.id ? null : f.id) },
            h('span', { className: 'mx-num mx-faint' }, f.id), h('b', {}, f.name),
            h('span', { className: 'mx-sp' }),
            none ? h('span', { className: 'mx-faint' }, '未提及') : null,
            h('button', { className: `mx-btn sm${pending === f.id ? ' pri' : ''}`, title: '在原文里选中文字，补一个漏提的值', onClick: (e) => { e.stopPropagation(); setPending(pending === f.id ? null : f.id); setSelField(f.id) } }, pending === f.id ? '选中原文…' : '＋ 补')),
          none && f.hits.length && !rvs.length ? h('button', { className: 'mx-dc-hint', title: '模板里这个字段的关键词在原文出现了，字段却是未提及：看看是不是漏提', onClick: () => { setSelField(f.id); scrollTo(f.hits[0].s) } }, `原文里有关键词「${body.slice(f.hits[0].s, f.hits[0].e).slice(0, 12)}」${f.hits.length > 1 ? ` 等 ${f.hits.length} 处` : ''}，看看是否漏提 →`) : null,
          rvs.map(reviewBox),
          vals.map((x) => valueChip(x)), adds.map((x) => valueChip(x, true)))
      }

      const fieldsAssigned = v ? v.fields.filter((f) => f.assigned) : []
      const fieldsOther = v ? v.fields.filter((f) => !f.assigned) : []
      // 字段归类（一类一个）：待判断（有没判断的分歧）＞有值＞可能漏提（未提及但原文有关键词）＞未提及
      const catOf = (f) => {
        const rvs = reviewOf(f.id)
        if (rvs.some((x) => !x.decision)) return 'todo'
        if (byField(f.id).length || addedOf(f.id).length) return 'val'
        if (f.hits.length && !rvs.length) return 'hint'
        return 'none'
      }
      const cats = new Map(fieldsAssigned.map((f) => [f.id, catOf(f)]))
      const catN = { todo: 0, val: 0, hint: 0, none: 0 }
      for (const c of cats.values()) catN[c]++
      // 有分歧的字段排最前，再按模板顺序；按筛选过滤（正在补值或选中的字段始终显示）
      const ordered = [...fieldsAssigned]
        .filter((f) => !ff.size || ff.has(cats.get(f.id)) || f.id === pending || f.id === selField)
        .sort((a, b) => (reviewOf(b.id).some((x) => !x.decision) ? 1 : 0) - (reviewOf(a.id).some((x) => !x.decision) ? 1 : 0))
      const FF = [['todo', '待判断'], ['val', '有值'], ['hint', '可能漏提'], ['none', '未提及']]
      const toggleFf = (k) => { const n = new Set(ff); if (n.has(k)) n.delete(k); else n.add(k); setFfSave(n) }
      const docIdx = docs.findIndex((d) => d.doc === docId)
      useEffect(() => {
        const onKey = (e) => {
          if (e.metaKey || e.ctrlKey || e.altKey) return
          const tag = e.target?.tagName
          if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
          const k = e.key.toLowerCase()
          if ((k === 'j' || k === 'k') && docs.length) { e.preventDefault(); const n = docs[Math.max(0, Math.min(docs.length - 1, docIdx + (k === 'j' ? 1 : -1)))]; if (n) setFocus({ patient, doc: n.doc }) }
          if (e.key === 'Escape') { setAdder(null); setPending(null) }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      })
      const P = pl.value
      // 看过的文书（本机记住，每个批次最多记 2 万份）
      const seenKey = `mx-seen:${run.id}`
      const [seen, setSeen] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(seenKey) ?? '[]')) } catch { return new Set() } })
      useEffect(() => {
        if (!docId || seen.has(docId)) return
        const arr = [...seen, docId].slice(-20000)
        try { localStorage.setItem(seenKey, JSON.stringify(arr)) } catch { /* 隐私模式 */ }
        setSeen(new Set(arr))
      }, [docId])
      // 文书按就诊分组（组按第一份文书的时间排，组内按时间）
      const encGroups = (() => {
        const m = new Map()
        for (const d of docs) {
          const k = d.encounter ?? ''
          if (!m.has(k)) m.set(k, { key: k || '-', label: k || '没有就诊号', day: d.written ? String(d.written).slice(0, 10) : null, docs: [] })
          m.get(k).docs.push(d)
        }
        return [...m.values()]
      })()

      return h('div', { className: 'mx-dc' },
        // 左：病人与文书。病人一行是卡片头（待判断、无值文书两个小胶囊）；展开的病人下面按就诊分组、按时间排成时间线，
        // 圆点＝状态：橙＝有待判断，绿勾＝看过，紫＝有值，空心＝一个值都没提到
        h('aside', { className: 'mx-frame mx-col mx-dc-side' },
          h('div', { className: 'mx-dc-search' },
            h('input', { className: 'mx-input', placeholder: '搜索病人编号', value: q, onChange: (e) => { setQ(e.target.value); setOffset(0) } }),
            h('div', { className: 'mx-dc-tg' }, [['all', `全部${P ? ` ${fmt(P.patientsAll ?? P.total)} 人` : ''}`, '这批的全部病人'], ['todo', `有待判断${P?.patientsTodo ? ` ${fmt(P.patientsTodo)} 人` : ''}`, P?.todo ? `有待判断项的病人；合计 ${fmt(P.todo)} 项待判断` : '有待判断项的病人']].map(([k, l, tip]) => h('button', { key: k, title: tip, className: `mx-dc-tgb${only === k ? ' on' : ''}${k === 'todo' && P?.patientsTodo ? ' hot' : ''}`, onClick: () => { setOnly(k); setOffset(0) } }, l)))),
          h('div', { className: 'mx-scroll mx-dc-list' },
            !P ? h('div', { className: 'mx-faint', style: { padding: 8 } }, pl.error ?? '加载中…')
              : !P.items.length ? h('div', { className: 'mx-faint', style: { padding: 8 } }, '没有符合的病人。')
                : P.items.map((p) => {
                  const open = p.patient === patient && !shut
                  const seenN = open ? docs.filter((d) => seen.has(d.doc)).length : 0
                  return h('div', { key: p.patient, className: `mx-dc-pc${open ? ' open' : ''}` },
                    h('div', { className: 'mx-dc-ph', onClick: () => { if (p.patient === patient) setShut(!shut); else { setShut(false); setFocus({ patient: p.patient }) } } },
                      h('span', { className: 'mx-dc-caret' }, open ? '▾' : '▸'),
                      h('b', { className: 'mx-num', title: p.patient }, p.patient),
                      h('span', { className: 'mx-sp' }),
                      p.todo ? h('span', { className: 'mx-dc-pill hot', title: '还没判断的分歧项' }, `待判断 ${fmt(p.todo)}`) : null,
                      p.empty ? h('span', { className: 'mx-dc-pill', title: '一个值都没提到的文书' }, `无值 ${fmt(p.empty)}`) : null),
                    h('div', { className: 'mx-dc-pm' }, `${fmt(p.docs)} 份文书 · ${fmt(p.values)} 个值`, open && docs.length ? h('span', {}, ` · 看过 ${seenN}/${docs.length}`) : null),
                    open && docs.length ? h('div', { className: 'mx-dc-prog' }, h('i', { style: { width: `${Math.round((seenN / docs.length) * 100)}%` } })) : null,
                    open ? (dl.loading && !docs.length ? h('div', { className: 'mx-faint mx-dc-pm' }, '加载中…')
                      : h('div', { className: 'mx-dc-tl' }, encGroups.map((g) => h('div', { key: g.key, className: 'mx-dc-enc' },
                        h('div', { className: 'mx-dc-eh', title: g.label }, h('span', {}, g.label), h('em', {}, g.day ?? '')),
                        g.docs.map((d) => {
                          const st = d.todo ? 'todo' : seen.has(d.doc) ? 'seen' : d.values ? 'val' : 'empty'
                          const tip = { todo: `待判断 ${d.todo} 项`, seen: '看过', val: `${d.values} 个值`, empty: d.skipped ? '没送模型（文书里没有模板关键词）' : '一个值都没提到' }[st]
                          return h('div', { key: d.doc, className: `mx-dc-dr ${st}${d.doc === docId ? ' on' : ''}`, title: `${d.doc}\n${tip}`, onClick: () => setFocus({ patient, doc: d.doc }) },
                            h('span', { className: 'mx-dc-dot' }, st === 'seen' ? '✓' : ''),
                            h('b', {}, d.recordType || '文书'),
                            h('span', { className: 'mx-dc-time mx-num' }, shortTime(d.written)),
                            h('span', { className: 'mx-dc-st' }, d.todo ? `⚠ ${d.todo}` : d.values ? `${d.values} 值` : '无值'))
                        })))) ) : null)
                }),
            P && P.total > P.items.length ? h('div', { className: 'mx-dc-page' },
              h('button', { className: 'mx-btn sm', disabled: offset === 0, onClick: () => setOffset(Math.max(0, offset - 100)) }, '‹'),
              h('span', { className: 'mx-faint mx-num' }, `${fmt(offset + 1)}–${fmt(offset + P.items.length)} / ${fmt(P.total)}`),
              h('button', { className: 'mx-btn sm', disabled: offset + 100 >= P.total, onClick: () => setOffset(offset + 100) }, '›')) : null,
            P?.legacy || dl.value?.legacy ? h('div', { className: 'mx-faint mx-dc-legacy' }, '这个批次是旧版本跑的：只列得出有提取值的文书。重跑后会列出全部文书。') : null),
          h('div', { className: 'mx-dc-key' }, h('span', { className: 'todo' }, '待判断'), h('span', { className: 'seen' }, '看过'), h('span', { className: 'val' }, '有值'), h('span', { className: 'empty' }, '无值'))),
        // 中：原文。顶栏放文书切换和小色块图例（灰色小字，不像正文）；原文做成一张纸，纸上先是文书标题，再是正文
        h('section', { className: 'mx-frame mx-col mx-dc-mid' },
          h('div', { className: 'mx-dc-bar mx-dc-bar2' },
            h('span', { className: 'mx-dc-swatch' },
              [['val', '提取到的值'], ['add', '人工补充'], ['other', '另一方引用'], ['rej', '已去掉'], ['hit', '关键词']].map(([k, l]) => h('span', { key: k }, h('i', { className: k }), l))),
            h('span', { className: 'mx-sp' }),
            docs.length ? h('span', { className: 'mx-faint mx-num' }, `${docIdx + 1} / ${docs.length}`) : null,
            h('button', { className: 'mx-btn sm', disabled: docIdx <= 0, title: '上一份（K）', onClick: () => setFocus({ patient, doc: docs[docIdx - 1].doc }) }, '‹ 上一份'),
            h('button', { className: 'mx-btn sm', disabled: docIdx < 0 || docIdx >= docs.length - 1, title: '下一份（J）', onClick: () => setFocus({ patient, doc: docs[docIdx + 1].doc }) }, '下一份 ›')),
          pending ? h('div', { className: 'mx-dc-banner' }, `在原文里选中文字，补到「${v?.fields.find((f) => f.id === pending)?.name ?? pending}」`, h('button', { className: 'mx-btn sm', onClick: () => setPending(null) }, '取消（Esc）')) : null,
          h('div', { ref: textRef, className: 'mx-scroll mx-dc-text', onMouseUp: v ? onMouseUp : undefined },
            !patient ? h('div', { className: 'mx-faint mx-pad' }, '在左边选一位病人。')
              : dv.loading && !v ? h('div', { className: 'mx-faint mx-pad' }, '加载中…')
                : dv.error ? h('div', { className: 'mx-err' }, dv.error)
                  : v ? h('div', { className: 'mx-dc-paper' },
                    h('div', { className: 'mx-dc-ttl' },
                      h('b', {}, v.doc.recordType || '文书'),
                      h('span', {}, [v.doc.written ?? '时间不详', v.doc.encounter, v.doc.patient].filter(Boolean).join(' · ')),
                      h('small', { className: 'mx-num', title: '文书编号' }, v.doc.id)),
                    h('div', { className: 'mx-doc mx-dc-body' }, segs),
                    !pending ? h('div', { className: 'mx-dc-tip' }, '选中原文里的文字，可以补一个漏提的值') : null) : null,
            adder ? h('div', { className: 'mx-dc-add', style: { left: Math.max(4, adder.x), top: adder.y }, onMouseUp: (e) => e.stopPropagation() },
              h('div', { className: 'mx-dc-addq' }, `「${adder.text.length > 40 ? `${adder.text.slice(0, 40)}…` : adder.text}」`),
              h('label', {}, '字段', h('select', { className: 'mx-input', value: adder.field, onChange: (e) => { const f = v.fields.find((x) => x.id === e.target.value); setAdder({ ...adder, field: e.target.value, value: defaultValue(f, adder.text) }) } },
                h('optgroup', { label: '这份文书分到的字段' }, fieldsAssigned.map((f) => h('option', { key: f.id, value: f.id }, `${f.id} ${f.name}`))),
                fieldsOther.length ? h('optgroup', { label: '其他字段' }, fieldsOther.map((f) => h('option', { key: f.id, value: f.id }, `${f.id} ${f.name}`))) : null)),
              (() => {
                const f = v.fields.find((x) => x.id === adder.field)
                const opts = f?.type === 'presence' ? ['有', '无', '可疑'] : f?.type === 'enum' ? f.options : null
                return h('label', {}, '值', opts
                  ? h('select', { className: 'mx-input', value: adder.value, onChange: (e) => setAdder({ ...adder, value: e.target.value, assertion: e.target.value === '无' ? '否认' : adder.assertion }) }, opts.map((o) => h('option', { key: o, value: o }, o)))
                  : h('input', { className: 'mx-input', value: adder.value, placeholder: f?.type === 'date' ? 'YYYY-MM-DD' : '', onChange: (e) => setAdder({ ...adder, value: e.target.value }) }))
              })(),
              h('label', {}, '提及方式', h('select', { className: 'mx-input', value: adder.assertion, onChange: (e) => setAdder({ ...adder, assertion: e.target.value }) }, ASSERTION_LIST.map((x) => h('option', { key: x, value: x }, x)))),
              h('div', { className: 'mx-dc-btns' },
                h('button', { className: 'mx-btn sm pri', disabled: busy || !String(adder.value ?? '').trim(), onClick: saveAdd }, busy ? '保存中…' : '补上'),
                h('button', { className: 'mx-btn sm', onClick: () => setAdder(null) }, '取消'))) : null)),
        // 右：模板字段
        h('aside', { className: 'mx-frame mx-col mx-dc-right' },
          h('div', { className: 'mx-pad mx-dc-bar' },
            h('b', {}, '模板字段'),
            v ? h('span', { className: 'mx-faint' }, `分到 ${fieldsAssigned.length} 个 · 有值 ${fieldsAssigned.filter((f) => byField(f.id).length || addedOf(f.id).length).length} 个`) : null),
          v && fieldsAssigned.length ? h('div', { className: 'mx-dc-ff' },
            h('button', { className: `mx-dc-ffb${!ff.size ? ' on' : ''}`, title: '显示全部字段', onClick: () => setFfSave(new Set()) }, '全部', h('i', {}, String(fieldsAssigned.length))),
            FF.map(([k, l]) => h('button', { key: k, className: `mx-dc-ffb ${k}${ff.has(k) ? ' on' : ''}${catN[k] ? '' : ' zero'}`, title: { todo: '有还没判断的分歧（核验分歧、规则与模型不符）', val: '提取到值或人工补充了值', hint: '未提及，但原文里出现了这个字段的关键词：看看是不是漏提', none: '未提及，原文里也没有关键词' }[k] + '（可多选）', onClick: () => toggleFf(k) }, l, h('i', {}, String(catN[k]))))) : null,
          note ? h('div', { className: `mx-rvx-note${note.ok ? '' : ' bad'}`, onClick: () => setNote(null) }, note.text) : null,
          h('div', { className: 'mx-scroll mx-dc-fields' },
            !v ? null : !fieldsAssigned.length ? h('div', { className: 'mx-faint', style: { padding: 10 } }, '这类文书模板里没有分配字段。')
              : !ordered.length ? h('div', { className: 'mx-faint', style: { padding: 10 } }, '没有符合筛选的字段。', h('button', { className: 'mx-link', style: { marginLeft: 6 }, onClick: () => setFfSave(new Set()) }, '看全部'))
                : ordered.map(fieldCard),
            v && fieldsOther.length ? h('button', { className: 'mx-link mx-dc-other', onClick: () => setShowOther(!showOther) }, `${showOther ? '▾' : '▸'} 其他 ${fieldsOther.length} 个字段（这类文书不提取）`) : null,
            v && showOther ? fieldsOther.map(fieldCard) : null),
          h('div', { className: 'mx-dc-foot' },
            h('button', { className: `mx-btn${v?.dirty ? ' mx-new' : ''}`, disabled: busy || !v?.hasOutput || run.status === 'running', onClick: apply }, '更新结果表'),
            h('span', { className: 'mx-faint' }, v?.dirty ? '有新的判断还没更新到结果表' : '判断后点这里生效，重跑也沿用'))))
    }

    const DECISION_LABEL = (kind) => ({ confirm: '已维持当前结果', useVerify: kind === 'rule' ? '已改用规则匹配结果' : '已改用核验模型的结果', reject: '已不采用当前结果' })

    /* ---------------------------------------------------------------- calls */
    function Calls({ run }) {
      const d = useAsync(() => call('calls', { runId: run.id }), [run.id, run.totals.calls])
      const v = d.value
      return h('div', { className: 'mx-frame mx-scroll mx-pad', style: { flex: 1 } },
        h('div', { className: 'mx-h' }, h('b', {}, '模型调用'), h('span', { className: 'mx-cap' }, 'MODELS'), h('span', { className: 'mx-faint' }, '按角色与模型累计；不记提示词与回复内容（回复缓存在记录库，供重跑复用）')),
        !v?.byModel?.length ? h('div', { className: 'mx-empty' }, run.model ? '还没有调用。' : '本批次未配置模型。') : h('table', {},
          h('thead', {}, h('tr', {}, ['角色', '模型', '调用', '失败', '缓存复用', '平均耗时', '输入 Token', '输出 Token'].map((x) => h('th', { key: x }, x)))),
          h('tbody', {}, v.byModel.map((m) => h('tr', { key: m.role + m.model }, h('td', {}, m.role === 'extract' ? '提取' : '核验'), h('td', {}, m.model), h('td', { className: 'mx-num' }, fmt(m.calls)), h('td', { className: `mx-num ${m.failed ? 'mx-bad' : ''}` }, fmt(m.failed)), h('td', { className: 'mx-num' }, fmt(m.cached)),
            h('td', { className: 'mx-num' }, m.calls ? `${(m.ms / m.calls / 1000).toFixed(1)}s` : '—'), h('td', { className: 'mx-num' }, fmt(m.prompt_tokens)), h('td', { className: 'mx-num' }, fmt(m.completion_tokens)))))),
        v?.errors?.length ? h(React.Fragment, {}, h('div', { className: 'mx-sec' }, h('b', {}, '最近的失败')),
          h('table', {}, h('tbody', {}, v.errors.map((c, i) => h('tr', { key: i }, h('td', { className: 'mx-num mx-faint' }, fmtTime(c.at)), h('td', {}, c.role), h('td', {}, c.model), h('td', { className: 'mx-bad' }, c.error)))))) : null)
    }

    /* 报告：Markdown 渲染（同匿名化插件）——标题、表格、列表、引用、粗体、行内代码；只生成 React 元素，不注入 HTML */
    function inlineMd(text, keyBase) {
      const out = []
      const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g
      let last = 0; let m; let i = 0
      while ((m = pattern.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index))
        const tk = m[0]
        out.push(tk.startsWith('`') ? h('code', { key: `${keyBase}-${i}` }, tk.slice(1, -1)) : h('strong', { key: `${keyBase}-${i}` }, tk.slice(2, -2)))
        last = m.index + tk.length; i++
      }
      if (last < text.length) out.push(text.slice(last))
      return out
    }
    function markdownBlocks(lines) {
      const blocks = []; let i = 0
      const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      while (i < lines.length) {
        const line = lines[i]; const key = `b${i}`
        if (!line.trim()) { i++; continue }
        const hd = /^(#{1,4})\s+(.*)$/.exec(line)
        if (hd) { blocks.push(h(`h${hd[1].length}`, { key, id: `mx-md-l${i}` }, inlineMd(hd[2], key))); i++; continue }
        if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
          const head = cells(line); const rows = []
          i += 2
          while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++ }
          // 两列「项 | 值」的表画成键值表，第一列不加粗底色
          const kvTable = head.length === 2 && /^(项|项目)$/.test(head[0])
          blocks.push(h('div', { key, className: 'mx-mdv-tw' }, h('table', { className: kvTable ? 'kv' : '' },
            kvTable ? null : h('thead', {}, h('tr', {}, head.map((c, ci) => h('th', { key: ci }, inlineMd(c, `${key}h${ci}`))))),
            h('tbody', {}, rows.map((r, ri) => h('tr', { key: ri }, r.map((c, ci) => h(kvTable && ci === 0 ? 'th' : 'td', { key: ci }, inlineMd(c, `${key}r${ri}c${ci}`)))))))))
          continue
        }
        if (line.startsWith('>')) {
          const q = []
          while (i < lines.length && lines[i].startsWith('>')) { q.push(lines[i].replace(/^>\s?/, '')); i++ }
          blocks.push(h('blockquote', { key }, inlineMd(q.join(' '), key))); continue
        }
        if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
          const ordered = /^\s*\d+\.\s+/.test(line); const items = []
          while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i])) { items.push(h('li', { key: i }, inlineMd(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ''), `${key}i${i}`))); i++ }
          blocks.push(h(ordered ? 'ol' : 'ul', { key }, items)); continue
        }
        const para = []
        while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(lines[i])) { para.push(lines[i]); i++ }
        if (!para.length) { para.push(line); i++ }
        blocks.push(h('p', { key }, inlineMd(para.join(' '), key)))
      }
      return blocks
    }
    function Report({ run }) {
      const d = useAsync(() => call('report', { runId: run.id }), [run.id, run.status])
      const [copied, setCopied] = useState(false)
      const [active, setActive] = useState(null)
      const boxRef = React.useRef(null)
      const text = d.value?.markdown ?? ''
      const lines = React.useMemo(() => String(text).split(/\r?\n/), [text])
      const blocks = React.useMemo(() => markdownBlocks(lines), [lines])
      const toc = React.useMemo(() => lines.map((l, i) => [l, i]).filter(([l]) => /^#{2,3}\s/.test(l)).map(([l, i]) => ({ i, level: /^###/.test(l) ? 3 : 2, title: l.replace(/^#{2,3}\s+/, '').replace(/[`*]/g, '') })), [lines])
      // 目录高亮滚到顶部的那一节
      useEffect(() => {
        const box = boxRef.current; if (!box || toc.length < 2) return undefined
        let fr = 0
        const on = () => { cancelAnimationFrame(fr); fr = requestAnimationFrame(() => {
          const top = box.getBoundingClientRect().top + 24; let hit = null
          for (const it of toc) { const n = document.getElementById(`mx-md-l${it.i}`); if (n && n.getBoundingClientRect().top <= top) hit = it.i; else if (n) break }
          setActive(hit)
        }) }
        on(); box.addEventListener('scroll', on, { passive: true })
        return () => { box.removeEventListener('scroll', on); cancelAnimationFrame(fr) }
      }, [toc])
      if (!d.value) return h('div', { className: 'mx-frame mx-empty', style: { flex: 1 } }, d.error ?? '加载中…')
      return h('div', { className: 'mx-frame mx-col', style: { flex: 1, minHeight: 0 } },
        h('div', { className: 'mx-pad mx-mdv-bar' },
          h('span', { className: 'mx-faint', title: d.value.path }, d.value.path),
          h('button', { className: 'mx-btn sm', onClick: () => { navigator.clipboard?.writeText(d.value.path).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {}) } }, copied ? '已复制' : '复制路径')),
        h('div', { className: 'mx-scroll mx-pad', ref: boxRef, style: { flex: 1 } },
          h('div', { className: toc.length >= 2 ? 'mx-mdv-layout' : '' },
            h('div', { className: 'mx-mdv' }, blocks),
            toc.length >= 2 ? h('nav', { className: 'mx-mdv-toc', 'aria-label': '目录' }, h('div', { className: 'mx-mdv-toc-h' }, '目录'),
              toc.map((it) => h('button', { key: it.i, type: 'button', title: it.title, className: `mx-mdv-toc-i l${it.level}${active === it.i ? ' on' : ''}`, onClick: () => document.getElementById(`mx-md-l${it.i}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, it.title))) : null)))
    }

    /* --------------------------------------------------------------- settings */
    /**
     * 模型名称：可输入，也可从端点的 /models 下拉选择（同匿名化插件）。
     * 聚焦或点 ▾ 时取列表；端点或 Key 变了重新取。
     */
    function ModelPicker({ value, onChange, placeholder, baseURL, apiKey }) {
      const [open, setOpen] = useState(false)
      const [st, setSt] = useState({ src: null, loading: false, models: [], error: '' })
      const box = React.useRef(null)
      const src = `${baseURL}|${apiKey}`
      const load = async (force = false) => {
        if (!force && st.src === src && (st.loading || st.models.length || st.error)) return
        setSt({ src, loading: true, models: [], error: '' })
        try { const r = await call('models', { baseURL, apiKey }); setSt({ src, loading: false, models: r.models ?? [], error: r.ok ? '' : r.error ?? '取不到模型列表' }) } catch (e) { setSt({ src, loading: false, models: [], error: msg(e) }) }
      }
      useEffect(() => {
        if (!open) return undefined
        const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
      }, [open])
      const stale = st.src !== src
      const q = String(value ?? '').trim().toLowerCase()
      const list = stale ? [] : st.models
      const shown = q && list.some((n) => n.toLowerCase() === q) ? list : list.filter((n) => !q || n.toLowerCase().includes(q))
      const note = (t, cls = '') => h('div', { className: `mx-mp-note ${cls}` }, t)
      return h('div', { className: 'mx-mp', ref: box },
        h('div', { className: 'mx-mp-row' },
          h('input', { className: 'mx-input', value: value ?? '', placeholder, autoComplete: 'off', spellCheck: false, onChange: (e) => { onChange(e.target.value); setOpen(true) }, onFocus: () => { setOpen(true); load() }, onKeyDown: (e) => { if (e.key === 'Escape') setOpen(false) } }),
          h('button', { type: 'button', className: 'mx-btn mx-mp-btn', title: '从端点取模型列表', onClick: () => { setOpen(true); load(true) } }, st.loading && !stale ? '…' : '▾')),
        open ? h('div', { className: 'mx-mp-menu', role: 'listbox' },
          stale || st.loading ? note('正在取模型列表…')
            : st.error ? note(`取不到模型列表：${st.error}`, 'bad')
              : !list.length ? note('端点没有列出模型，请直接输入名称')
                : [
                  value ? h('button', { key: '__clear', type: 'button', className: 'mx-mp-item mx-mp-clear', onClick: () => { onChange(''); setOpen(false) } }, '清空') : null,
                  ...shown.map((n) => h('button', { key: n, type: 'button', role: 'option', 'aria-selected': n === value ? 'true' : 'false', className: `mx-mp-item${n === value ? ' on' : ''}`, onClick: () => { onChange(n); setOpen(false) } }, n)),
                  shown.length ? null : h('div', { key: '__none', className: 'mx-mp-note' }, '没有匹配的模型'),
                ]) : null)
    }

    const SET_TABS = [
      ['model', '模型连接', ['baseURL', 'model', 'apiKey', 'clearKey', 'verifyBaseURL', 'verifyModel', 'disableThinking', 'timeoutMs', 'modelConcurrency', 'verifyConcurrency', 'autoConcurrency']],
      ['extract', '提取与核验', ['template', 'extractMode', 'priorities', 'mapping', 'verifySampleRate', 'verifyMinPerField', 'verifyThreshold', 'maxRounds']],
      ['format', '格式识别', ['formatRecognition', 'borrowFormats', 'elementDict', 'heldTables']],
      ['batch', '批次与界面', ['outputRoot', 'workers', 'shardUnits', 'showSidebarEntry']],
    ]

    function SettingsSection({ inModal = false } = {}) {
      const [cfg, setCfg] = useState(null)
      const [base, setBase] = useState({})
      const [form, setForm] = useState({})
      const [tab, setTab] = useState('model')
      const [state, setState] = useState({ text: '', tone: '' })
      const [saving, setSaving] = useState(false)
      const [tests, setTests] = useState({})
      const tpls = useAsync(() => call('templates').catch(() => ({ templates: [] })), [])
      const load = () => call('config').then((c) => {
        const f = { ...c.settings, priorities: [].concat(c.settings.priorities ?? []).join(','), mapping: Object.keys(c.settings.mapping ?? {}).length ? JSON.stringify(c.settings.mapping) : '', apiKey: '', clearKey: false }
        setCfg(c); setBase(f); setForm(f)
      }).catch((e) => setState({ text: msg(e), tone: 'bad' }))
      useEffect(() => { load() }, [])
      if (!cfg) return h('div', { className: 'mx-settings' }, h('style', {}, CSS), state.text || '加载中…')
      const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setState({ text: '', tone: '' }) }
      const same = (a, b) => String(a ?? '') === String(b ?? '')
      const dirtyKeys = Object.keys(form).filter((k) => (typeof form[k] === 'boolean' || typeof base[k] === 'boolean' ? (form[k] !== false) !== (base[k] !== false) : !same(form[k], base[k])))
      const dirty = new Set(dirtyKeys)
      const field = (k, label, props = {}, hint) => h('label', { className: 'mx-field' }, label, h('input', { className: 'mx-input', value: form[k] ?? '', onChange: (e) => set(k, e.target.value), ...props }), hint ? h('small', { className: 'mx-shint' }, hint) : null)
      const check = (k, label, hint) => h('label', { className: 'mx-scheck' }, h('input', { type: 'checkbox', checked: form[k] !== false, onChange: (e) => set(k, e.target.checked) }), h('span', {}, label, hint ? h('small', { className: 'mx-shint' }, hint) : null))
      const select = (k, label, opts, hint) => h('label', { className: 'mx-field' }, label, h('select', { className: 'mx-input', value: form[k] ?? '', onChange: (e) => set(k, e.target.value) }, opts.map(([v, l]) => h('option', { key: v, value: v }, l))), hint ? h('small', { className: 'mx-shint' }, hint) : null)
      const card = (title, hint, ...body) => h('div', { className: 'mx-scard' }, h('div', { className: 'mx-scard-h' }, h('b', {}, title), hint ? h('p', { className: 'mx-shint' }, hint) : null), ...body)
      const num = (k, d) => (form[k] === '' || form[k] == null ? d : Number(form[k]))
      const keyFor = () => form.apiKey || '' // 两个模型共用一个 Key；已保存的 Key 由插件只发往已保存的端点
      const endpointOf = (which) => (which === 'verify' ? form.verifyBaseURL || form.baseURL : form.baseURL) || ''
      const test = async (which) => {
        const name = String(which === 'verify' ? form.verifyModel : form.model).trim()
        setTests((t) => ({ ...t, [which]: { pending: true } }))
        try {
          const r = await call('models', { baseURL: endpointOf(which), apiKey: keyFor(which) })
          const tone = !r.ok ? 'bad' : name && r.models.length && !r.models.includes(name) ? 'bad' : 'ok'
          const text = !r.ok ? `连接失败：${r.error}` : !name ? `已连通，端点有 ${r.models.length} 个模型；请选一个` : r.models.length && !r.models.includes(name) ? `已连通，但端点没有「${name}」` : `已连通，模型「${name}」可用`
          setTests((t) => ({ ...t, [which]: { tone, text } }))
        } catch (e) { setTests((t) => ({ ...t, [which]: { tone: 'bad', text: msg(e) } })) }
      }
      const testLine = (which) => { const x = tests[which]; return h('div', { className: 'mx-sact' }, h('button', { type: 'button', className: 'mx-btn sm', disabled: x?.pending || !endpointOf(which), onClick: () => test(which) }, x?.pending ? '测试中…' : '测试连接'), x && !x.pending ? h('span', { className: `mx-shint ${x.tone}` }, x.text) : null) }
      const save = async () => {
        let mapping = {}
        try { mapping = form.mapping ? JSON.parse(form.mapping) : {} } catch { setTab('extract'); setState({ text: '字段映射不是合法 JSON', tone: 'bad' }); return }
        const patch = {
          outputRoot: form.outputRoot ?? '', template: form.template || 'mdd', extractMode: MODE_LABEL[form.extractMode] ? form.extractMode : 'hybrid', priorities: String(form.priorities ?? '').split(/[,，\s]+/).filter(Boolean), mapping,
          baseURL: String(form.baseURL ?? '').trim(), model: String(form.model ?? '').trim(), verifyBaseURL: String(form.verifyBaseURL ?? '').trim(), verifyModel: String(form.verifyModel ?? '').trim(), disableThinking: form.disableThinking !== false,
          timeoutMs: num('timeoutMs', 120000), modelConcurrency: num('modelConcurrency', 8), verifyConcurrency: num('verifyConcurrency', 8), maxRounds: Math.max(1, Math.min(6, num('maxRounds', 3))), workers: num('workers', 0), shardUnits: num('shardUnits', 20),
          verifySampleRate: num('verifySampleRate', 0.02), verifyMinPerField: num('verifyMinPerField', 2), verifyThreshold: num('verifyThreshold', 0.9), autoConcurrency: form.autoConcurrency !== false, showSidebarEntry: form.showSidebarEntry !== false,
          formatRecognition: form.formatRecognition !== false, borrowFormats: form.borrowFormats !== false, elementDict: form.elementDict ?? '', heldTables: form.heldTables || 'generic',
        }
        if (form.apiKey) patch.apiKey = form.apiKey
        else if (form.clearKey === true) patch.apiKey = ''
        setSaving(true)
        try { await call('saveDefaults', patch); setState({ text: '已保存（插件会重新加载）', tone: 'ok' }); setBase({ ...form, apiKey: '', clearKey: false }); setForm((f) => ({ ...f, apiKey: '', clearKey: false })) } catch (e) { setState({ text: msg(e), tone: 'bad' }) } finally { setSaving(false) }
      }
      const tplList = tpls.value?.templates ?? []
      const sameName = form.verifyModel && String(form.verifyModel).trim() === String(form.model ?? '').trim() && (form.verifyBaseURL || form.baseURL) === form.baseURL
      const panels = {
        model: () => h(React.Fragment, {},
          card('提取模型', '通读每份文书提取字段值；也给格式识别起草。必须配置，否则不能开始批次。病历内容只发往这里配置的端点，Agent 不能更改。',
            h('div', { className: 'mx-grid2' },
              field('baseURL', '端点（OpenAI 兼容）', { placeholder: 'http://127.0.0.1:11434/v1' }),
              h('div', { className: 'mx-field' }, '模型', h(ModelPicker, { value: form.model, onChange: (v) => set('model', v), placeholder: '输入或从下拉选择', baseURL: form.baseURL ?? '', apiKey: form.apiKey ?? '' })),
              h('label', { className: 'mx-field mx-wide' }, 'API Key', h('input', { className: 'mx-input', type: 'password', autoComplete: 'off', value: form.apiKey ?? '', placeholder: cfg.hasApiKey && !form.clearKey ? '已保存（留空不修改）' : '没有可不填', onChange: (e) => { set('apiKey', e.target.value); if (e.target.value) set('clearKey', false) } }))),
            cfg.hasApiKey ? h('label', { className: 'mx-scheck' }, h('input', { type: 'checkbox', checked: form.clearKey === true, onChange: (e) => { set('clearKey', e.target.checked); if (e.target.checked) set('apiKey', '') } }), h('span', {}, '清除已保存的 API Key')) : null,
            testLine('extract')),
          card('核验模型', '抽样对同样的任务各自独立重新提取，统计一致率；也给格式识别核对。可不配，不配就不做抽样核验。最好和提取模型不是同一个。',
            h('div', { className: 'mx-grid2' },
              field('verifyBaseURL', '端点（空＝同提取模型）', { placeholder: form.baseURL || 'http://127.0.0.1:11434/v1' }),
              h('div', { className: 'mx-field' }, '模型', h(ModelPicker, { value: form.verifyModel, onChange: (v) => set('verifyModel', v), placeholder: '空＝不做抽样核验', baseURL: form.verifyBaseURL || form.baseURL || '', apiKey: form.apiKey ?? '' }))),
            sameName ? h('p', { className: 'mx-shint bad' }, `核验模型和提取模型都是「${form.model}」：各自独立重抽等于自己核自己，一致率会偏高`) : null,
            form.verifyModel ? testLine('verify') : null),
          card('调用', '两个模型共用。',
            check('disableThinking', '关闭思考模式', '推理模型（如 Qwen3）更快、更省 token'),
            h('div', { className: 'mx-grid2' },
              field('timeoutMs', '单次调用超时（毫秒）', { type: 'number', min: 10000 }),
              field('modelConcurrency', '提取模型并发', { type: 'number', min: 1 }, '同时进行的请求数'),
              field('verifyConcurrency', '核验模型并发', { type: 'number', min: 1 }, '和提取模型同端点同模型时共用上一项')),
            check('autoConcurrency', '自动调并发', '上面两个并发只是起始值，每 30 秒按吞吐自动加减（最多 64）；服务器排队、KV 将满或出错时降'))),
        extract: () => h(React.Fragment, {},
          card('提取', null,
            h('div', { className: 'mx-grid2' },
              select('template', 'Agent 未指定模板时使用', (tplList.length ? tplList : [{ id: form.template, name: form.template }]).map((t) => [t.id, `${t.domain ? `${t.domain} · ` : ''}${t.name}`]), '页面上开新批次时必须自己选模板，这一项只给 Agent 调用用'),
              select('extractMode', '默认模式', Object.entries(MODE_LABEL)),
              field('priorities', '只提取这些优先级', { placeholder: '空＝全部，如 P0,P1' }),
              field('mapping', '通用文件字段映射（JSON）', { placeholder: '空＝自动识别，如 {"text":"content"}' }))),
          card('抽样核验与复查', '需要配置核验模型。',
            h('div', { className: 'mx-grid2' },
              field('verifySampleRate', '核验抽样比例（0–1）', { type: 'number', step: 0.01, min: 0, max: 1 }),
              field('verifyMinPerField', '每字段每数据块至少核验几份', { type: 'number', min: 0 }),
              field('verifyThreshold', '质检④一致率阈值（0–1）', { type: 'number', step: 0.01, min: 0, max: 1 }),
              field('maxRounds', '复查轮次上限（1–6）', { type: 'number', min: 1, max: 6 }, '分歧时两个模型轮流复查，仍不一致转人工')))),
        format: () => card('格式识别（通用文件）', '按表识别类别、写成时间、病人、就诊与栏目：规则给的方案＋提取模型、核验模型各自独立起草，一致才自动采用，其余在「格式」页确认。只发字段名、统计和截短样例，不发正文。',
          check('formatRecognition', '启用格式识别'),
          check('borrowFormats', '借用病历事件还原插件已采用的识别结果'),
          h('div', { className: 'mx-grid2' },
            field('elementDict', '数据元对照表', { placeholder: 'csv／xlsx／json 路径，两列：编码、名称' }),
            select('heldTables', '格式未定的表', [['generic', '先按通用读法读'], ['skip', '跳过，等确认']]))),
        batch: () => h(React.Fragment, {},
          card('批次', null,
            h('div', { className: 'mx-grid2' },
              field('outputRoot', '默认输出根目录', { placeholder: '空＝输入旁的 _medical-extract' }),
              field('workers', '工作线程数', { type: 'number', min: 0 }, '0＝自动'),
              field('shardUnits', 'p_doc 导出：每个数据块的病人数', { type: 'number', min: 1 }))),
          card('界面', null, check('showSidebarEntry', '在左侧栏显示「病历文书提取」入口'))),
      }
      return h('div', { className: 'mx-settings' }, h('style', {}, CSS),
        inModal ? null : h('p', { className: 'mx-shint', style: { margin: 0 } }, '这里只放配置。运行批次、复核，请到左侧栏的「病历文书提取」，或在聊天框使用 /extract。'),
        h('div', { className: 'mx-stabs', role: 'tablist' }, SET_TABS.map(([id, label, keys]) => h('button', { key: id, type: 'button', role: 'tab', 'aria-selected': tab === id ? 'true' : 'false', className: 'mx-stab', onClick: () => setTab(id) }, label, keys.some((k) => dirty.has(k)) ? h('span', { className: 'mx-sdot', title: '有未保存的修改' }) : null))),
        h('div', { role: 'tabpanel', className: 'mx-spanel' }, panels[tab]()),
        h('div', { className: 'mx-savebar' },
          h('span', { className: `mx-shint ${state.tone}` }, state.text || (dirty.size ? `${dirty.size} 项未保存` : '没有未保存的修改')),
          h('span', { style: { flex: 1 } }),
          h('button', { type: 'button', className: 'mx-btn', disabled: saving || !dirty.size, onClick: () => { setForm(base); setState({ text: '', tone: '' }) } }, '撤销修改'),
          h('button', { type: 'button', className: 'mx-btn mx-new', disabled: saving || !dirty.size, onClick: save }, saving ? '保存中…' : '保存')))
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
