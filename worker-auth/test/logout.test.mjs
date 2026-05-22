/**
 * POST /auth/logout — revokes session + clears cookie.
 *
 * We exercise the full login → logout → me cycle here rather than
 * inserting a session record by hand, because the cookie-passing path
 * is exactly what the production browser does and it's the only way to
 * catch cookie-attribute regressions.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { hashPassword, newSalt, b64encode } from '../src/lib/crypto.js';
import { makeEnv, call, extractSessionCookie } from './_helpers.mjs';

async function seedAndLogin(env) {
  const salt = newSalt();
  const passwordHash = await hashPassword('logout-pw', salt);
  await env.RZ_AUTH_KV.put(`users/logout@resistancezero.com`, JSON.stringify({
    email: 'logout@resistancezero.com',
    passwordHash, salt: b64encode(salt), iters: 100_000,
    tier: 'pro', role: 'user', status: 'active', featureOverrides: {},
    createdAt: 1, createdBy: 'test', updatedAt: 1,
  }));
  const login = await call(worker, 'POST', '/auth/login',
    { env, body: { email: 'logout@resistancezero.com', password: 'logout-pw' } });
  const token = extractSessionCookie(login.res.headers.get('Set-Cookie'));
  return { token, cookie: `rz_sess=${token}` };
}

test('POST /auth/logout revokes the session', async () => {
  const env = makeEnv();
  const { token, cookie } = await seedAndLogin(env);
  // Sanity: session is in KV before logout.
  assert.ok(await env.RZ_AUTH_KV.get(`sessions/${token}`));

  const { res, body } = await call(worker, 'POST', '/auth/logout',
    { env, cookie, body: {} });
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.ok, true);

  // Session is gone.
  assert.equal(await env.RZ_AUTH_KV.get(`sessions/${token}`), null);

  // Cookie clear header is set.
  const setCookie = res.headers.get('Set-Cookie');
  assert.ok(setCookie, 'logout must emit a Set-Cookie to clear rz_sess');
  assert.match(setCookie, /rz_sess=/);
  assert.match(setCookie, /Max-Age=0/);
});

test('GET /auth/me after logout returns 401', async () => {
  const env = makeEnv();
  const { cookie } = await seedAndLogin(env);
  await call(worker, 'POST', '/auth/logout', { env, cookie, body: {} });
  const me = await call(worker, 'GET', '/auth/me', { env, cookie });
  assert.equal(me.res.status, 401);
  assert.equal(me.body.error, 'not authenticated');
});

test('POST /auth/logout with no cookie still returns 200 (idempotent)', async () => {
  const env = makeEnv();
  const { res } = await call(worker, 'POST', '/auth/logout', { env, body: {} });
  assert.equal(res.status, 200);
});
