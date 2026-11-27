/*
 * internals/genset.js — the INSIDE of one diesel generating set (PRD-CONV-EQUIPMENT-TRUTH §5.2 "Diesel generating set",
 * audit F2/F5), registered as RZConvInternals class 'genset'. Drawn by js/rz-hmi-sheet.js with symbols from
 * js/rz-eng-symbols.js (ISO 10628-2 / IEC 60617), coloured and moved only by js/conv/vfx.js.
 *
 *   Fuel:    day tank -> fuel shut-off solenoid -> fuel filter -> engine injection (the day tank is filled from the
 *            FU-M-101 header through the set's XV valve, drawn on the plant sheet).
 *   Air:     intake filter -> turbocharged engine -> exhaust / silencer.
 *   Cooling: engine jacket water -> radiator -> engine, radiator fan; jacket-water heater keeps a standby set warm.
 *   Power:   engine shaft -> alternator (AVR on its field) -> generator circuit breaker -> hall LV bus; synchroniser on
 *            the breaker; governor / ECU on the engine; starter battery and its charger.
 *
 * The unit is a row of CONV_CALC.getFleet('genset', hall) carried by fuel-system.html with the operating mode applied
 * (outputKw, loadPct, lph) and its day tank ({ pct, litres, capL, hoursAtRated, fill }) — the page's fleet rule and
 * day-tank basis, stated on that page. Everything else the engine does not model reads "not modelled".
 * This file holds geometry and key names only: no digit outside the GEOMETRY block, comments and standards text.
 */
(function (root) {
  'use strict';
  var R = root && root.RZConvInternals ? root.RZConvInternals : (typeof require === 'function' ? require('../internals.js') : null);
  if (!R) return;
  var NM = R.NOT_MODELLED;
  /* FORMATS BEGIN — display kinds this class adds to the registry's one formatter (RZConvInternals.text); added here, not
     in internals.js, so the shared file (and the token of every page that loads it) does not change for one class */
  var ADD_FMT = { kva: { d: 0, u: 'kVA' }, lph: { d: 0, u: 'L/h' }, litre: { d: 0, u: 'L' }, hr: { d: 1, u: 'h' } };
  /* FORMATS END */
  Object.keys(ADD_FMT).forEach(function (k) { if (!R.FMT[k]) R.FMT[k] = ADD_FMT[k]; });

  /* GEOMETRY BEGIN — drawing units; the sheet is fitted to its panel, never below 0.92 x its width */
  var SHEET = { size: [740, 600], minScale: 0.92 };
  var NODES = [
    { id: 'tank', tag: 'DAY TANK', sym: 'tankStorage', x: 150, y: 330, size: 80, tagAt: 'at', tagXY: [-46, -26, 'end'], label: 'Day tank with level switches and bund',
      values: [{ k: 'pct', dx: -46, dy: -8, anchor: 'end', lod: 1 }, { k: 'vol', dx: -46, dy: 8, anchor: 'end', lod: 1 }, { k: 'hr', dx: -46, dy: 24, anchor: 'end', lod: 1 }] },
    { id: 'fv', tag: 'FUEL SOV', sym: 'valveSolenoid', x: 250, y: 360, size: 26, tagAt: 'at', tagXY: [0, -20], label: 'Fuel shut-off solenoid valve' },
    { id: 'ff', tag: 'FUEL FILTER', sym: 'filterCartridge', x: 320, y: 360, size: 30, tagAt: 'at', tagXY: [0, 36], label: 'Fuel filter / water separator' },
    { id: 'eng', tag: 'ENGINE', sym: 'gensetDiesel', x: 470, y: 330, size: 110, tagAt: 'at', tagXY: [-70, -40, 'end'], label: 'Diesel engine, turbocharged',
      values: [{ k: 'q', dx: -70, dy: -24, anchor: 'end', lod: 1 }, { k: 'rpm', dx: -70, dy: -8, anchor: 'end', lod: 1 }] },
    { id: 'alt', tag: 'ALTERNATOR', sym: 'generatorIec', x: 620, y: 330, size: 56, tagAt: 'at', tagXY: [36, -14, 'start'], label: 'Synchronous alternator',
      values: [{ k: 'kw', dx: 36, dy: 4, anchor: 'start', lod: 1 }, { k: 'kva', dx: 36, dy: 20, anchor: 'start', lod: 1 }, { k: 'load', dx: 36, dy: 36, anchor: 'start', lod: 1 }] },
    { id: 'gcb', tag: 'GCB', sym: 'cbIec', x: 620, y: 450, size: 40, tagAt: 'at', tagXY: [-26, 4, 'end'], label: 'Generator circuit breaker',
      values: [{ k: 'st', dx: -26, dy: 20, anchor: 'end', lod: 1 }] },
    { id: 'bus', tag: 'HALL LV BUS', sym: 'offSheet', x: 690, y: 550, size: 22, tagAt: 'at', tagXY: [0, -16], label: 'To the hall LV switchboard' },
    { id: 'sync', tag: 'SYNC', sym: 'protectionRelay', x: 700, y: 450, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Synchroniser / load-share controller' },
    { id: 'avr', tag: 'AVR', sym: 'instPanel', x: 620, y: 230, size: 36, tagAt: 'at', tagXY: [0, -24], label: 'Automatic voltage regulator',
      values: [{ k: 'pf', dx: 26, dy: 4, anchor: 'start', lod: 1 }] },
    { id: 'ecu', tag: 'ECU / GOVERNOR', sym: 'instPlc', x: 470, y: 150, size: 40, tagAt: 'at', tagXY: [14, -26], label: 'Engine control unit and speed governor',
      values: [{ k: 'mode', dx: 30, dy: -8, anchor: 'start', lod: 1 }] },
    { id: 'af', tag: 'AIR FILTER', sym: 'filterCartridge', x: 320, y: 230, size: 30, tagAt: 'at', tagXY: [0, -22], label: 'Combustion air intake filter' },
    { id: 'exh', tag: 'EXHAUST', sym: 'offSheet', x: 640, y: 160, size: 22, tagAt: 'at', tagXY: [14, 4, 'start'], label: 'Exhaust and silencer' },
    { id: 'rad', tag: 'RADIATOR', sym: 'coolingCoil', x: 470, y: 500, size: 56, tagAt: 'at', tagXY: [-72, 4, 'end'], label: 'Engine jacket-water radiator',   /* left of the jacket-water riser (x 408), not on it */
      values: [{ k: 't', dx: -72, dy: 20, anchor: 'end', lod: 1 }] },
    { id: 'fan', tag: 'RAD FAN', sym: 'fanAxial', x: 560, y: 500, size: 36, tagAt: 'at', tagXY: [0, 34], label: 'Radiator fan (engine-driven or electric)' },
    { id: 'jwh', tag: 'JW HEATER', sym: 'resistor', x: 240, y: 500, size: 30, tagAt: 'at', tagXY: [-20, 4, 'end'], label: 'Jacket-water heater (standby)' },
    { id: 'bat', tag: 'START BATTERY', sym: 'batteryIec', x: 230, y: 150, size: 36, tagAt: 'at', tagXY: [24, 4, 'start'], label: 'Starter battery',
      values: [{ k: 'v', dx: 24, dy: 20, anchor: 'start', lod: 1 }] },
    { id: 'chg', tag: 'CHARGER', sym: 'rectifier', x: 110, y: 150, size: 36, tagAt: 'at', tagXY: [0, -24], label: 'Battery charger' }
  ];
  var EDGES = [
    /* fuel */
    { id: 'f-fill', from: [150, 230], to: 'tank.inlet', medium: 'fuel', flowOf: 'fill', line: 'FROM XV' },
    { id: 'f-out', from: 'tank.outlet', to: 'fv.a', medium: 'fuel', flowOf: 'fuel' },
    { id: 'f-sov', from: 'fv.b', to: 'ff.inlet', medium: 'fuel', flowOf: 'fuel' },
    { id: 'f-inj', from: 'ff.outlet', to: 'eng.fuelIn', via: [[380, 360], [380, 343.8]], medium: 'fuel', flowOf: 'fuel' },
    /* air and exhaust */
    { id: 'a-in', from: 'af.outlet', to: [440, 302], via: [[440, 230]], medium: 'air', flowOf: 'air' },
    { id: 'a-exh', from: [500, 302], to: 'exh.port', via: [[500, 260], [580, 260], [580, 160]], medium: 'air', flowOf: 'exh' },
    /* jacket water */
    { id: 'w-out', from: [440, 380], to: 'rad.waterIn', via: [[440, 410], [408, 410], [408, 560], [456, 560]], medium: 'htw', flowOf: 'jw' },
    { id: 'w-ret', from: 'rad.waterOut', to: [490, 380], via: [[484, 560], [520, 560], [520, 410], [490, 410]], medium: 'htw', flowOf: 'jw' },
    { id: 'w-jwh', from: 'jwh.load', to: [408, 535], via: [[240, 535]], medium: 'htw', flowOf: 'jwh' },
    { id: 'a-rad', from: 'rad.airOut', to: 'fan.inlet', medium: 'air', flowOf: 'air' },
    /* power and control */
    { id: 'e-shaft', from: 'eng.out', to: [592, 330], medium: 'line', w: 'inst' },
    { id: 'e-gen', from: 'alt.out', to: 'gcb.line', medium: 'line' },
    { id: 'e-bus', from: 'gcb.load', to: 'bus.port', via: [[620, 550]], medium: 'line' },
    { id: 'c-sync', from: [640, 450], to: 'sync.input', medium: 'line', w: 'inst' },
    { id: 'c-avr', from: 'avr.process', to: [620, 302], medium: 'line', w: 'inst' },
    { id: 'c-ecu', from: 'ecu.process', to: [470, 302], medium: 'line', w: 'inst' },
    { id: 'd-chg', from: 'chg.dc', to: 'bat.neg', via: [[110, 190], [230, 190]], medium: 'dc' },
    { id: 'd-start', from: 'bat.pos', to: [420, 302], via: [[230, 110], [420, 110]], medium: 'dc' }
  ];
  function sheet(unit) {
    var tag = (unit && unit.tag) || 'GEN';
    return { id: 'int-genset', no: tag + '-INT', title: tag + ' internal — diesel generating set', rev: 'A', basis: 'ISO 10628-2 · IEC 60617 · ISO 8528',
      svgId: 'rz-cvm-int-svg', size: SHEET.size.slice(), minScale: SHEET.minScale, nodes: NODES, edges: EDGES, areas: [], notes: [] };
  }
  /* GEOMETRY END */

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  /* model(unit, snapshot): unit = a fleet row with the page's operating mode and day tank; snapshot = CONV_CALC.snapshot */
  function model(u, s) {
    var e = (s && s.electrical) || {}, f = (s && s.fuel) || {}, run = u.state === 'running', dt = u.dayTank || {};
    var pf = e.power_factor_design, sfc = f.specific_consumption_l_per_kwh;
    function only(v) { return run ? v : null; }
    return {
      state: u.state, tag: u.tag, n: u.n, running: run,
      kw: u.outputKw,                                         // hall load / running sets (page fleet rule), 0 on standby
      loadPct: u.loadPct, rated: u.ratingKw,
      kva: run && isNum(u.outputKw) && isNum(pf) && pf ? u.outputKw / pf : null,
      pf: only(pf),
      lph: u.lph,                                             // output x specific consumption
      sfc: sfc, ratedLph: isNum(u.ratingKw) && isNum(sfc) ? u.ratingKw * sfc : null,
      dtPct: dt.pct, dtL: dt.litres, dtCap: dt.capL, dtHr: dt.hoursAtRated, fill: dt.fill === true ? 'OPEN' : (dt.fill === false ? 'CLOSED' : null),
      gcb: run ? 'CLOSED' : 'OPEN', mode: run ? 'RUN · ON LOAD' : 'AUTO · STANDBY',
      rpm: NM, hz: NM, coolantT: NM, oilP: NM, batV: NM, exhT: NM, filterDp: NM
    };
  }
  var RUN_NODES = { eng: true, alt: true, fan: true, rad: true, ff: true, af: true };
  function nodeState(id, m) {
    if (id === 'ecu' || id === 'avr' || id === 'chg' || id === 'bat' || id === 'sync') return 'normal';   // energised either way
    if (id === 'gcb') return m.running ? 'closed' : 'open';
    if (id === 'fv') return m.running ? 'open' : 'closed';
    if (id === 'tank') return m.dtPct == null ? null : 'normal';
    if (!RUN_NODES[id]) return null;
    return m.running ? 'running' : 'standby';
  }
  function flow(u, k) {
    var run = u.state === 'running', dt = u.dayTank || {};
    if (k === 'fuel' || k === 'air' || k === 'exh' || k === 'jw') return run ? 'running' : 'stopped';
    if (k === 'fill') return dt.fill === true ? 'running' : (dt.fill === false ? 'stopped' : 'unavailable');
    return 'unavailable';                                     // jacket-water heater circulation is not modelled
  }

  var NODE_VALUES = {
    tank: [{ k: 'pct', key: 'dtPct', fmt: 'pct' }, { k: 'vol', key: 'dtL', fmt: 'litre' }, { k: 'hr', key: 'dtHr', fmt: 'hr', prefix: 'AT RATED' }],
    eng: [{ k: 'q', key: 'lph', fmt: 'lph', prefix: 'FUEL' }, { k: 'rpm', key: 'rpm', fmt: 'text', prefix: 'RPM' }],
    alt: [{ k: 'kw', key: 'kw', fmt: 'kwe' }, { k: 'kva', key: 'kva', fmt: 'kva' }, { k: 'load', key: 'loadPct', fmt: 'pct', prefix: 'LOAD' }],
    gcb: [{ k: 'st', key: 'gcb', fmt: 'text' }],
    avr: [{ k: 'pf', key: 'pf', fmt: 'ratio', prefix: 'PF' }],
    ecu: [{ k: 'mode', key: 'mode', fmt: 'text' }],
    rad: [{ k: 't', key: 'coolantT', fmt: 'temp', prefix: 'JW' }],
    bat: [{ k: 'v', key: 'batV', fmt: 'text', prefix: 'V' }]
  };

  /* the block catalogue (PRD §5.2 diesel generating set row): every block is a node on the sheet */
  var E = 'electrical.', F = 'fuel.', H = 'hall.';
  var BLOCKS = [
    { id: 'engine', node: 'eng', name: 'Diesel engine — turbocharged', standard: 'ISO 8528-1 · ISO 10628-2',
      role: ['Burns diesel from the day tank and turns the alternator at synchronous speed.', 'Its fuel rate follows the electrical load it carries.'],
      values: [{ label: 'Fuel rate', key: 'lph', fmt: 'lph', basis: F + 'specific_consumption_l_per_kwh', fleet: true },
        { label: 'Fuel rate at rating', key: 'ratedLph', fmt: 'lph', basis: E + 'genset_unit_kw' },
        { label: 'Specific consumption', key: 'sfc', fmt: 'ratio', basis: F + 'specific_consumption_l_per_kwh' },
        { label: 'Speed', key: 'rpm', fmt: 'text' }, { label: 'Oil pressure', key: 'oilP', fmt: 'text' }, { label: 'Exhaust temperature', key: 'exhT', fmt: 'text' }] },
    { id: 'alternator', node: 'alt', name: 'Alternator — synchronous', standard: 'IEC 60034 · IEC 60617-6',
      role: ['Converts shaft power into the hall supply while utility power is lost.', 'Shares the hall load equally with the other running sets.'],
      values: [{ label: 'Output', key: 'kw', fmt: 'kwe', basis: H + 'facility_load_kw', fleet: true },
        { label: 'Apparent power', key: 'kva', fmt: 'kva', basis: E + 'power_factor_design', fleet: true },
        { label: 'Load of rating', key: 'loadPct', fmt: 'pct', basis: E + 'genset_unit_kw', fleet: true },
        { label: 'Rating', key: 'rated', fmt: 'kwe', basis: E + 'genset_unit_kw' },
        { label: 'Frequency', key: 'hz', fmt: 'text' }] },
    { id: 'day-tank', node: 'tank', name: 'Day tank — bunded, with level switches', standard: 'ISO 10628-2 · NFPA 110 / NFPA 37',
      role: ['Holds the fuel the engine draws first; refilled from the bulk tank by the transfer pumps.', 'Its fill valve opens below the fill-start level while the set runs.'],
      values: [{ label: 'Level', key: 'dtPct', fmt: 'pct' }, { label: 'Volume', key: 'dtL', fmt: 'litre' },
        { label: 'Capacity', key: 'dtCap', fmt: 'litre' }, { label: 'Hours at rated burn', key: 'dtHr', fmt: 'hr' },
        { label: 'Fill valve', key: 'fill', fmt: 'text' }] },
    { id: 'fuel-sov', node: 'fv', name: 'Fuel shut-off solenoid', standard: 'ISO 10628-2 · ISA-5.1',
      role: ['Opens the fuel line to the injection pump while the engine is commanded to run.', 'Closes on a stop or an emergency shutdown.'],
      values: [{ label: 'State', key: 'mode', fmt: 'text' }] },
    { id: 'fuel-filter', node: 'ff', name: 'Fuel filter / water separator', standard: 'ISO 10628-2',
      role: ['Removes particulates and free water before the injection pump.', 'A rising pressure drop calls for a filter change.'],
      values: [{ label: 'Pressure drop', key: 'filterDp', fmt: 'text' }] },
    { id: 'gcb', node: 'gcb', name: 'Generator circuit breaker', standard: 'IEC 60947-2 · IEC 60617-7',
      role: ['Connects the alternator to the hall LV bus once it is in synchronism.', 'Open on a standby set.'],
      values: [{ label: 'Position', key: 'gcb', fmt: 'text' }] },
    { id: 'sync', node: 'sync', name: 'Synchroniser / load-share controller', standard: 'IEC 60617-7',
      role: ['Matches voltage, frequency and phase before the breaker closes.', 'Holds equal kW sharing between the running sets.'],
      values: [{ label: 'Share', key: 'loadPct', fmt: 'pct', basis: E + 'genset_unit_kw', fleet: true }] },
    { id: 'avr', node: 'avr', name: 'Automatic voltage regulator', standard: 'IEC 60034-16',
      role: ['Controls the alternator field to hold terminal voltage.', 'Shares reactive power between the running sets.'],
      values: [{ label: 'Power factor (design)', key: 'pf', fmt: 'ratio', basis: E + 'power_factor_design' }] },
    { id: 'ecu', node: 'ecu', name: 'Engine control unit and governor', standard: 'ISO 8528-2',
      role: ['Starts and stops the engine and holds its speed under load steps.', 'Trips the set on low oil pressure, overspeed or high coolant temperature.'],
      values: [{ label: 'Mode', key: 'mode', fmt: 'text' }, { label: 'Speed', key: 'rpm', fmt: 'text' }] },
    { id: 'radiator', node: 'rad', name: 'Radiator and fan', standard: 'ISO 10628-2',
      role: ['Rejects the engine jacket-water heat to air.', 'The fan runs with the engine.'],
      values: [{ label: 'Jacket-water temperature', key: 'coolantT', fmt: 'text' }] },
    { id: 'jw-heater', node: 'jwh', name: 'Jacket-water heater', standard: 'NFPA 110',
      role: ['Keeps a standby engine warm so it can take load within the transfer time.', 'Switched off while the engine runs.'],
      values: [{ label: 'Jacket-water temperature', key: 'coolantT', fmt: 'text' }] },
    { id: 'air-intake', node: 'af', name: 'Air intake filter', standard: 'ISO 10628-2',
      role: ['Cleans the combustion air before the turbocharger.', 'A blocked filter derates the engine.'],
      values: [{ label: 'Pressure drop', key: 'filterDp', fmt: 'text' }] },
    { id: 'exhaust', node: 'exh', name: 'Exhaust and silencer', standard: 'ISO 8528-10',
      role: ['Carries the exhaust gas out of the plant room through the silencer.', 'Exhaust temperature is a load and health indicator.'],
      values: [{ label: 'Exhaust temperature', key: 'exhT', fmt: 'text' }] },
    { id: 'start-battery', node: 'bat', name: 'Starter battery and charger', standard: 'NFPA 110 · IEC 60617-6',
      role: ['Cranks the engine on a start command.', 'The charger keeps it at float voltage while the set waits.'],
      values: [{ label: 'Battery voltage', key: 'batV', fmt: 'text' }] }
  ];
  var NODE_BLOCK = { chg: 'start-battery', fan: 'radiator', bus: 'gcb' };
  var MEDIA = [['fuel', 'Diesel'], ['air', 'Air / exhaust'], ['htw', 'Jacket water'], ['dc', 'Battery DC']];

  R.register('genset', { title: 'Diesel generating set', sheet: sheet, model: model, nodeState: nodeState, flow: flow,
    nodeValues: NODE_VALUES, blocks: BLOCKS, nodeBlock: NODE_BLOCK, media: MEDIA, defaultBlock: 'alternator' });
})(typeof window !== 'undefined' ? window : null);
