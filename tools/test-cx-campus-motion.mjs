#!/usr/bin/env node
// test-cx-campus-motion.mjs — K27 laws: the 3D plant moves the way the owner's reference video does (PRD v1.1 §2 Video B,
// §26 motion): one eased camera move per focus (350–600 ms, never a cut), neighbours fade instead of blinking, the
// exploded layers fan out one after another, a picked equipment family is lit with its callout and breadcrumb, and
// under prefers-reduced-motion every one of those is instant.
// Usage: node tools/test-cx-campus-motion.mjs [--base=http://…] [--root=dir]   (exit 1 on any failed law)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const m = process.argv.find((a) => a.startsWith('--' + k + '=')); return m ? m.split('=').slice(1).join('=') : d; };
const ROOT = resolve(arg('root', resolve(here, '..')));
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✘', n, d === undefined ? '' : JSON.stringify(d).slice(0, 400)); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null, base = arg('base', '');
if (!base) { const port = 8000 + Math.floor(Math.random() * 900) + 100; server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); base = 'http://127.0.0.1:' + port; await sleep(900); }
const puppeteer = require('puppeteer');
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'], protocolTimeout: 90000 });
async function open(reduce) {
  const page = await browser.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.setViewport({ width: 1440, height: 1000 });
  if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.removeItem('rz-cx-plan'); } catch (e) {} });
  await page.goto(base + '/cx-calculator.html?tab=analysis', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => document.getElementById('cxAnCampus').scrollIntoView({ block: 'center', behavior: 'instant' }));
  const st = await page.waitForFunction(() => document.getElementById('cxAnCampus').getAttribute('data-cx-3d'), { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => 'timeout');
  await sleep(1200);
  return { page, errs, st };
}
try {
  const { page, errs, st } = await open(false);
  ok('the 3D plant mounts with WebGL', st === 'ready', st);
  if (st === 'ready') {
    const hasMotion = await page.evaluate(() => typeof document.getElementById('cxAnCampus').__rzCampus.motion === 'function');
    ok('M0 the campus exposes its motion state (motion())', hasMotion);
    if (hasMotion) {
      // M1 one eased camera move, not a cut
      const m1 = await page.evaluate(() => { const a = document.getElementById('cxAnCampus').__rzCampus; const z0 = a.view().zoom; a.focus('hall'); const now = a.view(), mo = a.motion(); return { z0, zNow: now.zoom, atFocus: now.atFocus, moving: mo.camMoving, fading: mo.fading }; });
      ok('M1 focus starts a camera move: right after the click the camera is still where it was (not at the hall)', m1.moving && !m1.atFocus && Math.abs(m1.zNow - m1.z0) < 0.05, m1);
      ok('M2 the neighbours fade (fades in flight right after focus), they do not blink', m1.fading > 0, m1);
      // drive the ease frame by frame through the step() seam (a software-GL frame can take 400 ms, so wall-clock polling sees 2 samples)
      const tr = await page.evaluate(() => { const a = document.getElementById('cxAnCampus').__rzCampus; a.focus(null); a.step(performance.now() + 2000); const z0 = a.view().zoom, T = performance.now() + 5000; a.focus('hall'); const zs = [0, 100, 225, 350, 460].map((d) => +a.step(T + d).zoom.toFixed(3)); return { z0, zs, v: a.view(), mo: a.motion() }; });
      const zEnd = tr.v.zoom, between = tr.zs.filter((z) => z > tr.z0 + 0.05 && z < zEnd - 0.05), mono = tr.zs.every((z, i) => !i || z >= tr.zs[i - 1] - 1e-6);
      ok('M1 frame by frame the zoom climbs through in-between values (an ease, not a jump) and never backs up', between.length >= 2 && mono, tr);
      ok('M1 driven by the clock it lands on the hall at 450 ms (CAM_MS) — ease-out: past half way by 1/3 of the time', tr.v.atFocus && tr.mo.lastCamMs >= 450 && tr.mo.lastCamMs <= 470 && (tr.zs[1] - tr.z0) / (zEnd - tr.z0) > 0.5 * (100 / 450), tr);
      await sleep(500);
      ok('M2 the fades have finished (no material still easing)', await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.motion().fading) === 0);
      // M8 at 1440 no callout box sits on an equipment anchor dot (the thing it names stays visible)
      const cov = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'); const boxes = [...h.querySelectorAll('.cx-3d-co')].filter((e) => !e.hidden).map((e) => e.getBoundingClientRect()); const dots = [...h.querySelectorAll('.cx-3d-callouts circle')].filter((c) => c.getAttribute('visibility') !== 'hidden').map((c) => c.getBoundingClientRect()).map((r) => [r.left + r.width / 2, r.top + r.height / 2]); const hit = dots.filter(([x, y]) => boxes.some((b) => x > b.left && x < b.right && y > b.top && y < b.bottom)); return { boxes: boxes.length, dots: dots.length, covered: hit.length }; });
      ok('M8 1440: no hall callout covers an equipment anchor', cov.boxes >= 5 && cov.dots === cov.boxes && cov.covered === 0, cov);
      // M3 staggered fan-out
            const ex = await page.evaluate(() => { const a = document.getElementById('cxAnCampus').__rzCampus, T = performance.now() + 9000; a.explode(true); a.step(T); a.step(T + 130); a.step(T + 260); return a.exploded(); });
      const fr = ex.layers.map((l, i) => l.y / (4 * (i + 1)));   // fraction of its own lift each layer has done
      ok('M3 mid fan-out the bottom layer is further along than the top one (staggered, not one rigid lift)', ex.factor > 0 && ex.factor < 1 && fr.length >= 3 && fr[0] > fr[fr.length - 1] + 0.1, { factor: ex.factor, fr });
      ok('M3 the explode factor never leaves 0..1', ex.factor >= 0 && ex.factor <= 1, ex.factor);
      await sleep(1500);
      const ex2 = await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.exploded());
      ok('M3 when it settles every layer sits on its own level (n × 4 m)', ex2.factor === 1 && ex2.layers.every((l, i) => Math.abs(l.y - 4 * (i + 1)) < 1e-6), ex2);
      await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.explode(false)); await sleep(900);
      // M4 pick lights one family
      const pk = await page.evaluate(() => new Promise((res) => { const h = document.getElementById('cxAnCampus'), a = h.__rzCampus; a.pick('ups'); setTimeout(() => { const cos = [...h.querySelectorAll('.cx-3d-co')].filter((e) => !e.hidden); res({ attr: h.getAttribute('data-cx-pick'), picked: cos.filter((e) => e.hasAttribute('data-picked')).map((e) => e.textContent), crumb: h.querySelector('.cx-3d-crumb').textContent.replace(/\s+/g, ' ').trim(), mo: a.motion() }); }, 600); }));
      ok('M4 picking the UPS family marks it, lights exactly its callout, and the breadcrumb reads Campus › hall › UPS', pk.attr === 'ups' && pk.picked.length === 1 && /^UPS/i.test(pk.picked[0]) && /Campus.*›.*›\s*UPS/.test(pk.crumb), pk);
      const un = await page.evaluate(() => { const h = document.getElementById('cxAnCampus'), a = h.__rzCampus; a.pick(null); return { attr: h.getAttribute('data-cx-pick'), crumb: h.querySelector('.cx-3d-crumb').textContent.replace(/\s+/g, ' ').trim() }; });
      ok('M4 un-picking clears the mark and the breadcrumb goes back to Campus › building', un.attr === '' && (un.crumb.match(/›/g) || []).length === 1, un);
      await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.focus(null)); await sleep(800);
      ok('M5 back on the campus the camera has landed on the site', await page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.view().atSite));
    }
  }
  ok('no page errors (normal motion)', errs.length === 0, errs);
  await page.close();
  // M7 at 390 px the callouts of the focused hall stay inside the stage and do not overlap each other
  {
    const q = await open(false);
    if (q.st === 'ready') {
      await q.page.setViewport({ width: 390, height: 844 }); await sleep(800);
      await q.page.evaluate(() => document.getElementById('cxAnCampus').scrollIntoView({ block: 'center' }));
      const co = await q.page.evaluate(() => new Promise((res) => { const h = document.getElementById('cxAnCampus'); h.__rzCampus.focus('hall'); setTimeout(() => { const s = h.querySelector('.cx-3d-stage').getBoundingClientRect(); const rs = [...h.querySelectorAll('.cx-3d-co')].filter((e) => !e.hidden).map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, txt: e.textContent }; }); const out = rs.filter((r) => r.l < s.left - 1 || r.r > s.right + 1 || r.t < s.top - 1 || r.b > s.bottom + 1); let ov = 0; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) ov++; } res({ n: rs.length, out: out.map((r) => r.txt), ov }); }, 1500); }));
      ok('M7 390 px: every hall callout inside the stage, none overlapping another', co.n >= 5 && co.out.length === 0 && co.ov === 0, co);
    } else ok('M7 phone page mounts', false, q.st);
    await q.page.close();
  }
  // M6 reduced motion: everything instant
  const r = await open(true);
  if (r.st === 'ready') {
    const rm = await r.page.evaluate(() => { const a = document.getElementById('cxAnCampus').__rzCampus; if (!a.motion) return null; a.focus('hall'); const v = a.view(), mo = a.motion(); a.explode(true); return { atFocus: v.atFocus, moving: mo.camMoving, fading: mo.fading, reduce: mo.reduce }; });
    await sleep(80);
    const rx = rm && await r.page.evaluate(() => document.getElementById('cxAnCampus').__rzCampus.exploded().factor);
    ok('M6 reduced motion: the camera cuts to the hall, no fades in flight, explode lands in one frame', !!rm && rm.reduce && rm.atFocus && !rm.moving && rm.fading === 0 && rx === 1, { rm, rx });
  } else ok('M6 reduced-motion page mounts', false, r.st);
  ok('no page errors (reduced motion)', r.errs.length === 0, r.errs);
} finally { await browser.close(); if (server) server.kill(); }
console.log(`CX CAMPUS MOTION — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
