#!/usr/bin/env node
/* R120 step 2 — DCMOC reliability against a public reference (NIST/SEMATECH e-Handbook §8.1.8.2-8.1.8.4,
 * public domain). Gap file: documentation/product-transformation/gaps/dcmoc-reliability.md.
 *
 *   node tools/test-reliability-reference.mjs   # exit 1 if any law fails
 *
 * F* = the reference's formulas reproduced by the engine (parity; must pass).
 * D* = the gap audit's defects, fixed in v3.50.0 (owner chose option a, 2026-11-12): N+1 = k of k+1, 2N = two systems of k.
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

let fail = 0;
const law = (id, ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`); };
const near = (x, y, tol = 1e-9) => Math.abs(x - y) <= tol;

/* Reference examples, identical components, R = 0.9, n = 4 (NIST §8.1.8.4 special cases + r = 2). */
law('F1', near(R.seriesAvailability([0.9, 0.9, 0.9, 0.9]), 0.6561), `series n=4 R=0.9 = 0.656100 (got ${R.seriesAvailability([0.9, 0.9, 0.9, 0.9]).toFixed(6)})`);
law('F2', near(R.parallelAvailability(0.9, 4), 0.9999), `parallel n=4 R=0.9 = 0.999900 (got ${R.parallelAvailability(0.9, 4).toFixed(6)})`);
law('F3', near(R.kOutOfN(0.9, 2, 4), 0.9963), `2 out of 4 R=0.9 = 0.996300 (got ${R.kOutOfN(0.9, 2, 4).toFixed(6)})`);
law('F4', near(R.kOutOfN(0.9, 4, 4), R.seriesAvailability([0.9, 0.9, 0.9, 0.9])) && near(R.kOutOfN(0.9, 1, 4), R.parallelAvailability(0.9, 4)),
  'r = n reduces to series, r = 1 to parallel');

/* D1-D3 (R120 gap, fixed in v3.50.0): redundancy configs map onto r-out-of-n groups with k = units the load needs. */
const ups = D.components.ups;
const a = R.availability(ups.mtbf, ups.mttr);
const mins = (x) => (1 - x) * 525960;
const n1 = R.systemAvailability(['ups'], 'n1', { ups: 4 });
const twoN = R.systemAvailability(['ups'], '2n', { ups: 4 });
law('D1', !near(n1, twoN, 1e-15), `UPS with N=4: N+1 (${mins(n1).toFixed(4)} min/yr) differs from 2N (${mins(twoN).toFixed(4)} min/yr)`);
const ref41 = R.kOutOfN(a, 4, 5);
law('D2', near(n1, ref41, 1e-12), `UPS N+1 with N=4 equals 4 of 5 = ${mins(ref41).toFixed(4)} min/yr (engine ${mins(n1).toFixed(4)})`);
const twoSystems = 1 - Math.pow(1 - Math.pow(a, 4), 2);
law('D3', near(twoN, twoSystems, 1e-12), `UPS 2N with N=4 = two systems of 4: ${mins(twoSystems).toFixed(6)} min/yr (engine ${mins(twoN).toFixed(6)})`);
law('D3b', near(R.systemAvailability(['ups'], 'n1'), R.parallelAvailability(a, 2)), 'k = 1 keeps the old 1-of-2 value (no change for single-unit groups)');

/* D4: DCMOC's own chain (availabilityChain.ts) gives the same groups, with the engine model and with its fallback. */
const { register } = await import('node:module');
register('./lib/ts-resolve-hook.mjs', import.meta.url);
const chain = await import(resolve(here, '..', 'dcmoc', 'src', 'components', 'modules', 'reliability', 'availabilityChain.ts'));
const units = { ups: 4, generator: 3, chiller: 4, crac: 10, switchgear: 2, pdu: 20 };
/* rows carry the β-factor (IEC 61508): A = group(1 − (1−β)q) × (1 − βq) */
const B = chain.CC_BETA, q = 1 - a, aInd = 1 - (1 - B) * q;
const want41 = R.kOutOfN(aInd, 4, 5) * (1 - B * q), want2N = (1 - Math.pow(1 - Math.pow(aInd, 4), 2)) * (1 - B * q);
const rowEng = chain.buildSystems(R, D.components, 1, 'n1', units).find((r) => r.label === 'UPS & Battery');
const fallback = { availability: R.availability };
const rowFb = chain.buildSystems(fallback, D.components, 1, 'n1', units).find((r) => r.label === 'UPS & Battery');
law('D4', near(rowEng.availability, want41, 1e-12) && near(rowFb.availability, want41, 1e-12), `DCMOC chain UPS N+1 k=4 = 4 of 5 with β per group, engine and fallback agree (${rowEng.chain})`);
const two = chain.buildSystems(R, D.components, 1, '2n', units).find((r) => r.label === 'UPS & Battery');
law('D4b', near(two.availability, want2N, 1e-12), 'DCMOC chain UPS 2N k=4 = two systems of 4, β per group');
const ov20 = chain.ccOverall(R, D.components, 1, 'n1', chain.unitsForLoad(E.models, 20000)), ov1 = chain.ccOverall(R, D.components, 1, 'n1', chain.unitsForLoad(E.models, 1000));
law('D6', (1 - ov20) * 525960 < 60 && (1 - ov1) * 525960 < (1 - ov20) * 525960, `common cause stays per group: N+1 headline 1 MW ${((1 - ov1) * 525960).toFixed(2)} < 20 MW ${((1 - ov20) * 525960).toFixed(2)} min/yr < 60 (a whole-path blend gave 408)`);
const eqU = chain.unitsFromEquip(E.models.commissioning.equipScale({ itLoad: 2000, rackDensity: 'standard' }));
law('D5', eqU.ups === 4 && eqU.generator === 1 && eqU.pdu === 20, `k from equipScale at 2 MW: ups ${eqU.ups}, generator ${eqU.generator}, pdu ${eqU.pdu}`);

console.log(`test-reliability-reference: ${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
