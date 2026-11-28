#!/usr/bin/env node
/**
 * test-basis-title-evidence.mjs — a hover title never contradicts the registry about where a number comes from.
 *
 * Law T1: on every page, an element with data-basis-param whose title names an evidence class in parentheses
 *   ("(ASSUMED)", "(DERIVED)", ...) names the class its parameter record carries in data/conv-parameters.json or
 *   data/dcai-parameters.json. v3.117.4: chiller-plant "Specific power" said ASSUMED; the record is DERIVED.
 * Law T2: such a title names a parameter that exists in a registry (a claim about nothing is not a basis).
 *
 * Usage: node tools/test-basis-title-evidence.mjs   (exit 0 = pass). Static, no browser.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLASSES = ['PUBLISHED', 'STANDARD', 'VENDOR', 'DERIVED', 'ADOPTED', 'ASSUMED', 'SIMULATED', 'MEASURED', 'LABEL', 'UNAVAILABLE', 'CITED', 'DEFAULT'];
const reg = new Map();
for (const f of ['data/conv-parameters.json', 'data/dcai-parameters.json']) {
  const d = JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
  for (const p of d.parameters || d.params || []) reg.set(p.id, p.evidenceClass);
}
if (reg.size < 100) { console.log('FAIL registry not read (' + reg.size + ' records)'); process.exit(1); }
const claim = new RegExp('\\((' + CLASSES.join('|') + ')\\b');
let checked = 0; const bad = [];
for (const page of readdirSync(ROOT).filter((n) => n.endsWith('.html'))) {
  const s = readFileSync(join(ROOT, page), 'utf8');
  for (const m of s.matchAll(/<[^>]*\bdata-basis-param="([^"]+)"[^>]*>/g)) {
    const t = /\btitle="([^"]*)"/.exec(m[0]); if (!t) continue;
    const c = claim.exec(t[1]); if (!c) continue;
    checked++;
    const id = m[1];
    if (!reg.has(id)) bad.push(page + ' ' + id + ': title claims ' + c[1] + ', no registry record (T2)');
    else if (reg.get(id) !== c[1]) bad.push(page + ' ' + id + ': title claims ' + c[1] + ', registry says ' + reg.get(id) + ' (T1)');
  }
}
for (const b of bad) console.log('  FAIL ' + b);
if (!checked) { console.log('FAIL no title claims an evidence class — the scan found nothing to check'); process.exit(1); }
console.log((bad.length ? 'FAIL' : 'PASS') + ' basis title evidence — ' + checked + ' claim(s) checked against ' + reg.size + ' records, ' + bad.length + ' wrong');
process.exit(bad.length ? 1 : 0);
