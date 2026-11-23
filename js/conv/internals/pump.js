/*
 * internals/pump.js — the INSIDE of one water pump set (PRD-CONV-EQUIPMENT-INSIDE §6.1, phase P3), registered as
 * RZConvInternals classes 'cdw_pump', 'chw_primary_pump' and 'chw_secondary_pump' (one drawing, three engine families).
 * Drawn by js/rz-hmi-sheet.js with symbols from js/rz-eng-symbols.js (ISO 10628-2 / IEC 60617), coloured and moved only
 * by js/conv/vfx.js.
 *
 *   Water: header -> suction isolation valve -> Y-strainer -> centrifugal pump -> check valve -> discharge isolation
 *          valve -> header; a pressure indicator each side.
 *   Drive: VFD -> induction motor -> flexible coupling -> pump shaft (mechanical seal, bearings).
 *
 * The unit is a row of CONV_CALC.getFleet(kind) (flow, kW_e, speed, head). Hydraulic power, shaft power and the
 * differential pressure are engine 2.5.0 keys (cooling.<kind>_hydraulic_kw / _shaft_kw / _dp_kpa). Absolute suction and
 * discharge pressures, seal, bearing and vibration readings are not modelled.
 * This file holds geometry and key names only: no digit outside the GEOMETRY and FORMATS blocks, comments and standards.
 */
(function (root) {
  'use strict';
  var R = root && root.RZConvInternals ? root.RZConvInternals : (typeof require === 'function' ? require('../internals.js') : null);
  if (!R) return;
  var NM = R.NOT_MODELLED;
  /* FORMATS BEGIN */
  var ADD_FMT = { kpad: { d: 1, u: 'kPa' }, metre: { d: 1, u: 'm' }, kwm: { d: 1, u: 'kW' } };
  /* FORMATS END */
  Object.keys(ADD_FMT).forEach(function (k) { if (!R.FMT[k]) R.FMT[k] = ADD_FMT[k]; });

  /* GEOMETRY BEGIN — drawing units; the sheet is fitted to its panel, never below 0.92 x its width */
  var SHEET = { size: [740, 460], minScale: 0.92 };
  var NODES = [
    { id: 'iv1', tag: 'SUCTION IV', sym: 'valveButterfly', x: 110, y: 230, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Suction isolation valve (butterfly)',
      values: [{ k: 'st', dx: 0, dy: 34, anchor: 'middle', lod: 1 }] },
    { id: 'str', tag: 'STRAINER', sym: 'strainerY', x: 190, y: 230, size: 34, tagAt: 'at', tagXY: [0, 36], label: 'Y-strainer' },
    { id: 'pi1', tag: 'PI SUCTION', sym: 'instField', x: 250, y: 140, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Suction pressure indicator',
      values: [{ k: 'p', dx: 22, dy: 4, anchor: 'start', lod: 1 }] },
    { id: 'pmp', tag: 'PUMP', sym: 'pumpCentrifugal', x: 330, y: 230, size: 60, tagAt: 'at', tagXY: [0, -40], label: 'End-suction centrifugal pump: impeller, volute, mechanical seal, bearings',
      values: [{ k: 'q', dx: 0, dy: 48, anchor: 'middle', lod: 1 }, { k: 'h', dx: 0, dy: 64, anchor: 'middle', lod: 1 }] },
    { id: 'ck', tag: 'CHECK', sym: 'valveCheck', x: 440, y: 230, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Discharge check valve',
      values: [{ k: 'st', dx: 0, dy: 34, anchor: 'middle', lod: 1 }] },
    { id: 'pi2', tag: 'PI DISCHARGE', sym: 'instField', x: 510, y: 140, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Discharge pressure indicator',
      values: [{ k: 'dp', dx: 22, dy: 4, anchor: 'start', lod: 1 }] },
    { id: 'iv2', tag: 'DISCH IV', sym: 'valveButterfly', x: 580, y: 230, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Discharge isolation valve (butterfly)',
      values: [{ k: 'st', dx: 0, dy: 34, anchor: 'middle', lod: 1 }] },
    { id: 'mot', tag: 'MOTOR', sym: 'motorIec', x: 430, y: 360, size: 50, tagAt: 'at', tagXY: [0, 40], label: 'Induction motor, flexible coupling to the pump shaft',
      values: [{ k: 'kw', dx: 34, dy: -22, anchor: 'start', lod: 1 }] },
    { id: 'vfd', tag: 'VFD', sym: 'vfdDrive', x: 570, y: 360, size: 50, tagAt: 'at', tagXY: [0, 40], label: 'Variable-frequency drive',
      values: [{ k: 'spd', dx: 0, dy: 58, anchor: 'middle', lod: 1 }] },
    { id: 'mcc', tag: 'MCC', sym: 'offSheet', x: 690, y: 360, size: 22, tagAt: 'at', tagXY: [0, -16], label: 'From the motor control centre' },
    { id: 'hdr', tag: 'TO HEADER', sym: 'offSheet', x: 690, y: 230, size: 22, tagAt: 'at', tagXY: [0, -16], label: 'To the discharge header' }
  ];
  function edges(m) {
    return [
      { id: 'w-in', from: [30, 230], to: 'iv1.a', medium: m, flowOf: 'w', line: 'FROM HEADER' },
      { id: 'w-iv1', from: 'iv1.b', to: 'str.inlet', medium: m, flowOf: 'w' },
      { id: 'w-str', from: 'str.outlet', to: 'pmp.suction', medium: m, flowOf: 'w' },
      { id: 'w-pmp', from: 'pmp.discharge', to: 'ck.inlet', medium: m, flowOf: 'w' },
      { id: 'w-ck', from: 'ck.outlet', to: 'iv2.a', medium: m, flowOf: 'w' },
      { id: 'w-out', from: 'iv2.b', to: 'hdr.port', medium: m, flowOf: 'w' },
      { id: 'i-pi1', from: 'pi1.process', to: [250, 230], medium: 'line', w: 'inst' },
      { id: 'i-pi2', from: 'pi2.process', to: [510, 230], medium: 'line', w: 'inst' },
      { id: 'e-shaft', from: [330, 260], to: 'mot.shaft', via: [[330, 360]], medium: 'line', w: 'inst' },
      { id: 'e-mot', from: 'mot.power', to: 'vfd.load', medium: 'line' },
      { id: 'e-vfd', from: 'vfd.line', to: 'mcc.port', medium: 'line' }
    ];
  }
  /* GEOMETRY END */

  /* per engine family: the medium of its water and the key stems of its engine values */
  var KINDS = {
    cdw_pump: { title: 'Condenser-water pump', medium: 'cw', water: 'Condenser water', stem: 'cdw_pump_', speedKey: 'cooling.cdw_pump_speed_pct', ctrl: { label: 'Static lift (open tower circuit)', fmt: 'metre', key: 'cdw_static_head_m', basis: 'cooling.cdw_static_head_m' }, hzKey: 'cooling.cdw_pump_hz', head: 'cdw_head_m', no: 'CDW pump' },
    chw_primary_pump: { title: 'Primary chilled-water pump', medium: 'chw', water: 'Chilled water', stem: 'chw_primary_pump_', speedKey: 'cooling.chw_primary_pump_speed_pct', hzKey: 'cooling.chw_primary_pump_hz', head: 'chw_primary_head_m', no: 'Primary CHW pump' },
    chw_secondary_pump: { title: 'Secondary chilled-water pump', medium: 'chw', water: 'Chilled water', stem: 'chw_secondary_pump_', speedKey: 'cooling.chw_secondary_pump_speed_pct', ctrl: { label: 'Loop DP setpoint', fmt: 'kpad', key: 'chw_secondary_dp_setpoint_kpa', basis: 'cooling.chw_secondary_dp_setpoint_kpa' }, hzKey: 'cooling.chw_secondary_pump_hz', head: 'chw_secondary_head_m', no: 'Secondary CHW pump' }
  };

  function make(kind) {
    var K = KINDS[kind], C = 'cooling.';
    function sheet(unit) {
      var tag = (unit && unit.tag) || 'PUMP';
      return { id: 'int-' + kind, no: tag + '-INT', title: tag + ' internal — ' + K.title.toLowerCase(), rev: 'A', basis: 'ISO 10628-2 · IEC 60617 · ISO 9906',
        svgId: 'rz-cvm-int-svg', size: SHEET.size.slice(), minScale: SHEET.minScale, nodes: NODES, edges: edges(K.medium), areas: [], notes: [] };
    }
    function model(u, s) {
      var c = (s && s.cooling) || {}, run = u.state === 'running';
      function only(v) { return run ? v : null; }
      return {
        state: u.state, tag: u.tag, n: u.n, running: run,
        flow: u.flowLps, kwE: u.kwE, speedPct: u.speedPct, hz: u.hz, headM: only(u.headOpM), headD: u.headM,
        dpKpa: only(c[K.stem + 'dp_op_kpa']), dpD: c[K.stem + 'dp_kpa'], hydKw: only(c[K.stem + 'hydraulic_kw']), shaftKw: only(c[K.stem + 'shaft_kw']),
        minSpd: c.pump_min_speed_pct, shutoff: c.pump_shutoff_head_ratio, ctrl: K.ctrl ? c[K.ctrl.key] : null,
        eff: c.pump_efficiency, motorEff: c.pump_motor_efficiency, vfdEff: c.pump_vfd_efficiency,
        iv: 'OPEN', check: run ? 'OPEN' : 'CLOSED',
        suctionP: NM, sealLeak: NM, bearingT: NM, vibration: NM
      };
    }
    function nodeState(id, m) {
      if (id === 'iv1' || id === 'iv2') return 'open';
      if (id === 'ck') return m.running ? 'open' : 'closed';
      if (id === 'pi1' || id === 'pi2') return 'normal';
      if (id === 'pmp' || id === 'mot' || id === 'vfd') return m.running ? 'running' : 'standby';
      return null;
    }
    function flow(u, k) { return k === 'w' ? (u.state === 'running' ? 'running' : 'stopped') : 'unavailable'; }
    var NODE_VALUES = {
      iv1: [{ k: 'st', key: 'iv', fmt: 'text' }], iv2: [{ k: 'st', key: 'iv', fmt: 'text' }], ck: [{ k: 'st', key: 'check', fmt: 'text' }],
      pi1: [{ k: 'p', key: 'suctionP', fmt: 'text', prefix: 'P' }],
      pi2: [{ k: 'dp', key: 'dpKpa', fmt: 'kpad', prefix: 'ΔP' }],
      pmp: [{ k: 'q', key: 'flow', fmt: 'flow' }, { k: 'h', key: 'headM', fmt: 'metre', prefix: 'HEAD' }],
      mot: [{ k: 'kw', key: 'kwE', fmt: 'kwe' }],
      vfd: [{ k: 'spd', key: 'speedPct', fmt: 'pct', prefix: 'SPD' }]
    };
    var BLOCKS = [
      { id: 'pump', node: 'pmp', name: 'Centrifugal pump — impeller and volute', standard: 'ISO 9906 · ISO 10628-2',
        role: ['The impeller adds head to the ' + K.water.toLowerCase() + ' at the flow the loop asks for: the loop\'s system curve at that flow, below the design head at part flow.', 'Hydraulic power is flow × that head; the rest of the shaft power is lost in the pump.'],
        values: [{ label: 'Flow', key: 'flow', fmt: 'flow', basis: C + K.stem + 'flow_lps', fleet: true },
          { label: 'Head', key: 'headM', fmt: 'metre', basis: C + K.stem + 'head_op_m' },
          { label: 'Differential pressure', key: 'dpKpa', fmt: 'kpad', basis: C + K.stem + 'dp_op_kpa' },
          { label: 'Design head', key: 'headD', fmt: 'metre', basis: C + K.head },
          { label: 'Design differential pressure', key: 'dpD', fmt: 'kpad', basis: C + K.stem + 'dp_kpa' },
          { label: 'Hydraulic power', key: 'hydKw', fmt: 'kwm', basis: C + K.stem + 'hydraulic_kw' },
          { label: 'Shaft power', key: 'shaftKw', fmt: 'kwm', basis: C + K.stem + 'shaft_kw' },
          { label: 'Pump efficiency', key: 'eff', fmt: 'frac', basis: C + 'pump_efficiency' },
          { label: 'Seal leakage', key: 'sealLeak', fmt: 'text' }, { label: 'Bearing temperature', key: 'bearingT', fmt: 'text' },
          { label: 'Vibration', key: 'vibration', fmt: 'text' }] },
      { id: 'motor', node: 'mot', name: 'Induction motor and coupling', standard: 'IEC 60034-30-1 · IEC 60617-6',
        role: ['Turns the pump through a flexible coupling.', 'Its input is the shaft power over motor and drive efficiency.'],
        values: [{ label: 'Electrical input', key: 'kwE', fmt: 'kwe', basis: C + K.stem + 'kw_e', fleet: true },
          { label: 'Motor efficiency', key: 'motorEff', fmt: 'frac', basis: C + 'pump_motor_efficiency' }] },
      { id: 'vfd', node: 'vfd', name: 'Variable-frequency drive', standard: 'IEC 61800-9-2',
        role: ['Sets the motor speed, so the pump makes only the head the loop needs.', 'Its speed is where the pump curve meets the loop\'s system curve.'],
        values: [{ label: 'Speed', key: 'speedPct', fmt: 'pct', basis: K.speedKey, fleet: true },
          { label: 'Frequency', key: 'hz', fmt: 'hz', basis: K.hzKey, fleet: true },
          { label: 'Minimum speed', key: 'minSpd', fmt: 'pct', basis: 'cooling.pump_min_speed_pct' },
          { label: 'Shut-off head / design head', key: 'shutoff', fmt: 'ratio', basis: 'cooling.pump_shutoff_head_ratio' }]
          .concat(K.ctrl ? [{ label: K.ctrl.label, key: 'ctrl', fmt: K.ctrl.fmt, basis: K.ctrl.basis }] : [])
          .concat([{ label: 'Drive efficiency', key: 'vfdEff', fmt: 'frac', basis: C + 'pump_vfd_efficiency' }]) },
      { id: 'check', node: 'ck', name: 'Discharge check valve', standard: 'ISO 10628-2',
        role: ['Stops reverse flow through a pump that is stopped.', 'Open while the pump runs.'],
        values: [{ label: 'Position', key: 'check', fmt: 'text' }] },
      { id: 'isolation', node: 'iv1', name: 'Isolation valves', standard: 'ISO 10628-2',
        role: ['Isolate the pump for maintenance.', 'Open in service, standby included.'],
        values: [{ label: 'Position', key: 'iv', fmt: 'text' }] },
      { id: 'strainer', node: 'str', name: 'Y-strainer', standard: 'ISO 10628-2',
        role: ['Keeps debris out of the impeller.', 'A rising pressure drop calls for cleaning.'],
        values: [{ label: 'Suction pressure', key: 'suctionP', fmt: 'text' }] },
      { id: 'gauges', node: 'pi2', name: 'Pressure indicators', standard: 'ISA-5.1',
        role: ['Show suction and discharge pressure; their difference is the pump head.', 'Only the difference is modelled.'],
        values: [{ label: 'Differential pressure', key: 'dpKpa', fmt: 'kpad', basis: C + K.stem + 'dp_op_kpa' },
          { label: 'Suction pressure', key: 'suctionP', fmt: 'text' }] }
    ];
    var NODE_BLOCK = { iv2: 'isolation', pi1: 'gauges', mcc: 'vfd', hdr: 'isolation' };
    return { title: K.title, sheet: sheet, model: model, nodeState: nodeState, flow: flow,
      nodeValues: NODE_VALUES, blocks: BLOCKS, nodeBlock: NODE_BLOCK, media: [[K.medium, K.water]], defaultBlock: 'pump' };
  }
  Object.keys(KINDS).forEach(function (k) { R.register(k, make(k)); });
})(typeof window !== 'undefined' ? window : null);
