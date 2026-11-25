#!/usr/bin/env node
/**
 * test-dcai-setpoints.mjs — PRD-SETPOINT-SIM §C P5: the DC AI cockpit never types a setpoint.
 *
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
process.exit(ok ? 0 : 1);
