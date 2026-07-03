// Server-side technical analysis. Pure functions over a candle array
// [{t,o,h,l,c,v}] → the indicator/signal/gauge/prediction shape the client's
// analytics panel (renderAnalyticsPanel) expects. Computed once, cached in KV.
// This is the R-002/R-003/R-004 "analysis + buy/sell gauge" depth, done safely
// server-side instead of a client that can't reach the data.

function sma(vals, p) {
  if (!vals || vals.length < p) return null;
  let s = 0;
  for (let i = vals.length - p; i < vals.length; i++) s += vals[i];
  return s / p;
}

function emaSeries(vals, p) {
  if (!vals || vals.length < p) return null;
  const k = 2 / (p + 1);
  let e = vals.slice(0, p).reduce((a, b) => a + b, 0) / p;
  const out = new Array(p - 1).fill(null);
  out.push(e);
  for (let i = p; i < vals.length; i++) {
    e = vals[i] * k + e * (1 - k);
    out.push(e);
  }
  return out;
}

function ema(vals, p) {
  const s = emaSeries(vals, p);
  return s ? s[s.length - 1] : null;
}

function rsi(closes, p = 14) {
  if (!closes || closes.length < p + 1) return null;
  let gain = 0, loss = 0;
  for (let i = closes.length - p; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  const avgG = gain / p, avgL = loss / p;
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

function macd(closes) {
  if (!closes || closes.length < 26) return null;
  const e12 = emaSeries(closes, 12), e26 = emaSeries(closes, 26);
  if (!e12 || !e26) return null;
  const line = [];
  for (let i = 0; i < closes.length; i++) {
    if (e12[i] == null || e26[i] == null) { line.push(null); continue; }
    line.push(e12[i] - e26[i]);
  }
  const clean = line.filter((v) => v != null);
  const sig = emaSeries(clean, 9);
  const macdVal = line[line.length - 1];
  const sigVal = sig ? sig[sig.length - 1] : null;
  return { macd: macdVal, signal: sigVal, hist: sigVal != null ? macdVal - sigVal : null };
}

function bollinger(closes, p = 20, mult = 2) {
  if (!closes || closes.length < p) return null;
  const slice = closes.slice(-p);
  const mean = slice.reduce((a, b) => a + b, 0) / p;
  const variance = slice.reduce((a, b) => a + (b - mean) * (b - mean), 0) / p;
  const sd = Math.sqrt(variance);
  return { mid: mean, upper: mean + mult * sd, lower: mean - mult * sd };
}

function stochastic(highs, lows, closes, p = 14) {
  if (!closes || closes.length < p) return null;
  const hi = Math.max(...highs.slice(-p));
  const lo = Math.min(...lows.slice(-p));
  const c = closes[closes.length - 1];
  if (hi === lo) return { k: 50 };
  return { k: ((c - lo) / (hi - lo)) * 100 };
}

function atr(highs, lows, closes, p = 14) {
  if (!closes || closes.length < p + 1) return null;
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  return sma(trs, p);
}

const r2 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);

// Build the full analytics payload from candles.
export function analyze(candles) {
  const rows = (candles || []).filter((k) => k && isFinite(k.c));
  const closes = rows.map((k) => k.c);
  const highs = rows.map((k) => (isFinite(k.h) ? k.h : k.c));
  const lows = rows.map((k) => (isFinite(k.l) ? k.l : k.c));
  const price = closes[closes.length - 1];

  const rsi14 = rsi(closes);
  const sma20 = sma(closes, 20), sma50 = sma(closes, 50), sma200 = sma(closes, 200);
  const ema20 = ema(closes, 20);
  const mac = macd(closes);
  const boll = bollinger(closes);
  const stoch = stochastic(highs, lows, closes);
  const atr14 = atr(highs, lows, closes);

  const indicators = {
    rsi14: r2(rsi14), sma20: r2(sma20), sma50: r2(sma50), sma200: r2(sma200),
    ema20: r2(ema20), atr14: r2(atr14),
    macd: { macd: r2(mac && mac.macd), signal: r2(mac && mac.signal), hist: r2(mac && mac.hist) },
    bollinger: { upper: r2(boll && boll.upper), lower: r2(boll && boll.lower), mid: r2(boll && boll.mid) },
    stoch: { k: r2(stoch && stoch.k) },
  };

  // ── Signals (rule-based, human-readable labels) ──
  const trend =
    sma50 != null && sma200 != null
      ? price > sma50 && sma50 > sma200 ? "Bullish"
        : price < sma50 && sma50 < sma200 ? "Bearish" : "Neutral"
      : price != null && sma20 != null ? (price > sma20 ? "Bullish" : "Bearish") : "Neutral";
  const momentum =
    rsi14 == null ? "Neutral"
      : rsi14 >= 70 ? "Overbought" : rsi14 <= 30 ? "Oversold"
        : rsi14 >= 55 ? "Rising" : rsi14 <= 45 ? "Falling" : "Neutral";
  const atrPct = atr14 != null && price ? (atr14 / price) * 100 : null;
  const volatility =
    atrPct == null ? "Normal" : atrPct >= 3 ? "High" : atrPct <= 1 ? "Low" : "Normal";
  const ma_cross =
    sma20 != null && sma50 != null
      ? sma20 > sma50 ? "Golden (bullish)" : sma20 < sma50 ? "Death (bearish)" : "Flat"
      : "—";
  const signals = { trend, momentum, volatility, ma_cross };

  // ── Composite 0–100 gauge ──
  let score = 50, weights = 0;
  if (rsi14 != null) { score += (rsi14 - 50) * 0.6; weights++; }         // momentum
  if (price != null && sma50 != null) { score += price > sma50 ? 10 : -10; weights++; } // trend
  if (sma20 != null && sma50 != null) { score += sma20 > sma50 ? 8 : -8; weights++; }    // ma cross
  if (mac && mac.hist != null) { score += mac.hist > 0 ? 7 : -7; weights++; }            // macd
  if (stoch && stoch.k != null) { score += (stoch.k - 50) * 0.12; weights++; }           // stoch
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label =
    score >= 75 ? "Strong Buy" : score >= 60 ? "Buy" : score >= 40 ? "Neutral"
      : score >= 25 ? "Sell" : "Strong Sell";
  const gauge = { score, label };

  // ── Rationale (last item is an explicit caveat) ──
  const rationale = [];
  if (trend !== "Neutral") rationale.push(`Trend is ${trend.toLowerCase()} — price ${price > (sma50 || price) ? "above" : "below"} the 50-period average.`);
  if (rsi14 != null) rationale.push(`RSI(14) at ${r2(rsi14)} indicates ${momentum.toLowerCase()} momentum.`);
  if (ma_cross !== "—" && ma_cross !== "Flat") rationale.push(`20/50 moving-average cross is ${ma_cross}.`);
  if (mac && mac.hist != null) rationale.push(`MACD histogram is ${mac.hist > 0 ? "positive" : "negative"} (${r2(mac.hist)}).`);
  if (atrPct != null) rationale.push(`Volatility ${volatility.toLowerCase()} — ATR ≈ ${r2(atrPct)}% of price.`);
  rationale.push("Rule-based technical read for education only — not investment advice; combine with fundamentals and risk limits.");

  return { price: r2(price), indicators, signals, gauge, prediction: { rationale } };
}
