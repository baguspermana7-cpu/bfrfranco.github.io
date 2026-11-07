#!/usr/bin/env node
// test-cx-plan-core.mjs — laws for js/rz-cx-plan.js (DOM-free). Run: node tools/test-cx-plan-core.mjs [engine.js]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const ENGINE = process.argv[2] ? resolve(process.argv[2]) : resolve(here, '..', 'rz-engine.js');
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  ✘', n, d === undefined ? '' : `— ${d}`); } };
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;

// RED: without an engine, compute() returns null and nothing throws
global.window = {};
const P0 = require(resolve(here, '..', 'js', 'rz-cx-plan.js'));
ok('no engine → compute null', P0.compute({ itLoadKw: 40000 }, {}) === null);
ok('statusAt(null) → null', P0.statusAt(null, 3) === null);

// with the engine
delete require.cache[resolve(here, '..', 'js', 'rz-cx-plan.js')];
require(ENGINE); const E = global.window.RZEngine;
const P = require(resolve(here, '..', 'js', 'rz-cx-plan.js'));
const inp = { itLoadKw: 40000, coolingType: 'liquid', powerRedundancy: '2N', countryId: 'ID', rackDensity: 'ai_hpc' };
const plan = P.compute(inp, {});
ok('compute returns the engine plan', !!plan && plan.levels.length === 7);
const direct = E.models.commissioning.programPlan(inp, {});
ok('compute == programPlan (total, finish)', plan.total === direct.total && plan.finishMonth === direct.finishMonth);

// sanitize: clamps, drops junk, keeps valid
const s = P.sanitize({ L3: { start: 4.123, months: 0, crew: 300, shift: 'x' }, L5: { shift: '2x12' }, L9: { start: 1 }, L1: 'junk' });
ok('sanitize clamps + drops', JSON.stringify(s) === JSON.stringify({ L3: { start: 4.12 }, L5: { shift: '2x12' } }), JSON.stringify(s));
ok('sanitize(null) = {}', JSON.stringify(P.sanitize(null)) === '{}');
const bad = P.compute(inp, { L3: { months: 0, crew: -1 } });
ok('junk override = baseline', bad.total === plan.total && bad.finishMonth === plan.finishMonth);

// LEVELS + cites
ok('7 levels, L1–L5 primary', P.LEVELS.length === 7 && P.LEVELS.filter((l) => l.primary).map((l) => l.id).join() === 'L1,L2,L3,L4,L5');
ok('every level cites 02.4.x', P.LEVELS.every((l, i) => l.cite.endsWith('#s02-4-' + (i + 1))));
ok('tags: red L1 … white L5', P.TAGS.red === 'L1' && P.TAGS.yellow === 'L2' && P.TAGS.green === 'L3' && P.TAGS.blue === 'L4' && P.TAGS.white === 'L5');
ok('17 systems, 3 blocks', P.SYSTEMS.length === 17 && new Set(P.SYSTEMS.map((x) => x.block)).size === 3);

// gate months: inside each window, ordered electrical → mechanical → controls, last one at the window end
const g = P.gateMonths(plan);
const win = Object.fromEntries(plan.levels.map((l) => [l.id, l]));
for (const L of ['L2', 'L3', 'L4']) {
  const at = P.SYSTEMS.map((x) => g[x.id][L]);
  ok(`${L}: every gate inside the window`, at.every((m) => m >= win[L].start - 1e-9 && m <= win[L].end + 1e-6), `${Math.min(...at).toFixed(2)}..${Math.max(...at).toFixed(2)} vs ${win[L].start}..${win[L].end}`);
  ok(`${L}: last system passes at the window end`, near(Math.max(...at), win[L].end, 1e-6));
  const elec = Math.max(...P.SYSTEMS.filter((x) => x.block === 'electrical').map((x) => g[x.id][L]));
  const mech = Math.min(...P.SYSTEMS.filter((x) => x.block === 'mechanical').map((x) => g[x.id][L]));
  const ctl = Math.min(...P.SYSTEMS.filter((x) => x.block === 'controls').map((x) => g[x.id][L]));
  ok(`${L}: electrical before mechanical before controls`, elec <= mech && Math.max(...P.SYSTEMS.filter((x) => x.block === 'mechanical').map((x) => g[x.id][L])) <= ctl);
}
ok('L1 and L5 are whole-window gates', P.SYSTEMS.every((x) => g[x.id].L1 === win.L1.end && g[x.id].L5 === win.L5.end));
ok('gates are monotonic per system', P.SYSTEMS.every((x) => g[x.id].L1 <= g[x.id].L2 && g[x.id].L2 <= g[x.id].L3 && g[x.id].L3 <= g[x.id].L4 && g[x.id].L4 <= g[x.id].L5));

// statusAt
const st0 = P.statusAt(plan, 0);
ok('M0: nothing tagged', st0.counts.none === 17 && st0.systems.every((x) => x.level === null && x.tag === null));
const stEnd = P.statusAt(plan, plan.finishMonth + 1);
ok('after finish: everything white (L5)', stEnd.counts.L5 === 17 && stEnd.systems.every((x) => x.tag === 'white'));
const mid = (win.L3.start + win.L3.end) / 2, stMid = P.statusAt(plan, mid);
const sum = Object.values(stMid.counts).reduce((a, b) => a + b, 0);
ok('mid-L3: counts sum to the system count', sum === 17);
ok('mid-L3: some L3 (green) and some still L2 (yellow)', stMid.counts.L3 > 0 && stMid.counts.L2 > 0, JSON.stringify(stMid.counts));
ok('mid-L3: a yellow system in the L3 window is inTest', stMid.systems.some((x) => x.level === 'L2' && x.inTest && x.next === 'L3'));
ok('mid-L3: electrical ahead of controls', stMid.systems.find((x) => x.id === 'hv_intake').level === 'L3' && stMid.systems.find((x) => x.id === 'bms').level === 'L2');
const stL3end = P.statusAt(plan, win.L3.end);
ok('L3 end: a system whose gate fell in the last month is flagged changed', stL3end.systems.some((x) => x.changed));
ok('ladder cites resolve for ups/chiller/crah/bms/epms/fire', stMid.systems.filter((x) => x.ladder).length === 8 && stMid.systems.find((x) => x.id === 'ups').ladder.endsWith('#s02-7-1'));
// a moved L3 moves the statuses
const moved = P.compute(inp, { L3: { start: win.L3.start + 1 } });
const stMoved = P.statusAt(moved, mid);
ok('L3 +1 mo: fewer systems green at the same month', stMoved.counts.L3 < stMid.counts.L3, `${stMoved.counts.L3} vs ${stMid.counts.L3}`);

// store: round trip, bad payloads, quota
const mem = (() => { let m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, dump: () => m }; })();
const S = P.store(mem);
ok('empty store → {}', JSON.stringify(S.load().overrides) === '{}' && S.load().siteCrewCap === null);
ok('save → load round trip', S.save({ L3: { start: 5, crew: 6 }, L9: { start: 1 } }, 24) && (() => { const r = S.load(); return JSON.stringify(r.overrides) === JSON.stringify({ L3: { start: 5, crew: 6 } }) && r.siteCrewCap === 24 && r.calendar.anchor === null && r.lines.length === 0; })());
mem.setItem(P.KEY, '{"version":7,"overrides":{"L3":{"start":5}}}');
ok('foreign version ignored', JSON.stringify(S.load().overrides) === '{}');
mem.setItem(P.KEY, '{not json');
ok('malformed ignored', JSON.stringify(S.load().overrides) === '{}');
const boom = P.store({ getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => {} });
ok('throwing storage fails soft', JSON.stringify(boom.load().overrides) === '{}' && boom.save({}, null) === false);
ok('fmt', P.fmtUsd(5620000) === '$5.62M' && P.fmtUsd(205418) === '$205k' && P.fmtInt(91844) === '91,844' && P.fmtMo(20.04) === 'M20.0');

console.log(`CX PLAN CORE — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
