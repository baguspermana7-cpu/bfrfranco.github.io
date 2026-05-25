#!/usr/bin/env node
/* v1.42.0 — Semantic line model probe for the cockpit pages.
   Source: Documents/screenshot bms rz/dc ai/review/27-deep-rereview-2026-05-24-uiux-engineering.md §3.1
         + Documents/screenshot bms rz/dc ai/review/28-screen-by-screen-action-list-2026-05-24.md
         + Documents/screenshot bms rz/conv/review/17-deep-rereview-2026-05-24-uiux-engineering.md
         + Documents/screenshot bms rz/conv/review/18-screen-by-screen-action-list-2026-05-24.md
   Codified: standarization/LINE_MODEL.md (line metadata schema + adoption table).

   Verifies window.RZLineModel.audit() output:
     - tagged ≥ ADOPTION_TARGETS[page]
     - every tagged line has from / to / medium / state
     - mediums + states reference the schema (no unknown values)

   Usage:
       python3 -m http.server 8081   # in another shell
       node tools/probe-line-model.mjs
       RZ_BASE=file node tools/probe-line-model.mjs

   Exit code 0 = PASS, 1 = FAIL.
*/
import puppeteer from 'puppeteer';
import path from 'node:path';

const BASE = (process.env.RZ_BASE === 'file')
  ? 'file://' + path.resolve(process.cwd())
  : (process.env.RZ_BASE || 'http://127.0.0.1:8081');

/* Adoption schedule per ship — bump as v1.42.x → v1.45.x ports more lines.
 * v1.42.0 pilot: 7 lines in datahallAI Cooling P&ID.
 * v1.42.1: +25 lines in datahallAI Electrical SLD overview.
 * v1.42.2: +80 lines in drawDH() L0+L1 sections × 4 halls. */
const ADOPTION_TARGETS = {
  'datahallAI.html': 112,
  'dc-conventional.html': 0  /* port arrives in v1.42.4 */
};

/* Breaker symbol library — verify pilot ports tagged. */
const BREAKER_TARGETS = {
  'datahallAI.html': 36,  /* 4 elecOv + 20 L0 + 12 L1 across 4 DH SLDs */
  'dc-conventional.html': 0
};

let pass = 0, fail = 0;
const failures = [];

function assert(cond, label, detail) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; failures.push({label, detail}); console.log(`  ✗ ${label}${detail?'\n     '+detail:''}`); }
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

for (const slug of Object.keys(ADOPTION_TARGETS)) {
  const target = ADOPTION_TARGETS[slug];
  console.log(`\n=== Line-model probe (${slug}) ===`);
  const page = await browser.newPage();
  await page.goto(`${BASE}/${slug}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const report = await page.evaluate(() => {
    if (!window.RZLineModel) {
      return { error: 'RZLineModel-missing' };
    }
    return window.RZLineModel.audit(document);
  });

  if (report.error === 'RZLineModel-missing') {
    if (target === 0) {
      console.log('  · RZLineModel not yet loaded on this page (expected for v1.42.0 pilot scope).');
    } else {
      assert(false, `${slug}: RZLineModel loaded`, 'window.RZLineModel undefined');
    }
    await page.close();
    continue;
  }

  assert(report.tagged >= target,
         `${slug}: tagged-line count ≥ ${target}`,
         `got ${report.tagged} (untagged ${report.untagged}, coverage ${report.coverage}%)`);

  const fieldIssues = report.issues.filter(i => i.kind === 'missing-field');
  assert(fieldIssues.length === 0,
         `${slug}: every tagged line has from / to / medium / state`,
         fieldIssues.length ? JSON.stringify(fieldIssues.slice(0, 5)) : '');

  const mediumIssues = report.issues.filter(i => i.kind === 'unknown-medium');
  assert(mediumIssues.length === 0,
         `${slug}: all mediums are in RZLineModel.MEDIUMS`,
         mediumIssues.length ? JSON.stringify(mediumIssues) : '');

  const stateIssues = report.issues.filter(i => i.kind === 'unknown-state');
  assert(stateIssues.length === 0,
         `${slug}: all states are in RZLineModel.STATES`,
         stateIssues.length ? JSON.stringify(stateIssues) : '');

  console.log(`  · summary: ${report.tagged} tagged / ${report.total} total lines (${report.coverage}% adoption)`);

  /* v1.42.1: breaker symbol coverage */
  const brTarget = BREAKER_TARGETS[slug] || 0;
  if (brTarget > 0) {
    const brReport = await page.evaluate(() => {
      if (!window.RZBreakerSymbols) return { error: 'RZBreakerSymbols-missing' };
      return window.RZBreakerSymbols.audit(document);
    });
    if (brReport.error) {
      assert(false, `${slug}: RZBreakerSymbols loaded`, brReport.error);
    } else {
      assert(brReport.tagged >= brTarget,
             `${slug}: breaker-tag count ≥ ${brTarget}`,
             `got ${brReport.tagged}`);
      const brFieldIssues = brReport.issues.filter(i => i.kind === 'missing-field');
      assert(brFieldIssues.length === 0,
             `${slug}: every tagged breaker has id + state`,
             brFieldIssues.length ? JSON.stringify(brFieldIssues.slice(0,5)) : '');
      const brStateIssues = brReport.issues.filter(i => i.kind === 'unknown-state');
      assert(brStateIssues.length === 0,
             `${slug}: all breaker states are in RZBreakerSymbols.STATES`,
             brStateIssues.length ? JSON.stringify(brStateIssues) : '');
      console.log(`  · breaker summary: ${brReport.tagged} tagged breakers`);
    }
  }
  await page.close();
}

await browser.close();

console.log(`\n=== Result: ${pass} pass, ${fail} fail ===`);
if (fail > 0) {
  console.log('Failures:');
  failures.forEach(f => console.log(`  - ${f.label}${f.detail ? ' :: ' + f.detail : ''}`));
  process.exit(1);
}
process.exit(0);
