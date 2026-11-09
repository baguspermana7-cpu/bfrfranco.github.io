#!/usr/bin/env node
/* ============================================================================
   audit-a11y.mjs — accessibility render gate (v1.50.41)

   Runs axe-core (vendored at tools/vendor/axe.min.js, 4.10.2) over a
   representative page set in BOTH themes and fails on any violation with
   impact critical or serious (contrast, labels, link-in-text-block,
   scrollable-region-focusable, button-name, image-alt, aria-*).

   Moderate/minor findings (heading-order, region) are REPORTED but do not
   gate — they are tracked as deferred work, not regressions.

   Usage:
     node tools/audit-a11y.mjs            # report
     node tools/audit-a11y.mjs --strict   # exit 1 on critical/serious

   Notes (lessons already paid for):
   - Serves over local HTTP: file:// breaks fetch() of search-index.json etc.
   - Theme is applied by writing localStorage.theme BEFORE navigation — pages
     like index.html re-apply the theme from storage on window.load, so a bare
     post-load attribute flip gets undone (same fix as audit-dark-coverage).
   - newPageSafe(): relaunches the browser on ConnectionClosedError crashes.
   ============================================================================ */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');
const AXE_SRC = fs.readFileSync(path.join(ROOT, 'tools/vendor/axe.min.js'), 'utf8');

/* Representative set: heaviest bespoke CSS (article-26), a standard editorial
   article, both hardened calculators, glossary, the two main landings. */
const PAGES = [
  'index.html',
  'articles.html',
  'article-13.html',
  'article-26.html',
  'fire-calculator.html',
  'cdu-calculator.html',
  'glossary.html',
  'datacenter-solutions.html',
];
const THEMES = ['light', 'dark'];
const GATE_IMPACTS = new Set(['critical', 'serious']);

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

const srv = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise(r => srv.listen(0, r));
const PORT = srv.address().port;

const LAUNCH = { args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] };
let browser = await puppeteer.launch(LAUNCH);
async function newPageSafe() {
  try { return await browser.newPage(); }
  catch (e) {
    try { await browser.close(); } catch (_) {}
    browser = await puppeteer.launch(LAUNCH);
    return browser.newPage();
  }
}

const gating = [];   // critical/serious
const advisory = []; // moderate/minor (reported, non-gating)

for (const f of PAGES) {
  for (const theme of THEMES) {
    const pg = await newPageSafe();
    try {
      await pg.evaluateOnNewDocument(t => { try { localStorage.setItem('theme', t); } catch (e) {} }, theme);
      await pg.goto(`http://localhost:${PORT}/${f}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await pg.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
      await new Promise(r => setTimeout(r, 700)); // settle theme transitions
      // 2026-11-09 (v3.35.5): the homepage reveals each section when it scrolls into view (IntersectionObserver), so
      // below the fold its text sits at opacity 0 until a reader gets there — axe, which never scrolls, sampled 22
      // FAQ answers at that opacity. Pass through the page like a reader first (steps of one viewport, then back to
      // the top), so scroll-triggered reveals run; the settle below then jumps them to their end state. Colours are
      // untouched, so a real low contrast still fails.
      // scroll-behavior: smooth on <html> made a plain scrollTo glide, so the 60 ms steps never arrived and the FAQ stayed
      // hidden — axe then SKIPS opacity-0 text, and a seeded #d4d4d4 answer passed. Instant steps, then a guard below.
      await pg.evaluate(async () => { const h = innerHeight; for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(h * 0.6)) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 80)); } window.scrollTo({ top: 0, behavior: 'instant' }); }).catch(() => {});
      const unrevealed = await pg.evaluate(() => [...document.querySelectorAll('.rv-armed:not(.rv-in)')].map(e => e.id || e.className)).catch(() => []);
      if (unrevealed.length) gating.push({ page: f, theme, rule: 'reveal-never-ran', impact: 'serious', target: unrevealed.join(', '), msg: 'scroll-triggered reveal never ran, axe would skip its hidden text' });
      // settle one-shot entrance animations too: axe blends opacity into the sampled colour, and a staggered
      // fade-in (e.g. the hub's .keys li, 200 ms + i x 70 ms + 400 ms) outlives the 700 ms above — a mid-fade
      // sample read #6B7280 as #A6AAB2 (2.3:1) on 2026-11-07. Finite animations only; capped at 4 s.
      // Poll rather than snapshot: rows inserted after load (engine-fed lists) and re-renders on the theme
      // switch start NEW finite animations after a one-shot wait returned; 2026-11-07 the hub's four
      // .keys li sampled #767d8a/#9398a2/#e0e2e4/#cdcfd2 mid-fade with the snapshot wait. Quiet = two
      // consecutive 200 ms polls with no finite animation running; capped at 6 s.
      await pg.evaluate(() => new Promise(res => {
        const t0 = Date.now(); let quiet = 0;
        const finite = () => document.getAnimations().filter(a => { const e = a.effect && a.effect.getTiming ? a.effect.getTiming() : null; return e && e.iterations !== Infinity && a.playState !== 'finished'; });
        const tick = () => { if (finite().length === 0) quiet++; else quiet = 0; if (quiet >= 2 || Date.now() - t0 > 6000) res(); else setTimeout(tick, 200); };
        tick();
      })).catch(() => {});
      // 2026-11-07 (third instance): the hub's hero mounts after the poll returned quiet, and axe then sampled the
      // LAST staggered .keys li (ambient, delay 200 ms + 3 x 70 ms) mid-fade at #cdcfd4 / #d5d6d9 on white. Waiting
      // cannot win a race against work that starts later, so the sample is taken at REST: every finite animation
      // and transition is jumped to its end state (fill: forwards keeps it there), twice, 250 ms apart, so a
      // tick that starts a new one in between is caught too. Infinite ones (flows, dwell bars) are left alone.
      for (let pass = 0; pass < 2; pass++) {
        await pg.evaluate(() => { document.getAnimations().forEach(a => { try { const e = a.effect && a.effect.getTiming ? a.effect.getTiming() : null; if (e && e.iterations !== Infinity) a.finish(); } catch (err) {} }); });
        await new Promise(r => setTimeout(r, 250));
      }
      await pg.evaluate(AXE_SRC);
      const res = await pg.evaluate(async () => await axe.run(document, {
        resultTypes: ['violations'],
        rules: { 'meta-viewport': { enabled: false } }, // pinch-zoom handled site-wide; some legacy pages pending
      }));
      for (const v of res.violations) {
        const bucket = GATE_IMPACTS.has(v.impact) ? gating : advisory;
        for (const n of v.nodes) {
          bucket.push({ page: f, theme, rule: v.id, impact: v.impact,
            target: (n.target && n.target[0]) || '?', msg: (n.failureSummary || '').split('\n')[1] || v.help });
        }
      }
    } catch (e) {
      gating.push({ page: f, theme, rule: 'PAGE-ERROR', impact: 'critical', target: '-', msg: String(e).slice(0, 140) });
    } finally {
      try { await pg.close(); } catch (_) {}
    }
  }
}
try { await browser.close(); } catch (_) {}
srv.close();

function print(list, label) {
  if (!list.length) return;
  console.log(`\n${label} (${list.length}):`);
  for (const x of list.slice(0, 40))
    console.log(`  [${x.impact}] ${x.page}/${x.theme}  ${x.rule}  ${x.target}\n      ${(x.msg || '').trim().slice(0, 130)}`);
  if (list.length > 40) console.log(`  … +${list.length - 40} more`);
}
if (gating.length) {
  const counts = {};
  for (const x of gating) { const k = `${x.page}/${x.theme}  ${x.rule}`; counts[k] = (counts[k] || 0) + 1; }
  console.log('\nGATING summary (page/theme  rule  count):');
  for (const [k, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${c}× ${k}`);
}
print(gating, '✗ GATING — critical/serious violations');
print(advisory, '• advisory — moderate/minor (non-gating, tracked as deferred)');

if (!gating.length) {
  console.log(`\nA11Y AUDIT — CLEAN. ${PAGES.length} pages × ${THEMES.length} themes: 0 critical/serious axe violations` +
    (advisory.length ? ` (${advisory.length} advisory moderate/minor).` : '.'));
} else {
  console.log(`\nA11Y AUDIT — ${gating.length} critical/serious violation(s).`);
  if (STRICT) process.exit(1);
}
