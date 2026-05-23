import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sma, ema, rsi, macd, bollinger, atr, stoch } from '../src/lib/ta.js';

/* ═══════════════════════════════════════════════════════════════
   TA-1 — sma: trailing simple moving average, NaN-padded at start
   ═══════════════════════════════════════════════════════════════ */
test('TA-1: sma([1,2,3,4,5], 3) → [NaN,NaN,2,3,4]', () => {
  const out = sma([1, 2, 3, 4, 5], 3);
  assert.equal(out.length, 5);
  assert.ok(Number.isNaN(out[0]));
  assert.ok(Number.isNaN(out[1]));
  assert.equal(out[2], 2);
  assert.equal(out[3], 3);
  assert.equal(out[4], 4);
});

test('TA-1b: sma returns empty for empty input or non-array', () => {
  assert.deepEqual(sma([], 3), []);
  assert.deepEqual(sma(null, 3), []);
});

test('TA-1c: sma all-NaN when period > length', () => {
  const out = sma([1, 2], 5);
  assert.equal(out.length, 2);
  assert.ok(out.every((v) => Number.isNaN(v)));
});

/* ═══════════════════════════════════════════════════════════════
   TA-2 — ema: seeded with SMA of first `period` values, then
   recursive  ema[i] = (close[i] - ema[i-1]) * k + ema[i-1]
   where k = 2 / (period + 1).
   ═══════════════════════════════════════════════════════════════ */
test('TA-2: ema seeded with SMA, then standard recursion', () => {
  // Use period 3 on [1,2,3,4,5]; seed at i=2 → sma=2.
  // k = 2/4 = 0.5. ema[3] = (4-2)*0.5+2 = 3. ema[4] = (5-3)*0.5+3 = 4.
  const out = ema([1, 2, 3, 4, 5], 3);
  assert.equal(out.length, 5);
  assert.ok(Number.isNaN(out[0]));
  assert.ok(Number.isNaN(out[1]));
  assert.equal(out[2], 2);
  assert.equal(out[3], 3);
  assert.equal(out[4], 4);
});

test('TA-2b: ema empty input → empty array', () => {
  assert.deepEqual(ema([], 12), []);
});

/* ═══════════════════════════════════════════════════════════════
   TA-3 — rsi (Wilder's smoothing). Rising series → high RSI;
   falling series → low RSI; flat series → 50 (or NaN if no moves).
   ═══════════════════════════════════════════════════════════════ */
test('TA-3: rsi on strictly rising series → trends to 100', () => {
  // 20 monotonic up bars: RSI should saturate near 100 (no losses).
  const closes = [];
  for (let i = 0; i < 20; i++) closes.push(100 + i);
  const r = rsi(closes, 14);
  assert.equal(r.length, 20);
  const last = r[r.length - 1];
  assert.ok(last >= 99, 'rising series RSI should be ≥99, got ' + last);
});

test('TA-3b: rsi on strictly falling series → trends to 0', () => {
  const closes = [];
  for (let i = 0; i < 20; i++) closes.push(200 - i);
  const r = rsi(closes, 14);
  const last = r[r.length - 1];
  assert.ok(last <= 1, 'falling series RSI should be ≤1, got ' + last);
});

test('TA-3c: rsi NaN-padded for insufficient data', () => {
  const r = rsi([1, 2, 3], 14);
  assert.equal(r.length, 3);
  assert.ok(r.every((v) => Number.isNaN(v)));
});

/* ═══════════════════════════════════════════════════════════════
   TA-4 — macd: macdLine = ema(fast) - ema(slow); signalLine
   = ema(macdLine, signal); histogram = macdLine - signalLine.
   ═══════════════════════════════════════════════════════════════ */
test('TA-4: macd line == ema(fast) - ema(slow) elementwise', () => {
  // Build a deterministic series with enough length (~80 bars).
  const closes = [];
  for (let i = 0; i < 80; i++) closes.push(100 + Math.sin(i / 5) * 5 + i * 0.1);
  const m = macd(closes, 12, 26, 9);
  const ef = ema(closes, 12);
  const es = ema(closes, 26);

  assert.equal(m.macdLine.length, closes.length);
  assert.equal(m.signalLine.length, closes.length);
  assert.equal(m.histogram.length, closes.length);

  // Spot-check the last 10 indices (where everything is settled).
  for (let i = closes.length - 10; i < closes.length; i++) {
    const expected = ef[i] - es[i];
    assert.ok(Math.abs(m.macdLine[i] - expected) < 1e-9, 'macdLine[' + i + '] mismatch');
    assert.ok(Math.abs(m.histogram[i] - (m.macdLine[i] - m.signalLine[i])) < 1e-9, 'histogram[' + i + '] mismatch');
  }
});

/* ═══════════════════════════════════════════════════════════════
   TA-5 — bollinger: middle == sma(period); upper = middle + k*σ.
   ═══════════════════════════════════════════════════════════════ */
test('TA-5: bollinger middle == sma20; upper = middle + 2σ', () => {
  const closes = [];
  for (let i = 0; i < 30; i++) closes.push(100 + Math.cos(i / 3) * 4);
  const b = bollinger(closes, 20, 2);
  const m = sma(closes, 20);

  assert.equal(b.middle.length, closes.length);

  for (let i = 19; i < closes.length; i++) {
    assert.ok(Math.abs(b.middle[i] - m[i]) < 1e-9, 'middle[' + i + '] should equal sma20');
    // Stddev: sample window of 20 ending at i.
    const slice = closes.slice(i - 19, i + 1);
    const mean = slice.reduce((a, x) => a + x, 0) / slice.length;
    const variance = slice.reduce((a, x) => a + (x - mean) ** 2, 0) / slice.length;
    const sigma = Math.sqrt(variance);
    assert.ok(Math.abs(b.upper[i] - (mean + 2 * sigma)) < 1e-6, 'upper[' + i + '] off');
    assert.ok(Math.abs(b.lower[i] - (mean - 2 * sigma)) < 1e-6, 'lower[' + i + '] off');
  }
});

/* ═══════════════════════════════════════════════════════════════
   TA-6 — atr (Wilder smoothing of true range).
   ═══════════════════════════════════════════════════════════════ */
test('TA-6: atr on flat 1.0 ranges → settles at 1.0', () => {
  // Construct bars where TR == 1 every bar (h-l=1, no gap).
  const highs = [];
  const lows = [];
  const closes = [];
  for (let i = 0; i < 30; i++) {
    highs.push(101);
    lows.push(100);
    closes.push(100.5);
  }
  const a = atr(highs, lows, closes, 14);
  assert.equal(a.length, 30);
  // First 13 should be NaN (need 14 TRs).
  for (let i = 0; i < 13; i++) assert.ok(Number.isNaN(a[i]));
  // From i=14 onwards (Wilder seed at i=13), every value should be ≈1.
  for (let i = 14; i < 30; i++) {
    assert.ok(Math.abs(a[i] - 1) < 1e-9, 'atr[' + i + '] should be 1, got ' + a[i]);
  }
});

/* ═══════════════════════════════════════════════════════════════
   TA-7 — stoch: %K = (close - lowestLow) / (highestHigh - lowestLow) * 100
   over the last kPeriod bars; %D = sma(%K, dSmooth).
   ═══════════════════════════════════════════════════════════════ */
test('TA-7: stoch %K formula at known windows', () => {
  // 14 bars: lows go 100..113, highs go 110..123, closes mid-range.
  const highs = [];
  const lows = [];
  const closes = [];
  for (let i = 0; i < 14; i++) {
    highs.push(110 + i);
    lows.push(100 + i);
    closes.push(105 + i);
  }
  const s = stoch(highs, lows, closes, 14, 3);
  // At i=13 (last bar): lowestLow=100, highestHigh=123, close=118.
  // %K = (118-100)/(123-100) * 100 = 18/23 * 100 ≈ 78.2608...
  const expected = (118 - 100) / (123 - 100) * 100;
  assert.ok(Math.abs(s.k[13] - expected) < 1e-6, 'stoch %K mismatch at i=13');
});

test('TA-7b: stoch handles zero range gracefully (no NaN/Infinity)', () => {
  // Flat bars: highestHigh == lowestLow → div-by-zero guard.
  const highs = [100, 100, 100];
  const lows = [100, 100, 100];
  const closes = [100, 100, 100];
  const s = stoch(highs, lows, closes, 3, 2);
  // Convention: when range is 0, %K = 50 (neutral).
  assert.equal(s.k[2], 50);
});
