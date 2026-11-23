/*
 * epms-lv.js — window.RZEpmsLv: E-S-102 "LV distribution — typical hall" of EPMS_Telemetry.html
 * (PRD-CONV-EQUIPMENT-TRUTH §6.1 EPMS row, phase E5). Pure and deterministic (no clock, no random, no DOM);
 * Node-tested by tools/test-conv-epms-lv.mjs. It never draws: js/rz-hmi-sheet.js draws the sheet it builds.
 *
 *   build(h, snapshot, fleet)   the sheet of hall h (0..3): its two 20 kV ring incomers (from CB-FA<h+1> / CB-FB<h+1> on
 *                               E-S-101), the 20 kV hall switchboard (sections A and B, normally open tie), per stream
 *                               the typical distribution transformer drawn for the engine's N in parallel, its LV main
 *                               and LV main switchboard, the UPS (rectifier, DC bus, battery, inverter, static bypass)
 *                               down to the rack PDU / RPP board, the mechanical board; the hall's generator bus with
 *                               every set of CONV_CALC.getFleet('genset', hall) and its generator breaker, and one
 *                               generator incomer per section. Every count, rating and load on it is an engine value
 *                               stamped when the sheet is built; geometry is the only thing written here.
 *   basis(snapshot)             RZEpmsSim.basis + the keys this sheet needs, or null
 *   normalState(sheet)          RZEpmsSim.normalState + { lost: {}, run: {} }
 *   solve(sheet, state, basis, upstream)   two passes of RZEpmsSim.solve: a UPS whose DC bus has lost its rectifier
 *                               supply is carried by its battery (state.batt is derived, never operated). upstream
 *                               { ringId: false } marks a ring dead on E-S-101; it counts as a lost source.
 *   operate(sheet, state, id, basis, upstream)  one command on one item: a breaker or static switch toggles (RZEpmsSim
 *                               interlocks + this sheet's: generator breaker only on a running set, generator incomer
 *                               only on a live generator bus with its ring incomer open, ring incomer never onto a
 *                               section a generator incomer holds); a ring source is taken out of / returned to
 *                               service; a genset starts / stops (stop refused while its breaker is closed).
 *                               -> { ok, reason, state } and the old state is never changed
 *   command(sheet, state, id)   what operate() would do to this item: { verb, label } or null
 *   alarms(sheet, state, res)   the active alarms: lost / dead sources, unsupplied boards and loads, UPS on battery,
 *                               running sets, overloaded sources — [{ prio, tag, id, text }]
 *   summary(sheet, state, res)  { servedKw, demandKw, itServedKw, onBattery, running, cbClosed, cbTotal, offNormal }
 */
(function (root) {
  'use strict';
  var HALLS = ['A', 'B', 'C', 'D'], W = 1000, H = 1500;
  function Sim() {
    if (root && root.RZEpmsSim) return root.RZEpmsSim;
    if (typeof require === 'function') return require('./epms-sim.js');
    throw new Error('RZEpmsLv: js/conv/epms-sim.js is not loaded');
  }
  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function grp(v) { return Math.round(v).toLocaleString('en-US'); }

  function basis(snap) {
    var b = Sim().basis(snap); if (!b) return null;
    var e = b.e, need = ['hall_facility_design_kw', 'genset_per_hall', 'ups_module_kw_rated', 'ups_modules_per_system', 'ups_system_count',
      'mv_fault_level_ka', 'lv_fault_level_ka', 'dist_tx_impedance_pct', 'genset_spare_per_hall', 'ups_efficiency'];
    for (var i = 0; i < need.length; i++) if (!isNum(e[need[i]])) return null;
    var halls = snap.campus.halls;
    if (!halls.every(function (h) { return isNum(h.it_load_kw) && isNum(h.facility_load_kw) && isNum(h.racks); })) return null;
    b.halls = halls;
    return b;
  }

  function build(h, snap, fleet) {
    var b = basis(snap); if (!b || !Array.isArray(fleet) || !fleet.length) return null;
    var e = b.e, hall = b.halls[h], H_ = HALLS[h], nodes = [], edges = [], areas = [], notes = [];
    var streams = e.dist_tx_streams, units = e.dist_tx_per_stream_per_hall;
    var modules = e.ups_modules_per_system / b.halls.length;          /* a system's modules shared over the halls */
    var upsKw = modules * e.ups_module_kw_rated;
    var itKw = hall.it_load_kw / streams;
    /* 1.2.0 (P4a, G1): the UPS loss of this stream sits at the UPS: the inverter carries lossFrac = 1/eta - 1 and the
       simulation books lossFrac x its output on the DC bus (rectifier input = output / eta, the engine's upsLossKw() rule).
       The same kW leaves the mech load, which carried it until 1.1.0, so the normal stream total is equal */
    var upsLossKw = itKw * (1 / e.ups_efficiency - 1);
    var mechKw = (hall.facility_load_kw - hall.it_load_kw) / streams - upsLossKw;
    function N(o) { o.hall = h; nodes.push(o); return o; }
    function E(id, from, to, via, o) {
      var x = { id: id, from: from, to: to, medium: 'power', flowOf: 'p' };
      if (via) x.via = via;
      if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; });
      edges.push(x); return x;
    }
    function busbar(prefix, y, taps, x0, x1) {
      var pts = [[prefix + '-s', x0]].concat(taps.slice().sort(function (p, q) { return p[1] - q[1]; })).concat([[prefix + '-e', x1]]);
      pts.forEach(function (t) { N({ id: t[0], sym: 'junction', x: t[1], y: y }); });
      for (var j = 1; j < pts.length; j++) E(prefix + '-' + j, pts[j - 1][0], pts[j][0], null, { w: 'bus' });
    }
    var mvTaps = { A: [], B: [] };

    ['A', 'B'].forEach(function (s) {
      var L = s === 'A', X = function (x) { return L ? x : W - x; }, ls = s.toLowerCase(), T = H_ + s, side = L ? 'right' : 'left';
      var va = L ? 'start' : 'end', vd = L ? 1 : -1;
      var feeder = 'CB-F' + s + (h + 1);
      /* 20 kV ring incomer from E-S-101 */
      N({ id: 'r' + ls + '-src', tag: 'RING ' + s, name: 'from ' + feeder, sym: 'utilitySource', x: X(300), y: 62, size: 30, cls: 'epms', src: 'grid', kv: 'mv',
        ratingKw: e.hall_facility_design_kw, feeder: feeder, ring: 'f' + ls + (h + 1) + '-ld', tagAt: 'at', tagXY: [vd * -22, -8, L ? 'end' : 'start'],
        label: 'Hall ' + H_ + ' 20 kV ring, stream ' + s + ' (fed by ' + feeder + ' on E-S-101)',
        values: [{ k: 'st', dx: vd * 22, dy: -4, anchor: va, lod: 1 }, { k: 'kw', dx: vd * 22, dy: 10, anchor: va, lod: 1 }] });
      N({ id: 'r' + ls + '-cb', tag: 'CB-R' + T, sym: 'cbIec', x: X(300), y: 140, size: 28, cls: 'epms', sw: 'cb', kv: 'mv', role: 'incomer',
        label: '20 kV ring incomer, hall ' + H_ + ' section ' + s, tagAt: L ? 'left' : 'right',
        values: [{ k: 'st', dx: -vd * 18, dy: 15, anchor: L ? 'end' : 'start', lod: 1 }, { k: 'pw', dx: -vd * 18, dy: 27, anchor: L ? 'end' : 'start', lod: 1 }] });
      E('r' + ls + '-a', 'r' + ls + '-src.out', 'r' + ls + '-cb.line');
      E('r' + ls + '-b', 'r' + ls + '-cb.load', 'm' + ls + '-in');
      mvTaps[s].push(['m' + ls + '-in', X(300)]);
      /* the 20 kV hall switchboard section (a symbol at the bus end: the board you click; the bar is the bus) */
      N({ id: 'mv' + ls, tag: 'MVSB-' + T, sym: 'switchgear', x: X(40), y: 200, size: 30, cls: 'epms', kv: 'mv', board: 'm' + ls + '-in',
        label: '20 kV hall switchboard, hall ' + H_ + ' section ' + s, tagAt: 'at', tagXY: [vd * -4, -24, L ? 'start' : 'end'],
        values: [{ k: 'r', dx: vd * -4, dy: 32, anchor: va, lod: 1 }] });
      /* typical distribution transformer, drawn for the N in parallel */
      N({ id: 't' + ls + '-cb', tag: 'CB-T' + T, sym: 'cbIec', x: X(150), y: 280, size: 28, cls: 'epms', sw: 'cb', kv: 'mv',
        label: '20 kV transformer feeder, typical (' + units + ' per stream)', tagAt: side,
        values: [{ k: 'st', dx: vd * 18, dy: 15, anchor: va, lod: 1 }, { k: 'pw', dx: vd * 18, dy: 27, anchor: va, lod: 1 }] });
      N({ id: 't' + ls + '-tx', tag: 'TX-' + T, name: '× ' + units, sym: 'transformer2w', x: X(150), y: 370, size: 44, cls: 'epms', tx: 'dist', kv: 'mv', units: units,
        label: 'Distribution transformer ' + e.mv_voltage_kv + ' / ' + (e.lv_voltage_v / 1000) + ' kV, typical of ' + units + ' in parallel', tagAt: side,
        values: [{ k: 'r', dx: vd * 28, dy: 27, anchor: va, lod: 1 }, { k: 'ld', dx: vd * 28, dy: 39, anchor: va, lod: 1 }] });
      N({ id: 'l' + ls + '-cb', tag: 'CB-LV' + T, sym: 'cbIec', x: X(150), y: 462, size: 28, cls: 'epms', sw: 'cb', kv: 'lv', relay: 'l' + ls + '-r',
        label: 'LV main air circuit breaker, typical', tagAt: L ? 'left' : 'right',
        values: [{ k: 'st', dx: -vd * 18, dy: 15, anchor: L ? 'end' : 'start', lod: 1 }] });
      N({ id: 'l' + ls + '-r', tag: 'R-LV' + T, name: 'LSIG', sym: 'protectionRelay', x: X(200), y: 462, size: 24, rot: L ? 0 : 180, cls: 'epms', prot: 'lsig', cb: 'l' + ls + '-cb',
        label: 'LV main electronic trip unit LSIG', tagAt: side });
      E('t' + ls + '-a', 'm' + ls + '-t', 't' + ls + '-cb.line');
      E('t' + ls + '-b', 't' + ls + '-cb.load', 't' + ls + '-tx.hv');
      E('t' + ls + '-c', 't' + ls + '-tx.lv', 'l' + ls + '-cb.line');
      E('t' + ls + '-d', 'l' + ls + '-cb.load', 'b' + ls + '-in');
      edges.push({ id: 'l' + ls + '-sig', from: 'l' + ls + '-r.input', to: [X(158), 462], medium: 'line', w: 'inst' });
      mvTaps[s].push(['m' + ls + '-t', X(150)]);
      /* LV main switchboard */
      N({ id: 'lv' + ls, tag: 'LVMSB-' + T, name: '× ' + units, sym: 'switchgear', x: X(40), y: 530, size: 30, cls: 'epms', kv: 'lv', board: 'b' + ls + '-in', units: units,
        label: 'LV main switchboard, typical of ' + units + ' (one per transformer)', tagAt: 'at', tagXY: [vd * -4, -36, L ? 'start' : 'end'],
        values: [{ k: 'r', dx: vd * -4, dy: 34, anchor: va, lod: 1 }] });
      busbar('b' + ls, 530, [['b' + ls + '-in', X(150)], ['b' + ls + '-m', X(395)]], Math.min(X(70), X(420)), Math.max(X(70), X(420)));
      /* UPS system of this stream */
      var u = 'u' + ls + '-';
      N({ id: u + 'ci', tag: 'CB-UI' + T, sym: 'cbIec', x: X(150), y: 590, size: 26, cls: 'epms', sw: 'cb', kv: 'lv', tagAt: side,
        label: 'UPS input breaker', values: [{ k: 'st', dx: vd * 17, dy: 15, anchor: va, lod: 1 }] });
      N({ id: u + 'j', sym: 'junction', x: X(150), y: 634 });
      N({ id: u + 'rec', tag: 'REC-' + T, name: '× ' + modules, stack: modules, stackDir: -vd, sym: 'rectifier', x: X(150), y: 680, size: 34, cls: 'epms', kv: 'lv', ups: true, tagAt: side,
        label: 'UPS rectifier / charger', values: [{ k: 'kw', dx: vd * 21, dy: 27, anchor: va, lod: 1 }] });
      N({ id: u + 'dc', sym: 'junction', x: X(150), y: 730 });
      N({ id: u + 'cbb', tag: 'CB-BAT' + T, sym: 'cbIec', x: X(290), y: 770, size: 24, cls: 'epms', sw: 'cb', kv: 'lv', tagAt: L ? 'left' : 'right',
        label: 'Battery breaker' });
      N({ id: u + 'bat', tag: 'BAT-' + T, sym: 'batteryIec', x: X(290), y: 840, size: 30, cls: 'epms', src: 'battery', kv: 'lv', ratingKw: upsKw, dcBus: u + 'dc', rec: u + 'rec', ss: u + 'ss', tagAt: 'below',
        label: 'Battery strings (autonomy not modelled)', values: [{ k: 'st', dx: 0, dy: 37, anchor: 'middle', lod: 1 }] });
      N({ id: u + 'inv', tag: 'INV-' + T, name: '× ' + modules + ' · ' + e.ups_redundancy, stack: modules, stackDir: -vd, sym: 'inverterIec', x: X(150), y: 790, size: 34, cls: 'epms', kv: 'lv', ups: true, tagAt: side, lossFrac: 1 / e.ups_efficiency - 1,
        label: 'UPS inverter, typical of ' + modules + ' parallel modules (' + e.ups_redundancy + ' with the other stream)', values: [{ k: 'st', dx: vd * 21, dy: 27, anchor: va, lod: 1 }, { k: 'ld', dx: vd * 21, dy: 39, anchor: va, lod: 1 }, { k: 'r', dx: vd * 21, dy: 51, anchor: va, lod: 1 }] });
      N({ id: u + 'co', tag: 'CB-UO' + T, sym: 'cbIec', x: X(150), y: 868, size: 26, cls: 'epms', sw: 'cb', kv: 'lv', tagAt: side,
        label: 'UPS output breaker', values: [{ k: 'st', dx: vd * 17, dy: 15, anchor: va, lod: 1 }] });
      N({ id: u + 'ss', tag: 'SS-' + T, sym: 'staticSwitch', x: X(70), y: 760, size: 30, cls: 'epms', sw: 'ss', normal: 'open', kv: 'lv', tagAt: side,
        label: 'Static bypass switch (normally off)' });
      N({ id: u + 'ob', sym: 'junction', x: X(150), y: 920 });
      E(u + 'a', 'b' + ls + '-u', u + 'ci.line');
      E(u + 'b', u + 'ci.load', u + 'j');
      E(u + 'c', u + 'j', u + 'rec.ac');
      E(u + 'd', u + 'rec.dc', u + 'dc');
      E(u + 'e', u + 'dc', u + 'inv.dc');
      E(u + 'f', u + 'dc', u + 'cbb.line', [[X(290), 730]]);
      E(u + 'g', u + 'cbb.load', u + 'bat.pos');
      E(u + 'h', u + 'inv.ac', u + 'co.line');
      E(u + 'i', u + 'co.load', u + 'ob');
      E(u + 'k', u + 'j', u + 'ss.line', [[X(70), 634]]);
      E(u + 'l', u + 'ss.load', u + 'ob', [[X(70), 920]]);
      /* the tap for the UPS sits on the LV board right under the LV main: one more junction on that bus */
      E('b' + ls + '-ud', 'b' + ls + '-in', 'b' + ls + '-u', null, { w: 'bus' });
      N({ id: 'b' + ls + '-u', sym: 'junction', x: X(150), y: 552, dot: false });
      /* rack PDU / RPP board (A or B cord of every rack) */
      N({ id: 'p' + ls + '-cb', tag: 'CB-RPP' + T, sym: 'cbIec', x: X(150), y: 966, size: 26, cls: 'epms', sw: 'cb', kv: 'lv', tagAt: side,
        label: 'Feeder to the rack PDU / RPP boards', values: [{ k: 'st', dx: vd * 17, dy: 15, anchor: va, lod: 1 }] });
      N({ id: 'p' + ls + '-ld', tag: 'RPP-' + T, name: '× ' + grp(hall.racks) + ' racks · ' + s + ' cord', sym: 'offSheet', rot: 90, x: X(150), y: 1046, size: 20, cls: 'epms', kv: 'lv',
        load: 'it', kw: itKw, label: 'Rack PDU / RPP boards, ' + s + ' cord of every rack (board count not modelled)', tagAt: 'below',
        values: [{ k: 'kw', dx: 0, dy: 50, anchor: 'middle', lod: 1 }] });
      E(u + 'm', u + 'ob', 'p' + ls + '-cb.line');
      E(u + 'n', 'p' + ls + '-cb.load', 'p' + ls + '-ld.port');
      /* mechanical and house load of this stream */
      N({ id: 'k' + ls + '-cb', tag: 'CB-M' + T, sym: 'cbIec', x: X(395), y: 590, size: 26, cls: 'epms', sw: 'cb', kv: 'lv', tagAt: L ? 'left' : 'right',
        label: 'Feeder to the mechanical and house boards', values: [{ k: 'st', dx: -vd * 17, dy: 15, anchor: L ? 'end' : 'start', lod: 1 }] });
      N({ id: 'k' + ls + '-ld', tag: 'MECH-' + T, name: 'mech + house', sym: 'offSheet', rot: 90, x: X(395), y: 670, size: 20, cls: 'epms', kv: 'lv',
        load: 'mech', kw: mechKw, label: 'Mechanical and house load of this stream (the UPS loss is booked at the UPS)', tagAt: 'below',
        values: [{ k: 'kw', dx: 0, dy: 50, anchor: 'middle', lod: 1 }] });
      E('k' + ls + '-a', 'b' + ls + '-m', 'k' + ls + '-cb.line');
      E('k' + ls + '-b', 'k' + ls + '-cb.load', 'k' + ls + '-ld.port');
      areas.push({ x: L ? 40 : W - 350, y: 612, w: 310, h: 296, label: 'UPS-' + T, kind: 'box' });
      /* generator incomer of this section */
      N({ id: 'g' + ls + '-cb', tag: 'CB-G' + T, sym: 'cbIec', x: X(455), y: 1220, size: 28, cls: 'epms', sw: 'cb', kv: 'mv', role: 'hgen', normal: 'open', section: 'm' + ls + '-in',
        incomer: 'r' + ls + '-cb', label: 'Generator incomer to section ' + s + ' (normally open)', tagAt: L ? 'left' : 'right',
        values: [{ k: 'st', dx: -vd * 18, dy: 15, anchor: L ? 'end' : 'start', lod: 1 }, { k: 'pw', dx: -vd * 18, dy: 27, anchor: L ? 'end' : 'start', lod: 1 }] });
      E('g' + ls + '-a', 'm' + ls + '-g', 'g' + ls + '-cb.line', null, { line: 'GEN INCOMER ' + s + ' · 20 kV · normally open', lineLod: 1 });   // E14: a 1 000-unit run names itself
      E('g' + ls + '-b', 'g' + ls + '-cb.load', 'gb-' + ls);
      mvTaps[s].push(['m' + ls + '-g', X(455)]);
    });
    busbar('ma', 200, mvTaps.A, 70, 450);
    busbar('mb', 200, mvTaps.B, W - 450, W - 70);
    N({ id: 'tie', tag: 'CB-TIE' + H_, sym: 'cbIec', x: W / 2, y: 200, size: 28, rot: 270, cls: 'epms', sw: 'cb', kv: 'mv', role: 'tie', normal: 'open',
      label: '20 kV hall bus-tie circuit breaker (normally open)', tagAt: 'above',
      values: [{ k: 'st', dx: 0, dy: 26, anchor: 'middle', lod: 1 }] });
    E('tie-a', 'ma-e', 'tie.line');
    E('tie-b', 'tie.load', 'mb-s');

    /* the hall's generator bus: every set of the engine fleet for this hall, each with its own breaker */
    var GY = 1280, n = fleet.length, x0 = 110, x1 = W - 110, step = n > 1 ? (x1 - x0) / (n - 1) : 0, gTaps = [['gb-a', 455], ['gb-b', W - 455]];
    fleet.forEach(function (f, i) {
      var x = Math.round(x0 + i * step), id = 'gs' + f.n;
      gTaps.push(['gb-t' + f.n, x]);
      N({ id: id + '-cb', tag: 'CB-' + f.tag, sym: 'cbIec', x: x, y: 1330, size: 24, cls: 'epms', sw: 'cb', kv: 'mv', role: 'gcb', normal: 'open', set: id,
        label: 'Generator breaker of ' + f.tag + ' (closes on a running set through the synchroniser)', tagAt: 'none' });
      N({ id: id, tag: f.tag, sym: 'generatorIec', x: x, y: 1390, size: 30, rot: 180, cls: 'epms', src: 'gen', unit: true, kv: 'mv',
        ratingKw: f.ratingKw * e.genset_max_loading, ratedKw: f.ratingKw, fleetN: f.n, label: 'Diesel generating set ' + f.tag + ' (' + grp(f.ratingKw) + ' kW)', tagAt: 'below',
        values: [{ k: 'st', dx: 0, dy: 38, anchor: 'middle', lod: 1 }, { k: 'kw', dx: 0, dy: 50, anchor: 'middle', lod: 1 }] });
      E(id + '-a', 'gb-t' + f.n, id + '-cb.line');
      E(id + '-b', id + '-cb.load', id + '.out');
    });
    var gx = gTaps.map(function (t) { return t[1]; }), gmin = Math.min.apply(null, gx), gmax = Math.max.apply(null, gx);
    gTaps.sort(function (p, q) { return p[1] - q[1]; });
    gTaps.forEach(function (t) { N({ id: t[0], sym: 'junction', x: t[1], y: GY }); });
    for (var j = 1; j < gTaps.length; j++) E('gb-' + j, gTaps[j - 1][0], gTaps[j][0], null, { w: 'bus' });
    areas.push({ x: 16, y: 16, w: W - 32, h: 224, label: '20 KV HALL SWITCHBOARD · HALL ' + H_, kind: 'zone' });
    areas.push({ x: 16, y: 244, w: 424, h: 892, label: 'STREAM A', kind: 'zone' });
    areas.push({ x: W - 440, y: 244, w: 424, h: 892, label: 'STREAM B', kind: 'zone' });
    areas.push({ x: 16, y: 1144, w: W - 32, h: 340, label: 'HALL GENERATION · ' + n + ' SETS (' + (n - e.genset_spare_per_hall) + ' + ' + e.genset_spare_per_hall + ')', kind: 'zone' });
    void gmin; void gmax;
    if (root.RZEpmsSheets && root.RZEpmsSheets.points) { root.RZEpmsSheets.points(nodes, 'epms-telemetry.lv-' + H_); root.RZEpmsSheets.defineLimits(nodes); }   /* PRD-CONV-POINT-STATUS-TREND T2 */
    return {
      id: 'e-s-102-' + H_.toLowerCase(), no: 'E-S-102', title: 'LV DISTRIBUTION · TYPICAL HALL · HALL ' + H_, rev: 'A', basis: 'IEC 60617 · IEEE C37.2',
      svgId: 'epms-lv-svg', size: [W, H], minScale: 1.17, nodes: nodes, edges: edges, areas: areas, notes: notes, hall: h, hallCode: H_,
      keys: root.RZEpmsSheets && root.RZEpmsSheets.keysFrom ? root.RZEpmsSheets.keysFrom(nodes) : [],
      counts: { gensets: n, units: units, modules: modules, racks: hall.racks }
    };
  }

  function normalState(sheet) {
    var s = Sim().normalState(sheet);
    s.lost = {}; s.run = {};
    return s;
  }
  function byId(sheet) { var o = {}; sheet.nodes.forEach(function (n) { o[n.id] = n; }); return o; }
  /* the state the solver sees: a ring dead on E-S-101 is a lost source here; batteries as derived */
  function effective(sheet, state, upstream, batt) {
    var s = { closed: state.closed, gen: false, run: state.run || {}, lost: {}, batt: batt || {}, blocked: {} };
    /* a UPS on battery: its rectifier and static bypass never feed back into the dead input side */
    sheet.nodes.forEach(function (n) { if (n.src === 'battery' && s.batt[n.id]) { s.blocked[n.rec] = true; s.blocked[n.ss] = true; } });
    sheet.nodes.forEach(function (n) {
      if (n.src !== 'grid') return;
      s.lost[n.id] = !!(state.lost && state.lost[n.id]) || !!(upstream && upstream[n.id] === false);
    });
    return s;
  }
  function solve(sheet, state, b, upstream) {
    var S = Sim(), r1 = S.solve(sheet, effective(sheet, state, upstream, {}), b), batt = {};
    sheet.nodes.forEach(function (n) {
      if (n.src !== 'battery') return;
      var dc = r1.raw.nodes[n.dcBus];
      if (!(dc && dc.energised)) batt[n.id] = true;
    });
    var r = Object.keys(batt).length ? S.solve(sheet, effective(sheet, state, upstream, batt), b) : r1;
    r.batt = batt;
    r.lost = effective(sheet, state, upstream, batt).lost;
    return r;
  }

  function tagOf(by, id) { return by[id] ? by[id].tag || id : id; }
  function command(sheet, state, id) {
    var n = byId(sheet)[id]; if (!n) return null;
    if (n.sw) { var c = !!state.closed[id]; return { verb: c ? 'open' : 'close', label: c ? 'Open' : 'Close' }; }
    if (n.src === 'grid') { var out = !!(state.lost && state.lost[id]); return { verb: out ? 'restore' : 'isolate', label: out ? 'Return to service' : 'Take out of service' }; }
    if (n.src === 'gen' && n.unit) { var on = !!(state.run && state.run[id]); return { verb: on ? 'stop' : 'start', label: on ? 'Stop' : 'Start' }; }
    return null;
  }
  function copy(state) {
    var c = { closed: {}, gen: !!state.gen, lost: {}, run: {} };
    ['closed', 'lost', 'run'].forEach(function (k) { Object.keys(state[k] || {}).forEach(function (x) { c[k][x] = state[k][x]; }); });
    return c;
  }
  function operate(sheet, state, id, b, upstream) {
    var by = byId(sheet), n = by[id], cmd = command(sheet, state, id);
    function no(reason) { return { ok: false, reason: reason, state: state }; }
    if (!n || !cmd) return no((n ? tagOf(by, id) : id) + ' cannot be operated');
    var next;
    if (n.src === 'grid') {
      next = copy(state); next.lost[id] = cmd.verb === 'isolate';
      return { ok: true, reason: n.tag + (cmd.verb === 'isolate' ? ' taken out of service' : ' returned to service'), state: next };
    }
    if (n.src === 'gen') {
      if (cmd.verb === 'stop' && state.closed[id + '-cb']) return no(n.tag + ' stops only with its breaker ' + tagOf(by, id + '-cb') + ' open, and it is closed');
      next = copy(state); next.run[id] = cmd.verb === 'start';
      return { ok: true, reason: n.tag + (cmd.verb === 'start' ? ' started, running at no load' : ' stopped'), state: next };
    }
    var close = cmd.verb === 'close';
    if (close && n.role === 'gcb' && !(state.run && state.run[n.set]))
      return no(n.tag + ' closes only on a running set through the synchroniser; ' + tagOf(by, n.set) + ' is stopped');
    if (close && n.role === 'hgen') {
      if (state.closed[n.incomer]) return no(n.tag + ' cannot close while ' + tagOf(by, n.incomer) + ' is closed: the sets do not run in parallel with the ring in this simulation');
      var gbLive = sheet.nodes.some(function (m) { return m.role === 'gcb' && state.closed[m.id] && state.run && state.run[m.set]; });
      if (!gbLive) return no(n.tag + ' closes only on a live generator bus; no set is running with its breaker closed');
      var sec = solve(sheet, state, b, upstream).raw.nodes[n.section];
      if (sec && sec.energised) return no(n.tag + ' closes only onto a dead section; section ' + n.section.charAt(1).toUpperCase() + ' is live from another source');
    }
    if (close && n.role === 'tie') {
      var rn = solve(sheet, state, b, upstream).raw.nodes, la = rn['ma-e'], lb = rn['mb-s'];
      if (la && lb && la.energised && lb.energised) return no(n.tag + ' closes only with one section dead: both are live and this simulation has no synchronising check on the tie');
    }
    if (close && n.role === 'incomer') {
      var g = sheet.nodes.filter(function (m) { return m.role === 'hgen' && m.incomer === id && state.closed[m.id]; })[0];
      if (g) return no(n.tag + ' cannot close while the generator incomer ' + g.tag + ' holds the section: open it first');
    }
    var r = Sim().operate(sheet, effective(sheet, state, upstream, {}), id, close, b);
    if (!r.ok) return no(r.reason);
    next = copy(state); next.closed[id] = close;
    return { ok: true, reason: r.reason, state: next };
  }

  function alarms(sheet, state, res) {
    var out = [], by = byId(sheet);
    function add(prio, n, text) { out.push({ prio: prio, id: n.id, tag: n.tag, text: n.tag + ' ' + text }); }
    sheet.nodes.forEach(function (n) {
      var d = res.dev[n.id];
      if (n.src === 'grid' && res.lost[n.id]) add(1, n, state.lost && state.lost[n.id] ? 'out of service' : 'dead: ' + n.feeder + ' on E-S-101 does not supply it');
      if (n.load && !(d && d.energised)) add(1, n, 'not supplied');
      if (n.board) { var bus = res.raw.nodes[n.board]; if (!(bus && bus.energised)) add(1, n, 'dead'); }
      if (n.src === 'battery' && res.batt[n.id]) add(1, n, 'discharging: the UPS is on battery');
      if (n.src === 'gen' && state.run && state.run[n.id]) add(2, n, 'running');
      if (n.src && res.raw.sources[n.id] && res.raw.sources[n.id].overload) add(1, n, 'overloaded');
    });
    void by;
    return out;
  }
  function summary(sheet, state, res) {
    var o = { servedKw: 0, demandKw: 0, itServedKw: 0, onBattery: Object.keys(res.batt).length, running: 0, cbClosed: 0, cbTotal: 0, offNormal: 0 };
    sheet.nodes.forEach(function (n) {
      if (n.load) { o.demandKw += n.kw; if (res.dev[n.id] && res.dev[n.id].energised) { o.servedKw += n.kw; if (n.load === 'it') o.itServedKw += n.kw; } }
      /* 1.2.0: the UPS loss is load too (it left the mech load); the simulation books it only while the inverter passes power */
      if (isNum(n.lossFrac) && res.dev[n.id] && isNum(res.dev[n.id].lossKw)) { o.demandKw += res.dev[n.id].lossKw; o.servedKw += res.dev[n.id].lossKw; }
      if (n.src === 'gen' && state.run && state.run[n.id]) o.running++;
      if (n.sw === 'cb') { o.cbTotal++; if (state.closed[n.id]) o.cbClosed++; }
      if (n.sw && !!state.closed[n.id] !== (n.normal !== 'open')) o.offNormal++;
      if (n.src === 'grid' && state.lost && state.lost[n.id]) o.offNormal++;
    });
    return o;
  }

  var API = { build: build, basis: basis, normalState: normalState, solve: solve, operate: operate, command: command, alarms: alarms, summary: summary,
    HALLS: HALLS, version: '1.2.0' };
  if (root) root.RZEpmsLv = Object.freeze(API);
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : null);
