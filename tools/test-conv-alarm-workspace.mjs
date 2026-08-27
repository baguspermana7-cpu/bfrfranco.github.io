import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import alarmQuery from '../js/datahall-ai/alarm-query.js';
import alarmContract from '../js/conv-alarm-events.js';

const repo = new URL('../', import.meta.url);
const workspaceSource = await readFile(new URL('js/conv-alarm-workspace.js', repo), 'utf8');

test('Conventional alarm fixture is valid, immutable, and covers every subsystem', () => {
  const validation = alarmQuery.validateEvents(alarmContract.EVENTS);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(Object.isFrozen(alarmContract.EVENTS), true);
  assert.equal(Object.isFrozen(alarmContract.EVENTS[0]), true);
  assert.deepEqual(
    [...new Set(alarmContract.EVENTS.map((event) => event.system))].sort(),
    ['chiller', 'datahall', 'electrical', 'fire', 'fuel', 'ict', 'water']
  );
  assert.ok(alarmContract.EVENTS.every((event) => /not live state/.test(event.scenario)));
  assert.ok(alarmContract.EVENTS.every((event) => /captured at event time/.test(event.source)));
});

test('workspace labels capture-time lifecycle and isolates/restores background interaction', () => {
  assert.match(workspaceSource, /Lifecycle at capture/);
  assert.match(workspaceSource, /active-at-capture/);
  assert.match(workspaceSource, /setBackgroundInert\(true\)/);
  assert.match(workspaceSource, /setBackgroundInert\(false\)/);
  assert.match(workspaceSource, /state\.item\.removeAttribute\('inert'\)/);
  assert.match(workspaceSource, /state\.ariaHidden === null/);
});

test('historian table exposes a caption and scoped column headers', () => {
  assert.match(workspaceSource, /Conventional DC alarm and event historian results/);
  assert.match(workspaceSource, /caption\.className = 'rz-conv-alarm-visually-hidden'/);
  assert.match(workspaceSource, /heading\.scope = 'col'/);
});

test('date, point, severity, lifecycle, quality, text, and analog filters compose', () => {
  const analogFilter = alarmContract.buildFilter({
    from: '2026-08-27',
    to: '2026-08-27',
    system: 'datahall',
    point: 'RACK-A17',
    severity: 'high',
    lifecycle: 'active_ack',
    quality: 'simulated',
    text: 'rack inlet',
    comparator: 'gt',
    value: '27'
  });
  const analogResult = alarmQuery.query(alarmContract.EVENTS, analogFilter);
  assert.equal(analogResult.total, 1);
  assert.equal(analogResult.records[0].tag, 'RACK-A17-TEMP');
  assert.equal(analogResult.records[0].value, 28.4);
});

test('previous and current discrete-state filters compose', () => {
  const stateFilter = alarmContract.buildFilter({
    system: 'electrical',
    point: 'ATS-01',
    previousState: 'normal',
    currentState: 'source_a_fail'
  });
  const stateResult = alarmQuery.query(alarmContract.EVENTS, stateFilter);
  assert.equal(stateResult.total, 1);
  assert.equal(stateResult.records[0].tag, 'ATS-01-STATE');
});

test('empty filter values are omitted and caller input is not mutated', () => {
  const input = Object.freeze({
    system: 'fuel', point: '', severity: '', comparator: '', value: ''
  });
  const filter = alarmContract.buildFilter(input);
  assert.deepEqual(filter, { system: 'fuel' });
  assert.deepEqual(input, { system: 'fuel', point: '', severity: '', comparator: '', value: '' });
});

test('invalid date range and comparator values fail before query execution', () => {
  assert.throws(
    () => alarmContract.buildFilter({ from: '2026-08-28', to: '2026-08-27' }),
    /From date must not be after To date/
  );
  assert.throws(
    () => alarmContract.buildFilter({ comparator: 'gt', value: 'not-a-number' }),
    /finite numeric value/
  );
});

test('page system mapping is explicit and unknown routes fail closed', () => {
  assert.equal(alarmContract.systemForPath('/EPMS_Telemetry.html'), 'electrical');
  assert.equal(alarmContract.systemForPath('/chiller-plant.html'), 'chiller');
  assert.equal(alarmContract.systemForPath('/fire-system.html'), 'fire');
  assert.equal(alarmContract.systemForPath('/fuel-system.html'), 'fuel');
  assert.equal(alarmContract.systemForPath('/water-system.html'), 'water');
  assert.equal(alarmContract.systemForPath('/datahall.html'), 'datahall');
  assert.equal(alarmContract.systemForPath('/ict.html'), 'ict');
  assert.equal(alarmContract.systemForPath('/dc-conventional.html'), '');
  assert.equal(alarmContract.supportsPath('/dc-conventional.html'), true);
  assert.equal(alarmContract.systemForPath('/index.html'), null);
});

test('export metadata preserves source/quality/lifecycle fields and safe provenance', () => {
  const prepared = alarmQuery.prepareExport(
    alarmContract.EVENTS,
    { system: 'fuel' },
    {
      format: 'csv',
      generatedAt: '2026-08-27T12:00:00.000Z',
      requestedBy: 'Conventional DC operator',
      fileStem: 'conventional-alarm-history'
    }
  );
  assert.ok(prepared.records.length >= 2);
  for (const field of ['timestamp', 'tag', 'point', 'value', 'unit', 'lifecycle', 'quality', 'source']) {
    assert.ok(prepared.metadata.fields.includes(field));
  }
  assert.match(prepared.metadata.exportId, /^ALM-[a-f0-9]{8}$/);
});

test('all Conventional subsystem pages load the common alarm query and workspace', async () => {
  const pages = [
    'dc-conventional.html', 'EPMS_Telemetry.html', 'datahall.html', 'chiller-plant.html', 'fire-system.html',
    'fuel-system.html', 'water-system.html', 'ict.html'
  ];
  for (const page of pages) {
    const html = await readFile(new URL(page, repo), 'utf8');
    assert.match(html, /css\/rz-conv-alarm-workspace\.css/, `${page} missing workspace CSS`);
    assert.match(html, /js\/datahall-ai\/alarm-query\.js/, `${page} missing query core`);
    assert.match(html, /js\/conv-alarm-events\.js/, `${page} missing event contract`);
    assert.match(html, /js\/conv-alarm-workspace\.js/, `${page} missing workspace UI`);
  }
});
