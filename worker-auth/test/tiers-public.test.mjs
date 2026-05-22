/**
 * GET /auth/tiers/public — returns tier list sorted by priority ASC.
 *
 * The "public" suffix matters: it intentionally omits `defaultFeatures` and
 * `isSystem` so the matrix never leaks to non-root clients. The full matrix
 * is reserved for `/admin/tiers` (Phase 2).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { makeEnv, call } from './_helpers.mjs';

async function seedTiers(env, tiers) {
  for (const t of tiers) {
    await env.RZ_AUTH_KV.put(`tiers/${t.name}`, JSON.stringify({
      ...t,
      isSystem: true,
      defaultFeatures: { 'should-not-leak': true },
    }));
  }
}

test('GET /auth/tiers/public returns tier list sorted by priority ASC', async () => {
  const env = makeEnv();
  await seedTiers(env, [
    { name: 'root', label: 'Root', priority: 99, color: '#ef4444' },
    { name: 'free', label: 'Free', priority: 10, color: '#94a3b8' },
    { name: 'pro', label: 'Pro', priority: 30, color: '#8b5cf6' },
    { name: 'demo', label: 'Demo', priority: 20, color: '#a78bfa' },
  ]);
  const { res, body } = await call(worker, 'GET', '/auth/tiers/public', { env });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data));
  const names = body.data.map(t => t.name);
  assert.deepEqual(names, ['free', 'demo', 'pro', 'root']);
});

test('GET /auth/tiers/public excludes defaultFeatures (no matrix leak)', async () => {
  const env = makeEnv();
  await seedTiers(env, [
    { name: 'free', label: 'Free', priority: 10, color: '#94a3b8' },
  ]);
  const { body } = await call(worker, 'GET', '/auth/tiers/public', { env });
  for (const t of body.data) {
    assert.equal(t.defaultFeatures, undefined, 'tiers/public must NOT expose defaultFeatures');
    assert.equal(t.isSystem, undefined, 'tiers/public must NOT expose isSystem');
  }
});

test('GET /auth/tiers/public on empty store returns empty array (not 500)', async () => {
  const env = makeEnv();
  const { res, body } = await call(worker, 'GET', '/auth/tiers/public', { env });
  assert.equal(res.status, 200);
  assert.deepEqual(body.data, []);
});
