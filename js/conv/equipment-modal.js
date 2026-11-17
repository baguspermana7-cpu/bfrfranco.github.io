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
 *   close()    closes; clears its timer; un-inerts the page; focus returns to the trigger
 *   isOpen(), timers() -> number of live timers (0 when closed; a gate reads it)
 *
 * Every value cell carries data-basis-param (engine, evidence dot, click -> basis drawer) or
 * data-rz-authored-basis (+ data-rz-sim and a visible SIM mark for seeded values). Nothing here computes a number.
 */
(function (root) {
  'use strict';
  if (!root || !root.document) return;
  var doc = root.document, el = null, timer = null, lastTrigger = null, inerted = [], current = null, opts = null;

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
    '.rz-cvm-wide{grid-column:1/-1}';

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
    return ' data-trend="' + esc(r.trend.id) + '" tabindex="0" role="button" aria-label="' + esc(r.label + ': open trend') + '"';
  }
  function cell(r) {
    var a;
    if (r.basis) a = ' data-basis-param="' + esc(r.basis) + '" tabindex="0" role="button" style="--rz-ev:' + evColor(ev(r.basis)) + '" title="' + esc(r.basis + ' · ' + ev(r.basis) + ' — open the basis') + '"';
    else a = ' data-rz-authored-basis="' + esc(r.declared || '') + '"' + (r.sim ? ' data-rz-sim="1"' : '') + trendAttr(r) + ' style="--rz-ev:' + (r.sim ? '#b0678f' : '#8fa2b8') + '" title="' + esc(r.declared || '') + '"';
    return '<span class="rz-cvm-v"' + a + '>' + esc(r.text) + (r.unit ? ' ' + esc(r.unit) : '') + '</span>';
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
    var t = p.tabs, live = t.live.filter(function (r) { return r.label !== 'Role'; });
    var role = (t.live.filter(function (r) { return r.label === 'Role'; })[0] || {}).text || '';
    var trend = t.trend;
    return '' +
      '<div class="rz-cvm-head"><div><div class="rz-cvm-kind">' + esc(p.kind) + ' · ' + esc(p.label) + '</div>' +
        '<h2 class="rz-cvm-title" id="rz-cvm-title">' + esc(p.title) + '</h2><p class="rz-cvm-role">' + esc(role) + '</p>' +
        '<span class="rz-cvm-chip is-' + esc(p.statusChip.state) + '">' + esc(p.statusChip.label) + '</span></div>' +
        '<button type="button" class="rz-cvm-close" aria-label="Close equipment detail">×</button></div>' +
      '<div class="rz-cvm-grid">' +
        sec('Drawing', '<div class="rz-cvm-mimic" data-rz-cvm-mimic></div>') +
        sec('Readings', rows(live)) +
        sec('Trend', trend ? '<div class="rz-cvm-trend">' + trendSvg(trend) + '</div>' + rows(trend.rows) + '<p class="rz-cvm-note">' + esc(trend.declared) + '</p>' : '<p class="rz-cvm-note">No trend point for this class.</p>') +
        sec('Design basis', rows(t.capacity)) +
        sec('Operator guidance', '<p class="rz-cvm-guide">' + esc(p.guidance) + '</p>') +
        sec('Alarms', (t.alarms.length ? t.alarms.map(function (a) { return '<div class="rz-cvm-row"><span class="rz-cvm-k">' + esc(a.severity + ' · ' + a.lifecycle) + '</span><span class="rz-cvm-v" data-rz-authored-basis="simulated alarm record from the sheet’s stage machine, never a field event" data-rz-sim="1">' + esc(a.message) + '</span></div>'; }).join('') : '<p class="rz-cvm-note">No active alarm.</p>') + rows(t.alarmPoints)) +
        sec('Maintenance', rows(t.maint), 'rz-cvm-wide') +
      '</div>' +
      '<p class="rz-cvm-note" style="padding:0 16px 14px">engine ' + esc(p.provenance.engineVersion) + ' · tick ' + esc(p.provenance.tick) + ' · ' + esc(p.provenance.counts.derived) + ' engine · ' + esc(p.provenance.counts.simulated) + ' simulated · ' + esc(p.provenance.counts.state) + ' declared</p>';
  }
  function focusables() {
    return Array.prototype.slice.call(el.querySelectorAll('button,[tabindex="0"],a[href]')).filter(function (x) { return x.offsetParent !== null; });
  }
  function onKey(e) {
    if (!el || el.hidden) return;
    if (root.RZTrend && root.RZTrend.isOpen()) return;   /* the trend modal sits above this one and owns the keyboard */
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
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
  function render() {
    var scroller = el.querySelector('.rz-cvm-panel'), top = scroller ? scroller.scrollTop : 0;
    var focusedBasis = doc.activeElement && el.contains(doc.activeElement) ? doc.activeElement.getAttribute('data-basis-param') : null;
    var closeHad = doc.activeElement && doc.activeElement.classList && doc.activeElement.classList.contains('rz-cvm-close');
    el.querySelector('.rz-cvm-panel').innerHTML = body(current);
    el.querySelector('[data-rz-cvm-mimic]').innerHTML = mimic(opts.symbol);
    el.querySelector('.rz-cvm-panel').scrollTop = top;
    el.querySelector('.rz-cvm-close').addEventListener('click', close);
    if (closeHad) el.querySelector('.rz-cvm-close').focus();
    else if (focusedBasis) { var again = el.querySelector('[data-basis-param="' + focusedBasis + '"]'); if (again) again.focus(); }
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
        if (e.target === el) { close(); return; }
        var b = e.target.closest && e.target.closest('[data-basis-param]');
        if (b && el.contains(b)) basis(b);
      });
      doc.body.appendChild(el);
    }
    if (timer) { root.clearInterval(timer); timer = null; }
    current = payload; opts = o || {};
    lastTrigger = opts.trigger || doc.activeElement;
    el.hidden = false;
    render();
    setInert(true);
    doc.addEventListener('keydown', onKey, true);
    el.querySelector('.rz-cvm-close').focus();
    if (typeof opts.rebuild === 'function') {
      timer = root.setInterval(function () { var p = opts.rebuild(); if (p) { current = p; render(); } }, opts.period || 4000);
    }
    return true;
  }
  function close() {
    if (!el || el.hidden) return;
    if (timer) { root.clearInterval(timer); timer = null; }
    el.hidden = true;
    setInert(false);
    doc.removeEventListener('keydown', onKey, true);
    var t = lastTrigger; lastTrigger = null; current = null;
    if (t && t.isConnected && typeof t.focus === 'function') { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
  }
  root.RZConvModal = Object.freeze({ open: open, close: close, isOpen: function () { return !!(el && !el.hidden); }, timers: function () { return timer ? 1 : 0; }, version: '1.0.0' });
})(typeof window !== 'undefined' ? window : null);
