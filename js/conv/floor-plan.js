/*
 * floor-plan.js — window.RZFloorPlan: the data hall floor plan with depth (PRD-CONV-DATAHALL-FLOOR §3).
 *
 *   render(host, model, opts)  builds the SVG ONCE (rebuilt only when the host width changes) and returns the instance.
 *       model = { racks: [{idx, occupied, kw, util}], zones: [{z, heat, rackInletC, hotAisleC, ...}],
 *                 crahUnits: [{n, tag, running, status?}], rackInletFor(idx) -> °C, ratingKw, racksPerZone (20) }
 *               — the page's own `racks`, `zones`, `crahUnits`, `rackInletFor`, RACK_RATING_KW; no engine arithmetic here.
 *       opts  = { rackTag(idx), zoneTag(z), crahTag(n), thresholds, mode, onRack(idx, el), onCrah(n, el), onRow(z),
 *                 ids: {top, bottom} }
 *   paint(mode)                'power' | 'temp' | 'cooling-margin' | 'alarms' | 'space'. Writes ATTRIBUTES (fill, points,
 *                              data-state, display) and the text of nodes that already exist; never adds or removes a node.
 *   select({rack}|{row}|{crah}|null), legend(el, mode), palette(theme), classify(mode, model, idx, thresholds), unit().
 *
 * Colour is STATE, not magnitude: ok / warn / alarm come from --rz-pt-ok/warn/alarm (css/conv-point.css). Each state has
 * three faces (top, front, side) in three lightness steps of ONE hue, plus three magnitude steps on the top face. The
 * steps are computed in OKLCH here and emitted as discrete hex values per theme onto the stage's custom properties; the
 * drawing code itself holds no colour literal, only var(--fp-*). No gradient, filter, glow, blink or pulse. ES5.
 */
(function (global) {
  'use strict';
  if (global.RZFloorPlan) return;

  var NS = 'http://www.w3.org/2000/svg';
  var SHX = 0.42, SHY = 0.62;                 // oblique projection (PRD 3.1): X = x*u + y*u*0.42, Y = y*u*0.62 - h*H
  var H_UNITS = 1.6;                           // H = 1.6 u, the extrusion of a cabinet at 100 % of its rating
  var GEO = { rowW: 3.4, cabW: 1, hot: 0.8, cold: 0.6, kd: 1.5, nY0: 0.6, gD: 1.6, gap: 0.7, perLine: 10, wall: 2, capH: 1.2, crahH: 0.5 };
  GEO.cabY0 = GEO.nY0 + GEO.gD + GEO.gap;                       // 2.9
  GEO.cabY1 = GEO.cabY0 + GEO.perLine * GEO.kd;                 // 17.9
  GEO.sY0 = GEO.cabY1 + GEO.gap;                                // 18.6
  GEO.slabY = GEO.sY0 + GEO.gD + 0.6;                           // 20.8
  var U_MIN = 7, U_MAX = 16, PAD = 8, STRIP_H = 40;
  var MODES = ['power', 'temp', 'cooling-margin', 'alarms', 'space'];
  var DEFAULT_T = { utilWarn: 0.85, utilAlarm: 0.95, utilCap: 1.05, inletMin: 18, inletMax: 27, inletAlarm: 30, marginAlarm: -3 };

  /* ---------- OKLCH ------------------------------------------------------------------------------------------- */
  function toLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function fromLin(c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, c)) * 255); }
  function parseColor(s) {
    s = String(s || '').replace(/^\s+|\s+$/g, '');
    var m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) { var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) { var t = m[1]; return [parseInt(t.charAt(0) + t.charAt(0), 16), parseInt(t.charAt(1) + t.charAt(1), 16), parseInt(t.charAt(2) + t.charAt(2), 16)]; }
    m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(s);
    if (m) return [+m[1], +m[2], +m[3]];
    return null;
  }
  function cbrt(x) { return x < 0 ? -Math.pow(-x, 1 / 3) : Math.pow(x, 1 / 3); }
  function rgbToOklch(rgb) {
    var r = toLin(rgb[0]), g = toLin(rgb[1]), b = toLin(rgb[2]);
    var l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    var L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    var a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    var bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    var h = Math.atan2(bb, a) * 180 / Math.PI;
    return { L: L, C: Math.sqrt(a * a + bb * bb), h: h < 0 ? h + 360 : h };
  }
  function oklchToLin(L, C, h) {
    var a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    var s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  function inGamut(v) { return v[0] >= -0.0005 && v[0] <= 1.0005 && v[1] >= -0.0005 && v[1] <= 1.0005 && v[2] >= -0.0005 && v[2] <= 1.0005; }
  function hex2(n) { return (n < 16 ? '0' : '') + n.toString(16); }
  /* L and hue are kept; chroma is reduced until the colour fits sRGB (never clipped per channel, which shifts hue). */
  function oklchHex(L, C, h) {
    var lo = 0, hi = C, v = oklchToLin(L, C, h);
    if (!inGamut(v)) {
      for (var i = 0; i < 24; i++) { var mid = (lo + hi) / 2; if (inGamut(oklchToLin(L, mid, h))) lo = mid; else hi = mid; }
      v = oklchToLin(L, lo, h);
    }
    return '#' + hex2(fromLin(v[0])) + hex2(fromLin(v[1])) + hex2(fromLin(v[2]));
  }

  /* PRD 3.2: face lightness per theme, and the magnitude step on the top face. */
  var FACE_L = { dark: { top: 0.62, front: 0.50, side: 0.42 }, light: { top: 0.55, front: 0.45, side: 0.38 } };
  var MAG_DL = [-0.066, 0, 0.066];   // PRD 3.2 says 0.06; 8-bit hex rounding lands a step under 0.06 apart, and the data-viz validator wants >= 0.06 between adjacent steps
  var CHROMA_K = { ok: 0.6, warn: 0.85, alarm: 0.85 };   // a calm green: a little under the token's chroma
  function family(tokenRgb, theme, k, maxC) {
    var o = rgbToOklch(tokenRgb), L = FACE_L[theme], C = Math.min(o.C * k, maxC == null ? 1 : maxC), i, top = [];
    for (i = 0; i < 3; i++) top.push(oklchHex(L.top + MAG_DL[i], C, o.h));
    return { top: top, front: oklchHex(L.front, C, o.h), side: oklchHex(L.side, C, o.h) };
  }
  function buildPalette(tokens, ink, theme) {
    return {
      ok: family(tokens.ok, theme, CHROMA_K.ok), warn: family(tokens.warn, theme, CHROMA_K.warn), alarm: family(tokens.alarm, theme, CHROMA_K.alarm),
      neutral: family(ink, theme, 1, 0.012)
    };
  }
  function themeOf() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function readTokens(el) {
    var cs = global.getComputedStyle(el);
    function t(n) { var c = parseColor(cs.getPropertyValue(n)); if (!c) throw new Error('floor-plan: custom property ' + n + ' is not defined (load css/conv-point.css)'); return c; }
    return { tokens: { ok: t('--rz-pt-ok'), warn: t('--rz-pt-warn'), alarm: t('--rz-pt-alarm') }, ink: t('--fp-ink') };
  }

  /* ---------- the stage's own stylesheet: custom properties and the few rules the SVG attributes cannot hold ------- */
  var CSS = [
    '.fp-root,.fp-legend{--fp-ink:#e8edf5;--fp-muted:#9aa3b0;--fp-surface:#121316;--fp-accent:#e8b563;position:relative;color:var(--fp-ink);font:12px/1.35 "IBM Plex Sans",system-ui,sans-serif}',
    '[data-theme="light"] .fp-root,[data-theme="light"] .fp-legend{--fp-ink:#1b2430;--fp-muted:#4b5563;--fp-surface:#ffffff;--fp-accent:#7a4800}',
    '.fp-scroll{overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;overscroll-behavior-x:contain;max-width:100%}',
    '.fp-canvas{position:relative}',
    '.fp-snap{position:absolute;top:0;width:1px;height:1px;scroll-snap-align:start;pointer-events:none}',
    '.fp-svg{display:block;outline:none}',
    '.fp-svg:focus-visible{outline:1.5px solid var(--fp-accent);outline-offset:2px}',
    '.fp-svg polygon,.fp-svg path{vector-effect:none}',
    '.fp-slab{fill:var(--fp-ink);fill-opacity:.03;stroke:none}',
    '.fp-slab-face{fill:var(--fp-ink);fill-opacity:.08;stroke:none}',
    '.fp-tiles{fill:none;stroke:var(--fp-ink);stroke-opacity:.05;stroke-width:1}',
    '.fp-aisle-hot{fill:var(--fp-ink);fill-opacity:.1;stroke:none}',
    '.wall-edge{fill:none;stroke:var(--fp-ink);stroke-opacity:.2;stroke-width:1}',
    '.rack polygon,.crah-cell polygon{stroke:var(--fp-surface);stroke-width:.6;stroke-linejoin:round}',
    '.rack[data-state="spare"] .rk-top{stroke:var(--fp-ink);stroke-opacity:.22;stroke-width:1}',
    '.rack{cursor:pointer}',
    '.rack[data-state="spare"] .rk-top{pointer-events:all}',
    '.crah-cell{cursor:pointer}',
    '.crah-cell.stby polygon{stroke:var(--fp-ink);stroke-opacity:.35;stroke-width:1}',
    '.cr-fan{fill:none!important;stroke:var(--fp-surface);stroke-width:1;stroke-opacity:.8}',
    '.crah-cell.stby .cr-fan{stroke:var(--fp-ink);stroke-opacity:.35}',
    '.hot-cap{pointer-events:none}',
    '.hot-cap .cap-top{fill:var(--fp-ink);fill-opacity:.06;stroke:var(--fp-ink);stroke-opacity:.2;stroke-width:1}',
    '.fp-doors{pointer-events:none}',
    '.hot-door{fill:none;stroke:var(--fp-ink);stroke-opacity:.3;stroke-width:1}',
    '.hot-cap .cap-post{fill:none;stroke:var(--fp-ink);stroke-opacity:.2;stroke-width:1}',
    '.fp-ring{fill:none;pointer-events:none}',
    '.fp-ring-sel{stroke:var(--fp-accent);stroke-width:1.5}',
    '.fp-ring-hover{stroke:var(--fp-ink);stroke-width:1}',
    '.fp-ring-row{stroke:var(--fp-accent);stroke-width:1.5}',
    '.fp-root:not(.fp-labels) .rk-id,.fp-root:not(.fp-labels) .rk-val,.fp-root .cr-n{display:none}',
    '.fp-svg text{fill:var(--fp-ink);font:9px "JetBrains Mono","IBM Plex Mono",monospace}',
    '.zone-strip{position:relative;height:' + STRIP_H + 'px}',
    '.zone{position:absolute;top:2px;text-align:center;font-family:"JetBrains Mono","IBM Plex Mono",monospace;font-size:10px;line-height:1.3}',
    '.zone-head{display:block;margin:0 auto;width:20px;padding:1px 0;border:1px solid transparent;border-radius:2px;color:var(--fp-ink);cursor:pointer;font-size:11px}',
    '.zone[data-sel] .zone-head{border-color:var(--fp-accent);outline:0}',
    '.zone-foot{display:block;color:var(--fp-muted);cursor:pointer}',
    '.zone-foot .sr-only,.fp-root .sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    '.fp-tip{position:absolute;z-index:5;pointer-events:none;max-width:240px;padding:6px 8px;border:1px solid var(--fp-ink);border-color:color-mix(in srgb,var(--fp-ink) 24%,transparent);border-radius:3px;background:var(--fp-surface);color:var(--fp-ink);font-size:11px;line-height:1.4}',
    '.fp-tip[hidden]{display:none}',
    '.fp-tip b{font-weight:600}',
    '.fp-tip .tp-hint{color:var(--fp-muted)}',
    '.fp-legend{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;color:var(--fp-muted);font-size:11px}',
    '.fp-legend .lg-item{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}',
    '.fp-sw{display:inline-block;width:10px;height:10px;border-radius:1px;border:1px solid transparent}',
    '.fp-sw[data-state="ok"]{background:var(--fp-ok-t2)}.fp-sw[data-state="warn"]{background:var(--fp-warn-t2)}',
    '.fp-sw[data-state="alarm"]{background:var(--fp-alarm-t2)}.fp-sw[data-state="neutral"]{background:var(--fp-neutral-t2)}',
    '.fp-sw[data-state="spare"]{background:transparent;border-color:var(--fp-ink);border-color:color-mix(in srgb,var(--fp-ink) 40%,transparent)}'
  ].join('\n');
  function injectCss() {
    if (document.getElementById('rz-floor-plan-css')) return;
    var st = document.createElement('style'); st.id = 'rz-floor-plan-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* ---------- state per mode (PRD 3.2 threshold table) -------------------------------------------------------- */
  function clamp01(f) { return f < 0 ? 0 : (f > 1 ? 1 : f); }
  function third(f) { f = clamp01(f); return f >= 2 / 3 ? 2 : (f >= 1 / 3 ? 1 : 0); }
  function utilOf(model, rk) { return rk.util != null ? rk.util : (model.ratingKw ? rk.kw / model.ratingKw : 0); }
  function powerState(u, T, strict) {
    var warn = strict ? u > T.utilWarn : u >= T.utilWarn, alarm = strict ? u > T.utilAlarm : u >= T.utilAlarm;
    if (alarm) return { s: 'alarm', f: (u - T.utilAlarm) / (T.utilCap - T.utilAlarm) };
    if (warn) return { s: 'warn', f: (u - T.utilWarn) / (T.utilAlarm - T.utilWarn) };
    return { s: 'ok', f: u / T.utilWarn };
  }
  function inletState(t, T) {
    if (t > T.inletAlarm) return { s: 'alarm', f: (t - T.inletAlarm) / 5 };
    if (t > T.inletMax) return { s: 'warn', f: (t - T.inletMax) / (T.inletAlarm - T.inletMax) };
    if (t < T.inletMin) return { s: 'warn', f: (T.inletMin - t) / 6 };
    return { s: 'ok', f: (t - T.inletMin) / (T.inletMax - T.inletMin) };
  }
  var RANK = { ok: 0, warn: 1, alarm: 2 };
  /* -> { state: ok|warn|alarm|neutral|spare, step: 0..2 (-1 for spare), text } */
  function classify(mode, model, idx, T) {
    T = T || DEFAULT_T;
    var rk = model.racks[idx];
    if (!rk.occupied) return { state: 'spare', step: -1, v: 0, text: mode === 'space' ? 'spare' : '—' };
    var u = utilOf(model, rk), t = model.rackInletFor(idx), r, a, b;
    if (mode === 'space') return { state: 'neutral', step: 1, v: u, text: 'IT' };
    if (mode === 'power') { r = powerState(u, T, false); return { state: r.s, step: third(r.f), v: u, text: rk.kw.toFixed(1) }; }
    if (mode === 'temp') { r = inletState(t, T); return { state: r.s, step: third(r.f), v: t, text: t.toFixed(1) }; }
    if (mode === 'cooling-margin') {
      var m = T.inletMax - t;
      r = inletState(t, T);
      return { state: m >= 0 ? 'ok' : (m >= T.marginAlarm ? 'warn' : 'alarm'), step: third(t < T.inletMin ? 0 : r.f), v: t, text: m.toFixed(1) };
    }
    a = powerState(u, T, true);                          // alarms: the page's own evaluateAlarms (strict >)
    b = inletState(t, T);
    r = RANK[b.s] > RANK[a.s] && b.s !== 'ok' && t > T.inletMax ? b : a;
    return { state: r.s, step: third(r.f), v: u, text: String(Math.round(u * 100)) };
  }
  var STATE_WORD = { ok: 'normal', warn: '▲ warning', alarm: '◆ alarm', neutral: 'occupied', spare: 'spare' };

  /* ---------- the instance --------------------------------------------------------------------------------------- */
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag), k;
    if (attrs) for (k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function html(tag, cls, parent, text) {
    var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; if (parent) parent.appendChild(n); return n;
  }
  function setAttr(n, k, v) { if (n.getAttribute(k) !== v) n.setAttribute(k, v); }

  function create(host, model, opts) {
    injectCss();
    opts = opts || {};
    var T = {}, k;
    for (k in DEFAULT_T) T[k] = DEFAULT_T[k];
    if (opts.thresholds) for (k in opts.thresholds) T[k] = opts.thresholds[k];
    var perZone = model.racksPerZone || 20, Z = Math.floor(model.racks.length / perZone), perLine = perZone / 2;
    var inst = { model: model, mode: opts.mode || 'temp', host: host, sel: null, u: 0 };
    var u, H, ox, oy, root, scroll, canvas, svg, strip, tip, ringSel, ringHover, ringRow, rackEls = [], crahEls = [], zoneEls = [], cache = [], cursor = null;
    var ids = opts.ids || { top: 'crah-top', bottom: 'crah-bottom' };
    var rackTag = opts.rackTag || function (i) { return 'R-' + i; };
    var zoneTag = opts.zoneTag || function (z) { return 'Row ' + String.fromCharCode(65 + z); };
    var crahTag = opts.crahTag || function (n, c) { return (c && c.tag) || ('CRAH-' + n); };
    var wSlab = Z * GEO.rowW + 1.0, totalUnits = wSlab + SHX * GEO.slabY;

    function P(x, y, h) { return (ox + x * u + y * u * SHX).toFixed(3) + ',' + (oy + y * u * SHY - h * H).toFixed(3); }
    function pts(a) { var s = [], i; for (i = 0; i < a.length; i++) s.push(P(a[i][0], a[i][1], a[i][2])); return s.join(' '); }
    function cell(idx) {
      var z = Math.floor(idx / perZone), r = idx % perZone, line = r < perLine ? 0 : 1;
      return { z: z, line: line, j: r % perLine, x0: 0.5 + z * GEO.rowW + (line ? GEO.cabW + GEO.hot : 0), y0: GEO.cabY0 + (r % perLine) * GEO.kd };
    }
    function boxPts(x0, y0, w, d, h) {
      return {
        top: pts([[x0, y0, h], [x0 + w, y0, h], [x0 + w, y0 + d, h], [x0, y0 + d, h]]),
        front: pts([[x0, y0 + d, 0], [x0 + w, y0 + d, 0], [x0 + w, y0 + d, h], [x0, y0 + d, h]]),
        side: pts([[x0, y0, 0], [x0, y0 + d, 0], [x0, y0 + d, h], [x0, y0, h]])
      };
    }
    function hOf(idx) {
      var rk = model.racks[idx];
      if (!rk.occupied) return 0;
      var f = model.ratingKw ? rk.kw / model.ratingKw : 0;
      return f < 0 ? 0 : f;
    }

    function layout() {
      var W = opts.width || host.clientWidth || 1100;
      var fit = (W - 2 * PAD) / totalUnits;
      u = Math.max(U_MIN, Math.min(U_MAX, fit));
      H = H_UNITS * u; ox = PAD; oy = Math.ceil(GEO.wall * u) + 6;
      inst.u = u;
    }

    function build() {
      layout();
      var i, j, z, n, c;
      host.innerHTML = '';
      rackEls = []; crahEls = []; zoneEls = []; cache = [];
      var svgW = Math.ceil(ox + totalUnits * u + PAD), svgH = Math.ceil(oy + GEO.slabY * u * SHY + 8);
      root = html('div', 'fp-root', host);
      root.setAttribute('data-fp', '1'); root.setAttribute('data-u', u.toFixed(2));
      scroll = html('div', 'fp-scroll', root);
      canvas = html('div', 'fp-canvas', scroll); canvas.style.width = svgW + 'px';
      for (i = 0; i < Z; i += 5) { var sn = html('span', 'fp-snap', canvas); sn.style.left = Math.max(0, Math.floor(ox + (0.5 + i * GEO.rowW) * u + SHX * GEO.cabY0 * u - 6)) + 'px'; }
      svg = el('svg', { 'class': 'fp-svg', width: svgW, height: svgH, viewBox: '0 0 ' + svgW + ' ' + svgH, role: 'group', tabindex: '0',
        'aria-label': 'Data hall floor plan. Arrow keys move between cabinets and CRAH units, Enter opens the focused one.' }, canvas);

      /* floor: slab, tile grid, wall on the north and west edges */
      var g = el('g', { 'class': 'fp-floor' }, svg), d = '', x, y;
      el('polygon', { 'class': 'fp-slab', points: pts([[0, 0, 0], [wSlab, 0, 0], [wSlab, GEO.slabY, 0], [0, GEO.slabY, 0]]) }, g);
      for (x = 2; x < wSlab; x += 2) d += 'M' + P(x, 0, 0) + 'L' + P(x, GEO.slabY, 0);
      for (y = 2; y < GEO.slabY; y += 2) d += 'M' + P(0, y, 0) + 'L' + P(wSlab, y, 0);
      el('path', { 'class': 'fp-tiles', d: d }, g);
      var da = '';
      for (z = 0; z < Z; z++) { var ha = 0.5 + z * GEO.rowW + GEO.cabW; da += 'M' + P(ha, GEO.cabY0, 0) + 'L' + P(ha + GEO.hot, GEO.cabY0, 0) + 'L' + P(ha + GEO.hot, GEO.cabY1, 0) + 'L' + P(ha, GEO.cabY1, 0) + 'Z'; }
      el('path', { 'class': 'fp-aisle-hot', d: da }, g);
      var sf = 4 / H;
      el('polygon', { 'class': 'fp-slab-face', points: pts([[0, GEO.slabY, 0], [wSlab, GEO.slabY, 0], [wSlab, GEO.slabY, -sf], [0, GEO.slabY, -sf]]) }, g);
      el('polygon', { 'class': 'fp-slab-face', points: pts([[0, 0, 0], [0, GEO.slabY, 0], [0, GEO.slabY, -sf], [0, 0, -sf]]) }, g);
      var wall = el('g', { 'class': 'fp-wall' }, svg), wh = GEO.wall * u / H;
      el('polygon', { 'class': 'wall-edge', 'data-edge': 'north', points: pts([[0, 0, 0], [wSlab, 0, 0], [wSlab, 0, wh], [0, 0, wh]]) }, wall);
      el('polygon', { 'class': 'wall-edge', 'data-edge': 'west', points: pts([[0, 0, 0], [0, GEO.slabY, 0], [0, GEO.slabY, wh], [0, 0, wh]]) }, wall);

      /* CRAH galleries: north first (far), south last (near) */
      var units = model.crahUnits || [], split = Math.ceil(units.length / 2);
      function gallery(name, id, from, to, y0) {
        var gg = el('g', { 'class': 'fp-crah', id: id, 'data-gallery': name }, svg), cnt = to - from, slot = (wSlab - 1.0) / Math.max(1, cnt);
        for (var q = 0; q < cnt; q++) {
          var cu = units[from + q], nn = cu.n != null ? cu.n : from + q + 1, bx = 0.5 + q * slot + 0.12, bw = slot - 0.24;
          var cg = el('g', { 'class': 'crah-cell', 'data-crah': nn, id: 'fp-cr-' + nn }, gg), bp = boxPts(bx, y0, bw, GEO.gD, GEO.crahH / H_UNITS);
          var cell3 = { side: el('polygon', { 'class': 'cr-side', points: bp.side }, cg), front: el('polygon', { 'class': 'cr-front', points: bp.front }, cg), top: el('polygon', { 'class': 'cr-top', points: bp.top }, cg) };
          var fan = [], rr = Math.min(bw, GEO.gD) * 0.34, a;
          for (a = 0; a < 20; a++) fan.push([bx + bw / 2 + rr * Math.cos(a * Math.PI / 10), y0 + GEO.gD / 2 + rr * Math.sin(a * Math.PI / 10), GEO.crahH / H_UNITS]);
          el('polygon', { 'class': 'cr-fan', points: pts(fan) }, cg);
          var tx = el('text', { 'class': 'cr-n', x: (ox + (bx + bw / 2) * u + (y0 + GEO.gD) * u * SHX).toFixed(1), y: (oy + (y0 + GEO.gD) * u * SHY + 9).toFixed(1), 'text-anchor': 'middle' }, cg);
          tx.textContent = String(nn);
          crahEls.push({ g: cg, p: cell3, n: nn, u: cu, top: bp.top, gal: name, i: q, cx: bx + bw / 2 });
        }
      }
      gallery('north', ids.top, 0, split, GEO.nY0);

      /* cabinets: far to near = north to south; at equal depth the east row (farther from the west viewpoint) first */
      var order = [];
      for (j = 0; j < perLine; j++) for (z = Z - 1; z >= 0; z--) { order.push(z * perZone + perLine + j); order.push(z * perZone + j); }
      var caps = el('g', { 'class': 'fp-caps' }, svg);
      for (z = 0; z < Z; z++) {
        var xa = 0.5 + z * GEO.rowW + GEO.cabW - 0.06, xb = 0.5 + z * GEO.rowW + GEO.cabW + GEO.hot + 0.06;
        var cg2 = el('g', { 'class': 'hot-cap', 'data-z': z }, caps);
        el('polygon', { 'class': 'cap-top', points: pts([[xa, GEO.cabY0, GEO.capH], [xb, GEO.cabY0, GEO.capH], [xb, GEO.cabY1, GEO.capH], [xa, GEO.cabY1, GEO.capH]]) }, cg2);
        el('path', { 'class': 'cap-post', d: 'M' + P(xa, GEO.cabY0, GEO.capH) + 'L' + P(xa, GEO.cabY0, 0) + 'M' + P(xb, GEO.cabY0, GEO.capH) + 'L' + P(xb, GEO.cabY0, 0) }, cg2);
      }
      var field = el('g', { 'class': 'fp-field' }, svg);
      for (n = 0; n < order.length; n++) {
        i = order[n];
        c = cell(i);
        var rg = el('g', { 'class': 'rack', 'data-idx': i, id: 'fp-rk-' + i, 'data-state': 'ok', role: 'img' }, field);
        var rp = { side: el('polygon', { 'class': 'rk-side' }, rg), front: el('polygon', { 'class': 'rk-front' }, rg), top: el('polygon', { 'class': 'rk-top' }, rg) };
        var tid = el('text', { 'class': 'rk-id', x: (ox + (c.x0 + 0.5) * u + (c.y0 + GEO.kd) * u * SHX).toFixed(1), y: (oy + (c.y0 + GEO.kd) * u * SHY - 2).toFixed(1), 'text-anchor': 'middle' }, rg);
        tid.textContent = String(rackTag(i)).replace(/^R-/, '');
        var tv = el('text', { 'class': 'rk-val', x: tid.getAttribute('x'), y: (+tid.getAttribute('y') + 9).toFixed(1), 'text-anchor': 'middle' }, rg);
        tv.textContent = '';
        rackEls[i] = { g: rg, p: rp, val: tv, c: c };
        cache[i] = {};
      }
      /* hot-aisle door frame at the south end of each row (the cap's roof is drawn BEFORE the cabinets, see below) */
      var doors = el('g', { 'class': 'fp-doors' }, svg);
      for (z = 0; z < Z; z++) {
        var da2 = 0.5 + z * GEO.rowW + GEO.cabW - 0.06, db = 0.5 + z * GEO.rowW + GEO.cabW + GEO.hot + 0.06;
        el('polygon', { 'class': 'hot-door', 'data-z': z, points: pts([[da2, GEO.cabY1, 0], [db, GEO.cabY1, 0], [db, GEO.cabY1, GEO.capH], [da2, GEO.cabY1, GEO.capH]]) }, doors);
      }
      gallery('south', ids.bottom, split, units.length, GEO.sY0);

      ringRow = el('polygon', { 'class': 'fp-ring fp-ring-row', points: '', display: 'none' }, svg);
      ringSel = el('polygon', { 'class': 'fp-ring fp-ring-sel', points: '', display: 'none' }, svg);
      ringHover = el('polygon', { 'class': 'fp-ring fp-ring-hover', points: '', display: 'none' }, svg);

      /* row strip: HTML under the SVG columns (letters, one kW per row; inlet / hot aisle / stats are screen-reader only) */
      strip = html('div', 'zone-strip', canvas);
      for (z = 0; z < Z; z++) {
        var zn = model.zones[z], zc = ox + (0.5 + z * GEO.rowW + 1.4) * u + GEO.slabY * u * SHX, cw = GEO.rowW * u;
        var zd = html('div', 'zone', strip); zd.setAttribute('data-z', z); zd.style.left = Math.round(zc - cw / 2) + 'px'; zd.style.width = Math.round(cw) + 'px';
        var zh = html('span', 'zone-head', zd, String.fromCharCode(65 + z)); zh.title = zoneTag(z);
        var zf = html('span', 'zone-foot num', zd);
        html('span', 'zf-kw', zf, zn.heat.toFixed(0)).title = 'row heat, kW';
        html('span', 'zf-in sr-only', zf, zn.rackInletC.toFixed(1));
        html('span', 'zf-hot sr-only', zf, zn.hotAisleC.toFixed(1));
        html('span', 'zf-stats sr-only', zf, '');
        zoneEls[z] = zd;
      }
      tip = html('div', 'fp-tip', root); tip.hidden = true; tip.setAttribute('role', 'tooltip');
      host.setAttribute('data-fp-host', '1');
      applyTheme();
      wire();
      inst.paint(inst.mode);
      if (inst.sel) inst.select(inst.sel);
    }

    /* ---- theme: the discrete hex steps, emitted once per theme onto the stage's custom properties ---- */
    function applyTheme() {
      if (!root) return;
      var th = themeOf(), tk = readTokens(root), p = buildPalette(tk.tokens, tk.ink, th), names = ['ok', 'warn', 'alarm', 'neutral'], i, f;
      for (i = 0; i < names.length; i++) {
        f = p[names[i]];
        root.style.setProperty('--fp-' + names[i] + '-t1', f.top[0]); root.style.setProperty('--fp-' + names[i] + '-t2', f.top[1]); root.style.setProperty('--fp-' + names[i] + '-t3', f.top[2]);
        root.style.setProperty('--fp-' + names[i] + '-f', f.front); root.style.setProperty('--fp-' + names[i] + '-s', f.side);
      }
      root.setAttribute('data-fp-theme', th);
    }
    inst.retheme = applyTheme;

    function fillFor(state, step) {
      var s = 'var(--fp-' + state + '-';
      return { top: s + 't' + (step + 1) + ')', front: s + 'f)', side: s + 's)' };
    }

    /* ---- paint: attributes and existing text only ---- */
    inst.paint = function (mode) {
      mode = MODES.indexOf(mode) >= 0 ? mode : 'temp';
      inst.mode = mode;
      var i, r, c, e, f, h, bp, ch, want, res = [], groups = {}, cuts = {}, st, arr, n;
      for (i = 0; i < model.racks.length; i++) {
        r = classify(mode, model, i, T); res[i] = r;
        if (r.state === 'ok' || r.state === 'warn' || r.state === 'alarm') (groups[r.state] = groups[r.state] || []).push(r.v);
      }
      /* magnitude steps: the low / mid / high third OF THE CABINETS in that state (tertiles), so a hall whose cabinets all
         sit in the top of one band still shows its differences; a state with fewer than 9 cabinets falls back to band thirds */
      if (opts.steps !== 'band') {
        for (st in groups) {
          arr = groups[st].slice().sort(function (a, b) { return a - b; }); n = arr.length;
          if (n >= 9) cuts[st] = arr[0] === arr[n - 1] ? 'flat' : [arr[Math.floor(n / 3)], arr[Math.floor(2 * n / 3)]];
        }
      }
      for (i = 0; i < model.racks.length; i++) {
        e = rackEls[i]; if (!e) continue;
        r = res[i]; c = cache[i]; h = hOf(i);
        if (cuts[r.state]) r.step = cuts[r.state] === 'flat' ? 1 : (r.v < cuts[r.state][0] ? 0 : (r.v < cuts[r.state][1] ? 1 : 2));
        e.g.setAttribute('data-state', r.state); setAttr(e.g, 'data-step', String(r.step)); setAttr(e.g, 'data-kw', String(model.racks[i].kw));
        if (e.val.textContent !== r.text) e.val.textContent = r.text;
        if (c.h !== h) {
          bp = boxPts(e.c.x0, e.c.y0, GEO.cabW, GEO.kd, h);
          e.p.top.setAttribute('points', bp.top); e.p.front.setAttribute('points', bp.front); e.p.side.setAttribute('points', bp.side); c.h = h;
        }
        if (r.state === 'spare') {
          want = 'none';
          setAttr(e.p.top, 'fill', want); setAttr(e.p.front, 'display', 'none'); setAttr(e.p.side, 'display', 'none');
        } else {
          f = fillFor(r.state, r.step);
          setAttr(e.p.top, 'fill', f.top); setAttr(e.p.front, 'fill', f.front); setAttr(e.p.side, 'fill', f.side);
          if (c.spare !== false) { e.p.front.removeAttribute('display'); e.p.side.removeAttribute('display'); }
        }
        c.spare = r.state === 'spare';
      }
      for (i = 0; i < crahEls.length; i++) {
        ch = crahEls[i]; var run = ch.u.running !== false, st = ch.u.status === 'alarm' ? 'alarm' : (ch.u.status === 'warn' ? 'warn' : 'neutral');
        ch.g.setAttribute('class', 'crah-cell' + (run ? '' : ' stby')); ch.g.setAttribute('data-state', run ? st : 'standby');
        if (run) {
          setAttr(ch.p.top, 'fill', 'var(--fp-' + st + '-' + (st === 'neutral' ? 't1' : 't2') + ')');
          setAttr(ch.p.front, 'fill', 'var(--fp-' + st + '-f)'); setAttr(ch.p.side, 'fill', 'var(--fp-' + st + '-s)');
        } else { setAttr(ch.p.top, 'fill', 'none'); setAttr(ch.p.front, 'fill', 'none'); setAttr(ch.p.side, 'fill', 'none'); }
      }
      host.setAttribute('data-unit', { power: 'kW', temp: '°C', 'cooling-margin': 'K', alarms: '%' }[mode] || '');
      root.setAttribute('data-mode', mode);
      if (inst.sel) refreshRings();
    };

    /* ---- selection, rings ---- */
    function ringPts(sel) {
      if (sel.rack != null) { var e = rackEls[sel.rack], h = cache[sel.rack].h || 0; return boxPts(e.c.x0, e.c.y0, GEO.cabW, GEO.kd, h).top; }
      if (sel.crah != null) { for (var i = 0; i < crahEls.length; i++) if (crahEls[i].n === sel.crah) return crahEls[i].top; }
      return null;
    }
    function rowPts(z) { var x0 = 0.5 + z * GEO.rowW - 0.1; return pts([[x0, GEO.cabY0 - 0.15, 0], [x0 + 2.9, GEO.cabY0 - 0.15, 0], [x0 + 2.9, GEO.cabY1 + 0.15, 0], [x0, GEO.cabY1 + 0.15, 0]]); }
    function refreshRings() {
      var s = inst.sel, p;
      for (var i = 0; i < model.racks.length; i++) if (rackEls[i]) rackEls[i].g.removeAttribute('data-sel');
      for (var z = 0; z < Z; z++) zoneEls[z].removeAttribute('data-sel');
      ringRow.setAttribute('display', 'none'); ringSel.setAttribute('display', 'none');
      if (!s) return;
      if (s.row != null) { ringRow.setAttribute('points', rowPts(s.row)); ringRow.removeAttribute('display'); zoneEls[s.row].setAttribute('data-sel', '1'); return; }
      p = ringPts(s);
      if (p) { ringSel.setAttribute('points', p); ringSel.removeAttribute('display'); }
      if (s.rack != null) { rackEls[s.rack].g.setAttribute('data-sel', '1'); zoneEls[rackEls[s.rack].c.z].setAttribute('data-sel', '1'); }
    }
    inst.select = function (sel) { inst.sel = sel || null; refreshRings(); };

    /* ---- tooltip ---- */
    var tipKey = '';
    function showTip(target, ev) {
      var key = target.getAttribute('data-idx') != null ? 'r' + target.getAttribute('data-idx') : 'c' + target.getAttribute('data-crah');
      if (key !== tipKey) {
        tip.innerHTML = '';
        if (key.charAt(0) === 'r') {
          var i = +target.getAttribute('data-idx'), rk = model.racks[i], r = classify(inst.mode, model, i, T), u0 = utilOf(model, rk);
          html('div', '', tip, rackTag(i) + ' · ' + zoneTag(rackEls[i].c.z)).style.fontWeight = '600';
          if (rk.occupied) {
            html('div', '', tip, rk.kw.toFixed(1) + ' kW · ' + Math.round(u0 * 100) + ' % of ' + (model.ratingKw || 0).toFixed(0) + ' kW rating');
            html('div', '', tip, 'inlet ' + model.rackInletFor(i).toFixed(1) + ' °C');
          }
          html('div', '', tip, STATE_WORD[r.state]);
          html('div', 'tp-hint', tip, 'Click for detail');
        } else {
          var n = +target.getAttribute('data-crah'), cu = null, q;
          for (q = 0; q < crahEls.length; q++) if (crahEls[q].n === n) cu = crahEls[q].u;
          html('div', '', tip, crahTag(n, cu)).style.fontWeight = '600';
          html('div', '', tip, cu && cu.running === false ? 'standby' : 'running' + (cu && cu.leavingAirC != null ? ' · leaving air ' + cu.leavingAirC.toFixed(1) + ' °C' : ''));
          html('div', 'tp-hint', tip, 'Click for detail');
        }
        tipKey = key;
      }
      var rr = root.getBoundingClientRect(), left = ev.clientX - rr.left + 14, top = ev.clientY - rr.top + 14;
      tip.hidden = false;
      if (left + tip.offsetWidth > rr.width) left = Math.max(0, ev.clientX - rr.left - tip.offsetWidth - 10);
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
    }
    function hideTip() { tip.hidden = true; tipKey = ''; }
    function hoverRing(target) {
      var p = null;
      if (target) {
        if (target.getAttribute('data-idx') != null) p = ringPts({ rack: +target.getAttribute('data-idx') });
        else p = ringPts({ crah: +target.getAttribute('data-crah') });
      }
      if (p) { ringHover.setAttribute('points', p); ringHover.removeAttribute('display'); } else ringHover.setAttribute('display', 'none');
    }
    function up(t, sel) { while (t && t !== svg) { if (t.matches && t.matches(sel)) return t; t = t.parentNode; } return null; }

    /* ---- keyboard cursor over the spatial grid: 2 lines x rows across, 10 cabinets deep, galleries north and south ---- */
    function cursorEl() { return cursor.k === 'r' ? rackEls[cursor.idx].g : crahEls[cursor.ci].g; }
    function showCursor() {
      var t = cursorEl(); hoverRing(t);
      svg.setAttribute('aria-activedescendant', t.getAttribute('id'));
      t.setAttribute('aria-label', t.classList && t.classList.contains('rack') ? rackTag(+t.getAttribute('data-idx')) + ', ' + STATE_WORD[t.getAttribute('data-state')] : crahTag(+t.getAttribute('data-crah')));
    }
    function colOf(idx) { var c = rackEls[idx].c; return c.z * 2 + c.line; }
    function idxOf(col, j) { return Math.floor(col / 2) * perZone + (col % 2) * perLine + j; }
    function centerOfCol(col) { return 0.5 + Math.floor(col / 2) * GEO.rowW + (col % 2 ? GEO.cabW + GEO.hot : 0) + GEO.cabW / 2; }
    function nearestCrah(gal, x) {
      var best = -1, bd = 1e9, i, dd;
      for (i = 0; i < crahEls.length; i++) { if (crahEls[i].gal !== gal) continue; dd = Math.abs(crahEls[i].cx - x); if (dd < bd) { bd = dd; best = i; } }
      return best;
    }
    function move(key) {
      if (!cursor) { cursor = { k: 'r', idx: 0 }; return; }
      var i, ci, c;
      if (cursor.k === 'r') {
        var col = colOf(cursor.idx), j = rackEls[cursor.idx].c.j;
        if (key === 'ArrowRight') col = Math.min(Z * 2 - 1, col + 1);
        else if (key === 'ArrowLeft') col = Math.max(0, col - 1);
        else if (key === 'ArrowDown') { if (j === perLine - 1) { ci = nearestCrah('south', centerOfCol(col)); if (ci >= 0) { cursor = { k: 'c', ci: ci }; return; } } else j++; }
        else if (key === 'ArrowUp') { if (j === 0) { ci = nearestCrah('north', centerOfCol(col)); if (ci >= 0) { cursor = { k: 'c', ci: ci }; return; } } else j--; }
        cursor = { k: 'r', idx: idxOf(col, j) };
      } else {
        c = crahEls[cursor.ci];
        if (key === 'ArrowRight' || key === 'ArrowLeft') {
          i = cursor.ci + (key === 'ArrowRight' ? 1 : -1);
          if (crahEls[i] && crahEls[i].gal === c.gal) cursor = { k: 'c', ci: i };
        } else if ((key === 'ArrowDown' && c.gal === 'north') || (key === 'ArrowUp' && c.gal === 'south')) {
          var best = 0, bd = 1e9, cc;
          for (cc = 0; cc < Z * 2; cc++) { var dd = Math.abs(centerOfCol(cc) - c.cx); if (dd < bd) { bd = dd; best = cc; } }
          cursor = { k: 'r', idx: idxOf(best, c.gal === 'north' ? 0 : perLine - 1) };
        }
      }
    }
    function activate() {
      if (!cursor) return;
      if (cursor.k === 'r') { inst.select({ rack: cursor.idx }); if (opts.onRack) opts.onRack(cursor.idx, rackEls[cursor.idx].g); }
      else { var ch = crahEls[cursor.ci]; inst.select({ crah: ch.n }); if (opts.onCrah) opts.onCrah(ch.n, ch.g); }
    }

    function wire() {
      svg.addEventListener('pointermove', function (ev) {
        var t = up(ev.target, '.rack,.crah-cell');
        if (!t) { hideTip(); hoverRing(null); return; }
        hoverRing(t); showTip(t, ev);
      });
      svg.addEventListener('pointerleave', function () { hideTip(); if (!cursor || document.activeElement !== svg) hoverRing(null); else showCursor(); });
      svg.addEventListener('click', function (ev) {
        var t = up(ev.target, '.rack,.crah-cell');
        if (!t) return;
        if (t.getAttribute('data-idx') != null) {
          var i = +t.getAttribute('data-idx'); cursor = { k: 'r', idx: i }; inst.select({ rack: i }); if (opts.onRack) opts.onRack(i, t);
        } else {
          var n = +t.getAttribute('data-crah'); for (var q = 0; q < crahEls.length; q++) if (crahEls[q].n === n) cursor = { k: 'c', ci: q };
          inst.select({ crah: n }); if (opts.onCrah) opts.onCrah(n, t);
        }
      });
      svg.addEventListener('focus', function () { if (!cursor) cursor = { k: 'r', idx: 0 }; showCursor(); });
      svg.addEventListener('blur', function () { hoverRing(null); });
      svg.addEventListener('keydown', function (ev) {
        var k = ev.key;
        if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'ArrowUp' || k === 'ArrowDown') { ev.preventDefault(); move(k); showCursor(); hideTip(); }
        else if (k === 'Enter' || k === ' ') { ev.preventDefault(); activate(); }
        else if (k === 'Escape') { inst.select(null); }
      });
      strip.addEventListener('click', function (ev) {
        var t = ev.target, zd = null;
        while (t && t !== strip) { if (t.getAttribute && t.getAttribute('data-z') != null && t.className.indexOf('zone') === 0) { zd = t; break; } t = t.parentNode; }
        if (!zd) return;
        var z = +zd.getAttribute('data-z'); inst.select({ row: z }); if (opts.onRow) opts.onRow(z, zd);
      });
    }

    /* ---- resize: rebuilt only when the host's width moved by more than a pixel; selection and mode survive ---- */
    var lastW = host.clientWidth, raf = 0;
    if (global.ResizeObserver && !opts.width) {
      inst.ro = new global.ResizeObserver(function () {
        var w = host.clientWidth;
        if (Math.abs(w - lastW) < 2 || !w) return;
        lastW = w;
        if (raf) global.cancelAnimationFrame(raf);
        raf = global.requestAnimationFrame(function () { raf = 0; build(); });
      });
      inst.ro.observe(host);
    }
    function onTheme() { applyTheme(); }
    global.addEventListener('rz-theme-change', onTheme);
    if (global.MutationObserver) { inst.mo = new global.MutationObserver(onTheme); inst.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); }
    inst.destroy = function () {
      if (inst.ro) inst.ro.disconnect(); if (inst.mo) inst.mo.disconnect();
      global.removeEventListener('rz-theme-change', onTheme); host.innerHTML = ''; if (RZFloorPlan.current === inst) RZFloorPlan.current = null;
    };
    inst.focus = function (idx) { cursor = { k: 'r', idx: idx == null ? 0 : idx }; svg.focus(); showCursor(); };
    inst.thresholds = T;
    inst.rackEl = function (i) { return rackEls[i] && rackEls[i].g; };
    build();
    return inst;
  }

  /* ---------- legend: discrete keys, no bar (PRD 3.3) ---------------------------------------------------------- */
  function legend(box, mode, ratingKw, T) {
    T = T || DEFAULT_T;
    var rating = ratingKw || (RZFloorPlan.current && RZFloorPlan.current.model.ratingKw) || 20;
    var cur = RZFloorPlan.current, ps = cur && cur.host.querySelector('.fp-root'), nm = ['ok', 'warn', 'alarm', 'neutral'], q, w;
    if (ps) for (q = 0; q < nm.length; q++) for (w = 0; w < 3; w++) box.style.setProperty('--fp-' + nm[q] + '-t' + (w + 1), ps.style.getPropertyValue('--fp-' + nm[q] + '-t' + (w + 1)));
    box.innerHTML = '';
    box.className = (box.className.replace(/\bfp-legend\b/g, '') + ' fp-legend').replace(/^\s+/, '');
    function item(state, text) { var s = html('span', 'lg-item', box); html('span', 'fp-sw', s).setAttribute('data-state', state); s.appendChild(document.createTextNode(text)); }
    if (mode === 'space') { item('neutral', 'occupied'); item('spare', 'spare'); }
    else { item('ok', 'normal'); item('warn', 'warning'); item('alarm', 'alarm'); item('spare', 'spare'); }
    html('span', 'lg-item', box, 'height = rack load (kW / ' + rating.toFixed(0) + ' kW rating)');
    if (mode === 'temp') html('span', 'lg-item', box, 'warn > ' + T.inletMax + ' °C · alarm > ' + T.inletAlarm + ' °C');
    if (mode === 'cooling-margin') html('span', 'lg-item', box, 'warn < 0 K · alarm < −' + Math.abs(T.marginAlarm) + ' K');
  }

  var RZFloorPlan = {
    version: '1.0.0',
    MODES: MODES,
    current: null,
    render: function (host, model, opts) { var i = create(host, model, opts); RZFloorPlan.current = i; return i; },
    paint: function (mode) { if (RZFloorPlan.current) RZFloorPlan.current.paint(mode); },
    select: function (sel) { if (RZFloorPlan.current) RZFloorPlan.current.select(sel); },
    legend: legend,
    classify: classify,
    unit: function () { return RZFloorPlan.current ? RZFloorPlan.current.u : 0; },
    /* the steps of one theme as discrete hex values, computed in OKLCH from the stage's own state tokens */
    palette: function (theme) {
      var root = (RZFloorPlan.current && RZFloorPlan.current.host.querySelector('.fp-root')) || document.documentElement;
      var tk = readTokens(root);
      return buildPalette(tk.tokens, tk.ink, theme || themeOf());
    },
    oklch: function (hex) { var c = parseColor(hex); return c ? rgbToOklch(c) : null; },
    FACE_L: FACE_L, MAG_DL: MAG_DL, GEOMETRY: GEO, DEFAULT_THRESHOLDS: DEFAULT_T
  };
  global.RZFloorPlan = RZFloorPlan;
})(window);
