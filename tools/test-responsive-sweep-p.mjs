#!/usr/bin/env node
/**
 * test-responsive-sweep-p.mjs — W6-2: every surface the P-series added fits at 360/390/768/1280/1440 in both themes.
 * Pages are DERIVED: every .html that loads a P-series module (the site-wide command palette alone does not qualify —
 * it is swept with the shell). Per page and theme, one load, then the viewport steps through the five widths.
 *  R1 no page-level horizontal scroll a reader can use at any width: scrollWidth <= clientWidth, unless the viewport's
 *     overflow-x is hidden/clip (a full-screen cockpit such as EPMS sets body{overflow:hidden}: wheel and touch cannot
 *     scroll it; its 82 px of hidden overflow at 1280 is recorded in 05-test-evidence/W6-sweeps.md, not counted here)
 *  R2 each visible P surface (project chip/popover, share/compare row, hand-off line, embed slot, Ask slot, basis/Cx
 *     panels) lies inside the viewport horizontally
 * Run: node tools/test-responsive-sweep-p.mjs [--only=<substring>]
 */
import { join, dirname, resolve, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, readFileSync, statSync } from 'node:fs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES = ['rz-project.js', 'rz-scenario.js', 'rz-compare.js', 'rz-pack.js', 'rz-embed.js', 'rz-embed-article.js', 'rz-embed-compute.js',
  'rz-handoff.js', 'rz-handoff-cx.js', 'calc-parameters.js', 'rz-cx-records-ui.js', 'rz-cx-issues-ui.js', 'sim-telemetry.js', 'rz-ask.js',
  'rz-basis-drawer.js', 'rz-engine-versions.js', 'rz-manual-links.js', 'rz-sw-register.js', 'rz-asof.js'];
const SURFACES = ['.rz-proj-chip', '.rz-proj-pop:not([hidden])', '.rz-scn-share-row', '#carrierBanner.visible', '.rz-embed-slot', '[data-rz-ask-slot]', '#cxIsPanel', '#cxRecPanel', '#rzReplayTrig'];
const WIDTHS = [360, 390, 768, 1280, 1440];
const SKIP_DIRS = new Set(['node_modules', 'tools', 'documentation', 'standarization', '.git', 'dcmoc', 'data', 'js', 'css', 'assets', 'images']);
function pages(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(n) && !n.startsWith('.')) pages(p, out); continue; }
    if (!n.endsWith('.html')) continue;
    const s = readFileSync(p, 'utf8');
    if (MODULES.some((m) => s.includes('/' + m + '?') || s.includes('/' + m + '"') || s.includes('"' + m + '?') || s.includes('"' + m + '"'))) out.push(relative(ROOT, p));
  }
  return out;
}
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const LIST = pages(ROOT).sort().filter((p) => !only || p.includes(only));
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.glb': 'model/gltf-binary', '.csv': 'text/csv' };
const server = createServer(async (req, res) => {
  try { const u = new URL(req.url, 'http://x'), path = decodeURIComponent(u.pathname); const file = join(ROOT, path.endsWith('/') ? path + 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(await readFile(file)); } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-audio-output'], protocolTimeout: 120000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (const pg of LIST) for (const theme of ['dark', 'light']) {
    const ctx = await browser.createBrowserContext();
    const tab = await ctx.newPage();
    tab.on('dialog', (d) => d.dismiss().catch(() => {}));
    await tab.setViewport({ width: WIDTHS[0], height: 800, isMobile: true, hasTouch: true });
    await tab.evaluateOnNewDocument((t) => { try { localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', t); } catch (e) {} }, theme);
    try { await tab.goto(base + pg, { waitUntil: 'load', timeout: 90000 }); } catch (e) { ok(false, `R ${pg} ${theme}: load ${String(e.message).slice(0, 80)}`); await ctx.close(); continue; }
    for (const w of WIDTHS) {
      await tab.setViewport({ width: w, height: 800, isMobile: w < 768, hasTouch: w < 768 });
      await sleep(450);
      const m = await tab.evaluate((S) => {
        const cw = document.documentElement.clientWidth, bad = [];
        const he = getComputedStyle(document.documentElement).overflowX, be = getComputedStyle(document.body).overflowX;
        const locked = /hidden|clip/.test(he) || (he === 'visible' && /hidden|clip/.test(be));   // the viewport takes body's overflow when html's is visible
        const sw = document.documentElement.scrollWidth;
        const sx = locked ? 0 : Math.max(0, sw - cw);
        for (const s of S) document.querySelectorAll(s).forEach((e) => {
          const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') return;
          if (r.left < -1 || r.right > cw + 1) bad.push(s + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + ']');
        });
        return { cw, sx, sw, locked, bad };
      }, SURFACES);
      ok(m.sx === 0, `R1 ${pg} ${theme} ${w}: page scrolls sideways by ${m.sx}px`);
      ok(!m.bad.length, `R2 ${pg} ${theme} ${w}: outside the viewport: ${m.bad.slice(0, 3).join(' ')}`);
    }
    await ctx.close().catch(() => {});
  }
} finally { await browser.close(); server.close(); }
if (fails.length) { console.error(`FAIL test-responsive-sweep-p — ${fails.length} of ${checks} checks failed (${LIST.length} pages):\n  ✗ ` + fails.join('\n  ✗ ')); process.exit(1); }
console.log(`PASS test-responsive-sweep-p — ${LIST.length} pages × 2 themes × ${WIDTHS.length} widths: no sideways scroll, every P surface inside the viewport (${checks} checks)`);
