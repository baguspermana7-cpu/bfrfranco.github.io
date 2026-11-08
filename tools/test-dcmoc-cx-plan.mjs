#!/usr/bin/env node
// test-dcmoc-cx-plan.mjs — laws for the DCMOC Cx plan bridge + schedule store (Tier 2, WI-CX-SUPERAPP-001).
// The bridge must return the SAME plan and the SAME per-system status as the public site's RZCxPlan for the same
// inputs — one algorithm, two consumers. Node 24 strips the TypeScript types at import; zustand resolves from
// dcmoc/node_modules because the store file lives under dcmoc/. Run from the repo root: node tools/test-dcmoc-cx-plan.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
const here = dirname(fileURLToPath(import.meta.url)), R = (p) => resolve(here, '..', p), require = createRequire(import.meta.url);
import { register } from 'node:module';
register('./lib/ts-resolve-hook.mjs', import.meta.url);   /* extensionless TS imports → .ts (Node strips the types) */
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  ✘', n, d === undefined ? '' : `— ${typeof d === 'string' ? d : JSON.stringify(d).slice(0, 300)}`); } };
const same = (a, b) => { try { assert.deepEqual(a, b); return true; } catch { return false; } };

/* a localStorage double so the store's persistence path is exercised */
const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.require = require;                         /* the bridges reach Node's require through eval('require') (the rz-engine.ts idiom); give the ESM gate one */
globalThis.RZEngine = require(R('rz-engine.js'));
const SITE = require(process.env.CX_PLAN_MOD || R('js/rz-cx-plan.js')); SITE.RZEngine = globalThis.RZEngine;

const bridge = await import(R('dcmoc/src/lib/cx-plan.ts'));
const storeMod = await import(R('dcmoc/src/store/cxSchedule.ts'));

ok('T1 bridge resolves RZCxPlan and the engine in Node', !!bridge.getCxPlan() && bridge.planSystems().length === 17 && bridge.planLevels().length === 7, { systems: bridge.planSystems().length });

const OVR = [
  {}, { L3: { start: 3.4, months: 1.3 } }, { L2: { crew: 7, shift: '2x12' }, L4: { months: 2 } },
  { L1: { start: 999 }, L5: { months: 0.05 }, L2: { shift: '3x8' } },               /* out of range: must all drop */
  { L0: { start: -1, crew: 0.5 } }, 'garbage'
];
ok('T2 sanitizeOverrides === RZCxPlan.sanitize on 6 fixtures', OVR.every((o) => same(bridge.sanitizeOverrides(o), SITE.sanitize(o))), OVR.map((o) => bridge.sanitizeOverrides(o)));
ok('T2b out-of-range values are dropped, not clamped to the edge', same(bridge.sanitizeOverrides(OVR[3]), {}), bridge.sanitizeOverrides(OVR[3]));

const INPUTS = [
  { itLoadKw: 2000, coolingType: 'air', powerRedundancy: 'N+1', rackDensity: 'standard' },
  { itLoadKw: 40000, coolingType: 'dlc', powerRedundancy: '2N', rackDensity: 'ai_hpc' },
  { itLoadKw: 500, coolingType: 'air', powerRedundancy: 'N', rackDensity: 'medium' }
];
let planOk = true, statusOk = true, planCount = 0;
for (const inp of INPUTS) for (const o of OVR.slice(0, 3)) {
  const a = bridge.computePlan(inp, o), b = SITE.compute(inp, o); planCount++;
  if (!a || !b || !same(a, b)) { planOk = false; continue; }
  for (const m of [0, 2.5, a.finishMonth / 2, a.finishMonth, a.finishMonth + 3]) if (!same(bridge.statusAt(a, m), SITE.statusAt(b, m))) statusOk = false;
}
ok(`T3 computePlan === RZCxPlan.compute on ${planCount} input × override pairs`, planOk);
ok('T4 statusAt rows === site statusAt at 5 months per plan (level, tag, next, inTest, gates)', statusOk);
const p0 = bridge.computePlan(INPUTS[0], {});
ok('T4b the default plan is the engine plan: 7 levels, finish month > 0, 17 status rows', !!p0 && p0.levels.length === 7 && p0.finishMonth > 0 && bridge.statusAt(p0, 0).systems.length === 17, p0 && { levels: p0.levels.length, finish: p0.finishMonth });

/* ---- store ---- */
const { useCxSchedule, parsePersisted, KEY, SCENARIO_CAP } = storeMod;
const S = useCxSchedule; const act = () => S.getState().actions;
act().reset();
act().setOverride('L3', { start: 3.4, months: 1.3 });
ok('T5 setOverride stores the clamped override', same(S.getState().overrides, { L3: { start: 3.4, months: 1.3 } }), S.getState().overrides);
act().setOverride('L3', { start: 999 });
ok('T5b an out-of-range patch is dropped and the other fields stay', same(S.getState().overrides, { L3: { start: 3.4, months: 1.3 } }), S.getState().overrides);
act().setOverride('L1', { shift: '3x8' });
ok('T5c an invalid shift leaves no L1 override', !S.getState().overrides.L1, S.getState().overrides);
act().setSiteCrewCap(20); act().setMonth(4.26);
ok('T5d crew cap and month persist (month to 0.1)', S.getState().siteCrewCap === 20 && S.getState().month === 4.3 && S.getState().persistFailed === false);
const saved = JSON.parse(mem.get(KEY));
ok('T6 persisted payload is version 1 with overrides, cap, month, scenarios', saved.version === 1 && same(saved.overrides, { L3: { start: 3.4, months: 1.3 } }) && saved.siteCrewCap === 20 && Array.isArray(saved.scenarios), saved);
ok('T6b parsePersisted rejects a future version and garbage', parsePersisted(JSON.stringify({ version: 2, overrides: {} })) === null && parsePersisted('{nope') === null && parsePersisted(null) === null);
ok('T6c parsePersisted re-sanitises what it reads (a stored start 999 is dropped)', same(parsePersisted(JSON.stringify({ version: 1, overrides: { L2: { start: 999, months: 2 } }, siteCrewCap: 5000, month: -3 })), { overrides: { L2: { months: 2 } }, siteCrewCap: null, month: 0, scenarios: [], activeScenarioId: null }));
for (let i = 0; i < SCENARIO_CAP + 2; i++) act().saveScenario('Scenario ' + i);
ok(`T7 at most ${SCENARIO_CAP} named scenarios; the ${SCENARIO_CAP + 1}th save returns null`, S.getState().scenarios.length === SCENARIO_CAP && act().saveScenario('x') === null, S.getState().scenarios.length);
const first = S.getState().scenarios[0];
act().clearOverride('L3'); act().setSiteCrewCap(3);
act().loadScenario(first.id);
ok('T7b loadScenario restores its overrides and cap', same(S.getState().overrides, { L3: { start: 3.4, months: 1.3 } }) && S.getState().siteCrewCap === 20 && S.getState().activeScenarioId === first.id);
act().deleteScenario(first.id);
ok('T7c deleteScenario removes it and clears the active id', S.getState().scenarios.length === SCENARIO_CAP - 1 && S.getState().activeScenarioId === null);
ok('T7d an empty name saves nothing', act().saveScenario('   ') === null);
act().reset();
ok('T8 reset empties the store and the storage key', same(S.getState().overrides, {}) && S.getState().scenarios.length === 0 && !mem.has(KEY));
/* the browser side: the layout must load the shared module so window.RZCxPlan exists before the store evaluates */
import { readFileSync } from 'node:fs';
const layout = readFileSync(R('dcmoc/src/app/layout.tsx'), 'utf8');
ok('T9 layout.tsx loads /js/rz-cx-plan.js with a cache token, deferred, after the engine', /rz-engine\.min\.js[^\n]*\n\s*<script src="\/js\/rz-cx-plan\.js\?v=[^"]+" defer><\/script>/.test(layout));
console.log(`DCMOC CX PLAN — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
