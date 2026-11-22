/* r134a-cycle-check.mjs — an INDEPENDENT second implementation of the chiller cycle for the gates
   (tools/test-conv-chiller-cycle.mjs). It reads the raw NIST files in data/sources/nist-r134a (every saturation row,
   every 1 K isobar row), interpolates in absolute temperature on the nearest isobars and solves eta and specific power
   by its own bisections. Shares no code with js/conv-engine.js. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/sources/nist-r134a');
const rd = (f) => fs.readFileSync(path.join(DIR, f), 'utf8').trim().split('\n');
const satL = rd('saturation.tsv'), H = satL[0].split('\t');
const ix = (n) => H.indexOf(n);
export const SAT = satL.slice(1).map((l) => l.split('\t').map(Number)).map((c) => ({ T: c[ix('Temperature (C)')], P: c[ix('Pressure (kPa)')],
  hf: c[ix('Enthalpy (l, kJ/kg)')], hg: c[ix('Enthalpy (v, kJ/kg)')], sf: c[ix('Entropy (l, J/g*K)')], sg: c[ix('Entropy (v, J/g*K)')] }));
const ISO = {};
for (let P = 300; P <= 1700; P += 100) {
  const L = rd('isobar-' + P + '.tsv'), h = L[0].split('\t'), ph = h.indexOf('Phase');
  ISO[P] = L.slice(1).map((l) => l.split('\t')).filter((c) => c[ph] === 'vapor').map((c) => ({ T: +c[0], h: +c[5], s: +c[6] }));
}
const PS = Object.keys(ISO).map(Number).sort((a, b) => a - b);
const lerp = (x, x0, x1, y0, y1) => y0 + (y1 - y0) * (x - x0) / (x1 - x0);
export function sat(k, v) {
  for (let i = 0; i < SAT.length - 1; i++) { const a = SAT[i], b = SAT[i + 1]; if ((a[k] - v) * (b[k] - v) <= 0) { const o = {}; for (const q of ['T', 'P', 'hf', 'hg', 'sf', 'sg']) o[q] = lerp(v, a[k], b[k], a[q], b[q]); return o; } }
  return null;
}
function iso(P, k, v, q) { const r = ISO[P]; for (let i = 0; i < r.length - 1; i++) if ((r[i][k] - v) * (r[i + 1][k] - v) <= 0) return lerp(v, r[i][k], r[i + 1][k], r[i][q], r[i + 1][q]); return null; }
/* superheated property at P: superheat carried relative to each isobar's own saturation (as a designer reads a chart) */
export function vap(P, k, v, q) {
  const i = PS.findIndex((p) => p >= P); if (i <= 0) return null; const p0 = PS[i - 1], p1 = PS[i], ts = sat('P', P).T;
  const t0 = ISO[p0][0].T, t1 = ISO[p1][0].T;
  let y0 = iso(p0, k, k === 'T' ? t0 + v - ts : v, q), y1 = iso(p1, k, k === 'T' ? t1 + v - ts : v, q);
  if (y0 == null || y1 == null) return null;
  if (q === 'T') { y0 -= t0; y1 -= t1; return lerp(P, p0, p1, y0, y1) + ts; }
  return lerp(P, p0, p1, y0, y1);
}
export function cycle({ Te, Tc, eta, sh, sc }) {
  const e = sat('T', Te), c = sat('T', Tc), Pi = Math.sqrt(e.P * c.P), m = sat('P', Pi);
  const h1 = vap(e.P, 'T', Te + sh, 'h'), s1 = vap(e.P, 'T', Te + sh, 's'), h5 = sat('T', Tc - sc).hf;
  const xf = (h5 - m.hf) / (m.hg - m.hf), h8 = m.hf, me = 1 / (h1 - h8), mc = me / (1 - xf);
  const h2 = h1 + (vap(Pi, 's', s1, 'h') - h1) / eta, h3 = (1 - xf) * h2 + xf * m.hg, s3 = vap(Pi, 'h', h3, 's');
  const h4 = h3 + (vap(c.P, 's', s3, 'h') - h3) / eta;
  return { Pe: e.P, Pi, Pc: c.P, xf, me, mc, w: me * (h2 - h1) + mc * (h4 - h3), Td: vap(c.P, 'h', h4, 'T'), h1, h4, h5, h8 };
}
export function solveEta(Te, Tc, spShaft, sh, sc) {
  let lo = 0.3, hi = 1; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (cycle({ Te, Tc, eta: mid, sh, sc }).w > spShaft) lo = mid; else hi = mid; } return (lo + hi) / 2;
}
