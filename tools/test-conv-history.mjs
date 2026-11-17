#!/usr/bin/env node
/* test-conv-history.mjs — js/conv/history.js (PRD-CONV-LIVING-PLANT §7 laws T3-T5 at the data layer). node --test
   H1 same (point, minute) -> same value, on every call; two points differ
   H2 the series stays inside base ± 1.12 × amp; flat shape with amp 0 = base exactly
   H3 series: count = window / step, timestamps ascending and on the step grid
   H4 stats and aboveLimit recomputed by hand on a window
   H5 csv: 1 header + one row per timestamp; header carries unit and SIM/ENGINE; a comma in a label is quoted
   H6 the daily load shape peaks in the local afternoon and bottoms at night
   H7 no random draw / clock read in the module */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = createRequire(import.meta.url)(path.join(ROOT, 'js/conv/history.js'));
const A = { id: 'chiller:ch1:chws', base: 19.4, amp: 0.3, digits: 1, shape: 'load' };
const B = { id: 'chiller:ch2:chws', base: 19.4, amp: 0.3, digits: 1, shape: 'load' };
const M0 = 29_700_000;   /* a fixed minute */

test('H1 deterministic and per-point', () => {
  assert.equal(H.value(A, M0), H.value(A, M0));
  assert.deepEqual(H.series(A, M0, M0 + 600, 1), H.series(A, M0, M0 + 600, 1));
  const a = H.series(A, M0, M0 + 600, 1), b = H.series(B, M0, M0 + 600, 1);
  assert.ok(a.some((p, i) => p.v !== b[i].v), 'two points are not copies');
});
test('H2 bounded', () => {
  for (const p of H.series(A, M0, M0 + 1440 * 7, 7)) assert.ok(Math.abs(p.v - 19.4) <= 0.3 * 1.12 + 0.006, String(p.v));
  assert.equal(H.value({ id: 'x', base: 5, amp: 0, shape: 'flat' }, M0), 5);
  assert.equal(H.value({ id: 'x' }, M0), null);
});
test('H3 grid', () => {
  const s = H.series(A, M0, M0 + 60, 5);
  assert.equal(s.length, 12);
  s.forEach((p, i) => { assert.equal(p.t % 300000, 0); if (i) assert.ok(p.t > s[i - 1].t); });
});
test('H4 stats by hand', () => {
  const s = H.series(A, M0, M0 + 120, 1), v = s.map((p) => p.v), st = H.stats(s);
  assert.equal(st.n, 120); assert.equal(st.min, Math.min(...v)); assert.equal(st.max, Math.max(...v));
  assert.ok(Math.abs(st.mean - v.reduce((a, b) => a + b, 0) / v.length) < 1e-9); assert.equal(st.last, v[v.length - 1]);
  assert.equal(H.aboveLimit(s, 19.4), v.filter((x) => x > 19.4).length / v.length);
  assert.deepEqual(H.stats([]), { n: 0, min: null, max: null, mean: null, last: null });
});
test('H5 csv', () => {
  const a = H.series(A, M0, M0 + 10, 1), b = H.series(B, M0, M0 + 10, 1);
  const text = H.csv([{ label: 'CH-01 CHW supply', unit: '°C', cls: 'SIM', points: a }, { label: 'CH-02, supply', unit: '°C', cls: 'ENGINE', points: b }]);
  const lines = text.trim().split('\n');
  assert.equal(lines.length, 11);
  assert.ok(lines[0].includes('CH-01 CHW supply [°C] (SIM)') && lines[0].includes('"CH-02, supply [°C] (ENGINE)"'));
  assert.equal(lines[1].split(',').length, 3);
});
test('H6 daily shape', () => {
  const day = Math.floor(M0 / 1440) * 1440, at = (hLocal) => H.value({ id: 'z', base: 100, amp: 10, digits: 2, shape: 'load' }, day + hLocal * 60 - 7 * 60);
  assert.ok(at(14) > at(8) && at(8) > at(2), `${at(2)} < ${at(8)} < ${at(14)}`);
});
test('H7 deterministic module', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/conv/history.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/new Date\(t\)/g, '');
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src));
});
