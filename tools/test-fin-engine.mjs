#!/usr/bin/env node
/**
 * test-fin-engine.mjs — FIN Engine gate. Mirrors tools/test-rz-engine.mjs.
 *
 * Loads fin-engine.js in a sandboxed VM (window shim), then asserts:
 *   1. Worked examples (golden values) — ratios/valuation/technical/score/risk math.
 *   2. Parity — FINEngine.models.technical.analyze() === cf-worker/src/ta.js analyze()
 *      on the same candles (the client and the gateway must agree exactly).
 *   3. Data invariants — currencies resolvable, universes sourced, factor weights sane.
 *   4. Provenance — every DATA.sources entry carries source + asOf.
 *   5. Disclaimer — every scored output + the technical rationale carries the not-advice line.
 *
 * Run: node tools/test-fin-engine.mjs   (exit 0 = all pass; exit 1 = any fail). SHIP GATE.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE = resolve(__dirname, '..', 'fin-engine.js');

function loadEngine() {
    const src = readFileSync(ENGINE, 'utf8');
    const win = {};
    win.window = win;
    win.CustomEvent = function () {};
    win.dispatchEvent = function () {};
    win.addEventListener = function () {};
    win.console = console;
    const ctx = vm.createContext(win);
    vm.runInContext(src, ctx, { filename: 'fin-engine.js' });
    if (!win.FINEngine) throw new Error('FINEngine did not attach to window');
    return win.FINEngine;
}

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; fails.push(name + (detail ? ' — ' + detail : '')); } }
function near(name, got, want, tolFrac) {
    const tol = Math.abs(want * (tolFrac == null ? 0.005 : tolFrac)) + 1e-9;
    ok(name, Math.abs(got - want) <= tol, `got ${got}, want ${want} (±${tol.toFixed(4)})`);
}
function eq(name, got, want) { ok(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }

const E = loadEngine();
const D = E.data;
const M = E.models;

/* ── deterministic candle fixture (enough for sma200) ── */
const candles = [];
for (let i = 0; i < 260; i++) {
    const c = 100 + i * 0.2 + 10 * Math.sin(i / 8);
    candles.push({ t: 1700000000 + i * 86400, o: c, h: c * 1.01, l: c * 0.99, c: c, v: 1e6 });
}

/* ============================================================
 * 1. WORKED EXAMPLES
 * ============================================================ */
near('ratios.pe(100,5)', M.ratios.pe(100, 5), 20);
near('ratios.pb(100,10)', M.ratios.pb(100, 10), 10);
near('ratios.roe(20,100)', M.ratios.roe(20, 100), 0.2);
near('ratios.debtEquity(30,100)', M.ratios.debtEquity(30, 100), 0.3);
eq('ratios.pe(price,0)=null', M.ratios.pe(100, 0), null);

near('valuation.graham(5,10)', M.valuation.graham(5, 10), Math.sqrt(1125));
near('valuation.ddm(2,0.05,0.10)', M.valuation.ddm(2, 0.05, 0.10), 42);
near('valuation.dcf 2-stage', M.valuation.dcf(100, 0.10, 5, 0.03, 0.10, null), 1971.43, 0.01);
eq('valuation.dcf discount<=g → null', M.valuation.dcf(100, 0.10, 5, 0.11, 0.10, null), null);

// technical spot-checks (exactness comes from the parity test below)
const an = M.technical.analyze(candles);
ok('technical.analyze price present', typeof an.price === 'number');
ok('technical.rsi in 0..100', an.indicators.rsi14 >= 0 && an.indicators.rsi14 <= 100);
ok('technical.gauge score 0..100', an.gauge.score >= 0 && an.gauge.score <= 100);
ok('technical.gauge has label', typeof an.gauge.label === 'string' && an.gauge.label.length > 0);

// risk
const closes = candles.map(k => k.c);
const rets = M.risk.returns(closes);
ok('risk.returns length', rets.length === closes.length - 1);
ok('risk.volatility positive', M.risk.volatility(rets) > 0);
near('risk.beta(self,self)=1', M.risk.beta(rets, rets), 1, 0.01);
ok('risk.maxDrawdown <= 0', M.risk.maxDrawdown(closes) <= 0);
eq('risk.positionSize(10000,0.01,100,95)', M.risk.positionSize(10000, 0.01, 100, 95), 20);

/* ── score: determinism, ranking, confidence, disclaimer ── */
const good = { pe: 10, pb: 1.5, evEbitda: 7, roe: 0.25, netMargin: 0.2, debtEquity: 0.3, chgPct: 3, chg1m: 12, divYield: 0.03, mcap: 5e11, vol: 1e7, floatPct: 0.4, technical: 80 };
const bad = { pe: 38, pb: 7, evEbitda: 19, roe: 0.02, netMargin: 0.01, debtEquity: 1.8, chgPct: -4, chg1m: -15, divYield: 0, mcap: 2e9, vol: 2e5, floatPct: 0.03, technical: 20 };
const sGood = M.score.stock(good, { preset: 'balanced' });
const sBad = M.score.stock(bad, { preset: 'balanced' });
ok('score.stock good > bad', sGood.score > sBad.score, `good ${sGood.score} vs bad ${sBad.score}`);
ok('score.stock good is high', sGood.score >= 70);
ok('score.stock bad is low', sBad.score <= 35);
const sGood2 = M.score.stock(good, { preset: 'balanced' });
eq('score.stock deterministic', sGood.score, sGood2.score);
ok('score.stock full confidence', sGood.confidence === 1);
ok('score.verdict set', typeof sGood.verdict === 'string' && sGood.verdict.length > 0);
ok('score.factors.value present', typeof sGood.factors.value === 'number');

const partial = M.score.stock({ chgPct: 2, technical: 60 }, { preset: 'balanced' });
ok('score.stock partial confidence < 1', partial.confidence < 1 && partial.confidence > 0);
ok('score.stock partial still scores', typeof partial.score === 'number');

const ranked = M.score.rank([bad, good], { preset: 'balanced' });
eq('score.rank top is good', ranked[0].pe, good.pe);
eq('score.rank #1 rank', ranked[0].rank, 1);
eq('score.rank #2 rank', ranked[1].rank, 2);

// preset differences: momentum preset should favor the high-momentum stock's momentum weight
const valuePreset = M.score.stock(good, { preset: 'value' });
const momoPreset = M.score.stock(good, { preset: 'momentum' });
ok('score presets differ', valuePreset.score !== momoPreset.score || valuePreset.confidence !== momoPreset.confidence);

/* ── alphas (Factor Zoo) — deterministic formulaic factors over the candle fixture ── */
{
    const az = M.alphas.compute(candles);
    ok('alphas.compute composite 0..100', az.composite >= 0 && az.composite <= 100);
    ok('alphas.compute counts votes', (az.votes.bull + az.votes.bear + az.votes.neutral) >= 1);
    const h52 = M.alphas.high_52w(candles);
    ok('alphas.high_52w score 0..100', h52 && h52.score >= 0 && h52.score <= 100);
    ok('alphas.high_52w value 0..1', h52 && h52.value > 0 && h52.value <= 1.001);
    const mom = M.alphas.momentum_12_1(candles);
    ok('alphas.momentum_12_1 present (>=252 bars)', mom != null);
    ok('alphas.momentum vote valid', mom && ['bull', 'bear', 'neutral'].indexOf(mom.vote) >= 0);
    ok('alphas.low_vol score 0..100', (M.alphas.low_vol(candles) || {}).score >= 0);
    eq('alphas insufficient bars → null', M.alphas.momentum_12_1(candles.slice(0, 10)), null);
}

/* ── committee (deterministic Investment Committee) ── */
{
    const cstock = { pe: 12, pb: 2, roe: 0.2, netMargin: 0.15, debtEquity: 0.4, divYield: 0.02, mcap: 5e11, vol: 5e6, floatPct: 0.4 };
    const c1 = M.committee.run(cstock, candles, { preset: 'balanced', market: 'us' });
    const c2 = M.committee.run(cstock, candles, { preset: 'balanced', market: 'us' });
    ok('committee score 0..100', c1.score >= 0 && c1.score <= 100);
    eq('committee deterministic', c1.score, c2.score);
    ok('committee has 4 panels', c1.panels.length === 4);
    eq('committee panels order', c1.panels.map(p => p.name).join(','), 'Fundamental,Technical,Quant,Risk');
    ok('committee every panel has score+signals', c1.panels.every(p => typeof p.score === 'number' && Array.isArray(p.signals)));
    ok('committee verdict set', typeof c1.verdict === 'string' && c1.verdict.length > 0);
    ok('committee confidence in (0,1]', c1.confidence > 0 && c1.confidence <= 1);
    ok('committee has bull or bear case', c1.bullCase.length > 0 || c1.bearCase.length > 0);
    ok('committee carries disclaimer', c1.disclaimer === E.DISCLAIMER);
    const cNo = M.committee.run(cstock, [], { preset: 'balanced', market: 'us' });
    ok('committee no-candles → fundamental only, confidence<1', cNo.panels.length === 1 && cNo.confidence < 1);
    ok('committee alpha provenance sourced', !!D.sources['alphas.momentum_12_1'] && !!D.sources['committee']);
}

/* ── format ── */
eq('format.ticker strips .JK', E.format.ticker('BBCA.JK'), 'BBCA');
eq('format.marketOf .JK', E.format.marketOf('BBCA.JK'), 'ID');
eq('format.marketOf US', E.format.marketOf('AAPL'), 'US');
ok('format.currency IDR uses Rp', E.format.currency(16300, 'IDR').indexOf('Rp') === 0);
ok('format.abbrev T/B/M', E.format.abbrev(2.5e12) === '2.50T' && E.format.abbrev(3e9) === '3.00B');

/* ============================================================
 * 2. PARITY — FINEngine.technical.analyze === ta.js analyze
 * ============================================================ */
{
    const ta = await import(resolve(__dirname, '..', 'cf-worker', 'src', 'ta.js'));
    const refs = ta.analyze(candles);
    const mine = M.technical.analyze(candles);
    eq('parity price', mine.price, refs.price);
    eq('parity rsi14', mine.indicators.rsi14, refs.indicators.rsi14);
    eq('parity sma20', mine.indicators.sma20, refs.indicators.sma20);
    eq('parity sma50', mine.indicators.sma50, refs.indicators.sma50);
    eq('parity sma200', mine.indicators.sma200, refs.indicators.sma200);
    eq('parity ema20', mine.indicators.ema20, refs.indicators.ema20);
    eq('parity atr14', mine.indicators.atr14, refs.indicators.atr14);
    eq('parity macd.macd', mine.indicators.macd.macd, refs.indicators.macd.macd);
    eq('parity macd.signal', mine.indicators.macd.signal, refs.indicators.macd.signal);
    eq('parity macd.hist', mine.indicators.macd.hist, refs.indicators.macd.hist);
    eq('parity bollinger.upper', mine.indicators.bollinger.upper, refs.indicators.bollinger.upper);
    eq('parity bollinger.lower', mine.indicators.bollinger.lower, refs.indicators.bollinger.lower);
    eq('parity stoch.k', mine.indicators.stoch.k, refs.indicators.stoch.k);
    eq('parity gauge.score', mine.gauge.score, refs.gauge.score);
    eq('parity gauge.label', mine.gauge.label, refs.gauge.label);
    eq('parity signals.trend', mine.signals.trend, refs.signals.trend);
}

/* ============================================================
 * 3. DATA INVARIANTS
 * ============================================================ */
ok('markets US+ID present', !!(D.markets.US && D.markets.ID));
Object.keys(D.markets).forEach(m => {
    const mk = D.markets[m];
    ok('market ' + m + ' currency resolvable', !!D.currency[mk.currency]);
    ok('market ' + m + ' has index+riskFree', !!mk.index && typeof mk.riskFree === 'number');
});
ok('universes US non-empty', D.universes.US.length > 0);
ok('universes ID non-empty', D.universes.ID.length >= 20);
D.universes.ID.forEach(u => ok('ID ticker .JK ' + u.sym, /\.JK$/.test(u.sym) && !!u.sector));
D.universes.US.forEach(u => ok('US ticker sector ' + u.sym, !!u.sector));
// factor weights sane (each preset sums ~1, all factors known)
const FACTORS = ['value', 'quality', 'momentum', 'dividend', 'liquidity', 'float', 'technical'];
Object.keys(D.factorWeights).forEach(p => {
    const w = D.factorWeights[p];
    const sum = Object.keys(w).reduce((a, k) => a + w[k], 0);
    near('factorWeights ' + p + ' sums to 1', sum, 1, 0.001);
    Object.keys(w).forEach(k => ok('factorWeights ' + p + ' known factor ' + k, FACTORS.indexOf(k) !== -1));
});
// sourced IDX fundamentals — valid ranges + free-float lights up the float factor
ok('idxFundamentals present', !!D.idxFundamentals && Object.keys(D.idxFundamentals).length >= 15);
Object.keys(D.idxFundamentals).forEach(sym => {
    const f = D.idxFundamentals[sym];
    ok('idxFund ' + sym + ' .JK', /\.JK$/.test(sym));
    if (f.freeFloat != null) ok('idxFund ' + sym + ' freeFloat 0..1', f.freeFloat > 0 && f.freeFloat <= 1);
    if (f.pe != null) ok('idxFund ' + sym + ' pe>0', f.pe > 0);
    ok('idxFund ' + sym + ' has asOf', !!f.asOf);
});
// idxEnrich fills floatPct so the Float factor scores for an IDX stock
{
    const enr = E.idxEnrich('BBCA.JK', { chgPct: 1, vol: 5e6 });
    ok('idxEnrich fills floatPct', enr.floatPct === D.idxFundamentals['BBCA.JK'].freeFloat);
    const scoredID = M.score.stock(enr, { preset: 'idxBluechip', market: 'id' });
    ok('IDX float factor scores (not null)', scoredID.factors.float != null);
    eq('idxEnrich no-op for US', E.idxEnrich('AAPL', { pe: 10 }).floatPct, undefined);
    ok('idxEnrich does not overwrite provided value', E.idxEnrich('BBCA.JK', { floatPct: 0.9 }).floatPct === 0.9);
}
// every scoreBand referenced by a factor exists
['pe', 'pb', 'evEbitda', 'roe', 'netMargin', 'debtEquity', 'chgPct', 'divYield', 'mcap', 'vol', 'floatPct'].forEach(b =>
    ok('scoreBand ' + b + ' present', !!D.scoreBands[b]));

/* ============================================================
 * 4. PROVENANCE — every sources entry has source + asOf
 * ============================================================ */
ok('DATA.meta present', !!D.meta && !!D.meta.schemaVersion);
Object.keys(D.sources).forEach(k => {
    const s = D.sources[k];
    ok('source[' + k + '] has source', !!s.source);
    ok('source[' + k + '] has asOf', !!s.asOf);
});
ok('DATA.provenance non-empty', Array.isArray(D.provenance) && D.provenance.length > 0);

/* ============================================================
 * 5. DISCLAIMER present on scored + technical outputs
 * ============================================================ */
ok('score.stock carries disclaimer', sGood.disclaimer === E.DISCLAIMER && /not investment advice/i.test(sGood.disclaimer));
ok('score.rationale ends with disclaimer', sGood.rationale[sGood.rationale.length - 1] === E.DISCLAIMER);
ok('technical rationale has not-advice caveat', /not investment advice/i.test(an.prediction.rationale[an.prediction.rationale.length - 1]));

/* ── report ── */
console.log(`\nFIN ENGINE GATE — ${pass} passed, ${fail} failed`);
if (fail) { console.log('\nFAILURES:'); fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('ALL GREEN — engine math, ta.js parity, invariants, provenance, disclaimers.');
