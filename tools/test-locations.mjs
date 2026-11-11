// P11 — location provenance core (js/rz-locations.js). Node only; the render-level consistency check is
// tools/test-locations-ui.mjs. Run: node tools/test-locations.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
global.window = {}; require(resolve(ROOT, 'rz-engine.js'));
const D = global.window.RZEngine.data;
let L;
try { L = require(resolve(ROOT, 'js', 'rz-locations.js')); } catch (e) { console.error('FAIL — js/rz-locations.js missing: ' + e.message); process.exit(1); }
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.error('  ✗ ' + n + (d ? ' ' + JSON.stringify(d) : '')); } };

// L2: an engine country value carries its source, date and the word ASSUMED
const e = L.field('ID', 'energy', D);
ok('ID energy = engine value', e.value === D.countries.ID.economy.electricityRate, e);
ok('ID energy evidence ASSUMED', e.evidence === 'ASSUMED', e);
ok('ID energy text starts with ASSUMED', /^ASSUMED · /.test(e.text), e);
ok('ID energy text names the dataset and date', /DCMOC country reference/.test(e.text) && /Q1 2026/.test(e.text), e);
const g = L.field('ID', 'grid', D);
ok('ID grid = engine value', g.value === D.countries.ID.environment.gridCarbonIntensity, g);
// L3: a row the engine does not carry is a legacy page value
const h = L.field('HK', 'energy', D, 0.14);
ok('HK legacy page value', h.value === 0.14 && h.evidence === 'ASSUMED' && /legacy page value, no source on file/.test(h.text), h);
const n = L.field('ZZ', 'energy', D);
ok('unknown code → not available, value null', n.value === null && /not available for this country/.test(n.text), n);
ok('engine absent → unavailable', L.field('ID', 'energy', null).value === null && /Location data unavailable/.test(L.field('ID', 'energy', null).text));
// L4: the engine's two tables are compared, never silently merged
const c = L.conflicts(D);
ok('conflicts listed for every tariff country that differs', c.length === Object.keys(D.electricityTariffs).filter((k) => D.countries[k] && (D.countries[k].economy.electricityRate !== D.electricityTariffs[k].rateUsdPerKwh || D.countries[k].environment.gridCarbonIntensity !== D.electricityTariffs[k].gridCarbonKgCo2PerKwh)).length, c.length);
const ci = c.find((r) => r.code === 'ID');
ok('ID conflict row carries both values', ci && ci.energy.countries === 0.09 && ci.energy.tariffs === 0.082, ci);
ok('ID field title names the conflict', /O-P11/.test(e.title) && /0\.082/.test(e.title), e.title);
// a value the engine does not hold must not be rendered as a number from the page when the engine has the country
ok('engine wins over a stale page literal', L.field('ID', 'energy', D, 0.075).value === D.countries.ID.economy.electricityRate);
console.log((fail ? 'FAIL' : 'PASS') + ' test-locations — ' + pass + ' passed, ' + fail + ' failed; ' + c.length + ' countries differ between DATA.countries and DATA.electricityTariffs (O-P11)');
process.exit(fail ? 1 : 0);
