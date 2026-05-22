/**
 * GET /auth/me — current-session hydrate endpoint.
 *
 * The browser auth.js calls this on every page load to know what tier/role
 * the current cookie maps to. Must 401 silently when there's no session
 * (no leakage about missing vs expired).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { hashPassword, newSalt, b64encode } from '../src/lib/crypto.js';
import { makeEnv, call, extractSessionCookie } from './_helpers.mjs';

async function loggedInCookie(env, { tier = 'pro', role = 'user' } = {}) {
  const salt = newSalt();
  const passwordHash = await hashPassword('me-pw', salt);
  await env.RZ_AUTH_KV.put(`users/me@resistancezero.com`, JSON.stringify({
    email: 'me@resistancezero.com',
    passwordHash, salt: b64encode(salt), iters: 100_000,
    tier, role, status: 'active', featureOverrides: {},
    createdAt: 1, createdBy: 'test', updatedAt: 1,
  }));
  const login = await call(worker, 'POST', '/auth/login',
    { env, body: { email: 'me@resistancezero.com', password: 'me-pw' } });
  const token = extractSessionCookie(login.res.headers.get('Set-Cookie'));
  return { cookie: `rz_sess=${token}`, token };
}

test('GET /auth/me with valid session → 200 + email/role/tier/expiresAt', async () => {
  const env = makeEnv();
  const { cookie } = await loggedInCookie(env, { tier: 'educator', role: 'user' });
  const { res, body } = await call(worker, 'GET', '/auth/me', { env, cookie });
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.email, 'me@resistancezero.com');
  assert.equal(body.data.tier, 'educator');
  assert.equal(body.data.role, 'user');
  assert.equal(typeof body.data.expiresAt, 'number');
});

test('GET /auth/me with no cookie → 401', async () => {
  const env = makeEnv();
  const { res, body } = await call(worker, 'GET', '/auth/me', { env });
  assert.equal(res.status, 401);
  assert.equal(body.error, 'not authenticated');
});

test('GET /auth/me with bogus session token → 401', async () => {
  const env = makeEnv();
  const { res } = await call(worker, 'GET', '/auth/me',
    { env, cookie: 'rz_sess=nope-not-a-real-token' });
  assert.equal(res.status, 401);
});
