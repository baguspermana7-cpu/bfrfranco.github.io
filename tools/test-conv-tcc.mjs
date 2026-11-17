#!/usr/bin/env node
/* test-conv-tcc.mjs — js/conv/tcc.js (PRD-CONV-LIVING-PLANT §8.2 laws K1-K3 at the model layer). node --test
   K1  IEC 60255-151 check values at TMS 1, I/Is = 10: SI 2.971 s, VI 1.500 s, EI 0.808 s, LTI 13.333 s; time is
       proportional to TMS; no operation below 1.05 x Is; flat above 20 x Is; time falls as current rises
   K1b stages: the fastest picked-up stage wins (definite time, instantaneous)
   K2  LSIG: long time passes tr at 6 x Ir and follows I^2 t; short-time and instantaneous take over at their pickups
   K3  transformer: FLA by hand (3,150 kVA at 400 V = 4,547 A); damage curve 1250/m^2, 2 s at the maximum fault
       current, nothing above it; inrush 12 x FLA at 0.1 s; cable adiabatic limit by hand
   K4  coordination: a graded pair passes at >= 0.3 s; the same pair with the upstream TMS lowered fails and the
       finding names the pair; currents are referred across voltages */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = createRequire(import.meta.url)(path.join(ROOT, 'js/conv/tcc.js'));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''} ${a} vs ${b}`);

test('K1 IEC inverse-time check values', () => {
  near(T.inverse('SI', 100, 1, 1000), 2.9706, 0.001, 'SI');
  near(T.inverse('VI', 100, 1, 1000), 1.5, 1e-9, 'VI');
  near(T.inverse('EI', 100, 1, 1000), 80 / 99, 1e-9, 'EI');
  near(T.inverse('LTI', 100, 1, 1000), 120 / 9, 1e-9, 'LTI');
  near(T.inverse('SI', 100, 0.25, 1000), 2.9706 / 4, 0.001, 'TMS');
  assert.equal(T.inverse('SI', 100, 1, 104), null);
  assert.ok(T.inverse('SI', 100, 1, 106) > 100);
  assert.equal(T.inverse('EI', 100, 1, 2000), T.inverse('EI', 100, 1, 9000));
  let last = Infinity;
  for (let I = 110; I <= 2000; I += 70) { const t = T.inverse('VI', 100, 0.3, I); assert.ok(t <= last); last = t; }
  assert.equal(T.inverse('XX', 100, 1, 1000), null);
});

test('K1b fastest stage wins', () => {
  const r = { curve: 'SI', Is: 100, TMS: 0.5, dt: { I: 800, t: 0.4 }, inst: { I: 3000, t: 0.05 } };
  near(T.relay(r, 500), 0.5 * 0.14 / (Math.pow(5, 0.02) - 1), 1e-9);
  assert.equal(T.relay(r, 1000), 0.4);
  assert.equal(T.relay(r, 3000), 0.05);
  assert.equal(T.relay(r, 50), null);
});

test('K2 LSIG', () => {
  const b = { kind: 'lsig', Ir: 1000, tr: 10, Isd: 5000, tsd: 0.2, Ii: 15000 };
  assert.equal(T.lsig(b, 1000), null);
  near(T.lsig(b, 3000), 10 * 4, 1e-9, 'I2t at 3 x Ir');
  assert.equal(T.lsig(b, 4999) > 10, true);
  assert.equal(T.lsig(b, 6000), 0.2);
  assert.equal(T.lsig(b, 15000), 0.02);
  near(T.lsig({ ...b, Isd: 6000 }, 6000), 0.2, 1e-9);
  near(T.lsig({ kind: 'lsig', Ir: 1000, tr: 10, Isd: 3000, tsd: 0.1, i2t: true }, 5000), 0.4, 1e-9, 'I2t ramp');
});

test('K3 transformer and cable limits', () => {
  near(T.txFla(3150, 400), 4546.6, 0.5, 'FLA');
  const In = T.txFla(3150, 400), Imax = In / 0.06;
  near(T.txDamage(3150, 400, 6, 3 * In), 1250 / 9, 1e-6, 'thermal');
  near(T.txDamage(3150, 400, 6, Imax), 2, 1e-6, '2 s at max fault');
  assert.equal(T.txDamage(3150, 400, 6, Imax * 1.2), null);
  assert.equal(T.txDamage(3150, 400, 6, 1.5 * In), null);
  const inr = T.txInrush(3150, 400); near(inr.I, 12 * In, 1e-6); assert.equal(inr.t, 0.1);
  near(T.cableWithstand(240, 143, 34320), 1, 1e-9, '240 mm2 Cu carries 34.3 kA for 1 s');
  near(T.refer(1000, 400, 20000), 20, 1e-9);
});

test('K4 coordination', () => {
  const feeder = { id: 'F-LV', V: 400, dev: { kind: 'lsig', Ir: 1600, tr: 8, Isd: 8000, tsd: 0.1, Ii: 40000 } };
  const incomer = { id: 'INC-LV', V: 400, dev: { kind: 'lsig', Ir: 5000, tr: 16, Isd: 20000, tsd: 0.4 } };
  const mv = { id: 'MV-51', V: 20000, dev: { kind: 'relay', curve: 'EI', Is: 300, TMS: 1 } };
  /* a very-inverse relay with a low pickup crosses the incomer's long-time band: the check must say so */
  const crossing = T.coordinate([feeder, incomer, { ...mv, dev: { kind: 'relay', curve: 'VI', Is: 120, TMS: 0.6 } }], 30000, 0.3);
  assert.equal(crossing.ok, false);
  assert.ok(crossing.pairs.some((p) => !p.ok && p.I < 20000 && p.up === 'MV-51'), 'the crossing is below the short-time pickup');
  const good = T.coordinate([feeder, incomer, mv], 30000, 0.3);
  assert.equal(good.ok, true, JSON.stringify(good.pairs.filter((p) => !p.ok)));
  assert.ok(good.pairs.length >= 4);
  const bad = T.coordinate([feeder, incomer, { ...mv, dev: { ...mv.dev, TMS: 0.05 } }], 30000, 0.3);
  assert.equal(bad.ok, false);
  assert.ok(bad.pairs.some((p) => !p.ok && p.down === 'INC-LV' && p.up === 'MV-51'));
  assert.equal(T.coordinate([feeder], 30000).ok, false);
  near(T.margin(incomer.dev, feeder.dev, 30000), 0.3, 1e-9);
});
