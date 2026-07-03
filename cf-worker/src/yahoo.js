// Yahoo Finance public endpoints, called server-side (Worker → Yahoo is plain
// server-to-server, no CORS proxy — solves the codetabs/corsproxy/allorigins
// fragility documented in the B-002..B-012 ROOT). Chart for candles, spark for
// batch quotes.

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const SPARK_BASE = "https://query1.finance.yahoo.com/v7/finance/spark";
const UA = { "User-Agent": "Mozilla/5.0 rz-finance-gateway" };

async function yfetch(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: UA });
    if (!r.ok) {
      const e = new Error(`Yahoo ${r.status}`);
      e.code = "upstream_" + r.status;
      throw e;
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// Normalized candle series (parallel arrays) from the chart endpoint.
export async function yahooCandles(symbol, range, interval) {
  const u = new URL(`${CHART_BASE}/${encodeURIComponent(symbol)}`);
  u.searchParams.set("interval", interval || "1d");
  u.searchParams.set("range", range || "1mo");
  u.searchParams.set("includePrePost", "false");
  const j = await yfetch(u.toString());
  return normalize(j);
}

function normalize(j) {
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  if (!res) return { t: [], o: [], h: [], l: [], c: [], v: [], meta: null };
  const t = res.timestamp || [];
  const q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
  return {
    t,
    o: q.open || [],
    h: q.high || [],
    l: q.low || [],
    c: q.close || [],
    v: q.volume || [],
    meta: res.meta || null,
  };
}

// Convert a normalized series → [{t,o,h,l,c,v}] rows (t = UNIX seconds), the shape
// the client's renderCandles + server ta.analyze() consume. Drops null bars.
export function candleObjects(norm) {
  if (!norm || !norm.t) return [];
  const out = [];
  for (let i = 0; i < norm.t.length; i++) {
    const c = norm.c[i];
    const o = norm.o[i];
    if (c == null || o == null || !isFinite(norm.t[i])) continue;
    out.push({
      t: norm.t[i],
      o, h: norm.h[i], l: norm.l[i], c,
      v: (norm.v && norm.v[i]) || 0,
    });
  }
  return out;
}

// Derive a Finnhub-shaped quote {c,d,dp,v,pc} from a chart/spark result object.
function quoteFromResult(res) {
  if (!res || !res.meta) return null;
  const m = res.meta;
  const q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
  const closes = (q.close || []).filter((v) => v != null);
  const vols = (q.volume || []).filter((v) => v != null);
  const price = typeof m.regularMarketPrice === "number" ? m.regularMarketPrice : closes[closes.length - 1];
  if (price == null) return null;
  const prev = closes.length >= 2 ? closes[closes.length - 2] : (m.chartPreviousClose != null ? m.chartPreviousClose : m.previousClose);
  const d = prev != null ? price - prev : 0;
  const dp = prev != null && prev !== 0 ? (d / prev) * 100 : 0;
  return { c: price, d, dp, v: vols.length ? vols[vols.length - 1] : (m.regularMarketVolume || 0), pc: prev };
}

// Batch quotes for a symbol list via the SINGLE spark endpoint (1 request per chunk
// of ≤18). Returns a map { SYM: {c,d,dp,v,pc} }. Symbols spark can't resolve are
// simply absent (caller decides fallback). Day change = last daily close vs the
// prior daily close (meta.chartPreviousClose spans the whole window, not 1 day).
export async function yahooSpark(symbols) {
  const out = {};
  const list = (symbols || []).map((s) => String(s).toUpperCase()).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < list.length; i += 18) chunks.push(list.slice(i, i + 18));
  await Promise.all(chunks.map(async (chunk) => {
    try {
      const u = new URL(SPARK_BASE);
      u.searchParams.set("symbols", chunk.join(","));
      u.searchParams.set("range", "5d");
      u.searchParams.set("interval", "1d");
      const j = await yfetch(u.toString());
      const results = j && j.spark && Array.isArray(j.spark.result) ? j.spark.result : [];
      for (const it of results) {
        const q = quoteFromResult(it.response && it.response[0]);
        if (q && typeof q.c === "number" && q.c > 0) out[it.symbol] = q;
      }
    } catch (_) {
      // chunk failed (transient/rate-limited) — leave those symbols absent
    }
  }));
  return out;
}
