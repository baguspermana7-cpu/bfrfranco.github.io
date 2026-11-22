#!/usr/bin/env node
/* test-conv-internals-render.mjs — STRICT. The equipment modal v2 shows the INSIDE of a chiller
   (PRD-CONV-EQUIPMENT-TRUTH §4, §5.1, §9; js/conv/internals.js + js/conv/internals/chiller.js; js/conv/equipment-modal.js).
   On chiller-plant.html at 1440 and 390, authorised audit state:
   I1  double-click CH-01 (at 390: its inspector's "Open equipment HMI") opens the modal with an internal drawing whose
       node count >= the block catalogue, every catalogue block drawn, and it is NOT the clicked symbol (P-1: no
       chillerWater symbol, no v1 mimic)
   I2  every catalogue block is clickable: a click on its symbol puts that block in the block detail; Enter on a focused
       block does the same
   I3  every value printed on the drawing equals RZConvInternals.read() of the unit; the numbers re-computed here from
       CONV_CALC (fleet row + snapshot.cooling) equal the printed ones; evaporator duty + compressor input = condenser
       duty within 0.1 % using the DISPLAYED numbers
   I4  fleet strip: one cell per engine unit (10), the running count (7) equals the engine
   I5  navigator 01 -> 08 (eight steps with the ▸ button and the keyboard): CH-08 is standby, no line moves, running-only
       readings are "—", the fleet cell 08 is pressed
   I6  Thermal changes the line colours of a running unit
   I7  reduced motion: nothing in the internal drawing animates (and something does without it — the check can fail)
   I8  text clear: no two labels overlap, no label renders under 11 px, no label outside the drawing, no pipe through a
       label, no label under a foreign symbol body
   I9  Escape closes, focus returns to the opener, no timer left
   I10 no sideways page scroll; the modal is not wider than the viewport; at 390 the nav, fleet cells, close and block
       list are >= 44 px; no "NaN"/"undefined"; no page error
   Usage: node tools/test-conv-internals-render.mjs [--shots=<dir>] [--theme=light] [--plant=<defect>]
   --plant=clone|nomodel|overlap|motion|balance plants one defect so its law goes red (red-before-green proof). */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1];
const SHOTS = arg('shots'), THEME = arg('theme') || 'dark', PLANT = arg('plant') || '';
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
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const fails = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (pg, name) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const SVG = '.rz-cvm:not([hidden]) [data-rz-cvm-int] svg.hmi-svg';

async function load(W, reduced) {
  const pg = await browser.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844, deviceScaleFactor: 1 });
  if (reduced) await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await primeCockpitAuditDocument(pg, THEME);
  await pg.goto(ORIGIN + 'chiller-plant.html', { waitUntil: 'networkidle0', timeout: 90000 });
  await enterAuthorizedAuditState(pg, 'chiller-plant');
  await pg.waitForFunction(() => document.querySelector('#chw-sheet-host .hmi-node[data-node="ch1"]'), { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  if (PLANT) await pg.evaluate((pl) => {
    const R = window.RZConvInternals, d = R && R.get('chiller'); if (!d) return;
    if (pl === 'clone') d.sheet = function () { return { id: 'x', no: 'X', title: 'clone', size: [200, 200], minScale: 1, nodes: [{ id: 'ch1', tag: 'CH-01', sym: 'chillerWater', x: 100, y: 100, size: 72 }], edges: [], areas: [], notes: [] }; };
    if (pl === 'nomodel') { const m0 = d.model; d.model = function (u, s) { const m = m0(u, s); m.superheat = 1.5; return m; }; }
    if (pl === 'balance') { const m0 = d.model; d.model = function (u, s) { const m = m0(u, s); if (m.running) m.condDuty = m.evapDuty; return m; }; }
    if (pl === 'overlap') d.sheet = (function (f) { return function (u) { const s = f(u), a = s.nodes.find((n) => n.id === 'cdws'); s.nodes = s.nodes.map((n) => n.id === 'cdwr' ? Object.assign({}, n, { x: a.x + 8, y: a.y + 6 }) : n); return s; }; })(d.sheet);
    if (pl === 'motion') { const f0 = d.flow; d.flow = function (u, k) { return k === 'chwr' ? 'running' : f0(u, k); }; }
  }, PLANT);
  return { pg, errs };
}

async function openCh1(pg, W) {
  const pt = await pg.evaluate(() => {
    const g = document.querySelector('#chw-sheet-host .hmi-node[data-node="ch1"]'); g.scrollIntoView({ block: 'center', inline: 'center' });
    const b = g.querySelector('.b') || g; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await pg.mouse.click(pt.x, pt.y); await sleep(400);
  let open = await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden])'));
  /* R186: one click opens the inside; the double-click is the fallback of a page without that wiring */
  if (!open && W >= 800) { await pg.mouse.click(pt.x, pt.y, { clickCount: 2 }); await sleep(400); open = await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden])')); }
  let opener = 'symbol';
  if (!open) {
    const btn = await pg.$('aside.rz-inspector.open [data-rz-open-hmi]');
    if (btn) { await btn.click(); await sleep(400); opener = 'button'; }
    open = await pg.evaluate(() => !!document.querySelector('.rz-cvm:not([hidden])'));
  }
  await sleep(300);
  return { open, opener };
}

/* in-page: the drawing as text boxes + checks I8 */
function textLaws() {
  const svg = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-int] svg.hmi-svg'); if (!svg) return null;
  const vb = svg.viewBox.baseVal, sr = svg.getBoundingClientRect(), scale = sr.width / vb.width;
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let x = e; x && x !== svg; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const texts = [...svg.querySelectorAll('g.hmi-text text, g.hmi-lines text')].filter((t) => t.textContent.trim() && vis(t)).map((t) => {
    const r = t.getBoundingClientRect();
    return { t, id: (t.getAttribute('data-tag-of') || t.getAttribute('data-val') || t.getAttribute('data-role')) + ' "' + t.textContent.trim().slice(0, 22) + '"',
      x0: r.left + 0.75, y0: r.top + 0.75, x1: r.right - 0.75, y1: r.bottom - 0.75, owner: t.getAttribute('data-tag-of') || (t.getAttribute('data-val') || '').split(':')[0] || null,
      px: parseFloat(getComputedStyle(t).fontSize) * scale };
  });
  const out = { n: texts.length, overlap: [], small: [], clipped: [], edge: [], body: [], minPx: 99 };
  for (const a of texts) out.minPx = Math.min(out.minPx, a.px);
  for (const a of texts) if (a.px < 11 - 0.01) out.small.push(a.id + ' ' + a.px.toFixed(2) + ' px');
  for (const a of texts) if (a.x0 < sr.left - 0.5 || a.x1 > sr.right + 0.5 || a.y0 < sr.top - 0.5 || a.y1 > sr.bottom + 0.5) out.clipped.push(a.id);
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j], w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w > 0.5 && h > 0.5) out.overlap.push(a.id + ' × ' + b.id);
  }
  const inside = (b, x, y) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
  for (const e of [...svg.querySelectorAll('g.hmi-edges > path.hmi-edge:not(.hmi-flow)')].filter(vis)) {
    const m = e.getScreenCTM(); if (!m) continue; const L = e.getTotalLength();
    for (let s = 0; s <= L; s += 1) { const p = e.getPointAtLength(s), x = m.a * p.x + m.c * p.y + m.e, y = m.b * p.x + m.d * p.y + m.f;
      for (const b of texts) if (inside(b, x, y)) { out.edge.push(b.id + ' × ' + e.getAttribute('data-edge')); b.x1 = -1e9; } }
  }
  for (const n of svg.querySelectorAll('g.hmi-nodes .hmi-node')) {
    const id = n.getAttribute('data-node'), body = n.querySelector('.b'); if (!body) continue; const r = body.getBoundingClientRect();
    for (const b of texts) { if (b.owner === id) continue; const w = Math.min(r.right, b.x1) - Math.max(r.left, b.x0), h = Math.min(r.bottom, b.y1) - Math.max(r.top, b.y0);
      if (w > 1.5 && h > 1.5) out.body.push(b.id + ' under ' + id); }
  }
  return out;
}

/* in-page: what the drawing prints vs RZConvInternals.read, and the independent recomputation */
function valueLaws(i) {
  const R = window.RZConvInternals, C = window.CONV_CALC, svg = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-int] svg.hmi-svg');
  const u = C.getFleet('chiller')[i], s = C.snapshot, c = s.cooling, rd = R.read('chiller', u, s), bad = [];
  let n = 0;
  Object.keys(rd).forEach((id) => Object.keys(rd[id].values).forEach((k) => {
    const t = svg.querySelector('[data-val="' + id + ':' + k + '"]'); n++;
    if (!t) bad.push('missing ' + id + ':' + k); else if (t.textContent !== rd[id].values[k].text) bad.push(id + ':' + k + ' shows "' + t.textContent + '" model "' + rd[id].values[k].text + '"');
  }));
  const tx = (id, k) => { const t = svg.querySelector('[data-val="' + id + ':' + k + '"]'); return t ? t.textContent : ''; };
  const num = (str) => { const m = /-?\d+(?:\.\d+)?/.exec(str || ''); return m ? Number(m[0]) : NaN; };
  const run = u.state === 'running', f1 = (v) => v.toFixed(1);
  /* independent: the fleet row and snapshot keys, formatted the way an operator reads them */
  const want = run ? {
    'evap:duty': f1(u.dutyKwTh) + ' kWth', 'cond:duty': f1(u.condenserDutyKwTh) + ' kWth', 'cp:kw': f1(u.inputKwE) + ' kWe', 'cp:load': 'LOAD ' + f1(u.loadPct) + ' %',
    'chws:t': f1(c.chws_c) + ' °C', 'chwr:t': f1(c.chwr_c) + ' °C', 'chws:q': f1(u.chwFlowLps) + ' L/s', 'cdws:t': f1(c.cdw_supply_c) + ' °C', 'cdwr:t': f1(c.cdw_return_c) + ' °C',
    'cdws:q': f1(u.cdwFlowLps) + ' L/s', 'evap:sat': 'SAT ' + f1(c.chiller_evap_sat_c) + ' °C', 'cond:sat': 'SAT ' + f1(c.chiller_cond_sat_c) + ' °C',
    'evap:p': 'P ' + c.chiller_evap_sat_kpa_abs.toFixed(0) + ' kPa(a)', 'cond:p': 'P ' + c.chiller_cond_sat_kpa_abs.toFixed(0) + ' kPa(a)',
    'ucp:cop': 'COP ' + (u.dutyKwTh / u.inputKwE).toFixed(2), 'ucp:lift': 'LIFT ' + f1(c.chiller_lift_k) + ' K', 'ucp:pr': 'PR ' + c.chiller_pressure_ratio.toFixed(3),
    'ucp:carnot': 'CARNOT ' + c.chiller_carnot_fraction.toFixed(3),
    /* engine 2.5.0 refrigeration cycle (PRD-CONV-EQUIPMENT-INSIDE P2) */
    'evap:sh': 'SH ' + f1(c.chiller_superheat_k) + ' K', 'cond:sc': 'SC ' + f1(c.chiller_subcool_k) + ' K', 'igv:pos': 'POS ' + f1(c.chiller_igv_pct) + ' %',
    'cp:td': 'TD ' + f1(c.chiller_discharge_c) + ' °C', 'op:p': 'P not modelled'
  } : {
    'evap:duty': '0.0 kWth', 'cp:kw': '0.0 kWe', 'chws:q': '0.0 L/s', 'chws:t': '—', 'chwr:t': '—', 'evap:sat': 'SAT —', 'cond:sat': 'SAT —', 'ucp:cop': 'COP —',
    'ucp:lift': 'LIFT —', 'evap:sh': 'SH —', 'cp:td': 'TD —', 'op:p': 'P not modelled'
  };
  Object.keys(want).forEach((k) => { const [id, v] = k.split(':'); if (tx(id, v) !== want[k]) bad.push('recomputed ' + k + ' want "' + want[k] + '" shows "' + tx(id, v) + '"'); });
  let balance = null;
  if (run) { const e = num(tx('evap', 'duty')), w = num(tx('cp', 'kw')), q = num(tx('cond', 'duty')); balance = Math.abs(e + w - q) / q; }
  /* "not modelled" readings must never be a number */
  ['op:p'].forEach((k) => { const [id, v] = k.split(':'); if (/\d/.test(tx(id, v))) bad.push(k + ' is a number: "' + tx(id, v) + '"'); });
  return { n, bad, balance, state: u.state };
}

for (const W of [1440, 390]) {
  const { pg, errs } = await load(W, false);
  const where = `chiller-plant@${W}`;
  const o = await openCh1(pg, W);
  if (!o.open) { fails.push(where + ' I1 modal did not open'); await pg.close(); continue; }
  /* I1 */
  const i1 = await pg.evaluate(() => {
    const R = window.RZConvInternals, d = R && R.get('chiller'), m = document.querySelector('.rz-cvm:not([hidden])');
    const svg = m.querySelector('[data-rz-cvm-int] svg.hmi-svg'); if (!svg || !d) return { none: true };
    const nodes = [...svg.querySelectorAll('.hmi-node[data-node]')].map((g) => ({ id: g.getAttribute('data-node'), sym: g.getAttribute('data-sym') }));
    const missing = d.blocks.filter((b) => !nodes.some((n) => n.id === b.node)).map((b) => b.id);
    const untagged = d.blocks.filter((b) => !svg.querySelector('text[data-tag-of="' + b.node + '"]')).map((b) => b.id);
    const norole = d.blocks.filter((b) => !(b.role && b.role.length === 2 && b.role.every((l) => l && l.length > 12))).map((b) => b.id);
    return { n: nodes.length, blocks: d.blocks.length, missing, untagged, norole, chiller: nodes.filter((n) => n.sym === 'chillerWater').length, syms: new Set(nodes.map((n) => n.sym)).size,
      mimic: !!m.querySelector('[data-rz-cvm-mimic]'), unit: window.RZConvModal.unit() };
  });
  if (i1.none) fails.push(where + ' I1 no internal drawing in the modal (P-1)');
  else {
    if (i1.n < i1.blocks) fails.push(`${where} I1 ${i1.n} nodes < ${i1.blocks} catalogue blocks`);
    if (i1.missing.length) fails.push(`${where} I1 blocks not drawn: ${i1.missing.join(', ')}`);
    if (i1.untagged.length) fails.push(`${where} I1 blocks without a tag: ${i1.untagged.join(', ')}`);
    if (i1.norole.length) fails.push(`${where} I1 blocks without a two-line role: ${i1.norole.join(', ')}`);
    if (i1.chiller || i1.syms < 8 || i1.mimic) fails.push(`${where} I1 the drawing is the clicked symbol (P-1): chillerWater ${i1.chiller}, ${i1.syms} symbol kinds, v1 mimic ${i1.mimic}`);
    if (i1.unit !== 0) fails.push(`${where} I1 opened unit ${i1.unit}, want 0 (CH-01)`);
  }
  console.log(`${where}: opened by ${o.opener}; ${i1.n} nodes, ${i1.blocks} blocks, ${i1.syms} symbol kinds`);
  if (i1.none || i1.missing.length) { if (errs.length) fails.push(`${where} page error: ${errs[0].slice(0, 160)}`); await pg.close(); continue; }   /* nothing below can be measured on a drawing that is not there */
  await shot(pg, `modal-ch01-${THEME}-${W}-state`);
  if (W < 800) { await pg.evaluate(() => { const p = document.querySelector('.rz-cvm-panel'); p.scrollTop = p.querySelector('[data-rz-cvm-detail]').getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop - 40; }); await sleep(200); await shot(pg, `modal-ch01-${THEME}-${W}-scrolled`); await pg.evaluate(() => { document.querySelector('.rz-cvm-panel').scrollTop = 0; }); }
  /* I8 text */
  const t8 = await pg.evaluate(textLaws);
  if (!t8 || t8.n < 20) fails.push(`${where} I8 measured ${t8 ? t8.n : 0} labels — no drawing`);
  else {
    for (const [k, list] of [['overlap', t8.overlap], ['under 11 px', t8.small], ['clipped', t8.clipped], ['pipe through label', t8.edge], ['under foreign body', t8.body]])
      if (list.length) fails.push(`${where} I8 ${k}: ${list.length} — ${list.slice(0, 5).join('; ')}`);
    console.log(`${where}: I8 ${t8.n} labels, smallest ${t8.minPx.toFixed(2)} px`);
  }
  /* I3 values */
  const v3 = await pg.evaluate(valueLaws, 0);
  if (v3.bad.length) fails.push(`${where} I3 ${v3.bad.length} value(s) wrong — ${v3.bad.slice(0, 5).join('; ')}`);
  if (v3.balance == null || v3.balance > 0.001) fails.push(`${where} I3 energy balance on the displayed numbers: |evap + input - cond| / cond = ${v3.balance}`);
  console.log(`${where}: I3 ${v3.n} drawn values = model; balance ${v3.balance != null ? (v3.balance * 100).toFixed(4) + ' %' : '—'}`);
  /* I4 fleet strip */
  const f4 = await pg.evaluate(() => { const f = window.CONV_CALC.getFleet('chiller'); const c = [...document.querySelectorAll('.rz-cvm:not([hidden]) .rz-cvm-cell')];
    return { cells: c.length, run: c.filter((x) => x.getAttribute('data-vstate') === 'running').length, n: f.length, er: f.filter((u) => u.state === 'running').length }; });
  if (f4.cells !== f4.n || f4.run !== f4.er || f4.n !== 10 || f4.er !== 7) fails.push(`${where} I4 fleet strip ${f4.cells} cells / ${f4.run} running; engine ${f4.n} / ${f4.er} (want 10 / 7)`);
  /* I2 blocks clickable (+ Enter on one) */
  const blocks = await pg.evaluate(() => window.RZConvInternals.get('chiller').blocks.map((b) => ({ id: b.id, node: b.node })));
  const nb = await pg.evaluate(() => window.RZConvInternals.get('chiller').nodeBlock || {});
  let clicked = 0;
  for (const b of blocks) {
    const pt = await pg.evaluate((node) => {
      const g = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-int] .hmi-node[data-node="' + node + '"]'); if (!g) return null;
      const vp = g.closest('.hmi-vp'), body = g.querySelector('.b') || g.querySelector('.hmi-hit');
      let r = body.getBoundingClientRect(); const vr = vp.getBoundingClientRect();
      if (r.left < vr.left + 4 || r.right > vr.right - 4) { vp.scrollLeft += (r.left + r.width / 2) - (vr.left + vr.width / 2); }
      g.scrollIntoView({ block: 'center', inline: 'nearest' }); r = body.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, b.node);
    if (!pt) { fails.push(`${where} I2 ${b.id}: node ${b.node} not found`); continue; }
    await pg.mouse.click(pt.x, pt.y); await sleep(120);
    const got = await pg.evaluate(() => { const h = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-block]'); return h ? h.getAttribute('data-rz-cvm-block') : null; });
    if (got !== b.id) fails.push(`${where} I2 click on ${b.node} shows block "${got}", want "${b.id}"`); else clicked++;
  }
  const out = Object.keys(nb);
  for (const id of out.slice(0, 1)) {
    await pg.evaluate((node) => { const g = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-int] .hmi-node[data-node="' + node + '"]'); g.focus(); }, id);
    await pg.keyboard.press('Enter'); await sleep(120);
    const got = await pg.evaluate(() => document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-block]').getAttribute('data-rz-cvm-block'));
    if (got !== nb[id]) fails.push(`${where} I2 Enter on ${id} shows "${got}", want "${nb[id]}"`);
  }
  console.log(`${where}: I2 ${clicked}/${blocks.length} blocks select on click`);
  await pg.evaluate(() => { const g = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-int] .hmi-node[data-node="evap"]'); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await sleep(150);
  await pg.evaluate(() => { const vp = document.querySelector('.rz-cvm:not([hidden]) .hmi-vp'); if (vp) vp.scrollLeft = 0; document.querySelector('.rz-cvm-panel').scrollTop = 0; });
  await shot(pg, `modal-ch01-${THEME}-${W}-block-evaporator`);
  /* I6 Thermal */
  const strokes = () => pg.evaluate(() => [...document.querySelectorAll('.rz-cvm:not([hidden]) [data-rz-cvm-int] path.hmi-edge[data-vstate]:not(.hmi-flow)')].map((p) => getComputedStyle(p).stroke).join('|'));
  const s0 = await strokes();
  const hasT = await pg.$('.rz-cvm:not([hidden]) [data-vfx-set="thermal"]');
  if (!hasT) fails.push(`${where} I6 no Thermal option on a running unit`);
  else {
    await hasT.click(); await sleep(250);
    const s1 = await strokes();
    if (s0 === s1) fails.push(`${where} I6 Thermal changed no line colour`);
    await shot(pg, `modal-ch01-${THEME}-${W}-thermal`);
    const st = await pg.$('.rz-cvm:not([hidden]) [data-vfx-set="state"]'); if (st) { await st.click(); await sleep(150); }
  }
  /* motion exists on a running unit (the I5/I7 checks can fail) */
  const moving = () => pg.evaluate(() => { const svg = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-int] svg.hmi-svg'); if (!svg) return -1;
    return document.getAnimations().filter((a) => a.effect && a.effect.target && svg.contains(a.effect.target) && a.playState === 'running').length; });
  const m01 = await moving();
  if (!(m01 > 0)) fails.push(`${where} I5 nothing moves on running CH-01 (${m01}) — the standby check below could not fail`);
  /* I5 navigator 01 -> 08: 4 clicks on ▸, 3 ArrowRight on the navigator */
  for (let k = 0; k < 4; k++) { await pg.click('.rz-cvm:not([hidden]) [data-nav="1"]'); await sleep(150); }
  await pg.focus('.rz-cvm:not([hidden]) [data-nav="1"]');
  for (let k = 0; k < 3; k++) { await pg.keyboard.press('ArrowRight'); await sleep(150); }
  const n5 = await pg.evaluate(() => { const m = document.querySelector('.rz-cvm:not([hidden])');
    return { nav: m.querySelector('[data-rz-cvm-navn]').textContent, chip: m.querySelector('[data-rz-cvm-state]').getAttribute('data-rz-cvm-state'), unit: window.RZConvModal.unit(),
      pressed: (m.querySelector('.rz-cvm-cell[aria-pressed="true"]') || {}).getAttribute ? m.querySelector('.rz-cvm-cell[aria-pressed="true"]').getAttribute('data-unit') : null,
      vmove: m.querySelectorAll('[data-rz-cvm-int] [data-vmove]').length, focusIn: m.contains(document.activeElement) }; });
  if (n5.nav !== '08 of 10' || n5.unit !== 7 || n5.chip !== 'standby' || n5.pressed !== '7') fails.push(`${where} I5 navigator: "${n5.nav}", unit ${n5.unit}, state ${n5.chip}, pressed cell ${n5.pressed}`);
  if (!n5.focusIn) fails.push(`${where} I5 focus left the modal while stepping`);
  await sleep(300);
  const m08 = await moving();
  if (n5.vmove || m08) fails.push(`${where} I5 CH-08 standby has moving lines: ${n5.vmove} marked, ${m08} animations`);
  const v5 = await pg.evaluate(valueLaws, 7);
  if (v5.state !== 'standby' || v5.bad.length) fails.push(`${where} I5 CH-08 values: state ${v5.state}; ${v5.bad.slice(0, 5).join('; ')}`);
  await shot(pg, `modal-ch08-${THEME}-${W}-standby`);
  /* I10 layout */
  const l10 = await pg.evaluate((W) => { const m = document.querySelector('.rz-cvm:not([hidden])'), p = m.querySelector('.rz-cvm-panel'), r = p.getBoundingClientRect();
    const small = W < 800 ? [...m.querySelectorAll('.rz-cvm-nav button, .rz-cvm-cell, .rz-cvm-close, .rz-cvm-bsel')].filter((b) => { const q = b.getBoundingClientRect(); return q.height < 44 - 0.5 || q.width < 44 - 0.5; }).map((b) => b.getAttribute('aria-label') || b.className) : [];
    return { page: document.documentElement.scrollWidth - innerWidth, panel: p.scrollWidth - p.clientWidth, right: r.right - innerWidth, small, nan: /NaN|undefined/.test(p.textContent) }; }, W);
  if (l10.page > 1 || l10.panel > 1 || l10.right > 1) fails.push(`${where} I10 sideways: page +${l10.page}, panel +${l10.panel}, panel right +${l10.right}`);
  if (l10.small.length) fails.push(`${where} I10 controls under 44 px: ${l10.small.slice(0, 5).join(', ')}`);
  if (l10.nan) fails.push(`${where} I10 NaN/undefined printed`);
  /* I9 Escape + focus return */
  await pg.keyboard.press('Escape'); await sleep(200);
  const e9 = await pg.evaluate(() => { const a = document.activeElement; return { closed: !!document.querySelector('.rz-cvm[hidden]'), timers: window.RZConvModal.timers(),
    back: a ? (a.getAttribute('data-node') || (a.hasAttribute('data-rz-open-hmi') ? 'open-hmi' : a.tagName)) : null }; });
  const wantBack = o.opener === 'symbol' ? 'ch1' : 'open-hmi';
  if (!e9.closed || e9.timers || e9.back !== wantBack) fails.push(`${where} I9 Escape: closed ${e9.closed}, timers ${e9.timers}, focus on ${e9.back} (want ${wantBack})`);
  if (errs.length) fails.push(`${where} I10 page error: ${errs[0].slice(0, 160)}`);
  await pg.close();
}
/* I7 reduced motion */
{
  const { pg, errs } = await load(1440, true);
  const o = await openCh1(pg, 1440);
  const n = o.open ? await pg.evaluate(() => { const svg = document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-int] svg.hmi-svg'); if (!svg) return -1;
    return document.getAnimations().filter((a) => a.effect && a.effect.target && svg.contains(a.effect.target) && a.playState === 'running').length; }) : -1;
  if (n !== 0) fails.push(`chiller-plant@1440 reduced motion: ${n} animation(s) in the internal drawing`);
  console.log(`chiller-plant@1440 reduced motion: ${n} animations`);
  if (errs.length) fails.push(`reduced motion page error: ${errs[0].slice(0, 160)}`);
  await pg.close();
}
await browser.close(); srv.close();
if (fails.length) { console.log(fails.slice(0, 50).join('\n')); console.log(`\nCONV INTERNALS RENDER — FAIL (${fails.length})`); process.exit(1); }
console.log('\nCONV INTERNALS RENDER — PASS (CH-01 inside drawn, blocks select, values = model = engine, balance, fleet 10/7, CH-08 standby still, Thermal, reduced motion, text clear, Escape + focus, no sideways scroll)');
