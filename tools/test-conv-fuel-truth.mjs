#!/usr/bin/env node
/**
 * test-conv-fuel-truth.mjs — FU-M-101 tells the truth (PRD-CONV-EQUIPMENT-TRUTH §6.1 FU-M-101 row, audit F2 + F5).
 *
 * Before (v3.79.0, measured): fuel-system.html drew three gensets GEN-A/B/C, GEN-B read "RUNNING 43.5 MW" in NORMAL with
 * every day-tank fill valve closed and P-101 stopped, DT-GEN-B held 455 L = 1.8 min of burn, and no alarm was raised —
 * while the engine has 8 sets per hall (CONV_CALC.getFleet('genset', hall)), 4 halls, 32 sets, all STANDBY in normal.
 *
 * Expected values are computed HERE from js/conv-engine.js loaded in Node, never read back from the page.
 *
 *   N1  engine fleet: getFleet('genset', hall) per listHalls() hall = electrical.genset_per_hall rows, sum = genset_count,
 *       every row STANDBY at 0 kW (the engine publishes no run split)
 *   N2  js/conv/fuel-sheet.js draws one XV + day tank + genset per fleet row it is given, tags = the fleet tags, none
 *       without a fleet; no genset / hall list typed in fuel-sheet.js or fuel-system.html (code, not comments)
 *   N3  js/conv/internals/genset.js: no digit outside its GEOMETRY block, comments and standards text; model() kVA =
 *       kW / power_factor_design on a running set, running-only values blank on a standby set
 *   F1  per hall (1440): the hall selector has one button per listHalls() hall; clicking it draws N gensets + N day tanks
 *       + N fill valves with the engine tags of THAT hall; the facts line states the hall count and the site total
 *       (= Node sum = electrical.genset_count) and names getFleet as its source
 *   F2  NORMAL: on every hall every set STANDBY, 0 kW, no "RUNNING" and no "MW" on a genset, every XV CLOSED, P-101 STOP,
 *       0 alarms. UTILITY LOSS: running = rows - electrical.genset_spare_per_hall, each set's kW <= its rating, sum of
 *       running kW = the hall's facility_load_kw (listHalls(), Node); the sheet prints RUNNING exactly on those sets
 *   F3  day tank per set burn: capacity = stated hours x rating x fuel.specific_consumption_l_per_kwh (Node), stated basis
 *       >= 1 h at rated burn; 420 scans of utility loss: a fill valve opens and P-101 runs (seen on the sheet), no running
 *       set's tank ever falls below the stated low level; with LD-101 tripped (transfer inhibited) the tanks drain below
 *       fill start and the alarm list carries LAL-DT-<set> LO for them
 *   F4  every genset and day-tank symbol opens RZConvModal on ITS unit: title = the set's ISA tag, never an internal id,
 *       navigator "k of N" over the hall's N sets, the day tank selects the day-tank block, ▸ steps to the next tag
 *   F5  at 1440 and 390 (NORMAL and UTILITY LOSS): no FU-M-101 label, hall-bar, genset-row or tank-table text under
 *       11 px, no two sheet labels overlap, no pipe through a label, no horizontal page scroll, 0 page errors; the
 *       genset modal's internal drawing passes the same text laws
 *
 * Planted defects (each must turn its law red): --plant=count6 (engine draws 6 sets per hall), run-normal (sets run in
 * NORMAL), overload (one set's share = the whole hall), tiny-tank (day tank 2 min of rated burn), stuck-xv (fill valves
 * never open), no-alarm (no LO alarm when fill is unavailable), wrong-unit (modal opens unit 1), small-text (9 px values).
 *
 * Usage: node tools/test-conv-fuel-truth.mjs [--plant=<name>] [--shots=<dir>] [--theme=dark]
 */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const arg = (k) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : ''; };
const PLANT = arg('plant'), SHOTS = arg('shots'), THEME = arg('theme') || 'dark';
const fails = [];
const fail = (law, msg) => fails.push(law + ' ' + msg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── planted defects: a served file has one string replaced (the string must exist, or the plant itself is invalid) ── */
const PLANTS = {
  'count6': ['js/conv-engine.js', 'var gens = electricalHvMv(m).genset_per_hall;', 'var gens = Math.min(6, electricalHvMv(m).genset_per_hall);'],
  'run-normal': ['fuel-system.html', "var run = state.mode === 'utility-loss' && spare !== null ?", 'var run = spare !== null ?'],
  'overload': ['fuel-system.html', 'hall.facility_load_kw / run : 0;', 'hall.facility_load_kw : 0;'],
  'tiny-tank': ['fuel-system.html', 'var DT_CAP_HR = 4,', 'var DT_CAP_HR = 0.03,'],
  'stuck-xv': ['fuel-system.html', 'hs.open = hs.req.map(function (r) { return r && permissive && transferCmd(); });', 'hs.open = hs.req.map(function () { return false; });'],
  'no-alarm': ['fuel-system.html', "else if (v < DT_FILL_START && !avail) alarms.push(", 'else if (false) alarms.push('],
  'wrong-unit': ['fuel-system.html', "unit: Number(m[2]) - 1, block:", 'unit: 0, block:'],
  'small-text': ['fuel-system.html', '#fuel-sheet-host .hmi-svg .hmi-area-label { font-size: 11px; }', '#fuel-sheet-host .hmi-svg .hmi-area-label { font-size: 9px; }']
};
if (PLANT && !PLANTS[PLANT]) { console.error('unknown plant ' + PLANT + ' — one of ' + Object.keys(PLANTS).join(', ')); process.exit(2); }
const plantFile = PLANT ? PLANTS[PLANT][0] : null;
if (PLANT) {
  const src = fs.readFileSync(path.join(ROOT, plantFile), 'utf8');
  if (!src.includes(PLANTS[PLANT][1])) { console.error('plant ' + PLANT + ' is stale: its string is not in ' + plantFile); process.exit(2); }
}

/* ── Node: the engine expectation ────────────────────────────────────────────────────────────────────────────────── */
const { CONV_CALC: C } = require(path.join(ROOT, 'js/conv-engine.js'));
const SNAP = C.snapshot, EL = SNAP.electrical, SFC = SNAP.fuel.specific_consumption_l_per_kwh;
const HALLS = C.listHalls().map((h) => ({ code: h.code, loadKw: h.facility_load_kw, fleet: C.getFleet('genset', h.code) }));
const SITE = HALLS.reduce((a, h) => a + h.fleet.length, 0);
{
  for (const h of HALLS) {
    if (h.fleet.length !== EL.genset_per_hall) fail('N1', `hall ${h.code}: ${h.fleet.length} rows, electrical.genset_per_hall ${EL.genset_per_hall}`);
    if (!h.fleet.every((u) => u.state === 'standby' && u.outputKw === 0)) fail('N1', `hall ${h.code}: a row is not STANDBY at 0 kW`);
  }
  if (SITE !== EL.genset_count) fail('N1', `site ${SITE} rows, electrical.genset_count ${EL.genset_count}`);
}
{
  const win = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'js/conv/fuel-sheet.js'), 'utf8'))(win);
  const S = win.RZFuelSheets;
  if (typeof S.build !== 'function') fail('N2', 'js/conv/fuel-sheet.js has no build(units, hall): the sheet cannot be drawn from a fleet');
  else for (const h of HALLS) {
    const sh = S.build(h.fleet, h.code);
    const gens = sh.nodes.filter((n) => /^gen\d+$/.test(n.id)), dts = sh.nodes.filter((n) => /^dt\d+$/.test(n.id)), xvs = sh.nodes.filter((n) => /^xv\d+$/.test(n.id));
    if (gens.length !== h.fleet.length || dts.length !== h.fleet.length || xvs.length !== h.fleet.length) fail('N2', `build(${h.code}) drew ${gens.length}/${dts.length}/${xvs.length} sets/tanks/valves for ${h.fleet.length} rows`);
    if (gens.map((n) => n.tag).join() !== h.fleet.map((u) => u.tag).join()) fail('N2', `build(${h.code}) tags ${gens.map((n) => n.tag).join()} != fleet`);
    if (!dts.every((n, i) => n.tag === 'DT-' + h.fleet[i].tag)) fail('N2', `build(${h.code}) day-tank tags not DT-<set>`);
  }
  if (typeof S.build === 'function' && S.build([], null).nodes.some((n) => /^(gen|dt|xv)\d+$/.test(n.id))) fail('N2', 'build([]) drew a genset with no fleet');
  const code = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const f of ['js/conv/fuel-sheet.js', 'fuel-system.html']) {
    const c = code(f), hit = c.match(/['"]GEN-[A-D]\d*['"]|GEN-A\/B\/C|\[\s*'A',\s*'B',\s*'C'|\bdt[ABC]\b|genRunning/);
    if (hit) fail('N2', `${f} types a genset list: "${hit[0]}"`);
  }
}
if (!fs.existsSync(path.join(ROOT, 'js/conv/internals/genset.js'))) fail('N3', 'js/conv/internals/genset.js missing: no genset inside to open');
else {
  const src = fs.readFileSync(path.join(ROOT, 'js/conv/internals/genset.js'), 'utf8');
  const g0 = src.indexOf('/* GEOMETRY BEGIN'), g1 = src.indexOf('/* GEOMETRY END */');
  if (!(g0 > 0 && g1 > g0)) fail('N3', 'GEOMETRY markers missing');
  else {
    const f0 = src.indexOf('/* FORMATS BEGIN'), f1 = src.indexOf('/* FORMATS END */');
    const cut = f0 > 0 && f1 > f0 ? src.slice(0, f0) + src.slice(f1) : src;
    const rest = (cut.slice(0, cut.indexOf('/* GEOMETRY BEGIN')) + cut.slice(cut.indexOf('/* GEOMETRY END */'))).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/standard: '[^']*'/g, '');
    const d = rest.match(/[^\w]\d[\d.]*/g);
    if (d) fail('N3', `digits outside geometry: ${d.slice(0, 5).join(' ')}`);
  }
  const R = require(path.join(ROOT, 'js/conv/internals.js'));
  require(path.join(ROOT, 'js/conv/internals/genset.js'));
  const u = { n: 1, tag: 'GEN-A1', state: 'running', ratingKw: 3000, outputKw: 1500, loadPct: 50, lph: 1500 * SFC };
  const m = R.model('genset', u, SNAP), m0 = R.model('genset', { ...u, state: 'standby', outputKw: 0, loadPct: 0, lph: 0 }, SNAP);
  if (Math.abs(m.kva - 1500 / EL.power_factor_design) > 1e-9) fail('N3', `kVA ${m.kva} != kW / pf`);
  if (m0.kva !== null || m0.pf !== null) fail('N3', 'standby set shows kVA / pf');
}

/* ── browser ─────────────────────────────────────────────────────────────────────────────────────────────────────── */
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html' };
const srv = http.createServer((q, r) => {
  const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, ''), p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    if (PLANT && rel === plantFile) d = Buffer.from(d.toString('utf8').replace(PLANTS[PLANT][1], PLANTS[PLANT][2]));
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d);
  });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (pg, name) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, name + '.png') }); };

async function load(W) {
  const pg = await browser.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844, deviceScaleFactor: 1 });
  await primeCockpitAuditDocument(pg, THEME);
  await pg.goto(ORIGIN + 'fuel-system.html', { waitUntil: 'networkidle0', timeout: 90000 });
  await enterAuthorizedAuditState(pg, 'fuel-system');
  await pg.waitForFunction(() => window.RZConvSim && document.querySelector('#fuel-sheet-host .hmi-node[data-node="ust"]'), { timeout: 20000 }).catch(() => {});
  await sleep(800);
  return { pg, errs };
}
const snap = (pg) => pg.evaluate(() => window.RZConvSim ? window.RZConvSim.snapshot() : null);
const clickSel = async (pg, sel) => { const ok = await pg.evaluate((s) => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel); await sleep(250); return ok; };
/* the sheet as the operator reads it: per node the tag and the value texts */
const sheetText = (pg) => pg.evaluate(() => {
  const svg = document.querySelector('#fuel-sheet-host svg.hmi-svg'), out = {};
  if (!svg) return out;
  svg.querySelectorAll('.hmi-node[data-node]').forEach((g) => { const id = g.getAttribute('data-node'); out[id] = { tag: '', vals: {} }; });
  svg.querySelectorAll('[data-tag-of]').forEach((t) => { const id = t.getAttribute('data-tag-of'); if (out[id]) out[id].tag = t.textContent.trim(); });
  svg.querySelectorAll('[data-val]').forEach((t) => { const [id, k] = t.getAttribute('data-val').split(':'); if (out[id]) out[id].vals[k] = t.textContent.trim(); });
  return out;
});

/* F5 in-page: text laws on one svg (sheet or modal drawing) */
function svgTextLaws(sel) {
  const svg = document.querySelector(sel); if (!svg) return null;
  const vb = svg.viewBox.baseVal, sr = svg.getBoundingClientRect(), scale = sr.width / vb.width;
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let x = e; x && x !== svg; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const texts = [...svg.querySelectorAll('g.hmi-text text, g.hmi-lines text, g.hmi-areas text')].filter((t) => t.textContent.trim() && vis(t)).map((t) => {
    const r = t.getBoundingClientRect();
    return { id: (t.getAttribute('data-tag-of') || t.getAttribute('data-val') || t.getAttribute('data-role')) + ' "' + t.textContent.trim().slice(0, 24) + '"',
      x0: r.left + 0.75, y0: r.top + 0.75, x1: r.right - 0.75, y1: r.bottom - 0.75, px: parseFloat(getComputedStyle(t).fontSize) * scale };
  });
  const out = { n: texts.length, overlap: [], small: [], edge: [], minPx: 99 };
  for (const a of texts) { out.minPx = Math.min(out.minPx, a.px); if (a.px < 11 - 0.01) out.small.push(a.id + ' ' + a.px.toFixed(2) + ' px'); }
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j], w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w > 0.5 && h > 0.5) out.overlap.push(a.id + ' × ' + b.id);
  }
  const inside = (b, x, y) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
  for (const e of svg.querySelectorAll('g.hmi-edges > path.hmi-edge:not(.hmi-flow)')) {
    if (!vis(e)) continue; const m = e.getScreenCTM(); if (!m) continue; const L = e.getTotalLength();
    for (let s = 0; s <= L; s += 1) { const p = e.getPointAtLength(s), x = m.a * p.x + m.c * p.y + m.e, y = m.b * p.x + m.d * p.y + m.f;
      for (const b of texts) if (inside(b, x, y)) { out.edge.push(b.id + ' × ' + e.getAttribute('data-edge')); b.x1 = -1e9; } }
  }
  return out;
}
/* F5 in-page: every visible HTML text in the hall bar, basis line, genset rows and tank table at >= 11 px */
function htmlTextLaws() {
  const roots = ['#fuel-hallbar', '#fuel-dt-basis', '#genset-rows', '#tank-tbody'].map((s) => document.querySelector(s)).filter(Boolean);
  const small = []; let n = 0;
  for (const r of roots) {
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (!t.textContent.trim()) continue; const el = t.parentElement, b = el.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) continue; n++;
      const px = parseFloat(getComputedStyle(el).fontSize); if (px < 11 - 0.01) small.push('"' + t.textContent.trim().slice(0, 20) + '" ' + px.toFixed(2) + ' px');
    }
  }
  return { n, small, scroll: document.documentElement.scrollWidth - window.innerWidth };
}
/* P1: the reader sees words and numbers, never an engine call or key; P4: no view-bar legend item past the visible edge of
   the scroll strip it sits in (it wraps, or its own strip scrolls); P2: the day-tank basis is one short line + an info control
   (keyboard and touch) holding the explanation; P3: the drawing starts under the view bar (no empty band) */
function polishLaws() {
  const out = { code: [], clipped: [], basis: null, band: null };
  const CODE = /getFleet\(|CONV_CALC|\belectrical\.[a-z_]+|\bfuel\.[a-z_]+|\bhall\.facility|_count\b|_per_hall\b|_l_per_kwh\b/;
  for (const line of document.body.innerText.split('\n')) { const m = line.match(CODE); if (m) out.code.push('"' + line.trim().slice(0, 70) + '"'); }
  const lg = document.querySelector('#fuel-sheet-host .vfx-legend');
  if (lg) {
    /* the visible strip = the intersection of every clipping ancestor and the viewport */
    let right = innerWidth, left = 0;
    for (let e = lg.parentElement; e && e !== document.body; e = e.parentElement) { if (getComputedStyle(e).overflowX !== 'visible') { const r = e.getBoundingClientRect(); right = Math.min(right, r.right); left = Math.max(left, r.left); } }
    const own = getComputedStyle(lg).overflowX, scrolls = (own === 'auto' || own === 'scroll') && lg.scrollWidth > lg.clientWidth;
    if (!scrolls) for (const it of lg.querySelectorAll('.vfx-lg')) { const r = it.getBoundingClientRect(); if (r.width && (r.right > right + 0.5 || r.left < left - 0.5)) out.clipped.push('"' + it.textContent.trim() + '" ' + Math.round(r.left) + '..' + Math.round(r.right) + ' > ' + Math.round(right)); }
  } else out.clipped.push('no legend');
  const b = document.getElementById('fuel-dt-basis');
  if (b) { const btn = b.querySelector('button[popovertarget]'), pop = btn && document.getElementById(btn.getAttribute('popovertarget'));
    const line = (b.querySelector('[data-basis-line]') || b).textContent.trim();
    out.basis = { line, len: line.length, btn: !!btn, tab: btn ? btn.tabIndex : -1, h: Math.round(btn ? btn.getBoundingClientRect().height : 0), popText: pop ? pop.textContent.trim() : '' }; }
  const svg = document.querySelector('#fuel-sheet-host svg.hmi-svg'), zone = svg && svg.querySelector('g.hmi-areas rect');
  if (svg && zone) out.band = Math.round(zone.getBoundingClientRect().top - svg.getBoundingClientRect().top);
  return out;
}
async function polish(pg, where) {
  const p = await pg.evaluate(polishLaws);
  if (p.code.length) fail('P1', `${where}: code shown to the reader — ${p.code.slice(0, 3).join('; ')}`);
  if (p.clipped.length) fail('P4', `${where}: legend item past its strip — ${p.clipped.slice(0, 3).join('; ')}`);
  const B = p.basis;
  if (!B || B.len > 90 || !B.btn || B.tab < 0) fail('P2', `${where}: day-tank basis ${JSON.stringify(B && { len: B.len, btn: B.btn, tab: B.tab })} (want one line <= 90 chars + a focusable info button)`);
  else {
    await pg.evaluate(() => document.querySelector('#fuel-dt-basis button[popovertarget]').focus());
    await pg.keyboard.press('Enter'); await sleep(200);
    const open = await pg.evaluate(() => { const b = document.querySelector('#fuel-dt-basis button[popovertarget]'), p = document.getElementById(b.getAttribute('popovertarget')); return !!p && p.matches(':popover-open') && p.getBoundingClientRect().width > 0; });
    if (!open || !/fill/i.test(B.popText) || !/alarm/i.test(B.popText)) fail('P2', `${where}: info control does not open the basis by keyboard (open ${open})`);
    await pg.keyboard.press('Escape'); await sleep(100);
  }
  if (p.band === null || p.band > 24) fail('P3', `${where}: ${p.band} px empty band between the view bar and the drawing (<= 24)`);
  console.log(`${where}: P1 code lines ${p.code.length} · P2 basis "${B && B.line}" · P3 band ${p.band} px · P4 clipped ${p.clipped.length}`);
}
async function f5(pg, where) {
  const s = await pg.evaluate(svgTextLaws, '#fuel-sheet-host svg.hmi-svg');
  if (!s || s.n < 40) { fail('F5', `${where}: sheet measured ${s ? s.n : 0} labels`); return; }
  for (const [k, list] of [['under 11 px', s.small], ['overlap', s.overlap], ['pipe through label', s.edge]]) if (list.length) fail('F5', `${where} sheet ${k}: ${list.length} — ${list.slice(0, 4).join('; ')}`);
  const h = await pg.evaluate(htmlTextLaws);
  if (h.small.length) fail('F5', `${where} page text under 11 px: ${h.small.length} — ${h.small.slice(0, 4).join('; ')}`);
  if (h.scroll > 0) fail('F5', `${where}: page scrolls sideways by ${h.scroll} px`);
  console.log(`${where}: F5 sheet ${s.n} labels min ${s.minPx.toFixed(2)} px · page ${h.n} texts · overflow ${h.scroll}`);
}

/* F4: open the modal on one symbol — click selects (inspector), double-click opens; on a phone the inspector button */
async function openModal(pg, node, W) {
  await pg.evaluate(() => { if (window.RZConvModal && window.RZConvModal.isOpen()) window.RZConvModal.close(); });
  const found = await pg.evaluate((id) => {
    if (window.RZInspector && window.RZInspector.isOpen && window.RZInspector.isOpen()) window.RZInspector.close();
    const g = document.querySelector('#fuel-sheet-host .hmi-node[data-node="' + id + '"]'); if (!g) return false;
    g.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return true;
  }, node);
  if (!found) return false;
  await sleep(300);
  const pt = await pg.evaluate((id) => {
    const g = document.querySelector('#fuel-sheet-host .hmi-node[data-node="' + id + '"]');
    const b = g.querySelector('.b') || g, r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hit: !!(hit && g.contains(hit)), over: hit ? (hit.closest('[id],[class]') || hit).className.toString().slice(0, 40) : '' };
  }, node);
  if (pt && !pt.hit) { fail('F4', `${W} ${node}: symbol covered by "${pt.over}" — a click cannot reach it`); return false; }
  if (!pt) return false;
  await pg.mouse.click(pt.x, pt.y); await sleep(250);
  if (W >= 800) { await pg.mouse.click(pt.x, pt.y, { clickCount: 2 }); await sleep(350); }
  let open = await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden])'));
  if (!open) { const btn = await pg.$('aside.rz-inspector.open [data-rz-open-hmi]'); if (btn) { await btn.click(); await sleep(400); } open = await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden])')); }
  return open;
}
const modalState = (pg) => pg.evaluate(() => {
  const m = document.querySelector('.rz-cvm:not([hidden])'); if (!m) return null;
  return { title: (m.querySelector('#rz-cvm-title') || {}).textContent || '', nav: (m.querySelector('[data-rz-cvm-navn]') || {}).textContent || '',
    cells: m.querySelectorAll('.rz-cvm-cell').length, block: window.RZConvModal.block(), unit: window.RZConvModal.unit(),
    int: !!m.querySelector('[data-rz-cvm-int] svg.hmi-svg') };
});

for (const W of [1440, 390]) {
  const { pg, errs } = await load(W);
  try {
  const where = String(W);
  /* F1 — hall selector, per-hall fleet */
  const btns = await pg.evaluate(() => [...document.querySelectorAll('[data-fuel-hall]')].map((b) => b.getAttribute('data-fuel-hall')));
  if (btns.join() !== HALLS.map((h) => h.code).join()) fail('F1', `${where}: hall buttons ${btns.join()} != listHalls ${HALLS.map((h) => h.code).join()}`);
  const hallsToCheck = W === 1440 ? HALLS : [HALLS[HALLS.length - 1], HALLS[0]];
  for (const h of hallsToCheck) {
    await clickSel(pg, `[data-fuel-hall="${h.code}"]`); await sleep(300);
    const st = await sheetText(pg), ids = Object.keys(st);
    const gens = ids.filter((i) => /^gen\d+$/.test(i)), dts = ids.filter((i) => /^dt\d+$/.test(i)), xvs = ids.filter((i) => /^xv\d+$/.test(i));
    if (gens.length !== h.fleet.length || dts.length !== h.fleet.length || xvs.length !== h.fleet.length) fail('F1', `${where} hall ${h.code}: drew ${gens.length} sets / ${dts.length} tanks / ${xvs.length} valves, engine ${h.fleet.length}`);
    const tags = gens.map((i) => st[i].tag).join();
    if (tags !== h.fleet.map((u) => u.tag).join()) fail('F1', `${where} hall ${h.code}: tags ${tags} != engine ${h.fleet.map((u) => u.tag).join()}`);
    const facts = await pg.evaluate(() => { const e = document.getElementById('fuel-hall-facts'); return e ? { hall: e.getAttribute('data-hall'), sets: +e.getAttribute('data-sets'), site: +e.getAttribute('data-site-sets'), src: e.getAttribute('data-source') || '', text: e.textContent } : null; });
    /* the source is proven from the attribute the page writes, never from visible text (P1: no code shown to the reader) */
    if (!facts || facts.hall !== h.code || facts.sets !== h.fleet.length || facts.site !== SITE || !facts.src.includes(`getFleet('genset', '${h.code}')`) ||
        !facts.src.includes('electrical.genset_count') || !facts.text.includes(' ' + SITE + ' sets'))
      fail('F1', `${where} hall ${h.code}: facts ${JSON.stringify(facts)} (engine ${h.fleet.length} / site ${SITE})`);
    /* F2 NORMAL on this hall */
    const s = await snap(pg), sh = s && s.halls && s.halls.find((x) => x.code === h.code);
    if (!s || s.mode !== 'normal' || !sh) { fail('F2', `${where} hall ${h.code}: no seam snapshot in NORMAL`); continue; }
    const run = sh.sets.filter((u) => u.state !== 'standby' || u.outputKw !== 0);
    if (run.length) fail('F2', `${where} NORMAL hall ${h.code}: ${run.map((u) => u.tag + ' ' + u.state + ' ' + u.outputKw + ' kW').join(', ')}`);
    const loud = gens.filter((i) => /RUNNING/.test(st[i].vals.st || '') || /MW/.test(JSON.stringify(st[i].vals)));
    if (loud.length) fail('F2', `${where} NORMAL hall ${h.code}: sheet shows ${loud.map((i) => st[i].tag + ' ' + JSON.stringify(st[i].vals)).join('; ')}`);
    const openXv = xvs.filter((i) => st[i].vals.st !== 'CLOSED');
    if (openXv.length) fail('F2', `${where} NORMAL hall ${h.code}: valves not CLOSED ${openXv.map((i) => st[i].tag + '=' + st[i].vals.st).join(', ')}`);
    if ((st.p101 && st.p101.vals.st) !== 'STOP') fail('F2', `${where} NORMAL hall ${h.code}: P-101 ${st.p101 && st.p101.vals.st}`);
    if (s.alarms.length) fail('F2', `${where} NORMAL: alarms ${s.alarms.join(', ')}`);
  }
  const listEmpty = await pg.evaluate(() => !!document.querySelector('#alarm-list .alarm-empty'));
  if (!listEmpty) fail('F2', `${where} NORMAL: the page alarm list is not empty`);
  await clickSel(pg, `[data-fuel-hall="${HALLS[0].code}"]`); await sleep(300);
  await pg.evaluate(() => document.querySelector('.pid-panel').scrollIntoView());
  await shot(pg, `fuel-${W}-normal`);
  await f5(pg, `${where} NORMAL`);
  await polish(pg, `${where} NORMAL`);

  /* F2 UTILITY LOSS */
  await clickSel(pg, '[data-fuel-mode="utility-loss"]'); await sleep(400);
  {
    const s = await snap(pg);
    if (!s || s.mode !== 'utility-loss') fail('F2', `${where}: mode button did not switch to utility loss`);
    else for (const h of HALLS) {
      const sh = s.halls.find((x) => x.code === h.code); if (!sh) { fail('F2', `hall ${h.code} missing`); continue; }
      const want = h.fleet.length - EL.genset_spare_per_hall, run = sh.sets.filter((u) => u.state === 'running');
      if (run.length !== want) fail('F2', `${where} UTILITY LOSS hall ${h.code}: ${run.length} running, engine rule ${want}`);
      const over = sh.sets.filter((u, i) => !(u.outputKw <= h.fleet[i].ratingKw + 1e-9));
      if (over.length) fail('F2', `${where} UTILITY LOSS hall ${h.code}: over rating ${over.map((u) => u.tag + ' ' + Math.round(u.outputKw) + ' kW').join(', ')}`);
      const sum = run.reduce((a, u) => a + u.outputKw, 0);
      if (Math.abs(sum - h.loadKw) > 0.5) fail('F2', `${where} UTILITY LOSS hall ${h.code}: running sum ${sum.toFixed(1)} kW != hall load ${h.loadKw} kW`);
    }
    const st = await sheetText(pg), hs = s && s.halls.find((x) => x.code === s.hall);
    if (hs) hs.sets.forEach((u, i) => {
      const t = st['gen' + (i + 1)]; const want = u.state === 'running' ? 'RUNNING' : 'STANDBY';
      if (!t || t.vals.st !== want) fail('F2', `${where} UTILITY LOSS: sheet ${u.tag} reads ${t && t.vals.st}, set is ${want}`);
    });
  }
  await pg.evaluate(() => document.querySelector('.pid-panel').scrollIntoView());
  await shot(pg, `fuel-${W}-utility-loss`);
  await f5(pg, `${where} UTILITY LOSS`);
  await polish(pg, `${where} UTILITY LOSS`);

  if (W === 1440) {
    /* F3 — day tank sized per set burn, fill logic, alarm when fill is unavailable */
    let s = await snap(pg);
    const B = s.basis;
    if (!(B.basisHr >= 1)) fail('F3', `stated basis ${B.basisHr} h at rated burn < 1 h`);
    for (const h of s.halls) h.sets.forEach((u) => {
      const want = B.capHr * u.ratingKw * SFC;
      if (Math.abs(u.dayTank.capL - want) > 0.5) fail('F3', `${u.tag}: capacity ${u.dayTank.capL} L != ${B.capHr} h x ${u.ratingKw} kW x ${SFC}`);
      if (!(u.dayTank.capL / (u.ratingKw * SFC) >= 1)) fail('F3', `${u.tag}: capacity ${Math.round(u.dayTank.capL)} L = ${(u.dayTank.capL / (u.ratingKw * SFC) * 60).toFixed(1)} min of rated burn`);
    });
    let minLow = 1e9, minTag = '', sawOpen = false, sawRun = false;
    for (let i = 0; i < 21; i++) {
      await pg.evaluate(() => window.RZConvSim.tick(20));
      s = await snap(pg);
      for (const h of s.halls) for (const u of h.sets) if (u.state === 'running' && u.dayTank.pct < minLow) { minLow = u.dayTank.pct; minTag = u.tag; }
      const st = await sheetText(pg);
      if (Object.keys(st).some((k) => /^xv\d+$/.test(k) && st[k].vals.st === 'OPEN')) sawOpen = true;
      if (st.p101 && st.p101.vals.st === 'RUN') sawRun = true;
      if (s.alarms.length) fail('F3', `utility loss with fill available raised ${s.alarms.join(', ')}`);
    }
    if (!sawOpen || !sawRun) fail('F3', `fill never seen on the sheet: XV OPEN ${sawOpen}, P-101 RUN ${sawRun}`);
    if (!(minLow >= B.lowPct - 1e-9)) fail('F3', `${minTag} fell to ${minLow.toFixed(2)} % < stated low ${B.lowPct} % (${B.basisHr} h at rated burn) with fill available`);
    console.log(`1440: F3 lowest running day tank ${minLow.toFixed(2)} % (${minTag}), fill seen ${sawOpen && sawRun}`);
    await shot(pg, 'fuel-1440-filling');
    /* LD-101 wet: transfer inhibited -> tanks drain below fill start -> LO alarm per set */
    await pg.evaluate(() => window.RZConvSim.trip('ld101'));
    let lo = [];
    for (let i = 0; i < 30 && !lo.length; i++) {
      await pg.evaluate(() => window.RZConvSim.tick(20));
      s = await snap(pg);
      lo = s.alarms.filter((a) => / LAL-DT-GEN-[A-Z]+\d+ LO$/.test(a));
    }
    const below = s.halls.flatMap((h) => h.sets.filter((u) => u.state === 'running' && u.dayTank.pct < B.fillStartPct).map((u) => u.tag));
    const missing = below.filter((t) => !s.alarms.some((a) => a.includes('LAL-DT-' + t + ' LO')));
    if (!below.length) fail('F3', 'with LD-101 wet no tank drained below fill start in 600 scans');
    if (missing.length) fail('F3', `fill unavailable and below fill start, no LO alarm for ${missing.slice(0, 5).join(', ')}`);
    const domAlarm = await pg.evaluate(() => [...document.querySelectorAll('#alarm-list .alarm-item strong')].map((x) => x.textContent));
    if (!domAlarm.some((t) => /^LAL-DT-GEN-[A-Z]+\d+ LO$/.test(t))) fail('F3', `the page alarm list does not show a day-tank LO alarm (${domAlarm.slice(0, 4).join(', ')})`);
    else console.log(`1440: F3 LD-101 wet -> ${lo.length} LO alarms, e.g. ${lo[0]}`);
    await pg.evaluate(() => document.querySelector('#alarm-list').scrollIntoView({ block: 'center' }));
    await shot(pg, 'fuel-1440-fill-unavailable');
    await pg.evaluate(() => window.RZConvSim.clearTrip('ld101'));
    await pg.evaluate(() => window.resetSimulation());
    await clickSel(pg, '[data-fuel-mode="utility-loss"]'); await sleep(300);
  }

  /* F4 — every genset and day-tank symbol opens the modal on its own unit */
  const hall = HALLS[0], N = hall.fleet.length;
  const ks = W === 1440 ? [...Array(N).keys()].map((i) => i + 1) : [1, N];
  for (const k of ks) for (const kind of ['gen', 'dt']) {
    const ok = await openModal(pg, kind + k, W);
    const m = await modalState(pg), tag = hall.fleet[k - 1].tag;
    if (!ok || !m) { fail('F4', `${where} ${kind}${k}: modal did not open`); continue; }
    if (!m.title.startsWith(tag + ' ')) fail('F4', `${where} ${kind}${k}: title "${m.title}" is not ${tag}`);
    if (/\b(gen|dt|xv)\d+\b/.test(m.title)) fail('F4', `${where} ${kind}${k}: internal id in title "${m.title}"`);
    if (m.cells !== N || m.nav.replace(/\s+/g, ' ').trim() !== `${k} of ${N}`) fail('F4', `${where} ${kind}${k}: navigator "${m.nav}", ${m.cells} fleet cells (want ${k} of ${N})`);
    if (kind === 'dt' && m.block !== 'day-tank') fail('F4', `${where} dt${k}: block ${m.block}, want day-tank`);
    if (!m.int) fail('F4', `${where} ${kind}${k}: no internal drawing`);
    if (k === 1 && kind === 'gen') {
      await pg.click('.rz-cvm:not([hidden]) [data-nav="1"]'); await sleep(300);
      const m2 = await modalState(pg);
      if (!m2 || !m2.title.startsWith(hall.fleet[1].tag + ' ')) fail('F4', `${where}: ▸ from ${tag} gave "${m2 && m2.title}"`);
      const t = await pg.evaluate(svgTextLaws, '.rz-cvm:not([hidden]) [data-rz-cvm-int] svg.hmi-svg');
      if (!t || t.n < 15) fail('F5', `${where} modal drawing measured ${t ? t.n : 0} labels`);
      else for (const [kk, list] of [['under 11 px', t.small], ['overlap', t.overlap], ['pipe through label', t.edge]]) if (list.length) fail('F5', `${where} modal ${kk}: ${list.length} — ${list.slice(0, 4).join('; ')}`);
      if (t) console.log(`${where}: F5 modal ${t.n} labels min ${t.minPx.toFixed(2)} px`);
      await pg.click('.rz-cvm:not([hidden]) [data-nav="-1"]'); await sleep(300);
      await shot(pg, `fuel-${W}-modal-gen1`);
    }
    await pg.keyboard.press('Escape'); await sleep(150);
  }
  } catch (e) { fail('RUN', `${W}: the page could not be driven through the laws — ${String(e.message || e).slice(0, 160)}`); }
  const where2 = String(W);
  if (errs.length) fail('F5', `${where2}: ${errs.length} page errors — ${errs.slice(0, 3).join(' | ')}`);
  await pg.close();
}

await browser.close(); srv.close();
const tag = PLANT ? ` [plant=${PLANT}]` : '';
if (fails.length) { console.log(fails.map((f) => 'FAIL ' + f).join('\n')); console.log(`CONV FUEL TRUTH — FAIL${tag} (${fails.length})`); process.exit(1); }
console.log(`CONV FUEL TRUTH — PASS${tag} (N1–N3, F1 ${HALLS.length} halls × ${EL.genset_per_hall} sets, site ${SITE}; F2 normal + utility loss; F3 fill + LO alarm; F4 modal per unit; F5 1440 + 390)`);
