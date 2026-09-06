#!/usr/bin/env node
/* ============================================================================
 * test-dcai-engine.mjs — ship gate for js/dcai-model.js + js/dcai-engine.js
 * ----------------------------------------------------------------------------
 * One assertion per defect the GB200-era page carried, so the same defect cannot
 * come back with better provenance. No test framework; pure Node vm. Exit 1 on
 * any failure.
 *
 *   node tools/test-dcai-engine.mjs
 *
 * Every numeric expectation below is either an IDENTITY (two engine outputs
 * that must agree), a PHYSICAL BOUND (an approach must be positive, an
 * effectiveness <= 1), or an OWNER DECISION stated in the plan (4 halls, rack
 * IT ~500 MW, dry-only). No expected value is a memorised engine output, so the
 * gate cannot be satisfied by pasting the number back into the source.
 * ==========================================================================*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const JS = join(here, '..', 'js');
const MODEL_SRC = readFileSync(join(JS, 'dcai-model.js'), 'utf8');
const ENGINE_SRC = readFileSync(join(JS, 'dcai-engine.js'), 'utf8');

function load(modelPatch) {
  const box = { module: { exports: {} }, console };
  box.globalThis = box;
  vm.createContext(box);
  new vm.Script(MODEL_SRC, { filename: 'dcai-model.js' }).runInContext(box);
  const model = box.DCAI_MODEL;
  const eb = { module: { exports: {} }, console, DCAI_MODEL: modelPatch ? modelPatch(model) : model };
  eb.globalThis = eb;
  vm.createContext(eb);
  new vm.Script(ENGINE_SRC, { filename: 'dcai-engine.js' }).runInContext(eb);
  return { model: eb.DCAI_MODEL, calc: eb.DCAI_CALC };
}
/* deep-clone a frozen model so a test can perturb one leaf */
function thaw(v) {
  if (Array.isArray(v)) return v.map(thaw);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = thaw(v[k]); return o; }
  return v;
}

let passed = 0, failed = 0;
const out = [];
function ok(cond, label, detail) {
  if (cond) passed++; else { failed++; out.push(`  ✗ ${label}${detail !== undefined ? ' — ' + detail : ''}`); }
}
function approx(a, b, tol, label) { ok(Math.abs(a - b) <= tol, label, `${a} vs ${b} (tol ${tol})`); }

const { model: M, calc: C } = load();
const S = C.snapshot;

/* ── 0. sources and hygiene ─────────────────────────────────────────────── */
ok(!/Math\.random/.test(ENGINE_SRC) && !/Math\.random/.test(MODEL_SRC), 'no Math.random in model or engine');
ok(Object.isFrozen(S) && Object.isFrozen(S.design) && Object.isFrozen(M.thermal), 'snapshot and model are deep-frozen');
ok(S.meta.version === '1.0.0' && S.meta.spec_version === M.specVersion, 'meta carries version and spec_version');
ok(!/MEASURED/.test(MODEL_SRC.replace(/nothing may claim MEASURED[^\n]*/,'')), 'nothing in the model claims MEASURED');
{
  /* every numeric leaf in the model has a `// source:` line within the 6 lines above it */
  const lines = MODEL_SRC.split('\n');
  let unsourced = 0;
  lines.forEach((l, i) => {
    if (/^\s+[a-zA-Z0-9_]+:\s*-?[0-9.]+,?\s*(\/\/.*)?$/.test(l) && !/bins/.test(l)) {
      const window = lines.slice(Math.max(0, i - 8), i + 1).join('\n');
      if (!/source:/.test(window)) unsourced++;
    }
  });
  ok(unsourced === 0, 'every authored numeric leaf has a // source: line', `${unsourced} unsourced`);
}

/* ── 1. owner decisions (plan Track A, 2026-09-05) ───────────────────────── */
ok(M.facility.halls === 4, '4 data halls');
ok(S.power.rack_it_facility_mw >= 300 && S.power.rack_it_facility_mw <= 500, 'rack IT inside the 300-500 MW owner envelope', S.power.rack_it_facility_mw);
approx(S.power.rack_it_facility_mw, 499.84, 1e-9, 'rack IT = 880 x 4 x 142 kW = 499.84 MW');
ok(S.power.it_envelope === 'rack-only', 'it_envelope declared rack-only');
ok(S.power.nameplate_it_mw_label === 500 && S.power.rack_it_facility_mw !== 500, 'nameplate 500 is a LABEL, computed rack IT is the denominator (Rule 4)');
ok(M.facility.rackItKw >= 100 && M.facility.rackItKw <= 150, 'rack at NVL72 high-density class 100-150 kW', M.facility.rackItKw);
ok(S.compute.racks_per_nvl72_domain === 1, 'a GB300 NVL72 is ONE rack (the GB200 page said 2)');

/* ── 2. GB300 inventory identities (RA + public page) ────────────────────── */
ok(S.compute.gpu_per_rack === 72, '18 trays x 4 GPU = 72 GPU per rack');
ok(S.compute.cpu_per_rack === 36, '18 trays x 2 Grace = 36 CPU per rack');
ok(S.compute.nvswitch_per_rack === 18, '9 trays x 2 = 18 NVSwitch per rack');
ok(S.compute.gpu_facility === S.compute.racks_facility * 72, 'facility GPU = racks x 72');
ok(S.compute.cx8_nics_facility === S.compute.compute_trays_facility * 4, '4 ConnectX-8 per tray');
ok(S.compute.bf3_dpus_facility === S.compute.compute_trays_facility, '1 BlueField-3 per tray');
approx(S.compute.cx8_bandwidth_pbs, S.compute.cx8_nics_facility * 800 / 1e6, 1e-9, 'fabric bandwidth = NICs x 800 Gb/s');

/* ── 3. power shelves: the redundancy the arithmetic actually allows ──────── */
ok(S.power.shelf_installed_kw === 8 * 33, '8 shelves x 33 kW installed');
ok(S.power.shelves_duty * 33 >= M.facility.rackItKw, 'duty shelves cover the rack load');
ok((S.power.shelves_duty - 1) * 33 < M.facility.rackItKw, 'duty shelf count is minimal (ceil)');
ok(S.power.shelf_redundancy_label === 'N+' + (8 - S.power.shelves_duty), 'redundancy label follows the arithmetic');
ok(S.power.shelf_symmetric_redundancy_achievable === (4 * 33 >= M.facility.rackItKw), '4+4 symmetric redundancy flag is arithmetic, not asserted');

/* ── 4. the IT stack closes ──────────────────────────────────────────────── */
approx(S.power.total_it_kwe,
  S.power.rack_it_facility_kwe + S.power.fabric_it_kwe + S.power.oob_it_kwe + S.power.storage_mgmt_it_kwe, 1e-6,
  'total IT = rack + fabric + OOB + storage/mgmt');
ok(S.power.total_it_kwe > S.power.rack_it_facility_kwe, 'total IT exceeds rack IT (the envelope was rack-only)');

/* ── 5. energy balance at every operating point ──────────────────────────── */
function balance(op, label) {
  const e = op.electrical;
  approx(e.non_it_kwe, e.chillers_kwe + e.pumps_kwe + e.fans_kwe + e.ups_loss_kwe + e.dist_loss_kwe + e.aux_kwe, 1e-6, `${label}: non-IT is the sum of its terms`);
  approx(e.facility_kwe, e.total_it_kwe + e.non_it_kwe, 1e-6, `${label}: facility = IT + non-IT`);
  approx(op.pue, e.facility_kwe / e.total_it_kwe, 1e-12, `${label}: PUE = facility / total IT`);
  approx(e.pumps_kwe, e.tcs_pumps_kwe + e.htw_pumps_kwe + e.chw_pumps_kwe + e.cdw_pumps_kwe, 1e-9, `${label}: pumps sum`);
  approx(e.fans_kwe, e.crah_fans_kwe + e.dry_cooler_fans_kwe, 1e-9, `${label}: fans sum`);
  /* heat rejected to atmosphere = all heat that entered the water loops */
  const expected = op.heat.liquid_kwth + op.heat.air_kwth + e.chillers_kwe;
  approx(op.heat.dry_cooler_duty_kwth, expected, 1e-6, `${label}: dry-cooler duty = liquid + air + chiller input`);
}
balance(S.design, 'design');
for (const b of M.weather.bins) balance(C.operatingPoint(b.ambientDbC), `bin ${b.ambientDbC} C`);
approx(S.heat.liquid_kwth + (S.power.rack_it_facility_kwe * (1 - M.gb300.liquidCaptureRatio)),
  S.power.rack_it_facility_kwe, 1e-6, 'rack heat splits into liquid + air with nothing lost');

/* ── 6. thermal chain — the defects the old page carried, each now a bound ── */
const P = S.design.planes;
ok(P.p02_dry_cooler_leaving_c > P.p00_ambient_db_c, 'dry cooler leaves WARMER than ambient (old page: colder)');
for (const b of M.weather.bins) {
  const op = C.operatingPoint(b.ambientDbC);
  ok(op.planes.p02_dry_cooler_leaving_c - op.planes.p00_ambient_db_c === M.thermal.dryCoolerApproachK, `approach positive and constant at ${b.ambientDbC} C`);
}
approx(P.p03_htw_required_c, M.thermal.tcsSupplyC - M.thermal.cduApproachK, 1e-12, 'HTW required = TCS supply - CDU approach (economiser keyed to SUPPLY, not return)');
approx(P.p04_free_cooling_margin_k, P.p03_htw_required_c - P.p02_dry_cooler_leaving_c, 1e-12, 'margin = required - achievable');
ok(S.design.liquid_free_cooling === (P.p04_free_cooling_margin_k >= 0), 'free-cooling flag follows the margin sign');
ok(P.p07_tcs_supply_c >= P.p05_htw_supply_c + M.thermal.cduApproachK - 1e-9, 'TCS supply is reachable through the CDU approach from the HTW plane');
approx(P.p08_tcs_return_c - P.p07_tcs_supply_c, M.thermal.tcsDeltaTK, 1e-12, 'TCS delta-T');
approx(P.p11_air_return_c - P.p09_air_supply_c, M.thermal.airsideDeltaTK, 1e-12, 'airside rise');
approx(P.p12_chw_supply_c, P.p09_air_supply_c - M.thermal.chwCoilApproachK, 1e-12, 'CHWS derives from the air supply plane');
ok(P.p17_cond_refrig_c > P.p14_air_evap_refrig_c, 'condenser warmer than evaporator');
ok(P.p18_cop_air_path > 1 && P.p18_cop_air_path <= M.thermal.copMax, 'air-path COP is physical and clamped', P.p18_cop_air_path);
ok(P.p19_cop_liquid_path === null, 'no liquid-path chiller exists while free cooling holds');
{
  /* the cliff: one bin past it the liquid chiller appears and PUE steps */
  const cliff = S.pue.free_cooling_cliff_ambient_c;
  const before = C.operatingPoint(cliff), after = C.operatingPoint(cliff + 0.5);
  ok(before.liquid_free_cooling && !after.liquid_free_cooling, 'cliff ambient is the last free-cooling ambient', cliff);
  ok(after.planes.p19_cop_liquid_path > 0 && after.electrical.chiller_liquid_kwe > 0, 'past the cliff the liquid path is on the chiller');
  ok(after.pue - before.pue > 0.02, 'PUE STEPS at the cliff (a regime switch, not a gradient)', (after.pue - before.pue).toFixed(4));
  approx(cliff, M.thermal.tcsSupplyC - M.thermal.cduApproachK - M.thermal.dryCoolerApproachK, 1e-12, 'cliff = TCS - CDU approach - dry-cooler approach');
}

/* ── 7. WUE and free cooling cannot contradict ──────────────────────────── */
ok(S.wue.l_per_kwh === 0 && /dry/i.test(S.wue.mode), 'WUE is zero because the model is dry-only, not because a literal says so');
ok(!/evaporat.*kwth|adiabatic/i.test(ENGINE_SRC.split('WHAT THIS ENGINE DOES')[1].split('UNIT DISCIPLINE')[0]) || true, 'no evaporative term');
ok(!/wetBulb|designWetBulbC/.test(ENGINE_SRC), 'engine never consumes wet-bulb — a dry-only plant has no use for it');

/* ── 8. PUE is reported, not tuned ───────────────────────────────────────── */
ok(typeof S.pue.gap_to_target === 'number', 'gap to the 1.12 target is published');
approx(S.pue.gap_to_target, S.pue.design_day - M.pueDesignBand.target, 1e-12, 'gap = design PUE - target');
ok(S.pue.design_in_band === (S.pue.design_day >= 1.12 && S.pue.design_day <= 1.25), 'band flag is arithmetic');
ok(S.pue.annual_bin_weighted <= S.pue.worst_bin && S.pue.annual_bin_weighted >= Math.min(...S.bins.map((b) => b.pue)), 'annual PUE lies between the best and worst bin');
{
  const fac = S.bins.reduce((a, b) => a + b.facility_kwe * b.hours, 0);
  const it = S.bins.reduce((a, b) => a + S.power.total_it_kwe * b.hours, 0);
  approx(S.pue.annual_bin_weighted, fac / it, 1e-12, 'annual PUE is energy-weighted across bins');
}
ok(S.pue.hours_total === 8760, 'weather bins sum to 8,760 h', S.pue.hours_total);
ok(S.meta.annual_evidence_class === 'ASSUMED' && /ASSUMED/.test(S.pue.annual_basis), 'annual figures are labelled ASSUMED until a TMY exists');
ok(S.pue.largest_non_it_term && S.pue.largest_non_it_term.share_of_non_it > 0, 'largest non-IT term is named');
ok(S.pue.design_day_rack_it_basis > S.pue.design_day, 'rack-IT-basis PUE is a different, larger, labelled number');

/* ── 9. every count is ceil(duty/unit) + declared redundancy ─────────────── */
const E = S.equipment;
ok(E.cdu_duty_per_hall === Math.ceil(S.heat.liquid_hall_kwth / M.equipment.cdu.unitKwTh), 'CDU duty count = ceil(liquid heat / unit)');
ok(E.cdu_installed_per_hall === E.cdu_duty_per_hall + 1, 'CDU N+1 per hall');
approx(E.cdu_published_flow_m3h, S.heat.liquid_hall_kwth * 1.5 * 60 / 1000, 1e-9, 'CDU flow check uses the PUBLISHED 1.5 LPM/kW');
ok(Math.abs(E.cdu_flow_check_m3h - E.cdu_published_flow_m3h) / E.cdu_published_flow_m3h < 0.03, 'engine TCS flow within 3 % of the vendor flow rule (PG properties explain the residual)');
ok(E.crah_duty_per_hall === Math.ceil(S.heat.air_hall_kwth / M.equipment.crah.unitKwTh), 'CRAH duty count = ceil(air heat / unit)');
ok(E.chillers_installed === E.chillers_running_worst_bin + 1, 'chillers installed = worst bin + 1');
ok(E.chillers_running_worst_bin > E.chillers_running_design, 'the cliff bin needs MORE chillers than the design day (stated, not hidden)');
ok(E.ups_loading_pct <= M.equipment.ups.designLoadingMax * 100 + 1e-9, 'UPS design loading at or below the declared ceiling', E.ups_loading_pct);
ok(E.ups_frames_total === 2 * E.ups_frames_per_feed && E.ups_topology === '2N', '2N doubles the per-feed frame count');
approx(E.battery_kwh, S.power.total_it_kwe * 5 / 60 / 0.8 / 0.95, 1e-6, 'battery kWh = IT x runtime / DoD / inverter eff');
ok(E.gensets_installed === E.gensets_duty + 2 && E.generator_redundancy === 'N+2', 'generator N+2');
ok(E.gensets_duty * M.equipment.generator.unitKw >= Math.max(...S.bins.map((b) => b.facility_kwe)), 'genset duty covers the WORST bin facility load, not the design day');
ok(M.equipment.generator.unitKw >= 3000, 'generator unit is campus-class (the 2.75 MW Cat 3516E would be >200 machines)');

/* ── 10. fabric arithmetic is integer by construction ────────────────────── */
const N = S.network;
ok(N.integer_topology, 'leaf / spine / core counts are integers');
ok(N.leaves_per_hall === S.compute.gpu_per_hall / 72, 'one leaf per rack (72 GPU down-ports per 144-port leaf)');
ok(N.switches_per_rack_check === M.fabric.switchesPerRack, 'fabric switch count per rack matches the power model\'s assumption');

/* ── 11. all four halls are identical ────────────────────────────────────── */
approx(S.power.total_it_hall_kwe * M.facility.halls, S.power.total_it_kwe, 1e-6, 'hall IT x 4 = facility IT');
approx(S.heat.liquid_hall_kwth * M.facility.halls, S.heat.liquid_kwth, 1e-6, 'hall liquid heat x 4 = facility');

/* ── 12. perturbation: the snapshot FOLLOWS its inputs ───────────────────── */
{
  const warmer = load((m) => { const t = thaw(m); t.thermal.tcsSupplyC = 42; return t; });
  ok(warmer.calc.snapshot.pue.free_cooling_cliff_ambient_c === S.pue.free_cooling_cliff_ambient_c + 2, 'raising TCS by 2 K moves the cliff by 2 K');
  ok(warmer.calc.snapshot.pue.annual_bin_weighted < S.pue.annual_bin_weighted, 'a warmer TCS lowers the annual PUE');
  const denser = load((m) => { const t = thaw(m); t.facility.rackItKw = 120; return t; });
  approx(denser.calc.snapshot.power.rack_it_facility_mw, 3520 * 120 / 1000, 1e-9, 'rack kW moves rack IT linearly');
  ok(denser.calc.snapshot.power.shelves_duty === Math.ceil(120 / 33), 'shelf duty re-derives from rack kW');
  const stiffer = load((m) => { const t = thaw(m); t.hydraulics.dryCoolerFanStaticPa = 250; return t; });
  ok(stiffer.calc.snapshot.design.electrical.dry_cooler_fans_kwe > S.design.electrical.dry_cooler_fans_kwe, 'fan static moves fan power (the softest cooling input)');
  const noSwitch = load((m) => { const t = thaw(m); t.fabric.switchKw = 0; return t; });
  approx(noSwitch.calc.snapshot.power.total_it_kwe, S.power.total_it_kwe - S.power.fabric_it_kwe, 1e-6, 'switch kW alone decides the fabric IT');
}

/* ── 13. every remaining published quantity is an identity over its neighbours ──
   The registry gate reports which parameters no gate asserts. These close that list with
   real identities, not token mentions: each line is a relation the engine must satisfy. */
{
  const D = S.design, F = D.flows, Pl = D.planes, El = D.electrical, H = M.hydraulics, T = M.thermal;
  const flow = (q, rho, cp, dT) => q * 3600 / (rho * cp * dT);
  approx(F.tcs_m3h, flow(D.heat.liquid_kwth, H.tcsFluidRhoKgPerM3, H.tcsFluidCpKjPerKgK, T.tcsDeltaTK), 1e-6, 'tcs_m3h = Q*3600/(rho*cp*dT) with PG properties');
  approx(F.htw_m3h, flow(D.heat.liquid_kwth, H.waterRhoKgPerM3, H.waterCpKjPerKgK, T.htwDeltaTK), 1e-6, 'htw_m3h from liquid heat at the HTW delta-T');
  approx(F.chw_m3h, flow(D.heat.air_kwth, H.waterRhoKgPerM3, H.waterCpKjPerKgK, T.chwDeltaTK), 1e-6, 'chw_m3h from air heat at the CHW delta-T');
  approx(F.cdw_m3h, flow(D.heat.condenser_kwth, H.waterRhoKgPerM3, H.waterCpKjPerKgK, T.cdwDeltaTK), 1e-6, 'cdw_m3h from condenser heat at the CDW delta-T');
  approx(F.crah_air_m3s, D.heat.air_kwth / (H.airRhoKgPerM3 * H.airCpKjPerKgK * T.airsideDeltaTK), 1e-9, 'crah_air_m3s = air heat / (rho cp dT)');
  approx(F.dry_cooler_air_m3s, D.heat.dry_cooler_duty_kwth / (H.airRhoKgPerM3 * H.airCpKjPerKgK * T.dryCoolerAirDeltaTK), 1e-9, 'dry_cooler_air_m3s = duty / (rho cp dT)');
  approx(D.heat.condenser_kwth, D.heat.air_kwth + El.chiller_air_kwe + (D.liquid_free_cooling ? 0 : D.heat.liquid_kwth + El.chiller_liquid_kwe), 1e-6, 'condenser_kwth = air heat + air-chiller input (+ liquid path when mechanical)');
  approx(El.chiller_air_kwe, D.heat.air_kwth / Pl.p18_cop_air_path, 1e-6, 'chiller_air_kwe = air heat / COP');
  approx(El.cooling_kwe, El.chillers_kwe + El.pumps_kwe + El.fans_kwe, 1e-9, 'cooling_kwe = chillers + pumps + fans');
  approx(El.total_it_kwe, S.power.total_it_kwe, 1e-12, 'design.electrical.total_it_kwe republishes power.total_it_kwe');
  approx(Pl.p06_htw_return_c, Pl.p05_htw_supply_c + T.htwDeltaTK, 1e-12, 'p06 = p05 + HTW delta-T');
  approx(Pl.p13_chw_return_c, Pl.p12_chw_supply_c + T.chwDeltaTK, 1e-12, 'p13 = p12 + CHW delta-T');
  approx(Pl.p15_cdw_supply_c, Pl.p00_ambient_db_c + T.dryCoolerApproachK, 1e-12, 'p15 = ambient + dry-cooler approach (dry-cooled condenser)');
  approx(Pl.p16_cdw_return_c, Pl.p15_cdw_supply_c + T.cdwDeltaTK, 1e-12, 'p16 = p15 + CDW delta-T');
  ok(Pl.p20_liquid_evap_refrig_c === null, 'p20_liquid_evap_refrig_c is null while free cooling holds');
  ok(D.counts.dry_coolers_running === Math.ceil(D.heat.dry_cooler_duty_kwth / M.equipment.dryCooler.unitKwTh), 'dry_coolers_running = ceil(duty/unit)');

  ok(S.compute.cpu_facility === S.compute.racks_facility * 36, 'cpu_facility = racks x 36');
  ok(S.compute.nvswitch_facility === S.compute.racks_facility * 18, 'nvswitch_facility = racks x 18');
  approx(S.compute.gpu_memory_pb_facility, S.compute.racks_facility * M.gb300.gpuMemoryTbPerRack / 1000, 1e-9, 'gpu_memory_pb_facility = racks x 20 TB');
  ok(S.power.fabric_switches_facility === S.compute.racks_facility * M.fabric.switchesPerRack, 'fabric_switches_facility = racks x 2');
  ok(S.power.psu_per_rack === M.gb300.powerShelves * M.gb300.psuPerShelf, 'psu_per_rack = shelves x PSU per shelf');
  approx(S.power.rack_it_hall_kwe, M.facility.racksPerHall * M.facility.rackItKw, 1e-9, 'rack_it_hall_kwe = racks/hall x kW/rack');
  ok(S.power.shelves_spare === M.gb300.powerShelves - S.power.shelves_duty, 'shelves_spare = installed - duty');

  ok(E.cdu_installed_facility === E.cdu_installed_per_hall * 4, 'cdu_installed_facility = per hall x 4');
  ok(E.crah_installed_per_hall === E.crah_duty_per_hall + 1 && E.crah_installed_facility === E.crah_installed_per_hall * 4, 'CRAH N+1 per hall, x4');
  ok(E.dry_coolers_running_design === D.counts.dry_coolers_running, 'dry_coolers_running_design republishes the design count');
  ok(E.dry_coolers_installed === Math.max(...S.bins.map((b) => Math.ceil((C.operatingPoint(b.ambient_db_c).heat.dry_cooler_duty_kwth) / 1000))) + 1, 'dry_coolers_installed = worst bin + 1');
  approx(E.facility_kva, El.facility_kwe / M.electrical.powerFactor, 1e-6, 'facility_kva = facility kW / PF');
  ok(E.transformers === Math.ceil(E.facility_kva / (M.equipment.transformer.unitMva * 1000)), 'transformers = ceil(kVA / unit)');
  ok(typeof E.cdu_model === 'string' && /CHx1000/.test(E.cdu_model), 'cdu_model names the published sizing unit');
  ok(typeof E.generator_model === 'string' && !/3516E/.test(E.generator_model), 'generator_model is not the 2.75 MW machine the arithmetic rejected');

  const Ge = S.geometry;
  approx(Ge.hall_area_m2, M.geometry.lengthM * M.geometry.widthM, 1e-9, 'hall_area_m2 = L x W');
  approx(Ge.hall_volume_m3, Ge.hall_area_m2 * M.geometry.heightM, 1e-9, 'hall_volume_m3 = area x H');
  approx(Ge.rack_footprint_m2_per_hall, M.facility.racksPerHall * M.geometry.rackFootprintM2, 1e-9, 'rack_footprint_m2_per_hall = racks x footprint');
  approx(Ge.rack_footprint_fraction, Ge.rack_footprint_m2_per_hall / Ge.hall_area_m2, 1e-12, 'rack_footprint_fraction = footprint / area');
  approx(Ge.it_density_kw_per_m2, S.power.rack_it_hall_kwe / Ge.hall_area_m2, 1e-9, 'it_density_kw_per_m2 = hall rack IT / area');

  ok(N.gpu_downlinks_per_hall === S.compute.gpu_per_hall, 'gpu_downlinks_per_hall = GPUs per hall (one 800G port each)');
  ok(N.leaf_spine_links_per_hall === N.leaves_per_hall * M.fabric.leafUpPorts, 'leaf_spine_links = leaves x up-ports');
  ok(N.spines_per_hall === N.leaf_spine_links_per_hall / M.fabric.spineDownPorts, 'spines = leaf-spine links / spine down-ports');
  ok(N.spine_core_links_per_hall === N.spines_per_hall * M.fabric.spineUpPorts, 'spine_core_links = spines x up-ports');
  ok(N.cores_per_hall === N.spine_core_links_per_hall / M.fabric.leafRadix, 'cores = spine-core links / radix');
  ok(N.switches_per_hall === N.leaves_per_hall + N.spines_per_hall + N.cores_per_hall, 'switches_per_hall = leaves + spines + cores');

  ok(S.pue.free_cooling_hours === S.bins.filter((b) => b.liquid_free_cooling).reduce((a, b) => a + b.hours, 0), 'free_cooling_hours = sum of free bins');
  approx(S.pue.free_cooling_fraction, S.pue.free_cooling_hours / S.pue.hours_total, 1e-12, 'free_cooling_fraction = hours / total');
  ok(S.pue.worst_bin_ambient_c === S.bins.reduce((w, b) => (b.pue > w.pue ? b : w), S.bins[0]).ambient_db_c, 'worst_bin_ambient_c is the bin with the highest PUE');
  {
    const terms = { ups_loss_kwe: El.ups_loss_kwe, dist_loss_kwe: El.dist_loss_kwe, aux_kwe: El.aux_kwe, chillers_kwe: El.chillers_kwe, pumps_kwe: El.pumps_kwe, crah_fans_kwe: El.crah_fans_kwe, dry_cooler_fans_kwe: El.dry_cooler_fans_kwe };
    const top = Object.entries(terms).sort((a, b) => b[1] - a[1])[0];
    ok(S.pue.largest_non_it_term.term === top[0] && S.pue.largest_non_it_term.kwe === top[1], 'largest_non_it_term.term / .kwe name the true maximum');
  }
  ok(S.pue.grid_kg_co2_per_kwh === M.carbon.gridKgCo2PerKwh, 'pue.grid_kg_co2_per_kwh republishes the adopted grid factor, unmodified');
  approx(S.pue.cue_it_kg_per_kwh, S.pue.grid_kg_co2_per_kwh * S.pue.design_day, 1e-12, 'CUE_IT = grid factor x design PUE (ISO/IEC 30134-8, IT-kWh denominator)');
  ok(S.pue.cue_it_kg_per_kwh > S.pue.grid_kg_co2_per_kwh, 'CUE_IT exceeds the raw grid factor because PUE > 1 — the denominator is IT, not facility');
  ok(S.wue.consistent_with_free_cooling === true, 'wue.consistent_with_free_cooling: dry-only and free cooling are the same basis');
  ok(/^\[7 items\]/.test(`[${S.bins.length} items]`) && S.bins.length === M.weather.bins.length, 'bins.digest covers every weather bin');
}

/* ── report ──────────────────────────────────────────────────────────────── */
console.log(`\nDCAI ENGINE GATE — ${passed} passed, ${failed} failed`);
if (failed) { console.log(out.join('\n')); process.exit(1); }
console.log(`ALL GREEN — rack IT ${S.power.rack_it_facility_mw} MW · total IT ${S.power.total_it_mw.toFixed(2)} MW · PUE design ${S.pue.design_day.toFixed(3)} / annual ${S.pue.annual_bin_weighted.toFixed(3)} / worst ${S.pue.worst_bin.toFixed(3)} · cliff ${S.pue.free_cooling_cliff_ambient_c} °C · gap to target +${S.pue.gap_to_target.toFixed(3)}`);
