#!/usr/bin/env node
/* test-conv-vfx-trend.mjs — STRICT. Process-bound colour/motion (js/conv/vfx.js) and the trend modal (js/rz-trend.js)
   on the chiller plant, in a real browser (PRD-CONV-LIVING-PLANT §4, §5.1, §7).
   VFX
   B1 the view bar is mounted; default mode "state"; the four modes switch the frame attribute and aria-pressed
   B2 state mode: a running line's painted stroke is the running colour, or (PRD-CONV-BMS-LIVE L2) its medium colour for
      a medium pipe, never the standby colour; after RZConvSim stops a train's pump the
      lines of that branch are no longer "running" and their flow dashes are hidden (0 motion at 0 flow)
   B3 flow speed follows flow: the dash period on a branch = RZConvVfx.dashSeconds(flow / design) (±0.02 s)
   B4 pump rotor: the duty pump's rotor spins with a period = rotorSeconds(speed); the standby pump's does not
   B5 thermal mode: supply and return headers paint different colours, supply bluer (b > r), return redder (r > b)
   B6 reduced motion: no running animation on flow or rotor; data-vstate and dash patterns remain
   B7 every state has a second signal: warning / alarm / mismatch / unavailable / stopped lines carry a dash pattern
   TREND
   T1 a click on a simulated reading in the inspector opens the trend with that point as pen 1
   T2 adding a series draws two pens; the table lists both with units
   T3 a click on the plot sets a cursor; its readout lies inside the series min..max; ArrowLeft moves it back
   T4 range buttons change the window; CSV has 1 header + one row per sample and names the unit and SIM
   T5 Esc closes the trend first, the inspector (or the equipment modal it was opened from) stays; focus returns to the reading; nothing left inert
   T6 390 px: no horizontal overflow of the page or the panel
   Usage: node tools/test-conv-vfx-trend.mjs [--shots=<dir>] */
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
const HOST = '#chw-sheet-host';

async function load(W, theme, reduced) {
  const pg = await browser.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.__errs = errs;
  await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844 });
  if (reduced) await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await primeCockpitAuditDocument(pg, theme);
  await pg.goto(ORIGIN + 'chiller-plant.html', { waitUntil: 'networkidle0', timeout: 90000 });
  await enterAuthorizedAuditState(pg, 'chiller-plant');
  await sleep(2500);
  return pg;
}
const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);

/* ── VFX at 1440 dark ─────────────────────────────────────────────────────────────────── */
{
  const pg = await load(1440, 'dark');
  const b1 = await pg.evaluate((H) => { const f = document.querySelector(H + ' .hmi-frame'); return { bar: !!f.querySelector('.vfx-bar'), mode: f.getAttribute('data-vfx-mode'), n: f.querySelectorAll('[data-vfx-set]').length, legend: f.querySelectorAll('.vfx-lg').length }; }, HOST);
  ok(await pg.evaluate((H) => { const h = document.querySelector(H); return h.querySelector('svg') === h.querySelector('svg.hmi-svg'); }, HOST), 'B1 the first <svg> under the sheet host is no longer the sheet');
  ok(b1.bar && b1.n === 4 && b1.legend >= 7, 'B1 view bar / 4 modes / legend missing: ' + JSON.stringify(b1));
  ok(b1.mode === 'state', 'B1 default mode is ' + b1.mode);
  for (const m of ['thermal', 'medium', 'flat', 'state']) {
    await pg.click(`${HOST} [data-vfx-set="${m}"]`); await sleep(60);
    const r = await pg.evaluate((H, m) => { const f = document.querySelector(H + ' .hmi-frame'); return f.getAttribute('data-vfx-mode') === m && f.querySelector('[data-vfx-set="' + m + '"]').getAttribute('aria-pressed') === 'true'; }, HOST, m);
    ok(r, 'B1 mode ' + m + ' not applied');
  }
  const snap = () => pg.evaluate((H) => {
    const svg = document.querySelector(H + ' svg.hmi-svg'), out = { edges: {}, run: null, counts: {} };
    svg.querySelectorAll('path[data-edge][data-vstate]').forEach((p) => {
      const st = p.getAttribute('data-vstate'); out.counts[st] = (out.counts[st] || 0) + 1;
      const f = svg.querySelector('path[data-edge-flow="' + p.getAttribute('data-edge') + '"]'), cs = getComputedStyle(p), fc = f ? getComputedStyle(f) : null;
      out.edges[p.getAttribute('data-edge')] = { st, med: /(^|\s)m-(chw|cw|fw|pw|dr|fuel|agent|htw|tcs_s|tcs_r)(\s|$)/.test(p.getAttribute('class') || ''), stroke: cs.stroke, dash: cs.strokeDasharray, flowShown: fc ? fc.display !== 'none' : false, anim: fc ? fc.animationName : 'none', dur: fc ? parseFloat(fc.animationDuration) : 0 };
    });
    const probe = document.createElement('i'); probe.style.color = 'var(--vfx-run)'; document.querySelector(H).appendChild(probe); out.run = getComputedStyle(probe).color; probe.style.color = 'var(--vfx-stby)'; out.stby = getComputedStyle(probe).color; probe.remove();
    return out;
  }, HOST);
  let s = await snap();
  const running = Object.entries(s.edges).filter(([, e]) => e.st === 'running');
  ok(running.length >= 10, 'B2 fewer than 10 running lines at the design point: ' + JSON.stringify(s.counts));
  const runOk = (e) => e.stroke === s.run || (e.med && e.stroke !== s.stby && e.stroke !== 'none');
  ok(running.every(([, e]) => runOk(e)), 'B2 a running line is not painted the running (or its medium) colour: ' + JSON.stringify((running.find(([, e]) => !runOk(e)) || []).concat(s.run)));
  ok(running.every(([, e]) => e.flowShown && e.anim !== 'none'), 'B2 a running line shows no moving flow');
  /* B3: branch of train 1 */
  const b3 = await pg.evaluate(() => { const lp = st.loops[0]; return { want: window.RZConvVfx.dashSeconds(lp.flow / LOOP_FLOW_DESIGN), id: 'e-s1' }; });
  ok(s.edges[b3.id] && Math.abs(s.edges[b3.id].dur - b3.want) <= 0.02, `B3 dash period on ${b3.id}: ${s.edges[b3.id] && s.edges[b3.id].dur} vs ${b3.want}`);
  /* B4: rotors */
  const b4 = await pg.evaluate((H) => { const lp = st.loops[0], duty = lp.pumpA ? 'pa1' : 'pb1', stby = lp.pumpA ? 'pb1' : 'pa1';
    const r = (id) => { const e = document.querySelector(H + ' .hmi-node[data-node="' + id + '"] .vfx-rotor'); if (!e) return null; const c = getComputedStyle(e); return { anim: c.animationName, dur: parseFloat(c.animationDuration) }; };
    return { duty: r(duty), stby: r(stby), want: window.RZConvVfx.rotorSeconds(lp.pumpA ? lp.spdA : lp.spdB) }; }, HOST);
  ok(b4.duty && b4.duty.anim === 'vfx-turn' && Math.abs(b4.duty.dur - b4.want) <= 0.02, 'B4 duty pump rotor: ' + JSON.stringify(b4));
  ok(b4.stby && b4.stby.anim === 'none', 'B4 standby pump rotor turns: ' + JSON.stringify(b4.stby));
  if (SHOTS) await (await pg.$(HOST)).screenshot({ path: path.join(SHOTS, 'chiller-state-dark-1440.png') });
  /* B2b: stop train 1's duty pump through the simulation seam */
  const stopped = await pg.evaluate(() => { if (!window.RZConvSim) return 'no seam'; const lp = st.loops[0], id = lp.pumpA ? 'pa1' : 'pb1'; try { window.RZConvSim.setPump(id, { cmd: 'off', fb: 'off' }); return id; } catch (e) { return 'err ' + e.message; } });
  await sleep(400);
  s = await snap();
  const br = ['e-' + stopped + 's', 'e-' + stopped + 'd'].map((id) => s.edges[id]).filter(Boolean);
  ok(br.length > 0 && br.every((e) => e.st !== 'running' && !e.flowShown), `B2 pump ${stopped} stopped but its branch still runs: ` + JSON.stringify(br));
  ok(br.every((e) => e.dash && e.dash !== 'none'), 'B7 a stopped line has no dash pattern');
  /* B2b: a train whose pumps are both off moves no water: its supply, return and evaporator legs stop too, the other trains keep running */
  const tr = ['e-s1', 'e-s1a', 'e-r1', 'e-ev1'].map((id) => [id, s.edges[id] && s.edges[id].st, s.edges[id] && s.edges[id].flowShown]);
  ok(tr.every((x) => x[1] === 'stopped' && !x[2]) && s.edges['e-s2'].st === 'running', 'B2b train 1 has no pump running but its lines still run: ' + JSON.stringify(tr));
  if (SHOTS) await (await pg.$(HOST)).screenshot({ path: path.join(SHOTS, 'chiller-state-pump-stopped-1440.png') });
  /* B7: every non-running state has a pattern */
  const pat = await pg.evaluate((H) => { const svg = document.querySelector(H + ' svg.hmi-svg'), p = svg.querySelector('path[data-edge][data-vstate]'), keep = p.getAttribute('data-vstate'), o = {};
    ['warning', 'alarm', 'mismatch', 'unavailable'].forEach((st) => { p.setAttribute('data-vstate', st); o[st] = getComputedStyle(p).strokeDasharray; }); p.setAttribute('data-vstate', keep); return o; }, HOST);
  ok(Object.values(pat).every((d) => d && d !== 'none') && new Set(Object.values(pat)).size === 4, 'B7 state patterns not distinct: ' + JSON.stringify(pat));
  /* B5: thermal */
  await pg.click(`${HOST} [data-vfx-set="thermal"]`); await sleep(100);
  s = await snap();
  const sup = rgb(s.edges['e-hs4'] ? s.edges['e-hs4'].stroke : ''), ret = rgb(s.edges['e-hr4'] ? s.edges['e-hr4'].stroke : '');
  ok(sup.length === 3 && ret.length === 3 && sup[2] > sup[0] && ret[0] > ret[2], `B5 thermal: supply ${sup} return ${ret}`);
  /* B5b: every running chilled-water line carries a temperature colour; pump branches and the evaporator leg sit on the return side */
  const b5b = await pg.evaluate((h) => { const grey = [], side = {};
    const ch = (c) => (c.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    window.RZChillerSheets.pid.edges.filter((e) => e.medium === 'chw').forEach((e) => {
      const p = document.querySelector(h + ' path.hmi-edge[data-edge="' + e.id + '"]'); if (!p || p.getAttribute('data-vstate') !== 'running') return;
      const c = ch(getComputedStyle(p).stroke); if (Math.max(...c) - Math.min(...c) < 40) grey.push(e.id); side[e.id] = c[0] > c[2] ? 'return' : 'supply'; });
    const hot = [...document.querySelectorAll(h + ' path.hmi-edge[data-vstate="stopped"], ' + h + ' path.hmi-edge[data-vstate="unavailable"]')].filter((p) => !/hmi-(flow|edge-shadow|edge-hi)/.test(p.getAttribute('class')))
      .filter((p) => { const c = ch(getComputedStyle(p).stroke); return Math.max(...c) - Math.min(...c) >= 40; }).map((p) => p.getAttribute('data-edge'));
    return { hot, grey, n: Object.keys(side).length, ev: side['e-ev1'] || side['e-ev3'], crahS: side['e-cAs'], crahR: side['e-cAr'], pump: Object.keys(side).filter((k) => /^e-p[ab]\d/.test(k)).map((k) => side[k]) }; }, HOST);
  ok(b5b.hot.length === 0, 'B5c thermal paints a line that carries no flow: ' + JSON.stringify(b5b.hot));
  ok(b5b.n >= 30 && b5b.grey.length === 0 && b5b.ev === 'return' && b5b.crahS === 'supply' && b5b.crahR === 'return' && b5b.pump.length >= 6 && b5b.pump.every((x) => x === 'return'), 'B5b thermal covers every running CHW line: ' + JSON.stringify(b5b));
  if (SHOTS) await (await pg.$(HOST)).screenshot({ path: path.join(SHOTS, 'chiller-thermal-dark-1440.png') });
  await pg.click(`${HOST} [data-vfx-set="state"]`);
  ok(pg.__errs.length === 0, 'page errors: ' + pg.__errs[0]);
  await pg.close();
}
/* ── B6 reduced motion ────────────────────────────────────────────────────────────────── */
{
  const pg = await load(1440, 'dark', true);
  const r = await pg.evaluate((H) => { const svg = document.querySelector(H + ' svg.hmi-svg'); let moving = 0, states = 0;
    svg.querySelectorAll('.hmi-flow, .vfx-rotor').forEach((e) => { if (getComputedStyle(e).animationName !== 'none') moving++; });
    states = svg.querySelectorAll('path[data-edge][data-vstate]').length; return { moving, states }; }, HOST);
  ok(r.moving === 0, 'B6 reduced motion still animates ' + r.moving + ' elements');
  ok(r.states > 20, 'B6 state attributes missing under reduced motion');
  await pg.close();
}
/* ── light theme screenshot + TREND at 1440 and 390 ───────────────────────────────────── */
for (const W of [1440, 390]) {
  const pg = await load(W, W === 1440 ? 'light' : 'dark');
  if (SHOTS && W === 1440) await (await pg.$(HOST)).screenshot({ path: path.join(SHOTS, 'chiller-state-light-1440.png') });
  await pg.evaluate(() => { window.RZTrend.now = () => 1795000000000; });
  const pt = await pg.evaluate((H) => { const g = document.querySelector(H + ' .hmi-node[data-node="ch1"]'); g.scrollIntoView({ block: 'center', inline: 'center' }); const b = (g.querySelector('.b') || g).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, HOST);
  await pg.mouse.click(pt.x, pt.y); await sleep(350);
  /* R186: CH-01 now opens its equipment modal on one click; a reading with a trend there opens the same trend */
  const cell = await pg.$('aside.rz-inspector.open [data-trend], .rz-cvm:not([hidden]) [data-trend]');
  ok(!!cell, `T1@${W} no reading with a trend in the inspector or the equipment modal`);
  if (!cell) { await pg.close(); continue; }
  const id = await pg.evaluate((e) => e.getAttribute('data-trend'), cell);
  await cell.click(); await sleep(250);
  let t = await pg.evaluate(() => ({ open: window.RZTrend.isOpen(), st: window.RZTrend.state(), pens: document.querySelectorAll('.rz-trend polyline.pen').length, focusIn: document.querySelector('.rz-trend').contains(document.activeElement) }));
  ok(t.open && t.st.pens[0] === id && t.pens === 1 && t.focusIn, `T1@${W} ` + JSON.stringify(t));
  /* T2 add a second series */
  const second = await pg.evaluate(() => { const o = [...document.querySelectorAll('.rz-trend-add option')].find((x) => x.value); return o ? o.value : null; });
  await pg.select('.rz-trend-add', second); await sleep(150);
  t = await pg.evaluate(() => ({ pens: document.querySelectorAll('.rz-trend polyline.pen').length, rows: [...document.querySelectorAll('.rz-trend tbody tr')].map((r) => r.children[1].textContent), st: window.RZTrend.state() }));
  ok(t.pens === 2 && t.rows.length === 2 && t.st.pens[1] === second, `T2@${W} ` + JSON.stringify(t));
  /* T3 cursor readout */
  const box = await (await pg.$('.rz-trend-plot')).boundingBox();
  await pg.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5); await sleep(120);
  const t3 = await pg.evaluate(() => { const s = window.RZTrend.state(), row = document.querySelector('.rz-trend tbody tr'), id = row.getAttribute('data-row');
    const shown = Number(row.querySelector('[data-k="cursor"]').textContent.replace(/,/g, '')); return { cursor: s.cursor, shown, id }; });
  const t3b = await pg.evaluate(() => { const row = document.querySelector('.rz-trend tbody tr'), n = (k) => Number(row.querySelector('[data-k="' + k + '"]').textContent.replace(/,/g, ''));
    return { min: n('min'), max: n('max'), head: document.querySelector('.rz-trend [data-k="cursor-t"]').textContent }; });
  ok(t3.cursor !== null && Number.isFinite(t3.shown) && t3.shown >= t3b.min && t3.shown <= t3b.max && t3b.head !== 'Cursor', `T3@${W} cursor readout inside the series range: ` + JSON.stringify({ t3, t3b }));
  await pg.evaluate(() => document.querySelector('.rz-trend-plot').focus()); await pg.keyboard.press('ArrowLeft'); await sleep(80);
  const t3c = await pg.evaluate(() => window.RZTrend.state().cursor);
  ok(t3c !== null && t3c < t3.cursor, `T3@${W} ArrowLeft moves the cursor back: ${t3.cursor} -> ${t3c}`);
  /* T4 range + CSV */
  await pg.click('.rz-trend [data-range="1H"]'); await sleep(120);   /* PRD-CONV-POINT-STATUS-TREND: 5m folded into 1H (60 one-minute samples) */
  await pg.click('.rz-trend [data-csv]'); await sleep(120);
  const t4 = await pg.evaluate(() => { const c = window.RZTrend.lastCsv || '', l = c.trim().split('\n'); return { range: window.RZTrend.state().range, lines: l.length, head: l[0] }; });
  ok(t4.range === '1H' && t4.lines === 61 && /\(SIM/.test(t4.head) && /\[/.test(t4.head), `T4@${W} ` + JSON.stringify(t4));
  await pg.click('.rz-trend [data-range="1D"]'); await sleep(150);
  const over = await pg.evaluate(() => { const p = document.querySelector('.rz-trend-panel'); return document.documentElement.scrollWidth > innerWidth + 1 || p.getBoundingClientRect().right > innerWidth + 1; });
  ok(!over, `T6@${W} horizontal overflow`);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `trend-${W}.png`) });
  /* T5 Esc */
  const inspBefore = await pg.evaluate(() => !!document.querySelector('aside.rz-inspector.open'));
  await pg.keyboard.press('Escape'); await sleep(200);
  const t5 = await pg.evaluate(() => ({ trend: window.RZTrend.isOpen(), insp: !!document.querySelector('aside.rz-inspector.open, .rz-cvm:not([hidden])'), inert: document.querySelectorAll('[data-rz-trend-inert]').length, back: !!(document.activeElement && document.activeElement.hasAttribute('data-trend')) }));
  ok(!t5.trend && t5.insp && t5.inert === 0 && t5.back, `T5@${W} ` + JSON.stringify({ ...t5, inspBefore }));
  ok(pg.__errs.length === 0, `page errors @${W}: ` + pg.__errs[0]);
  await pg.close();
}
await browser.close(); srv.close();
if (fails.length) { console.log(fails.join('\n')); console.log(`\nCONV VFX + TREND — FAIL (${fails.length} of ${checks})`); process.exit(1); }
console.log(`\nCONV VFX + TREND — PASS (${checks} checks: state colour, flow speed, rotor, thermal, reduced motion, patterns; trend open/add/cursor/range/CSV/Esc at 1440 + 390)`);
