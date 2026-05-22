/**
 * Client-shape tests — validate the Worker contract from the perspective
 * of auth.js Phase 3.
 *
 * auth.js (client-side) calls /auth/login, /auth/me, and /auth/logout and
 * relies on specific response shapes and cookie attributes. Because
 * auth.js depends on window/document and can't be unit-tested in Node,
 * these tests instead pin the WORKER's contract so any future Worker
 * change that would break Phase 3 is caught immediately.
 *
 * Contract pinned here:
 *   - POST /auth/login returns {ok:true, data:{email, role, tier, csrf, expiresAt}}
 *     with all five fields present and correctly typed.
 *   - Set-Cookie carries HttpOnly + SameSite=Strict + Path=/.
 *   - GET /auth/me with the cookie returns the same shape MINUS csrf
 *     (csrf is only emitted at login per plan §6 threat model).
 *   - POST /auth/logout with X-CSRF-Token clears the session — next
 *     /auth/me must return 401.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import {
  makeEnv,
  call,
  seedUser,
  extractSessionCookie,
} from './_helpers.mjs';

test('POST /auth/login response shape exactly matches client expectations', async () => {
  const env = makeEnv();
  await seedUser(env, {
    email: 'shape@resistancezero.com',
    password: 'shape-pw',
    tier: 'pro',
    role: 'user',
  });

  const { res, body } = await call(worker, 'POST', '/auth/login', {
    env,
    body: { email: 'shape@resistancezero.com', password: 'shape-pw' },
  });

  assert.equal(res.status, 200);
  assert.equal(body.ok, true, 'envelope.ok must be true');
  assert.ok(body.data && typeof body.data === 'object', 'envelope.data must be object');

  // Five fields the client reads on login. ALL must be present.
  const d = body.data;
  assert.equal(typeof d.email, 'string', 'data.email must be string');
  assert.equal(d.email, 'shape@resistancezero.com');
  assert.equal(typeof d.role, 'string', 'data.role must be string');
  assert.equal(typeof d.tier, 'string', 'data.tier must be string');
  assert.equal(d.tier, 'pro');
  assert.equal(typeof d.csrf, 'string', 'data.csrf must be string');
  assert.ok(d.csrf.length >= 16, 'data.csrf must be a real token');
  assert.equal(typeof d.expiresAt, 'number', 'data.expiresAt must be number (epoch seconds)');
  assert.ok(d.expiresAt > Math.floor(Date.now() / 1000),
    'expiresAt must be in the future');
});

test('POST /auth/login Set-Cookie has HttpOnly + SameSite=Strict + Path=/', async () => {
  const env = makeEnv();
  await seedUser(env, {
    email: 'cookie@resistancezero.com',
    password: 'cookie-pw',
    tier: 'pro',
    role: 'user',
  });

  const { res } = await call(worker, 'POST', '/auth/login', {
    env,
    body: { email: 'cookie@resistancezero.com', password: 'cookie-pw' },
  });
  assert.equal(res.status, 200);

  const setCookie = res.headers.get('Set-Cookie');
  assert.ok(setCookie, 'missing Set-Cookie header');
  assert.match(setCookie, /rz_sess=/, 'cookie name must be rz_sess');
  assert.match(setCookie, /HttpOnly/i, 'HttpOnly attribute required');
  assert.match(setCookie, /SameSite=Strict/i, 'SameSite=Strict required');
  assert.match(setCookie, /Path=\//, 'Path=/ required');
});

test('GET /auth/me returns same shape (without csrf) when cookie is valid', async () => {
  const env = makeEnv();
  await seedUser(env, {
    email: 'me@resistancezero.com',
    password: 'me-pw',
    tier: 'pro',
    role: 'user',
  });

  // Log in to grab the cookie.
  const login = await call(worker, 'POST', '/auth/login', {
    env,
    body: { email: 'me@resistancezero.com', password: 'me-pw' },
  });
  const token = extractSessionCookie(login.res.headers.get('Set-Cookie'));
  assert.ok(token, 'failed to parse session token');

  // Call /auth/me with the cookie.
  const me = await call(worker, 'GET', '/auth/me', {
    env,
    cookie: `rz_sess=${token}`,
  });
  assert.equal(me.res.status, 200);
  assert.equal(me.body.ok, true);

  const d = me.body.data;
  assert.equal(typeof d.email, 'string');
  assert.equal(d.email, 'me@resistancezero.com');
  assert.equal(typeof d.role, 'string');
  assert.equal(typeof d.tier, 'string');
  assert.equal(d.tier, 'pro');
  assert.equal(typeof d.expiresAt, 'number');

  // csrf is ONLY emitted at /auth/login; /auth/me must NOT leak it
  // (re-issuing it on every page-load gives attackers more chances to
  // capture it via XSS — plan §6 threat model).
  assert.equal(d.csrf, undefined, '/auth/me must not return csrf');
});

test('POST /auth/logout with CSRF revokes session — subsequent /auth/me returns 401', async () => {
  const env = makeEnv();
  await seedUser(env, {
    email: 'logout@resistancezero.com',
    password: 'logout-pw',
    tier: 'pro',
    role: 'user',
  });

  const login = await call(worker, 'POST', '/auth/login', {
    env,
    body: { email: 'logout@resistancezero.com', password: 'logout-pw' },
  });
  const token = extractSessionCookie(login.res.headers.get('Set-Cookie'));
  const csrf = login.body.data.csrf;
  const cookie = `rz_sess=${token}`;

  // /auth/me works before logout.
  const before = await call(worker, 'GET', '/auth/me', { env, cookie });
  assert.equal(before.res.status, 200, 'pre-logout /auth/me should be 200');

  // Logout — must include X-CSRF-Token. We re-implement the call here so
  // we can attach the CSRF header (the default call() helper doesn't).
  const logoutReq = new Request('https://gateway.example/auth/logout', {
    method: 'POST',
    headers: {
      'Origin': 'https://resistancezero.com',
      'Cookie': cookie,
      'X-CSRF-Token': csrf,
      'Content-Type': 'application/json',
    },
  });
  const logoutRes = await worker.fetch(logoutReq, env, {});
  assert.equal(logoutRes.status, 200, 'logout should return 200');

  // /auth/me now returns 401 — session is revoked.
  const after = await call(worker, 'GET', '/auth/me', { env, cookie });
  assert.equal(after.res.status, 401, 'post-logout /auth/me must be 401');
  assert.equal(after.body.ok, false);
});

test('POST /auth/login expiresAt is epoch SECONDS not milliseconds', async () => {
  // auth.js Phase 3 multiplies expiresAt by 1000 to get ms — pin the unit
  // so a future refactor that switches to ms doesn't silently break the
  // client's expiry comparison.
  const env = makeEnv();
  await seedUser(env, {
    email: 'expires@resistancezero.com',
    password: 'expires-pw',
    tier: 'pro',
    role: 'user',
  });

  const { body } = await call(worker, 'POST', '/auth/login', {
    env,
    body: { email: 'expires@resistancezero.com', password: 'expires-pw' },
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = body.data.expiresAt;

  // Sessions live for days, but expiresAt is in SECONDS — sanity-check
  // that it's not in milliseconds (1e12+) or microseconds.
  assert.ok(expSec > nowSec, 'expiresAt must be future');
  assert.ok(expSec < nowSec + 90 * 24 * 3600,
    `expiresAt looks too large (${expSec}) — possibly in milliseconds?`);
  assert.ok(expSec > nowSec + 60,
    `expiresAt looks too small (${expSec}) — at least 1 minute future`);
});
