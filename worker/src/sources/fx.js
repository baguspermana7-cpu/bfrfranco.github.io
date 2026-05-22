/**
 * FX data fetcher — multi-source fallback chain (all free, no API key).
 *
 * Tries sources in order; first success wins.
 * Each source has a 7000ms AbortController timeout.
 * Returns normalized shape: { base:'USD', date:'YYYY-MM-DD', rates:{...} }
 */

const TIMEOUT_MS = 7000;

function withTimeout(url) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(tid));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Source 1: Frankfurter — { amount, base, date, rates }
async function fromFrankfurter() {
  const r = await withTimeout('https://api.frankfurter.app/latest?from=USD');
  if (!r.ok) throw new Error('frankfurter non-ok: ' + r.status);
  const j = await r.json();
  if (!j || typeof j.rates !== 'object') throw new Error('frankfurter bad shape');
  return { base: 'USD', date: j.date || todayIso(), rates: j.rates };
}

// Source 2: open.er-api — { result:'success', time_last_update_utc, base_code, rates }
async function fromOpenErApi() {
  const r = await withTimeout('https://open.er-api.com/v6/latest/USD');
  if (!r.ok) throw new Error('open.er-api non-ok: ' + r.status);
  const j = await r.json();
  if (!j || j.result !== 'success' || typeof j.rates !== 'object') {
    throw new Error('open.er-api bad shape');
  }
  // Derive date from update time string or fall back to today
  let date = todayIso();
  if (j.time_last_update_utc) {
    try { date = new Date(j.time_last_update_utc).toISOString().slice(0, 10); } catch (_) {}
  }
  return { base: 'USD', date, rates: j.rates };
}

// Source 3: exchangerate.host — { base, date, rates }
async function fromExchangerateHost() {
  const r = await withTimeout('https://api.exchangerate.host/latest?base=USD');
  if (!r.ok) throw new Error('exchangerate.host non-ok: ' + r.status);
  const j = await r.json();
  if (!j || typeof j.rates !== 'object') throw new Error('exchangerate.host bad shape');
  return { base: 'USD', date: j.date || todayIso(), rates: j.rates };
}

const SOURCES = [fromFrankfurter, fromOpenErApi, fromExchangerateHost];

/**
 * Frankfurter timeseries: /<start>..<end>?from=&to=
 * Response: { amount, base, start_date, end_date, rates:{'YYYY-MM-DD':{TO:rate}} }
 * Returns compact contract: { from, to, days, points:[{d,v}] } ascending by date.
 */
export async function fetchFxHistory(from, to, days) {
  const d = Math.max(1, Math.min(730, +days || 30));
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - d);
  const sf = start.toISOString().slice(0, 10);
  const ef = end.toISOString().slice(0, 10);
  const url = `https://api.frankfurter.app/${sf}..${ef}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const r = await withTimeout(url);
  if (!r.ok) throw new Error('frankfurter-history non-ok: ' + r.status);
  const j = await r.json();
  if (!j || typeof j.rates !== 'object') throw new Error('frankfurter-history bad shape');
  const points = Object.keys(j.rates)
    .sort()
    .map(date => {
      const row = j.rates[date];
      const v = row && typeof row[to] === 'number' ? row[to] : null;
      return v == null ? null : { d: date, v };
    })
    .filter(Boolean);
  return { from, to, days: d, points };
}

export async function fetchFx() {
  const errors = [];
  for (const source of SOURCES) {
    try {
      const data = await source();
      if (!data || typeof data.rates !== 'object') throw new Error('missing rates');
      return data;
    } catch (e) {
      errors.push(e.message || String(e));
    }
  }
  throw new Error('all FX sources failed: ' + errors.join(' | '));
}
