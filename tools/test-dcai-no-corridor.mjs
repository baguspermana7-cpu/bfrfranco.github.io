#!/usr/bin/env node
/* PRD-DCAI-HALL-DEPTH Amendment 9 (owner 2026-11-26 "Gak perlu ada service corridor") — the hall has no service corridor.
   NC2 floor (2D and 3D, Status and Cooling, 1440 and 390): no text naming a corridor in #hIso; at 1440 in 2D the CDU line's
       north face is <= 1.05 m (to scale) from the rack row ends, and the south gallery starts <= 1.05 m behind the CDUs
   NC3 Drawing view: no text naming a service corridor; the TCS supply / return headers are drawn inside the CDU line's
       1 m aisle at the row ends; the hall drawn is engine width x length
   NC5 0 page errors
   Red on 5b99e45c7: "SERVICE CORRIDOR · 4.6 m" on the floor, 4.6 m between rows and CDUs, headers in the corridor. */
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
const corrText = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel + ' text')].map((t) => t.textContent).filter((t) => /corridor/i.test(t)), sel);

for (const W of [1440, 390]) {
  const pg = await open(W);
  for (const v of ['2d', '3d']) {
    await viewTo(pg, v);
    for (const l of ['status', 'cooling']) {
      await lensTo(pg, l);
      const t = await corrText(pg, '#hIso');
      ok('NC2', t.length === 0, `${W} ${v} ${l}: corridor text on the floor: ${t.slice(0, 2).join(' | ')}`);
      if (SHOTS && l === 'status') await pg.screenshot({ path: `${SHOTS}/nc-${W}-${v}.png` });
    }
  }
  if (W === 1440) {
    await viewTo(pg, '2d'); await lensTo(pg, 'status');
    const r = await pg.evaluate(() => {
      const g = window.DCAI_CALC.snapshot.geometry, svg = document.querySelector('#hIso svg.fp-svg') || document.querySelector('#hIso svg');
      const sl = svg.querySelector('.fp-slab').getBBox(), u = sl.width / g.hall_length_m, m = (v) => v / u;
      const bb = (e) => e.getBBox();
      const racks = [...svg.querySelectorAll('.rk-top')].map(bb), cdu = [...svg.querySelectorAll('[data-gallery="cdu"] .crah-cell .cr-top')].map(bb);
      const south = [...svg.querySelectorAll('[data-gallery="south"] .crah-cell .cr-top')].map(bb);
      if (!racks.length || !cdu.length || !south.length) return { err: `racks ${racks.length} cdu ${cdu.length} south ${south.length}` };
      const rowEnd = Math.max(...racks.map((b) => b.y + b.height)), cduTop = Math.min(...cdu.map((b) => b.y)), cduBot = Math.max(...cdu.map((b) => b.y + b.height));
      const sTop = Math.min(...south.map((b) => b.y));
      return { gap: m(cduTop - rowEnd), back: m(sTop - cduBot), W: g.hall_width_m, xa: g.cross_aisle_m };
    });
    if (r.err) ok('NC2', false, r.err);
    else {
      ok('NC2', r.gap >= 0 && r.gap <= 1.05, `rack row ends to CDU face ${r.gap.toFixed(2)} m (want <= 1.05; corridor ${r.xa} m)`);
      ok('NC2', r.back >= -0.05 && r.back <= 1.05, `CDU back to south gallery ${r.back.toFixed(2)} m (want <= 1.05, hall ${r.W} m)`);
    }
    await viewTo(pg, 'drawing');
    const d = await pg.evaluate(() => {
      const Z = window.__hallZones, g = window.DCAI_CALC.snapshot.geometry, gd = g.air_plant_m2 / (g.fan_wall_galleries * g.hall_length_m);
      const yC1 = Z.hy0 + (gd + g.row_length_m + g.cross_aisle_m) * Z.ppm, yA1 = yC1 + 1 * Z.ppm;
      const txt = [...document.querySelectorAll('#hSvg text')].map((t) => t.textContent).filter((t) => /corridor/i.test(t));
      const hdr = [...document.querySelectorAll('#hSvg .hp-ly-liquid line[stroke-width="3"]')].filter((l) => l.getAttribute('y1') === l.getAttribute('y2')).map((l) => +l.getAttribute('y1'));
      return { txt, hdr, yC1, yA1, wm: Z.wm, lm: Z.lm, W: g.hall_width_m, L: g.hall_length_m };
    });
    ok('NC3', d.txt.length === 0, `Drawing view names a corridor: ${d.txt.slice(0, 2).join(' | ')}`);
    ok('NC3', d.hdr.length === 2 && d.hdr.every((y) => y >= d.yC1 - 0.5 && y <= d.yA1 + 0.5), `TCS headers at y ${d.hdr.join(', ')} outside the row-end aisle ${d.yC1.toFixed(1)}-${d.yA1.toFixed(1)}`);
    ok('NC3', d.wm === d.W && d.lm === d.L, `Drawing hall ${d.lm} x ${d.wm} vs engine ${d.L} x ${d.W}`);
    if (SHOTS) { const el = await pg.$('#hSvg'); if (el) await el.screenshot({ path: `${SHOTS}/nc-drawing.png` }); }
  }
  ok('NC5', pg.errors.length === 0, `${W}: page errors ${pg.errors.slice(0, 2).join(' | ')}`);
  await pg.close();
}
await browser.close(); srv.close();
if (fails.length) { console.log(`DC AI NO CORRIDOR — ${checks - fails.length}/${checks}, ${fails.length} FAILED`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`PASS DC AI no service corridor — ${checks} checks (NC2 floor, NC3 Drawing view, NC5 errors)`);
