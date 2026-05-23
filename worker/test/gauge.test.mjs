import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSignals, computeGauge, buildRationale } from '../src/lib/gauge.js';

/* ═══════════════════════════════════════════════════════════════
   G-1 — computeSignals detects bullish vs bearish MA stack.
   ═══════════════════════════════════════════════════════════════ */
test('G-1: bullish MA stack (price > sma20 > sma50 > sma200) → trend bullish, ma_cross golden', () => {
  const indicators = {
    rsi14: 55,
    macd: { macd: 0.5, signal: 0.2, histogram: 0.3 },
    sma20: 102, sma50: 100, sma200: 95,
    ema20: 102, ema50: 100,
    bollinger: { upper: 110, middle: 102, lower: 94, bandwidth: 0.16 },
    atr14: 2,
    stoch: { k: 60, d: 55 },
  };
  const sig = computeSignals(indicators, 105);
  assert.equal(sig.trend, 'bullish');
  assert.equal(sig.ma_cross, 'golden');
  // Momentum: RSI 55, Stoch 60 → neutral (not extreme).
  assert.equal(sig.momentum, 'neutral');
});

test('G-1b: bearish MA stack (price < sma20 < sma50 < sma200) → trend bearish, ma_cross death', () => {
  const indicators = {
    rsi14: 40,
    macd: { macd: -0.4, signal: -0.1, histogram: -0.3 },
    sma20: 98, sma50: 100, sma200: 105,
    ema20: 98, ema50: 100,
    bollinger: { upper: 108, middle: 98, lower: 88, bandwidth: 0.20 },
    atr14: 2,
    stoch: { k: 40, d: 45 },
  };
  const sig = computeSignals(indicators, 95);
  assert.equal(sig.trend, 'bearish');
  assert.equal(sig.ma_cross, 'death');
});

test('G-1c: RSI > 70 → momentum overbought; < 30 → oversold', () => {
  const base = {
    macd: { macd: 0, signal: 0, histogram: 0 },
    sma20: 100, sma50: 100, sma200: 100,
    ema20: 100, ema50: 100,
    bollinger: { upper: 105, middle: 100, lower: 95, bandwidth: 0.1 },
    atr14: 1,
    stoch: { k: 50, d: 50 },
  };
  assert.equal(computeSignals({ ...base, rsi14: 75 }, 100).momentum, 'overbought');
  assert.equal(computeSignals({ ...base, rsi14: 25 }, 100).momentum, 'oversold');
  assert.equal(computeSignals({ ...base, rsi14: 50 }, 100).momentum, 'neutral');
});

/* ═══════════════════════════════════════════════════════════════
   G-2 — gauge.score in [0,100]; strong-buy > strong-sell monotonically.
   ═══════════════════════════════════════════════════════════════ */
test('G-2: gauge.score strong-buy > strong-sell monotonically', () => {
  const strongBuySig = {
    trend: 'bullish',
    momentum: 'neutral',
    volatility: 'expanding',
    ma_cross: 'golden',
  };
  const strongBuyInd = {
    rsi14: 60,
    macd: { macd: 1, signal: 0.5, histogram: 0.5 },
    sma20: 110, sma50: 105, sma200: 100,
    ema20: 110, ema50: 105,
    bollinger: { upper: 120, middle: 110, lower: 100, bandwidth: 0.18 },
    atr14: 3,
    stoch: { k: 60, d: 55 },
  };
  const strongSellSig = {
    trend: 'bearish',
    momentum: 'neutral',
    volatility: 'contracting',
    ma_cross: 'death',
  };
  const strongSellInd = {
    rsi14: 40,
    macd: { macd: -1, signal: -0.5, histogram: -0.5 },
    sma20: 90, sma50: 95, sma200: 100,
    ema20: 90, ema50: 95,
    bollinger: { upper: 100, middle: 90, lower: 80, bandwidth: 0.22 },
    atr14: 3,
    stoch: { k: 40, d: 45 },
  };
  const buy = computeGauge(strongBuySig, strongBuyInd);
  const sell = computeGauge(strongSellSig, strongSellInd);

  assert.ok(buy.score >= 0 && buy.score <= 100, 'buy score in [0,100], got ' + buy.score);
  assert.ok(sell.score >= 0 && sell.score <= 100, 'sell score in [0,100], got ' + sell.score);
  assert.ok(buy.score > sell.score, 'strong-buy score must exceed strong-sell score, got buy=' + buy.score + ' sell=' + sell.score);
  assert.ok(buy.score >= 60, 'strong-buy must read bullish (≥60), got ' + buy.score);
  assert.ok(sell.score <= 40, 'strong-sell must read bearish (≤40), got ' + sell.score);
});

test('G-2b: gauge.components is an object with all 5 numeric components in [0,100]', () => {
  const sig = {
    trend: 'neutral', momentum: 'neutral', volatility: 'stable', ma_cross: 'none',
  };
  const ind = {
    rsi14: 50,
    macd: { macd: 0, signal: 0, histogram: 0 },
    sma20: 100, sma50: 100, sma200: 100,
    ema20: 100, ema50: 100,
    bollinger: { upper: 105, middle: 100, lower: 95, bandwidth: 0.1 },
    atr14: 1,
    stoch: { k: 50, d: 50 },
  };
  const g = computeGauge(sig, ind);
  assert.equal(typeof g.components, 'object');
  for (const key of ['trend', 'momentum', 'volatility', 'macross', 'rsi']) {
    assert.equal(typeof g.components[key], 'number', 'component ' + key + ' should be number');
    assert.ok(g.components[key] >= 0 && g.components[key] <= 100, key + ' should be in [0,100], got ' + g.components[key]);
  }
});

test('G-2c: gauge.label is one of the 7 canonical labels', () => {
  const sig = { trend: 'neutral', momentum: 'neutral', volatility: 'stable', ma_cross: 'none' };
  const ind = {
    rsi14: 50,
    macd: { macd: 0, signal: 0, histogram: 0 },
    sma20: 100, sma50: 100, sma200: 100,
    ema20: 100, ema50: 100,
    bollinger: { upper: 105, middle: 100, lower: 95, bandwidth: 0.1 },
    atr14: 1,
    stoch: { k: 50, d: 50 },
  };
  const labels = ['Strong Sell', 'Sell', 'Bearish', 'Neutral', 'Bullish', 'Buy', 'Strong Buy'];
  const g = computeGauge(sig, ind);
  assert.ok(labels.includes(g.label), 'label should be canonical, got ' + g.label);
});

/* ═══════════════════════════════════════════════════════════════
   G-3 — rationale: max 5 entries; last line contains "no guarantee"
   or "informational" (honesty caveat).
   ═══════════════════════════════════════════════════════════════ */
test('G-3: rationale length ≤ 5 and last entry contains a caveat phrase', () => {
  const sig = {
    trend: 'bullish', momentum: 'overbought', volatility: 'expanding', ma_cross: 'golden',
  };
  const ind = {
    rsi14: 75,
    macd: { macd: 0.5, signal: 0.2, histogram: 0.3 },
    sma20: 110, sma50: 105, sma200: 100,
    ema20: 110, ema50: 105,
    bollinger: { upper: 120, middle: 110, lower: 100, bandwidth: 0.18 },
    atr14: 3,
    stoch: { k: 80, d: 75 },
  };
  const rationale = buildRationale(sig, ind, 115);
  assert.ok(Array.isArray(rationale), 'rationale should be array');
  assert.ok(rationale.length >= 1 && rationale.length <= 5, 'rationale 1..5 entries, got ' + rationale.length);
  const last = rationale[rationale.length - 1].toLowerCase();
  assert.ok(
    last.includes('no guarantee') || last.includes('informational') || last.includes('past performance'),
    'last rationale entry should include a caveat phrase, got: ' + rationale[rationale.length - 1]
  );
});

test('G-3b: rationale entries are non-empty strings', () => {
  const sig = { trend: 'neutral', momentum: 'neutral', volatility: 'stable', ma_cross: 'none' };
  const ind = {
    rsi14: 50,
    macd: { macd: 0, signal: 0, histogram: 0 },
    sma20: 100, sma50: 100, sma200: 100,
    ema20: 100, ema50: 100,
    bollinger: { upper: 105, middle: 100, lower: 95, bandwidth: 0.1 },
    atr14: 1,
    stoch: { k: 50, d: 50 },
  };
  const rationale = buildRationale(sig, ind, 100);
  for (const r of rationale) {
    assert.equal(typeof r, 'string');
    assert.ok(r.length > 0, 'rationale entry must be non-empty');
  }
});
