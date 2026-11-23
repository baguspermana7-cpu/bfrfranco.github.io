#!/usr/bin/env node
/* PRD-DCAI-HALL-DEPTH Amendment 1 §6 / phase A3 (owner 2026-11-23 "banyak parameter ... ops parameter"): the operating
 * point of ONE running fan-wall module and ONE running CDU, published by the engine so the floor never computes a value.
 *
 * Laws:
 *   U1 airflow: crah_rated_airflow_m3h = unit kWth / (rho cp dT_air) x 3600; crah_airflow_unit_m3h x duty = the hall's
 *      air heat over the same rho cp dT (the airflow the fan-wall face is sized on), within 0.1 %.
 *   U2 fan speed (fan law, flow proportional to speed): crah_fan_speed_pct = unit airflow / rated airflow x 100, in
 *      (0, 100]; it follows its inputs (a larger module rating lowers it by the ratio of the duty loads).
 *   U3 CDU: cdu_load_pct = per-unit kWth / unit kWth x 100 in (0, 100]; cdu_rated_flow_lpm = unit kWth x the
 *      published L/min per kW; cdu_pump_speed_pct = per-unit TCS L/min / rated L/min x 100 in (0, 100].
 *   U4 standby carries nothing: crah_standby_per_hall = installed - duty, cdu_standby_per_hall = installed - duty,
 *      and both > 0 (N+1, equipment.*.redundantUnits); every new key is in data/dcai-parameters.json with a curated label and
 *      unit, DERIVED (standby: ADOPTED, it is the authored N+1 count).
 *
 * Red: on engine 1.6.0 every new key is missing. Run: node tools/test-dcai-unit-ops.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_SRC = readFileSync(join(ROOT, 'js', 'dcai-model.js'), 'utf8');
const ENGINE_SRC = readFileSync(join(ROOT, 'js', 'dcai-engine.js'), 'utf8');
function thaw(v) {
  if (Array.isArray(v)) return v.map(thaw);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = thaw(v[k]); return o; }
  return v;
}
function load(patch) {
  const box = { module: { exports: {} }, console }; box.globalThis = box; vm.createContext(box);
  new vm.Script(MODEL_SRC, { filename: 'dcai-model.js' }).runInContext(box);
  const model = patch ? patch(thaw(box.DCAI_MODEL)) : box.DCAI_MODEL;
  const eb = { module: { exports: {} }, console, DCAI_MODEL: model }; eb.globalThis = eb; vm.createContext(eb);
  new vm.Script(ENGINE_SRC, { filename: 'dcai-engine.js' }).runInContext(eb);
  return { M: eb.DCAI_MODEL, S: eb.DCAI_CALC.snapshot };
}

let pass = 0; const fails = [];
const ok = (law, c, msg) => { if (c) pass++; else fails.push(law + ' ' + msg); };
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const near = (a, b, rel) => num(a) && num(b) && Math.abs(a - b) <= Math.abs(b) * rel;

const { M, S } = load();
const E = S.equipment, P = S.design.planes, H = S.heat;
const geoM = M.geometry, rhoCp = geoM.airDensityKgM3 * geoM.airCpKjKgK, dT = P.p11_air_return_c - P.p09_air_supply_c;

/* U1 */
const rated = M.equipment.crah.unitKwTh / (rhoCp * dT) * 3600;
ok('U1', near(E.crah_rated_airflow_m3h, rated, 1e-6), `crah_rated_airflow_m3h ${E.crah_rated_airflow_m3h} vs ${rated.toFixed(1)}`);
const hallAir = H.air_hall_kwth / (rhoCp * dT) * 3600;
ok('U1', num(E.crah_airflow_unit_m3h) && near(E.crah_airflow_unit_m3h * E.crah_duty_per_hall, hallAir, 1e-3),
  `unit airflow ${E.crah_airflow_unit_m3h} x ${E.crah_duty_per_hall} duty vs hall ${hallAir.toFixed(0)} m3/h`);

/* U2 */
const fan = E.crah_fan_speed_pct;
ok('U2', num(fan) && fan > 0 && fan <= 100 + 1e-9, `crah_fan_speed_pct ${fan} in (0, 100]`);
ok('U2', near(fan, E.crah_airflow_unit_m3h / E.crah_rated_airflow_m3h * 100, 1e-9), `fan % = unit / rated airflow (${fan})`);
const big = load((m) => { m.equipment.crah.unitKwTh = 250; return m; }).S.equipment;
const wantBig = (H.air_hall_kwth / big.crah_duty_per_hall) / 250 * 100;
ok('U2', near(big.crah_fan_speed_pct, wantBig, 1e-6) && Math.abs(big.crah_fan_speed_pct - fan) > 0.5,
  `fan % follows the module rating: 200 kW ${fan}, 250 kW ${big.crah_fan_speed_pct} (want ${wantBig.toFixed(2)})`);

/* U3 */
ok('U3', near(E.cdu_load_pct, E.cdu_duty_per_unit_kwth / M.equipment.cdu.unitKwTh * 100, 1e-9) && E.cdu_load_pct > 0 && E.cdu_load_pct <= 100 + 1e-9,
  `cdu_load_pct ${E.cdu_load_pct}`);
const rl = M.equipment.cdu.unitKwTh * M.equipment.cdu.publishedLpmPerKw;
ok('U3', near(E.cdu_rated_flow_lpm, rl, 1e-9), `cdu_rated_flow_lpm ${E.cdu_rated_flow_lpm} vs ${rl}`);
ok('U3', near(E.cdu_pump_speed_pct, E.cdu_flow_per_unit_lpm / rl * 100, 1e-9) && E.cdu_pump_speed_pct > 0 && E.cdu_pump_speed_pct <= 100 + 1e-9,
  `cdu_pump_speed_pct ${E.cdu_pump_speed_pct} (flow ${E.cdu_flow_per_unit_lpm} of ${rl} L/min)`);

/* U4 */
ok('U4', E.crah_standby_per_hall === E.crah_installed_per_hall - E.crah_duty_per_hall && E.crah_standby_per_hall > 0, `crah_standby_per_hall ${E.crah_standby_per_hall}`);
ok('U4', E.cdu_standby_per_hall === E.cdu_installed_per_hall - E.cdu_duty_per_hall && E.cdu_standby_per_hall > 0, `cdu_standby_per_hall ${E.cdu_standby_per_hall}`);
const reg = JSON.parse(readFileSync(join(ROOT, 'data', 'dcai-parameters.json'), 'utf8'));
const byId = new Map(reg.parameters.map((p) => [p.id, p]));
for (const k of ['crah_rated_airflow_m3h', 'crah_airflow_unit_m3h', 'crah_fan_speed_pct', 'crah_standby_per_hall', 'cdu_load_pct', 'cdu_rated_flow_lpm', 'cdu_pump_speed_pct', 'cdu_standby_per_hall']) {
  const r = byId.get('equipment.' + k);
  const want = /standby/.test(k) ? 'ADOPTED' : 'DERIVED';   /* standby = the authored N+1 count itself */
  ok('U4', !!r && r.evidenceClass === want && !!r.unit && !!r.label && r.label !== k.replace(/_/g, ' '), `equipment.${k} registered ${want} with a curated label and unit (${r ? r.evidenceClass + ' / ' + r.unit + ' / ' + r.label : 'absent'})`);
}

if (fails.length) {
  console.log('FAIL DC AI unit operating point — ' + fails.length + ' of ' + (pass + fails.length));
  for (const f of fails) console.log('  ' + f);
  process.exit(1);
}
console.log(`PASS DC AI unit operating point — ${pass} checks (engine ${S.meta.version}: fan-wall ${E.crah_fan_speed_pct.toFixed(1)} % at ` +
  `${Math.round(E.crah_airflow_unit_m3h)} of ${Math.round(E.crah_rated_airflow_m3h)} m3/h; CDU ${E.cdu_load_pct.toFixed(1)} % load, pump ${E.cdu_pump_speed_pct.toFixed(1)} %)`);
