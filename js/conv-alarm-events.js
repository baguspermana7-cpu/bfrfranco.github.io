/* Conventional DC deterministic alarm/event contract. No DOM and no clock reads. */
(function (root) {
  'use strict';

  var SYSTEM_BY_PAGE = Object.freeze({
    'dc-conventional.html': '*',
    'epms_telemetry.html': 'electrical',
    'datahall.html': 'datahall',
    'chiller-plant.html': 'chiller',
    'fire-system.html': 'fire',
    'fuel-system.html': 'fuel',
    'water-system.html': 'water',
    'ict.html': 'ict'
  });
  var COMPARATORS = Object.freeze({ eq: true, ne: true, gt: true, gte: true, lt: true, lte: true });

  function copy(value) {
    var output;
    var keys;
    var i;
    if (Array.isArray(value)) {
      output = [];
      for (i = 0; i < value.length; i++) { output.push(copy(value[i])); }
      return output;
    }
    if (value && typeof value === 'object') {
      output = {};
      keys = Object.keys(value);
      for (i = 0; i < keys.length; i++) { output[keys[i]] = copy(value[keys[i]]); }
      return output;
    }
    return value;
  }

  function deepFreeze(value) {
    var keys;
    var i;
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) { return value; }
    keys = Object.keys(value);
    for (i = 0; i < keys.length; i++) { deepFreeze(value[keys[i]]); }
    return Object.freeze(value);
  }

  function event(values) {
    return {
      id: values.id,
      timestamp: values.timestamp,
      sequence: values.sequence,
      tag: values.tag,
      point: values.point,
      location: values.location,
      system: values.system,
      severity: values.severity,
      lifecycle: values.lifecycle,
      kind: values.kind,
      value: values.value,
      unit: values.unit || '',
      previousState: values.previousState || '',
      currentState: values.currentState || '',
      quality: values.quality || 'simulated',
      event: values.event,
      action: values.action,
      scenario: 'Conventional DC historian training snapshot; not live state',
      operator: values.operator || 'SYSTEM',
      message: values.message,
      incidentId: values.incidentId,
      asset: values.asset || values.tag,
      source: values.source || 'CONV authored historian fixture; lifecycle captured at event time',
      runId: 'CONV-20260827',
      trigger: values.trigger || 'modeled condition',
      reset: values.reset || 'operator verification + normal feedback'
    };
  }

  var EVENTS = deepFreeze([
    event({ id: 'CV-E-001', timestamp: '2026-08-27T08:00:00.000Z', sequence: 1,
      tag: 'ATS-01-STATE', point: 'ATS-01', location: 'Hall A electrical room', system: 'electrical',
      severity: 'critical', lifecycle: 'active_unack', kind: 'discrete',
      previousState: 'normal', currentState: 'source_a_fail', event: 'source-loss', action: 'transfer-evaluate',
      incidentId: 'INC-E-01', message: 'Source A unavailable; ATS evaluates the proven alternate source.' }),
    event({ id: 'CV-E-002', timestamp: '2026-08-27T08:01:00.000Z', sequence: 2,
      tag: 'RMU-A03-I', point: 'FDR-A03', location: 'MV switchroom', system: 'electrical',
      severity: 'medium', lifecycle: 'returned_ack', kind: 'analog', value: 612, unit: 'A',
      event: 'current-high', action: 'load-review', incidentId: 'INC-E-02',
      message: 'Feeder current crossed the warning threshold and returned after load redistribution.' }),
    event({ id: 'CV-D-001', timestamp: '2026-08-27T09:10:00.000Z', sequence: 3,
      tag: 'RACK-A17-TEMP', point: 'RACK-A17', location: 'Hall A cold aisle 04', system: 'datahall',
      severity: 'high', lifecycle: 'active_ack', kind: 'analog', value: 28.4, unit: 'degC',
      event: 'rack-inlet-high', action: 'thermal-inspection', incidentId: 'INC-D-01', operator: 'operator.bagus',
      message: 'Rack inlet temperature is above the project target and recommended envelope.' }),
    event({ id: 'CV-D-002', timestamp: '2026-08-27T09:12:00.000Z', sequence: 4,
      tag: 'AISLE-C03-RH', point: 'AISLE-C03', location: 'Hall C cold aisle 03', system: 'datahall',
      severity: 'low', lifecycle: 'returned_ack', kind: 'analog', value: 63.2, unit: '%RH',
      event: 'humidity-deviation', action: 'trend-review', incidentId: 'INC-D-02',
      message: 'Relative humidity deviation returned within the project operating target.' }),
    event({ id: 'CV-C-001', timestamp: '2026-08-27T10:00:00.000Z', sequence: 5,
      tag: 'CHWP-02-DP', point: 'CHWP-02', location: 'Central chiller plant', system: 'chiller',
      severity: 'medium', lifecycle: 'active_unack', kind: 'analog', value: 94, unit: 'kPa',
      event: 'differential-pressure-high', action: 'pump-valve-review', incidentId: 'INC-C-01',
      message: 'Header differential pressure exceeds the modeled operating band.' }),
    event({ id: 'CV-C-002', timestamp: '2026-08-27T10:02:00.000Z', sequence: 6,
      tag: 'CH-03-MODE', point: 'CH-03', location: 'Central chiller plant', system: 'chiller',
      severity: 'info', lifecycle: 'maintenance', kind: 'discrete', previousState: 'standby', currentState: 'maintenance',
      event: 'maintenance-state', action: 'capacity-check', incidentId: 'INC-C-02',
      message: 'Standby chiller entered planned maintenance; verify N+1 available capacity.' }),
    event({ id: 'CV-F-001', timestamp: '2026-08-27T11:00:00.000Z', sequence: 7,
      tag: 'VESDA-A04-OBS', point: 'VESDA-A04', location: 'Hall A zone 04', system: 'fire',
      severity: 'high', lifecycle: 'active_unack', kind: 'analog', value: 0.031, unit: '%obs/m',
      event: 'vesda-alert', action: 'facp-investigate', incidentId: 'INC-F-01',
      message: 'VESDA obscuration crossed alert threshold; FACP owns cause-and-effect progression.' }),
    event({ id: 'CV-F-002', timestamp: '2026-08-27T11:01:00.000Z', sequence: 8,
      tag: 'PAV-B02-FBK', point: 'PAV-B02', location: 'Hall B pre-action zone', system: 'fire',
      severity: 'critical', lifecycle: 'returned_unack', kind: 'discrete', previousState: 'closed', currentState: 'open',
      event: 'valve-feedback', action: 'facp-reset-hold', incidentId: 'INC-F-02',
      message: 'Pre-action valve feedback changed during simulation; reset remains FACP-authorized.' }),
    event({ id: 'CV-U-001', timestamp: '2026-08-27T12:00:00.000Z', sequence: 9,
      tag: 'FUEL-LD-Z03', point: 'LEAK-Z03', location: 'Generator gallery zone 03', system: 'fuel',
      severity: 'critical', lifecycle: 'active_ack', kind: 'discrete', previousState: 'dry', currentState: 'wet',
      event: 'fuel-leak', action: 'isolate-transfer', incidentId: 'INC-U-01', operator: 'operator.bagus',
      message: 'Fuel leak zone is wet; transfer permissive removed pending physical inspection.' }),
    event({ id: 'CV-U-002', timestamp: '2026-08-27T12:03:00.000Z', sequence: 10,
      tag: 'FPS-01-DP', point: 'POLISH-FILTER', location: 'Bulk fuel treatment skid', system: 'fuel',
      severity: 'medium', lifecycle: 'active_unack', kind: 'analog', value: 0.82, unit: 'bar',
      event: 'polishing-dp-high', action: 'filter-service', incidentId: 'INC-U-02',
      message: 'Fuel polishing filter differential pressure is above the service threshold.' }),
    event({ id: 'CV-W-001', timestamp: '2026-08-27T13:00:00.000Z', sequence: 11,
      tag: 'FLT-201-DP', point: 'FLT-201', location: 'Water treatment room', system: 'water',
      severity: 'medium', lifecycle: 'active_unack', kind: 'analog', value: 0.86, unit: 'bar',
      event: 'filter-dp-high', action: 'backwash-evaluate', incidentId: 'INC-W-01',
      message: 'Water filter differential pressure crossed the modeled backwash threshold.' }),
    event({ id: 'CV-W-002', timestamp: '2026-08-27T13:02:00.000Z', sequence: 12,
      tag: 'P-302-RUN', point: 'P-302', location: 'Water treatment room', system: 'water',
      severity: 'high', lifecycle: 'returned_ack', kind: 'discrete', previousState: 'commanded', currentState: 'failed-to-run',
      event: 'pump-fail-to-run', action: 'standby-start', incidentId: 'INC-W-02',
      message: 'Duty pump failed to prove; standby pump start sequence completed.' }),
    event({ id: 'CV-I-001', timestamp: '2026-08-27T14:00:00.000Z', sequence: 13,
      tag: 'OT-GW-04-STATE', point: 'OT-GW-04', location: 'BMS OT core', system: 'ict',
      severity: 'high', lifecycle: 'active_unack', kind: 'discrete', previousState: 'online', currentState: 'unreachable',
      event: 'gateway-unreachable', action: 'path-failover', incidentId: 'INC-I-01',
      message: 'OT gateway heartbeat is unavailable; redundant path remains under evaluation.' }),
    event({ id: 'CV-I-002', timestamp: '2026-08-27T14:02:00.000Z', sequence: 14,
      tag: 'CORE-A-UPLINK', point: 'CORE-A', location: 'Network MDF', system: 'ict',
      severity: 'medium', lifecycle: 'active_ack', kind: 'analog', value: 82.6, unit: '%',
      event: 'uplink-utilization-high', action: 'capacity-review', incidentId: 'INC-I-02', operator: 'operator.bagus',
      message: 'Core uplink utilization exceeds the modeled warning threshold.' })
  ]);

  function trimmed(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  function add(filter, key, value) {
    var output;
    var keys;
    var i;
    if (value === '' || value === undefined || value === null) { return filter; }
    output = {};
    keys = Object.keys(filter);
    for (i = 0; i < keys.length; i++) { output[keys[i]] = filter[keys[i]]; }
    output[key] = value;
    return output;
  }

  function buildFilter(input) {
    var source = input || {};
    var filter = {};
    var from = trimmed(source.from);
    var to = trimmed(source.to);
    var point = trimmed(source.point);
    var comparator = trimmed(source.comparator);
    var numericValue = trimmed(source.value);
    var previousState = trimmed(source.previousState);
    var currentState = trimmed(source.currentState);
    var discrete = {};
    var parsedValue;
    if (from && to && Date.parse(from) > Date.parse(to)) {
      throw new Error('From date must not be after To date.');
    }
    filter = add(filter, 'from', from);
    filter = add(filter, 'to', to);
    if (point) { filter = add(filter, 'or', [{ tag: point }, { point: point }]); }
    filter = add(filter, 'system', trimmed(source.system));
    filter = add(filter, 'severity', trimmed(source.severity));
    filter = add(filter, 'lifecycle', trimmed(source.lifecycle));
    filter = add(filter, 'quality', trimmed(source.quality));
    filter = add(filter, 'event', trimmed(source.event));
    filter = add(filter, 'action', trimmed(source.action));
    filter = add(filter, 'text', trimmed(source.text));
    if (comparator || numericValue) {
      if (!COMPARATORS[comparator]) { throw new Error('Select a supported value comparator.'); }
      parsedValue = Number(numericValue);
      if (numericValue === '' || !isFinite(parsedValue)) { throw new Error('Comparator requires a finite numeric value.'); }
      filter = add(filter, 'analog', { operator: comparator, value: parsedValue });
    }
    if (previousState) { discrete.previous = previousState; }
    if (currentState) { discrete.current = currentState; }
    if (Object.keys(discrete).length) {
      if (filter.analog) { throw new Error('Value and discrete-state filters cannot target the same event record.'); }
      filter = add(filter, 'discrete', discrete);
    }
    return deepFreeze(copy(filter));
  }

  function systemForPath(pathname) {
    var clean = trimmed(pathname).toLowerCase().split('?')[0].split('#')[0];
    var page = clean.slice(clean.lastIndexOf('/') + 1);
    if (!Object.prototype.hasOwnProperty.call(SYSTEM_BY_PAGE, page)) { return null; }
    return SYSTEM_BY_PAGE[page] === '*' ? '' : SYSTEM_BY_PAGE[page];
  }

  function supportsPath(pathname) {
    var clean = trimmed(pathname).toLowerCase().split('?')[0].split('#')[0];
    var page = clean.slice(clean.lastIndexOf('/') + 1);
    return Object.prototype.hasOwnProperty.call(SYSTEM_BY_PAGE, page);
  }

  var API = Object.freeze({
    EVENTS: EVENTS,
    buildFilter: buildFilter,
    systemForPath: systemForPath,
    supportsPath: supportsPath,
    systems: Object.freeze(['electrical', 'datahall', 'chiller', 'fire', 'fuel', 'water', 'ict']),
    version: '1.0.0'
  });

  if (root) { root.RZConvAlarmEvents = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
