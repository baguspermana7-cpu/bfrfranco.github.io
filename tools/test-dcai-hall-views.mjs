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
   HV-A1  "Show as table" lists every unit of the floor (racks + modules + CDUs) with its state
   HV-V3  a switch 2D -> 3D -> Drawing -> 2D keeps the selected rack and the paint mode; RZHallIso.update runs 0 times
   HV-T1  3D tones: slab/body contrast >= 1.25 and body/top >= 1.1 in both themes (computed fills).
   Later phases add: HV-P2 (A3), HV-M1/M2 (A4), HV-S1/HV-I1 (A5).
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
