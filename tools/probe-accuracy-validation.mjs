#!/usr/bin/env node
/* v1.32.9 — Accuracy validation probes for the team-review acceptance tests.
   Source: Documents/screenshot bms rz/dc ai/review/26-accuracy-validation-and-correction-list.md
         + Documents/screenshot bms rz/conv/review/16-accuracy-validation-and-correction-list.md
   Codified: standarization/ACCURACY_VALIDATION.md (6 rules + 7+8 acceptance tests).

   Runs against `http://127.0.0.1:8081/` (recommended — start with
   `python3 -m http.server 8081`) OR file:// (set RZ_BASE=file).

   Usage:
       node tools/probe-accuracy-validation.mjs
       RZ_BASE=file node tools/probe-accuracy-validation.mjs

   Exit code 0 = PASS, 1 = FAIL.
*/
import puppeteer from 'puppeteer';
import path from 'node:path';

const BASE = (process.env.RZ_BASE === 'file')
  ? 'file://' + path.resolve(process.cwd())
  : (process.env.RZ_BASE || 'http://127.0.0.1:8081');
const ROUND_TRIPS = 3;  /* reload N times to verify reload-20× determinism */

let pass = 0, fail = 0;
const failures = [];

function assert(cond, label, detail) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; failures.push({label, detail}); console.log(`  ✗ ${label}${detail?'\n     '+detail:''}`); }
}

const browser = await puppeteer.launch({headless:'new',args:['--no-sandbox']});

/* ========================================================================
 * DC AI ACCURACY TESTS (doc-26)
 * ====================================================================== */
console.log('\n=== DC AI accuracy probes (datahallAI.html) ===');
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/datahallAI.html`, {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 1200));  /* let engine + updateDashKPI settle */

  /* ---- Test 1: Headline consistency ---- */
  const kpis = await page.evaluate(() => ({
    pue: document.getElementById('dkPue')?.textContent,
    wue: document.getElementById('dkWue')?.textContent,
    cue: document.getElementById('dkCue')?.textContent,
    it: document.getElementById('dkIt')?.textContent,
    gpu: document.getElementById('dkGpu')?.textContent,
    dom: document.getElementById('dkDom')?.textContent,
    cdu: document.getElementById('dkCdu')?.textContent
  }));
  assert(kpis.pue === '1.30', 'AI-Test-1a: PUE = 1.30 derived', `got ${kpis.pue}`);
  assert(kpis.wue === '0.00', 'AI-Test-1b: WUE = 0.00 dry-only baseline', `got ${kpis.wue}`);
  assert(kpis.cue === '0.90', 'AI-Test-1c: CUE_IT = 0.90 (grid 0.69 × PUE 1.30)', `got ${kpis.cue}`);
  assert(kpis.it === '14.26', 'AI-Test-1d: IT Load = 14.26 MW (Scenario A locked)', `got ${kpis.it}`);
  assert(kpis.gpu === '7,776', 'AI-Test-1e: GPUs = 7,776', `got ${kpis.gpu}`);
  assert(kpis.dom === '108', 'AI-Test-1f: NVL72 domains = 108', `got ${kpis.dom}`);
  assert(/36\/48|36 \/ 48/.test(kpis.cdu||''), 'AI-Test-4: CDU count 36/48 facility', `got ${kpis.cdu}`);

  /* ---- Test 2: No random basis values (reload N times) ---- */
  const samples = [{pue:kpis.pue, it:kpis.it, wue:kpis.wue, cue:kpis.cue}];
  for (let i = 1; i < ROUND_TRIPS; i++) {
    await page.reload({waitUntil:'networkidle2', timeout:30000});
    await new Promise(r => setTimeout(r, 1200));
    samples.push(await page.evaluate(() => ({
      pue: document.getElementById('dkPue')?.textContent,
      it: document.getElementById('dkIt')?.textContent,
      wue: document.getElementById('dkWue')?.textContent,
      cue: document.getElementById('dkCue')?.textContent
    })));
  }
  const stable = samples.every(s => s.pue === samples[0].pue && s.it === samples[0].it && s.wue === samples[0].wue && s.cue === samples[0].cue);
  assert(stable, `AI-Test-2: basis KPIs identical across ${ROUND_TRIPS} reloads`, JSON.stringify(samples));

  /* ---- Test 3: Market terminology — no 'NVL72 rack' without disambiguation ---- */
  const html = await page.content();
  const ambiguous66 = /66\s*kW\s+NVL72|NVL72 rack(?!-pos|\s|s)/.test(html.replace(/<title>.*?<\/title>/, ''));
  assert(!ambiguous66, 'AI-Test-3a: no "66 kW NVL72 rack" ambiguity', '');
  const hasRackPos = html.includes('rack-pos') || html.includes('rack position');
  assert(hasRackPos, 'AI-Test-3b: "rack-pos" or "rack position" terminology present', '');

  /* ---- Test 5: Generator arithmetic ---- */
  const has40MW = /5\s*running.*=\s*40\s*MW/i.test(html);
  assert(!has40MW, 'AI-Test-5: no "5 running = 40 MW" arithmetic error', '');

  /* ---- Test 6: KPI colour grammar — PUE colour is NOT green (--g) ---- */
  const pueColor = await page.evaluate(() => {
    const el = document.getElementById('dkPue');
    if (!el) return null;
    return el.style.color || window.getComputedStyle(el).color;
  });
  /* var(--g) is the green token. cyan = var(--c). We expect cyan/informational. */
  const isNotGreen = !/var\(--g\)/.test(pueColor||'');
  assert(isNotGreen, `AI-Test-6: PUE colour is NOT green (informational neutral)`, `color=${pueColor}`);

  /* ---- Test 7: Basis drawer opens on PUE click ---- */
  await page.click('.k[data-basis="pue"]');
  await new Promise(r => setTimeout(r, 400));
  const drawerOk = await page.evaluate(() => {
    const dlg = document.getElementById('kpiBasisDrawer');
    if (!dlg) return null;
    const txt = dlg.textContent;
    return {
      hasFormula: txt.includes('Formula'),
      hasInputs: txt.includes('Inputs'),
      hasOutput: txt.includes('Output'),
      hasScope: txt.includes('Scope'),
      hasSource: txt.includes('Source'),
      hasLastUpdate: txt.includes('Last update'),
      hasMode: /DERIVED|BOD LOCKED|SIM SENSOR|DESIGN PLACEHOLDER/.test(txt)
    };
  });
  assert(drawerOk?.hasFormula, 'AI-Test-7a: drawer shows Formula', '');
  assert(drawerOk?.hasInputs, 'AI-Test-7b: drawer shows Inputs', '');
  assert(drawerOk?.hasOutput, 'AI-Test-7c: drawer shows Output', '');
  assert(drawerOk?.hasScope, 'AI-Test-7d: drawer shows Scope', '');
  assert(drawerOk?.hasSource, 'AI-Test-7e: drawer shows Source object', '');
  assert(drawerOk?.hasLastUpdate, 'AI-Test-7f: drawer shows Last update', '');
  assert(drawerOk?.hasMode, 'AI-Test-7g: drawer carries a data-mode chip', '');

  await page.close();
}

/* ========================================================================
 * DC CONV ACCURACY TESTS (doc-16)
 * ====================================================================== */
console.log('\n=== DC Conv accuracy probes (dc-conventional.html) ===');
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/dc-conventional.html`, {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 1200));

  /* ---- Test 1: Carbon metric denominator ---- */
  const html = await page.content();
  const hasGridFactor = /Grid factor/i.test(html);
  const oldCueLabel = /\bCUE\s*<\/[^>]+>\s*<[^>]*>0\.42/.test(html);
  assert(hasGridFactor, 'CONV-Test-1a: "Grid factor" label present', '');
  assert(!oldCueLabel, 'CONV-Test-1b: no bare "CUE 0.42" mislabel', '');

  /* ---- Test 2: Chiller loop label — no "CHWS SP 18.8" on the secondary control ---- */
  const hasOldChwsSp = /CHWS\s*SP\s*18\.8/i.test(html);
  const hasSecondaryLabel = /Secondary loop SP|Sec-loop SP/.test(html);
  assert(!hasOldChwsSp || hasSecondaryLabel, 'CONV-Test-2a: no bare "CHWS SP 18.8" without secondary-loop label', '');

  /* ---- Test 3: PUE reconciliation (1.45 in headline + side panel) ---- */
  const pueDash = await page.evaluate(() => document.getElementById('kpiPue')?.textContent);
  const pueSide = await page.evaluate(() => document.getElementById('sPue')?.textContent);
  assert(pueDash === '1.45', 'CONV-Test-3a: dashboard PUE = 1.45', `got ${pueDash}`);
  assert(pueSide === '1.45', 'CONV-Test-3b: side-panel PUE = 1.45', `got ${pueSide}`);

  /* ---- Test 4: WUE reconciliation ---- */
  const wue = await page.evaluate(() => document.getElementById('kpiWue')?.textContent);
  assert(wue === '1.20', 'CONV-Test-4: WUE = 1.20 L/kWh IT', `got ${wue}`);

  /* ---- Test 5: Fuel autonomy with explicit scope label ---- */
  const fuelScope = /48\s*hrs.*bulk[- ]tank/.test(html);
  assert(fuelScope, 'CONV-Test-5: fuel autonomy labelled "bulk-tank @ site load"', '');

  /* ---- Test 6: UPS 2N normal + failover both visible ---- */
  const ups = await page.evaluate(() => document.getElementById('sUpsA')?.textContent);
  const hasNrmFail = /nrm.*fail|fail.*nrm/.test(ups||'');
  assert(hasNrmFail, 'CONV-Test-6: UPS A shows normal + failover percentages', `got ${ups}`);

  /* ---- Test 7: Reload determinism ---- */
  const samples = [{pueDash, wue}];
  for (let i = 1; i < ROUND_TRIPS; i++) {
    await page.reload({waitUntil:'networkidle2', timeout:30000});
    await new Promise(r => setTimeout(r, 1200));
    samples.push(await page.evaluate(() => ({
      pueDash: document.getElementById('kpiPue')?.textContent,
      wue: document.getElementById('kpiWue')?.textContent
    })));
  }
  const stable = samples.every(s => s.pueDash === samples[0].pueDash && s.wue === samples[0].wue);
  assert(stable, `CONV-Test-7: dashboard basis KPIs identical across ${ROUND_TRIPS} reloads`, JSON.stringify(samples));

  /* ---- Test 8: Basis drawer on conv ---- */
  await page.click('.kpi-card[data-basis="grid"]');
  await new Promise(r => setTimeout(r, 400));
  const drawerOk = await page.evaluate(() => {
    const dlg = document.getElementById('kpiBasisDrawer');
    if (!dlg) return null;
    const txt = dlg.textContent;
    return {
      hasFormula: txt.includes('Formula'),
      hasSource: txt.includes('Source'),
      hasMode: /DERIVED|BOD LOCKED|SIM SENSOR|DESIGN PLACEHOLDER/.test(txt),
      hasCueIt: /CUE_IT|CUE\.IT/i.test(txt)
    };
  });
  assert(drawerOk?.hasFormula, 'CONV-Test-8a: Grid-factor drawer shows Formula', '');
  assert(drawerOk?.hasSource, 'CONV-Test-8b: drawer shows Source object', '');
  assert(drawerOk?.hasMode, 'CONV-Test-8c: drawer carries data-mode chip', '');
  assert(drawerOk?.hasCueIt, 'CONV-Test-8d: drawer explains CUE_IT relationship', '');

  await page.close();
}

await browser.close();

/* ======================================================================== */
console.log('\n' + '='.repeat(60));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log('='.repeat(60));
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.label}${f.detail?' :: '+f.detail:''}`);
  process.exit(1);
}
process.exit(0);
