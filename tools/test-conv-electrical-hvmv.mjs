/**
 * Gate — Conventional HV/MV, generation and protection basis (engine 2.3.0, PRD-CONV-LIVING-PLANT P4a).
 *
 * The engine publishes a 150 kV / 20 kV / 0.4 kV basis and a graded protection chain as TRAINING
 * settings (not a relay study). This gate holds it to:
 *   V1 expected values, recomputed HERE from the authored inputs (never copied from engine output);
 *   L1 power transformer N-1 loading <= 100 % at adopted AND at full design demand;
 *   L2 distribution transformer contingency <= 100 %;
 *   L3 genset fleet with one set lost per hall >= the hall design facility load;
 *   L4 LV board fault <= 65 kA board rating; L5 20 kV fault <= 25 kA switchgear;
 *   L6 every TMS is the SMALLEST step that meets every grading point (one step lower fails one),
 *      and every TMS <= pro_tms_max;
 *   L7 independent cross-check with js/conv/tcc.js: the full chain WITH the LV long-time stage
 *      coordinates at every current coordinate() checks (margin >= 0.3 s); a 16-point log sweep from
 *      1.3 x feeder pickup to the LV maximum fault keeps feeder - LV >= margin wherever both operate;
 *      the feeder stays below the distribution transformer through-fault damage curve; planted
 *      defects (feeder back to SI, feeder TMS one step lower, a halved upstream TMS) are reported;
 *   L8 deterministic across two independent engine loads.
 *
 * Run: node --test tools/test-conv-electrical-hvmv.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Tcc = require(join(ROOT, 'js', 'conv', 'tcc.js'));

function loadEngine() {
    const sandbox = { window: {}, module: { exports: {} }, console };
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(join(ROOT, 'js', 'conv-engine.js'), 'utf8'), sandbox, { filename: 'conv-engine.js' });
    return sandbox.window.CONV_CALC;
}
const calc = loadEngine();
const snap = calc.snapshot;
const el = snap.electrical;
const S3 = Math.sqrt(3);

function near(actual, expected, tol, label) {
    assert.ok(typeof actual === 'number' && Math.abs(actual - expected) <= tol,
        `${label}: engine ${actual}, expected ${expected} +/- ${tol}`);
}
/* IEC 60255-151 with tcc.js conventions (pickup 1.05 x Is, flat above 20 x Is) — written out here,
   independent of the engine. */
const K = { SI: [0.14, 0.02], EI: [80, 2] };
function iec(curve, Is, tms, I) {
    let m = I / Is;
    if (m < 1.05) return null;
    if (m > 20) m = 20;
    return tms * K[curve][0] / (Math.pow(m, K[curve][1]) - 1);
}
function smallestTms(curve, Is, points, step) {
    let tms = 0;
    for (const { I, need } of points) tms = Math.max(tms, Math.ceil(need / iec(curve, Is, 1, I) / step - 1e-9) * step);
    return Math.round(tms * 1e6) / 1e6;
}

/* ── the hand calculation, from the AUTHORED inputs only ───────────────────── */
const H = (() => {
    const pf = 0.95, growth = 0.20, kvH = 150, kaH = 25, zT = 12.5, kvM = 20, ngr = 12;
    const kva = 3150, zD = 7, vL = 400, gm = 0.3, step = 0.01, tr = 4, isdX = 4, tsd = 0.2;
    const hallKw = 10000 * 1.45, halls = 4;
    const demand = 30000 * 1.45 / pf / 1000;                          /* adopted scenario 30 MW IT */
    const demandDesign = halls * hallKw / pf / 1000;
    const sizing = Math.max(demandDesign, demand * (1 + growth));
    const tx = [31.5, 40, 50, 63, 80, 100].find((r) => r >= sizing);
    const hvFla = tx * 1000 / (S3 * kvH), mvFla = tx * 1000 / (S3 * kvM);
    const src = S3 * kvH * kaH;
    const mvKa = tx / ((tx / src + zT / 100) * S3 * kvM);
    const lvKa = (kva / 1000) / (((kva / 1000) / (S3 * kvM * mvKa) + zD / 100) * S3 * vL / 1000);
    const through = lvKa * 1000 * (vL / 1000) / kvM;
    const dMv = kva / (S3 * kvM), dLv = kva * 1000 / (S3 * vL);
    const perStream = Math.ceil(hallKw / pf / kva);
    const gens = Math.ceil(hallKw / (3000 * 0.8)) + 1;
    const fIs = 1.25 * dMv, ltA = isdX * dLv * vL / 1000 / kvM;
    const fTms = smallestTms('EI', fIs, [{ I: ltA, need: tr * (6 / isdX) ** 2 + gm }, { I: through, need: tsd + gm }], step);
    const fInst = 1.3 * through;
    const iIs = 1.1 * mvFla, mvA = mvKa * 1000;
    const fAtMv = Math.min(iec('EI', fIs, fTms, mvA), mvA >= fInst ? 0.05 : Infinity);
    const iTms = smallestTms('SI', iIs, [{ I: mvA, need: fAtMv + gm }], step);
    const iT = iec('SI', iIs, iTms, mvA);
    const hIs = 1.2 * hvFla, hA = mvA * kvM / kvH;
    const hTms = smallestTms('SI', hIs, [{ I: hA, need: iT + gm }], step);
    return {
        demand_mva: demand, demand_design_mva: demandDesign, hv_tx_sizing_mva: sizing, hv_tx_mva: tx,
        hv_tx_fla_a: hvFla, mv_tx_fla_a: mvFla,
        hv_tx_load_pct_normal: demand / (2 * tx) * 100, hv_tx_load_pct_n1: demand / tx * 100,
        hv_tx_load_pct_n1_design: demandDesign / tx * 100,
        hv_source_mva: src, mv_fault_level_ka: mvKa, mv_earth_fault_a: kvM * 1000 / S3 / ngr,
        hall_facility_design_kw: hallKw, dist_tx_per_stream_per_hall: perStream, dist_tx_count: perStream * 2 * halls,
        dist_tx_load_pct_normal: hallKw / pf / (perStream * 2 * kva) * 100,
        dist_tx_load_pct_contingency: hallKw / pf / (perStream * kva) * 100,
        dist_tx_fla_mv_a: dMv, dist_tx_fla_lv_a: dLv, lv_fault_level_ka: lvKa, dist_tx_through_fault_mv_a: through,
        genset_per_hall: gens, genset_count: gens * halls,
        genset_n1_margin_pct: ((gens - 1) * 2400 - hallKw) / hallKw * 100,
        pro_lv_ir_a: dLv, pro_lv_isd_a: isdX * dLv, pro_feeder_lt_grading_a: ltA, pro_lv_lt_t_s: tr * (6 / isdX) ** 2,
        pro_feeder_is_a: fIs, pro_feeder_tms: fTms, pro_feeder_lt_t_s: iec('EI', fIs, fTms, ltA),
        pro_feeder_inst_a: fInst, pro_feeder_t_s: iec('EI', fIs, fTms, through),
        pro_incomer_is_a: iIs, pro_incomer_tms: iTms, pro_incomer_t_s: iT,
        pro_hv_grading_a: hA, pro_hv_is_a: hIs, pro_hv_tms: hTms, pro_hv_t_s: iec('SI', hIs, hTms, hA),
    };
})();

test('V0 engine version is 2.3.0 and the relay curves are published', () => {
    assert.equal(snap.meta.version, '2.3.0');
    assert.equal(el.pro_feeder_curve, 'EI');
    assert.equal(el.pro_incomer_curve, 'SI');
    assert.equal(el.pro_hv_curve, 'SI');
    assert.equal(el.pro_lv_tr_s, 4);
    assert.equal(el.pro_tms_max, 1.5);
});

test('V1 expected values (hand calculation from the authored inputs)', () => {
    /* tolerance = the engine's publication rounding (+ a little for rounded inputs) */
    const tol = {
        demand_mva: 0.0006, demand_design_mva: 0.0006, hv_tx_sizing_mva: 0.0006, hv_tx_mva: 0,
        hv_tx_fla_a: 0.05, mv_tx_fla_a: 0.05, hv_tx_load_pct_normal: 0.05, hv_tx_load_pct_n1: 0.05,
        hv_tx_load_pct_n1_design: 0.05, hv_source_mva: 0.05, mv_fault_level_ka: 0.005, mv_earth_fault_a: 0.05,
        hall_facility_design_kw: 0, dist_tx_per_stream_per_hall: 0, dist_tx_count: 0,
        dist_tx_load_pct_normal: 0.05, dist_tx_load_pct_contingency: 0.05, dist_tx_fla_mv_a: 0.005,
        dist_tx_fla_lv_a: 0.05, lv_fault_level_ka: 0.005, dist_tx_through_fault_mv_a: 0.05,
        genset_per_hall: 0, genset_count: 0, genset_n1_margin_pct: 0.05,
        pro_lv_ir_a: 0.05, pro_lv_isd_a: 0.05, pro_feeder_lt_grading_a: 0.05, pro_lv_lt_t_s: 0.0006,
        pro_feeder_is_a: 0.005, pro_feeder_tms: 1e-9, pro_feeder_lt_t_s: 0.002, pro_feeder_inst_a: 0.05,
        pro_feeder_t_s: 0.002, pro_incomer_is_a: 0.05, pro_incomer_tms: 1e-9, pro_incomer_t_s: 0.002,
        pro_hv_grading_a: 0.05, pro_hv_is_a: 0.005, pro_hv_tms: 1e-9, pro_hv_t_s: 0.002,
    };
    for (const [id, t] of Object.entries(tol)) near(el[id], H[id], t, id);
    /* the round numbers worked by hand before the engine was changed */
    const hand = [
        ['demand_design_mva', el.demand_design_mva, 61.053, 0.001], ['hv_tx_mva', el.hv_tx_mva, 63, 0],
        ['hv_tx_fla_a', el.hv_tx_fla_a, 242.5, 0.05], ['mv_tx_fla_a', el.mv_tx_fla_a, 1818.7, 0.05],
        ['hv_tx_load_pct_n1', el.hv_tx_load_pct_n1, 72.7, 0.05], ['hv_tx_load_pct_n1_design', el.hv_tx_load_pct_n1_design, 96.9, 0.05],
        ['mv_fault_level_ka', el.mv_fault_level_ka, 13.50, 0.005], ['lv_fault_level_ka', el.lv_fault_level_ka, 59.25, 0.01],
        ['dist_tx_through_fault_mv_a', el.dist_tx_through_fault_mv_a, 1185, 0.5],
        ['pro_feeder_tms', el.pro_feeder_tms, 1.08, 1e-9], ['pro_incomer_tms', el.pro_incomer_tms, 0.10, 1e-9],
        ['pro_hv_tms', el.pro_hv_tms, 0.18, 1e-9],
    ];
    for (const [id, actual, expected, t] of hand) near(actual, expected, t, `hand ${id}`);
    /* hall design facility follows the engine's own hall capacity and PUE, never a literal */
    near(el.hall_facility_design_kw, calc.listHalls()[0].it_design_kw * snap.site.pue, 0.05, 'hall facility = hall IT design x PUE');
    near(el.demand_mva, el.epms_total_kw / el.power_factor_design / 1000, 0.001, 'demand from epms_total_kw');
    near(el.demand_design_mva, snap.site.it_design_kw * snap.site.pue / el.power_factor_design / 1000, 0.001, 'design demand from the engine');
    assert.equal(el.pro_feeder_inrush_ok, true, 'inrush point lies below both feeder stages');
});

test('L1-L5 equipment laws', () => {
    assert.ok(el.hv_tx_load_pct_n1 <= 100, `L1 power transformer N-1 loading ${el.hv_tx_load_pct_n1} %`);
    assert.ok(el.hv_tx_load_pct_n1_design <= 100, `L1 power transformer N-1 loading at design ${el.hv_tx_load_pct_n1_design} %`);
    assert.ok(el.hv_tx_mva >= el.hv_tx_sizing_mva, 'L1 rating below the sizing demand');
    assert.ok(el.dist_tx_load_pct_contingency <= 100, `L2 distribution transformer contingency ${el.dist_tx_load_pct_contingency} %`);
    const fleetN1 = (el.genset_per_hall - 1) * el.genset_unit_kw * el.genset_max_loading;
    assert.ok(fleetN1 >= el.hall_facility_design_kw, `L3 genset fleet N-1 ${fleetN1} kW < hall ${el.hall_facility_design_kw} kW`);
    assert.ok(el.lv_fault_level_ka <= 65, `L4 LV fault ${el.lv_fault_level_ka} kA exceeds a 65 kA board`);
    assert.ok(el.mv_fault_level_ka <= 25, `L5 20 kV fault ${el.mv_fault_level_ka} kA exceeds 25 kA switchgear`);
    assert.ok(el.hv_fault_level_ka <= el.hv_switchgear_rated_ka, 'L5 150 kV fault level exceeds the GIS rating');
});

/* every grading point of the chain, as [name, curve, Is, I, need] — the downstream times come from tcc.js */
function gradingPoints(e, tms) {
    const ch = chainFrom(e, tms);
    const lvIr = e.pro_lv_ir_a, ref = e.lv_voltage_v / (e.mv_voltage_kv * 1000);
    const ltA = e.pro_lv_isd_a * ref;
    const lvJustBelow = Tcc.operate(ch[0].dev, e.pro_lv_isd_a * (1 - 1e-9));
    const mvA = e.mv_fault_level_ka * 1000;
    return [
        ['feeder over LV long-time', e.pro_feeder_curve, ch[1].dev, ltA, lvJustBelow + e.pro_grading_margin_s, lvIr],
        ['feeder over LV short-time', e.pro_feeder_curve, ch[1].dev, e.dist_tx_through_fault_mv_a, e.pro_lv_tsd_s + e.pro_grading_margin_s],
        ['incomer over feeder', e.pro_incomer_curve, ch[2].dev, mvA, Tcc.operate(ch[1].dev, mvA) + e.pro_grading_margin_s],
        ['hv over incomer', e.pro_hv_curve, ch[3].dev, e.pro_hv_grading_a, Tcc.operate(ch[2].dev, mvA) + e.pro_grading_margin_s],
    ];
}

test('L6 every TMS is the smallest step that meets every grading point, and within range', () => {
    const tol = 2e-3;   /* published currents are rounded to 0.1 A / 0.01 kA */
    const pts = gradingPoints(el);
    for (const [name, , dev, I, need] of pts) {
        const t = Tcc.operate(dev, I);
        assert.ok(t !== null && t >= need - tol, `${name}: ${t} s < ${need} s`);
    }
    for (const [relay, key, names] of [['feeder', 'pro_feeder_tms', ['feeder over LV long-time', 'feeder over LV short-time']],
        ['incomer', 'pro_incomer_tms', ['incomer over feeder']], ['hv', 'pro_hv_tms', ['hv over incomer']]]) {
        assert.ok(el[key] <= el.pro_tms_max, `${relay}: TMS ${el[key]} above the setting range ${el.pro_tms_max}`);
        const lower = gradingPoints(el, { [relay]: el[key] - el.pro_tms_step }).filter((p) => names.includes(p[0]));
        const fails = lower.filter(([, , dev, I, need]) => Tcc.operate(dev, I) < need - tol);
        assert.ok(fails.length > 0, `${relay}: TMS ${el[key] - el.pro_tms_step} still meets every grading point — not the smallest step`);
    }
    near(el.pro_lv_lt_t_s, Tcc.operate(chainFrom(el)[0].dev, el.pro_lv_isd_a * (1 - 1e-9)), 0.002, 'LV long-time time just below Isd');
});

/* The chain from the engine's PUBLISHED settings, load side first, LV long-time stage included. */
function chainFrom(e, tms, curve) {
    const o = tms || {}, c = curve || {};
    return [
        { id: 'LV main LSIG', V: e.lv_voltage_v, dev: { kind: 'lsig', Ir: e.pro_lv_ir_a, tr: e.pro_lv_tr_s, Isd: e.pro_lv_isd_a, tsd: e.pro_lv_tsd_s, i2t: false } },
        { id: '20 kV feeder 51/50', V: e.mv_voltage_kv * 1000, dev: { kind: 'relay', curve: c.feeder || e.pro_feeder_curve, Is: e.pro_feeder_is_a,
            TMS: o.feeder || e.pro_feeder_tms, inst: { I: e.pro_feeder_inst_a, t: e.pro_feeder_inst_s } } },
        { id: '20 kV incomer 51', V: e.mv_voltage_kv * 1000, dev: { kind: 'relay', curve: e.pro_incomer_curve, Is: e.pro_incomer_is_a, TMS: o.incomer || e.pro_incomer_tms } },
        { id: '150 kV transformer feeder 51', V: e.hv_voltage_kv * 1000, dev: { kind: 'relay', curve: e.pro_hv_curve, Is: e.pro_hv_is_a, TMS: o.hv || e.pro_hv_tms } },
    ];
}
function sweepCurrents(e) {
    const lo = 1.3 * e.pro_feeder_is_a, hi = e.dist_tx_through_fault_mv_a, n = 16;
    const list = [];
    for (let i = 0; i < n; i++) list.push(lo * Math.pow(hi / lo, i / (n - 1)));
    list.push(e.pro_lv_isd_a * e.lv_voltage_v / (e.mv_voltage_kv * 1000) * (1 - 1e-6));   /* just below Isd */
    return list.sort((a, b) => a - b);
}
/* All coordination findings for a chain: tcc.coordinate on the full chain at the LV fault and on each
   upstream pair at the 20 kV fault, plus the feeder-over-LV sweep. Returns { ok, minMargin, findings }. */
function assess(chain, e) {
    const gm = e.pro_grading_margin_s, ref = e.lv_voltage_v / (e.mv_voltage_kv * 1000);
    const runs = [
        Tcc.coordinate(chain, e.lv_fault_level_ka * 1000, gm),
        Tcc.coordinate(chain.slice(1, 3), e.mv_fault_level_ka * 1000, gm),
        Tcc.coordinate(chain.slice(2, 4), e.mv_fault_level_ka * 1000, gm),
    ];
    const pairs = runs.flatMap((r) => r.pairs);
    const findings = pairs.filter((p) => !p.ok).map((p) => `${p.down} -> ${p.up} at ${p.I.toFixed(0)} A: ${p.margin.toFixed(3)} s`);
    const sweep = [];
    for (const Imv of sweepCurrents(e)) {
        const tf = Tcc.operate(chain[1].dev, Imv), tl = Tcc.operate(chain[0].dev, Imv / ref);
        if (tf === null || tl === null) continue;
        sweep.push({ Imv, margin: tf - tl });
        if (tf - tl < gm - 1e-9) findings.push(`sweep ${Imv.toFixed(1)} A at 20 kV: feeder ${tf.toFixed(3)} s - LV ${tl.toFixed(3)} s < ${gm}`);
    }
    const finite = pairs.map((p) => p.margin).concat(sweep.map((s) => s.margin)).filter(Number.isFinite);
    return { ok: findings.length === 0 && runs.every((r) => r.ok), minMargin: Math.min(...finite), findings, pairs, sweep };
}

test('L7 tcc.js cross-check: full chain with the LV long-time stage, sweep, damage curve, planted defects', () => {
    const res = assess(chainFrom(el), el);
    assert.ok(res.ok, 'chain miscoordinated: ' + res.findings.join('; '));
    assert.ok(res.minMargin >= 0.3 - 1e-9, `minimum margin ${res.minMargin} s < 0.3 s`);
    const graded = new Set(res.pairs.map((p) => `${p.down} -> ${p.up}`));
    for (const pair of ['LV main LSIG -> 20 kV feeder 51/50', '20 kV feeder 51/50 -> 20 kV incomer 51', '20 kV incomer 51 -> 150 kV transformer feeder 51']) {
        assert.ok(graded.has(pair), `pair not graded by tcc.coordinate: ${pair}`);
    }
    assert.ok(res.sweep.length >= 12, `sweep graded only ${res.sweep.length} currents where both operate`);
    /* the LV long-time stage is really in the chain: it operates in the sweep's lower half */
    assert.ok(Tcc.operate(chainFrom(el)[0].dev, 2 * el.pro_lv_ir_a) > 1, 'LV long-time stage missing from the chain');

    /* the feeder curve lies below the distribution transformer through-fault damage curve */
    let damageChecked = 0;
    for (const Imv of sweepCurrents(el)) {
        const td = Tcc.txDamage(el.dist_tx_kva, el.mv_voltage_kv * 1000, el.dist_tx_impedance_pct, Imv);
        const tf = Tcc.operate(chainFrom(el)[1].dev, Imv);
        if (td === null || tf === null) continue;
        damageChecked += 1;
        assert.ok(tf < td, `feeder ${tf.toFixed(3)} s is above the transformer damage curve ${td.toFixed(3)} s at ${Imv.toFixed(1)} A`);
    }
    assert.ok(damageChecked >= 8, `damage curve compared at only ${damageChecked} currents`);

    /* tcc agrees with the engine's own operating times at the grading currents */
    const ch = chainFrom(el);
    near(Tcc.operate(ch[1].dev, el.dist_tx_through_fault_mv_a), el.pro_feeder_t_s, 0.003, 'tcc feeder time');
    near(Tcc.operate(ch[1].dev, el.pro_feeder_lt_grading_a), el.pro_feeder_lt_t_s, 0.01, 'tcc feeder time at the long-time grading point');
    near(Tcc.operate(ch[2].dev, el.mv_fault_level_ka * 1000), el.pro_incomer_t_s, 0.003, 'tcc incomer time');
    near(Tcc.operate(ch[3].dev, el.pro_hv_grading_a), el.pro_hv_t_s, 0.003, 'tcc hv time');
    const inrush = Tcc.txInrush(el.dist_tx_kva, el.mv_voltage_kv * 1000, el.pro_inrush_x, el.pro_inrush_s);
    const tAt = Tcc.operate(ch[1].dev, inrush.I);
    assert.ok(tAt === null || tAt > inrush.t, `feeder operates at inrush: ${tAt} s`);

    const planted = [
        ['feeder curve back to SI', chainFrom(el, null, { feeder: 'SI' })],
        ['feeder TMS one step lower', chainFrom(el, { feeder: el.pro_feeder_tms - el.pro_tms_step })],
        ['incomer TMS halved', chainFrom(el, { incomer: el.pro_incomer_tms / 2 })],
        ['hv TMS halved', chainFrom(el, { hv: el.pro_hv_tms / 2 })],
    ];
    for (const [name, chain] of planted) {
        assert.equal(assess(chain, el).ok, false, `planted defect "${name}" was reported coordinated`);
    }
});

test('L8 deterministic across two engine loads', () => {
    const again = loadEngine();
    assert.deepEqual(JSON.parse(JSON.stringify(again.snapshot.electrical)), JSON.parse(JSON.stringify(el)));
    assert.deepEqual(JSON.parse(JSON.stringify(calc.recompute().electrical)), JSON.parse(JSON.stringify(el)));
});
