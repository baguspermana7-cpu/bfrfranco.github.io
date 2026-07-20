#!/usr/bin/env node
/* ============================================================================
 * audit-page-gates.mjs — ship-gate: every page that carries the tier access-gate
 * UI (the #rootGate / .root-gate modal or a fail-closed <body class="locked">)
 * MUST also invoke the gate (enforceTierFeatureAccess) AND wire the #rootLoginBtn
 * Sign-In button. A page with the gate markup but no enforcement stays PERMANENTLY
 * locked for everyone (incl. root) with a dead Sign-In button — the exact bug this
 * gate exists to prevent (standards-ltc-lab / ltc-system-modelling-lab, v1.99.x).
 *
 * Usage:  node tools/audit-page-gates.mjs [--strict]
 * --strict → exit 1 if any offender is found (for CI / ship suite).
 * ==========================================================================*/
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');

// Root-level pages only (mirrors the other audits). Skip non-content / generated.
const SKIP = /^(404|rz-ops-|google[0-9a-f]+\.html|changelog\.html)/i;

const files = readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.test(f)).sort();

const RE_GATE_MARKUP = /id=["']rootGate["']|class=["'][^"']*\broot-gate\b/;
const RE_BODY_LOCKED = /<body[^>]*class=["'][^"']*\blocked\b/i;
const RE_ENFORCE     = /enforceTierFeatureAccess\s*\(/;
const RE_BTN_WIRE    = /getElementById\(\s*["']rootLoginBtn["']\s*\)[\s\S]{0,160}addEventListener/;

const offenders = [];
for (const f of files) {
  const html = readFileSync(join(ROOT, f), 'utf8');
  const hasGate = RE_GATE_MARKUP.test(html) || RE_BODY_LOCKED.test(html);
  if (!hasGate) continue;
  const missing = [];
  if (!RE_ENFORCE.test(html))  missing.push('enforceTierFeatureAccess() call');
  if (!RE_BTN_WIRE.test(html)) missing.push('#rootLoginBtn click handler');
  if (missing.length) offenders.push({ f, missing });
}

const gated = files.filter(f => {
  const html = readFileSync(join(ROOT, f), 'utf8');
  return RE_GATE_MARKUP.test(html) || RE_BODY_LOCKED.test(html);
}).length;

console.log('================================================================');
console.log(`Page-gate audit — ${files.length} pages scanned, ${gated} carry the access-gate UI`);
if (!offenders.length) {
  console.log('CLEAN — every gated page invokes enforceTierFeatureAccess() + wires #rootLoginBtn');
  process.exit(0);
}
console.log(`\n${offenders.length} OFFENDER(S) — gate UI present but enforcement missing (page stays locked for everyone):`);
for (const o of offenders) console.log(`  ✖ ${o.f} — missing: ${o.missing.join(', ')}`);
console.log('\nFix: add the Tier-Feature Gate inline <script> (see ltc-ashrae-thermal-control.html) with the correct pageKey.');
process.exit(STRICT ? 1 : 0);
