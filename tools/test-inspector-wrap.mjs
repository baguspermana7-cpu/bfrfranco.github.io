#!/usr/bin/env node
/**
 * Conventional inspector text wrap (v3.115.3).
 *
 * W1: no word in the inspector title or a row value breaks across two lines when it would fit on one line of its box.
 *     (Red on v3.115.2: `word-break: break-all` split "pair" into "pai / r" and "reverse" into "reve / rse".)
 *     A token wider than its box (a long registry id) may still wrap; that is not counted.
 * W2: the title does not run under the close button.
 * Pages: water-system (PIC-301 bubble) and fuel-system (LIC on the first day tank), at 390 and 1440. 0 page errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', woff2: 'font/woff2' };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html', p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[rel.split('.').pop()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d);
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CASES = [['water-system', 'pic301'], ['fuel-system', 'lc1']];
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
let fail = 0;
for (const W of [390, 1440]) {
  for (const [page, node] of CASES) {
    const pg = await browser.newPage(), errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.setViewport({ width: W, height: W < 600 ? 844 : 900, isMobile: W < 600, hasTouch: W < 600 });
    await primeCockpitAuditDocument(pg, 'dark');
    await pg.goto(ORIGIN + page + '.html', { waitUntil: 'networkidle2', timeout: 120000 });
    try { await enterAuthorizedAuditState(pg, page); } catch (e) { /* the page may already be open */ }
    await wait(2500);
    const box = await pg.evaluate((id) => { const g = document.querySelector('.hmi-node[data-node="' + id + '"]'); if (!g) return null;
      g.scrollIntoView({ block: 'center', inline: 'center' }); const b = g.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 3 }; }, node);
    if (!box) { console.log(`FAIL ${page} ${W}: node ${node} not found`); fail++; await pg.close(); continue; }
    await wait(400);
    const b2 = await pg.evaluate((id) => { const b = document.querySelector('.hmi-node[data-node="' + id + '"]').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 3 }; }, node);
    await pg.mouse.click(b2.x, b2.y); await wait(1000);
    const r = await pg.evaluate(() => {
      const ins = document.querySelector('.rz-inspector.open'); if (!ins) return null;
      const split = [];
      for (const el of ins.querySelectorAll('.rz-inspector-id, .rz-inspector-v')) {
        const wBox = el.clientWidth, walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
          const re = /\S+/g; let m;
          while ((m = re.exec(t.data))) {
            const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length);
            const rects = [...rg.getClientRects()].filter((q) => q.width > 0.5);
            const tops = new Set(rects.map((q) => Math.round(q.top)));
            const width = rects.reduce((s, q) => s + q.width, 0);
            if (tops.size > 1 && width <= wBox - 1) split.push(m[0]);
          }
        }
      }
      const id = ins.querySelector('.rz-inspector-id'), x = ins.querySelector('.rz-inspector-close');
      let under = 0;
      if (id && x) { const xb = x.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(id);
        for (const q of rg.getClientRects()) if (q.right > xb.left + 0.5 && q.bottom > xb.top && q.top < xb.bottom) under++; }
      return { split, under, title: id ? id.textContent : '' };
    });
    if (!r) { console.log(`FAIL ${page} ${W}: inspector did not open`); fail++; await pg.close(); continue; }
    const ok1 = r.split.length === 0, ok2 = r.under === 0, ok3 = errs.length === 0;
    console.log(`${ok1 ? 'PASS' : 'FAIL'} W1 ${page} ${W}: ${r.split.length} word(s) split${r.split.length ? ' — ' + r.split.slice(0, 6).join(', ') : ''}`);
    console.log(`${ok2 ? 'PASS' : 'FAIL'} W2 ${page} ${W}: title "${r.title.slice(0, 60)}" ${r.under} line(s) under the close button`);
    if (!ok3) console.log(`FAIL ${page} ${W}: page errors ${errs.slice(0, 2).join(' | ')}`);
    fail += !ok1 + !ok2 + !ok3;
    await pg.close();
  }
}
await browser.close(); srv.close();
console.log(fail ? `FAIL inspector wrap — ${fail} check(s) failed` : 'PASS inspector wrap — no word split, title clear of the close button');
process.exit(fail ? 1 : 0);
