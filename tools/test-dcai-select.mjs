#!/usr/bin/env node
/* PRD-DCAI-HALL-DEPTH Amendment 5 (phase A5d) — the unit an operator opened stays selected, held across lens and view.
   SL1 a click on a CDU, a fan-wall module or a rack (1440 and 390, 2D) opens its HMI as before; after the HMI closes the unit
       carries the selection ring: shown, around that unit, ink (not the warning amber), 2 px
   SL2 the same unit stays selected after Thermal, 3D and back to 2D
   SL3 keyboard: focus the floor, an arrow key, Enter -> the HMI of the unit under the cursor opens; after close it is selected
   SL4 Escape on the floor clears the selection; a fresh load selects nothing
   SL5 the Conventional datahall.html keeps its own ring (accent, 1.5 px): floor-plan.js changes are opt-in
   Red on v3.106.0 (a1c01cecf): the page's capture-phase click handler stops the floor from selecting; Enter opens nothing. */
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

for (const W of [1440, 390]) {
  const pg = await open(W);
  const r0 = await ringOn(pg, 'cdu:7');
  ok('SL4', !r0.shown, `@${W} a fresh load selects nothing`);
  for (const [ref, modal] of UNITS) {
    ok('SL1', await clickUnit(pg, ref), `@${W} ${ref} on the floor`);
    const m = await shownModal(pg);
    ok('SL1', m && m.cls === modal, `@${W} ${ref} click opens ${modal} (got ${m && m.cls})`);
    await closeHmi(pg);
    const r = await ringOn(pg, ref);
    ok('SL1', r.shown && r.around, `@${W} ${ref} selected after the HMI closes (ring shown ${r.shown}, around ${r.around})`);
    ok('SL1', r.shown && r.stroke === r.ink && Math.abs(r.w - 2) < 0.05, `@${W} ${ref} ring is ink 2 px (got ${r.stroke} ${r.w}px, ink ${r.ink})`);
  }
  const ref = UNITS[2][0];
  for (const [step, sel] of [['Thermal', '[data-lens="thermal"]'], ['3D', '[data-view="iso"]'], ['2D', '[data-view="flat"]']]) {
    await press(pg, sel); await wait(1500);
    const r = await ringOn(pg, ref);
    ok('SL2', r.shown && r.around, `@${W} ${ref} still selected after ${step} (shown ${r.shown}, around ${r.around})`);
  }
  await press(pg, '[data-lens="status"]'); await wait(800);
  /* SL3 keyboard */
  const focused = await pg.evaluate(() => { const s = document.querySelector('#hIso svg.fp-svg'); if (!s) return false; s.focus(); return document.activeElement === s; });
  ok('SL3', focused, `@${W} the floor takes focus`);
  await pg.keyboard.press('ArrowRight'); await wait(150); await pg.keyboard.press('ArrowDown'); await wait(150);
  const cur = await pg.evaluate(() => { const s = document.querySelector('#hIso svg.fp-svg'), id = s && s.getAttribute('aria-activedescendant'), e = id && document.getElementById(id);
    return e ? e.getAttribute('data-rz-equipment') : null; });
  ok('SL3', !!cur, `@${W} the cursor sits on a unit with an equipment reference (${cur})`);
  await pg.keyboard.press('Enter'); await wait(900);
  const km = await shownModal(pg);
  ok('SL3', !!km, `@${W} Enter on ${cur} opens its HMI (got ${km && km.cls})`);
  await closeHmi(pg);
  if (cur) { const r = await ringOn(pg, cur); ok('SL3', r.shown && r.around, `@${W} ${cur} selected after its HMI closes`); }
  /* SL4 Escape on the focused floor clears */
  await pg.evaluate(() => document.querySelector('#hIso svg.fp-svg').focus()); await pg.keyboard.press('Escape'); await wait(300);
  ok('SL4', !(await ringOn(pg, cur || ref)).shown, `@${W} Escape on the floor clears the selection`);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `select-${W}.png`) });
  ok('SL1', pg.errors.length === 0, `@${W} page errors: ${pg.errors.join(' | ').slice(0, 200)}`);
  await pg.close();
}

/* SL5 the Conventional data hall keeps its ring */
{
  const pg = await browser.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  await pg.goto(ORIGIN + 'datahall.html', { waitUntil: 'networkidle2', timeout: 90000 }); await wait(1500);
  const r = await pg.evaluate(() => { const ring = document.querySelector('.fp-ring-sel'); if (!ring) return null; const cs = getComputedStyle(ring), root = ring.closest('.fp-root');
    const acc = getComputedStyle(root).getPropertyValue('--fp-accent').trim(), p = document.createElement('span'); p.style.color = acc; document.body.appendChild(p); const a = getComputedStyle(p).color; p.remove();
    return { stroke: cs.stroke, acc: a, w: parseFloat(cs.strokeWidth) }; });
  ok('SL5', !r || (r.stroke === r.acc && Math.abs(r.w - 1.5) < 0.05), `datahall.html ring stays accent 1.5 px (got ${r && r.stroke} ${r && r.w})`);
  await pg.close();
}

await browser.close(); srv.close();
console.log(`${fails.length ? 'FAIL' : 'PASS'} — DC AI floor selection (A5d): ${checks - fails.length}/${checks}`);
fails.forEach((f) => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
