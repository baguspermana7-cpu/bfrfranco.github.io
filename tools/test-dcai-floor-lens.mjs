#!/usr/bin/env node
/* PRD-DCAI-HALL-DEPTH Amendment 7 (phase A6a) — each lens draws what it is about.
   FL1 Cooling draws the TCS headers + a supply and return branch per row pair; no other lens draws a pipe; only Thermal
       draws stations
   FL2 Thermal stations = row pairs x 2 aisles x SENS_PTS; each data-v = the page's C/H{z}{s}t reading; cold dots follow
       the lens thresholds (warn > 27, alarm > 30 degC)
   FL3 pipe dash period = RZConvVfx.dashSeconds(cduLoad / 100) +-5 %; reduced motion: 0 running animations in .fp-ovl
   FL4 row tags speak the lens: Thermal degC (station means), Cooling L/min (hall TCS flow / pairs), Status kW
   FL5 three hall chips in Thermal and Cooling, none in Status, numbers = __hallIsoGeo
   FL6 Power: one busway bar per row pair, length ratio = buswayPct / 100 +-2 %, no state attribute
   FL7 0 page errors; chips beside the floor (never over it) and clear of each other; datahall.html (Conventional) draws no .fp-ovl
   Red on 4a1b15c33: no overlay exists. */
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

const closeHmi = async (pg) => { await pg.keyboard.press('Escape'); await wait(600); };
const shownModal = (pg) => pg.evaluate(() => { const m = document.querySelector('.dh-modal-host.show'); return m ? { cls: m.className.split(' ')[0], text: m.textContent.replace(/\s+/g, ' ').slice(0, 200) } : null; });
const ringOn = (pg, ref) => pg.evaluate((ref) => {
  const ring = document.querySelector('#hIso .fp-ring-sel'), u = document.querySelector('#hIso [data-rz-equipment="' + ref + '"]');
  if (!ring || !u) return { ring: !!ring, unit: !!u };
  const shown = ring.getAttribute('display') !== 'none' && ring.getClientRects().length > 0;
  const a = ring.getBoundingClientRect(), b = u.getBoundingClientRect(), cx = a.left + a.width / 2, cy = a.top + a.height / 2;   /* the ring's centre inside the unit: in 3D the ring is the top face, above the unit's box centre */
  const cs = getComputedStyle(ring), root = ring.closest('.fp-root'), ink = root && getComputedStyle(root).getPropertyValue('--fp-ink').trim();
  const probe = document.createElement('span'); probe.style.color = ink; document.body.appendChild(probe); const inkRgb = getComputedStyle(probe).color; probe.remove();
  return { shown, around: shown && cx >= b.left - 1 && cx <= b.right + 1 && cy >= b.top - 1 && cy <= b.bottom + 1, stroke: cs.stroke, ink: inkRgb, w: parseFloat(cs.strokeWidth) };
}, ref);
const clickUnit = async (pg, ref) => {
  const pt = await pg.evaluate((ref) => { const e = document.querySelector('#hIso [data-rz-equipment="' + ref + '"]'); if (!e) return null; e.scrollIntoView({ block: 'center' });
    const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, ref);
  if (!pt) return false; await pg.mouse.click(pt.x, pt.y); await wait(800); return true;
};
const press = (pg, sel) => pg.evaluate((sel) => { const b = document.querySelector(sel); if (b) b.click(); return !!b; }, sel);
const UNITS = [['cdu:7', 'cdu-hmi'], ['crah:03', 'crah-hmi'], ['rack-unit:R03-05', 'rack-modal']];



const lensTo = async (pg, l) => { await pg.evaluate((l) => document.querySelector('#p-hall [data-lens="' + l + '"]').click(), l); await wait(900); };
const viewTo = async (pg, v) => { await pg.evaluate((v) => { const b = [...document.querySelectorAll('#p-hall button')].find((x) => x.textContent.trim().toLowerCase() === v); if (b) b.click(); }, v); await wait(1600); };
const read = (pg) => pg.evaluate(() => {
  const root = document.querySelector('#hIso'), stage = root.getBoundingClientRect(), vis = (e) => { if (!e.getClientRects().length) return false; for (let n = e; n && n !== root; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
  const pipes = [...root.querySelectorAll('.ovl-pipe')].filter(vis).map((p) => ({ kind: p.getAttribute('data-kind'), z: p.getAttribute('data-z'), dur: getComputedStyle(p).animationDuration, name: getComputedStyle(p).animationName }));
  const st = [...root.querySelectorAll('.ovl-st')].filter(vis).map((c) => ({ z: +c.getAttribute('data-z'), s: +c.getAttribute('data-s'), side: c.getAttribute('data-side'), v: +c.getAttribute('data-v'), state: c.getAttribute('data-state') || '' }));
  const bars = [...root.querySelectorAll('.ovl-bw')].filter(vis).map((b) => { const t = b.parentNode.querySelector('.ovl-bw-track'); const L = (e) => { const r = e.getBBox(); return Math.max(r.width, r.height); }; return { ratio: t ? L(b) / L(t) : -1, state: b.getAttribute('data-state') }; });
  const tags = [...root.querySelectorAll('.zone .zf-kw')].map((t) => t.textContent.trim());
  const cut = [...root.querySelectorAll('.zone')].filter((t) => getComputedStyle(t).visibility !== 'hidden').filter((t) => { const r = t.getBoundingClientRect(); return r.width && (r.right > stage.right + 1 || r.left < stage.left - 1); }).length;
  const chips = [...document.querySelectorAll('#hIsoWrap .dh-hallchip')].filter((c) => c.getClientRects().length && getComputedStyle(c).display !== 'none').map((c) => { const r = c.getBoundingClientRect(); return { t: c.textContent, l: r.left, r: r.right, top: r.top, b: r.bottom }; });
  const anims = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.fp-ovl')).length;
  const rd = {}; document.querySelectorAll('[id^="C"],[id^="H"]').forEach((e) => { if (/^[CH]\d+\d+t$/.test(e.id)) rd[e.id] = parseFloat(e.textContent); });
  const g = window.__hallIsoGeo;
  return { pipes, st, bars, tags, cut, chips, stage: { l: stage.left, r: stage.right, t: stage.top, b: stage.bottom }, anims, rd, g: { sp: g.sp, rows: g.rows, cduLoad: g.cduLoad, cduLpm: g.cduLpm, cduRun: g.cduRun, cduInst: g.cduInst, crahAct: g.crahAct, crahInst: g.crahInst, crahFan: g.crahFan, crahAir: g.crahAir, cduPump: g.cduPump, busway: g.buswayPct, tcs: [window.DHE && DHE.tcsSupply, window.DHE && DHE.tcsReturn] },
    dash: window.RZConvVfx ? window.RZConvVfx.dashSeconds(g.cduLoad / 100) : null };
});
const n1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const nums = (t) => (t.replace(/,/g, '').match(/\d+(\.\d+)?/g) || []).map(Number);

for (const [W, views] of [[1440, ['2d', '3d']], [390, ['2d']]]) {
  const pg = await open(W);
  for (const v of views) {
    await viewTo(pg, v);
    const tag = `@${W} ${v}`;
    const L = {};
    for (const l of ['status', 'thermal', 'cooling', 'power', 'layout']) { await lensTo(pg, l); L[l] = await read(pg); }
    const g = L.status.g, pairs = g.rows / 2;
    /* FL1 */
    const cp = L.cooling.pipes, br = cp.filter((p) => p.kind === 'branch'), hd = cp.filter((p) => p.kind === 'header');
    ok('FL1', hd.length >= 2 && br.length >= 2 * pairs && new Set(br.map((p) => p.z)).size === pairs, `${tag} cooling pipes: ${hd.length} headers, ${br.length} branches over ${new Set(br.map((p) => p.z)).size} of ${pairs} pairs`);
    for (const l of ['status', 'thermal', 'power', 'layout']) ok('FL1', L[l].pipes.length === 0, `${tag} ${l} draws ${L[l].pipes.length} pipes`);
    for (const l of ['status', 'cooling', 'power', 'layout']) ok('FL1', L[l].st.length === 0, `${tag} ${l} draws ${L[l].st.length} stations`);
    /* FL2 */
    const S = L.thermal.st;
    ok('FL2', S.length === pairs * 2 * g.sp, `${tag} thermal stations ${S.length}, want ${pairs * 2 * g.sp}`);
    const bad = S.filter((x) => { const id = (x.side === 'cold' ? 'C' : 'H') + x.z + x.s + 't', want = L.thermal.rd[id]; return !(isFinite(want) && Math.abs(x.v - want) <= 0.05); });
    ok('FL2', S.length && bad.length === 0, `${tag} ${bad.length} stations differ from their reading: ${JSON.stringify(bad.slice(0, 2))}`);
    const badS = S.filter((x) => x.side === 'cold' && x.state !== (x.v > 30 ? 'alarm' : x.v > 27 ? 'warn' : 'ok'));
    ok('FL2', badS.length === 0, `${tag} ${badS.length} cold stations with the wrong state: ${JSON.stringify(badS.slice(0, 2))}`);
    /* FL3 */
    const want = L.cooling.dash, durs = [...new Set(cp.map((p) => parseFloat(p.dur)))];
    ok('FL3', want > 0 && cp.length && durs.every((d) => Math.abs(d - want) <= want * 0.05), `${tag} pipe periods ${JSON.stringify(durs)} s, engine ${want} s`);
    /* FL4 */
    const stMean = (z, side) => { const a = []; for (let s = 0; s < g.sp; s++) { const x = L.thermal.rd[(side === 'cold' ? 'C' : 'H') + z + s + 't']; if (isFinite(x)) a.push(x); } return a.reduce((p, q) => p + q, 0) / a.length; };
    const tt = L.thermal.tags, tc = L.cooling.tags, ts = L.status.tags;
    ok('FL4', tt.length === pairs && tt.every((t, z) => /°C/.test(t) && nums(t)[0] === +n1(stMean(z, 'cold')) && nums(t)[1] === +n1(stMean(z, 'hot'))), `${tag} thermal tags ${JSON.stringify(tt.slice(0, 2))}, want ${n1(stMean(0, 'cold'))} / ${n1(stMean(0, 'hot'))} °C`);
    const pairLpm = g.cduLpm * g.cduRun / pairs;
    ok('FL4', tc.length === pairs && tc.every((t) => /L\/min/.test(t) && Math.abs(nums(t)[0] - pairLpm) <= 1), `${tag} cooling tags ${JSON.stringify(tc.slice(0, 2))}, want ${Math.round(pairLpm)} L/min`);
    ok('FL4', ts.every((t) => /kW|MW/.test(t)), `${tag} status tags ${JSON.stringify(ts.slice(0, 2))}`);
    for (const l of ['status', 'thermal', 'cooling']) ok('FL7', L[l].cut === 0, `${tag} ${l}: ${L[l].cut} row tags cut by the stage edge`);
    /* FL5 */
    for (const l of ['thermal', 'cooling']) {
      const c = L[l].chips, txt = c.map((x) => x.t).join(' | ');
      ok('FL5', c.length === 3, `${tag} ${l} chips ${c.length}: ${txt}`);
      const need = [n1(g.crahFan), Math.round(g.crahAir).toLocaleString('en-US'), String(g.cduRun), n1(g.cduPump), n1(g.tcs[0]), n1(g.tcs[1])];
      const fw = c.filter((x) => /^FW-/.test(x.t)).map((x) => +((/(\d+) run/.exec(x.t) || [])[1]));
      ok('FL5', fw.length === 2 && fw[0] + fw[1] === g.crahAct, `${tag} ${l} fan-wall run counts ${JSON.stringify(fw)} sum to ${g.crahAct}`);
      const miss = need.filter((x) => !txt.replace(/ /g, '').includes(x));
      ok('FL5', miss.length === 0, `${tag} ${l} chips miss ${JSON.stringify(miss)}: ${txt}`);
      const inS = c.filter((x) => x.l < L[l].stage.r - 1 && x.r > L[l].stage.l + 1 && x.top < L[l].stage.b - 1 && x.b > L[l].stage.t + 1);
      ok('FL7', inS.length === 0, `${tag} ${l} ${inS.length} chips laid over the floor`);
      let ov = 0; for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) if (c[i].l < c[j].r && c[j].l < c[i].r && c[i].top < c[j].b && c[j].top < c[i].b) ov++;
      ok('FL7', ov === 0, `${tag} ${l} ${ov} chip overlaps`);
      if (W >= 1000) ok('FL7', c.every((x) => x.l >= L[l].stage.r && x.top < L[l].stage.b), `${tag} ${l} chips not in the column beside the floor: ${JSON.stringify(c.map((x) => [Math.round(x.l), Math.round(x.top)]))}`);
    }
    ok('FL5', L.status.chips.length === 0 && L.power.chips.length === 0, `${tag} status/power chips ${L.status.chips.length}/${L.power.chips.length}`);
    /* FL6 */
    const B = L.power.bars;
    ok('FL6', B.length === pairs && B.every((b) => Math.abs(b.ratio - g.busway / 100) <= 0.02 && !b.state), `${tag} power bars ${B.length}, ratios ${JSON.stringify(B.slice(0, 2))}, want ${g.busway / 100}`);
    for (const l of ['status', 'thermal', 'cooling', 'layout']) ok('FL6', L[l].bars.length === 0, `${tag} ${l} draws ${L[l].bars.length} busway bars`);
  }
  /* FL3 reduced motion */
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await lensTo(pg, 'status'); await lensTo(pg, 'cooling');
  const rm = await read(pg);
  ok('FL3', rm.pipes.length > 0 && rm.anims === 0, `@${W} reduced motion: ${rm.anims} running animations over ${rm.pipes.length} pipes`);
  if (SHOTS) { await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]); for (const v of (W < 500 ? ['2d'] : ['2d', '3d'])) { await viewTo(pg, v); for (const l of ['thermal', 'cooling', 'power']) { await lensTo(pg, l); await pg.screenshot({ path: `${SHOTS}/fl-${W}-${v}-${l}.png` }); } } }
  await lensTo(pg, 'status');
  ok('FL7', pg.errors.length === 0, `@${W} page errors: ${pg.errors.slice(0, 2).join(' | ')}`);
  await pg.close();
}
{
  const pg = await browser.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  await pg.goto(ORIGIN + 'datahall.html', { waitUntil: 'networkidle2', timeout: 90000 }); await wait(1500);
  const r = await pg.evaluate(() => ({ fp: document.querySelectorAll('.fp-root').length, ovl: document.querySelectorAll('.fp-ovl').length }));
  ok('FL7', r.fp > 0 && r.ovl === 0, `datahall.html: ${r.fp} floors, ${r.ovl} overlays`);
  await pg.close();
}
await browser.close(); srv.close();
console.log(`${fails.length ? 'FAIL' : 'PASS'} — DC AI floor lenses (A6a): ${checks - fails.length}/${checks}`);
fails.forEach((f) => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
