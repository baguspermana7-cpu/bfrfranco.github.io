#!/usr/bin/env node
/* test-conv-epms-sld.mjs — STRICT. E-S-101, the HV / MV single-line of EPMS_Telemetry.html (PRD-CONV-LIVING-PLANT
   §8.1-8.2, phase P5a), in a real browser at 1440 and 390 px, driven through the page's own UI (clicks on the sheet
   symbols, the inspector's SIMULATION and "Time–current curves" buttons, Esc):
   V1  the default view is the HV / MV sheet (view switch pressed, panel shown); the first <svg> under the host is the
       sheet; the LV distribution button switches to sheet E-S-102 (phase E5) and back
   V2  the 150 kV level and the 20 kV switchgear exist with every required tag drawn (list REQUIRED below)
   V3  every relay names its ANSI / IEEE C37.2 functions (87L/21, 87B, 50BF, 87T + 50/51, 51G, 50/51, 50/51 + 50N/51N, LSIG)
   V4  labels equal the engine: transformer MVA, 150 kV and 20 kV fault levels, NGR ohm, LVSB count, genset count and
       per hall, read from window.CONV_CALC.snapshot.electrical in the page (never typed in this gate)
   V5  normal state: every main-path conductor 'running', the bus-tie path not flowing (not running, 0 kW chip);
       TX-1 load % = the engine's normal loading
   V6  power balance: at every bus node of the solved model |kW in - kW out| <= 0.5 % of kW in; and on the drawing,
       each incomer chip = the sum of its section's feeder chips (+-0.5 %)
   V7  closing the bus tie with both incomers closed is REFUSED with a stated reason (2-out-of-3)
   V8  opening a disconnector under a closed breaker is REFUSED with a stated reason
   V9  opening CB-IN1 kills section A: its bus and feeder conductors 'stopped', its feeder chips 0 kW / 0 A
   V10 then closing the bus tie is ALLOWED: section A re-energised from TX-2, TX-2 load % = 2 x normal and <= the
       engine's N-1 figure
   V11 the TCC modal opens from the feeder relay: 4 device curves (the feeder emphasised) + the damage curve + the inrush
       point + 2 fault markers + a coordination table whose margins are all >= the engine grading margin; Esc closes
       it and focus returns to the button that opened it
   V12 no page error; no sideways page scroll at 390 px
   V13 every TCC device curve stops at the largest current its device can see (LV main: the LV maximum fault referred
       to 20 kV; 20 kV feeder, incomer and the 150 kV transformer relay: the 20 kV fault level), read back from the
       drawn path, x 1.001; each ends in a mark and its legend line says so
   V14 while the HV / MV view is shown the legacy LV chrome is gone (no "(20kV)" utility heading, no GEN A/B/C rail,
       no legacy breaker counters) and the rail + both breaker counters equal the simulation; the LV view restores them
   Usage: node tools/test-conv-epms-sld.mjs [--shots=<dir>]   (browser gates run through rz-lane, see the brief) */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = (process.argv.find((a) => a.startsWith('--shots=')) || '').split('=')[1];
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
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HOST = '#epms-sheet-host';

const REQUIRED = ['PLN LINE 1', 'PLN LINE 2', 'SA-L1', 'SA-L2', 'VT-L1', 'VT-L2', 'DSL-L1', 'DSL-L2', 'ES-L1', 'ES-L2', 'CB-L1', 'CB-L2',
  'CT-L1', 'CT-L2', 'R-L1', 'R-L2', 'DS1-L1', 'DS2-L1', 'DS1-L2', 'DS2-L2', 'DS1-CP', 'DS2-CP', 'CB-CP', 'R-CP', 'R-BB',
  'DS1-T1', 'DS2-T1', 'CB-T1', 'CT-T1', 'R-T1', 'DS1-T2', 'DS2-T2', 'CB-T2', 'CT-T2', 'R-T2', 'TX-1', 'TX-2', 'NGR-1', 'NGR-2', 'R-NG1', 'R-NG2',
  'CB-IN1', 'CB-IN2', 'CT-IN1', 'CT-IN2', 'R-IN1', 'R-IN2', 'CB-TIE', 'CB-FA1', 'CB-FA2', 'CB-FA3', 'CB-FA4', 'CB-FB1', 'CB-FB2', 'CB-FB3', 'CB-FB4',
  'R-FA1', 'R-FB1', 'CB-GA', 'CB-GB', 'CB-GEN', 'GEN', 'TX-DA', 'TX-DB', 'CB-LVA', 'CB-LVB', 'R-LVA', 'R-LVB', 'LVSB-A', 'LVSB-B'];
const ANSI = { 'R-L1': ['87L', '21'], 'R-BB': ['87B'], 'R-CP': ['50BF'], 'R-T1': ['87T', '50/51'], 'R-NG1': ['51G'], 'R-IN1': ['50/51'],
  'R-FA1': ['50/51', '50N/51N'], 'R-LVA': ['LSIG'] };
/* the conductors of the normal main path (both streams): line in -> BB -> transformer -> incomer -> bus -> feeder */
const MAIN = ['l1-in', 'l1-c1', 'l1-c2', 'l1-c3', 'l1-c4', 'l1-c5', 'l1-c6', 'l1-b1', 'l2-in', 'l2-c3', 'l2-c7', 'l2-b2',
  't1-a', 't1-c', 't1-e', 't1-f', 't1-g', 't1-h', 'i1-a', 'i1-b', 't2-b', 't2-d', 't2-e', 't2-g', 't2-h', 'i2-a', 'i2-b',
  'fa1-a', 'fa1-b', 'fa1-c', 'fa4-c', 'fa4-e', 'da-a', 'da-b', 'fb1-a', 'fb4-c', 'db-a', 'db-b'];
const SEC_A = ['ma-2', 'ma-3', 'ma-4', 'ma-5', 'ma-6', 'fa1-a', 'fa1-b', 'fa1-c', 'fa2-c', 'fa3-c', 'fa4-c', 'da-a', 'da-b'];

const snap = (pg) => pg.evaluate((H) => {
  const host = document.querySelector(H);
  const vs = (id) => { const p = host.querySelector('path.hmi-edge[data-edge="' + id + '"]:not(.hmi-flow):not(.hmi-edge-shadow):not(.hmi-edge-hi)'); return p ? p.getAttribute('data-vstate') : null; };
  /* a point's state glyph (tspan.rz-pt-g, aria-hidden, PRD-CONV-POINT-STATUS-TREND) is decoration, not the value */
  const vtext = (t) => { let x = ''; t.childNodes.forEach((n) => { if (!(n.classList && n.classList.contains('rz-pt-g'))) x += n.textContent; }); return x.trim(); };
  const val = (k) => { const t = host.querySelector('text[data-val="' + k + '"]'); return t ? vtext(t) : null; };
  const out = { edges: {}, vals: {} };
  host.querySelectorAll('path.hmi-edge[data-edge]:not(.hmi-flow)').forEach((p) => { out.edges[p.getAttribute('data-edge')] = vs(p.getAttribute('data-edge')); });
  host.querySelectorAll('text[data-val]').forEach((t) => { out.vals[t.getAttribute('data-val')] = vtext(t); });
  out.msg = (document.getElementById('epms-sld-msg') || {}).textContent || '';
  out.over = document.documentElement.scrollWidth > innerWidth + 1;
  return out;
}, HOST);
const num = (t) => (t == null ? NaN : Number(String(t).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0]));

/* a click on a symbol body opens the inspector; the named action button is then clicked */
async function act(pg, node, action) {
  await pg.keyboard.press('Escape'); await sleep(120);
  const pt = await pg.evaluate((H, id) => {
    const g = document.querySelector(H + ' .hmi-node[data-node="' + id + '"]'); if (!g) return null;
    g.scrollIntoView({ block: 'center', inline: 'center' });
    const b = g.querySelector('.hmi-hit') || g; const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, HOST, node);
  if (!pt) return 'no node ' + node;
  await pg.mouse.click(pt.x, pt.y); await sleep(300);
  /* v3.93.0 (PRD-CONV-EQUIPMENT-INSIDE P4b): a breaker, switch or relay opens its equipment modal on one click; the same
     page actions (same ids, same handlers, select-before-operate kept) sit in the modal's action row. Other symbols keep the
     inspector. Either is the operator's one route, so accept whichever this click opened. */
  const sel = 'aside.rz-inspector.open [data-rz-action="' + action + '"], .rz-cvm:not([hidden]) [data-rz-cvm-act="' + action + '"]';
  if (!(await pg.$(sel))) { await sleep(600); if (!(await pg.$(sel))) return 'no ' + action + ' button for ' + node; }
  await pg.click(sel); await sleep(350);
  /* E12: a switching operation sweeps downstream hop by hop (<= 2 s); read the sheet once the sweep has landed */
  await pg.waitForFunction((H) => !document.querySelector(H + '[data-sweeping], ' + H + ' [data-sweeping]'), { timeout: 4000 }, HOST).catch(() => {});
  return null;
}

/* a screenshot of the page as an operator sees it: inspector closed, pointer parked, the named item in view */
async function shot(pg, name, nodeId) {
  if (!SHOTS) return;
  await pg.keyboard.press('Escape'); await sleep(120); await pg.keyboard.press('Escape'); await sleep(120);
  await pg.mouse.move(2, 2);
  await pg.evaluate((H, id) => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const panel = document.getElementById('epms-sld-view');
    const g = id && document.querySelector(H + ' .hmi-node[data-node="' + id + '"]');
    if (g) g.scrollIntoView({ block: 'center', inline: 'center' }); else panel.scrollTop = 0;
  }, HOST, nodeId || null);
  await sleep(400);
  await pg.screenshot({ path: path.join(SHOTS, name) });
}

for (const W of [1440, 390]) {
  const pg = await browser.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844, deviceScaleFactor: 1 });
  await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + 'EPMS_Telemetry.html', { waitUntil: 'networkidle0', timeout: 90000 });
  await enterAuthorizedAuditState(pg, 'epms');
  await sleep(2500);
  const at = `@${W}`;

  /* V1 default view + first svg + the switch */
  const v1 = await pg.evaluate((H) => {
    const host = document.querySelector(H), panel = document.getElementById('epms-sld-view');
    const b = [...document.querySelectorAll('.epms-view-btn')].map((x) => [x.getAttribute('data-epms-view'), x.getAttribute('aria-pressed')]);
    return { panel: !!panel && !panel.hidden && panel.getBoundingClientRect().width > 200, first: host && host.querySelector('svg') && host.querySelector('svg').id,
      btns: b, view: document.body.getAttribute('data-epms-view'), live: !!(window.RZEpmsPage && window.RZEpmsPage.live) };
  }, HOST);
  ok(v1.live, `V1${at} the page did not reach a live single-line (EPMS authority or modules missing)`);
  ok(v1.panel && v1.view === 'sld', `V1${at} the default view is not the HV / MV sheet (view ${v1.view})`);
  ok(JSON.stringify(v1.btns) === JSON.stringify([['sld', 'true'], ['lv', 'false']]), `V1${at} view switch state ${JSON.stringify(v1.btns)}`);
  ok(v1.first === 'epms-sld-svg', `V1${at} the first <svg> under the host is "${v1.first}", not the sheet`);
  if (W === 1440) {
    await pg.click('.epms-view-btn[data-epms-view="lv"]'); await sleep(200);
    /* phase E5 (PRD-CONV-EQUIPMENT-TRUTH): the legacy LV drawing is gone; the LV button shows sheet E-S-102 (its own gate:
       tools/test-conv-epms-lv.mjs) */
    const lv = await pg.evaluate(() => ({ hidden: document.getElementById('epms-sld-view').hidden, lvSheet: !!document.querySelector('#epms-lv-view:not([hidden]) svg#epms-lv-svg') }));
    ok(lv.hidden && lv.lvSheet, `V1${at} the LV distribution button did not show sheet E-S-102`);
    await pg.click('.epms-view-btn[data-epms-view="sld"]'); await sleep(300);
  }

  /* V2 + V3 tags and ANSI names */
  const tags = await pg.evaluate((H) => {
    const out = {};
    document.querySelectorAll(H + ' text[data-tag-of]').forEach((t) => { const r = t.getBoundingClientRect(); if (r.width > 0) out[t.textContent.trim()] = t.getAttribute('data-tag-of'); });
    const names = {};
    document.querySelectorAll(H + ' text[data-name-of]').forEach((t) => { names[t.getAttribute('data-name-of')] = t.textContent.trim(); });
    return { tags: out, names };
  }, HOST);
  const missing = REQUIRED.filter((t) => !tags.tags[t]);
  ok(!missing.length, `V2${at} required tags not drawn: ${missing.join(', ')}`);
  for (const [tag, fns] of Object.entries(ANSI)) {
    const name = tags.names[tags.tags[tag]] || '';
    ok(fns.every((f) => name.split(/[\s·]+/).includes(f)), `V3${at} ${tag} does not name ${fns.join(' + ')} (drawn "${name}")`);
  }

  /* V4 labels equal the engine */
  const E = await pg.evaluate(() => window.CONV_CALC.snapshot.electrical);
  let s = await snap(pg);
  const has = (k, frag) => ok((s.vals[k] || '').includes(frag), `V4${at} ${k} reads "${s.vals[k]}", expected to contain "${frag}" from the engine`);
  has('tx1:r', `${E.hv_tx_mva} MVA`); has('tx2:r', `${E.hv_voltage_kv}/${E.mv_voltage_kv} kV`);
  has('l1-src:r', `${E.hv_fault_level_ka} kA`); has('i1-cb:bus', `${E.mv_fault_level_ka} kA`); has('i2-cb:bus', `${E.mv_voltage_kv} kV`);
  has('t1-ngr:r', `${E.mv_ngr_ohm} Ω`); has('da-ld:r', `× ${E.dist_tx_count}`); has('gen:r', `× ${E.genset_count}`); has('gen:r', `${E.genset_per_hall} per hall`);
  has('da-tx:r', `${E.dist_tx_kva.toLocaleString('en-US')} kVA`); has('bb-r:bb1', `${E.hv_voltage_kv} kV`);

  /* V5 normal state */
  const notRun = MAIN.filter((id) => s.edges[id] !== 'running');
  ok(!notRun.length, `V5${at} main-path conductors not running in the normal state: ${notRun.map((id) => id + '=' + s.edges[id]).join(', ')}`);
  ok(s.edges['tie-a'] !== 'running' && s.edges['tie-b'] !== 'running' && num(s.vals['tie:pw']) === 0,
    `V5${at} the open bus tie carries flow (${s.edges['tie-a']}/${s.edges['tie-b']}, chip "${s.vals['tie:pw']}")`);
  ok(s.vals['tx1:ld'] === `load ${E.hv_tx_load_pct_normal.toFixed(1)} %`, `V5${at} TX-1 load "${s.vals['tx1:ld']}" is not the engine's normal ${E.hv_tx_load_pct_normal} %`);

  /* V6 balance */
  const bal = await pg.evaluate(() => window.RZEpmsPage.balance());
  const bad = Object.entries(bal).filter(([, b]) => Math.abs(b.net) > 0.005 * Math.max(b.into, 1));
  ok(Object.keys(bal).length > 50 && !bad.length, `V6${at} bus balance off at ${bad.slice(0, 5).map(([id, b]) => id + ' net ' + b.net.toFixed(1)).join(', ')} (${Object.keys(bal).length} buses)`);
  for (const [inc, feeders] of [['i1-cb', ['fa1-cb', 'fa2-cb', 'fa3-cb', 'fa4-cb', 'ga-cb']], ['i2-cb', ['fb1-cb', 'fb2-cb', 'fb3-cb', 'fb4-cb', 'gb-cb']]]) {
    const inKw = num(s.vals[inc + ':pw']), sum = feeders.reduce((a, f) => a + num(s.vals[f + ':kw'] ?? s.vals[f + ':pw']), 0);
    ok(Math.abs(inKw - sum) <= 0.005 * inKw + 2, `V6${at} ${inc} chip ${inKw} kW != its feeders ${sum} kW`);
  }
  if (W === 1440) { await shot(pg, 'epms-sld-normal-1440.png', null); await shot(pg, 'epms-sld-normal-mv-1440.png', 'i1-ct'); }
  const chromeOf = () => pg.evaluate(() => {
    /* PRD-COCKPIT-QUIET (SITE_CHROME §9a): the status strip with the legacy counters is in Details; open it so
       "shown" means the page's own view logic, not the closed disclosure */
    if (window.RZConvShell && RZConvShell.setDetails) RZConvShell.setDetails(true, false);
    const vis = (id) => { const e = document.getElementById(id); return !!(e && e.offsetParent !== null); };
    const txt = document.body.innerText;
    return { gen: /\bGEN C\b/.test(txt), util: /utility sources \(20kv\)/i.test(txt), legacyTrips: vis('epms-trips'), legacyBottom: vis('val-breakers'),
      trips: (document.getElementById('epms-sld-trips') || {}).textContent, bottom: (document.getElementById('val-sld-breakers') || {}).textContent,
      rail: [...document.querySelectorAll('#epms-rail-sources [data-rail]')].map((li) => li.textContent), genLine: (document.getElementById('epms-rail-gen') || {}).textContent,
      railShown: vis('epms-sld-rail'), sim: window.RZEpmsPage.breakers() };
  });
  const chromeOk = (c, when) => {
    ok(!c.gen && !c.util && !c.legacyTrips && !c.legacyBottom, `V14${at} ${when}: legacy chrome still shown in the HV / MV view (GEN C ${c.gen}, (20kV) ${c.util}, legacy counters ${c.legacyTrips}/${c.legacyBottom})`);
    ok(c.trips === `${c.sim.total - c.sim.closed} open` && c.bottom === `${c.sim.closed} / ${c.sim.total}`, `V14${at} ${when}: counters "${c.trips}" / "${c.bottom}" != simulation ${c.sim.closed} closed of ${c.sim.total}`);
  };
  if (W === 1440) {
    const c = await chromeOf();
    chromeOk(c, 'normal');
    ok(c.railShown && c.rail.length === 4 && /PLN LINE 1/.test(c.rail[0]) && /TX-2/.test(c.rail[3]) && new RegExp(`${E.hv_tx_load_pct_normal.toFixed(1)} %`).test(c.rail[2]),
      `V14${at} rail sources ${JSON.stringify(c.rail)}`);
    ok(new RegExp(`^${E.genset_count} sets`).test(c.genLine) && /OFF/.test(c.genLine), `V14${at} rail generation "${c.genLine}"`);
    await pg.click('.epms-view-btn[data-epms-view="lv"]'); await sleep(300);
    const lv = await chromeOf();
    /* phase E5: the LV view shows E-S-102 and its own rail and counters; the three legacy gensets never come back */
    ok(!lv.gen && !lv.util && lv.legacyTrips && lv.legacyBottom && !lv.railShown, `V14${at} the LV view shows legacy chrome or lost its counters (GEN C ${lv.gen}, (20kV) ${lv.util}, counters ${lv.legacyTrips}/${lv.legacyBottom}, E-S-101 rail ${lv.railShown})`);
    if (SHOTS) { await pg.mouse.move(2, 2); await pg.screenshot({ path: path.join(SHOTS, 'epms-lv-view-1440.png') }); }
    await pg.click('.epms-view-btn[data-epms-view="sld"]'); await sleep(300);
  }

  if (W === 1440) {
    /* V7 tie refused */
    let e = await act(pg, 'tie', 'sim-close'); ok(!e, `V7${at} ${e}`);
    s = await snap(pg);
    ok(/REFUSED/.test(s.msg) && /2-out-of-3/.test(s.msg) && /CB-IN1 and CB-IN2/.test(s.msg), `V7${at} closing the tie with both incomers closed was not refused with a reason: "${s.msg}"`);
    ok(s.vals['tie:st'] === 'OPEN', `V7${at} the tie moved: ${s.vals['tie:st']}`);
    /* V8 disconnector under a closed breaker refused */
    e = await act(pg, 'l1-ds1', 'sim-open'); ok(!e, `V8${at} ${e}`);
    s = await snap(pg);
    ok(/REFUSED/.test(s.msg) && /CB-L1 open/.test(s.msg), `V8${at} opening DS1-L1 under closed CB-L1 was not refused with a reason: "${s.msg}"`);
    ok(s.edges['l1-b1'] === 'running', `V8${at} DS1-L1 moved anyway (l1-b1 ${s.edges['l1-b1']})`);
    /* V9 incomer opened: section A dead */
    e = await act(pg, 'i1-cb', 'sim-open'); ok(!e, `V9${at} ${e}`);
    s = await snap(pg);
    const live = SEC_A.filter((id) => s.edges[id] !== 'stopped');
    ok(!live.length, `V9${at} section A conductors not stopped after CB-IN1 opened: ${live.map((id) => id + '=' + s.edges[id]).join(', ')}`);
    ok(['fa1-cb', 'fa2-cb', 'fa3-cb', 'fa4-cb'].every((f) => s.vals[f + ':kw'] === '0 kW' && s.vals[f + ':amp'] === '0 A'),
      `V9${at} section A feeder chips not 0: ${['fa1-cb', 'fa4-cb'].map((f) => s.vals[f + ':kw'] + ' ' + s.vals[f + ':amp']).join(' | ')}`);
    ok(num(s.vals['tx1:pw']) === 0, `V9${at} TX-1 still reads load: ${s.vals['tx1:pw']}`);
    chromeOk(await chromeOf(), 'after CB-IN1 opened');
    await shot(pg, 'epms-sld-section-a-dead-1440.png', 'i1-ct');
    /* V10 tie closed: allowed, A re-energised from TX-2 */
    e = await act(pg, 'tie', 'sim-close'); ok(!e, `V10${at} ${e}`);
    s = await snap(pg);
    ok(!/REFUSED/.test(s.msg) && s.vals['tie:st'] === 'CLOSED', `V10${at} closing the tie with CB-IN1 open was not allowed: "${s.msg}"`);
    const back = SEC_A.filter((id) => s.edges[id] !== 'running');
    ok(!back.length, `V10${at} section A not re-energised through the tie: ${back.map((id) => id + '=' + s.edges[id]).join(', ')}`);
    const ld2 = num(s.vals['tx2:ld']);
    ok(Math.abs(ld2 - 2 * E.hv_tx_load_pct_normal) <= 0.15 && ld2 <= E.hv_tx_load_pct_n1 + 0.05,
      `V10${at} TX-2 load ${ld2} % is not 2 x ${E.hv_tx_load_pct_normal} % within the engine N-1 ${E.hv_tx_load_pct_n1} %`);
    ok(num(s.vals['fa1-cb:kw']) > 0, `V10${at} hall A feeder still 0 kW after the tie closed`);
    const bal2 = await pg.evaluate(() => window.RZEpmsPage.balance());
    const bad2 = Object.entries(bal2).filter(([, b]) => Math.abs(b.net) > 0.005 * Math.max(b.into, 1));
    ok(!bad2.length, `V10${at} bus balance off after the transfer at ${bad2.slice(0, 3).map(([id]) => id).join(', ')}`);
    await shot(pg, 'epms-sld-tie-closed-1440.png', 'i1-ct');
  }

  /* V11 TCC from the feeder relay */
  let e = await act(pg, 'fa1-r', 'tcc'); ok(!e, `V11${at} ${e}`);
  const t = await pg.evaluate(() => {
    const m = document.querySelector('.tcc-modal:not([hidden])'); if (!m) return null;
    const curves = [...m.querySelectorAll('path[data-tcc-curve]')].filter((p) => !/^(damage)$/.test(p.getAttribute('data-tcc-curve')));
    return { curves: curves.length, drawn: curves.filter((p) => (p.getAttribute('d') || '').length > 20).length,
      em: curves.filter((p) => p.classList.contains('is-em')).map((p) => p.getAttribute('data-tcc-curve')),
      dashes: [...new Set(curves.map((p) => p.style.strokeDasharray))].length,
      damage: m.querySelectorAll('path[data-tcc-curve="damage"]').length && (m.querySelector('path[data-tcc-curve="damage"]').getAttribute('d') || '').length > 20,
      inrush: m.querySelectorAll('[data-tcc-curve="inrush"] circle').length, markers: m.querySelectorAll('[data-tcc-marker]').length,
      legend: m.querySelectorAll('.tcc-legend li').length, rows: [...m.querySelectorAll('td[data-tcc-margin]')].map((td) => td.getAttribute('data-tcc-margin')),
      focusIn: m.contains(document.activeElement), over: document.documentElement.scrollWidth > innerWidth + 1,
      panelOver: (() => { const p = m.querySelector('.tcc-panel'); return p.scrollWidth > p.clientWidth + 1; })(),
      legendBelow: m.querySelector('.tcc-legend').getBoundingClientRect().top >= m.querySelector('.tcc-plot').getBoundingClientRect().bottom - 1 };
  });
  ok(!!t, `V11${at} the TCC modal did not open from R-FA1`);
  if (t) {
    ok(t.curves === 4 && t.drawn === 4, `V11${at} ${t.curves} device curves (${t.drawn} drawn), expected 4`);
    ok(t.em.length === 1 && t.em[0] === 'feeder', `V11${at} emphasised curve ${JSON.stringify(t.em)}, expected the feeder`);
    ok(t.dashes === 4, `V11${at} device curves share a dash pattern (${t.dashes} distinct)`);
    ok(t.damage && t.inrush === 1 && t.markers === 2, `V11${at} damage ${t.damage}, inrush ${t.inrush}, markers ${t.markers}`);
    ok(t.legend >= 8 && t.legendBelow, `V11${at} legend ${t.legend} items, below the plot ${t.legendBelow}`);
    const E2 = await pg.evaluate(() => window.CONV_CALC.snapshot.electrical.pro_grading_margin_s);
    ok(t.rows.length >= 6 && t.rows.every((m) => m === 'inf' || Number(m) >= E2 - 1e-9), `V11${at} coordination margins ${t.rows.join(', ')} (need >= ${E2})`);
    const clip = await pg.evaluate(() => {
      const m = document.querySelector('.tcc-modal:not([hidden])'), svg = m.querySelector('svg.tcc-plot');
      const [ML, pw, I0, I1] = svg.getAttribute('data-tcc-axis').split(',').map(Number);
      const out = {};
      m.querySelectorAll('path.tcc-curve[data-tcc-curve]').forEach((p) => {
        const xs = (p.getAttribute('d').match(/[ML]\s*(-?[\d.]+)/g) || []).map((t) => Number(t.slice(1)));
        const x = Math.max(...xs);
        out[p.getAttribute('data-tcc-curve')] = I0 * Math.pow(I1 / I0, (x - ML) / pw);
      });
      return { maxI: out, ends: m.querySelectorAll('[data-tcc-end]').length,
        legend: [...m.querySelectorAll('.tcc-legend li')].filter((li) => /drawn to its maximum fault current/.test(li.textContent)).length };
    });
    const LIM = { lsig: E.dist_tx_through_fault_mv_a, feeder: E.mv_fault_level_ka * 1000, incomer: E.mv_fault_level_ka * 1000, hv: E.mv_fault_level_ka * 1000 };
    for (const [id, lim] of Object.entries(LIM)) {
      ok(clip.maxI[id] <= lim * 1.001, `V13${at} ${id} curve drawn to ${Math.round(clip.maxI[id])} A at 20 kV, past its maximum fault ${Math.round(lim)} A`);
    }
    ok(clip.ends === 4 && clip.legend === 4, `V13${at} ${clip.ends} end marks, ${clip.legend} legend lines naming the clip (want 4 / 4)`);
    ok(t.focusIn, `V11${at} focus did not move into the modal`);
    ok(!t.over && !t.panelOver, `V11${at} the TCC modal scrolls the page or its panel sideways`);
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `epms-tcc-${W}.png`) });
    await pg.keyboard.press('Escape'); await sleep(200);
    const back = await pg.evaluate(() => ({ closed: !document.querySelector('.tcc-modal:not([hidden])'),
      focus: document.activeElement && (document.activeElement.getAttribute('data-rz-action') || document.activeElement.getAttribute('data-rz-cvm-act')) }));   /* inspector or (v3.93.0) modal action row */
    ok(back.closed, `V11${at} Esc did not close the TCC modal`);
    ok(back.focus === 'tcc', `V11${at} focus returned to "${back.focus}", not the Time–current curves button`);
  }

  /* V12 */
  s = await snap(pg);
  ok(!s.over, `V12${at} the page scrolls sideways`);
  if (W === 390) { await shot(pg, 'epms-sld-390.png', null); await shot(pg, 'epms-sld-390-mv.png', 'fa1-cb'); }
  ok(!errs.length, `V12${at} page errors: ${errs.slice(0, 2).join(' | ').slice(0, 200)}`);
  console.log(`EPMS_Telemetry@${W}: checked`);
  await pg.close();
}
await browser.close(); srv.close();
if (fails.length) { console.log(fails.slice(0, 40).join('\n')); console.log(`\nCONV EPMS SLD — FAIL (${fails.length} of ${checks} checks)`); process.exit(1); }
console.log(`\nCONV EPMS SLD — PASS (${checks} checks: default view, 150 kV tags, ANSI names, engine labels, normal flow, bus balance, interlocks, section loss + tie transfer, TCC modal + fault-limit clip, HV/MV vs LV chrome, 390 px)`);
