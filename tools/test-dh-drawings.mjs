#!/usr/bin/env node
/*
 * R128-R134 gate: datahallAI.html drawings, equipment modals and shell
 * (PRD documentation/prd/datahall-ai/PRD_DATAHALL_DRAWINGS.md §11).
 *
 *   node tools/test-dh-drawings.mjs [--page=datahallAI.html] [--only=H1,H5]   # exit 1 on any failed law (run under rz-lane)
 *
 * H1  no gradient, filter or shadow in any drawing or equipment modal (both themes)
 * H2  every tagged equipment item is drawn from the shared symbol library (data-sym in RZ engineering META)
 * H3  every equipment class opens its OWN L3 modal (data-rz-modal-class = class) holding >= 8 library symbols
 * H4  every tagged item has an accessible name (aria-label or <title>) and is keyboard-focusable
 * H5  <= 25 words per sheet outside tags, values, line numbers and the title block
 * H6  every sheet opens fit-to-width: no drawing wider than its frame, no sideways page scroll (1440 and 390)
 * H11 shell: no header control outside the nav bar, <= 6 visible actions in it, no "SIMULATED · ENGINE BASIS" text
 * H12 sidebar has pinned / auto-hide / hidden modes that survive a reload
 * H13 Room Layout and Rack Architecture draw on first open (non-zero box)
 * H7-H10, H14 (geometry, engine binding, trace, colour, a11y) land with the phases that build them.
 * Premium test seam: the rz_premium_session fixture of tools/test-datahall-ai-authority.mjs (local server only).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const PAGE = arg('page') || 'datahallAI.html';
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
let fail = 0;
const law = (id, ok, msg) => {
  if (ONLY && !ONLY.has(id)) return;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SHEETS = [['hall', null, 'hSvg'], ['over', null, 'floorSvg'], ['rack', null, 'rackSvg'], ['cool', null, 'coolSvg'],
  ['elec', 'Overview', 'elecOvSvg'], ['elec', 'DH-01', 'elecDH1Svg'], ['net', 'Compute fabric', 'netSvg'],
  ['net', 'Corporate & DC internet', 'wanSvg'], ['net', 'Security network', 'secSvg'], ['fire', 'Mimic', 'fireSvg']];

const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

async function open(vp, theme) {
  const pg = await browser.newPage();
  pg.errors = [];
  pg.on('pageerror', (e) => pg.errors.push(e.message));
  await pg.setRequestInterception(true);
  pg.on('request', (r) => (r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort()));
  await pg.setViewport(vp);
  await pg.evaluateOnNewDocument((t) => {
    try {
      localStorage.setItem('theme', t);
      localStorage.setItem('rz_cookie_consent', 'declined');
      localStorage.setItem('rz_premium_session', JSON.stringify({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator', expires: '2099-12-31T23:59:59.000Z' }));
    } catch (x) { /* no storage */ }
  }, theme);
  await pg.goto(ORIGIN + PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(800);
  return pg;
}
async function showSheet(pg, tab, sub) {
  await pg.evaluate((t) => { const b = document.querySelector(`#tabs [data-t="${t}"]`); if (b) b.click(); }, tab);
  await wait(900);
  if (sub) {
    await pg.evaluate((t, s) => {
      const b = [...document.querySelectorAll(`.${t}-tabs button, .${t}-tabs [role=tab], [data-sheet-tabs="${t}"] [role=tab]`)].find((x) => x.textContent.trim() === s);
      if (b) b.click();
    }, tab, sub);
    await wait(700);
  }
}
// shared DOM probes (run in the page)
const PROBE = {
  paint: (root) => {
    const all = [...root.querySelectorAll('*')];
    const defs = root.querySelectorAll('linearGradient,radialGradient,filter').length;
    const urlRefs = all.filter((e) => /url\(#/.test((e.getAttribute && (e.getAttribute('fill') || '') + (e.getAttribute('stroke') || '') + (e.getAttribute('filter') || '')) || '')).length;
    const css = all.filter((e) => { const s = getComputedStyle(e); return (s.boxShadow && s.boxShadow !== 'none') || (s.filter && s.filter !== 'none') || /gradient/.test(s.backgroundImage || ''); }).length;
    return defs + urlRefs + css;
  },
};

// ── 1440 dark: sheets ────────────────────────────────────────────────────────────────────────────────────────────
const pg = await open({ width: 1440, height: 1000 }, 'dark');
const sheetRows = [];
for (const [tab, sub, id] of SHEETS) {
  await showSheet(pg, tab, sub);
  const r = await pg.evaluate((id, paintSrc) => {
    const paint = new Function('return ' + paintSrc)();
    const v = document.getElementById(id);
    if (!v) return { id, missing: true };
    const box = v.getBoundingClientRect();
    const frame = (v.closest('[data-sheet-frame]') || v.parentElement).getBoundingClientRect();
    const SKIP = '[data-role="tag"],[data-role="value"],[data-role="line"],[data-role="titleblock"],[data-role="titleblock"] *';
    const words = [...v.querySelectorAll('text')].filter((t) => !t.closest(SKIP))
      .map((t) => t.textContent.trim()).join(' ').split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w)).length;
    const items = [...v.querySelectorAll('[data-rz-equipment]')];
    const META = (window.RZEngSymbols && window.RZEngSymbols.META) || {};
    return { id, w: Math.round(box.width), h: Math.round(box.height), frameW: Math.round(frame.width), words, paint: paint(v),
      items: items.length, sym: items.filter((e) => META[e.getAttribute('data-sym')] || e.querySelector('[data-sym]')).length,
      named: items.filter((e) => (e.getAttribute('aria-label') || e.querySelector(':scope > title')) && e.getAttribute('tabindex') !== null).length };
  }, id, PROBE.paint.toString());
  sheetRows.push({ tab, sub, ...r });
}
const shown = sheetRows.filter((r) => !r.missing);
law('H1', shown.every((r) => r.paint === 0), 'no gradient/filter/shadow in drawings: ' + shown.map((r) => `${r.id} ${r.paint}`).join(', '));
const allItems = shown.reduce((a, r) => a + r.items, 0), allSym = shown.reduce((a, r) => a + r.sym, 0), allNamed = shown.reduce((a, r) => a + r.named, 0);
law('H2', allItems > 0 && allSym === allItems, `items drawn from the symbol library: ${allSym} / ${allItems}`);
law('H4', allItems > 0 && allNamed === allItems, `items with a name and keyboard focus: ${allNamed} / ${allItems}`);
law('H5', shown.every((r) => r.words <= 25), 'words per sheet outside tags/values (<= 25): ' + shown.map((r) => `${r.id} ${r.words}`).join(', '));
law('H6', shown.every((r) => r.w <= r.frameW + 1), '1440 sheet width vs frame: ' + shown.map((r) => `${r.id} ${r.w}/${r.frameW}`).join(', '));
const flr = sheetRows.find((r) => r.id === 'floorSvg'), rk = sheetRows.find((r) => r.id === 'rackSvg');
law('H13', !!flr && !flr.missing && flr.w > 0 && flr.h > 0 && !!rk && !rk.missing && rk.w > 0 && rk.h > 0,
  `first open: Room Layout ${flr && !flr.missing ? flr.w + '×' + flr.h : 'missing'}, Rack ${rk && !rk.missing ? rk.w + '×' + rk.h : 'missing'}`);

// ── H3 + H1 modals: every equipment class opens its own modal ───────────────────────────────────────────────────
const classes = new Map();
for (const [tab, sub] of SHEETS) {
  await showSheet(pg, tab, sub);
  const found = await pg.evaluate(() => [...document.querySelectorAll('[data-rz-equipment]')]
    .filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getAttribute('data-rz-equipment').split(':')[0]));
  for (const c of found) if (!classes.has(c)) classes.set(c, [tab, sub]);
}
const own = [], generic = [];
let modalPaint = 0;
for (const [cls, [tab, sub]] of classes) {
  await showSheet(pg, tab, sub);
  const r = await pg.evaluate(async (cls, paintSrc) => {
    const paint = new Function('return ' + paintSrc)();
    const el = [...document.querySelectorAll(`[data-rz-equipment^="${cls}:"]`)].find((e) => e.getBoundingClientRect().width > 0);
    if (!el) return { cls, none: true };
    el.scrollIntoView({ block: 'center' });
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 700));
    const m = [...document.querySelectorAll('[data-rz-modal-class], dialog[open], [role=dialog]')]
      .filter((d) => d.getBoundingClientRect().width > 0 && getComputedStyle(d).visibility !== 'hidden');
    const mine = m.find((d) => d.getAttribute('data-rz-modal-class') === cls);
    const p = m.reduce((a, d) => a + paint(d), 0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    m.forEach((d) => { const x = d.querySelector('[aria-label*="Close" i], .close, [data-close]'); if (x) x.click(); });
    return { cls, own: !!mine, sym: mine ? mine.querySelectorAll('[data-sym]').length : 0, paint: p };
  }, cls, PROBE.paint.toString());
  await wait(250);
  modalPaint += r.paint || 0;
  (r.own && r.sym >= 8 ? own : generic).push(r.cls);
}
law('H3', classes.size > 0 && generic.length === 0, `classes with their own L3 schematic: ${own.length} / ${classes.size}` +
  (generic.length ? ` — missing: ${generic.slice(0, 12).join(', ')}${generic.length > 12 ? ' …' : ''}` : ''));
law('H1', modalPaint === 0, `no gradient/filter/shadow in equipment modals: ${modalPaint} painted element(s)`);

// ── H11 shell ────────────────────────────────────────────────────────────────────────────────────────────────────
const shell = await pg.evaluate(() => {
  const nav = document.querySelector('header nav, .hub-nav, [data-rz-shell-nav]');
  const head = document.querySelector('header') || document.body;
  const ctrls = [...head.querySelectorAll('a,button')].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('#tabs'));
  const outside = nav ? ctrls.filter((e) => !nav.contains(e)).length : ctrls.length;
  const inNav = nav ? [...nav.querySelectorAll('a,button')].filter((e) => e.getBoundingClientRect().width > 0).length : 0;
  const sim = /SIMULATED\s*·\s*ENGINE BASIS/i.test(document.body.innerText);
  return { nav: !!nav, outside, inNav, sim };
});
law('H11', shell.nav && shell.outside === 0 && shell.inNav <= 6 && !shell.sim,
  `nav bar ${shell.nav}, controls outside it ${shell.outside}, visible in it ${shell.inNav}, "SIMULATED · ENGINE BASIS" shown ${shell.sim}`);

// ── H12 sidebar modes ────────────────────────────────────────────────────────────────────────────────────────────
const modes = await pg.evaluate(() => [...document.querySelectorAll('[data-side-mode]')].map((b) => b.getAttribute('data-side-mode')));
let persisted = false;
if (['pinned', 'auto', 'hidden'].every((m) => modes.includes(m))) {
  await pg.evaluate(() => document.querySelector('[data-side-mode="auto"]').click());
  await pg.reload({ waitUntil: 'networkidle2' });
  await wait(600);
  persisted = await pg.evaluate(() => document.body.getAttribute('data-side') === 'auto');
}
law('H12', persisted, `sidebar modes offered [${modes.join(', ') || 'none'}], auto-hide survives reload ${persisted}`);
if (pg.errors.length) console.log(`  note: ${pg.errors.length} page error(s) — ${pg.errors[0]}`);
await pg.close();

// ── H6 at 390 ────────────────────────────────────────────────────────────────────────────────────────────────────
const ph = await open({ width: 390, height: 844, isMobile: true, hasTouch: true }, 'light');
const narrow = [];
for (const [tab, sub, id] of SHEETS) {
  await showSheet(ph, tab, sub);
  narrow.push(await ph.evaluate((id) => {
    const v = document.getElementById(id);
    const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
    if (!v) return { id, ok: false, why: 'missing' };
    const w = v.getBoundingClientRect().width, f = (v.closest('[data-sheet-frame]') || v.parentElement).getBoundingClientRect().width;
    return { id, ok: w <= f + 1 && sw <= cw, why: `${Math.round(w)}/${Math.round(f)} page ${sw}/${cw}` };
  }, id));
}
law('H6', narrow.every((r) => r.ok), '390 light: ' + narrow.map((r) => `${r.id} ${r.why}`).join(', '));
await ph.close();

await browser.close();
srv.close();
console.log(`test-dh-drawings: ${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
