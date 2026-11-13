#!/usr/bin/env node
/* R120 step 3a: measured PUE against a public reference.
 * Reference: "Recommendations for Measuring and Reporting Overall Data Center Efficiency", Version 2 — Measuring PUE
 * for Data Centers, Data Center Metrics Task Force (7x24 Exchange, ASHRAE, The Green Grid, Silicon Valley Leadership
 * Group, U.S. DOE Save Energy Now and FEMP, U.S. EPA ENERGY STAR, USGBC, Uptime Institute), 2011-05-17, hosted by
 * ENERGY STAR: https://www.energystar.gov/sites/default/files/Data_Center_Metrics_Task_Force_Recommendations_V2.pdf
 * (sha256 cc3881ae…f4b, read 2026-11-14). Section 3.2 Table 1 (categories 0-3), section 3.3 Table 2 (source-energy
 * weighting factors), Appendix A (Case A, Case B). Gap file: documentation/product-transformation/gaps/pue.md.
 *
 *   node tools/test-pue-reference.mjs   # exit 1 if any law fails
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
global.window = global;
global.dispatchEvent = () => true;
global.addEventListener = () => {};
global.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
require(resolve(root, 'rz-engine.js'));
const E = global.window.RZEngine;

let fail = 0;
const law = (id, ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`); };
const near = (x, y, tol) => Math.abs(x - y) <= tol;
const P = E.models.pue || {};
const measured = typeof P.measured === 'function' ? P.measured : null;
const W = (E.data && E.data.pueSourceWeights) || null;

/* W1 Table 2, normalised to electricity. */
const TABLE2 = { electricity: 1.0, naturalGas: 0.31, fuelOil: 0.30, otherFuels: 0.30, districtChilledWater: 0.31,
  districtHotWater: 0.40, districtSteam: 0.43, condenserWater: 0.03 };
const wBad = W ? Object.keys(TABLE2).filter((k) => !W[k] || W[k].factor !== TABLE2[k]) : Object.keys(TABLE2);
law('W1', !wBad.length && W && Object.keys(W).length === 8,
  `DATA.pueSourceWeights carries Table 2's 8 factors exactly${wBad.length ? ' — wrong/missing: ' + wBad.join(', ') : ''}`);

/* F1 Appendix A, Case A: all electric, 1,705,000 kWh total, 1,000,000 kWh IT at UPS output (category 1). */
const a = measured ? measured({ category: 1, itKwh: 1000000, energy: { electricity: 1705000 } }) : null;
law('F1', a && a.ok && near(a.pue, 1.705, 1e-9) && a.label === 'PUE1',
  `Case A: 1,705,000 / 1,000,000 = 1.705 (paper prints 1.70) as PUE1 (engine ${a ? (a.ok ? a.pue + ' ' + a.label : a.reason) : 'no models.pue.measured'})`);

/* F2 Case B: 1,305,000 kWh electricity + 1,300,000 kWh district chilled water x 0.31. The paper prints 1.70; the
 * exact quotient is 1.708 (1,708,000 / 1,000,000): the paper truncates. Gate the exact value. */
const b = measured ? measured({ category: 1, itKwh: 1000000, energy: { electricity: 1305000, districtChilledWater: 1300000 } }) : null;
law('F2', b && b.ok && near(b.pue, 1.708, 1e-9) && b.weighted && near(b.weighted.districtChilledWater, 403000, 1e-6),
  `Case B: (1,305,000 + 1,300,000 x 0.31) / 1,000,000 = 1.708 (paper prints 1.70) (engine ${b ? (b.ok ? b.pue : b.reason) : '—'})`);

/* F3 Category 0 is peak demand (kW) and "may only be used for all-electric data centers". */
const c0 = measured ? measured({ category: 0, itKw: 800, energy: { electricity: 1300, naturalGas: 100 } }) : null;
const c0ok = measured ? measured({ category: 0, itKw: 800, energy: { electricity: 1300 } }) : null;
law('F3', c0 && !c0.ok && /electric/i.test(c0.reason || '') && c0ok && c0ok.ok && near(c0ok.pue, 1.625, 1e-9) && c0ok.label === 'PUE0',
  `category 0: refuses non-electric energy (${c0 ? c0.reason || 'accepted' : '—'}); all-electric 1,300 / 800 kW = 1.625 as PUE0`);

/* F4 Table 1: the IT meter location each category names. */
const LOC = { 0: /UPS output/i, 1: /UPS output/i, 2: /PDU output/i, 3: /IT equipment input/i };
const locBad = measured ? [0, 1, 2, 3].filter((k) => {
  const r = measured(k === 0 ? { category: 0, itKw: 1, energy: { electricity: 1.5 } } : { category: k, itKwh: 1, energy: { electricity: 1.5 } });
  return !r.ok || !LOC[k].test(r.itMeter || '') || r.label !== 'PUE' + k;
}) : [0, 1, 2, 3];
law('F4', !locBad.length, `categories 0-3 carry Table 1's IT meter location and the subscript label${locBad.length ? ' — wrong: ' + locBad.join(', ') : ''}`);

/* F5 inputs a reader can get wrong are refused with a reason, never turned into a number. */
const bad = measured ? [
  measured({ category: 1, itKwh: 0, energy: { electricity: 10 } }),
  measured({ category: 1, itKwh: 10, energy: { electricity: -1 } }),
  measured({ category: 1, itKwh: 10, energy: { coal: 5, electricity: 12 } }),
  measured({ category: 4, itKwh: 10, energy: { electricity: 12 } }),
  measured({ category: 1, itKwh: 20, energy: { electricity: 12 } }),
] : [];
law('F5', bad.length === 5 && bad.every((r) => !r.ok && r.reason),
  `refused with a reason: IT 0, negative energy, unknown energy type, category 4, total below IT (${bad.map((r) => r.ok ? 'ACCEPTED' : r.reason).join(' | ') || '—'})`);

console.log(`test-pue-reference: ${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
