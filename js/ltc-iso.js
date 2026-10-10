/* ============================================================================
 * ltc-iso.js — energy KPI workbench (ISO/IEC 30134 · ISO 50001 / 50006)
 * ----------------------------------------------------------------------------
 * KPIs (ISO/IEC 30134, annual energies):
 *   PUE  = E_DC / E_IT, category 1/2/3 by where E_IT is metered (-2)
 *   REF  = E_ren / E_DC   (-3)        ERF = E_reuse / E_DC   (-6)
 *   WUE  = site water L / E_IT kWh (-9)
 *   CUE  = CO2 kg / E_IT kWh (-8), here (E_DC − E_ren) × grid factor — a
 *          market-based simplification, stated on the page
 * EnPI baseline (ISO 50006 / IPMVP Option C): ordinary least squares of
 * monthly facility energy on IT energy and cooling degree-days, judged by
 * ASHRAE Guideline 14 calibration limits (monthly CV(RMSE) ≤ 15 %, |NMBE| ≤ 5 %).
 * ==========================================================================*/
(function () {
  'use strict';
  var L = window.LTC;

  function kpi(o) {
    var it = o.it3 || o.it2 || o.it1;
    return {
      pue1: o.e / o.it1, pue2: o.e / o.it2, pue3: o.e / o.it3,
      ref: o.ren / o.e, erf: o.reuse / o.e,
      wue: o.water * 1000 / (it * 1000),           /* m³ → L over MWh → kWh */
      cue: Math.max(0, o.e - o.ren) * 1000 * o.ef / (it * 1000)
    };
  }

  /* OLS with an intercept: y = b0 + b1·x1 + b2·x2, via the 3×3 normal equations */
  function ols(rows) {
    var n = rows.length, S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
    rows.forEach(function (r) {
      var x = [1, r.it, r.cdd];
      for (var i = 0; i < 3; i++) { v[i] += x[i] * r.fac; for (var j = 0; j < 3; j++) S[i][j] += x[i] * x[j]; }
    });
    var b = solve3(S, v);
    if (!b) return null;
    var mean = rows.reduce(function (s, r) { return s + r.fac; }, 0) / n;
    var ssr = 0, sst = 0, bias = 0;
    rows.forEach(function (r) {
      var p = b[0] + b[1] * r.it + b[2] * r.cdd;
      ssr += (r.fac - p) * (r.fac - p); sst += (r.fac - mean) * (r.fac - mean); bias += r.fac - p;
    });
    var p_ = 3;
    return { b: b, r2: 1 - ssr / sst, cvrmse: 100 * Math.sqrt(ssr / (n - p_)) / mean, nmbe: 100 * bias / ((n - p_) * mean), n: n };
  }
  function solve3(A, y) {
    var M = A.map(function (r, i) { return r.concat([y[i]]); });
    for (var c = 0; c < 3; c++) {
      var p = c;
      for (var r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      var t = M[c]; M[c] = M[p]; M[p] = t;
      for (var r2 = 0; r2 < 3; r2++) {
        if (r2 === c) continue;
        var f = M[r2][c] / M[c][c];
        for (var k = c; k < 4; k++) M[r2][k] -= f * M[c][k];
      }
    }
    return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
  }
  function parse(txt) {
    return txt.split(/\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && !/^[a-z#]/i.test(l); })
      .map(function (l) { var p = l.split(/[,;\t ]+/).map(Number); return { m: p[0], it: p[1], cdd: p[2], fac: p[3] }; })
      .filter(function (r) { return [r.it, r.cdd, r.fac].every(isFinite); });
  }

  /* Synthetic example data — a stated formula, not a facility's meter data:
   *   facility = 150 + 1.12·IT + 0.35·CDD  (MWh) ± a fixed ±1.5 % pattern — PUE near 1.35 */
  var CDD = [160, 150, 175, 180, 190, 185, 190, 195, 185, 180, 170, 165];
  var NOISE = [0.6, -1.1, 0.9, -0.4, 1.4, -0.8, 0.2, -1.5, 1.0, -0.3, 0.7, -0.7];
  function synth(itBase, factor) {
    return CDD.map(function (c, i) {
      var it = itBase + 40 * Math.sin(i / 2);
      var fac = (150 + 1.12 * it + 0.35 * c) * factor * (1 + NOISE[i] / 100);
      return (i + 1) + ', ' + it.toFixed(0) + ', ' + c + ', ' + fac.toFixed(0);
    }).join('\n');
  }

  function val(id) { return parseFloat(document.getElementById(id).value); }
  function ro(k, v, u, s) { return '<div class="ltc-ro"' + (s ? ' data-state="' + s + '"' : '') + '><dt>' + k + '</dt><dd>' + v + (u ? '<small>' + u + '</small>' : '') + '</dd></div>'; }

  /* Source of the twelve-month energies. Default: the shared plant model (js/ltc-plant.js), so
   * the page asks for nothing the plant already knows. "Metered data" reopens the inputs,
   * prefilled with the model, and reports each meter against it. */
  var src = 'plant';
  function plantO() {
    var S = window.LTCPlantStrip; if (!S) return null;
    var r = S.get().result, A = r.annual;
    return { e: A.m0MWh, it1: A.m1MWh, it2: A.m2MWh, it3: A.m3MWh, ren: A.renewableMWh, reuse: A.reuseMWh, water: A.waterM3, ef: r.input.gridEfKgPerKwh, r: r };
  }
  function autoPanel(o) {
    var host = document.getElementById('kAuto'); if (!host) return;
    if (!o) { host.innerHTML = '<p class="ltc-note">Plant model not loaded.</p>'; return; }
    var row = function (k, v, u, f) { return '<div class="ltc-auto-row"><span>' + k + '</span><b>' + v + '</b><small>' + u + '</small><i title="' + L.esc(f) + '">auto</i></div>'; };
    host.innerHTML = '<div class="ltc-auto">' +
      row('Total facility (M0)', L.fmt(o.e, 0), 'MWh', 'Σ over climate bins of facility kW × hours') +
      row('UPS output (M1)', L.fmt(o.it1, 0), 'MWh', 'IT + cord + PDU losses (+ CDU pumps on UPS)') +
      row('PDU output (M2)', L.fmt(o.it2, 0), 'MWh', 'IT + rack PDU / cord losses') +
      row('IT input (M3)', L.fmt(o.it3, 0), 'MWh', 'IT MW × utilisation × 8,760 h') +
      row('Renewable', L.fmt(o.ren, 0), 'MWh', 'M0 × renewable share (site)') +
      row('Reused outside', L.fmt(o.reuse, 0), 'MWh', 'liquid heat × reuse share (site)') +
      row('Site water', L.fmt(o.water, 0), 'm³', 'tower + cooler evaporation × C/(C−1), over the bins') +
      row('Grid factor', L.fmt(o.ef, 2), 'kg/kWh', 'site layer') +
      '</div><p class="ltc-note">From the plant: ' + L.esc(o.r.input.itMw + ' MW IT, ' + (window.LTCPlant.CLIMATES[o.r.input.climate] || { label: 'custom climate' }).label) +
      '. Change the plant or the site in the strip above; switch to <b>Metered data</b> to enter real meter totals.</p>';
  }
  function prefill(o) {
    if (!o) return;
    [['kE', o.e], ['kI1', o.it1], ['kI2', o.it2], ['kI3', o.it3], ['kRen', o.ren], ['kReuse', o.reuse], ['kW', o.water], ['kEf', o.ef]].forEach(function (x) {
      var el = document.getElementById(x[0]); if (el) el.value = x[0] === 'kEf' ? x[1] : Math.round(x[1]);
    });
  }
  function runKpi() {
    var po = plantO();
    autoPanel(po);
    var o = src === 'plant' && po ? po
      : { e: val('kE'), it1: val('kI1'), it2: val('kI2'), it3: val('kI3'), ren: val('kRen'), reuse: val('kReuse'), water: val('kW'), ef: val('kEf') };
    var out = document.getElementById('kOut');
    var bad = !(o.e > 0 && o.it1 > 0 && o.it2 > 0 && o.it3 > 0) || o.it3 > o.it2 || o.it2 > o.it1 || o.it1 > o.e;
    if (bad) { out.innerHTML = '<div class="ltc-verdict" data-state="fail"><b>Input</b><span>Energies must satisfy facility ≥ UPS output ≥ PDU output ≥ IT input &gt; 0.</span></div>'; return; }
    var k = kpi(o);
    out.innerHTML = '<dl class="ltc-readouts">' +
      ro('PUE · cat 1 (UPS out)', L.fmt(k.pue1, 3), '') + ro('PUE · cat 2 (PDU out)', L.fmt(k.pue2, 3), '') + ro('PUE · cat 3 (IT input)', L.fmt(k.pue3, 3), '', 'ok') +
      ro('REF', L.fmt(k.ref, 2), '') + ro('ERF', L.fmt(k.erf, 2), '') + ro('WUE', L.fmt(k.wue, 2), 'L/kWh') + ro('CUE', L.fmt(k.cue, 3), 'kgCO₂/kWh') + '</dl>' +
      '<div class="ltc-verdict" data-state="warn"><b>Category gap</b><span>The same facility reports PUE ' + L.fmt(k.pue1, 3) + ' at category 1 and ' + L.fmt(k.pue3, 3) +
      ' at category 3: ' + L.fmt(o.it1 - o.it3, 0) + ' MWh of transformer, PDU and cord losses moves from “IT” to overhead. A PUE without its category is not comparable.</span></div>' +
      (src === 'meter' && po ? meterVsModel(o, po) : '') + sankey(o) +
      '<p class="ltc-note">ISO/IEC 30134-2 requires PUE over a 12-month period with the category stated. CUE here = (facility − renewable) × grid factor ÷ IT energy, a market-based simplification; report the accounting basis with the number.</p>';
    if (mFig) mFig.redraw();
  }

  /* Metered against modelled: a gap is either a meter problem or a model problem, and either is
   * worth knowing before the number is reported. */
  function meterVsModel(o, m) {
    var rows = [['M0 facility', o.e, m.e], ['M1 UPS output', o.it1, m.it1], ['M2 PDU output', o.it2, m.it2], ['M3 IT input', o.it3, m.it3], ['Water m³', o.water, m.water]];
    return '<div class="ltc-table-wrap" style="margin:12px 0"><table class="ltc-table"><thead><tr><th>Meter</th><th class="n">Metered</th><th class="n">Model</th><th class="n">Δ</th></tr></thead><tbody>' +
      rows.map(function (r) { var d = r[2] ? (r[1] - r[2]) / r[2] * 100 : 0; return '<tr' + (Math.abs(d) > 10 ? ' data-hit' : '') + '><td>' + r[0] + '</td><td class="n">' + L.fmt(r[1], 0) + '</td><td class="n">' + L.fmt(r[2], 0) + '</td><td class="n">' + (d >= 0 ? '+' : '−') + L.fmt(Math.abs(d), 1) + ' %</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  /* Energy Sankey from the four meters. Without sub-metering the overhead above
   * M1 (cooling, UPS loss, lighting) cannot be split, so it stays one band and
   * says so — the drawing shows what the meters can prove, not more. */
  function sankey(o) {
    var W = 640, H = 340, x0 = 24, x1 = 220, x2 = 430, bw = 14, gap = 10;
    var sinks = [['IT equipment (M3)', o.it3, 'g'], ['Rack PDU / cords (M2−M3)', o.it2 - o.it3, 'o'],
                 ['Transformer + PDU (M1−M2)', o.it1 - o.it2, 'o'], ['Cooling, UPS loss, other (M0−M1)', o.e - o.it1, 'r']];
    var srcs = [['Grid', Math.max(0, o.e - o.ren), 't3'], ['Renewable', Math.min(o.ren, o.e), 'c']];
    /* small bands get padded to a readable height, so reserve room for that padding */
    var usable = H - 40 - gap * (sinks.length - 1) - 26 * 3, k = usable / o.e;
    var g = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="sk-t sk-d" style="width:100%;max-width:' + W + 'px;min-width:340px">',
      '<title id="sk-t">Facility energy by metering point</title><desc id="sk-d">Grid and renewable supply into the facility, split by the four meters into IT energy and three overhead bands.</desc>',
      '<rect width="100%" height="100%" fill="var(--bg1)"/>'];
    function band(ax, ay, bx, by, h, col) {
      var c = (ax + bx) / 2;
      g.push('<path d="M' + ax + ' ' + ay + ' C' + c + ' ' + ay + ' ' + c + ' ' + by + ' ' + bx + ' ' + by +
        ' L' + bx + ' ' + (by + h) + ' C' + c + ' ' + (by + h) + ' ' + c + ' ' + (ay + h) + ' ' + ax + ' ' + (ay + h) + ' Z" fill="var(--' + col + ')" fill-opacity="0.22"/>');
    }
    var fy = 20 + (usable + gap * (sinks.length - 1) - o.e * k) / 2, sy = fy;
    srcs.forEach(function (sr) {
      var h = sr[1] * k; if (h <= 0) return;
      g.push('<rect x="' + x0 + '" y="' + sy + '" width="' + bw + '" height="' + h + '" fill="var(--' + sr[2] + ')"/>');
      g.push('<text x="' + (x0 + bw + 6) + '" y="' + (sy + 14) + '" fill="var(--t2)" font-size="11" font-family="IBM Plex Sans, sans-serif">' + sr[0] + ' ' + L.fmt(100 * sr[1] / o.e, 0) + ' %</text>');
      band(x0 + bw, sy, x1, sy, h, sr[2]); sy += h;
    });
    g.push('<rect x="' + x1 + '" y="' + fy + '" width="' + bw + '" height="' + (o.e * k) + '" fill="var(--t1)"/>',
      '<text x="' + (x1 + bw / 2) + '" y="' + (fy - 6) + '" fill="var(--t1)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">M0 ' + L.fmt(o.e, 0) + ' MWh</text>');
    var ay = fy, by = 20;
    sinks.forEach(function (sk) {
      var h = Math.max(0, sk[1] * k);
      band(x1 + bw, ay, x2, by, h, sk[2]);
      g.push('<rect x="' + x2 + '" y="' + by + '" width="' + bw + '" height="' + Math.max(1, h) + '" fill="var(--' + sk[2] + ')"/>',
        '<text x="' + (x2 + bw + 6) + '" y="' + (by + Math.max(h, 12) / 2 + 4) + '" fill="var(--t2)" font-size="11" font-family="IBM Plex Sans, sans-serif">' + sk[0] + '</text>',
        '<text x="' + (x2 + bw + 6) + '" y="' + (by + Math.max(h, 12) / 2 + 17) + '" fill="var(--t3)" font-size="10.5" font-family="JetBrains Mono, monospace">' + L.fmt(sk[1], 0) + ' MWh · ' + L.fmt(100 * sk[1] / o.e, 1) + ' %</text>');
      ay += h; by += h + gap + (h < 26 ? 26 - h : 0);
    });
    g.push('</svg>');
    return '<div class="ltc-canvas">' + g.join('') + '</div>';
  }

  /* Monthly PUE: the annual figure is energy-weighted (ΣE ÷ ΣIT), which is not
   * the average of twelve monthly PUEs — a common reporting error. */
  function pueTrend(rows) {
    rows = rows.filter(function (q) { return q.it > 0 && q.fac > 0; });
    if (rows.length < 2) return { svg: '<p class="ltc-note">Need two or more months with IT and facility energy above 0.</p>', annual: NaN, mean: NaN };
    var W = 640, H = 200, l = 48, r = 16, t = 16, b = 30;
    var p = rows.map(function (q) { return q.fac / q.it; });
    var sE = rows.reduce(function (a, q) { return a + q.fac; }, 0), sI = rows.reduce(function (a, q) { return a + q.it; }, 0);
    var annual = sE / sI, mean = p.reduce(function (a, v) { return a + v; }, 0) / p.length;
    var lo = Math.min.apply(null, p.concat([annual])) - 0.02, hi = Math.max.apply(null, p.concat([annual])) + 0.02;
    var X = function (i) { return l + (i + 0.5) / p.length * (W - l - r); }, Y = function (v) { return t + (1 - (v - lo) / (hi - lo)) * (H - t - b); };
    var bw = (W - l - r) / p.length * 0.6;
    var g = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="pt-t pt-d" style="width:100%;max-width:' + W + 'px;min-width:340px">',
      '<title id="pt-t">Monthly PUE</title><desc id="pt-d">PUE for each month with the energy-weighted annual PUE as a line.</desc>',
      '<rect width="100%" height="100%" fill="var(--bg1)"/>'];
    [lo, (lo + hi) / 2, hi].forEach(function (v) {
      g.push('<line x1="' + l + '" y1="' + Y(v) + '" x2="' + (W - r) + '" y2="' + Y(v) + '" stroke="var(--bd)" stroke-width="0.6"/><text x="' + (l - 6) + '" y="' + (Y(v) + 4) + '" fill="var(--t3)" font-size="11" text-anchor="end" font-family="JetBrains Mono, monospace">' + v.toFixed(3) + '</text>');
    });
    p.forEach(function (v, i) {
      g.push('<rect x="' + (X(i) - bw / 2) + '" y="' + Y(v) + '" width="' + bw + '" height="' + (H - b - Y(v)) + '" fill="var(--c)" fill-opacity="0.35" stroke="var(--c)" stroke-width="0.8"/>',
        '<text x="' + X(i) + '" y="' + (H - 10) + '" fill="var(--t3)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">' + rows[i].m + '</text>');
    });
    g.push('<line x1="' + l + '" y1="' + Y(annual) + '" x2="' + (W - r) + '" y2="' + Y(annual) + '" stroke="var(--o)" stroke-width="1.6"/>',
      '<text x="' + (W - r) + '" y="' + (Y(annual) - 6) + '" fill="var(--o)" font-size="11" text-anchor="end" font-family="JetBrains Mono, monospace">annual ' + annual.toFixed(3) + '</text></svg>');
    return { svg: '<div class="ltc-canvas">' + g.join('') + '</div>', annual: annual, mean: mean };
  }

  /* metering points */
  var mFig = null;
  var METERS = {
    m0: { name: 'M0 · facility', sub: 'utility + on-site gen', body: 'Total facility energy E_DC, the numerator of every PUE category.' },
    m1: { name: 'M1 · UPS output', sub: 'PUE category 1', body: 'Category 1 (basic): IT energy measured at the UPS output.' },
    m2: { name: 'M2 · PDU output', sub: 'PUE category 2', body: 'Category 2 (intermediate): IT energy at the PDU output — PDU and transformer losses count as overhead.' },
    m3: { name: 'M3 · IT input', sub: 'PUE category 3', body: 'Category 3 (advanced): IT energy at the IT equipment input — the most accurate, and the most metering.' }
  };
  function meterBuild(D, o) {
    var d = D.create({ slug: 'meters', title: 'Where each PUE category meters IT energy',
      desc: 'The facility meter at the utility intake, and IT energy metered at the UPS output for category 1, the PDU output for category 2, and the IT equipment input for category 3.' });
    var box = {}, G = 48;
    var chain = [['util', 'Utility intake', 'utility', 'facility boundary'], ['ups', 'UPS', 'ups', 'conversion losses'],
                 ['pdu', 'PDU', 'pdu', 'transformer + panels'], ['it', 'IT equipment', 'rack', 'servers, storage, net']];
    var meters = ['m0', 'm1', 'm2', 'm3'];
    /* wide: power chain on top, meters below. narrow: chain down the left, meters beside it */
    var x = 16, y = 16, top = [];
    chain.forEach(function (c) {
      box[c[0]] = d.node(x, y, { id: c[0], name: c[1], sublabel: c[3], symbol: c[2], legend: 'Power equipment', w: 144 });
      top.push(box[c[0]]);
      if (o.narrow) y = box[c[0]].y + box[c[0]].h + 32; else x = box[c[0]].x + box[c[0]].w + G;
    });
    for (var i = 1; i < chain.length; i++) {
      var A = box[chain[i - 1][0]], B = box[chain[i][0]];
      d.edge(o.narrow ? { x: A.x + A.w / 2, y: A.y + A.h } : { x: A.x + A.w, y: A.y + A.h / 2 },
             o.narrow ? { x: B.x + B.w / 2, y: B.y } : { x: B.x, y: B.y + B.h / 2 },
             { fromId: chain[i - 1][0], toId: chain[i][0], tier: 1, stroke: 'ink', legend: i === 1 ? 'Power' : undefined });
    }
    var my = top[0].y + top[0].h + 48, mx = top[0].x + top[0].w + 40;
    meters.forEach(function (m, i) {
      var host = top[i], mm = METERS[m];
      box[m] = d.node(o.narrow ? mx : host.x, o.narrow ? host.y : my, { id: m, name: mm.name, sublabel: mm.sub, symbol: 'meter', interactive: true,
        w: o.narrow ? undefined : host.w, dashed: m !== 'm3', focal: m === 'm3', fill: m === 'm3' ? 'paper-2' : 'paper', tier: m === 'm3' ? 1 : 2,
        legend: m === 'm3' ? 'Most accurate metering point' : 'Meter' });
      var M = box[m];
      d.edge(o.narrow ? { x: M.x, y: M.y + M.h / 2 } : { x: host.x + host.w / 2, y: M.y },
             o.narrow ? { x: host.x + host.w, y: host.y + host.h / 2 } : { x: host.x + host.w / 2, y: host.y + host.h },
             { fromId: m, toId: chain[i][0], pattern: 'dotted', stroke: 'soft', marker: false, legend: i === 0 ? 'Measures' : undefined });
    });
    d.legend();
    return d;
  }

  /* EnPI baseline and CUSUM */
  var CH = { W: 640, H: 260, l: 56, r: 16, t: 16, b: 32 };
  function cusumChart(vals) {
    var n = vals.length, mx = Math.max.apply(null, vals.map(Math.abs).concat([1]));
    function sx(i) { return CH.l + i / Math.max(1, n - 1) * (CH.W - CH.l - CH.r); }
    function sy(v) { return CH.t + (1 - (v + mx) / (2 * mx)) * (CH.H - CH.t - CH.b); }
    var s = ['<svg viewBox="0 0 ' + CH.W + ' ' + CH.H + '" role="img" aria-labelledby="cu-t cu-d" style="width:100%;max-width:' + CH.W + 'px;min-width:340px">',
      '<title id="cu-t">CUSUM of savings</title><desc id="cu-d">Cumulative difference between baseline-predicted and actual monthly facility energy; a rising line means sustained savings.</desc>',
      '<rect width="100%" height="100%" fill="var(--bg1)"/>',
      '<line x1="' + CH.l + '" y1="' + sy(0) + '" x2="' + (CH.W - CH.r) + '" y2="' + sy(0) + '" stroke="var(--bd2)" stroke-width="1"/>'];
    [mx, mx / 2, -mx / 2, -mx].forEach(function (g) {
      s.push('<line x1="' + CH.l + '" y1="' + sy(g) + '" x2="' + (CH.W - CH.r) + '" y2="' + sy(g) + '" stroke="var(--bd)" stroke-width="0.6"/>');
      s.push('<text x="' + (CH.l - 6) + '" y="' + (sy(g) + 4) + '" fill="var(--t3)" font-size="11" text-anchor="end" font-family="JetBrains Mono, monospace">' + L.fmt(g, 0) + '</text>');
    });
    s.push('<text x="' + (CH.l - 6) + '" y="' + (sy(0) + 4) + '" fill="var(--t3)" font-size="11" text-anchor="end" font-family="JetBrains Mono, monospace">0</text>');
    s.push('<path d="M' + vals.map(function (v, i) { return sx(i).toFixed(1) + ' ' + sy(v).toFixed(1); }).join(' L') + '" fill="none" stroke="var(--o)" stroke-width="1.6"/>');
    vals.forEach(function (v, i) {
      s.push('<circle cx="' + sx(i) + '" cy="' + sy(v) + '" r="3" fill="var(--o)"/>');
      s.push('<text x="' + sx(i) + '" y="' + (CH.H - 10) + '" fill="var(--t3)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">' + (i + 1) + '</text>');
    });
    s.push('</svg>');
    return s.join('');
  }
  function runEnpi() {
    var base = parse(document.getElementById('eBase').value), rep = parse(document.getElementById('eRep').value);
    var out = document.getElementById('eOut');
    if (base.length < 6) { out.innerHTML = '<div class="ltc-verdict" data-state="fail"><b>Data</b><span>At least 6 baseline months are needed (12 recommended).</span></div>'; return; }
    var m = ols(base);
    if (!m) { out.innerHTML = '<div class="ltc-verdict" data-state="fail"><b>Data</b><span>The baseline cannot be fitted — IT energy and degree-days must vary.</span></div>'; return; }
    var okFit = m.cvrmse <= 15 && Math.abs(m.nmbe) <= 5;
    var cum = 0, cus = [], save = 0, act = 0;
    var rows = rep.map(function (r) {
      var p = m.b[0] + m.b[1] * r.it + m.b[2] * r.cdd;
      cum += p - r.fac; cus.push(cum); save += p - r.fac; act += r.fac;
      return '<tr><td class="mono">' + r.m + '</td><td class="n">' + L.fmt(r.it, 0) + '</td><td class="n">' + L.fmt(r.cdd, 0) + '</td><td class="n">' + L.fmt(p, 0) + '</td><td class="n">' + L.fmt(r.fac, 0) + '</td><td class="n">' + L.fmt(p - r.fac, 0) + '</td></tr>';
    });
    out.innerHTML = '<div class="ltc-verdict" data-state="' + (okFit ? 'ok' : 'warn') + '"><b>' + (okFit ? 'Baseline usable' : 'Baseline weak') + '</b><span>CV(RMSE) ' + L.fmt(m.cvrmse, 1) + ' % (limit 15 %), NMBE ' + L.fmt(m.nmbe, 2) + ' % (limit ±5 %), R² ' + L.fmt(m.r2, 3) + '.</span></div>' +
      '<dl class="ltc-readouts">' + ro('Fixed load b0', L.fmt(m.b[0], 1), 'MWh/mo') + ro('Per MWh IT b1', L.fmt(m.b[1], 3), '') + ro('Per CDD b2', L.fmt(m.b[2], 3), 'MWh') +
      ro('Avoided energy', L.fmt(save, 0), 'MWh', save >= 0 ? 'ok' : 'fail') + ro('Savings', act ? L.fmt(100 * save / (act + save), 1) : '—', '%', save >= 0 ? 'ok' : 'fail') + '</dl>' +
      (function () {
        var pt = pueTrend(rep.length ? rep : base);
        if (!isFinite(pt.annual)) return pt.svg;
        return '<div class="ltc-box"><div class="ltc-box-h">PUE by month · ' + (rep.length ? 'reporting' : 'baseline') + ' period</div><div class="ltc-box-b">' + pt.svg +
          '<p class="ltc-note">Annual PUE is energy-weighted: ΣE ÷ ΣIT = <b>' + pt.annual.toFixed(3) + '</b>. The average of the monthly PUEs is ' + pt.mean.toFixed(3) +
          ' — a different number (' + (pt.mean - pt.annual >= 0 ? '+' : '') + (pt.mean - pt.annual).toFixed(4) + '). Report the weighted one.</p></div></div>';
      })() +
      (rep.length ? '<div class="ltc-canvas">' + cusumChart(cus) + '</div><div class="ltc-table-wrap"><table class="ltc-table"><thead><tr><th>Month</th><th class="n">IT MWh</th><th class="n">CDD</th><th class="n">Predicted</th><th class="n">Actual</th><th class="n">Avoided</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '');
  }

  function boot() {
    L.init({ module: 'iso' });
    document.getElementById('p-kpi').addEventListener('input', runKpi);
    document.getElementById('kSrc').addEventListener('click', function (e) {
      var b = e.target.closest('[data-src]'); if (!b) return;
      src = b.getAttribute('data-src');
      [].forEach.call(this.querySelectorAll('[data-src]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      document.getElementById('kAuto').hidden = src !== 'plant';
      document.getElementById('kMeter').hidden = src !== 'meter';
      if (src === 'meter') prefill(plantO());
      runKpi();
    });
    if (window.LTCPlantStrip) window.LTCPlantStrip.onChange(function () { runKpi(); });
    document.getElementById('eBase').value = synth(900, 1);
    document.getElementById('eRep').value = synth(960, 0.95);
    document.getElementById('p-enpi').addEventListener('input', runEnpi);
    mFig = L.draw(document.getElementById('mFig'), meterBuild, function (id) {
      var m = METERS[id];
      if (m) L.inspect({ sym: 'meter', eyebrow: 'ISO/IEC 30134-2', title: m.name, html: '<p>' + L.esc(m.body) + '</p>' });
    });
    runKpi(); runEnpi();
    if (window.matchMedia('(min-width: 1280px)').matches) L.inspect({ sym: 'meter', eyebrow: 'ISO/IEC 30134-2', title: METERS.m3.name, html: '<p>' + METERS.m3.body + '</p>' });
  }
  window.LTCIso = { kpi: kpi, ols: ols, parse: parse };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
