var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-zNYcbm/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/cache.js
async function getCached(kv, key, ttlMs, opts = {}) {
  let raw;
  try {
    raw = await kv.get(key);
  } catch {
    return null;
  }
  if (raw == null)
    return null;
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!record || typeof record.t !== "number")
    return null;
  const age = Date.now() - record.t;
  if (age <= ttlMs) {
    return { data: record.d, stale: false, ts: record.t };
  }
  if (opts.allowStale) {
    return { data: record.d, stale: true, ts: record.t };
  }
  return null;
}
__name(getCached, "getCached");
async function setCached(kv, key, data) {
  await kv.put(key, JSON.stringify({ d: data, t: Date.now() }));
}
__name(setCached, "setCached");

// src/sources/fx.js
var TIMEOUT_MS = 7e3;
function withTimeout(url) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(tid));
}
__name(withTimeout, "withTimeout");
function todayIso() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
__name(todayIso, "todayIso");
async function fromFrankfurter() {
  const r = await withTimeout("https://api.frankfurter.app/latest?from=USD");
  if (!r.ok)
    throw new Error("frankfurter non-ok: " + r.status);
  const j = await r.json();
  if (!j || typeof j.rates !== "object")
    throw new Error("frankfurter bad shape");
  return { base: "USD", date: j.date || todayIso(), rates: j.rates };
}
__name(fromFrankfurter, "fromFrankfurter");
async function fromOpenErApi() {
  const r = await withTimeout("https://open.er-api.com/v6/latest/USD");
  if (!r.ok)
    throw new Error("open.er-api non-ok: " + r.status);
  const j = await r.json();
  if (!j || j.result !== "success" || typeof j.rates !== "object") {
    throw new Error("open.er-api bad shape");
  }
  let date = todayIso();
  if (j.time_last_update_utc) {
    try {
      date = new Date(j.time_last_update_utc).toISOString().slice(0, 10);
    } catch (_) {
    }
  }
  return { base: "USD", date, rates: j.rates };
}
__name(fromOpenErApi, "fromOpenErApi");
async function fromExchangerateHost() {
  const r = await withTimeout("https://api.exchangerate.host/latest?base=USD");
  if (!r.ok)
    throw new Error("exchangerate.host non-ok: " + r.status);
  const j = await r.json();
  if (!j || typeof j.rates !== "object")
    throw new Error("exchangerate.host bad shape");
  return { base: "USD", date: j.date || todayIso(), rates: j.rates };
}
__name(fromExchangerateHost, "fromExchangerateHost");
var SOURCES = [fromFrankfurter, fromOpenErApi, fromExchangerateHost];
async function fetchFxHistory(from, to, days) {
  const d = Math.max(1, Math.min(730, +days || 30));
  const end = /* @__PURE__ */ new Date();
  const start = /* @__PURE__ */ new Date();
  start.setDate(start.getDate() - d);
  const sf = start.toISOString().slice(0, 10);
  const ef = end.toISOString().slice(0, 10);
  const url = `https://api.frankfurter.app/${sf}..${ef}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const r = await withTimeout(url);
  if (!r.ok)
    throw new Error("frankfurter-history non-ok: " + r.status);
  const j = await r.json();
  if (!j || typeof j.rates !== "object")
    throw new Error("frankfurter-history bad shape");
  const points = Object.keys(j.rates).sort().map((date) => {
    const row = j.rates[date];
    const v = row && typeof row[to] === "number" ? row[to] : null;
    return v == null ? null : { d: date, v };
  }).filter(Boolean);
  return { from, to, days: d, points };
}
__name(fetchFxHistory, "fetchFxHistory");
async function fetchFx() {
  const errors = [];
  for (const source of SOURCES) {
    try {
      const data = await source();
      if (!data || typeof data.rates !== "object")
        throw new Error("missing rates");
      return data;
    } catch (e) {
      errors.push(e.message || String(e));
    }
  }
  throw new Error("all FX sources failed: " + errors.join(" | "));
}
__name(fetchFx, "fetchFx");

// src/sources/_util.js
function fetchJSON(url, timeoutMs = 7e3, headers = null) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  const init = { signal: ctrl.signal };
  if (headers)
    init.headers = headers;
  return fetch(url, init).finally(() => clearTimeout(tid)).then((r) => {
    if (!r.ok)
      throw new Error("HTTP " + r.status + " " + url);
    return r.json();
  });
}
__name(fetchJSON, "fetchJSON");
function fetchText(url, timeoutMs = 7e3, headers = null) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  const init = { signal: ctrl.signal };
  if (headers)
    init.headers = headers;
  return fetch(url, init).finally(() => clearTimeout(tid)).then((r) => {
    if (!r.ok)
      throw new Error("HTTP " + r.status + " " + url);
    return r.text();
  });
}
__name(fetchText, "fetchText");

// src/sources/yahoo.js
var TIMEOUT_MS2 = 7e3;
async function fetchYahooQuotes(syms) {
  if (!syms || syms.length === 0)
    return [];
  const url = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" + syms.map(encodeURIComponent).join(",") + "&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,shortName";
  const j = await fetchJSON(url, TIMEOUT_MS2);
  const result = j?.quoteResponse?.result;
  if (!Array.isArray(result))
    throw new Error("yahoo: unexpected response shape");
  return result.filter((q) => q && typeof q.regularMarketPrice === "number").map((q) => ({
    sym: String(q.symbol).toUpperCase(),
    price: q.regularMarketPrice,
    chg: typeof q.regularMarketChange === "number" ? q.regularMarketChange : 0,
    chgPct: typeof q.regularMarketChangePercent === "number" ? q.regularMarketChangePercent : 0,
    prevClose: typeof q.regularMarketPreviousClose === "number" ? q.regularMarketPreviousClose : 0,
    ...q.shortName ? { name: q.shortName } : {}
  }));
}
__name(fetchYahooQuotes, "fetchYahooQuotes");
async function fetchYahooCandles(sym, range) {
  if (!sym)
    throw new Error("yahoo: candles requires a symbol");
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?interval=1d&range=" + encodeURIComponent(range || "3mo");
  const j = await fetchJSON(url, TIMEOUT_MS2);
  const r = j?.chart?.result?.[0];
  const ts = r?.timestamp;
  const q = r?.indicators?.quote?.[0];
  if (!Array.isArray(ts) || !q)
    throw new Error("yahoo: unexpected chart shape");
  const o = q.open || [], h = q.high || [], l = q.low || [], c = q.close || [], v = q.volume || [];
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    const t = Number(ts[i]);
    if (!Number.isFinite(t) || ts[i] == null)
      continue;
    if (c[i] == null)
      continue;
    const close = Number(c[i]);
    if (!Number.isFinite(close))
      continue;
    candles.push({
      t,
      o: Number.isFinite(Number(o[i])) ? Number(o[i]) : close,
      h: Number.isFinite(Number(h[i])) ? Number(h[i]) : close,
      l: Number.isFinite(Number(l[i])) ? Number(l[i]) : close,
      c: close,
      v: Number.isFinite(Number(v[i])) ? Number(v[i]) : 0
    });
  }
  if (candles.length === 0)
    throw new Error("yahoo: no valid candles for " + sym);
  candles.sort((a, b) => a.t - b.t);
  return candles;
}
__name(fetchYahooCandles, "fetchYahooCandles");

// src/sources/stooq.js
var TIMEOUT_MS3 = 7e3;
function num(cell) {
  if (cell == null)
    return NaN;
  const t = String(cell).trim();
  if (t === "" || t === "N/D")
    return NaN;
  return parseFloat(t);
}
__name(num, "num");
function build(sym, price, prevClose) {
  const pc = isFinite(prevClose) && prevClose > 0 ? prevClose : 0;
  const chg = pc ? price - pc : 0;
  const chgPct = pc ? chg / pc * 100 : 0;
  return { sym: sym.toUpperCase(), price, chg, chgPct, prevClose: pc };
}
__name(build, "build");
function parseQuoteRow(text, sym, { withPrev }) {
  const lines = String(text).trim().split("\n");
  const data = lines[1];
  if (!data)
    return null;
  const cols = data.split(",");
  const close = num(cols[6]);
  if (!isFinite(close) || close <= 0)
    return null;
  const prevClose = withPrev ? num(cols[8]) : NaN;
  return build(sym, close, prevClose);
}
__name(parseQuoteRow, "parseQuoteRow");
function parseDailyHistory(text, sym) {
  const lines = String(text).trim().split("\n");
  const closes = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line)
      continue;
    const cols = line.split(",");
    const close = num(cols[4]);
    if (isFinite(close) && close > 0)
      closes.push(close);
  }
  if (closes.length === 0)
    return null;
  const price = closes[closes.length - 1];
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : 0;
  return build(sym, price, prevClose);
}
__name(parseDailyHistory, "parseDailyHistory");
async function fetchOneSymbol(sym) {
  const slug = sym.toLowerCase() + ".us";
  try {
    const url2 = `https://stooq.com/q/l/?s=${slug}&f=sd2t2ohlcvp&h&e=csv`;
    const text2 = await fetchText(url2, TIMEOUT_MS3);
    const parsed2 = parseQuoteRow(text2, sym, { withPrev: true });
    if (parsed2 && parsed2.prevClose > 0)
      return parsed2;
    if (parsed2) {
      try {
        const hUrl = `https://stooq.com/q/d/l/?s=${slug}&i=d`;
        const hText = await fetchText(hUrl, TIMEOUT_MS3);
        const h = parseDailyHistory(hText, sym);
        if (h && h.prevClose > 0)
          return h;
      } catch {
      }
      return parsed2;
    }
  } catch {
  }
  try {
    const url2 = `https://stooq.com/q/d/l/?s=${slug}&i=d`;
    const text2 = await fetchText(url2, TIMEOUT_MS3);
    const parsed2 = parseDailyHistory(text2, sym);
    if (parsed2)
      return parsed2;
  } catch {
  }
  const url = `https://stooq.com/q/l/?s=${slug}&f=sd2t2ohlcv&h&e=csv`;
  const text = await fetchText(url, TIMEOUT_MS3);
  const parsed = parseQuoteRow(text, sym, { withPrev: false });
  if (!parsed)
    throw new Error("stooq: no parseable data for " + sym);
  return parsed;
}
__name(fetchOneSymbol, "fetchOneSymbol");
async function fetchStooqQuotes(syms) {
  if (!syms || syms.length === 0)
    return [];
  const results = await Promise.allSettled(
    syms.map((sym) => fetchOneSymbol(sym))
  );
  return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
}
__name(fetchStooqQuotes, "fetchStooqQuotes");
function parseCandleHistory(text, maxRows) {
  const lines = String(text).trim().split("\n");
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line)
      continue;
    const cols = line.split(",");
    const tsec = Math.floor(Date.parse(String(cols[0]).trim() + "T00:00:00Z") / 1e3);
    const close = num(cols[4]);
    if (!isFinite(tsec) || !isFinite(close) || close <= 0)
      continue;
    const open = num(cols[1]), high = num(cols[2]), low = num(cols[3]), vol = num(cols[5]);
    out.push({
      t: tsec,
      o: isFinite(open) && open > 0 ? open : close,
      h: isFinite(high) && high > 0 ? high : close,
      l: isFinite(low) && low > 0 ? low : close,
      c: close,
      v: isFinite(vol) && vol >= 0 ? vol : 0
    });
  }
  if (out.length === 0)
    return [];
  out.sort((a, b) => a.t - b.t);
  return maxRows && out.length > maxRows ? out.slice(out.length - maxRows) : out;
}
__name(parseCandleHistory, "parseCandleHistory");
function parseQuoteCandle(text) {
  const lines = String(text).trim().split("\n");
  const data = lines[1];
  if (!data)
    return [];
  const cols = data.split(",");
  const tsec = Math.floor(Date.parse(String(cols[1]).trim() + "T00:00:00Z") / 1e3);
  const close = num(cols[6]);
  if (!isFinite(tsec) || !isFinite(close) || close <= 0)
    return [];
  const open = num(cols[3]), high = num(cols[4]), low = num(cols[5]), vol = num(cols[7]);
  return [{
    t: tsec,
    o: isFinite(open) && open > 0 ? open : close,
    h: isFinite(high) && high > 0 ? high : close,
    l: isFinite(low) && low > 0 ? low : close,
    c: close,
    v: isFinite(vol) && vol >= 0 ? vol : 0
  }];
}
__name(parseQuoteCandle, "parseQuoteCandle");
async function fetchStooqCandles(sym, maxRows) {
  if (!sym)
    throw new Error("stooq: candles requires a symbol");
  const slug = sym.toLowerCase() + ".us";
  try {
    const text = await fetchText(`https://stooq.com/q/d/l/?s=${slug}&i=d`, TIMEOUT_MS3);
    const candles = parseCandleHistory(text, maxRows);
    if (candles.length > 0)
      return candles;
  } catch {
  }
  const qText = await fetchText(
    `https://stooq.com/q/l/?s=${slug}&f=sd2t2ohlcvp&h&e=csv`,
    TIMEOUT_MS3
  );
  const one = parseQuoteCandle(qText);
  if (one.length > 0)
    return one;
  throw new Error("stooq: no parseable candle data for " + sym);
}
__name(fetchStooqCandles, "fetchStooqCandles");

// src/sources/finnhub.js
var TIMEOUT_MS4 = 7e3;
async function fetchFinnhubQuotes(syms, key) {
  if (!key || !syms || syms.length === 0)
    return [];
  const results = await Promise.allSettled(
    syms.map(async (sym) => {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(key)}`;
      const j = await fetchJSON(url, TIMEOUT_MS4);
      if (typeof j.c !== "number" || j.c === 0) {
        throw new Error("finnhub: no data for " + sym);
      }
      return {
        sym: sym.toUpperCase(),
        price: j.c,
        chg: typeof j.d === "number" ? j.d : 0,
        chgPct: typeof j.dp === "number" ? j.dp : 0,
        prevClose: typeof j.pc === "number" ? j.pc : 0
      };
    })
  );
  return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
}
__name(fetchFinnhubQuotes, "fetchFinnhubQuotes");

// src/sources/news.js
var TIMEOUT_MS5 = 7e3;
var MAX_ITEMS = 20;
async function fetchNews(topic, env) {
  const errors = [];
  try {
    const items = await fetchGdelt(topic);
    if (items.length > 0)
      return finalize(items);
  } catch (e) {
    errors.push("gdelt: " + (e.message || String(e)));
  }
  try {
    const items = await fetchYahooRss();
    if (items.length > 0)
      return finalize(items);
  } catch (e) {
    errors.push("yahoo-rss: " + (e.message || String(e)));
  }
  if (env && env.FINNHUB_KEY) {
    try {
      const items = await fetchFinnhubNews(env.FINNHUB_KEY);
      if (items.length > 0)
        return finalize(items);
    } catch (e) {
      errors.push("finnhub: " + (e.message || String(e)));
    }
  }
  throw new Error("all news sources failed or empty: " + errors.join(" | "));
}
__name(fetchNews, "fetchNews");
function finalize(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const it of items) {
    if (!it || !it.url || !it.title)
      continue;
    if (seen.has(it.url))
      continue;
    seen.add(it.url);
    out.push({
      title: it.title,
      url: it.url,
      src: it.src || "",
      ts: Number.isFinite(it.ts) ? it.ts : Date.now(),
      summary: it.summary || it.title
    });
  }
  out.sort((a, b) => b.ts - a.ts);
  return out.slice(0, MAX_ITEMS);
}
__name(finalize, "finalize");
async function fetchGdelt(topic) {
  const query = String(topic || "").trim() || "stock market";
  const url = "https://api.gdeltproject.org/api/v2/doc/doc?query=" + encodeURIComponent(query) + "&mode=ArtList&format=json&maxrecords=25&sort=DateDesc";
  const j = await fetchJSON(url, TIMEOUT_MS5);
  const arts = j && Array.isArray(j.articles) ? j.articles : [];
  return arts.filter((a) => a && a.title && a.url).map((a) => ({
    title: String(a.title).trim(),
    url: String(a.url).trim(),
    src: a.domain ? String(a.domain) : domainOf(a.url),
    ts: parseGdeltDate(a.seendate),
    summary: String(a.title).trim()
  }));
}
__name(fetchGdelt, "fetchGdelt");
function parseGdeltDate(s) {
  if (typeof s === "string") {
    const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
    if (m) {
      const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
      if (Number.isFinite(ms))
        return ms;
    }
    const p = Date.parse(s);
    if (Number.isFinite(p))
      return p;
  }
  return Date.now();
}
__name(parseGdeltDate, "parseGdeltDate");
async function fetchYahooRss() {
  const url = "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US";
  let xml;
  try {
    xml = await fetchText(url, TIMEOUT_MS5);
  } catch (e) {
    xml = await fetchText("https://finance.yahoo.com/news/rssindex", TIMEOUT_MS5);
  }
  return parseRss(xml);
}
__name(fetchYahooRss, "fetchYahooRss");
function parseRss(xml) {
  if (typeof xml !== "string" || !xml)
    return [];
  const items = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  const blocks = xml.match(itemRe) || [];
  for (const block of blocks) {
    const title = tag(block, "title");
    const link = tag(block, "link");
    if (!title || !link)
      continue;
    const pub = tag(block, "pubDate");
    const desc = tag(block, "description");
    const tsParsed = pub ? Date.parse(pub) : NaN;
    items.push({
      title,
      url: link,
      src: domainOf(link),
      ts: Number.isFinite(tsParsed) ? tsParsed : Date.now(),
      summary: desc || title
    });
  }
  return items;
}
__name(parseRss, "parseRss");
function tag(block, name) {
  const re = new RegExp("<" + name + "[^>]*>([\\s\\S]*?)<\\/" + name + ">", "i");
  const m = block.match(re);
  if (!m)
    return "";
  let v = m[1];
  v = v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return decodeEntities(v.trim());
}
__name(tag, "tag");
function decodeEntities(s) {
  return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
__name(decodeEntities, "decodeEntities");
async function fetchFinnhubNews(key) {
  const url = "https://finnhub.io/api/v1/news?category=general&token=" + encodeURIComponent(key);
  const j = await fetchJSON(url, TIMEOUT_MS5);
  const arr = Array.isArray(j) ? j : [];
  return arr.filter((a) => a && a.headline && a.url).map((a) => ({
    title: String(a.headline).trim(),
    url: String(a.url).trim(),
    src: a.source ? String(a.source) : domainOf(a.url),
    ts: typeof a.datetime === "number" ? a.datetime * 1e3 : Date.now(),
    summary: a.summary ? String(a.summary).trim() : String(a.headline).trim()
  }));
}
__name(fetchFinnhubNews, "fetchFinnhubNews");
function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
__name(domainOf, "domainOf");

// src/sources/coingecko.js
var TIMEOUT_MS6 = 8e3;
var CG_HEADERS = { "User-Agent": "rz-finance-gateway", Accept: "application/json" };
var MARKETS_URL = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=1h,24h,7d&sparkline=true";
var GLOBAL_URL = "https://api.coingecko.com/api/v3/global";
async function fetchCoinGeckoMarkets() {
  const j = await fetchJSON(MARKETS_URL, TIMEOUT_MS6, CG_HEADERS);
  if (!Array.isArray(j))
    throw new Error("coingecko markets: not an array");
  return j;
}
__name(fetchCoinGeckoMarkets, "fetchCoinGeckoMarkets");
async function fetchCoinGeckoGlobal() {
  const j = await fetchJSON(GLOBAL_URL, TIMEOUT_MS6, CG_HEADERS);
  const g = j && j.data;
  if (!g || typeof g !== "object")
    throw new Error("coingecko global: missing data");
  return g;
}
__name(fetchCoinGeckoGlobal, "fetchCoinGeckoGlobal");

// src/data/screener-universe.js
var SCREENER_UNIVERSE = [
  // ── Technology ────────────────────────────────────────────────
  { sym: "AAPL", name: "Apple Inc.", sector: "Technology", marketCap: 33e11, pe: 33, divYield: 0.45, avgVol: 55e6 },
  { sym: "MSFT", name: "Microsoft Corp.", sector: "Technology", marketCap: 31e11, pe: 36, divYield: 0.72, avgVol: 22e6 },
  { sym: "NVDA", name: "NVIDIA Corp.", sector: "Technology", marketCap: 3e12, pe: 55, divYield: 0.03, avgVol: 24e7 },
  { sym: "AVGO", name: "Broadcom Inc.", sector: "Technology", marketCap: 8e11, pe: 60, divYield: 1.2, avgVol: 25e6 },
  { sym: "ORCL", name: "Oracle Corp.", sector: "Technology", marketCap: 38e10, pe: 38, divYield: 1.1, avgVol: 9e6 },
  { sym: "CRM", name: "Salesforce Inc.", sector: "Technology", marketCap: 29e10, pe: 45, divYield: 0.55, avgVol: 6e6 },
  { sym: "ADBE", name: "Adobe Inc.", sector: "Technology", marketCap: 23e10, pe: 40, divYield: 0, avgVol: 35e5 },
  { sym: "AMD", name: "Advanced Micro Devices", sector: "Technology", marketCap: 23e10, pe: 48, divYield: 0, avgVol: 55e6 },
  { sym: "CSCO", name: "Cisco Systems Inc.", sector: "Technology", marketCap: 2e11, pe: 21, divYield: 2.8, avgVol: 2e7 },
  { sym: "ACN", name: "Accenture plc", sector: "Technology", marketCap: 215e9, pe: 28, divYield: 1.55, avgVol: 23e5 },
  { sym: "TXN", name: "Texas Instruments Inc.", sector: "Technology", marketCap: 175e9, pe: 34, divYield: 2.7, avgVol: 5e6 },
  { sym: "INTC", name: "Intel Corp.", sector: "Technology", marketCap: 95e9, pe: null, divYield: 1.3, avgVol: 5e7 },
  { sym: "IBM", name: "IBM Corp.", sector: "Technology", marketCap: 2e11, pe: 30, divYield: 3.2, avgVol: 45e5 },
  { sym: "QCOM", name: "QUALCOMM Inc.", sector: "Technology", marketCap: 185e9, pe: 22, divYield: 1.9, avgVol: 9e6 },
  { sym: "NOW", name: "ServiceNow Inc.", sector: "Technology", marketCap: 195e9, pe: 58, divYield: 0, avgVol: 15e5 },
  { sym: "PLTR", name: "Palantir Technologies", sector: "Technology", marketCap: 9e10, pe: 70, divYield: 0, avgVol: 6e7 },
  { sym: "SNOW", name: "Snowflake Inc.", sector: "Technology", marketCap: 55e9, pe: null, divYield: 0, avgVol: 5e6 },
  { sym: "DDOG", name: "Datadog Inc.", sector: "Technology", marketCap: 42e9, pe: 75, divYield: 0, avgVol: 4e6 },
  { sym: "CRWD", name: "CrowdStrike Holdings", sector: "Technology", marketCap: 75e9, pe: 80, divYield: 0, avgVol: 4e6 },
  { sym: "HPQ", name: "HP Inc.", sector: "Technology", marketCap: 32e9, pe: 12, divYield: 3.3, avgVol: 8e6 },
  // ── Health Care ──────────────────────────────────────────────
  { sym: "LLY", name: "Eli Lilly and Co.", sector: "Health Care", marketCap: 78e10, pe: 60, divYield: 0.65, avgVol: 35e5 },
  { sym: "UNH", name: "UnitedHealth Group", sector: "Health Care", marketCap: 5e11, pe: 20, divYield: 1.45, avgVol: 3e6 },
  { sym: "JNJ", name: "Johnson & Johnson", sector: "Health Care", marketCap: 38e10, pe: 15, divYield: 3.1, avgVol: 7e6 },
  { sym: "MRK", name: "Merck & Co.", sector: "Health Care", marketCap: 25e10, pe: 14, divYield: 2.9, avgVol: 9e6 },
  { sym: "ABBV", name: "AbbVie Inc.", sector: "Health Care", marketCap: 32e10, pe: 18, divYield: 3.3, avgVol: 6e6 },
  { sym: "TMO", name: "Thermo Fisher Scientific", sector: "Health Care", marketCap: 215e9, pe: 30, divYield: 0.3, avgVol: 18e5 },
  { sym: "ABT", name: "Abbott Laboratories", sector: "Health Care", marketCap: 2e11, pe: 33, divYield: 1.9, avgVol: 5e6 },
  { sym: "PFE", name: "Pfizer Inc.", sector: "Health Care", marketCap: 15e10, pe: 13, divYield: 6.2, avgVol: 4e7 },
  { sym: "DHR", name: "Danaher Corp.", sector: "Health Care", marketCap: 18e10, pe: 35, divYield: 0.45, avgVol: 25e5 },
  { sym: "BMY", name: "Bristol-Myers Squibb", sector: "Health Care", marketCap: 1e11, pe: 12, divYield: 4.5, avgVol: 11e6 },
  { sym: "AMGN", name: "Amgen Inc.", sector: "Health Care", marketCap: 145e9, pe: 26, divYield: 3.1, avgVol: 3e6 },
  { sym: "GILD", name: "Gilead Sciences Inc.", sector: "Health Care", marketCap: 95e9, pe: 21, divYield: 4.1, avgVol: 6e6 },
  { sym: "CVS", name: "CVS Health Corp.", sector: "Health Care", marketCap: 7e10, pe: 11, divYield: 4.3, avgVol: 9e6 },
  { sym: "MDT", name: "Medtronic plc", sector: "Health Care", marketCap: 11e10, pe: 16, divYield: 3.2, avgVol: 6e6 },
  { sym: "ISRG", name: "Intuitive Surgical Inc.", sector: "Health Care", marketCap: 165e9, pe: 70, divYield: 0, avgVol: 16e5 },
  { sym: "MRNA", name: "Moderna Inc.", sector: "Health Care", marketCap: 15e9, pe: null, divYield: 0, avgVol: 8e6 },
  // ── Financials ───────────────────────────────────────────────
  { sym: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials", marketCap: 62e10, pe: 12, divYield: 2.2, avgVol: 9e6 },
  { sym: "BAC", name: "Bank of America Corp.", sector: "Financials", marketCap: 32e10, pe: 13, divYield: 2.5, avgVol: 4e7 },
  { sym: "WFC", name: "Wells Fargo & Co.", sector: "Financials", marketCap: 2e11, pe: 12, divYield: 2.6, avgVol: 18e6 },
  { sym: "GS", name: "Goldman Sachs Group", sector: "Financials", marketCap: 165e9, pe: 16, divYield: 2.1, avgVol: 25e5 },
  { sym: "MS", name: "Morgan Stanley", sector: "Financials", marketCap: 175e9, pe: 17, divYield: 3.1, avgVol: 8e6 },
  { sym: "C", name: "Citigroup Inc.", sector: "Financials", marketCap: 12e10, pe: 11, divYield: 3.2, avgVol: 14e6 },
  { sym: "BLK", name: "BlackRock Inc.", sector: "Financials", marketCap: 145e9, pe: 23, divYield: 2.1, avgVol: 7e5 },
  { sym: "SCHW", name: "Charles Schwab Corp.", sector: "Financials", marketCap: 13e10, pe: 24, divYield: 1.5, avgVol: 9e6 },
  { sym: "AXP", name: "American Express Co.", sector: "Financials", marketCap: 19e10, pe: 20, divYield: 1.05, avgVol: 3e6 },
  { sym: "V", name: "Visa Inc.", sector: "Financials", marketCap: 56e10, pe: 31, divYield: 0.75, avgVol: 6e6 },
  { sym: "MA", name: "Mastercard Inc.", sector: "Financials", marketCap: 45e10, pe: 36, divYield: 0.55, avgVol: 3e6 },
  { sym: "BRK.B", name: "Berkshire Hathaway B", sector: "Financials", marketCap: 98e10, pe: 22, divYield: 0, avgVol: 4e6 },
  { sym: "PNC", name: "PNC Financial Services", sector: "Financials", marketCap: 75e9, pe: 14, divYield: 3.4, avgVol: 25e5 },
  { sym: "USB", name: "U.S. Bancorp", sector: "Financials", marketCap: 7e10, pe: 13, divYield: 4.2, avgVol: 9e6 },
  { sym: "COF", name: "Capital One Financial", sector: "Financials", marketCap: 6e10, pe: 14, divYield: 1.6, avgVol: 3e6 },
  // ── Consumer Discretionary ───────────────────────────────────
  { sym: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary", marketCap: 21e11, pe: 42, divYield: 0, avgVol: 4e7 },
  { sym: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary", marketCap: 9e11, pe: 70, divYield: 0, avgVol: 9e7 },
  { sym: "HD", name: "Home Depot Inc.", sector: "Consumer Discretionary", marketCap: 38e10, pe: 25, divYield: 2.4, avgVol: 35e5 },
  { sym: "MCD", name: "McDonald's Corp.", sector: "Consumer Discretionary", marketCap: 21e10, pe: 24, divYield: 2.3, avgVol: 3e6 },
  { sym: "NKE", name: "Nike Inc.", sector: "Consumer Discretionary", marketCap: 115e9, pe: 22, divYield: 1.8, avgVol: 9e6 },
  { sym: "LOW", name: "Lowe's Companies Inc.", sector: "Consumer Discretionary", marketCap: 145e9, pe: 21, divYield: 1.85, avgVol: 3e6 },
  { sym: "SBUX", name: "Starbucks Corp.", sector: "Consumer Discretionary", marketCap: 105e9, pe: 28, divYield: 2.5, avgVol: 9e6 },
  { sym: "BKNG", name: "Booking Holdings Inc.", sector: "Consumer Discretionary", marketCap: 16e10, pe: 30, divYield: 0.8, avgVol: 35e4 },
  { sym: "TJX", name: "TJX Companies Inc.", sector: "Consumer Discretionary", marketCap: 135e9, pe: 28, divYield: 1.25, avgVol: 5e6 },
  { sym: "F", name: "Ford Motor Co.", sector: "Consumer Discretionary", marketCap: 45e9, pe: 12, divYield: 5.2, avgVol: 6e7 },
  { sym: "GM", name: "General Motors Co.", sector: "Consumer Discretionary", marketCap: 55e9, pe: 6, divYield: 1.1, avgVol: 14e6 },
  { sym: "ABNB", name: "Airbnb Inc.", sector: "Consumer Discretionary", marketCap: 8e10, pe: 38, divYield: 0, avgVol: 5e6 },
  { sym: "MAR", name: "Marriott International", sector: "Consumer Discretionary", marketCap: 75e9, pe: 26, divYield: 0.9, avgVol: 2e6 },
  { sym: "CMG", name: "Chipotle Mexican Grill", sector: "Consumer Discretionary", marketCap: 8e10, pe: 50, divYield: 0, avgVol: 18e6 },
  // ── Industrials ──────────────────────────────────────────────
  { sym: "CAT", name: "Caterpillar Inc.", sector: "Industrials", marketCap: 175e9, pe: 16, divYield: 1.7, avgVol: 3e6 },
  { sym: "BA", name: "Boeing Co.", sector: "Industrials", marketCap: 11e10, pe: null, divYield: 0, avgVol: 8e6 },
  { sym: "GE", name: "GE Aerospace", sector: "Industrials", marketCap: 2e11, pe: 35, divYield: 0.65, avgVol: 5e6 },
  { sym: "HON", name: "Honeywell International", sector: "Industrials", marketCap: 14e10, pe: 23, divYield: 2.1, avgVol: 3e6 },
  { sym: "UPS", name: "United Parcel Service", sector: "Industrials", marketCap: 11e10, pe: 18, divYield: 4.4, avgVol: 4e6 },
  { sym: "RTX", name: "RTX Corp.", sector: "Industrials", marketCap: 16e10, pe: 22, divYield: 2.2, avgVol: 6e6 },
  { sym: "DE", name: "Deere & Co.", sector: "Industrials", marketCap: 11e10, pe: 14, divYield: 1.5, avgVol: 17e5 },
  { sym: "LMT", name: "Lockheed Martin Corp.", sector: "Industrials", marketCap: 105e9, pe: 18, divYield: 2.6, avgVol: 12e5 },
  { sym: "UNP", name: "Union Pacific Corp.", sector: "Industrials", marketCap: 145e9, pe: 22, divYield: 2.2, avgVol: 3e6 },
  { sym: "MMM", name: "3M Co.", sector: "Industrials", marketCap: 7e10, pe: 17, divYield: 2.1, avgVol: 5e6 },
  { sym: "GD", name: "General Dynamics Corp.", sector: "Industrials", marketCap: 75e9, pe: 20, divYield: 2, avgVol: 12e5 },
  { sym: "CSX", name: "CSX Corp.", sector: "Industrials", marketCap: 65e9, pe: 18, divYield: 1.4, avgVol: 14e6 },
  { sym: "EMR", name: "Emerson Electric Co.", sector: "Industrials", marketCap: 65e9, pe: 20, divYield: 1.85, avgVol: 3e6 },
  { sym: "FDX", name: "FedEx Corp.", sector: "Industrials", marketCap: 65e9, pe: 15, divYield: 2.1, avgVol: 25e5 },
  // ── Communication Services ───────────────────────────────────
  { sym: "GOOGL", name: "Alphabet Inc. Class A", sector: "Communication Services", marketCap: 22e11, pe: 26, divYield: 0.45, avgVol: 28e6 },
  { sym: "META", name: "Meta Platforms Inc.", sector: "Communication Services", marketCap: 14e11, pe: 28, divYield: 0.35, avgVol: 14e6 },
  { sym: "NFLX", name: "Netflix Inc.", sector: "Communication Services", marketCap: 35e10, pe: 42, divYield: 0, avgVol: 4e6 },
  { sym: "DIS", name: "Walt Disney Co.", sector: "Communication Services", marketCap: 2e11, pe: 38, divYield: 0.85, avgVol: 9e6 },
  { sym: "CMCSA", name: "Comcast Corp.", sector: "Communication Services", marketCap: 16e10, pe: 11, divYield: 3.1, avgVol: 18e6 },
  { sym: "T", name: "AT&T Inc.", sector: "Communication Services", marketCap: 15e10, pe: 13, divYield: 5.3, avgVol: 35e6 },
  { sym: "VZ", name: "Verizon Communications", sector: "Communication Services", marketCap: 175e9, pe: 16, divYield: 6.4, avgVol: 18e6 },
  { sym: "TMUS", name: "T-Mobile US Inc.", sector: "Communication Services", marketCap: 24e10, pe: 24, divYield: 1.5, avgVol: 4e6 },
  { sym: "CHTR", name: "Charter Communications", sector: "Communication Services", marketCap: 5e10, pe: 9, divYield: 0, avgVol: 13e5 },
  { sym: "EA", name: "Electronic Arts Inc.", sector: "Communication Services", marketCap: 38e9, pe: 32, divYield: 0.55, avgVol: 22e5 },
  { sym: "WBD", name: "Warner Bros. Discovery", sector: "Communication Services", marketCap: 25e9, pe: null, divYield: 0, avgVol: 25e6 },
  // ── Consumer Staples ─────────────────────────────────────────
  { sym: "WMT", name: "Walmart Inc.", sector: "Consumer Staples", marketCap: 6e11, pe: 38, divYield: 1.1, avgVol: 18e6 },
  { sym: "COST", name: "Costco Wholesale Corp.", sector: "Consumer Staples", marketCap: 4e11, pe: 52, divYield: 0.5, avgVol: 2e6 },
  { sym: "PG", name: "Procter & Gamble Co.", sector: "Consumer Staples", marketCap: 39e10, pe: 27, divYield: 2.4, avgVol: 6e6 },
  { sym: "KO", name: "Coca-Cola Co.", sector: "Consumer Staples", marketCap: 28e10, pe: 25, divYield: 3, avgVol: 14e6 },
  { sym: "PEP", name: "PepsiCo Inc.", sector: "Consumer Staples", marketCap: 23e10, pe: 23, divYield: 3.3, avgVol: 5e6 },
  { sym: "PM", name: "Philip Morris Intl.", sector: "Consumer Staples", marketCap: 18e10, pe: 18, divYield: 4.4, avgVol: 5e6 },
  { sym: "MO", name: "Altria Group Inc.", sector: "Consumer Staples", marketCap: 9e10, pe: 9, divYield: 7.8, avgVol: 9e6 },
  { sym: "MDLZ", name: "Mondelez International", sector: "Consumer Staples", marketCap: 9e10, pe: 21, divYield: 2.6, avgVol: 7e6 },
  { sym: "CL", name: "Colgate-Palmolive Co.", sector: "Consumer Staples", marketCap: 75e9, pe: 26, divYield: 2, avgVol: 4e6 },
  { sym: "KMB", name: "Kimberly-Clark Corp.", sector: "Consumer Staples", marketCap: 45e9, pe: 19, divYield: 3.6, avgVol: 2e6 },
  { sym: "GIS", name: "General Mills Inc.", sector: "Consumer Staples", marketCap: 38e9, pe: 15, divYield: 3.9, avgVol: 5e6 },
  { sym: "KHC", name: "Kraft Heinz Co.", sector: "Consumer Staples", marketCap: 4e10, pe: 13, divYield: 4.8, avgVol: 8e6 },
  // ── Energy ───────────────────────────────────────────────────
  { sym: "XOM", name: "Exxon Mobil Corp.", sector: "Energy", marketCap: 48e10, pe: 14, divYield: 3.3, avgVol: 16e6 },
  { sym: "CVX", name: "Chevron Corp.", sector: "Energy", marketCap: 28e10, pe: 15, divYield: 4.1, avgVol: 9e6 },
  { sym: "COP", name: "ConocoPhillips", sector: "Energy", marketCap: 13e10, pe: 13, divYield: 2.9, avgVol: 7e6 },
  { sym: "SLB", name: "Schlumberger NV", sector: "Energy", marketCap: 6e10, pe: 13, divYield: 2.6, avgVol: 11e6 },
  { sym: "EOG", name: "EOG Resources Inc.", sector: "Energy", marketCap: 7e10, pe: 11, divYield: 3.1, avgVol: 4e6 },
  { sym: "MPC", name: "Marathon Petroleum Corp.", sector: "Energy", marketCap: 55e9, pe: 12, divYield: 2.2, avgVol: 35e5 },
  { sym: "PSX", name: "Phillips 66", sector: "Energy", marketCap: 55e9, pe: 13, divYield: 3.5, avgVol: 3e6 },
  { sym: "VLO", name: "Valero Energy Corp.", sector: "Energy", marketCap: 45e9, pe: 11, divYield: 3.1, avgVol: 4e6 },
  { sym: "OXY", name: "Occidental Petroleum", sector: "Energy", marketCap: 5e10, pe: 15, divYield: 1.8, avgVol: 14e6 },
  { sym: "WMB", name: "Williams Companies Inc.", sector: "Energy", marketCap: 6e10, pe: 24, divYield: 3.8, avgVol: 9e6 },
  { sym: "KMI", name: "Kinder Morgan Inc.", sector: "Energy", marketCap: 55e9, pe: 22, divYield: 4.5, avgVol: 14e6 },
  { sym: "DVN", name: "Devon Energy Corp.", sector: "Energy", marketCap: 28e9, pe: 9, divYield: 4.2, avgVol: 9e6 },
  // ── Materials ────────────────────────────────────────────────
  { sym: "LIN", name: "Linde plc", sector: "Materials", marketCap: 22e10, pe: 33, divYield: 1.25, avgVol: 16e5 },
  { sym: "SHW", name: "Sherwin-Williams Co.", sector: "Materials", marketCap: 9e10, pe: 35, divYield: 0.8, avgVol: 18e5 },
  { sym: "FCX", name: "Freeport-McMoRan Inc.", sector: "Materials", marketCap: 65e9, pe: 30, divYield: 1.3, avgVol: 16e6 },
  { sym: "ECL", name: "Ecolab Inc.", sector: "Materials", marketCap: 7e10, pe: 38, divYield: 0.9, avgVol: 15e5 },
  { sym: "APD", name: "Air Products & Chemicals", sector: "Materials", marketCap: 65e9, pe: 24, divYield: 2.5, avgVol: 15e5 },
  { sym: "NEM", name: "Newmont Corp.", sector: "Materials", marketCap: 55e9, pe: 18, divYield: 2.1, avgVol: 11e6 },
  { sym: "NUE", name: "Nucor Corp.", sector: "Materials", marketCap: 35e9, pe: 13, divYield: 1.5, avgVol: 25e5 },
  { sym: "DOW", name: "Dow Inc.", sector: "Materials", marketCap: 35e9, pe: 22, divYield: 5.6, avgVol: 6e6 },
  { sym: "DD", name: "DuPont de Nemours Inc.", sector: "Materials", marketCap: 32e9, pe: 25, divYield: 1.9, avgVol: 3e6 },
  { sym: "CTVA", name: "Corteva Inc.", sector: "Materials", marketCap: 42e9, pe: 28, divYield: 1.1, avgVol: 4e6 },
  // ── Real Estate ──────────────────────────────────────────────
  { sym: "PLD", name: "Prologis Inc.", sector: "Real Estate", marketCap: 105e9, pe: 38, divYield: 3.3, avgVol: 5e6 },
  { sym: "AMT", name: "American Tower Corp.", sector: "Real Estate", marketCap: 9e10, pe: 40, divYield: 3.2, avgVol: 25e5 },
  { sym: "EQIX", name: "Equinix Inc.", sector: "Real Estate", marketCap: 85e9, pe: 75, divYield: 2.1, avgVol: 6e5 },
  { sym: "O", name: "Realty Income Corp.", sector: "Real Estate", marketCap: 5e10, pe: 50, divYield: 5.4, avgVol: 5e6 },
  { sym: "SPG", name: "Simon Property Group", sector: "Real Estate", marketCap: 55e9, pe: 22, divYield: 5.1, avgVol: 2e6 },
  { sym: "PSA", name: "Public Storage", sector: "Real Estate", marketCap: 55e9, pe: 28, divYield: 4.1, avgVol: 1e6 },
  { sym: "WELL", name: "Welltower Inc.", sector: "Real Estate", marketCap: 75e9, pe: 90, divYield: 2.3, avgVol: 4e6 },
  { sym: "CCI", name: "Crown Castle Inc.", sector: "Real Estate", marketCap: 45e9, pe: 35, divYield: 5.8, avgVol: 4e6 },
  { sym: "DLR", name: "Digital Realty Trust", sector: "Real Estate", marketCap: 55e9, pe: 60, divYield: 3, avgVol: 2e6 },
  // ── Utilities ────────────────────────────────────────────────
  { sym: "NEE", name: "NextEra Energy Inc.", sector: "Utilities", marketCap: 165e9, pe: 24, divYield: 2.9, avgVol: 12e6 },
  { sym: "SO", name: "Southern Co.", sector: "Utilities", marketCap: 95e9, pe: 21, divYield: 3.4, avgVol: 5e6 },
  { sym: "DUK", name: "Duke Energy Corp.", sector: "Utilities", marketCap: 9e10, pe: 20, divYield: 3.6, avgVol: 4e6 },
  { sym: "D", name: "Dominion Energy Inc.", sector: "Utilities", marketCap: 5e10, pe: 24, divYield: 4.7, avgVol: 6e6 },
  { sym: "AEP", name: "American Electric Power", sector: "Utilities", marketCap: 55e9, pe: 19, divYield: 3.7, avgVol: 4e6 },
  { sym: "EXC", name: "Exelon Corp.", sector: "Utilities", marketCap: 4e10, pe: 17, divYield: 3.6, avgVol: 7e6 },
  { sym: "SRE", name: "Sempra", sector: "Utilities", marketCap: 55e9, pe: 19, divYield: 3.1, avgVol: 4e6 },
  { sym: "XEL", name: "Xcel Energy Inc.", sector: "Utilities", marketCap: 38e9, pe: 19, divYield: 3.4, avgVol: 4e6 },
  { sym: "PEG", name: "Public Service Enterprise", sector: "Utilities", marketCap: 42e9, pe: 21, divYield: 3, avgVol: 3e6 }
];

// src/lib/ta.js
function toNum(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}
__name(toNum, "toNum");
function isFinite_(n) {
  return typeof n === "number" && Number.isFinite(n);
}
__name(isFinite_, "isFinite_");
function sma(values, period) {
  if (!Array.isArray(values) || values.length === 0)
    return [];
  if (!Number.isInteger(period) || period <= 0)
    return values.map(() => NaN);
  const out = new Array(values.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = toNum(values[i]);
    if (isFinite_(v)) {
      sum += v;
      count++;
    }
    if (i >= period) {
      const drop = toNum(values[i - period]);
      if (isFinite_(drop)) {
        sum -= drop;
        count--;
      }
    }
    if (i >= period - 1 && count === period) {
      out[i] = sum / period;
    } else {
      out[i] = NaN;
    }
  }
  return out;
}
__name(sma, "sma");
function ema(values, period) {
  if (!Array.isArray(values) || values.length === 0)
    return [];
  if (!Number.isInteger(period) || period <= 0)
    return values.map(() => NaN);
  const out = new Array(values.length).fill(NaN);
  if (values.length < period)
    return out;
  let sum = 0;
  for (let i = 0; i < period; i++)
    sum += toNum(values[i]);
  const seed = sum / period;
  if (!isFinite_(seed))
    return out;
  out[period - 1] = seed;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    const v = toNum(values[i]);
    if (!isFinite_(v)) {
      out[i] = out[i - 1];
      continue;
    }
    out[i] = (v - out[i - 1]) * k + out[i - 1];
  }
  return out;
}
__name(ema, "ema");
function rsi(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length === 0)
    return [];
  const n = closes.length;
  const out = new Array(n).fill(NaN);
  if (n <= period)
    return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = toNum(closes[i]) - toNum(closes[i - 1]);
    if (diff >= 0)
      avgGain += diff;
    else
      avgLoss += -diff;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = rsiFromAvgs(avgGain, avgLoss);
  for (let i = period + 1; i < n; i++) {
    const diff = toNum(closes[i]) - toNum(closes[i - 1]);
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFromAvgs(avgGain, avgLoss);
  }
  return out;
}
__name(rsi, "rsi");
function rsiFromAvgs(avgGain, avgLoss) {
  if (avgLoss === 0)
    return avgGain === 0 ? 50 : 100;
  if (avgGain === 0)
    return 0;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
__name(rsiFromAvgs, "rsiFromAvgs");
function macd(closes, fast = 12, slow = 26, signal = 9) {
  const n = Array.isArray(closes) ? closes.length : 0;
  const empty = { macdLine: new Array(n).fill(NaN), signalLine: new Array(n).fill(NaN), histogram: new Array(n).fill(NaN) };
  if (n === 0)
    return { macdLine: [], signalLine: [], histogram: [] };
  const efast = ema(closes, fast);
  const eslow = ema(closes, slow);
  const macdLine = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (isFinite_(efast[i]) && isFinite_(eslow[i])) {
      macdLine[i] = efast[i] - eslow[i];
    }
  }
  let startIdx = -1;
  for (let i = 0; i < n; i++) {
    if (isFinite_(macdLine[i])) {
      startIdx = i;
      break;
    }
  }
  const signalLine = new Array(n).fill(NaN);
  if (startIdx >= 0) {
    const sub = macdLine.slice(startIdx);
    const emaSub = ema(sub, signal);
    for (let i = 0; i < emaSub.length; i++) {
      signalLine[startIdx + i] = emaSub[i];
    }
  }
  const histogram = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (isFinite_(macdLine[i]) && isFinite_(signalLine[i])) {
      histogram[i] = macdLine[i] - signalLine[i];
    }
  }
  return { macdLine, signalLine, histogram };
}
__name(macd, "macd");
function bollinger(closes, period = 20, k = 2) {
  if (!Array.isArray(closes) || closes.length === 0) {
    return { upper: [], middle: [], lower: [] };
  }
  const n = closes.length;
  const middle = sma(closes, period);
  const upper = new Array(n).fill(NaN);
  const lower = new Array(n).fill(NaN);
  for (let i = period - 1; i < n; i++) {
    if (!isFinite_(middle[i]))
      continue;
    let sumSq = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = toNum(closes[j]);
      if (!isFinite_(v))
        continue;
      sumSq += (v - middle[i]) ** 2;
      count++;
    }
    if (count !== period)
      continue;
    const sigma = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + k * sigma;
    lower[i] = middle[i] - k * sigma;
  }
  return { upper, middle, lower };
}
__name(bollinger, "bollinger");
function atr(highs, lows, closes, period = 14) {
  if (!Array.isArray(highs) || highs.length === 0)
    return [];
  const n = highs.length;
  const out = new Array(n).fill(NaN);
  if (n <= period)
    return out;
  const tr = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    const h = toNum(highs[i]);
    const l = toNum(lows[i]);
    const pc = toNum(closes[i - 1]);
    if (!isFinite_(h) || !isFinite_(l) || !isFinite_(pc))
      continue;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  let sum = 0;
  for (let i = 1; i <= period; i++) {
    if (!isFinite_(tr[i]))
      return out;
    sum += tr[i];
  }
  out[period] = sum / period;
  for (let i = period + 1; i < n; i++) {
    if (!isFinite_(tr[i])) {
      out[i] = out[i - 1];
      continue;
    }
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}
__name(atr, "atr");
function stoch(highs, lows, closes, kPeriod = 14, dSmooth = 3) {
  if (!Array.isArray(highs) || highs.length === 0)
    return { k: [], d: [] };
  const n = highs.length;
  const k = new Array(n).fill(NaN);
  for (let i = kPeriod - 1; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    let ok = true;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      const h = toNum(highs[j]);
      const l = toNum(lows[j]);
      if (!isFinite_(h) || !isFinite_(l)) {
        ok = false;
        break;
      }
      if (h > hh)
        hh = h;
      if (l < ll)
        ll = l;
    }
    if (!ok)
      continue;
    const c = toNum(closes[i]);
    if (!isFinite_(c))
      continue;
    const range = hh - ll;
    k[i] = range === 0 ? 50 : (c - ll) / range * 100;
  }
  const d = sma(k, dSmooth);
  return { k, d };
}
__name(stoch, "stoch");

// src/lib/gauge.js
function computeSignals(indicators, price) {
  const ind = indicators || {};
  const p = num2(price);
  let trend = "neutral";
  const s20 = num2(ind.sma20), s50 = num2(ind.sma50), s200 = num2(ind.sma200);
  if (finite(p) && finite(s20) && finite(s50) && finite(s200)) {
    if (p > s20 && s20 > s50 && s50 > s200)
      trend = "bullish";
    else if (p < s20 && s20 < s50 && s50 < s200)
      trend = "bearish";
  }
  let momentum = "neutral";
  const rsi2 = num2(ind.rsi14);
  if (finite(rsi2)) {
    if (rsi2 > 70)
      momentum = "overbought";
    else if (rsi2 < 30)
      momentum = "oversold";
  }
  let volatility = "stable";
  const bw = num2(ind.bollinger && ind.bollinger.bandwidth);
  if (finite(bw)) {
    if (bw > 0.15)
      volatility = "expanding";
    else if (bw < 0.05)
      volatility = "contracting";
  }
  let ma_cross = "none";
  if (finite(s50) && finite(s200) && s200 !== 0) {
    const diffPct = (s50 - s200) / s200;
    if (diffPct >= 5e-3)
      ma_cross = "golden";
    else if (diffPct <= -5e-3)
      ma_cross = "death";
  }
  return { trend, momentum, volatility, ma_cross };
}
__name(computeSignals, "computeSignals");
function scoreFromTrend(trend) {
  if (trend === "bullish")
    return 80;
  if (trend === "bearish")
    return 20;
  return 50;
}
__name(scoreFromTrend, "scoreFromTrend");
function scoreFromMaCross(ma_cross) {
  if (ma_cross === "golden")
    return 85;
  if (ma_cross === "death")
    return 15;
  return 50;
}
__name(scoreFromMaCross, "scoreFromMaCross");
function scoreFromMomentum(indicators) {
  const m = indicators && indicators.macd;
  if (!m)
    return 50;
  const h = num2(m.histogram);
  if (!finite(h))
    return 50;
  const atr2 = num2(indicators.atr14);
  const scale = finite(atr2) && atr2 > 0 ? atr2 : Math.max(Math.abs(num2(m.macd) || 1), 1e-3);
  const norm = Math.max(-1, Math.min(1, h / scale));
  return 50 + norm * 30;
}
__name(scoreFromMomentum, "scoreFromMomentum");
function scoreFromRsi(rsi2) {
  const r = num2(rsi2);
  if (!finite(r))
    return 50;
  if (r <= 20)
    return 95;
  if (r <= 30)
    return 95 - (r - 20) / 10 * 20;
  if (r <= 50)
    return 75 - (r - 30) / 20 * 25;
  if (r <= 70)
    return 50 + (r - 50) / 20 * 25;
  if (r <= 80)
    return 75 - (r - 70) / 10 * 45;
  return 15;
}
__name(scoreFromRsi, "scoreFromRsi");
function scoreFromVolatility(volatility) {
  if (volatility === "expanding")
    return 60;
  if (volatility === "contracting")
    return 45;
  return 50;
}
__name(scoreFromVolatility, "scoreFromVolatility");
var WEIGHTS = {
  trend: 0.35,
  momentum: 0.25,
  macross: 0.2,
  rsi: 0.15,
  volatility: 0.05
};
var LABEL_BANDS = [
  { min: 0, max: 15, label: "Strong Sell" },
  { min: 15, max: 30, label: "Sell" },
  { min: 30, max: 45, label: "Bearish" },
  { min: 45, max: 55, label: "Neutral" },
  { min: 55, max: 70, label: "Bullish" },
  { min: 70, max: 85, label: "Buy" },
  { min: 85, max: 101, label: "Strong Buy" }
];
function labelForScore(score) {
  for (const b of LABEL_BANDS) {
    if (score >= b.min && score < b.max)
      return b.label;
  }
  return "Neutral";
}
__name(labelForScore, "labelForScore");
function computeGauge(signals, indicators) {
  const sig = signals || {};
  const ind = indicators || {};
  const components = {
    trend: scoreFromTrend(sig.trend),
    momentum: scoreFromMomentum(ind),
    volatility: scoreFromVolatility(sig.volatility),
    macross: scoreFromMaCross(sig.ma_cross),
    rsi: scoreFromRsi(ind.rsi14)
  };
  let weighted = components.trend * WEIGHTS.trend + components.momentum * WEIGHTS.momentum + components.volatility * WEIGHTS.volatility + components.macross * WEIGHTS.macross + components.rsi * WEIGHTS.rsi;
  weighted = Math.max(0, Math.min(100, weighted));
  const score = Math.round(weighted);
  return { score, label: labelForScore(score), components };
}
__name(computeGauge, "computeGauge");
function buildRationale(signals, indicators, price) {
  const sig = signals || {};
  const ind = indicators || {};
  const out = [];
  if (sig.trend === "bullish") {
    out.push("Price above SMA20, SMA50, and SMA200 \u2014 established uptrend.");
  } else if (sig.trend === "bearish") {
    out.push("Price below SMA20, SMA50, and SMA200 \u2014 established downtrend.");
  } else {
    out.push("Mixed moving-average stack \u2014 no clean trend on this timeframe.");
  }
  const m = ind.macd || {};
  const hist = num2(m.histogram);
  if (finite(hist)) {
    if (hist > 0) {
      out.push("MACD histogram positive (" + hist.toFixed(2) + ") \u2014 short-term momentum on the buy side.");
    } else if (hist < 0) {
      out.push("MACD histogram negative (" + hist.toFixed(2) + ") \u2014 short-term momentum on the sell side.");
    } else {
      out.push("MACD histogram near zero \u2014 momentum indecisive.");
    }
  }
  const rsi2 = num2(ind.rsi14);
  if (finite(rsi2)) {
    if (sig.momentum === "overbought") {
      out.push("RSI " + rsi2.toFixed(0) + " is overbought (>70) \u2014 reversion risk elevated.");
    } else if (sig.momentum === "oversold") {
      out.push("RSI " + rsi2.toFixed(0) + " is oversold (<30) \u2014 bounce setup possible.");
    } else {
      out.push("RSI " + rsi2.toFixed(0) + " is mid-range \u2014 neither overbought nor oversold.");
    }
  }
  if (sig.volatility === "expanding") {
    out.push("Bollinger bandwidth expanding \u2014 volatility regime widening.");
  } else if (sig.volatility === "contracting") {
    out.push("Bollinger bandwidth contracting \u2014 coiled range, breakout watch.");
  }
  const substantive = out.slice(0, 4);
  substantive.push(
    "Informational only \u2014 derived from TA primitives, not a forecast. Past performance is no guarantee of future results."
  );
  return substantive;
}
__name(buildRationale, "buildRationale");
function num2(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}
__name(num2, "num");
function finite(n) {
  return typeof n === "number" && Number.isFinite(n);
}
__name(finite, "finite");

// src/handlers.js
var FX_CACHE_KEY = "fx:USD";
var FX_TTL_MS = 6e4;
var FXH_TTL_MS = 18e5;
var QUOTES_TTL_MS = 6e4;
var CANDLES_TTL_MS = 6e5;
var NEWS_TTL_MS = 6e5;
var TF_MAP = {
  "1W": { yahooRange: "5d", rows: 7 },
  "1M": { yahooRange: "1mo", rows: 23 },
  "3M": { yahooRange: "3mo", rows: 65 },
  "6M": { yahooRange: "6mo", rows: 130 },
  "1Y": { yahooRange: "1y", rows: 260 }
};
async function handleQuotes(env, syms) {
  if (!Array.isArray(syms) || syms.length === 0) {
    throw new Error("handleQuotes: syms must be a non-empty array");
  }
  const cacheKey = "q:" + syms.join(",");
  const fresh = await getCached(env.FT_KV, cacheKey, QUOTES_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }
  try {
    const data = await fetchQuotesWithFallback(env, syms);
    await setCached(env.FT_KV, cacheKey, data);
    return { data, cached: false };
  } catch (fetchErr) {
    const stale = await getCached(env.FT_KV, cacheKey, QUOTES_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw fetchErr;
  }
}
__name(handleQuotes, "handleQuotes");
async function fetchQuotesWithFallback(env, syms) {
  const resolved = /* @__PURE__ */ new Map();
  const errors = [];
  try {
    const yahooResults = await fetchYahooQuotes(syms);
    for (const q of yahooResults)
      resolved.set(q.sym, q);
  } catch (e) {
    errors.push("yahoo: " + (e.message || String(e)));
  }
  const missing = syms.filter((s) => !resolved.has(s));
  if (missing.length > 0) {
    try {
      const stooqResults = await fetchStooqQuotes(missing);
      for (const q of stooqResults)
        resolved.set(q.sym, q);
    } catch (e) {
      errors.push("stooq: " + (e.message || String(e)));
    }
  }
  const stillMissing = syms.filter((s) => !resolved.has(s));
  if (stillMissing.length > 0 && env.FINNHUB_KEY) {
    try {
      const finnhubResults = await fetchFinnhubQuotes(stillMissing, env.FINNHUB_KEY);
      for (const q of finnhubResults)
        resolved.set(q.sym, q);
    } catch (e) {
      errors.push("finnhub: " + (e.message || String(e)));
    }
  }
  if (resolved.size === 0) {
    throw new Error("all quote sources failed: " + errors.join(" | "));
  }
  return syms.map((s) => resolved.get(s)).filter(Boolean);
}
__name(fetchQuotesWithFallback, "fetchQuotesWithFallback");
async function handleCandles(env, sym, tf) {
  const symbol = String(sym || "").trim().toUpperCase();
  if (!symbol)
    throw new Error("handleCandles: sym is required");
  const timeframe = TF_MAP[tf] ? tf : "3M";
  const { yahooRange, rows } = TF_MAP[timeframe];
  const cacheKey = "candle:" + symbol + ":" + timeframe;
  const fresh = await getCached(env.FT_KV, cacheKey, CANDLES_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }
  try {
    const candles = await fetchCandlesWithFallback(symbol, yahooRange, rows);
    const data = { sym: symbol, tf: timeframe, candles };
    await setCached(env.FT_KV, cacheKey, data);
    return { data, cached: false };
  } catch (fetchErr) {
    const stale = await getCached(env.FT_KV, cacheKey, CANDLES_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw fetchErr;
  }
}
__name(handleCandles, "handleCandles");
async function fetchCandlesWithFallback(symbol, yahooRange, rows) {
  const errors = [];
  try {
    return await fetchYahooCandles(symbol, yahooRange);
  } catch (e) {
    errors.push("yahoo: " + (e.message || String(e)));
  }
  try {
    return await fetchStooqCandles(symbol, rows);
  } catch (e) {
    errors.push("stooq: " + (e.message || String(e)));
  }
  throw new Error("all candle sources failed: " + errors.join(" | "));
}
__name(fetchCandlesWithFallback, "fetchCandlesWithFallback");
async function handleNews(env, topic) {
  const t = String(topic || "").trim() || "market";
  const cacheKey = "news:" + t;
  const fresh = await getCached(env.FT_KV, cacheKey, NEWS_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }
  try {
    const data = await fetchNews(t, env);
    await setCached(env.FT_KV, cacheKey, data);
    return { data, cached: false };
  } catch (fetchErr) {
    const stale = await getCached(env.FT_KV, cacheKey, NEWS_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw fetchErr;
  }
}
__name(handleNews, "handleNews");
var CRYPTO_CACHE_KEY = "crypto";
var CRYPTO_TTL_MS = 12e4;
async function handleCrypto(env) {
  const fresh = await getCached(env.FT_KV, CRYPTO_CACHE_KEY, CRYPTO_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }
  try {
    const [coins, global] = await Promise.all([
      fetchCoinGeckoMarkets(),
      fetchCoinGeckoGlobal()
    ]);
    const data = { coins, global };
    await setCached(env.FT_KV, CRYPTO_CACHE_KEY, data);
    return { data, cached: false };
  } catch (fetchErr) {
    const stale = await getCached(env.FT_KV, CRYPTO_CACHE_KEY, CRYPTO_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw fetchErr;
  }
}
__name(handleCrypto, "handleCrypto");
var AGG_TTL_MS = 6e4;
var SECTOR_NAMES = {
  XLK: "Technology",
  XLV: "Health Care",
  XLF: "Financials",
  XLY: "Consumer Disc.",
  XLI: "Industrials",
  XLC: "Comm. Services",
  XLP: "Consumer Staples",
  XLE: "Energy",
  XLB: "Materials",
  XLRE: "Real Estate",
  XLU: "Utilities"
};
var SECTOR_SYMS = Object.keys(SECTOR_NAMES);
var YIELD_NAMES = {
  SHY: "1-3 Year Treasury",
  IEI: "3-7 Year Treasury",
  IEF: "7-10 Year Treasury",
  TLT: "20+ Year Treasury",
  TIP: "TIPS (Inflation)"
};
var YIELD_SYMS = Object.keys(YIELD_NAMES);
var ECON_CURRENCIES = ["EUR", "GBP", "JPY", "CHF", "AUD", "CAD"];
var FUTURES_NAMES = {
  SPY: "S&P 500 (ES)",
  QQQ: "Nasdaq 100 (NQ)",
  DIA: "Dow Jones (YM)",
  IWM: "Russell 2000 (RTY)",
  GLD: "Gold (GC)",
  SLV: "Silver (SI)",
  USO: "Crude Oil (CL)",
  UNG: "Natural Gas (NG)",
  DBA: "Agriculture (DBA)"
};
var FUTURES_SYMS = Object.keys(FUTURES_NAMES);
function shapeRows(quotes, nameMap) {
  const bySym = new Map((quotes || []).map((q) => [q.sym, q]));
  const out = [];
  for (const sym of Object.keys(nameMap)) {
    const q = bySym.get(sym);
    if (!q)
      continue;
    out.push({
      sym,
      name: nameMap[sym],
      price: q.price,
      chg: q.chg,
      chgPct: q.chgPct
    });
  }
  return out;
}
__name(shapeRows, "shapeRows");
async function aggViaCache(env, cacheKey, builder) {
  const fresh = await getCached(env.FT_KV, cacheKey, AGG_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }
  try {
    const data = await builder();
    await setCached(env.FT_KV, cacheKey, data);
    return { data, cached: false };
  } catch (err) {
    const stale = await getCached(env.FT_KV, cacheKey, AGG_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw err;
  }
}
__name(aggViaCache, "aggViaCache");
async function handleSectors(env) {
  return aggViaCache(env, "sectors", async () => {
    const { data } = await handleQuotes(env, SECTOR_SYMS);
    return shapeRows(data, SECTOR_NAMES);
  });
}
__name(handleSectors, "handleSectors");
async function handleEconomy(env) {
  return aggViaCache(env, "economy", async () => {
    const [{ data: quotes }, { data: fx }] = await Promise.all([
      handleQuotes(env, YIELD_SYMS),
      handleFx(env)
    ]);
    const yields = shapeRows(quotes, YIELD_NAMES);
    const rates = fx && fx.rates || {};
    const currencies = ECON_CURRENCIES.filter((c) => typeof rates[c] === "number").map((c) => ({ pair: "USD/" + c, rate: rates[c], inverse: 1 / rates[c] }));
    return { yields, currencies };
  });
}
__name(handleEconomy, "handleEconomy");
async function handleFutures(env) {
  return aggViaCache(env, "futures", async () => {
    const { data } = await handleQuotes(env, FUTURES_SYMS);
    return shapeRows(data, FUTURES_NAMES);
  });
}
__name(handleFutures, "handleFutures");
var SCREENER_TTL_MS = 3e5;
var SCREENER_MAX_ROWS = 40;
var SECTOR_ALIASES = {
  "technology": "technology",
  "health care": "healthcare",
  "healthcare": "healthcare",
  "financials": "financials",
  "financial services": "financials",
  "consumer discretionary": "consumer discretionary",
  "consumer cyclical": "consumer discretionary",
  "industrials": "industrials",
  "communication services": "communication services",
  "consumer staples": "consumer staples",
  "consumer defensive": "consumer staples",
  "energy": "energy",
  "materials": "materials",
  "basic materials": "materials",
  "real estate": "real estate",
  "utilities": "utilities"
};
function canonSector(s) {
  const k = String(s || "").trim().toLowerCase();
  return SECTOR_ALIASES[k] || k;
}
__name(canonSector, "canonSector");
var SCREENER_PRESETS = {
  "Large Cap": { test: (r) => r.marketCap >= 1e10 },
  "Mega Cap": { test: (r) => r.marketCap >= 2e11 },
  "Value (P/E<15)": { test: (r) => r.pe != null && r.pe <= 15 && r.marketCap >= 2e9 },
  "Small Cap": { test: (r) => r.marketCap >= 3e8 && r.marketCap <= 2e10 },
  "High Volume": { test: (r) => r.avgVol >= 5e6 },
  "High Dividend": { test: (r) => r.divYield >= 3 },
  "Growth": { test: (r) => r.pe != null && r.pe >= 25 && r.marketCap >= 1e10 },
  "Tech Giants": { test: (r) => canonSector(r.sector) === "technology" && r.marketCap >= 2e11 },
  "Big Movers": { test: () => true, needsLive: true }
};
function stableScreenerKey(params) {
  const norm = {
    preset: String(params.preset || ""),
    minMcap: Number(params.minMcap) || 0,
    maxPe: Number(params.maxPe) || 0,
    sector: canonSector(params.sector || ""),
    minDiv: Number(params.minDiv) || 0,
    dayChange: String(params.dayChange || "")
  };
  return "screener:" + Object.keys(norm).sort().map((k) => k + "=" + norm[k]).join("&");
}
__name(stableScreenerKey, "stableScreenerKey");
async function handleScreener(env, params = {}) {
  const cacheKey = stableScreenerKey(params);
  const fresh = await getCached(env.FT_KV, cacheKey, SCREENER_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }
  try {
    const data = await buildScreener(env, params);
    await setCached(env.FT_KV, cacheKey, data);
    return { data, cached: false };
  } catch (err) {
    const stale = await getCached(env.FT_KV, cacheKey, SCREENER_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw err;
  }
}
__name(handleScreener, "handleScreener");
async function buildScreener(env, params) {
  const minMcap = Number(params.minMcap) || 0;
  const maxPe = Number(params.maxPe) || 0;
  const sector = canonSector(params.sector || "");
  const minDiv = Number(params.minDiv) || 0;
  const dayChange = String(params.dayChange || "");
  const preset = params.preset ? SCREENER_PRESETS[params.preset] : null;
  const presetTest = preset ? preset.test : null;
  const needsLive = preset && preset.needsLive || dayChange === "big" || dayChange === "up" || dayChange === "down";
  const filtered = SCREENER_UNIVERSE.filter((r) => {
    if (presetTest && !presetTest(r))
      return false;
    if (minMcap && r.marketCap < minMcap)
      return false;
    if (maxPe) {
      if (r.pe == null || r.pe > maxPe)
        return false;
    }
    if (sector && canonSector(r.sector) !== sector)
      return false;
    if (minDiv && r.divYield < minDiv)
      return false;
    return true;
  });
  const capped = filtered.slice().sort((a, b) => b.marketCap - a.marketCap).slice(0, SCREENER_MAX_ROWS);
  if (capped.length === 0)
    return [];
  let quoteBySym = /* @__PURE__ */ new Map();
  try {
    const { data: quotes } = await handleQuotes(env, capped.map((r) => r.sym));
    quoteBySym = new Map((quotes || []).map((q) => [q.sym, q]));
  } catch (e) {
    throw new Error("quote enrichment failed: " + (e.message || String(e)));
  }
  let rows = capped.map((r) => {
    const q = quoteBySym.get(r.sym);
    return {
      sym: r.sym,
      name: r.name,
      sector: r.sector,
      marketCap: r.marketCap,
      pe: r.pe,
      divYield: r.divYield,
      price: q ? q.price : null,
      chgPct: q ? q.chgPct : null
    };
  });
  if (needsLive) {
    rows = rows.filter((r) => {
      if (r.chgPct == null)
        return false;
      if (params.preset === "Big Movers" || dayChange === "big") {
        return Math.abs(r.chgPct) >= 3;
      }
      if (dayChange === "up")
        return r.chgPct > 0;
      if (dayChange === "down")
        return r.chgPct < 0;
      return true;
    });
  }
  return rows;
}
__name(buildScreener, "buildScreener");
async function handleFx(env) {
  const fresh = await getCached(env.FT_KV, FX_CACHE_KEY, FX_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }
  try {
    const data = await fetchFx();
    await setCached(env.FT_KV, FX_CACHE_KEY, data);
    return { data, cached: false };
  } catch (fetchErr) {
    const stale = await getCached(env.FT_KV, FX_CACHE_KEY, FX_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw fetchErr;
  }
}
__name(handleFx, "handleFx");
var ANALYZE_TTL_MS = 6e4;
async function handleAnalyze(env, sym, tf) {
  const symbol = String(sym || "").trim().toUpperCase();
  if (!symbol)
    throw new Error("handleAnalyze: sym is required");
  const timeframe = TF_MAP[tf] ? tf : "3M";
  const cacheKey = "analyze:" + symbol + ":" + timeframe;
  const fresh = await getCached(env.FT_KV, cacheKey, ANALYZE_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }
  try {
    const data = await buildAnalyze(env, symbol, timeframe);
    await setCached(env.FT_KV, cacheKey, data);
    return { data, cached: false };
  } catch (err) {
    const stale = await getCached(env.FT_KV, cacheKey, ANALYZE_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw err;
  }
}
__name(handleAnalyze, "handleAnalyze");
async function buildAnalyze(env, sym, tf) {
  const { data: candleData } = await handleCandles(env, sym, tf);
  const candles = candleData && candleData.candles || [];
  if (candles.length === 0) {
    throw new Error("analyze: no candles for " + sym + " " + tf);
  }
  const closes = candles.map((k) => k.c);
  const highs = candles.map((k) => k.h);
  const lows = candles.map((k) => k.l);
  const n = closes.length;
  const lastIdx = n - 1;
  const price = closes[lastIdx];
  const prevClose = n >= 2 ? closes[lastIdx - 1] : price;
  const chgPct = prevClose ? (price - prevClose) / prevClose * 100 : 0;
  const rsiSer = rsi(closes, 14);
  const macdRes = macd(closes, 12, 26, 9);
  const sma20Ser = sma(closes, 20);
  const sma50Ser = sma(closes, 50);
  const sma200Ser = sma(closes, 200);
  const ema20Ser = ema(closes, 20);
  const ema50Ser = ema(closes, 50);
  const bollRes = bollinger(closes, 20, 2);
  const atrSer = atr(highs, lows, closes, 14);
  const stochRes = stoch(highs, lows, closes, 14, 3);
  function lastFinite(arr, fallback) {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (typeof arr[i] === "number" && Number.isFinite(arr[i]))
        return arr[i];
    }
    return fallback;
  }
  __name(lastFinite, "lastFinite");
  const middleLast = lastFinite(bollRes.middle, price);
  const upperLast = lastFinite(bollRes.upper, price);
  const lowerLast = lastFinite(bollRes.lower, price);
  const bandwidth = middleLast ? (upperLast - lowerLast) / middleLast : 0;
  const indicators = {
    rsi14: round2(lastFinite(rsiSer, 50)),
    macd: {
      macd: round4(lastFinite(macdRes.macdLine, 0)),
      signal: round4(lastFinite(macdRes.signalLine, 0)),
      histogram: round4(lastFinite(macdRes.histogram, 0))
    },
    sma20: round2(lastFinite(sma20Ser, price)),
    sma50: round2(lastFinite(sma50Ser, price)),
    sma200: round2(lastFinite(sma200Ser, price)),
    ema20: round2(lastFinite(ema20Ser, price)),
    ema50: round2(lastFinite(ema50Ser, price)),
    bollinger: {
      upper: round2(upperLast),
      middle: round2(middleLast),
      lower: round2(lowerLast),
      bandwidth: round4(bandwidth)
    },
    atr14: round2(lastFinite(atrSer, 0)),
    stoch: {
      k: round2(lastFinite(stochRes.k, 50)),
      d: round2(lastFinite(stochRes.d, 50))
    }
  };
  const signals = computeSignals(indicators, price);
  const gauge = computeGauge(signals, indicators);
  const rationale = buildRationale(signals, indicators, price);
  const dev = Math.abs(gauge.score - 50) / 50;
  let direction;
  if (gauge.score >= 55)
    direction = "up";
  else if (gauge.score <= 45)
    direction = "down";
  else
    direction = "sideways";
  const volPenalty = Math.min(0.3, Math.max(0, indicators.bollinger.bandwidth || 0));
  const confidence = Math.round(Math.max(0.1, Math.min(0.9, dev - volPenalty * 0.5)) * 100) / 100;
  const horizon = tf === "1W" || tf === "1M" ? "1w" : "1m";
  const prediction = {
    direction,
    confidence,
    horizon,
    rationale,
    method: "ensemble"
  };
  return {
    sym,
    tf,
    asOf: Date.now(),
    price: round2(price),
    chgPct: round2(chgPct),
    indicators,
    signals,
    gauge,
    prediction
  };
}
__name(buildAnalyze, "buildAnalyze");
function round2(n) {
  if (typeof n !== "number" || !Number.isFinite(n))
    return 0;
  return Math.round(n * 100) / 100;
}
__name(round2, "round2");
function round4(n) {
  if (typeof n !== "number" || !Number.isFinite(n))
    return 0;
  return Math.round(n * 1e4) / 1e4;
}
__name(round4, "round4");
async function handleFxHistory(env, from, to, days) {
  const f = String(from || "USD").toUpperCase();
  const t = String(to || "EUR").toUpperCase();
  const d = Math.max(1, Math.min(730, +days || 30));
  const key = `fxh:${f}-${t}-${d}`;
  const fresh = await getCached(env.FT_KV, key, FXH_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }
  try {
    const data = await fetchFxHistory(f, t, d);
    await setCached(env.FT_KV, key, data);
    return { data, cached: false };
  } catch (fetchErr) {
    const stale = await getCached(env.FT_KV, key, FXH_TTL_MS, { allowStale: true });
    if (stale)
      return { data: stale.data, cached: true, stale: true };
    throw fetchErr;
  }
}
__name(handleFxHistory, "handleFxHistory");

// src/index.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Finnhub-Secret"
};
function json(data, { status = 200, error = null, cached = false } = {}) {
  const body = JSON.stringify({
    ok: error == null,
    data: data ?? null,
    error: error ?? null,
    ts: Date.now(),
    cached
  });
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS
    }
  });
}
__name(json, "json");
function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
__name(handleOptions, "handleOptions");
function handleHealth() {
  return json({ status: "ok", name: "rz-finance-gateway" });
}
__name(handleHealth, "handleHealth");
var PREWARM_INDEX_SYMS = ["SPY", "QQQ", "DIA", "IWM", "GLD", "TLT", "USO", "VGK"];
async function prewarm(env) {
  return Promise.allSettled([
    handleFx(env),
    handleFxHistory(env, "USD", "EUR", 30),
    handleQuotes(env, PREWARM_INDEX_SYMS),
    handleNews(env, "market"),
    handleCrypto(env),
    handleSectors(env),
    handleFutures(env),
    handleAnalyze(env, "SPY", "3M"),
    handleAnalyze(env, "QQQ", "3M"),
    handleAnalyze(env, "GLD", "3M")
  ]);
}
__name(prewarm, "prewarm");
var src_default = {
  async fetch(request, env, ctx) {
    try {
      const { method } = request;
      const { pathname } = new URL(request.url);
      if (method === "OPTIONS")
        return handleOptions();
      if (pathname === "/health")
        return handleHealth();
      if (pathname === "/fx") {
        try {
          const { data, cached } = await handleFx(env);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: "fx: " + String(e) });
        }
      }
      if (pathname === "/fx-history") {
        const p = new URL(request.url).searchParams;
        try {
          const { data, cached } = await handleFxHistory(env, p.get("from") || "USD", p.get("to") || "EUR", +p.get("days") || 30);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: "fx-history: " + String(e) });
        }
      }
      if (pathname === "/q") {
        const syms = new URL(request.url).searchParams.get("syms");
        try {
          const { data, cached } = await handleQuotes(env, (syms || "").split(",").filter(Boolean));
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: "q: " + String(e) });
        }
      }
      if (pathname === "/candles") {
        const p = new URL(request.url).searchParams;
        try {
          const { data, cached } = await handleCandles(env, p.get("sym"), p.get("tf") || "3M");
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: "candles: " + String(e) });
        }
      }
      if (pathname === "/news") {
        const t = new URL(request.url).searchParams.get("topic");
        try {
          const { data, cached } = await handleNews(env, t || "market");
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: "news: " + String(e) });
        }
      }
      if (pathname === "/sectors") {
        try {
          const { data, cached } = await handleSectors(env);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: "sectors: " + String(e) });
        }
      }
      if (pathname === "/economy") {
        try {
          const { data, cached } = await handleEconomy(env);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: "economy: " + String(e) });
        }
      }
      if (pathname === "/futures") {
        try {
          const { data, cached } = await handleFutures(env);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: "futures: " + String(e) });
        }
      }
      if (pathname === "/crypto") {
        try {
          const { data, cached } = await handleCrypto(env);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: "crypto: " + String(e) });
        }
      }
      if (pathname === "/analyze") {
        const p = new URL(request.url).searchParams;
        try {
          const { data, cached } = await handleAnalyze(env, p.get("sym") || "SPY", p.get("tf") || "3M");
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: "analyze: " + String(e) });
        }
      }
      if (pathname === "/screener") {
        const p = new URL(request.url).searchParams;
        try {
          const { data, cached } = await handleScreener(env, {
            preset: p.get("preset"),
            minMcap: +p.get("minMcap") || 0,
            maxPe: +p.get("maxPe") || 0,
            sector: p.get("sector") || "",
            minDiv: +p.get("minDiv") || 0,
            dayChange: p.get("dayChange") || ""
          });
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: "screener: " + String(e) });
        }
      }
      return json(null, { status: 404, error: "not found" });
    } catch (e) {
      return json(null, { status: 500, error: String(e) });
    }
  },
  // Task 1.9 — cron handler (wrangler.toml [triggers] crons = */2 * * * *).
  // Fans the warm-up out via prewarm() inside ctx.waitUntil so the tick
  // never blocks/throws (Promise.allSettled isolates per-source failures).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(prewarm(env));
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-zNYcbm/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-zNYcbm/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default,
  prewarm
};
//# sourceMappingURL=index.js.map
