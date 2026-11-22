#!/usr/bin/env node
/* test-conv-chiller-cycle.mjs — PRD-CONV-EQUIPMENT-INSIDE §5.2 / §8 laws CY1–CY5 on js/conv-engine.js 2.5.0 (node, no browser).
   CY1 property data: the NIST rows the engine carries agree with a SECOND source — the ASHRAE-rounded saturation table
       already in the engine (R134A_SAT_TABLE) within 0.5 % in pressure, and the ASHRAE Fundamentals anchors at 0 °C and
       40 °C (hf 200.00 / hg 398.60, hf 256.41 / hg 419.43 kJ/kg, IIR reference) within 0.3 kJ/kg; the Antoine fit the
       pages print agrees with the NIST rows within 0.5 % over 0 … 50 °C; the R134A-PROPS block is a fresh build.
   CY2 energy: Q_evap + shaft = the cycle's condenser duty within 0.5 %; the engine condenser duty minus the cycle's =
       compressor input minus shaft (drive losses) within 1 kW; sum over running units = plant chiller input.
   CY3 the cycle is physical: eta_is (rating fit) in 0.65–0.88; T_discharge > T_cond,sat; 0 < x_f < 0.2;
       P_evap < P_int < P_cond; h6 = h5, h8 = h7; operating specific power below the rating figure (smaller lift).
   CY4 an independent solver (tools/lib/r134a-cycle-check.mjs, raw NIST files, its own bisection) reproduces eta,
       specific power (1 %) and discharge temperature (0.5 K).
   CY5 the binding is real: CDW supply +3 K raises P_cond, discharge temperature and specific power and lowers COP;
       CHWS −3 K raises the lift and the specific power. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import * as X from './lib/r134a-cycle-check.mjs';

const require = createRequire(import.meta.url);
const { CONV_MODEL, CONV_CALC } = require('../js/conv-engine.js');
const snap = CONV_CALC.snapshot, c = snap.cooling, M = CONV_MODEL.cooling;
const P = c.chiller_cycle_points;
const clone = (o) => JSON.parse(JSON.stringify(o));

test('CY0 engine publishes the cycle (>= 2.5.0)', () => {
  const [maj, min] = String(snap.meta.version).split('.').map(Number);
  assert.ok(maj > 2 || (maj === 2 && min >= 5), 'engine ' + snap.meta.version);
  assert.ok(Array.isArray(P) && P.length === 8, 'eight state points');
});

test('CY1 property rows vs a second source; Antoine vs NIST; block fresh', () => {
  const sat = CONV_CALC.r134a.sat;
  for (const r of CONV_CALC.r134aSatTable) {
    const p = sat('T', r.t_c, 'P');
    assert.ok(Math.abs(p - r.p_bar_abs * 100) / (r.p_bar_abs * 100) < 0.005, `P at ${r.t_c} C: NIST ${p} vs table ${r.p_bar_abs * 100}`);
  }
  for (const [t, hf, hg] of [[0, 200.00, 398.60], [40, 256.41, 419.43]]) {
    assert.ok(Math.abs(sat('T', t, 'hf') - hf) < 0.3, `hf at ${t} C`); assert.ok(Math.abs(sat('T', t, 'hg') - hg) < 0.3, `hg at ${t} C`);
  }
  for (let t = 0; t <= 50; t += 5) {
    const a = CONV_CALC.refrigerantSatKpa('R-134a', t), n = sat('T', t, 'P');
    assert.ok(Math.abs(a - n) / n < 0.005, `Antoine ${a.toFixed(1)} vs NIST ${n.toFixed(1)} at ${t} C`);
  }
  execFileSync('node', ['tools/build-conv-r134a.mjs', '--check'], { stdio: 'pipe' });
});

test('CY2 energy closes', () => {
  const ud = c.chiller_unit_duty_kw_th, sh = c.chiller_unit_shaft_kw, cyc = c.chiller_cycle_condenser_kw_th;
  assert.ok(Math.abs(ud + sh - cyc) / cyc < 0.005, `Q_evap ${ud} + shaft ${sh} vs cycle condenser ${cyc}`);
  const input = c.chiller_input_per_machine_kw_e;
  assert.ok(Math.abs((c.chiller_unit_condenser_duty_kw_th - cyc) - (input - sh)) <= 1, `engine condenser − cycle = ${(c.chiller_unit_condenser_duty_kw_th - cyc).toFixed(1)} vs drive losses ${(input - sh).toFixed(1)}`);
  const run = CONV_CALC.getFleet('chiller').filter((u) => u.state === 'running');
  const sum = run.reduce((a, u) => a + u.inputKwE, 0);
  assert.ok(Math.abs(sum - c.chiller_input_kw_e) / c.chiller_input_kw_e < 0.001, `sum ${sum} vs plant ${c.chiller_input_kw_e}`);
});

test('CY3 the cycle is physical', () => {
  assert.ok(c.chiller_eta_is >= 0.65 && c.chiller_eta_is <= 0.88, 'eta_is ' + c.chiller_eta_is);
  assert.ok(c.chiller_discharge_c > c.chiller_cond_sat_c, 'discharge above condensing');
  assert.ok(c.chiller_flash_fraction > 0 && c.chiller_flash_fraction < 0.2, 'flash ' + c.chiller_flash_fraction);
  assert.ok(P[0].p_kpa_abs < c.chiller_int_sat_kpa_abs && c.chiller_int_sat_kpa_abs < P[3].p_kpa_abs, 'pressure order');
  assert.equal(P[5].h_kj_kg, P[4].h_kj_kg, 'h6 = h5 (isenthalpic)'); assert.equal(P[7].h_kj_kg, P[6].h_kj_kg, 'h8 = h7');
  assert.equal(P[0].phase, 'vapour'); assert.equal(P[4].phase, 'liquid'); assert.equal(P[7].phase, 'two-phase');
  assert.ok(c.chiller_specific_power_kw_e_per_kw_th < c.chiller_rated_specific_power_kw_e_per_kw_th, 'smaller lift, less power');
  assert.ok(c.chiller_lift_k < c.chiller_rating_lift_k, 'plant lift below rating lift');
  /* economiser and refrigerant flows: T_int is the saturation of P_int; m_c = m_e / (1 - x_f) */
  assert.ok(Math.abs(CONV_CALC.r134a.sat('P', c.chiller_int_sat_kpa_abs, 'T') - c.chiller_int_sat_c) < 0.02, 'T_int = Tsat(P_int)');
  assert.ok(c.chiller_evap_sat_c < c.chiller_int_sat_c && c.chiller_int_sat_c < c.chiller_cond_sat_c, 'T_int between the saturations');
  const mc = c.chiller_unit_ref_flow_evap_kg_s / (1 - c.chiller_flash_fraction);
  assert.ok(Math.abs(mc - c.chiller_unit_ref_flow_cond_kg_s) <= 0.02, `m_c ${c.chiller_unit_ref_flow_cond_kg_s} vs m_e/(1-x_f) ${mc.toFixed(2)}`);
  /* drive: speed = max(min speed, sqrt(lift / rating lift), load), IGV = load / speed */
  const load = c.chiller_part_load_pct / 100, sp = Math.min(1, Math.max(M.chiller_min_speed_pct / 100, Math.sqrt(c.chiller_lift_k / c.chiller_rating_lift_k), load));
  assert.ok(Math.abs(c.chiller_speed_pct - sp * 100) <= 0.1, `speed ${c.chiller_speed_pct} vs ${(sp * 100).toFixed(1)}`);
  assert.ok(Math.abs(c.chiller_igv_pct - Math.min(100, Math.max(20, load / sp * 100))) <= 0.1, 'IGV = load / speed');
});

test('CY4 an independent solver agrees', () => {
  const de = M.chiller_motor_efficiency * M.chiller_vfd_efficiency;
  const eta = X.solveEta(c.chiller_rating_evap_sat_c, c.chiller_rating_cond_sat_c, M.chiller_rated_specific_power_kw_e_per_kw_th * de, M.chiller_superheat_k, M.chiller_subcool_k);
  assert.ok(Math.abs(eta - c.chiller_eta_is) < 0.01, `eta ${eta.toFixed(3)} vs engine ${c.chiller_eta_is}`);
  const r = X.cycle({ Te: c.chiller_evap_sat_c, Tc: c.chiller_cond_sat_c, eta, sh: M.chiller_superheat_k, sc: M.chiller_subcool_k });
  const sp = r.w / de;
  assert.ok(Math.abs(sp - c.chiller_specific_power_kw_e_per_kw_th) / sp < 0.01, `sp ${sp.toFixed(5)} vs engine ${c.chiller_specific_power_kw_e_per_kw_th}`);
  assert.ok(Math.abs(r.Td - c.chiller_discharge_c) < 0.5, `Td ${r.Td.toFixed(2)} vs engine ${c.chiller_discharge_c}`);
});

test('CY5 perturbations move the cycle the physical way', () => {
  const m1 = clone(CONV_MODEL); m1.cooling.cdw_supply_c += 3;
  const a = CONV_CALC.recompute(m1).cooling;
  assert.ok(a.chiller_cond_sat_kpa_abs > c.chiller_cond_sat_kpa_abs, 'P_cond up');
  assert.ok(a.chiller_discharge_c > c.chiller_discharge_c, 'discharge up');
  assert.ok(a.chiller_specific_power_kw_e_per_kw_th > c.chiller_specific_power_kw_e_per_kw_th && a.plant_cop < c.plant_cop, 'power up, COP down');
  const m2 = clone(CONV_MODEL); m2.cooling.chw_coil_approach_k += 3;   /* CHWS 3 K colder */
  const b = CONV_CALC.recompute(m2).cooling;
  assert.ok(b.chiller_lift_k > c.chiller_lift_k && b.chiller_specific_power_kw_e_per_kw_th > c.chiller_specific_power_kw_e_per_kw_th, 'colder CHWS, more lift, more power');
});
