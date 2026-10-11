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
  var P = root.LTCPlant, P0 = root.LTCPlant;
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

  /* The calculation, pure: plant result + fault in, per-rack inlets out. A mass and energy balance,
   * not a fitted shape:
   *   1. rack airflow demand at the design ΔT (server fans move what the load needs);
   *   2. CRAH fans share one speed under pressure control: supply = min(units alive × rated flow,
   *      1.05 × demand) — 5 % over demand keeps the cold side positive;
   *   3. each fan wall is one pressurised plenum: its air goes to the aisle mouths in proportion to
   *      their demand, discounted by the share of nearby units (exp(−distance / aisle pitch)) still alive;
   *   4. each cold aisle is marched from both ends — every rack takes its demand from the air still
   *      flowing past it, so the supply runs out where the arrows on the plan end;
   *   5. a rack's unmet demand is drawn from exhaust leaking out of the containment (its hot aisle,
   *      mixed with the plenum return), solved as a fixed point;
   *   6. the CRAH coil is an effectiveness model fitted at design (ε = ΔT / (T_supply − T_chw + ΔT)):
   *      when the coil cannot hold set-point — fewer units, warmer chilled water — supply air rises. */
  var MARGIN = 1.05, MIX_HOT = 0.6;
  function solveHall(r, fault, header, minute, phase) {
    var p = r.input, h = r.hall, CPA = P.CONST.CP_A, RHOA = P.CONST.RHO_A, RC = RHOA * CPA;
    var rackKw = r.it.hallKw / h.racks.length, cap = p.capturePct / 100;
    var chw = p.chwSupplyC, liqShortFrac = 0, lostCdu = {}, crahOut = {}, note = '', series = null, secs = null;
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
      note = n + ' CRAH units out on the west wall. The survivors speed up to their rated flow; what they still cannot supply, the racks pull back out of the hot aisle.';
    } else if (fault === 'fws-pump') {
      var tr = P.transient(r, 'fws-pump');
      series = tr; secs = tr.secondsToLimit;
      note = 'TCS pumps keep running, heat rejection has stopped: the loop water absorbs the heat until the GPUs throttle at ' + p.throttleC + ' °C return. The room air is not involved until then.';
    } else if (fault === 'chiller' || fault === 'chw') {
      var tc = P.transient(r, fault);
      series = tc;
      chw = Math.max(p.chwSupplyC, tc.analytic(minute * 60));
      note = fault === 'chiller' ? 'One chiller trips: the N+' + p.chillerRedundancy + ' spare carries the load, CHW recovers.' : 'All chilled water lost: CHW supply rises with the loop’s thermal mass; once the coils can no longer hold set-point the supply air follows (shown at ' + minute + ' min).';
      secs = tc.secondsToLimit;
    }
    // 1 — rack heat to air and the airflow it needs
    var itLost = 0, throttled = 0, base = (r.air.hallLoadKw - r.air.itKw / p.halls) / h.racks.length;
    var q = h.racks.map(function (k) {
      var lost = header === 'per-cdu' ? (lostCdu[k.cdu] ? 1 : 0) : liqShortFrac;
      if (phase !== 'running' && lost > 0) {          // the rack sheds the load its cold plates can no longer remove
        itLost += rackKw * lost; throttled++;
        return rackKw * (1 - lost) * (1 - cap) + base;
      }
      return rackKw * (1 - cap) + rackKw * cap * lost + base;
    });
    var dem = q.map(function (v) { return v / (RC * p.airDeltaK); });
    var demand = dem.reduce(function (a, b) { return a + b; }, 0), qAir = q.reduce(function (a, b) { return a + b; }, 0);
    // 2 — fan speed
    var rated = p.crahUnitKw / (RC * p.airDeltaK), alive = h.crahs.filter(function (c) { return !crahOut[c.i]; });
    var S = Math.min(alive.length * rated, demand * MARGIN), perUnit = alive.length ? S / alive.length : 0;
    // 3 — end zone: one pressurised plenum per wall, so a wall's air goes where the racks pull it,
    //     discounted where the units in front of an aisle mouth are out (share of nearby capacity alive)
    var pitch = 2 * p.rackDepthM + p.hotAisleM + p.coldAisleM;
    var aDem = h.aisles.map(function () { return 0; });
    h.racks.forEach(function (k, i) { aDem[k.aisle] += dem[i]; });
    var mouth = h.aisles.map(function () { return { west: 0, east: 0 }; });
    ['west', 'east'].forEach(function (wall) {
      var units = h.crahs.filter(function (c) { return c.wall === wall; }), live = units.filter(function (c) { return !crahOut[c.i]; });
      var W = live.length * perUnit;
      var w = h.aisles.map(function (ai) {
        var yc = (ai.y0 + ai.y1) / 2, all = 0, up = 0;
        units.forEach(function (c) { var e = Math.exp(-Math.abs(c.y - yc) / pitch); all += e; if (!crahOut[c.i]) up += e; });
        return aDem[ai.i] * (all ? up / all : 0);
      });
      var sw = w.reduce(function (a, b) { return a + b; }, 0);
      h.aisles.forEach(function (ai, j) { mouth[ai.i][wall] = sw ? W * w[j] / sw : 0; });
    });
    // 4 — march each cold aisle from both ends
    var cov = h.racks.map(function () { return 1; }), aisles = [];
    h.aisles.forEach(function (ai) {
      var byX = {};
      h.racks.forEach(function (k, i) { if (k.aisle === ai.i) (byX[k.x.toFixed(3)] = byX[k.x.toFixed(3)] || { x: k.x, idx: [], d: 0 }).idx.push(i); });
      var sl = Object.keys(byX).map(function (key) { return byX[key]; }).sort(function (u, v) { return u.x - v.x; });
      sl.forEach(function (s) { s.d = s.idx.reduce(function (a, i) { return a + dem[i]; }, 0); s.rem = s.d; });
      var D = aDem[ai.i], qw = mouth[ai.i].west, qe = mouth[ai.i].east, tot = qw + qe;
      if (tot > D && tot > 0) { qw *= D / tot; qe *= D / tot; }           // surplus bypasses straight to the return
      var left = qw, i = 0, xw = sl.length ? sl[0].x : 0, xe = sl.length ? sl[sl.length - 1].x + p.rackPitchM : 0;
      while (left > 1e-9 && i < sl.length) { var t = Math.min(left, sl[i].rem); sl[i].rem -= t; left -= t; xw = sl[i].x + p.rackPitchM * (1 - sl[i].rem / (sl[i].d || 1)); if (sl[i].rem <= 1e-9) i++; }
      if (!qw) xw = sl.length ? sl[0].x : 0;
      left = qe; var j = sl.length - 1;
      while (left > 1e-9 && j >= 0) { if (sl[j].rem <= 1e-9) { j--; continue; } var u = Math.min(left, sl[j].rem); left -= u; sl[j].rem -= u; xe = sl[j].x + p.rackPitchM * (sl[j].rem / (sl[j].d || 1)); if (sl[j].rem <= 1e-9) j--; }
      if (!qe) xe = sl.length ? sl[sl.length - 1].x + p.rackPitchM : 0;
      sl.forEach(function (s) { var c = s.d > 0 ? 1 - s.rem / s.d : 1; s.idx.forEach(function (ix) { cov[ix] = c; }); });
      aisles.push({ i: ai.i, west: qw, east: qe, westTo: xw, eastTo: xe, demand: D, bypass: Math.max(0, mouth[ai.i].west + mouth[ai.i].east - D),
                    unmet: sl.reduce(function (a, s) { return a + s.rem; }, 0) });
    });
    // 6 — coil: supply air the CRAHs can hold with this airflow and this chilled water
    var eps = Math.max(0.3, Math.min(0.95, p.airDeltaK / Math.max(0.5, p.supplyAirC - p.chwSupplyC + p.airDeltaK)));
    var Cair = S * RC, supply = Cair > 0 ? Math.max(p.supplyAirC, chw + (1 - eps) / eps * qAir / Cair) : 45;
    var tRet = supply + (Cair > 0 ? qAir / Cair : 0);
    // 5 — unmet demand pulled from the containment: fixed point on the hot-aisle temperatures
    var pairOf = h.racks.map(function (k) { return h.rowsY[k.row].hotY0; }), inlet = h.racks.map(function () { return supply; });
    for (var it = 0; it < 80; it++) {
      var hs = {}, hn = {};
      h.racks.forEach(function (k, i) { var key = pairOf[i]; hs[key] = (hs[key] || 0) + inlet[i] + p.airDeltaK; hn[key] = (hn[key] || 0) + 1; });
      var moved = 0;
      h.racks.forEach(function (k, i) {
        var src = MIX_HOT * hs[pairOf[i]] / hn[pairOf[i]] + (1 - MIX_HOT) * tRet;
        var nx = Math.min(60, supply + (1 - cov[i]) * (src - supply));
        moved = Math.max(moved, Math.abs(nx - inlet[i])); inlet[i] = 0.5 * inlet[i] + 0.5 * nx;
      });
      if (moved < 0.01) break;
    }
    var racks = h.racks.map(function (k, i) {
      return { i: k.i, x: k.x, y: k.y, row: k.row, aisle: k.aisle, cdu: k.cdu, q: q[i], dem: dem[i], inlet: inlet[i], exhaust: inlet[i] + p.airDeltaK, f: cov[i] };
    });
    var maxIn = inlet.reduce(function (m, v) { return Math.max(m, v); }, 0);
    var recirc = racks.reduce(function (a, k) { return a + (1 - k.f) * k.dem; }, 0);
    return { racks: racks, supply: supply, chw: chw, returnC: tRet, coilLimited: supply > p.supplyAirC + 0.05, eps: eps,
             maxInlet: maxIn, over27: racks.filter(function (k) { return k.inlet > 27; }).length,
             over32: racks.filter(function (k) { return k.inlet > 32; }).length, note: note, series: series, secondsToLimit: secs,
             itLostKw: itLost, throttled: throttled, qAirKw: qAir, recircM3s: recirc, aisles: aisles,
             crahAlive: alive.length, crahRatedM3s: rated, crahUnitM3s: perUnit, fanSpeed: rated ? perUnit / rated : 0,
             airDemand: demand, airSupply: S, lostCdu: lostCdu, crahOut: crahOut };
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

  /* Plan view. Colour means ONE thing — temperature (rack inlet, cold-aisle air, supply bands) — so the
   * contained hot aisles are drawn neutral and labelled with the exhaust they hold. The air path is
   * drawn as one continuous loop, the way the solver computes it:
   *   fan wall → end zone → cold aisle (band narrows as racks draw air; it ends where the supply
   *   runs out) → through the rack (grey chevron) → hot aisle (⊙ = up into the ceiling plenum) →
   *   return over the end zones back to the fan walls (dashed = overhead).
   * Where a rack's demand is not met, a red arrow shows exhaust being pulled back out of the
   * containment. Each CDU's secondary loop runs along the hot-aisle edge of the racks it serves. */
  function draw(cv, r, s, cursor) {
    var h = r.hall, p = r.input, dpr = root.devicePixelRatio || 1;
    var Wc = cv.clientWidth || 600, rot = h.widthM > h.lengthM && Wc >= 600;   // long side across on wide screens; a phone keeps the larger scale
    var SW = rot ? h.widthM : h.lengthM, SH = rot ? h.lengthM : h.widthM;
    var PADL = 8, PADT = 22, PADR = 8, PADB = 24;
    var W = Wc, scale = (W - PADL - PADR) / SW, H = Math.round(SH * scale + PADT + PADB);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    function P(x, y) { return rot ? [PADL + y * scale, PADT + x * scale] : [PADL + x * scale, PADT + y * scale]; }
    function R(x, y, w, hh) { var a = P(x, y); return rot ? [a[0], a[1], hh * scale, w * scale] : [a[0], a[1], w * scale, hh * scale]; }
    var ink = tok(cv, '--t1', '#E8EDF5'), mute = tok(cv, '--t3', '#8190a6'), t2 = tok(cv, '--t2', '#b8c2d3'), bg1 = tok(cv, '--bg1', '#0a0e1a'), bg2 = tok(cv, '--bg2', '#111827'),
        bg3 = tok(cv, '--bg3', '#1c2333'), cy = tok(cv, '--c', '#00DDFF'), red = tok(cv, '--r', '#FF5050'), amber = tok(cv, '--o', '#FFB020'), line = tok(cv, '--bd2', 'rgba(255,255,255,.2)');
    var mono = "500 10.5px 'JetBrains Mono', monospace", small = scale < 20;
    var hits = [];
    g.fillStyle = bg1; g.fillRect(0, 0, W, H);
    var hall = R(0, 0, h.lengthM, h.widthM);
    g.fillStyle = bg2; g.fillRect(hall[0], hall[1], hall[2], hall[3]);
    g.strokeStyle = line; g.lineWidth = 1; g.strokeRect(hall[0] + 0.5, hall[1] + 0.5, hall[2] - 1, hall[3] - 1);
    var x0 = p.endZoneM, x1 = x0 + h.racksPerRow * p.rackPitchM, D = p.rackDepthM;
    function hotEdge(row) { return row.y + D <= row.hotY0 + 1e-6 ? row.y + D : row.y; }      // the rack face on the hot aisle
    function coldEdge(row) { return row.y + D <= row.hotY0 + 1e-6 ? row.y : row.y + D; }
    function arrowHead(b, ang, sz, col) {
      g.fillStyle = col; g.beginPath(); g.moveTo(b[0] + Math.cos(ang) * sz, b[1] + Math.sin(ang) * sz);
      g.lineTo(b[0] + Math.cos(ang + 2.5) * sz, b[1] + Math.sin(ang + 2.5) * sz); g.lineTo(b[0] + Math.cos(ang - 2.5) * sz, b[1] + Math.sin(ang - 2.5) * sz); g.fill();
    }
    function seg(a, b, col, lw, dash) { g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]); }
    // cold aisles: air temperature along the aisle from the inlets that face it
    h.aisles.forEach(function (ai) {
      var face = s.racks.filter(function (k) { return k.aisle === ai.i; });
      var rr = R(x0, ai.y0, x1 - x0, ai.y1 - ai.y0);
      if (!face.length) return;
      var a0 = P(x0, 0), a1 = P(x1, 0);
      var gr = g.createLinearGradient(rot ? 0 : a0[0], rot ? a0[1] : 0, rot ? 0 : a1[0], rot ? a1[1] : 0);
      var byX = {};
      face.forEach(function (k) { var key = k.x.toFixed(2); (byX[key] = byX[key] || []).push(k.inlet); });
      Object.keys(byX).sort(function (u, v) { return u - v; }).forEach(function (key) {
        var t = byX[key].reduce(function (m, v) { return m + v; }, 0) / byX[key].length;
        gr.addColorStop(Math.max(0, Math.min(1, (+key + p.rackPitchM / 2 - x0) / (x1 - x0))), rgb(ramp(t), 0.32));
      });
      g.fillStyle = gr; g.fillRect(rr[0], rr[1], rr[2], rr[3]);
    });
    // hot aisles: neutral, hatched, ⊙ = exhaust rising into the ceiling plenum
    var pairs = {};
    h.rowsY.forEach(function (row, ri) { (pairs[row.hotY0] = pairs[row.hotY0] || []).push(ri); });
    Object.keys(pairs).forEach(function (hy) {
      var rows = pairs[hy], ex = s.racks.filter(function (k) { return rows.indexOf(k.row) >= 0; });
      var mean = ex.reduce(function (m, k) { return m + k.exhaust; }, 0) / Math.max(1, ex.length);
      var rr = R(x0, +hy, x1 - x0, p.hotAisleM);
      g.fillStyle = bg3; g.fillRect(rr[0], rr[1], rr[2], rr[3]);
      g.save(); g.beginPath(); g.rect(rr[0], rr[1], rr[2], rr[3]); g.clip(); g.strokeStyle = line; g.lineWidth = 1;
      for (var t = -rr[3] - rr[2]; t < rr[2] + rr[3]; t += 8) { g.beginPath(); g.moveTo(rr[0] + t, rr[1] + rr[3]); g.lineTo(rr[0] + t + rr[3], rr[1]); g.stroke(); }
      g.restore();
      var yc = +hy + p.hotAisleM / 2, rad = Math.max(2.5, Math.min(5, p.hotAisleM * scale * 0.22));
      [0.12, 0.88].forEach(function (f) {
        var c = P(x0 + f * (x1 - x0), yc);
        g.fillStyle = bg3; g.strokeStyle = t2; g.lineWidth = 1.1; g.beginPath(); g.arc(c[0], c[1], rad, 0, 7); g.fill(); g.stroke();
        g.fillStyle = t2; g.beginPath(); g.arc(c[0], c[1], 1.2, 0, 7); g.fill();
      });
      var label = (small ? 'HOT ' : 'HOT AISLE · contained · ') + fmt(mean, 0) + ' °C', c2 = P((x0 + x1) / 2, yc);
      g.font = mono; g.textAlign = 'center'; g.textBaseline = 'middle';
      var tw = g.measureText(label).width + 8, th = 14;
      g.save(); g.translate(c2[0], c2[1]); if (rot) g.rotate(-Math.PI / 2);
      if (p.hotAisleM * scale >= 12) { g.fillStyle = bg3; g.fillRect(-tw / 2, -th / 2, tw, th); g.fillStyle = t2; g.fillText(label, 0, 0.5); }
      g.restore();
      hits.push({ kind: 'hot', rect: rr, mean: mean, rows: rows });
    });
    // racks: inlet colour, outline above 27 °C, hatch above 32 °C, grey when the rack has throttled
    s.racks.forEach(function (k, idx) {
      var rr = R(k.x, k.y, p.rackPitchM, D), x = rr[0], y = rr[1], w = rr[2], hh = rr[3];
      var shed = s.lostCdu[k.cdu] && ST.header === 'per-cdu' && ST.phase !== 'running';
      g.fillStyle = shed ? bg3 : rgb(ramp(k.inlet)); g.fillRect(x, y, w, hh);
      g.strokeStyle = bg1; g.lineWidth = 0.8; g.strokeRect(x + 0.4, y + 0.4, w - 0.8, hh - 0.8);
      if (k.inlet > 32 || shed) {
        g.save(); g.beginPath(); g.rect(x, y, w, hh); g.clip(); g.strokeStyle = shed ? mute : bg1; g.lineWidth = 1;
        for (var t = -hh; t < w + hh; t += 4) { g.beginPath(); g.moveTo(x + t, y + hh); g.lineTo(x + t + hh, y); g.stroke(); }
        g.restore();
      }
      if (k.inlet > 27) { g.strokeStyle = ink; g.lineWidth = 1.2; g.strokeRect(x + 0.6, y + 0.6, w - 1.2, hh - 1.2); }
      if (cursor === idx) { g.strokeStyle = cy; g.lineWidth = 2; g.strokeRect(x - 2, y - 2, w + 4, hh + 4); }
    });
    // air through the racks: grey chevrons cold → hot; red where exhaust is pulled back to the inlet
    h.rowsY.forEach(function (row, ri) {
      var ce = coldEdge(row), he = hotEdge(row), stepN = small ? 5 : 4;
      s.racks.forEach(function (k) {
        if (k.row !== ri) return;
        var j = Math.round((k.x - x0) / p.rackPitchM);
        var xc = k.x + p.rackPitchM / 2;
        if (k.f < 0.97 && j % (small ? 3 : 2) === 0) {
          var a = P(xc, he + (he > ce ? 0.25 : -0.25)), b = P(xc, ce + (he > ce ? -0.15 : 0.15)), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          seg(a, b, red, 1 + 1.8 * (1 - k.f)); arrowHead(b, ang, 3.5 + 1.5 * (1 - k.f), red);
        } else if (k.f >= 0.97 && !small && j % stepN === 2) {
          var a2 = P(xc, ce + (he > ce ? 0.2 : -0.2)), b2 = P(xc, he + (he > ce ? -0.2 : 0.2)), ang2 = Math.atan2(b2[1] - a2[1], b2[0] - a2[0]);
          seg(a2, b2, 'rgba(10,14,26,.55)', 1.2); arrowHead(b2, ang2, 3, 'rgba(10,14,26,.7)');
        }
      });
    });
    // fan-wall discharge plenum: the supply bands start from it, so a dead unit leaves a visible gap
    ['west', 'east'].forEach(function (wall) {
      h.crahs.forEach(function (c) {
        if (c.wall !== wall || s.crahOut[c.i]) return;
        var span = h.widthM / h.crahs.filter(function (u) { return u.wall === wall; }).length;
        var rr = R(wall === 'west' ? 0.45 : h.lengthM - 0.6, c.y - span / 2, 0.15, span);
        g.fillStyle = rgb(ramp(s.supply), 0.9); g.fillRect(rr[0], rr[1], rr[2], rr[3]);
      });
    });
    // supply air: fan wall → end zone → down the cold aisle; the band narrows as racks draw it off
    var qMax = s.aisles.reduce(function (m, a) { return Math.max(m, a.west, a.east); }, 1e-9);
    s.aisles.forEach(function (a) {
      var ai = h.aisles[a.i], yc = (ai.y0 + ai.y1) / 2, wMax = Math.min((ai.y1 - ai.y0) * scale * 0.55, 16);
      [['west', 0.55, x0, a.westTo, a.west], ['east', h.lengthM - 0.55, x1, a.eastTo, a.east]].forEach(function (d) {
        var q = d[4]; if (q <= 0) return;
        var w0 = Math.max(2, wMax * q / qMax), A = P(d[1], yc), M = P(d[2], yc), E = P(d[3], yc);
        var ux = E[0] - A[0], uy = E[1] - A[1], L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
        var nx = -uy, ny = ux, col = rgb(ramp(s.supply), 0.9);
        g.fillStyle = col; g.beginPath();
        g.moveTo(A[0] + nx * w0 / 2, A[1] + ny * w0 / 2); g.lineTo(M[0] + nx * w0 / 2, M[1] + ny * w0 / 2); g.lineTo(E[0], E[1]);
        g.lineTo(M[0] - nx * w0 / 2, M[1] - ny * w0 / 2); g.lineTo(A[0] - nx * w0 / 2, A[1] - ny * w0 / 2); g.closePath(); g.fill();
        g.strokeStyle = bg1; g.lineWidth = 1.3;                         // direction chevrons on the band
        var span = Math.hypot(E[0] - A[0], E[1] - A[1]);
        for (var t = 14; t < span - 10; t += 34) {
          var c = [A[0] + ux * t, A[1] + uy * t], hw = Math.min(w0 / 2 - 0.5, 4);
          if (hw < 1.5) break;
          g.beginPath(); g.moveTo(c[0] - ux * 3 + nx * hw, c[1] - uy * 3 + ny * hw); g.lineTo(c[0] + ux * 1.5, c[1] + uy * 1.5); g.lineTo(c[0] - ux * 3 - nx * hw, c[1] - uy * 3 - ny * hw); g.stroke();
        }
      });
      if (a.westTo < a.eastTo - 0.1 && a.unmet > 1e-6) {               // stretch of aisle no supply reaches
        var gr = R(a.westTo, ai.y0 + 0.15, a.eastTo - a.westTo, ai.y1 - ai.y0 - 0.3);
        g.strokeStyle = red; g.lineWidth = 1.2; g.setLineDash([4, 3]); g.strokeRect(gr[0] + 0.5, gr[1] + 0.5, gr[2] - 1, gr[3] - 1); g.setLineDash([]);
      }
      hits.push({ kind: 'aisle', rect: R(x0, ai.y0, x1 - x0, ai.y1 - ai.y0), a: a });
    });
    // return: hot-aisle ends → over the end zones → fan walls (dashed: overhead, in the ceiling plenum)
    Object.keys(pairs).forEach(function (hy) {
      var yc = +hy + p.hotAisleM / 2;
      [[x0, 0.9], [x1, h.lengthM - 0.9]].forEach(function (d) {
        var a = P(d[0], yc), b = P(d[1], yc), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        seg(a, b, t2, 1.3, [5, 4]); arrowHead(b, ang, 4.5, t2);
      });
    });
    // fan walls: unit, speed shown as fill height; out of service struck through in red
    h.crahs.forEach(function (c) {
      var dead = s.crahOut[c.i], rr = R(c.wall === 'west' ? 0 : h.lengthM - 0.45, c.y - 0.5, 0.45, 1.0);
      g.fillStyle = bg1; g.fillRect(rr[0], rr[1], rr[2], rr[3]);
      g.strokeStyle = dead ? red : t2; g.lineWidth = 1.2; g.strokeRect(rr[0] + 0.5, rr[1] + 0.5, rr[2] - 1, rr[3] - 1);
      if (dead) { g.beginPath(); g.moveTo(rr[0], rr[1]); g.lineTo(rr[0] + rr[2], rr[1] + rr[3]); g.moveTo(rr[0] + rr[2], rr[1]); g.lineTo(rr[0], rr[1] + rr[3]); g.stroke(); }
      else { g.fillStyle = t2; var fw = (rr[2] - 3) * Math.min(1, s.fanSpeed); g.fillRect(rr[0] + 1.5, rr[1] + 1.5, fw, rr[3] - 3); }
      hits.push({ kind: 'crah', rect: rr, c: c, dead: dead });
    });
    // CDU secondary loops along the hot-aisle edge of the racks each one serves
    var short = ST.header === 'common' && Object.keys(s.lostCdu).length > 0;
    h.cdus.forEach(function (c) {
      var dead = s.lostCdu[c.i], col = dead ? (ST.header === 'per-cdu' ? red : amber) : short ? amber : cy, dash = dead ? [4, 3] : [];
      var mine = s.racks.filter(function (k) { return k.cdu === c.i; }), byRow = {};
      mine.forEach(function (k) { var b = byRow[k.row] = byRow[k.row] || { lo: 1e9, hi: -1e9 }; b.lo = Math.min(b.lo, k.x); b.hi = Math.max(b.hi, k.x + p.rackPitchM); });
      var cp = P(c.x, c.y);
      Object.keys(byRow).forEach(function (ri) {
        var row = h.rowsY[ri], he = hotEdge(row), off = he > row.y + 0.01 ? -0.12 : 0.12, b = byRow[ri], ye = he + off;
        var nearEnd = Math.abs(c.x - b.lo) < Math.abs(c.x - b.hi) ? b.lo : b.hi;
        seg(P(b.lo, ye), P(b.hi, ye), col, small ? 1.4 : 2, dash);
        var e = P(nearEnd, ye);
        g.strokeStyle = col; g.lineWidth = small ? 0.9 : 1.2; g.setLineDash(dash); g.beginPath(); g.moveTo(cp[0], cp[1]);
        if (rot) { g.lineTo(cp[0], e[1]); g.lineTo(e[0], e[1]); } else { g.lineTo(e[0], cp[1]); g.lineTo(e[0], e[1]); }
        g.stroke(); g.setLineDash([]);
      });
      var bw = 18, bh = 13;
      g.fillStyle = bg1; g.strokeStyle = col; g.lineWidth = 1.4;
      g.fillRect(cp[0] - bw / 2, cp[1] - bh / 2, bw, bh); g.strokeRect(cp[0] - bw / 2, cp[1] - bh / 2, bw, bh);
      if (dead) { g.beginPath(); g.moveTo(cp[0] - bw / 2, cp[1] - bh / 2); g.lineTo(cp[0] + bw / 2, cp[1] + bh / 2); g.stroke(); }
      g.fillStyle = col; g.font = "600 9.5px 'JetBrains Mono', monospace"; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(c.i + 1), cp[0], cp[1] + 0.5);
      hits.push({ kind: 'cdu', rect: [cp[0] - bw / 2, cp[1] - bh / 2, bw, bh], c: c, dead: dead, racks: mine.length });
    });
    // row labels just outside the rack ends
    g.fillStyle = mute; g.font = mono; g.textBaseline = 'middle'; g.textAlign = 'center';
    h.rowsY.forEach(function (row, ri) {
      var c = P(x1 + 0.45, row.y + D / 2);
      g.fillText('R' + (ri + 1), c[0], c[1]);
    });
    // wall captions and a 5 m scale bar
    var wl = P(0, 0), wr = P(h.lengthM, 0), aliveW = h.crahs.filter(function (c) { return c.wall === 'west' && !s.crahOut[c.i]; }).length,
        aliveE = h.crahs.filter(function (c) { return c.wall === 'east' && !s.crahOut[c.i]; }).length,
        nW = h.crahs.filter(function (c) { return c.wall === 'west'; }).length, nE = h.crahs.length - nW, spd = fmt(s.fanSpeed * 100) + ' % speed';
    g.fillStyle = t2; g.font = mono; g.textAlign = 'left';
    var capW = (small ? 'W wall · ' : 'FAN WALL W · ') + aliveW + '/' + nW + ' units · ' + spd, capE = (small ? 'E wall · ' : 'FAN WALL E · ') + aliveE + '/' + nE + ' units · ' + spd;
    if (rot) { g.textBaseline = 'alphabetic'; g.fillText(capW, PADL, wl[1] - 7); g.textBaseline = 'top'; g.fillText(capE, PADL, wr[1] + 6); }
    else { g.textBaseline = 'alphabetic'; g.fillText('◀ ' + capW, PADL, PADT - 7); g.textBaseline = 'top'; g.fillText(capE + ' ▶', PADL, PADT + h.widthM * scale + 6); }
    var sb = 5 * scale, sx = W - PADR - sb, sy = H - 3;
    g.strokeStyle = mute; g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx, sy - 4); g.lineTo(sx, sy); g.lineTo(sx + sb, sy); g.lineTo(sx + sb, sy - 4); g.stroke();
    g.fillStyle = mute; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('5 m', sx + sb / 2, sy - 2);
    return { scale: scale, P: P, R: R, rot: rot, hits: hits };
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
      '<p class="ltc-plant-bal" id="dhRead" aria-live="polite"></p><div class="ltc-dh-chain" id="dhChain"></div>' +
      '<div class="ltc-dh-wrap"><canvas id="dhCv" role="img" aria-label="DH01 plan coloured by rack inlet temperature"></canvas></div>' +
      '<div class="ltc-dh-legend" id="dhLeg"></div><p class="ltc-note" id="dhNote"></p><div id="dhChart"></div>' +
      '<p class="ltc-note"><b>Thermal approximation for training — not CFD.</b> A mass and energy balance on this plant’s numbers: rack airflow at the design ΔT; CRAH fans share one speed up to their rated flow (5 % over demand under pressure control); each fan wall feeds the aisle mouths in proportion to demand, less where its units are out; each cold aisle is marched from both ends until its air is used up; unmet demand is pulled from the hot aisle and plenum return (solved to a fixed point); the CRAH coil is an effectiveness model fitted at design, so supply air rises when the coil cannot hold set-point. Jets, plumes and leakage paths need a CFD study.</p>';
    var cv = host.querySelector('#dhCv'), last = null, cursor = -1;
    function legend() {
      var c = [18, 21, 24, 27, 30, 32, 35, 40, 45];
      function sv(body) { return '<svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">' + body + '</svg>'; }
      host.querySelector('#dhLeg').innerHTML = '<span>Inlet / air °C</span>' + c.map(function (t) { return '<i style="background:' + rgb(ramp(t)) + '"></i><b>' + t + '</b>'; }).join('') +
        '<span class="ltc-dh-k"><i class="ol"></i>&gt; 27 recommended</span><span class="ltc-dh-k"><i class="ht"></i>&gt; 32 A1 allowable</span>' +
        '<span class="ltc-dh-k">' + sv('<path d="M1 3h12l11 3-11 3H1z" fill="' + rgb(ramp(24)) + '"/>') + 'supply air, width = m³/s, ends where it is used up</span>' +
        '<span class="ltc-dh-k">' + sv('<path d="M3 6h16" stroke="var(--t2)" stroke-width="1.3" stroke-dasharray="4 3"/><path d="M24 6l-6 3V3z" fill="var(--t2)"/>') + 'return via ceiling plenum</span>' +
        '<span class="ltc-dh-k">' + sv('<circle cx="13" cy="6" r="4.5" fill="none" stroke="var(--t2)"/><circle cx="13" cy="6" r="1.2" fill="var(--t2)"/>') + 'exhaust rising out of the hot aisle</span>' +
        '<span class="ltc-dh-k">' + sv('<path d="M3 6h15" stroke="var(--r)" stroke-width="2.5"/><path d="M24 6l-7 4V2z" fill="var(--r)"/>') + 'exhaust pulled back to the inlet</span>' +
        '<span class="ltc-dh-k">' + sv('<rect x="1" y="2" width="12" height="8" fill="none" stroke="var(--c)" stroke-width="1.3"/><path d="M13 6h12" stroke="var(--c)" stroke-width="2"/>') + 'CDU + its secondary loop</span>' +
        '<span class="ltc-dh-k">' + sv('<rect x="8" y="1" width="8" height="10" fill="none" stroke="var(--t2)"/><rect x="9.5" y="2.5" width="4" height="7" fill="var(--t2)"/>') + 'CRAH, fill = fan speed</span>' +
        '<span class="ltc-dh-k">red / struck: out of service · grey hatch: rack throttled</span>';
    }
    function chainHtml(r, s) {
      var p = r.input, F = ST.fault, cap = p.capturePct / 100, nC = r.liquid.cduPerHall, lost = Object.keys(s.lostCdu).length;
      function chip(lbl, val, st, why) { return '<li class="' + (st || 'ok') + '" title="' + esc(why) + '"><span>' + esc(lbl) + '</span><b>' + val + '</b></li>'; }
      var itNow = r.it.hallKw - s.itLostKw;
      var liq = [
        chip('IT · DH01', fmt(itNow / 1000, 1) + ' MW', s.itLostKw ? 'warn' : 'ok', s.itLostKw ? 'Racks on dead loops throttled: ' + fmt(s.itLostKw / 1000, 1) + ' MW shed' : 'Hall IT load'),
        chip('Cold plates ' + p.capturePct + ' %', fmt(itNow * cap / 1000, 1) + ' MW', s.itLostKw ? 'warn' : 'ok', 'Heat captured to liquid'),
        chip('CDUs', (nC - lost) + ' / ' + nC, lost ? (ST.header === 'per-cdu' ? 'bad' : 'warn') : 'ok', lost ? (ST.header === 'per-cdu' ? 'One loop per CDU: racks on a dead CDU lose all liquid cooling' : 'Common header: survivors share the duty, short by the lost units') : 'All CDUs running'),
        chip('TCS', fmt(p.tcsSupplyC, 0) + ' → ' + fmt(p.tcsReturnC, 0) + ' °C', F === 'fws-pump' ? 'bad' : 'ok', F === 'fws-pump' ? 'No heat rejection: return rises to the ' + p.throttleC + ' °C throttle' : 'Secondary loop at design'),
        chip('FWS', fmt(r.liquid.fwsSupplyC, 0) + ' °C', F === 'fws-pump' ? 'bad' : 'ok', 'Facility water to the CDUs'),
        chip(String(r.liquid.coolerType).replace('drycooler', 'dry coolers').replace('fluidcooler', 'fluid coolers'), r.liquid.coolerUnitsTotal + ' units', F === 'fws-pump' ? 'bad' : 'ok', 'Heat rejection to ambient')
      ];
      var shortN = s.racks.filter(function (k) { return k.f < 0.97; }).length;
      var air = [
        chip('Rack air + losses', fmt(s.qAirKw / 1000, 2) + ' MW', 'ok', 'Uncaptured IT heat, cords, PDUs, CDU skins, fan heat'),
        chip('Cold aisles', s.recircM3s > 0.05 ? shortN + ' racks short' : 'fully fed', s.recircM3s > 0.05 ? 'bad' : 'ok', s.recircM3s > 0.05 ? fmt(s.recircM3s, 1) + ' m³/s of exhaust pulled back into the inlets' : 'Every rack gets supply air'),
        chip('CRAHs', s.crahAlive + ' / ' + r.hall.crahs.length + ' · ' + fmt(s.fanSpeed * 100) + ' %', s.crahAlive < r.hall.crahs.length ? 'bad' : 'ok', fmt(s.airSupply, 0) + ' of ' + fmt(s.airDemand, 0) + ' m³/s demanded; rated ' + fmt(s.crahRatedM3s, 1) + ' m³/s per unit'),
        chip('Supply air', fmt(s.supply, 1) + ' °C', s.coilLimited ? 'bad' : 'ok', s.coilLimited ? 'Coil cannot hold the ' + p.supplyAirC + ' °C set-point (effectiveness ' + fmt(s.eps, 2) + ')' : 'At set-point'),
        chip('Return', fmt(s.returnC, 1) + ' °C', 'ok', 'Mixed plenum return to the CRAHs'),
        chip('CHW', fmt(s.chw, 1) + ' °C', F === 'chw' ? 'bad' : F === 'chiller' ? 'warn' : 'ok', F === 'chw' ? 'Chilled water lost — rising with the loop thermal mass' : F === 'chiller' ? 'Spare chiller carries the load' : 'Chilled water supply'),
        chip('Chillers', r.air.chillersTotal + ' (N+' + p.chillerRedundancy + ')', F === 'chw' ? 'bad' : F === 'chiller' ? 'warn' : 'ok', 'Plant-wide')
      ];
      return '<div><span class="ltc-eyebrow">Liquid path</span><ol>' + liq.join('') + '</ol></div><div><span class="ltc-eyebrow">Air path</span><ol>' + air.join('') + '</ol></div>';
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
      host.querySelector('#dhChain').innerHTML = chainHtml(r, s);
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
      var b = cv.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top, p = last.r.input;
      for (var i = 0; i < last.s.racks.length; i++) {
        var q = last.s.racks[i], rr = last.geo.R(q.x, q.y, p.rackPitchM, p.rackDepthM);
        if (mx >= rr[0] && mx <= rr[0] + rr[2] && my >= rr[1] && my <= rr[1] + rr[3]) return i;
      }
      return -1;
    }
    function unitAt(e) {
      var b = cv.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top, hs = last.geo.hits;
      for (var pass = 0; pass < 2; pass++) for (var i = 0; i < hs.length; i++) {
        var u = hs[i], rr = u.rect, pad = pass ? 0 : 3;
        if ((pass === 0) !== (u.kind === 'crah' || u.kind === 'cdu')) continue;
        if (mx >= rr[0] - pad && mx <= rr[0] + rr[2] + pad && my >= rr[1] - pad && my <= rr[1] + rr[3] + pad) return u;
      }
      return null;
    }
    function showUnit(u, cx, cy2) {
      var s = last.s, p = last.r.input, t;
      if (u.kind === 'crah') t = { title: 'CRAH ' + (u.c.i + 1) + ' · ' + u.c.wall + ' fan wall', rows: u.dead ? [['State', 'out of service']] :
        [['Airflow', fmt(s.crahUnitM3s, 1) + ' of ' + fmt(s.crahRatedM3s, 1) + ' m³/s'], ['Fan speed', fmt(s.fanSpeed * 100) + ' %'], ['Supply', fmt(s.supply, 1) + ' °C'], ['Return', fmt(s.returnC, 1) + ' °C'], ['Coil', fmt(p.crahUnitKw) + ' kW rated · CHW ' + fmt(s.chw, 1) + ' °C']],
        note: 'All units share one speed under pressure control.' };
      else if (u.kind === 'cdu') t = { title: 'CDU ' + (u.c.i + 1) + ' · feeder ' + u.c.feeder, rows: [['State', u.dead ? 'lost' : 'running'], ['Racks served', String(u.racks)],
        ['Duty', fmt(last.r.liquid.dutyKw / p.halls / last.r.liquid.cduPerHall) + ' kW'], ['TCS', fmt(p.tcsSupplyC, 0) + ' → ' + fmt(p.tcsReturnC, 0) + ' °C']],
        note: ST.header === 'per-cdu' ? 'One secondary loop per CDU.' : 'Common secondary header: CDUs share the racks.' };
      else if (u.kind === 'aisle') t = { title: 'Cold aisle ' + (u.a.i + 1), rows: [['Demand', fmt(u.a.demand, 1) + ' m³/s'], ['From W wall', fmt(u.a.west, 1) + ' m³/s'], ['From E wall', fmt(u.a.east, 1) + ' m³/s'],
        [u.a.unmet > 1e-6 ? 'Unmet' : 'Bypass', fmt(u.a.unmet > 1e-6 ? u.a.unmet : u.a.bypass, 1) + ' m³/s']], note: u.a.unmet > 1e-6 ? 'Red dashed box: the stretch no supply air reaches.' : 'Fed from both ends.' };
      else t = { title: 'Hot aisle · rows ' + u.rows.map(function (x) { return 'R' + (x + 1); }).join(' + '), rows: [['Mean exhaust', fmt(u.mean, 1) + ' °C'], ['Plenum return', fmt(s.returnC, 1) + ' °C']], note: 'Contained; exhaust rises into the ceiling plenum and returns to the fan walls.' };
      if (root.LTCTrace && root.LTCTrace.show) root.LTCTrace.show(t, cx, cy2);
    }
    function showRack(i, cx, cy2) {
      if (!last || i < 0) { if (root.LTCTrace) root.LTCTrace.hide(); return; }
      var k = last.s.racks[i];
      var band = k.inlet <= 27 ? 'inside recommended (18–27 °C)' : k.inlet <= 32 ? 'allowable A1 only (≤ 32 °C)' : 'beyond A1 allowable';
      if (root.LTCTrace && root.LTCTrace.show) root.LTCTrace.show({ title: 'Rack ' + (k.i + 1) + ' · row ' + (k.row + 1),
        rows: [['Inlet', fmt(k.inlet, 1) + ' °C'], ['Exhaust', fmt(k.exhaust, 1) + ' °C'], ['Heat to air', fmt(k.q, 1) + ' kW'], ['Airflow', fmt(k.dem, 2) + ' m³/s · ' + fmt(k.f * 100) + ' % from supply'], ['CDU', (k.cdu + 1) + ' (feeder ' + (k.cdu % 2 ? 'B' : 'A') + ')']], note: band }, cx, cy2);
      cv.setAttribute('aria-label', 'DH01 plan. Rack ' + (k.i + 1) + ', row ' + (k.row + 1) + ': inlet ' + fmt(k.inlet, 1) + ' °C, ' + band + '. Arrow keys move between racks.');
    }
    function at(i) { var b = cv.getBoundingClientRect(), k = last.s.racks[i], p = last.r.input, rr = last.geo.R(k.x, k.y, p.rackPitchM, p.rackDepthM); return [b.left + rr[0] + rr[2], b.top + rr[1]]; }
    cv.tabIndex = 0;
    function hover(e) {
      var i = rackAt(e); if (i >= 0) { showRack(i, e.clientX, e.clientY); return; }
      var u = unitAt(e); if (u) showUnit(u, e.clientX, e.clientY); else if (root.LTCTrace) root.LTCTrace.hide();
    }
    cv.addEventListener('pointermove', function (e) { if (last) hover(e); });
    cv.addEventListener('pointerdown', function (e) { if (!last) return; var i = rackAt(e); if (i >= 0) { cursor = i; paint(); showRack(i, e.clientX, e.clientY); } else hover(e); });
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
