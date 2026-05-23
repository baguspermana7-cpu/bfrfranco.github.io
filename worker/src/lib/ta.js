/**
 * Technical Analysis (TA) primitives — pure-math.
 *
 * Phase 2 Task A. No I/O, no fetch, no crypto.subtle — just numbers in,
 * numbers out. Every function is deterministic and side-effect free so
 * it can be unit-tested with hand-computed reference values.
 *
 * Convention: every series-returning function returns an array of the
 * SAME LENGTH as the input series, NaN-padded at the start until the
 * indicator window is satisfied. This lets callers index aligned to the
 * source candles without offset arithmetic.
 *
 * Inputs are read as numbers; non-finite cells are treated as missing.
 * No mutation of inputs.
 */

function toNum(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function isFinite_(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * sma(values, period) — simple moving average.
 * Returns array (same length as values) with NaN at indices < period-1.
 */
export function sma(values, period) {
  if (!Array.isArray(values) || values.length === 0) return [];
  if (!Number.isInteger(period) || period <= 0) return values.map(() => NaN);

  const out = new Array(values.length);
  let sum = 0;
  let count = 0; // count of finite values currently in window

  for (let i = 0; i < values.length; i++) {
    const v = toNum(values[i]);
    if (isFinite_(v)) {
      sum += v;
      count++;
    }
    if (i >= period) {
      const drop = toNum(values[i - period]);
      if (isFinite_(drop)) {
        sum -= drop;
        count--;
      }
    }
    // Need full window of finite values to emit.
    if (i >= period - 1 && count === period) {
      out[i] = sum / period;
    } else {
      out[i] = NaN;
    }
  }
  return out;
}

/**
 * ema(values, period) — exponential moving average.
 * Seeded at index (period-1) with SMA of first `period` values. From
 * then on:  ema[i] = (close[i] - ema[i-1]) * k + ema[i-1],  k = 2/(p+1).
 */
export function ema(values, period) {
  if (!Array.isArray(values) || values.length === 0) return [];
  if (!Number.isInteger(period) || period <= 0) return values.map(() => NaN);

  const out = new Array(values.length).fill(NaN);
  if (values.length < period) return out;

  // Seed: SMA of first `period` values.
  let sum = 0;
  for (let i = 0; i < period; i++) sum += toNum(values[i]);
  const seed = sum / period;
  if (!isFinite_(seed)) return out;
  out[period - 1] = seed;

  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    const v = toNum(values[i]);
    if (!isFinite_(v)) {
      // Carry forward previous EMA when missing data.
      out[i] = out[i - 1];
      continue;
    }
    out[i] = (v - out[i - 1]) * k + out[i - 1];
  }
  return out;
}

/**
 * rsi(closes, period=14) — Wilder's Relative Strength Index.
 *
 * Algorithm:
 *   1. Compute gains[i] = max(close[i]-close[i-1], 0); losses[i] = max(prev-close, 0).
 *   2. Seed avgGain/avgLoss at i=period as the SIMPLE average of the
 *      first `period` gains/losses (Wilder's seed).
 *   3. From i=period+1 onwards, use Wilder smoothing:
 *      avgGain[i] = (avgGain[i-1]*(period-1) + gains[i]) / period.
 *   4. rsi[i] = 100 - 100/(1+RS), RS = avgGain/avgLoss.
 *
 * Edge cases: avgLoss==0 → RSI=100; avgGain==0 → RSI=0.
 */
export function rsi(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length === 0) return [];
  const n = closes.length;
  const out = new Array(n).fill(NaN);
  if (n <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;

  // Seed window: indices 1..period.
  for (let i = 1; i <= period; i++) {
    const diff = toNum(closes[i]) - toNum(closes[i - 1]);
    if (diff >= 0) avgGain += diff;
    else avgLoss += -diff;
  }
  avgGain /= period;
  avgLoss /= period;

  out[period] = rsiFromAvgs(avgGain, avgLoss);

  for (let i = period + 1; i < n; i++) {
    const diff = toNum(closes[i]) - toNum(closes[i - 1]);
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFromAvgs(avgGain, avgLoss);
  }
  return out;
}

function rsiFromAvgs(avgGain, avgLoss) {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  if (avgGain === 0) return 0;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * macd(closes, fast=12, slow=26, signal=9) → { macdLine, signalLine, histogram }.
 *   macdLine[i]    = ema(closes, fast)[i] - ema(closes, slow)[i]
 *   signalLine[i]  = ema(macdLine, signal)[i]
 *   histogram[i]   = macdLine[i] - signalLine[i]
 *
 * NaN propagates wherever the underlying EMA windows are not yet defined.
 */
export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const n = Array.isArray(closes) ? closes.length : 0;
  const empty = { macdLine: new Array(n).fill(NaN), signalLine: new Array(n).fill(NaN), histogram: new Array(n).fill(NaN) };
  if (n === 0) return { macdLine: [], signalLine: [], histogram: [] };

  const efast = ema(closes, fast);
  const eslow = ema(closes, slow);

  const macdLine = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (isFinite_(efast[i]) && isFinite_(eslow[i])) {
      macdLine[i] = efast[i] - eslow[i];
    }
  }

  // signal EMA needs to be computed only over the defined region of macdLine.
  // Find first index where macdLine is finite, then run EMA from there.
  let startIdx = -1;
  for (let i = 0; i < n; i++) { if (isFinite_(macdLine[i])) { startIdx = i; break; } }
  const signalLine = new Array(n).fill(NaN);
  if (startIdx >= 0) {
    const sub = macdLine.slice(startIdx);
    const emaSub = ema(sub, signal);
    for (let i = 0; i < emaSub.length; i++) {
      signalLine[startIdx + i] = emaSub[i];
    }
  }

  const histogram = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (isFinite_(macdLine[i]) && isFinite_(signalLine[i])) {
      histogram[i] = macdLine[i] - signalLine[i];
    }
  }

  return { macdLine, signalLine, histogram };
  // empty unused — silences unused-var linters that may run later.
  // eslint-disable-next-line no-unused-vars
  void empty;
}

/**
 * bollinger(closes, period=20, k=2) → { upper, middle, lower }.
 *   middle = sma(closes, period)
 *   sigma  = sqrt(mean((x - mean)^2)) over window (population stddev)
 *   upper  = middle + k*sigma
 *   lower  = middle - k*sigma
 */
export function bollinger(closes, period = 20, k = 2) {
  if (!Array.isArray(closes) || closes.length === 0) {
    return { upper: [], middle: [], lower: [] };
  }
  const n = closes.length;
  const middle = sma(closes, period);
  const upper = new Array(n).fill(NaN);
  const lower = new Array(n).fill(NaN);

  for (let i = period - 1; i < n; i++) {
    if (!isFinite_(middle[i])) continue;
    let sumSq = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = toNum(closes[j]);
      if (!isFinite_(v)) continue;
      sumSq += (v - middle[i]) ** 2;
      count++;
    }
    if (count !== period) continue;
    const sigma = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + k * sigma;
    lower[i] = middle[i] - k * sigma;
  }
  return { upper, middle, lower };
}

/**
 * atr(highs, lows, closes, period=14) — Wilder's smoothed Average True Range.
 *
 * True range at i: max( h[i]-l[i], |h[i]-c[i-1]|, |l[i]-c[i-1]| ).
 * Seed at i=period with SIMPLE mean of TR[1..period]. Then Wilder smooth:
 *   atr[i] = (atr[i-1]*(period-1) + tr[i]) / period.
 */
export function atr(highs, lows, closes, period = 14) {
  if (!Array.isArray(highs) || highs.length === 0) return [];
  const n = highs.length;
  const out = new Array(n).fill(NaN);
  if (n <= period) return out;

  // True range series, index-aligned. TR[0] is undefined (needs prev close).
  const tr = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    const h = toNum(highs[i]);
    const l = toNum(lows[i]);
    const pc = toNum(closes[i - 1]);
    if (!isFinite_(h) || !isFinite_(l) || !isFinite_(pc)) continue;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }

  // Seed at i=period (mean of TR[1..period]).
  let sum = 0;
  for (let i = 1; i <= period; i++) {
    if (!isFinite_(tr[i])) return out; // incomplete data — stay NaN.
    sum += tr[i];
  }
  out[period] = sum / period;

  for (let i = period + 1; i < n; i++) {
    if (!isFinite_(tr[i])) {
      out[i] = out[i - 1];
      continue;
    }
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

/**
 * stoch(highs, lows, closes, kPeriod=14, dSmooth=3) → { k, d }.
 *   %K[i] = (close[i] - lowestLow_kPeriod) / (highestHigh_kPeriod - lowestLow_kPeriod) * 100
 *   %D[i] = sma(%K, dSmooth)
 * When the range collapses to 0, %K = 50 (neutral) to avoid div-by-zero.
 */
export function stoch(highs, lows, closes, kPeriod = 14, dSmooth = 3) {
  if (!Array.isArray(highs) || highs.length === 0) return { k: [], d: [] };
  const n = highs.length;
  const k = new Array(n).fill(NaN);

  for (let i = kPeriod - 1; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    let ok = true;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      const h = toNum(highs[j]);
      const l = toNum(lows[j]);
      if (!isFinite_(h) || !isFinite_(l)) { ok = false; break; }
      if (h > hh) hh = h;
      if (l < ll) ll = l;
    }
    if (!ok) continue;
    const c = toNum(closes[i]);
    if (!isFinite_(c)) continue;
    const range = hh - ll;
    k[i] = range === 0 ? 50 : ((c - ll) / range) * 100;
  }

  const d = sma(k, dSmooth);
  return { k, d };
}
