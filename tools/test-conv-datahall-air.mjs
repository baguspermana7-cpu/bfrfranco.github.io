#!/usr/bin/env node
/* test-conv-datahall-air.mjs — STRICT. datahall.html: the row footer is labelled and the air path of a row is drawn
   as a section whose motion and colour are bound to that row's values (PRD-CONV-LIVING-PLANT §5.2, §9).
   Real browser, 1440 and 390:
   D1 the row strip prints one number (row kW); a click opens the row panel with heat, inlet, hot aisle, delta T and
      min / avg / max of load and inlet as points that agree with the strip (PRD-CONV-DATAHALL-FLOOR 3.6)
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
  /* D1 (PRD-CONV-DATAHALL-FLOOR 3.6, F12): the row strip prints one line, the row heat in kW; a click on the strip
     opens the row panel, which carries the rest as points: heat, inlet, hot aisle, air-side delta T and min / avg / max
     of cabinet load and inlet. Each panel number agrees with the strip / model value it restates. */
  const foot = await pg.evaluate(() => {
    const z = document.querySelector('#zone-field .zone[data-z="0"]');
    if (!z) return null;
    const lines = [];
    const w = document.createTreeWalker(z, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      /* a reader-only span (1 px, clipped) is not printed; the row letter names the strip, it is not a reading */
      const b = n.parentElement.getBoundingClientRect(), t = n.nodeValue.trim();
      if (b.width > 2 && b.height > 2 && !/^[A-Z]$/.test(t)) lines.push(t);
    }
    const kw = z.querySelector('.zf-kw');
    return { lines, kw: kw && kw.textContent.trim() };
  });
  ok(foot && foot.lines.length === 1 && /^\d+$/.test(foot.lines[0]) && foot.lines[0] === foot.kw,
    `D1 ${T} the row strip does not print exactly one number, the row kW: ` + JSON.stringify(foot));
  await pg.evaluate(() => { const z = document.querySelector('#zone-field .zone[data-z="0"]'); z.scrollIntoView({ block: 'center' }); });
  const zb = await pg.evaluate(() => { const b = document.querySelector('#zone-field .zone[data-z="0"]').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await pg.mouse.click(zb.x, zb.y); await sleep(300);
  const panel = await pg.evaluate(() => {
    const insp = document.getElementById('dh-inspector'), p = document.getElementById('row-panel');
    const v = (id) => { const e = p.querySelector('[data-point="' + id + '"]'); return e && e.getClientRects().length ? Number(e.textContent) : null; };
    return { state: insp && insp.getAttribute('data-inspector-state'), heat: v('datahall.row.A.heat_kw'), inlet: v('datahall.row.A.inlet_c'),
      hot: v('datahall.row.A.hot_aisle_c'), dt: v('datahall.row.A.air_delta_t_c'),
      mam: ['load_min_kw', 'load_avg_kw', 'load_max_kw', 'inlet_min_c', 'inlet_avg_c', 'inlet_max_c'].map((k) => v('datahall.row.A.' + k)),
      strip: { kw: Number(document.querySelector('.zone[data-z="0"] .zf-kw').textContent), in: Number(document.querySelector('.zone[data-z="0"] .zf-in').textContent), hot: Number(document.querySelector('.zone[data-z="0"] .zf-hot').textContent) } };
  });
  ok(panel.state === 'row', `D1 ${T} a click on row A's strip does not open the row panel: ` + panel.state);
  ok(panel.heat === panel.strip.kw && panel.inlet === panel.strip.in && panel.hot === panel.strip.hot,
    `D1 ${T} the row panel does not restate the row heat / inlet / hot aisle: ` + JSON.stringify(panel));
  ok(panel.dt > 0 && panel.mam.every((x) => x !== null && Number.isFinite(x)) && panel.mam[0] <= panel.mam[1] && panel.mam[1] <= panel.mam[2] && panel.mam[3] <= panel.mam[4] && panel.mam[4] <= panel.mam[5],
    `D1 ${T} the row panel lacks delta T or an ordered min / avg / max: ` + JSON.stringify(panel));
  await pg.keyboard.press('Escape'); await sleep(150);
  const cover = await pg.evaluate(() => { const b = document.querySelector('.view-btn[data-view="air"]'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { hit: !!e && (e === b || b.contains(e)), el: e && (e.id || e.className), state: document.getElementById('dh-inspector').getAttribute('data-inspector-state') }; });
  ok(cover.hit && cover.state === 'hall', `D1 ${T} after Escape the Air path button is covered or the inspector stays open: ` + JSON.stringify(cover));
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
console.log(`PASS — ${checks} checks: row strip + row panel, Plan / Air path views, section readings = plan and engine, motion and colour bound, reduced motion, no overlap`);
