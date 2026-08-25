import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const VIEW_DESKTOP = { width: 1440, height: 900 };
const VIEW_MOBILE = { width: 375, height: 812, isMobile: true };
const AXE_SOURCE = await readFile(resolve(ROOT, 'tools/vendor/axe.min.js'), 'utf8');
const TEST_SCOPE = process.env.RZ_TELEMETRY_E2E_SCOPE || 'all';
const PRESERVED_MOCKUP_OVERFLOW_PX = 50;
let formulaCoverage = Object.freeze({ total: 0, scrollable: 0, static: 0 });
assert.ok(['all', 'docs', 'cockpits'].includes(TEST_SCOPE), 'invalid RZ_TELEMETRY_E2E_SCOPE');
const DOCS = [
  'prd/index.html', 'manual/index.html',
  'prd/epms-telemetry.html', 'manual/epms-telemetry.html',
  'prd/datahallai.html', 'manual/datahallai.html',
  'prd/dc-conventional.html', 'manual/dc-conventional.html',
  'prd/datahall.html', 'manual/datahall.html',
  'prd/cdu-mini-bms.html', 'manual/cdu-mini-bms.html',
  'prd/rz-cockpit-mockup.html', 'manual/rz-cockpit-mockup.html',
];
const COCKPITS = [
  { path: 'EPMS_Telemetry.html', slug: 'epms-telemetry', control: 'epms' },
  {
    path: 'datahallAI.html', slug: 'datahallai', control: 'datahallai',
    gate: '.root-gate', protectedControl: '#genDesignTrig',
  },
  {
    path: 'dc-conventional.html', slug: 'dc-conventional', control: 'conventional',
    gate: '.rz-restricted-overlay', protectedControl: '#genDesignTrigConv',
  },
  { path: 'datahall.html', slug: 'datahall', control: 'datahall' },
  { path: 'cdu-mini-bms.html', slug: 'cdu-mini-bms', control: 'cdu' },
  { path: 'rz-cockpit-mockup.html', slug: 'rz-cockpit-mockup', control: 'mockup' },
];
const MIME = Object.freeze({
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.json': 'application/json', '.mjs': 'text/javascript', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2',
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

function configuredOrigin() {
  const raw = process.env.RZ_TELEMETRY_TEST_ORIGIN;
  if (!raw) return null;
  const url = new URL(raw);
  assert.equal(url.protocol, 'http:', 'telemetry E2E origin must use local HTTP');
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'telemetry E2E origin must be loopback');
  assert.equal(url.username, '', 'telemetry E2E origin must not contain credentials');
  assert.equal(url.password, '', 'telemetry E2E origin must not contain credentials');
  return url.origin;
}

function collectPageErrors(page) {
  const errors = [];
  const onConsole = (message) => { if (message.type() === 'error') errors.push(message.text()); };
  const onPageError = (error) => { errors.push(error.message); };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  return { errors, stop: () => {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  } };
}

async function openPage(page, origin, path) {
  await page.goto(`${origin}/${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await settlePage(page);
}

async function settlePage(page) {
  await new Promise((accept) => setTimeout(accept, 250));
  await page.evaluate(async () => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    await new Promise((accept) => requestAnimationFrame(() => requestAnimationFrame(accept)));
    window.scrollTo(0, 0);
  });
}

async function assertAxeClean(page, path, theme) {
  await page.evaluate(AXE_SOURCE);
  const blocking = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    });
    return result.violations
      .filter((violation) => ['critical', 'serious'].includes(violation.impact))
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.slice(0, 4).map((node) => node.target.join(' ')),
      }));
  });
  assert.deepEqual(blocking, [], `${path}: ${theme} axe violations: ${JSON.stringify(blocking)}`);
}

async function assertDocSurface(page, path, mobile, theme) {
  const result = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const main = document.querySelector('main');
    const mainBg = main ? getComputedStyle(main).backgroundColor : body.backgroundColor;
    const hiddenGate = [...document.querySelectorAll('[id*="gate" i], [class*="gate" i]')]
      .every((node) => getComputedStyle(node).display === 'none');
    return {
      bodyBg: body.backgroundColor,
      mainBg,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      hiddenGate,
      shell: Boolean(document.querySelector('nav.navbar') && document.querySelector('.hamburger')),
      navBottom: document.querySelector('nav.navbar')?.getBoundingClientRect().bottom || 0,
      mainTop: main?.firstElementChild?.getBoundingClientRect().top
        ?? main?.getBoundingClientRect().top ?? 0,
      version: window.RZ_VERSION,
      fontFamily: body.fontFamily,
      tableAffordance: [...document.querySelectorAll('.mn-tablewrap')]
        .filter((node) => node.scrollWidth > node.clientWidth + 1)
        .every((node) => node.tabIndex === 0 && Boolean(node.querySelector('.mn-table-hint'))
          && getComputedStyle(node.querySelector('th:first-child,td:first-child')).position === 'sticky'),
      formulaStates: [...document.querySelectorAll('.mn-formula')].map((node) => ({
        scrollable: node.scrollWidth > node.clientWidth + 1,
        tabIndex: node.tabIndex,
        role: node.getAttribute('role'),
        label: node.getAttribute('aria-label'),
      })),
      privacyPath: document.querySelector('#cookieBanner a')?.pathname || '',
    };
  });
  assert.ok(result.shell, `${path}: site shell must render`);
  assert.ok(result.hiddenGate, `${path}: public documentation must not be access-gated`);
  assert.ok(
    result.mainTop >= result.navBottom - 1,
    `${path}: main content overlaps fixed navbar (${result.mainTop}px < ${result.navBottom}px)`,
  );
  assert.ok(result.overflow <= 1, `${path}: ${mobile ? 'mobile' : 'desktop'} overflow ${result.overflow}px`);
  assert.equal(result.version, '1.129.0', `${path}: version stamp must load`);
  assert.match(result.fontFamily, /IBM Plex Sans/i, `${path}: canonical font must be active`);
  assert.ok(result.tableAffordance, `${path}: wide tables need keyboard scroll hint and sticky identity`);
  const invalidFormulas = result.formulaStates.filter((formula) => formula.scrollable
    ? formula.tabIndex !== 0 || formula.role !== 'region' || !formula.label
    : formula.tabIndex >= 0 || formula.role !== null || formula.label !== null);
  assert.deepEqual(invalidFormulas, [], `${path}: formula focusability must match actual overflow`);
  const scrollableFormulas = result.formulaStates.filter((formula) => formula.scrollable).length;
  formulaCoverage = Object.freeze({
    total: formulaCoverage.total + result.formulaStates.length,
    scrollable: formulaCoverage.scrollable + scrollableFormulas,
    static: formulaCoverage.static + result.formulaStates.length - scrollableFormulas,
  });
  assert.equal(result.privacyPath, '/privacy.html', `${path}: cookie policy must resolve from the site root`);
  if (theme === 'dark') {
    assert.ok(!/rgb\(25[0-5], 25[0-5], 25[0-5]\)/.test(result.bodyBg), `${path}: dark body is white`);
  }
}

async function verifyDocTheme(browser, origin, path, theme) {
  const page = await browser.newPage();
  const capture = collectPageErrors(page);
  try {
    await page.evaluateOnNewDocument((activeTheme) => {
      localStorage.setItem('theme', activeTheme);
      localStorage.setItem('rz_theme', activeTheme);
      localStorage.removeItem('rz_cookie_consent');
    }, theme);
    await page.setViewport(VIEW_DESKTOP);
    await openPage(page, origin, path);
    await assertDocSurface(page, path, false, theme);
    await assertAxeClean(page, path, theme);
    if (theme === 'dark') {
      await page.setViewport(VIEW_MOBILE);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await settlePage(page);
      await assertDocSurface(page, path, true, theme);
    }
    assert.deepEqual(capture.errors, [], `${path}: console/page errors: ${capture.errors.join(' | ')}`);
  } finally {
    capture.stop();
    await page.close();
  }
}

async function verifyDoc(browser, origin, path) {
  await verifyDocTheme(browser, origin, path, 'light');
  await verifyDocTheme(browser, origin, path, 'dark');
}

async function verifyControl(page, control) {
  if (control === 'epms') {
    await page.click('.zoom-btn[title="75%"]');
    assert.equal(await page.$eval('#zoomIndicator', (node) => node.textContent.trim()), '75%');
  } else if (control === 'datahall') {
    await page.click('.mode-btn[data-mode="temp"]');
    assert.ok(await page.$eval('.mode-btn[data-mode="temp"]', (node) => node.classList.contains('active')));
  } else if (control === 'cdu') {
    await page.click('#simPlay');
    assert.equal(await page.$eval('#simPlay', (node) => node.getAttribute('aria-pressed')), 'false');
    assert.equal(await page.$eval('#simStep', (node) => node.disabled), false);
  } else if (control === 'datahallai') {
    await page.click('#faqTrig');
    assert.ok(await page.$('#rzFaqDialog'));
  } else if (control === 'conventional') {
    await page.click('#faqTrigConv');
    assert.ok(await page.$('#rzFaqDialogConv'));
  } else {
    await page.waitForFunction(() => document.querySelector('[data-count="7776"]')?.textContent.includes('7,776'));
  }
}

async function enterAuthorizedUiState(page) {
  await page.evaluate(() => {
    const clearAuthOverlays = () => {
      if (document.body.classList.contains('locked')) document.body.classList.remove('locked');
      document.querySelectorAll('.root-gate, .rz-restricted-overlay, .rz-modal-overlay')
        .forEach((node) => node.remove());
    };
    const observer = new MutationObserver(clearAuthOverlays);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    clearAuthOverlays();
    window.__rzTelemetryGateObserver = observer;
  });
}

async function assertLockedControlBlocked(page, cockpit) {
  if (!cockpit.protectedControl) return;
  const state = await page.evaluate((selector) => {
    const control = document.querySelector(selector);
    const header = control?.closest('.hdr, .header');
    const rect = control?.getBoundingClientRect();
    control?.focus();
    return {
      headerInert: Boolean(header?.inert),
      focused: document.activeElement === control,
      center: rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null,
    };
  }, cockpit.protectedControl);
  assert.ok(state.headerInert && !state.focused && state.center,
    `${cockpit.path}: locked protected header control is keyboard-reachable: ${JSON.stringify(state)}`);
  await page.evaluate((selector) => {
    window.__rzProtectedActivationCount = 0;
    document.querySelector(selector).addEventListener('click', () => {
      window.__rzProtectedActivationCount += 1;
    });
  }, cockpit.protectedControl);
  await page.keyboard.press('Enter');
  await page.mouse.click(state.center.x, state.center.y);
  assert.equal(await page.evaluate(() => window.__rzProtectedActivationCount), 0,
    `${cockpit.path}: protected header control activated while locked`);
}

async function assertRouteClick(page, origin, cockpit, kind) {
  await openPage(page, origin, cockpit.path);
  if (cockpit.gate) {
    const gateState = await page.evaluate((selector) => {
      const gate = document.querySelector(selector);
      return {
        locked: document.body.classList.contains('locked'),
        visible: Boolean(gate) && getComputedStyle(gate).display !== 'none',
      };
    }, cockpit.gate);
    assert.deepEqual(gateState, { locked: true, visible: true }, `${cockpit.path}: auth gate must remain active`);
    await assertLockedControlBlocked(page, cockpit);
  }
  const href = `${kind}/${cockpit.slug}.html`;
  const selector = cockpit.gate
    ? `.rz-public-contract-layer a[href="${href}"]`
    : `a[href="${href}"]`;
  const visibility = await page.$eval(selector, (node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const unobstructed = top === node || node.contains(top);
    return {
      visible: style.display !== 'none' && style.visibility !== 'hidden'
        && rect.width > 0 && rect.height > 0 && unobstructed,
      top: top ? `${top.tagName.toLowerCase()}#${top.id}.${top.className}` : 'none',
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      locked: document.body.classList.contains('locked'),
      gateExists: Boolean(document.querySelector('.root-gate')),
      headerZ: document.querySelector('.hdr, .header')
        ? getComputedStyle(document.querySelector('.hdr, .header')).zIndex : 'none',
      overlayZ: document.querySelector('.rz-modal-overlay')
        ? getComputedStyle(document.querySelector('.rz-modal-overlay')).zIndex : 'none',
    };
  });
  assert.ok(visibility.visible, `${cockpit.path}: ${kind} button must be visible: ${JSON.stringify(visibility)}`);
  const expectedPath = `/${href}`;
  await page.click(selector);
  try {
    await page.waitForFunction((expected) => location.pathname === expected, { timeout: 10_000 }, expectedPath);
  } catch (error) {
    throw new Error(`${cockpit.path}: ${kind} click stayed at ${page.url()}`, { cause: error });
  }
  assert.equal(new URL(page.url()).pathname, expectedPath, `${cockpit.path}: ${kind} route mismatch`);
}

async function verifyLegacyCachedNavigation(browser, origin, cockpit) {
  if (!cockpit.gate) return;
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/js/rz-mobile-nav.js') {
      void request.respond({ status: 200, contentType: 'text/javascript', body: '/* cached pre-release nav */' });
      return;
    }
    if (pathname === '/css/rz-cockpit-instrument.css') {
      void request.respond({ status: 200, contentType: 'text/css', body: '/* cached pre-release cockpit CSS */' });
      return;
    }
    void request.continue();
  });
  try {
    await openPage(page, origin, cockpit.path);
    const state = await page.evaluate(() => {
      const links = [...document.querySelectorAll('.rz-public-contract-layer a')].map((node) => {
        const rect = node.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          href: node.getAttribute('href'),
          width: rect.width,
          height: rect.height,
          topmost: top === node || node.contains(top),
        };
      });
      return { locked: document.body.classList.contains('locked'), links };
    });
    assert.equal(state.locked, true, `${cockpit.path}: legacy-cache probe must remain locked`);
    assert.equal(state.links.length, 2,
      `${cockpit.path}: network-first auth bootstrap must survive cached legacy navigation`);
    for (const link of state.links) {
      assert.ok(link.width >= 44 && link.height >= 44 && link.topmost,
        `${cockpit.path}: cached legacy assets must leave ${link.href} usable: ${JSON.stringify(link)}`);
    }
    await assertLockedControlBlocked(page, cockpit);
    for (const kind of ['prd', 'manual']) {
      await openPage(page, origin, cockpit.path);
      const expectedPath = `/${kind}/${cockpit.slug}.html`;
      await page.click(`.rz-public-contract-layer a[href="${kind}/${cockpit.slug}.html"]`);
      await page.waitForFunction((expected) => location.pathname === expected, { timeout: 10_000 }, expectedPath);
      assert.equal(new URL(page.url()).pathname, expectedPath,
        `${cockpit.path}: cached legacy assets must preserve ${kind} navigation`);
    }
  } finally {
    await page.close();
  }
}

async function verifyCockpitMobile(browser, origin, cockpit) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('rz_theme', 'dark');
  });
  await page.setViewport(VIEW_MOBILE);
  try {
    await openPage(page, origin, cockpit.path);
    const result = await page.evaluate((slug) => {
      const links = ['prd', 'manual'].map((kind) => {
        const href = `${kind}/${slug}.html`;
        const node = document.querySelector(`.rz-public-contract-layer a[href="${href}"]`)
          || document.querySelector(`a[href="${href}"]`);
        if (!node) return { kind, missing: true };
        const rect = node.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          kind,
          height: rect.height,
          width: rect.width,
          visible: getComputedStyle(node).visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
          unobstructed: top === node || node.contains(top),
          top: top ? `${top.tagName.toLowerCase()}#${top.id}.${top.className}` : 'none',
        };
      });
      const hamburger = document.querySelector('.hamburger')?.getBoundingClientRect();
      return {
        links,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        locked: document.body.classList.contains('locked'),
        hamburger: hamburger ? { width: hamburger.width, height: hamburger.height } : null,
      };
    }, cockpit.slug);
    const allowedOverflow = cockpit.control === 'mockup' ? PRESERVED_MOCKUP_OVERFLOW_PX : 1;
    assert.ok(result.overflow <= allowedOverflow,
      `${cockpit.path}: mobile overflow ${result.overflow}px exceeds preserved baseline ${allowedOverflow}px`);
    for (const link of result.links) {
      assert.ok(!link.missing && link.visible && link.unobstructed,
        `${cockpit.path}: mobile ${link.kind} link blocked: ${JSON.stringify(link)}`);
      assert.ok(link.width >= 44, `${cockpit.path}: mobile ${link.kind} target is ${link.width}px wide`);
      assert.ok(link.height >= 44, `${cockpit.path}: mobile ${link.kind} target is ${link.height}px high`);
    }
    if (cockpit.gate) assert.equal(result.locked, true, `${cockpit.path}: mobile gate must remain locked`);
    if (cockpit.control === 'cdu') {
      assert.ok(result.hamburger && result.hamburger.width >= 44 && result.hamburger.height >= 44,
        `${cockpit.path}: hamburger target too small: ${JSON.stringify(result.hamburger)}`);
    }
  } finally {
    await page.close();
  }
}

async function verifyLockedManualFab(browser, origin) {
  const page = await browser.newPage();
  try {
    for (const viewport of [VIEW_DESKTOP, VIEW_MOBILE]) {
      await page.setViewport(viewport);
      await openPage(page, origin, 'dc-market-tracker.html');
      await page.waitForSelector('.rz-manual-fab', { visible: true });
      const state = await page.evaluate(() => {
        const link = document.querySelector('.rz-manual-fab');
        link.focus();
        const rect = link.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + (rect.width / 2), rect.top + (rect.height / 2));
        return {
          locked: document.body.classList.contains('locked'),
          focused: document.activeElement === link,
          hitTested: hit === link || link.contains(hit),
          landmarkTag: link.parentElement?.tagName.toLowerCase(),
          landmarkRole: link.parentElement?.getAttribute('role'),
          rect: {
            top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left,
            width: rect.width, height: rect.height,
          },
          viewport: { width: innerWidth, height: innerHeight },
        };
      });
      assert.equal(state.locked, true, 'dc-market-tracker must exercise the logged-out lock state');
      assert.equal(state.focused, true, 'manual FAB must remain keyboard focusable while locked');
      assert.equal(state.hitTested, true, 'manual FAB must remain pointer-accessible above the lock gate');
      assert.equal(state.landmarkTag, 'div', 'manual FAB landmark must avoid locked > nav selectors');
      assert.equal(state.landmarkRole, 'navigation', 'manual FAB must retain landmark semantics');
      assert.ok(state.rect.top >= 0 && state.rect.bottom <= state.viewport.height,
        `manual FAB must stay vertically visible: ${JSON.stringify(state)}`);
      assert.ok(state.rect.left >= 0 && state.rect.right <= state.viewport.width,
        `manual FAB must stay horizontally visible: ${JSON.stringify(state)}`);
      assert.ok(state.rect.width >= 44 && state.rect.height >= 44,
        `manual FAB must retain a 44px pointer target: ${JSON.stringify(state)}`);
      await page.click('#rootLoginBtn');
      await page.waitForSelector('#rzModalOverlay.show', { visible: true });
      const modalTopmost = await page.evaluate(() => {
        const link = document.querySelector('.rz-manual-fab');
        const overlay = document.querySelector('#rzModalOverlay.show');
        const rect = link.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + (rect.width / 2), rect.top + (rect.height / 2));
        return overlay === hit || overlay.contains(hit);
      });
      assert.equal(modalTopmost, true, 'authentication modal must cover the manual FAB');
      await page.evaluate(() => window._rzAuth.hideModal());
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.click('.rz-manual-fab'),
      ]);
      assert.equal(new URL(page.url()).pathname, '/manual/dc-market-tracker.html',
        'manual FAB must navigate to its public manual while the cockpit is locked');
    }
  } finally {
    await page.close();
  }
}

async function verifyCockpit(browser, origin, cockpit) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('rz_theme', 'dark');
  });
  await page.setViewport(VIEW_DESKTOP);
  try {
    process.stdout.write(`checking ${cockpit.path}\n`);
    await verifyLegacyCachedNavigation(browser, origin, cockpit);
    await assertRouteClick(page, origin, cockpit, 'prd');
    await assertRouteClick(page, origin, cockpit, 'manual');
    await openPage(page, origin, cockpit.path);
    if (cockpit.gate) await enterAuthorizedUiState(page);
    await verifyControl(page, cockpit.control);
  } finally {
    await page.close();
  }
  await verifyCockpitMobile(browser, origin, cockpit);
}

const externalOrigin = configuredOrigin();
const localServer = externalOrigin ? null : await startServer();
const server = localServer?.server;
const origin = externalOrigin || localServer.origin;
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
try {
  if (TEST_SCOPE !== 'cockpits') {
    for (const path of DOCS) await verifyDoc(browser, origin, path);
    assert.ok(formulaCoverage.total > 0, 'documentation E2E must exercise formulas');
    assert.ok(formulaCoverage.scrollable > 0, 'documentation E2E must exercise an overflowing formula');
    assert.ok(formulaCoverage.static > 0, 'documentation E2E must exercise a non-overflowing formula');
  }
  if (TEST_SCOPE !== 'docs') {
    for (const cockpit of COCKPITS) await verifyCockpit(browser, origin, cockpit);
    await verifyLockedManualFab(browser, origin);
  }
  const evidence = await browser.newPage();
  await evidence.setViewport(VIEW_DESKTOP);
  await openPage(evidence, origin, 'prd/index.html');
  await evidence.screenshot({ path: '/tmp/rz-telemetry-prd-hub-desktop.png', fullPage: true });
  await evidence.setViewport(VIEW_MOBILE);
  await openPage(evidence, origin, 'manual/epms-telemetry.html');
  await evidence.screenshot({ path: '/tmp/rz-telemetry-manual-mobile.png', fullPage: true });
  await evidence.close();
  const evidenceLabel = TEST_SCOPE === 'docs'
    ? '14 doc surfaces'
    : TEST_SCOPE === 'cockpits'
      ? '6 cockpit routes/controls'
      : '14 doc surfaces + 6 cockpit routes/controls';
  console.log(`telemetry browser contract: ${evidenceLabel} — PASS`);
} finally {
  await browser.close();
  if (server) await new Promise((accept) => server.close(accept));
}
