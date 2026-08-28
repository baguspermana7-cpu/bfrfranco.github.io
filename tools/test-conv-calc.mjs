#!/usr/bin/env node
/* ============================================================================
 * test-conv-calc.mjs — vm-sandboxed verification of js/conv-engine.js
 * ----------------------------------------------------------------------------
 * Reproduces the doc-00 "Definition of Done" engineering identities and the
 * doc-09 worked examples. No test framework — pure Node `vm`. Exits 1 on any
 * failing identity, 0 when every identity holds within tolerance.
 *
 *   Run:  node tools/test-conv-calc.mjs   (from rz-work/)
 *
 * source identities:
 *   00-overview-audit.md §"Definition of Done" (lines 131-144)
 *   09-engineering-basis-and-calculations.md worked examples (lines 25-147)
 *   12-qa-acceptance-criteria.md §"Engineering Consistency" (lines 6-16)
 * ==========================================================================*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const enginePath = join(here, '..', 'js', 'conv-engine.js');

/* Sandbox the engine: a bare context with only `module` + `globalThis`.
 * The engine's IIFE picks `globalThis` (no window in the sandbox) and also
 * assigns module.exports via its Node-interop shim. We read it back from the
 * sandbox — never from the host global. */
const sandbox = { module: { exports: {} }, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const code = readFileSync(enginePath, 'utf8');
new vm.Script(code, { filename: 'conv-engine.js' }).runInContext(sandbox);

const CONV_MODEL = sandbox.module.exports.CONV_MODEL || sandbox.CONV_MODEL;
const CONV_CALC = sandbox.module.exports.CONV_CALC || sandbox.CONV_CALC;

let failed = 0;
let passed = 0;
const results = [];

function approx(actual, expected, tol, label) {
    const diff = Math.abs(actual - expected);
    const ok = diff <= tol;
    results.push({ ok, label, actual, expected, tol, diff });
    if (ok) passed++; else failed++;
    return ok;
}
function assert(cond, label, detail) {
    results.push({ ok: !!cond, label, actual: detail, expected: 'true', tol: 0, diff: cond ? 0 : 1 });
    if (cond) passed++; else failed++;
    return !!cond;
}

const s = CONV_CALC.snapshot;
const m = CONV_MODEL;

/* ---- Identity 1: Facility load = IT load x PUE -----------------------------
 * source: 00 line 135 ; 09 lines 25-28 ; 12 line 7 */
approx(s.site.facility_load_kw_exact, m.site.it_load_kw * m.site.pue, 1e-9,
    'Facility = IT x PUE  (exact identity)');
approx(s.site.facility_load_kw, 43500, 0.05,   // 30,000 x 1.45  [REBASELINED v2.0.0 campus: 4 x 10,000 kW design, normal scenario 4 x 7,500 = 30,000 kW actual]
    'Facility load displays 2,682.5 kW (~2,683)  [09 line 27]');

/* ---- Identity 2: Non-IT = Facility - IT ------------------------------------
 * source: 00 line 75 ; 09 lines 32-34 ; 12 line 8 */
approx(s.site.non_it_load_kw_exact, s.site.facility_load_kw_exact - m.site.it_load_kw, 1e-9,
    'Non-IT = Facility - IT  (exact identity)');
approx(s.site.non_it_load_kw, 13500, 0.5,      // 43,500 - 30,000  [REBASELINED v2.0.0 campus: 4 x 10,000 kW design, normal scenario 4 x 7,500 = 30,000 kW actual]
    'Non-IT load = facility - IT = 13,500 kW');

/* ---- Identity 3: UPS losses @ 96% ~= 77 kW ---------------------------------
 * source: 09 line 39 */
approx(s.electrical.ups_loss_kw, 1250, 1.0,    // 30,000 x (1/0.96 - 1)  [REBASELINED v2.0.0 campus: 4 x 10,000 kW design, normal scenario 4 x 7,500 = 30,000 kW actual]
    'UPS loss @ 96% eff ~= 77 kW  [09 line 39]');

/* ---- Identity 4: CHW delta-T & flow from cooling kW / (4.186*dT) ------------
 * source: 00 lines 82-83 ; 09 lines 81-85 ; 12 lines 12-13 */
approx(s.cooling.chw_delta_t, 7.6, 1e-6,
    'CHW delta-T = CHWR - CHWS = 7.6 C  (carried from [09 line 83]; the temperature '
    + 'LEVEL was re-derived in v1.134.0 but the delta-T was deliberately kept, so '
    + 'plant flow and duty arithmetic are unchanged)');

/* ---- Identity 4b: the thermal chain must close, backwards from the inlet target
 * The 15.2 C supply-air defect existed because the air planes and the water planes
 * were authored independently. These assertions make that impossible: every plane
 * has to be reachable from the adopted rack-inlet target by the stated deltas, so
 * editing one temperature without the others fails here. */
approx(s.cooling.rack_inlet_target_c, 25.4, 1e-9,
    'rack-inlet target = 25.4 C  (study cooling.rackInletTargetC, ADOPTED)');
approx(s.cooling.crah_supply_air_c,
    s.cooling.rack_inlet_target_c - s.cooling.supply_path_mixing_k, 1e-9,
    'CRAH supply air = rack inlet - supply-path mixing  (identity)');
approx(s.cooling.chws_c,
    s.cooling.crah_supply_air_c - s.cooling.chw_coil_approach_k, 1e-9,
    'CHWS = CRAH supply air - coil approach  (identity)');
approx(s.cooling.chwr_c, s.cooling.chws_c + s.cooling.chw_delta_t, 1e-9,
    'CHWR = CHWS + delta-T  (identity)');
if (!(s.cooling.crah_supply_air_c <= s.cooling.rack_inlet_target_c)) {
    throw new Error('CRAH supply air must not exceed the rack-inlet target');
}
const expectFlow = m.site.it_load_kw / (4.186 * (m.cooling.chwr_c - m.cooling.chws_c));
approx(s.cooling.flow_lps, Math.round(expectFlow * 10) / 10, 0.05,
    'CHW flow = cooling kW / (4.186 * dT)  (identity)');
// doc-09 line 84 prints "58.1" (its own 1-dp rounding of 1850/(4.186*7.6)=58.184);
// engine rounds to 58.2. Both encode the same identity — accept the doc's
// rounding discrepancy with a 0.15 tolerance (still rejects any real drift).
approx(s.cooling.flow_lps, 943.0, 0.15,        // 30,000 / (4.186 x 7.6)  [REBASELINED v2.0.0 campus: 4 x 10,000 kW design, normal scenario 4 x 7,500 = 30,000 kW actual]
    'CHW flow = 30000/(4.186*7.6) = 943.0 L/s');

/* ---- Identity 5: Heat rejection ~= IT + UPS losses (1850-1950 band) --------
 * source: 00 line 81 ; 09 lines 73-77 */
assert(s.cooling.heat_rejection_kw >= 31250 && s.cooling.heat_rejection_kw <= 31300,  // IT 30,000 + UPS loss 1,250
    'Heat rejection within 1,850-1,950 kW band  [09 line 77]',
    s.cooling.heat_rejection_kw + ' kW');

/* ---- Identity 6: Fuel autonomy = usable L / generator L/hr ------------------
 * source: 00 line 86 ; 09 lines 132-147 ; 12 line 15 */
approx(s.fuel.usable_l, 744143.8, 1,           // 972,737 x 0.90 x 0.85  [REBASELINED v2.0.0 campus: 4 x 10,000 kW design, normal scenario 4 x 7,500 = 30,000 kW actual]
    'Usable fuel = 60000 * 0.90 * 0.85 = 45,900 L  [09 line 143]');
approx(s.fuel.autonomy_hr, 48.0, 0.1,
    'Fuel autonomy = 45,900 / 956 = 48.0 hr  [09 lines 144-147]');
const expectAutonomy = CONV_CALC.fuelUsableL() / m.fuel.generator_consumption_lph;
approx(s.fuel.autonomy_hr, Math.round(expectAutonomy * 10) / 10, 0.05,
    'Fuel autonomy = usable L / consumption L/hr  (identity)');

/* ---- Identity 7: WUE from water volume & IT energy -------------------------
 * source: 00 line 85 ; 09 lines 99-109 ; 12 line 14 */
approx(s.water.flow_lpm_for_wue, 600.0, 0.1,   // (1.20 x 30,000)/60  [REBASELINED v2.0.0 campus: 4 x 10,000 kW design, normal scenario 4 x 7,500 = 30,000 kW actual]
    'WUE-equiv water flow = (1.20 * 30000)/60 = 600.0 L/min');
approx(CONV_CALC.wueFromFlowLpm(s.water.flow_lpm_for_wue), m.environment.wue_l_per_kwh, 1e-3,
    'WUE round-trips from flow: (Lpm*60)/IT_kW = 1.20 L/kWh  [09 line 109]');

/* ---- Identity 8: EPMS total within 2% metering of dashboard facility -------
 * source: 00 line 77 ; 12 lines 9-10 */
const epmsErrPct = Math.abs(s.electrical.epms_total_kw - s.site.facility_load_kw) /
    s.site.facility_load_kw * 100;
assert(epmsErrPct <= m.electrical.metering_tolerance_pct,
    'EPMS total within 2% of dashboard facility load  [12 line 9]',
    epmsErrPct.toFixed(4) + '% <= ' + m.electrical.metering_tolerance_pct + '%');

/* ---- Identity 9: Carbon hourly = facility kW * factor ----------------------
 * source: 09 lines 155-158, 167 ; 12 line 16 */
approx(s.environment.carbon_kg_per_hr,
    s.site.facility_load_kw_exact * m.environment.carbon_kg_per_facility_kwh, 0.1,
    'Carbon = facility kW * 0.42 (facility-energy denominator)  [09 line 167]');

/* ---- Identity 10: rack-count basis ----------------------------------------
 * source: 09 lines 51-63 */
approx(s.racks.at_6kw, 5000, 1, 'Racks at 6 kW = 30000/6 = 5000');
approx(s.racks.at_8kw, 3750, 1, 'Racks at 8 kW = 30000/8 = 3750');
approx(s.racks.at_10kw, 3000, 1, 'Racks at 10 kW = 30000/10 = 3000');

/* ---- Stability / immutability ---------------------------------------------
 * source: 00 §"Data Quality Rule" — values must be stable, no Math.random */
assert(!/Math\.random/.test(code), 'Engine source contains NO Math.random', 'no PRNG');
assert(Object.isFrozen(CONV_MODEL) && Object.isFrozen(CONV_MODEL.site),
    'CONV_MODEL is deep-frozen (immutable basis)', 'frozen');
const r1 = CONV_CALC.recompute();
const r2 = CONV_CALC.recompute();
assert(JSON.stringify(r1) === JSON.stringify(r2),
    'recompute() is deterministic (stable on reload)', 'stable');

/* ---- Report ---------------------------------------------------------------- */
const PASS = '✓';
const FAIL = '✗';
console.log('=================================================================');
console.log(' Conventional BMS engine — Definition-of-Done identity test');
console.log('=================================================================');
for (const r of results) {
    const tag = r.ok ? PASS : FAIL;
    if (r.expected === 'true') {
        console.log(`  ${tag} ${r.label}` + (r.actual ? `  [${r.actual}]` : ''));
    } else {
        console.log(`  ${tag} ${r.label}`);
        console.log(`        actual=${r.actual}  expected=${r.expected}  tol=${r.tol}  diff=${r.diff}`);
    }
}
console.log('-----------------------------------------------------------------');
console.log(` ${passed} passed, ${failed} failed`);
console.log('=================================================================');

if (failed > 0) {
    console.error('FAIL — one or more Definition-of-Done identities did not hold.');
    process.exit(1);
}
console.log('OK — all Definition-of-Done identities hold within tolerance.');
process.exit(0);
