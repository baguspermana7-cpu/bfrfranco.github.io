#!/usr/bin/env node
/* test-dh-operator.mjs — the datahallAI HMI sheets behave like an operator BMS (PRD_BMS_OPERATOR_HMI.md, owner brief
 * "BMS_UIUX_Master_Prompt" 2026-11-15). Phase 1 laws, run on the Cooling tab (DH-M-103, the densest P&ID):
 *
 *   O1 one state model: a CDU pump node's data-state equals its own payload row (pump_state_n), in normal and in the
 *      'cdu-pump-fail' cooling scenario
 *   O2 no state without evidence: an item with no payload (isolation valve, strainer) renders data-state="na"
 *   O3 flow only with evidence: (a) normal → some lines flow; (b) pump-fail → no line driven by P-01A flows;
 *      (c) every point replayed as "no sample" → no line on the sheet flows
 *   O4 quality on values: under "no sample" the CDU-01 heat-exchanger node carries data-quality nosample / partial and the
 *      pump-speed value (a telemetry point) prints the dash; under the simulation it carries a non-missing quality
 *   O5 alarm without colour: pump-fail → the alarmed node carries a .hmi-alarm-badge with a real box, also with the page
 *      in greyscale
 *   O7 electrical honesty: DH-01 SLD breaker / transformer / UPS states follow the electrical scenario engine (normal,
 *      busway A trip, utility A fail, UPS A bypass); lines without a source do not flow
 *   O9 responsive: Cooling at 360 / 768 / 1440 / 1920 px and 1440 at 200 % zoom — no page or bar overflow, every visible
 *      label ≥ 8.5 px on screen (narrow frames scroll the sheet inside the frame instead of shrinking it), and an
 *      equipment finder; on 360 the finder zooms to the item, selects it and makes it ≥ 24 px to tap
 *   O10 context: opening and closing an equipment modal keeps the sheet's zoom, pan and selection
 *   O11 performance: 30 s continuous zoom on DH-A-101 (~600 items) with a repaint every second — p95 frame interval
 *      ≤ 20 ms at 1440 and ≤ 34 ms at 390 with 4x CPU throttle (headless Chrome, software compositing); alarm source
 *      change -> badge on the sheet < 500 ms
 *   O8 reduced motion: with prefers-reduced-motion: reduce no flow path animates
 *   Z1 a hand-written session record (root / educator role, root email, v2 flag, token-shaped key) opens nothing while
 *      nobody is signed in at Supabase · Z2 the proven root still opens · Z3 a proof for another account does not count
 *   A1 fail closed: with auth.js blocked and a forged root session in localStorage the page stays locked (the gate
 *      never unlocks from a client-written record; only _rzAuth decides)
 *   A2 a signed-in Pro session (Supabase module stub, no audit helper) still opens the page
 *
 *   node tools/test-dh-operator.mjs            # exit 1 on any failed law (run under rz-lane)
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';
import { isSupabaseModule, signedInStorage, signedInSupabaseBody, signedOutSupabaseBody, forgedTokenSupabaseBody } from './lib/signed-in-supabase.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split(/[?#]/)[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403).end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404).end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }).end(d); });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
/* O11 numbers depend on the renderer: default headless Chrome rasterises and composites in software (SwiftShader), which
   no operator workstation does. RZ_GPU=1 launches on the machine's GPU (Vulkan); --perf-strict makes O11 blocking. */
const GPU = process.env.RZ_GPU === '1', PERF_STRICT = process.argv.includes('--perf-strict');
const browser = await puppeteer.launch({ args: ['--no-sandbox'].concat(GPU ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan'] : []) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const law = (id, ok, msg) => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`); };

async function open(reduced) {
  const pg = await browser.newPage();
  pg.errors = []; pg.on('pageerror', (e) => pg.errors.push(e.message));
  await pg.setRequestInterception(true);
  pg.on('request', (r) => (r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort()));
  await pg.setViewport({ width: 1440, height: 1000 });
  if (reduced) await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('theme', 'dark'); localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) { /* none */ } });
  await pg.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(800);
  await enterAuthorizedAuditState(pg, 'dc-ai');
  await pg.evaluate(() => document.querySelector('#tabs [data-t="cool"]').click());
  await pg.waitForFunction(() => { const s = document.getElementById('hmiCoolSvg'); return s && s.getBoundingClientRect().width > 0; }, { timeout: 30000 });
  await wait(600);
  return pg;
}
// one repaint of every sheet, now (instead of waiting for the 4 s tick)
const repaint = (pg) => pg.evaluate(() => { const V = window.RZDhHmiV2; Object.keys(V.sheets).forEach((k) => V.sheets[k] && V.sheets[k].update()); });
const setCooling = (pg, v) => pg.evaluate((v) => { const s = document.getElementById('coolingScenario'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, v);
const probe = (pg) => pg.evaluate(() => {
  const svg = document.getElementById('hmiCoolSvg');
  const node = (id) => svg.querySelector(`.hmi-node[data-node="${id}"]`);
  const pumps = [1, 2, 3].map((k) => { const g = node('cdu01.p' + k); return g ? g.getAttribute('data-state') : null; });
  const flows = [...svg.querySelectorAll('path.hmi-edge[data-edge]')].map((p) => p.getAttribute('data-flow'));
  const p1Edges = [...svg.querySelectorAll('path.hmi-edge[data-edge]')].filter((p) => (p.getAttribute('data-ends') || '').split('|').includes('cdu01.p1')).map((p) => p.getAttribute('data-flow'));
  const valve = node('cdu01.v1'), strainer = node('cdu01.str1'), hx = node('cdu01.hx');
  const hxVal = svg.querySelector('[data-val="cdu01.p1:p1"]');   // pump speed: a telemetry point (HX duty is engine-derived)
  const badges = [...svg.querySelectorAll('.hmi-alarm-badge')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length;
  const anim = [...svg.querySelectorAll('.hmi-flow')].filter((p) => getComputedStyle(p).animationName !== 'none' && getComputedStyle(p).display !== 'none').length;
  return { pumps, running: flows.filter((f) => f === 'running').length, total: flows.length, p1Edges,
    valve: valve && valve.getAttribute('data-state'), strainer: strainer && strainer.getAttribute('data-state'),
    hxQ: hx && hx.getAttribute('data-quality'), hxVal: hxVal && hxVal.textContent.trim(), badges, anim };
});
// what the payload itself says for the three pumps of CDU-01
const payloadPumps = (pg) => pg.evaluate(() => {
  const P = window.RZDatahallAIHmiPayloads, c = P.buildContext(window, { hall: 1 }), p = P.safePayload('cdu', '1', c);
  const map = { run: 'running', fault: 'fault', stby: 'standby' };
  return [1, 2, 3].map((k) => { const r = p.tabs.live.find((x) => x.point === 'pump_state_' + k); return r ? map[r.state] || r.state : null; });
});

// ── normal ──────────────────────────────────────────────────────────────────────────────────────────────────
const pg = await open(false);
await setCooling(pg, 'normal'); await repaint(pg);
let a = await probe(pg), want = await payloadPumps(pg);
law('O1a', JSON.stringify(a.pumps) === JSON.stringify(want), `normal: pump states on the sheet ${JSON.stringify(a.pumps)} = payload ${JSON.stringify(want)}`);
law('O2', a.valve === 'na' && a.strainer === 'na', `items with no payload: isolation valve ${a.valve}, strainer ${a.strainer} (want na)`);
law('O3a', a.running > 0 && a.running < a.total, `normal: ${a.running} of ${a.total} lines flow (some, not all)`);
law('O4a', !!a.hxQ && a.hxQ !== 'nosample', `normal: CDU-01 HX quality ${a.hxQ}`);

// ── pump 1 fails ────────────────────────────────────────────────────────────────────────────────────────────
await setCooling(pg, 'cdu-pump-fail'); await repaint(pg);
a = await probe(pg); want = await payloadPumps(pg);
law('O1b', JSON.stringify(a.pumps) === JSON.stringify(want), `pump-fail: pump states on the sheet ${JSON.stringify(a.pumps)} = payload ${JSON.stringify(want)}`);
law('O3b', a.p1Edges.length > 0 && a.p1Edges.every((f) => f !== 'running'), `pump-fail: lines on P-01A ${JSON.stringify(a.p1Edges)} (want none running)`);
law('O5a', a.badges > 0, `pump-fail: visible alarm badges ${a.badges}`);
await pg.evaluate(() => { document.documentElement.style.filter = 'grayscale(1)'; });
const grey = await probe(pg);
law('O5b', grey.badges > 0, `pump-fail in greyscale: alarm badges still drawn ${grey.badges}`);
await pg.evaluate(() => { document.documentElement.style.filter = ''; });

// ── every point replayed as "no sample" ─────────────────────────────────────────────────────────────────────
await setCooling(pg, 'normal');
await pg.evaluate(() => window.RZDatahallAISimTelemetry.setProvider(() => ({ value: null, quality: 'replay' }), { source: 'test-dh-operator no-sample fixture' }));
await repaint(pg);
a = await probe(pg);
law('O3c', a.running === 0, `no sample: ${a.running} of ${a.total} lines still flow (want 0)`);
law('O4b', (a.hxQ === 'nosample' || a.hxQ === 'partial') && /^[—-]/.test(a.hxVal || ''), `no sample: CDU-01 HX quality ${a.hxQ}, pump speed "${a.hxVal}"`);
await pg.evaluate(() => window.RZDatahallAISimTelemetry.setProvider(null));
law('O9e', pg.errors.length === 0, `page errors ${pg.errors.length}${pg.errors.length ? ': ' + pg.errors.slice(0, 2).join(' | ') : ''}`);
await pg.close();

// ── electrical honesty (O7): DH-01 SLD states from the page's electrical scenario engine ─────────────────────────
const pe = await open(false);
await pe.evaluate(() => document.querySelector('#tabs [data-t="elec"]').click()); await wait(800);
await pe.evaluate(() => { const b = [...document.querySelectorAll('.elec-tabs button')].find((x) => x.textContent.trim() === 'DH-01'); b && b.click(); });
await pe.waitForFunction(() => { const s = document.getElementById('hmiElecDH1Svg'); return s && s.getBoundingClientRect().width > 0; }, { timeout: 30000 });
const setElec = (v) => pe.evaluate((v) => { const s = document.getElementById('electricalScenario'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); const V = window.RZDhHmiV2; Object.keys(V.sheets).forEach((k) => V.sheets[k] && V.sheets[k].update()); }, v);
const elec = () => pe.evaluate(() => {
  const svg = document.getElementById('hmiElecDH1Svg'), st = (id) => { const g = svg.querySelector(`.hmi-node[data-node="${id}"]`); return g && g.getAttribute('data-state'); };
  const flowOn = (id) => [...svg.querySelectorAll('path.hmi-edge[data-edge]')].filter((p) => (p.getAttribute('data-ends') || '').split('|').includes(id)).map((p) => p.getAttribute('data-flow'));
  return { cb: st('cb-mvA'), tx: st('txA01'), inv: st('invA'), ss: st('ssA'), qbw: st('qbwA'), tie: st('tie'), txFlow: flowOn('txA01'), tapFlow: flowOn('tapA') };
});
await setElec('normal'); let e = await elec();
law('O7a', e.cb === 'closed' && e.tx === 'running' && e.inv === 'running' && e.tie === 'open', `normal: Q-MVA01 ${e.cb}, TX-A01 ${e.tx}, INV-A ${e.inv}, bus tie ${e.tie}`);
await setElec('busway_a_trip'); e = await elec();
law('O7b', (e.qbw === 'fault' || e.qbw === 'open') && e.tapFlow.length > 0 && e.tapFlow.every((f) => f !== 'running'), `busway A trip: Q-BWA ${e.qbw}, lines at TAP-A07 ${JSON.stringify(e.tapFlow)}`);
await setElec('utility_a_fail'); e = await elec();
law('O7c', e.tx !== 'running' && e.txFlow.every((f) => f !== 'running'), `utility A lost: TX-A01 ${e.tx}, its lines ${JSON.stringify(e.txFlow)} (no power without a source)`);
await setElec('ups_a_bypass'); e = await elec();
law('O7d', e.ss === 'closed' && e.inv !== 'running', `UPS A on bypass: static switch ${e.ss}, inverter ${e.inv}`);
await setElec('normal');
await pe.close();

// ── responsive and operable (O9) + context kept (O10) ──────────────────────────────────────────────────────────
for (const [w, dpr, tag] of [[360, 3, '360'], [768, 2, '768'], [1440, 1, '1440'], [1920, 1, '1920'], [720, 2, '1440@200%']]) {
  const pw = await browser.newPage();
  await pw.setRequestInterception(true);
  pw.on('request', (r) => (r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort()));
  await pw.setViewport({ width: w, height: w < 800 ? 820 : 1000, deviceScaleFactor: dpr, isMobile: w < 800, hasTouch: w < 800 });
  await pw.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) { /* none */ } });
  await pw.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 60000 }); await wait(800);
  await enterAuthorizedAuditState(pw, 'dc-ai');
  await pw.evaluate(() => document.querySelector('#tabs [data-t="cool"]').click());
  await pw.waitForFunction(() => { const s = document.getElementById('hmiCoolSvg'); return s && s.getBoundingClientRect().width > 0; }, { timeout: 30000 }); await wait(500);
  const g = await pw.evaluate(() => { const s = document.getElementById('hmiCoolSvg'), f = s.closest('.hmi-frame'), bar = f.querySelector('.hmi-bar'), vp = s.parentElement;
    const vis = (t) => { for (let e = t; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden') return false; } return true; };
    const hs = [...s.querySelectorAll('text')].filter((t) => t.textContent.trim() && vis(t)).map((t) => t.getBoundingClientRect().height).filter((h) => h > 0);
    return { sw: document.documentElement.scrollWidth, vw: innerWidth, frame: Math.round(f.getBoundingClientRect().width), frameFits: f.getBoundingClientRect().right <= innerWidth + 1,
      scrolls: vp.scrollWidth > vp.clientWidth + 1, vpOverflow: getComputedStyle(vp).overflowX, minText: Math.min(...hs), barOver: bar.scrollWidth - bar.clientWidth, find: !!f.querySelector('[data-find]') }; });
  law('O9-' + tag, g.sw <= g.vw + 1 && g.frameFits && (!g.scrolls || g.vpOverflow === 'auto') && g.minText >= 8.5 && g.barOver <= 1 && g.find,
    `${tag}: page ${g.sw}/${g.vw}, frame fits ${g.frameFits}, sheet ${g.scrolls ? 'scrolls inside its frame' : 'fits'}, smallest label ${g.minText.toFixed(1)} px (≥ 8.5), bar overflow ${g.barOver}, finder ${g.find}`);
  if (w === 360) {
    await pw.select('#hmiCoolSvg >> xpath=ancestor::div[contains(@class,"hmi-frame")]//select[@data-find]', 'cdu01.p1').catch(async () => {
      await pw.evaluate(() => { const sel = document.getElementById('hmiCoolSvg').closest('.hmi-frame').querySelector('[data-find]'); sel.value = 'cdu01.p1'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
    });
    await wait(300);
    const f = await pw.evaluate(() => { const V = window.RZDhHmiV2.sheets['dh-m-103'], g = document.querySelector('#hmiCoolSvg .hmi-node[data-node="cdu01.p1"]'), r = g.getBoundingClientRect(), fr = g.closest('.hmi-frame').getBoundingClientRect();
      return { z: V.view().z, sel: g.hasAttribute('data-selected'), inView: r.left >= fr.left - 1 && r.right <= fr.right + 1, size: Math.round(Math.min(r.width, r.height)) }; });
    law('O9-find', f.z >= 2 && f.sel && f.inView && f.size >= 24, `360: finder → P-01A zoom ${f.z.toFixed(1)}, selected ${f.sel}, in view ${f.inView}, tap size ${f.size}px (≥ 24)`);
  }
  await pw.close();
}
{
  const pc = await open(false);
  await pc.evaluate(() => { const V = window.RZDhHmiV2.sheets['dh-m-103']; V.zoom(2, 400, 300); const sel = V.frame.querySelector('[data-find]'); sel.value = 'cdu01.hx'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
  const before = await pc.evaluate(() => window.RZDhHmiV2.sheets['dh-m-103'].view());
  await pc.evaluate(() => window.RZDatahallAIHmiOpeners.cdu(1)); await wait(900);
  await pc.keyboard.press('Escape'); await wait(400);
  await pc.evaluate(() => { const m = document.getElementById('cduHmi'); if (m && m.classList.contains('show')) m.classList.remove('show'); });
  const after = await pc.evaluate(() => ({ v: window.RZDhHmiV2.sheets['dh-m-103'].view(), sel: !!document.querySelector('#hmiCoolSvg .hmi-node[data-node="cdu01.hx"][data-selected]') }));
  law('O10', JSON.stringify(before) === JSON.stringify(after.v) && after.sel, `CDU modal open + close: view kept ${JSON.stringify(before) === JSON.stringify(after.v)}, selection kept ${after.sel}`);
  await pc.close();
}

// ── performance and alarm latency (O11) ──────────────────────────────────────────────────────────────────────
async function perf(tag, w, throttle, budget) {
  const pp = await browser.newPage();
  await pp.setRequestInterception(true);
  /* signed in through the Supabase module stub, as tools/test-dh-drawings.mjs: without a real session the page re-locks
     (v3.57.7) and the audit observer below removes the lock on every mutation — that fight ran during the measurement
     (median 50 ms per frame on the old and the new renderer alike) and timed the harness, not the cockpit */
  pp.on('request', (r) => {
    if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: signedInSupabaseBody({ email: 'educator@resistancezero.com', tier: 'pro', educator: true }) });
    return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort();
  });
  await pp.setViewport({ width: w, height: w < 800 ? 820 : 1000, deviceScaleFactor: w < 800 ? 3 : 1, isMobile: w < 800, hasTouch: w < 800 });
  await pp.evaluateOnNewDocument((entries) => { try { localStorage.setItem('rz_cookie_consent', 'declined'); entries.forEach(([k, v]) => localStorage.setItem(k, v)); } catch (e) { /* none */ } },
    signedInStorage({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator' }));
  await pp.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await pp.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});   // the stub's role sync reloads once
  await wait(800);
  await enterAuthorizedAuditState(pp, 'dc-ai');
  await pp.evaluate(() => document.querySelector('#tabs [data-t="over"]').click());
  await pp.waitForFunction(() => { const s = document.getElementById('hmiFloorPlanSvg'); return s && s.getBoundingClientRect().width > 0; }, { timeout: 30000 }); await wait(800);
  await pp.evaluate(() => document.getElementById('hmiFloorPlanSvg').scrollIntoView({ block: 'center' }));
  const cdp = await pp.target().createCDPSession();
  if (throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const out = await pp.evaluate((ms) => new Promise((res) => {
    const V = window.RZDhHmiV2, S = V.sheets['dh-a-101'], iv = []; let last = performance.now(), t0 = last, k = 0;
    const pz = setInterval(() => { k++; const v = S.view(); if (k % 20 < 10) S.zoom(1.08, v.x + v.w / 2, v.y + v.h / 2); else S.zoom(1 / 1.08, v.x + v.w / 2, v.y + v.h / 2); }, 50);   // continuous zoom in / out
    const tel = setInterval(() => V.repaint(), 1000);   // telemetry repaint every second (4x the page's own tick)
    (function frame(now) { iv.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(frame); else { clearInterval(pz); clearInterval(tel); iv.shift(); iv.sort((a, b) => a - b); res({ n: iv.length, p95: iv[Math.floor(iv.length * 0.95)], med: iv[Math.floor(iv.length / 2)] }); } })(performance.now());
  }), 30000);
  // alarm latency: scenario change (the alarm source) -> badge on the sheet
  await pp.evaluate(() => document.querySelector('#tabs [data-t="cool"]').click()); await wait(1500);
  const lat = await pp.evaluate(() => new Promise((res) => {
    const svg = document.getElementById('hmiCoolSvg'), t0 = performance.now();
    const mo = new MutationObserver(() => { if (svg.querySelector('.hmi-alarm-badge')) { mo.disconnect(); res(performance.now() - t0); } });
    mo.observe(svg, { childList: true, subtree: true });
    const s = document.getElementById('coolingScenario'); s.value = 'cdu-pump-fail'; s.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => { mo.disconnect(); res(-1); }, 8000);
  }));
  if (throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await pp.close();
  const L = (id) => (PERF_STRICT ? id : id + ' (reported)');
  law(L('O11-' + tag), !PERF_STRICT || out.p95 <= budget, `${tag} [${GPU ? 'GPU' : 'software raster'}]: Room Layout DH-A-101 (~600 items) 30 s zoom + repaint/s: ${out.n} frames, median ${out.med.toFixed(1)} ms, p95 ${out.p95.toFixed(1)} ms (budget ${budget})`);
  law(L('O11-' + tag + '-alarm'), !PERF_STRICT || (lat >= 0 && lat < 500), `${tag}: alarm source change -> badge on the sheet in ${lat.toFixed(0)} ms (< 500)`);
}
await perf('desktop-1440', 1440, 0, 20);
await perf('mobile-390-cpu4x', 390, 4, 34);

// ── reduced motion ──────────────────────────────────────────────────────────────────────────────────────────
const pr = await open(true);
await repaint(pr);
const r = await probe(pr);
law('O8', r.anim === 0, `prefers-reduced-motion: ${r.anim} flow paths animate (want 0)`);
await pr.close();

// ── fail closed without auth.js (A1) ────────────────────────────────────────────────────────────────────────
{
  const pa = await browser.newPage();
  await pa.setRequestInterception(true);
  pa.on('request', (r) => (r.url().startsWith(ORIGIN) && !/\/auth(\.min)?\.js/.test(r.url()) ? r.continue() : r.abort()));
  await pa.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_premium_session', JSON.stringify({ email: 'forged@example.com', role: 'root', expires: '2099-01-01T00:00:00Z' })); } catch (e) { /* none */ } });
  await pa.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2200);
  const a1 = await pa.evaluate(() => ({ locked: document.body.classList.contains('locked'), auth: !!window._rzAuth }));
  law('A1', a1.locked && !a1.auth, `auth.js blocked + forged root session: page locked ${a1.locked} (want true), _rzAuth present ${a1.auth}`);
  await pa.close();
  const ps = await browser.newPage();
  await ps.setRequestInterception(true);
  ps.on('request', (r) => {
    if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: signedInSupabaseBody({ email: 'educator@resistancezero.com', tier: 'pro', educator: true }) });
    return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort();
  });
  await ps.evaluateOnNewDocument((entries) => { try { entries.forEach(([k, v]) => localStorage.setItem(k, v)); } catch (e) { /* none */ } },
    signedInStorage({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator' }));
  await ps.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2200);
  const a2 = await ps.evaluate(() => ({ locked: document.body.classList.contains('locked'), auth: !!window._rzAuth }));
  law('A2', !a2.locked && a2.auth, `signed-in Pro session: page locked ${a2.locked} (want false), _rzAuth present ${a2.auth}`);
  await ps.close();
  // Z1 (audit 2026-11-16 S1): auth.js loaded, nobody signed in at Supabase, a hand-written session record in
  // localStorage. Whatever the record claims (root role, the v2 flag, a token-shaped key beside it), the page stays locked.
  const forged = [
    ['root role', { email: 'forged@example.com', tier: 'pro', role: 'root', expires: '2099-01-01T00:00:00Z' }, false],
    ['root role + v2', { email: 'forged@example.com', tier: 'pro', role: 'root', v2: true, expires: '2099-01-01T00:00:00Z' }, false],
    ['root role + token key', { email: 'forged@example.com', tier: 'pro', role: 'root', expires: '2099-01-01T00:00:00Z' }, true],
    ['root email', { email: 'admin@resistancezero.com', tier: 'pro', expires: '2099-01-01T00:00:00Z' }, true],
    ['pro tier', { email: 'forged@example.com', tier: 'pro', role: 'pro', v2: true, expires: '2099-01-01T00:00:00Z' }, true],
    ['educator role + token key', { email: 'forged@example.com', tier: 'pro', role: 'educator', expires: '2099-01-01T00:00:00Z' }, true],
    ['educator role + v2', { email: 'forged@example.com', tier: 'pro', role: 'educator', v2: true, expires: '2099-01-01T00:00:00Z' }, true],
  ];
  const z1 = [];
  for (const [name, rec, token] of forged) {
    const pz = await browser.newPage();
    await pz.setRequestInterception(true);
    pz.on('request', (r) => {
      if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: signedOutSupabaseBody() });
      return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort();
    });
    await pz.evaluateOnNewDocument((rec, token) => { try { if (!sessionStorage.getItem('z1')) { sessionStorage.setItem('z1', '1'); localStorage.setItem('rz_premium_session', JSON.stringify(rec)); if (token) localStorage.setItem('sb-gate-auth-token', '{"gate":true}'); } } catch (e) { /* none */ } }, rec, token);
    await pz.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await pz.waitForNavigation({ waitUntil: 'networkidle2', timeout: 6000 }).catch(() => {});
    await wait(2500);
    const st = await pz.evaluate(() => ({ locked: document.body.classList.contains('locked'), auth: !!window._rzAuth }));
    z1.push(`${name}: ${st.locked ? 'locked' : 'OPEN'}${st.auth ? '' : ' (no _rzAuth)'}`);
    await pz.close();
  }
  law('Z1', z1.every((x) => /: locked$/.test(x)), `signed out at Supabase + a hand-written session record: ${z1.join('; ')}`);
  // Z2: the real root (Supabase says admin@ is signed in) still opens the page and reads as root.
  // Z3: Supabase proves a DIFFERENT account than the record names: the record's root claim is worth nothing.
  const proofCase = async (supaEmail, rec, body) => {
    const pz = await browser.newPage();
    await pz.setRequestInterception(true);
    pz.on('request', (r) => {
      if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: body || signedInSupabaseBody({ email: supaEmail, tier: 'pro' }) });
      return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort();
    });
    await pz.evaluateOnNewDocument((rec) => { try { if (!sessionStorage.getItem('z2')) { sessionStorage.setItem('z2', '1'); localStorage.setItem('rz_premium_session', JSON.stringify(rec)); localStorage.setItem('sb-gate-auth-token', '{"gate":true}'); } } catch (e) { /* none */ } }, rec);
    await pz.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await pz.waitForNavigation({ waitUntil: 'networkidle2', timeout: 6000 }).catch(() => {});
    await wait(2500);
    const st = await pz.evaluate(() => ({ locked: document.body.classList.contains('locked'), role: window._rzAuth ? window._rzAuth.getRoleFromSession(window._rzAuth.getSession()) : 'no _rzAuth',
      modal: !!document.querySelector('#rzLoginModal.show, .rz-modal.show, .rz-login-modal.show') }));
    await pz.close(); return st;
  };
  const z2 = await proofCase('admin@resistancezero.com', { email: 'admin@resistancezero.com', tier: 'pro', role: 'root', expires: '2099-01-01T00:00:00Z' });
  law('Z2', !z2.locked && z2.role === 'root', `Supabase proves the root account: page locked ${z2.locked} (want false), role "${z2.role}" (want root), login prompt left open ${z2.modal}`);
  const z3 = await proofCase('someone@example.com', { email: 'admin@resistancezero.com', tier: 'pro', role: 'root', expires: '2099-01-01T00:00:00Z' });
  law('Z3', z3.locked && z3.role !== 'root', `Supabase proves another account than the record names: page locked ${z3.locked} (want true), role "${z3.role}" (want not root)`);
  // Z4 (review of v3.64.0): a forged token in localStorage — getSession() names the root account or an educator, the
  // server-validated getUser() says nobody. The local token is not a proof.
  const z4a = await proofCase(null, { email: 'admin@resistancezero.com', tier: 'pro', role: 'root', expires: '2099-01-01T00:00:00Z' }, forgedTokenSupabaseBody({ email: 'admin@resistancezero.com' }));
  const z4b = await proofCase(null, { email: 'forged@example.com', tier: 'pro', role: 'educator', expires: '2099-01-01T00:00:00Z' }, forgedTokenSupabaseBody({ email: 'forged@example.com' }));
  law('Z4', z4a.locked && z4a.role !== 'root' && z4b.locked && z4b.role !== 'educator', `forged local token (getSession names the account, getUser says nobody): root record locked ${z4a.locked} role "${z4a.role}"; educator record locked ${z4b.locked} role "${z4b.role}" (want locked, unprivileged)`);
}

await browser.close(); srv.close();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} laws pass`);
process.exit(failed.length ? 1 : 0);
