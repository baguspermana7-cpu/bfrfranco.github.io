/* Reference-data parity gate. Asserts the canonical country reference in
 * rz-engine.js (DATA.countries) is byte-for-byte the DCMOC authoring source
 * (dcmoc/src/constants/countries.ts) — so every calculator/module that reads
 * the engine sees identical electricity rate / grid carbon / tax / etc. Run:
 *   node tools/test-reference-parity.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const RZ = require(join(ROOT, 'rz-engine.js'));
const { COUNTRIES } = await import(join(ROOT, 'dcmoc/src/constants/countries.ts'));

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('FAIL:', msg); } };

const engine = RZ.data.countries || {};
ok(Object.keys(engine).length === Object.keys(COUNTRIES).length,
    `country count engine ${Object.keys(engine).length} == dcmoc ${Object.keys(COUNTRIES).length}`);

// Deep parity: engine DATA.countries must equal the DCMOC source exactly.
ok(JSON.stringify(engine) === JSON.stringify(COUNTRIES),
    'DATA.countries deep-equals dcmoc COUNTRIES (run tools/build-countries-data.mjs if this fails)');

// Spot-check the fields users compare across tools.
for (const id of Object.keys(COUNTRIES)) {
    const e = engine[id], d = COUNTRIES[id];
    if (!e) { ok(false, `engine missing ${id}`); continue; }
    ok(e.economy.electricityRate === d.economy.electricityRate, `${id} electricityRate parity`);
    ok(e.environment.gridCarbonIntensity === d.environment.gridCarbonIntensity, `${id} gridCarbon parity`);
    ok(e.economy.taxRate === d.economy.taxRate, `${id} taxRate parity`);
}

// Shared enums present.
ok(RZ.data.tierCodes && RZ.data.tierCodes['2n'] === 'Tier III', 'DATA.tierCodes present');
ok(RZ.data.redundancyLevels && RZ.data.redundancyLevels['2n'] === '2N', 'DATA.redundancyLevels present');
ok(RZ.data.coolingTypes && !!RZ.data.coolingTypes.air && !!RZ.data.coolingTypes.air.label, 'DATA.coolingTypes present (canonical taxonomy)');

// Currency covers every currency used by the countries.
const used = new Set(Object.values(COUNTRIES).map((c) => c.currency));
for (const cur of used) ok(RZ.data.currency[cur] != null, `currency rate for ${cur}`);

console.log(`\nREFERENCE-PARITY — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
