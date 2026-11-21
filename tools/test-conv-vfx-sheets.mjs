#!/usr/bin/env node
/* test-conv-vfx-sheets.mjs — STRICT. The fire, fuel and water P&ID sheets carry the process-bound line colour of
   js/conv/vfx.js (PRD-CONV-LIVING-PLANT §4): a line is never "all grey" — it is painted by its own flow state.
   Per sheet, in a real browser at 1440 (and overflow at 390):
   S1 the view bar is mounted with State / Medium / Flat and NO Thermal button (the sheet has no temperature points)
   S2 every line the page gives a flow state carries data-vstate; the states on the sheet = the page's own flow function
   S3 a running line is painted the running colour (or, State view, its medium tube: PRD-CONV-BMS-LIVE L2) and its flow
      dashes move; a stopped line shows no moving dashes
   S4 a stopped or no-data line carries a dash pattern (second signal beside colour)
   S6 a standby line (charged, no flow) is solid, in the standby colour, with no moving dashes; the fire main at rest
      reads standby while the header holds pressure, its test/drain and make-up lines stopped
   S7 a simulated reading in the inspector opens the trend modal with one pen; Esc closes it, the inspector stays
   S5 no page error; the bar does not push the page sideways at 390 px
   Usage: node tools/test-conv-vfx-sheets.mjs [--shots=<dir>] */
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
const SHEETS = [['fire-system', '#fire-sheet-host', 'RZFireSheets'], ['fuel-system', '#fuel-sheet-host', 'RZFuelSheets'], ['water-system', '#water-sheet-host', 'RZWaterSheets']];

for (const [page, HOST, key] of SHEETS) {
  for (const W of [1440, 390]) {
    const pg = await browser.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844 });
    await primeCockpitAuditDocument(pg, 'dark');
    await pg.goto(ORIGIN + page + '.html', { waitUntil: 'networkidle0', timeout: 90000 });
    await enterAuthorizedAuditState(pg, page);
    await sleep(2500);
    const s = await pg.evaluate((H, key) => {
      const host = document.querySelector(H), frame = host && host.querySelector('.hmi-frame');
      if (!frame) return { noFrame: true };
      const probe = document.createElement('i'); probe.style.color = 'var(--vfx-run)'; host.appendChild(probe); const run = getComputedStyle(probe).color; probe.style.color = 'var(--vfx-stby)'; const stby = getComputedStyle(probe).color; probe.remove();
      const out = { run, firstSvg: host.querySelector('svg') === host.querySelector('svg.hmi-svg'), bar: !!frame.querySelector('.vfx-bar'), modes: [...frame.querySelectorAll('[data-vfx-set]')].map((b) => b.getAttribute('data-vfx-set')), mode: frame.getAttribute('data-vfx-mode'),
        counts: {}, st: {}, stbyDashed: [], stbyColour: [], untagged: [], wrongRun: [], stillRun: [], noDash: [], noMove: [], over: document.documentElement.scrollWidth > innerWidth + 1 };
      const edges = window[key].pid.edges.filter((e) => e.flowOf);
      edges.forEach((e) => {
        const p = host.querySelector('path.hmi-edge[data-edge="' + e.id + '"]:not(.hmi-flow):not(.hmi-edge-shadow):not(.hmi-edge-hi)'); if (!p) return;
        const st = p.getAttribute('data-vstate'); if (!st) { out.untagged.push(e.id); return; }
        out.counts[st] = (out.counts[st] || 0) + 1;
        const cs = getComputedStyle(p), f = host.querySelector('path[data-edge-flow="' + e.id + '"]'), fc = f ? getComputedStyle(f) : null;
        const moving = !!fc && fc.display !== 'none' && fc.animationName !== 'none';
        /* PRD-CONV-BMS-LIVE L2: in the State view a running pipe of a known medium is a tube of that medium (the slugs say it
           runs); it must still never read as standby. Any other running pipe keeps the running colour. */
        const med = /(^|\s)m-(chw|cw|fw|pw|dr|fuel|agent|htw|tcs_s|tcs_r)(\s|$)/.test(p.getAttribute('class') || '');
        const runOk = cs.stroke === run || (med && cs.stroke !== stby && cs.stroke !== 'none');
        if (st === 'running') { if (!runOk) out.wrongRun.push(e.id); if (!moving) out.noMove.push(e.id); }
        if (st === 'standby') { if (moving) out.stillRun.push(e.id); if (cs.strokeDasharray && cs.strokeDasharray !== 'none') out.stbyDashed.push(e.id); if (cs.stroke !== stby) out.stbyColour.push(e.id); }
        out.st[e.id] = st;
        if (st === 'stopped' || st === 'unavailable') { if (moving) out.stillRun.push(e.id); if (!cs.strokeDasharray || cs.strokeDasharray === 'none') out.noDash.push(e.id); }
      });
      out.n = edges.length;
      return out;
    }, HOST, key);
    const T = `${page}@${W}`;
    if (s.noFrame) { ok(false, `${T} sheet frame not rendered`); await pg.close(); continue; }
    if (W === 1440) {
      ok(s.bar && s.mode === 'state' && s.modes.join() === 'state,medium,flat', `S1 ${T} view bar: ` + JSON.stringify({ bar: s.bar, mode: s.mode, modes: s.modes }));
      ok(s.firstSvg, `S1 ${T} the first <svg> under the sheet host is no longer the sheet (page code and the truth gate select it that way)`);
      ok(s.n >= 5 && s.untagged.length === 0, `S2 ${T} lines with a flow state but no data-vstate: ` + JSON.stringify(s.untagged.slice(0, 8)) + ' of ' + s.n);
      ok(s.wrongRun.length === 0 && s.noMove.length === 0, `S3 ${T} running lines not painted/moving: ` + JSON.stringify({ wrong: s.wrongRun.slice(0, 6), still: s.noMove.slice(0, 6) }));
      ok(s.stillRun.length === 0, `S3 ${T} a line without flow still moves: ` + JSON.stringify(s.stillRun.slice(0, 6)));
      ok(s.noDash.length === 0, `S4 ${T} stopped/no-data lines without a dash pattern: ` + JSON.stringify(s.noDash.slice(0, 6)));
      ok(s.stbyDashed.length === 0 && s.stbyColour.length === 0, `S6 ${T} standby lines must be solid and in the standby colour: ` + JSON.stringify({ dashed: s.stbyDashed.slice(0, 6), colour: s.stbyColour.slice(0, 6) }));
      if (page === 'fire-system') ok((s.counts.standby || 0) >= 30 && s.st['e-hdr'] === 'standby' && s.st['e-n2'] === 'standby' && s.st['e-test'] === 'stopped' && s.st['e-mu'] === 'stopped',
        `S6 ${T} at rest the charged fire main reads standby, the test/drain and make-up lines stopped: ` + JSON.stringify({ counts: s.counts, hdr: s.st['e-hdr'], n2: s.st['e-n2'], test: s.st['e-test'], mu: s.st['e-mu'] }));
      /* S7 a simulated reading in the inspector opens its trend; Esc closes the trend and leaves the inspector */
      const ids = await pg.evaluate((H) => [...document.querySelectorAll(H + ' .hmi-node[data-node]')].filter((g) => g.getBoundingClientRect().width > 0).map((g) => g.getAttribute('data-node')), HOST);
      let s7 = { tried: 0 };
      for (const id of ids.slice(0, 14)) {
        s7.tried++;
        const pt = await pg.evaluate((H, id) => { const g = document.querySelector(H + ' .hmi-node[data-node="' + id + '"]'); g.scrollIntoView({ block: 'center', inline: 'center' }); const b = (g.querySelector('.b') || g).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, HOST, id);
        await pg.mouse.click(pt.x, pt.y); await sleep(300);
        const cell = await pg.$('aside.rz-inspector.open [data-trend]');
        if (!cell) { await pg.keyboard.press('Escape'); await sleep(120); continue; }
        await cell.click(); await sleep(250);
        s7.node = id; s7.open = await pg.evaluate(() => !!(window.RZTrend && window.RZTrend.isOpen()) && document.querySelectorAll('.rz-trend polyline.pen').length === 1);
        await pg.keyboard.press('Escape'); await sleep(200);
        s7.after = await pg.evaluate(() => ({ trend: window.RZTrend.isOpen(), insp: !!document.querySelector('aside.rz-inspector.open') }));
        break;
      }
      ok(s7.open && s7.after && !s7.after.trend && s7.after.insp, `S7 ${T} trend from an inspector reading: ` + JSON.stringify(s7));
      console.log(`  ${T} states ` + JSON.stringify(s.counts));
      if (SHOTS) await (await pg.$(HOST)).screenshot({ path: path.join(SHOTS, `${page}-state-1440.png`) });
    } else {
      ok(s.bar && !s.over, `S5 ${T} bar missing or page overflows sideways: ` + JSON.stringify({ bar: s.bar, over: s.over }));
    }
    ok(errs.length === 0, `S5 ${T} page errors: ` + errs.slice(0, 2).join(' | '));
    await pg.close();
  }
}
await browser.close(); srv.close();
if (fails.length) { fails.forEach((f) => console.log(f)); console.log(`\nCONV VFX SHEETS — FAIL (${fails.length} of ${checks})`); process.exit(1); }
console.log(`\nCONV VFX SHEETS — PASS (${checks} checks: fire, fuel, water — bar, states, running colour + motion, dash patterns, 390 px)`);
