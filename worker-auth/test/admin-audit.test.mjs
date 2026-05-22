/**
 * GET /admin/audit — paginated audit log with chronological order + filters.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { audit } from '../src/lib/audit.js';
import { makeEnv, call, seedUser, seedSystemTiers, loginAs } from './_helpers.mjs';

async function asRoot(env) {
  await seedSystemTiers(env);
  await seedUser(env, { email: 'root@resistancezero.com', password: 'root-pw', tier: 'root', role: 'root' });
  return loginAs(worker, env, 'root@resistancezero.com', 'root-pw');
}

async function seedAuditEntries(env) {
  // Generate distinct entries with deterministic ordering by spacing them.
  await audit(env, { actor: 'alice@example.com', action: 'user.create', target: 'bob@example.com' });
  await new Promise(r => setTimeout(r, 5));
  await audit(env, { actor: 'alice@example.com', action: 'user.update', target: 'bob@example.com' });
  await new Promise(r => setTimeout(r, 5));
  await audit(env, { actor: 'bob@example.com', action: 'login.ok', target: 'bob@example.com' });
}

test('GET /admin/audit → 401 without session', async () => {
  const env = makeEnv();
  const { res } = await call(worker, 'GET', '/admin/audit', { env });
  assert.equal(res.status, 401);
});

test('GET /admin/audit → 200 returns entries in chronological order', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  await seedAuditEntries(env);

  const { res, body } = await call(worker, 'GET', '/admin/audit', { env, cookie });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data.entries));
  // At minimum the 3 seeded entries are present (plus the login.ok from asRoot).
  const seededActions = body.data.entries
    .filter(e => ['user.create', 'user.update'].includes(e.action))
    .map(e => e.action);
  assert.deepEqual(seededActions, ['user.create', 'user.update']);
});

test('GET /admin/audit?actor= filters by actor', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  await seedAuditEntries(env);

  const { res, body } = await call(worker, 'GET', '/admin/audit?actor=bob@example.com',
    { env, cookie });
  assert.equal(res.status, 200);
  for (const e of body.data.entries) {
    assert.equal(e.actor, 'bob@example.com');
  }
});

test('GET /admin/audit?action= filters by action prefix', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  await seedAuditEntries(env);

  const { res, body } = await call(worker, 'GET', '/admin/audit?action=user.create',
    { env, cookie });
  assert.equal(res.status, 200);
  for (const e of body.data.entries) {
    assert.equal(e.action, 'user.create');
  }
});

test('GET /admin/audit respects limit', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  await seedAuditEntries(env);

  const { res, body } = await call(worker, 'GET', '/admin/audit?limit=2',
    { env, cookie });
  assert.equal(res.status, 200);
  assert.ok(body.data.entries.length <= 2);
});
