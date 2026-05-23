import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleFx, handleQuotes, handleCandles, handleNews, handleSectors, handleEconomy, handleFutures, handleScreener, handleCrypto, handleAnalyze } from '../src/handlers.js';
import { setCached } from '../src/cache.js';

function fakeKV() {
  const m = new Map();
  return {
    store: m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); },
  };
}

// Helper: build a valid open.er-api response
function erApiResponse(rates) {
  return JSON.stringify({
    result: 'success',
    time_last_update_utc: 'Mon, 19 May 2026 00:00:00 +0000',
    base_code: 'USD',
    rates: rates || { EUR: 0.92, GBP: 0.78, JPY: 149.5 },
  });
}

// Test A: first source (Frankfurter) fails, second source (open.er-api) returns valid
// handleFx should resolve with data.base==='USD', data.rates.EUR a number, and cache populated.
test('Test A: falls through to open.er-api when Frankfurter fails; caches result', async () => {
  const kv = fakeKV();
  let fetchCallCount = 0;
  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    fetchCallCount++;
    if (String(url).includes('frankfurter.app')) {
      // Simulate Frankfurter returning a 500
      return { ok: false, status: 500 };
    }
    if (String(url).includes('open.er-api.com')) {
      return {
        ok: true,
        json: async () => JSON.parse(erApiResponse()),
      };
    }
    // Should not reach exchangerate.host in this test
    throw new Error('unexpected fetch: ' + url);
  };

  try {
    const result = await handleFx({ FT_KV: kv });
    assert.equal(result.data.base, 'USD');
    assert.equal(typeof result.data.rates.EUR, 'number');
    assert.ok(typeof result.data.date === 'string', 'date should be a string');
    assert.equal(result.cached, false);

    // Verify value was cached in KV
    const raw = kv.store.get('fx:USD');
    assert.ok(raw != null, 'fx:USD should be present in KV after cache write');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test B: cache pre-populated fresh → handleFx returns cached:true WITHOUT calling fetch
test('Test B: fresh cache hit returns cached:true without calling fetch', async () => {
  const kv = fakeKV();
  const cachedData = { base: 'USD', date: '2026-05-19', rates: { EUR: 0.91, GBP: 0.77 } };
  await setCached(kv, 'fx:USD', cachedData);

  let fetchCalled = false;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalled = true; return { ok: false }; };

  try {
    const result = await handleFx({ FT_KV: kv });
    assert.equal(fetchCalled, false, 'fetch must not be called on fresh cache hit');
    assert.equal(result.cached, true);
    assert.deepEqual(result.data, cachedData);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test C: all sources fail BUT stale cache exists → returns stale:true with the stale data
test('Test C: all sources fail with stale cache → returns stale:true', async () => {
  const kv = fakeKV();
  const staleData = { base: 'USD', date: '2026-05-18', rates: { EUR: 0.90, GBP: 0.76 } };
  // Write stale entry (TTL -1 forces it to appear expired)
  // We manually write the raw KV value with an old timestamp
  const oldTs = Date.now() - 120_000; // 2 minutes ago → expired at 60s TTL
  kv.store.set('fx:USD', JSON.stringify({ d: staleData, t: oldTs }));

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    // All sources fail
    throw new Error('network unavailable');
  };

  try {
    const result = await handleFx({ FT_KV: kv });
    assert.equal(result.stale, true, 'should return stale:true');
    assert.deepEqual(result.data, staleData, 'should return stale data');
    assert.equal(result.cached, true);
  } finally {
    globalThis.fetch = origFetch;
  }
});

/* ═══════════════════════════════════════════════════════════════
   handleQuotes tests (Task 1.2)
   ═══════════════════════════════════════════════════════════════ */

// Helper: build a Yahoo Finance v7 quote API response
function yahooQuoteResponse(symbols) {
  const result = symbols.map(sym => ({
    symbol: sym,
    regularMarketPrice: sym === 'SPY' ? 520.12 : 440.55,
    regularMarketChange: sym === 'SPY' ? 2.34 : -1.20,
    regularMarketChangePercent: sym === 'SPY' ? 0.45 : -0.27,
    regularMarketPreviousClose: sym === 'SPY' ? 517.78 : 441.75,
  }));
  return JSON.stringify({ quoteResponse: { result, error: null } });
}

// Helper: build a Stooq single-row quote CSV WITH the Prev (prior-close)
// field — this is the real production primary path:
//   https://stooq.com/q/l/?s=<sym>.us&f=sd2t2ohlcvp&h&e=csv
// Columns: Symbol,Date,Time,Open,High,Low,Close,Volume,Prev
function stooqQuoteWithPrevResponse(sym, prevClose, lastClose) {
  return 'Symbol,Date,Time,Open,High,Low,Close,Volume,Prev\n' +
    `${sym.toUpperCase()}.US,2026-05-18,22:00:24,${lastClose - 1},${lastClose + 2},${lastClose - 2},${lastClose},47843865,${prevClose}\n`;
}

// Test D: Yahoo stub returns 2 symbols → handleQuotes returns array len 2 with numeric fields + caches in KV
test('Test D: Yahoo returns 2 symbols → handleQuotes returns numeric array + caches', async () => {
  const kv = fakeKV();
  const syms = ['SPY', 'QQQ'];
  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('query1.finance.yahoo.com')) {
      return { ok: true, json: async () => JSON.parse(yahooQuoteResponse(syms)) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const result = await handleQuotes({ FT_KV: kv }, syms);
    assert.equal(Array.isArray(result.data), true, 'data should be array');
    assert.equal(result.data.length, 2, 'should have 2 entries');
    assert.equal(result.cached, false, 'first fetch should not be cached');

    // Verify numeric fields (not strings)
    for (const q of result.data) {
      assert.equal(typeof q.sym, 'string', 'sym should be string');
      assert.equal(typeof q.price, 'number', 'price should be number');
      assert.equal(typeof q.chg, 'number', 'chg should be number');
      assert.equal(typeof q.chgPct, 'number', 'chgPct should be number');
      assert.equal(typeof q.prevClose, 'number', 'prevClose should be number');
    }

    // Verify SPY values
    const spy = result.data.find(q => q.sym === 'SPY');
    assert.ok(spy, 'SPY should be in result');
    assert.equal(spy.price, 520.12);
    assert.equal(spy.chg, 2.34);

    // Verify KV was populated
    const cacheKey = 'q:SPY,QQQ';
    const raw = kv.store.get(cacheKey);
    assert.ok(raw != null, 'quotes should be cached in KV');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test E: Yahoo throws, Stooq CSV stub returns → fallback works for both symbols
test('Test E: Yahoo fails → Stooq CSV fallback resolves symbols', async () => {
  const kv = fakeKV();
  const syms = ['SPY', 'QQQ'];
  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('query1.finance.yahoo.com')) {
      throw new Error('Yahoo unavailable');
    }
    if (u.includes('stooq.com') && u.includes('f=sd2t2ohlcvp')) {
      // Primary Stooq path: single-row quote WITH Prev field.
      // Detect which symbol from URL (spy.us or qqq.us).
      const isSpy = u.includes('spy.us');
      // SPY: prevClose 515 → last 520 (+0.97%). QQQ: prevClose 441.75 → last 438 (-0.85%)
      const sym = isSpy ? 'spy' : 'qqq';
      const prevClose = isSpy ? 515.00 : 441.75;
      const lastClose = isSpy ? 520.00 : 438.00;
      return { ok: true, text: async () => stooqQuoteWithPrevResponse(sym, prevClose, lastClose) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const result = await handleQuotes({ FT_KV: kv }, syms);
    assert.equal(Array.isArray(result.data), true, 'data should be array');
    assert.equal(result.data.length, 2, 'both symbols should resolve via Stooq');
    assert.equal(result.cached, false);

    // Prices numeric AND chgPct must be a real non-zero number (Stooq self-sufficient)
    for (const q of result.data) {
      assert.equal(typeof q.price, 'number');
      assert.equal(typeof q.chgPct, 'number');
      assert.notEqual(q.chgPct, 0, q.sym + ' chgPct must NOT be 0 from Stooq Prev field');
      assert.ok(q.prevClose > 0, q.sym + ' prevClose should be > 0');
    }

    const spy = result.data.find(q => q.sym === 'SPY');
    assert.equal(spy.price, 520.0);
    assert.equal(spy.prevClose, 515.0);
    assert.ok(Math.abs(spy.chgPct - ((520 - 515) / 515 * 100)) < 1e-9, 'SPY chgPct correct');

    const qqq = result.data.find(q => q.sym === 'QQQ');
    assert.ok(qqq.chgPct < 0, 'QQQ chgPct should be negative');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test F: fresh cache hit → handleQuotes returns cached:true WITHOUT calling fetch
test('Test F: fresh cache hit → cached:true, no fetch', async () => {
  const kv = fakeKV();
  const syms = ['SPY', 'QQQ'];
  const cachedData = [
    { sym: 'SPY', price: 520.0, chg: 1.5, chgPct: 0.29, prevClose: 518.5 },
    { sym: 'QQQ', price: 440.0, chg: -0.5, chgPct: -0.11, prevClose: 440.5 },
  ];
  // Pre-populate cache with fresh timestamp
  await setCached(kv, 'q:SPY,QQQ', cachedData);

  let fetchCalled = false;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalled = true; return { ok: false }; };

  try {
    const result = await handleQuotes({ FT_KV: kv }, syms);
    assert.equal(fetchCalled, false, 'fetch must not be called on fresh cache hit');
    assert.equal(result.cached, true);
    assert.deepEqual(result.data, cachedData);
  } finally {
    globalThis.fetch = origFetch;
  }
});

/* ═══════════════════════════════════════════════════════════════
   handleCandles tests (Task 1.3)
   ═══════════════════════════════════════════════════════════════ */

// Helper: build a Yahoo Finance v8 chart API response.
// chart.result[0] = { timestamp:[...], indicators:{ quote:[{ open,high,low,close,volume }] } }
function yahooChartResponse(rows) {
  // rows: array of { t (epoch seconds), o,h,l,c,v } — some fields may be null
  return JSON.stringify({
    chart: {
      result: [{
        meta: { symbol: 'GLD' },
        timestamp: rows.map(r => r.t),
        indicators: {
          quote: [{
            open: rows.map(r => r.o),
            high: rows.map(r => r.h),
            low: rows.map(r => r.l),
            close: rows.map(r => r.c),
            volume: rows.map(r => r.v),
          }],
        },
      }],
      error: null,
    },
  });
}

// Helper: build a Stooq daily-history CSV (oldest → newest)
//   https://stooq.com/q/d/l/?s=<sym>.us&i=d
//   Columns: Date,Open,High,Low,Close,Volume
function stooqDailyCsv(rows) {
  // rows: array of { date:'YYYY-MM-DD', o,h,l,c,v }
  return 'Date,Open,High,Low,Close,Volume\n' +
    rows.map(r => `${r.date},${r.o},${r.h},${r.l},${r.c},${r.v}`).join('\n') + '\n';
}

// Test G: Yahoo chart stub → handleCandles returns ascending seconds, nulls dropped, cached
test('Test G: Yahoo chart → handleCandles ascending seconds, nulls dropped, cached', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;

  // 3 valid rows + 1 row with a null close (must be dropped)
  const rows = [
    { t: 1714521600, o: 200, h: 205, l: 199, c: 204, v: 1000 },
    { t: 1714608000, o: 204, h: 208, l: 203, c: 207, v: 1200 },
    { t: 1714694400, o: 207, h: 207, l: 200, c: null, v: 900 }, // dropped (null close)
    { t: 1714780800, o: 206, h: 210, l: 205, c: 209, v: 1100 },
  ];

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('query1.finance.yahoo.com') && u.includes('/v8/finance/chart/')) {
      return { ok: true, json: async () => JSON.parse(yahooChartResponse(rows)) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const result = await handleCandles({ FT_KV: kv }, 'GLD', '3M');
    assert.equal(result.cached, false, 'first fetch not cached');
    assert.equal(result.data.sym, 'GLD');
    assert.equal(result.data.tf, '3M');
    assert.equal(Array.isArray(result.data.candles), true, 'candles is array');
    assert.equal(result.data.candles.length, 3, 'null-close row dropped');

    // Ascending by time, t in UNIX seconds (10-digit-ish), OHLCV numeric
    let prev = 0;
    for (const k of result.data.candles) {
      assert.equal(typeof k.t, 'number');
      assert.ok(k.t > 1e9 && k.t < 2e9, 't should be UNIX seconds, got ' + k.t);
      assert.ok(k.t > prev, 'candles must be time-ascending');
      prev = k.t;
      for (const f of ['o', 'h', 'l', 'c', 'v']) {
        assert.equal(typeof k[f], 'number', f + ' should be number');
      }
    }
    assert.equal(result.data.candles[0].c, 204);

    // KV populated under candle:GLD:3M
    const raw = kv.store.get('candle:GLD:3M');
    assert.ok(raw != null, 'candles should be cached in KV');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test H: Yahoo throws → Stooq daily CSV fallback produces candles
test('Test H: Yahoo fails → Stooq daily CSV fallback yields candles', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;

  const csvRows = [
    { date: '2026-05-14', o: 200, h: 203, l: 199, c: 202, v: 5000 },
    { date: '2026-05-15', o: 202, h: 206, l: 201, c: 205, v: 5200 },
    { date: 'N/D',        o: 'N/D', h: 'N/D', l: 'N/D', c: 'N/D', v: 'N/D' }, // junk row dropped
    { date: '2026-05-18', o: 205, h: 208, l: 204, c: 207, v: 4800 },
  ];

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('query1.finance.yahoo.com')) {
      throw new Error('Yahoo 429 (datacenter IP)');
    }
    if (u.includes('stooq.com') && u.includes('/q/d/l/')) {
      return { ok: true, text: async () => stooqDailyCsv(csvRows) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const result = await handleCandles({ FT_KV: kv }, 'GLD', '1M');
    assert.equal(result.cached, false);
    assert.equal(result.data.sym, 'GLD');
    assert.equal(result.data.tf, '1M');
    assert.equal(result.data.candles.length, 3, 'N/D row dropped, 3 valid rows');

    let prev = 0;
    for (const k of result.data.candles) {
      assert.ok(k.t > 1e9 && k.t < 2e9, 't should be UNIX seconds');
      assert.ok(k.t > prev, 'time-ascending');
      prev = k.t;
      assert.equal(typeof k.c, 'number');
    }
    assert.equal(result.data.candles[0].c, 202);
    assert.equal(result.data.candles[2].c, 207);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test J: Yahoo 429 + Stooq daily-history apikey-gated → key-free single-row
// quote CSV supplies a minimal 1-candle series (chart still renders).
test('Test J: Yahoo 429 + Stooq daily gated → key-free quote candle', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;

  // The real apikey-instructions body Stooq serves for gated daily history.
  const gatedBody = 'Get your apikey:\n\n1. Open https://stooq.com/q/d/?s=gld.us&get_apikey\n';
  // The key-free single-row quote CSV (works from datacenter IPs).
  const quoteCsv =
    'Symbol,Date,Time,Open,High,Low,Close,Volume,Prev\n' +
    'GLD.US,2026-05-18,22:00:23,419.82,420.93,416.06,418.43,5628254,417.29\n';

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('query1.finance.yahoo.com')) {
      throw new Error('HTTP 429 (datacenter IP)');
    }
    if (u.includes('stooq.com') && u.includes('/q/d/l/')) {
      return { ok: true, text: async () => gatedBody };           // gated → no CSV
    }
    if (u.includes('stooq.com') && u.includes('/q/l/') && u.includes('f=sd2t2ohlcvp')) {
      return { ok: true, text: async () => quoteCsv };             // key-free quote
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const result = await handleCandles({ FT_KV: kv }, 'GLD', '3M');
    assert.equal(result.cached, false);
    assert.equal(result.data.sym, 'GLD');
    assert.equal(result.data.candles.length, 1, 'minimal 1-candle series');
    const k = result.data.candles[0];
    assert.ok(k.t > 1e9 && k.t < 2e9, 't should be UNIX seconds');
    assert.equal(k.o, 419.82);
    assert.equal(k.c, 418.43);
    assert.equal(k.v, 5628254);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test I: fresh cache hit → handleCandles returns cached:true WITHOUT calling fetch
test('Test I: fresh candle cache hit → cached:true, no fetch', async () => {
  const kv = fakeKV();
  const cachedData = {
    sym: 'GLD', tf: '3M',
    candles: [
      { t: 1714521600, o: 200, h: 205, l: 199, c: 204, v: 1000 },
      { t: 1714608000, o: 204, h: 208, l: 203, c: 207, v: 1200 },
    ],
  };
  await setCached(kv, 'candle:GLD:3M', cachedData);

  let fetchCalled = false;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalled = true; return { ok: false }; };

  try {
    const result = await handleCandles({ FT_KV: kv }, 'GLD', '3M');
    assert.equal(fetchCalled, false, 'fetch must not be called on fresh cache hit');
    assert.equal(result.cached, true);
    assert.deepEqual(result.data, cachedData);
  } finally {
    globalThis.fetch = origFetch;
  }
});

/* ═══════════════════════════════════════════════════════════════
   handleNews tests (Task 1.4) — fixes B-008
   Contract: data = [{ title, url, src, ts, summary }]
   ts = epoch ms, newest-first, ~20 items, dedup by url.
   ═══════════════════════════════════════════════════════════════ */

// Helper: build a GDELT doc/doc ArtList JSON response.
//   articles[] = { title, url, domain, seendate, ... }
function gdeltResponse(articles) {
  return JSON.stringify({ articles });
}

// Helper: build a Yahoo Finance RSS 2.0 XML feed string.
function yahooRss(items) {
  const body = items.map(it =>
    '<item>' +
    `<title>${it.title}</title>` +
    `<link>${it.link}</link>` +
    `<pubDate>${it.pubDate}</pubDate>` +
    `<description>${it.desc || ''}</description>` +
    '</item>'
  ).join('');
  return '<?xml version="1.0"?><rss version="2.0"><channel>' +
    '<title>Yahoo Finance</title>' + body + '</channel></rss>';
}

// Test K: GDELT stub → handleNews returns mapped array, newest-first, cached.
test('Test K: GDELT → handleNews mapped array, newest-first, cached', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;

  // seendate is GDELT format YYYYMMDDTHHMMSSZ. Provide out-of-order; expect newest first.
  const articles = [
    { title: 'Older market story', url: 'https://a.example/older', domain: 'a.example', seendate: '20260518T120000Z' },
    { title: 'Newest market story', url: 'https://b.example/newest', domain: 'b.example', seendate: '20260519T090000Z' },
    { title: 'Middle market story', url: 'https://c.example/mid', domain: 'c.example', seendate: '20260519T010000Z' },
    // Duplicate URL of "newest" — must be deduped.
    { title: 'Dup of newest', url: 'https://b.example/newest', domain: 'b.example', seendate: '20260519T093000Z' },
  ];

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.gdeltproject.org')) {
      return { ok: true, json: async () => JSON.parse(gdeltResponse(articles)) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const result = await handleNews({ FT_KV: kv }, 'market');
    assert.equal(result.cached, false, 'first fetch not cached');
    assert.equal(Array.isArray(result.data), true, 'data should be array');
    assert.equal(result.data.length, 3, 'duplicate url deduped → 3 unique');

    // Shape: { title, url, src, ts, summary }
    for (const n of result.data) {
      assert.equal(typeof n.title, 'string');
      assert.equal(typeof n.url, 'string');
      assert.equal(typeof n.src, 'string');
      assert.equal(typeof n.ts, 'number');
      assert.ok(n.ts > 1e12 && n.ts < 2e12, 'ts should be epoch MS, got ' + n.ts);
      assert.equal(typeof n.summary, 'string');
    }

    // Newest first
    assert.equal(result.data[0].title, 'Newest market story');
    assert.equal(result.data[0].src, 'b.example');
    let prev = Infinity;
    for (const n of result.data) {
      assert.ok(n.ts <= prev, 'must be sorted newest-first (descending ts)');
      prev = n.ts;
    }

    // KV populated under news:market
    const raw = kv.store.get('news:market');
    assert.ok(raw != null, 'news should be cached in KV under news:market');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test L: GDELT throws → Yahoo RSS XML fallback parsed; entities decoded.
test('Test L: GDELT fails → Yahoo RSS parsed, entities decoded', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;

  const items = [
    {
      title: 'Stocks rally as Tech &amp; Energy lead &lt;gains&gt;',
      link: 'https://finance.yahoo.com/news/rally-123.html',
      pubDate: 'Mon, 19 May 2026 09:00:00 +0000',
      desc: 'Markets up on &quot;strong&quot; data',
    },
    {
      title: 'Bonds slip',
      link: 'https://finance.yahoo.com/news/bonds-456.html',
      pubDate: 'Mon, 19 May 2026 08:00:00 +0000',
      desc: 'Yields rise &amp; prices fall',
    },
  ];

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.gdeltproject.org')) {
      throw new Error('GDELT unavailable');
    }
    if (u.includes('finance.yahoo.com') || u.includes('feeds.finance.yahoo.com')) {
      return { ok: true, text: async () => yahooRss(items) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const result = await handleNews({ FT_KV: kv }, 'market');
    assert.equal(result.cached, false);
    assert.equal(Array.isArray(result.data), true);
    assert.equal(result.data.length, 2, 'two RSS items parsed');

    const first = result.data[0];
    // Entities decoded (&amp; → &, &lt; → <, &gt; → >)
    assert.equal(first.title, 'Stocks rally as Tech & Energy lead <gains>');
    assert.equal(first.url, 'https://finance.yahoo.com/news/rally-123.html');
    assert.equal(first.summary, 'Markets up on "strong" data');
    assert.ok(first.src && typeof first.src === 'string', 'src derived from link domain');
    assert.equal(typeof first.ts, 'number');
    assert.ok(first.ts > 1e12 && first.ts < 2e12, 'ts epoch ms');

    // Newest-first ordering preserved
    assert.ok(result.data[0].ts >= result.data[1].ts, 'newest first');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test M: fresh cache hit → handleNews returns cached:true WITHOUT calling fetch.
test('Test M: fresh news cache hit → cached:true, no fetch', async () => {
  const kv = fakeKV();
  const cachedData = [
    { title: 'Cached story', url: 'https://x.example/1', src: 'x.example', ts: 1779000000000, summary: 'cached' },
  ];
  await setCached(kv, 'news:market', cachedData);

  let fetchCalled = false;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalled = true; return { ok: false }; };

  try {
    const result = await handleNews({ FT_KV: kv }, 'market');
    assert.equal(fetchCalled, false, 'fetch must not be called on fresh cache hit');
    assert.equal(result.cached, true);
    assert.deepEqual(result.data, cachedData);
  } finally {
    globalThis.fetch = origFetch;
  }
});

/* ═══════════════════════════════════════════════════════════════
   handleSectors / handleEconomy / handleFutures tests (Task 1.5)
   Fixes B-009 / B-010 / B-011 — ETF-proxy aggregations that
   delegate INTERNALLY to handleQuotes / handleFx (no new fetch).
   ═══════════════════════════════════════════════════════════════ */

// Generic Yahoo v7 quote-batch builder: every requested symbol gets a
// deterministic numeric quote so handleQuotes resolves the whole batch.
function yahooQuoteBatch(symbols) {
  const result = symbols.map((sym, i) => ({
    symbol: sym,
    regularMarketPrice: 100 + i,
    regularMarketChange: i % 2 === 0 ? 1.1 : -0.9,
    regularMarketChangePercent: i % 2 === 0 ? 0.55 : -0.42,
    regularMarketPreviousClose: 100 + i - (i % 2 === 0 ? 1.1 : -0.9),
  }));
  return JSON.stringify({ quoteResponse: { result, error: null } });
}

// Stub fetch that answers Yahoo quote requests for any syms in the URL.
function yahooQuoteStub() {
  return async (url) => {
    const u = String(url);
    if (u.includes('query1.finance.yahoo.com') && u.includes('/v7/finance/quote')) {
      const symParam = new URL(u).searchParams.get('symbols') || '';
      const syms = symParam.split(',').filter(Boolean);
      return { ok: true, json: async () => JSON.parse(yahooQuoteBatch(syms)) };
    }
    throw new Error('unexpected fetch: ' + u);
  };
}

const SECTOR_SYMS = ['XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLB','XLRE','XLU'];

// Test N: handleSectors → 11 SPDR rows, each with sym/name/price/chg/chgPct, cached.
test('Test N: handleSectors → 11 SPDR ETF rows with names + numeric fields, cached', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;
  globalThis.fetch = yahooQuoteStub();

  try {
    const result = await handleSectors({ FT_KV: kv });
    assert.equal(Array.isArray(result.data), true, 'data should be array');
    assert.equal(result.data.length, 11, 'should have 11 SPDR sector ETFs');
    assert.equal(result.cached, false, 'first call not cached');

    const seen = new Set();
    for (const row of result.data) {
      assert.equal(typeof row.sym, 'string');
      assert.equal(typeof row.name, 'string');
      assert.ok(row.name.length > 0, row.sym + ' must have a non-empty name');
      assert.equal(typeof row.price, 'number');
      assert.equal(typeof row.chg, 'number');
      assert.equal(typeof row.chgPct, 'number');
      seen.add(row.sym);
    }
    for (const s of SECTOR_SYMS) {
      assert.ok(seen.has(s), 'sector list must include ' + s);
    }
    const xlk = result.data.find(r => r.sym === 'XLK');
    assert.equal(xlk.name, 'Technology', 'XLK → Technology name map');

    assert.ok(kv.store.get('sectors') != null, 'sectors should be cached in KV');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test O: handleSectors fresh cache hit → cached:true WITHOUT calling fetch.
test('Test O: handleSectors fresh cache hit → cached:true, no fetch', async () => {
  const kv = fakeKV();
  const cachedData = SECTOR_SYMS.map(s => ({ sym: s, name: s, price: 1, chg: 0, chgPct: 0 }));
  await setCached(kv, 'sectors', cachedData);

  let fetchCalled = false;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalled = true; return { ok: false }; };

  try {
    const result = await handleSectors({ FT_KV: kv });
    assert.equal(fetchCalled, false, 'fetch must not be called on fresh cache hit');
    assert.equal(result.cached, true);
    assert.deepEqual(result.data, cachedData);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test P: handleEconomy → { yields:length5, currencies:length6 } numeric rates+inverse.
test('Test P: handleEconomy → 5 treasury yields + 6 currency pairs with numeric rate+inverse', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('query1.finance.yahoo.com') && u.includes('/v7/finance/quote')) {
      const symParam = new URL(u).searchParams.get('symbols') || '';
      const syms = symParam.split(',').filter(Boolean);
      return { ok: true, json: async () => JSON.parse(yahooQuoteBatch(syms)) };
    }
    if (u.includes('frankfurter.app')) {
      // Frankfurter latest?from=USD shape: { base, date, rates:{...} }
      return {
        ok: true,
        json: async () => ({
          amount: 1, base: 'USD', date: '2026-05-19',
          rates: { EUR: 0.92, GBP: 0.78, JPY: 149.5, CHF: 0.88, AUD: 1.52, CAD: 1.37 },
        }),
      };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const result = await handleEconomy({ FT_KV: kv });
    assert.ok(result.data && typeof result.data === 'object', 'data should be an object');
    assert.equal(Array.isArray(result.data.yields), true, 'yields should be array');
    assert.equal(result.data.yields.length, 5, '5 treasury ETF proxies');
    assert.equal(Array.isArray(result.data.currencies), true, 'currencies should be array');
    assert.equal(result.data.currencies.length, 6, '6 USD currency pairs');

    const ySyms = new Set(result.data.yields.map(y => y.sym));
    for (const s of ['SHY','IEI','IEF','TLT','TIP']) {
      assert.ok(ySyms.has(s), 'yields must include ' + s);
    }
    for (const y of result.data.yields) {
      assert.equal(typeof y.name, 'string');
      assert.ok(y.name.length > 0);
      assert.equal(typeof y.price, 'number');
      assert.equal(typeof y.chg, 'number');
      assert.equal(typeof y.chgPct, 'number');
    }

    for (const c of result.data.currencies) {
      assert.ok(/^USD\//.test(c.pair), 'pair should be USD/<cur>, got ' + c.pair);
      assert.equal(typeof c.rate, 'number');
      assert.equal(typeof c.inverse, 'number');
      assert.ok(Math.abs(c.inverse - 1 / c.rate) < 1e-9, 'inverse must equal 1/rate');
    }
    const eur = result.data.currencies.find(c => c.pair === 'USD/EUR');
    assert.equal(eur.rate, 0.92);

    assert.ok(kv.store.get('economy') != null, 'economy should be cached in KV');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test Q: handleFutures → 9 futures-proxy ETF rows with names + numeric fields.
test('Test Q: handleFutures → 9 ETF-proxy rows with names + numeric fields, cached', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;
  globalThis.fetch = yahooQuoteStub();

  try {
    const result = await handleFutures({ FT_KV: kv });
    assert.equal(Array.isArray(result.data), true);
    assert.equal(result.data.length, 9, 'should have 9 futures-proxy ETFs');
    assert.equal(result.cached, false);

    const seen = new Set();
    for (const row of result.data) {
      assert.equal(typeof row.sym, 'string');
      assert.equal(typeof row.name, 'string');
      assert.ok(row.name.length > 0, row.sym + ' must have a name');
      assert.equal(typeof row.price, 'number');
      assert.equal(typeof row.chg, 'number');
      assert.equal(typeof row.chgPct, 'number');
      seen.add(row.sym);
    }
    for (const s of ['SPY','QQQ','DIA','IWM','GLD','SLV','USO','UNG','DBA']) {
      assert.ok(seen.has(s), 'futures list must include ' + s);
    }
    const spy = result.data.find(r => r.sym === 'SPY');
    assert.ok(/S&P/.test(spy.name), 'SPY name should reference S&P');

    assert.ok(kv.store.get('futures') != null, 'futures should be cached in KV');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test R: handleFutures all sources fail BUT stale cache exists → stale:true.
test('Test R: handleFutures all sources fail with stale cache → stale:true', async () => {
  const kv = fakeKV();
  const staleData = [{ sym: 'SPY', name: 'S&P 500 (ES)', price: 1, chg: 0, chgPct: 0 }];
  const oldTs = Date.now() - 120_000; // expired at 60s TTL
  kv.store.set('futures', JSON.stringify({ d: staleData, t: oldTs }));

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network unavailable'); };

  try {
    const result = await handleFutures({ FT_KV: kv });
    assert.equal(result.stale, true, 'should return stale:true');
    assert.equal(result.cached, true);
    assert.deepEqual(result.data, staleData);
  } finally {
    globalThis.fetch = origFetch;
  }
});

/* ═══════════════════════════════════════════════════════════════
   handleScreener tests (Task 1.6) — fixes B-007.
   Curated static fundamentals universe filtered by preset/criteria,
   then live price/chg enriched via handleQuotes (Yahoo v7 stub).
   ═══════════════════════════════════════════════════════════════ */

// Yahoo v7 quote stub that answers ANY requested symbols with a
// deterministic numeric quote so handleQuotes resolves the whole batch.
function yahooScreenerStub() {
  return async (url) => {
    const u = String(url);
    if (u.includes('query1.finance.yahoo.com') && u.includes('/v7/finance/quote')) {
      const symParam = new URL(u).searchParams.get('symbols') || '';
      const syms = symParam.split(',').filter(Boolean);
      const result = syms.map((sym, i) => ({
        symbol: sym,
        regularMarketPrice: 100 + i,
        regularMarketChange: i % 2 === 0 ? 1.1 : -0.9,
        regularMarketChangePercent: i % 2 === 0 ? 0.55 : -0.42,
        regularMarketPreviousClose: 100 + i - (i % 2 === 0 ? 1.1 : -0.9),
      }));
      return { ok: true, json: async () => JSON.parse(JSON.stringify({ quoteResponse: { result, error: null } })) };
    }
    throw new Error('unexpected fetch: ' + u);
  };
}

// Test S: preset 'High Dividend' → every returned row has divYield>=3 and
// a numeric live price (enriched via handleQuotes), result is cached.
test("Test S: preset 'High Dividend' → all rows divYield>=3, numeric price, cached", async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;
  globalThis.fetch = yahooScreenerStub();

  try {
    const result = await handleScreener({ FT_KV: kv }, { preset: 'High Dividend' });
    assert.equal(Array.isArray(result.data), true, 'data should be array');
    assert.ok(result.data.length > 0, 'High Dividend should return at least one row');
    assert.equal(result.cached, false, 'first call not cached');

    for (const row of result.data) {
      assert.equal(typeof row.sym, 'string');
      assert.equal(typeof row.name, 'string');
      assert.ok(row.name.length > 0, row.sym + ' must have a name');
      assert.equal(typeof row.sector, 'string');
      assert.equal(typeof row.divYield, 'number');
      assert.ok(row.divYield >= 3, row.sym + ' divYield must be >= 3, got ' + row.divYield);
      assert.equal(typeof row.price, 'number', row.sym + ' price should be numeric (enriched)');
      assert.equal(typeof row.chgPct, 'number', row.sym + ' chgPct should be numeric (enriched)');
      assert.equal(typeof row.marketCap, 'number');
    }

    // Cached under a stable key derived from params.
    let cachedKey = null;
    for (const k of kv.store.keys()) if (k.startsWith('screener:')) cachedKey = k;
    assert.ok(cachedKey != null, 'result should be cached under a screener:* key');

    // Second call hits fresh cache → cached:true, no fetch.
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; return { ok: false }; };
    const again = await handleScreener({ FT_KV: kv }, { preset: 'High Dividend' });
    assert.equal(fetchCalled, false, 'fresh cache hit must not call fetch');
    assert.equal(again.cached, true);
    assert.deepEqual(again.data, result.data);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test T: explicit filter maxPe=15 → every returned row has pe<=15
// (rows with null pe are excluded when a maxPe constraint is active).
test('Test T: filter maxPe=15 → all rows pe<=15', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;
  globalThis.fetch = yahooScreenerStub();

  try {
    const result = await handleScreener({ FT_KV: kv }, { maxPe: 15 });
    assert.equal(Array.isArray(result.data), true);
    assert.ok(result.data.length > 0, 'maxPe=15 should still match well-known value names');
    for (const row of result.data) {
      assert.equal(typeof row.pe, 'number', row.sym + ' pe should be numeric when maxPe filter active');
      assert.ok(row.pe <= 15, row.sym + ' pe must be <= 15, got ' + row.pe);
      assert.equal(typeof row.price, 'number');
    }
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test U: fresh cache pre-populated → handleScreener returns cached:true
// WITHOUT calling fetch (no quote enrichment refetch).
test('Test U: fresh screener cache hit → cached:true, no fetch', async () => {
  const kv = fakeKV();
  // First call populates cache for these exact params.
  const params = { sector: 'Technology' };
  globalThis.fetch = yahooScreenerStub();
  const first = await handleScreener({ FT_KV: kv }, params);
  assert.equal(first.cached, false);

  let fetchCalled = false;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalled = true; return { ok: false }; };

  try {
    const result = await handleScreener({ FT_KV: kv }, { sector: 'Technology' });
    assert.equal(fetchCalled, false, 'fetch must not be called on fresh cache hit');
    assert.equal(result.cached, true);
    assert.deepEqual(result.data, first.data);
  } finally {
    globalThis.fetch = origFetch;
  }
});

/* ═══════════════════════════════════════════════════════════════
   handleCrypto tests (Task 1.7) — fixes B-005.
   CoinGecko markets + global proxied through the Worker (2 min cache,
   stale-on-error, quota-safe). Shape: { coins:[...], global:{...} }.
   ═══════════════════════════════════════════════════════════════ */

// CoinGecko markets array stub (subset of real fields the client uses).
function cgMarketsResponse() {
  return [
    {
      id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: 'x',
      current_price: 67000, market_cap: 1.3e12, market_cap_rank: 1,
      total_volume: 3e10,
      price_change_percentage_1h_in_currency: 0.12,
      price_change_percentage_24h_in_currency: 1.4,
      price_change_percentage_7d_in_currency: -2.1,
      sparkline_in_7d: { price: [66000, 66500, 67000] },
    },
    {
      id: 'ethereum', symbol: 'eth', name: 'Ethereum', image: 'y',
      current_price: 3500, market_cap: 4.2e11, market_cap_rank: 2,
      total_volume: 1.5e10,
      price_change_percentage_1h_in_currency: -0.05,
      price_change_percentage_24h_in_currency: 0.9,
      price_change_percentage_7d_in_currency: 3.3,
      sparkline_in_7d: { price: [3400, 3450, 3500] },
    },
  ];
}

// CoinGecko /global stub. market_cap_percentage is the Market Dominance source.
function cgGlobalResponse() {
  return {
    data: {
      active_cryptocurrencies: 12000,
      markets: 900,
      total_market_cap: { usd: 2.4e12 },
      total_volume: { usd: 9e10 },
      market_cap_change_percentage_24h_usd: 1.1,
      market_cap_percentage: {
        btc: 52.1, eth: 17.3, usdt: 4.2, bnb: 3.1, sol: 2.4, xrp: 1.8, ada: 1.2,
      },
    },
  };
}

function cgCryptoStub() {
  return async (url) => {
    const u = String(url);
    if (u.includes('api.coingecko.com') && u.includes('/coins/markets')) {
      return { ok: true, json: async () => JSON.parse(JSON.stringify(cgMarketsResponse())) };
    }
    if (u.includes('api.coingecko.com') && u.includes('/global')) {
      return { ok: true, json: async () => JSON.parse(JSON.stringify(cgGlobalResponse())) };
    }
    throw new Error('unexpected fetch: ' + u);
  };
}

// Test V: markets + global stubbed → handleCrypto returns
// { coins:[len>0], global:{ market_cap_percentage:{ btc,... } } } and caches it.
test('Test V: handleCrypto returns coins+global, caches under crypto key', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;
  globalThis.fetch = cgCryptoStub();

  try {
    const result = await handleCrypto({ FT_KV: kv });
    assert.equal(result.cached, false, 'first call not cached');
    assert.equal(Array.isArray(result.data.coins), true, 'coins should be an array');
    assert.ok(result.data.coins.length > 0, 'coins should be non-empty');
    assert.equal(result.data.coins[0].id, 'bitcoin', 'markets array passed through as-is');
    assert.equal(typeof result.data.global, 'object', 'global should be an object');
    assert.equal(typeof result.data.global.market_cap_percentage, 'object',
      'global.market_cap_percentage must be present (Market Dominance source)');
    assert.equal(typeof result.data.global.market_cap_percentage.btc, 'number',
      'btc dominance must be a number');

    const raw = kv.store.get('crypto');
    assert.ok(raw != null, 'result should be cached under the "crypto" key');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test W: fresh cache pre-populated → handleCrypto returns cached:true
// WITHOUT calling fetch (no CoinGecko refetch — quota-safe).
test('Test W: fresh crypto cache hit → cached:true, no fetch', async () => {
  const kv = fakeKV();
  const cachedData = { coins: [{ id: 'bitcoin' }], global: { market_cap_percentage: { btc: 50 } } };
  await setCached(kv, 'crypto', cachedData);

  let fetchCalled = false;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalled = true; return { ok: false }; };

  try {
    const result = await handleCrypto({ FT_KV: kv });
    assert.equal(fetchCalled, false, 'fetch must not be called on fresh cache hit');
    assert.equal(result.cached, true);
    assert.deepEqual(result.data, cachedData);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test X: markets fetch throws BUT a stale cache exists → stale served.
test('Test X: crypto fetch fails with stale cache → returns stale:true', async () => {
  const kv = fakeKV();
  const staleData = { coins: [{ id: 'ethereum' }], global: { market_cap_percentage: { eth: 18 } } };
  const oldTs = Date.now() - 300_000; // 5 min ago → expired at 2 min TTL
  kv.store.set('crypto', JSON.stringify({ d: staleData, t: oldTs }));

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('coingecko unavailable'); };

  try {
    const result = await handleCrypto({ FT_KV: kv });
    assert.equal(result.stale, true, 'should return stale:true');
    assert.equal(result.cached, true);
    assert.deepEqual(result.data, staleData, 'should return the stale payload');
  } finally {
    globalThis.fetch = origFetch;
  }
});

/* ═══════════════════════════════════════════════════════════════
   handleAnalyze tests (FT Phase 2 Task A) — /analyze endpoint.
   Indicators + signals + gauge + ensemble prediction. Uses internal
   handleCandles via the same Yahoo stub pattern.
   ═══════════════════════════════════════════════════════════════ */

// Helper: synthetic OHLCV with a clear uptrend so indicators settle.
// 80 bars long → enough for ema26/macd signal to be defined.
function syntheticUptrendYahoo() {
  const rows = [];
  const startT = 1714521600; // epoch seconds anchor
  for (let i = 0; i < 80; i++) {
    const base = 100 + i * 0.5 + Math.sin(i / 4) * 1.5;
    rows.push({
      t: startT + i * 86400,
      o: base - 0.2,
      h: base + 1.0,
      l: base - 1.0,
      c: base,
      v: 1_000_000 + i * 1000,
    });
  }
  return JSON.stringify({
    chart: {
      result: [{
        meta: { symbol: 'TEST' },
        timestamp: rows.map(r => r.t),
        indicators: { quote: [{
          open: rows.map(r => r.o),
          high: rows.map(r => r.h),
          low: rows.map(r => r.l),
          close: rows.map(r => r.c),
          volume: rows.map(r => r.v),
        }] },
      }],
      error: null,
    },
  });
}

// Test AN1: full contract — handleAnalyze returns sym/tf/asOf/price/indicators/signals/gauge/prediction.
test('Test AN1: handleAnalyze returns full contract — indicators + gauge + prediction', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('query1.finance.yahoo.com') && u.includes('/v8/finance/chart/')) {
      return { ok: true, json: async () => JSON.parse(syntheticUptrendYahoo()) };
    }
    if (u.includes('query1.finance.yahoo.com') && u.includes('/v7/finance/quote')) {
      // Optional quote enrichment — return one quote.
      return { ok: true, json: async () => ({
        quoteResponse: {
          result: [{ symbol: 'TEST', regularMarketPrice: 140.0, regularMarketChange: 0.5, regularMarketChangePercent: 0.36, regularMarketPreviousClose: 139.5 }],
          error: null,
        },
      }) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const result = await handleAnalyze({ FT_KV: kv }, 'TEST', '3M');
    assert.equal(result.cached, false, 'first call not cached');
    const d = result.data;
    assert.equal(d.sym, 'TEST');
    assert.equal(d.tf, '3M');
    assert.equal(typeof d.asOf, 'number');
    assert.equal(typeof d.price, 'number');
    assert.equal(typeof d.chgPct, 'number');

    // Indicators — every field numeric (no NaN/null).
    assert.equal(typeof d.indicators.rsi14, 'number');
    assert.ok(!Number.isNaN(d.indicators.rsi14), 'rsi14 must not be NaN');
    assert.equal(typeof d.indicators.macd.macd, 'number');
    assert.equal(typeof d.indicators.macd.signal, 'number');
    assert.equal(typeof d.indicators.macd.histogram, 'number');
    assert.equal(typeof d.indicators.sma20, 'number');
    assert.equal(typeof d.indicators.sma50, 'number');
    assert.equal(typeof d.indicators.sma200, 'number');
    assert.equal(typeof d.indicators.ema20, 'number');
    assert.equal(typeof d.indicators.ema50, 'number');
    assert.equal(typeof d.indicators.bollinger.upper, 'number');
    assert.equal(typeof d.indicators.bollinger.middle, 'number');
    assert.equal(typeof d.indicators.bollinger.lower, 'number');
    assert.equal(typeof d.indicators.bollinger.bandwidth, 'number');
    assert.equal(typeof d.indicators.atr14, 'number');
    assert.equal(typeof d.indicators.stoch.k, 'number');
    assert.equal(typeof d.indicators.stoch.d, 'number');

    // Signals — labels from canonical sets.
    assert.ok(['bullish', 'bearish', 'neutral'].includes(d.signals.trend));
    assert.ok(['overbought', 'oversold', 'neutral'].includes(d.signals.momentum));
    assert.ok(['expanding', 'contracting', 'stable'].includes(d.signals.volatility));
    assert.ok(['golden', 'death', 'none'].includes(d.signals.ma_cross));

    // Gauge.
    assert.equal(typeof d.gauge.score, 'number');
    assert.ok(d.gauge.score >= 0 && d.gauge.score <= 100, 'gauge.score in [0,100]');
    assert.equal(typeof d.gauge.label, 'string');
    assert.ok(d.gauge.label.length > 0);
    assert.equal(typeof d.gauge.components, 'object');

    // Prediction.
    assert.ok(['up', 'down', 'sideways'].includes(d.prediction.direction));
    assert.equal(typeof d.prediction.confidence, 'number');
    assert.ok(d.prediction.confidence >= 0 && d.prediction.confidence <= 1, 'confidence in [0,1]');
    assert.ok(['1w', '1m'].includes(d.prediction.horizon));
    assert.equal(d.prediction.method, 'ensemble');
    assert.ok(Array.isArray(d.prediction.rationale));
    assert.ok(d.prediction.rationale.length >= 1 && d.prediction.rationale.length <= 5);

    // KV populated under analyze:TEST:3M.
    const raw = kv.store.get('analyze:TEST:3M');
    assert.ok(raw != null, 'analyze should be cached in KV');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test AN2: fresh cache hit → cached:true WITHOUT recomputing.
test('Test AN2: fresh analyze cache hit → cached:true, no fetch', async () => {
  const kv = fakeKV();
  const cachedData = {
    sym: 'TEST', tf: '3M', asOf: 1779000000000, price: 105, chgPct: 0.3,
    indicators: {
      rsi14: 60,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
      sma20: 102, sma50: 100, sma200: 95,
      ema20: 102, ema50: 100,
      bollinger: { upper: 110, middle: 102, lower: 94, bandwidth: 0.16 },
      atr14: 2,
      stoch: { k: 60, d: 55 },
    },
    signals: { trend: 'bullish', momentum: 'neutral', volatility: 'stable', ma_cross: 'golden' },
    gauge: { score: 65, label: 'Bullish', components: { trend: 70, momentum: 50, volatility: 50, macross: 80, rsi: 50 } },
    prediction: { direction: 'up', confidence: 0.6, horizon: '1m', rationale: ['x'], method: 'ensemble' },
  };
  await setCached(kv, 'analyze:TEST:3M', cachedData);

  let fetchCalled = false;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalled = true; return { ok: false }; };

  try {
    const result = await handleAnalyze({ FT_KV: kv }, 'TEST', '3M');
    assert.equal(fetchCalled, false, 'fetch must not be called on fresh cache hit');
    assert.equal(result.cached, true);
    assert.deepEqual(result.data, cachedData);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test AN3: stale-on-error pattern.
test('Test AN3: handleAnalyze all sources fail with stale cache → stale:true', async () => {
  const kv = fakeKV();
  const staleData = {
    sym: 'TEST', tf: '3M', asOf: 1779000000000, price: 100, chgPct: 0,
    indicators: { rsi14: 50, macd: { macd: 0, signal: 0, histogram: 0 }, sma20: 100, sma50: 100, sma200: 100, ema20: 100, ema50: 100, bollinger: { upper: 105, middle: 100, lower: 95, bandwidth: 0.1 }, atr14: 1, stoch: { k: 50, d: 50 } },
    signals: { trend: 'neutral', momentum: 'neutral', volatility: 'stable', ma_cross: 'none' },
    gauge: { score: 50, label: 'Neutral', components: { trend: 50, momentum: 50, volatility: 50, macross: 50, rsi: 50 } },
    prediction: { direction: 'sideways', confidence: 0.5, horizon: '1m', rationale: ['x'], method: 'ensemble' },
  };
  const oldTs = Date.now() - 120_000; // expired at 60s TTL
  kv.store.set('analyze:TEST:3M', JSON.stringify({ d: staleData, t: oldTs }));

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network unavailable'); };

  try {
    const result = await handleAnalyze({ FT_KV: kv }, 'TEST', '3M');
    assert.equal(result.stale, true, 'should return stale:true');
    assert.equal(result.cached, true);
    assert.deepEqual(result.data, staleData);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// --- handleFxHistory --------------------------------------------------------
test('Y1: handleFxHistory — Frankfurter timeseries returns sorted points + caches', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!String(url).includes('frankfurter.app/')) throw new Error('unexpected url');
    return new Response(JSON.stringify({
      amount: 1, base: 'USD', start_date: '2026-04-22', end_date: '2026-05-22',
      rates: { '2026-05-22': { EUR: 0.9 }, '2026-05-21': { EUR: 0.92 }, '2026-05-20': { EUR: 0.91 } }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const { handleFxHistory } = await import('../src/handlers.js');
    const r = await handleFxHistory({ FT_KV: kv }, 'USD', 'EUR', 30);
    assert.equal(r.cached, false);
    assert.equal(r.data.from, 'USD');
    assert.equal(r.data.to, 'EUR');
    assert.equal(r.data.days, 30);
    assert.equal(r.data.points.length, 3);
    assert.equal(r.data.points[0].d, '2026-05-20'); // ascending
    assert.equal(typeof r.data.points[0].v, 'number');
    assert.ok(kv.store.has('fxh:USD-EUR-30'), 'cache key set');
  } finally { globalThis.fetch = origFetch; }
});
