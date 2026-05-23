/**
 * Composite buy/sell gauge — pure math, no I/O.
 *
 * Given a set of TA indicators (output of lib/ta.js — last-bar values
 * already extracted) plus the current price, derives:
 *   1. Qualitative SIGNAL labels (trend / momentum / volatility / ma_cross).
 *   2. A composite 0..100 GAUGE score with one of 7 canonical labels.
 *   3. A short, plain-English RATIONALE (≤5 entries, honesty caveat last).
 *
 * Component weights for the gauge (sum to 1.0):
 *   trend     35%   — bullish/bearish/neutral price-vs-MA stack
 *   momentum  25%   — MACD histogram + RSI position
 *   ma_cross  20%   — sma50 vs sma200 (golden/death/none)
 *   rsi       15%   — RSI overbought/oversold via piecewise curve
 *   volatility 5%   — Bollinger bandwidth direction
 *
 * NOTE: This is a DERIVED signal — never call it a forecast. The rationale
 * MUST contain an honesty caveat as the final entry.
 */

/* ───────────────────────── signal label rules ───────────────────────── */

/**
 * computeSignals(indicators, price) → { trend, momentum, volatility, ma_cross }.
 *
 *   trend     'bullish'  if price > sma20 && sma20 > sma50 && sma50 > sma200
 *             'bearish'  if price < sma20 && sma20 < sma50 && sma50 < sma200
 *             'neutral'  otherwise
 *
 *   momentum  'overbought' if rsi14 > 70
 *             'oversold'   if rsi14 < 30
 *             'neutral'    otherwise
 *
 *   volatility 'expanding'   if bandwidth > 0.15
 *              'contracting' if bandwidth < 0.05
 *              'stable'      otherwise
 *
 *   ma_cross  'golden'  if sma50 > sma200 by ≥0.5% (bullish cross zone)
 *             'death'   if sma50 < sma200 by ≥0.5% (bearish cross zone)
 *             'none'    otherwise
 *
 * Inputs missing or non-finite are treated as neutral.
 */
export function computeSignals(indicators, price) {
  const ind = indicators || {};
  const p = num(price);

  // Trend (MA stack).
  let trend = 'neutral';
  const s20 = num(ind.sma20), s50 = num(ind.sma50), s200 = num(ind.sma200);
  if (finite(p) && finite(s20) && finite(s50) && finite(s200)) {
    if (p > s20 && s20 > s50 && s50 > s200) trend = 'bullish';
    else if (p < s20 && s20 < s50 && s50 < s200) trend = 'bearish';
  }

  // Momentum (RSI band).
  let momentum = 'neutral';
  const rsi = num(ind.rsi14);
  if (finite(rsi)) {
    if (rsi > 70) momentum = 'overbought';
    else if (rsi < 30) momentum = 'oversold';
  }

  // Volatility (Bollinger bandwidth).
  let volatility = 'stable';
  const bw = num(ind.bollinger && ind.bollinger.bandwidth);
  if (finite(bw)) {
    if (bw > 0.15) volatility = 'expanding';
    else if (bw < 0.05) volatility = 'contracting';
  }

  // MA cross (sma50 vs sma200, with a 0.5% deadband to suppress noise).
  let ma_cross = 'none';
  if (finite(s50) && finite(s200) && s200 !== 0) {
    const diffPct = (s50 - s200) / s200;
    if (diffPct >= 0.005) ma_cross = 'golden';
    else if (diffPct <= -0.005) ma_cross = 'death';
  }

  return { trend, momentum, volatility, ma_cross };
}

/* ─────────────────────────── component scoring ──────────────────────── */

/**
 * Score curves — each returns 0..100 (higher == more bullish).
 *
 * scoreFromTrend:
 *   bullish → 80, neutral → 50, bearish → 20.
 *
 * scoreFromMaCross:
 *   golden → 85, none → 50, death → 15.
 *
 * scoreFromMomentum (uses MACD histogram + RSI direction):
 *   histogram > 0 AND rising-vs-prior → bullish 65..80
 *   histogram < 0 AND falling-vs-prior → bearish 20..35
 *   else neutral 40..60
 *   We only have last-bar values; lacking history, use sign of histogram
 *   and magnitude vs ATR.
 *
 * scoreFromRsi (piecewise):
 *   <20  → 95  (deeply oversold = bullish reversion signal)
 *   20-30 → linear 95 → 75
 *   30-50 → linear 75 → 50
 *   50-70 → linear 50 → 75 (NOT 0 — strong uptrend zone is mildly bullish)
 *   70-80 → linear 75 → 30 (overbought = reversion risk)
 *   >80   → 15 (deeply overbought = bearish reversion signal)
 *
 * scoreFromVolatility:
 *   expanding → 60  (trends in motion — slightly bullish bias)
 *   stable    → 50
 *   contracting → 45 (range-bound = mildly bearish)
 */
function scoreFromTrend(trend) {
  if (trend === 'bullish') return 80;
  if (trend === 'bearish') return 20;
  return 50;
}

function scoreFromMaCross(ma_cross) {
  if (ma_cross === 'golden') return 85;
  if (ma_cross === 'death') return 15;
  return 50;
}

function scoreFromMomentum(indicators) {
  const m = indicators && indicators.macd;
  if (!m) return 50;
  const h = num(m.histogram);
  if (!finite(h)) return 50;
  // Magnitude scaled by ATR (or |macd| if ATR missing) to bound the response.
  const atr = num(indicators.atr14);
  const scale = finite(atr) && atr > 0 ? atr : Math.max(Math.abs(num(m.macd) || 1), 0.001);
  const norm = Math.max(-1, Math.min(1, h / scale));
  // norm in [-1,1] → score in [20,80] with 50 at norm=0.
  return 50 + norm * 30;
}

function scoreFromRsi(rsi) {
  const r = num(rsi);
  if (!finite(r)) return 50;
  if (r <= 20) return 95;
  if (r <= 30) return 95 - ((r - 20) / 10) * 20; // 95 → 75
  if (r <= 50) return 75 - ((r - 30) / 20) * 25; // 75 → 50
  if (r <= 70) return 50 + ((r - 50) / 20) * 25; // 50 → 75
  if (r <= 80) return 75 - ((r - 70) / 10) * 45; // 75 → 30
  return 15;
}

function scoreFromVolatility(volatility) {
  if (volatility === 'expanding') return 60;
  if (volatility === 'contracting') return 45;
  return 50;
}

/* ─────────────────────────── gauge composition ──────────────────────── */

const WEIGHTS = {
  trend: 0.35,
  momentum: 0.25,
  macross: 0.20,
  rsi: 0.15,
  volatility: 0.05,
};

const LABEL_BANDS = [
  { min: 0,  max: 15,  label: 'Strong Sell' },
  { min: 15, max: 30,  label: 'Sell' },
  { min: 30, max: 45,  label: 'Bearish' },
  { min: 45, max: 55,  label: 'Neutral' },
  { min: 55, max: 70,  label: 'Bullish' },
  { min: 70, max: 85,  label: 'Buy' },
  { min: 85, max: 101, label: 'Strong Buy' },
];

function labelForScore(score) {
  for (const b of LABEL_BANDS) {
    if (score >= b.min && score < b.max) return b.label;
  }
  return 'Neutral';
}

/**
 * computeGauge(signals, indicators) → { score, label, components }.
 *
 *   components = { trend, momentum, volatility, macross, rsi } each 0..100.
 *   score      = weighted sum, clamped 0..100, rounded to integer.
 *   label      = canonical 7-band label.
 */
export function computeGauge(signals, indicators) {
  const sig = signals || {};
  const ind = indicators || {};

  const components = {
    trend: scoreFromTrend(sig.trend),
    momentum: scoreFromMomentum(ind),
    volatility: scoreFromVolatility(sig.volatility),
    macross: scoreFromMaCross(sig.ma_cross),
    rsi: scoreFromRsi(ind.rsi14),
  };

  let weighted =
    components.trend * WEIGHTS.trend +
    components.momentum * WEIGHTS.momentum +
    components.volatility * WEIGHTS.volatility +
    components.macross * WEIGHTS.macross +
    components.rsi * WEIGHTS.rsi;

  weighted = Math.max(0, Math.min(100, weighted));
  const score = Math.round(weighted);

  return { score, label: labelForScore(score), components };
}

/* ────────────────────────────── rationale ───────────────────────────── */

/**
 * buildRationale(signals, indicators, price) → string[] (1..5 entries).
 *
 * Each entry is plain English. Ordering: strongest signal first. The
 * FINAL entry is ALWAYS an honesty caveat (project no-fabrication
 * discipline) — never claimed as a guaranteed forecast.
 */
export function buildRationale(signals, indicators, price) {
  const sig = signals || {};
  const ind = indicators || {};
  const out = [];

  // Trend.
  if (sig.trend === 'bullish') {
    out.push('Price above SMA20, SMA50, and SMA200 — established uptrend.');
  } else if (sig.trend === 'bearish') {
    out.push('Price below SMA20, SMA50, and SMA200 — established downtrend.');
  } else {
    out.push('Mixed moving-average stack — no clean trend on this timeframe.');
  }

  // MACD / momentum.
  const m = ind.macd || {};
  const hist = num(m.histogram);
  if (finite(hist)) {
    if (hist > 0) {
      out.push('MACD histogram positive (' + hist.toFixed(2) + ') — short-term momentum on the buy side.');
    } else if (hist < 0) {
      out.push('MACD histogram negative (' + hist.toFixed(2) + ') — short-term momentum on the sell side.');
    } else {
      out.push('MACD histogram near zero — momentum indecisive.');
    }
  }

  // RSI / overbought/oversold.
  const rsi = num(ind.rsi14);
  if (finite(rsi)) {
    if (sig.momentum === 'overbought') {
      out.push('RSI ' + rsi.toFixed(0) + ' is overbought (>70) — reversion risk elevated.');
    } else if (sig.momentum === 'oversold') {
      out.push('RSI ' + rsi.toFixed(0) + ' is oversold (<30) — bounce setup possible.');
    } else {
      out.push('RSI ' + rsi.toFixed(0) + ' is mid-range — neither overbought nor oversold.');
    }
  }

  // Volatility (only if expanding/contracting — drop the dull 'stable' line).
  if (sig.volatility === 'expanding') {
    out.push('Bollinger bandwidth expanding — volatility regime widening.');
  } else if (sig.volatility === 'contracting') {
    out.push('Bollinger bandwidth contracting — coiled range, breakout watch.');
  }

  // Trim to 4 substantive lines so the caveat (5th) always fits the ≤5 cap.
  const substantive = out.slice(0, 4);
  substantive.push(
    'Informational only — derived from TA primitives, not a forecast. Past performance is no guarantee of future results.'
  );
  // price unused by intent — reserved for richer per-bar context later.
  void price;
  return substantive;
}

/* ───────────────────────────── helpers ──────────────────────────────── */

function num(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function finite(n) {
  return typeof n === 'number' && Number.isFinite(n);
}
