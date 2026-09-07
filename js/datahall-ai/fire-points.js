/* ============================================================================
 * fire-points.js — the Fire & Safety workstation's content (Track A §A6)
 * ----------------------------------------------------------------------------
 * DOM-free, deep-frozen, no clock and no die roll. Three things live here and
 * nowhere else:
 *
 *   1. The POINT INVENTORY. Every addressable fire, suppression, leak, EPO and
 *      FACP point of the four halls, generated from hall geometry × the ADOPTED
 *      NFPA 72 spacing below. Counts are formulas, never literals, and every one
 *      is a design selection: the engine publishes no fire quantity, so nothing
 *      here is hooked to a registry id — the page declares it.
 *   2. The ISOLATION REGISTER and its state machine. Isolating a detector is an
 *      operator act with rules, and the rules are the content: life-safety points
 *      are never isolable; nothing is isolated while the FACP is in alarm; an
 *      owner, a reason of ten characters and an explicit expiry are required;
 *      dropping a release zone below TWO independent detection means is not
 *      refused — it is a consequence the operator must acknowledge, after which
 *      the zone is IMPAIRED, its release is inhibited and a fire watch is raised.
 *      An expired isolation stays isolated (the device is physically bypassed)
 *      and raises its own record.
 *   3. evaluate(): one pure snapshot per tick that every surface renders from —
 *      points, zones, the facility summary, the context the equipment payloads
 *      read, the runtime updates the cause-and-effect engine applies, and the
 *      records the Alarms workspace ingests (alarm-query.js schema).
 *
 * Time is the sim tick (4 s) so a pinned tick reproduces everything; timestamps
 * derive from it. ES5, dual-target: window.RZDatahallAIFirePoints + module.exports.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var VERSION = '2.3.0';
  var TICK_MS = 4000;                       /* mirrors sim-telemetry.js — the gate asserts parity */
  var EPOCH = Date.UTC(2026, 0, 1);
  var TRACK = ' (Track A §A6)';

  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function finite(v) { return typeof v === 'number' && isFinite(v); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function hash(str) {
    var h = 2166136261, i;
    for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function isoFromTick(tick) { return new Date(EPOCH + Math.max(0, Math.floor(tick)) * TICK_MS).toISOString(); }

  /* ------------------------------------------------------------------------
   * Declared design selections
   * ---------------------------------------------------------------------- */
  var SPACING = deepFreeze({
    spotSmokeM: 9.1, heatListedM: 15.2, vesdaPortM: 7.5,
    basis: 'NFPA 72 Table 17.6.3.5.1 smooth-ceiling spot spacing 9.1 m; NFPA 72 §17.6.3.1.1 listed heat-detector spacing 15.2 m; ' +
      'aspirating sampling port 7.5 m for the adopted VESDA class — ADOPTED design selections applied to the engine hall geometry, not engine quantities' + TRACK
  });
  var MEANS = deepFreeze({
    vesda: 'Aspirating smoke (VESDA)', smoke_l1: 'Spot smoke loop 1', smoke_l2: 'Spot smoke loop 2',
    heat: 'Heat detection', lhd: 'Linear heat cable', beam: 'Beam smoke'
  });
  /* 12 zones per hall. Z01–Z08 share the hall floor (areaShare sums to 1.0); Z09–Z12 are the
     ancillary rooms with a stated floor area. `means` are the independent detection means the
     double-interlock release counts; `release` marks clean-agent zones; `epo` follows Tech Spec §6.9
     (NFPA 75 §9.4 — electrical rooms only). */
  var ZONE_TEMPLATE = deepFreeze([
    { n: 1, name: 'CDU gallery 1', areaShare: 0.08, means: ['vesda', 'smoke_l1', 'smoke_l2'], release: true, epo: false },
    { n: 2, name: 'CDU gallery 2', areaShare: 0.08, means: ['vesda', 'smoke_l1', 'smoke_l2'], release: true, epo: false },
    { n: 3, name: 'CDU gallery 3', areaShare: 0.08, means: ['vesda', 'smoke_l1', 'smoke_l2'], release: true, epo: false },
    { n: 4, name: 'CDU gallery 4', areaShare: 0.08, means: ['vesda', 'smoke_l1', 'smoke_l2'], release: true, epo: false },
    { n: 5, name: 'Rack rows 1-3', areaShare: 0.17, means: ['vesda', 'smoke_l1', 'smoke_l2', 'heat', 'lhd'], release: true, epo: false },
    { n: 6, name: 'Rack rows 4-5', areaShare: 0.17, means: ['vesda', 'smoke_l1', 'smoke_l2', 'heat', 'lhd'], release: true, epo: false },
    { n: 7, name: 'Rack rows 6-8', areaShare: 0.17, means: ['vesda', 'smoke_l1', 'smoke_l2', 'heat', 'lhd'], release: true, epo: false },
    { n: 8, name: 'Rack rows 9-10', areaShare: 0.17, means: ['vesda', 'smoke_l1', 'smoke_l2', 'heat', 'lhd'], release: true, epo: false },
    { n: 9, name: 'Elec room A', areaM2: 200, means: ['vesda', 'beam', 'smoke_l1', 'smoke_l2'], release: true, epo: true },
    { n: 10, name: 'Elec room B', areaM2: 200, means: ['vesda', 'beam', 'smoke_l1', 'smoke_l2'], release: true, epo: true },
    { n: 11, name: 'UPS + battery', areaM2: 150, means: ['vesda', 'heat', 'smoke_l1', 'smoke_l2'], release: true, epo: true },
    { n: 12, name: 'MDF / network', areaM2: 120, means: ['vesda', 'smoke_l1', 'smoke_l2'], release: true, epo: false }
  ]);
  var TYPES = deepFreeze({
    vesda: { label: 'Aspirating detector', code: 'VD', system: 'fire', lifeSafety: false },
    smoke_spot: { label: 'Photoelectric smoke detector', code: 'SD', system: 'fire', lifeSafety: false },
    heat_spot: { label: 'Heat detector', code: 'HD', system: 'fire', lifeSafety: false },
    beam: { label: 'Beam smoke detector', code: 'BD', system: 'fire', lifeSafety: false },
    lhd: { label: 'Linear heat cable', code: 'LHD', system: 'fire', lifeSafety: false },
    mcp: { label: 'Manual call point', code: 'MCP', system: 'fire', lifeSafety: true },
    epo: { label: 'Emergency power off', code: 'EPO', system: 'epo', lifeSafety: true },
    release: { label: 'Release circuit', code: 'REL', system: 'suppression', lifeSafety: true },
    abort: { label: 'Abort station', code: 'ABORT', system: 'suppression', lifeSafety: true },
    preaction_solenoid: { label: 'Pre-action solenoid', code: 'PAV', system: 'suppression', lifeSafety: false },
    leak_rope: { label: 'Leak rope zone', code: 'LK', system: 'leak', lifeSafety: false },
    facp_loop: { label: 'SLC loop', code: 'LOOP', system: 'facp', lifeSafety: false },
    facp_nac: { label: 'Notification circuit', code: 'NAC', system: 'facp', lifeSafety: false },
    facp_comms: { label: 'FACP supervising comms', code: 'COMMS', system: 'facp', lifeSafety: false },
    agent_pressure: { label: 'Agent cylinder pressure switch', code: 'CYL', system: 'suppression', lifeSafety: false }
  });
  var STATES = deepFreeze(['normal', 'prealarm', 'alarm', 'active', 'trouble', 'isolated', 'armed', 'inhibited', 'discharged', 'lockout']);
  var EXPIRY_OPTIONS = deepFreeze([
    { id: '2h', label: '2 hours', ticks: 1800 }, { id: '8h', label: '8 hours', ticks: 7200 },
    { id: '24h', label: '24 hours', ticks: 21600 }, { id: '72h', label: '72 hours', ticks: 64800 }
  ]);
  var OWNERS = deepFreeze(['shift-a', 'shift-b', 'fire-watch', 'contractor']);
  var MAX_EXTENSIONS = 2, MIN_REASON = 10;
  var REFUSALS = deepFreeze({
    UNKNOWN_POINT: 'the point id is not in the inventory',
    LIFE_SAFETY_POINT: 'manual call points, EPO stations, release and abort circuits are life-safety points and are never isolable',
    FACP_IN_ALARM: 'no isolation is accepted while the FACP is in alarm (confirmed fire, suppression armed, discharged or lockout)',
    OWNER_REQUIRED: 'an isolation needs an owner (shift-a, shift-b, fire-watch or contractor)',
    REASON_TOO_SHORT: 'a reason of at least ten characters is required',
    EXPIRY_REQUIRED: 'an explicit expiry (2h, 8h, 24h or 72h) is required',
    ALREADY_ISOLATED: 'the point is already isolated — extend or restore it',
    NOT_ISOLATED: 'the point is not isolated',
    EXTEND_LIMIT: 'an isolation may be extended twice; restore it and raise a new one',
    CONSEQUENCE_NOT_ACKNOWLEDGED: 'this isolation drops a release zone below two independent detection means — the impairment must be acknowledged'
  });
  var AGENT_LABEL = 'clean-agent suppression — project selection pending (FK-5-1-12 candidate)';
  var STAGES = deepFreeze(['normal', 'prealarm', 'confirmed', 'suppression_armed', 'discharged', 'lockout', 'epo_active', 'leak_wet']);
  /* the 14 initiating events of fire-cause-effect.js mapped to the doc-24 §8 stage model */
  var STAGE_OF_EVENT = deepFreeze({
    vesda_alert: 'prealarm', vesda_action: 'prealarm',
    vesda_fire_1: 'confirmed', vesda_fire_2: 'confirmed', multi_sensor_confirmation: 'confirmed', confirmed_fire: 'confirmed',
    manual_call_point: 'confirmed', preaction_or_sprinkler: 'confirmed',
    suppression_armed: 'suppression_armed', suppression_abort: 'suppression_armed',
    suppression_release: 'suppression_armed', suppression_discharged: 'discharged',
    epo: 'epo_active', water_leak: 'leak_wet'
  });
  var RELEASE_DELAY_S = 30, LOCKOUT_AFTER_S = 300;
  var FACP_ALARM_STAGES = deepFreeze({ confirmed: 1, suppression_armed: 1, discharged: 1, lockout: 1 });

  function declare(kind) {
    var D = {
      inventory: 'fire point inventory derived from the engine hall geometry × ADOPTED NFPA 72 spacing (9.1 m spot smoke, 15.2 m heat, 7.5 m aspirating port); design selections, not engine quantities' + TRACK,
      register: 'isolation register of this browser — a TRAINING register: owner, reason, expiry and consequence are operator input, no command leaves the page' + TRACK,
      summary: 'facility fire summary computed from the point inventory, the isolation register and the selected training scenario; counts are inventory arithmetic, never sensor readings' + TRACK,
      lastTest: 'last functional test date is simulated per point (seeded, quarterly) and declared as such; no maintenance system feeds this page' + TRACK,
      stage: 'protection stage from the selected training scenario mapped onto the doc-24 §8 stage model; the FACP remains the authority and no command leaves the page' + TRACK
    };
    return D[kind] || D.summary;
  }

  /* ------------------------------------------------------------------------
   * 1. Inventory
   * ---------------------------------------------------------------------- */
  function lastTestFor(id) {
    var h = hash(id), month = 3 * (1 + (h % 3)), day = 1 + ((h >>> 8) % 28);
    return '2026-' + pad2(month) + '-' + pad2(day);
  }
  function spotsFor(areaM2) { return Math.max(1, Math.ceil(areaM2 / (SPACING.spotSmokeM * SPACING.spotSmokeM))); }
  function heatsFor(areaM2) { return Math.max(1, Math.ceil(areaM2 / (SPACING.heatListedM * SPACING.heatListedM))); }
  function portsFor(areaM2) { return Math.max(1, Math.ceil(areaM2 / (SPACING.vesdaPortM * SPACING.vesdaPortM))); }

  function buildInventory(geometry) {
    var g = geometry || {};
    var halls = finite(g.halls) && g.halls > 0 ? Math.floor(g.halls) : null;
    var L = finite(g.hallLengthM) && g.hallLengthM > 0 ? g.hallLengthM : null;
    var W = finite(g.hallWidthM) && g.hallWidthM > 0 ? g.hallWidthM : null;
    var leakZones = finite(g.leakZonesPerHall) && g.leakZonesPerHall > 0 ? Math.floor(g.leakZonesPerHall) : 24;
    if (!halls || !L || !W) { throw new Error('fire-points: inventory needs halls, hallLengthM and hallWidthM'); }
    var hallArea = L * W, zones = [], points = [], h, z, i, k, u;
    function add(p) {
      p.lastTestAt = lastTestFor(p.id);
      p.system = p.system || TYPES[p.type].system;
      p.lifeSafety = TYPES[p.type].lifeSafety;
      p.isolable = !p.lifeSafety;
      p.releaseRole = p.releaseRole || null;
      p.means = p.means || null;
      p.loop = p.loop || null;
      p.zoneIds = p.zoneIds || [];
      p.zoneId = p.zoneIds.length ? p.zoneIds[0] : null;
      points.push(p);
      return p;
    }
    for (h = 1; h <= halls; h++) {
      var hallId = 'DH-' + pad2(h), hallZones = [];
      for (z = 0; z < ZONE_TEMPLATE.length; z++) {
        var t = ZONE_TEMPLATE[z];
        var area = finite(t.areaM2) ? t.areaM2 : Math.round(hallArea * t.areaShare * 10) / 10;
        var zone = { id: hallId + '-Z' + pad2(t.n), hall: h, n: t.n, name: t.name, areaM2: area, means: t.means.slice(), release: t.release, epo: t.epo, counts: {} };
        hallZones.push(zone); zones.push(zone);
        var loops = [1, 2], spots = spotsFor(area);
        for (i = 0; i < loops.length; i++) {
          var m = 'smoke_l' + loops[i]; if (t.means.indexOf(m) < 0) { continue; }
          zone.counts[m] = spots;
          for (k = 1; k <= spots; k++) {
            add({ id: zone.id + '-SD' + loops[i] + '-' + pad2(k), hall: h, zoneIds: [zone.id], type: 'smoke_spot', means: m, loop: 'L' + loops[i],
              address: 'L' + loops[i] + ':' + pad2(t.n) + pad2(k), label: 'Photo smoke loop ' + loops[i] + ' #' + k, room: t.name });
          }
        }
        if (t.means.indexOf('heat') >= 0) {
          var heats = heatsFor(area); zone.counts.heat = heats;
          for (k = 1; k <= heats; k++) { add({ id: zone.id + '-HD-' + pad2(k), hall: h, zoneIds: [zone.id], type: 'heat_spot', means: 'heat', loop: 'L3', address: 'L3:' + pad2(t.n) + pad2(k), label: 'Rate-of-rise / fixed 57 °C heat #' + k, room: t.name }); }
        }
        if (t.means.indexOf('beam') >= 0) { zone.counts.beam = 1; add({ id: zone.id + '-BD-1', hall: h, zoneIds: [zone.id], type: 'beam', means: 'beam', loop: 'L3', address: 'L3:' + pad2(t.n) + '90', label: 'Reflective beam detector', room: t.name }); }
        if (t.means.indexOf('lhd') >= 0) { zone.counts.lhd = 1; add({ id: zone.id + '-LHD-1', hall: h, zoneIds: [zone.id], type: 'lhd', means: 'lhd', loop: 'L3', address: 'L3:' + pad2(t.n) + '91', label: 'Linear heat cable loop (busway / tray)', room: t.name }); }
        if (t.release) {
          add({ id: zone.id + '-REL', hall: h, zoneIds: [zone.id], type: 'release', releaseRole: 'release', loop: 'REL', address: 'REL:' + pad2(t.n), label: 'Clean-agent release circuit (solenoid)', room: t.name });
          add({ id: zone.id + '-ABORT', hall: h, zoneIds: [zone.id], type: 'abort', releaseRole: 'abort', loop: 'REL', address: 'ABT:' + pad2(t.n), label: 'Abort station at the zone exit', room: t.name });
          add({ id: zone.id + '-PAV', hall: h, zoneIds: [zone.id], type: 'preaction_solenoid', releaseRole: 'preaction', loop: 'REL', address: 'PAV:' + pad2(t.n), label: 'Pre-action valve solenoid (double interlock)', room: t.name });
        }
        if (t.epo) { add({ id: zone.id + '-EPO', hall: h, zoneIds: [zone.id], type: 'epo', loop: 'EPO', address: 'EPO:' + pad2(t.n), label: 'Zoned EPO station (dual-confirm)', room: t.name }); }
      }
      /* one aspirating unit per three zones — a VESDA unit is ONE point that serves three zones */
      for (u = 1; u <= Math.ceil(hallZones.length / 3); u++) {
        var served = hallZones.slice((u - 1) * 3, u * 3), ports = 0;
        for (i = 0; i < served.length; i++) { ports += portsFor(served[i].areaM2); served[i].counts.vesda = 1; }
        add({ id: hallId + '-VD-' + u, hall: h, zoneIds: served.map(function (s) { return s.id; }), type: 'vesda', means: 'vesda', loop: 'ASD', address: 'ASD:' + pad2(u),
          label: 'Aspirating detector VD-' + u + ' (' + ports + ' sampling ports)', room: served.map(function (s) { return s.name; }).join(' · '), ports: ports });
      }
      add({ id: hallId + '-MCP-N', hall: h, zoneIds: [hallZones[4].id], type: 'mcp', loop: 'L1', address: 'L1:MCP-N', label: 'Manual call point — north exit', room: hallZones[4].name });
      add({ id: hallId + '-MCP-S', hall: h, zoneIds: [hallZones[7].id], type: 'mcp', loop: 'L2', address: 'L2:MCP-S', label: 'Manual call point — south exit', room: hallZones[7].name });
      add({ id: hallId + '-MCP-NOC', hall: h, zoneIds: [hallZones[11].id], type: 'mcp', loop: 'L3', address: 'L3:MCP-NOC', label: 'Manual call point — NOC', room: hallZones[11].name });
      for (k = 1; k <= leakZones; k++) {
        var fz = hallZones[Math.min(7, Math.floor((k - 1) / (leakZones / 8)))];
        add({ id: hallId + '-LK-' + pad2(k), hall: h, zoneIds: [fz.id], type: 'leak_rope', system: 'leak', loop: 'LDS', address: 'LDS:' + pad2(k), label: 'Leak rope zone ' + k + ' (raised floor / manifold)', room: fz.name });
      }
      for (k = 1; k <= 3; k++) { add({ id: hallId + '-FACP-LOOP-' + k, hall: h, zoneIds: [], type: 'facp_loop', loop: 'L' + k, address: 'SLC:' + k, label: 'Addressable loop ' + k, room: 'FACP room' }); }
      for (k = 1; k <= 2; k++) { add({ id: hallId + '-FACP-NAC-' + k, hall: h, zoneIds: [], type: 'facp_nac', loop: 'NAC', address: 'NAC:' + k, label: 'Notification appliance circuit ' + k, room: 'FACP room' }); }
      add({ id: hallId + '-FACP-COMMS', hall: h, zoneIds: [], type: 'facp_comms', loop: 'NET', address: 'NET:1', label: 'Supervising-station and BMS monitor link', room: 'FACP room' });
      add({ id: hallId + '-CYL', hall: h, zoneIds: [], type: 'agent_pressure', loop: 'REL', address: 'PS:1', label: 'Agent cylinder bank pressure switch', room: 'Cylinder room' });
    }
    var byId = {}, zoneById = {}, counts = { total: points.length, byType: {}, bySystem: {} };
    for (i = 0; i < points.length; i++) {
      var p = points[i]; byId[p.id] = p;
      counts.byType[p.type] = (counts.byType[p.type] || 0) + 1;
      counts.bySystem[p.system] = (counts.bySystem[p.system] || 0) + 1;
    }
    for (i = 0; i < zones.length; i++) { zoneById[zones[i].id] = zones[i]; }
    return deepFreeze({ version: VERSION, geometry: { halls: halls, hallLengthM: L, hallWidthM: W, hallAreaM2: hallArea, leakZonesPerHall: leakZones },
      spacing: SPACING, zones: zones, points: points, byId: byId, zoneById: zoneById, counts: counts, declared: declare('inventory') });
  }

  /* ------------------------------------------------------------------------
   * 2. Register + state machine
   * ---------------------------------------------------------------------- */
  function createRegister() { return deepFreeze({ version: 1, sequence: 1000, entries: {} }); }
  function expiryOf(id) { for (var i = 0; i < EXPIRY_OPTIONS.length; i++) { if (EXPIRY_OPTIONS[i].id === id) { return EXPIRY_OPTIONS[i]; } } return null; }
  function stageOf(fire, tick) {
    if (!fire || !fire.eventId || !STAGE_OF_EVENT[fire.eventId]) { return 'normal'; }
    var elapsed = Math.max(0, (tick - (finite(fire.startedAtTick) ? fire.startedAtTick : tick)) * (TICK_MS / 1000));
    var stage = STAGE_OF_EVENT[fire.eventId];
    if (fire.eventId === 'suppression_release' && elapsed >= RELEASE_DELAY_S) { stage = 'discharged'; }
    if (fire.eventId === 'suppression_discharged' && elapsed >= LOCKOUT_AFTER_S) { stage = 'lockout'; }
    return stage;
  }
  function facpInAlarm(fire, tick) { return !!FACP_ALARM_STAGES[stageOf(fire, tick)]; }
  function isolatedSet(reg) { return reg && reg.entries ? reg.entries : {}; }
  /** independent detection means still available in a zone under a register (a VESDA unit counts for every zone it serves) */
  function meansOf(inv, reg, zoneId) {
    var zone = inv.zoneById[zoneId]; if (!zone) { return null; }
    var iso = isolatedSet(reg), available = [], lost = [], i, m, pts;
    for (i = 0; i < zone.means.length; i++) {
      m = zone.means[i];
      pts = inv.points.filter(function (p) { return p.means === m && p.zoneIds.indexOf(zoneId) >= 0; });
      if (pts.some(function (p) { return !iso[p.id]; })) { available.push(m); } else { lost.push(m); }
    }
    return { zoneId: zoneId, total: zone.means.length, available: available, lost: lost, count: available.length };
  }
  function nextRecord(reg, tick, fields) {
    var seq = reg.sequence + 1;
    var rec = {
      id: 'FIRE-' + fields.code + '-' + pad2(0).slice(0, 0) + String(seq),
      timestamp: isoFromTick(tick), sequence: seq,
      tag: fields.tag, point: fields.point || 'ISOLATION', location: fields.location, system: 'fire',
      severity: fields.severity, lifecycle: fields.lifecycle, kind: 'discrete',
      previousState: fields.previousState, currentState: fields.currentState, quality: 'simulated',
      event: fields.event, action: fields.action, scenario: 'training', operator: fields.operator || 'system',
      message: fields.message, incidentId: fields.incidentId, asset: fields.asset, source: 'fire-points', runId: 'tick-' + tick, trigger: fields.trigger || 'operator', reset: fields.reset || 'restore'
    };
    return { record: rec, sequence: seq };
  }
  function locationOf(inv, p) { var z = p.zoneId ? inv.zoneById[p.zoneId] : null; return 'DH-' + pad2(p.hall) + '/' + (z ? 'Z' + pad2(z.n) + ' ' + z.name : p.room); }
  function refusal(inv, reg, req, code) {
    var p = inv.byId[req.pointId] || null, tick = finite(req.tick) ? req.tick : 0;
    var r = nextRecord(reg, tick, {
      code: 'REF', tag: p ? p.id : String(req.pointId || 'unknown'), location: p ? locationOf(inv, p) : 'unknown', severity: 'info', lifecycle: 'normal',
      previousState: p && isolatedSet(reg)[p.id] ? 'isolated' : 'normal', currentState: p && isolatedSet(reg)[p.id] ? 'isolated' : 'normal',
      event: 'isolation-refused', action: req.action || 'isolate', operator: req.owner || 'unknown',
      message: 'Isolation request refused — ' + code + ': ' + REFUSALS[code], incidentId: 'ISO-REFUSED-' + (p ? p.id : 'unknown') + '-' + tick,
      asset: p ? 'fire-point:' + p.id : 'fire-point:unknown', trigger: 'operator', reset: 'none'
    });
    var next = clone(reg); next.sequence = r.sequence;
    return deepFreeze({ ok: false, code: code, message: REFUSALS[code], register: deepFreeze(next), records: [r.record], consequence: null });
  }
  function consequenceOf(inv, reg, p) {
    var withPoint = clone(reg); withPoint.entries[p.id] = { pointId: p.id };
    var zones = p.zoneIds.map(function (zid) {
      var before = meansOf(inv, reg, zid), after = meansOf(inv, withPoint, zid), zone = inv.zoneById[zid];
      return { zoneId: zid, name: zone.name, release: zone.release, meansBefore: before.count, meansAfter: after.count, impaired: zone.release && after.count < 2, lost: after.lost };
    });
    var impaired = zones.some(function (z) { return z.impaired; });
    var text = zones.map(function (z) {
      return 'Z' + pad2(inv.zoneById[z.zoneId].n) + ' ' + z.name + ': ' + z.meansBefore + ' → ' + z.meansAfter + ' independent detection means' +
        (z.impaired ? ' — below two: zone IMPAIRED, clean-agent release inhibited, fire watch required' : '');
    }).join('; ');
    return { zones: zones, zoneImpaired: impaired, releaseInhibited: impaired, fireWatch: impaired, text: text };
  }
  function previewIsolate(inv, reg, req, ctx) {
    var p = inv.byId[req && req.pointId];
    var tick = req && finite(req.tick) ? req.tick : 0;
    if (!p) { return { ok: false, code: 'UNKNOWN_POINT', message: REFUSALS.UNKNOWN_POINT }; }
    if (p.lifeSafety) { return { ok: false, code: 'LIFE_SAFETY_POINT', message: REFUSALS.LIFE_SAFETY_POINT }; }
    if (isolatedSet(reg)[p.id]) { return { ok: false, code: 'ALREADY_ISOLATED', message: REFUSALS.ALREADY_ISOLATED }; }
    if (ctx && ctx.fire && facpInAlarm(ctx.fire, tick)) { return { ok: false, code: 'FACP_IN_ALARM', message: REFUSALS.FACP_IN_ALARM }; }
    if (!req.owner || OWNERS.indexOf(String(req.owner)) < 0) { return { ok: false, code: 'OWNER_REQUIRED', message: REFUSALS.OWNER_REQUIRED }; }
    if (!req.reason || String(req.reason).trim().length < MIN_REASON) { return { ok: false, code: 'REASON_TOO_SHORT', message: REFUSALS.REASON_TOO_SHORT }; }
    if (!expiryOf(req.expiryId)) { return { ok: false, code: 'EXPIRY_REQUIRED', message: REFUSALS.EXPIRY_REQUIRED }; }
    return { ok: true, point: p, consequence: consequenceOf(inv, reg, p) };
  }
  function isolate(inv, reg, req, ctx) {
    var pre = previewIsolate(inv, reg, req, ctx);
    if (!pre.ok) { return refusal(inv, reg, req, pre.code); }
    if (pre.consequence.zoneImpaired && req.acknowledged !== true) { return refusal(inv, reg, req, 'CONSEQUENCE_NOT_ACKNOWLEDGED'); }
    var p = pre.point, tick = req.tick, exp = expiryOf(req.expiryId);
    var r = nextRecord(reg, tick, {
      code: 'ISO', tag: p.id, location: locationOf(inv, p), severity: 'medium', lifecycle: 'inhibited', previousState: 'normal', currentState: 'isolated',
      event: 'point-isolated', action: 'isolate', operator: req.owner,
      message: p.label + ' isolated by ' + req.owner + ' — reason: ' + String(req.reason).trim() + ' — expires ' + exp.label + ' (tick ' + (tick + exp.ticks) + ')' + (pre.consequence.zoneImpaired ? ' — consequence acknowledged: ' + pre.consequence.text : ''),
      incidentId: 'ISO-' + p.id + '-' + tick, asset: 'fire-point:' + p.id
    });
    var next = clone(reg); next.sequence = r.sequence;
    next.entries[p.id] = { pointId: p.id, owner: req.owner, reason: String(req.reason).trim(), isolatedAtTick: tick, expiryId: exp.id, expiresAtTick: tick + exp.ticks, extensions: 0, acknowledgedConsequence: !!pre.consequence.zoneImpaired };
    return deepFreeze({ ok: true, code: null, message: null, register: deepFreeze(next), records: [r.record], consequence: pre.consequence });
  }
  function restore(inv, reg, req) {
    var p = inv.byId[req && req.pointId];
    if (!p) { return refusal(inv, reg, { pointId: req && req.pointId, owner: req && req.owner, tick: req && req.tick, action: 'restore' }, 'UNKNOWN_POINT'); }
    var entry = isolatedSet(reg)[p.id];
    if (!entry) { return refusal(inv, reg, { pointId: p.id, owner: req.owner, tick: req.tick, action: 'restore' }, 'NOT_ISOLATED'); }
    var tick = finite(req.tick) ? req.tick : entry.isolatedAtTick;
    var r = nextRecord(reg, tick, {
      code: 'RST', tag: p.id, location: locationOf(inv, p), severity: 'info', lifecycle: 'returned_ack', previousState: 'isolated', currentState: 'normal',
      event: 'point-restored', action: 'restore', operator: req.owner || entry.owner,
      message: p.label + ' restored to service by ' + (req.owner || entry.owner) + ' after ' + Math.round((tick - entry.isolatedAtTick) * TICK_MS / 60000) + ' min (isolated by ' + entry.owner + ': ' + entry.reason + ')',
      incidentId: 'ISO-' + p.id + '-' + entry.isolatedAtTick, asset: 'fire-point:' + p.id, reset: 'restored'
    });
    var next = clone(reg); next.sequence = r.sequence; delete next.entries[p.id];
    return deepFreeze({ ok: true, code: null, message: null, register: deepFreeze(next), records: [r.record], consequence: null });
  }
  function extend(inv, reg, req) {
    var p = inv.byId[req && req.pointId];
    if (!p) { return refusal(inv, reg, { pointId: req && req.pointId, owner: req && req.owner, tick: req && req.tick, action: 'extend' }, 'UNKNOWN_POINT'); }
    var entry = isolatedSet(reg)[p.id];
    if (!entry) { return refusal(inv, reg, { pointId: p.id, owner: req.owner, tick: req.tick, action: 'extend' }, 'NOT_ISOLATED'); }
    if (entry.extensions >= MAX_EXTENSIONS) { return refusal(inv, reg, { pointId: p.id, owner: req.owner, tick: req.tick, action: 'extend' }, 'EXTEND_LIMIT'); }
    var exp = expiryOf(req.expiryId);
    if (!exp) { return refusal(inv, reg, { pointId: p.id, owner: req.owner, tick: req.tick, action: 'extend' }, 'EXPIRY_REQUIRED'); }
    if (!req.owner || OWNERS.indexOf(String(req.owner)) < 0) { return refusal(inv, reg, { pointId: p.id, owner: req.owner, tick: req.tick, action: 'extend' }, 'OWNER_REQUIRED'); }
    var tick = finite(req.tick) ? req.tick : entry.isolatedAtTick;
    var r = nextRecord(reg, tick, {
      code: 'EXT', tag: p.id, location: locationOf(inv, p), severity: 'medium', lifecycle: 'inhibited', previousState: 'isolated', currentState: 'isolated',
      event: 'isolation-extended', action: 'extend', operator: req.owner,
      message: p.label + ' isolation extended by ' + req.owner + ' to ' + exp.label + ' from now (tick ' + (tick + exp.ticks) + '), extension ' + (entry.extensions + 1) + ' of ' + MAX_EXTENSIONS + (req.reason ? ' — ' + String(req.reason).trim() : ''),
      incidentId: 'ISO-' + p.id + '-' + entry.isolatedAtTick, asset: 'fire-point:' + p.id
    });
    var next = clone(reg); next.sequence = r.sequence;
    next.entries[p.id].expiryId = exp.id; next.entries[p.id].expiresAtTick = tick + exp.ticks; next.entries[p.id].extensions = entry.extensions + 1;
    return deepFreeze({ ok: true, code: null, message: null, register: deepFreeze(next), records: [r.record], consequence: null });
  }

  /* ------------------------------------------------------------------------
   * 3. evaluate — the snapshot
   * ---------------------------------------------------------------------- */
  function pointState(p, entry, zoneInfo, fire, stage, tick) {
    if (entry) { return 'isolated'; }
    if (p.releaseRole && zoneInfo && zoneInfo.releaseInhibited) { return 'inhibited'; }
    var inEventZone = fire && fire.zoneId && p.zoneIds.indexOf(fire.zoneId) >= 0;
    if (p.type === 'leak_rope') { return inEventZone && stage === 'leak_wet' ? 'active' : 'normal'; }
    if (p.type === 'epo') { return inEventZone && stage === 'epo_active' ? 'active' : 'normal'; }
    if (p.releaseRole === 'release' || p.releaseRole === 'preaction') {
      if (!inEventZone) { return 'normal'; }
      if (stage === 'suppression_armed') { return 'armed'; }
      if (stage === 'discharged') { return 'discharged'; }
      if (stage === 'lockout') { return 'lockout'; }
      return 'normal';
    }
    if (p.releaseRole === 'abort') { return inEventZone && fire.eventId === 'suppression_abort' ? 'active' : 'normal'; }
    if (p.type === 'mcp') { return inEventZone && fire.eventId === 'manual_call_point' ? 'active' : 'normal'; }
    if (p.system === 'facp' || p.type === 'agent_pressure') { return stage === 'discharged' && p.type === 'agent_pressure' && fire && fire.zoneId && String(fire.zoneId).indexOf('DH-' + pad2(p.hall)) === 0 ? 'active' : 'normal'; }
    /* detection means */
    if (!inEventZone) { return 'normal'; }
    if (stage === 'prealarm') { return p.means === 'vesda' ? 'prealarm' : 'normal'; }
    if (stage === 'confirmed' || stage === 'suppression_armed' || stage === 'discharged' || stage === 'lockout') { return 'alarm'; }
    return 'normal';
  }
  function evaluate(inv, reg, fire, tick) {
    reg = reg || createRegister();
    tick = finite(tick) ? Math.floor(tick) : 0;
    var stage = stageOf(fire, tick), iso = isolatedSet(reg);
    var elapsed = fire && finite(fire.startedAtTick) ? Math.max(0, (tick - fire.startedAtTick) * (TICK_MS / 1000)) : 0;
    var zones = inv.zones.map(function (z) {
      var means = meansOf(inv, reg, z.id);
      var isolated = inv.points.filter(function (p) { return iso[p.id] && p.zoneIds.indexOf(z.id) >= 0; });
      var expired = isolated.filter(function (p) { return tick >= iso[p.id].expiresAtTick; });
      var impaired = z.release && means.count < 2;
      var since = isolated.length ? Math.max.apply(null, isolated.map(function (p) { return iso[p.id].isolatedAtTick; })) : null;
      var inEvent = fire && fire.zoneId === z.id;
      var state = inEvent && stage !== 'normal' ? stage : impaired ? 'impaired' : isolated.length ? 'isolated' : 'normal';
      return { id: z.id, hall: z.hall, n: z.n, name: z.name, areaM2: z.areaM2, release: z.release, epo: z.epo, detectionMeans: z.means.slice(),
        meansTotal: means.total, meansAvailable: means.count, meansLost: means.lost, impaired: impaired, releaseInhibited: impaired,
        fireWatch: impaired || expired.length > 0, isolatedCount: isolated.length, expiredCount: expired.length, impairedSinceTick: impaired ? since : null, state: state, inEvent: !!inEvent };
    });
    var zoneInfo = {}; zones.forEach(function (z) { zoneInfo[z.id] = z; });
    var points = inv.points.map(function (p) {
      var entry = iso[p.id] || null, zi = p.zoneId ? zoneInfo[p.zoneId] : null;
      var anyInhibited = p.zoneIds.some(function (zid) { return zoneInfo[zid] && zoneInfo[zid].releaseInhibited; });
      var state = pointState(p, entry, anyInhibited ? { releaseInhibited: true } : zi, fire, stage, tick);
      return { id: p.id, hall: p.hall, zoneId: p.zoneId, zoneIds: p.zoneIds, type: p.type, typeLabel: TYPES[p.type].label, means: p.means, meansLabel: p.means ? MEANS[p.means] : null,
        system: p.system, loop: p.loop, address: p.address, label: p.label, room: p.room, lifeSafety: p.lifeSafety, isolable: p.isolable, releaseRole: p.releaseRole, lastTestAt: p.lastTestAt,
        state: state, isolation: entry ? { owner: entry.owner, reason: entry.reason, isolatedAtTick: entry.isolatedAtTick, expiryId: entry.expiryId, expiresAtTick: entry.expiresAtTick, extensions: entry.extensions, expired: tick >= entry.expiresAtTick } : null };
    });
    var count = function (fn) { return points.filter(fn).length; };
    var ok = function (type) { return count(function (p) { return p.type === type && p.state !== 'isolated' && p.state !== 'trouble'; }); };
    var impairedZones = zones.filter(function (z) { return z.impaired; }).map(function (z) { return z.id; });
    var expiredIsolations = points.filter(function (p) { return p.isolation && p.isolation.expired; }).map(function (p) { return p.id; });
    var zLabel = fire && fire.zoneId && inv.zoneById[fire.zoneId] ? 'Z' + pad2(inv.zoneById[fire.zoneId].n) + ' DH-' + pad2(inv.zoneById[fire.zoneId].hall) : '';
    var fireText = stage === 'confirmed' ? 'ALARM ' + zLabel : stage === 'suppression_armed' ? 'ARMED ' + zLabel : stage === 'discharged' ? 'DISCHARGED ' + zLabel : stage === 'lockout' ? 'LOCKOUT ' + zLabel : stage === 'prealarm' ? 'PRE-ALARM ' + zLabel : 'NORMAL';
    var vesdaIso = count(function (p) { return p.type === 'vesda' && p.state === 'isolated'; });
    var summary = {
      stage: stage, fire: fireText.trim(),
      vesda: stage === 'prealarm' ? 'ALERT ' + zLabel : vesdaIso ? vesdaIso + ' ISOLATED' : 'NORMAL',
      leak: stage === 'leak_wet' ? 'WET ' + zLabel : 'CLEAR',
      epo: stage === 'epo_active' ? 'ACTIVE ' + zLabel : 'ARMED',
      disabled: count(function (p) { return p.state === 'isolated'; }),
      maint: count(function (p) { return p.state === 'isolated'; }),
      inAlarm: count(function (p) { return p.state === 'alarm' || p.state === 'active' || p.state === 'prealarm' || p.state === 'discharged'; }),
      smokeOk: ok('smoke_spot'), smokeTotal: inv.counts.byType.smoke_spot || 0, heatOk: ok('heat_spot'), heatTotal: inv.counts.byType.heat_spot || 0,
      vesdaOk: ok('vesda'), vesdaTotal: inv.counts.byType.vesda || 0, ropeOk: ok('leak_rope'), ropeTotal: inv.counts.byType.leak_rope || 0,
      impairedZones: impairedZones, expiredIsolations: expiredIsolations, fireWatch: impairedZones.length > 0 || expiredIsolations.length > 0,
      releaseInhibitedZones: impairedZones.slice(), facpComms: 'OK', lastPollTick: tick, pointsTotal: points.length, halls: inv.geometry.halls
    };
    var ctxZones = {}, ctxPoints = {};
    zones.forEach(function (z) { ctxZones[z.id] = { state: z.state, impaired: z.impaired, releaseInhibited: z.releaseInhibited, meansAvailable: z.meansAvailable, meansTotal: z.meansTotal, isolatedCount: z.isolatedCount, fireWatch: z.fireWatch }; });
    points.forEach(function (p) { ctxPoints[p.id] = { state: p.state, isolation: p.isolation }; });
    var ctxFire = { zoneId: fire && fire.zoneId ? fire.zoneId : null, eventId: fire && fire.eventId ? fire.eventId : null, stage: stage, elapsedSeconds: elapsed, zones: ctxZones, points: ctxPoints, summary: summary, tick: tick };
    /* rows the C&E engine may inhibit (release / discharged / EPO rows are non-inhibitable by the engine's own rule —
       an impaired zone reaches them through the `inhibited` release interlock instead) */
    var runtimeUpdates = impairedZones.length ? { 'CE-SUPPRESSION-ARMED': { inhibited: true, currentState: 'inhibited' } } : {};
    var eventZoneImpaired = fire && fire.zoneId && zoneInfo[fire.zoneId] ? zoneInfo[fire.zoneId].releaseInhibited : false;
    var interlocks = {
      confirmedFire: stage === 'confirmed' || stage === 'suppression_armed' || stage === 'discharged' || stage === 'lockout',
      abortActive: !!(fire && fire.eventId === 'suppression_abort'),
      inhibited: !!eventZoneImpaired,
      enclosureIsolated: stage === 'suppression_armed' || stage === 'discharged' || stage === 'lockout',
      releaseCircuitReady: !eventZoneImpaired && stage !== 'lockout',
      preDischargeWarningComplete: (stage === 'suppression_armed' && elapsed >= RELEASE_DELAY_S) || stage === 'discharged' || stage === 'lockout'
    };
    /* derived records: idempotent ids keyed by cause and causing tick */
    var derived = [], seqBase = tick * 100;
    function derivedRecord(code, key, fields) {
      var rec = nextRecord({ sequence: seqBase + derived.length }, tick, fields).record;
      rec.id = 'FIRE-' + code + '-' + key; derived.push(rec);
    }
    zones.forEach(function (z) {
      if (!z.impaired) { return; }
      var key = z.id + '-' + z.impairedSinceTick, loc = 'DH-' + pad2(z.hall) + '/Z' + pad2(z.n) + ' ' + z.name;
      derivedRecord('ZI', key, { code: 'ZI', tag: z.id, point: 'ZONE', location: loc, severity: 'high', lifecycle: 'active_unack', previousState: 'protected', currentState: 'impaired', event: 'zone-impaired', action: 'fire-watch',
        message: 'Zone ' + z.name + ' has ' + z.meansAvailable + ' of ' + z.meansTotal + ' independent detection means (lost: ' + z.meansLost.join(', ') + ') — IMPAIRED, fire watch required', incidentId: 'IMP-' + key, asset: 'fire-zone:' + z.id, trigger: 'isolation', reset: 'restore-points' });
      derivedRecord('RI', key, { code: 'RI', tag: z.id, point: 'RELEASE', location: loc, severity: 'high', lifecycle: 'inhibited', previousState: 'armed', currentState: 'inhibited', event: 'release-inhibited', action: 'inhibit-release',
        message: 'Clean-agent release for ' + z.name + ' inhibited: below two detection means the double-interlock cannot be satisfied', incidentId: 'IMP-' + key, asset: 'fire-zone:' + z.id, trigger: 'isolation', reset: 'restore-points' });
    });
    points.forEach(function (p) {
      if (!p.isolation || !p.isolation.expired) { return; }
      var key = p.id + '-' + p.isolation.expiresAtTick;
      derivedRecord('EXP', key, { code: 'EXP', tag: p.id, location: locationOf(inv, inv.byId[p.id]), severity: 'high', lifecycle: 'active_unack', previousState: 'isolated', currentState: 'isolated', event: 'isolation-expired', action: 'restore-or-extend', operator: p.isolation.owner,
        message: p.label + ' isolation by ' + p.isolation.owner + ' expired at tick ' + p.isolation.expiresAtTick + ' and the point is still isolated — restore it or extend with a reason', incidentId: 'ISO-' + p.id + '-' + p.isolation.isolatedAtTick, asset: 'fire-point:' + p.id, trigger: 'expiry', reset: 'restore' });
    });
    if (summary.fireWatch) {
      var fwSince = Math.min.apply(null, zones.filter(function (z) { return z.impaired; }).map(function (z) { return z.impairedSinceTick; }).concat(points.filter(function (p) { return p.isolation && p.isolation.expired; }).map(function (p) { return p.isolation.expiresAtTick; })));
      derivedRecord('FW', 'FACILITY-' + fwSince, { code: 'FW', tag: 'FIRE-WATCH', point: 'FACILITY', location: 'facility', severity: 'high', lifecycle: 'active_unack', previousState: 'normal', currentState: 'fire-watch', event: 'fire-watch-raised', action: 'fire-watch',
        message: 'Fire watch required: ' + impairedZones.length + ' impaired zone(s), ' + expiredIsolations.length + ' expired isolation(s)', incidentId: 'FW-' + fwSince, asset: 'fire-facility', trigger: 'isolation', reset: 'restore-points' });
    }
    if (fire && fire.eventId && stage !== 'normal') {
      var fkey = fire.eventId + '-' + fire.zoneId + '-' + fire.startedAtTick;
      derivedRecord('STG', fkey, { code: 'STG', tag: String(fire.zoneId), point: 'STAGE', location: String(fire.zoneId), severity: stage === 'prealarm' || stage === 'leak_wet' ? 'high' : 'critical', lifecycle: 'active_unack', previousState: 'normal', currentState: stage,
        event: 'fire-stage', action: 'cause-effect-' + fire.eventId, message: 'Training scenario ' + fire.eventId + ' in ' + fire.zoneId + ' — stage ' + stage + ' (SIMULATED, no command leaves the page)', incidentId: 'RUN-' + fkey, asset: 'fire-zone:' + fire.zoneId, trigger: 'training', reset: 'stop-run' });
    }
    return deepFreeze({ version: VERSION, tick: tick, elapsedSeconds: elapsed, stage: stage, fire: fire ? clone(fire) : null, points: points, zones: zones, summary: summary, ctxFire: ctxFire,
      runtimeUpdates: runtimeUpdates, interlocks: interlocks, derivedRecords: derived, declared: declare('summary') });
  }

  /* ------------------------------------------------------------------------
   * 4. Persistence helpers (the page decides where; the module decides what is valid)
   * ---------------------------------------------------------------------- */
  function serialize(reg) { return JSON.stringify({ version: reg.version, sequence: reg.sequence, entries: reg.entries }); }
  function deserialize(json, inv) {
    var o;
    try { o = JSON.parse(json); } catch (e) { return null; }
    if (!o || o.version !== 1 || !finite(o.sequence) || o.sequence < 1000 || !o.entries || typeof o.entries !== 'object') { return null; }
    var entries = {}, ids = Object.keys(o.entries), i;
    for (i = 0; i < ids.length; i++) {
      var e = o.entries[ids[i]];
      if (!e || e.pointId !== ids[i] || (inv && !inv.byId[ids[i]]) || !finite(e.isolatedAtTick) || !finite(e.expiresAtTick) || !expiryOf(e.expiryId) || OWNERS.indexOf(e.owner) < 0 || typeof e.reason !== 'string') { return null; }
      entries[ids[i]] = { pointId: e.pointId, owner: e.owner, reason: e.reason, isolatedAtTick: e.isolatedAtTick, expiryId: e.expiryId, expiresAtTick: e.expiresAtTick, extensions: finite(e.extensions) ? e.extensions : 0, acknowledgedConsequence: !!e.acknowledgedConsequence };
    }
    return deepFreeze({ version: 1, sequence: Math.floor(o.sequence), entries: entries });
  }

  var API = deepFreeze({
    version: VERSION, TICK_MS: TICK_MS, EPOCH: EPOCH, SPACING: SPACING, MEANS: MEANS, ZONE_TEMPLATE: ZONE_TEMPLATE, TYPES: TYPES, STATES: STATES, STAGES: STAGES,
    EXPIRY_OPTIONS: EXPIRY_OPTIONS, OWNERS: OWNERS, REFUSALS: REFUSALS, AGENT_LABEL: AGENT_LABEL, STAGE_OF_EVENT: STAGE_OF_EVENT, MAX_EXTENSIONS: MAX_EXTENSIONS, MIN_REASON: MIN_REASON,
    buildInventory: buildInventory, createRegister: createRegister, previewIsolate: previewIsolate, isolate: isolate, restore: restore, extend: extend,
    evaluate: evaluate, meansOf: meansOf, stageOf: stageOf, facpInAlarm: facpInAlarm, isoFromTick: isoFromTick, serialize: serialize, deserialize: deserialize, declare: declare
  });
  if (root) { root.RZDatahallAIFirePoints = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
