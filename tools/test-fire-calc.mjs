/* ============================================================================
 * test-fire-calc.mjs — acceptance tests for the fire-safety engine
 * ----------------------------------------------------------------------------
 * Run: node tools/test-fire-calc.mjs   (exit 0 = all pass, 1 = any fail)
 * Engine + model in a Node vm sandbox (no deps). Expecteds hand-derived from
 * NFPA 2001 agent equations + UL 9540A/Li-ion data — NOT read back from engine.
 * Also asserts deep-frozen model, no Math.random, determinism.
 * ==========================================================================*/
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(__dirname, '..', 'js');
const MODEL_PATH = path.join(JS, 'fire-model.js');
const ENGINE_PATH = path.join(JS, 'fire-engine.js');

const sandbox = { module: undefined, console };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
function load(file, label) { const c = readFileSync(file, 'utf8'); sandbox.module = { exports: {} }; vm.runInContext(c, ctx, { filename: label }); }
load(MODEL_PATH, 'fire-model.js'); load(ENGINE_PATH, 'fire-engine.js');
const M = sandbox.FIRE_MODEL, E = sandbox.FIRE_ENGINE;
if (!M || !E) { console.error('FATAL: model/engine did not attach'); process.exit(1); }

let passed = 0, failed = 0; const lines = [];
function approx(a, e, tol, what) { const x = Number(a), y = Number(e); const ok = Number.isFinite(x) && Math.abs(x - y) <= tol;
  if (ok) { passed++; lines.push(`  PASS  ${what}  (${x} ~= ${y} ±${tol})`); } else { failed++; lines.push(`  FAIL  ${what}  got ${x}, expected ${y} ±${tol}`); } }
function ok(c, what) { if (c) { passed++; lines.push(`  PASS  ${what}`); } else { failed++; lines.push(`  FAIL  ${what}`); } }

/* Ex1: Novec 1230 mass (NFPA 2001) — V=100 m3, T=20C, C=4.7% */
const w1 = E.halocarbonAgentKg(100, 4.7, 20, M.agents.novec1230.k1, M.agents.novec1230.k2);
approx(w1, 68.6, 0.4, 'Ex1 Novec 1230 100m3 @20C 4.7% = 68.6 kg');
approx(w1 / 100, 0.686, 0.005, 'Ex1 Novec 1230 design density = 0.69 kg/m3');

/* Ex2: FM-200 mass — V=100, T=20, C=7% */
approx(E.halocarbonAgentKg(100, 7, 20, M.agents.fm200.k1, M.agents.fm200.k2), 54.9, 0.4, 'Ex2 FM-200 100m3 @20C 7% = 54.9 kg');

/* Ex3: IG-541 inert volume — V=100, C=37.5% */
approx(E.inertAgentM3(100, 37.5), 47.0, 0.3, 'Ex3 IG-541 100m3 @37.5% = 47.0 m3 NTP');

/* Ex4: occupant safety margins vs NOAEL */
approx(E.safetyMarginPct(4.7, 10), 5.3, 0.01, 'Ex4 Novec margin to NOAEL = 5.3 pts');
ok(E.occupiableOk(4.7, 10) === true, 'Ex4 Novec 4.7% <= NOAEL 10% -> occupiable OK');
ok(E.occupiableOk(7, 9) === true, 'Ex4 FM-200 7% <= NOAEL 9% -> occupiable OK');
ok(E.occupiableOk(11, 10) === false, 'Ex4 conc 11% > NOAEL 10% -> NOT occupiable');

/* Ex5: cylinder counts */
ok(E.cylinderCount(686, 100) === 7, 'Ex5 686 kg / 100 kg cylinders = 7');
ok(E.cylinderCount(68.6, 100) === 1, 'Ex5 68.6 kg -> 1 cylinder');

/* Ex6: GWP-weighted CO2e — FM-200 vs Novec (same room) */
approx(E.co2eTonnes(54.875, 3220), 176.7, 1, 'Ex6 FM-200 54.9 kg = 176.7 t CO2e (GWP 3220)');
approx(E.co2eTonnes(68.6, 1), 0.069, 0.01, 'Ex6 Novec 68.6 kg = 0.07 t CO2e (GWP 1)');

/* Ex7: detector coverage (NFPA 72 ~84 m2/spot) */
ok(E.spotDetectorCount(200, 84) === 3, 'Ex7 200 m2 / 84 m2 = 3 spot detectors');
ok(E.spotDetectorCount(84, 84) === 1, 'Ex7 84 m2 = 1 detector');
ok(E.spotDetectorCount(85, 84) === 2, 'Ex7 85 m2 = 2 detectors');

/* Ex8: discharge + hold time bands */
ok(E.dischargeTimeOk(8, 'novec1230') === true, 'Ex8 halocarbon 8 s <= 10 s OK');
ok(E.dischargeTimeOk(12, 'fm200') === false, 'Ex8 halocarbon 12 s > 10 s FAIL');
ok(E.dischargeTimeOk(45, 'ig541') === true, 'Ex8 inert 45 s <= 60 s OK');
ok(E.holdTimeOk(10) === true && E.holdTimeOk(8) === false, 'Ex8 hold time >= 10 min band');

/* Ex9: Li-ion thermal-runaway risk (datahallAI 1,333 kWh NMC pack) */
ok(E.runawayOnsetC('nmc') === 150 && E.runawayOnsetC('lfp') === 166.8, 'Ex9 TR onset NMC 150C / LFP 166.8C');
approx(E.liIonRunawayHeatMJ(1333, 'nmc'), 11997, 5, 'Ex9 1333 kWh NMC runaway heat = 11,997 MJ');
approx(E.liIonOffGasM3(1333, 'nmc'), 5332, 5, 'Ex9 1333 kWh NMC off-gas = 5,332 m3 (worst case)');
approx(E.offGasRoomConcPct(10, 'nmc', 200), 16.67, 0.1, 'Ex9 10 kWh off-gas in 200 m3 = 16.7 vol%');
ok(E.offGasLflMarginOk(10, 'nmc', 200) === false, 'Ex9 off-gas far exceeds LFL alarm -> NOT ok (ventilation critical)');

/* Ex10: composite roomState (one source of truth) */
const rs = E.roomState({ volM3: 100, tempC: 20, areaM2: 33, agent: 'novec1230', packKWh: 1333, chem: 'nmc' });
approx(rs.agent.quantity, 68.6, 0.4, 'Ex10 roomState agent qty = 68.6 kg');
ok(rs.spotDetectors === 1, 'Ex10 roomState 33 m2 -> 1 detector');
approx(rs.safetyMargin.value, 5.3, 0.01, 'Ex10 roomState safety margin 5.3');
ok(rs.liIon && rs.liIon.runawayOnsetC === 150, 'Ex10 roomState Li-ion onset 150C present');

/* Integrity */
function deepFrozen(o){ if(o===null||typeof o!=='object')return true; if(!Object.isFrozen(o))return false; return Object.keys(o).every(k=>deepFrozen(o[k])); }
ok(deepFrozen(M), 'Integrity: FIRE_MODEL deep-frozen');
ok(!/Math\.random\s*\(/.test(readFileSync(ENGINE_PATH,'utf8')), 'Integrity: engine makes no Math.random() call');
const s1 = JSON.stringify(E.roomState({volM3:100,agent:'fm200'})), s2 = JSON.stringify(E.roomState({volM3:100,agent:'fm200'}));
ok(s1 === s2, 'Integrity: roomState deterministic');

console.log(lines.join('\n'));
console.log('\n============================================================');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('============================================================');
if (failed > 0) { console.log('  STATUS: FAIL'); process.exit(1); }
console.log('  STATUS: PASS — every fire-safety worked example reproduced.');
process.exit(0);
