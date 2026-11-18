#!/usr/bin/env node
/* test-conv-equipment-modal.mjs — STRICT. The deep equipment modal of the Conventional HMI sheets
   (js/conv/equipment-modal.js, CONV_EXECUTION_PLAN_2026-11-16 AD5 + §4 GD). On each wired sheet page, one item per
   symbol class, at 1440 and 390 in the authorised audit state:
   Q1 a click on the symbol body opens the inspector with an "Open equipment HMI" button
   Q2 the button opens the modal; focus moves inside it
   Q3 Tab and Shift+Tab never leave the modal (wrap)
   Q4 the page behind is inert while the modal is open (read from data-rz-cvm-inert: the audit-state harness strips
      `inert` itself through its auth-blocker observer, so the attribute alone would report the harness, not the page)
   Q5 Esc closes it, focus returns to the button that opened it, RZConvModal.timers() = 0
   Q6 a double-click on the symbol opens the modal directly (desktop widths)
   Q7 no horizontal overflow (page and modal panel); no "NaN" / "undefined" printed; every value cell is traced
      (data-basis-param, or data-rz-authored-basis; seeded values carry data-rz-sim)
   Usage: node tools/test-conv-equipment-modal.mjs [--page=chiller-plant.html] [--shots=<dir>] [--theme=light]
   Proven to fail: with the onOpenHmi wiring removed from js/conv/sheet-truth.js every Q2 fails. */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1];
const only = arg('page'), SHOTS = arg('shots'), THEME = arg('theme') || 'dark';
const PAGES = [['chiller-plant.html', '#chw-sheet-host'], ['fire-system.html', '#fire-sheet-host'], ['fuel-system.html', '#fuel-sheet-host'],
  ['water-system.html', '#water-sheet-host'], ['EPMS_Telemetry.html', '#epms-sheet-host']].filter(([p]) => !only || p === only);
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const fails = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checked = 0;

for (const [page, host] of PAGES) {
  for (const W of [1440, 390]) {
    const pg = await browser.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844, deviceScaleFactor: 1 });
    await primeCockpitAuditDocument(pg, THEME);
    await pg.goto(ORIGIN + page, { waitUntil: 'networkidle0', timeout: 90000 });
    await enterAuthorizedAuditState(pg, page === 'EPMS_Telemetry.html' ? 'epms' : page.replace('.html', ''));
    await sleep(2000);
    const wired = await pg.evaluate((h) => !!(window.RZConvModal && document.querySelector(h + ' .hmi-node')), host);
    if (!wired) { fails.push(`${page}@${W}: modal module or sheet missing`); await pg.close(); continue; }
    /* one item per class: the first tagged node of each symbol */
    const items = await pg.evaluate((h) => {
      const seen = {}, out = [];
      document.querySelectorAll(h + ' .hmi-node[data-node]').forEach((g) => {
        const id = g.getAttribute('data-node'), tag = document.querySelector(h + ' text[data-tag-of="' + id + '"]');
        const sym = (g.getAttribute('class') || '').split(/\s+/).find((c) => c.startsWith('sym-')) || g.getAttribute('data-sym') || id.replace(/\d+$/, '');
        if (!tag || seen[sym]) return; seen[sym] = 1; out.push({ id, tag: tag.textContent.trim() });
      });
      return out;
    }, host);
    let dbl = false;
    for (const it of items) {
      const where = `${page}@${W} ${it.tag}`;
      checked++;
      const pt = await pg.evaluate((h, id) => {
        const g = document.querySelector(h + ' .hmi-node[data-node="' + id + '"]'); g.scrollIntoView({ block: 'center', inline: 'center' });
        const b = g.querySelector('.b') || g.querySelector('rect,circle,path,polygon') || g; const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, host, it.id);
      await pg.mouse.click(pt.x, pt.y); await sleep(250);
      let q1 = await pg.evaluate(() => !!document.querySelector('aside.rz-inspector.open [data-rz-open-hmi]'));
      if (!q1) { await sleep(700); q1 = await pg.evaluate(() => !!document.querySelector('aside.rz-inspector.open [data-rz-open-hmi]')); if (q1) console.log(where + ' slow open (>250 ms)'); }
      if (!q1) {
        const why = await pg.evaluate((x, y) => { const h = document.elementFromPoint(x, y); const a = document.querySelector('aside.rz-inspector'); const sel = document.querySelector('.hmi-node.is-selected'); return (h ? h.tagName : 'none') + ' sel=' + (sel ? sel.getAttribute('data-node') : '-') + ' insp=' + (a ? a.className : '-') + ' sx=' + scrollX + ' sy=' + Math.round(scrollY); }, pt.x, pt.y);
        fails.push(where + ' Q1 inspector without Open equipment HMI (hit ' + why + ')'); await pg.keyboard.press('Escape'); continue;
      }
      await pg.click('aside.rz-inspector.open [data-rz-open-hmi]'); await sleep(250);
      const s = await pg.evaluate(() => {
        const m = document.querySelector('.rz-cvm:not([hidden])'); if (!m) return null;
        const panel = m.querySelector('.rz-cvm-panel');
        const bad = [...m.querySelectorAll('.rz-cvm-v')].filter((v) => !v.hasAttribute('data-basis-param') && !v.hasAttribute('data-rz-authored-basis')).length;
        return { focusIn: m.contains(document.activeElement), inert: [...document.body.children].filter((c) => c !== m && !/^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(c.tagName) && !c.hasAttribute('data-rz-cvm-inert')).map((c) => c.tagName + '#' + c.id + '.' + c.className).join(' ').slice(0, 80),
          nan: /NaN|undefined/.test(panel.textContent), untraced: bad, cells: m.querySelectorAll('.rz-cvm-v').length,
          over: document.documentElement.scrollWidth > innerWidth + 1 || panel.scrollWidth > panel.clientWidth + 1, f: m.querySelectorAll('button,[tabindex="0"]').length };
      });
      if (!s) { fails.push(where + ' Q2 modal did not open'); continue; }
      if (!s.focusIn) fails.push(where + ' Q2 focus not inside the modal');
      if (s.inert) fails.push(where + ` Q4 not inert: ${s.inert}`);
      if (s.nan) fails.push(where + ' Q7 NaN/undefined printed');
      if (s.untraced) fails.push(where + ` Q7 ${s.untraced}/${s.cells} value cells untraced`);
      if (s.over) fails.push(where + ' Q7 horizontal overflow');
      if (SHOTS && /^(CH-01|CHWP|TT-1|FP-01|FACP|TK-|P-101|GEN)/.test(it.tag)) await pg.screenshot({ path: path.join(SHOTS, `${page.replace('.html', '')}-${THEME}-${W}-${it.tag}.png`) });
      let escaped = false;
      for (let i = 0; i < s.f + 2; i++) { await pg.keyboard.press('Tab'); if (!(await pg.evaluate(() => document.querySelector('.rz-cvm').contains(document.activeElement)))) escaped = true; }
      for (let i = 0; i < 3; i++) { await pg.keyboard.down('Shift'); await pg.keyboard.press('Tab'); await pg.keyboard.up('Shift'); if (!(await pg.evaluate(() => document.querySelector('.rz-cvm').contains(document.activeElement)))) escaped = true; }
      if (escaped) fails.push(where + ' Q3 focus left the modal');
      await pg.keyboard.press('Escape'); await sleep(150);
      const q5 = await pg.evaluate(() => ({ closed: !!document.querySelector('.rz-cvm[hidden]'), back: !!(document.activeElement && document.activeElement.hasAttribute('data-rz-open-hmi')),
        timers: window.RZConvModal.timers(), inertLeft: document.querySelectorAll('body > [data-rz-cvm-inert], body > [inert]').length }));
      if (!q5.closed) fails.push(where + ' Q5 Esc did not close');
      if (!q5.back) fails.push(where + ' Q5 focus did not return to the Open HMI button');
      if (q5.timers) fails.push(where + ' Q5 timer still live after close');
      if (q5.inertLeft) fails.push(where + ' Q5 page left inert');
      await pg.keyboard.press('Escape'); await sleep(120);
      if (!dbl && W >= 800) {   /* double-click is the desktop path; on a phone the first tap's inspector covers the symbol and Q2 is the path */
        dbl = true;
        const p2 = await pg.evaluate((h, id) => { const g = document.querySelector(h + ' .hmi-node[data-node="' + id + '"]'); const b = g.querySelector('.b') || g; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, host, it.id);
        await pg.mouse.click(p2.x, p2.y, { clickCount: 1 }); await pg.mouse.click(p2.x, p2.y, { clickCount: 2 }); await sleep(250);
        if (!(await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden])')))) fails.push(where + ' Q6 double-click did not open the modal');
        await pg.keyboard.press('Escape'); await sleep(120); await pg.keyboard.press('Escape'); await sleep(120);
      }
    }
    if (errs.length) fails.push(`${page}@${W} page errors: ${errs[0].slice(0, 120)}`);
    console.log(`${page}@${W}: ${items.length} classes checked`);
    await pg.close();
  }
}
await browser.close(); srv.close();
if (fails.length) { console.log(fails.slice(0, 40).join('\n')); console.log(`\nCONV EQUIPMENT MODAL — FAIL (${fails.length} findings over ${checked} items)`); process.exit(1); }
console.log(`\nCONV EQUIPMENT MODAL — PASS (${checked} items: open, focus trap, inert, Esc, focus return, timers, double-click, overflow, traced cells)`);
