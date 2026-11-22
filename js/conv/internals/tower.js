/*
 * internals/tower.js — the INSIDE of one induced-draft cooling-tower cell (PRD-CONV-EQUIPMENT-INSIDE §6.1, phase P3),
 * registered as RZConvInternals class 'tower_cell'. Drawn by js/rz-hmi-sheet.js with symbols from js/rz-eng-symbols.js
 * (ISO 10628-2 / IEC 60617), coloured and moved only by js/conv/vfx.js.
 *
 *   Water: condenser-water return from the chillers -> hot-water distribution over the fill -> cold-water basin ->
 *          condenser-water pumps; make-up water in through its valve, blowdown out through its valve.
 *   Air:   ambient air through the fill (counterflow) -> drift eliminators -> fan -> discharge.
 *   Drive: VFD -> fan motor -> gearbox -> fan.
 *
 * The unit is a row of CONV_CALC.getFleet('tower_cell'). Range, approach, wet bulb and the water temperatures are plant
 * cooling values. Make-up, blowdown and evaporation are NOT drawn per cell: the engine's water balance is set from the
 * site WUE, not from the heat each cell rejects, so a per-cell share of it would not belong to this cell (PRD §6.1 note).
 * This file holds geometry and key names only: no digit outside the GEOMETRY block, comments and standards text.
 */
(function (root) {
  'use strict';
  var R = root && root.RZConvInternals ? root.RZConvInternals : (typeof require === 'function' ? require('../internals.js') : null);
  if (!R) return;
  var NM = R.NOT_MODELLED;
  /* FORMATS BEGIN */
  var ADD_FMT = { kwm: { d: 1, u: 'kW' } };
  /* FORMATS END */
  Object.keys(ADD_FMT).forEach(function (k) { if (!R.FMT[k]) R.FMT[k] = ADD_FMT[k]; });

  /* GEOMETRY BEGIN — drawing units; the sheet is fitted to its panel, never below 0.92 x its width */
  var SHEET = { size: [740, 460], minScale: 0.92 };
  var NODES = [
    { id: 'cell', tag: 'FILL + BASIN', sym: 'coolingTowerCell', x: 330, y: 250, size: 140, tagAt: 'at', tagXY: [-82, -48, 'end'], label: 'Counterflow fill, drift eliminators, hot-water distribution and cold-water basin',
      values: [{ k: 'q', dx: -82, dy: -30, anchor: 'end', lod: 1 }, { k: 'load', dx: -82, dy: -14, anchor: 'end', lod: 1 }, { k: 'rng', dx: -82, dy: 2, anchor: 'end', lod: 1 }, { k: 'app', dx: -82, dy: 18, anchor: 'end', lod: 1 }] },
    { id: 'fan', tag: 'FAN', sym: 'fanAxial', x: 330, y: 110, size: 50, tagAt: 'at', tagXY: [0, -32], label: 'Axial fan with gearbox',
      values: [{ k: 'spd', dx: -34, dy: 4, anchor: 'end', lod: 1 }] },
    { id: 'fmot', tag: 'FAN MOTOR', sym: 'motorIec', x: 460, y: 110, size: 40, tagAt: 'at', tagXY: [0, -28], label: 'Fan motor',
      values: [{ k: 'kw', dx: 0, dy: 36, anchor: 'middle', lod: 1 }] },
    { id: 'fvfd', tag: 'FAN VFD', sym: 'vfdDrive', x: 570, y: 110, size: 40, tagAt: 'at', tagXY: [0, -28], label: 'Fan variable-frequency drive',
      values: [{ k: 'spd', dx: 0, dy: 36, anchor: 'middle', lod: 1 }] },
    { id: 'mcc', tag: 'MCC', sym: 'offSheet', x: 690, y: 110, size: 22, tagAt: 'at', tagXY: [0, -16], label: 'From the motor control centre' },
    { id: 'wb', tag: 'WET BULB', sym: 'instField', x: 140, y: 130, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Ambient wet-bulb (design)',
      values: [{ k: 't', dx: 22, dy: 4, anchor: 'start', lod: 1 }] },
    { id: 'hot', tag: 'FROM CHILLERS', sym: 'offSheet', x: 690, y: 215, size: 22, tagAt: 'at', tagXY: [0, -16], label: 'Condenser-water return from the chillers',
      values: [{ k: 't', dx: 0, dy: 26, anchor: 'middle', lod: 1 }] },
    { id: 'sup', tag: 'TO CDW PUMPS', sym: 'offSheet', x: 690, y: 285, size: 22, tagAt: 'at', tagXY: [0, -16], label: 'Condenser-water supply to the pumps',
      values: [{ k: 't', dx: 0, dy: 34, anchor: 'middle', lod: 1 }] },
    { id: 'mu', tag: 'MAKE-UP', sym: 'valveControlMotor', x: 160, y: 345, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Make-up water valve (basin level)',
      values: [{ k: 'q', dx: 0, dy: 34, anchor: 'middle', lod: 1 }] },
    { id: 'bd', tag: 'BLOWDOWN', sym: 'valveControlMotor', x: 450, y: 390, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Blowdown valve (conductivity)',
      values: [{ k: 'q', dx: 0, dy: 34, anchor: 'middle', lod: 1 }] },
    { id: 'drn', tag: 'DRAIN', sym: 'offSheet', x: 690, y: 390, size: 22, tagAt: 'at', tagXY: [0, -16], label: 'To drain' }
  ];
  var EDGES = [
    { id: 'w-hot', from: 'hot.port', to: 'cell.hotIn', medium: 'cw', flowOf: 'w' },
    { id: 'w-sup', from: 'cell.basinOut', to: 'sup.port', medium: 'cw', flowOf: 'w' },
    { id: 'm-in', from: [40, 345], to: 'mu.a', medium: 'pw', flowOf: 'mu', line: 'MAKE-UP' },
    { id: 'm-cell', from: 'mu.b', to: 'cell.makeup', via: [[230, 345], [230, 285]], medium: 'pw', flowOf: 'mu' },
    { id: 'b-out', from: 'cell.blowdown', to: 'bd.a', via: [[330, 390]], medium: 'dr', flowOf: 'bd' },
    { id: 'b-drn', from: 'bd.b', to: 'drn.port', medium: 'dr', flowOf: 'bd' },
    { id: 'a-up', from: [330, 180], to: [330, 135], medium: 'air', flowOf: 'air' },
    { id: 'e-shaft', from: [355, 110], to: 'fmot.shaft', medium: 'line', w: 'inst' },
    { id: 'e-mot', from: 'fmot.power', to: 'fvfd.load', medium: 'line' },
    { id: 'e-vfd', from: 'fvfd.line', to: 'mcc.port', medium: 'line' }
  ];
  function sheet(unit) {
    var tag = (unit && unit.tag) || 'CT';
    return { id: 'int-tower-cell', no: tag + '-INT', title: tag + ' internal — cooling-tower cell', rev: 'A', basis: 'ISO 10628-2 · IEC 60617 · CTI ATC-105',
      svgId: 'rz-cvm-int-svg', size: SHEET.size.slice(), minScale: SHEET.minScale, nodes: NODES, edges: EDGES, areas: [], notes: [] };
  }
  /* GEOMETRY END */

  function model(u, s) {
    var c = (s && s.cooling) || {}, run = u.state === 'running';
    function only(v) { return run ? v : null; }
    return {
      state: u.state, tag: u.tag, n: u.n, running: run,
      rej: u.rejectionKwTh, rated: u.ratedKwTh, loadPct: u.loadPct, flow: u.cdwFlowLps,
      hotT: only(c.cdw_return_c), coldT: only(c.cdw_supply_c), range: only(c.cdw_range_k), approach: only(c.tower_approach_k),
      wb: c.tower_design_wet_bulb_c, fanSpd: only(u.fanSpeedPct), fanKw: u.fanKw, fanRated: u.fanMotorKw, fanVib: NM,
      makeup: NM, blowdown: NM, evaporation: NM, basinLevel: NM
    };
  }
  function nodeState(id, m) {
    if (id === 'cell' || id === 'fan' || id === 'fmot' || id === 'fvfd') return m.running ? 'running' : 'standby';
    if (id === 'wb') return 'normal';
    return null;
  }
  function flow(u, k) {
    if (k === 'w' || k === 'air') return u.state === 'running' ? 'running' : 'stopped';
    return 'unavailable';                                     // make-up and blowdown flows are not modelled per cell
  }
  var NODE_VALUES = {
    cell: [{ k: 'q', key: 'rej', fmt: 'kwth' }, { k: 'load', key: 'loadPct', fmt: 'pct', prefix: 'LOAD' }, { k: 'rng', key: 'range', fmt: 'k', prefix: 'RANGE' },
      { k: 'app', key: 'approach', fmt: 'k', prefix: 'APPROACH' }],
    fan: [{ k: 'spd', key: 'fanSpd', fmt: 'pct', prefix: 'SPD' }],
    fmot: [{ k: 'kw', key: 'fanKw', fmt: 'kwe' }],
    fvfd: [{ k: 'spd', key: 'fanSpd', fmt: 'pct', prefix: 'SPD' }],
    wb: [{ k: 't', key: 'wb', fmt: 'temp', prefix: 'WB' }],
    hot: [{ k: 't', key: 'hotT', fmt: 'temp' }], sup: [{ k: 't', key: 'coldT', fmt: 'temp' }],
    mu: [{ k: 'q', key: 'makeup', fmt: 'text' }], bd: [{ k: 'q', key: 'blowdown', fmt: 'text' }]
  };
  var C = 'cooling.';
  var BLOCKS = [
    { id: 'fill', node: 'cell', name: 'Fill, distribution and basin', standard: 'CTI ATC-105 · ISO 10628-2',
      role: ['Spreads the hot condenser water over the fill, where air takes its heat by evaporation.', 'The cooled water collects in the basin; it can only approach the wet-bulb temperature.'],
      values: [{ label: 'Heat rejected', key: 'rej', fmt: 'kwth', basis: C + 'tower_cell_rejection_kw_th', fleet: true },
        { label: 'Rated', key: 'rated', fmt: 'kwth', basis: C + 'tower_cell_rated_kw_th' },
        { label: 'Load', key: 'loadPct', fmt: 'pct', basis: C + 'tower_cell_load_pct', fleet: true },
        { label: 'Condenser-water flow', key: 'flow', fmt: 'flow', basis: C + 'chiller_unit_cdw_flow_lps', fleet: true },
        { label: 'Hot water in', key: 'hotT', fmt: 'temp', basis: C + 'cdw_return_c' },
        { label: 'Cold water out', key: 'coldT', fmt: 'temp', basis: C + 'cdw_supply_c' },
        { label: 'Range', key: 'range', fmt: 'k', basis: C + 'cdw_range_k' },
        { label: 'Approach', key: 'approach', fmt: 'k', basis: C + 'tower_approach_k' },
        { label: 'Evaporation', key: 'evaporation', fmt: 'text' }, { label: 'Basin level', key: 'basinLevel', fmt: 'text' }] },
    { id: 'fan', node: 'fan', name: 'Axial fan and gearbox', standard: 'ISO 10628-2',
      role: ['Draws air up through the fill.', 'Fan power goes with the cube of its speed; the speed follows the cell load.'],
      values: [{ label: 'Fan speed', key: 'fanSpd', fmt: 'pct', basis: C + 'tower_fan_speed_pct', fleet: true },
        { label: 'Fan power', key: 'fanKw', fmt: 'kwe', basis: C + 'tower_fan_kw', fleet: true },
        { label: 'Motor rating', key: 'fanRated', fmt: 'kwm', basis: C + 'tower_fan_motor_kw' },
        { label: 'Fan vibration', key: 'fanVib', fmt: 'text' }] },
    { id: 'drive', node: 'fvfd', name: 'Fan motor and VFD', standard: 'IEC 61800-9-2 · IEC 60034-30-1',
      role: ['Sets the fan speed from the condenser-water supply temperature.', 'At the design point the speed equals the cell load.'],
      values: [{ label: 'Speed', key: 'fanSpd', fmt: 'pct', basis: C + 'tower_fan_speed_pct', fleet: true },
        { label: 'Input', key: 'fanKw', fmt: 'kwe', basis: C + 'tower_fan_kw', fleet: true }] },
    { id: 'wet-bulb', node: 'wb', name: 'Ambient wet bulb', standard: 'ASHRAE Fundamentals ch. 1',
      role: ['The lowest temperature evaporation can cool the water to.', 'Approach = cold water − wet bulb.'],
      values: [{ label: 'Design wet bulb', key: 'wb', fmt: 'temp', basis: C + 'tower_design_wet_bulb_c' }] },
    { id: 'make-up', node: 'mu', name: 'Make-up valve', standard: 'ISO 10628-2',
      role: ['Replaces the water lost to evaporation, drift and blowdown.', 'Opens on basin level.'],
      values: [{ label: 'Make-up flow', key: 'makeup', fmt: 'text' }] },
    { id: 'blowdown', node: 'bd', name: 'Blowdown valve', standard: 'ISO 10628-2',
      role: ['Bleeds basin water to hold dissolved solids at the set cycles of concentration.', 'Opens on conductivity.'],
      values: [{ label: 'Blowdown flow', key: 'blowdown', fmt: 'text' }] }
  ];
  var NODE_BLOCK = { fmot: 'drive', mcc: 'drive', hot: 'fill', sup: 'fill', drn: 'blowdown' };
  var MEDIA = [['cw', 'Condenser water'], ['air', 'Air'], ['pw', 'Make-up water'], ['dr', 'Blowdown']];

  R.register('tower_cell', { title: 'Cooling-tower cell', sheet: sheet, model: model, nodeState: nodeState, flow: flow,
    nodeValues: NODE_VALUES, blocks: BLOCKS, nodeBlock: NODE_BLOCK, media: MEDIA, defaultBlock: 'fill' });
})(typeof window !== 'undefined' ? window : null);
