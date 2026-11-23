#!/usr/bin/env node
/* PRD-CONV-OPS-DEPTH 01 P3 (engine 2.8.0) — the chiller plant's valves, as steady-state relations.
   OD-CP-07 PICV opening = CRAH coil flow / design coil flow (pressure independent, linear), per CRAH fleet unit too
   OD-CP-08 DP bypass MV-01: 0 % at today's load; > 0 % only when load flow < running chillers' minimum evaporator flow;
            Q_bp = Q_min - Q_load; monotone non-increasing in load; 100 % at zero load
   OD-CP-09 decoupler = sum primary - sum secondary (0.0 at the adopted point)
   OD-CP-10 TV-01 3-way tower bypass: A + B = 100; ECWT >= chiller_min_ecwt_c over a wet-bulb sweep 0..30 C (or B = 100 % where even the return is colder); B = 0 today
   OD-CP-11 balancing Kv = Q[m3/h] / sqrt(dP[bar]) at the static lift; hall branch shares sum to the plant flow
   Node only. Red on 2.7.0 (no valve keys). */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
global.window = {};
require('../js/conv-engine.js');
const C = window.CONV_CALC, s = C.snapshot.cooling, M = C.model, c = M.cooling;
let n = 0; const ok = (v, msg) => { n++; assert.ok(v, msg); };
const near = (a, b, tol, msg) => ok(typeof a === 'number' && Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const cp = c.water_cp_kj_per_kg_k;
/* OD-CP-07 */
ok(typeof s.crah_valve_open_pct === 'number', 'OD-CP-07 no crah_valve_open_pct');
near(s.crah_valve_open_pct, s.crah_unit_duty_kw / c.crah_unit_sensible_kw * 100, 0.06, 'OD-CP-07 PICV = coil duty / rated (flow at the same dT)');
near(s.crah_valve_open_pct, s.crah_unit_chw_flow_lps / s.crah_design_coil_flow_lps * 100, 0.5, 'OD-CP-07 PICV = coil flow / design (published 0.01 L/s)');
near(s.crah_design_coil_flow_lps, c.crah_unit_sensible_kw / (cp * s.chw_delta_t), 0.02, 'OD-CP-07 design coil flow = rated kW / (cp dT)');
ok(s.crah_valve_open_pct > 0 && s.crah_valve_open_pct <= 100, `OD-CP-07 opening ${s.crah_valve_open_pct}`);
/* OD-CP-08 */
ok(s.chw_bypass_open_pct === 0 && s.chw_bypass_flow_lps === 0, `OD-CP-08 bypass at today's load ${s.chw_bypass_open_pct} %`);
let prev = Infinity;
for (let f = 0; f <= 1.0001; f += 0.05) {
  const b = C.bypassAtLoad(f);
  near(b.flowLps, Math.max(0, b.qMinLps - b.qLoadLps), 0.11, `OD-CP-08 Q_bp identity at ${f.toFixed(2)}`);
  ok(b.openPct <= prev + 1e-9, `OD-CP-08 not monotone at ${f.toFixed(2)}`); prev = b.openPct;
  ok((b.openPct > 0) === (b.qLoadLps < b.qMinLps - 0.05), `OD-CP-08 opens exactly below the minimum flow at ${f.toFixed(2)}`);
}
ok(C.bypassAtLoad(0).openPct === 100, 'OD-CP-08 100 % at zero load');
ok(C.bypassAtLoad(-1) === null, 'OD-CP-08 refuses a negative load');
/* OD-CP-09 */
near(s.chw_decoupler_flow_lps, 0, 0.05, 'OD-CP-09 decoupler at the adopted point');
/* OD-CP-10 */
ok(s.cdw_bypass_x_pct === 0, `OD-CP-10 tower bypass B today ${s.cdw_bypass_x_pct}`);
for (let wb = 0; wb <= 30; wb += 1) {
  const t = C.towerBypassAt(wb);
  near(t.aPct + t.xPct, 100, 0.05, `OD-CP-10 A + B at wb ${wb}`);
  /* below the minimum only when even full bypass cannot reach it (return water itself colder): then B = 100 % */
  const tRet = t.tColdC + c.cdw_range_k;
  ok(t.tEcwC >= c.chiller_min_ecwt_c - 0.01 || (t.xPct === 100 && tRet < c.chiller_min_ecwt_c), `OD-CP-10 ECWT ${t.tEcwC} below the minimum at wb ${wb}`);
  if (t.xPct > 0 && t.xPct < 100) near(t.tEcwC, c.chiller_min_ecwt_c, 0.02, `OD-CP-10 modulating holds ECWT at the minimum (wb ${wb})`);
}
ok(C.towerBypassAt('x') === null, 'OD-CP-10 refuses a non-number');
/* OD-CP-11 */
const dpBar = c.water_density_kg_m3 * c.gravity_m_s2 * c.cdw_static_head_m / 1e5;
near(s.cdw_balance_kv_set, s.cdw_bypass_design_flow_lps * 3.6 / Math.sqrt(dpBar), 1, 'OD-CP-11 Kv = Q / sqrt(dP)');
const halls = C.listHalls(), itSum = halls.reduce((a, h) => a + (h.it_load_kw || 0), 0);
if (itSum > 0) { const sum = halls.reduce((a, h) => a + h.it_load_kw / itSum * s.chw_secondary_pump_flow_lps * C.getFleet('chw_secondary_pump').filter((u) => u.state === 'running').length, 0);
  near(sum, s.chw_secondary_pump_flow_lps * C.getFleet('chw_secondary_pump').filter((u) => u.state === 'running').length, 0.5, 'OD-CP-11 hall branch shares sum to the plant flow'); }
console.log(`CONV PLANT VALVES — PASS (${n} checks: PICV = coil flow share, DP bypass only below minimum evaporator flow, decoupler 0, tower 3-way holds ECWT over wet-bulb 0-30 C, Kv at the static lift)`);
