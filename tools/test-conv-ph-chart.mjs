#!/usr/bin/env node
/* test-conv-ph-chart.mjs — PRD-CONV-EQUIPMENT-INSIDE §5.5 (P2b): the chiller modal draws the unit's refrigeration cycle on
   a pressure-enthalpy chart, from the engine and nothing else.
   PH1 one click on CH-01 opens the modal with a "Refrigeration cycle (P-h)" section: one SVG, 8 numbered points, 8
       segments each stroked with a refrigerant medium token, the saturation dome, at least 2 isotherms
   PH2 every point's data-h / data-p equal snapshot.cooling.chiller_cycle_points, and its DRAWN position equals the
       axis mapping read back from the rendered tick labels (h linear, P logarithmic) within 1.5 px
   PH3 the state-point table has 8 rows; T, P, h equal the engine at the printed precision
   PH4 every point is focusable with an aria-label naming its number and pressure; the key names the 4 segment colours
   PH5 a standby unit (CH-08 from the fleet strip) shows no cycle chart
   PH6 at 390 px the chart fits its section (no sideways scroll), tick text >= 11 px; 0 page errors
   Red on v3.91.0 without js/conv/ph-chart.js (no section). node tools/test-conv-ph-chart.mjs [--width=390] */
import puppeteer from 'puppeteer';
import { serve } from './audit-conv-text.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const argW = process.argv.slice(2).filter((a) => a.startsWith('--width=')).map((a) => +a.slice(8));
const WIDTHS = argW.length ? argW : [1440, 390];
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port + '/';
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

async function open(W) {
  const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844 });
  await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(base + 'chiller-plant.html', { waitUntil: 'load', timeout: 90000 });
  await enterAuthorizedAuditState(pg, 'chiller-plant');
  await pg.waitForFunction(() => document.querySelector('#chw-sheet-host .hmi-node[data-node="ch1"]'), { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  const t = await pg.evaluate(() => {
    const g = document.querySelector('#chw-sheet-host .hmi-node[data-node="ch1"]'); if (!g) return null;
    g.scrollIntoView({ block: 'center', inline: 'center' }); const r = (g.querySelector('.b') || g).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (t) { await pg.mouse.click(t.x, t.y); await sleep(900); }
  return { pg, errs, found: !!t };
}

const probe = () => {
  const m = document.querySelector('.rz-cvm:not([hidden])'); if (!m) return { modal: false };
  const sec = [...m.querySelectorAll('section.rz-cvm-sec')].find((s) => /Refrigeration cycle/.test((s.querySelector('h3') || {}).textContent || ''));
  if (!sec) return { modal: true, sec: false };
  const svg = sec.querySelector('svg.rz-ph-svg'); if (!svg) return { modal: true, sec: true, svg: false };
  const sb = svg.getBoundingClientRect();
  const ticks = (attr) => [...svg.querySelectorAll('text[' + attr + ']')].map((n) => ({ v: +n.getAttribute(attr), x: +n.getAttribute('x'), y: +n.getAttribute('y') }));
  const pts = [...svg.querySelectorAll('[data-ph-pt]')].map((g) => {
    const c = g.querySelector('.rz-ph-dot');
    return { pt: +g.getAttribute('data-ph-pt'), h: +g.getAttribute('data-h'), p: +g.getAttribute('data-p'), cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy'),
      tab: g.getAttribute('tabindex'), aria: g.getAttribute('aria-label') || '' };
  });
  const segs = [...svg.querySelectorAll('[data-ph-seg]')].map((l) => ({ id: l.getAttribute('data-ph-seg'), style: l.getAttribute('style') || '', stroke: getComputedStyle(l).stroke }));
  const rows = [...sec.querySelectorAll('[data-ph-row]')].map((r) => [...r.children].map((c) => c.textContent));
  const tickFont = Math.min(...[...svg.querySelectorAll('.rz-ph-tick')].map((n) => parseFloat(getComputedStyle(n).fontSize)));
  const key = [...sec.querySelectorAll('.rz-ph-key span')].map((s) => s.textContent);
  const secR = sec.getBoundingClientRect(), panel = m.querySelector('.rz-cvm-panel');
  return { modal: true, sec: true, svg: true, pts, segs, rows, tickFont, key, hT: ticks('data-h-tick'), pT: ticks('data-p-tick'),
    dome: !!svg.querySelector('[data-ph-dome]'), iso: svg.querySelectorAll('.rz-ph-iso').length,
    fit: sb.width <= secR.width + 0.5, sideways: panel ? panel.scrollWidth - panel.clientWidth : 0,
    cycle: window.CONV_CALC && window.CONV_CALC.snapshot.cooling.chiller_cycle_points };
};

try {
  for (const W of WIDTHS) {
    const T = 'CH-01@' + W;
    const { pg, errs, found } = await open(W);
    ok(found, T + ': CH-01 symbol not found');
    const s = await pg.evaluate(probe);
    ok(s.modal && s.sec && s.svg, `PH1 ${T}: no P-h chart in the modal ${JSON.stringify({ modal: s.modal, sec: s.sec, svg: s.svg })}`);
    if (s.svg) {
      ok(s.pts.length === 8, `PH1 ${T}: ${s.pts.length} points`);
      ok(s.segs.length === 8 && s.segs.every((g) => /var\(--hmi-m-ref-/.test(g.style) && g.stroke && g.stroke !== 'none'), `PH1 ${T}: segments not stroked by a refrigerant token`);
      ok(s.dome && s.iso >= 2, `PH1 ${T}: dome ${s.dome}, isotherms ${s.iso}`);
      /* PH2: values and drawn positions */
      const E = s.cycle || [];
      for (const q of s.pts) {
        const e = E[q.pt - 1] || {};
        ok(q.h === e.h_kj_kg && q.p === e.p_kpa_abs, `PH2 ${T} pt ${q.pt}: data h ${q.h} p ${q.p} vs engine ${e.h_kj_kg} ${e.p_kpa_abs}`);
      }
      const [a, b] = [s.hT[0], s.hT[s.hT.length - 1]], [c, d] = [s.pT[0], s.pT[s.pT.length - 1]];
      ok(s.hT.length >= 2 && s.pT.length >= 2, `PH2 ${T}: ticks h ${s.hT.length} P ${s.pT.length}`);
      if (s.hT.length >= 2 && s.pT.length >= 2) {
        const X = (h) => a.x + (h - a.v) / (b.v - a.v) * (b.x - a.x);
        const Y = (p) => (c.y - 4) + (Math.log(p) - Math.log(c.v)) / (Math.log(d.v) - Math.log(c.v)) * ((d.y - 4) - (c.y - 4));
        for (const q of s.pts) ok(Math.abs(X(q.h) - q.cx) <= 1.5 && Math.abs(Y(q.p) - q.cy) <= 1.5, `PH2 ${T} pt ${q.pt}: drawn at ${q.cx},${q.cy}, axes say ${X(q.h).toFixed(1)},${Y(q.p).toFixed(1)}`);
      }
      /* PH3 table */
      ok(s.rows.length === 8, `PH3 ${T}: ${s.rows.length} table rows`);
      s.rows.forEach((r, i) => { const e = E[i] || {}; ok(r[2] === e.t_c.toFixed(1) && r[3] === e.p_kpa_abs.toFixed(0) && r[4] === e.h_kj_kg.toFixed(1), `PH3 ${T} row ${i + 1}: ${r.slice(2, 5)} vs engine`); });
      /* PH4 a11y + key */
      ok(s.pts.every((q) => q.tab === '0' && new RegExp('^' + q.pt + ' .*kPa').test(q.aria)), `PH4 ${T}: a point is not focusable or unnamed`);
      ok(s.key.length === 4, `PH4 ${T}: key has ${s.key.length} entries`);
      /* PH6 fit */
      ok(s.fit && s.sideways <= 1, `PH6 ${T}: chart overflows (fit ${s.fit}, sideways ${s.sideways})`);
      ok(s.tickFont >= 11, `PH6 ${T}: tick text ${s.tickFont} px`);
    }
    /* PH5 standby unit */
    const sb = await pg.evaluate(() => { const b = [...document.querySelectorAll('.rz-cvm:not([hidden]) .rz-cvm-cell')].find((x) => x.getAttribute('data-vstate') && /stby|standby/i.test(x.textContent + x.getAttribute('data-vstate'))); if (!b) return null; b.click(); return b.getAttribute('data-unit'); });
    ok(sb !== null, `PH5 ${T}: no standby unit in the fleet strip`);
    await sleep(700);
    const s2 = await pg.evaluate(probe);
    ok(s2.modal && s2.sec === false, `PH5 ${T}: standby unit ${sb} still shows a cycle chart`);
    ok(errs.length === 0, `PH6 ${T}: page errors ${errs.slice(0, 2).join(' | ')}`);
    await pg.close();
  }
} finally { await browser.close(); srv.close(); }

if (fails.length) { console.log('CONV P-H CHART — FAIL (' + fails.length + ' of ' + checks + ')'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log('CONV P-H CHART — PASS (' + checks + ' checks: CH-01 cycle drawn from the engine at 1440 + 390, positions = axes, table, keyboard, standby has none)');
