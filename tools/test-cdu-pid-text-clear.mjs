#!/usr/bin/env node
/**
 * test-cdu-pid-text-clear.mjs — text on the hand-drawn CDU P&ID (cdu-mini-bms.html, #pidBox) is never covered by other
 * text and never struck by a drawn line, on every CDU type.
 *
 * test-conv-sheet-text-clear covers the five rz-hmi-sheet drawings only (fire, chiller, water, fuel, EPMS). The CDU P&ID
 * is drawn by the page's own string builder and redrawn per CDU type, so nothing measured it: v3.116.2 found, on a
 * screenshot only, "→ room air" lying over the MV-01 tag and "makeup" over MV-01's own tag on the L2A type.
 * This gate opens the page at 1440 px and, for each of the 5 types (inrack, inrow, sidecar, l2l, l2a), on the P&ID and
 * (since v3.117.7) on the plan view of the row (#layoutBox):
 *
 *   X1  no two visible texts overlap (ink boxes inset by 0.5 px, overlap > 1 px on both axes)
 *   X2  no stroked outline (path, line, polyline, polygon, circle, ellipse, rect) passes through a visible text box:
 *       each outline is sampled every 1 user unit and its ink reaches half the stroke width past that centre line; a shape with stroke none / width 0 / opacity 0 is not drawn and skipped
 *   X3  every visible text stays inside the drawing's viewBox (nothing clipped at the frame)
 *   X4  at 390 px the layout and the P&ID keep every label at 8.5 px or more (their legibility floor); a drawing wider than
 *       its panel pans by drag to its right edge; the page does not scroll sideways (v3.117.7, UIUX ledger row 26)
 *
 * Text = every <text> in the P&ID with its own text (child <title> tooltips are not text on the drawing); its box is the
 * INK box (glyph advances x measured ink ascent/descent), not the em box. RZ_CDU_SHOT=<dir> writes one PNG per type.
 * Proven red on b9cd070ed (v3.117.0, before the fixes): 48 findings, 8-10 per type, among them HV-03 and T-01 EXP struck by the
 * TCS supply pipe, "E-01 PLATE HX" by its own plate lines, "HX approach" by the TCS return, "AIR COIL + FANS" by the
 * TIC-01 signal, "supply" over HV-01's tag, and P-01A's tag by the suction header (found once stroke width counted).
 * RZ_CDU_TEXT_PLANT=1 puts the HV-03 tag back on the riser and removes the P&ID floor (X4).
 * Usage: node tools/test-cdu-pid-text-clear.mjs [--type=l2a]
 */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const only = (process.argv.find((a) => a.startsWith('--type=')) || '').split('=')[1];
const TYPES = ['inrack', 'inrow', 'sidecar', 'l2l', 'l2a'].filter((t) => !only || t === only);
const PLANT = process.env.RZ_CDU_TEXT_PLANT === '1';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    /* the plant: the HV-03 tag back at its pre-v3.117.1 spot, centred over its valve on the supply riser (x 388) */
    if (PLANT && p.endsWith('cdu-mini-bms.html')) { const a = 'x="379" y="88.5" text-anchor="end">HV-03', b = '#pidBox{ min-width:680px; }', t = String(d);
      if (!t.includes(a) || !t.includes(b)) { console.log('FAIL the plant no longer matches the page'); process.exit(1); }
      d = Buffer.from(t.replace(a, 'x="388" y="81" text-anchor="middle">HV-03').replace(b, '')); }   /* and X4: the P&ID's legibility floor removed */
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d);
  });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

function probe(boxSel) {
  const svg = document.querySelector((boxSel || '#pidBox') + ' svg'); if (!svg) return { missing: true };
  svg.scrollIntoView({ block: 'center' });
  const vis = (e) => { for (let x = e; x && x !== svg.parentElement; x = x.parentElement) { const cs = getComputedStyle(x);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const own = (t) => [...t.childNodes].map((n) => (n.nodeType === 3 ? n.nodeValue : n.nodeName === 'tspan' ? n.textContent : '')).join('').trim();
  /* the INK box, not the em box: getBoundingClientRect of a <text> spans the font's full ascent + descent, so a bubble's
     divider line 2 units under "TIC" counted as striking it. Each glyph run: advance extents horizontally, the measured
     ink ascent / descent of its own string (canvas measureText, same computed font, user units) around its baseline */
  const ctx = document.createElement('canvas').getContext('2d');
  const texts = [...svg.querySelectorAll('text')].filter((t) => own(t) && vis(t)).map((t) => {
    const cs = getComputedStyle(t), n = t.getNumberOfChars(), m = t.getScreenCTM();
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const mt = ctx.measureText(own(t)), asc = mt.actualBoundingBoxAscent, desc = mt.actualBoundingBoxDescent;
    let ux0 = Infinity, ux1 = -Infinity, uy0 = Infinity, uy1 = -Infinity;
    for (let i = 0; i < n; i++) { const e = t.getExtentOfChar(i), p = t.getStartPositionOfChar(i);
      ux0 = Math.min(ux0, e.x); ux1 = Math.max(ux1, e.x + e.width); uy0 = Math.min(uy0, p.y - asc); uy1 = Math.max(uy1, p.y + desc); }
    const xs = [], ys = [];
    for (const [x, y] of [[ux0, uy0], [ux1, uy0], [ux0, uy1], [ux1, uy1]]) { xs.push(m.a * x + m.c * y + m.e); ys.push(m.b * x + m.d * y + m.f); }
    const r = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
    return { t, s: own(t).slice(0, 28), x0: r.left + 0.5, y0: r.top + 0.5, x1: r.right - 0.5, y1: r.bottom - 0.5, r };
  });
  const x1 = [], x2 = [], x3 = [];
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w > 1 && h > 1) x1.push(`"${a.s}" × "${b.s}"`);
  }
  const inside = (b, x, y) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
  for (const g of svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect')) {
    if (g.closest('text') || !vis(g) || typeof g.getTotalLength !== 'function') continue;
    const cs = getComputedStyle(g);
    if (cs.stroke === 'none' || !(parseFloat(cs.strokeWidth) > 0) || +cs.strokeOpacity === 0) continue;
    const m = g.getScreenCTM(); if (!m) continue;
    let L = 0; try { L = g.getTotalLength(); } catch (e) { continue; }
    const pts = [];
    for (let s = 0; s <= L; s += 1) { const p = g.getPointAtLength(s); pts.push([m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]); }
    const who = g.tagName + (g.getAttribute('class') ? '.' + g.getAttribute('class').split(' ')[0] : '') +
      ((g.closest('[data-tag]') && ' in ' + g.closest('[data-tag]').getAttribute('data-tag')) || (g.closest('[data-loop]') && ' in ' + g.closest('[data-loop]').getAttribute('data-loop')) || '');
    /* a stroke has width: the line's ink reaches half its stroke width (in screen px) past the sampled centre line */
    const hw = parseFloat(cs.strokeWidth) / 2 * Math.hypot(m.a, m.b);
    const near = (bx, x, y) => x > bx.x0 - hw && x < bx.x1 + hw && y > bx.y0 - hw && y < bx.y1 + hw;
    for (const b of texts) if (pts.some(([x, y]) => near(b, x, y))) x2.push(`"${b.s}" struck by ${who}`);
  }
  const fr = svg.getBoundingClientRect();
  for (const b of texts) if (b.r.left < fr.left - 0.5 || b.r.right > fr.right + 0.5 || b.r.top < fr.top - 0.5 || b.r.bottom > fr.bottom + 0.5) x3.push(`"${b.s}" outside the frame`);
  return { n: texts.length, x1: [...new Set(x1)], x2: [...new Set(x2)], x3 };
}

let bad = 0;
const pg = await browser.newPage(), errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.setViewport({ width: 1440, height: 900, deviceScaleFactor: process.env.RZ_CDU_SHOT ? 3 : 1 }); await primeCockpitAuditDocument(pg, 'dark');
await pg.goto(ORIGIN + 'cdu-mini-bms.html', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 2000));
for (const type of TYPES) {
  await pg.evaluate((t) => { const b = document.querySelector('button[data-type="' + t + '"]'); if (b) b.click(); }, type);
  await new Promise((r) => setTimeout(r, 800));
  const g = await pg.evaluate(probe);
  if (process.env.RZ_CDU_SHOT) {   /* the cockpit bar and control strip are sticky: hide them for the shot so none lies over the drawing */
    await pg.evaluate(() => document.querySelectorAll('body *').forEach((e) => { const p = getComputedStyle(e).position;
      if ((p === 'sticky' || p === 'fixed') && !e.contains(document.querySelector('#pidBox'))) e.setAttribute('data-shot-hide', e.style.visibility || '-'), e.style.visibility = 'hidden'; }));
    const el = await pg.$('#pidBox svg'); if (el) await el.screenshot({ path: path.join(process.env.RZ_CDU_SHOT, 'cdu-pid-' + type + '.png') });
    await pg.evaluate(() => document.querySelectorAll('[data-shot-hide]').forEach((e) => { const v = e.getAttribute('data-shot-hide'); e.style.visibility = v === '-' ? '' : v; e.removeAttribute('data-shot-hide'); }));
  }
  if (g.missing) { console.log(`FAIL ${type}: no P&ID svg in #pidBox`); bad++; continue; }
  const f = [...g.x1.map((x) => 'X1 ' + x), ...g.x2.map((x) => 'X2 ' + x), ...g.x3.map((x) => 'X3 ' + x)];
  f.forEach((x) => console.log(`FAIL ${type} ${x}`)); bad += f.length;
  console.log(`${f.length ? 'FAIL' : 'PASS'} ${type}: ${g.n} texts, ${g.x1.length} overlaps, ${g.x2.length} struck, ${g.x3.length} outside`);
  /* the plan view of the row (#layoutBox) is redrawn per type too, and is held to the same X1-X3 (v3.117.7) */
  const l = await pg.evaluate(probe, '#layoutBox');
  if (l.missing) { console.log(`FAIL ${type} plan: no svg in #layoutBox`); bad++; continue; }
  const lf = [...l.x1.map((x) => 'X1 ' + x), ...l.x2.map((x) => 'X2 ' + x), ...l.x3.map((x) => 'X3 ' + x)];
  lf.forEach((x) => console.log(`FAIL ${type} plan ${x}`)); bad += lf.length;
  console.log(`${lf.length ? 'FAIL' : 'PASS'} ${type} plan: ${l.n} texts, ${l.x1.length} overlaps, ${l.x2.length} struck, ${l.x3.length} outside`);
}
/* X4 — phone (390 px): both drawings keep every label at 8.5 px or more; one wider than its panel pans by a real drag until
   its right edge is in view; the page itself never scrolls sideways */
if (!only) {
  const ph = await browser.newPage(); ph.on('pageerror', (e) => errs.push(e.message));
  await ph.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 }); await primeCockpitAuditDocument(ph, 'dark');
  await ph.goto(ORIGIN + 'cdu-mini-bms.html', { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2000));
  for (const sel of ['#layoutBox', '#pidBox']) {
    /* the page scrolls smoothly: jump, then let it settle, or the drag lands off screen */
    await ph.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
    await new Promise((r) => setTimeout(r, 400));
    const m = () => ph.evaluate((s) => { const b = document.querySelector(s), v = b.querySelector('svg'), r = v.getBoundingClientRect(), p = b.parentNode.getBoundingClientRect();
      const k = r.width / v.viewBox.baseVal.width;
      const fs = [...v.querySelectorAll('text')].filter((t) => t.textContent.trim()).map((t) => [parseFloat(getComputedStyle(t).fontSize) * k, t.textContent.trim().slice(0, 20)]).sort((a, c) => a[0] - c[0])[0];
      if (p.top > innerHeight - 40 || p.bottom < 40) return { off: true };
      const cs = getComputedStyle(b.parentNode);   /* the panel body's CONTENT box: its padding is not drawing room, and overflow clips at the padding edge */
      return { min: fs[0], who: fs[1], left: r.left, right: r.right, pl: p.left + parseFloat(cs.paddingLeft), pr: p.right - parseFloat(cs.paddingRight), cy: Math.max(p.top + 20, Math.min(p.bottom - 20, innerHeight / 2)), sx: document.documentElement.scrollWidth - innerWidth }; }, sel);
    const a = await m(), f = [];
    if (a.off) { console.log(`FAIL X4 phone ${sel}: the drawing is not on screen, nothing measured`); bad++; continue; }
    if (a.min < 8.45) f.push(`smallest label "${a.who}" renders at ${a.min.toFixed(1)} px (floor 8.5)`);
    if (a.sx > 1) f.push(`the page scrolls sideways by ${a.sx} px`);
    if (a.right > a.pr + 1) {   /* wider than its panel: drag left twice, the right edge must arrive */
      for (let i = 0; i < 3; i++) { await ph.mouse.move(a.pr - 30, a.cy); await ph.mouse.down(); await ph.mouse.move(a.pl + 20, a.cy, { steps: 8 }); await ph.mouse.up(); }
      const z = await m(); if (z.right > z.pr + 1.5) f.push(`drag does not bring the right edge into view (${Math.round(z.right - z.pr)} px still hidden)`);
      if (z.left > z.pl + 1.5) f.push('the drawing left its panel on the left side');
    }
    f.forEach((x) => console.log(`FAIL X4 phone ${sel}: ${x}`)); bad += f.length;
    console.log(`${f.length ? 'FAIL' : 'PASS'} phone ${sel}: smallest label ${a.min.toFixed(1)} px, ${a.right > a.pr + 1 ? 'pans to its right edge' : 'fits its panel'}`);
  }
  await ph.close();
}
if (errs.length) { console.log('FAIL page errors: ' + errs.slice(0, 3).join(' | ')); bad++; }
await browser.close(); srv.close();
console.log(bad ? `CDU P&ID TEXT CLEAR — ${bad} failure(s)${PLANT ? ' (planted)' : ''}` : `CDU P&ID TEXT CLEAR — all ${TYPES.length} types clear`);
process.exit(bad ? 1 : 0);
