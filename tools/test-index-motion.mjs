#!/usr/bin/env node
/* R121 motion laws (Lenis 1.3.27 + GSAP 3.15.0 ScrollTrigger + SplitText).
 *
 *   node tools/test-index-motion.mjs [page]     # default index-motion-mock.html; exit 1 on any failed law
 *
 * Serves the repo on a free 127.0.0.1 port (never a fixed one). Laws:
 *  T1 desktop (fine pointer + hover): Lenis runs, GSAP tweens exist, 0 page errors.
 *  T2 390 px touch phone: no Lenis instance; GSAP may still reveal.
 *  T3 prefers-reduced-motion: no Lenis, 0 tweens, hero name and every section item fully visible at load.
 *  T4 JavaScript off: hero name and every section item fully visible (nothing pre-hidden in the markup).
 *  T5 after scrolling the page, every revealed item ends fully visible with no leftover offset.
 *  T6 no pinning (no .pin-spacer, no position:fixed added by motion).
 *  T7 layout shift during load + scroll stays within 0.01 of the same page without motion (index.html).
 *  T8 nothing the reader already sees is hidden later (sampled every frame for 3 s from navigation, items in the first view).
 *  T8b T8 under load: paint entries hidden, CDN scripts held 800 ms (the paint entry lags the frame on a busy machine).
 * Headless Chrome reports hover:none; the desktop run sets blink pointer/hover types so (hover: hover) is true.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from '/home/baguspermana7/rz-work/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = process.argv[2] || 'index-motion-mock.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

let fail = 0;
const law = (id, ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ITEMS = '.bento-name, #metrics .res-row, #case-studies .case-card, #operational-excellence .oe-card, #contact .contact-info, #faq .faq-item, #faq .faq-item-simple';

const hidden = (p) => p.evaluate((sel) => [...document.querySelectorAll(sel)]
  .filter((e) => { const c = getComputedStyle(e); return +c.opacity < 0.99 || c.visibility === 'hidden'; }).map((e) => e.className.toString().slice(0, 30)), ITEMS);
const scrollAll = async (p) => { const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= h; y += 500) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await sleep(120); } await sleep(400);
  /* wait for every GSAP tween to finish (scrubbed tweens excluded: they follow the scroll) */
  await p.waitForFunction(() => !window.gsap || !window.gsap.globalTimeline.getChildren(true, true, false)
    .some((t) => t.isActive() && !(t.scrollTrigger && t.scrollTrigger.vars.scrub)), { timeout: 15000 }).catch(() => {});
  await sleep(200); };
const clsOf = async (p) => p.evaluate(() => window.__cls || 0);
const CLS_HOOK = () => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); };

/* T8 sampler: records an item that was fully visible (or whose hero host was) and later drops below 0.5 opacity */
const FLASH = (sel) => { window.__flash = []; const seen = new WeakSet(); const t0 = performance.now();
    const tick = () => { for (const e of document.querySelectorAll(sel)) { const r = e.getBoundingClientRect(); if (r.top >= innerHeight || r.bottom <= 0) continue;
      const o = +getComputedStyle(e).opacity; const host = e.classList.contains('rzm-word') ? e.closest('h1, h2') : e;
      if (o >= 0.99) seen.add(e); else if (o < 0.5 && (seen.has(e) || (host && seen.has(host)))) window.__flash.push([Math.round(performance.now() - t0), e.className.toString().slice(0, 24)]); }
      if (performance.now() - t0 < 3000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); };

const desktop = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox',
  '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4'] });
const plain = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  /* T1 + T5 + T6 + T7 */
  const p = await desktop.newPage(); await p.setViewport({ width: 1440, height: 900 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.evaluateOnNewDocument(CLS_HOOK);
  await p.goto(BASE + PAGE, { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(1500);
  const m = await p.evaluate(() => ({ hover: matchMedia('(hover: hover)').matches, fine: matchMedia('(pointer: fine)').matches,
    st: window.RZMotion ? { lenis: window.RZMotion.lenis, tweens: window.RZMotion.tweens } : null, lenisClass: document.documentElement.classList.contains('lenis') }));
  law('T1', m.hover && m.fine && m.st && m.st.lenis === true && m.lenisClass && m.st.tweens > 0 && errs.length === 0,
    `desktop: Lenis ${m.st ? m.st.lenis : 'no RZMotion'} (html.lenis ${m.lenisClass}), tweens ${m.st ? m.st.tweens : 0}, page errors ${errs.length}${errs[0] ? ' — ' + errs[0] : ''}`);
  await scrollAll(p);
  const left = await hidden(p);
  /* GSAP writes inline transforms; a settled reveal leaves translate(0px, 0px) or nothing (CSS transforms the page already had are not the motion's) */
  const offs = await p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => {
    const t = e.style.transform; if (!t || t === 'none') return false;
    const nums = (t.match(/-?\d*\.?\d+(?:e-?\d+)?(?=px|%)/g) || []).map(Number);
    return nums.some((v) => Math.abs(v) >= 0.5) || /rotate|scale/.test(t); }).length, ITEMS);
  law('T5', left.length === 0 && offs === 0, `after a full scroll every item is visible and settled — hidden ${left.length}${left.length ? ' (' + left.slice(0, 3).join(', ') + ')' : ''}, offset ${offs}`);
  const pin = await p.evaluate(() => document.querySelectorAll('.pin-spacer').length);
  law('T6', pin === 0, `nothing pinned (.pin-spacer ${pin})`);
  const clsMotion = await clsOf(p);
  const q = await desktop.newPage(); await q.setViewport({ width: 1440, height: 900 }); await q.evaluateOnNewDocument(CLS_HOOK);
  await q.goto(BASE + 'index.html', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(1500); await scrollAll(q);
  const clsBase = await clsOf(q);
  law('T7', clsMotion <= clsBase + 0.01, `layout shift ${clsMotion.toFixed(4)} vs index.html ${clsBase.toFixed(4)} (≤ +0.01)`);

  /* T8 flash: an item visible in the first view must never drop back below opacity 0.5 */
  const f = await desktop.newPage(); await f.setViewport({ width: 1440, height: 900 });
  await f.evaluateOnNewDocument(FLASH, ITEMS + ', .rzm-word, .sec-head, .emp-card');
  await f.goto(BASE + PAGE, { waitUntil: 'load', timeout: 90000 }); await sleep(3200);
  const fl = await f.evaluate(() => window.__flash);
  law('T8', fl.length === 0, `no visible item is hidden again after first paint — ${fl.length} drop(s)${fl.length ? ' e.g. ' + JSON.stringify(fl[0]) : ''}`);
  /* T8b the same under load: Chrome records the paint entry on presentation feedback, which lags the frame under load
   * (peer's v3.51 gate: 21 drops on a busy machine). Hide paint entries and hold the CDN scripts 800 ms. */
  const g = await desktop.newPage(); await g.setViewport({ width: 1440, height: 900 });
  await g.evaluateOnNewDocument(() => { const get = performance.getEntriesByType.bind(performance); performance.getEntriesByType = (t) => (t === 'paint' ? [] : get(t)); });
  await g.evaluateOnNewDocument(FLASH, ITEMS + ', .rzm-word, .sec-head, .emp-card');
  await g.setRequestInterception(true); g.on('request', (rq) => { if (/cdn\.jsdelivr\.net/.test(rq.url())) setTimeout(() => rq.continue(), 800); else rq.continue(); });
  await g.goto(BASE + PAGE, { waitUntil: 'load', timeout: 90000 }); await sleep(3200);
  const fl2 = await g.evaluate(() => window.__flash);
  law('T8b', fl2.length === 0, `same under load (paint entry late, CDN +800 ms) — ${fl2.length} drop(s)${fl2.length ? ' e.g. ' + JSON.stringify(fl2[0]) : ''}`);

  /* T2 phone */
  const ph = await plain.newPage();
  await ph.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ph.goto(BASE + PAGE, { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(1200);
  const pm = await ph.evaluate(() => ({ st: window.RZMotion ? { lenis: window.RZMotion.lenis, tweens: window.RZMotion.tweens } : null, lenisClass: document.documentElement.classList.contains('lenis'),
    sx: document.documentElement.scrollWidth - innerWidth }));
  law('T2', pm.st && pm.st.lenis === false && !pm.lenisClass && pm.sx <= 0, `390 touch: Lenis ${pm.st ? pm.st.lenis : 'no RZMotion'}, html.lenis ${pm.lenisClass}, sideways ${pm.sx}px`);

  /* T3 reduced motion */
  const r = await desktop.newPage(); await r.setViewport({ width: 1440, height: 900 });
  await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await r.goto(BASE + PAGE, { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(800);
  const rs = await r.evaluate(() => window.RZMotion ? { lenis: window.RZMotion.lenis, tweens: window.RZMotion.tweens } : null);
  const rh = await hidden(r);
  law('T3', rs && rs.lenis === false && rs.tweens === 0 && rh.length === 0, `reduced motion: Lenis ${rs ? rs.lenis : '-'}, tweens ${rs ? rs.tweens : '-'}, hidden at load ${rh.length}`);

  /* T4 no JS */
  const n = await plain.newPage(); await n.setViewport({ width: 1440, height: 900 }); await n.setJavaScriptEnabled(false);
  await n.goto(BASE + PAGE, { waitUntil: 'load', timeout: 90000 });
  const nh = await hidden(n);
  law('T4', nh.length === 0, `JavaScript off: hidden items ${nh.length}${nh.length ? ' (' + nh.slice(0, 3).join(', ') + ')' : ''}`);
} finally {
  await desktop.close(); await plain.close(); server.close();
}
console.log(`test-index-motion (${PAGE}): ${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
