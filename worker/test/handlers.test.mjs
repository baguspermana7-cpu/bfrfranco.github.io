import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleFx } from '../src/handlers.js';
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
