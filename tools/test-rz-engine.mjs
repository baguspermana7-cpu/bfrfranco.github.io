#!/usr/bin/env node
/**
 * test-rz-engine.mjs — RZEngine data + model invariants + worked-example harness.
 *
 * Loads rz-engine.js inside a sandboxed VM with a minimal `window` shim, then
 * asserts:
 *   1. Model worked examples (golden values) — proves math correctness + backward-compat.
 *   2. Data invariants — reachability of every cooling type, no negative civil, unit conventions.
 *   3. Provenance — every DATA leaf value carries a source + asOf (via DATA.sources sidecar).
 *
 * Run: node tools/test-rz-engine.mjs      (exit 0 = all pass; exit 1 = any fail)
 *
 * This is a SHIP GATE — see CLAUDE.md. Keep it green on every engine change.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE = resolve(__dirname, '..', 'rz-engine.js');

/* ── Load the engine into a sandbox with a minimal window shim ── */
function loadEngine() {
    const src = readFileSync(ENGINE, 'utf8');
    const win = {};
    // Minimal browser-ish globals the IIFE may touch (localStorage/document/CustomEvent).
    win.window = win;
    win.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    win.CustomEvent = function () {};
    win.dispatchEvent = function () {};
    win.addEventListener = function () {};
    win.removeEventListener = function () {};
    win.console = console;
    const ctx = vm.createContext(win);
    vm.runInContext(src, ctx, { filename: 'rz-engine.js' });
    if (!win.RZEngine) throw new Error('RZEngine did not attach to window');
    return win.RZEngine;
}

/* ── Tiny assertion framework ── */
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
    if (cond) { pass++; }
    else { fail++; fails.push(name + (detail ? ' — ' + detail : '')); }
}
function near(name, got, want, tolFrac) {
    const tol = Math.abs(want * (tolFrac == null ? 0.005 : tolFrac)) + 1e-9;
    ok(name, Math.abs(got - want) <= tol, `got ${got}, want ${want} (±${tol.toFixed(4)})`);
}
function eq(name, got, want) { ok(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }

const E = loadEngine();
const D = E.data;
const M = E.models;

/* ============================================================
 * 1. WORKED EXAMPLES — golden master (backward-compat lock)
 * These values are computed from the CURRENT engine and pinned.
 * When a refresh (A2) intentionally changes an output, update the
 * expected value here in the SAME commit and note why.
 * ============================================================ */

/* workforce */
eq('workforce.annualHiresRequired gap+attrition',
    M.workforce.annualHiresRequired(50, 90, 25, 4), 23);
    // gap 40; attritionLoss 50*0.25=12.5/yr *4=50; (40+50)/4=22.5 → ceil 23
eq('workforce.attritionCost',
    M.workforce.attritionCost(100, 25, 80000, 2.13), 4260000);
    // 100*0.25*80000*2.13 = 4,260,000
ok('workforce.strategyFitScore in [0,1]',
    (function () { const s = M.workforce.strategyFitScore({ ph: true, nc: false }, { phys: 0.6, noc: 0.4 }); return s >= 0 && s <= 1; })());
eq('workforce.cumulativeHires (apprenticeRetention default)',
    M.workforce.cumulativeHires(20, 4, null), Math.round(20 * 4 * D.attritionFactors.apprenticeRetention));

/* roi */
near('roi.paybackPeriod', M.roi.paybackPeriod(1000000, 400000, 100000), 1000000 / 300000, 0.001);
eq('roi.paybackPeriod never recovered', M.roi.paybackPeriod(1000, 50, 50), Infinity);
near('roi.npv 10% 3yr', M.roi.npv([-1000, 500, 500, 500], 0.10), 243.426, 0.01);
{
    const irr = M.roi.irr([-1000, 500, 500, 500], 0.1);
    ok('roi.irr ~23.4%', irr != null && Math.abs(irr - 0.2337) < 0.005, `got ${irr}`);
}

/* forecast */
near('forecast.compoundGrowth 100 @5% 3yr', M.forecast.compoundGrowth(100, 0.05, 3), 115.7625, 0.001);
{
    const t = M.forecast.linearTrend([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }]);
    near('forecast.linearTrend slope', t.slope, 2, 0.001);
    near('forecast.linearTrend predict(4)', t.predict(4), 8, 0.001);
}
{
    const proj = M.forecast.projectByYear(100, 0.10, 2025, 2027);
    eq('forecast.projectByYear length', proj.length, 3);
    eq('forecast.projectByYear[0]', proj[0].value, 100);
    eq('forecast.projectByYear[2]', proj[2].value, 121);
}

/* capex */
{
    const bc = M.capex.datacenterBuildCost(10, 3, 'US');
    eq('capex.datacenterBuildCost 10MW T3 US', bc, 10 * D.capexPerMw.airCooledTier3 * D.regions.US.salaryMult);
    const tc = M.capex.totalCost(10, 3, 'US', {});
    ok('capex.totalCost civil >= 0 (US T3 10MW)', tc.civil >= 0, `civil=${tc.civil}`);
    ok('capex.totalCost it+mep+civil = base (no contingency double-count)',
        Math.abs((tc.it + tc.mep + tc.civil) - tc.base) <= 2, `sum=${tc.it + tc.mep + tc.civil} base=${tc.base}`);
    ok('capex.totalCost base + contingency = total',
        Math.abs((tc.base + tc.contingency) - tc.total) <= 2, `base+cont=${tc.base + tc.contingency} total=${tc.total}`);
    ok('capex.totalCost perMwCost > 0', tc.perMwCost > 0);
    // cooling reachability — immersion must be pricier than air (A5-44)
    const tcAir = M.capex.totalCost(10, 3, 'US', { cooling: 'air' });
    const tcImm = M.capex.totalCost(10, 3, 'US', { cooling: 'immersion' });
    ok('capex cooling reachable: immersion > air', tcImm.total > tcAir.total, `imm=${tcImm.total} air=${tcAir.total}`);
    // AI density scaling (A6-51)
    const tcAI = M.capex.totalCost(10, 3, 'US', { aiDensity: 'ai' });
    ok('capex AI-density scales up', tcAI.total > tcAir.total, `ai=${tcAI.total} air=${tcAir.total}`);
}

/* opex */
{
    const pc = M.opex.powerCostAnnual(10, 1.5, 0.12);
    eq('opex.powerCostAnnual 10MW pue1.5 $0.12', pc, Math.round(10 * 1000 * 1.5 * D.hoursPerYear * 0.12));
    const ta = M.opex.totalAnnual(10, 1.58, 'US', 20, { capex: 100000000 });
    ok('opex.totalAnnual total > 0', ta.total > 0);
    ok('opex.totalAnnual maintenance = 2% capex', ta.maintenance === Math.round(100000000 * 0.02), `maint=${ta.maintenance}`);
}

/* tco */
{
    const life = M.tco.lifecycle(100000000, 10000000, 10, 0.40);
    eq('tco.lifecycle 100M cap 10M opex 10yr', life, Math.round(100000000 + 10000000 * 10 + 100000000 * 0.40 * 2));
    const cf = M.tco.cashflows(100000000, 10000000, 10, 12000000, 0.40);
    eq('tco.cashflows length', cf.length, 11);
    eq('tco.cashflows[0] = -capex', cf[0], -100000000);
}

/* pue */
near('pue.pueFromInputs 15/10', M.pue.pueFromInputs(10, 15), 1.5, 0.001);
near('pue.dcie(1.5)', M.pue.dcie(1.5), 0.6667, 0.001);

/* ── Stage-3 new-capability worked examples ── */
/* roi */
{
    const dp = M.roi.discountedPayback([-1000, 400, 400, 400, 400], 0.10);
    ok('roi.discountedPayback finite & > simple', isFinite(dp) && dp > 2.5 && dp < 4, `got ${dp}`);
    const na = M.roi.npvAuto([-1000, 500, 500, 500], 'US');
    const nExplicit = M.roi.npv([-1000, 500, 500, 500], D.discountDefaults.US);
    near('roi.npvAuto uses regional WACC', na, nExplicit, 0.001);
    const irrG = M.roi.irr([-1000, 600, 600], 0.2);
    ok('roi.irr honors guess & converges', irrG != null && Math.abs(M.roi.npv([-1000,600,600], irrG)) < 1e-2, `irr=${irrG}`);
}
/* forecast */
{
    const t = M.forecast.linearTrend([{x:1,y:2},{x:2,y:4},{x:3,y:6}]);
    near('forecast.linearTrend r2 perfect', t.r2, 1, 0.001);
    const b = t.band(4); ok('forecast band brackets mid', b.lo <= b.mid && b.mid <= b.hi);
    const proj = M.forecast.projectByYear(100, 0.05, 2026, 2028, { useInflation: true, region: 'US' });
    ok('forecast inflation raises projection', proj[2].value > M.forecast.projectByYear(100,0.05,2026,2028)[2].value);
    const sb = M.forecast.scenarioBands(100, { low:0, base:0.05, high:0.10 }, 2026, 2028);
    ok('forecast scenarioBands ordered high>=base>=low', sb[2].high >= sb[2].base && sb[2].base >= sb[2].low);
}
/* tco */
{
    const npvTco = M.tco.lifecycleNPV(100000000, 10000000, 10, { region: 'US', salvagePct: 0.1 });
    const undisc = M.tco.lifecycle(100000000, 10000000, 10, 0.40);
    ok('tco.lifecycleNPV < undiscounted (discounting shrinks future)', npvTco < undisc, `npv=${npvTco} undisc=${undisc}`);
}
/* pue */
{
    near('pue.defaultFor air T3', M.pue.defaultFor('air', 3), D.pueMatrix.air.tier3, 0.001);
    near('pue.defaultFor immersion T3', M.pue.defaultFor('immersion', 3), D.pueMatrix.immersion.tier3, 0.001);
    ok('pue.partialLoadPUE degrades at low load', M.pue.partialLoadPUE(1.5, 0.4) > M.pue.partialLoadPUE(1.5, 1.0));
    near('pue.wue immersion', M.pue.wue('immersion'), D.water.wueByType.immersion, 0.001);
    // A6-57 de-dup: annualEnergyCost(itKw) == opex.powerCostAnnual(itKw/1000)
    near('pue.annualEnergyCost delegates to opex power',
        M.pue.annualEnergyCost(10000, 1.5, 0.09), M.opex.powerCostAnnual(10, 1.5, 0.09), 0.001);
}
/* workforce */
{
    const hp = M.workforce.hiringPlan(50, 90, 4, { attritionRate: 25 });
    ok('workforce.hiringPlan reaches ~target base', hp.perYear[3].base >= 85, `endBase=${hp.perYear[3].base}`);
    ok('workforce.hiringPlan totalHires > flat gap', hp.totalHires > 40);
    const cw = M.workforce.attritionCostWeighted(25, [{count:10,salary:80000},{count:2,salary:160000,replacementMult:2.5}]);
    ok('workforce.attritionCostWeighted > 0', cw > 0);
    const comp = M.workforce.cumulativeHiresCompounded(20, 4, 0.78);
    const flat = M.workforce.cumulativeHires(20, 4, 0.78);
    ok('cumulativeHiresCompounded < flat estimate', comp < flat, `comp=${comp} flat=${flat}`);
}

/* ── Stage-4: sim + carbon/water + charts ── */
{
    const mc = M.sim.monteCarlo(s => s.a + s.b, { a: { dist: 'uniform', min: 0, max: 10 }, b: { dist: 'normal', mean: 5, sd: 1 } }, 1000);
    ok('sim.monteCarlo p10<=p50<=p90', mc.p10 <= mc.p50 && mc.p50 <= mc.p90, `${mc.p10}/${mc.p50}/${mc.p90}`);
    const mc2 = M.sim.monteCarlo(s => s.a, { a: { dist: 'uniform', min: 0, max: 1 } }, 500, 42);
    const mc3 = M.sim.monteCarlo(s => s.a, { a: { dist: 'uniform', min: 0, max: 1 } }, 500, 42);
    ok('sim.monteCarlo deterministic w/ seed', mc2.p50 === mc3.p50);
    const tor = M.sim.tornado(inp => inp.x * 2 + inp.y, { x: 5, y: 5 }, { x: { lo: 0, hi: 10 }, y: { lo: 4, hi: 6 } });
    ok('sim.tornado ranks x above y', tor[0].key === 'x');
    const grid = M.sim.sensitivityGrid(inp => inp.a + inp.b, { a: 0, b: 0 }, 'a', { lo: 0, hi: 1 }, 'b', { lo: 0, hi: 1 }, 4);
    ok('sim.sensitivityGrid shape', grid.z.length === 5 && grid.z[0].length === 5);
}
{
    const t = E.models.carbon.annualTonnes(10, 1.5, 'US');
    near('carbon.annualTonnes 10MW 1.5PUE US', t, 10 * 1000 * 1.5 * D.hoursPerYear * D.carbon.gridFactor.US / 1000, 0.01);
    ok('carbon.annualCost > 0', E.models.carbon.annualCost(10, 1.5, 'US') > 0);
    ok('carbon.embodiedTonnes = mw*embodiedPerMw', E.models.carbon.embodiedTonnes(10) === 10 * D.carbon.embodiedPerMw);
    ok('water.annualM3 immersion < air', E.models.water.annualM3(10, 'immersion') < E.models.water.annualM3(10, 'air'));
    ok('water.annualCost > 0', E.models.water.annualCost(10, 'air', 'US') > 0);
}
{
    const svg = E.charts.histogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    ok('charts.histogram returns <svg>', typeof svg === 'string' && svg.indexOf('<svg') === 0 && svg.indexOf('<rect') > 0);
    const tor = E.charts.tornado(M.sim.tornado(inp => inp.x, { x: 1 }, { x: { lo: 0, hi: 2 } }));
    ok('charts.tornado returns <svg>', tor.indexOf('<svg') === 0);
    ok('charts.roiLine returns <svg>', E.charts.roiLine([{ x: 0, y: -10 }, { x: 1, y: 5 }, { x: 2, y: 20 }]).indexOf('<svg') === 0);
    ok('charts.costStackedBar returns <svg>', E.charts.costStackedBar([{ label: 'A', parts: [1, 2, 3] }], ['a', 'b', 'c']).indexOf('<svg') === 0);
    ok('charts.hiringTrajectory returns <svg>', E.charts.hiringTrajectory([{ year: 1, base: 10 }, { year: 2, base: 20 }]).indexOf('<svg') === 0);
    ok('charts.sensitivity returns <svg>', E.charts.sensitivity(M.sim.sensitivityGrid(i => i.a + i.b, {a:0,b:0}, 'a', {lo:0,hi:1}, 'b', {lo:0,hi:1}, 3)).indexOf('<svg') === 0);
}

/* ============================================================
 * 2. DATA INVARIANTS
 * ============================================================ */
ok('DATA.version present', typeof D.version === 'string');
ok('regions all have currency', Object.keys(D.regions).every(k => !!D.regions[k].currency));
ok('every region currency resolvable in DATA.currency',
    Object.keys(D.regions).every(k => D.currency[D.regions[k].currency] != null),
    'a region references a currency missing from DATA.currency');
ok('capexPerMw all tiers present for air',
    ['airCooledTier2', 'airCooledTier3', 'airCooledTier4'].every(k => D.capexPerMw[k] > 0));

/* ============================================================
 * 2b. EXPANSION TABLES (A3) — presence + internal consistency
 * ============================================================ */
if (D.regionsCountry) {
    const rc = D.regionsCountry;
    ok('regionsCountry has ID/SG/JP/IN/MY',
        ['ID', 'SG', 'JP', 'IN', 'MY'].every(k => rc[k] && rc[k].powerKwh > 0));
    ok('every country region currency resolvable',
        Object.keys(rc).every(k => D.currency[rc[k].currency] != null),
        'a country region references a currency missing from DATA.currency');
    // carbon / water / land / labor should cover the macro regions at minimum
    ok('carbon.gridFactor covers macro regions',
        ['US', 'EU', 'APAC', 'LATAM'].every(k => D.carbon.gridFactor[k] > 0));
    ok('water.wueByType has 4 cooling types',
        ['air', 'rearDoor', 'directToChip', 'immersion'].every(k => D.water.wueByType[k] > 0));
    ok('aiDensity ai > hpc > legacy kW/rack',
        D.aiDensity.ai.kwPerRack > D.aiDensity.hpc.kwPerRack && D.aiDensity.hpc.kwPerRack > D.aiDensity.legacy.kwPerRack);
    ok('capexPerMw liquid/immersion tier matrix filled',
        ['liquidCooledTier2', 'liquidCooledTier3', 'liquidCooledTier4',
         'immersionTier2', 'immersionTier3', 'immersionTier4'].every(k => D.capexPerMw[k] > 0));
    ok('tiers I–IV present with capexMult',
        [1, 2, 3, 4].every(t => D.tiers[t] && D.tiers[t].capexMult > 0));
    ok('discountDefaults.global > 0', D.discountDefaults && D.discountDefaults.global > 0);
    ok('pueMatrix immersion < liquid < air (tier3)',
        D.pueMatrix.immersion.tier3 < D.pueMatrix.liquid.tier3 && D.pueMatrix.liquid.tier3 < D.pueMatrix.air.tier3);
}

/* ============================================================
 * 3. PROVENANCE (soft until A1 lands the sidecar; hard after)
 * ============================================================ */
if (D.sources) {
    ok('DATA.meta present', !!D.meta && !!D.meta.schemaVersion);
    // Every sources entry must carry source + asOf
    const bad = Object.keys(D.sources).filter(k => {
        const s = D.sources[k];
        return !s || !s.source || !s.asOf;
    });
    ok('every DATA.sources entry has source + asOf', bad.length === 0, bad.join(', '));
} else {
    console.log('  (provenance sidecar DATA.sources not present yet — A1 pending)');
}

/* ── report ── */
console.log(`\nRZ-ENGINE TEST — ${pass} passed, ${fail} failed`);
if (fail) {
    console.log('\nFAILURES:');
    fails.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
}
console.log('ALL GREEN — model worked examples + data invariants hold.');
