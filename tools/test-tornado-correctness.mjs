#!/usr/bin/env node
/**
 * test-tornado-correctness.mjs — P07 part B: every calculator's own sensitivity chart agrees with the page it describes.
 *
 *  T1 tco    tornado bars for PUE, utilisation and growth equal the build-minus-colo swing the page shows when that input
 *            is moved x0.8 / x1.2 (within the $0.1M display rounding of two KPIs); the tornado calls tcoCore (the page's
 *            model) and carries no model loop of its own; a typed power price changes the build TCO
 *  T2 cx     every sensitivity row's low and high, formatted the page's way, equal #cxKpiTotal after setting that input
 *  T3 spares the heatmap's centre cell (both axes at x1.0) equals the module's own RPN, optimal quantity and fill rate
 *  T4 tier   the contribution chart uses the same sub-weights as the composite score, and is not called "sensitivity"
 *  T5 capex, opex  the uncertainty tornado runs the same driver function as the Monte Carlo beside it
 *  (roi and carbon lost their own charts in v3.40.0; tools/test-sensitivity.mjs U4 checks their replacement.)
 *
 * Run: node tools/test-tornado-correctness.mjs
 */
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const src = async (f) => readFile(join(ROOT, f), 'utf8');

/* static */
{
  const tco = await src('tco-calculator.html');
  const torn = tco.slice(tco.indexOf('function renderTornado()'), tco.indexOf("el('tcoTornadoBars').innerHTML"));
  ok(/tcoCore\(p\)/.test(torn) && !/for \(var y = 0; y < r\.years/.test(torn), 'T1 tco tornado must call tcoCore and carry no model loop of its own');
  const tier = await src('tier-advisor.html');
  const sub = (txt, re) => [...txt.matchAll(re)].map((m) => m[1] + '=' + m[2]).sort().join(',');
  const fig = tier.slice(tier.indexOf('function renderTornado('), tier.indexOf('factors.sort(', tier.indexOf('function renderTornado(')));
  const main = tier.slice(tier.indexOf('var powerScore ='), tier.indexOf('var physicalScore =') + 200);
  const pairs = sub(fig, /gs\('(\w+)'\)\*WEIGHTS\.\w+\*([\d.]+)/g).split(',');
  const mainPairs = new Set(sub(main, /gs\('(\w+)'\)\*([\d.]+)/g).split(','));
  ok(pairs.length === 8 && pairs.every((p) => mainPairs.has(p)), `T4 tier chart sub-weights ${pairs} differ from the score formula`);
  ok(!/Sensitivity Analysis/.test(tier) && /Contribution to the composite score/.test(tier), 'T4 tier chart is still called a sensitivity analysis');
  for (const f of ['capex-calculator.html', 'opex-calculator.html']) {
    const s = await src(f);
    const blk = s.slice(s.indexOf('monteCarlo(f,'), s.indexOf('monteCarlo(f,') + 3000);
    ok(/monteCarlo\(f,/.test(s) && /sim\.tornado\(f,/.test(blk), `T5 ${f}: the tornado does not run the Monte Carlo's driver function f`);
  }
}

const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const open = async (url, pro) => {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1280, height: 900 });
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (r.url().startsWith(base) || /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)\//.test(r.url()) ? r.continue() : r.abort()));
  const errs = []; tab.on('pageerror', (e) => errs.push(String(e.message || e)));
  // A local Pro session for the test browser only (the pages read it to show their Pro panels; no account is involved).
  if (pro) await tab.evaluateOnNewDocument(() => localStorage.setItem('rz_premium_session', JSON.stringify({ email: 'gate@example.test', tier: 'pro', expires: '2099-01-01' })));
  await tab.goto(base + url, { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  return { tab, errs };
};

try {
  /* T1 */
  {
    const { tab, errs } = await open('tco-calculator.html', true);
    const r = await tab.evaluate(async () => {
      const num = (s) => { const m = String(s).replace(/,/g, '').match(/(-?)\$?(\d+(?:\.\d+)?)\s*([KMB]?)/); return m ? (m[1] ? -1 : 1) * parseFloat(m[2]) * ({ K: 1e3, M: 1e6, B: 1e9 }[m[3]] || 1) : NaN; };
      const bars = Object.fromEntries([...document.querySelectorAll('#tcoTornadoBars .tco-tornado-bar-wrap')].map((w) => [w.querySelector('.tco-tornado-label').textContent, num(w.querySelector('.tco-tornado-val').textContent)]));
      const diff = () => num(document.querySelector('#kpiBuildTco').textContent) - num(document.querySelector('#kpiColoTco').textContent);
      const pick = async (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((q) => setTimeout(q, 80)); };
      const out = { bars, rows: {} };
      for (const [lab, id] of [['PUE', 'tcoPue'], ['Utilization', 'tcoUtil'], ['Growth Rate', 'tcoGrowth']]) {
        const el = document.getElementById(id), keep = el.value, v = parseFloat(keep);
        await pick(id, String(+(v * 0.8).toFixed(4))); const lo = diff();
        await pick(id, String(+(v * 1.2).toFixed(4))); const hi = diff();
        await pick(id, keep);
        out.rows[lab] = { bar: bars[lab], ui: Math.abs(hi - lo) };
      }
      const b0 = num(document.querySelector('#kpiBuildTco').textContent);
      await pick('tcoPowerOverride', '0.30'); out.override = { before: b0, after: num(document.querySelector('#kpiBuildTco').textContent) };
      await pick('tcoPowerOverride', '');
      return out;
    });
    ok(Object.keys(r.bars).length === 7 && !('Cloud Discount' in r.bars), `T1 tco bars ${JSON.stringify(Object.keys(r.bars))} (7 expected, no cloud discount: it is not in the build-minus-colo gap)`);
    for (const [lab, x] of Object.entries(r.rows)) ok(Number.isFinite(x.bar) && Math.abs(x.bar - x.ui) <= 0.2e6 + 1, `T1 tco ${lab}: bar ${x.bar} vs page swing ${x.ui}`);
    ok(r.override.after > r.override.before, `T1 tco power override 0.30 $/kWh left the build TCO at ${r.override.after}`);
    ok(errs.length === 0, `T1 page errors: ${errs.join(' | ')}`);
    await tab.close();
  }
  /* T2 */
  {
    const { tab, errs } = await open('cx-calculator.html', true);
    const r = await tab.evaluate(async () => {
      cxIsPremium = true; cxCurrentMode = 'pro'; cxCalculate(false);
      const sens = cxLastSens || [];
      const MAP = { 'IT Load': ['cxItLoad', 'cxItLoadNum'], 'Cooling Type': ['cxCoolingType'], 'Redundancy': ['cxRedundancy'], 'Building Type': ['cxBuildingType'],
        'Seismic Zone': ['cxSeismicZone'], 'Substation': ['cxSubstation'], 'BMS/DCIM': ['cxBmsComplexity'] };
      const LOHI = { 'Cooling Type': ['air', 'dlc'], 'Redundancy': ['N', '2N+1'], 'Building Type': ['warehouse', 'highrise'], 'Seismic Zone': ['0', '4'], 'Substation': ['utility_fed', 'ring_bus'], 'BMS/DCIM': ['basic', 'ai_driven'] };
      const set = (ids, v) => ids.forEach((id) => { document.getElementById(id).value = v; });
      const bad = [];
      for (const row of sens) {
        const ids = MAP[row.name];
        if (!ids) { bad.push('unmapped ' + row.name); continue; }
        const keep = document.getElementById(ids[0]).value;
        const lo = LOHI[row.name] ? LOHI[row.name][0] : String(Math.round(+keep * 0.8));
        const hi = LOHI[row.name] ? LOHI[row.name][1] : String(Math.round(+keep * 1.2));
        if (![...(document.getElementById(ids[0]).options || [{ value: lo }, { value: hi }])].some((o) => o.value === lo)) bad.push(`${row.name}: option ${lo} not on the page`);
        set(ids, lo); cxCalculate(false); const tl = document.getElementById('cxKpiTotal').textContent;
        set(ids, hi); cxCalculate(false); const th = document.getElementById('cxKpiTotal').textContent;
        set(ids, keep); cxCalculate(false);
        if (tl !== cxFmt(row.low) || th !== cxFmt(row.high)) bad.push(`${row.name}: chart ${cxFmt(row.low)}/${cxFmt(row.high)}, page ${tl}/${th}`);
      }
      return { n: sens.length, bad };
    });
    ok(r.n === 7 && r.bad.length === 0, `T2 cx ${r.n} rows, mismatches: ${r.bad.join('; ')}`);
    ok(errs.length === 0, `T2 page errors: ${errs.join(' | ')}`);
    await tab.close();
  }
  /* T3 */
  {
    const { tab, errs } = await open('spares-readiness-calculator.html', true);
    const r = await tab.evaluate(async () => {
      const out = {};
      for (const [metric, id] of [['rpn', 'c1_rpn'], ['optimal_qty', 's_qstar'], ['fill_rate', 's_fill_achieved']]) {
        const sel = document.getElementById('sens_metric'); sel.value = metric;
        calcSensitivity();
        const L = window.__rzSensLast;
        if (!L) return { missing: true };
        const mid = Math.floor(L.n / 2);
        const centreMult = L.xMin + (L.xMax - L.xMin) * mid / (L.n - 1);
        out[metric] = { centre: L.grid[mid][mid], shown: document.getElementById(id).textContent.trim(), centreMult };
      }
      return out;
    });
    if (r.missing) { ok(false, 'T3 spares heatmap exposes no result (window.__rzSensLast)'); } else {
    ok(Math.abs(r.rpn.centreMult - 1) < 1e-9, `T3 spares heatmap centre is x${r.rpn.centreMult}, not x1.0`);
    ok(String(r.rpn.centre) === r.rpn.shown, `T3 spares heatmap RPN ${r.rpn.centre} vs module ${r.rpn.shown}`);
    ok(r.optimal_qty.centre + ' units' === r.optimal_qty.shown, `T3 spares heatmap optimal qty ${r.optimal_qty.centre} vs module ${r.optimal_qty.shown}`);
    ok(r.fill_rate.centre.toFixed(1) + '%' === r.fill_rate.shown, `T3 spares heatmap fill rate ${r.fill_rate.centre} vs module ${r.fill_rate.shown}`);
    }
    ok(errs.length === 0, `T3 page errors: ${errs.join(' | ')}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (fails.length) { console.log(`FAIL test-tornado-correctness — ${fails.length} of ${checks}`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log(`PASS test-tornado-correctness — ${checks} checks: tco tornado = page swing via tcoCore (+override works), cx rows = page totals, spares heatmap centre = module values, tier weights = score, capex/opex tornado = Monte Carlo driver`);
