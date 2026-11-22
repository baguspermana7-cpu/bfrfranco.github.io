#!/usr/bin/env node
/* test-conv-declutter.mjs — PRD-CONV-BMS-DECLUTTER (owner R185: "masih ada tulisan2 yg tidak perlu atau duplicate masih
   over"). On the RENDER at 1440 x 900, first screen, 7 Conventional BMS pages:
   DC1 visible words outside the drawing on the first screen <= the page's budget (set from the declutter, never raised)
   DC2 the strip provenance line (p.rz-prov[id$="-strip"]) is not shown but stays in the DOM with its text, its text is
       in a tooltip on the page, and the page still SHOWS "Simulated" at least once (data honesty)
   DC3 every [data-quiet] element is not shown and its text is in the title of its host (js/conv/quiet.js)
   DC4 every [data-dup] element is not shown; when it names an element id, that element is shown (the reading stays)
   DC5 the tooltip follows a rewrite: a script writing a quiet element updates its host's title (water kWueTh)
   node tools/test-conv-declutter.mjs [--page=x.html] */
import puppeteer from 'puppeteer';
import { serve, collect, summarise } from './audit-conv-text.mjs';

export const BUDGET = { 'chiller-plant.html': 200, 'fuel-system.html': 160, 'water-system.html': 200, 'fire-system.html': 145,
  'ict.html': 140, 'EPMS_Telemetry.html': 180, 'datahall.html': 310 };
const only = process.argv.slice(2).filter((a) => a.startsWith('--page=')).map((a) => a.slice(7));
const pages = only.length ? only : Object.keys(BUDGET);
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };

const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port;
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  for (const p of pages) {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1440, height: 900 });
    await pg.goto(base + '/' + p, { waitUntil: 'load', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 3500));
    const s = summarise(await pg.evaluate(collect));
    ok(s.wordsHtml <= BUDGET[p], `DC1 ${p}: ${s.wordsHtml} words on the first screen outside the drawing (budget ${BUDGET[p]})`);
    const r = await pg.evaluate(() => {
      const shown = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
      const titles = [...document.querySelectorAll('[title]')].map((e) => e.getAttribute('title'));
      const prov = [...document.querySelectorAll('p.rz-prov[id$="-strip"]')].map((el) => ({ id: el.id, shown: shown(el), text: norm(el.textContent),
        inTip: titles.some((t) => t.includes(norm(el.textContent))) || (el.hasAttribute('data-quiet') ? false : null) }));
      const simShown = [...document.querySelectorAll('body *')].some((el) => !el.closest('svg') && shown(el) &&
        [...el.childNodes].some((n) => n.nodeType === 3 && /simulated/i.test(n.nodeValue)));
      const quiet = [...document.querySelectorAll('[data-quiet]')].map((el) => {
        const sel = el.getAttribute('data-quiet');
        const host = !sel ? el.parentElement : ((el.parentElement && el.parentElement.closest(sel)) || document.querySelector(sel) || el.parentElement);
        const t = norm(el.textContent);
        return { what: el.id || el.className || el.tagName, shown: shown(el), ok: !t || (host && (host.getAttribute('title') || '').split('\n').includes(t)) };
      });
      const dup = [...document.querySelectorAll('[data-dup]')].map((el) => { const v = el.getAttribute('data-dup'), tgt = /^[\w-]+$/.test(v) ? document.getElementById(v) : null;
        return { what: el.id || el.className || el.tagName, v, shown: shown(el), target: tgt ? shown(tgt) || tgt.closest('.epms-sld-only,[hidden]') !== null : null }; });
      return { prov, simShown, quiet, dup };
    });
    for (const x of r.prov) {
      ok(!x.shown, `DC2 ${p}: provenance line #${x.id} still shown at rest`);
      ok(x.text.length > 20, `DC2 ${p}: provenance line #${x.id} lost its text`);
      ok(x.inTip !== false, `DC2 ${p}: provenance text of #${x.id} is in no tooltip`);
    }
    ok(r.simShown, `DC2 ${p}: "Simulated" is no longer shown anywhere`);
    for (const q of r.quiet) { ok(!q.shown, `DC3 ${p}: quiet ${q.what} is shown`); ok(q.ok, `DC3 ${p}: quiet ${q.what} text missing from its host tooltip`); }
    for (const d of r.dup) { ok(!d.shown, `DC4 ${p}: duplicate ${d.what} is shown`); ok(d.v.length > 0 && d.target !== false, `DC4 ${p}: duplicate ${d.what} hides "${d.v}" but that reading is not shown`); }
    if (p === 'water-system.html') {
      const f = await pg.evaluate(async () => { const el = document.getElementById('kWueTh'); if (!el) return 'missing'; el.textContent = 'Target ≤ 9.99 · probe'; await new Promise((r) => setTimeout(r, 100));
        return (el.closest('.kpi').getAttribute('title') || ''); });
      ok(/9\.99 · probe/.test(f) && !/Target ≤ 1\.30/.test(f), 'DC5 water: the WUE target tooltip did not follow a rewrite: ' + JSON.stringify(f));
    }
    console.log(`  ${p.padEnd(22)} words ${s.wordsHtml}/${BUDGET[p]}  prov ${r.prov.length}  quiet ${r.quiet.length}  dup ${r.dup.length}`);
    await pg.close();
  }
} finally { await browser.close(); srv.close(); }
if (fails.length) { fails.forEach((f) => console.log('  ✗ ' + f)); console.log(`CONV DECLUTTER — FAIL (${fails.length} of ${checks})`); process.exit(1); }
console.log(`CONV DECLUTTER — PASS (${checks} checks: words on the first screen, provenance in a tooltip, quiet text in its host tooltip, duplicates hidden)`);
