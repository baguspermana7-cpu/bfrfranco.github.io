#!/usr/bin/env node
// PRD-PX-DEFECTS X2 — the TIA-942 checklist theme toggle (acceptance criteria 1 and 2, gated since 0b found no check).
// T1 light page: clicking the theme button sets data-theme="dark" and localStorage.theme="dark", with no error logged
// T2 localStorage.theme="dark": <html data-theme="dark"> is already set when <body> is inserted (before first paint)
// T3 a second click returns to light and stores it
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => { try { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; } res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }).end(await readFile(f)); } catch { res.writeHead(404).end(); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const errs = [];
async function open(theme) {
  const ctx = await browser.createBrowserContext(); const tab = await ctx.newPage();
  tab.on('pageerror', (e) => errs.push(String(e.message || e)));
  tab.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  await tab.evaluateOnNewDocument((t) => {
    try { localStorage.setItem('rz_cookie_consent', 'declined'); if (t) localStorage.setItem('theme', t); } catch (e) {}
    new MutationObserver((ms, o) => { if (document.body) { window.__themeAtBody = document.documentElement.getAttribute('data-theme'); o.disconnect(); } })
      .observe(document, { childList: true, subtree: true });
  }, theme);
  await tab.goto(base + 'tia-942-checklist.html', { waitUntil: 'load', timeout: 60000 });
  return { ctx, tab };
}
try {
  let { ctx, tab } = await open('light');
  await tab.click('#navThemeBtn'); await new Promise((r) => setTimeout(r, 200));
  let s = await tab.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), ls: localStorage.getItem('theme') }));
  ok(s.attr === 'dark' && s.ls === 'dark', 'T1 click from light: ' + JSON.stringify(s));
  await tab.click('#navThemeBtn'); await new Promise((r) => setTimeout(r, 200));
  s = await tab.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), ls: localStorage.getItem('theme') }));
  ok(s.attr === 'light' && s.ls === 'light', 'T3 second click back to light: ' + JSON.stringify(s));
  await ctx.close();
  ({ ctx, tab } = await open('dark'));
  const atBody = await tab.evaluate(() => window.__themeAtBody);
  ok(atBody === 'dark', 'T2 data-theme when <body> was inserted: ' + atBody);
  await ctx.close();
} finally { await browser.close(); server.close(); }
ok(errs.length === 0, 'T1 errors logged: ' + errs.slice(0, 3).join(' | '));
if (fails.length) { console.error(`FAIL test-tia-theme — ${fails.length} of ${checks}:\n  ✗ ` + fails.join('\n  ✗ ')); process.exit(1); }
console.log(`PASS test-tia-theme — ${checks} checks: toggle stores and applies, dark set before first paint`);
