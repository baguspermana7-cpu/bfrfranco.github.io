import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCached, setCached } from '../src/cache.js';

function fakeKV() {
  const m = new Map();
  return {
    store: m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); },
  };
}

test('getCached on empty KV returns null', async () => {
  const kv = fakeKV();
  const result = await getCached(kv, 'no-such-key', 60_000);
  assert.equal(result, null);
});

test('setCached then getCached within TTL returns fresh hit', async () => {
  const kv = fakeKV();
  const data = { price: 42, symbol: 'AAPL' };
  await setCached(kv, 'quote:AAPL', data);
  const result = await getCached(kv, 'quote:AAPL', 60_000);
  assert.notEqual(result, null);
  assert.deepEqual(result.data, data);
  assert.equal(result.stale, false);
  assert.ok(typeof result.ts === 'number');
});

test('getCached past TTL without allowStale returns null', async () => {
  const kv = fakeKV();
  const data = { price: 99 };
  await setCached(kv, 'quote:X', data);
  // ttlMs = -1 means any age exceeds ttl
  const result = await getCached(kv, 'quote:X', -1);
  assert.equal(result, null);
});

test('getCached past TTL with allowStale returns stale hit', async () => {
  const kv = fakeKV();
  const data = { price: 77 };
  await setCached(kv, 'quote:Y', data);
  // ttlMs = -1 forces stale
  const result = await getCached(kv, 'quote:Y', -1, { allowStale: true });
  assert.notEqual(result, null);
  assert.deepEqual(result.data, data);
  assert.equal(result.stale, true);
});

test('getCached with corrupt stored value returns null without throwing', async () => {
  const kv = fakeKV();
  await kv.put('bad-key', 'not json');
  const result = await getCached(kv, 'bad-key', 60_000);
  assert.equal(result, null);
});
