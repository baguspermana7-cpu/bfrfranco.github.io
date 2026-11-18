#!/usr/bin/env node
/* test-conv-air-section.mjs — the pure laws of js/conv/air-section.js (PRD-CONV-LIVING-PLANT §5.2). node --test
   A1 no airflow, or the CRAH not running -> no air motion, no fan rotation, no chilled-water motion, state "stopped"
   A2 streamline speed follows airflow: half the design airflow moves at half the speed (period doubles)
   A3 the fan period is inversely proportional to fan %; below 5 % it is still
   A4 colour is temperature: the hot side is redder and less blue than the cold side; a warmer hot aisle is redder
   A5 chilled water moves only with the valve open; CHWR is warmer-coloured than CHWS
   A6 rack tint follows row heat / design row heat; no design value -> no tint (never a guessed one)
   A7 inlet above the recommended maximum reads "warning", above the alarm limit "alarm"
   A8 no random draw and no clock read in the module */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
globalThis.RZConvVfx = req(path.join(ROOT, 'js/conv/vfx.js'));
const A = req(path.join(ROOT, 'js/conv/air-section.js'));
const base = { running: true, airflowM3s: 20, designAirflowM3s: 20, fanPct: 72, valvePct: 64, supplyC: 25.4, inletC: 25.4, hotC: 36.4, returnC: 36.4,
  chwsC: 19.4, chwrC: 27, heatKw: 300, designHeatKw: 400, warnC: 27, alarmC: 30 };
const m = (o) => A.model({ ...base, ...o });
const rgb = (s) => s.match(/\d+/g).map(Number);

test('A1 no airflow -> nothing moves', () => {
  for (const o of [{ airflowM3s: 0 }, { running: false }, { airflowM3s: null }]) {
    const r = m(o);
    assert.equal(r.airSeconds, null); assert.equal(r.rotorSeconds, null); assert.equal(r.chwSeconds, null); assert.equal(r.state, 'stopped');
  }
  assert.ok(m({}).airSeconds > 0);
});
test('A2 speed follows airflow', () => {
  const full = m({}).airSeconds, half = m({ airflowM3s: 10 }).airSeconds;
  assert.ok(Math.abs(half / full - 2) < 0.01, `half airflow period ${half} vs ${full}`);
});
test('A3 fan period inversely proportional to fan %', () => {
  assert.ok(Math.abs(m({ fanPct: 50 }).rotorSeconds / m({ fanPct: 100 }).rotorSeconds - 2) < 0.01);
  assert.equal(m({ fanPct: 3 }).rotorSeconds, null);
});
test('A4 colour is temperature', () => {
  const r = m({}); const c = rgb(r.cold), h = rgb(r.hot);
  assert.ok(h[0] > c[0] && h[2] < c[2], `hot ${r.hot} vs cold ${r.cold}`);
  assert.ok(rgb(m({ hotC: 39 }).hot)[1] < h[1], 'a warmer hot aisle is redder (less green)');
  assert.equal(m({ hotC: null }).hot, null);
});
test('A5 chilled water', () => {
  assert.equal(m({ valvePct: 0 }).chwSeconds, null);
  assert.ok(m({ valvePct: 30 }).chwSeconds > m({ valvePct: 90 }).chwSeconds);
  const r = m({}); assert.ok(rgb(r.chwr)[0] > rgb(r.chws)[0]);
});
test('A6 rack tint follows heat ratio', () => {
  assert.equal(m({}).heatRatio, 0.75);
  assert.ok(rgb(m({ heatKw: 400 }).rackTint)[0] > rgb(m({ heatKw: 100 }).rackTint)[0]);
  assert.equal(m({ designHeatKw: null }).rackTint, null);
});
test('A7 inlet state', () => {
  assert.equal(m({}).state, 'running'); assert.equal(m({ inletC: 27.6 }).state, 'warning'); assert.equal(m({ inletC: 30.4 }).state, 'alarm');
});
test('A8 no random, no clock', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/conv/air-section.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src));
});
