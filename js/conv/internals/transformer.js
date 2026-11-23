/*
 * internals/transformer.js — the INSIDE of one power or distribution transformer (PRD-CONV-EQUIPMENT-INSIDE P4a,
 * P4-ELECTRICAL.md §4.1), registered as RZConvInternals classes 'hv_tx' (TX-1 / TX-2, 150 / 20 kV) and 'dist_tx'
 * (the 20 / 0.4 kV unit, TX-DA / TX-DB on E-S-101, TX-AA / TX-AB on E-S-102). Drawn by js/rz-hmi-sheet.js with
 * IEC 60617 symbols from js/rz-eng-symbols.js; coloured and moved only by js/conv/vfx.js.
 * 'pdu' (PRD-ELECTRICAL-BMS E18, v3.100.0) is the floor power distribution unit of E-S-102 (PDU-AA / PDU-AB, a typical of
 * electrical.pdu_per_hall_per_stream): its rating, power factor, loading limit and design loading are engine 2.9.0 keys;
 * its impedance, currents, losses and output voltage are not published, so they read not modelled.
 *
 *   Power: upstream breaker -> HV winding (delta) and core -> LV winding (star) -> downstream breaker; a surge
 *          arrester on the HV terminals; the star point to the neutral earthing resistor (TX-1/2) or to N-PE (unit).
 *   Guards: winding / oil temperature transmitter and its relay (26/49; Buchholz 63 on the liquid-filled TX-1/2);
 *           cooling (ONAN radiators on TX-1/2, AN on the dry-type unit).
 *
 * The unit comes from the EPMS page's simulation adapter: { tag, state, kw, a, pct, units, up, down, upState,
 * downState } where kw / a are the device's simulated flow (all `units` in parallel) and pct the load of ONE unit.
 * Ratings, impedance, full-load and fault currents, losses and the PEI floor are engine 2.6.0 electrical keys. A loss of
 * the distribution unit is an UPPER BOUND (EU 548/2014 Tier 2 maxima); TX-1/2 losses, temperatures, tap position and
 * Buchholz state are not modelled (P4-ELECTRICAL.md §6.1).
 * This file holds geometry and key names only: no digit outside the GEOMETRY and FORMATS blocks, comments and standards.
 */
(function (root) {
  'use strict';
  var R = root && root.RZConvInternals ? root.RZConvInternals : (typeof require === 'function' ? require('../internals.js') : null);
  if (!R) return;
  var NM = R.NOT_MODELLED;
  /* FORMATS BEGIN */
  var ADD_FMT = { kva: { d: 0, u: 'kVA' }, mva: { d: 0, u: 'MVA' }, amp: { d: 1, u: 'A' }, kw: { d: 1, u: 'kW' }, kwl: { d: 2, u: 'kW' },
    watt: { d: 0, u: 'W' }, ka: { d: 2, u: 'kA' }, pcte: { d: 2, u: '%', x: 100 }, pctp: { d: 3, u: '%', x: 100 },
    pf: { d: 2, u: '' }, count: { d: 0, u: '' } };
  var PU = 100, KW_PER_W = 1000;   /* percent -> per unit; W -> kW */
  /* FORMATS END */
  Object.keys(ADD_FMT).forEach(function (k) { if (!R.FMT[k]) R.FMT[k] = ADD_FMT[k]; });

  /* GEOMETRY BEGIN — drawing units; the sheet is fitted to its panel, never below 0.92 x its width */
  var SHEET = { size: [600, 560], minScale: 0.92 };
  var KINDS = {
    hv_tx: { coolSym: 'dryCoolerV', coolTag: 'RADIATORS', coolLabel: 'Radiator banks, ONAN (oil natural, air natural)',
      relayTag: '63 · 26 · 49', relayLabel: 'Buchholz 63, oil temperature 26, winding temperature 49',
      ttLabel: 'Oil and winding temperature transmitter', earthSym: 'resistor', earthTag: 'NGR', earthLabel: 'Neutral earthing resistor (20 kV star point)',
      winName: 'Windings and core — 150 / 20 kV power transformer', winStd: 'IEC 60076-1 · EU 548/2014 Table I.7', dnStd: 'IEC 62271-100',
      tempStd: 'IEC 60076-7 · IEEE C37.2', neName: 'Neutral earthing resistor', neStd: 'IEC 60076-1 · IEEE C37.2 51G' },
    dist_tx: { coolSym: 'fanAxial', coolTag: 'AN / AF', coolLabel: 'Natural air cooling; optional fans (dry type)',
      relayTag: '26 · 49', relayLabel: 'Winding temperature relay 26 / 49 (PT100 in each LV winding)',
      ttLabel: 'Winding temperature sensors (PT100)', earthSym: 'earth', earthTag: 'N-PE', earthLabel: 'LV star point to the N and PE bar',
      winName: 'Windings and core — 20 / 0.4 kV dry-type unit', winStd: 'IEC 60076-11 · EU 548/2014 Table I.2', dnStd: 'IEC 60947-2',
      tempStd: 'IEC 60076-11 · IEEE C37.2', neName: 'Neutral to N-PE', neStd: 'IEC 60364-4-41' },
    pdu: { coolSym: 'fanAxial', coolTag: 'AN', coolLabel: 'Natural air cooling (dry type, inside the PDU cabinet)',
      relayTag: '26 · 49', relayLabel: 'Winding temperature relay 26 / 49',
      ttLabel: 'Winding temperature sensors', earthSym: 'earth', earthTag: 'N-PE', earthLabel: 'Secondary star point to the N and PE bar',
      inTag: 'IN CB', outTag: 'OUT CB', winName: 'Windings and core — PDU isolation transformer', winStd: 'IEC 61558-2-4 · IEC 60076-11', dnStd: 'IEC 60947-2',
      tempStd: 'IEC 60076-11 · IEEE C37.2', neName: 'Neutral to N-PE', neStd: 'IEC 60364-4-41' }
  };
  function nodes(K) {
    return [
      { id: 'up', tag: 'FROM', sym: 'offSheet', rot: 270, x: 200, y: 36, size: 22, tagAt: 'at', tagXY: [-18, 2, 'end'], label: 'From the upstream switchgear',
        values: [{ k: 'tg', dx: 18, dy: 4, anchor: 'start', lod: 1 }] },
      { id: 'hvcb', tag: K.inTag || 'HV CB', sym: 'cbIec', x: 200, y: 112, size: 36, tagAt: 'at', tagXY: [-26, 4, 'end'], label: 'Upstream circuit breaker',
        values: [{ k: 'st', dx: 26, dy: -4, anchor: 'start', lod: 1 }, { k: 'a', dx: 26, dy: 12, anchor: 'start', lod: 1 }] },
      { id: 'sa', tag: 'SA', sym: 'surgeArrester', x: 96, y: 196, size: 28, tagAt: 'at', tagXY: [-18, 4, 'end'], label: 'Surge arrester on the HV terminals' },
      { id: 'tx', tag: 'WINDINGS + CORE', sym: 'transformer2w', x: 200, y: 268, size: 70, tagAt: 'at', tagXY: [-44, -30, 'end'], label: 'HV winding (delta), core, LV winding (star)',
        values: [{ k: 'ld', dx: 48, dy: -14, anchor: 'start', lod: 1 }, { k: 'kw', dx: 48, dy: 2, anchor: 'start', lod: 1 }, { k: 'ls', dx: 48, dy: 18, anchor: 'start', lod: 1 }] },
      { id: 'tt', tag: 'TT', sym: 'instField', x: 400, y: 182, size: 28, tagAt: 'at', tagXY: [0, -20], label: K.ttLabel },
      { id: 'rel', tag: K.relayTag, sym: 'protectionRelay', x: 500, y: 182, size: 30, tagAt: 'at', tagXY: [0, -24], label: K.relayLabel },
      { id: 'cool', tag: K.coolTag, sym: K.coolSym, x: 440, y: 330, size: 46, tagAt: 'at', tagXY: [0, 40], label: K.coolLabel },
      { id: 'nct', tag: 'CT-N', sym: 'currentTransformer', x: 96, y: 370, size: 28, tagAt: 'at', tagXY: [-18, 4, 'end'], label: 'Neutral current transformer' },
      { id: 'ne', tag: K.earthTag, sym: K.earthSym, x: 96, y: 446, size: 28, tagAt: 'at', tagXY: [-18, 4, 'end'], label: K.earthLabel },
      { id: 'lvcb', tag: K.outTag || 'LV CB', sym: 'cbIec', x: 200, y: 420, size: 36, tagAt: 'at', tagXY: [-26, 4, 'end'], label: 'Downstream circuit breaker',
        values: [{ k: 'st', dx: 26, dy: 4, anchor: 'start', lod: 1 }] },
      { id: 'dn', tag: 'TO', sym: 'offSheet', rot: 90, x: 200, y: 516, size: 22, tagAt: 'at', tagXY: [-18, 2, 'end'], label: 'To the downstream switchboard',
        values: [{ k: 'tg', dx: 18, dy: 4, anchor: 'start', lod: 1 }] }
    ];
  }
  function edges() {
    return [
      { id: 'p-up', from: 'up.port', to: 'hvcb.line', medium: 'power', flowOf: 'p' },
      { id: 'p-hv', from: 'hvcb.load', to: 'tx.hv', medium: 'power', flowOf: 'p' },
      { id: 'p-sa', from: [200, 196], to: 'sa.line', via: [[96, 196]], medium: 'line', w: 'inst' },
      { id: 'p-lv', from: 'tx.lv', to: 'lvcb.line', medium: 'power', flowOf: 'p' },
      { id: 'p-dn', from: 'lvcb.load', to: 'dn.port', medium: 'power', flowOf: 'p' },
      { id: 'p-n', from: [176, 300], to: 'nct.line', via: [[96, 300]], medium: 'line', w: 'inst' },
      { id: 'p-ne', from: 'nct.load', to: 'ne.line', medium: 'line', w: 'inst' },
      { id: 'i-tt', from: 'tt.process', to: [222, 238], via: [[400, 238]], medium: 'line', w: 'inst' },   /* above the drawn values, into the winding top */
      { id: 'i-rel', from: [414, 182], to: 'rel.input', medium: 'line', w: 'inst' },
      { id: 'c-cool', from: [236, 330], to: [418, 330], medium: 'line', w: 'inst' }
    ];
  }
  /* GEOMETRY END */

  function make(kind) {
    var K = KINDS[kind], E = 'electrical.', HV = kind === 'hv_tx', PDU = kind === 'pdu';
    function sheet(unit) {
      var tag = (unit && unit.tag) || (HV ? 'TX' : PDU ? 'PDU' : 'TX-D');
      return { id: 'int-' + kind, no: tag + '-INT', title: tag + ' internal — ' + (HV ? 'power transformer' : PDU ? 'power distribution unit' : 'distribution transformer'), rev: 'A',
        basis: 'IEC 60617 · IEC 60076-1 · EU 548/2014', svgId: 'rz-cvm-int-svg', size: SHEET.size.slice(), minScale: SHEET.minScale,
        nodes: nodes(K), edges: edges(), areas: [], notes: [] };
    }
    function model(u, s) {
      var e = (s && s.electrical) || {}, live = u.state === 'running' || u.state === 'standby';
      var units = u.units || null, L = typeof u.pct === 'number' ? u.pct / PU : null;
      var ratingKva = HV ? e.hv_tx_mva * KW_PER_W : e.dist_tx_kva;
      var lossNow = !HV && live && L !== null ? (e.dist_tx_p0_w + e.dist_tx_pk_w * L * L) / KW_PER_W : NM;   /* a dead core has no loss */
      var pNow = live && L ? ratingKva * L * e.power_factor_design : null;   /* no efficiency at zero output */
      return {
        state: u.state, tag: u.tag, live: live,
        up: u.up, down: u.down, upState: u.upState, downState: u.downState,
        kwUnit: units ? u.kw / units : u.kw, aUnit: units ? u.a / units : u.a, upA: u.upA, units: units, pct: u.pct,
        rating: HV ? e.hv_tx_mva : e.dist_tx_kva,
        ratio: HV ? e.hv_voltage_kv + ' / ' + e.mv_voltage_kv + ' kV' : e.mv_voltage_kv + ' kV / ' + e.lv_voltage_v + ' V',
        z: HV ? e.hv_tx_impedance_pct : e.dist_tx_impedance_pct,
        flaHv: HV ? e.hv_tx_fla_a : e.dist_tx_fla_mv_a, flaLv: HV ? e.mv_tx_fla_a : e.dist_tx_fla_lv_a,
        cont: HV ? e.hv_tx_load_pct_n1 : e.dist_tx_load_pct_contingency,
        faultLv: HV ? e.mv_fault_level_ka : e.lv_fault_level_ka,
        p0: HV ? NM : e.dist_tx_p0_w, pk: HV ? NM : e.dist_tx_pk_w,
        lossNow: lossNow, effNow: HV || pNow === null ? NM : pNow / (pNow + lossNow),
        lossDesign: HV ? NM : e.dist_tx_loss_kw_normal, effDesign: HV ? NM : e.dist_tx_eff_normal,
        pei: HV ? e.hv_tx_pei_min : NM,
        temp: NM, tap: NM, buchholz: NM, surge: NM, neutralA: NM, cooling: NM,
        lossTag: HV ? 'PEI ≥' : 'LOSS ≤'
      };
    }
    function nodeState(id, m) {
      if (id === 'hvcb') return m.upState === 'CLOSED' ? (m.live ? 'running' : 'standby') : 'stopped';
      if (id === 'lvcb') return m.downState === 'CLOSED' ? (m.live ? 'running' : 'standby') : 'stopped';
      if (id === 'tx') return m.state;
      if (id === 'tt' || id === 'rel' || id === 'sa' || id === 'nct' || id === 'ne') return 'normal';
      if (id === 'cool') return m.live ? 'running' : 'standby';
      return null;
    }
    function flow(u, k) { return k === 'p' ? (u.state === 'running' ? 'running' : u.state === 'standby' ? 'standby' : 'stopped') : 'unavailable'; }
    var NODE_VALUES = {
      up: [{ k: 'tg', key: 'up', fmt: 'text' }], dn: [{ k: 'tg', key: 'down', fmt: 'text' }],
      hvcb: [{ k: 'st', key: 'upState', fmt: 'text' }, { k: 'a', key: 'upA', fmt: 'amp' }],   /* the breaker's own current, as on the sheet */
      lvcb: [{ k: 'st', key: 'downState', fmt: 'text' }],
      tx: [{ k: 'ld', key: 'pct', fmt: 'pct', prefix: 'LOAD' }, { k: 'kw', key: 'kwUnit', fmt: 'kw' },
        HV ? { k: 'ls', key: 'pei', fmt: 'pctp', prefix: 'PEI ≥' } : PDU ? { k: 'ls', key: 'nPdu', fmt: 'text' } : { k: 'ls', key: 'lossNow', fmt: 'kwl', prefix: 'LOSS ≤' }]
    };
    var core = PDU ? [{ label: 'Rating', key: 'rating', fmt: 'kva', basis: E + 'pdu_kva_rated' },
      { label: 'Voltage ratio', key: 'ratio', fmt: 'text' },
      { label: 'Impedance', key: 'z', fmt: 'text' },
      { label: 'Load, one unit', key: 'pct', fmt: 'pct', sim: true },
      { label: 'Power, one unit', key: 'kwUnit', fmt: 'kw', sim: true },
      { label: 'PDUs per stream', key: 'perStream', fmt: 'count', basis: E + 'pdu_per_hall_per_stream' },
      { label: 'Racks per PDU', key: 'racks', fmt: 'count', basis: E + 'racks_per_pdu' },
      { label: 'Power factor', key: 'pf', fmt: 'pf', basis: E + 'pdu_power_factor' },
      { label: 'Usable power, one unit', key: 'usable', fmt: 'kw', basis: E + 'pdu_kw_usable' },
      { label: 'Continuous loading limit', key: 'maxLd', fmt: 'pct', basis: E + 'pdu_max_loading_pct' },
      { label: 'Design load, both streams', key: 'normal', fmt: 'pct', basis: E + 'pdu_load_pct_normal' },
      { label: 'Load with one stream out', key: 'cont', fmt: 'pct', basis: E + 'pdu_load_pct_contingency' }]
      : [{ label: 'Rating', key: 'rating', fmt: HV ? 'mva' : 'kva', basis: E + (HV ? 'hv_tx_mva' : 'dist_tx_kva') },
      { label: 'Voltage ratio', key: 'ratio', fmt: 'text' },
      { label: 'Impedance', key: 'z', fmt: 'pct', basis: E + (HV ? 'hv_tx_impedance_pct' : 'dist_tx_impedance_pct') },
      { label: 'Load, one unit', key: 'pct', fmt: 'pct', sim: true },
      { label: 'Power, one unit', key: 'kwUnit', fmt: 'kw', sim: true },
      { label: HV ? 'Load with one transformer out' : 'Load with one stream out', key: 'cont', fmt: 'pct', basis: E + (HV ? 'hv_tx_load_pct_n1' : 'dist_tx_load_pct_contingency') }];
    var losses = PDU ? [{ label: 'Losses', key: 'losses', fmt: 'text' }]
      : HV
      ? [{ label: 'Peak efficiency index, EU ecodesign minimum', key: 'pei', fmt: 'pctp', basis: E + 'hv_tx_pei_min' },
        { label: 'Losses', key: 'lossNow', fmt: 'text' }]
      : [{ label: 'No-load loss P0, EU ecodesign maximum', key: 'p0', fmt: 'watt', basis: E + 'dist_tx_p0_w' },
        { label: 'Load loss Pk at rated current, EU ecodesign maximum', key: 'pk', fmt: 'watt', basis: E + 'dist_tx_pk_w' },
        { label: 'Loss at present load (≤)', key: 'lossNow', fmt: 'kwl' },
        { label: 'Efficiency at present load (≥)', key: 'effNow', fmt: 'pcte' },
        { label: 'Loss at design load (≤)', key: 'lossDesign', fmt: 'kwl', basis: E + 'dist_tx_loss_kw_normal' },
        { label: 'Efficiency at design load (≥)', key: 'effDesign', fmt: 'pcte', basis: E + 'dist_tx_eff_normal' }];
    var BLOCKS = [
      { id: 'windings', node: 'tx', name: K.winName, standard: K.winStd,
        role: ['The HV winding magnetises the core; the LV winding takes the power off at the lower voltage.',
          'No-load loss heats the core all the time; load loss grows with the square of the load.'],
        values: core.concat(losses) },
      { id: 'upstream', node: 'hvcb', name: 'Upstream circuit breaker', standard: 'IEC 62271-100 · IEC 60617-7',
        role: ['Switches and protects the HV side of the transformer.', 'Its relay settings open from the single-line (Time–current curves).'],
        values: [{ label: 'Breaker', key: 'up', fmt: 'text' }, { label: 'Position', key: 'upState', fmt: 'text', sim: true },
          { label: 'Breaker current', key: 'upA', fmt: 'amp', sim: true }, { label: 'Current, one unit', key: 'aUnit', fmt: 'amp', sim: true },
          PDU ? { label: 'Full-load current, primary', key: 'flaHv', fmt: 'text' }
            : { label: 'Full-load current, HV side', key: 'flaHv', fmt: 'amp', basis: E + (HV ? 'hv_tx_fla_a' : 'dist_tx_fla_mv_a') }] },
      { id: 'downstream', node: 'lvcb', name: 'Downstream circuit breaker', standard: K.dnStd,
        role: ['Connects the LV side to its switchboard.', 'The through-fault it must break is the fault level below.'],
        values: [{ label: 'Breaker', key: 'down', fmt: 'text' }, { label: 'Position', key: 'downState', fmt: 'text', sim: true },
          PDU ? { label: 'Full-load current, secondary', key: 'flaLv', fmt: 'text' }
            : { label: 'Full-load current, LV side', key: 'flaLv', fmt: 'amp', basis: E + (HV ? 'mv_tx_fla_a' : 'dist_tx_fla_lv_a') },
          PDU ? { label: 'Fault level, secondary', key: 'faultLv', fmt: 'text' }
            : { label: 'Fault level, LV side', key: 'faultLv', fmt: 'ka', basis: E + (HV ? 'mv_fault_level_ka' : 'lv_fault_level_ka') }] },
      { id: 'temperature', node: 'tt', name: 'Temperature protection', standard: K.tempStd,
        role: ['Alarms, then trips, when the windings run too hot.', HV ? 'The Buchholz relay trips on gas from an internal fault.' : 'A PT100 sits in each LV winding.'],
        values: HV ? [{ label: 'Winding temperature', key: 'temp', fmt: 'text' }, { label: 'Buchholz', key: 'buchholz', fmt: 'text' }]
          : [{ label: 'Winding temperature', key: 'temp', fmt: 'text' }] },
      { id: 'cooling', node: 'cool', name: HV ? 'Cooling — ONAN radiators' : 'Cooling — natural air', standard: 'IEC 60076-2',
        role: ['Carries the losses away as heat.', 'Every kW of loss is a kW of heat in the room or yard.'],
        values: [{ label: 'Cooling state', key: 'cooling', fmt: 'text' }, { label: HV ? 'Tap position' : 'Off-circuit tap', key: 'tap', fmt: 'text' }] },
      { id: 'arrester', node: 'sa', name: 'Surge arrester', standard: 'IEC 60099-4',
        role: ['Clamps lightning and switching surges before they reach the HV winding.', 'Connected phase to earth at the terminals.'],
        values: [{ label: 'Surge counter', key: 'surge', fmt: 'text' }] },
      { id: 'neutral', node: 'ne', name: K.neName, standard: K.neStd,
        role: [HV ? 'Limits a medium-voltage earth fault to a current the relays can see.' : 'Earths the LV star point (TN-S).', 'The neutral CT feeds the earth-fault protection.'],
        values: HV ? [{ label: 'Resistance', key: 'ngr', fmt: 'text' }, { label: 'Earth-fault current', key: 'efA', fmt: 'amp', basis: E + 'mv_earth_fault_a' },
          { label: 'Neutral current', key: 'neutralA', fmt: 'text' }]
          : [{ label: 'Neutral current', key: 'neutralA', fmt: 'text' }] }
    ];
    var NODE_BLOCK = { up: 'upstream', dn: 'downstream', rel: 'temperature', nct: 'neutral' };
    var baseModel = model;
    function fullModel(u, s) {
      var m = baseModel(u, s), e = (s && s.electrical) || {};
      if (HV) { m.ngr = e.mv_ngr_ohm + ' Ω'; m.efA = e.mv_earth_fault_a; }
      if (PDU) {   /* only what the engine publishes for the PDU; the distribution-transformer keys never stand in for it */
        m.rating = e.pdu_kva_rated; m.ratio = e.lv_voltage_v + ' V in · output not modelled';
        m.z = NM; m.cont = e.pdu_load_pct_contingency; m.normal = e.pdu_load_pct_normal;
        m.pf = e.pdu_power_factor; m.maxLd = e.pdu_max_loading_pct; m.usable = e.pdu_kw_usable;
        m.perStream = e.pdu_per_hall_per_stream; m.racks = e.racks_per_pdu;
        m.flaHv = NM; m.flaLv = NM; m.faultLv = NM; m.p0 = NM; m.pk = NM; m.lossNow = NM; m.effNow = NM;
        m.lossDesign = NM; m.effDesign = NM; m.losses = NM;
        m.nPdu = '× ' + e.pdu_per_hall_per_stream + ' per stream';
      }
      return m;
    }
    return { title: HV ? 'Power transformer' : PDU ? 'Power distribution unit' : 'Distribution transformer', sheet: sheet, model: fullModel, nodeState: nodeState, flow: flow,
      nodeValues: NODE_VALUES, blocks: BLOCKS, nodeBlock: NODE_BLOCK, media: [['power', 'Power']], defaultBlock: 'windings' };
  }
  Object.keys(KINDS).forEach(function (k) { R.register(k, make(k)); });
})(typeof window !== 'undefined' ? window : null);
