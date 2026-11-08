#!/usr/bin/env node
// test-cx-campus-basis.mjs — laws for RZCxCampus.layout(basis), the DOM-free rule that turns the site basis (IT kW,
// kW per rack, cooling type, the engine's equipScale counts) into what the 3D plant draws and what every callout says
// (PRD v1.1 §11, §41 K18 "accurate bener2 dynamic data dan pintar"). No browser: the module is required in Node.
// Usage: node tools/test-cx-campus-basis.mjs   (exit 1 on any failed law)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(here, '..');
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✘', n, d === undefined ? '' : JSON.stringify(d).slice(0, 300)); } };

global.window = {}; require(resolve(ROOT, 'rz-engine.js'));
const E = window.RZEngine, C = E.models.commissioning;
const Campus = require(resolve(ROOT, 'js', 'rz-cx-campus.js'));
const { layout, CAP, SITE, PAL } = Campus;
const FAMS = ['racks', 'cdu', 'crah', 'ups', 'unit_subs', 'lv_busway', 'bms', 'fire', 'chillers', 'fws', 'dry_coolers', 'generators', 'hv_intake', 'main_tx', 'mv_board'];
const basisFor = (src) => { const inp = C.mapInput(src), den = E.data.commissioning.cx.rich.density[inp.rackDensity]; return { itKw: inp.itLoad, rackKw: den.kw, coolingType: inp.coolingType, es: C.equipScale(inp) }; };

// B1 the default basis (2,000 kW, standard 6 kW racks, air) follows the engine's own counts
{
  const b = basisFor({ itLoad: 2000 }), L = layout(b), f = L.families;
  ok('B1 racks drawn = engine racks (kW ÷ rack kW) when the hall holds them', f.racks.count === b.es.racks && f.racks.count === Math.ceil(2000 / 6), { racks: f.racks.count, es: b.es.racks });
  ok('B1 rows × per-row cover the racks drawn, within the hall (≤ 10 rows, ≤ 56 per row)', L.rows * L.perRow >= f.racks.count && L.rows <= CAP.rows && L.perRow <= CAP.perRow, { rows: L.rows, perRow: L.perRow });
  ok('B1 air-cooled hall draws no CDU and its callout says so', f.cdu.count === 0 && /air-cooled/.test(f.cdu.basis), f.cdu);
  ok('B1 CRAH, chillers, pumps, UPS, generators, unit transformers follow equipScale', f.crah.all === b.es.cooling_units && f.chillers.all === b.es.chillers && f.fws.all === b.es.pumps && f.ups.all === b.es.ups_modules && f.generators.all === b.es.generators && f.unit_subs.all === b.es.transformers, { crah: f.crah.all, es: b.es.cooling_units });
  ok('B1 every family has a basis sentence and a count between 0 and its capacity', FAMS.every((k) => f[k] && typeof f[k].basis === 'string' && f[k].basis.length > 3 && f[k].count >= 0 && f[k].count <= (k === 'racks' ? CAP.rows * CAP.perRow : (k === 'cdu' ? CAP.rows * 2 : (k === 'crah' ? CAP.crahPerWall * 2 : CAP[k])))), FAMS.map((k) => [k, f[k] && f[k].count]));
  ok('B1 FWS flow is zero on an air-cooled hall; CHW carries the whole load at ΔT 6 K', L.fwsLps === 0 && Math.abs(L.chwLps - 2000 / (4.18 * 6)) < 0.01, { fws: L.fwsLps, chw: L.chwLps });
}
// B2 liquid cooling adds CDUs at every row end and moves 85 % of the heat onto the FWS
{
  const L = layout(basisFor({ itLoad: 2000, coolingType: 'dlc' })), f = L.families;
  ok('B2 DLC: two CDUs per rack row, 85 % liquid share, FWS ≈ 85 % × kW ÷ (4.18 × 10)', f.cdu.count === L.rows * 2 && L.liquidShare === 0.85 && Math.abs(L.fwsLps - 2000 * 0.85 / 41.8) < 0.01, { cdu: f.cdu.count, rows: L.rows, fws: L.fwsLps });
  ok('B2 DLC callout names the share and the type', /DLC/.test(f.cdu.basis) && /85 %/.test(f.cdu.basis), f.cdu.basis);
}
// B3 a bigger site draws more, until the room is full — then the callout says how many of how many
{
  const small = layout(basisFor({ itLoad: 1000 })), mid = layout(basisFor({ itLoad: 5000 })), big = layout(basisFor({ itLoad: 40000 }));
  ok('B3 counts are monotonic in IT load (racks, CRAH, chillers, generators)', ['racks', 'crah', 'chillers', 'generators'].every((k) => small.families[k].all <= mid.families[k].all && mid.families[k].all <= big.families[k].all));
  ok('B3 40 MW: the hall is full (560 racks drawn) and the basis says "hall 1 of N"', big.families.racks.count === CAP.rows * CAP.perRow && big.halls > 1 && /hall 1 of \d+/.test(big.families.racks.basis), big.families.racks);
  ok('B3 40 MW: capped families print "<drawn> of <all> drawn"', /\d+ of \d+ drawn/.test(big.families.chillers.basis) && big.families.chillers.count === CAP.chillers && big.families.chillers.all > CAP.chillers, big.families.chillers);
  ok('B3 1 MW: nothing is capped, no "of … drawn" text', FAMS.every((k) => !/ of \d+ drawn/.test(small.families[k].basis)), FAMS.filter((k) => / of \d+ drawn/.test(small.families[k].basis)));
}
// B4 the rule is pure, deterministic and safe on bad input (the fallback is the engine default, never NaN)
{
  const a = JSON.stringify(layout(basisFor({ itLoad: 3000 }))), b = JSON.stringify(layout(basisFor({ itLoad: 3000 })));
  ok('B4 same basis → identical layout', a === b);
  const bad = layout({ itKw: 'x', rackKw: 0, coolingType: null, es: null }), none = layout();
  ok('B4 bad input falls back to 2,000 kW at 6 kW per rack, air, with finite counts', bad.kw === 2000 && bad.rackKw === 6 && !bad.liquid && FAMS.every((k) => Number.isFinite(bad.families[k].count)) && none.kw === 2000, { kw: bad.kw, rackKw: bad.rackKw });
  ok('B4 racks derive from kW ÷ rack kW when the engine counts are absent', layout({ itKw: 1200, rackKw: 12 }).families.racks.count === 100);
}
// B5 the drawn site declares its capacities and its light palette (K16) next to the rule
{
  ok('B5 CAP covers every family the campus draws', FAMS.every((k) => k === 'racks' || k === 'cdu' || k === 'crah' || typeof CAP[k] === 'number'));
  ok('B5 SITE buildings cover every family', FAMS.every((k) => Object.keys(SITE).some((b) => SITE[b].systems.indexOf(k) !== -1)), FAMS.filter((k) => !Object.keys(SITE).some((b) => SITE[b].systems.indexOf(k) !== -1)));
  const lum = (hex) => { const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
  ok('B5 canvas, ground, walls, roof and floor are light (luminance ≥ 0.85) — PRD v1.0 §24 light engineering workspace', ['canvas', 'ground', 'wall', 'roof', 'floor'].every((k) => lum(PAL[k]) >= 0.85), Object.keys(PAL).map((k) => [k, lum(PAL[k]).toFixed(2)]));
  ok('B5 the palette is not read from the page theme (no data-theme lookup in the module)', !/data-theme/.test(readFileSync(resolve(ROOT, 'js', 'rz-cx-campus.js'), 'utf8')));
}
console.log(`CX CAMPUS BASIS — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
