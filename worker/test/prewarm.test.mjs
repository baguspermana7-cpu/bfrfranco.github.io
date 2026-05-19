import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prewarm } from '../src/index.js';

/* ═══════════════════════════════════════════════════════════════
   Task 1.9 — cron pre-warm + stale hardening (fixes B-003).

   prewarm(env) warms the hottest caches in parallel with each
   failure isolated (Promise.allSettled) so a cron tick NEVER
   throws. The /__scheduled trigger calls it via ctx.waitUntil.
   ═══════════════════════════════════════════════════════════════ */

function fakeKV() {
  const m = new Map();
  return {
    store: m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); },
  };
}

// A generic OK fetch stub broad enough for every handler prewarm
// touches (fx / quotes / news / crypto / sectors / futures). Each
// upstream gets a minimally-valid payload so the live path resolves
// and setCached writes the key.
function genericOkStub() {
  return async (url) => {
    const u = String(url);

    // ── FX: Frankfurter latest?from=USD → { base, date, rates }
    if (u.includes('frankfurter.app')) {
      return {
        ok: true,
        json: async () => ({
          amount: 1, base: 'USD', date: '2026-05-19',
          rates: { EUR: 0.92, GBP: 0.78, JPY: 149.5, CHF: 0.88, AUD: 1.52, CAD: 1.37 },
        }),
      };
    }

    // ── Quotes / sectors / futures: Yahoo v7 batch for any symbols
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
      return { ok: true, json: async () => ({ quoteResponse: { result, error: null } }) };
    }

    // ── News: GDELT doc/doc ArtList
    if (u.includes('api.gdeltproject.org')) {
      return {
        ok: true,
        json: async () => ({
          articles: [
            { title: 'Market story', url: 'https://a.example/1', domain: 'a.example', seendate: '20260519T090000Z' },
          ],
        }),
      };
    }

    // ── Crypto: CoinGecko markets + global
    if (u.includes('api.coingecko.com') && u.includes('/coins/markets')) {
      return {
        ok: true,
        json: async () => ([
          { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 67000, market_cap: 1.3e12 },
        ]),
      };
    }
    if (u.includes('api.coingecko.com') && u.includes('/global')) {
      return {
        ok: true,
        json: async () => ({ data: { market_cap_percentage: { btc: 52.1, eth: 17.3 } } }),
      };
    }

    throw new Error('unexpected fetch: ' + u);
  };
}

// Test Y: prewarm resolves (never rejects) AND populates the hottest
// KV cache keys (fx / quotes / news / crypto).
test('Test Y: prewarm resolves and warms fx/quotes/news/crypto KV keys', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;
  globalThis.fetch = genericOkStub();

  try {
    const settled = await prewarm({ FT_KV: kv });
    assert.ok(Array.isArray(settled), 'prewarm should resolve to an allSettled array');
    assert.ok(settled.length >= 6, 'prewarm should fan out to >= 6 sources');

    // Hottest caches must be populated after a warm tick.
    assert.ok(kv.store.get('fx:USD') != null, 'fx:USD should be cached');
    assert.ok(
      kv.store.get('q:SPY,QQQ,DIA,IWM,GLD,TLT,USO,VGK') != null,
      'index quote batch should be cached under q:SPY,QQQ,DIA,IWM,GLD,TLT,USO,VGK'
    );
    assert.ok(kv.store.get('news:market') != null, 'news:market should be cached');
    assert.ok(kv.store.get('crypto') != null, 'crypto should be cached');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test Z: every upstream fetch throws → prewarm STILL resolves
// (Promise.allSettled, never rejects — a cron tick must not throw).
test('Test Z: all sources fail → prewarm still resolves (never throws)', async () => {
  const kv = fakeKV();
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('total network outage'); };

  try {
    let threw = false;
    let settled;
    try {
      settled = await prewarm({ FT_KV: kv });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, false, 'prewarm must NEVER throw even if every source fails');
    assert.ok(Array.isArray(settled), 'prewarm resolves to an allSettled array even on total failure');
  } finally {
    globalThis.fetch = origFetch;
  }
});
