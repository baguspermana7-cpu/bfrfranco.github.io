/* ============================================================================
 * ltc-nfpa.js — fire protection workbench (NFPA 2001 · NFPA 72 · NFPA 75)
 * ----------------------------------------------------------------------------
 * Agent quantity uses the NFPA 2001 total-flooding equations:
 *   halocarbon   W = (V / S) · C / (100 − C)                      [kg]
 *   inert gas    X = 2.303 · (Vs / S) · log10(100 / (100 − C))     [m³ agent per m³ room, at 21 °C]
 *   S = k1 + k2 · T   specific vapour volume at the minimum design temperature
 * The concentration reached at the MAXIMUM room temperature is checked against
 * the agent's NOAEL, which is what decides whether the space may be occupied.
 * Altitude is applied as the atmospheric pressure ratio; NFPA 2001 tabulates
 * the equivalent correction factors.
 *
 * Educational tool. A system is designed from the listed manufacturer's
 * manual and approved by the AHJ; neither is replaced by this page.
 * ==========================================================================*/
(function () {
  'use strict';
  var L = window.LTC;

  var AGENTS = {
    'HFC-227ea': { kind: 'halo', k1: 0.1269, k2: 0.000513, c: 7.0, noael: 9.0, loael: 10.5, td: '10 s', gwp: '3,220 (AR4)' },
    'FK-5-1-12': { kind: 'halo', k1: 0.0664, k2: 0.0002741, c: 4.5, noael: 10.0, loael: '> 10.0', td: '10 s', gwp: '< 1' },
    'IG-541': { kind: 'inert', k1: 0.65799, k2: 0.00239, c: 38.0, noael: 43, loael: 52, td: '60 s Class B · 120 s Class A/C', gwp: '0' },
    'IG-100': { kind: 'inert', k1: 0.7997, k2: 0.00293, c: 40.0, noael: 43, loael: 52, td: '60 s Class B · 120 s Class A/C', gwp: '0' }
  };
  function pRatio(z) { return Math.pow(1 - 2.25577e-5 * z, 5.25588); }

  /** Pure: quantity and the concentration it produces at the maximum temperature. */
  function agentCalc(o) {
    var a = AGENTS[o.agent];
    var S = a.k1 + a.k2 * o.tMin;
    var Smax = a.k1 + a.k2 * o.tMax;
    var acf = pRatio(o.z);
    var C = o.c;
    if (a.kind === 'halo') {
      var W = o.v / S * C / (100 - C) * acf;
      /* the same mass in the same room at Tmax: x = W·Smax/V, C = 100x/(1+x) */
      var x = W * Smax / o.v / acf;
      return { kind: 'halo', S: S, acf: acf, qty: W, unit: 'kg', cMax: 100 * x / (1 + x), a: a };
    }
    var Vs = a.k1 + a.k2 * 21;
    var X = 2.303 * (Vs / S) * Math.log10(100 / (100 - C));
    var vol = X * o.v * acf;
    /* the same agent quantity in a hotter room: solve the flooding equation for C at Smax */
    return { kind: 'inert', S: S, Vs: Vs, acf: acf, qty: vol, X: X, unit: 'm³ at 21 °C',
      cMax: 100 * (1 - Math.pow(10, -X * Smax / (2.303 * Vs))), a: a };
  }

  /* ---- detector spacing (NFPA 72, spot smoke, smooth ceiling) ------------ */
  /* High air movement reduces the area each detector may cover:
   * air changes per hour → ft² per detector (NFPA 72 high-airflow table). */
  var ACH = [[60, 125], [30, 250], [20, 375], [15, 500], [12, 625], [10, 750], [8.6, 875], [7.5, 900]];
  function areaPerDetector(ach) {
    if (ach >= 60) return 125;
    if (ach <= 7.5) return 900;
    /* between two rows, take the higher-airflow row: the smaller area is conservative */
    for (var i = 0; i < ACH.length - 1; i++) {
      if (ach <= ACH[i][0] && ach > ACH[i + 1][0]) return ACH[i][1];
    }
    return 900;
  }
  function detCalc(o) {
    var ft2 = areaPerDetector(o.ach);
    var m2 = ft2 * 0.09290304;
    var s = Math.sqrt(m2);            /* square-grid spacing that covers that area */
    var nx = Math.ceil(o.l / s), ny = Math.ceil(o.w / s);
    return { ft2: ft2, m2: m2, s: s, grid: nx * ny, nx: nx, ny: ny, zones: o.cross ? 2 : 1 };
  }

  function val(id) { return parseFloat(document.getElementById(id).value); }
  function ro(k, v, u, s) { return '<div class="ltc-ro"' + (s ? ' data-state="' + s + '"' : '') + '><dt>' + k + '</dt><dd>' + v + (u ? '<small>' + u + '</small>' : '') + '</dd></div>'; }

  function runAgent() {
    var ag = document.getElementById('fAgent').value;
    var o = { agent: ag, v: val('fL') * val('fW') * val('fH'), tMin: val('fTmin'), tMax: val('fTmax'), z: Math.max(0, val('fZ')), c: val('fC') };
    var out = document.getElementById('fOut');
    if (![o.v, o.tMin, o.tMax, o.z, o.c].every(isFinite) || o.c <= 0 || o.c >= 100 || o.tMax < o.tMin) {
      out.innerHTML = '<div class="ltc-verdict" data-state="fail"><b>Input</b><span>Check the room size, temperatures (max ≥ min) and a concentration between 0 and 100 %.</span></div>';
      return;
    }
    var r = agentCalc(o);
    var per = val(r.kind === 'halo' ? 'fPerKg' : 'fPerM3');
    document.getElementById('fPerKgRow').hidden = r.kind !== 'halo';
    document.getElementById('fPerM3Row').hidden = r.kind === 'halo';
    var occ = r.cMax <= r.a.noael;
    out.innerHTML =
      '<div class="ltc-verdict" data-state="' + (occ ? 'ok' : 'fail') + '"><b>' + (occ ? 'Within NOAEL' : 'Above NOAEL') + '</b><span>' +
      'At ' + L.fmt(o.tMax, 0) + ' °C the room reaches ' + L.fmt(r.cMax, 2) + ' % against a NOAEL of ' + r.a.noael + ' %' +
      (occ ? ' — acceptable for a normally occupied space.' : ' — not acceptable where people may be present; reduce concentration or temperature range.') + '</span></div>' +
      '<dl class="ltc-readouts">' +
      ro('Protected volume', L.fmt(o.v, 1), 'm³') +
      ro(r.kind === 'halo' ? 'Agent mass' : 'Agent volume', L.fmt(r.qty, r.kind === 'halo' ? 1 : 0), r.unit, 'ok') +
      ro('Specific volume S', L.fmt(r.S, 4), 'm³/kg') +
      ro('Altitude factor', L.fmt(r.acf, 3), '') +
      ro('Conc. at max temp', L.fmt(r.cMax, 2), '%', occ ? 'ok' : 'fail') +
      ro('Discharge time', r.a.td, '') +
      (per > 0 ? ro('Containers', String(Math.ceil(r.qty / per)), '× ' + L.fmt(per, r.kind === 'halo' ? 0 : 1) + (r.kind === 'halo' ? ' kg' : ' m³')) : '') + '</dl>' +
      '<p class="ltc-src">' + (r.kind === 'halo'
        ? 'W = (V/S)·C/(100−C) × ' + L.fmt(r.acf, 3) + ' = (' + L.fmt(o.v, 1) + '/' + L.fmt(r.S, 4) + ')·' + o.c + '/' + L.fmt(100 - o.c, 1) + ' × ' + L.fmt(r.acf, 3) + ' = ' + L.fmt(r.qty, 1) + ' kg'
        : 'X = 2.303·(Vs/S)·log10(100/(100−C)) = 2.303·(' + L.fmt(r.Vs, 4) + '/' + L.fmt(r.S, 4) + ')·log10(100/' + L.fmt(100 - o.c, 1) + ') = ' + L.fmt(r.X, 4) + ' m³/m³') + '</p>';
  }
  function setAgentDefaults() {
    var a = AGENTS[document.getElementById('fAgent').value];
    document.getElementById('fC').value = a.c;
  }

  function runDet() {
    var o = { l: val('dL'), w: val('dW'), ach: val('dAch'), cross: document.getElementById('dCross').getAttribute('aria-pressed') === 'true' };
    if (![o.l, o.w, o.ach].every(isFinite) || o.l <= 0 || o.w <= 0 || o.ach <= 0) {
      document.getElementById('dOut').innerHTML = '<div class="ltc-verdict" data-state="fail"><b>Input</b><span>Length, width and air changes must be numbers above 0.</span></div>'; return;
    }
    var r = detCalc(o);
    var area = o.l * o.w;
    document.getElementById('dOut').innerHTML = '<dl class="ltc-readouts">' +
      ro('Area per detector', L.fmt(r.m2, 1), 'm²') + ro('Grid spacing', L.fmt(r.s, 2), 'm') +
      ro('Detectors per zone', String(r.grid), '', 'ok') + ro('Zones', String(r.zones), '') +
      ro('Total points', String(r.grid * r.zones), '') + ro('Room area', L.fmt(area, 0), 'm²') + '</dl>' +
      '<p class="ltc-note">Spot smoke detectors on a smooth ceiling: ' + L.fmt(o.ach, 1) + ' air changes per hour allows ' + r.ft2 + ' ft² per detector, laid on a ' + r.nx + ' × ' + r.ny + ' grid. ' +
      'Each aspirating-system sampling hole is treated as a spot detector for spacing. ' +
      (o.cross ? 'Cross-zoned: two zones, each meeting spacing on its own (heads installed in pairs), so release needs two independent alarms.' : '') +
      ' Beams, joists, raised-floor and ceiling-void spaces need their own detection.</p>' +
      '<div class="ltc-canvas">' + plan(o, r) + '</div>';
  }

  /* Plan view: the room to scale, each zone's detectors on its own grid. Each zone
   * meets spacing on its own, so zone B sits at the same grid points as zone A,
   * paired beside it — how cross-zoned heads are usually installed. Zone is carried by SHAPE as well as hue. */
  function plan(o, r) {
    var W = 640, pad = 28, sc = Math.min((W - 2 * pad) / o.l, 360 / o.w);
    var H = Math.round(o.w * sc + 2 * pad + 28);
    var X = function (m) { return pad + m * sc; }, Y = function (m) { return pad + m * sc; };
    var g = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="dp-t dp-d" style="width:100%;max-width:' + W + 'px;min-width:340px">',
      '<title id="dp-t">Detector layout plan</title><desc id="dp-d">The room to scale with ' + r.grid + ' detectors per zone on a ' + L.fmt(r.s, 2) + ' m grid' + (o.cross ? ', two cross-zoned zones' : '') + '.</desc>',
      '<rect width="100%" height="100%" fill="var(--bg1)"/>',
      '<rect x="' + X(0) + '" y="' + Y(0) + '" width="' + (o.l * sc) + '" height="' + (o.w * sc) + '" fill="none" stroke="var(--t2)" stroke-width="1.4"/>'];
    function grid(off, shape) {
      var sx = o.l / r.nx, sy = o.w / r.ny;
      for (var i = 0; i < r.nx; i++) for (var j = 0; j < r.ny; j++) {
        /* zone B pairs with zone A at the same grid point, 9 px apart on the drawing */
        var cx = X(sx * (i + 0.5)) + off * 9, cy = Y(sy * (j + 0.5));
        g.push(shape === 'a' ? '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4" fill="var(--c)"/>'
                             : '<rect x="' + (cx - 4).toFixed(1) + '" y="' + (cy - 4).toFixed(1) + '" width="8" height="8" fill="none" stroke="var(--o)" stroke-width="1.4"/>');
      }
    }
    grid(0, 'a');
    if (o.cross) grid(1, 'b');
    /* scale bar: one detector pitch */
    var y0 = Y(o.w) + 20;
    g.push('<line x1="' + X(0) + '" y1="' + y0 + '" x2="' + X(r.s) + '" y2="' + y0 + '" stroke="var(--t2)" stroke-width="1.4"/>',
      '<text x="' + (X(r.s) + 8) + '" y="' + (y0 + 4) + '" fill="var(--t3)" font-size="11" font-family="JetBrains Mono, monospace">' + L.fmt(r.s, 2) + ' m pitch · ' + L.fmt(o.l, 0) + ' × ' + L.fmt(o.w, 0) + ' m</text>',
      '<circle cx="' + (W - 196) + '" cy="' + (y0) + '" r="4" fill="var(--c)"/><text x="' + (W - 186) + '" y="' + (y0 + 4) + '" fill="var(--t2)" font-size="11" font-family="IBM Plex Sans, sans-serif">Zone A</text>');
    if (o.cross) g.push('<rect x="' + (W - 120) + '" y="' + (y0 - 4) + '" width="8" height="8" fill="none" stroke="var(--o)" stroke-width="1.4"/><text x="' + (W - 106) + '" y="' + (y0 + 4) + '" fill="var(--t2)" font-size="11" font-family="IBM Plex Sans, sans-serif">Zone B</text>');
    g.push('</svg>');
    return g.join('');
  }

  /* ---- release sequence (state machine) ---------------------------------- */
  var SEQ = {
    normal: { name: 'Normal', sub: 'supervising', act: [] },
    alert: { name: 'Alert', sub: 'aspirating pre-alarm', act: ['Notify operations; investigate the zone'] },
    fire1: { name: 'Fire 1', sub: 'one zone in alarm', act: ['Building alarm and notification', 'Shut room HVAC dampers / units if programmed', 'Notify the fire brigade (monitoring)'] },
    fire2: { name: 'Pre-discharge', sub: 'second zone confirms', act: ['Start the programmed pre-discharge delay (site setting)', 'Discharge warning signals in the room', 'Close dampers, stop air handling serving the room', 'Trip IT room power via disconnecting means if programmed'] },
    hold: { name: 'Abort held', sub: 'abort switch pressed', act: ['Countdown suspended while the switch is held', 'Releasing the switch resumes the sequence'] },
    disch: { name: 'Discharge', sub: 'agent released', act: ['Agent discharged within the listed discharge time', 'Maintain the room sealed for the hold time (≥ 10 min typical)', 'Re-enter only after ventilation and O₂ / agent check'] }
  };
  var TRANS = {
    normal: { asd: 'alert', zoneA: 'fire1', manual: 'disch' },
    alert: { zoneA: 'fire1', reset: 'normal', manual: 'disch' },
    fire1: { zoneB: 'fire2', reset: 'normal', manual: 'disch' },
    fire2: { abort: 'hold', timeout: 'disch', manual: 'disch' },
    hold: { release: 'fire2', reset: 'normal' },
    disch: { reset: 'normal' }
  };
  var EVENTS = [['asd', 'Aspirating alert'], ['zoneA', 'Zone A detector'], ['zoneB', 'Zone B detector'], ['abort', 'Hold abort'],
                ['release', 'Release abort'], ['timeout', 'Delay elapses'], ['manual', 'Manual release'], ['reset', 'Reset panel']];
  var SYM = { normal: 'bms', alert: 'aspirating', fire1: 'smokeDetector', fire2: 'epo', disch: 'agentCylinder' };
  var cur = 'normal', log = [];
  function seqBuild(D, o) {
    var d = D.create({ slug: 'relseq', title: 'Clean-agent release sequence (cross-zoned)',
      desc: 'Normal to alert, first-zone alarm, second-zone confirmation with a pre-discharge delay that an abort switch can hold, then discharge.' });
    var order = ['normal', 'alert', 'fire1', 'fire2', 'disch'];
    var box = {}, G = o.narrow ? 28 : 40, x = 16, y = 16;
    order.forEach(function (k) {
      var s = SEQ[k];
      box[k] = d.node(x, y, { id: k, name: s.name, sublabel: s.sub, interactive: true, focal: k === cur, fill: k === cur ? 'paper-2' : 'paper', tier: k === cur ? 1 : 2,
        legend: k === cur ? 'Current state' : 'State', symbol: SYM[k] });
      if (o.narrow) y = box[k].y + box[k].h + G; else x = box[k].x + box[k].w + G;
    });
    box.hold = d.node(o.narrow ? box.fire2.x + box.fire2.w + 48 : box.fire2.x, o.narrow ? box.fire2.y : box.fire2.y + box.fire2.h + 56,
      { id: 'hold', name: SEQ.hold.name, sublabel: SEQ.hold.sub, interactive: true, dashed: true, focal: cur === 'hold', fill: cur === 'hold' ? 'paper-2' : 'paper',
        tier: cur === 'hold' ? 1 : 2, legend: cur === 'hold' ? 'Current state' : 'Held state', symbol: 'manualStation' });
    for (var i = 1; i < order.length; i++) {
      var A = box[order[i - 1]], B = box[order[i]];
      d.edge(o.narrow ? { x: A.x + A.w / 2, y: A.y + A.h } : { x: A.x + A.w, y: A.y + A.h / 2 },
             o.narrow ? { x: B.x + B.w / 2, y: B.y } : { x: B.x, y: B.y + B.h / 2 }, { fromId: order[i - 1], toId: order[i] });
    }
    var F = box.fire2, H = box.hold;
    if (o.narrow) {
      d.edge({ x: F.x + F.w, y: F.y + F.h / 3 }, { x: H.x, y: F.y + F.h / 3 }, { fromId: 'fire2', toId: 'hold', pattern: 'dashed' });
      d.edge({ x: H.x, y: F.y + 2 * F.h / 3 }, { x: F.x + F.w, y: F.y + 2 * F.h / 3 }, { fromId: 'hold', toId: 'fire2', pattern: 'dashed' });
    } else {
      d.edge({ x: F.x + F.w / 3, y: F.y + F.h }, { x: H.x + H.w / 3, y: H.y }, { fromId: 'fire2', toId: 'hold', pattern: 'dashed' });
      d.edge({ x: H.x + 2 * H.w / 3, y: H.y }, { x: F.x + 2 * F.w / 3, y: F.y + F.h }, { fromId: 'hold', toId: 'fire2', pattern: 'dashed' });
    }
    d.legend();
    return d;
  }
  function fire(ev) {
    var nx = (TRANS[cur] || {})[ev];
    var label = EVENTS.filter(function (e) { return e[0] === ev; })[0][1];
    if (!nx) { log.unshift('<li><code>' + label + '</code><p>Ignored in state ' + SEQ[cur].name + '.</p></li>'); }
    else {
      cur = nx;
      log.unshift('<li><code>' + label + ' → ' + SEQ[cur].name + '</code><p>' + (SEQ[cur].act.join('. ') || 'Supervising.') + '</p></li>');
    }
    log = log.slice(0, 8);
    renderSeq();
  }
  function renderSeq() {
    seqFig.redraw();
    var allowed = TRANS[cur] || {};
    document.getElementById('sEvents').innerHTML = EVENTS.map(function (e) {
      return '<button class="ltc-btn" type="button" data-ev="' + e[0] + '"' + (allowed[e[0]] ? '' : ' disabled style="opacity:.45"') + '>' + e[1] + '</button>';
    }).join('');
    document.getElementById('sNow').innerHTML = '<div class="ltc-verdict" data-state="' + (cur === 'normal' ? 'ok' : cur === 'disch' || cur === 'fire2' ? 'fail' : 'warn') + '"><b>' + SEQ[cur].name + '</b><span>' +
      (SEQ[cur].act.join(' · ') || 'Supervising; no actions.') + '</span></div>';
    document.getElementById('sLog').innerHTML = log.join('') || '<li class="ltc-empty">Inject an event to start.</li>';
  }

  var seqFig = null;
  function boot() {
    L.init({ module: 'nfpa' });
    var ag = document.getElementById('fAgent');
    ag.addEventListener('change', function () { setAgentDefaults(); runAgent(); inspectAgent(ag.value); });
    document.getElementById('p-agent').addEventListener('input', runAgent);
    document.getElementById('p-detection').addEventListener('input', runDet);
    var cr = document.getElementById('dCross');
    cr.addEventListener('click', function () { cr.setAttribute('aria-pressed', cr.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); runDet(); });
    document.getElementById('sEvents').addEventListener('click', function (e) { var b = e.target.closest('[data-ev]'); if (b && !b.disabled) fire(b.getAttribute('data-ev')); });
    seqFig = L.draw(document.getElementById('sFig'), seqBuild, function (id) {
      L.inspect({ eyebrow: 'Release sequence', title: SEQ[id].name, html: '<ul class="ltc-refs">' + (SEQ[id].act.length ? SEQ[id].act.map(function (a) { return '<li><p>' + L.esc(a) + '</p></li>'; }).join('') : '<li><p>Supervising.</p></li>') + '</ul>' });
    });
    setAgentDefaults(); runAgent(); runDet(); renderSeq();
    /* the hall the plant sized: DH01 geometry and its CRAH airflow */
    var S = window.LTCPlantStrip;
    if (S) {
      S.bind('fL', function (r) { return r.hall.lengthM; }, 'DH01 length from racks per row × pitch + end zones');
      S.bind('fW', function (r) { return r.hall.widthM; }, 'DH01 width from row pairs, hot and cold aisles');
      S.bind('fH', function (r) { return r.hall.heightM; }, 'DH01 clear height (advanced input)');
      S.bind('dL', function (r) { return r.hall.lengthM; }, 'DH01 length');
      S.bind('dW', function (r) { return r.hall.widthM; }, 'DH01 width');
      S.bind('dAch', function (r) { return r.hall.airChangesPerHour; }, 'CRAH airflow × 3,600 / hall volume', 0);
    }
    if (window.matchMedia('(min-width: 1280px)').matches) inspectAgent(ag.value);
  }
  function inspectAgent(name) {
    var a = AGENTS[name];
    L.inspect({ sym: 'agentCylinder', eyebrow: 'NFPA 2001 agent', title: name, html:
      L.kv([['Type', a.kind === 'halo' ? 'Halocarbon' : 'Inert gas'], ['k1 / k2', a.k1 + ' / ' + a.k2], ['NOAEL', a.noael + ' %'], ['LOAEL', a.loael + ' %'],
            ['Discharge time', a.td], ['GWP (100-yr)', a.gwp]]) +
      '<p class="ltc-note">The default design concentration is an editable starting point. The real value is the listed system’s minimum extinguishing concentration × the safety factor for the hazard class (1.2 for Class A and C, 1.3 for Class B), from the manufacturer’s manual.</p>' });
  }
  window.LTCNfpa = { agentCalc: agentCalc, detCalc: detCalc, areaPerDetector: areaPerDetector, AGENTS: AGENTS, TRANS: TRANS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
