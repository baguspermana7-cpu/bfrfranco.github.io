#!/usr/bin/env node
/**
 * test-flatten-ratchet — slop that is repaired in the browser, counted at build.
 *
 * WHY THIS EXISTS
 *
 * `flattenWashes()` in js/rz-article-editorial.js measures every `-card`,
 * `-panel` and `-block` in an article body and, if its computed background is a
 * translucent wash (alpha .02–.5, or a low-alpha gradient), marks it
 * `data-rz-flat` so css/rz-article-dark.css repaints it as a flat panel.
 *
 * That is the right behaviour for a reader and the wrong one for a build: a
 * regression ships, the browser quietly corrects it, and nothing anywhere fails.
 * Measured 2026-10-06: **114 elements on 40 pages** were being repaired this way.
 *
 * And the repair had a cost nobody had measured. The flat treatment repaints
 * every card with one grey hairline, `!important` — so on geopolitics-1 (dark)
 * the 14 `.comparison-card.threat` and 2 `.safe` cards rendered IDENTICALLY,
 * and on article-14 (light) `.negative` and `.positive` did too. Flattening was
 * erasing the one thing that told a reader good news from bad.
 *
 * WHAT IT CHECKS
 *   1. RATCHET. Per page and theme, the number of flattened elements may FALL
 *      freely and may not RISE. A rise is a new wash shipped in source. The
 *      repo's ratchet idiom, as in test-diagram-engine-adoption.mjs.
 *      Re-record after a deliberate source cleanup with --baseline.
 *   2. NO COLOURED STRIPE ON A CARD (ANTI_VIBECODE UX law #14: "group with a
 *      panel + 1px hairline — never with a decorative wash or a coloured
 *      stripe"). Counted from the RENDER — a `-card` whose left border differs
 *      from its other borders in width or colour — and ratcheted the same way.
 *      `audit-vibecode` catches stripes >= 3px in CSS text; this catches the
 *      2px one, the inline-style one, and the one a runtime paints.
 *
 *      History, because it is why this half exists: the first answer to the
 *      state-erasure defect was a red/green 2px rail on every flattened card,
 *      and this gate ENFORCED it. The owner called the result AI design slop,
 *      correctly — it broke law #14 and #7 (14 red rails on one page). The rails
 *      were withdrawn; state on the stat-tile component is now a 7px status dot,
 *      mapped by exact class token. A gate can enshrine a mistake as easily as
 *      prevent one.
 *
 * Run:  node tools/test-flatten-ratchet.mjs [--strict] [--baseline]
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const STRICT = process.argv.includes('--strict');
const RECORD = process.argv.includes('--baseline');
const BASELINE = resolve(ROOT, 'tools/flatten-ratchet.baseline.json');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.csv': 'text/csv', '.txt': 'text/plain' };


const srv = createServer(async (q, r) => {
  try {
    const u = decodeURIComponent((q.url || '/').split('?')[0]);
    const f = resolve(ROOT, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
    if (!f.startsWith(ROOT)) { r.writeHead(403).end(); return; }
    const b = await readFile(f);
    r.writeHead(200, { 'Content-Type': MIME[extname(f).toLowerCase()] || 'application/octet-stream' });
    r.end(b);
  } catch { r.writeHead(404).end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

const pages = [];
for (const f of (await readdir(ROOT)).sort()) {
  if (!f.endsWith('.html')) continue;
  if ((await readFile(resolve(ROOT, f), 'utf8')).includes('rz-article-editorial.js')) pages.push(f);
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const counts = {};
const stripes = {};
const stateFails = [];   /* page errors only, now */
const stripeExamples = {};

for (const theme of ['dark', 'light']) {
  const page = await browser.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.evaluateOnNewDocument((t) => {
    try { localStorage.setItem('theme', t); } catch (e) {}
  }, theme);
  await page.setViewport({ width: 1440, height: 900 });
  for (const f of pages) {
    let m = null;
    for (const timeout of [45000, 90000]) {          // known navigation flake: retry once
      try {
        await page.goto(`${base}/${f}`, { waitUntil: 'load', timeout });
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await new Promise((r) => setTimeout(r, 900));
        m = await page.evaluate(() => {
          const body = document.querySelector('.article-body') || document.body;
          const flat = body.querySelectorAll('[data-rz-flat]').length;
          let stripe = 0; const ex = [];
          for (const e of body.querySelectorAll('[class*="-card"]')) {
            if (!e.offsetParent) continue;
            const cs = getComputedStyle(e);
            const lw = parseFloat(cs.borderLeftWidth) || 0;
            if (lw < 1.5) continue;                       /* a hairline is not a stripe */
            const tw = parseFloat(cs.borderTopWidth) || 0;
            /* The law bans a COLOURED stripe. A 10%-white rule down the left of an
               otherwise borderless step card is a neutral rule, like a blockquote's;
               the first version of this counter flagged 19 of them as stripes, which
               would have made the number mean "has a left border" rather than the
               thing the law is about. Coloured = visible alpha AND real chroma. */
            const rgba = (cs.borderLeftColor.match(/[\d.]+/g) || []).map(Number);
            const [r, g, b] = rgba, a = rgba.length > 3 ? rgba[3] : 1;
            const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
            if (a < 0.35 || chroma < 0.12) continue;
            if (lw > tw + 0.5 || cs.borderLeftColor !== cs.borderTopColor) {
              stripe++;
              if (ex.length < 3) ex.push((typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).join('.'));
            }
          }
          return { n: flat, stripe, ex };
        });
        break;
      } catch (e) { if (timeout === 90000) stateFails.push(`${theme} ${f}: page error ${String(e.message).slice(0, 60)}`); }
    }
    if (!m) continue;
    counts[`${f}|${theme}`] = m.n;
    stripes[`${f}|${theme}`] = m.stripe;
    if (m.stripe) stripeExamples[`${f}|${theme}`] = m.ex;
  }
  await page.close();
}
await browser.close();
srv.close();

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log('── FLATTEN RATCHET ──');
console.log(`  ${pages.length} page(s) with the editorial runtime · both themes`);
const stripeTotal = Object.values(stripes).reduce((a, b) => a + b, 0);
console.log(`  ${total} wash(es) repaired in the browser · ${stripeTotal} coloured stripe(s) on cards\n`);

if (RECORD) {
  await writeFile(BASELINE, JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), total, stripeTotal, counts, stripes }, null, 2) + '\n');
  console.log(`  baseline recorded: ${total} washes, ${stripeTotal} stripes`);
}

let baseline = null;
try { baseline = JSON.parse(await readFile(BASELINE, 'utf8')); } catch {}
const rises = [], falls = [];
if (baseline) {
  for (const [k, n] of Object.entries(counts)) {
    const was = baseline.counts[k] ?? 0;
    if (n > was) rises.push(`${k.replace('|', ' · ')}: ${was} → ${n} wash(es)`);
    else if (n < was) falls.push(`${k.replace('|', ' · ')}: ${was} → ${n} wash(es)`);
  }
  for (const [k, n] of Object.entries(stripes)) {
    const was = (baseline.stripes || {})[k] ?? 0;
    if (n > was) rises.push(`${k.replace('|', ' · ')}: ${was} → ${n} coloured stripe(s) on cards — e.g. ${(stripeExamples[k] || []).join(', ')}`);
    else if (n < was) falls.push(`${k.replace('|', ' · ')}: ${was} → ${n} stripe(s)`);
  }
} else {
  console.log('  no baseline yet — run with --baseline to record one');
}

for (const f of falls) console.log(`  fell   ${f}`);
if (falls.length) console.log('  (a fall is progress — re-record with --baseline to lock it in)\n');

if (!rises.length && !stateFails.length) {
  console.log(`PASS — no new washes and no new coloured stripes on cards.`);
  process.exit(0);
}
if (rises.length) {
  console.log(`FAIL — ${rises.length} page/theme(s) ship MORE washes than the baseline:`);
  for (const r of rises) console.log(`  rose   ${r}`);
  console.log('  a wash rise is slop shipped in source and repaired in the browser; a stripe rise breaks UX law #14\n');
}
if (stateFails.length) {
  console.log(`FAIL — ${stateFails.length} page error(s):`);
  for (const s of stateFails) console.log(`  ${s}`);
}
process.exit(STRICT ? 1 : 0);
