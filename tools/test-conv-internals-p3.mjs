#!/usr/bin/env node
/* test-conv-internals-p3.mjs — PRD-CONV-EQUIPMENT-INSIDE phase P3: the INSIDE of the condenser-water pump, the secondary
   chilled-water pump, the cooling-tower cell and the CRAH (js/conv/internals/pump.js, tower.js, crah.js), from the engine.
   Node (engine 2.5.0, no browser):
   P3-1 the four classes (and chw_primary_pump) are registered; every block row with an engine basis prints the engine
        value of that basis for a running unit; a running-only value of a standby unit reads "—"; the rows the engine
        does not model read "not modelled" and nothing else does
   P3-2 hydraulic power = rho g Q H, shaft = hydraulic / pump efficiency, dP = rho g H, recomputed here from the fleet row
        and the plant constants; shaft / (motor eff x VFD eff) = the published pump kW_e; CRAH airflow = duty /
        (rho cp dT_air)
   Browser (chiller-plant.html, 1440 + 390, authorised audit state):
   P3-3 ONE click on CDWP-01, CT-01, CRAH-A01 and CHWP-S1 opens the modal on its internal drawing (not the fleet table):
        every geometry node drawn, title names the unit
   P3-4 every value printed on the drawing equals RZConvInternals.read() of that unit
   P3-5 no two texts of the drawing overlap; none leaves the drawing
   P3-6 the modal's plant readings agree with the drawing: Motor current, Vibration and Basin level read "not modelled"
        (no seeded wave) and pump Speed equals the engine; 0 page errors
   Red on e09a284fe (no internals for these classes: fleet table only).
   node tools/test-conv-internals-p3.mjs [--width=390] [--node-only] */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const argv = process.argv.slice(2);
const argW = argv.filter((a) => a.startsWith('--width=')).map((a) => +a.slice(8));
const WIDTHS = argW.length ? argW : [1440, 390];

/* ---------- node ---------- */
global.window = global;
require('../js/conv-engine.js');
window.RZConvInternals = require('../js/conv/internals.js');
for (const f of ['pump', 'tower', 'crah']) require('../js/conv/internals/' + f + '.js');
const R = window.RZConvInternals, C = window.CONV_CALC, S = C.snapshot, c = S.cooling;
const CLASSES = [['cdw_pump'], ['chw_secondary_pump'], ['chw_primary_pump'], ['tower_cell'], ['crah', 'A']];
const NM_ROWS = { cdw_pump: ['Seal leakage', 'Bearing temperature', 'Vibration', 'Suction pressure'], tower_cell: ['Evaporation', 'Basin level', 'Make-up flow', 'Blowdown flow'],
  crah: ['Fan power', 'Position', 'Pressure drop'] };
NM_ROWS.tower_cell.push('Fan vibration');
NM_ROWS.chw_secondary_pump = NM_ROWS.chw_primary_pump = NM_ROWS.cdw_pump;
const num = (t) => parseFloat(String(t).replace(/,/g, ''));
const decimals = (t) => { const m = /\.(\d+)/.exec(String(t).split(' ')[0]); return m ? m[1].length : 0; };

for (const [k, hall] of CLASSES) {
  ok(R.has(k), `P3-1 ${k}: not registered`);
  if (!R.has(k)) continue;
  const fleet = C.getFleet(k, hall), run = fleet.find((u) => u.state === 'running'), sb = fleet.find((u) => u.state !== 'running');
  const def = R.get(k);
  for (const b of def.blocks) {
    const d = R.detail(k, b.id, run, S);
    for (const r of d.rows) {
      if (r.basis && /^cooling\./.test(r.basis)) {
        const key = r.basis.slice(8), ev = c[key];
        ok(typeof ev === 'number', `P3-1 ${k}/${b.id} "${r.label}": basis ${r.basis} is not an engine number`);
        if (typeof ev === 'number') ok(Math.abs(num(r.text) - ev) <= 0.5 * Math.pow(10, -decimals(r.text)) + 1e-9, `P3-1 ${k}/${b.id} "${r.label}": prints ${r.text}, engine ${key} = ${ev}`);
      } else if (r.text === 'not modelled') ok(NM_ROWS[k].includes(r.label), `P3-1 ${k}/${b.id} "${r.label}" reads not modelled but is not on the not-modelled list`);
      else ok(['Position', 'Mode'].includes(r.label), `P3-1 ${k}/${b.id} "${r.label}" = ${r.text} has no engine basis`);
    }
    for (const lbl of NM_ROWS[k]) { const r = d.rows.find((x) => x.label === lbl); if (r) ok(r.text === 'not modelled', `P3-1 ${k}/${b.id} "${lbl}" = ${r.text}, expected not modelled`); }
    ok(!!sb, `P3-1 ${k}: no standby unit to check`);
    if (sb) {
      const ds = R.detail(k, b.id, sb, S);
      /* a stopped pump turns at the engine's 0 %, the same figure its tooltip prints; other running-only values read "—" */
      for (const r of ds.rows) if (/pump/.test(k) && r.label === 'Speed') ok(num(r.text) === 0, `P3-1 ${k} standby ${sb.tag} Speed = ${r.text}, engine 0`);
      for (const r of ds.rows) if (/Hydraulic|Shaft|Differential|Airflow|Supply air|Return air|Hot water|Cold water|Range|Approach|Fan speed/.test(r.label) || (r.label === 'Speed' && !/pump/.test(k)))
        ok(r.text === '—', `P3-1 ${k}/${b.id} standby ${sb.tag} "${r.label}" = ${r.text}, expected —`);
    }
  }
}
/* P3-1b no number literal (a digit not inside an identifier such as iv1 or m3_s) typed outside the GEOMETRY / FORMATS blocks, comments and standards text (internals-core K5, per file) */
{
  const fs = require('node:fs');
  for (const f of ['pump', 'tower', 'crah']) {
    let t = fs.readFileSync(new URL('../js/conv/internals/' + f + '.js', import.meta.url), 'utf8');
    for (const [b0, b1] of [['/* GEOMETRY BEGIN', '/* GEOMETRY END */'], ['/* FORMATS BEGIN', '/* FORMATS END */']]) {
      const i = t.indexOf(b0), j = t.indexOf(b1); if (i >= 0 && j > i) t = t.slice(0, i) + t.slice(j);
    }
    t = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/(standard|basis): '[^']*'/g, "$1: ''");
    const hits = t.split('\n').filter((l) => /(^|[^\w.])\d/.test(l)).map((l) => l.trim());
    ok(hits.length === 0, `P3-1b ${f}.js: digits outside geometry: ${hits.slice(0, 3).join(' | ')}`);
  }
}
/* P3-2 hand checks */
const rho = c.water_density_kg_m3, g = c.gravity_m_s2;
for (const [svc, fleetKey, head] of [['cdw', 'cdw_pump', 'cdw_head_m'], ['chw_primary', 'chw_primary_pump', 'chw_primary_head_m'], ['chw_secondary', 'chw_secondary_pump', 'chw_secondary_head_m']]) {
  const u = C.getFleet(fleetKey).find((x) => x.state === 'running'), Q = u.flowLps / 1000, H = c[head];
  const hyd = rho * g * Q * H / 1000, shaft = hyd / c.pump_efficiency, dp = rho * g * H / 1000;
  ok(Math.abs(c[svc + '_pump_hydraulic_kw'] - hyd) <= 0.05, `P3-2 ${svc}: hydraulic ${c[svc + '_pump_hydraulic_kw']} vs rho g Q H ${hyd.toFixed(2)}`);
  ok(Math.abs(c[svc + '_pump_shaft_kw'] - shaft) <= 0.05, `P3-2 ${svc}: shaft ${c[svc + '_pump_shaft_kw']} vs ${shaft.toFixed(2)}`);
  ok(Math.abs(c[svc + '_pump_dp_kpa'] - dp) <= 0.05, `P3-2 ${svc}: dP ${c[svc + '_pump_dp_kpa']} vs ${dp.toFixed(2)}`);
  ok(Math.abs(shaft / (c.pump_motor_efficiency * c.pump_vfd_efficiency) - u.kwE) <= 0.15, `P3-2 ${svc}: shaft / (motor x VFD) ${(shaft / (c.pump_motor_efficiency * c.pump_vfd_efficiency)).toFixed(2)} vs kW_e ${u.kwE}`);
}
const cr = C.getFleet('crah', 'A').find((x) => x.state === 'running');
ok(Math.abs(c.crah_unit_airflow_m3_s - cr.dutyKw / (c.air_density_kg_m3 * c.air_cp_kj_kg_k * c.airside_delta_t_k)) <= 0.01, `P3-2 CRAH airflow ${c.crah_unit_airflow_m3_s}`);
ok(c.air_density_kg_m3 > 1.1 && c.air_density_kg_m3 < 1.3 && c.air_cp_kj_kg_k > 1 && c.air_cp_kj_kg_k < 1.01, 'P3-2 air properties outside the standard range');

/* ---------- browser ---------- */
if (!argv.includes('--node-only')) {
  const { default: puppeteer } = await import('puppeteer');
  const { serve } = await import('./audit-conv-text.mjs');
  const { primeCockpitAuditDocument, enterAuthorizedAuditState } = await import('./lib/cockpit-audit-state.mjs');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const CASES = [['cp1', 'cdw_pump', true], ['ct1', 'tower_cell', true], ['crahA', 'crah', false], ['ps1', 'chw_secondary_pump', false]];
  try {
    for (const W of WIDTHS) for (const [id, cls, cdw] of CASES) {
      const T = id + '@' + W;
      const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844 });
      await primeCockpitAuditDocument(pg, 'dark');
      await pg.goto(base + 'chiller-plant.html', { waitUntil: 'load', timeout: 90000 });
      await enterAuthorizedAuditState(pg, 'chiller-plant');
      await pg.waitForFunction(() => document.querySelector('#chw-sheet-host .hmi-node'), { timeout: 30000 }).catch(() => {});
      await sleep(1200);
      if (cdw) { await pg.evaluate(() => { const b = [...document.querySelectorAll('button,[role=tab]')].find((x) => /condenser|cdw/i.test(x.textContent) && x.offsetParent); if (b) b.click(); }); await sleep(1200); }
      const t = await pg.evaluate((id) => { const gq = document.querySelector('#chw-sheet-host .hmi-node[data-node="' + id + '"]'); if (!gq) return null;
        gq.scrollIntoView({ block: 'center', inline: 'center' }); const r = (gq.querySelector('.b') || gq).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: gq.getAttribute('data-tag') }; }, id);
      ok(!!t, `P3-3 ${T}: symbol not found`);
      if (!t) { await pg.close(); continue; }
      await pg.mouse.click(t.x, t.y); await sleep(1000);
      const s = await pg.evaluate((cls) => {
        const m = document.querySelector('.rz-cvm:not([hidden])'); if (!m) return { modal: false };
        const svg = m.querySelector('[data-rz-cvm-int] svg.hmi-svg'); const title = (m.querySelector('h2,h1') || {}).textContent || '';
        if (!svg) return { modal: true, svg: false, title };
        const I = window.RZConvInternals, def = I.get(cls);
        const fl = window.CONV_CALC.getFleet(cls, /CRAH-([A-Z]+)/.exec(title) ? /CRAH-([A-Z]+)/.exec(title)[1] : undefined);
        const unit = fl.find((u) => title.indexOf(u.tag) === 0) || fl[0];
        const rd = I.read(cls, unit, window.CONV_CALC.snapshot);
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
        const rows = {}; for (const r of m.querySelectorAll('.rz-cvm-row')) { const k = r.querySelector('.rz-cvm-k'); const lbl = ((k || {}).textContent || '').trim(); if (!(lbl in rows)) rows[lbl] = [...r.children].filter((x) => x !== k).map((x) => x.textContent).join(' ').trim(); } // first row wins: the live reading comes before an alarm row of the same name
        return { modal: true, svg: true, title, nodes: svg.querySelectorAll('.hmi-node').length, want: def.sheet(unit).nodes.length, vals, over, outside, rows,
          speed: unit.speedPct, state: unit.state, tag: unit.tag };
      }, cls);
      ok(s.modal && s.svg, `P3-3 ${T}: one click did not open the internal drawing (modal ${s.modal}, drawing ${s.svg})`);
      if (s.svg) {
        ok(s.title.indexOf(t.tag || s.tag) === 0 || s.title.indexOf(s.tag) === 0, `P3-3 ${T}: title "${s.title}"`);
        ok(s.nodes >= s.want, `P3-3 ${T}: ${s.nodes} nodes drawn of ${s.want}`);
        ok(s.vals.length > 0, `P3-4 ${T}: no values drawn`);
        for (const v of s.vals) ok(v.want !== null && v.text === v.want, `P3-4 ${T} ${v.nid}:${v.k}: drawn "${v.text}", read() "${v.want}"`);
        ok(s.over.length === 0, `P3-5 ${T}: overlapping text ${s.over.slice(0, 4).join(' | ')}`);
        ok(s.outside.length === 0, `P3-5 ${T}: text outside the drawing ${s.outside.slice(0, 4).join(' | ')}`);
        for (const lbl of (/pump/.test(cls) ? ['Motor current', 'Vibration (ISO 10816)'] : cls === 'tower_cell' ? ['Basin level', 'Fan vibration'] : [])) ok(s.rows[lbl] !== undefined && /not modelled$/.test(s.rows[lbl]), `P3-6 ${T}: reading "${lbl}" = ${s.rows[lbl]}`);
        if (/pump/.test(cls) && s.state === 'running') ok(s.rows.Speed !== undefined && new RegExp('(^|\\s)' + Math.round(s.speed) + '\\s*%').test(s.rows.Speed), `P3-6 ${T}: reading Speed ${s.rows.Speed}, engine ${s.speed}`);
      }
      ok(errs.length === 0, `P3-6 ${T}: page errors ${errs.slice(0, 2).join(' | ')}`);
      await pg.close();
    }
  } finally { await browser.close(); srv.close(); }
}

if (fails.length) { console.log('CONV INTERNALS P3 — FAIL (' + fails.length + ' of ' + checks + ')'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log('CONV INTERNALS P3 — PASS (' + checks + ' checks: pump / tower / CRAH insides from the engine, hand-checked pump power and airflow, one click opens each drawing, values = read(), no text overlap, readings agree)');
