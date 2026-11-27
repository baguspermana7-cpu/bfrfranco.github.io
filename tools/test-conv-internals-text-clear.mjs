#!/usr/bin/env node
/**
 * test-conv-internals-text-clear.mjs — text on every equipment "Inside" drawing of the Conventional cockpits
 * (js/conv/internals/*.js, drawn in the equipment modal) is never covered by other text and never struck by a drawn
 * line, measured on the glyph INK, not the em box.
 *
 * The internals gates each carry a text check (render I8, P3-5, EL5, EB6), but on the em box
 * (getBoundingClientRect of a <text>) and against pipe edges only: a signal line, a symbol outline (tank shell,
 * pump casing, breaker frame) or a line's own stroke width through a label was never measured. The CDU P&ID gate
 * (v3.117.1) showed what that blind spot hides: 48 findings on a drawing whose own checks were green.
 * This gate opens, at 1440 px, one unit of each internals class and checks its drawing:
 *
 *   N1  no two visible texts overlap (ink boxes inset by 0.5 px, overlap > 1 px on both axes)
 *   N2  no stroked shape (path, line, polyline, polygon, circle, ellipse, rect) passes through a visible text: each
 *       outline is sampled every 1 user unit and its ink reaches half the stroke width past that centre line; a shape
 *       with stroke none / transparent / width 0 / opacity 0 is not drawn and skipped
 *   N3  every visible text stays inside the drawing's frame
 *
 * Cases (page, sheet host, node, class): chiller-plant ch1 chiller, ps1 chw_secondary_pump, crahA crah, cp1 cdw_pump,
 * ct1 tower_cell (CDW view); fuel-system gen1 genset; EPMS tx1 hv_tx, da-tx dist_tx, fa4-cb breaker, fa1-r relay
 * (single line), ua-rec ups (LV view).
 * RZ_INT_TEXT_PLANT=1 moves the first value text of each drawing onto the midpoint of the first drawn edge (N2 must go
 * red on every case). RZ_INT_SHOT=<dir> writes one PNG per case.
 * Usage: node tools/test-conv-internals-text-clear.mjs [--case=ch1]
 */
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './audit-conv-text.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const only = (process.argv.find((a) => a.startsWith('--case=')) || '').split('=')[1];
const PLANT = process.env.RZ_INT_TEXT_PLANT === '1';
const SHOT = process.env.RZ_INT_SHOT || '';
const CASES = [
  ['chiller-plant.html', 'chiller-plant', '#chw-sheet-host', 'ch1', 'chiller', null],
  ['chiller-plant.html', 'chiller-plant', '#chw-sheet-host', 'ps1', 'chw_secondary_pump', null],
  ['chiller-plant.html', 'chiller-plant', '#chw-sheet-host', 'crahA', 'crah', null],
  ['chiller-plant.html', 'chiller-plant', '#chw-sheet-host', 'cp1', 'cdw_pump', 'cdw'],
  ['chiller-plant.html', 'chiller-plant', '#chw-sheet-host', 'ct1', 'tower_cell', 'cdw'],
  ['fuel-system.html', 'fuel-system', '#fuel-sheet-host', 'gen1', 'genset', null],
  ['EPMS_Telemetry.html', 'epms', '#epms-sheet-host', 'tx1', 'hv_tx', null],
  ['EPMS_Telemetry.html', 'epms', '#epms-sheet-host', 'da-tx', 'dist_tx', null],
  ['EPMS_Telemetry.html', 'epms', '#epms-sheet-host', 'fa4-cb', 'breaker', null],
  ['EPMS_Telemetry.html', 'epms', '#epms-sheet-host', 'fa1-r', 'relay', null],
  ['EPMS_Telemetry.html', 'epms', '#epms-lv-host', 'ua-rec', 'ups', 'lv'],
].filter((c) => !only || c[3] === only);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function probe(plant) {
  const svg = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-int] svg.hmi-svg'); if (!svg) return { missing: true };
  const vis = (e) => { for (let x = e; x && x !== svg.parentElement; x = x.parentElement) { const cs = getComputedStyle(x);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const own = (t) => [...t.childNodes].map((n) => (n.nodeType === 3 ? n.nodeValue : n.nodeName === 'tspan' ? n.textContent : '')).join('').trim();
  if (plant) {   /* self-test: the first value text onto the midpoint of the first drawn edge */
    const t = svg.querySelector('[data-val]'), e = svg.querySelector('path.hmi-edge');
    if (t && e) { const p = e.getPointAtLength(e.getTotalLength() / 2);
      const q = new DOMPoint(p.x, p.y).matrixTransform(e.getScreenCTM()).matrixTransform(t.parentNode.getScreenCTM().inverse());
      t.setAttribute('x', q.x); t.setAttribute('y', q.y + 3); t.setAttribute('text-anchor', 'middle'); t.removeAttribute('transform');
      t.removeAttribute('dx'); t.removeAttribute('dy'); }
  }
  /* the INK box (see test-cdu-pid-text-clear.mjs): glyph advance extents x measured ink ascent/descent around the baseline */
  const ctx = document.createElement('canvas').getContext('2d');
  const texts = [...svg.querySelectorAll('text')].filter((t) => own(t) && vis(t) && t.getNumberOfChars() > 0).map((t) => {
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
  const n1 = [], n2 = [], n3 = [];
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w > 1 && h > 1) n1.push(`"${a.s}" × "${b.s}"`);
  }
  const clear = (c) => c === 'none' || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  for (const g of svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect')) {
    if (g.closest('text') || !vis(g) || typeof g.getTotalLength !== 'function') continue;
    const cs = getComputedStyle(g);
    if (clear(cs.stroke) || !(parseFloat(cs.strokeWidth) > 0) || +cs.strokeOpacity === 0) continue;
    const m = g.getScreenCTM(); if (!m) continue;
    let L = 0; try { L = g.getTotalLength(); } catch (e) { continue; }
    const hw = parseFloat(cs.strokeWidth) / 2 * Math.hypot(m.a, m.b);
    const pts = [];
    for (let s = 0; s <= L; s += 1) { const p = g.getPointAtLength(s); pts.push([m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]); }
    const node = g.closest('[data-node]'), edge = g.getAttribute('data-edge');
    const who = g.tagName + (g.getAttribute('class') ? '.' + g.getAttribute('class').split(' ')[0] : '') +
      (edge ? ' edge ' + edge : node ? ' of ' + node.getAttribute('data-node') : '');
    for (const b of texts) if (pts.some(([x, y]) => x > b.x0 - hw && x < b.x1 + hw && y > b.y0 - hw && y < b.y1 + hw)) n2.push(`"${b.s}" struck by ${who}`);
  }
  const fr = svg.getBoundingClientRect();
  for (const b of texts) if (b.r.left < fr.left - 0.5 || b.r.right > fr.right + 0.5 || b.r.top < fr.top - 0.5 || b.r.bottom > fr.bottom + 0.5) n3.push(`"${b.s}" outside the frame`);
  return { n: texts.length, n1: [...new Set(n1)], n2: [...new Set(n2)], n3 };
}

const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port + '/';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let bad = 0;
try {
  for (const [page, key, host, id, cls, view] of CASES) {
    const T = id + ' (' + cls + ')';
    const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.setViewport({ width: 1440, height: 1000, deviceScaleFactor: SHOT ? 2 : 1 });
    await primeCockpitAuditDocument(pg, 'dark');
    await pg.goto(base + page, { waitUntil: 'load', timeout: 90000 });
    await enterAuthorizedAuditState(pg, key);
    if (view === 'lv') await pg.evaluate(() => { const b = document.querySelector('.epms-view-btn[data-epms-view="lv"]'); if (b) b.click(); });
    await pg.waitForFunction((h) => document.querySelector(h + ' .hmi-node'), { timeout: 30000 }, host).catch(() => {});
    await sleep(1200);
    if (view === 'cdw') { await pg.evaluate(() => { const b = [...document.querySelectorAll('button,[role=tab]')].find((x) => /condenser|cdw/i.test(x.textContent) && x.offsetParent); if (b) b.click(); }); await sleep(1200); }
    const pt = await pg.evaluate((h, id) => { const g = document.querySelector(h + ' .hmi-node[data-node="' + id + '"]'); if (!g) return null;
      g.scrollIntoView({ block: 'center', inline: 'center' }); const r = (g.querySelector('.b') || g).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, host, id);
    if (!pt) { console.log(`FAIL ${T}: symbol ${id} not found on ${page}`); bad++; await pg.close(); continue; }
    await pg.mouse.click(pt.x, pt.y); await sleep(1000);
    if (!(await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-int] svg.hmi-svg')))) { await pg.mouse.click(pt.x, pt.y, { clickCount: 2 }); await sleep(1000); }
    const g = await pg.evaluate(probe, PLANT);
    if (SHOT) { const el = await pg.$('.rz-cvm:not([hidden]) [data-rz-cvm-int] svg.hmi-svg'); if (el) await el.screenshot({ path: path.join(SHOT, 'int-' + id + '.png') }); }
    if (g.missing) { console.log(`FAIL ${T}: no internal drawing opened`); bad++; await pg.close(); continue; }
    const f = [...g.n1.map((x) => 'N1 ' + x), ...g.n2.map((x) => 'N2 ' + x), ...g.n3.map((x) => 'N3 ' + x)];
    f.forEach((x) => console.log(`FAIL ${T} ${x}`)); bad += f.length;
    if (g.n < 3) { console.log(`FAIL ${T}: only ${g.n} texts measured — the probe saw no drawing`); bad++; }
    if (errs.length) { console.log(`FAIL ${T}: page error ${errs[0].slice(0, 160)}`); bad++; }
    console.log(`${f.length ? 'FAIL' : 'PASS'} ${T}: ${g.n} texts, ${g.n1.length} overlaps, ${g.n2.length} struck, ${g.n3.length} outside`);
    await pg.close();
  }
} finally { await browser.close(); srv.close(); }
console.log(bad ? `CONV INTERNALS TEXT CLEAR — ${bad} failure(s)${PLANT ? ' (planted)' : ''}` : `CONV INTERNALS TEXT CLEAR — all ${CASES.length} drawings clear`);
process.exit(bad ? 1 : 0);
