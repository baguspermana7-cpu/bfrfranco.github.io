#!/usr/bin/env node
/**
 * backtest-fin-screener.mjs — does the FIN Engine's TECHNICAL gauge actually carry signal?
 *
 * Walk-forward backtest: for a sample of tickers, pull real candle history from the deployed
 * gateway (/candles, 5Y weekly), and at each step compute FINEngine.models.technical.analyze()
 * on the history up to that point, then measure the FORWARD return over the next N bars. Bucket
 * every observation by the gauge signal (Buy ≥60 / Sell ≤40 / Neutral) and compare average
 * forward return + hit-rate (% positive) against the all-periods baseline.
 *
 * If the gauge has signal, Buy-bucket forward returns should beat the baseline, which should beat
 * the Sell bucket. This is NOT a trading strategy or a promise of returns — it is an honesty check
 * on the engine's technical read.
 *
 * SCOPE (stated honestly): this backtests the price/technical gauge only. The screener's FUNDAMENTAL
 * factors (value/quality/dividend) cannot be cheaply backtested — historical fundamentals aren't
 * available on the free data tier — so they are out of scope here.
 *
 * Run:  node tools/backtest-fin-screener.mjs [fwdBars]     (needs network — hits the live gateway)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GATEWAY = 'https://rz-finance-gateway.resistancezero0us.workers.dev';
const FWD = parseInt(process.argv[2], 10) || 4;   // forward bars (weekly candles → ~1 month)
const WARMUP = 55;                                // need ≥50 bars for sma50-based gauge
const SAMPLE = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'JPM', 'XOM', 'WMT', 'KO', 'JNJ', 'HD',
    'INTC', 'BA', 'DIS', 'PFE', 'CSCO'];

/* load the engine (node-vm, same shim as the gate) */
function loadEngine() {
    const src = readFileSync(resolve(__dirname, '..', 'fin-engine.js'), 'utf8');
    const win = {};
    win.window = win; win.CustomEvent = function () {}; win.dispatchEvent = function () {};
    win.addEventListener = function () {}; win.console = console;
    vm.runInContext(src, vm.createContext(win), { filename: 'fin-engine.js' });
    if (!win.FINEngine) throw new Error('FINEngine did not attach');
    return win.FINEngine;
}

async function candles(sym) {
    const r = await fetch(`${GATEWAY}/candles?sym=${encodeURIComponent(sym)}&tf=5Y`);
    const j = await r.json();
    return (j && j.ok && j.data && j.data.candles) || [];
}

function agg(arr) {
    if (!arr.length) return { n: 0, avg: null, hit: null };
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const hit = arr.filter((x) => x > 0).length / arr.length;
    return { n: arr.length, avg: avg, hit: hit };
}
const pct = (x) => x == null ? '   n/a' : (x >= 0 ? '+' : '') + (x * 100).toFixed(2) + '%';
const hitp = (x) => x == null ? ' n/a' : (x * 100).toFixed(0) + '%';

const E = loadEngine();
const T = E.models.technical;

const buckets = { buy: [], neutral: [], sell: [], all: [] };
let stocksUsed = 0;

console.log(`\nFIN Engine — technical-gauge backtest (${SAMPLE.length} tickers, 5Y weekly, forward ${FWD} bars)\n`);
for (const sym of SAMPLE) {
    let ks;
    try { ks = await candles(sym); } catch (e) { console.log(`  ${sym}: fetch failed`); continue; }
    if (ks.length < WARMUP + FWD + 5) { console.log(`  ${sym}: too few candles (${ks.length})`); continue; }
    stocksUsed++;
    for (let t = WARMUP; t < ks.length - FWD; t++) {
        const g = T.analyze(ks.slice(0, t + 1)).gauge.score;
        const c0 = ks[t].c, cN = ks[t + FWD].c;
        if (!(c0 > 0) || !(cN > 0)) continue;
        const ret = cN / c0 - 1;
        buckets.all.push(ret);
        if (g >= 60) buckets.buy.push(ret);
        else if (g <= 40) buckets.sell.push(ret);
        else buckets.neutral.push(ret);
    }
}

const B = agg(buckets.buy), N = agg(buckets.neutral), S = agg(buckets.sell), A = agg(buckets.all);
console.log(`  tickers used: ${stocksUsed}/${SAMPLE.length}   observations: ${A.n}\n`);
console.log('  bucket    │   obs │  avg fwd return │ hit-rate');
console.log('  ──────────┼───────┼─────────────────┼─────────');
console.log(`  Buy  ≥60  │ ${String(B.n).padStart(5)} │  ${pct(B.avg).padStart(13)} │  ${hitp(B.hit)}`);
console.log(`  Neutral   │ ${String(N.n).padStart(5)} │  ${pct(N.avg).padStart(13)} │  ${hitp(N.hit)}`);
console.log(`  Sell ≤40  │ ${String(S.n).padStart(5)} │  ${pct(S.avg).padStart(13)} │  ${hitp(S.hit)}`);
console.log(`  Baseline  │ ${String(A.n).padStart(5)} │  ${pct(A.avg).padStart(13)} │  ${hitp(A.hit)}`);

const edge = (B.avg != null && S.avg != null) ? (B.avg - S.avg) : null;
console.log(`\n  Buy − Sell spread: ${edge == null ? 'n/a' : pct(edge)}` +
    `   (Buy beats baseline: ${B.avg != null && A.avg != null ? (B.avg > A.avg ? 'yes' : 'no') : 'n/a'})`);

// Honest interpretation — the harness reports what the data says, it does not sell a result.
let verdict;
if (edge == null) verdict = 'Inconclusive (insufficient data).';
else if (edge > 0.005) verdict = 'The gauge showed a positive forward EDGE on this sample (Buy > Sell). Still descriptive — combine with fundamentals + risk limits.';
else if (edge < -0.005) verdict = 'Sell signals OUTPERFORMED Buy here (mean-reversion). Do NOT treat the technical gauge as a standalone timing signal — it is a descriptive read of current technicals, not a predictor.';
else verdict = 'No meaningful forward edge on this sample — the gauge is DESCRIPTIVE (what the technicals are doing now), not predictive. This is why the FIN Engine blends multiple factors and disclaims.';
console.log('\n  VERDICT: ' + verdict);
console.log('\n  NOTE: technical/price gauge only — fundamental factors (value/quality/dividend) are NOT');
console.log('  backtested (no free historical fundamentals). Educational validation, not a strategy.\n');

// Non-zero exit only if the gateway gave us nothing to test (so CI catches a dead endpoint).
if (A.n === 0) { console.log('FAIL — no observations (gateway unreachable?).'); process.exit(1); }
console.log('DONE.');
