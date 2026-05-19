/**
 * Yahoo Finance v7 batch quote source (free, no API key).
 *
 * Endpoint: https://query1.finance.yahoo.com/v7/finance/quote?symbols=SPY,QQQ,...
 * Response: { quoteResponse: { result: [...], error } }
 *
 * Returns: array of { sym, price, chg, chgPct, prevClose, name? } — all numeric
 */

import { fetchJSON } from './_util.js';

const TIMEOUT_MS = 7000;

/**
 * fetchYahooQuotes(syms)
 *   syms — string[] of uppercase symbols (e.g. ['SPY','QQQ'])
 *   Returns array of normalized quote objects for symbols that resolved.
 *   Throws if the fetch fails entirely.
 */
export async function fetchYahooQuotes(syms) {
  if (!syms || syms.length === 0) return [];

  const url =
    'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' +
    syms.map(encodeURIComponent).join(',') +
    '&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,shortName';

  const j = await fetchJSON(url, TIMEOUT_MS);

  const result = j?.quoteResponse?.result;
  if (!Array.isArray(result)) throw new Error('yahoo: unexpected response shape');

  return result
    .filter(q => q && typeof q.regularMarketPrice === 'number')
    .map(q => ({
      sym: String(q.symbol).toUpperCase(),
      price: q.regularMarketPrice,
      chg: typeof q.regularMarketChange === 'number' ? q.regularMarketChange : 0,
      chgPct: typeof q.regularMarketChangePercent === 'number' ? q.regularMarketChangePercent : 0,
      prevClose: typeof q.regularMarketPreviousClose === 'number' ? q.regularMarketPreviousClose : 0,
      ...(q.shortName ? { name: q.shortName } : {}),
    }));
}

/**
 * fetchYahooCandles(sym, range)
 *   sym   — uppercase symbol (e.g. 'GLD')
 *   range — Yahoo range token (e.g. '1mo','3mo','6mo','1y') — see RANGE_MAP below
 *
 *   Endpoint: https://query1.finance.yahoo.com/v8/finance/chart/<sym>?interval=1d&range=<range>
 *   Response: chart.result[0] = { timestamp:[...], indicators:{ quote:[{ open,high,low,close,volume }] } }
 *
 *   Returns an array of { t, o, h, l, c, v } where t is UNIX SECONDS, sorted
 *   time-ascending, with any row whose timestamp/close is non-finite dropped.
 *   Throws if the fetch fails (Yahoo 429s from datacenter IPs are expected —
 *   the handler falls through to Stooq).
 */
export async function fetchYahooCandles(sym, range) {
  if (!sym) throw new Error('yahoo: candles requires a symbol');

  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(sym) +
    '?interval=1d&range=' + encodeURIComponent(range || '3mo');

  const j = await fetchJSON(url, TIMEOUT_MS);

  const r = j?.chart?.result?.[0];
  const ts = r?.timestamp;
  const q = r?.indicators?.quote?.[0];
  if (!Array.isArray(ts) || !q) throw new Error('yahoo: unexpected chart shape');

  const o = q.open || [], h = q.high || [], l = q.low || [], c = q.close || [], v = q.volume || [];

  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    const t = Number(ts[i]);
    // Drop rows with no timestamp or no close (Yahoo emits nulls on holidays).
    // Guard against null/undefined explicitly — Number(null) === 0 is finite.
    if (!Number.isFinite(t) || ts[i] == null) continue;
    if (c[i] == null) continue;
    const close = Number(c[i]);
    if (!Number.isFinite(close)) continue;
    candles.push({
      t,
      o: Number.isFinite(Number(o[i])) ? Number(o[i]) : close,
      h: Number.isFinite(Number(h[i])) ? Number(h[i]) : close,
      l: Number.isFinite(Number(l[i])) ? Number(l[i]) : close,
      c: close,
      v: Number.isFinite(Number(v[i])) ? Number(v[i]) : 0,
    });
  }

  if (candles.length === 0) throw new Error('yahoo: no valid candles for ' + sym);
  candles.sort((a, b) => a.t - b.t);
  return candles;
}
