#!/usr/bin/env node
/* ============================================================================
 * audit-hero-images.mjs — ship-gate: any calculator page carrying a hero image
 * (marked img.brief-hero-img or img[data-rz-hero]) MUST load js/rz-hero-fit.js,
 * which wraps it in the blur-letterbox (fixed aspect, object-fit:contain, blurred
 * side-fill). A hero img without it stretches/distorts (the bug this prevents).
 *
 * Usage:  node tools/audit-hero-images.mjs [--strict]
 * ==========================================================================*/
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');
const SKIP = /^(404|rz-ops-|google[0-9a-f]+\.html|changelog\.html)/i;

const files = readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.test(f)).sort();
const RE_HERO = /class=["'][^"']*\bbrief-hero-img\b|<img\b[^>]*\bdata-rz-hero\b/;
const RE_FIT  = /rz-hero-fit\.js/;

const offenders = [];
let heroed = 0;
for (const f of files) {
  const html = readFileSync(join(ROOT, f), 'utf8');
  if (!RE_HERO.test(html)) continue;
  heroed++;
  if (!RE_FIT.test(html)) offenders.push(f);
}

console.log('================================================================');
console.log(`Hero-image audit — ${files.length} pages scanned, ${heroed} carry a hero image`);
if (!offenders.length) {
  console.log('CLEAN — every hero-image page loads js/rz-hero-fit.js (blur-letterbox)');
  process.exit(0);
}
console.log(`\n${offenders.length} OFFENDER(S) — hero image without rz-hero-fit.js (will stretch/distort):`);
for (const o of offenders) console.log(`  ✖ ${o}`);
console.log('\nFix: add <script src="js/rz-hero-fit.js?v=…" defer></script> and mark the hero <img> with class brief-hero-img or data-rz-hero.');
process.exit(STRICT ? 1 : 0);
