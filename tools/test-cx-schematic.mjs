#!/usr/bin/env node
// test-cx-schematic.mjs — Node laws for js/rz-cx-schematic.js (PRD v1.1 §8–9, T7/T8): three sheets, every system a node,
// colour follows the month, trace stops at the open ATS, engine warnings reported.
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url); const here = dirname(fileURLToPath(import.meta.url)); const R = resolve(here, '..');
let pass = 0, fail = 0; const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  ✘', n, d === undefined ? '' : JSON.stringify(d).slice(0, 400)); } };
global.window = {}; for (const f of ['rz-engine.js', 'js/rz-eng-symbols.js', 'js/rz-diagram-metrics.js', 'js/rz-diagram-layout.js', 'js/rz-diagram.js', 'js/rz-cx-plan.js', 'js/rz-cx-schematic.js']) require(resolve(R, f));
const P = window.RZCxPlan, S = window.RZCxSchematic;
const plan = P.compute({ itLoad: 40000, coolingType: 'liquid', redundancy: '2N', region: 'id_jakarta', rackDensity: 'ai_hpc' }, {});
ok('plan computed', !!plan);
const stMid = P.statusAt(plan, Math.round((plan.levels[3].start + plan.levels[3].end) / 2)), st0 = P.statusAt(plan, 0), stEnd = P.statusAt(plan, plan.finishMonth + 1);
const sh = S.sheets(stMid);
ok('three sheets', sh.length === 3 && sh.map((s) => s.block).join() === 'electrical,mechanical,controls');
const all = sh.map((s) => s.svg).join('');
const missing = P.SYSTEMS.filter((x) => !all.includes('data-rzd-hit="' + x.id + '"')).map((x) => x.id);
ok('every one of the 17 systems is an interactive node on exactly one sheet', !missing.length && P.SYSTEMS.every((x) => sh.filter((s) => s.svg.includes('data-rzd-hit="' + x.id + '"')).length === 1), missing);
const warn = sh.flatMap((s) => s.warnings.map((w) => s.block + ':' + w.kind + ':' + (w.id || '') + ' ' + (w.message || '').slice(0, 80)));
ok('zero engine warnings (overflow, unplaced label, transit, unknown option)', !warn.length, warn);
const states = (svg) => [...svg.matchAll(/data-rzd-node="([a-z_]+)"[^>]*data-rzd-state="([a-z]+)"/g)].map((m) => m[1] + '=' + m[2]);
const s0 = states(S.sheets(st0).map((s) => s.svg).join('')), sMid = states(all), sEnd = states(S.sheets(stEnd).map((s) => s.svg).join(''));
ok('M0: every system node is untagged', s0.length >= 17 && s0.every((x) => x.endsWith('=none')), s0.slice(0, 5));
ok('mid-L3: green and yellow both present', sMid.some((x) => x.endsWith('=green')) && sMid.some((x) => x.endsWith('=yellow')), sMid);
ok('after finish: every system node white', sEnd.filter((x) => !x.startsWith('it_load')).every((x) => x.endsWith('=white')), sEnd);
ok('sublabels name the next gate month (no decimals > 1)', !/\d+\.\d{2,}/.test([...all.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ')));
// T8 trace stops at the open ATS; T7 the two liquid loops meet only at the CDU
ok('T8 downstream of hv_intake reaches it_load and never generators', S.trace('electrical', 'hv_intake', 'down').includes('it_load') && !S.trace('electrical', 'hv_intake', 'down').includes('generators'));
ok('T8 upstream of it_load never includes generators (ATS normally open)', !S.trace('electrical', 'it_load', 'up').includes('generators'));
const mech = S.EDGES.mechanical.map((e) => e.join('>'));
ok('T7 TCS edges touch racks and cdu only; FWS edges touch cdu, fws, dry_coolers — no racks↔fws edge', !mech.includes('racks>fws') && !mech.includes('fws>racks') && mech.includes('cdu>racks') && mech.includes('fws>cdu'));
ok('legend derived on each sheet', sh.every((s) => /LEGEND/.test(s.svg)));
ok('no literal hex in the sheets (tokens only)', !/#[0-9a-f]{6}/i.test(all.replace(/url\(#[^)]*\)/g, '').replace(/href="#/g, '')));
// K29: the blocks carry the engine's installed counts for this site, and only when the page passes them
{ const C = window.RZEngine.models.commissioning, es = C.equipScale(C.mapInput(plan.input || { itLoad: 40000, coolingType: 'liquid', redundancy: '2N', region: 'id_jakarta', rackDensity: 'ai_hpc' }));
  const shc = S.sheets(stMid, es), svg = shc.map((x) => x.svg).join('');
  const MAP = { electrical: ['switchgear', 'generators', 'transformers', 'ups_modules', 'busway', 'racks'], mechanical: ['racks', 'pumps', 'cooling_units', 'chillers'], controls: ['fireZones'] };
  const got = shc.map((x) => (x.svg.match(/×[0-9,]+/g) || []).map((v) => +v.slice(1).replace(/,/g, '')).sort((p, q) => p - q).join());
  const want = shc.map((x) => MAP[x.block].map((k) => es[k]).sort((p, q) => p - q).join());
  ok('K29 counts: every × on each sheet is an equipScale value for a block on that sheet, and none is missing', got.join('|') === want.join('|'), { got, want });
  ok('K29 counts: zero engine warnings with counts on, and the note says where × comes from', shc.every((x) => !x.warnings.length) && /equipScale/.test(svg), shc.map((x) => x.warnings.length));
  ok('K29 counts: none without a scale (no typed numbers)', !/×\d/.test(all)); }
console.log(`CX SCHEMATIC — ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
