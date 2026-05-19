/**
 * Shared fetch helper for source modules.
 *
 * fetchJSON(url, timeoutMs)
 *   Fetches url with an AbortController timeout, returns parsed JSON.
 *   Throws on non-ok status or JSON parse failure.
 *
 * fetchText(url, timeoutMs)
 *   Same but returns raw text (for CSV sources).
 */

export function fetchJSON(url, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { signal: ctrl.signal })
    .finally(() => clearTimeout(tid))
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return r.json();
    });
}

export function fetchText(url, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { signal: ctrl.signal })
    .finally(() => clearTimeout(tid))
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return r.text();
    });
}
