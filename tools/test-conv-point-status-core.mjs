#!/usr/bin/env node
/**
 * test-conv-point-status-core.mjs — PRD-CONV-POINT-STATUS-TREND §7, the Node half of point status.
 *
 *   C1 classify     thresholds of §4.2 on the owner's TCS row (35 ok, 37.1 warn ▲, 40.1 alarm ◆, low side mirrored),
 *                   null value -> 'none', no limits -> 'info', null bounds never invent a state
 *   C2 deadband     a series oscillating ±0.1 around hi_warn / hi_alarm changes state once, not on every sample;
 *                   clearing follows hi_alarm − db and hi_warn − db exactly
 *   R1 registry     every row of data/conv-parameters.json `limits` (merged from data/conv-limits.curated.json):
 *                   schema data/conv-limits.schema.json, lo_alarm <= lo_warn < hi_warn <= hi_alarm, deadband > 0 and
 *                   smaller than half the normal band, unit + basis + source{ref, asOf} present, nominal inside the band,
 *                   ids unique, merged rows = curated rows
 *   P6 normal past  per row, a deliberately loud history (amp = the whole band) passed through
 *                   RZConvHistory.bounded() stays in the normal band >= 99 % of the 30-day window (1H..30D steps), for
 *                   every history shape
 *   T1 tooltip      "Name · value unit · State · warn … · alarm … unit · limits CLASS · Click for trend"
 *   RED planted     swapped bounds, a missing deadband (chatter), an unbounded amp that breaches — each must be caught
 *
 * Run: node --test tools/test-conv-point-status-core.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PS = require(join(ROOT, 'js', 'conv', 'point-status.js'));
const HIST = require(join(ROOT, 'js', 'conv', 'history.js'));
const registry = JSON.parse(readFileSync(join(ROOT, 'data', 'conv-parameters.json'), 'utf8'));
const curated = JSON.parse(readFileSync(join(ROOT, 'data', 'conv-limits.curated.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(ROOT, 'data', 'conv-limits.schema.json'), 'utf8'));
const ROWS = registry.limits || [];
PS.setLimits(ROWS);
const TCS = 'cdu-mini-bms.TT-01.supply_c';
const CLOCK_MIN = Math.floor(1795000000000 / 60000);   /* the clock the browser gates pin */
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/* ── checks, written as functions so the planted defects run through the same code ─────────────────────────────── */
function typeOk(v, t) { const l = Array.isArray(t) ? t : [t]; return l.some((x) => (x === 'null' ? v === null : x === 'number' ? isNum(v) : x === 'object' ? v && typeof v === 'object' : typeof v === x)); }
function schemaErrors(row) {
  const def = schema.definitions.limit, errs = [];
  for (const k of def.required) if (!Object.prototype.hasOwnProperty.call(row, k)) errs.push(`missing ${k}`);
  for (const k of Object.keys(row)) if (!def.properties[k]) errs.push(`unexpected key ${k}`);
  for (const [k, spec] of Object.entries(def.properties)) {
    if (!(k in row)) continue;
    if (spec.type && !typeOk(row[k], spec.type)) errs.push(`${k}: wrong type`);
    if (spec.enum && !spec.enum.includes(row[k])) errs.push(`${k}: ${row[k]} not in enum`);
    if (spec.pattern && !new RegExp(spec.pattern).test(row[k])) errs.push(`${k}: pattern`);
  }
  if (row.source && (!row.source.ref || !/^\d{4}-\d{2}-\d{2}$/.test(row.source.asOf || ''))) errs.push('source.ref / source.asOf');
  return errs;
}
function boundErrors(r) {
  const errs = [], order = [['lo_alarm', 'lo_warn'], ['lo_warn', 'hi_warn'], ['hi_warn', 'hi_alarm'], ['lo_alarm', 'hi_alarm'], ['lo_alarm', 'hi_warn'], ['lo_warn', 'hi_alarm']];
  for (const [a, b] of order) {
    if (!isNum(r[a]) || !isNum(r[b])) continue;
    const strict = a === 'lo_warn' && b === 'hi_warn';
    if (strict ? !(r[a] < r[b]) : !(r[a] <= r[b])) errs.push(`${a} ${r[a]} vs ${b} ${r[b]}`);
  }
  if (![r.lo_alarm, r.lo_warn, r.hi_warn, r.hi_alarm].some(isNum)) errs.push('no bound at all');
  if (!isNum(r.deadband) || r.deadband <= 0) errs.push('deadband missing or not > 0');
  const lo = isNum(r.lo_warn) ? r.lo_warn : r.lo_alarm, hi = isNum(r.hi_warn) ? r.hi_warn : r.hi_alarm;
  if (isNum(lo) && isNum(hi) && isNum(r.deadband) && r.deadband >= (hi - lo) / 2) errs.push(`deadband ${r.deadband} >= half the normal band`);
  if (!r.unit || !r.basis || !r.evidenceClass) errs.push('unit / basis / evidenceClass');
  const n = r.nominal && r.nominal.value;
  if (!isNum(n) || (isNum(lo) && n < lo) || (isNum(hi) && n > hi)) errs.push(`nominal ${n} outside the normal band`);
  return errs;
}
/* transitions of a replayed series */
function transitions(series, L) { let prev = null, n = 0; for (const v of series) { const ev = PS.evaluate(v, L, prev); if (prev && ev.state !== prev.state) n++; prev = ev; } return n; }
/* P-6: share of the 30D window inside the normal band */
function normalShare(L, def) {
  const [win, step] = HIST.RANGES['30D'], pts = HIST.series(def, CLOCK_MIN - win, CLOCK_MIN, step);
  let prev = null, ok = 0;
  for (const p of pts) { const ev = PS.evaluate(p.v, L, prev); if (ev.state === 'ok') ok++; prev = ev; }
  return { share: pts.length ? ok / pts.length : 0, n: pts.length };
}
function loudDef(L, shape) {
  const lo = isNum(L.lo_warn) ? L.lo_warn : L.lo_alarm, hi = isNum(L.hi_warn) ? L.hi_warn : L.hi_alarm;
  const span = isNum(lo) && isNum(hi) ? hi - lo : Math.abs(L.nominal.value) * 0.5 || 1;
  return { id: L.id, base: L.nominal.value, amp: span, shape, digits: 2 };
}

test('C1 classify: thresholds, low side, null value, no limits, null bounds', () => {
  const L = PS.limits(TCS);
  assert.ok(L, `registry has the TCS row ${TCS} (OD-3)`);
  assert.deepEqual([L.hi_warn, L.hi_alarm, L.lo_warn, L.lo_alarm, L.deadband], [37, 40, 18, 15, 0.3], 'TCS row = PRD §4.2 / OD-3');
  const cases = [[35, 'ok', null], [37, 'ok', null], [37.1, 'warn', 'hi'], [40, 'warn', 'hi'], [40.1, 'alarm', 'hi'], [18, 'ok', null], [17.9, 'warn', 'lo'], [14.9, 'alarm', 'lo']];
  for (const [v, st, dir] of cases) {
    const ev = PS.evaluate(v, L, null);
    assert.equal(ev.state, st, `${v} °C -> ${st}`); assert.equal(ev.dir, dir, `${v} °C dir ${dir}`);
    assert.equal(PS.classify(v, L, null), st);
  }
  assert.equal(PS.classify(null, L), 'none'); assert.equal(PS.classify(NaN, L), 'none');
  assert.equal(PS.classify(35, null), 'info');
  const onlyHiWarn = { hi_warn: 10, deadband: 0.1 }, onlyLoAlarm = { lo_alarm: 5, deadband: 0.1 };
  assert.equal(PS.classify(1e9, onlyHiWarn), 'warn', 'no alarm bound: never alarm');
  assert.equal(PS.classify(-1e9, onlyHiWarn), 'ok', 'no low bound: never low');
  assert.equal(PS.classify(4.9, onlyLoAlarm), 'alarm'); assert.equal(PS.classify(1e9, onlyLoAlarm), 'ok');
});

test('C2 deadband: no chatter at a threshold, clearing at limit − deadband', () => {
  const L = PS.limits(TCS);
  const wobble = (c, sign = 1) => Array.from({ length: 200 }, (_, i) => c + sign * (i % 2 ? 0.1 : -0.1));   /* starts on the normal side */
  assert.equal(transitions(wobble(37), L), 1, '±0.1 around hi_warn: one change (ok -> warn), then held');
  assert.equal(transitions(wobble(40), L), 1, '±0.1 around hi_alarm: one change (warn -> alarm), then held');
  assert.equal(transitions(wobble(18, -1), L), 1, '±0.1 around lo_warn: one change');
  const alarm = { state: 'alarm', dir: 'hi' }, warn = { state: 'warn', dir: 'hi' };
  assert.equal(PS.classify(39.75, L, alarm), 'alarm', 'alarm held at hi_alarm − db + 0.05');
  assert.equal(PS.classify(39.65, L, alarm), 'warn', 'back to warn below hi_alarm − db');
  assert.equal(PS.classify(36.75, L, warn), 'warn', 'warn held at hi_warn − db + 0.05');
  assert.equal(PS.classify(36.65, L, warn), 'ok', 'normal below hi_warn − db');
  assert.equal(PS.classify(36.75, L, 'ok'), 'ok', 'from normal the deadband does not apply');
});

test('R1 registry rows: schema, bound order, deadband, unit/basis/source, nominal, merged = curated', () => {
  assert.ok(ROWS.length >= 19, `limits rows in the registry: ${ROWS.length}`);
  const ids = new Set();
  for (const r of ROWS) {
    assert.ok(!ids.has(r.id), `duplicate ${r.id}`); ids.add(r.id);
    assert.deepEqual(schemaErrors(r), [], `${r.id} schema`);
    assert.deepEqual(boundErrors(r), [], `${r.id} bounds`);
  }
  const byId = (a) => [...a].sort((x, y) => x.id.localeCompare(y.id));
  assert.deepEqual(byId(ROWS), byId(curated.rows), 'data/conv-parameters.json limits = data/conv-limits.curated.json rows (rebuild the registry)');
  for (const need of [TCS, 'environment.avg_temp_c', 'cooling.crah_supply_air_c', 'cooling.chws_c', 'cooling.cdw_supply_c', 'electrical.ups_load_pct_normal', 'fuel-system.GEN.load_pct', 'fuel-system.DT.level_pct', 'fire.static_pressure_bar']) {
    assert.ok(ids.has(need), `required row ${need} (task scope)`);
  }
  for (const r of ROWS.filter((x) => x.evidenceClass === 'STANDARD')) assert.match(r.source.ref, /read \d{4}-\d{2}-\d{2}/, `${r.id}: a STANDARD row names the clause and the date it was read`);
});

test('P6 a normal plant has a normal past: 30D history inside the normal band >= 99 % per row', () => {
  assert.deepEqual(Object.keys(HIST.RANGES), ['1H', '8H', '1D', '7D', '30D']);
  assert.deepEqual(HIST.RANGES['30D'], [43200, 30], '30D at a 30-min step');
  for (const L of ROWS) for (const shape of HIST.SHAPES) {
    const def = HIST.bounded(loudDef(L, shape), L), { share, n } = normalShare(L, def);
    assert.equal(n, 1440, '30 days at 30 min');
    assert.ok(share >= 0.99, `${L.id} (${shape}) normal ${(share * 100).toFixed(2)} % < 99 %`);
  }
  const L = PS.limits(TCS), quiet = { id: TCS, base: 30, amp: 0.5, shape: 'load' };
  assert.equal(HIST.bounded(quiet, L).amp, 0.5, 'bounded() leaves an amp that already fits');
  assert.equal(HIST.bounded({ ...quiet, base: 41 }, L).amp, 0.5, 'an engine base outside the band is an engine breach: unchanged');
  assert.notEqual(HIST.bounded(quiet, L), quiet, 'bounded() returns a copy');
});

test('T1 tooltip text', () => {
  assert.equal(PS.tooltipText(TCS, 37.4, { digits: 1 }), 'TCS supply temperature (CDU TT-01) · 37.4 °C · Warning · warn 18 / 37 · alarm 15 / 40 °C · limits ASSUMED · Click for trend');
  assert.match(PS.tooltipText('electrical.ups_load_pct_normal', 37.5), /· Normal · warn 45 · alarm 50 % · limits ASSUMED/);
  assert.match(PS.tooltipText('no.such.point', 3), /· Informational · Click for trend$/);
});

test('RED planted defects are caught by the same checks', () => {
  const base = PS.limits(TCS);
  const swapped = { ...base, hi_warn: base.lo_warn, lo_warn: base.hi_warn };
  assert.ok(boundErrors(swapped).length > 0, 'swapped bounds must be reported');
  const { deadband, ...noDb } = base;
  assert.ok(schemaErrors(noDb).includes('missing deadband') && boundErrors(noDb).length > 0, 'a missing deadband must be reported');
  const wobble = Array.from({ length: 200 }, (_, i) => 37 + (i % 2 ? 0.1 : -0.1));
  assert.ok(transitions(wobble, { ...base, deadband: 0 }) > 100, 'without a deadband the same series chatters (the C2 law can fail)');
  const breaches = ROWS.filter((L) => normalShare(L, loudDef(L, 'load')).share < 0.99).length;
  assert.ok(breaches >= ROWS.length / 2, `an unbounded amp must breach (P6 can fail): ${breaches}/${ROWS.length} rows`);
});

/* ── T1b: explicit limits (define / fromSimple) and the database precedence (PRD §5b, §6) ─────────────────── */
test('D1 fromSimple: high, low, window; the order law throws', () => {
  const hi = PS.fromSimple({ warn: 80, alarm: 90, kind: 'high', label: 'GPU temp', unit: '°C', basis: 'vendor sheet' });
  assert.deepEqual([hi.lo_alarm, hi.lo_warn, hi.hi_warn, hi.hi_alarm], [null, null, 80, 90]);
  assert.equal(hi.label, 'GPU temp'); assert.equal(hi.basis, 'vendor sheet'); assert.ok(hi.deadband > 0);
  const lo = PS.fromSimple({ warn: 30, alarm: 20, kind: 'low', deadband: 0.5 });
  assert.deepEqual([lo.lo_alarm, lo.lo_warn, lo.hi_warn, lo.hi_alarm, lo.deadband], [20, 30, null, null, 0.5]);
  const w = PS.fromSimple({ warn: 27, alarm: 32, kind: 'window', lowWarn: 18, lowAlarm: 15 });
  assert.deepEqual([w.lo_alarm, w.lo_warn, w.hi_warn, w.hi_alarm], [15, 18, 27, 32]);
  assert.equal(PS.classify(28, w), 'warn'); assert.equal(PS.classify(14, w), 'alarm'); assert.equal(PS.classify(22, w), 'ok');
  assert.throws(() => PS.fromSimple({ warn: 90, alarm: 80, kind: 'high' }), /hi_warn 90 must be <= hi_alarm 80/);
  assert.throws(() => PS.fromSimple({ warn: 20, alarm: 30, kind: 'low' }), /lo_alarm 30 must be <= lo_warn 20/);
  assert.throws(() => PS.fromSimple({ warn: 27, alarm: 32, kind: 'window', lowWarn: 28 }), /lo_warn 28 must be < hi_warn 27/);
  assert.throws(() => PS.fromSimple({ kind: 'sideways', warn: 1 }), /kind/);
});

test('D2 precedence: database row > define() > registry; a database row never overrides a define() of a non-conv id', () => {
  PS.setLimits(ROWS);
  const reg = PS.limits(TCS);
  assert.equal(reg.hi_warn, 37);
  PS.define(TCS, PS.fromSimple({ warn: 36, alarm: 39, kind: 'high' }));
  assert.equal(PS.limits(TCS).hi_warn, 36, 'define() wins over the registry');
  PS.define('dcai.gpu.temp_c', PS.fromSimple({ warn: 80, alarm: 90, kind: 'high' }));
  assert.throws(() => PS.define('x.bad', { hi_warn: 5, hi_alarm: 4 }), /hi_warn 5 must be <= hi_alarm 4/);
  PS.setDbRows([
    { id: TCS, lo_alarm: 15, lo_warn: 18, hi_warn: 38, hi_alarm: 40, deadband: 0.3, evidence_class: 'ASSUMED', basis: 'db' },
    { id: 'dcai.gpu.temp_c', hi_warn: 1, hi_alarm: 2 },
    { id: 'cooling.chws_c', lo_alarm: 16.4, lo_warn: 25, hi_warn: 20.9, hi_alarm: 22.4, deadband: 0.1 },   /* bad order: skipped */
  ], 'database');
  assert.equal(PS.limits(TCS).hi_warn, 38, 'a database row wins over define() and the registry for a conv id');
  assert.equal(PS.limits(TCS).nominal.value, reg.nominal.value, 'the database row keeps the registry nominal');
  assert.equal(PS.limits('dcai.gpu.temp_c').hi_warn, 80, 'a database row never overrides a define() of a non-conv id');
  assert.equal(PS.limits('cooling.chws_c').lo_warn, 17.9, 'an invalid database row falls back to the registry');
  assert.ok(PS.dbIds()[TCS] && PS.dbIds()['cooling.chws_c']);
  assert.equal(PS.limitsSource(), 'database');
  PS.setDbRows([], 'shipped');
  assert.equal(PS.limits(TCS).hi_warn, 36);
});
