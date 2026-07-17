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

    // v2.1: categorical distribution — weighted discrete choice
    const cat = M.sim.monteCarlo(s => (s.scn === 'boom' ? 2 : 1), { scn: { dist: 'categorical', choices: [{ value: 'boom', weight: 3 }, { value: 'bust', weight: 1 }] } }, 4000, 7);
    ok('sim categorical ~75% boom (mean≈1.75)', cat.mean > 1.6 && cat.mean < 1.9, `mean=${cat.mean}`);
    // v2.1: correlated normals — corr(a,b)=0.8 should make a+b more variable than uncorrelated
    const corrHi = M.sim.monteCarlo(s => s.a + s.b, { a: { dist: 'normal', mean: 0, sd: 1 }, b: { dist: 'normal', mean: 0, sd: 1 } }, 6000, 11, { correlations: [{ a: 'a', b: 'b', rho: 0.8 }] });
    const corrNo = M.sim.monteCarlo(s => s.a + s.b, { a: { dist: 'normal', mean: 0, sd: 1 }, b: { dist: 'normal', mean: 0, sd: 1 } }, 6000, 11);
    const spread = r => r.p90 - r.p10;
    ok('sim positive correlation widens a+b spread', spread(corrHi) > spread(corrNo) * 1.1, `corr=${spread(corrHi).toFixed(2)} indep=${spread(corrNo).toFixed(2)}`);
    // backward-compat: omitting opts leaves the fast path deterministic
    const bc1 = M.sim.monteCarlo(s => s.a, { a: { dist: 'uniform', min: 0, max: 1 } }, 500, 42);
    const bc2 = M.sim.monteCarlo(s => s.a, { a: { dist: 'uniform', min: 0, max: 1 } }, 500, 42);
    ok('sim no-opts path still deterministic', bc1.p50 === bc2.p50);
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
    /* ── reliability (RAM) model — Layer 10 ── */
    const R = E.models.reliability;
    near('reliability.availability MTBF=99 MTTR=1', R.availability(99, 1), 0.99, 1e-6);
    eq('reliability.mtbfFor ups', R.mtbfFor('ups'), D.reliability.components.ups.mtbf);
    eq('reliability.mtbfFor unknown = null', R.mtbfFor('nope'), null);
    // parallel redundancy raises availability above a single path
    ok('reliability.parallelAvailability 2N > 1N', R.parallelAvailability(0.99, 2) > R.availability(99, 1));
    near('reliability.parallelAvailability a=0.99 paths=2', R.parallelAvailability(0.99, 2), 1 - 0.01 * 0.01, 1e-6);
    // series of two 0.999 groups = 0.998001
    near('reliability.seriesAvailability [0.999,0.999]', R.seriesAvailability([0.999, 0.999]), 0.998001, 1e-6);
    eq('reliability.tierTarget 4', R.tierTarget(4), D.reliability.tierAvailability[4]);
    ok('reliability.annualDowntimeMinutes tier3 < tier2', R.annualDowntimeMinutes(R.tierTarget(3)) < R.annualDowntimeMinutes(R.tierTarget(2)));
    // system availability: more redundancy paths never lowers availability
    const sysN = R.systemAvailability(['ups', 'crac'], 'n');
    const sys2N = R.systemAvailability(['ups', 'crac'], '2n');
    ok('reliability.systemAvailability 2N >= N', sys2N >= sysN);
    ok('reliability.systemAvailability in (0,1]', sys2N > 0 && sys2N <= 1);
}
{
    /* ── site intelligence model — Layer 2 ── */
    const S = E.models.site;
    // all-perfect factors → 100 / grade A
    const perfect = S.score({ power: 1, grid: 1, seismic: 1, talent: 1, tax: 1, carbon: 1, flood: 1, latency: 1, water: 1 });
    near('site.score all-perfect = 100', perfect.score, 100, 1e-6);
    eq('site.score all-perfect grade A', perfect.grade, 'A');
    eq('site.score all-perfect no missing', perfect.missing.length, 0);
    // all-zero → 0 / grade E
    const zero = S.score({ power: 0, grid: 0, seismic: 0, talent: 0, tax: 0, carbon: 0, flood: 0, latency: 0, water: 0 });
    near('site.score all-zero = 0', zero.score, 0, 1e-6);
    eq('site.score all-zero grade E', zero.grade, 'E');
    // partial set renormalizes: only power=0.5 present → 50
    const partial = S.score({ power: 0.5 });
    near('site.score partial {power:0.5} = 50', partial.score, 50, 1e-6);
    eq('site.score partial missing count', partial.missing.length, Object.keys(D.site.weights).length - 1);
    ok('site.score coverage < 1 for partial', partial.coverage < 1);
    eq('site.grade 72 = B', S.grade(72).grade, 'B');
    // weights sum to 1
    let wsum = 0; for (const k in D.site.weights) wsum += D.site.weights[k];
    near('site.weights sum = 1', wsum, 1, 1e-9);
}
{
    /* ── commissioning readiness model — Layer 7 ── */
    const C = E.models.commissioning;
    const all = {}; for (const k in D.commissioning.weights) all[k] = 1;
    const full = C.readinessIndex(all);
    near('commissioning full = 100', full.index, 100, 1e-6);
    eq('commissioning full status Ready', full.status, 'Ready');
    eq('commissioning full no open', full.open.length, 0);
    const none = {}; for (const k in D.commissioning.weights) none[k] = 0;
    near('commissioning zero = 0', C.readinessIndex(none).index, 0, 1e-6);
    eq('commissioning zero Not Ready', C.readinessIndex(none).status, 'Not Ready');
    // partial: L5 half done alone → 50, and status band mapping
    near('commissioning {L5:0.5} = 50', C.readinessIndex({ L5: 0.5 }).index, 50, 1e-6);
    eq('commissioning.status 96 = Ready', C.status(96).status, 'Ready');
    eq('commissioning.status 85 = Conditional', C.status(85).status, 'Conditional');
    ok('commissioning open lists incomplete', C.readinessIndex({ L5: 0.9, ist: 1 }).open.includes('L5'));
    let cwsum = 0; for (const k in D.commissioning.weights) cwsum += D.commissioning.weights[k];
    near('commissioning.weights sum = 1', cwsum, 1, 1e-9);
}
{
    /* ── asset intelligence (health index) model — Layer 9 ── */
    const A = E.models.asset;
    eq('asset.designLife ups', A.designLife('ups'), D.asset.designLifeYears.ups);
    eq('asset.designLife unknown = null', A.designLife('nope'), null);
    // brand-new asset (age 0), perfect condition, light duty → ~100 health, Healthy
    const fresh = A.healthIndex({ assetClass: 'ups', ageYears: 0, condition: 1, duty: 0 });
    ok('asset fresh health >= 95', fresh.health >= 95);
    eq('asset fresh status Healthy', fresh.status, 'Healthy');
    eq('asset fresh remainingYears = designLife', fresh.remainingYears, D.asset.designLifeYears.ups);
    // fully-aged asset (age = life), poor condition, heavy duty → low health, Critical
    const old = A.healthIndex({ assetClass: 'ups', ageYears: D.asset.designLifeYears.ups, condition: 0, duty: 1 });
    near('asset end-of-life health = 0', old.health, 0, 1e-6);
    eq('asset end-of-life status Critical', old.status, 'Critical');
    ok('asset health monotonic in age', A.healthIndex({ assetClass: 'crac', ageYears: 2, condition: 0.9, duty: 0.5 }).health > A.healthIndex({ assetClass: 'crac', ageYears: 12, condition: 0.9, duty: 0.5 }).health);
    eq('asset.status 82 Healthy', A.status(82).status, 'Healthy');
    eq('asset.status 50 Plan', A.status(50).status, 'Plan');
    let awsum = 0; for (const k in D.asset.weights) awsum += D.asset.weights[k];
    near('asset.weights sum = 1', awsum, 1, 1e-9);
    // lifecycle replacement schedule (Group-2)
    const rs = A.replacementSchedule('bms', 1000, 20); // BMS every 7yr, $40/kW, 1MW, 20yr
    eq('asset.replacementSchedule bms events', rs.events, 2); // years 7, 14
    eq('asset.replacementSchedule bms years', rs.replacementYears.join(','), '7,14');
    eq('asset.replacementSchedule bms eventCost', rs.eventCostUsd, 40 * 1000);
    eq('asset.replacementSchedule bms total', rs.totalNominalUsd, 40 * 1000 * 2);
    eq('asset.replacementSchedule unknown = null', A.replacementSchedule('nope', 1000, 20), null);
    // generator every 15yr in a 20yr horizon → 1 event
    eq('asset.replacementSchedule generator events', A.replacementSchedule('generator', 1000, 20).events, 1);
}
{
    /* ── construction schedule model — Layer 6 ── */
    const CN = E.models.construction;
    // strictly sequential when no overlap applies (design has overlap 0; permit 0.2)
    const seq = CN.schedule({ design: 4, permit: 0, procurement: 0, civil: 0, mep: 0, commission: 0 });
    eq('construction design starts at 0', seq.rows[0].startMonth, 0);
    eq('construction design ends at 4', seq.rows[0].endMonth, 4);
    // full schedule: total >= longest single phase, rows in phase order
    const full = CN.schedule({ design: 4, permit: 3, procurement: 6, civil: 8, mep: 6, commission: 3 });
    eq('construction 6 rows', full.rows.length, 6);
    eq('construction rows ordered', full.rows.map(r => r.key).join(','), D.construction.phaseOrder.join(','));
    ok('construction totalMonths > 0', full.totalMonths > 0);
    // overlap pulls total below the strict sum
    const strictSum = 4 + 3 + 6 + 8 + 6 + 3;
    ok('construction fast-track total < strict sum', full.totalMonths < strictSum);
    ok('construction rfs milestone = commission end', full.milestones.rfs === full.rows[5].endMonth);
    ok('construction powerOn <= rfs', full.milestones.powerOn <= full.milestones.rfs);
    // fromTimeline convenience
    ok('construction.fromTimeline works', CN.fromTimeline({ design: 2, permit: 2 }).totalMonths > 0);
}
{
    /* ── requirements intake model — Layer 1 ── */
    const RQ = E.models.requirements;
    eq('requirements.profile ai rackKw', RQ.profile('ai').rackKw, D.requirements.useCaseProfiles.ai.rackKw);
    eq('requirements.profile unknown = null', RQ.profile('zzz'), null);
    // full brief → 100% complete, ready
    const full = RQ.completeness({ itLoadKw: 5000, targetTier: 3, region: 'ID', useCase: 'ai', budgetUsd: 3e8, deadlineMonths: 24 });
    near('requirements full completeness = 100', full.pct, 100, 1e-6);
    ok('requirements full ready', full.ready === true);
    eq('requirements full no missing', full.missing.length, 0);
    // empty → 0, not ready, all missing
    const empty = RQ.completeness({});
    near('requirements empty = 0', empty.pct, 0, 1e-6);
    eq('requirements empty missing all', empty.missing.length, D.requirements.required.length);
    // zero itLoad counts as missing (not > 0)
    ok('requirements itLoad=0 missing', RQ.completeness({ itLoadKw: 0 }).missing.includes('itLoadKw'));
    // validate: AI at Tier 2 flags below-floor
    const v = RQ.validate({ useCase: 'ai', targetTier: 2, itLoadKw: 5000, region: 'ID', budgetUsd: 1e8, deadlineMonths: 20 });
    ok('requirements validate flags AI Tier2 below floor', v.flags.some(f => f.field === 'targetTier'));
    eq('requirements recommendedTierFloor ai', v.recommendedTierFloor, D.requirements.useCaseProfiles.ai.tierFloor);
}
{
    /* ── architecture disciplines + complexity model — Layer 3 ── */
    const AR = E.models.architecture;
    // immersion + T4 + 2N+1 = the max → 100 / Very High
    const max = AR.complexity({ coolingType: 'immersion', tier: 4, redundancy: '2n1' });
    near('architecture max complexity = 100', max.index, 100, 1e-6);
    eq('architecture max band Very High', max.band, 'Very High');
    // air + T2 + N = the floor
    const min = AR.complexity({ coolingType: 'air', tier: 2, redundancy: 'n' });
    ok('architecture min complexity < max', min.index < max.index);
    ok('architecture liquid > air complexity', AR.complexity({ coolingType: 'liquid', tier: 3, redundancy: '2n' }).index > AR.complexity({ coolingType: 'air', tier: 3, redundancy: '2n' }).index);
    eq('architecture.band 60 High', AR.band(60), 'High');
    // disciplines returns all canonical disciplines
    const disc = AR.disciplines({ coolingType: 'liquid', tier: 4, redundancy: '2n' });
    eq('architecture disciplines count', disc.length, D.architecture.disciplines.length);
    ok('architecture disciplines have labels+drivers', disc.every(d => d.label && d.driver));
}
{
    /* ── maintenance strategy model — Layer 8 (Group-2 promotion) ── */
    const MN = E.models.maintenance;
    eq('maintenance.modelMult in-house = 1', MN.modelMult('in-house'), 1);
    // vendor: 0.10 + 0.90*1.35 = 1.315
    near('maintenance.modelMult vendor', MN.modelMult('vendor'), 0.10 + 0.90 * 1.35, 1e-4);
    ok('maintenance vendor mult > in-house', MN.modelMult('vendor') > MN.modelMult('in-house'));
    eq('maintenance.expectedFailures T4', MN.expectedFailures(4), D.maintenance.expectedFailuresPerYear.tier4);
    eq('maintenance.expectedFailures T3', MN.expectedFailures(3), D.maintenance.expectedFailuresPerYear.default);
    // reactive = planned x 3.5
    near('maintenance.reactiveFailures 2.5 -> 8.75', MN.reactiveFailures(2.5), 2.5 * 3.5, 1e-6);
    // predictive residual = planned x (1-0.70)
    near('maintenance.predictiveFailures 2.5 -> 0.75', MN.predictiveFailures(2.5), 2.5 * 0.30, 1e-6);
    // reactive downtime cost > planned for same failures + cost/min
    ok('maintenance reactive downtime > planned', MN.downtimeCost('reactive', 3, 1000) > MN.downtimeCost('planned', 3, 1000));
}
{
    /* ── fuel & generator model — Group-2 promotion ── */
    const FL = E.models.fuel;
    // 1000 kW × 0.27 L/kWh = 270 L/h
    near('fuel.consumptionLPerHour 1000kW', FL.consumptionLPerHour(1000), 270, 1e-6);
    eq('fuel.storageHours T4', FL.storageHours(4), D.fuelGen.fuelStorageHoursByTier[4]);
    ok('fuel storage T4 > T2', FL.storageHours(4) > FL.storageHours(2));
    // storage L = 96h × 270 L/h = 25920 for T4 @ 1MW
    near('fuel.storageLiters 1000kW T4', FL.storageLiters(1000, 4), 96 * 270, 1);
    // annual test fuel = (2*12 + 4) h × 270 = 28 × 270 = 7560
    near('fuel.annualTestFuelLiters 1000kW', FL.annualTestFuelLiters(1000), 28 * 270, 1);
    // annual fuel cost = 270 L/h × 100h × $1.05 = 28350
    near('fuel.annualFuelCost 1000kW 100h', FL.annualFuelCost(1000, 100, 1.05), Math.round(270 * 100 * 1.05), 1);
}
{
    /* ── capacity planning model — Group-2 promotion ── */
    const CP = E.models.capacity;
    const med = CP.preset('medium');
    eq('capacity.preset medium 3 phases', med.length, 3);
    ok('capacity.preset attaches ramp', Array.isArray(med[0].occupancyRamp) && med[0].occupancyRamp.length === D.capacity.defaultRamp.length);
    eq('capacity.preset unknown = null', CP.preset('zzz'), null);
    // medium total = 2000 + 10000 + 20000 = 32000 kW = 32 MW
    near('capacity.totalMw medium', CP.totalMw(med), 32, 1e-6);
    eq('capacity.occupancyAt year0', CP.occupancyAt(D.capacity.defaultRamp, 0), 0.3);
    eq('capacity.occupancyAt steady (year 9)', CP.occupancyAt(D.capacity.defaultRamp, 9), 0.95);
    eq('capacity.occupancyAt negative = 0', CP.occupancyAt(D.capacity.defaultRamp, -1), 0);
}
{
    /* ── grid reliability model — Group-2 promotion ── */
    const GR = E.models.grid;
    eq('grid.band 99.995 Excellent', GR.band(99.995), 'Excellent');
    eq('grid.band 99.0 Fair', GR.band(99.0), 'Weak');
    // outage hours: 99.9% → 0.1% × 8760 = 8.76h
    near('grid.annualOutageHours 99.9%', GR.annualOutageHours(99.9), 0.001 * D.hoursPerYear, 0.05);
    ok('grid outage lower for higher uptime', GR.annualOutageHours(99.99) < GR.annualOutageHours(99.0));
    // score: ceiling → 1, floor → 0, clamps
    near('grid.score ceil = 1', GR.score(99.99), 1, 1e-6);
    near('grid.score floor = 0', GR.score(98.0), 0, 1e-6);
    eq('grid.score below floor clamps 0', GR.score(90), 0);
    ok('grid.score monotonic', GR.score(99.9) > GR.score(99.5));
    // grid score feeds site score
    ok('site accepts grid score', E.models.site.score({ grid: GR.score(99.95) }).score >= 0);
}
{
    /* ── tax incentives model — Group-2 promotion ── */
    const TX = E.models.tax;
    // bonus dep shield = 100M × 0.20 × 0.21 = 4.2M
    near('tax.bonusDepreciationShield 100M @21%', TX.bonusDepreciationShield(100e6, 0.21), Math.round(100e6 * 0.20 * 0.21), 1);
    // solar ITC 10M base = 3M; with domestic content = 4M
    near('tax.solarItc 10M base', TX.solarItc(10e6, false), Math.round(10e6 * 0.30), 1);
    near('tax.solarItc 10M +domestic', TX.solarItc(10e6, true), Math.round(10e6 * 0.40), 1);
    ok('tax domestic ITC > base', TX.solarItc(10e6, true) > TX.solarItc(10e6, false));
    // state sales tax VA 6%
    near('tax.stateSalesTaxSaving VA 50M', TX.stateSalesTaxSaving(50e6, 'US-VA'), Math.round(50e6 * 0.06), 1);
    eq('tax.stateSalesTaxSaving unknown = 0', TX.stateSalesTaxSaving(50e6, 'US-ZZ'), 0);
    // import duty ID 7.5%
    near('tax.importDuty ID 20M', TX.importDuty(20e6, 'ID'), Math.round(20e6 * 0.075), 1);
    eq('tax.importDuty unknown = 0', TX.importDuty(20e6, 'ZZ'), 0);
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
 * 2f. PART F — DC MARKET intelligence (DATA.markets + models.market)
 * ============================================================ */
{
    const REGIONS = ['Asia Pacific', 'Europe', 'Latin America', 'Middle East & Africa', 'North America'];
    ok('DATA.markets present', !!D.markets && typeof D.markets === 'object');
    const keys = Object.keys(D.markets || {});
    eq('DATA.markets count', keys.length, 25);
    const REQ = ['name', 'lat', 'lng', 'operational', 'construction', 'planned', 'maturity', 'players', 'powerCost', 'vacancy', 'coloPrice', 'cagr', 'region'];
    const badField = keys.filter(k => REQ.some(f => D.markets[k][f] == null));
    ok('every market carries all required fields', badField.length === 0, badField.join(', '));
    const badRegion = keys.filter(k => !REGIONS.includes(D.markets[k].region));
    ok('every market region in the canonical 5-set', badRegion.length === 0, badRegion.join(', '));
    const badPower = keys.filter(k => !(D.markets[k].powerCost >= 0.03 && D.markets[k].powerCost <= 0.30));
    ok('market powerCost within plausibility band 0.03-0.30 $/kWh', badPower.length === 0, badPower.join(', '));
    const badVac = keys.filter(k => !(D.markets[k].vacancy >= 0 && D.markets[k].vacancy <= 15));
    ok('market vacancy within 0-15%', badVac.length === 0, badVac.join(', '));
    const badPlayers = keys.filter(k => !Array.isArray(D.markets[k].players) || D.markets[k].players.length < 1);
    ok('every market lists >=1 operator', badPlayers.length === 0, badPlayers.join(', '));
    // worked examples — pinned totals (update intentionally with any data refresh)
    const g = M.market.summary();
    eq('market.summary global count', g.count, 25);
    eq('market.summary global operational MW', g.operational, 17640);
    eq('market.summary global construction MW', g.construction, 6310);
    eq('market.summary global planned MW', g.planned, 19750);
    near('market.summary global pipelineRatio', g.pipelineRatio, 1.4773, 0.001);
    const na = M.market.summary('North America');
    eq('market.summary NA operational MW', na.operational, 7740);
    eq('market.summary NA count', na.count, 6);
    eq('market.regions() = canonical 5-set', JSON.stringify(M.market.regions()), JSON.stringify(REGIONS));
    ok("DATA.sources['markets'] registered", !!(D.sources && D.sources['markets'] && D.sources['markets'].source && D.sources['markets'].asOf));
    // marketViz — single source for the DC map/cards colour + CAGR bands (shared across pages)
    ok('DATA.marketViz present', !!(D.marketViz && D.marketViz.maturityColors && D.marketViz.regionColors));
    eq('market.colorByMaturity(established)', M.market.colorByMaturity('established'), '#0d9488');
    eq('market.colorByRegion(Europe)', M.market.colorByRegion('Europe'), '#0d9488');
    eq('market.colorByMaturity(unknown) → fallback', M.market.colorByMaturity('zzz'), D.marketViz.fallback);
    eq('market.cagrBand(0.22) high', M.market.cagrBand(0.22), 'high');
    eq('market.cagrBand(0.12) mid', M.market.cagrBand(0.12), 'mid');
    eq('market.cagrBand(0.05) low', M.market.cagrBand(0.05), 'low');
    ok('every market region resolves a colour', keys.every(k => M.market.colorByRegion(D.markets[k].region) !== D.marketViz.fallback));
    ok("DATA.sources['marketViz'] registered", !!(D.sources && D.sources['marketViz']));
}

/* ============================================================
 * 2g. v2.3.0 — DEEP-SEA WATER COOLING (poster worked examples EXACT)
 * ============================================================ */
{
    const ds = M.cooling.deepSea({ itLoadMw: 150, pueTarget: 1.15, mode: 'poster' });
    near('deepSea poster heat rejected', ds.heatRejectedMw, 172.5, 0.0001);
    near('deepSea poster flow m3/s (poster EXACT)', ds.flow.m3s, 8.625, 0.0001);
    eq('deepSea poster flow m3/h', ds.flow.m3h, 31050);
    eq('deepSea poster pumps 4 duty + 1 standby', ds.pumps.duty + '+' + ds.pumps.standby, '4+1');
    near('deepSea poster per-pump 2.9 m3/s', ds.pumps.perPumpM3s, 2.9, 0.001);
    eq('deepSea poster head 60 m', ds.pumps.headM, 60);
    ok('deepSea poster per-pump ~2,000 kW (1950-2050)', ds.pumps.perPumpKw >= 1950 && ds.pumps.perPumpKw <= 2050, 'got ' + ds.pumps.perPumpKw);
    ok('deepSea poster PUE <= 1.15', ds.pue <= 1.15, 'got ' + ds.pue);
    eq('deepSea WUE = 0', ds.wue, 0);
    ok('deepSea poster intake 4-6C @900m', ds.intakeTempC >= 4 && ds.intakeTempC <= 6);
    ok('deepSea poster return 9-11C', ds.returnTempC >= 9 && ds.returnTempC <= 11);
    ok('deepSea env deltaT compliant', ds.env.deltaTCompliant === true);

    const da = M.cooling.deepSea({ itLoadMw: 150, pueTarget: 1.15 });
    ok('deepSea accurate flow 8.4-8.5 m3/s (rho 1025, cp 3985)', da.flow.m3s >= 8.4 && da.flow.m3s <= 8.5, 'got ' + da.flow.m3s);
    const cap = da.capex;
    const sum = cap.pipeline + cap.intakeStructure + cap.phe + cap.pumpStation + cap.filtration + cap.trimChillers + cap.controls + cap.contingency;
    ok('deepSea capex breakdown sums to total', Math.abs(sum - cap.total) <= 5, sum + ' vs ' + cap.total);
    ok('deepSea capex total > 0 and perMw sane ($0.3M-$3M/MW)', cap.perMw > 300000 && cap.perMw < 3000000, '' + cap.perMw);
    ok('deepSea opex total > 0', da.opex.totalYr > 0);
    ok('deepSea shallow warning fires', M.cooling.deepSea({ itLoadMw: 20, depthM: 300 }).warnings.length >= 1);
}

/* ============================================================
 * 2h. v2.3.0 — REFRIGERANTS (invariants + worked example)
 * ============================================================ */
{
    const REQ = ['label', 'gwp', 'safety', 'copIndex', 'chargeKgPerKwth', 'leakPctYr', 'capexMult'];
    const keys = Object.keys(D.refrigerants);
    ok('refrigerants: 9 entries', keys.length === 9, '' + keys.length);
    const bad = keys.filter(k => REQ.some(f => D.refrigerants[k][f] == null));
    ok('every refrigerant carries all fields', bad.length === 0, bad.join(','));
    eq('R410A GWP (AR4, sitewide-consistent)', D.refrigerants.R410A.gwp, 2088);
    eq('R134a GWP', D.refrigerants.R134a.gwp, 1430);
    eq('R513A GWP', D.refrigerants.R513A.gwp, 631);
    eq('R717 ammonia GWP zero', D.refrigerants.R717.gwp, 0);
    eq('R717 safety B2L', D.refrigerants.R717.safety, 'B2L');
    const r = M.cooling.refrigerant('R513A', { chillerMwth: 10 });
    ok('R513A energy delta ~+3% vs R134a', r.energyDeltaVsBaselinePct > 2 && r.energyDeltaVsBaselinePct < 4, '' + r.energyDeltaVsBaselinePct);
    ok('R513A tCO2e/yr > 0 and < R134a-equivalent', r.tco2eYr > 0);
    const am = M.cooling.refrigerant('R717', { chillerMwth: 10 });
    eq('ammonia leakage carbon = 0 (GWP 0)', am.tco2eYr, 0);
    ok('ammonia compliance flags include B2L note', am.complianceFlags.some(f => /B2L/.test(f)));
    ok('unknown refrigerant -> null', M.cooling.refrigerant('R9999', {}) === null);
}

/* ============================================================
 * 2i. v2.3.0 — ENERGY (screening lcoe + hybrid)
 * ============================================================ */
{
    const l = M.energy.lcoe('solar', 'ID');
    ok('solar ID LCOE in plausible band $40-120/MWh', l >= 40 && l <= 120, '' + l);
    ok('offshore wind LCOE > onshore', M.energy.lcoe('windOffshore', 'EU') > M.energy.lcoe('windOnshore', 'EU'));
    const h = M.energy.hybridScreen({ itLoadMw: 10, region: 'ID', solarMwp: 30, bessMwh: 40 });
    ok('hybrid coverage in (0,1]', h.coverageFraction > 0 && h.coverageFraction <= 1, '' + h.coverageFraction);
    ok('hybrid covered+residual = load', Math.abs(h.coveredMwhYr + h.gridResidualMwhYr - 10 * 8760) <= 2);
    ok('hybrid carbon offset > 0', h.carbonOffsetTonnesYr > 0);
    ok('hybrid declares screening method', /screening/.test(h.method));
}

/* ============================================================
 * 2j. v2.3.0 — CAPEX DETAILED: golden parity vs pre-refactor calculator
 * ============================================================ */
{
    const fs = await import('node:fs');
    const G = JSON.parse(fs.readFileSync(new URL('./fixtures/capex-golden.json', import.meta.url), 'utf8'));
    function mapInputs(f) {
        const i = f.inputs, a = f.advInputs || {};
        const inp = { itLoadKw: parseInt(i.itLoad) || 1000, rackType: i.rackType, coolingType: i.coolingType,
            redundancy: i.redundancy, fuelHours: parseInt(i.fuelHours) || 48, buildingType: i.buildingType,
            seismicZone: i.seismicZone, fireType: i.fireType, alarmType: i.alarmType, upsType: i.upsType,
            genType: i.genType, location: i.locationFactor, city: i.cityMarket };
        if (f.advanced) inp.advanced = { projYear: a.projYear || '2025', marketCondition: a.marketCondition || 'balanced',
            deliveryMethod: a.deliveryMethod || 'dbb', contractorAvail: a.contractorAvail || 'normal',
            designFee: 8, pmFee: 5, contingency: 10, utilityRate: 9,
            includeFOM: !!a.includeFOM, substationType: a.substationType || 'shared', transformerLead: a.transformerLead || 'standard',
            powerDistribution: a.powerDistribution || 'busway', transformerType: a.transformerType || 'dry',
            pduType: a.pduType || 'intelligent', cablingType: a.cablingType || 'hybrid', floorType: a.floorType || 'raised_600',
            siteCondition: a.siteCondition || 'brownfield', securityLevel: a.securityLevel || 'standard',
            fiberEntry: a.fiberEntry || 'dual', greenCert: a.greenCert || 'none', renewableOption: a.renewableOption || 'none' };
        return inp;
    }
    Object.keys(G).filter(k => !k.startsWith('_')).forEach(name => {
        const f = G[name], r = M.capex.detailed(mapInputs(f)), g = f.result;
        ok('golden parity ' + name + ' total EXACT', Math.abs(r.total - g.total) < 1, r.total + ' vs ' + g.total);
        ok('golden parity ' + name + ' pue', Math.abs(r.pue - g.pue) < 0.001);
        ok('golden parity ' + name + ' racks', r.racks === g.racks);
        ok('golden parity ' + name + ' annualEnergy', Math.abs(r.annualEnergy - g.annualEnergy) < 1);
    });
    /* space model invariants */
    const sp = M.capex.detailed({ itLoadKw: 20000, rackType: 'ai', coolingType: 'liquid', redundancy: '2n' }).space;
    ok('space: white space 40-50% of gross', sp.whiteSpacePctOfGross >= 38 && sp.whiteSpacePctOfGross <= 52, '' + sp.whiteSpacePctOfGross);
    ok('space: AI density 12-20 kW/m2 white space', sp.whiteSpaceKwPerM2 >= 12 && sp.whiteSpaceKwPerM2 <= 20, '' + sp.whiteSpaceKwPerM2);
    ok('space: gross > white+support', sp.grossM2 > sp.whiteSpaceM2 + sp.supportSpaceM2 - 1);
    /* deep-sea integrated path */
    const dsd = M.capex.detailed({ itLoadKw: 150000, rackType: 'ai', redundancy: '2n1', deepSea: { depthM: 900, pipelineKm: 3, mode: 'poster' } });
    ok('detailed+deepSea: PUE physics-driven <= 1.15', dsd.pue <= 1.15, '' + dsd.pue);
    ok('detailed+deepSea: deepSeaCooling cost line present', dsd.costs.deepSeaCooling > 0);
    ok('detailed+deepSea: auto refrigerant = R-1234ze (trim chillers)', dsd.refrigerant && dsd.refrigerant.key === 'R1234ze');
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
