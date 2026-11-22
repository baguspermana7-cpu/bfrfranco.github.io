/*
 * internals/breaker.js — the INSIDE of one circuit breaker on the EPMS single-lines (PRD-CONV-EQUIPMENT-INSIDE P4b,
 * P4b-BREAKER-RELAY.md §4.1), registered as RZConvInternals class 'breaker'. Drawn by js/rz-hmi-sheet.js with IEC 60617
 * symbols from js/rz-eng-symbols.js; coloured and moved only by js/conv/vfx.js.
 *
 *   Power: from the upstream device -> current transformer -> main contacts in their arc chamber -> to the load.
 *   Control: the stored-energy spring mechanism (charging motor), trip coil and close coil, auxiliary contacts 52a / 52b;
 *            the trip path from the CT to the LV electronic trip unit (LSIG) or to the MV / HV protection relay.
 *   Interlocks: the earthing switches and disconnectors of the sheet that name this breaker, with their live position.
 *
 * The unit comes from js/conv/epms-internals.js breakerUnits(): { tag, kv, state, pos, kw, a, up, down, relay, lsig,
 * il: [{ tag, pos }] } read from the page's own solve. The interrupting medium follows the voltage class (a drawing
 * class, not a number). Breaking capacity exists in the engine only at HV (hv_switchgear_rated_ka); the LV trip-unit
 * settings only for the LV main (pro_lv_*). Spring charge, operation counter, contact wear and coil supervision are not
 * modelled (P4b-BREAKER-RELAY.md §5).
 * This file holds geometry and key names only: no digit outside the GEOMETRY and FORMATS blocks, comments and standards.
 */
(function (root) {
  'use strict';
  var R = root && root.RZConvInternals ? root.RZConvInternals : (typeof require === 'function' ? require('../internals.js') : null);
  if (!R) return;
  var NM = R.NOT_MODELLED;
  /* FORMATS BEGIN */
  var ADD_FMT = { amp: { d: 1, u: 'A' }, kw: { d: 1, u: 'kW' }, ka: { d: 2, u: 'kA' }, amp0: { d: 0, u: 'A' }, sec: { d: 2, u: 's' } };
  /* FORMATS END */
  Object.keys(ADD_FMT).forEach(function (k) { if (!R.FMT[k]) R.FMT[k] = ADD_FMT[k]; });

  /* GEOMETRY BEGIN — drawing units; the sheet is fitted to its panel, never below 0.92 x its width */
  var SHEET = { size: [600, 520], minScale: 0.92 };
  var KV = {
    hv: { medium: 'SF6 puffer chamber', std: 'IEC 62271-100', fault: 'hv_fault_level_ka', cap: 'hv_switchgear_rated_ka', tripSym: 'protectionRelay' },
    mv: { medium: 'Vacuum interrupter', std: 'IEC 62271-100', fault: 'mv_fault_level_ka', cap: null, tripSym: 'protectionRelay' },
    lv: { medium: 'Air with arc chutes', std: 'IEC 60947-2', fault: 'lv_fault_level_ka', cap: null, tripSym: 'instPanel' }
  };
  var AUX = '52a / 52b', AUX_CLOSED = '52a CLOSED · 52b OPEN', AUX_OPEN = '52a OPEN · 52b CLOSED';
  function nodes(kv) {
    return [
      { id: 'up', tag: 'FROM', sym: 'offSheet', rot: 270, x: 200, y: 36, size: 22, tagAt: 'at', tagXY: [-18, 2, 'end'], label: 'From the upstream bus or device',
        values: [{ k: 'tg', dx: 18, dy: 4, anchor: 'start', lod: 1 }] },
      { id: 'ct', tag: 'CT', sym: 'currentTransformer', x: 200, y: 112, size: 30, tagAt: 'at', tagXY: [-22, 4, 'end'], label: 'Current transformer (protection core)' },
      { id: 'mc', tag: 'MAIN CONTACTS', sym: 'cbIec', x: 200, y: 236, size: 60, tagAt: 'at', tagXY: [-40, -22, 'end'], label: 'Main contacts in the arc chamber',
        values: [{ k: 'st', dx: -40, dy: -4, anchor: 'end', lod: 1 }, { k: 'a', dx: -40, dy: 12, anchor: 'end', lod: 1 }, { k: 'md', dx: -40, dy: 28, anchor: 'end', lod: 1 }] },
      { id: 'trip', tag: kv === 'lv' ? 'TRIP UNIT' : 'RELAY', sym: KV[kv].tripSym, x: 420, y: 112, size: 32, tagAt: 'at', tagXY: [0, -24], label: kv === 'lv' ? 'Electronic trip unit' : 'Protection relay that trips this breaker',
        values: [{ k: 'tr', dx: 24, dy: 4, anchor: 'start', lod: 1 }] },
      { id: 'tc', tag: 'TRIP COIL', sym: 'contactor', x: 420, y: 206, size: 28, tagAt: 'at', tagXY: [22, 4, 'start'], label: 'Shunt trip coil' },
      { id: 'cc', tag: 'CLOSE COIL', sym: 'contactor', x: 420, y: 266, size: 28, tagAt: 'at', tagXY: [22, 4, 'start'], label: 'Closing coil' },
      { id: 'mech', tag: 'SPRING MECH', sym: 'motorIec', x: 420, y: 336, size: 32, tagAt: 'at', tagXY: [24, 4, 'start'], label: 'Stored-energy spring mechanism and its charging motor' },
      { id: 'aux', tag: AUX, sym: 'instField', x: 420, y: 410, size: 26, tagAt: 'at', tagXY: [22, 4, 'start'], label: 'Auxiliary contacts that report the position',
        values: [{ k: 'st', dx: 22, dy: 20, anchor: 'start', lod: 1 }] },
      { id: 'il', tag: 'INTERLOCK', sym: 'earthSwitch', x: 80, y: 356, size: 28, tagAt: 'at', tagXY: [0, -24], label: 'Earthing switch and disconnector interlocks',
        values: [{ k: 'il', dx: -8, dy: 34, anchor: 'start', lod: 1 }] },
      { id: 'dn', tag: 'TO', sym: 'offSheet', rot: 90, x: 200, y: 476, size: 22, tagAt: 'at', tagXY: [-18, 2, 'end'], label: 'To the load',
        values: [{ k: 'tg', dx: 18, dy: 4, anchor: 'start', lod: 1 }] }
    ];
  }
  function edges() {
    return [
      { id: 'p-up', from: 'up.port', to: [200, 97], medium: 'power', flowOf: 'p' },
      { id: 'p-ct', from: [200, 127], to: 'mc.line', medium: 'power', flowOf: 'p' },
      { id: 'p-dn', from: 'mc.load', to: 'dn.port', medium: 'power', flowOf: 'p' },
      { id: 's-ct', from: [215, 112], to: [404, 112], medium: 'line', w: 'inst' },
      { id: 's-tr', from: [420, 128], to: [420, 192], medium: 'line', w: 'inst' },
      { id: 's-tc', from: [406, 206], to: [236, 206], medium: 'line', w: 'inst' },
      { id: 's-cc', from: [406, 266], to: [236, 266], medium: 'line', w: 'inst' },
      { id: 's-me', from: [420, 320], to: [420, 280], medium: 'line', w: 'inst' },
      { id: 's-ax', from: [406, 410], to: [200, 410], via: [[200, 410]], medium: 'line', w: 'inst' },
      { id: 's-il', from: [94, 356], to: [200, 356], medium: 'line', w: 'inst' }
    ];
  }
  /* GEOMETRY END */

  function model(u, s) {
    var e = (s && s.electrical) || {}, kv = KV[u.kv] ? u.kv : 'lv', K = KV[kv], closed = u.pos === 'CLOSED', lsig = !!u.lsig;
    var il = (u.il || []).map(function (x) { return x.tag + ' ' + x.pos; });
    return {
      state: u.state, tag: u.tag, kv: kv, pos: u.pos, closed: closed, kw: u.kw, a: u.a,
      up: u.up || '—', down: u.down || '—', relay: u.relay || '—', aux: closed ? AUX_CLOSED : AUX_OPEN,
      medium: K.medium, faultKa: e[K.fault], cap: K.cap ? e[K.cap] : NM,
      ir: lsig ? e.pro_lv_ir_a : NM, isd: lsig ? e.pro_lv_isd_a : NM, tsd: lsig ? e.pro_lv_tsd_s : NM, tr: lsig ? e.pro_lv_tr_s : NM,
      tripText: kv === 'lv' ? (lsig ? 'LSIG' : 'thermal-magnetic') : (u.relay || '—'),
      il: il.length ? il.join(' · ') : 'none on this sheet',
      ilShort: (function () { var more = il.slice(); var first = more.shift(); return first ? first + (more.length ? ' +' + more.length : '') : '—'; })(),   /* the drawing names the first; the block lists all */
      spring: NM, ops: NM, wear: NM, coil: NM
    };
  }
  function nodeState(id, m) {
    if (id === 'mc' || id === 'aux') return m.closed ? (m.state === 'running' ? 'running' : 'standby') : 'stopped';
    if (id === 'ct' || id === 'trip' || id === 'tc' || id === 'cc' || id === 'mech' || id === 'il') return 'normal';
    return null;
  }
  function flow(u, k) { return k === 'p' ? (u.state === 'running' ? 'running' : u.pos === 'CLOSED' ? 'standby' : 'stopped') : 'unavailable'; }
  var E = 'electrical.';
  var NODE_VALUES = {
    up: [{ k: 'tg', key: 'up', fmt: 'text' }],
    mc: [{ k: 'st', key: 'pos', fmt: 'text' }, { k: 'a', key: 'a', fmt: 'amp' }, { k: 'md', key: 'medium', fmt: 'text' }],
    trip: [{ k: 'tr', key: 'tripText', fmt: 'text' }],
    aux: [{ k: 'st', key: 'aux', fmt: 'text' }],
    il: [{ k: 'il', key: 'ilShort', fmt: 'text' }],
    dn: [{ k: 'tg', key: 'down', fmt: 'text' }]
  };
  var BLOCKS = [
    { id: 'contacts', node: 'mc', name: 'Main contacts and arc chamber', standard: 'IEC 62271-100 · IEC 60947-2',
      role: ['Carries the load current when closed and interrupts it, fault current included, when opened.', 'The arc is drawn out and cooled in the chamber until the current passes through zero.'],
      values: [{ label: 'Position', key: 'pos', fmt: 'text', sim: true }, { label: 'Current', key: 'a', fmt: 'amp', sim: true },
        { label: 'Power', key: 'kw', fmt: 'kw', sim: true }, { label: 'Interrupting medium (typical for the voltage class)', key: 'medium', fmt: 'text' },
        { label: 'Fault level at the bus', key: 'faultKa', fmt: 'ka', basis: function (m) { return E + KV[m.kv].fault; } },
        { label: 'Breaking capacity', key: 'cap', fmt: 'ka', basis: E + 'hv_switchgear_rated_ka' }] },
    { id: 'protection', node: 'trip', name: 'Trip path', standard: 'IEC 60947-2 · IEC 60255',
      role: ['The CT feeds the trip unit or the relay; a pickup drives the trip coil.', 'On the LV main the trip unit is LSIG: long time, short time, instantaneous, ground.'],
      values: [{ label: 'Trips through (LV without LSIG: typical)', key: 'tripText', fmt: 'text' }, { label: 'Relay', key: 'relay', fmt: 'text' },
        { label: 'Long-time pickup Ir', key: 'ir', fmt: 'amp0', basis: E + 'pro_lv_ir_a' }, { label: 'Long-time delay tr', key: 'tr', fmt: 'sec', basis: E + 'pro_lv_tr_s' },
        { label: 'Short-time pickup Isd', key: 'isd', fmt: 'amp0', basis: E + 'pro_lv_isd_a' }, { label: 'Short-time delay tsd', key: 'tsd', fmt: 'sec', basis: E + 'pro_lv_tsd_s' }] },
    { id: 'mechanism', node: 'mech', name: 'Operating mechanism', standard: 'IEC 62271-100 · IEC 60947-2',
      role: ['A motor charges the closing spring; the close coil releases it, the trip coil releases the opening spring.', 'The auxiliary contacts report the position to the control system.'],
      values: [{ label: 'Spring charged', key: 'spring', fmt: 'text' }, { label: 'Trip-coil supervision', key: 'coil', fmt: 'text' },
        { label: 'Operation counter', key: 'ops', fmt: 'text' }, { label: 'Contact wear', key: 'wear', fmt: 'text' },
        { label: 'Auxiliary contacts', key: 'aux', fmt: 'text', sim: true }] },
    { id: 'interlocks', node: 'il', name: 'Interlocks', standard: 'IEC 62271-200',
      role: ['An earthing switch may close only with this breaker open, and a disconnector moves only with it open.', 'Each interlock is listed with its live position.'],
      values: [{ label: 'Interlocked devices', key: 'il', fmt: 'text', sim: true }, { label: 'From', key: 'up', fmt: 'text' }, { label: 'To', key: 'down', fmt: 'text' }] }
  ];
  var NODE_BLOCK = { ct: 'protection', tc: 'mechanism', cc: 'mechanism', aux: 'mechanism', up: 'interlocks', dn: 'interlocks' };
  function sheet(unit) {
    var tag = (unit && unit.tag) || 'CB', kv = unit && KV[unit.kv] ? unit.kv : 'lv';
    return { id: 'int-breaker', no: tag + '-INT', title: tag + ' internal — circuit breaker', rev: 'A',
      basis: 'IEC 60617 · ' + KV[kv].std, svgId: 'rz-cvm-int-svg', size: SHEET.size.slice(), minScale: SHEET.minScale,
      /* a breaker with no interlocked device on its sheet draws no interlock symbol: nothing is drawn that is not there */
      nodes: nodes(kv).filter(function (n) { return n.id !== 'il' || (unit && unit.il && unit.il.length); }),
      edges: edges().filter(function (e) { return e.id !== 's-il' || (unit && unit.il && unit.il.length); }), areas: [], notes: [] };
  }
  R.register('breaker', { title: 'Circuit breaker', sheet: sheet, model: model, nodeState: nodeState, flow: flow,
    nodeValues: NODE_VALUES, blocks: BLOCKS, nodeBlock: NODE_BLOCK, media: [['power', 'Power']], defaultBlock: 'contacts', KV: KV });
})(typeof window !== 'undefined' ? window : null);
