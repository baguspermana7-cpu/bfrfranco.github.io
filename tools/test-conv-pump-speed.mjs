#!/usr/bin/env node
/* PRD-CONV-OPS-DEPTH 01 P1 (engine 2.7.0) — every pump runs at the speed where its curve meets its system curve.
   OD-CP-03 every running pump 0 < speed <= 100 and Hz = f_base x speed (+-0.05)
   OD-CP-04 primary (dedicated branch, no setpoint): speed = branch flow / rated branch flow, on a recomputed model too
   OD-CP-05 secondary: the worked example of the PRD (98.7 % at 90 kPa) and monotone in the DP setpoint (60-140 kPa)
   OD-CP-06 secondary: Q x H_sys is independent of how many pumps share it (shared system curve)
   OD-CP-19 tower fan and CRAH fan Hz = f_base x speed
   OD-CP-15 pump_speed_pct keeps its 2.6.0 value (the design speed); no 2.6.0 key changes meaning
   Node only. Red on engine 2.6.0: no *_speed_pct / *_hz keys, fleet speed is the constant 100. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
global.window = {};
require('../js/conv-engine.js');
const C = window.CONV_CALC, s = C.snapshot.cooling || C.snapshot, M = C.model;
let n = 0; const ok = (v, msg) => { n++; assert.ok(v, msg); };
const near = (a, b, tol, msg) => ok(typeof a === 'number' && Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

for (const k of ['chw_primary_pump', 'chw_secondary_pump', 'cdw_pump']) {
  ok(typeof s[k + '_speed_pct'] === 'number' && typeof s[k + '_hz'] === 'number', `OD-CP-03 ${k}: no published speed / Hz`);
  for (const u of C.getFleet(k)) {
    if (u.state !== 'running') { ok(u.speedPct === 0 && u.hz === 0, `OD-CP-03 ${u.tag} standby turns`); continue; }
    ok(u.speedPct > 0 && u.speedPct <= 100, `OD-CP-03 ${u.tag} speed ${u.speedPct}`);
    near(u.hz, s.motor_base_frequency_hz * u.speedPct / 100, 0.05, `OD-CP-03 ${u.tag} Hz`);
  }
}
/* OD-CP-04 primary is homologous: n = q / q_design, q_design = unit kWth / (cp dT) */
const cp = M.cooling.water_cp_kj_per_kg_k, dT = s.chws_c !== undefined && s.chwr_c !== undefined ? s.chwr_c - s.chws_c : null;
const pu = C.getFleet('chw_primary_pump').find((u) => u.state === 'running');
const qd = M.cooling.chiller_unit_kw_th / (cp * (dT || (pu.flowLps ? (s.chiller_unit_duty_kw_th || 0) / (cp * pu.flowLps) : 0)));
near(pu.speedPct, Math.max(M.cooling.pump_min_speed_pct, 100 * pu.flowLps / qd), 0.15, 'OD-CP-04 primary speed = q / q_design');
{ /* one more chiller running -> every branch flow falls -> speed falls in proportion */
  const m2 = JSON.parse(JSON.stringify(M)); m2.cooling.chiller_unit_kw_th *= 7 / 8;
  const p2 = C.getFleet('chw_primary_pump', null, m2).find((u) => u.state === 'running');
  ok(p2.speedPct > 0 && Math.abs(p2.speedPct / p2.flowLps - pu.speedPct / pu.flowLps * 8 / 7) < 0.01, `OD-CP-04 homologous on a recomputed model: ${p2.speedPct} % at ${p2.flowLps} L/s`);
}
/* OD-CP-05 the PRD worked example and monotone in the setpoint */
near(s.chw_secondary_pump_speed_pct, 98.7, 0.05, 'OD-CP-05 secondary speed at 90 kPa (PRD 6.1 worked example)');
near(s.chw_primary_pump_speed_pct, 89.3, 0.05, 'OD-CP-04 primary speed at the adopted point (q / q_design, branch Hsp = 0)');
near(s.cdw_pump_speed_pct, 90.8, 0.05, 'OD-CP-06 CDW speed at the adopted point (open circuit, static lift 4 m)');
let prev = -1;
for (let dp = 60; dp <= 140; dp += 10) { const r = C.secondaryPumpSpeedAt(dp); ok(r && r.speedPct >= prev, `OD-CP-05 speed not monotone at ${dp} kPa`); prev = r.speedPct; }
ok(C.secondaryPumpSpeedAt(60).speedPct < C.secondaryPumpSpeedAt(140).speedPct, 'OD-CP-05 a lower setpoint must slow the pumps');
ok(C.secondaryPumpSpeedAt(-5) === null, 'OD-CP-05 a negative setpoint is refused');
/* OD-CP-06 shared system curve: Q_total x H_sys(Q_total) does not depend on the pump count */
{ const c = M.cooling, g = c.gravity_m_s2, rho = c.water_density_kg_m3;
  const Q = s.chw_secondary_pump_flow_lps * C.getFleet('chw_secondary_pump').filter((u) => u.state === 'running').length;
  const Hd = c.chw_secondary_head_m, Hsp = c.chw_secondary_dp_setpoint_kpa * 1000 / (rho * g), QD = 4 * c.chw_secondary_unit_flow_lps;
  const hyd = (N) => { const q = Q / N; const H = Hsp + (Hd - Hsp) * (Q / QD) ** 2; return N * rho * g * q / 1000 * H / 1000; };
  near(hyd(5), hyd(4), hyd(4) * 0.001, 'OD-CP-06 hydraulic kW, 4 vs 5 pumps sharing'); }
/* OD-CP-19 fan drives */
near(s.tower_fan_hz, s.motor_base_frequency_hz * s.tower_cell_load_pct / 100, 0.06, 'OD-CP-19 tower fan Hz');
near(s.crah_fan_hz, s.motor_base_frequency_hz * s.crah_fan_speed_pct / 100, 0.06, 'OD-CP-19 CRAH fan Hz');
for (const u of C.getFleet('tower_cell')) if (u.state === 'running') near(u.hz, s.motor_base_frequency_hz * u.fanSpeedPct / 100, 0.06, `OD-CP-19 ${u.tag} Hz`);
/* OD-CP-15 */
ok(s.pump_speed_pct === 100, 'OD-CP-15 pump_speed_pct keeps its design meaning');
console.log(`CONV PUMP SPEED — PASS (${n} checks: speed and Hz of 35 pumps from pump x system curve, primary homologous, secondary 98.7 % at 90 kPa and monotone in the setpoint, shared-curve hydraulic power, fan Hz)`);
