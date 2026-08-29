import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const PAGE_SOURCE = await readFile(resolve(ROOT, 'datahallAI.html'), 'utf8');
const MODEL_SOURCE = await readFile(resolve(ROOT, 'js/datahall-model.js'), 'utf8');
const CALC_SOURCE = await readFile(resolve(ROOT, 'js/datahall-calculations.js'), 'utf8');
const ASSET_VERSION = '1.20.0';
const SPEC_VERSION = 'review-2026-05-17';
const CORE_ACTION_IDS = Object.freeze([
  'bodTrig', 'bodDrawerPdf', 'genDesignTrig', 'faqTrig',
  'platformProfile', 'electricalScenario', 'fireScenario', 'fireZone', 'fireEvaluate',
]);
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

const MODEL_FIXTURES = Object.freeze({
  healthy: MODEL_SOURCE,
  missing: 'window.DATAHALL_MODEL = undefined;',
  legacy: MODEL_SOURCE.replace(
    `specVersion: '${SPEC_VERSION}'`,
    "specVersion: 'review-2025-01-01'",
  ),
  incomplete: MODEL_SOURCE.replace(
    "authority: 'BASELINE-DECISION.md (locked 2026-05-17) — overrides all conflicts'",
    "authority: ''",
  ),
  'request-mismatch': MODEL_SOURCE,
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
    if (request.isNavigationRequest() && url.startsWith(`${origin}/datahallAI.html`)) {
      const body = fixture === 'request-mismatch'
        ? PAGE_SOURCE.replace('js/datahall-calculations.js?v=1.20.0', 'js/datahall-calculations.js?v=1.19.0')
        : PAGE_SOURCE;
      request.respond({ status: 200, contentType: 'text/html', body });
      return;
    }
    if (/\/js\/datahall-model\.js(?:\?|$)/.test(url)) {
      request.respond({ status: 200, contentType: 'text/javascript', body: MODEL_FIXTURES[fixture] });
      return;
    }
    if (/\/js\/datahall-calculations\.js(?:\?|$)/.test(url)) {
      const body = fixture === 'missing' ? 'window.DATAHALL_CALC = undefined;' : CALC_SOURCE;
      request.respond({ status: 200, contentType: 'text/javascript', body });
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
  await page.goto(`${origin}/datahallAI.html?authority=${fixture}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  if (javaScriptEnabled) {
    await page.waitForFunction(() => ['current', 'unavailable'].includes(document.body.dataset.datahallAuthority), {
      timeout: 30_000,
    });
  }
  return { page, pageErrors };
}

async function authorityView(page) {
  return page.evaluate((actionIds) => {
    const panel = document.getElementById('datahallAuthorityUnavailable');
    const wrap = document.querySelector('.wrap');
    const tabs = document.getElementById('tabs');
    return {
      state: document.body.dataset.datahallAuthority,
      authorityText: panel?.textContent.replace(/\s+/g, ' ').trim() || '',
      panelDisplay: panel ? getComputedStyle(panel).display : '<missing>',
      wrapDisplay: wrap ? getComputedStyle(wrap).display : '<missing>',
      tabsDisplay: tabs ? getComputedStyle(tabs).display : '<missing>',
      wrapInert: Boolean(wrap?.inert),
      chip: document.getElementById('datahallAuthorityChip')?.textContent.trim() || '<missing>',
      telemetryBanner: document.querySelector('.rz-tq-banner-label')?.textContent.trim() || '<missing>',
      telemetryState: document.querySelector('.rz-tq-banner')?.getAttribute('data-rz-tq-state') || '<missing>',
      actions: Object.fromEntries(actionIds.map((id) => [id, document.getElementById(id)?.disabled])),
      authority: window.RZDatahallCurrentAuthority?.() || null,
    };
  }, CORE_ACTION_IDS);
}

function assertActions(view, disabled, fixture) {
  Object.entries(view.actions).forEach(([id, actual]) => {
    assert.equal(actual, disabled, `${fixture}: #${id} disabled state`);
  });
}

async function assertNeutralFirstPaint(browser, origin) {
  const { page } = await preparePage(browser, origin, 'healthy', false);
  const view = await authorityView(page);
  assert.equal(view.state, 'unavailable');
  assert.match(view.authorityText, /UNAVAILABLE/i);
  assert.notEqual(view.panelDisplay, 'none');
  assert.equal(view.wrapDisplay, 'none');
  assert.equal(view.tabsDisplay, 'none');
  assert.equal(view.wrapInert, true);
  assert.equal(view.chip, 'AUTHORITY UNAVAILABLE');
  assertActions(view, true, 'first paint');
  await page.close();
}

async function assertHealthyAuthority(browser, origin) {
  const { page, pageErrors } = await preparePage(browser, origin, 'healthy');
  const view = await authorityView(page);
  assert.equal(view.state, 'current');
  assert.equal(view.panelDisplay, 'none');
  assert.notEqual(view.wrapDisplay, 'none');
  assert.notEqual(view.tabsDisplay, 'none');
  assert.equal(view.wrapInert, false);
  assert.equal(view.chip, 'DH-01 | GB200 NVL72 | Simulated');
  assert.match(view.telemetryBanner, /Simulated.*engine basis/i);
  assert.equal(view.telemetryState, 'simulated');
  assert.equal(view.authority.assetVersion, ASSET_VERSION);
  assert.equal(view.authority.specVersion, SPEC_VERSION);
  assert.equal(view.authority.state.itPerHall_kW, 3564);
  assert.equal(Number(view.authority.pue.pue.toFixed(2)), 1.3);
  assertActions(view, false, 'healthy');

  const currentDataWording = await page.evaluate(() => {
    document.getElementById('bodTrig')?.click();
    const kpiHeadings = Array.from(document.querySelectorAll('#p-cool text, #p-elec text'))
      .map((node) => node.textContent.trim())
      .filter((value) => /KPI/i.test(value));
    return [
      document.querySelector('#kW')?.closest('.k')?.querySelector('.kl')?.title || '',
      document.querySelector('#platformStudyDetail')?.textContent || '',
      document.querySelector('.dh-bod-adv')?.textContent || '',
      document.querySelector('#alarmResultsBody')?.closest('table')?.caption?.textContent || '',
      Array.from(document.querySelectorAll('.dh-bod-sec .tag')).map((node) => node.textContent).join(' '),
      ...kpiHeadings,
    ].join(' | ');
  });
  assert.doesNotMatch(currentDataWording, /\b(?:live|real[ -]?time)\b/i,
    'current simulated values must not be labelled live or real-time');
  assert.doesNotMatch(PAGE_SOURCE,
    /(?:live engine|live cockpit|IT load \(live\)|facility load \(live\)|\b(?:feed [ab]|busway [ab]|psu-[ab]|cooling system)[^'"\n]{0,30}\blive\b)/i,
    'current operational and generated-document labels must disclose simulated/validated data');
  assert.match(PAGE_SOURCE, /capacity planning, asset tracking, real-time monitoring, API integration/i,
    'clearly architectural capability prose may retain real-time terminology');
  assert.deepEqual(pageErrors, [], `healthy page errors: ${pageErrors.join(' | ')}`);
  await page.close();
}

async function assertInvalidAuthority(browser, origin, fixture) {
  const { page, pageErrors } = await preparePage(browser, origin, fixture);
  const view = await authorityView(page);
  assert.equal(view.state, 'unavailable', `${fixture}: authority state`);
  assert.match(view.authorityText, /UNAVAILABLE/i, `${fixture}: central status`);
  assert.notEqual(view.panelDisplay, 'none', `${fixture}: central status visibility`);
  assert.equal(view.wrapDisplay, 'none', `${fixture}: telemetry must be hidden`);
  assert.equal(view.tabsDisplay, 'none', `${fixture}: telemetry navigation must be hidden`);
  assert.equal(view.wrapInert, true, `${fixture}: process surface must be inert`);
  assert.equal(view.chip, 'AUTHORITY UNAVAILABLE', `${fixture}: header chip`);
  assert.equal(view.telemetryBanner, 'COMMS LOST — AUTHORITY UNAVAILABLE', `${fixture}: telemetry provenance`);
  assert.equal(view.telemetryState, 'comms_lost', `${fixture}: telemetry quality state`);
  assert.equal(view.authority, null, `${fixture}: validator result`);
  assertActions(view, true, fixture);

  const bypass = await page.evaluate(() => {
    window.__authorityAlerts = [];
    window.__authorityDocuments = 0;
    window.alert = (message) => window.__authorityAlerts.push(String(message));
    window.open = () => {
      window.__authorityDocuments += 1;
      return null;
    };
    const wrap = document.querySelector('.wrap');
    if (wrap) { wrap.inert = false; }
    ['bodTrig', 'genDesignTrig', 'faqTrig', 'fireEvaluate'].forEach((id) => {
      const action = document.getElementById(id);
      if (action) { action.disabled = false; }
    });
    const fireSummary = document.getElementById('fireCauseEffectSummary');
    if (fireSummary) { fireSummary.textContent = 'AUTHORITY-GUARD-SENTINEL'; }
    document.getElementById('bodTrig')?.click();
    document.getElementById('faqTrig')?.click();
    document.getElementById('fireEvaluate')?.click();
    window.RZDesignStudio?.open('dc-ai-design');
    const snapshot = document.getElementById('rzDesignSnapshot')?.textContent.replace(/\s+/g, ' ').trim() || '';
    document.querySelector('.rz-design-studio__button--primary')?.click();
    return {
      alerts: window.__authorityAlerts,
      documents: window.__authorityDocuments,
      bodOpen: document.getElementById('bodDrawer')?.classList.contains('show'),
      faqOpen: Boolean(document.getElementById('rzFaqDialog')),
      fireSummary: fireSummary?.textContent.trim(),
      snapshot,
    };
  });
  assert.equal(bypass.documents, 0, `${fixture}: generated documents`);
  assert.equal(bypass.bodOpen, false, `${fixture}: Basis of Design bypass`);
  assert.equal(bypass.faqOpen, false, `${fixture}: FAQ bypass`);
  assert.equal(bypass.fireSummary, 'AUTHORITY-GUARD-SENTINEL', `${fixture}: process-action bypass`);
  assert.match(bypass.snapshot, /UNAVAILABLE/i, `${fixture}: Design Studio disclosure`);
  assert.ok(bypass.alerts.some((message) => /authority|engine/i.test(message)),
    `${fixture}: bypass explanation`);
  assert.deepEqual(pageErrors, [], `${fixture} page errors: ${pageErrors.join(' | ')}`);
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
  console.log('PASS AI Data Hall current-authority fail-closed contract');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
