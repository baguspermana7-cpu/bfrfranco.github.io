import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const PAGE_SOURCE = await readFile(resolve(ROOT, 'dc-conventional.html'), 'utf8');
const ENGINE_SOURCE = await readFile(resolve(ROOT, 'js/conv-engine.js'), 'utf8');
const CURRENT_VERSION = '2.1.0';
const MIME = Object.freeze({
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});
const AUTHORITY_VALUE_IDS = Object.freeze([
  'kpiPue', 'kpiWue', 'kpiCarbon', 'kpiIt', 'kpiTemp', 'kpiChillers', 'kpiAlarms',
  'cPue', 'cIt', 'cChw', 'cTemp', 'cFuel', 'cRh',
  'sbStudy', 'sbScenario', 'sbHalls', 'sbDesign', 'sbUtil', 'sbRacks', 'sbRackKw',
  'sbUpsRed', 'sbChRed', 'sbNameplate',
  'sPue', 'sWue', 'sCue', 'sCueIt', 'sTotalLoad', 'sItLoad', 'sUpsA', 'sUpsB',
  'sChillerLoad', 'sChillers', 'sChwSup', 'sChwRet', 'sTempAvg', 'sRhAvg',
  'sFuelMain', 'sAutonomy',
]);

const FIXTURE_SOURCES = Object.freeze({
  healthy: ENGINE_SOURCE,
  missing: 'window.CONV_MODEL = undefined; window.CONV_CALC = undefined;',
  legacy: ENGINE_SOURCE.replace("version: '2.1.0'", "version: '1.9.0'"),
  incomplete: `
    window.CONV_MODEL = { meta: { version: '${CURRENT_VERSION}' } };
    window.CONV_CALC = {
      snapshot: {
        meta: { version: '${CURRENT_VERSION}', data_quality: 'GOOD', scenario: 'Simulated' },
        site: { pue: 1.45, it_load_kw: 30000, facility_load_kw: 43500 }
      }
    };
  `,
  'request-mismatch': ENGINE_SOURCE,
});

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.endsWith('/') ? `${decoded.slice(1)}index.html` : decoded.slice(1);
  const target = resolve(ROOT, relative || 'index.html');
  return target.startsWith(`${resolve(ROOT)}${sep}`) ? target : null;
}

async function serveFile(request, response) {
  const target = safeFilePath(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!target) { response.writeHead(403).end('Forbidden'); return; }
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

async function preparePage(browser, origin, fixture, javaScriptEnabled = true) {
  const page = await browser.newPage();
  const pageErrors = [];
  await page.setJavaScriptEnabled(javaScriptEnabled);
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (request.isNavigationRequest() && url.startsWith(`${origin}/dc-conventional.html`)) {
      const body = fixture === 'request-mismatch'
        ? PAGE_SOURCE.replace('js/conv-engine.js?v=2.1.0', 'js/conv-engine.js?v=1.9.0')
        : PAGE_SOURCE;
      request.respond({ status: 200, contentType: 'text/html', body });
      return;
    }
    if (/\/js\/conv-engine\.js(?:\?|$)/.test(url)) {
      request.respond({ status: 200, contentType: 'text/javascript', body: FIXTURE_SOURCES[fixture] });
      return;
    }
    if (url.startsWith(origin) || url.startsWith('data:')) {
      request.continue();
      return;
    }
    request.respond({ status: 204, contentType: 'text/plain', body: '' });
  });
  if (javaScriptEnabled) {
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('rz_premium_session', JSON.stringify({
        email: 'educator@resistancezero.com',
        tier: 'pro',
        role: 'educator',
        expires: '2099-12-31T23:59:59.000Z',
      }));
    });
  }
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${origin}/dc-conventional.html?authority=${fixture}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  return { page, pageErrors };
}

async function readAuthorityValues(page) {
  return page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
    const node = document.getElementById(id);
    return [id, node ? node.textContent.trim() : '<missing>'];
  })), AUTHORITY_VALUE_IDS);
}

function assertAllNeutral(values, label) {
  Object.entries(values).forEach(([id, value]) => {
    assert.match(value, /^(?:—|--|UNAVAILABLE)$/i, `${label}: #${id} must fail closed, got ${value}`);
  });
}

async function assertNeutralFirstPaint(browser, origin) {
  const { page } = await preparePage(browser, origin, 'healthy', false);
  const summary = await page.evaluate(() => ({
    state: document.getElementById('as-state-txt')?.textContent.trim(),
    comms: document.getElementById('as-comms')?.textContent.trim(),
    quality: document.getElementById('as-dq')?.textContent.trim(),
    scenario: document.getElementById('as-scn')?.textContent.trim(),
    badge: document.querySelector('.live-badge')?.textContent.trim(),
    badgeAnimation: getComputedStyle(document.querySelector('.live-badge')).animationName,
    statusAnimation: getComputedStyle(document.querySelector('.status-dot')).animationName,
    generateDisabled: document.getElementById('genDesignTrigConv')?.disabled,
    faqDisabled: document.getElementById('faqTrigConv')?.disabled,
    panelValues: Array.from(document.querySelectorAll('.stats-panel .stat-value'), (node) => node.textContent.trim()),
  }));
  assert.equal(summary.state, 'UNAVAILABLE');
  assert.equal(summary.comms, 'UNAVAILABLE');
  assert.equal(summary.quality, 'UNAVAILABLE');
  assert.equal(summary.scenario, 'UNAVAILABLE');
  assert.equal(summary.badge, 'AUTHORITY UNAVAILABLE');
  assert.equal(summary.badgeAnimation, 'none');
  assert.equal(summary.statusAnimation, 'none');
  assert.equal(summary.generateDisabled, true);
  assert.equal(summary.faqDisabled, true);
  assert.ok(summary.panelValues.every((value) => /^(?:—|UNAVAILABLE)$/i.test(value)),
    `first paint: stats panel contained plausible values: ${summary.panelValues.join(' | ')}`);
  assertAllNeutral(await readAuthorityValues(page), 'first paint');
  await page.close();
}

async function assertHealthyAuthority(browser, origin) {
  const { page, pageErrors } = await preparePage(browser, origin, 'healthy');
  await page.waitForFunction(() => document.body.dataset.convAuthority === 'current', { timeout: 30_000 });
  const summary = await page.evaluate(() => ({
    state: document.getElementById('as-state-txt')?.textContent.trim(),
    comms: document.getElementById('as-comms')?.textContent.trim(),
    quality: document.getElementById('as-dq')?.textContent.trim(),
    scenario: document.getElementById('as-scn')?.textContent.trim(),
    badge: document.querySelector('.live-badge')?.textContent.trim(),
    pue: document.getElementById('kpiPue')?.textContent.trim(),
    it: document.getElementById('kpiIt')?.textContent.trim(),
    generateDisabled: document.getElementById('genDesignTrigConv')?.disabled,
    faqDisabled: document.getElementById('faqTrigConv')?.disabled,
    authorityVersion: window.RZConvCurrentAuthority?.()?.version,
  }));
  assert.deepEqual(summary, {
    state: 'NORMAL',
    comms: 'OK',
    quality: 'GOOD',
    scenario: 'Simulated',
    badge: 'SIMULATED',
    pue: '1.45',
    it: '30,000',
    generateDisabled: false,
    faqDisabled: false,
    authorityVersion: CURRENT_VERSION,
  });
  assert.deepEqual(pageErrors, [], `healthy authority page errors: ${pageErrors.join(' | ')}`);
  await page.close();
}

async function assertInvalidAuthority(browser, origin, fixture) {
  const { page, pageErrors } = await preparePage(browser, origin, fixture);
  await page.waitForFunction(() => document.body.dataset.convAuthority === 'unavailable', { timeout: 30_000 });
  const summary = await page.evaluate(() => ({
    state: document.getElementById('as-state-txt')?.textContent.trim(),
    comms: document.getElementById('as-comms')?.textContent.trim(),
    quality: document.getElementById('as-dq')?.textContent.trim(),
    scenario: document.getElementById('as-scn')?.textContent.trim(),
    badge: document.querySelector('.live-badge')?.textContent.trim(),
    generateDisabled: document.getElementById('genDesignTrigConv')?.disabled,
    faqDisabled: document.getElementById('faqTrigConv')?.disabled,
    authority: window.RZConvCurrentAuthority?.(),
  }));
  assert.equal(summary.state, 'UNAVAILABLE', `${fixture}: state`);
  assert.equal(summary.comms, 'FAULT', `${fixture}: comms`);
  assert.equal(summary.quality, 'UNAVAILABLE', `${fixture}: quality`);
  assert.equal(summary.scenario, 'UNAVAILABLE', `${fixture}: scenario`);
  assert.equal(summary.badge, 'AUTHORITY UNAVAILABLE', `${fixture}: badge`);
  assert.equal(summary.generateDisabled, true, `${fixture}: Generate Design must be disabled`);
  assert.equal(summary.faqDisabled, true, `${fixture}: FAQ must be disabled`);
  assert.equal(summary.authority, null, `${fixture}: validator must reject fixture`);
  assertAllNeutral(await readAuthorityValues(page), fixture);

  const bypassAttempt = await page.evaluate(() => {
    window.__authorityAlerts = [];
    window.__authorityDocuments = 0;
    window.alert = (message) => window.__authorityAlerts.push(String(message));
    window.open = () => {
      window.__authorityDocuments += 1;
      return null;
    };
    const faq = document.getElementById('faqTrigConv');
    faq.disabled = false;
    faq.click();
    window.RZDesignStudio.open('dc-conventional-design');
    const snapshot = document.getElementById('rzDesignSnapshot')?.textContent.replace(/\s+/g, ' ').trim() || '';
    document.querySelector('.rz-design-studio__button--primary')?.click();
    return {
      alerts: window.__authorityAlerts,
      documents: window.__authorityDocuments,
      faqOpen: Boolean(document.getElementById('rzFaqDialogConv')),
      snapshot,
    };
  });
  assert.equal(bypassAttempt.documents, 0, `${fixture}: document path must remain closed`);
  assert.equal(bypassAttempt.faqOpen, false, `${fixture}: FAQ path must remain closed`);
  assert.match(bypassAttempt.snapshot, /UNAVAILABLE/i, `${fixture}: forced Studio must disclose unavailable authority`);
  assert.ok(bypassAttempt.alerts.some((message) => /authority|engine/i.test(message)),
    `${fixture}: forced path must explain authority loss`);
  assert.deepEqual(pageErrors, [], `${fixture}: page errors: ${pageErrors.join(' | ')}`);
  await page.close();
}

const { server, origin } = await startServer();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  await assertNeutralFirstPaint(browser, origin);
  await assertHealthyAuthority(browser, origin);
  for (const fixture of ['missing', 'legacy', 'incomplete', 'request-mismatch']) {
    await assertInvalidAuthority(browser, origin, fixture);
  }
  console.log('PASS Conventional dashboard current-authority fail-closed contract');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
