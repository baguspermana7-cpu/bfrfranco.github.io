/* rz-cx-subsheets.js — the inside of every block on the Cx schematic (K29). One RZDiagram sheet per
 * RZCxPlan.SYSTEMS id: the components a commissioning engineer walks, drawn with the IEC 60617 / ISA-5.1
 * glyphs of js/rz-eng-symbols.js, plus the system's L1–L5 test ladder. Ladders for UPS, chiller, CRAH,
 * BMS, EPMS and fire are the handbook's own worked examples (02.7.1–02.7.6); every other ladder is
 * condensed from the handbook chapter that owns the system, and each row carries that anchor. The
 * arrangement is a typical one for the MSC-1 basis (150 kV → 20 kV → 400 V, liquid + air cooling), not a
 * design: no quantities are printed here, the plan and the engine own those.
 *   RZCxSubsheets.ids()                 → system ids with a sheet
 *   RZCxSubsheets.get(id)               → { id, title, note, comps:[{id,name,does}], tests:[{level,text,cite}] }
 *   RZCxSubsheets.render(id, opts)      → { svg, warnings, width, height }  (opts.sel = component id)
 * Pure string rendering, works in Node. ES5. */
(function (root) {
  'use strict';
  var D = root.RZDiagram;
  var HB = 'cx-handbook/';
  var CH = { mv: HB + '13-mv-switchgear-transformers-cables.html', lv: HB + '14-lv-switchboards-busway-breakers-relays.html', gen: HB + '15-generators-fuel-synchronising.html',
    ups: HB + '16-ups-batteries-transfer-rack-power.html', plant: HB + '18-chw-plant-heat-rejection-flushing.html', air: HB + '19-air-side-liquid-cooling-tab.html',
    fire: HB + '20-fire-life-safety-cause-effect.html', bms: HB + '22-bms-commissioning-procedure.html', epms: HB + '24-epms-pme-commissioning.html',
    ot: HB + '26-ot-network-fibre-copper.html', lad: HB + '02-commissioning-process-levels-roles.html', ist: HB + '28-integrated-systems-testing.html' };
  /* edge media: one look per medium, the same tokens as the giant sheets */
  var MED = {
    hv: { stroke: 'alarm-fault', legend: '150 kV' }, mv: { stroke: 'accent', pattern: 'dashed', legend: '20 kV, dashed' },
    lv: { stroke: 'alarm-normal', pattern: 'dash-dot', legend: '400 V AC, dash-dot' }, dc: { stroke: 'link', legend: 'DC' },
    sup: { stroke: 'link', legend: 'supply (cold)' }, ret: { stroke: 'accent', pattern: 'dashed', legend: 'return (warm), dashed' },
    air: { stroke: 'soft', pattern: 'dash-dot', legend: 'air, dash-dot' }, sig: { pattern: 'dotted', legend: 'signal / data, dotted' },
    fuel: { stroke: 'soft', legend: 'fuel' }, ref: { stroke: 'muted', pattern: 'dash-dot', legend: 'refrigerant, dash-dot' },
    open: { stroke: 'soft', pattern: 'dotted' }   /* normally-open power path: always labelled on the drawing, no legend row */
  };
  function c(id, name, symbol, tag, does, o) { o = o || {}; o.id = id; o.name = name; o.symbol = symbol; o.tag = tag; o.does = does; return o; }
  function t(level, text, cite) { return { level: level, text: text, cite: cite }; }

  /* rows: arrays of components, drawn left→right; `col` pins a component to a column; `e` = medium of the
   * edge INTO it from its left neighbour (omit = no edge); links: [from, to, medium, label, sides?] */
  var SUB = {
    hv_intake: {
      title: 'Utility 150 kV intake', note: 'Two independent utility circuits into a gas-insulated 150 kV switchyard; line protection talks to the utility end.',
      rows: [[c('line_a', 'LINE BAY A', 'utility', '150 kV', 'Utility circuit A arriving at the switchyard.'),
              c('ds_a', 'LINE DISCONNECT', 'disconnect', 'isolate', 'Visible isolation of the line for work; earth switch behind it.', { e: 'hv' }),
              c('cb_a', 'LINE BREAKER', 'breaker', 'SF6 CB', 'Clears line faults on a trip from the line protection.', { e: 'hv' }),
              c('ct_vt', 'CT / VT', 'meter', 'metering', 'Current and voltage transformers feeding protection and revenue metering.', { e: 'hv' }),
              c('bus150', '150 kV BUS', 'switchgear', 'GIS', 'Double busbar that the main transformer bays hang from.', { e: 'hv', focal: true })],
             [c('line_b', 'LINE BAY B', 'utility', '150 kV', 'Second, independent utility circuit (N−1 at the intake).'),
              c('prot', 'LINE PROTECTION', 'meter', '87L / 21', 'Line differential and distance relays; trip the line breaker and signal the far end.', { col: 2 }),
              c('tx_bays', 'TO MAIN TX BAYS', 'transformer', 'out', 'Outgoing bays to the 150/20 kV main transformers.', { col: 4 })]],
      links: [['line_b', 'bus150', 'hv', 'circuit B'], ['ct_vt', 'prot', 'sig', 'secondary'], ['prot', 'cb_a', 'sig', 'trip'], ['bus150', 'tx_bays', 'hv', '']],
      tests: [t('L1', 'GIS bay FAT: power-frequency withstand, partial discharge, gas tightness, interlock logic', CH.mv + '#s13-5'),
              t('L2', 'Installation: gas handling, bay alignment, earthing, CT/VT wiring and shorting links', CH.mv + '#s13-11'),
              t('L3', 'CT ratio and polarity, VT tests, relay secondary injection, trip tests to every breaker', CH.mv + '#s13-10'),
              t('L4', 'Pre-energisation checklist, phasing with the utility, first energisation and online PD screening', CH.mv + '#s13-12'),
              t('L5', 'Loss of one utility circuit with the facility at load; transfer to the second circuit', CH.ist)]
    },
    main_tx: {
      title: '150/20 kV main transformers', note: 'One oil-filled ONAF transformer per hall per feed; the 20 kV incomer belongs to the board.',
      rows: [[c('hv_cb', '150 kV BAY BREAKER', 'breaker', 'HV CB', 'Switches and protects the transformer from the 150 kV side.'),
              c('tx', 'MAIN TRANSFORMER', 'transformer', '150/20 kV', 'Steps 150 kV down to the 20 kV distribution level.', { e: 'hv', focal: true }),
              c('ner', 'NEUTRAL EARTHING', 'disconnect', 'NER', 'Limits earth-fault current on the 20 kV system.', { e: 'mv' }),
              c('inc', '20 kV INCOMER', 'breaker', 'MV CB', 'Connects the transformer secondary to its 20 kV board section.', { e: 'mv' })],
             [c('oltc', 'ON-LOAD TAP CHANGER', 'meter', 'AVR', 'Holds the 20 kV voltage as load and utility voltage move.', { col: 1 }),
              c('mon', 'TEMP · BUCHHOLZ · DGA', 'tempSensor', 'monitor', 'Winding and oil temperature, gas relay and dissolved-gas monitoring.', { col: 2 }),
              c('p87', 'TX PROTECTION', 'meter', '87T / 51', 'Differential and overcurrent protection; trips the 150 kV and 20 kV breakers.', { col: 3 })]],
      links: [['tx', 'oltc', 'sig', ''], ['tx', 'mon', 'sig', ''], ['p87', 'inc', 'sig', 'trip']],
      tests: [t('L1', 'Routine factory tests: ratio, impedance, losses, applied and induced voltage, heat run where specified', CH.mv + '#s13-7'),
              t('L2', 'Delivery impact recorder read, assembly, oil filling and processing, earthing', CH.mv + '#s13-7'),
              t('L3', 'Turns ratio (TTR), winding resistance, insulation resistance, oil tests, protection injection', CH.mv + '#s13-7-2'),
              t('L4', 'Energise and soak, tap changer through its range, 87T stability and trip test', CH.mv + '#s13-12'),
              t('L5', 'Loss of one main transformer: the other feed carries the hall', CH.ist)]
    },
    mv_board: {
      title: '20 kV boards and feeders', note: 'Two sections joined by a normally-open bus tie so the sections never parallel; feeders to the unit substations.',
      rows: [[c('inc_a', 'INCOMER A', 'breaker', 'from TX-A', 'Feed from main transformer A.'),
              c('bus_a', 'BUS SECTION A', 'switchgear', '20 kV', 'Board section A, fed by incomer A; carries half the feeders.', { e: 'mv', focal: true }),
              c('tie', 'BUS TIE', 'breaker', 'NO', 'Normally open; closed only when one incomer is lost.', { e: 'open' }),
              c('bus_b', 'BUS SECTION B', 'switchgear', '20 kV', 'Board section B, fed by incomer B; carries the other half.', { e: 'open' }),
              c('inc_b', 'INCOMER B', 'breaker', 'from TX-B', 'Feed from main transformer B.', { e: 'mv' })],
             [c('gen_in', 'GENERATOR INCOMER', 'genset', 'standby', 'Paralleled generators connect here through their own breaker.', { col: 1 }),
              c('relay', 'FEEDER PROTECTION', 'meter', '50/51 · 67', 'Overcurrent and directional protection per feeder.', { col: 2 }),
              c('fdr', 'FEEDER BREAKERS', 'breaker', 'both sections', 'One breaker per outgoing cable to a unit substation, on each section.', { col: 3 }),
              c('cable', '20 kV CABLES', 'disconnect', 'XLPE', 'Feeder cables; sheath, VLF and tan δ tested before energisation.', { col: 4, e: 'mv' })]],
      links: [['gen_in', 'bus_a', 'open', 'ATS · NO'], ['bus_b', 'fdr', 'mv', ''], ['relay', 'fdr', 'sig', 'trip']],
      tests: [t('L1', 'Switchgear FAT: withstand, mechanical operations, interlocks, relay settings loaded', CH.mv + '#s13-5'),
              t('L2', 'Installation, busbar joints torque, earthing, cable terminations, outer sheath test', CH.mv + '#s13-8-2'),
              t('L3', 'Power-frequency withstand, contact resistance, VLF and tan δ on every cable, secondary injection', CH.mv + '#s13-8'),
              t('L4', 'Section energisation, phasing across the tie, incomer-loss transfer and interlock proving', CH.mv + '#s13-11-3'),
              t('L5', 'Utility loss: board sheds to generators and recovers without paralleling the sections', CH.ist)]
    },
    generators: {
      title: 'Generators and paralleling', note: 'Diesel sets paralleled on a common bus and connected to the 20 kV board through the generator incomer.',
      rows: [[c('tank', 'BULK FUEL', 'fuel', 'storage', 'Bulk storage and transfer pumps to each day tank.'),
              c('day', 'DAY TANK', 'fuel', 'per set', 'Local fuel for each engine; level controls the transfer pumps.', { e: 'fuel' }),
              c('gen', 'GENERATOR SET', 'genset', 'engine + alt', 'Engine and alternator; starts on loss of utility.', { e: 'fuel', focal: true }),
              c('gcb', 'GENERATOR BREAKER', 'breaker', 'sync', 'Closes onto the paralleling bus when synchronised.', { e: 'mv' }),
              c('pbus', 'PARALLELING BUS', 'switchgear', '20 kV', 'Common bus where the sets share load.', { e: 'mv' }),
              c('ats', 'TO 20 kV BOARD', 'ats', 'gen incomer', 'Transfer onto the 20 kV board sections.', { e: 'mv' })],
             [c('ctl', 'SYNC + LOAD SHARE', 'meter', 'controller', 'Synchroniser and load-sharing controller.', { col: 3 }),
              c('lb', 'LOAD BANK', 'itload', 'test only', 'Temporary resistive load for L4 load tests.', { col: 4 })]],
      links: [['ctl', 'gcb', 'sig', 'close'], ['lb', 'pbus', 'open', 'test']],
      tests: [t('L1', 'Factory test of each set: load steps, governor and AVR response, protective shutdowns', CH.gen + '#s15-3-3'),
              t('L2', 'Fuel pipe pressure test and flushing, fuel quality on delivery, alternator insulation', CH.gen + '#s15-5'),
              t('L3', 'First start, protective shutdown tests, controller set-up, point-to-point', CH.gen + '#s15-6'),
              t('L4', 'Load bank, ISO 8528-5 transients, NFPA 110 start time and block load, synchronising and load sharing', CH.gen + '#s15-7'),
              t('L5', 'Integrated test: loss of utility, sets start, parallel and carry the facility', CH.gen + '#s15-14-2')]
    },
    unit_subs: {
      title: '20/0.4 kV unit substations', note: 'Cast-resin transformers in 2N: each side of a pair runs near half load and can carry the whole.',
      rows: [[c('rmu', 'RING MAIN / FEEDER', 'breaker', '20 kV', 'Switches the 20 kV supply to the transformer.'),
              c('tx', 'CAST-RESIN TX', 'transformer', '20/0.4 kV', 'Steps 20 kV down to 400 V; dry type indoors.', { e: 'mv', focal: true }),
              c('acb', 'LV MAIN ACB', 'breaker', '400 V', 'Main air circuit breaker on the transformer secondary.', { e: 'lv' }),
              c('lvsb', 'LV SWITCHBOARD', 'switchgear', '400 V', 'Main low-voltage board feeding UPS and mechanical loads.', { e: 'lv' })],
             [c('wt', 'WINDING TEMP', 'tempSensor', 'PT100', 'Winding temperature; alarm, trip and fan control.', { col: 1 }),
              c('pair', 'PARTNER SUB (2N)', 'transformer', 'other feed', 'The other side of the 2N pair, on the other 20 kV section.', { col: 3 })]],
      links: [['tx', 'wt', 'sig', ''], ['pair', 'lvsb', 'open', 'other side']],
      tests: [t('L1', 'Routine factory tests of the cast-resin transformer, including partial discharge', CH.mv + '#s13-7'),
              t('L2', 'Installation, enclosure, earthing, terminations, temperature sensor wiring', CH.mv + '#s13-11'),
              t('L3', 'Ratio, winding resistance, insulation resistance, ACB tests and trip unit injection', CH.lv + '#s14-6-7'),
              t('L4', 'Energise, load through the board, main-tie-main transfer', CH.lv + '#s14-8-2'),
              t('L5', 'Loss of one 20 kV section: the partner substation carries the load', CH.ist)]
    },
    ups: {
      title: 'UPS and batteries', note: 'Double-conversion modules: rectifier, DC bus with battery, inverter; static and maintenance bypass around them.',
      rows: [[c('sbp', 'STATIC BYPASS', 'ats', 'auto', 'Transfers the load to raw mains on an inverter fault or overload.', { col: 2 }),
              c('mbp', 'MAINTENANCE BYPASS', 'disconnect', 'manual', 'Lets the module be isolated with the load on mains.', { col: 4 })],
             [c('in', 'INPUT BREAKER', 'breaker', '400 V', 'Feeds the rectifier from the LV switchboard.'),
              c('rect', 'RECTIFIER', 'inverter', 'AC → DC', 'Charges the battery and feeds the DC bus.', { e: 'lv' }),
              c('inv', 'INVERTER', 'inverter', 'DC → AC', 'Makes the conditioned output from the DC bus.', { e: 'dc', focal: true }),
              c('out', 'OUTPUT BREAKER', 'breaker', '400 V', 'Connects the module to the critical bus.', { e: 'lv' }),
              c('crit', 'CRITICAL BUS', 'pdu', 'to busway', 'Feeds the LV busway and the racks.', { e: 'lv' })],
             [c('bat', 'BATTERY STRING', 'battery', 'DC', 'Carries the load from loss of input until the generators are on.', { col: 1 })]],
      links: [['bat', 'inv', 'dc', 'DC bus', ['right', 'bottom']], ['in', 'sbp', 'open', 'bypass', ['top', 'left']], ['sbp', 'out', 'open', '', ['right', 'top']], ['mbp', 'crit', 'open', 'NO']],
      tests: [t('L1', 'FAT of UPS modules: efficiency at 25–100 % load, bypass transfer and back, step load 0 to 100 %, alarms', CH.lad + '#s02-7-1'),
              t('L2', 'Terminations, torque, cable IR at 1,000 V DC, battery rack installation, earthing', CH.lad + '#s02-7-1'),
              t('L3', 'OEM start-up, battery string voltage and internal ohmic values, settings, EPMS point-to-point', CH.lad + '#s02-7-1'),
              t('L4', 'Load bank 100 % for 8 h, step loads, loss and return of input, bypass transfers, discharge to end voltage', CH.lad + '#s02-7-1'),
              t('L5', 'Loss of utility; generator start and transfer; UPS carries load on battery; return to utility', CH.lad + '#s02-7-1')]
    },
    lv_busway: {
      title: 'LV switchboards, PDU and busway', note: 'A and B paths from separate UPS systems to every rack; tap-off units on overhead busway.',
      rows: [[c('sb', 'LV SWITCHBOARD', 'switchgear', 'A side', 'Critical-load board on the A side.'),
              c('fdr', 'BUSWAY FEEDER', 'breaker', 'ACB / MCCB', 'Protects the busway run.', { e: 'lv' }),
              c('bw', 'BUSWAY TRUNK', 'pdu', 'overhead', 'Overhead busbar trunk along the rack row.', { e: 'lv' }),
              c('tap', 'TAP-OFF UNIT', 'breaker', 'per rack', 'Plug-in unit with its own breaker for each rack feed.', { e: 'lv' }),
              c('rack', 'RACK (A + B)', 'itload', 'dual-corded', 'Each rack takes one cord from A and one from B.', { e: 'lv', focal: true })],
             [c('sb_b', 'B SIDE SWITCHBOARD', 'switchgear', 'B side', 'The same chain from the B UPS system.', { col: 0 }),
              c('bw_b', 'B BUSWAY', 'pdu', 'B side', 'Second busway run carrying the B cords.', { col: 2, e: 'lv' })],
             [c('pm', 'BRANCH METERING', 'meter', 'EPMS', 'Per-feed metering into EPMS.', { col: 3 })]],
      links: [['bw_b', 'rack', 'lv', 'B cord', ['right', 'bottom']], ['tap', 'pm', 'sig', '']],
      tests: [t('L1', 'Switchboard FAT: dielectric, functional, interlocks; busway type-test certificates', CH.lv + '#s14-4'),
              t('L2', 'Busway joint torque, insulation resistance, tap-off installation, earthing continuity', CH.lv + '#s14-5-3'),
              t('L3', 'ACB/MCCB tests, RCD tests, relay injection, phase rotation at every tap-off', CH.lv + '#s14-6'),
              t('L4', 'Load bank through the busway, thermal scan at load, A/B independence check', CH.lv + '#s14-5'),
              t('L5', 'Loss of the A path at full load: every rack stays up on B', CH.ist)]
    },
    chillers: {
      title: 'Chillers', note: 'Air-path cooling only: chilled water to the CRAH coils, condenser heat to the dry coolers.',
      rows: [[c('chwr', 'CHW RETURN', 'valve', 'from CRAH', 'Warm chilled water back from the CRAH coils.'),
              c('chwp', 'CHW PUMP', 'pump', 'duty / standby', 'Moves chilled water through the evaporator.', { e: 'ret' }),
              c('evap', 'EVAPORATOR', 'heatExchanger', 'CHW', 'Takes the heat out of the chilled water.', { e: 'ret' }),
              c('comp', 'COMPRESSOR', 'chiller', 'refrigerant', 'Lifts the heat to condenser temperature.', { e: 'ref', focal: true }),
              c('cond', 'CONDENSER', 'heatExchanger', 'CDW', 'Hands the heat to the condenser water.', { e: 'ref' })],
             [c('chws', 'CHW SUPPLY', 'valve', 'to CRAH', 'Chilled water out to the CRAH coils.', { col: 2 }),
              c('ctl', 'PLANT CONTROLS', 'bms', 'staging', 'Stages chillers and pumps on load and supply temperature.', { col: 3 }),
              c('cdw', 'TO DRY COOLERS', 'dryCooler', 'CDW', 'Condenser water to heat rejection.', { col: 4 })]],
      links: [['evap', 'chws', 'sup', 'CHW supply'], ['cond', 'cdw', 'ret', 'CDW'], ['ctl', 'comp', 'sig', 'stage']],
      tests: [t('L1', 'Factory performance test to AHRI 550/590: capacity, power, efficiency at 100/75/50/25 %, safeties', CH.lad + '#s02-7-2'),
              t('L2', 'Installation, isolators, pressure test of field piping, flushing per BSRIA BG 29, power cable IR', CH.lad + '#s02-7-2'),
              t('L3', 'OEM start-up, refrigerant charge, safeties, flow switch, sensor calibration, BMS point-to-point', CH.lad + '#s02-7-2'),
              t('L4', 'Staging sequence test, capacity test with heater load, restart after power loss, alarms', CH.lad + '#s02-7-2'),
              t('L5', 'Chiller trip during IST; restart after utility loss; recovery of supply temperature', CH.lad + '#s02-7-2')]
    },
    dry_coolers: {
      title: 'Dry coolers', note: 'Closed-circuit V-bank coolers with EC fans; no water consumed. Approach to ambient sets the warm-loop limit.',
      rows: [[c('hdr_r', 'RETURN HEADER', 'valve', 'warm', 'Warm fluid from the FWS loop and the chiller condensers.'),
              c('iso', 'ISOLATION + BALANCING', 'valve', 'per unit', 'Isolates and balances each cooler.', { e: 'ret' }),
              c('dc', 'V-BANK COOLER', 'dryCooler', 'EC fans', 'Rejects the heat to outdoor air.', { e: 'ret', focal: true }),
              c('hdr_s', 'SUPPLY HEADER', 'valve', 'cooled', 'Cooled fluid back to the FWS pumps.', { e: 'sup' })],
             [c('amb', 'AMBIENT SENSOR', 'tempSensor', 'DB', 'Outdoor dry-bulb; sets the fan speed and the free-cooling limit.', { col: 1 }),
              c('lt', 'LEAVING TEMP', 'tempSensor', 'per unit', 'Leaving fluid temperature; approach = leaving − ambient.', { col: 3 })]],
      links: [['amb', 'dc', 'sig', 'fan speed'], ['lt', 'hdr_s', 'sig', '']],
      tests: [t('L1', 'Factory test of the first unit of each type: coil leak test, fan curve, controller', CH.plant + '#s18-7-3'),
              t('L2', 'Hydrostatic pressure test of headers and connections, flushing and water quality', CH.plant + '#s18-3'),
              t('L3', 'Fan rotation, EC fan control, sensor calibration, BMS point-to-point', CH.plant + '#s18-10-1'),
              t('L4', 'Approach at measured ambient, fan staging on leaving temperature, unit-loss response', CH.plant + '#s18-11-1'),
              t('L5', 'Heat rejection holds through utility loss and restart', CH.plant + '#s18-11-2')]
    },
    fws: {
      title: 'FWS pumps, manifold and treatment', note: 'Facility water loop between the CDUs and heat rejection; side-stream filtration and dosing keep it clean.',
      rows: [[c('ret', 'FROM CDUs', 'heatExchanger', 'warm', 'Warm facility water back from the CDU primaries.'),
              c('str', 'STRAINER', 'valve', 'ΔP', 'Protects the pumps; ΔP across it is trended.', { e: 'ret' }),
              c('pump', 'FWS PUMPS', 'pump', 'N+1', 'Duty and standby pumps on variable speed.', { e: 'ret', focal: true }),
              c('rej', 'TO DRY COOLERS', 'dryCooler', 'reject', 'Out to heat rejection.', { e: 'ret' }),
              c('sup', 'TO CDUs', 'heatExchanger', 'cool', 'Cooled facility water to the CDU primaries.', { e: 'sup' })],
             [c('exp', 'PRESSURISATION', 'valve', 'static', 'Expansion and pressurisation: holds loop static pressure as temperature changes.', { col: 2 }),
              c('dose', 'FILTER + DOSING', 'valve', 'side stream', 'Side-stream filtration and chemical dosing.', { col: 3 }),
              c('fm', 'FLOW + ΔP', 'meter', 'pump speed', 'Loop flow and differential pressure; they set pump speed.', { col: 4 })]],
      links: [['exp', 'pump', 'sig', ''], ['dose', 'rej', 'sup', 'side stream'], ['fm', 'sup', 'sig', '']],
      tests: [t('L1', 'Pump factory test against its curve; vibration', CH.plant + '#s18-7-3'),
              t('L2', 'Hydrostatic pressure test, cleaning and flushing at velocity, water-quality acceptance', CH.plant + '#s18-4'),
              t('L3', 'Pump start-up and rotation, sensor calibration, dosing set-up', CH.plant + '#s18-7-5'),
              t('L4', 'Duty/standby changeover, ΔP control, flow at design, alarms', CH.plant + '#s18-7-7'),
              t('L5', 'Pump trip and restart during utility loss; loop recovers before CDU alarms', CH.plant + '#s18-11-2')]
    },
    cdu: {
      title: 'CDUs', note: 'The only place the two liquid loops meet: a plate heat exchanger between FWS (primary) and TCS (secondary).',
      rows: [[c('fws_in', 'FWS SUPPLY', 'valve', 'primary', 'Facility water into the CDU.'),
              c('cv', 'CONTROL VALVE', 'valve', '2-way', 'Modulates primary flow to hold TCS supply temperature.', { e: 'sup' }),
              c('hx', 'PLATE HX', 'heatExchanger', 'FWS ↔ TCS', 'Moves rack heat from TCS to FWS; the fluids never mix.', { e: 'sup', focal: true }),
              c('fws_out', 'FWS RETURN', 'valve', 'primary', 'Warmed facility water back to the plant.', { e: 'ret', col: 4 })],
             [c('tcs_r', 'TCS RETURN', 'valve', 'from racks', 'Warm coolant back from the rack manifolds.'),
              c('filt', 'FILTER', 'valve', 'fine', 'Protects cold plates from particles.', { e: 'ret' }),
              c('pumps', 'TCS PUMPS', 'pump', 'N+1', 'Redundant secondary pumps.', { e: 'ret' }),
              c('tcs_s', 'TCS SUPPLY', 'rack', 'to racks', 'Coolant to the rack manifolds.', { col: 3 })],
             [c('sens', 'T · P · FLOW · LEAK', 'tempSensor', 'secondary', 'Supply/return temperature, pressure, flow and the leak tray; they drive the control valve and pumps.', { col: 2 })]],
      links: [['pumps', 'hx', 'ret', 'to HX'], ['hx', 'tcs_s', 'sup', 'TCS supply', ['right@0.8', 'top']], ['sens', 'pumps', 'sig', '']],
      tests: [t('L1', 'CDU factory test: pump curves, HX capacity, controls, leak test', CH.air + '#s19-11'),
              t('L2', 'TCS pipework hydrostatic test, cleaning and flushing, fluid quality', CH.air + '#s19-9'),
              t('L3', 'Fill and vent, pump start-up, sensor calibration, filtration check', CH.air + '#s19-11-3'),
              t('L4', 'Functional tests and failover: pump loss, valve fail position, control on supply temperature', CH.air + '#s19-13'),
              t('L5', 'Heat-load test with liquid load banks; CDU behaviour in IST scenarios', CH.air + '#s19-14')]
    },
    crah: {
      title: 'CRAH and fan walls', note: 'The air path: chilled-water coil and EC fans serving the share of heat that does not go to the cold plates.',
      rows: [[c('chw', 'CHW SUPPLY', 'valve', 'from chillers', 'Chilled water from the plant.'),
              c('v', 'CONTROL VALVE', 'valve', 'modulating', 'Holds supply air temperature.', { e: 'sup' }),
              c('coil', 'COOLING COIL', 'heatExchanger', 'air ↔ CHW', 'Cools the hot-aisle air.', { e: 'sup' }),
              c('fan', 'EC FAN WALL', 'crah', 'N+1', 'Moves air into the cold aisle.', { e: 'air', focal: true }),
              c('cold', 'COLD AISLE', 'rack', 'supply air', 'Contained cold aisle in front of the racks.', { e: 'air' })],
             [c('th', 'T + RH SENSORS', 'humiditySensor', 'aisle', 'Supply and aisle temperature and humidity; they set the valve.', { col: 1 }),
              c('hot', 'HOT AISLE RETURN', 'rack', 'contained', 'Hot-aisle containment returns air to the coil.', { col: 2 }),
              c('dp', 'AISLE ΔP', 'meter', 'fan speed', 'Containment pressure that sets fan speed.', { col: 3 })]],
      links: [['hot', 'coil', 'air', 'return air'], ['th', 'v', 'sig', 'SAT'], ['dp', 'fan', 'sig', 'speed']],
      tests: [t('L1', 'FAT of the first unit of each type: fan curve, coil capacity, controller, alarms', CH.lad + '#s02-7-3'),
              t('L2', 'Coil and condensate connections, filters, power IR, CHW connection pressure test', CH.lad + '#s02-7-3'),
              t('L3', 'Start-up, fan rotation, controller settings, point-to-point, airflow by the TAB contractor', CH.lad + '#s02-7-3'),
              t('L4', 'Supply air temperature control, fan speed on pressure, unit failure and standby response', CH.lad + '#s02-7-3'),
              t('L5', 'Loss of one CRAH at full air load; loss of chilled water; recovery after utility loss', CH.lad + '#s02-7-3')]
    },
    racks: {
      title: 'Racks and TCS manifolds', note: 'Direct liquid cooling: TCS manifolds and quick disconnects to the cold plates; A and B power cords.',
      rows: [[c('sup', 'TCS SUPPLY MANIFOLD', 'valve', 'row', 'Row manifold from the CDU.'),
              c('qd', 'QUICK DISCONNECTS', 'valve', 'dripless', 'Lets a tray be removed without draining the loop.', { e: 'sup' }),
              c('cp', 'COLD PLATES', 'rack', 'GPU / CPU', 'Take the chip heat into the coolant.', { e: 'sup', focal: true }),
              c('ret', 'TCS RETURN MANIFOLD', 'valve', 'row', 'Warm coolant back to the CDU.', { e: 'ret' })],
             [c('lk', 'LEAK SENSOR', 'humiditySensor', 'rack base', 'Leak detection under the quick disconnects at the base of the rack.', { col: 1 }),
              c('pa', 'POWER A + B', 'pdu', 'rack PDUs', 'Two cords from independent paths.', { col: 2 }),
              c('ts', 'OUTLET TEMP', 'tempSensor', 'per rack', 'Coolant leaving temperature at the rack.', { col: 3 })]],
      links: [['lk', 'qd', 'sig', ''], ['pa', 'cp', 'lv', 'A + B'], ['ts', 'ret', 'sig', '']],
      tests: [t('L1', 'Manifold and quick-disconnect factory leak and pressure tests', CH.air + '#s19-9'),
              t('L2', 'TCS hydrostatic test, cleaning and flushing to the water-quality values', CH.air + '#s19-10'),
              t('L3', 'Fill and vent, QD engagement, sensor checks, rack PDU and cord checks', CH.air + '#s19-11'),
              t('L4', 'Heat-load test with liquid load banks at design flow and temperature', CH.air + '#s19-14-4'),
              t('L5', 'Racks at load through CDU, pump and power-path failures in IST', CH.ist)]
    },
    fire: {
      title: 'Fire detection and suppression', note: 'Detection to panel to release, with every interface the cause-and-effect matrix names.',
      rows: [[c('asd', 'ASPIRATING', 'aspirating', 'VESDA', 'Very early smoke detection from sampling pipes.'),
              c('sd', 'SPOT DETECTORS', 'smokeDetector', 'cross-zoned', 'Second, independent detection for confirmation.', { e: 'sig' }),
              c('facp', 'FIRE PANEL', 'bms', 'FACP', 'Decides alarm, pre-discharge and release from the C&E matrix.', { e: 'sig', focal: true }),
              c('rel', 'AGENT RELEASE', 'agentCylinder', 'clean agent', 'Releases agent into the protected room after the delay.', { e: 'sig' })],
             [c('mcp', 'MANUAL STATIONS', 'manualStation', 'MCP', 'Manual alarm and manual release / abort.', { col: 1 }),
              c('epo', 'EPO + SHUTDOWNS', 'epo', 'interfaces', 'EPO, fan stop, damper close, BMS status.', { col: 2 }),
              c('spr', 'PRE-ACTION SPRINKLER', 'sprinkler', 'double interlock', 'Water only after detection and pipe pressure loss.', { col: 3 })]],
      links: [['mcp', 'facp', 'sig', ''], ['facp', 'epo', 'sig', 'C&E', ['bottom', 'top']], ['facp', 'spr', 'sig', '']],
      tests: [t('L1', 'Panel FAT where specified; agent cylinder certificates', CH.lad + '#s02-7-6'),
              t('L2', 'Device installation, pipe pressure test, nozzle check, room sealing', CH.lad + '#s02-7-6'),
              t('L3', 'Device-by-device test from the real initiating device; enclosure integrity (door fan) test', CH.lad + '#s02-7-6'),
              t('L4', 'Cause-and-effect test of every interface from real devices: fans, dampers, release sequence, EPO', CH.lad + '#s02-7-6'),
              t('L5', 'Fire alarm scenario during IST with all systems live; authority inspection as a hold point', CH.lad + '#s02-7-6')]
    },
    bms: {
      title: 'BMS', note: 'Field devices to controllers to servers; the BMS supervises the mechanical plant and reads fire and power status.',
      rows: [[c('fd', 'FIELD DEVICES', 'tempSensor', 'I/O', 'Sensors and actuators on the plant.'),
              c('ddc', 'DDC CONTROLLERS', 'bms', 'per plant', 'Run the sequences locally.', { e: 'sig' }),
              c('net', 'BACnet/IP', 'fabric', 'OT network', 'Controller network, ring topology.', { e: 'sig' }),
              c('srv', 'BMS SERVERS', 'bms', 'redundant', 'Alarms, trends and graphics; hot standby.', { e: 'sig', focal: true }),
              c('hmi', 'OPERATOR HMI', 'bms', 'NOC', 'Operator stations in the NOC: alarms, graphics and overrides.', { e: 'sig' })],
             [c('vlv', 'VALVES + DRIVES', 'valve', 'outputs', 'Actuators the sequences drive.', { col: 0 }),
              c('gw', 'INTEGRATION GW', 'fabric', 'Modbus / OPC', 'Gateways to chillers, CDUs, UPS and fire panel.', { col: 2 })]],
      links: [['ddc', 'vlv', 'sig', 'AO / DO', ['bottom', 'right']], ['gw', 'net', 'sig', '']],
      tests: [t('L1', 'FAT of panels and software with simulated inputs and outputs', CH.lad + '#s02-7-4'),
              t('L2', 'Panel and field device installation inspection; cable tests', CH.lad + '#s02-7-4'),
              t('L3', 'Network checkout, point-to-point, calibration, actuator stroke', CH.lad + '#s02-7-4'),
              t('L4', 'Loop tuning, sequences, alarms, trends, graphics, failover, restart', CH.lad + '#s02-7-4'),
              t('L5', 'BMS behaviour in IST scenarios', CH.lad + '#s02-7-4')]
    },
    epms: {
      title: 'EPMS / PME', note: 'Power monitoring from the 150 kV bays to the busway, time-aligned for sequence of events.',
      rows: [[c('ct', 'CT / VT', 'meter', 'primary', 'Instrument transformers on every metered feeder.'),
              c('pm', 'POWER METERS', 'meter', 'class 0.5S', 'Energy and demand per feeder.', { e: 'sig' }),
              c('pq', 'PQ METERS', 'meter', 'waveform', 'Power quality and waveform capture at key nodes.', { e: 'sig' }),
              c('gw', 'GATEWAYS', 'fabric', 'Modbus / 61850', 'Collect devices onto the OT network.', { e: 'sig' }),
              c('srv', 'EPMS SERVER', 'bms', 'historian', 'Alarms, reports and the sequence-of-events log.', { e: 'sig', focal: true })],
             [c('gps', 'TIME SYNC', 'meter', 'GPS / PTP', 'Common time so events from all devices line up.', { col: 3 }),
              c('relay', 'RELAYS + UPS', 'breaker', 'events', 'Protection relays and UPS controllers reporting events.', { col: 2 })]],
      links: [['gps', 'gw', 'sig', 'time'], ['relay', 'gw', 'sig', '']],
      tests: [t('L1', 'Server and software FAT with simulated devices; report and alarm templates', CH.lad + '#s02-7-5'),
              t('L2', 'Meter wiring, CT polarity, shorting blocks, network cabling', CH.lad + '#s02-7-5'),
              t('L3', 'Device configuration, communication, point-to-point against switchboard displays, time sync', CH.lad + '#s02-7-5'),
              t('L4', 'Alarms, sequence-of-events time stamps across devices, PQ capture, BMS and DCIM interfaces', CH.lad + '#s02-7-5'),
              t('L5', 'Event records of every IST scenario, time-aligned across UPS, switchgear and generators', CH.lad + '#s02-7-5')]
    },
    ot_network: {
      title: 'OT network and DCIM', note: 'Separate operational network for BMS, EPMS and fire interfaces, with one controlled path to the enterprise side.',
      rows: [[c('pp', 'FIBRE + COPPER', 'patchPanel', 'structured', 'Fibre and copper cabling with tested links.'),
              c('acc', 'FIELD SWITCHES', 'fabric', 'ring', 'Access switches in plant rooms on a resilient ring.', { e: 'sig' }),
              c('core', 'OT CORE', 'fabric', 'redundant', 'Core switches for the OT zone.', { e: 'sig' }),
              c('fw', 'OT FIREWALL', 'fabric', 'zone boundary', 'The single controlled conduit to IT and remote access.', { e: 'sig' }),
              c('dcim', 'DCIM', 'bms', 'capacity · assets', 'Asset, capacity and power-chain views fed by BMS and EPMS.', { e: 'sig', focal: true })],
             [c('bms', 'BMS', 'bms', 'zone', 'BMS controllers and servers.', { col: 1 }),
              c('epms', 'EPMS', 'meter', 'zone', 'EPMS gateways and servers.', { col: 2 })]],
      links: [['bms', 'acc', 'sig', ''], ['epms', 'core', 'sig', '']],
      tests: [t('L1', 'Switch and firewall configuration review and staging', CH.ot + '#s26-13'),
              t('L2', 'Installation checks, polarity, Tier 1 optical loss and copper certification', CH.ot + '#s26-8'),
              t('L3', 'OTDR on backbone fibres, addressing, VLANs and firewall rules', CH.ot + '#s26-9'),
              t('L4', 'Network commissioning: ring failover, time sync, DCIM data from BMS and EPMS', CH.ot + '#s26-13-2'),
              t('L5', 'Monitoring stays up through IST power and network failures', CH.ist)]
    }
  };

  var W = 186, H = 96, GX = 58, GY = 74, X0 = 24, Y0 = 40;
  function ids() { var o = []; for (var k in SUB) if (Object.prototype.hasOwnProperty.call(SUB, k)) o.push(k); return o; }
  function comps(s) { var out = []; for (var r = 0; r < s.rows.length; r++) for (var i = 0; i < s.rows[r].length; i++) out.push(s.rows[r][i]); return out; }
  function get(id) {
    var s = SUB[id]; if (!s) return null;
    return { id: id, title: s.title, note: s.note, tests: s.tests.slice(), comps: comps(s).map(function (k) { return { id: k.id, name: k.name, tag: k.tag, does: k.does }; }) };
  }
  function pt(b, side) {
    var f = side.split('@'); side = f[0];
    if (f[1]) { var k = +f[1]; if (side === 'right') return { x: b.x + b.w, y: b.y + b.h * k }; if (side === 'left') return { x: b.x, y: b.y + b.h * k }; if (side === 'bottom') return { x: b.x + b.w * k, y: b.y + b.h }; return { x: b.x + b.w * k, y: b.y }; }
    if (side === 'top') return { x: b.x + b.w / 2, y: b.y }; if (side === 'bottom') return { x: b.x + b.w / 2, y: b.y + b.h };
    if (side === 'left') return { x: b.x, y: b.y + b.h / 2 }; return { x: b.x + b.w, y: b.y + b.h / 2 };
  }
  function sides(a, b) {
    if (Math.abs(a.x - b.x) < 2) return a.y < b.y ? ['bottom', 'top'] : ['top', 'bottom'];
    if (Math.abs(a.y - b.y) < 2) return a.x < b.x ? ['right', 'left'] : ['left', 'right'];
    return a.y < b.y ? ['bottom', 'top'] : ['top', 'bottom'];
  }
  function edgeOpts(m, label, seen) {
    var base = MED[m] || MED.sig, o = { tier: 2 };
    if (base.stroke) o.stroke = base.stroke; if (base.pattern) o.pattern = base.pattern;
    if (m !== 'sig' && m !== 'open') o.state = 'flow';
    if (label) o.label = label;
    if (!seen[m] && base.legend) { seen[m] = 1; o.legend = base.legend; }
    return o;
  }
  function render(id, opts) {
    var s = SUB[id]; if (!s || !D) return null; opts = opts || {};
    var cols = 0, r, i; for (r = 0; r < s.rows.length; r++) for (i = 0; i < s.rows[r].length; i++) cols = Math.max(cols, (s.rows[r][i].col != null ? s.rows[r][i].col : i) + 1);
    var ctx = D.create({ width: X0 * 2 + cols * W + (cols - 1) * GX, height: Y0 + s.rows.length * (H + GY) + 40, slug: 'cxsub-' + id, title: s.title + ' — inside the block', desc: s.note });
    var box = {}, seen = {};
    for (r = 0; r < s.rows.length; r++) {
      var prev = null;
      for (i = 0; i < s.rows[r].length; i++) {
        var k = s.rows[r][i], col = k.col != null ? k.col : i;
        var o = { id: k.id, name: k.name, tag: k.tag, symbol: k.symbol, sublabel: k.does.length > 34 ? '' : k.does, interactive: true, w: W, h: H, tier: k.focal ? 1 : 2, focal: !!k.focal, state: opts.sel === k.id ? 'selected' : 'none' };
        delete o.sublabel; if (k.tag) o.sublabel = k.tag; o.tag = null;
        var b = ctx.node(X0 + col * (W + GX), Y0 + r * (H + GY), o); b.id = k.id; box[k.id] = b;
        if (prev && k.e) ctx.edge(pt(prev, 'right'), pt(b, 'left'), edgeOpts(k.e, '', seen));
        prev = b;
      }
    }
    var L = s.links || [];
    for (i = 0; i < L.length; i++) {
      var a = box[L[i][0]], z = box[L[i][1]]; if (!a || !z) continue;
      var sd = L[i][4] || sides(a, z);
      ctx.edge(pt(a, sd[0]), pt(z, sd[1]), edgeOpts(L[i][2], L[i][3], seen));
    }
    ctx.legend({}); ctx.fit(16);
    return { svg: ctx.render(), warnings: ctx.warnings.slice(), width: ctx.width, height: ctx.height };
  }
  var API = { ids: ids, get: get, render: render, CHAPTERS: CH, version: '3.33.0' };
  root.RZCxSubsheets = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
