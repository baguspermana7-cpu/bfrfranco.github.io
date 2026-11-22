/*
 * internals/chiller.js — the INSIDE of one water-cooled centrifugal chiller (PRD-CONV-EQUIPMENT-TRUTH §5.1, phase E2),
 * registered as RZConvInternals class 'chiller'. Drawn by js/rz-hmi-sheet.js with symbols from js/rz-eng-symbols.js
 * (ISO 10628-2 / ISO 14617 / IEC 60617), coloured and moved only by js/conv/vfx.js.
 *
 * Refrigerant circuit (R-134a, the engine's chiller_refrigerant):
 *   evaporator (flooded shell-and-tube, refrigerant in the shell, chilled water in the tubes)
 *     -> low-pressure vapour -> inlet guide vanes -> two-stage centrifugal compressor (motor on the shaft, VFD feeding it)
 *     -> high-pressure vapour -> condenser (shell-and-tube, condenser water in the tubes)
 *     -> liquid -> economiser / flash tank -> flash gas back to the compressor interstage
 *     -> liquid -> electronic expansion valve -> evaporator.
 *   Hot-gas bypass: discharge -> HGBV -> evaporator inlet. Oil: sump -> gear pump -> oil cooler -> bearings -> sump.
 *   Purge unit on the condenser vapour space; relief valve on the evaporator shell.
 *
 * Every number on the drawing is an engine 2.4.0 value for the SELECTED unit (CONV_CALC.getFleet('chiller')[n]) or
 * a plant cooling key that holds for every running unit (CONV_CALC.snapshot.cooling); formulas are in model().
 * This file holds geometry and engine-key names only: tools/test-conv-internals-core.mjs strips the GEOMETRY block,
 * comments and the standards text and fails on any digit left.
 */
(function (root) {
  'use strict';
  var R = root && root.RZConvInternals ? root.RZConvInternals : (typeof require === 'function' ? require('../internals.js') : null);
  if (!R) return;
  var NM = R.NOT_MODELLED;

  /* GEOMETRY BEGIN — drawing units; the sheet is fitted to its panel, never below 0.92 x its width */
  var SHEET = { size: [740, 600], minScale: 0.92 };
  var NODES = [
    /* shells */
    { id: 'cond', tag: 'CONDENSER', sym: 'hxShellTube', x: 300, y: 150, size: 120, tagAt: 'at', tagXY: [-22, -38, 'end'], label: 'Condenser — shell-and-tube, condenser water in the tubes',
      values: [{ k: 'duty', dx: 30, dy: 52, anchor: 'start', lod: 1 }, { k: 'sat', dx: 30, dy: 68, anchor: 'start', lod: 1 }, { k: 'p', dx: 30, dy: 84, anchor: 'start', lod: 1 }, { k: 'sc', dx: 30, dy: 100, anchor: 'start', lod: 1 }] },
    { id: 'evap', tag: 'EVAPORATOR', sym: 'hxShellTube', x: 300, y: 450, size: 120, tagAt: 'at', tagXY: [-22, 64, 'end'], label: 'Evaporator — flooded shell-and-tube, chilled water in the tubes',
      values: [{ k: 'duty', dx: 30, dy: 64, anchor: 'start', lod: 1 }, { k: 'sat', dx: 30, dy: 80, anchor: 'start', lod: 1 }, { k: 'p', dx: 30, dy: 96, anchor: 'start', lod: 1 }, { k: 'sh', dx: 30, dy: 112, anchor: 'start', lod: 1 }] },
    /* water nozzles */
    { id: 'cdws', tag: 'CDWS IN', sym: 'offSheet', x: 196, y: 150, size: 20, rot: 180, tagAt: 'at', tagXY: [0, -16], label: 'Condenser water supply — inlet nozzle',
      values: [{ k: 't', dx: 0, dy: 26, lod: 1 }, { k: 'q', dx: 0, dy: 42, lod: 1 }] },
    { id: 'cdwr', tag: 'CDWR OUT', sym: 'offSheet', x: 404, y: 150, size: 20, tagAt: 'at', tagXY: [0, -16], label: 'Condenser water return — outlet nozzle',
      values: [{ k: 't', dx: 0, dy: 26, lod: 1 }] },
    { id: 'chwr', tag: 'CHWR IN', sym: 'offSheet', x: 196, y: 450, size: 20, rot: 180, tagAt: 'at', tagXY: [0, -16], label: 'Chilled water return — inlet nozzle',
      values: [{ k: 't', dx: 0, dy: 26, lod: 1 }] },
    { id: 'chws', tag: 'CHWS OUT', sym: 'offSheet', x: 404, y: 450, size: 20, tagAt: 'at', tagXY: [0, -16], label: 'Chilled water supply — outlet nozzle',
      values: [{ k: 't', dx: 0, dy: 26, lod: 1 }, { k: 'q', dx: 0, dy: 42, lod: 1 }] },
    /* machine line */
    { id: 'igv', tag: 'IGV', sym: 'guideVanes', x: 460, y: 320, size: 36, tagAt: 'at', tagXY: [0, -40], label: 'Inlet guide vanes',
      values: [{ k: 'pos', dx: 0, dy: -24, lod: 1 }] },
    { id: 'cp', tag: 'COMPRESSOR', sym: 'compressorCentrifugal', x: 540, y: 320, size: 72, tagAt: 'at', tagXY: [-18, 52, 'end'], label: 'Centrifugal compressor, two stages',
      values: [{ k: 'kw', dx: -18, dy: 68, anchor: 'end', lod: 1 }, { k: 'load', dx: -18, dy: 84, anchor: 'end', lod: 1 }, { k: 'td', dx: -170, dy: -268, anchor: 'end', lod: 1 }] },
    { id: 'mtr', tag: 'MOTOR', sym: 'motorIec', x: 620, y: 320, size: 44, tagAt: 'at', tagXY: [0, 34], label: 'Compressor drive motor' },
    { id: 'vfd', tag: 'VFD', sym: 'vfdDrive', x: 692, y: 320, size: 40, tagAt: 'at', tagXY: [0, 36], label: 'Variable-frequency drive',
      values: [{ k: 'spd', dx: 38, dy: 52, anchor: 'end', lod: 1 }] },
    { id: 'ucp', tag: 'UCP', sym: 'instPlc', x: 692, y: 140, size: 44, tagAt: 'at', tagXY: [0, -26], label: 'Unit control panel',
      values: [{ k: 'cop', dx: 18, dy: 42, anchor: 'end', lod: 1 }, { k: 'carnot', dx: 18, dy: 58, anchor: 'end', lod: 1 },
        { k: 'lift', dx: 18, dy: 74, anchor: 'end', lod: 1 }, { k: 'pr', dx: 18, dy: 90, anchor: 'end', lod: 1 }] },
    /* liquid side */
    { id: 'eco', tag: 'ECONOMISER', sym: 'flashTank', x: 90, y: 330, size: 60, tagAt: 'at', tagXY: [24, 8, 'start'], label: 'Economiser — flash tank',
      values: [{ k: 'pi', dx: 24, dy: 24, anchor: 'start', lod: 1 }] },
    { id: 'exv', tag: 'EXV', sym: 'valveControlMotor', x: 90, y: 410, size: 32, rot: 90, tagAt: 'at', tagXY: [24, 4, 'start'], label: 'Electronic expansion valve' },
    { id: 'hgbv', tag: 'HGBV', sym: 'valveControlMotor', x: 190, y: 60, size: 32, tagAt: 'at', tagXY: [0, 26], label: 'Hot-gas bypass valve' },
    { id: 'psv', tag: 'PSV', sym: 'valveRelief', x: 330, y: 406, size: 28, tagAt: 'at', tagXY: [18, 0, 'start'], label: 'Refrigerant relief valve on the evaporator shell' },
    { id: 'pu', tag: 'PURGE', sym: 'purgeUnit', x: 420, y: 108, size: 36, tagAt: 'at', tagXY: [24, 4, 'start'], label: 'Purge unit' },
    /* oil */
    { id: 'os', tag: 'OIL SUMP', sym: 'oilSump', x: 531, y: 500, size: 48, tagAt: 'at', tagXY: [0, 40], label: 'Oil sump with heater' },
    { id: 'op', tag: 'OIL PUMP', sym: 'pumpGear', x: 610, y: 512, size: 32, tagAt: 'at', tagXY: [0, 30], label: 'Oil pump',
      values: [{ k: 'p', dx: 0, dy: 46, lod: 1 }] },
    { id: 'oc', tag: 'OIL COOLER', sym: 'hxShellTube', x: 610, y: 420, size: 48, tagAt: 'at', tagXY: [0, -22], label: 'Oil cooler' },
    /* junctions */
    { id: 'jh', sym: 'junction', x: 285, y: 60 },
    { id: 'jl', sym: 'junction', x: 90, y: 580 }
  ];
  var EDGES = [
    /* water */
    { id: 'w-cdws', from: 'cdws.port', to: 'cond.tubeIn', medium: 'cw', w: 'main', flowOf: 'cdws' },
    { id: 'w-cdwr', from: 'cond.tubeOut', to: 'cdwr.port', medium: 'cw', w: 'main', flowOf: 'cdwr' },
    { id: 'w-chwr', from: 'chwr.port', to: 'evap.tubeIn', medium: 'chw', w: 'main', flowOf: 'chwr' },
    { id: 'w-chws', from: 'evap.tubeOut', to: 'chws.port', medium: 'chw', w: 'main', flowOf: 'chws' },
    /* refrigerant */
    { id: 'r-suct', from: 'evap.shellIn', to: 'igv.a', via: [[285, 380], [410, 380], [410, 320]], medium: 'ref_lpv', w: 'main', flowOf: 'lpv', line: 'SUCTION' },
    { id: 'r-igv', from: 'igv.b', to: 'cp.suction', medium: 'ref_lpv', w: 'main', flowOf: 'lpv' },
    { id: 'r-disch', from: 'cp.discharge', to: 'jh', via: [[540, 60]], medium: 'ref_hpv', w: 'main', flowOf: 'hpv', line: 'DISCHARGE' },
    { id: 'r-cond', from: 'jh', to: 'cond.shellIn', medium: 'ref_hpv', w: 'main', flowOf: 'hpv' },
    { id: 'r-liq', from: 'cond.shellOut', to: 'eco.liquidIn', via: [[315, 226], [150, 226], [150, 315]], medium: 'ref_liq', flowOf: 'liq_hp', line: 'LIQUID' },
    { id: 'r-flash', from: 'eco.gasOut', to: 'cp.economiser', via: [[90, 28], [567, 28]], medium: 'ref_flash', flowOf: 'flash', line: 'FLASH GAS · INTERSTAGE' },
    { id: 'r-eco', from: 'eco.liquidOut', to: 'exv.a', medium: 'ref_liq', flowOf: 'liq_hp' },
    { id: 'r-exv', from: 'exv.b', to: 'jl', medium: 'ref_liq', flowOf: 'liq_lp' },
    { id: 'r-evin', from: 'jl', to: 'evap.shellOut', via: [[315, 580]], medium: 'ref_liq', flowOf: 'liq_lp' },
    { id: 'r-hgb1', from: 'jh', to: 'hgbv.b', medium: 'ref_hpv', flowOf: 'hgb' },
    { id: 'r-hgb2', from: 'hgbv.a', to: 'jl', via: [[40, 60], [40, 580]], medium: 'ref_hpv', flowOf: 'hgb', line: 'HOT-GAS BYPASS' },
    { id: 'r-purge', from: [335, 120], to: 'pu.inlet', via: [[335, 108]], medium: 'ref_hpv', flowOf: 'purge' },
    /* drive */
    { id: 'd-shaft', from: 'cp.shaft', to: 'mtr.shaft', medium: 'line', w: 'inst' },
    { id: 'd-power', from: 'vfd.load', to: 'mtr.power', medium: 'line', w: 'inst' },
    /* oil */
    { id: 'o-drain', from: 'cp.oilOut', to: 'os.drainIn', medium: 'oil', flowOf: 'oil' },
    { id: 'o-suct', from: 'os.outlet', to: 'op.suction', medium: 'oil', flowOf: 'oil' },
    { id: 'o-disch', from: 'op.discharge', to: 'oc.tubeOut', via: [[650, 512], [650, 420]], medium: 'oil', flowOf: 'oil' },
    { id: 'o-feed', from: 'oc.tubeIn', to: 'cp.oilIn', via: [[549, 420]], medium: 'oil', flowOf: 'oil' }
  ];
  function sheet(unit) {
    var tag = (unit && unit.tag) || 'CH';
    return { id: 'int-chiller', no: tag + '-INT', title: tag + ' internal — water-cooled centrifugal chiller', rev: 'A', basis: 'ISO 10628-2 · ISO 14617 · IEC 60617',
      svgId: 'rz-cvm-int-svg', size: SHEET.size.slice(), minScale: SHEET.minScale, nodes: NODES, edges: EDGES, areas: [], notes: [] };
  }
  /* GEOMETRY END */

  /* model(unit, snapshot): unit = CONV_CALC.getFleet('chiller')[n], snapshot = CONV_CALC.snapshot.
     running-only values (temperatures, saturation, lift, pressure ratio, COP) are null on a unit that does not run */
  function model(u, s) {
    var c = (s && s.cooling) || {}, run = u.state === 'running';
    function only(v) { return run ? v : null; }
    return {
      state: u.state, tag: u.tag, n: u.n, running: run,
      chwIn: only(c.chwr_c),                          // CHWR enters the evaporator at the plant return temperature
      chwOut: only(c.chws_c),                         // CHWS leaves at the plant supply set point
      chwFlow: u.chwFlowLps,                          // fleet row: evaporator duty / (rho cp dT_chw)
      cdwIn: only(c.cdw_supply_c), cdwOut: only(c.cdw_return_c),
      cdwFlow: u.cdwFlowLps,                          // fleet row: condenser duty / (rho cp cdw_range_k)
      evapDuty: u.dutyKwTh, compKw: u.inputKwE, loadPct: u.loadPct, rated: u.ratedKwTh,
      condDuty: u.condenserDutyKwTh,                  // = evaporator duty + compressor input (law P-4)
      evapSatC: only(c.chiller_evap_sat_c), evapSatKpa: only(c.chiller_evap_sat_kpa_abs),
      condSatC: only(c.chiller_cond_sat_c), condSatKpa: only(c.chiller_cond_sat_kpa_abs),
      lift: only(c.chiller_lift_k),                   // condenser saturation - evaporator saturation
      pr: only(c.chiller_pressure_ratio),             // condenser / evaporator saturation pressure (absolute)
      cop: run && u.inputKwE ? u.dutyKwTh / u.inputKwE : null,   // COP = evaporator duty / compressor input of this unit
      carnotCop: only(c.chiller_carnot_cop), carnotFraction: only(c.chiller_carnot_fraction),
      refrigerant: c.chiller_refrigerant, evapApproach: c.chiller_evap_approach_k, condApproach: c.chiller_cond_approach_k,
      /* engine 2.5.0 refrigeration cycle (PRD-CONV-EQUIPMENT-INSIDE §5.2): authored superheat / subcooling, the rest
         solved from NIST R-134a rows at this plant's saturations; null on a unit that does not run */
      superheat: only(c.chiller_superheat_k), subcooling: only(c.chiller_subcool_k),
      dischargeT: only(c.chiller_discharge_c), interPress: only(c.chiller_int_sat_kpa_abs), interSatC: only(c.chiller_int_sat_c),
      flash: only(c.chiller_flash_fraction), etaIs: only(c.chiller_eta_is), shaftKw: only(c.chiller_unit_shaft_kw),
      refFlow: only(c.chiller_unit_ref_flow_evap_kg_s), refFlowCond: only(c.chiller_unit_ref_flow_cond_kg_s),
      speedPct: only(c.chiller_speed_pct), igvPos: only(c.chiller_igv_pct),
      points: run ? c.chiller_cycle_points : null,
      hgbvPos: NM, oilPress: NM, oilTemp: NM, exvPos: NM, reliefSet: NM, purgeState: NM
    };
  }
  var RUN_NODES = { cond: true, evap: true, cp: true, mtr: true, vfd: true, eco: true, os: true, op: true, oc: true, igv: true, exv: true };
  function nodeState(id, m) {
    if (id === 'ucp') return 'normal';                       // the controller is energised on a running and a standby unit
    if (!RUN_NODES[id]) return null;                         // HGBV, PSV, purge, nozzles: no state modelled
    if (m.running) return id === 'igv' || id === 'exv' ? 'modulating' : 'running';
    return m.state === 'standby' ? 'standby' : 'stopped';
  }
  var WATER = { chwr: true, chws: true, cdws: true, cdwr: true }, CHARGED = { lpv: true, hpv: true, liq_hp: true, liq_lp: true, flash: true, oil: true };
  function flow(u, k) {
    var run = u.state === 'running';
    if (WATER[k]) return run ? 'running' : 'stopped';        // a unit that does not run is isolated on its water side
    if (CHARGED[k]) return run ? 'running' : 'standby';      // charged and at rest
    return 'unavailable';                                     // hot-gas bypass and purge flow are not modelled
  }
  /* Thermal view: water at its own temperature; refrigerant at the saturation temperature of its pressure level */
  var TEMP_KEY = { chwr: 'chwIn', chws: 'chwOut', cdws: 'cdwIn', cdwr: 'cdwOut', lpv: 'evapSatC', liq_lp: 'evapSatC', hpv: 'condSatC', liq_hp: 'condSatC' };

  var NODE_VALUES = {
    cdws: [{ k: 't', key: 'cdwIn', fmt: 'temp' }, { k: 'q', key: 'cdwFlow', fmt: 'flow' }],
    cdwr: [{ k: 't', key: 'cdwOut', fmt: 'temp' }],
    chwr: [{ k: 't', key: 'chwIn', fmt: 'temp' }],
    chws: [{ k: 't', key: 'chwOut', fmt: 'temp' }, { k: 'q', key: 'chwFlow', fmt: 'flow' }],
    cond: [{ k: 'duty', key: 'condDuty', fmt: 'kwth' }, { k: 'sat', key: 'condSatC', fmt: 'temp', prefix: 'SAT' }, { k: 'p', key: 'condSatKpa', fmt: 'kpa', prefix: 'P' }, { k: 'sc', key: 'subcooling', fmt: 'k', prefix: 'SC' }],
    evap: [{ k: 'duty', key: 'evapDuty', fmt: 'kwth' }, { k: 'sat', key: 'evapSatC', fmt: 'temp', prefix: 'SAT' }, { k: 'p', key: 'evapSatKpa', fmt: 'kpa', prefix: 'P' }, { k: 'sh', key: 'superheat', fmt: 'k', prefix: 'SH' }],
    cp: [{ k: 'kw', key: 'compKw', fmt: 'kwe' }, { k: 'load', key: 'loadPct', fmt: 'pct', prefix: 'LOAD' }, { k: 'td', key: 'dischargeT', fmt: 'temp', prefix: 'TD' }],
    igv: [{ k: 'pos', key: 'igvPos', fmt: 'pct', prefix: 'POS' }],
    vfd: [{ k: 'spd', key: 'speedPct', fmt: 'pct', prefix: 'SPD' }],
    ucp: [{ k: 'cop', key: 'cop', fmt: 'cop', prefix: 'COP' }, { k: 'carnot', key: 'carnotFraction', fmt: 'frac', prefix: 'CARNOT' },
      { k: 'lift', key: 'lift', fmt: 'k', prefix: 'LIFT' }, { k: 'pr', key: 'pr', fmt: 'ratio', prefix: 'PR' }],
    eco: [{ k: 'pi', key: 'interPress', fmt: 'kpa', prefix: 'P' }],
    op: [{ k: 'p', key: 'oilPress', fmt: 'kpag', prefix: 'P' }]
  };

  /* the block catalogue (PRD §5.1 chiller row): every block is a node on the sheet; role = two plain lines */
  var B = 'cooling.';
  var BLOCKS = [
    { id: 'evaporator', node: 'evap', name: 'Evaporator — flooded shell-and-tube', standard: 'ISO 10628-2 · AHRI 550/590 rating basis',
      role: ['Chilled water in the tubes gives its heat to boiling refrigerant in the shell.', 'Leaving water temperature is the set point the whole machine works to.'],
      values: [{ label: 'Duty', key: 'evapDuty', fmt: 'kwth', basis: B + 'chiller_unit_duty_kw_th', fleet: true },
        { label: 'CHW in (CHWR)', key: 'chwIn', fmt: 'temp', basis: B + 'chwr_c' }, { label: 'CHW out (CHWS)', key: 'chwOut', fmt: 'temp', basis: B + 'chws_c' },
        { label: 'CHW flow', key: 'chwFlow', fmt: 'flow', basis: B + 'chiller_unit_chw_flow_lps', fleet: true },
        { label: 'Saturation temperature', key: 'evapSatC', fmt: 'temp', basis: B + 'chiller_evap_sat_c' },
        { label: 'Saturation pressure', key: 'evapSatKpa', fmt: 'kpa', basis: B + 'chiller_evap_sat_kpa_abs' },
        { label: 'Approach (design)', key: 'evapApproach', fmt: 'k', basis: B + 'chiller_evap_approach_k' },
        { label: 'Suction superheat', key: 'superheat', fmt: 'k', basis: B + 'chiller_superheat_k' },
        { label: 'Refrigerant flow', key: 'refFlow', fmt: 'kgs', basis: B + 'chiller_unit_ref_flow_evap_kg_s' }] },
    { id: 'compressor', node: 'cp', name: 'Compressor — two-stage centrifugal', standard: 'ISO 10628-2',
      role: ['Draws low-pressure vapour from the evaporator and raises it to condensing pressure.', 'Its electrical input is the work the cycle needs to move the heat uphill.'],
      values: [{ label: 'Input', key: 'compKw', fmt: 'kwe', basis: B + 'chiller_input_per_machine_kw_e', fleet: true },
        { label: 'Load', key: 'loadPct', fmt: 'pct', basis: B + 'chiller_part_load_pct', fleet: true },
        { label: 'Pressure ratio', key: 'pr', fmt: 'ratio', basis: B + 'chiller_pressure_ratio' },
        { label: 'Discharge temperature', key: 'dischargeT', fmt: 'temp', basis: B + 'chiller_discharge_c' },
        { label: 'Shaft power', key: 'shaftKw', fmt: 'kwe', basis: B + 'chiller_unit_shaft_kw' },
        { label: 'Isentropic efficiency (rating fit)', key: 'etaIs', fmt: 'frac', basis: B + 'chiller_eta_is' }] },
    { id: 'igv', node: 'igv', name: 'Inlet guide vanes', standard: 'ISO 14617-8',
      role: ['Pre-swirl the vapour entering the first impeller to throttle capacity at part load.', 'Driven by the unit control panel from the leaving chilled-water error.'],
      values: [{ label: 'Position', key: 'igvPos', fmt: 'pct', basis: B + 'chiller_igv_pct' }, { label: 'Load it serves', key: 'loadPct', fmt: 'pct', basis: B + 'chiller_part_load_pct', fleet: true }] },
    { id: 'motor', node: 'mtr', name: 'Motor — hermetic, refrigerant-cooled', standard: 'IEC 60617-6',
      role: ['Turns the compressor shaft through the speed-increasing gear.', 'Its electrical input is the compressor input the plant meters.'],
      values: [{ label: 'Input at the terminals', key: 'compKw', fmt: 'kwe', basis: B + 'chiller_input_per_machine_kw_e', fleet: true }, { label: 'Speed', key: 'speedPct', fmt: 'pct', basis: B + 'chiller_speed_pct' }] },
    { id: 'vfd', node: 'vfd', name: 'Variable-frequency drive', standard: 'IEC 60617-6',
      role: ['Sets motor speed so the compressor makes only the lift the plant needs.', 'Works with the guide vanes: speed first, vanes at low load.'],
      values: [{ label: 'Speed', key: 'speedPct', fmt: 'pct', basis: B + 'chiller_speed_pct' }, { label: 'Output', key: 'compKw', fmt: 'kwe', basis: B + 'chiller_input_per_machine_kw_e', fleet: true }] },
    { id: 'condenser', node: 'cond', name: 'Condenser — shell-and-tube', standard: 'ISO 10628-2 · AHRI 550/590 rating basis',
      role: ['Hot vapour from the compressor condenses on tubes carrying condenser water.', 'It rejects the evaporator duty plus the compressor work to the towers.'],
      values: [{ label: 'Duty', key: 'condDuty', fmt: 'kwth', basis: B + 'chiller_unit_condenser_duty_kw_th', fleet: true },
        { label: 'CDW in (CDWS)', key: 'cdwIn', fmt: 'temp', basis: B + 'cdw_supply_c' }, { label: 'CDW out (CDWR)', key: 'cdwOut', fmt: 'temp', basis: B + 'cdw_return_c' },
        { label: 'CDW flow', key: 'cdwFlow', fmt: 'flow', basis: B + 'chiller_unit_cdw_flow_lps', fleet: true },
        { label: 'Saturation temperature', key: 'condSatC', fmt: 'temp', basis: B + 'chiller_cond_sat_c' },
        { label: 'Saturation pressure', key: 'condSatKpa', fmt: 'kpa', basis: B + 'chiller_cond_sat_kpa_abs' },
        { label: 'Approach (design)', key: 'condApproach', fmt: 'k', basis: B + 'chiller_cond_approach_k' },
        { label: 'Liquid subcooling', key: 'subcooling', fmt: 'k', basis: B + 'chiller_subcool_k' },
        { label: 'Refrigerant flow', key: 'refFlowCond', fmt: 'kgs', basis: B + 'chiller_unit_ref_flow_cond_kg_s' }] },
    { id: 'economiser', node: 'eco', name: 'Economiser — flash tank', standard: 'ISO 10628-2',
      role: ['Liquid from the condenser flashes to an intermediate pressure; the flash gas goes to the interstage.', 'The colder liquid left behind carries more cooling per kilogram to the evaporator.'],
      values: [{ label: 'Intermediate pressure', key: 'interPress', fmt: 'kpa', basis: B + 'chiller_int_sat_kpa_abs' },
        { label: 'Intermediate saturation', key: 'interSatC', fmt: 'temp', basis: B + 'chiller_int_sat_c' },
        { label: 'Flash fraction', key: 'flash', fmt: 'frac', basis: B + 'chiller_flash_fraction' }] },
    { id: 'exv', node: 'exv', name: 'Electronic expansion valve', standard: 'ISO 10628-2 · ISA-5.1',
      role: ['Meters liquid into the evaporator and drops it to evaporating pressure.', 'Holds the evaporator liquid level the flooded shell needs.'],
      values: [{ label: 'Downstream saturation', key: 'evapSatC', fmt: 'temp', basis: B + 'chiller_evap_sat_c' }, { label: 'Opening', key: 'exvPos', fmt: 'pct' }] },
    { id: 'oil-sump', node: 'os', name: 'Oil sump', standard: 'ISO 10628-2',
      role: ['Holds the lubricating oil under the compressor; a heater keeps refrigerant out of it.', 'Oil drains back here from the bearings and the gear.'],
      values: [{ label: 'Oil temperature', key: 'oilTemp', fmt: 'temp' }] },
    { id: 'oil-pump', node: 'op', name: 'Oil pump — gear', standard: 'ISO 10628-2 · ISO 14617-9',
      role: ['Pushes oil to the bearings and gear before, during and after a run.', 'A low oil pressure trips the compressor.'],
      values: [{ label: 'Oil pressure', key: 'oilPress', fmt: 'kpag' }] },
    { id: 'oil-cooler', node: 'oc', name: 'Oil cooler', standard: 'ISO 10628-2',
      role: ['Takes the bearing and gear heat out of the oil before it returns.', 'Keeps oil viscosity in the band the bearings are rated for.'],
      values: [{ label: 'Oil temperature out', key: 'oilTemp', fmt: 'temp' }] },
    { id: 'purge', node: 'pu', name: 'Purge unit', standard: 'ISO 10628-2',
      role: ['Draws vapour from the top of the condenser and removes air and moisture.', 'Returns the refrigerant it recovers; vents only the non-condensables.'],
      values: [{ label: 'Purge running', key: 'purgeState', fmt: 'text' }] },
    { id: 'hgbv', node: 'hgbv', name: 'Hot-gas bypass valve', standard: 'ISO 10628-2 · ISA-5.1',
      role: ['Lets discharge gas back to the evaporator inlet at very low load.', 'Keeps the compressor out of surge when the plant asks for almost nothing.'],
      values: [{ label: 'Position', key: 'hgbvPos', fmt: 'pct' }] },
    { id: 'ucp', node: 'ucp', name: 'Unit control panel', standard: 'ISA-5.1',
      role: ['Runs the machine: set point, staging, safeties, guide vanes, speed and valves.', 'Reports the cycle figures the plant uses to judge efficiency.'],
      values: [{ label: 'COP (duty ÷ input)', key: 'cop', fmt: 'cop', basis: B + 'plant_cop', fleet: true },
        { label: 'Carnot COP', key: 'carnotCop', fmt: 'cop', basis: B + 'chiller_carnot_cop' },
        { label: 'Carnot fraction', key: 'carnotFraction', fmt: 'frac', basis: B + 'chiller_carnot_fraction' },
        { label: 'Lift', key: 'lift', fmt: 'k', basis: B + 'chiller_lift_k' },
        { label: 'Pressure ratio', key: 'pr', fmt: 'ratio', basis: B + 'chiller_pressure_ratio' },
        { label: 'Refrigerant', key: 'refrigerant', fmt: 'text', basis: B + 'chiller_refrigerant' }] },
    { id: 'relief', node: 'psv', name: 'Refrigerant relief valve', standard: 'ISO 10628-2 · ISO 5149-2',
      role: ['Opens to vent the shell if its pressure passes the vessel design limit.', 'Fitted on every pressure vessel of the refrigerant circuit.'],
      values: [{ label: 'Set pressure', key: 'reliefSet', fmt: 'kpag' }] },
    { id: 'chw-nozzles', node: 'chws', name: 'Chilled-water nozzles (CHWR in, CHWS out)', standard: 'ISO 10628-2',
      role: ['Where the plant chilled-water loop enters and leaves the evaporator tubes.', 'Flow and the two temperatures set the evaporator duty.'],
      values: [{ label: 'CHWR in', key: 'chwIn', fmt: 'temp', basis: B + 'chwr_c' }, { label: 'CHWS out', key: 'chwOut', fmt: 'temp', basis: B + 'chws_c' },
        { label: 'Flow', key: 'chwFlow', fmt: 'flow', basis: B + 'chiller_unit_chw_flow_lps', fleet: true }] },
    { id: 'cdw-nozzles', node: 'cdws', name: 'Condenser-water nozzles (CDWS in, CDWR out)', standard: 'ISO 10628-2',
      role: ['Where the tower water enters and leaves the condenser tubes.', 'Flow and the two temperatures carry the condenser duty to the towers.'],
      values: [{ label: 'CDWS in', key: 'cdwIn', fmt: 'temp', basis: B + 'cdw_supply_c' }, { label: 'CDWR out', key: 'cdwOut', fmt: 'temp', basis: B + 'cdw_return_c' },
        { label: 'Flow', key: 'cdwFlow', fmt: 'flow', basis: B + 'chiller_unit_cdw_flow_lps', fleet: true }] }
  ];
  /* the outlet nozzles open the same block as their inlet */
  var NODE_BLOCK = { chwr: 'chw-nozzles', cdwr: 'cdw-nozzles' };

  /* the media key printed under the drawing (token --hmi-m-<medium>) */
  var MEDIA = [['ref_lpv', 'Suction vapour'], ['ref_hpv', 'Discharge / hot gas'], ['ref_liq', 'Liquid refrigerant'], ['ref_flash', 'Flash gas'],
    ['oil', 'Oil'], ['chw', 'Chilled water'], ['cw', 'Condenser water']];

  R.register('chiller', { title: 'Water-cooled centrifugal chiller', sheet: sheet, model: model, nodeState: nodeState, flow: flow,
    tempKey: TEMP_KEY, tempRange: ['evapSatC', 'condSatC'], nodeValues: NODE_VALUES, blocks: BLOCKS, nodeBlock: NODE_BLOCK,
    media: MEDIA, defaultBlock: 'compressor',
    /* the P-h chart (js/conv/ph-chart.js) draws the cycle of a running unit from these plant cooling values */
    cycle: function (u, s) { return u.state === 'running' && s && s.cooling && s.cooling.chiller_cycle_points ? s.cooling : null; } });
})(typeof window !== 'undefined' ? window : null);
