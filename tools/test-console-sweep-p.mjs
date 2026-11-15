#!/usr/bin/env node
/**
 * test-console-sweep-p.mjs — W6-3: every page that loads a P-series module opens with 0 uncaught page errors.
 * The page list is DERIVED, not typed: every root/subfolder .html that has a <script src> for one of the P-series
 * modules below (so a page that adopts a module later joins the sweep by itself).
 *  W1 the derived list is not empty and contains the known adopters (capex, roi, spares, cx, datahallAI, compare, article-19)
 *  W2 each page: load, wait for the DOM to settle, scroll to the bottom and back (lazy work runs), 0 pageerror
 * Run: node tools/test-console-sweep-p.mjs [--only=<substring>]
 */
import { join, dirname, resolve, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, readFileSync, statSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES = ['rz-project.js', 'rz-scenario.js', 'rz-compare.js', 'rz-pack.js', 'rz-embed.js', 'rz-embed-article.js', 'rz-embed-compute.js',
  'rz-handoff.js', 'rz-handoff-cx.js', 'calc-parameters.js', 'rz-cx-records-ui.js', 'rz-cx-issues-ui.js', 'sim-telemetry.js', 'rz-ask.js',
  'rz-basis-drawer.js', 'rz-command-palette.js', 'rz-engine-versions.js', 'rz-manual-links.js', 'rz-sw-register.js', 'rz-asof.js'];  // file names checked in js/ (2026-11-14)
const SKIP_DIRS = new Set(['node_modules', 'tools', 'documentation', 'standarization', '.git', 'dcmoc', 'data', 'js', 'css', 'assets', 'images']);
function pages(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(n) && !n.startsWith('.')) pages(p, out); continue; }
    if (!n.endsWith('.html')) continue;
    const src = readFileSync(p, 'utf8');
    if (MODULES.some((m) => new RegExp('<script[^>]+src="[^"]*/' + m.replace('.', '\\.') + '(\\?[^"]*)?"').test(src) || new RegExp('<script[^>]+src="' + m.replace('.', '\\.') + '(\\?[^"]*)?"').test(src))) out.push(relative(ROOT, p));
  }
  return out;
}
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const LIST = pages(ROOT).sort().filter((p) => !only || p.includes(only));
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
if (!only) {
  ok(LIST.length > 10, 'W1 derived list too short: ' + LIST.length);
  for (const want of ['capex-calculator.html', 'roi-calculator.html', 'spares-readiness-calculator.html', 'cx-calculator.html', 'datahallAI.html', 'compare.html', 'article-19.html'])
    ok(LIST.includes(want), 'W1 known adopter missing from the derived list: ' + want);
}
const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.glb': 'model/gltf-binary', '.csv': 'text/csv' };
const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x'), path = decodeURIComponent(u.pathname);
    const file = join(ROOT, path.endsWith('/') ? path + 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-audio-output'], protocolTimeout: 120000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (const pg of LIST) {
    const ctx = await browser.createBrowserContext();
    const tab = await ctx.newPage();
    await tab.setViewport({ width: 1280, height: 900 });
    const errs = [];
    tab.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 160)));
    tab.on('dialog', (d) => d.dismiss().catch(() => {}));
    await tab.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {} });
    try {
      await tab.goto(base + pg, { waitUntil: 'load', timeout: 90000 });
      let prev = -1; for (let i = 0; i < 16; i++) { const n = await tab.evaluate(() => document.getElementsByTagName('*').length); if (n === prev) break; prev = n; await sleep(250); }
      await tab.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 900) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
      await sleep(800);
    } catch (e) { errs.push('load: ' + String(e.message || e).slice(0, 120)); }
    ok(errs.length === 0, `W2 ${pg}: ${errs.length} page error(s): ${errs.slice(0, 3).join(' | ')}`);
    await ctx.close().catch(() => {});
  }
} finally { await browser.close(); server.close(); }
if (fails.length) { console.error(`FAIL test-console-sweep-p — ${fails.length} of ${checks} checks failed (${LIST.length} pages):\n  ✗ ` + fails.join('\n  ✗ ')); process.exit(1); }
console.log(`PASS test-console-sweep-p — ${LIST.length} pages that load a P-series module open with 0 page errors (${checks} checks)`);
