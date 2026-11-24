#!/usr/bin/env node
/* PRD-DCAI-HALL-DEPTH Amendment 4 (phase A5c) — a flag on the Data Hall floor opens the alarms it stands for.
   HV-L1 every visible flag (cdu-pump-fail, leak-z07; 1440 and 390) is a focusable button whose name holds its point
   HV-L2 activating a flag (click at 1440, Enter at 390) opens Alarms & Events: tab selected, Saved view "active", result
         count = the flag's data-alarms = the alarms() records of its point, every row shows that point under this hall;
         the same after normal -> scenario -> normal -> scenario (a cleared alarm never counts as active twice)
   HV-L3 normal: no flag, no chip, and the alarm list keeps Saved view "all"
   Red on 110084672: the flags are spans. */
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

const scen = (pg, sc) => pg.evaluate(async (sc) => {
  const s = document.getElementById('coolingScenario'); s.value = sc; s.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1800));
}, sc);
const toHall = async (pg) => { await pg.evaluate(() => document.querySelector('#tabs [data-t="hall"]').click()); await wait(1500); };
const flags = (pg) => pg.evaluate(() => [...document.querySelectorAll('#hIso .dh-flag, #hIso .dh-flag-more')].filter((f) => f.getClientRects().length).map((f, i) => {
  f.setAttribute('data-fl-i', String(i));
  return { i, tag: f.tagName, cls: f.className, focusable: f.tabIndex >= 0, name: f.getAttribute('aria-label') || f.textContent, point: f.getAttribute('data-alarm-point'),
    alarms: Number(f.getAttribute('data-alarms')), units: Number(f.getAttribute('data-units')) };
}));

for (const W of [1440, 390]) {
  const pg = await open(W);
  ok('HV-L3', await pg.evaluate(() => document.getElementById('alarmSavedView').value === 'all'), `@${W} alarm list starts on Saved view all`);
  ok('HV-L3', (await flags(pg)).length === 0, `@${W} normal shows no flag or chip`);
  for (const [sc, rounds] of [['cdu-pump-fail', 2], ['leak-z07', 2]]) {
    for (let round = 1; round <= rounds; round++) {
      await toHall(pg); await scen(pg, 'normal'); await scen(pg, sc);
      const fs_ = await flags(pg);
      ok('HV-L1', fs_.length >= 1, `@${W} ${sc}#${round} has a flag`);
      for (const f of fs_) ok('HV-L1', f.tag === 'BUTTON' && f.focusable && f.point && f.name.includes(f.point), `@${W} ${sc} flag ${f.name} is a focusable button naming its point (${f.tag}, point ${f.point})`);
      const f = fs_.find((x) => x.cls === 'dh-flag'); if (!f) continue;
      const want = await pg.evaluate((pt) => window.RZHallIso.alarms().filter((a) => a.point === pt).length, f.point);
      ok('HV-L2', f.alarms === want && want > 0, `@${W} ${sc} flag data-alarms ${f.alarms} = alarms() of ${f.point} ${want}`);
      if (W < 500) { await pg.focus(`#hIso [data-fl-i="${f.i}"]`); await pg.keyboard.press('Enter'); } else await pg.click(`#hIso [data-fl-i="${f.i}"]`);
      await wait(900);
      const r = await pg.evaluate(() => {
        const p = document.getElementById('p-alarms'), tab = document.querySelector('#tabs [data-t="alarms"]');
        const rows = [...document.querySelectorAll('#alarmResultsBody tr')].map((tr) => [...tr.cells].map((c) => c.textContent.trim()));
        return { vis: !!p && p.getClientRects().length > 0 && getComputedStyle(p).display !== 'none', sel: tab && (tab.classList.contains('on') || tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true'),
          view: document.getElementById('alarmSavedView').value, count: Number(document.getElementById('alarmResultCount').textContent), rows, hall: 'DH-' + String(window.currentDH || 1).padStart(2, '0') };
      });
      ok('HV-L2', r.vis && r.sel, `@${W} ${sc}#${round} Alarms & Events shown and selected (${r.vis}/${r.sel})`);
      ok('HV-L2', r.view === 'active', `@${W} ${sc}#${round} Saved view ${r.view}`);
      ok('HV-L2', r.count === f.alarms && r.rows.length === f.alarms, `@${W} ${sc}#${round} result count ${r.count} rows ${r.rows.length} = flag ${f.alarms}`);
      ok('HV-L2', r.rows.every((c) => c[3].endsWith('/ ' + f.point) && c[4].includes(r.hall + '/')), `@${W} ${sc}#${round} every row shows ${f.point} under ${r.hall}: ${JSON.stringify(r.rows.slice(0, 1))}`);
      await pg.evaluate(() => document.getElementById('alarmFilterForm').reset()); await wait(300);
      await pg.evaluate(() => { const s = document.getElementById('alarmSavedView'); s.value = 'all'; s.dispatchEvent(new Event('change')); });
    }
  }
  ok('HV-L', pg.errors.length === 0, `@${W} page errors: ${pg.errors.slice(0, 2).join(' | ')}`);
  await pg.close();
}
await browser.close(); srv.close();
console.log(`${fails.length ? 'FAIL' : 'PASS'} — DC AI flag opens its alarms (A5c): ${checks - fails.length}/${checks}`);
fails.forEach((f) => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
