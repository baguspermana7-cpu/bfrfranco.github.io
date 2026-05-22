/**
 * Admin user-CRUD endpoints (R-015 Phase 2).
 *
 *   GET    /admin/users
 *   POST   /admin/users
 *   PATCH  /admin/users/:email
 *   POST   /admin/users/:email/reset-password
 *   DELETE /admin/users/:email
 *
 * All endpoints require session.role === 'root' + CSRF on state-changing
 * methods + audit-log every write. PBKDF2 verification is invoked directly
 * against the stored hash so reset-password tests confirm the new password
 * works without round-tripping through /auth/login.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { verifyPassword } from '../src/lib/crypto.js';
import {
  makeEnv, call, adminCall, seedUser, seedSystemTiers, loginAs,
} from './_helpers.mjs';

async function asRoot(env) {
  await seedSystemTiers(env);
  await seedUser(env, { email: 'root@resistancezero.com', password: 'root-pw', tier: 'root', role: 'root' });
  return loginAs(worker, env, 'root@resistancezero.com', 'root-pw');
}

async function asEducator(env) {
  await seedSystemTiers(env);
  await seedUser(env, { email: 'educator@resistancezero.com', password: 'edu-pw', tier: 'pro', role: 'educator' });
  return loginAs(worker, env, 'educator@resistancezero.com', 'edu-pw');
}

// ---------------------------------------------------------------------------
// GET /admin/users
// ---------------------------------------------------------------------------

test('GET /admin/users → 401 without session', async () => {
  const env = makeEnv();
  const { res, body } = await call(worker, 'GET', '/admin/users', { env });
  assert.equal(res.status, 401);
  assert.equal(body.error, 'not authenticated');
});

test('GET /admin/users → 403 for non-root role', async () => {
  const env = makeEnv();
  const { cookie } = await asEducator(env);
  const { res, body } = await call(worker, 'GET', '/admin/users', { env, cookie });
  assert.equal(res.status, 403);
  assert.equal(body.error, 'admin only');
});

test('GET /admin/users → 200 sanitized list for root', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  await seedUser(env, { email: 'a@example.com', password: 'pw', tier: 'free', role: 'free' });
  await seedUser(env, { email: 'b@example.com', password: 'pw', tier: 'pro', role: 'free' });

  const { res, body } = await call(worker, 'GET', '/admin/users', { env, cookie });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data.users));
  assert.ok(body.data.users.length >= 3);
  for (const u of body.data.users) {
    assert.equal(u.passwordHash, undefined, 'passwordHash must be stripped');
    assert.equal(u.salt, undefined, 'salt must be stripped');
    assert.equal(u.iters, undefined, 'iters must be stripped');
    assert.equal(typeof u.email, 'string');
    assert.equal(typeof u.tier, 'string');
    assert.equal(typeof u.role, 'string');
  }
});

test('GET /admin/users?q= filters by substring', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  await seedUser(env, { email: 'alice@example.com', password: 'pw', tier: 'free', role: 'free' });
  await seedUser(env, { email: 'bob@example.com', password: 'pw', tier: 'pro', role: 'free' });

  const { res, body } = await call(worker, 'GET', '/admin/users?q=alice', { env, cookie });
  assert.equal(res.status, 200);
  const emails = body.data.users.map(u => u.email);
  assert.ok(emails.includes('alice@example.com'));
  assert.ok(!emails.includes('bob@example.com'));
});

// ---------------------------------------------------------------------------
// POST /admin/users
// ---------------------------------------------------------------------------

test('POST /admin/users → 401 without session', async () => {
  const env = makeEnv();
  const { res } = await adminCall(worker, 'POST', '/admin/users',
    { env, body: { email: 'new@example.com', password: 'pw12345678', tier: 'free', role: 'free' } });
  assert.equal(res.status, 401);
});

test('POST /admin/users → 403 without CSRF header', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  const { res, body } = await adminCall(worker, 'POST', '/admin/users',
    { env, cookie, body: { email: 'new@example.com', password: 'pw12345678', tier: 'free', role: 'free' } });
  assert.equal(res.status, 403);
  assert.equal(body.error, 'csrf failed');
});

test('POST /admin/users → 200 + creates user with PBKDF2 hash', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res, body } = await adminCall(worker, 'POST', '/admin/users', {
    env, cookie, csrf,
    body: { email: 'New@Example.com', password: 'pw12345678', tier: 'pro', role: 'free' },
  });
  assert.equal(res.status, 200, `expected 200 got ${res.status}: ${JSON.stringify(body)}`);
  assert.equal(body.data.user.email, 'new@example.com', 'email must be normalised');
  assert.equal(body.data.user.tier, 'pro');
  assert.equal(body.data.user.role, 'free');
  assert.equal(body.data.user.status, 'active');
  assert.equal(body.data.user.passwordHash, undefined);
  assert.equal(body.data.user.salt, undefined);

  const stored = JSON.parse(await env.RZ_AUTH_KV.get('users/new@example.com'));
  assert.equal(stored.email, 'new@example.com');
  assert.equal(stored.createdBy, 'root@resistancezero.com');
  assert.equal(await verifyPassword('pw12345678', stored.salt, stored.passwordHash), true);
});

test('POST /admin/users → 409 on duplicate email', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await seedUser(env, { email: 'dupe@example.com', password: 'x', tier: 'free', role: 'free' });
  const { res, body } = await adminCall(worker, 'POST', '/admin/users', {
    env, cookie, csrf,
    body: { email: 'dupe@example.com', password: 'pw12345678', tier: 'free', role: 'free' },
  });
  assert.equal(res.status, 409);
  assert.equal(body.error, 'email exists');
});

test('POST /admin/users → 400 on invalid role', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res, body } = await adminCall(worker, 'POST', '/admin/users', {
    env, cookie, csrf,
    body: { email: 'x@example.com', password: 'pw12345678', tier: 'free', role: 'hacker' },
  });
  assert.equal(res.status, 400);
  assert.match(body.error, /role/);
});

test('POST /admin/users → 400 on unknown tier', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res, body } = await adminCall(worker, 'POST', '/admin/users', {
    env, cookie, csrf,
    body: { email: 'x@example.com', password: 'pw12345678', tier: 'ghost-tier', role: 'free' },
  });
  assert.equal(res.status, 400);
  assert.match(body.error, /tier/);
});

test('POST /admin/users → 400 on short password (<8 chars)', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res, body } = await adminCall(worker, 'POST', '/admin/users', {
    env, cookie, csrf,
    body: { email: 'x@example.com', password: 'short', tier: 'free', role: 'free' },
  });
  assert.equal(res.status, 400);
  assert.match(body.error, /password/);
});

test('POST /admin/users writes an audit-log entry', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await adminCall(worker, 'POST', '/admin/users', {
    env, cookie, csrf,
    body: { email: 'auditme@example.com', password: 'pw12345678', tier: 'free', role: 'free' },
  });
  const auditList = await env.RZ_AUTH_KV.list({ prefix: 'audit/' });
  const actions = [];
  for (const k of auditList.keys) {
    const rec = JSON.parse(await env.RZ_AUTH_KV.get(k.name));
    actions.push(rec.action);
  }
  assert.ok(actions.some(a => a.startsWith('user.create')), `expected user.create in ${actions.join(',')}`);
});

// ---------------------------------------------------------------------------
// PATCH /admin/users/:email
// ---------------------------------------------------------------------------

test('PATCH /admin/users/:email → 404 for missing user', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res, body } = await adminCall(worker, 'PATCH', '/admin/users/ghost@example.com',
    { env, cookie, csrf, body: { tier: 'pro' } });
  assert.equal(res.status, 404);
  assert.equal(body.error, 'not found');
});

test('PATCH /admin/users/:email → 200 updates tier/role/status', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await seedUser(env, { email: 'target@example.com', password: 'pw', tier: 'free', role: 'free' });

  const { res, body } = await adminCall(worker, 'PATCH', '/admin/users/target@example.com', {
    env, cookie, csrf,
    body: { tier: 'pro', role: 'educator', status: 'active' },
  });
  assert.equal(res.status, 200);
  assert.equal(body.data.user.tier, 'pro');
  assert.equal(body.data.user.role, 'educator');

  const stored = JSON.parse(await env.RZ_AUTH_KV.get('users/target@example.com'));
  assert.equal(stored.tier, 'pro');
  assert.equal(stored.role, 'educator');
});

test('PATCH /admin/users/:email → 400 on invalid status', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await seedUser(env, { email: 'target@example.com', password: 'pw', tier: 'free', role: 'free' });
  const { res } = await adminCall(worker, 'PATCH', '/admin/users/target@example.com',
    { env, cookie, csrf, body: { status: 'pending-deletion' } });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// POST /admin/users/:email/reset-password
// ---------------------------------------------------------------------------

test('POST /admin/users/:email/reset-password → 200 + new PBKDF2 verifies', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await seedUser(env, { email: 'reset@example.com', password: 'old-pw-99', tier: 'free', role: 'free' });

  const { res, body } = await adminCall(worker, 'POST', '/admin/users/reset@example.com/reset-password',
    { env, cookie, csrf, body: { password: 'brand-new-pw' } });
  assert.equal(res.status, 200, `${res.status}: ${JSON.stringify(body)}`);

  const stored = JSON.parse(await env.RZ_AUTH_KV.get('users/reset@example.com'));
  assert.equal(await verifyPassword('brand-new-pw', stored.salt, stored.passwordHash), true);
  assert.equal(await verifyPassword('old-pw-99', stored.salt, stored.passwordHash), false);
});

test('POST /admin/users/:email/reset-password → 400 on short password', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await seedUser(env, { email: 'reset@example.com', password: 'old-pw-99', tier: 'free', role: 'free' });
  const { res } = await adminCall(worker, 'POST', '/admin/users/reset@example.com/reset-password',
    { env, cookie, csrf, body: { password: 'x' } });
  assert.equal(res.status, 400);
});

test('POST /admin/users/:email/reset-password revokes existing sessions for that email', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  // Seed target + give them a live session.
  await seedUser(env, { email: 'reset@example.com', password: 'old-pw-99', tier: 'free', role: 'free' });
  const targetLogin = await loginAs(worker, env, 'reset@example.com', 'old-pw-99');

  // Confirm session exists before reset.
  const before = await env.RZ_AUTH_KV.get(`sessions/${targetLogin.token}`);
  assert.ok(before, 'pre-condition: session should exist');

  await adminCall(worker, 'POST', '/admin/users/reset@example.com/reset-password',
    { env, cookie, csrf, body: { password: 'brand-new-pw' } });

  // After reset, target's session should be gone.
  const after = await env.RZ_AUTH_KV.get(`sessions/${targetLogin.token}`);
  assert.equal(after, null, 'session should be revoked after admin reset');
});

test('reset-password audit entry never contains plaintext password', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await seedUser(env, { email: 'reset@example.com', password: 'old-pw-99', tier: 'free', role: 'free' });
  await adminCall(worker, 'POST', '/admin/users/reset@example.com/reset-password',
    { env, cookie, csrf, body: { password: 'super-secret-newpw' } });

  const auditList = await env.RZ_AUTH_KV.list({ prefix: 'audit/' });
  for (const k of auditList.keys) {
    const raw = await env.RZ_AUTH_KV.get(k.name);
    assert.ok(!raw.includes('super-secret-newpw'),
      `audit entry must NOT contain plaintext password: ${raw}`);
  }
});

// ---------------------------------------------------------------------------
// DELETE /admin/users/:email
// ---------------------------------------------------------------------------

test('DELETE /admin/users/:email → 200 soft-disables by default', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await seedUser(env, { email: 'del@example.com', password: 'pw', tier: 'free', role: 'free' });

  const { res } = await adminCall(worker, 'DELETE', '/admin/users/del@example.com',
    { env, cookie, csrf });
  assert.equal(res.status, 200);

  const stored = JSON.parse(await env.RZ_AUTH_KV.get('users/del@example.com'));
  assert.equal(stored.status, 'disabled');
  assert.equal(typeof stored.disabledAt, 'number');
});

test('DELETE /admin/users/:email?hard=1 → 200 removes record', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  await seedUser(env, { email: 'del@example.com', password: 'pw', tier: 'free', role: 'free' });

  const { res } = await adminCall(worker, 'DELETE', '/admin/users/del@example.com?hard=1',
    { env, cookie, csrf });
  assert.equal(res.status, 200);

  const stored = await env.RZ_AUTH_KV.get('users/del@example.com');
  assert.equal(stored, null, 'record should be hard-deleted');
});

test('DELETE /admin/users/:email?hard=1 → 403 on root user', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  // Another root user — must be protected from hard delete.
  await seedUser(env, { email: 'otherroot@example.com', password: 'pw', tier: 'root', role: 'root' });

  const { res, body } = await adminCall(worker, 'DELETE', '/admin/users/otherroot@example.com?hard=1',
    { env, cookie, csrf });
  assert.equal(res.status, 403);
  assert.match(body.error, /root/);

  const stored = await env.RZ_AUTH_KV.get('users/otherroot@example.com');
  assert.ok(stored, 'root user must survive blocked hard delete');
});

test('DELETE /admin/users/:email → 404 when user does not exist', async () => {
  const env = makeEnv();
  const { cookie, csrf } = await asRoot(env);
  const { res } = await adminCall(worker, 'DELETE', '/admin/users/ghost@example.com',
    { env, cookie, csrf });
  assert.equal(res.status, 404);
});
