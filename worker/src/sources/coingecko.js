/**
 * CoinGecko crypto source (free public API, no key).
 *
 * markets: https://api.coingecko.com/api/v3/coins/markets
 *   ?vs_currency=usd&order=market_cap_desc&per_page=100&page=1
 *   &price_change_percentage=1h,24h,7d&sparkline=true
 *   → array of coin objects (id, symbol, name, image, current_price,
 *     market_cap, market_cap_rank, total_volume, sparkline_in_7d,
 *     price_change_percentage_{1h,24h,7d}_in_currency, …)
 *
 * global: https://api.coingecko.com/api/v3/global
 *   → { data: { total_market_cap, total_volume,
 *               market_cap_percentage:{ btc, eth, … }, … } }
 *
 * Both arrays/objects are returned AS-IS so the client renders the
 * existing markup unchanged (B-005 is fixed client-side from
 * global.market_cap_percentage).
 */

import { fetchJSON } from './_util.js';

const TIMEOUT_MS = 8000;

// CoinGecko returns HTTP 403 to requests with NO User-Agent header.
// The Cloudflare Workers runtime omits UA by default unless set, so
// we send an explicit identifying UA (any non-empty value works;
// this also stays within free-tier ToS as a normal identified call).
const CG_HEADERS = { 'User-Agent': 'rz-finance-gateway', Accept: 'application/json' };

const MARKETS_URL =
  'https://api.coingecko.com/api/v3/coins/markets' +
  '?vs_currency=usd&order=market_cap_desc&per_page=100&page=1' +
  '&price_change_percentage=1h,24h,7d&sparkline=true';

const GLOBAL_URL = 'https://api.coingecko.com/api/v3/global';

/**
 * fetchCoinGeckoMarkets()
 *   Top-100 coins by market cap with 1h/24h/7d % + 7d sparkline.
 *   Returns the markets array as-is. Throws on HTTP/parse failure.
 */
export async function fetchCoinGeckoMarkets() {
  const j = await fetchJSON(MARKETS_URL, TIMEOUT_MS, CG_HEADERS);
  if (!Array.isArray(j)) throw new Error('coingecko markets: not an array');
  return j;
}

/**
 * fetchCoinGeckoGlobal()
 *   Global crypto stats. CoinGecko nests payload under `data`; we
 *   surface that inner object (the client reads market_cap_percentage,
 *   total_market_cap, total_volume, etc. from it directly).
 *   Throws on HTTP/parse failure or missing payload.
 */
export async function fetchCoinGeckoGlobal() {
  const j = await fetchJSON(GLOBAL_URL, TIMEOUT_MS, CG_HEADERS);
  const g = j && j.data;
  if (!g || typeof g !== 'object') throw new Error('coingecko global: missing data');
  return g;
}
