#!/usr/bin/env node
/**
 * test-datahall-ai-replay.mjs — PRD-P05 stage 1: replay a recorded trend file through the ONE simulated-reading seam.
 *
 *   R1 FR-P05-1 seam: with no provider, point()/series() are deep-equal (and JSON byte-equal) to the module's own output
 *      before setProvider existed; setProvider(null) after a replay restores them exactly (FR-P05-8 in Node)
 *   R2 a provider value replaces the seeded reading, printed at the caller's digits, quality 'replay'
 *   R3 FR-P05-6: a provider that knows the point but has no sample returns "—", never a simulated number
 *   R4 a provider that returns null for a point leaves that point simulated (seam contract)
 *   R5 FR-P05-2 CSV: RFC 4180 quoting (comma inside quotes), ';' delimiter with decimal comma, ISO + epoch time,
 *      blank cells skipped, the error names the line, a file without a time column asks for one, > 20 MB refused
 *   R6 FR-P05-2 JSON: long [{t,point,value}] and wide [{t,...}] shapes; a string value never becomes a number
 *   R7 FR-P05-4 time model: file time = start + (tick - startTick) x speed x 4 s; sample-and-hold, no
 *      interpolation; unsorted input sorted; a duplicate timestamp keeps the last row
 *   R8 automatic match by normalised name; unmatched columns listed
 *   R9 end to end in Node: a fixture with 2 mapped points equals the file at 3 cursor positions, factor applied
 *   R10 the replay core holds no network, eval, HTML sink, clock or die roll
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const Sim = require(`${ROOT}/js/datahall-ai/sim-telemetry.js`);
const Replay = require(`${ROOT}/js/datahall-ai/replay-core.js`);
const WIDE = readFileSync(`${ROOT}/tools/fixtures/replay/wide.csv`, 'utf8');
const LONG = readFileSync(`${ROOT}/tools/fixtures/replay/long.json`, 'utf8');

const SPECS = [
  { id: 'CDU-01', point: 'supply_c', anchor: 35, band: 0.6, tick: 4242, digits: 1 },
  { id: 'page', point: 'page3.cold', anchor: 24, band: 1, tick: 4242, digits: 1, min: 23, max: 25 },
  { id: 'UPS-A', point: 'soc', anchor: 98, band: 2, tick: 77, digits: 0 },
  { id: 'X', point: 'y', anchor: 1500, band: 30, tick: 1, digits: 0, period: 7 }
];
const snap = () => JSON.stringify(SPECS.map((s) => [Sim.point(s), Sim.series({ ...s, n: 5 })]));
const BASELINE = snap();

test('R1 seam: no provider = identical output; null restores it', () => {
  assert.equal(typeof Sim.setProvider, 'function', 'setProvider missing');
  Sim.setProvider(null);
  assert.equal(snap(), BASELINE);
  Sim.setProvider(() => ({ value: 1, quality: 'replay' }));
  assert.notEqual(snap(), BASELINE);
  Sim.setProvider(null);
  assert.equal(snap(), BASELINE);
  assert.throws(() => Sim.setProvider('nope'), /function or null/);
});

test('R2 provider value replaces the reading at the caller digits', () => {
  Sim.setProvider((req) => (req.id === 'CDU-01' && req.point === 'supply_c' ? { value: 35.249, quality: 'replay' } : null));
  try {
    const p = Sim.point(SPECS[0]);
    assert.equal(p.value, 35.2); assert.equal(p.text, '35.2'); assert.equal(p.quality, 'replay');
    assert.ok(Object.isFrozen(p));
    const big = Sim.point({ ...SPECS[3], id: 'CDU-01', point: 'supply_c' });
    assert.equal(big.text, '35');
  } finally { Sim.setProvider(null); }
});

test('R3 known point without a sample prints the dash, never a seeded number', () => {
  Sim.setProvider(() => ({ value: null, quality: 'replay', missing: true }));
  try {
    const p = Sim.point(SPECS[0]);
    assert.equal(p.value, null); assert.equal(p.text, '—'); assert.equal(p.quality, 'replay'); assert.equal(p.missing, true);
  } finally { Sim.setProvider(null); }
});

test('R4 provider null for a point leaves it simulated', () => {
  Sim.setProvider(() => null);
  try { assert.equal(snap(), BASELINE); } finally { Sim.setProvider(null); }
});

test('R5 CSV parser', () => {
  const r = Replay.parse(WIDE, { name: 'wide.csv' });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.delimiter, ';');
  assert.deepEqual(r.columns, ['CDU-01 supply temp', 'Chiller 1, leaving', 'unused col']);
  assert.equal(r.timeColumn, 'timestamp');
  assert.equal(r.zoned, false);
  const cdu = r.series['CDU-01 supply temp'];
  assert.deepEqual(Array.from(cdu.values), [35.2, 35.4, 35.9], 'decimal comma, sorted, duplicate keeps last');
  assert.equal(cdu.times.length, 3);
  assert.deepEqual(Array.from(r.series['Chiller 1, leaving'].values), [12.5, 12.9], 'blank cell skipped');
  const quoted = Replay.parse('time,"a, b",c\n1762178400,1,2\n1762178401,"3",4\n');
  assert.equal(quoted.ok, true); assert.deepEqual(quoted.columns, ['a, b', 'c']);
  assert.equal(quoted.series['a, b'].times[0], 1762178400000, 'epoch seconds -> ms');
  const bad = Replay.parse('time,a\n1762178400,1\n1762178401,"unterminated\n');
  assert.equal(bad.ok, false); assert.equal(bad.line, 3); assert.match(bad.message, /line 3/);
  const notNum = Replay.parse('time,a\n1762178400,abc\n');
  assert.equal(notNum.ok, false); assert.equal(notNum.line, 2);
  const noTime = Replay.parse('x,a\n5,1\n');
  assert.equal(noTime.ok, false); assert.equal(noTime.code, 'NO_TIME'); assert.deepEqual(noTime.candidates, ['x', 'a']);
  const picked = Replay.parse('x,a\n2026-11-03T14:00:00Z,1\n', { timeColumn: 'x' });
  assert.equal(picked.ok, true); assert.equal(picked.zoned, true);
  const huge = Replay.check({ size: 20 * 1024 * 1024 + 1, name: 'big.csv' });
  assert.equal(huge.ok, false); assert.match(huge.message, /20 MB/);
  assert.equal(Replay.check({ size: 10, name: 'a.txt' }).ok, false);
  assert.equal(Replay.check({ size: 10, name: 'a.CSV' }).ok, true);
});

test('R6 JSON parser', () => {
  const r = Replay.parse(LONG, { name: 'long.json' });
  assert.equal(r.ok, true, r.message); assert.equal(r.format, 'long');
  assert.deepEqual(Array.from(r.series['CDU-01 supply temp'].values), [35.2, 35.4]);
  const w = Replay.parse('[{"t":"2026-11-03T14:00:00Z","A":1,"B":"2"},{"t":"2026-11-03T14:00:04Z","A":2}]', { name: 'w.json' });
  assert.equal(w.ok, true); assert.equal(w.format, 'wide');
  assert.deepEqual(Array.from(w.series.A.values), [1, 2]);
  assert.equal(w.series.B, undefined, 'a string is not a number');
  const broken = Replay.parse('[{"t":1,', { name: 'x.json' });
  assert.equal(broken.ok, false); assert.equal(typeof broken.line, 'number');
});

test('R7 time model', () => {
  const clock = { startTick: 100, startMs: 1000, speed: 10 };
  assert.equal(Replay.fileTime(100, clock), 1000);
  assert.equal(Replay.fileTime(103, clock), 1000 + 3 * 10 * 4000);
  const s = { times: Float64Array.from([10, 20, 30]), values: Float64Array.from([1, 2, 3]) };
  assert.equal(Replay.valueAt(s, 9), null, 'before the first sample');
  assert.equal(Replay.valueAt(s, 10), 1);
  assert.equal(Replay.valueAt(s, 29.9), 2, 'hold, no interpolation');
  assert.equal(Replay.valueAt(s, 1e9), 3);
});

test('R8 automatic match', () => {
  const m = Replay.autoMatch(['CDU-01 supply temp', 'cdu_01.return', 'nothing'],
    [{ key: 'CDU-01|supply_temp', label: 'CDU-01 supply temp' }, { key: 'CDU-01|return', label: 'CDU 01 return' }]);
  assert.deepEqual(m.mapping, { 'CDU-01 supply temp': { point: 'CDU-01|supply_temp', factor: 1 }, 'cdu_01.return': { point: 'CDU-01|return', factor: 1 } });
  assert.deepEqual(m.unmatched, ['nothing']);
});

test('R9 end to end: provider equals the file at 3 cursor positions', () => {
  const r = Replay.parse(WIDE, { name: 'wide.csv' });
  const t0 = r.start;
  let cursor = t0;
  const prov = Replay.makeProvider({
    series: r.series,
    mapping: { 'CDU-01 supply temp': { point: 'CDU-01|supply_c', factor: 1 }, 'Chiller 1, leaving': { point: 'CH-01|lwt_c', factor: 2 } },
    known: ['CDU-01|supply_c', 'CH-01|lwt_c', 'CDU-01|rpm'],
    cursor: () => cursor
  });
  Sim.setProvider(prov);
  try {
    const read = (id, pt) => Sim.point({ id, point: pt, anchor: 0, band: 1, digits: 1 }).value;
    const cases = [[0, 35.2, 25], [4000, 35.4, 25], [8000, 35.9, 25.8]];
    for (const [dt, cdu, ch] of cases) {
      cursor = t0 + dt;
      assert.equal(read('CDU-01', 'supply_c'), cdu, `CDU at +${dt}`);
      assert.equal(read('CH-01', 'lwt_c'), ch, `chiller at +${dt}`);
      assert.equal(Sim.point({ id: 'CDU-01', point: 'rpm', anchor: 0, band: 1 }).text, '—', 'known, unmapped');
    }
    assert.notEqual(Sim.point({ id: 'other', point: 'x', anchor: 5, band: 1 }).quality, 'replay', 'unknown point stays simulated');
  } finally { Sim.setProvider(null); }
  assert.equal(snap(), BASELINE);
  const strict = Replay.makeProvider({ series: r.series, mapping: {}, known: [], strict: true, cursor: () => t0 });
  Sim.setProvider(strict, { source: 'wide.csv' });
  try {
    assert.equal(Sim.point({ id: 'other', point: 'x', anchor: 5, band: 1 }).text, '\u2014', 'strict: nothing simulated silently');
    assert.equal(Sim.providerInfo().source, 'wide.csv');
  } finally { Sim.setProvider(null); }
  assert.equal(Sim.providerInfo(), null);
});

test('R10 replay core is inert: no network, eval, HTML sink, clock or die roll', () => {
  const src = readFileSync(`${ROOT}/js/datahall-ai/replay-core.js`, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  for (const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/, /\beval\s*\(/, /new Function/, /innerHTML/, /insertAdjacentHTML/, /Math\.random/, /Date\.now/]) {
    assert.doesNotMatch(src, re);
  }
});
