/*
 * internals/ups.js — the INSIDE of one double-conversion UPS (PRD-CONV-EQUIPMENT-INSIDE P4a, P4-ELECTRICAL.md §4.2),
 * registered as RZConvInternals class 'ups' (UPS-AA / UPS-AB of each hall on E-S-102). Drawn by js/rz-hmi-sheet.js with
 * IEC 60617 symbols; coloured and moved only by js/conv/vfx.js.
 *
 *   NORMAL:  input breaker -> rectifier -> DC bus -> inverter -> output breaker -> the rack PDU / RPP boards; the
 *            battery floats on the DC bus.
 *   BATTERY: the rectifier has lost its supply; the battery carries the DC bus and the inverter.
 *   BYPASS:  the static bypass switch feeds the load from the input, around the converters.
 *   The maintenance bypass is drawn; its position is not modelled.
 *
 * The unit comes from the EPMS page's simulation adapter (E-S-102): { tag, state, mode, recKw, invKw, batKw, ssKw,
 * ratingKw, ci, cbb, co, ss } (kW from the simulation, breaker positions CLOSED / OPEN). Since js/conv/epms-lv.js 1.2.0 the
 * rectifier draws output / efficiency, so the loss on this drawing is the engine's (P4-ELECTRICAL.md G1). Efficiency,
 * module rating and redundancy are engine keys; battery autonomy, state of charge and DC bus voltage are not modelled.
 * This file holds geometry and key names only: no digit outside the GEOMETRY and FORMATS blocks, comments and standards.
 */
(function (root) {
  'use strict';
  var R = root && root.RZConvInternals ? root.RZConvInternals : (typeof require === 'function' ? require('../internals.js') : null);
  if (!R) return;
  var NM = R.NOT_MODELLED;
  /* FORMATS BEGIN */
  var ADD_FMT = { kw: { d: 1, u: 'kW' }, kwl: { d: 2, u: 'kW' }, pcte: { d: 2, u: '%', x: 100 }, pctl: { d: 1, u: '%', x: 100 }, count: { d: 0, u: '' } };
  /* FORMATS END */
  Object.keys(ADD_FMT).forEach(function (k) { if (!R.FMT[k]) R.FMT[k] = ADD_FMT[k]; });

  /* GEOMETRY BEGIN — drawing units; the sheet is fitted to its panel, never below 0.92 x its width */
  var SHEET = { size: [620, 620], minScale: 0.92 };
  var NODES = [
    { id: 'in', tag: 'FROM LVMSB', sym: 'offSheet', rot: 270, x: 270, y: 34, size: 22, tagAt: 'at', tagXY: [18, 4, 'start'], label: 'From the LV main switchboard' },
    { id: 'ci', tag: 'CB-UI', sym: 'cbIec', x: 270, y: 112, size: 34, tagAt: 'at', tagXY: [24, -6, 'start'], label: 'UPS input breaker',
      values: [{ k: 'st', dx: 24, dy: 10, anchor: 'start', lod: 1 }] },
    { id: 'j', sym: 'junction', x: 270, y: 164 },
    { id: 'rec', tag: 'RECTIFIER', sym: 'rectifier', x: 270, y: 226, size: 44, tagAt: 'at', tagXY: [30, -10, 'start'], label: 'Rectifier / charger (AC to DC)',
      values: [{ k: 'kw', dx: 30, dy: 8, anchor: 'start', lod: 1 }] },
    { id: 'dc', sym: 'junction', x: 270, y: 296 },
    { id: 'cbb', tag: 'CB-BAT', sym: 'cbIec', x: 470, y: 340, size: 30, tagAt: 'at', tagXY: [22, 4, 'start'], label: 'Battery breaker',
      values: [{ k: 'st', dx: 22, dy: 20, anchor: 'start', lod: 1 }] },
    { id: 'bat', tag: 'BATTERY', sym: 'batteryIec', x: 470, y: 440, size: 40, tagAt: 'at', tagXY: [0, 40], label: 'Battery strings',
      values: [{ k: 'kw', dx: 28, dy: 4, anchor: 'start', lod: 1 }] },
    { id: 'inv', tag: 'INVERTER', sym: 'inverterIec', x: 270, y: 376, size: 44, tagAt: 'at', tagXY: [30, -10, 'start'], label: 'Inverter (DC to AC)',
      values: [{ k: 'kw', dx: 30, dy: 8, anchor: 'start', lod: 1 }, { k: 'md', dx: 30, dy: 24, anchor: 'start', lod: 1 }] },
    { id: 'co', tag: 'CB-UO', sym: 'cbIec', x: 270, y: 462, size: 34, tagAt: 'at', tagXY: [24, -6, 'start'], label: 'UPS output breaker',
      values: [{ k: 'st', dx: 24, dy: 10, anchor: 'start', lod: 1 }] },
    { id: 'ob', sym: 'junction', x: 270, y: 520 },
    { id: 'ss', tag: 'STATIC SW', sym: 'staticSwitch', x: 160, y: 300, size: 36, tagAt: 'at', tagXY: [-24, -4, 'end'], label: 'Static bypass switch (thyristor pair)',
      values: [{ k: 'st', dx: -24, dy: 12, anchor: 'end', lod: 1 }] },
    { id: 'mb', tag: 'MAINT BYPASS', sym: 'cbIec', x: 60, y: 200, size: 30, tagAt: 'at', tagXY: [8, -26, 'start'], label: 'Maintenance bypass breaker',
      values: [{ k: 'st', dx: 8, dy: 30, anchor: 'start', lod: 1 }] },
    { id: 'out', tag: 'TO RPP', sym: 'offSheet', rot: 90, x: 270, y: 590, size: 22, tagAt: 'at', tagXY: [18, 4, 'start'], label: 'To the rack PDU / RPP boards' }
  ];
  var EDGES = [
    { id: 'a-in', from: 'in.port', to: 'ci.line', medium: 'power', flowOf: 'ac' },
    { id: 'a-ci', from: 'ci.load', to: 'j', medium: 'power', flowOf: 'ac' },
    { id: 'a-rec', from: 'j', to: 'rec.ac', medium: 'power', flowOf: 'ac' },
    { id: 'd-rec', from: 'rec.dc', to: 'dc', medium: 'power', flowOf: 'dc' },
    { id: 'd-inv', from: 'dc', to: 'inv.dc', medium: 'power', flowOf: 'dc' },
    { id: 'b-cbb', from: 'dc', to: 'cbb.line', via: [[470, 296]], medium: 'power', flowOf: 'bat' },
    { id: 'b-bat', from: 'cbb.load', to: 'bat.pos', medium: 'power', flowOf: 'bat' },
    { id: 'o-inv', from: 'inv.ac', to: 'co.line', medium: 'power', flowOf: 'out' },
    { id: 'o-co', from: 'co.load', to: 'ob', medium: 'power', flowOf: 'out' },
    { id: 'o-out', from: 'ob', to: 'out.port', medium: 'power', flowOf: 'out' },
    { id: 'y-ss', from: 'j', to: 'ss.line', via: [[160, 164]], medium: 'power', flowOf: 'byp' },
    { id: 'y-ob', from: 'ss.load', to: 'ob', via: [[160, 520]], medium: 'power', flowOf: 'byp' },
    { id: 'm-mb', from: [270, 72], to: 'mb.line', via: [[60, 72]], medium: 'power', flowOf: 'mb' },
    { id: 'm-ob', from: 'mb.load', to: [160, 560], via: [[60, 560]], medium: 'power', flowOf: 'mb' },
    { id: 'm-jn', from: [160, 560], to: [270, 560], medium: 'power', flowOf: 'mb' }
  ];
  /* GEOMETRY END */

  var E = 'electrical.';
  function sheet(unit) {
    var tag = (unit && unit.tag) || 'UPS';
    return { id: 'int-ups', no: tag + '-INT', title: tag + ' internal — double-conversion UPS', rev: 'A', basis: 'IEC 60617 · IEC 62040-3',
      svgId: 'rz-cvm-int-svg', size: SHEET.size.slice(), minScale: SHEET.minScale, nodes: NODES, edges: EDGES, areas: [], notes: [] };
  }
  function model(u, s) {
    var e = (s && s.electrical) || {}, mode = u.mode || 'OFF';
    var pOut = mode === 'BYPASS' ? u.ssKw : mode === 'OFF' ? null : u.invKw;
    var pIn = mode === 'NORMAL' ? u.recKw : mode === 'BATTERY' ? u.batKw : null;
    var conv = mode === 'NORMAL' || mode === 'BATTERY';
    return {
      state: u.state, tag: u.tag, mode: mode,
      recKw: u.recKw, invKw: u.invKw, batKw: u.batKw, ssKw: u.ssKw,
      pIn: conv ? pIn : NM, pOut: pOut, loss: conv ? pIn - pOut : NM,
      eff: e.ups_efficiency, effNow: conv && pIn ? pOut / pIn : NM,
      loadFrac: typeof pOut === 'number' && u.ratingKw ? pOut / u.ratingKw : null,
      ratingKw: u.ratingKw, moduleKw: e.ups_module_kw_rated, modules: u.ratingKw && e.ups_module_kw_rated ? u.ratingKw / e.ups_module_kw_rated : null,
      redundancy: e.ups_redundancy,
      ci: u.ci, cbb: u.cbb, co: u.co, ssPos: u.ss, mb: NM,
      autonomy: NM, soc: NM, dcV: NM, batTemp: NM, partLoad: NM
    };
  }
  function on(pos) { return pos === 'CLOSED'; }
  function nodeState(id, m) {
    if (id === 'rec') return m.mode === 'NORMAL' ? 'running' : 'stopped';
    if (id === 'inv') return m.mode === 'NORMAL' || m.mode === 'BATTERY' ? 'running' : 'stopped';
    if (id === 'bat') return m.mode === 'BATTERY' ? 'running' : 'standby';
    if (id === 'ss') return m.mode === 'BYPASS' ? 'running' : 'standby';
    if (id === 'ci') return on(m.ci) ? 'running' : 'stopped';
    if (id === 'co') return on(m.co) ? 'running' : 'stopped';
    if (id === 'cbb') return on(m.cbb) ? 'standby' : 'stopped';
    if (id === 'mb') return 'standby';
    return null;
  }
  function flow(u, k) {
    var md = u.mode || 'OFF';
    if (k === 'ac') return md === 'NORMAL' ? 'running' : on(u.ci) ? 'standby' : 'stopped';
    if (k === 'dc') return md === 'NORMAL' || md === 'BATTERY' ? 'running' : 'stopped';
    if (k === 'bat') return md === 'BATTERY' ? 'running' : on(u.cbb) ? 'standby' : 'stopped';
    if (k === 'out') return md === 'OFF' ? 'stopped' : 'running';
    if (k === 'byp') return md === 'BYPASS' ? 'running' : 'standby';
    if (k === 'mb') return 'unavailable';
    return null;
  }
  var NODE_VALUES = {
    ci: [{ k: 'st', key: 'ci', fmt: 'text' }], co: [{ k: 'st', key: 'co', fmt: 'text' }], cbb: [{ k: 'st', key: 'cbb', fmt: 'text' }],
    rec: [{ k: 'kw', key: 'recKw', fmt: 'kw', prefix: 'IN' }],
    inv: [{ k: 'kw', key: 'invKw', fmt: 'kw', prefix: 'OUT' }, { k: 'md', key: 'mode', fmt: 'text' }],
    bat: [{ k: 'kw', key: 'batKw', fmt: 'kw' }], ss: [{ k: 'st', key: 'ssPos', fmt: 'text' }], mb: [{ k: 'st', key: 'mb', fmt: 'text' }]
  };
  var BLOCKS = [
    { id: 'conversion', node: 'inv', name: 'Double conversion — rectifier, DC bus, inverter', standard: 'IEC 62040-3',
      role: ['Turns the mains into DC and back into clean AC for the racks.', 'Every kW out costs one kW over the efficiency in.'],
      values: [{ label: 'Mode', key: 'mode', fmt: 'text', sim: true }, { label: 'Power in', key: 'pIn', fmt: 'kw', sim: true },
        { label: 'Power out', key: 'pOut', fmt: 'kw', sim: true }, { label: 'Loss (in − out)', key: 'loss', fmt: 'kwl', sim: true },
        { label: 'Efficiency', key: 'eff', fmt: 'pcte', basis: E + 'ups_efficiency' }, { label: 'Part-load efficiency', key: 'partLoad', fmt: 'text' },
        { label: 'Load', key: 'loadFrac', fmt: 'pctl', sim: true }] },
    { id: 'rating', node: 'rec', name: 'Modules and rating', standard: 'IEC 62040-3',
      role: ['Power modules in parallel make the system rating.', 'The redundancy row says how many systems share the IT load.'],
      values: [{ label: 'Rating', key: 'ratingKw', fmt: 'kw', sim: true }, { label: 'Module rating', key: 'moduleKw', fmt: 'kw', basis: E + 'ups_module_kw_rated' },
        { label: 'Modules', key: 'modules', fmt: 'count' }, { label: 'Redundancy', key: 'redundancy', fmt: 'text', basis: E + 'ups_redundancy' }] },
    { id: 'battery', node: 'bat', name: 'Battery strings', standard: 'IEC 62040-3 · IEC 60896',
      role: ['Floats on the DC bus and carries the inverter when the mains is lost.', 'It bridges the gap until the generators take the load.'],
      values: [{ label: 'Battery power', key: 'batKw', fmt: 'kw', sim: true }, { label: 'Breaker', key: 'cbb', fmt: 'text', sim: true },
        { label: 'Autonomy', key: 'autonomy', fmt: 'text' }, { label: 'State of charge', key: 'soc', fmt: 'text' },
        { label: 'DC bus voltage', key: 'dcV', fmt: 'text' }, { label: 'Battery temperature', key: 'batTemp', fmt: 'text' }] },
    { id: 'bypass', node: 'ss', name: 'Static and maintenance bypass', standard: 'IEC 62040-3 · IEC 60617-5',
      role: ['The static switch takes the load onto the input in milliseconds if the inverter fails.', 'The maintenance bypass isolates the whole UPS for work.'],
      values: [{ label: 'Static switch', key: 'ssPos', fmt: 'text', sim: true }, { label: 'Bypass power', key: 'ssKw', fmt: 'kw', sim: true },
        { label: 'Maintenance bypass', key: 'mb', fmt: 'text' }] },
    { id: 'breakers', node: 'ci', name: 'Input and output breakers', standard: 'IEC 60947-2',
      role: ['Isolate the UPS from the board above and the load below.', 'Opening the input puts the UPS on battery.'],
      values: [{ label: 'Input breaker', key: 'ci', fmt: 'text', sim: true }, { label: 'Output breaker', key: 'co', fmt: 'text', sim: true }] }
  ];
  var NODE_BLOCK = { rec: 'conversion', dc: 'conversion', co: 'breakers', cbb: 'battery', mb: 'bypass', in: 'breakers', out: 'breakers' };
  R.register('ups', { title: 'UPS', sheet: sheet, model: model, nodeState: nodeState, flow: flow,
    nodeValues: NODE_VALUES, blocks: BLOCKS, nodeBlock: NODE_BLOCK, media: [['power', 'Power']], defaultBlock: 'conversion' });
})(typeof window !== 'undefined' ? window : null);
