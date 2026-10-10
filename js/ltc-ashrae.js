/* ============================================================================
 * ltc-ashrae.js — ASHRAE TC 9.9 thermal envelope workbench
 * ----------------------------------------------------------------------------
 * Basis: ASHRAE TC 9.9, Thermal Guidelines for Data Processing Environments,
 * 5th edition (2021), and the TC 9.9 liquid-cooling classes of the same
 * edition. Values below are the published envelope limits; the psychrometrics
 * are computed (Magnus saturation pressure, Sonntag/Alduchov coefficients,
 * standard-atmosphere pressure at altitude). Nothing here is typed per case.
 *
 * Educational tool. A design must be checked against the current edition and
 * the IT manufacturer's own limits, which may be tighter.
 * ==========================================================================*/
(function () {
  'use strict';
  var L = window.LTC;

  /* ---- published envelope (5th ed., 2021) -------------------------------- */
  var REC = { lo: 18, hi: 27, dpLo: -9, dpHi: 15, rhLo: 0, rhHi: 70 };
  /* derate: °C of maximum dry-bulb lost per `per` metres above 900 m */
  var CLASSES = [
    { id: 'A1', lo: 15, hi: 32, dpLo: -12, rhLo: 8, dpHi: 17, rhHi: 80, per: 300, use: 'Enterprise servers, storage — tightly controlled' },
    { id: 'A2', lo: 10, hi: 35, dpLo: -12, rhLo: 8, dpHi: 21, rhHi: 80, per: 300, use: 'Volume servers, storage, PCs — some control' },
    { id: 'A3', lo: 5, hi: 40, dpLo: -12, rhLo: 8, dpHi: 24, rhHi: 85, per: 175, use: 'Volume servers — some control' },
    { id: 'A4', lo: 5, hi: 45, dpLo: -12, rhLo: 8, dpHi: 24, rhHi: 90, per: 125, use: 'Volume servers — some control' },
    { id: 'H1', lo: 5, hi: 25, dpLo: -12, rhLo: 8, dpHi: 17, rhHi: 80, per: null, use: 'High-density air-cooled products (2021); recommended 18–22 °C', recHi: 22 }
  ];
  var LIQUID = [
    { id: 'W17', max: 17, plant: 'Chiller, with cooling tower or economiser assist' },
    { id: 'W27', max: 27, plant: 'Cooling tower with chiller trim, or water-side economiser' },
    { id: 'W32', max: 32, plant: 'Cooling tower; chiller only in the hottest hours' },
    { id: 'W40', max: 40, plant: 'Dry cooler or cooling tower, no chiller in most climates' },
    { id: 'W45', max: 45, plant: 'Dry cooler; heat-reuse ready' },
    { id: 'W+', max: Infinity, plant: 'Above 45 °C supply: dry cooler, heat reuse (district heat)' }
  ];

  /* ---- psychrometrics ----------------------------------------------------- */
  function es(t) { return 0.6112 * Math.exp(17.62 * t / (243.12 + t)); }           /* kPa, over water */
  function dpFromPv(pv) { var g = Math.log(pv / 0.6112); return 243.12 * g / (17.62 - g); }
  function pAlt(z) { return 101.325 * Math.pow(1 - 2.25577e-5 * z, 5.25588); }        /* kPa */
  function wOf(pv, p) { return 622 * pv / (p - pv); }                                 /* g/kg dry air */
  function rhOf(db, dp) { return 100 * es(dp) / es(db); }

  function derated(c, z) {
    if (!c.per || z <= 900) return c.hi;
    return c.hi - (z - 900) / c.per;
  }
  /* Recommended maximum is derated 1 °C per 300 m above 1,800 m (TG 5th ed. note). */
  function recHi(z) { return z <= 1800 ? REC.hi : REC.hi - (z - 1800) / 300; }

  function check(db, dp, z) {
    var rh = rhOf(db, dp);
    function inRegion(r, hi) {
      return db >= r.lo && db <= hi && dp >= r.dpLo && dp <= r.dpHi && rh >= r.rhLo && rh <= r.rhHi;
    }
    var rec = inRegion(REC, recHi(z));
    var rows = CLASSES.map(function (c) {
      var hi = derated(c, z);
      var allow = inRegion(c, hi);
      var recC = c.recHi ? inRegion({ lo: 18, hi: Math.min(c.recHi, recHi(z)), dpLo: REC.dpLo, dpHi: REC.dpHi, rhLo: 0, rhHi: REC.rhHi }, Math.min(c.recHi, recHi(z))) : rec;
      /* the binding limit: the smallest margin to any boundary, signed */
      var margins = [
        ['dry-bulb high', hi - db, '°C'], ['dry-bulb low', db - c.lo, '°C'],
        ['dew point high', c.dpHi - dp, 'K'], ['dew point low', dp - c.dpLo, 'K'],
        ['RH high', c.rhHi - rh, '%'], ['RH low', rh - c.rhLo, '%']
      ];
      margins.sort(function (a, b) { return a[1] - b[1]; });
      return { c: c, hi: hi, allow: allow, rec: recC, bind: margins[0] };
    });
    return { rh: rh, rec: rec, rows: rows };
  }

  /* ---- chart (a data chart: geometry is computed from scales, not typed) -- */
  var CH = { W: 640, H: 420, l: 52, r: 24, t: 20, b: 44, x0: 0, x1: 50, y0: 0, y1: 30 };
  function sx(t) { return CH.l + (t - CH.x0) / (CH.x1 - CH.x0) * (CH.W - CH.l - CH.r); }
  function sy(w) { return CH.H - CH.b - (w - CH.y0) / (CH.y1 - CH.y0) * (CH.H - CH.t - CH.b); }
  function regionPath(r, hi, p) {
    var top = [], bot = [];
    for (var t = r.lo; t <= hi + 1e-9; t += 0.25) {
      var wLo = Math.max(wOf(es(r.dpLo), p), wOf(es(t) * r.rhLo / 100, p));
      var wHi = Math.min(wOf(es(r.dpHi), p), wOf(es(t) * r.rhHi / 100, p));
      if (wHi < wLo) continue;
      bot.push([sx(t), sy(wLo)]); top.push([sx(t), sy(wHi)]);
    }
    if (!bot.length) return '';
    var pts = bot.concat(top.reverse());
    return 'M' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' L') + ' Z';
  }
  function chart(db, dp, z, sel, cloud) {
    var p = pAlt(z);
    var s = [];
    s.push('<svg data-psy="' + z + '" viewBox="0 0 ' + CH.W + ' ' + CH.H + '" role="img" aria-labelledby="psy-t psy-d" style="width:100%;max-width:' + CH.W + 'px;min-width:360px">');
    s.push('<title id="psy-t">Psychrometric chart with ASHRAE envelopes</title><desc id="psy-d">Dry-bulb temperature against humidity ratio at ' +
      Math.round(z) + ' m, showing the recommended envelope, the selected allowable class and the inlet condition.</desc>');
    s.push('<rect width="100%" height="100%" fill="var(--bg1)"/>');
    /* grid */
    for (var t = 0; t <= 50; t += 5) {
      s.push('<line x1="' + sx(t) + '" y1="' + sy(0) + '" x2="' + sx(t) + '" y2="' + sy(30) + '" stroke="var(--bd)" stroke-width="0.6"/>');
      s.push('<text x="' + sx(t) + '" y="' + (sy(0) + 16) + '" fill="var(--t3)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">' + t + '</text>');
    }
    for (var w = 0; w <= 30; w += 5) {
      s.push('<line x1="' + sx(0) + '" y1="' + sy(w) + '" x2="' + sx(50) + '" y2="' + sy(w) + '" stroke="var(--bd)" stroke-width="0.6"/>');
      s.push('<text x="' + (sx(0) - 8) + '" y="' + (sy(w) + 4) + '" fill="var(--t3)" font-size="11" text-anchor="end" font-family="JetBrains Mono, monospace">' + w + '</text>');
    }
    s.push('<text x="' + sx(25) + '" y="' + (CH.H - 6) + '" fill="var(--t3)" font-size="11" text-anchor="middle" font-family="IBM Plex Sans, sans-serif">Dry-bulb °C</text>');
    s.push('<text x="14" y="' + sy(15) + '" fill="var(--t3)" font-size="11" text-anchor="middle" transform="rotate(-90 14 ' + sy(15) + ')" font-family="IBM Plex Sans, sans-serif">Humidity ratio g/kg</text>');
    /* RH curves */
    [20, 40, 60, 80, 100].forEach(function (rh) {
      var d = [];
      for (var tt = 0; tt <= 50; tt += 1) {
        var ww = wOf(es(tt) * rh / 100, p);
        if (ww > 30) break;
        d.push(sx(tt).toFixed(1) + ' ' + sy(ww).toFixed(1));
      }
      s.push('<path d="M' + d.join(' L') + '" fill="none" stroke="var(--t3)" stroke-width="' + (rh === 100 ? 1.2 : 0.6) + '"' + (rh === 100 ? '' : ' stroke-dasharray="2 3"') + '/>');
      var last = d[d.length - 1].split(' ');
      s.push('<text x="' + (+last[0] + 3) + '" y="' + (+last[1] - 2) + '" fill="var(--t3)" font-size="10" font-family="JetBrains Mono, monospace">' + rh + '%</text>');
    });
    /* allowable class (selected), then recommended on top */
    var c = CLASSES.filter(function (k) { return k.id === sel; })[0];
    s.push('<path d="' + regionPath(c, derated(c, z), p) + '" fill="var(--c)" fill-opacity="0.07" stroke="var(--c)" stroke-width="1" stroke-dasharray="5 3"/>');
    s.push('<path d="' + regionPath(REC, c.recHi ? Math.min(c.recHi, recHi(z)) : recHi(z), p) + '" fill="var(--g)" fill-opacity="0.10" stroke="var(--g)" stroke-width="1.4"/>');
    /* a sensor log: every reading as a small dot, coloured by its own verdict */
    (cloud || []).forEach(function (q) {
      var qw = wOf(es(q.dp), p);
      if (qw > 30 || q.db < 0 || q.db > 50) return;
      s.push('<circle cx="' + sx(q.db).toFixed(1) + '" cy="' + sy(qw).toFixed(1) + '" r="2.6" fill="var(--' +
        (q.state === 'rec' ? 'g' : q.state === 'allow' ? 'o' : 'r') + ')" fill-opacity="0.75"/>');
    });
    /* the point */
    var pw = wOf(es(dp), p);
    if (db != null && pw <= 30 && db >= 0 && db <= 50) {
      s.push('<circle cx="' + sx(db) + '" cy="' + sy(pw) + '" r="5" fill="var(--o)" stroke="var(--bg1)" stroke-width="1.5"/>');
      s.push('<line x1="' + sx(db) + '" y1="' + (sy(pw) + 6) + '" x2="' + sx(db) + '" y2="' + sy(0) + '" stroke="var(--o)" stroke-width="0.6" stroke-dasharray="2 2"/>');
    }
    /* legend strip at the foot (inside the plot's top-left, clear of the curves) */
    s.push('<g font-family="IBM Plex Sans, sans-serif" font-size="11" fill="var(--t2)">' +
      '<rect x="' + (CH.l + 10) + '" y="' + (CH.t + 6) + '" width="14" height="9" fill="var(--g)" fill-opacity="0.10" stroke="var(--g)" stroke-width="1.4"/>' +
      '<text x="' + (CH.l + 30) + '" y="' + (CH.t + 14) + '">Recommended</text>' +
      '<rect x="' + (CH.l + 120) + '" y="' + (CH.t + 6) + '" width="14" height="9" fill="var(--c)" fill-opacity="0.07" stroke="var(--c)" stroke-dasharray="5 3"/>' +
      '<text x="' + (CH.l + 140) + '" y="' + (CH.t + 14) + '">' + sel + ' allowable</text>' +
      '<circle cx="' + (CH.l + 236) + '" cy="' + (CH.t + 10.5) + '" r="4.5" fill="var(--o)"/>' +
      '<text x="' + (CH.l + 246) + '" y="' + (CH.t + 14) + '">' + (cloud ? 'Readings (green rec. · amber allow. · red out)' : 'Inlet') + '</text></g>');
    s.push('</svg>');
    return s.join('');
  }

  /* ---- envelope tool ------------------------------------------------------ */
  var st = { db: 24, hmode: 'dp', dp: 10, rh: 50, z: 0, sel: 'A1' };
  function val(id) { var e = document.getElementById(id); return e ? parseFloat(e.value) : NaN; }

  function runEnvelope() {
    st.db = val('aDb'); st.z = Math.max(0, val('aAlt'));
    if (st.hmode === 'dp') { st.dp = val('aDp'); st.rh = rhOf(st.db, st.dp); }
    else { st.rh = val('aRh'); st.dp = dpFromPv(es(st.db) * st.rh / 100); }
    var bad = !isFinite(st.db) || !isFinite(st.dp) || !isFinite(st.z) || st.dp > st.db;
    var out = document.getElementById('aOut');
    if (bad) {
      out.innerHTML = '<div class="ltc-verdict" data-state="fail"><b>Input</b><span>Dew point cannot exceed dry-bulb, and every field needs a number.</span></div>';
      return;
    }
    var r = check(st.db, st.dp, st.z);
    var p = pAlt(st.z);
    var sel = r.rows.filter(function (x) { return x.c.id === st.sel; })[0];
    var verdict = sel.rec ? ['ok', 'Recommended', 'Inside the recommended envelope.'] :
      sel.allow ? ['warn', 'Allowable ' + st.sel, 'Outside recommended, inside ' + st.sel + ' allowable — acceptable for limited periods; reliability and energy trade off.'] :
      ['fail', 'Outside ' + st.sel, 'Binding limit: ' + sel.bind[0] + ' exceeded by ' + L.fmt(-sel.bind[1], 1) + ' ' + sel.bind[2] + '.'];
    var above = st.z > 3050;
    out.innerHTML =
      '<div class="ltc-verdict" data-state="' + verdict[0] + '"><b>' + verdict[1] + '</b><span>' + verdict[2] + '</span></div>' +
      (above ? '<div class="ltc-verdict" data-state="fail"><b>Altitude</b><span>Above 3,050 m — outside the envelope altitude for every class.</span></div>' : '') +
      '<dl class="ltc-readouts">' +
      ro('Relative humidity', L.fmt(r.rh, 1), '%') + ro('Dew point', L.fmt(st.dp, 1), '°C') +
      ro('Humidity ratio', L.fmt(wOf(es(st.dp), p), 2), 'g/kg') + ro('Site pressure', L.fmt(p, 1), 'kPa') +
      ro(st.sel + ' max DB here', L.fmt(sel.hi, 1), '°C') + ro('Rec. max DB here', L.fmt(sel.c.recHi ? Math.min(sel.c.recHi, recHi(st.z)) : recHi(st.z), 1), '°C') +
      '</dl>' +
      '<div class="ltc-canvas">' + chart(st.db, st.dp, st.z, st.sel) + '</div><p class="ltc-src" id="aHover">Move over the chart for a reading.</p>' +
      '<div class="ltc-table-wrap"><table class="ltc-table"><thead><tr><th>Class</th><th class="n">Max DB at site</th><th>Recommended</th><th>Allowable</th><th>Binding limit</th><th class="n">Margin</th></tr></thead><tbody>' +
      r.rows.map(function (x) {
        return '<tr' + (x.c.id === st.sel ? ' data-hit' : '') + ' data-cls="' + x.c.id + '" style="cursor:pointer"><td class="mono">' + x.c.id + '</td><td class="n">' + L.fmt(x.hi, 1) + ' °C</td>' +
          '<td>' + yn(x.rec) + '</td><td>' + yn(x.allow) + '</td><td>' + x.bind[0] + '</td><td class="n">' + L.fmt(x.bind[1], 1) + ' ' + x.bind[2] + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  /** Pointer readout over any psychrometric chart: invert the scales and the psychrometrics. */
  function hover(host, out) {
    host.addEventListener('pointermove', function (e) {
      var svg = e.target.closest ? e.target.closest('svg[data-psy]') : null;
      if (!svg) return;
      var r = svg.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width * CH.W, y = (e.clientY - r.top) / r.height * CH.H;
      var t = CH.x0 + (x - CH.l) / (CH.W - CH.l - CH.r) * (CH.x1 - CH.x0);
      var w = CH.y0 + (CH.H - CH.b - y) / (CH.H - CH.t - CH.b) * (CH.y1 - CH.y0);
      var o = document.getElementById(out);
      if (!o) return;
      if (t < 0 || t > 50 || w <= 0 || w > 30) { o.textContent = 'Move over the chart for a reading.'; return; }
      var p = pAlt(+svg.getAttribute('data-psy'));
      var pv = w * p / (622 + w), dp = dpFromPv(pv), rh = 100 * pv / es(t);
      o.textContent = rh > 100 ? 'Above saturation — fog region.' :
        'Cursor: ' + L.fmt(t, 1) + ' °C DB · ' + L.fmt(dp, 1) + ' °C DP · ' + L.fmt(rh, 0) + ' % RH · ' + L.fmt(w, 2) + ' g/kg';
    });
  }
  function ro(k, v, u, s) { return '<div class="ltc-ro"' + (s ? ' data-state="' + s + '"' : '') + '><dt>' + k + '</dt><dd>' + v + (u ? '<small>' + u + '</small>' : '') + '</dd></div>'; }
  function yn(b) { return b ? '<span style="color:var(--g)">yes</span>' : '<span style="color:var(--t3)">no</span>'; }

  function inspectClass(id) {
    var c = CLASSES.filter(function (k) { return k.id === id; })[0];
    if (!c) return;
    L.inspect({ sym: 'tempSensor', eyebrow: 'ASHRAE TC 9.9 · 5th ed.', title: 'Class ' + c.id, html:
      L.kv([['Dry-bulb', c.lo + ' – ' + c.hi + ' °C'], ['Low humidity', c.dpLo + ' °C DP and ' + c.rhLo + ' % RH'],
            ['High humidity', c.dpHi + ' °C DP and ' + c.rhHi + ' % RH'],
            ['Altitude derating', c.per ? '1 °C / ' + c.per + ' m above 900 m' : 'not modelled here'],
            ['Max elevation', '3,050 m']]) +
      '<p>' + L.esc(c.use) + '.</p><p class="ltc-note">Recommended envelope for A1–A4: 18–27 °C, −9 °C to 15 °C dew point, ≤ 70 % RH. Allowable limits are for excursions; time spent there trades reliability for energy.</p>' });
  }

  /* ---- liquid class tool --------------------------------------------------- */
  function runLiquid() {
    var sup = val('lSup'), amb = val('lAmb'), app = val('lApp');
    var cls = LIQUID.filter(function (k) { return sup <= k.max; })[0];
    var achievable = amb + app;              /* dry cooler leaving water at design ambient */
    var margin = sup - achievable;
    var out = document.getElementById('lOut');
    if (!isFinite(sup) || !isFinite(amb) || !isFinite(app)) { out.innerHTML = ''; return; }
    out.innerHTML =
      '<div class="ltc-verdict" data-state="' + (margin >= 0 ? 'ok' : 'warn') + '"><b>' + (margin >= 0 ? 'Dry cooling holds' : 'Needs trim cooling') + '</b><span>' +
      (margin >= 0 ? 'At the design ambient a dry cooler with this approach delivers ' + L.fmt(achievable, 1) + ' °C — ' + L.fmt(margin, 1) + ' K under the required supply.'
                   : 'A dry cooler alone delivers ' + L.fmt(achievable, 1) + ' °C; the supply needs ' + L.fmt(-margin, 1) + ' K more — adiabatic assist, a tower or a chiller covers those hours.') +
      '</span></div><dl class="ltc-readouts">' +
      ro('Facility-water class', cls.id, '') + ro('Required supply', L.fmt(sup, 1), '°C') + ro('Dry-cooler leaving', L.fmt(achievable, 1), '°C') +
      ro('Free-cooling margin', L.fmt(margin, 1), 'K', margin >= 0 ? 'ok' : 'warn') + '</dl>' +
      '<div class="ltc-table-wrap"><table class="ltc-table"><thead><tr><th>Class</th><th class="n">Max supply</th><th>Typical heat rejection</th></tr></thead><tbody>' +
      LIQUID.map(function (k) {
        return '<tr' + (k === cls ? ' data-hit' : '') + '><td class="mono">' + k.id + '</td><td class="n">' + (isFinite(k.max) ? k.max + ' °C' : '> 45 °C') + '</td><td>' + k.plant + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (liqFig) liqFig.redraw();
  }

  /* where the W-class is measured: an engine-drawn loop */
  var liqFig = null;
  function liquidLoop(D, o) {
    var sup = val('lSup'), app = val('lApp'), amb = val('lAmb');
    var d = D.create({ slug: 'wloop', title: 'Where the facility-water class is measured',
      desc: 'Heat rejection supplies facility water to the CDU; the class is set by the facility-water supply temperature at the CDU inlet, not by the technology cooling loop to the racks.' });
    var G = o.narrow ? 32 : 56, y = 16;
    var rej = d.node(16, y, { id: 'rej', name: 'Dry cooler', sublabel: 'ambient ' + L.fmt(amb, 0) + ' °C + ' + L.fmt(app, 0) + ' K', symbol: 'dryCooler', legend: 'Plant equipment' });
    var tt = d.node(rej.x + rej.w + G, y + 8, { id: 'tt', name: 'FWS supply', sublabel: L.fmt(sup, 1) + ' °C · class point', symbol: 'tempSensor', focal: true, fill: 'paper-2', tier: 1, legend: 'Class measured here' });
    var cdu = d.node(tt.x + tt.w + G, y, { id: 'cdu', name: 'CDU', sublabel: 'L2L exchanger', symbol: 'cdu', legend: 'Plant equipment' });
    var rack = d.node(cdu.x + cdu.w + G, y, { id: 'rack', name: 'Racks', sublabel: 'cold plates (TCS)', symbol: 'rack', legend: 'Plant equipment' });
    function mid(b) { return b.y + b.h / 2; }
    d.edge({ x: rej.x + rej.w, y: mid(tt) }, { x: tt.x, y: mid(tt) }, { fromId: 'rej', toId: 'tt', stroke: 'link', legend: 'Facility water (FWS)' });
    d.edge({ x: tt.x + tt.w, y: mid(tt) }, { x: cdu.x, y: mid(tt) }, { fromId: 'tt', toId: 'cdu', stroke: 'link' });
    d.edge({ x: cdu.x + cdu.w, y: mid(cdu) }, { x: rack.x, y: mid(cdu) }, { fromId: 'cdu', toId: 'rack', stroke: 'soft', pattern: 'dashed', legend: 'Technology loop (TCS)' });
    d.legend();
    return d;
  }

  /* ---- rate of change ---------------------------------------------------- */
  function runRate() {
    var tape = document.getElementById('rTape').getAttribute('aria-pressed') === 'true';
    var h = val('rHour'), q = val('rQ'), rh = val('rRh');
    var limH = tape ? 5 : 20;
    var okH = Math.abs(h) <= limH, okQ = tape || Math.abs(q) <= 5, okRh = Math.abs(rh) <= 5;
    var all = okH && okQ && okRh;
    document.getElementById('rOut').innerHTML =
      '<div class="ltc-verdict" data-state="' + (all ? 'ok' : 'fail') + '"><b>' + (all ? 'Within limits' : 'Exceeds a limit') + '</b><span>' +
      (tape ? 'Tape media present: 5 °C in any hour.' : 'No tape media: 20 °C in any hour and 5 °C in any 15 minutes.') + ' Humidity: 5 % RH in any hour.</span></div>' +
      '<dl class="ltc-readouts">' + ro('ΔT in 1 h', L.fmt(h, 1), '°C', okH ? 'ok' : 'fail') +
      (tape ? '' : ro('ΔT in 15 min', L.fmt(q, 1), '°C', okQ ? 'ok' : 'fail')) +
      ro('ΔRH in 1 h', L.fmt(rh, 1), '%', okRh ? 'ok' : 'fail') + '</dl>';
  }

  /* ---- condensation: liquid loop vs room dew point ----------------------- */
  /* Any wetted surface below the room dew point condenses. For liquid cooling the
   * coldest surface is the coolant supply — at the CDU, the manifolds and the cold
   * plates — so the supply must stay above the dew point of the air around it, with
   * a control margin for sensor error and transients. */
  function runCond() {
    var db = val('cDb'), rh = val('cRh'), sup = val('cSup'), m = val('cMargin');
    var out = document.getElementById('cOut');
    if (![db, rh, sup, m].every(isFinite) || rh <= 0 || rh > 100 || m < 0) { out.innerHTML = '<div class="ltc-verdict" data-state="fail"><b>Input</b><span>Every field needs a number; RH between 0 and 100 %, margin 0 or more.</span></div>'; return; }
    var dp = dpFromPv(es(db) * rh / 100);
    var margin = sup - dp, minSup = dp + m;
    var state = margin >= m ? 'ok' : margin > 0 ? 'warn' : 'fail';
    /* a temperature axis gauge: dew point, required minimum, actual supply */
    var lo = Math.floor(Math.min(dp, sup) - 4), hi = Math.ceil(Math.max(db, sup, minSup) + 2);
    var W = 600, H = 92, X = function (t) { return 24 + (t - lo) / (hi - lo) * (W - 48); };
    var g = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="cg-t cg-d" style="width:100%;max-width:' + W + 'px;min-width:340px">',
      '<title id="cg-t">Coolant supply against room dew point</title><desc id="cg-d">Temperature axis showing the room dew point, the minimum allowed supply with margin, and the actual coolant supply.</desc>',
      '<rect width="100%" height="100%" fill="var(--bg1)"/>',
      '<rect x="' + X(lo) + '" y="34" width="' + (X(dp) - X(lo)) + '" height="10" fill="var(--r)" fill-opacity="0.18"/>',
      '<rect x="' + X(dp) + '" y="34" width="' + (X(minSup) - X(dp)) + '" height="10" fill="var(--o)" fill-opacity="0.22"/>',
      '<rect x="' + X(minSup) + '" y="34" width="' + (X(hi) - X(minSup)) + '" height="10" fill="var(--g)" fill-opacity="0.16"/>',
      '<line x1="' + X(lo) + '" y1="44" x2="' + X(hi) + '" y2="44" stroke="var(--bd2)"/>'];
    for (var t = lo; t <= hi; t += 2) {
      g.push('<line x1="' + X(t) + '" y1="44" x2="' + X(t) + '" y2="49" stroke="var(--t3)"/><text x="' + X(t) + '" y="62" fill="var(--t3)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">' + t + '</text>');
    }
    g.push('<path d="M' + X(sup) + ' 30 l-6 -10 h12 z" fill="var(--c)"/><text x="' + X(sup) + '" y="14" fill="var(--c)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">supply ' + L.fmt(sup, 1) + '</text>');
    g.push('<line x1="' + X(dp) + '" y1="30" x2="' + X(dp) + '" y2="48" stroke="var(--r)" stroke-width="1.4"/><text x="' + X(dp) + '" y="80" fill="var(--r)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">DP ' + L.fmt(dp, 1) + '</text>');
    g.push('</svg>');
    out.innerHTML = '<div class="ltc-verdict" data-state="' + state + '"><b>' + (state === 'ok' ? 'No condensation' : state === 'warn' ? 'Inside margin' : 'Condensing') + '</b><span>' +
      (state === 'fail' ? 'Supply is ' + L.fmt(-margin, 1) + ' K below the room dew point: every wetted surface at supply temperature will sweat.'
                        : 'Supply sits ' + L.fmt(margin, 1) + ' K above the room dew point' + (state === 'warn' ? ', less than the ' + L.fmt(m, 1) + ' K control margin.' : '.')) +
      '</span></div><dl class="ltc-readouts">' + ro('Room dew point', L.fmt(dp, 1), '°C') + ro('Supply margin', L.fmt(margin, 1), 'K', state) +
      ro('Minimum supply', L.fmt(minSup, 1), '°C') + ro('Max room RH at this supply', L.fmt(Math.min(100, 100 * es(sup - m) / es(db)), 0), '%') + '</dl>' +
      '<div class="ltc-canvas">' + g.join('') + '</div>' +
      '<div class="ltc-table-wrap"><table class="ltc-table"><thead><tr><th class="n">Room RH at ' + L.fmt(db, 1) + ' °C</th><th class="n">Dew point</th><th class="n">Min. supply (+' + L.fmt(m, 1) + ' K)</th><th>This supply</th></tr></thead><tbody>' +
      [30, 40, 50, 60, 70, 80].map(function (r) {
        var d = dpFromPv(es(db) * r / 100), ok = sup >= d + m;
        return '<tr' + (Math.abs(r - rh) <= 5 && (r - rh) < 5 && Math.abs(r - rh) === Math.min.apply(null, [30, 40, 50, 60, 70, 80].map(function (k) { return Math.abs(k - rh); })) ? ' data-hit' : '') + '><td class="n">' + r + ' %</td><td class="n">' + L.fmt(d, 1) + ' °C</td><td class="n">' + L.fmt(d + m, 1) + ' °C</td><td>' +
          (ok ? '<span style="color:var(--g)">dry</span>' : '<b style="color:var(--r)">below margin</b>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="ltc-note">Use the dew point of the air around the coldest wetted part (CDU room, row manifolds), not the cold-aisle average. A room that cannot hold its dew point needs a raised supply set point or dew-point-tracking control on the CDU.</p>';
  }

  /* ---- sensor log -------------------------------------------------------- */
  function sampleLog() {
    /* Synthetic, clearly labelled: a 24 h day at 30-minute steps with an afternoon
     * excursion and one fast step — not any facility's data. */
    var rows = ['# minute, dry-bulb °C, RH %   (synthetic example — paste your own)'];
    for (var i = 0; i <= 48; i++) {
      var t = i * 30, h = t / 60;
      var db = 23 + 4.5 * Math.max(0, Math.sin((h - 9) / 10 * Math.PI)) + (i === 30 ? 3 : 0);
      var rh = 48 - 10 * Math.max(0, Math.sin((h - 9) / 10 * Math.PI)) + (h > 20 ? 12 : 0);
      rows.push(t + ', ' + db.toFixed(1) + ', ' + rh.toFixed(0));
    }
    return rows.join('\n');
  }
  function runLog() {
    var z = val('gAlt'); z = isFinite(z) ? Math.max(0, z) : 0;
    var sel = document.getElementById('gCls').value;
    var tape = document.getElementById('gTape').getAttribute('aria-pressed') === 'true';
    var rows = document.getElementById('gData').value.split(/\n/).map(function (l) { return l.trim(); })
      .filter(function (l) { return l && l.charAt(0) !== '#'; })
      .map(function (l) { var q = l.split(/[,;\t ]+/).map(Number); return { t: q[0], db: q[1], rh: q[2] }; })
      .filter(function (q) { return [q.t, q.db, q.rh].every(isFinite) && q.rh > 0 && q.rh <= 100; })
      .sort(function (a, b) { return a.t - b.t; });
    var out = document.getElementById('gOut');
    if (rows.length < 2) { out.innerHTML = '<div class="ltc-verdict" data-state="fail"><b>Data</b><span>Paste at least two rows: minute, dry-bulb °C, RH %.</span></div>'; return; }
    var cnt = { rec: 0, allow: 0, out: 0 }, dur = { rec: 0, allow: 0, out: 0 }, worst = null;
    rows.forEach(function (q, i) {
      q.dp = dpFromPv(es(q.db) * q.rh / 100);
      var r = check(q.db, q.dp, z), c = r.rows.filter(function (x) { return x.c.id === sel; })[0];
      q.state = c.rec ? 'rec' : c.allow ? 'allow' : 'out';
      q.bind = c.bind;
      var dt = i < rows.length - 1 ? rows[i + 1].t - q.t : (rows.length > 1 ? q.t - rows[i - 1].t : 0);
      cnt[q.state]++; dur[q.state] += dt;
      if (!worst || c.bind[1] < worst.bind[1]) worst = q;
    });
    /* rate of change: the largest swing inside any 60-minute and any 15-minute window */
    function maxSwing(win, key) {
      var m = 0;
      for (var i = 0; i < rows.length; i++) for (var j = i + 1; j < rows.length && rows[j].t - rows[i].t <= win; j++)
        m = Math.max(m, Math.abs(rows[j][key] - rows[i][key]));
      return m;
    }
    var h1 = maxSwing(60, 'db'), q15 = maxSwing(15, 'db'), rh1 = maxSwing(60, 'rh');
    var limH = tape ? 5 : 20, okH = h1 <= limH, okQ = tape || q15 <= 5, okRh = rh1 <= 5;
    var total = dur.rec + dur.allow + dur.out || 1;
    function pct(k) { return L.fmt(100 * dur[k] / total, 1); }
    out.innerHTML = '<div class="ltc-verdict" data-state="' + (dur.out ? 'fail' : dur.allow ? 'warn' : 'ok') + '"><b>' + (dur.out ? 'Excursion' : dur.allow ? 'Allowable time' : 'All recommended') + '</b><span>' +
      pct('rec') + ' % of logged time recommended, ' + pct('allow') + ' % in ' + sel + ' allowable, ' + pct('out') + ' % outside. Worst reading at minute ' + worst.t + ': ' + worst.bind[0] + ' margin ' + L.fmt(worst.bind[1], 1) + ' ' + worst.bind[2] + '.</span></div>' +
      '<dl class="ltc-readouts">' + ro('Readings', String(rows.length), '') + ro('Recommended', pct('rec'), '%', 'ok') + ro(sel + ' allowable', pct('allow'), '%', dur.allow ? 'warn' : null) +
      ro('Outside', pct('out'), '%', dur.out ? 'fail' : null) + ro('Max ΔT in 1 h', L.fmt(h1, 1), '°C', okH ? 'ok' : 'fail') +
      (tape ? '' : ro('Max ΔT in 15 min', L.fmt(q15, 1), '°C', okQ ? 'ok' : 'fail')) + ro('Max ΔRH in 1 h', L.fmt(rh1, 1), '%', okRh ? 'ok' : 'fail') + '</dl>' +
      '<div class="ltc-canvas">' + chart(null, 0, z, sel, rows) + '</div><p class="ltc-src" id="gHover">Move over the chart for a reading.</p>' +
      '<p class="ltc-note">Time in each region is weighted by the interval to the next reading. Rate of change uses the largest swing between any two readings inside the window, so a coarse log can miss a fast step — log at 5 minutes or faster to prove the 15-minute limit.</p>';
  }

  /* ---- wiring ----------------------------------------------------------- */
  function bind(ids, fn) { ids.forEach(function (id) { var e = document.getElementById(id); if (e) e.addEventListener('input', fn); }); }
  function boot() {
    L.init({ module: 'ashrae' });
    document.querySelectorAll('[data-hmode]').forEach(function (b) {
      b.addEventListener('click', function () {
        st.hmode = b.getAttribute('data-hmode');
        document.querySelectorAll('[data-hmode]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        document.getElementById('aDpRow').hidden = st.hmode !== 'dp';
        document.getElementById('aRhRow').hidden = st.hmode !== 'rh';
        runEnvelope();
      });
    });
    var sel = document.getElementById('aCls');
    sel.addEventListener('change', function () { st.sel = sel.value; runEnvelope(); inspectClass(st.sel); });
    document.getElementById('aOut').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-cls]');
      if (tr) { st.sel = tr.getAttribute('data-cls'); sel.value = st.sel; runEnvelope(); inspectClass(st.sel); }
    });
    bind(['aDb', 'aDp', 'aRh', 'aAlt'], runEnvelope);
    bind(['lSup', 'lAmb', 'lApp'], runLiquid);
    bind(['rHour', 'rQ', 'rRh'], runRate);
    var tape = document.getElementById('rTape');
    tape.addEventListener('click', function () {
      tape.setAttribute('aria-pressed', tape.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      document.getElementById('rQRow').hidden = tape.getAttribute('aria-pressed') === 'true';
      runRate();
    });
    runEnvelope();
    liqFig = L.draw(document.getElementById('lLoop'), liquidLoop, function (id) {
      if (id === 'tt') L.inspect({ sym: 'tempSensor', eyebrow: 'Liquid cooling classes', title: 'Facility-water supply', html:
        '<p>The W-class is set by the maximum facility-water supply temperature delivered to the CDU or cooling distribution, not by the technology loop the cold plates see. The TCS runs warmer than the FWS by the CDU approach.</p>' });
    });
    runLiquid();
    runRate();
    bind(['cDb', 'cRh', 'cSup', 'cMargin'], runCond); runCond();
    document.getElementById('gData').value = sampleLog();
    bind(['gData', 'gAlt'], runLog);
    document.getElementById('gCls').addEventListener('change', runLog);
    var gt = document.getElementById('gTape');
    gt.addEventListener('click', function () { gt.setAttribute('aria-pressed', gt.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); runLog(); });
    runLog();
    hover(document.getElementById('aOut'), 'aHover');
    hover(document.getElementById('gOut'), 'gHover');
    if (window.matchMedia('(min-width: 1280px)').matches) inspectClass(st.sel);
  }
  /* exposed for the gate: the arithmetic, not the DOM */
  window.LTCAshrae = { es: es, dpFromPv: dpFromPv, pAlt: pAlt, wOf: wOf, rhOf: rhOf, derated: derated, recHi: recHi, check: check, CLASSES: CLASSES, LIQUID: LIQUID, REC: REC };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
