/**
 * POST /auth/login — happy path + four refusal paths + rate-limit.
 *
 * Each case seeds a fresh fake-KV with the test user(s) it needs, then
 * synthesises a real Request through worker.fetch(). The login error
 * messages are deliberately identical between "unknown email" and "wrong
 * password" so the test enforces non-enumeration (plan §6 threat model).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { hashPassword, newSalt, b64encode } from '../src/lib/crypto.js';
import { makeEnv, call, extractSessionCookie } from './_helpers.mjs';

async function seedUser(env, { email, password, tier = 'pro', role = 'user', status = 'active' }) {
  const salt = newSalt();
  const passwordHash = await hashPassword(password, salt);
  const rec = {
    email,
    passwordHash,
    salt: b64encode(salt),
    iters: 100_000,
    tier,
    role,
    status,
    featureOverrides: {},
    createdAt: Math.floor(Date.now() / 1000),
    createdBy: 'test',
    updatedAt: Math.floor(Date.now() / 1000),
  };
  await env.RZ_AUTH_KV.put(`users/${email}`, JSON.stringify(rec));
  return rec;
}

test('POST /auth/login → 401 invalid credentials for unknown email', async () => {
  const env = makeEnv();
  const { res, body } = await call(worker, 'POST', '/auth/login',
    { env, body: { email: 'nobody@resistancezero.com', password: 'hunter2' } });
  assert.equal(res.status, 401);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'invalid credentials');
});

test('POST /auth/login → 401 invalid credentials for wrong password (same message as unknown email)', async () => {
  const env = makeEnv();
  await seedUser(env, { email: 'pro@resistancezero.com', password: 'correct-pw' });
  const { res, body } = await call(worker, 'POST', '/auth/login',
    { env, body: { email: 'pro@resistancezero.com', password: 'WRONG' } });
  assert.equal(res.status, 401);
  assert.equal(body.error, 'invalid credentials');
});

test('POST /auth/login → 403 account disabled for disabled user', async () => {
  const env = makeEnv();
  await seedUser(env, { email: 'banned@resistancezero.com', password: 'pw1234', status: 'disabled' });
  const { res, body } = await call(worker, 'POST', '/auth/login',
    { env, body: { email: 'banned@resistancezero.com', password: 'pw1234' } });
  assert.equal(res.status, 403);
  assert.equal(body.error, 'account disabled');
});

test('POST /auth/login → 200 + Set-Cookie + CSRF on correct creds', async () => {
  const env = makeEnv();
  await seedUser(env, {
    email: 'educator@resistancezero.com',
    password: 'educator2026',
    tier: 'educator',
    role: 'user',
  });
  const { res, body } = await call(worker, 'POST', '/auth/login',
    { env, body: { email: 'educator@resistancezero.com', password: 'educator2026' } });
  assert.equal(res.status, 200, `expected 200 got ${res.status} body=${JSON.stringify(body)}`);
  assert.equal(body.ok, true);
  assert.equal(body.data.email, 'educator@resistancezero.com');
  assert.equal(body.data.tier, 'educator');
  assert.equal(body.data.role, 'user');
  assert.equal(typeof body.data.csrf, 'string');
  assert.ok(body.data.csrf.length > 10);
  assert.equal(typeof body.data.expiresAt, 'number');

  // Cookie should be HttpOnly + SameSite=Strict + Path=/
  const setCookie = res.headers.get('Set-Cookie');
  assert.ok(setCookie, 'missing Set-Cookie header');
  assert.match(setCookie, /rz_sess=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Max-Age=/);

  // Session must exist in KV
  const token = extractSessionCookie(setCookie);
  assert.ok(token, 'failed to parse session token from cookie');
  const stored = await env.RZ_AUTH_KV.get(`sessions/${token}`);
  assert.ok(stored, 'session record missing in KV');
});

test('POST /auth/login is case-insensitive on email (normalised to lowercase)', async () => {
  const env = makeEnv();
  await seedUser(env, { email: 'mixed@resistancezero.com', password: 'pw1234' });
  const { res } = await call(worker, 'POST', '/auth/login',
    { env, body: { email: 'MIXED@ResistanceZero.com', password: 'pw1234' } });
  assert.equal(res.status, 200);
});

test('POST /auth/login → 400 bad body for missing fields', async () => {
  const env = makeEnv();
  const { res } = await call(worker, 'POST', '/auth/login',
    { env, body: { email: 'foo@bar.com' } });
  assert.equal(res.status, 400);
});

test('POST /auth/login → 429 + Retry-After after 5 failed attempts from same IP', async () => {
  const env = makeEnv();
  await seedUser(env, { email: 'rl@resistancezero.com', password: 'real-pw' });
  // 5 failures consume the window.
  for (let i = 0; i < 5; i++) {
    const r = await call(worker, 'POST', '/auth/login',
      { env, ip: '198.51.100.42', body: { email: 'rl@resistancezero.com', password: 'WRONG' } });
    assert.equal(r.res.status, 401, `attempt #${i + 1} should still be 401, got ${r.res.status}`);
  }
  // 6th attempt — even with CORRECT password — is blocked.
  const sixth = await call(worker, 'POST', '/auth/login',
    { env, ip: '198.51.100.42', body: { email: 'rl@resistancezero.com', password: 'real-pw' } });
  assert.equal(sixth.res.status, 429);
  assert.ok(sixth.res.headers.get('Retry-After'), 'Retry-After header required on 429');
  assert.match(sixth.body.error, /too many attempts/i);
});

test('POST /auth/login rate-limit is scoped per IP', async () => {
  const env = makeEnv();
  await seedUser(env, { email: 'multi@resistancezero.com', password: 'real-pw' });
  for (let i = 0; i < 5; i++) {
    await call(worker, 'POST', '/auth/login',
      { env, ip: '203.0.113.1', body: { email: 'multi@resistancezero.com', password: 'wrong' } });
  }
  // Different IP must still be able to log in.
  const ok = await call(worker, 'POST', '/auth/login',
    { env, ip: '203.0.113.99', body: { email: 'multi@resistancezero.com', password: 'real-pw' } });
  assert.equal(ok.res.status, 200);
});
