/* ============================================================================
 * ltc-hub.js — Standards map: one liquid-to-chip plant, the standards that
 * govern each block, and the tool that answers the question for it.
 * ----------------------------------------------------------------------------
 * The figure and the coverage matrix are built from ONE table (SYSTEMS), so a
 * block cannot appear in the drawing and be missing from the matrix, or the
 * reverse. Statements are summaries of the cited documents, written to be
 * checkable; they are not quotations and not compliance advice.
 * ==========================================================================*/
(function () {
  'use strict';
  var L = window.LTC;

  var BODIES = ['ASHRAE', 'Uptime', 'TIA', 'NFPA', 'ISO/IEC'];

  /* role per reference: governs (sets a requirement on the block), measures
   * (defines a metric taken at the block), references (relevant, not binding) */
  var SYSTEMS = [
    { id: 'utility', sym: 'utility', name: 'Utility intake', sub: 'MV service', refs: [
      { body: 'Uptime', role: 'governs', code: 'Tier Standard: Topology',
        text: 'For Tier III and IV the engine-generator plant is the primary power source; the utility is treated as an economic alternative, not a redundant one.',
        tool: ['ltc-uptime-tier-alignment.html#simulator', 'Test the power path'] },
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-2',
        text: 'Total facility energy for PUE is taken at the facility boundary: utility metering plus any on-site generation.',
        tool: ['ltc-iso-energy-governance.html#kpi', 'Compute PUE'] } ] },
    { id: 'genset', sym: 'genset', name: 'Engine generators', sub: 'standby / primary', refs: [
      { body: 'Uptime', role: 'governs', code: 'Tier Standard: Topology',
        text: 'Every Tier requires at least 12 hours of on-site fuel. Tier III/IV generators must carry the site without a runtime limit at the rating used.',
        tool: ['ltc-uptime-tier-alignment.html#simulator', 'Take a generator out'] },
      { body: 'NFPA', role: 'references', code: 'NFPA 110',
        text: 'Emergency and standby power systems. Type 10 means power restored to the load within 10 seconds of loss.' } ] },
    { id: 'swgr', sym: 'switchgear', name: 'Switchgear + ATS', sub: 'LV main boards', refs: [
      { body: 'Uptime', role: 'governs', code: 'Concurrent maintainability',
        text: 'Tier III: each component and each distribution path can be removed for planned work without affecting the IT load.',
        tool: ['ltc-uptime-tier-alignment.html#simulator', 'Sweep every component'] },
      { body: 'NFPA', role: 'references', code: 'NFPA 70E',
        text: 'Arc-flash risk assessment and equipment labelling before energized work.' } ] },
    { id: 'ups', sym: 'ups', name: 'UPS', sub: 'N / N+1 / 2N', refs: [
      { body: 'Uptime', role: 'governs', code: 'Capacity components',
        text: 'Tier II adds redundant capacity components (N+1); Tier III/IV add redundant distribution paths.',
        tool: ['ltc-uptime-tier-alignment.html#availability', 'Series / parallel availability'] },
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-2 · PUE1',
        text: 'Category 1 PUE takes IT energy at the UPS output — the coarsest of the three categories.',
        tool: ['ltc-iso-energy-governance.html#kpi', 'Compare PUE categories'] } ] },
    { id: 'pdu', sym: 'pdu', name: 'PDU / RPP', sub: 'rack feeds A + B', refs: [
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-2 · PUE2',
        text: 'Category 2 PUE takes IT energy at the PDU output, so transformer and PDU losses move to the overhead side.',
        tool: ['ltc-iso-energy-governance.html#kpi', 'Compare PUE categories'] },
      { body: 'NFPA', role: 'governs', code: 'NFPA 70 Art. 645 / NFPA 75',
        text: 'Where an IT room is designed under Article 645, a remote disconnecting means (EPO) for the room’s IT power and HVAC is required.',
        tool: ['ltc-nfpa-fire-risk.html#sequence', 'Fire sequence'] } ] },
    { id: 'racks', sym: 'rack', name: 'IT racks', sub: 'cold plates + air', focal: true, refs: [
      { body: 'ASHRAE', role: 'governs', code: 'TC 9.9 Thermal Guidelines',
        text: 'Server inlet air is the control point. Recommended envelope 18–27 °C for classes A1–A4; allowable limits depend on class.',
        tool: ['ltc-ashrae-thermal-control.html#envelope', 'Check an inlet condition'] },
      { body: 'TIA', role: 'governs', code: 'TIA-942-B · EDA',
        text: 'Equipment distribution area: where horizontal cabling terminates at the racks.',
        tool: ['ltc-ansi-tia-topology-readiness.html#spaces', 'Spaces & cabling'] },
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-2 · PUE3',
        text: 'Category 3 PUE takes IT energy at the IT equipment input — the most accurate category.' } ] },
    { id: 'cdu', sym: 'cdu', name: 'CDU', sub: 'liquid-to-liquid', refs: [
      { body: 'ASHRAE', role: 'governs', code: 'TC 9.9 liquid cooling classes',
        text: 'Facility water is classed W17, W27, W32, W40, W45 or W+ by its maximum supply temperature.',
        tool: ['ltc-ashrae-thermal-control.html#liquid', 'Classify a supply temperature'] },
      { body: 'ASHRAE', role: 'references', code: 'Loop sizing',
        text: 'Flow, ΔT, pump power and PUE for the whole chain are computed in the system model.',
        tool: ['ltc-system-modelling-lab.html', 'Open the model'] } ] },
    { id: 'reject', sym: 'dryCooler', name: 'Heat rejection', sub: 'dry coolers', refs: [
      { body: 'ASHRAE', role: 'governs', code: 'Standard 90.4',
        text: 'Energy standard for data centers: compliance via the mechanical load component (MLC) and the electrical loss component (ELC).' },
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-9 · WUE',
        text: 'Site water use per unit of IT energy (L/kWh). Dry heat rejection drives it toward zero.',
        tool: ['ltc-iso-energy-governance.html#kpi', 'Compute WUE'] } ] },
    { id: 'fire', sym: 'aspirating', name: 'Fire protection', sub: 'detect · suppress', refs: [
      { body: 'NFPA', role: 'governs', code: 'NFPA 75 / 76',
        text: 'Fire protection of IT equipment rooms (75) and telecommunications facilities (76).' },
      { body: 'NFPA', role: 'governs', code: 'NFPA 72',
        text: 'Detection and signalling: detector spacing, aspirating sensitivity, alarm sequence.',
        tool: ['ltc-nfpa-fire-risk.html#detection', 'Detector count'] },
      { body: 'NFPA', role: 'governs', code: 'NFPA 2001',
        text: 'Clean-agent systems: agent quantity from room volume, design concentration and temperature.',
        tool: ['ltc-nfpa-fire-risk.html#agent', 'Size the agent'] },
      { body: 'TIA', role: 'references', code: 'TIA-942-B annex',
        text: 'Rated facilities reference suppression type alongside power and cooling redundancy.' } ] },
    { id: 'tx', sym: 'transformer', name: 'Transformers', sub: 'MV / LV', refs: [
      { body: 'Uptime', role: 'governs', code: 'Tier Standard: Topology',
        text: 'Transformers are capacity components on the distribution path: Tier III needs each one removable for maintenance without dropping the IT load.',
        tool: ['ltc-uptime-tier-alignment.html#simulator', 'Test the power path'] },
      { body: 'NFPA', role: 'references', code: 'NFPA 70 Art. 450',
        text: 'Installation of transformers and transformer vaults.' },
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-2',
        text: 'Transformer losses sit on the overhead side of PUE at every category.',
        tool: ['ltc-iso-energy-governance.html#kpi', 'Compare PUE categories'] } ] },
    { id: 'mcc', sym: 'breaker', name: 'MCC A / B', sub: 'mechanical power', refs: [
      { body: 'Uptime', role: 'governs', code: 'Tier Standard: Topology',
        text: 'Cooling is critical infrastructure: the power paths to pumps, CRAHs and chillers must meet the same Tier objective as the IT power path.',
        tool: ['ltc-uptime-tier-alignment.html#simulator', 'Sweep the cooling path'] },
      { body: 'NFPA', role: 'references', code: 'NFPA 70 Art. 430',
        text: 'Motors, motor circuits and controllers.' } ] },
    { id: 'elec', sym: 'crah', name: 'Electrical rooms', sub: 'UPS · TX loss cooling', refs: [
      { body: 'Uptime', role: 'governs', code: 'Tier Standard: Topology',
        text: 'UPS and battery rooms need cooling with the same redundancy as the systems they protect; a UPS room that overheats takes the IT load with it.' },
      { body: 'NFPA', role: 'governs', code: 'NFPA 855',
        text: 'Stationary energy storage (lithium-ion UPS batteries): spacing, ventilation and thermal-runaway protection.' },
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-2',
        text: 'The cooling energy spent on electrical losses is overhead in PUE.' } ] },
    { id: 'fws', sym: 'pump', name: 'Facility water', sub: 'FWS pumps', refs: [
      { body: 'ASHRAE', role: 'governs', code: 'TC 9.9 liquid cooling classes',
        text: 'The facility-water supply temperature sets the W-class (W17 … W45, W+), and with it which heat rejection can run without a chiller.',
        tool: ['ltc-ashrae-thermal-control.html#liquid', 'Classify a supply temperature'] },
      { body: 'Uptime', role: 'governs', code: 'Concurrent maintainability',
        text: 'Pumps, valves and pipe sections are components: Tier III needs each isolatable without stopping flow to the CDUs.' } ] },
    { id: 'trim', sym: 'chiller', name: 'Trim chiller', sub: 'on hot hours', refs: [
      { body: 'ASHRAE', role: 'governs', code: 'Standard 90.4',
        text: 'Mechanical load component: the hours the trim chiller runs are where a dry heat-rejection design loses its efficiency.' } ] },
    { id: 'crah', sym: 'crah', name: 'CRAHs', sub: 'residual air heat', refs: [
      { body: 'ASHRAE', role: 'governs', code: 'TC 9.9 Thermal Guidelines',
        text: 'Liquid-cooled racks still reject 10–30 % of their heat to air (memory, drives, power supplies): server inlet air stays the control point.',
        tool: ['ltc-ashrae-thermal-control.html#envelope', 'Check an inlet condition'] },
      { body: 'ASHRAE', role: 'governs', code: 'Standard 90.4',
        text: 'CRAH fan energy is part of the mechanical load component.' } ] },
    { id: 'chw', sym: 'pump', name: 'Chilled water', sub: 'CHW loop', refs: [
      { body: 'Uptime', role: 'governs', code: 'Concurrent maintainability',
        text: 'A single CHW header is a single point of failure for every CRAH it serves; Tier III loops are valved so any section can be isolated.',
        tool: ['ltc-uptime-tier-alignment.html#simulator', 'Sweep the cooling path'] } ] },
    { id: 'chiller', sym: 'chiller', name: 'Chillers', sub: 'air path + rooms', refs: [
      { body: 'ASHRAE', role: 'governs', code: 'Standard 90.4 / 90.1',
        text: 'Chiller efficiency at full and part load counts toward the mechanical load component.' },
      { body: 'ASHRAE', role: 'references', code: 'Standard 15',
        text: 'Safety standard for refrigeration systems: machinery-room ventilation and refrigerant detection.' } ] },
    { id: 'tower', sym: 'coolingTower', name: 'Cooling towers', sub: 'condenser heat', refs: [
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-9 · WUE',
        text: 'Evaporation, drift and blowdown are the site water use WUE counts.',
        tool: ['ltc-iso-energy-governance.html#kpi', 'Compute WUE'] },
      { body: 'ASHRAE', role: 'governs', code: 'Standard 188',
        text: 'Legionellosis risk management for building water systems, cooling towers included.' } ] }
  ];
  var BY_ID = {};
  SYSTEMS.forEach(function (s) { BY_ID[s.id] = s; });

  /* ---- the live plant ---------------------------------------------------- */
  /* One model for every workbench page (js/ltc-plant.js). The map used to stop at the dry
   * cooler; the 10–30 % of IT heat liquid cooling does not capture, and the UPS and
   * transformer losses, had nowhere to go. Every block below now carries its number. */
  var P = window.LTCPlant, S = window.LTCPlantStrip;
  var state = S ? S.get().state : (P ? P.load() : {});
  var R = S ? S.get().result : (P ? P.compute(state) : null);
  function f0(v) { return Math.round(v).toLocaleString('en-US'); }
  function f1(v) { return (Math.round(v * 10) / 10).toLocaleString('en-US'); }
  function mw(kw) { return f1(kw / 1000) + ' MW'; }
  var COOLER_NAME = { drycooler: 'Dry coolers', adiabatic: 'Adiabatic coolers', fluidcooler: 'Fluid coolers', tower: 'Towers + HX' };

  /* live sublabel, tooltip rows and the headline formula for each block */
  function live(id) {
    if (!R) return null;
    var Lq = R.liquid, A = R.air, E = R.elec, T = R.totals, I = R.input;
    var air = A.chillerType === 'air';
    var map = {
      utility: { sub: mw(T.facilityKw) + ' import', rows: [['Facility load', mw(T.facilityKw)], ['PUE design / annual', T.pue.toFixed(3) + ' / ' + T.pueAnnual.toFixed(3)]], f: 'IT + cooling + losses + aux' },
      tx: { sub: f0(E.txLossKw) + ' kW loss', rows: [['Efficiency', (I.txEff * 100).toFixed(1) + ' %'], ['Loss', f0(E.txLossKw) + ' kW']], f: 'loss = input × (1 − η)' },
      genset: { sub: 'MV bus · carries ' + mw(T.facilityKw), rows: [['Load to carry', mw(T.facilityKw)], ['Connection', 'MV paralleling bus, ahead of the transformers']], f: 'standby for the whole facility, cooling included' },
      swgr: { sub: 'A / B boards', rows: [['To UPS', mw(E.upsInKw)], ['To MCC', mw(E.mccKw)]] },
      mcc: { sub: mw(E.mccKw) + ' mech', rows: [['Chillers', f0(A.chillerKwe) + ' kW'], ['CRAH fans', f0(A.fanKw) + ' kW'], ['FWS pumps', f0(Lq.fwsPumpKw) + ' kW'], ['Cooler fans', f0(Lq.coolerFanKw) + ' kW'], ['Trim chiller', f0(Lq.trimKwe) + ' kW'], ['CHW + CW pumps', f0(A.chwPumpKw + A.cwPumpKw) + ' kW'], ['Tower fans', f0(A.towerFanKw) + ' kW']], f: 'Σ mechanical loads not on UPS' },
      ups: { sub: (I.upsEff * 100).toFixed(0) + ' % · ' + f0(E.upsLossKw) + ' kW loss', rows: [['Output', mw(E.upsOutKw)], ['Loss', f0(E.upsLossKw) + ' kW'], ['CDU pumps on UPS', I.cduOnUps ? 'yes' : 'no']], f: 'input = (IT + CDU pumps + distribution) / η' },
      pdu: { sub: f0(E.distLossKw) + ' kW loss', rows: [['Distribution loss', f0(E.distLossKw) + ' kW']], f: 'output × loss %' },
      elec: { sub: f0(E.roomLoadKw) + ' kW to CHW', rows: [['UPS loss', f0(E.upsLossKw) + ' kW'], ['Distribution', f0(E.distLossKw) + ' kW'], ['Transformers', f0(E.txLossKw) + ' kW'], ['Room cooling load', f0(E.roomLoadKw) + ' kW']], f: 'Σ electrical losses × room share' },
      racks: { sub: f0(R.it.racks) + ' racks · ' + I.halls + ' halls', rows: [['IT load', mw(R.it.kw)], ['Into cold plates', mw(Lq.itKw) + ' (' + I.capturePct + ' %)'], ['Left in the air', mw(A.itKw)], ['Racks per hall', f0(R.it.racksPerHall) + ' × ' + I.rackKw + ' kW']], f: 'liquid = IT × capture; air = IT − liquid' },
      cdu: { sub: Lq.cduTotal + ' × ' + f0(I.cduUnitKw) + ' kW · N+' + I.cduRedundancy, rows: [['Per hall', Lq.cduPerHall + ' (' + Lq.cduDutyN + ' duty)'], ['TCS', I.tcsSupplyC + ' / ' + I.tcsReturnC + ' °C'], ['TCS flow', f0(Lq.tcsLps) + ' L/s'], ['TCS pumps', f0(Lq.tcsPumpKw) + ' kW'], ['Feed', I.cduFeed === 'dual' ? 'dual (ATS)' : 'single, A/B alternating']], f: 'ceil(hall liquid duty / unit) + N' },
      fws: { sub: f1(Lq.fwsSupplyC) + ' / ' + f1(Lq.fwsReturnC) + ' °C · ' + f0(Lq.fwsLps) + ' L/s', rows: [['Supply / return', Lq.fwsSupplyC + ' / ' + Lq.fwsReturnC + ' °C'], ['Flow', f0(Lq.fwsLps) + ' L/s'], ['Pumps', f0(Lq.fwsPumpKw) + ' kW']], f: 'flow = Q / (cp · ΔT_FWS)' },
      reject: { sub: Lq.coolerUnitsTotal + ' units · leaves ' + f1(Lq.coolerLeavingC) + ' °C', rows: [['Type', COOLER_NAME[Lq.coolerType]], ['Design sink', f1(Lq.coolerSinkC) + ' °C'], ['Leaving water', f1(Lq.coolerLeavingC) + ' °C'], ['Duty', mw(Lq.coolerKw)], ['Units (N+1)', Lq.coolerUnitsTotal + ' (each derated to ' + (Lq.coolerDerate * 100).toFixed(0) + ' %)']], f: 'units = duty / (rated × LMTD_design / LMTD_rating)' },
      trim: { sub: Lq.trimKw ? mw(Lq.trimKw) + ' on design day' : 'idle at design', rows: [['Design-day share', (Lq.trimShareDesign * 100).toFixed(0) + ' %'], ['Duty', mw(Lq.trimKw)], ['Input', f0(Lq.trimKwe) + ' kW'], ['Hours running / yr', f0(T.trimHours)]], f: 'FWS heat × (cooler leaving − FWS supply) / ΔT' },
      crah: { sub: A.crahTotal + ' × ' + I.crahUnitKw + ' kW · N+' + I.crahRedundancy, rows: [['Per hall', A.crahPerHall + ' (' + A.crahDutyN + ' duty)'], ['Hall air load', f0(A.hallLoadKw) + ' kW'], ['Airflow per hall', f0(A.airflowHallM3s) + ' m³/s'], ['Fan power', f0(A.fanKw) + ' kW']], f: 'load = (air IT + CDU skin) / (1 − fan fraction)' },
      chw: { sub: A.chwSupplyC + ' / ' + A.chwReturnC + ' °C · ' + f0(A.chwLps) + ' L/s', rows: [['Supply / return', A.chwSupplyC + ' / ' + A.chwReturnC + ' °C'], ['Flow', f0(A.chwLps) + ' L/s'], ['Load', mw(A.chillerEvapKw)]], f: 'flow = evaporator load / (cp · ΔT)' },
      chiller: { sub: A.chillersTotal + ' × ' + f0(I.chillerUnitKw / 1000) + ' MW · COP ' + A.chillerCop.toFixed(1), rows: [['Type', air ? 'air-cooled' : 'water-cooled'], ['Running', A.chillersTotal + ' at ' + (A.chillerPlr * 100).toFixed(0) + ' % load'], ['COP / kW/RT', A.chillerCop.toFixed(2) + ' / ' + A.chillerKwPerRt.toFixed(3)], ['Input', f0(A.chillerKwe) + ' kW']], f: 'COP = rated × part-load factor × lift ratio' },
      tower: air && Lq.coolerType !== 'tower' ? { sub: 'air-cooled condensers', rows: [['Condenser heat', 'to air at the chillers']], f: 'no tower: no evaporation' }
        : { sub: mw(A.towerKw) + ' · ' + f1(A.makeupLps) + ' L/s make-up', rows: [['Heat rejected', mw(A.towerKw)], ['Make-up', f1(A.makeupLps) + ' L/s'], ['Water / year', f0(T.waterM3Year) + ' m³'], ['WUE annual', T.wueAnnual.toFixed(2) + ' L/kWh']], f: 'evaporation = latent heat / h_fg; make-up = evap × C/(C−1)' },
      fire: { sub: 'detect · suppress', rows: [] }
    };
    return map[id] || null;
  }
  function tips() {
    var t = {};
    SYSTEMS.forEach(function (s) {
      var l = live(s.id);
      t[s.id] = { title: s.name, rows: l ? l.rows : [], formula: l ? l.f : '' };
    });
    return t;
  }

  /* ---- figure ------------------------------------------------------------ */
  /* power and heat are always moving in a running plant: animate those
   * connectors; the dotted monitoring link stays still */
  function flowing(d) {
    var edge0 = d.edge;
    d.edge = function (a, b, o) {
      o = o || {};
      if (o.pattern !== 'dotted' && !o.state) o.state = 'flow';
      if (o.fromId && o.toId && !o.id) o.id = o.fromId + '>' + o.toId;
      return edge0(a, b, o);
    };
    return d;
  }
  /* The engine caps a diagram at nine blocks (Miller's 7±2): past that a reader sees a list,
   * not a structure. The plant has eighteen, so it is drawn as an overview plus three details
   * on the same model — every block in the overview opens the detail it belongs to. */
  var VIEWS = {
    overview: { label: 'Overview', nodes: [
        ['utility', 0, 0, { name: 'Grid + generators' }], ['ups', 1, 0, { name: 'UPS + PDU' }], ['racks', 3, 0, { h: 'span', rows: 3 }],
        ['elec', 1, 1], ['cdu', 2, 1], ['reject', 2, 2], ['crah', 2, 3], ['chiller', 1, 3], ['tower', 0, 3]],
      edges: [['utility', 'r', 'ups', 'l', 'POWER', 'Power'], ['ups', 'r', 'racks', 'l', 'POWER', null, 'it'],
        ['ups', 'b', 'elec', 't', 'LOSS', 'Losses as heat'], ['racks', 'l', 'cdu', 'r', 'LIQ', 'Heat (liquid)', 'liq'],
        ['cdu', 'b', 'reject', 't', 'LIQ'], ['racks', 'l', 'crah', 'r', 'AIR', 'Heat (air → chilled water)', 'air'],
        ['crah', 'l', 'chiller', 'r', 'AIR'], ['elec', 'b', 'chiller', 't', 'AIR'], ['chiller', 'l', 'tower', 'r', 'AIR']],
      opens: { utility: 'power', ups: 'power', elec: 'air', cdu: 'liquid', reject: 'liquid', crah: 'air', chiller: 'air', tower: 'air' } },
    power: { label: 'Power', stack: 1, nodes: [
        ['utility', 0, 0], ['tx', 1, 0], ['swgr', 2, 0], ['ups', 3, 0], ['pdu', 4, 0], ['racks', 5, 0, { h: 'span', rows: 2 }],
        ['genset', 1, 1], ['mcc', 2, 1], ['elec', 4, 1]],
      edges: [['utility', 'r', 'tx', 'l', 'POWER', 'Power'], ['tx', 'r', 'swgr', 'l', 'POWER'], ['genset', 't', 'tx', 'b', 'POWER'],
        ['swgr', 'r', 'ups', 'l', 'POWER'], ['ups', 'r', 'pdu', 'l', 'POWER'], ['pdu', 'r', 'racks', 'l', 'POWER'],
        ['swgr', 'b', 'mcc', 't', 'POWER', null, 'mcc'], ['pdu', 'b', 'elec', 't', 'LOSS', 'Losses as heat']] },
    liquid: { label: 'Liquid heat', stack: -1, nodes: [
        ['ups', 3, 0, { name: 'UPS' }], ['racks', 4, 0, { h: 'span', rows: 2 }], ['mcc', 1, 0],
        ['cdu', 3, 1], ['fws', 2, 1], ['reject', 1, 1], ['trim', 0, 1], ['tower', 0, 2]],
      edges: [['ups', 'b', 'cdu', 't', 'POWER', 'Power', 'cdupumps'], ['mcc', 'b', 'reject', 't', 'POWER'],
        ['racks', 'l', 'cdu', 'r', 'LIQ', 'Heat (liquid)', 'liq'], ['cdu', 'l', 'fws', 'r', 'LIQ'],
        ['fws', 'l', 'reject', 'r', 'LIQ'], ['reject', 'l', 'trim', 'r', 'LIQ'], ['trim', 'b', 'tower', 't', 'AIR', 'Condenser heat']] },
    air: { label: 'Air & rooms', stack: -1, nodes: [
        ['racks', 4, 0, { h: 'span', rows: 2 }], ['fire', 4, 2], ['crah', 3, 1], ['chw', 2, 1], ['chiller', 1, 1], ['tower', 0, 1],
        ['elec', 2, 0], ['mcc', 1, 2]],
      edges: [['racks', 'l', 'crah', 'r', 'AIR', 'Heat (air → chilled water)'], ['crah', 'l', 'chw', 'r', 'AIR'],
        ['chw', 'l', 'chiller', 'r', 'AIR'], ['chiller', 'l', 'tower', 'r', 'AIR'], ['elec', 'b', 'chw', 't', 'AIR'],
        ['mcc', 't', 'chiller', 'b', 'POWER', 'Power'], ['fire', 't', 'racks', 'b', 'MON', 'Monitors']] }
  };
  var view = 'overview';
  var NW = 172, CG = 40, RG = 56, NH = 88;
  function build(D, o) {
    var V = VIEWS[view];
    var d = flowing(D.create({
      slug: 'ltcmap-' + view, width: 1240, height: 640,
      title: 'Liquid-to-chip plant — ' + V.label,
      desc: 'Power from utility and generators through transformers, switchgear, UPS and PDUs to the racks, and through the MCC to ' +
            'the mechanical plant. Liquid heat leaves the racks through CDUs and facility water to the coolers and a trim chiller; ' +
            'the residual air heat goes through CRAHs and chilled water to the chillers and cooling towers; UPS and transformer losses ' +
            'are cooled on the same chilled water. This view: ' + V.label + '.'
    }));
    var STY = { POWER: { tier: 1, stroke: 'ink' }, LIQ: { pattern: 'dashed', stroke: 'link' },
                AIR: { pattern: 'dash-dot', stroke: 'accent' }, LOSS: { pattern: 'dotted', stroke: 'muted' },
                MON: { pattern: 'dotted', stroke: 'soft', marker: false } };
    var LBL = R ? { it: mw(R.it.kw), liq: mw(R.liquid.itKw), air: mw(R.air.itKw) + ' air', mcc: mw(R.elec.mccKw) + ' mech', cdupumps: 'CDU pumps on UPS' } : {};
    var box = {};
    // narrow: one column in flow order (a transposed grid scaled into 360 px left 5 px text)
    // stack in the direction things flow: power left → right, heat right → left
    var order = V.nodes.slice().sort(function (a, b) { return V.stack ? V.stack * (a[1] - b[1]) || a[2] - b[2] : 0; })
      .map(function (x) { return x[0]; });
    function pos(c, r, id) {
      return o.narrow ? { x: 24, y: 16 + order.indexOf(id) * (NH + 36) }
                      : { x: 24 + c * (NW + CG), y: 24 + r * (NH + RG) };
    }
    V.nodes.forEach(function (spec) {
      var id = spec[0], s = BY_ID[id], l = live(id), ex = spec[3] || {}, p = pos(spec[1], spec[2], id);
      var opt = { id: id, name: ex.name || (id === 'reject' && R ? COOLER_NAME[R.liquid.coolerType] : s.name),
                  sublabel: l ? l.sub : s.sub, symbol: s.sym, interactive: true, focal: !!s.focal,
                  tier: s.focal ? 1 : 2, fill: s.focal ? 'paper-2' : 'paper', w: NW,
                  legend: s.focal ? 'IT load — the control point' : 'Plant equipment' };
      if (o.narrow) { opt.w = 210; opt.h = NH; }   // leaves a side channel for connectors that skip a block
      else opt.h = ex.h === 'span' ? NH + (ex.rows - 1) * (NH + RG) : NH;
      box[id] = d.node(p.x, p.y, opt);
    });
    function at(b, side) {
      return side === 'l' ? { x: b.x, y: b.y + b.h / 2 } : side === 'r' ? { x: b.x + b.w, y: b.y + b.h / 2 }
           : side === 't' ? { x: b.x + b.w / 2, y: b.y } : { x: b.x + b.w / 2, y: b.y + b.h };
    }
    var skip = 0;
    V.edges.forEach(function (e) {
      var A = box[e[0]], B = box[e[2]];
      var p1 = at(A, e[1]), p2 = at(B, e[3]);
      if (o.narrow) {
        var ia = order.indexOf(e[0]), ib = order.indexOf(e[2]);
        if (Math.abs(ia - ib) === 1) {   // neighbours in the stack: straight down or up
          var down = A.y < B.y;
          p1 = { x: A.x + A.w / 2, y: down ? A.y + A.h : A.y };
          p2 = { x: B.x + B.w / 2, y: down ? B.y : B.y + B.h };
        } else {                          // skips a block: leave and enter on the right, through the side channel
          skip++;
          p1 = { x: A.x + A.w, y: A.y + A.h / 2 - 8 + (skip % 3) * 8 };
          p2 = { x: B.x + B.w, y: B.y + B.h / 2 - 8 + (skip % 3) * 8 };
        }
      }
      // into the tall racks block: keep the connector level with the other end
      if (e[2] === 'racks' && !o.narrow) p2 = { x: B.x, y: p1.y };
      if (e[0] === 'racks' && !o.narrow) p1 = { x: A.x, y: p2.y };
      var opt = Object.assign({ fromId: e[0], toId: e[2] }, STY[e[4]]);
      if (e[5]) opt.legend = e[5];
      if (e[6] && LBL[e[6]] && !o.narrow) opt.label = LBL[e[6]];
      d.edge(p1, p2, opt);
    });
    d.legend();
    return d;
  }
  function viewBar() {
    var host = document.getElementById('ltcViews');
    if (!host) return;
    host.innerHTML = Object.keys(VIEWS).map(function (k) {
      return '<button type="button" data-view="' + k + '" aria-pressed="' + (k === view) + '">' + VIEWS[k].label + '</button>';
    }).join('');
    host.onclick = function (e) { var b = e.target.closest('[data-view]'); if (b) setView(b.getAttribute('data-view')); };
  }
  function setView(v) {
    if (!VIEWS[v] || v === view) return;
    view = v; viewBar();
    if (fig) fig.redraw();
  }

  /* ---- inspector --------------------------------------------------------- */
  var ROLE_WORD = { governs: 'Governs', measures: 'Measures', references: 'Context' };
  function open(id) {
    var s = BY_ID[id];
    if (!s) return;
    if (fig) {
      SYSTEMS.forEach(function (x) { fig.mark(x.id, x.id === id ? 'selected' : null); });
    }
    var l = live(id);
    var html = (l && l.rows.length ? '<h3 class="ltc-script-h">Live · this plant</h3>' + L.kv(l.rows.map(function (r) { return [r[0], L.esc(r[1])]; })) +
      (l.f ? '<p class="ltc-tip-f">ƒx ' + L.esc(l.f) + '</p>' : '') + '<h3 class="ltc-script-h">Standards</h3>' : '') +
      '<ul class="ltc-refs">' + s.refs.map(function (r) {
      return '<li><code>' + L.esc(r.body + ' · ' + r.code) + '</code> <span class="ltc-chip">' +
        ROLE_WORD[r.role] + '</span><p>' + L.esc(r.text) + '</p>' +
        (r.tool ? '<a href="' + r.tool[0] + '">' + L.esc(r.tool[1]) + ' →</a>' : '') + '</li>';
    }).join('') + '</ul>';
    var go = view === 'overview' && VIEWS.overview.opens[id];
    if (go) html = '<p><button class="ltc-btn" type="button" data-goview="' + go + '">Open the ' + L.esc(VIEWS[go].label) + ' detail →</button></p>' + html;
    L.inspect({ sym: s.sym, eyebrow: 'Plant block', title: id === 'reject' && R ? COOLER_NAME[R.liquid.coolerType] : s.name, html: html });
    var gb = document.querySelector('[data-goview]');
    if (gb) gb.addEventListener('click', function () { setView(gb.getAttribute('data-goview')); });
  }

  /* ---- coverage matrix --------------------------------------------------- */
  function matrix() {
    var host = document.getElementById('ltcMatrix');
    if (!host) return;
    var mark = { governs: '● governs', measures: '◐ measures', references: '○ context' };
    var h = '<table class="ltc-table"><thead><tr><th>Plant block</th>' +
      BODIES.map(function (b) { return '<th>' + b + '</th>'; }).join('') + '</tr></thead><tbody>';
    SYSTEMS.forEach(function (s) {
      h += '<tr><td><button class="ltc-btn" type="button" data-open="' + s.id + '" style="min-height:28px;text-transform:none;letter-spacing:0">' +
        L.sym(s.sym, 18) + L.esc(s.name) + '</button></td>';
      BODIES.forEach(function (b) {
        var rs = s.refs.filter(function (r) { return r.body === b; });
        var best = rs.some(function (r) { return r.role === 'governs'; }) ? 'governs'
          : rs.some(function (r) { return r.role === 'measures'; }) ? 'measures'
          : rs.length ? 'references' : '';
        h += '<td class="mono" style="font-size:12px;color:var(' + (best === 'governs' ? '--t1' : '--t3') + ')">' +
          (best ? mark[best] : '') + '</td>';
      });
      h += '</tr>';
    });
    host.innerHTML = h + '</tbody></table>';
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]');
      if (b) open(b.getAttribute('data-open'));
    });
  }

  /* ---- lifecycle: commissioning levels and the tests standards ask for ----- */
  /* Each level is a gate: a short script summary — what is tested, what is expected, and the
   * hold point that closes it. Acceptance values marked "typical" are the ones commissioning
   * plans commonly set; the project's own plan governs. Summaries of the cited documents, not
   * quotations. L4 carries the heat load test (HLT): liquid-to-chip halls are where the
   * thermal design is first proven at load. */
  var LIFE = [
    { id: 'l1', name: 'L1 · Factory', sub: 'FAT at the vendor', sym: 'ups', script: {
      purpose: 'Prove each major unit meets its submittal before it ships.',
      tests: ['UPS: full-load and step-load test, efficiency at 25/50/75/100 %, battery autonomy', 'Switchgear: dielectric, functional and interlock checks', 'Generators: load-bank run at rating', 'CDUs: hydrostatic pressure test, pump curve, control and alarm I/O', 'Chillers: performance test at the rating condition'],
      expect: ['Measured performance within the submittal tolerance', 'Every alarm point reaches the controller'],
      hold: 'Witnessed FAT report signed; deviations closed or accepted',
      refs: [['ASHRAE Guideline 0', 'Commissioning process: owner’s project requirements, basis of design, test scripts'], ['NFPA 2001', 'Listed agent containers and valves arrive with their listing']] } },
    { id: 'l2', name: 'L2 · Delivered', sub: 'site acceptance', sym: 'switchgear', script: {
      purpose: 'Confirm what arrived and how it was installed.',
      tests: ['Receipt inspection: nameplates, ratings, transit damage, documents', 'Installation checks: terminations torqued, clearances, labelling', 'Piping: pressure test of installed TCS/FWS/CHW sections; flushing plan', 'Cabling: copper permanent links and fiber links certified'],
      expect: ['Installed equipment matches the approved submittals', 'Pipework holds test pressure with no leak'],
      hold: 'Installation checklists closed per system',
      refs: [['TIA-568', 'Cabling certification: Tier 1 loss, Tier 2 OTDR where specified']] } },
    { id: 'l3', name: 'L3 · Started', sub: 'start-up', sym: 'pump', script: {
      purpose: 'Energise and start every unit on its own.',
      tests: ['Energise boards, check phase rotation and protection settings', 'TCS loop: flush, filter, fill, vent; fluid sampled against the cooling-fluid specification', 'Manufacturer start-up of CDUs, pumps, CRAHs, chillers, coolers; set points recorded', 'BMS/EPMS point-to-point: every sensor and command verified end to end', 'Fire detection devices tested; aspirating transport time verified'],
      expect: ['Each unit runs stable under its own controls', 'Loop fluid within specification; no air in high points'],
      hold: 'Start-up reports and point-to-point list signed',
      refs: [['NFPA 72', 'Device testing and aspirating transport time']] } },
    { id: 'l4', name: 'L4 · Functional', sub: 'each system + HLT', sym: 'cdu', focal: true, script: {
      purpose: 'Prove each system in every mode, then prove the hall thermally at load (HLT).',
      tests: ['Sequences of operation: normal, standby changeover, failure and recovery, per system', 'Fire alarm acceptance and interfaces; release sequence verified without discharge', 'Clean-agent enclosure integrity (door-fan) test for hold time'],
      expect: ['Every sequence behaves as written; every alarm annunciates', 'Enclosure holds agent for the design hold time'],
      hold: 'Functional test scripts and the HLT report signed; open items tracked to L5',
      hlt: [
        'Preconditions: L3 closed; liquid load banks on the TCS manifolds and air load banks in the rows; instruments calibrated',
        'Step the hall load 25 → 50 → 75 → 100 % of design, liquid and air at the design split; hold each step until temperatures settle (typical: < 0.5 K change over 15 min)',
        'Record at each step: TCS supply/return and flow per CDU, FWS supply/return, CRAH supply/return air, rack-row inlet, pump and fan speeds, power',
        'Accept (typical): TCS supply within ±1 K of set point; flow ≥ design; rack inlet inside the ASHRAE recommended envelope; measured heat ṁ·cp·ΔT within ±5 % of load-bank kW; no alarm',
        'At 100 %: fail one CDU, one pump, one CRAH, one CDU feeder in turn; record the supply-temperature excursion and recovery time against the design limit',
        'Return to normal; confirm controls restore the original set points'
      ],
      refs: [['ASHRAE TC 9.9', 'Rack inlet envelope and liquid-cooling W-classes are the acceptance limits'], ['NFPA 72 / NFPA 2001', 'Fire alarm acceptance; enclosure integrity']] } },
    { id: 'l5', name: 'L5 · Integrated', sub: 'IST · load banks', sym: 'rack', script: {
      purpose: 'Prove the systems together through the failures they were designed for.',
      tests: ['Utility failure at design load: generator start, transfer, UPS ride-through, cooling continuity', 'CDU pumps on UPS keep flow through the transfer; chiller restart time measured against the thermal ride-through', 'Concurrent maintenance and (Tier IV) fault-tolerance demonstrations on live paths', 'Return to utility'],
      expect: ['Load banks never lose power', 'TCS supply and rack inlet stay inside limits through every transfer', 'Recovery times within design'],
      hold: 'IST report; Tier Certification of Constructed Facility where sought',
      refs: [['Uptime', 'Constructed-facility certification demonstrates maintainability (and fault tolerance for Tier IV) under load']] } },
    { id: 'ops', name: 'Operate', sub: 'measure · improve', sym: 'meter', script: {
      purpose: 'Run, measure and keep the plant at its design performance.',
      tests: ['12 months of PUE, WUE, CUE at a stated category', 'Retro-commissioning when measured performance drifts from the model', 'Water-management plan for evaporative equipment'],
      expect: ['Annual PUE close to the modelled annual value, not the design-day one'],
      hold: 'ISO 50001 surveillance audits; recertification in year 3',
      refs: [['ISO/IEC 30134', 'KPI definitions and measurement categories'], ['ISO 50001', 'Energy management system'], ['Uptime', 'Operational Sustainability is assessed separately from topology'], ['ASHRAE 188', 'Legionella risk management for cooling towers']] } }
  ];
  var LBY = {}; LIFE.forEach(function (x) { LBY[x.id] = x; });
  function lifeBuild(D, o) {
    var d = flowing(D.create({ slug: 'ltclife', title: 'Commissioning levels to operation',
      desc: 'Factory, delivery, start-up, functional and integrated systems testing, then operation; each level opens the tests the standards ask for there.' }));
    var x = 16, y = 16, G = o.narrow ? 28 : 36, prev = null, box = {};
    LIFE.forEach(function (s, i) {
      /* snake: the second row runs right to left, so L3 drops straight onto L4 */
      if (!o.narrow && i === 3) { x = box.l3.x; y = box.l1.y + box.l1.h + 56; }
      box[s.id] = d.node(x, y, { id: s.id, name: s.name, sublabel: s.sub, symbol: s.sym, interactive: true, focal: !!s.focal,
        fill: s.focal ? 'paper-2' : 'paper', tier: s.focal ? 1 : 2, w: 152, legend: s.focal ? 'Where most defects surface' : 'Stage' });
      if (prev) {
        var A = box[prev], B = box[s.id];
        if (o.narrow) d.edge({ x: A.x + A.w / 2, y: A.y + A.h }, { x: B.x + B.w / 2, y: B.y }, { fromId: prev, toId: s.id, legend: i === 1 ? 'Gate to next stage' : undefined });
        else if (B.y === A.y && B.x > A.x) d.edge({ x: A.x + A.w, y: A.y + A.h / 2 }, { x: B.x, y: B.y + B.h / 2 }, { fromId: prev, toId: s.id, legend: i === 1 ? 'Gate to next stage' : undefined });
        else if (B.y === A.y) d.edge({ x: A.x, y: A.y + A.h / 2 }, { x: B.x + B.w, y: B.y + B.h / 2 }, { fromId: prev, toId: s.id });
        else d.edge({ x: A.x + A.w / 2, y: A.y + A.h }, { x: B.x + B.w / 2, y: B.y }, { fromId: prev, toId: s.id });
      }
      if (o.narrow) y = box[s.id].y + box[s.id].h + G; else if (i < 3) x = box[s.id].x + box[s.id].w + G; else x = box[s.id].x - G - 152;
      prev = s.id;
    });
    d.legend();
    return d;
  }
  function scriptHtml(sc) {
    function ul(xs) { return '<ul class="ltc-script-l">' + xs.map(function (x) { return '<li>' + L.esc(x) + '</li>'; }).join('') + '</ul>'; }
    return '<p class="ltc-script-p">' + L.esc(sc.purpose) + '</p>' +
      '<h3 class="ltc-script-h">Tested</h3>' + ul(sc.tests) +
      (sc.hlt ? '<h3 class="ltc-script-h">Heat load test (HLT)</h3><ol class="ltc-script-l">' + sc.hlt.map(function (x) { return '<li>' + L.esc(x) + '</li>'; }).join('') + '</ol>' : '') +
      '<h3 class="ltc-script-h">Expected</h3>' + ul(sc.expect) +
      '<h3 class="ltc-script-h">Hold point</h3><p class="ltc-script-p">' + L.esc(sc.hold) + '</p>' +
      '<ul class="ltc-refs">' + sc.refs.map(function (t) { return '<li><code>' + L.esc(t[0]) + '</code><p>' + L.esc(t[1]) + '</p></li>'; }).join('') + '</ul>';
  }
  function openLife(id) {
    var s = LBY[id]; if (!s) return;
    if (lifeFig) LIFE.forEach(function (x) { lifeFig.mark(x.id, x.id === id ? 'selected' : null); });
    L.inspect({ sym: s.sym, eyebrow: 'Commissioning', title: s.name, html: scriptHtml(s.script) });
  }
  /* the summary the owner asked to see without clicking: one row per level */
  function lifeTable() {
    var host = document.getElementById('ltcLifeTable');
    if (!host) return;
    host.innerHTML = '<table class="ltc-table"><thead><tr><th>Level</th><th>What is tested</th><th>Expected</th><th>Hold point</th></tr></thead><tbody>' +
      LIFE.map(function (s) {
        var sc = s.script;
        return '<tr><td><button class="ltc-linkbtn" type="button" data-life="' + s.id + '">' + L.esc(s.name) + '</button></td><td>' +
          L.esc(sc.tests.slice(0, 2).join('; ')) + (sc.hlt ? '; <b>HLT</b>: load steps 25→100 %, failures at 100 %' : '') +
          '</td><td>' + L.esc(sc.expect[0]) + '</td><td>' + L.esc(sc.hold) + '</td></tr>';
      }).join('') + '</tbody></table>';
    host.addEventListener('click', function (e) { var b = e.target.closest('[data-life]'); if (b) openLife(b.getAttribute('data-life')); });
  }
  var lifeFig = null;

  /* ---- plant parameters, balance and the four-plant comparison ------------- */
  /* Inputs live in the shared plant strip (js/ltc-plant-strip.js), not here: one place to edit
   * the plant, every page redraws from the same result. This panel only reports. */
  function paintPanel() {
    var host = document.getElementById('ltcPlant');
    if (!host || !R) return;
    var T = R.totals, A = R.annual, bal = T.split;
    host.innerHTML = '<p class="ltc-plant-bal" aria-live="polite">' +
      '<span>heat out: liquid <b>' + mw(bal.liquid) + '</b></span><span class="sep">/</span><span>air <b>' + mw(bal.air) + '</b></span>' +
      '<span class="sep">/</span><span>electrical rooms <b>' + mw(bal.elec) + '</b></span><span class="sep">/</span>' +
      '<span>water <b>' + f0(A.waterM3) + '</b> m³/yr</span><span class="sep">/</span>' +
      '<span>energy balance closes to <b>' + (T.balanceErr * 100).toFixed(3) + ' %</b></span></p>';
    compare();
  }
  /* the four plants at THIS site and load: the water–energy trade-off, computed, not quoted */
  function compare() {
    var host = document.getElementById('ltcCompare');
    if (!host) return;
    var rows = P.comparePresets(state);   // drops a stored preset so each row really is its own plant
    var cur = R.input;
    host.innerHTML = '<table class="ltc-table"><thead><tr><th>Plant</th><th class="n">PUE design</th><th class="n">PUE annual</th>' +
      '<th class="n">WUE L/kWh</th><th class="n">Water m³/yr</th><th class="n">Liquid coolers</th><th class="n">Trim h/yr</th><th class="n">Chiller COP</th></tr></thead><tbody>' +
      rows.map(function (x) {
        var t = x.r.totals, me = x.r.input.chillerType === cur.chillerType && x.r.input.liquidRejection === cur.liquidRejection;
        return '<tr' + (me ? ' data-hit' : '') + '><td>' + L.esc(x.label) + '</td><td class="n">' + t.pue.toFixed(3) + '</td><td class="n">' + t.pueAnnual.toFixed(3) +
          '</td><td class="n">' + t.wueAnnual.toFixed(2) + '</td><td class="n">' + f0(t.waterM3Year) + '</td><td class="n">' + x.r.liquid.coolerUnitsTotal +
          '</td><td class="n">' + f0(t.trimHours) + '</td><td class="n">' + x.r.air.chillerCop.toFixed(2) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  var fig = null;
  function boot() {
    L.init({ module: 'hub' });
    fig = L.draw(document.getElementById('ltcMap'), build, open);
    viewBar();
    if (window.LTCTrace) LTCTrace.attach(document.getElementById('ltcMap'), tips);
    lifeFig = L.draw(document.getElementById('ltcLife'), lifeBuild, openLife);
    matrix();
    lifeTable();
    paintPanel();
    if (S) S.onChange(function (r, st) { R = r; state = st; paintPanel(); if (fig) fig.redraw(); });
    /* the inspector is a persistent column only on wide screens; elsewhere it is a
     * drawer, and opening a drawer nobody asked for hides the plant */
    if (window.matchMedia('(min-width: 1280px)').matches) open('racks');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
