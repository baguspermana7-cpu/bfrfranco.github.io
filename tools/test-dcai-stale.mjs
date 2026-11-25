#!/usr/bin/env node
/* PRD-DCAI-HALL-DEPTH Amendment 6 (phase A5e) — a unit whose telemetry has no sample looks stale, never running.
   ST1 replay with no sample for any point (1440 and 390, 2D): every running CDU and fan-wall unit whose own HMI payload holds a
       replay row without a sample (counted here from the payloads) carries the stale lamp, and only those; a stale lamp
       is a dotted muted ring, no run green
   ST2 a stale unit's tooltip says "no sample" and does not say "running"; the table State column says stale
   ST3 under that replay the CDU, fan-wall and rack HMIs print no "null", "NaN" or "undefined"
   ST4 the status strip Stale count = the stale units of this hall; normal and a cleared replay: 0 stale lamps, Stale 0
   ST5 the legend lists "stale" while a stale lamp is on the floor, and not otherwise
   ST6 under that replay, one HMI of every equipment class on every tab opens with no page error and prints no "null" or "NaN"
   Red on 3f3c82fa9: every lamp stays run under a no-sample replay; the CDU HMI prints "P1 null%"; Stale reads 0. */
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


const NOSAMPLE = () => window.RZDatahallAISimTelemetry.setProvider(() => ({ value: null, quality: 'replay' }), { source: 'test-dcai-stale no-sample fixture' });
const CLEAR = () => window.RZDatahallAISimTelemetry.setProvider(null);
const repaint = async (pg) => { await pg.evaluate(() => { const s = document.getElementById('coolingScenario'); s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2600); };
/* the test's own count: units whose payload holds a replay row without a sample */
const expected = (pg) => pg.evaluate(() => {
  const P = window.RZDatahallAIHmiPayloads, ctx = P.buildContext(window, { hall: window.currentDH || 1, noTrend: true }), out = [];
  document.querySelectorAll('#hIso [data-rz-equipment^="cdu:"], #hIso [data-rz-equipment^="crah:"]').forEach((g) => {
    if (g.getAttribute('data-state') === 'standby') return;   /* a standby unit keeps its standby lamp: its state is the command, not a reading */
    const ref = g.getAttribute('data-rz-equipment'), m = /^(crah|cdu):(\d+)$/.exec(ref), p = P.payload(m[1], m[2], ctx);
    const rows = []; Object.keys((p && p.tabs) || {}).forEach((k) => { if (Array.isArray(p.tabs[k])) p.tabs[k].forEach((r) => rows.push(r)); });
    if (rows.some((r) => r && r.quality === 'replay' && (r.value == null || r.text === '\u2014'))) out.push(ref);
  });
  return out.sort();
});
const lampsOf = (pg) => pg.evaluate(() => {
  const stale = [], runOnStale = [];
  document.querySelectorAll('#hIso [data-rz-equipment^="cdu:"], #hIso [data-rz-equipment^="crah:"]').forEach((g) => {
    const l = g.querySelector('.cr-lamp'); if (!l) return;
    if (l.getAttribute('data-lamp') === 'stale') { stale.push(g.getAttribute('data-rz-equipment'));
      const cs = getComputedStyle(l); if (cs.fill !== 'none' || cs.strokeDasharray === 'none') runOnStale.push(g.getAttribute('data-rz-equipment') + ' fill ' + cs.fill + ' dash ' + cs.strokeDasharray); }
  });
  const strip = [...document.querySelectorAll('.ab-comms, .am-stale')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
  const legend = [...document.querySelectorAll('.dh-legend .lg-item')].map((e) => e.textContent.trim());
  return { stale: stale.sort(), runOnStale, strip, legend };
});
const tipOf = async (pg, ref) => {
  const pt = await pg.evaluate((ref) => { const e = document.querySelector('#hIso [data-rz-equipment="' + ref + '"]'); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, ref);
  await pg.mouse.move(pt.x, pt.y); await wait(400);
  return pg.evaluate(() => { const t = [...document.querySelectorAll('#hIso .fp-tip')].find((e) => !e.hidden); return t ? t.textContent.replace(/\s+/g, ' ') : ''; });
};
const stripStale = (s) => { const m = s.map((x) => /Stale\s*(\d+)/.exec(x)).filter(Boolean); return m.length ? m.map((x) => +x[1]) : null; };

for (const W of [1440, 390]) {
  const pg = await open(W);
  let L = await lampsOf(pg);
  ok('ST4', L.stale.length === 0, `@${W} normal: ${L.stale.length} stale lamps`);
  ok('ST4', (stripStale(L.strip) || [0]).every((n) => n === 0), `@${W} normal: strip ${JSON.stringify(L.strip)}`);
  ok('ST5', !L.legend.some((t) => /stale/i.test(t)), `@${W} normal: legend ${JSON.stringify(L.legend)}`);
  await pg.evaluate(NOSAMPLE); await repaint(pg);
  const want = await expected(pg);
  L = await lampsOf(pg);
  ok('ST1', want.length > 0, `@${W} the fixture leaves ${want.length} units without a sample`);
  ok('ST1', JSON.stringify(L.stale) === JSON.stringify(want), `@${W} stale lamps ${L.stale.length} = units without a sample ${want.length} (first diff ${L.stale.find((x) => !want.includes(x)) || want.find((x) => !L.stale.includes(x))})`);
  ok('ST1', L.runOnStale.length === 0, `@${W} a stale lamp is a dotted ring, no fill: ${L.runOnStale.slice(0, 2).join(' | ')}`);
  const ss = stripStale(L.strip);
  ok('ST4', ss && ss.every((n) => n === want.length), `@${W} strip Stale = ${want.length}: ${JSON.stringify(L.strip)}`);
  ok('ST5', L.legend.some((t) => /stale/i.test(t)), `@${W} legend lists stale: ${JSON.stringify(L.legend)}`);
  if (W === 1440 && want.length) {
    const tip = await tipOf(pg, want[0]);
    ok('ST2', /no sample/i.test(tip) && !/running/i.test(tip), `@${W} ${want[0]} tooltip: ${tip.slice(0, 160)}`);
    const tb = await pg.evaluate((ref) => { const b = document.querySelector('details.dh-units > summary'); if (b && !b.parentNode.open) b.click();
      return new Promise((r) => setTimeout(() => { const t = document.querySelector('table[data-hall-units]'); if (!t) return r(null);
        const tag = ref.startsWith('cdu:') ? 'CDU-' + String(ref.slice(4)).padStart(2, '0') : 'CRAH-' + ref.slice(5);
        const tr = [...t.querySelectorAll('tr')].find((x) => x.querySelector('th') && x.querySelector('th').textContent === tag); r(tr ? tr.children[1].textContent : 'no row ' + tag); }, 500)); }, want[0]);
    ok('ST2', /stale/i.test(tb || ''), `@${W} ${want[0]} table State: ${tb}`);
  }
  for (const [ref, modal] of [['cdu:7', 'cdu-hmi'], ['crah:03', 'crah-hmi'], ['rack-unit:R03-05', 'rack-modal']]) {
    await clickUnit(pg, ref);
    const m = await pg.evaluate(() => { const m = document.querySelector('.dh-modal-host.show'); return m ? { cls: m.className.split(' ')[0], bad: (m.textContent.match(/\b(null|NaN|undefined)\b/g) || []).length, at: (m.textContent.match(/.{0,30}\b(null|NaN|undefined)\b.{0,10}/) || [''])[0] } : null; });
    ok('ST3', m && m.cls === modal && m.bad === 0, `@${W} ${ref} HMI under no sample: ${m && m.bad} literal null/NaN/undefined (${m && m.at})`);
    await closeHmi(pg);
  }
  await pg.evaluate(CLEAR); await repaint(pg);
  L = await lampsOf(pg);
  const ss0 = stripStale(L.strip) || [0];
  ok('ST4', L.stale.length === 0 && ss0.every((n) => n === 0), `@${W} replay cleared: ${L.stale.length} stale lamps, strip Stale ${JSON.stringify([...new Set(ss0)])}`);
  if (SHOTS) { await pg.evaluate(NOSAMPLE); await repaint(pg); await pg.screenshot({ path: path.join(SHOTS, `stale-${W}.png`) }); }
  ok('ST1', pg.errors.length === 0, `@${W} page errors: ${pg.errors.join(' | ').slice(0, 200)}`);
  await pg.close();
}
/* ST6 every equipment class, every tab, no-sample replay */
{
  const pg = await open(1440);
  await pg.evaluate(NOSAMPLE);
  const tabs = await pg.evaluate(() => [...document.querySelectorAll('#tabs [data-t]')].map((b) => b.getAttribute('data-t')));
  const seen = new Set(); let opened = 0;
  for (const t of tabs) {
    await pg.evaluate((t) => document.querySelector('#tabs [data-t="' + t + '"]').click(), t); await wait(1800);
    const refs = await pg.evaluate(() => { const out = {}; document.querySelectorAll('[data-rz-equipment]').forEach((e) => { if (!e.getClientRects().length) return; const r = e.getAttribute('data-rz-equipment'), c = r.split(':')[0]; if (!out[c]) out[c] = r; }); return out; });
    for (const [cls, ref] of Object.entries(refs)) {
      if (seen.has(cls)) continue; seen.add(cls);
      const before = pg.errors.length;
      await pg.evaluate((ref) => { const e = document.querySelector('[data-rz-equipment="' + ref + '"]'); e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }, ref);
      await wait(900);
      const m = await pg.evaluate(() => { const ms = [...document.querySelectorAll('.dh-modal-host.show, aside.rz-inspector.open')]; return ms.map((x) => ({ cls: x.className.split(' ')[0], bad: (x.textContent.match(/.{0,24}\b(null|NaN|undefined)\b.{0,8}/) || [''])[0] })); });
      if (m.length) opened++;
      ok('ST6', pg.errors.length === before, `${t} ${ref}: page error under no sample: ${pg.errors.slice(before).join(' | ').slice(0, 160)}`);
      ok('ST6', m.every((x) => !x.bad), `${t} ${ref}: ${m.map((x) => x.cls + ' "' + x.bad + '"').join(', ')}`);
      await pg.keyboard.press('Escape'); await wait(300); await pg.keyboard.press('Escape'); await wait(300);
    }
  }
  ok('ST6', seen.size >= 10 && opened >= 10, `classes visited ${seen.size}, opened ${opened}`);
  console.log(`ST6 visited ${seen.size} classes, ${opened} opened: ${[...seen].join(' ')}`);
  await pg.close();
}
await browser.close(); srv.close();
console.log(`${fails.length ? 'FAIL' : 'PASS'} — DC AI stale lamps (A5e): ${checks - fails.length}/${checks}`);
fails.forEach((f) => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
