/**
 * Stooq per-symbol CSV fallback source (free, no API key).
 *
 * Endpoint: https://stooq.com/q/l/?s=<sym.lower>.us&f=sd2t2ohlcv&h&e=csv
 * CSV columns: Symbol,Date,Time,Open,High,Low,Close,Volume
 *
 * Limitation: Stooq provides OHLC for the current session but no prior-day
 * close in a single-row response. prevClose is therefore unavailable;
 * chg and chgPct are set to 0 when prior close is absent. Only price=close
 * is reliable. This is a known limitation of this source — use Yahoo first.
 *
 * Returns: array of { sym, price, chg, chgPct, prevClose } for each symbol
 *          that resolved.
 */

import { fetchText } from './_util.js';

const TIMEOUT_MS = 7000;

function parseCsv(text, sym) {
  const lines = text.trim().split('\n');
  // Skip header row; first data line is index 1
  const data = lines[1];
  if (!data) return null;

  const cols = data.split(',');
  // Expected: Symbol,Date,Time,Open,High,Low,Close,Volume
  const close = parseFloat(cols[6]);
  if (!isFinite(close) || close <= 0) return null;

  return {
    sym: sym.toUpperCase(),
    price: close,
    // prevClose not available from single-row Stooq response; chg/chgPct zeroed
    chg: 0,
    chgPct: 0,
    prevClose: 0,
  };
}

/**
 * fetchStooqQuotes(syms)
 *   Fetches each symbol individually (Stooq has no batch endpoint).
 *   Resolves concurrently; failed symbols are silently skipped.
 *   Returns array of normalized quote objects.
 */
export async function fetchStooqQuotes(syms) {
  if (!syms || syms.length === 0) return [];

  const results = await Promise.allSettled(
    syms.map(async sym => {
      const slug = sym.toLowerCase() + '.us';
      const url = `https://stooq.com/q/l/?s=${slug}&f=sd2t2ohlcv&h&e=csv`;
      const text = await fetchText(url, TIMEOUT_MS);
      const parsed = parseCsv(text, sym);
      if (!parsed) throw new Error('stooq: no parseable data for ' + sym);
      return parsed;
    })
  );

  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}
