#!/usr/bin/env node
/* PRD-CONV-OPS-DEPTH 01 §12 Amendment E1 (engine 2.10.0) — pump power at the operating head.
   E1a raising the secondary DP setpoint raises secondary fleet kWe, lowering it lowers it (70 < 90 < 110 kPa)
   E1b at design flow (x_s = 1) H_sys = H_d, so power equals the 2.9.0 design-head figure within 0.5 %
   E1c fleet hydraulic power Q x H_sys is independent of how many duty pumps share one system curve
   E1d site.pue is a model input: no pump change moves it
   E1e every published pump kWe = rho g q H_op / (eta_p eta_m eta_v), with H_op the published *_head_op_m,
       and H_op = H_sp + (H_d - H_sp) x_s^2 of the same loop (primary H_sp = 0, CDW H_sp = static lift)
   E1f hydraulic and shaft kW of each pump use the same operating head as its kWe
   E1g the setpoint what-if publishes the operating head and kWe the full solve gives at that setpoint
   Node only. Red on engine 2.9.0: kWe 98 at all three setpoints, no *_head_op_m keys. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
global.window = {};
require('../js/conv-engine.js');
const C = window.CONV_CALC, M = C.model;
const cool = (snap) => snap.cooling || snap;
const s = cool(C.snapshot);
let n = 0, fails = 0;
const ok = (v, msg) => { n++; if (!v) { fails++; console.log('FAIL ' + msg); } };
const near = (a, b, tol, msg) => ok(typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const clone = () => JSON.parse(JSON.stringify(M));
const at = (mut) => { const m = clone(); mut(m.cooling, m); return cool(C.recompute(m)); };
const c = M.cooling, rhoG = c.water_density_kg_m3 * c.gravity_m_s2;
const eta = c.pump_efficiency * c.pump_motor_efficiency * c.pump_vfd_efficiency;
const kwe = (qLps, hM) => rhoG * (qLps / 1000) * hM / 1000 / eta;

/* E1a */
const f = [70, 90, 110].map((dp) => at((cc) => { cc.chw_secondary_dp_setpoint_kpa = dp; }));
ok(f[0].chw_secondary_fleet_kw_e < f[1].chw_secondary_fleet_kw_e && f[1].chw_secondary_fleet_kw_e < f[2].chw_secondary_fleet_kw_e,
  `E1a secondary fleet kWe rises with the DP setpoint: ${f.map((x) => x.chw_secondary_fleet_kw_e).join(' / ')}`);
ok(f[0].pump_fleet_input_kw < f[2].pump_fleet_input_kw, `E1a pump fleet input follows: ${f[0].pump_fleet_input_kw} < ${f[2].pump_fleet_input_kw}`);

/* E1e on the adopted point, all three loops */
const loops = [
  ['chw_primary_pump', 'chw_primary_head_m', 0],
  ['chw_secondary_pump', 'chw_secondary_head_m', c.chw_secondary_dp_setpoint_kpa * 1000 / rhoG],
  ['cdw_pump', 'cdw_head_m', c.cdw_static_head_m]
];
for (const [k, hd, hsp] of loops) {
  const hop = s[k + '_head_op_m'];
  ok(typeof hop === 'number' && hop > hsp && hop <= c[hd] + 1e-9, `E1e ${k}_head_op_m published and between H_sp ${hsp.toFixed(2)} and H_d ${c[hd]}: ${hop}`);
  near(s[k + '_kw_e'], kwe(s[k + '_flow_lps'], hop), 0.15, `E1e ${k} kWe = rho g q H_op / eta`);
  near(s[k + '_hydraulic_kw'], rhoG * s[k + '_flow_lps'] / 1000 * hop / 1000, 0.02, `E1f ${k} hydraulic kW at H_op`);
  near(s[k + '_shaft_kw'], s[k + '_hydraulic_kw'] / c.pump_efficiency, 0.02, `E1f ${k} shaft kW = hydraulic / eta_p`);
}
/* primary: dedicated branch, H_sp = 0, x_s = x_p = speed (homologous) */
near(s.chw_primary_pump_head_op_m, c.chw_primary_head_m * Math.pow(s.chw_primary_pump_speed_pct / 100, 2), 0.05, 'E1e primary H_op = H_d n^2');

/* E1b design flow: rate each secondary pump at exactly its share of today's duty flow, so x_s = 1 (the IT load is
   derived from the halls, so the flow is moved by the rating, not by the load) */
{
  const sec = s.chw_secondary_pumps_running, q = s.chw_secondary_pump_flow_lps;
  const d = at((cc) => { cc.chw_secondary_unit_flow_lps = q + 0.05; /* published flow is rounded to 0.1 L/s */ });
  if (d.chw_secondary_pumps_running === sec && Math.abs(d.chw_secondary_pump_flow_lps - q) < 0.2) {
    near(d.chw_secondary_pump_head_op_m, c.chw_secondary_head_m, 0.05, 'E1b H_sys = H_d at x_s = 1');
    const old = kwe(d.chw_secondary_pump_flow_lps, c.chw_secondary_head_m);
    ok(Math.abs(d.chw_secondary_pump_kw_e - old) / old <= 0.005, `E1b design point kWe ${d.chw_secondary_pump_kw_e} = 2.9.0 figure ${old.toFixed(1)} (±0.5 %)`);
  } else ok(false, `E1b could not place the plant at design flow: ${d.chw_secondary_pumps_running} pumps at ${d.chw_secondary_pump_flow_lps} L/s`);
}

/* E1c one system curve, N duty pumps: fleet hydraulic = Q_total x H_sys(Q_total) for any N */
{
  const hd = c.chw_secondary_head_m, hsp = c.chw_secondary_dp_setpoint_kpa * 1000 / rhoG, QD = 4 * c.chw_secondary_unit_flow_lps, Q = 0.9 * QD;
  const hsys = C.pumpOperatingHeadM ? C.pumpOperatingHeadM(hd, hsp, Q / QD) : null;
  const fleet = [2, 3, 4, 5].map((N) => N * rhoG * (Q / N) / 1000 * hsys / 1000);
  ok(typeof hsys === 'number' && fleet.every((x) => Math.abs(x - fleet[0]) < 1e-9), `E1c fleet hydraulic independent of N: ${fleet.map((x) => x.toFixed(2)).join(' / ')}`);
}

/* E1g the setpoint what-if (secondaryPumpSpeedAt) gives the same kWe as a full solve at that setpoint */
for (const [i, dp] of [[0, 70], [2, 110]]) {
  const w = C.secondaryPumpSpeedAt(dp);
  ok(w && typeof w.fleetKwE === 'number', `E1g what-if publishes fleet kWe at ${dp} kPa`);
  near(w && w.fleetKwE, f[i].chw_secondary_fleet_kw_e, 0.15, `E1g what-if fleet kWe = solve at ${dp} kPa`);
  near(w && w.headOpM, f[i].chw_secondary_pump_head_op_m, 0.01, `E1g what-if H_op = solve at ${dp} kPa`);
}

/* E1d site.pue is an input */
{
  const pue = (snap) => (snap.site && snap.site.pue) ?? (snap.pue);
  const base = C.recompute(clone());
  const lo = C.recompute((() => { const m = clone(); m.cooling.chw_secondary_dp_setpoint_kpa = 70; m.cooling.cdw_static_head_m = 2; return m; })());
  ok(pue(base) !== undefined && pue(base) === pue(lo) && pue(base) === M.site.pue, `E1d site.pue unchanged by pump inputs: ${pue(base)} / ${pue(lo)} / input ${M.site.pue}`);
}

console.log(`${fails ? 'FAIL' : 'PASS'} — conv pump affinity E1: ${n - fails}/${n}`);
process.exit(fails ? 1 : 0);
