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
  /* Allow: "NVL72 rack-scale" (NVIDIA term), "NVL72 rack-pos", "NVL72 racks"
     Block: bare "NVL72 rack" used as singular noun without disambiguation. */
  const ambiguous66 = /\b66\s*kW.{0,12}NVL72\s+rack\b(?!-)/i.test(html);
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

  /* ---- Test 7: Basis drawer opens on PUE click ----
     Use DOM-API click (card.click()) not puppeteer's coordinate click —
     more reliable for headless testing where viewport scroll matters. */
  await page.evaluate(() => {
    const card = document.querySelector('.k[data-basis="pue"]');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 500));
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

  /* ---- Test 8: Basis drawer on conv (DOM-API click for headless reliability) ---- */
  await page.evaluate(() => {
    const card = document.querySelector('.kpi-card[data-basis="grid"]');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 500));
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

/* ========================================================================
 * TECH SPEC PDF GENERATION (v1.36.2 — Generate Design button verification).
 * Intercept window.open + document.write to capture the print-window HTML;
 * assert it carries the engine-bound values + section headers. Catches
 * silent engine-binding regressions on a feature shipped in v1.30.1.
 * ====================================================================== */
console.log('\n=== Generate Design Tech Spec PDF probes ===');
{
  async function captureTechSpec(url, triggerSel) {
    const page = await browser.newPage();
    await page.goto(`${BASE}/${url}`, {waitUntil:'domcontentloaded', timeout:30000});
    await new Promise(r => setTimeout(r, 1500));
    /* Intercept window.open + .document.write before clicking */
    await page.evaluate(() => {
      window.__capturedTechSpec = null;
      window.open = function() {
        const fakeDoc = { contents:'', open(){this.contents=''}, write(s){this.contents += s;}, close(){window.__capturedTechSpec = this.contents;} };
        return { document: fakeDoc, focus(){}, print(){} };
      };
    });
    await page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (btn) btn.click();
    }, triggerSel);
    /* v1.130+ uses the shared Design Studio: the toolbar trigger opens a
       configuration dialog, then the explicit Generate document action owns
       the export. Keep compatibility with older direct-export buttons. */
    await page.waitForFunction(() => (
      window.__capturedTechSpec !== null
      || document.querySelector('#rzDesignStudio[data-open="true"] .rz-design-studio__button--primary')
    ), { timeout: 5000 });
    await page.evaluate(() => {
      if (window.__capturedTechSpec !== null) return;
      const generate = document.querySelector(
        '#rzDesignStudio[data-open="true"] .rz-design-studio__button--primary'
      );
      if (generate) generate.click();
    });
    await new Promise(r => setTimeout(r, 800));
    const html = await page.evaluate(() => window.__capturedTechSpec);
    await page.close();
    return html;
  }

  /* --- DC AI Generate Design --- */
  const dcAiPdf = await captureTechSpec('datahallAI.html', '#genDesignTrig');
  const okAi = dcAiPdf && dcAiPdf.length > 5000;
  assert(okAi, `TS-AI-1: Generate Design returns non-trivial HTML (~${dcAiPdf?.length||0} chars)`, '');
  if (okAi) {
    assert(/AI Data Centre|AI Data Hall/i.test(dcAiPdf), 'TS-AI-2: PDF title carries facility name', '');
    assert(/Scenario\s*A/i.test(dcAiPdf), 'TS-AI-3: PDF cites Scenario A locked', '');
    assert(/Cover|Table of Contents|Executive Summary/i.test(dcAiPdf), 'TS-AI-4: PDF has cover / TOC / executive-summary structure', '');
    assert(/14[.,]?2[56]/.test(dcAiPdf), 'TS-AI-5: PDF carries engine value 14.26 MW (IT facility)', '');
    assert(/132\s*kW.*NVL72|NVL72.*132/i.test(dcAiPdf), 'TS-AI-6: PDF carries 132 kW per NVL72 basis', '');
    assert(/7[,.]?776/.test(dcAiPdf), 'TS-AI-7: PDF carries GPU count 7,776', '');
    assert(/ASHRAE|NFPA|NVIDIA/i.test(dcAiPdf), 'TS-AI-8: PDF references standards (ASHRAE/NFPA/NVIDIA)', '');
    assert(/Cost Annex|CAPEX|OPEX/i.test(dcAiPdf), 'TS-AI-9: PDF includes Cost Annex (Section 10)', '');
    assert(/Appendix A|Formula Derivations/i.test(dcAiPdf), 'TS-AI-10: PDF includes Appendix A formula derivations', '');
  }

  /* --- DC AI Basis of Design (older PDF, separate code path) ---
     Flow: click #bodTrig to open the in-page drawer, wait for it to
     render, then click #bodDrawerPdf inside the drawer. */
  const bodPage = await browser.newPage();
  await bodPage.goto(`${BASE}/datahallAI.html`, {waitUntil:'domcontentloaded', timeout:30000});
  await new Promise(r => setTimeout(r, 1500));
  await bodPage.evaluate(() => {
    window.__capturedBod = null;
    window.open = function() {
      const fakeDoc = { contents:'', open(){this.contents=''}, write(s){this.contents += s}, close(){window.__capturedBod = this.contents} };
      return { document: fakeDoc, focus(){}, print(){} };
    };
  });
  /* Open BoD drawer first (it lazy-builds content + binds the PDF button) */
  await bodPage.evaluate(() => {
    const btn = document.getElementById('bodTrig');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await bodPage.evaluate(() => {
    const btn = document.getElementById('bodDrawerPdf');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  const bodPdf = await bodPage.evaluate(() => window.__capturedBod);
  await bodPage.close();

  const okBod = bodPdf && bodPdf.length > 5000;
  assert(okBod, `BoD-AI-1: BoD Export PDF returns non-trivial HTML (~${bodPdf?.length||0} chars)`, '');
  if (okBod) {
    assert(/Basis of Design|BoD/i.test(bodPdf), 'BoD-AI-2: PDF title cites "Basis of Design"', '');
    assert(/14[.,]?2[56]|3[.,]?564/.test(bodPdf), 'BoD-AI-3: PDF carries engine values (14.26 MW or 3,564 kW)', '');
    assert(/1\.30|PUE.*1\.3/.test(bodPdf), 'BoD-AI-4: PDF carries PUE 1.30', '');
    assert(/132\s*kW/i.test(bodPdf), 'BoD-AI-5: PDF carries 132 kW per NVL72 basis', '');
    assert(/Scenario\s*A/i.test(bodPdf), 'BoD-AI-6: PDF cites Scenario A locked', '');
    assert(/COP\s*6\.8|COP.*=.*6\.8/.test(bodPdf), 'BoD-AI-7: PDF cites chiller nameplate COP 6.8', '');
  }

  /* --- DC Conv Generate Design --- */
  const dcConvPdf = await captureTechSpec('dc-conventional.html', '#genDesignTrigConv');
  const okConv = dcConvPdf && dcConvPdf.length > 5000;
  assert(okConv, `TS-CONV-1: Generate Design returns non-trivial HTML (~${dcConvPdf?.length||0} chars)`, '');
  if (okConv) {
    assert(/Conventional Data Centre/i.test(dcConvPdf), 'TS-CONV-2: PDF title carries facility name', '');
    assert(/1[,.]?850/.test(dcConvPdf), 'TS-CONV-3: PDF carries engine value 1,850 kW (IT)', '');
    assert(/1\.45/.test(dcConvPdf), 'TS-CONV-4: PDF carries PUE 1.45', '');
    assert(/Grid factor|grid_factor/i.test(dcConvPdf), 'TS-CONV-5: PDF uses "Grid factor" terminology (not CUE alone)', '');
    assert(/0\.6[01]\s*kg/i.test(dcConvPdf), 'TS-CONV-6: PDF derives CUE_IT 0.61 kg/kWh IT', '');
    assert(/58[.,]?[12]/.test(dcConvPdf), 'TS-CONV-7: PDF carries CHW flow 58.2 L/s', '');
    assert(/45[,.]?900/.test(dcConvPdf), 'TS-CONV-8: PDF carries fuel usable 45,900 L', '');
    assert(/CAPEX|OPEX|TCO/i.test(dcConvPdf), 'TS-CONV-9: PDF includes Cost Annex', '');
    assert(/ISO\/IEC 30134/i.test(dcConvPdf), 'TS-CONV-10: PDF cites ISO/IEC 30134 (CUE standard)', '');
  }
}

/* ========================================================================
 * FAQ DIALOG PROBES (v1.37.2 — regression-guard the FAQ_ITEMS ReferenceError
 * that v1.32.10 fixed. Click FAQ button, verify dialog opens with expected
 * Q/A count and no console errors.) The FAQ used to throw on page-parse for
 * ~3 weeks (v1.30.1 → v1.32.10) because FAQ_ITEMS referenced out-of-scope
 * vars at the IIFE top level. The fix moved the array inside openFaqDialog
 * with defensive lookups — this probe ensures that fix doesn't silently
 * regress.
 * ====================================================================== */
console.log('\n=== FAQ dialog probes ===');
{
  async function checkFaq(url, triggerSel, dialogSel, expectedMinQs) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(`${BASE}/${url}`, {waitUntil:'domcontentloaded', timeout:30000});
    await new Promise(r => setTimeout(r, 1500));
    /* No page errors should have surfaced from the FAQ_ITEMS init */
    const initErrs = errs.filter(s => /sc is not defined|FAQ_ITEMS/.test(s));
    await page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (btn) btn.click();
    }, triggerSel);
    await new Promise(r => setTimeout(r, 500));
    const dlg = await page.evaluate((dlgSel) => {
      const d = document.querySelector(dlgSel);
      if (!d) return null;
      const txt = d.textContent;
      const detailsCount = d.querySelectorAll('details').length;
      return {
        present: true,
        detailsCount,
        hasInformational: /informational only|simulated|not a forecast/i.test(txt) || /not a feed from a physical/i.test(txt),
        chars: txt.length
      };
    }, dialogSel);
    const clickErrs = errs.filter(s => !/ipapi|CORS|fetch/i.test(s));
    await page.close();
    return {dlg, initErrs, clickErrs};
  }

  /* DC AI FAQ */
  const ai = await checkFaq('datahallAI.html', '#faqTrig', '#rzFaqDialog', 10);
  assert(ai.initErrs.length === 0, 'FAQ-AI-1: no page-error from FAQ_ITEMS init (regression-guard v1.32.10)', ai.initErrs.join(' | '));
  assert(ai.dlg?.present, 'FAQ-AI-2: FAQ dialog opens on click', '');
  assert((ai.dlg?.detailsCount||0) >= 10, `FAQ-AI-3: dialog has ≥10 Q/A pairs (got ${ai.dlg?.detailsCount})`, '');
  assert(ai.clickErrs.length === 0, 'FAQ-AI-4: no JS error from clicking FAQ', ai.clickErrs.join(' | '));

  /* DC Conv FAQ */
  const conv = await checkFaq('dc-conventional.html', '#faqTrigConv', '#rzFaqDialogConv', 10);
  assert(conv.initErrs.length === 0, 'FAQ-CONV-1: no page-error from FAQ init', conv.initErrs.join(' | '));
  assert(conv.dlg?.present, 'FAQ-CONV-2: FAQ dialog opens on click', '');
  assert((conv.dlg?.detailsCount||0) >= 10, `FAQ-CONV-3: dialog has ≥10 Q/A pairs (got ${conv.dlg?.detailsCount})`, '');
  assert(conv.clickErrs.length === 0, 'FAQ-CONV-4: no JS error from clicking FAQ', conv.clickErrs.join(' | '));
}

/* ========================================================================
 * CROSS-PAGE HEADLINE CONSISTENCY (v1.33.3 — reviewer's Rule 1 "one source
 * of truth" verified across all pages that display the metric). Conv-engine
 * pages share CONV_CALC.snapshot, so PUE/WUE/IT must reconcile identically.
 * ====================================================================== */
console.log('\n=== Cross-page headline consistency (Rule 1) ===');
{
  async function readId(url, ids) {
    const p = await browser.newPage();
    /* domcontentloaded — networkidle2 times out on file:// when third-party
       analytics (e.g. ipapi) block on CORS. We only need the DOM + engine. */
    await p.goto(`${BASE}/${url}`, {waitUntil:'domcontentloaded', timeout:30000});
    await new Promise(r => setTimeout(r, 2000));
    const out = await p.evaluate((ids) => {
      const r = {};
      for (const id of ids) {
        const el = document.getElementById(id);
        r[id] = el ? el.textContent.trim() : null;
      }
      return r;
    }, ids);
    await p.close();
    return out;
  }

  /* PUE consistency on CONV-engine pages (dc-conventional + datahall) */
  const dcConv = await readId('dc-conventional.html', ['kpiPue','sPue','kpiWue','sWue','kpiIt']);
  const datahall = await readId('datahall.html', ['dh-pue','dh-rack-load']);
  const waterSys = await readId('water-system.html', ['kWue','status-wue']);

  /* PUE 1.45 across CONV pages */
  const pueValues = [dcConv.kpiPue, dcConv.sPue, datahall['dh-pue']];
  const pueAllSame = pueValues.every(v => v === '1.45');
  assert(pueAllSame, 'X-Test-1: PUE = 1.45 identical across dc-conv dashboard, dc-conv side panel, datahall ops-rollup', JSON.stringify({dcConv_kpi:dcConv.kpiPue, dcConv_side:dcConv.sPue, datahall:datahall['dh-pue']}));

  /* WUE 1.20 across CONV pages that display WUE */
  const wueDashboard = dcConv.kpiWue;       /* "1.20" */
  const wueSide = dcConv.sWue;              /* "1.20 L/kWh" — same numeric */
  const wueWater = waterSys.kWue;           /* "1.20" */
  const wueStatusBar = waterSys['status-wue']; /* "1.20 L/kWh" — same numeric */
  const wueOk = wueDashboard === '1.20'
              && /^1\.20/.test(wueSide||'')
              && wueWater === '1.20'
              && /^1\.20/.test(wueStatusBar||'');
  assert(wueOk, 'X-Test-2: WUE = 1.20 identical across dc-conv (2 surfaces) + water-system (2 surfaces)', JSON.stringify({dashboard:wueDashboard, side:wueSide, water:wueWater, statusBar:wueStatusBar}));

  /* IT load — dc-conv shows 1,850 kW; datahall shows 1.85 MW (same value, different unit) */
  const itDcConv = dcConv.kpiIt;                       /* "1,850" */
  const itDatahall = datahall['dh-rack-load'];         /* "1.85" */
  const itOk = itDcConv === '1,850' && itDatahall === '1.85';
  assert(itOk, 'X-Test-3: IT load reconciles — dc-conv "1,850 kW" = datahall "1.85 MW"', JSON.stringify({dcConv:itDcConv, datahall:itDatahall}));
}

/* ========================================================================
 * datahall.html OPS-ROLLUP BASIS DRAWERS (v1.33.2 — extends Rule 6 site-wide)
 * ====================================================================== */
console.log('\n=== datahall.html ops-rollup basis drawers ===');
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/datahall.html`, {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 1500));

  /* Test all 5 ops-rollup KPIs open a basis drawer */
  for (const id of ['state','rackload','margin','pue','density']) {
    await page.evaluate((i) => {
      const card = document.querySelector(`#dh-ops-rollup [data-basis="${i}"]`);
      if (card) card.click();
    }, id);
    await new Promise(r => setTimeout(r, 350));
    const drawerOk = await page.evaluate(() => {
      const dlg = document.getElementById('kpiBasisDrawer');
      if (!dlg) return null;
      const txt = dlg.textContent;
      return {
        hasFormula: txt.includes('Formula'),
        hasOutput: txt.includes('Output'),
        hasSource: txt.includes('Source'),
        hasMode: /DERIVED|BOD LOCKED|SIM SENSOR|DESIGN PLACEHOLDER/.test(txt)
      };
    });
    assert(drawerOk?.hasFormula && drawerOk?.hasOutput && drawerOk?.hasSource && drawerOk?.hasMode,
      `DH-Test-drawer-${id}: ops-rollup [${id}] drawer carries Formula/Output/Source/Mode`,
      drawerOk ? JSON.stringify(drawerOk) : 'drawer not created');
    /* Close before next */
    await page.evaluate(() => {
      const dlg = document.getElementById('kpiBasisDrawer');
      if (dlg) dlg.remove();
    });
  }

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
