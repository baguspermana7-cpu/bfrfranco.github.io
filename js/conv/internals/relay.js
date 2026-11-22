/*
 * internals/relay.js — the INSIDE of one protection relay on the EPMS single-lines (PRD-CONV-EQUIPMENT-INSIDE P4b,
 * P4b-BREAKER-RELAY.md §4.2), registered as RZConvInternals class 'relay'. Drawn by js/rz-hmi-sheet.js with IEC 60617
 * symbols from js/rz-eng-symbols.js; coloured and moved only by js/conv/vfx.js.
 *
 *   CT inputs (and the VT input of a distance element 21) -> measuring element -> one block per ANSI function the
 *   relay's name lists (IEEE C37.2) -> trip logic -> trip output to the breaker it trips; a self-supervision watchdog.
 *
 * The unit comes from js/conv/epms-internals.js relayUnits(): { tag, name, fns, prot, cb, cbPos, state }. Settings
 * exist in the engine only for the graded chain (P4b-BREAKER-RELAY.md M6): the LV main LSIG (pro_lv_*), the 20 kV
 * feeder and incomer 50/51 and the 150 kV transformer bay 50/51 (pro_<feeder|incomer|hv>_*). 87L, 21, 87T, 87B, 50BF,
 * 51G and 50N/51N are drawn and their settings read "not modelled" (G5). Trip state is "normal": the simulation has no
 * protection trip, and an operator opening the breaker is not a trip.
 * This file holds geometry and key names only: no digit outside the GEOMETRY and FORMATS blocks, comments and standards.
 */
(function (root) {
  'use strict';
  var R = root && root.RZConvInternals ? root.RZConvInternals : (typeof require === 'function' ? require('../internals.js') : null);
  if (!R) return;
  var NM = R.NOT_MODELLED;
  /* FORMATS BEGIN */
  var ADD_FMT = { amp: { d: 1, u: 'A' }, sec: { d: 2, u: 's' }, sec3: { d: 3, u: 's' }, tms: { d: 2, u: '' } };
  /* FORMATS END */
  Object.keys(ADD_FMT).forEach(function (k) { if (!R.FMT[k]) R.FMT[k] = ADD_FMT[k]; });

  /* GEOMETRY BEGIN — drawing units; the sheet is fitted to its panel, never below 0.92 x its width */
  var SHEET = { size: [600, 460], minScale: 0.92 };
  var GRADED = { '50/51': 1, LSIG: 1 };   /* the functions whose settings the engine holds (by the relay's prot) */
  var FN_NAME = { '87L': 'Line differential', '21': 'Distance', '87T': 'Transformer differential', '87B': 'Busbar differential',
    '50BF': 'Breaker failure', '51G': 'Standby earth fault', '50/51': 'Phase overcurrent', '50N/51N': 'Earth overcurrent', LSIG: 'LSIG trip unit' };
  var FN_Y = [120, 220];
  function nodes(u) {
    var fns = (u && u.fns) || [], has21 = fns.indexOf('21') >= 0;
    var out = [
      { id: 'ct', tag: 'CT IN', sym: 'currentTransformer', x: 80, y: 120, size: 30, tagAt: 'at', tagXY: [0, -24], label: 'Current transformer inputs' },
      { id: 'me', tag: 'MEASURING', sym: 'instPlc', x: 220, y: 170, size: 40, tagAt: 'at', tagXY: [0, -32], label: 'Measuring element (sampling, filtering, phasors)' },
      { id: 'tl', tag: 'TRIP LOGIC', sym: 'instPlc', x: 220, y: 340, size: 36, tagAt: 'at', tagXY: [-30, 4, 'end'], label: 'Trip logic (any function picks up -> trip)',
        values: [{ k: 'st', dx: 24, dy: 24, anchor: 'start', lod: 1 }] },
      { id: 'wd', tag: 'WATCHDOG', sym: 'instField', x: 80, y: 410, size: 24, tagAt: 'at', tagXY: [0, 30], label: 'Self-supervision watchdog' },
      { id: 'out', tag: 'TRIPS', sym: 'cbIec', x: 470, y: 340, size: 40, tagAt: 'at', tagXY: [0, -32], label: 'The breaker this relay trips',
        values: [{ k: 'cb', dx: 28, dy: 0, anchor: 'start', lod: 1 }, { k: 'st', dx: 28, dy: 16, anchor: 'start', lod: 1 }] }
    ];
    if (has21) out.push({ id: 'vt', tag: 'VT IN', sym: 'voltageTransformer', x: 80, y: 220, size: 30, tagAt: 'at', tagXY: [0, 30], label: 'Voltage transformer input (distance element)' });
    fns.slice(0, FN_Y.length).forEach(function (f, i) {
      out.push({ id: 'f' + i, tag: f, sym: 'instPanel', x: 400, y: FN_Y[i], size: 32, tagAt: 'at', tagXY: [24, -6, 'start'], label: FN_NAME[f] || f,
        values: [{ k: 'set', dx: 24, dy: 12, anchor: 'start', lod: 1 }] });
    });
    return out;
  }
  function edges(u) {
    var fns = (u && u.fns) || [], out = [
      { id: 's-ct', from: [95, 120], to: [200, 160], via: [[150, 120], [150, 160]], medium: 'line', w: 'inst' },
      { id: 's-tl', from: [220, 190], to: [220, 322], medium: 'line', w: 'inst' },
      { id: 's-out', from: [238, 340], to: [450, 340], medium: 'line', w: 'inst' },
      { id: 's-wd', from: [92, 410], to: [220, 358], via: [[220, 410]], medium: 'line', w: 'inst' }
    ];
    if (fns.indexOf('21') >= 0) out.push({ id: 's-vt', from: [95, 220], to: [200, 180], via: [[150, 220], [150, 180]], medium: 'line', w: 'inst' });
    fns.slice(0, FN_Y.length).forEach(function (f, i) {
      out.push({ id: 's-f' + i, from: [240, 170], to: [384, FN_Y[i]], via: [[320, 170], [320, FN_Y[i]]], medium: 'line', w: 'inst' });
      out.push({ id: 't-f' + i, from: [400, FN_Y[i] + 16], to: [238, 334], via: [[400, 290], [260, 290], [260, 334]], medium: 'line', w: 'inst' });
    });
    return out;
  }
  /* GEOMETRY END */

  function graded(u) { return (u.fns || []).filter(function (f) { return GRADED[f]; }).shift() || null; }
  function model(u, s) {
    var e = (s && s.electrical) || {}, p = u.prot, g = graded(u), lv = p === 'lsig', on = !!(g && p);
    function k(x) { return 'pro_' + p + '_' + x; }
    var pickup = !on ? NM : lv ? e.pro_lv_ir_a : e[k('is_a')];
    var setText = on ? (lv ? 'Ir ' + R.text(e.pro_lv_ir_a, 'amp') : 'Is ' + R.text(e[k('is_a')], 'amp') + ' · ' + e[k('curve')]) : 'settings not modelled';
    var others = (u.fns || []).filter(function (f) { return !GRADED[f]; });
    return {
      state: u.state, tag: u.tag, prot: p || null, fns: (u.fns || []).join(' · '), cb: u.cb || '—', cbPos: u.cbPos || '—',
      graded: on ? g : 'none', pickup: pickup,
      /* a setting the graded element does not have reads a dash (an LSIG unit has no TMS); one it has but the engine
         does not hold reads "not modelled"; a relay with no graded element holds none of them */
      tms: !on ? NM : lv ? null : e[k('tms')], curve: !on ? NM : lv ? null : e[k('curve')], tFault: !on ? NM : lv ? null : e[k('t_s')],
      delay: !on ? NM : lv ? e.pro_lv_tr_s : null, inst: !on ? NM : p === 'feeder' ? e.pro_feeder_inst_a : null,
      ungraded: others.length ? others.join(' · ') + ': settings not modelled' : 'none',
      trip: 'normal', watchdog: NM, setText: setText, setOther: 'settings not modelled'
    };
  }
  function nodeState(id, m) {
    if (id === 'out') return m.cbPos === 'CLOSED' ? 'running' : 'stopped';
    return 'normal';
  }
  function flow() { return 'unavailable'; }
  var E = 'electrical.';
  function bk(x) { return function (m) { return m.prot && m.prot !== 'lsig' ? E + 'pro_' + m.prot + '_' + x : null; }; }
  var NODE_VALUES = { tl: [{ k: 'st', key: 'trip', fmt: 'text' }], out: [{ k: 'cb', key: 'cb', fmt: 'text' }, { k: 'st', key: 'cbPos', fmt: 'text' }],
    f0: [{ k: 'set', key: 'setText', fmt: 'text' }], f1: [{ k: 'set', key: 'setOther', fmt: 'text' }] };
  var BLOCKS = [
    { id: 'functions', node: 'f0', name: 'Protection functions', standard: 'IEEE C37.2 · IEC 60255-151',
      role: ['Each function compares what the CTs measure with its setting and picks up when it is exceeded.', 'Only the graded chain has settings in the engine; the rest are drawn and declared.'],
      values: [{ label: 'Functions', key: 'fns', fmt: 'text', sim: true }, { label: 'Graded element', key: 'graded', fmt: 'text', sim: true },
        { label: 'Pickup', key: 'pickup', fmt: 'amp', basis: function (m) { return m.prot === 'lsig' ? E + 'pro_lv_ir_a' : m.prot ? E + 'pro_' + m.prot + '_is_a' : null; } },
        { label: 'Time multiplier (TMS)', key: 'tms', fmt: 'tms', basis: bk('tms') },
        { label: 'Inverse-time curve', key: 'curve', fmt: 'text', basis: bk('curve') },
        { label: 'Operate time at the fault', key: 'tFault', fmt: 'sec3', basis: bk('t_s') },
        { label: 'Long-time delay tr', key: 'delay', fmt: 'sec', basis: function (m) { return m.prot === 'lsig' ? E + 'pro_lv_tr_s' : null; } },
        { label: 'Instantaneous pickup', key: 'inst', fmt: 'amp', basis: function (m) { return m.prot === 'feeder' ? E + 'pro_feeder_inst_a' : null; } },
        { label: 'Other functions', key: 'ungraded', fmt: 'text', sim: true }] },
    { id: 'trip', node: 'tl', name: 'Trip logic and output', standard: 'IEC 60255-1',
      role: ['Any function that operates energises the trip output, which fires the breaker\'s trip coil.', 'The simulation has no protection trip: opening the breaker by hand is not a trip.'],
      values: [{ label: 'Trip state', key: 'trip', fmt: 'text', sim: true }, { label: 'Trips breaker', key: 'cb', fmt: 'text', sim: true },
        { label: 'Breaker position', key: 'cbPos', fmt: 'text', sim: true }, { label: 'Self-supervision', key: 'watchdog', fmt: 'text' }] }
  ];
  var NODE_BLOCK = { f1: 'functions', ct: 'functions', vt: 'functions', me: 'functions', out: 'trip', wd: 'trip' };
  function sheet(unit) {
    var tag = (unit && unit.tag) || 'R';
    return { id: 'int-relay', no: tag + '-INT', title: tag + ' internal — protection relay', rev: 'A',
      basis: 'IEC 60617 · IEEE C37.2 · IEC 60255', svgId: 'rz-cvm-int-svg', size: SHEET.size.slice(), minScale: SHEET.minScale,
      nodes: nodes(unit), edges: edges(unit), areas: [], notes: [] };
  }
  R.register('relay', { title: 'Protection relay', sheet: sheet, model: model, nodeState: nodeState, flow: flow,
    nodeValues: NODE_VALUES, blocks: BLOCKS, nodeBlock: NODE_BLOCK, media: [['line', 'Signal']], defaultBlock: 'functions', FN_NAME: FN_NAME });
})(typeof window !== 'undefined' ? window : null);
