#!/usr/bin/env node
/* test-dcai-hall-views.mjs — STRICT. PRD-DCAI-HALL-DEPTH Amendment 1 (owner 2026-11-23: "button flat 2d belum ada …
   default ia 2d"): the Data Hall tab of datahallAI.html, signed in, real browser, 1440 x 900 and 390 x 844, dark.
   Phase A0 writes every law that can be measured on today's page; the rest arrive with their phase (named below).
   HV-V1  one view switch of three buttons 2D · 3D · Drawing (in that order), each a <button aria-pressed>
   HV-V2  nothing stored -> 2D at 1440 and at 390; the old key rz.dcai.proj is gone after load
   HV-F1  the floor is on the first screen and whole: stage top <= 200 px (1440) / <= 260 px (390) below the module
          tab bar (#tabs) and every unit
          (rack, fan-wall module, CDU: [data-rz-equipment] in #hIso) lies inside the stage rect
   HV-F2  no two visible floor labels overlap (box intersection > 1 px²)
   HV-L1  a lens bar Status / Thermal / Cooling / Power / Layout ([data-lens]) and a visible legend for the lens
   HV-P1  Cooling lens: every fan-wall module and CDU shows a [data-point] value with a unit on the floor
   HV-S0  standby units carry data-lamp="stby" — as many as the engine's standby (installed - duty, from the
          page's own header: "90 fan-wall modules (89 duty + 1)", "55 CDU (54 duty + 1)")
   HV-D1  two loads of the same state draw the same floor text; no Math.random in the view code (green on the A0
          tree: the 3D floor already shows no sensor noise; the KPI-strip part (GPU % 88 vs 92) joins in A3)
   HV-A1  "Show as table" lists every unit of the floor (racks + modules + CDUs) with its state, and each fan-wall module and
          CDU row prints the engine's operating point (A3: fan %, m³/h, load %, pump %; standby rows 0, as many as the engine's)
   HV-V3  a switch 2D -> 3D -> Drawing -> 2D keeps the selected rack and the paint mode; RZHallIso.update runs 0 times
   HV-T1  3D tones: slab/body contrast >= 1.25 and body/top >= 1.1 in both themes (computed fills).
   HV-G1  2D floor to scale: slab, rack tops, row faces, galleries and CDU line at the engine's metres.
   HV-G2  one placement: every fan-wall module and CDU body on the floor = its Drawing-view body (±0.05 m).
   HV-M1  2D rotors: one per fan-wall module and CDU, period = T_ref / engine speed (fan 1.0 s, pump 0.8 s), standby still.
   HV-M2  reduced motion, the Drawing view and another cockpit tab leave 0 running rotor animations.
   HV-S1  each cooling scenario changes exactly the units its HMI payloads name (A5a, Amendment 3); rotors keep their period.
   HV-I1  alarmed units carry flags (<= 8 + "+n"), each naming its point, inside the stage, clear of heads and each other.
   HV-M3  air paths show and move only in the Thermal and Cooling lenses (Amendment 3 D6).
   HV-I2  the status strips move by exactly the scenario's payload alarms (critical -> Critical, else -> Warning) (A5b).
   HV-I3  the Alarms workspace journals each payload alarm active, then returned when the scenario clears it (A5b).
   HV-U1  every row-pair foot ends in its unit and equals racks per pair x rack kW (Amendment 3 D7).
   Later phases add: HV-P2.
   Usage: node tools/test-dcai-hall-views.mjs [--shots=<dir>] [--only=V1,F1] */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { isSupabaseModule, signedInStorage, signedInSupabaseBody } from './lib/signed-in-supabase.mjs';
import { enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = (process.argv.find((a) => a.startsWith('--shots=')) || '').split('=')[1];
const ONLY = new Set(((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean).map((s) => 'HV-' + s.replace(/^HV-/, '')));
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const fails = []; let checks = 0;
const ok = (id, c, m) => { if (ONLY.size && !ONLY.has(id)) return; checks++; if (!c) fails.push(id + ' ' + m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(width) {
  const pg = await browser.newPage();
  pg.errors = []; pg.on('pageerror', (e) => pg.errors.push(e.message));
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: signedInSupabaseBody({ email: 'educator@resistancezero.com', tier: 'pro', educator: true }) });
    return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort();
  });
  const phone = width < 500;
  await pg.setViewport({ width, height: phone ? 844 : 900, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await pg.evaluateOnNewDocument((entries) => {
    try {
      if (sessionStorage.getItem('__dcaiViewsSeeded')) return;
      sessionStorage.setItem('__dcaiViewsSeeded', '1');
      localStorage.clear();
      localStorage.setItem('theme', 'dark'); localStorage.setItem('rz_cookie_consent', 'declined');
      entries.forEach(([k, v]) => localStorage.setItem(k, v));
      localStorage.setItem('rz.dcai.proj', 'iso');   /* a stored old-key value: V2 wants it ignored and removed */
    } catch (x) { /* no storage */ }
  }, signedInStorage({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator' }));
  await pg.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 90000 });
  await pg.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
  await wait(800);
  await enterAuthorizedAuditState(pg, 'dc-ai');
  await pg.evaluate(() => { const b = document.querySelector('#tabs [data-t="hall"]'); if (b) b.click(); });
  await wait(2500);
  return pg;
}

/* what the page shows: the switch, the floor stage, its units and labels */
const read = (pg) => pg.evaluate(() => {
  const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const panel = document.getElementById('p-hall');
  const group = [...panel.querySelectorAll('[role=group]')].find((g) => g.querySelectorAll('button[aria-pressed]').length >= 2);
  const btns = group ? [...group.querySelectorAll('button[aria-pressed]')].map((b) => ({ t: b.textContent.trim(), p: b.getAttribute('aria-pressed') })) : [];
  const btnsVisible = group ? [...group.querySelectorAll('button[aria-pressed]')].filter((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width > 0; }).length : 0;
  const root = document.querySelector('#hIso .fp-root');
  const stage = vis(root) ? box(root) : null, tabsB = document.getElementById('tabs').getBoundingClientRect().bottom;
  const units = vis(root) ? [...root.querySelectorAll('[data-rz-equipment]')].filter(vis).map(box) : [];
  /* nothing fixed or sticky lies over the floor: the topmost element at the stage's bottom corners and centre is the floor */
  const covered = stage ? [[stage.l + 4, stage.b - 3], [(stage.l + stage.r) / 2, stage.b - 3], [stage.r - 4, stage.b - 3]].filter(([x, y]) => y < innerHeight && !(root.contains(document.elementFromPoint(x, y)))).length : -1;
  const outside = stage ? units.filter((u) => u.l < stage.l - 1 || u.t < stage.t - 1 || u.r > stage.r + 1 || u.b > stage.b + 1).length : -1;
  const labels = vis(root) ? [...root.querySelectorAll('text, .fp-tag, [class*=tag]')].filter((e) => vis(e) && e.textContent.trim() && !e.closest('text:not(:scope)'))
    .map((e) => ({ s: e.textContent.trim().slice(0, 24), ...box(e) })).filter((b) => b.r - b.l > 0 && b.b - b.t > 0) : [];
  const over = [];
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const a = labels[i], b = labels[j], w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    if (w > 1 && h > 1 && w * h > 1) over.push(a.s + ' × ' + b.s);
  }
  const lenses = [...panel.querySelectorAll('[data-lens]')].map((b) => b.getAttribute('data-lens'));
  /* the legend is SEEN: its centre is the topmost element there (a clipped or covered legend is no legend) */
  const legend = vis(root) && [...document.querySelectorAll('#hIsoWrap [class*=legend]')].some((e) => {
    if (!vis(e)) return false; const b = e.getBoundingClientRect(); if (b.width < 20 || b.height < 8) return false;
    const t = document.elementFromPoint(b.left + Math.min(20, b.width / 2), b.top + b.height / 2); return !!t && e.contains(t);
  });
  const head = panel.textContent;
  const m1 = /(\d+)\s*fan-wall modules\s*\((\d+)\s*duty/.exec(head), m2 = /(\d+)\s*CDU\s*\((\d+)\s*duty/.exec(head);
  const stbyWant = m1 && m2 ? (m1[1] - m1[2]) + (m2[1] - m2[2]) : null;
  const stby = vis(root) ? root.querySelectorAll('[data-lamp="stby"]').length : 0;
  const plant = vis(root) ? [...root.querySelectorAll('[data-rz-equipment^="crah"], [data-rz-equipment^="cdu"]')] : [];
  const plantWithValue = plant.filter((u) => [...u.querySelectorAll('[data-point]')].some((p) => vis(p) && /\d\s*(%|kWth|kW|L\/min|°C|m³\/h)/.test(p.textContent))).length;
  const floorText = vis(root) ? [...root.querySelectorAll('text')].map((t) => t.textContent.trim()).filter(Boolean).join('|') : '';
  return { btns, btnsVisible, stage, tabsB, covered, units: units.length, outside, labels: labels.length, over, lenses, legend, stbyWant, stby, plant: plant.length, plantWithValue, floorText,
    oldKey: localStorage.getItem('rz.dcai.proj'), scrollW: document.documentElement.scrollWidth, vw: innerWidth, vh: innerHeight };
});

const LENSES = ['status', 'thermal', 'cooling', 'power', 'layout'];
for (const W of [1440, 390]) {
  const pg = await open(W);
  const s = await read(pg);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `hv-default-${W}.png`) });
  ok('HV-V1', s.btns.map((b) => b.t).join('·') === '2D·3D·Drawing', `${W}: view buttons ${JSON.stringify(s.btns.map((b) => b.t))}, want 2D · 3D · Drawing`);
  const on = s.btns.filter((b) => b.p === 'true').map((b) => b.t);
  ok('HV-V2', on.length === 1 && on[0] === '2D', `${W}: pressed on first load ${JSON.stringify(on)}, want 2D`);
  ok('HV-V2', s.oldKey == null, `${W}: old key rz.dcai.proj still stored (${s.oldKey})`);
  const topMax = W < 500 ? 260 : 200;
  ok('HV-F1', !!s.stage && s.stage.t - s.tabsB <= topMax, `${W}: floor stage top ${s.stage ? Math.round(s.stage.t - s.tabsB) : 'none'} px below the tab bar, want <= ${topMax}`);
  ok('HV-F1', !!s.stage && s.stage.b <= s.vh + 1, `${W}: floor stage bottom ${s.stage ? Math.round(s.stage.b) : 'none'} px, below the first screen (${s.vh})`);
  ok('HV-F1', s.covered === 0, `${W}: ${s.covered} of 3 points on the floor's bottom edge lie under another element`);
  ok('HV-V1', s.btnsVisible === 3, `${W}: ${s.btnsVisible} of 3 view buttons fully inside the viewport`);
  ok('HV-F1', !!s.stage && s.units >= 585 && s.outside === 0, `${W}: ${s.outside} of ${s.units} units outside the stage (want 0 of >= 585)`);
  ok('HV-F2', s.labels > 0 && s.over.length === 0, `${W}: ${s.over.length} label overlaps of ${s.labels}: ${s.over.slice(0, 3).join(' | ')}`);
  /* F2b: the row-pair heads are judged by their INK (a Range over the text), not their 20 px box: text overflowing its box
     once read 'R01/02R03/04' at 390 with every box apart */
  const gaps = await pg.evaluate(() => [...document.querySelectorAll('#hIso .zone-head')].filter((e) => { const cs = getComputedStyle(e), z = e.closest('.zone'); return cs.visibility !== 'hidden' && +cs.opacity > 0 && !(z && (getComputedStyle(z).visibility === 'hidden' || +getComputedStyle(z).opacity === 0 || z.hidden)); }).map((e) => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return [b.left, b.right]; })
    .filter((b) => b[1] > b[0]).sort((a, b) => a[0] - b[0]).map((b, i, A) => i ? b[0] - A[i - 1][1] : null).slice(1));
  const minGap = Math.min(...gaps);
  /* a head is centred on its row pair: ink centre within 2 px of the hot aisle's centre */
  const off = await pg.evaluate(() => { const hs = [...document.querySelectorAll('#hIso .zone-head')], hot = [...document.querySelectorAll('#hIso .cap-top, #hIso .fp-aisle-hot')];
    return hs.map((e) => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(), q = e.getBoundingClientRect(); return Math.abs((b.left + b.right) / 2 - (q.left + q.right) / 2); }); });
  ok('HV-F2', off.length >= 10 && Math.max(...off) <= 2, `${W}: row-pair head ink off its own box centre by up to ${Math.max(...off).toFixed(1)} px (text overflowing a fixed box drifts right of its pair)`);
  /* every pair keeps its head at 390 too: 10 heads, not every other one */
  ok('HV-F2', gaps.length >= 9 && minGap >= 3, `${W}: row-pair heads ${gaps.length}, closest ink gap ${minGap.toFixed(1)} px (want >= 3)`);
  ok('HV-L1', LENSES.every((l) => s.lenses.includes(l)), `${W}: lenses ${JSON.stringify(s.lenses)}, want ${LENSES.join('/')}`);
  ok('HV-L1', s.legend, `${W}: no visible legend on the floor`);
  ok('HV-S0', s.stbyWant != null && s.stby === s.stbyWant, `${W}: standby lamps ${s.stby}, engine standby ${s.stbyWant}`);
  /* Cooling lens, if the page has one */
  const hasCooling = await pg.evaluate(() => { const b = document.querySelector('#p-hall [data-lens="cooling"]'); if (b) b.click(); return !!b; });
  await wait(600);
  const c = hasCooling ? await read(pg) : s;
  ok('HV-P1', hasCooling && c.plant >= 145 && c.plantWithValue === c.plant, `${W}: Cooling lens ${hasCooling ? 'present' : 'absent'}; ${c.plantWithValue} of ${c.plant} modules + CDUs show a value with a unit`);
  /* table view */
  const tbl = await pg.evaluate(() => {
    const b = [...document.querySelectorAll('#p-hall button, #p-hall summary')].find((x) => /show as table/i.test(x.textContent));
    if (!b) return null; b.click();
    return new Promise((r) => setTimeout(() => { const t = document.querySelector('#p-hall table[data-hall-units]'); r(t ? t.tBodies[0].rows.length : -1); }, 400));
  });
  ok('HV-A1', tbl != null && tbl >= 585, `${W}: "Show as table" ${tbl == null ? 'absent' : tbl + ' rows'} (want >= 585)`);
  /* A3: the operating point a row prints is the engine's (one running unit's share; a standby unit 0), never a page number */
  const opr = await pg.evaluate(() => {
    const E = window.DCAI_CALC && window.DCAI_CALC.snapshot && window.DCAI_CALC.snapshot.equipment, t = document.querySelector('#p-hall table[data-hall-units]');
    if (!E || !t) return null;
    const rows = [...t.tBodies[0].rows].map((r) => [...r.cells].map((c) => c.textContent));
    const crah = rows.filter((r) => /^CRAH-/.test(r[0])), cdu = rows.filter((r) => /^CDU-/.test(r[0]));
    const fan = E.crah_fan_speed_pct.toFixed(1) + ' %', air = Math.round(E.crah_airflow_unit_m3h).toLocaleString('en-US') + ' of ', load = '(' + E.cdu_load_pct.toFixed(1) + ' %)', pump = 'pump ' + E.cdu_pump_speed_pct.toFixed(1) + ' %';
    const run = (r) => r[1] === 'running', stb = (r) => r[1] === 'standby';
    return {
      crah: crah.length, cdu: cdu.length, crahStby: crah.filter(stb).length, cduStby: cdu.filter(stb).length,
      wantCrahStby: E.crah_standby_per_hall, wantCduStby: E.cdu_standby_per_hall,
      crahOk: crah.filter(run).every((r) => r[2].includes('fan ' + fan) && r[2].includes(air)), crahStbyZero: crah.filter(stb).every((r) => r[2].startsWith('fan 0.0 %')),
      cduOk: cdu.filter(run).every((r) => r[2].includes(load) && r[2].includes(pump)), cduStbyZero: cdu.filter(stb).every((r) => r[2].includes('(0.0 %)') && r[2].includes('pump 0.0 %')),
      sample: (crah[0] || []).concat(cdu[cdu.length - 1] || []).join(' | ')
    };
  });
  ok('HV-A1', !!opr && opr.crahOk && opr.cduOk, `${W}: table operating points differ from the engine (${opr ? opr.sample : 'no engine or table'})`);
  ok('HV-A1', !!opr && opr.crahStby === opr.wantCrahStby && opr.cduStby === opr.wantCduStby && opr.crahStbyZero && opr.cduStbyZero,
    `${W}: standby rows ${opr && [opr.crahStby, opr.cduStby]} want ${opr && [opr.wantCrahStby, opr.wantCduStby]}, standby carries 0: ${opr && [opr.crahStbyZero, opr.cduStbyZero]}`);
  if (W === 1440) {
    /* HV-V3: a switch keeps the selected unit and the paint mode, and never re-runs the hall (RZHallIso.update).
       The selection is made the operator's way on the floor: focus, an arrow, Enter (a click opens the HMI). */
    const selIdx = () => pg.evaluate(() => { const r = document.querySelector('#hIso .rack[data-sel="1"]'); return r ? +r.getAttribute('data-idx') : null; });
    const click = (v) => pg.evaluate((v) => { const b = document.querySelector('#p-hall .dh-proj [data-view="' + v + '"]'); if (b) b.click(); return !!b; }, v);
    await pg.evaluate(() => { const H = window.RZHallIso; window.__v3u = 0; if (H) { const u0 = H.update; H.update = function () { window.__v3u++; return u0.apply(this, arguments); }; } });
    await click('flat'); await wait(400);
    await pg.evaluate(() => { const s = document.querySelector('#hIso svg.fp-svg'); if (s) s.focus(); });
    for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'Enter']) { await pg.keyboard.press(k); await wait(120); }
    const sel0 = await selIdx(), mode0 = await pg.evaluate(() => document.querySelector('#hIso .fp-root').getAttribute('data-mode'));
    await click('iso'); await wait(900);
    const sel1 = await selIdx(), p1 = await pg.evaluate(() => { const r = document.querySelector('#hIso .fp-root'); return [r.getAttribute('data-proj'), r.getAttribute('data-mode')]; });
    await click('drawing'); await wait(300); await click('flat'); await wait(900);
    const sel2 = await selIdx(), updates = await pg.evaluate(() => window.__v3u);
    const v3 = { sel0, sel1, sel2, proj1: p1[0], mode0, mode1: p1[1], updates };
    ok('HV-V3', v3.sel0 != null && v3.sel1 === v3.sel0 && v3.sel2 === v3.sel0, `selected rack across 2D -> 3D -> Drawing -> 2D: ${JSON.stringify(v3)}`);
    ok('HV-V3', v3.proj1 === 'iso' && v3.mode1 === v3.mode0, `paint mode across the switch: ${v3.mode0} -> ${v3.mode1} (3D ${v3.proj1})`);
    ok('HV-V3', v3.updates === 0, `the switch re-ran the hall ${v3.updates} times (RZHallIso.update), want 0`);
  }
  ok('HV-V1', s.scrollW <= s.vw + 1, `${W}: page scrolls sideways (${s.scrollW} > ${s.vw})`);
  ok('HV-V1', pg.errors.length === 0, `${W}: page errors ${pg.errors.slice(0, 2).join(' | ')}`);
  if (W === 1440) {
    await pg.close();
    const pg2 = await open(W); const s2 = await read(pg2);
    ok('HV-D1', s.floorText === s2.floorText, `two loads drew different floor text (${s.floorText.length} vs ${s2.floorText.length} chars; first diff at ${[...s.floorText].findIndex((ch, i) => ch !== s2.floorText[i])})`);
    await pg2.close();
  } else await pg.close();
}
/* HV-G1 (owner 2026-11-23 "arrangement harus accurate dan valid dan comprehensive"): the 2D floor is the hall TO SCALE.
   Measured on the drawn SVG in the top view, with u = slab width / engine hall length:
   slab = hall length x width; a rack top = rack depth x rack pitch; the 20 rows sit where the Drawing view puts them
   (pair = cold/2 | rack | 2 x hot share | rack | cold/2 = 2 x row pitch); north gallery on the north wall, CDU line after
   the rack field + service corridor, south gallery on the south wall, each at its engine depth; modules per gallery and
   their pitch = the engine's. Every expected length is read from DCAI_CALC.snapshot.geometry, never typed here. */
for (const W of [1440, 390]) {
  if (ONLY.size && !ONLY.has('HV-G1')) break;
  const pg = await open(W);
  const r = await pg.evaluate(() => {
    const S = window.DCAI_CALC && window.DCAI_CALC.snapshot, g = S && S.geometry;
    const svg = document.querySelector('#hIso svg.fp-svg') || document.querySelector('#hIso svg'), slab = svg && svg.querySelector('.fp-slab');
    if (!g || !slab) return { err: 'no geometry or slab' };
    const bb = (e) => { const b = e.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const sb = bb(slab), u = sb.w / g.hall_length_m, m = (v) => v / u;
    const racks = [...svg.querySelectorAll('.rk-top')].map(bb);
    const xs = [...new Set(racks.map((b) => +m(b.x - sb.x).toFixed(2)))].sort((a, b) => a - b);
    const cells = (sel) => [...svg.querySelectorAll(sel)].map((e) => bb(e.querySelector('.cr-top')));
    const N = cells('[data-gallery="north"] .crah-cell'), C = cells('[data-gallery="cdu"] .crah-cell'), Sg = cells('[data-gallery="south"] .crah-cell');
    const ext = (a) => a.length ? { y0: m(Math.min(...a.map((b) => b.y)) - sb.y), y1: m(Math.max(...a.map((b) => b.y + b.h)) - sb.y), n: a.length,
      pitch: a.length > 1 ? m((Math.max(...a.map((b) => b.x)) - Math.min(...a.map((b) => b.x))) / (a.length - 1)) : 0 } : null;
    return { g: { L: g.hall_length_m, W: g.hall_width_m, rp: g.rack_pitch_m, rd: g.rack_depth_m, ca: g.cold_aisle_m, ha: g.hot_aisle_m, xa: g.cross_aisle_m,
        cd: g.cdu_line_depth_m, rows: g.rack_rows, per: g.racks_per_row, mods: g.fan_wall_modules_per_gallery, mp: g.fan_wall_module_pitch_m, gd: g.air_plant_m2 / (g.fan_wall_galleries * g.hall_length_m) },
      aspect: sb.w / sb.h, rackW: m(racks[0].w), rackH: m(racks[0].h), nRacks: racks.length, xs, N: ext(N), C: ext(C), S: ext(Sg) };
  });
  if (r.err) { ok('HV-G1', false, `${W}: ${r.err}`); await pg.close(); continue; }
  const G = r.g, near = (a, b, tol) => Math.abs(a - b) <= tol;
  ok('HV-G1', near(r.aspect, G.L / G.W, 0.005 * G.L / G.W), `${W}: slab aspect ${r.aspect.toFixed(3)} want ${G.L} / ${G.W} m`);
  ok('HV-G1', r.nRacks === G.rows * G.per && near(r.rackW, G.rd, 0.03) && near(r.rackH, G.rp, 0.03), `${W}: ${r.nRacks} racks, top ${r.rackW.toFixed(2)} x ${r.rackH.toFixed(2)} m want ${G.rd} x ${G.rp}`);
  const want = []; for (let p = 0; p < G.rows / 2; p++) { const p0 = p * 2 * (G.rd + G.ca + G.ha); want.push(p0 + G.ca, p0 + G.ca + G.rd + 2 * G.ha); }
  ok('HV-G1', r.xs.length === G.rows && r.xs.every((x, i) => near(x, want[i], 0.05)), `${W}: row west faces ${r.xs.slice(0, 4).join(', ')}… want ${want.slice(0, 4).map((v) => v.toFixed(2)).join(', ')}…`);
  const fieldEnd = G.gd + G.per * G.rp;
  /* Amendment 2: bodies, not allotments — each inside its strip, a fan-wall body on the hall face of its gallery */
  const inn = (e, a, b) => e && e.y0 >= a - 0.05 && e.y1 <= b + 0.05;
  ok('HV-G1', inn(r.N, 0, G.gd) && near(r.N.y1, G.gd, 0.05) && r.N.y1 - r.N.y0 < G.gd - 0.5, `${W}: north fan-wall bodies ${r.N && r.N.y0.toFixed(2)}–${r.N && r.N.y1.toFixed(2)} m want inside 0–${G.gd}, on the hall face, thinner than the gallery`);
  ok('HV-G1', inn(r.C, fieldEnd + G.xa, fieldEnd + G.xa + G.cd) && r.C.y1 - r.C.y0 < G.cd - 0.5, `${W}: CDU bodies ${r.C && r.C.y0.toFixed(2)}–${r.C && r.C.y1.toFixed(2)} m want inside the CDU line ${(fieldEnd + G.xa).toFixed(2)}–${(fieldEnd + G.xa + G.cd).toFixed(2)}`);
  ok('HV-G1', inn(r.S, G.W - G.gd, G.W) && near(r.S.y0, G.W - G.gd, 0.05) && r.S.y1 - r.S.y0 < G.gd - 0.5, `${W}: south fan-wall bodies ${r.S && r.S.y0.toFixed(2)}–${r.S && r.S.y1.toFixed(2)} m want inside ${G.W - G.gd}–${G.W}, on the hall face`);
  ok('HV-G1', r.N.n === G.mods && r.S.n === G.mods && near(r.N.pitch, G.mp, 0.03) && near(r.S.pitch, G.mp, 0.03), `${W}: modules ${r.N.n} / ${r.S.n} at ${r.N.pitch.toFixed(3)} m want ${G.mods} at ${G.mp.toFixed(3)} m`);
  await pg.close();
}

/* HV-G2 (Amendment 2 P1/P2, owner "sangat tidak proportional positioning dan sizenya"): ONE placement. For every
   fan-wall module and CDU, its 2D floor body (metres, from the drawn SVG) equals its Drawing-view body (metres, from the
   Drawing's own rect through __hallZones hx0 / hy0 / ppm) within 0.05 m on x, y, w and d. */
for (const W of [1440, 390]) {
  if (ONLY.size && !ONLY.has('HV-G2')) break;
  const pg = await open(W);
  const floor = await pg.evaluate(() => {
    const g = window.DCAI_CALC.snapshot.geometry, svg = document.querySelector('#hIso svg.fp-svg') || document.querySelector('#hIso svg'), sl = svg.querySelector('.fp-slab').getBBox(), u = sl.width / g.hall_length_m, o = {};
    for (const c of svg.querySelectorAll('.crah-cell[data-rz-equipment]')) { const b = c.querySelector('.cr-top').getBBox(); o[c.getAttribute('data-rz-equipment')] = [(b.x - sl.x) / u, (b.y - sl.y) / u, b.width / u, b.height / u]; }
    return o;
  });
  await pg.evaluate(() => { const b = document.querySelector('#p-hall .dh-proj [data-view="drawing"]'); if (b) b.click(); });
  await wait(800);
  const draw = await pg.evaluate(() => {
    const Z = window.__hallZones, o = {};
    for (const gEl of document.querySelectorAll('[data-rz-equipment^="crah:"], [data-rz-equipment^="cdu:"]')) {
      if (gEl.closest('#hIso')) continue;
      const r = gEl.querySelector('rect.hp-cab'); if (!r) continue;
      const v = (a) => +r.getAttribute(a);
      o[gEl.getAttribute('data-rz-equipment')] = [(v('x') - Z.hx0) / Z.ppm, (v('y') - Z.hy0) / Z.ppm, v('width') / Z.ppm, v('height') / Z.ppm];
    }
    return o;
  });
  const ids = Object.keys(floor), bad = [];
  for (const id of ids) { const a = floor[id], b = draw[id]; if (!b || a.some((x, i) => Math.abs(x - b[i]) > 0.05)) bad.push(id + ' floor ' + a.map((x) => x.toFixed(2)).join('/') + ' drawing ' + (b ? b.map((x) => x.toFixed(2)).join('/') : 'absent')); }
  ok('HV-G2', ids.length >= 145 && Object.keys(draw).length >= 145, `${W}: ${ids.length} floor units, ${Object.keys(draw).length} Drawing units`);
  ok('HV-G2', bad.length === 0, `${W}: ${bad.length} of ${ids.length} units placed differently from the Drawing view: ${bad.slice(0, 3).join(' | ')}`);
  await pg.close();
}

/* HV-M1 / HV-M2 (A4 §7): rotors turn at the unit's own speed (period = T_ref / speed: fan 1.0 s, pump 0.8 s), standby is
   still; reduced motion stills every rotor; the Drawing view and another cockpit tab leave 0 running rotor animations */
for (const W of [1440, 390]) {
  if (ONLY.size && !ONLY.has('HV-M1') && !ONLY.has('HV-M2')) break;
  const pg = await open(W);
  const rot = () => pg.evaluate(() => {
    const E = window.DCAI_CALC && window.DCAI_CALC.snapshot.equipment, cells = [...document.querySelectorAll('#hIso .crah-cell')];
    const one = (c) => { const r = c.querySelector('.fp-rotor'); if (!r) return null; const cs = getComputedStyle(r);
      return { kind: c.getAttribute('data-kind'), stby: c.classList.contains('stby'), name: cs.animationName, dur: parseFloat(cs.animationDuration),
        running: r.getAnimations().filter((a) => a.playState === 'running').length }; };
    const rs = cells.map(one);
    return { cells: cells.length, rotors: rs.filter(Boolean).length, fan: E && E.crah_fan_speed_pct, pump: E && E.cdu_pump_speed_pct, rs: rs.filter(Boolean) };
  });
  const a = await rot();
  const wantFan = 1 / (a.fan / 100), wantPump = 0.8 / (a.pump / 100);
  const run = a.rs.filter((r) => !r.stby), stb = a.rs.filter((r) => r.stby);
  ok('HV-M1', a.cells >= 145 && a.rotors === a.cells, `${W}: ${a.rotors} rotors on ${a.cells} fan-wall modules + CDUs`);
  ok('HV-M1', run.length > 0 && run.every((r) => r.name === 'fp-rot' && Math.abs(r.dur - (r.kind === 'crah' ? wantFan : wantPump)) <= 0.01 * (r.kind === 'crah' ? wantFan : wantPump)),
    `${W}: running rotor periods ${[...new Set(run.map((r) => r.kind + ' ' + r.name + ' ' + r.dur))].join(', ')} want fan ${wantFan.toFixed(3)} s, pump ${wantPump.toFixed(3)} s`);
  ok('HV-M1', stb.length > 0 && stb.every((r) => r.name === 'none' && r.running === 0), `${W}: standby rotors ${JSON.stringify(stb.slice(0, 2))} must stand still`);
  /* another cockpit tab: the hall panel is hidden, so no rotor may keep running (the cockpit does not scroll the floor away) */
  await pg.evaluate(() => { const b = document.querySelector('#tabs [data-t="dash"]') || [...document.querySelectorAll('#tabs [data-t]')].find((x) => x.getAttribute('data-t') !== 'hall'); if (b) b.click(); });
  await wait(600);
  const off = await rot();
  ok('HV-M2', off.rs.every((r) => r.running === 0), `${W}: another tab open, ${off.rs.filter((r) => r.running).length} rotors still running`);
  await pg.evaluate(() => { const b = document.querySelector('#tabs [data-t="hall"]'); if (b) b.click(); }); await wait(800);
  await pg.evaluate(() => { const b = document.querySelector('#p-hall .dh-proj [data-view="drawing"]'); if (b) b.click(); });
  await wait(500);
  const dr = await rot();
  ok('HV-M2', dr.rs.every((r) => r.running === 0), `${W}: Drawing view ${dr.rs.filter((r) => r.running).length} rotors still running`);
  await pg.evaluate(() => { const b = document.querySelector('#p-hall .dh-proj [data-view="flat"]'); if (b) b.click(); });
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await wait(500);
  const rm = await rot();
  ok('HV-M2', rm.rotors > 0 && rm.rs.every((r) => r.name === 'none' && r.running === 0), `${W}: reduced motion ${rm.rs.filter((r) => r.name !== 'none').length} rotors animated`);
  ok('HV-M2', pg.errors.length === 0, `${W}: page errors ${pg.errors.slice(0, 2).join(' | ')}`);
  await pg.close();
}
/* HV-S1 / HV-I1 (Amendment 3, A5a): each cooling scenario changes on the floor exactly the units whose HMI payload says so
   (computed here from RZDatahallAIHmiPayloads with the PRD D2 severity mapping, independent of the floor code); rotor
   periods keep their normal values (D3); alarmed units carry flags (<= 8, + "+n" = every alarmed unit), inside the
   stage, clear of each other and of the row heads; normal shows none */
for (const W of [1440, 390]) {
  if (ONLY.size && !ONLY.has('HV-S1') && !ONLY.has('HV-I1')) break;
  const pg = await open(W);
  const look = (sc) => pg.evaluate(async (sc) => {
    const sel = document.getElementById('coolingScenario'); sel.value = sc; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 900));
    const P = window.RZDatahallAIHmiPayloads, ctx = P.buildContext(window, { hall: window.currentDH || 1, noTrend: true });
    const sevOf = (p) => { const al = p.tabs.alarms || []; if (al.some((a) => a.severity === 'critical')) return 'alarm';
      return al.length || (p.statusChip && p.statusChip.state === 'fault') ? 'warn' : null; };
    const want = {}, root = document.querySelector('#hIso .fp-root');
    const floor = {};
    for (const u of root.querySelectorAll('[data-rz-equipment]')) {
      const ref = u.getAttribute('data-rz-equipment'), st = u.getAttribute('data-state');
      if (st === 'warn' || st === 'alarm') floor[ref] = st;
      let m = /^(crah|cdu):(\d+)$/.exec(ref), s = null;
      if (m) s = sevOf(P.payload(m[1], m[2], ctx));
      else if ((m = /^rack-unit:R(\d\d)-\d\d$/.exec(ref))) { const p = P.payload('rack-unit', 'R' + m[1] + '-01', ctx); s = p.state('manifold') === 'wet' ? 'alarm' : sevOf(p); }
      if (s) want[ref] = s;
    }
    const vis = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const bx = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    const flags = [...document.querySelectorAll('#hIsoWrap .dh-flag')].filter(vis).map((f) => ({ txt: f.textContent.trim(), n: +f.getAttribute('data-units'), point: f.getAttribute('data-point'), ...bx(f) }));
    const more = [...document.querySelectorAll('#hIsoWrap .dh-flag-more')].filter(vis).map((f) => +f.getAttribute('data-n'))[0] || 0;
    const heads = [...root.querySelectorAll('.zone-head')].filter(vis).map(bx), stage = bx(root);
    const cut = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1;
    const rot = [...root.querySelectorAll('.crah-cell .fp-rotor')].map((r) => r.style.animationDuration).join('|');
    const text = [...root.querySelectorAll('text')].map((t) => t.textContent.trim()).join('|');
    return { want, floor, flags, more, rot, text,
      outside: flags.filter((f) => f.l < stage.l - 1 || f.t < stage.t - 1 || f.r > stage.r + 1 || f.b > stage.b + 1).length,
      overlap: flags.filter((f, i) => flags.some((g, j) => j > i && cut(f, g))).length + flags.filter((f) => heads.some((h) => cut(f, h))).length };
  }, sc);
  const base = await look('normal');
  for (const sc of ['normal', 'cdu-pump-fail', 'chiller-trip', 'leak-z07']) {
    const r = sc === 'normal' ? base : await look(sc);
    const wk = Object.keys(r.want).sort(), fk = Object.keys(r.floor).sort();
    const diff = wk.filter((k) => r.floor[k] !== r.want[k]).concat(fk.filter((k) => !r.want[k]));
    ok('HV-S1', diff.length === 0, `${W} ${sc}: floor state differs from the payloads on ${diff.length} units (${diff.slice(0, 4).map((k) => k + ' floor ' + r.floor[k] + ' want ' + r.want[k]).join(', ')})`);
    if (sc === 'normal' || sc === 'chiller-trip') ok('HV-S1', wk.length === 0 && fk.length === 0, `${W} ${sc}: ${fk.length} units in warn/alarm, want 0`);
    if (sc === 'cdu-pump-fail' || sc === 'leak-z07') ok('HV-S1', wk.length > 0, `${W} ${sc}: the payloads raise nothing (scenario not wired?)`);
    if (sc === 'chiller-trip') ok('HV-S1', r.text === base.text, `${W} chiller-trip: floor text changed against normal`);
    ok('HV-S1', r.rot === base.rot, `${W} ${sc}: rotor periods changed against normal`);
    const alarmed = fk.length, onFlags = r.flags.reduce((s, f) => s + f.n, 0);
    if (!alarmed) ok('HV-I1', r.flags.length === 0 && r.more === 0, `${W} ${sc}: ${r.flags.length} flags with nothing alarmed`);
    else {
      ok('HV-I1', r.flags.length >= 1 && r.flags.length <= 8, `${W} ${sc}: ${r.flags.length} flags, want 1..8`);
      ok('HV-I1', onFlags + r.more === alarmed, `${W} ${sc}: flags count ${onFlags} + more ${r.more}, alarmed units ${alarmed}`);
      ok('HV-I1', r.flags.every((f) => f.point && f.txt.includes(f.point)), `${W} ${sc}: a flag without its point (${r.flags.map((f) => f.txt).join(' / ')})`);
      ok('HV-I1', r.outside === 0 && r.overlap === 0, `${W} ${sc}: flags outside the stage ${r.outside}, overlapping ${r.overlap}`);
    }
    if (SHOTS && sc !== 'normal') await pg.screenshot({ path: path.join(SHOTS, `hv-${sc}-${W}.png`) });
  }
  ok('HV-S1', pg.errors.length === 0, `${W}: page errors ${pg.errors.slice(0, 2).join(' | ')}`);
  await pg.close();
}
/* HV-I2 / HV-I3 (Amendment 3 A5b): one alarm count. The scenario's payload alarms (CDU + fan-wall payloads + the leak
   payload, computed here) move the status strip by exactly their count (critical -> Critical, else -> Warning) on the
   Data Hall and the Alarms & Events strips, and the Alarms workspace journals each one active, then returned */
for (const W of [1440]) {
  if (ONLY.size && !ONLY.has('HV-I2') && !ONLY.has('HV-I3')) break;
  const pg = await open(W);
  const look = (sc) => pg.evaluate(async (sc) => {
    const sel = document.getElementById('coolingScenario'); sel.value = sc; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 900));
    const P = window.RZDatahallAIHmiPayloads, ctx = P.buildContext(window, { hall: window.currentDH || 1, noTrend: true });
    const want = [];
    const take = (p) => (p.tabs.alarms || []).forEach((a) => want.push({ tag: a.tag, point: a.point, severity: a.severity }));
    document.querySelectorAll('#hIso [data-rz-equipment^="crah:"], #hIso [data-rz-equipment^="cdu:"]').forEach((u) => { const m = /^(crah|cdu):(\d+)$/.exec(u.getAttribute('data-rz-equipment')); take(P.payload(m[1], m[2], ctx)); });
    take(P.payload('leak', '1', ctx));
    const num = (bar, k) => { const m = new RegExp(k + '\\s*(\\d+)').exec(bar ? bar.textContent : ''); return m ? +m[1] : null; };
    const hb = document.querySelector('#p-hall .dh-alarmbar');
    const hall = { c: num(hb, 'Critical'), w: num(hb, 'Warning') };
    const t = document.querySelector('#tabs [data-t="alarms"]'); if (t) t.click(); await new Promise((r) => setTimeout(r, 600));
    const ab = document.querySelector('#p-alarms .dh-alarmbar');
    const alm = { c: num(ab, 'Critical'), w: num(ab, 'Warning') };
    const h = document.querySelector('#tabs [data-t="hall"]'); if (h) h.click(); await new Promise((r) => setTimeout(r, 600));
    const W2 = window.RZDatahallAIAlarmWorkspace, ev = W2 ? W2.events() : [];
    return { want, hall, alm, ev: ev.map((e) => ({ tag: e.tag, point: e.point, severity: e.severity, lifecycle: e.lifecycle, scenario: e.scenario, seq: e.sequence })) };
  }, sc);
  const base = await look('normal');
  const latest = (ev, a) => ev.filter((e) => e.tag === a.tag && e.point === a.point && e.scenario !== 'normal').sort((x, y) => x.seq - y.seq).pop();
  let lastSet = [];
  for (const sc of ['cdu-pump-fail', 'normal', 'leak-z07', 'chiller-trip']) {
    const r = await look(sc);
    const crit = r.want.filter((a) => a.severity === 'critical').length, other = r.want.length - crit;
    for (const [nm, bar, b0] of [['Data Hall', r.hall, base.hall], ['Alarms', r.alm, base.alm]]) {
      ok('HV-I2', bar.c != null && bar.c - b0.c === crit && bar.w - b0.w === other, `${W} ${sc} ${nm} strip: Critical ${b0.c}->${bar.c}, Warning ${b0.w}->${bar.w}; payload alarms ${crit} critical + ${other} other`);
    }
    if (sc === 'cdu-pump-fail' || sc === 'leak-z07') ok('HV-I2', r.want.length > 0, `${W} ${sc}: no payload alarms (scenario not wired?)`);
    const miss = r.want.filter((a) => { const e = latest(r.ev, a); return !e || e.lifecycle !== 'active_unack' || e.severity !== a.severity || e.scenario !== sc; });
    ok('HV-I3', miss.length === 0, `${W} ${sc}: ${miss.length} of ${r.want.length} payload alarms not journalled active (${miss.slice(0, 3).map((a) => a.tag + ' ' + a.point).join(', ')})`);
    const cleared = lastSet.filter((a) => !r.want.some((b) => b.tag === a.tag && b.point === a.point));
    const stillActive = cleared.filter((a) => { const e = latest(r.ev, a); return !e || e.lifecycle !== 'returned_unack'; });
    ok('HV-I3', stillActive.length === 0, `${W} ${sc}: ${stillActive.length} of ${cleared.length} cleared alarms without a later returned_unack record`);
    lastSet = r.want;
  }
  ok('HV-I2', pg.errors.length === 0, `${W}: page errors ${pg.errors.slice(0, 2).join(' | ')}`);
  await pg.close();
}
/* HV-U1 (Amendment 3 D7): every row-pair foot on the 2D and 3D floor ends in its unit and equals racks per pair x the
   engine rack kW (within one display step) */
for (const W of [1440, 390]) {
  if (ONLY.size && !ONLY.has('HV-U1')) break;
  const pg = await open(W);
  for (const v of ['flat', 'iso']) {
    const r = await pg.evaluate(async (v) => {
      const b = document.querySelector('#p-hall .dh-proj [data-view="' + v + '"]'); if (b) b.click();
      await new Promise((res) => setTimeout(res, 900));
      const m = window.RZHallIso && window.RZHallIso.model(), want = m ? m.racksPerZone * m.racks[0].kw : null;
      const feet = [...document.querySelectorAll('#hIso .zone-foot .zf-kw')].filter((f) => f.getClientRects().length > 0).map((f) => f.textContent.replace(/\s+/g, ' ').trim());
      return { want, feet };
    }, v);
    const parse = (t) => { const x = /([\d.,]+)\s*(kW|MW)\b/.exec(t); return x ? parseFloat(x[1].replace(/,/g, '')) * (x[2] === 'MW' ? 1000 : 1) : null; };
    const bad = r.feet.filter((t) => { const k = parse(t); return k == null || Math.abs(k - r.want) > (/MW/.test(t) ? 50 : 0.5); });
    ok('HV-U1', r.feet.length >= 10 && bad.length === 0, `${W} ${v}: ${bad.length} of ${r.feet.length} row-pair feet without a unit or off the engine ${r.want} kW (${bad.slice(0, 3).join(' / ')})`);
  }
  await pg.close();
}
/* HV-M3 (Amendment 3 D6, Amendment 1 §7.1): the air paths show and move only in the Thermal and Cooling lenses */
for (const W of [1440, 390]) {
  if (ONLY.size && !ONLY.has('HV-M3')) break;
  const pg = await open(W);
  const air = (lens) => pg.evaluate(async (lens) => {
    const b = document.querySelector('#p-hall [data-lens="' + lens + '"]'); if (b) b.click();
    await new Promise((r) => setTimeout(r, 400));
    const ps = [...document.querySelectorAll('#hIso .fp-air path')].filter((p) => p.getClientRects().length > 0 && getComputedStyle(p).display !== 'none' && getComputedStyle(p.parentNode).display !== 'none');
    const run = [...document.querySelectorAll('#hIso .fp-air path')].reduce((n, p) => n + p.getAnimations().filter((a) => a.playState === 'running').length, 0);
    return { vis: ps.length, run };
  }, lens);
  for (const lens of ['status', 'power', 'layout']) { const a = await air(lens); ok('HV-M3', a.vis === 0 && a.run === 0, `${W} ${lens}: ${a.vis} air paths visible, ${a.run} running, want 0`); }
  for (const lens of ['thermal', 'cooling']) { const a = await air(lens); ok('HV-M3', a.vis > 0 && a.run === a.vis, `${W} ${lens}: ${a.vis} air paths visible, ${a.run} running`); }
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const rm = await air('cooling'); ok('HV-M3', rm.vis > 0 && rm.run === 0, `${W} cooling reduced motion: ${rm.run} running`);
  await pg.close();
}
/* HV-T1 (A2): the 3D floor wears three tones in both themes — slab (darkest on a dark page), equipment body, equipment top —
   measured as WCAG contrast of the COMPUTED fills (the slab composited over the stage background at its fill-opacity) */
for (const theme of ['dark', 'light']) {
  if (ONLY.size && !ONLY.has('HV-T1')) break;
  const pg = await open(1440);
  await pg.evaluate((t) => { if (window.RZChrome && window.RZChrome.set) window.RZChrome.set(t); else document.documentElement.setAttribute('data-theme', t); }, theme);
  await pg.evaluate(() => { const b = document.querySelector('#p-hall .dh-proj [data-view="iso"]'); if (b) b.click(); });
  await wait(1200);
  const t = await pg.evaluate(() => {
    const rgb = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); return m ? m[1].split(',').map(Number) : null; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const root = document.querySelector('#hIso .fp-root'), slab = root && root.querySelector('.fp-slab');
    const rk = root && [...root.querySelectorAll('.rack[data-state="neutral"], .rack[data-state="ok"]')][0];
    if (!slab || !rk) return { err: 'no slab or rack', proj: root && root.getAttribute('data-proj') };
    let bgEl = document.getElementById('hIso'), bg = rgb(getComputedStyle(bgEl).backgroundColor);
    while (bg && bg.length === 4 && bg[3] === 0 && bgEl.parentElement) { bgEl = bgEl.parentElement; bg = rgb(getComputedStyle(bgEl).backgroundColor); }
    const cs = getComputedStyle(slab), sf = rgb(cs.fill), a = (+cs.fillOpacity) * (sf[3] != null ? sf[3] : 1);
    const slabC = [0, 1, 2].map((i) => sf[i] * a + bg[i] * (1 - a));
    const body = rgb(getComputedStyle(rk.querySelector('.rk-front')).fill), top = rgb(getComputedStyle(rk.querySelector('.rk-top')).fill);
    return { proj: root.getAttribute('data-proj'), slab: slabC.map(Math.round), body, top, slabBody: +cr(slabC, body).toFixed(2), bodyTop: +cr(body, top).toFixed(2) };
  });
  ok('HV-T1', !t.err && t.proj === 'iso', `${theme}: 3D floor not measurable (${JSON.stringify(t)})`);
  ok('HV-T1', !t.err && t.slabBody >= 1.25, `${theme}: slab/body contrast ${t.slabBody} (slab ${t.slab}, body ${t.body}), want >= 1.25`);
  ok('HV-T1', !t.err && t.bodyTop >= 1.1, `${theme}: body/top contrast ${t.bodyTop} (body ${t.body}, top ${t.top}), want >= 1.1`);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `hv-3d-${theme}-1440.png`) });
  await pg.close();
}
/* HV-D1 static: no Math.random reachable from the view code */
for (const f of ['js/datahall-ai/hall-iso.js', 'js/conv/floor-plan.js']) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('HV-D1', !/Math\.random/.test(src), `${f} calls Math.random`);
}

await browser.close(); srv.close();
if (fails.length) { console.log(fails.join('\n')); console.log(`\nDCAI HALL VIEWS — FAIL (${fails.length} of ${checks})`); process.exit(1); }
console.log(`DCAI HALL VIEWS — PASS (${checks} checks: 2D · 3D · Drawing switch, 2D default, whole hall on the first screen, no label overlap, lenses + legend, plant values in Cooling, standby lamps, deterministic floor, table view)`);
