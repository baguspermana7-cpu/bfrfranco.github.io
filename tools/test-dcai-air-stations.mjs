#!/usr/bin/env node
/* PRD-DCAI-HALL-DEPTH Amendment 8 (phases A8a + A8b) — the air side, the valves and four points per aisle.
   AV3 Cooling: every running fan-wall / CDU cell shows a valve bar, data-pct = engine valve stroke, fill ratio = stroke +-2 %;
       standby shows none filled; no valve bar in any other lens
   AV4 rotor period per running cell = T_ref / (speed / 100) +-5 % in 2D AND 3D (3D had 0 rotors); reduced motion 0 running
   AV5 a fan-wall tooltip names return air (= engine plane) and the CHW valve % "(modelled)"; a CDU tooltip the FWS valve
   ST4-1 Thermal stations = pairs x 2 aisles x 4; the Drawing view prints 4 points per aisle
   ST4-2 a cold station carries T, RH and dew point; dew = Magnus(T, RH) +-0.05
   ST4-4 exactly one hottest-point ring per row pair, on its warmest cold station
   RD1 a rack tooltip names its inlet point, its TCS flow and temperatures and its feed current (engine fields)
   RD2 a point forced warm repaints exactly the racks that read it, no others
   Red on 0040a76cf: no valve bar, no 3D rotor, 3 points, no RH/dew, no ring. */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { isSupabaseModule, signedInStorage, signedInSupabaseBody } from './lib/signed-in-supabase.mjs';
import { enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = (process.argv.find((a) => a.startsWith('--shots=')) || '').split('=')[1];
const ONLY = new Set(((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean));
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
      if (sessionStorage.getItem('__dcaiFlagSeeded')) return;
      sessionStorage.setItem('__dcaiFlagSeeded', '1');
      localStorage.clear();
      localStorage.setItem('theme', 'dark'); localStorage.setItem('rz_cookie_consent', 'declined');
      entries.forEach(([k, v]) => localStorage.setItem(k, v));
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
const lensTo = async (pg, l) => { await pg.evaluate((l) => document.querySelector('#p-hall [data-lens="' + l + '"]').click(), l); await wait(900); };
const viewTo = async (pg, v) => { await pg.evaluate((v) => { const b = [...document.querySelectorAll('#p-hall button')].find((x) => x.textContent.trim().toLowerCase() === v); if (b) b.click(); }, v); await wait(1600); };
const read = (pg) => pg.evaluate(() => {
  const root = document.querySelector('#hIso'), g = window.__hallIsoGeo || {};
  const vis = (e) => { if (!e.getClientRects().length) return false; for (let n = e; n && n !== root; n = n.parentElement) { if (getComputedStyle(n).display === 'none') return false; } return true; };
  const cells = [...root.querySelectorAll('.crah-cell')].map((c) => {
    const v = c.querySelector('.cr-valve'), rot = c.querySelector('.fp-rotor'), f = v && v.querySelector('.cr-valve-fill'), t = v && v.querySelector('.cr-valve-track');
    const len = (l) => l ? Math.hypot(+l.getAttribute('x2') - +l.getAttribute('x1'), +l.getAttribute('y2') - +l.getAttribute('y1')) : 0;
    const a = rot && rot.getAnimations().find((x) => x.playState === 'running');
    return { kind: c.getAttribute('data-kind'), stby: c.classList.contains('stby'), valve: !!v && vis(v), pct: v ? v.getAttribute('data-pct') : null, ratio: t ? len(f) / Math.max(1e-6, len(t)) : null,
      rot: !!rot, per: a ? a.effect.getTiming().duration / 1000 : 0 };
  });
  const st = [...root.querySelectorAll('.ovl-st')].filter(vis).map((c) => ({ z: +c.getAttribute('data-z'), s: +c.getAttribute('data-s'), side: c.getAttribute('data-side'), v: +c.getAttribute('data-v'), rh: c.getAttribute('data-rh'), dew: c.getAttribute('data-dew'), hot: c.getAttribute('data-hot') === '1', title: (c.querySelector('title') || {}).textContent || '' }));
  const anims = document.getAnimations().filter((a) => a.playState === 'running' && root.contains(a.effect && a.effect.target)).length;
  const draw = document.querySelectorAll('[id^="C0"][id$="t"]').length;
  return { cells, st, anims, draw, g: { sp: g.sp, rows: g.rows, crahValve: g.crahValve, cduValve: g.cduValve, crahFan: g.crahFan, cduPump: g.cduPump, returnC: g.returnC } };
});
const tipOf = async (pg, sel) => {
  const pt = await pg.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
  if (!pt) return ''; await pg.mouse.move(pt.x, pt.y); await wait(400);
  return pg.evaluate(() => { const t = document.querySelector('#hIso .fp-tip'); return t && !t.hidden ? t.textContent : ''; });
};
const n1 = (v) => (v == null || !isFinite(v) ? '—' : (+v).toFixed(1));
const magnus = (t, rh) => { const g = Math.log(rh / 100) + 17.62 * t / (243.12 + t); return 243.12 * g / (17.62 - g); };
const W = 1440;
const pg = await open(W);
for (const v of ['2d', '3d']) {
  await viewTo(pg, v); await lensTo(pg, 'cooling');
  const R = await read(pg), tag = `@${W} ${v}`, G = R.g;
  const run = R.cells.filter((c) => !c.stby), sb = R.cells.filter((c) => c.stby);
  ok('AV0', [G.crahValve, G.cduValve, G.crahFan, G.cduPump, G.returnC].every((x) => typeof x === 'number' && isFinite(x)), `${tag}: the page publishes no valve / speed / return value to check against ${JSON.stringify(G)}`);
  /* AV3 */
  const want = (c) => c.kind === 'cdu' ? G.cduValve : G.crahValve;
  const badV = run.filter((c) => !c.valve || Math.abs(+c.pct - want(c)) > 0.051 || Math.abs(c.ratio - want(c) / 100) > 0.02);
  ok('AV3', run.length > 100 && badV.length === 0, `${tag} cooling: ${badV.length} of ${run.length} running cells without a correct valve bar ${JSON.stringify(badV.slice(0, 2))} (want crah ${G.crahValve}, cdu ${G.cduValve})`);
  ok('AV3', sb.length > 0 && sb.every((c) => !c.pct && c.ratio < 0.01), `${tag} standby cells show a filled valve: ${JSON.stringify(sb.slice(0, 2))}`);
  /* AV4 */
  const badR = run.filter((c) => { const sp = c.kind === 'cdu' ? G.cduPump : G.crahFan, T = (c.kind === 'cdu' ? 0.8 : 1.0) / (sp / 100); return !c.rot || Math.abs(c.per - T) / T > 0.05; });
  ok('AV4', badR.length === 0, `${tag}: ${badR.length} of ${run.length} running cells without a rotor at T_ref/speed ${JSON.stringify(badR.slice(0, 2))}`);
  ok('AV4', sb.every((c) => c.per === 0), `${tag}: a standby rotor turns`);
  for (const l of ['status', 'thermal', 'power', 'layout']) { await lensTo(pg, l); const r2 = await read(pg); ok('AV3', r2.cells.every((c) => !c.valve), `${tag} ${l}: ${r2.cells.filter((c) => c.valve).length} valve bars outside Cooling`); }
  /* AV5 */
  if (v === '2d') {
    await lensTo(pg, 'cooling');
    const tf = await tipOf(pg, '#hIso .crah-cell[data-kind="crah"]:not(.stby)'), tc = await tipOf(pg, '#hIso .crah-cell[data-kind="cdu"]:not(.stby)');
    ok('AV5', G.crahValve != null && tf.includes('return air ' + n1(G.returnC) + ' °C') && tf.includes('CHW valve ' + n1(G.crahValve) + ' % (modelled)'), `fan-wall tooltip: "${tf.slice(0, 160)}"`);
    ok('AV5', G.cduValve != null && tc.includes('FWS valve ' + n1(G.cduValve) + ' % (modelled)'), `CDU tooltip: "${tc.slice(0, 160)}"`);
  }
  /* ST4 */
  await lensTo(pg, 'thermal');
  const T = await read(pg), pairs = T.g.rows / 2, cold = T.st.filter((s) => s.side === 'cold');
  ok('ST4-1', T.g.sp === 4 && T.st.length === pairs * 2 * 4, `${tag} thermal stations ${T.st.length}, sp ${T.g.sp}, want ${pairs * 8}`);
  if (v === '2d') ok('ST4-1', T.draw === 4, `Drawing view prints ${T.draw} points on aisle 0, want 4`);
  const badD = cold.filter((s) => !(+s.rh > 0) || Math.abs(+s.dew - magnus(s.v, +s.rh)) > 0.051 || !/% RH · dew /.test(s.title));
  ok('ST4-2', cold.length > 0 && badD.length === 0, `${tag}: ${badD.length} of ${cold.length} cold stations without RH / dew ${JSON.stringify(badD.slice(0, 2))}`);
  const rings = {}; T.st.filter((s) => s.hot).forEach((s) => { rings[s.z] = (rings[s.z] || 0) + 1; });
  const badH = [...Array(pairs).keys()].filter((z) => { const cz = cold.filter((s) => s.z === z), mx = Math.max(...cz.map((s) => s.v)); return rings[z] !== 1 || !cz.find((s) => s.hot && s.v === mx); });
  ok('ST4-4', badH.length === 0, `${tag}: ${badH.length} pairs without exactly one ring on the warmest inlet point: ${badH.slice(0, 4)}`);
}
/* A8d rack drill: RD1 one tooltip says what a rack is doing; RD2 a warm point repaints only the racks that read it */
await viewTo(pg, '2d'); await lensTo(pg, 'thermal');
{
  const G2 = await pg.evaluate(() => { const g = window.__hallIsoGeo, D = window.DHE; return { perRow: g.perRow, sp: g.sp, tcs: D.tcsFlowRackLpm, feed: D.rackFeedA, ts: D.tcsSupply, tr: D.tcsReturn }; });
  const tr = await tipOf(pg, '#hIso .rack[data-idx="60"]');
  const idx = 60, j = (idx % (2 * G2.perRow)) % G2.perRow, si = Math.min(G2.sp - 1, Math.floor(j * G2.sp / G2.perRow));
  ok('RD1', tr.includes('cold aisle point ' + (si + 1) + ' of ' + G2.sp) && tr.includes('TCS ' + Math.round(G2.tcs).toLocaleString('en-US') + ' L/min · ' + n1(G2.ts) + ' → ' + n1(G2.tr) + ' °C') && tr.includes('feed A ' + Math.round(G2.feed) + ' A'),
    `rack 60 tooltip: "${tr.slice(0, 200)}" (want point ${si + 1}, TCS ${G2.tcs}, feed ${G2.feed})`);
  await pg.mouse.move(5, 5);
  const warmRacks = () => pg.evaluate(() => [...document.querySelectorAll('#hIso .rack')].filter((r) => r.querySelector('[data-lamp="warn"],[data-lamp="alarm"]')).map((r) => +r.getAttribute('data-idx')));
  const before = await warmRacks();
  await pg.evaluate(() => { const e = document.getElementById('C12t'); e.textContent = '28.4'; document.dispatchEvent(new CustomEvent('rz-hall-readings')); });
  await wait(150);
  const after = await warmRacks(), added = after.filter((i) => before.indexOf(i) < 0).sort((a, b) => a - b);
  const want = []; for (let i = 0; i < 20 / 2 * 2 * G2.perRow; i++) { const z = Math.floor(i / (2 * G2.perRow)), jj = (i % (2 * G2.perRow)) % G2.perRow; if (z === 1 && Math.min(G2.sp - 1, Math.floor(jj * G2.sp / G2.perRow)) === 2 && before.indexOf(i) < 0) want.push(i); }
  ok('RD2', added.length > 0 && JSON.stringify(added) === JSON.stringify(want), `forcing C12t to 28.4 warmed racks ${JSON.stringify(added)}, want exactly ${JSON.stringify(want)}`);
}
/* A8c — 3D that moves: rotors on every running cell in Status, a motion budget, the liquid overhead, still off screen */
{
  const runIn = () => pg.evaluate(() => { const a = document.getAnimations().filter((x) => x.playState === 'running' && x.effect && x.effect.target && x.effect.target.closest && x.effect.target.closest('#hIso'));
    return { all: a.length, rot: a.filter((x) => x.effect.target.closest('.fp-rotor')).length }; });
  await viewTo(pg, '3d'); await lensTo(pg, 'status');
  const R3 = await read(pg), nRun = R3.cells.filter((c) => !c.stby).length, st = await runIn();
  ok('3M1', nRun > 100 && st.rot === nRun, `3D Status: ${st.rot} running rotors for ${nRun} running cells`);
  await lensTo(pg, 'cooling');
  const co = await runIn();
  ok('3M1', co.all > 0 && co.all <= 260, `3D Cooling: ${co.all} running animations (budget 260)`);
  const P3 = await pg.evaluate(() => { const g = document.querySelector('#hIso .fp-ovl'); return { cap: +(g && g.getAttribute('data-cap')), p: [...document.querySelectorAll('#hIso .ovl-pipe')].map((e) => ({ k: e.getAttribute('data-kind'), h: e.getAttribute('data-h') })) }; });
  const low = P3.p.filter((x) => !(x.h != null && +x.h > P3.cap));
  ok('3M2', P3.cap > 1 && P3.p.length >= 22 && low.length === 0, `3D: ${low.length} of ${P3.p.length} pipes not above the rack tops (cap ${P3.cap} m) ${JSON.stringify(low.slice(0, 2))}`);
  await viewTo(pg, '2d'); await lensTo(pg, 'cooling');
  const P2 = await pg.evaluate(() => [...document.querySelectorAll('#hIso .ovl-pipe')].map((e) => e.getAttribute('data-h')));
  ok('3M2', P2.length >= 22 && P2.every((h) => h === '0'), `2D keeps the plan: pipe heights ${JSON.stringify([...new Set(P2)])}`);
  await viewTo(pg, '3d'); await lensTo(pg, 'status');
  /* at 1440 x 900 the page scrolls only ~70 px, so the floor is moved out of the viewport by a transform (IntersectionObserver
     sees transformed bounds) — the same signal a scroll gives */
  await pg.evaluate(() => { document.getElementById('hIsoWrap').style.transform = 'translateY(4000px)'; });
  await wait(900);
  const vis = await pg.evaluate(() => { const r = document.getElementById('hIso').getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  const off = await runIn();
  ok('3M3', !vis && off.all === 0, `off screen (visible ${vis}): ${off.all} running animations in #hIso`);
  await pg.evaluate(() => { document.getElementById('hIsoWrap').style.transform = ''; }); await wait(900);
  const back = await runIn();
  ok('3M3', back.rot > 100, `back on screen: ${back.rot} rotors run again`);
}
await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await lensTo(pg, 'status'); await lensTo(pg, 'cooling');
const rm = await read(pg);
ok('AV4', rm.anims === 0, `reduced motion: ${rm.anims} running animations in #hIso`);
ok('AV0', pg.errors.length === 0, `page errors: ${pg.errors.slice(0, 2).join(' | ')}`);
await pg.close();
/* A8e — a station opens its own 24 h trend (SA1): title names it, the value shown = its reading, no HMI opens, Escape closes */
{
  const sp = await open(1440);
  await viewTo(sp, '2d'); await lensTo(sp, 'thermal');
  for (const side of ['cold', 'hot']) {
    const at = await sp.evaluate((side) => { const c = document.querySelector(`#hIso .ovl-st[data-side="${side}"][data-z="3"][data-s="1"]`); if (!c) return null; const b = c.getBoundingClientRect(); return { x: (b.left + b.right) / 2 + 3, y: (b.top + b.bottom) / 2 - 2, v: c.getAttribute('data-v') }; }, side);
    if (!at) { ok('SA1', false, `${side}: station z3 s1 not drawn`); continue; }
    await sp.mouse.click(at.x, at.y); await wait(500);
    const R = await sp.evaluate(() => { const c = document.querySelector('#hIso .dh-sttrend'), modal = [...document.querySelectorAll('[aria-modal="true"]')].filter((m) => m.getBoundingClientRect().width > 0).length;
      return c ? { label: c.getAttribute('aria-label'), now: c.querySelector('.st-now').textContent, pen: (c.querySelector('.st-pen').getAttribute('d').match(/[ML]/g) || []).length, lim: c.querySelectorAll('.st-lim').length, inside: (() => { const h = document.getElementById('hIso').getBoundingClientRect(), b = c.getBoundingClientRect(); return b.left >= h.left - 1 && b.right <= h.right + 1 && b.top >= h.top - 1 && b.bottom <= h.bottom + 1; })(), focus: document.activeElement && document.activeElement.classList.contains('st-x'), modal } : { modal }; }, );
    ok('SA1', !!R.label && R.label.startsWith('R07/08 ' + side + ' aisle · point 2 of 4'), `${side}: trend card ${JSON.stringify(R)}`);
    ok('SA1', !!R.now && at.v != null && Math.abs(parseFloat(R.now) - +at.v) < 0.051, `${side}: card shows ${R.now}, station reads ${at.v}`);
    ok('SA1', R.pen >= 40 && R.lim === (side === 'cold' ? 2 : 0) && R.inside && R.focus, `${side}: pen points ${R.pen}, limit lines ${R.lim}, inside the stage ${R.inside}, focus on close ${R.focus}`);
    ok('SA1', R.modal === 0, `${side}: a station click also opened ${R.modal} modal(s)`);
    await sp.keyboard.press('Escape'); await wait(200);
    ok('SA1', await sp.evaluate(() => !document.querySelector('#hIso .dh-sttrend')), `${side}: Escape left the trend card open`);
  }
  /* away from a station the click is still the floor's: a rack opens its HMI */
  await lensTo(sp, 'status');
  const rk = await sp.evaluate(() => { const b = document.querySelector('#hIso [data-idx="30"]').getBoundingClientRect(); return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }; });
  await sp.mouse.click(rk.x, rk.y); await wait(900);
  ok('SA1', await sp.evaluate(() => !document.querySelector('#hIso .dh-sttrend')), 'Status lens: a click opened a station trend');
  ok('AV0', sp.errors.length === 0, `station trend page errors: ${sp.errors.slice(0, 2).join(' | ')}`);
  await sp.close();
}
/* A8f — the phone floor: the 2D plan stacks in bands and grows down the page, so a rack and a cell are tappable sizes */
{
  const ph = await open(390);
  const F = await ph.evaluate(() => { const st = document.getElementById('hIso').getBoundingClientRect(), q = (s) => [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect());
    const rk = q('#hIso [data-idx]'), cl = q('#hIso .crah-cell'), zi = document.getElementById('hIso').closest('.svg-zi');
    return { bands: +(document.querySelector('#hIso .fp-root') || { getAttribute: () => 0 }).getAttribute('data-bands'),
      rack: Math.min(...rk.map((b) => Math.min(b.width, b.height))), cell: Math.min(...cl.map((b) => Math.min(b.width, b.height))), nr: rk.length, nc: cl.length,
      out: cl.filter((b) => b.right > st.right + 0.5 || b.left < st.left - 0.5).length + rk.filter((b) => b.right > st.right + 0.5 || b.left < st.left - 0.5).length,
      sx: document.documentElement.scrollWidth - innerWidth, clip: zi ? zi.scrollHeight - zi.clientHeight : 0,
      tags: [...document.querySelectorAll('#hIso .zone')].map((z) => z.getBoundingClientRect().height) }; });
  F.rack = Number(F.rack) || 0; F.cell = Number(F.cell) || 0;
  ok('PF1', F.nr === 440 && F.rack >= 7, `390: rack short side ${F.rack.toFixed(1)} px (want >= 7; was 3.5) over ${F.nr} racks`);
  ok('PF1', F.nc > 140 && F.cell >= 12, `390: fan-wall / CDU cell short side ${F.cell.toFixed(1)} px (want >= 12)`);
  ok('PF2', F.sx === 0 && F.out === 0, `390: page scrollX ${F.sx}, ${F.out} units past the stage edge (bands ${F.bands})`);
  ok('PF2', F.clip <= 1, `390: the stage scroller hides ${F.clip} px of the floor (the plan must grow down the page)`);
  await lensTo(ph, 'thermal');
  const th = await ph.evaluate(() => [...document.querySelectorAll('#hIso .zone')].map((z) => z.getBoundingClientRect().height));
  ok('PF2', th.length === 10 && Math.max(...th) <= Math.min(...th) + 1 && Math.max(...th) < 40, `390 Thermal: row tag heights ${JSON.stringify(th.map((h) => h | 0))} (one line each)`);
  ok('AV0', ph.errors.length === 0, `390 page errors: ${ph.errors.slice(0, 2).join(' | ')}`);
  await ph.close();
}
await browser.close(); srv.close();
console.log(`${fails.length ? 'FAIL' : 'PASS'} — DC AI air side, valves and four points per aisle (A8a-A8f): ${checks - fails.length}/${checks}`);
fails.forEach((f) => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
