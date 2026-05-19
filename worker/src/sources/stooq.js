/**
 * Stooq per-symbol CSV fallback source (free, no API key).
 *
 * Why Stooq must be self-sufficient for change %:
 *   Yahoo frequently 429s from datacenter / Cloudflare-Workers egress, so
 *   Stooq is effectively the PRIMARY source in production. A quote that
 *   shows 0.00% change for everything is a visible bug — so this module
 *   computes a real prevClose.
 *
 * PRIMARY path — single-row quote CSV WITH the Prev (prior-close) field:
 *   https://stooq.com/q/l/?s=<sym.lower>.us&f=sd2t2ohlcvp&h&e=csv
 *   Columns: Symbol,Date,Time,Open,High,Low,Close,Volume,Prev
 *   - price     = Close      (index 6)
 *   - prevClose = Prev       (index 8)  ← prior-day close, no apikey needed
 *   - chg       = price - prevClose
 *   - chgPct    = prevClose ? (chg / prevClose * 100) : 0
 *   This single key-free request works from datacenter IPs and yields a
 *   correct change %. It is the reliable production path.
 *
 * SECOND path — daily history CSV (oldest → newest), if the Prev field is
 *   ever unavailable:
 *   https://stooq.com/q/d/l/?s=<sym.lower>.us&i=d
 *   Columns: Date,Open,High,Low,Close,Volume
 *   - price     = last row Close
 *   - prevClose = second-to-last row Close
 *   NOTE: as of 2026 Stooq gates this endpoint behind a per-account apikey
 *   for some egress IPs (returns an "apikey" instructions body instead of
 *   CSV). parseDailyHistory treats any non-CSV body as no-data so we fall
 *   through cleanly. Kept because it still works from some IPs and is the
 *   only path that survives if the quote schema drops Prev.
 *
 * LAST-RESORT path — single-row quote CSV WITHOUT Prev:
 *   https://stooq.com/q/l/?s=<sym.lower>.us&f=sd2t2ohlcv&h&e=csv
 *   Price only; chg/chgPct are 0 (genuine degraded mode, not the norm).
 *
 * Returns: array of { sym, price, chg, chgPct, prevClose } for each symbol
 *          that resolved.
 */

import { fetchText } from './_util.js';

const TIMEOUT_MS = 7000;

/** Parse a numeric cell, treating 'N/D'/blank/non-finite as unavailable. */
function num(cell) {
  if (cell == null) return NaN;
  const t = String(cell).trim();
  if (t === '' || t === 'N/D') return NaN;
  return parseFloat(t);
}

function build(sym, price, prevClose) {
  const pc = isFinite(prevClose) && prevClose > 0 ? prevClose : 0;
  const chg = pc ? price - pc : 0;
  const chgPct = pc ? (chg / pc) * 100 : 0;
  return { sym: sym.toUpperCase(), price, chg, chgPct, prevClose: pc };
}

/**
 * parseQuoteRow(text, sym, { withPrev })
 *   Parses the single-row quote CSV. With withPrev=true the row carries a
 *   trailing Prev column (prior-day close) so chg% is real; otherwise
 *   chg/chgPct are 0 (price-only degraded mode).
 *   Returns a normalized quote, or null if no valid Close.
 */
function parseQuoteRow(text, sym, { withPrev }) {
  const lines = String(text).trim().split('\n');
  const data = lines[1];
  if (!data) return null;

  const cols = data.split(',');
  // Symbol,Date,Time,Open,High,Low,Close,Volume[,Prev]
  const close = num(cols[6]);
  if (!isFinite(close) || close <= 0) return null;

  const prevClose = withPrev ? num(cols[8]) : NaN;
  return build(sym, close, prevClose);
}

/**
 * parseDailyHistory(text, sym)
 *   Parses the daily-history CSV. Skips the header and any rows whose Close
 *   is not a finite positive number (e.g. 'N/D' rows, blank lines, trailing
 *   newline, or a non-CSV apikey-instructions body). Uses the last two
 *   valid closes. Returns a normalized quote, or null if no valid close.
 */
function parseDailyHistory(text, sym) {
  const lines = String(text).trim().split('\n');
  const closes = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    // Date,Open,High,Low,Close,Volume → Close is index 4
    const close = num(cols[4]);
    if (isFinite(close) && close > 0) closes.push(close);
  }

  if (closes.length === 0) return null;

  const price = closes[closes.length - 1];
  // Second-to-last valid close = prior-day close. With only one row
  // (genuine new-listing edge case) prevClose is unavailable → chg/chgPct 0.
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : 0;
  return build(sym, price, prevClose);
}

/**
 * fetchOneSymbol(sym)
 *   1. single-row quote WITH Prev  → real chg% (reliable, key-free)
 *   2. daily history               → real chg% if reachable without apikey
 *   3. single-row quote WITHOUT Prev → price only, chg 0 (last resort)
 *   Throws only if all three fail to yield a parseable price.
 */
async function fetchOneSymbol(sym) {
  const slug = sym.toLowerCase() + '.us';

  // 1) Quote with Prev field — preferred, gives real chg% key-free.
  try {
    const url = `https://stooq.com/q/l/?s=${slug}&f=sd2t2ohlcvp&h&e=csv`;
    const text = await fetchText(url, TIMEOUT_MS);
    const parsed = parseQuoteRow(text, sym, { withPrev: true });
    if (parsed && parsed.prevClose > 0) return parsed;
    // Prev absent/zero → keep price but try history for a real prevClose.
    if (parsed) {
      try {
        const hUrl = `https://stooq.com/q/d/l/?s=${slug}&i=d`;
        const hText = await fetchText(hUrl, TIMEOUT_MS);
        const h = parseDailyHistory(hText, sym);
        if (h && h.prevClose > 0) return h;
      } catch { /* history gated/blocked — fall back to price-only */ }
      return parsed; // price only, chg 0
    }
  } catch { /* fall through */ }

  // 2) Daily history — real chg% if reachable without an apikey.
  try {
    const url = `https://stooq.com/q/d/l/?s=${slug}&i=d`;
    const text = await fetchText(url, TIMEOUT_MS);
    const parsed = parseDailyHistory(text, sym);
    if (parsed) return parsed;
  } catch { /* fall through */ }

  // 3) Single-row quote WITHOUT Prev — last resort, price only (chg 0).
  const url = `https://stooq.com/q/l/?s=${slug}&f=sd2t2ohlcv&h&e=csv`;
  const text = await fetchText(url, TIMEOUT_MS);
  const parsed = parseQuoteRow(text, sym, { withPrev: false });
  if (!parsed) throw new Error('stooq: no parseable data for ' + sym);
  return parsed;
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
    syms.map(sym => fetchOneSymbol(sym))
  );

  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

/**
 * parseCandleHistory(text, maxRows)
 *   Parses the Stooq daily-history CSV (oldest → newest):
 *     Columns: Date,Open,High,Low,Close,Volume
 *   Skips the header and any row whose Date can't be parsed to epoch or whose
 *   Close is not a finite positive number (handles 'N/D' rows, blank lines,
 *   trailing newline, or a non-CSV apikey-instructions body). Returns the last
 *   `maxRows` valid candles, time-ascending, with t in UNIX SECONDS.
 */
function parseCandleHistory(text, maxRows) {
  const lines = String(text).trim().split('\n');
  const out = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    // Date,Open,High,Low,Close,Volume
    const tsec = Math.floor(Date.parse(String(cols[0]).trim() + 'T00:00:00Z') / 1000);
    const close = num(cols[4]);
    if (!isFinite(tsec) || !isFinite(close) || close <= 0) continue;
    const open = num(cols[1]), high = num(cols[2]), low = num(cols[3]), vol = num(cols[5]);
    out.push({
      t: tsec,
      o: isFinite(open) && open > 0 ? open : close,
      h: isFinite(high) && high > 0 ? high : close,
      l: isFinite(low) && low > 0 ? low : close,
      c: close,
      v: isFinite(vol) && vol >= 0 ? vol : 0,
    });
  }

  if (out.length === 0) return [];
  out.sort((a, b) => a.t - b.t);
  return maxRows && out.length > maxRows ? out.slice(out.length - maxRows) : out;
}

/**
 * parseQuoteCandle(text, sym)
 *   Builds a single { t,o,h,l,c,v } candle from the key-free single-row quote
 *   CSV (the same endpoint quotes use, proven to work from datacenter IPs):
 *     https://stooq.com/q/l/?s=<sym>.us&f=sd2t2ohlcvp&h&e=csv
 *   Columns: Symbol,Date,Time,Open,High,Low,Close,Volume,Prev
 *   Used as a last-resort 1-point series when daily history is apikey-gated
 *   from the egress IP — guarantees the chart can render today's bar instead
 *   of nothing. Returns [] if unparseable.
 */
function parseQuoteCandle(text) {
  const lines = String(text).trim().split('\n');
  const data = lines[1];
  if (!data) return [];
  const cols = data.split(',');
  // Symbol,Date,Time,Open,High,Low,Close,Volume,Prev
  const tsec = Math.floor(Date.parse(String(cols[1]).trim() + 'T00:00:00Z') / 1000);
  const close = num(cols[6]);
  if (!isFinite(tsec) || !isFinite(close) || close <= 0) return [];
  const open = num(cols[3]), high = num(cols[4]), low = num(cols[5]), vol = num(cols[7]);
  return [{
    t: tsec,
    o: isFinite(open) && open > 0 ? open : close,
    h: isFinite(high) && high > 0 ? high : close,
    l: isFinite(low) && low > 0 ? low : close,
    c: close,
    v: isFinite(vol) && vol >= 0 ? vol : 0,
  }];
}

/**
 * fetchStooqCandles(sym, maxRows)
 *   1. Daily-history CSV (preferred, full series, key-free where reachable):
 *        https://stooq.com/q/d/l/?s=<sym.lower>.us&i=d
 *      As of 2026 this endpoint is apikey-gated from some egress IPs and
 *      returns an instructions body instead of CSV — parseCandleHistory
 *      treats that as no-data so we fall through cleanly.
 *   2. Single-row quote CSV (key-free, works from datacenter IPs) → a
 *      1-candle series for today, so the chart still renders.
 *   Returns an array of { t, o, h, l, c, v } (t = UNIX seconds), last
 *   `maxRows` rows. Throws only if BOTH paths yield nothing.
 */
export async function fetchStooqCandles(sym, maxRows) {
  if (!sym) throw new Error('stooq: candles requires a symbol');
  const slug = sym.toLowerCase() + '.us';

  // 1) Full daily history — preferred where reachable without an apikey.
  try {
    const text = await fetchText(`https://stooq.com/q/d/l/?s=${slug}&i=d`, TIMEOUT_MS);
    const candles = parseCandleHistory(text, maxRows);
    if (candles.length > 0) return candles;
  } catch { /* gated/blocked — fall through to key-free quote */ }

  // 2) Key-free single-row quote → minimal 1-candle series (last resort).
  const qText = await fetchText(
    `https://stooq.com/q/l/?s=${slug}&f=sd2t2ohlcvp&h&e=csv`, TIMEOUT_MS);
  const one = parseQuoteCandle(qText);
  if (one.length > 0) return one;

  throw new Error('stooq: no parseable candle data for ' + sym);
}
