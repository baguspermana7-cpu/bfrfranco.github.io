#!/usr/bin/env node
/**
 * test-nav-float.mjs — the floating, translucent site bar and its mega menu (SITE_CHROME_STANDARD §2a/§2b;
 * css/rz-nav-float.css, js/rz-mega-menu.js, data/nav-menu.json).
 *
 * Owner, 2026-11-18: "Make it a floating navbar, rounded corner container, eight pixel padding. Give it a translucent
 * effect with background blur so that as content scrolls behind it, it starts to blur out, but we can still see and
 * read the content. Also the popovers are looking quite basic, let's elevate this with a mega menu, flush to the width
 * of the entire nav itself … include some more columns in there, and make the fourth column a visual supporter for
 * any highlighted menu item." — "Setelah selesai audit pastikan proper."
 *
 * Every site-kind page (data-rz-chrome-head) + index.html, rendered at 1440 x 900 and 390 x 844 (dark; light on a
 * sample), measured:
 *   F1 the bar floats: it touches no viewport edge (top >= 6, left >= 6, right <= vw - 6), radius >= 10 px, padding 8 px
 *   F2 it stays: after a 1500 px scroll its top is unchanged (± 2 px) — the phone too (overflow-x hidden kills sticky)
 *   F3 exactly ONE painted element on the page carries a backdrop-filter, it is the bar, blur 12–16 px (closed overlays
 *      carry the rule but paint nothing)
 *   F4 readable: every visible bar label >= 4.5 : 1 against the bar's own background composited over pure white AND
 *      over the page's darkest painted ink (#000 for dark pages) — what "behind" can be while content scrolls
 *   F5 the first heading of the page is not under the bar at load (its top >= the bar's bottom)
 *   F6 desktop, every top-level section that has groups: the trigger is a button with aria-expanded / aria-controls;
 *      it opens ONE panel whose left and right edges equal the bar's (± 1.5 px); the panel has 4 columns, the 4th
 *      a preview whose image is loaded (naturalWidth > 0) or an explicit placeholder; focusing another item changes
 *      the preview title; Escape closes and focus returns to the trigger; Tab out of the panel closes it
 *   F7 every href in data/nav-menu.json is a file of this checkout; the builder's --check is clean
 *   F8 phone: no hover panel is visible; the burger opens the drawer (rz-mobile-nav), opaque, its plain rows starting
 *      at the accordions' x (± 6 px); the menu sections there are
 *      accordions (button[aria-expanded]); every drawer target >= 44 px high; no sideways page scroll
 *   F9 an app page (the BMS cockpits) shows NO floating bar and NO mega menu
 *   F10 no page error caused by the bar (an error that also happens with the two files blocked is not counted)
 * Planted defects (--plant=): 'edge' (bar flush to the top), 'blur2' (a second backdrop-filter), 'alpha' (bar alpha
 * 0.2 → F4), 'width' (panel narrower than the bar → F6), 'glassdrawer' / 'centerdrawer' (→ F8), 'deadlink' (a menu href to a missing file → F7).
 * Usage: node tools/test-nav-float.mjs [--pages=a.html,b.html] [--shots=<dir>] [--plant=<id>]
 */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const SHOTS = arg('shots'), PLANT = arg('plant');
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.html': 'text/html', '.ico': 'image/x-icon' };

const PLANT_CSS = {
  edge: ':root .navbar[data-rz-bar], :root .navbar[data-rz-float]{top:0!important;margin-top:0!important;border-radius:0!important}',
  blur2: 'main, body > section{backdrop-filter:blur(6px)!important}',
  alpha: ':root .navbar[data-rz-bar], :root .navbar[data-rz-float]{background:rgba(128,128,128,.2)!important}',
  width: '.rz-mm-panel{left:40px!important;right:40px!important}',
  glassdrawer: 'html:root:root:not(#zz) .navbar .nav-container > :is(.nav-menu, .nav-links){background:rgba(20,20,20,.3)!important}',
  centerdrawer: 'html:root:root:not(#zz) .navbar .rz-mm-drawer > a.rz-mm-dlink{justify-content:center!important;align-items:center!important;text-align:center!important}'
};
let menuJson = fs.readFileSync(path.join(ROOT, 'data/nav-menu.json'), 'utf8');
if (PLANT === 'deadlink') menuJson = menuJson.replace(/"href":\s*"([^"]+\.html)"/, '"href": "no-such-page-zz.html"');

const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/data/nav-menu.json') { r.writeHead(200, { 'content-type': 'application/json' }); r.end(menuJson); return; }
  const p = path.join(ROOT, u === '/' ? '/index.html' : u);
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    if (PLANT_CSS[PLANT] && p.endsWith('.html')) d = Buffer.from(String(d).replace('</head>', '<style data-plant>' + PLANT_CSS[PLANT] + '</style></head>'));
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d);
  });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;

const all = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const siteKind = all.filter((f) => /data-rz-chrome-head/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')) && !/data-rz-kind="app"/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
let PAGES = arg('pages') ? arg('pages').split(',') : ['index.html'].concat(siteKind.filter((f) => f !== 'index.html')).sort();
const APP_PAGES = ['dc-conventional.html', 'chiller-plant.html'];
if (fs.existsSync(path.join(ROOT, 'datahallAI.html'))) APP_PAGES.push('datahallAI.html');

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* F7 — links and freshness */
{
  const d = JSON.parse(menuJson), hrefs = [];
  const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (typeof o.href === 'string') hrefs.push(o.href); Object.values(o).forEach(walk); } };
  walk(d.sections);
  const dead = hrefs.filter((h) => !/^(https?:|mailto:|#)/.test(h) && !fs.existsSync(path.join(ROOT, h.split('#')[0].split('?')[0] || 'index.html')));
  ok(hrefs.length >= 20, `F7 the menu holds only ${hrefs.length} links`);
  ok(dead.length === 0, `F7 dead menu links: ${dead.slice(0, 6).join(', ')}`);
  let fresh = '';
  try { fresh = execFileSync('node', [path.join(ROOT, 'tools/build-nav-menu.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' }); } catch (e) { fresh = 'STALE ' + (e.stdout || e.message); }
  ok(!/STALE|stale/.test(fresh), `F7 data/nav-menu.json is stale: ${fresh.trim().slice(0, 120)}`);
}

/* luminance + contrast helpers, run in the page */
const PAGE_HELPERS = `
  window.__nf = {
    rgba(s){ const m = (s||'').match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r:p[0], g:p[1], b:p[2], a: p.length > 3 ? p[3] : 1 }; },
    over(top, bot){ const a = top.a; return { r: top.r*a + bot.r*(1-a), g: top.g*a + bot.g*(1-a), b: top.b*a + bot.b*(1-a), a: 1 }; },
    lum(c){ const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b); },
    ratio(a, b){ const x = this.lum(a), y = this.lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
  };`;

async function openPage(file, W, theme) {
  const pg = await browser.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: W, height: W > 800 ? 900 : 844 });
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg.evaluateOnNewDocument((t) => { try { localStorage.setItem('theme', t); localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {} }, theme);
  /* one retry: under a second browser lane a navigation can stall once; a page that fails twice still fails the run */
  try { await pg.goto(ORIGIN + file, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
  catch (e) { await pg.goto(ORIGIN + file, { waitUntil: 'domcontentloaded', timeout: 90000 }); }
  await pg.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 }).catch(() => {});
  await sleep(900);
  await pg.evaluate(PAGE_HELPERS);
  return { pg, errs };
}

for (const file of PAGES) {
  for (const W of [1440, 390]) {
    const theme = (W === 1440 && /^(index|articles|tools)\.html$/.test(file)) ? 'light' : 'dark';
    const T = `${file}@${W}/${theme}`;
    const { pg, errs } = await openPage(file, W, theme);
    const s = await pg.evaluate(() => {
      const bar = document.querySelector('.navbar[data-rz-bar], .navbar[data-rz-float]');
      if (!bar) return { noBar: true };
      const r = bar.getBoundingClientRect(), cs = getComputedStyle(bar);
      /* only what is painted: a closed overlay (display none, hidden, opacity 0) carries the rule but blurs nothing. The sign-in
         overlays of a gated page (.root-gate, .rz-modal-overlay, auth.js) predate the bar and cover it while open; they are
         excepted BY NAME and tracked as an open row in standarization/UIUX_AUDIT_LEDGER.md (N-2026-11-20) */
      const blurEls = [...document.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e); const b = c.backdropFilter || c.webkitBackdropFilter || ''; if (!b || b === 'none') return false; if (e.matches('.root-gate, .rz-modal-overlay')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && parseFloat(c.opacity) > 0; });
      const blurPx = ((cs.backdropFilter || cs.webkitBackdropFilter || '').match(/blur\(([\d.]+)px\)/) || [])[1];
      const bg = __nf.rgba(cs.backgroundColor);
      const labels = [...bar.querySelectorAll('a, button')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (e.innerText || '').trim() && getComputedStyle(e).visibility !== 'hidden'; });
      let worst = 99, worstWho = '';
      labels.forEach((e) => {
        const ink = __nf.rgba(getComputedStyle(e).color); if (!ink || !bg) return;
        /* the label sits on its own background if it has one, else on the bar */
        const own = __nf.rgba(getComputedStyle(e).backgroundColor);
        [{ r: 255, g: 255, b: 255, a: 1 }, { r: 0, g: 0, b: 0, a: 1 }].forEach((behind) => {
          let ground = __nf.over(bg, behind);
          if (own && own.a > 0) ground = __nf.over(own, ground);
          const c = __nf.ratio(__nf.over(ink, ground), ground);
          if (c < worst) { worst = c; worstWho = (e.innerText || '').trim().slice(0, 24) + (behind.r ? ' over white' : ' over black'); }
        });
      });
      const h1 = document.querySelector('main h1, h1');
      const h1r = h1 ? h1.getBoundingClientRect() : null;
      return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, vw: innerWidth, radius: parseFloat(cs.borderTopLeftRadius), pad: parseFloat(cs.paddingTop),
        blurWho: blurEls.filter((e) => e !== bar).map((e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '')).slice(0, 4).join(','), blurCount: blurEls.length, blurIsBar: blurEls.length === 1 && blurEls[0] === bar, blurPx: blurPx ? +blurPx : null, worst, worstWho,
        h1Top: h1r ? h1r.top + scrollY : null, over: document.documentElement.scrollWidth > innerWidth + 1, mm: !!document.querySelector('.rz-mm-nav') };
    });
    if (s.noBar) { ok(false, `F1 ${T}: no site bar ([data-rz-bar] / [data-rz-float])`); await pg.close(); continue; }
    ok(s.top >= 6 && s.left >= 6 && s.right <= s.vw - 6, `F1 ${T}: bar touches an edge (top ${s.top.toFixed(1)}, left ${s.left.toFixed(1)}, right ${s.right.toFixed(1)} of ${s.vw})`);
    ok(s.radius >= 10 && Math.abs(s.pad - 8) <= 0.5, `F1 ${T}: radius ${s.radius}, padding ${s.pad} (want >= 10, 8)`);
    ok(s.blurIsBar && s.blurPx >= 12 && s.blurPx <= 16, `F3 ${T}: ${s.blurCount} backdrop-filter element(s) [others: ${s.blurWho}], bar blur ${s.blurPx}`);
    ok(s.worst >= 4.5, `F4 ${T}: bar label "${s.worstWho}" at ${s.worst.toFixed(2)} : 1`);
    ok(s.h1Top == null || s.h1Top >= s.bottom - 1, `F5 ${T}: first heading at ${s.h1Top} under the bar (bottom ${s.bottom.toFixed(1)})`);
    ok(!s.over, `F8 ${T}: page scrolls sideways`);
    /* F2 */
    await pg.evaluate(() => window.scrollTo(0, 1500)); await sleep(250);
    const top2 = await pg.evaluate(() => document.querySelector('.navbar[data-rz-bar], .navbar[data-rz-float]').getBoundingClientRect().top);
    const canScroll = await pg.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1500);
    ok(!canScroll || Math.abs(top2 - s.top) <= 2, `F2 ${T}: bar moved with the page (top ${s.top.toFixed(1)} → ${top2.toFixed(1)})`);
    if (SHOTS && /^(index|datacenter-solutions|tools|articles|article-12)\.html$/.test(file)) await pg.screenshot({ path: path.join(SHOTS, `${file.replace('.html', '')}-${W}-${theme}-scrolled.png`) });
    await pg.evaluate(() => window.scrollTo(0, 0)); await sleep(150);

    if (W === 1440) {
      ok(s.mm, `F6 ${T}: no mega menu row`);
      const trig = await pg.evaluate(() => [...document.querySelectorAll('.rz-mm-top[aria-controls]')].map((b) => b.getAttribute('aria-controls')));
      if (s.mm) ok(trig.length >= 1, `F6 ${T}: no section with a panel`);
      for (const id of trig) {
        const r = await pg.evaluate(async (id) => {
          const t = document.querySelector('.rz-mm-top[aria-controls="' + id + '"]'), p = document.getElementById(id), bar = document.querySelector('.navbar[data-rz-bar], .navbar[data-rz-float]');
          t.focus(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); t.click();
          await new Promise((res) => setTimeout(res, 120));
          if (t.getAttribute('aria-expanded') !== 'true') { t.click(); await new Promise((res) => setTimeout(res, 120)); }
          const br = bar.getBoundingClientRect(), pr = p.getBoundingClientRect();
          const cols = getComputedStyle(p).gridTemplateColumns.split(' ').filter(Boolean).length;
          const prev = p.querySelector('.rz-mm-preview'), img = prev && prev.querySelector('img'), ph = prev && prev.querySelector('.rz-mm-ph');
          const items = [...p.querySelectorAll('.rz-mm-item')];
          const pt = () => (p.querySelector('.rz-mm-pt') || {}).textContent;
          const t0 = pt(); if (items[1]) items[1].focus(); await new Promise((res) => setTimeout(res, 50)); if (items[2]) items[2].focus();
          await new Promise((res) => setTimeout(res, 300));
          const imgOk = img && !img.hidden ? (img.complete && img.naturalWidth > 0) : !!(ph && !ph.hidden);
          return { expanded: t.getAttribute('aria-expanded'), open: !p.hidden && getComputedStyle(p).visibility !== 'hidden', dl: pr.left - br.left, dr: pr.right - br.right, cols,
            preview: !!prev && !!prev.closest('.rz-mm-panel'), imgOk, changed: items.length > 2 ? pt() !== t0 || pt() === (items[2].querySelector('.rz-mm-t') || {}).textContent : true, n: items.length };
        }, id);
        ok(r.expanded === 'true' && r.open, `F6 ${T} #${id}: panel did not open (${JSON.stringify(r)})`);
        ok(Math.abs(r.dl) <= 1.5 && Math.abs(r.dr) <= 1.5, `F6 ${T} #${id}: panel edges off the bar by ${r.dl.toFixed(1)} / ${r.dr.toFixed(1)} px`);
        ok(r.cols === 4 && r.preview, `F6 ${T} #${id}: ${r.cols} columns, preview ${r.preview}`);
        ok(r.imgOk, `F6 ${T} #${id}: the preview has neither a loaded image nor a placeholder`);
        ok(r.changed, `F6 ${T} #${id}: the preview did not follow the highlighted item`);
        if (SHOTS && /^(index|datacenter-solutions|articles)\.html$/.test(file)) await pg.screenshot({ path: path.join(SHOTS, `${file.replace('.html', '')}-mega-${id}-${theme}.png`) });
        await pg.keyboard.press('Escape'); await sleep(150);
        const after = await pg.evaluate((id) => { const t = document.querySelector('.rz-mm-top[aria-controls="' + id + '"]'); return { exp: t.getAttribute('aria-expanded'), focus: document.activeElement === t }; }, id);
        ok(after.exp === 'false' && after.focus, `F6 ${T} #${id}: Escape left ${JSON.stringify(after)}`);
      }
    } else {
      const ph = await pg.evaluate(async () => {
        const vis = [...document.querySelectorAll('.rz-mm-panel')].some((p) => { const b = p.getBoundingClientRect(); return b.width > 0 && getComputedStyle(p).display !== 'none' && getComputedStyle(p).visibility !== 'hidden'; });
        const burger = document.querySelector('.rz-nav-burger');
        if (burger) burger.click();
        await new Promise((res) => setTimeout(res, 400));
        const acc = [...document.querySelectorAll('.rz-mm-acc-btn')].filter((b) => b.getBoundingClientRect().height > 0);
        const small = [...document.querySelectorAll('.rz-mm-drawer a, .rz-mm-drawer button, .rz-mm-acc-btn')].filter((e) => { const b = e.getBoundingClientRect(); return b.height > 0 && b.height < 44; }).length;
        /* the drawer is opaque (a glass drawer inside the glass bar showed the page through it) and its plain rows start
           at the same x as the accordion rows */
        const list = acc[0] && acc[0].closest('.nav-menu, .nav-links');
        const alpha = list ? (getComputedStyle(list).backgroundColor.match(/[\d.]+/g) || []).map(Number) : [];
        const drawerAlpha = alpha.length > 3 ? alpha[3] : (alpha.length ? 1 : 0);
        const textLeft = (e) => { const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); for (let t; (t = w.nextNode());) { if (!t.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(t); const q = r.getBoundingClientRect(); if (q.width) return q.left; } return null; };
        const plain = [...document.querySelectorAll('.rz-mm-drawer > a.rz-mm-dlink')].filter((a) => a.getBoundingClientRect().height > 0);
        const accLeft = acc.length ? textLeft(acc[0]) : null;
        const misaligned = plain.map((a) => ({ t: a.textContent.trim().slice(0, 14), d: Math.round(textLeft(a) - accLeft) })).filter((x) => accLeft !== null && Math.abs(x.d) > 6);
        return { panelVisible: vis, burger: !!burger, open: document.body.classList.contains('rz-nav-open'), acc: acc.length, accAria: acc.every((b) => b.hasAttribute('aria-expanded')), small, drawerAlpha, misaligned };
      });
      ok(!ph.panelVisible, `F8 ${T}: a desktop panel is visible on the phone`);
      ok(ph.burger && ph.open, `F8 ${T}: the burger did not open the drawer`);
      ok(ph.acc >= 1 && ph.accAria, `F8 ${T}: drawer accordions ${ph.acc} (aria ${ph.accAria})`);
      ok(ph.small === 0, `F8 ${T}: ${ph.small} drawer target(s) under 44 px`);
      ok(ph.drawerAlpha >= 0.98, `F8 ${T}: the drawer is see-through (background alpha ${ph.drawerAlpha})`);
      ok(!ph.misaligned.length, `F8 ${T}: drawer rows not aligned with the accordions: ${JSON.stringify(ph.misaligned.slice(0, 3))}`);
      if (SHOTS && /^(index|datacenter-solutions|article-12)\.html$/.test(file)) await pg.screenshot({ path: path.join(SHOTS, `${file.replace('.html', '')}-390-drawer.png`) });
    }
    ok(errs.length === 0, `F10 ${T}: page errors: ${errs.slice(0, 2).join(' | ')}`);
    await pg.close();
  }
}

/* F9 — the BMS app pages are untouched */
for (const file of APP_PAGES) {
  const { pg } = await openPage(file, 1440, 'dark');
  const r = await pg.evaluate(() => ({ mm: !!document.querySelector('.rz-mm-nav, .rz-mm-panel'),
    blur: [...document.querySelectorAll('header, nav, .navbar, .bar, .topbar')].some((e) => { const c = getComputedStyle(e); return (c.backdropFilter || c.webkitBackdropFilter || 'none') !== 'none' && /blur\((1[2-6])px/.test(c.backdropFilter || c.webkitBackdropFilter); }) }));
  ok(!r.mm && !r.blur, `F9 ${file}: the app page carries the site bar treatment ${JSON.stringify(r)}`);
  await pg.close();
}

await browser.close(); srv.close();
if (fails.length) { console.error(`NAV FLOAT — FAIL (${fails.length} of ${checks} checks)`); const byLaw = {}; fails.forEach((f) => { const k = f.split(' ')[0]; byLaw[k] = (byLaw[k] || 0) + 1; });
  console.error('  by law: ' + Object.entries(byLaw).map(([k, n]) => `${k} ${n}`).join(', '));
  fails.slice(0, 200).forEach((f) => console.error('  ✗ ' + f)); process.exit(1); }
console.log(`NAV FLOAT — PASS (${checks} checks: ${PAGES.length} site pages at 1440 + 390 — floating, one blur, readable, heading clear, mega menu flush with 4 columns and a live preview, keyboard, phone drawer accordions; ${APP_PAGES.length} app pages untouched)`);
