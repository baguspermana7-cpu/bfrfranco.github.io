#!/usr/bin/env node
// DEEP probe — exercises every interactive element + capture screenshots on failure.
// Goal: find what the user is seeing as "still broken".

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const URL = process.env.PROBE_URL || `http://localhost:8081/spares-readiness-calculator.html?nc=${Date.now()}`;
const TAB_NAMES = ['criticality','readiness','stock','meio','hub','supplier','ltb','kraljic','montecarlo','sensitivity','projection','fleet','pm-ops','scorecard','negotiation','contract','process','meeting','stakeholder','eol','ambiguity','star','sc-lane','sc-risk','sc-sim','sc-expedite','catalog','catalog-analytics','faq'];

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage();

const issues = [];
const consoleErrors = [], pageErrors = [];
page.on('console', m => { if (m.type()==='error') consoleErrors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(`${e.name}: ${e.message}`));

await page.setViewport({ width: 1280, height: 800 });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

function fail(area, detail) { issues.push({ area, detail }); }
function ok(label) { /* silent */ }

// === 1. Enumerate EVERY inline onclick handler from the page & check window exposure ===
const handlerCheck = await page.evaluate(() => {
  const els = document.querySelectorAll('[onclick]');
  const names = new Set();
  const JS_KEYWORDS = new Set(['if','for','while','return','typeof','new','this','event','console','window','document','setTimeout','localStorage','sessionStorage','alert','confirm','prompt']);
  els.forEach(el => {
    const code = el.getAttribute('onclick') || '';
    const m = code.match(/^[\s;(]*([a-zA-Z_$][\w$]*)\s*\(/);
    if (m && !JS_KEYWORDS.has(m[1])) names.add(m[1]);
  });
  const result = {};
  for (const n of names) {
    result[n] = (typeof window[n]) === 'function' ? 'OK' : `MISSING (${typeof window[n]})`;
  }
  return { count: names.size, exposure: result };
});
const missingHandlers = Object.entries(handlerCheck.exposure).filter(([k,v])=>v!=='OK');
if (missingHandlers.length) fail('window-exposure', { missing: missingHandlers, totalHandlers: handlerCheck.count });
console.log(`[handlers] ${handlerCheck.count} unique onclick names, ${missingHandlers.length} missing on window`);
if (missingHandlers.length) missingHandlers.forEach(([k,v])=>console.log(`  MISSING: ${k} = ${v}`));

// === 2. Tab switching — every tab + check pane visible ===
let tabsBroken = 0;
for (const t of TAB_NAMES) {
  try {
    await page.evaluate(tab => { window.switchTab && window.switchTab(tab); }, t);
    await new Promise(r=>setTimeout(r,50));
    const ok = await page.evaluate(tab => {
      const pane = document.getElementById('pane-'+tab);
      const btn = document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`);
      return {
        paneExists: !!pane,
        paneVisible: pane ? getComputedStyle(pane).display !== 'none' : false,
        btnActive: btn ? btn.classList.contains('active') : false,
      };
    }, t);
    if (!ok.paneVisible) { tabsBroken++; fail('tab-switch', { tab: t, ...ok }); }
  } catch(e) { tabsBroken++; fail('tab-switch', { tab: t, error: e.message }); }
}
console.log(`[tabs] ${TAB_NAMES.length - tabsBroken}/${TAB_NAMES.length} OK`);

// === 3. Tour wizard — start, click Next 3x, click Skip ===
try {
  // Reset tour state so it can re-trigger
  await page.evaluate(() => {
    try { localStorage.removeItem('csp_tour_seen'); } catch(_){}
    if (window.tourStart) window.tourStart();
  });
  await new Promise(r=>setTimeout(r,300));
  const tourState1 = await page.evaluate(() => {
    const overlay = document.querySelector('.tour-overlay');
    const tooltip = document.querySelector('.tour-tooltip');
    return {
      overlayVisible: overlay ? getComputedStyle(overlay).pointerEvents !== 'none' || overlay.style.display !== 'none' : false,
      overlayDisplay: overlay ? getComputedStyle(overlay).display : 'no-overlay',
      tooltipText: tooltip ? tooltip.textContent.trim().slice(0,80) : 'no-tooltip',
      tooltipVisible: tooltip ? getComputedStyle(tooltip).display !== 'none' : false,
    };
  });
  if (!tourState1.tooltipVisible) fail('tour-start', tourState1);
  console.log('[tour] after start:', JSON.stringify(tourState1));

  // Click Next twice
  for (let i=0; i<2; i++) {
    const r = await page.evaluate(() => {
      const b = document.querySelector('.tour-btn-next');
      if (!b) return 'no-button';
      b.click();
      return 'clicked';
    });
    await new Promise(r=>setTimeout(r,200));
    const txt = await page.evaluate(() => document.querySelector('.tour-tooltip')?.textContent?.trim().slice(0,60) || 'gone');
    console.log(`[tour] after Next #${i+1}:`, r, '|', txt);
  }
  // Click Skip
  const skipR = await page.evaluate(() => { const b=document.querySelector('.tour-btn-skip'); if(!b)return 'no-button'; b.click(); return 'clicked'; });
  await new Promise(r=>setTimeout(r,200));
  const afterSkip = await page.evaluate(() => {
    const o=document.querySelector('.tour-overlay');
    return o ? getComputedStyle(o).display : 'no-overlay';
  });
  console.log('[tour] after Skip:', skipR, '| overlay display:', afterSkip);
  if (afterSkip !== 'none' && afterSkip !== 'no-overlay') fail('tour-skip-not-hiding', { displayAfterSkip: afterSkip });
} catch(e) { fail('tour', e.message); }

// === 4. Tooltip rendering — actually hover .tip elements ===
const tipReport = await page.evaluate(() => {
  const tips = document.querySelectorAll('.tip');
  if (!tips.length) return { count: 0 };
  const samples = [];
  for (let i = 0; i < Math.min(5, tips.length); i++) {
    const el = tips[i];
    el.classList.add('tip-open');
    const r = el.getBoundingClientRect();
    const aftCS = getComputedStyle(el, '::after');
    samples.push({
      idx: i,
      outerHTML: el.outerHTML.slice(0,120),
      width: r.width, height: r.height,
      hasTitle: !!el.getAttribute('title'),
      hasAriaLabel: !!el.getAttribute('aria-label'),
      hasDataTip: !!el.getAttribute('data-tip'),
      afterContent: aftCS.content,
      afterDisplay: aftCS.display,
      afterPosition: aftCS.position,
    });
    el.classList.remove('tip-open');
  }
  return { count: tips.length, samples };
});
console.log(`[tooltips] count=${tipReport.count}`);
if (tipReport.samples) {
  let brokenTips = 0;
  for (const s of tipReport.samples) {
    const ok = s.afterContent && s.afterContent !== '"none"' && s.afterContent !== 'none' && s.afterDisplay !== 'none';
    if (!ok) { brokenTips++; console.log('  BROKEN tip:', JSON.stringify(s).slice(0,200)); }
  }
  if (brokenTips) fail('tooltip-render', { broken: brokenTips, sampleCount: tipReport.samples.length });
}

// === 5. Save / Load / Share scenario ===
try {
  await page.evaluate(() => window.switchTab && window.switchTab('criticality'));
  await new Promise(r=>setTimeout(r,80));
  await page.evaluate(() => {
    const setVal = (id,v) => { const el = document.getElementById(id); if(el){ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true})); }};
    setVal('c1_lambda','0.75');
    setVal('c1_installed','15');
  });
  // Save
  const save = await page.evaluate(() => {
    try { window.saveScenario && window.saveScenario(); return 'ok'; } catch(e){ return 'err:'+e.message; }
  });
  console.log('[save] result:', save);
  if (save.startsWith('err:')) fail('save', save);
  // Load
  const load = await page.evaluate(() => {
    try { window.loadScenario && window.loadScenario(); return 'ok'; } catch(e){ return 'err:'+e.message; }
  });
  console.log('[load] result:', load);
  if (load.startsWith('err:')) fail('load', load);
  // Share
  const share = await page.evaluate(() => {
    try { window.shareScenario && window.shareScenario(); return 'ok'; } catch(e){ return 'err:'+e.message; }
  });
  console.log('[share] result:', share);
  if (share.startsWith('err:')) fail('share', share);
} catch(e) { fail('scenario', e.message); }

// === 6. Exercise every module's calc function (if window-exposed) ===
const calcsToTry = ['calcCriticality','calcReadiness','calcStock','calcMEIO','calcSupplierRisk','calcLTB','calcKraljic','calcLanePlanner','calcExpedite','runMonteCarlo','runSCSim','calcHub','calcFleet','calcScorecard','calcSCRisk','calcCatalogAnalytics','calcSensitivity','calcProjection'];
for (const fn of calcsToTry) {
  const r = await page.evaluate(name => {
    if (typeof window[name] !== 'function') return 'missing';
    try { window[name](); return 'ok'; } catch(e){ return 'err:'+e.message; }
  }, fn);
  console.log(`[calc] ${fn}: ${r}`);
  if (r === 'missing' || r.startsWith('err:')) fail('calc-'+fn, r);
}

// === 7. Mobile viewport — visual layout, take screenshot ===
await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 });
await page.reload({ waitUntil: 'networkidle2' });
await new Promise(r=>setTimeout(r,500));
const mobileLayout = await page.evaluate(() => {
  const body = document.body;
  const tabs = document.querySelector('.tabs');
  const inputs = document.querySelectorAll('.criticality input, #pane-criticality input');
  return {
    bodyScrollWidth: body.scrollWidth,
    bodyClientWidth: body.clientWidth,
    hasOverflow: body.scrollWidth > body.clientWidth,
    tabsScrollable: tabs ? (tabs.scrollWidth > tabs.clientWidth) : null,
    tabsOverflow: tabs ? getComputedStyle(tabs).overflowX : null,
    tabsWidth: tabs ? tabs.getBoundingClientRect().width : null,
    inputSamples: Array.from(inputs).slice(0,3).map(el => {
      const r = el.getBoundingClientRect();
      return { width: r.width, fontSize: getComputedStyle(el).fontSize };
    }),
  };
});
console.log('[mobile] layout:', JSON.stringify(mobileLayout));
if (mobileLayout.hasOverflow) fail('mobile-overflow', mobileLayout);

await page.screenshot({ path: '/tmp/probe-mobile-criticality.png', fullPage: false });
await page.evaluate(() => window.switchTab && window.switchTab('readiness'));
await new Promise(r=>setTimeout(r,200));
await page.screenshot({ path: '/tmp/probe-mobile-readiness.png', fullPage: false });

console.log('\n=== SUMMARY ===');
console.log('consoleErrors:', consoleErrors.length); consoleErrors.slice(0,15).forEach(e=>console.log('  ',e.slice(0,200)));
console.log('pageErrors:', pageErrors.length); pageErrors.slice(0,15).forEach(e=>console.log('  ',e));
console.log('issues:', issues.length);
issues.forEach(i => console.log('  ', i.area, '→', JSON.stringify(i.detail).slice(0,200)));
console.log('\nScreenshots: /tmp/probe-mobile-criticality.png /tmp/probe-mobile-readiness.png');

await browser.close();
process.exitCode = issues.length > 0 || pageErrors.length > 0 ? 1 : 0;
