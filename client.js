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
.mx-status{display:flex;align-items:center;gap:8px;padding:4px 12px 4px 10px;border-radius:8px;border:1px solid var(--line2);min-width:170px;max-width:340px}
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
.mx-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
/* ---- 产线：等轴测工厂＋HUD 面板（参考工业监控大屏） ---- */
.mx.mx-dark{--lift:0 1px 0 rgba(255,255,255,.025) inset,0 12px 26px -22px #000}
.mx.mx-light{--lift:0 1px 0 rgba(255,255,255,.8) inset,0 10px 22px -20px rgba(40,20,80,.32)}
.mx-frame{box-shadow:var(--lift);border-radius:4px}
.mx-tab.on{color:var(--teal2);border-bottom-color:var(--teal)}
.mx-tab i{color:var(--ink3)}.mx-tab.on i{color:var(--teal)}
.mx-stack{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:6px 0 4px;background:var(--line2)}.mx-stack span{display:block;height:100%}
.mx-scene{display:block;width:100%;height:auto;overflow:visible;margin:0 auto}
.mx-scene text{pointer-events:none}
.mx-hero{position:relative;padding:10px 12px 8px;min-height:560px;background:radial-gradient(120% 90% at 45% 55%,var(--panel2),var(--bg) 75%);display:flex;flex-direction:column;min-height:420px}
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
.mx-hero-legend{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
.mx-bay{font-size:11px;color:var(--ink2);background:transparent;border:1px solid var(--line2);border-radius:3px;padding:2px 8px;cursor:pointer;display:flex;gap:6px;align-items:center}
.mx-bay b{font-family:var(--mono);font-weight:500;font-size:10px;color:var(--ink3)}
.mx-bay.hold,.mx-bay.run{border-color:color-mix(in srgb,var(--teal) 45%,transparent)}.mx-bay.hold b,.mx-bay.run b{color:var(--teal)}
.mx-bay.on{background:var(--tealdim);border-color:var(--teal);color:var(--ink)}
.mx-side{width:300px;flex:none;padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.mx-side-h{display:flex;align-items:center;gap:8px}.mx-side-h b{font-size:14px;letter-spacing:1px}.mx-side-h span:nth-child(2){font-weight:600;flex:1}
.mx-side-sub{font-family:var(--mono);font-size:10.5px;color:var(--teal);margin-top:4px;line-height:1.5}
.mx-side-big{display:flex;align-items:baseline;gap:6px;margin:2px 0 6px}.mx-side-big .mx-num{font-size:28px;font-weight:300;letter-spacing:-.5px}.mx-side-big small{color:var(--ink3);font-size:11px}
.mx-kvrow{display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink3);padding:3px 0;border-top:1px solid var(--line)}.mx-kvrow b{color:var(--ink);font-weight:500}
.mx-side-sec{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;letter-spacing:.5px;color:var(--ink3);margin-top:12px;padding-top:8px;border-top:1px solid var(--line2)}
.mx-hbars{display:flex;align-items:flex-end;gap:2px;height:64px;margin-top:8px}
.mx-hbars i{flex:1;min-width:2px;background:var(--line2);cursor:pointer;border-radius:1px 1px 0 0}
.mx-hbars i.hi{background:var(--ink3)}.mx-hbars i.pk{background:var(--teal);box-shadow:0 0 8px color-mix(in srgb,var(--teal) 60%,transparent)}
.mx-hbars i:hover{background:var(--ink)}
.mx-side-foot{display:flex;justify-content:space-between;font-family:var(--mono);font-size:9.5px;color:var(--ink3);margin-top:4px}
.mx-ticks{display:flex;gap:2px;height:13px;margin-top:5px}
.mx-ticks i{flex:1;max-width:3px;background:var(--line2);border-radius:.5px}
.mx-ticks i.on{background:var(--ink2)}.mx-ticks.hot i.on{background:var(--teal)}
.mx-grid4{display:grid;grid-template-columns:1fr 1.15fr 1.1fr 1.2fr;gap:8px;flex:none}
@media (max-width:1250px){.mx-grid4{grid-template-columns:1fr 1fr}}
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

.mx-tpl{display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border:1px solid color-mix(in srgb,var(--teal) 45%,transparent);border-radius:8px;background:var(--tealdim);max-width:260px}
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
    const MODE_LABEL = { hybrid: '规则优先＋模型', model: '模型为主＋规则票', rules: '仅规则' }
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
      const tabs = [['line', '◈ 产线'], ['template', '模板', run?.template?.fields], ['wide', '宽表', run?.totals?.patients], ['source', '原文标注'], ['review', '复核', run?.totals?.review], ['calls', '模型调用'], ['report', '报告']]
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
                : run ? h('span', {}, [MODE_LABEL[run.mode], run.asOf ? `截至 ${run.asOf}` : null, run.inputName].filter(Boolean).join(' · ')) : null)),
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
        h('div', { className: 'mx-frame mx-tabs' }, tabs.map(([k, label, n]) => h('button', { key: k, className: `mx-tab${tab === k ? ' on' : ''}`, onClick: () => setTab(k) }, label, n ? h('i', {}, big(n)) : null))),
        error ? h('div', { className: 'mx-err', onClick: () => setError('') }, error) : null,
        h('div', { className: 'mx-body' },
          tab === 'template' ? h(Templates, { run, onError: setError })
            : !run ? h('div', { className: 'mx-frame mx-empty', style: { flex: 1 } }, runs.length ? '加载中…' : '还没有批次。点右上角「＋ 新批次」选择病历目录或文件，选一个抽取模板开始。')
              : tab === 'line' ? h(Pipeline, { run, goto: setTab, openPatient })
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
    function NewRun({ onStarted, onError, onClose, resumable }) {
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
      return h('div', { className: 'mx-pop', role: 'dialog', 'aria-label': '新批次' },
        h('div', { className: 'mx-pop-h' }, h('b', {}, '新批次'), h('button', { className: 'mx-btn sm', onClick: onClose, 'aria-label': '关闭' }, '✕')),
        h('label', { className: 'mx-field' }, '病历目录或文件',
          h('input', { className: 'mx-input', value: inputDir, onChange: (e) => setInput(e.target.value), placeholder: '/path/to/_medical-anonymizer/… 或 notes.ndjson', autoFocus: true }),
          h('div', { className: 'mx-pick' }, h('button', { className: 'mx-btn sm', onClick: pick, disabled: picking }, picking ? '请在弹出的窗口里选择…' : '选择文件夹…'), h('span', { className: 'mx-faint' }, 'p_doc 导出，或 json／ndjson／csv／txt 文书'))),
        h('div', { className: 'mx-grid2' },
          h('label', { className: 'mx-field' }, '抽取模板',
            h('select', { className: 'mx-input', value: template, onChange: (e) => setTemplate(e.target.value) },
              h('option', { value: '' }, `默认（${cfg.value?.template ?? '…'}）`), tplList.map((t) => h('option', { key: t.id, value: t.id }, `${t.name} · ${t.fields} 字段`)))),
          h('label', { className: 'mx-field' }, '模式',
            h('select', { className: 'mx-input', value: mode, onChange: (e) => setMode(e.target.value) },
              h('option', { value: '' }, `默认（${MODE_LABEL[cfg.value?.mode] ?? '…'}）`), Object.entries(MODE_LABEL).map(([k, l]) => h('option', { key: k, value: k }, l))))),
        h('label', { className: 'mx-pick', style: { fontSize: 11.5 } }, h('input', { type: 'checkbox', checked: p0, onChange: (e) => setP0(e.target.checked) }), '只抽 P0 字段'),
        h('label', { className: 'mx-field' }, '输出根目录', h('input', { className: 'mx-input', value: outputRoot, onChange: (e) => setOut(e.target.value), placeholder: '空＝设置里的默认值，再缺省为输入旁的 _medical-extract' })),
        h('label', { className: 'mx-field' }, '截至时刻（可空）', h('input', { className: 'mx-input', value: asOf, onChange: (e) => setAsOf(e.target.value), placeholder: 'YYYY-MM-DD HH:mm · 只用此刻以前写成的文书' })),
        h('div', { className: 'mx-pop-act' },
          h('button', { className: 'mx-btn mx-new', style: { flex: 1 }, disabled: !inputDir || busy, onClick: () => go({ inputDir, outputRoot, template, mode, asOf, priorities: p0 ? ['P0'] : undefined }) }, busy ? '启动中…' : '▶ 开始'),
          resumable ? h('button', { className: 'mx-btn', disabled: busy, title: `继续批次 ${resumable.id}：已完成的分片和模型调用直接复用`, onClick: () => go({ resumeFrom: resumable.id }) }, '↻ 继续') : null))
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
      const st = (no, nm, sub, bigv, unit, rows, state, frac) => ({ no, nm, sub, big: bigv, unit, rows, state, frac })
      const methods = t.byMethod ?? {}
      return [
        st('E1', '读入·切栏目', run.plan?.format ?? '规划输入', big(t.documents), '文书', [['分片', `${run.shards.done}/${run.shards.total}`, ''], ['速率', run.rate ? `${fmt(run.rate)}/秒` : '—', '']], stOf('E3'), shardFrac),
        st('E2', '候选召回', '按文书类型、栏目过滤；召回词与正则', big(t.recalled), '字段·文书', [['跳过（截至时刻）', fmt(t.skipped), '']], stOf('E3'), shardFrac),
        st('E3', '取值·模型补抽', '规则定值；定不了的片段送模型，引语回原文核对', big(t.values), '值', [gateRow('①', '验收①', `${fmt(t.quoteFail)} 丢弃`), ['规则', big(methods.rule), ''], ['模型', big((methods.model ?? 0) + (methods['model+rule'] ?? 0)), ''], ['模型调用', `${big(t.calls)}（缓存 ${big(t.cached)}）`, '']], stOf('E3'), shardFrac),
        st('E4', '归一·断言', '单位、日期、选项规范名；否认／既往／家族／计划', fmt(t.invalid + t.outOfRange), '不合规', [gateRow('②', '验收②')], stOf('E3'), shardFrac),
        st('E5', '汇总·派生', '按粒度与取值规则成格；派生字段；冲突登记', fmt(t.conflicts), '冲突', [['病人', big(t.patients), ''], gateRow('③', '验收③')], stOf('E5'), stage === 'E5' ? 0.5 : after('E5') ? 1 : 0),
        st('E6', '抽样核验·复核', run.model?.verifyModel ? `核验模型 ${run.model.verifyModel}` : '未配置核验模型', fmt(t.review), '项待复核', [gateRow('④', '验收④')], t.review && !running ? 'hold' : stOf('E6'), after('E6') ? 1 : 0),
        st('E7', '交付', '宽表 → 证据长表 → 冲突表 → 只读核对', run.output ? '已交付' : '—', '', [['输出', run.output ? '已写出' : '未交付', run.output ? 'ok' : '']], run.output ? 'done' : stOf('E7'), run.output ? 1 : 0),
        st('E0', '模板', `${run.template.name} v${run.template.version}`, String(run.template.fields), '字段', [['模式', MODE_LABEL[run.mode], '']], 'done', 1),
      ]
    }

    function Pipeline({ run, goto, openPatient }) {
      const stations = stationsOf(run)
      const hot = stations.filter((s) => s.state === 'run' || s.state === 'hold')
      const defSel = Math.max(0, stations.findIndex((s) => s.state === 'run' || s.state === 'hold'))
      const [selK, setSelK] = useState(null)
      const k = selK ?? (defSel >= 0 ? defSel : 2)
      return h('div', { className: 'mx-col mx-scroll', style: { flex: 1 } },
        h('div', { style: { display: 'flex', gap: 8, flex: 'none' } },
          h('div', { className: 'mx-frame mx-hero', style: { flex: 1, minWidth: 0 } },
            h('div', { className: 'mx-hero-cap' },
              h('span', { className: 'mx-cap', style: { color: 'var(--ink2)' } }, '处理流程 · PLANT'),
              h('span', { className: 'mx-faint mx-num', style: { fontSize: 10.5 } }, `${run.input} · 模板 ${run.template.id}@${run.template.version}`),
              h('span', { className: 'mx-sp' }),
              run.status === 'failed' ? h('span', { className: 'mx-live bad' }, h('i'), '批次失败') : run.status === 'cancelled' ? h('span', { className: 'mx-live bad' }, h('i'), '已取消') : hot.length ? h('span', { className: 'mx-live' }, h('i'), hot.map((s) => `${s.no} ${STATE_LABEL[s.state]}`).join(' · ')) : h('span', { className: 'mx-live ok' }, h('i'), '全部完成')),
            run.status === 'failed' && run.error ? h('div', { className: 'mx-err mx-hero-err' }, h('b', {}, '批次失败：'), String(run.error).split('\n')[0].replace(/^Error:\s*/, '')) : null,
            h(PlantScene, { run, stations, sel: k, onSel: setSelK, goto }),
            h('div', { className: 'mx-hud br' },
              h('div', {}, h('i', { className: 'sw hot' }), '运行中／待复核'), h('div', {}, h('i', { className: 'sw clay' }), '已完成'),
              h('div', {}, h('i', { className: 'sw box' }), '箱子＝一个分片'), h('div', {}, h('i', { className: 'sw red' }), '红色＝验收门未过'),
              h('div', {}, h('i', { className: 'sw vio' }), '青灯＝模型补抽（旁路）'), h('div', {}, h('i', { className: 'sw flow' }), '紫色流线＝字段规格下发')),
            h('div', { className: 'mx-hero-legend' }, [7, 0, 1, 2, 3, 4, 5, 6].map((i) => { const s = stations[i]; return h('button', { key: s.no, className: `mx-bay${i === k ? ' on' : ''} ${s.state}`, onClick: () => setSelK(i) }, h('b', {}, s.no), s.nm) }))),
          h(StationPanel, { run, s: stations[k] })),
        h('div', { className: 'mx-grid4' }, h(GatesPanel, { run }), h(FieldsPanel, { run }), h(VerifyPanel, { run }), h(AlertsPanel, { run, goto })))
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
     * E1 读入楼 → E2–E6 五栋工序楼 → E7 交付堆场；箱子＝一个分片；模型补抽在旁路。
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
        els.push(h('g', { key: 'tower', onClick: () => goto('template'), style: { cursor: 'pointer' } }, h('title', {}, '模板：点击查看字段清单'), g))
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
        els.push(h('g', { key: 'e1', ...click(0) }, h('title', {}, `${s.no} ${s.nm}`), g))
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
          const gi = (i0 + i1) / 2; const lt = iso(gi, cj + 12, 54)
          gate = h('g', { key: 'gate' },
            h('polyline', { points: pts([iso(gi, cj - 2, 32), iso(gi, cj - 2, 46), iso(gi, cj + 26, 46), iso(gi, cj + 26, 32)]), fill: 'none', stroke: gc, strokeWidth: 2.2, strokeLinejoin: 'round' }),
            h('text', { x: lt[0], y: lt[1], textAnchor: 'middle', fill: gc, fontSize: 10, fontFamily: MONO, ...halo }, h('title', {}, g ? `${g.label}：${g.detail}` : '验收门：批次结束时判定'), `${gid} ${!g ? '—' : g.skipped ? '跳过' : g.pass ? '通过' : '未过'}`))
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
        els.push(h('g', { key: `bay${k}`, className: s.state === 'hold' ? 'mx-breathe' : undefined, ...click(k) }, h('title', {}, `${s.no} ${s.nm}：${s.sub}`),
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
        els.push(h('g', { key: 'e7', opacity: s.state === 'idle' ? 0.6 : 1, ...click(6) }, h('title', {}, `${s.no} ${s.nm}`), g))
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
          els.push(h('g', { key: `q${k}`, ...(k === 5 ? { onClick: () => goto('review'), style: { cursor: 'pointer' } } : click(k)) }, g,
            h('text', { x: top[0], y: top[1], textAnchor: 'middle', fill: A, fontSize: 17, fontWeight: 700, fontFamily: MONO, stroke: C.card, strokeWidth: 3.5, paintOrder: 'stroke' }, fmt(shownN)),
            h('text', { x: top[0], y: top[1] + 13, textAnchor: 'middle', fill: P.ink, fontSize: 10, stroke: C.card, strokeWidth: 3, paintOrder: 'stroke' }, `排队 · ${label[k]}`)))
        })
      }
      // 验收门①：丢弃的引语（红箱）
      if (t.quoteFail) {
        const gi = (bay0(3) + bw + bay0(4)) / 2 - 7; const gg = []
        for (let q = 0; q < Math.min(4, Math.ceil(t.quoteFail / 10)); q++) gg.push(...isoBox(`rq${q}`, gi + (q % 2) * 15 - 4, D + 6 + Math.floor(q / 2) * 13, 0, 13, 12, 11, RED))
        const lp = iso(gi - 30, D + 30)
        gg.push(h('text', { key: 't', x: lp[0], y: lp[1] + 16, textAnchor: 'end', fill: P.bad, fontSize: 10, ...halo }, `${fmt(t.quoteFail)} 条模型引语对不上原文 · 已丢弃`))
        els.push(h('g', { key: 'redq' }, gg))
      }
      // 处理中：发光的箱子
      if (running && run.current?.stage === 'E3') {
        const at = [bay0(3) + 30, D + 6]; const tp = iso(at[0] + 8, at[1] + 14, 0)
        els.push(h('g', { key: 'cur' }, h('g', { filter: 'url(#mx-glow)', className: 'mx-pulse' }, isoBox('cc', at[0], at[1], 0, 16, 14, 13, AMB)),
          h('text', { x: tp[0] - 14, y: tp[1] + 16, textAnchor: 'end', fill: A, fontSize: 10.5, fontWeight: 700, ...halo }, `处理中 · ${run.shards.running ?? 0} 个分片${run.rate ? ` · ${fmt(run.rate)} 份/秒` : ''}`)))
      }
      // 模型补抽（旁路）
      {
        const on = !!run.model; const V = P.vio
        const mi = bay0(3) + 30; const mj = D + 118; const ma = 70; const mb = 42; const mh = 28
        const g = []
        g.push(...isoBox('mp', mi - 6, mj - 6, -3, ma + 12, mb + 12, 3, { top: C.pad, left: C.padL, right: C.padR }))
        const pipe = (key, from, to) => { const a = iso(...from); const b = iso(...to); return h('line', { key, x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: on ? V : C.left2, strokeWidth: on ? 1.8 : 1.4, strokeDasharray: '3 6', className: on ? 'mx-flow' : undefined, filter: on ? 'url(#mx-glow)' : undefined, opacity: on ? 1 : 0.5 }) }
        g.push(pipe('p1', [bay0(3) + 40, D, 22], [mi + 14, mj, mh - 4]), pipe('p2', [mi + ma - 14, mj, mh - 4], [bay0(5) + 22, D, 22]))
        g.push(...isoBox('mb', mi, mj, 0, ma, mb, mh, CL))
        for (let w = 0; w < 3; w++) g.push(leftPatch(`mw${w}`, mi + 8 + w * 20, mi + 20 + w * 20, mj + mb, 9, 19, { fill: on ? V : C.win, opacity: on ? 0.9 : 0.55, filter: on ? 'url(#mx-glow)' : undefined }))
        g.push(...isoBox('mbk', mi + 48, mj + 14, mh, 10, 10, 7, on ? { top: shade(V, 0.3), left: V, right: shade(V, -0.3) } : CL2))
        const lt = iso(mi - 10, mj + mb + 10)
        g.push(h('text', { key: 't1', x: lt[0], y: lt[1] + 6, textAnchor: 'end', fill: on ? V : P.ink3, fontSize: 11, fontWeight: 600, ...halo }, '模型补抽（旁路）'),
          h('text', { key: 't2', x: lt[0], y: lt[1] + 20, textAnchor: 'end', fill: P.ink2, fontSize: 9.5, ...halo }, on ? `调用 ${big(t.calls)} · 缓存 ${big(t.cached)} · 引语回原文核对` : '未配置模型 · 只跑规则'))
        els.push(h('g', { key: 'model', onClick: () => goto('calls'), style: { cursor: 'pointer' } }, h('title', {}, on ? `抽取模型 ${run.model.model}${run.model.verifyModel ? `；核验模型 ${run.model.verifyModel}` : ''}` : '未配置模型'), g))
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
      // 标签卡
      const anchor = (k) => (k === 0 ? iso(42, 58, 112) : k === 6 ? iso(yard + 75, 70, 40) : k === 7 ? iso(TW.i + TW.a / 2, TW.j + TW.b / 2, TW.hh + 40) : iso(bay0(k) + bw / 2, D / 2, H + 30))
      const gateFill = { ok: P.ok, warn: P.warn, '': P.ink3 }
      const maxCh = 34 + Math.max(...stations.map((s) => 3 + s.rows.length)) * 18
      stations.forEach((s, k) => { const [x, y] = anchor(k); bb.push([x + 30, y - 106], [x + 142, y - 70], [x + 70, y - 80 - maxCh], [x + 266, y - 80]) })
      stations.forEach((s, k) => {
        if (k === sel) return
        const [x, y] = anchor(k)
        const hotS = s.state === 'hold' || s.state === 'run'
        const cw = 112; const ch = 36; const cx = x + 30; const cy = y - 70 - ch
        const [, gv, gc] = s.rows[0] ?? []
        els.push(h('g', { key: `tag${k}`, ...click(k) },
          h('polyline', { points: pts([[x, y], [x, y - 20], [cx, cy + ch]]), fill: 'none', stroke: hotS ? A : C.grid, strokeOpacity: hotS ? 0.8 : 0.35 }),
          h('circle', { cx: x, cy: y, r: 1.8, fill: hotS ? A : C.grid, opacity: hotS ? 1 : 0.5 }),
          h('rect', { x: cx, y: cy, width: cw, height: ch, rx: 2, fill: C.card, stroke: hotS ? A : C.cardLine, strokeOpacity: hotS ? 0.8 : 1 }),
          h('text', { x: cx + 7, y: cy + 13, fill: hotS ? A : P.ink3, fontSize: 8.5, fontFamily: MONO, letterSpacing: 0.5 }, s.no, h('tspan', { fill: P.ink2, dx: 5, fontFamily: 'inherit' }, s.nm)),
          h('text', { x: cx + 7, y: cy + 29, fill: P.ink, fontSize: 12.5, fontWeight: 600, fontFamily: MONO }, s.big, s.unit ? h('tspan', { fontSize: 8.5, fontWeight: 400, fill: P.ink3, dx: 3 }, s.unit) : null),
          gv ? h('text', { x: cx + cw - 7, y: cy + 29, textAnchor: 'end', fill: gateFill[gc] ?? P.ink3, fontSize: 9, fontFamily: MONO }, String(gv).slice(0, 10)) : null))
      })
      {
        const s = stations[sel]; const [x, y] = anchor(sel)
        const rows = [[s.unit || '状态', s.big, ''], ...s.rows, ['完成', `${Math.round((s.frac ?? 0) * 100)}%`, ''], ['状态', STATE_LABEL[s.state], s.state === 'done' ? 'ok' : s.state === 'idle' ? '' : 'warn']]
        const cw = 196; const ch = 34 + rows.length * 18
        const cx = x + 70; const cy = y - 80 - ch
        const fill = { ok: P.ok, warn: P.warn, '': P.ink }
        els.push(h('g', { key: 'card', className: 'mx-cardin' },
          h('polyline', { points: pts([[x, y], [x, y - 22], [cx, cy + ch]]), fill: 'none', stroke: A, strokeWidth: 1 }),
          h('circle', { cx: x, cy: y, r: 3, fill: A, filter: 'url(#mx-glow)' }),
          h('rect', { x: cx, y: cy, width: cw, height: ch, rx: 3, fill: C.card, stroke: C.cardLine }),
          h('rect', { x: cx, y: cy, width: 2, height: ch, fill: A }),
          h('text', { x: cx + 14, y: cy + 20, fill: P.ink, fontSize: 12, fontWeight: 700, fontFamily: MONO, letterSpacing: 1 }, s.no, h('tspan', { fill: P.ink2, fontWeight: 400, dx: 8, fontSize: 11.5, fontFamily: 'inherit' }, s.nm)),
          rows.map(([l, v, cls], i) => h('g', { key: i },
            h('text', { x: cx + 14, y: cy + 42 + i * 18, fill: P.ink3, fontSize: 10.5 }, l),
            h('text', { x: cx + cw - 12, y: cy + 42 + i * 18, textAnchor: 'end', fill: fill[cls] ?? P.ink, fontSize: 12, fontFamily: MONO }, String(v))))))
      }
      for (const [i, j, a, b, z] of [[-60, 44, 60, 24, 8], [0, 8, 84, 100, 112], [h0, 0, hallEnd - h0, D, H + 70], [yard, 6, 150, 160, 30], [bay0(3) + 20, D + 110, 90, 60, 30]]) {
        for (const [di, dj] of [[0, 0], [a, 0], [a, b], [0, b]]) bb.push(iso(i + di, j + dj, 0), iso(i + di, j + dj, z))
      }
      const xs = bb.map((p) => p[0]); const ys = bb.map((p) => p[1])
      const x0 = Math.min(...xs) - 24; const y0 = Math.min(...ys) - 16; const x1 = Math.max(...xs) + 24; const y1 = Math.max(...ys) + 16
      defs.push(h('mask', { key: 'mk', id: 'mx-gridmask', maskUnits: 'userSpaceOnUse', x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, h('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'url(#mx-fade)' })))
      return h('svg', { className: 'mx-scene', viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, preserveAspectRatio: 'xMidYMin meet', style: { maxHeight: 620, overflow: 'hidden' } }, h('defs', {}, defs), els)
    }

    function StationPanel({ run, s }) {
      const [P, C] = useClay()
      const hotTone = s.state === 'run' || s.state === 'hold' ? P.teal : null
      const model = []
      model.push(...isoBox('pd', -8, -8, -4, 116, 96, 4, { top: C.pad, left: C.padL, right: C.padR }))
      model.push(...isoBox('m', 0, 0, 0, 100, 80, 42, { top: C.top, left: C.left, right: C.right, edge: C.edge }))
      for (let w = 0; w < 4; w++) model.push(leftPatch(`w${w}`, 10 + w * 22, 24 + w * 22, 80, 16, 30, { fill: hotTone ?? C.win, opacity: hotTone ? 0.85 : 0.6 }))
      const roof = []
      for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) roof.push([b, a])
      roof.sort((p, q) => depthOf(p[0] * 30, p[1] * 32) - depthOf(q[0] * 30, q[1] * 32)).forEach(([b, a], q) => {
        const lit = hotTone && q < Math.max(1, Math.round((s.frac ?? 0) * 6))
        model.push(...isoBox(`u${a}${b}`, 10 + b * 30, 12 + a * 32, 42, 22, 22, 9, lit ? { top: shade(hotTone, 0.25), left: hotTone, right: shade(hotTone, -0.3) } : { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }))
        const f = iso(21 + b * 30, 23 + a * 32, 51)
        model.push(h('ellipse', { key: `f${a}${b}`, cx: f[0], cy: f[1], rx: 8, ry: 4.6, fill: lit ? shade(hotTone, -0.45) : C.hole }))
      })
      // 每个字段的取值数（或核验一致率）柱
      const fields = Object.entries(run.byField ?? {}).sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))
      const max = Math.max(1, ...fields.map(([, v]) => v.values))
      const peak = fields.find(([, v]) => v.values === max)
      const stateCls = s.state === 'hold' || s.state === 'run' ? 'w' : s.state === 'done' ? 'ok' : ''
      return h('div', { className: 'mx-frame mx-side' },
        h('div', { className: 'mx-side-h' }, h('b', { className: 'mx-num' }, s.no), h('span', {}, s.nm), h('span', { className: `mx-chip ${stateCls}` }, STATE_LABEL[s.state])),
        h('div', { className: 'mx-side-sub' }, s.sub),
        h('svg', { className: 'mx-scene', viewBox: '-74 -74 186 158', style: { maxHeight: 150, margin: '6px 0' } }, model),
        h('div', { className: 'mx-side-big' }, h('span', { className: 'mx-num' }, s.big), h('small', {}, s.unit)),
        s.rows.map(([l, v, cls]) => h('div', { key: l, className: 'mx-kvrow' }, h('span', {}, l), h('b', { className: `mx-num ${cls === 'ok' ? 'mx-ok' : cls === 'warn' ? 'mx-warn' : ''}` }, v))),
        h('div', { className: 'mx-kvrow' }, h('span', {}, '完成'), h('b', { className: 'mx-num' }, `${Math.round((s.frac ?? 0) * 100)}%`)),
        h('div', { className: 'mx-side-sec' }, h('span', {}, `每个字段 · 取到的值`), h('span', { className: 'mx-tl' }, peak ? `峰值 ${peak[0]}` : '')),
        h('div', { className: 'mx-hbars' }, fields.map(([id, v]) => h('i', { key: id, title: `${id}：${fmt(v.values)} 个值，${fmt(v.docs)} 份文书`, className: v.values === max ? 'pk' : v.values > max / 3 ? 'hi' : '', style: { height: `${Math.max(4, v.values / max * 100)}%` } }))),
        h('div', { className: 'mx-side-foot' }, h('span', {}, `${fields.length} / ${run.template.fields} 个字段有值`), h('span', {}, '')))
    }

    function Ticks({ v, n = 46, hot }) {
      const on = Math.round(Math.max(0, Math.min(1, v ?? 0)) * n)
      return h('div', { className: `mx-ticks${hot ? ' hot' : ''}` }, Array.from({ length: n }, (_, i) => h('i', { key: i, className: i < on ? 'on' : '' })))
    }

    function GatesPanel({ run }) {
      const t = run.totals
      const answered = (t.byMethod?.model ?? 0) + (t.byMethod?.['model+rule'] ?? 0) + t.quoteFail
      const gates = run.gates ?? []
      const way = [['规则', t.byMethod?.rule ?? 0, 'var(--fact)'], ['模型', t.byMethod?.model ?? 0, 'var(--vio)'], ['模型＋规则', t.byMethod?.['model+rule'] ?? 0, 'var(--decide)']]
      const wsum = way.reduce((s, x) => s + x[1], 0) || 1
      const rows = gates.length ? gates.map((g) => [g.id, g.label, g.skipped ? '跳过' : g.pass ? '通过' : '未过', g.skipped ? 0 : g.pass ? 1 : 0.4, !g.pass && !g.skipped, g.detail])
        : [['①', '引语与原文逐字一致', answered ? pct(1 - t.quoteFail / answered) : '—', answered ? 1 - t.quoteFail / answered : 0, false, ''], ['②', '值在类型、选项、值域之内', '—', 0, false, ''], ['③', '可回溯原文', '—', 0, false, ''], ['④', '抽样核验一致率', '—', 0, false, '']]
      return h('div', { className: 'mx-frame mx-panel' },
        h('div', { className: 'mx-panel-h' }, h('b', {}, '验收门'), h('span', { className: 'mx-cap' }, 'GATES'), h('span', { className: 'mx-sp' }), h('span', { className: 'mx-live' }, h('i'), `${big(t.documents)} 份`)),
        rows.map(([g, label, txt, v, bad, detail]) => h('div', { key: g, className: 'mx-gl', title: detail },
          h('div', { className: 'mx-gl-h' }, h('span', {}, h('em', {}, g), label), h('b', { className: `mx-num${bad ? ' mx-warn' : ''}` }, txt)), h(Ticks, { v, hot: bad }))),
        h('div', { className: 'mx-gl' },
          h('div', { className: 'mx-gl-h' }, h('span', {}, h('em', {}, '途'), '取值途径'), h('b', { className: 'mx-num', style: { fontSize: 10.5 } }, way.map(([k, v]) => `${k} ${Math.round(v / wsum * 100)}`).join(' · '))),
          h('div', { className: 'mx-stack' }, way.map(([k, v, c]) => h('span', { key: k, style: { width: `${v / wsum * 100}%`, background: c } })))),
        h('div', { className: 'mx-panel-foot' }, run.sourceCheck ? (run.sourceCheck.changed ? h('span', { className: 'mx-warn' }, `⚠ 源文件有 ${run.sourceCheck.changed} 个变化`) : h('span', {}, '◇ 源文件只读核对一致')) : h('span', { className: 'mx-faint' }, '源文件只读核对 —')))
    }

    function FieldsPanel({ run }) {
      const tpl = useAsync(() => call('template', { id: run.template.id }).catch(() => null), [run.template.id])
      const groups = tpl.value?.template?.groups ?? []
      const fields = tpl.value?.template?.fields ?? []
      const filled = run.rollup?.filled ?? {}
      const col = ['var(--teal)', 'var(--fact)', 'var(--line2)']
      const rows = groups.map((g) => {
        let yes = 0; let no = 0; let all = 0
        for (const f of fields.filter((x) => x.group === g.id)) {
          const s = filled[f.id]; if (!s) continue
          all += s.rows
          for (const [k, n] of Object.entries(s.values ?? {})) { if (k === '无' || k === '否') no += n; else if (k && k !== '未提及' && k !== '无法判断') yes += n }
        }
        return { id: g.id, name: g.name, yes, no, all }
      }).filter((r) => r.all)
      return h('div', { className: 'mx-frame mx-panel' },
        h('div', { className: 'mx-panel-h' }, h('b', {}, '字段完成度'), h('span', { className: 'mx-cap' }, 'FIELDS'), h('span', { className: 'mx-sp' }), h('span', { className: 'mx-faint mx-num' }, `${run.template.fields} 字段 × ${big(run.totals.patients)} 人`)),
        !rows.length ? h('div', { className: 'mx-faint' }, run.status === 'running' ? '汇总后显示' : '—')
          : rows.map((r) => h('div', { key: r.id, className: 'mx-fr', title: `${r.name}：有值 ${r.yes}，明确否认 ${r.no}，格子 ${r.all}` },
            h('span', {}, h('em', {}, r.id), r.name),
            h('div', { className: 'mx-stack' }, [r.yes, r.no, r.all - r.yes - r.no].map((x, i) => h('span', { key: i, style: { width: `${Math.max(0, x) / r.all * 100}%`, background: col[i] } }))),
            h('b', {}, `${Math.round((r.yes + r.no) / r.all * 100)}%`))),
        h('div', { className: 'mx-legend' }, ['有值', '明确否认', '未提及／无法判断'].map((k, i) => h('span', { key: k }, h('i', { style: { background: col[i] } }), k))))
    }

    function VerifyPanel({ run }) {
      const v = Object.entries(run.verify ?? {})
      const n = v.reduce((s, [, x]) => s + x.n, 0); const a = v.reduce((s, [, x]) => s + x.agree, 0)
      const thr = 0.9
      const rows = v.filter(([, x]) => x.n >= 3).map(([id, x]) => [id, x.agree / x.n, x.n]).sort((p, q) => p[1] - q[1]).slice(0, 7)
      return h('div', { className: 'mx-frame mx-panel' },
        h('div', { className: 'mx-panel-h' }, h('b', {}, '抽样核验'), h('span', { className: 'mx-cap' }, 'VERIFY'), h('span', { className: 'mx-sp' }), h('span', { className: 'mx-faint mx-num' }, run.model?.verifyModel ?? '未配置核验模型')),
        h('div', { className: 'mx-hero-num' }, h('span', { className: 'mx-num' }, n ? (a / n).toFixed(3) : '—'), h('div', {}, h('small', {}, '总体一致率'), h('small', { className: 'mx-tl' }, `抽样 ${fmt(n)} 次 · 待复核 ${fmt(run.totals.review)}`))),
        rows.map(([id, r, k]) => h('div', { key: id, className: 'mx-ev', title: `${id}：${k} 次` }, h('span', { className: 'mx-muted' }, id), h(Ticks, { v: r, n: 40, hot: r < thr }), h('b', { className: r < thr ? 'mx-warn' : '' }, r.toFixed(2)))),
        h('div', { className: 'mx-panel-foot' }, rows.length ? h('span', {}, '最弱的字段在上；分歧进「复核」，裁定后重跑沿用') : h('span', { className: 'mx-faint' }, '配置核验模型后，按字段抽样背靠背重抽')))
    }

    function AlertsPanel({ run, goto }) {
      const t = run.totals
      const items = []
      if (run.error) items.push(['crit', '批次', '批次出错', run.error.split('\n')[0], null])
      for (const g of run.gates ?? []) if (!g.pass && !g.skipped) items.push(['crit', `门${g.id}`, `验收门${g.id}未过`, g.detail, g.id === '④' ? 'review' : 'report'])
      if (run.sourceCheck?.changed) items.push(['crit', '源文件', `源文件有 ${run.sourceCheck.changed} 个变化`, '只读核对不一致', null])
      if (t.review) items.push(['warn', 'E6', `待复核 ${fmt(t.review)} 项`, '抽样核验分歧', 'review'])
      if (t.conflicts) items.push(['warn', 'E5', `冲突 ${fmt(t.conflicts)} 个格子`, '同一格子互斥取值，不自动选边', 'wide'])
      if (t.quoteFail) items.push(['warn', 'E3', `${fmt(t.quoteFail)} 条模型回答被丢弃`, '引语对不上原文或不支持取值', 'report'])
      for (const w of run.warnings ?? []) items.push(['warn', '提示', w, '', null])
      items.push(run.model ? ['info', '模型', `${run.model.model}${run.model.verifyModel ? ` ＋ ${run.model.verifyModel}` : ''}`, `调用 ${fmt(t.calls)} · 缓存 ${fmt(t.cached)} · 失败 ${fmt(t.failed)}`, 'calls'] : ['info', '模型', '未配置模型：只跑规则', '设置 → 病历文书提取', null])
      if (run.output) items.push(['ok', 'E7', '已交付', run.output.split('/').slice(-2).join('/'), 'wide'])
      const crit = items.filter((x) => x[0] === 'crit').length
      const tag = { crit: 'CRIT', warn: 'WARN', info: 'INFO', ok: 'OK' }
      const level = { crit: 1, warn: 0.75, info: 0.4, ok: 0.15 }
      return h('div', { className: 'mx-frame mx-panel' },
        h('div', { className: 'mx-panel-h' }, h('b', {}, '提醒'), h('span', { className: 'mx-cap' }, 'ALERTS'), h('span', { className: 'mx-sp' }), h('span', { className: 'mx-faint mx-num' }, `${items.length} 条`), crit ? h('span', { className: 'mx-bad mx-num' }, ` · ${crit} CRIT`) : null),
        h('div', { className: 'mx-alerts' }, items.slice(0, 7).map(([lv, src, title, sub, to], i) => h('div', { key: i, className: `mx-al ${lv}${to ? ' click' : ''}`, onClick: to ? () => goto(to) : undefined },
          h('span', { className: 'mx-al-bar' }), h('span', { className: 'mx-al-src mx-num' }, src),
          h('div', { className: 'mx-al-t' }, h('b', {}, title), sub ? h('small', {}, sub) : null),
          h(Ticks, { v: level[lv], n: 12, hot: lv === 'crit' || lv === 'warn' }),
          h('span', { className: 'mx-al-tag' }, tag[lv])))))
    }

    /* -------------------------------------------------------------- template */
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
      const groupName = Object.fromEntries((t?.groups ?? []).map((g) => [g.id, g.name]))
      return h('div', { className: 'mx-split' },
        h('div', { className: 'mx-frame mx-scroll mx-pad' },
          h('div', { className: 'mx-h' }, h('b', {}, '模板库'), h('span', { className: 'mx-cap' }, 'TEMPLATES')),
          (list.value?.templates ?? []).map((x) => h('div', { key: x.id, className: `mx-pi${x.id === id ? ' on' : ''}`, onClick: () => { setSel(x.id); setState('') } },
            h('b', {}, x.name), h('span', {}, `${x.fields} 字段`), h('span', { style: { gridColumn: '1 / 3' } }, `${x.id} v${x.version} · ${x.origin === 'builtin' ? '插件自带样例' : '用户模板'}`))),
          h('div', { className: 'mx-faint', style: { marginTop: 12, fontSize: 11.5, lineHeight: 1.7 } }, '模板是插件唯一的"病种知识"入口：字段清单、定义、召回词、规则、取值规则、粒度、值域。格式见 docs/template.md。改好后在右侧「JSON」里保存到模板库（同 id 覆盖），新批次即可选用。')),
        h('div', { className: 'mx-frame mx-col', style: { minWidth: 0 } },
          !t ? h('div', { className: 'mx-empty' }, d.error ?? '加载中…') : h(React.Fragment, {},
            h('div', { className: 'mx-pad', style: { borderBottom: '1px solid var(--line)' } },
              h('div', { className: 'mx-h' }, h('b', {}, t.name), h('span', { className: 'mx-cap' }, `${t.id} v${t.version}`), d.value.problems?.length ? h('span', { className: 'mx-chip b' }, `${d.value.problems.length} 个问题`) : h('span', { className: 'mx-chip ok' }, '校验通过')),
              h('div', { className: 'mx-muted', style: { fontSize: 12 } }, t.description),
              h('div', { style: { display: 'flex', gap: 4, marginTop: 8 } }, [['fields', `字段 ${t.fields.length}`], ['json', 'JSON（编辑、另存）']].map(([k, l]) => h('button', { key: k, className: `mx-btn sm${view === k ? ' on' : ''}`, onClick: () => setView(k) }, l)))),
            view === 'fields' ? h('div', { className: 'mx-scroll', style: { flex: 1 } }, h('table', {},
              h('thead', {}, h('tr', {}, ['字段', '名称', '组', '优先级', '类型', '粒度', '模型', '定义', '召回／规则'].map((x) => h('th', { key: x }, x)))),
              h('tbody', {}, t.fields.map((f) => h('tr', { key: f.id },
                h('td', { className: 'mx-num' }, f.id), h('td', {}, f.name), h('td', { className: 'mx-faint' }, groupName[f.group] ?? f.group ?? ''), h('td', {}, h('span', { className: `mx-chip ${f.priority === 'P0' ? 'v' : ''}` }, f.priority ?? 'P1')),
                h('td', {}, f.type), h('td', { className: 'mx-faint' }, f.granularity ?? 'encounter'), h('td', { className: 'mx-faint' }, f.model ?? 'auto'),
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
              h('div', {}, h('div', { className: 'mx-faint' }, '核验模型'), h('b', {}, it.verify), it.verifyValues.slice(0, 4).map((x, i) => h('div', { key: i, className: 'mx-faint' }, `「${x.quote}」 ${x.assertion}`)))),
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
          outputRoot: form.outputRoot ?? '', template: form.template || 'mdd', extractMode: form.extractMode || 'hybrid', priorities: String(form.priorities ?? '').split(/[,，\s]+/).filter(Boolean), mapping,
          modelEnabled: form.modelEnabled !== false, baseURL: form.baseURL ?? '', model: form.model ?? '', verifyBaseURL: form.verifyBaseURL ?? '', verifyModel: form.verifyModel ?? '', disableThinking: form.disableThinking !== false,
          timeoutMs: num('timeoutMs', 120000), modelConcurrency: num('modelConcurrency', 8), workers: num('workers', 0), shardUnits: num('shardUnits', 20),
          verifySampleRate: num('verifySampleRate', 0.02), verifyMinPerField: num('verifyMinPerField', 2), verifyThreshold: num('verifyThreshold', 0.9), showSidebarEntry: form.showSidebarEntry !== false,
        }
        if (form.apiKey) patch.apiKey = form.apiKey
        try { await call('saveDefaults', patch); setState('已保存（插件会重新加载）') } catch (e) { setState(msg(e)) }
      }
      return h('div', { className: 'mx-settings' }, h('style', {}, CSS),
        inModal ? null : h('p', { style: { margin: 0, color: 'var(--dsw-alias-label-secondary)' } }, '这里只放配置。运行批次、看宽表与复核，请到左侧栏的「病历文书提取」，或在聊天框使用 /extract。'),
        h('h3', { style: { margin: '6px 0 0' } }, '抽取'),
        h('div', { className: 'mx-grid2' },
          field('template', '默认模板 id'),
          h('label', { className: 'mx-field' }, '模式', h('select', { className: 'mx-input', value: form.extractMode ?? 'hybrid', onChange: (e) => setForm({ ...form, extractMode: e.target.value }) }, Object.entries(MODE_LABEL).map(([k, l]) => h('option', { key: k, value: k }, l)))),
          field('priorities', '只抽这些优先级（逗号分隔；空＝全部）'), field('mapping', '通用文件字段映射（JSON；空＝自动识别）', { placeholder: '{"text":"content","patient":"patient_id"}' })),
        h('h3', { style: { margin: '6px 0 0' } }, '模型'),
        h('p', { style: { margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, '规则定不了的片段送抽取模型；核验模型按字段抽样背靠背重抽。病历内容只发往这里配置的端点，Agent 不能更改。'),
        check('modelEnabled', '启用模型'),
        h('div', { className: 'mx-grid2' }, field('baseURL', '抽取模型端点（OpenAI 兼容）', { placeholder: 'http://127.0.0.1:11434/v1' }), field('model', '抽取模型'),
          field('verifyBaseURL', '核验模型端点（空＝同上）'), field('verifyModel', '核验模型（空＝不做抽样核验）'),
          field('apiKey', 'API Key（留空不修改）', { type: 'password' }), field('timeoutMs', '单次调用超时（毫秒）'),
          field('modelConcurrency', '全局同时进行的模型请求数'), field('verifySampleRate', '核验抽样比例（0–1）'),
          field('verifyMinPerField', '每字段每分片至少核验几份'), field('verifyThreshold', '验收门④一致率阈值')),
        check('disableThinking', '关闭思考模式（推理模型更快）'),
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
