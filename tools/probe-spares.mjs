#!/usr/bin/env node
// Phase 0 Puppeteer probe for v1.16.1 stabilization plan.
// Loads localhost:8081/spares-readiness-calculator.html, captures console errors,
// dispatches synthetic interactions, reports which fail concretely.
//
// Usage: node tools/probe-spares.mjs

import puppeteer from 'puppeteer';

const URL = `http://localhost:8081/spares-readiness-calculator.html?nc=${Date.now()}`;
const TAB_NAMES = [
  'criticality','readiness','stock','hub','supplier','ltb','kraljic','montecarlo',
  'fleet','pm-ops','scorecard','negotiation','contract','process','meeting',
  'stakeholder','eol','ambiguity','star','sc-lane','sc-risk','sc-sim','sc-expedite',
  'catalog','catalog-analytics','faq'
];

function log(label, value) { console.log(`[${label}] ${value}`); }
function section(name) { console.log(`\n${'='.repeat(70)}\n${name}\n${'='.repeat(70)}`); }

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
});

const results = { consoleErrors: [], pageErrors: [], tabFails: [], tourFails: [], tipFails: [], cardNaN: [], mobile: {} };

try {
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') results.consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    results.pageErrors.push(`${err.name}: ${err.message}`);
  });

  section('Loading page');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  log('URL', URL);
  log('Title', await page.title());
  log('Console errors on load', results.consoleErrors.length);
  log('Page errors on load',    results.pageErrors.length);
  for (const e of results.pageErrors) log('  pageerror', e);
  for (const e of results.consoleErrors.slice(0,10)) log('  console.error', e.slice(0,200));

  section('Hypothesis #3: window.switchTab + window.tourNext + window.tourEnd exposure');
  const exposure = await page.evaluate(() => ({
    switchTab:    typeof window.switchTab,
    tourNext:     typeof window.tourNext,
    tourEnd:      typeof window.tourEnd,
    toggleTheme:  typeof window.toggleTheme,
    saveScenario: typeof window.saveScenario,
    loadScenario: typeof window.loadScenario,
    shareScenario:typeof window.shareScenario,
    exportPDF:    typeof window.exportPDF,
    resetModule:  typeof window.resetModule,
    recalcAll:    typeof window.recalcAll,
  }));
  for (const [k,v] of Object.entries(exposure)) log(`window.${k}`, v + (v === 'function' ? '  ✓' : '  ✗ MISSING'));

  section('Hypothesis #1+#2: Tab switching — click each tab button');
  for (const t of TAB_NAMES) {
    try {
      const before = await page.evaluate(() => document.querySelector('.tab-btn.active')?.textContent?.trim() || null);
      const clicked = await page.evaluate((tab) => {
        const btn = document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`);
        if (!btn) return { ok:false, reason:'no button' };
        btn.click();
        return { ok:true };
      }, t);
      if (!clicked.ok) { results.tabFails.push({ tab: t, reason: clicked.reason }); continue; }
      await new Promise(r => setTimeout(r, 80));
      const after = await page.evaluate(() => document.querySelector('.tab-btn.active')?.textContent?.trim() || null);
      const paneVisible = await page.evaluate((tab) => {
        const pane = document.getElementById(`pane-${tab}`);
        if (!pane) return 'no pane';
        const cs = getComputedStyle(pane);
        return cs.display !== 'none' ? 'visible' : 'hidden';
      }, t);
      if (paneVisible !== 'visible') results.tabFails.push({ tab: t, before, after, paneVisible });
      else log(`tab '${t}'`, `OK (pane visible, active=${after})`);
    } catch(e) {
      results.tabFails.push({ tab: t, error: e.message });
    }
  }
  log('Tabs that failed', results.tabFails.length);
  for (const f of results.tabFails) log('  fail', JSON.stringify(f));

  section('Hypothesis #4: Tour wizard — find tour overlay + click Skip + click Next');
  const tourState = await page.evaluate(() => {
    const overlay = document.querySelector('.tour-overlay');
    const skipBtn = document.querySelector('.tour-btn-skip');
    const nextBtn = document.querySelector('.tour-btn-next');
    return {
      overlayExists: !!overlay,
      overlayDisplay: overlay ? getComputedStyle(overlay).display : null,
      skipExists: !!skipBtn,
      skipOnclick: skipBtn?.getAttribute('onclick') || null,
      nextExists: !!nextBtn,
      nextOnclick: nextBtn?.getAttribute('onclick') || null,
    };
  });
  log('Tour DOM', JSON.stringify(tourState));

  // Force-start the tour if it's not visible (the tour may only show on first visit via localStorage)
  await page.evaluate(() => {
    if (typeof window.tourStart === 'function') {
      try { window.tourStart(); } catch(e) { console.error('tourStart threw:', e.message); }
    }
  });
  await new Promise(r => setTimeout(r, 200));

  const tourStarted = await page.evaluate(() => {
    const o = document.querySelector('.tour-overlay');
    return o ? getComputedStyle(o).display : 'none';
  });
  log('Tour overlay display after force-start', tourStarted);

  // Click Skip
  try {
    const skipResult = await page.evaluate(() => {
      const b = document.querySelector('.tour-btn-skip');
      if (!b) return 'no skip button';
      b.click();
      return 'clicked';
    });
    log('Skip click', skipResult);
  } catch(e) { results.tourFails.push({ btn:'skip', err:e.message }); }

  // Click Next
  await page.evaluate(() => { if (typeof window.tourStart === 'function') window.tourStart(); });
  await new Promise(r => setTimeout(r, 200));
  try {
    const nextResult = await page.evaluate(() => {
      const b = document.querySelector('.tour-btn-next');
      if (!b) return 'no next button';
      b.click();
      return 'clicked';
    });
    log('Next click', nextResult);
  } catch(e) { results.tourFails.push({ btn:'next', err:e.message }); }

  section('Hypothesis #4: Tooltip — count .tip elements + inspect content rendering');
  const tipInfo = await page.evaluate(() => {
    const tips = document.querySelectorAll('.tip');
    if (!tips.length) return { count: 0 };
    // Inspect first 5
    const samples = [];
    for (let i = 0; i < Math.min(5, tips.length); i++) {
      const el = tips[i];
      el.classList.add('tip-open');  // simulate :hover
      const aft = getComputedStyle(el, '::after');
      const bef = getComputedStyle(el, '::before');
      samples.push({
        outerHTML: el.outerHTML.slice(0, 200),
        afterContent: aft.content,
        afterDisplay: aft.display,
        beforeContent: bef.content,
        beforeDisplay: bef.display,
        dataTip: el.getAttribute('data-tip'),
        title: el.getAttribute('title'),
        ariaLabel: el.getAttribute('aria-label'),
      });
      el.classList.remove('tip-open');
    }
    return { count: tips.length, samples };
  });
  log('Tip element count', tipInfo.count);
  if (tipInfo.samples) {
    for (let i = 0; i < tipInfo.samples.length; i++) {
      log(`tip[${i}]`, JSON.stringify(tipInfo.samples[i]));
    }
  }

  section('Hypothesis #5: Criticality cards — enter inputs, check 4 cards for NaN');
  // Switch to criticality tab first
  await page.evaluate(() => { if (typeof window.switchTab === 'function') window.switchTab('criticality'); });
  await new Promise(r => setTimeout(r, 100));

  // Set inputs and trigger recalc
  await page.evaluate(() => {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) { el.value = val; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }
    };
    setVal('c1_lambda', '0.5');
    setVal('c1_installed', '10');
    setVal('c1_severity', '8');
    setVal('c1_detectability', '5');
    setVal('c1_alternates', '2');
    if (typeof window.calcCriticality === 'function') window.calcCriticality();
  });
  await new Promise(r => setTimeout(r, 150));

  const cards = await page.evaluate(() => ({
    rpn:       document.getElementById('c1_rpn')?.textContent,
    eff_sev:   document.getElementById('c1_eff_sev')?.textContent,
    fleetFail: document.getElementById('c1_fleet_fail')?.textContent,
    altFactor: document.getElementById('c1_alt_factor')?.textContent,
  }));
  for (const [k,v] of Object.entries(cards)) {
    log(`card.${k}`, JSON.stringify(v));
    if (v && v.includes('NaN')) results.cardNaN.push({ card:k, value:v });
  }

  section('Hypothesis #6: Mobile layout @ 375x667');
  await page.setViewport({ width: 375, height: 667 });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 500));
  results.mobile = await page.evaluate(() => {
    const tabsContainer = document.querySelector('.tabs');
    const tabsRect = tabsContainer?.getBoundingClientRect();
    const body = document.body.getBoundingClientRect();
    return {
      bodyWidth: body.width,
      bodyScrollWidth: document.body.scrollWidth,
      hasHorizontalScroll: document.body.scrollWidth > document.body.clientWidth,
      tabsOverflowX: tabsContainer ? getComputedStyle(tabsContainer).overflowX : null,
      tabsWidth: tabsRect?.width,
      tabsScrollWidth: tabsContainer?.scrollWidth,
      tabsClipped: tabsContainer ? (tabsContainer.scrollWidth > tabsContainer.clientWidth) : null,
    };
  });
  log('Mobile diagnostic', JSON.stringify(results.mobile, null, 2));

  section('SUMMARY');
  console.log(JSON.stringify({
    consoleErrors: results.consoleErrors.length,
    pageErrors: results.pageErrors.length,
    pageErrorMessages: results.pageErrors,
    tabsFailed: results.tabFails.length,
    tabsFailDetail: results.tabFails,
    tourFails: results.tourFails,
    cardNaN: results.cardNaN,
    mobileHasHorizontalScroll: results.mobile.hasHorizontalScroll,
    windowExposure: exposure,
  }, null, 2));

} catch(e) {
  console.error('PROBE FATAL:', e);
  process.exitCode = 2;
} finally {
  await browser.close();
}
