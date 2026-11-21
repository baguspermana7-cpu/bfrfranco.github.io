#!/usr/bin/env node
/* test-dh-vfx.mjs — STRICT. PRD-DCAI-LIVING-PLANT phase A1: the four Cooling & Piping sheets of datahallAI.html
   (DH-M-101 overview, DH-M-102 heat rejection, DH-M-103 CDU line, DH-M-104 TCS rows) carry the shared state grammar
   of js/conv/vfx.js (RZConvVfx — the one table both cockpits use, PRD-CONV-LIVING-PLANT §4.1). Owner C8: "animasi saat
   running jangan abu-abu semua … bisa hijau, orange atau merah tergantung kondisi; alur dan animasinya tampak hidup".
   In a real browser, signed in, dark theme:
   V0 bar      every cooling sheet has the view bar: State · Medium · Flat, Thermal only where TCS temperatures exist;
               State is the default view
   V1 binding  a) every process line the sheet gives a flow state carries data-vstate, signal / tap lines carry none;
                  a node with no state claim (na) carries none
               b) not grey: in State view a running line is painted the running colour; DH-M-104 (TCS rows, no pump of
                  its own) reads its flow from the CDU line — >= 90 % of its lines running in the normal scenario
               c) motion = measurement: every running line's dashes move, their period = dashSeconds(ratio) with ratio =
                  the driving pump's published speed / nominal (CDU 1450 rpm, HTW VFD 50 Hz); a running pump's rotor
                  turns at rotorSeconds(speed %); a stopped / standby line has no moving dashes; a standby pump's
                  branch reads standby (charged, solid), not stopped
               d) perturbation: the "CDU pump 1 failure" scenario stops that pump's rotor and the dashes on its
                  discharge line; back to normal, both move again
   V2 second   every non-running, non-standby state carries a dash pattern (reads without colour); running and standby
      signal   are solid; the legend lists the states
   V3 motion   a) prefers-reduced-motion: 0 running animations on the sheets' flow paths and rotors, the state colours
      budget      remain;  b) a sheet scrolled off screen pauses its animations
   V4 thermal  Thermal view paints a TCS supply line RZConvVfx.thermal(p07) and a TCS return line thermal(p08) on the
               declared range [p05 HTW supply, p08 TCS return]; Flat view paints a running line the stopped grey
   V5 page     0 page errors; at 390 px the bar does not push the page sideways
   Usage: node tools/test-dh-vfx.mjs [--shots=<dir>] */
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
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SHEETS = ['dh-m-101', 'dh-m-102', 'dh-m-103', 'dh-m-104'];

async function open(vp, reduce) {
  const pg = await browser.newPage();
  pg.errors = []; pg.on('pageerror', (e) => pg.errors.push(e.message));
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: signedInSupabaseBody({ email: 'educator@resistancezero.com', tier: 'pro', educator: true }) });
    return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort();
  });
  await pg.setViewport(vp);
  if (reduce) await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg.evaluateOnNewDocument((entries) => {
    try { localStorage.setItem('theme', 'dark'); localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.removeItem('rz_conv_vfx_mode'); entries.forEach(([k, v]) => localStorage.setItem(k, v)); } catch (x) { /* no storage */ }
  }, signedInStorage({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator' }));
  await pg.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 90000 });
  await pg.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
  await wait(800);
  await enterAuthorizedAuditState(pg, 'dc-ai');
  await pg.evaluate(() => { const b = document.querySelector('#tabs [data-t="cool"]'); if (b) b.click(); });
  await wait(3500);
  return pg;
}
const setScenario = (pg, v) => pg.evaluate(async (v) => {
  const cs = document.getElementById('coolingScenario'); if (!cs) return false;
  cs.value = v; cs.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 900)); return true;
}, v);

/* one in-page probe of every sheet: states, colours, motion */
const PROBE = (SHEETS) => {
  const V = window.RZConvVfx, P = window.RZDatahallAIHmiPayloads, out = { V: !!V, sheets: {} };
  const css = (host, v) => { const i = document.createElement('i'); i.style.color = 'var(' + v + ')'; host.appendChild(i); const c = getComputedStyle(i).color; i.remove(); return c; };
  const c = P && P.buildContext ? P.buildContext(window, { hall: 1, noTrend: true }) : null;
  const rowVal = (cls, id, re) => { try { const p = P.safePayload(cls, id, c); let v = null; Object.values(p.tabs || {}).forEach((rs) => (Array.isArray(rs) ? rs : []).forEach((r) => { if (v == null && re.test(r.point || '') && typeof r.value === 'number') v = r.value; })); return v; } catch (e) { return null; } };
  SHEETS.forEach((id) => {
    const host = document.querySelector('.hmi-host[data-hmi-sheet="' + id + '"]'); if (!host) { out.sheets[id] = null; return; }
    const frame = host.querySelector('.hmi-frame'), svg = host.querySelector('svg.hmi-svg');
    const s = { bar: !!(frame && frame.querySelector('.vfx-bar')), modes: frame ? [...frame.querySelectorAll('[data-vfx-set]')].map((b) => b.getAttribute('data-vfx-set')) : [], mode: frame && frame.getAttribute('data-vfx-mode'),
      legend: frame ? [...frame.querySelectorAll('.vfx-lg[data-vstate]')].map((x) => x.getAttribute('data-vstate')) : [],
      run: css(host, '--vfx-run'), stop: css(host, '--vfx-stop'), lines: 0, untagged: [], naTagged: [], nodeNa: [], vs: {}, flow: {}, runCol: 0, runWrong: [], moveBad: [], stillMove: [], dashBad: [], tcs: [], hasTcs: false };
    svg.querySelectorAll('path.hmi-edge[data-edge]:not(.hmi-flow):not(.hmi-edge-shadow):not(.hmi-edge-hi)').forEach((p) => {
      const f = p.getAttribute('data-flow'), vs = p.getAttribute('data-vstate'), eid = p.getAttribute('data-edge'), cs = getComputedStyle(p);
      s.flow[f] = (s.flow[f] || 0) + 1; if (vs) s.vs[vs] = (s.vs[vs] || 0) + 1;
      if (/\bm-tcs_[sr]\b/.test(p.getAttribute('class'))) s.hasTcs = true;
      if (f === 'na') { if (vs) s.naTagged.push(eid); return; }
      s.lines++;
      if (!vs) { s.untagged.push(eid); return; }
      if (vs === 'running') { if (cs.stroke === s.run) s.runCol++; else s.runWrong.push(eid + ' ' + cs.stroke); }
      const dash = cs.strokeDasharray;
      if (/^(stopped|warning|alarm|mismatch|unavailable)$/.test(vs) && (!dash || dash === 'none')) s.dashBad.push(eid + ':' + vs);
      if (/^(running|standby)$/.test(vs) && dash && dash !== 'none') s.dashBad.push(eid + ':' + vs + ' dashed ' + dash);
      const fl = svg.querySelector('path[data-edge-flow="' + eid + '"]');
      if (fl) {
        const an = fl.getAnimations ? fl.getAnimations().filter((a) => a.playState === 'running') : [];
        if (f === 'running') {
          const ratio = parseFloat(fl.getAttribute('data-vfx-ratio')), want = V ? V.dashSeconds(isFinite(ratio) ? ratio : NaN) : null, dur = parseFloat(getComputedStyle(fl).animationDuration);
          if (!fl.hasAttribute('data-vmove') || getComputedStyle(fl).display === 'none') s.moveBad.push(eid + ' no move');
          else if (!isFinite(ratio) || want == null || Math.abs(dur - want) > 0.002) s.moveBad.push(eid + ' dur ' + dur + ' want ' + want + ' ratio ' + ratio);
        } else if (an.length && getComputedStyle(fl).display !== 'none') s.stillMove.push(eid + ':' + f);
      }
      if (/\bm-tcs_[sr]\b/.test(p.getAttribute('class')) && vs === 'running' && s.tcs.length < 4) s.tcs.push({ id: eid, sup: /m-tcs_s/.test(p.getAttribute('class')) });
    });
    s.nodeNa = [...svg.querySelectorAll('.hmi-node[data-state="na"][data-vstate]')].map((g) => g.getAttribute('data-node'));
    /* rotors: CDU pumps (pump_rpm / 1450) and the HTW station (vfd_hz / 50) */
    s.rotors = [...svg.querySelectorAll('.hmi-node[data-sym^="pump"]')].map((g) => {
      const r = g.querySelector('.vfx-rotor'), st = g.getAttribute('data-state'), eq = g.getAttribute('data-rz-equipment') || '', id = g.getAttribute('data-node');
      let pct = null; const m = /^cdu:(\d+)/.exec(eq);
      if (/^cdu\d+\.p\d$/.test(id) && st === 'running') { const v = rowVal('cdu', String(Number((/^cdu(\d+)/.exec(id) || [])[1])), /^pump_rpm$/); pct = v == null ? null : v / 1450 * 100; }
      else if (/^(p-htw|ov-pfws)$/.test(id) && st === 'running') { const v = rowVal('fws-pump-station', 'dh01', /^vfd_hz$/); pct = v == null ? null : v / 50 * 100; }
      const dur = r ? parseFloat(getComputedStyle(r).animationDuration) : NaN;
      return { id, st, has: !!r, spin: !!(r && r.hasAttribute('data-spin')), dur, want: pct == null || !V ? null : V.rotorSeconds(pct), m: !!m };
    });
    out.sheets[id] = s;
  });
  try { const pl = window.DCAI_CALC.snapshot.design.planes; out.planes = [pl.p05_htw_supply_c, pl.p07_tcs_supply_c, pl.p08_tcs_return_c]; } catch (e) { out.planes = null; }
  out.over = document.documentElement.scrollWidth > innerWidth + 1;
  return out;
};

/* ── 1440, normal scenario ─────────────────────────────────────────────────────────────────────────────────────── */
let pg = await open({ width: 1440, height: 1000 });
await setScenario(pg, 'normal'); await wait(4500);
let R = await pg.evaluate(PROBE, SHEETS);
ok(R.V, 'V0 window.RZConvVfx not loaded on datahallAI.html');
for (const id of SHEETS) {
  const s = R.sheets[id];
  if (!s) { ok(false, `${id}: sheet not drawn`); continue; }
  ok(s.bar, `V0 ${id}: no view bar`);
  ok(['state', 'medium', 'flat'].every((m) => s.modes.includes(m)), `V0 ${id}: modes ${s.modes.join(',')}`);
  ok(s.modes.includes('thermal') === s.hasTcs, `V0 ${id}: Thermal offered=${s.modes.includes('thermal')} but TCS lines=${s.hasTcs}`);
  ok(s.mode === 'state', `V0 ${id}: default view ${s.mode}, want state`);
  ok(['running', 'warning', 'alarm', 'standby', 'stopped', 'unavailable'].every((v) => s.legend.includes(v)), `V2 ${id}: legend ${s.legend.join(',')}`);
  ok(!s.untagged.length, `V1a ${id}: ${s.untagged.length} process lines without data-vstate (${s.untagged.slice(0, 4).join(', ')})`);
  ok(!s.naTagged.length, `V1a ${id}: signal lines carry a state (${s.naTagged.slice(0, 4).join(', ')})`);
  ok(!s.nodeNa.length, `V1a ${id}: nodes with no state claim carry a vstate (${s.nodeNa.slice(0, 4).join(', ')})`);
  ok(s.runCol > 0 && !s.runWrong.length, `V1b ${id}: running painted ${s.runCol}, wrong ${s.runWrong.slice(0, 3).join(' | ')}`);
  ok(!s.moveBad.length, `V1c ${id}: ${s.moveBad.length} running lines not moving at their measured speed (${s.moveBad.slice(0, 3).join(' | ')})`);
  ok(!s.stillMove.length, `V1c ${id}: non-running lines still move (${s.stillMove.slice(0, 4).join(', ')})`);
  ok(!s.dashBad.length, `V2 ${id}: second signal wrong (${s.dashBad.slice(0, 4).join(', ')})`);
  for (const r of s.rotors) {
    if (r.st === 'running') {
      ok(r.has && r.spin, `V1c ${id} ${r.id}: running pump rotor not turning`);
      if (r.want != null) ok(Math.abs(r.dur - r.want) <= Math.max(0.06, r.want * 0.06), `V1c ${id} ${r.id}: rotor ${r.dur}s, want ${r.want}s from published speed`);
    } else ok(!r.spin, `V1c ${id} ${r.id}: ${r.st} pump rotor turns`);
  }
}
{ const s = R.sheets['dh-m-104']; if (s) ok((s.vs.running || 0) >= 0.9 * s.lines, `V1b dh-m-104: ${s.vs.running || 0}/${s.lines} lines running — the TCS rows read grey/no-data (${JSON.stringify(s.vs)})`); }
{ const s = R.sheets['dh-m-103']; if (s) ok((s.vs.standby || 0) > 0 && !(s.vs.stopped), `V1c dh-m-103: standby pump branches should read standby, got ${JSON.stringify(s.vs)}`); }
if (SHOTS) { await pg.evaluate(() => { const h = document.querySelector('.hmi-host[data-hmi-sheet="dh-m-103"]'); if (h) h.scrollIntoView(); }); await wait(500); await pg.screenshot({ path: path.join(SHOTS, 'dh-vfx-103-state-1440.png') }); }

/* V1d perturbation: CDU pump 1 failure */
await setScenario(pg, 'cdu-pump-fail'); await wait(4500);
const F = await pg.evaluate(() => {
  const svg = document.querySelector('.hmi-host[data-hmi-sheet="dh-m-103"] svg.hmi-svg'); if (!svg) return null;
  const S = window.RZDatahallAISheets, snap = window.DCAI_CALC.snapshot, sheet = S.build('dh-m-103', snap);
  const out = { failed: [] };
  svg.querySelectorAll('.hmi-node[data-sym^="pump"]').forEach((g) => {
    const st = g.getAttribute('data-state'); if (st !== 'fault' && st !== 'stopped') return;
    const id = g.getAttribute('data-node'), r = g.querySelector('.vfx-rotor');
    const disc = sheet.edges.filter((e) => e.flowOf === id).map((e) => { const f = svg.querySelector('path[data-edge-flow="' + e.id + '"]'); return { id: e.id, move: !!(f && f.hasAttribute('data-vmove') && getComputedStyle(f).display !== 'none') }; });
    out.failed.push({ id, st, vstate: g.getAttribute('data-vstate'), spin: !!(r && r.hasAttribute('data-spin')), disc });
  });
  return out;
});
ok(F && F.failed.length > 0, `V1d cdu-pump-fail: no failed pump on DH-M-103 (${JSON.stringify(F)})`);
for (const f of (F && F.failed) || []) {
  ok(!f.spin, `V1d ${f.id} (${f.st}): rotor still turns`);
  ok(f.vstate === 'alarm' || f.vstate === 'stopped', `V1d ${f.id}: vstate ${f.vstate}`);
  ok(f.disc.length && f.disc.every((d) => !d.move), `V1d ${f.id}: discharge line still moves ${JSON.stringify(f.disc)}`);
}
if (SHOTS) { await pg.screenshot({ path: path.join(SHOTS, 'dh-vfx-103-pumpfail-1440.png') }); }
await setScenario(pg, 'normal'); await wait(4500);
const B = await pg.evaluate((ids) => { const svg = document.querySelector('.hmi-host[data-hmi-sheet="dh-m-103"] svg.hmi-svg'); return ids.map((id) => { const g = svg.querySelector('.hmi-node[data-node="' + id + '"]'), r = g && g.querySelector('.vfx-rotor'); return { id, st: g && g.getAttribute('data-state'), spin: !!(r && r.hasAttribute('data-spin')) }; }); }, ((F && F.failed) || []).map((f) => f.id));
for (const b of B) if (b.st === 'running') ok(b.spin, `V1d ${b.id}: back to normal, rotor does not turn again`);

/* V4 thermal + flat */
const T = await pg.evaluate(() => {
  const V = window.RZConvVfx, pl = window.DCAI_CALC.snapshot.design.planes, host = document.querySelector('.hmi-host[data-hmi-sheet="dh-m-103"]');
  const frame = host.querySelector('.hmi-frame'), b = frame.querySelector('[data-vfx-set="thermal"]'); if (!b) return { noBtn: true };
  b.click();
  const want = (t) => V.thermal(t, pl.p05_htw_supply_c, pl.p08_tcs_return_c);
  const pick = (cls) => [...host.querySelectorAll('path.hmi-edge.' + cls + '[data-vstate="running"]:not(.hmi-flow):not(.hmi-edge-shadow):not(.hmi-edge-hi)')][0];
  const s = pick('m-tcs_s'), r = pick('m-tcs_r');
  const res = { sup: s && getComputedStyle(s).stroke, supWant: want(pl.p07_tcs_supply_c), ret: r && getComputedStyle(r).stroke, retWant: want(pl.p08_tcs_return_c) };
  frame.querySelector('[data-vfx-set="flat"]').click();
  const any = host.querySelector('path.hmi-edge[data-vstate="running"]:not(.hmi-flow):not(.hmi-edge-shadow):not(.hmi-edge-hi)');
  const i = document.createElement('i'); i.style.color = 'var(--vfx-stop)'; host.appendChild(i); res.stop = getComputedStyle(i).color; i.remove();
  res.flat = any && getComputedStyle(any).stroke;
  frame.querySelector('[data-vfx-set="state"]').click();
  return res;
});
ok(!T.noBtn, 'V4 dh-m-103: no Thermal button');
const norm = (c) => String(c || '').replace(/\s/g, '');
ok(T.sup && norm(T.sup) === norm(T.supWant), `V4 TCS supply thermal ${T.sup}, want ${T.supWant}`);
ok(T.ret && norm(T.ret) === norm(T.retWant), `V4 TCS return thermal ${T.ret}, want ${T.retWant}`);
ok(T.flat && T.flat === T.stop, `V4 Flat: running line ${T.flat}, want ${T.stop}`);

/* V3b off screen: DH-M-101 scrolled away pauses its motion */
const O = await pg.evaluate(async () => {
  const h = document.querySelector('.hmi-host[data-hmi-sheet="dh-m-104"]'); h.scrollIntoView({ block: 'end' }); window.scrollBy(0, 2000);
  await new Promise((r) => setTimeout(r, 900));
  const a = document.querySelector('.hmi-host[data-hmi-sheet="dh-m-101"]'), rc = a.getBoundingClientRect();
  const an = [...a.querySelectorAll('.hmi-flow, .vfx-rotor')].flatMap((e) => e.getAnimations()).map((x) => x.playState);
  return { off: rc.bottom < 0 || rc.top > innerHeight, n: an.length, running: an.filter((s) => s === 'running').length };
});
ok(O.off, `V3b DH-M-101 did not leave the viewport (test setup)`);
ok(O.n > 0 && O.running === 0, `V3b off screen: ${O.running}/${O.n} animations still running on DH-M-101`);
ok(!pg.errors.length, `V5 page errors 1440: ${pg.errors.slice(0, 3).join(' | ')}`);
await pg.close();

/* ── reduced motion ────────────────────────────────────────────────────────────────────────────────────────────── */
pg = await open({ width: 1440, height: 1000 }, true);
const RM = await pg.evaluate((ids) => {
  let n = 0, col = 0;
  ids.forEach((id) => { const h = document.querySelector('.hmi-host[data-hmi-sheet="' + id + '"]'); if (!h) return;
    h.querySelectorAll('.hmi-flow, .vfx-rotor').forEach((e) => { n += e.getAnimations().filter((a) => a.playState === 'running').length; });
    col += h.querySelectorAll('path.hmi-edge[data-vstate="running"]').length; });
  return { n, col };
}, SHEETS);
ok(RM.n === 0, `V3a reduced motion: ${RM.n} animations running`);
ok(RM.col > 0, `V3a reduced motion: state colours gone (${RM.col} running lines)`);
ok(!pg.errors.length, `V5 page errors reduced: ${pg.errors.slice(0, 3).join(' | ')}`);
await pg.close();

/* ── 390 ───────────────────────────────────────────────────────────────────────────────────────────────────────── */
pg = await open({ width: 390, height: 844, isMobile: true, hasTouch: true });
R = await pg.evaluate(PROBE, SHEETS);
ok(!R.over, 'V5 390: horizontal overflow');
ok(SHEETS.every((id) => R.sheets[id] && R.sheets[id].bar), 'V5 390: a sheet lost its view bar');
if (SHOTS) { await pg.evaluate(() => { const h = document.querySelector('.hmi-host[data-hmi-sheet="dh-m-103"]'); if (h) h.scrollIntoView(); }); await wait(500); await pg.screenshot({ path: path.join(SHOTS, 'dh-vfx-103-state-390.png') }); }
ok(!pg.errors.length, `V5 page errors 390: ${pg.errors.slice(0, 3).join(' | ')}`);
await pg.close();

await browser.close(); srv.close();
if (fails.length) { console.log(`test-dh-vfx: ${fails.length} FAIL of ${checks}`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`test-dh-vfx: ${checks} checks, 0 fail`);
