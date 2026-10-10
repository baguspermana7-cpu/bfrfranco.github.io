/* ltc-dh01.js — DH01 in plan: where the heat goes when something fails.
 *
 * A THERMAL APPROXIMATION FOR TRAINING, NOT CFD. What it computes, so a reader can check it:
 *   - every rack puts its air fraction of IT heat into the room: rack kW × (1 − capture), plus
 *     whatever liquid cooling it has lost to a fault;
 *   - server fans hold their design ΔT, so a rack's airflow demand is heat / (ρ·cp·ΔT);
 *   - each cold aisle is fed by the CRAH fan-wall units at its two ends (ltc-plant hallGeometry);
 *   - where an aisle's supply falls short of its racks' demand, the deficit is made up by hot air
 *     recirculating over and around the rows; the share grows toward the middle of the aisle,
 *     furthest from the fan walls. Rack inlet = supply + recirculated share × exhaust rise.
 * The map then shades the hall from those inlets and exhausts. It shows where a fault bites
 * and by how much, in the plant's own numbers; it does not resolve plumes, under-floor flow or
 * containment leakage — that is what a CFD study is for.
 */
(function (root) {
  'use strict';
  var P = root.LTCPlant;
  var FAULTS = [
    ['none', 'Normal'], ['cdu-feeder', 'CDU feeder A lost'], ['cdu', 'One CDU lost'], ['crah2', '2 CRAHs lost (west wall)'],
    ['crah4', '4 CRAHs lost (west wall)'], ['fws-pump', 'Facility water lost'], ['chiller', 'One chiller trips'], ['chw', 'Chilled water lost']
  ];
  /* phase: 'throttled' — a rack that loses cold-plate flow protects itself within seconds (GPU
   * throttle or shutdown), so the lasting consequence is lost IT capacity, not a hotter room;
   * 'running' — the worst case where those racks keep their full load on air. */
  var ST = { fault: 'none', header: 'common', minute: 5, phase: 'throttled' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(v, d) { return Number(v).toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }); }

  /* The calculation, pure: plant result + fault in, per-rack inlets out. */
  function solveHall(r, fault, header, minute, phase) {
    var p = r.input, h = r.hall, CPA = P.CONST.CP_A, RHOA = P.CONST.RHO_A;
    var rackKw = r.it.hallKw / h.racks.length, cap = p.capturePct / 100;
    var supply = p.supplyAirC, liqShortFrac = 0, lostCdu = {}, crahOut = {}, note = '', series = null, secs = null;
    var hallLiq = r.liquid.dutyKw / p.halls;
    if (fault === 'cdu-feeder' || fault === 'cdu') {
      var ov = P.compute(r.input, { kind: fault }).fault;
      ov.lostCdu.forEach(function (c) { lostCdu[c] = 1; });
      if (fault === 'cdu') lostCdu = { 1: 1 };
      if (header === 'common') liqShortFrac = Math.min(1, ov.liquidShortKw / hallLiq);
      note = ov.note + (header === 'common' ? ' Common secondary header: the shortfall spreads over every rack.' : ' One loop per CDU: the racks on a dead CDU lose all their liquid cooling.');
      secs = ov.flowLost || header !== 'common' ? 10 : null;
    } else if (fault === 'crah2' || fault === 'crah4') {
      var n = fault === 'crah2' ? 2 : 4;
      h.crahs.filter(function (c) { return c.wall === 'west'; }).slice(0, n).forEach(function (c) { crahOut[c.i] = 1; });
      note = n + ' CRAH units out on the west wall; the aisles they fed take air from the east wall only.';
    } else if (fault === 'fws-pump') {
      var tr = P.transient(r, 'fws-pump');
      series = tr; secs = tr.secondsToLimit;
      note = 'TCS pumps keep running, heat rejection has stopped: the loop water absorbs the heat until the GPUs throttle at ' + p.throttleC + ' °C return.';
    } else if (fault === 'chiller' || fault === 'chw') {
      var tc = P.transient(r, fault);
      series = tc;
      var T = tc.analytic(minute * 60);
      supply = p.supplyAirC + Math.max(0, T - tc.series[0][1]);          // the coil follows its water
      note = fault === 'chiller' ? 'One chiller trips: the N+' + p.chillerRedundancy + ' spare carries the load, CHW recovers.' : 'All chilled water lost: CHW supply rises with the loop’s thermal mass; supply air follows it (shown at ' + minute + ' min).';
      secs = tc.secondsToLimit;
    }
    var perCrahM3s = p.crahUnitKw / (RHOA * CPA * p.airDeltaK);
    var aisleSup = h.aisles.map(function () { return 0; }), aisleDem = h.aisles.map(function () { return 0; });
    h.crahs.forEach(function (c) { if (!crahOut[c.i]) aisleSup[c.aisle] += perCrahM3s; });
    var itLost = 0, throttled = 0, base = (r.air.hallLoadKw - r.air.itKw / p.halls) / h.racks.length;
    var q = h.racks.map(function (k) {
      var lost = header === 'per-cdu' ? (lostCdu[k.cdu] ? 1 : 0) : liqShortFrac;
      if (phase !== 'running' && lost > 0) {          // the rack sheds the load its cold plates can no longer remove
        itLost += rackKw * lost; throttled++;
        return rackKw * (1 - lost) * (1 - cap) + base;
      }
      return rackKw * (1 - cap) + rackKw * cap * lost + base;
    });
    h.racks.forEach(function (k, i) { aisleDem[k.aisle] += q[i] / (RHOA * CPA * p.airDeltaK); });
    var L = h.lengthM;
    var racks = h.racks.map(function (k, i) {
      var f = aisleDem[k.aisle] > 0 ? Math.min(1, aisleSup[k.aisle] / aisleDem[k.aisle]) : 1;
      var westOk = h.crahs.some(function (c) { return c.aisle === k.aisle && c.wall === 'west' && !crahOut[c.i]; });
      var eastOk = h.crahs.some(function (c) { return c.aisle === k.aisle && c.wall === 'east' && !crahOut[c.i]; });
      var xm = k.x + 0.3, d = westOk && eastOk ? Math.min(xm, L - xm) / (L / 2) : westOk ? xm / L : eastOk ? (L - xm) / L : 1;
      var shape = 0.4 + 0.6 * Math.max(0, Math.min(1, d));            // deficit lands furthest from the fans
      var recirc = Math.min(1, (1 - f) * shape * 1.6);
      var exhaustRise = p.airDeltaK * (q[i] / (rackKw * (1 - cap) + 1e-9));
      var inlet = supply + recirc * Math.min(exhaustRise, 40);
      return { i: k.i, x: k.x, y: k.y, row: k.row, aisle: k.aisle, cdu: k.cdu, q: q[i], inlet: inlet, exhaust: inlet + Math.min(exhaustRise, 60), f: f };
    });
    var maxIn = racks.reduce(function (m, k) { return Math.max(m, k.inlet); }, 0);
    return { racks: racks, supply: supply, maxInlet: maxIn, over27: racks.filter(function (k) { return k.inlet > 27; }).length,
             over32: racks.filter(function (k) { return k.inlet > 32; }).length, note: note, series: series, secondsToLimit: secs,
             itLostKw: itLost, throttled: throttled,
             airDemand: aisleDem.reduce(function (a, b) { return a + b; }, 0), airSupply: aisleSup.reduce(function (a, b) { return a + b; }, 0), lostCdu: lostCdu, crahOut: crahOut };
  }

  /* colour: 18 °C → 45 °C, a perceptual ramp (blue · cyan · green · amber · red) */
  var STOPS = [[18, [40, 90, 200]], [24, [0, 190, 220]], [27, [0, 200, 120]], [32, [240, 190, 0]], [38, [240, 90, 40]], [45, [200, 20, 40]]];
  function ramp(t) {
    if (t <= STOPS[0][0]) return STOPS[0][1];
    for (var i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
      var a = STOPS[i - 1], b = STOPS[i], u = (t - a[0]) / (b[0] - a[0]);
      return [0, 1, 2].map(function (c) { return Math.round(a[1][c] + (b[1][c] - a[1][c]) * u); });
    }
    return STOPS[STOPS.length - 1][1];
  }
  function rgb(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')'; }

  function tok(el, name, fallback) { var v = getComputedStyle(el).getPropertyValue(name).trim(); return v || fallback; }
  function draw(cv, r, s, cursor) {
    var h = r.hall, p = r.input, dpr = root.devicePixelRatio || 1;
    var W = cv.clientWidth || 600, scale = W / h.lengthM, H = Math.round(h.widthM * scale);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // field layer: cold aisles shaded by the inlets that face them, hot aisles by exhaust; blurred
    g.save(); g.filter = 'blur(' + Math.max(2, scale * 0.35) + 'px)';
    g.fillStyle = rgb(ramp(s.supply)); g.fillRect(0, 0, W, H);
    s.racks.forEach(function (k) {
      var row = h.rowsY[k.row];
      var southFacing = row.y + p.rackDepthM <= row.hotY0 + 0.01;
      var cy = southFacing ? row.y - p.coldAisleM / 2 : row.y + p.rackDepthM + p.coldAisleM / 2;
      var hy = southFacing ? row.y + p.rackDepthM + p.hotAisleM / 2 : row.y - p.hotAisleM / 2;
      g.fillStyle = rgb(ramp(k.inlet), 0.9); g.fillRect(k.x * scale, (cy - p.coldAisleM / 2) * scale, p.rackPitchM * scale + 1, p.coldAisleM / 2 * scale + 1);
      g.fillStyle = rgb(ramp(Math.min(k.exhaust, 45)), 0.9); g.fillRect(k.x * scale, (hy - p.hotAisleM / 2) * scale, p.rackPitchM * scale + 1, p.hotAisleM * scale + 1);
    });
    g.restore();
    // racks, crisp, coloured by inlet. Colour is not the only channel (a reader with colour-vision
    // deficiency loses green vs amber): above 27 °C a rack gets an outline, above 32 °C a hatch too.
    var ink = tok(cv, '--t1', '#E8EDF5'), bg = tok(cv, '--bg1', '#0a0e1a'), cy = tok(cv, '--c', '#00DDFF'), red = tok(cv, '--r', '#FF5050'), sky = tok(cv, '--t2', '#A0AEC0');
    s.racks.forEach(function (k, idx) {
      var x = k.x * scale + 0.5, y = k.y * scale + 0.5, w = p.rackPitchM * scale - 1, hh = p.rackDepthM * scale - 1;
      g.fillStyle = rgb(ramp(k.inlet)); g.fillRect(x, y, w, hh);
      if (k.inlet > 32) {
        g.save(); g.beginPath(); g.rect(x, y, w, hh); g.clip(); g.strokeStyle = bg; g.lineWidth = 1;
        for (var t = -hh; t < w; t += 4) { g.beginPath(); g.moveTo(x + t, y + hh); g.lineTo(x + t + hh, y); g.stroke(); }
        g.restore();
      }
      if (k.inlet > 27 || (s.lostCdu[k.cdu] && ST.header === 'per-cdu')) { g.strokeStyle = ink; g.lineWidth = 1; g.strokeRect(x, y, w, hh); }
      if (cursor === idx) { g.strokeStyle = cy; g.lineWidth = 2; g.strokeRect(x - 1.5, y - 1.5, w + 3, hh + 3); }
    });
    // CDUs and CRAHs
    h.cdus.forEach(function (c) {
      var dead = s.lostCdu[c.i];
      g.fillStyle = bg; g.strokeStyle = dead ? red : cy; g.lineWidth = 1.4;
      g.fillRect(c.x * scale - 6, c.y * scale - 5, 12, 10); g.strokeRect(c.x * scale - 6, c.y * scale - 5, 12, 10);
      if (dead) { g.beginPath(); g.moveTo(c.x * scale - 6, c.y * scale - 5); g.lineTo(c.x * scale + 6, c.y * scale + 5); g.stroke(); }
    });
    h.crahs.forEach(function (c) {
      var dead = s.crahOut[c.i];
      g.fillStyle = dead ? red : sky;
      g.fillRect(c.x * scale - 3, c.y * scale - 7, 6, 14);
      if (dead) { g.strokeStyle = bg; g.lineWidth = 1.2; g.beginPath(); g.moveTo(c.x * scale - 3, c.y * scale - 7); g.lineTo(c.x * scale + 3, c.y * scale + 7); g.stroke(); }
    });
    return { scale: scale };
  }

  function chart(series, minute, kind) {
    if (!series) return '';
    var W = 560, H = 150, pts = series.series, tMax = pts[pts.length - 1][0];
    var vals = pts.map(function (x) { return x[1]; }).concat([series.limitC]);
    var lo = Math.floor(Math.min.apply(null, vals) - 1), hi = Math.ceil(Math.max.apply(null, vals) + 1);
    var X = function (t) { return 44 + t / tMax * (W - 60); }, Y = function (v) { return 12 + (hi - v) / (hi - lo) * (H - 40); };
    var path = pts.map(function (x, i) { return (i ? 'L' : 'M') + X(x[0]).toFixed(1) + ' ' + Y(x[1]).toFixed(1); }).join('');
    var g = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(series.label) + ' after the fault" style="width:100%;max-width:' + W + 'px">',
      '<rect width="100%" height="100%" fill="var(--bg1)"/>'];
    for (var v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) g.push('<line x1="44" x2="' + (W - 16) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="var(--bd)"/><text x="38" y="' + (Y(v) + 4) + '" fill="var(--t3)" font-size="10" text-anchor="end" font-family="JetBrains Mono, monospace">' + v + '</text>');
    for (var t = 0; t <= tMax; t += 5) g.push('<text x="' + X(t) + '" y="' + (H - 10) + '" fill="var(--t3)" font-size="10" text-anchor="middle" font-family="JetBrains Mono, monospace">' + t + '</text>');
    g.push('<line x1="44" x2="' + (W - 16) + '" y1="' + Y(series.limitC) + '" y2="' + Y(series.limitC) + '" stroke="var(--r)" stroke-dasharray="4 3"/>',
      '<text x="' + (W - 18) + '" y="' + (Y(series.limitC) - 4) + '" fill="var(--r)" font-size="10" text-anchor="end" font-family="JetBrains Mono, monospace">limit ' + series.limitC + ' °C</text>',
      '<path d="' + path + '" fill="none" stroke="var(--c)" stroke-width="1.6"/>');
    if (kind === 'chw' || kind === 'chiller') g.push('<line x1="' + X(minute) + '" x2="' + X(minute) + '" y1="12" y2="' + (H - 28) + '" stroke="var(--o)"/>');
    g.push('<text x="44" y="' + (H - 0) + '" fill="var(--t3)" font-size="10" font-family="JetBrains Mono, monospace">minutes after the fault · ' + esc(series.label) + ' °C</text></svg>');
    return '<div class="ltc-canvas" style="padding:8px">' + g.join('') + '</div>';
  }

  function mount(host) {
    if (!host || !P || !root.LTCPlantStrip) return;
    host.innerHTML = '<div class="ltc-dh-ctl"><label class="ltc-eyebrow" for="dhFault">Fault</label><select class="ltc-select" id="dhFault">' +
      FAULTS.map(function (f) { return '<option value="' + f[0] + '">' + esc(f[1]) + '</option>'; }).join('') + '</select>' +
      '<div class="ltc-seg" role="group" aria-label="CDU secondary loops"><button type="button" data-hdr="common">Common header</button><button type="button" data-hdr="per-cdu">One loop per CDU</button></div>' +
      '<div class="ltc-seg ltc-dh-phase" role="group" aria-label="Racks that lose liquid cooling" hidden><button type="button" data-ph="throttled">Racks throttle (seconds later)</button><button type="button" data-ph="running">If they kept running</button></div>' +
      '<label class="ltc-dh-min" hidden>Minute <input type="range" id="dhMin" min="0" max="30" step="1" value="5"><output id="dhMinO">5</output></label></div>' +
      '<p class="ltc-plant-bal" id="dhRead" aria-live="polite"></p>' +
      '<div class="ltc-dh-wrap"><canvas id="dhCv" role="img" aria-label="DH01 plan coloured by rack inlet temperature"></canvas></div>' +
      '<div class="ltc-dh-legend" id="dhLeg"></div><p class="ltc-note" id="dhNote"></p><div id="dhChart"></div>' +
      '<p class="ltc-note"><b>Thermal approximation for training — not CFD.</b> Supply air per cold aisle from the CRAH fan walls at its ends, rack airflow demand at the design ΔT, deficit made up by recirculated exhaust, weighted toward the aisle middle. It shows where a fault bites and by how much in this plant’s numbers; plumes, under-floor flow and containment leakage need a CFD study.</p>';
    var cv = host.querySelector('#dhCv'), last = null, cursor = -1;
    function legend() {
      var c = [18, 21, 24, 27, 30, 32, 35, 40, 45];
      host.querySelector('#dhLeg').innerHTML = '<span>Rack inlet °C</span>' + c.map(function (t) { return '<i style="background:' + rgb(ramp(t)) + '"></i><b>' + t + '</b>'; }).join('') +
        '<span class="ltc-dh-k"><i class="ol"></i>&gt; 27 recommended limit</span><span class="ltc-dh-k"><i class="ht"></i>&gt; 32 A1 allowable</span>' +
        '<span class="ltc-dh-k"><i class="cdu"></i>CDU</span><span class="ltc-dh-k"><i class="crah"></i>CRAH</span><span class="ltc-dh-k">struck through: out of service</span>';
    }
    function paint() {
      var r = root.LTCPlantStrip.get().result, s = solveHall(r, ST.fault, ST.header, ST.minute, ST.phase);
      last = { r: r, s: s, geo: draw(cv, r, s, typeof cursor === 'number' ? cursor : -1) };
      host.querySelector('#dhRead').innerHTML = '<span>DH01 <b>' + fmt(r.it.hallKw / 1000, 1) + ' MW</b> · ' + r.hall.racks.length + ' racks · ' + fmt(r.hall.lengthM, 1) + ' × ' + fmt(r.hall.widthM, 1) + ' m</span><span class="sep">/</span>' +
        '<span>supply <b>' + fmt(s.supply, 1) + ' °C</b></span><span class="sep">/</span><span>hottest inlet <b>' + fmt(s.maxInlet, 1) + ' °C</b></span><span class="sep">/</span>' +
        '<span>racks &gt; 27 °C <b>' + s.over27 + '</b> · &gt; 32 °C <b>' + s.over32 + '</b></span><span class="sep">/</span>' +
        '<span>air supply / demand <b>' + fmt(s.airSupply, 0) + ' / ' + fmt(s.airDemand, 0) + '</b> m³/s</span>' +
        (s.itLostKw ? '<span class="sep">/</span><span>IT shed <b>' + fmt(s.itLostKw / 1000, 1) + ' MW</b> on ' + s.throttled + ' racks</span>' : '') +
        (s.secondsToLimit ? '<span class="sep">/</span><span>to the limit <b>' + (s.secondsToLimit < 60 ? '≈' + fmt(s.secondsToLimit) + ' s' : fmt(s.secondsToLimit / 60, 1) + ' min') + '</b></span>' : '');
      host.querySelector('#dhNote').textContent = s.note;
      host.querySelector('#dhChart').innerHTML = chart(s.series, ST.minute, ST.fault);
      host.querySelector('.ltc-dh-min').hidden = !(ST.fault === 'chw' || ST.fault === 'chiller');
      [].forEach.call(host.querySelectorAll('[data-hdr]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-hdr') === ST.header)); });
      [].forEach.call(host.querySelectorAll('[data-ph]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ph') === ST.phase)); });
      host.querySelector('.ltc-dh-phase').hidden = !(ST.fault === 'cdu-feeder' || ST.fault === 'cdu');
    }
    host.querySelector('#dhFault').addEventListener('change', function (e) { ST.fault = e.target.value; paint(); });
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hdr]'); if (b) { ST.header = b.getAttribute('data-hdr'); paint(); }
      var ph = e.target.closest('[data-ph]'); if (ph) { ST.phase = ph.getAttribute('data-ph'); paint(); }
    });
    host.querySelector('#dhMin').addEventListener('input', function (e) { ST.minute = +e.target.value; host.querySelector('#dhMinO').textContent = ST.minute; paint(); });
    /* one tooltip path for mouse, touch and keyboard (LTCTrace.show clamps to the viewport) */
    function rackAt(e) {
      var b = cv.getBoundingClientRect(), x = (e.clientX - b.left) / last.geo.scale, y = (e.clientY - b.top) / last.geo.scale, p = last.r.input;
      for (var i = 0; i < last.s.racks.length; i++) { var q = last.s.racks[i]; if (x >= q.x && x <= q.x + p.rackPitchM && y >= q.y && y <= q.y + p.rackDepthM) return i; }
      return -1;
    }
    function showRack(i, cx, cy2) {
      if (!last || i < 0) { if (root.LTCTrace) root.LTCTrace.hide(); return; }
      var k = last.s.racks[i];
      var band = k.inlet <= 27 ? 'inside recommended (18–27 °C)' : k.inlet <= 32 ? 'allowable A1 only (≤ 32 °C)' : 'beyond A1 allowable';
      if (root.LTCTrace && root.LTCTrace.show) root.LTCTrace.show({ title: 'Rack ' + (k.i + 1) + ' · row ' + (k.row + 1),
        rows: [['Inlet', fmt(k.inlet, 1) + ' °C'], ['Air heat', fmt(k.q, 1) + ' kW'], ['CDU', (k.cdu + 1) + ' (feeder ' + (k.cdu % 2 ? 'B' : 'A') + ')'], ['Aisle air', fmt(k.f * 100) + ' % of demand']], note: band }, cx, cy2);
      cv.setAttribute('aria-label', 'DH01 plan. Rack ' + (k.i + 1) + ', row ' + (k.row + 1) + ': inlet ' + fmt(k.inlet, 1) + ' °C, ' + band + '. Arrow keys move between racks.');
    }
    function at(i) { var b = cv.getBoundingClientRect(), k = last.s.racks[i], sc = last.geo.scale, p = last.r.input; return [b.left + (k.x + p.rackPitchM) * sc, b.top + k.y * sc]; }
    cv.tabIndex = 0;
    cv.addEventListener('pointermove', function (e) { if (!last) return; var i = rackAt(e); showRack(i, e.clientX, e.clientY); });
    cv.addEventListener('pointerdown', function (e) { if (!last) return; var i = rackAt(e); if (i >= 0) { cursor = i; paint(); showRack(i, e.clientX, e.clientY); } });
    cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && root.LTCTrace) root.LTCTrace.hide(); });
    cv.addEventListener('keydown', function (e) {
      if (!last) return;
      var n = last.s.racks.length, perRow = last.r.hall.racksPerRow, step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: perRow, ArrowUp: -perRow }[e.key];
      if (e.key === 'Escape') { cursor = -1; paint(); if (root.LTCTrace) root.LTCTrace.hide(); return; }
      if (!step) return;
      e.preventDefault();
      cursor = cursor < 0 ? 0 : Math.max(0, Math.min(n - 1, cursor + step));
      paint(); var xy = at(cursor); showRack(cursor, xy[0], xy[1]);
    });
    cv.addEventListener('focus', function () { if (cursor < 0) { cursor = 0; paint(); var xy = at(0); showRack(0, xy[0], xy[1]); } });
    cv.addEventListener('blur', function () { if (root.LTCTrace) root.LTCTrace.hide(); });
    legend(); paint();
    root.LTCPlantStrip.onChange(paint);
    if (root.ResizeObserver) new ResizeObserver(function () { if (cv.clientWidth) paint(); }).observe(cv);
    document.addEventListener('ltc:tab', function () { if (cv.clientWidth) paint(); });
  }

  root.LTCDH01 = { mount: mount, solveHall: solveHall, FAULTS: FAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LTCDH01;
  function boot() { var h = document.getElementById('ltcDh01'); if (h) mount(h); }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); }
})(typeof window !== 'undefined' ? window : globalThis);
