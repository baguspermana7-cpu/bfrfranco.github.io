// Frankfurter FX adapter (server-side, keyless ECB reference rates). Powers /fx and
// /fx-history. Uses api.frankfurter.dev (the .app host now 301s without CORS — but
// server-side we don't need CORS; .dev is the current canonical host either way).
const BASE = "https://api.frankfurter.dev/v1";

async function fk(path, params) {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null) u.searchParams.set(k, String(v));
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(u.toString(), { signal: ctrl.signal });
    if (!r.ok) {
      const e = new Error(`Frankfurter ${r.status}`);
      e.code = "upstream_" + r.status;
      throw e;
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// { rates: { <CUR>: <number> } } — USD base.
export async function fxLatest(base = "USD") {
  const j = await fk("/latest", { base });
  return { rates: (j && j.rates) || {} };
}

// { points: [{ d, v }] } — daily rate of `to` per 1 `from` over the last `days`.
export async function fxHistory(from, to, days) {
  const n = Math.max(1, Math.min(3650, parseInt(days, 10) || 30));
  const end = new Date();
  const start = new Date(end.getTime() - n * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  const j = await fk(`/${iso(start)}..${iso(end)}`, { base: from, symbols: to });
  const rates = (j && j.rates) || {};
  const points = Object.keys(rates)
    .sort()
    .map((d) => ({ d, v: rates[d] && rates[d][to] != null ? rates[d][to] : null }))
    .filter((p) => p.v != null);
  return { points };
}
