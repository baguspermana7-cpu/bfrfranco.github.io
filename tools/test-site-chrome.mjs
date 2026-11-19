#!/usr/bin/env node
/**
 * test-site-chrome.mjs — one navbar position and one theme button on every page (PRD: documentation/prd/PRD_SITE_CHROME.md,
 * standard: standarization/SITE_CHROME_STANDARD.md). Every root page is RENDERED at 1440 and 390 px (768 too with
 * --full) and measured; nothing is read from source except law CH7.
 *
 *   CH1  the page has a bar: computed position sticky, top 0, height = its kind's token (site 56, app 48) ± 1 px
 *   CH2  exactly one visible theme button, inside the bar, hit area >= 44 x 44, an <svg> icon and no text glyph,
 *        an accessible name that names the theme it switches to
 *   CH3  the button's distance from the right edge is the same on every page of a kind (reported: distinct offsets)
 *   CH4  right-hand slot order: search · theme · sign-in · menu, wherever those exist
 *   CH5  a press flips <html data-theme> and localStorage.theme; a second press flips them back
 *   CH6  the stored theme is on <html> at the first paint (no flash)
 *   CH7  source: no page carries its own toggle function, a theme key other than `theme`, or a `.navbar {` rule
 *        (a rule that only hides the bar — `display: none`, the print hide — is not a bar rule)
 *   CH8  phone: the bar is not taller than its token, no bar control is narrower than 44 px, no sideways scroll
 *   CH9  the exemption list names only files that exist, each with a reason
 *   CH10 phone, refitted pages (data-rz-bar): a press on the menu button shows the drawer (strict from day one —
 *        v3.68.0 shipped 10 pages whose menu did not open: a `body.rz-nav-open` selector in rz-chrome.css made
 *        rz-mobile-nav.js skip its own open-state CSS)
 *   CH11 refitted pages, both themes at 1440: every text in the bar reads at >= 4.5:1 against what is painted behind
 *        it (strict — v3.74.0 was stopped before push: three pages kept light nav ink meant for a transparent bar
 *        over a dark hero, 1.5:1 on the new white bar; the a11y gate samples 8 pages and happened to hold two of them)
 *
 * RATCHET until the last family is refitted (phase N6): the number of failing pages per law may fall, a rise fails.
 * Baseline: tools/site-chrome-baseline.json (re-record with --baseline after a refit, never to pass a regression).
 *
 * Red proof: RZ_CHROME_BASELINE=<a baseline one lower> … --page=<a failing page> exits 1 (the ratchet can fail).
 * Run: rz-lane -l 3 -t 1500 -- node tools/test-site-chrome.mjs [--full] [--baseline] [--page=a.html,b.html] [--list=CH2]
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const FULL = process.argv.includes('--full'), RECORD = process.argv.includes('--baseline');
const ONLY = arg('page') ? new Set(arg('page').split(',')) : null, LIST = arg('list') || null;
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/site-chrome.config.json'), 'utf8'));
const BASE_FILE = process.env.RZ_CHROME_BASELINE || path.join(ROOT, 'tools/site-chrome-baseline.json');   // the override exists for the gate's own red proof
const APP = new Set(CFG.app), BARE = CFG.bare;
const kindOf = (f) => (BARE[f] ? 'bare' : APP.has(f) ? 'app' : 'site');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };

const all = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
const pages = all.filter((f) => kindOf(f) !== 'bare' && (!ONLY || ONLY.has(f)));
const fails = { CH1: new Map(), CH2: new Map(), CH3: new Map(), CH4: new Map(), CH5: new Map(), CH6: new Map(), CH7: new Map(), CH8: new Map(), CH9: new Map(), CH10: new Map(), CH11: new Map() };
const fail = (law, f, why) => { if (!fails[law].has(f)) fails[law].set(f, why); };

// CH9 — the exemption list
for (const [f, why] of Object.entries(BARE)) { if (!all.includes(f)) fail('CH9', f, 'listed as bare but the file does not exist'); else if (!why || why.length < 8) fail('CH9', f, 'no reason'); }
for (const f of CFG.app) if (!all.includes(f)) fail('CH9', f, 'listed as app but the file does not exist');

// CH7 — source scan (script and style bodies of the page itself)
for (const f of pages) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8'), why = [];
  if (/function\s+toggle\w*Theme\w*\s*\(|(themeToggle|theme-toggle|themeBtn)[\s\S]{0,160}addEventListener\(\s*['"]click/.test(s)) why.push('own toggle code');
  const keys = [...s.matchAll(/localStorage\.(?:getItem|setItem)\(\s*['"]((?:rz[-_])?(?:admin[-_])?theme|darkMode|dark-mode|color-theme)['"]/g)].map((m) => m[1]).filter((k) => k !== 'theme');
  if (keys.length) why.push('theme key ' + [...new Set(keys)].join(','));
  if (/<style[^>]*>[\s\S]*?(^|[\s}])\.navbar\s*\{(?!\s*display\s*:\s*none\b[^{}]*\})[\s\S]*?<\/style>/m.test(s)) why.push('.navbar rule in the page');
  if (/<html[^>]*\sdata-theme="(?:dark|light)"/.test(s)) why.push('hard-coded data-theme on <html>');
  if (why.length) fail('CH7', f, why.join('; '));
}

const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split(/[?#]/)[0])); if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const O = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const offsets = {};   // kind|width -> Map(offset -> count)

const measure = () => {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
  const bars = [...document.querySelectorAll('[data-rz-bar], nav.navbar, header.navbar, .navbar, header, .topbar, .ltc-top, .dh-head, .hdr')].filter(vis)
    .filter((e) => { const r = e.getBoundingClientRect(); return r.top < 130 && r.width > innerWidth * 0.6 && r.height < innerHeight * 0.6; });
  const bar = bars[0] || null, br = bar ? bar.getBoundingClientRect() : null, bc = bar ? getComputedStyle(bar) : null;
  const tsel = '[data-rz-theme-toggle], #themeToggle, #navThemeBtn, .theme-toggle, .theme-btn, .rz-theme-btn, [aria-label*="theme" i], [onclick*="toggleTheme"]';
  const ts = [...new Set([...document.querySelectorAll(tsel)])].filter(vis), t = ts[0] || null, tr = t ? t.getBoundingClientRect() : null;
  const onScreen = (e) => { const r = e.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth; };   // a closed drawer slid off-screen still holds its slots
  const x = (sel) => { const e = [...document.querySelectorAll(sel)].filter(vis).filter(onScreen)[0]; return e ? Math.round(e.getBoundingClientRect().left) : null; };
  const order = [['search', x('[data-rz-slot="search"], .nav-search-btn, [data-rz-search], #rzSearchBtn, #navSearchBtn')], ['theme', tr ? Math.round(tr.left) : null], ['signin', x('[data-rz-slot="signin"], .rz-auth-wrap, .nav-auth-wrap, #rzLoginBtn, .rz-login-btn, .rz-user-btn')], ['menu', x('.rz-nav-burger, .rz-nav-burger-bound')]].filter((p) => p[1] != null).sort((a, b) => a[1] - b[1]).map((p) => p[0]);
  const narrow = bar ? [...bar.querySelectorAll('button, a.btn, [role=button]')].filter(vis).filter((e) => e.getBoundingClientRect().width < 43.5).length : 0;
  const text = t ? [...t.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('') + [...t.querySelectorAll('i, span')].map((n) => n.textContent.trim()).join('') : '';
  return { bar: bar ? bar.tagName.toLowerCase() + '.' + String(bar.className || '').split(' ')[0] : null, pos: bc ? bc.position : '', top: br ? Math.round(br.top) : null, h: br ? Math.round(br.height) : 0,
    tN: ts.length, tIn: !!(t && bar && bar.contains(t)), tW: tr ? Math.round(tr.width) : 0, tH: tr ? Math.round(tr.height) : 0, tRight: tr ? Math.round(innerWidth - tr.right) : null,
    svg: !!(t && t.querySelector('svg')), font: !!(t && t.querySelector('i[class*="fa-"]')), text, label: t ? (t.getAttribute('aria-label') || t.getAttribute('title') || '') : '',
    order, narrow, overflow: document.documentElement.scrollWidth > innerWidth + 1, theme: document.documentElement.getAttribute('data-theme') || '', fp: window.__rzFirstPaintTheme !== undefined ? window.__rzFirstPaintTheme : window.__rzRafTheme !== undefined ? window.__rzRafTheme : null };
};

// CH11 — lowest contrast of any text in the bar, against the first opaque background behind it
const barContrast = () => {
  const bar = document.querySelector('[data-rz-bar]'); if (!bar) return null;
  const rgba = (c) => { const m = c.match(/[\d.]+/g) || []; return [+m[0] || 0, +m[1] || 0, +m[2] || 0, m[3] === undefined ? 1 : +m[3]]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const bgOf = (e) => { for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0.9) return c; } return rgba(getComputedStyle(document.body).backgroundColor); };
  let worst = null;
  for (const e of bar.querySelectorAll('*')) {
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1); if (!own) continue;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.1 || r.bottom < 0 || r.top > 80) continue;
    let hidden = false; for (let n = e.parentElement; n && n !== bar; n = n.parentElement) { const c = getComputedStyle(n); if (c.visibility === 'hidden' || +c.opacity < 0.1) hidden = true; } if (hidden) continue;
    const fg = rgba(cs.color), bg = bgOf(e), a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (!worst || ratio < worst.ratio) worst = { ratio: Math.round(ratio * 100) / 100, text: e.textContent.trim().slice(0, 18), fg: fg.slice(0, 3).join(','), bg: bg.slice(0, 3).join(',') };
  }
  return worst;
};

const WIDTHS = FULL ? [[1440, 900], [768, 1024], [390, 844]] : [[1440, 900], [390, 844]];
for (const [w, h] of WIDTHS) {
  const stored = w === 1440 ? 'dark' : 'light';   // each width starts from a different stored choice
  const pg = await browser.newPage();
  await pg.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
  await pg.setRequestInterception(true);
  pg.on('request', (r) => (r.url().startsWith(O) || r.url().startsWith('data:') ? r.continue() : r.abort()));
  await pg.evaluateOnNewDocument((stored) => { try { localStorage.setItem('rz_cookie_consent', 'declined'); if (!sessionStorage.getItem('__ch')) { sessionStorage.setItem('__ch', '1'); localStorage.setItem('theme', stored); } } catch (e) { /* none */ }
    /* the paint entry can arrive late, or not at all, on a loaded machine: the first animation frame is the fallback */
    try { requestAnimationFrame(() => { if (window.__rzRafTheme === undefined) window.__rzRafTheme = document.documentElement.getAttribute('data-theme') || ''; }); } catch (e) { /* none */ }
    try { new PerformanceObserver((l) => { if (window.__rzFirstPaintTheme === undefined && l.getEntries().length) window.__rzFirstPaintTheme = document.documentElement.getAttribute('data-theme') || ''; }).observe({ type: 'paint', buffered: true }); } catch (e) { /* none */ } }, stored);
  for (const f of pages) {
    const kind = kindOf(f), token = CFG.heights[kind];
    try {
      await pg.evaluate(() => { try { sessionStorage.removeItem('__ch'); } catch (e) { /* none */ } }).catch(() => {});
      await pg.goto(O + f, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 900));
      const m = await pg.evaluate(measure);
      const tag = `@${w}`;
      if (!m.bar) fail('CH1', f, `${tag} no bar`);
      else if (m.pos !== 'sticky' || m.top !== 0 || Math.abs(m.h - token) > 1) fail('CH1', f, `${tag} ${m.bar} position ${m.pos}, top ${m.top}, height ${m.h} (want sticky, 0, ${token})`);
      if (m.tN !== 1) fail('CH2', f, `${tag} ${m.tN} theme buttons`);
      else if (!m.tIn) fail('CH2', f, `${tag} theme button outside the bar`);
      else if (m.tW < 44 || m.tH < 44) fail('CH2', f, `${tag} hit area ${m.tW}x${m.tH} (want >= 44x44)`);
      else if (!m.svg || m.font || m.text) fail('CH2', f, `${tag} icon is ${m.svg ? 'svg' : m.font ? 'an icon font' : 'text "' + m.text.slice(0, 6) + '"'}${m.text && m.svg ? ' + text' : ''}`);
      else if (!/switch to (light|dark) theme/i.test(m.label)) fail('CH2', f, `${tag} accessible name "${m.label.slice(0, 30)}"`);
      if (m.tN === 1) { const k = kind + '|' + w + '|' + m.order.join('·'); (offsets[k] = offsets[k] || new Map()).set(m.tRight, (offsets[k].get(m.tRight) || []).concat(f)); }
      const want = ['search', 'theme', 'signin', 'menu'].filter((s) => m.order.includes(s));
      if (m.order.join() !== want.join()) fail('CH4', f, `${tag} order ${m.order.join(' · ') || 'none'}`);
      if (m.fp !== stored) {   // one reload before it counts: the paint entry can arrive after the 900 ms settle on a loaded machine
        await pg.goto(O + f, { waitUntil: 'domcontentloaded', timeout: 30000 }); await new Promise((r) => setTimeout(r, 1500));
        const fp2 = await pg.evaluate(() => (window.__rzFirstPaintTheme !== undefined ? window.__rzFirstPaintTheme : window.__rzRafTheme !== undefined ? window.__rzRafTheme : null));
        if (fp2 !== stored) fail('CH6', f, `${tag} stored ${stored}, theme at first paint "${fp2 == null ? 'not recorded' : fp2}" (two loads)`);
      }
      if (w < 500 && (m.h > token + 1 || m.narrow || m.overflow)) fail('CH8', f, `${tag} bar ${m.h} px (token ${token}), ${m.narrow} control(s) under 44 px${m.overflow ? ', page scrolls sideways' : ''}`);
      if (w < 500) {
        const d = await pg.evaluate(async () => { const bar = document.querySelector('[data-rz-bar]'); if (!bar) return null;
          const g = bar.querySelector('.rz-nav-burger, .rz-nav-burger-bound'), l = bar.querySelector('.nav-links, .nav-menu'); if (!g || !l) return { g: !!g, l: !!l };
          g.click(); await new Promise((r) => setTimeout(r, 450)); const r = l.getBoundingClientRect(), o = { g: true, l: true, disp: getComputedStyle(l).display, h: Math.round(r.height), links: l.querySelectorAll('a').length };
          g.click(); await new Promise((r) => setTimeout(r, 250)); return o; });
        if (d && (!d.g || !d.l || d.disp === 'none' || d.h < 44 || !d.links)) fail('CH10', f, `@${w} menu button ${d.g ? 'present' : 'missing'}, drawer display ${d.disp || 'n/a'}, height ${d.h || 0}`);
      }
      if (m.tN === 1 && w === 1440) {
        const r = await pg.evaluate(async () => { const sel = '[data-rz-theme-toggle], #themeToggle, #navThemeBtn, .theme-toggle, .theme-btn, .rz-theme-btn, [aria-label*="theme" i], [onclick*="toggleTheme"]';
          const t = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 0), a = document.documentElement.getAttribute('data-theme');
          t.click(); await new Promise((r) => setTimeout(r, 120)); const b = document.documentElement.getAttribute('data-theme'), kb = localStorage.getItem('theme');
          t.click(); await new Promise((r) => setTimeout(r, 120)); const c = document.documentElement.getAttribute('data-theme'), kc = localStorage.getItem('theme');
          return { a, b, c, kb, kc }; });
        if (!(r.a !== r.b && r.c === r.a && r.kb === r.b && r.kc === r.c)) fail('CH5', f, `press: ${r.a} → ${r.b} (stored ${r.kb}) → ${r.c} (stored ${r.kc})`);
        await pg.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' }).catch(() => {});   // a colour sampled mid-fade is not the colour
        for (const pass of [0, 1]) {   // the stored theme, then the other one
          if (pass) { await pg.evaluate(() => document.querySelector('[data-rz-bar] [data-rz-theme-toggle]')?.click()); await new Promise((r) => setTimeout(r, 250)); }
          const c = await pg.evaluate(barContrast), th = await pg.evaluate(() => document.documentElement.getAttribute('data-theme'));
          if (c && c.ratio < 4.5) fail('CH11', f, `@${w} ${th}: "${c.text}" ${c.ratio}:1 (rgb ${c.fg} on ${c.bg})`);
          if (pass) { await pg.evaluate(() => document.querySelector('[data-rz-bar] [data-rz-theme-toggle]')?.click()); await new Promise((r) => setTimeout(r, 120)); }
        }
      }
    } catch (e) { fail('CH1', f, `@${w} page did not load: ${String(e.message).slice(0, 50)}`); }
  }
  await pg.close();
}
await browser.close(); srv.close();

// A page that was in the folder when the run started and is gone now was another gate's temporary file (the
// sharded ship gate runs them side by side): it is not a finding. Seen 2026-11-18: 170 pages against a baseline of 169.
const gone = pages.filter((f) => !fs.existsSync(path.join(ROOT, f)));
for (const f of gone) { for (const m of Object.values(fails)) m.delete(f); for (const map of Object.values(offsets)) for (const [off, files] of map) map.set(off, files.filter((x) => x !== f)); }
if (gone.length) console.log(`ignored ${gone.length} page(s) removed during the run: ${gone.join(', ')}`);

// CH3 — one position per kind, width and slot set: every page off the most common offset fails
for (const [k, map] of Object.entries(offsets)) { const top = [...map.entries()].sort((a, b) => b[1].length - a[1].length)[0][0];
  for (const [off, files] of map) if (Math.abs(off - top) > 1) files.forEach((f) => fail('CH3', f, `${k.split('|').slice(0, 2).join(' @')}: button ${off} px from the right edge, family value ${top}`)); }

const counts = Object.fromEntries(Object.entries(fails).map(([k, m]) => [k, m.size]));
for (const L of LIST === 'all' ? Object.keys(fails) : LIST && fails[LIST] ? [LIST] : []) for (const [f, why] of fails[L]) console.log(`  ${L} ${f}: ${why}`);
if (RECORD) { fs.writeFileSync(BASE_FILE, JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), pages: pages.length, widths: WIDTHS.map((x) => x[0]), counts }, null, 2) + '\n'); console.log('baseline recorded', JSON.stringify(counts)); process.exit(0); }
const base = fs.existsSync(BASE_FILE) ? JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')) : null;
let bad = 0;
for (const [law, n] of Object.entries(counts)) {
  const b = base ? base.counts[law] : 0, strict = law === 'CH9' || law === 'CH10' || law === 'CH11' || !base, ok = strict ? n === 0 : n <= b;
  if (!ok) bad++;
  const sample = [...fails[law].entries()].slice(0, 2).map(([f, why]) => `${f} (${why})`).join('; ');
  console.log(`${ok ? 'PASS' : 'FAIL'} ${law} ${n} page(s) fail${base && !strict ? ` (ratchet: baseline ${b})` : ''}${n ? ' — e.g. ' + sample : ''}`);
}
console.log(`\nsite chrome: ${pages.length} pages × ${WIDTHS.length} widths, ${Object.keys(BARE).length} exempt · ${bad ? bad + ' law(s) above their baseline' : ONLY ? 'subset run' : 'no law above its baseline'}`);
process.exit(bad && (!ONLY || process.env.RZ_CHROME_BASELINE) ? 1 : 0);
