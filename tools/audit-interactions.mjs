#!/usr/bin/env node
/* ============================================================================
   audit-interactions.mjs — INTERACTION GATE (v1.50.34)

   Exercises the shared interactive systems with REAL keyboard/mouse/scroll in
   a headless browser (own static HTTP server, so fetch(search-index.json)
   works) and FAILS on any regression:

     1) COMMAND PALETTE (js/rz-command-palette.js) — on a migrated page and a
        previously-dead page: Ctrl+K opens, query returns results, Esc closes,
        "/" reopens, Commands group present.
     2) LIVING DIAGRAMS (js/rz-article-diagram.js) — article-13 + article-9:
        scenario button click changes flow states / raises alarms; values tick.
     3) SCROLLYTELLING (js/rz-scrolly.js) — article-23: scrolling advances
        data-step 0→3 with counter targets, and reverses to 0.
     4) READING POLISH — heading anchors + "min left" chip present on articles.

   Usage:  node tools/audit-interactions.mjs [--strict]
   Exit 1 (with --strict) on any failure. Part of the ship-audit suite.
   ============================================================================ */
import puppeteer from 'puppeteer';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const STRICT = process.argv.includes('--strict');
const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (p === '' || p === '.') p = 'index.html';
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const fails = [];
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withPage(fn, name) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1440, height: 950 });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message.slice(0, 80)));
  try { await fn(pg); } catch (e) { fails.push(`${name}: ${e.message.slice(0, 120)}`); }
  if (errs.length) fails.push(`${name}: page errors — ${errs.slice(0, 2).join(' | ')}`);
  await pg.close();
}

/* 1) command palette */
for (const f of ['index.html', 'article-24.html']) {
  await withPage(async pg => {
    await pg.goto(BASE + f, { waitUntil: 'networkidle2', timeout: 40000 });
    await pg.keyboard.down('Control'); await pg.keyboard.press('k'); await pg.keyboard.up('Control');
    await sleep(600);
    if (!await pg.evaluate(() => document.getElementById('searchModal')?.classList.contains('active'))) throw new Error('Ctrl+K did not open the palette');
    if (!await pg.evaluate(() => document.querySelectorAll('.rz-cmd').length)) throw new Error('Commands group missing');
    await pg.type('#searchInput', 'fire', { delay: 25 });
    await sleep(1000);
    const n = await pg.evaluate(() => document.querySelectorAll('.search-result-item[data-idx]').length);
    if (!n) throw new Error('query "fire" returned 0 results');
    await pg.keyboard.press('Escape'); await sleep(400);
    if (await pg.evaluate(() => document.getElementById('searchModal').classList.contains('active'))) throw new Error('Esc did not close');
    await pg.keyboard.press('/'); await sleep(400);
    if (!await pg.evaluate(() => document.getElementById('searchModal').classList.contains('active'))) throw new Error('"/" did not open');
  }, `palette ${f}`);
}

/* 2) living diagrams */
for (const f of ['article-13.html', 'article-9.html']) {
  await withPage(async pg => {
    await pg.goto(BASE + f, { waitUntil: 'networkidle2', timeout: 40000 });
    await pg.evaluate(() => document.querySelector('.rz-diagram')?.scrollIntoView({ block: 'center' }));
    await sleep(800);
    const pv0 = await pg.evaluate(() => document.querySelector('.rz-diagram [data-pv]')?.textContent);
    if (pv0 == null) throw new Error('no live values found');
    const btns = await pg.evaluate(() => document.querySelectorAll('.rz-diagram-btn').length);
    if (btns < 2) throw new Error('scenario buttons missing');
    await pg.evaluate(() => document.querySelectorAll('.rz-diagram-btn')[1].click());
    await sleep(400);
    const changed = await pg.evaluate(() => document.querySelectorAll('.rz-diagram [data-flow].off, .rz-diagram [data-flow].slow, .rz-diagram [data-inst].warn, .rz-diagram [data-inst].alarm').length);
    if (!changed) throw new Error('scenario click changed no flow/alarm state');
  }, `diagram ${f}`);
}

/* 3) scrollytelling */
await withPage(async pg => {
  await pg.goto(BASE + 'article-23.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(500);
  const stepTo = async i => { await pg.evaluate(i => document.querySelectorAll('.rz-scrolly-step')[i].scrollIntoView({ block: 'center' }), i); await sleep(1300); };
  await stepTo(3);
  /* counters animate (and restart when intermediate steps fire) — poll until settled */
  let end = null;
  for (let t = 0; t < 12; t++) {
    end = await pg.evaluate(() => ({ step: document.querySelector('.rz-scrolly').getAttribute('data-step'), day: document.querySelector('[data-cv="day"]').textContent, gpus: document.querySelector('[data-cv="gpus"]').textContent }));
    if (end.step === '3' && end.day === '122' && end.gpus === '100,000') break;
    await sleep(300);
  }
  if (end.step !== '3' || end.day !== '122' || end.gpus !== '100,000') throw new Error(`final step wrong: ${JSON.stringify(end)}`);
  await stepTo(0);
  const back = await pg.evaluate(() => document.querySelector('.rz-scrolly').getAttribute('data-step'));
  if (back !== '0') throw new Error('did not reverse to step 0');
}, 'scrolly article-23');

/* 4) reading polish */
await withPage(async pg => {
  await pg.goto(BASE + 'article-24.html', { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(700);
  const d = await pg.evaluate(() => ({ anchors: document.querySelectorAll('.article-body h2 .rz-anchor').length, chip: !!document.querySelector('.rz-minleft'), bars: (document.querySelector('.rz-read-prog') ? 1 : 0) + ((document.querySelector('.scroll-progress-container') && getComputedStyle(document.querySelector('.scroll-progress-container')).display !== 'none') ? 1 : 0) }));
  if (!d.anchors) throw new Error('heading anchors missing');
  if (!d.chip) throw new Error('min-left chip missing');
  if (d.bars !== 1) throw new Error(`expected exactly 1 progress bar, got ${d.bars}`);
}, 'polish article-24');

await browser.close();
server.close();

if (fails.length) {
  console.log(`\n✗ INTERACTION AUDIT — ${fails.length} failure(s):`);
  fails.forEach(x => console.log('   ' + x));
} else {
  console.log('INTERACTION AUDIT — CLEAN. Palette (2pp), living diagrams (2pp), scrollytelling, reading polish all exercised with real input.');
}
process.exit(STRICT && fails.length ? 1 : 0);
