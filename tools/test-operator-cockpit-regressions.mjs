import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';

import {
  enterAuthorizedAuditState,
  primeCockpitAuditDocument,
} from './lib/cockpit-audit-state.mjs';

const ROOT = process.cwd();
const MIME = Object.freeze({
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});
const CHILLER_SOURCE = await readFile(resolve(ROOT, 'chiller-plant.html'), 'utf8');
const DATAHALL_AI_SOURCE = await readFile(resolve(ROOT, 'datahallAI.html'), 'utf8');
const EPMS_SOURCE = await readFile(resolve(ROOT, 'EPMS_Telemetry.html'), 'utf8');
const WATER_SOURCE = await readFile(resolve(ROOT, 'water-system.html'), 'utf8');
assert.match(CHILLER_SOURCE, /<script src="js\/conv-engine\.js\?v=2\.0\.0"><\/script>/,
  'chiller must request the governed engine revision');
assert.doesNotMatch(CHILLER_SOURCE, /(?:Cooling Demand 1\.93 MW|id="kCool">1\.93 MW|id="spFlowTxt">18\.0 L\/s)/,
  'chiller first paint must not ship retired engineering values');
assert.match(CHILLER_SOURCE, /id="asLevel">UNAVAILABLE<\/span>/,
  'chiller first paint must begin fail closed');
assert.doesNotMatch(CHILLER_SOURCE, /Math\.random\s*\(/,
  'chiller operator state must use reproducible scenario evolution, not reload-dependent randomness');
assert.doesNotMatch(DATAHALL_AI_SOURCE, /__rzKpiAnimated|One-time count-up on first paint/,
  'AI authority KPIs must not animate through plausible but false engineering values');
assert.doesNotMatch(EPMS_SOURCE, /CYAN\s*=\s*'#22d3ee'/i,
  'EPMS provenance must use the governed instrument-cyan token, not neon cyan');
assert.doesNotMatch(WATER_SOURCE, /--sel:\s*#22d3ee/i,
  'Water selection must use the governed instrument-cyan token, not neon cyan');

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.endsWith('/') ? `${decoded.slice(1)}index.html` : decoded.slice(1);
  const target = resolve(ROOT, relative || 'index.html');
  return target.startsWith(`${resolve(ROOT)}${sep}`) ? target : null;
}

async function serve(request, response) {
  const target = safePath(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!target) return response.writeHead(403).end('Forbidden');
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
  }
}

function boxesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

const LEGACY_CHILLER_ENGINE = `window.CONV_CALC = Object.freeze({
  snapshot: Object.freeze({
    meta: Object.freeze({ version: '1.22.0', scenario: 'Simulated' }),
    site: Object.freeze({ it_load_kw: 1850, facility_load_kw: 2682.5, pue: 1.45 }),
    cooling: Object.freeze({
      chws_c: 7.2, chwr_c: 14.8, chw_delta_t: 7.6, flow_lps: 58.2,
      heat_rejection_kw: 1927, chillers_running: 2, chillers_total: 3,
      chiller_type: 'water-cooled-centrifugal', chiller_input_kw_e: 300,
      plant_cop: 6.4, plant_kw_per_rt: 0.55, cdw_supply_c: 29,
      cdw_return_c: 35, tower_rejection_kw_th: 2200, duty_rt: 548,
      chiller_capacity_kw_th: 1200, chiller_n1_capacity_kw_th: 2400,
      chiller_specific_power_kw_e_per_kw_th: 0.15, cdw_range_k: 6,
      chiller_design_duty_kw_th: 1200
    })
  })
});`;
const INCOMPLETE_CURRENT_CHILLER_ENGINE = `window.CONV_CALC = Object.freeze({
  snapshot: Object.freeze({
    meta: Object.freeze({ version: '2.0.0', scenario: 'Simulated' }),
    site: Object.freeze({}),
    cooling: Object.freeze({
      chws_c: 19.4, chwr_c: 27.0, chw_delta_t: 7.6, flow_lps: 943.0,
      heat_rejection_kw: 31250, chillers_running: 7, chillers_total: 10
    })
  })
});`;
const MISSING_META_CURRENT_CHILLER_ENGINE = `window.CONV_CALC = Object.freeze({
  snapshot: Object.freeze({
    meta: Object.freeze({ version: '2.0.0' }),
    site: Object.freeze({ it_load_kw: 30000, facility_load_kw: 43500, pue: 1.45 }),
    cooling: Object.freeze({
      chws_c: 19.4, chwr_c: 27.0, chw_delta_t: 7.6, flow_lps: 943.0,
      heat_rejection_kw: 31250, chillers_running: 7, chillers_total: 10,
      chiller_type: 'water-cooled-centrifugal', chiller_input_kw_e: 5153.4,
      plant_cop: 6.06, plant_kw_per_rt: 0.58, cdw_supply_c: 31.7,
      cdw_return_c: 38.0, tower_rejection_kw_th: 36403.4, duty_rt: 8885.4,
      chiller_capacity_kw_th: 35000, chiller_n1_capacity_kw_th: 45000,
      chiller_specific_power_kw_e_per_kw_th: 0.1649, cdw_range_k: 6.3,
      chiller_design_duty_kw_th: 40000
    })
  })
});`;

async function readUnavailablePlant(page) {
  await page.keyboard.press('1');
  await new Promise((accept) => setTimeout(accept, 50));
  return page.evaluate(() => {
    const textById = (id) => document.getElementById(id)?.textContent?.trim() || '';
    const ids = [
      'kChws', 'kChwr', 'kDt', 'kFlow', 'kCool', 'kDp', 'kMachine', 'kSpecPwr',
      'kCdwRange', 'kDesignDuty', 'kFlowIt', 'kFlowHr', 'kFlowGap', 'spChwsTxt',
      'spDpTxt', 'spFlowTxt', 'asLevel', 'asCounts', 'asRedund', 'asChw', 'asLoad',
      'asMeta', 'sTitle', 'sMsg', 'alarmMeta', 'firstMeta', 'ackMeta', 'forcedMeta',
    ];
    return {
      consumers: Object.fromEntries(ids.map((id) => [id, textById(id)])),
      basisCard: textById('chiller-current-basis-value'),
      lines: Array.from(document.querySelectorAll('#pidSvg [data-rz-line]'))
        .map((node) => node.getAttribute('data-current') || ''),
      pidText: textById('pidSvg'),
      runningFlows: Array.from(document.querySelectorAll('#pidSvg .flow')).filter((node) => (
        getComputedStyle(node).animationName !== 'none'
      )).length,
      modalOpen: document.getElementById('loopModal')?.classList.contains('show') || false,
      modalAriaHidden: document.getElementById('loopModal')?.getAttribute('aria-hidden'),
      modalMode: textById('mMode'),
      modalStats: textById('mStats'),
      inspectorText: textById('chillerInspector'),
      disabledControls: Array.from(document.querySelectorAll(
        '#ackBtn,#unitSel,#scSel,#spChws,#spDp,#spFlow,#faultBtn,#clearBtn'
      )).every((node) => node.disabled),
    };
  });
}

function assertUnavailablePlant(state, label) {
  assert.ok(state.lines.length > 0, `${label}: unavailable semantic lines missing`);
  assert.match(state.basisCard, /UNAVAILABLE/i,
    `${label}: current-basis card must fail closed with the rest of the plant`);
  assert.doesNotMatch(state.basisCard, /(?:30(?:\.000)?|31\.250)\s*MW/i,
    `${label}: current-basis card must not leak a partial snapshot`);
  assert.ok(state.lines.every((value) => /UNAVAILABLE/i.test(value)),
    `${label}: chiller lines must fail closed: ${state.lines.slice(0, 4).join(' | ')}`);
  assert.ok(state.lines.every((value) => !/(?:^|\s)0(?:\.0)?\s*(?:MW|C|L\/s)/.test(value)),
    `${label}: missing chiller authority must not be coerced to a healthy zero`);
  for (const [id, value] of Object.entries(state.consumers)) {
    assert.match(value, /UNAVAILABLE/i, `${label}: ${id} must fail closed`);
    assert.doesNotMatch(value, /(?:^|\s)0(?:\.0)?\s*(?:MW|C|L\/s|kPa)/i,
      `${label}: ${id} must not show a healthy zero`);
  }
  assert.match(state.pidText, /CHILLER PLANT AUTHORITY UNAVAILABLE/i, `${label}: P&ID authority state`);
  assert.doesNotMatch(state.pidText, /(?:^|\s)0(?:\.0)?\s*(?:MW|C|L\/s|kPa)/i,
    `${label}: unavailable P&ID must not expose simulated zero instrumentation`);
  assert.equal(state.runningFlows, 0, `${label}: unavailable P&ID must stop flow animations`);
  assert.equal(state.modalOpen, false, `${label}: numeric shortcut must not open loop diagnostics`);
  assert.equal(state.modalAriaHidden, 'true', `${label}: unavailable loop modal must remain hidden`);
  assert.match(state.modalMode, /UNAVAILABLE/i, `${label}: modal status must remain fail closed`);
  assert.match(state.modalStats, /UNAVAILABLE/i, `${label}: hidden modal values must remain fail closed`);
  assert.match(state.inspectorText, /UNAVAILABLE/i,
    `${label}: deferred BMS shell must preserve explicit inspector authority state`);
  assert.equal(state.disabledControls, true, `${label}: commands must disable without plant authority`);
}

const server = createServer((request, response) => { void serve(request, response); });
await new Promise((accept, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', accept);
});
const address = server.address();
assert.ok(address && typeof address === 'object');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await primeCockpitAuditDocument(page, 'dark');
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('rz_geo_cache', JSON.stringify({
      ip: '203.0.113.9', country: 'Testland', cc: 'TEST', city: 'Cached City',
      region: 'Stale Region', tz: 'Etc/UTC', org: 'Audit Fixture', _ts: Date.now(),
    }));
  });
  const pageErrors = [];
  const requestedUrls = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    requestedUrls.push(url);
    if (url.startsWith(origin) || url.startsWith('data:')) request.continue();
    else request.abort();
  });

  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`${origin}/datahall.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('#zone-field .rack .rk-val', { timeout: 10_000 });
  const localTracker = await page.evaluate(() => {
    window.rzTrack('audit_local_geo');
    const events = JSON.parse(localStorage.getItem('rz_user_events') || '[]');
    return {
      cache: sessionStorage.getItem('rz_geo_cache'),
      event: events.find((entry) => entry.type === 'audit_local_geo') || null,
    };
  });
  assert.equal(localTracker.cache, null, 'localhost tracker must discard a stale geolocation cache');
  assert.deepEqual({
    ip: localTracker.event?.ip,
    country: localTracker.event?.country,
    cc: localTracker.event?.cc,
    city: localTracker.event?.city,
  }, { ip: '', country: '', cc: '', city: '' },
  'localhost tracker events must never reuse cached production-like geolocation');
  const hall = await page.evaluate(() => {
    const occupied = Array.from(document.querySelectorAll('#zone-field .rack'))
      .find((node) => /\d+\.\d+°C/.test(node.querySelector('.rk-val')?.textContent || ''));
    return {
      activeMode: document.querySelector('.mode-btn.active')?.getAttribute('data-mode'),
      rackValue: occupied?.querySelector('.rk-val')?.textContent || '',
      rackFill: occupied ? getComputedStyle(occupied).backgroundColor : '',
      balanceLabel: document.querySelector('#bb-balance')?.previousElementSibling?.textContent?.trim(),
      balance: document.getElementById('bb-balance')?.textContent?.trim(),
      balanceBasis: document.getElementById('bb-balsub')?.textContent?.trim(),
      bodyText: document.body.innerText,
    };
  });
  assert.equal(hall.activeMode, 'temp', 'rack-inlet temperature must be the default operator heatmap');
  assert.match(hall.rackValue, /^25\./, 'default rack field must expose the current 25.x C inlet plane');
  assert.equal(hall.rackFill, 'rgb(47, 94, 70)', '25.x C is inside 18-27 C and must render NORMAL green');
  assert.equal(hall.balanceLabel, 'Hall IT reconciliation');
  assert.equal(hall.balance, 'UNAVAILABLE', 'no hall EPMS submeter must fail closed');
  assert.match(hall.balanceBasis, /planning reference only/i);
  assert.match(hall.balanceBasis, /site EPMS 30\.000 MW ÷ 4 halls = 7\.500 MW/i);
  assert.doesNotMatch(hall.bodyText, /(?:NaN|null|undefined)/);

  await page.click('#dh-mode-toolbar button[data-layer="power"]');
  const powerMode = await page.evaluate(() => ({
    activeMode: document.querySelector('.mode-btn.active')?.getAttribute('data-mode'),
    pressed: document.querySelector('#dh-mode-toolbar button[data-layer="power"]')?.getAttribute('aria-pressed'),
    rackValue: Array.from(document.querySelectorAll('#zone-field .rack .rk-val'))
      .map((node) => node.textContent || '').find((value) => /kW$/.test(value)) || '',
  }));
  assert.equal(powerMode.activeMode, 'power', 'shared toolbar Power must drive the rack heatmap');
  assert.equal(powerMode.pressed, 'true', 'shared toolbar Power must expose its active state');
  assert.match(powerMode.rackValue, /kW$/, 'Power mode must render rack load values');

  await page.goto(`${origin}/chiller-plant.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('#asLevel', { timeout: 10_000 });
  await new Promise((accept) => setTimeout(accept, 1_650));
  const chiller = await page.evaluate(() => {
    const svg = document.getElementById('pidSvg');
    const status = document.querySelector('.status-strip');
    return {
      level: document.getElementById('asLevel')?.textContent?.trim(),
      counts: document.getElementById('asCounts')?.textContent?.trim(),
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      shellHeight: document.querySelector('.shell')?.getBoundingClientRect().height || 0,
      svgHeight: svg?.getBoundingClientRect().height || 0,
      statusBottom: status?.getBoundingClientRect().bottom || 0,
      documentHeight: document.documentElement.scrollHeight,
      loopTemperatures: Array.from(document.querySelectorAll('[id^="loop-"] .temp, [data-loop-temperature]'))
        .map((node) => node.textContent?.trim()).filter(Boolean),
      refrigeration: (typeof loopMetrics === 'function' && typeof st !== 'undefined')
        ? st.loops.map((loop) => ({
            ...loopMetrics(loop),
            exvPct: typeof exvPositionPct === 'function' ? exvPositionPct(loop) : null,
          }))
        : [],
      plantAuthority: (typeof PLANT !== 'undefined' && typeof st !== 'undefined') ? {
        cop: PLANT.cop,
        kwPerRt: PLANT.kwPerRt,
        capacityKw: PLANT.capacityKw,
        n1CapacityKw: PLANT.n1CapacityKw,
        copTrend: st.spark.cop.at(-1),
        kwPerRtTrend: st.spark.kwRt.at(-1),
      } : null,
      loopText: document.getElementById('pidSvg')?.textContent || '',
      bodyText: document.body.innerText,
    };
  });
  assert.equal(chiller.level, 'NORMAL', 'healthy engine-bound plant must not start in ALARM');
  assert.match(chiller.counts, /^0 Critical • 0 Warning$/);
  assert.notEqual(chiller.bodyOverflowY, 'hidden', 'full P&ID must use document scrolling, not viewport clipping');
  assert.ok(chiller.svgHeight >= 900, `P&ID was compressed to ${chiller.svgHeight}px`);
  assert.ok(chiller.documentHeight >= chiller.statusBottom, 'P&ID status strip must remain reachable');
  assert.match(chiller.loopText, /26\.[0-9]|27\.[0-9]/,
    'loop return temperatures must remain on the current 27 C CHWR plane after the simulation tick');
  assert.equal(chiller.refrigeration.length, 4, 'all visible chillers must publish refrigeration diagnostics');
  assert.deepEqual(chiller.plantAuthority, {
    cop: 6.06,
    kwPerRt: 0.58,
    capacityKw: 35_000,
    n1CapacityKw: 45_000,
    copTrend: 6.06,
    kwPerRtTrend: 0.58,
  }, 'P&ID trends and capacity block must use the validated engine authority');
  assert.match(chiller.loopText, /IT REFERENCE FLOW/i);
  assert.match(chiller.loopText, /CALCULATED\s*•\s*NOT METERED/i);
  assert.match(chiller.loopText, /CALC BRANCH REF/i);
  assert.match(chiller.loopText, /Run cap 35(?:\.0)? MW/i);
  assert.match(chiller.loopText, /N\+1 cap 45(?:\.0)? MW/i);
  assert.match(chiller.loopText, /N\+1 margin 13\.75 MW/i);
  assert.doesNotMatch(chiller.loopText, /\bMFM\d*\b|HEADER FLOW/i,
    'calculated references must not masquerade as flow-meter instrumentation');
  for (const metric of chiller.refrigeration) {
    assert.ok(metric.suction >= 300 && metric.suction <= 500,
      `normalised suction pressure escaped the authored operating band: ${metric.suction} kPa`);
    assert.ok(metric.discharge >= 800 && metric.discharge <= 1100,
      `normalised discharge pressure escaped the authored operating band: ${metric.discharge} kPa`);
    assert.ok(metric.subcool >= 3 && metric.subcool <= 6,
      `normalised subcooling escaped the authored operating band: ${metric.subcool} K`);
    assert.ok(metric.exvPct >= 70 && metric.exvPct < 95,
      `EXV must retain non-saturated modulation: ${metric.exvPct}%`);
  }
  assert.doesNotMatch(chiller.bodyText, /(?:NaN|null|undefined)/);

  assert.equal(await page.evaluate(() => openModal(1)), true, 'healthy loop diagnostics must open');
  const healthyGuide = await page.$eval('#mGuide', (node) => node.textContent.replace(/\s+/g, ' ').trim());
  assert.match(healthyGuide, /Loop is stable\. Continue normal monitoring\./i);
  assert.doesNotMatch(healthyGuide, /High dT|flow starvation/i,
    'governed 7.6 K dT must not trigger a retired-basis high-dT warning');
  await page.keyboard.press('Escape');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await page.evaluate(() => (
    Array.from(document.querySelectorAll('.flow,.comp-on'))
      .every((node) => getComputedStyle(node).animationName === 'none')
  )), true, 'chiller flow/compressor motion must honor reduced-motion preference');

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${origin}/chiller-plant.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('#pidSvg', { timeout: 10_000 });
  const mobileChillerPan = await page.evaluate(() => {
    const panel = document.querySelector('.pid-panel');
    if (!panel) return null;
    panel.scrollLeft = 500;
    return {
      clientWidth: panel.clientWidth,
      scrollWidth: panel.scrollWidth,
      scrollLeft: panel.scrollLeft,
      overflowX: getComputedStyle(panel).overflowX,
    };
  });
  assert.ok(mobileChillerPan, 'mobile chiller P&ID scrollport is missing');
  assert.ok(mobileChillerPan.clientWidth <= 390,
    `mobile chiller P&ID escaped the viewport at ${mobileChillerPan.clientWidth}px`);
  assert.ok(mobileChillerPan.scrollWidth > mobileChillerPan.clientWidth,
    'mobile chiller P&ID must retain a locally pannable engineering canvas');
  assert.ok(mobileChillerPan.scrollLeft > 0,
    'mobile chiller P&ID right edge is unreachable');

  const chillerWithoutEngine = await browser.newPage();
  await chillerWithoutEngine.setRequestInterception(true);
  chillerWithoutEngine.on('request', (request) => {
    const url = request.url();
    if (new URL(url).pathname.endsWith('/js/conv-engine.js')) request.abort();
    else if (url.startsWith(origin) || url.startsWith('data:')) request.continue();
    else request.abort();
  });
  await chillerWithoutEngine.goto(`${origin}/chiller-plant.html`, {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  assertUnavailablePlant(await readUnavailablePlant(chillerWithoutEngine), 'missing engine');
  await chillerWithoutEngine.close();

  const legacyChiller = await browser.newPage();
  await legacyChiller.setRequestInterception(true);
  legacyChiller.on('request', (request) => {
    const url = request.url();
    if (new URL(url).pathname.endsWith('/js/conv-engine.js')) {
      request.respond({ status: 200, contentType: 'text/javascript', body: LEGACY_CHILLER_ENGINE });
    } else if (url.startsWith(origin) || url.startsWith('data:')) request.continue();
    else request.abort();
  });
  await legacyChiller.goto(`${origin}/chiller-plant.html`, {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  assertUnavailablePlant(await readUnavailablePlant(legacyChiller), 'legacy engine version');
  await legacyChiller.close();

  const incompleteChiller = await browser.newPage();
  await incompleteChiller.setRequestInterception(true);
  incompleteChiller.on('request', (request) => {
    const url = request.url();
    if (new URL(url).pathname.endsWith('/js/conv-engine.js')) {
      request.respond({
        status: 200,
        contentType: 'text/javascript',
        body: INCOMPLETE_CURRENT_CHILLER_ENGINE,
      });
    } else if (url.startsWith(origin) || url.startsWith('data:')) request.continue();
    else request.abort();
  });
  await incompleteChiller.goto(`${origin}/chiller-plant.html`, {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  assertUnavailablePlant(await readUnavailablePlant(incompleteChiller), 'same-version incomplete engine');
  await incompleteChiller.close();

  const missingMetaChiller = await browser.newPage();
  await missingMetaChiller.setRequestInterception(true);
  missingMetaChiller.on('request', (request) => {
    const url = request.url();
    if (new URL(url).pathname.endsWith('/js/conv-engine.js')) {
      request.respond({
        status: 200,
        contentType: 'text/javascript',
        body: MISSING_META_CURRENT_CHILLER_ENGINE,
      });
    } else if (url.startsWith(origin) || url.startsWith('data:')) request.continue();
    else request.abort();
  });
  await missingMetaChiller.goto(`${origin}/chiller-plant.html`, {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  assertUnavailablePlant(await readUnavailablePlant(missingMetaChiller), 'same-version missing provenance');
  await missingMetaChiller.close();

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await page.goto(`${origin}/datahallAI.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('.rz-tq-banner', { timeout: 10_000 });
    await enterAuthorizedAuditState(page, 'dc-ai');
    const layout = await page.evaluate(() => {
      const rect = (node) => {
        const value = node.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
      };
      const header = document.querySelector('.hdr');
      const tabs = document.querySelector('.tabs');
      const slot = document.querySelector('[data-rz-telemetry-banner-slot]');
      const wrap = document.querySelector('.wrap');
      const main = document.querySelector('.mn');
      const dashboardGrid = document.querySelector('.ai-dashboard-grid');
      const dashboardImage = document.querySelector('.ai-dashboard-image');
      const sidebar = document.querySelector('.side');
      const sideToggle = document.getElementById('sideTog');
      const sideReopen = document.getElementById('sideReopen');
      const loginButton = document.getElementById('rzLoginBtn');
      const loginStyle = loginButton ? getComputedStyle(loginButton) : null;
      const beforeStyle = getComputedStyle(document.body, '::before');
      const afterStyle = getComputedStyle(document.body, '::after');
      return {
        chip: document.querySelector('.hdr h1 .chip')?.textContent?.trim(),
        provenance: document.querySelector('.rz-tq-banner-label')?.textContent?.trim(),
        slotInHeader: Boolean(slot && slot.closest('.hdr')),
        header: rect(header),
        tabs: rect(tabs),
        slot: rect(slot),
        wrap: rect(wrap),
        mainClientHeight: main?.clientHeight || 0,
        mainScrollHeight: main?.scrollHeight || 0,
        mainOverflowY: main ? getComputedStyle(main).overflowY : '',
        dashboardColumns: dashboardGrid ? getComputedStyle(dashboardGrid).gridTemplateColumns : '',
        dashboardImageWidth: dashboardImage?.getBoundingClientRect().width || 0,
        kpis: Object.fromEntries(['dkPue', 'dkWue', 'dkCue', 'dkIt', 'dkGpu', 'dkDom']
          .map((id) => [id, document.getElementById(id)?.textContent?.trim()])),
        sideCollapsed: wrap?.classList.contains('side-collapsed') || false,
        sidebarHeight: sidebar?.getBoundingClientRect().height || 0,
        sideToggleDisplay: sideToggle ? getComputedStyle(sideToggle).display : '',
        sideReopenDisplay: sideReopen ? getComputedStyle(sideReopen).display : '',
        authVisual: loginStyle ? {
          backgroundImage: loginStyle.backgroundImage,
          borderRadius: loginStyle.borderRadius,
          boxShadow: loginStyle.boxShadow,
          color: loginStyle.color,
        } : null,
        atmosphere: {
          beforeContent: beforeStyle.content,
          beforeImage: beforeStyle.backgroundImage,
          afterContent: afterStyle.content,
          afterImage: afterStyle.backgroundImage,
        },
        headerDotAnimation: getComputedStyle(document.querySelector('.hdr-r > .dot')).animationName,
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    assert.doesNotMatch(layout.chip, /Live Telemetry/i, 'simulated page must not claim live telemetry');
    assert.match(`${layout.chip} ${layout.provenance}`, /simulated/i);
    assert.deepEqual(layout.kpis, {
      dkPue: '1.30', dkWue: '0.00', dkCue: '0.90', dkIt: '14.26',
      dkGpu: '7,776', dkDom: '108',
    }, 'AI authority KPIs must never animate through plausible but false intermediate values');
    assert.equal(layout.slotInHeader, true, 'telemetry provenance must be a compact header instrument');
    assert.ok(layout.authVisual, 'cockpit auth control must be present for visual-contract validation');
    assert.equal(layout.authVisual.backgroundImage, 'none',
      'cockpit auth control must not use a decorative gradient');
    assert.ok(parseFloat(layout.authVisual.borderRadius) <= 4,
      `cockpit auth control radius drifted to ${layout.authVisual.borderRadius}`);
    assert.equal(layout.authVisual.boxShadow, 'none',
      'cockpit auth control must not use a decorative glow');
    assert.doesNotMatch(layout.authVisual.color, /167, 139, 250|139, 92, 246/,
      'cockpit auth control must not use the rejected purple accent');
    assert.equal(layout.atmosphere.beforeImage, 'none',
      'cockpit shell must not carry decorative graticule noise');
    assert.equal(layout.atmosphere.afterImage, 'none',
      'cockpit shell must not carry decorative scanline noise');
    assert.equal(boxesOverlap(layout.header, layout.tabs), false, `header overlapped tabs at ${viewport.width}px`);
    assert.ok(layout.wrap.bottom <= viewport.height + 1,
      `AI cockpit extended ${layout.wrap.bottom - viewport.height}px below the viewport at ${viewport.width}px`);
    assert.ok(layout.mainScrollHeight <= layout.mainClientHeight + 1 || /auto|scroll/.test(layout.mainOverflowY),
      `AI cockpit content is clipped without a reachable scrollport at ${viewport.width}px`);
    assert.ok(layout.horizontalOverflow <= 1,
      `AI cockpit overflowed ${layout.horizontalOverflow}px at ${viewport.width}px`);
    assert.equal(layout.headerDotAnimation, 'none',
      'AI telemetry dot must honor reduced-motion preference');
    if (viewport.width === 390) {
      assert.equal(layout.dashboardColumns.trim().split(/\s+/).length, 1,
        'AI mobile dashboard must stack the primary image above its status rail');
      assert.ok(layout.dashboardImageWidth >= 340,
        `AI mobile primary surface collapsed to ${layout.dashboardImageWidth}px`);
      assert.equal(layout.sideCollapsed, true,
        'AI mobile telemetry spine must default to its compact operator state');
      assert.ok(layout.sidebarHeight <= 64,
        `AI mobile telemetry spine consumed ${layout.sidebarHeight}px before operator expansion`);
      assert.notEqual(layout.sideToggleDisplay, 'none',
        'AI mobile telemetry spine must expose an explicit expand control');
      assert.equal(layout.sideReopenDisplay, 'none',
        'desktop sidebar reopen control must stay hidden on mobile');
      assert.ok(layout.header.bottom - layout.header.top <= 100,
        `AI mobile header consumed ${layout.header.bottom - layout.header.top}px of operator space`);
      const toggleGeometry = await page.$eval('#sideTog', (node) => {
        const box = node.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + (box.width / 2), box.top + (box.height / 2));
        return {
          box: { left: box.left, top: box.top, width: box.width, height: box.height },
          hitId: hit?.id || '',
          inert: Boolean(node.closest('[inert]')),
          pointerEvents: getComputedStyle(node).pointerEvents,
        };
      });
      assert.equal(toggleGeometry.hitId, 'sideTog',
        `AI mobile telemetry control is obscured: ${JSON.stringify(toggleGeometry)}`);
      await page.click('#sideTog');
      const expandedSidebar = await page.evaluate(() => ({
        collapsed: document.querySelector('.wrap')?.classList.contains('side-collapsed') || false,
        height: document.querySelector('.side')?.getBoundingClientRect().height || 0,
        label: document.getElementById('sideTog')?.getAttribute('aria-label') || '',
      }));
      assert.equal(expandedSidebar.collapsed, false,
        `AI mobile telemetry spine must expand on explicit operator request: ${JSON.stringify(toggleGeometry)}`);
      assert.ok(expandedSidebar.height >= 120,
        `AI mobile telemetry spine did not expose its detail (${expandedSidebar.height}px)`);
      assert.match(expandedSidebar.label, /collapse/i,
        'expanded mobile telemetry spine must advertise the inverse action');
      await page.click('#bodTrig');
      await page.waitForSelector('#bodDrawer.show', { timeout: 5_000 });
      const drawerLayout = await page.evaluate(() => {
        const drawer = document.getElementById('bodDrawer');
        const contractLayer = document.querySelector('.rz-public-contract-layer');
        const tableMetrics = Array.from(document.querySelectorAll('.dh-bod-tbl')).map((table) => ({
          clientWidth: table.clientWidth,
          scrollWidth: table.scrollWidth,
          overflow: table.scrollWidth - table.clientWidth,
          tableLayout: getComputedStyle(table).tableLayout,
          parentWidth: table.parentElement?.clientWidth || 0,
          widestCell: Array.from(table.querySelectorAll('td')).map((cell) => ({
            text: (cell.textContent || '').trim().slice(0, 72),
            overflow: cell.scrollWidth - cell.clientWidth,
            whiteSpace: getComputedStyle(cell).whiteSpace,
            overflowWrap: getComputedStyle(cell).overflowWrap,
          })).sort((left, right) => right.overflow - left.overflow)[0],
        }));
        const tableOverflow = tableMetrics.reduce((maximum, table) => Math.max(maximum, table.overflow), 0);
        return {
          clientWidth: drawer?.clientWidth || 0,
          scrollWidth: drawer?.scrollWidth || 0,
          tableOverflow,
          tableMetrics,
          contractLayerDisplay: contractLayer ? getComputedStyle(contractLayer).display : '',
        };
      });
      assert.ok(drawerLayout.scrollWidth <= drawerLayout.clientWidth + 1,
        `AI mobile basis drawer overflows by ${drawerLayout.scrollWidth - drawerLayout.clientWidth}px`);
      assert.ok(drawerLayout.tableOverflow <= 1,
        `AI mobile basis table clips engineering evidence: ${JSON.stringify(drawerLayout.tableMetrics)}`);
      assert.equal(drawerLayout.contractLayerDisplay, 'none',
        'public header links must not obscure an active engineering drawer');
    }
  }

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${origin}/dc-conventional.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await enterAuthorizedAuditState(page, 'dc-conventional');
  await page.waitForSelector('#alarmStrip', { timeout: 10_000 });
  const conventionalChrome = await page.evaluate(() => {
    const styles = (selector) => Array.from(document.querySelectorAll(selector)).map((node) => {
      const style = getComputedStyle(node);
      return {
        selector,
        text: (node.textContent || '').trim().slice(0, 48),
        backgroundImage: style.backgroundImage,
        backdropFilter: style.backdropFilter,
        borderRadius: Number.parseFloat(style.borderRadius) || 0,
        animationName: style.animationName,
        boxShadow: style.boxShadow,
        fontVariantNumeric: style.fontVariantNumeric,
        fontFeatureSettings: style.fontFeatureSettings,
      };
    });
    const alarm = document.getElementById('alarmStrip');
    const alarmStyle = getComputedStyle(alarm);
    const alarmRect = alarm.getBoundingClientRect();
    return {
      header: styles('.header')[0],
      buttons: styles('.back-btn'),
      badge: styles('.live-badge')[0],
      statusDot: styles('.status-dot')[0],
      numerics: styles('.kpi-value, .as-val, .stat-value, .callout-value'),
      alarm: {
        display: alarmStyle.display,
        columns: alarmStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        height: alarmRect.height,
        width: alarmRect.width,
        maxCellWidth: Math.max(...Array.from(alarm.querySelectorAll('.as-cell'))
          .map((node) => node.getBoundingClientRect().width)),
      },
    };
  });
  assert.equal(conventionalChrome.header.backdropFilter, 'none',
    'Conventional header must use a flat instrument surface without blur');
  assert.equal(conventionalChrome.header.backgroundImage, 'none',
    'Conventional header must not use a decorative gradient');
  assert.ok(conventionalChrome.buttons.every((button) => button.backgroundImage === 'none'),
    `Conventional controls must stay flat: ${JSON.stringify(conventionalChrome.buttons)}`);
  assert.ok(conventionalChrome.buttons.every((button) => button.borderRadius <= 4),
    'Conventional controls must keep restrained industrial corner radii');
  assert.equal(conventionalChrome.badge.animationName, 'none',
    'authority badge must not pulse');
  assert.equal(conventionalChrome.badge.boxShadow, 'none',
    'authority badge must not glow');
  assert.ok(conventionalChrome.badge.borderRadius <= 4,
    'authority badge must not render as a pill');
  assert.equal(conventionalChrome.statusDot.animationName, 'none',
    'header status must not blink under reduced motion');
  assert.ok(conventionalChrome.numerics.length >= 20,
    'Conventional cockpit numeric evidence is unexpectedly sparse');
  assert.ok(conventionalChrome.numerics.every((metric) => (
    metric.fontVariantNumeric.includes('tabular-nums')
      && metric.fontVariantNumeric.includes('slashed-zero')
      && /tnum/.test(metric.fontFeatureSettings)
      && /zero/.test(metric.fontFeatureSettings)
  )), `Conventional numerics lost operator typography: ${JSON.stringify(conventionalChrome.numerics)}`);
  assert.equal(conventionalChrome.alarm.display, 'grid',
    'mobile alarm summary must use a compact grid');
  assert.equal(conventionalChrome.alarm.columns, 3,
    'mobile alarm metrics must use three balanced columns');
  assert.ok(conventionalChrome.alarm.height <= 200,
    `mobile alarm summary is too tall at ${conventionalChrome.alarm.height}px`);
  assert.ok(conventionalChrome.alarm.maxCellWidth <= conventionalChrome.alarm.width / 2,
    'mobile alarm metrics must not waste half a row per value');

  const numericContracts = [
    ['datahall.html', '#bb-util'],
    ['chiller-plant.html', '.kv .v'],
    ['fire-system.html', '#m-tank-pct'],
    ['fuel-system.html', '#kpi-autonomy'],
    ['water-system.html', '#kWue'],
    ['EPMS_Telemetry.html', '#epms-fac'],
    ['datahallAI.html', '.rz-ops-metric__value'],
  ];
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  for (const [path, selector] of numericContracts) {
    await page.goto(`${origin}/${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector(selector, { timeout: 10_000 });
    const typography = await page.$eval(selector, (node) => {
      const style = getComputedStyle(node);
      return {
        family: style.fontFamily,
        feature: style.fontFeatureSettings,
        variant: style.fontVariantNumeric,
      };
    });
    assert.match(typography.family, /JetBrains Mono/i,
      `${path} numeric telemetry must use JetBrains Mono`);
    assert.match(typography.feature, /tnum/i,
      `${path} numeric telemetry must enable tabular OpenType figures`);
    assert.match(typography.feature, /zero/i,
      `${path} numeric telemetry must enable slashed-zero OpenType figures`);
    assert.match(typography.variant, /tabular-nums/i,
      `${path} numeric telemetry must expose tabular numeric semantics`);
    assert.match(typography.variant, /slashed-zero/i,
      `${path} numeric telemetry must expose slashed-zero semantics`);
  }

  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join(' | ')}`);
  assert.equal(requestedUrls.some((url) => url.startsWith('https://ipapi.co/')), false,
    'local cockpit validation must not call the third-party geolocation service');
  console.log('PASS operator cockpit thermal semantics, plant envelope, and AI header layout');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
