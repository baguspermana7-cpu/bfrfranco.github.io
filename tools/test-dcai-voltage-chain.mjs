#!/usr/bin/env node
/**
 * A transformer steps ONE voltage level.
 *
 * The owner found this from the live single-line: a source box titled "PLN 20kV" carrying the
 * subtitle "150kV Substation" — two voltages at once — and the chain then ran straight from it to
 * a 2.5 MVA cast-resin unit substation and 400 V. "Harusnya memang 150kv", and "aneh masak 150kv
 * di step-down ke 400v pakai trafo". Both halves were right, and both are arithmetic:
 *
 *   at 20 kV the facility draws 654 MVA / (sqrt3 x 20 kV) = 18,887 A, and the Schneider SM6 ring
 *   main the drawing showed carrying it is rated 630 A — thirty times over;
 *
 *   a 2.5 MVA cast-resin unit substation is a 20 kV machine. At 150 kV the impulse withstand is
 *   650-750 kV BIL, so the device the drawing implied cannot be built.
 *
 * WHY NO GATE CAUGHT IT. Until v3.2.0 `electrical.voltageLL` (400) was the ONLY voltage in the
 * whole engine — js/dcai-engine.js labelled its own block "LV distribution" — so every kV string
 * on the page was page-authored prose inside a declared-basis escape hatch, and a grep of tools/
 * found zero tests asserting any voltage anywhere. A contradiction between two prose strings is
 * not something a numeric gate can see. The fix is that the levels are now engine parameters, and
 * this gate holds the page to them.
 *
 * WHAT IT ASSERTS
 *   1. The engine publishes three descending levels as SCALARS — they were briefly an array, which
 *      blanked the entire page (see tools/test-dcai-engine.mjs) — and every transformer ratio the page
 *      draws steps between two ADJACENT ones. A "150/0.4 kV" or "150kV -> 400V" label fails.
 *   2. Every kV literal the page renders is one of the published levels or the switchgear class
 *      that serves it — a page may not invent a fourth voltage in prose.
 *   3. The one-voltage-per-box rule: no drawn source label states two different voltages.
 *
 * Usage: node tools/test-dcai-voltage-chain.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(read('js/dcai-model.js'), sandbox);
vm.runInContext(read('js/dcai-engine.js'), sandbox);
const S = sandbox.window.DCAI_CALC.snapshot;
const D = S.distribution;

/* ---- 1. the levels themselves ------------------------------------------- */
for (const [id, value] of [['hv_intake_kv', D.hv_intake_kv], ['mv_kv', D.mv_kv], ['voltage_ll_v', D.voltage_ll_v]]) {
  assert.ok(typeof value === 'number' && isFinite(value),
    `the engine must publish distribution.${id}. Before v3.2.0 it published only voltage_ll_v (400), `
    + 'which is exactly why "PLN 20kV" could sit above the subtitle "150kV Substation" for three releases '
    + 'with no gate able to contradict it.');
}
const levels = [D.hv_intake_kv, D.mv_kv, D.voltage_ll_v / 1000];   // all in kV
assert.equal(levels.length, 3, 'the chain has exactly three voltage levels');
for (let i = 1; i < levels.length; i += 1) {
  assert.ok(levels[i] < levels[i - 1], `level ${i} must be below level ${i - 1}: ${levels.join(' > ')}`);
}
const allowedRatios = new Set();
for (let i = 1; i < levels.length; i += 1) {
  const hi = levels[i - 1], lo = levels[i];
  allowedRatios.add(`${hi}/${lo}`);
  allowedRatios.add(`${hi}kv/${lo * 1000}v`);
}

/* ---- 2. every transformer ratio the page draws --------------------------- */
const page = read('datahallAI.html');
/* forms the page uses: "150/20 kV", "20/0.4kV", "20kV/400V", "20kV -> 400V", "20kV→0.4kV" */
const RATIO = /(\d+(?:\.\d+)?)\s*(?:kv)?\s*(?:\/|→|->|&rarr;)\s*(\d+(?:\.\d+)?)\s*(kv|v)\b/gi;
const offenders = [];
let m;
while ((m = RATIO.exec(page))) {
  const hi = Number(m[1]);
  const lo = m[3].toLowerCase() === 'v' ? Number(m[2]) / 1000 : Number(m[2]);
  if (!(hi > lo)) { continue; }                       /* not a step-down pair */
  if (!levels.includes(hi) || !levels.includes(lo)) { continue; }  /* not one of our levels */
  const hiIndex = levels.indexOf(hi), loIndex = levels.indexOf(lo);
  if (loIndex - hiIndex !== 1) {
    offenders.push(`${m[0].trim()} — steps ${loIndex - hiIndex} levels; a transformer steps one`);
  }
}
assert.deepEqual(offenders, [], 'no drawn transformer ratio may span more than one voltage level');

/* ---- 3. no rendered kV outside the published set ------------------------- */
/* the switchgear CLASS (24 kV gear on a 20 kV system) is a rating, not a system voltage, and the
   model names it; anything else must be a level. */
const gearClasses = new Set([24, 36]);
const seen = new Set();
const KV = /\b(\d{1,3}(?:\.\d+)?)\s*kv\b/gi;
let k;
while ((k = KV.exec(page))) { seen.add(Number(k[1])); }
/* A simulated bus READING is a measurement of a level, not a new level: the mimic prints
   "20.04 kV" and "19.98 kV" on the two 20 kV sections. Anything within 10 % of a published
   level is that level being measured; anything outside it is an invented voltage. */
function nearLevel(v) { return levels.some((L) => Math.abs(v - L) <= L * 0.1); }
const stray = [...seen].filter((v) => v >= 1 && !gearClasses.has(v) && !nearLevel(v));
assert.deepEqual(stray, [],
  `every kV the page renders must be a published level (${levels.join(', ')} kV), a reading of one, `
  + `or a declared gear class (${[...gearClasses].join(', ')} kV)`);

/* ---- 4. one voltage per source box --------------------------------------- */
/* the retired defect literally: a title and its own subtitle naming different voltages */
assert.ok(!/PLN\s*20kV[\s\S]{0,200}?150kV Substation/.test(page.replace(/^\s*\/\*[\s\S]*?\*\//gm, '')),
  'a source box may not state two different voltages — the "PLN 20kV" / "150kV Substation" pair is the defect this gate exists for');

console.log('── VOLTAGE CHAIN ──');
console.log(`levels: ${D.hv_intake_kv} kV -> ${D.mv_kv} kV -> ${D.voltage_ll_v} V`);
console.log(`intake ${Math.round(D.hv_current_a).toLocaleString()} A on ${D.hv_circuits_installed} x ${D.hv_circuit_mva} MVA circuits; `
  + `${D.main_tx_total} x ${D.main_tx_mva} MVA main transformers; `
  + `${D.mv_fault_ka_per_section.toFixed(1)} kA into ${D.mv_board_ka_rating} kA gear`);
console.log('PASS — three descending levels, every drawn ratio steps exactly one of them, no stray kV, no box with two voltages');
