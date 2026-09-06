#!/usr/bin/env node
/**
 * Ship gate — datahallAI.html carries NO number from the retired GB200 basis.
 *
 * WHY THIS GATE EXISTS
 * --------------------
 * The GB200 basis (4 halls x 27 NVL72 x 132 kW = 14.256 MW, 54 racks/hall at 66 kW, 7,776 GPUs,
 * CDU 9/12 x 350 kW, UPS 4.5 MW, 5 MVA, 6300 A, 8 x Cat 3516E 2.75 MW, PUE 1.30) lived on the
 * page in FOUR forms, measured 2026-09-06: 204 `DHE?…:'3,564'` fallback ternaries, static HTML
 * and <head> metadata, hardcoded tooltip / PDF / FAQ prose, and SVG labels. A binding that
 * silently fell back to one of those numbers rendered a plausible RETIRED constant — the exact
 * failure memory `feedback_binding_gate_blind_to_scope` records. After the switch to the GB300
 * engine (js/dcai-engine.js), every one of these strings is a lie the page could still tell.
 *
 * The gate is a denylist of NUMERALS, not words: "GB200" may legitimately appear in the
 * retirement note and the reference-study selector. The numerals may not appear anywhere in the
 * live page source except inside a <!-- retired-basis --> ... <!-- /retired-basis --> block,
 * which is the one place the page is allowed to describe what it used to say.
 *
 * Proven RED against the pre-switch page (v1.136.0): 300+ hits. Must be GREEN to ship v2.0.0.
 *
 * Run: node tools/test-datahall-ai-no-retired-literals.mjs [--list]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PAGE = 'datahallAI.html';
const LIST = process.argv.includes('--list');

/* Each entry: [label, regex]. Word boundaries and unit context keep the list from matching
   unrelated numbers (a "12" alone is not a finding; "12 installed" is). */
export const RETIRED = [
  ['3,564 kW/hall',            /\b3,?564\b/g],
  ['14.256 / 14,256 / 14.26 MW', /\b14[.,]2(?:56|6)\b/g],
  ['7,776 GPUs',               /\b7,?776\b/g],
  ['1,944 GPU/hall',           /\b1,?944\b/g],
  ['54 racks / positions',     /\b54\s*(?:racks?|rack-pos|positions?|physical)/gi],
  ['27 NVL72 domains',         /\b27\s*(?:×|x|NVL72|logical|domains?)/gi],
  ['108 NVL72 domains',        /\b108\s*(?:NVL72|domains?|\(54)/gi],
  ['132 kW per NVL72',         /\b132\s*kW/gi],
  ['66 kW per position',       /\b66\s*kW/gi],
  ['NVL36 split rack',         /NVL36/g],
  ['3,029 kW liquid',          /\b3,?029\b/g],
  ['535 kW air',               /\b535\s*kW/gi],
  ['4,638 kW facility/hall',   /\b4,?638\b/g],
  ['1,074 kW non-IT',          /\b1,?074\b/g],
  ['4,342 LPM TCS',            /\b4,?342\b/g],
  ['CDU 350 kW',               /\b350\s*kW/gi],
  ['CDU 9 run / 12 installed', /\b(?:9\s*run|12\s*installed|cduInstalled\s*:\s*12\b|:\s*12\)?\s*\/\/\s*doc-21)/gi],
  ['UPS 4.5 MW / 4,500 kW',    /\b4[.,]5(?:00)?\s*(?:MW|kW)/gi],
  ['Transformer 5 MVA',        /\b5\s*MVA\b/gi],
  ['Busway 6300 A',            /\b6,?300\s*A\b|\b6300\b/g],
  ['Cat 3516E',                /3516E/g],
  ['Genset 2,750 kW / 2.75 MW', /\b2,?750\s*kW|\b2\.75\s*MW/gi],
  ['PUE 1.30 (GB200 result)',  /(?:PUE|pue)[^\n]{0,24}\b1\.30\b|\b1\.30\b[^\n]{0,12}(?:PUE|pue)/g],
  ['COP 6.8 nameplate',        /\bCOP\s*(?:=|of|:)?\s*6\.8\b|\b6\.8\s*(?:COP|nameplate)/gi],
  ['32 m x 20 m hall',         /\b32\s*m?\s*[×x]\s*20\s*m?\b/gi],
  ['2,688 m3 hall volume',     /\b2,?688\b/g],
  ['spec review-2026-05-17',   /review-2026-05-17/g],
  ['asset 1.20.0 pin',         /\b1\.20\.0\b/g],
  ['Scenario A / B labels',    /Scenario\s+[AB]\b/g],
  ['rack-pos vocabulary',      /rack-pos\b/g],
];

const raw = readFileSync(join(ROOT, PAGE), 'utf8');
/* the one sanctioned place for the old numbers */
const text = raw.replace(/<!--\s*retired-basis\s*-->[\s\S]*?<!--\s*\/retired-basis\s*-->/g, (m) => ' '.repeat(m.length));

const lineOf = (idx) => text.slice(0, idx).split('\n').length;
let total = 0;
const rows = [];
for (const [label, re] of RETIRED) {
  const hits = [...text.matchAll(re)];
  if (!hits.length) continue;
  total += hits.length;
  const lines = [...new Set(hits.map((h) => lineOf(h.index)))];
  rows.push({ label, count: hits.length, lines });
}

console.log(`── RETIRED-BASIS LITERALS on ${PAGE} ──`);
for (const r of rows) {
  const shown = r.lines.slice(0, LIST ? r.lines.length : 6).join(', ');
  console.log(`  ✗ ${r.label}: ${r.count} hit(s) — lines ${shown}${!LIST && r.lines.length > 6 ? ' …' : ''}`);
}
if (total) {
  console.log(`── ${total} retired GB200 numeral(s) still on the page. Every one is a value the GB300 engine no longer produces.`);
  process.exit(1);
}
console.log('CLEAN — the page states no number from the retired basis.');
