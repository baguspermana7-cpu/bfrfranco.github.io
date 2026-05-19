import { getCached, setCached } from './cache.js';
import { fetchFx } from './sources/fx.js';
import { fetchYahooQuotes, fetchYahooCandles } from './sources/yahoo.js';
import { fetchStooqQuotes, fetchStooqCandles } from './sources/stooq.js';
import { fetchFinnhubQuotes } from './sources/finnhub.js';
import { fetchNews } from './sources/news.js';

const FX_CACHE_KEY = 'fx:USD';
const FX_TTL_MS = 60_000;

const QUOTES_TTL_MS = 60_000;

const CANDLES_TTL_MS = 600_000; // 10 min

const NEWS_TTL_MS = 600_000; // 10 min

/**
 * Timeframe → { yahooRange, rows } map.
 *   yahooRange — Yahoo v8 chart `range` token.
 *   rows       — approx. trading-day count to keep from Stooq daily history.
 */
const TF_MAP = {
  '1W': { yahooRange: '5d',  rows: 7 },
  '1M': { yahooRange: '1mo', rows: 23 },
  '3M': { yahooRange: '3mo', rows: 65 },
  '6M': { yahooRange: '6mo', rows: 130 },
  '1Y': { yahooRange: '1y',  rows: 260 },
};

/**
 * handleFx(env) — fetch USD FX rates with KV cache + stale-on-error fallback.
 *
 * Returns: { data, cached: boolean, stale?: boolean }
 *   - Fresh cache hit: { data, cached: true }
 *   - Live fetch success: { data, cached: false }
 *   - All sources fail + stale entry: { data, cached: true, stale: true }
 *   - All sources fail + no stale: throws
 */
/**
 * handleQuotes(env, syms) — batch quote fetch with KV cache + stale-on-error.
 *
 * syms: string[] of uppercase symbols (e.g. ['SPY','QQQ']).
 *
 * Source fallback order (whole-batch):
 *   1. Yahoo Finance v7 (free, no key)
 *   2. Stooq CSV per-symbol (free, no key) — for any sym Yahoo missed
 *   3. Finnhub per-symbol (requires env.FINNHUB_KEY) — for any remaining syms
 *
 * Returns: { data: QuoteItem[], cached: boolean, stale?: boolean }
 *   - Fresh cache hit : { data, cached: true }
 *   - Live fetch      : { data, cached: false }
 *   - All fail+stale  : { data, cached: true, stale: true }
 *   - All fail+no stale: throws
 */
export async function handleQuotes(env, syms) {
  if (!Array.isArray(syms) || syms.length === 0) {
    throw new Error('handleQuotes: syms must be a non-empty array');
  }

  const cacheKey = 'q:' + syms.join(',');

  // Check fresh cache first
  const fresh = await getCached(env.FT_KV, cacheKey, QUOTES_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }

  // Fetch from live sources with fallback chain
  try {
    const data = await fetchQuotesWithFallback(env, syms);
    await setCached(env.FT_KV, cacheKey, data);
    return { data, cached: false };
  } catch (fetchErr) {
    // All sources failed — try stale cache as last resort
    const stale = await getCached(env.FT_KV, cacheKey, QUOTES_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw fetchErr;
  }
}

/**
 * fetchQuotesWithFallback(env, syms)
 *   Tries Yahoo for all symbols; falls through to Stooq and Finnhub for any
 *   that didn't resolve. Returns whatever resolved (partial is OK).
 *   Throws only if zero symbols resolved from any source.
 */
async function fetchQuotesWithFallback(env, syms) {
  const resolved = new Map(); // sym → QuoteItem
  const errors = [];

  // Source 1: Yahoo (batch)
  try {
    const yahooResults = await fetchYahooQuotes(syms);
    for (const q of yahooResults) resolved.set(q.sym, q);
  } catch (e) {
    errors.push('yahoo: ' + (e.message || String(e)));
  }

  // Determine which symbols still need resolution
  const missing = syms.filter(s => !resolved.has(s));

  // Source 2: Stooq (per-symbol, for missing)
  if (missing.length > 0) {
    try {
      const stooqResults = await fetchStooqQuotes(missing);
      for (const q of stooqResults) resolved.set(q.sym, q);
    } catch (e) {
      errors.push('stooq: ' + (e.message || String(e)));
    }
  }

  // Source 3: Finnhub (per-symbol, only if key present, for still-missing)
  const stillMissing = syms.filter(s => !resolved.has(s));
  if (stillMissing.length > 0 && env.FINNHUB_KEY) {
    try {
      const finnhubResults = await fetchFinnhubQuotes(stillMissing, env.FINNHUB_KEY);
      for (const q of finnhubResults) resolved.set(q.sym, q);
    } catch (e) {
      errors.push('finnhub: ' + (e.message || String(e)));
    }
  }

  if (resolved.size === 0) {
    throw new Error('all quote sources failed: ' + errors.join(' | '));
  }

  // Return in original symbol order, skipping unresolved
  return syms.map(s => resolved.get(s)).filter(Boolean);
}

/**
 * handleCandles(env, sym, tf) — OHLCV history with KV cache + stale-on-error.
 *
 * sym: uppercase symbol (e.g. 'GLD'). tf ∈ {1W,1M,3M,6M,1Y} (default 3M).
 *
 * Source fallback order:
 *   1. Yahoo v8 chart  (free, no key — but 429s from datacenter IPs)
 *   2. Stooq daily CSV (free, no key — reliable from datacenter IPs)
 *
 * Returns: { data: { sym, tf, candles:[{t,o,h,l,c,v}] }, cached, stale? }
 *   - Fresh cache hit  : { data, cached: true }
 *   - Live fetch       : { data, cached: false }
 *   - All fail + stale : { data, cached: true, stale: true }
 *   - All fail + none  : throws
 *
 * candles[].t is UNIX SECONDS, arrays are time-ascending, invalid rows dropped
 * (lightweight-charts expects seconds, ascending).
 */
export async function handleCandles(env, sym, tf) {
  const symbol = String(sym || '').trim().toUpperCase();
  if (!symbol) throw new Error('handleCandles: sym is required');

  const timeframe = TF_MAP[tf] ? tf : '3M';
  const { yahooRange, rows } = TF_MAP[timeframe];
  const cacheKey = 'candle:' + symbol + ':' + timeframe;

  // Fresh cache first
  const fresh = await getCached(env.FT_KV, cacheKey, CANDLES_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }

  // Live sources with fallback
  try {
    const candles = await fetchCandlesWithFallback(symbol, yahooRange, rows);
    const data = { sym: symbol, tf: timeframe, candles };
    await setCached(env.FT_KV, cacheKey, data);
    return { data, cached: false };
  } catch (fetchErr) {
    const stale = await getCached(env.FT_KV, cacheKey, CANDLES_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw fetchErr;
  }
}

/**
 * fetchCandlesWithFallback(symbol, yahooRange, rows)
 *   Yahoo first (expected to 429 from Cloudflare egress), then Stooq daily
 *   CSV (the authoritative key-free path). Throws only if both fail.
 */
async function fetchCandlesWithFallback(symbol, yahooRange, rows) {
  const errors = [];

  try {
    return await fetchYahooCandles(symbol, yahooRange);
  } catch (e) {
    errors.push('yahoo: ' + (e.message || String(e)));
  }

  try {
    return await fetchStooqCandles(symbol, rows);
  } catch (e) {
    errors.push('stooq: ' + (e.message || String(e)));
  }

  throw new Error('all candle sources failed: ' + errors.join(' | '));
}

/**
 * handleNews(env, topic) — market news with KV cache + stale-on-error.
 *
 * topic: free-text query (e.g. 'market'). Defaults to 'market'.
 *
 * Source fallback order (in news.js):
 *   1. GDELT doc/doc   (free, no key — reliable from datacenter IPs)
 *   2. Yahoo RSS       (free, no key — XML regex-parsed)
 *   3. Finnhub general (only if env.FINNHUB_KEY)
 *
 * Returns: { data: NewsItem[], cached, stale? }
 *   NewsItem = { title, url, src, ts (epoch ms), summary } — newest first
 *   - Fresh cache hit  : { data, cached: true }
 *   - Live fetch       : { data, cached: false }
 *   - All fail + stale : { data, cached: true, stale: true }
 *   - All fail + none  : throws
 */
export async function handleNews(env, topic) {
  const t = String(topic || '').trim() || 'market';
  const cacheKey = 'news:' + t;

  // Fresh cache first
  const fresh = await getCached(env.FT_KV, cacheKey, NEWS_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }

  // Live sources with fallback
  try {
    const data = await fetchNews(t, env);
    await setCached(env.FT_KV, cacheKey, data);
    return { data, cached: false };
  } catch (fetchErr) {
    const stale = await getCached(env.FT_KV, cacheKey, NEWS_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw fetchErr;
  }
}

export async function handleFx(env) {
  // Check fresh cache first
  const fresh = await getCached(env.FT_KV, FX_CACHE_KEY, FX_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }

  // Fetch from live sources
  try {
    const data = await fetchFx();
    await setCached(env.FT_KV, FX_CACHE_KEY, data);
    return { data, cached: false };
  } catch (fetchErr) {
    // All sources failed — try stale cache as last resort
    const stale = await getCached(env.FT_KV, FX_CACHE_KEY, FX_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw fetchErr;
  }
}
