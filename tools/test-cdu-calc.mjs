/* ============================================================================
 * test-cdu-calc.mjs — acceptance tests for the CDU thermohydraulic engine
 * ----------------------------------------------------------------------------
 * Run:  node tools/test-cdu-calc.mjs
 * Exits 0 iff every worked example passes within its tolerance; 1 on any fail.
 *
 * Engine + model loaded into a Node `vm` sandbox (no framework, no deps) so the
 * exact browser ES5 globals path is exercised. Expected values are hand-derived
 * from textbook formulas (Q=m.cp.dT, epsilon-NTU, Darcy-Weisbach/Haaland,
 * Magnus, Tetens, Hydraulic-Institute NPSH) — NOT read back from the engine.
 * Also asserts: deep-frozen model, zero Math.random in engine, determinism.
 * ==========================================================================*/
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JS_DIR = path.join(__dirname, '..', 'js');
const MODEL_PATH = path.join(JS_DIR, 'cdu-model.js');
const ENGINE_PATH = path.join(JS_DIR, 'cdu-engine.js');

const sandbox = { module: undefined, console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
function runInSandbox(file, label) {
  const code = readFileSync(file, 'utf8');
  sandbox.module = { exports: {} };
  vm.runInContext(code, ctx, { filename: label });
  return sandbox.module.exports;
}
runInSandbox(MODEL_PATH, 'cdu-model.js');
runInSandbox(ENGINE_PATH, 'cdu-engine.js');

const M = sandbox.CDU_MODEL;
const E = sandbox.CDU_ENGINE;
if (!M || !E) { console.error('FATAL: model/engine did not attach to window'); process.exit(1); }

let passed = 0, failed = 0;
const lines = [];
function approx(actual, expected, tol, what) {
  const a = Number(actual), e = Number(expected);
  const okk = Number.isFinite(a) && Math.abs(a - e) <= tol;
  if (okk) { passed++; lines.push(`  PASS  ${what}  (${a} ~= ${e} ±${tol})`); }
  else { failed++; lines.push(`  FAIL  ${what}  got ${a}, expected ${e} ±${tol}`); }
}
function ok(cond, what) {
  if (cond) { passed++; lines.push(`  PASS  ${what}`); }
  else { failed++; lines.push(`  FAIL  ${what}`); }
}

/* ---- Ex1: flow from heat (water @35C, OCP band) -------------------------- */
const wp35 = E.waterProps(35);                 // rho ~994.77 kg/m3
const rhoW = wp35.rho / 1000;                  // ~0.99477 kg/L
const flow1 = E.flowLpmFromQ(100, rhoW, 4.186, 10);   // = 6000/(0.99477*4.186*10)=144.08
approx(flow1, 144.08, 0.6, 'Ex1 flowLpmFromQ(100kW,dT10,water) = 144 LPM');
approx(E.flowLpmPerKw(flow1, 100), 1.44, 0.02, 'Ex1 LPM/kW = 1.44 (within OCP 1.25-2.0)');
approx(E.hydronicQkW(flow1, rhoW, 4.186, 10), 100, 0.1, 'Ex1 round-trip Q = 100 kW');

/* ---- Ex2: in-row preset internal consistency (water basis) --------------- */
const wp32 = E.waterProps(32);
const q2 = E.hydronicQkW(390, wp32.rho / 1000, 4.186, 11);   // 390 LPM, dT11 ~= 298 kW ~= cap 300
approx(q2, 298, 3, 'Ex2 in-row preset (390 LPM, dT11) -> Q ~= cap 300 kW (water basis)');

/* ---- Ex3: dew-point reset (Magnus) --------------------------------------- */
approx(E.dewPointC(24, 60), 15.76, 0.3, 'Ex3 dewPoint(24C,60%) = 15.76 C');
ok(E.dewSafetyOk(30, 15.76, 3) === true, 'Ex3 supply 30C safe vs dew 15.76 (+3 margin)');
approx(E.dewPointC(30, 80), 26.17, 0.3, 'Ex3 dewPoint(30C,80%) = 26.17 C');
ok(E.dewSafetyOk(30, 26.17, 3) === true, 'Ex3 supply 30C still safe vs dew 26.17 (+3 = 29.17)');
ok(E.dewSafetyOk(28, 26.17, 3) === false, 'Ex3 supply 28C UNSAFE vs dew 26.17 (+3)');

/* ---- Ex4: pressure drop (Darcy-Weisbach + Haaland), DN50, PG25 @35C ------- */
approx(E.velocityMs(390, 52.5), 3.003, 0.03, 'Ex4 velocity(390LPM,DN50) = 3.00 m/s');
const leg = E.legDpBar(390, 52.5, 20, 0, 'pg25', 35, 25);
approx(leg.reynolds, 110300, 4000, 'Ex4 Reynolds ~ 1.10e5 (turbulent)');
approx(leg.frictionFactor, 0.02126, 0.0015, 'Ex4 Haaland f ~ 0.0213');
approx(leg.dpTotalBar, 0.372, 0.03, 'Ex4 20m DN50 dP ~ 0.37 bar');
ok(leg.velState === 'warn', 'Ex4 velocity 3.0 m/s flags warn (band max 3.0)');

/* ---- Ex5: NPSH available + cavitation margin ----------------------------- */
approx(E.vaporPressureBar(35), 0.0562, 0.002, 'Ex5 vaporPressure(35C) = 0.056 bar');
const npshA = E.npshAvailableM(1.013, 0.0562, 3, 1.5, 1018.65);   // ~11.07 m
approx(npshA, 11.07, 0.25, 'Ex5 NPSH available = 11.07 m (flooded suction)');
approx(E.cavitationMarginPct(npshA, 6), 84.5, 4, 'Ex5 cavitation margin vs NPSHr 6 = ~85% (PASS)');
const npshA2 = E.npshAvailableM(1.013, 0.0562, 0.5, 1.5, 1018.65);  // ~8.57 m
ok(E.cavitationMarginPct(npshA2, 8) < M.bands.npshMarginPct.min, 'Ex5 edge: static 0.5m vs NPSHr 8 -> margin <10% (FAIL band)');

/* ---- Ex6: HX effectiveness (epsilon-NTU) + approach ---------------------- */
approx(E.epsilonNTU(2.0, 0.9), 0.6889, 0.005, 'Ex6 epsilonNTU(NTU2,Cr0.9,counter) = 0.689');
approx(E.approachTempC(45, 35, 0.6889), 3.11, 0.1, 'Ex6 approach(45,35,eps0.689) = 3.1 C (in band)');
approx(E.effectivenessForApproach(45, 35, 3.11), 0.689, 0.01, 'Ex6 inverse: eps for approach 3.1 = 0.689');
approx(E.epsilonNTU(2.0, 1.0), 0.6667, 0.002, 'Ex6 Cr=1 special case = NTU/(1+NTU) = 0.667');

/* ---- Ex7: pump power + N+1 ----------------------------------------------- */
approx(E.pumpHydraulicKW(390, 1.6), 1.04, 0.01, 'Ex7 pump hydraulic (390LPM,1.6bar) = 1.04 kW');
const shaft7 = E.pumpShaftKW(1.04, 0.70);
approx(shaft7, 1.486, 0.01, 'Ex7 pump shaft (eff 0.70) = 1.49 kW');
approx(E.pumpElectricalKW(shaft7, 0.92), 1.615, 0.01, 'Ex7 pump electrical (motor 0.92) = 1.62 kW');
ok(E.pumpCountNplus1(390, 200) === 3, 'Ex7 N+1 pump count (390/200) = 3 (2 duty + 1)');

/* ---- Ex8: PG25 vs water — same Q needs ~8% more flow --------------------- */
const fW = E.flowLpmFromQ(100, E.waterProps(35).rho / 1000, E.waterProps(35).cp, 10);
const pg = E.pg25Props(35, 25);
const fP = E.flowLpmFromQ(100, pg.rho / 1000, pg.cp, 10);
approx(fP / fW, 1.079, 0.012, 'Ex8 PG25/water flow ratio = 1.08 (~8% more flow)');

/* ---- Ex9: glycol top-up + inhibitor reserve ------------------------------ */
approx(E.glycolTopUpL(500, 20, 25), 33.33, 0.1, 'Ex9 glycol top-up 20->25% in 500L = 33.3 L');
ok(E.inhibitorReserveOk(70) === false, 'Ex9 inhibitor 70 ppm fails (<100)');
ok(E.inhibitorReserveOk(120) === true, 'Ex9 inhibitor 120 ppm passes (>=100)');

/* ---- Ex10: vendor cross-check (Rule 1, byte-match published page) -------- */
const xdu = M.vendorModels[0];
ok(xdu.vendor === 'Vertiv' && xdu.kw === 1368 && xdu.secLpm === 1200 && xdu.dpBar === 2.44 && xdu.approachC === 4,
   'Ex10 Vertiv XDU1350 model row matches published selection-guide numbers');
approx(E.flowLpmPerKw(1200, 1368), 0.877, 0.005, 'Ex10 XDU1350 facility-side LPM/kW = 0.88');

/* ---- Ex11: TCO / ROI ----------------------------------------------------- */
approx(E.capexUsd('l2l', 3000), 600000, 1, 'Ex11 capex l2l @ 3000 kW ($200/kW) = $600k');
approx(E.npv([-100, 50, 50, 50], 8), 28.86, 0.05, 'Ex11 NPV([-100,50,50,50]@8%) = 28.86');
approx(E.paybackYears(600000, 120000), 5.0, 0.01, 'Ex11 payback ($600k / $120k/yr) = 5.0 yr');

/* ---- Integrity: frozen, no PRNG, determinism ----------------------------- */
function deepFrozen(o) {
  if (o === null || typeof o !== 'object') return true;
  if (!Object.isFrozen(o)) return false;
  return Object.keys(o).every(k => deepFrozen(o[k]));
}
ok(deepFrozen(M), 'Integrity: CDU_MODEL is deep-frozen');
const engineSrc = readFileSync(ENGINE_PATH, 'utf8');
ok(!/Math\.random\s*\(/.test(engineSrc), 'Integrity: engine makes no Math.random() call');
const s1 = JSON.stringify(E.cduState('inrow', 'normal'));
const s2 = JSON.stringify(E.cduState('inrow', 'normal'));
ok(s1 === s2, 'Integrity: cduState() is deterministic (identical JSON twice)');
/* cduState band wiring sanity */
const st = E.cduState('inrow', 'clog');
ok(st.dpBar.state === 'warn' || st.dpBar.state === 'alarm', 'cduState: clog fault drives dP out of band');
ok(E.cduState('inrack', 'normal').flowLpmPerKw.state === 'ok', 'cduState: in-rack normal flow in band');

/* ---- summary ------------------------------------------------------------- */
console.log(lines.join('\n'));
console.log('\n============================================================');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('============================================================');
if (failed > 0) { console.log('  STATUS: FAIL'); process.exit(1); }
console.log('  STATUS: PASS — every CDU worked example reproduced.');
process.exit(0);
