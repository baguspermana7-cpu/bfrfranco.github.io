/*
 * rz-trend.js — window.RZTrend: the trend and multitrend modal (PRD-CONV-LIVING-PLANT §7, phase P2).
 * A click on any number that is a point opens its history; more points can be added to compare (up to 8 pens).
 *
 *   register(points)   points = [{ id, label, unit, base, amp, shape, digits, cls: 'SIM' | 'ENGINE', group,
 *                                  ref, refLabel, hi, lo }]
 *                      ref = the engine plane drawn as a dashed line; hi / lo = alarm limits of the point.
 *   open(id, { trigger, range })   opens the modal with that point as pen 1
 *   close(), isOpen(), state()     state() = { pens:[ids], range, cursor } (a gate reads it)
 *   bind(root)         every [data-trend="<point id>"] under root opens its trend on click / Enter / T
 *   Data: js/conv/history.js (deterministic, labelled SIMULATED). The clock is injectable (RZTrend.now) so a gate
 *   can pin it; nothing else reads the time.
 *   URL: pens and range live in the hash as #trend=<id>,<id>&r=<range>, so a multitrend can be shared and restored.
 *   Keyboard: Esc closes; Tab stays inside; arrow keys move the cursor; "+" focuses the series picker.
 */
(function (root) {
  'use strict';
  if (!root || !root.document) return;
  var doc = root.document, H = function () { return root.RZConvHistory; };
  var POINTS = {}, ORDER = [], el = null, pens = [], range = '1h', cursorT = null, lastTrigger = null, inerted = [];
  var RANGES = { '5m': [5, 1], '1h': [60, 1], '8h': [480, 2], '24h': [1440, 5], '7d': [10080, 30] };
  var PEN = ['#56c2f5', '#e8b563', '#3fb950', '#f0883e', '#d2a8ff', '#ff7b9c', '#8b93a1', '#79c0ff'];
  var PEN_LIGHT = ['#005f8c', '#7a4800', '#1a7f37', '#9a4a00', '#5b3d99', '#a3264f', '#4b5563', '#0b5cad'];
  var DASH = ['', '6 3', '2 3', '8 3 2 3', '', '6 3', '2 3', '8 3 2 3'];
  var W = 720, Hh = 300, PAD = { l: 52, r: 52, t: 12, b: 26 };
  var api = {};

  var CSS = '' +
    '.rz-trend{position:fixed;inset:0;z-index:2147482100;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(5,6,8,.62)}' +
    '.rz-trend[hidden]{display:none}' +
    '.rz-trend-panel{--tr-bg:#121316;--tr-panel:#191b1f;--tr-line:rgba(255,255,255,.12);--tr-text:#e8edf5;--tr-mute:#9aa4b2;--tr-acc:#E8B563;--tr-grid:rgba(255,255,255,.07);' +
      'background:var(--tr-bg);color:var(--tr-text);border:1px solid var(--tr-line);border-radius:4px;width:min(1040px,100%);max-height:calc(100vh - 28px);overflow:auto;font:13px/1.4 IBM Plex Sans,system-ui,sans-serif}' +
    '[data-theme="light"] .rz-trend-panel{--tr-bg:#fff;--tr-panel:#f5f7fa;--tr-line:rgba(15,23,42,.14);--tr-text:#1b2430;--tr-mute:#4b5563;--tr-acc:#7A4800;--tr-grid:rgba(15,23,42,.08)}' +
    '.rz-trend-head{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--tr-line)}' +
    '.rz-trend-head h2{margin:0;font-size:15px;font-weight:600}' +
    '.rz-trend-sim{font:600 9.5px/1.5 JetBrains Mono,monospace;letter-spacing:.05em;border:1px solid rgba(176,103,143,.75);color:#e3a6c6;padding:0 5px;border-radius:2px;margin-left:8px;white-space:nowrap;display:inline-block}' +
    '[data-theme="light"] .rz-trend-sim{color:#7d2d59}' +
    '.rz-trend-btn{min-height:32px;padding:4px 10px;border:1px solid var(--tr-line);background:transparent;color:var(--tr-text);border-radius:3px;font:inherit;cursor:pointer}' +
    '.rz-trend-btn[aria-pressed="true"]{border-color:var(--tr-acc);box-shadow:inset 0 -2px 0 var(--tr-acc)}' +
    '.rz-trend-btn:focus-visible,.rz-trend-add:focus-visible,.rz-trend-plot:focus-visible{outline:2px solid var(--tr-acc);outline-offset:1px}' +
    '@media (pointer:coarse){.rz-trend-btn{min-height:44px}}' +
    '.rz-trend-tools{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--tr-line)}' +
    '.rz-trend-ranges{display:inline-flex;gap:4px}' +
    '.rz-trend-add{min-height:32px;max-width:100%;padding:4px 8px;background:var(--tr-panel);color:var(--tr-text);border:1px solid var(--tr-line);border-radius:3px;font:inherit}' +
    '.rz-trend-body{padding:10px 14px}' +
    '.rz-trend-plot{display:block;width:100%;height:auto;touch-action:none;background:var(--tr-panel);border:1px solid var(--tr-line);border-radius:3px}' +
    '.rz-trend-plot .grid{stroke:var(--tr-grid)}.rz-trend-plot .ax{fill:var(--tr-mute);font:10px JetBrains Mono,monospace}' +
    '.rz-trend-plot .pen{fill:none;stroke-width:1.5;vector-effect:non-scaling-stroke}' +
    '.rz-trend-plot .ref{stroke:var(--tr-mute);stroke-dasharray:5 4}.rz-trend-plot .lim{stroke:#f85149;stroke-dasharray:2 3}' +
    '.rz-trend-plot .cur{stroke:var(--tr-text);opacity:.6}' +
    '.rz-trend-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}' +
    '.rz-trend-table th,.rz-trend-table td{padding:5px 6px;border-bottom:1px solid var(--tr-line);text-align:right;white-space:nowrap}' +
    '.rz-trend-table th:first-child,.rz-trend-table td:first-child{text-align:left;white-space:normal;min-width:150px}' +
    '.rz-trend-table th{color:var(--tr-mute);font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}' +
    '.rz-trend-table td{font-family:JetBrains Mono,monospace}.rz-trend-table td:first-child{font-family:inherit}' +
    '.rz-trend-sw{display:inline-block;width:18px;height:0;border-top:2px solid;margin-right:6px;vertical-align:middle}' +
    '.rz-trend-x{border:0;background:transparent;color:var(--tr-mute);cursor:pointer;font-size:15px;min-width:28px;min-height:28px}' +
    '.rz-trend-scroll{overflow-x:auto}' +
    '.rz-trend-note{margin:8px 0 0;color:var(--tr-mute);font-size:11.5px}' +
    '[data-trend]{cursor:pointer}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function css() { if (doc.getElementById('rz-trend-css')) return; var s = doc.createElement('style'); s.id = 'rz-trend-css'; s.textContent = CSS; doc.head.appendChild(s); }
  function light() { return doc.documentElement.getAttribute('data-theme') === 'light'; }
  function colour(i) { return (light() ? PEN_LIGHT : PEN)[i % 8]; }
  function fmt(v, d) { return v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function nowMin() { return Math.floor(api.now() / 60000); }

  function register(points) {
    (points || []).forEach(function (p) { if (!p || !p.id) return; if (!POINTS[p.id]) ORDER.push(p.id); POINTS[p.id] = p; });
  }
  function seriesOf(p) {
    var r = RANGES[range], to = nowMin() + 1;
    return H().series(p, to - r[0], to, r[1]);
  }

  /* axes: pens sharing a unit share an axis; the first two units get real axes (left, right); further units are
     normalised to their own min..max and say so in the table */
  function layout(data) {
    var units = [], ax = {};
    data.forEach(function (d) { if (units.indexOf(d.p.unit || '') < 0) units.push(d.p.unit || ''); });
    units.forEach(function (u, i) {
      var mn = Infinity, mx = -Infinity;
      data.forEach(function (d) {
        if ((d.p.unit || '') !== u) return;
        d.pts.forEach(function (q) { if (q.v < mn) mn = q.v; if (q.v > mx) mx = q.v; });
        [d.p.ref, d.i === 0 ? d.p.hi : null, d.i === 0 ? d.p.lo : null].forEach(function (x) { if (typeof x === 'number') { if (x < mn) mn = x; if (x > mx) mx = x; } });
      });
      if (!isFinite(mn)) { mn = 0; mx = 1; }
      var pad = (mx - mn) * 0.08 || Math.abs(mx) * 0.02 || 1;
      ax[u] = { lo: mn - pad, hi: mx + pad, side: i === 0 ? 'l' : i === 1 ? 'r' : 'n' };
    });
    return ax;
  }

  function draw() {
    var data = pens.map(function (id, i) { return { p: POINTS[id], pts: seriesOf(POINTS[id]), i: i }; });
    var r = RANGES[range], t1 = (nowMin() + 1) * 60000, t0 = t1 - r[0] * 60000, ax = layout(data);
    var X = function (t) { return PAD.l + (t - t0) / (t1 - t0) * (W - PAD.l - PAD.r); };
    var Y = function (v, a) { return PAD.t + (1 - (v - a.lo) / (a.hi - a.lo)) * (Hh - PAD.t - PAD.b); };
    var s = '';
    for (var g = 0; g <= 4; g++) {
      var gy = PAD.t + g / 4 * (Hh - PAD.t - PAD.b);
      s += '<line class="grid" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + gy + '" y2="' + gy + '"/>';
      Object.keys(ax).forEach(function (u) {
        var a = ax[u]; if (a.side === 'n') return;
        var v = a.hi - g / 4 * (a.hi - a.lo), d = data.filter(function (z) { return (z.p.unit || '') === u; })[0].p.digits;
        s += '<text class="ax" x="' + (a.side === 'l' ? PAD.l - 5 : W - PAD.r + 5) + '" y="' + (gy + 3) + '" text-anchor="' + (a.side === 'l' ? 'end' : 'start') + '">' + esc(fmt(v, typeof d === 'number' ? d : 1)) + '</text>';
      });
    }
    for (var k = 0; k <= 4; k++) {
      var tt = t0 + k / 4 * (t1 - t0), dt = new Date(tt);
      var lab = r[0] > 1440 ? (dt.getUTCMonth() + 1) + '/' + dt.getUTCDate() : ('0' + dt.getUTCHours()).slice(-2) + ':' + ('0' + dt.getUTCMinutes()).slice(-2);
      s += '<text class="ax" x="' + X(tt) + '" y="' + (Hh - 8) + '" text-anchor="' + (k === 0 ? 'start' : k === 4 ? 'end' : 'middle') + '">' + lab + (k === 4 ? ' UTC' : '') + '</text>';
    }
    data.forEach(function (d) {
      var a = ax[d.p.unit || ''];
      if (typeof d.p.ref === 'number') s += '<line class="ref" data-ref="' + esc(d.p.id) + '" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + Y(d.p.ref, a) + '" y2="' + Y(d.p.ref, a) + '"/>';
      if (d.i === 0) ['hi', 'lo'].forEach(function (L) { if (typeof d.p[L] === 'number') s += '<line class="lim" data-limit="' + L + '" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + Y(d.p[L], a) + '" y2="' + Y(d.p[L], a) + '"/>'; });
      s += '<polyline class="pen" data-pen="' + esc(d.p.id) + '" stroke="' + colour(d.i) + '"' + (DASH[d.i] ? ' stroke-dasharray="' + DASH[d.i] + '"' : '') + ' points="' +
        d.pts.map(function (q) { return X(q.t).toFixed(1) + ',' + Y(q.v, a).toFixed(1); }).join(' ') + '"/>';
    });
    if (cursorT !== null && cursorT >= t0 && cursorT <= t1) s += '<line class="cur" x1="' + X(cursorT) + '" x2="' + X(cursorT) + '" y1="' + PAD.t + '" y2="' + (Hh - PAD.b) + '"/>';
    var svg = el.querySelector('.rz-trend-plot');
    svg.innerHTML = s; svg.__t0 = t0; svg.__t1 = t1;
    /* table: one row per pen */
    var rows = '';
    data.forEach(function (d) {
      var st = H().stats(d.pts), dg = typeof d.p.digits === 'number' ? d.p.digits : 1, at = null;
      if (cursorT !== null) { var best = Infinity; d.pts.forEach(function (q) { var e = Math.abs(q.t - cursorT); if (e < best) { best = e; at = q.v; } }); }
      var over = typeof d.p.hi === 'number' ? H().aboveLimit(d.pts, d.p.hi) : null;
      rows += '<tr data-row="' + esc(d.p.id) + '"><td><span class="rz-trend-sw" style="border-color:' + colour(d.i) + (DASH[d.i] ? ';border-top-style:dashed' : '') + '"></span>' + esc(d.p.label) +
        ' <span class="rz-trend-sim">' + esc(d.p.cls === 'ENGINE' ? 'SIM · ENGINE REF' : 'SIM') + '</span>' + (ax[d.p.unit || ''].side === 'n' ? ' (scaled to its own range)' : '') + '</td>' +
        '<td>' + esc(d.p.unit || '') + '</td><td data-k="cursor">' + fmt(at, dg) + '</td><td data-k="last">' + fmt(st.last, dg) + '</td><td data-k="min">' + fmt(st.min, dg) + '</td><td data-k="max">' + fmt(st.max, dg) + '</td><td data-k="mean">' + fmt(st.mean, dg) + '</td>' +
        '<td>' + (over === null ? '—' : fmt(over * 100, 0) + ' %') + '</td>' +
        '<td><button type="button" class="rz-trend-x" data-remove="' + esc(d.p.id) + '" aria-label="Remove ' + esc(d.p.label) + '"' + (pens.length < 2 ? ' disabled' : '') + '>×</button></td></tr>';
    });
    el.querySelector('tbody').innerHTML = rows;
    el.querySelector('[data-k="cursor-t"]').textContent = cursorT === null ? 'Cursor' : new Date(cursorT).toISOString().slice(5, 16).replace('T', ' ');
    var sel = el.querySelector('.rz-trend-add'), o = '<option value="">+ Add series to compare…</option>', groups = {};
    ORDER.forEach(function (id) { if (pens.indexOf(id) >= 0) return; var p = POINTS[id]; (groups[p.group || 'Points'] = groups[p.group || 'Points'] || []).push(p); });
    Object.keys(groups).forEach(function (g) { o += '<optgroup label="' + esc(g) + '">' + groups[g].map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.label + (p.unit ? ' [' + p.unit + ']' : '')) + '</option>'; }).join('') + '</optgroup>'; });
    sel.innerHTML = o; sel.disabled = pens.length >= 8;
    el.querySelectorAll('[data-range]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-range') === range ? 'true' : 'false'); });
    el.querySelector('#rz-trend-title').textContent = pens.length === 1 ? POINTS[pens[0]].label : 'Multitrend · ' + pens.length + ' series';
    try { root.history.replaceState(null, '', '#trend=' + pens.map(encodeURIComponent).join(',') + '&r=' + range); } catch (e) { /* file:// or sandbox: the link simply is not updated */ }
  }

  function setCursorFromX(clientX) {
    var svg = el.querySelector('.rz-trend-plot'), b = svg.getBoundingClientRect();
    var x = (clientX - b.left) / b.width * W, f = (x - PAD.l) / (W - PAD.l - PAD.r);
    if (f < 0 || f > 1) return;
    cursorT = Math.round((svg.__t0 + f * (svg.__t1 - svg.__t0)) / 60000) * 60000; draw();
  }
  function build() {
    css();
    el = doc.createElement('div'); el.className = 'rz-trend'; el.hidden = true;
    var rb = Object.keys(RANGES).map(function (k) { return '<button type="button" class="rz-trend-btn" data-range="' + k + '" aria-pressed="false">' + k + '</button>'; }).join('');
    el.innerHTML = '<div class="rz-trend-panel" role="dialog" aria-modal="true" aria-labelledby="rz-trend-title">' +
      '<div class="rz-trend-head"><h2 id="rz-trend-title">Trend</h2><button type="button" class="rz-trend-btn" data-close aria-label="Close trend">Close</button></div>' +
      '<div class="rz-trend-tools"><span class="rz-trend-ranges" role="group" aria-label="Time range">' + rb + '</span>' +
        '<select class="rz-trend-add" aria-label="Add a series to compare"></select>' +
        '<button type="button" class="rz-trend-btn" data-csv>Export CSV</button></div>' +
      '<div class="rz-trend-body"><svg class="rz-trend-plot" viewBox="0 0 ' + W + ' ' + Hh + '" tabindex="0" role="img" aria-label="Trend plot. Arrow keys move the cursor."></svg>' +
        '<div class="rz-trend-scroll"><table class="rz-trend-table"><thead><tr><th>Series</th><th>Unit</th><th data-k="cursor-t">Cursor</th><th>Last</th><th>Min</th><th>Max</th><th>Mean</th><th>Above limit</th><th></th></tr></thead><tbody></tbody></table></div>' +
        '<p class="rz-trend-note">SIMULATED history: a deterministic training series per point (no historian is read). Dashed grey = engine reference; dotted red = the first series’ alarm limit.</p></div></div>';
    doc.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var t = e.target;
      if (t === el || (t.closest && t.closest('[data-close]'))) { close(); return; }
      var rg = t.closest && t.closest('[data-range]'); if (rg) { range = rg.getAttribute('data-range'); cursorT = null; draw(); return; }
      var rm = t.closest && t.closest('[data-remove]'); if (rm && pens.length > 1) { pens.splice(pens.indexOf(rm.getAttribute('data-remove')), 1); draw(); el.querySelector('.rz-trend-add').focus(); return; }
      if (t.closest && t.closest('[data-csv]')) exportCsv();
    });
    el.querySelector('.rz-trend-add').addEventListener('change', function (e) { var id = e.target.value; if (id && POINTS[id] && pens.length < 8 && pens.indexOf(id) < 0) { pens.push(id); draw(); el.querySelector('.rz-trend-add').focus(); } });
    var svg = el.querySelector('.rz-trend-plot'), down = false;
    svg.addEventListener('pointerdown', function (e) { down = true; setCursorFromX(e.clientX); });
    svg.addEventListener('pointermove', function (e) { if (down || e.pointerType === 'mouse') setCursorFromX(e.clientX); });
    root.addEventListener('pointerup', function () { down = false; });
    svg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); var step = RANGES[range][1] * 60000;
      cursorT = (cursorT === null ? svg.__t1 - step : cursorT) + (e.key === 'ArrowLeft' ? -step : step);
      cursorT = Math.max(svg.__t0, Math.min(svg.__t1 - step, cursorT)); draw();
    });
  }
  function exportCsv() {
    var text = H().csv(pens.map(function (id) { var p = POINTS[id]; return { label: p.label, unit: p.unit, cls: p.cls === 'ENGINE' ? 'SIM, ENGINE REF' : 'SIM', points: seriesOf(p) }; }));
    api.lastCsv = text;
    try {
      var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
      a.download = 'trend-' + pens[0].replace(/[^a-z0-9]+/gi, '-') + '-' + range + '.csv'; el.appendChild(a); a.click(); a.remove();   /* inside the panel: a click on <body> reads as an outside click and closes the inspector below */
    } catch (e) { /* a sandboxed frame blocks downloads: the text stays on RZTrend.lastCsv */ }
  }
  function onKey(e) {
    if (!el || el.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === '+') { el.querySelector('.rz-trend-add').focus(); return; }
    if (e.key !== 'Tab') return;
    var f = Array.prototype.slice.call(el.querySelectorAll('button:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    else if (!el.contains(doc.activeElement)) { e.preventDefault(); f[0].focus(); }
  }
  function open(id, o) {
    if (!POINTS[id] || !H()) return false;
    if (!el) build();
    o = o || {};
    pens = [id].concat((o.pens || []).filter(function (x) { return POINTS[x] && x !== id; })).slice(0, 8);
    if (o.range && RANGES[o.range]) range = o.range;
    cursorT = null; lastTrigger = o.trigger || doc.activeElement;
    el.hidden = false; draw();
    inerted = Array.prototype.slice.call(doc.body.children).filter(function (c) { return c !== el && !c.hasAttribute('inert') && !/^(SCRIPT|STYLE|LINK)$/.test(c.tagName); });
    inerted.forEach(function (c) { c.setAttribute('inert', ''); c.setAttribute('data-rz-trend-inert', '1'); });
    doc.addEventListener('keydown', onKey, true);
    el.querySelector('[data-close]').focus();
    return true;
  }
  function close() {
    if (!el || el.hidden) return;
    el.hidden = true;
    inerted.forEach(function (c) { c.removeAttribute('inert'); c.removeAttribute('data-rz-trend-inert'); }); inerted = [];
    doc.removeEventListener('keydown', onKey, true);
    try { if (/^#trend=/.test(root.location.hash)) root.history.replaceState(null, '', root.location.pathname + root.location.search); } catch (e) { /* see draw() */ }
    var t = lastTrigger; lastTrigger = null;
    if (t && t.isConnected && t.focus) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
  }
  function bind(scope) {
    var host = scope || doc;
    if (host.__rzTrendBound) return; host.__rzTrendBound = true;
    host.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-trend]'); if (!t || (el && el.contains(t))) return;
      if (open(t.getAttribute('data-trend'), { trigger: t })) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== 't' && e.key !== 'T') return;
      var t = e.target.closest && e.target.closest('[data-trend]'); if (!t || (el && el.contains(t))) return;
      if (open(t.getAttribute('data-trend'), { trigger: t })) e.preventDefault();
    });
  }
  function fromHash() {
    var m = /^#trend=([^&]+)(?:&r=([a-z0-9]+))?/.exec(root.location.hash || ''); if (!m) return false;
    var ids = m[1].split(',').map(decodeURIComponent).filter(function (x) { return POINTS[x]; });
    return ids.length ? open(ids[0], { pens: ids.slice(1), range: m[2] }) : false;
  }

  api.register = register; api.open = open; api.close = close; api.bind = bind; api.fromHash = fromHash;
  api.isOpen = function () { return !!(el && !el.hidden); };
  api.state = function () { return { pens: pens.slice(), range: range, cursor: cursorT }; };
  api.points = function () { return ORDER.slice(); };
  api.now = function () { return Date.now(); };
  api.version = '1.0.0';
  root.RZTrend = api;
  bind(doc);   /* a page only loads the file: every [data-trend] reading on it opens its trend */
})(typeof window !== 'undefined' ? window : null);
