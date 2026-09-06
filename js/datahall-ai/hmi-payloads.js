/* ============================================================================
 * hmi-payloads.js — ONE DOM-free source for every number an equipment HMI prints
 * ----------------------------------------------------------------------------
 * Track A §A5 (v2.2.0). The right-side inspector (tier 1) and the deep HMI mimic
 * (tier 2) both render the payload this module builds, so the two tiers cannot
 * disagree, and the numbers are assertable in Node before a browser ever loads.
 *
 * A payload row is a Point:
 *   { point, label, value, text, unit, quality: published|derived|simulated|state|label|authored,
 *     basis?: '<registry id>'      // ONLY when the value IS the registry value (parity enforced here)
 *     declared?: '<reason ≥ 40>'   // everything else says what it is
 *     state?, anchor?, band? }
 *
 * Sources, in order of preference:
 *   E  engine value through the page adapter (DHE field → registry id via DH_BASIS)   → basis
 *   P  engine plane design.planes.<key>                                                → basis
 *   S  simulated reading around an engine plane or a declared rating (sim-telemetry) → declared
 *   ST state from a scenario engine (electrical topology / cooling scenario table)     → declared
 *   D  page-authored specification or an identity over marked parameters              → declared
 * No Math.random anywhere; no value is computed that the engine publishes.
 *
 * ES5, zero-build, window.RZDatahallAIHmiPayloads + module.exports. Fails closed:
 * a missing snapshot, an unmapped field or a basis row off the registry value throws
 * in Node and returns { unavailable:true, reason } in the browser.
 * ==========================================================================*/
(function (root) {
  'use strict';

  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }
  function finite(x) { return typeof x === 'number' && isFinite(x); }
  function grp(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmt(v, digits) {
    if (!finite(v)) { return '—'; }
    var d = finite(digits) ? digits : (Math.abs(v) >= 100 ? 0 : 1);
    if (d === 0) { return grp(v); }
    var t = v.toFixed(d);
    var parts = t.split('.');
    return (Math.abs(v) >= 1000 ? grp(Number(parts[0])) : parts[0]) + '.' + parts[1];
  }
  function pad2(n) { return String(n).padStart ? String(n).padStart(2, '0') : ('0' + n).slice(-2); }

  var TOL = 1e-6;
  function parity(value, rec) {
    if (!finite(value) || !rec || !finite(rec.value)) { return false; }
    return Math.abs(value - rec.value) <= TOL * Math.max(1, Math.abs(rec.value));
  }

  /* ------------------------------------------------------------------------
   * Cooling scenarios — deterministic states the coin-flips used to invent.
   * Selected by #coolingScenario on the page; 'normal' when absent.
   * ---------------------------------------------------------------------- */
  var COOLING_SCENARIOS = deepFreeze({
    normal: { label: 'Normal — all cooling duty on line', cduPumpFault: null, chillerTripped: null, leakWetZones: [], stpBlowerDuty: 1 },
    'cdu-pump-fail': { label: 'CDU pump 1 failure — standby pump takes duty', cduPumpFault: 1, chillerTripped: null, leakWetZones: [], stpBlowerDuty: 1 },
    'chiller-trip': { label: 'Chiller CH-03 trip — standby chiller starts', cduPumpFault: null, chillerTripped: 3, leakWetZones: [], stpBlowerDuty: 1 },
    'leak-z07': { label: 'Leak detected — zone 7 rope wet', cduPumpFault: null, chillerTripped: null, leakWetZones: [7], stpBlowerDuty: 2 }
  });

  /* ------------------------------------------------------------------------
   * Builder
   * ---------------------------------------------------------------------- */
  function Builder(ctx, classId, id, meta) {
    this.ctx = ctx; this.classId = classId; this.id = String(id); this.meta = meta;
    this.hall = finite(ctx.hall) ? ctx.hall : 1;
    this.tabs = { live: [], capacity: [], deps: { upstream: [], downstream: [], edges: [] }, alarms: [], trend: null, maint: [] };
    this.index = {};
    this.counts = { published: 0, derived: 0, simulated: 0, state: 0, label: 0, authored: 0 };
    this.title = meta.label + ' ' + this.id;
    this.statusChip = { label: 'NORMAL', state: 'normal' };
    this.related = [];
    this.openHmi = null;
  }
  Builder.prototype.push = function (tab, pt) {
    if (pt.basis && pt.declared) { throw new Error('hmi-payloads: a point carries basis OR declared, never both: ' + pt.point); }
    if (!pt.basis && (!pt.declared || pt.declared.length < 40)) { throw new Error('hmi-payloads: undeclared point ' + this.classId + ':' + pt.point); }
    if (pt.value !== null && typeof pt.value === 'number' && !isFinite(pt.value)) { throw new Error('hmi-payloads: NaN in ' + pt.point); }
    var frozen = deepFreeze(pt);
    this.tabs[tab].push(frozen); this.index[pt.point] = frozen;
    this.counts[pt.quality] = (this.counts[pt.quality] || 0) + 1;
    return frozen;
  };
  /* engine adapter value */
  Builder.prototype.E = function (tab, point, label, field, unit, o) {
    o = o || {};
    var ctx = this.ctx, id = ctx.basisMap[field];
    if (!id) { throw new Error('hmi-payloads: DH_BASIS has no id for adapter field ' + field); }
    var rec = ctx.registryIndex.get(id);
    if (!rec) { throw new Error('hmi-payloads: registry has no record for ' + id); }
    var raw = ctx.adapter[field];
    var value = finite(raw) ? raw : (typeof raw === 'string' ? raw : null);
    if (finite(value) && !o.identity && !parity(value, rec)) {
      /* the adapter rounds some fields — accept the rounded twin only when it round-trips at the printed precision */
      var d = finite(o.digits) ? o.digits : 2;
      if (Math.abs(Number(value.toFixed(d)) - Number(rec.value.toFixed(d))) > Math.pow(10, -d) * 1.01) {
        throw new Error('hmi-payloads: adapter ' + field + '=' + value + ' is not registry ' + id + '=' + rec.value);
      }
    }
    var text = typeof value === 'string' ? value : (o.text || fmt(value, o.digits));
    var quality = rec.evidenceClass === 'PUBLISHED' || rec.evidenceClass === 'STANDARD' || rec.evidenceClass === 'VENDOR' ? 'published'
      : rec.evidenceClass === 'LABEL' ? 'label' : 'derived';
    return this.push(tab, { point: point, label: label, value: value, text: text, unit: unit || rec.unit || '', quality: quality, basis: id, params: o.also && o.also.length ? o.also.map(function (f) { return ctx.basisMap[f] || f; }) : null });
  };
  /* engine plane */
  Builder.prototype.P = function (tab, point, label, key, unit, o) {
    o = o || {};
    var ctx = this.ctx, id = 'design.planes.' + key;
    var rec = ctx.registryIndex.get(id);
    if (!rec) { throw new Error('hmi-payloads: registry has no plane ' + id); }
    var planes = ctx.snapshot && ctx.snapshot.design && ctx.snapshot.design.planes;
    var value = planes && finite(planes[key]) ? planes[key] : rec.value;
    return this.push(tab, { point: point, label: label, value: value, text: fmt(value, finite(o.digits) ? o.digits : 1), unit: unit || '°C', quality: 'derived', basis: id });
  };
  /* simulated around an anchor: {field}|{plane}|{value,text} */
  Builder.prototype.S = function (tab, point, label, anchor, band, unit, o) {
    o = o || {};
    var ctx = this.ctx, anchorValue = null, anchorId = null, anchorText = null;
    if (anchor && anchor.field) { anchorValue = ctx.adapter[anchor.field]; anchorId = ctx.basisMap[anchor.field] || null; }
    else if (anchor && anchor.plane) { anchorId = 'design.planes.' + anchor.plane; var pl = ctx.snapshot.design.planes[anchor.plane]; anchorValue = pl; }
    else if (anchor && finite(anchor.value)) { anchorValue = anchor.value; anchorText = anchor.text || (anchor.value + (unit ? ' ' + unit : '')); }
    var offset = finite(o.offset) ? o.offset : 0, scale = finite(o.scale) ? o.scale : 1;
    var p = ctx.sim.point({ id: this.classId + ':' + this.id + ':' + this.hall, point: point, anchor: finite(anchorValue) ? anchorValue * scale + offset : null, band: band, tick: ctx.tick, period: o.period, digits: finite(o.digits) ? o.digits : 1, min: o.min, max: o.max });
    var reason = ctx.sim.declare({ point: point, anchorId: anchorId, anchorText: anchorText || (finite(offset) && offset !== 0 ? 'offset ' + offset : null) || anchorText, band: band, unit: unit });
    return this.push(tab, { point: point, label: label, value: p.value, text: p.text, unit: unit || '', quality: 'simulated', declared: reason, anchor: anchorId || anchorText, band: band });
  };
  /* page-authored constant or an identity over marked parameters */
  Builder.prototype.D = function (tab, point, label, text, reason, value) {
    return this.push(tab, { point: point, label: label, value: finite(value) ? value : null, text: String(text), unit: '', quality: 'authored', declared: reason });
  };
  /* scenario state */
  Builder.prototype.ST = function (tab, point, label, state, reason) {
    var text = String(state).toUpperCase();
    return this.push(tab, { point: point, label: label, value: null, text: text, unit: '', quality: 'state', state: String(state).toLowerCase(), declared: reason });
  };
  Builder.prototype.L = function (tab, point, label, text) {
    return this.push(tab, { point: point, label: label, value: null, text: String(text), unit: '', quality: 'label', declared: 'a name or nameplate label used as text, never a denominator (Track A §A5)' });
  };
  Builder.prototype.alarm = function (a) {
    var ctx = this.ctx;
    this.tabs.alarms.push(deepFreeze({
      tag: a.tag, point: a.point, location: a.location || ('DH-0' + this.hall), system: a.system || this.meta.system || 'cooling',
      severity: a.severity || 'high', lifecycle: a.lifecycle || 'active_unack', kind: 'discrete', quality: 'simulated',
      event: a.event || 'alarm', action: a.action || 'acknowledge', scenario: a.scenario || ctx.scenarioId || 'normal',
      operator: 'DC AI operator', message: a.message, previousState: a.previousState || 'normal', currentState: a.currentState || 'alarm'
    }));
  };
  Builder.prototype.trend = function (point, label, unit, anchor, band, o) {
    o = o || {};
    var ctx = this.ctx, anchorValue = anchor && anchor.field ? ctx.adapter[anchor.field] : anchor && anchor.plane ? ctx.snapshot.design.planes[anchor.plane] : anchor && anchor.value;
    var anchorId = anchor && anchor.field ? ctx.basisMap[anchor.field] : anchor && anchor.plane ? 'design.planes.' + anchor.plane : null;
    var series = ctx.sim.series({ id: this.classId + ':' + this.id + ':' + this.hall, point: point, anchor: finite(anchorValue) ? anchorValue : null, band: band, tick: ctx.tick, n: o.n || 30, digits: finite(o.digits) ? o.digits : 1 });
    this.tabs.trend = deepFreeze({ point: point, label: label, unit: unit || '', series: series, anchor: anchorId || (finite(anchorValue) ? anchorValue : null), band: band,
      declared: 'simulated history of ' + point + ' around ' + (anchorId || 'the page-authored ' + anchorValue + (unit ? ' ' + unit : '')) + ' ±' + band + ', same seed and tick law as the live value (Track A §A5)' });
  };
  Builder.prototype.dep = function (dir, id, label) { this.tabs.deps[dir].push(deepFreeze({ id: id, label: label })); };
  Builder.prototype.edge = function (id) { this.tabs.deps.edges.push(id); };
  Builder.prototype.chip = function (label, state) { this.statusChip = { label: label, state: state }; };
  Builder.prototype.tier2 = function (opener, args) { this.openHmi = { opener: opener, args: args }; };

  Builder.prototype.build = function () {
    var self = this, index = this.index, ctx = this.ctx;
    var payload = {
      classId: this.classId, id: this.id, hall: this.hall, title: this.title, kind: this.meta.kind, label: this.meta.label,
      statusChip: this.statusChip, tabs: this.tabs,
      actions: { openHmi: this.openHmi, related: this.related },
      provenance: {
        engineVersion: ctx.snapshot && ctx.snapshot.meta ? ctx.snapshot.meta.version : null,
        registryVersion: ctx.registryVersion || null,
        scenarioId: ctx.scenarioId || 'normal', coolingScenarioId: ctx.coolingScenarioId || 'normal', tick: ctx.tick,
        counts: this.counts
      },
      get: function (p) { return index[p] || null; },
      v: function (p) { var r = index[p]; return r ? r.text : '—'; },
      n: function (p) { var r = index[p]; return r && finite(r.value) ? r.value : null; },
      state: function (p) { var r = index[p]; return r ? r.state || null : null; },
      opt: function (p) {
        var r = index[p];
        if (!r) { return { declared: 'point ' + p + ' is not published by the payload for ' + self.classId + ' (Track A §A5)' }; }
        if (r.basis) { return r.params ? { basis: r.basis, params: r.params } : { basis: r.basis }; }
        return { declared: r.declared };
      },
      /* a composite string that prints several points: hooked only when EVERY point is registry-backed */
      optAll: function (ps) {
        var rows = ps.map(function (p) { return index[p] || null; });
        if (rows.length && rows.every(function (r) { return r && r.basis; })) {
          var ids = []; rows.forEach(function (r) { if (ids.indexOf(r.basis) < 0) { ids.push(r.basis); } (r.params || []).forEach(function (q) { if (ids.indexOf(q) < 0) { ids.push(q); } }); });
          return ids.length > 1 ? { basis: ids[0], params: ids.slice(1) } : { basis: ids[0] };
        }
        var reasons = rows.map(function (r, i) { return r ? (r.basis ? r.point + ' = registry ' + r.basis : r.declared) : 'point ' + ps[i] + ' not published'; });
        return { declared: 'composite of ' + ps.join(', ') + ': ' + reasons.join(' | ') + ' (Track A §A5)' };
      }
    };
    return deepFreeze(payload);
  };

  /* ------------------------------------------------------------------------
   * Shared fragments
   * ---------------------------------------------------------------------- */
  function electricalState(ctx, key, fallback) {
    var st = ctx.scenario && ctx.scenario.state;
    if (!st) { return fallback; }
    if (key.indexOf('SRC-') === 0) { return st.sources && st.sources[key] ? st.sources[key].state : fallback; }
    if (key.indexOf('UPS-') === 0) { return st.ups && st.ups[key] ? st.ups[key] : fallback; }
    if (key.indexOf('ATS-') === 0) { return st.ats && st.ats[key] ? st.ats[key].state : fallback; }
    if (key.indexOf('BUSWAY-') === 0) { return st.busways && st.busways[key] ? st.busways[key] : fallback; }
    if (key.indexOf('BR-') === 0) { return st.breakers && st.breakers[key] ? st.breakers[key] : fallback; }
    return fallback;
  }
  function edgeState(ctx, edgeId) {
    var edges = ctx.scenario && ctx.scenario.edges;
    if (!edges) { return 'energized'; }
    for (var i = 0; i < edges.length; i++) { if (edges[i].id === edgeId) { return edges[i].semanticState; } }
    return 'unmapped';
  }
  function feedEdgeState(ctx, feed, kind) {
    /* the first edge whose id mentions the feed and the kind (TX-A, UPS-A, BUSWAY-A …) */
    var edges = ctx.scenario && ctx.scenario.edges;
    if (!edges) { return 'energized'; }
    var needle = kind + '-' + feed;
    for (var i = 0; i < edges.length; i++) { if (edges[i].id.indexOf(needle) >= 0) { return edges[i].semanticState; } }
    return 'energized';
  }
  var SCEN_REASON = 'state from the electrical scenario engine (RZDatahallAIElectrical.evaluateScenario) — never a die roll (Track A §A5)';
  var COOL_REASON = 'state from the deterministic cooling scenario table (COOLING_SCENARIOS) — never a die roll (Track A §A5)';
  var IDENT = function (ids) { return 'an identity over marked parameters (' + ids + '), printed for the operator; not itself a registry value (Track A §A5)'; };
  var SPEC = function (what) { return what + ' is a page-authored equipment specification, not an engine quantity (Track A §A5)'; };

  function coolingScenario(ctx) { return COOLING_SCENARIOS[ctx.coolingScenarioId] || COOLING_SCENARIOS.normal; }

  /* ------------------------------------------------------------------------
   * Class definitions
   * ---------------------------------------------------------------------- */
  var CLASSES = {};
  function def(classId, meta, build) { CLASSES[classId] = { classId: classId, kind: meta.kind, label: meta.label, system: meta.system, tier2: meta.tier2 || null, build: build }; }

  function num(id) { var n = parseInt(String(id).replace(/\D/g, ''), 10); return isFinite(n) ? n : 1; }
  def('cdu', { kind: 'engine', label: 'CDU', system: 'cooling', tier2: 'cdu' }, function (b, ctx, id) {
    var n = num(id), cs = coolingScenario(ctx), A = ctx.adapter;
    b.title = 'CDU-' + pad2(n) + ' — DH-0' + b.hall;
    b.P('live', 'htw_supply_c', 'HTW supply', 'p05_htw_supply_c');
    b.P('live', 'htw_return_c', 'HTW return', 'p06_htw_return_c');
    b.P('live', 'tcs_supply_c', 'TCS supply', 'p07_tcs_supply_c');
    b.P('live', 'tcs_return_c', 'TCS return', 'p08_tcs_return_c');
    b.E('live', 'flow_lpm', 'TCS flow', 'cduFlowPerUnitLpm', 'L/min', { digits: 0 });
    b.E('live', 'duty_kwth', 'Heat transferred', 'cduDutyPerUnit', 'kWth', { digits: 0 });
    b.S('live', 'dp_bar', 'Differential pressure', { value: 1.8, text: '1.8 bar design ΔP' }, 0.25, 'bar', { digits: 2 });
    b.S('live', 'pump_rpm', 'Pump speed', { value: 1450, text: '1450 rpm nominal' }, 40, 'rpm', { digits: 0 });
    b.S('live', 'pump_amps', 'Pump current', { value: 42, text: '42 A nameplate' }, 3, 'A', { digits: 1 });
    b.S('live', 'valve_pct', 'Control valve', { value: 70, text: '70 % design opening' }, 10, '%', { digits: 0, min: 0, max: 100 });
    var running = A.cduRunning, isStandby = finite(running) && n > running;
    var p1 = isStandby ? 'stby' : (cs.cduPumpFault === 1 ? 'fault' : 'run'), p2 = isStandby ? 'stby' : 'run', p3 = isStandby ? 'stby' : (cs.cduPumpFault === 1 ? 'run' : 'stby');
    b.ST('live', 'pump_state_1', 'Pump 1', p1, COOL_REASON); b.ST('live', 'pump_state_2', 'Pump 2', p2, COOL_REASON); b.ST('live', 'pump_state_3', 'Pump 3', p3, COOL_REASON);
    b.chip(isStandby ? 'STANDBY' : (p1 === 'fault' ? 'DEGRADED' : 'RUN'), isStandby ? 'standby' : (p1 === 'fault' ? 'fault' : 'normal'));
    b.E('capacity', 'unit_kwth', 'Unit rating', 'cduRating', 'kWth', { digits: 0 });
    b.E('capacity', 'duty_per_hall', 'Duty units per hall', 'cduRunning', '', { digits: 0 });
    b.E('capacity', 'installed_per_hall', 'Installed per hall', 'cduInstalled', '', { digits: 0 });
    b.E('capacity', 'liquid_hall_kwth', 'Hall liquid heat', 'liquidHeat', 'kWth', { digits: 0 });
    b.D('capacity', 'approach_k', 'CDU approach', fmt(A.cduApproachK, 1) + ' K', 'CDU approach is the PUBLISHED CoolIT CHx1000 approach (model leaf thermal.cduApproachK), printed as authored (Track A §A5)', A.cduApproachK);
    b.dep('upstream', 'fws-pump-station:dh0' + b.hall, 'HTW pump station'); b.dep('downstream', 'tcs-manifold:dh0' + b.hall, 'TCS manifold');
    if (p1 === 'fault') { b.alarm({ tag: 'CDU-' + pad2(n), point: 'PUMP-1', severity: 'high', message: 'CDU pump 1 fault — standby pump 3 running', system: 'cooling' }); }
    b.trend('dp_bar', 'Differential pressure', 'bar', { value: 1.8 }, 0.25, { digits: 2 });
    b.S('maint', 'strainer_dp', 'Strainer ΔP', { value: 0.2, text: '0.2 bar clean strainer' }, 0.08, 'bar', { digits: 2, min: 0 });
    b.S('maint', 'expansion_level', 'Expansion vessel level', { value: 55, text: '55 % fill' }, 8, '%', { digits: 0, min: 0, max: 100 });
    b.S('maint', 'run_hours', 'Run hours', { value: 6200, text: '6,200 h since commissioning' }, 200, 'h', { digits: 0, period: 400 });
    b.tier2('cdu', [n]);
  });

  def('chiller', { kind: 'engine', label: 'Chiller', system: 'cooling', tier2: 'chiller' }, function (b, ctx, id) {
    var n = num(id), cs = coolingScenario(ctx), A = ctx.adapter;
    b.title = 'CH-' + pad2(n) + ' — facility plant';
    b.P('live', 'chw_supply_c', 'CHW supply', 'p12_chw_supply_c'); b.P('live', 'chw_return_c', 'CHW return', 'p13_chw_return_c');
    b.P('live', 'cdw_supply_c', 'CDW in', 'p15_cdw_supply_c'); b.P('live', 'cdw_return_c', 'CDW out', 'p16_cdw_return_c');
    b.P('live', 'cop', 'COP (derived from the lift)', 'p18_cop_air_path', '', { digits: 2 });
    b.P('live', 'evap_refrig_c', 'Evaporating refrigerant', 'p14_air_evap_refrig_c'); b.P('live', 'cond_refrig_c', 'Condensing refrigerant', 'p17_cond_refrig_c');
    var tripped = cs.chillerTripped === n, running = A.chillersRunning, isStandby = finite(running) && n > running && !(cs.chillerTripped && n === running + 1);
    var st = tripped ? 'trip' : isStandby ? 'stby' : 'run';
    b.ST('live', 'unit_state', 'Unit', st, COOL_REASON);
    b.chip(st === 'trip' ? 'TRIPPED' : st === 'stby' ? 'STANDBY' : 'RUN', st === 'trip' ? 'fault' : st === 'stby' ? 'standby' : 'normal');
    b.S('live', 'vfd_pct', 'Compressor VFD', { value: 82, text: '82 % design point' }, 6, '%', { digits: 0, min: 0, max: 100 });
    b.S('live', 'bearing_c', 'Bearing temperature', { value: 48, text: '48 °C magnetic-bearing class' }, 3, '°C');
    b.S('live', 'oil_bar', 'Lube oil pressure', { value: 3.2, text: '3.2 bar nominal' }, 0.2, 'bar', { digits: 2 });
    b.E('capacity', 'unit_kwth', 'Unit duty', 'chillerRating', 'kWth', { digits: 0 });
    b.E('capacity', 'running_design', 'Running at design day', 'chillersRunning', '', { digits: 0 });
    b.E('capacity', 'running_worst', 'Running at worst bin', 'chillersWorst', '', { digits: 0 });
    b.E('capacity', 'installed', 'Installed', 'chillersInstalled', '', { digits: 0 });
    b.E('capacity', 'chw_flow_hall', 'CHW flow per hall', 'chwFlowM3h', 'm³/h', { digits: 0 });
    var kwTon = finite(A.pb_chiller) && finite(A.airHeat) && A.airHeat > 0 ? A.pb_chiller / (A.airHeat / 3.517) : null;
    b.D('capacity', 'kw_ton', 'Plant kW/ton (air path)', kwTon == null ? '—' : kwTon.toFixed(2), IDENT('design.electrical.chillers_hall_kwe over heat.air_hall_kwth in tons'), kwTon);
    b.dep('upstream', 'dry-cooler:1', 'Dry-cooler field (CDW)'); b.dep('downstream', 'crah:1', 'CRAH coils (CHW)');
    if (tripped) { b.alarm({ tag: 'CH-' + pad2(n), point: 'TRIP', severity: 'critical', message: 'Chiller trip — standby unit started', system: 'cooling' }); }
    b.trend('bearing_c', 'Bearing temperature', '°C', { value: 48 }, 3);
    b.S('maint', 'run_hours', 'Run hours', { value: 18000, text: '18,000 h class' }, 400, 'h', { digits: 0, period: 400 });
    b.S('maint', 'starts', 'Starts', { value: 240, text: '240 starts class' }, 10, '', { digits: 0, period: 400 });
    b.tier2('chiller', [n]);
  });

  def('dry-cooler', { kind: 'engine', label: 'Dry cooler bank', system: 'cooling', tier2: 'dryCooler' }, function (b, ctx, id) {
    var n = num(id), A = ctx.adapter;
    b.title = 'DC-' + pad2(n) + ' — facility field';
    b.P('live', 'ambient_c', 'Ambient DB', 'p00_ambient_db_c'); b.P('live', 'leaving_c', 'Fluid leaving', 'p02_dry_cooler_leaving_c');
    b.P('live', 'cdw_supply_c', 'CDW to chillers', 'p15_cdw_supply_c'); b.P('live', 'cdw_return_c', 'CDW from chillers', 'p16_cdw_return_c');
    b.S('live', 'fan_pct', 'Fan speed', { value: 78, text: '78 % design speed' }, 8, '%', { digits: 0, min: 0, max: 100 });
    b.S('live', 'motor_c', 'Fan motor temperature', { value: 62, text: '62 °C class F winding' }, 4, '°C');
    var running = A.dryCoolersRunning, st = finite(running) && n > running ? 'stby' : 'run';
    b.ST('live', 'bank_state', 'Bank', st, COOL_REASON); b.chip(st === 'run' ? 'RUN' : 'STANDBY', st === 'run' ? 'normal' : 'standby');
    b.E('capacity', 'unit_kwth', 'Unit heat rejection', 'dryCoolerRating', 'kWth', { digits: 0 });
    b.E('capacity', 'running', 'Running at design', 'dryCoolersRunning', '', { digits: 0 });
    b.E('capacity', 'installed', 'Installed', 'dryCoolersInstalled', '', { digits: 0 });
    var unitFans = finite(A.pbF_dryCoolerFans) && finite(running) && running > 0 ? A.pbF_dryCoolerFans / running : null;
    b.D('capacity', 'unit_fans_kwe', 'Fan power per running unit', unitFans == null ? '—' : fmt(unitFans, 0) + ' kWe', IDENT('design.electrical.dry_cooler_fans_kwe over equipment.dry_coolers_running_design'), unitFans);
    var kwTon = unitFans != null && finite(A.dryCoolerRating) && A.dryCoolerRating > 0 ? unitFans / (A.dryCoolerRating / 3.517) : null;
    b.D('capacity', 'kw_ton', 'Unit kW/ton (fans over rejection)', kwTon == null ? '—' : kwTon.toFixed(2), IDENT('design.electrical.dry_cooler_fans_kwe over equipment.dry_coolers_running_design, over equipment.dry_cooler_unit_kwth in tons'), kwTon);
    var unitFlow = finite(A.cdwFlowFacilityM3h) && finite(running) && running > 0 ? A.cdwFlowFacilityM3h / running : null;
    b.D('capacity', 'unit_flow_m3h', 'CDW flow per running unit', unitFlow == null ? '—' : fmt(unitFlow, 0) + ' m³/h', IDENT('design.flows.cdw_m3h over equipment.dry_coolers_running_design'), unitFlow);
    b.D('capacity', 'approach_k', 'Dry-cooler approach', fmt(A.dryCoolerApproachK, 1) + ' K', 'dry-cooler approach is the PUBLISHED unit approach (model leaf thermal.dryCoolerApproachK), printed as authored (Track A §A5)', A.dryCoolerApproachK);
    b.dep('upstream', 'chiller:1', 'Chiller condensers'); b.dep('downstream', 'cw-pump-station:1', 'CDW pump station');
    b.trend('fan_pct', 'Fan speed', '%', { value: 78 }, 8, { digits: 0 });
    b.S('maint', 'coil_dp', 'Coil air-side ΔP', { value: 60, text: '60 Pa clean coil' }, 12, 'Pa', { digits: 0, min: 0 });
    b.tier2('dryCooler', [n]);
  });

  def('cw-pump-station', { kind: 'engine', label: 'CDW pump station', system: 'cooling', tier2: 'eq' }, function (b, ctx) {
    b.title = 'CDW pump station — facility';
    b.E('live', 'cdw_flow', 'CDW flow', 'cdwFlowFacilityM3h', 'm³/h', { digits: 0 });
    b.P('live', 'cdw_supply_c', 'Supply', 'p15_cdw_supply_c'); b.P('live', 'cdw_return_c', 'Return', 'p16_cdw_return_c');
    b.S('live', 'head_bar', 'Discharge head', { value: 4.5, text: '4.5 bar design head' }, 0.3, 'bar', { digits: 2 });
    b.S('live', 'vib_mms', 'Vibration', { value: 2.1, text: '2.1 mm/s ISO 10816 zone A' }, 0.4, 'mm/s', { digits: 2, min: 0 });
    b.ST('live', 'p1', 'P-CW-1', 'run', COOL_REASON); b.ST('live', 'p2', 'P-CW-2', 'run', COOL_REASON); b.ST('live', 'p3', 'P-CW-3', 'stby', COOL_REASON);
    b.E('capacity', 'pumps_kwe', 'CDW pump power', 'pbF_pumps', 'kWe', { digits: 0, also: [] });
    b.dep('upstream', 'dry-cooler:1', 'Dry-cooler field'); b.dep('downstream', 'chiller:1', 'Chiller condensers');
    b.trend('head_bar', 'Discharge head', 'bar', { value: 4.5 }, 0.3, { digits: 2 });
    b.S('maint', 'bearing_c', 'Bearing DE', { value: 55, text: '55 °C class' }, 4, '°C');
    b.tier2('eq', ['CW Pump Station']);
  });

  def('fws-pump-station', { kind: 'engine', label: 'HTW pump station', system: 'cooling', tier2: 'eq' }, function (b, ctx) {
    b.title = 'HTW (facility water) pump station — DH-0' + b.hall;
    b.E('live', 'htw_flow', 'HTW flow per hall', 'htwFlowM3h', 'm³/h', { digits: 0 });
    b.P('live', 'htw_supply_c', 'Supply', 'p05_htw_supply_c'); b.P('live', 'htw_return_c', 'Return', 'p06_htw_return_c');
    b.S('live', 'head_bar', 'Discharge head', { value: 3.8, text: '3.8 bar design head' }, 0.3, 'bar', { digits: 2 });
    b.S('live', 'vfd_hz', 'VFD frequency', { value: 47, text: '47 Hz design point' }, 2, 'Hz', { digits: 1, max: 50 });
    b.ST('live', 'p1', 'P-HTW-1', 'run', COOL_REASON); b.ST('live', 'p2', 'P-HTW-2', 'run', COOL_REASON); b.ST('live', 'p3', 'P-HTW-3', 'stby', COOL_REASON);
    b.dep('upstream', 'chiller:1', 'Chiller plant / dry-cooler field'); b.dep('downstream', 'cdu:1', 'Row CDUs');
    b.trend('head_bar', 'Discharge head', 'bar', { value: 3.8 }, 0.3, { digits: 2 });
    b.S('maint', 'expansion_level', 'Expansion tank level', { value: 60, text: '60 % fill' }, 8, '%', { digits: 0, min: 0, max: 100 });
    b.tier2('eq', ['FWS Pump Station']);
  });

  def('tcs-manifold', { kind: 'engine', label: 'TCS manifold', system: 'cooling', tier2: 'eq' }, function (b, ctx) {
    b.title = 'TCS manifold — DH-0' + b.hall;
    b.P('live', 'tcs_supply_c', 'TCS supply', 'p07_tcs_supply_c'); b.P('live', 'tcs_return_c', 'TCS return', 'p08_tcs_return_c');
    b.E('live', 'tcs_flow_hall', 'Hall TCS flow', 'tcsFlowTotal', 'L/min', { digits: 0 });
    b.E('live', 'tcs_flow_rack', 'Per rack', 'tcsFlowRackLpm', 'L/min', { digits: 0 });
    b.E('live', 'rack_kw', 'Rack IT', 'kwPerRack', 'kW', { digits: 0 });
    b.S('live', 'manifold_dp', 'Manifold ΔP', { value: 0.9, text: '0.9 bar design ΔP' }, 0.1, 'bar', { digits: 2 });
    b.E('capacity', 'racks_per_hall', 'Racks served', 'racksPerHall', '', { digits: 0 });
    b.E('capacity', 'rows', 'Rows', 'rackRows', '', { digits: 0 });
    var A2 = ctx.adapter, gFlow = finite(A2.tcsFlowTotal) && finite(A2.rackGroups) && A2.rackGroups > 0 ? A2.tcsFlowTotal / A2.rackGroups : null;
    b.D('capacity', 'group_flow_lpm', 'Flow per RPP group', gFlow == null ? '—' : fmt(gFlow, 0) + ' L/min', IDENT('design.flows.tcs_hall_lpm over geometry.rack_groups_per_hall'), gFlow);
    b.dep('upstream', 'cdu:1', 'Row CDUs'); b.dep('downstream', 'rack-manifold:1', 'Rack manifolds');
    b.trend('manifold_dp', 'Manifold ΔP', 'bar', { value: 0.9 }, 0.1, { digits: 2 });
    b.D('maint', 'filter', 'Branch filter', '25 µm per branch', SPEC('branch filtration rating'));
    b.tier2('eq', ['TCS Manifold']);
  });

  def('chem', { kind: 'authored', label: 'Chemical dosing', system: 'cooling', tier2: 'eq' }, function (b) {
    b.title = 'Water treatment — chemical dosing';
    b.S('live', 'ph', 'pH', { value: 8.5, text: '8.5 pH setpoint (window 8.2–8.8)' }, 0.2, '', { digits: 2 });
    b.S('live', 'conductivity', 'Conductivity', { value: 800, text: '800 µS/cm control setpoint' }, 60, 'µS/cm', { digits: 0 });
    b.S('live', 'orp', 'ORP', { value: 450, text: '450 mV biocide control' }, 30, 'mV', { digits: 0 });
    b.S('live', 'inhibitor_ppm', 'Inhibitor', { value: 120, text: '120 ppm inhibitor residual' }, 12, 'ppm', { digits: 0 });
    b.ST('live', 'dose_pump', 'Dosing pump', 'run', COOL_REASON);
    b.D('capacity', 'products', 'Products', 'NALCO 7330 biocide + 3DT177 inhibitor', SPEC('water-treatment chemistry'));
    b.D('capacity', 'dose_rate', 'Dose rate', '0.5 + 0.2 L/h', SPEC('dosing rate'));
    b.dep('downstream', 'fws-pump-station:dh01', 'HTW loop');
    b.trend('ph', 'pH', '', { value: 8.5 }, 0.2, { digits: 2 });
    b.S('maint', 'tank_level', 'Chemical tank level', { value: 65, text: '65 % fill' }, 10, '%', { digits: 0, min: 0, max: 100 });
    b.tier2('eq', ['Chemical Dosing']);
  });

  def('crah', { kind: 'engine', label: 'CRAH', system: 'cooling', tier2: 'crah' }, function (b, ctx, id) {
    var n = num(id), A = ctx.adapter;
    b.title = 'CRAH-' + String(id) + ' — DH-0' + b.hall;
    b.P('live', 'chw_supply_c', 'CHW in', 'p12_chw_supply_c'); b.P('live', 'chw_return_c', 'CHW out', 'p13_chw_return_c');
    b.P('live', 'air_supply_c', 'Supply air', 'p09_air_supply_c'); b.P('live', 'air_return_c', 'Return air', 'p11_air_return_c');
    b.E('live', 'duty_kwth', 'Unit duty', 'crahPerUnit', 'kWth', { digits: 0 });
    b.S('live', 'fan_pct', 'Fan speed', { value: 75, text: '75 % design speed' }, 8, '%', { digits: 0, min: 0, max: 100 });
    b.S('live', 'supply_rh', 'Supply RH', { value: 45, text: '45 % RH setpoint' }, 5, '%', { digits: 0, min: 0, max: 100 });
    var running = A.crahActive, st = finite(running) && n > running ? 'stby' : 'run';
    b.ST('live', 'unit_state', 'Unit', st, COOL_REASON); b.chip(st === 'run' ? 'RUN' : 'STANDBY', st === 'run' ? 'normal' : 'standby');
    b.E('capacity', 'unit_kwth', 'Unit rating', 'crahRating', 'kWth', { digits: 0 });
    b.E('capacity', 'duty_per_hall', 'Duty units per hall', 'crahActive', '', { digits: 0 });
    b.E('capacity', 'installed_per_hall', 'Installed per hall', 'crahInstalled', '', { digits: 0 });
    b.E('capacity', 'air_hall_kwth', 'Hall air heat', 'airHeat', 'kWth', { digits: 0 });
    var airPer = ctx.snapshot.design && ctx.snapshot.design.flows && finite(ctx.snapshot.design.flows.crah_air_m3s) && finite(A.crahInstalled) && finite(A.halls) && A.crahInstalled > 0 ? ctx.snapshot.design.flows.crah_air_m3s / (A.crahInstalled * A.halls) * 3600 : null;
    b.D('capacity', 'unit_air_m3h', 'Airflow per unit', airPer == null ? '—' : fmt(airPer, 0) + ' m³/h', IDENT('design.flows.crah_air_m3s over equipment.crah_installed_facility'), airPer);
    b.dep('upstream', 'chiller:1', 'Chiller plant (CHW)'); b.dep('downstream', 'room:dh0' + b.hall, 'Hall air path');
    b.trend('fan_pct', 'Fan speed', '%', { value: 75 }, 8, { digits: 0 });
    b.S('maint', 'filter_dp', 'Filter ΔP', { value: 120, text: '120 Pa clean filter' }, 25, 'Pa', { digits: 0, min: 0 });
    b.tier2('crah', [String(id)]);
  });

  def('fws-piping', { kind: 'engine', label: 'HTW piping', system: 'cooling', tier2: 'corr' }, function (b, ctx) {
    b.title = 'HTW piping — DH-0' + b.hall;
    b.E('live', 'htw_flow', 'Hall flow', 'htwFlowM3h', 'm³/h', { digits: 0 });
    b.P('live', 'htw_supply_c', 'Supply', 'p05_htw_supply_c'); b.P('live', 'htw_return_c', 'Return', 'p06_htw_return_c');
    b.S('live', 'pressure_bar', 'Header pressure', { value: 2.1, text: '2.1 bar header design' }, 0.2, 'bar', { digits: 2 });
    b.ST('live', 'isolation_valves', 'Isolation valves', 'open', COOL_REASON);
    b.D('capacity', 'pipe', 'Header', 'DN250 CS A106 Sch40, 50 mm PIR insulation', SPEC('piping material, size and insulation'));
    b.dep('upstream', 'fws-pump-station:dh0' + b.hall, 'HTW pump station'); b.dep('downstream', 'cdu:1', 'Row CDUs');
    b.trend('pressure_bar', 'Header pressure', 'bar', { value: 2.1 }, 0.2, { digits: 2 });
    b.tier2('corr', ['fws']);
  });

  def('leak', { kind: 'scenario', label: 'Leak detection', system: 'cooling', tier2: 'corr' }, function (b, ctx) {
    var cs = coolingScenario(ctx), wet = cs.leakWetZones;
    b.title = 'Leak detection — DH-0' + b.hall;
    var i;
    for (i = 1; i <= 24; i++) { b.ST('live', 'zone_' + i, 'Zone ' + pad2(i), wet.indexOf(i) >= 0 ? 'wet' : 'dry', COOL_REASON); }
    b.chip(wet.length ? 'LEAK' : 'DRY', wet.length ? 'fault' : 'normal');
    b.D('capacity', 'rope', 'Sensing rope', '800 m all piping runs', SPEC('leak-detection rope length'));
    b.D('capacity', 'points', 'Point sensors', '180 probes at QD connections', SPEC('point-sensor count'));
    b.S('maint', 'loop_kohm', 'Loop resistance', { value: 1.2, text: '1.2 kΩ healthy loop' }, 0.3, 'kΩ', { digits: 2, min: 0 });
    for (i = 0; i < wet.length; i++) { b.alarm({ tag: 'LEAK-Z' + pad2(wet[i]), point: 'ROPE', severity: 'critical', message: 'Rope wet in zone ' + wet[i] + ' — isolate branch, CDU auto-shutoff armed', system: 'cooling', currentState: 'wet', previousState: 'dry' }); }
    b.dep('upstream', 'fws-piping:dh0' + b.hall, 'HTW piping'); b.dep('downstream', 'cdu:1', 'Row CDUs (auto shut-off)');
    b.trend('loop_kohm', 'Loop resistance', 'kΩ', { value: 1.2 }, 0.3, { digits: 2 });
    b.tier2('corr', ['leak']);
  });

  def('cable-tray', { kind: 'authored', label: 'Cable tray', system: 'electrical', tier2: 'corr' }, function (b) {
    b.title = 'Overhead cable trays — DH-0' + b.hall;
    b.D('capacity', 'fill_power', 'Power tray fill', '65 % of NEC 392 limit', SPEC('design tray fill (page-authored, not simulated)'), 65);
    b.D('capacity', 'fill_fiber', 'Fibre tray fill', '40 %', SPEC('design tray fill'), 40);
    b.D('capacity', 'fill_cu', 'Copper tray fill', '52 %', SPEC('design tray fill'), 52);
    b.D('capacity', 'widths', 'Tray widths', 'power 300 mm · fibre 450 mm · copper 300 mm', SPEC('cable-tray widths'));
    b.S('live', 'tray_c', 'Tray temperature', { value: 32, text: '32 °C hot-aisle ceiling ambient' }, 3, '°C');
    b.ST('live', 'compliance', 'NEC 392 fill check', 'ok', 'compliance is the comparison of the declared design fills with the declared limit, not a measurement (Track A §A5)');
    b.trend('tray_c', 'Tray temperature', '°C', { value: 32 }, 3);
    b.tier2('corr', ['cable']);
  });

  /* rack sub-blocks */
  function rackCommon(b, ctx) {
    b.E('capacity', 'rack_kw', 'Rack IT', 'kwPerRack', 'kW', { digits: 0 });
    b.E('capacity', 'feed_a', 'Rack feed current', 'rackFeedA', 'A', { digits: 0 });
    b.E('capacity', 'gpu_per_rack', 'GPUs', 'gpuPerRack', '', { digits: 0 });
    var racks = ctx.scenario && ctx.scenario.racks, key = racks ? Object.keys(racks)[0] : null, r = key ? racks[key] : null;
    b.ST('live', 'feed_a_state', 'Feed A', r ? (r.feedA && r.feedA.available ? 'energized' : 'de-energized') : 'energized', SCEN_REASON);
    b.ST('live', 'feed_b_state', 'Feed B', r ? (r.feedB && r.feedB.available ? 'energized' : 'de-energized') : 'energized', SCEN_REASON);
    b.chip(r && r.redundancyState ? r.redundancyState : '2N', r && r.redundancyState === '2N' ? 'normal' : 'standby');
  }
  def('rack-psu', { kind: 'engine', label: 'Rack power shelves', system: 'electrical', tier2: 'rack' }, function (b, ctx) {
    b.title = 'Power shelves — GB300 NVL72 rack';
    b.E('live', 'shelf_kw', 'Shelf rating', 'shelfKw', 'kW', { digits: 0 });
    b.E('live', 'shelves_duty', 'Shelves in duty', 'shelvesDuty', '', { digits: 0 });
    b.E('live', 'shelves_spare', 'Spare shelves', 'shelvesSpare', '', { digits: 0 });
    b.E('live', 'installed_kw', 'Installed', 'shelfInstalledKw', 'kW', { digits: 0 });
    b.S('live', 'psu_out_w', 'Shelf output', { field: 'shelfKw' }, 1.5, 'kW', { digits: 1, offset: -6 });
    b.S('live', 'vdc', 'DC bus', { value: 48, text: '48 VDC published shelf output' }, 0.6, 'V', { digits: 1 });
    rackCommon(b, ctx);
    b.dep('upstream', 'sld-busway:dh0' + b.hall, 'Busway / RPP group'); b.dep('downstream', 'rack-busbar:1', '48 VDC bus bar');
    b.trend('vdc', 'DC bus', 'V', { value: 48 }, 0.6);
    b.S('maint', 'psu_c', 'PSU inlet temperature', { plane: 'p10_rack_inlet_c' }, 2, '°C');
    b.tier2('rack', ['psu']);
  });
  def('rack-ct', { kind: 'engine', label: 'Compute tray', system: 'compute', tier2: 'rack' }, function (b, ctx) {
    b.title = 'Compute trays — GB300 NVL72 rack';
    b.D('live', 'trays', 'Compute trays', String(ctx.adapter.computeTrays) + ' × 2U', 'compute trays per rack is the PUBLISHED GB300 NVL72 figure (model leaf gb300.computeTrays), a label not a derived quantity (Track A §A5)', ctx.adapter.computeTrays);
    b.E('live', 'gpu_per_rack', 'GPUs per rack', 'gpuPerRack', '', { digits: 0 });
    b.E('live', 'cpu_per_rack', 'Grace CPUs per rack', 'cpuPerRack', '', { digits: 0 });
    b.P('live', 'inlet_c', 'Cold-plate inlet (TCS supply)', 'p07_tcs_supply_c');
    b.S('live', 'gpu_c', 'GPU junction', { value: 62, text: '62 °C class at TCS 40 °C' }, 4, '°C');
    b.S('live', 'tray_w', 'Tray power', { field: 'kwPerRack' }, 0.3, 'kW', { digits: 2, offset: 0 });
    rackCommon(b, ctx);
    b.dep('upstream', 'rack-manifold:1', 'Rack manifold'); b.dep('downstream', 'rack-ns:1', 'NVSwitch trays');
    b.trend('gpu_c', 'GPU junction', '°C', { value: 62 }, 4);
    b.tier2('rack', ['ct']);
  });
  def('rack-ns', { kind: 'engine', label: 'NVSwitch tray', system: 'compute', tier2: 'rack' }, function (b, ctx) {
    b.title = 'NVSwitch trays — GB300 NVL72 rack';
    b.E('live', 'nvswitch_per_rack', 'NVSwitch chips per rack', 'nvswitchPerRack', '', { digits: 0 });
    b.E('live', 'domain_tbs', 'NVLink domain bandwidth', 'nvlinkDomainTBs', 'TB/s', { digits: 0 });
    b.S('live', 'util_pct', 'NVLink utilisation', { value: 80, text: '80 % training-load class' }, 8, '%', { digits: 0, min: 0, max: 100 });
    b.S('live', 'asic_c', 'ASIC temperature', { value: 58, text: '58 °C class' }, 3, '°C');
    rackCommon(b, ctx);
    b.dep('upstream', 'rack-ct:1', 'Compute trays'); b.dep('downstream', 'net-leaf:1', 'Leaf switches');
    b.trend('util_pct', 'NVLink utilisation', '%', { value: 80 }, 8, { digits: 0 });
    b.tier2('rack', ['ns']);
  });
  def('rack-manifold', { kind: 'engine', label: 'Rack manifold', system: 'cooling', tier2: 'rack' }, function (b, ctx) {
    b.title = 'Rack liquid manifold — GB300 NVL72 rack';
    b.P('live', 'tcs_supply_c', 'TCS supply', 'p07_tcs_supply_c'); b.P('live', 'tcs_return_c', 'TCS return', 'p08_tcs_return_c');
    b.E('live', 'flow_lpm', 'Rack flow', 'tcsFlowRackLpm', 'L/min', { digits: 0 });
    b.S('live', 'dp_bar', 'Manifold ΔP', { value: 0.6, text: '0.6 bar design ΔP' }, 0.08, 'bar', { digits: 2 });
    b.ST('live', 'qd_state', 'Quick disconnects', 'coupled', COOL_REASON);
    b.ST('live', 'fill_pump', 'Fill / degas pump', coolingScenario(ctx).leakWetZones.length ? 'stby' : 'run', COOL_REASON);
    rackCommon(b, ctx);
    b.dep('upstream', 'tcs-manifold:dh0' + b.hall, 'TCS manifold'); b.dep('downstream', 'rack-ct:1', 'Compute trays');
    b.trend('dp_bar', 'Manifold ΔP', 'bar', { value: 0.6 }, 0.08, { digits: 2 });
    b.tier2('rack', ['manifold']);
  });
  def('rack-busbar', { kind: 'engine', label: '48 VDC bus bar', system: 'electrical', tier2: 'rack' }, function (b, ctx) {
    b.title = '48 VDC bus bar — GB300 NVL72 rack';
    b.S('live', 'vdc', 'Bus voltage', { value: 48, text: '48 VDC published shelf output' }, 0.6, 'V', { digits: 1 });
    b.S('live', 'amps', 'Bus current', { field: 'kwPerRack' }, 60, 'A', { digits: 0, offset: 2958 - 142 });
    rackCommon(b, ctx);
    b.dep('upstream', 'rack-psu:1', 'Power shelves'); b.dep('downstream', 'rack-ct:1', 'Compute trays');
    b.trend('vdc', 'Bus voltage', 'V', { value: 48 }, 0.6);
    b.tier2('rack', ['busbar']);
  });
  def('rack-leak', { kind: 'scenario', label: 'Rack leak sensor', system: 'cooling', tier2: 'rack' }, function (b, ctx) {
    var cs = coolingScenario(ctx);
    b.title = 'Rack leak sensing — GB300 NVL72 rack';
    b.ST('live', 'rope', 'Rack rope', cs.leakWetZones.length ? 'wet' : 'dry', COOL_REASON);
    b.ST('live', 'qd_probe', 'QD point probe', 'dry', COOL_REASON);
    rackCommon(b, ctx);
    b.dep('upstream', 'leak:dh0' + b.hall, 'Hall leak controller');
    b.S('maint', 'loop_kohm', 'Loop resistance', { value: 1.2, text: '1.2 kΩ healthy loop' }, 0.3, 'kΩ', { digits: 2, min: 0 });
    b.trend('loop_kohm', 'Loop resistance', 'kΩ', { value: 1.2 }, 0.3, { digits: 2 });
    b.tier2('rack', ['leak']);
  });
  def('rack-backplane', { kind: 'engine', label: 'NVLink backplane', system: 'compute', tier2: 'rack' }, function (b, ctx) {
    b.title = 'NVLink cable backplane — GB300 NVL72 rack';
    b.E('live', 'domain_tbs', 'Domain bandwidth', 'nvlinkDomainTBs', 'TB/s', { digits: 0 });
    b.D('live', 'cables', 'Cable cartridge', '~5,000 passive copper cables per rack', 'cable count is the PUBLISHED NVIDIA GB300 NVL72 cartridge figure used as a label (Track A §A5)');
    b.S('live', 'ber', 'Lane errors (post-FEC)', { value: 0, text: '0 errors/h healthy backplane' }, 0.4, '/h', { digits: 0, min: 0 });
    rackCommon(b, ctx);
    b.dep('upstream', 'rack-ns:1', 'NVSwitch trays'); b.dep('downstream', 'rack-ct:1', 'Compute trays');
    b.trend('ber', 'Lane errors', '/h', { value: 0 }, 0.4, { digits: 0 });
    b.tier2('rack', ['backplane']);
  });

  /* electrical SLD blocks (per hall, feed A/B where relevant) */
  function feedOf(id) { return String(id).toUpperCase().indexOf('B') >= 0 ? 'B' : 'A'; }
  def('sld-mv-sub', { kind: 'engine', label: 'MV substation', system: 'electrical', tier2: 'mimic' }, function (b, ctx) {
    b.title = 'MV customer substation — DH-0' + b.hall;
    var sa = electricalState(ctx, 'SRC-UTILITY-A', 'online'), sb = electricalState(ctx, 'SRC-UTILITY-B', 'online'), sg = electricalState(ctx, 'SRC-GENSET-POOL', 'standby');
    b.ST('live', 'utility_a', 'Utility A', sa, SCEN_REASON); b.ST('live', 'utility_b', 'Utility B', sb, SCEN_REASON); b.ST('live', 'genset_pool', 'Generator pool', sg, SCEN_REASON);
    b.D('live', 'mv_kv', 'MV bus', '20 kV', SPEC('MV distribution voltage (20 kV)'), 20);
    b.S('live', 'bus_kv', 'Bus voltage', { value: 20, text: '20 kV MV distribution' }, 0.2, 'kV', { digits: 2 });
    b.S('live', 'frequency', 'Frequency', { value: 50, text: '50 Hz grid' }, 0.05, 'Hz', { digits: 2 });
    b.E('capacity', 'facility_kva', 'Facility apparent power', 'facilityKva', 'kVA', { digits: 0 });
    b.E('capacity', 'gensets_installed', 'Gensets installed', 'gensetFacNplus1', '', { digits: 0 });
    b.E('capacity', 'genset_kw', 'Genset unit rating', 'gensetKW', 'kW', { digits: 0 });
    b.D('capacity', 'gear', 'Switchgear', 'SM6 24 kV · 630 A / 25 kA', SPEC('MV switchgear ratings'));
    b.chip(sa === 'online' && sb === 'online' ? 'NORMAL' : 'DEGRADED', sa === 'online' && sb === 'online' ? 'normal' : 'standby');
    if (sa !== 'online') { b.alarm({ tag: 'MV-SUB', point: 'UTILITY-A', severity: 'critical', message: 'Utility A unavailable — ' + (sg === 'running' ? 'generator pool running' : 'generator pool ' + sg), system: 'electrical', currentState: sa }); }
    if (sb !== 'online') { b.alarm({ tag: 'MV-SUB', point: 'UTILITY-B', severity: 'critical', message: 'Utility B unavailable', system: 'electrical', currentState: sb }); }
    b.dep('upstream', 'sld-mv-sub:grid', 'PLN 150 kV grid'); b.dep('downstream', 'sld-rmu:dh0' + b.hall, 'RMU-' + b.hall);
    b.trend('bus_kv', 'Bus voltage', 'kV', { value: 20 }, 0.2, { digits: 2 });
    b.S('maint', 'sf6_bar', 'SF6 pressure', { value: 1.5, text: '1.5 bar rated fill' }, 0.05, 'bar', { digits: 2 });
    b.tier2('mimic', ['mv-sub', b.hall]);
  });
  def('sld-rmu', { kind: 'engine', label: 'Ring main unit', system: 'electrical', tier2: 'mimic' }, function (b, ctx) {
    b.title = 'RMU-' + b.hall + ' — DH-0' + b.hall;
    var ea = feedEdgeState(ctx, 'A', 'RMU'), eb = feedEdgeState(ctx, 'B', 'RMU');
    b.ST('live', 'feed_a', 'Feed A', ea, SCEN_REASON); b.ST('live', 'feed_b', 'Feed B', eb, SCEN_REASON); b.ST('live', 'tie', 'Bus tie', 'open', SCEN_REASON);
    b.E('live', 'group_kw', 'RPP group load', 'groupKw', 'kW', { digits: 0 });
    b.S('live', 'bus_kv', 'Bus voltage', { value: 20, text: '20 kV MV distribution' }, 0.2, 'kV', { digits: 2 });
    b.D('capacity', 'gear', 'Panel', 'RM6 24 kV, 3-panel, 630 A / 25 kA', SPEC('ring-main-unit ratings'));
    b.chip(ea === 'energized' && eb === 'energized' ? 'NORMAL' : 'DEGRADED', ea === 'energized' && eb === 'energized' ? 'normal' : 'standby');
    b.dep('upstream', 'sld-mv-sub:dh0' + b.hall, 'MV substation'); b.dep('downstream', 'sld-tx:dh0' + b.hall, 'TX-' + b.hall + 'A/B');
    b.trend('bus_kv', 'Bus voltage', 'kV', { value: 20 }, 0.2, { digits: 2 });
    b.S('maint', 'sf6_bar', 'SF6 pressure', { value: 1.5, text: '1.5 bar rated fill' }, 0.05, 'bar', { digits: 2 });
    b.tier2('mimic', ['rmu', b.hall]);
  });
  def('sld-tx', { kind: 'engine', label: 'Transformers', system: 'electrical', tier2: 'mimic' }, function (b, ctx) {
    b.title = 'TX-' + b.hall + 'A/B — DH-0' + b.hall;
    var ea = feedEdgeState(ctx, 'A', 'TX'), eb = feedEdgeState(ctx, 'B', 'TX');
    b.ST('live', 'tx_a', 'TX-' + b.hall + 'A', ea, SCEN_REASON); b.ST('live', 'tx_b', 'TX-' + b.hall + 'B', eb, SCEN_REASON);
    b.E('live', 'loading_pct', 'Loading', 'txLoadPct', '%', { digits: 1 });
    b.E('live', 'voltage_ll', 'Secondary voltage', 'voltageLL', 'V', { digits: 0 });
    b.S('live', 'winding_c', 'Winding temperature', { value: 95, text: '95 °C class F at design load' }, 6, '°C');
    b.S('live', 'secondary_v', 'Secondary measured', { field: 'voltageLL' }, 3, 'V', { digits: 0 });
    b.E('capacity', 'unit_mva', 'Unit rating', 'txRatingMVA', 'MVA', { digits: 1 });
    b.E('capacity', 'per_feed', 'Units per feed per hall', 'txPerFeedHall', '', { digits: 0 });
    b.E('capacity', 'total', 'Campus total', 'txTotal', '', { digits: 0 });
    b.D('capacity', 'ratio', 'Ratio / impedance', '20/0.4 kV · Zk 6 % · Dyn11', SPEC('transformer ratio and impedance'));
    b.chip(ea === 'energized' && eb === 'energized' ? 'NORMAL' : 'DEGRADED', ea === 'energized' && eb === 'energized' ? 'normal' : ea === 'fault' || eb === 'fault' ? 'fault' : 'standby');
    if (ea === 'fault') { b.alarm({ tag: 'TX-' + b.hall + 'A', point: 'PROT', severity: 'critical', message: 'Transformer A protection trip', system: 'electrical', currentState: 'fault' }); }
    if (eb === 'fault') { b.alarm({ tag: 'TX-' + b.hall + 'B', point: 'PROT', severity: 'critical', message: 'Transformer B protection trip', system: 'electrical', currentState: 'fault' }); }
    b.dep('upstream', 'sld-rmu:dh0' + b.hall, 'RMU-' + b.hall); b.dep('downstream', 'sld-msb:dh0' + b.hall, 'MSB-' + b.hall + 'A/B');
    b.trend('winding_c', 'Winding temperature', '°C', { value: 95 }, 6);
    b.S('maint', 'tap', 'Tap position', { value: 0, text: 'tap 0 (±2.5 % × 2 OCTC)' }, 0.4, '', { digits: 0 });
    b.tier2('mimic', ['tx', b.hall]);
  });
  def('sld-msb', { kind: 'engine', label: 'Main switchboard', system: 'electrical', tier2: 'mimic' }, function (b, ctx) {
    b.title = 'MSB-' + b.hall + 'A/B — DH-0' + b.hall;
    var ea = feedEdgeState(ctx, 'A', 'MSB'), eb = feedEdgeState(ctx, 'B', 'MSB');
    var ata = electricalState(ctx, 'ATS-A', 'normal'), atb = electricalState(ctx, 'ATS-B', 'normal');
    b.ST('live', 'msb_a', 'MSB-' + b.hall + 'A', ea, SCEN_REASON); b.ST('live', 'msb_b', 'MSB-' + b.hall + 'B', eb, SCEN_REASON);
    b.ST('live', 'ats_a', 'ATS A', ata, SCEN_REASON); b.ST('live', 'ats_b', 'ATS B', atb, SCEN_REASON);
    b.E('live', 'it_hall_kw', 'Hall IT load', 'itHall', 'kW', { digits: 0 });
    b.E('live', 'voltage_ll', 'Bus voltage', 'voltageLL', 'V', { digits: 0 });
    b.E('live', 'power_factor', 'Power factor', 'powerFactor', '', { digits: 2 });
    b.E('live', 'group_current', 'RPP group current', 'reqCurrentA', 'A', { digits: 0 });
    b.S('live', 'v_l1', 'L1 voltage', { field: 'voltageLL' }, 3, 'V', { digits: 0 });
    b.S('live', 'i_l1', 'L1 current', { field: 'reqCurrentA' }, 40, 'A', { digits: 0 });
    b.E('capacity', 'busway_a', 'Busway trunk', 'buswayA', 'A', { digits: 0 });
    b.D('capacity', 'form', 'Board', 'Form 4b, LV tie normally open', SPEC('switchboard form and tie configuration'));
    b.chip(ea === 'energized' && eb === 'energized' ? 'NORMAL' : 'DEGRADED', ea === 'energized' && eb === 'energized' ? 'normal' : 'standby');
    b.dep('upstream', 'sld-tx:dh0' + b.hall, 'Transformers'); b.dep('downstream', 'sld-ups-a:dh0' + b.hall, 'UPS-' + b.hall + 'A');
    b.trend('v_l1', 'L1 voltage', 'V', { field: 'voltageLL' }, 3, { digits: 0 });
    b.S('maint', 'thd_pct', 'Voltage THD', { value: 1.8, text: '1.8 % THDv class' }, 0.3, '%', { digits: 2, min: 0 });
    b.tier2('mimic', ['msb', b.hall]);
  });
  function upsClass(feed) {
    return function (b, ctx) {
      var key = 'UPS-' + feed, st = electricalState(ctx, key, 'online');
      b.title = 'UPS-' + b.hall + feed + ' — DH-0' + b.hall;
      var mode = st === 'online' ? 'online' : st === 'bypass' ? 'bypass' : st === 'maintenance' ? 'maintenance' : 'fault';
      b.ST('live', 'mode', 'Mode', mode, SCEN_REASON);
      b.E('live', 'load_pct', 'Loading (failover)', 'upsLoadPct', '%', { digits: 1 });
      b.E('live', 'load_normal_pct', 'Loading (normal, 2N share)', 'upsLoadNormalPct', '%', { digits: 1 });
      b.E('live', 'it_hall_kw', 'Protected load', 'itHall', 'kW', { digits: 0 });
      b.S('live', 'in_v', 'Input voltage', { field: 'voltageLL' }, 3, 'V', { digits: 0 });
      b.S('live', 'out_v', 'Output voltage', { field: 'voltageLL' }, 1, 'V', { digits: 0 });
      b.S('live', 'dc_bus_v', 'DC bus', { value: 480, text: '480 VDC battery bus class' }, 4, 'V', { digits: 0 });
      b.S('live', 'eff_pct', 'Efficiency', { value: 96.3, text: '96.3 % double-conversion class' }, 0.2, '%', { digits: 2 });
      b.E('capacity', 'frame_kw', 'Frame rating', 'upsRatingKW', 'kW', { digits: 0 });
      b.E('capacity', 'frames_per_feed', 'Frames per feed per hall', 'upsFramesPerFeedHall', '', { digits: 0 });
      b.E('capacity', 'battery_kwh', 'Battery energy per hall', 'batteryPerHall', 'kWh', { digits: 0 });
      b.chip(mode.toUpperCase(), mode === 'online' ? 'normal' : mode === 'bypass' ? 'standby' : 'fault');
      if (mode !== 'online') { b.alarm({ tag: key, point: 'MODE', severity: mode === 'bypass' ? 'high' : 'critical', message: 'UPS ' + feed + ' on ' + mode, system: 'electrical', currentState: mode, previousState: 'online' }); }
      b.dep('upstream', 'sld-msb:dh0' + b.hall, 'MSB-' + b.hall + feed); b.dep('downstream', 'sld-busway:dh0' + b.hall, 'Busway ' + feed);
      b.related.push('battery-' + feed.toLowerCase() + ':dh0' + b.hall);
      b.trend('out_v', 'Output voltage', 'V', { field: 'voltageLL' }, 1, { digits: 0 });
      b.S('maint', 'fan_hours', 'Fan run hours', { value: 12000, text: '12,000 h class' }, 300, 'h', { digits: 0, period: 400 });
      b.tier2('mimic', ['ups-' + feed.toLowerCase(), b.hall]);
    };
  }
  def('sld-ups-a', { kind: 'engine', label: 'UPS A', system: 'electrical', tier2: 'mimic' }, upsClass('A'));
  def('sld-ups-b', { kind: 'engine', label: 'UPS B', system: 'electrical', tier2: 'mimic' }, upsClass('B'));
  function batteryClass(feed) {
    return function (b, ctx) {
      var st = electricalState(ctx, 'UPS-' + feed, 'online'), mode = st === 'online' ? 'float' : st === 'bypass' ? 'float' : 'discharge';
      b.title = 'BAT-' + b.hall + feed + ' — DH-0' + b.hall;
      b.ST('live', 'mode', 'Battery mode', mode, SCEN_REASON);
      b.E('live', 'energy_kwh', 'Energy per hall', 'batteryPerHall', 'kWh', { digits: 0 });
      b.S('live', 'soc_pct', 'State of charge', { value: 98, text: '98 % float' }, 1.5, '%', { digits: 0, max: 100 });
      b.S('live', 'dc_v', 'String voltage', { value: 480, text: '480 VDC class' }, 4, 'V', { digits: 0 });
      b.S('live', 'cell_c', 'Cell temperature', { value: 27, text: '27 °C battery room' }, 1.5, '°C');
      b.E('capacity', 'frame_kw', 'Supported frame', 'upsRatingKW', 'kW', { digits: 0 });
      b.D('capacity', 'autonomy', 'Autonomy', '10 min at rated load', SPEC('battery autonomy'));
      b.chip(mode.toUpperCase(), mode === 'float' ? 'normal' : 'fault');
      b.dep('upstream', 'sld-ups-' + feed.toLowerCase() + ':dh0' + b.hall, 'UPS-' + b.hall + feed);
      b.trend('soc_pct', 'State of charge', '%', { value: 98 }, 1.5, { digits: 0 });
      b.S('maint', 'cycles', 'Cycles', { value: 120, text: '120 cycles class' }, 4, '', { digits: 0, period: 400 });
      b.tier2('bat', [feed, b.hall]);
    };
  }
  def('battery-a', { kind: 'engine', label: 'Battery A', system: 'electrical', tier2: 'bat' }, batteryClass('A'));
  def('battery-b', { kind: 'engine', label: 'Battery B', system: 'electrical', tier2: 'bat' }, batteryClass('B'));
  def('sld-busway', { kind: 'engine', label: 'Busway + RPP groups', system: 'electrical', tier2: 'mimic' }, function (b, ctx) {
    b.title = 'BW-' + b.hall + 'A/B — DH-0' + b.hall;
    var ba = electricalState(ctx, 'BUSWAY-A', 'normal'), bb = electricalState(ctx, 'BUSWAY-B', 'normal');
    var ea = feedEdgeState(ctx, 'A', 'BUSWAY'), eb = feedEdgeState(ctx, 'B', 'BUSWAY');
    b.ST('live', 'bw_a', 'Busway A', ea, SCEN_REASON); b.ST('live', 'bw_b', 'Busway B', eb, SCEN_REASON);
    b.E('live', 'trunk_a', 'Trunk rating', 'buswayA', 'A', { digits: 0 });
    b.E('live', 'loading_pct', 'Trunk loading', 'buswayLoadPct', '%', { digits: 0 });
    b.E('live', 'group_current', 'Group current', 'reqCurrentA', 'A', { digits: 0 });
    b.S('live', 'i_a', 'Feed A current', { field: 'reqCurrentA' }, 40, 'A', { digits: 0 });
    b.S('live', 'temp_c', 'Busduct temperature', { value: 55, text: '55 °C class at rated load' }, 4, '°C');
    b.E('capacity', 'groups', 'RPP groups per feed', 'rackGroups', '', { digits: 0 });
    b.E('capacity', 'racks_per_group', 'Racks per group', 'racksPerGroup', '', { digits: 0 });
    b.E('capacity', 'group_kw', 'Group load', 'groupKw', 'kW', { digits: 0 });
    b.E('capacity', 'rpp_per_hall', 'RPP per hall', 'rppPerHall', '', { digits: 0 });
    b.chip(ea === 'energized' && eb === 'energized' ? 'NORMAL' : 'DEGRADED', ea === 'energized' && eb === 'energized' ? 'normal' : ea === 'fault' || eb === 'fault' ? 'fault' : 'standby');
    if (ea === 'fault' || ba === 'tripped') { b.alarm({ tag: 'BW-' + b.hall + 'A', point: 'FEEDER', severity: 'critical', message: 'Busway A feeder trip — racks on feed B only', system: 'electrical', currentState: 'fault' }); }
    b.dep('upstream', 'sld-ups-a:dh0' + b.hall, 'UPS-' + b.hall + 'A/B'); b.dep('downstream', 'rack-psu:1', 'Rack power shelves');
    b.trend('i_a', 'Feed A current', 'A', { field: 'reqCurrentA' }, 40, { digits: 0 });
    b.S('maint', 'joint_c', 'Joint IR scan (max)', { value: 48, text: '48 °C class' }, 3, '°C');
    b.tier2('mimic', ['busway', b.hall]);
  });
  def('sld-rack-psu', { kind: 'engine', label: 'Rack power', system: 'electrical', tier2: 'mimic' }, function (b, ctx) {
    b.title = 'Rack power — DH-0' + b.hall;
    b.E('live', 'racks', 'Racks', 'racksPerHall', '', { digits: 0 });
    b.E('live', 'rack_kw', 'Rack IT', 'kwPerRack', 'kW', { digits: 0 });
    b.E('live', 'feed_a', 'Rack feed current', 'rackFeedA', 'A', { digits: 0 });
    b.E('live', 'rack_it_hall', 'Rack IT per hall', 'rackItHallKw', 'kW', { digits: 0 });
    b.S('live', 'psu_c', 'PSU inlet', { plane: 'p10_rack_inlet_c' }, 2, '°C');
    rackCommon(b, ctx);
    b.dep('upstream', 'sld-busway:dh0' + b.hall, 'Busway / RPP'); b.dep('downstream', 'rack-psu:1', 'Power shelves');
    b.trend('psu_c', 'PSU inlet', '°C', { plane: 'p10_rack_inlet_c' }, 2);
    b.tier2('mimic', ['rack-psu', b.hall]);
  });
  def('sld-cooling', { kind: 'engine', label: 'Cooling loads', system: 'electrical', tier2: 'mimic' }, function (b, ctx) {
    b.title = 'Cooling electrical loads — DH-0' + b.hall;
    b.E('live', 'cooling_kwe', 'Cooling kWe per hall', 'pb_cooling', 'kWe', { digits: 0 });
    b.E('live', 'chiller_kwe', 'Chillers', 'pb_chiller', 'kWe', { digits: 0 });
    b.E('live', 'pumps_kwe', 'Pumps', 'pb_pumps', 'kWe', { digits: 0 });
    b.E('live', 'fans_kwe', 'Fans', 'pb_fans', 'kWe', { digits: 0 });
    b.E('live', 'aux_kwe', 'Auxiliary', 'pb_aux', 'kWe', { digits: 0 });
    b.E('capacity', 'cdu_installed', 'CDUs per hall', 'cduInstalled', '', { digits: 0 });
    b.E('capacity', 'crah_installed', 'CRAHs per hall', 'crahInstalled', '', { digits: 0 });
    b.ST('live', 'feed', 'ATS-backed feed', 'energized', SCEN_REASON);
    b.dep('upstream', 'sld-msb:dh0' + b.hall, 'MSB (ATS-backed section)'); b.dep('downstream', 'cdu:1', 'CDU pumps (UPS-fed)');
    b.trend('cooling_kwe', 'Cooling kWe', 'kWe', { field: 'pb_cooling' }, 0, { digits: 0 });
    b.tier2('mimic', ['cooling', b.hall]);
  });

  /* facility services */
  def('stp', { kind: 'authored', label: 'STP', system: 'civil', tier2: 'stp' }, function (b, ctx) {
    var cs = coolingScenario(ctx);
    b.title = 'Sewage treatment plant';
    b.S('live', 'inlet_m3h', 'Inlet flow', { value: 6, text: '6 m³/h design inflow' }, 1, 'm³/h', { digits: 1, min: 0 });
    b.S('live', 'ph', 'Inlet pH', { value: 7.2, text: '7.2 pH domestic effluent' }, 0.3, '', { digits: 2 });
    b.S('live', 'do_mgl', 'Aeration DO', { value: 2.5, text: '2.5 mg/L aeration setpoint' }, 0.4, 'mg/L', { digits: 2, min: 0 });
    b.ST('live', 'blower_1', 'Blower 1', cs.stpBlowerDuty === 1 ? 'run' : 'stby', COOL_REASON); b.ST('live', 'blower_2', 'Blower 2', cs.stpBlowerDuty === 2 ? 'run' : 'stby', COOL_REASON);
    b.D('capacity', 'capacity', 'Design capacity', '50 m³/day SBR', SPEC('STP sizing'));
    b.trend('do_mgl', 'Aeration DO', 'mg/L', { value: 2.5 }, 0.4, { digits: 2 });
    b.S('maint', 'uv_pct', 'UV intensity', { value: 85, text: '85 % lamp output' }, 5, '%', { digits: 0, max: 100 });
    b.tier2('stp', []);
  });
  def('ahu', { kind: 'authored', label: 'AHU', system: 'hvac', tier2: 'ahu' }, function (b, ctx) {
    b.title = 'MMR air-handling unit';
    b.S('live', 'supply_c', 'Supply air', { value: 18, text: '18 °C MMR supply setpoint' }, 1, '°C');
    b.S('live', 'return_c', 'Return air', { value: 25, text: '25 °C MMR return' }, 1, '°C');
    b.S('live', 'fan_pct', 'Fan speed', { value: 70, text: '70 % design speed' }, 8, '%', { digits: 0, min: 0, max: 100 });
    b.S('live', 'valve_pct', 'CHW valve', { value: 55, text: '55 % design opening' }, 10, '%', { digits: 0, min: 0, max: 100 });
    b.ST('live', 'unit_state', 'Unit', 'run', COOL_REASON);
    b.D('capacity', 'capacity', 'Capacity', '2 × 150 kW (Carrier 39HQ class)', SPEC('AHU sizing'));
    b.dep('upstream', 'chiller:1', 'CHW plant');
    b.trend('supply_c', 'Supply air', '°C', { value: 18 }, 1);
    b.S('maint', 'filter_dp', 'Filter ΔP', { value: 110, text: '110 Pa clean filter' }, 25, 'Pa', { digits: 0, min: 0 });
    b.tier2('ahu', []);
  });
  def('room', { kind: 'authored', label: 'Room', system: 'building', tier2: null }, function (b, ctx, id) {
    b.title = 'Room — ' + id;
    b.D('live', 'grid', 'Building grid', 'retired-basis site layout (72 × 48 m plot)', 'building grid and room dimensions are the retired-basis site layout kept until the site re-grid (Track A §A5)');
    b.S('live', 'temp_c', 'Room temperature', { value: 24, text: '24 °C support-room setpoint' }, 1, '°C');
    b.S('live', 'rh_pct', 'Relative humidity', { value: 50, text: '50 % RH setpoint' }, 6, '%', { digits: 0 });
    b.trend('temp_c', 'Room temperature', '°C', { value: 24 }, 1);
  });
  def('roof-dry-cooler-bank', { kind: 'engine', label: 'Roof dry-cooler bank', system: 'cooling', tier2: 'dryCooler' }, CLASSES['dry-cooler'].build);

  /* network */
  function netCommon(b, ctx) {
    b.E('capacity', 'leaves', 'Leaf switches per hall', 'leavesPerHall', '', { digits: 0 });
    b.E('capacity', 'switches', 'Switches per hall', 'switchesPerHall', '', { digits: 0 });
    b.E('capacity', 'fabric_pbs', 'Fabric bandwidth (facility)', 'fabricPbs', 'Pb/s', { digits: 1 });
  }
  def('net-spine', { kind: 'engine', label: 'Spine switch', system: 'network', tier2: null }, function (b, ctx, id) {
    b.title = 'Spine ' + id + ' — Quantum-X800 class';
    b.S('live', 'util_pct', 'Uplink utilisation', { value: 72, text: '72 % training-load class' }, 10, '%', { digits: 0, min: 0, max: 100 });
    b.S('live', 'link_gbps', 'Busiest port', { value: 780, text: '780 Gb/s on an 800G port' }, 15, 'Gb/s', { digits: 0, max: 800 });
    b.ST('live', 'links', 'Links', 'up', 'link state is declared all-up for the training fabric until the network redesign adds a fault table (Track A §A7)');
    b.D('capacity', 'radix', 'Radix', '64 × 800G ports', 'switch radix is the PUBLISHED Quantum-X800 Q3400 figure used as a label (Track A §A5)');
    netCommon(b, ctx);
    b.dep('downstream', 'net-leaf:1', 'Leaf switches');
    b.trend('util_pct', 'Uplink utilisation', '%', { value: 72 }, 10, { digits: 0 });
    b.S('maint', 'optic_c', 'Optics temperature', { value: 52, text: '52 °C OSFP class' }, 3, '°C');
  });
  def('net-leaf', { kind: 'engine', label: 'Leaf switch', system: 'network', tier2: null }, function (b, ctx, id) {
    b.title = 'Leaf ' + id + ' — rail-aligned';
    b.S('live', 'util_pct', 'Downlink utilisation', { value: 68, text: '68 % training-load class' }, 10, '%', { digits: 0, min: 0, max: 100 });
    b.ST('live', 'links', 'Links', 'up', 'link state is declared all-up for the training fabric until the network redesign adds a fault table (Track A §A7)');
    netCommon(b, ctx);
    b.dep('upstream', 'net-spine:1', 'Spines'); b.dep('downstream', 'rack-ns:1', 'Rack NIC rail');
    b.trend('util_pct', 'Downlink utilisation', '%', { value: 68 }, 10, { digits: 0 });
    b.S('maint', 'optic_c', 'Optics temperature', { value: 50, text: '50 °C OSFP class' }, 3, '°C');
  });
  def('net-domain', { kind: 'engine', label: 'NVLink domain', system: 'network', tier2: null }, function (b, ctx, id) {
    b.title = 'NVLink domain (rack) ' + id;
    b.E('live', 'domain_tbs', 'Domain bandwidth', 'nvlinkDomainTBs', 'TB/s', { digits: 0 });
    b.E('live', 'gpu_per_rack', 'GPUs', 'gpuPerRack', '', { digits: 0 });
    b.S('live', 'util_pct', 'NVLink utilisation', { value: 82, text: '82 % all-reduce class' }, 8, '%', { digits: 0, min: 0, max: 100 });
    b.ST('live', 'links', 'Lanes', 'up', 'lane state is declared all-up until the network redesign adds a fault table (Track A §A7)');
    netCommon(b, ctx);
    b.dep('upstream', 'net-leaf:1', 'Leaf rail'); b.dep('downstream', 'rack-ns:1', 'NVSwitch trays');
    b.trend('util_pct', 'NVLink utilisation', '%', { value: 82 }, 8, { digits: 0 });
  });
  def('net-oob', { kind: 'authored', label: 'OOB management', system: 'network', tier2: null }, function (b, ctx) {
    b.title = 'Out-of-band management';
    b.D('live', 'tor', 'ToR uplink', '25 GbE per rack pair', SPEC('OOB link speed'));
    b.D('live', 'bmc', 'BMC', '1 GbE per tray, Redfish', SPEC('BMC link'));
    b.S('live', 'cpu_pct', 'Controller CPU', { value: 22, text: '22 % idle-class management load' }, 6, '%', { digits: 0, min: 0, max: 100 });
    b.ST('live', 'reach', 'Reachability', 'up', 'declared all-reachable in the simulation (Track A §A7 network redesign pending)');
    netCommon(b, ctx);
    b.trend('cpu_pct', 'Controller CPU', '%', { value: 22 }, 6, { digits: 0 });
  });

  /* fire */
  function fireState(ctx, zone) {
    var f = ctx.fire; if (!f) { return 'normal'; }
    if (f.zoneId && (zone == null || String(f.zoneId) === String(zone))) { return f.stage || 'alarm'; }
    return 'normal';
  }
  var FIRE_REASON = 'state from the fire cause-and-effect engine (RZDatahallAIFireCauseEffect) for the selected event; normal when no event is set (Track A §A6)';
  var FIRE_SPEC = 'fire-protection design selections are page-authored to NFPA 72 / NFPA 2001 — the engine publishes no fire quantity (Track A §A6)';
  def('fire-facp', { kind: 'scenario', label: 'FACP', system: 'fire', tier2: null }, function (b, ctx) {
    b.title = 'Fire alarm control panel';
    b.ST('live', 'panel', 'Panel', fireState(ctx, null), FIRE_REASON);
    b.D('capacity', 'model', 'Panel', 'NFS2-3030 class, 640 points, 12 SLC loops', FIRE_SPEC);
    b.S('live', 'batt_v', 'Standby battery', { value: 26.8, text: '26.8 V float' }, 0.2, 'V', { digits: 1 });
    b.dep('downstream', 'fire-zone:1', 'Detection zones');
    b.trend('batt_v', 'Standby battery', 'V', { value: 26.8 }, 0.2);
  });
  def('fire-vesda', { kind: 'scenario', label: 'VESDA', system: 'fire', tier2: null }, function (b, ctx, id) {
    b.title = 'Aspirating detector VD-' + id;
    b.S('live', 'obscuration', 'Obscuration', { value: 0.001, text: '0.001 %/m clean-air baseline' }, 0.0008, '%/m', { digits: 4, min: 0 });
    b.ST('live', 'stage', 'Stage', fireState(ctx, null), FIRE_REASON);
    b.D('capacity', 'sampling', 'Sampling', '~100 sample points per unit', FIRE_SPEC);
    b.dep('upstream', 'fire-facp:1', 'FACP');
    b.trend('obscuration', 'Obscuration', '%/m', { value: 0.001 }, 0.0008, { digits: 4 });
  });
  def('fire-zone', { kind: 'scenario', label: 'Fire zone', system: 'fire', tier2: null }, function (b, ctx, id) {
    b.title = 'Fire zone ' + id;
    b.ST('live', 'state', 'Zone', fireState(ctx, id), FIRE_REASON);
    b.D('capacity', 'detection', 'Detection', 'photo + heat + aspirating, double-interlock release', FIRE_SPEC);
    b.dep('upstream', 'fire-facp:1', 'FACP'); b.dep('downstream', 'fire-cylinder-bank:1', 'Agent cylinders');
    b.S('live', 'temp_c', 'Zone ceiling temperature', { plane: 'p11_air_return_c' }, 1, '°C');
    b.trend('temp_c', 'Ceiling temperature', '°C', { plane: 'p11_air_return_c' }, 1);
  });
  def('fire-cylinder-bank', { kind: 'scenario', label: 'Agent cylinders', system: 'fire', tier2: null }, function (b, ctx) {
    b.title = 'Novec 1230 cylinder bank';
    b.S('live', 'pressure_bar', 'Cylinder pressure', { value: 42, text: '42 bar charged' }, 0.5, 'bar', { digits: 1 });
    b.ST('live', 'release', 'Release', 'armed', FIRE_REASON);
    b.D('capacity', 'agent', 'Agent', '4 × 180 L, 5.3 % design concentration', FIRE_SPEC);
    b.dep('upstream', 'fire-zone:1', 'Zones');
    b.trend('pressure_bar', 'Cylinder pressure', 'bar', { value: 42 }, 0.5);
  });
  def('fire-mcp', { kind: 'scenario', label: 'Manual call point', system: 'fire', tier2: null }, function (b, ctx, id) {
    b.title = 'Manual call point ' + id;
    b.ST('live', 'state', 'Call point', 'normal', FIRE_REASON);
    b.S('live', 'loop_v', 'SLC loop voltage', { value: 24, text: '24 VDC addressable loop' }, 0.3, 'V', { digits: 1 });
    b.D('capacity', 'class', 'Device', 'addressable, life-safety point (never isolable)', FIRE_SPEC);
    b.dep('upstream', 'fire-facp:1', 'FACP');
  });
  def('fire-epo', { kind: 'scenario', label: 'EPO', system: 'fire', tier2: null }, function (b, ctx) {
    b.title = 'Emergency power off';
    b.ST('live', 'state', 'EPO', 'normal', FIRE_REASON);
    b.S('live', 'loop_v', 'Supervised loop', { value: 24, text: '24 VDC supervised loop' }, 0.3, 'V', { digits: 1 });
    b.D('capacity', 'scope', 'Scope', 'hall IT feeds A + B, logged activation', FIRE_SPEC);
    b.dep('downstream', 'sld-msb:dh01', 'MSB feeds');
  });
  /* BMS */
  var BMS_SPEC = 'BMS point counts, protocol labels and controller ratings are page-authored architecture figures, not engine quantities (Track A §A5)';
  function bmsClass(label) {
    return function (b, ctx, id) {
      b.title = label + ' ' + id;
      b.S('live', 'cpu_pct', 'CPU', { value: 28, text: '28 % class' }, 8, '%', { digits: 0, min: 0, max: 100 });
      b.S('live', 'uptime_d', 'Uptime', { value: 180, text: '180 d since last restart' }, 0, 'd', { digits: 0 });
      b.ST('live', 'state', 'Node', 'up', 'node state is declared up in the simulation (Track A §A5)');
      b.D('capacity', 'protocols', 'Protocols', 'BACnet/IP · Modbus TCP · IEC 61850 · SNMP v3', BMS_SPEC);
      b.trend('cpu_pct', 'CPU', '%', { value: 28 }, 8, { digits: 0 });
    };
  }
  def('bms-server', { kind: 'authored', label: 'BMS server', system: 'bms', tier2: null }, bmsClass('BMS server'));
  def('bms-controller', { kind: 'authored', label: 'DDC controller', system: 'bms', tier2: null }, bmsClass('Controller'));
  def('bms-network', { kind: 'authored', label: 'BMS network', system: 'bms', tier2: null }, bmsClass('Network segment'));
  def('bms-gateway', { kind: 'authored', label: 'Protocol gateway', system: 'bms', tier2: null }, bmsClass('Gateway'));

  /* ------------------------------------------------------------------------
   * Public API
   * ---------------------------------------------------------------------- */
  function normalizeCtx(ctx) {
    if (!ctx || !ctx.snapshot) { throw new Error('hmi-payloads: ctx.snapshot (DCAI_CALC.snapshot) is required'); }
    if (!ctx.adapter) { throw new Error('hmi-payloads: ctx.adapter (DHE) is required'); }
    if (!ctx.basisMap) { throw new Error('hmi-payloads: ctx.basisMap (DH_BASIS) is required'); }
    if (!ctx.registryIndex || typeof ctx.registryIndex.get !== 'function') { throw new Error('hmi-payloads: ctx.registryIndex Map is required'); }
    var sim = ctx.sim || (root && root.RZDatahallAISimTelemetry) || (typeof require === 'function' ? require('./sim-telemetry.js') : null);
    if (!sim) { throw new Error('hmi-payloads: sim-telemetry.js is required'); }
    var out = {}; Object.keys(ctx).forEach(function (k) { out[k] = ctx[k]; });
    out.sim = sim;
    out.tick = finite(ctx.tick) ? Math.floor(ctx.tick) : sim.tickNow();
    out.scenarioId = ctx.scenario && ctx.scenario.scenarioId ? ctx.scenario.scenarioId : (ctx.scenarioId || 'normal');
    out.coolingScenarioId = ctx.cooling && ctx.cooling.scenarioId && COOLING_SCENARIOS[ctx.cooling.scenarioId] ? ctx.cooling.scenarioId : 'normal';
    return out;
  }
  /* Renderer manifests (js/datahall-ai/hmi-points.js): the extra points a deep mimic prints
     beyond the inspector's own rows, generated from the retired die rolls — each with an
     engine field / plane or a declared anchor and band. */
  function rendererPoints() {
    if (root && root.RZDatahallAIHmiPoints) { return root.RZDatahallAIHmiPoints; }
    if (typeof require === 'function') { try { return require('./hmi-points.js'); } catch (e) { return null; } }
    return null;
  }
  function applyManifest(b, ctx, classId, renderer) {
    var man = rendererPoints(); if (!man || !man[renderer]) { return; }
    man[renderer].forEach(function (sp) {
      if (b.index[sp.point]) { return; }
      var tab = sp.tab || 'maint';
      if (sp.kind === 'field') { b.E(tab, sp.point, sp.label, sp.field, sp.unit, { digits: sp.digits }); }
      else if (sp.kind === 'plane') { b.P(tab, sp.point, sp.label, sp.plane, sp.unit, { digits: sp.digits }); }
      else if (sp.kind === 'sim') {
        var anchor = sp.field ? { field: sp.field } : sp.plane ? { plane: sp.plane } : { value: sp.anchor, text: sp.anchorText || (sp.anchor + (sp.unit ? ' ' + sp.unit : '') + ' page-authored band') };
        b.S(tab, sp.point, sp.label, anchor, sp.band, sp.unit, { digits: sp.digits, min: sp.min, max: sp.max, period: sp.period, offset: sp.offset, scale: sp.scale });
      }
      else if (sp.kind === 'const') { b.D(tab, sp.point, sp.label, sp.text, sp.reason, sp.value); }
      else if (sp.kind === 'state') { b.ST(tab, sp.point, sp.label, sp.state, sp.reason); }
    });
  }
  function payload(classId, id, ctx, renderer) {
    var meta = CLASSES[classId];
    if (!meta) { throw new Error('hmi-payloads: unknown equipment class ' + classId); }
    var c = normalizeCtx(ctx);
    var b = new Builder(c, classId, id, meta);
    meta.build(b, c, id);
    if (renderer) { applyManifest(b, c, classId, renderer); }
    if (meta.tier2 === null && b.openHmi) { b.openHmi = null; }
    return b.build();
  }
  /* what a renderer gets when the authority is unavailable: every read is an em dash, every option declared */
  function stubPayload(classId, id, reason) {
    var why = 'engine authority unavailable — ' + (reason || 'no snapshot') + '; the HMI prints em dashes (Track A §A5)';
    return deepFreeze({ unavailable: true, classId: classId, id: String(id), reason: why, tabs: null,
      get: function () { return null; }, v: function () { return '—'; }, n: function () { return null; }, state: function () { return null; },
      opt: function () { return { declared: why }; }, optAll: function () { return { declared: why }; } });
  }
  function safePayload(classId, id, ctx, renderer) {
    try { return payload(classId, id, ctx, renderer); }
    catch (e) { return stubPayload(classId, id, e && e.message ? e.message : String(e)); }
  }
  /** the point names a class publishes, from a payload built on the given ctx */
  function points(classId, ctx) { var p = payload(classId, '1', ctx); return Object.keys(p.tabs).reduce(function (acc, t) { return acc.concat(Array.isArray(p.tabs[t]) ? p.tabs[t].map(function (r) { return r.point; }) : []); }, []); }
  function classList() { return Object.keys(CLASSES).map(function (k) { var m = CLASSES[k]; return { classId: k, kind: m.kind, label: m.label, system: m.system, tier2: m.tier2 }; }); }
  function buildContext(win, opts) {
    opts = opts || {};
    var auth = win.RZDatahallCurrentAuthority ? win.RZDatahallCurrentAuthority() : null;
    if (!auth || !auth.snapshot) { return null; }
    var reg = win.RZ_DCAI_PARAMETERS, idx = new Map();
    if (reg && reg.parameters) { reg.parameters.forEach(function (p) { idx.set(p.id, p); }); }
    var elec = win.RZDatahallAIElectrical, scenario = null;
    var sel = win.document && win.document.getElementById('electricalScenario');
    try { scenario = elec && !elec.unavailable ? elec.evaluateScenario(sel && sel.value ? sel.value : 'normal') : null; } catch (e) { scenario = null; }
    var cool = win.document && win.document.getElementById('coolingScenario');
    return {
      snapshot: auth.snapshot, adapter: win.DHE, basisMap: win.DH_BASIS, registryIndex: idx, registryVersion: reg ? reg.engineVersion : null,
      scenario: scenario, live: null, fire: opts.fire || null, cooling: { scenarioId: cool && cool.value ? cool.value : 'normal' },
      tick: finite(opts.tick) ? opts.tick : undefined, hall: finite(opts.hall) ? opts.hall : 1, sim: win.RZDatahallAISimTelemetry
    };
  }

  var API = { version: '2.2.0', CLASSES: Object.freeze(classList()), COOLING_SCENARIOS: COOLING_SCENARIOS, payload: payload, safePayload: safePayload, stubPayload: stubPayload, points: points, classList: classList, buildContext: buildContext };
  if (root) { root.RZDatahallAIHmiPayloads = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
