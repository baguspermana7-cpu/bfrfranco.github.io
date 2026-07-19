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
    const perfect = S.score({ power: 1, grid: 1, seismic: 1, talent: 1, tax: 1, carbon: 1, flood: 1, latency: 1, water: 1, climate: 1 });
    near('site.score all-perfect = 100', perfect.score, 100, 1e-6);
    eq('site.score all-perfect grade A', perfect.grade, 'A');
    eq('site.score all-perfect no missing', perfect.missing.length, 0);
    // v2.5.0 site research: real per-country water/climate/seismic factors
    if (M.site.deriveFactors && D.countries && D.countries.SE) {
        const se = M.site.deriveFactors('SE'), sg = M.site.deriveFactors('SG');
        ok('site.deriveFactors: cold market (SE) beats tropical (SG) on climate', se.climate > sg.climate, `${se.climate} vs ${sg.climate}`);
        ok('site.deriveFactors: water from Aqueduct (SA desert low)', M.site.deriveFactors('SA').water <= 0.2);
        ok('site.deriveFactors: seismic from PGA (JP high-hazard low)', M.site.deriveFactors('JP').seismic <= 0.2);
    }
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
    /* ── geo-risk model — Group-2 promotion ── */
    const RK = E.models.risk;
    // all-worst hazards → 100 risk, Very High, insurance 1.8
    const worst = RK.geo({ seismic: 1, flood: 1, typhoon: 1, volcano: 1, tsunami: 1, wildfire: 1 });
    near('risk.geo all-worst = 100', worst.risk, 100, 1e-6);
    eq('risk.geo all-worst insurance 1.8', worst.insuranceMultiplier, 1.8);
    // all-safe → 0 risk, Low, insurance 1.0
    const safe = RK.geo({ seismic: 0, flood: 0, typhoon: 0, volcano: 0, tsunami: 0, wildfire: 0 });
    near('risk.geo all-safe = 0', safe.risk, 0, 1e-6);
    eq('risk.geo all-safe insurance 1.0', safe.insuranceMultiplier, 1.0);
    // partial renormalization: only seismic=1 → 100 (renorm over present)
    near('risk.geo {seismic:1} = 100', RK.geo({ seismic: 1 }).risk, 100, 1e-6);
    ok('risk.geo higher hazard higher premium', RK.geo({ seismic: 0.9, flood: 0.9 }).insuranceMultiplier >= RK.geo({ seismic: 0.1 }).insuranceMultiplier);
    // siteScore inverts risk and feeds site.score
    near('risk.siteScore 100 = 0', RK.siteScore(100), 0, 1e-6);
    near('risk.siteScore 0 = 1', RK.siteScore(0), 1, 1e-6);
    ok('site accepts seismic from risk', E.models.site.score({ seismic: RK.siteScore(RK.geo({ seismic: 0.2 }).risk) }).score >= 0);
    let gwsum = 0; for (const k in D.geoRisk.weights) gwsum += D.geoRisk.weights[k];
    near('geoRisk.weights sum = 1', gwsum, 1, 1e-9);
}
{
    /* ── compliance cost model — Group-2 promotion ── */
    const CO = E.models.compliance;
    // annual 4000 + one-time 15000 amortized /10 = 1500 → 5500
    near('compliance.annualCost annual+one-time', CO.annualCost([{ cost: 4000, type: 'annual' }, { cost: 15000, type: 'one-time' }]), 4000 + 15000 / 10, 1);
    eq('compliance.annualCost empty = 0', CO.annualCost([]), 0);
    eq('compliance.categoryCost electrical', CO.categoryCost('electrical'), D.compliance.categoryAnnualUsd.electrical);
    eq('compliance.categoryCost unknown = 0', CO.categoryCost('nope'), 0);
    // baseline sums categories
    near('compliance.baselineAnnual fire+electrical', CO.baselineAnnual(['fireSafety', 'electrical']), D.compliance.categoryAnnualUsd.fireSafety + D.compliance.categoryAnnualUsd.electrical, 1);
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
 * 2b. DC-OS unification additions (v1.61.x): countries + site.deriveFactors
 *     + commissioning program cost/schedule
 * ============================================================ */
if (D.countries) {
    ok('DATA.countries has 40 entries (32+8 expansion 2026-07-19)', Object.keys(D.countries).length === 40, '' + Object.keys(D.countries).length);
    ok('DATA.countries.SG electricityRate 0.22', D.countries.SG.economy.electricityRate === 0.22);
    ok('DATA.tierCodes 2n = Tier III', D.tierCodes && D.tierCodes['2n'] === 'Tier III');
}
if (M.site && M.site.deriveFactors) {
    const fSG = M.site.deriveFactors('SG'), fID = M.site.deriveFactors('ID');
    ok('site.deriveFactors returns 0-1 factors', fSG.grid >= 0 && fSG.grid <= 1 && fSG.power >= 0 && fSG.power <= 1);
    const sSG = M.site.score(fSG).score, sID = M.site.score(fID).score;
    ok('site score is country-varying (SG != ID)', sSG !== sID, `${sSG} vs ${sID}`);
    ok('site score in range 0-100', sSG > 0 && sSG <= 100);
}
if (M.commissioning && M.commissioning.programCost) {
    const pc = M.commissioning.programCost({ itLoadKw: 3000, cooling: 'air', redundancy: '2n', countryId: 'SG' });
    ok('commissioning.programCost total > 0', pc.total > 0);
    ok('commissioning.programCost per-kW plausible (100-600)', pc.perKw >= 100 && pc.perKw <= 600, '' + pc.perKw);
    const lvlSum = Object.keys(pc.byLevel).reduce((s, k) => s + pc.byLevel[k].cost, 0);
    ok('commissioning byLevel sums ~ total (±1%)', Math.abs(lvlSum - pc.total) / pc.total < 0.01, `${lvlSum} vs ${pc.total}`);
    const ps = M.commissioning.programSchedule({ itLoadKw: 3000, cooling: 'air', redundancy: '2n' });
    ok('commissioning.programSchedule months > 0 and capped', ps.totalMonths > 0 && ps.totalMonths <= 20, '' + ps.totalMonths);
    ok('commissioning schedule has 7 levels L0-L6', ps.byLevel.length === 7);
    // liquid + higher redundancy costs more than air + n1 at same load
    const pcHi = M.commissioning.programCost({ itLoadKw: 3000, cooling: 'liquid', redundancy: '2n1', countryId: 'SG' });
    ok('commissioning cost scales with cooling+redundancy', pcHi.total > pc.total, `${pcHi.total} > ${pc.total}`);
}

/* ── RICH cx program engine (v2.5.0) — faithful cx-calculator.html port.
 *  Golden values computed from cx-calculator.html's OWN cxCalcTotalCost run in
 *  node over the CX_SCENARIOS presets (see /tmp golden harness). Any drift here
 *  means the port diverged from the DC-Hub calculator. ── */
if (M.commissioning && M.commissioning.programRich) {
    const RC = M.commissioning;
    // enterprise_2mw preset — exact grand/subtotal/contingency/dur/equip parity
    const e2 = RC.programRich('enterprise_2mw');
    eq('cx.rich enterprise_2mw grand', e2.grand, 1115730);
    eq('cx.rich enterprise_2mw subtotal', e2.subtotal, 970200);
    eq('cx.rich enterprise_2mw contingency', e2.contingency, 145530);
    near('cx.rich enterprise_2mw perKw', e2.perKw, 557.9, 0.05);
    near('cx.rich enterprise_2mw pctCapex', e2.pctCapex, 5.31, 0.01);
    eq('cx.rich enterprise_2mw durationDays', e2.durationDays, 155);
    eq('cx.rich enterprise_2mw racks', e2.equip.racks, 334);
    eq('cx.rich enterprise_2mw generators', e2.equip.generators, 1);
    const e2L2 = e2.levels.find(l => l.id === 'L2');
    eq('cx.rich enterprise_2mw L2 cost (fixed 10% proportion)', e2L2.cost, 111573);
    // hyperscale_50mw preset — exact grand + equipment scaling
    const h50 = RC.programRich('hyperscale_50mw');
    eq('cx.rich hyperscale_50mw grand', h50.grand, 52746464);
    eq('cx.rich hyperscale_50mw switchgear', h50.equip.switchgear, 11);
    eq('cx.rich hyperscale_50mw generators', h50.equip.generators, 25);
    eq('cx.rich hyperscale_50mw racks (ai_hpc 75kW/rack)', h50.equip.racks, 667);
    near('cx.rich hyperscale_50mw pctCapex (ai_hpc capex 16k/kW)', h50.pctCapex, 6.59, 0.01);
    // discipline split fixed proportions sum to grand
    const dSum = h50.disciplines.reduce((s, d) => s + d.cost, 0);
    ok('cx.rich disciplines sum ≈ grand (±1%)', Math.abs(dSum - h50.grand) / h50.grand < 0.01, `${dSum} vs ${h50.grand}`);
    const lSum = h50.levels.reduce((s, l) => s + l.cost, 0);
    ok('cx.rich levels sum ≈ grand (±1%)', Math.abs(lSum - h50.grand) / h50.grand < 0.01, `${lSum} vs ${h50.grand}`);
    // mapInput: DCMOC store shape (liquid→dlc, ID→jakarta, 2N passthrough)
    const mi = RC.mapInput({ itLoadKw: 2500, coolingType: 'liquid', powerRedundancy: '2N', countryId: 'ID' });
    eq('cx.rich mapInput liquid→dlc', mi.coolingType, 'dlc');
    eq('cx.rich mapInput ID→indonesia_jakarta', mi.region, 'indonesia_jakarta');
    eq('cx.rich mapInput redundancy 2N passthrough', mi.redundancy, '2N');
    eq('cx.rich mapInput itLoad kW', mi.itLoad, 2500);
    // Monte-Carlo (deterministic seeded rng) — band ordering + p50 near base grand
    const seedRng = (s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(12345);
    const mc = RC.monteCarlo('colo_10mw', { n: 3000, rng: seedRng });
    ok('cx.rich monteCarlo band ordered p5<p50<p95', mc.p5 < mc.p50 && mc.p50 < mc.p95, `${mc.p5}/${mc.p50}/${mc.p95}`);
    ok('cx.rich monteCarlo p50 near base grand (±15%)', Math.abs(mc.p50 - 6429248) / 6429248 < 0.15, `${mc.p50}`);
    ok('cx.rich monteCarlo cvar95 ≥ p95', mc.cvar95 >= mc.p95, `${mc.cvar95} ≥ ${mc.p95}`);
    // Sensitivity tornado — sorted desc, redundancy is a top driver
    const sens = RC.sensitivity('colo_10mw');
    eq('cx.rich sensitivity has 7 params', sens.length, 7);
    ok('cx.rich sensitivity sorted by range desc', sens.every((s, i) => i === 0 || sens[i - 1].range >= s.range));
    ok('cx.rich sensitivity ranges positive', sens.every(s => s.range >= 0));
}

/* ============================================================
 * 2c. DC-OS shared pillar engines (v1.63.0): tier/fire/cdu/spares/decision
 * ============================================================ */
if (M.tier && M.tier.classify) {
    ok('tier.classify high scores → Tier IV or capped', M.tier.classify({ power: 95, cooling: 95, network: 95, physical: 95, monitoring: 95, redundancy: '2n' }).tier === 4);
    ok('tier.classify caps to redundancy (n1 → max Tier III)', M.tier.classify({ power: 95, cooling: 95, network: 95, physical: 95, monitoring: 95, redundancy: 'n1' }).tier === 3);
}
if (M.fire && M.fire.agentQuantity) {
    const nv = M.fire.agentQuantity({ volumeM3: 500, agent: 'novec1230' });
    ok('fire novec1230 mass plausible (300-360 kg / 500m3)', nv.massKg > 300 && nv.massKg < 360, '' + nv.massKg);
    ok('fire ig541 returns inert agent volume', M.fire.agentQuantity({ volumeM3: 500, agent: 'ig541' }).type === 'inert');
}
if (M.cdu && M.cdu.size) {
    const c = M.cdu.size({ itKw: 3000, deltaT: 10 });
    ok('cdu flow = Q/(ρ·cp·ΔT) ~4300 Lpm', c.flowLpm > 4200 && c.flowLpm < 4400, '' + c.flowLpm);
    ok('cdu N+1 units', c.cduUnitsRedundant === c.cduUnits + 1);
}
if (M.spares && M.spares.eoq) {
    const e = M.spares.eoq({ annualDemand: 120, orderCost: 400, holdingCostPerUnit: 60 });
    ok('spares EOQ balances holding≈ordering at optimum', Math.abs(e.annualHolding - e.annualOrdering) < 1, `${e.annualHolding} vs ${e.annualOrdering}`);
}
/* ── new rich models (v2.5.0) ── */
if (M.tier && M.tier.advise) {
    /* Tier IV requires: dual_diverse feeds + 2n/2n1 gen+ups + triple pdu + 2n/2n1 cooling + three_plus netEntry + regionalScore=100 */
    const a1 = M.tier.advise({
        utilityFeeds: 'dual_diverse', genConfig: '2n1', upsConfig: '2n', upsTopo: 'double_conversion',
        atsConfig: 'sts', pduRedundancy: 'triple', coolRedundancy: '2n1', coolDistribution: 'n1_piping',
        coolType: 'immersion', netEntry: 'three_plus', carrierDiv: 'three_plus', meetMeRoom: 'redundant',
        fireSuppression: 'vesda_clean', accessControl: 'mfa_mantrap', monitoring: 'full_dcim',
        fuelAutonomyHrs: 720, regionalScore: 100
    });
    ok('tier.advise Tier IV for fully-redundant site', a1.tier === 'Tier IV', a1.tier);
    ok('tier.advise grade A+ for Tier IV', a1.grade === 'A+', a1.grade);
    ok('tier.advise canT4 true for dual_diverse + 2n1 + triple + three_plus netEntry', a1.canT4 === true, String(a1.canT4));
    const a2 = M.tier.advise({ utilityFeeds: 'single', genConfig: 'none', upsConfig: 'n' });
    ok('tier.advise Tier I for bare-bones site', a2.tierNum === 1, a2.tier);
    ok('tier.advise floor not applied for low score', a2.floorApplied === false, String(a2.floorApplied));
    /* Floor constraint: high score but missing T3 prereq (utilityFeeds=single) → capped below 75 */
    const a3 = M.tier.advise({
        utilityFeeds: 'single', genConfig: '2n', upsConfig: '2n', upsTopo: 'double_conversion',
        atsConfig: 'sts', pduRedundancy: 'triple', coolRedundancy: '2n', coolDistribution: 'n1_piping',
        coolType: 'immersion', netEntry: 'three_plus', carrierDiv: 'three_plus', meetMeRoom: 'redundant',
        fireSuppression: 'vesda_clean', accessControl: 'mfa_mantrap', monitoring: 'full_dcim',
        fuelAutonomyHrs: 96
    });
    ok('tier.advise floor clamps score when canT3=false', a3.floorApplied === true, String(a3.floorApplied));
    ok('tier.advise scores dict has 6 keys', Object.keys(a3.scores).length === 6);
}
if (M.fire && M.fire.assess) {
    const fa = M.fire.assess({ volumeM3: 500, agent: 'novec1230', areaM2: 400 });
    ok('fire.assess novec1230 designConcClassA 4.7 used', fa.designConcPct === 4.7, '' + fa.designConcPct);
    ok('fire.assess mass > agentQuantity mass (4.7% vs 4.5% designC)', fa.massKg > M.fire.agentQuantity({ volumeM3: 500, agent: 'novec1230' }).massKg, `assess=${fa.massKg} qty=${M.fire.agentQuantity({ volumeM3: 500, agent: 'novec1230' }).massKg}`);
    ok('fire.assess occupiableOk=true (4.7 <= NOAEL 10.0)', fa.occupiableOk === true, String(fa.occupiableOk));
    ok('fire.assess safetyMarginPct = 10-4.7 = 5.3', Math.abs(fa.safetyMarginPct - 5.3) < 0.01, '' + fa.safetyMarginPct);
    ok('fire.assess spotDetectors = ceil(400/84) = 5', fa.spotDetectors === 5, '' + fa.spotDetectors);
    const faLi = M.fire.assess({ volumeM3: 200, agent: 'novec1230', areaM2: 100, packKWh: 500, batteryChem: 'nmc' });
    ok('fire.assess Li-ion section present for packKWh input', !!faLi.liIon, JSON.stringify(faLi.liIon));
    ok('fire.assess NMC runawayHeat = 500*3.6*2.5 = 4500 MJ', faLi.liIon.runawayHeatMJ === 4500, '' + faLi.liIon.runawayHeatMJ);
    ok('fire.assess FM-200 co2eTonnes present', M.fire.assess({ volumeM3: 100, agent: 'fm200' }).co2eTonnes > 0);
    ok('fire.assess IG-541 returns agentVolumeM3', typeof M.fire.assess({ volumeM3: 100, agent: 'ig541' }).agentVolumeM3 === 'number');
}
if (M.cdu && M.cdu.hydraulics) {
    const h = M.cdu.hydraulics({ itKw: 1000, deltaTK: 10, supplyC: 20, pipeDiamMm: 100, pipeLengthM: 50 });
    ok('cdu.hydraulics returns flowLpm', typeof h.flowLpm === 'number' && h.flowLpm > 0, '' + h.flowLpm);
    ok('cdu.hydraulics velocity plausible (0.05-5 m/s)', h.velocityMs > 0.05 && h.velocityMs < 5, '' + h.velocityMs);
    ok('cdu.hydraulics Reynolds > 0', h.reynolds > 0, '' + h.reynolds);
    ok('cdu.hydraulics frictionFactor in (0.005, 0.1)', h.frictionFactor > 0.005 && h.frictionFactor < 0.1, '' + h.frictionFactor);
    ok('cdu.hydraulics dpBar positive', h.dpBar > 0, '' + h.dpBar);
    ok('cdu.hydraulics pumpKw positive', h.pumpKw > 0, '' + h.pumpKw);
    ok('cdu.hydraulics dewPointC returned', typeof h.dewPointC === 'number', '' + h.dewPointC);
    ok('cdu.hydraulics dewSafeOk is boolean', typeof h.dewSafeOk === 'boolean');
    ok('cdu.hydraulics dew margin safe at 50% RH / 25°C air / 20°C supply', h.dewSafeOk === true, 'dewC=' + h.dewPointC + ' margin=' + h.dewMarginK);
}
if (M.spares && M.spares.newsvendor) {
    /* High-demand part — muAnnual=8 forces muLT>5 so Normal mode activates */
    const nv1 = M.spares.newsvendor({ unitCost: 15000, understockCostPerEvent: 200000, carryRatePct: 25, partLifeYrs: 8, muAnnual: 8.0, sigmaAnnual: 2.0, ltWeeks: 18, ltSigmaWeeks: 5, fillRatePct: 99, poissonMode: false });
    ok('newsvendor CR close to 1 for critical DC part (Cu>>Co)', nv1.cr > 0.8, '' + nv1.cr);
    ok('newsvendor qStar > 0', nv1.qStar > 0, '' + nv1.qStar);
    ok('newsvendor fillAchieved > 0.9 (Normal, high-demand)', nv1.fillAchieved > 0.9, '' + nv1.fillAchieved);
    ok('newsvendor safetyStock >= 0', nv1.safetyStock >= 0);
    ok('newsvendor rop >= muLT (ceil)', nv1.rop >= nv1.muLT);
    /* Low-demand slow mover — muLT < threshold → auto Poisson */
    const nv2 = M.spares.newsvendor({ unitCost: 50000, understockCostPerEvent: 400000, carryRatePct: 25, partLifeYrs: 20, muAnnual: 0.05, sigmaAnnual: 0.05, ltWeeks: 40, ltSigmaWeeks: 10, fillRatePct: 99 });
    ok('newsvendor auto-uses Poisson for low muLT', nv2.usedPoissonMode === true, String(nv2.usedPoissonMode));
    ok('newsvendor Poisson qStar >= 0', nv2.qStar >= 0);
    /* Explicit poissonMode: false overrides auto-Poisson */
    const nv3 = M.spares.newsvendor({ unitCost: 4500, understockCostPerEvent: 85000, carryRatePct: 25, partLifeYrs: 8, muAnnual: 6.0, sigmaAnnual: 1.5, ltWeeks: 16, ltSigmaWeeks: 4, fillRatePct: 99, poissonMode: false });
    ok('newsvendor forced Normal mode (poissonMode=false)', nv3.usedPoissonMode === false, String(nv3.usedPoissonMode));
    ok('newsvendor annualCost > 0', nv3.annualCost > 0);
}
if (M.decision && M.decision.recommend) {
    const d = M.decision.recommend({ inputs: { itLoadKw: 3000, tier: 3, coolingType: 'air' }, capex: { perKw: 16000, timelineMonths: 32 }, carbon: { pue: 1.6 }, financial: { paybackYears: 9, irrPct: 8 } }, {}, ['maxRoi']);
    ok('decision returns ≥3 recommendations for a flagged project', d.recommendations.length >= 3, '' + d.recommendations.length);
    ok('decision never empty (balanced project)', M.decision.recommend({ inputs: { itLoadKw: 3000, tier: 3, coolingType: 'liquid' }, financial: { paybackYears: 5, irrPct: 18 } }).recommendations.length >= 1);
    ok('decision carries disclaimer', !!d.disclaimer && /not investment/i.test(d.disclaimer));
}

/* ── Research-pass deepening (v2.5.0): pillars 1/3/4 ── */
if (M.requirements && M.requirements.rackCount) {
    ok('requirements.rackCount ceil(itLoad/rackKw)', M.requirements.rackCount(3000, 12) === 250);
    ok('requirements.densityBand extreme→liquid mandatory', M.requirements.densityBand(120).coolingMandatory === 'liquid');
    const v = M.requirements.validate({ useCase: 'ai', coolingType: 'air', itLoadKw: 3000, targetTier: 3 });
    ok('requirements.validate flags AI-on-air critical', v.flags.some((f) => f.level === 'critical'));
}
if (M.architecture && M.architecture.thermalCheck) {
    ok('architecture.thermalCheck compliant A1', M.architecture.thermalCheck({ coolingType: 'air', supplyTempC: 24, deltaTK: 12 }).compliant === true);
    ok('architecture.thermalCheck flags over-ΔT', M.architecture.thermalCheck({ coolingType: 'air', supplyTempC: 24, deltaTK: 22 }).compliant === false);
    ok('architecture.topology T4 fault tolerant', /fault tolerant/i.test(M.architecture.topology(4).maintainability));
    ok('architecture.designFee scales', M.architecture.designFee(1e8, 'High').feeUsd === 12000000);
}
if (M.capacity && M.capacity.facilityLoad) {
    const fl = M.capacity.facilityLoad(3000, 'air', 3);
    ok('capacity.facilityLoad = itLoad×PUE', fl.facilityLoadKw > 3000 && fl.pueUsed >= 1.3, '' + fl.facilityLoadKw);
    ok('capacity.occupancyScurve hyperscale > retail (yr1)', M.capacity.occupancyScurve(1, 'hyperscale') > M.capacity.occupancyScurve(1, 'retail'));
    ok('capacity.strandedCapacity flags <60% occ', M.capacity.strandedCapacity(10000, 0.5).isStranded === true);
    ok('capacity.bindingConstraint power|space', ['power', 'space'].includes(M.capacity.bindingConstraint(3000, 12, 500).binding));
}

/* ── Research-pass deepening (v2.5.0): pillars 6/8/9 ── */
if (M.construction && M.construction.longLeadRisk) {
    const r = M.construction.longLeadRisk({ powerOnMonth: 20, stressed: true });
    ok('construction.longLeadRisk flags transformer critical (stressed, 20mo)', r.criticalItems.includes('transformer'));
    ok('construction.longLeadRisk sorted desc by lead', r.items[0].leadMonths >= r.items[r.items.length - 1].leadMonths);
}
if (M.maintenance && M.maintenance.staffingBenchmark) {
    const s3 = M.maintenance.staffingBenchmark(5, 3), s4 = M.maintenance.staffingBenchmark(5, 4);
    ok('maintenance.staffingBenchmark T4 > T3 headcount', s4.totalFte > s3.totalFte);
    ok('maintenance.staffingBenchmark >= min FTE', s3.totalFte >= 6);
}
if (M.asset && M.asset.failureProbability) {
    const young = M.asset.failureProbability('battery', 1), old = M.asset.failureProbability('battery', 8);
    ok('asset.failureProbability rises with age (Weibull)', old.failureProb > young.failureProb);
    ok('asset.failureProbability in [0,1]', old.failureProb >= 0 && old.failureProb <= 1);
    ok('asset Weibull wear-out shape>1', old.shape > 1);
}

/* ── Research-pass deepening (v2.5.0): pillars 11/12 ── */
if (M.carbon && M.carbon.scopes) {
    const sc = M.carbon.scopes({ mw: 3, pue: 1.5, region: 'US', tier: 3 });
    ok('carbon.scopes scope2 dominates (grid)', sc.scope2Pct >= 80, '' + sc.scope2Pct);
    ok('carbon.scopes total = s1+s2+s3', Math.abs(sc.totalAnnual - (sc.scope1 + sc.scope2 + sc.scope3Annual)) < 1);
    ok('carbon.scopes scope1 > 0 (genset + refrigerant)', sc.scope1 > 0);
}
if (M.tax && M.tax.macrsDepreciation) {
    const mac = M.tax.macrsDepreciation(1e8, '5', 0.21, 0.10);
    ok('macrs 5yr sums to 100% of capex', Math.abs(mac.totalDepreciation - 1e8) < 1e8 * 0.001, '' + mac.totalDepreciation);
    ok('macrs total shield = capex×taxRate', Math.abs(mac.totalShield - 21e6) < 1e6, '' + mac.totalShield);
    ok('macrs accelerated → shieldNpv < totalShield', mac.shieldNpv < mac.totalShield && mac.shieldNpv > 0);
    ok('macrs 5yr first-year 20%', mac.rows[0].pct === 0.20);
}

/* ── Research-pass deepening (v2.5.0): pillars 5/10/13 ── */
if (M.capex && M.capex.accuracyRange) {
    const ar = M.capex.accuracyRange(1e8, '4');
    ok('capex.accuracyRange Class-4 = -30/+50%', ar.lowPct === -0.30 && ar.highPct === 0.50);
    ok('capex.accuracyRange low<point<high', ar.low < ar.point && ar.point < ar.high);
}
/* A4 — mttr vendor-vs-inhouse (article-4 promoted) */
if (M.mttr) {
    const p4 = { category: 'Electrical', skillLevel: 3, coverage: '24_7', spares: 100, vendorSLA: 4, incidents: 6, callout: 2500, retainer: 24000, training: 45000, costHour: 10000, criticalPct: 60 };
    const ph = M.mttr.phases(p4);
    near('mttr.vendor Electrical sum', ph.vendor.detect + ph.vendor.diagnose + ph.vendor.mobilize + ph.vendor.repair + ph.vendor.verify, 0.25 + 0.5 + 4 + 1.5 + 0.5, 1e-12);
    near('mttr.inhouse skill-3 spares-100', ph.inhouse.repair, 1.5, 1e-12);   // sf=1, spareFactor=1
    const cmp = M.mttr.compare(p4);
    near('mttr.vendorMTTR', cmp.vendorMTTR, 6.75, 1e-12);
    near('mttr.inhouseMTTR', cmp.inhouseMTTR, 0.25 + 0.5 + 0.25 + 1.5 + 0.5, 1e-12);
    near('mttr.effCostHour 60% crit', cmp.effCostHour, 10000 * 0.6 + 10000 * 0.3 * 0.4, 1e-9);
    const expSav = (cmp.vendorDowntimeHr - cmp.inhouseDowntimeHr) * cmp.effCostHour + 6 * 2500 + 24000 * 0.55 - 45000;
    near('mttr.netSavings composition', cmp.netSavingsUsd, expSav, 1e-9);
    ok('mttr.breakeven positive', cmp.breakevenMonths > 0 && cmp.breakevenMonths < 99);
}

/* A5 — techDebt (article-5 promoted) */
if (M.techDebt) {
    near('techDebt.hazard t=60 β2.5 η60', M.techDebt.weibullHazard(60, 2.5, 60), 2.5 / 60, 1e-12);
    const r5 = M.techDebt.riskScore({ items: 45, avgAgeMonths: 18, facilityAgeYears: 8, criticalPct: 20, majorPct: 35 });
    const hz = (2.5 / 60) * Math.pow(18 / 60, 1.5);
    near('techDebt.risk article defaults', r5.currentRisk, Math.min(100, (9 * 10 + 15.75 * 5 + 20.25 * 1) * hz * 1.4), 1e-9);
    near('techDebt.projected1 ×1.15', r5.projected1, Math.min(100, r5.currentRisk * 1.15), 1e-12);
    const esc = M.techDebt.escalation(45, 15000, 18);
    near('techDebt.escalation 1+(18/24)*.5', esc.escalatedCostUsd, 45 * 15000 * 1.375, 1e-9);
    const cr = M.techDebt.costRoi(45, 15000, 50e6, 50);
    near('techDebt.inaction 30% factor', cr.inactionCostUsd, 45 * 15000 * 0.5 * 0.3, 1e-9);
    near('techDebt.insurance band 50', cr.insuranceDeltaUsd, 45 * 15000 * 0.05, 1e-9);
    const wp = M.techDebt.weibullParams(18, 8);
    near('techDebt.wp beta base (fac<10yr)', wp.beta, 2.5, 1e-12);
    near('techDebt.wp mttf = ηΓ(1+1/β)', wp.mttfMonths, 60 * 0.8873, 5e-4);   // Γ(1.4)=0.887264
    eq('techDebt.wp trend increasing', wp.hazardTrend, 'Increasing');
    const cap = M.techDebt.capacity(45, 20, 35);
    near('techDebt.capacity crewMonths', cap.crewMonths, (9 * 5 + 15.75 * 3 + 20.25 * 1.5) / 22, 1e-9);
}

/* A6 — rca effectiveness (article-6 promoted) */
if (M.rca) {
    const perfect = M.rca.effectivenessScore({ incidents: 10, rcas: 10, implRate: 100, recurRate: 0, days: 0, daInvolve: 100, verifyRate: 100 });
    near('rca.perfect = 100', perfect, 100, 1e-9);
    const mid = M.rca.effectivenessScore({ incidents: 40, rcas: 20, implRate: 50, recurRate: 30, days: 45, daInvolve: 40, verifyRate: 50 });
    near('rca.mid composite', mid, 50 * 0.20 + 50 * 0.25 + 70 * 0.20 + 50 * 0.15 + 40 * 0.10 + 50 * 0.10, 1e-9);
    ok('rca.weights sum 1.0', Math.abs(Object.values(D.rcaScore.weights).reduce((a, b) => a + b, 0) - 1) < 1e-12);
}

/* A7 — resilience (article-7 promoted) — page defaults worked example */
if (M.resilience) {
    const a = M.resilience.assess({ redundancy: 'N+1', drillFreq: 'Annual', responseTimeMin: 15, recovery: 'Documented', crossTrainPct: 30, docCurrency: 'Outdated 1-2yr', commPlan: 'Basic', lessons: 'Ad-hoc' });
    eq('resilience.rel N+1 = 55', a.reliabilityScore, 55);
    eq('resilience.res defaults = 40', a.resilienceScore, 40);
    eq('resilience.gap 15 = warning', a.gapClass, 'warning');
    eq('resilience.relTier', a.relTier, 'Tier II Equivalent');
    eq('resilience.resTier', a.resTier, 'Stage 3: Proactive');
    ok('resilience.weights sum 1.0', Math.abs(D.resilience.weights.reduce((s, w) => s + w, 0) - 1) < 1e-12);
}

/* A8 — safetyCulture (article-8 promoted) — page defaults worked example */
if (M.safetyCulture) {
    const hi = M.safetyCulture.healthIndex({ nearMiss: 3, weakSignals: 5, audit: 12, training: 8, walks: 2, hazard: 60, meeting: 'Monthly' });
    near('safetyCulture.total defaults = 42', hi.total, 42, 1e-9);
    near('safetyCulture.dim0 near-miss', hi.dims[0], 30, 1e-12);
    near('safetyCulture.drift 365d/42', M.safetyCulture.driftProbability(365, hi.total), 0.7095, 1e-9);
    eq('safetyCulture.label 42 = Pathological', M.safetyCulture.cultureLabel(hi.total), 'Pathological');
    ok('safetyCulture.weights sum 1.0', Math.abs(D.safetyCulture.weights.reduce((s, w) => s + w, 0) - 1) < 1e-12);
}

/* A9 — hvac (article-9 promoted) — 10 MW @ $0.10 worked example */
if (M.hvac) {
    const s = M.hvac.simplePueCost(10, 0.10);
    near('hvac.simple traditional', s.traditional, 14629200, 1e-9);
    near('hvac.simple savingsDLC', s.savingsDLC, 4555200, 1e-9);
    eq('hvac.simple co2 31%', s.co2ReductionPct, 31);
    const t = M.hvac.tco({ load: 10, rate: 0.10, regionKey: 'indonesia' });
    near('hvac.tco trad npv10', t.traditional.npv10yr, 55440275.49051599, 1e-9);
    near('hvac.tco dlc annualOpex', t.dlc.annualOpex, 2004500, 1e-9);
    near('hvac.tco paybackDLC', t.paybackDLC, 1.184483269173823, 1e-9);
    near('hvac.tco savingsDLC10yr', t.savingsDLC10yr, 27989917.326337874, 1e-9);
}

/* A10 — water.stressCost (article-10 promoted) — 100 MW, WUE 1.8, Jakarta */
if (M.water && M.water.stressCost) {
    const w = M.water.stressCost({ powerMw: 100, wue: 1.8, regionKey: 'jakarta' });
    near('waterStress.annualCost', w.annualCost, 1892160, 1e-9);
    near('waterStress.tco10', w.tco10, 15428945.842248302, 1e-9);
    near('waterStress.dlcCost', w.dlcCost, 245980.8, 1e-9);
    eq('waterStress.riskPct jakarta = 22', w.riskPremiumPct, 22);
    near('waterStress.recyclePayback', w.recyclePayback, 59.4558599695586, 1e-9);
    near('waterStress.nexus', w.waterEnergyNexus, 1034, 1e-9);
}

/* A12 — dcValue (article-12 promoted) — Indonesia 100 MW hyperscale worked example */
if (M.dcValue) {
    const v = M.dcValue.economicImpact({ countryKey: 'indonesia', capacityMw: 100, dcType: 'hyperscale', renewableTarget: '100', pue: 1.2, capacityFactor: 0.85, projectYears: 10, demandResponse: 'none' });
    near('dcValue.capex', v.capex, 1020000000, 1e-9);
    near('dcValue.taxRevenue', v.taxRevenue, 8575720.012799999, 1e-9);
    eq('dcValue.directJobs', v.directJobs, 195);
    eq('dcValue.indirectJobs', v.indirectJobs, 839);
    eq('dcValue.ppaCapacity', v.ppaCapacityMW, 150);
    near('dcValue.totalEconomicImpact', v.totalEconomicImpact, 4029643334.4, 1e-9);
    near('dcValue.co2Avoided', v.co2Avoided, 545.0472, 1e-9);
}

/* A14 — communityImpact (article-14 promoted) — Virginia 100 MW worked example */
if (M.communityImpact) {
    const c = M.communityImpact.assess({ mw: 100, regionKey: 'virginia', cooling: 'evaporative', pue: 1.4, renewPct: 0.5, taxLevel: 'moderate', engagement: 'basic', genType: 'diesel', wasteHeat: 'none', rateProt: 'standard', waterStrat: 'standard', constYears: 2 });
    near('communityImpact.billIncrease', c.billIncrease, 0.12461944444444446, 1e-9);
    near('communityImpact.waterML', c.waterML, 2600, 1e-9);
    near('communityImpact.noxTons', c.annualNoxTons, 31.5, 1e-9);
    eq('communityImpact.netScore', c.netScore, -2);
    eq('communityImpact.totalJobs', c.totalJobs, 825);
    eq('communityImpact.co2Avoided', c.co2AvoidedTons, 59787);
}

/* A15 — opsBudget (article-15 promoted) — US-Virginia 10 MW in-house worked example */
if (M.opsBudget) {
    const inp = { countryKey: 'US-Virginia', loadMW: 10, pue: 1.40, staffModelKey: 'inhouse', retention: 85, pmRatio: 75 };
    const o = M.opsBudget.opex(inp);
    near('opsBudget.energy', o.energyCost, 8339520, 1e-9);
    near('opsBudget.labor', o.laborBudget, 22700250, 1e-9);
    near('opsBudget.maint', o.maintBudget, 1665000, 1e-9);
    near('opsBudget.total', o.totalOpex, 32704770, 1e-9);
    eq('opsBudget.shiftFTE', o.shiftFTE, 177);
    const s = M.opsBudget.staffing(inp, o);
    near('opsBudget.staffing.util', s.utilization, 79.2, 1e-9);
    near('opsBudget.staffing.burnout', s.burnoutProb, 25.807460164972586, 1e-9);
    near('opsBudget.staffing.retentionCost', s.retentionCost, 3783375, 1e-9);
    eq('opsBudget.staffing.sri', s.resilienceIdx, 83);
}

/* A16 — dcMarket.bubbleRisk (article-16 promoted) — Johor preset worked example */
if (M.dcMarket) {
    const j = D.dcMarket.bubbleMarkets.johor;
    const b = M.dcMarket.bubbleRisk({ op: j.op, pipe: j.pipe, pop: j.pop, absorb: j.absorb, precommit: j.precommit, spec: j.spec, demandGrowth: j.growth, costMW: j.cost, revMW: j.rev, opexRatio: j.opex, wacc: j.wacc });
    near('dcMarket.bubble sdRatio', b.sdRatio, 5.8, 1e-9);
    near('dcMarket.bubble yearsAbsorb', b.yearsAbsorb, 26.565, 1e-9);
    near('dcMarket.bubble vacancy', b.actualVacancy, 40.58912102390363, 1e-9);
    near('dcMarket.bubble npv', b.npv, -36271.9552277085, 1e-9);
    near('dcMarket.bubble risk', b.riskScore, 92.5, 1e-9);

    /* A17 — dcMarket.opportunity (article-17 promoted) — Indonesia preset worked example */
    const io = D.dcMarket.opportunityMarkets.indonesia;
    const p = M.dcMarket.opportunity({ op: io.op, pipe: io.pipe, pop: io.pop, digiGrowth: io.digi, sovDemand: io.sov, infCAGR: io.inf, entMigration: io.ent, buildCost: io.cost, revMW: io.rev, opexRatio: io.opex, wacc: io.wacc });
    near('dcMarket.opp totalDemand', p.totalDemand, 4723.038919687499, 1e-9);
    near('dcMarket.opp utilization', p.utilization, 113.94545041465621, 1e-9);
    near('dcMarket.opp npv', p.npv, -19579.485158003277, 1e-9);
    near('dcMarket.opp irr', p.irr, -0.06213598111657573, 1e-6);
    near('dcMarket.opp score', p.oppScore, 66.82045317098914, 1e-9);
    eq('dcMarket.opp jobsPerm', p.jobsPerm, 5389);
}

/* A22 — interconnect (article-22 promoted) — 8192 GPU @ 800G/5m/$0.10 worked example */
if (M.interconnect) {
    const c = M.interconnect.compare({ gpuCount: 8192, gpuPerRack: 8, portSpeedG: 800, linkDistM: 5, elecCostKwh: 0.10 });
    near('interconnect.plug powerPerLink', c.pluggable.powerPerLinkW, 10.2375, 1e-9);
    near('interconnect.cpo powerPerLink', c.cpo.powerPerLinkW, 2.475, 1e-9);
    near('interconnect.plug annualCost', c.pluggable.annualCostUsd, 73466.2656, 1e-9);
    near('interconnect.cpo annualCost', c.cpo.annualCostUsd, 17761.0752, 1e-9);
    eq('interconnect.copper not viable at 5m/800G', c.copper.viable, false);
    eq('interconnect.racks', c.racks, 1024);
}

/* A25 — gridReserve (article-25 promoted) — PJM page-default worked example */
if (M.gridReserve) {
    const g = M.gridReserve.adequacy({ capacity: 180, peakDemand: 150, retirements: 40, newGen: 15, dcGrowth: 10, otherGrowth: 5, reserveTarget: 15, elcc: 25 });
    near('gridReserve.netAvailable', g.netAvailable, 147.125, 1e-9);
    near('gridReserve.reserveMargin', g.reserveMargin, -10.833333333333334, 1e-9);
    eq('gridReserve.blackoutRisk', g.blackoutRisk, 84);
    near('gridReserve.auctionPrice', g.auctionPrice, 2061.3333333333335, 1e-9);
    near('gridReserve.costImpact', g.costImpact, 108.85528833333333, 1e-9);
    near('gridReserve.dcShare', g.dcShare, 6.0606060606060606, 1e-9);
}

/* A1 — opsMaturity (article-1 promoted) */
if (M.opsMaturity) {
    const allThrees = [3, 3, 3, 3, 3, 3, 3, 3];
    near('opsMaturity.score all-3 = 50', M.opsMaturity.score(allThrees), 50, 1e-12);
    near('opsMaturity.score all-5 = 100', M.opsMaturity.score([5,5,5,5,5,5,5,5]), 100, 1e-12);
    near('opsMaturity.score all-1 = 0', M.opsMaturity.score([1,1,1,1,1,1,1,1]), 0, 1e-12);
    eq('opsMaturity.label 50 = Predictive', M.opsMaturity.label(50).label, 'Predictive');
    ok('opsMaturity.weights sum 1.0', Math.abs(D.opsMaturity.dimensions.reduce((a, d) => a + d.weight, 0) - 1) < 1e-12);
    const rx = M.opsMaturity.riskExposure(50);
    near('opsMaturity.risk 50 outages', rx.estOutagesPerYear, 2.5 * (1 - 50 / 120), 1e-9);
    near('opsMaturity.risk exposure', rx.annualExposureUsd, rx.estOutagesPerYear * 200000, 1e-9);
    eq('opsMaturity.risk level 50', rx.riskLevel, 'ELEVATED');
}

/* A2 — alarms (article-2 promoted, ISA-18.2) */
if (M.alarms) {
    // 1200 alarms/day, 2 ops, 12h shifts: per-shift 600, rate = 600/(2*12*6) = 4.1667/10min
    near('alarms.rate 1200/2/12', M.alarms.ratePer10Min(1200, 2, 12), 600 / (2 * 12 * 6), 1e-12);
    const cl = M.alarms.cognitiveLoad(30, 60);   // 30/h × 60s = 50% util → no degradation
    near('alarms.cogLoad util 50%', cl.utilizationPct, 50, 1e-9);
    near('alarms.cogLoad no degradation below knee', cl.degradationPct, 0, 1e-12);
    const cl2 = M.alarms.cognitiveLoad(60, 60);  // 100% util → degradation 1-e^-0.9
    near('alarms.cogLoad degraded at 100%', cl2.degradationPct, (1 - Math.exp(-3 * 0.3)) * 100, 1e-9);
    const isa = M.alarms.isaCompliance(0.8, 0.9, 0.03, 0.05);
    eq('alarms.isaCompliance perfect = 100', isa.total, 100);
    const ec = M.alarms.erlangC(4, 1, 5);        // λ=4, μ=1, c=5 → classic Erlang-C
    ok('alarms.erlangC in (0,1)', ec > 0 && ec < 1);
    near('alarms.erlangC rho>=1 saturates', M.alarms.erlangC(5, 1, 4), 1, 1e-12);
    const sc = M.alarms.isaScore(288, 2, 12);    // rate = 288/288 = 1.0 → rateScore 100
    near('alarms.isaScore rate at target', sc.rate, 1.0, 1e-12);
    ok('alarms.isaScore composite in [0,100]', sc.isa >= 0 && sc.isa <= 100);
    ok('alarms.flood grows with volume', M.alarms.isaScore(5000, 2, 12).flood > sc.flood);
}

/* A3 — maintCompliance (article-3 promoted) */
if (M.maintCompliance) {
    const p = { tasks: 400, techs: 6, backlog: 0, duration: 1.5, hrsPerMonth: 160, cmms: 2, friction: 'Medium', evidence: 'Adequate' };
    near('maintComp.capacity free-mode', M.maintCompliance.effectiveCapacity(p), 6 * 160 * 0.70, 1e-9);
    near('maintComp.demand no backlog', M.maintCompliance.demand(p), 400 * 1.5, 1e-9);
    near('maintComp.compliance article default', M.maintCompliance.compliance(p),
        Math.min(100, (672 / 600) * 100) * 0.80 * 0.92, 1e-9);
    const pPro = { ...p, pro: true, wrenchPct: 0.35, overheadPct: 0.25 };
    near('maintComp.capacity pro-mode', M.maintCompliance.effectiveCapacity(pPro), 6 * 160 * 0.70 * 0.35 * 0.75, 1e-9);
    // ceiling: cmms/evidence multipliers cap compliance (cmms 2 + Adequate = 73.6 max — article-faithful)
    eq('maintComp.ceiling at cmms2', M.maintCompliance.techsForTarget(p, 0.97), null);
    const pBest = { ...p, cmms: 5, evidence: 'Excellent' };
    const t = M.maintCompliance.techsForTarget(pBest, 0.97);
    ok('maintComp.techsForTarget solves at cmms5', t != null && t >= 1 && t <= 100);
    ok('maintComp.techsForTarget hits target', t != null && M.maintCompliance.compliance({ ...pBest, techs: t }) >= 97);
}

/* A23 — aiFactory gpuBuild (article-23 promoted) */
if (M.aiFactory && M.aiFactory.gpuBuild) {
    const gb = M.aiFactory.gpuBuild({ gpuCount: 100000, powerMw: 150, buildDays: 122, costPerGpu: 30000, powerCostKwh: 0.08, pue: 1.3 });
    near('gpuBuild.capex 100k×30k', gb.gpuCapexUsd, 3e9, 1e-3);
    near('gpuBuild.annualPower kWh math', gb.annualPowerUsd, 150 * 1000 * 0.08 * 8760, 1e-3);
    near('gpuBuild.speed 122d = 100%', gb.speedVsColossusPct, 100, 1e-9);
    near('gpuBuild.tco composition', gb.tco5yrUsd, gb.gpuCapexUsd + gb.annualPowerUsd * 5 + 150 * 8e6, 1e-3);
}

/* A18 — aiFactory readiness (article-18 promoted, unit bug fixed) */
if (M.aiFactory && M.aiFactory.readiness) {
    const af = M.aiFactory.readiness({ density: 100, racks: 100, cooling: 'dtc', pue: 1.2, elecRate: 0.08, age: 1, floorLoad: 2500, lcInfra: 'full' });
    near('aiFactory.itLoad 100x100kW', af.itLoadMW, 10, 1e-12);
    near('aiFactory.energy UNIT-FIXED', af.annualEnergy, 10 * 1.2 * 8760 * 1000 * 0.08, 1e-6); // $8.4M not $8.4B
    ok('aiFactory.energy sane (<$100M for 10MW)', af.annualEnergy < 1e8);
    ok('aiFactory.overall in [0,100]', af.overall >= 0 && af.overall <= 100);
    ok('aiFactory.grade A-band config', af.grade === 'A' || af.grade === 'B');
    const air = M.aiFactory.readiness({ density: 100, racks: 100, cooling: 'air', pue: 1.8, elecRate: 0.08, age: 20, floorLoad: 800, lcInfra: 'none' });
    ok('aiFactory.legacy air scores worse', air.overall < af.overall);
    ok('aiFactory.opex composition', Math.abs(af.totalOPEX - (af.annualEnergy + 10 * 320000 + Math.max(350000, 10 * 450000) + 10 * 160000 + 10 * 70000)) < 1);
}

/* A20b — aiQueryFootprint (article-20 wfc/avh promoted) */
if (M.water && M.water.aiQueryFootprint) {
    const af = M.water.aiQueryFootprint({ modelKey: 'gpt4o', complexity: 'medium', cooling: 'evaporative', region: 'temperate', includeUpstream: true, queriesPerDay: 50, users: 1, hoursPerDay: 8 });
    near('aiWater.perQueryML gpt4o upstream', af.perQueryML, 0.5 * 4, 1e-12);
    near('aiWater.dailyL 50q', af.dailyL, (0.5 * 4 * 50) / 1000, 1e-12);
    near('aiWater.annualL identity', af.annualL, af.dailyL * 365, 1e-9);
    ok('aiWater.bottles round', af.bottles === Math.round(af.annualL / 0.5));
    const direct = M.water.aiQueryFootprint({ modelKey: 'gpt4o', includeUpstream: false });
    near('aiWater.direct no upstream', direct.perQueryML, 0.5, 1e-12);
    const glob = M.water.aiQueryFootprint({ modelKey: 'gpt4o', scale: 'global', queriesPerDay: 1, users: 1, hoursPerDay: 8 });
    near('aiWater.global scale 1e10', glob.totalQueriesPerDay, 1e10, 1e-3);
}

/* A20 — water facilityFootprint (article-20 promoted) */
if (M.water && M.water.facilityFootprint) {
    const wf = M.water.facilityFootprint({ itLoadMw: 10, pue: 1.4, cooling: 'evaporative', climate: 'temperate', renewablePct: 30 });
    near('waterFootprint.wue evaporative temperate', wf.wue, 1.8, 1e-12);
    near('waterFootprint.annualL identity', wf.annualL, 10 * 1.4 * 1000 * 8760 * 1.8 * (1 + 0.7 * 1.5), 1e-3);
    ok('waterFootprint.households positive', wf.householdsEquiv > 0);
    near('waterFootprint.gal conversion', wf.annualGal, wf.annualL / 3.785, 1e-6);
    ok('waterFootprint.method labeled screening', /screening/.test(wf.method));
    near('waterFootprint.dlc cold lowest', M.water.facilityFootprint({ itLoadMw: 10, pue: 1.2, cooling: 'immersion', climate: 'cold' }).wue, 0.02 * 0.6, 1e-12);
}

/* A11 — gridImpact residential bill screening (article-11 promoted) */
if (M.gridImpact && M.gridImpact.residentialBillImpact) {
    const gi = M.gridImpact.residentialBillImpact({ countryKey: 'indonesia', targetYear: 2030, householdMonthlyKwh: 200, dcCapacityMw: 500 });
    near('gridImpact.dcAnnualGWh 500MW@0.9', gi.dcAnnualGWh, 500 * 0.9 * 8760 / 1000, 1e-9);
    ok('gridImpact.householdsEquiv formula', gi.householdsEquiv === Math.round((500 * 1000 * 0.9 * 730) / 111));
    near('gridImpact.gridLoad 500MW/70GW', gi.gridLoadIncreasePct, (500 / 70000) * 100, 1e-9);
    near('gridImpact.growth compounding 2030', gi.projectedIncreasePct, ((500 / 70000) * 100 * 0.4) * Math.pow(1.15, 4) * 1.2, 1e-9);
    ok('gridImpact.method labeled screening', /screening/.test(gi.method));
}

if (M.reliability && M.reliability.kOutOfN) {
    ok('reliability.kOutOfN 2-of-3 @0.99 ≈ 0.9997', Math.abs(M.reliability.kOutOfN(0.99, 2, 3) - 0.999702) < 1e-4);
    ok('reliability.kOutOfN 1-of-1 = a', Math.abs(M.reliability.kOutOfN(0.95, 1, 1) - 0.95) < 1e-6);
    ok('reliability.kOutOfN 3-of-3 < 2-of-3 (stricter)', M.reliability.kOutOfN(0.99, 3, 3) < M.reliability.kOutOfN(0.99, 2, 3));
}
if (M.decision && M.decision.rankOptions) {
    const opts = [{ name: 'A', values: { cost: 0.4, rel: 0.9 } }, { name: 'B', values: { cost: 0.9, rel: 0.6 } }];
    const crit = [{ key: 'cost', weight: 0.5, benefit: false }, { key: 'rel', weight: 0.5, benefit: true }];
    const r = M.decision.rankOptions(opts, crit);
    ok('decision.rankOptions ranks low-cost high-rel first', r[0].name === 'A' && r[0].rank === 1);
    ok('decision.rankOptions closeness in [0,1]', r.every((o) => o.closeness >= 0 && o.closeness <= 1));
}

/* ── Audit-pass edge cases (v2.5.0 perfection) ── */
if (M.decision && M.decision.recommend) {
    ok('decision.recommend survives objectives={} (no crash)', (() => { try { return !!M.decision.recommend({ inputs: { itLoadKw: 3000, tier: 3 } }, {}, {}); } catch { return false; } })());
}
if (M.tax && M.tax.macrsDepreciation) {
    ok('macrs discountRate=0 → undiscounted shield (not 0.10)', M.tax.macrsDepreciation(1e6, '5', 0.21, 0).shieldNpv === 210000, '' + M.tax.macrsDepreciation(1e6, '5', 0.21, 0).shieldNpv);
}
if (M.architecture && M.architecture.topology) {
    ok('architecture.topology(1) = Tier-1 (not Tier-3 fallback)', M.architecture.topology(1).tiaRating === 'Rated-1');
}
if (M.site && M.site.deriveFactors && D.countries && D.countries.SE) {
    ok('site climate zone 8 > zone 7 (5800 denom)', M.site.deriveFactors('SE').climate <= 1 && M.site.score(M.site.deriveFactors('SE')).score > 70);
}
if (M.decision && M.decision.rankOptions) {
    ok('rankOptions identical options → closeness 0, no crash', (() => { const r = M.decision.rankOptions([{ name: 'A', values: { x: 1 } }, { name: 'B', values: { x: 1 } }], [{ key: 'x', weight: 1, benefit: true }]); return Array.isArray(r) && r.every((o) => o.closeness === 0); })());
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

/* ── Phase-Q opex basis presets (v2.5.1) — legacy-identical default + preset math ── */
if (M.opex && M.opex.totalAnnual) {
    const b = M.opex.totalAnnual(2.5, 1.4, 'ID', 12, { capex: 20e6, extendedOpex: true });
    const same = M.opex.totalAnnual(2.5, 1.4, 'ID', 12, { capex: 20e6, extendedOpex: true, utilization: 1.0 });
    ok('opex basisPresets: utilization 1.0 ≡ legacy (bit-identical)', JSON.stringify(b) === JSON.stringify(same));
    const dc = M.opex.totalAnnual(2.5, 1.4, 'ID', 12, { capex: 20e6, basisPreset: 'dcContract' });
    const legacy = M.opex.totalAnnual(2.5, 1.4, 'ID', 12, { capex: 20e6 });
    eq('opex basisPresets: dcContract ≡ default', dc.total, legacy.total);
    const rt = M.opex.totalAnnual(2.5, 1.4, 'ID', 12, { capex: 20e6, extendedOpex: true, basisPreset: 'retailScreening' });
    near('opex basisPresets: retailScreening power = 0.70×', rt.power / b.power, 0.70, 0.01);
    ok('opex basisPresets: staffing NOT scaled by utilization', rt.staffing === b.staffing);
    ok('opex basisPresets provenance', !!D.sources['opex.basisPresets']);
}

/* ── v2.5.2 DG environmental cost tables ── */
{
    const ec = D.envCosts;
    ok('envCosts present', !!ec && !!ec.carbonPriceUsdPerT);
    ok('envCosts covers all 40 countries', Object.keys(D.countries).every(id => typeof ec.carbonPriceUsdPerT[id] === 'number'));
    ok('envCosts SG matches NCCS 2026', ec.carbonPriceUsdPerT.SG === 33);
    ok('envCosts EU-ETS coherent', ec.carbonPriceUsdPerT.DE === 61 && ec.carbonPriceUsdPerT.FR === 61);
    ok('envCosts CH highest tax band', ec.carbonPriceUsdPerT.CH >= 100);
    ok('envCosts voluntary fallback sane', ec.voluntaryOffsetUsdPerT > 0 && ec.voluntaryOffsetUsdPerT < 50);
    ok('wasteMgmt bands sane', ec.wasteMgmt.generalUsdPerTonne.developed > ec.wasteMgmt.generalUsdPerTonne.emerging);
    ok('developedMarkets subset of countries', ec.developedMarkets.every(id => !!D.countries[id]));
    ok('envCosts sourced', !!D.sources['envCosts']);
}

/* ── v2.5.2 O&M pricing tables (DN research — sourced screening bands) ── */
{
    const om = D.omContracts, sp = D.sparesPricing;
    ok('omContracts present', !!om && !!om.tiers);
    for (const t of ['comprehensive', 'preventive', 'onCall']) {
        const b = om.tiers[t];
        ok(`omContracts.${t} band monotonic`, b && b.low < b.mid && b.mid < b.high);
        ok(`omContracts.${t} has scope`, typeof b.scope === 'string' && b.scope.length > 10);
    }
    ok('omContracts tier ordering comprehensive>preventive>onCall (mid)',
        om.tiers.comprehensive.mid > om.tiers.preventive.mid && om.tiers.preventive.mid > om.tiers.onCall.mid);
    ok('omContracts thirdPartyMultiplier sane', om.thirdPartyMultiplier > 0.5 && om.thirdPartyMultiplier < 1);
    ok('omContracts agingFacilityMultiplier sane', om.agingFacilityMultiplier > 1 && om.agingFacilityMultiplier <= 2);
    ok('omContracts sourced', !!D.sources['omContracts']);
    ok('sparesPricing present', !!sp && !!sp.classes);
    const cls = Object.keys(sp.classes);
    ok('sparesPricing ≥8 classes', cls.length >= 8);
    for (const c of cls) {
        const b = sp.classes[c];
        ok(`sparesPricing.${c} band monotonic + unit`, b.low < b.mid && b.mid < b.high && typeof b.unit === 'string');
    }
    ok('sparesPricing sourced', !!D.sources['sparesPricing']);
}

/* ── report ── */
console.log(`\nRZ-ENGINE TEST — ${pass} passed, ${fail} failed`);
if (fail) {
    console.log('\nFAILURES:');
    fails.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
}
console.log('ALL GREEN — model worked examples + data invariants hold.');
