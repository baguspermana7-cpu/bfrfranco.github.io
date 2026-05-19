/**
 * Shared fetch helper for source modules.
 *
 * fetchJSON(url, timeoutMs, headers?)
 *   Fetches url with an AbortController timeout, returns parsed JSON.
 *   Throws on non-ok status or JSON parse failure.
 *   Optional `headers` object is passed through to fetch() — needed by
 *   sources (e.g. CoinGecko) that 403 a request with no User-Agent
 *   (the Workers runtime omits UA by default unless set explicitly).
 *
 * fetchText(url, timeoutMs, headers?)
 *   Same but returns raw text (for CSV sources).
 */

export function fetchJSON(url, timeoutMs = 7000, headers = null) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  const init = { signal: ctrl.signal };
  if (headers) init.headers = headers;
  return fetch(url, init)
    .finally(() => clearTimeout(tid))
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return r.json();
    });
}

export function fetchText(url, timeoutMs = 7000, headers = null) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  const init = { signal: ctrl.signal };
  if (headers) init.headers = headers;
  return fetch(url, init)
    .finally(() => clearTimeout(tid))
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return r.text();
    });
}
