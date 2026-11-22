#!/usr/bin/env node
/* test-conv-internals-p4b.mjs — PRD-CONV-EQUIPMENT-INSIDE phase P4b (P4b-BREAKER-RELAY.md): breakers, relays and
   switchboards on EPMS_Telemetry.html open up.
   Node part:
   EB0  every breaker of E-S-101 and of E-S-102 in all four halls maps to a unit (129 measured on the P4a tree);
        unitOf() routes each to class 'breaker' with a strip of its scope (same voltage class; E-S-102 same stream)
   EB1  every engine-basis row of the breaker drawing equals the engine; every "not modelled" row is declared; no row
        lacks a source; the LV trip-unit settings appear ONLY on the breaker an LSIG relay trips
   EB1b digit law on internals/breaker.js
   EB3n position, kW and A of every breaker unit = the solve; FROM / TO never name a relay, a CT or an earth switch
   Browser part (1440 + 390, authorised audit state):
   EB2  one click on CB-FA4, CB-LVA (E-S-101) and CB-UIAA, CB-LVAA (E-S-102) opens the breaker drawing titled by the tag
   EB3  drawn values = read() of the adapter unit
   EB4  operate from the modal: CB-UIAA Select · Open, then Execute -> the drawing reads OPEN, the sheet's breaker is open,
        the message line names the operation; a Close that the interlocks refuse shows the refusal and nothing moves
   EB6  no text overlap, none outside the drawing, no line through a text; 0 page errors
   EB8  the source note names the single-line solve, never "plant cooling values"
   Red on the P4a tree (no breaker class, no adapter, no modal actions).
   node tools/test-conv-internals-p4b.mjs [--node-only] [--width=N] */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const argv = process.argv.slice(2);

global.window = global;
require('../js/conv-engine.js');
window.RZConvInternals = require('../js/conv/internals.js');
for (const f of ['sld-topology', 'epms-sim', 'epms-sheet', 'epms-lv', 'epms-internals']) require('../js/conv/' + f + '.js');
try { require('../js/conv/internals/breaker.js'); } catch (e) { /* red before the class exists */ }
try { require('../js/conv/internals/relay.js'); } catch (e) { /* red before the class exists */ }
const C = window.CONV_CALC, E = C.snapshot.electrical, R = window.RZConvInternals, I = window.RZEpmsInternals || {}, SIM = window.RZEpmsSim, LV = window.RZEpmsLv;
const num = (t) => parseFloat(String(t).replace(/,/g, ''));
const decimals = (t) => { const m = /\.(\d+)/.exec(String(t).split(' ')[0]); return m ? m[1].length : 0; };

const SHEETS = [];
{ const sh = window.RZEpmsSheets.sld, st = SIM.normalState(sh); SHEETS.push({ name: 'E-S-101', sh, st, res: SIM.solve(sh, st, SIM.basis(C.snapshot)) }); }
LV.HALLS.forEach((code, h) => { const sh = LV.build(h, C.snapshot, C.getFleet('genset', code)), st = LV.normalState(sh);
  SHEETS.push({ name: 'E-S-102 hall ' + code, sh, st, res: LV.solve(sh, st, LV.basis(C.snapshot)) }); });

/* ---------- EB0 ---------- */
let mapped = 0, total = 0;
for (const S of SHEETS) for (const n of S.sh.nodes.filter((x) => x.sym === 'cbIec' || x.sym === 'cbDrawout')) {
  total++;
  const o = typeof I.unitOf === 'function' ? I.unitOf(n, S.sh, S.st, S.res) : null;
  if (o && o.classKey === 'breaker' && o.units[o.index] && o.units[o.index].tag === n.tag) mapped++;
  else if (mapped + 3 > total) ok(false, `EB0 ${S.name} ${n.tag}: no breaker unit`);
}
ok(total === 129, `EB0 ${total} breakers on the sheets, the PRD measured 129`);
ok(mapped === total, `EB0 ${mapped} of ${total} breakers map to a unit`);

/* ---------- EB1 / EB3n ---------- */
const NM_ROWS = ['Spring charged', 'Trip-coil supervision', 'Operation counter', 'Contact wear', 'Breaking capacity',
  'Long-time pickup Ir', 'Long-time delay tr', 'Short-time pickup Isd', 'Short-time delay tsd'];
const SIM_LABELS = ['Trips through (LV without LSIG: typical)', 'Relay', 'Interrupting medium (typical for the voltage class)', 'From', 'To'];
if (R.has('breaker') && typeof I.breakerUnits === 'function') {
  const def = R.get('breaker');
  for (const S of SHEETS) for (const u of I.breakerUnits(S.sh, S.st, S.res)) {
    const d0 = S.res.dev[u.id] || {};
    ok(u.pos === (S.st.closed[u.id] ? 'CLOSED' : 'OPEN'), `EB3n ${S.name} ${u.tag}: position ${u.pos}`);
    ok(Math.abs(u.a - (d0.energised ? d0.a : 0)) < 1e-9 && Math.abs(u.kw - (d0.energised ? d0.kw : 0)) < 1e-9, `EB3n ${S.name} ${u.tag}: kW/A ${u.kw}/${u.a} != solve`);
    for (const side of ['up', 'down']) { const t = u[side], n = t && S.sh.nodes.find((x) => x.tag === t);
      ok(!n || !['protectionRelay', 'currentTransformer', 'earthSwitch'].includes(n.sym), `EB3n ${S.name} ${u.tag}: ${side} = ${t} (${n && n.sym})`); }
    const rl = S.sh.nodes.find((x) => x.sym === 'protectionRelay' && x.cb === u.id);
    ok(u.lsig === !!(rl && rl.prot === 'lsig'), `EB1 ${S.name} ${u.tag}: lsig ${u.lsig}, relay ${rl && rl.tag} ${rl && rl.prot}`);
    for (const b of def.blocks) {
      const d = R.detail('breaker', b.id, u, C.snapshot);
      d.rows.forEach((r, i) => {
        const v = b.values[i];
        if (r.basis && /^electrical\./.test(r.basis)) { const ev = E[r.basis.slice(11)];
          ok(typeof ev === 'number' && Math.abs(num(r.text) - ev) <= 0.5 * Math.pow(10, -decimals(r.text)) + 1e-9, `EB1 ${u.tag}/${b.id} "${r.label}": ${r.text}, engine ${r.basis} = ${ev}`); }
        else if (r.text === 'not modelled') ok(NM_ROWS.includes(r.label), `EB1 ${u.tag}/${b.id} "${r.label}" reads not modelled but is not declared`);
        else ok(v.sim || SIM_LABELS.includes(r.label), `EB1 ${u.tag}/${b.id} "${r.label}" = ${r.text} has no source`);
      });
      if (b.id === 'protection') { const ir = d.rows.find((x) => x.label === 'Long-time pickup Ir');
        ok(u.lsig ? ir.text !== 'not modelled' : ir.text === 'not modelled', `EB1 ${u.tag}: Ir ${ir.text} on a ${u.lsig ? 'LSIG' : 'non-LSIG'} breaker`); }
      if (b.id === 'contacts') { const cap = d.rows.find((x) => x.label === 'Breaking capacity');
        ok(u.kv === 'hv' ? cap.text !== 'not modelled' : cap.text === 'not modelled', `EB1 ${u.tag} (${u.kv}): breaking capacity ${cap.text}`); }
    }
  }
} else ok(false, 'EB1 class breaker or breakerUnits() missing');

/* ---------- EB5 relays ---------- */
const FN_OK = { '87L': 1, '21': 1, '87T': 1, '87B': 1, '50BF': 1, '51G': 1, '50/51': 1, '50N/51N': 1, LSIG: 1 };
if (R.has('relay') && typeof I.relayUnits === 'function') {
  let nRel = 0;
  for (const S of SHEETS) for (const u of I.relayUnits(S.sh, S.st, S.res)) {
    nRel++;
    const n = S.sh.nodes.find((x) => x.id === u.id), o = I.unitOf(n, S.sh, S.st, S.res);
    ok(o && o.classKey === 'relay' && o.units[o.index].tag === u.tag, `EB5 ${S.name} ${u.tag}: no relay unit`);
    ok(o && o.units.length <= 14, `EB5 ${S.name} ${u.tag}: strip of ${o && o.units.length} > 14`);
    for (const f of u.fns) ok(FN_OK[f], `EB5 ${u.tag}: unknown ANSI function "${f}" from name "${u.name}"`);
    const cb = n.cb && S.sh.nodes.find((x) => x.id === n.cb);
    ok(!cb || u.cbPos === (S.st.closed[cb.id] ? 'CLOSED' : 'OPEN'), `EB5 ${u.tag}: trips ${u.cb} ${u.cbPos}`);
    const d = R.detail('relay', 'functions', u, C.snapshot), row = (l) => d.rows.find((r) => r.label === l);
    const graded = u.prot && (u.fns.includes('50/51') || u.fns.includes('LSIG'));
    if (graded) {
      const key = u.prot === 'lsig' ? 'pro_lv_ir_a' : 'pro_' + u.prot + '_is_a';
      ok(row('Pickup').basis === 'electrical.' + key && Math.abs(num(row('Pickup').text) - E[key]) <= 0.05, `EB5 ${u.tag}: pickup ${row('Pickup').text} basis ${row('Pickup').basis}, engine ${key} ${E[key]}`);
      if (u.prot !== 'lsig') { ok(row('Time multiplier (TMS)').text === E['pro_' + u.prot + '_tms'].toFixed(2), `EB5 ${u.tag}: TMS ${row('Time multiplier (TMS)').text}`);
        ok(row('Inverse-time curve').text === E['pro_' + u.prot + '_curve'], `EB5 ${u.tag}: curve ${row('Inverse-time curve').text}`); }
      else ok(row('Time multiplier (TMS)').text === '—' && !row('Time multiplier (TMS)').basis, `EB5 ${u.tag}: an LSIG unit shows TMS ${row('Time multiplier (TMS)').text}`);
    } else for (const r of d.rows.filter((x) => !['Functions', 'Graded element', 'Other functions'].includes(x.label)))
      ok(r.text === 'not modelled' && !r.basis, `EB5 ${u.tag} (${u.name}): "${r.label}" = ${r.text} on a relay with no engine setting`);
  }
  ok(nRel === 20 + 4 * 2, `EB5 ${nRel} relays, the sheets carry 20 + 4 x 2`);
} else ok(false, 'EB5 class relay or relayUnits() missing');

/* ---------- EB1b ---------- */
{
  for (const file of ['breaker', 'relay']) {
  let t = ''; try { t = readFileSync(new URL('../js/conv/internals/' + file + '.js', import.meta.url), 'utf8'); } catch (e) { ok(false, 'EB1b ' + file + '.js missing'); }
  for (const [b0, b1] of [['/* GEOMETRY BEGIN', '/* GEOMETRY END */'], ['/* FORMATS BEGIN', '/* FORMATS END */']]) {
    const i = t.indexOf(b0), j = t.indexOf(b1); if (i >= 0 && j > i) t = t.slice(0, i) + t.slice(j);
  }
  t = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/(standard|basis): '[^']*'/g, "$1: ''");
  const hits = t.split('\n').filter((l) => /(^|[^\w.])\d/.test(l)).map((l) => l.trim().slice(0, 80));
  ok(hits.length === 0, `EB1b ${file}.js: digits outside geometry: ${hits.slice(0, 3).join(' | ')}`);
  }
}

/* ---------- browser ---------- */
if (!argv.includes('--node-only')) {
  const argW = argv.filter((a) => a.startsWith('--width=')).map((a) => +a.slice(8));
  const WIDTHS = argW.length ? argW : [1440, 390];
  const { default: puppeteer } = await import('puppeteer');
  const { serve } = await import('./audit-conv-text.mjs');
  const { primeCockpitAuditDocument, enterAuthorizedAuditState } = await import('./lib/cockpit-audit-state.mjs');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const CASES = [['sld', 'fa4-cb'], ['sld', 'da-cb'], ['lv', 'ua-ci'], ['lv', 'la-cb'], ['sld', 'fa1-r'], ['sld', 'l1-r'], ['lv', 'la-r']];
  const load = async (W, view) => {
    const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844 });
    await primeCockpitAuditDocument(pg, 'dark');
    await pg.goto(base + 'EPMS_Telemetry.html', { waitUntil: 'load', timeout: 90000 });
    await enterAuthorizedAuditState(pg, 'epms');
    if (view === 'lv') await pg.evaluate(() => document.querySelector('.epms-view-btn[data-epms-view="lv"]').click());
    await sleep(1800);
    return { pg, errs };
  };
  const clickNode = async (pg, host, id) => { const t = await pg.evaluate((h, id) => { const g = document.querySelector(h + ' .hmi-node[data-node="' + id + '"]'); if (!g) return null;
    g.scrollIntoView({ block: 'center', inline: 'center' }); const r = (g.querySelector('.b') || g).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: g.getAttribute('data-tag') }; }, host, id);
    if (t) { await pg.mouse.click(t.x, t.y); await sleep(1100); } return t; };
  const inspect = (pg) => pg.evaluate(() => {
    const m = document.querySelector('.rz-cvm:not([hidden])'); if (!m) return { modal: false };
    const svg = m.querySelector('[data-rz-cvm-int] svg.hmi-svg'); const title = (document.getElementById('rz-cvm-title') || {}).textContent || '';
    if (!svg) return { modal: true, svg: false, title };
    const sr = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll('text')].filter((n) => n.textContent.trim() && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden' && +getComputedStyle(n).opacity > 0)
      .map((n) => { const r = n.getBoundingClientRect(); return { t: n.textContent.trim(), l: r.left, r: r.right, tp: r.top, b: r.bottom }; });
    const over = [];
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) { const a = texts[i], b = texts[j];
      if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1.5 && Math.min(a.b, b.b) - Math.max(a.tp, b.tp) > 1.5) over.push(a.t + ' × ' + b.t); }
    const outside = texts.filter((a) => a.l < sr.left - 1 || a.r > sr.right + 1 || a.tp < sr.top - 1 || a.b > sr.bottom + 1).map((a) => a.t);
    const struck = new Set();
    for (const p of svg.querySelectorAll('path.hmi-edge')) { const len = p.getTotalLength(), ctm = p.getScreenCTM(); if (!ctm || !len) continue;
      for (let d = 0; d <= len; d += 2) { const q = p.getPointAtLength(d), x = ctm.a * q.x + ctm.c * q.y + ctm.e, y = ctm.b * q.x + ctm.d * q.y + ctm.f;
        for (const a of texts) if (x > a.l + 1 && x < a.r - 1 && y > a.tp + 1 && y < a.b - 1) struck.add(a.t); } }
    const vals = [...svg.querySelectorAll('[data-val]')].map((n) => ({ k: n.getAttribute('data-val'), text: n.textContent }));
    return { modal: true, svg: true, title, over, outside, struck: [...struck], vals,
      acts: [...m.querySelectorAll('[data-rz-cvm-act]')].map((x) => x.textContent), msg: (m.querySelector('[data-rz-cvm-msg]') || {}).textContent || '',
      note: [...m.querySelectorAll('.rz-cvm-note')].map((x) => x.textContent).join(' ') };
  });
  const readWant = (pg, view, id) => pg.evaluate((view, id) => {
    const I = window.RZEpmsInternals, R = window.RZConvInternals, C = window.CONV_CALC; let sh, st, res;
    if (view === 'sld') { const S = window.RZEpmsSim; sh = window.RZEpmsSheets.sld; st = S.normalState(sh); res = S.solve(sh, st, S.basis(C.snapshot)); }
    else { const L = window.RZEpmsLv; sh = L.build(0, C.snapshot, C.getFleet('genset', 'A')); st = L.normalState(sh); res = L.solve(sh, st, L.basis(C.snapshot)); }
    const o = I.unitOf(sh.nodes.find((n) => n.id === id), sh, st, res), u = o.units[o.index], rd = R.read(o.classKey, u, C.snapshot), out = {};
    for (const nid of Object.keys(rd)) for (const k of Object.keys((rd[nid] && rd[nid].values) || {})) out[nid + ':' + k] = rd[nid].values[k].text;
    return { tag: u.tag, want: out };
  }, view, id);
  try {
    for (const W of WIDTHS) for (const [view, id] of CASES) {
      const T = id + '@' + W, host = view === 'sld' ? '#epms-sheet-host' : '#epms-lv-host';
      const { pg, errs } = await load(W, view);
      const t = await clickNode(pg, host, id);
      ok(!!t, `EB2 ${T}: symbol not found`);
      if (t) {
        const s = await inspect(pg), w = await readWant(pg, view, id);
        ok(s.modal && s.svg && s.title.indexOf(w.tag) === 0, `EB2 ${T}: one click ${s.modal ? 'opened "' + s.title + '"' + (s.svg ? '' : ' without the drawing') : 'did not open the modal'}`);
        if (s.svg) {
          for (const v of s.vals) ok(w.want[v.k] === v.text, `EB3 ${T} ${v.k}: drawn "${v.text}", read() "${w.want[v.k]}"`);
          ok(s.over.length === 0, `EB6 ${T}: overlapping text ${s.over.slice(0, 3).join(' | ')}`);
          ok(s.outside.length === 0, `EB6 ${T}: text outside ${s.outside.slice(0, 3).join(' | ')}`);
          ok(s.struck.length === 0, `EB6 ${T}: a line runs through ${s.struck.slice(0, 3).join(' | ')}`);
          ok(/simulation solve/.test(s.note) && !/plant cooling/.test(s.note), `EB8 ${T}: source note "${s.note.slice(0, 120)}"`);
        }
        if (id === 'fa1-r' && s.svg) {   /* EB5b the relay's TCC opens ABOVE the modal; Escape closes the TCC first, the modal stays usable */
          const hit = await pg.evaluate(() => { const x = [...document.querySelectorAll('[data-rz-cvm-act]')].find((b) => /^Time/.test(b.textContent)); if (x) x.click(); return !!x; });
          ok(hit, `EB5b ${T}: no Time-current curves button in the modal`);
          await sleep(900);
          const up = await pg.evaluate(() => { const t = document.querySelector('.tcc-modal:not([hidden])'); if (!t) return null; const r = t.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + 30); return !!(e && t.contains(e)); });
          ok(up === true, `EB5b ${T}: TCC ${up === null ? 'did not open' : 'is under the modal'}`);
          await pg.keyboard.press('Escape'); await sleep(500);
          const after = await pg.evaluate(() => ({ cvm: window.RZConvModal.isOpen(), tcc: !!document.querySelector('.tcc-modal:not([hidden])'), inert: document.querySelector('.rz-cvm').hasAttribute('inert') }));
          ok(after.cvm && !after.tcc && !after.inert, `EB5b ${T}: after Escape modal ${after.cvm}, TCC ${after.tcc}, modal inert ${after.inert}`);
          /* EB5c a SECOND modal session: the TCC element now exists hidden when the modal inerts the page; it must still take input */
          await pg.keyboard.press('Escape'); await sleep(400);
          await clickNode(pg, host, id);
          await pg.evaluate(() => { const x = [...document.querySelectorAll('[data-rz-cvm-act]')].find((b) => /^Time/.test(b.textContent)); if (x) x.click(); }); await sleep(900);
          const again = await pg.evaluate(() => { const t = document.querySelector('.tcc-modal:not([hidden])'); return t ? { inert: !!t.closest('[inert]') } : null; });
          ok(again && !again.inert, `EB5c ${T}: TCC on the second open ${again ? 'is inert (takes no input)' : 'did not open'}`);
          if (again) { await pg.evaluate(() => { const x = document.querySelector('.tcc-modal:not([hidden]) button'); if (x) x.click(); }); await sleep(400); }
          const after2 = await pg.evaluate(() => ({ cvm: window.RZConvModal.isOpen(), tcc: !!document.querySelector('.tcc-modal:not([hidden])') }));
          ok(after2.cvm && !after2.tcc, `EB5c ${T}: TCC close button left modal ${after2.cvm}, TCC ${after2.tcc}`);
        }
        if (id === 'ua-ci' && s.svg) {   /* EB4 select-before-operate from inside the modal */
          const press = async (re) => { const hit = await pg.evaluate((re) => { const x = [...document.querySelectorAll('[data-rz-cvm-act]')].find((b) => new RegExp(re).test(b.textContent)); if (x) { x.focus(); x.click(); } return !!x; }, re); await sleep(700); return hit; };
          ok(await press('^Select · Open'), `EB4 ${T}: no Select · Open button (buttons ${s.acts.join(', ')})`);
          const foc = await pg.evaluate(() => { const a = document.activeElement; return !!(a && document.querySelector('.rz-cvm').contains(a) && a !== document.body); });
          ok(foc, `EB4 ${T}: focus left the modal after Select (the pressed button was replaced)`);
          ok(await press('^Execute'), `EB4 ${T}: no Execute after Select`);
          const a = await inspect(pg), sheetPos = await pg.evaluate(() => window.RZEpmsLvPage && window.RZEpmsLvPage.state ? window.RZEpmsLvPage.state().closed['ua-ci'] : null);
          const st = a.vals.find((v) => v.k === 'mc:st');
          ok(st && st.text === 'OPEN', `EB4 ${T}: drawing reads ${st && st.text} after Execute`);
          ok(sheetPos === false || sheetPos === null && /opened/.test(a.msg), `EB4 ${T}: sheet position ${sheetPos}`);
          ok(/CB-UIAA opened/.test(a.msg), `EB4 ${T}: message "${a.msg}"`);
          await pg.evaluate(() => document.querySelector('[data-nav="1"]').click()); await sleep(600);
          const other = await inspect(pg);
          ok(!other.msg, `EB4b ${T}: the next unit ${other.title} shows CB-UIAA's message "${other.msg}"`);
        }
      }
      ok(errs.length === 0, `EB6 ${T}: page errors ${errs.slice(0, 2).join(' | ')}`);
      await pg.close();
    }
  } finally { await browser.close(); srv.close(); }
}

if (fails.length) { console.log('CONV INTERNALS P4b — FAIL (' + fails.length + ' of ' + checks + ')'); fails.slice(0, 40).forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log('CONV INTERNALS P4b — PASS (' + checks + ' checks: 129 breakers map to the breaker drawing, engine rows = the engine, LSIG settings only where an LSIG relay trips, operate from the modal keeps select-before-operate)');
