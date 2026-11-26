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
 *   D6  Node: a weather bin is liquid free cooling exactly when TCS − 6 K ≥ its ambient (TCS 36/39/40/41/45 °C).
 *   D8  TCS 39 °C: the liquid-path COP sits on copMax 12 and shows ◆ with the ceiling note (a clamp is never hidden).
 *   D10 (P7) the sequence block in the dry-cooler, CDU and fan-wall inspectors: Simulate walks every step; the ambient
 *       sweep's mode and cooling power = an independent DCAI_CALC.compute; trips end with the duty count restored
 *   D9  the cliff strip under the TCS what-if: one row per engine bin, now and SIMULATED = the engine, the design
 *       ambient row marked, Reset clears.
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
  /* D6 the cliff by bin: a bin is liquid free cooling exactly when TCS − 3 − 3 ≥ its ambient (CDU + dry cooler approach) */
  for (const t of [36, 39, 40, 41, 45]) { const bins = SPI.recompute('thermal.tcsSupplyC', t).bins; for (const b of bins) law(b.liquid_free_cooling === (t - 6 >= b.ambient_db_c), `D6 TCS ${t} °C bin ${b.ambient_db_c} °C: free cooling ${b.liquid_free_cooling}`); }
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
          live: [...body.querySelectorAll('.rz-inspector-row, [data-rz-point]')].length, tw: Math.max(s.scrollWidth - s.clientWidth, ...[...s.querySelectorAll('.rz-cvm-sp-wrap, table')].map((x) => x.scrollWidth - x.clientWidth)), hw: 0, past: Math.round(Math.max(0, ...[...s.querySelectorAll('td, th')].filter((c) => c.offsetParent).map((c) => c.getBoundingClientRect().right - Math.min(innerWidth, ins.getBoundingClientRect().right, body.getBoundingClientRect().right)))), sw: document.documentElement.scrollWidth, vw: innerWidth,
          small: [...s.querySelectorAll('td, th, output, button, label span')].filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 10.5).length };
      });
      if (!d) { bad(`D1 ${tag} ${cls}: no Setpoints block in the inspector`); continue; }
      const want = REG.filter((r) => r.equipment === cls).map((r) => r.id).sort();
      if (d.n !== 1) bad(`D1 ${tag} ${cls}: ${d.n} blocks`);
      if (d.rows.map((r) => r.id).sort().join() !== want.join()) bad(`D1 ${tag} ${cls}: rows ${d.rows.map((r) => r.id)} ≠ registry setpoints ${want}`);
      for (const r of d.rows) { const g = REG.find((x) => x.id === r.id); if (!g || r.sp !== g.sp.value) bad(`D1 ${tag} ${r.id}: SP ${r.sp} ≠ registry ${g && g.sp.value}`); if (!/\d/.test(r.pv)) bad(`D1 ${tag} ${r.id}: Live "${r.pv}" (the inspector shows this point)`); }
      /* D4 fits: no sideways page scroll, the block inside its column, no text under 10.5 px */
      if (d.sw > d.vw + 1) bad(`D4 ${tag} ${cls}: page scrolls sideways ${d.sw} > ${d.vw}`);
      if (d.tw > 1) bad(`D4 ${tag} ${cls}: a table in the block overflows its frame by ${d.tw} px (a column scrolls out of view)`);
      if (d.past > 1) bad(`D4 ${tag} ${cls}: a cell ends ${d.past} px past the inspector's right edge`);
      if (d.small) bad(`D4 ${tag} ${cls}: ${d.small} block texts under 10.5 px`);
      if (cls !== 'cdu' || W !== 1440) continue;
      /* D5 what-if: TCS supply 41 °C -> every SIMULATED output = a Node DCAI_CALC.compute of a copy; cliff ambient 35 °C */
      const D = require(path.join(ROOT, 'js/dcai-engine.js')), m = JSON.parse(JSON.stringify(D.model)); m.thermal.tcsSupplyC = 41; const sim = D.compute(m);
      const w = await pg.evaluate(() => { const box = document.querySelector('[data-rz-dcai-sp] [data-rz-cvm-whatif]'); if (!box) return null; const s = box.querySelector('input[type="range"]'); s.value = '41'; s.dispatchEvent(new Event('input', { bubbles: true })); s.focus(); return [...box.querySelectorAll('tr[data-wi-path]')].map((t) => ({ path: t.getAttribute('data-wi-path'), sim: t.getAttribute('data-wi-sim'), text: t.querySelector('[data-k="sim"]').textContent })); });
      if (!w || !w.length) bad(`D5 ${tag}: no what-if on the CDU block`);
      for (const r of w || []) { const v = r.path.split('.').reduce((o, k) => (o == null ? o : o[k]), sim); if (v === null) { if (r.sim !== '' || !/free cooling/.test(r.text)) bad(`D5 ${tag} ${r.path}: engine null shown as "${r.text}"`); continue; } if (typeof v !== 'number' || Math.abs(+r.sim - v) > Math.abs(v) * 1e-3 + 1e-9) bad(`D5 ${tag} ${r.path}: SIMULATED ${r.sim} ≠ engine ${v}`); if (/\d\.\d{4,}/.test(r.text)) bad(`D5 ${tag} ${r.path}: raw float "${r.text}"`); }
      /* D1r one refresh later (4 s tick) the same block node is back, the slider still at 41 with focus, Live repainted */
      await sleep(4600);
      const k = await pg.evaluate(() => { const s = document.querySelector('aside.rz-inspector.open [data-rz-dcai-sp]'); const r = s && s.querySelector('input[type="range"]'); return s ? { node: s.__probe || null, v: r && r.value, focus: document.activeElement === r, n: document.querySelectorAll('[data-rz-dcai-sp]').length } : null; });
      if (!k || k.node !== d.node || k.v !== '41' || !k.focus || k.n !== 1) bad(`D1r ${tag}: after a refresh ${JSON.stringify(k)} (want the same block, slider 41, focus kept, one block)`);
      /* D7 Reset: slider back on the registry SP, no SIMULATED value left, nothing written to storage */
      const r7 = await pg.evaluate(() => { const ls = JSON.stringify(Object.keys(localStorage)), ss = JSON.stringify(Object.keys(sessionStorage)); const box = document.querySelector('[data-rz-dcai-sp] [data-rz-cvm-whatif]'); box.querySelector('[data-wi-reset]').click(); return { v: box.querySelector('input[type="range"]').value, sp: box.getAttribute('data-wi-sp'), left: [...box.querySelectorAll('tr[data-wi-path]')].filter((t) => t.getAttribute('data-wi-sim')).length, ls, ss, ls2: JSON.stringify(Object.keys(localStorage)), ss2: JSON.stringify(Object.keys(sessionStorage)) }; });
      if (r7.v !== r7.sp || r7.left) bad(`D7 ${tag}: Reset left slider ${r7.v} (SP ${r7.sp}), ${r7.left} SIMULATED rows`);
      /* D8 a clamped engine value is marked, D9 the cliff strip: TCS 39 °C -> the liquid-path COP sits on copMax 12 and
         carries ◆ with the ceiling note; the 34 °C design bin turns mechanical, 32 °C stays free; Reset clears the strip */
      const D9 = (() => { const m2 = JSON.parse(JSON.stringify(D.model)); m2.thermal.tcsSupplyC = 39; return D.compute(m2); })();
      const c9 = await pg.evaluate(() => { const box = document.querySelector('[data-rz-dcai-sp] [data-rz-cvm-whatif]'); const s = box.querySelector('input[type="range"]'); s.value = '39'; s.dispatchEvent(new Event('input', { bubbles: true }));
        const cop = box.querySelector('tr[data-wi-path="design.planes.p19_cop_liquid_path"] [data-k="sim"]'), strip = box.querySelector('[data-rz-cliff]');
        const out = { cop: cop && cop.textContent, title: cop && cop.title, bins: strip ? [...strip.querySelectorAll('tbody tr')].map((t) => ({ a: t.querySelector('th').textContent, now: t.querySelector('[data-k="now"]').textContent, sim: t.querySelector('[data-k="sim"]').textContent })) : null };
        box.querySelector('[data-wi-reset]').click(); out.broken = strip ? [...strip.querySelectorAll('td, th')].filter((c) => c.getBoundingClientRect().height > parseFloat(getComputedStyle(c).lineHeight || '16') * 1.6 + parseFloat(getComputedStyle(c).paddingTop) + parseFloat(getComputedStyle(c).paddingBottom) + 1).map((c) => c.textContent) : []; out.after = strip ? [...strip.querySelectorAll('[data-k="sim"]')].filter((c) => c.textContent !== '—').length : -1; return out; });
      if (D9.design.planes.p19_cop_liquid_path !== D.model.thermal.copMax) bad(`D8 ${tag}: the engine no longer clamps at TCS 39 °C (P19 ${D9.design.planes.p19_cop_liquid_path}); pick another case`);
      if (!c9.cop || !/◆/.test(c9.cop) || !/ceiling/.test(c9.title || '')) bad(`D8 ${tag}: clamped COP shown as "${c9.cop}" title "${c9.title}"`);
      if (!c9.bins || c9.bins.length !== D9.bins.length) bad(`D9 ${tag}: cliff strip ${c9.bins ? c9.bins.length : 'absent'} rows, engine ${D9.bins.length} bins`);
      else D9.bins.forEach((b, i) => { const want = b.liquid_free_cooling ? 'free' : 'mechanical', now = D.snapshot.bins[i].liquid_free_cooling ? 'free' : 'mechanical'; if (c9.bins[i].sim !== want || c9.bins[i].now !== now) bad(`D9 ${tag} bin ${b.ambient_db_c} °C: now ${c9.bins[i].now} / sim ${c9.bins[i].sim}, engine ${now} / ${want}`); });
      if (c9.bins && !/design/.test((c9.bins.find((x) => /^34/.test(x.a)) || {}).a || '')) bad(`D9 ${tag}: the design ambient bin is not marked`);
      if (c9.broken && c9.broken.length) bad(`D9 ${tag}: cliff cells wrap onto a second line: ${c9.broken.slice(0, 4).join(' | ')}`);
      if (c9.after !== 0) bad(`D9 ${tag}: Reset left ${c9.after} SIMULATED bins`);
      const keys = (j) => JSON.parse(j).filter((x) => /sp|what|sim|setpoint/i.test(x));
      if (keys(r7.ls2).length || keys(r7.ss2).length) bad(`D7 ${tag}: storage keys ${r7.ls2} ${r7.ss2}`);
    }
    /* D10 (P7) the sequence of operations in the inspector: one block per class with a DC AI sequence; Simulate walks
       every step; the heat-rejection sweep's modes and cooling power equal an independent DCAI_CALC.compute per
       ambient; the trip scenarios end with the duty count restored; no sideways page scroll */
    const DE = require(path.join(ROOT, 'js/dcai-engine.js'));
    for (const cls of ['dry-cooler', 'cdu', 'crah']) {
      const r = await pg.evaluate(async (c) => {
        document.querySelectorAll('aside.rz-inspector .rz-inspector-close, aside.rz-inspector [data-close]').forEach((x) => x.click());
        const el = [...document.querySelectorAll('[data-rz-equipment^="' + c + ':"]')].sort((a, b2) => b2.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
        if (!el) return { err: 'no ' + c + ' element on the cooling view' };
        el.scrollIntoView({ block: 'center', inline: 'center' });
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, shiftKey: true }));
        await new Promise((z) => setTimeout(z, 600));
        const box = document.querySelectorAll('aside.rz-inspector.open [data-rz-cvm-seq="dcai:' + c + '"]');
        if (box.length !== 1) return { err: box.length + ' sequence blocks' };
        box[0].querySelector('[data-seq-sim]').click();
        for (let k = 0; k < 60 && box[0].querySelector('tr[data-seq-i][hidden]'); k++) await new Promise((z) => setTimeout(z, 200));
        const rows = [...box[0].querySelectorAll('tr[data-seq-i]')];
        return { hidden: rows.filter((x) => x.hidden).length, rows: rows.map((x) => ({ mode: x.getAttribute('data-seq-step-mode'), running: +x.getAttribute('data-seq-running'), short: +x.getAttribute('data-seq-short'),
          eng: [...x.querySelectorAll('td[data-k="eng"]')].map((t) => t.textContent) })), sx: document.documentElement.scrollWidth - innerWidth,
          /* the step table stays inside its frame and the inspector (a column cut off is a lost number) */
          over: Math.max(0, ...[...box[0].querySelectorAll('.rz-cvm-sp-wrap')].map((w) => w.scrollWidth - w.clientWidth)),
          /* the path figure is drawn to scale: its smallest text as rendered (font size × svg scale) */
          figPx: (() => { const sv = box[0].querySelector('[data-seq-fig] svg'); if (!sv) return 0; const k = sv.getBoundingClientRect().width / sv.viewBox.baseVal.width;
            return Math.min(...[...sv.querySelectorAll('text')].map((t) => parseFloat(getComputedStyle(t).fontSize) * k)); })(),
          past: (() => { const a = document.querySelector('aside.rz-inspector.open').getBoundingClientRect().right; return Math.max(0, ...[...box[0].querySelectorAll('td,th')].filter((t) => t.offsetParent).map((t) => t.getBoundingClientRect().right - Math.min(a, innerWidth))); })() };
      }, cls);
      if (r.err) { bad(`D10 ${tag} ${cls}: ${r.err}`); continue; }
      if (r.hidden) bad(`D10 ${tag} ${cls}: ${r.hidden} steps still hidden after Simulate`);
      if (r.sx > 1) bad(`D10 ${tag} ${cls}: page scrolls sideways by ${r.sx} px`);
      if (!(r.figPx >= 9.5)) bad(`D10 ${tag} ${cls}: the sequence path's smallest text renders at ${r.figPx.toFixed(1)} px (a figure scaled down to fit)`);
      if (r.over > 1 || r.past > 1) bad(`D10 ${tag} ${cls}: step table overflows its frame by ${r.over} px, a cell ends ${r.past.toFixed(0)} px past the inspector`);
      if (cls === 'dry-cooler') {
        const amb = [24, 30, 34, 35, 38], want = amb.map((a) => { const m = JSON.parse(JSON.stringify(DE.model)); m.thermal.designAmbientDbC = a; const R = DE.compute(m), g = R.design.planes.p04_free_cooling_margin_k;
          return { mode: g < 0 ? 'mechanical' : g < 1 ? 'edge' : 'normal', kwe: Math.round(R.design.electrical.cooling_kwe).toLocaleString('en-US') }; });
        if (r.rows.length !== amb.length) bad(`D10 ${tag} dry-cooler: ${r.rows.length} steps, want ${amb.length}`);
        else want.forEach((w, i) => { const g = r.rows[i]; if (g.mode !== w.mode || g.eng[g.eng.length - 1] !== w.kwe) bad(`D10 ${tag} dry-cooler step ${i} (${amb[i]} °C): ${g.mode} ${g.eng[g.eng.length - 1]} kWe, engine ${w.mode} ${w.kwe}`); });
      } else {
        const duty = DE.snapshot.equipment[(cls === 'cdu' ? 'cdu' : 'crah') + '_duty_per_hall'], last = r.rows[r.rows.length - 1];
        if (!last || last.running !== duty || last.short !== 0 || !r.rows.some((x) => x.short > 0)) bad(`D10 ${tag} ${cls}: trip walk ${JSON.stringify(r.rows.map((x) => x.running + '/' + x.short))}, duty ${duty}`);
      }
    }
    if (errs.length) bad(`D4 ${tag}: ${errs.length} page errors: ${errs.slice(0, 2).join(' | ').slice(0, 200)}`);
    await pg.close();
  }
  await b.close(); srv.close();
  console.log(`${n ? 'FAIL' : 'PASS'} D1/D1r/D4/D5/D7/D8/D9/D10 inspector block on datahallAI.html: ${CLASSES.length} classes × 390/1440 × dark/light${n ? ', ' + n + ' findings' : ''}`);
  return n;
}
