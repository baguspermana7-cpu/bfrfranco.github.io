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
 * v1.42.2: +80 lines in drawDH() L0+L1 sections × 4 halls.
 * v1.42.3: +59 lines in netSvg (32 spine-leaf + 27 domain-leaf).
 * v1.42.4: cross-page — chiller-plant.html CHW P&ID (16 branch + 2 header = 18).
 *          EPMS_Telemetry.html intentionally untouched (owner: "jangan merusak").
 * v1.42.5: water-system.html (10 pipes) + fire-system.html (14 pipes). */
const ADOPTION_TARGETS = {
  'datahallAI.html': 171,
  'dc-conventional.html': 0,
  'chiller-plant.html': 18,
  'water-system.html': 10,
  'fire-system.html': 14
};

/* Breaker symbol library — verify pilot ports tagged. */
const BREAKER_TARGETS = {
  'datahallAI.html': 36,  /* 4 elecOv + 20 L0 + 12 L1 across 4 DH SLDs */
  'dc-conventional.html': 0,
  'chiller-plant.html': 0,  /* P&ID has no breakers */
  'water-system.html': 0,
  'fire-system.html': 0
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
  /* Use 'load' for pages without long-polling telemetry; networkidle2 can
   * hang on pages with setInterval-driven flow animations. */
  await page.goto(`${BASE}/${slug}`, { waitUntil: 'load', timeout: 30000 });
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

  /* v1.43.0 + v1.43.1: inspector availability on every tagged cockpit page. */
  const INSPECTOR_PAGES = new Set([
    'datahallAI.html',
    'chiller-plant.html',
    'water-system.html',
    'fire-system.html'
  ]);
  if (INSPECTOR_PAGES.has(slug)) {
    const insp = await page.evaluate(() => ({
      lib: !!window.RZInspector,
      shellInjected: !!document.querySelector('[data-rz-inspector="1"]')
    }));
    assert(insp.lib, `${slug}: window.RZInspector exposed`,
           'rz-inspector.js did not register');
    /* Trigger a click on a tagged line to verify the inspector opens. */
    const opened = await page.evaluate(() => {
      const target = document.querySelector('[data-rz-line="1"]');
      if (!target) return false;
      try { target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
      catch (e) { return false; }
      return !!document.querySelector('.rz-inspector.open');
    });
    assert(opened, `${slug}: clicking [data-rz-line] opens inspector`,
           'inspector did not open after synthetic click');

    /* v1.43.2: data-quality service — page mode + banner + lib availability. */
    const tq = await page.evaluate(() => {
      const out = {
        lib: !!window.RZTelemetryQuality,
        mode: document.body && document.body.getAttribute('data-rz-data-mode'),
        bannerInjected: !!document.querySelector('[data-rz-tq-banner]')
      };
      if (window.RZTelemetryQuality) {
        try { out.audit = window.RZTelemetryQuality.audit(document); }
        catch (e) { out.audit = { error: e.message }; }
      }
      return out;
    });
    assert(tq.lib, `${slug}: window.RZTelemetryQuality exposed`,
           'rz-telemetry-quality.js did not register');
    assert(tq.mode === 'simulated',
           `${slug}: body data-rz-data-mode = 'simulated'`,
           `got '${tq.mode}'`);
    assert(tq.bannerInjected,
           `${slug}: simulated-mode banner rendered`,
           'no .rz-tq-banner element found');
  }

  /* v1.43.3: headline KPI source+formula+timestamp tooltips (review §3.4 P0).
   * datahallAI #p-dash only. */
  if (slug === 'datahallAI.html') {
    /* updateDashKPI runs on load + every 4s; give it one tick. */
    await new Promise(r => setTimeout(r, 600));
    const tips = await page.evaluate(() => {
      const ids = ['dkPue', 'dkWue', 'dkCue', 'dkIt', 'dkGpu', 'dkDom', 'dkCdu'];
      const out = {};
      ids.forEach(id => {
        const el = document.getElementById(id);
        out[id] = el ? (el.getAttribute('title') || '') : null;
      });
      return out;
    });
    const allTipped = Object.keys(tips).every(id =>
      tips[id] && /Source:/.test(tips[id]) && /Updated:/.test(tips[id]));
    assert(allTipped,
           `${slug}: headline KPIs carry source+formula+timestamp tooltips`,
           JSON.stringify(tips));
  }

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
