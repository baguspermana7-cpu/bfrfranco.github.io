// Finnhub adapter. Server-side token only — never echoed to the client.
// Every call passes through fetchWithTimeout so a hung upstream can't
// pin a Worker request to the 30s wall.

const BASE = "https://finnhub.io/api/v1";

async function fhFetch(path, params, env) {
  if (!env.FINNHUB_TOKEN) {
    const e = new Error("FINNHUB_TOKEN secret not set");
    e.code = "no_token";
    throw e;
  }
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null) u.searchParams.set(k, String(v));
  }
  u.searchParams.set("token", env.FINNHUB_TOKEN);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(u.toString(), { signal: ctrl.signal });
    if (!r.ok) {
      const e = new Error(`Finnhub ${r.status}`);
      e.code = "upstream_" + r.status;
      throw e;
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export const finnhub = {
  quote: (sym, env) => fhFetch("/quote", { symbol: sym }, env),
  profile: (sym, env) => fhFetch("/stock/profile2", { symbol: sym }, env),
  metric: (sym, env) => fhFetch("/stock/metric", { symbol: sym, metric: "all" }, env),
  candle: (sym, resolution, from, to, env) =>
    fhFetch("/stock/candle", { symbol: sym, resolution, from, to }, env),
  newsCompany: (sym, from, to, env) =>
    fhFetch("/company-news", { symbol: sym, from, to }, env),
  newsGeneral: (cat, env) => fhFetch("/news", { category: cat || "general" }, env),
  earnings: (from, to, env) =>
    fhFetch("/calendar/earnings", { from, to }, env),
  ipo: (from, to, env) => fhFetch("/calendar/ipo", { from, to }, env),
  econ: (from, to, env) =>
    fhFetch("/calendar/economic", { from, to }, env),
  forex: (base, env) => fhFetch("/forex/rates", { base }, env),
  symbolSearch: (q, env) => fhFetch("/search", { q }, env),
};
