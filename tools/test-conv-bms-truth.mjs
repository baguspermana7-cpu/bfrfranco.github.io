#!/usr/bin/env node
/**
 * test-conv-bms-truth.mjs — on the Conventional HMI sheets (WT-M-101 water, FU-M-101 fuel, CH-M-101 chiller), flow, values and data
 * quality follow evidence, and pump command and feedback stay apart (PRD-CONV-BMS-UIUX laws B1, B2, B3, B6). Each
 * page is driven ONLY through the simulation seam window.RZConvSim (js/conv/sheet-truth.js), installed in simulated
 * data mode; nothing here writes the page's internals.
 *
 *   S0   RZConvSim exists; points() gives >= 3 flow points (cfg.minPoints where a page has fewer meters), each mapped by edgesOf() to >= 1 drawn data-edge
 *   B1a  point {value 12.3, good}  -> every mapped edge data-flow="running" and its flow overlay animates
 *   B1b  point {value 0, good}     -> mapped edges "stopped"; the value prints 0 and its unit, not an em dash
 *   B1c  point {value 12.3, stale} -> mapped edges "unavailable", value says STALE, no running overlay animation
 *   B1d  quality bad -> BAD, nodata -> NO DATA; neither prints a number
 *   B3   with an asset tripped into alarm, one unrelated point stale changes only that point's edges; the tripped
 *        node keeps data-alarm; restoring {good, 5} returns its edges to running
 *   B6   prefers-reduced-motion: reduce -> no element of the sheet svg has a running animation; running edges keep
 *        static arrows, stopped/unavailable edges carry none
 *   fuel only (pages with pumps):
 *   B2a  P-101 cmd on + fb off, transfer flow {0, good} -> CMD ON and STOP as two values, transfer edges not running,
 *        no P-101 FAIL at once; after the page's own 10 s rule (driven by RZConvSim.tick) the P-101 node carries
 *        data-alarm and the alarm list holds P-101 FAIL
 *   B2b  cmd on + fb on + flow {150, good} -> CMD ON and RUN, transfer edges running, no P-101 FAIL, no mismatch mark
 *   B2c  cmd off + fb on -> CMD OFF and RUN readable, the node carries data-mismatch="1", its branch does not run
 *   chiller (CH-M-101, CHWP-01A on train 1; no fail-to-run timer on this page, so B2a asks for the mark at once):
 *   B2a  cmd on + fb off, branch flow {0, good} -> CMD ON and STOP, branch not running, pump node data-alarm
 *   B1e  a train branch {0, good} renders stopped and raises NO disconnect alarm (no data-alarm, not 'fault');
 *        the forced-disconnect fault (#faultSel + #faultBtn) does, and so do quality bad and nodata
 *   + no page errors
 *
 * Usage: node tools/test-conv-bms-truth.mjs [--page=fuel-system.html]   (exit 1 on any FAIL)
 */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGES = [
  { page: 'water-system.html', host: '#water-sheet-host', trips: ['rawtank', 'filter', 'domtank'], inspect: 'rawtank' },
  { page: 'fuel-system.html', host: '#fuel-sheet-host', trips: ['ld101', 'ld201'],
    pump: 'p101', transferPoint: 'ft101:q', failTag: 'P-101 FAIL', failTicks: 10, inspect: 'p101' },
  { page: 'chiller-plant.html', host: '#chw-sheet-host', trips: ['ch4', 'ch3'],
    pump: 'pa1', transferPoint: 'ch1:q', disconnect: { point: 'ch1:q', node: 'ch1', train: 1 } },
  /* fire has two flow meters (FE-01 header, FT-MU make-up); no third point is invented to reach the default 3 */
  { page: 'fire-system.html', host: '#fire-sheet-host', trips: ['tank'], minPoints: 2,
    pump: 'fp1', transferPoint: 'fe:q', inspect: 'fp1' }
];
const only = (process.argv.find((a) => a.startsWith('--page=')) || '').split('=')[1];
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

let fail = 0;
function law(name, ok, detail) { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); }

async function open(cfg, reduce) {
  const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: 1440, height: 1000 });
  if (reduce) await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + cfg.page, { waitUntil: 'networkidle0', timeout: 90000 });
  await enterAuthorizedAuditState(pg, cfg.page.replace('.html', ''));
  await pg.waitForFunction((h) => { const s = document.querySelector(h + ' svg'); return s && s.getBoundingClientRect().width > 0; }, { timeout: 20000 }, cfg.host).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));
  return { pg, errs };
}

/* In-page probes. Every one reads the drawn svg; the seam is only used to set state and to list ids. */
const hasSim = (pg) => pg.evaluate(() => !!(window.RZConvSim && typeof window.RZConvSim.points === 'function'));
const setPoint = (pg, id, rec) => pg.evaluate((i, r) => { window.RZConvSim.setPoint(i, r); }, id, rec);
function edgeStateOf(host, list) {
  const svg = document.querySelector(host + ' svg');
  const out = {};
  list.forEach((e) => {
    const p = svg.querySelector('path.hmi-edge[data-edge="' + e + '"]');
    const f = svg.querySelector('.hmi-flow[data-edge-flow="' + e + '"]');
    let anim = 'none';
    if (f) { const cs = getComputedStyle(f); anim = cs.display === 'none' ? 'none' : cs.animationName; }
    out[e] = { flow: p ? p.getAttribute('data-flow') : null, anim };
  });
  return out;
}

async function runPage(cfg) {
  const H = cfg.host;
  console.log(`\n── ${cfg.page}`);
  const edges = async (pg, id) => pg.evaluate(edgeStateOf, H, await pg.evaluate((i) => window.RZConvSim.edgesOf(i), id));
  const valueText = (pg, id) => pg.evaluate((h, i) => {
    const t = document.querySelector(h + ' svg [data-val="' + i + '"]'); return t ? t.textContent : null; }, H, id);
  const unitOf = (pg, id) => pg.evaluate((i) => { const s = window.RZConvSim.snapshot(); return s.points[i] && s.points[i].unit; }, id);
  const allFlows = (pg) => pg.evaluate((h) => { const o = {};
    document.querySelectorAll(h + ' svg path.hmi-edge[data-edge]:not(.hmi-flow)').forEach((p) => { o[p.getAttribute('data-edge')] = p.getAttribute('data-flow'); });
    return o; }, H);
  const nodeAttr = (pg, n, a) => pg.evaluate((h, nn, aa) => { const g = document.querySelector(h + ' svg .hmi-node[data-node="' + nn + '"]'); return g ? g.getAttribute(aa) : null; }, H, n, a);

  /* ── main page: S0, B1, B3 ─────────────────────────────────────────────────────────────────── */
  {
    const { pg, errs } = await open(cfg, false);
    const sim = await hasSim(pg);
    let points = [];
    if (sim) {
      const s0 = await pg.evaluate((h) => {
        const svg = document.querySelector(h + ' svg');
        return window.RZConvSim.points().map((id) => {
          const es = window.RZConvSim.edgesOf(id) || [];
          return { id, edges: es.length, drawn: es.filter((e) => svg.querySelector('[data-edge="' + e + '"]')).length };
        });
      }, H);
      points = s0.map((p) => p.id);
      const bad = s0.filter((p) => p.edges < 1 || p.drawn !== p.edges);
      law('S0 seam + point map', s0.length >= (cfg.minPoints || 3) && bad.length === 0,
        s0.length + ' points: ' + s0.map((p) => p.id + '→' + p.drawn + '/' + p.edges).join(', '));
    } else {
      law('S0 seam + point map', false, 'window.RZConvSim missing');
    }

    if (!sim || !points.length) {
      ['B1a', 'B1b', 'B1c', 'B1d', 'B3', 'B4'].forEach((k) => law(k, false, 'no seam to drive'));
    } else {
      const P = points[0], unit = await unitOf(pg, P);
      // B1a
      await setPoint(pg, P, { value: 12.3, quality: 'good' });
      let es = await edges(pg, P);
      let bad = Object.entries(es).filter(([, v]) => v.flow !== 'running' || v.anim === 'none');
      law('B1a good 12.3 -> running + animated', bad.length === 0, P + ' ' + Object.keys(es).length + ' edges' + (bad.length ? '; off: ' + bad.map(([k, v]) => k + '=' + v.flow + '/' + v.anim).join(',') : ''));
      // B1b
      await setPoint(pg, P, { value: 0, quality: 'good' });
      es = await edges(pg, P); let tx = await valueText(pg, P);
      bad = Object.entries(es).filter(([, v]) => v.flow !== 'stopped' || v.anim !== 'none');
      law('B1b good 0 -> stopped, value prints 0 + unit', bad.length === 0 && tx != null && /\b0(\.0+)?\b/.test(tx) && !!unit && tx.includes(unit) && !tx.includes('—'),
        'text "' + tx + '"' + (bad.length ? '; off: ' + bad.map(([k, v]) => k + '=' + v.flow + '/' + v.anim).join(',') : ''));
      // B1c
      await setPoint(pg, P, { value: 12.3, quality: 'stale' });
      es = await edges(pg, P); tx = await valueText(pg, P);
      bad = Object.entries(es).filter(([, v]) => v.flow !== 'unavailable' || v.anim !== 'none');
      law('B1c stale -> unavailable, STALE, no motion', bad.length === 0 && tx != null && tx.includes('STALE'),
        'text "' + tx + '"' + (bad.length ? '; off: ' + bad.map(([k, v]) => k + '=' + v.flow + '/' + v.anim).join(',') : ''));
      // B1d
      await setPoint(pg, P, { value: 12.3, quality: 'bad' });
      const tb = await valueText(pg, P), eb = await edges(pg, P);
      await setPoint(pg, P, { value: 12.3, quality: 'nodata' });
      const tn = await valueText(pg, P), en = await edges(pg, P);
      const offB = Object.values(eb).concat(Object.values(en)).filter((v) => v.flow !== 'unavailable').length;
      law('B1d bad -> BAD, nodata -> NO DATA, no number', tb != null && tb.includes('BAD') && !/\d/.test(tb) && tn != null && tn.includes('NO DATA') && !/\d/.test(tn) && offB === 0,
        'bad "' + tb + '", nodata "' + tn + '", non-unavailable edges ' + offB);
      await setPoint(pg, P, { value: 12.3, quality: 'good' });

      // B3 — trip an asset the page already alarms on, stale one unrelated point
      const trip = await pg.evaluate((nodes) => {
        for (const n of nodes) { try { if (window.RZConvSim.trip(n) !== false) return n; } catch (e) { /* next */ } }
        return null;
      }, cfg.trips);
      const Q = points.find((p) => p !== P) || P;
      /* let the plant answer the trip first (a lag pump starting is the trip's consequence, not the stale point's) */
      await pg.evaluate(() => { try { if (typeof window.RZConvSim.tick === 'function') window.RZConvSim.tick(12); } catch (e) { /* no tick on this page */ } });
      const before = await allFlows(pg);
      const alarmBefore = trip ? await nodeAttr(pg, trip, 'data-alarm') : null;
      await setPoint(pg, Q, { value: 7, quality: 'stale' });
      const after = await allFlows(pg);
      const qEdges = await pg.evaluate((i) => window.RZConvSim.edgesOf(i), Q);
      const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
      const foreign = changed.filter((k) => !qEdges.includes(k));
      const qNotUnav = qEdges.filter((k) => after[k] !== 'unavailable');
      const alarmAfter = trip ? await nodeAttr(pg, trip, 'data-alarm') : null;
      await setPoint(pg, Q, { value: 5, quality: 'good' });
      const restored = await pg.evaluate((h, i) => window.RZConvSim.edgesOf(i).filter((e) => document.querySelector(h + ' svg path.hmi-edge[data-edge="' + e + '"]').getAttribute('data-flow') !== 'running').length, H, Q);
      const qText = await valueText(pg, Q);
      law('B3 one point stale, alarm stays, restore runs', !!trip && !!alarmBefore && !!alarmAfter && foreign.length === 0 && qNotUnav.length === 0 && restored === 0 && /5/.test(qText || ''),
        'tripped ' + trip + ' data-alarm ' + alarmBefore + '→' + alarmAfter + '; stale ' + Q + ' changed ' + changed.length + ' edges, foreign ' + foreign.length
        + (foreign.length ? ' (' + foreign.join(',') + ')' : '') + '; restored non-running ' + restored + ', text "' + qText + '"');
      /* B4 — alarm, acknowledged, selected without colour: a drawn shape + word, never hue alone */
      const mk = (n) => pg.evaluate((h, id) => {
        const m = document.querySelector(h + ' .cv-mark[data-for="' + id + '"]');
        const g = document.querySelector(h + ' .hmi-node[data-node="' + id + '"]');
        return { mark: !!(m && m.querySelector('.cv-mark-tri')), ack: m ? m.getAttribute('data-ack') : null,
          word: m ? (m.querySelector('.cv-mark-txt') || {}).textContent : null, alarm: g ? g.getAttribute('data-alarm') : null,
          anim: m ? m.getAnimations({ subtree: true }).length : 0 };
      }, H, n);
      const m0 = trip ? await mk(trip) : null;
      if (trip) await pg.evaluate((n) => window.RZConvSim.ack(n), trip);
      const m1 = trip ? await mk(trip) : null;
      const sel = await pg.evaluate((h, n) => {
        const g = document.querySelector(h + ' .hmi-node[data-node="' + n + '"]'); if (!g) return null;
        g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const b = g.querySelector('.b'); const da = b ? getComputedStyle(b).strokeDasharray : 'none';
        const other = document.querySelector(h + ' .hmi-node:not(.is-selected) .b');
        return { selected: g.classList.contains('is-selected'), dash: da, otherDash: other ? getComputedStyle(other).strokeDasharray : 'none' };
      }, H, trip || cfg.inspect);
      await pg.keyboard.press('Escape');
      law('B4 alarm, acknowledged and selected readable without colour',
        !!m0 && m0.mark && m0.ack === '0' && m0.word === '!' && !!m1 && m1.mark && m1.ack === '1' && m1.word === 'ACK' && !!m1.alarm && m1.anim === 0
          && !!sel && sel.selected && sel.dash !== 'none' && sel.otherDash === 'none',
        'alarm mark ' + (m0 && m0.mark) + ' "' + (m0 && m0.word) + '" → after ack "' + (m1 && m1.word) + '" (data-ack ' + (m1 && m1.ack) + ', node alarm still ' + (m1 && m1.alarm)
        + ', animations ' + (m1 && m1.anim) + '); selected dash "' + (sel && sel.dash) + '" vs unselected "' + (sel && sel.otherDash) + '"');
      await pg.evaluate((n) => { if (n) window.RZConvSim.clearTrip(n); }, trip);
    }
    /* ── B1e (chiller only): a valid zero is not a disconnect ─────────────────────────────────── */
    if (cfg.disconnect && sim && points.length) {
      const dp = cfg.disconnect;
      /* start clean: clear any forced disconnect from a prior run */
      await pg.evaluate(() => { const btn = document.getElementById('clearBtn'); if (btn) btn.click(); });
      await setPoint(pg, dp.point, { value: 0, quality: 'good' });
      const zState = await nodeAttr(pg, dp.node, 'data-state');
      const zAlarm = await nodeAttr(pg, dp.node, 'data-alarm');
      const listBefore = await pg.evaluate(() => { const l = document.getElementById('alarm-list'); return l ? l.textContent.slice(0, 120) : ''; });
      law('B1e good 0 -> stopped, no disconnect alarm', zState === 'stopped' && !zAlarm,
        dp.node + ' data-state "' + zState + '", data-alarm "' + zAlarm + '"; alarm-list: ' + JSON.stringify(listBefore));
      /* faultBtn forces a disconnect on the same train: now data-alarm must appear */
      await pg.evaluate((train) => { const sel = document.getElementById('faultSel'); sel.value = String(train); const btn = document.getElementById('faultBtn'); if (btn) btn.click(); }, dp.train);
      const fAlarm = await nodeAttr(pg, dp.node, 'data-alarm');
      const listAfter = await pg.evaluate(() => { const l = document.getElementById('alarm-list'); return l ? l.textContent.slice(0, 120) : ''; });
      law('B1e forced disconnect -> alarm', !!fAlarm,
        dp.node + ' data-alarm "' + fAlarm + '" (was "' + zAlarm + '"); alarm-list before: ' + JSON.stringify(listBefore) + '; after: ' + JSON.stringify(listAfter));
      await pg.evaluate(() => { const btn = document.getElementById('clearBtn'); if (btn) btn.click(); });
      await setPoint(pg, dp.point, { value: 12.3, quality: 'bad' });
      const bAlarm = await nodeAttr(pg, dp.node, 'data-alarm');
      law('B1e quality bad -> alarm', !!bAlarm, dp.node + ' data-alarm "' + bAlarm + '"');
      await setPoint(pg, dp.point, { value: 12.3, quality: 'good' });
    }
    law('page errors (main)', errs.length === 0, errs.length ? errs[0].slice(0, 160) : '0');
    await pg.close();
  }

  /* ── pump command / feedback: B2 (pages with a transfer pump) ──────────────────────────────── */
  if (cfg.pump) {
    const { pg, errs } = await open(cfg, false);
    const can = await pg.evaluate(() => !!(window.RZConvSim && typeof window.RZConvSim.setPump === 'function' && typeof window.RZConvSim.tick === 'function'));
    if (!can) {
      ['B2a', 'B2b', 'B2c'].forEach((k) => law(k, false, 'RZConvSim.setPump / tick missing'));
    } else {
      const N = cfg.pump, TP = cfg.transferPoint;
      const drive = (pump, rec, ticks) => pg.evaluate((n, pm, pr, t) => {
        if (pm) window.RZConvSim.setPump(n, pm);
        if (pr) window.RZConvSim.setPoint(pr.id, pr.rec);
        if (t) window.RZConvSim.tick(t);
      }, N, pump, rec, ticks);
      const look = () => pg.evaluate((h, n, tp, tag) => {
        const svg = document.querySelector(h + ' svg');
        const vals = [...svg.querySelectorAll('[data-val^="' + n + ':"]')].map((t) => t.textContent.trim());
        const g = svg.querySelector('.hmi-node[data-node="' + n + '"]');
        const snap = window.RZConvSim.snapshot();
        const transfer = window.RZConvSim.edgesOf(tp).concat((snap.pumps && snap.pumps[n] && snap.pumps[n].edges) || []);
        const branch = (snap.pumps && snap.pumps[n] && snap.pumps[n].edges) || [];
        const flowOf = (e) => { const p = svg.querySelector('path.hmi-edge[data-edge="' + e + '"]'); return p ? p.getAttribute('data-flow') : null; };
        const list = document.getElementById('alarm-list');
        return { vals, alarm: g ? g.getAttribute('data-alarm') : null, mismatch: g ? g.getAttribute('data-mismatch') : null,
          transferRunning: transfer.filter((e) => flowOf(e) === 'running'), transferAll: transfer.map((e) => e + '=' + flowOf(e)),
          branchRunning: branch.filter((e) => flowOf(e) === 'running'), nBranch: branch.length,
          failListed: !!(tag && list && list.textContent.indexOf(tag) >= 0) };
      }, H, N, TP, cfg.failTag);
      const has = (vals, word) => vals.some((v) => v === word || v.split(/\s*·\s*/).includes(word));

      // B2a
      await drive({ cmd: 'on', fb: 'off' }, { id: TP, rec: { value: 0, quality: 'good' } }, 1);
      const a0 = await look();
      if (cfg.failTag) {
        await drive(null, null, cfg.failTicks);
        const a1 = await look();
        law('B2a cmd on, fb off, flow 0 -> CMD ON + STOP, no flow, ' + cfg.failTag + ' after the 10 s rule',
          has(a1.vals, 'CMD ON') && has(a1.vals, 'STOP') && a1.vals.length >= 2 && a1.transferRunning.length === 0 && !a0.failListed && a1.failListed && !!a1.alarm,
          'values [' + a1.vals.join(' | ') + ']; transfer running ' + a1.transferRunning.length + '/' + a1.transferAll.length
          + '; ' + cfg.failTag + ' after 1 tick ' + a0.failListed + ', after ' + (1 + cfg.failTicks) + ' ticks ' + a1.failListed + '; node data-alarm ' + a1.alarm);
      } else {
        law('B2a cmd on, fb off, flow 0 -> CMD ON + STOP, branch still, node data-alarm',
          has(a0.vals, 'CMD ON') && has(a0.vals, 'STOP') && a0.vals.length >= 2 && a0.transferRunning.length === 0 && a0.nBranch > 0 && !!a0.alarm,
          'values [' + a0.vals.join(' | ') + ']; branch + train running ' + a0.transferRunning.length + '/' + a0.transferAll.length + '; node data-alarm ' + a0.alarm);
      }
      // B2b
      await drive({ cmd: 'on', fb: 'on' }, { id: TP, rec: { value: 150, quality: 'good' } }, 1);
      const b = await look();
      law('B2b cmd on, fb on, flow 150 -> CMD ON + RUN, transfer runs, no ' + (cfg.failTag || 'mismatch'),
        has(b.vals, 'CMD ON') && has(b.vals, 'RUN') && b.transferRunning.length === b.transferAll.length && b.transferAll.length > 0 && !b.failListed && !b.mismatch,
        'values [' + b.vals.join(' | ') + ']; transfer running ' + b.transferRunning.length + '/' + b.transferAll.length
        + (cfg.failTag ? '; ' + cfg.failTag + ' listed ' + b.failListed : '') + '; data-mismatch ' + b.mismatch);
      // B2c
      await drive({ cmd: 'off', fb: 'on' }, null, 1);
      const c = await look();
      law('B2c cmd off, fb on -> CMD OFF + RUN, non-colour mismatch mark, branch still',
        has(c.vals, 'CMD OFF') && has(c.vals, 'RUN') && c.mismatch === '1' && c.nBranch > 0 && c.branchRunning.length === 0,
        'values [' + c.vals.join(' | ') + ']; data-mismatch ' + c.mismatch + '; branch running ' + c.branchRunning.length + '/' + c.nBranch);
    }
    law('page errors (pump)', errs.length === 0, errs.length ? errs[0].slice(0, 160) : '0');
    await pg.close();
  }

  /* ── B5: every asset opens; closing keeps selection, focus, pan and zoom ─────────────────────── */
  if (cfg.inspect) {
    const { pg, errs } = await open(cfg, false);
    const N = cfg.inspect;
    await pg.evaluate((h) => { const b = document.querySelector(h + ' .hmi-btn[data-z="in"]'); if (b) { b.click(); b.click(); } }, H);
    const vb0 = await pg.evaluate((h) => document.querySelector(h + ' svg.hmi-svg').getAttribute('viewBox'), H);
    await pg.evaluate((h, n) => { const g = document.querySelector(h + ' .hmi-node[data-node="' + n + '"]'); g.focus(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, H, N);
    await new Promise((r) => setTimeout(r, 500));
    const opened = await pg.evaluate(() => { const a = document.querySelector('.rz-inspector.open'); return a ? a.textContent.replace(/\s+/g, ' ').slice(0, 400) : null; });
    const tag = await pg.evaluate((h, n) => { const t = document.querySelector(h + ' [data-tag-of="' + n + '"]'); return t ? t.textContent.trim() : n; }, H, N);
    await pg.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 400));
    const after = await pg.evaluate((h, n) => {
      const g = document.querySelector(h + ' .hmi-node[data-node="' + n + '"]');
      return { closed: !document.querySelector('.rz-inspector.open'), focus: !!(g && (document.activeElement === g || g.contains(document.activeElement))),
        selected: !!(g && g.classList.contains('is-selected')), vb: document.querySelector(h + ' svg.hmi-svg').getAttribute('viewBox') };
    }, H, N);
    law('B5 asset opens its detail; close keeps focus, selection, pan and zoom',
      !!opened && opened.indexOf(tag) >= 0 && /measured|stale|no data|bad|simulated|state/i.test(opened) && after.closed && after.focus && after.selected && after.vb === vb0,
      'inspector ' + (opened ? '"' + opened.slice(0, 70) + '…"' : 'did not open') + ' (tag ' + tag + '); closed ' + after.closed + ', focus back ' + after.focus
      + ', selected ' + after.selected + ', viewBox kept ' + (after.vb === vb0) + ' (' + vb0 + ')');
    law('page errors (inspect)', errs.length === 0, errs.length ? errs[0].slice(0, 160) : '0');
    await pg.close();
  }

  /* ── reduced motion: B6 ────────────────────────────────────────────────────────────────────── */
  {
    const { pg, errs } = await open(cfg, true);
    if (!(await hasSim(pg))) {
      law('B6 reduced motion keeps meaning', false, 'window.RZConvSim missing');
    } else {
      const pts = await pg.evaluate(() => window.RZConvSim.points());
      /* one point flowing (an idle plant — fire at stage 0 — has no running process pipe to read arrows on), one at
         a valid zero, one stale */
      await setPoint(pg, pts[0], { value: 12.3, quality: 'good' });
      if (pts.length >= 2) await setPoint(pg, pts[1], { value: 0, quality: 'good' });
      if (pts.length >= 3) await setPoint(pg, pts[2], { value: 3, quality: 'stale' });
      const r = await pg.evaluate((h) => {
        const svg = document.querySelector(h + ' svg');
        const animated = [...svg.querySelectorAll('*')].filter((el) => el.getAnimations && el.getAnimations().length > 0);
        let runArrows = 0, stillArrows = [], run = 0, still = 0;
        svg.querySelectorAll('path.hmi-edge[data-edge]:not(.hmi-flow)').forEach((p) => {
          const id = p.getAttribute('data-edge'), f = p.getAttribute('data-flow');
          const g = svg.querySelector('[data-edge-arrows="' + id + '"]');
          const n = g && getComputedStyle(g).display !== 'none' ? [...g.querySelectorAll('.hmi-arrow')].filter((a) => getComputedStyle(a).display !== 'none').length : 0;
          if (f === 'running') { run++; runArrows += n; } else { still++; if (n > 0) stillArrows.push(id + '=' + f); }
        });
        return { animated: animated.map((e) => e.getAttribute('class') || e.tagName).slice(0, 4), nAnim: animated.length, run, still, runArrows, stillArrows };
      }, H);
      law('B6 reduced motion keeps meaning', r.nAnim === 0 && r.run > 0 && r.runArrows > 0 && r.still > 0 && r.stillArrows.length === 0,
        'animated ' + r.nAnim + (r.nAnim ? ' (' + r.animated.join(',') + ')' : '') + '; running edges ' + r.run + ' with ' + r.runArrows + ' arrows; still edges ' + r.still
        + ' with arrows ' + r.stillArrows.length + (r.stillArrows.length ? ' (' + r.stillArrows.slice(0, 4).join(',') + ')' : ''));
    }
    law('page errors (reduced motion)', errs.length === 0, errs.length ? errs[0].slice(0, 160) : '0');
    await pg.close();
  }
}

for (const cfg of PAGES) { if (!only || only === cfg.page) await runPage(cfg); }

await browser.close(); srv.close();
console.log(fail ? `\nCONV BMS TRUTH — ${fail} failing check(s)` : '\nCONV BMS TRUTH — PASS');
process.exit(fail ? 1 : 0);
