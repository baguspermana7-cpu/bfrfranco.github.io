/* RZConvPh — the pressure-enthalpy chart of a chiller's refrigeration cycle (PRD-CONV-EQUIPMENT-INSIDE §5.5, P2b).
   Draws, from the engine only (CONV_CALC 2.5.0+):
     - the R-134a saturation dome (CONV_CALC.r134a.dome(): NIST rows the engine carries),
     - isotherms in the vapour region every 10 K (CONV_CALC.r134a.vap over the engine's isobars), thin and recessive,
     - the cycle ① → ② → ③ → ④ → ⑤ → ⑥ → ⑦ → ⑧ → ① from snapshot.cooling.chiller_cycle_points, each segment in the
       medium colour the internal drawing uses for that refrigerant (--hmi-m-ref-*), points numbered in ink.
   Axes: h kJ/kg linear, P kPa(a) logarithmic (one axis per measure). Every point is focusable and carries its values in
   aria-label and a <title>; a table of the eight points sits under the chart. No digit typed here is a plant value:
   numbers are layout, tick steps and the 10 K isotherm step. ES5, no library. */
(function (root) {
  'use strict';
  if (!root || root.RZConvPh) return;
  var NS = 'http://www.w3.org/2000/svg';
  /* segment i -> i+1 (index into points 1..8, the last closes to 1) and its medium */
  var SEG = [[1, 2, 'ref_hpv'], [2, 3, 'ref_hpv'], [3, 4, 'ref_hpv'], [4, 5, 'ref_liq'], [5, 6, 'ref_flash'], [6, 7, 'ref_liq'],
    [7, 8, 'ref_flash'], [8, 1, 'ref_lpv']];
  var KEY = [['ref_lpv', 'Evaporation'], ['ref_hpv', 'Compression'], ['ref_liq', 'Condensing / liquid'], ['ref_flash', 'Expansion (flash)']];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f(v, d) { return typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—'; }
  function niceStep(span, n) { var r = span / n, p = Math.pow(10, Math.floor(Math.log(r) / Math.LN10)), m = r / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; }

  /* the data the chart needs, or null when the engine cannot give it */
  function data(calc, cooling) {
    var pts = cooling && cooling.chiller_cycle_points;
    if (!calc || !calc.r134a || typeof calc.r134a.dome !== 'function' || !Array.isArray(pts) || pts.length !== 8) return null;
    return { points: pts, dome: calc.r134a.dome(), isobars: calc.r134a.isobars(), vap: calc.r134a.vap, sat: calc.r134a.sat };
  }

  /* SVG string at a given pixel width (text stays at its CSS size at any width) */
  function svg(d, W) {
    var H = Math.round(Math.max(250, Math.min(390, W * 0.62))), L = 52, R = 14, T = 26, B = 38;
    var pw = W - L - R, ph = H - T - B, P = d.points;
    var hs = P.map(function (q) { return q.h_kj_kg; }), ps = P.map(function (q) { return q.p_kpa_abs; });
    var hMin = Math.min.apply(null, hs), hMax = Math.max.apply(null, hs);
    var h0 = Math.floor((hMin - 30) / 10) * 10, h1 = Math.ceil((hMax + 20) / 10) * 10;
    var pLo = Math.max(d.isobars[0], Math.min.apply(null, ps) / 1.6), pHi = Math.min(d.isobars[d.isobars.length - 1], Math.max.apply(null, ps) * 1.6);
    var lg = function (v) { return Math.log(v); };
    var X = function (h) { return L + (h - h0) / (h1 - h0) * pw; };
    var Y = function (p) { return T + (lg(pHi) - lg(p)) / (lg(pHi) - lg(pLo)) * ph; };
    var o = [];
    o.push('<svg xmlns="' + NS + '" class="rz-ph-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Pressure-enthalpy chart of the refrigeration cycle">');
    o.push('<defs><clipPath id="rzPhClip"><rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '"/></clipPath></defs>');
    /* grid + ticks: h every niceStep, P at 1-2-5 decades inside the range */
    var hs0 = niceStep(h1 - h0, Math.max(3, Math.floor(pw / 90))), g = [], t, k;
    for (t = Math.ceil(h0 / hs0) * hs0; t <= h1; t += hs0) {
      g.push('<line class="rz-ph-grid" x1="' + X(t).toFixed(1) + '" x2="' + X(t).toFixed(1) + '" y1="' + T + '" y2="' + (T + ph) + '"/>');
      g.push('<text class="rz-ph-tick" data-h-tick="' + t + '" x="' + X(t).toFixed(1) + '" y="' + (T + ph + 15) + '" text-anchor="middle">' + t + '</text>');
    }
    var dec = [100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000];
    for (k = 0; k < dec.length; k++) {
      t = dec[k]; if (t < pLo || t > pHi) continue;
      g.push('<line class="rz-ph-grid" x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '"/>');
      g.push('<text class="rz-ph-tick" data-p-tick="' + t + '" x="' + (L - 6) + '" y="' + (Y(t) + 4).toFixed(1) + '" text-anchor="end">' + t + '</text>');
    }
    o.push(g.join(''));
    o.push('<text class="rz-ph-axis" x="' + (L + pw) + '" y="' + (H - 4) + '" text-anchor="end">h kJ/kg</text>');
    o.push('<text class="rz-ph-axis" x="' + 4 + '" y="' + (T - 12) + '">P kPa(a), log</text>');
    o.push('<g clip-path="url(#rzPhClip)">');
    /* dome: liquid line up, vapour line down */
    var liq = [], vapL = [], r;
    for (k = 0; k < d.dome.length; k++) { r = d.dome[k]; if (r[1] >= pLo * 0.8 && r[1] <= pHi * 1.25) { liq.push(X(r[2]).toFixed(1) + ',' + Y(r[1]).toFixed(1)); vapL.unshift(X(r[3]).toFixed(1) + ',' + Y(r[1]).toFixed(1)); } }
    o.push('<polyline class="rz-ph-dome" data-ph-dome points="' + liq.concat(vapL).join(' ') + '"/>');
    /* isotherms every 10 K in the vapour region, from their saturation pressure down */
    var Tlo = Math.ceil(d.sat('P', pLo, 'T') / 10) * 10, Thi = Math.floor((d.sat('P', pHi, 'T') + 40) / 10) * 10, Ti, pp, hh, line, lab, placed = [];
    for (Ti = Tlo; Ti <= Thi; Ti += 10) {
      line = []; lab = null;
      for (k = d.isobars.length - 1; k >= 0; k--) {
        pp = d.isobars[k]; if (pp < pLo * 0.9 || pp > pHi * 1.1) continue;
        var ts = d.sat('P', pp, 'T'); if (ts === null || Ti < ts) continue;
        hh = d.vap(pp, 'T', Ti, 'h'); if (hh === null) continue;
        if (!lab) { var psat = d.sat('T', Ti, 'P'); var hg = psat === null ? null : d.sat('T', Ti, 'hg'); if (hg !== null && psat <= pHi) line.push(X(hg).toFixed(1) + ',' + Y(psat).toFixed(1)); lab = 1; }
        line.push(X(hh).toFixed(1) + ',' + Y(pp).toFixed(1));
      }
      if (line.length > 1) {
        o.push('<polyline class="rz-ph-iso" points="' + line.join(' ') + '"/>');
        var last = line[line.length - 1].split(',');
        /* a label only where it does not touch the previous one (isotherms converge at low pressure) */
        var lx0 = +last[0] + 3, lw = (String(Ti).length + 3) * 6.8;
        if (lx0 + lw < L + pw && placed.every(function (q) { return lx0 > q + 4; })) {
          o.push('<text class="rz-ph-isolab" x="' + lx0.toFixed(1) + '" y="' + (Math.min(+last[1], T + ph) - 3).toFixed(1) + '">' + Ti + ' °C</text>');
          placed.push(lx0 + lw);
        }
      }
    }
    /* the cycle */
    for (k = 0; k < SEG.length; k++) {
      var a = P[SEG[k][0] - 1], b = P[SEG[k][1] - 1];
      o.push('<line class="rz-ph-seg" data-ph-seg="' + SEG[k][0] + '-' + SEG[k][1] + '" style="stroke:var(--hmi-m-' + SEG[k][2].replace(/_/g, '-') + ')" x1="' + X(a.h_kj_kg).toFixed(1) + '" y1="' + Y(a.p_kpa_abs).toFixed(1) + '" x2="' + X(b.h_kj_kg).toFixed(1) + '" y2="' + Y(b.p_kpa_abs).toFixed(1) + '"/>');
    }
    o.push('</g>');
    /* points: 2 px surface ring, number placed away from the polygon centre */
    var cx = hs.reduce(function (s, v) { return s + X(v); }, 0) / 8, cy = ps.reduce(function (s, v) { return s + Y(v); }, 0) / 8;
    /* points drawn closer than 14 px share one label ("6·7"), set off from the member farthest from the centre */
    var near = P.map(function () { return null; }), j;
    for (k = 0; k < 8; k++) for (j = 0; j < k; j++) {
      if (near[j] === null && Math.abs(X(P[k].h_kj_kg) - X(P[j].h_kj_kg)) < 14 && Math.abs(Y(P[k].p_kpa_abs) - Y(P[j].p_kpa_abs)) < 14) { near[k] = j; break; }
    }
    var far = function (z) { var ex = X(z.h_kj_kg) - cx, ey = Y(z.p_kpa_abs) - cy; return ex * ex + ey * ey; };
    for (k = 0; k < 8; k++) {
      var q = P[k], x = X(q.h_kj_kg), y = Y(q.p_kpa_abs);
      var grp = P.filter(function (z, zi) { return zi === k || near[zi] === k; });
      var an = grp.reduce(function (m, z) { return far(z) > far(m) ? z : m; }, q), ax = X(an.h_kj_kg), ay = Y(an.p_kpa_abs);
      var dx = ax - cx, dy = ay - cy, n = Math.sqrt(dx * dx + dy * dy) || 1;
      var lx = ax + dx / n * (grp.length > 1 ? 18 : 14), ly = ay + dy / n * 14 + 4;
      var txt = near[k] !== null ? '' : grp.map(function (z) { return z.pt; }).join('·');
      var aria = q.pt + ' ' + q.where + ': ' + f(q.t_c, 1) + ' °C, ' + f(q.p_kpa_abs, 0) + ' kPa(a), h ' + f(q.h_kj_kg, 1) + ' kJ/kg' + (q.x === null ? '' : ', quality ' + f(q.x, 3));
      o.push('<g class="rz-ph-pt" tabindex="0" role="img" data-ph-pt="' + q.pt + '" data-h="' + q.h_kj_kg + '" data-p="' + q.p_kpa_abs + '" aria-label="' + esc(aria) + '"><title>' + esc(aria) + '</title>' +
        '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="8" class="rz-ph-hit"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" class="rz-ph-dot"/>' +
        (txt ? '<text class="rz-ph-num" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle">' + txt + '</text>' : '') + '</g>');
    }
    o.push('</svg>');
    return o.join('');
  }
  function table(d) {
    return '<details class="rz-ph-tablewrap"><summary>State points</summary><table class="rz-ph-table"><thead><tr><th scope="col">#</th><th scope="col">Where</th><th scope="col">T °C</th><th scope="col">P kPa(a)</th><th scope="col">h kJ/kg</th><th scope="col">s kJ/kg·K</th><th scope="col">x</th></tr></thead><tbody>' +
      d.points.map(function (q) { return '<tr data-ph-row="' + q.pt + '"><td>' + q.pt + '</td><td>' + esc(q.where) + '</td><td>' + f(q.t_c, 1) + '</td><td>' + f(q.p_kpa_abs, 0) + '</td><td>' + f(q.h_kj_kg, 1) + '</td><td>' + f(q.s_kj_kg_k, 4) + '</td><td>' + (q.x === null ? '—' : f(q.x, 3)) + '</td></tr>'; }).join('') +
      '</tbody></table></details>';
  }
  function key() {
    return '<div class="rz-ph-key">' + KEY.map(function (m) { return '<span><i style="--sw:var(--hmi-m-' + m[0].replace(/_/g, '-') + ')" aria-hidden="true"></i>' + esc(m[1]) + '</span>'; }).join('') + '</div>';
  }
  var CSS = '.rz-ph{min-width:0}.rz-ph-host{width:100%;overflow:hidden}' +
    '.rz-ph-svg{display:block;font:11px/1 "IBM Plex Mono",ui-monospace,monospace}' +
    '.rz-ph-grid{stroke:var(--cvm-line,rgba(127,127,127,.2));stroke-width:1}' +
    '.rz-ph-tick,.rz-ph-axis,.rz-ph-isolab{fill:var(--cvm-mute,#9aa4b2)}' +
    '.rz-ph-dome{fill:none;stroke:var(--cvm-text,#e8edf5);stroke-width:1.2;opacity:.7}' +
    '.rz-ph-iso{fill:none;stroke:var(--cvm-mute,#9aa4b2);stroke-width:1;opacity:.45}' +
    '.rz-ph-seg{stroke-width:2;stroke-linecap:round}' +
    '.rz-ph-dot{fill:var(--cvm-text,#e8edf5);stroke:var(--cvm-panel,#191b1f);stroke-width:2}.rz-ph-hit{fill:transparent}' +
    '.rz-ph-num{fill:var(--cvm-text,#e8edf5);font-weight:600}' +
    '.rz-ph-pt:focus{outline:none}.rz-ph-pt:focus .rz-ph-dot{stroke:var(--cvm-acc,#E8B563)}' +
    '.rz-ph-key{display:flex;flex-wrap:wrap;gap:4px 14px;margin:6px 0 2px;font:11px/1.3 "IBM Plex Sans",sans-serif;color:var(--cvm-mute,#9aa4b2)}' +
    '.rz-ph-key i{display:inline-block;width:14px;height:2px;margin-right:6px;vertical-align:middle;background:var(--sw)}' +
    '.rz-ph-tablewrap summary{cursor:pointer;font:12px/1.4 "IBM Plex Sans",sans-serif;color:var(--cvm-mute,#9aa4b2);min-height:24px}' +
    '.rz-ph-table{width:100%;border-collapse:collapse;font:11px/1.4 "IBM Plex Mono",ui-monospace,monospace;color:var(--cvm-text,#e8edf5)}' +
    '.rz-ph-table th,.rz-ph-table td{padding:3px 6px;border-bottom:1px solid var(--cvm-line,rgba(127,127,127,.2));text-align:right}' +
    '.rz-ph-table th:nth-child(2),.rz-ph-table td:nth-child(2){text-align:left}' +
    '.rz-ph-tablewrap{overflow-x:auto}';
  function css(doc) {
    if (doc.getElementById('rz-ph-css')) return;
    var s = doc.createElement('style'); s.id = 'rz-ph-css'; s.textContent = CSS; doc.head.appendChild(s);
  }
  /* markup for the section body; draw() fills the chart once the host has a width */
  function markup() { return '<div class="rz-ph"><div class="rz-ph-host" data-rz-ph></div>' + key() + '<div data-rz-ph-table></div></div>'; }
  function draw(host, calc, cooling) {
    if (!host) return false;
    var d = data(calc, cooling), doc = host.ownerDocument;
    css(doc);
    var tbl = host.parentNode && host.parentNode.querySelector('[data-rz-ph-table]');
    if (!d) { host.innerHTML = '<p class="rz-cvm-note">The engine does not publish this cycle.</p>'; if (tbl) tbl.innerHTML = ''; return false; }
    var W = Math.max(280, Math.floor(host.clientWidth || 600));
    host.innerHTML = svg(d, W);
    if (tbl) tbl.innerHTML = table(d);
    return true;
  }
  root.RZConvPh = { version: '1.0.0', markup: markup, draw: draw, data: data };
})(typeof window !== 'undefined' ? window : null);
