import { getCached, setCached } from './cache.js';
import { fetchFx } from './sources/fx.js';
import { fetchYahooQuotes } from './sources/yahoo.js';
import { fetchStooqQuotes } from './sources/stooq.js';
import { fetchFinnhubQuotes } from './sources/finnhub.js';

const FX_CACHE_KEY = 'fx:USD';
const FX_TTL_MS = 60_000;

const QUOTES_TTL_MS = 60_000;

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
