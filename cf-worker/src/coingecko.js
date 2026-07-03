// CoinGecko adapter (server-side, keyless public API). Powers /crypto.
const BASE = "https://api.coingecko.com/api/v3";

async function cg(path, params) {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null) u.searchParams.set(k, String(v));
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    // CoinGecko's free tier 403s requests without a browser-like UA. Send UA + Accept.
    const headers = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (rz-finance-gateway)" };
    const r = await fetch(u.toString(), { signal: ctrl.signal, headers });
    if (!r.ok) {
      const e = new Error(`CoinGecko ${r.status}`);
      e.code = "upstream_" + r.status;
      throw e;
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// { global: <CoinGecko /global data verbatim>, coins: <markets rows> }.
export async function cryptoOverview() {
  const [g, coins] = await Promise.all([
    cg("/global", {}),
    cg("/coins/markets", {
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: 100,
      page: 1,
      price_change_percentage: "24h",
    }),
  ]);
  return { global: (g && g.data) || {}, coins: Array.isArray(coins) ? coins : [] };
}
