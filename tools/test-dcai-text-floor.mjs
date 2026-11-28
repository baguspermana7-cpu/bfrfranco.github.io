#!/usr/bin/env node
// DC AI text floor: no visible HTML text on any tab renders under 8.5 px (the page's own legibility
// floor, DATAHALL_AI_STANDARD "Measuring legibility"). SVG labels have their own gates (effective px);
// this one covers the HTML around them, which had 8 px KPI units, metric labels and chevrons.
//   TF1  every tab, 1440 and 390: 0 visible HTML text elements with computed font-size < 8.5 px
//   TF2  every tab, 390: the document does not scroll sideways
//   TF3  the scan saw text on every tab (a scan of nothing proves nothing); 0 page errors
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { isSupabaseModule, signedInStorage, signedInSupabaseBody } from './lib/signed-in-supabase.mjs';
import { enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = (process.argv.find((a) => a.startsWith('--shots=')) || '').split('=')[1];
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const fails = []; let checks = 0;
const ok = (id, c, m) => { checks++; if (!c) fails.push(id + ' ' + m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(width) {
  const pg = await browser.newPage();
  pg.errors = []; pg.on('pageerror', (e) => pg.errors.push(e.message));
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: signedInSupabaseBody({ email: 'educator@resistancezero.com', tier: 'pro', educator: true }) });
    return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort();
  });
  const phone = width < 500;
  await pg.setViewport({ width, height: phone ? 844 : 900, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await pg.evaluateOnNewDocument((entries) => {
    try {
      if (sessionStorage.getItem('__dcaiFlagSeeded')) return;
      sessionStorage.setItem('__dcaiFlagSeeded', '1');
      localStorage.clear();
      localStorage.setItem('theme', 'dark'); localStorage.setItem('rz_cookie_consent', 'declined');
      entries.forEach(([k, v]) => localStorage.setItem(k, v));
    } catch (x) { /* no storage */ }
  }, signedInStorage({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator' }));
  await pg.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 90000 });
  await pg.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
  await wait(800);
  await enterAuthorizedAuditState(pg, 'dc-ai');
  await pg.evaluate(() => { const b = document.querySelector('#tabs [data-t="hall"]'); if (b) b.click(); });
  await wait(2500);
  return pg;
}
const lensTo = async (pg, l) => { await pg.evaluate((l) => { const b = document.querySelector('#p-hall [data-lens="' + l + '"]'); if (b) b.click(); }, l); await wait(900); };
const FLOOR = 8.5;
const TABS = ['dash', 'hall', 'over', 'rack', 'cool', 'elec', 'net', 'fire', 'alarms', 'bms'];
for (const width of [1440, 390]) {
  const pg = await open(width);
  for (const t of TABS) {
    await pg.evaluate((t) => { const b = document.querySelector('#tabs [data-t="' + t + '"]'); if (b) b.click(); }, t);
    await wait(1800);
    const r = await pg.evaluate((floor) => {
      const vis = (e) => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2; };
      const small = {}; let seen = 0;
      for (const e of document.body.querySelectorAll('*')) {
        if (e.closest('svg') || !vis(e)) continue;
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        seen++;
        const px = parseFloat(getComputedStyle(e).fontSize);
        if (px < floor) { const k = (e.tagName.toLowerCase() + '.' + String(e.className || '').trim().split(/\s+/).join('.')) + ' ' + px + 'px'; small[k] = (small[k] || 0) + 1; }
      }
      return { seen, small, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }, FLOOR);
    const list = Object.entries(r.small).map(([k, n]) => k + ' ×' + n);
    ok('TF1', list.length === 0, `${width} ${t}: text under ${FLOOR} px: ${list.join(' | ')}`);
    if (width === 390) ok('TF2', r.scroll <= 1, `390 ${t}: document scrolls sideways by ${r.scroll} px`);
    if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${width}-${t}.png` });
    ok('TF3', r.seen > 20, `${width} ${t}: only ${r.seen} text elements seen`);
  }
  ok('TF3', pg.errors.length === 0, `${width}: page errors: ${pg.errors.slice(0, 2).join(' / ')}`);
  await pg.close();
}
await browser.close(); srv.close();
if (fails.length) { console.log(`DC AI TEXT FLOOR: FAIL (${fails.length} of ${checks})`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log(`DC AI text floor: OK (${checks} checks, 10 tabs x 2 widths, floor ${FLOOR} px)`);
