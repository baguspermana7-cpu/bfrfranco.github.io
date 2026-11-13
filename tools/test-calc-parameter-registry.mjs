#!/usr/bin/env node
/**
 * test-calc-parameter-registry.mjs — PRD-P10 stage 1 gate: calculator headline results open a basis that is true.
 *
 * Static
 *   S1 schema: every record complete (id, calc, label, unit, formula, inputs, evidence class from the ten-term
 *      taxonomy, source, engineFn|null, pageFn, display, value); ASSUMED records say why (source.method)
 *   S2 js/calc-parameters.js is the twin of data/calc-parameters.json; engineDataVersion = rz-engine.js data.version
 *   S3 a named engineFn resolves to a function in RZEngine and the page source calls it
 *   S4 every record has at least one measured input (a hook whose number nothing moves is dead)
 *   S5 each of the 6 pages loads calc-parameters.js, rz-basis-drawer.js with data-rz-registry="RZ_CALC_PARAMETERS"
 *      and rz-calc-basis.js
 * Rendered (headless Chrome, pages at their defaults)
 *   B1 parity + freshness: a fresh build (render, read every hook, re-measure the inputs) equals the files, so the
 *      registry value is the value the page shows (FR-P10-4)
 *   B2 coverage (headline results only): the hooks on each page are exactly that page's records
 *   B3 keyboard: Enter on the first hook of each page opens the drawer with the record's label, a "Value now" equal
 *      to the cell, an "Inputs now" row with one line per declared input, a "Computed by" row; Esc closes and
 *      returns focus to the cell
 *   B4 live: after IT load changes on the PUE page, the drawer shows the new IT load and the new cell value
 *   B5 authority: a registry built from other engine data opens "Runtime basis unavailable", never numbers
 *   B6 missing registry: with js/calc-parameters.js blocked, a hook click opens nothing and no mark is drawn
 *   B7 carbon: the six hooks exist on the Operational tab only
 *   B8 gating: a value the page hides from a signed-out visitor is parked (no hook, mark or drawer) until revealed
 *
 * Usage: node tools/test-calc-parameter-registry.mjs [--skip-build]   (exit 0 = pass)
 */
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { build, twin, serve, openPage, engineDataVersion } from './build-calc-parameter-registry.mjs';
import { loadInVm } from './build-engine-esm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['capex-calculator.html', 'opex-calculator.html', 'tco-calculator.html', 'roi-calculator.html', 'carbon-footprint.html', 'pue-calculator.html'];
const EVIDENCE = ['PUBLISHED', 'STANDARD', 'VENDOR', 'DERIVED', 'ADOPTED', 'ASSUMED', 'SIMULATED', 'MEASURED', 'LABEL', 'UNAVAILABLE'];
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); } };

const jsonText = readFileSync(join(ROOT, 'data/calc-parameters.json'), 'utf8');
const reg = JSON.parse(jsonText);
const P = reg.parameters;
const byCalc = {};
for (const p of P) (byCalc[p.calc] = byCalc[p.calc] || []).push(p);

/* S1 */
const bad = [];
for (const p of P) {
  const why = [];
  if (!/^calc\.[a-z]+\.[a-z0-9_.]+$/.test(p.id) || p.id.split('.')[1] !== p.calc) why.push('id');
  for (const k of ['label', 'unit', 'pageFn', 'display']) if (typeof p[k] !== 'string' || !p[k]) why.push(k);
  if (typeof p.formula !== 'string' || p.formula.length < 10) why.push('formula');
  if (!Array.isArray(p.inputs) || !p.inputs.length || p.inputs.some((s) => !(s.id || s.name) || !s.label)) why.push('inputs');
  if (!EVIDENCE.includes(p.evidenceClass)) why.push('evidenceClass');
  if (!p.source || !p.source.ref) why.push('source');
  if (p.evidenceClass === 'ASSUMED' && !(p.source && p.source.method)) why.push('ASSUMED without a reason');
  if (!(p.engineFn === null || typeof p.engineFn === 'string')) why.push('engineFn');
  if (!(typeof p.value === 'number' && isFinite(p.value)) && !(p.value === null && /^[<>]/.test(p.display))) why.push('value');
  if ((p.dependsOnInputs || []).some((l) => !p.inputs.some((s) => s.label === l))) why.push('dependsOnInputs not declared');
  if (why.length) bad.push(p.id + ': ' + why.join(', '));
}
ok('S1 ' + P.length + ' records complete', P.length > 0 && !bad.length, bad.slice(0, 5).join('; '));

/* S2 */
let twinText = '';
try { twinText = readFileSync(join(ROOT, 'js/calc-parameters.js'), 'utf8'); } catch (e) { /* missing */ }
ok('S2 js/calc-parameters.js is the twin of the JSON', twinText === twin(jsonText.replace(/\n$/, '')));
ok('S2 registry engineDataVersion (' + reg.engineDataVersion + ') = rz-engine.js data.version (' + engineDataVersion() + ')', reg.engineDataVersion === engineDataVersion());

/* S3 */
const E = loadInVm(readFileSync(join(ROOT, 'rz-engine.js'), 'utf8'));
const s3 = [];
for (const p of P) {
  if (!p.engineFn) continue;
  const path = p.engineFn.split(' ')[0].replace(/^RZEngine\./, '').split('.');
  let fn = E; for (const k of path) fn = fn && fn[k];
  const src = readFileSync(join(ROOT, p.page), 'utf8');
  if (typeof fn !== 'function') s3.push(p.id + ': ' + p.engineFn + ' is not an engine function');
  else if (!src.includes(path.slice(-2).join('.'))) s3.push(p.id + ': ' + p.page + ' never calls ' + path.slice(-2).join('.'));
}
ok('S3 every named engine function exists and its page calls it (' + P.filter((p) => p.engineFn).length + ')', !s3.length, s3.join('; '));

/* S4 */
const dead = P.filter((p) => !(p.dependsOnInputs || []).length).map((p) => p.id);
ok('S4 every record has a measured input', !dead.length, dead.join(', '));

/* S6 — a cell that is another cell divided by a constant or by one input cannot depend on fewer inputs than that cell
 * (minus the divisor). Rounding hid this: Region moved calc.capex.total ($11.34M) but not "$11K/kW" (LTC, v3.54.0). */
const QUOTIENTS = [
  ['calc.capex.per_kw', 'calc.capex.total', 'IT load (kW)'],
  ['calc.opex.monthly', 'calc.opex.total', null],
  ['calc.opex.per_kw', 'calc.opex.total', 'IT load (kW)'],
];
const s6 = [];
for (const [cell, of, divisor] of QUOTIENTS) {
  const c = P.find((p) => p.id === cell), o = P.find((p) => p.id === of);
  if (!c || !o) { s6.push(cell + ' or ' + of + ' missing'); continue; }
  const lost = o.dependsOnInputs.filter((l) => l !== divisor && !c.dependsOnInputs.includes(l));
  if (lost.length) s6.push(cell + ' (' + c.display + ') misses ' + lost.join(', ') + ' that move ' + of);
}
ok('S6 a quotient cell depends on every input of the cell it divides (' + QUOTIENTS.length + ' pairs)', !s6.length, s6.join('; '));

/* S5 */
const s5 = [];
for (const page of PAGES) {
  const src = readFileSync(join(ROOT, page), 'utf8');
  if (!/<script src="js\/calc-parameters\.js\?v=[^"]+" defer><\/script>/.test(src)) s5.push(page + ': calc-parameters.js');
  if (!/<script src="js\/rz-basis-drawer\.js\?v=[^"]+" data-rz-registry="RZ_CALC_PARAMETERS" defer><\/script>/.test(src)) s5.push(page + ': rz-basis-drawer.js with the calc registry');
  if (!/<script src="js\/rz-calc-basis\.js\?v=[^"]+" defer><\/script>/.test(src)) s5.push(page + ': rz-calc-basis.js');
}
ok('S5 the 6 pages load the registry, the drawer and rz-calc-basis.js', !s5.length, s5.join('; '));

/* B1 */
if (!process.argv.includes('--skip-build')) {
  const fresh = await build();
  ok('B1 fresh build has no errors', !fresh.errors.length, fresh.errors.join('; '));
  let diff = '';
  if (fresh.json + '\n' !== jsonText) {
    const F = Object.fromEntries(fresh.doc.parameters.map((p) => [p.id, p]));
    for (const p of P) {
      const f = F[p.id];
      if (!f) { diff = p.id + ' gone'; break; }
      if (f.display !== p.display) { diff = p.id + ': page shows ' + f.display + ', registry says ' + p.display; break; }
      if (JSON.stringify(f.dependsOnInputs) !== JSON.stringify(p.dependsOnInputs)) { diff = p.id + ': measured inputs now ' + f.dependsOnInputs.join('|'); break; }
    }
    diff = diff || 'records added, removed or edited in the curated file - rebuild';
  }
  ok('B1 registry equals a fresh render of the pages (values at defaults, measured inputs)', !diff, diff + ' — run node tools/build-calc-parameter-registry.mjs');
}

/* B2–B7 */
const { server, base } = await serve();
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const drawerState = (tab) => tab.evaluate(() => {
  const host = document.getElementById('rz-basis-drawer');
  const open = !!(host && host.style.display === 'flex');
  const rows = {};
  if (open) document.querySelectorAll('#rz-basis-drawer-panel > div').forEach((r) => {
    const k = r.children[0], v = r.children[1];
    if (k && v && r.children.length === 2) rows[k.textContent.trim()] = { text: v.textContent.replace(/\s+/g, ' ').trim(), lines: v.querySelectorAll(':scope > div').length };
  });
  const t = document.getElementById('rz-basis-drawer-title');
  return { open, title: t ? t.textContent.trim() : '', rows, active: document.activeElement && document.activeElement.getAttribute('data-basis-param') };
});
try {
  for (const page of PAGES) {
    const calc = P.find((p) => p.page === page).calc;
    const tab = await openPage(browser, base, page);
    const hooks = await tab.evaluate(() => [...document.querySelectorAll('[data-basis-param],[data-rz-basis-gated]')].map((e) => e.getAttribute('data-basis-param') || e.getAttribute('data-rz-basis-gated')));
    const want = byCalc[calc].map((p) => p.id).sort();
    const got = [...hooks].sort();
    ok('B2 ' + page + ': hooks = its ' + want.length + ' records', JSON.stringify(got) === JSON.stringify(want), 'missing ' + want.filter((x) => !got.includes(x)).join(',') + ' extra ' + got.filter((x) => !want.includes(x)).join(','));
    const rec = byCalc[calc][0];
    await tab.evaluate((id) => { const e = document.querySelector('[data-basis-param="' + id + '"]'); e.scrollIntoView({ block: 'center' }); e.focus(); }, rec.id);
    const cell = await tab.evaluate((id) => document.querySelector('[data-basis-param="' + id + '"]').textContent.replace(/\s+/g, ' ').trim(), rec.id);
    const name = await tab.evaluate((id) => document.querySelector('[data-basis-param="' + id + '"]').getAttribute('aria-label'), rec.id);
    await tab.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 200));
    const st = await drawerState(tab);
    const vn = (st.rows['Value now'] || {}).text || '';
    ok('B3 ' + page + ': Enter opens ' + rec.id + ' with label, live value, ' + rec.inputs.length + ' live inputs, computed-by',
      st.open && st.title.startsWith(rec.label) && vn.startsWith(cell) && (st.rows['Inputs now'] || {}).lines === rec.inputs.length && !!st.rows['Computed by'] && !!st.rows['At defaults'],
      JSON.stringify({ open: st.open, title: st.title, vn, cell, inputs: (st.rows['Inputs now'] || {}).lines }));
    ok('B3 ' + page + ': the focused cell is named with its value (' + name + ')', !!name && name.includes(cell) && name.startsWith(rec.label));
    await tab.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 150));
    const st2 = await drawerState(tab);
    ok('B3 ' + page + ': Esc closes and focus returns to the cell', !st2.open && st2.active === rec.id, JSON.stringify(st2));

    if (page === 'pue-calculator.html') {
      await tab.evaluate(() => { const e = document.getElementById('itLoad'); e.value = '2000'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
      await new Promise((r) => setTimeout(r, 900));
      const cellNow = await tab.evaluate(() => document.querySelector('[data-basis-param="calc.pue.total_power"]').textContent.trim());
      await tab.evaluate(() => window.RZBasisDrawer.open('calc.pue.total_power'));
      const st3 = await drawerState(tab);
      ok('B4 after IT load 2000: Value now ' + cellNow + ' (defaults ' + byCalc.pue.find((p) => p.id === 'calc.pue.total_power').display + '), Inputs now shows 2000',
        (st3.rows['Value now'] || {}).text.startsWith(cellNow) && cellNow !== byCalc.pue.find((p) => p.id === 'calc.pue.total_power').display && /IT load \(kW\): 2000/.test((st3.rows['Inputs now'] || {}).text));
      await tab.evaluate(() => window.RZBasisDrawer.close());
      await tab.evaluate(() => { window.RZ_CALC_PARAMETERS.engineDataVersion = 'other'; window.RZBasisDrawer.open('calc.pue.pue'); });
      const st4 = await drawerState(tab);
      ok('B5 registry from other engine data: drawer says Runtime basis unavailable', st4.open && st4.title === 'Runtime basis unavailable' && !st4.rows['Value now']);
    }
    if (page === 'capex-calculator.html') {
      const id = 'calc.capex.cost.electrical';
      const q = (sel) => tab.evaluate((sel) => { const e = document.querySelector(sel); return e && { hook: e.getAttribute('data-basis-param'), parked: e.getAttribute('data-rz-basis-gated'), tab: e.getAttribute('tabindex'), w: getComputedStyle(e, '::after').width, text: e.textContent.trim() }; }, sel);
      const g = await q('[data-rz-basis-gated="' + id + '"]');
      await tab.evaluate((id) => { const e = document.querySelector('[data-rz-basis-gated="' + id + '"]'); if (e) e.click(); }, id);
      await new Promise((r) => setTimeout(r, 200));
      const stG = await drawerState(tab);
      ok('B8 a value hidden from a signed-out visitor (' + id + ') is parked: no hook, no tab stop, no mark, no drawer',
        !!g && !g.hook && g.parked === id && g.tab === null && g.w !== '6px' && !stG.open, JSON.stringify({ g, open: stG.open }));
      await tab.evaluate((id) => document.querySelector('[data-rz-basis-gated="' + id + '"]').classList.remove('cost-value-hidden'), id);
      await new Promise((r) => setTimeout(r, 200));
      const u = await q('[data-basis-param="' + id + '"]');
      await tab.evaluate((id) => document.querySelector('[data-basis-param="' + id + '"]').click(), id);
      await new Promise((r) => setTimeout(r, 200));
      const stU = await drawerState(tab);
      ok('B8 once the page reveals it, the hook, the mark and the drawer come back',
        !!u && u.hook === id && u.tab === '0' && u.w === '6px' && stU.open && (stU.rows['Value now'] || {}).text.startsWith(u.text), JSON.stringify({ u, open: stU.open }));
      await tab.evaluate(() => window.RZBasisDrawer.close());
    }
    if (page === 'carbon-footprint.html') {
      const n = async () => tab.evaluate(() => document.querySelectorAll('[data-basis-param]').length);
      const opN = await n();
      await tab.evaluate(() => window.switchTab('lifecycle'));
      await new Promise((r) => setTimeout(r, 700));
      const lcN = await n();
      await tab.evaluate(() => window.switchTab('operational'));
      await new Promise((r) => setTimeout(r, 700));
      const backN = await n();
      ok('B7 carbon hooks: operational ' + opN + ', life-cycle ' + lcN + ', back ' + backN, opN === 6 && lcN === 0 && backN === 6);
    }
    await tab.close();
  }
  /* B6 */
  const ctx = await browser.createBrowserContext();
  const tab = await ctx.newPage();
  await tab.setCacheEnabled(false);
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (r.url().startsWith(base) && !r.url().includes('calc-parameters.js') ? r.continue() : r.abort()));
  await tab.goto(base + 'roi-calculator.html', { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  await tab.evaluate(() => document.querySelector('[data-basis-param="calc.roi.npv"]').click());
  await new Promise((r) => setTimeout(r, 200));
  const st6 = await drawerState(tab);
  const mark = await tab.evaluate(() => ({ css: !!document.getElementById('rz-calc-basis-css'), w: getComputedStyle(document.querySelector('[data-basis-param="calc.roi.npv"]'), '::after').width }));
  ok('B6 registry blocked: a hook click opens nothing and no mark is drawn', !st6.open && !mark.css && mark.w !== '6px', JSON.stringify({ open: st6.open, mark }));
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}

console.log('\nCALC PARAMETER REGISTRY — ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
