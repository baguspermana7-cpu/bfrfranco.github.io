#!/usr/bin/env node
/**
 * test-dcai-setpoints.mjs — PRD-SETPOINT-SIM §C P5: the DC AI cockpit never types a setpoint.
 *
 *   D0  Node: js/datahall-ai/sp-inspector.js gives every DC AI setpoint class rows; its what-if = DCAI_CALC.compute of a
 *       copy (12 cases of the PRD tables), cliff ambient +1 K per +1 K TCS, live model untouched.
 *   D2  static: no `{ value: <number>, text: '<number> … setpoint …' }` payload literal in js/datahall-ai/*.js — a setpoint
 *       on the DC AI page is read from the control registry (RZControlPoints) or the engine, never typed. Red on the
 *       tree before P5: 8 literals in hmi-payloads.js (pH, conductivity, supply RH, jacket keep-warm, aeration DO, MMR
 *       supply air, support-room temperature and RH).
 *   (D1 inspector block, D3 trend SP line and D4 render laws join this file with the P5 browser work.)
 *
 * Usage: node tools/test-dcai-setpoints.mjs [--list]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'js/datahall-ai');
const TYPED = /\{\s*value:\s*-?\d+(?:\.\d+)?\s*,\s*text:\s*['"`]\s*-?\d+(?:\.\d+)?[^'"`]*setpoint/i;

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let fails = 0; const law = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };

/* D0 (Node) the inspector core js/datahall-ai/sp-inspector.js: every DC AI class the registry holds a setpoint for gets
   rows; the what-if recompute equals a direct DCAI_CALC.compute of a copy (TCS 35/38/40/42/45, air 18/22/25/27, PRD §C
   P6 tables) and never touches the live model */
{
  const D = require(path.join(ROOT, 'js/dcai-engine.js'));
  const sb = { DCAI_CALC: D }; new Function('window', fs.readFileSync(path.join(ROOT, 'js/rz-control-points.js'), 'utf8'))(sb);
  const SPI = require(path.join(ROOT, 'js/datahall-ai/sp-inspector.js'));
  globalThis.RZControlPoints = sb.RZControlPoints; globalThis.DCAI_CALC = D;
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/control-points.json'), 'utf8')).rows.filter((r) => r.cockpit === 'dcai' && r.sp && r.sp.role === 'setpoint');
  for (const r of reg) law(SPI.rows(r.equipment).some((x) => x.id === r.id), `D0 ${r.id}: no inspector row for class ${r.equipment}`);
  /* a reference value is not repeated as a setpoint row, and a row that has a band carries it (the page has no points.js) */
  const refs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/control-points.json'), 'utf8')).rows.filter((r) => r.cockpit === 'dcai' && r.sp && r.sp.role === 'reference');
  for (const r of refs) law(!SPI.rows(r.equipment).some((x) => x.id === r.id), `D0 ${r.id}: a reference value shown as a setpoint row`);
  for (const r of reg) if (r.limits) { const x = SPI.rows(r.equipment).find((y) => y.id === r.id); law(x && x.limits && ['lo_alarm', 'lo_warn', 'hi_warn', 'hi_alarm'].every((k) => x.limits[k] === r.limits[k]), `D0 ${r.id}: band ${JSON.stringify(x && x.limits)} ≠ registry ${JSON.stringify(r.limits)}`); }
  const before = JSON.stringify(D.model), get = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const cases = [['thermal.tcsSupplyC', [35, 38, 40, 42, 45], 'pue.annual_bin_weighted'], ['thermal.tcsSupplyC', [35, 40, 42], 'pue.free_cooling_cliff_ambient_c'], ['thermal.airSupplyC', [18, 22, 25, 27], 'design.electrical.cooling_kwe']];
  for (const [param, vals, out] of cases) for (const v of vals) {
    const m = JSON.parse(JSON.stringify(D.model)), k = param.split('.'); k.slice(0, -1).reduce((x, y) => x[y], m)[k[k.length - 1]] = v;
    const want = get(D.compute(m), out), got = get(SPI.recompute(param, v), out);
    law(typeof got === 'number' && Math.abs(got - want) <= Math.abs(want) * 1e-3, `D0 what-if ${param}=${v}: ${out} ${got} ≠ engine ${want}`);
  }
  law(get(SPI.recompute('thermal.tcsSupplyC', 41), 'pue.free_cooling_cliff_ambient_c') === get(D.snapshot, 'pue.free_cooling_cliff_ambient_c') + 1, 'D0 the cliff ambient does not move 1:1 with TCS supply (40 → 41 °C)');
  law(JSON.stringify(D.model) === before, 'D0 a what-if recompute changed the live DC AI model');
  law(SPI.recompute('thermal.noSuchField', 1) === null, 'D0 an unknown parameter is not refused (null)');
  if (!fails) console.log(`PASS D0 inspector core: ${reg.length} DC AI setpoints have rows; what-if = engine on 12 cases; live model untouched`);
}

const hits = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js')).sort()) {
  fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').forEach((line, i) => {
    if (TYPED.test(line)) hits.push(`js/datahall-ai/${f}:${i + 1}  ${line.trim().slice(0, 110)}`);
  });
}
if (process.argv.includes('--list')) hits.forEach((h) => console.log('  ' + h));
const ok = hits.length === 0;
console.log(`${ok ? 'PASS' : 'FAIL'} D2 typed setpoint literals in js/datahall-ai/*.js: ${hits.length} (want 0)`);
if (!ok && !process.argv.includes('--list')) hits.slice(0, 8).forEach((h) => console.log('  ' + h));
process.exit(ok && !fails ? 0 : 1);
