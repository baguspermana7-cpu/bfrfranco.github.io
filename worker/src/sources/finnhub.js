/**
 * Finnhub per-symbol quote fallback source (requires env.FINNHUB_KEY).
 *
 * Endpoint: https://finnhub.io/api/v1/quote?symbol=<sym>&token=<key>
 * Response: { c, d, dp, h, l, o, pc, t }
 *   c  = current price
 *   d  = change
 *   dp = percent change
 *   pc = previous close
 *
 * Skipped silently when env.FINNHUB_KEY is absent or empty.
 * Returns: array of { sym, price, chg, chgPct, prevClose }
 */

import { fetchJSON } from './_util.js';

const TIMEOUT_MS = 7000;

/**
 * fetchFinnhubQuotes(syms, key)
 *   key — Finnhub API token. If falsy, returns [] immediately.
 *   Fetches each symbol individually (no batch endpoint on free tier).
 *   Failed symbols silently skipped.
 */
export async function fetchFinnhubQuotes(syms, key) {
  if (!key || !syms || syms.length === 0) return [];

  const results = await Promise.allSettled(
    syms.map(async sym => {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(key)}`;
      const j = await fetchJSON(url, TIMEOUT_MS);

      // j.c = 0 means no data (Finnhub returns zeros for unknown symbols)
      if (typeof j.c !== 'number' || j.c === 0) {
        throw new Error('finnhub: no data for ' + sym);
      }

      return {
        sym: sym.toUpperCase(),
        price: j.c,
        chg: typeof j.d === 'number' ? j.d : 0,
        chgPct: typeof j.dp === 'number' ? j.dp : 0,
        prevClose: typeof j.pc === 'number' ? j.pc : 0,
      };
    })
  );

  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}
