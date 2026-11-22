// Gate for js/rz-elec-voltage.js (PRD-ELECTRICAL-BMS §A6, law E19 core): bus voltage under load from the transformer
// regulation approximation (IEC 60076-1 Annex), its ±5 / ±10 % state (IEC 60038, EN 50160) and the DEAD case.
// Worked examples are computed by hand below, so a changed formula fails here before it reaches a sheet.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let V;
try { V = require('../js/rz-elec-voltage.js'); } catch (e) { console.log('FAIL — js/rz-elec-voltage.js does not load: ' + e.message); process.exit(1); }
const fails = [];
const near = (a, b, tol, what) => { if (!(Math.abs(a - b) <= tol)) fails.push(`${what}: got ${a}, want ${b} ± ${tol}`); };
const eq = (a, b, what) => { if (a !== b) fails.push(`${what}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };

/* W1 — 2.5 MVA unit sub, 400 V, full load, Z 6 %, cos φ 0.95, X/R 5:
   R/Z = 1/√26 = 0.19612, X/Z = 5/√26 = 0.98058, sin φ = 0.31225
   reg = 6 × (0.95 × 0.19612 + 0.31225 × 0.98058) = 6 × 0.49250 = 2.9550 % → 388.18 V */
const w1 = V.underLoad({ nominal: 400, loading: 1, zPct: 6, pf: 0.95, xr: 5 });
near(w1.regPct, 2.955, 0.001, 'W1 regulation %'); near(w1.v, 388.18, 0.01, 'W1 volts'); eq(w1.state, 'normal', 'W1 state');
/* W2 — the same at half load: reg 1.4775 % → 394.09 V */
const w2 = V.underLoad({ nominal: 400, loading: 0.5, zPct: 6, pf: 0.95, xr: 5 });
near(w2.regPct, 1.4775, 0.001, 'W2 regulation %'); near(w2.v, 394.09, 0.01, 'W2 volts');
/* W3 — 20 kV main TX at 2N→N contingency: loading 1.9, Z 12.5 %, cos φ 0.95, X/R 10:
   R/Z = 0.09950, X/Z = 0.99504; term = 0.09453 + 0.31070 = 0.40523; reg = 1.9 × 12.5 × 0.40523 = 9.6242 % → 18 075 V, warn */
const w3 = V.underLoad({ nominal: 20000, loading: 1.9, zPct: 12.5, pf: 0.95, xr: 10 });
near(w3.regPct, 9.624, 0.002, 'W3 regulation %'); eq(w3.state, 'warn', 'W3 state (−9.6 % is past −5 %, inside −10 %)');
/* W4 — past −10 % is alarm */
eq(V.underLoad({ nominal: 400, loading: 2.2, zPct: 12.5, pf: 0.95, xr: 10 }).state, 'alarm', 'W4 state');
/* W5 — dead bus */
const w5 = V.underLoad({ nominal: 400, loading: 0.5, zPct: 6, pf: 0.95, xr: 5, live: false });
eq(w5.v, 0, 'W5 volts'); eq(w5.state, 'dead', 'W5 state'); eq(V.label(w5), '0 V DEAD', 'W5 label');
/* W6 — labels with units at each level */
eq(V.label(w1), '388 V', 'W6 LV label'); eq(V.label(w3), '18.08 kV', 'W6 MV label');
eq(V.label(V.underLoad({ nominal: 150000, loading: 0.3, zPct: 0, pf: 0.95, xr: 10 })), '150.0 kV', 'W6 HV label (no transformer upstream)');
/* W7 — direction: more load, lower voltage; refused inputs throw with a reason */
if (!(V.underLoad({ nominal: 400, loading: 0.9, zPct: 6, pf: 0.95, xr: 5 }).v < w2.v)) fails.push('W7 more load must lower the voltage');
['nominal', 'loading', 'zPct', 'pf', 'xr'].forEach((k) => {
  const o = { nominal: 400, loading: 0.5, zPct: 6, pf: 0.95, xr: 5 }; o[k] = k === 'pf' ? 1.2 : -1;
  try { V.underLoad(o); fails.push('W7 ' + k + ' out of range was accepted'); } catch (e) { if (!/\b/.test(e.message)) fails.push('W7 no reason'); }
});
/* W8 — every assumed constant names its source */
Object.keys(V.ASSUMED).forEach((k) => { const a = V.ASSUMED[k]; if (!(typeof a.value === 'number' && a.source && a.source.length > 10)) fails.push('W8 ASSUMED.' + k + ' lacks value/source'); });
eq(V.LIMITS.warnPct, 5, 'W8 warn limit'); eq(V.LIMITS.alarmPct, 10, 'W8 alarm limit');

if (fails.length) { console.log('FAIL — elec voltage ' + fails.length + ' finding(s)'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log('PASS elec voltage — W1-W8 (regulation, states, DEAD, labels, direction, refusals, sources)');
