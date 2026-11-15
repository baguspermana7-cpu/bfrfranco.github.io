#!/usr/bin/env node
/**
 * test-conv-sheet-text-clear.mjs — text on the Conventional HMI sheets is never struck by a line or hidden by a body.
 *
 * The geometry gate (test-conv-geometry) checks text against text only. W3 (v3.62.0) found three defects it could not
 * see, each on a screenshot: TK-402 values across a zone divider, PT-101's value cut by a divider, UST-01's tag struck
 * by its own fill pipe, and the domestic tank body covering the DOMESTIC tag. This gate measures them in the browser
 * at 1440 px on each sheet (fire FS-M-101, chiller CH-M-101, water WT-M-101, fuel FU-M-101):
 *
 *   C1  no visible sheet text has a pipe/cable (path.hmi-edge, not the flow overlay) running through its box
 *   C2  no visible sheet text is crossed by a zone or box border (rect.hmi-zone / rect.hmi-box)
 *   C3  no visible sheet text is covered by the body (.b) of an equipment symbol it does not belong to
 *   C4  the page itself never scrolls sideways at 1280 or 1440 px: the sheet's own floor width scrolls inside its panel
 *       (v3.62: the water P&ID panel, a grid item without min-width 0, widened the page by 368 px at 1280)
 *
 * Text = every <text> in the sheet's text layer plus area labels; the title block is excluded (it is its own frame).
 * A text box is its screen rectangle inset by 0.75 px; a line "runs through" it when a point sampled every 1 user
 * unit along the line lies inside. Proven red on b1b885089 (the W3 tree before the fixes): C1 UST-01 tag, C2 TK-402 and
 * PT-101 values, C3 DOMESTIC tag. Usage: node tools/test-conv-sheet-text-clear.mjs [--page=water-system.html]
 */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const only = (process.argv.find((a) => a.startsWith('--page=')) || '').split('=')[1];
const PAGES = [['fire-system.html', '#fire-sheet-host'], ['chiller-plant.html', '#chw-sheet-host'],
  ['water-system.html', '#water-sheet-host'], ['fuel-system.html', '#fuel-sheet-host']].filter(([p]) => !only || p === only);
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

function probe(hostSel) {
  const host = document.querySelector(hostSel); if (!host) return { missing: true };
  host.scrollIntoView({ block: 'start' });
  const svg = host.querySelector('svg.hmi-svg') || host.querySelector('svg'); if (!svg) return { missing: true };
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let x = e; x && x !== svg; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const label = (t) => (t.getAttribute('data-tag-of') || t.getAttribute('data-val') || t.getAttribute('data-role') || 'text') + ' "' + t.textContent.trim().slice(0, 24) + '"';
  const texts = [...svg.querySelectorAll('g.hmi-text text, text.hmi-area-label')].filter((t) => !t.closest('[data-role="titleblock"]') && t.textContent.trim() && vis(t))
    .map((t) => { const r = t.getBoundingClientRect(); return { t, x0: r.left + 0.75, y0: r.top + 0.75, x1: r.right - 0.75, y1: r.bottom - 0.75,
      owner: t.getAttribute('data-tag-of') || (t.getAttribute('data-val') || '').split(':')[0] || null }; });
  const inside = (b, x, y) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
  const c1 = [], c2 = [], c3 = [];
  // C1 pipes / cables
  const edges = [...svg.querySelectorAll('g.hmi-edges > path.hmi-edge:not(.hmi-flow)')].filter(vis);
  for (const e of edges) {
    const m = e.getScreenCTM(); if (!m) continue; const L = e.getTotalLength(); const pts = [];
    for (let s = 0; s <= L; s += 1) { const p = e.getPointAtLength(s); pts.push([m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]); }
    for (const b of texts) if (pts.some(([x, y]) => inside(b, x, y))) c1.push(label(b.t) + ' × edge ' + (e.getAttribute('data-edge') || '?'));
  }
  // C2 zone / box borders
  for (const z of [...svg.querySelectorAll('g.hmi-areas rect.hmi-zone, g.hmi-areas rect.hmi-box')].filter(vis)) {
    const r = z.getBoundingClientRect();
    const segs = [[r.left, r.top, r.right, r.top], [r.right, r.top, r.right, r.bottom], [r.left, r.bottom, r.right, r.bottom], [r.left, r.top, r.left, r.bottom]];
    for (const b of texts) for (const [ax, ay, bx, by] of segs) {
      const horiz = ay === by, hit = horiz ? (ay > b.y0 && ay < b.y1 && Math.max(ax, bx) > b.x0 && Math.min(ax, bx) < b.x1)
        : (ax > b.x0 && ax < b.x1 && Math.max(ay, by) > b.y0 && Math.min(ay, by) < b.y1);
      if (hit) { c2.push(label(b.t) + ' × ' + z.getAttribute('class') + ' border'); break; }
    }
  }
  // C3 foreign equipment bodies
  for (const n of [...svg.querySelectorAll('g.hmi-nodes .hmi-node')]) {
    const id = n.getAttribute('data-node'); const body = n.querySelector('.b'); if (!body || !vis(body)) continue;
    const r = body.getBoundingClientRect();
    for (const b of texts) { if (b.owner && b.owner === id) continue; if (n.contains(b.t)) continue;
      const w = Math.min(r.right, b.x1) - Math.max(r.left, b.x0), h = Math.min(r.bottom, b.y1) - Math.max(r.top, b.y0);
      if (w > 1.5 && h > 1.5) c3.push(label(b.t) + ' under body of ' + id); }
  }
  return { texts: texts.length, edges: edges.length, c1, c2, c3 };
}

let fail = 0;
for (const [page, hostSel] of PAGES) {
  const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: 1440, height: 1000 });
  await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + page, { waitUntil: 'networkidle0', timeout: 90000 });
  await enterAuthorizedAuditState(pg, page.replace('.html', ''));
  await pg.waitForFunction((h) => { const s = document.querySelector(h + ' svg'); return s && s.getBoundingClientRect().width > 0; }, { timeout: 20000 }, hostSel).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  const r = await pg.evaluate(probe, hostSel);
  if (r.missing) { console.log(`FAIL ${page}: sheet ${hostSel} not drawn`); fail++; await pg.close(); continue; }
  if (r.texts < 5 || r.edges < 3) { console.log(`FAIL ${page}: measured ${r.texts} texts / ${r.edges} edges — the probe saw no sheet`); fail++; }
  for (const [k, list] of [['C1', r.c1], ['C2', r.c2], ['C3', r.c3]]) {
    const ok = list.length === 0; if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${k} ${page}: ${list.length}${list.length ? ' — ' + list.slice(0, 6).join('; ') : ''}`);
  }
  console.log(`     ${page}: ${r.texts} texts, ${r.edges} edges measured, page errors ${errs.length}`);
  const over = [];
  for (const w of [1440, 1280]) {
    await pg.setViewport({ width: w, height: 900 });
    await new Promise((res) => setTimeout(res, 400));
    const o = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o > 1) over.push(w + ' px: +' + o + ' px');
  }
  if (over.length) fail++;
  console.log(`${over.length ? 'FAIL' : 'PASS'} C4 ${page}: page horizontal overflow ${over.length ? over.join(', ') : 'none at 1440 / 1280'}`);
  if (errs.length) { fail++; console.log(`FAIL ${page}: page error ${errs[0].slice(0, 160)}`); }
  await pg.close();
}
await browser.close(); srv.close();
console.log(fail ? `\nCONV SHEET TEXT CLEAR — ${fail} failing check(s)` : '\nCONV SHEET TEXT CLEAR — PASS');
process.exit(fail ? 1 : 0);
