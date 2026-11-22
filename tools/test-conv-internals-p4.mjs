#!/usr/bin/env node
/* test-conv-internals-p4.mjs — PRD-CONV-EQUIPMENT-INSIDE phase P4 (P4-ELECTRICAL.md): the INSIDE of the electrical plant
   on EPMS_Telemetry.html. Node part (engine 2.6.0, js/conv/epms-lv.js 1.2.0, no browser):
   EL0  the engine 2.6.0 electrical keys exist and equal their formulas, recomputed HERE from other engine keys:
        ups_system_in_kw = ups_system_kw / ups_efficiency, ups_system_loss_kw = in - out, systems x loss = ups_loss_kw;
        dist_tx_loss_kw_normal = (P0 + Pk L^2)/1000 at the DESIGN load L = dist_tx_load_pct_normal / 100 (G6),
        dist_tx_eff_normal = P / (P + loss), P = kVA L pf
   EL0s the source file data/sources/eu-548-2014/README.md (Table I.2 3 150 kVA Tier 2, Table I.7 63 MVA Tier 2) is parsed
        here and the engine equals it (two independent transcriptions; the dry type selects Table I.2)
   EL-G1 the E-S-102 simulation books the UPS loss at the UPS: rectifier kW = inverter kW / eta; the transformer load and
        the stream's served total equal what 1.1.0 gave (the loss moved out of the mech load, nothing added)
   Red on c0dd01dbf (engine 2.5.0: keys missing; epms-lv 1.1.0: REC = INV).
   node tools/test-conv-internals-p4.mjs [--node-only] */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);

const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const near = (a, b, tol) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol;

global.window = global;
require('../js/conv-engine.js');
for (const f of ['sld-topology', 'epms-sim', 'epms-sheet', 'epms-lv']) require('../js/conv/' + f + '.js');
const C = window.CONV_CALC, E = C.snapshot.electrical;

/* ---------- EL0 ---------- */
const NEW = ['dist_tx_type', 'dist_tx_p0_w', 'dist_tx_pk_w', 'hv_tx_pei_min', 'dist_tx_loss_kw_normal', 'dist_tx_eff_normal',
  'ups_system_in_kw', 'ups_system_loss_kw'];
for (const k of NEW) ok(E[k] !== undefined && E[k] !== null, `EL0 electrical.${k} missing`);
const inKw = E.ups_system_kw / E.ups_efficiency;
ok(near(E.ups_system_in_kw, inKw, 0.05), `EL0 ups_system_in_kw ${E.ups_system_in_kw}, recomputed ${inKw}`);
ok(near(E.ups_system_loss_kw, inKw - E.ups_system_kw, 0.05), `EL0 ups_system_loss_kw ${E.ups_system_loss_kw}, recomputed ${inKw - E.ups_system_kw}`);
ok(near(E.ups_system_loss_kw * E.ups_system_count, E.ups_loss_kw, 0.1), `EL0 ${E.ups_system_count} x ups_system_loss_kw ${E.ups_system_loss_kw} != ups_loss_kw ${E.ups_loss_kw}`);
const L = E.dist_tx_load_pct_normal / 100;
const loss = (E.dist_tx_p0_w + E.dist_tx_pk_w * L * L) / 1000, P = E.dist_tx_kva * L * E.power_factor_design;
/* the published load % is rounded to 0.1, so L carries +-0.0005: d(loss)/dL = 2 Pk L = 21 W per 0.001 -> +-0.011 kW */
ok(near(E.dist_tx_loss_kw_normal, loss, 0.012), `EL0 dist_tx_loss_kw_normal ${E.dist_tx_loss_kw_normal}, recomputed ${loss}`);
ok(near(E.dist_tx_eff_normal, P / (P + loss), 0.00002), `EL0 dist_tx_eff_normal ${E.dist_tx_eff_normal}, recomputed ${P / (P + loss)}`);
ok(E.dist_tx_eff_normal > 0.99 && E.dist_tx_eff_normal < 1, `EL0 dist_tx_eff_normal ${E.dist_tx_eff_normal} outside 0.99-1`);

/* ---------- EL0s ---------- */
const src = readFileSync(new URL('../data/sources/eu-548-2014/README.md', import.meta.url), 'utf8');
const sect = (title) => { const i = src.indexOf(title); return i < 0 ? '' : src.slice(i, src.indexOf('\n## ', i + 1) > 0 ? src.indexOf('\n## ', i + 1) : undefined); };
const grab = (s) => [...s.matchAll(/\(([\d\s]+)\)/g)].map((m) => +m[1].replace(/\s/g, ''));
const rowOf = (s, lead) => (s.split('\n').find((l) => l.startsWith('| ' + lead + ' |')) || '');
const t2 = grab(rowOf(sect('## Table I.2'), '3 150'));         /* Tier1 Pk, Tier1 P0, Tier2 Pk, Tier2 P0 */
ok(t2.length === 4, `EL0s Table I.2 3 150 kVA row not parsed (${t2.join(',')})`);
ok(E.dist_tx_type === 'dry', `EL0s dist_tx_type ${E.dist_tx_type}: the source file applies Table I.2 (dry) only`);
ok(E.dist_tx_pk_w === t2[2], `EL0s dist_tx_pk_w ${E.dist_tx_pk_w} != Table I.2 Tier 2 Pk ${t2[2]}`);
ok(E.dist_tx_p0_w === t2[3], `EL0s dist_tx_p0_w ${E.dist_tx_p0_w} != Table I.2 Tier 2 P0 ${t2[3]}`);
const pei = rowOf(sect('## Table I.7'), String(E.hv_tx_mva)).split('|').map((x) => x.trim()).filter(Boolean);
ok(pei.length === 3, `EL0s Table I.7 row for ${E.hv_tx_mva} MVA not found`);
const peiT2 = pei.length === 3 ? +pei[2].replace(',', '.') / 100 : NaN;
ok(near(E.hv_tx_pei_min, peiT2, 1e-9), `EL0s hv_tx_pei_min ${E.hv_tx_pei_min} != Table I.7 Tier 2 ${peiT2}`);

/* ---------- EL-G1 ---------- */
const LV = window.RZEpmsLv, b = LV.basis(C.snapshot);
const sh = LV.build(0, C.snapshot, C.getFleet('genset', 'A'));
const res = LV.solve(sh, LV.normalState(sh), b);
const dev = (id) => res.dev[id] || {};
for (const s of ['a', 'b']) {
  const rec = dev('u' + s + '-rec').kw, inv = dev('u' + s + '-inv').kw, tx = dev('t' + s + '-tx').kw;
  ok(near(rec, inv / E.ups_efficiency, 0.1), `EL-G1 REC-A${s.toUpperCase()} ${rec} kW, expected INV ${inv} / ${E.ups_efficiency} = ${inv / E.ups_efficiency}`);
  const hall = C.snapshot.campus.halls[0], streams = E.dist_tx_streams;
  ok(near(tx, hall.facility_load_kw / streams, 0.1), `EL-G1 TX-A${s.toUpperCase()} ${tx} kW, expected the stream share ${hall.facility_load_kw / streams} (unchanged by the UPS loss move)`);
}
const sum = LV.summary(sh, LV.normalState(sh), res);
ok(near(sum.servedKw, C.snapshot.campus.halls[0].facility_load_kw, 0.5), `EL-G1 served ${sum.servedKw} kW != hall facility ${C.snapshot.campus.halls[0].facility_load_kw}`);

/* ---------- EL1 / EL1b / EL3 (node): the classes, their engine rows, their not-modelled rows, the adapter ---------- */
window.RZConvInternals = require('../js/conv/internals.js');
require('../js/conv/epms-internals.js');
for (const f of ['transformer', 'ups']) require('../js/conv/internals/' + f + '.js');
const R = window.RZConvInternals, I = window.RZEpmsInternals, SIMV = window.RZEpmsSim;
const num = (t) => parseFloat(String(t).replace(/,/g, ''));
const decimals = (t) => { const m = /\.(\d+)/.exec(String(t).split(' ')[0]); return m ? m[1].length : 0; };
const NM_ROWS = { hv_tx: ['Losses', 'Winding temperature', 'Buchholz', 'Cooling state', 'Tap position', 'Surge counter', 'Neutral current'],
  dist_tx: ['Winding temperature', 'Cooling state', 'Off-circuit tap', 'Surge counter', 'Neutral current'],
  ups: ['Part-load efficiency', 'Autonomy', 'State of charge', 'DC bus voltage', 'Battery temperature', 'Maintenance bypass'] };
const e101 = window.RZEpmsSheets.sld, st101 = SIMV.normalState(e101), r101 = SIMV.solve(e101, st101, SIMV.basis(C.snapshot));
const st102 = LV.normalState(sh);
const UNITS = { hv_tx: I.txUnits(e101, st101, r101).filter((u) => u.classKey === 'hv_tx'),
  dist_tx: I.txUnits(e101, st101, r101).filter((u) => u.classKey === 'dist_tx').concat(I.txUnits(sh, st102, res)),
  ups: I.upsUnits(sh, st102, res) };
ok(UNITS.hv_tx.length === 2 && UNITS.dist_tx.length === 4 && UNITS.ups.length === 2, `EL3 adapter units hv ${UNITS.hv_tx.length} / dist ${UNITS.dist_tx.length} / ups ${UNITS.ups.length}, expected 2 / 4 / 2`);
for (const k of Object.keys(UNITS)) {
  ok(R.has(k), `EL1 ${k}: not registered`); if (!R.has(k)) continue;
  for (const u of UNITS[k]) for (const b of R.get(k).blocks) {
    const d = R.detail(k, b.id, u, C.snapshot), spec = b.values;
    d.rows.forEach((r, i) => {
      const v = spec[i] || {};
      if (r.basis && /^electrical\./.test(r.basis)) {
        const ev = E[r.basis.slice(11)], scale = (R.FMT[v.fmt] || {}).x || 1;
        if (typeof ev === 'number') ok(Math.abs(num(r.text) - ev * scale) <= 0.5 * Math.pow(10, -decimals(r.text)) + 1e-9, `EL1 ${k} ${u.tag}/${b.id} "${r.label}": prints ${r.text}, engine ${r.basis} = ${ev}`);
        else ok(r.text === String(ev), `EL1 ${k} ${u.tag}/${b.id} "${r.label}": prints ${r.text}, engine ${ev}`);
      } else if (r.text === 'not modelled') ok(NM_ROWS[k].includes(r.label), `EL1 ${k}/${b.id} "${r.label}" reads not modelled but is not declared`);
      else ok(v.sim || ['Voltage ratio', 'Breaker', 'Modules', 'Resistance'].includes(r.label) || /present load/.test(r.label), `EL1 ${k}/${b.id} "${r.label}" = ${r.text} has neither an engine basis nor the simulation as its source`);
    });
    for (const lbl of NM_ROWS[k]) { const r = d.rows.find((x) => x.label === lbl); if (r) ok(r.text === 'not modelled', `EL1 ${k}/${b.id} "${lbl}" = ${r.text}, expected not modelled`); }
  }
}
/* EL3 (node part): the drawing's simulated values are the solve's, device by device */
for (const u of UNITS.dist_tx.concat(UNITS.hv_tx)) {
  const k = u.classKey, rd = R.read(k, u, C.snapshot), dev = (e101.nodes.some((n) => n.id === u.id) ? r101 : res).dev[u.id];
  ok(rd.tx.values.ld.text === 'LOAD ' + dev.pct.toFixed(1) + ' %', `EL3 ${u.tag}: drawn ${rd.tx.values.ld.text}, solve ${dev.pct}`);
  ok(rd.tx.values.kw.text === (dev.kw / u.units).toFixed(1) + ' kW', `EL3 ${u.tag}: drawn ${rd.tx.values.kw.text}, solve ${dev.kw} / ${u.units}`);
  if (k === 'dist_tx') { const L = dev.pct / 100, lo = (E.dist_tx_p0_w + E.dist_tx_pk_w * L * L) / 1000;
    ok(rd.tx.values.ls.text === 'LOSS ≤ ' + lo.toFixed(2) + ' kW', `EL3 ${u.tag}: present-load loss ${rd.tx.values.ls.text}, recomputed ${lo} from the SIM load (G6), not the design load`); }
}
for (const u of UNITS.ups) {
  const rd = R.read('ups', u, C.snapshot), d = R.detail('ups', 'conversion', u, C.snapshot).rows;
  ok(rd.rec.values.kw.text === 'IN ' + res.dev[u.parts.rec].kw.toFixed(1) + ' kW', `EL3 ${u.tag}: rectifier ${rd.rec.values.kw.text}, solve ${res.dev[u.parts.rec].kw}`);
  ok(rd.inv.values.kw.text === 'OUT ' + res.dev[u.parts.inv].kw.toFixed(1) + ' kW', `EL3 ${u.tag}: inverter ${rd.inv.values.kw.text}`);
  /* T3 balance: in - out = the engine's system loss scaled to this UPS's share of the system output (within 1 %) */
  const loss = num(d.find((r) => r.label === 'Loss (in − out)').text), want = E.ups_system_loss_kw * u.invKw / E.ups_system_kw;
  ok(Math.abs(loss - want) <= 0.01 * want, `EL3 ${u.tag}: loss ${loss} kW, engine share ${want}`);
}
/* EL3 battery: opening CB-UI puts the UPS on battery; the drawing follows the solve */
{ const s2 = JSON.parse(JSON.stringify(st102)); s2.closed['ua-ci'] = false;
  const r2 = LV.solve(sh, s2, b), u2 = I.upsUnits(sh, s2, r2)[0];
  ok(u2.mode === 'BATTERY' && u2.batKw > 0 && u2.recKw === 0, `EL4 open CB-UIAA: mode ${u2.mode}, battery ${u2.batKw} kW, rectifier ${u2.recKw} kW`);
  ok(R.read('ups', u2, C.snapshot).inv.values.md.text === 'BATTERY', 'EL4 the inverter does not read BATTERY'); }
/* review fixes (2026-11-22): switching cases the normal state cannot show */
{ const run = (mod) => { const s2 = JSON.parse(JSON.stringify(st102)); mod(s2.closed); const r2 = LV.solve(sh, s2, b); return { r: r2, s: s2, u: I.upsUnits(sh, s2, r2)[0], t: I.txUnits(sh, s2, r2)[0], sum: LV.summary(sh, s2, r2) }; };
  const uo = run((c) => { c['ua-co'] = false; });
  ok(uo.u.lossKw === 0 && uo.u.recKw === 0, `EL4 CB-UOAA open: an inverter passing nothing books ${uo.u.lossKw} kW of loss, rectifier ${uo.u.recKw} kW (expected 0 / 0)`);
  const by = run((c) => { c['ua-ss'] = true; c['ua-co'] = false; });
  ok(by.u.mode === 'BYPASS' && by.u.recKw === 0 && by.u.lossKw === 0, `EL4 on bypass: mode ${by.u.mode}, rectifier ${by.u.recKw} kW, loss ${by.u.lossKw} kW`);
  const both = run((c) => { c['ua-ci'] = false; c['ua-co'] = false; });
  const sheetOnBat = !!both.r.batt['ua-bat'] && both.r.dev['ua-inv'].energised;
  ok((both.u.mode === 'BATTERY') === sheetOnBat, `EL4 CB-UI + CB-UO open: drawing ${both.u.mode}, sheet on battery ${sheetOnBat}`);
  const ta = run((c) => { c['ta-cb'] = false; });
  const tr = R.get('dist_tx').blocks.flatMap((bl) => R.detail('dist_tx', bl.id, ta.t, C.snapshot).rows).filter((x) => /present load/.test(x.label));
  ok(ta.t.state === 'stopped' && tr.length === 2 && tr.every((x) => x.text === 'not modelled'), `EL4 TX-AA de-energised: ${ta.t.state}, present-load rows ${tr.map((x) => x.text).join(' / ')} (a dead core has no loss)`);
  /* TR1 on the upstream breaker: the drawing's breaker current is the breaker's own, on a ring more than the unit's */
  for (const u of I.txUnits(e101, st101, r101)) { const up = e101.nodes.find((n) => n.tag === u.up), want = r101.dev[up.id].a;
    const drawn = R.read(u.classKey, u, C.snapshot).hvcb.values.a.text;
    ok(drawn === want.toFixed(1) + ' A', `EL3 ${u.tag}: upstream ${u.up} drawn ${drawn}, sheet ${want.toFixed(1)} A`); }
}
/* clicks: every UPS symbol opens its UPS with that part focused; a transformer opens itself */
for (const [id, k, f] of [['ua-rec', 'ups', 'rec'], ['ua-inv', 'ups', 'inv'], ['ua-bat', 'ups', 'bat'], ['ua-ss', 'ups', 'ss'], ['ta-tx', 'dist_tx', null]]) {
  const o = I.unitOf(sh.nodes.find((n) => n.id === id), sh, st102, res);
  ok(o && o.classKey === k && o.focus === f, `EL2 (node) ${id} opens ${o && o.classKey}/${o && o.focus}, expected ${k}/${f}`);
}
/* EL1b no number literal outside GEOMETRY / FORMATS, comments and standards text */
{
  const fs = require('node:fs');
  for (const f of ['transformer', 'ups']) {
    let t = fs.readFileSync(new URL('../js/conv/internals/' + f + '.js', import.meta.url), 'utf8');
    for (const [b0, b1] of [['/* GEOMETRY BEGIN', '/* GEOMETRY END */'], ['/* FORMATS BEGIN', '/* FORMATS END */']]) {
      const i = t.indexOf(b0), j = t.indexOf(b1); if (i >= 0 && j > i) t = t.slice(0, i) + t.slice(j);
    }
    t = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/(standard|basis): '[^']*'/g, "$1: ''");
    const hits = t.split('\n').filter((l) => /(^|[^\w.])\d/.test(l)).map((l) => l.trim().slice(0, 80));
    ok(hits.length === 0, `EL1b ${f}.js: digits outside geometry: ${hits.slice(0, 3).join(' | ')}`);
  }
}

/* ---------- browser (EPMS_Telemetry.html, 1440 + 390, authorised audit state) ----------
   EL2 ONE click on TX-1 / TX-DA (E-S-101) and TX-AA, REC-AA, INV-AA, BAT-AA, SS-AA (E-S-102) opens the modal on the
       internal drawing (every geometry node drawn, title names the unit); a UPS part opens UPS-AA on that part's block
   EL3 every drawn value = RZConvInternals.read() of the adapter unit; the UPS rectifier / inverter kW = the sheet's own
   EL5 no two texts of the drawing overlap; none leaves the drawing
   EL6 the declared not-modelled rows read "not modelled" in the modal; 0 page errors */
const argv = process.argv.slice(2);
if (!argv.includes('--node-only')) {
  const argW = argv.filter((a) => a.startsWith('--width=')).map((a) => +a.slice(8));
  const WIDTHS = argW.length ? argW : [1440, 390];
  const { default: puppeteer } = await import('puppeteer');
  const { serve } = await import('./audit-conv-text.mjs');
  const { primeCockpitAuditDocument, enterAuthorizedAuditState } = await import('./lib/cockpit-audit-state.mjs');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const CASES = [['sld', 'tx1', 'hv_tx', null], ['sld', 'da-tx', 'dist_tx', null], ['lv', 'ta-tx', 'dist_tx', null],
    ['lv', 'ua-rec', 'ups', 'conversion'], ['lv', 'ua-inv', 'ups', 'conversion'], ['lv', 'ua-bat', 'ups', 'battery'], ['lv', 'ua-ss', 'ups', 'bypass']];
  try {
    for (const W of WIDTHS) for (const [view, id, cls, blk] of CASES) {
      const T = id + '@' + W;
      const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844 });
      await primeCockpitAuditDocument(pg, 'dark');
      await pg.goto(base + 'EPMS_Telemetry.html', { waitUntil: 'load', timeout: 90000 });
      await enterAuthorizedAuditState(pg, 'epms');
      const host = view === 'sld' ? '#epms-sheet-host' : '#epms-lv-host';
      if (view === 'lv') await pg.evaluate(() => { const b = document.querySelector('.epms-view-btn[data-epms-view="lv"]'); if (b) b.click(); });
      await pg.waitForFunction((h) => document.querySelector(h + ' .hmi-node'), { timeout: 30000 }, host).catch(() => {});
      await sleep(1200);
      const t = await pg.evaluate((h, id) => { const gq = document.querySelector(h + ' .hmi-node[data-node="' + id + '"]'); if (!gq) return null;
        gq.scrollIntoView({ block: 'center', inline: 'center' }); const r = (gq.querySelector('.b') || gq).getBoundingClientRect();
        const kwt = [...gq.querySelectorAll('[data-val]')].filter((n) => /:kw$/.test(n.getAttribute('data-val'))).map((n) => n.textContent)[0] || null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: gq.getAttribute('data-tag'), kw: kwt }; }, host, id);
      ok(!!t, `EL2 ${T}: symbol not found`);
      if (!t) { await pg.close(); continue; }
      await pg.mouse.click(t.x, t.y); await sleep(1000);
      const s = await pg.evaluate((cls, view, id, blk) => {
        const m = document.querySelector('.rz-cvm:not([hidden])'); if (!m) return { modal: false, insp: !!document.querySelector('.rz-insp:not([hidden]), [data-rz-inspector][aria-hidden="false"]') };
        const svg = m.querySelector('[data-rz-cvm-int] svg.hmi-svg'); const title = (m.querySelector('h2,h1') || {}).textContent || '';
        if (!svg) return { modal: true, svg: false, title };
        const I = window.RZEpmsInternals, R = window.RZConvInternals, C = window.CONV_CALC, def = R.get(cls);
        let sh, st, res;
        if (view === 'sld') { const S = window.RZEpmsSim; sh = window.RZEpmsSheets.sld; st = S.normalState(sh); res = S.solve(sh, st, S.basis(C.snapshot)); }
        else { const L = window.RZEpmsLv; sh = L.build(0, C.snapshot, C.getFleet('genset', 'A')); st = L.normalState(sh); res = L.solve(sh, st, L.basis(C.snapshot)); }
        const o = I.unitOf(sh.nodes.find((n) => n.id === id), sh, st, res), unit = o.units.find((u) => title.indexOf(u.tag) === 0) || o.units[o.index];
        const rd = R.read(cls, unit, C.snapshot);
        const vals = [...svg.querySelectorAll('[data-val]')].map((n) => { const [nid, k] = n.getAttribute('data-val').split(':'); return { nid, k, text: n.textContent, want: rd[nid] && rd[nid].values && rd[nid].values[k] ? rd[nid].values[k].text : null }; });
        const sr = svg.getBoundingClientRect();
        const texts = [...svg.querySelectorAll('text')].filter((n) => n.textContent.trim() && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden' && +getComputedStyle(n).opacity > 0)
          .map((n) => { const r = n.getBoundingClientRect(); return { t: n.textContent.trim(), l: r.left, r: r.right, tp: r.top, b: r.bottom }; });
        const over = [];
        for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i], b = texts[j], w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.tp, b.tp);
          if (w > 1.5 && h > 1.5) over.push(a.t + ' × ' + b.t);
        }
        const outside = texts.filter((a) => a.l < sr.left - 1 || a.r > sr.right + 1 || a.tp < sr.top - 1 || a.b > sr.bottom + 1).map((a) => a.t);
        /* a drawn line through a text: sample every edge path every 2 user units, in screen space, against each text box shrunk 1 px */
        const struck = new Set();
        for (const p of svg.querySelectorAll('path.hmi-edge')) {
          const len = p.getTotalLength(), ctm = p.getScreenCTM(); if (!ctm || !len) continue;
          for (let d = 0; d <= len; d += 2) { const q = p.getPointAtLength(d), x = ctm.a * q.x + ctm.c * q.y + ctm.e, y = ctm.b * q.x + ctm.d * q.y + ctm.f;
            for (const a of texts) if (x > a.l + 1 && x < a.r - 1 && y > a.tp + 1 && y < a.b - 1) struck.add(a.t); }
        }
        const rows = {}; for (const r of m.querySelectorAll('.rz-cvm-row')) { const k = r.querySelector('.rz-cvm-k'); const lbl = ((k || {}).textContent || '').trim(); if (!(lbl in rows)) rows[lbl] = [...r.children].filter((x) => x !== k).map((x) => x.textContent).join(' ').trim(); }
        const want = blk ? def.blocks.find((b) => b.id === blk).name : null;
        return { modal: true, svg: true, title, nodes: svg.querySelectorAll('.hmi-node').length, want: def.sheet(unit).nodes.filter((n) => n.sym !== 'junction').length,
          vals, over, outside, struck: [...struck], rows, tag: unit.tag, blockShown: want ? m.textContent.indexOf(want) >= 0 : true, blockName: want,
          recIn: rd.rec ? rd.rec.values.kw.text : null, invOut: rd.inv ? rd.inv.values.kw.text : null,
          chip: ((m.querySelector('.rz-cvm-chip') || {}).textContent || '').trim(), loadPct: unit.loadPct };
      }, cls, view, id, blk);
      ok(s.modal && s.svg, `EL2 ${T}: one click did not open the internal drawing (modal ${s.modal}, drawing ${s.svg})`);
      if (s.svg) {
        ok(s.title.indexOf(s.tag) === 0, `EL2 ${T}: title "${s.title}", unit ${s.tag}`);
        ok(s.nodes >= s.want, `EL2 ${T}: ${s.nodes} nodes drawn of ${s.want}`);
        ok(s.blockShown, `EL2 ${T}: the ${s.blockName} block is not the one shown first`);
        ok(typeof s.loadPct === 'number' && s.chip.indexOf('LOAD ' + s.loadPct.toFixed(1) + ' %') >= 0, `EL3 ${T}: header chip "${s.chip}", unit load ${s.loadPct}`);
        ok(s.vals.length > 0, `EL3 ${T}: no values drawn`);
        for (const v of s.vals) ok(v.want !== null && v.text === v.want, `EL3 ${T} ${v.nid}:${v.k}: drawn "${v.text}", read() "${v.want}"`);
        if (t.kw && (id === 'ua-rec' || id === 'ua-inv')) { const sheetKw = num(t.kw.replace(/[\s  ]/g, '')), modal = num((id === 'ua-rec' ? s.recIn : s.invOut).replace(/^(IN|OUT) /, ''));
          ok(Math.abs(sheetKw - modal) <= 0.5, `EL3 ${T}: sheet ${t.kw}, modal ${id === 'ua-rec' ? s.recIn : s.invOut}`); }
        ok(s.over.length === 0, `EL5 ${T}: overlapping text ${s.over.slice(0, 4).join(' | ')}`);
        ok(s.outside.length === 0, `EL5 ${T}: text outside the drawing ${s.outside.slice(0, 4).join(' | ')}`);
        ok(s.struck.length === 0, `EL5 ${T}: a line runs through ${s.struck.slice(0, 4).join(' | ')}`);
        const nmRow = cls === 'ups' ? (blk === 'battery' ? 'Autonomy' : blk === 'bypass' ? 'Maintenance bypass' : 'Part-load efficiency') : (cls === 'hv_tx' ? 'Losses' : null);
        if (nmRow) ok(s.rows[nmRow] !== undefined && /not modelled$/.test(s.rows[nmRow]), `EL6 ${T}: reading "${nmRow}" = ${s.rows[nmRow]}`);
      }
      ok(errs.length === 0, `EL6 ${T}: page errors ${errs.slice(0, 2).join(' | ')}`);
      await pg.close();
    }
  } finally { await browser.close(); srv.close(); }
}

if (fails.length) { console.log(fails.map((f) => '  ✗ ' + f).join('\n')); console.log('CONV INTERNALS P4 — ' + fails.length + ' failing of ' + checks); process.exit(1); }
console.log('CONV INTERNALS P4 — PASS (' + checks + ' checks: engine 2.6.0 electrical keys = their formulas and the EU 548/2014 source, the UPS loss booked at the UPS with totals unchanged)');
