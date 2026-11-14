#!/usr/bin/env node
/**
 * test-market-posture.mjs — js/rz-market-posture.js must score exactly what the ORIGINAL Python does.
 *
 * The module is a port of three skills from tradermonty/claude-trading-skills (MIT):
 * market-breadth-analyzer, uptrend-analyzer, exposure-coach. Laws:
 *   P1  replay: every call the Python test-suites make into the scoring functions (recorded by
 *       tools/market-posture-recorder.py while the original pytest suites ran green) gives the same
 *       output field by field (numbers within 1e-9, strings/labels exact).
 *   P2  fixture CSVs (tools/fixtures/market-posture/, a trimmed snapshot of the live files) parsed and
 *       scored end to end = the Python skills' own fetch + main() path (tools/market-posture-golden.py).
 *   P3  60 seeded synthetic breadth scenarios + 60 uptrend scenarios + their exposure posture = Python.
 *   P4  perturbation: latest 8MA −0.30 must change the composite; the JS result on the perturbed input
 *       must DISAGREE with Python's unperturbed answer (the comparator can fail) and AGREE with Python's
 *       perturbed answer.
 *   B1  browser: the Posture tab renders the fixture's composite, posture and ceiling text; no page errors;
 *       axe-core (tools/vendor) finds 0 serious/critical issues inside the panel;
 *       no horizontal scroll at 390 px; dark and light; a failed fetch shows the error state; one failed
 *       source shows the partial state. CSV URLs are intercepted with the fixtures (offline-deterministic).
 *
 * Python truth: when the skills are on disk (RZ_TRADING_SKILLS or ~/.code/claude-trading-skills/skills)
 * the golden is recomputed live with `python3 -I -B`; otherwise the committed golden.json.gz is used.
 * Usage: node tools/test-market-posture.mjs [--no-browser] [--screens <dir>] [--write-golden]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const FX = path.join(ROOT, 'tools/fixtures/market-posture');
const P = require(path.join(ROOT, 'js/rz-market-posture.js'));
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);

const failures = [];
const law = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures.push(id); };

/* ── comparison ── */
const OMIT = new Set(['exposure_guidance', 'guidance', 'actions']); // trade prescriptions: deliberately not ported
let maxDiff = 0;
function decode(v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && '__float__' in v) return v.__float__ === 'nan' ? NaN : v.__float__ === 'inf' ? Infinity : -Infinity;
  return v;
}
function diff(js, py, at, out) {
  py = decode(py);
  if (out.length > 5) return out;
  if (typeof py === 'number') {
    if (typeof js !== 'number') { out.push(`${at}: js=${JSON.stringify(js)} py=${py}`); return out; }
    if (Number.isNaN(py) && Number.isNaN(js)) return out;
    const d = Math.abs(js - py);
    if (!(d <= 1e-9) && !(js === py)) out.push(`${at}: js=${js} py=${py}`);
    else if (isFinite(d)) maxDiff = Math.max(maxDiff, d);
    return out;
  }
  if (py === null || typeof py !== 'object') { if (js !== py) out.push(`${at}: js=${JSON.stringify(js)} py=${JSON.stringify(py)}`); return out; }
  if (Array.isArray(py)) {
    if (!Array.isArray(js) || js.length !== py.length) { out.push(`${at}: length js=${js && js.length} py=${py.length}`); return out; }
    py.forEach((v, i) => diff(js[i], v, `${at}[${i}]`, out));
    return out;
  }
  if (!js || typeof js !== 'object') { out.push(`${at}: js=${JSON.stringify(js)} is not an object`); return out; }
  for (const k of Object.keys(py)) { if (!OMIT.has(k)) { if (!(k in js)) out.push(`${at}.${k}: missing in js`); else diff(js[k], py[k], `${at}.${k}`, out); } }
  for (const k of Object.keys(js)) if (!(k in py)) out.push(`${at}.${k}: extra in js`);
  return out;
}
const same = (js, py) => diff(js, py, '$', []);

/* ── P1 replay of the Python test-suites' own calls ── */
const FN = {
  'market-breadth-analyzer': {
    'calculators.trend_level_calculator.calculate_breadth_level_trend': (a) => P.breadth.levelTrend(a[0]),
    'calculators.ma_crossover_calculator.calculate_ma_crossover': (a) => P.breadth.maCrossover(a[0]),
    'calculators.cycle_calculator.calculate_cycle_position': (a) => P.breadth.cyclePosition(a[0]),
    'calculators.bearish_signal_calculator.calculate_bearish_signal': (a) => P.breadth.bearishSignal(a[0]),
    'calculators.historical_context_calculator.calculate_historical_percentile': (a) => P.breadth.historicalPercentile(a[0], a[1]),
    'calculators.divergence_calculator.calculate_divergence': (a) => P.breadth.divergence(a[0]),
    'scorer.calculate_composite_score': (a) => P.breadth.composite(a[0], a[1]),
  },
  'uptrend-analyzer': {
    'calculators.market_breadth_calculator.calculate_market_breadth': (a) => P.uptrend.marketBreadth(a[0], a[1]),
    'calculators.sector_participation_calculator.calculate_sector_participation': (a) => P.uptrend.sectorParticipation(a[0], a[1]),
    'calculators.sector_rotation_calculator.calculate_sector_rotation': (a) => P.uptrend.sectorRotation(a[0], a[1]),
    'calculators.momentum_calculator.calculate_momentum': (a) => P.uptrend.momentum(a[0], a[1]),
    'calculators.historical_context_calculator.calculate_historical_context': (a) => P.uptrend.historicalContext(a[0]),
    'scorer.calculate_composite_score': (a) => P.uptrend.composite(a[0], a[1], a[2]),
    'data_fetcher.build_summary_from_timeseries': (a) => P.uptrend.buildSummaryFromTimeseries(a[0]),
  },
  'exposure-coach': {
    'calculate_exposure.extract_breadth_score': (a) => P.exposure.extractBreadthScore(a[0]),
    'calculate_exposure.extract_uptrend_score': (a) => P.exposure.extractUptrendScore(a[0]),
    'calculate_exposure.calculate_composite_score': (a) => P.exposure.composite(a[0]),
    'calculate_exposure.determine_exposure_ceiling': (a) => P.exposure.ceiling(a[0]),
    'calculate_exposure.determine_recommendation': (a) => P.exposure.modelState(a[0], a[1], a[2]),
    'calculate_exposure.determine_participation': (a) => P.exposure.participation(a[0], a[1], a[2]),
    'calculate_exposure.determine_confidence': (a) => P.exposure.confidence(a[0], a[1]),
  },
};
function decodeDeep(v) {
  v = decode(v);
  if (Array.isArray(v)) return v.map(decodeDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decodeDeep(x)]));
  return v;
}
{
  const lines = zlib.gunzipSync(fs.readFileSync(path.join(FX, 'python-test-calls.jsonl.gz'))).toString('utf8').trim().split('\n');
  const per = {}; const bad = [];
  for (const l of lines) {
    const r = JSON.parse(l); const f = FN[r.skill][r.fn];
    per[r.skill] = (per[r.skill] || 0) + 1;
    if (!f) { bad.push(`${r.fn}: no JS mapping`); continue; }
    let js; try { js = f(decodeDeep(r.args)); } catch (e) { bad.push(`${r.test} ${r.fn}: threw ${e.message}`); continue; }
    const d = same(js, r.out);
    if (d.length) bad.push(`${r.test} ${r.fn}: ${d.slice(0, 2).join('; ')}`);
  }
  bad.slice(0, 8).forEach((b) => console.log('   ', b));
  law('P1', bad.length === 0, `replayed ${lines.length} calls from the Python test-suites (${Object.entries(per).map(([k, n]) => `${k} ${n}`).join(', ')}): ${bad.length} mismatches`);
}

/* ── seeded scenarios (mirror of tools/market-posture-golden.py) ── */
function Rng(seed) { let s = seed % 2147483647 || 1; this.next = () => (s = (s * 48271) % 2147483647); this.randint = (lo, hi) => lo + this.next() % (hi - lo + 1); }
const day = (i) => new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
function breadthScenario(seed) {
  const r = new Rng(seed), n = r.randint(1, 150), rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({ Date: day(i), 'S&P500_Price': 4000 + r.randint(0, 2000) * 0.5, Breadth_Index_Raw: r.randint(0, 100) / 100,
      Breadth_Index_200MA: r.randint(20, 80) / 100, Breadth_Index_8MA: r.randint(5, 95) / 100, Breadth_200MA_Trend: [1, -1, 0][r.randint(0, 2)],
      Bearish_Signal: r.randint(0, 9) === 0, Is_Peak: r.randint(0, 29) === 0, Is_Trough: r.randint(0, 29) === 0, Is_Trough_8MA_Below_04: r.randint(0, 49) === 0 });
  }
  const summary = r.randint(0, 3) ? { 'Average Peaks (200MA)': '0.722', 'Average Troughs (8MA < 0.4)': '0.231' } : {};
  return [rows, summary];
}
const SECTORS = ['Technology', 'Consumer Cyclical', 'Communication Services', 'Financial', 'Industrials', 'Utilities', 'Consumer Defensive', 'Healthcare', 'Real Estate', 'Energy', 'Basic Materials'];
const WS = ['sec_technology', 'sec_consumercyclical', 'sec_communicationservices', 'sec_financial', 'sec_industrials', 'sec_utilities', 'sec_consumerdefensive', 'sec_healthcare', 'sec_realestate', 'sec_energy', 'sec_basicmaterials'];
const optSlope = (r) => (r.randint(0, 19) === 0 ? null : (r.randint(0, 400) - 200) / 10000);
function uptrendScenario(seed) {
  const r = new Rng(seed), n = r.randint(1, 60), ts = [];
  for (let i = 0; i < n; i++) for (const ws of ['all', ...WS]) {
    if (ws !== 'all' && r.randint(0, 9) === 0) continue;
    ts.push({ worksheet: ws, date: day(i), count: r.randint(0, 500), total: 500, ratio: r.randint(0, 600) / 1000, ma_10: r.randint(0, 600) / 1000,
      slope: optSlope(r), trend: ['up', 'down', 'neutral'][r.randint(0, 2)] });
  }
  const summary = [];
  if (r.randint(0, 3)) for (const name of SECTORS) {
    if (r.randint(0, 11) === 0) continue;
    summary.push({ Sector: name, Ratio: r.randint(0, 24) === 0 ? null : r.randint(0, 600) / 1000, '10MA': r.randint(0, 600) / 1000,
      Trend: ['Up', 'Down'][r.randint(0, 1)], Slope: optSlope(r), Status: 'Normal' });
  }
  return [ts, summary];
}
const exposureView = (x) => { const o = { ...x }; delete o.posture; delete o.haircut; delete o.missing_critical; return o; };
const breadthView = (b) => b && { as_of: b.as_of, total_rows: b.total_rows, components: b.components, composite: b.composite };
const uptrendView = (u) => u && { as_of: u.as_of, components: u.components, warning_flags: u.warning_flags, composite: u.composite };

/* ── Python truth ── */
const skills = process.env.RZ_TRADING_SKILLS || path.join(process.env.HOME || '', '.code/claude-trading-skills/skills');
let golden, goldenSrc;
if (fs.existsSync(path.join(skills, 'market-breadth-analyzer/scripts/scorer.py'))) {
  const txt = execFileSync('python3', ['-I', '-B', path.join(ROOT, 'tools/market-posture-golden.py'), '--skills', skills, '--fixtures', FX],
    { maxBuffer: 64 << 20, cwd: FX }).toString('utf8');
  golden = JSON.parse(txt); goldenSrc = `live Python (${skills})`;
  if (flag('--write-golden')) fs.writeFileSync(path.join(FX, 'golden.json.gz'), zlib.gzipSync(txt, { level: 9 }));
} else {
  golden = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(FX, 'golden.json.gz'))).toString('utf8'));
  goldenSrc = 'committed golden.json.gz (skills not on disk)';
}
console.log(`   Python truth: ${goldenSrc}`);

/* ── P2 fixtures end to end ── */
const read = (n) => fs.readFileSync(path.join(FX, n), 'utf8');
const det = P.breadth.parseDetailCsv(read('market_breadth_data.csv'));
const sum = P.breadth.parseSummaryCsv(read('market_breadth_summary.csv'));
const ts = P.uptrend.parseTimeseriesCsv(read('uptrend_ratio_timeseries.csv'));
const ss = P.uptrend.parseSectorSummaryCsv(read('sector_summary.csv'));
const bFix = P.breadth.analyze(det.rows, sum);
const uFix = P.uptrend.analyze(ts.rows, ss.rows);
const xFix = P.exposure.compute(bFix, uFix);
{
  const F = golden.fixture;
  const d = [...same(det.rows.length, F.breadth_rows), ...same(sum, F.breadth_summary), ...same(breadthView(bFix), F.breadth),
    ...same(uptrendView(uFix), F.uptrend), ...same(exposureView(xFix), F.exposure),
    ...same(exposureView(P.exposure.compute(bFix, null)), F.exposure_breadth_only), ...same(exposureView(P.exposure.compute(null, null)), F.exposure_none)];
  d.slice(0, 6).forEach((x) => console.log('   ', x));
  law('P2', d.length === 0, `fixture CSVs: breadth ${bFix.composite.composite_score} ${bFix.composite.zone} (py ${F.breadth.composite.composite_score} ${F.breadth.composite.zone}), ` +
    `uptrend ${uFix.composite.composite_score} ${uFix.composite.zone} (py ${F.uptrend.composite.composite_score} ${F.uptrend.composite.zone}), ` +
    `posture ceiling ${xFix.exposure_ceiling_pct}% ${xFix.model_state} ${xFix.confidence} (py ${F.exposure.exposure_ceiling_pct}% ${F.exposure.model_state} ${F.exposure.confidence}); ${d.length} field mismatches`);
}

/* ── P3 seeded scenarios ── */
{
  let bad = 0, n = 0; const notes = []; const zones = new Set();
  golden.breadth_scenarios.forEach((py, i) => {
    const [rows, s] = breadthScenario(1000 + i); const js = P.breadth.analyze(rows, s); n++; zones.add(js.composite.zone);
    const d = same(breadthView(js), py); if (d.length) { bad++; notes.push(`breadth#${i}: ${d[0]}`); }
  });
  golden.uptrend_scenarios.forEach((py, i) => {
    const [t, s] = uptrendScenario(5000 + i); const js = P.uptrend.analyze(t, s); n++; zones.add(js.composite.zone);
    const d = same(uptrendView(js), py); if (d.length) { bad++; notes.push(`uptrend#${i}: ${d[0]}`); }
    const [rows, bs] = breadthScenario(1000 + i);
    const x = P.exposure.compute(P.breadth.analyze(rows, bs), js); n++;
    const dx = same(exposureView(x), golden.exposure_scenarios[i]); if (dx.length) { bad++; notes.push(`exposure#${i}: ${dx[0]}`); }
  });
  notes.slice(0, 6).forEach((x) => console.log('   ', x));
  law('P3', bad === 0 && n >= 180, `${n} seeded scenarios vs Python, zones reached: ${[...zones].sort().join('/')}; ${bad} mismatching; max |Δ| on matching numbers ${maxDiff.toExponential(1)}`);
}

/* ── P4 perturbation ── */
{
  const rows = det.rows.map((r) => ({ ...r }));
  const last = rows[rows.length - 1];
  last.Breadth_Index_8MA = P.py.round(last.Breadth_Index_8MA - 0.30, 6);
  const bP = P.breadth.analyze(rows, sum);
  const changed = bP.composite.composite_score !== bFix.composite.composite_score;
  const redVsOld = same(breadthView(bP), golden.fixture.breadth).length > 0;
  const greenVsNew = same(breadthView(bP), golden.perturbed.breadth).length === 0 && same(exposureView(P.exposure.compute(bP, uFix)), golden.perturbed.exposure).length === 0;
  law('P4', changed && redVsOld && greenVsNew, `latest 8MA ${bFix.components.breadth_level_trend.current_8ma} → ${last.Breadth_Index_8MA}: composite ${bFix.composite.composite_score} → ${bP.composite.composite_score} ` +
    `(py ${golden.perturbed.breadth.composite.composite_score}); vs unperturbed Python ${redVsOld ? 'FAILS as it must' : 'still passes (comparator is blind)'}; vs perturbed Python ${greenVsNew ? 'equal' : 'DIFFERENT'}`);
}

/* ── B1 browser ── */
if (!flag('--no-browser')) {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch { puppeteer = require(path.join(process.env.HOME, 'rz-work/node_modules/puppeteer')); }
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const abs = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
    if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(abs)] || 'application/octet-stream' });
    fs.createReadStream(abs).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); // free port: never 8166/8081
  const BASE = `http://127.0.0.1:${server.address().port}/Apps/finance-terminal/index.html`;
  const CSV = { [P.SOURCES.breadthDetail]: 'market_breadth_data.csv', [P.SOURCES.breadthSummary]: 'market_breadth_summary.csv',
    [P.SOURCES.uptrendTimeseries]: 'uptrend_ratio_timeseries.csv', [P.SOURCES.uptrendSectorSummary]: 'sector_summary.csv' };
  const ALLOW = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const screens = opt('--screens');
  async function run({ width, theme, fail = [] }) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('rz_ft_theme', t); } catch (e) {} }, theme);
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (CSV[u]) {
        if (fail.includes(CSV[u])) return r.respond({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: 'down' });
        return r.respond({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/csv', 'last-modified': 'Sat, 14 Nov 2026 02:00:30 GMT' }, body: read(CSV[u]) });
      }
      if (u.startsWith('http://127.0.0.1') || ALLOW.test(u) || u.startsWith('data:')) return r.continue();
      return r.abort();
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); const m = document.getElementById('apiModal'); if (m) m.style.display = 'none'; }, theme);
    await page.evaluate(() => switchTab('posture'));
    await page.waitForFunction(() => document.getElementById('postureRoot').getAttribute('aria-busy') === 'false' && document.querySelector('#postureRoot .fs-card'), { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 300));
    await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'tools/vendor/axe.min.js'), 'utf8') });
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run('#postureRoot', { resultTypes: ['violations'] });
      return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}×${v.nodes.length}` + ' ' + v.nodes.slice(0, 4).map((n) => n.target.join(' ') + ' ' + ((n.any[0] || {}).message || '').slice(0, 90)).join(' | '));
    });
    const info = await page.evaluate(() => ({ text: document.getElementById('postureRoot').innerText, sw: document.documentElement.scrollWidth,
      bodyBg: getComputedStyle(document.body).backgroundColor, cardBg: (() => { const c = document.querySelector('#postureRoot .fs-card'); return c ? getComputedStyle(c).backgroundColor : null; })() }));
    if (screens) await page.screenshot({ path: path.join(screens, `w2c-posture-${width}-${theme}${fail.length ? '-fail' : ''}.png`), fullPage: true });
    await page.close();
    return { ...info, errors, axe };
  }
  const want = [P.py.fmt(bFix.composite.composite_score, 1), P.py.fmt(uFix.composite.composite_score, 1), `${xFix.exposure_ceiling_pct}%`, xFix.posture, bFix.as_of];
  const results = [];
  for (const [width, theme] of [[1440, 'dark'], [390, 'dark'], [1440, 'light'], [390, 'light']]) {
    const r = await run({ width, theme });
    const missing = want.filter((w) => !r.text.includes(w));
    const disc = r.text.includes('not investment advice') || r.text.toLowerCase().includes('educational');
    const ok = !missing.length && disc && !r.errors.length && r.sw <= width && !r.axe.length;
    results.push(ok);
    console.log(`    ${width}px ${theme}: scrollWidth ${r.sw}, card ${r.cardBg} on body ${r.bodyBg}, missing text [${missing.join(', ')}], disclaimer ${disc}, page errors ${r.errors.length}${r.errors.length ? ' ' + r.errors[0] : ''}, axe serious/critical in panel [${r.axe.join(', ')}]`);
  }
  const allFail = await run({ width: 390, theme: 'dark', fail: Object.values(CSV) });
  const partial = await run({ width: 390, theme: 'dark', fail: ['market_breadth_data.csv'] });
  const errOk = allFail.text.includes('Market posture unavailable') && allFail.text.includes('HTTP 503') && !allFail.errors.length;
  const partOk = partial.text.includes('Market breadth unavailable') && partial.text.includes(P.py.fmt(uFix.composite.composite_score, 1)) &&
    /Not available in the browser: [^\n]*Market breadth/.test(partial.text) && !partial.errors.length;
  console.log(`    fetch error state: ${errOk}; breadth-missing partial state: ${partOk}`);
  await browser.close(); server.close();
  law('B1', results.every(Boolean) && errOk && partOk, `Posture tab shows [${want.join(' | ')}] at 1440/390 in dark+light with no page errors, no sideways scroll, 0 serious/critical axe findings in the panel; error + partial states render`);
}

console.log(failures.length ? `\nFAIL ${failures.join(', ')}` : '\nALL MARKET-POSTURE LAWS PASS');
process.exit(failures.length ? 1 : 0);
