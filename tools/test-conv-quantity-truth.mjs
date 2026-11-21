#!/usr/bin/env node
/**
 * test-conv-quantity-truth.mjs — the chiller plant sheets draw what the engine has (PRD-CONV-EQUIPMENT-TRUTH §6.1, §9,
 * phase E3). chiller-plant.html is RENDERED (1440 x 900 and 390 x 844, dark and light) and measured:
 *
 *   L1 CH-M-101 draws one train per unit of CONV_CALC.getFleet('chiller'), tagged with the fleet tags in order, each
 *      symbol's state = the unit's state (running / standby); the primary pumps = getFleet('chw_primary_pump') (tags +
 *      states); the secondary pumps = getFleet('chw_secondary_pump'); the zone label names the train count.
 *   L2 one CRAH coil bank per hall of listHalls(), labelled "× N · M RUN" from getFleet('crah', hall); the page's hall
 *      selector marks that hall's bank; the bank opens RZConvModal on the hall's CRAH fleet (one fleet cell per unit,
 *      navigator "01 of N", the unit tag in the title, Next steps to unit 02).
 *   L3 CH-M-102 (reached by the page's sheet switch) draws getFleet('tower_cell') and getFleet('cdw_pump') (tags +
 *      states), CDWS / CDWR temperatures = cooling.cdw_supply_c / cdw_return_c, each running pump's flow = its fleet
 *      row; Σ of the cell rejections drawn = cooling.tower_rejection_kw_th within 0.5 %, and so is the Σ label.
 *   L4 every chiller symbol opens the modal on its OWN unit (RZConvModal.unit() = its fleet index, title = its tag);
 *      every symbol with a tag carries an ISA-style tag, and its <title> starts with that tag, never with an internal id.
 *   L5 at 1440 and 390, both themes, both sheets: no visible sheet text under 11 px, no two texts overlapping, no text
 *      struck by a pipe or covered by a foreign symbol body, no sideways page scroll, 0 page errors.
 *
 * No count is typed in the page: the whole L1–L3 set runs a second time with getFleet STUBBED (8 chillers, 16 primary
 * pumps, 6 secondary pumps, 8 tower cells, 8 condenser pumps, 30 CRAH per hall with 29 running) and the sheets must
 * follow. Planted defects (RZ_QT_PLANT): font (value text 9 px -> L5), unit (the modal always opens unit 0 -> L4),
 * sum (cell rejections drawn 1 % high -> L3), ignore (the stub is not seen by the page -> L1 under the stub).
 * Integrator review of 2c3ff83d1 added: Q1 labels 2 px clear of every pipe and nothing clipped (CH-M-102 also at 1034;
 * the desktop panel needs no sideways scroll), Q2 a no-flow train shows no loop temperature, Q3 a running train's branch
 * flow = getFleet('chiller') chwFlowLps, Q4 NORMAL 60 simulated s = 0 WARNING/ALARM on both sheets, PERF1/PERF2 main
 * thread CPU and load-quiet time against the base ref (planted defect RZ_QT_PLANT=perf runs the sheet motion every frame).
 * Usage: node tools/test-conv-quantity-truth.mjs [--shots=dir] [--only=1440|1034|390]
 */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const SHOTS = arg('shots') || '';
const ONLY = arg('only') ? Number(arg('only')) : null;
const PERF_ONLY = process.argv.includes('--perf-only');
const PLANT = process.env.RZ_QT_PLANT || '';
const HOST = '#chw-sheet-host';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split(/[?#]/)[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const fails = [];
let passes = 0;
const ok = (cond, law, msg) => { if (cond) passes++; else fails.push(`${law} ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* the getFleet stub: wraps CONV_CALC the moment the engine publishes it, so every reader on the page sees it */
function installStub(plant) {
  let real;
  const trainOf = (tag) => { const m = /^CHWP-(\d+)/.exec(tag || ''); return m ? Number(m[1]) : 0; };
  const wrap = (C) => {
    if (!C || typeof C.getFleet !== 'function' || plant === 'ignore') return C;
    const w = {};
    Object.keys(C).forEach((k) => { w[k] = C[k]; });
    w.getFleet = function (kind, hall, m) {
      const f = C.getFleet(kind, hall, m); if (!Array.isArray(f)) return f;
      if (kind === 'chiller' || kind === 'tower_cell' || kind === 'cdw_pump') return f.slice(0, 8);
      if (kind === 'chw_primary_pump') return f.filter((u) => trainOf(u.tag) <= 8);
      if (kind === 'chw_secondary_pump') return f.concat([Object.assign({}, f[f.length - 1], { n: f.length + 1, tag: 'CHWP-S' + (f.length + 1), state: 'standby', loadPct: 0 })]);
      if (kind === 'crah') return f.slice(0, 30).map((u, i) => Object.assign({}, u, { state: i < 29 ? 'running' : 'standby' }));
      return f;
    };
    return w;
  };
  Object.defineProperty(window, 'CONV_CALC', { configurable: true, get() { return real; }, set(v) { real = wrap(v); } });
}

async function load(W, theme, stub) {
  const pg = await browser.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 200)));
  await pg.setViewport({ width: W, height: W > 800 ? 900 : 844, deviceScaleFactor: 1 });
  await primeCockpitAuditDocument(pg, theme);
  if (stub) await pg.evaluateOnNewDocument(installStub, PLANT);
  if (PLANT === 'font') await pg.evaluateOnNewDocument(() => document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style'); s.textContent = '#chw-sheet-host .hmi-svg [data-role="value"]{font-size:9px !important}'; document.head.appendChild(s); }));
  if (PLANT === 'sum') await pg.evaluateOnNewDocument(() => {
    let real; Object.defineProperty(window, 'CONV_CALC', { configurable: true, get() { return real; }, set(v) {
      const w = {}; Object.keys(v).forEach((k) => { w[k] = v[k]; });
      w.getFleet = function (kind, hall, m) { const f = v.getFleet(kind, hall, m); return kind === 'tower_cell' && f ? f.map((u) => Object.assign({}, u, { rejectionKwTh: u.rejectionKwTh * 1.01 })) : f; };
      real = w; } }); });
  await pg.setRequestInterception(true);
  pg.on('request', (q) => { const u = q.url(); if (u.startsWith(ORIGIN) || u.startsWith('data:')) q.continue(); else q.respond({ status: 204, contentType: 'text/plain', body: '' }); });
  await pg.goto(ORIGIN + 'chiller-plant.html', { waitUntil: 'load', timeout: 90000 });
  await enterAuthorizedAuditState(pg, 'chiller-plant');
  await pg.waitForFunction(() => document.querySelector('#chw-sheet-host .hmi-node[data-node="ch1"]'), { timeout: 20000 }).catch(() => {});
  await sleep(2600);   /* two 1.2 s scans: pump feedback answers its command (W4 B2) */
  if (PLANT === 'unit') await pg.evaluate(() => { const M = window.RZConvModal, o0 = M.open; window.RZConvModal = Object.assign({}, M, { open: function (p, o) { if (o && o.internal) o.internal.unit = 0; return o0(p, o); } }); });
  return { pg, errs };
}

async function view(pg, v) {
  await pg.evaluate((v) => { const b = document.querySelector('[data-chw-sheet-btn="' + v + '"]'); if (b) b.click(); }, v);
  await sleep(500);
  return pg.evaluate(() => document.querySelector('#chw-sheet-host')?.getAttribute('data-chw-sheet') || document.querySelector('#chw-sheet-host .hmi-sheet-no')?.textContent || '');
}

/* in-page: the sheet's symbols and value texts against the engine fleets */
function sheetFacts() {
  const C = window.CONV_CALC, host = document.querySelector('#chw-sheet-host'), svg = host.querySelector('svg.hmi-svg');
  const nodes = (re) => [...svg.querySelectorAll('.hmi-node[data-node]')].filter((g) => re.test(g.getAttribute('data-node')))
    .sort((a, b) => Number(/\d+$/.exec(a.getAttribute('data-node'))[0]) - Number(/\d+$/.exec(b.getAttribute('data-node'))[0]) || a.getAttribute('data-node').localeCompare(b.getAttribute('data-node')))
    .map((g) => { const id = g.getAttribute('data-node'), t = svg.querySelector('text[data-tag-of="' + id + '"]');
      return { id, tag: t ? t.textContent.trim() : null, state: g.getAttribute('data-state'), title: (g.querySelector('title') || {}).textContent || '' }; });
  /* a point's state glyph (tspan.rz-pt-g, aria-hidden, PRD-CONV-POINT-STATUS-TREND) is decoration, not the value */
  const vtext = (t) => { let x = ''; t.childNodes.forEach((n) => { if (!(n.classList && n.classList.contains('rz-pt-g'))) x += n.textContent; }); return x.trim(); };
  const val = (k) => { const t = svg.querySelector('[data-val="' + k + '"]'); return t ? vtext(t) : null; };
  const fleet = (k, h) => (C.getFleet(k, h) || []).map((u) => ({ tag: u.tag, state: u.state, flowLps: u.flowLps, rejectionKwTh: u.rejectionKwTh, chwFlowLps: u.chwFlowLps }));
  const halls = (C.listHalls() || []).map((h) => String(h.code));
  const tagged = [...svg.querySelectorAll('.hmi-node[data-node]')].map((g) => { const id = g.getAttribute('data-node'), t = svg.querySelector('text[data-tag-of="' + id + '"]');
    return { id, cls: g.hasAttribute('data-rz-equipment'), tag: t ? t.textContent.trim() : null, title: (g.querySelector('title') || {}).textContent || '' }; });
  const zones = [...svg.querySelectorAll('.hmi-zone-label, .hmi-area-label, g.hmi-areas text')].map((t) => t.textContent.trim());
  return { no: host.getAttribute('data-chw-sheet'), nodes: { ch: nodes(/^ch\d+$/), pri: nodes(/^p[a-rt-z]\d+$/), sec: nodes(/^ps\d+$/), ct: nodes(/^ct\d+$/), cp: nodes(/^cp\d+$/) },
    crah: halls.map((h) => ({ h, n: val('crah' + h + ':n'), present: !!svg.querySelector('.hmi-node[data-node="crah' + h + '"]'), sel: svg.querySelector('.hmi-node[data-node="crah' + h + '"]')?.hasAttribute('data-hall-selected') || false,
      fleet: fleet('crah', h).length, run: fleet('crah', h).filter((u) => u.state === 'running').length })),
    fleets: { chiller: fleet('chiller'), pri: fleet('chw_primary_pump'), sec: fleet('chw_secondary_pump'), ct: fleet('tower_cell'), cp: fleet('cdw_pump') },
    vals: Object.fromEntries([...svg.querySelectorAll('[data-val]')].map((t) => [t.getAttribute('data-val'), vtext(t)])),
    cooling: C.snapshot && C.snapshot.cooling ? { rej: C.snapshot.cooling.tower_rejection_kw_th, cdws: C.snapshot.cooling.cdw_supply_c, cdwr: C.snapshot.cooling.cdw_return_c } : null,
    tagged, zones };
}

/* in-page: text laws over the visible sheet (the internals-render rules applied to the plant sheet) */
function textLaws() {
  const svg = document.querySelector('#chw-sheet-host svg.hmi-svg'); if (!svg) return null;
  const vb = svg.viewBox.baseVal, sr = svg.getBoundingClientRect(), scale = sr.width / vb.width;
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let x = e; x && x !== svg; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const texts = [...svg.querySelectorAll('g.hmi-text text, g.hmi-lines text, g.hmi-areas text')].filter((t) => t.textContent.trim() && vis(t)).map((t) => {
    const r = t.getBoundingClientRect();
    return { id: (t.getAttribute('data-tag-of') || t.getAttribute('data-val') || t.getAttribute('data-role') || t.getAttribute('class')) + ' "' + t.textContent.trim().slice(0, 22) + '"',
      x0: r.left + 0.75, y0: r.top + 0.75, x1: r.right - 0.75, y1: r.bottom - 0.75, owner: t.getAttribute('data-tag-of') || (t.getAttribute('data-val') || '').split(':')[0] || null,
      px: parseFloat(getComputedStyle(t).fontSize) * scale };
  });
  const out = { n: texts.length, overlap: [], small: [], edge: [], body: [], zone: [], minPx: 99, scale };
  /* nothing clipped: the sheet's scroller can reach every text, and on a desktop panel the sheet needs no sideways
     scroll at all (integrator Q1: CDWP-10 was cut at the right edge of the 1440 panel) */
  let sc = null; for (let x = svg.parentElement; x && x !== document.body; x = x.parentElement) { const ox = getComputedStyle(x).overflowX; if (ox === 'auto' || ox === 'scroll') { sc = x; break; } }
  out.reach = []; out.fit = { need: 0 };
  if (sc) { const r0 = sc.getBoundingClientRect();
    for (const b of texts) { const right = b.x1 - r0.left + sc.scrollLeft; if (right > sc.scrollWidth + 1) out.reach.push(b.id); }
    out.fit = { need: Math.max(0, Math.round(sc.scrollWidth - sc.clientWidth)), panel: sc.clientWidth }; }
  for (const a of texts) { out.minPx = Math.min(out.minPx, a.px); if (a.px < 11 - 0.01) out.small.push(a.id + ' ' + a.px.toFixed(2) + ' px'); }
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j], w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w > 0.5 && h > 0.5) out.overlap.push(a.id + ' × ' + b.id);
  }
  /* a pipe must pass CLEAR of a label: 2 px of air around the glyph box, not merely outside it (integrator Q1) */
  const CLR = 2, inside = (b, x, y) => x > b.x0 - CLR && x < b.x1 + CLR && y > b.y0 && y < b.y1;
  /* a straight pipe has a zero-width box, so lines are kept by their computed display only */
  const shown = (e) => { for (let x = e; x && x !== svg; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
  for (const z of svg.querySelectorAll('rect.hmi-zone, rect.hmi-box')) {
    const r = z.getBoundingClientRect();
    for (const b of texts) { if (b.x1 < -1e8) continue;
      const crossV = (x) => x > b.x0 && x < b.x1 && r.bottom > b.y0 && r.top < b.y1, crossH = (y) => y > b.y0 && y < b.y1 && r.right > b.x0 && r.left < b.x1;
      if (crossV(r.left) || crossV(r.right) || crossH(r.top) || crossH(r.bottom)) out.zone.push(b.id); }
  }
  for (const e of [...svg.querySelectorAll('g.hmi-edges > path.hmi-edge:not(.hmi-flow)')].filter(shown)) {
    const m = e.getScreenCTM(); if (!m) continue; const L = e.getTotalLength();
    for (let s = 0; s <= L; s += 1) { const p = e.getPointAtLength(s), x = m.a * p.x + m.c * p.y + m.e, y = m.b * p.x + m.d * p.y + m.f;
      for (const b of texts) if (b.x1 > -1e8 && inside(b, x, y)) { out.edge.push(b.id + ' × ' + e.getAttribute('data-edge')); b.x1 = -1e9; } }
  }
  for (const n of svg.querySelectorAll('g.hmi-nodes .hmi-node')) {
    const id = n.getAttribute('data-node'), body = n.querySelector('.b'); if (!body) continue; const r = body.getBoundingClientRect();
    for (const b of texts) { if (b.owner === id || b.x1 < -1e8) continue; const w = Math.min(r.right, b.x1) - Math.max(r.left, b.x0), h = Math.min(r.bottom, b.y1) - Math.max(r.top, b.y0);
      if (w > 1.5 && h > 1.5) out.body.push(b.id + ' under ' + id); }
  }
  return out;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const num = (s) => { const m = /-?[\d,]+(?:\.\d+)?/.exec(s || ''); return m ? Number(m[0].replace(/,/g, '')) : NaN; };

function lawsL1(f, tag) {
  const want = f.fleets.chiller;
  ok(want.length > 0, 'L1', `${tag}: the engine fleet is empty — nothing to compare`);
  ok(same(f.nodes.ch.map((n) => n.tag), want.map((u) => u.tag)), 'L1', `${tag}: chiller trains drawn ${JSON.stringify(f.nodes.ch.map((n) => n.tag))} vs engine ${JSON.stringify(want.map((u) => u.tag))}`);
  ok(same(f.nodes.ch.map((n) => n.state), want.map((u) => u.state)), 'L1', `${tag}: chiller states ${JSON.stringify(f.nodes.ch.map((n) => n.state))} vs engine ${JSON.stringify(want.map((u) => u.state))}`);
  const run = f.nodes.ch.filter((n) => n.state === 'running').length, wr = want.filter((u) => u.state === 'running').length;
  ok(run === wr && f.nodes.ch.length - run === want.length - wr, 'L1', `${tag}: running/standby split drawn ${run}/${f.nodes.ch.length - run} vs engine ${wr}/${want.length - wr}`);
  const pri = f.nodes.pri.map((n) => n.tag + ':' + n.state).sort(), wp = f.fleets.pri.map((u) => u.tag + ':' + u.state).sort();
  ok(same(pri, wp), 'L1', `${tag}: primary pumps drawn ${pri.length} vs engine ${wp.length}; first difference ${pri.find((x, i) => x !== wp[i]) || wp.find((x) => !pri.includes(x)) || '—'}`);
  const sec = f.nodes.sec.map((n) => n.tag + ':' + n.state), ws = f.fleets.sec.map((u) => u.tag + ':' + u.state);
  ok(same(sec, ws), 'L1', `${tag}: secondary pumps drawn ${JSON.stringify(sec)} vs engine ${JSON.stringify(ws)}`);
  ok(f.zones.some((z) => z.includes(want.length + ' TRAINS')), 'L1', `${tag}: no zone label names the ${want.length} trains (${JSON.stringify(f.zones)})`);
}
function lawsL2label(f, tag) {
  ok(f.crah.length > 0, 'L2', `${tag}: listHalls() returned no hall`);
  for (const c of f.crah) {
    ok(c.present, 'L2', `${tag}: no CRAH bank for hall ${c.h}`);
    ok(c.n === `× ${c.fleet} · ${c.run} RUN`, 'L2', `${tag}: hall ${c.h} bank reads "${c.n}", engine × ${c.fleet} · ${c.run} RUN`);
  }
}
function lawsL3(f, tag) {
  ok(f.no === 'CH-M-102', 'L3', `${tag}: the sheet switch did not show CH-M-102 (host says ${f.no})`);
  const ct = f.nodes.ct.map((n) => n.tag + ':' + n.state), wc = f.fleets.ct.map((u) => u.tag + ':' + u.state);
  ok(wc.length > 0 && same(ct, wc), 'L3', `${tag}: tower cells drawn ${JSON.stringify(ct)} vs engine ${JSON.stringify(wc)}`);
  const cp = f.nodes.cp.map((n) => n.tag + ':' + n.state), wq = f.fleets.cp.map((u) => u.tag + ':' + u.state);
  ok(wq.length > 0 && same(cp, wq), 'L3', `${tag}: condenser pumps drawn ${JSON.stringify(cp)} vs engine ${JSON.stringify(wq)}`);
  if (!f.cooling) { ok(false, 'L3', `${tag}: engine snapshot has no cooling block`); return; }
  ok(num(f.vals['ttcs:t']) === f.cooling.cdws && / °C$/.test(f.vals['ttcs:t'] || ''), 'L3', `${tag}: TT-CDWS "${f.vals['ttcs:t']}" vs engine ${f.cooling.cdws}`);
  ok(num(f.vals['ttcr:t']) === f.cooling.cdwr && / °C$/.test(f.vals['ttcr:t'] || ''), 'L3', `${tag}: TT-CDWR "${f.vals['ttcr:t']}" vs engine ${f.cooling.cdwr}`);
  f.fleets.cp.forEach((u, i) => { if (u.state === 'running') ok(f.vals['cp' + (i + 1) + ':q'] === u.flowLps.toFixed(1) + ' L/s', 'L3', `${tag}: ${u.tag} flow "${f.vals['cp' + (i + 1) + ':q']}" vs fleet ${u.flowLps}`); });
  const drawn = f.fleets.ct.reduce((a, u, i) => a + (u.state === 'running' ? num(f.vals['ct' + (i + 1) + ':q']) : 0), 0);
  const rel = (a) => Math.abs(a - f.cooling.rej) / f.cooling.rej;
  if (tag.indexOf('stub') < 0) {
    ok(rel(drawn) <= 0.005, 'L3', `${tag}: Σ cell rejection drawn ${drawn.toFixed(0)} kWth vs engine tower_rejection_kw_th ${f.cooling.rej} (${(rel(drawn) * 100).toFixed(2)} %)`);
    ok(rel(num(f.vals['rin:r'])) <= 0.005, 'L3', `${tag}: Σ label "${f.vals['rin:r']}" vs engine ${f.cooling.rej}`);
  } else {
    /* under the stub (8 of 10 cells) the label must still be the sum of what the engine runs, not a typed total */
    const want = f.fleets.ct.filter((u) => u.state === 'running').reduce((a, u) => a + u.rejectionKwTh, 0);
    ok(Math.abs(num(f.vals['rin:r']) - want) <= 1, 'L3', `${tag}: Σ label "${f.vals['rin:r']}" vs Σ stub fleet ${want.toFixed(0)}`);
  }
}
function lawsTags(f, tag) {
  for (const n of f.tagged) {
    if (n.cls && !n.tag) { ok(false, 'L4', `${tag}: equipment symbol ${n.id} has no tag`); continue; }
    if (!n.tag) continue;
    ok(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*(?: [·A-Z0-9-]+)*$/.test(n.tag) && n.tag.toLowerCase() !== n.id.toLowerCase(), 'L4', `${tag}: ${n.id} tag "${n.tag}" is not an ISA-style tag`);
    ok(n.title.startsWith(n.tag) && !n.title.startsWith(n.id + ' ') && n.title !== n.id, 'L4', `${tag}: ${n.id} title "${n.title.slice(0, 40)}" does not start with its tag`);
  }
}
/* Q2 a train with no flow shows no loop temperature; Q3 a running train's branch flow is the engine's per-unit flow */
function lawsTruth(f, tag) {
  f.fleets.chiller.forEach((u, i) => {
    const n = i + 1;
    if (u.state !== 'running') {
      const live = ['cdr', 'cds', 'tts', 'ttr'].map((k) => k + n + ':t').filter((k) => f.vals[k] != null && /\d/.test(f.vals[k]));
      ok(live.length === 0, 'Q2', `${tag}: ${u.tag} is ${u.state} (no flow) but shows ${live.map((k) => k + ' "' + f.vals[k] + '"').join(', ')}`);
    } else {
      const q = num(f.vals['ch' + n + ':q']);
      ok(u.chwFlowLps != null && Math.abs(q - u.chwFlowLps) <= 0.051, 'Q3', `${tag}: ${u.tag} branch flow "${f.vals['ch' + n + ':q']}" vs engine chwFlowLps ${u.chwFlowLps}`);
    }
  });
}
async function L5(pg, W, theme, v, errs) {
  const t = await pg.evaluate(textLaws);
  const tag = `${v} ${W} ${theme}`;
  if (!t) { ok(false, 'L5', `${tag}: no sheet`); return; }
  ok(t.small.length === 0, 'L5', `${tag}: ${t.small.length} texts under 11 px (scale ${t.scale.toFixed(3)}), e.g. ${t.small.slice(0, 3).join('; ')}`);
  ok(t.overlap.length === 0, 'L5', `${tag}: ${t.overlap.length} overlapping texts, e.g. ${t.overlap.slice(0, 4).join('; ')}`);
  ok(t.edge.length === 0, 'L5', `${tag}: ${t.edge.length} texts struck by a pipe, e.g. ${t.edge.slice(0, 4).join('; ')}`);
  ok(t.reach.length === 0, 'L5', `${tag}: ${t.reach.length} texts beyond the sheet's scroll range, e.g. ${t.reach.slice(0, 3).join('; ')}`);
  if (W >= 1400) ok(t.fit.need === 0, 'L5', `${tag}: the sheet is ${t.fit.need} px wider than its ${t.fit.panel} px panel — clipped until scrolled`);
  ok(t.zone.length === 0, 'L5', `${tag}: ${t.zone.length} texts crossed by a zone border, e.g. ${t.zone.slice(0, 4).join('; ')}`);
  ok(t.body.length === 0, 'L5', `${tag}: ${t.body.length} texts under a foreign symbol, e.g. ${t.body.slice(0, 4).join('; ')}`);
  const sx = await pg.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: window.innerWidth }));
  ok(sx.sw <= sx.iw + 1, 'L5', `${tag}: page scrolls sideways (${sx.sw} > ${sx.iw})`);
  ok(errs.length === 0, 'L5', `${tag}: page errors ${JSON.stringify(errs.slice(0, 3))}`);
  console.log(`  · ${tag}: ${t.n} texts, min ${t.minPx.toFixed(2)} px (scale ${t.scale.toFixed(3)})`);
}

/* the deep path an operator uses: click the symbol (inspector) then double-click (≥ 800 px) or "Open equipment HMI" */
async function openDeep(pg, node, W) {
  await pg.evaluate(() => { if (window.RZConvModal && window.RZConvModal.isOpen()) window.RZConvModal.close();
    /* on a phone the inspector covers the sheet: close it so the click lands on the symbol, not on the last panel */
    const x = document.querySelector('aside.rz-inspector.open .rz-inspector-close'); if (x) x.click(); });
  await sleep(250);
  const pt = await pg.evaluate((node) => {
    const g = document.querySelector('#chw-sheet-host .hmi-node[data-node="' + node + '"]'); if (!g) return null;
    g.scrollIntoView({ block: 'center', inline: 'center' });
    const b = g.querySelector('.b') || g; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, node);
  if (!pt) return false;
  await sleep(150);
  await pg.mouse.click(pt.x, pt.y); await sleep(300);
  if (W >= 800) { await pg.mouse.click(pt.x, pt.y, { clickCount: 2 }); await sleep(400); }
  let open = await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden])'));
  if (!open) {
    const btn = await pg.$('aside.rz-inspector.open [data-rz-open-hmi]');
    if (btn) { await btn.click(); await sleep(400); }
    open = await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden])'));
  }
  return open;
}
const modalFacts = (pg) => pg.evaluate(() => { const m = document.querySelector('.rz-cvm:not([hidden])'); if (!m) return null;
  return { unit: window.RZConvModal.unit(), title: (m.querySelector('#rz-cvm-title') || {}).textContent || '', nav: (m.querySelector('[data-rz-cvm-navn]') || {}).textContent || '',
    cells: m.querySelectorAll('.rz-cvm-cell').length, pressed: (m.querySelector('.rz-cvm-cell[aria-pressed="true"]') || {}).getAttribute?.('data-unit') }; });

const WIDTHS = PERF_ONLY ? [] : [1440, 1034, 390].filter((w) => !ONLY || w === ONLY);
for (const W of WIDTHS) for (const theme of ['dark', 'light']) {
  const { pg, errs } = await load(W, theme, false);
  const tag = `${W} ${theme}`;
  await view(pg, 'ch-m-101');
  const f1 = await pg.evaluate(sheetFacts);
  lawsL1(f1, tag); lawsL2label(f1, tag); lawsTags(f1, 'CH-M-101 ' + tag); lawsTruth(f1, tag);
  if (SHOTS && theme === 'dark') { await pg.evaluate(() => window.scrollTo(0, 0)); await (await pg.$(HOST)).screenshot({ path: path.join(SHOTS, `ch-m-101-${W}.png`) }); await pg.screenshot({ path: path.join(SHOTS, `ch-m-101-${W}-viewport.png`) }); }
  await L5(pg, W, theme, 'CH-M-101', errs);

  if (theme === 'dark') {
    /* L2: the hall selector steps the halls and marks the bank */
    for (const h of f1.crah.map((c) => c.h)) {
      await pg.evaluate((h) => document.querySelector('[data-hall="' + h + '"]')?.click(), h); await sleep(150);
      const sel = await pg.evaluate(() => [...document.querySelectorAll('#chw-sheet-host .hmi-node[data-hall-selected]')].map((g) => g.getAttribute('data-node')));
      ok(same(sel, ['crah' + h]), 'L2', `${tag}: hall ${h} selected, marked banks ${JSON.stringify(sel)}`);
    }
    /* L2: a bank opens its hall's CRAH fleet */
    const h = f1.crah.length > 1 ? f1.crah[1] : f1.crah[0];
    const open = h ? await openDeep(pg, 'crah' + h.h, W) : false;
    ok(open, 'L2', `${tag}: CRAH-${h && h.h} bank did not open RZConvModal`);
    if (open) {
      const m = await modalFacts(pg);
      ok(m.cells === h.fleet && m.nav.trim() === '01 of ' + h.fleet && m.title.indexOf('CRAH-' + h.h + '01') === 0, 'L2', `${tag}: CRAH modal ${JSON.stringify(m)} vs fleet ${h.fleet} (CRAH-${h.h}01)`);
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `crah-modal-${W}.png`) });
      await pg.evaluate(() => document.querySelector('.rz-cvm:not([hidden]) [data-nav="1"]')?.click()); await sleep(250);
      const m2 = await modalFacts(pg);
      ok(m2 && m2.unit === 1 && m2.title.indexOf('CRAH-' + h.h + '02') === 0, 'L2', `${tag}: Next did not step to CRAH-${h.h}02 (${JSON.stringify(m2)})`);
      await pg.keyboard.press('Escape'); await sleep(200);
    }
    /* L4: each chiller opens its own unit (all at 1440; the first, a middle and the last at 390) */
    const chs = f1.nodes.ch.map((n, i) => ({ id: n.id, tag: n.tag, i }));
    const pick = W >= 800 ? chs : [chs[0], chs[Math.floor(chs.length / 2)], chs[chs.length - 1]].filter(Boolean);
    for (const c of pick) {
      const o = await openDeep(pg, c.id, W);
      const m = o ? await modalFacts(pg) : null;
      ok(m && m.unit === c.i && m.title.indexOf(c.tag) === 0, 'L4', `${tag}: ${c.tag} opened ${m ? 'unit ' + m.unit + ' "' + m.title.slice(0, 30) + '"' : 'nothing'}`);
      await pg.keyboard.press('Escape'); await sleep(150);
    }
  }

  await view(pg, 'ch-m-102');
  const f2 = await pg.evaluate(sheetFacts);
  lawsL3(f2, tag); lawsTags(f2, 'CH-M-102 ' + tag);
  if (SHOTS && theme === 'dark') { await pg.evaluate(() => document.querySelector('aside.rz-inspector.open .rz-inspector-close')?.click()); await sleep(300);
    await (await pg.$(HOST)).screenshot({ path: path.join(SHOTS, `ch-m-102-${W}.png`) }); }
  await L5(pg, W, theme, 'CH-M-102', errs);
  if (theme === 'dark' && W >= 800) {
    const o = await openDeep(pg, 'ct3', W), m = o ? await modalFacts(pg) : null;
    ok(m && m.unit === 2 && m.title.indexOf(f2.fleets.ct[2].tag) === 0, 'L4', `${tag}: CT-03 opened ${JSON.stringify(m)}`);
    if (SHOTS && m) await pg.screenshot({ path: path.join(SHOTS, `tower-modal-${W}.png`) });
    await pg.keyboard.press('Escape');
  }
  await pg.close();
}

/* Q4: NORMAL at rest — 50 scans (60 simulated s) and not one WARNING or ALARM on either sheet */
if (!PERF_ONLY && (!ONLY || ONLY === 1440)) {
  const { pg, errs } = await load(1440, 'dark', false);
  const chips = () => pg.evaluate(() => {
    const svg = document.querySelector('#chw-sheet-host svg.hmi-svg'); if (!svg) return ['no sheet'];
    const out = [];
    svg.querySelectorAll('.hmi-node[data-alarm]').forEach((g) => { if (g.getAttribute('data-alarm')) out.push(g.getAttribute('data-node') + ' alarm ' + g.getAttribute('data-alarm')); });
    svg.querySelectorAll('text[data-val]').forEach((t) => { if (/\b(WARNING|ALARM)\b/.test(t.textContent) || (t.getAttribute('data-alarm') || '')) out.push(t.getAttribute('data-val') + ' "' + t.textContent.trim() + '"'); });
    return out;
  });
  const bad = { 'ch-m-101': [], 'ch-m-102': [] };
  for (let k = 0; k < 50; k++) {
    await pg.evaluate(() => { if (typeof stepProcess === 'function') stepProcess(); if (typeof renderAll === 'function') renderAll(); });
    if (k % 5 === 4) for (const v of ['ch-m-101', 'ch-m-102']) { await view(pg, v); for (const c of await chips()) if (!bad[v].includes(c)) bad[v].push(c); }
  }
  const scen = await pg.evaluate(() => (typeof ui !== 'undefined' ? 'scenario ' + ui.scenario + (ui.maint ? ' maint' : '') + (ui.forced.size ? ' forced' : '') : '?'));
  for (const v of ['ch-m-101', 'ch-m-102']) ok(bad[v].length === 0, 'Q4', `NORMAL (${scen}) 60 simulated s: ${bad[v].length} WARNING/ALARM marks on ${v.toUpperCase()}, e.g. ${bad[v].slice(0, 4).join('; ')}`);
  ok(errs.length === 0, 'Q4', `page errors while stepping ${JSON.stringify(errs.slice(0, 3))}`);
  if (SHOTS) { await view(pg, 'ch-m-101'); await (await pg.$(HOST)).screenshot({ path: path.join(SHOTS, 'ch-m-101-after-60s.png') }); }
  await pg.close();
}

/* the same laws with getFleet stubbed: the sheets follow the engine, they hold no count of their own */
if (!PERF_ONLY && (!ONLY || ONLY === 1440)) {
  const { pg, errs } = await load(1440, 'dark', true);
  const stubbed = await pg.evaluate(() => window.CONV_CALC.getFleet('chiller').length);
  await view(pg, 'ch-m-101');
  const f1 = await pg.evaluate(sheetFacts);
  /* if the page never saw the stub (planted 'ignore'), compare with what the stub WOULD give */
  if (PLANT === 'ignore') { f1.fleets.chiller = f1.fleets.chiller.slice(0, 8); f1.fleets.pri = f1.fleets.pri.filter((u) => Number(/\d+/.exec(u.tag)[0]) <= 8); }
  ok(PLANT === 'ignore' || stubbed === 8, 'L1', `stub: getFleet('chiller') under the stub has ${stubbed} units, expected 8`);
  lawsL1(f1, 'stub 1440'); lawsL2label(f1, 'stub 1440');
  await view(pg, 'ch-m-102');
  const f2 = await pg.evaluate(sheetFacts);
  lawsL3(f2, 'stub 1440');
  ok(errs.length === 0, 'L5', `stub: page errors ${JSON.stringify(errs.slice(0, 3))}`);
  if (SHOTS) await (await pg.$(HOST)).screenshot({ path: path.join(SHOTS, 'ch-m-102-stub-1440.png') });
  await pg.close();
}

/* PERF (integrator): the page must not burn the main thread. Measured against the base the branch started from
   (origin/main by default, RZ_QT_BASE=<ref> to override), served from git in the same run so both see the same machine
   load. The figure is the renderer main thread's CPU time (Performance.getMetrics ThreadTime), not wall time, so another
   session's load does not inflate it. PERF1: CPU over 5 s idle at 1440 <= 1.5 s and <= base x 1.2. PERF2: load-quiet <= base + 3 s. */
async function perfOf(origin, label) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await primeCockpitAuditDocument(pg, 'dark');
  if (PLANT === 'perf' && label === 'branch') await pg.evaluateOnNewDocument(() => document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = '#chw-sheet-host .hmi-svg .hmi-flow[data-flow="running"],#chw-sheet-host .hmi-svg .vfx-rotor[data-spin]{animation-play-state:running !important}'; document.head.appendChild(st); }));
  await pg.setRequestInterception(true);
  pg.on('request', (q) => { const u = q.url(); if (u.startsWith(origin) || u.startsWith('data:')) q.continue(); else q.respond({ status: 204, contentType: 'text/plain', body: '' }); });
  const t0 = Date.now(); let idle = null; const fly = new Map(), slow = [];
  pg.on('request', (q) => fly.set(q, Date.now()));
  const done = (q) => { const st = fly.get(q); if (st != null && Date.now() - st > 3000) slow.push(q.url().replace(origin, '').slice(0, 70) + ' ' + (Date.now() - st) + ' ms'); fly.delete(q); };
  pg.on('requestfinished', done); pg.on('requestfailed', done);
  /* load-quiet: the page's load event, then 500 ms with no request started and none in flight, tracked here.
     Puppeteer's own networkidle0 swung 3 s … 88 s on the SAME tree under this machine's load (both trees), so it
     cannot separate a regression from noise; this measures what it is meant to measure. */
  let lastReq = Date.now(); pg.on('request', () => { lastReq = Date.now(); });
  try {
    await pg.goto(origin + 'chiller-plant.html', { waitUntil: 'load', timeout: 120000 });
    while (Date.now() - t0 < 120000 && (fly.size || Date.now() - lastReq < 500)) await sleep(50);
    idle = fly.size ? null : Math.max(lastReq, Date.now() - 500) - t0 + 500;
  } catch (e) { idle = null; }
  if (slow.length || fly.size) console.log(`  · PERF ${label}: slow requests ${JSON.stringify(slow.slice(0, 5))} still in flight ${JSON.stringify([...fly.keys()].map((q) => q.url().slice(0, 70)).slice(0, 5))}`);
  await enterAuthorizedAuditState(pg, 'chiller-plant');
  await sleep(3000);
  /* Performance.getMetrics ThreadTime = CPU time of the renderer main thread (not wall time), so another session's
     load does not inflate it; TaskDuration (wall) is the fallback where ThreadTime is missing */
  const cdp = await pg.createCDPSession(); await cdp.send('Performance.enable');
  const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  const m1 = await met(); await sleep(5000); const m2 = await met();
  /* PERF0 (structural, immune to machine load): the sheet asks for no per-frame repaint — no animation inside it runs
     on the display clock — yet the running lines still carry their motion and their phase advances between samples */
  const anim = await pg.evaluate(async () => {
    const host = document.querySelector('#chw-sheet-host'); if (!host) return null;
    const all = host.getAnimations({ subtree: true });
    const moving = [...host.querySelectorAll('.hmi-flow[data-flow="running"]')].filter((e) => getComputedStyle(e).animationName !== 'none');
    const r = host.getBoundingClientRect(), vis = moving.filter((e) => { const b = e.getBoundingClientRect(); return b.bottom > Math.max(0, r.top) && b.top < Math.min(innerHeight, r.bottom); });
    const ph = () => vis.map((e) => getComputedStyle(e).strokeDashoffset).join('|');
    const p1 = ph(); await new Promise((res) => setTimeout(res, 900)); const p2 = ph();
    return { running: all.filter((a) => a.playState === 'running').length, total: all.length, moving: moving.length, advances: vis.length > 0 && p1 !== p2 };
  });
  const key = m1.ThreadTime != null ? 'ThreadTime' : 'TaskDuration';
  const main = [key, (m2[key] - m1[key]) * 1000];
  await pg.close();
  return { idle, cpu: Math.round(main[1]), key: main[0], anim };
}
if (!ONLY || ONLY === 1440) {
  const REF = process.env.RZ_QT_BASE || 'origin/main';
  const cache = new Map();
  const base = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split(/[?#]/)[0]).replace(/^\/+/, '');
    if (rel.includes('..')) { r.writeHead(403); r.end(); return; }
    /* async: a synchronous git per file blocked this process ~6 s per page load and faked a slow network */
    const send = (d) => { if (!d) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' }); r.end(d); };
    if (cache.has(rel)) { send(cache.get(rel)); return; }
    execFile('git', ['show', REF + ':' + rel], { cwd: ROOT, maxBuffer: 64 << 20, encoding: 'buffer' }, (e, out) => { const d = e ? null : out; cache.set(rel, d); send(d); });
  });
  await new Promise((res) => base.listen(0, '127.0.0.1', res));
  const BASE = `http://127.0.0.1:${base.address().port}/`;
  /* warm the git-backed server first (one unmeasured load), so the base is not charged for `git show` per file */
  { const w = await browser.newPage(); await primeCockpitAuditDocument(w, 'dark'); await w.setRequestInterception(true);
    w.on('request', (q) => { const u = q.url(); if (u.startsWith(BASE) || u.startsWith('data:')) q.continue(); else q.respond({ status: 204, contentType: 'text/plain', body: '' }); });
    await w.goto(BASE + 'chiller-plant.html', { waitUntil: 'load', timeout: 120000 }).catch(() => {}); await sleep(1500); await w.close(); }
  /* interleaved, best of 2 per tree: a benchmark on a shared machine reads its quietest run (load average here swung
     8 … 38 during one session; another session's browser stalled even local file serving for 14 s once) */
  const runs = { base: [], branch: [] };
  for (let k = 0; k < 2; k++) { runs.base.push(await perfOf(BASE, 'base')); runs.branch.push(await perfOf(ORIGIN, 'branch')); }
  const best = (rs) => ({ key: rs[0].key, cpu: Math.min(...rs.map((r) => r.cpu)), idle: rs.some((r) => r.idle != null) ? Math.min(...rs.filter((r) => r.idle != null).map((r) => r.idle)) : null,
    all: rs.map((r) => r.cpu + '/' + r.idle).join(' ') });
  const b = best(runs.base), m = best(runs.branch);
  console.log(`  · PERF runs (cpu ms / load-quiet ms): base ${b.all} · branch ${m.all}`);
  base.close();
  console.log(`  · PERF ${REF}: main-thread ${b.key} ${b.cpu} ms / 5 s idle, load-quiet ${b.idle} ms · branch: ${m.key} ${m.cpu} ms / 5 s, load-quiet ${m.idle} ms`);
  const an = runs.branch[runs.branch.length - 1].anim;
  ok(an && an.running === 0 && an.moving > 0 && an.advances, 'PERF0', `sheet animations on the display clock: ${an ? an.running + ' of ' + an.total + ' running per frame, ' + an.moving + ' moving lines, phase advances ' + an.advances : 'no sheet'} (want 0 per frame, motion still advancing)`);
  ok(m.cpu != null && b.cpu != null && m.cpu <= 1500 && m.cpu <= b.cpu * 1.2, 'PERF1', `main-thread CPU over 5 s idle at 1440: branch ${m.cpu} ms vs limit min(1500, ${REF} ${b.cpu} x 1.2 = ${b.cpu != null ? Math.round(b.cpu * 1.2) : '?'})`);
  ok(m.idle != null && b.idle != null && m.idle <= b.idle + 3000, 'PERF2', `load-quiet (load + 500 ms without a request): branch ${m.idle} ms vs ${REF} ${b.idle} ms + 3000`);
}

await browser.close();
srv.close();
console.log(`test-conv-quantity-truth${PLANT ? ' [plant ' + PLANT + ']' : ''}: ${passes} pass, ${fails.length} fail`);
for (const f of fails) console.log('  ✗ ' + f);
process.exit(fails.length ? 1 : 0);
