#!/usr/bin/env node
/* test-conv-vfx-core.mjs — the pure laws of js/conv/vfx.js (PRD-CONV-LIVING-PLANT §3, §5). node --test
   V1 state: unavailable beats everything; a critical alarm is red even when stopped; a stopped line is never "warning"
   V2 flow: no flow -> no motion; speed ratio between two lines = their flow ratio inside the clamp; clamp 0.2..3.0 m/s
   V3 rotor: stopped or < 5 % does not turn; period is inversely proportional to speed
   V4 thermal: cold end blue, warm end red, monotonic in red; out of range clamps; no number -> null
   V5 no random draw and no clock read in the module */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V = createRequire(import.meta.url)(path.join(ROOT, 'js/conv/vfx.js'));

test('V1 state grammar', () => {
  assert.equal(V.edgeState('unavailable', '1', true), 'unavailable');
  assert.equal(V.edgeState('running', null, false), 'running');
  assert.equal(V.edgeState('running', '2', false), 'warning');
  assert.equal(V.edgeState('running', '1', false), 'alarm');
  assert.equal(V.edgeState('stopped', '1', false), 'alarm');
  assert.equal(V.edgeState('stopped', '2', false), 'stopped');
  assert.equal(V.edgeState('stopped', null, true), 'mismatch');
  assert.equal(V.edgeState(null, null, false), 'unavailable');
  assert.equal(V.nodeState({ state: 'running' }), 'running');
  assert.equal(V.nodeState({ state: 'running', alarm: '2' }), 'warning');
  assert.equal(V.nodeState({ state: 'fault' }), 'alarm');
  assert.equal(V.nodeState({ state: 'standby' }), 'standby');
  assert.equal(V.nodeState({ state: 'stopped' }), 'stopped');
  assert.equal(V.nodeState({ state: 'running', quality: 'bad' }), 'unavailable');
  assert.equal(V.nodeState({ state: 'running', mismatch: true }), 'mismatch');
  assert.equal(V.nodeState({}), 'unavailable');
});

test('V2 flow speed follows flow', () => {
  for (const z of [0, -1, NaN, null, undefined]) assert.equal(V.dashSeconds(z), null);
  const a = V.dashSeconds(0.5), b = V.dashSeconds(1.0);
  assert.ok(Math.abs(a / b - 2) < 0.02, `half the flow -> twice the period (${a} vs ${b})`);
  assert.equal(V.dashSeconds(1), 0.5);                       /* 2.0 m/s -> 32 px/s -> 16 px in 0.5 s */
  assert.equal(V.dashSeconds(0.01), V.dashSeconds(0.1));     /* clamp at 0.2 m/s */
  assert.equal(V.dashSeconds(5), V.dashSeconds(1.5));        /* clamp at 3.0 m/s */
  assert.ok(V.dashSeconds(0.2) > V.dashSeconds(0.8));
});

test('V3 rotor', () => {
  for (const z of [0, 4.9, NaN, null]) assert.equal(V.rotorSeconds(z), null);
  assert.equal(V.rotorSeconds(100), 1);
  assert.equal(V.rotorSeconds(50), 2);
  assert.ok(V.rotorSeconds(85) < V.rotorSeconds(57));
});

test('V4 thermal ramp', () => {
  assert.equal(V.thermal(19.4, 19.4, 27), 'rgb(59,130,246)');
  assert.equal(V.thermal(27, 19.4, 27), 'rgb(239,68,68)');
  assert.equal(V.thermal(5, 19.4, 27), V.thermal(19.4, 19.4, 27));
  assert.equal(V.thermal(99, 19.4, 27), V.thermal(27, 19.4, 27));
  assert.equal(V.thermal(NaN, 19.4, 27), null);
  assert.equal(V.thermal(20, 27, 19.4), null);
  let last = -1;
  for (let t = 19.4; t <= 27; t += 0.4) { const r = +V.thermal(t, 19.4, 27).match(/\d+/)[0]; assert.ok(r >= last, 'red rises with temperature'); last = r; }
});

test('V5 deterministic module', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/conv/vfx.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src));
});

test('V6 standby: a charged line that holds pressure and moves no water', () => {
  assert.equal(V.edgeState('standby', null, false), 'standby');
  assert.equal(V.edgeState('standby', '2', false), 'warning', 'a warning at an end outranks standby');
  assert.equal(V.edgeState('standby', '1', false), 'alarm');
  assert.equal(V.edgeState('standby', null, true), 'mismatch');
  assert.equal(V.restState('stopped', true), 'standby');
  assert.equal(V.restState('stopped', false), 'stopped', 'not charged = stopped');
  assert.equal(V.restState('running', true), 'running', 'a moving line is never relabelled');
  assert.equal(V.restState('unavailable', true), 'unavailable', 'no data stays no data');
});
