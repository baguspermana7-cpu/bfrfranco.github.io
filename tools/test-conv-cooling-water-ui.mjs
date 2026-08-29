import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import vm from 'node:vm';
import puppeteer from 'puppeteer';

/* v1.134.0 — this file used to assert the literal '7.2' for CHWS. That pinned the page to
   the RETIRED 1.85 MW chilled-water basis: when the thermal chain was re-derived backwards
   from the adopted 25.4 °C rack-inlet target (CHWS 19.4 °C), a correct page failed a test
   that had memorised a constant. Load the engine and assert the DOM matches IT, so the gate
   proves binding instead of memorising a number — it can never again fail a correct change,
   and it now catches a page that stops following the engine, which the literal could not. */
const engineSandbox = { window: {}, module: { exports: {} }, console };
vm.createContext(engineSandbox);
vm.runInContext(await readFile('js/conv-engine.js', 'utf8'), engineSandbox);
const ENGINE = engineSandbox.window.CONV_CALC;
assert.ok(ENGINE && ENGINE.snapshot, 'conv-engine.js must expose CONV_CALC.snapshot');
const ENGINE_CHWS_TXT = String(ENGINE.snapshot.cooling.chws_c);
const ENGINE_CACHE_TOKEN = String(ENGINE.snapshot.meta.version);
const WATER_SOURCE = await readFile('water-system.html', 'utf8');
assert.doesNotMatch(
  WATER_SOURCE,
  /(?:1[,.]850|2[,.]220)/,
  'water page source must not retain retired current-basis values',
);
assert.doesNotMatch(
  WATER_SOURCE,
  /bindHallViews|data-active-hall|data-hall=/,
  'site-wide water plant must not expose a cosmetic Hall A-D selector',
);
assert.match(
  WATER_SOURCE,
  new RegExp(`js/conv-engine\\.js\\?v=${ENGINE_CACHE_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  'water page must request the governed engine version so a retired cached snapshot cannot look current',
);
assert.doesNotMatch(WATER_SOURCE, /id="kDp">0\.40|id="kTds">140|id="status-tank">82%/,
  'water first paint must not publish plausible process telemetry before authority');
assert.match(WATER_SOURCE, /id="alarmList">\s*<li><span class="sev unavailable">UNAVAILABLE<\/span>/,
  'water first-paint alarm state must be unavailable');
assert.match(WATER_SOURCE, /data-id="ws-mains-in"[^>]+data-state="unavailable"[^>]+data-current="UNAVAILABLE"/,
  'water first-paint process line must fail closed');

const ROOT = process.cwd();
const MIME = Object.freeze({
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.endsWith('/') ? `${decoded.slice(1)}index.html` : decoded.slice(1);
  const target = resolve(ROOT, relative || 'index.html');
  return target.startsWith(`${resolve(ROOT)}${sep}`) ? target : null;
}

async function serveFile(request, response) {
  const target = safeFilePath(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!target) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
  }
}

async function startServer() {
  const server = createServer((request, response) => { void serveFile(request, response); });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function openPage(browser, origin, path, viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(origin) || url.startsWith('data:')) request.continue();
    else request.abort();
  });
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  await page.goto(`${origin}/${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(() => document.body.dataset.rzDataMode === 'simulated');
  return page;
}

async function assertHallAndBasisContract(page, currentIds, hallLabelId) {
  const before = await page.evaluate((ids) => Object.fromEntries(
    ids.map((id) => [id, document.getElementById(id)?.textContent.trim()]),
  ), currentIds);

  const initial = await page.evaluate((labelId) => ({
    buttons: Array.from(document.querySelectorAll('[data-hall]')).map((button) => ({
      hall: button.dataset.hall,
      pressed: button.getAttribute('aria-pressed'),
      tag: button.tagName,
    })),
    activeHall: document.body.dataset.activeHall,
    hallLabel: document.getElementById(labelId)?.textContent.trim(),
    current: document.querySelector('[data-basis="current"]')?.textContent || '',
    study: document.querySelector('[data-basis="study"]')?.textContent || '',
  }), hallLabelId);

  assert.deepEqual(initial.buttons.map((button) => button.hall), ['A', 'B', 'C', 'D']);
  assert.ok(initial.buttons.every((button) => button.tag === 'BUTTON'), 'hall selector must use native buttons');
  assert.equal(initial.buttons[0].pressed, 'true');
  assert.equal(initial.activeHall, 'A');
  assert.match(initial.hallLabel, /Hall A/i);
  assert.match(initial.current, /CURRENT/i);
  assert.match(initial.current, /site plant/i);
  assert.match(initial.current, /30\.000 MW/i);
  assert.match(initial.current, /selected Hall A/i);
  assert.match(initial.current, /7\.500 MW IT \/ 500 racks/i);
  assert.match(initial.study, /4\s*[×x]\s*10 MW/i);
  assert.match(initial.study, /READ[- ]ONLY|STUDY ONLY/i);

  await page.click('[data-hall="C"]');
  const selected = await page.evaluate((ids, labelId) => ({
    activeHall: document.body.dataset.activeHall,
    hallLabel: document.getElementById(labelId)?.textContent.trim(),
    pressed: document.querySelector('[data-hall="C"]')?.getAttribute('aria-pressed'),
    current: document.querySelector('[data-basis="current"]')?.textContent || '',
    values: Object.fromEntries(ids.map((id) => [id, document.getElementById(id)?.textContent.trim()])),
  }), currentIds, hallLabelId);

  assert.equal(selected.activeHall, 'C');
  assert.equal(selected.pressed, 'true');
  assert.match(selected.hallLabel, /Hall C/i);
  assert.match(selected.current, /site plant/i);
  assert.match(selected.current, /30\.000 MW/i);
  assert.match(selected.current, /selected Hall C/i);
  assert.match(selected.current, /7\.500 MW IT \/ 500 racks/i);
  assert.deepEqual(selected.values, before, 'view-only hall change must not mutate deterministic telemetry');
}

async function assertSiteWaterContract(page) {
  const state = await page.evaluate(() => ({
    hallControls: document.querySelectorAll('[data-hall]').length,
    activeHall: document.body.dataset.activeHall,
    siteLabel: document.getElementById('waterSiteLabel')?.textContent.trim(),
    current: document.querySelector('[data-basis="current"]')?.textContent || '',
    study: document.querySelector('[data-basis="study"]')?.textContent || '',
    hallAllocation: document.getElementById('alloc-hall')?.textContent.trim(),
    scopeNote: document.getElementById('water-scope-note')?.textContent.replace(/\s+/g, ' ').trim(),
    bodyText: document.body.textContent.replace(/\s+/g, ' '),
  }));

  assert.equal(state.hallControls, 0);
  assert.equal(state.activeHall, undefined);
  assert.match(state.siteLabel, /site-wide/i);
  assert.match(state.current, /site scope/i);
  assert.match(state.current, /30\.000 MW IT/i);
  assert.match(state.current, /600\.0 L\/min/i);
  assert.match(state.study, /site capacity study/i);
  assert.match(state.study, /40 MW IT/i);
  assert.match(state.study, /READ[- ]ONLY|STUDY ONLY/i);
  assert.match(state.hallAllocation, /UNAVAILABLE/i);
  assert.match(state.scopeNote, /submeter/i);
  assert.doesNotMatch(state.bodyText, /(?:1,850|2,220)/);
}

const { server, origin } = await startServer();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const chiller = await openPage(browser, origin, 'chiller-plant.html');
  await chiller.waitForFunction(
    (want) => document.getElementById('kChws')?.textContent.includes(want),
    { timeout: 30000 }, ENGINE_CHWS_TXT);
  await assertHallAndBasisContract(chiller, ['kChws', 'kFlow', 'kCool'], 'chillerHallLabel');

  await chiller.focus('[data-hall="C"]');
  await chiller.keyboard.press('1');
  await chiller.waitForSelector('#loopModal[aria-hidden="false"]');
  const modalOpen = await chiller.evaluate(() => {
    const modal = document.getElementById('loopModal');
    const rect = modal.getBoundingClientRect();
    return {
      role: modal.getAttribute('role'),
      modal: modal.getAttribute('aria-modal'),
      labelledBy: modal.getAttribute('aria-labelledby'),
      activeId: document.activeElement?.id,
      withinViewport: rect.left >= 0 && rect.top >= 0
        && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
    };
  });
  assert.deepEqual(modalOpen, {
    role: 'dialog', modal: 'true', labelledBy: 'mTitle', activeId: 'mClose', withinViewport: true,
  });
  await chiller.keyboard.press('Escape');
  const modalClosed = await chiller.evaluate(() => ({
    hidden: document.getElementById('loopModal')?.getAttribute('aria-hidden'),
    returnedHall: document.activeElement?.getAttribute('data-hall'),
  }));
  assert.deepEqual(modalClosed, { hidden: 'true', returnedHall: 'C' });

  await chiller.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await new Promise((accept) => setTimeout(accept, 150));
  const chillerOverflow = await chiller.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ));
  assert.ok(chillerOverflow <= 2, `chiller page overflowed mobile viewport by ${chillerOverflow}px`);
  await chiller.keyboard.press('2');
  await chiller.waitForSelector('#loopModal[aria-hidden="false"]');
  const mobileModal = await chiller.evaluate(() => {
    const modal = document.getElementById('loopModal');
    const rect = modal.getBoundingClientRect();
    return {
      withinViewport: rect.left >= 0 && rect.top >= 0
        && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
      internalOverflow: modal.scrollWidth - modal.clientWidth,
    };
  });
  assert.equal(mobileModal.withinViewport, true);
  assert.ok(mobileModal.internalOverflow <= 2, `chiller modal overflowed mobile width by ${mobileModal.internalOverflow}px`);
  await chiller.keyboard.press('Escape');
  await chiller.close();

  const water = await openPage(browser, origin, 'water-system.html');
  await water.waitForFunction(() => document.getElementById('kWue')?.textContent.includes('1.20'));
  await assertSiteWaterContract(water);

  const waterPlant = await water.evaluate(() => ({
    pumps: Array.from(document.querySelectorAll('[data-pump-id]')).map((pump) => ({
      id: pump.dataset.pumpId,
      role: pump.dataset.role,
      state: pump.dataset.state,
      text: pump.textContent.replace(/\s+/g, ' ').trim(),
      animation: getComputedStyle(pump.querySelector('.pump-symbol') || pump).animationName,
    })),
    allocation: {
      treatment: document.getElementById('alloc-treatment')?.textContent.trim(),
      makeup: document.getElementById('alloc-makeup')?.textContent.trim(),
      domestic: document.getElementById('alloc-domestic')?.textContent.trim(),
      hall: document.getElementById('alloc-hall')?.textContent.trim(),
    },
    thresholds: {
      filterDp: document.getElementById('kDpTh')?.textContent.trim(),
      treatedTds: document.getElementById('kTdsTh')?.textContent.trim(),
    },
    bottom: document.getElementById('status-pump')?.textContent.trim(),
  }));
  assert.deepEqual(waterPlant.pumps.map(({ id, role, state }) => ({ id, role, state })), [
    { id: 'P-301A', role: 'duty', state: 'running' },
    { id: 'P-301B', role: 'standby', state: 'available' },
  ]);
  assert.ok(waterPlant.pumps.every((pump) => pump.animation === 'none'));
  assert.match(waterPlant.pumps[0].text, /RUNNING/i);
  assert.match(waterPlant.pumps[1].text, /AVAILABLE/i);
  assert.match(waterPlant.allocation.treatment, /608\.0 L\/min/i);   // 600.0 makeup + 8.0 domestic  // REBASELINED to the v2.0.0 campus basis (30,000 kW IT / 43.50 MW facility)
  assert.match(waterPlant.allocation.makeup, /600\.0 L\/min/i);      // (1.20 x 30,000)/60  // REBASELINED to the v2.0.0 campus basis (30,000 kW IT / 43.50 MW facility)
  assert.match(waterPlant.allocation.domestic, /8\.0 L\/min/i);
  assert.match(waterPlant.allocation.hall, /UNAVAILABLE/i);
  assert.match(waterPlant.thresholds.filterDp, /Backwash > 0\.80 bar/i);
  assert.match(waterPlant.thresholds.treatedTds, /Limit < 500 ppm/i);
  assert.match(waterPlant.bottom, /P-301A DUTY/i);
  assert.match(waterPlant.bottom, /P-301B STBY/i);

  await water.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await new Promise((accept) => setTimeout(accept, 150));
  const waterOverflow = await water.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ));
  assert.ok(waterOverflow <= 2, `water page overflowed mobile viewport by ${waterOverflow}px`);
  await water.close();

  const waterWithoutEngine = await browser.newPage();
  await waterWithoutEngine.setRequestInterception(true);
  waterWithoutEngine.on('request', (request) => {
    const url = request.url();
    if (url.includes('/chart.js@4.4.1/')) {
      request.respond({
        status: 200,
        contentType: 'text/javascript',
        body: 'window.__waterChartConfigs=[];window.Chart=function(c,x){window.__waterChartConfigs.push(x);this.data=x.data;this.update=function(){};};',
      });
    } else if (new URL(url).pathname.endsWith('/js/conv-engine.js')) request.abort();
    else if (url.startsWith(origin) || url.startsWith('data:')) request.continue();
    else request.abort();
  });
  await waterWithoutEngine.goto(`${origin}/water-system.html`, {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  const unavailable = await waterWithoutEngine.evaluate(() => ({
    dataQuality: document.getElementById('dataQuality')?.textContent.trim(),
    lastUpdate: document.getElementById('lastUpdate')?.textContent.trim(),
    statusTime: document.getElementById('status-time')?.textContent.trim(),
    system: document.getElementById('status-system')?.textContent.trim(),
    makeup: document.getElementById('alloc-makeup')?.textContent.trim(),
    total: document.getElementById('alloc-treatment')?.textContent.trim(),
    reconciliation: document.getElementById('scope-reconciliation-note')?.innerText.replace(/\s+/g, ' ').trim(),
    systemLed: document.getElementById('led-system')?.className,
    tankLed: document.getElementById('led-tank')?.className,
    pumpLed: document.getElementById('led-pump')?.className,
    tankStatus: document.getElementById('status-tank')?.textContent.trim(),
    pumpStatus: document.getElementById('status-pump')?.textContent.trim(),
    pumpAState: document.getElementById('m-pump-st')?.textContent.trim(),
    pumpBState: document.getElementById('m-pump-b-st')?.textContent.trim(),
    alarmText: document.getElementById('alarmList')?.innerText.replace(/\s+/g, ' ').trim(),
    processStates: Array.from(document.querySelectorAll('#water-svg [data-rz-line]'))
      .map((node) => node.getAttribute('data-state')),
    chartCount: window.__waterChartConfigs?.length || 0,
    trendState: document.getElementById('pressureTrendUnavailable')?.textContent.trim(),
    controlsDisabled: Array.from(document.querySelectorAll('#btn-sim,#btn-bw,#btn-reset'))
      .every((node) => node.disabled),
  }));
  assert.equal(unavailable.dataQuality, 'UNAVAILABLE');
  assert.equal(unavailable.lastUpdate, 'UNAVAILABLE');
  assert.equal(unavailable.statusTime, 'UNAVAILABLE');
  assert.equal(unavailable.system, 'UNAVAILABLE');
  assert.match(unavailable.makeup, /UNAVAILABLE/i);
  assert.match(unavailable.total, /UNAVAILABLE/i);
  assert.match(unavailable.reconciliation, /UNAVAILABLE/i);
  assert.doesNotMatch(unavailable.reconciliation, /[—-]\s*L\/min.*=/);
  assert.doesNotMatch(unavailable.systemLed, /led-ok/);
  assert.doesNotMatch(unavailable.tankLed, /led-ok/);
  assert.doesNotMatch(unavailable.pumpLed, /led-ok/);
  assert.match(unavailable.tankStatus, /UNAVAILABLE/i);
  assert.match(unavailable.pumpStatus, /UNAVAILABLE/i);
  assert.match(unavailable.pumpAState, /UNAVAILABLE/i);
  assert.match(unavailable.pumpBState, /UNAVAILABLE/i);
  assert.match(unavailable.alarmText, /UNAVAILABLE/i);
  assert.doesNotMatch(unavailable.alarmText, /\bOK\b|healthy|feedback OK/i);
  assert.ok(unavailable.processStates.every((state) => state === 'unavailable'),
    `water process lines must fail closed: ${unavailable.processStates.join(', ')}`);
  assert.equal(unavailable.chartCount, 0, 'unavailable process authority must not instantiate a plausible DP chart');
  assert.match(unavailable.trendState, /UNAVAILABLE/i);
  assert.equal(unavailable.controlsDisabled, true, 'process simulation controls must disable without authority');
  await waterWithoutEngine.close();

  /* A structurally complete legacy engine is more dangerous than a missing script: without
     an authority check it renders plausible retired values as GOOD. The page must reject it
     just as firmly as a failed load. */
  const legacyEngineSource = `
    window.CONV_CALC = {
      snapshot: {
        site: { it_load_kw: 1850 },
        water: {
          wue_l_per_kwh: 1.20,
          flow_lpm_for_wue: 37.0,
          domestic_lpm: 8.0,
          total_treated_lpm: 45.0
        },
        meta: { version: '1.22.0', scenario: 'Simulated', data_quality: 'GOOD' }
      },
      wueFromFlowLpm: function (flowLpm) { return flowLpm * 60 / 1850; }
    };
  `;
  const waterWithLegacyEngine = await browser.newPage();
  await waterWithLegacyEngine.setRequestInterception(true);
  waterWithLegacyEngine.on('request', (request) => {
    const url = request.url();
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/js/conv-engine.js')) {
      void request.respond({ status: 200, contentType: 'text/javascript', body: legacyEngineSource });
    } else if (url.startsWith(origin) || url.startsWith('data:')) {
      void request.continue();
    } else {
      void request.abort();
    }
  });
  await waterWithLegacyEngine.goto(`${origin}/water-system.html`, {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  const legacy = await waterWithLegacyEngine.evaluate(() => ({
    dataQuality: document.getElementById('dataQuality')?.textContent.trim(),
    system: document.getElementById('status-system')?.textContent.trim(),
    makeup: document.getElementById('alloc-makeup')?.textContent.trim(),
    total: document.getElementById('alloc-treatment')?.textContent.trim(),
    basis: document.getElementById('water-current-basis-value')?.textContent.trim(),
    bodyText: document.body.innerText.replace(/\s+/g, ' '),
    systemLed: document.getElementById('led-system')?.className,
  }));
  assert.equal(legacy.dataQuality, 'UNAVAILABLE');
  assert.equal(legacy.system, 'UNAVAILABLE');
  assert.match(legacy.makeup, /UNAVAILABLE/i);
  assert.match(legacy.total, /UNAVAILABLE/i);
  assert.match(legacy.basis, /UNAVAILABLE/i);
  assert.doesNotMatch(legacy.bodyText, /(?:1\.850 MW|37\.0 L\/min|45\.0 L\/min)/);
  assert.doesNotMatch(legacy.systemLed, /led-ok/);
  await waterWithLegacyEngine.close();

  /* Same-version is necessary but not sufficient authority. A partial current bundle
     without the API consumed by the page used to throw after the numeric checks passed,
     preserving healthy first paint. It must now render a complete neutral state. */
  const incompleteCurrentEngineSource = `
    window.CONV_CALC = {
      snapshot: {
        site: { it_load_kw: 30000 },
        water: {
          wue_l_per_kwh: 1.20,
          flow_lpm_for_wue: 600.0,
          domestic_lpm: 8.0,
          total_treated_lpm: 608.0
        },
        meta: { version: '${ENGINE_CACHE_TOKEN}', scenario: 'Simulated', data_quality: 'GOOD' }
      }
    };
  `;
  const waterWithIncompleteEngine = await browser.newPage();
  const incompletePageErrors = [];
  waterWithIncompleteEngine.on('pageerror', (error) => incompletePageErrors.push(error.message));
  await waterWithIncompleteEngine.setRequestInterception(true);
  waterWithIncompleteEngine.on('request', (request) => {
    const url = request.url();
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/js/conv-engine.js')) {
      void request.respond({
        status: 200,
        contentType: 'text/javascript',
        body: incompleteCurrentEngineSource,
      });
    } else if (url.startsWith(origin) || url.startsWith('data:')) {
      void request.continue();
    } else {
      void request.abort();
    }
  });
  await waterWithIncompleteEngine.goto(`${origin}/water-system.html`, {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  const incomplete = await waterWithIncompleteEngine.evaluate(() => ({
    dataQuality: document.getElementById('dataQuality')?.textContent.trim(),
    system: document.getElementById('status-system')?.textContent.trim(),
    makeup: document.getElementById('alloc-makeup')?.textContent.trim(),
    total: document.getElementById('alloc-treatment')?.textContent.trim(),
    basis: document.getElementById('water-current-basis-value')?.textContent.trim(),
    systemLed: document.getElementById('led-system')?.className,
    processStates: Array.from(document.querySelectorAll('#water-svg [data-rz-line]'))
      .map((node) => node.getAttribute('data-state')),
    controlsDisabled: Array.from(document.querySelectorAll('#btn-sim,#btn-bw,#btn-reset'))
      .every((node) => node.disabled),
  }));
  assert.deepEqual(incompletePageErrors, [], `partial current water authority threw: ${incompletePageErrors.join('; ')}`);
  assert.equal(incomplete.dataQuality, 'UNAVAILABLE');
  assert.equal(incomplete.system, 'UNAVAILABLE');
  assert.match(incomplete.makeup, /UNAVAILABLE/i);
  assert.match(incomplete.total, /UNAVAILABLE/i);
  assert.match(incomplete.basis, /UNAVAILABLE/i);
  assert.doesNotMatch(incomplete.systemLed, /led-ok/);
  assert.ok(incomplete.processStates.every((state) => state === 'unavailable'));
  assert.equal(incomplete.controlsDisabled, true);
  await waterWithIncompleteEngine.close();

  /* Numeric completeness without provenance is still unavailable. Scenario and quality
     are part of the authority contract, not decorative labels. */
  const missingMetaCurrentEngineSource = `
    window.CONV_CALC = {
      snapshot: {
        site: { it_load_kw: 30000 },
        water: {
          wue_l_per_kwh: 1.20,
          flow_lpm_for_wue: 600.0,
          domestic_lpm: 8.0,
          total_treated_lpm: 608.0
        },
        meta: { version: '${ENGINE_CACHE_TOKEN}' }
      },
      wueFromFlowLpm: function (flowLpm) { return flowLpm * 60 / 30000; }
    };
  `;
  const waterWithMissingMeta = await browser.newPage();
  const missingMetaErrors = [];
  waterWithMissingMeta.on('pageerror', (error) => missingMetaErrors.push(error.message));
  await waterWithMissingMeta.setRequestInterception(true);
  waterWithMissingMeta.on('request', (request) => {
    const url = request.url();
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/js/conv-engine.js')) {
      void request.respond({
        status: 200,
        contentType: 'text/javascript',
        body: missingMetaCurrentEngineSource,
      });
    } else if (url.startsWith(origin) || url.startsWith('data:')) {
      void request.continue();
    } else {
      void request.abort();
    }
  });
  await waterWithMissingMeta.goto(`${origin}/water-system.html`, {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  const missingMeta = await waterWithMissingMeta.evaluate(() => ({
    dataQuality: document.getElementById('dataQuality')?.textContent.trim(),
    scenario: document.getElementById('scenarioName')?.textContent.trim(),
    lastUpdate: document.getElementById('lastUpdate')?.textContent.trim(),
    statusTime: document.getElementById('status-time')?.textContent.trim(),
    system: document.getElementById('status-system')?.textContent.trim(),
    basis: document.getElementById('water-current-basis-value')?.textContent.trim(),
    systemLed: document.getElementById('led-system')?.className,
    processStates: Array.from(document.querySelectorAll('#water-svg [data-rz-line]'))
      .map((node) => node.getAttribute('data-state')),
    controlsDisabled: Array.from(document.querySelectorAll('#btn-sim,#btn-bw,#btn-reset'))
      .every((node) => node.disabled),
  }));
  assert.deepEqual(missingMetaErrors, [], `missing-meta water authority threw: ${missingMetaErrors.join('; ')}`);
  assert.equal(missingMeta.dataQuality, 'UNAVAILABLE');
  assert.equal(missingMeta.scenario, 'UNAVAILABLE');
  assert.equal(missingMeta.lastUpdate, 'UNAVAILABLE');
  assert.equal(missingMeta.statusTime, 'UNAVAILABLE');
  assert.equal(missingMeta.system, 'UNAVAILABLE');
  assert.match(missingMeta.basis, /UNAVAILABLE/i);
  assert.doesNotMatch(missingMeta.systemLed, /led-ok/);
  assert.ok(missingMeta.processStates.every((state) => state === 'unavailable'));
  assert.equal(missingMeta.controlsDisabled, true);
  await waterWithMissingMeta.close();

  console.log('PASS Conventional chiller hall context plus site-wide water scope, fail-closed basis, pump redundancy, and responsive layout');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
