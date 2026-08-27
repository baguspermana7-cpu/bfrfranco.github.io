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
  const ict = await browser.newPage();
  const ictPageErrors = [];
  ict.on('pageerror', (error) => ictPageErrors.push(error.message));
  await ict.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await ict.goto(`${origin}/ict.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await ict.waitForSelector('.network-topology .topology-layer');
  await ict.click('#alarm-filter-toggle');
  await ict.select('#alarm-filter-segment', 'wan');
  await ict.select('#alarm-filter-state', 'ack');
  await ict.click('#alarm-filter-apply');
  const ictState = await ict.evaluate(() => ({
    count: document.getElementById('alarm-result-count')?.textContent,
    alarm: document.getElementById('alarm-list')?.textContent,
    capacity: document.querySelector('.cap-grid')?.textContent,
  }));
  assert.equal(ictState.count, '1 result');
  assert.match(ictState.alarm || '', /DCI BKS01/);
  assert.match(ictState.capacity || '', /Installed Core/);
  assert.match(ictState.capacity || '', /N\+1 Survivable/);
  await ict.click('#alarm-filter-reset');
  assert.equal(await ict.$eval('#alarm-result-count', (node) => node.textContent), '3 results');
  await ict.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  const tabletLayout = await ict.evaluate(() => ({
    inspectorDisplay: getComputedStyle(document.querySelector('.inspector')).display,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    canvasWidth: document.querySelector('.canvas').getBoundingClientRect().width,
  }));
  assert.notEqual(tabletLayout.inspectorDisplay, 'none', 'tablet view must retain alarm/inspection hierarchy');
  assert.ok(tabletLayout.canvasWidth > 420, 'tablet network canvas must retain a usable working width');
  assert.ok(tabletLayout.scrollWidth <= tabletLayout.viewportWidth + 1, 'tablet shell must not create page-level horizontal scroll');
  await ict.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await ict.screenshot({ path: '/tmp/rz-ict-operator.png', fullPage: true });

  const hall = await browser.newPage();
  const hallPageErrors = [];
  hall.on('pageerror', (error) => hallPageErrors.push(error.message));
  await hall.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await hall.goto(`${origin}/datahall.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await hall.waitForSelector('.rack .rk-val');
  await hall.click('#hall-selector button[data-hall="C"]');
  const selectedRack = await hall.$('.rack:not(.sel)');
  assert.ok(selectedRack);
  await selectedRack.click();
  await hall.click('.crah-cell[data-crah="1"]');
  const hallState = await hall.evaluate(() => ({
    selectedHall: document.querySelector('#hall-selector button[aria-pressed="true"]')?.getAttribute('data-hall'),
    scope: document.getElementById('hall-scope-label')?.textContent,
    env: document.getElementById('env-temp')?.textContent,
    dewPoint: document.getElementById('env-dewpoint')?.textContent,
    rackDetail: document.getElementById('sel-detail')?.textContent,
    crahDetail: document.getElementById('cp-grid')?.textContent,
  }));
  assert.equal(hallState.selectedHall, 'C');
  assert.equal(hallState.scope, 'Data Hall C');
  assert.match(hallState.env || '', /^25\.[0-9] °C$/);
  assert.match(hallState.dewPoint || '', /°Cdp$/);
  assert.match(hallState.rackDetail || '', /Hot-aisle temperature/);
  assert.match(hallState.rackDetail || '', /Actual heat load/);
  assert.match(hallState.rackDetail || '', /Cooling coverage/);
  assert.match(hallState.crahDetail || '', /CRAH leaving air/);
  assert.match(hallState.crahDetail || '', /Rack-inlet design SP/);
  const alarmTransition = await hall.evaluate(() => {
    const before = Number(document.getElementById('as-warn')?.textContent || 0);
    const nativeTimeout = window.setTimeout;
    let clearExcursion = null;
    window.setTimeout = (callback, delay, ...args) => {
      if (delay >= 10_000 && delay <= 15_000) {
        clearExcursion = () => callback(...args);
        return 0;
      }
      return nativeTimeout(callback, delay, ...args);
    };
    window.__fireDatahallExcursion();
    const active = Number(document.getElementById('as-warn')?.textContent || 0);
    const activeAlarmText = document.getElementById('alarm-list')?.textContent || '';
    clearExcursion?.();
    const cleared = Number(document.getElementById('as-warn')?.textContent || 0);
    window.setTimeout = nativeTimeout;
    return { before, active, cleared, activeAlarmText };
  });
  assert.equal(alarmTransition.active, alarmTransition.before + 1, 'thermal excursion must add a live warning');
  assert.match(alarmTransition.activeAlarmText, /Rack inlet/);
  assert.equal(alarmTransition.cleared, alarmTransition.before, 'thermal excursion clear must restore warning count');
  await hall.screenshot({ path: '/tmp/rz-datahall-operator.png', fullPage: true });
  assert.deepEqual(ictPageErrors, [], `ICT page errors: ${ictPageErrors.join(' | ')}`);
  assert.deepEqual(hallPageErrors, [], `data-hall page errors: ${hallPageErrors.join(' | ')}`);

  console.log('PASS ICT + data-hall runtime controls, responsive hierarchy, and operator screenshots');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
