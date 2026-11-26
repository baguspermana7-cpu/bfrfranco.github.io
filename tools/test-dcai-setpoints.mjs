#!/usr/bin/env node
/**
 * test-dcai-setpoints.mjs — PRD-SETPOINT-SIM §C P5: the DC AI cockpit never types a setpoint.
 *
 *   D0  Node: js/datahall-ai/sp-inspector.js gives every DC AI setpoint class rows; its what-if = DCAI_CALC.compute of a
 *       copy (12 cases of the PRD tables), cliff ambient +1 K per +1 K TCS, live model untouched.
 *   D2  static: no `{ value: <number>, text: '<number> … setpoint …' }` payload literal in js/datahall-ai/*.js — a setpoint
 *       on the DC AI page is read from the control registry (RZControlPoints) or the engine, never typed. Red on the
 *       tree before P5: 8 literals in hmi-payloads.js (pH, conductivity, supply RH, jacket keep-warm, aeration DO, MMR
 *       supply air, support-room temperature and RH).
 *   D1  browser: Cooling & Piping, each class with a setpoint opened in the inspector: one block, exactly the registry's
 *       setpoints of that class, SP = registry, Live = the inspector's own number. Red before P5: no block.
 *   D1r one 4 s refresh later the same block node is back, a moved what-if slider keeps its value and focus.
 *   D4  390/1440 × dark/light: no sideways page scroll, the block inside its column, no text under 10.5 px, 0 page errors.
 *   D5  what-if TCS supply 41 °C: every SIMULATED output = DCAI_CALC.compute of a copy (± 0.1 %), no raw float printed.
 *   D7  Reset: slider back on the registry SP, no SIMULATED value left, nothing stored.
 *   (D3 trend SP line joins with the rz-trend hook.)  --static skips the browser.
 *
 * Usage: node tools/test-dcai-setpoints.mjs [--list] [--static]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'js/datahall-ai');
const TYPED = /\{\s*value:\s*-?\d+(?:\.\d+)?\s*,\s*text:\s*['"`]\s*-?\d+(?:\.\d+)?[^'"`]*setpoint/i;

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let fails = 0; const law = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };

/* D0 (Node) the inspector core js/datahall-ai/sp-inspector.js: every DC AI class the registry holds a setpoint for gets
   rows; the what-if recompute equals a direct DCAI_CALC.compute of a copy (TCS 35/38/40/42/45, air 18/22/25/27, PRD §C
   P6 tables) and never touches the live model */
{
  const D = require(path.join(ROOT, 'js/dcai-engine.js'));
  const sb = { DCAI_CALC: D }; new Function('window', fs.readFileSync(path.join(ROOT, 'js/rz-control-points.js'), 'utf8'))(sb);
  const SPI = require(path.join(ROOT, 'js/datahall-ai/sp-inspector.js'));
  globalThis.RZControlPoints = sb.RZControlPoints; globalThis.DCAI_CALC = D;
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/control-points.json'), 'utf8')).rows.filter((r) => r.cockpit === 'dcai' && r.sp && r.sp.role === 'setpoint');
  for (const r of reg) law(SPI.rows(r.equipment).some((x) => x.id === r.id), `D0 ${r.id}: no inspector row for class ${r.equipment}`);
  /* a reference value is not repeated as a setpoint row, and a row that has a band carries it (the page has no points.js) */
  const refs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/control-points.json'), 'utf8')).rows.filter((r) => r.cockpit === 'dcai' && r.sp && r.sp.role === 'reference');
  for (const r of refs) law(!SPI.rows(r.equipment).some((x) => x.id === r.id), `D0 ${r.id}: a reference value shown as a setpoint row`);
  for (const r of reg) if (r.limits) { const x = SPI.rows(r.equipment).find((y) => y.id === r.id); law(x && x.limits && ['lo_alarm', 'lo_warn', 'hi_warn', 'hi_alarm'].every((k) => x.limits[k] === r.limits[k]), `D0 ${r.id}: band ${JSON.stringify(x && x.limits)} ≠ registry ${JSON.stringify(r.limits)}`); }
  const before = JSON.stringify(D.model), get = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const cases = [['thermal.tcsSupplyC', [35, 38, 40, 42, 45], 'pue.annual_bin_weighted'], ['thermal.tcsSupplyC', [35, 40, 42], 'pue.free_cooling_cliff_ambient_c'], ['thermal.airSupplyC', [18, 22, 25, 27], 'design.electrical.cooling_kwe']];
  for (const [param, vals, out] of cases) for (const v of vals) {
    const m = JSON.parse(JSON.stringify(D.model)), k = param.split('.'); k.slice(0, -1).reduce((x, y) => x[y], m)[k[k.length - 1]] = v;
    const want = get(D.compute(m), out), got = get(SPI.recompute(param, v), out);
    law(typeof got === 'number' && Math.abs(got - want) <= Math.abs(want) * 1e-3, `D0 what-if ${param}=${v}: ${out} ${got} ≠ engine ${want}`);
  }
  law(get(SPI.recompute('thermal.tcsSupplyC', 41), 'pue.free_cooling_cliff_ambient_c') === get(D.snapshot, 'pue.free_cooling_cliff_ambient_c') + 1, 'D0 the cliff ambient does not move 1:1 with TCS supply (40 → 41 °C)');
  law(JSON.stringify(D.model) === before, 'D0 a what-if recompute changed the live DC AI model');
  law(SPI.recompute('thermal.noSuchField', 1) === null, 'D0 an unknown parameter is not refused (null)');
  if (!fails) console.log(`PASS D0 inspector core: ${reg.length} DC AI setpoints have rows; what-if = engine on 12 cases; live model untouched`);
}

const hits = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js')).sort()) {
  fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').forEach((line, i) => {
    if (TYPED.test(line)) hits.push(`js/datahall-ai/${f}:${i + 1}  ${line.trim().slice(0, 110)}`);
  });
}
if (process.argv.includes('--list')) hits.forEach((h) => console.log('  ' + h));
const ok = hits.length === 0;
console.log(`${ok ? 'PASS' : 'FAIL'} D2 typed setpoint literals in js/datahall-ai/*.js: ${hits.length} (want 0)`);
if (!ok && !process.argv.includes('--list')) hits.slice(0, 8).forEach((h) => console.log('  ' + h));

/* D1/D1r/D4/D5/D7 (browser): datahallAI.html served from this checkout, Cooling & Piping opened, each class with a
   setpoint opened in the inspector (Shift+click, as test-dcai-coverage does). Skip with --static. */
let bfails = 0;
if (!process.argv.includes('--static')) bfails = await browserLaws();
process.exit(ok && !fails && !bfails ? 0 : 1);

async function browserLaws() {
  const { default: puppeteer } = await import('puppeteer');
  const http = await import('node:http');
  const { enterAuthorizedAuditState, primeCockpitAuditDocument } = await import(path.join(ROOT, 'tools/lib/cockpit-audit-state.mjs'));
  const { TAB_SETS, activateTab } = await import(path.join(ROOT, 'tools/lib/cockpit-tabs.mjs'));
  const SET = TAB_SETS['datahallAI.html'], COOL = SET.diagrams.find((d) => d.tab === 'cool');
  const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; } fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const O = `http://127.0.0.1:${srv.address().port}/`, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/control-points.json'), 'utf8')).rows.filter((r) => r.cockpit === 'dcai' && r.sp && r.sp.role === 'setpoint');
  const CLASSES = ['cdu', 'crah', 'chiller', 'chem'];
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  let n = 0; const bad = (m) => { n++; console.log('FAIL ' + m); };
  for (const theme of ['dark', 'light']) for (const W of [1440, 390]) {
    const pg = await b.newPage(), errs = [], tag = `${W}/${theme}`; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.setViewport({ width: W, height: W < 600 ? 844 : 900, isMobile: W < 600, hasTouch: W < 600 });
    await primeCockpitAuditDocument(pg, theme);
    await pg.goto(O + 'datahallAI.html', { waitUntil: 'networkidle0', timeout: 120000 }); await enterAuthorizedAuditState(pg, 'dc-ai');
    await activateTab(pg, SET, COOL); await sleep(800);
    for (const cls of CLASSES) {
      const opened = await pg.evaluate((c) => {
        const el = [...document.querySelectorAll('[data-rz-equipment^="' + c + ':"]')].sort((a, b2) => b2.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
        if (!el) return 'no ' + c + ' element on the cooling view';
        el.scrollIntoView({ block: 'center', inline: 'center' });
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, shiftKey: true }));
        return document.querySelector('aside.rz-inspector.open') ? '' : 'inspector did not open';
      }, cls);
      if (opened) { bad(`D1 ${tag} ${cls}: ${opened}`); continue; }
      await sleep(600);
      /* D1 the block: one per inspector, the registry's setpoints of this class and nothing else, SP = registry,
         Live = the payload's own number of that point */
      const d = await pg.evaluate(() => {
        const secs = document.querySelectorAll('aside.rz-inspector.open [data-rz-dcai-sp]'), s = secs[0]; if (!s) return null;
        const ins = document.querySelector('aside.rz-inspector.open'), body = ins.querySelector('[data-slot="body"]');
        return { n: secs.length, node: (s.__probe = s.__probe || Math.random()), rows: [...s.querySelectorAll('tr[data-sp-row]')].map((r) => ({ id: r.getAttribute('data-sp-row'), sp: +r.getAttribute('data-sp'), pv: r.querySelector('[data-k="pv"]').textContent })),
          live: [...body.querySelectorAll('.rz-inspector-row, [data-rz-point]')].length, tw: s.scrollWidth, hw: s.clientWidth, sw: document.documentElement.scrollWidth, vw: innerWidth,
          small: [...s.querySelectorAll('td, th, output, button, label span')].filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 10.5).length };
      });
      if (!d) { bad(`D1 ${tag} ${cls}: no Setpoints block in the inspector`); continue; }
      const want = REG.filter((r) => r.equipment === cls).map((r) => r.id).sort();
      if (d.n !== 1) bad(`D1 ${tag} ${cls}: ${d.n} blocks`);
      if (d.rows.map((r) => r.id).sort().join() !== want.join()) bad(`D1 ${tag} ${cls}: rows ${d.rows.map((r) => r.id)} ≠ registry setpoints ${want}`);
      for (const r of d.rows) { const g = REG.find((x) => x.id === r.id); if (!g || r.sp !== g.sp.value) bad(`D1 ${tag} ${r.id}: SP ${r.sp} ≠ registry ${g && g.sp.value}`); if (!/\d/.test(r.pv)) bad(`D1 ${tag} ${r.id}: Live "${r.pv}" (the inspector shows this point)`); }
      /* D4 fits: no sideways page scroll, the block inside its column, no text under 10.5 px */
      if (d.sw > d.vw + 1) bad(`D4 ${tag} ${cls}: page scrolls sideways ${d.sw} > ${d.vw}`);
      if (d.tw > d.hw + 1) bad(`D4 ${tag} ${cls}: block ${d.tw} px wider than its ${d.hw} px column`);
      if (d.small) bad(`D4 ${tag} ${cls}: ${d.small} block texts under 10.5 px`);
      if (cls !== 'cdu' || W !== 1440) continue;
      /* D5 what-if: TCS supply 41 °C -> every SIMULATED output = a Node DCAI_CALC.compute of a copy; cliff ambient 35 °C */
      const D = require(path.join(ROOT, 'js/dcai-engine.js')), m = JSON.parse(JSON.stringify(D.model)); m.thermal.tcsSupplyC = 41; const sim = D.compute(m);
      const w = await pg.evaluate(() => { const box = document.querySelector('[data-rz-dcai-sp] [data-rz-cvm-whatif]'); if (!box) return null; const s = box.querySelector('input[type="range"]'); s.value = '41'; s.dispatchEvent(new Event('input', { bubbles: true })); s.focus(); return [...box.querySelectorAll('tr[data-wi-path]')].map((t) => ({ path: t.getAttribute('data-wi-path'), sim: t.getAttribute('data-wi-sim'), text: t.querySelector('[data-k="sim"]').textContent })); });
      if (!w || !w.length) bad(`D5 ${tag}: no what-if on the CDU block`);
      for (const r of w || []) { const v = r.path.split('.').reduce((o, k) => (o == null ? o : o[k]), sim); if (typeof v !== 'number' || Math.abs(+r.sim - v) > Math.abs(v) * 1e-3 + 1e-9) bad(`D5 ${tag} ${r.path}: SIMULATED ${r.sim} ≠ engine ${v}`); if (/\d\.\d{4,}/.test(r.text)) bad(`D5 ${tag} ${r.path}: raw float "${r.text}"`); }
      /* D1r one refresh later (4 s tick) the same block node is back, the slider still at 41 with focus, Live repainted */
      await sleep(4600);
      const k = await pg.evaluate(() => { const s = document.querySelector('aside.rz-inspector.open [data-rz-dcai-sp]'); const r = s && s.querySelector('input[type="range"]'); return s ? { node: s.__probe || null, v: r && r.value, focus: document.activeElement === r, n: document.querySelectorAll('[data-rz-dcai-sp]').length } : null; });
      if (!k || k.node !== d.node || k.v !== '41' || !k.focus || k.n !== 1) bad(`D1r ${tag}: after a refresh ${JSON.stringify(k)} (want the same block, slider 41, focus kept, one block)`);
      /* D7 Reset: slider back on the registry SP, no SIMULATED value left, nothing written to storage */
      const r7 = await pg.evaluate(() => { const ls = JSON.stringify(Object.keys(localStorage)), ss = JSON.stringify(Object.keys(sessionStorage)); const box = document.querySelector('[data-rz-dcai-sp] [data-rz-cvm-whatif]'); box.querySelector('[data-wi-reset]').click(); return { v: box.querySelector('input[type="range"]').value, sp: box.getAttribute('data-wi-sp'), left: [...box.querySelectorAll('tr[data-wi-path]')].filter((t) => t.getAttribute('data-wi-sim')).length, ls, ss, ls2: JSON.stringify(Object.keys(localStorage)), ss2: JSON.stringify(Object.keys(sessionStorage)) }; });
      if (r7.v !== r7.sp || r7.left) bad(`D7 ${tag}: Reset left slider ${r7.v} (SP ${r7.sp}), ${r7.left} SIMULATED rows`);
      const keys = (j) => JSON.parse(j).filter((x) => /sp|what|sim|setpoint/i.test(x));
      if (keys(r7.ls2).length || keys(r7.ss2).length) bad(`D7 ${tag}: storage keys ${r7.ls2} ${r7.ss2}`);
    }
    if (errs.length) bad(`D4 ${tag}: ${errs.length} page errors: ${errs.slice(0, 2).join(' | ').slice(0, 200)}`);
    await pg.close();
  }
  await b.close(); srv.close();
  console.log(`${n ? 'FAIL' : 'PASS'} D1/D1r/D4/D5/D7 inspector block on datahallAI.html: ${CLASSES.length} classes × 390/1440 × dark/light${n ? ', ' + n + ' findings' : ''}`);
  return n;
}
