#!/usr/bin/env node
/* test-conv-datahall-air.mjs — STRICT. datahall.html: the row footer is labelled and the air path of a row is drawn
   as a section whose motion and colour are bound to that row's values (PRD-CONV-LIVING-PLANT §5.2, §9).
   Real browser, 1440 and 390:
   D1 a key column names each of the six footer lines with its unit; every key line sits on the line it names
      (same top, ±1.5 px); the min/max/avg unit follows the mode (°C in temperature, kW in power)
   D2 the stage opens on Plan (section hidden); "Air path" shows the section and hides the plan; pressed states follow
   D3 for the first, a middle and the last row the section's inlet, hot-aisle and row-heat readings EQUAL that row's
      footer numbers on the plan, and supply air / CHWS / CHWR equal the engine planes
   D4 air moves while there is airflow: streamline overlays animate with the period RZConvVfx.dashSeconds gives, the
      fan turns; with zero airflow (simulation seam) no overlay animates, the fan is still, lines turn dashed grey
   D5 colour is temperature: a cold line is bluer than red, a hot line redder than blue; an inlet above the alarm limit
      (seam) paints the inlet reading in the alarm colour
   D6 reduced motion: nothing animates, arrowheads remain
   D7 no reading overlaps another reading in the drawing; no page error; the page does not scroll sideways at 390
   Usage: node tools/test-conv-datahall-air.mjs [--shots=<dir>] */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(W, reduced) {
  const pg = await browser.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844 });
  if (reduced) await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + 'datahall.html', { waitUntil: 'networkidle0', timeout: 90000 });
  await enterAuthorizedAuditState(pg, 'datahall');
  await sleep(2000);
  return { pg, errs };
}
const motion = () => {
  const svg = document.querySelector('#air-sec-host .as-svg');
  const anim = (sel) => [...svg.querySelectorAll(sel)].filter((p) => { const c = getComputedStyle(p); return c.display !== 'none' && c.animationName !== 'none'; });
  const air = anim('.as-flow.as-cold, .as-flow.as-hot, .as-flow.as-thr'), fan = getComputedStyle(svg.querySelector('.as-fan'));
  const cold = getComputedStyle(svg.querySelector('.as-line.as-cold')), hot = getComputedStyle(svg.querySelector('.as-line.as-hot'));
  return { air: air.length, airDur: air[0] ? getComputedStyle(air[0]).animationDuration : null, chw: anim('.as-flow.as-chws, .as-flow.as-chwr').length,
    fan: fan.animationName !== 'none', fanDur: fan.animationDuration, cold: cold.stroke, hot: hot.stroke, coldDash: cold.strokeDasharray,
    markers: svg.querySelectorAll('[marker-end]').length, vstate: svg.getAttribute('data-vstate'), inletFill: getComputedStyle(svg.querySelector('[data-as="inlet"]')).fill };
};
const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);

for (const W of [1440, 390]) {
  const { pg, errs } = await open(W, false);
  const T = `datahall@${W}`;
  /* D1 */
  const key = await pg.evaluate(() => {
    const k = document.querySelector('.zone-key .zk-foot'), z = document.querySelector('.zone[data-z="0"] .zone-foot');
    if (!k || !z) return null;
    const tops = (root) => { const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; const r = document.createRange(); r.selectNodeContents(n); out.push({ t: n.nodeValue.trim(), top: r.getBoundingClientRect().top }); } return out; };
    return { key: tops(k), row: tops(z), unit: document.getElementById('zk-unit').textContent };
  });
  ok(key && key.key.length === 6 && key.row.length === 6, `D1 ${T} key column / footer lines: ` + JSON.stringify(key && [key.key.length, key.row.length]));
  if (key && key.key.length === 6 && key.row.length === 6) {
    const off = key.key.map((k, i) => Math.abs(k.top - key.row[i].top));
    ok(Math.max(...off) <= 1.5, `D1 ${T} a key line is not on the line it names (px offsets ${off.map((o) => o.toFixed(1))})`);
    ok(key.key.map((k) => k.t).join('|') === 'kW|in °C|hot °C|min °C|max °C|avg °C', `D1 ${T} key labels in temperature mode: ` + key.key.map((k) => k.t).join('|'));
    ok(key.row.every((r) => /^\d+(\.\d)?$/.test(r.t)), `D1 ${T} footer line is not a number: ` + key.row.map((r) => r.t).join('|'));
    await pg.evaluate(() => window.setMode('power'));
    const kp = await pg.evaluate(() => [...document.querySelectorAll('.zone-key .zk-foot > span')].map((s) => s.textContent).join('|') + ' / ' + document.getElementById('zk-unit').textContent);
    ok(kp === 'kW|in °C|hot °C|min kW|max kW|avg kW / rack kW', `D1 ${T} key labels in power mode: ` + kp);
    await pg.evaluate(() => window.setMode('temp'));
  }
  /* D2 */
  const vis = () => pg.evaluate(() => { const v = (s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0; };
    return { floor: v('#zone-field'), sec: v('#air-sec'), svg: v('#air-sec-host .as-svg'), pressed: [...document.querySelectorAll('.view-btn')].map((b) => b.getAttribute('data-view') + '=' + b.getAttribute('aria-pressed')).join() }; });
  const v0 = await vis();
  ok(v0.floor && !v0.sec && v0.pressed === 'plan=true,air=false', `D2 ${T} the stage does not open on Plan: ` + JSON.stringify(v0));
  await pg.click('.view-btn[data-view="air"]'); await sleep(300);
  const v1 = await vis();
  ok(!v1.floor && v1.sec && v1.svg && v1.pressed === 'plan=false,air=true', `D2 ${T} "Air path" does not show the section: ` + JSON.stringify(v1));
  /* D3 */
  const rows = await pg.evaluate(() => {
    const n = document.querySelectorAll('.zone[data-z]').length, pick = [0, Math.floor(n / 2), n - 1], out = [];
    const g = (k) => document.querySelector('#air-sec-host [data-as="' + k + '"]').textContent;
    const S = window.CONV_CALC.snapshot;
    pick.forEach((z) => {
      window.__sectionRow(z);
      const f = document.querySelector('.zone[data-z="' + z + '"] .zone-foot');
      out.push({ z, sec: [g('heat'), g('inlet'), g('hot')], plan: [f.querySelector('.zf-kw').textContent, f.querySelector('.zf-in').textContent, f.querySelector('.zf-hot').textContent],
        row: g('row'), pressed: document.querySelector('.as-row-btn[aria-pressed="true"]').textContent, title: document.getElementById('air-sec-title').textContent,
        eng: [g('supply'), g('chws'), g('chwr')], want: S ? [S.cooling.crah_supply_air_c.toFixed(1), S.cooling.chws_c.toFixed(1), S.cooling.chwr_c.toFixed(1)] : null });
    });
    return { n, out };
  });
  ok(rows.n >= 3, `D3 ${T} rows on the plan: ${rows.n}`);
  rows.out.forEach((r) => {
    ok(r.sec.join() === r.plan.join(), `D3 ${T} row ${r.row}: section ${r.sec} ≠ plan footer ${r.plan}`);
    ok(r.row === String.fromCharCode(65 + r.z) && r.pressed === r.row && r.title.includes('Row ' + r.row), `D3 ${T} row ${r.z} is not the one named: ` + JSON.stringify([r.row, r.pressed, r.title]));
    ok(r.want && r.eng.join() === r.want.join(), `D3 ${T} engine planes: section ${r.eng} ≠ engine ${r.want}`);
  });
  if (W === 1440) {
    /* D4 + D5 */
    const run = await pg.evaluate(motion);
    const want = await pg.evaluate(() => { const d = window.__airSectionData(); return { air: window.RZConvVfx.dashSeconds(d.airflowM3s / d.designAirflowM3s), fan: window.RZConvVfx.rotorSeconds(d.fanPct) }; });
    ok(run.air === 18 && run.airDur === want.air + 's', `D4 ${T} streamlines moving ${run.air}/18 at ${run.airDur}, want ${want.air}s`);
    ok(run.fan && run.fanDur === want.fan + 's' && run.chw === 2, `D4 ${T} fan ${run.fan} ${run.fanDur} (want ${want.fan}s), CHW moving ${run.chw}/2`);
    const c = rgb(run.cold), h = rgb(run.hot);
    ok(c[2] > c[0] && h[0] > h[2], `D5 ${T} cold ${run.cold} / hot ${run.hot} are not blue / red`);
    ok(run.coldDash === 'none', `D4 ${T} a flowing line is dashed: ${run.coldDash}`);
    const still = await pg.evaluate((fn) => { const h = document.getElementById('air-sec-host'), d = window.__airSectionData(); window.RZAirSection.update(h, Object.assign({}, d, { airflowM3s: 0 })); return (0, eval)('(' + fn + ')')(); }, motion.toString());
    ok(still.air === 0 && !still.fan && still.chw === 0, `D4 ${T} zero airflow still moves: ` + JSON.stringify({ air: still.air, fan: still.fan, chw: still.chw }));
    ok(still.coldDash !== 'none' && still.vstate === 'stopped', `D4 ${T} zero airflow is not drawn stopped: ${still.coldDash} ${still.vstate}`);
    const hotIn = await pg.evaluate((fn) => { const h = document.getElementById('air-sec-host'), d = window.__airSectionData(); window.RZAirSection.update(h, Object.assign({}, d, { inletC: d.alarmC + 0.6 }));
      const p = document.createElement('i'); p.style.color = 'var(--vfx-alarm)'; h.appendChild(p); const a = getComputedStyle(p).color; p.remove(); return Object.assign((0, eval)('(' + fn + ')')(), { alarm: a }); }, motion.toString());
    ok(hotIn.vstate === 'alarm' && hotIn.inletFill === hotIn.alarm, `D5 ${T} inlet above the alarm limit: state ${hotIn.vstate}, fill ${hotIn.inletFill} want ${hotIn.alarm}`);
    await pg.evaluate(() => window.__sectionRow(0));
    /* D7 text overlap */
    const clash = await pg.evaluate(() => { const t = [...document.querySelectorAll('#air-sec-host .as-svg text')].map((e) => ({ s: e.textContent, r: e.getBoundingClientRect() })), out = [];
      for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const a = t[i].r, b = t[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 2 && b.top < a.bottom - 2) out.push(t[i].s + ' × ' + t[j].s); } return out; });
    ok(clash.length === 0, `D7 ${T} readings overlap: ` + JSON.stringify(clash.slice(0, 4)));
  }
  const over = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok(!over, `D7 ${T} the page scrolls sideways`);
  ok(errs.length === 0, `D7 ${T} page errors: ` + errs.slice(0, 3).join(' | '));
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `datahall-air-${W}.png`), fullPage: true });
  await pg.close();
}
/* D6 */
{
  const { pg } = await open(1440, true);
  await pg.click('.view-btn[data-view="air"]'); await sleep(300);
  const r = await pg.evaluate(motion);
  ok(r.air === 0 && !r.fan && r.chw === 0, 'D6 reduced motion still animates: ' + JSON.stringify({ air: r.air, fan: r.fan, chw: r.chw }));
  ok(r.markers >= 4, 'D6 reduced motion lost the direction arrowheads: ' + r.markers);
  await pg.close();
}
await browser.close(); srv.close();
if (fails.length) { console.error(`FAIL — ${fails.length} of ${checks} checks`); fails.forEach((f) => console.error('  ✗ ' + f)); process.exit(1); }
console.log(`PASS — ${checks} checks: labelled row footer, Plan / Air path views, section readings = plan and engine, motion and colour bound, reduced motion, no overlap`);
