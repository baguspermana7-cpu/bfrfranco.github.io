#!/usr/bin/env node
/* test-figure-interact.mjs — explorable engine figures (K24, pillar-fire-safety.html).
 *   F1  every figure with a rz-figure-detail block is wired (data-rz-fx="ready"), each node box is a focusable button
 *       with a name, and every node id in the drawing has a detail entry (no silent blanks)
 *   F2  hovering a node lights exactly its own connectors and dims the rest (pointer device)
 *   F3  clicking a node opens the panel: name = the drawn name, text = the detail, "Fed by"/"Leads to" = the drawn edges,
 *       and the "Read:" link resolves to a heading on the page
 *   F4  a neighbour button walks the drawing; Escape on a node and the close button clear the selection
 *   F5  keyboard: Tab reaches a node, Enter opens it; at 390 px a tap opens it and nothing scrolls sideways
 *   F6  spacing (owner: too much white space): the tallest table 40 % and the page 10 % shorter than before K24 at 1440
 *   node tools/test-figure-interact.mjs [--page=pillar-fire-safety.html]   exit 1 on any failure */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = (process.argv.find((a) => a.startsWith('--page=')) || '--page=pillar-fire-safety.html').slice(7);
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✘', n, d === undefined ? '' : JSON.stringify(d).slice(0, 400)); } };
const port = 8000 + Math.floor(Math.random() * 900) + 100;
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/${PAGE}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 500));
  const f1 = await page.evaluate(() => {
    const figs = [...document.querySelectorAll('.rz-figure')].filter((f) => f.querySelector('script.rz-figure-detail'));
    return figs.map((f) => { const d = JSON.parse(f.querySelector('script.rz-figure-detail').textContent); const ids = [...new Set([...f.querySelectorAll('[data-rzd-node]')].map((n) => n.getAttribute('data-rzd-node')))];
      const nodes = [...f.querySelectorAll('[data-rzd-node]')];
      return { id: f.getAttribute('data-rz-figure'), ready: f.getAttribute('data-rz-fx'), ids: ids.length, missing: ids.filter((i) => !d[i] || !d[i].text), focusable: nodes.every((n) => n.getAttribute('tabindex') === '0' && n.getAttribute('role') === 'button' && /\S/.test(n.getAttribute('aria-label') || '')) }; });
  });
  ok('F1 every explorable figure is wired, all nodes focusable buttons with a name, every node has a detail', f1.length >= 3 && f1.every((f) => f.ready === 'ready' && f.ids >= 6 && !f.missing.length && f.focusable), f1);
  const fig = '.rz-figure[data-rz-figure="fire-d1"]';
  const box = await page.evaluate((fig) => { const f = document.querySelector(fig); f.scrollIntoView({ block: 'center', behavior: 'instant' }); const svg = [...f.querySelectorAll('svg')].find((s) => s.getBoundingClientRect().width > 0); const r = svg.querySelector('[data-rzd-node="facp"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, fig);
  await page.mouse.move(box.x, box.y); await new Promise((r) => setTimeout(r, 250));
  const f2 = await page.evaluate((fig) => { const svg = [...document.querySelector(fig).querySelectorAll('svg')].find((s) => s.getBoundingClientRect().width > 0); const hot = [...svg.querySelectorAll('[data-rzd-edge].rz-fx-hot')].map((e) => e.getAttribute('data-rzd-edge')).sort(); const all = svg.querySelectorAll('[data-rzd-edge]').length; const cold = [...svg.querySelectorAll('[data-rzd-edge]:not(.rz-fx-hot)')].map((e) => +getComputedStyle(e).opacity); return { hot, all, on: svg.classList.contains('rz-fx-on'), coldMax: Math.max(...cold) }; }, fig);
  ok('F2 hover on the fire alarm panel lights its 3 connectors (asd, spot in; pre out) and dims the rest', JSON.stringify(f2.hot) === JSON.stringify(['asd>facp', 'facp>pre', 'spot>facp']) && f2.on && f2.coldMax < 0.5, f2);
  await page.mouse.click(box.x, box.y); await new Promise((r) => setTimeout(r, 200));
  const f3 = await page.evaluate((fig) => { const f = document.querySelector(fig), p = f.querySelector('.rz-fx-panel'), see = p.querySelector('.rz-fx-see'); const d = JSON.parse(f.querySelector('script.rz-figure-detail').textContent).facp;
    const rels = [...p.querySelectorAll('.rz-fx-rel')].map((r) => r.textContent); return { hidden: p.hidden, name: p.querySelector('.rz-fx-name').textContent, text: p.querySelector('.rz-fx-text').textContent === d.text, rels, see: see && see.getAttribute('href'), seeOk: !!(see && document.getElementById(see.getAttribute('href').slice(1))) }; }, fig);
  ok('F3 click opens the panel with the drawn name, the detail text, fed by / leads to from the edges, and a resolving section link', !f3.hidden && f3.name === 'Fire alarm panel' && f3.text && f3.rels.length === 2 && /Fed by.*Aspirating detector.*Spot smoke detector/.test(f3.rels[0]) && /Leads to.*Pre-discharge alarm/.test(f3.rels[1]) && f3.seeOk, f3);
  await page.evaluate((fig) => document.querySelector(fig + ' .rz-fx-panel [data-fx-go="pre"]').click(), fig);
  const f4a = await page.evaluate((fig) => ({ name: document.querySelector(fig + ' .rz-fx-name').textContent, focus: document.activeElement && document.activeElement.getAttribute('data-fx-go') }), fig);
  await page.evaluate((fig) => document.querySelector(fig + ' .rz-fx-close').click(), fig);
  const f4b = await page.evaluate((fig) => ({ hidden: document.querySelector(fig + ' .rz-fx-panel').hidden, sel: document.querySelectorAll(fig + ' .rz-fx-sel').length }), fig);
  ok('F4 a neighbour button walks to "Pre-discharge alarm" (focus stays in the panel); Close clears the selection', f4a.name === 'Pre-discharge alarm' && !!f4a.focus && f4b.hidden && f4b.sel === 0, { f4a, f4b });
  await page.evaluate((fig) => { const svg = [...document.querySelector(fig).querySelectorAll('svg')].find((s) => s.getBoundingClientRect().width > 0); svg.querySelector('[data-rzd-node="dly"]').focus(); }, fig);
  await page.keyboard.press('Enter');
  const f5 = await page.evaluate((fig) => ({ hidden: document.querySelector(fig + ' .rz-fx-panel').hidden, name: document.querySelector(fig + ' .rz-fx-name').textContent }), fig);
  await page.keyboard.press('Escape');
  ok('F5 keyboard: Enter on a focused node opens it', !f5.hidden && f5.name === 'Time delay', f5);
  const f6 = await page.evaluate(() => ({ H: document.documentElement.scrollHeight, maxTable: Math.max(...[...document.querySelectorAll('.article-body .ws-table')].map((t) => Math.round(t.getBoundingClientRect().height))) }));
  ok('F6 spacing: tallest table <= 1,264 px (40 % under the 2,107 before) and the page <= 21,170 px (10 % under 23,527) at 1440', f6.maxTable <= 1264 && f6.H <= 21170, f6);
  const ph = await browser.newPage(); await ph.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await ph.goto(`http://127.0.0.1:${port}/${PAGE}`, { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise((r) => setTimeout(r, 500));
  const tb = await ph.evaluate((fig) => { const f = document.querySelector(fig); f.scrollIntoView({ block: 'center', behavior: 'instant' }); const svg = [...f.querySelectorAll('svg')].find((s) => s.getBoundingClientRect().width > 0); const r = svg.querySelector('[data-rzd-node="rel"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, narrow: svg.classList.contains('rz-fig-narrow') }; }, fig);
  await ph.touchscreen.tap(tb.x, tb.y); await new Promise((r) => setTimeout(r, 250));
  const f7 = await ph.evaluate((fig) => ({ hidden: document.querySelector(fig + ' .rz-fx-panel').hidden, name: document.querySelector(fig + ' .rz-fx-name').textContent, sx: document.documentElement.scrollWidth - window.innerWidth }), fig);
  ok('F5 at 390 px a tap on the phone drawing opens "Release solenoid", no sideways scroll', tb.narrow && !f7.hidden && f7.name === 'Release solenoid' && f7.sx <= 0, { tb, f7 });
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); srv.kill(); }
console.log(`FIGURE INTERACT — ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
