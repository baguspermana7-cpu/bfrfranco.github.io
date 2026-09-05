import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';
import { createRequire as __rzRequire } from 'node:module';
const ENGINE_PUBLISHED_VERSION = (() => {
  const m = __rzRequire(import.meta.url)(process.cwd() + '/js/conv-engine.js');
  return (m.CONV_CALC || m).snapshot.meta.version;
})();

const ROOT = process.cwd();
const PAGE_PATH = resolve(ROOT, 'datahall.html');
const MIME = Object.freeze({
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});

const LEGACY_ENGINE = `window.CONV_CALC = Object.freeze({
  snapshot: Object.freeze({
    meta: Object.freeze({ version: '1.9.9', scenario: 'Simulated', data_quality: 'GOOD' }),
    site: Object.freeze({ it_load_kw: 1850, pue: 1.45 }),
    electrical: Object.freeze({ epms_ups_output_kw: 1850 }),
    cooling: Object.freeze({
      rack_inlet_target_c: 25.4, crah_supply_air_c: 25.4,
      supply_path_mixing_k: 0, chw_coil_approach_k: 6,
      chws_c: 19.4, chwr_c: 27, chw_delta_t: 7.6, flow_lps: 58.2,
      heat_rejection_kw: 1927, chillers_running: 2, chillers_total: 3
    }),
    environment: Object.freeze({ avg_rh_pct: 48 })
  }),
  listHalls: function () { return ['A', 'B', 'C', 'D']; },
  getHallSnapshot: function (code) {
    return /^[ABCD]$/.test(code) ? Object.freeze({
      code: code, it_load_kw: 1850, facility_load_kw: 2682.5, it_design_kw: 3000,
      utilisation_pct: 61.7, racks: 200, rack_design_avg_kw: 15,
      rack_selected_peak_kw: 30
    }) : null;
  }
});`;

const INCOMPLETE_CURRENT_ENGINE = `window.CONV_CALC = Object.freeze({
  snapshot: Object.freeze({
    meta: Object.freeze({ version: '2.1.0', scenario: 'Simulated', data_quality: 'GOOD' }),
    site: Object.freeze({ it_load_kw: 30000, pue: 1.45 }),
    electrical: Object.freeze({ epms_ups_output_kw: 30000 }),
    cooling: Object.freeze({
      rack_inlet_target_c: 25.4, crah_supply_air_c: 25.4,
      chws_c: 19.4, chwr_c: 27, chw_delta_t: 7.6,
      heat_rejection_kw: 31250, chillers_running: 7, chillers_total: 10
    }),
    environment: Object.freeze({ avg_rh_pct: 48 })
  }),
  listHalls: function () { return ['A', 'B', 'C', 'D']; },
  getHallSnapshot: function (code) {
    return /^[ABCD]$/.test(code) ? Object.freeze({
      code: code, it_load_kw: 7500, facility_load_kw: 10875, it_design_kw: 10000,
      utilisation_pct: 75, racks: 500, rack_design_avg_kw: 20,
      rack_selected_peak_kw: 30
    }) : null;
  }
});`;

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
    response.writeHead(200, {
      'Content-Type': MIME[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
  }
}

async function readAuthorityState(page) {
  await new Promise((accept) => setTimeout(accept, 120));
  return page.evaluate(() => {
    const text = (id) => document.getElementById(id)?.textContent?.trim() || '';
    const ids = [
      'as-state-txt', 'as-crit', 'as-warn', 'as-maint', 'as-comms', 'as-dq', 'as-scn',
      'dh-hall-state', 'dh-rack-load', 'dh-cooling-margin', 'dh-pue', 'dh-pd',
      'ch-count', 'th-inlet', 'th-supply', 'th-mixing', 'th-approach', 'chws', 'chwr',
      'chdt', 'chflow', 'f-flow', 'bb-itload', 'bb-itsub', 'bb-facsub', 'bb-racks',
      'bb-avg', 'bb-util', 'bb-design', 'bb-balance', 'bb-balsub', 'bb-cool',
      'bb-coolsub', 'bb-np1', 'bb-np1sub', 'alarm-list', 'env-temp', 'env-hot-aisle',
      'env-return', 'env-rh', 'env-dewpoint', 'env-hot', 'density-current',
      'density-study', 'density-peak', 'sel-detail', 'crah-list', 'crah-air-note',
      'm-title', 'm-sub', 'm-grid', 'm-source', 'cp-title', 'cp-state', 'cp-grid', 'log-box',
    ];
    if (typeof window.__inspectCrah === 'function') window.__inspectCrah(1);
    if (typeof window.__fireDatahallExcursion === 'function') window.__fireDatahallExcursion();
    const disabledBasisTrigger = document.querySelector('[data-basis-param-unavailable]');
    disabledBasisTrigger?.click();
    const forcedBasisOpenResult = window.RZBasisDrawer?.open('hall.it_load_kw');
    const sharedDrawer = document.getElementById('rz-basis-drawer');
    return {
      consumers: Object.fromEntries(ids.map((id) => [id, text(id)])),
      alarmStateClass: document.getElementById('as-state')?.className || '',
      n1Class: document.getElementById('bb-np1')?.className || '',
      commsClass: document.getElementById('as-comms')?.className || '',
      hotClass: document.getElementById('env-hot')?.className || '',
      modalVisible: getComputedStyle(document.getElementById('unitModal')).display !== 'none',
      popoverOpen: document.getElementById('crahPop')?.classList.contains('open') || false,
      controlsDisabled: Array.from(document.querySelectorAll(
        '#hall-selector button,.mode-btn,#dh-mode-toolbar button'
      )).every((node) => node.disabled || node.getAttribute('aria-disabled') === 'true'),
      floorChildren: document.querySelectorAll('#zone-field .rack,#crah-top .crah-cell,#crah-bottom .crah-cell').length,
      authorityFlag: window.RZ_DATAHALL_AUTHORITY_AVAILABLE,
      activeBasisTriggers: document.querySelectorAll('[data-basis-param],[data-basis]').length,
      disabledBasisTriggers: document.querySelectorAll(
        '[data-basis-param-unavailable],[data-basis-unavailable]'
      ).length,
      forcedBasisOpenResult,
      sharedDrawerVisible: sharedDrawer ? getComputedStyle(sharedDrawer).display !== 'none' : false,
      sharedDrawerText: sharedDrawer?.textContent?.replace(/\s+/g, ' ').trim() || '',
    };
  });
}

function assertUnavailable(state, label) {
  for (const [id, value] of Object.entries(state.consumers)) {
    assert.match(value, /UNAVAILABLE/i, `${label}: ${id} must fail closed, received ${value}`);
    assert.doesNotMatch(value, /(?:NORMAL|GOOD|PASS|No active alarms|\bRUN(?:NING)?\b)/i,
      `${label}: ${id} exposed a plausible healthy state`);
  }
  assert.doesNotMatch(state.alarmStateClass, /\bnormal\b/i, `${label}: alarm strip stayed green`);
  assert.doesNotMatch(state.n1Class, /\bpass\b/i, `${label}: N+1 stayed PASS`);
  assert.doesNotMatch(state.commsClass, /\bv-ok\b/i, `${label}: comms stayed healthy`);
  assert.doesNotMatch(state.hotClass, /\bv-ok\b/i, `${label}: environment stayed healthy`);
  assert.equal(state.modalVisible, false, `${label}: hidden equipment modal opened`);
  assert.equal(state.popoverOpen, false, `${label}: CRAH popover opened without authority`);
  assert.equal(state.controlsDisabled, true, `${label}: controls stayed actionable`);
  assert.equal(state.floorChildren, 0, `${label}: synthetic healthy floor rendered without authority`);
  assert.equal(state.authorityFlag, false, `${label}: exported authority flag must be false`);
  assert.equal(state.activeBasisTriggers, 0, `${label}: live basis triggers remained available`);
  assert.ok(state.disabledBasisTriggers > 0, `${label}: basis triggers were not explicitly disabled`);
  assert.equal(state.forcedBasisOpenResult, false, `${label}: forced shared drawer open was not rejected`);
  assert.equal(state.sharedDrawerVisible, false, `${label}: shared basis drawer exposed static values`);
  assert.doesNotMatch(state.sharedDrawerText, /(?:7,500|1\.45)/,
    `${label}: shared basis drawer leaked a plausible current value`);
}

async function openWithEngine(browser, origin, fixture) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/js/conv-engine.js')) {
      if (fixture === null) request.abort();
      else request.respond({ status: 200, contentType: 'text/javascript', body: fixture });
    } else if (url.startsWith(origin) || url.startsWith('data:')) request.continue();
    else request.abort();
  });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${origin}/datahall.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  return { page, errors };
}

const source = await readFile(PAGE_PATH, 'utf8');
/* v1.134.23 — this asserted the cache token as the LITERAL 2.0.0. Bumping the engine to
   2.1.0 broke it here and in three sibling gates, while the pages themselves were correct:
   the gate was pinning a version, not checking agreement. Read the published version instead,
   so the assertion keeps its meaning when the engine legitimately moves. Whether the pages
   AGREE with it is tools/test-conv-engine-version-pins.mjs's job. */
assert.match(source, new RegExp('<script src="js/conv-engine\\.js\\?v='
  + ENGINE_PUBLISHED_VERSION.replace(/\./g, '\\.') + '"></script>'),
  'data hall must request the governed engine revision');
assert.match(source, /id="as-state-txt">UNAVAILABLE<\/div>/,
  'alarm strip first paint must begin fail closed');
assert.match(source, /id="dh-cooling-margin"[^>]*>UNAVAILABLE<\/b>/,
  'cooling-margin first paint must not ship a plausible literal');
assert.doesNotMatch(source, /(?:~2,350 kW|2 chillers × 1,175 kW|output:'18 %')/,
  'retired cooling-margin operands must not remain in the drawer');

const server = createServer((request, response) => { void serve(request, response); });
await new Promise((accept, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', accept);
});
const address = server.address();
assert.ok(address && typeof address === 'object');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

try {
  for (const [label, fixture] of [
    ['missing engine', null],
    ['legacy engine version', LEGACY_ENGINE],
    ['same-version incomplete engine', INCOMPLETE_CURRENT_ENGINE],
  ]) {
    const { page, errors } = await openWithEngine(browser, origin, fixture);
    assertUnavailable(await readAuthorityState(page), label);
    assert.deepEqual(errors, [], `${label}: page errors: ${errors.join(' | ')}`);
    await page.close();
  }

  const current = await browser.newPage();
  const currentErrors = [];
  current.on('pageerror', (error) => currentErrors.push(error.message));
  await current.setRequestInterception(true);
  current.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(origin) || url.startsWith('data:')) request.continue();
    else request.abort();
  });
  await current.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await current.goto(`${origin}/datahall.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await current.waitForSelector('#zone-field .rack', { timeout: 10_000 });
  const healthy = await current.evaluate(() => ({
    authority: window.RZ_DATAHALL_AUTHORITY_AVAILABLE,
    state: document.getElementById('as-state-txt')?.textContent.trim(),
    rackLoad: document.getElementById('dh-rack-load')?.textContent.trim(),
    margin: document.getElementById('dh-cooling-margin')?.textContent.trim(),
    cooling: document.getElementById('bb-cool')?.textContent.trim(),
    coolingSub: document.getElementById('bb-coolsub')?.textContent.trim(),
    controlsEnabled: Array.from(document.querySelectorAll(
      '#hall-selector button,.mode-btn,#dh-mode-toolbar button'
    )).every((node) => !node.disabled && node.getAttribute('aria-disabled') !== 'true'),
  }));
  assert.equal(healthy.authority, true);
  assert.equal(healthy.state, 'NORMAL');
  assert.equal(healthy.rackLoad, '7.50');
  assert.equal(healthy.margin, '0.5', 'Hall cooling margin must be (7,540-7,500)/7,540');
  assert.equal(healthy.cooling, '7.500 / 7.540 MW');
  assert.match(healthy.coolingSub, /Hall operating headroom 40 kW.*0\.53% of available/i);
  assert.doesNotMatch(healthy.coolingSub, /31,250|heat-rej/i,
    'Hall cooling band must not inject campus heat rejection');
  assert.equal(healthy.controlsEnabled, true);

  await current.click('[data-basis="margin"]');
  const drawer = await current.$eval('#kpiBasisDrawer', (node) => node.textContent.replace(/\s+/g, ' ').trim());
  assert.match(drawer, /7,500 kW/);
  assert.match(drawer, /7,540 kW/);
  assert.match(drawer, /40 kW/);
  assert.match(drawer, /0\.53 %/);
  assert.doesNotMatch(drawer, /2,350|1,175|18 %|31,250/);
  await current.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await new Promise((accept) => setTimeout(accept, 120));
  const alarmLayout = await current.evaluate(() => {
    const strip = document.getElementById('alarmStrip')?.getBoundingClientRect();
    const state = document.getElementById('as-state')?.getBoundingClientRect();
    const scenario = document.querySelector('.as-scenario')?.getBoundingClientRect();
    const cells = Array.from(document.querySelectorAll('#alarmStrip > .as-cell')).map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });
    return { strip, state, scenario, cells };
  });
  assert.ok(alarmLayout.cells.every((cell) => cell.left >= 0 && cell.right <= 390 && cell.width > 0),
    `data hall alarm cell escaped mobile viewport: ${JSON.stringify(alarmLayout.cells)}`);
  assert.equal(Math.round(alarmLayout.state.width), Math.round(alarmLayout.strip.width),
    'data hall state row must span both mobile columns');
  assert.equal(Math.round(alarmLayout.scenario.width), Math.round(alarmLayout.strip.width),
    'data hall provenance row must span both mobile columns');
  assert.deepEqual(currentErrors, [], `current engine page errors: ${currentErrors.join(' | ')}`);
  await current.close();
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}

console.log('PASS data hall authority fail-closed and Hall cooling margin');
