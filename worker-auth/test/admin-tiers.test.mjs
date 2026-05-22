/**
 * Admin tier-CRUD endpoints (R-015 Phase 2).
 *
 *   GET    /admin/tiers
 *   POST   /admin/tiers
 *   PATCH  /admin/tiers/:name
 *   DELETE /admin/tiers/:name
 *
 * System tiers (isSystem:true) are protected from
 *   - priority shuffling below 10
 *   - deletion (any state)
 *
 * Deleting a tier with ≥1 user attached returns 409 with the count.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import {
  makeEnv, call, adminCall, seedUser, seedSystemTiers, seedTier, loginAs,
} from './_helpers.mjs';

async function asRoot(env) {
  await seedSystemTiers(env);
  await seedUser(env, { email: 'root@resistancezero.com', password: 'root-pw', tier: 'root', role: 'root' });
  return loginAs(worker, env, 'root@resistancezero.com', 'root-pw');
}

// ---------------------------------------------------------------------------
// GET /admin/tiers
// ---------------------------------------------------------------------------

test('GET /admin/tiers → 401 without session', async () => {
  const env = makeEnv();
  const { res } = await call(worker, 'GET', '/admin/tiers', { env });
  assert.equal(res.status, 401);
});

test('GET /admin/tiers → 200 returns full records sorted by priority', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  const { res, body } = await call(worker, 'GET', '/admin/tiers', { env, cookie });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data.tiers));
  const names = body.data.tiers.map(t => t.name);
  assert.deepEqual(names, ['free', 'demo', 'educator', 'pro', 'root']);
  // Admin endpoint MUST include defaultFeatures (this is the matrix).
  for (const t of body.data.tiers) {
    assert.ok('defaultFeatures' in t, 'admin tiers must include defaultFeatures');
    assert.ok('isSystem' in t);
  }
});

// ---------------------------------------------------------------------------
// POST /admin/tiers
// ---------------------------------------------------------------------------

test('POST /admin/tiers → 403 without CSRF', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  const { res } = await adminCall(worker, 'POST', '/admin/tiers',
    { env, cookie, body: { name: 'beta', label: 'Beta', priority: 40, color: '#22d3ee' } });
  assert.equal(res.status, 403);
});

test('POST /admin/tiers → 200 creates tier with isSystem:false', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res, body } = await adminCall(worker, 'POST', '/admin/tiers', {
    env, cookie, csrf,
    body: { name: 'beta', label: 'Beta', priority: 40, color: '#22d3ee', defaultFeatures: { 'finance-terminal': true } },
  });
  assert.equal(res.status, 200, `${res.status}: ${JSON.stringify(body)}`);
  assert.equal(body.data.tier.name, 'beta');
  assert.equal(body.data.tier.isSystem, false);

  const stored = JSON.parse(await env.RZ_AUTH_KV.get('tiers/beta'));
  assert.equal(stored.isSystem, false);
  assert.equal(stored.priority, 40);
  assert.deepEqual(stored.defaultFeatures, { 'finance-terminal': true });
});

test('POST /admin/tiers → 409 on duplicate name', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res } = await adminCall(worker, 'POST', '/admin/tiers', {
    env, cookie, csrf,
    body: { name: 'pro', label: 'Pro2', priority: 35, color: '#22d3ee' },
  });
  assert.equal(res.status, 409);
});

test('POST /admin/tiers → 400 on invalid slug', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  for (const bad of ['UPPER', 'with space', 'sp@ce', 'a', 'x'.repeat(25)]) {
    const { res } = await adminCall(worker, 'POST', '/admin/tiers', {
      env, cookie, csrf,
      body: { name: bad, label: 'X', priority: 40, color: '#22d3ee' },
    });
    assert.equal(res.status, 400, `slug ${bad} should be rejected`);
  }
});

test('POST /admin/tiers → 400 on invalid color', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res } = await adminCall(worker, 'POST', '/admin/tiers', {
    env, cookie, csrf,
    body: { name: 'beta', label: 'Beta', priority: 40, color: 'red' },
  });
  assert.equal(res.status, 400);
});

test('POST /admin/tiers → 400 on priority out of range', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res } = await adminCall(worker, 'POST', '/admin/tiers', {
    env, cookie, csrf,
    body: { name: 'beta', label: 'Beta', priority: 5000, color: '#22d3ee' },
  });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// PATCH /admin/tiers/:name
// ---------------------------------------------------------------------------

test('PATCH /admin/tiers/:name → 404 for missing tier', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res } = await adminCall(worker, 'PATCH', '/admin/tiers/ghost',
    { env, cookie, csrf, body: { label: 'Ghost' } });
  assert.equal(res.status, 404);
});

test('PATCH /admin/tiers/:name → 200 updates label + defaultFeatures', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await seedTier(env, { name: 'beta', label: 'Beta', priority: 40, isSystem: false });
  const { res, body } = await adminCall(worker, 'PATCH', '/admin/tiers/beta', {
    env, cookie, csrf,
    body: { label: 'Beta-2', defaultFeatures: { x: true } },
  });
  assert.equal(res.status, 200, `${res.status}: ${JSON.stringify(body)}`);
  const stored = JSON.parse(await env.RZ_AUTH_KV.get('tiers/beta'));
  assert.equal(stored.label, 'Beta-2');
  assert.deepEqual(stored.defaultFeatures, { x: true });
});

test('PATCH /admin/tiers/:name rejects priority<10 on system tier', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  // `free` is seeded with isSystem:true by seedSystemTiers.
  const { res, body } = await adminCall(worker, 'PATCH', '/admin/tiers/free',
    { env, cookie, csrf, body: { priority: 1 } });
  assert.equal(res.status, 400);
  assert.match(body.error, /priority/);
});

// ---------------------------------------------------------------------------
// DELETE /admin/tiers/:name
// ---------------------------------------------------------------------------

test('DELETE /admin/tiers/:name → 403 for system tier', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res, body } = await adminCall(worker, 'DELETE', '/admin/tiers/free',
    { env, cookie, csrf });
  assert.equal(res.status, 403);
  assert.match(body.error, /system/);
});

test('DELETE /admin/tiers/:name → 409 when users still attached', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await seedTier(env, { name: 'beta', label: 'Beta', priority: 40, isSystem: false });
  await seedUser(env, { email: 'beta-user@example.com', password: 'pw', tier: 'beta', role: 'free' });

  const { res, body } = await adminCall(worker, 'DELETE', '/admin/tiers/beta',
    { env, cookie, csrf });
  assert.equal(res.status, 409);
  assert.equal(body.data?.userCount, 1, 'must return count of attached users');
});

test('DELETE /admin/tiers/:name → 200 removes empty non-system tier', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await seedTier(env, { name: 'beta', label: 'Beta', priority: 40, isSystem: false });

  const { res } = await adminCall(worker, 'DELETE', '/admin/tiers/beta', { env, cookie, csrf });
  assert.equal(res.status, 200);
  assert.equal(await env.RZ_AUTH_KV.get('tiers/beta'), null);
});
