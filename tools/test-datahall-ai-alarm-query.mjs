import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.join(here, '..', 'js', 'datahall-ai', 'alarm-query.js');
const require = createRequire(import.meta.url);

let AlarmQuery = null;
let loadError = '';
try {
  AlarmQuery = require(modulePath);
} catch (error) {
  loadError = error instanceof Error ? error.message : String(error);
}

const skipWhenMissing = () => !AlarmQuery;

const EVENTS = Object.freeze([
  Object.freeze({
    id: 'EV-001', timestamp: '2026-08-26T20:00:00.000Z', sequence: 1,
    tag: 'PDU-A-01', point: 'LOAD_PCT', location: 'DH-01/RACK-01',
    system: 'electrical', severity: 'critical', lifecycle: 'active_unack',
    kind: 'analog', value: 92, unit: '%', quality: 'good',
    event: 'high-high', action: 'trip-feed-a', scenario: 'utility-a-fail',
    operator: 'system', message: 'Feed A overload detected', incidentId: 'INC-PWR-01'
  }),
  Object.freeze({
    id: 'EV-002', timestamp: '2026-08-26T20:00:05.000Z', sequence: 2,
    tag: 'PDU-A-01', point: 'LOAD_PCT', location: 'DH-01/RACK-01',
    system: 'electrical', severity: 'critical', lifecycle: 'active_ack',
    kind: 'analog', value: 93, unit: '%', quality: 'good',
    event: 'high-high', action: 'acknowledge', scenario: 'utility-a-fail',
    operator: 'bagus', message: 'Operator acknowledged Feed A overload', incidentId: 'INC-PWR-01'
  }),
  Object.freeze({
    id: 'EV-003', timestamp: '2026-08-26T20:01:00.000Z', sequence: 3,
    tag: 'LF-07', point: 'PACKET_LOSS', location: 'DH-01/MDF',
    system: 'network', severity: 'high', lifecycle: 'active_unack',
    kind: 'analog', value: 1.4, unit: '%', quality: 'uncertain',
    event: 'packet-loss-high', action: 'reroute', scenario: 'fabric-degraded',
    operator: 'system', message: 'Leaf uplink packet loss above limit', incidentId: 'INC-NET-01'
  }),
  Object.freeze({
    id: 'EV-004', timestamp: '2026-08-26T20:02:00.000Z', sequence: 4,
    tag: 'VESDA-Z03', point: 'FIRE_2', location: 'DH-01/ZONE-03',
    system: 'fire', severity: 'critical', lifecycle: 'active_unack',
    kind: 'discrete', previousState: 'NORMAL', currentState: 'ALARM', quality: 'good',
    event: 'fire-confirmed', action: 'cause-effect-stage-3', scenario: 'fire-zone-03',
    operator: 'system', message: 'Confirmed smoke in zone 03', incidentId: 'INC-FIRE-01'
  }),
  Object.freeze({
    id: 'EV-005', timestamp: '2026-08-26T20:03:00.000Z', sequence: 5,
    tag: 'PDU-A-01', point: 'LOAD_PCT', location: 'DH-01/RACK-01',
    system: 'electrical', severity: 'critical', lifecycle: 'returned_ack',
    kind: 'analog', value: 71, unit: '%', quality: 'good',
    event: 'return-to-normal', action: 'reset', scenario: 'utility-a-fail',
    operator: 'bagus', message: 'Feed A load returned to normal', incidentId: 'INC-PWR-01'
  }),
  Object.freeze({
    id: 'EV-006', timestamp: '2026-08-26T20:04:00.000Z', sequence: 6,
    tag: 'CDU-09', point: 'TCS_FLOW', location: 'DH-01/CDU-09',
    system: 'cooling', severity: 'medium', lifecycle: 'shelved',
    kind: 'analog', value: 0, unit: 'L/min', quality: 'stale',
    event: 'stale-telemetry', action: 'inspect-sensor', scenario: 'normal',
    operator: 'shift-b', message: 'CDU flow point stale for 90 seconds', incidentId: 'INC-TEL-01'
  })
]);

test('alarm-query module exists and exposes the public API', () => {
  assert.ok(AlarmQuery, `alarm-query.js failed to load: ${loadError}`);
  assert.equal(typeof AlarmQuery.query, 'function');
  assert.equal(typeof AlarmQuery.validateFilter, 'function');
  assert.equal(typeof AlarmQuery.firstOut, 'function');
  assert.equal(typeof AlarmQuery.groupBy, 'function');
  assert.equal(typeof AlarmQuery.prepareExport, 'function');
  assert.equal(typeof AlarmQuery.createFixture, 'function');
});

test('browser-global path attaches the same explicit API', { skip: skipWhenMissing() }, () => {
  assert.equal(existsSync(modulePath), true);
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(modulePath, 'utf8'), sandbox, { filename: 'alarm-query.js' });
  assert.equal(typeof sandbox.RZDataHallAlarmQuery.query, 'function');
});

test('fixture is deterministic and deeply immutable', { skip: skipWhenMissing() }, () => {
  const first = AlarmQuery.createFixture();
  const second = AlarmQuery.createFixture();
  assert.deepEqual(first, second);
  assert.ok(first.length >= 6);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first[0]), true);
});

test('inclusive From/To filtering returns chronological records', { skip: skipWhenMissing() }, () => {
  const result = AlarmQuery.query([...EVENTS].reverse(), {
    from: '2026-08-26T20:00:00.000Z',
    to: '2026-08-26T20:01:00.000Z'
  });
  assert.deepEqual(result.records.map((event) => event.id), ['EV-001', 'EV-002', 'EV-003']);
  assert.equal(result.total, 3);
});

test('tag, point, location, and system filters compose as implicit AND', { skip: skipWhenMissing() }, () => {
  const result = AlarmQuery.query(EVENTS, {
    tag: 'pdu-a-01', point: 'load_pct', location: 'dh-01/rack-01', system: 'electrical'
  });
  assert.deepEqual(result.records.map((event) => event.id), ['EV-001', 'EV-002', 'EV-005']);
});

test('severity and lifecycle accept scalar or array selectors', { skip: skipWhenMissing() }, () => {
  const result = AlarmQuery.query(EVENTS, {
    severity: ['critical', 'high'], lifecycle: ['active_unack', 'active_ack']
  });
  assert.deepEqual(result.records.map((event) => event.id), ['EV-001', 'EV-002', 'EV-003', 'EV-004']);
});

test('analog comparators support gte and inclusive between', { skip: skipWhenMissing() }, () => {
  const high = AlarmQuery.query(EVENTS, { analog: { operator: 'gte', value: 92 } });
  assert.deepEqual(high.records.map((event) => event.id), ['EV-001', 'EV-002']);

  const band = AlarmQuery.query(EVENTS, { analog: { operator: 'between', min: 70, max: 92 } });
  assert.deepEqual(band.records.map((event) => event.id), ['EV-001', 'EV-005']);
});

test('advanced selectors support outside, prefix, wildcard, and operational metadata', { skip: skipWhenMissing() }, () => {
  const extended = EVENTS.map((event, index) => Object.freeze({
    ...event,
    asset: index === 0 ? 'RACK-01-A' : 'OTHER',
    source: index === 0 ? 'EPMS' : 'BMS',
    runId: index === 0 ? 'RUN-42' : 'RUN-41',
    trigger: index === 0 ? 'HH-LOAD' : 'OTHER',
    reset: index === 0 ? 'MANUAL' : 'AUTO'
  }));
  assert.deepEqual(
    AlarmQuery.query(extended, { analog: { operator: 'outside', min: 2, max: 90 } }).records.map((e) => e.id),
    ['EV-001', 'EV-002', 'EV-003', 'EV-006']
  );
  assert.deepEqual(
    AlarmQuery.query(extended, {
      tag: { operator: 'prefix', value: 'PDU-' },
      asset: 'rack-01-a', source: 'epms', runId: 'run-42',
      trigger: 'hh-load', reset: 'manual'
    }).records.map((e) => e.id),
    ['EV-001']
  );
  assert.deepEqual(
    AlarmQuery.query(extended, { location: { operator: 'wildcard', value: 'DH-01/*DF' } }).records.map((e) => e.id),
    ['EV-003']
  );
});

test('discrete current and previous state filter the state transition', { skip: skipWhenMissing() }, () => {
  const result = AlarmQuery.query(EVENTS, {
    discrete: { previous: 'normal', current: 'alarm' }
  });
  assert.deepEqual(result.records.map((event) => event.id), ['EV-004']);
});

test('quality, event, action, scenario, operator, and text are queryable', { skip: skipWhenMissing() }, () => {
  assert.deepEqual(AlarmQuery.query(EVENTS, { quality: 'stale' }).records.map((e) => e.id), ['EV-006']);
  assert.deepEqual(AlarmQuery.query(EVENTS, { event: 'packet-loss-high' }).records.map((e) => e.id), ['EV-003']);
  assert.deepEqual(AlarmQuery.query(EVENTS, { action: 'acknowledge' }).records.map((e) => e.id), ['EV-002']);
  assert.deepEqual(AlarmQuery.query(EVENTS, { scenario: 'fire-zone-03' }).records.map((e) => e.id), ['EV-004']);
  assert.deepEqual(AlarmQuery.query(EVENTS, { operator: 'bagus' }).records.map((e) => e.id), ['EV-002', 'EV-005']);
  assert.deepEqual(AlarmQuery.query(EVENTS, { text: 'zone 03' }).records.map((e) => e.id), ['EV-004']);
});

test('nested AND/OR expressions remain deterministic', { skip: skipWhenMissing() }, () => {
  const filter = {
    and: [
      { lifecycle: 'active_unack' },
      { or: [{ system: 'electrical' }, { system: 'fire' }] },
      { severity: 'critical' }
    ]
  };
  const result = AlarmQuery.query(EVENTS, filter);
  assert.deepEqual(result.records.map((event) => event.id), ['EV-001', 'EV-004']);
});

test('validation rejects invalid dates, ranges, operators, fields, and empty groups', { skip: skipWhenMissing() }, () => {
  const invalid = AlarmQuery.validateFilter({
    from: '2026-08-27T00:00:00Z',
    to: '2026-08-26T00:00:00Z',
    unknownField: 'x',
    analog: { operator: 'approximately', value: 1 },
    or: []
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.code === 'DATE_RANGE'));
  assert.ok(invalid.errors.some((error) => error.code === 'UNKNOWN_FIELD'));
  assert.ok(invalid.errors.some((error) => error.code === 'ANALOG_OPERATOR'));
  assert.ok(invalid.errors.some((error) => error.code === 'EMPTY_GROUP'));
  assert.throws(() => AlarmQuery.query(EVENTS, { quality: 'invented' }), /Invalid alarm filter/);
  assert.equal(AlarmQuery.validateFilter({ from: '2026-02-30' }).valid, false);
});

test('nested filter schemas reject unknown cyclic payloads before copying', { skip: skipWhenMissing() }, () => {
  const selector = { operator: 'exact', value: 'PDU-01' };
  selector.extra = selector;
  const analog = { operator: 'between', min: 1, max: 2 };
  analog.extra = analog;
  const selectorValidation = AlarmQuery.validateFilter({ tag: selector });
  const analogValidation = AlarmQuery.validateFilter({ analog });
  assert.equal(selectorValidation.valid, false);
  assert.equal(analogValidation.valid, false);
  assert.ok(selectorValidation.errors.some((error) => error.code === 'UNKNOWN_SELECTOR_FIELD'));
  assert.ok(analogValidation.errors.some((error) => error.code === 'UNKNOWN_ANALOG_FIELD'));
  assert.throws(() => AlarmQuery.query(EVENTS, { tag: selector }), /Invalid alarm filter/);
});

test('event validation requires canonical timestamps, safe sequences, and unique IDs', { skip: skipWhenMissing() }, () => {
  const ambiguous = [{ ...EVENTS[0], timestamp: '08/26/2026 20:00', sequence: 'one' }];
  const impossibleDate = [{ ...EVENTS[0], timestamp: '2026-02-30T20:00:00.000Z' }];
  const oversized = [{ ...EVENTS[0], tag: 'X'.repeat(257) }];
  const duplicate = [EVENTS[0], { ...EVENTS[1], id: EVENTS[0].id }];
  const invalidEvent = AlarmQuery.validateEvents(ambiguous);
  assert.equal(invalidEvent.valid, false);
  assert.ok(invalidEvent.errors.some((error) => error.code === 'EVENT_TIMESTAMP'));
  assert.ok(invalidEvent.errors.some((error) => error.code === 'EVENT_SEQUENCE'));
  assert.ok(AlarmQuery.validateEvents(impossibleDate).errors.some((error) => error.code === 'EVENT_TIMESTAMP'));
  assert.ok(AlarmQuery.validateEvents(oversized).errors.some((error) => error.code === 'EVENT_FIELD_LENGTH'));
  assert.ok(AlarmQuery.validateEvents(duplicate).errors.some((error) => error.code === 'DUPLICATE_ID'));
});

test('first-out selects the earliest event in each incident with stable ordering', { skip: skipWhenMissing() }, () => {
  const first = AlarmQuery.firstOut(EVENTS, ['incidentId']);
  assert.deepEqual(first.map((event) => event.id), ['EV-001', 'EV-003', 'EV-004', 'EV-006']);
});

test('group keys cannot collide with object prototype names', { skip: skipWhenMissing() }, () => {
  const adversarial = Object.freeze([
    Object.freeze({ ...EVENTS[0], id: 'EV-PROTO-1', incidentId: 'constructor' }),
    Object.freeze({ ...EVENTS[3], id: 'EV-PROTO-2', incidentId: '__proto__' })
  ]);
  assert.deepEqual(
    AlarmQuery.firstOut(adversarial, ['incidentId']).map((event) => event.id),
    ['EV-PROTO-1', 'EV-PROTO-2']
  );
  assert.equal(AlarmQuery.groupBy(adversarial, ['incidentId']).length, 2);
});

test('group identity preserves tuples that share the same display join', { skip: skipWhenMissing() }, () => {
  const collision = Object.freeze([
    Object.freeze({ ...EVENTS[0], id: 'EV-TUPLE-1', system: 'a|b', location: 'c' }),
    Object.freeze({ ...EVENTS[1], id: 'EV-TUPLE-2', system: 'a', location: 'b|c' })
  ]);
  const groups = AlarmQuery.groupBy(collision, ['system', 'location']);
  assert.equal(groups.length, 2);
  assert.equal(new Set(groups.map((group) => group.key)).size, 2);
  assert.equal(groups[0].displayLabel, 'a|b|c');
  assert.equal(groups[1].displayLabel, 'a|b|c');
  assert.equal(AlarmQuery.firstOut(collision, ['system', 'location']).length, 2);
});

test('grouping returns stable operational summaries', { skip: skipWhenMissing() }, () => {
  const groups = AlarmQuery.groupBy(EVENTS, ['system', 'location']);
  const electrical = groups.find((group) => group.displayLabel === 'electrical|dh-01/rack-01');
  assert.ok(electrical);
  assert.equal(electrical.count, 3);
  assert.equal(electrical.firstOutId, 'EV-001');
  assert.equal(electrical.firstTimestamp, '2026-08-26T20:00:00.000Z');
  assert.equal(electrical.lastTimestamp, '2026-08-26T20:03:00.000Z');
  assert.deepEqual(electrical.severityCounts, { critical: 3 });
});

test('filtered export metadata is reproducible and contains first-out provenance', { skip: skipWhenMissing() }, () => {
  const options = Object.freeze({
    format: 'csv',
    generatedAt: '2026-08-26T21:30:00.000Z',
    requestedBy: 'bagus',
    fileStem: 'dc-ai-alarm-history',
    fields: Object.freeze(['timestamp', 'tag', 'point', 'severity', 'lifecycle', 'value']),
    firstOutBy: Object.freeze(['incidentId'])
  });
  const first = AlarmQuery.prepareExport(EVENTS, { system: 'electrical' }, options);
  const second = AlarmQuery.prepareExport(EVENTS, { system: 'electrical' }, options);

  assert.deepEqual(first, second);
  assert.equal(first.metadata.sourceCount, 6);
  assert.equal(first.metadata.filteredCount, 3);
  assert.equal(first.metadata.fileName, 'dc-ai-alarm-history.csv');
  assert.deepEqual(first.metadata.firstOutIds, ['EV-001']);
  assert.match(first.metadata.exportId, /^ALM-[0-9a-f]{8}$/);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.metadata), true);
  assert.equal(Object.isFrozen(first.records), true);
});

test('filtered export preserves source first-out even when onset is outside the time window', { skip: skipWhenMissing() }, () => {
  const exported = AlarmQuery.prepareExport(EVENTS, {
    from: '2026-08-26T20:00:04.000Z',
    to: '2026-08-26T20:00:06.000Z'
  }, {
    format: 'json', generatedAt: '2026-08-26T22:00:00.000Z',
    requestedBy: 'qa', firstOutBy: ['incidentId']
  });
  assert.equal(exported.metadata.filteredCount, 1);
  assert.deepEqual(exported.metadata.firstMatchingIds, ['EV-002']);
  assert.deepEqual(exported.metadata.firstOutIds, ['EV-001']);
});

test('unknown cyclic event payload is rejected before immutable copying', { skip: skipWhenMissing() }, () => {
  const cyclic = { ...EVENTS[0] };
  cyclic.unknownPayload = cyclic;
  const validation = AlarmQuery.validateEvents([cyclic]);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.code === 'UNKNOWN_EVENT_FIELD'));
  assert.throws(() => AlarmQuery.query([cyclic], {}), /Invalid alarm events/);

  const cyclicValue = { ...EVENTS[3] };
  cyclicValue.value = cyclicValue;
  const valueValidation = AlarmQuery.validateEvents([cyclicValue]);
  assert.equal(valueValidation.valid, false);
  assert.ok(valueValidation.errors.some((error) => error.code === 'EVENT_VALUE'));
  assert.throws(() => AlarmQuery.query([cyclicValue], {}), /Invalid alarm events/);
});

test('query and export never mutate caller-owned records or filters', { skip: skipWhenMissing() }, () => {
  const inputSnapshot = JSON.stringify(EVENTS);
  const filter = Object.freeze({ and: Object.freeze([{ system: 'electrical' }, { severity: 'critical' }]) });
  const filterSnapshot = JSON.stringify(filter);

  const result = AlarmQuery.query(EVENTS, filter);
  AlarmQuery.prepareExport(EVENTS, filter, {
    format: 'json', generatedAt: '2026-08-26T21:45:00.000Z', requestedBy: 'qa'
  });

  assert.equal(JSON.stringify(EVENTS), inputSnapshot);
  assert.equal(JSON.stringify(filter), filterSnapshot);
  assert.notEqual(result.records, EVENTS);
  assert.equal(Object.isFrozen(result.records[0]), true);
});
