import { getCached, setCached } from './cache.js';
import { fetchFx } from './sources/fx.js';
import { fetchYahooQuotes, fetchYahooCandles } from './sources/yahoo.js';
import { fetchStooqQuotes, fetchStooqCandles } from './sources/stooq.js';
import { fetchFinnhubQuotes } from './sources/finnhub.js';
import { fetchNews } from './sources/news.js';
import { fetchCoinGeckoMarkets, fetchCoinGeckoGlobal } from './sources/coingecko.js';
import { SCREENER_UNIVERSE } from './data/screener-universe.js';

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

/* ═══════════════════════════════════════════════════════════════
   Task 1.7 — /crypto (fixes B-005)

   CoinGecko markets + global proxied through the Worker so the
   crypto tab is cached + quota-safe (CoinGecko free tier is rate
   limited). User-visible behaviour is identical — the client renders
   the same markup from data.coins / data.global. 2-min TTL (crypto
   moves fast but free CoinGecko quota must be conserved).
   ═══════════════════════════════════════════════════════════════ */

const CRYPTO_CACHE_KEY = 'crypto';
const CRYPTO_TTL_MS = 120_000; // 2 min

/**
 * handleCrypto(env) — CoinGecko markets + global with KV cache +
 * stale-on-error fallback.
 *
 * Returns: { data: { coins: [...], global: {...} }, cached, stale? }
 *   - Fresh cache hit  : { data, cached: true }
 *   - Live fetch       : { data, cached: false }
 *   - All fail + stale : { data, cached: true, stale: true }
 *   - All fail + none  : throws
 *
 * coins   — CoinGecko /coins/markets array, passed through as-is.
 * global  — CoinGecko /global inner `data` object (has
 *           market_cap_percentage — the Market Dominance source).
 */
export async function handleCrypto(env) {
  const fresh = await getCached(env.FT_KV, CRYPTO_CACHE_KEY, CRYPTO_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }

  try {
    const [coins, global] = await Promise.all([
      fetchCoinGeckoMarkets(),
      fetchCoinGeckoGlobal(),
    ]);
    const data = { coins, global };
    await setCached(env.FT_KV, CRYPTO_CACHE_KEY, data);
    return { data, cached: false };
  } catch (fetchErr) {
    const stale = await getCached(env.FT_KV, CRYPTO_CACHE_KEY, CRYPTO_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw fetchErr;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Task 1.5 — /sectors /economy /futures (fixes B-009/B-010/B-011)

   These are ETF-proxy quote aggregations. They delegate INTERNALLY
   to handleQuotes (and handleFx for /economy) — no new fetch logic.
   A thin top-level cache wrapper holds the SHAPED result so a fully
   failed live fetch can still serve a stale shaped payload.
   ═══════════════════════════════════════════════════════════════ */

const AGG_TTL_MS = 60_000;

// 11 SPDR sector ETFs — sym → display name.
const SECTOR_NAMES = {
  XLK: 'Technology',
  XLV: 'Health Care',
  XLF: 'Financials',
  XLY: 'Consumer Disc.',
  XLI: 'Industrials',
  XLC: 'Comm. Services',
  XLP: 'Consumer Staples',
  XLE: 'Energy',
  XLB: 'Materials',
  XLRE: 'Real Estate',
  XLU: 'Utilities',
};
const SECTOR_SYMS = Object.keys(SECTOR_NAMES);

// Treasury ETF proxies (yield curve) — sym → label.
const YIELD_NAMES = {
  SHY: '1-3 Year Treasury',
  IEI: '3-7 Year Treasury',
  IEF: '7-10 Year Treasury',
  TLT: '20+ Year Treasury',
  TIP: 'TIPS (Inflation)',
};
const YIELD_SYMS = Object.keys(YIELD_NAMES);

// Currencies to surface for /economy (USD base, via handleFx).
const ECON_CURRENCIES = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'];

// Futures ETF proxies — sym → display name.
const FUTURES_NAMES = {
  SPY: 'S&P 500 (ES)',
  QQQ: 'Nasdaq 100 (NQ)',
  DIA: 'Dow Jones (YM)',
  IWM: 'Russell 2000 (RTY)',
  GLD: 'Gold (GC)',
  SLV: 'Silver (SI)',
  USO: 'Crude Oil (CL)',
  UNG: 'Natural Gas (NG)',
  DBA: 'Agriculture (DBA)',
};
const FUTURES_SYMS = Object.keys(FUTURES_NAMES);

/**
 * shapeRows(quotes, nameMap) — { sym, name, price, chg, chgPct } per symbol,
 * dropping any symbol the quote layer could not resolve.
 */
function shapeRows(quotes, nameMap) {
  const bySym = new Map((quotes || []).map(q => [q.sym, q]));
  const out = [];
  for (const sym of Object.keys(nameMap)) {
    const q = bySym.get(sym);
    if (!q) continue;
    out.push({
      sym,
      name: nameMap[sym],
      price: q.price,
      chg: q.chg,
      chgPct: q.chgPct,
    });
  }
  return out;
}

/**
 * aggViaCache(env, cacheKey, builder)
 *   Fresh shaped cache → cached:true. Else build (delegating to
 *   handleQuotes/handleFx), cache the shaped result, return cached:false.
 *   On any builder failure, serve a stale shaped payload if present.
 */
async function aggViaCache(env, cacheKey, builder) {
  const fresh = await getCached(env.FT_KV, cacheKey, AGG_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }
  try {
    const data = await builder();
    await setCached(env.FT_KV, cacheKey, data);
    return { data, cached: false };
  } catch (err) {
    const stale = await getCached(env.FT_KV, cacheKey, AGG_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw err;
  }
}

/**
 * handleSectors(env) — 11 SPDR sector-ETF rows.
 * Returns: { data: [{sym,name,price,chg,chgPct}], cached, stale? }
 */
export async function handleSectors(env) {
  return aggViaCache(env, 'sectors', async () => {
    const { data } = await handleQuotes(env, SECTOR_SYMS);
    return shapeRows(data, SECTOR_NAMES);
  });
}

/**
 * handleEconomy(env) — treasury ETF proxies + USD currency pairs.
 * Returns: { data: { yields:[{sym,name,price,chg,chgPct}],
 *                     currencies:[{pair,rate,inverse}] }, cached, stale? }
 */
export async function handleEconomy(env) {
  return aggViaCache(env, 'economy', async () => {
    const [{ data: quotes }, { data: fx }] = await Promise.all([
      handleQuotes(env, YIELD_SYMS),
      handleFx(env),
    ]);
    const yields = shapeRows(quotes, YIELD_NAMES);
    const rates = (fx && fx.rates) || {};
    const currencies = ECON_CURRENCIES
      .filter(c => typeof rates[c] === 'number')
      .map(c => ({ pair: 'USD/' + c, rate: rates[c], inverse: 1 / rates[c] }));
    return { yields, currencies };
  });
}

/**
 * handleFutures(env) — 9 futures-proxy ETF rows.
 * Returns: { data: [{sym,name,price,chg,chgPct}], cached, stale? }
 */
export async function handleFutures(env) {
  return aggViaCache(env, 'futures', async () => {
    const { data } = await handleQuotes(env, FUTURES_SYMS);
    return shapeRows(data, FUTURES_NAMES);
  });
}

/* ═══════════════════════════════════════════════════════════════
   Task 1.6 — /screener (fixes B-007)

   Key-free curated static fundamentals universe (SCREENER_UNIVERSE)
   filtered by preset + explicit criteria, then enriched with LIVE
   price/chg via handleQuotes (no new fetch code). Final shaped result
   is cached 5 min with stale-on-error (live prices must not go 24h
   stale). Deep per-row reasoning is Phase 2 — out of scope here.
   ═══════════════════════════════════════════════════════════════ */

const SCREENER_TTL_MS = 300_000; // 5 min
const SCREENER_MAX_ROWS = 40;    // cap before live enrichment

/**
 * Sector alias map — the client dropdown sends Yahoo-style sector
 * names; the curated universe uses GICS/SPDR-style names. Normalise
 * both sides to a lowercase canonical token so a Sector filter works
 * regardless of which vocabulary the caller used.
 */
const SECTOR_ALIASES = {
  'technology': 'technology',
  'health care': 'healthcare',
  'healthcare': 'healthcare',
  'financials': 'financials',
  'financial services': 'financials',
  'consumer discretionary': 'consumer discretionary',
  'consumer cyclical': 'consumer discretionary',
  'industrials': 'industrials',
  'communication services': 'communication services',
  'consumer staples': 'consumer staples',
  'consumer defensive': 'consumer staples',
  'energy': 'energy',
  'materials': 'materials',
  'basic materials': 'materials',
  'real estate': 'real estate',
  'utilities': 'utilities',
};

function canonSector(s) {
  const k = String(s || '').trim().toLowerCase();
  return SECTOR_ALIASES[k] || k;
}

/**
 * Preset semantics. Mirrors CFG.PRESETS in the client plus the four
 * extended presets the enhanced screener UI exposes. A preset returns
 * a predicate over a universe row PLUS an optional `needsLive` flag
 * (Big Movers filters on enriched chgPct, applied post-enrichment).
 */
const SCREENER_PRESETS = {
  'Large Cap':       { test: r => r.marketCap >= 10e9 },
  'Mega Cap':        { test: r => r.marketCap >= 200e9 },
  'Value (P/E<15)':  { test: r => r.pe != null && r.pe <= 15 && r.marketCap >= 2e9 },
  'Small Cap':       { test: r => r.marketCap >= 300e6 && r.marketCap <= 20e9 },
  'High Volume':     { test: r => r.avgVol >= 5e6 },
  'High Dividend':   { test: r => r.divYield >= 3 },
  'Growth':          { test: r => r.pe != null && r.pe >= 25 && r.marketCap >= 10e9 },
  'Tech Giants':     { test: r => canonSector(r.sector) === 'technology' && r.marketCap >= 200e9 },
  'Big Movers':      { test: () => true, needsLive: true },
};

/**
 * stableScreenerKey(params) — order-independent cache key.
 * Same filter set → same key regardless of property order / blanks.
 */
function stableScreenerKey(params) {
  const norm = {
    preset: String(params.preset || ''),
    minMcap: Number(params.minMcap) || 0,
    maxPe: Number(params.maxPe) || 0,
    sector: canonSector(params.sector || ''),
    minDiv: Number(params.minDiv) || 0,
    dayChange: String(params.dayChange || ''),
  };
  return 'screener:' + Object.keys(norm).sort().map(k => k + '=' + norm[k]).join('&');
}

/**
 * handleScreener(env, params) — curated-universe stock screener.
 *
 * params: { preset?, minMcap?, maxPe?, sector?, minDiv?, dayChange? }
 *
 * 1. Start from SCREENER_UNIVERSE (static, key-free).
 * 2. Apply preset semantics (if any).
 * 3. Intersect with explicit filters (minMcap / maxPe / sector / minDiv).
 * 4. Cap to SCREENER_MAX_ROWS, enrich with live price/chg via handleQuotes.
 * 5. Apply Big Movers / dayChange filter on the LIVE chgPct.
 *
 * Returns: { data: Row[], cached, stale? }
 *   Row = { sym, name, sector, marketCap, pe, divYield, price, chgPct }
 */
export async function handleScreener(env, params = {}) {
  const cacheKey = stableScreenerKey(params);

  const fresh = await getCached(env.FT_KV, cacheKey, SCREENER_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }

  try {
    const data = await buildScreener(env, params);
    await setCached(env.FT_KV, cacheKey, data);
    return { data, cached: false };
  } catch (err) {
    const stale = await getCached(env.FT_KV, cacheKey, SCREENER_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw err;
  }
}

async function buildScreener(env, params) {
  const minMcap = Number(params.minMcap) || 0;
  const maxPe = Number(params.maxPe) || 0;
  const sector = canonSector(params.sector || '');
  const minDiv = Number(params.minDiv) || 0;
  const dayChange = String(params.dayChange || '');

  const preset = params.preset ? SCREENER_PRESETS[params.preset] : null;
  const presetTest = preset ? preset.test : null;
  const needsLive = (preset && preset.needsLive) || dayChange === 'big' ||
    dayChange === 'up' || dayChange === 'down';

  // Static-fundamentals pass (preset ∩ explicit filters).
  const filtered = SCREENER_UNIVERSE.filter(r => {
    if (presetTest && !presetTest(r)) return false;
    if (minMcap && r.marketCap < minMcap) return false;
    if (maxPe) {
      if (r.pe == null || r.pe > maxPe) return false;
    }
    if (sector && canonSector(r.sector) !== sector) return false;
    if (minDiv && r.divYield < minDiv) return false;
    return true;
  });

  // Largest first, cap before live enrichment.
  const capped = filtered
    .slice()
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, SCREENER_MAX_ROWS);

  if (capped.length === 0) return [];

  // Live enrichment via the existing quote layer (NO new fetch code).
  let quoteBySym = new Map();
  try {
    const { data: quotes } = await handleQuotes(env, capped.map(r => r.sym));
    quoteBySym = new Map((quotes || []).map(q => [q.sym, q]));
  } catch (e) {
    // If enrichment hard-fails, surface so the cache/stale path can run.
    throw new Error('quote enrichment failed: ' + (e.message || String(e)));
  }

  let rows = capped.map(r => {
    const q = quoteBySym.get(r.sym);
    return {
      sym: r.sym,
      name: r.name,
      sector: r.sector,
      marketCap: r.marketCap,
      pe: r.pe,
      divYield: r.divYield,
      price: q ? q.price : null,
      chgPct: q ? q.chgPct : null,
    };
  });

  // Live-change filters (Big Movers / explicit dayChange) post-enrichment.
  if (needsLive) {
    rows = rows.filter(r => {
      if (r.chgPct == null) return false;
      if (params.preset === 'Big Movers' || dayChange === 'big') {
        return Math.abs(r.chgPct) >= 3;
      }
      if (dayChange === 'up') return r.chgPct > 0;
      if (dayChange === 'down') return r.chgPct < 0;
      return true;
    });
  }

  return rows;
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
