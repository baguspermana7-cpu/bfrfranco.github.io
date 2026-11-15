#!/usr/bin/env node
/**
 * test-audit-editorial-render.mjs — PRD-P22 fixture gate for the render-scale walker.
 *   E1 planted fixture: exactly 3 off-scale values (font 17.3 px, column-gap 7 px, radius 11 px), one per category
 *   E2 on-scale twin: 0 — and the skipped rows (display:none, visibility:hidden, SVG + foreignObject, icon font,
 *      iframe) are identical in both files, so they are proven skipped
 *   E3 data/design-scale.json is fresh against design.md
 *   E4 ratchet: a real page with ONE extra off-scale element measures exactly 1 more than the page itself
 *   E5 every published page is in the ratchet (a new page must be recorded, not silently passed)
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { measurePage, listPages, verdict } from './audit-editorial-render.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0, passes = 0;
const ok = (c, name, detail = '') => { if (c) { passes++; console.log('  PASS  ' + name + (detail ? ' — ' + detail : '')); } else { fails++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); } };
const url = (p) => pathToFileURL(join(ROOT, p)).href;

const { default: puppeteer } = await import('puppeteer');
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const REAL = 'privacy.html';   /* static: a live cockpit redraws between two renders */
const tmp = join(ROOT, 'rz-tmp-render-ratchet.html');
try {
  const a = await measurePage(browser, url('tools/fixtures/render-scale/planted.html'));
  ok(a.font === 1 && a.space === 1 && a.radius === 1, 'E1 planted fixture: exactly 3 off-scale values, one per category',
    `font ${a.font} space ${a.space} radius ${a.radius}; ${a.offenders.map(([k]) => k).join(' | ')}`);
  const b = await measurePage(browser, url('tools/fixtures/render-scale/onscale.html'));
  ok(b.font + b.space + b.radius === 0, 'E2 on-scale twin and the skipped rows report 0', JSON.stringify(b.offenders));

  let fresh = true;
  try { execFileSync('node', [join(ROOT, 'tools/build-design-scale.mjs'), '--check'], { stdio: 'pipe' }); } catch (e) { fresh = false; }
  ok(fresh, 'E3 data/design-scale.json is generated from design.md and fresh');

  const real = existsSync(join(ROOT, REAL)) ? REAL : listPages()[0];
  const src = readFileSync(join(ROOT, real), 'utf8');
  writeFileSync(tmp, src.replace(/<\/body>/i, '<div style="padding-left:7px">ratchet probe</div></body>'));
  const base = await measurePage(browser, url(real));
  const plus = await measurePage(browser, pathToFileURL(tmp).href);
  const nb = base.font + base.space + base.radius, np = plus.font + plus.space + plus.radius;
  ok(np === nb + 1, 'E4 one added off-scale element raises a real page by exactly 1 (' + real + ')', nb + ' -> ' + np);

  /* E6: a log page grows by design — the same off-scale rule twice more is no new kind; a new rule is */
  writeFileSync(tmp, src.replace(/<\/body>/i, '<div style="padding-left:7px">a</div><div style="padding-left:7px">b</div><div style="padding-left:7px">c</div></body>'));
  const dup = await measurePage(browser, pathToFileURL(tmp).href);
  ok(dup.kinds === plus.kinds && plus.kinds === base.kinds + 1 && dup.font + dup.space + dup.radius === nb + 3,
    'E6 kinds: one new off-scale rule = +1 kind; the same rule repeated = +0 kinds, +3 total', `kinds ${base.kinds} -> ${plus.kinds} -> ${dup.kinds}`);
  const vRepeat = verdict({ mode: 'kinds', kinds: plus.kinds, total: np }, dup);
  const vNew = verdict({ mode: 'kinds', kinds: base.kinds, total: nb }, plus), vTotal = verdict({ total: np }, dup);
  ok(!vRepeat.rise && vNew.rise && vTotal.rise, 'E7 verdict: kinds-mode passes growth of a known rule, fails a new rule; total mode still fails growth',
    `repeat ${vRepeat.rise} new ${vNew.rise} total ${vTotal.rise}`);

  const RF = join(ROOT, 'tools/editorial-render-ratchet.json');
  const ratchet = existsSync(RF) ? JSON.parse(readFileSync(RF, 'utf8')) : { pages: {} };
  const missing = listPages().filter((p) => !ratchet.pages[p]);
  ok(!missing.length, 'E5 every published page (' + listPages().length + ') is in the ratchet', missing.slice(0, 5).join(', '));
} finally {
  await browser.close();
  try { unlinkSync(tmp); } catch (e) { /* not written */ }
}
console.log(`\nrender scale fixture: ${passes} pass, ${fails} fail`);
process.exit(fails ? 1 : 0);
