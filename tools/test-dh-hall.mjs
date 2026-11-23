#!/usr/bin/env node
/* test-dh-hall.mjs — STRICT. PRD-DCAI-NUMBERS phase B5 (owner N3, 2026-11-20: "uiux datahall nya itu sangat perlu di
   refine dan di polish more"). The Data Hall tab of datahallAI.html, signed in, at 390 and 1440 px, dark and light:
   DH1 the KPI strip at 390 px is a compact grid: <= 200 px tall, at least 3 tiles per row (was 9 stacked cards, 572 px)
   DH2 the hall selector: no chip wraps its label ("DH-" / "1"), every chip of DH-1..DH-8 is reachable (inside the
       viewport or inside a horizontally scrollable bar), and the active chip is scrolled into view after a pick
   DH3 the alarm strip names the worst severity once: the visible text says "critical" at most once (was "CRITICAL" +
       "Critical 1"); the state word stays for assistive technology
   DH9 the sidebar hall title clears WCAG AA (>= 4.5:1) on its own background in both themes (light was #cbd5e1 on white)
   DH4 above the plan, prose gives way to tooltips: the hall line is <= 8 words; the floor budget and the closure check
       are ONE chip whose tooltip carries both sentences (was two lines, 40 words)
   DH6 the 60 aisle temperatures are upright (no rotated value text), each named (TT-HA-nn-p / TT-CA-nn-p) and showing
       a live number; the unit sits in one legend
   DH11 the hall plan's tooltips work without a mouse: focus on the area check and a tap on a sensor show the tooltip,
       the sensor's with its live reading first
   DH10 nothing scrolls sideways at 390 px; the page raises no error
   Usage: node tools/test-dh-hall.mjs [--shots=<dir>] */
import fs from 'fs';
import http from 'http';
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
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(width, theme) {
  const pg = await browser.newPage();
  pg.errors = []; pg.on('pageerror', (e) => pg.errors.push(e.message));
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: signedInSupabaseBody({ email: 'educator@resistancezero.com', tier: 'pro', educator: true }) });
    return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort();
  });
  const phone = width < 500;
  await pg.setViewport({ width, height: phone ? 844 : 900, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await pg.evaluateOnNewDocument((entries, theme) => {
    try { localStorage.setItem('theme', theme); localStorage.setItem('rz_cookie_consent', 'declined'); entries.forEach(([k, v]) => localStorage.setItem(k, v)); } catch (x) { /* no storage */ }
  }, signedInStorage({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator' }), theme);
  await pg.goto(ORIGIN + 'datahallAI.html?view=drawing'   /* A1: these laws read the Drawing view */, { waitUntil: 'networkidle2', timeout: 90000 });
  await pg.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
  await wait(800);
  await enterAuthorizedAuditState(pg, 'dc-ai');
  await pg.evaluate(() => { const b = document.querySelector('#tabs [data-t="hall"]'); if (b) b.click(); });
  await wait(2500);
  return pg;
}

/* WCAG contrast of an element's text on the first opaque background behind it */
const PROBE = () => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; const a = b.match(/[\d.]+/g); if (a && (a.length < 4 || Number(a[3]) > 0.9)) return b; } return 'rgb(255,255,255)'; };
  const ratio = (el) => { const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const vis = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 2 && r.height > 2 && !(s.clip === 'rect(0px, 0px, 0px, 0px)') && s.clipPath !== 'inset(50%)'; };
  const P = document.getElementById('p-hall');
  const kpi = P.querySelector('.kpi'), tiles = [...kpi.querySelectorAll(':scope > .k')].filter(vis);
  const rows = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top))).size;
  const nav = P.querySelector('.dh-nav'), ns = getComputedStyle(nav), navR = nav.getBoundingClientRect();
  const chips = [...nav.querySelectorAll('.dh-btn')].map((b) => {
    const r = b.getBoundingClientRect(), lh = parseFloat(getComputedStyle(b).lineHeight) || parseFloat(getComputedStyle(b).fontSize) * 1.3;
    const range = document.createRange(); range.selectNodeContents(b); const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
    return { t: b.textContent.trim(), left: r.left, right: r.right, lines, active: b.classList.contains('active') };
  });
  const scrollable = /auto|scroll/.test(ns.overflowX) && nav.scrollWidth > nav.clientWidth;
  /* visible words of the alarm strip: text nodes whose parent is visible */
  const bar = P.querySelector('.dh-alarmbar'); let visText = '';
  if (bar) { const w = document.createTreeWalker(bar, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (vis(n.parentElement)) visText += ' ' + n.textContent; }
  const name = document.getElementById('dhName');
  return { kpiH: Math.round(kpi.getBoundingClientRect().height), tiles: tiles.length, rows, chips, scrollable, navL: navR.left, navR: navR.right,
    critVisible: (visText.match(/critical/gi) || []).length, srState: bar ? (bar.querySelector('.ab-state') || {}).textContent || '' : '', nameRatio: name ? ratio(name) : 0,
    sx: document.documentElement.scrollWidth, vw: innerWidth };
};

try {
  for (const [w, theme] of [[390, 'dark'], [390, 'light'], [1440, 'dark'], [1440, 'light']]) {
    const tag = `${w}/${theme}`, pg = await open(w, theme);
    const s = await pg.evaluate(PROBE);
    if (w < 500) {
      ok(s.kpiH <= 200, `DH1 ${tag}: KPI strip ${s.kpiH} px tall, want <= 200`);
      ok(s.tiles && s.rows <= Math.ceil(s.tiles / 3), `DH1 ${tag}: ${s.tiles} tiles in ${s.rows} rows, want >= 3 per row`);
    }
    ok(s.chips.length === 8, `DH2 ${tag}: ${s.chips.length} hall chips, want 8`);
    for (const c of s.chips) {
      ok(c.lines === 1, `DH2 ${tag}: chip "${c.t}" wraps over ${c.lines} lines`);
      ok((c.left >= -1 && c.right <= s.vw + 1) || s.scrollable, `DH2 ${tag}: chip "${c.t}" at ${Math.round(c.left)}..${Math.round(c.right)} is off screen and the bar does not scroll`);
    }
    /* pick DH-8, the active chip must end up inside the bar's visible box */
    const pick = await pg.evaluate(async () => {
      const b = [...document.querySelectorAll('#p-hall .dh-nav .dh-btn')].pop(); b.click(); await new Promise((r) => setTimeout(r, 900));
      const a = document.querySelector('#p-hall .dh-nav .dh-btn.active'), n = a.parentElement.getBoundingClientRect(), r = a.getBoundingClientRect();
      return { t: a.textContent.trim(), inside: r.left >= n.left - 1 && r.right <= n.right + 1 && r.right <= innerWidth + 1 };
    });
    ok(pick.t === 'DH-8' && pick.inside, `DH2 ${tag}: after picking DH-8 the active chip "${pick.t}" is not in view`);
    await pg.evaluate(() => { document.querySelector('#p-hall .dh-nav .dh-btn').click(); });
    await wait(600);
    ok(s.critVisible <= 1, `DH3 ${tag}: the alarm strip shows "critical" ${s.critVisible} times`);
    ok(/CRITICAL|WARNING|NORMAL/.test(s.srState), `DH3 ${tag}: the state word "${s.srState}" is gone for assistive technology`);
    ok(s.nameRatio >= 4.5, `DH9 ${tag}: hall title contrast ${s.nameRatio.toFixed(2)}:1, want >= 4.5`);
    const h = await pg.evaluate(async () => {
      for (let i = 0; i < 20 && !/\d/.test((document.getElementById('H00t') || {}).textContent || ''); i++) await new Promise((r) => setTimeout(r, 400));
      const cap = document.getElementById('hallGeomCap'), area = document.querySelector('#hSvg .hp-area');
      const sens = [...document.querySelectorAll('#hSvg .hp-sens text')];
      const rotated = sens.filter((t) => { for (let e = t; e && e.id !== 'hSvg'; e = e.parentElement) if (/rotate/.test(e.getAttribute('transform') || '')) return true; return false; }).length;
      const named = sens.filter((t) => /^TT-(HA|CA)-\d\d-\d/.test((t.closest('[data-tip]') || { getAttribute: () => '' }).getAttribute('data-tip') || '')).length;
      const live = sens.filter((t) => /^\d+(\.\d)?$/.test(t.textContent.trim())).length;
      const old = [...document.querySelectorAll('#hSvg text')].filter((t) => /^(FLOOR |CLOSES)/.test(t.textContent)).length;
      return { capWords: cap ? cap.textContent.trim().split(/\s+/).filter((w) => /\w/.test(w)).length : 99, capTip: cap && cap.parentNode.getAttribute('data-tip') || '',
        area: !!area, areaTip: area ? area.getAttribute('data-tip') : '', sens: sens.length, rotated, named, live, old,
        legend: [...document.querySelectorAll('#hSvg text')].some((t) => /AISLE SENSORS °C/.test(t.textContent)) };
    });
    ok(h.capWords <= 8 && /m clear/.test(h.capTip), `DH4 ${tag}: hall line ${h.capWords} words, tooltip "${h.capTip.slice(0, 40)}"`);
    ok(h.area && /FLOOR/.test(h.areaTip) && /CLOSES/.test(h.areaTip) && h.old === 0, `DH4 ${tag}: area check chip ${h.area}, tooltip "${h.areaTip.slice(0, 30)}", free FLOOR/CLOSES lines ${h.old}`);
    ok(h.sens >= 60 && h.rotated === 0, `DH6 ${tag}: ${h.rotated} of ${h.sens} aisle values rotated`);
    ok(h.named === h.sens && h.live === h.sens && h.legend, `DH6 ${tag}: named ${h.named} / live ${h.live} of ${h.sens}, legend ${h.legend}`);
    /* DH11 keyboard: focus the area chip */
    const kb = await pg.evaluate(async () => { const a = document.querySelector('#hSvg .hp-area'); if (!a) return { shown: false, txt: 'no area chip' }; a.focus(); await new Promise((r) => setTimeout(r, 200)); const t = document.getElementById('floorTip'); const r = { shown: t && t.style.display === 'block', txt: t ? t.textContent : '' }; a.blur(); return r; });
    ok(kb.shown && /CLOSES/.test(kb.txt), `DH11 ${tag}: focus on the area check shows "${kb.txt.slice(0, 40)}" (${kb.shown})`);
    if (w < 500) {
      const box = await pg.evaluate(() => { const g = document.querySelector('#hSvg .hp-sens [data-tip]') || document.querySelector('#hSvg .hp-sens'); g.scrollIntoView({ block: 'center', inline: 'center' }); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await wait(300);
      await pg.touchscreen.tap(box.x, box.y); await wait(300);
      const tp = await pg.evaluate(() => { const t = document.getElementById('floorTip'), r = t.getBoundingClientRect(); return { shown: t && t.style.display === 'block', txt: t ? t.textContent : '', l: r.left, r: r.right }; });
      ok(tp.l >= 0 && tp.r <= w + 1, `DH11 ${tag}: the sensor tooltip spans ${Math.round(tp.l)}..${Math.round(tp.r)} px, outside the window`);
      ok(tp.shown && /^\d+(\.\d)? °C · TT-(HA|CA)-/.test(tp.txt), `DH11 ${tag}: a tap on a sensor shows "${tp.txt.slice(0, 40)}" (${tp.shown})`);
      await pg.evaluate(() => scrollTo(0, 0));
    }
    ok(s.sx <= s.vw + 1, `DH10 ${tag}: page ${s.sx} px wide in a ${s.vw} px window`);
    ok(!pg.errors.length, `DH10 ${tag}: page errors ${pg.errors.slice(0, 2).join(' | ')}`);
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `dh-hall-${theme}-${w}.png`) });
    await pg.close();
  }
} finally { await browser.close(); srv.close(); }

if (fails.length) { console.log(`test-dh-hall: ${fails.length} FAIL of ${checks}`); fails.slice(0, 40).forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`test-dh-hall: ${checks} checks, 0 fail`);
