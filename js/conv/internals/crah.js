/*
 * internals/crah.js — the INSIDE of one computer-room air handler (PRD-CONV-EQUIPMENT-INSIDE §6.1, phase P3), registered
 * as RZConvInternals class 'crah'. Drawn by js/rz-hmi-sheet.js with symbols from js/rz-eng-symbols.js (ISO 10628-2 /
 * IEC 60617), coloured and moved only by js/conv/vfx.js.
 *
 *   Air:   hot-aisle return air -> filter -> chilled-water coil -> EC fans -> supply air to the cold aisle.
 *   Water: chilled-water supply -> coil -> two-way control valve -> chilled-water return.
 *   Control: the unit controller holds supply-air temperature with the valve and airflow with the fan speed.
 *
 * The unit is a row of CONV_CALC.getFleet('crah', hall). Air temperatures, chilled-water temperatures and the airflow
 * (engine 2.5.0: duty / (air density x cp x air dT)) are plant cooling values. Valve position, fan power and filter
 * pressure drop are not modelled.
 * This file holds geometry and key names only: no digit outside the GEOMETRY and FORMATS blocks, comments and standards.
 */
(function (root) {
  'use strict';
  var R = root && root.RZConvInternals ? root.RZConvInternals : (typeof require === 'function' ? require('../internals.js') : null);
  if (!R) return;
  var NM = R.NOT_MODELLED;
  /* FORMATS BEGIN */
  var ADD_FMT = { m3s: { d: 2, u: 'm³/s' } };
  /* FORMATS END */
  Object.keys(ADD_FMT).forEach(function (k) { if (!R.FMT[k]) R.FMT[k] = ADD_FMT[k]; });

  /* GEOMETRY BEGIN — drawing units; the sheet is fitted to its panel, never below 0.92 x its width */
  var SHEET = { size: [740, 460], minScale: 0.92 };
  var NODES = [
    { id: 'rt', tag: 'RETURN AIR', sym: 'instField', x: 70, y: 150, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Return-air temperature (hot aisle)',
      values: [{ k: 't', dx: 22, dy: 4, anchor: 'start', lod: 1 }] },
    { id: 'flt', tag: 'FILTER', sym: 'filterCartridge', x: 150, y: 230, size: 36, tagAt: 'at', tagXY: [0, 36], label: 'Air filter' },
    { id: 'coil', tag: 'CHW COIL', sym: 'coolingCoil', x: 280, y: 230, size: 70, tagAt: 'at', tagXY: [0, -46], label: 'Chilled-water cooling coil',
      values: [{ k: 'q', dx: 46, dy: -22, anchor: 'start', lod: 1 }, { k: 'load', dx: 46, dy: -6, anchor: 'start', lod: 1 }] },
    { id: 'fan', tag: 'EC FANS', sym: 'fanAxial', x: 440, y: 230, size: 50, tagAt: 'at', tagXY: [0, -34], label: 'Electronically commutated fans',
      values: [{ k: 'spd', dx: 0, dy: 40, anchor: 'middle', lod: 1 }, { k: 'af', dx: 0, dy: 56, anchor: 'middle', lod: 1 }] },
    { id: 'st', tag: 'SUPPLY AIR', sym: 'instField', x: 570, y: 150, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Supply-air temperature (cold aisle)',
      values: [{ k: 't', dx: 22, dy: 4, anchor: 'start', lod: 1 }] },
    { id: 'sa', tag: 'TO COLD AISLE', sym: 'offSheet', x: 690, y: 230, size: 22, tagAt: 'at', tagXY: [0, -16], label: 'Supply air to the cold aisle' },
    { id: 'cv', tag: 'CHW VALVE', sym: 'valveControlMotor', x: 430, y: 380, size: 30, tagAt: 'at', tagXY: [-22, -12, 'end'], label: 'Two-way chilled-water control valve',
      values: [{ k: 'pos', dx: 0, dy: 34, anchor: 'middle', lod: 1 }] },
    { id: 'chwr', tag: 'CHW RETURN', sym: 'offSheet', x: 690, y: 380, size: 22, tagAt: 'at', tagXY: [0, -16], label: 'Chilled-water return',
      values: [{ k: 't', dx: 0, dy: 26, anchor: 'middle', lod: 1 }] },
    { id: 'chws', tag: 'CHW SUPPLY', sym: 'instField', x: 120, y: 330, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Chilled-water supply temperature',
      values: [{ k: 't', dx: 22, dy: 4, anchor: 'start', lod: 1 }, { k: 'q', dx: 22, dy: 20, anchor: 'start', lod: 1 }] },
    { id: 'ctl', tag: 'CONTROLLER', sym: 'instPanel', x: 570, y: 330, size: 34, tagAt: 'at', tagXY: [0, -24], label: 'Unit controller',
      values: [{ k: 'mode', dx: 26, dy: 4, anchor: 'start', lod: 1 }] }
  ];
  var EDGES = [
    { id: 'a-ret', from: [30, 230], to: 'flt.inlet', medium: 'air', flowOf: 'air', line: 'RETURN AIR' },
    { id: 'a-flt', from: 'flt.outlet', to: 'coil.airIn', medium: 'air', flowOf: 'air' },
    { id: 'a-coil', from: 'coil.airOut', to: 'fan.inlet', medium: 'air', flowOf: 'air' },
    { id: 'a-sup', from: 'fan.outlet', to: 'sa.port', medium: 'air', flowOf: 'air' },
    { id: 'w-in', from: [30, 380], to: 'coil.waterIn', via: [[262.5, 380]], medium: 'chw', flowOf: 'chw', line: 'CHW SUPPLY' },
    { id: 'w-out', from: 'coil.waterOut', to: 'cv.a', via: [[297.5, 380]], medium: 'chw', flowOf: 'chw' },
    { id: 'w-ret', from: 'cv.b', to: 'chwr.port', medium: 'chw', flowOf: 'chw' },
    { id: 'i-rt', from: 'rt.process', to: [70, 230], medium: 'line', w: 'inst' },
    { id: 'i-st', from: 'st.process', to: [570, 230], medium: 'line', w: 'inst' },
    { id: 'i-chws', from: 'chws.process', to: [120, 380], medium: 'line', w: 'inst' },
    { id: 'c-cv', from: 'ctl.process', to: 'cv.signal', via: [[570, 360], [430, 360]], medium: 'line', w: 'inst' }
  ];
  /* PRD-SETPOINT-SIM P4b: with the control registry loaded the unit controller is the registry loop
     (RZControlPoints.loops('int-crah'): tag, PV node and MV node from there): the supply-air TT feeds it from the right,
     its output to the chilled-water valve becomes a signal line, SP and OUT print left of the bubble */
  function sheet(unit) {
    var tag = (unit && unit.tag) || 'CRAH', CP = root && root.RZControlPoints, L = CP && typeof CP.loops === 'function' ? CP.loops('int-crah')[0] : null;
    var nodes = NODES, edges = EDGES;
    if (L) {
      nodes = NODES.map(function (n) {
        if (n.id === 'ctl') return Object.assign({}, n, { tag: L.tag, loop: L.sp, label: L.tag + ' — ' + L.label + ' controller (' + L.action + ' acting ' + L.kind + ')',
          values: n.values.concat([{ k: 'sp', dx: -26, dy: -6, anchor: 'end', lod: 1 }, { k: 'out', dx: -26, dy: 10, anchor: 'end', lod: 1 }]) });
        return n.id === L.pv.node || n.id === L.mv.node ? Object.assign({}, n, { loop: L.sp }) : n;
      });
      edges = EDGES.map(function (e) { return e.id === 'c-cv' ? Object.assign({}, e, { w: 'signal', loop: L.sp }) : e; })
        .concat([{ id: 'l-pv', from: [585, 162], to: [587, 318], via: [[620, 162], [620, 318]], medium: 'line', w: 'signal', loop: L.sp }]);
    }
    return { id: 'int-crah', no: tag + '-INT', title: tag + ' internal — computer-room air handler', rev: 'A', basis: 'ISO 10628-2 · IEC 60617 · ASHRAE 127',
      svgId: 'rz-cvm-int-svg', size: SHEET.size.slice(), minScale: SHEET.minScale, nodes: nodes, edges: edges, areas: [], notes: [] };
  }
  /* GEOMETRY END */

  function model(u, s) {
    var c = (s && s.cooling) || {}, run = u.state === 'running';
    function only(v) { return run ? v : null; }
    return {
      state: u.state, tag: u.tag, n: u.n, running: run,
      duty: u.dutyKw, loadPct: u.loadPct, rated: u.sensibleKw, chwFlow: u.chwFlowLps, fanSpd: only(u.fanSpeedPct), fanHz: only(u.hz),
      airflow: only(c.crah_unit_airflow_m3_s), supplyT: only(c.crah_supply_air_c), returnT: only(c.crah_return_air_c),
      airDt: only(c.airside_delta_t_k), chwsT: only(c.chws_c), chwrT: only(c.chwr_c),
      mode: run ? 'RUN' : 'STANDBY',
      satSp: c.crah_supply_air_c,                     // the setpoint (registry conv.datahall.crah_supply_air_sp = this engine key)
      valveOpen: only(c.crah_valve_open_pct),         // coil flow / design coil flow: the opening the loop needs (engine 2.10.0)
      valvePos: NM, fanKw: NM, filterDp: NM
    };
  }
  function nodeState(id, m) {
    if (id === 'coil' || id === 'fan') return m.running ? 'running' : 'standby';
    if (id === 'rt' || id === 'st' || id === 'chws' || id === 'ctl') return 'normal';
    if (id === 'cv') return m.running ? 'open' : 'closed';
    return null;
  }
  function flow(u, k) {
    if (k === 'air' || k === 'chw') return u.state === 'running' ? 'running' : 'stopped';
    return 'unavailable';
  }
  var NODE_VALUES = {
    rt: [{ k: 't', key: 'returnT', fmt: 'temp' }], st: [{ k: 't', key: 'supplyT', fmt: 'temp' }],
    coil: [{ k: 'q', key: 'duty', fmt: 'kwth' }, { k: 'load', key: 'loadPct', fmt: 'pct', prefix: 'LOAD' }],
    fan: [{ k: 'spd', key: 'fanSpd', fmt: 'pct', prefix: 'SPD' }, { k: 'af', key: 'airflow', fmt: 'm3s' }],
    cv: [{ k: 'pos', key: 'valveOpen', fmt: 'pct', prefix: 'OPEN' }],
    chwr: [{ k: 't', key: 'chwrT', fmt: 'temp' }],
    chws: [{ k: 't', key: 'chwsT', fmt: 'temp' }, { k: 'q', key: 'chwFlow', fmt: 'flow' }],
    ctl: [{ k: 'mode', key: 'mode', fmt: 'text' }, { k: 'sp', key: 'satSp', fmt: 'temp', prefix: 'SP' }, { k: 'out', key: 'valveOpen', fmt: 'pct', prefix: 'OUT' }]
  };
  var C = 'cooling.';
  var BLOCKS = [
    { id: 'coil', node: 'coil', name: 'Chilled-water cooling coil', standard: 'ASHRAE 127 · ISO 10628-2',
      role: ['Takes the hall heat out of the air into the chilled water.', 'Its duty is the sensible load of its share of the hall.'],
      values: [{ label: 'Sensible duty', key: 'duty', fmt: 'kwth', basis: C + 'crah_unit_duty_kw', fleet: true },
        { label: 'Load of rating', key: 'loadPct', fmt: 'pct', basis: C + 'crah_unit_load_pct', fleet: true },
        { label: 'Rated sensible', key: 'rated', fmt: 'kwth', basis: C + 'crah_unit_sensible_kw' },
        { label: 'CHW flow', key: 'chwFlow', fmt: 'flow', basis: C + 'crah_unit_chw_flow_lps', fleet: true },
        { label: 'CHW in', key: 'chwsT', fmt: 'temp', basis: C + 'chws_c' }, { label: 'CHW out', key: 'chwrT', fmt: 'temp', basis: C + 'chwr_c' }] },
    { id: 'fans', node: 'fan', name: 'EC fans', standard: 'ISO 10628-2 · IEC 60034-30-2',
      role: ['Move the air through the filter and coil to the cold aisle.', 'Airflow = duty / (air density × cp × air ΔT).'],
      values: [{ label: 'Fan speed', key: 'fanSpd', fmt: 'pct', basis: C + 'crah_fan_speed_pct', fleet: true },
        { label: 'Frequency', key: 'fanHz', fmt: 'hz', basis: 'cooling.crah_fan_hz', fleet: true },
        { label: 'Airflow', key: 'airflow', fmt: 'm3s', basis: C + 'crah_unit_airflow_m3_s' },
        { label: 'Air ΔT', key: 'airDt', fmt: 'k', basis: C + 'airside_delta_t_k' },
        { label: 'Fan power', key: 'fanKw', fmt: 'text' }] },
    { id: 'air', node: 'st', name: 'Supply and return air', standard: 'ASHRAE TC 9.9',
      role: ['Return air comes from the hot aisle; supply air goes to the cold aisle.', 'The controller holds the supply-air temperature.'],
      values: [{ label: 'Supply air', key: 'supplyT', fmt: 'temp', basis: C + 'crah_supply_air_c' },
        { label: 'Return air', key: 'returnT', fmt: 'temp', basis: C + 'crah_return_air_c' }] },
    { id: 'valve', node: 'cv', name: 'Two-way chilled-water valve', standard: 'ISO 10628-2 · ISA-5.1',
      role: ['Throttles the chilled water to hold supply-air temperature.', 'Its position is not modelled.'],
      values: [{ label: 'Position', key: 'valvePos', fmt: 'text' }, { label: 'Opening (coil flow / design flow)', key: 'valveOpen', fmt: 'pct', basis: C + 'crah_valve_open_pct' }] },
    { id: 'filter', node: 'flt', name: 'Air filter', standard: 'ISO 16890',
      role: ['Keeps dust off the coil and out of the hall.', 'A rising pressure drop calls for a change.'],
      values: [{ label: 'Pressure drop', key: 'filterDp', fmt: 'text' }] },
    { id: 'controller', node: 'ctl', name: 'Unit controller', standard: 'ISA-5.1',
      role: ['Runs the unit, holds supply air and airflow.', 'Hands over to the standby unit on a fault.'],
      values: [{ label: 'Mode', key: 'mode', fmt: 'text' }] }
  ];
  var NODE_BLOCK = { rt: 'air', sa: 'air', chws: 'coil', chwr: 'coil' };
  var MEDIA = [['air', 'Air'], ['chw', 'Chilled water']];

  R.register('crah', { title: 'Computer-room air handler', sheet: sheet, model: model, nodeState: nodeState, flow: flow,
    nodeValues: NODE_VALUES, blocks: BLOCKS, nodeBlock: NODE_BLOCK, media: MEDIA, defaultBlock: 'coil' });
})(typeof window !== 'undefined' ? window : null);
