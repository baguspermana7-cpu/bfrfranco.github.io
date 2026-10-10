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
   *   facility = 520 + 1.18·IT + 0.62·CDD  (MWh) ± a fixed ±1.5 % pattern */
  var CDD = [160, 150, 175, 180, 190, 185, 190, 195, 185, 180, 170, 165];
  var NOISE = [0.6, -1.1, 0.9, -0.4, 1.4, -0.8, 0.2, -1.5, 1.0, -0.3, 0.7, -0.7];
  function synth(itBase, factor) {
    return CDD.map(function (c, i) {
      var it = itBase + 40 * Math.sin(i / 2);
      var fac = (520 + 1.18 * it + 0.62 * c) * factor * (1 + NOISE[i] / 100);
      return (i + 1) + ', ' + it.toFixed(0) + ', ' + c + ', ' + fac.toFixed(0);
    }).join('\n');
  }

  function val(id) { return parseFloat(document.getElementById(id).value); }
  function ro(k, v, u, s) { return '<div class="ltc-ro"' + (s ? ' data-state="' + s + '"' : '') + '><dt>' + k + '</dt><dd>' + v + (u ? '<small>' + u + '</small>' : '') + '</dd></div>'; }

  function runKpi() {
    var o = { e: val('kE'), it1: val('kI1'), it2: val('kI2'), it3: val('kI3'), ren: val('kRen'), reuse: val('kReuse'), water: val('kW'), ef: val('kEf') };
    var out = document.getElementById('kOut');
    var bad = !(o.e > 0 && o.it1 > 0 && o.it2 > 0 && o.it3 > 0) || o.it3 > o.it2 || o.it2 > o.it1 || o.it1 > o.e;
    if (bad) { out.innerHTML = '<div class="ltc-verdict" data-state="fail"><b>Input</b><span>Energies must satisfy facility ≥ UPS output ≥ PDU output ≥ IT input &gt; 0.</span></div>'; return; }
    var k = kpi(o);
    out.innerHTML = '<dl class="ltc-readouts">' +
      ro('PUE · cat 1 (UPS out)', L.fmt(k.pue1, 3), '') + ro('PUE · cat 2 (PDU out)', L.fmt(k.pue2, 3), '') + ro('PUE · cat 3 (IT input)', L.fmt(k.pue3, 3), '', 'ok') +
      ro('REF', L.fmt(k.ref, 2), '') + ro('ERF', L.fmt(k.erf, 2), '') + ro('WUE', L.fmt(k.wue, 2), 'L/kWh') + ro('CUE', L.fmt(k.cue, 3), 'kgCO₂/kWh') + '</dl>' +
      '<div class="ltc-verdict" data-state="warn"><b>Category gap</b><span>The same facility reports PUE ' + L.fmt(k.pue1, 3) + ' at category 1 and ' + L.fmt(k.pue3, 3) +
      ' at category 3: ' + L.fmt(o.it1 - o.it3, 0) + ' MWh of transformer, PDU and cord losses moves from “IT” to overhead. A PUE without its category is not comparable.</span></div>' +
      '<p class="ltc-note">ISO/IEC 30134-2 requires PUE over a 12-month period with the category stated. CUE here = (facility − renewable) × grid factor ÷ IT energy, a market-based simplification; report the accounting basis with the number.</p>';
    if (mFig) mFig.redraw();
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
      (rep.length ? '<div class="ltc-canvas">' + cusumChart(cus) + '</div><div class="ltc-table-wrap"><table class="ltc-table"><thead><tr><th>Month</th><th class="n">IT MWh</th><th class="n">CDD</th><th class="n">Predicted</th><th class="n">Actual</th><th class="n">Avoided</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '');
  }

  function boot() {
    L.init({ module: 'iso' });
    document.getElementById('p-kpi').addEventListener('input', runKpi);
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
