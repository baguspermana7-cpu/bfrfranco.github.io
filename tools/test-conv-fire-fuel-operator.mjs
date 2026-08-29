import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const FUEL_SOURCE = await readFile('fuel-system.html', 'utf8');
const FUEL_ENGINE_VERSION = FUEL_SOURCE.match(/js\/conv-engine\.js\?v=([^"']+)/)?.[1];
assert.ok(FUEL_ENGINE_VERSION, 'fuel page must request a versioned Conventional engine');
const CURRENT_ENGINE_SOURCE = await readFile('js/conv-engine.js', 'utf8');
const BLANK_METADATA_ENGINE = CURRENT_ENGINE_SOURCE
  .replace("scenario: 'Simulated'", "scenario: '   '")
  .replace("data_quality: 'GOOD'", "data_quality: ''");
assert.notEqual(BLANK_METADATA_ENGINE, CURRENT_ENGINE_SOURCE,
  'blank-metadata fixture must alter the current engine source');
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

async function openOperatorPage(browser, origin, path) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${origin}/${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  return page;
}

async function openFuelFixture(browser, origin, engineSource) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/js/conv-engine.js')) {
      if (engineSource === null) void request.abort();
      else void request.respond({ status: 200, contentType: 'text/javascript', body: engineSource });
    } else if (url.startsWith(origin) || url.startsWith('data:')) {
      void request.continue();
    } else {
      void request.abort();
    }
  });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${origin}/fuel-system.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  return { page, pageErrors };
}

async function assertFuelUnavailable(page, pageErrors, context) {
  await page.hover('#tank-ust');
  await page.waitForFunction(() => document.getElementById('equipment-tooltip')?.classList.contains('visible'));
  const result = await page.evaluate(() => ({
    authority: document.body.dataset.fuelAuthority,
    operatorAuthority: window.RZFuelOperator?.authorityAvailable,
    status: document.getElementById('as-state')?.textContent.trim(),
    scenario: document.getElementById('as-scn')?.textContent.trim(),
    autonomy: document.getElementById('kpi-autonomy')?.textContent.trim(),
    n1: document.getElementById('kpi-np1-tag')?.textContent.trim(),
    basis: document.getElementById('fuel-current-basis-value')?.textContent.trim(),
    controlsDisabled: Array.from(document.querySelectorAll('#btn-fill,#btn-ack,#btn-reset,#btn-pump,#fs-reset'))
      .every((button) => button.disabled),
    interlocks: Array.from(document.querySelectorAll('.ilk .ilk-stat')).map((item) => item.textContent.trim()),
    containment: Array.from(document.querySelectorAll('.containment-value')).map((item) => item.textContent.trim()),
    activePaths: document.querySelectorAll('.flow-path .active,.fp-arrow.active,.pump-ic.running').length,
    polishing: document.getElementById('polish-status')?.textContent.trim(),
    alarms: document.getElementById('alarm-list')?.textContent.replace(/\s+/g, ' ').trim(),
    tankTooltip: document.getElementById('equipment-tooltip')?.textContent.replace(/\s+/g, ' ').trim(),
    text: document.body.innerText.replace(/\s+/g, ' '),
  }));
  assert.deepEqual(pageErrors, [], `${context}: page errors: ${pageErrors.join(' | ')}`);
  assert.equal(result.authority, 'unavailable');
  assert.equal(result.operatorAuthority, false);
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.scenario, 'UNAVAILABLE');
  assert.match(result.autonomy, /^(?:—|UNAVAILABLE)$/i);
  assert.equal(result.n1, 'UNAVAILABLE');
  assert.match(result.basis, /UNAVAILABLE/i);
  assert.equal(result.controlsDisabled, true);
  assert.ok(result.interlocks.every((state) => state === 'UNAVAILABLE'));
  assert.ok(result.containment.every((state) => state === 'UNAVAILABLE'));
  assert.equal(result.activePaths, 0);
  assert.equal(result.polishing, 'UNAVAILABLE');
  assert.match(result.alarms, /UNAVAILABLE/i);
  assert.match(result.tankTooltip, /UNAVAILABLE/i);
  assert.doesNotMatch(result.tankTooltip, /\b0(?:\.0)?\s*(?:L|%)/i);
  assert.doesNotMatch(result.text, /\b(?:NaN|Infinity|null|undefined)\b/i);
}

const { server, origin } = await startServer();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const fire = await openOperatorPage(browser, origin, 'fire-system.html');
  await fire.waitForFunction(() => document.querySelectorAll('#ce-matrix .ce-row').length >= 6);
  await fire.waitForSelector('#rzConvAlarmLaunch');

  const fireState = await fire.evaluate(() => {
    const stage2 = window.RZFireOperator.interlocksForStage(2);
    const stage3 = window.RZFireOperator.interlocksForStage(3);
    return {
      authority: document.getElementById('fire-authority')?.textContent.trim(),
      rows: document.querySelectorAll('#fire-interlock-list [data-interlock]').length,
      initialText: document.getElementById('fire-interlock-list')?.textContent || '',
      stage2,
      stage3,
      mimicTabIndex: document.querySelector('.main-svg')?.tabIndex,
      overflow: (() => { window.scrollTo(9999, 0); const value = window.scrollX; window.scrollTo(0, 0); return value; })(),
    };
  });

  assert.match(fireState.authority, /FACP AUTHORITATIVE/i);
  assert.ok(fireState.rows >= 7, 'fire operator list must cover building-system dependencies');
  assert.doesNotMatch(fireState.initialText, /ACTUATED|SHUTDOWN PROVEN|DOOR UNLOCKED/i);
  assert.equal(fireState.mimicTabIndex, 0, 'narrow-screen process canvas must remain keyboard-scrollable');
  assert.deepEqual(
    fireState.stage2.filter((item) => item.system === 'Fire alert sounder')
      .map((item) => [item.command, item.feedback]),
    [['1ST-STAGE SOUNDER REQUEST', 'FIELD FEEDBACK NOT MODELED']],
    'stage 2 smoke action must expose the first-stage sounder command without claiming proof',
  );
  assert.deepEqual(
    fireState.stage3.filter((item) => ['AHU / CRAH', 'Fire / smoke dampers', 'Lift recall', 'Access / egress'].includes(item.system))
      .map((item) => [item.system, item.command, item.feedback]),
    [
      ['AHU / CRAH', 'STOP REQUEST', 'FIELD FEEDBACK NOT MODELED'],
      ['Fire / smoke dampers', 'CLOSE REQUEST', 'END-SWITCH NOT MODELED'],
      ['Lift recall', 'FIRE RECALL REQUEST', 'LIFT FEEDBACK NOT MODELED'],
      ['Access / egress', 'EGRESS RELEASE REQUEST', 'ACS FEEDBACK NOT MODELED'],
    ],
    'FACP stage 3 must express requests without inventing downstream proof',
  );
  assert.equal(
    fireState.stage3.find((item) => item.system === 'Electrical / EPO')?.command,
    'NO AUTOMATIC EPO',
  );
  assert.ok(fireState.overflow <= 2, `fire page overflowed desktop viewport by ${fireState.overflow}px`);

  await fire.$eval('#rzConvAlarmLaunch', (button) => button.click());
  await fire.waitForFunction(() => document.getElementById('rzConvAlarmScrim')?.hidden === false);
  assert.deepEqual(await fire.evaluate(() => ({
    system: document.getElementById('rzConvAlarmSystem')?.value,
    rows: document.querySelectorAll('#rzConvAlarmRows tr').length,
  })), { system: 'fire', rows: 2 });
  await fire.$eval('#rzConvAlarmClose', (button) => button.click());

  await fire.$eval('#btn-arm', (button) => button.click());
  assert.equal(await fire.$eval('#btn-sim-fire', (button) => button.disabled), false);
  await fire.evaluate(() => { window.confirm = () => true; });
  await fire.$eval('#btn-sim-fire', (button) => button.click());
  await fire.waitForFunction(() => /STAGE 1/.test(document.getElementById('fire-authority')?.textContent || ''));
  assert.equal(
    await fire.$eval('#fire-authority', (element) => element.textContent.includes('SIM ARMED')),
    true,
    'existing arm and staged-simulation flow must remain operational',
  );

  await fire.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await new Promise((accept) => setTimeout(accept, 150));
  const fireMobileOverflow = await fire.evaluate(() => {
    window.scrollTo(9999, 0);
    const value = window.scrollX;
    window.scrollTo(0, 0);
    return value;
  });
  assert.ok(fireMobileOverflow <= 2, `fire page overflowed mobile viewport by ${fireMobileOverflow}px`);
  await fire.close();

  const fuel = await openOperatorPage(browser, origin, 'fuel-system.html');
  await fuel.waitForFunction(() => document.getElementById('kpi-autonomy')?.textContent !== '--');
  await fuel.waitForSelector('#rzConvAlarmLaunch');

  const fuelState = await fuel.evaluate(() => {
    const leakTrip = window.RZFuelOperator.evaluateContainment({
      leak: true,
      bund: false,
      water: false,
      pumpfail: false,
      polish: true,
    });
    const normal = window.RZFuelOperator.evaluateContainment({
      leak: false,
      bund: false,
      water: false,
      pumpfail: false,
      polish: true,
    });
    return {
      authority: document.body.dataset.fuelAuthority,
      operatorAuthority: window.RZFuelOperator.authorityAvailable,
      polishStatus: document.getElementById('polish-status')?.textContent.trim(),
      polishMode: document.getElementById('polish-mode')?.textContent.trim(),
      leakRows: document.querySelectorAll('#leak-detection-chain [data-containment-point]').length,
      currentBasis: document.getElementById('fuel-current-basis')?.textContent || '',
      studyBasis: document.getElementById('fuel-study-basis')?.textContent || '',
      leakTrip,
      normal,
      severity: {
        leak: window.RZFuelOperator.severityFor('leak'),
        water: window.RZFuelOperator.severityFor('water'),
        polish: window.RZFuelOperator.severityFor('polish'),
        leakCard: window.RZFuelOperator.cardClassFor('leak', true),
        waterCard: window.RZFuelOperator.cardClassFor('water', true),
        polishAlarm: window.RZFuelOperator.alarmClassFor('polish'),
      },
      overflow: (() => { window.scrollTo(9999, 0); const value = window.scrollX; window.scrollTo(0, 0); return value; })(),
    };
  });

  assert.equal(fuelState.authority, 'current');
  assert.equal(fuelState.operatorAuthority, true);
  assert.equal(fuelState.polishStatus, 'RUNNING');
  assert.match(fuelState.polishMode, /SIMULATED/i);
  assert.ok(fuelState.leakRows >= 4, 'fuel containment chain must expose sensors and permissives');
  assert.match(fuelState.currentBasis, /972,737 L/i);  // REBASELINED to the v2.0.0 campus basis (30,000 kW IT / 43.50 MW facility) — tank re-sized to hold the sourced 48 h autonomy at 43.5 MW
  assert.match(fuelState.currentBasis, /30\.00 MW IT/i);  // REBASELINED to the v2.0.0 campus basis (30,000 kW IT / 43.50 MW facility)
  assert.match(fuelState.studyBasis, /4 × 10 MW/i);
  assert.match(fuelState.studyBasis, /STUDY ONLY/i);
  assert.deepEqual(fuelState.normal, {
    severity: 'normal', transferPermissive: true, fillPermissive: true,
    action: 'LOGIC READY', reason: 'Containment dry and transfer train healthy',
  });
  assert.deepEqual(fuelState.leakTrip, {
    severity: 'critical', transferPermissive: false, fillPermissive: false,
    action: 'STOP TRANSFER + INHIBIT FILL', reason: 'Leak detector wet',
  });
  assert.deepEqual(fuelState.severity, {
    leak: 'critical', water: 'warning', polish: 'warning',
    leakCard: 'alarm', waterCard: 'warning', polishAlarm: 'warn',
  });
  assert.ok(fuelState.overflow <= 2, `fuel page overflowed desktop viewport by ${fuelState.overflow}px`);

  await fuel.$eval('#rzConvAlarmLaunch', (button) => button.click());
  await fuel.waitForFunction(() => document.getElementById('rzConvAlarmScrim')?.hidden === false);
  assert.deepEqual(await fuel.evaluate(() => ({
    system: document.getElementById('rzConvAlarmSystem')?.value,
    rows: document.querySelectorAll('#rzConvAlarmRows tr').length,
  })), { system: 'fuel', rows: 2 });
  await fuel.$eval('#rzConvAlarmClose', (button) => button.click());

  await fuel.click('#btn-pump');
  await fuel.waitForFunction(() => document.getElementById('fp-pump')?.textContent === 'RUN');
  const preservedFlow = await fuel.evaluate(() => ({
    pump: document.getElementById('fp-pump')?.textContent,
    polish: document.getElementById('polish-status')?.textContent,
    arrows: Array.from(document.querySelectorAll('.fp-arrow')).every((arrow) => arrow.classList.contains('active')),
  }));
  assert.deepEqual(preservedFlow, { pump: 'RUN', polish: 'RUNNING', arrows: true });

  await fuel.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await new Promise((accept) => setTimeout(accept, 150));
  const fuelMobile = await fuel.evaluate(() => {
    window.scrollTo(9999, 0);
    const overflow = window.scrollX;
    window.scrollTo(0, 0);
    const cards = Array.from(document.querySelectorAll('.kpi-strip .kpi')).map((card) => {
      const rect = card.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });
    const columns = Array.from(document.querySelectorAll('.main-grid > .col')).map((column) => {
      const rect = column.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });
    const panels = Array.from(document.querySelectorAll('.main-grid .panel')).map((panel) => {
      const rect = panel.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });
    return { overflow, cards, columns, panels };
  });
  assert.ok(fuelMobile.overflow <= 2, `fuel page overflowed mobile viewport by ${fuelMobile.overflow}px`);
  assert.ok(fuelMobile.cards.length >= 5, 'fuel mobile view must retain every KPI card');
  assert.ok(fuelMobile.cards.every((card) => card.left >= 0 && card.right <= 390 && card.width > 0),
    `fuel KPI escaped mobile viewport: ${JSON.stringify(fuelMobile.cards)}`);
  assert.ok(fuelMobile.columns.every((column) => column.left >= 0 && column.right <= 390 && column.width > 0),
    `fuel content column was clipped by the mobile viewport: ${JSON.stringify(fuelMobile.columns)}`);
  assert.ok(fuelMobile.panels.every((panel) => panel.left >= 0 && panel.right <= 390 && panel.width > 0),
    `fuel panel was clipped by the mobile viewport: ${JSON.stringify(fuelMobile.panels)}`);
  await fuel.close();

  const missingFixture = await openFuelFixture(browser, origin, null);
  await assertFuelUnavailable(missingFixture.page, missingFixture.pageErrors, 'missing fuel engine');
  await missingFixture.page.close();

  const legacyFixture = await openFuelFixture(browser, origin, `
    window.CONV_CALC = { snapshot: {
      site: { it_load_kw: 1850, facility_load_kw: 2682.5 },
      fuel: {
        level_pct: 85, tank_capacity_l: 60000, usable_l: 45900,
        usable_fraction: 0.9, specific_consumption_l_per_kwh: 0.356,
        generator_consumption_lph: 956, autonomy_hr: 48,
        level_overfill_pct: 95, level_low_pct: 60, level_low_low_pct: 30
      },
      meta: { version: '1.22.0', scenario: 'Simulated', data_quality: 'GOOD' }
    } };
  `);
  await assertFuelUnavailable(legacyFixture.page, legacyFixture.pageErrors, 'legacy fuel engine');
  await legacyFixture.page.close();

  const incompleteFixture = await openFuelFixture(browser, origin, `
    window.CONV_CALC = { snapshot: {
      site: { it_load_kw: 30000, facility_load_kw: 43500 },
      fuel: {
        level_pct: 85, tank_capacity_l: 972737, usable_l: 744144,
        usable_fraction: 0.9, specific_consumption_l_per_kwh: 0.356,
        generator_consumption_lph: 15503,
        level_overfill_pct: 95, level_low_pct: 60, level_low_low_pct: 30
      },
      meta: { version: '${FUEL_ENGINE_VERSION}', scenario: 'Simulated', data_quality: 'GOOD' }
    } };
  `);
  await assertFuelUnavailable(incompleteFixture.page, incompleteFixture.pageErrors, 'incomplete current fuel engine');
  await incompleteFixture.page.close();

  const blankMetadataFixture = await openFuelFixture(browser, origin, BLANK_METADATA_ENGINE);
  await assertFuelUnavailable(blankMetadataFixture.page, blankMetadataFixture.pageErrors,
    'same-version blank-provenance fuel engine');
  await blankMetadataFixture.page.close();

  console.log('PASS Conventional fire/fuel operator truth, containment, responsive layout, and preserved flows');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
