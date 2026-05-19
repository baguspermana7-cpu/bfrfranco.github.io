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
