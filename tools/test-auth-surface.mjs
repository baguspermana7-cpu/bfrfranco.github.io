#!/usr/bin/env node
/**
 * test-auth-surface — the shared login button, dropdown and modal (auth.js) follow the design system,
 * and the retired plaintext "manual accounts" path stays retired.
 *
 * WHY THIS EXISTS
 *
 * auth.js injects its own stylesheet from a JS string array. tools/audit-vibecode.mjs reads static CSS
 * files and <style> elements only, and says so ("runtime JS CSS ... require separate review"), so the one
 * dialog loaded on 154 pages carried 16px radii, two-stop gradients, hover lifts, resting drop shadows and
 * a blurred dropdown for months with every gate green. This gate reads the SAME array the browser gets
 * (evaluated, not regex-scraped) and checks every rule, hover states included.
 *
 * Rules (ANTI_VIBECODE_STANDARD §A 10-12, 23-24; documentation/design.md):
 *   A1 border-radius <= 4px (50% for a circle is allowed)
 *   A2 no gradient backgrounds
 *   A3 no box-shadow (the design system reserves shadow for focus; focus here uses an outline)
 *   A4 no transform on :hover (no lift)
 *   A5 no `transition: all`
 *   A6 no backdrop-filter except on the modal OVERLAY (blur on the dim layer only)
 *   S1 auth.js never accepts or reads rz_manual_accounts, and deletes the legacy key
 *   S2 the admin page never writes rz_manual_accounts
 *
 * Proven RED on v3.18.5 (e391883d): A1 x11, A2 x7, A3 x6, A4 x2, A5 x6, A6 x1, S1 x2, S2 x1 — 36 findings.
 *
 * Run: node tools/test-auth-surface.mjs
 */
import { readFileSync } from 'node:fs';

const fails = [];
const src = readFileSync('auth.js', 'utf8');

const m = src.match(/style\.textContent\s*=\s*(\[[\s\S]*?\])\.join\(/);
if (!m) {
  console.error('FAIL  could not locate the injected stylesheet array in auth.js');
  process.exit(1);
}
const css = Function('"use strict";return ' + m[1])().join('\n');

const rules = [];
const re = /([^{}@]+)\{([^{}]*)\}/g;
let r;
while ((r = re.exec(css))) rules.push({ sel: r[1].trim(), body: r[2] });
if (rules.length < 40) fails.push(`parsed only ${rules.length} rules — parser drifted`);

for (const { sel, body } of rules) {
  const decl = (prop) => {
    const d = body.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)', 'i'));
    return d ? d[1].trim() : null;
  };
  const radius = decl('border-radius');
  if (radius && radius !== '50%') {
    const px = Math.max(...radius.split(/\s+/).map((v) => parseFloat(v) || 0));
    if (px > 4) fails.push(`A1 ${sel}: border-radius ${radius}`);
  }
  if (/gradient\(/i.test(body)) fails.push(`A2 ${sel}: gradient background`);
  const shadow = decl('box-shadow');
  if (shadow && shadow !== 'none') fails.push(`A3 ${sel}: box-shadow ${shadow}`);
  const tf = decl('transform');
  if (/:hover/.test(sel) && tf && tf !== 'none') fails.push(`A4 ${sel}: hover transform ${tf}`);
  const tr = decl('transition');
  if (tr && /(^|,|\s)all(\s|$|,)/.test(tr)) fails.push(`A5 ${sel}: transition ${tr}`);
  if (/backdrop-filter/i.test(body) && sel !== '.rz-modal-overlay') fails.push(`A6 ${sel}: backdrop-filter off the dim layer`);
}

if (/getItem\(\s*['"]rz_manual_accounts/.test(src)) fails.push('S1 auth.js still reads rz_manual_accounts');
if (!/removeItem\(\s*['"]rz_manual_accounts/.test(src)) fails.push('S1 auth.js does not delete the legacy rz_manual_accounts key');
const admin = readFileSync('rz-ops-p7x3k9m.html', 'utf8');
if (/setItem\(\s*['"]rz_manual_accounts/.test(admin)) fails.push('S2 admin page still writes rz_manual_accounts (plaintext passwords)');

if (fails.length) {
  for (const f of fails) console.log('  FAIL  ' + f);
  console.log(`[auth-surface] ${fails.length} finding(s) across ${rules.length} rules`);
  process.exit(1);
}
console.log(`[auth-surface] PASS — ${rules.length} injected rules on the design system; manual-account plaintext path retired`);
