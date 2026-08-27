import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';

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
  assert.match(initial.current, /1\.85(?:0)? MW/i);
  assert.match(initial.study, /4\s*[×x]\s*10 MW/i);
  assert.match(initial.study, /READ[- ]ONLY|STUDY ONLY/i);

  await page.click('[data-hall="C"]');
  const selected = await page.evaluate((ids, labelId) => ({
    activeHall: document.body.dataset.activeHall,
    hallLabel: document.getElementById(labelId)?.textContent.trim(),
    pressed: document.querySelector('[data-hall="C"]')?.getAttribute('aria-pressed'),
    values: Object.fromEntries(ids.map((id) => [id, document.getElementById(id)?.textContent.trim()])),
  }), currentIds, hallLabelId);

  assert.equal(selected.activeHall, 'C');
  assert.equal(selected.pressed, 'true');
  assert.match(selected.hallLabel, /Hall C/i);
  assert.deepEqual(selected.values, before, 'view-only hall change must not mutate deterministic telemetry');
}

const { server, origin } = await startServer();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const chiller = await openPage(browser, origin, 'chiller-plant.html');
  await chiller.waitForFunction(() => document.getElementById('kChws')?.textContent.includes('7.2'));
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
  await assertHallAndBasisContract(water, ['kWue', 'kMakeup', 'kTotal'], 'waterHallLabel');

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
  assert.match(waterPlant.allocation.treatment, /45\.0 L\/min/i);
  assert.match(waterPlant.allocation.makeup, /37\.0 L\/min/i);
  assert.match(waterPlant.allocation.domestic, /8\.0 L\/min/i);
  assert.match(waterPlant.bottom, /P-301A DUTY/i);
  assert.match(waterPlant.bottom, /P-301B STBY/i);

  await water.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await new Promise((accept) => setTimeout(accept, 150));
  const waterOverflow = await water.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ));
  assert.ok(waterOverflow <= 2, `water page overflowed mobile viewport by ${waterOverflow}px`);
  await water.close();

  console.log('PASS Conventional chiller/water hall context, current-study truth, modal UX, pump redundancy, and responsive layout');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
