#!/usr/bin/env node
// js/rz-embed-compute.js (F2) — the hidden-iframe compute loop shared by compare, pack and sensitivity.
//   E1 a fixture page whose result is 2x returns exactly 2x, and the iframe is gone afterwards
//   E2 concurrent runs are queued: never more than one iframe, each returns its own answer
//   E3 an unsafe page path or an unknown mode is refused without creating an iframe
//   E4 a page with none of the requested results (missing / 404) fails and still cleans up
//   E5 a run that outlives timeoutMs fails with "timeout" and cleans up
//   E6 a real calculator computes in the frame: capex at 2,000 kW differs from 1,000 kW
//   E7 ?embed=<mode> on a calculator: no account pill, no cookie banner, analytics off; without it the banner shows
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const HOST = '<!doctype html><html><head><meta charset="utf-8"><title>host</title></head><body><script src="js/rz-embed-compute.js"></script></body></html>';
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/__host.html') { res.writeHead(200, { 'content-type': 'text/html' }).end(HOST); return; }
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fails = [];
const check = (name, cond, detail) => { if (!cond) fails.push(`${name}: ${detail}`); else console.log(`  ok ${name}`); };
const ALLOW = [base, 'https://cdn.jsdelivr.net/', 'https://cdnjs.cloudflare.com/'];
async function open(url) {
  const tab = await browser.newPage();
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (ALLOW.some((a) => r.url().startsWith(a)) ? r.continue() : r.abort()));
  await tab.goto(url, { waitUntil: 'load', timeout: 60000 });
  return tab;
}
try {
  const host = await open(base + '__host.html');
  await host.evaluate(() => {
    window.__maxFrames = 0;
    new MutationObserver(() => { window.__maxFrames = Math.max(window.__maxFrames, document.querySelectorAll('iframe').length); })
      .observe(document.body, { childList: true });
  });
  const FIX = 'tools/fixtures/embed/double.html';
  const e1 = await host.evaluate((p) => RZEmbedCompute.run({ page: p, inputs: { x: { t: 'number', v: '21' } }, read: ['#y'], settleMs: 50 })
    .then((r) => ({ r, frames: document.querySelectorAll('iframe').length })), FIX);
  check('E1 fixture 2x', e1.r.ok && e1.r.values['#y'] === '42' && e1.frames === 0, JSON.stringify(e1));

  const e2 = await host.evaluate((p) => { window.__maxFrames = 0; return Promise.all([1, 5, 8].map((v) =>
    RZEmbedCompute.run({ page: p, inputs: { x: { t: 'number', v: String(v) } }, read: ['#y'], settleMs: 50 })))
    .then((rs) => ({ ys: rs.map((r) => r.values['#y']), max: window.__maxFrames })); }, FIX);
  check('E2 queued runs', e2.ys.join() === '2,10,16' && e2.max === 1, JSON.stringify(e2));

  const e3 = await host.evaluate(() => { window.__maxFrames = 0; return Promise.all([
    RZEmbedCompute.run({ page: '../secret.html', read: ['#y'] }),
    RZEmbedCompute.run({ page: 'https://evil.example/x.html', read: ['#y'] }),
    RZEmbedCompute.run({ page: 'tools/fixtures/embed/double.html', mode: 'evil', read: ['#y'] })])
    .then((rs) => ({ errs: rs.map((r) => r.error), max: window.__maxFrames })); });
  check('E3 refused inputs', e3.errs.join() === 'invalid page,invalid page,invalid mode' && e3.max === 0, JSON.stringify(e3));

  const e4 = await host.evaluate(() => RZEmbedCompute.run({ page: 'tools/fixtures/embed/nope.html', read: ['#y'], settleMs: 50 })
    .then((r) => ({ r, frames: document.querySelectorAll('iframe').length })));
  check('E4 missing page', !e4.r.ok && e4.frames === 0, JSON.stringify(e4));

  const e5 = await host.evaluate((p) => RZEmbedCompute.run({ page: p, read: ['#y'], settleMs: 3000, timeoutMs: 400 })
    .then((r) => ({ r, frames: document.querySelectorAll('iframe').length })), FIX);
  check('E5 timeout', !e5.r.ok && /^timeout/.test(e5.r.error) && e5.frames === 0, JSON.stringify(e5));

  const e6 = await host.evaluate(() => Promise.all([1000, 2000].map((kw) => RZEmbedCompute.run({ page: 'capex-calculator.html',
    inputs: { itLoad: { t: 'number', v: String(kw) } }, read: ['#totalCost'], timeoutMs: 20000 })))
    .then((rs) => rs.map((r) => r.ok && r.values['#totalCost'])));
  check('E6 real calculator', e6[0] && e6[1] && /\d/.test(e6[0]) && e6[0] !== e6[1], JSON.stringify(e6));
  await host.close();

  for (const [url, embedded] of [['capex-calculator.html?embed=compare', true], ['capex-calculator.html', false]]) {
    const tab = await open(base + url);
    await tab.evaluate(() => localStorage.removeItem('rz_cookie_consent'));
    await tab.reload({ waitUntil: 'load' });
    await new Promise((ok) => setTimeout(ok, 600));
    const s = await tab.evaluate(() => {
      const b = document.getElementById('cookieBanner');
      return { pill: !!document.getElementById('rzAccountPill'), banner: !!(b && !b.classList.contains('hidden')),
        gaOff: window['ga-disable-G-GED7FX8RTV'] === true };
    });
    if (embedded) check('E7 embed suppresses chrome', !s.pill && !s.banner && s.gaOff, JSON.stringify(s));
    else check('E7 control (no flag) shows the banner, analytics allowed', s.banner && !s.gaOff, JSON.stringify(s)); // calculators set data-rz-account-pill=off, so no pill either way
    await tab.close();
  }
} finally { await browser.close(); server.close(); }
if (fails.length) { console.log(`FAIL test-embed-compute — ${fails.length}`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log('PASS test-embed-compute — 8 checks (fixture, queue, refusals, missing page, timeout, real calculator, embed flag both ways)');
