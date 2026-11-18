/**
 * Gate — Conventional plant internals (engine 2.4.0, PRD-CONV-EQUIPMENT-TRUTH phase E1).
 *
 * The engine publishes, per unit, what happens INSIDE the cooling plant: the chiller operating
 * point and refrigeration cycle (R-134a saturation states from an Antoine fit to the published
 * table), the hydronic pump fleet, the tower cells, the CRAH operating point, the mechanical
 * power check, and fleet unit tables (CONV_CALC.getFleet). This gate holds it to:
 *   V1 every derived value recomputed HERE from the authored inputs (never copied from engine output);
 *   L1 energy balance per chiller: condenser duty = evaporator duty + compressor input (+/- 0.1 %);
 *   L2 sum over running units = the plant value (chiller duty, CHW / CDW flow, secondary flow,
 *      CRAH duty per hall, CRAH CHW flow over the campus);
 *   L3 tower: cells running x cell rejection = tower_rejection_kw_th (+/- 0.1 kW);
 *   L4 COP = duty / input, on the plant and on one unit;
 *   L5 0 < Carnot fraction < 1;
 *   L6 pressure fit within 1 % of the R-134a table over 0-50 C, monotonic, P_cond > P_evap;
 *   L7 pump sanity: P = rho g Q H / eta at every pump, power linear in flow and in head on a
 *      recomputed model, tower fan on the cube law, secondary duty count is the smallest that
 *      carries the duty flow;
 *   L8 mechanical headroom >= 0 (plant input inside the PUE-implied non-IT load);
 *   L9 fleet tables: length = installed count, running split, tags, null on bad input,
 *      identical on two calls and two engine loads;
 *   R  red proofs: three deliberate engine mutations each break a law (and are not saved).
 *
 * Run: node --test tools/test-conv-plant-internals.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = readFileSync(join(ROOT, 'js', 'conv-engine.js'), 'utf8');

function loadEngine(source = SOURCE) {
    const sandbox = { window: {}, module: { exports: {} }, console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'conv-engine.js' });
    return sandbox.window.CONV_CALC;
}
const calc = loadEngine();
const snap = calc.snapshot;
const c = snap.cooling;

function near(actual, expected, tol, label) {
    assert.ok(typeof actual === 'number' && Math.abs(actual - expected) <= tol,
        `${label}: engine ${actual}, expected ${expected} +/- ${tol}`);
}

/* R-134a saturation pressure, bar abs — the published table as given in the E1 brief
   (ASHRAE Fundamentals / NIST, rounded). Typed here independently of the engine copy. */
const TABLE = [[-10, 2.006], [0, 2.928], [10, 4.146], [20, 5.717], [30, 7.702], [40, 10.166], [50, 13.18], [60, 16.82]];
/* Independent reference: piecewise Clausius-Clapeyron interpolation of the table (ln P linear
   in 1/T between neighbouring points). No fit, no shared coefficient with the engine. */
function tableKpa(tC) {
    const T = tC + 273.15;
    for (let i = 0; i < TABLE.length - 1; i++) {
        const [t0, p0] = TABLE[i], [t1, p1] = TABLE[i + 1];
        if (tC >= t0 && tC <= t1) {
            const x0 = 1 / (t0 + 273.15), x1 = 1 / (t1 + 273.15);
            const f = (1 / T - x0) / (x1 - x0);
            return 100 * Math.exp(Math.log(p0) + f * (Math.log(p1) - Math.log(p0)));
        }
    }
    return null;
}

/* ── the hand calculation, from the AUTHORED inputs only ───────────────────── */
const H = (() => {
    const it = 30000, itDesign = 40000, pue = 1.45, eta = 0.96, unit = 5000, sp = 0.16491, cp = 4.186;
    const dT = 7.6, chws = 25.4 - 0 - 6.0, cdwS = 32, range = 5, apE = 1.5, apC = 1.5;
    const rho = 1000, g = 9.80665, ep = 0.80, em = 0.95, ev = 0.97;
    const hPri = 15, hSec = 30, hCdw = 25, secUnit = 250, standby = 1, wb = 27, fan = 55, crahKw = 130, halls = 4;
    const duty = it / eta;                                   /* 31,250 */
    const running = Math.ceil(duty / unit), total = Math.ceil(itDesign / eta / unit) + 1;
    const unitDuty = duty / running, unitInput = duty * sp / running, unitCond = unitDuty + unitInput;
    const dutyFlow = duty / (cp * dT), unitChw = dutyFlow / running, unitCdw = unitCond / (cp * range);
    const evap = chws - apE, cond = cdwS + range + apC, lift = cond - evap;
    const pE = tableKpa(evap), pC = tableKpa(cond);
    const carnot = (evap + 273.15) / lift, cop = 1 / sp;
    const kwE = (q, h) => rho * g * (q / 1000) * h / 1000 / ep / (em * ev);
    const secDuty = Math.ceil(dutyFlow / secUnit), secFlow = dutyFlow / secDuty;
    const pri = kwE(unitChw, hPri), sec = kwE(secFlow, hSec), cdw = kwE(unitCdw, hCdw);
    const pumps = pri * running + sec * secDuty + cdw * running;
    const rated = unit * (1 + sp), load = unitCond / rated * 100, fanKw = fan * (load / 100) ** 3;
    const hallIt = it / halls, crahRun = Math.ceil(hallIt / crahKw), crahDuty = hallIt / crahRun;
    const mech = duty * sp + pumps + fanKw * running;
    const headroom = it * pue - it - it * (1 / eta - 1) - mech;
    return {
        running, total, unitDuty, unitInput, unitCond, dutyFlow, unitChw, unitCdw, evap, cond, lift, pE, pC,
        carnot, cop, secDuty, secCount: secDuty + standby, secFlow, pri, sec, cdw, pumps, rated, load, fanKw,
        hallIt, crahRun, crahDuty, crahChw: crahDuty / (cp * dT), mech, headroom, approach: cdwS - wb,
    };
})();

test('V0 engine publishes the plant-internals family (>= 2.4.0)', () => {
    const [maj, min] = String(snap.meta.version).split('.').map(Number);
    assert.ok(maj > 2 || (maj === 2 && min >= 4), `engine ${snap.meta.version} predates the plant internals`);
    assert.equal(c.chiller_refrigerant, 'R-134a');
    assert.equal(c.pump_speed_pct, 100, 'duty point = design point: speed 100 %');
    assert.deepEqual(JSON.parse(JSON.stringify(calc.r134aSatTable)).map((r) => [r.t_c, r.p_bar_abs]), TABLE,
        'the engine copy of the R-134a table differs from the published values');
});

test('V1 expected values (hand calculation from the authored inputs)', () => {
    const rows = [
        ['chiller_unit_duty_kw_th', H.unitDuty, 0.05], ['chiller_unit_chw_flow_lps', H.unitChw, 0.05],
        ['chiller_unit_condenser_duty_kw_th', H.unitCond, 0.05], ['chiller_unit_cdw_flow_lps', H.unitCdw, 0.05],
        ['chiller_evap_sat_c', H.evap, 0.005], ['chiller_cond_sat_c', H.cond, 0.005], ['chiller_lift_k', H.lift, 0.005],
        /* pressures: engine fit vs independent table interpolation, 1 % */
        ['chiller_evap_sat_kpa_abs', H.pE, H.pE * 0.01], ['chiller_cond_sat_kpa_abs', H.pC, H.pC * 0.01],
        ['chiller_evap_sat_kpa_g', H.pE - 101.325, H.pE * 0.01], ['chiller_cond_sat_kpa_g', H.pC - 101.325, H.pC * 0.01],
        ['chiller_pressure_ratio', H.pC / H.pE, 0.02], ['chiller_carnot_cop', H.carnot, 0.005],
        ['chiller_carnot_fraction', H.cop / H.carnot, 0.0006],
        ['chw_primary_pump_count', 2 * H.total, 0], ['chw_primary_pumps_running', H.running, 0],
        ['chw_primary_pump_flow_lps', H.unitChw, 0.05], ['chw_primary_pump_kw_e', H.pri, 0.05],
        ['chw_primary_fleet_kw_e', H.pri * H.running, 0.05],
        ['chw_secondary_pump_count', H.secCount, 0], ['chw_secondary_pumps_running', H.secDuty, 0],
        ['chw_secondary_pump_flow_lps', H.secFlow, 0.05], ['chw_secondary_pump_kw_e', H.sec, 0.05],
        ['chw_secondary_fleet_kw_e', H.sec * H.secDuty, 0.05],
        ['cdw_pump_count', H.total, 0], ['cdw_pumps_running', H.running, 0], ['cdw_pump_flow_lps', H.unitCdw, 0.05],
        ['cdw_pump_kw_e', H.cdw, 0.05], ['cdw_fleet_kw_e', H.cdw * H.running, 0.05], ['pump_fleet_input_kw', H.pumps, 0.05],
        ['tower_cell_count', H.total, 0], ['tower_cells_running', H.running, 0],
        ['tower_cell_rejection_kw_th', H.unitCond, 0.05], ['tower_cell_rated_kw_th', H.rated, 0.051],
        ['tower_cell_load_pct', H.load, 0.05], ['tower_approach_k', H.approach, 0.005],
        ['tower_fan_speed_pct', H.load, 0.05], ['tower_fan_kw', H.fanKw, 0.005], ['tower_fan_fleet_kw', H.fanKw * H.running, 0.05],
        ['crah_unit_duty_kw', H.crahDuty, 0.005], ['crah_unit_load_pct', H.crahDuty / 130 * 100, 0.05],
        ['crah_fan_speed_pct', H.crahDuty / 130 * 100, 0.05], ['crah_unit_chw_flow_lps', H.crahChw, 0.005],
        ['mech_plant_input_kw', H.mech, 0.05], ['mech_plant_headroom_kw', H.headroom, 0.05],
    ];
    for (const [id, expected, tol] of rows) near(c[id], expected, tol, id);
    /* the round numbers worked by hand before the engine was changed */
    for (const [id, v, t] of [['chiller_unit_duty_kw_th', 4464.3, 0.05], ['chiller_unit_condenser_duty_kw_th', 5200.5, 0.05],
        ['chiller_unit_cdw_flow_lps', 248.5, 0.05], ['chiller_evap_sat_c', 17.9, 0], ['chiller_cond_sat_c', 38.5, 0],
        ['chiller_lift_k', 20.6, 0], ['chiller_carnot_cop', 14.13, 0.01], ['tower_approach_k', 5, 0]]) near(c[id], v, t, `hand ${id}`);
    /* reuse, not a second name: the unit load is the plant part load, the cycle COP is plant_cop */
    near(H.unitDuty / 5000 * 100, c.chiller_part_load_pct, 0.05, 'unit load % = chiller_part_load_pct');
    near(c.chiller_unit_duty_kw_th * c.chillers_running, c.heat_rejection_kw, 0.5, 'unit duty x running = heat_rejection_kw');
});

/* Every law, as a list of findings for one engine. The red proofs reuse it on mutated engines. */
function laws(k) {
    const s = k.snapshot.cooling, f = [];
    const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
    const sum = (list, key) => list.filter((u) => u.state === 'running').reduce((a, u) => a + u[key], 0);
    const fleet = (kind, hall) => k.getFleet(kind, hall);
    const ch = fleet('chiller');
    for (const u of ch.filter((x) => x.state === 'running')) {
        if (rel(u.condenserDutyKwTh, u.dutyKwTh + u.inputKwE) > 0.001) f.push(`L1 ${u.tag} condenser ${u.condenserDutyKwTh} != duty + input`);
    }
    if (rel(s.chiller_unit_condenser_duty_kw_th, s.chiller_unit_duty_kw_th + s.chiller_input_per_machine_kw_e) > 0.001) f.push('L1 published unit balance');
    const tolN = (n) => 0.005 * n + 0.05;
    if (Math.abs(sum(ch, 'dutyKwTh') - s.heat_rejection_kw) > tolN(ch.length)) f.push(`L2 chiller duty ${sum(ch, 'dutyKwTh')} != ${s.heat_rejection_kw}`);
    if (Math.abs(sum(ch, 'chwFlowLps') - s.plant_duty_flow_lps) > tolN(ch.length)) f.push('L2 chiller CHW flow');
    const pri = fleet('chw_primary_pump'), sec = fleet('chw_secondary_pump'), cdw = fleet('cdw_pump'), ct = fleet('tower_cell');
    if (Math.abs(sum(pri, 'flowLps') - s.plant_duty_flow_lps) > tolN(pri.length)) f.push('L2 primary flow');
    if (Math.abs(sum(sec, 'flowLps') - s.plant_duty_flow_lps) > tolN(sec.length)) f.push('L2 secondary flow');
    if (Math.abs(sum(cdw, 'flowLps') - s.chiller_unit_cdw_flow_lps * s.chillers_running) > tolN(cdw.length) + 0.4) f.push('L2 CDW flow');
    let crahFlow = 0;
    for (const hall of k.listHalls()) {
        const cr = fleet('crah', hall.code);
        if (Math.abs(sum(cr, 'dutyKw') - hall.it_load_kw) > tolN(cr.length)) f.push(`L2 CRAH duty hall ${hall.code}`);
        crahFlow += sum(cr, 'chwFlowLps');
    }
    if (Math.abs(crahFlow - s.flow_lps) > tolN(4 * s.crah_installed)) f.push(`L2 CRAH CHW flow ${crahFlow} != flow_lps ${s.flow_lps}`);
    if (Math.abs(sum(ct, 'rejectionKwTh') - s.tower_rejection_kw_th) > 0.1) f.push(`L3 tower ${sum(ct, 'rejectionKwTh')} != ${s.tower_rejection_kw_th}`);
    if (Math.abs(s.tower_cells_running * (s.tower_rejection_kw_th / s.tower_cells_running) - s.tower_rejection_kw_th) > 0.1
        || Math.abs(s.tower_cells_running * s.tower_cell_rejection_kw_th - s.tower_rejection_kw_th) > 0.1 * s.tower_cells_running) f.push('L3 published cell rejection');
    if (Math.abs(s.plant_cop - s.heat_rejection_kw / s.chiller_input_kw_e) > 0.01) f.push('L4 plant COP');
    if (Math.abs(ch[0].dutyKwTh / ch[0].inputKwE - 1 / s.chiller_specific_power_kw_e_per_kw_th) > 0.01) f.push('L4 unit COP');
    if (!(s.chiller_carnot_fraction > 0 && s.chiller_carnot_fraction < 1)) f.push(`L5 Carnot fraction ${s.chiller_carnot_fraction}`);
    for (const [t, bar] of TABLE) {
        if (t < 0 || t > 50) continue;
        const e = rel(k.refrigerantSatKpa('R-134a', t), bar * 100);
        if (e > 0.01) f.push(`L6 fit ${(e * 100).toFixed(2)} % at ${t} C`);
    }
    let prev = -Infinity;
    for (let t = -10; t <= 60; t += 0.5) {
        const p = k.refrigerantSatKpa('R-134a', t);
        if (!(p > prev)) { f.push(`L6 not monotonic at ${t} C`); break; }
        prev = p;
    }
    if (!(s.chiller_cond_sat_kpa_abs > s.chiller_evap_sat_kpa_abs)) f.push('L6 P_cond <= P_evap');
    if (!(s.mech_plant_headroom_kw >= 0)) f.push(`L8 headroom ${s.mech_plant_headroom_kw}`);
    for (const [kind, n, run] of [['chiller', s.chillers_total, s.chillers_running], ['chw_primary_pump', s.chw_primary_pump_count, s.chw_primary_pumps_running],
        ['chw_secondary_pump', s.chw_secondary_pump_count, s.chw_secondary_pumps_running], ['cdw_pump', s.cdw_pump_count, s.cdw_pumps_running],
        ['tower_cell', s.tower_cell_count, s.tower_cells_running]]) {
        const list = fleet(kind);
        if (list.length !== n) f.push(`L9 ${kind} length ${list.length} != ${n}`);
        if (list.filter((u) => u.state === 'running').length !== run) f.push(`L9 ${kind} running != ${run}`);
    }
    return f;
}

test('L1-L6, L8, L9 laws hold on the shipped engine', () => {
    assert.deepEqual(laws(calc), []);
});

test('L7 pump and fan sanity', () => {
    const rho = c.water_density_kg_m3, g = c.gravity_m_s2, eta = c.pump_efficiency * c.pump_motor_efficiency * c.pump_vfd_efficiency;
    for (const [kind, key] of [['chw_primary_pump', 'chw_primary_pump_kw_e'], ['chw_secondary_pump', 'chw_secondary_pump_kw_e'], ['cdw_pump', 'cdw_pump_kw_e']]) {
        const u = calc.getFleet(kind)[0];
        near(u.kwE, rho * g * u.flowLps / 1000 * u.headM / 1000 / eta, 0.01, `${kind} P = rho g Q H / eta`);
        near(c[key], u.kwE, 0.05, `${kind} fleet row = published per-pump kW`);
        assert.equal(u.speedPct, 100);
    }
    /* power is linear in flow (fixed head) and in head (fixed flow) on a recomputed model */
    const base = JSON.parse(JSON.stringify(calc.model));
    const twice = JSON.parse(JSON.stringify(base)); twice.cooling.cdw_head_m *= 2;
    near(calc.recompute(twice).cooling.cdw_pump_kw_e, 2 * c.cdw_pump_kw_e, 0.11, 'CDW pump kW doubles with head');
    const peak = JSON.parse(JSON.stringify(base)); peak.campus.halls.forEach((h) => { h.it_load_kw = 9000; });
    const p = calc.recompute(peak).cooling;
    near(p.cdw_pump_kw_e / c.cdw_pump_kw_e, p.cdw_pump_flow_lps / c.cdw_pump_flow_lps, 0.002, 'CDW pump kW scales with flow');
    /* tower fan on the cube law */
    near(c.tower_fan_kw, c.tower_fan_motor_kw * (c.tower_fan_speed_pct / 100) ** 3, 0.07, 'fan cube law (speed published to 0.1 %)');
    assert.ok(c.tower_fan_kw < c.tower_fan_motor_kw, 'fan above its motor rating');
    /* secondary duty count: the smallest that carries the duty flow at the rated unit flow */
    assert.ok(c.chw_secondary_pumps_running * c.chw_secondary_unit_flow_lps >= c.plant_duty_flow_lps, 'secondary duty pumps undersized');
    assert.ok((c.chw_secondary_pumps_running - 1) * c.chw_secondary_unit_flow_lps < c.plant_duty_flow_lps, 'secondary duty count not minimal');
    assert.ok(c.chw_secondary_pump_flow_lps <= c.chw_secondary_unit_flow_lps, 'secondary pump above rated flow');
    /* CRAH: the running units cover the hall demand */
    assert.ok(c.crah_unit_load_pct <= 100, `CRAH unit load ${c.crah_unit_load_pct} % > 100`);
});

test('L9 fleet tables: tags, split, hall scope, bad input, determinism', () => {
    const ch = JSON.parse(JSON.stringify(calc.getFleet('chiller')));   /* out of the vm realm */
    assert.deepEqual(ch.map((u) => u.tag), Array.from({ length: c.chillers_total }, (_, i) => `CH-${String(i + 1).padStart(2, '0')}`));
    assert.deepEqual(ch.map((u) => u.state), ch.map((u, i) => (i < c.chillers_running ? 'running' : 'standby')), 'lead order 1...running');
    near(ch[0].loadPct, c.chiller_part_load_pct, 0.05, 'chiller unit loadPct = chiller_part_load_pct');
    assert.equal(ch[ch.length - 1].dutyKwTh, 0, 'standby unit carries no duty');
    const pri = calc.getFleet('chw_primary_pump');
    assert.equal(pri[0].tag, 'CHWP-01A'); assert.equal(pri[1].tag, 'CHWP-01B'); assert.equal(pri[1].state, 'standby');
    assert.equal(pri[2 * c.chillers_running].state, 'standby', 'A pump of the first standby train must stand by');
    assert.equal(calc.getFleet('chw_secondary_pump')[0].tag, 'CHWP-S1');
    assert.equal(calc.getFleet('cdw_pump')[0].tag, 'CDWP-01');
    assert.equal(calc.getFleet('tower_cell')[9].tag, 'CT-10');
    const crah = calc.getFleet('crah', 'A');
    assert.equal(crah.length, c.crah_installed); assert.equal(crah[0].tag, 'CRAH-A01'); assert.equal(crah[58].tag, 'CRAH-A59');
    assert.equal(crah.filter((u) => u.state === 'running').length, c.crah_running);
    near(crah[0].fanSpeedPct, c.crah_fan_speed_pct, 0.05, 'CRAH fleet fan speed = c.crah_fan_speed_pct');
    near(crah[0].fanSpeedPct, crah[0].loadPct, 0, 'CRAH fan speed = unit load (constant air delta-T rule)');
    near(pri[0].flowLps, c.chw_primary_pump_flow_lps, 0.05, 'primary pump fleet flow = c.chw_primary_pump_flow_lps');
    near(c.chw_primary_pump_flow_lps, c.chiller_unit_chw_flow_lps, 0, 'primary pump flow = unit evaporator flow');
    const gen = calc.getFleet('genset', 'b');
    assert.equal(gen.length, snap.electrical.genset_per_hall); assert.equal(gen[0].tag, 'GEN-B1');
    assert.ok(gen.every((u) => u.state === 'standby' && u.outputKw === 0), 'gensets run on utility power: all standby');
    assert.equal(calc.getFleet('crah'), null, 'hall-scoped kind without a hall');
    assert.equal(calc.getFleet('crah', 'Z'), null, 'unknown hall');
    assert.equal(calc.getFleet('nonsense'), null, 'unknown kind');
    const again = loadEngine();
    for (const kind of calc.fleetKinds) {
        const a = JSON.stringify(calc.getFleet(kind, 'C')), b = JSON.stringify(calc.getFleet(kind, 'C'));
        assert.equal(a, b, `${kind}: two calls differ`);
        assert.equal(JSON.stringify(again.getFleet(kind, 'C')), a, `${kind}: two engine loads differ`);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(calc.recompute().cooling)), JSON.parse(JSON.stringify(c)), 'recompute() = snapshot');
});

/* Red proofs: each mutation of the engine SOURCE must break at least one law. Nothing is written. */
const MUTATIONS = [
    ['condenser duty without the compressor power',
        'var unitCond = unitDuty === null ? null : unitDuty + unitInput;', 'var unitCond = unitDuty === null ? null : unitDuty;', /L1|L3/],
    ['pressure-fit coefficient perturbed (B + 50)', 'B: 2236.949', 'B: 2286.949', /L6/],
    ['fleet running count off by one', "out.push(unit(i, 'CH-' + pad2(i), i <= run,", "out.push(unit(i, 'CH-' + pad2(i), i <= run + 1,", /L2|L9/],
];
for (const [name, from, to, expect] of MUTATIONS) {
    test(`R red proof: ${name}`, () => {
        assert.equal(SOURCE.split(from).length, 2, `mutation anchor not found exactly once: ${from}`);
        const found = laws(loadEngine(SOURCE.replace(from, to)));
        assert.ok(found.some((m) => expect.test(m)), `mutation "${name}" broke no law: ${JSON.stringify(found)}`);
        console.log(`  red: ${name} -> ${found.slice(0, 2).join(' | ')}`);
    });
}
