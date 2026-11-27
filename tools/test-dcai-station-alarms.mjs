#!/usr/bin/env node
/* PRD-DCAI-HALL-DEPTH Amendment 8 (A8e, laws SA2/SA3) — a cold aisle point that runs warm is an alarm, not only a colour.
   SA2  a cold point forced to 28.4 °C (> 27) raises ONE floor flag anchored on that station and ONE active alarm record
        (tag TT-CA<pair>-<point>, point INLET, severity high) in the hall's alarm set; the flag opens Alarms & Events
        filtered to it and the result list holds a row naming the tag.
   SA2b forced to 31.0 °C (> 30) the same point is severity critical and its flag reads alarm.
   SA2c back to a normal reading: the flag and the active alarm are gone.
   SA3  a point without a reading (replay without a sample, the readout shows "—") is stale (dotted) and raises no alarm.
   SA4  0 page errors.
   The page rewrites every readout each 3 s, so the gate pins its planted value every 200 ms.
   Red on f48da5f9a: a 28.4 °C point painted its aisle amber, but raised no flag and no alarm record. */
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

const TAG = 'TT-CA02-3';   /* pair 1 (R03/04), point index 2 -> readout C12t */
const pin = (pg, v) => pg.evaluate((v) => {
  clearInterval(window.__saPin);
  const put = () => { const e = document.getElementById('C12t'); if (e) e.textContent = v; document.dispatchEvent(new CustomEvent('rz-hall-readings')); };
  put(); window.__saPin = v == null ? 0 : setInterval(put, 200);
}, v);
const read = (pg) => pg.evaluate((tag) => {
  const flags = [...document.querySelectorAll('#hIso .dh-flag')].filter((f) => f.textContent.includes(tag));
  const al = (window.RZHallIso && window.RZHallIso.alarms ? window.RZHallIso.alarms() : []).filter((a) => a.tag === tag);
  const st = document.querySelector('#hIso .fp-ovl .ovl-st[data-side="cold"][data-z="1"][data-s="2"]');
  return { flags: flags.map((f) => ({ sev: f.getAttribute('data-sev'), point: f.getAttribute('data-alarm-point'), text: f.textContent, btn: f.tagName === 'BUTTON' })),
    al, stState: st && st.getAttribute('data-state') };
}, TAG);

const pg = await open(1440);
await lensTo(pg, 'thermal');
let r = await read(pg);
ok('SA2', r.flags.length === 0 && r.al.length === 0, `at rest ${TAG} already flagged/alarmed: ${JSON.stringify(r)}`);

await pin(pg, '28.4'); await wait(900);
r = await read(pg);
ok('SA2', r.stState === 'warn', `planted 28.4: station state ${r.stState}, want warn`);
ok('SA2', r.flags.length === 1 && r.flags[0].sev === 'warn' && r.flags[0].btn, `planted 28.4: ${r.flags.length} flag(s) naming ${TAG} ${JSON.stringify(r.flags)}, want 1 warn button`);
ok('SA2', r.al.length === 1 && r.al[0].point === 'INLET' && r.al[0].severity === 'high' && /28\.4/.test(r.al[0].message), `planted 28.4: alarm records ${JSON.stringify(r.al)}`);
if (r.flags.length === 1) {
  await pg.evaluate((tag) => { const f = [...document.querySelectorAll('#hIso .dh-flag')].find((x) => x.textContent.includes(tag)); f.click(); }, TAG);
  await wait(1500);
  const L = await pg.evaluate(() => ({ tab: ((p) => (p && p.getClientRects().length > 0 && getComputedStyle(p).display !== 'none' ? 'alarms' : 'not shown'))(document.getElementById('p-alarms')),
    point: document.getElementById('alarmPoint').value, rows: [...document.querySelectorAll('#alarmResultsBody tr')].map((tr) => tr.textContent) }));
  ok('SA2', L.tab === 'alarms', `flag click opened tab ${L.tab}, want alarms`);
  ok('SA2', L.rows.some((t) => t.includes(TAG)), `Alarms & Events after the flag (filter "${L.point}"): ${L.rows.length} rows, none names ${TAG}`);
  await pg.evaluate(() => { const b = document.querySelector('#tabs [data-t="hall"]'); if (b) b.click(); }); await wait(1500);
}

await pin(pg, '31.0'); await wait(900);
r = await read(pg);
ok('SA2b', r.stState === 'alarm' && r.flags.length === 1 && r.flags[0].sev === 'alarm' && r.al.length === 1 && r.al[0].severity === 'critical', `planted 31.0: ${JSON.stringify(r)}`);

await pin(pg, '25.6'); await wait(900);
r = await read(pg);
ok('SA2c', r.stState === 'ok' && r.flags.length === 0 && r.al.length === 0, `back to 25.6: ${JSON.stringify(r)}`);

await pin(pg, '\u2014'); await wait(900);
r = await read(pg);
ok('SA3', r.stState === 'stale' && r.flags.length === 0 && r.al.length === 0, `no sample: ${JSON.stringify(r)}`);
await pin(pg, null);

ok('SA4', pg.errors.length === 0, `page errors: ${pg.errors.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
if (fails.length) { console.log(`DC AI STATION ALARMS — ${checks - fails.length}/${checks}, ${fails.length} FAILED`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`PASS DC AI station alarms — ${checks} checks (SA2-SA4)`);
