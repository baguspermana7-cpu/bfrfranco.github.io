// Aggregate endpoint handlers. Each returns the exact `data` shape the client's V2
// loaders destructure (see the plan's Endpoint spec). Server-side fan-in + KV cache.
// Quote batches use Yahoo `spark` first (1 request, keyless, no Finnhub 55/min quota)
// and fall back to Finnhub per-symbol only for what spark misses.

import { getOrFetch } from "./cache.js";
import { finnhub } from "./finnhub.js";
import { yahooCandles, candleObjects, yahooSpark } from "./yahoo.js";
import { cryptoOverview } from "./coingecko.js";
import { fxLatest, fxHistory } from "./frankfurter.js";
import { analyze } from "./ta.js";
import {
  SECTOR_ETFS, FUTURES_PROXIES, BOND_ETFS, ECON_CURRENCIES,
  SCREENER_UNIVERSE, IDX_UNIVERSE, TF_MAP,
} from "./symbols.js";

const r2 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);

// Cache wrapper that returns the raw data payload (drops the {source,ageMs} envelope
// getOrFetch adds) so every handler resolves directly to the client-expected shape.
const cached = (kv, key, ttl, fn) => getOrFetch(kv, key, ttl, fn).then((r) => r.data);

// Batch quotes → map {SYM:{c,d,dp,v,pc}}. Yahoo spark primary, Finnhub fallback.
async function batchQuotes(env, syms) {
  const map = await yahooSpark(syms);
  const missing = syms.filter((s) => !map[s.toUpperCase()]);
  if (missing.length && env.FINNHUB_TOKEN) {
    const settled = await Promise.allSettled(missing.map((s) => finnhub.quote(s, env)));
    settled.forEach((r, i) => {
      const v = r.status === "fulfilled" ? r.value : null;
      if (v && typeof v.c === "number" && v.c > 0) {
        map[missing[i].toUpperCase()] = { c: v.c, d: v.d, dp: v.dp, v: 0, pc: v.pc };
      }
    });
  }
  return map;
}

// GET /sectors → [{sym,name,price,chgPct,chg}]
export function sectors(request, env) {
  return cached(env.QUOTE_CACHE, "agg:sectors", +env.QUOTE_TTL_SEC || 30, async () => {
    const q = await batchQuotes(env, SECTOR_ETFS.map((s) => s.sym));
    return SECTOR_ETFS.map((s) => {
      const it = q[s.sym] || {};
      return { sym: s.sym, name: s.name, price: r2(it.c) || 0, chgPct: r2(it.dp) || 0, chg: r2(it.d) || 0 };
    });
  });
}

// GET /futures → [{sym,name,price,chgPct,chg}]
export function futures(request, env) {
  return cached(env.QUOTE_CACHE, "agg:futures", +env.QUOTE_TTL_SEC || 30, async () => {
    const q = await batchQuotes(env, FUTURES_PROXIES.map((s) => s.sym));
    return FUTURES_PROXIES.map((s) => {
      const it = q[s.sym] || {};
      return { sym: s.sym, name: s.name, price: r2(it.c) || 0, chgPct: r2(it.dp) || 0, chg: r2(it.d) || 0 };
    });
  });
}

// GET /economy → {yields:[{name,sym,price,chgPct}], currencies:[{pair,rate,inverse}]}
export function economy(request, env) {
  return cached(env.QUOTE_CACHE, "agg:economy", 60, async () => {
    const [q, fx] = await Promise.all([
      batchQuotes(env, BOND_ETFS.map((b) => b.sym)),
      fxLatest("USD").catch(() => ({ rates: {} })),
    ]);
    const yields = BOND_ETFS.map((b) => {
      const it = q[b.sym] || {};
      return { name: b.name, sym: b.sym, price: r2(it.c) || 0, chgPct: r2(it.dp) || 0 };
    });
    const rates = fx.rates || {};
    const currencies = ECON_CURRENCIES.filter((c) => rates[c] != null).map((c) => ({
      pair: "USD/" + c, rate: rates[c], inverse: rates[c] ? 1 / rates[c] : 0,
    }));
    return { yields, currencies };
  });
}

// GET /q?syms=CSV → [{sym,price,chg,chgPct,prevClose}]
export function batchQ(request, env, url) {
  const syms = (url.searchParams.get("syms") || "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 60);
  if (!syms.length) return Promise.resolve([]);
  const key = "q:" + [...syms].sort().join(",");
  return cached(env.QUOTE_CACHE, key, +env.QUOTE_TTL_SEC || 30, async () => {
    const q = await batchQuotes(env, syms);
    return syms.map((s) => {
      const it = q[s] || {};
      return { sym: s, price: r2(it.c) || 0, chg: r2(it.d) || 0, chgPct: r2(it.dp) || 0, prevClose: r2(it.pc) || 0 };
    });
  });
}

// GET /candles?sym=&tf= → {candles:[{t,o,h,l,c,v}]}
export function candles(request, env, url) {
  const sym = (url.searchParams.get("sym") || "").toUpperCase();
  const tf = url.searchParams.get("tf") || "3M";
  if (!sym) { const e = new Error("missing sym"); e.code = "bad_request"; throw e; }
  const m = TF_MAP[tf] || TF_MAP["3M"];
  return cached(env.META_CACHE, `cd:${sym}:${tf}`, +env.CANDLE_TTL_SEC || 300, async () => {
    const norm = await yahooCandles(sym, m.range, m.interval);
    return { candles: candleObjects(norm) };
  });
}

// GET /crypto → {global, coins}
export function crypto(request, env) {
  return cached(env.QUOTE_CACHE, "agg:crypto", 60, () => cryptoOverview());
}

// GET /fx → {rates}
export function fx(request, env) {
  return cached(env.QUOTE_CACHE, "fx:USD", +env.FOREX_TTL_SEC || 300, () => fxLatest("USD"));
}

// GET /fx-history?from=&to=&days= → {points:[{d,v}]}
export function fxHist(request, env, url) {
  const from = (url.searchParams.get("from") || "USD").toUpperCase();
  const to = (url.searchParams.get("to") || "EUR").toUpperCase();
  const days = url.searchParams.get("days") || "30";
  return cached(env.META_CACHE, `fxh:${from}:${to}:${days}`, +env.FOREX_TTL_SEC || 300,
    () => fxHistory(from, to, days));
}

// GET /news?topic=market|SYMBOL → [{title,url,src,summary,ts}]  (ts = epoch MS)
export function news(request, env, url) {
  const topic = (url.searchParams.get("topic") || "market").trim();
  const isSym = topic !== "market" && /^[A-Za-z.\-]{1,10}$/.test(topic);
  const key = isSym ? `news:c:${topic.toUpperCase()}` : "news:general";
  return cached(env.META_CACHE, key, +env.NEWS_TTL_SEC || 120, async () => {
    let raw;
    if (isSym) {
      const to = new Date(), from = new Date(to.getTime() - 14 * 86400000);
      const iso = (d) => d.toISOString().slice(0, 10);
      raw = await finnhub.newsCompany(topic.toUpperCase(), iso(from), iso(to), env);
    } else {
      raw = await finnhub.newsGeneral("general", env);
    }
    const arr = Array.isArray(raw) ? raw : [];
    return arr.slice(0, 40).map((n) => ({
      title: n.headline || n.title || "",
      url: n.url || "",
      src: n.source || n.src || "",
      summary: n.summary || "",
      ts: (n.datetime ? n.datetime * 1000 : (n.ts || Date.now())),
    })).filter((n) => n.title && n.url);
  });
}

// GET /analyze?sym=&tf= → {indicators,signals,gauge,prediction}
export function analyzeEndpoint(request, env, url) {
  const sym = (url.searchParams.get("sym") || "").toUpperCase();
  const tf = url.searchParams.get("tf") || "3M";
  if (!sym) { const e = new Error("missing sym"); e.code = "bad_request"; throw e; }
  const m = TF_MAP[tf] || TF_MAP["3M"];
  return cached(env.META_CACHE, `an:${sym}:${tf}`, +env.CANDLE_TTL_SEC || 300, async () => {
    const norm = await yahooCandles(sym, m.range === "5d" ? "6mo" : m.range, "1d");
    return analyze(candleObjects(norm));
  });
}

// GET /screener?market=us|id&minMcap&maxPe&sector&minDiv&dayChange&preset
//   → [{sym,name,price,chgPct,vol,marketCap,pe,sector,divYield}]
// Yahoo spark = price/chgPct/vol for the whole universe (fast, keyless). For US, fundamentals
// (mcap/pe/div/sector/name) are cached per-symbol in META_CACHE (30d); each request fills up to
// 12 missing profiles so it stays within Worker subrequest limits and the table is never empty.
// For ID (market=id), the universe is IDX `.JK` tickers — Finnhub free has no IDX coverage, so
// fundamentals are skipped and name+sector come from the static IDX_UNIVERSE list; the client's
// FIN Engine scores ID stocks on price/momentum/liquidity + its own sourced free-float dataset.
// `vol` is returned so the client's Liquidity factor works. The client does the scoring/ranking.
export async function screener(request, env, url) {
  const market = (url.searchParams.get("market") || "us").toLowerCase();
  const isID = market === "id";
  const universe = isID ? IDX_UNIVERSE.map((x) => x.sym) : SCREENER_UNIVERSE;

  const minMcap = parseFloat(url.searchParams.get("minMcap")) || 0;
  const maxPe = parseFloat(url.searchParams.get("maxPe")) || Infinity;
  const minDiv = parseFloat(url.searchParams.get("minDiv")) || 0;
  const sector = (url.searchParams.get("sector") || "").trim().toLowerCase();
  const dayChange = (url.searchParams.get("dayChange") || "").trim();

  const quotes = await yahooSpark(universe);

  let profiles = {};
  if (isID) {
    // Static name/sector for IDX; no live fundamentals on free data.
    IDX_UNIVERSE.forEach((x) => { profiles[x.sym] = { name: x.name, sector: x.sector, mcap: 0, pe: 0, div: 0 }; });
  } else {
    profiles = (await readJSON(env.META_CACHE, "screener:profiles")) || {};
    const missing = SCREENER_UNIVERSE.filter((s) => !profiles[s]);
    if (missing.length && env.FINNHUB_TOKEN) {
      const take = missing.slice(0, 12);
      const settled = await Promise.allSettled(take.map(async (s) => {
        const [p, m] = await Promise.all([
          finnhub.profile(s, env).catch(() => null),
          finnhub.metric(s, env).catch(() => null),
        ]);
        return { s, p, m };
      }));
      let wrote = false;
      for (const r of settled) {
        if (r.status !== "fulfilled" || !r.value) continue;
        const { s, p, m } = r.value;
        const metric = (m && m.metric) || {};
        profiles[s] = {
          name: (p && p.name) || s,
          mcap: p && p.marketCapitalization ? p.marketCapitalization * 1e6 : 0,
          sector: (p && p.finnhubIndustry) || "",
          pe: metric.peBasicExclExtraTTM || metric.peTTM || 0,
          div: metric.dividendYieldIndicatedAnnual || metric.currentDividendYieldTTM || 0,
        };
        wrote = true;
      }
      if (wrote) await writeJSON(env.META_CACHE, "screener:profiles", profiles, 30 * 86400);
    }
  }

  const rows = universe.map((s) => {
    const q = quotes[s.toUpperCase()] || {};
    const pf = profiles[s] || {};
    return {
      sym: s, name: pf.name || s, price: r2(q.c) || 0, chgPct: r2(q.dp) || 0, vol: q.v || 0,
      marketCap: pf.mcap || 0, pe: r2(pf.pe) || 0, sector: pf.sector || "", divYield: r2(pf.div) || 0,
    };
  }).filter((r) => r.price > 0)
    .filter((r) => !minMcap || !r.marketCap || r.marketCap >= minMcap)
    .filter((r) => !isFinite(maxPe) || !r.pe || r.pe <= maxPe)
    .filter((r) => !minDiv || (r.divYield && r.divYield >= minDiv))
    .filter((r) => !sector || (r.sector && r.sector.toLowerCase().includes(sector)))
    .filter((r) => {
      if (!dayChange) return true;
      if (dayChange === "up") return r.chgPct > 0;
      if (dayChange === "down") return r.chgPct < 0;
      if (dayChange === "big") return Math.abs(r.chgPct) >= 3;
      return true;
    });
  rows.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0) || (b.chgPct || 0) - (a.chgPct || 0));
  return rows;
}

// KV JSON helpers (screener profile cache is a plain JSON blob, not the wrapped cache).
async function readJSON(kv, key) {
  if (!kv) return null;
  try { const raw = await kv.get(key); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
}
async function writeJSON(kv, key, val, ttl) {
  if (!kv) return;
  try { await kv.put(key, JSON.stringify(val), { expirationTtl: Math.max(60, ttl | 0) }); } catch (_) {}
}
