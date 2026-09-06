#!/usr/bin/env node
/* v1.134.12 — Accuracy validation probes for the team-review acceptance tests.
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
import { readFile } from 'node:fs/promises';

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

function htmlText(html) {
  return String(html || '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&times;/gi, '×')
    .replace(/&divide;/gi, '÷')
    .replace(/&minus;/gi, '−')
    .replace(/&mdash;/gi, '—')
    .replace(/&middot;/gi, '·')
    .replace(/&deg;/gi, '°')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function rawElementText(html, id) {
  const safeId = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(html || '').match(new RegExp(
    `<([a-z][\\w:-]*)\\b[^>]*\\bid=["']${safeId}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i'
  ));
  return match ? htmlText(match[2]) : null;
}

const RETIRED_CONVENTIONAL_CLAIMS = Object.freeze([
  /(?:current|locked|snapshot|IT load)[^.]{0,100}1[ ,]?850|1[ ,]?850[^.]{0,100}(?:current|locked|snapshot)/i,
  /\b58(?:[.,][12])?\s*L\/s\b/i,
  /\b45[ ,]900\s*L\b/i,
  /\b37(?:[.,]0)?\s*L\/min\b/i,
  /\b99[.,]98\s*%/i,
  /\bcurrent-plus-design\b/i
]);

function retiredConventionalClaims(text) {
  return RETIRED_CONVENTIONAL_CLAIMS.filter((pattern) => pattern.test(String(text || '')));
}

function conventionalDocumentAligned(text) {
  const labeledCurrentValues = [
    /(?:IT load|Current IT).{0,220}30[ ,]000\s*kW/i,
    /(?:Facility load|Facility).{0,220}43[ ,]500\s*kW/i,
    /IT sensible-load(?:\s+CHW)?\s+reference.{0,240}943(?:[.,]0)?\s*L\/s/i,
    /(?:Usable fuel|Usable volume).{0,240}744[ ,]144\s*L/i,
    /(?:Equivalent cooling makeup|Water equivalent flow).{0,240}600(?:[.,]0)?\s*L\/min/i,
    /Uptime.{0,240}UNAVAILABLE/i,
    /current-plus-study/i
  ];
  return labeledCurrentValues.every((pattern) => pattern.test(text))
    && retiredConventionalClaims(text).length === 0;
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
  assert(kpis.pue === '1.165', 'AI-Test-1a: PUE = 1.165 derived (design day, GB300)', `got ${kpis.pue}`);
  assert(kpis.wue === '0.00', 'AI-Test-1b: WUE = 0.00 dry-only baseline', `got ${kpis.wue}`);
  assert(kpis.cue === '0.80', 'AI-Test-1c: CUE_IT = 0.80 (grid 0.69 × PUE 1.165)', `got ${kpis.cue}`);
  assert(kpis.it === '539.05', 'AI-Test-1d: IT Load = 539.05 MW (GB300 total IT, rack IT 499.84 is a separate published figure)', `got ${kpis.it}`);
  assert(kpis.gpu === '253,440', 'AI-Test-1e: GPUs = 253,440', `got ${kpis.gpu}`);
  assert(kpis.dom === '3,520', 'AI-Test-1f: NVL72 racks = 3,520 (one rack = one NVL72 domain at GB300)', `got ${kpis.dom}`);
  assert(/\b432\b/.test(kpis.cdu||'') && /\b107\/108\b/.test(kpis.cdu||''),
    'AI-Test-4: CDU count 432 installed facility-wide, 107/108 duty/installed per hall', `got ${kpis.cdu}`);

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

  /* ---- Test 3: Market terminology — INVERTED at GB300. At GB200 a rack was HALF an
     NVL72 domain (2 rack-positions per domain, 66 kW each), so "rack-pos" language was
     required to disambiguate. At GB300 one rack IS the NVL72 domain (142 kW), so that
     disambiguating vocabulary is now WRONG if it survives, and the 142 kW figure must
     be the one that appears. */
  const html = await page.content();
  const hasRackPos = html.includes('rack-pos') || html.includes('rack position');
  assert(!hasRackPos, 'AI-Test-3a: "rack-pos"/"rack position" GB200 vocabulary must not appear — at GB300 one rack IS the NVL72 domain', '');
  const has66kW = /\b66\s*kW\b/.test(html);
  assert(!has66kW, 'AI-Test-3b: no "66 kW" GB200 per-rack-position figure', '');
  const has142kW = /142\s*kW/.test(html);
  assert(has142kW, 'AI-Test-3c: "142 kW" GB300 per-rack (= per-NVL72-domain) figure present', '');

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
     v2.0.0 — the AI page now shares js/rz-basis-drawer.js (registry
     RZ_DCAI_PARAMETERS) with the Conventional cockpits instead of the
     retired page-local #kpiBasisDrawer/basisFor dictionary. The hook is
     `[data-basis-param]`, the dialog is `#rz-basis-drawer`, and the
     rendered record is Value/Kind/Scope/Evidence/Source (see
     js/rz-basis-drawer.js `row(...)` calls), same contract as CONV-Test-8.
     Use DOM-API click (card.click()) not puppeteer's coordinate click —
     more reliable for headless testing where viewport scroll matters. */
  await page.evaluate(() => {
    const card = document.querySelector('.k[data-basis-param="pue.design_day"]');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 500));
  const drawerOk = await page.evaluate(() => {
    const dlg = document.getElementById('rz-basis-drawer');
    if (!dlg) return null;
    const txt = dlg.textContent;
    return {
      isOpen: dlg.getAttribute('aria-hidden') === 'false',
      hasValue: txt.includes('Value'),
      hasScope: txt.includes('Scope'),
      /* pue.design_day is DERIVED with no single citation — the drawer's
         contract for a derived quantity is "Measured inputs" (its perturbed
         dependency list), not a "Source" row, which only renders for
         authored/cited parameters (see js/rz-basis-drawer.js render()). */
      hasMeasuredInputsOrSource: txt.includes('Measured inputs') || txt.includes('Source'),
      hasEvidence: /ADOPTED|DERIVED|SIMULATED|ASSUMED|UNAVAILABLE/.test(txt)
    };
  });
  assert(drawerOk?.isOpen, 'AI-Test-7a: shared basis drawer opens (aria-hidden=false) on PUE click', '');
  assert(drawerOk?.hasValue, 'AI-Test-7b: drawer shows Value', '');
  assert(drawerOk?.hasScope, 'AI-Test-7c: drawer shows Scope', '');
  assert(drawerOk?.hasMeasuredInputsOrSource, 'AI-Test-7d: drawer shows its provenance (Measured inputs for a derived value, or Source for a cited one)', '');
  assert(drawerOk?.hasEvidence, 'AI-Test-7e: drawer carries an evidence-class chip', '');

  await page.close();
}

/* ========================================================================
 * DC CONV ACCURACY TESTS (doc-16)
 * ====================================================================== */
console.log('\n=== DC Conv accuracy probes (dc-conventional.html) ===');
{
  const expectedSurfaces = {
    kpiPue:'1.45', cPue:'1.45', sPue:'1.45', kpiWue:'1.20', sWue:'1.20 L/kWh',
    kpiCarbon:'0.42', sCue:'0.42 kg/kWh facility', sCueIt:'0.61 kg/kWh IT',
    kpiIt:'30,000', cIt:'30.00 MW', sItLoad:'30,000 kW', sTotalLoad:'43,500 kW',
    cChw:'19.4°C', sChwSup:'19.4°C', sChwRet:'27.0°C',
    kpiTemp:'22.4', cTemp:'22.4°C', sTempAvg:'22.4°C', cRh:'48%', sRhAvg:'48%',
    cFuel:'85%', sFuelMain:'85%', sAutonomy:'48 hrs · bulk tank @ campus load'
  };
  const rawExpectedSurfaces = [...Object.keys(expectedSurfaces), 'kpiUptime'];
  const rawHtml = await readFile(path.resolve(process.cwd(), 'dc-conventional.html'), 'utf8');
  const rawSurfaceMismatches = rawExpectedSurfaces
    .map((id) => ({id, actual:rawElementText(rawHtml, id)}))
    .filter(({actual}) => !/^(?:—|--|UNAVAILABLE)$/i.test(actual));
  assert(rawSurfaceMismatches.length === 0,
    'CONV-Test-0: raw first-paint fallbacks remain neutral until authority validates',
    JSON.stringify(rawSurfaceMismatches));

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

  /* Every duplicated runtime surface must reconcile after the engine write. Raw
     first-paint markup is asserted independently before the browser is opened. */
  const currentSurfaces = await page.evaluate(() => {
    const ids = [
      'kpiPue','cPue','sPue','kpiWue','sWue','kpiCarbon','sCue','sCueIt',
      'kpiIt','cIt','sItLoad','sTotalLoad','cChw','sChwSup','sChwRet',
      'kpiTemp','cTemp','sTempAvg','cRh','sRhAvg','cFuel','sFuelMain','sAutonomy'
    ];
    return Object.fromEntries(ids.map((id) => [id, document.getElementById(id)?.textContent?.trim() || null]));
  });
  const surfaceMismatches = Object.entries(expectedSurfaces)
    .filter(([id, expected]) => currentSurfaces[id] !== expected)
    .map(([id, expected]) => ({id, expected, actual:currentSurfaces[id]}));
  assert(surfaceMismatches.length === 0,
    'CONV-Test-4b: every duplicated current-value surface matches the governed snapshot',
    JSON.stringify(surfaceMismatches));

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

  /* ---- Test 8: Registry basis drawer on conv (DOM-API click for headless reliability) ----
     Grid factor is an AUTHORED parameter, so its truthful contract is
     Value/Scope/Source/Evidence rather than a fabricated arithmetic formula. */
  await page.evaluate(() => {
    const card = document.querySelector('.kpi-card[data-basis-param="environment.carbon_kg_per_facility_kwh"]');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 500));
  const drawerOk = await page.evaluate(() => {
    const dlg = document.getElementById('rz-basis-drawer');
    if (!dlg) return null;
    const txt = dlg.textContent;
    const parameters = window.RZ_CONV_PARAMETERS?.parameters || [];
    const grid = parameters.find(p => p.id === 'environment.carbon_kg_per_facility_kwh')?.value;
    const pue = window.CONV_CALC?.snapshot?.site?.pue;
    const cue = Number.parseFloat(document.getElementById('sCueIt')?.textContent || '');
    return {
      isOpen: dlg.getAttribute('aria-hidden') === 'false',
      hasValueAndScope: txt.includes('Value') && txt.includes('Scope'),
      hasSource: txt.includes('Source'),
      hasEvidence: /ADOPTED|DERIVED|SIMULATED|ASSUMED|UNAVAILABLE/.test(txt),
      hasFacilityDenominator: /facility\s+kwh|denominator is facility/i.test(txt),
      cueMatchesGridTimesPue: Number.isFinite(grid) && Number.isFinite(pue) && Number.isFinite(cue)
        && Math.abs(cue - (grid * pue)) < 0.005
    };
  });
  assert(drawerOk?.isOpen && drawerOk?.hasValueAndScope, 'CONV-Test-8a: Grid-factor registry drawer shows Value and Scope', '');
  assert(drawerOk?.hasSource, 'CONV-Test-8b: drawer shows Source object', '');
  assert(drawerOk?.hasEvidence, 'CONV-Test-8c: drawer carries an evidence-class chip', '');
  assert(drawerOk?.hasFacilityDenominator && drawerOk?.cueMatchesGridTimesPue,
    'CONV-Test-8d: facility-denominator grid factor reconciles to CUE_IT = grid factor x PUE',
    drawerOk ? JSON.stringify(drawerOk) : 'drawer not created');

  /* Uptime has no source ledger. Its custom drawer must remain unavailable and
     must not reuse the healthy-green output treatment. */
  await page.evaluate(() => {
    document.getElementById('rz-basis-drawer')?.remove();
    document.querySelector('.kpi-card[data-basis="uptime"]')?.click();
  });
  await new Promise(r => setTimeout(r, 250));
  const uptimeDrawer = await page.evaluate(() => {
    const output = document.querySelector('#kpiBasisDrawer [data-output-state="UNAVAILABLE"]');
    if (!output) return null;
    const style = getComputedStyle(output);
    return {
      text: output.textContent?.trim() || '',
      background: style.backgroundColor,
      isHealthyGreen: style.backgroundColor === 'rgb(10, 125, 40)'
    };
  });
  assert(uptimeDrawer?.text.includes('UNAVAILABLE') && !uptimeDrawer?.isHealthyGreen,
    'CONV-Test-9: unavailable uptime drawer is explicit and not painted healthy green',
    JSON.stringify(uptimeDrawer));

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
    assert(/539|499/.test(dcAiPdf), 'TS-AI-5: PDF carries engine value 539(.05) MW total IT or 499(.84) MW rack IT (GB300)', '');
    assert(/142\s*kW/.test(dcAiPdf), 'TS-AI-6: PDF carries 142 kW per NVL72-rack basis (GB300)', '');
    assert(/253,?440/.test(dcAiPdf), 'TS-AI-7: PDF carries GPU count 253,440 (GB300)', '');
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
    assert(/539|499|134,?763/.test(bodPdf), 'BoD-AI-3: PDF carries engine values (539/499 MW facility or 134,763 kW hall IT, GB300)', '');
    assert(/1\.16|1\.17/.test(bodPdf), 'BoD-AI-4: PDF carries PUE 1.165 design day (GB300)', '');
    assert(/142 kW/.test(bodPdf), 'BoD-AI-5: PDF carries 142 kW per NVL72-rack basis (GB300)', '');
    /* v2.0.0 — buildBodPdfHtml (datahallAI.html:12531+) was fully rewritten off the GB300
       snapshot and no longer mentions the retired "Scenario A" label anywhere (confirmed by
       source inspection); the Tech Spec builder has not caught up yet (TS-AI-3 still expects
       it), so this assertion is INVERTED here rather than left stale. */
    assert(!/Scenario\s*A/i.test(bodPdf), 'BoD-AI-6: PDF no longer cites the retired "Scenario A" label (GB300 rewrite complete for the BoD PDF)', '');
    assert(/Carnot/i.test(bodPdf) && /COP/.test(bodPdf),
      'BoD-AI-7: PDF cites chiller COP printed WITH its Carnot-fraction derivation, never a bare nameplate figure', '');
  }

  /* --- DC Conv Generate Design --- */
  const dcConvPdf = await captureTechSpec('dc-conventional.html', '#genDesignTrigConv');
  const okConv = dcConvPdf && dcConvPdf.length > 5000;
  assert(okConv, `TS-CONV-1: Generate Design returns non-trivial HTML (~${dcConvPdf?.length||0} chars)`, '');
  if (okConv) {
    const convPdfText = htmlText(dcConvPdf);
    assert(/Conventional Data Centre/i.test(dcConvPdf), 'TS-CONV-2: PDF title carries facility name', '');
    assert(/\bIT load\b.{0,240}\b30[ ,]000\s*kW/i.test(convPdfText), 'TS-CONV-3: labeled IT-load output carries 30,000 kW', '');
    assert(/1\.45/.test(dcConvPdf), 'TS-CONV-4: PDF carries PUE 1.45', '');
    assert(/Grid factor|grid_factor/i.test(dcConvPdf), 'TS-CONV-5: PDF uses "Grid factor" terminology (not CUE alone)', '');
    assert(/0\.6[01]\s*kg/i.test(dcConvPdf), 'TS-CONV-6: PDF derives CUE_IT 0.61 kg/kWh IT', '');
    assert(/\bIT sensible-load CHW reference\b.{0,360}\b943(?:[.,]0)?\s*L\/s/i.test(convPdfText), 'TS-CONV-7: labeled IT sensible-load CHW reference carries 943.0 L/s', '');
    assert(/\bUsable fuel volume now\b.{0,360}\b744[ ,]144\s*L/i.test(convPdfText), 'TS-CONV-8: labeled usable-fuel output carries 744,144 L', '');
    assert(/\bInstant make-up water flow\b.{0,360}\b600(?:[.,]0)?\s*L\/min/i.test(convPdfText), 'TS-CONV-9a: labeled WUE-equivalent flow carries 600.0 L/min', '');
    assert(/\bInstant make-up water flow\b.{0,520}\bCONV_CALC\.snapshot\.water\.flow_lpm_for_wue\b/i.test(convPdfText), 'TS-CONV-9b: WUE-equivalent flow cites the current engine snapshot identity', '');
    assert(/CAPEX|OPEX|TCO/i.test(dcConvPdf), 'TS-CONV-10: PDF includes Cost Annex', '');
    assert(/ISO\/IEC 30134/i.test(dcConvPdf), 'TS-CONV-11: PDF cites ISO/IEC 30134 (CUE standard)', '');
  }
}

/* --- Conventional public-document parity: current basis must not lag runtime. --- */
const retirementFixtures = [
  'Current IT load is 1,850 kW',
  'CHW flow is 58.1 L/s',
  'CHW flow is 58.2 L/s',
  'Usable fuel is 45,900 L',
  'Equivalent cooling makeup is 37.0 L/min',
  'Uptime is 99.98%',
  'Design Studio scope is current-plus-design'
];
const missedRetirementFixtures = retirementFixtures
  .filter((fixture) => retiredConventionalClaims(fixture).length === 0);
assert(missedRetirementFixtures.length === 0,
  'DOC-CONV-Guard: adversarial retired-value fixtures are all rejected',
  JSON.stringify(missedRetirementFixtures));

for (const doc of [
  {route:'manual/dc-conventional.html', label:'Manual'},
  {route:'prd/dc-conventional.html', label:'PRD'}
]) {
  const page = await browser.newPage();
  await page.goto(`${BASE}/${doc.route}`, {waitUntil:'networkidle2', timeout:30000});
  const text = await page.evaluate(() => document.body?.innerText.replace(/\s+/g, ' ').trim() || '');
  await page.close();
  assert(conventionalDocumentAligned(text),
    `DOC-CONV-${doc.label}: current 30 MW basis and dependent values stay synchronized`,
    'requires labeled 30,000 kW; 43,500 kW; 943.0 L/s; 600.0 L/min; 744,144 L; UNAVAILABLE uptime; current-plus-study; and no retired current claim');
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
      const snapshot = window.CONV_CALC?.snapshot;
      r.__scope = {
        hallCount: snapshot?.campus?.hall_count ?? null,
        campusItKw: snapshot?.campus?.it_load_kw ?? snapshot?.site?.it_load_kw ?? null,
        hallItKw: snapshot?.campus?.halls?.[0]?.it_load_kw ?? null
      };
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

  /* IT load uses two intentional scopes: dc-conv is the campus roll-up while
     datahall is the currently selected hall. Reconcile through the engine's
     hall count instead of comparing unlike scopes or freezing another literal. */
  const campusDisplayedKw = Number(String(dcConv.kpiIt || '').replace(/,/g, ''));
  const hallDisplayedMw = Number(datahall['dh-rack-load']);
  const hallCount = Number(datahall.__scope?.hallCount);
  const campusEngineKw = Number(datahall.__scope?.campusItKw);
  const hallEngineKw = Number(datahall.__scope?.hallItKw);
  const itOk = Number.isFinite(campusDisplayedKw)
    && Number.isFinite(hallDisplayedMw)
    && Number.isFinite(hallCount)
    && hallCount > 0
    && Math.abs(campusDisplayedKw - campusEngineKw) < 0.01
    && Math.abs((hallDisplayedMw * 1000) - hallEngineKw) < 0.01
    && Math.abs(campusDisplayedKw - (hallDisplayedMw * 1000 * hallCount)) < 0.01;
  assert(itOk, 'X-Test-3: IT load reconciles across campus and selected-hall scopes',
    JSON.stringify({campusDisplayedKw, hallDisplayedMw, hallCount, campusEngineKw, hallEngineKw}));
}

/* ========================================================================
 * datahall.html OPS-ROLLUP BASIS DRAWERS (v1.33.2 — extends Rule 6 site-wide)
 * ====================================================================== */
console.log('\n=== datahall.html ops-rollup basis drawers ===');
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/datahall.html`, {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 1500));

  /* State/margin remain explicit page-local operational drawers. The three
     engine-backed KPIs use the canonical registry drawer. Both variants must
     expose the same semantic provenance contract. */
  const drawerCases = [
    {id:'state', selector:'#dh-ops-rollup [data-basis="state"]', dialogId:'kpiBasisDrawer'},
    {id:'rackload', selector:'#dh-ops-rollup [data-basis-param="hall.it_load_kw"]', dialogId:'rz-basis-drawer'},
    {id:'margin', selector:'#dh-ops-rollup [data-basis="margin"]', dialogId:'kpiBasisDrawer'},
    {id:'pue', selector:'#dh-ops-rollup [data-basis-param="site.pue"]', dialogId:'rz-basis-drawer'},
    {id:'density', selector:'#dh-ops-rollup [data-basis-param="hall.rack_actual_avg_kw"]', dialogId:'rz-basis-drawer'}
  ];
  for (const drawerCase of drawerCases) {
    await page.evaluate((selector) => {
      const card = document.querySelector(selector);
      if (card) card.click();
    }, drawerCase.selector);
    await new Promise(r => setTimeout(r, 350));
    const drawerOk = await page.evaluate((dialogId) => {
      const dlg = document.getElementById(dialogId);
      if (!dlg) return null;
      const txt = dlg.textContent;
      return {
        isOpen: dialogId !== 'rz-basis-drawer' || dlg.getAttribute('aria-hidden') === 'false',
        hasFormula: txt.includes('Formula'),
        hasResult: txt.includes('Output') || txt.includes('Value'),
        hasSource: txt.includes('Source'),
        hasEvidence: /ADOPTED|DERIVED|SIMULATED|ASSUMED|UNAVAILABLE|BOD LOCKED|SIM SENSOR|DESIGN PLACEHOLDER/.test(txt)
      };
    }, drawerCase.dialogId);
    assert(drawerOk?.isOpen && drawerOk?.hasFormula && drawerOk?.hasResult && drawerOk?.hasSource && drawerOk?.hasEvidence,
      `DH-Test-drawer-${drawerCase.id}: ops-rollup drawer carries Formula/Result/Source/Evidence`,
      drawerOk ? JSON.stringify(drawerOk) : 'drawer not created');
    /* Close before next */
    await page.evaluate(() => {
      const legacy = document.getElementById('kpiBasisDrawer');
      if (legacy) legacy.remove();
      if (window.RZBasisDrawer?.close) window.RZBasisDrawer.close();
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
