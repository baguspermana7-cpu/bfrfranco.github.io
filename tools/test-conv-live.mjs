#!/usr/bin/env node
/**
 * test-conv-live.mjs — PRD-CONV-BMS-LIVE (owner R184: "masih abu2 semua, tidak ada animasi yg immersive"). The running
 * plant must be SEEN running: flow that moves and is coloured by its medium, current on energised conductors, air in
 * the data hall, traffic on the network — every speed from a process value, nothing moving that does not run.
 *
 *   LV1 moving: on each page the marks inside the viewport ADVANCE (computed stroke-dashoffset sampled 400 ms apart):
 *       chiller, water, EPMS >= 6, ict >= 6, datahall >= 25 (chiller's sheet is stepped by its clock: still counts)
 *   LV2 readable: a running slug is >= 1.8 px and sits inside a wider running tube (chiller CHW, water PW)
 *   LV3 colour: medium slugs and running tubes carry chroma (OKLCH C >= 0.04); a running CHW jacket is tinted, a stopped
 *       one is bare aluminium (C < 0.03); EPMS current dots are lighter than the energised conductor they run on
 *   LV4 speed from the process: datahall exhaust — a hotter row never moves slower; ict — a busier link never slower
 *   LV5 datahall air: >= 25 exhaust and >= 25 supply paths animate; a CRAH switched off silences the supply it fed
 *       (fixture tools/fixtures/floor-plan.html)
 *   LV6 ict: every UP link carries traffic, no STANDBY link does
 *   LV7 reduced motion: nothing advances on any page; colours stay
 *   LV8 static: chiller clock <= 50 ms (24 Hz), all 8 pages link css/conv-live.css, no glow / filter / transition-all
 *
 *   node tools/test-conv-live.mjs [--only=LV1,LV3] [--page=chiller-plant]
 */
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import puppeteer from 'puppeteer';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1];
const ONLY = (arg('only') || '').split(',').filter(Boolean);
const PAGE = arg('page');
const want = (id) => !ONLY.length || ONLY.includes(id);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer(async (q, r) => {
  try { const f = resolve(ROOT, '.' + decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT)) throw 0;
    r.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); r.end(await readFile(f)); }
  catch { r.writeHead(404); r.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const ORIGIN = `http://127.0.0.1:${server.address().port}/`;

const results = {};
function check(id, ok, msg) { (results[id] = results[id] || { pass: 0, fail: [] }); if (ok) results[id].pass++; else results[id].fail.push(msg); }

const PAGES = { 'chiller-plant': { min: 6, sel: '#chw-sheet-host .hmi-frame' }, 'water-system': { min: 6, sel: '#water-sheet-host .hmi-frame' },
  EPMS_Telemetry: { min: 6, sel: '.hmi-frame' }, ict: { min: 6, sel: 'svg.ict-arch' }, datahall: { min: 25, sel: '.fp-root' } };
const MARKS = '.hmi-flow[data-vmove], .hmi-flow[data-flow="running"], .chw-flow-copy, .fp-air path:not([data-off]), svg.ict-arch .edge-flow';

/* OKLab chroma of an rgb()/rgba() string (alpha ignored) */
function chroma(css) {
  const o = String(css).match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)/); if (o) return { L: +o[1] / (o[2] ? 100 : 1), C: +o[3] };   /* color-mix(in oklch) computes to oklch() */
  const m = String(css).match(/rgba?\(([^)]+)\)/); if (!m) return null;
  const [r, g, b] = m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
  return { C: Math.hypot(A, B), L: 0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s };
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
async function open(name, reduce) {
  const pg = await browser.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  if (reduce) await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await primeCockpitAuditDocument(pg).catch(() => {});
  await pg.goto(ORIGIN + name + '.html', { waitUntil: 'load', timeout: 90000 });
  await enterAuthorizedAuditState(pg).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  await pg.evaluate((sel) => { const s = document.querySelector(sel); if (s) s.scrollIntoView({ block: 'start' }); }, PAGES[name].sel);
  await new Promise((r) => setTimeout(r, 900));
  return { pg, errs };
}
/* how many marks inside the viewport advanced between two samples 400 ms apart */
async function advancing(pg) {
  const a = await pg.evaluate((M) => { window.__lvMarks = [...document.querySelectorAll(M)].filter((e) => { const r = e.getBoundingClientRect(); return r.width + r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).display !== 'none'; });
    return window.__lvMarks.map((e) => getComputedStyle(e).strokeDashoffset); }, MARKS);
  await new Promise((r) => setTimeout(r, 400));
  const b = await pg.evaluate(() => window.__lvMarks.map((e) => getComputedStyle(e).strokeDashoffset));
  return { inView: a.length, moved: a.filter((v, i) => v !== b[i]).length };
}

const names = Object.keys(PAGES).filter((n) => !PAGE || n === PAGE);
for (const name of names) {
  const { pg, errs } = await open(name, false);
  if (want('LV1')) { const m = await advancing(pg); check('LV1', m.moved >= PAGES[name].min, `${name}: ${m.moved} of ${m.inView} marks in view advance (need ${PAGES[name].min})`); }
  if (want('LV2') && name === 'chiller-plant') {   /* the chiller's flow runs on its own layer laid exactly over the sheet */
    const L = await pg.evaluate(() => { const s = document.querySelector('#chw-sheet-host svg.hmi-svg'), o = document.querySelector('#chw-sheet-host svg.chw-flow-layer');
      if (!s || !o) return null; const a = s.getBoundingClientRect(), b = o.getBoundingClientRect(), f = s.querySelectorAll('.hmi-flow'), c = o.querySelectorAll('.chw-flow-copy');
      const i = [...f].findIndex((e) => e.getAttribute('data-flow') === 'running');
      return { off: Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.width - b.width), Math.abs(a.height - b.height)), vb: s.getAttribute('viewBox') === o.getAttribute('viewBox'),
        n: f.length, copies: c.length, sameD: i >= 0 && c[i] && c[i].getAttribute('d') === f[i].getAttribute('d'), stroke: i >= 0 && c[i] && getComputedStyle(c[i]).stroke === getComputedStyle(f[i]).stroke }; });
    check('LV2', !!L && L.off < 1 && L.vb && L.n === L.copies && L.sameD && L.stroke, `${name}: flow layer ${JSON.stringify(L)}`);
  }
  if (want('LV2') && (name === 'chiller-plant' || name === 'water-system')) {
    const w = await pg.evaluate(() => { const f = document.querySelector('.hmi-flow[data-vmove][data-vstate="running"]'); if (!f) return null;
      const id = f.getAttribute('data-edge-flow'), t = document.querySelector('.hmi-edge[data-edge="' + id + '"]');
      return { slug: parseFloat(getComputedStyle(f).strokeWidth), tube: t ? parseFloat(getComputedStyle(t).strokeWidth) : 0 }; });
    check('LV2', !!w && w.slug >= 1.8 && w.tube > w.slug && w.tube >= 2.8, `${name}: slug / tube width ${JSON.stringify(w)}`);
  }
  if (want('LV3')) {
    const c = await pg.evaluate(() => {
      const f = document.querySelector('.hmi-flow[data-vmove][data-vstate="running"].m-chw, .hmi-flow[data-vmove][data-vstate="running"].m-pw');
      const t = f && document.querySelector('.hmi-edge[data-edge="' + f.getAttribute('data-edge-flow') + '"]');
      const jr = document.querySelector('.hd-insul[data-flow="running"]'), js = document.querySelector('.hd-insul[data-flow="stopped"]');
      const pw = document.querySelector('.hmi-flow[data-vmove].m-power'), pe = pw && document.querySelector('.hmi-edge[data-edge="' + pw.getAttribute('data-edge-flow') + '"]');
      const cs = (e) => e ? getComputedStyle(e).stroke : null;
      return { slug: cs(f), tube: cs(t), jacketRun: cs(jr), jacketStop: cs(js), power: cs(pw), conductor: cs(pe) };
    });
    if (name === 'chiller-plant' || name === 'water-system') {
      const s = chroma(c.slug), t = chroma(c.tube);
      check('LV3', !!s && s.C >= 0.04, `${name}: slug ${c.slug} chroma ${s && s.C.toFixed(3)}`);
      check('LV3', !!t && t.C >= 0.04, `${name}: running tube ${c.tube} chroma ${t && t.C.toFixed(3)}`);
    }
    if (name === 'chiller-plant') {
      const r = chroma(c.jacketRun), s = chroma(c.jacketStop);
      check('LV3', !!r && r.C >= 0.03, `${name}: running CHW jacket ${c.jacketRun} chroma ${r && r.C.toFixed(3)}`);
      check('LV3', !s || s.C < 0.03, `${name}: stopped CHW jacket ${c.jacketStop} chroma ${s && s.C.toFixed(3)} (bare aluminium)`);
    }
    if (name === 'EPMS_Telemetry') {
      const d = chroma(c.power), k = chroma(c.conductor);
      check('LV3', !!d && !!k && d.L > k.L + 0.1, `${name}: current dots ${c.power} vs conductor ${c.conductor}`);
    }
  }
  if (want('LV4') && name === 'datahall') {
    const rows = await pg.evaluate(() => [...document.querySelectorAll('.fp-air .air-hot:not([data-off])')].map((e) => ({ z: +e.getAttribute('data-z'), s: +e.getAttribute('data-air-s') })));
    const heat = await pg.evaluate(() => { const h = []; document.querySelectorAll('.zone[data-z]').forEach((z) => { const k = z.querySelector('.zf-kw'); h[+z.getAttribute('data-z')] = k ? parseFloat(k.textContent) : 0; }); return h; });   /* the row kW the strip prints */
    const pairs = []; for (const a of rows) for (const b of rows) if (heat[a.z] > heat[b.z] * 1.05 && a.s > b.s + 0.001) pairs.push(`${a.z}:${heat[a.z]}kW ${a.s}s vs ${b.z}:${heat[b.z]}kW ${b.s}s`);
    check('LV4', rows.length >= 25 && heat.filter((h) => h > 0).length >= 25 && pairs.length === 0, `${name}: ${rows.length} exhaust paths, heat known for ${heat.filter((h) => h > 0).length} rows; slower-while-hotter pairs: ${pairs.slice(0, 2).join(' | ')}`);
  }
  if (want('LV4') && name === 'ict') {
    const L = await pg.evaluate(() => [...document.querySelectorAll('svg.ict-arch .edge-flow')].filter((e) => e.getAttribute('data-load')).map((e) => ({ l: +e.getAttribute('data-load'), s: parseFloat(e.style.animationDuration) })));
    const bad = []; for (const a of L) for (const b of L) if (a.l > b.l + 0.01 && a.s > b.s + 0.001) bad.push(`${a.l}/${a.s}s vs ${b.l}/${b.s}s`);
    check('LV4', L.length >= 3 && bad.length === 0, `${name}: ${L.length} loaded links; slower-while-busier pairs: ${bad.slice(0, 2).join(' | ')}`);
  }
  if (want('LV5') && name === 'datahall') {
    const n = await pg.evaluate(() => ({ hot: document.querySelectorAll('.fp-air .air-hot:not([data-off])').length, cold: document.querySelectorAll('.fp-air .air-cold:not([data-off])').length,
      run: document.getAnimations().filter((a) => a.animationName === 'fp-air' && a.playState === 'running').length }));
    check('LV5', n.hot >= 25 && n.cold >= 25 && n.run >= 50, `${name}: exhaust ${n.hot}, supply ${n.cold}, running ${n.run}`);
  }
  if (want('LV6') && name === 'ict') {
    const e = await pg.evaluate(() => { const has = (i) => !!document.querySelector('svg.ict-arch .edge-flow[data-edge-flow="' + i + '"]');
      const up = [...document.querySelectorAll('svg.ict-arch .edge.up:not(.conduit)')].map((x) => x.getAttribute('data-edge'));
      const st = [...document.querySelectorAll('svg.ict-arch .edge.stby')].map((x) => x.getAttribute('data-edge'));
      return { up: up.length, upFlow: up.filter(has).length, stby: st.length, stbyFlow: st.filter(has).length }; });
    check('LV6', e.up > 0 && e.upFlow === e.up && e.stbyFlow === 0, `${name}: ${e.upFlow}/${e.up} UP links carry traffic, ${e.stbyFlow}/${e.stby} STANDBY do`);
  }
  check('LV0', errs.length === 0, `${name} page errors: ${errs.slice(0, 2).join(' | ')}`);
  await pg.close();
}

if (want('LV5') && !PAGE) {   /* a CRAH switched off silences the supply it fed (fixture) */
  const pg = await browser.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  await pg.goto(ORIGIN + 'tools/fixtures/floor-plan.html', { waitUntil: 'load', timeout: 60000 }); await pg.waitForFunction(() => window.__fp && window.__fp.plan, { timeout: 30000 });
  const r = await pg.evaluate(() => { const on = () => document.querySelectorAll('.fp-air .air-cold:not([data-off])').length; const a = on();
    const u = window.__fp.model.crahUnits; u[0].running = false; window.__fp.plan.paint(window.__fp.plan.mode); const b = on(); u[0].running = true; window.__fp.plan.paint(window.__fp.plan.mode);
    return { before: a, off: b, after: on() }; });
  check('LV5', r.off < r.before && r.after === r.before, `fixture: supply paths ${r.before} -> CRAH 1 off ${r.off} -> on ${r.after}`);
  await pg.close();
}

if (want('LV7')) for (const name of names) {
  const { pg } = await open(name, true);
  const m = await advancing(pg);
  check('LV7', m.moved === 0, `${name} reduced motion: ${m.moved} of ${m.inView} marks still advance`);
  await pg.close();
}

if (want('LV8')) {
  const ch = readFileSync(resolve(ROOT, 'chiller-plant.html'), 'utf8'), ms = +((ch.match(/the flow layer: 24 Hz[\s\S]*?\},\s*(\d+)\);/) || [])[1] || NaN);
  check('LV8', ms <= 50, `chiller-plant flow layer step ${ms} ms (need <= 50)`);
  for (const p of ['dc-conventional', 'datahall', 'chiller-plant', 'fuel-system', 'water-system', 'fire-system', 'ict', 'EPMS_Telemetry']) {
    const s = readFileSync(resolve(ROOT, p + '.html'), 'utf8');
    check('LV8', /href="css\/conv-live\.css\?v=/.test(s) && s.indexOf('conv-live.css') > s.indexOf('conv-motion.css'), `${p}: links css/conv-live.css after conv-motion.css`);
  }
  const cssPath = resolve(ROOT, 'css/conv-live.css'), css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') : null;
  check('LV8', css !== null, 'css/conv-live.css exists');
  if (css !== null)
  check('LV8', !/transition\s*:\s*all|filter\s*:|drop-shadow|box-shadow|glow/i.test(css), 'css/conv-live.css: no glow, filter, shadow or transition-all');
}

await browser.close(); server.close();
let failed = 0;
for (const id of ['LV0', 'LV1', 'LV2', 'LV3', 'LV4', 'LV5', 'LV6', 'LV7', 'LV8']) {
  const r = results[id]; if (!r) continue;
  if (r.fail.length) { failed++; console.log(`${id} FAIL  ${r.fail.length} finding(s)`); r.fail.slice(0, 6).forEach((f) => console.log('   ' + f)); }
  else console.log(`${id} PASS  (${r.pass})`);
}
const total = Object.values(results).reduce((a, r) => a + r.pass + r.fail.length, 0);
console.log(failed ? `CONV LIVE — FAIL (${failed} law(s))` : `CONV LIVE — PASS (${total} checks: moving marks, slug/tube width, medium colour, speed from the process, data-hall air, ict traffic, reduced motion, static)`);
process.exit(failed ? 1 : 0);
