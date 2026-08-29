import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const CURRENT_ENGINE_SOURCE = await readFile(resolve(ROOT, 'js/conv-engine.js'), 'utf8');
const BLANK_METADATA_ENGINE = CURRENT_ENGINE_SOURCE
  .replace("scenario: 'Simulated'", "scenario: '   '")
  .replace("data_quality: 'GOOD'", "data_quality: ''");
assert.notEqual(BLANK_METADATA_ENGINE, CURRENT_ENGINE_SOURCE,
  'blank-metadata fixture must alter the current engine source');
const MIME = Object.freeze({
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});

const LEGACY_ENGINE = `window.CONV_CALC = Object.freeze({
  snapshot: Object.freeze({
    meta: Object.freeze({ version:'1.9.9', scenario:'Simulated', data_quality:'GOOD' }),
    site: Object.freeze({ it_load_kw:1850, facility_load_kw:2682.5, non_it_load_kw:832.5, pue:1.45 }),
    racks: Object.freeze({ at_8kw:231 }),
    campus: Object.freeze({ halls:Object.freeze(['A','B','C','D']) }),
    electrical: Object.freeze({
      epms_total_kw:2682.5, ups_system_count:2, ups_module_kw_rated:300,
      ups_modules_per_system:4, ups_system_kw:1200
    })
  }),
  getHallSnapshot:function(){ return {}; }, wueFromFlowLpm:function(){ return 1.2; }
});`;

const INCOMPLETE_CURRENT_ENGINE = `window.CONV_CALC = Object.freeze({
  snapshot: Object.freeze({
    meta: Object.freeze({ version:'2.0.0', scenario:'Simulated', data_quality:'GOOD' }),
    site: Object.freeze({ it_load_kw:30000, facility_load_kw:43500, non_it_load_kw:13500, pue:1.45 }),
    racks: Object.freeze({}),
    campus: Object.freeze({ halls:Object.freeze(['A','B','C','D']) }),
    electrical: Object.freeze({
      epms_total_kw:43500, ups_system_count:2, ups_module_kw_rated:300,
      ups_modules_per_system:73
    })
  }),
  getHallSnapshot:function(){ return {}; }, wueFromFlowLpm:function(){ return 1.2; }
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

async function openFixture(browser, origin, pageName, fixture) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (new URL(url).pathname.endsWith('/js/conv-engine.js')) {
      if (fixture === null) request.abort();
      else if (fixture === undefined) request.continue();
      else request.respond({ status: 200, contentType: 'text/javascript', body: fixture });
    } else if (url.startsWith(origin) || url.startsWith('data:')) request.continue();
    else request.abort();
  });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${origin}/${pageName}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await new Promise((accept) => setTimeout(accept, 180));
  return { page, errors };
}

async function readIct(page) {
  return page.evaluate(() => ({
    authority: document.body.getAttribute('data-rz-basis-authority'),
    basis: document.getElementById('m-basis')?.textContent.trim(),
    quality: document.getElementById('m-quality')?.textContent.trim(),
    alarm: ['as-state', 'as-crit', 'as-warn', 'as-stale', 'as-scenario']
      .map((id) => document.getElementById(id)?.textContent.trim()),
    ops: Array.from(document.querySelectorAll('[data-ict-ops-state]')).map((node) => node.textContent.trim()),
    gateways: Array.from(document.querySelectorAll('[data-ict-gateway]')).map((node) => node.textContent.trim()),
    nav: Array.from(document.querySelectorAll('.nav-item')).map((node) => ({
      disabled: node.getAttribute('aria-disabled'),
      count: node.querySelector('.ncount')?.textContent.trim(),
      led: node.querySelector('.nled')?.className,
    })),
    canvas: document.getElementById('canvas')?.textContent.replace(/\s+/g, ' ').trim(),
    inspector: [document.getElementById('insp-title')?.textContent, document.getElementById('insp-sub')?.textContent].join(' '),
    bottom: ['sb-sys-v', 'sb-traffic', 'sb-util', 'sb-links', 'sb-alarms']
      .map((id) => document.getElementById(id)?.textContent.trim()),
    filtersDisabled: Array.from(document.querySelectorAll(
      '#alarm-filter-panel input,#alarm-filter-panel select,#alarm-filter-panel button,#alarm-filter-toggle'
    )).every((node) => node.disabled),
    telemetryBanner: document.querySelector('.rz-tq-banner-label')?.textContent.trim(),
    telemetryState: document.querySelector('.rz-tq-banner')?.getAttribute('data-rz-tq-state'),
    bodyText: document.body.innerText,
  }));
}

function assertIctUnavailable(state, label) {
  assert.equal(state.authority, 'unavailable', `${label}: ICT authority flag`);
  assert.equal(state.basis, 'UNAVAILABLE');
  assert.equal(state.quality, 'UNAVAILABLE');
  assert.ok(state.alarm.every((value) => value === 'UNAVAILABLE' || value === '—'));
  assert.ok(state.ops.every((value) => value === 'UNAVAILABLE'));
  assert.ok(state.gateways.every((value) => /Unavailable$/.test(value)));
  assert.ok(state.nav.every((item) => item.disabled === 'true' && item.count === '—' && item.led === 'nled'));
  assert.match(state.canvas, /ICT AUTHORITY UNAVAILABLE/i);
  assert.match(state.inspector, /AUTHORITY UNAVAILABLE/i);
  assert.ok(state.bottom.every((value) => value === 'UNAVAILABLE' || value === '—'));
  assert.equal(state.filtersDisabled, true);
  assert.equal(state.telemetryBanner, 'COMMS LOST — AUTHORITY UNAVAILABLE');
  assert.equal(state.telemetryState, 'comms_lost');
  assert.doesNotMatch(state.bodyText, /(?:\bNaN\b|\bInfinity\b|nullkW|undefinedkW)/i);
}

async function readEpms(page) {
  return page.evaluate(() => ({
    authority: document.body.getAttribute('data-rz-basis-authority'),
    state: document.getElementById('epms-state')?.textContent.trim(),
    header: ['epms-fac', 'epms-it', 'epms-pue', 'epms-utility', 'epms-ups', 'epms-gen',
      'epms-trips', 'epms-ups-basis', 'epms-ups-modules', 'epms-ups-sys', 'epms-dq', 'epms-scn']
      .map((id) => document.getElementById(id)?.textContent.trim()),
    bottom: ['val-system', 'val-total-load', 'val-breakers', 'val-alarms']
      .map((id) => document.getElementById(id)?.textContent.trim()),
    diagram: document.getElementById('scene')?.textContent.replace(/\s+/g, ' ').trim(),
    telemetry: Array.from(document.querySelectorAll('.tele-txt')).map((node) => node.textContent.trim()),
    runningFlows: Array.from(document.querySelectorAll('.flow')).filter((node) => (
      getComputedStyle(node).animationName !== 'none'
    )).length,
    controlsDisabled: Array.from(document.querySelectorAll(
      '#btn-u-a,#btn-u-b,#btn-tie,#btn-gen-a,#btn-gen-b,#btn-gen-c,.export-btn,.export-item'
    )).every((node) => node.getAttribute('aria-disabled') === 'true'),
    bodyText: document.body.innerText,
  }));
}

function assertEpmsUnavailable(state, label) {
  assert.equal(state.authority, 'unavailable', `${label}: EPMS authority flag`);
  assert.match(state.state, /AUTHORITY UNAVAILABLE/);
  assert.ok(state.header.every((value) => value === '—'), `${label}: ${state.header.join(' | ')}`);
  assert.ok(state.bottom.every((value) => value === 'UNAVAILABLE' || value === '—'));
  assert.match(state.diagram, /EPMS AUTHORITY UNAVAILABLE/);
  assert.deepEqual(state.telemetry, []);
  assert.equal(state.runningFlows, 0);
  assert.equal(state.controlsDisabled, true);
  assert.doesNotMatch(state.bodyText, /(?:\bNaN\b|\bInfinity\b|nullkW|undefinedkW)/i);
}

const ictSource = await readFile(resolve(ROOT, 'ict.html'), 'utf8');
const epmsSource = await readFile(resolve(ROOT, 'EPMS_Telemetry.html'), 'utf8');
assert.match(ictSource, /id="m-basis"[^>]*>UNAVAILABLE<\/b>/, 'ICT first paint must fail closed');
assert.match(ictSource, /id="as-state">UNAVAILABLE<\/span>/, 'ICT alarm first paint must fail closed');
assert.match(epmsSource, /id="epms-state"[^>]*>EPMS AUTHORITY UNAVAILABLE<\/span>/,
  'EPMS first paint must fail closed');
assert.match(epmsSource, /id="epms-fac"[^>]*>—<\/b>/, 'EPMS facility first paint must fail closed');

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
    ['legacy engine', LEGACY_ENGINE],
    ['same-version incomplete engine', INCOMPLETE_CURRENT_ENGINE],
    ['same-version blank provenance', BLANK_METADATA_ENGINE],
  ]) {
    const ict = await openFixture(browser, origin, 'ict.html', fixture);
    assertIctUnavailable(await readIct(ict.page), label);
    assert.deepEqual(ict.errors, [], `${label}: ICT page errors: ${ict.errors.join(' | ')}`);
    await ict.page.close();

    const epms = await openFixture(browser, origin, 'EPMS_Telemetry.html', fixture);
    assertEpmsUnavailable(await readEpms(epms.page), label);
    assert.deepEqual(epms.errors, [], `${label}: EPMS page errors: ${epms.errors.join(' | ')}`);
    await epms.page.close();
  }

  const healthyIct = await openFixture(browser, origin, 'ict.html', undefined);
  await new Promise((accept) => setTimeout(accept, 100));
  const ictState = await readIct(healthyIct.page);
  assert.equal(ictState.authority, 'current');
  assert.equal(ictState.basis, 'IT 30.00 MW');
  assert.equal(ictState.quality, 'GOOD');
  assert.ok(ictState.ops.every((value) => value === 'OK'));
  assert.ok(ictState.gateways.every((value) => /Online$/.test(value)));
  assert.match(ictState.telemetryBanner, /Simulated telemetry.*engine-derived basis/i);
  assert.equal(ictState.telemetryState, 'simulated');
  assert.match(ictState.canvas, /Capacity Summary/i);
  assert.deepEqual(healthyIct.errors, [], `current ICT page errors: ${healthyIct.errors.join(' | ')}`);
  await healthyIct.page.close();

  const healthyEpms = await openFixture(browser, origin, 'EPMS_Telemetry.html', undefined);
  await new Promise((accept) => setTimeout(accept, 700));
  const epmsState = await readEpms(healthyEpms.page);
  assert.equal(epmsState.authority, 'current');
  assert.equal(epmsState.state, 'EPMS NORMAL');
  assert.deepEqual(epmsState.header.slice(0, 3), ['43.50', '30.00', '1.45']);
  assert.equal(epmsState.bottom[1], '43,500 kW', 'EPMS bottom total must reconcile to the governed aggregate');
  assert.match(epmsState.diagram, /200 racks/, 'each of ten rack columns must disclose its aggregate scope');
  assert.ok(epmsState.telemetry.length > 0);
  assert.ok(epmsState.telemetry.filter((value) => /AGG 3,000kW · 200 racks/.test(value)).length === 10,
    'all ten final rack legs must carry reconciled aggregate IT load rather than retired 6 kW labels');
  assert.ok(epmsState.runningFlows > 0);
  const epmsChrome = await healthyEpms.page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right } : null;
    };
    return {
      contextBottom: rect('#epms-legend')?.bottom,
      topbar: rect('.topbar'),
      sidebar: rect('.sidebar'),
      statusbar: rect('.status-bar'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  assert.ok(epmsChrome.topbar.top >= epmsChrome.contextBottom,
    `EPMS topbar overlaps the authority/legend strips (${epmsChrome.topbar.top} < ${epmsChrome.contextBottom})`);
  assert.ok(epmsChrome.sidebar.top >= epmsChrome.topbar.bottom,
    'EPMS sidebar must start below the topbar');
  assert.ok(epmsChrome.sidebar.bottom <= epmsChrome.statusbar.top + 1,
    'EPMS sidebar must stop above the bottom status bar');
  assert.ok(epmsChrome.overflow <= 2, `EPMS desktop overflowed by ${epmsChrome.overflow}px`);
  await healthyEpms.page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await healthyEpms.page.evaluate(() => (
    Array.from(document.querySelectorAll('.flow')).every((node) => getComputedStyle(node).animationName === 'none')
  )), true, 'EPMS must disable line-flow motion for reduced-motion users');
  assert.deepEqual(healthyEpms.errors, [], `current EPMS page errors: ${healthyEpms.errors.join(' | ')}`);
  await healthyEpms.page.close();
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}

console.log('PASS ICT and EPMS current/legacy/missing/incomplete authority closure');
