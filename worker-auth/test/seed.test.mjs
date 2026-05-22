/**
 * POST /admin/__seed — one-time bootstrap migration.
 *
 * Three behaviours under test:
 *   1. token gate (403 on missing/wrong token)
 *   2. self-disable gate (403 on second call — `config/seeded` already set)
 *   3. happy path: writes N users + M tiers, hashes are PBKDF2-verifiable
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { verifyPassword } from '../src/lib/crypto.js';
import { makeEnv, call } from './_helpers.mjs';

const SEED_BODY = {
  users: [
    { email: 'root@resistancezero.com', password: 'root-pw-1', tier: 'root', role: 'root' },
    { email: 'educator@resistancezero.com', password: 'educator2026', tier: 'educator', role: 'user' },
  ],
  tiers: [
    { name: 'free', label: 'Free', priority: 10, color: '#94a3b8', defaultFeatures: {} },
    { name: 'demo', label: 'Demo', priority: 20, color: '#a78bfa', defaultFeatures: { 'finance-terminal': true } },
    { name: 'educator', label: 'Educator', priority: 25, color: '#10b981', defaultFeatures: {} },
    { name: 'pro', label: 'Pro', priority: 30, color: '#8b5cf6', defaultFeatures: {} },
    { name: 'root', label: 'Root', priority: 99, color: '#ef4444', defaultFeatures: {} },
  ],
};

test('POST /admin/__seed → 403 when token is missing', async () => {
  const env = makeEnv();
  const { res } = await call(worker, 'POST', '/admin/__seed',
    { env, body: SEED_BODY });
  assert.equal(res.status, 403);
});

test('POST /admin/__seed → 403 when token is wrong', async () => {
  const env = makeEnv();
  const { res } = await call(worker, 'POST', '/admin/__seed?token=wrong-token',
    { env, body: SEED_BODY });
  assert.equal(res.status, 403);
});

test('POST /admin/__seed happy path writes users + tiers + config/seeded', async () => {
  const env = makeEnv();
  const { res, body } = await call(worker, 'POST', '/admin/__seed?token=test-bootstrap',
    { env, body: SEED_BODY });
  assert.equal(res.status, 200, `expected 200 got ${res.status}: ${JSON.stringify(body)}`);
  assert.equal(body.data.seeded.users, 2);
  assert.equal(body.data.seeded.tiers, 5);

  // Users are stored with verifiable PBKDF2 hashes.
  const rootRaw = await env.RZ_AUTH_KV.get('users/root@resistancezero.com');
  assert.ok(rootRaw);
  const root = JSON.parse(rootRaw);
  assert.equal(root.email, 'root@resistancezero.com');
  assert.equal(root.tier, 'root');
  assert.equal(root.role, 'root');
  assert.equal(root.status, 'active');
  assert.equal(typeof root.passwordHash, 'string');
  assert.equal(typeof root.salt, 'string');
  assert.equal(root.iters, 100_000);
  // PBKDF2 must verify
  assert.equal(await verifyPassword('root-pw-1', root.salt, root.passwordHash), true);
  assert.equal(await verifyPassword('not-the-password', root.salt, root.passwordHash), false);

  // Tiers are stored with isSystem:true
  const freeRaw = await env.RZ_AUTH_KV.get('tiers/free');
  assert.ok(freeRaw);
  const free = JSON.parse(freeRaw);
  assert.equal(free.isSystem, true);
  assert.equal(free.label, 'Free');
  assert.equal(free.priority, 10);

  // Self-disable flag is set
  const seededRaw = await env.RZ_AUTH_KV.get('config/seeded');
  assert.ok(seededRaw);
  const seeded = JSON.parse(seededRaw);
  assert.equal(seeded.users, 2);
  assert.equal(seeded.tiers, 5);
});

test('POST /admin/__seed → 403 on second call (config/seeded already set)', async () => {
  const env = makeEnv();
  const first = await call(worker, 'POST', '/admin/__seed?token=test-bootstrap',
    { env, body: SEED_BODY });
  assert.equal(first.res.status, 200);
  const second = await call(worker, 'POST', '/admin/__seed?token=test-bootstrap',
    { env, body: SEED_BODY });
  assert.equal(second.res.status, 403);
});

test('POST /admin/__seed → 400 on malformed body', async () => {
  const env = makeEnv();
  const { res } = await call(worker, 'POST', '/admin/__seed?token=test-bootstrap',
    { env, body: { users: 'not-an-array' } });
  assert.equal(res.status, 400);
});

test('POST /admin/__seed → 403 when BOOTSTRAP_SEED_TOKEN is unset on env', async () => {
  // If the secret is missing, the endpoint must refuse rather than accept any token.
  const env = makeEnv({ BOOTSTRAP_SEED_TOKEN: undefined });
  const { res } = await call(worker, 'POST', '/admin/__seed?token=anything',
    { env, body: SEED_BODY });
  assert.equal(res.status, 403);
});
