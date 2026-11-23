#!/usr/bin/env node
/* test-dcai-hall-iso.mjs — STRICT. PRD-DATAHALL-BMS-ISO F4: the DC AI Data Hall tab (datahallAI.html) gets the same
   3D / Plan floor as the Conventional data hall, through a geometry adapter (js/datahall-ai/hall-iso.js) over the one
   renderer (js/conv/floor-plan.js). Plan is the existing engineering drawing (#hSvg), unchanged. Signed in, real browser.
   D1  1440: 2D is the default (PRD-DCAI-HALL-DEPTH Amendment 1) — the floor (#hIso .fp-root[data-proj=plan]) is shown
       and the drawing (#hSvg + its layer bar) is not; a 2D | 3D | Drawing switch of three buttons with aria-pressed.
       D2-D4 and D6 read the 3D floor, opened with the stored view 'iso'
   D2  the 3D floor draws the engine's hall: racks = racksPerHall, fan-wall modules = crahInstalled (standby =
       installed - active), CDUs = cduInstalled (standby = installed - running), one hot-aisle roof per row pair
   D3  grey is normal: >= 95 % of racks have neutral faces (OKLCH C < 0.03) and a green lamp; a planted hot inlet turns
       that rack's faces red (alarm) and only that rack leaves the neutral set
   D4  true isometric: every rack front has the same height (+-0.5 px); rack top edges at 30 +-1 deg
   D5  the switch: Enter on Drawing shows #hSvg and hides the floor, the choice is stored (rz.dcai.view) and survives
       a reload; Space on 3D brings the 3D floor back
   D6  a 3D rack carries the plan's equipment reference (rack-unit:Rnn-kk), and a click on it opens the same HMI the
       plan opens
   D7  390: 2D by default; page scrollWidth <= viewport in Plan and in 3D; 0 page errors in every run
   D8  the 3D floor holds its size for 6 s and follows a window narrowed and widened back (it once shrank 2 px per
       resize round until it vanished: the renderer measured the bordered host it then resized)
   Usage: node tools/test-dcai-hall-iso.mjs [--shots=<dir>] */
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
const ok = (id, c, m) => { checks++; if (!c) fails.push(id + ' ' + m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = 'rz.dcai.view';

async function open(width, theme, proj) {
  const pg = await browser.newPage();
  pg.errors = []; pg.on('pageerror', (e) => pg.errors.push(e.message));
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: signedInSupabaseBody({ email: 'educator@resistancezero.com', tier: 'pro', educator: true }) });
    return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort();
  });
  const phone = width < 500;
  await pg.setViewport({ width, height: phone ? 844 : 900, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await pg.evaluateOnNewDocument((entries, theme, proj, key) => {
    try {
      if (sessionStorage.getItem('__dcaiIsoSeeded')) return;   /* a reload keeps what the page stored */
      sessionStorage.setItem('__dcaiIsoSeeded', '1');
      localStorage.setItem('theme', theme); localStorage.setItem('rz_cookie_consent', 'declined'); entries.forEach(([k, v]) => localStorage.setItem(k, v));
      if (proj) localStorage.setItem(key, proj); else localStorage.removeItem(key);
    } catch (x) { /* no storage */ }
  }, signedInStorage({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator' }), theme, proj || '', KEY);
  await pg.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 90000 });
  await pg.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
  await wait(800);
  await enter(pg);
  return pg;
}
async function enter(pg) {
  await enterAuthorizedAuditState(pg, 'dc-ai');
  await pg.evaluate(() => { const b = document.querySelector('#tabs [data-t="hall"]'); if (b) b.click(); });
  await wait(2500);
}

/* what is on screen: which projection, the toggle, the engine counts the page itself holds */
const state = (pg) => pg.evaluate((key) => {
  const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const iso = document.querySelector('#hIso .fp-root'), plan = document.getElementById('hSvg');
  const btns = [...document.querySelectorAll('.dh-proj [data-view]')];
  const bn = (k) => { const v = window.DHE ? window.DHE[k] : null; return typeof v === 'number' && isFinite(v) ? v : null; };   /* the page's engine snapshot */
  let stored = null; try { stored = localStorage.getItem(key); } catch (e) { /* none */ }
  return {
    isoShown: vis(iso), planShown: vis(plan) && vis(document.getElementById('hallLayers')), isoProj: iso ? iso.getAttribute('data-proj') : null,
    btns: btns.map((b) => ({ p: b.getAttribute('data-view'), pressed: b.getAttribute('aria-pressed') })),
    stored, vw: innerWidth, docW: document.documentElement.scrollWidth,
    racksHall: bn('racksPerHall'), crahInst: bn('crahInstalled'), crahAct: bn('crahActive'), cduInst: bn('cduInstalled'), cduRun: bn('cduRunning'),
    pairs: bn('rackRows') != null ? bn('rackRows') / 2 : null
  };
}, KEY);

/* faces, lamps, geometry of the 3D floor */
const measure = (pg) => pg.evaluate(() => {
  const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  function oklch(str) {
    const m = String(str).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); if (!m) return null;
    const r = toLin(+m[1]), g = toLin(+m[2]), b = toLin(+m[3]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
    let h = Math.atan2(B, A) * 180 / Math.PI; if (h < 0) h += 360;
    return { L, C: Math.hypot(A, B), h, rgb: [+m[1], +m[2], +m[3]] };
  }
  const racks = [...document.querySelectorAll('#hIso .rack')];
  const out = { n: racks.length, neutral: 0, green: 0, colored: [], heights: [], angles: [], refs: 0 };
  racks.forEach((g) => {
    const faces = ['rk-top', 'rk-front', 'rk-side'].map((c) => oklch(getComputedStyle(g.querySelector('.' + c)).fill));
    const neutral = faces.every((f) => f && f.C < 0.03);
    if (neutral) out.neutral++; else out.colored.push({ idx: +g.getAttribute('data-idx'), state: g.getAttribute('data-state'), h: faces[1] && Math.round(faces[1].h), C: faces[1] && +faces[1].C.toFixed(3) });
    const lamp = oklch(getComputedStyle(g.querySelector('.rk-lamp')).fill);
    if (lamp && lamp.rgb[1] > lamp.rgb[0] && lamp.rgb[1] > lamp.rgb[2]) out.green++;
    if (/^rack-unit:R\d{2}-\d{2}$/.test(g.getAttribute('data-rz-equipment') || '')) out.refs++;
    const fr = g.querySelector('.rk-front').getAttribute('points').trim().split(/\s+/).map((p) => p.split(',').map(Number));
    out.heights.push(Math.abs(fr[0][1] - fr[3][1]));
  });
  const t0 = racks[0] && racks[0].querySelector('.rk-top').getAttribute('points').trim().split(/\s+/).map((p) => p.split(',').map(Number));
  if (t0) for (const [a, b] of [[t0[0], t0[1]], [t0[1], t0[2]]]) out.angles.push(Math.abs(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI) % 180);
  out.angles = out.angles.map((a) => (a > 90 ? 180 - a : a));
  const cells = [...document.querySelectorAll('#hIso .crah-cell')];
  out.crah = cells.filter((c) => c.getAttribute('data-kind') !== 'cdu').length;
  out.crahStby = cells.filter((c) => c.getAttribute('data-kind') !== 'cdu' && c.getAttribute('data-state') === 'standby').length;
  out.cdu = cells.filter((c) => c.getAttribute('data-kind') === 'cdu').length;
  out.cduStby = cells.filter((c) => c.getAttribute('data-kind') === 'cdu' && c.getAttribute('data-state') === 'standby').length;
  out.caps = document.querySelectorAll('#hIso .hot-cap').length;
  return out;
});

/* ---------- 1440, both themes ---------- */
for (const theme of ['dark', 'light']) {
  const T = `1440 ${theme}`;
  {
    const p0 = await open(1440, theme);
    const s0 = await state(p0);
    ok('D1', s0.isoShown && s0.isoProj === 'plan' && !s0.planShown, `${T}: default floor shown ${s0.isoShown} (proj ${s0.isoProj}), drawing shown ${s0.planShown} (need the 2D floor only)`);
    ok('D1', s0.btns.length === 3 && s0.btns.map((b) => b.p + ':' + b.pressed).join(' ') === 'flat:true iso:false drawing:false', `${T}: switch ${JSON.stringify(s0.btns)}`);
    ok('D7', !p0.errors.length, `${T} 2D: page errors ${p0.errors.slice(0, 2).join(' | ')}`);
    await p0.close();
  }
  const pg = await open(1440, theme, 'iso');
  const s = await state(pg);
  ok('D1', s.isoShown && s.isoProj === 'iso' && !s.planShown, `${T}: stored 3D: floor ${s.isoShown} (proj ${s.isoProj}), drawing ${s.planShown}`);
  const m = await measure(pg);
  ok('D2', s.racksHall > 0 && m.n === s.racksHall, `${T}: ${m.n} racks drawn, engine racksPerHall ${s.racksHall}`);
  ok('D2', s.crahInst > 0 && m.crah === s.crahInst && m.crahStby === s.crahInst - s.crahAct, `${T}: ${m.crah} fan-wall modules (${m.crahStby} standby), engine ${s.crahInst} installed / ${s.crahAct} active`);
  ok('D2', s.cduInst > 0 && m.cdu === s.cduInst && m.cduStby === s.cduInst - s.cduRun, `${T}: ${m.cdu} CDUs (${m.cduStby} standby), engine ${s.cduInst} installed / ${s.cduRun} running`);
  ok('D2', s.pairs > 0 && m.caps === s.pairs, `${T}: ${m.caps} hot-aisle roofs, ${s.pairs} row pairs`);
  ok('D3', m.n > 0 && m.neutral / m.n >= 0.95 && m.colored.every((c) => c.state === 'warn' || c.state === 'alarm'), `${T}: ${m.neutral} of ${m.n} racks neutral, coloured not warn/alarm ${JSON.stringify(m.colored.filter((c) => c.state !== 'warn' && c.state !== 'alarm').slice(0, 3))}`);
  ok('D3', m.n > 0 && m.green === m.n, `${T}: ${m.green} of ${m.n} rack lamps green`);
  const hMin = Math.min(...m.heights), hMax = Math.max(...m.heights);
  ok('D4', m.n > 0 && hMax - hMin <= 0.5, `${T}: rack front heights ${hMin.toFixed(1)}..${hMax.toFixed(1)} px (need equal +-0.5)`);
  ok('D4', m.angles.length === 2 && m.angles.every((a) => Math.abs(a - 30) <= 1), `${T}: rack top edges ${m.angles.map((a) => a.toFixed(1)).join(' / ')} deg (need 30 +-1)`);
  ok('D6', m.n > 0 && m.refs === m.n, `${T}: ${m.refs} of ${m.n} 3D racks carry rack-unit:Rnn-kk`);
  if (theme === 'dark') {
    /* D3 planted: one rack's inlet above the alarm limit, through the adapter's model seam */
    const pl = await pg.evaluate(() => {
      const H = window.RZHallIso; if (!H || !H.model) return { err: 'no RZHallIso.model()' };
      const mdl = H.model(), idx = 50, base = mdl.rackInletFor;
      mdl.rackInletFor = (i) => (i === idx ? 33 : base(i)); H.repaint();
      return { idx };
    });
    if (pl.err) ok('D3', false, `${T}: planted alarm: ${pl.err}`);
    else {
      const m2 = await measure(pg);
      const c = m2.colored.find((x) => x.idx === pl.idx);
      ok('D3', !!c && c.state === 'alarm' && (c.h <= 45 || c.h >= 345) && c.C > 0.06, `${T}: planted 33 °C inlet on rack ${pl.idx}: ${JSON.stringify(c || null)} (need alarm, red hue)`);
      ok('D3', m2.neutral === m.neutral - 1, `${T}: neutral racks ${m.neutral} -> ${m2.neutral} after one planted alarm`);
    }
    /* D6 a click on a 3D rack opens the rack HMI the plan opens */
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `dcai-iso-${theme}-1440.png`) });
    const d6 = await pg.evaluate(async () => {
      const g = document.querySelector('#hIso .rack[data-idx="3"]'); if (!g) return { err: 'no rack 3' };
      const ref = g.getAttribute('data-rz-equipment'), r = g.querySelector('.rk-front').getBoundingClientRect();
      return { ref, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (d6.err) ok('D6', false, `${T}: ${d6.err}`);
    else {
      await pg.mouse.click(d6.x, d6.y); await wait(1200);
      const opened = await pg.evaluate(() => {
        const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
        const c = [...document.querySelectorAll('.hmi-modal-back, .dh-modal-host, .rz-inspector, .eq-hmi, .rack-modal, [role="dialog"]')].filter(vis);
        return c.map((e) => (e.className || e.id || e.tagName).toString().slice(0, 40)).concat([(document.body.innerText.match(/R\d{2}-\d{2}/) || [''])[0]]);
      });
      ok('D6', opened.length > 1, `${T}: click on 3D ${d6.ref} opened ${JSON.stringify(opened)}`);
    }
  }
  /* D5 toggle by keyboard, stored, survives a reload */
  await pg.keyboard.press('Escape');
  await pg.focus('.dh-proj [data-view="drawing"]').catch(() => {});
  await pg.keyboard.press('Enter'); await wait(600);
  const s1 = await state(pg);
  ok('D5', s1.planShown && !s1.isoShown && s1.stored === 'drawing', `${T}: Enter on Drawing -> drawing ${s1.planShown}, floor ${s1.isoShown}, stored ${s1.stored}`);
  await pg.reload({ waitUntil: 'networkidle2', timeout: 90000 }); await wait(800); await enter(pg);
  const s2 = await state(pg);
  ok('D5', s2.planShown && !s2.isoShown, `${T}: after reload drawing ${s2.planShown}, 3D ${s2.isoShown} (stored ${s2.stored})`);
  await pg.focus('.dh-proj [data-view="iso"]').catch(() => {});
  await pg.keyboard.press('Space'); await wait(1200);
  const s3 = await state(pg);
  ok('D5', s3.isoShown && s3.isoProj === 'iso' && !s3.planShown && s3.stored === 'iso', `${T}: Space on 3D -> 3D ${s3.isoShown} (proj ${s3.isoProj}), drawing ${s3.planShown}, stored ${s3.stored}`);
  ok('D7', !pg.errors.length, `${T}: page errors ${pg.errors.slice(0, 2).join(' | ')}`);
  await pg.close();
}

/* ---------- 390 ---------- */
{
  const T = '390 dark';
  const pg = await open(390, 'dark');
  const s = await state(pg);
  ok('D7', s.isoShown && s.isoProj === 'plan' && !s.planShown, `${T}: default 2D floor ${s.isoShown} (proj ${s.isoProj}), drawing ${s.planShown} (need 2D on a phone)`);
  ok('D7', s.docW <= s.vw + 1, `${T}: 2D: page scrollWidth ${s.docW} in ${s.vw}`);
  await pg.evaluate(() => { const b = document.querySelector('.dh-proj [data-view="drawing"]'); if (b) b.click(); }); await wait(1200);
  const sd = await state(pg);
  ok('D7', sd.planShown && sd.docW <= sd.vw + 1, `${T}: Drawing shown ${sd.planShown}, page scrollWidth ${sd.docW} in ${sd.vw}`);
  await pg.evaluate(() => { const b = document.querySelector('.dh-proj [data-view="iso"]'); if (b) b.click(); }); await wait(1500);
  const s1 = await state(pg);
  ok('D7', s1.isoShown && s1.docW <= s1.vw + 1, `${T}: 3D shown ${s1.isoShown}, page scrollWidth ${s1.docW} in ${s1.vw}`);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'dcai-iso-dark-390.png') });
  ok('D7', !pg.errors.length, `${T}: page errors ${pg.errors.slice(0, 2).join(' | ')}`);
  await pg.close();
}

/* ---------- D8: the 3D floor holds its size (owner 2026-11-22: "bergerak membesar kemudian mengecil kemudian hilang").
   The window keeps its height (900) while it narrows: since A1 the floor also fits the viewport height.
   The renderer sets the host width from what it measures; measuring the bordered host itself shrank it 2 px per
   ResizeObserver round, for ever. Now: no change over 6 s, and a window narrowed and widened again restores it. ---------- */
{
  const T = '1440 dark D8';
  const pg = await open(1440, 'dark', 'iso');
  const size = () => pg.evaluate(() => { const h = document.getElementById('hIso'); if (!h) return null; const b = h.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; });
  const a = await size(); await wait(6000); const b = await size();
  ok('D8', a && b && a[0] > 600 && Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1, `${T}: 3D floor moved on its own: ${JSON.stringify(a)} -> ${JSON.stringify(b)} in 6 s`);
  await pg.setViewport({ width: 760, height: 900 }); await wait(1500);
  const n = await size();
  await pg.setViewport({ width: 1440, height: 900 }); await wait(1500);
  const w = await size();
  ok('D8', n && w && n[0] < b[0] && Math.abs(w[0] - b[0]) <= 2, `${T}: narrowed ${JSON.stringify(n)}, widened back ${JSON.stringify(w)}, need ${JSON.stringify(b)}`);
  ok('D8', !pg.errors.length, `${T}: page errors ${pg.errors.slice(0, 2).join(' | ')}`);
  await pg.close();
}

await browser.close(); srv.close();
console.log(`DC AI hall 2D / 3D / Drawing (PRD-DATAHALL-BMS-ISO F4 + PRD-DCAI-HALL-DEPTH A1): ${checks - fails.length}/${checks} checks`);
fails.forEach((f) => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
