#!/usr/bin/env node
/* PRD-DCAI-HALL-DEPTH Amendment 10 (owner 2026-11-27 "Hampir nggak ada perubahan signifikan yg page datahall dan room
   layout") — the Data Hall and the Room Layout show the hall operating at rest, with no click.
   VR1 1440, fresh storage: the floor opens on Thermal and prints >= 80 readings, each = its station's value
   VR2 1440: supply air, return air, fan, CHW valve on both fan-wall galleries and TCS, pump, FWS valve on the CDU line
       are text on the floor, each = the adapter's engine number (1 decimal)
   VR3 a cold aisle takes its worst point's state: a planted 28.0 °C inlet turns that pair's cold aisle warn
   VR4 390: one printed reading per row pair (the warmest inlet), no two printed readings overlap
   VR5 Room Layout building overview at 1440: drawn at 1.0x (no legibility upscale), no sideways scroll; title inside the
       box and every label >= 8.5 px at every width (a phone pans; without a minimum width a phone drew 6 px labels)
   VR6 DH-A-101: zone tags do not overlap, CDU-zone tags lie a row south of the rack-zone tags (the CDU line is south of
       the row ends), standby CDUs + fan-wall modules drawn standby = engine counts, the support strip inside the sheet
   VR7 0 page errors
   VR8 (v3.116.1) each operating line sits on a plate that contains it
   VR9 (v3.116.1) the Thermal key names the cold and hot aisle tints; the Status key does not
   Red on 103c514ad: Status lens at rest, 0 printed readings, no operating text, 1.12x building, Z01 over Z05. */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { isSupabaseModule, signedInStorage, signedInSupabaseBody } from './lib/signed-in-supabase.mjs';
import { enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = (process.argv.find((a) => a.startsWith('--shots=')) || '').split('=')[1];
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
const ok = (id, c, m) => { checks++; if (!c) fails.push(id + ' ' + m); };
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
const lensTo = async (pg, l) => { await pg.evaluate((l) => { const b = document.querySelector('#p-hall [data-lens="' + l + '"]'); if (b) b.click(); }, l); await wait(900); };
const viewTo = async (pg, v) => { await pg.evaluate((v) => { const b = document.querySelector('#p-hall .dh-proj [data-view="' + v + '"]') || [...document.querySelectorAll('#p-hall button')].find((x) => x.textContent.trim().toLowerCase() === v); if (b) b.click(); }, v); await wait(1600); };
const f1 = (v) => (v == null || !isFinite(v) ? '—' : (+v).toFixed(1));

/* ---- Data Hall floor ---- */
for (const W of [1440, 390]) {
  const pg = await open(W);
  const r = await pg.evaluate(() => {
    const host = document.getElementById('hIso'), vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    const txt = [...host.querySelectorAll('.fp-ovl .ovl-stv')].filter((t) => t.textContent.trim() && vis(t));
    const bad = txt.filter((t) => { const c = host.querySelector(`.fp-ovl .ovl-st[data-side="${t.dataset.side}"][data-z="${t.dataset.z}"][data-s="${t.dataset.s}"]`); return !c || (+c.dataset.v).toFixed(1) !== t.textContent.trim(); });
    const rects = txt.map((t) => t.getBoundingClientRect()); let ov = 0;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) ov++; }
    const ops = {}; host.querySelectorAll('.fp-ovl .ovl-ops').forEach((t) => { if (vis(t)) ops[t.dataset.ops] = t.textContent; });
    const pairs = new Set(txt.map((t) => t.dataset.z));
    return { lens: host.getAttribute('data-lens-on'), n: txt.length, bad: bad.length, ov, ops, pairs: pairs.size, g: window.__hallIsoGeo };
  });
  if (W === 1440) {
    ok('VR1', r.lens === 'thermal', `lens at rest ${r.lens} (want thermal)`);
    ok('VR1', r.n >= 80, `${r.n} printed readings (want >= 80)`);
    ok('VR1', r.bad === 0 && r.n > 0, `${r.bad} printed readings differ from their station`);
    const g = r.g || {}, air = [f1(g.supplyC), f1(g.returnC), f1(g.crahFan), f1(g.crahValve)];
    for (const k of ['fw-n', 'fw-s']) ok('VR2', r.ops[k] && air.every((v) => r.ops[k].includes(v)), `${k} line "${r.ops[k] || '(none)'}" lacks one of SA/RA/fan/valve ${air.join(' ')}`);
    const run = ['fw-n', 'fw-s'].map((k) => +((/(\d+) run/.exec(r.ops[k] || '') || [])[1]));
    ok('VR2', run[0] + run[1] === g.crahAct, `fan-wall run counts ${run.join(' + ')} vs ${g.crahAct} running`);
    const liq = [f1(g.tcsSupC), f1(g.tcsRetC), f1(g.cduPump), f1(g.cduValve)];
    ok('VR2', r.ops.cdu && liq.every((v) => r.ops.cdu.includes(v)), `cdu line "${r.ops.cdu || '(none)'}" lacks one of TCS/pump/valve ${liq.join(' ')}`);
    /* VR8 (v3.116.1): each operating line sits on its own plate; VR9 the Thermal key names the aisle tints, Status does not */
    const P = await pg.evaluate(() => [...document.querySelectorAll('#hIso .fp-ovl .ovl-ops')].map((t) => { const b = t.getBoundingClientRect(), bg = t.previousElementSibling, r = bg && bg.classList.contains('ovl-opsbg') ? bg.getBoundingClientRect() : null; return r && r.left <= b.left && r.right >= b.right && r.top <= b.top && r.bottom >= b.bottom; }));
    ok('VR8', P.length === 3 && P.every(Boolean), `operating-line plates ${JSON.stringify(P)}`);
    const aisleKey = () => pg.evaluate(() => [...document.querySelectorAll('#hIsoWrap .dh-aisle-sw')].filter((e) => e.getClientRects().length).length);
    ok('VR9', (await aisleKey()) === 2, `Thermal key aisle items ${await aisleKey()} (want 2)`);
    await lensTo(pg, 'status'); ok('VR9', (await aisleKey()) === 0, `Status key aisle items ${await aisleKey()} (want 0)`);
    await lensTo(pg, 'thermal');
    /* VR3: plant a warm inlet */
    const s = await pg.evaluate(() => {
      const el = document.getElementById('C' + 3 + 1 + 't'); if (!el) return { err: 'no C31t' };
      el.textContent = '28.0'; document.dispatchEvent(new CustomEvent('rz-hall-readings'));
      const a = document.querySelector('#hIso .fp-ovl .ovl-aisle[data-side="cold"][data-z="3"]'), o = document.querySelector('#hIso .fp-ovl .ovl-aisle[data-side="cold"][data-z="4"]');
      return { a: a && a.getAttribute('data-state'), o: o && o.getAttribute('data-state'), t: (document.querySelector('#hIso .fp-ovl .ovl-stv[data-side="cold"][data-z="3"][data-s="1"]') || {}).textContent };
    });
    ok('VR3', !s.err && s.a === 'warn' && s.o === 'ok', `planted 28.0 at R07/08 point 2: aisle ${s.a}, neighbour ${s.o} ${s.err || ''}`);
    ok('VR3', s.t === '28.0', `planted point prints "${s.t}"`);
    if (SHOTS) await pg.screenshot({ path: `${SHOTS}/vr-1440-warm.png` });
  } else {
    ok('VR4', r.n === r.pairs && r.pairs === (r.g ? r.g.rows / 2 : 10), `390: ${r.n} printed readings over ${r.pairs} pairs (want one per pair)`);
    ok('VR4', r.ov === 0, `390: ${r.ov} overlapping printed readings`);
  }
  if (W === 1440) ok('VR1', r.ov === 0, `1440: ${r.ov} overlapping printed readings`);
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/vr-${W}-hall.png` });
  /* ---- Room Layout ---- */
  await pg.evaluate(() => { const b = document.querySelector('#tabs [data-t="over"]') || [...document.querySelectorAll('#tabs [data-t]')].find((x) => /room|layout/i.test(x.textContent)); if (b) b.click(); });
  await wait(2500);
  const L = await pg.evaluate(() => {
    const svg = document.getElementById('bldgSvg'); if (!svg) return { err: 'no #bldgSvg' };
    const box = svg.parentElement, sb = svg.getBoundingClientRect(), pb = box.getBoundingClientRect();
    const vb = svg.viewBox.baseVal, scale = sb.width / pb.width;
    const title = [...svg.querySelectorAll('text')].sort((a, b) => a.getBBox().y - b.getBBox().y)[0];
    const tb = title ? title.getBBox() : null;
    const sheet = document.getElementById('hmiFloorPlanSvg'); let tags = [], sup = null, sh = null;
    if (sheet) {
      tags = [...sheet.querySelectorAll('text')].filter((t) => /^Z\d\d\b/.test(t.textContent.trim())).map((t) => { const b = t.getBoundingClientRect(); return { t: t.textContent.trim(), l: b.left, r: b.right, tp: b.top, b: b.bottom }; });
      const s = [...sheet.querySelectorAll('text')].filter((t) => /SUPPORT/i.test(t.textContent)).map((t) => t.getBoundingClientRect());
      sup = s.length ? { l: Math.min(...s.map((b) => b.left)), r: Math.max(...s.map((b) => b.right)) } : null;
      const p = sheet.parentElement.getBoundingClientRect(); sh = { l: p.left, r: p.right };
    }
    let ov = []; for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) { const a = tags[i], b = tags[j]; if (a.l < b.r && b.l < a.r && a.tp < b.b && b.tp < a.b) ov.push(a.t + '/' + b.t); }
    const e = window.DCAI_CALC.snapshot.equipment, wantSt = (e.cdu_installed_per_hall - e.cdu_duty_per_hall) + (e.crah_installed_per_hall - e.crah_duty_per_hall);
    const nSt = sheet ? sheet.querySelectorAll('.hmi-node[data-state="standby"]').length : 0;
    const ty = (re) => tags.filter((t) => re.test(t.t)).map((t) => (t.tp + t.b) / 2);
    const minH = Math.min(...[...svg.querySelectorAll('text')].filter((t) => t.textContent.trim()).map((t) => t.getBoundingClientRect().height).filter((h) => h > 0));
    return { minH, wantSt, nSt, cduY: ty(/^Z0[1-4]/), rackY: ty(/^Z0[5-8]/), scale, scrollW: box.scrollWidth, clientW: box.clientWidth, tb: tb && { x: tb.x, y: tb.y, w: tb.width }, vb: { x: vb.x, y: vb.y, w: vb.width }, title: title && title.textContent, ov, nt: tags.length, sup, sh };
  });
  if (L.err) ok('VR5', false, L.err);
  else {
    /* a phone keeps the 8.5 px legibility floor, so it pans; the desktop pane holds the whole building */
    if (W >= 1000) {
      ok('VR5', L.scale <= 1.01, `${W}: building drawn at ${L.scale.toFixed(2)}x its box`);
      ok('VR5', L.scrollW <= L.clientW + 1, `${W}: building box scrolls sideways ${L.scrollW} > ${L.clientW}`);
    }
    ok('VR5', L.minH >= 8.5, `${W}: smallest building label ${L.minH.toFixed(1)} px (floor 8.5)`);
    ok('VR5', L.tb && L.tb.x >= L.vb.x && L.tb.x + L.tb.w <= L.vb.x + L.vb.w && L.tb.y >= L.vb.y, `${W}: title "${L.title}" outside the viewBox`);
    if (W === 1440) {
      ok('VR6', L.nt >= 8 && L.ov.length === 0, `DH-A-101: ${L.nt} zone tags, overlaps ${L.ov.slice(0, 4).join(' ')}`);
      /* the CDU line lies south of the row ends: its zone tags (Z01-Z04) below the rack zones' (Z05-Z08), a clear row apart */
      ok('VR6', L.cduY.length === 4 && L.rackY.length === 4 && Math.min(...L.cduY) - Math.max(...L.rackY) >= 20, `DH-A-101 CDU-zone tags y ${L.cduY.map(Math.round)} not a row south of rack-zone tags y ${L.rackY.map(Math.round)}`);
      ok('VR6', L.nSt === L.wantSt && L.wantSt > 0, `DH-A-101 ${L.nSt} units drawn standby, engine ${L.wantSt}`);
      ok('VR6', L.sup && L.sh && L.sup.r <= L.sh.r + 1 && L.sup.l >= L.sh.l - 1, `DH-A-101 support strip ${JSON.stringify(L.sup)} outside sheet box ${JSON.stringify(L.sh)}`);
    }
  }
  if (SHOTS) { for (const id of ['bldgSvg', 'hmiFloorPlanSvg']) { const el = await pg.$('#' + id); if (el) await el.screenshot({ path: `${SHOTS}/vr-${W}-${id}.png` }).catch(() => {}); } }
  ok('VR7', pg.errors.length === 0, `${W}: page errors ${pg.errors.slice(0, 2).join(' | ')}`);
  await pg.close();
}
await browser.close(); srv.close();
if (fails.length) { console.log(`DC AI VISIBLE AT REST — ${checks - fails.length}/${checks}, ${fails.length} FAILED`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`PASS DC AI visible at rest — ${checks} checks (VR1-VR9)`);
