#!/usr/bin/env node
/* R120 step 2b: DCMOC and site CAPEX against a public reference.
 * Reference: Koomey, Brill, Turner, Stanley, Taylor, "A Simple Model for Determining True Total Cost of Ownership for
 * Data Centers", Uptime Institute white paper TUI3011B (2007), Table 1, hosted by LBNL:
 * https://datacenters.lbl.gov/sites/default/files/(TUI3011B)SimpleModelDetermingTrueTCO.pdf
 * Gap file: documentation/product-transformation/gaps/dcmoc-capex.md.
 *
 *   node tools/test-capex-reference.mjs   # exit 1 if any law fails
 *
 * F* = the reference's method reproduced by the engine (parity).
 * D* = defects found by the gap audit (one project, one CAPEX; each city's own $/W reproduced at its basis spec).
 * Not wired in ship-gate until the owner decides O-R120-CAPEX (it is red on purpose today).
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
global.window = global;
global.dispatchEvent = () => true;
global.addEventListener = () => {};
global.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
require(resolve(root, 'rz-engine.js'));
const E = global.window.RZEngine;

let fail = 0;
const law = (id, ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`); };
const near = (x, y, tol) => Math.abs(x - y) <= tol;

/* F1-F3: Table 1 annualizes capital with the capital recovery factor at a 7 % real rate, 3-year IT and 15-year
 * facility lives (notes 32-34): 29 M$ x CRF(3) + 72 M$ x CRF(15) = 19.1 M$/yr. */
const fin = (E.models.finance || {});
const crf = typeof fin.crf === 'function' ? fin.crf : null;
law('F1', !!crf && near(crf(0.07, 15), 0.10979, 5e-5) && near(crf(0.07, 3), 0.38105, 5e-5),
  `engine exposes CRF: CRF(7 %, 15 y) = 0.10979, CRF(7 %, 3 y) = 0.38105 (${crf ? crf(0.07, 15).toFixed(5) + ', ' + crf(0.07, 3).toFixed(5) : 'no models.finance.crf'})`);
const ann = typeof fin.annualizedCapital === 'function' ? fin.annualizedCapital : null;
const a = ann ? ann([{ cost: 29.5e6, lifeYears: 3 }, { cost: 72.3e6, lifeYears: 15 }], 0.07) : NaN;
law('F2', near(a / 1e6, 19.1, 0.15), `annualized capital by asset life = 19.1 M$/yr (Table 1 row 34) (engine ${ann ? (a / 1e6).toFixed(2) : 'no models.finance.annualizedCapital'})`);
/* F3: Table 1 splits facility capital into a power term ($/kW, note 26) and an area term ($/ft2 active, note 27):
 * 2176 kW x 23,801 $/kW = 51.8 M$ and 20,000 ft2 x 262 $/ft2 = 5.2 M$. RZ must carry an area-driven term. */
const cap = E.models.capex.detailed({ itLoadKw: 2176, rackType: 'medium', redundancy: 'n1' });
law('F3', cap.costs && Object.keys(cap.costs).some((k) => cap.costs[k] && cap.costs[k].basis === 'area'),
  'capex carries an area-driven ($/m2) cost term beside the per-kW terms');

/* D1-D2: one project, one CAPEX. DCMOC (dcmoc/src/lib/CapexEngine.ts) and the site calculator
 * (models.capex.detailed) take the same inputs and the same city $/W table. */
let dcmoc = null;
try {
  const jiti = require(resolve(root, 'dcmoc/node_modules/jiti'))(import.meta.url, { alias: { '@': resolve(root, 'dcmoc/src') }, interopDefault: true });
  dcmoc = jiti(resolve(root, 'dcmoc/src/lib/CapexEngine.ts'));
} catch (e) { console.log('note: DCMOC CapexEngine not loadable here: ' + e.message.slice(0, 120)); }
const BASIS = { itLoad: 2176, location: 'americas', buildingType: 'purpose', coolingType: 'air', redundancy: 'n1', rackType: 'medium',
  upsType: 'modular', genType: 'diesel', fuelHours: 48, fireType: 'novec', alarmType: 'addressable', projYear: '2025', designFee: 0, pmFee: 0,
  contingency: 10, includeFOM: false, substationType: 'shared', utilityRate: 9, greenCert: 'none', renewableOption: 'none', seismicZone: 'zone2' };
const CITIES = ['virginia', 'dallas', 'san_antonio'];
const perW = (c) => E.data.capexDetail.cityCapexPerW[c].perW;
const rows = CITIES.map((c) => {
  const site = E.models.capex.detailed({ itLoadKw: 2176, rackType: 'medium', redundancy: 'n1', city: c }).total / 2176 / 1000;
  const dc = dcmoc ? dcmoc.calculateCapex({ ...BASIS, cityMarket: c }).total / 2176 / 1000 : NaN;
  return { c, site, dc, ref: perW(c) };
});
for (const r of rows) console.log(`  ${r.c.padEnd(12)} city table ${r.ref.toFixed(2)} $/W · site ${r.site.toFixed(2)} · DCMOC ${r.dc.toFixed(2)}`);
law('D1', rows.every((r) => near(r.site, r.dc, 0.02 * r.ref)),
  'DCMOC and the site calculator give the same CAPEX for the same inputs (within 2 %)');
law('D2', rows.every((r) => near(r.site, r.ref, 0.10 * r.ref) && near(r.dc, r.ref, 0.10 * r.ref)),
  "at the city table's basis spec (Tier III / N+1, air, medium density, purpose-built) both reproduce the city's own $/W within 10 %");

console.log(`test-capex-reference: ${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
