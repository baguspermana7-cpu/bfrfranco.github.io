import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const MIME = Object.freeze({
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});

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

async function assertKeyboardPath(page, startSelector, expectedSelectors, label) {
  await page.focus(startSelector);
  for (const selector of expectedSelectors) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate((expected) => {
      const active = document.activeElement;
      const rect = active?.getBoundingClientRect();
      return {
        matches: Boolean(active?.matches(expected)),
        visible: Boolean(rect && rect.width > 0 && rect.height > 0
          && rect.left >= 0 && rect.right <= window.innerWidth
          && rect.top >= 0 && rect.bottom <= window.innerHeight),
        identity: active?.id || active?.className || active?.textContent?.trim() || 'unknown',
      };
    }, selector);
    assert.equal(state.matches, true, `${label}: expected ${selector}, focused ${state.identity}`);
    assert.equal(state.visible, true, `${label}: ${selector} focus target was outside the viewport`);
  }
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
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(origin) || url.startsWith('data:')) request.continue();
    else request.abort();
  });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${origin}/datahall.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('#rzConvAlarmLaunch');

  await page.click('#rzConvAlarmLaunch');
  const openState = await page.evaluate(() => {
    const scrim = document.getElementById('rzConvAlarmScrim');
    const background = Array.from(document.body.children).filter((item) => item !== scrim);
    return {
      hidden: scrim.hidden,
      activeId: document.activeElement?.id,
      inert: background.every((item) => item.hasAttribute('inert')),
      hiddenFromA11y: background.every((item) => item.getAttribute('aria-hidden') === 'true'),
      title: document.getElementById('rzConvAlarmTitle')?.textContent,
      header: document.querySelector('.rz-conv-alarm-table th:nth-child(6)')?.textContent,
      caption: document.querySelector('.rz-conv-alarm-table caption')?.textContent,
      scopedHeaders: document.querySelectorAll('.rz-conv-alarm-table th[scope="col"]').length,
      summary: document.getElementById('rzConvAlarmSummary')?.textContent,
    };
  });
  assert.deepEqual(openState, {
    hidden: false,
    activeId: 'rzConvAlarmClose',
    inert: true,
    hiddenFromA11y: true,
    title: 'Alarm & Event History',
    header: 'Lifecycle at capture',
    caption: 'Conventional DC alarm and event historian results',
    scopedHeaders: 9,
    summary: '2 record(s) · 1 active-at-capture · 1 critical/high · scope datahall',
  });

  await page.select('#rzConvAlarmSeverity', 'high');
  await page.click('#rzConvAlarmRun');
  assert.match(await page.$eval('#rzConvAlarmStatus', (node) => node.textContent), /1 result/);
  assert.match(await page.$eval('#rzConvAlarmRows', (node) => node.textContent), /RACK-A17/);

  await page.focus('#rzConvAlarmClose');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Tab');
  await page.keyboard.up('Shift');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'rzConvAlarmExport');
  await page.keyboard.press('Escape');
  const closedState = await page.evaluate(() => ({
    hidden: document.getElementById('rzConvAlarmScrim')?.hidden,
    activeId: document.activeElement?.id,
    leakedInert: Array.from(document.body.children).some((item) => item.hasAttribute('inert')),
    launchHidden: document.getElementById('rzConvAlarmLaunch')?.closest('[aria-hidden="true"]') !== null,
  }));
  assert.deepEqual(closedState, {
    hidden: true, activeId: 'rzConvAlarmLaunch', leakedInert: false, launchHidden: false,
  });

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.click('#rzConvAlarmLaunch');
  const mobile = await page.evaluate(() => {
    const dialog = document.querySelector('.rz-conv-alarm-dialog');
    const result = document.querySelector('.rz-conv-alarm-result');
    const footer = document.querySelector('.rz-conv-alarm-foot');
    const launch = document.getElementById('rzConvAlarmLaunch');
    const rect = dialog.getBoundingClientRect();
    dialog.scrollTop = dialog.scrollHeight;
    const resultRect = result.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const launchRect = launch.getBoundingClientRect();
    return {
      withinViewport: rect.left >= 0 && rect.top >= 0
        && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
      scrimOverflow: document.getElementById('rzConvAlarmScrim').scrollWidth - window.innerWidth,
      filterWidth: document.getElementById('rzConvAlarmFilter').scrollWidth
        - document.getElementById('rzConvAlarmFilter').clientWidth,
      dialogOverflowY: getComputedStyle(dialog).overflowY,
      dialogScrollable: dialog.scrollHeight > dialog.clientHeight && dialog.scrollTop > 0,
      resultReachable: resultRect.top < window.innerHeight && resultRect.bottom > 0,
      footerReachable: footerRect.top < window.innerHeight && footerRect.bottom > 0,
      authInjectedIntoDialog: Boolean(document.querySelector('.rz-conv-alarm-head #rzAuthWrap, .rz-conv-alarm-head #rzLoginBtn')),
      launchHeight: launchRect.height,
    };
  });
  assert.equal(mobile.withinViewport, true);
  assert.ok(mobile.scrimOverflow <= 1, `alarm scrim overflowed mobile by ${mobile.scrimOverflow}px`);
  assert.ok(mobile.filterWidth <= 1, `alarm filter overflowed mobile by ${mobile.filterWidth}px`);
  assert.match(mobile.dialogOverflowY, /auto|scroll/);
  assert.equal(mobile.dialogScrollable, true, 'mobile dialog must scroll to historian results and footer');
  assert.equal(mobile.resultReachable, true, 'mobile historian results must be reachable');
  assert.equal(mobile.footerReachable, true, 'mobile historian footer must be reachable');
  assert.equal(mobile.authInjectedIntoDialog, false, 'auth controls must not be injected into the alarm dialog');
  assert.ok(mobile.launchHeight >= 44, `mobile alarm launch was ${mobile.launchHeight}px high`);
  await page.keyboard.press('Escape');

  const operatorPages = [
    'dc-conventional.html', 'EPMS_Telemetry.html', 'datahall.html', 'chiller-plant.html',
    'fire-system.html', 'fuel-system.html', 'water-system.html', 'ict.html',
  ];
  for (const operatorPage of operatorPages) {
    await page.goto(`${origin}/${operatorPage}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('#rzConvAlarmLaunch', { timeout: 10_000 });
    const placement = await page.evaluate(() => {
      const launch = document.getElementById('rzConvAlarmLaunch');
      const rect = launch.getBoundingClientRect();
      const banner = document.querySelector('.rz-tq-banner');
      return {
        fallback: launch.classList.contains('rz-conv-alarm-launch--fallback'),
        visible: rect.width > 0 && rect.height >= 44
          && rect.left >= 0 && rect.right <= window.innerWidth,
        rect: { left: rect.left, right: rect.right, width: rect.width, height: rect.height },
        parentRect: launch.parentElement ? (() => {
          const parentRect = launch.parentElement.getBoundingClientRect();
          const parentStyle = getComputedStyle(launch.parentElement);
          return {
            tag: launch.parentElement.tagName, className: launch.parentElement.className,
            left: parentRect.left, right: parentRect.right, width: parentRect.width,
            display: parentStyle.display, position: parentStyle.position,
            justifyContent: parentStyle.justifyContent, direction: parentStyle.direction,
            flex: parentStyle.flex, cssWidth: parentStyle.width,
            offsetLeft: launch.parentElement.offsetLeft,
            scrollLeft: launch.parentElement.scrollLeft,
          };
        })() : null,
        position: getComputedStyle(launch).position,
        transform: getComputedStyle(launch).transform,
        margin: getComputedStyle(launch).margin,
        offsetLeft: launch.offsetLeft,
        offsetParent: launch.offsetParent?.className || launch.offsetParent?.tagName,
        fixed: getComputedStyle(launch).position === 'fixed',
        bannerAtBottom: Boolean(banner && banner.getBoundingClientRect().top > window.innerHeight / 2),
      };
    });
    assert.equal(placement.fallback, false, `${operatorPage}: alarm launch used the P&ID-overlay fallback`);
    assert.equal(placement.visible, true,
      `${operatorPage}: alarm launch was outside the mobile viewport or below 44px (${JSON.stringify(placement)})`);
    assert.equal(placement.fixed, false, `${operatorPage}: alarm launch must stay in the header flow`);
    assert.equal(placement.bannerAtBottom, false, `${operatorPage}: simulated telemetry badge covered bottom content`);
  }

  const telemetryPages = [
    'datahall.html', 'chiller-plant.html', 'fire-system.html',
    'water-system.html', 'ict.html', 'datahallAI.html',
  ];
  for (const telemetryPage of telemetryPages) {
    await page.goto(`${origin}/${telemetryPage}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('.rz-tq-banner', { timeout: 10_000 });
    const bannerLayout = await page.evaluate(() => {
      const slot = document.querySelector('[data-rz-telemetry-banner-slot]');
      const banner = document.querySelector('.rz-tq-banner');
      const header = slot?.closest('header') || slot?.previousElementSibling;
      const close = banner?.querySelector('.rz-tq-banner-close');
      const bannerRect = banner?.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();
      const closeRect = close?.getBoundingClientRect();
      close?.focus();
      return {
        inDedicatedSlot: Boolean(slot && banner && banner.parentElement === slot),
        compact: Boolean(slot?.hasAttribute('data-rz-telemetry-compact')),
        position: banner ? getComputedStyle(banner).position : '',
        withinViewport: Boolean(bannerRect && bannerRect.left >= 0 && bannerRect.right <= window.innerWidth),
        clearsHeader: Boolean(bannerRect && headerRect && (
          slot?.hasAttribute('data-rz-telemetry-compact')
            ? bannerRect.top >= headerRect.top - 1 && bannerRect.bottom <= headerRect.bottom + 1
            : bannerRect.top >= headerRect.bottom - 1
        )),
        closeTarget: Boolean(closeRect && closeRect.width >= 44 && closeRect.height >= 44),
        closeFocusOutline: close ? parseFloat(getComputedStyle(close).outlineWidth) : 0,
      };
    });
    assert.equal(bannerLayout.inDedicatedSlot, true, `${telemetryPage}: telemetry banner lacks an in-flow slot`);
    assert.notEqual(bannerLayout.position, 'fixed', `${telemetryPage}: telemetry banner must not overlay the header`);
    assert.equal(bannerLayout.withinViewport, true, `${telemetryPage}: telemetry banner exceeded mobile width`);
    assert.equal(bannerLayout.clearsHeader, true, `${telemetryPage}: telemetry banner overlapped its header`);
    assert.equal(bannerLayout.closeTarget, true, `${telemetryPage}: telemetry dismiss target was below 44 px`);
    assert.ok(bannerLayout.closeFocusOutline >= 2, `${telemetryPage}: telemetry dismiss focus outline was missing`);
  }

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${origin}/datahall.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('.rz-tq-banner', { timeout: 10_000 });
  const reducedMotion = await page.evaluate(() => {
    const banner = document.querySelector('.rz-tq-banner');
    const dot = document.querySelector('.rz-tq-banner-dot');
    return {
      dotAnimation: getComputedStyle(dot).animationName,
      bannerTransition: getComputedStyle(banner).transitionDuration,
    };
  });
  assert.equal(reducedMotion.dotAnimation, 'none', 'telemetry pulse must stop for reduced motion');
  assert.match(reducedMotion.bannerTransition, /^(0s)(, 0s)*$/, 'banner transition must stop for reduced motion');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  await page.goto(`${origin}/datahallAI.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('.rz-tq-banner', { timeout: 10_000 });
  const lightBanner = await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    const style = getComputedStyle(document.querySelector('.rz-tq-banner'));
    return { color: style.color, background: style.backgroundColor };
  });
  assert.deepEqual(lightBanner, {
    color: 'rgb(7, 84, 106)',
    background: 'rgb(227, 248, 252)',
  }, 'light-theme simulated provenance must retain readable instrument-cyan contrast');

  await page.goto(`${origin}/EPMS_Telemetry.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('#epmsSidebarToggle', { timeout: 10_000 });
  const epmsClosed = await page.evaluate(() => {
    const sidebar = document.getElementById('epmsSidebar');
    const toggle = document.getElementById('epmsSidebarToggle');
    const viewport = document.getElementById('viewport');
    const scene = document.getElementById('scene');
    const topbar = document.querySelector('.topbar');
    const statusbar = document.querySelector('.status-bar');
    const prd = document.querySelector('a[href="prd/epms-telemetry.html"]');
    const manual = document.querySelector('a[href="manual/epms-telemetry.html"]');
    const sceneRect = scene.getBoundingClientRect();
    const topbarRect = topbar.getBoundingClientRect();
    const statusbarRect = statusbar.getBoundingClientRect();
    const contractLinks = [prd, manual].map((link) => {
      const rect = link.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return rect.right <= window.innerWidth && (hit === link || link.contains(hit));
    });
    const headerTargets = [
      document.querySelector('.epms-back-link'),
      prd,
      manual,
      document.querySelector('.epms-portfolio-link'),
    ].map((target) => {
      const rect = target.getBoundingClientRect();
      return rect.height >= 44 && rect.top >= topbarRect.top && rect.bottom <= topbarRect.bottom;
    });
    return {
      sidebarHidden: getComputedStyle(sidebar).display === 'none',
      toggleHeight: toggle.getBoundingClientRect().height,
      viewportWidth: viewport.getBoundingClientRect().width,
      viewportHeight: viewport.getBoundingClientRect().height,
      availableViewportHeight: window.innerHeight - viewport.getBoundingClientRect().top,
      sceneClearsControls: sceneRect.top >= topbarRect.bottom - 4
        && sceneRect.bottom <= statusbarRect.top + 4,
      contractLinks,
      headerTargets,
      expanded: toggle.getAttribute('aria-expanded'),
    };
  });
  assert.equal(epmsClosed.sidebarHidden, true, 'EPMS mobile sidebar must default closed');
  assert.ok(epmsClosed.toggleHeight >= 44, `EPMS sidebar toggle was ${epmsClosed.toggleHeight}px high`);
  assert.ok(epmsClosed.viewportWidth >= 380, `EPMS SLD had only ${epmsClosed.viewportWidth}px of mobile width`);
  assert.ok(epmsClosed.viewportHeight >= epmsClosed.availableViewportHeight - 2,
    `EPMS SLD did not own the remaining viewport (${epmsClosed.viewportHeight}px of ${epmsClosed.availableViewportHeight}px)`);
  assert.ok(epmsClosed.viewportHeight >= 590,
    `EPMS context chrome left only ${epmsClosed.viewportHeight}px for the mobile SLD`);
  assert.equal(epmsClosed.sceneClearsControls, true, 'EPMS fitted scene must clear top and status controls');
  assert.deepEqual(epmsClosed.contractLinks, [true, true], 'EPMS PRD and Manual must stay in the initial mobile viewport');
  assert.deepEqual(epmsClosed.headerTargets, [true, true, true, true], 'EPMS mobile header targets must be 44px and contained by the rail');
  assert.equal(epmsClosed.expanded, 'false');
  await assertKeyboardPath(page, '.epms-back-link', [
    '.epms-prd-link',
    '.epms-manual-link',
    '#rzConvAlarmLaunch',
    '#epmsSidebarToggle',
    '.epms-portfolio-link',
  ], 'EPMS mobile header');
  await page.click('#epmsSidebarToggle');
  assert.equal(await page.$eval('#epmsSidebar', (node) => getComputedStyle(node).display !== 'none'), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#epmsSidebar', (node) => getComputedStyle(node).display === 'none'), true);

  await page.goto(`${origin}/dc-conventional.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('.header-title', { timeout: 10_000 });
  const dashboardHeader = await page.evaluate(() => {
    const header = document.querySelector('.header');
    const title = document.querySelector('.header-title');
    const actions = document.querySelector('.header-actions');
    const headerRect = header.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    return {
      titleVisible: titleRect.width > 0 && titleRect.height > 0
        && titleRect.left >= headerRect.left && titleRect.right <= headerRect.right
        && titleRect.top >= headerRect.top && titleRect.bottom <= headerRect.bottom,
      actionRailScrollable: Boolean(actions && actions.scrollWidth >= actions.clientWidth),
    };
  });
  assert.equal(dashboardHeader.titleVisible, true, 'Conventional dashboard identity was clipped on mobile');
  assert.equal(dashboardHeader.actionRailScrollable, true, 'Conventional mobile actions need a dedicated rail');
  await page.waitForSelector('a.rz-prd-contract');
  const contractLayerOrder = await page.evaluate(() => {
    document.body.classList.remove('locked');
    document.querySelector('.header')?.removeAttribute('inert');
    document.querySelectorAll('.root-gate, .rz-restricted-overlay, .rz-modal-overlay')
      .forEach((node) => node.remove());
    const layer = document.querySelector('.rz-public-contract-layer');
    const header = document.querySelector('.header');
    return Boolean(layer && header
      && (layer.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(contractLayerOrder, true, 'public documentation layer must precede dashboard controls in keyboard order');
  await assertKeyboardPath(page, 'a.rz-prd-contract', [
    'a.rz-manual-contract',
    '#rzConvAlarmLaunch',
    '#genDesignTrigConv',
    '#faqTrigConv',
    '.header-actions a[href="index.html"]',
    '.header-actions a[href="datacenter-solutions.html"]',
  ], 'Conventional dashboard mobile header');

  await page.setViewport({ width: 600, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${origin}/dc-conventional.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const tabletHeader = await page.evaluate(() => {
    const header = document.querySelector('.header').getBoundingClientRect();
    const title = document.querySelector('.header-title').getBoundingClientRect();
    const actions = document.querySelector('.header-actions').getBoundingClientRect();
    return {
      titleVisible: title.width > 0 && title.left >= header.left && title.right <= header.right
        && title.top >= header.top && title.bottom <= header.bottom,
      actionsUsable: actions.width > 0 && actions.top >= header.top && actions.bottom <= header.bottom,
    };
  });
  assert.equal(tabletHeader.titleVisible, true, 'Conventional dashboard identity was clipped at tablet width');
  assert.equal(tabletHeader.actionsUsable, true, 'Conventional action rail collapsed at tablet width');
  assert.deepEqual(pageErrors, [], `alarm workspace page errors: ${pageErrors.join(' | ')}`);
  console.log('PASS Conventional alarm runtime, lifecycle provenance, modal isolation, focus, and mobile layout');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
