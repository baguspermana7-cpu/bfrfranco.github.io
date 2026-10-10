#!/usr/bin/env node
/* test-fmea-sim — the FMEA simulator on every incident page works and agrees with the page.
 *
 * For each incident-*.html, at 390px and 1440px:
 *   1. js/rz-fmea-sim.js upgrades the section (.fm-sim.is-live) with no page error.
 *   2. Its arithmetic matches the builder's: "As found" and "Published actions" totals
 *      equal the two numbers in the static metabar ("total RPN A → B").
 *   3. Every replay step, every scenario and a what-if drag on every mode run without
 *      throwing, and the slider under the pointer survives its own update (rebuilding it
 *      on `input` ends the drag on a real device).
 *   4. Nothing inside the simulator runs past the viewport.
 *
 *   5. The hub's library-wide FMEA agrees with the pages (mode count), every mode link
 *      resolves to a worksheet row, and the section fits 390px with no sideways table.
 *
 * Run: node tools/test-fmea-sim.mjs [--strict]     (--strict exits 1 on any finding)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STRICT = process.argv.includes('--strict');
const pages = fs.readdirSync(ROOT).filter((f) => /^incident-.*\.html$/.test(f)).sort();
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const bad = [];

for (const f of pages) {
  for (const w of [390, 1440]) {
    const p = await browser.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.setViewport({ width: w, height: 900 });
    await p.goto('file://' + path.join(ROOT, f), { waitUntil: 'networkidle2', timeout: 30000 });
    const r = await p.evaluate(() => {
      const out = [];
      const sim = document.querySelector('[data-fm-sim]');
      if (!sim) return ['no [data-fm-sim] section'];
      if (!sim.classList.contains('is-live')) return ['simulator did not start'];
      const num = (t) => Number(String(t).replace(/[^\d]/g, ''));
      const meta = document.querySelector('.fm-meta').textContent.match(/total RPN\s*(\d+)\s*→\s*(\d+)/);
      if (!meta) out.push('static metabar total not found — cannot cross-check');
      const total = () => num(sim.querySelector('.fm-readout b').textContent);
      const seg = (k) => [...sim.querySelectorAll('.fm-seg button')][k];
      seg(0).click();
      if (meta && total() !== Number(meta[1])) out.push(`as-found total ${total()} ≠ metabar ${meta[1]}`);
      seg(1).click();
      if (meta && total() !== Number(meta[2])) out.push(`published-actions total ${total()} ≠ metabar ${meta[2]}`);
      seg(2).click(); seg(3).click(); seg(0).click();
      const rg = sim.querySelector('.fm-rp-range');
      if (rg) for (let k = 0; k <= Number(rg.max); k++) { rg.value = k; rg.dispatchEvent(new Event('input')); }
      for (const row of sim.querySelectorAll('.fm-pb-row')) {
        row.click();
        const i = document.getElementById('fmwi-D');
        if (!i) { out.push(`${row.dataset.id}: what-if did not open`); continue; }
        i.value = 1; i.dispatchEvent(new Event('input'));
        if (document.getElementById('fmwi-D') !== i) out.push(`${row.dataset.id}: slider rebuilt during drag`);
      }
      const vw = document.documentElement.clientWidth;
      const over = [...sim.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > vw + 1);
      if (over.length) out.push(`${over.length} element(s) past the viewport, first ${over[0].className}`);
      return out;
    });
    for (const m of [...r, ...errs.map((e) => 'page error: ' + e)]) bad.push(`${f} @${w}: ${m}`);
    await p.close();
  }
}
// The library-wide view on the hub: its mode count must equal the sum over the
// incident pages, every histogram link must land on a real worksheet row, and the
// section must fit a phone without a sideways scroll (the category table included).
let pageModes = 0;
for (const f of pages) pageModes += (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/<details class="fm-row"/g) || []).length;
const hubIds = new Map();
for (const f of pages) hubIds.set(f, new Set([...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/<details class="fm-row" id="([^"]+)"/g)].map((m) => m[1])));
for (const w of [390, 1440]) {
  const p = await browser.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.setViewport({ width: w, height: 900 });
  await p.goto('file://' + path.join(ROOT, 'dc-incidents.html'), { waitUntil: 'networkidle2', timeout: 30000 });
  const h = await p.evaluate(() => {
    const sec = document.getElementById('fmea-corpus');
    if (!sec) return { missing: true };
    const meta = document.querySelector('.fc-meta');
    const vw = document.documentElement.clientWidth;
    const scope = [...document.querySelectorAll('.fc-meta, .fc-grid, .fc-tbl, .fc-left')];
    const wrap = document.querySelector('.fc-tbl').closest('.table-wrap');
    return {
      modes: Number((meta.textContent.match(/(\d+)\s*failure modes/) || [])[1]),
      over: scope.flatMap((e) => [e, ...e.querySelectorAll('*')]).filter((e) => e.getBoundingClientRect().right > vw + 1).length,
      tableScroll: wrap ? wrap.scrollWidth - wrap.clientWidth : 0,
      links: [...document.querySelectorAll('.fc-list a')].map((a) => a.getAttribute('href')),
    };
  });
  if (h.missing) { bad.push(`dc-incidents.html @${w}: no #fmea-corpus section`); await p.close(); continue; }
  if (h.modes !== pageModes) bad.push(`dc-incidents.html: hub says ${h.modes} modes, incident pages carry ${pageModes}`);
  if (h.over) bad.push(`dc-incidents.html @${w}: ${h.over} FMEA element(s) past the viewport`);
  if (h.tableScroll > 1) bad.push(`dc-incidents.html @${w}: category table scrolls sideways by ${h.tableScroll}px`);
  const dead = h.links.filter((href) => { const [f, id] = href.split('#'); return !(hubIds.get(f) || new Set()).has(id); });
  if (dead.length) bad.push(`dc-incidents.html: ${dead.length} mode link(s) land nowhere, first ${dead[0]}`);
  for (const e of errs) bad.push(`dc-incidents.html @${w}: page error: ${e}`);
  await p.close();
}

await browser.close();
if (bad.length) {
  console.log(bad.join('\n'));
  console.log(`FAIL — ${bad.length} finding(s) across ${pages.length} page(s)`);
  if (STRICT) process.exit(1);
} else {
  console.log(`PASS — FMEA simulator live and consistent on ${pages.length} page(s) at 390 and 1440px; hub view agrees (${pageModes} modes).`);
}
