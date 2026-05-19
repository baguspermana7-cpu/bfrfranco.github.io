import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleFx, handleQuotes } from '../src/handlers.js';
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
