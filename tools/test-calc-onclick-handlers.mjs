#!/usr/bin/env node
// Every inline onclick on a calculator page must call a function that exists after load.
// A button whose handler is undefined looks clickable, does nothing, and throws a ReferenceError
// (X3: tia-942-checklist's theme button called toggleCalcTheme(), defined on 7 other pages, not on this one).
// Checks simple handlers of the form `name(...)` or `a && a.b(...)`-style guards are skipped (not resolvable statically).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['capex-calculator.html', 'opex-calculator.html', 'tco-calculator.html', 'roi-calculator.html',
  'pue-calculator.html', 'carbon-footprint.html', 'cx-calculator.html', 'spares-readiness-calculator.html',
  'tier-advisor.html', 'tia-942-checklist.html', 'rfs-readiness-workbench.html'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };

const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fails = [];
let checked = 0;
try {
  for (const page of PAGES) {
    const tab = await browser.newPage();
    await tab.setRequestInterception(true);
    // Same-origin plus the two script CDNs the pages really use; everything else (analytics, fonts, ipapi) is cut.
    const ALLOW = [base, 'https://cdn.jsdelivr.net/', 'https://cdnjs.cloudflare.com/'];
    tab.on('request', (r) => (ALLOW.some((a) => r.url().startsWith(a)) ? r.continue() : r.abort()));
    const errs = [];
    tab.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 120)));
    await tab.goto(base + page, { waitUntil: 'load', timeout: 60000 });
    await new Promise((ok) => setTimeout(ok, 800));
    const res = await tab.evaluate(() => {
      const out = [];
      document.querySelectorAll('[onclick]').forEach((el) => {
        const code = el.getAttribute('onclick') || '';
        const m = code.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);
        if (!m) return;
        if (['if', 'return', 'void', 'event', 'this'].includes(m[1])) return;
        out.push({ name: m[1], ok: typeof window[m[1]] === 'function', id: el.id || el.className || el.tagName });
      });
      return out;
    });
    if (errs.length) console.log(`  note ${page}: ${errs.length} pageerror(s), first: ${errs[0]}`);
    for (const r of res) {
      checked++;
      if (!r.ok) fails.push(`${page}: onclick calls ${r.name}() — not defined (element ${String(r.id).slice(0, 40)})`);
    }
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (fails.length) {
  console.log(`FAIL test-calc-onclick-handlers — ${fails.length} dead handler(s) of ${checked} checked\n  ` + [...new Set(fails)].join('\n  '));
  process.exit(1);
}
console.log(`PASS test-calc-onclick-handlers — ${checked} inline handlers on ${PAGES.length} calculators all resolve`);
