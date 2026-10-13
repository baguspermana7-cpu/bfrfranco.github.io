/* ltc-report.js — the plant as one engineering report: every number, every figure, every formula.
 *
 * Owner: "bisa di export jadi super detail report … ada rendering datanya yang keluar data …
 * bener2 comprehensive". So "Export report" on the plant strip writes a standalone document from
 * the same LTCPlant result the pages draw: KPIs, the heat balance as a Sankey, the power and
 * metering cascade, the climate bins, DH01 in plan under every fault, the transients, the
 * redundancy register, the standards cross-check, every calculation trace, every input with its
 * auto / yours state — and the data itself (JSON, CSV) inside the file, downloadable from it.
 *
 * build(R, ctx) is pure (string in, string out) so the test can run it without a browser and
 * check that what the report says equals what the engine computed.
 */
(function (root) {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f(v, d) {
    if (v == null || !isFinite(v)) return '—';
    return Number(v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d || 0 });
  }
  function mw(kw, d) { return f(kw / 1000, d == null ? 2 : d); }
  function pct(a, b) { return b ? f(100 * a / b, 1) + ' %' : '—'; }
  function table(head, rows, cls) {
    return '<div class="tw"><table' + (cls ? ' class="' + cls + '"' : '') + '><thead><tr>' + head.map(function (h, i) {
      return '<th' + (i ? ' class="n"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i ? ' class="n"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div>';
  }
  /* sections number themselves in the order they are written; the contents list is built from them */
  var TOC = [];
  function sec(id, n, title, lead, body) {
    TOC.push(title); n = TOC.length;
    return '<section id="s' + n + '"><h2><span class="no">' + n + '</span>' + esc(title) + '</h2>' + (lead ? '<p class="lead">' + lead + '</p>' : '') + body + '</section>';
  }

  /* ---- figures (pure SVG) ------------------------------------------------------------- */
  var C = { liq: '#0e8fb0', air: '#3a7bd5', elec: '#d08a00', chw: '#5b6abf', heat: '#c2410c', ok: '#1a8f4e', bad: '#c62828', grid: '#d5d9df', t2: '#4b5563', t3: '#8a919c' };

  /* heat balance, two stages; every band is a number the engine computed, and the right column
     must equal the left (checked in the text below the figure and in the test) */
  function heatFlows(R) {
    var d = R.design, s = R.totals.split;
    var into = d.erFans + d.chwPump;   // fans and pumps on the CHW side add heat to the chillers' load
    return {
      left: [['liq', 'Liquid path (cold plates + TCS pumps + CDU skin)', s.liquid, C.liq], ['air', 'Air path (residual IT + CRAH fans)', s.air, C.air],
             ['elec', 'Electrical rooms (UPS, distribution, transformer losses)', s.elec, C.elec], ['aux', 'CHW pumps + room fans', into, C.t3]],
      right: [['cool', 'Liquid coolers (' + R.liquid.coolerType + ')', d.cooler.qCooler, C.liq], ['trim', 'Trim chillers', d.trimKw, C.heat], ['chill', 'Chillers (evaporator)', d.evap, C.chw]],
      links: [['liq', 'cool', d.cooler.qCooler], ['liq', 'trim', d.trimKw], ['air', 'chill', s.air], ['elec', 'chill', s.elec], ['aux', 'chill', into]]
    };
  }
  function sankey(R) {
    var F = heatFlows(R), W = 760, H = 330, x0 = 230, x1 = 530, bw = 14, gap = 14;
    var totL = F.left.reduce(function (a, n) { return a + n[2]; }, 0), totR = F.right.reduce(function (a, n) { return a + n[2]; }, 0);
    var k = (H - 20 - gap * 3) / Math.max(totL, totR), pos = {}, y = 10, out = [];
    F.left.forEach(function (n) { pos[n[0]] = { y: y, h: Math.max(1, n[2] * k), off: 0 }; y += n[2] * k + gap; });
    y = 10;
    F.right.forEach(function (n) { pos[n[0]] = { y: y, h: Math.max(1, n[2] * k), off: 0 }; y += n[2] * k + gap + 8; });
    F.links.forEach(function (l) {
      var a = pos[l[0]], b = pos[l[1]], h = l[2] * k, ya = a.y + a.off + h / 2, yb = b.y + b.off + h / 2, col = F.left.filter(function (n) { return n[0] === l[0]; })[0][3];
      a.off += h; b.off += h;
      out.push('<path d="M' + (x0 + bw) + ' ' + ya + ' C' + ((x0 + x1) / 2) + ' ' + ya + ' ' + ((x0 + x1) / 2) + ' ' + yb + ' ' + x1 + ' ' + yb + '" stroke="' + col + '" stroke-opacity=".35" stroke-width="' + Math.max(1, h) + '" fill="none"><title>' + esc(f(l[2]) + ' kW') + '</title></path>');
    });
    /* a thin band's label would sit on its neighbour's: labels keep 30 px apart, a leader joins them */
    function labels(nodes, x, anchor, name) {
      var ly = -99;
      nodes.forEach(function (n) {
        var p = pos[n[0]], c = p.y + p.h / 2, y = Math.max(c, ly + 30), tx = anchor === 'end' ? x - 8 : x + bw + 8;
        ly = y; H = Math.max(H, y + 18);
        if (Math.abs(y - c) > 1) out.push('<path d="M' + (anchor === 'end' ? x - 2 : x + bw + 2) + ' ' + c + ' L' + (anchor === 'end' ? x - 6 : x + bw + 6) + ' ' + (y - 4) + '" stroke="' + C.t3 + '" fill="none"/>');
        out.push('<rect x="' + x + '" y="' + p.y + '" width="' + bw + '" height="' + p.h + '" fill="' + n[3] + '"/>' +
          '<text x="' + tx + '" y="' + (y - 2) + '"' + (anchor === 'end' ? ' text-anchor="end"' : '') + ' class="sl">' + esc(name(n)) + '</text>' +
          '<text x="' + tx + '" y="' + (y + 11) + '"' + (anchor === 'end' ? ' text-anchor="end"' : '') + ' class="sv">' + mw(n[2]) + ' MW</text>');
      });
    }
    labels(F.left, x0, 'end', function (n) { return n[1].split(' (')[0]; });
    labels(F.right, x1, 'start', function (n) { return n[1]; });
    return { svg: '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Heat balance Sankey">' + out.join('') + '</svg>', totL: totL, totR: totR, F: F };
  }

  /* facility power, item by item; the residual against the engine's facility total is printed */
  function powerItems(R) {
    var d = R.design;
    return [
      ['IT load (M3)', d.it, 'it'], ['Power cords', d.cordLoss, 'elec'], ['PDU / RPP losses', d.pduLoss, 'elec'], ['TCS pumps (CDU)', d.tcsPump, 'liq'],
      ['UPS losses', d.upsLoss, 'elec'], ['Distribution losses', d.distLoss, 'elec'], ['Transformer losses', d.txLoss, 'elec'],
      ['Trim chillers', d.trimKwe, 'liq'], ['Liquid cooler fans', d.coolerFans, 'liq'], ['FWS pumps', d.fwsPump, 'liq'],
      ['CRAH fans', d.crahFans, 'air'], ['Chillers', d.chillerKwe, 'air'], ['CHW pumps', d.chwPump, 'air'], ['CW pumps', d.cwPump, 'air'],
      ['Tower fans', d.towerFans, 'air'], ['Electrical-room fans', d.erFans, 'elec'], ['Auxiliary (lighting, BMS, security)', d.auxKw, 'elec']
    ];
  }
  function barsH(items, total, unit) {
    var W = 760, rh = 22, H = items.length * rh + 8, lx = 250, max = Math.max.apply(null, items.map(function (i) { return i[1]; }));
    var col = { it: '#6b7280', elec: C.elec, liq: C.liq, air: C.air };
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Breakdown">' + items.map(function (it, i) {
      var y = 4 + i * rh, w = Math.max(1, (W - lx - 190) * it[1] / max);
      return '<text x="' + (lx - 8) + '" y="' + (y + 14) + '" text-anchor="end" class="sl">' + esc(it[0]) + '</text>' +
        '<rect x="' + lx + '" y="' + (y + 3) + '" width="' + w + '" height="' + (rh - 8) + '" fill="' + (col[it[2]] || C.t2) + '"/>' +
        '<text x="' + (lx + w + 6) + '" y="' + (y + 14) + '" class="sv">' + f(it[1]) + ' ' + unit + ' · ' + pct(it[1], total) + '</text>';
    }).join('') + '</svg>';
  }

  /* metering cascade M0 → M3, annual MWh; the gaps are the losses each category of PUE includes */
  function meters(R) {
    var A = R.annual, m = [['M0 facility input', A.m0MWh], ['M1 UPS output', A.m1MWh], ['M2 PDU output', A.m2MWh], ['M3 IT input', A.m3MWh]];
    var W = 760, H = 170, bw = 130, gx = 50, max = A.m0MWh;
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Metering cascade">' + m.map(function (r, i) {
      var h = 100 * r[1] / max, x = 40 + i * (bw + gx);
      return '<rect x="' + x + '" y="' + (122 - h) + '" width="' + bw + '" height="' + h + '" fill="' + (i ? C.liq : C.elec) + '" fill-opacity="' + (1 - i * 0.18) + '"/>' +
        '<text x="' + (x + bw / 2) + '" y="' + (116 - h) + '" text-anchor="middle" class="sv">' + f(r[1]) + ' MWh</text>' +
        '<text x="' + (x + bw / 2) + '" y="140" text-anchor="middle" class="sl">' + esc(r[0]) + '</text>' +
        (i ? '<text x="' + (x - gx / 2) + '" y="162" text-anchor="middle" class="sd">−' + f(m[i - 1][1] - r[1]) + ' MWh</text>' : '');
    }).join('') + '</svg>';
  }

  /* climate bins: column width ∝ hours, height ∝ PUE overhead; the trim chiller bins marked */
  function binsChart(R) {
    var B = R.totals.bins, hrs = R.totals.hours, W = 760, H = 220, x = 50, plotW = W - 70, maxO = Math.max.apply(null, B.map(function (b) { return b.pue - 1; })) * 1.15;
    var out = ['<line x1="50" y1="170" x2="' + (W - 20) + '" y2="170" stroke="' + C.grid + '"/>'];
    [0.25, 0.5, 0.75, 1].forEach(function (q) {
      var v = 1 + maxO * q, y = 170 - 150 * q;
      out.push('<line x1="50" y1="' + y + '" x2="' + (W - 20) + '" y2="' + y + '" stroke="' + C.grid + '" stroke-dasharray="2 3"/><text x="44" y="' + (y + 4) + '" text-anchor="end" class="sd">' + f(v, 2) + '</text>');
    });
    B.forEach(function (b) {
      var w = plotW * b.hours / hrs, h = 150 * (b.pue - 1) / maxO;
      out.push('<rect x="' + (x + 1) + '" y="' + (170 - h) + '" width="' + Math.max(1, w - 2) + '" height="' + h + '" fill="' + (b.trimShare > 0 ? C.heat : C.liq) + '" fill-opacity=".8"><title>' + esc(b.db + ' °C db / ' + b.wb + ' °C wb · ' + b.hours + ' h · PUE ' + f(b.pue, 3)) + '</title></rect>' +
        (w > 34 ? '<text x="' + (x + w / 2) + '" y="' + (164 - h) + '" text-anchor="middle" class="sv">' + f(b.pue, 3) + '</text><text x="' + (x + w / 2) + '" y="186" text-anchor="middle" class="sd">' + b.db + '°C</text><text x="' + (x + w / 2) + '" y="200" text-anchor="middle" class="sd">' + f(b.hours) + ' h</text>' : ''));
      x += w;
    });
    out.push('<text x="50" y="216" class="sd">column width = hours in the bin · red = trim chillers running in that bin</text>');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="PUE by climate bin">' + out.join('') + '</svg>';
  }

  /* a transient: temperature vs minutes, the limit line, the moment it is crossed */
  function transientChart(t) {
    var W = 360, H = 190, s = t.series, last = s[s.length - 1][0], lo = Math.min(s[0][1], t.limitC) - 2;
    var hi = Math.min(Math.max(t.limitC + 4, s.reduce(function (m, p) { return Math.max(m, p[1]); }, -99)), t.limitC + 20);
    function X(m) { return 40 + (W - 55) * m / last; }
    function Y(v) { return 160 - 140 * (Math.min(v, hi) - lo) / (hi - lo); }
    var pts = s.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ');
    var hit = t.secondsToLimit != null ? '<line x1="' + X(t.secondsToLimit / 60) + '" y1="20" x2="' + X(t.secondsToLimit / 60) + '" y2="160" stroke="' + C.bad + '" stroke-dasharray="3 3"/><text x="' + (X(t.secondsToLimit / 60) + 4) + '" y="32" class="sd" fill="' + C.bad + '">' + f(t.secondsToLimit) + ' s</text>' : '';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t.label) + ' after the fault">' +
      '<line x1="40" y1="160" x2="' + (W - 15) + '" y2="160" stroke="' + C.grid + '"/><line x1="40" y1="20" x2="40" y2="160" stroke="' + C.grid + '"/>' +
      '<line x1="40" y1="' + Y(t.limitC) + '" x2="' + (W - 15) + '" y2="' + Y(t.limitC) + '" stroke="' + C.bad + '"/><text x="' + (W - 15) + '" y="' + (Y(t.limitC) - 4) + '" text-anchor="end" class="sd" fill="' + C.bad + '">limit ' + f(t.limitC, 1) + ' °C</text>' +
      '<polyline points="' + pts + '" fill="none" stroke="' + C.heat + '" stroke-width="1.6"/>' + hit +
      '<text x="36" y="' + (Y(lo) + 4) + '" text-anchor="end" class="sd">' + f(lo, 0) + '</text><text x="36" y="' + (Y(hi) + 4) + '" text-anchor="end" class="sd">' + f(hi, 0) + '</text>' +
      '<text x="40" y="178" class="sd">0</text><text x="' + (W - 15) + '" y="178" text-anchor="end" class="sd">' + f(last, 0) + ' min</text></svg>';
  }

  /* DH01 in plan: racks shaded by inlet temperature, CDUs, CRAHs, cold aisles */
  var STOPS = [[18, [40, 90, 200]], [24, [0, 190, 220]], [27, [0, 200, 120]], [32, [240, 190, 0]], [38, [240, 90, 40]], [45, [200, 20, 40]]];
  function ramp(t) {
    if (t <= STOPS[0][0]) return 'rgb(' + STOPS[0][1] + ')';
    for (var i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
      var a = STOPS[i - 1], b = STOPS[i], u = (t - a[0]) / (b[0] - a[0]);
      return 'rgb(' + [0, 1, 2].map(function (c) { return Math.round(a[1][c] + (b[1][c] - a[1][c]) * u); }) + ')';
    }
    return 'rgb(' + STOPS[STOPS.length - 1][1] + ')';
  }
  function hallPlan(R, s, title) {
    var h = R.hall, p = R.input, k = 300 / h.lengthM, W = 300, H = h.widthM * k, o = [];
    function r(x, y, w, hh, fill, extra) { return '<rect x="' + (x * k).toFixed(1) + '" y="' + (y * k).toFixed(1) + '" width="' + (w * k).toFixed(1) + '" height="' + (hh * k).toFixed(1) + '" fill="' + fill + '"' + (extra || '') + '/>'; }
    o.push(r(0, 0, h.lengthM, h.widthM, '#f4f6f8', ' stroke="#9aa3ad" stroke-width=".8"'));
    h.aisles.forEach(function (a) { o.push(r(0, a.y0, h.lengthM, a.y1 - a.y0, '#e3eefb')); });
    s.racks.forEach(function (q) {
      var lost = s.lostCdu && s.lostCdu[q.cdu];
      o.push(r(q.x, q.y, p.rackPitchM * 0.92, p.rackDepthM, ramp(q.inlet), lost ? ' stroke="#111" stroke-width="1"' : ''));
    });
    h.cdus.forEach(function (c) {
      var lost = s.lostCdu && s.lostCdu[c.i];
      o.push(r(c.x - 0.45, c.y - 0.45, 0.9, 0.9, lost ? C.bad : C.liq));
    });
    h.crahs.forEach(function (c) {
      var off = s.crahOut && s.crahOut[c.i];
      o.push(r(c.x - 0.35, c.y - 0.5, 0.7, 1, off ? C.bad : C.air));
    });
    return '<figure class="plan"><svg viewBox="-2 -2 ' + (W + 4) + ' ' + (H + 4) + '" role="img" aria-label="' + esc(title) + '">' + o.join('') + '</svg>' +
      '<figcaption><b>' + esc(title) + '</b> max inlet ' + f(s.maxInlet, 1) + ' °C · ' + s.over27 + ' racks &gt; 27 °C · ' + s.over32 + ' &gt; 32 °C' +
      (s.itLostKw ? ' · IT throttled ' + mw(s.itLostKw) + ' MW' : '') + '</figcaption></figure>';
  }
  function legend() {
    return '<div class="legend">' + [18, 21, 24, 27, 30, 32, 35, 38, 41, 45].map(function (t) { return '<span style="background:' + ramp(t) + '">' + t + '</span>'; }).join('') +
      '<i>rack inlet °C</i><b style="background:' + C.liq + '"></b>CDU <b style="background:' + C.air + '"></b>CRAH <b style="background:' + C.bad + '"></b>out of service</div>';
  }

  /* ---- sections ----------------------------------------------------------------------- */
  function liquidClass(c) { var W = [17, 27, 32, 40, 45]; for (var i = 0; i < W.length; i++) if (c <= W[i]) return 'W' + W[i]; return 'W+'; }

  function register(R) {
    var p = R.input, l = R.liquid, a = R.air, w = R.power, d = R.design, hl = l.dutyKw / p.halls;
    return [
      ['Generators', w.genN, w.genTotal, w.genUnitKw, d.facility, 'campus'],
      ['Transformers', w.txN, w.txTotal, w.txUnitKw, d.upsIn + d.distLoss + d.mcc, 'campus'],
      ['UPS modules (' + w.upsTopology + ')', w.upsN, w.upsTotal, w.upsModuleKw, d.upsOut, 'campus'],
      ['CDUs', l.cduDutyN, l.cduPerHall, p.cduUnitKw, hl, 'per hall'],
      ['CRAHs', a.crahDutyN, a.crahPerHall, p.crahUnitKw, a.hallLoadKw, 'per hall'],
      ['Liquid coolers (derated)', l.coolerUnits, l.coolerUnitsTotal, l.coolerUnitKw, l.coolerKw, 'campus'],
      ['Chillers', a.chillersN, a.chillersTotal, p.chillerUnitKw, a.chillerEvapKw, 'campus']
    ];
  }
  function findings(R, ctx) {
    var T = R.totals, A = R.annual, l = R.liquid, out = [];
    out.push('Design-day PUE <b>' + f(T.pue, 3) + '</b> at ' + R.input.designDbC + ' °C db / ' + R.input.designWbC + ' °C wb; annual PUE <b>' + f(T.pueAnnual, 3) + '</b> over the ' + esc((ctx.climateLabel || 'site')) + ' bins at ' + f(R.input.itUtil * 100) + ' % utilisation.');
    out.push('The liquid path carries <b>' + pct(T.split.liquid, T.split.liquid + T.split.air + T.split.elec) + '</b> of the heat. The coolers leave water at ' + f(l.coolerLeavingC, 1) + ' °C against an FWS supply of ' + f(l.fwsSupplyC, 1) + ' °C, so trim chillers run <b>' + f(T.trimHours) + ' h/yr</b> (' + pct(T.trimHours, T.hours) + ' of the year).');
    out.push('Annual energy <b>' + f(A.m0MWh) + ' MWh</b>, water <b>' + f(A.waterM3) + ' m³</b>, emissions <b>' + f(A.co2t) + ' tCO₂</b>, energy cost <b>' + f(A.energyCost) + '</b> + water <b>' + f(A.waterCost) + '</b> (site currency).');
    if (ctx.faults) {
      var worst = ctx.faults.slice(1).reduce(function (m, x) { return x.s.maxInlet > m.s.maxInlet ? x : m; }, ctx.faults[1]);
      out.push('Worst DH01 fault for rack inlets: <b>' + esc(worst.label) + '</b> — max inlet ' + f(worst.s.maxInlet, 1) + ' °C, ' + worst.s.over32 + ' of ' + worst.s.racks.length + ' racks above 32 °C (ASHRAE A1 allowable).');
      var feeder = ctx.faults.filter(function (x) { return x.id === 'cdu-feeder'; })[0];
      if (feeder && feeder.s.itLostKw) out.push('CDU feed is <b>' + esc(R.input.cduFeed) + '</b>: losing feeder A takes ' + esc(feeder.s.note.split('.')[0]) + '; ' + mw(feeder.s.itLostKw) + ' MW of DH01 IT must throttle. A dual (ATS) feed removes this.');
    }
    if (ctx.fit) out.push('As configured, the plant reaches <b>Tier ' + ROMAN[ctx.fit.reached] + '</b>' + (ctx.fit.blockers.length ? '; Tier ' + ROMAN[ctx.fit.reached + 1] + ' needs: ' + ctx.fit.blockers.map(function (x) { return esc(x.req); }).join(', ') : '') + (ctx.fit.verify.length ? ' (' + ctx.fit.verify.length + ' design item' + (ctx.fit.verify.length > 1 ? 's' : '') + ' to verify)' : '') + '.');
    var fws = ctx.transients.filter(function (t) { return t.kind === 'fws-pump'; })[0];
    if (fws && fws.secondsToLimit != null) out.push('Facility water lost: the TCS loop reaches its ' + f(fws.limitC) + ' °C throttle point in <b>' + f(fws.secondsToLimit) + ' s</b> on its own water — the ride-through the controls and the standby pumps must beat.');
    if (ctx.options) {
      var O = ctx.options, best = O.presets.reduce(function (m, o) { return o.cost < m.cost ? o : m; }), top = O.sens.reduce(function (m, x) { return Math.abs(x.hi.r.pue - x.lo.r.pue) > Math.abs(m.hi.r.pue - m.lo.r.pue) ? x : m; });
      out.push((best.current ? 'This configuration is the cheapest to run of the four' : 'Cheapest to run of the four configurations: <b>' + esc(best.label) + '</b>, ' + f(O.base.cost - best.cost) + ' a year less than this plant (annual PUE ' + f(best.pue, 3) + ', WUE ' + f(best.wue, 2) + ' L/kWh)') +
        '. The design input that moves annual PUE most is <b>' + esc(top.label) + '</b>: ' + f(top.lo.r.pue, 3) + ' to ' + f(top.hi.r.pue, 3) + ' over one step each way.');
    }
    out.push('Heat balance closes to <b>' + f(Math.abs(R.design.balanceErr), 6) + ' kW</b>: every kilowatt into the building leaves through a named heat sink.');
    return '<ul class="find">' + out.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>';
  }
  function kpis(R) {
    var T = R.totals, A = R.annual, d = R.design;
    var k = [['IT load', mw(d.it, 1) + ' MW'], ['Facility, design day', mw(d.facility, 1) + ' MW'], ['PUE design', f(T.pue, 3)], ['PUE annual (cat 3)', f(T.pueAnnual, 3)],
             ['WUE annual', f(A.wue, 2) + ' L/kWh'], ['CUE', f(A.cue, 3) + ' kgCO₂/kWh'], ['Energy / yr', f(A.m0MWh / 1000, 1) + ' GWh'], ['Water / yr', f(A.waterM3 / 1000, 1) + ' ML'],
             ['tCO₂ / yr', f(A.co2t)], ['Racks', f(R.it.racks) + ' × ' + f(R.input.rackKw) + ' kW'], ['Halls', f(R.input.halls) + ' × ' + mw(R.it.hallKw, 0) + ' MW'], ['Trim hours', f(T.trimHours) + ' h']];
    return '<div class="kpis">' + k.map(function (x) { return '<div><span>' + esc(x[0]) + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
  }
  /* every engine input with a name and a unit, grouped as the plant strip groups them */
  var INPUTS = [
    ['Design', { itMw: ['IT load', 'MW'], capturePct: ['Liquid capture', '%'], tcsSupplyC: ['TCS supply', '°C'], cduFeed: ['CDU feed', ''], chillerType: ['Chiller heat rejection', ''], liquidRejection: ['Liquid cooler type', ''] }],
    ['Site', { climate: ['Climate', ''], climateBins: ['Climate bins', ''], designDbC: ['Design dry bulb', '°C'], designWbC: ['Design wet bulb', '°C'], gridEfKgPerKwh: ['Grid emission factor', 'kg/kWh'],
      renewablePct: ['Renewable supply', '%'], heatReusePct: ['Liquid heat reused', '%'], elecPrice: ['Electricity price', '/kWh'], waterTariff: ['Water tariff', '/m³'] }],
    ['Liquid path', { tcsReturnC: ['TCS return', '°C'], cduApproachK: ['CDU approach', 'K'], fwsDeltaK: ['FWS ΔT', 'K'], cduUnitKw: ['CDU unit', 'kW'], cduRedundancy: ['CDU spares per hall', ''],
      tcsHeadM: ['TCS pump head', 'm'], tcsPumpEff: ['TCS pump efficiency', ''], fwsHeadM: ['FWS pump head', 'm'], fwsPumpEff: ['FWS pump efficiency', ''], cduSkinLossPct: ['CDU skin loss to room', '%'],
      coolerApproachK: ['Cooler approach (rated)', 'K'], coolerUnitKw: ['Cooler unit (rated)', 'kW'], coolerFanKwPerMw: ['Cooler fan power', 'kW/MW'], coolerMinApproachK: ['Cooler minimum approach', 'K'],
      adiabaticEff: ['Adiabatic pre-cooling effectiveness', ''], adiabaticOnC: ['Adiabatic on above', '°C'], coolerAirRiseK: ['Cooler air temperature rise', 'K'], trimChillerCop: ['Trim chiller COP', ''] }],
    ['Air path', { crahUnitKw: ['CRAH unit', 'kW'], crahRedundancy: ['CRAH spares per hall', ''], airDeltaK: ['Air ΔT across IT', 'K'], sfpKwPerM3s: ['CRAH specific fan power', 'kW per m³/s'], supplyAirC: ['Supply air', '°C'],
      chwSupplyC: ['CHW supply', '°C'], chwDeltaK: ['CHW ΔT', 'K'], chillerUnitKw: ['Chiller unit', 'kW'], chillerRedundancy: ['Spare chillers', ''], chillerCopRated: ['Chiller rated COP', ''],
      chillerVsd: ['Chiller VSD', ''], chillerStageAll: ['Run all chillers at part load', ''], chwHeadM: ['CHW pump head', 'm'], cwHeadM: ['CW pump head', 'm'], pumpEff: ['Pump efficiency', ''],
      towerApproachK: ['Tower approach', 'K'], towerFanKwPerMw: ['Tower fan power', 'kW/MW'], cyclesOfConc: ['Cycles of concentration', ''] }],
    ['Electrical', { cordLossPct: ['Power-cord loss', '%'], pduLossPct: ['PDU / RPP loss', '%'], upsEff: ['UPS efficiency', ''], distLossPct: ['Distribution loss', '%'], txEff: ['Transformer efficiency', ''],
      elecRoomShare: ['Losses cooled in electrical rooms', ''], auxPctOfIt: ['Auxiliary load', '% of IT'], cduOnUps: ['TCS pumps on UPS', ''], genUnitKw: ['Generator unit', 'kW'], genRedundancy: ['Spare generators', ''],
      upsModuleKw: ['UPS module', 'kW'], upsTopology: ['UPS topology', ''], txUnitKw: ['Transformer unit', 'kVA'], txRedundancy: ['Spare transformers', ''] }],
    ['Halls & load', { halls: ['Data halls', ''], rackKw: ['Rack power', 'kW'], itUtil: ['Mean IT utilisation', ''], racksPerRow: ['Racks per row', ''], rackPitchM: ['Rack pitch', 'm'], rackDepthM: ['Rack depth', 'm'],
      coldAisleM: ['Cold aisle', 'm'], hotAisleM: ['Hot aisle', 'm'], endZoneM: ['End zone', 'm'], hallHeightM: ['Hall height', 'm'] }],
    ['Transients', { tcsLoopM3PerCdu: ['TCS loop water per CDU', 'm³'], throttleC: ['GPU throttle (TCS return)', '°C'], chwLoopLPerKw: ['CHW loop water', 'L/kW'] }]
  ];
  function show(v, I) {
    if (Array.isArray(v)) return v.length + ' bins';
    if (v && typeof v === 'object') return I && v[I.liquidRejection] != null ? v[I.liquidRejection] + ' (' + I.liquidRejection + ')' : Object.keys(v).map(function (q) { return q + ' ' + v[q]; }).join(' · ');
    return v;
  }
  function inputsTable(R, ctx) {
    var D = ctx.defaults || {}, S = ctx.state || {}, seen = {}, rows = [];
    function row(k, lab) {
      seen[k] = 1;
      var over = Object.prototype.hasOwnProperty.call(S, k), v = show(R.input[k], R.input), d = D[k] == null ? '—' : show(D[k], R.input);
      rows.push([esc(lab[0]) + ' <code>' + esc(k) + '</code>', esc(v) + (lab[1] ? ' ' + esc(lab[1]) : ''), esc(d), over ? '<span class="tag y">yours</span>' : '<span class="tag">auto</span>']);
    }
    INPUTS.forEach(function (g) {
      rows.push(['<b>' + esc(g[0]) + '</b>', '', '', '']);
      Object.keys(g[1]).forEach(function (k) { if (k in R.input) row(k, g[1][k]); });
    });
    var rest = Object.keys(R.input).filter(function (k) { return !seen[k]; });
    if (rest.length) { rows.push(['<b>Other</b>', '', '', '']); rest.forEach(function (k) { row(k, [k, '']); }); }
    return table(['Input', 'Value', 'Default', 'Source'], rows, 'inp');
  }
  function traceTable(R) {
    return table(['Quantity', 'Value', 'Formula', 'Inputs'], Object.keys(R.trace).map(function (k) {
      var t = R.trace[k];
      return [esc(t.label), f(t.value, Math.abs(t.value) < 20 && t.value % 1 ? 3 : 0) + ' ' + esc(t.unit), '<code>' + esc(t.formula) + '</code>',
        (t.inputs || []).map(function (i) { return '<code>' + esc(i) + '</code> = ' + esc(show(R.input[i], R.input)); }).join('<br>')];
    }), 'trace');
  }

  function build(R, ctx) {
    ctx = ctx || {};
    var p = R.input, d = R.design, l = R.liquid, a = R.air, e = R.elec, T = R.totals, A = R.annual, w = R.power, h = R.hall;
    var sk = sankey(R), items = powerItems(R), sumItems = items.reduce(function (s, i) { return s + i[1]; }, 0);
    var parts = [];
    TOC = [];
    parts.push('<header class="cover"><p class="eyebrow">Liquid-to-chip plant · engineering report</p><h1>' + esc(ctx.title || (f(p.itMw) + ' MW liquid-cooled AI campus')) + '</h1>' +
      '<p class="meta">' + esc(ctx.presetLabel || 'custom plant') + ' · ' + esc(ctx.climateLabel || 'custom climate') + ' · CDU feed ' + esc(p.cduFeed) + ' · generated ' + esc(ctx.date || '') +
      ' · engine v' + esc(ctx.version || '?') + (ctx.url ? ' · <a href="' + esc(ctx.url) + '">' + esc(ctx.url) + '</a>' : '') + '</p>' + kpis(R) + '</header>');
    parts.push('%%TOC%%');
    parts.push(sec('s1', 1, 'Key findings', 'Read from the same result every workbench page draws; each sentence is a number in the sections below.', findings(R, ctx)));
    if (ctx.views && ctx.views.length) parts.push(sec('', 0, 'Plant schematics', 'The plant map from the LTC hub, drawn on this plant: every block and connector the workbench shows, with this plant\'s numbers on it. Solid lines carry power, dashed liquid, dash-dot air, dotted losses.',
      ctx.views.map(function (v) { return '<figure class="wide schem"><figcaption><b>' + esc(v.label) + '</b></figcaption>' + v.svg + '</figure>'; }).join('')));
    parts.push(sec('s2', 2, 'Heat balance', 'Where every kilowatt of heat goes, design day. Left: the path the heat takes inside the building. Right: the equipment that rejects it.',
      '<figure class="wide">' + sk.svg + '</figure><p class="check">Left ' + f(sk.totL) + ' kW = right ' + f(sk.totR) + ' kW (difference ' + f(sk.totL - sk.totR, 3) + ' kW). Chiller evaporator includes CHW pumps and room fans; towers then reject ' + mw(a.towerKw) + ' MW (evaporator + compressor + trim).</p>' +
      table(['Path', 'kW', 'Share'], sk.F.left.map(function (n) { return [esc(n[1]), f(n[2]), pct(n[2], sk.totL)]; }))));
    parts.push(sec('s3', 3, 'Facility power', 'Every electrical load at the design point, from the IT input back to the utility meter.',
      '<figure class="wide">' + barsH(items, d.facility, 'kW') + '</figure><p class="check">Items sum to ' + f(sumItems) + ' kW; engine facility total ' + f(d.facility) + ' kW (residual ' + f(d.facility - sumItems, 1) + ' kW). MCC (mechanical) ' + f(d.mcc) + ' kW, split A ' + f(w.mccAKw) + ' / B ' + f(w.mccBKw) + ' kW.</p>'));
    parts.push(sec('s4', 4, 'Metering & PUE categories', 'ISO/IEC 30134-2 measures IT energy at one of three points; the further from the server, the lower the PUE.',
      '<figure class="wide">' + meters(R) + '</figure>' + table(['Category', 'IT measured at', 'IT energy MWh/yr', 'PUE'], [
        ['Category 1', 'UPS output (M1)', f(A.m1MWh), f(A.pue1, 3)], ['Category 2', 'PDU output (M2)', f(A.m2MWh), f(A.pue2, 3)], ['Category 3', 'IT equipment input (M3)', f(A.m3MWh), f(A.pue3, 3)]]) +
      '<p class="note">Same facility, three PUEs: a reported PUE without its category is not comparable. Facility input M0 = ' + f(A.m0MWh) + ' MWh/yr.</p>'));
    parts.push(sec('s5', 5, 'Liquid path', 'Cold plate → TCS (technology cooling system) → CDU → FWS (facility water) → liquid coolers, with trim chillers when the coolers cannot reach the FWS supply.', table(['Quantity', 'Value'], [
      ['Heat into cold plates', f(l.itKw) + ' kW (' + f(p.capturePct) + ' % of IT)'], ['Liquid duty incl. TCS pumps', f(l.dutyKw) + ' kW'], ['TCS supply / return', f(p.tcsSupplyC, 1) + ' / ' + f(p.tcsReturnC, 1) + ' °C (ΔT ' + f(l.tcsDeltaK, 1) + ' K)'],
      ['TCS flow / pump power', f(l.tcsLps, 0) + ' L/s · ' + f(l.tcsPumpKw) + ' kW'], ['CDUs', l.cduDutyN + ' duty + ' + (l.cduPerHall - l.cduDutyN) + ' spare per hall · ' + l.cduTotal + ' total · ' + f(p.cduUnitKw) + ' kW each'],
      ['CDU skin loss to room', f(l.cduSkinKw) + ' kW'], ['FWS supply / return', f(l.fwsSupplyC, 1) + ' / ' + f(l.fwsReturnC, 1) + ' °C'], ['FWS flow / pump power', f(l.fwsLps, 0) + ' L/s · ' + f(l.fwsPumpKw) + ' kW'],
      ['Cooler type / sink / leaving', esc(l.coolerType) + ' · sink ' + f(l.coolerSinkC, 1) + ' °C · leaving ' + f(l.coolerLeavingC, 1) + ' °C'], ['Coolers', l.coolerUnits + ' duty / ' + l.coolerUnitsTotal + ' installed · derated ' + f(l.coolerUnitKw) + ' kW (' + pct(l.coolerDerate, 1) + ' of rating)'],
      ['Cooler duty / fans', f(l.coolerKw) + ' kW · fans ' + f(l.coolerFanKw) + ' kW'], ['Trim chillers, design day', f(l.trimKw) + ' kW duty · ' + f(l.trimKwe) + ' kW electrical (' + pct(l.trimShareDesign, 1) + ' of FWS heat)']])));
    parts.push(sec('s6', 6, 'Air path', 'Residual IT heat, CDU skin loss and fan heat to CRAHs → chilled water → chillers → cooling towers.', table(['Quantity', 'Value'], [
      ['IT heat left in air', f(a.itKw) + ' kW'], ['Air load per hall incl. fans', f(a.hallLoadKw) + ' kW'], ['CRAHs', a.crahDutyN + ' duty / ' + a.crahPerHall + ' per hall · ' + a.crahTotal + ' total · ' + f(p.crahUnitKw) + ' kW each'],
      ['Airflow per hall', f(a.airflowHallM3s, 1) + ' m³/s at ΔT ' + f(p.airDeltaK) + ' K · ' + f(h.airChangesPerHour) + ' air changes / h'], ['CRAH fan power', f(a.fanKw) + ' kW'],
      ['CHW supply / return', f(a.chwSupplyC, 1) + ' / ' + f(a.chwReturnC, 1) + ' °C · ' + f(a.chwLps) + ' L/s'], ['Chillers', a.chillersN + ' duty / ' + a.chillersTotal + ' installed · ' + esc(a.chillerType) + '-cooled · PLR ' + pct(a.chillerPlr, 1)],
      ['Chiller evaporator / input', f(a.chillerEvapKw) + ' kW · ' + f(a.chillerKwe) + ' kW (COP ' + f(a.chillerCop, 2) + ', ' + f(a.chillerKwPerRt, 3) + ' kW/RT)'],
      ['CHW / CW pumps', f(a.chwPumpKw) + ' / ' + f(a.cwPumpKw) + ' kW'], ['Towers', f(a.towerKw) + ' kW rejected · fans ' + f(a.towerFanKw) + ' kW · make-up ' + f(a.makeupLps, 1) + ' L/s']])));
    parts.push(sec('s7', 7, 'Electrical & sizing', 'From the utility to the cord: the losses each stage adds and the units it takes.', table(['Quantity', 'Value'], [
      ['IT (M3) → PDU output (M2)', f(d.m3) + ' → ' + f(d.m2) + ' kW (cords ' + f(d.cordLoss) + ' kW)'], ['UPS output (M1)', f(d.m1) + ' kW (PDU ' + f(d.pduLoss) + ' kW' + (p.cduOnUps ? ', TCS pumps on UPS ' + f(d.tcsPump) + ' kW' : '') + ')'],
      ['UPS input / loss', f(e.upsInKw) + ' kW · ' + f(e.upsLossKw) + ' kW at η ' + f(p.upsEff * 100, 1) + ' %'], ['Distribution / transformer losses', f(e.distLossKw) + ' / ' + f(e.txLossKw) + ' kW'],
      ['Electrical-room cooling', f(e.roomLoadKw) + ' kW heat · ' + f(e.roomFanKw) + ' kW fans'], ['Generators', w.genN + ' + ' + (w.genTotal - w.genN) + ' × ' + f(w.genUnitKw) + ' kW'],
      ['Transformers', w.txN + ' + ' + (w.txTotal - w.txN) + ' × ' + f(w.txUnitKw) + ' kVA'], ['UPS modules', w.upsN + ' + ' + (w.upsTotal - w.upsN) + ' × ' + f(w.upsModuleKw) + ' kW (' + esc(w.upsTopology) + ')'],
      ['CDU feed', esc(w.cduFeed === 'dual' ? 'dual-fed through ATS' : 'single-fed, alternating A / B')]])));
    var reg = register(R);
    parts.push(sec('s8', 8, 'Redundancy register', 'Installed against needed, and whether the plant still carries the design load with one unit out.', table(['Equipment', 'Need (N)', 'Installed', 'Label', 'Unit kW', 'Capacity kW', 'Load kW', 'Margin', 'One unit out'], reg.map(function (r) {
      var cap = r[2] * r[3], ok = (r[2] - 1) * r[3] >= r[4] - 0.5;
      return [esc(r[0]) + ' <small>' + r[5] + '</small>', r[1], r[2], (root.LTCTier ? root.LTCTier.redLabel(r[2], r[1]) : (r[2] > r[1] ? 'N+' + (r[2] - r[1]) : 'N')), f(r[3]), f(cap), f(r[4]), pct(cap - r[4], r[4]), ok ? '<span class="tag ok">holds</span>' : '<span class="tag bad">short</span>'];
    })) + '<p class="note">Unit counts are capacity redundancy only. Whether a <em>path</em> can be taken out (concurrent maintainability, fault tolerance) is tested on the Tier page, element by element.</p>'));
    parts.push(sec('s9', 9, 'Tier topology', 'Each Tier of the Uptime Institute Tier Standard: Topology drawn on this plant\'s unit counts (DH01\'s share), every element taken out one at a time — planned (an alternate path may be switched in first) and unplanned (only paths already carrying load count). The load survives only if every group it needs keeps a path: IT power AND mechanical power; liquid heat sink AND air heat sink.',
      ctx.tier ? table(['Tier', 'System', 'Elements tested', 'Concurrently maintainable', 'Fault tolerant', 'What breaks it'], ctx.tier.map(function (t) {
        var why = t.maintFail.length ? 'planned: ' + t.maintFail.slice(0, 3).join('; ') + (t.maintFail.length > 3 ? ' (+' + (t.maintFail.length - 3) + ')' : '')
          : t.faultFail.length ? 'unplanned: ' + t.faultFail.slice(0, 3).join('; ') + (t.faultFail.length > 3 ? ' (+' + (t.faultFail.length - 3) + ')' : '') : '—';
        return [esc(t.label), t.system, t.n, t.maint ? '<span class="tag ok">yes</span>' : '<span class="tag bad">no</span>', t.fault ? '<span class="tag ok">yes</span>' : '<span class="tag bad">no</span>', '<small>' + esc(why) + '</small>'];
      })) + '<p class="note">The objective each Tier must reach: I and II neither, III concurrently maintainable, IV fault tolerant as well. Compartmentalisation and continuous cooling (Tier IV) are not modelled. Simulate each element on the Tier page.</p>'
        : '<p class="note">The Tier model did not load on this page; open the report from the Tier page to include it.</p>') + (ctx.fit ? fitSection(ctx.fit) : ''));
    parts.push(sec('s10', 10, 'Annual performance', 'The plant re-solved in each climate bin at mean utilisation, then weighted by hours.', '<figure class="wide">' + binsChart(R) + '</figure>' +
      table(['Dry bulb °C', 'Wet bulb °C', 'Hours', 'PUE', 'Chiller COP', 'Trim share', 'Chiller PLR'], T.bins.map(function (b) {
        return [f(b.db, 1), f(b.wb, 1), f(b.hours), f(b.pue, 3), f(b.cop, 2), pct(b.trimShare, 1), pct(b.plr, 1)]; })) +
      table(['Annual quantity', 'Value'], [['Facility energy (M0)', f(A.m0MWh) + ' MWh'], ['IT energy (M3)', f(A.m3MWh) + ' MWh'], ['Renewable / reused heat', f(A.renewableMWh) + ' / ' + f(A.reuseMWh) + ' MWh'],
        ['Water', f(A.waterM3) + ' m³ (WUE ' + f(A.wue, 3) + ' L/kWh)'], ['CUE / REF / ERF', f(A.cue, 3) + ' / ' + f(A.ref, 3) + ' / ' + f(A.erf, 3)], ['Emissions', f(A.co2t) + ' tCO₂'],
        ['Energy / water cost', f(A.energyCost) + ' / ' + f(A.waterCost) + ' (at ' + p.elecPrice + ' per kWh, ' + p.waterTariff + ' per m³)']])));
    if (ctx.options) parts.push(sec('', 0, 'Options & sensitivity', 'What this IT load would use and cost under another plant, at another site, or with one design input moved by a practical step.', optionsSection(ctx.options)));
    if (ctx.faults) {
      parts.push(sec('s11', 11, 'DH01 hall & faults', 'One hall in plan, ' + f(h.lengthM, 1) + ' × ' + f(h.widthM, 1) + ' × ' + f(h.heightM, 1) + ' m (' + f(h.areaM2) + ' m², ' + f(h.volumeM3) + ' m³), ' + h.rows + ' rows × ' + h.racksPerRow + ' racks, re-solved under every fault the workbench models (common secondary header, 5 min after the fault, racks throttled). A thermal approximation for training, not CFD.',
        legend() + '<div class="plans">' + ctx.faults.map(function (x) { return hallPlan(R, x.s, x.label); }).join('') + '</div>' +
        table(['Fault', 'Supply air °C', 'Max inlet °C', '> 27 °C', '> 32 °C', 'IT throttled kW', 'CRAH coil limited', 'Note'], ctx.faults.map(function (x) {
          return [esc(x.label), f(x.s.supply, 1), f(x.s.maxInlet, 1), x.s.over27, x.s.over32, f(x.s.itLostKw), x.s.coilLimited ? 'yes' : 'no', '<small>' + esc(x.s.note || '—') + '</small>']; })) +
        soeSection(ctx.faults)));
    } else parts.push(sec('s11', 11, 'DH01 hall & faults', '', '<p class="note">The DH01 solver did not load on this page; open the report from the LTC hub to include it.</p>'));
    parts.push(sec('s12', 12, 'Transients', 'First-order lumped thermal mass, integrated in 1 s steps: C·dT/dt = Q − f·Q·(T − T_sink)/(T0 − T_sink). f = heat rejection still available ÷ load.',
      '<div class="tr">' + ctx.transients.map(function (t) {
        return '<figure><figcaption><b>' + esc(t.title) + '</b> · ' + esc(t.label) + ' · rejection left ' + f(t.capacityLeft * 100) + ' % of load · ' + (t.secondsToLimit != null ? 'limit in <b>' + f(t.secondsToLimit) + ' s</b>' : 'stays below the limit') + '</figcaption>' + transientChart(t) + '</figure>';
      }).join('') + '</div>' + table(['Scenario', 'Variable', 'Start °C', 'Limit °C', 'Thermal mass MJ/K', 'Heat in kW', 'Time to limit'], ctx.transients.map(function (t) {
        return [esc(t.title), esc(t.label), f(t.series[0][1], 1), f(t.limitC, 1), f(t.C / 1000, 1), f(t.Q), t.secondsToLimit != null ? f(t.secondsToLimit) + ' s' : 'not reached in ' + f(t.series[t.series.length - 1][0]) + ' min']; }))));
    var dh = ctx.faults ? ctx.faults[0].s : null;
    if (ctx.hlt) parts.push(sec('', 0, 'Heat load test plan', 'The commissioning L4 heat load test (HLT) for DH01, written from this plant: what each load step should read, and what each single failure at full load should do.', hltSection(ctx.hlt)));
    parts.push(sec('s13', 13, 'Standards cross-check', 'What the plant\'s numbers say against each standard the workbench covers. A screening check, not a compliance statement.', table(['Standard', 'Check', 'Plant value', 'Result'], [
      ['ASHRAE TC 9.9 (air)', 'Supply air within A1 recommended 18–27 °C', f(p.supplyAirC, 1) + ' °C', p.supplyAirC >= 18 && p.supplyAirC <= 27 ? '<span class="tag ok">within</span>' : '<span class="tag bad">outside</span>'],
      ['ASHRAE TC 9.9 (air)', 'DH01 max rack inlet, normal operation', dh ? f(dh.maxInlet, 1) + ' °C' : '—', dh ? (dh.maxInlet <= 27 ? '<span class="tag ok">within</span>' : '<span class="tag bad">above 27 °C</span>') : '—'],
      ['ASHRAE liquid classes', 'Facility water supply class (W17…W45, W+)', f(l.fwsSupplyC, 1) + ' °C', liquidClass(l.fwsSupplyC)],
      ['ISO/IEC 30134-2', 'PUE category 3, annual', f(A.pue3, 3), 'cat 1 ' + f(A.pue1, 3) + ' · cat 2 ' + f(A.pue2, 3)],
      ['ISO/IEC 30134-8 / -9', 'CUE / WUE', f(A.cue, 3) + ' kgCO₂/kWh · ' + f(A.wue, 3) + ' L/kWh', 'grid ' + p.gridEfKgPerKwh + ' kg/kWh'],
      ['ISO/IEC 30134-3 / -6', 'REF / ERF', f(A.ref, 3) + ' / ' + f(A.erf, 3), A.erf > 0 ? 'heat reuse declared' : 'no reuse declared'],
      ['Uptime Tier (capacity)', 'Every equipment class survives one unit out', reg.filter(function (r) { return (r[2] - 1) * r[3] >= r[4] - 0.5; }).length + ' of ' + reg.length + ' classes', reg.every(function (r) { return (r[2] - 1) * r[3] >= r[4] - 0.5; }) ? '<span class="tag ok">N+1 or better</span>' : '<span class="tag bad">a class is short</span>'],
      ['NFPA 75 / 2001', 'Clean-agent protected volume, one hall', f(h.volumeM3) + ' m³ (' + f(h.areaM2) + ' m² × ' + f(h.heightM, 1) + ' m)', 'agent quantity on the NFPA page'],
      ['TIA-942', 'Racks to cable, one hall', f(R.it.racksPerHall) + ' racks in ' + h.rows + ' rows', 'port counts on the TIA page']])));
    parts.push(sec('s14', 14, 'Calculation trace', 'Every headline quantity with its formula and the inputs it reads — the same trace the ƒx inspector shows.', traceTable(R)));
    parts.push(sec('s15', 15, 'Inputs', 'Every engine input. <span class="tag">auto</span> = the engine default or derived value; <span class="tag y">yours</span> = changed on the plant strip.', inputsTable(R, ctx)));
    parts.push(sec('s16', 16, 'Assumptions & limits', '', '<ul class="find"><li>Steady-state energy balance at the design day and in each climate bin; part-load chillers from the PLR curve; coolers derated by LMTD against their rating.</li>' +
      '<li>Climate bins are illustrative unless pasted from the site\'s EPW file. Annual figures scale with the bins\' hours.</li><li>DH01 is one hall, solved as a mass and energy balance per aisle with recirculation — a training approximation, not CFD.</li>' +
      '<li>Transients are first-order lumped models; they bound ride-through, they do not replace a controls study.</li><li>CUE is market-based (facility − renewable) × grid factor ÷ IT; state the accounting basis with the number.</li>' +
      '<li>Costs are in the site currency at a flat tariff; no demand charges, no escalation.</li></ul>'));
    parts.push(sec('s17', 17, 'Data', 'The full engine result is embedded in this file. Download it to check any number in this report.',
      '<p class="dl"><button type="button" data-dl="json">Download JSON</button> <button type="button" data-dl="csv">Download CSV</button> <button type="button" data-dl="html">Save this report (HTML)</button> <button type="button" data-print>Print / PDF</button></p>'));
    var toc = '<nav class="toc"><b>Contents</b><ol>' + TOC.map(function (t, i) { return '<li><a href="#s' + (i + 1) + '">' + esc(t) + '</a></li>'; }).join('') + '</ol></nav>';
    return page(ctx, parts.join('').replace('%%TOC%%', toc), R);
  }

  /* flat key → value rows for the CSV: every scalar in the result, arrays of objects as indexed rows */
  function flatten(o, pre, out) {
    out = out || [];
    Object.keys(o).forEach(function (k) {
      var v = o[k], key = pre ? pre + '.' + k : k;
      if (typeof v === 'function') return;
      if (v && typeof v === 'object') flatten(v, key, out);
      else out.push([key, v]);
    });
    return out;
  }
  function csv(R) {
    return 'key,value\n' + flatten(R, '').map(function (r) { var v = String(r[1]); return r[0] + ',' + (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v); }).join('\n') + '\n';
  }

  var CSS = 'body{margin:0;background:#fff;color:#1f2933;font:400 14px/1.55 "IBM Plex Sans",system-ui,sans-serif}main{max-width:980px;margin:0 auto;padding:24px 16px 64px}' +
    '.bar{position:sticky;top:0;z-index:2;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px 16px;background:#111827;color:#e5e7eb;font:500 12px "JetBrains Mono",monospace}.bar span{flex:1}' +
    'button{font:500 12px "JetBrains Mono",monospace;padding:8px 12px;min-height:36px;border:1px solid #9aa3ad;border-radius:3px;background:#fff;color:#111;cursor:pointer}.bar button{background:#1f2937;color:#f9fafb;border-color:#4b5563}' +
    '.eyebrow{font:500 11px "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#b45309;margin:0}h1{font-size:28px;line-height:1.2;margin:6px 0 4px}.meta{color:#4b5563;font-size:12.5px;margin:0 0 16px}' +
    'section{scroll-margin-top:60px}h2{font-size:19px;margin:36px 0 6px;padding-top:12px;border-top:1px solid #d5d9df}h2 .no{display:inline-block;min-width:30px;color:#b45309;font:500 14px "JetBrains Mono",monospace}.lead{color:#4b5563;margin:0 0 12px}h3{font-size:14.5px;margin:22px 0 8px;color:#1f2937}' +
    '.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1px;background:#d5d9df;border:1px solid #d5d9df}.kpis div{background:#f8fafc;padding:10px 12px}.kpis span{display:block;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em}.kpis b{font:500 17px "JetBrains Mono",monospace;font-variant-numeric:tabular-nums}' +
    '.toc ol{columns:2;margin:6px 0 0;padding-left:22px}.toc{margin:20px 0;padding:12px 16px;border:1px solid #d5d9df;background:#f8fafc}a{color:#0e6f8a}' +
    '.tw{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{border-bottom:1px solid #e5e7eb;padding:5px 8px;text-align:left;vertical-align:top}th{font:500 10.5px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;background:#f3f4f6;white-space:nowrap}td.n{font-variant-numeric:tabular-nums}code{font:12px "JetBrains Mono",monospace;color:#374151}' +
    'figure{margin:12px 0}figure.wide{overflow-x:auto}.schem{margin:16px 0 24px}.schem figcaption{font-size:12.5px;margin-bottom:4px}svg{width:100%;height:auto;display:block}svg .sl{font:12px "IBM Plex Sans",sans-serif;fill:#1f2933}svg .sv{font:500 11.5px "JetBrains Mono",monospace;fill:#374151}svg .sd{font:10.5px "JetBrains Mono",monospace;fill:#6b7280}' +
    '.check{font:12px "JetBrains Mono",monospace;color:#1a8f4e;margin:6px 0}.note{font-size:12.5px;color:#4b5563}.find li{margin:4px 0}' +
    '.tag{display:inline-block;padding:1px 6px;border-radius:2px;font:500 10.5px "JetBrains Mono",monospace;background:#eef2f6;color:#4b5563}.tag.y{background:#fdecc8;color:#92400e}.tag.ok{background:#dcf3e5;color:#166534}.tag.bad{background:#fde2e2;color:#991b1b}' +
    '.plans{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.plan figcaption{font-size:11.5px;color:#374151;margin-top:4px}.plan figcaption b{display:block;font-size:12.5px}' +
    '.legend{display:flex;flex-wrap:wrap;align-items:center;gap:2px;font:10.5px "JetBrains Mono",monospace;margin:8px 0}.legend span{padding:2px 6px;color:#111}.legend i{margin:0 12px 0 6px;font-style:normal;color:#6b7280}.legend b{display:inline-block;width:10px;height:10px;margin:0 4px 0 8px}' +
    '.tr{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}.tr figcaption{font-size:12px}.dl button{margin:4px 4px 4px 0}' +
    '@media print{.bar,.dl{display:none}.schem svg{min-width:0!important}main{max-width:none;padding:0}section{break-inside:auto}figure,tr,.kpis{break-inside:avoid}h2,h3{break-after:avoid}body{font-size:11.5px}}' +
    '@media(max-width:600px){h1{font-size:22px}.toc ol{columns:1}figure.wide svg{min-width:720px}}';

  function page(ctx, body, R) {
    var data = JSON.stringify({ generated: ctx.date, version: ctx.version, url: ctx.url, state: ctx.state || {}, result: R }).replace(/</g, '\\u003c');
    var name = 'ltc-plant-report-' + String(ctx.date || '').slice(0, 10);
    var js = 'var D=JSON.parse(document.getElementById("rz-data").textContent);function sv(b,n){var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=n;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}' +
      'document.addEventListener("click",function(e){var t=e.target.closest("[data-dl],[data-print]");if(!t)return;if(t.hasAttribute("data-print")){window.print();return}var k=t.getAttribute("data-dl");' +
      'if(k==="json")sv(new Blob([JSON.stringify(D,null,1)],{type:"application/json"}),"' + name + '.json");' +
      'if(k==="csv")sv(new Blob([document.getElementById("rz-csv").textContent],{type:"text/csv"}),"' + name + '.csv");' +
      'if(k==="html")sv(new Blob(["<!doctype html>\\n"+document.documentElement.outerHTML],{type:"text/html"}),"' + name + '.html")});';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LTC plant report</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">' +
      '<style>' + (ctx.cssVars ? ':root{' + esc(ctx.cssVars) + '}' : '') + CSS + '</style></head><body><div class="bar"><span>LTC plant report · ' + esc(ctx.date || '') + '</span><button type="button" data-print>Print / PDF</button><button type="button" data-dl="json">JSON</button><button type="button" data-dl="csv">CSV</button><button type="button" data-dl="html">Save HTML</button></div><main>' +
      body + '</main><script type="application/json" id="rz-data">' + data + '<\/script><script type="text/plain" id="rz-csv">' + esc(csv(R)) + '<\/script><script>' + js + '<\/script></body></html>';
  }

  /* ---- browser side: gather the context, write the file, open it ----------------------- */
  var TRANSIENTS = [['fws-pump', 'Facility water lost'], ['cooler', 'Half the liquid coolers lost'], ['chiller', 'One chiller trips'], ['chw', 'Chilled water lost']];
  function transients(P, R) {
    return TRANSIENTS.map(function (x) {
      var t = P.transient(R, x[0]);
      if (t && t.secondsToLimit != null) t = P.transient(R, x[0], { minutes: Math.max(2, Math.min(30, Math.ceil(t.secondsToLimit * 2 / 60))) });
      t.title = x[1];
      return t;
    });
  }
  /* the Tier objectives on this plant, both systems; the page's own system choice is restored */
  var GROUP = { power: { main: 'IT power', mech: 'mechanical power' }, cooling: { main: 'liquid heat sink', air: 'air heat sink' } };
  function tierSweep(T) {
    if (!T || !T.sweep) return null;
    var was = T.system(), out = [];
    try {
      ['power', 'cooling'].forEach(function (sys) {
        T.system(sys);
        [1, 2, 3, 4].forEach(function (t) {
          var sw = T.sweep(t), lab = (sys === 'power' ? T.TOPO : T.COOL)[t].label;
          out.push({ tier: t, system: sys, label: lab, n: sw.length, maint: sw.every(function (r) { return r.maint; }), fault: sw.every(function (r) { return r.fault; }),
            maintFail: sw.filter(function (r) { return !r.maint; }).map(function (r) { return r.e.label; }),
            faultFail: sw.filter(function (r) { return !r.fault; }).map(function (r) { return r.e.label + (r.lost && r.lost.length ? ' → ' + r.lost.map(function (g) { return GROUP[sys][g] || g; }).join(' + ') + ' lost' : ''); }) });
        });
      });
    } finally { T.system(was); }
    return out;
  }
  /* the same IT load under each configuration and each site, and the annual result's swing when one
     design input moves by a practical step; every row is a full engine solve */
  var SENS = [
    ['capturePct', 'Liquid capture', 5, ' pts', 50, 98],
    ['tcsSupplyC', 'TCS supply', 3, ' °C', 20, 50],
    ['itUtil', 'Mean IT utilisation', 0.1, '', 0.3, 1],
    ['chwSupplyC', 'Chilled-water supply', 2, ' °C', 7, 24],
    ['chillerCopRated', 'Chiller rated COP', 1, '', 3, 10],
    ['airDeltaK', 'CRAH air ΔT', 2, ' K', 6, 20],
    ['upsEff', 'UPS efficiency', 0.01, '', 0.9, 0.995]
  ];
  function options(P, R) {
    var I = R.input;
    function solve(over) { return P.compute(Object.assign({}, I, over)); }
    function row(r) { var A = r.annual; return { pueD: r.design.pue, trim: r.totals.trimHours, pue: A.pue3, wue: A.wue, mwh: A.m0MWh, water: A.waterM3, cost: A.energyCost + A.waterCost, co2: A.co2t }; }
    var presets = Object.keys(P.PRESETS).map(function (k) {
      var x = P.PRESETS[k];
      return Object.assign(row(solve({ chillerType: x.chillerType, liquidRejection: x.liquidRejection })), { id: k, label: x.label, current: x.chillerType === I.chillerType && x.liquidRejection === I.liquidRejection });
    });
    var climates = Object.keys(P.CLIMATES).map(function (k) { return Object.assign(row(solve({ climate: k, climateBins: undefined, designDbC: undefined, designWbC: undefined })), { id: k, label: P.CLIMATES[k].label, current: k === I.climate }); });
    var sens = SENS.map(function (s) {
      var k = s[0], v = I[k];
      function at(x) { var o = {}; o[k] = Math.max(s[4], Math.min(s[5], x)); if (k === 'tcsSupplyC') o.tcsReturnC = I.tcsReturnC + (o[k] - v); return { v: o[k], r: row(solve(o)) }; }
      return { key: k, label: s[1], unit: s[3], base: v, lo: at(v - s[2]), hi: at(v + s[2]) };
    });
    return { base: row(R), presets: presets, climates: climates, sens: sens };
  }
  /* tornado: annual PUE at each end of every step, widest swing on top */
  function tornado(O) {
    var rows = O.sens.slice().sort(function (a, b) { return Math.abs(b.hi.r.pue - b.lo.r.pue) - Math.abs(a.hi.r.pue - a.lo.r.pue); });
    var W = 900, rh = 26, H = rows.length * rh + 34, cx = 505, half = 135, b = O.base.pue;
    var span = Math.max.apply(null, rows.map(function (r) { return Math.max(Math.abs(r.lo.r.pue - b), Math.abs(r.hi.r.pue - b)); })) || 1;
    function x(v) { return cx + half * (v - b) / span; }
    function dv(v) { return v === Math.round(v) ? f(v) : f(v, v < 1 ? 3 : 1); }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Annual PUE sensitivity">' +
      '<line x1="' + cx + '" y1="4" x2="' + cx + '" y2="' + (H - 24) + '" stroke="' + C.t2 + '"/>' +
      '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle" class="sl">annual PUE ' + f(b, 3) + ' (this plant) · red raises it, green lowers it</text>' +
      rows.map(function (r, i) {
        var y = 6 + i * rh;
        return [r.lo, r.hi].map(function (e) {
          var x0 = Math.min(x(e.r.pue), cx), w = Math.max(1, Math.abs(x(e.r.pue) - cx)), up = e.r.pue > b;
          return '<rect x="' + x0 + '" y="' + (y + 3) + '" width="' + w + '" height="' + (rh - 10) + '" fill="' + (up ? C.bad : C.ok) + '" fill-opacity="0.75"/>' +
            '<text x="' + (up ? x0 + w + 4 : x0 - 4) + '" y="' + (y + 15) + '" ' + (up ? '' : 'text-anchor="end" ') + 'class="sv">' + dv(e.v) + r.unit + ' → ' + f(e.r.pue, 3) + '</text>';
        }).join('') + '<text x="8" y="' + (y + 15) + '" class="sl">' + esc(r.label) + ' (' + dv(r.base) + r.unit + ')</text>';
      }).join('') + '</svg>';
  }
  /* the L4 heat load test (HLT) written for this plant's DH01: load-bank kW per step from the hall
     load and the capture split, TCS flow held at its design value so the return rises with load,
     and the single-unit failures at 100 % read from the DH01 solver (5 min, racks throttled) */
  var HLT_STEPS = [25, 50, 75, 100], HLT_FAULTS = [['cdu', 'One CDU'], ['crah1', 'One CRAH'], ['cdu-feeder', 'CDU feeder A']];
  function hlt(R) {
    var P = root.LTCPlant, K = P ? P.CONST : { CP_W: 4.186, RHO_W: 997 }, n = R.input.halls, l = R.liquid, a = R.air;
    var liq = R.it.hallKw * R.input.capturePct / 100, air = R.it.hallKw - liq, lps = l.tcsLps / n, perCdu = lps / l.cduDutyN;
    var steps = HLT_STEPS.map(function (p) {
      var q = liq * p / 100, dT = q / (K.RHO_W / 1000 * K.CP_W * lps);
      return { pct: p, liquidKw: q, airKw: air * p / 100, perCduKw: q / l.cduDutyN, tcsLps: lps, perCduLps: perCdu,
        dT: dT, returnC: R.input.tcsSupplyC + dT, loKw: q * 0.95, hiKw: q * 1.05 };
    });
    var D = root.LTCDH01, fails = !D ? [] : HLT_FAULTS.map(function (x) {
      var s = D.solveHall(R, x[0], 'common', 5, 'throttled'), ok = function (v) { return !v.itLostKw && v.maxInlet <= 27; };
      /* the highest HLT step at which this failure still holds (0 = fails even at 25 %) */
      var holdsTo = 0; HLT_STEPS.forEach(function (st) { if (ok(D.solveHall(R, x[0], 'common', 5, 'throttled', st / 100))) holdsTo = st; });
      return { id: x[0], label: x[1], holdsTo: holdsTo, maxInlet: s.maxInlet, throttled: s.throttled, itLostKw: s.itLostKw, note: s.note,
        pass: !s.itLostKw && s.maxInlet <= 27 };
    });
    return { hallKw: R.it.hallKw, liquidKw: liq, airKw: air, cduN: l.cduDutyN, cduTotal: l.cduPerHall, cduUnitKw: R.input.cduUnitKw,
      crahN: a.crahDutyN, crahTotal: a.crahPerHall, crahUnitKw: R.input.crahUnitKw, supplyC: R.input.tcsSupplyC, supplyAirC: R.input.supplyAirC,
      steps: steps, fails: fails };
  }
  /* the alarm list per fault, in order: times solved from the hall and the plant transients */
  var SEV_TAG = { ok: 'ok', info: '', warn: 'y', alarm: 'bad', trip: 'bad' };
  function soeSection(faults) {
    var rows = [], D = root.LTCDH01;
    faults.forEach(function (x) {
      (x.soe || []).forEach(function (e, i) {
        rows.push([i ? '' : '<b>' + esc(x.label) + '</b>', '<code>' + D.clock(e.t) + '</code>', '<span class="tag ' + SEV_TAG[e.sev] + '">' + e.sev + '</span>', esc(e.text)]);
      });
    });
    return rows.length ? '<h3>Sequence of events</h3><p class="note">What the alarm list shows after each fault at full hall load, in order. Times come from the solve, not a script: steady faults from the hall solve once fans and valves settle (<code>steady</code>); loss of facility or chilled water from the loop’s stored cold, with the hall re-solved along the transient to the second each threshold is crossed. Cold plates have almost no thermal mass, so a rack that loses flow throttles within about 10 s.</p>' +
      table(['Fault', 'Time', 'Severity', 'Event'], rows) : '';
  }
  function hltSection(H) {
    var head = ['Load', 'Liquid banks kW', 'Per CDU kW', 'Air banks kW', 'TCS L/s (per CDU)', 'TCS ΔT K', 'TCS return °C', 'Accept kW ±5 %'];
    var bad = H.fails.filter(function (x) { return !x.pass; });
    return '<p>DH01 carries <b>' + f(H.hallKw) + ' kW</b>: <b>' + f(H.liquidKw) + ' kW</b> to liquid load banks on the TCS manifolds and <b>' + f(H.airKw) + ' kW</b> to air load banks in the rows. ' +
      H.cduN + ' duty of ' + H.cduTotal + ' CDUs (' + f(H.cduUnitKw) + ' kW each), ' + H.crahN + ' duty of ' + H.crahTotal + ' CRAHs (' + f(H.crahUnitKw) + ' kW each). ' +
      'Hold each step until temperatures settle (typical: &lt; 0.5 K over 15 min). The accept band is the measured ṁ·cp·ΔT on the TCS, ±5 % of the liquid load banks.</p>' +
      table(head, H.steps.map(function (s) {
        return [s.pct + '&nbsp;%', f(s.liquidKw), f(s.perCduKw), f(s.airKw), f(s.tcsLps, 1) + ' (' + f(s.perCduLps, 1) + ')', f(s.dT, 2), f(s.returnC, 1), f(s.loKw) + ' – ' + f(s.hiKw)];
      })) +
      '<p class="note">Accept at every step (typical): TCS supply ' + f(H.supplyC, 1) + ' ± 1 °C; flow per CDU ≥ design; rack inlet inside the ASHRAE recommended envelope (18–27 °C, supply air ' + f(H.supplyAirC, 1) + ' °C); measured heat inside the band; no alarm. ΔT assumes the CDUs hold design flow; a CDU on ΔT control holds the ΔT and turns its flow down instead.</p>' +
      (H.fails.length ? '<h3>Failures at 100 % — one unit at a time</h3>' + table(['Unit out', 'Max rack inlet °C', 'Racks throttled', 'IT throttled kW', 'Expected result', 'Holds up to', 'Why'], H.fails.map(function (x) {
        return [esc(x.label), f(x.maxInlet, 1), f(x.throttled), f(x.itLostKw), x.pass ? '<span class="tag ok">holds</span>' : '<span class="tag bad">fails</span>', x.holdsTo ? x.holdsTo + '&nbsp;% load' : 'no step', '<small>' + esc(x.note || '—') + '</small>'];
      })) + (bad.length ? '<p class="note">This plant is expected to fail the HLT at: ' + bad.map(function (x) { return esc(x.label); }).join(', ') + '. Fix the design before the test, or record it as a known limit in the commissioning plan.</p>' : '') : '');
  }
  /* this plant as configured against each Tier objective (LTCTier.fit): met / gap / verify */
  var ROMAN = ['', 'I', 'II', 'III', 'IV'];
  function fitSection(F) {
    var tag = { met: 'ok', gap: 'bad', verify: 'y' };
    return '<h3>This plant, as configured, against each Tier</h3><p>The sweep above builds each Tier on this plant\'s unit counts. Taken as configured on the strip, the plant reaches <b>Tier ' + ROMAN[F.reached] + '</b>' +
      (F.blockers.length ? '; Tier ' + ROMAN[F.reached + 1] + ' is blocked by ' + F.blockers.map(function (x) { return '<b>' + esc(x.req) + '</b>'; }).join(', ') : '') + '.</p>' +
      table(['Tier', 'Requirement', 'This plant', 'Status'], F.rows.map(function (x) {
        return [ROMAN[x.tier], esc(x.req) + (x.why ? '<br><small>' + esc(x.why) + '</small>' : ''), esc(x.value), '<span class="tag ' + tag[x.status] + '">' + x.status + '</span>'];
      })) + '<p class="note"><b>verify</b> = not described by the plant inputs; it does not lower the Tier reached but must be shown in the design. A screening against the Tier objectives, not a Tier Certification.</p>';
  }
  function optionsSection(O) {
    var b = O.base;
    function step(v) { return v === Math.round(v) ? f(v) : f(v, v < 1 ? 3 : 1); }
    function d(v, base, dp) { var x = v - base; return Math.abs(x) < Math.pow(10, -dp) / 2 ? '—' : (x > 0 ? '+' : '−') + f(Math.abs(x), dp); }
    function rows(list) {
      return list.map(function (o) {
        return [(o.current ? '<b>' + esc(o.label) + '</b> <span class="tag">this plant</span>' : esc(o.label)), f(o.pueD, 3), f(o.pue, 3), f(o.wue, 3), f(o.mwh), f(o.water), f(o.cost), d(o.cost, b.cost, 0), f(o.co2)];
      });
    }
    var head = ['Option', 'PUE design', 'PUE annual', 'WUE L/kWh', 'Facility MWh/yr', 'Water m³/yr', 'Energy + water cost/yr', 'Δ cost vs this plant', 'tCO₂/yr'];
    return '<h3>Plant configuration — same IT, capture, climate and tariffs</h3>' + table(head, rows(O.presets)) +
      '<h3>Site — same plant in each climate</h3>' + table(head, rows(O.climates)) +
      '<h3>Design inputs — one step each way</h3><figure class="wide">' + tornado(O) + '</figure>' +
      table(['Input', 'Step', 'PUE annual', 'WUE L/kWh', 'Δ cost/yr at low / high'], O.sens.map(function (s) {
        return [esc(s.label), step(s.lo.v) + ' → ' + step(s.hi.v) + s.unit, f(s.lo.r.pue, 3) + ' → ' + f(s.hi.r.pue, 3), f(s.lo.r.wue, 3) + ' → ' + f(s.hi.r.wue, 3), d(s.lo.r.cost, b.cost, 0) + ' / ' + d(s.hi.r.cost, b.cost, 0)];
      })) + '<p class="note">Each row is the whole plant re-solved (design day and every climate bin) with only that input changed; units are re-sized, so a step can cross a unit count. Climates are illustrative bins, not a site file.</p>';
  }
  function context(P, R, state) {
    var c, D = root.LTCDH01, pr = Object.keys(P.PRESETS).filter(function (k) { return P.PRESETS[k].chillerType === R.input.chillerType && P.PRESETS[k].liquidRejection === R.input.liquidRejection; })[0];
    c = {
      version: root.RZ_VERSION, date: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC', url: root.location ? root.location.href.split('#')[0] : '',
      state: state, defaults: P.DEFAULTS, presetLabel: pr ? P.PRESETS[pr].label : 'custom plant', climateLabel: (P.CLIMATES[R.input.climate] || { label: 'custom climate' }).label,
      transients: transients(P, R),
      options: options(P, R),
      tier: tierSweep(root.LTCTier),
      fit: root.LTCTier && root.LTCTier.fit ? root.LTCTier.fit(R, root.LTCDH01) : null,
      faults: D ? D.FAULTS.map(function (x) { return { id: x[0], label: x[1], s: D.solveHall(R, x[0], 'common', 5, 'throttled'), soe: D.timeline ? D.timeline(R, x[0], 'common', 'throttled', 1) : [] }; }) : null
    };
    c.hlt = hlt(R);
    return c;
  }
  /* the DH01 solver and the Tier model load on demand where the page does not carry them */
  function needModels(done) {
    var want = [['LTCDH01', 'ltc-dh01.js'], ['LTCTier', 'ltc-tier.js'], ['LTCHub', 'ltc-hub.js']].filter(function (m) { return !root[m[0]]; }), left = want.length;
    if (!left) return done();
    var me = document.querySelector('script[src*="ltc-report.js"]'), base = me ? me.src.replace(/ltc-report\.js.*$/, '') : 'js/';
    want.forEach(function (m) {
      var s = document.createElement('script');
      s.src = base + m[1] + '?v=' + encodeURIComponent(root.RZ_VERSION || '');
      s.onload = s.onerror = function () { if (--left === 0) done(); };
      document.head.appendChild(s);
    });
  }
  /* An RZDiagram drawing takes its colours and type from the page's stylesheet (custom properties,
   * classes). A standalone file has neither, so each element's computed paint is written onto it —
   * resolved under the light theme, because the report is a paper document whatever the page shows. */
  var PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity',
               'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'visibility', 'display'];
  function paintInline(markup, width) {
    var host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;left:-100000px;top:0;width:' + width + 'px';
    host.className = 'ltc-fig';
    host.innerHTML = markup;
    (document.querySelector('.ltc-work') || document.body).appendChild(host);
    var src = host.querySelector('svg'), out = src.cloneNode(true), a = src.querySelectorAll('*'), b = out.querySelectorAll('*');
    for (var i = 0; i < a.length; i++) {
      var cs = getComputedStyle(a[i]), st = [];
      PAINT.forEach(function (k) { var v = cs.getPropertyValue(k); if (v && v !== 'normal') st.push(k + ':' + v); });
      b[i].setAttribute('style', st.join(';'));
      b[i].removeAttribute('class');
      b[i].removeAttribute('tabindex');
      if (/^animate/.test(b[i].tagName)) b[i].remove();
    }
    out.removeAttribute('class');
    out.setAttribute('style', 'width:100%;height:auto;background:#fff;min-width:' + Math.round(width * 0.8) + 'px');   // labels stay ≥ 80 % of drawn size: scroll, never shrink
    host.remove();
    return new XMLSerializer().serializeToString(out);
  }
  function plantViews(R) {
    var H = root.LTCHub;
    if (!H || !H.svg || !root.RZDiagram) return null;
    var html = document.documentElement, theme = html.getAttribute('data-theme');
    html.setAttribute('data-theme', 'light');
    try {
      var views = H.views().map(function (v) { var x = H.svg(v.id, R); return { id: v.id, label: v.label, svg: paintInline(x.svg, x.width), warnings: x.warnings }; });
      // markers and <use> copies still name custom properties: carry their light-theme values along
      var names = {}, cs = getComputedStyle(html);
      views.forEach(function (v) { (v.svg.match(/var\(--[\w-]+/g) || []).forEach(function (m) { names[m.slice(4)] = 1; }); });
      views.vars = Object.keys(names).map(function (k) { return k + ':' + cs.getPropertyValue(k).trim(); }).join(';');
      return views;
    } catch (e) { console.error('[ltc-report] plant views', e); return null; }
    finally { if (theme) html.setAttribute('data-theme', theme); else html.removeAttribute('data-theme'); }
  }
  function exportReport() {
    var S = root.LTCPlantStrip, P = root.LTCPlant;
    if (!S || !P) return;
    var tab = root.open('', '_blank');   // opened inside the click, before the async load, so no popup blocker
    needModels(function () {
      var g = S.get(), ctx = context(P, g.result, g.state);
      ctx.views = plantViews(g.result);
      ctx.cssVars = ctx.views ? ctx.views.vars : '';
      var html = build(g.result, ctx);
      var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      if (tab && !tab.closed) tab.location.href = url;
      else { var a = document.createElement('a'); a.href = url; a.download = 'ltc-plant-report.html'; document.body.appendChild(a); a.click(); a.remove(); }
    });
  }
  function mountButton() {
    var bar = document.querySelector('#ltcPlantStrip .ltc-ps-bar');
    if (!bar || bar.querySelector('[data-report]')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ltc-btn'; b.setAttribute('data-report', '');
    b.title = 'A standalone engineering report of this plant: every figure, table, formula and input, with the data';
    b.textContent = 'Export report';
    b.addEventListener('click', exportReport);
    bar.appendChild(b);
  }

  root.LTCReport = { build: build, csv: csv, heatFlows: heatFlows, powerItems: powerItems, register: register, context: context, options: options, hlt: hlt, exportReport: exportReport };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LTCReport;
  if (typeof document !== 'undefined' && document.querySelector) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButton); else mountButton();
  }
})(typeof window !== 'undefined' ? window : globalThis);
