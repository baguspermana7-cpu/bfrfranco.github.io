/*
 * equipment-modal.js — window.RZConvModal: the ONE deep equipment modal of the Conventional HMI sheets
 * (CONV_EXECUTION_PLAN_2026-11-16 AD5). It renders a payload from js/conv/payloads.js:
 *   identity · mini-mimic (the drawn symbol, cloned from the sheet) · readings (traced) · trend · guidance ·
 *   design basis · configured alarm points · maintenance.
 *
 *   open(payload, { trigger, symbol, rebuild, period })
 *       trigger  element that gets focus back on close
 *       symbol   the sheet's .hmi-node <g> (cloned into the mimic; never moved)
 *       rebuild  () -> a fresh payload; called every `period` ms (default 4000) while open
 *       internal (v2, PRD-CONV-EQUIPMENT-TRUTH §4) { classKey, unit, fleet(), snapshot(), payloadFor(i) }
 *                when js/conv/internals.js has an internal sheet for classKey, the modal shows: a unit navigator and a
 *                fleet strip over fleet() (one cell per unit), the INSIDE of the selected unit drawn by RZHmiSheet and
 *                coloured by RZConvVfx, the block detail of the selected internal block, then the sections of
 *                payloadFor(i) (the plant-sheet payload of that unit, or null when the plant sheet does not draw it).
 *                Without it, or for a class with no internal sheet, the modal is exactly the v1 modal.
 *                internal.fleetOnly (E3) { classKey, title, unit, fleet(), rows(unit) -> [[label, text]], payloadFor(i) }:
 *                a class whose inside is not drawn yet (CRAH, tower cell, condenser pump) still gets the unit navigator,
 *                the fleet strip and the unit's fleet row; no internal drawing, no block detail.
 *   close()    closes; clears its timer; un-inerts the page; focus returns to the trigger
 *   isOpen(), timers() -> number of live timers (0 when closed; a gate reads it)
 *
 * Every value cell carries data-basis-param (engine, evidence dot, click -> basis drawer) or
 * data-rz-authored-basis (+ data-rz-sim and a visible SIM mark for seeded values). Nothing here computes a number.
 */
(function (root) {
  'use strict';
  if (!root || !root.document) return;
  var doc = root.document, el = null, timer = null, lastTrigger = null, inerted = [], current = null, opts = null, IN = null;

  var CSS = '' +
    '.rz-cvm{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,6,8,.62)}' +
    '.rz-cvm[hidden]{display:none}' +
    '.rz-cvm-panel{--cvm-bg:#121316;--cvm-panel:#191b1f;--cvm-line:rgba(255,255,255,.12);--cvm-text:#e8edf5;--cvm-mute:#9aa4b2;--cvm-acc:#E8B563;' +
      'background:var(--cvm-bg);color:var(--cvm-text);border:1px solid var(--cvm-line);border-radius:4px;width:min(960px,100%);max-height:calc(100vh - 32px);overflow:auto;' +
      'font:13px/1.45 IBM Plex Sans,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5)}' +
    '[data-theme="light"] .rz-cvm-panel{--cvm-bg:#ffffff;--cvm-panel:#f5f7fa;--cvm-line:rgba(15,23,42,.14);--cvm-text:#1b2430;--cvm-mute:#4b5563;--cvm-acc:#7A4800}' +
    '.rz-cvm-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--cvm-line);position:sticky;top:0;background:var(--cvm-bg);z-index:1}' +
    '.rz-cvm-kind{font:600 10.5px/1.3 JetBrains Mono,monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--cvm-mute)}' +
    '.rz-cvm-title{margin:2px 0 0;font-size:17px;font-weight:600}' +
    '.rz-cvm-role{margin:2px 0 0;color:var(--cvm-mute)}' +
    '.rz-cvm-chip{display:inline-block;margin-top:6px;padding:1px 8px;border:1px solid var(--cvm-line);border-radius:999px;font:600 10px/1.6 JetBrains Mono,monospace}' +
    '.rz-cvm-chip.is-alarm{color:#fca5a5;border-color:rgba(252,165,165,.55)}.rz-cvm-chip.is-warning{color:#fbbf24;border-color:rgba(251,191,36,.5)}' +
    '[data-theme="light"] .rz-cvm-chip.is-alarm{color:#991b1b}[data-theme="light"] .rz-cvm-chip.is-warning{color:#7A4800}' +
    '.rz-cvm-close{flex:none;min-width:44px;min-height:44px;border:1px solid var(--cvm-line);background:transparent;color:var(--cvm-text);border-radius:4px;cursor:pointer;font-size:18px}' +
    '.rz-cvm-close:focus-visible,.rz-cvm-v[data-basis-param]:focus-visible{outline:2px solid var(--cvm-acc);outline-offset:2px}' +
    '.rz-cvm-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;padding:14px 16px}' +
    '@media (max-width:720px){.rz-cvm-grid{grid-template-columns:minmax(0,1fr)}}' +
    '.rz-cvm-sec{background:var(--cvm-panel);border:1px solid var(--cvm-line);border-radius:4px;padding:10px 12px;min-width:0}' +
    '.rz-cvm-sec h3{margin:0 0 6px;font:600 10.5px/1.3 IBM Plex Sans,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--cvm-mute)}' +
    '.rz-cvm-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:3px 0;border-bottom:1px dashed var(--cvm-line)}.rz-cvm-row:last-child{border-bottom:0}' +
    '.rz-cvm-k{color:var(--cvm-mute);min-width:0}.rz-cvm-v{font-family:JetBrains Mono,monospace;text-align:right;overflow-wrap:anywhere}' +
    '.rz-cvm-v[data-basis-param],.rz-cvm-v[data-trend]{cursor:pointer;text-decoration:underline dotted}' +
    '.rz-cvm-v[data-basis-param]::after,.rz-cvm-v[data-rz-authored-basis]::after{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:6px;vertical-align:middle;background:var(--rz-ev,#8fa2b8)}' +
    '.rz-cvm-v[data-rz-sim]::before{content:"SIM";display:inline-block;margin-right:6px;padding:0 3px;border:1px solid rgba(176,103,143,.75);border-radius:2px;font:600 9px/1.4 JetBrains Mono,monospace;color:#e3a6c6;vertical-align:1px}' +
    '[data-theme="light"] .rz-cvm-v[data-rz-sim]::before{color:#7d2d59}' +
    '.rz-cvm-mimic svg{display:block;width:100%;height:170px}' +
    '.rz-cvm-trend svg{display:block;width:100%;height:90px}.rz-cvm-trend .ln{fill:none;stroke:#7dd3fc;stroke-width:1.4}.rz-cvm-trend .ref{stroke:var(--cvm-mute);stroke-dasharray:4 4}' +
    '[data-theme="light"] .rz-cvm-trend .ln{stroke:#0e6d8f}' +
    '.rz-cvm-note{margin:6px 0 0;color:var(--cvm-mute);font-size:11.5px}' +
    '.rz-cvm-guide{margin:0}' +
    '.rz-cvm-wide{grid-column:1/-1}' +
    /* v2: internal drawing, unit navigator, fleet strip, block detail — type 11/13/14/16, spacing on the 4 px grid */
    '.rz-cvm-panel.is-int{width:min(1240px,100%)}' +
    '.rz-cvm-head .rz-cvm-tools{display:flex;align-items:center;gap:8px;flex:none}' +
    '.rz-cvm-nav{display:inline-flex;align-items:center;gap:4px}' +
    '.rz-cvm-nav button,.rz-cvm-cell{border:1px solid var(--cvm-line);background:transparent;color:var(--cvm-text);border-radius:4px;cursor:pointer;font:600 13px/1 JetBrains Mono,monospace}' +
    '.rz-cvm-nav button{min-width:44px;min-height:44px}' +
    '.rz-cvm-nav-n{min-width:88px;text-align:center;font:600 13px/1 JetBrains Mono,monospace}' +
    '.rz-cvm-nav button:focus-visible,.rz-cvm-cell:focus-visible,.rz-cvm-bsel:focus-visible{outline:2px solid var(--cvm-acc);outline-offset:2px}' +
    '.rz-cvm-fleet{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:4px;padding:12px 16px 0}' +
    '.rz-cvm-cell{min-height:44px;display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:4px;padding:4px 8px;font-size:11px;text-align:left}' +
    '.rz-cvm-cell[aria-pressed="true"]{border-color:var(--cvm-acc);box-shadow:inset 0 -2px 0 var(--cvm-acc)}' +
    '.rz-cvm-cell-row{display:flex;justify-content:space-between;gap:4px}.rz-cvm-cell-st{font-weight:400;color:var(--cvm-mute)}' +
    '.rz-cvm-cell-bar{display:block;height:4px;background:var(--vfx-stop,#8b93a1)}' +
    '.rz-cvm-cell[data-vstate="running"] .rz-cvm-cell-bar{background:var(--vfx-run,#3fb950)}' +
    '.rz-cvm-cell[data-vstate="standby"] .rz-cvm-cell-bar{background:repeating-linear-gradient(90deg,var(--vfx-stby,#7fa6b8) 0 8px,transparent 8px 12px)}' +
    '.rz-cvm-cell[data-vstate="alarm"] .rz-cvm-cell-bar{background:repeating-linear-gradient(90deg,var(--vfx-alarm,#f85149) 0 7px,transparent 7px 9px)}' +
    '.rz-cvm-cell[data-vstate="stopped"] .rz-cvm-cell-bar{background:repeating-linear-gradient(90deg,var(--vfx-stop,#8b93a1) 0 4px,transparent 4px 8px)}' +
    '.rz-cvm-int{display:grid;grid-template-columns:minmax(0,62fr) minmax(0,38fr);gap:12px;padding:12px 16px 0}' +
    '@media (max-width:900px){.rz-cvm-int{grid-template-columns:minmax(0,1fr)}}' +
    '.rz-cvm-cycle{padding:12px 16px 0}' +
    '.rz-cvm-int.rz-cvm-int-fleet{grid-template-columns:minmax(0,1fr)}' +
    '@media (max-width:640px){.rz-cvm-panel.is-int .rz-cvm-head{flex-wrap:wrap;position:static}.rz-cvm-panel.is-int .rz-cvm-head > div:first-child{flex:1 1 100%}' +
      '.rz-cvm-panel.is-int .rz-cvm-tools{flex:1 1 100%;justify-content:space-between}}' +
    '.rz-cvm-int-host .hmi-frame{border-radius:4px}' +
    /* the shared canvas gradient lives in one <defs> under <body> and takes the ROOT theme; the drawing here takes the
       modal's theme, so its ground is the flat token of that theme (label halos are drawn in the same token) */
    '.rz-cvm-int-host .hmi-frame .hmi-svg .hmi-canvas{fill:var(--hmi-bg)}' +
    '.rz-cvm-int-host .hmi-svg [data-role="tag"]{font-size:12px}' +
    '.rz-cvm-int-host .hmi-svg [data-role="value"],.rz-cvm-int-host .hmi-svg [data-role="line"],.rz-cvm-int-host .hmi-svg [data-role="name"],.rz-cvm-int-host .hmi-svg [data-role="label"]{font-size:12px}' +
    '.rz-cvm-int-host .hmi-svg .hmi-node.is-selected .b{stroke-width:3px}' +
    '.rz-cvm-media{display:flex;flex-wrap:wrap;gap:4px 12px;margin:8px 0 0;color:var(--cvm-mute);font-size:11px}' +
    '.rz-cvm-media span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}' +
    '.rz-cvm-media i{display:inline-block;width:20px;height:4px;background:var(--sw)}' +
    '.rz-cvm-bd-name{margin:0;font-size:16px;font-weight:600}' +
    '.rz-cvm-bd-std{margin:4px 0 0;color:var(--cvm-mute);font:400 11px/1.4 JetBrains Mono,monospace}' +
    '.rz-cvm-bd-role{margin:8px 0;font-size:13px}' +
    '.rz-cvm-bsel{width:100%;min-height:44px;margin:0 0 8px;padding:0 8px;border:1px solid var(--cvm-line);border-radius:4px;background:var(--cvm-bg);color:var(--cvm-text);font:400 13px IBM Plex Sans,system-ui,sans-serif}' +
    '.rz-cvm-v.is-nm{color:var(--cvm-mute);font-style:italic}' +
    '.rz-cvm-lower-note{margin:12px 16px 0;color:var(--cvm-mute);font-size:13px}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function css() {
    if (doc.getElementById('rz-cvm-css')) return;
    var st = doc.createElement('style'); st.id = 'rz-cvm-css'; st.textContent = CSS; doc.head.appendChild(st);
  }
  function ev(id) { return root.RZSvgBasis ? root.RZSvgBasis.evidenceOf(id) : 'DERIVED'; }
  function evColor(cls) { return root.RZEvidence ? root.RZEvidence.color(cls) : '#8fa2b8'; }
  function trendAttr(r) {
    if (!r.trend || !root.RZTrend) return '';
    root.RZTrend.register([r.trend]);
    /* PRD-CONV-POINT-STATUS-TREND T3: a row with a trend is a point — RZPointStatus colours it from the registry limits of
       its id (Informational, page ink, when the id has none) and writes its state into aria-label and the tooltip */
    return ' data-trend="' + esc(r.trend.id) + '"' + (root.RZPointStatus ? ' data-point="' + esc(r.trend.id) + '" data-pt-label="' + esc(r.trend.label || r.label) + '"' : '') +
      ' tabindex="0" role="button" aria-label="' + esc(r.label + ': open trend') + '"';
  }
  function cell(r) {
    var a;
    if (r.basis) a = ' data-basis-param="' + esc(r.basis) + '" tabindex="0" role="button" style="--rz-ev:' + evColor(ev(r.basis)) + '" title="' + esc(r.basis + ' · ' + ev(r.basis) + ' — open the basis') + '"';
    else a = ' data-rz-authored-basis="' + esc(r.declared || '') + '"' + (r.sim ? ' data-rz-sim="1"' : '') + trendAttr(r) + ' style="--rz-ev:' + (r.sim ? '#b0678f' : '#8fa2b8') + '"' + (r.trend && root.RZPointStatus ? '' : ' title="' + esc(r.declared || '') + '"');
    return '<span class="rz-cvm-v' + (r.nm ? ' is-nm' : '') + '"' + a + '>' + esc(r.text) + (r.unit ? ' ' + esc(r.unit) : '') + '</span>';
  }
  function rows(list) {
    return (list || []).map(function (r) { return '<div class="rz-cvm-row"><span class="rz-cvm-k">' + esc(r.label) + '</span>' + cell(r) + '</div>'; }).join('');
  }
  function sec(title, inner, cls) { return '<section class="rz-cvm-sec' + (cls ? ' ' + cls : '') + '"><h3>' + esc(title) + '</h3>' + inner + '</section>'; }
  function trendSvg(t) {
    var s = t.series || [], n = s.length; if (n < 2) return '';
    var mn = Math.min.apply(null, s.concat([t.ref])), mx = Math.max.apply(null, s.concat([t.ref])), sp = (mx - mn) || 1;
    var y = function (v) { return (84 - (v - mn) / sp * 76).toFixed(2); };
    var pts = s.map(function (v, i) { return (i / (n - 1) * 300).toFixed(1) + ',' + y(v); }).join(' ');
    return '<svg viewBox="0 0 300 90" preserveAspectRatio="none" role="img" aria-label="' + esc(t.label + ', 60 simulated ticks, dashed line ' + (t.rows && t.rows[0] ? t.rows[0].label : 'reference')) + '">' +
      '<line class="ref" x1="0" x2="300" y1="' + y(t.ref) + '" y2="' + y(t.ref) + '" vector-effect="non-scaling-stroke"/>' +
      '<polyline class="ln" points="' + pts + '" vector-effect="non-scaling-stroke"/></svg>';
  }
  /* the mini-mimic: a clone of the drawn symbol, framed on its own box; live tags follow the sheet on refresh */
  function mimic(sym) {
    if (!sym || !sym.getBBox) return '<p class="rz-cvm-note">No drawing for this item.</p>';
    var bb; try { bb = sym.getBBox(); } catch (e) { bb = null; }
    if (!bb || !bb.width) return '<p class="rz-cvm-note">No drawing for this item.</p>';
    var pad = 10, clone = sym.cloneNode(true);
    clone.removeAttribute('tabindex'); clone.removeAttribute('role'); clone.setAttribute('aria-hidden', 'true');
    var svg = sym.ownerSVGElement, cls = svg ? (svg.getAttribute('class') || '') : '';
    return '<svg class="' + esc(cls) + '" viewBox="' + [bb.x - pad, bb.y - pad, bb.width + 2 * pad, bb.height + 2 * pad].join(' ') + '" role="img" aria-label="Drawn symbol">' +
      new root.XMLSerializer().serializeToString(clone) + '</svg>';
  }
  function body(p) {
    var t = p.tabs;
    var role = (t.live.filter(function (r) { return r.label === 'Role'; })[0] || {}).text || '';
    return '' +
      '<div class="rz-cvm-head"><div><div class="rz-cvm-kind">' + esc(p.kind) + ' · ' + esc(p.label) + '</div>' +
        '<h2 class="rz-cvm-title" id="rz-cvm-title">' + esc(p.title) + '</h2><p class="rz-cvm-role">' + esc(role) + '</p>' +
        '<span class="rz-cvm-chip is-' + esc(p.statusChip.state) + '">' + esc(p.statusChip.label) + '</span></div>' +
        '<button type="button" class="rz-cvm-close" aria-label="Close equipment detail">×</button></div>' +
      '<div class="rz-cvm-grid">' + sections(p, true) + '</div>' + provenance(p);
  }
  function provenance(p) {
    return '<p class="rz-cvm-note" style="padding:0 16px 14px">engine ' + esc(p.provenance.engineVersion) + ' · tick ' + esc(p.provenance.tick) + ' · ' + esc(p.provenance.counts.derived) + ' engine · ' + esc(p.provenance.counts.simulated) + ' simulated · ' + esc(p.provenance.counts.state) + ' declared</p>';
  }
  /* the payload sections; v1 opens with the drawn symbol, v2 (internal drawing above) leaves it out (P-1) */
  function sections(p, withMimic) {
    var t = p.tabs, live = t.live.filter(function (r) { return r.label !== 'Role'; });
    var trend = t.trend;
    return '' +
        (withMimic ? sec('Drawing', '<div class="rz-cvm-mimic" data-rz-cvm-mimic></div>') : '') +
        sec('Readings', rows(live)) +
        sec('Trend', trend ? '<div class="rz-cvm-trend">' + trendSvg(trend) + '</div>' + rows(trend.rows) + '<p class="rz-cvm-note">' + esc(trend.declared) + '</p>' : '<p class="rz-cvm-note">No trend point for this class.</p>') +
        sec('Design basis', rows(t.capacity)) +
        sec('Operator guidance', '<p class="rz-cvm-guide">' + esc(p.guidance) + '</p>') +
        sec('Alarms', (t.alarms.length ? t.alarms.map(function (a) { return '<div class="rz-cvm-row"><span class="rz-cvm-k">' + esc(a.severity + ' · ' + a.lifecycle) + '</span><span class="rz-cvm-v" data-rz-authored-basis="simulated alarm record from the sheet’s stage machine, never a field event" data-rz-sim="1">' + esc(a.message) + '</span></div>'; }).join('') : '<p class="rz-cvm-note">No active alarm.</p>') + rows(t.alarmPoints)) +
        sec('Maintenance', rows(t.maint), 'rz-cvm-wide');
  }
  function focusables() {
    return Array.prototype.slice.call(el.querySelectorAll('button,select,[tabindex="0"],a[href]')).filter(function (x) { return x.offsetParent !== null; });
  }
  function onKey(e) {
    if (!el || el.hidden) return;
    if (root.RZTrend && root.RZTrend.isOpen()) return;   /* the trend modal sits above this one and owns the keyboard */
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (IN && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target && e.target.closest && e.target.closest('.rz-cvm-nav,.rz-cvm-fleet')) {
      e.preventDefault(); step(e.key === 'ArrowLeft' ? -1 : 1); return;
    }
    if (e.key === 'Tab') {
      var f = focusables(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!el.contains(doc.activeElement)) { e.preventDefault(); first.focus(); }
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('data-basis-param')) { e.preventDefault(); basis(e.target); }
  }
  function basis(t) {
    var id = t.getAttribute('data-basis-param');
    if (root.RZBasisDrawer && typeof root.RZBasisDrawer.open === 'function') { close(); root.RZBasisDrawer.open(id); }
  }
  function points() { if (root.RZPointStatus && el) root.RZPointStatus.bindAll(el.querySelector('.rz-cvm-panel') || el); }
  function render() {
    if (IN) { renderInt(); return; }
    var scroller = el.querySelector('.rz-cvm-panel'), top = scroller ? scroller.scrollTop : 0;
    var focusedBasis = doc.activeElement && el.contains(doc.activeElement) ? doc.activeElement.getAttribute('data-basis-param') : null;
    var focusedTrend = doc.activeElement && el.contains(doc.activeElement) ? doc.activeElement.getAttribute('data-trend') : null;   /* a point row keeps focus across a repaint */
    var closeHad = doc.activeElement && doc.activeElement.classList && doc.activeElement.classList.contains('rz-cvm-close');
    el.querySelector('.rz-cvm-panel').classList.remove('is-int');
    el.querySelector('.rz-cvm-panel').innerHTML = body(current);
    el.querySelector('[data-rz-cvm-mimic]').innerHTML = mimic(opts.symbol);
    el.querySelector('.rz-cvm-panel').scrollTop = top;
    el.querySelector('.rz-cvm-close').addEventListener('click', close);
    if (closeHad) el.querySelector('.rz-cvm-close').focus();
    else if (focusedBasis) { var again = el.querySelector('[data-basis-param="' + focusedBasis + '"]'); if (again) again.focus(); }
    else if (focusedTrend) { var againT = el.querySelector('[data-trend="' + focusedTrend.replace(/"/g, '') + '"]'); if (againT) againT.focus(); }
    points();
  }

  /* ── v2: the inside of the machine (js/conv/internals.js) ─────────────────────────────────────────────────── */
  function intOn() {
    var I = opts && opts.internal, R = root.RZConvInternals;
    if (I && I.fleetOnly) return typeof I.fleet === 'function' && typeof I.rows === 'function' && (I.fleet() || []).length > 0;
    return !!(I && R && R.has(I.classKey) && root.RZHmiSheet && typeof I.fleet === 'function' && (I.fleet() || []).length);
  }
  function pctText(v) { var R = R_(); return R ? R.text(v, 'pct') : (typeof v === 'number' && isFinite(v) ? v.toFixed(1) + ' %' : '—'); }
  function titleOf() { return IN.fleetOnly ? opts.internal.title : R_().get(opts.internal.classKey).title; }
  function R_() { return root.RZConvInternals; }
  function unitNo(u, i) { var m = /(\d+)$/.exec((u && u.tag) || ''); return m ? m[1] : ('0' + (i + 1)).slice(-2); }
  function vstateOf(u) { var s = u && u.state; return s === 'running' ? 'running' : s === 'standby' ? 'standby' : (s === 'fault' || s === 'trip') ? 'alarm' : 'stopped'; }
  function wordOf(u) { var s = (u && u.state) || ''; return s === 'running' ? 'RUN' : s === 'standby' ? 'STBY' : s.toUpperCase() || '—'; }
  function readFleet() {
    var I = opts.internal, R = R_();
    IN.fleet = I.fleet() || [];
    if (IN.i >= IN.fleet.length) IN.i = IN.fleet.length - 1;
    IN.unit = IN.fleet[IN.i]; IN.snap = (typeof I.snapshot === 'function' ? I.snapshot() : null) || {};
    IN.read = IN.fleetOnly ? null : R.read(I.classKey, IN.unit, IN.snap);
  }
  function intTop() {
    var u = IN.unit, n = IN.fleet.length, vs = vstateOf(u), title = titleOf();
    var chip = vs === 'alarm' ? 'is-alarm' : 'is-normal';
    return '<div class="rz-cvm-head"><div><div class="rz-cvm-kind">' + esc(title) + ' · ' + esc(opts.internal.scope || (current && current.label) || '') + '</div>' +
        '<h2 class="rz-cvm-title" id="rz-cvm-title">' + esc(u.tag + ' — ' + title) + '</h2>' +
        '<span class="rz-cvm-chip ' + chip + '" data-rz-cvm-state="' + esc(u.state) + '">' + esc(String(u.state).toUpperCase() + ' · LOAD ' + pctText(u.loadPct)) + '</span></div>' +
        '<div class="rz-cvm-tools"><div class="rz-cvm-nav" role="group" aria-label="Unit navigator: ' + n + ' units">' +
          '<button type="button" data-nav="-1" aria-label="Previous unit">◂</button>' +
          '<span class="rz-cvm-nav-n" aria-live="polite" data-rz-cvm-navn>' + esc(unitNo(u, IN.i)) + ' of ' + n + '</span>' +
          '<button type="button" data-nav="1" aria-label="Next unit">▸</button></div>' +
        '<button type="button" class="rz-cvm-close" aria-label="Close equipment detail">×</button></div></div>' +
      '<div class="rz-cvm-fleet" role="group" aria-label="Fleet: ' + n + ' units, one cell per unit">' + IN.fleet.map(function (f, i) {
        var load = pctText(f.loadPct);
        return '<button type="button" class="rz-cvm-cell" data-unit="' + i + '" data-vstate="' + vstateOf(f) + '" aria-pressed="' + (i === IN.i ? 'true' : 'false') + '"' +
          ' aria-label="' + esc(f.tag + ', ' + f.state + ', load ' + load) + '">' +
          '<span class="rz-cvm-cell-row"><span>' + esc(unitNo(f, i)) + '</span><span class="rz-cvm-cell-st">' + esc(wordOf(f)) + '</span></span>' +
          '<i class="rz-cvm-cell-bar" aria-hidden="true"></i><span>' + esc(load) + '</span></button>';
      }).join('') + '</div>';
  }
  function intDetail() {
    if (IN.fleetOnly) {
      return '<p class="rz-cvm-bd-std">' + esc(IN.unit.tag) + ' · fleet row of CONV_CALC.getFleet(\'' + esc(opts.internal.classKey) + '\') · engine ' + esc((IN.snap.meta && IN.snap.meta.version) || '—') + '</p>' +
        (opts.internal.rows(IN.unit) || []).map(function (r) {
          /* every fleet value is traced to its engine row (equipment-modal Q7) */
          var basis = 'CONV_CALC.getFleet(\'' + opts.internal.classKey + '\') · ' + IN.unit.tag + ' · ' + r[0];
          return '<div class="rz-cvm-row"><span class="rz-cvm-k">' + esc(r[0]) + '</span><span class="rz-cvm-v" data-rz-authored-basis="' + esc(basis) + '">' + esc(r[1]) + '</span></div>'; }).join('') +
        '<p class="rz-cvm-note">The inside of this class is not drawn yet (PRD-CONV-EQUIPMENT-TRUTH phase E4); every value above is the engine\'s row for this unit.</p>';
    }
    var R = R_(), I = opts.internal, def = R.get(I.classKey), d = R.detail(I.classKey, IN.block, IN.unit, IN.snap);
    var sel = '<select class="rz-cvm-bsel" data-rz-cvm-bsel aria-label="Internal block of ' + esc(IN.unit.tag) + '">' + def.blocks.map(function (b) {
      return '<option value="' + esc(b.id) + '"' + (b.id === IN.block ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '</select>';
    if (!d) return sel;
    return sel + '<h4 class="rz-cvm-bd-name" data-rz-cvm-block="' + esc(d.id) + '">' + esc(d.name) + '</h4>' +
      '<p class="rz-cvm-bd-std">' + esc(d.standard) + ' · ' + esc(d.state ? String(d.state).toUpperCase() : 'no state modelled') + '</p>' +
      '<p class="rz-cvm-bd-role">' + d.role.map(esc).join('<br>') + '</p>' +
      d.rows.map(function (r) { return '<div class="rz-cvm-row"><span class="rz-cvm-k">' + esc(r.label) + '</span>' + cell({ basis: r.basis, declared: r.declared, text: r.text, nm: r.nm }) + '</div>'; }).join('');
  }
  function intLower() {
    var I = opts.internal, p = typeof I.payloadFor === 'function' ? I.payloadFor(IN.i) : (IN.i === Number(I.unit) ? current : null);
    var src = '<p class="rz-cvm-note" style="padding:0 16px 14px">' + (IN.fleetOnly ? 'Unit' : 'Internal drawing') + ': engine ' + esc((IN.snap.meta && IN.snap.meta.version) || '—') +
      ' fleet row ' + esc(IN.unit.tag) + ' and plant cooling values; a value the engine does not model reads “not modelled”.</p>';
    if (!p) return '<p class="rz-cvm-lower-note">' + esc(IN.unit.tag) + ' has no symbol on the plant drawing yet, so it has no plant-sheet readings; its values are the engine fleet row shown above.</p>' + src;
    return '<div class="rz-cvm-grid">' + sections(p, false) + '</div>' + provenance(p) + src;
  }
  function mediaKey(def) {
    return (def.media || []).map(function (m) { return '<span><i style="--sw:var(--hmi-m-' + esc(m[0].replace(/_/g, '-')) + ')" aria-hidden="true"></i>' + esc(m[1]) + '</span>'; }).join('');
  }
  /* focus survives a re-render: the element is found again by what it is, not by reference */
  function focusKey() {
    var a = doc.activeElement; if (!a || !el.contains(a)) return null;
    var k = ['data-nav', 'data-unit', 'data-rz-cvm-bsel', 'data-basis-param', 'data-trend', 'data-node'];
    for (var i = 0; i < k.length; i++) if (a.hasAttribute(k[i])) return '[' + k[i] + '="' + (a.getAttribute(k[i]) || '').replace(/"/g, '') + '"]';
    return a.classList && a.classList.contains('rz-cvm-close') ? '.rz-cvm-close' : null;
  }
  function refocus(k) { if (!k) return; var t = el.querySelector(k); if (t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } } }
  function renderInt() {
    var R = R_(), I = opts.internal, panel = el.querySelector('.rz-cvm-panel'), top = panel.scrollTop, fk = focusKey();
    if (IN.sheet) { try { IN.sheet.destroy(); } catch (e) { /* gone */ } IN.sheet = null; }
    readFleet();
    panel.classList.add('is-int');
    if (IN.fleetOnly) {
      var fTop = intTop(), fDet = intDetail(), fLow = intLower();
      panel.innerHTML = '<div data-rz-cvm-top>' + fTop + '</div>' +
        '<div class="rz-cvm-int rz-cvm-int-fleet">' + sec('Unit', '<div data-rz-cvm-detail aria-live="polite">' + fDet + '</div>', 'rz-cvm-int-detail') + '</div>' +
        '<div data-rz-cvm-lower>' + fLow + '</div>';
      panel.querySelector('[data-rz-cvm-top]').__html = fTop; panel.querySelector('[data-rz-cvm-detail]').__html = fDet; panel.querySelector('[data-rz-cvm-lower]').__html = fLow;
      points();
      panel.scrollTop = top;
      refocus(fk);
      return;
    }
    var def = R.get(I.classKey);
    var hTop = intTop(), hDet = intDetail(), hLow = intLower();
    /* PRD-CONV-EQUIPMENT-INSIDE §5.5: the class's cycle on a P-h chart, only while the unit runs */
    var cyc = typeof def.cycle === 'function' && root.RZConvPh ? def.cycle(IN.unit, IN.snap) : null;
    panel.innerHTML = '<div data-rz-cvm-top>' + hTop + '</div>' +
      '<div class="rz-cvm-int">' +
        sec('Internal drawing', '<div class="rz-cvm-int-host hmi-host hmi-depth" data-rz-cvm-int data-theme="' + (doc.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark') + '"></div><div class="rz-cvm-media" aria-label="Media">' + mediaKey(def) + '</div>', 'rz-cvm-int-draw') +
        sec('Block detail', '<div data-rz-cvm-detail aria-live="polite">' + hDet + '</div>', 'rz-cvm-int-detail') +
      '</div>' + (cyc ? '<div class="rz-cvm-cycle">' + sec('Refrigeration cycle (P-h)', root.RZConvPh.markup()) + '</div>' : '') +
      '<div data-rz-cvm-lower>' + hLow + '</div>';
    panel.querySelector('[data-rz-cvm-top]').__html = hTop; panel.querySelector('[data-rz-cvm-detail]').__html = hDet; panel.querySelector('[data-rz-cvm-lower]').__html = hLow;
    var host = panel.querySelector('[data-rz-cvm-int]'), sh = def.sheet(IN.unit);
    IN.sheetObj = sh;
    IN.sheet = root.RZHmiSheet.render(host, sh, {
      read: function (n) { return IN.read[n.id] || {}; },
      flow: function (e) { return R.flow(I.classKey, IN.unit, e); },
      open: function (n) { selectBlock(n.id, false); }
    });
    paintInt(true);
    if (cyc) root.RZConvPh.draw(panel.querySelector('[data-rz-ph]'), root.CONV_CALC, cyc);
    points();
    panel.scrollTop = top;
    refocus(fk);
  }
  function paintInt(first) {
    var V = root.RZConvVfx, R = R_(), I = opts.internal, host = el.querySelector('[data-rz-cvm-int]');
    if (!IN.sheet || !host) return;
    IN.sheet.update();
    var svg = host.querySelector('svg.hmi-svg'), frame = host.querySelector('.hmi-frame');
    if (root.RZHmiDepth && svg) root.RZHmiDepth.apply(svg, { levels: {} });
    var rg = R.tempRange(I.classKey, IN.unit, IN.snap);
    if (V && svg && frame) {
      if (first) V.mount(frame, rg ? { tempRange: [rg[0].toFixed(1), rg[1].toFixed(1)], tempUnit: '°C' } : { thermal: false });
      V.apply(svg, { edges: IN.sheetObj.edges, flow: function (e) { return R.flow(I.classKey, IN.unit, e); }, ratio: function () { return R.ratio(IN.unit); },
        temp: function (e) { return R.temp(I.classKey, IN.unit, IN.snap, e); }, tempRange: rg, speed: function () { return null; } });
    }
    markBlock();
  }
  function markBlock() {
    var R = R_(), def = R.get(opts.internal.classKey), svg = el.querySelector('[data-rz-cvm-int] svg.hmi-svg'); if (!svg) return;
    var b = def.blocks.filter(function (x) { return x.id === IN.block; })[0];
    svg.querySelectorAll('.hmi-node.is-selected').forEach(function (g) { g.classList.remove('is-selected'); });
    if (b) { var g = svg.querySelector('.hmi-node[data-node="' + b.node + '"]'); if (g) g.classList.add('is-selected'); }
  }
  function selectBlock(idOrNode, fromList) {
    var R = R_(), def = R.get(opts.internal.classKey);
    var id = (def.nodeBlock && def.nodeBlock[idOrNode]) || idOrNode;
    var b = def.blocks.filter(function (x) { return x.id === id || x.node === id; })[0]; if (!b) return;
    IN.block = b.id;
    var box = el.querySelector('[data-rz-cvm-detail]'); if (box) { box.__html = intDetail(); box.innerHTML = box.__html; }
    markBlock();
    points();
    if (fromList) refocus('[data-rz-cvm-bsel]');
  }
  function go(i) {
    if (!IN || !IN.fleet || !IN.fleet.length) return;
    var n = IN.fleet.length; IN.i = ((i % n) + n) % n;
    renderInt();
  }
  function step(d) { if (IN) go(IN.i + d); }
  function refreshInt() {
    var fk = focusKey();
    readFleet();
    var top = el.querySelector('[data-rz-cvm-top]'), box = el.querySelector('[data-rz-cvm-detail]'), low = el.querySelector('[data-rz-cvm-lower]');
    /* only what changed is rewritten: a control under the pointer or the keyboard is never swapped out for nothing */
    var put = function (node, html) { if (node && node.__html !== html) { node.innerHTML = html; node.__html = html; } };
    put(top, intTop());
    if (!(doc.activeElement && doc.activeElement.hasAttribute && doc.activeElement.hasAttribute('data-rz-cvm-bsel'))) put(box, intDetail());
    put(low, intLower());
    paintInt(false);
    points();
    refocus(fk);
  }
  function setInert(on) {
    if (on) {
      inerted = Array.prototype.slice.call(doc.body.children).filter(function (c) { return c !== el && !c.hasAttribute('inert') && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE'; });
      inerted.forEach(function (c) { c.setAttribute('inert', ''); c.setAttribute('data-rz-cvm-inert', '1'); });
    } else { inerted.forEach(function (c) { c.removeAttribute('inert'); c.removeAttribute('data-rz-cvm-inert'); }); inerted = []; }
  }
  function open(payload, o) {
    if (!payload || !payload.tabs) return false;
    css();
    if (!el) {
      el = doc.createElement('div'); el.className = 'rz-cvm'; el.hidden = true;
      el.innerHTML = '<div class="rz-cvm-panel" role="dialog" aria-modal="true" aria-labelledby="rz-cvm-title"></div>';
      el.addEventListener('click', function (e) {
        if (e.target === el) { close(e.detail > 0); return; }
        if (IN && e.target.closest && e.target.closest('.rz-cvm-close')) { close(e.detail > 0); return; }
        if (IN && e.target.closest) {
          var nv = e.target.closest('[data-nav]'); if (nv) { step(Number(nv.getAttribute('data-nav'))); return; }
          var uc = e.target.closest('[data-unit]'); if (uc) { go(Number(uc.getAttribute('data-unit'))); return; }
        }
        var b = e.target.closest && e.target.closest('[data-basis-param]');
        if (b && el.contains(b)) basis(b);
      });
      el.addEventListener('change', function (e) {
        if (IN && e.target && e.target.hasAttribute && e.target.hasAttribute('data-rz-cvm-bsel')) selectBlock(e.target.value, true);
      });
      doc.body.appendChild(el);
    }
    if (timer) { root.clearInterval(timer); timer = null; }
    if (IN && IN.sheet) { try { IN.sheet.destroy(); } catch (e) { /* already gone */ } }
    current = payload; opts = o || {}; IN = null;
    if (intOn()) {
      if (opts.internal.fleetOnly) IN = { i: Math.max(0, Number(opts.internal.unit) || 0), block: null, sheet: null, fleetOnly: true };
      else {
        var def = root.RZConvInternals.get(opts.internal.classKey);
        IN = { i: Math.max(0, Number(opts.internal.unit) || 0), block: opts.internal.block || def.defaultBlock || def.blocks[0].id, sheet: null };
      }
    }
    lastTrigger = opts.trigger || doc.activeElement;
    var M = root.RZConvMotion, fresh = el.hidden || !!leaving;
    if (leaving) { leaving.cancel(); leaving = null; }
    el.hidden = false;
    render();
    if (fresh && M && M.byPointer()) M.dialogIn(el, el.querySelector('.rz-cvm-panel'));   /* PRD-CONV-BMS-MOTION M4; keyboard stays instant */
    setInert(true);
    doc.addEventListener('keydown', onKey, true);
    el.querySelector('.rz-cvm-close').focus();
    if (typeof opts.rebuild === 'function') {
      timer = root.setInterval(function () {
        if (IN) { refreshInt(); return; }
        var p = opts.rebuild(); if (p) { current = p; render(); }
      }, opts.period || 4000);
    }
    return true;
  }
  var leaving = null;
  function close(byPointer) {
    if (!el || el.hidden || leaving) return;
    if (timer) { root.clearInterval(timer); timer = null; }
    if (IN && IN.sheet) { try { IN.sheet.destroy(); } catch (e) { /* already gone */ } }
    IN = null;
    var M = root.RZConvMotion;
    if (byPointer === true && M) leaving = M.dialogOut(el, el.querySelector('.rz-cvm-panel'), function () { leaving = null; el.hidden = true; el.style.pointerEvents = ''; });
    else el.hidden = true;
    setInert(false);
    doc.removeEventListener('keydown', onKey, true);
    var t = lastTrigger; lastTrigger = null; current = null;
    if (t && t.isConnected && typeof t.focus === 'function') { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
  }
  root.RZConvModal = Object.freeze({ open: open, close: close, isOpen: function () { return !!(el && !el.hidden); }, timers: function () { return timer ? 1 : 0; },
    unit: function () { return IN ? IN.i : null; }, block: function () { return IN ? IN.block : null; }, version: '2.1.0' });
})(typeof window !== 'undefined' ? window : null);
