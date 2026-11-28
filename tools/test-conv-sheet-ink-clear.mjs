#!/usr/bin/env node
/**
 * test-conv-sheet-ink-clear.mjs — text on the five Conventional HMI sheets (fire FS-M-101, chiller CH-M-101 and its
 * condenser view CH-M-102, water WT-M-101, fuel FU-M-101, EPMS E-S-101) is never covered by other text and never struck by a drawn line, measured on
 * the glyph INK and on the line's stroke width.
 *
 * test-conv-sheet-text-clear (C1-C5) measures the em box (getBoundingClientRect of a <text>, inset 0.75 px) against
 * the centre line of pipes, zone borders and FOREIGN symbol outlines. Two things escape it: a line's own stroke width
 * (a 3-unit pipe whose centre passes 1 px under a value still paints over it), and lines it never samples: signal
 * lines, the text's own symbol outline, title-block-free frame lines. The CDU P&ID (v3.117.1, 48 findings) and the
 * equipment Inside drawings (v3.117.3, 20 findings) were both green on em-box checks and red on ink.
 * This gate opens each sheet at 1440 px and checks:
 *
 *   K1  no two visible texts overlap (ink boxes inset by 0.5 px, overlap > 1 px on both axes)
 *   K2  no stroked shape (path, line, polyline, polygon, circle, ellipse, rect) passes through a visible text: each
 *       outline is sampled every 1 user unit and its ink reaches half the stroke width past that centre line; a shape
 *       with stroke none / transparent / width 0 / opacity 0 is not drawn and skipped; the moving-flow overlay
 *       (path.hmi-flow) repeats its pipe's geometry and is skipped; a clipped shape (the specular highlight square of a
 *       bubble, clipped to its circle) paints no outline of its own and is skipped; the run of a pipe or signal (painted
 *       under the symbols) inside an opaque symbol body is hidden by it and not sampled; the title block is its own frame and skipped
 *   K3  every visible text stays inside the drawing's frame
 *   K4  ISA bubble letters, fitted into their circle by rz-hmi-sheet.js, stay at 8.5 px or more (a bubble too small for
 *       its letters is drawn larger, never filled with unreadable letters)
 *
 * Text = every <text> on the sheet with its own text (title block excluded): the text layer, area labels and the
 * words inside symbols (key glyph labels, relay codes) the C-gate leaves out. Ink box =
 * glyph advance extents (getExtentOfChar) x measured ink ascent/descent (canvas measureText, same computed font).
 * RZ_INK_PLANT=1 moves the first value text of each sheet onto the midpoint of its first pipe (K2 must go red on every
 * sheet). RZ_INK_SHOT=<dir> writes one PNG per sheet. Usage: node tools/test-conv-sheet-ink-clear.mjs [--page=fire-system.html]
 */
import puppeteer from 'puppeteer';
import path from 'node:path';
import { serve } from './audit-conv-text.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const only = (process.argv.find((a) => a.startsWith('--page=')) || '').split('=')[1];
const PLANT = process.env.RZ_INK_PLANT === '1';
const SHOT = process.env.RZ_INK_SHOT || '';
const PAGES = [['fire-system.html', 'fire-system', '#fire-sheet-host'], ['chiller-plant.html', 'chiller-plant', '#chw-sheet-host'],
  ['chiller-plant.html', 'chiller-plant', '#chw-sheet-host', 'cdw'],
  ['water-system.html', 'water-system', '#water-sheet-host'], ['fuel-system.html', 'fuel-system', '#fuel-sheet-host'],
  ['EPMS_Telemetry.html', 'epms', '#epms-sheet-host']].filter(([p]) => !only || p === only);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function probe(hostSel, plant) {
  const host = document.querySelector(hostSel); if (!host) return { missing: true };
  const svg = host.querySelector('svg.hmi-svg') || host.querySelector('svg'); if (!svg) return { missing: true };
  const vis = (e) => { for (let x = e; x && x !== svg.parentElement; x = x.parentElement) { const cs = getComputedStyle(x);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const own = (t) => [...t.childNodes].map((n) => (n.nodeType === 3 ? n.nodeValue : n.nodeName === 'tspan' ? n.textContent : '')).join('').trim();
  if (plant) {   /* self-test: the first value text onto the midpoint of the first pipe */
    const t = svg.querySelector('g.hmi-text text[data-val]'), e = svg.querySelector('g.hmi-edges > path.hmi-edge:not(.hmi-flow)');
    if (t && e) { const p = e.getPointAtLength(e.getTotalLength() / 2);
      const q = new DOMPoint(p.x, p.y).matrixTransform(e.getScreenCTM()).matrixTransform(t.parentNode.getScreenCTM().inverse());
      t.setAttribute('x', q.x); t.setAttribute('y', q.y + 3); t.setAttribute('text-anchor', 'middle'); t.removeAttribute('transform');
      t.removeAttribute('dx'); t.removeAttribute('dy'); }
  }
  const ctx = document.createElement('canvas').getContext('2d');
  const texts = [...svg.querySelectorAll('text')]
    .filter((t) => !t.closest('[data-role="titleblock"]') && own(t) && vis(t) && t.getNumberOfChars() > 0).map((t) => {
      const cs = getComputedStyle(t), n = t.getNumberOfChars(), m = t.getScreenCTM();
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const mt = ctx.measureText(own(t)), asc = mt.actualBoundingBoxAscent, desc = mt.actualBoundingBoxDescent;
      let ux0 = Infinity, ux1 = -Infinity, uy0 = Infinity, uy1 = -Infinity;
      for (let i = 0; i < n; i++) { const e = t.getExtentOfChar(i), p = t.getStartPositionOfChar(i);
        ux0 = Math.min(ux0, e.x); ux1 = Math.max(ux1, e.x + e.width); uy0 = Math.min(uy0, p.y - asc); uy1 = Math.max(uy1, p.y + desc); }
      const xs = [], ys = [];
      for (const [x, y] of [[ux0, uy0], [ux1, uy0], [ux0, uy1], [ux1, uy1]]) { xs.push(m.a * x + m.c * y + m.e); ys.push(m.b * x + m.d * y + m.f); }
      const r = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
      const who = t.getAttribute('data-tag-of') || t.getAttribute('data-val') || t.getAttribute('data-role') || '';
      return { t, s: own(t).slice(0, 28) + (who ? ' [' + who + ']' : ''), x0: r.left + 0.5, y0: r.top + 0.5, x1: r.right - 0.5, y1: r.bottom - 0.5, r };
    });
  const k1 = [], k2 = [], k3 = [];
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w > 1 && h > 1) k1.push(`"${a.s}" × "${b.s}"`);
  }
  const clear = (c) => c === 'none' || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  /* a pipe or signal is painted under the symbols: the run of it inside an opaque symbol body (a bubble's filled circle)
     is hidden by that body and strikes nothing */
  const bodies = [...svg.querySelectorAll('g.hmi-nodes .hmi-node .b')].filter((b) => vis(b) && !clear(getComputedStyle(b).fill) && +getComputedStyle(b).fillOpacity > 0.9)
    .map((b) => { const r = b.getBoundingClientRect(); return b.tagName === 'circle' ? { c: [(r.left + r.right) / 2, (r.top + r.bottom) / 2], rr: r.width / 2 } : { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  const hidden = (x, y) => bodies.some((o) => (o.c ? Math.hypot(x - o.c[0], y - o.c[1]) < o.rr - 0.5 : x > o.l + 0.5 && x < o.r - 0.5 && y > o.t + 0.5 && y < o.b - 0.5));
  let shapes = 0; const fr0 = svg.getBoundingClientRect();
  for (const g of svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect')) {
    if (g.closest('text') || g.closest('[data-role="titleblock"]') || g.classList.contains('hmi-flow') || g.hasAttribute('clip-path') || !vis(g) || typeof g.getTotalLength !== 'function') continue;
    const cs = getComputedStyle(g);
    if (clear(cs.stroke) || !(parseFloat(cs.strokeWidth) > 0) || +cs.strokeOpacity === 0) continue;
    const m = g.getScreenCTM(); if (!m) continue;
    let L = 0; try { L = g.getTotalLength(); } catch (e) { continue; }
    shapes++;
    const hw = parseFloat(cs.strokeWidth) / 2 * Math.hypot(m.a, m.b);
    const bb = g.getBoundingClientRect();
    const near = texts.filter((b) => b.x1 > bb.left - hw && b.x0 < bb.right + hw && b.y1 > bb.top - hw && b.y0 < bb.bottom + hw);
    if (!near.length) continue;
    const pts = [];
    const under = !!g.closest('g.hmi-edges, g.hmi-lines');
    for (let s = 0; s <= L; s += 1) { const p = g.getPointAtLength(s); const v = [m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]; if (!(under && hidden(v[0], v[1]))) pts.push(v); }
    const node = g.closest('[data-node]'), edge = g.getAttribute('data-edge');
    const who = g.tagName + (g.getAttribute('class') ? '.' + g.getAttribute('class').split(' ')[0] : '') +
      (edge ? ' edge ' + edge : node ? ' of ' + node.getAttribute('data-node') : '');
    for (const b of near) if (pts.some(([x, y]) => x > b.x0 - hw && x < b.x1 + hw && y > b.y0 - hw && y < b.y1 + hw)) k2.push(`"${b.s}" struck by ${who} @${Math.round(b.r.left - fr0.left)},${Math.round(b.r.top - fr0.top)}`);
  }
  const fr = svg.getBoundingClientRect();
  /* K4: rz-hmi-sheet shrinks bubble letters that do not fit their circle; never below the 8.5 px sheet base */
  const k4 = [...svg.querySelectorAll('.hmi-node > text[data-role="inst"]')].filter(vis)
    .map((t) => [t, parseFloat(getComputedStyle(t).fontSize)]).filter(([, f]) => f < 8.45)
    .map(([t, f]) => `"${t.textContent}" of ${t.parentNode.getAttribute('data-node')} at ${f} px`);
  for (const b of texts) if (b.r.left < fr.left - 0.5 || b.r.right > fr.right + 0.5 || b.r.top < fr.top - 0.5 || b.r.bottom > fr.bottom + 0.5) k3.push(`"${b.s}" outside the frame`);
  return { n: texts.length, shapes, k1: [...new Set(k1)], k2: [...new Set(k2)], k3, k4 };
}

const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port + '/';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let bad = 0;
try {
  for (const [pageName, key, host, view] of PAGES) {
    const page = pageName, T = pageName + (view ? ' (' + view + ' view)' : '');
    const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.setViewport({ width: 1440, height: 1000, deviceScaleFactor: SHOT ? 2 : 1 });
    await primeCockpitAuditDocument(pg, 'dark');
    await pg.goto(base + page, { waitUntil: 'load', timeout: 90000 });
    await enterAuthorizedAuditState(pg, key);
    await pg.waitForFunction((h) => { const s = document.querySelector(h + ' svg'); return s && s.getBoundingClientRect().width > 0 && s.querySelector('.hmi-node'); }, { timeout: 30000 }, host).catch(() => {});
    await sleep(1500);
    if (view === 'cdw') {   /* CH-M-102, the condenser-water view of the same host */
      await pg.evaluate(() => { const b = [...document.querySelectorAll('button,[role=tab]')].find((x) => /condenser|cdw/i.test(x.textContent) && x.offsetParent); if (b) b.click(); });
      await sleep(1500);
    }
    const g = await pg.evaluate(probe, host, PLANT);
    if (SHOT) { const el = await pg.$(host + ' svg'); if (el) await el.screenshot({ path: path.join(SHOT, 'ink-' + key + (view ? '-' + view : '') + '.png') }); }
    if (g.missing) { console.log(`FAIL ${T}: sheet ${host} not drawn`); bad++; await pg.close(); continue; }
    const f = [...g.k1.map((x) => 'K1 ' + x), ...g.k2.map((x) => 'K2 ' + x), ...g.k3.map((x) => 'K3 ' + x), ...g.k4.map((x) => 'K4 ' + x)];
    f.forEach((x) => console.log(`FAIL ${T} ${x}`)); bad += f.length;
    if (g.n < 5 || g.shapes < 5) { console.log(`FAIL ${T}: measured ${g.n} texts / ${g.shapes} shapes — the probe saw no sheet`); bad++; }
    if (errs.length) { console.log(`FAIL ${T}: page error ${errs[0].slice(0, 160)}`); bad++; }
    console.log(`${f.length ? 'FAIL' : 'PASS'} ${T}: ${g.n} texts, ${g.shapes} stroked shapes, ${g.k1.length} overlaps, ${g.k2.length} struck, ${g.k3.length} outside, ${g.k4.length} bubble letters under 8.5 px`);
    await pg.close();
  }
} finally { await browser.close(); srv.close(); }
console.log(bad ? `CONV SHEET INK CLEAR — ${bad} failure(s)${PLANT ? ' (planted)' : ''}` : `CONV SHEET INK CLEAR — all ${PAGES.length} sheet views clear`);
process.exit(bad ? 1 : 0);
