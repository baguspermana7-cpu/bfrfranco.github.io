#!/usr/bin/env node
// PRD-COCKPIT-QUIET (owner R182, 2026-11-21): "tulisan2 yg over ... saya bisa lihat di mimic ui nya ... Nggak perlu di
// tampilkan ... hirarki yg di hide/expand". Each cockpit at rest shows the drawing; the chrome above it is a top bar,
// sheet tabs and a view bar. Everything else sits one tap down (Details) or in a tooltip.
//
// Rendered, authorized audit state, served from this tree. Per page and per width (1440x900, 390x844):
//   Q-L1 the main drawing starts high: drawTop <= 220 px at 1440, <= 300 px at 390
//   Q-L2 visible words above the drawing (in its column) <= 25, not counting the L0 chrome (shell top bar + state row, sheet tabs, the drawing's .hmi-bar / .vfx-bar) or <select> option text
//   Q-L3 no number shown above the drawing is also drawn on it (say each fact once at rest)
//   Q-L4 no file names, code identifiers or definitions in visible text above the drawing
//   Q-L5 no framed box >= 40 px tall above the drawing that holds no visible text or control
//   Q-L7 every Details disclosure is a keyboard control with aria-expanded, >= 44 px tall on a phone; on a cockpit with the shell state row,
//        Enter opens it, the open state survives a reload and closing is remembered (localStorage rz.cv.details.<page>)
//   Q-L8 the shell state row names the data mode (SIMULATED …) and the alarm state at rest; Details is not empty
// Q-L6 (nothing deleted) is held by the existing coverage, basis-hook and shell gates, which stay in the ship gate.
//
// Flags: --only=page1,page2   --shots=<dir>   --report (print, never fail)
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { isSupabaseModule, signedInStorage, signedInSupabaseBody } from './lib/signed-in-supabase.mjs';
import { enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const SHOTS = arg('shots');
const ONLY = arg('only') ? arg('only').split(',') : null;
const REPORT = process.argv.includes('--report');
const THEME = process.argv.includes('--light') ? 'light' : 'dark';   // evidence shots in the light theme
const OPEN_SHOT = process.argv.includes('--open');                 // also shoot each page with Details open

// page -> cockpit root identity (null = page has no audit root) and, where the largest svg/canvas is not the
// main drawing, the element that starts the cockpit's drawing area
const PAGES = [
  ['chiller-plant', 'chiller-plant'],
  ['water-system', 'water-system'],
  ['fire-system', 'fire-system'],
  ['fuel-system', 'fuel-system'],
  ['EPMS_Telemetry', 'epms'],
  ['ict', 'ict'],
  ['cdu-mini-bms', null, '.bm-controls'],   // the cockpit = its controls + drawings (R5)
  ['datahallAI', 'dc-ai', '.ai-dashboard-image'],
  ['dc-conventional', 'dc-conventional', '.kpi-strip', 'hub'],   // portfolio hub (R6): its KPI strip is the content; text laws only, no drawTop
].filter(([p]) => !ONLY || ONLY.includes(p));
const WIDTHS = [1440, 390];
const LIMIT = { 1440: 220, 390: 300 };
const MAX_WORDS = 25;
const DEV_PROSE = /\.js\b|\bengine\.|conv-engine|= seconds|= the model|= your browser|\bsince render\b/i;

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(page, root, width) {
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: signedInSupabaseBody({ email: 'educator@resistancezero.com', tier: 'pro', educator: true }) });
    return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort();
  });
  const phone = width < 500;
  await pg.setViewport({ width, height: phone ? 844 : 900, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await pg.evaluateOnNewDocument((entries, theme) => {
    try { localStorage.setItem('theme', theme); localStorage.setItem('rz_cookie_consent', 'declined'); entries.forEach(([k, v]) => localStorage.setItem(k, v)); } catch (x) { /* no storage */ }
  }, signedInStorage({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator' }), THEME);
  await pg.goto(ORIGIN + page + '.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await wait(1500);
  if (root) await enterAuthorizedAuditState(pg, root);
  await wait(5000);
  return pg;
}

function measure(sel) {
  const vis = (e) => { if (e.closest('details:not([open])') && !e.closest('summary')) return false; const s = getComputedStyle(e), R = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && R.width > 2 && R.height > 2; };
  const inFixed = (e) => { for (let n = e; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed') return true; } return false; };
  // the main drawing: the largest visible svg or canvas, at least 240 x 150, not inside a fixed layer
  let draw = sel ? document.querySelector(sel) : null, best = draw ? 1 : 0;
  if (!draw) document.querySelectorAll('svg, canvas').forEach((e) => {
    if (e.parentElement && e.parentElement.closest('svg')) return;
    if (!vis(e) || inFixed(e)) return;
    const R = e.getBoundingClientRect(); const a = R.width * R.height;
    if (R.width >= 240 && R.height >= 150 && a > best) { best = a; draw = e; }
  });
  if (!draw) return { drawTop: null };
  const DR = draw.getBoundingClientRect(); const top = DR.top + scrollY;
  const overX = (R) => R.right > DR.left + 1 && R.left < DR.right - 1;   // in the drawing's column, not beside it
  // site chrome (the shared nav, cookie bar, skip links) is not the cockpit's
  const site = (e) => e.closest('#rz-site-nav, .rz-nav, nav.site-nav, header.site-header, [data-rz-site-chrome], .cookie-banner, #rz-cookie, .rz-cookie, .skip-link');
  const texts = []; const l1 = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue;
    const e = n.parentElement;
    if (!e || e.closest('svg, script, style, noscript, template, select, [hidden]') || !vis(e) || inFixed(e) || site(e)) continue;
    const R = e.getBoundingClientRect(); const y = R.top + scrollY;
    if (y + R.height <= 0 || y >= top - 2 || !overX(R)) continue;
    texts.push(t);
    if (!e.closest('.cv-bar, .cv-sub, [role="tablist"], .rz-cockpit-nav, nav.tabs, .sheet-switch, .hmi-bar, .vfx-bar, [data-cockpit-l0]')) l1.push(t);
  }
  const words = l1.join(' ').split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  const dev = texts.filter((t) => /\.js\b|\bengine\.|conv-engine|= seconds|= the model|= your browser|\bsince render\b/i.test(t));
  // numbers drawn on the mimic
  const drawn = new Set((draw.textContent || '').match(/\d+\.\d+/g) || []);
  const dup = [...new Set(texts.join(' ').match(/\d+\.\d+/g) || [])].filter((v) => drawn.has(v));
  const empty = [];
  document.querySelectorAll('body *').forEach((e) => {
    if (e.closest('svg') || !vis(e) || inFixed(e) || site(e)) return;
    const R = e.getBoundingClientRect(); const y = R.top + scrollY;
    if (y >= top || R.height < 40 || R.width < 120 || !overX(R) || e.matches('summary, button')) return;
    const s = getComputedStyle(e);
    const framed = (s.borderTopStyle !== 'none' && parseFloat(s.borderTopWidth) > 0) || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor);
    if (!framed) return;
    // content area: union of visible text / control boxes inside
    let area = 0;
    e.querySelectorAll('button, input, select, a, svg, canvas, img, [role="button"]').forEach((c) => { if (vis(c)) { const r = c.getBoundingClientRect(); area += r.width * r.height; } });
    const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) { if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement)) continue; const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); area += r.width * r.height; }
    if (area / (R.width * R.height) < 0.08) empty.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className).split(' ')[0]} ${Math.round(R.width)}x${Math.round(R.height)}`);
  });
  const disclosures = [...document.querySelectorAll('[data-cockpit-details]')].filter(vis).map((d) => {
    const b = d.matches('button, summary') ? d : d.querySelector('button, summary');
    const r = b ? b.getBoundingClientRect() : { height: 0 };
    return { ok: !!b && (b.tagName === 'SUMMARY' || b.hasAttribute('aria-expanded')), h: Math.round(r.height) };
  });
  return { drawTop: Math.round(top), words, dev, dup, empty: empty.slice(0, 5), disclosures, sample: texts.slice(0, 40) };
}

const rows = [];
for (const [page, root, sel, kind] of PAGES) {
  for (const w of WIDTHS) {
    let pg;
    try {
      pg = await open(page, root, w);
      const m = await pg.evaluate(measure, sel || null);
      const id = `${page} ${w}`;
      rows.push({ page, w, ...m });
      if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${page}-${w}${THEME === 'light' ? '-light' : ''}.png` });
      if (SHOTS && OPEN_SHOT) { await pg.evaluate(() => { if (window.RZConvShell && window.RZConvShell.setDetails) window.RZConvShell.setDetails(true, false); }); await wait(400); await pg.screenshot({ path: `${SHOTS}/${page}-${w}${THEME === 'light' ? '-light' : ''}-open.png` }); await pg.evaluate(() => { if (window.RZConvShell && window.RZConvShell.setDetails) window.RZConvShell.setDetails(false, false); }); await wait(300); }
      ok(m.drawTop != null, `${id}: no main drawing found`);
      if (m.drawTop == null) continue;
      if (kind !== 'hub') ok(m.drawTop <= LIMIT[w], `Q-L1 ${id}: drawing starts at ${m.drawTop} px (> ${LIMIT[w]})`);
      if (kind !== 'hub') ok(m.words <= MAX_WORDS, `Q-L2 ${id}: ${m.words} words above the drawing (> ${MAX_WORDS})`);
      ok(m.dup.length === 0, `Q-L3 ${id}: ${m.dup.length} drawn values repeated above the drawing: ${m.dup.slice(0, 6).join(' ')}`);
      ok(m.dev.length === 0, `Q-L4 ${id}: developer prose: ${m.dev.slice(0, 2).map((t) => JSON.stringify(t.slice(0, 60))).join(' ')}`);
      ok(m.empty.length === 0, `Q-L5 ${id}: empty framed box: ${m.empty.join(' | ')}`);
      m.disclosures.forEach((d, i) => ok(d.ok && (w > 500 || d.h >= 44), `Q-L7 ${id}: Details control ${i} not a keyboard disclosure or ${d.h} px tall`));
      console.log(`${id.padEnd(20)} drawTop ${String(m.drawTop).padStart(5)}  words ${String(m.words).padStart(4)}  dup ${m.dup.length}  dev ${m.dev.length}  empty ${m.empty.length}`);
      // the Conventional cockpits carry the shell's state row (js/conv/shell.js)
      const row = await pg.evaluate(() => {
        const sub = document.querySelector('.cv-sub'); if (!sub || sub.hidden) return null;
        const kids = [...sub.children].filter((k) => !k.matches('.cv-details'));
        const words = kids.map((k) => k.textContent.replace(/\s+/g, ' ').replace('×', '').trim()).filter(Boolean);
        const btn = sub.querySelector('.cv-details__btn');
        return { words, sim: words.some((t) => /SIMULATED|COMMS LOST|REPLAY|DEMO/i.test(t)), state: words.some((t) => /\b(NORMAL|ATTENTION|WARN\w*|ALARM|CRITICAL|UNAVAILABLE|FACP|EPMS)\b/i.test(t) && !/^SIMULATED$/i.test(t)), btn: !!btn, panelKids: document.querySelectorAll('#cvDetailsPanel > *').length, mute: [...document.querySelectorAll('.cv-sub .cv-state')].filter((n) => !n.closest('[aria-live]')).map((n) => n.id || n.className) };
      });
      if (row) {
        // Q-L8 the state row names the data mode and the alarm state, at rest
        ok(row.sim && row.state, `Q-L8 ${id}: state row lacks the data mode or the alarm state: ${JSON.stringify(row.words)}`);
        ok(row.btn && row.panelKids > 0, `Q-L8 ${id}: no Details control or an empty Details panel`);
        // Q-L8b the state moved out of its strip's live region still announces a change (code review 2026-11-21)
        ok(!row.mute.length, `Q-L8b ${id}: state row item(s) outside any aria-live region: ${row.mute.join(', ')}`);
        if (w === 1440 && row.btn) {
          // Q-L7 keyboard opens it, the open state survives a reload, closing is remembered too
          await pg.focus('.cv-details__btn'); await pg.keyboard.press('Enter'); await wait(300);
          const opened = await pg.evaluate(() => !document.getElementById('cvDetailsPanel').hidden);
          await pg.reload({ waitUntil: 'domcontentloaded' }); await wait(2500);
          const kept = await pg.evaluate(() => document.querySelector('.cv-details__btn').getAttribute('aria-expanded') === 'true' && !document.getElementById('cvDetailsPanel').hidden);
          await pg.click('.cv-details__btn'); await wait(200);
          const closedKey = await pg.evaluate(() => { try { return localStorage.getItem('rz.cv.details.' + location.pathname.replace(/^.*\//, '')); } catch (e) { return 'x'; } });
          ok(opened && kept && closedKey === '0', `Q-L7 ${id}: Details open by Enter ${opened}, kept after reload ${kept}, close remembered ${closedKey}`);
        }
      }
    } catch (e) {
      ok(false, `${page} ${w}: ${e.message.split('\n')[0]}`);
    } finally { if (pg) await pg.close().catch(() => {}); }
  }
}
await browser.close(); srv.close();
if (SHOTS) fs.writeFileSync(`${SHOTS}/quiet.json`, JSON.stringify(rows, null, 1));
fails.forEach((f) => console.log('  ✗ ' + f));
console.log(`test-cockpit-quiet: ${checks} checks, ${fails.length} fail`);
process.exit(fails.length && !REPORT ? 1 : 0);
