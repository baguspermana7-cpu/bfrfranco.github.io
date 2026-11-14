#!/usr/bin/env node
/*
 * R125 browser gate: the Measured mode of pue-calculator.html (js/rz-pue-measured.js over RZEngine.models.pue.measured).
 *
 *   node tools/test-pue-measured.mjs        # exit 1 on any failed law (run under rz-lane)
 *
 * M1 the page opens on Estimate: the estimate bench shows, the measured bench is hidden, no page error
 * M2 Measured shows its bench, hides the estimate and its charts; Estimate brings them back, the estimate unchanged
 * M3 the shown PUE equals the engine for typed inputs (the reference's Case B 1.708; a gas case; category 2), and the
 *    weighted rows print each type's energy x factor
 * M4 a refused input (category 0 with district chilled water; IT 0) shows the engine's reason and no number
 * M5 "Add energy type" reveals that type's row and only unused types are offered
 * M6 at 390 and 1440, dark and light: no sideways scroll, axe finds no serious or critical violation in the bench
 * M7 the estimate's "What drives this result" panel (rz-sensitivity, anchor from data/calculators.json) mounts right
 *    after the Estimate bench, shows on Estimate and hides on Measured (it explains the estimate, not the measurement)
 * Engine parity with the reference: tools/test-pue-reference.mjs.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const AXE = fs.readFileSync(path.join(ROOT, 'tools/vendor/axe.min.js'), 'utf8');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
let fail = 0;
const law = (id, ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

async function open(vp, theme) {
  const pg = await browser.newPage();
  pg.errors = [];
  pg.on('pageerror', (e) => pg.errors.push(e.message));
  await pg.setRequestInterception(true);
  pg.on('request', (r) => (r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort()));
  await pg.setViewport(vp);
  await pg.evaluateOnNewDocument((t) => {
    try { localStorage.setItem('theme', t); localStorage.setItem('rz_cookie_consent', 'declined'); } catch (x) { /* no storage */ }
  }, theme);
  await pg.goto(ORIGIN + 'pue-calculator.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await wait(900);
  return pg;
}
const state = (pg) => pg.evaluate(() => ({
  measured: !!document.getElementById('pmBench') && !document.getElementById('pmBench').hidden,
  estimate: !!document.getElementById('pmEstimateBench') && !document.getElementById('pmEstimateBench').hidden,
  charts: !document.querySelector('.charts-section') || !document.querySelector('.charts-section').hidden,
  tab: (document.getElementById('btnMeasured') || { getAttribute: () => null }).getAttribute('aria-selected'),
  est: (document.getElementById('pueValue') || {}).textContent,
}));
const click = (pg, id) => pg.evaluate((i) => { const b = document.getElementById(i); if (b) b.click(); }, id);
// set inputs the way a reader does (value + input event), then read the page and the engine for the same inputs
async function enter(pg, cat, it, energy) {
  return pg.evaluate((cat, it, energy) => {
    const set = (id, v) => { const el = document.getElementById(id); if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    const sel = document.getElementById('pmCat');
    if (sel) { sel.value = String(cat); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    ['electricity', 'naturalGas', 'fuelOil', 'otherFuels', 'districtChilledWater', 'districtHotWater', 'districtSteam', 'condenserWater']
      .forEach((k) => set('pm-' + k, energy[k] || 0));
    set('pmIt', it);
    const full = { electricity: 0, naturalGas: 0, fuelOil: 0, otherFuels: 0, districtChilledWater: 0, districtHotWater: 0, districtSteam: 0, condenserWater: 0, ...energy };
    const r = window.RZEngine.models.pue.measured(cat === 0 ? { category: 0, itKw: it, energy: full } : { category: cat, itKwh: it, energy: full });
    const q = (id) => (document.getElementById(id) || {}).textContent || '';
    return { shown: q('pmPue'), label: q('pmLabel'), err: q('pmErr'), errHidden: !!(document.getElementById('pmErr') || {}).hidden,
      rows: [...document.querySelectorAll('#pmRows .metric-box')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()), engine: r };
  }, cat, it, energy);
}

// ── M1–M5 at 1440 dark ───────────────────────────────────────────────────────────────────────────────────────────
const pg = await open({ width: 1440, height: 1000 }, 'dark');
const s0 = await state(pg);
law('M1', s0.estimate && !s0.measured && s0.charts && !pg.errors.length,
  `opens on Estimate (estimate ${s0.estimate}, measured ${s0.measured}, charts ${s0.charts}), page errors ${pg.errors.length}${pg.errors[0] ? ' — ' + pg.errors[0] : ''}`);
await click(pg, 'btnMeasured'); await wait(200);
const s1 = await state(pg);
await click(pg, 'btnEstimate'); await wait(200);
const s2 = await state(pg);
law('M2', s1.measured && !s1.estimate && !s1.charts && s1.tab === 'true' && s2.estimate && !s2.measured && s2.charts && s2.tab === 'false' && s2.est === s0.est,
  `Measured shows its bench and hides the estimate + charts; Estimate restores them, estimate ${s0.est} -> ${s2.est}`);

await click(pg, 'btnMeasured'); await wait(200);
const cases = [
  ['Case B', 1, 1000000, { electricity: 1305000, districtChilledWater: 1300000 }, '1.708'],
  ['gas', 1, 800000, { electricity: 1100000, naturalGas: 600000 }, null],
  ['category 2', 2, 900000, { electricity: 1400000 }, null],
];
for (const [name, cat, it, energy, want] of cases) {
  const r = await enter(pg, cat, it, energy);
  const exp = r.engine.ok ? r.engine.pue.toFixed(3) : '?';
  const rowOk = Object.entries(energy).filter(([, v]) => v > 0).every(([k, v]) => r.rows.some((t) => t.includes(Math.round(r.engine.weighted[k]).toLocaleString('en-US'))));
  law('M3', r.shown === exp && (!want || r.shown === want) && r.label === 'PUE' + cat && rowOk && r.errHidden,
    `${name}: page ${r.shown} ${r.label} = engine ${exp}${want ? ' (reference ' + want + ')' : ''}; weighted rows ${rowOk ? 'match' : 'WRONG ' + r.rows.join(' / ')}`);
}
const bad1 = await enter(pg, 0, 800, { electricity: 1300, districtChilledWater: 500 });
const bad2 = await enter(pg, 1, 0, { electricity: 1000 });
law('M4', bad1.shown === '—' && !bad1.errHidden && bad1.err === bad1.engine.reason && bad2.shown === '—' && bad2.err === bad2.engine.reason,
  `refused inputs show the engine's reason and no number: "${bad1.err}" · "${bad2.err}"`);

await enter(pg, 1, 1000000, { electricity: 1500000 });
const add = await pg.evaluate(() => {
  const sel = document.getElementById('pmAdd');
  if (!sel || !document.getElementById('pm-districtSteam')) return { before: [], after: [], hiddenBefore: false, shown: false };
  const before = [...sel.options].map((o) => o.value).filter(Boolean);
  const hiddenBefore = document.getElementById('pm-districtSteam').closest('.input-group').hidden;
  sel.value = 'districtSteam'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  const after = [...document.getElementById('pmAdd').options].map((o) => o.value).filter(Boolean);
  return { before, hiddenBefore, shown: !document.getElementById('pm-districtSteam').closest('.input-group').hidden, after };
});
law('M5', add.hiddenBefore && add.shown && add.before.includes('districtSteam') && !add.after.includes('districtSteam') && !add.before.includes('electricity'),
  `Add energy type: steam hidden ${add.hiddenBefore} -> shown ${add.shown}; offered ${add.before.length} -> ${add.after.length}, electricity never offered`);

// M7 the sensitivity panel belongs to the estimate
const sens = async () => pg.evaluate(() => {
  const d = document.querySelector('details.rz-sens');
  return d ? { prev: (d.previousElementSibling || {}).id || '', shown: !!d.offsetParent } : null;
});
await click(pg, 'btnEstimate'); await wait(200);
const e7 = await sens();
await click(pg, 'btnMeasured'); await wait(200);
const m7 = await sens();
law('M7', !!e7 && e7.prev === 'pmEstimateBench' && e7.shown && !!m7 && !m7.shown,
  `sensitivity panel ${e7 ? 'after #' + (e7.prev || '?') + ', on Estimate shown ' + e7.shown + ', on Measured shown ' + (m7 && m7.shown) : 'not mounted'}`);
await pg.close();

// ── M6 layout and a11y ───────────────────────────────────────────────────────────────────────────────────────────
for (const w of [390, 1440]) {
  for (const theme of ['dark', 'light']) {
    const p = await open({ width: w, height: 900, isMobile: w < 800, hasTouch: w < 800 }, theme);
    await click(p, 'btnMeasured'); await wait(300);
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    await p.evaluate(AXE);
    const ax = await p.evaluate(async () => (document.getElementById('pmBench')
      ? (await axe.run({ include: [['#pmBench']] }, { resultTypes: ['violations'] })).violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id + ' ' + v.nodes.length)
      : ['no #pmBench']));
    law('M6', m.sw <= m.cw && !ax.length && !p.errors.length, `${w}px ${theme}: page ${m.sw}/${m.cw}, axe ${ax.length}${ax.length ? ' — ' + ax.join(', ') : ''}, errors ${p.errors.length}`);
    await p.close();
  }
}

await browser.close();
srv.close();
console.log(`test-pue-measured: ${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
