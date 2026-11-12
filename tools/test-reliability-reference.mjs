#!/usr/bin/env node
/* R120 step 2 — DCMOC reliability against a public reference (NIST/SEMATECH e-Handbook §8.1.8.2-8.1.8.4,
 * public domain). Gap file: documentation/product-transformation/gaps/dcmoc-reliability.md.
 *
 *   node tools/test-reliability-reference.mjs            # exit 1 if a parity law (F*) fails; D* reported
 *   node tools/test-reliability-reference.mjs --strict   # exit 1 if any law fails
 *
 * F* = the reference's formulas reproduced by the engine (parity; must pass).
 * D* = defects found in the gap audit; red until the owner decides the redundancy model (report mode until then).
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
global.window = global;
require(resolve(here, '..', 'rz-engine.js'));
const E = global.window.RZEngine;
const R = E.models.reliability;
const D = E.data.reliability;

const strict = process.argv.includes('--strict');
let fail = 0, parityFail = 0;
const law = (id, ok, msg) => { if (!ok) { fail++; if (id.startsWith('F')) parityFail++; } console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`); };
const near = (x, y, tol = 1e-9) => Math.abs(x - y) <= tol;

/* Reference examples, identical components, R = 0.9, n = 4 (NIST §8.1.8.4 special cases + r = 2). */
law('F1', near(R.seriesAvailability([0.9, 0.9, 0.9, 0.9]), 0.6561), `series n=4 R=0.9 = 0.656100 (got ${R.seriesAvailability([0.9, 0.9, 0.9, 0.9]).toFixed(6)})`);
law('F2', near(R.parallelAvailability(0.9, 4), 0.9999), `parallel n=4 R=0.9 = 0.999900 (got ${R.parallelAvailability(0.9, 4).toFixed(6)})`);
law('F3', near(R.kOutOfN(0.9, 2, 4), 0.9963), `2 out of 4 R=0.9 = 0.996300 (got ${R.kOutOfN(0.9, 2, 4).toFixed(6)})`);
law('F4', near(R.kOutOfN(0.9, 4, 4), R.seriesAvailability([0.9, 0.9, 0.9, 0.9])) && near(R.kOutOfN(0.9, 1, 4), R.parallelAvailability(0.9, 4)),
  'r = n reduces to series, r = 1 to parallel');

/* D1: the headline chain maps N+1 and 2N to the same 1-of-2 group (DATA.reliability.redundancyPaths). */
const ups = D.components.ups;
const a = R.availability(ups.mtbf, ups.mttr);
const mins = (x) => (1 - x) * 525960;
const n1 = R.systemAvailability(['ups'], 'n1');
const twoN = R.systemAvailability(['ups'], '2n');
law('D1', !near(n1, twoN, 1e-15), `headline UPS N+1 (${mins(n1).toFixed(4)} min/yr) differs from 2N (${mins(twoN).toFixed(4)} min/yr)`);

/* D2: N+1 with N = 4 is 4 of 5; the headline's 1-of-2 understates its downtime about 10x. */
const ref41 = R.kOutOfN(a, 4, 5);
law('D2', near(n1, ref41, 1e-12), `headline UPS N+1 with N=4 equals 4 of 5 = ${mins(ref41).toFixed(4)} min/yr (headline ${mins(n1).toFixed(4)})`);

/* D3: 2N = two independent N systems: 1 - (1 - a^k)^2. The what-if row's k of 2k (ReliabilityEnginePage.tsx:150) pools units across the two systems. */
const k = 4;
const twoSystems = 1 - Math.pow(1 - Math.pow(a, k), 2);
const pooled = R.kOutOfN(a, k, 2 * k);
law('D3', near(pooled, twoSystems, 1e-12), `2N with N=4: two systems ${mins(twoSystems).toFixed(6)} min/yr vs what-if k-of-2k ${mins(pooled).toFixed(6)} min/yr`);

console.log(`test-reliability-reference: ${fail ? fail + ' failed' : 'all passed'}${strict ? '' : ' (report mode)'}`);
process.exit(parityFail || (strict && fail) ? 1 : 0);
