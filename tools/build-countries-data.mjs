/* Build DATA.countries in rz-engine.js from the single authoring source
 * dcmoc/src/constants/countries.ts. Run: node tools/build-countries-data.mjs
 * (Node 24+ imports the .ts directly via type-stripping.) Keeps the engine's
 * canonical country reference provably in sync with the DCMOC constant — the
 * parity gate (tools/test-reference-parity.mjs) asserts deep-equality.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = join(ROOT, 'rz-engine.js');
const START = '/* @@COUNTRIES_START */';
const END = '/* @@COUNTRIES_END */';

const { COUNTRIES } = await import(join(ROOT, 'dcmoc/src/constants/countries.ts'));

// Deterministic, key-ordered serialization → a JS object literal (valid JS).
// 8-space indent to match the DATA block nesting.
const body = JSON.stringify(COUNTRIES, null, 4)
    .split('\n')
    .map((l, i) => (i === 0 ? l : '        ' + l))
    .join('\n');
const block = `${START}\n        countries: ${body},\n        ${END}`;

const src = readFileSync(ENGINE, 'utf8');
const re = new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
if (!re.test(src)) { console.error('markers not found in rz-engine.js'); process.exit(1); }
writeFileSync(ENGINE, src.replace(re, block), 'utf8');
console.log(`DATA.countries written: ${Object.keys(COUNTRIES).length} countries`);
