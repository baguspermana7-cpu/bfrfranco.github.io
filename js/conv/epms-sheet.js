/*
 * epms-sheet.js — E-S-101, the HV / MV single-line of EPMS_Telemetry.html (PRD-CONV-LIVING-PLANT §8.1, phase P5a),
 * drawn by js/rz-hmi-sheet.js with IEC 60617 symbols from js/rz-eng-symbols.js. Geometry only: every count, rating,
 * flow and state is written by the page's read() from js/conv-engine.js and js/conv/epms-sim.js.
 *
 *   150 kV  PLN LINE 1 / LINE 2 bays (source, SA, VT, line DS + ES, CB, CT, DS to BB1 / BB2), double busbar,
 *           bus coupler (DS-CB-DS), two transformer bays (DS x 2, CB, CT)
 *           TX-1 / TX-2 150/20 kV, neutral earthed through the NGR
 *   20 kV   incomer CB + CT per transformer, bus sections A and B with a normally open bus tie, four hall ring
 *           feeders per section (CB + CT), one TYPICAL 20/0.4 kV unit per section down to its LV main and LVSB,
 *           a generator bus with one genset block feeding both sections through the generator incomers.
 *
 * Electrical metadata on a node (ignored by the renderer, read by RZEpmsSim):
 *   sw: 'cb' | 'ds' | 'es'   a switching device; normal: 'open' when its normal position is open (default closed)
 *   cb: id                   the breaker a disconnector belongs to (it may move only with that breaker open)
 *   ds: [ids], es: [ids]     disconnectors an earth switch needs open / earth switches a breaker needs open
 *   role: 'incomer' | 'tie' | 'gen'   the 20 kV 2-out-of-3 and generator rules
 *   kv: 'hv' | 'mv' | 'lv'   voltage level, for amperes from kW
 *   relay: id (on a breaker) / prot: id (on a relay: which engine settings it carries, or null)
 *   src: 'grid' | 'gen', load: key, tx: 'hv' | 'dist'
 */
(function (root) {
  'use strict';
  if (!root) return;

  var nodes = [], edges = [], SW = 28;
  function N(o) { nodes.push(o); return o; }
  function E(id, from, to, via, o) {
    var e = { id: id, from: from, to: to, medium: 'power', flowOf: 'p' };
    if (via) e.via = via;
    if (o) Object.keys(o).forEach(function (k) { e[k] = o[k]; });
    edges.push(e); return e;
  }
  function sig(id, from, to) { edges.push({ id: id, from: from, to: to, medium: 'line', w: 'inst' }); }
  function cbVals(side, x0, y0) {   /* tag + state + power chip beside a breaker */
    var dx = side === 'left' ? -18 : 18, a = side === 'left' ? 'end' : 'start';
    return [{ k: 'st', dx: dx, dy: 15, anchor: a, lod: 1 }, { k: 'pw', dx: dx, dy: 27, anchor: a, lod: 1 }];
  }

  /* PRD-ELECTRICAL-BMS E1 (v3.94): the sheet opens at its reading scale inside the stage at 1440 px, so the drawing is
     ~1 300 units wide (was 1 690: eight feeders at a 100 pitch). Every x below hangs off these columns. */
  var BB1 = 470, BB2 = 500, MV = 950, bb1Taps = [], bb2Taps = [];
  var LX = [160, 350], C1X = 425, C2X = 485, TXX = [640, 880], TIEX = 760, HVE = 990, RBBX = 1030;
  var FP = 75, FA = [90, 90 + FP, 90 + 2 * FP, 90 + 3 * FP], GAX = 500, GBX = 990, FB = [GBX + 70, GBX + 70 + FP, GBX + 70 + 2 * FP, GBX + 70 + 3 * FP];
  var MVE = FB[3] + 45, ZW = MVE + 40 - 16;

  /* ── 150 kV line bays ───────────────────────────────────────────────────────────────────────── */
  [[1, LX[0]], [2, LX[1]]].forEach(function (b) {
    var k = b[0], x = b[1], p = 'l' + k + '-', T = '-L' + k;
    N({ id: p + 'src', tag: 'PLN LINE ' + k, sym: 'utilitySource', x: x, y: 84, size: 32, cls: 'epms', src: 'grid', kv: 'hv',
      label: 'PLN 150 kV incoming line ' + k + ' (cable sealing end)', tagAt: 'above',
      values: [{ k: 'r', dx: 22, dy: 2, anchor: 'start', lod: 1 }] });
    N({ id: p + 'j1', sym: 'junction', x: x, y: 125 });
    N({ id: p + 'sa', tag: 'SA' + T, sym: 'surgeArrester', x: x + 48, y: 152, size: SW, cls: 'epms', label: 'Line surge arrester' });
    N({ id: p + 'vt', tag: 'VT' + T, sym: 'voltageTransformer', x: x - 48, y: 152, size: SW, cls: 'epms', label: 'Line voltage transformer' });
    N({ id: p + 'dsl', tag: 'DSL' + T, sym: 'disconnector', x: x, y: 205, size: SW, cls: 'epms', sw: 'ds', cb: p + 'cb', kv: 'hv',
      label: 'Line disconnector', tagAt: 'left' });
    N({ id: p + 'j2', sym: 'junction', x: x, y: 240 });
    N({ id: p + 'es', tag: 'ES' + T, sym: 'earthSwitch', x: x + 48, y: 262, size: SW, cls: 'epms', sw: 'es', normal: 'open',
      ds: [p + 'dsl', p + 'ds1', p + 'ds2'], label: 'Line earthing switch' });
    N({ id: p + 'cb', tag: 'CB' + T, sym: 'cbIec', x: x, y: 290, size: SW, cls: 'epms', sw: 'cb', kv: 'hv', relay: p + 'r', es: [p + 'es'],
      label: 'Line circuit breaker (SF6)', tagAt: 'left', values: cbVals('left') });
    N({ id: p + 'ct', tag: 'CT' + T, sym: 'currentTransformer', x: x, y: 335, size: SW, cls: 'epms', label: 'Line current transformer', tagAt: 'left' });
    N({ id: p + 'r', tag: 'R' + T, name: '87L · 21', sym: 'protectionRelay', x: x + 52, y: 335, size: 26, cls: 'epms', prot: null, cb: p + 'cb',
      label: 'Line protection relay: line differential 87L, distance 21', tagAt: 'right' });
    N({ id: p + 'j3', sym: 'junction', x: x, y: 375 });
    N({ id: p + 'ds1', tag: 'DS1' + T, sym: 'disconnector', x: x - 22, y: 415, size: SW, cls: 'epms', sw: 'ds', cb: p + 'cb', kv: 'hv',
      normal: k === 1 ? 'closed' : 'open', label: 'Busbar disconnector to BB1', tagAt: 'left' });
    N({ id: p + 'ds2', tag: 'DS2' + T, sym: 'disconnector', x: x + 22, y: 415, size: SW, cls: 'epms', sw: 'ds', cb: p + 'cb', kv: 'hv',
      normal: k === 2 ? 'closed' : 'open', label: 'Busbar disconnector to BB2', tagAt: 'right' });
    E(p + 'in', p + 'src.out', p + 'j1');
    E(p + 'sa', p + 'j1', p + 'sa.line', [[x + 48, 125]]);
    E(p + 'vt', p + 'j1', p + 'vt.line', [[x - 48, 125]]);
    E(p + 'c1', p + 'j1', p + 'dsl.line');
    E(p + 'c2', p + 'dsl.load', p + 'j2');
    E(p + 'es', p + 'j2', p + 'es.line', [[x + 48, 240]]);
    E(p + 'c3', p + 'j2', p + 'cb.line');
    E(p + 'c4', p + 'cb.load', p + 'ct.line');
    E(p + 'c5', p + 'ct.load', p + 'j3');
    E(p + 'c6', p + 'j3', p + 'ds1.line', [[x - 22, 375]]);
    E(p + 'c7', p + 'j3', p + 'ds2.line', [[x + 22, 375]]);
    E(p + 'b1', p + 'ds1.load', 'bb1-' + p + 'x');
    E(p + 'b2', p + 'ds2.load', 'bb2-' + p + 'x');
    sig(p + 'sig', p + 'ct.secondary', p + 'r.input');
    bb1Taps.push(['bb1-' + p + 'x', x - 22]); bb2Taps.push(['bb2-' + p + 'x', x + 22]);
  });

  /* ── bus coupler ─────────────────────────────────────────────────────────────────────────────── */
  var C1 = C1X, C2 = C2X;
  N({ id: 'cp-ds1', tag: 'DS1-CP', sym: 'disconnector', x: C1, y: 545, size: SW, cls: 'epms', sw: 'ds', cb: 'cp-cb', kv: 'hv', label: 'Coupler disconnector BB1', tagAt: 'left' });
  N({ id: 'cp-ds2', tag: 'DS2-CP', sym: 'disconnector', x: C2, y: 545, size: SW, cls: 'epms', sw: 'ds', cb: 'cp-cb', kv: 'hv', label: 'Coupler disconnector BB2', tagAt: 'right' });
  N({ id: 'cp-cb', tag: 'CB-CP', sym: 'cbIec', x: C1, y: 600, size: SW, cls: 'epms', sw: 'cb', kv: 'hv', relay: 'cp-r', label: 'Bus coupler circuit breaker', tagAt: 'right',
    values: [{ k: 'st', dx: 30, dy: 70, anchor: 'middle', lod: 1 }, { k: 'pw', dx: 30, dy: 82, anchor: 'middle', lod: 1 }] });
  N({ id: 'cp-r', tag: 'R-CP', name: '50BF', sym: 'protectionRelay', x: C1 - 52, y: 600, size: 26, rot: 180, cls: 'epms', prot: null, cb: 'cp-cb',
    label: 'Bus coupler breaker-failure relay 50BF', tagAt: 'below' });
  E('cp-a', 'bb1-cp', 'cp-ds1.line');
  E('cp-b', 'bb2-cp', 'cp-ds2.line');
  E('cp-c', 'cp-ds1.load', 'cp-cb.line');
  E('cp-d', 'cp-cb.load', 'cp-ds2.load', [[C1, 640], [C2, 640]]);
  sig('cp-sig', 'cp-r.input', [C1 - 8, 600]);
  bb1Taps.push(['bb1-cp', C1]); bb2Taps.push(['bb2-cp', C2]);
  N({ id: 'bb-r', tag: 'R-BB', name: '87B', sym: 'protectionRelay', x: RBBX, y: 485, size: 26, cls: 'epms', prot: null,
    label: 'Busbar differential relay 87B (both busbars, all bay CTs)', tagAt: 'right',
    values: [{ k: 'bb1', dx: 64 - RBBX, dy: -19, anchor: 'start', lod: 1 }, { k: 'bb2', dx: 64 - RBBX, dy: 11, anchor: 'start', lod: 1 }] });
  /* 87B measures both busbars through every bay CT; drawn as its taps onto BB1 and BB2 */
  edges.push({ id: 'bb-sig1', from: 'bb-r.input', to: [HVE - 20, BB1], via: [[HVE - 20, 485]], medium: 'line', w: 'inst' },
    { id: 'bb-sig2', from: [HVE - 20, 485], to: [HVE - 20, BB2], medium: 'line', w: 'inst' });

  /* ── transformer bays, 150/20 kV transformers, NGR, 20 kV incomers ──────────────────────────── */
  [[1, TXX[0], 'A'], [2, TXX[1], 'B']].forEach(function (b) {
    var k = b[0], x = b[1], s = b[2], p = 't' + k + '-', i = 'i' + k + '-', T = '-T' + k;
    N({ id: p + 'ds1', tag: 'DS1' + T, sym: 'disconnector', x: x - 22, y: 545, size: SW, cls: 'epms', sw: 'ds', cb: p + 'cb', kv: 'hv',
      normal: k === 1 ? 'closed' : 'open', label: 'Transformer bay busbar disconnector to BB1', tagAt: 'left' });
    N({ id: p + 'ds2', tag: 'DS2' + T, sym: 'disconnector', x: x + 22, y: 545, size: SW, cls: 'epms', sw: 'ds', cb: p + 'cb', kv: 'hv',
      normal: k === 2 ? 'closed' : 'open', label: 'Transformer bay busbar disconnector to BB2', tagAt: 'right' });
    N({ id: p + 'j', sym: 'junction', x: x, y: 585 });
    N({ id: p + 'cb', tag: 'CB' + T, sym: 'cbIec', x: x, y: 620, size: SW, cls: 'epms', sw: 'cb', kv: 'hv', relay: p + 'r',
      label: 'Transformer bay circuit breaker (SF6)', tagAt: 'left', values: cbVals('left') });
    N({ id: p + 'ct', tag: 'CT' + T, sym: 'currentTransformer', x: x, y: 665, size: SW, cls: 'epms', label: 'Transformer bay current transformer', tagAt: 'left' });
    N({ id: p + 'r', tag: 'R' + T, name: '87T · 50/51', sym: 'protectionRelay', x: x + 52, y: 665, size: 26, cls: 'epms', prot: 'hv', cb: p + 'cb',
      label: 'Transformer protection: differential 87T, HV overcurrent 50/51', tagAt: 'right' });
    N({ id: 'tx' + k, tag: 'TX-' + k, sym: 'transformer2w', x: x, y: 735, size: 44, cls: 'epms', tx: 'hv', kv: 'hv',
      label: 'Power transformer ' + k + ', HV / MV', tagAt: 'left',
      values: [{ k: 'r', dx: -26, dy: 15, anchor: 'end', lod: 1 }, { k: 'pw', dx: -26, dy: 27, anchor: 'end', lod: 1 }, { k: 'ld', dx: -26, dy: 39, anchor: 'end', lod: 1 }] });
    N({ id: p + 'ngr', tag: 'NGR-' + k, sym: 'resistor', x: x + 50, y: 785, size: SW, cls: 'epms', label: 'Neutral earthing resistor, 20 kV star point', tagAt: 'left',
      values: [{ k: 'r', dx: 26, dy: 27, anchor: 'start', lod: 1 }] });
    N({ id: p + 'pe', sym: 'earth', x: x + 50, y: 818, size: 24 });
    N({ id: p + 'rg', tag: 'R-NG' + k, name: '51G', sym: 'protectionRelay', x: x + 95, y: 785, size: 26, cls: 'epms', prot: null, cb: i + 'cb',
      label: 'Standby earth-fault relay 51G on the NGR', tagAt: 'right' });
    N({ id: i + 'cb', tag: 'CB-IN' + k, sym: 'cbIec', x: x, y: 860, size: SW, cls: 'epms', sw: 'cb', kv: 'mv', role: 'incomer', relay: i + 'r',
      label: '20 kV incomer circuit breaker, section ' + s, tagAt: 'left',
      values: cbVals('left').concat([k === 1 ? { k: 'bus', dx: 64 - x, dy: 82, anchor: 'start', lod: 1 } : { k: 'bus', dx: MVE - 4 - x, dy: 82, anchor: 'end', lod: 1 }]) });
    N({ id: i + 'ct', tag: 'CT-IN' + k, sym: 'currentTransformer', x: x, y: 905, size: SW, cls: 'epms', label: '20 kV incomer current transformer', tagAt: 'left' });
    N({ id: i + 'r', tag: 'R-IN' + k, name: '50/51', sym: 'protectionRelay', x: x + 52, y: 905, size: 26, cls: 'epms', prot: 'incomer', cb: i + 'cb',
      label: '20 kV incomer overcurrent relay 50/51', tagAt: 'right' });
    E(p + 'a', 'bb1-' + p + 'x', p + 'ds1.line');
    E(p + 'b', 'bb2-' + p + 'x', p + 'ds2.line');
    E(p + 'c', p + 'ds1.load', p + 'j', [[x - 22, 585]]);
    E(p + 'd', p + 'ds2.load', p + 'j', [[x + 22, 585]]);
    E(p + 'e', p + 'j', p + 'cb.line');
    E(p + 'f', p + 'cb.load', p + 'ct.line');
    E(p + 'g', p + 'ct.load', 'tx' + k + '.hv');
    E(p + 'h', 'tx' + k + '.lv', i + 'cb.line');
    E(i + 'a', i + 'cb.load', i + 'ct.line');
    E(i + 'b', i + 'ct.load', 'm' + s.toLowerCase() + '-in');
    E(p + 'n1', [x + 10, 741], p + 'ngr.line', [[x + 50, 741]], { flowOf: 'n' });
    E(p + 'n2', p + 'ngr.load', p + 'pe.port', null, { flowOf: 'n' });
    sig(p + 'sig', p + 'ct.secondary', p + 'r.input');
    sig(i + 'sig', i + 'ct.secondary', i + 'r.input');
    sig(p + 'gsig', p + 'rg.input', [x + 57, 785]);
    bb1Taps.push(['bb1-' + p + 'x', x - 22]); bb2Taps.push(['bb2-' + p + 'x', x + 22]);
  });

  /* ── busbars (one edge per segment, so each segment carries its own state) ──────────────────── */
  function busbar(prefix, y, taps, x0, x1, w) {
    var pts = [[prefix + '-s', x0]].concat(taps.slice().sort(function (a, b) { return a[1] - b[1]; })).concat([[prefix + '-e', x1]]);
    pts.forEach(function (t) { N({ id: t[0], sym: 'junction', x: t[1], y: y }); });
    for (var j = 1; j < pts.length; j++) E(prefix + '-' + j, pts[j - 1][0], pts[j][0], null, { w: w || 'bus' });
  }
  busbar('bb1', BB1, bb1Taps, 60, HVE);
  busbar('bb2', BB2, bb2Taps, 60, HVE);

  /* ── 20 kV feeders, typical distribution unit, generator incomers ───────────────────────────── */
  var HALLS = ['A', 'B', 'C', 'D'], mvA = [['ma-in', TXX[0]]], mvB = [['mb-in', TXX[1]]];
  function feeder(s, h, x, typ) {
    var ls = s.toLowerCase(), p = 'f' + ls + (h + 1) + '-', H = HALLS[h], T = '-F' + s + (h + 1);
    N({ id: p + 'cb', tag: 'CB' + T, sym: 'cbIec', x: x, y: 995, size: SW, cls: 'epms', sw: 'cb', kv: 'mv', relay: p + 'r',
      label: '20 kV feeder to the hall ' + H + ' ring, stream ' + s, tagAt: 'right',
      values: [{ k: 'st', dx: 18, dy: 15, anchor: 'start', lod: 1 }, { k: 'kw', dx: 18, dy: 27, anchor: 'start', lod: 1 }, { k: 'amp', dx: 18, dy: 39, anchor: 'start', lod: 1 }] });
    N({ id: p + 'ct', tag: 'CT' + T, sym: 'currentTransformer', x: x, y: 1060, size: SW, cls: 'epms', label: '20 kV feeder current transformer', tagAt: 'none' });
    N({ id: p + 'r', tag: 'R' + T, name: '50/51 50N/51N', sym: 'protectionRelay', x: x + 44, y: 1060, size: 24, cls: 'epms', prot: 'feeder', cb: p + 'cb',
      label: '20 kV feeder overcurrent and earth-fault relay 50/51, 50N/51N', tagAt: 'below' });
    var tap = 'm' + ls + '-f' + (h + 1);
    (s === 'A' ? mvA : mvB).push([tap, x]);
    E(p + 'a', tap, p + 'cb.line');
    E(p + 'b', p + 'cb.load', p + 'ct.line');
    sig(p + 'sig', p + 'ct.secondary', p + 'r.input');
    var ring = { id: p + 'ld', tag: 'HALL ' + H, name: 'RING ' + s, sym: 'offSheet', rot: 90, size: 20, cls: 'epms', load: (typ ? 'ring' : 'feeder'), hall: h, kv: 'mv',
      label: 'Hall ' + H + ' 20 kV ring, stream ' + s + ' (continues on the hall single-line)', tagAt: 'below',
      values: [{ k: 'kw', dx: 0, dy: 44, anchor: 'middle', lod: 1 }] };
    if (!typ) {
      ring.x = x; ring.y = 1140; N(ring);
      E(p + 'c', p + 'ct.load', p + 'ld.port');
      return;
    }
    /* the typical 20/0.4 kV unit hangs from this feeder; the rest of the ring continues off-sheet beside it */
    /* the ring off-sheet steps toward the free span by the generator incomer (inward, it sat on the next feeder's
       ring at the v3.94 feeder pitch) */
    var side = s === 'A' ? -1 : 1, rs = -side, d = 'd' + ls + '-';
    ring.values = [{ k: 'kw', dx: rs * 14, dy: 44, anchor: rs > 0 ? 'start' : 'end', lod: 1 }];   // clear of the unit's TX tag
    ring.x = x + rs * 45; ring.y = 1140; N(ring);
    N({ id: p + 'j', sym: 'junction', x: x, y: 1110 });
    N({ id: d + 'tx', tag: 'TX-D' + s, sym: 'transformer2w', x: x, y: 1190, size: 40, cls: 'epms', tx: 'dist', kv: 'mv', hall: h,
      label: 'Distribution transformer, typical unit, stream ' + s, tagAt: s === 'A' ? 'right' : 'left',
      values: [{ k: 'r', dx: -side * 24, dy: 15, anchor: s === 'A' ? 'start' : 'end', lod: 1 }, { k: 'ld', dx: -side * 24, dy: 27, anchor: s === 'A' ? 'start' : 'end', lod: 1 }] });
    N({ id: d + 'cb', tag: 'CB-LV' + s, sym: 'cbIec', x: x, y: 1260, size: SW, cls: 'epms', sw: 'cb', kv: 'lv', relay: d + 'r',
      label: 'LV main air circuit breaker, typical unit', tagAt: s === 'A' ? 'right' : 'left', values: cbVals(s === 'A' ? 'right' : 'left') });
    N({ id: d + 'r', tag: 'R-LV' + s, name: 'LSIG', sym: 'protectionRelay', x: x + side * 44, y: 1260, size: 24, rot: s === 'A' ? 180 : 0, cls: 'epms', prot: 'lsig', cb: d + 'cb',
      label: 'LV main electronic trip unit LSIG', tagAt: 'below' });
    N({ id: d + 'ld', tag: 'LVSB-' + s, name: 'TYPICAL', sym: 'offSheet', x: x, y: 1320, rot: 90, size: 20, cls: 'epms', load: 'lvsb', hall: h, kv: 'lv',
      label: 'LV switchboard, typical (continues on the LV distribution view)', tagAt: 'below',
      values: [{ k: 'r', dx: 0, dy: 44, anchor: 'middle', lod: 1 }] });
    E(p + 'c', p + 'ct.load', p + 'j');
    E(p + 'd', p + 'j', p + 'ld.port', [[x + rs * 45, 1110]]);
    E(p + 'e', p + 'j', d + 'tx.hv');
    E(d + 'a', d + 'tx.lv', d + 'cb.line');
    E(d + 'b', d + 'cb.load', d + 'ld.port');
    sig(d + 'sig', d + 'r.input', [x - side * -8, 1260]);
  }
  FA.forEach(function (x, h) { feeder('A', h, x, h === 3); });
  FB.forEach(function (x, h) { feeder('B', h, x, h === 0); });

  [['A', GAX, 'left'], ['B', GBX, 'right']].forEach(function (g) {
    var s = g[0], x = g[1], id = 'g' + s.toLowerCase() + '-cb', tap = 'm' + s.toLowerCase() + '-gen';
    N({ id: id, tag: 'CB-G' + s, sym: 'cbIec', x: x, y: 995, size: SW, cls: 'epms', sw: 'cb', kv: 'mv', role: 'gen', normal: 'open',
      label: 'Generator bus incomer to section ' + s, tagAt: g[2], values: cbVals(g[2]) });
    N({ id: 'gbus-' + s.toLowerCase(), sym: 'junction', x: x, y: 1100 });
    (s === 'A' ? mvA : mvB).push([tap, x]);
    E(id + '-a', tap, id + '.line');
    E(id + '-b', id + '.load', 'gbus-' + s.toLowerCase());
  });
  N({ id: 'gbus-g', sym: 'junction', x: TIEX, y: 1100 });
  N({ id: 'gen-cb', tag: 'CB-GEN', sym: 'cbIec', x: TIEX, y: 1160, size: SW, cls: 'epms', sw: 'cb', kv: 'mv', normal: 'open', role: 'genset',
    label: 'Generator bus breaker (genset block)', tagAt: 'right', values: cbVals('right') });
  N({ id: 'gen', tag: 'GEN', name: 'DIESEL GENSETS', sym: 'generatorIec', x: TIEX, y: 1240, size: 40, rot: 180, cls: 'epms', src: 'gen', kv: 'mv',
    label: 'Diesel genset block (synchronised generator bus)', tagAt: 'below',
    values: [{ k: 'r', dx: 0, dy: 54, anchor: 'middle', lod: 1 }, { k: 'u', dx: 0, dy: 66, anchor: 'middle', lod: 1 }] });
  E('gbus-1', 'gbus-a', 'gbus-g', null, { w: 'bus' });
  E('gbus-2', 'gbus-g', 'gbus-b', null, { w: 'bus' });
  E('gen-a', 'gbus-g', 'gen-cb.line');
  E('gen-b', 'gen-cb.load', 'gen.out');

  /* ── 20 kV bus sections and the normally open tie ───────────────────────────────────────────── */
  N({ id: 'tie', tag: 'CB-TIE', sym: 'cbIec', x: TIEX, y: MV, size: SW, rot: 270, cls: 'epms', sw: 'cb', kv: 'mv', role: 'tie', normal: 'open',
    label: '20 kV bus-tie circuit breaker (normally open)', tagAt: 'above',
    values: [{ k: 'st', dx: 0, dy: 25, anchor: 'middle', lod: 1 }, { k: 'pw', dx: 0, dy: 37, anchor: 'middle', lod: 1 }] });
  busbar('ma', MV, mvA, 60, TIEX - 60);
  busbar('mb', MV, mvB, TIEX + 60, MVE);
  E('tie-a', 'ma-e', 'tie.line');
  E('tie-b', 'tie.load', 'mb-s');

  /* ── points (PRD-CONV-POINT-STATUS-TREND T2/T3) ─────────────────────────────────────────────────────────────────
     Every value label that shows a reading is a point: `point` (id <prefix>.<node>.<quantity>), `label` (what it is) and,
     for a load %, `limitsOf` (the registry row its limits come from; the page defines the per-device point from that row,
     it never types a bound). A rating, count or voltage (k r / u / bus / bb1 / bb2) is a constant: markConstants() tags it
     data-const and, where the engine publishes the parameter, data-basis-param so a click opens its basis. The sheet keeps
     the text format; the first number of a label is the point (the renderer reads that one). */
  var QTY = { pw: ['power_kw', 'power', 'kW'], kw: ['power_kw', 'power', 'kW'], amp: ['current_a', 'current', 'A'], ld: ['load_pct', 'load', '%'] };
  function points(list, prefix) {
    list.forEach(function (n) {
      (n.values || []).forEach(function (v) {
        var q = QTY[v.k]; if (!q || v.point) return;
        v.point = prefix + '.' + n.id + '.' + q[0];
        v.label = (n.tag || n.id) + ' ' + q[1];
        v.unit = q[2];
        if (v.k === 'ld') v.limitsOf = n.ups ? 'electrical.ups_load_pct_normal' : (n.tx ? 'electrical.tx_load_pct' : undefined);
      });
    });
    return list;
  }
  function basisOf(n, k) {
    if (!n) return null;
    if (k === 'bus' || k === 'bb1' || k === 'bb2') return k === 'bus' ? 'electrical.mv_voltage_kv' : 'electrical.hv_voltage_kv';   /* the first number of the label */
    if (k === 'u') return 'electrical.genset_unit_kw';
    if (k !== 'r') return null;
    if (n.src === 'grid') return 'electrical.hv_voltage_kv';
    if (n.tx === 'hv') return 'electrical.hv_tx_mva';
    if (n.tx) return 'electrical.dist_tx_kva';
    if (n.sym === 'resistor') return 'electrical.mv_ngr_ohm';
    if (n.load === 'lvsb') return 'electrical.dist_tx_count';   /* label leads with × count */
    if (n.board) return n.kv === 'mv' ? 'electrical.mv_voltage_kv' : 'electrical.lv_voltage_v';
    if (n.ups) return 'electrical.ups_module_kw_rated';
    if (n.src === 'gen') return 'electrical.genset_count';
    return null;
  }
  function markConstants(svg, list) {
    if (!svg) return 0;
    var by = {}, n = 0; list.forEach(function (x) { by[x.id] = x; });
    var els = svg.querySelectorAll('text[data-role="value"]:not([data-pt-id]), text[data-role="name"], text[data-role="label"], text.hmi-zone-label, text.hmi-area-label');
    for (var i = 0; i < els.length; i++) {
      var t = els[i];
      if (t.hasAttribute('data-const') || !/\d/.test(t.textContent)) continue;
      t.setAttribute('data-const', '');
      var key = (t.getAttribute('data-val') || '').split(':'), p = basisOf(by[key[0]], key[1]);
      if (p) { t.setAttribute('data-basis-param', p); t.setAttribute('tabindex', '0'); t.setAttribute('role', 'button'); }
      n++;
    }
    return n;
  }

  /* a per-device load % takes its limits from the registry row its value names (limitsOf): defined from the shipped row, re-run
     when the database rows arrive (rz-point-limits). A row that fails the order law leaves the point Informational. */
  var DEF = [];
  function defineLimits(list) {
    if (list && DEF.indexOf(list) < 0) DEF.push(list);
    var PS = root && root.RZPointStatus, rows = root && root.RZ_CONV_PARAMETERS && root.RZ_CONV_PARAMETERS.limits;
    if (!PS || !rows) return;
    DEF.forEach(function (l) {
      l.forEach(function (n) {
        (n.values || []).forEach(function (v) {
          if (!v.point || !v.limitsOf) return;
          var src = rows.filter(function (r) { return r.id === v.limitsOf; })[0]; if (!src) return;
          var o = {}, k; for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) o[k] = src[k];
          o.label = v.label; o.aliasOf = src.id;
          try { PS.define(v.point, o); } catch (e) { /* stays Informational */ }
        });
      });
    });
  }
  if (root && root.addEventListener) root.addEventListener('rz-point-limits', function () { defineLimits(); });

  points(nodes, 'epms-telemetry');
  defineLimits(nodes);
  root.RZEpmsSheets = {
    points: points, markConstants: markConstants, defineLimits: defineLimits,
    sld: {
      id: 'e-s-101', no: 'E-S-101', title: 'HV / MV SINGLE-LINE · GIS · TRANSFORMERS · MAIN SWITCHGEAR', rev: 'A', basis: 'IEC 60617 · IEEE C37.2',
      svgId: 'epms-sld-svg', size: [ZW + 32, 1390], nodes: nodes, edges: edges,
      areas: [
        { x: 16, y: 16, w: ZW, h: 832, label: 'HV GIS SUBSTATION · DOUBLE BUSBAR · POWER TRANSFORMERS', kind: 'zone' },
        { x: 16, y: 852, w: ZW, h: 522, label: 'MV MAIN SWITCHGEAR · GENERATION · TYPICAL LV UNIT', kind: 'zone' }
      ],
      notes: []
    }
  };
})(typeof window !== 'undefined' ? window : null);
