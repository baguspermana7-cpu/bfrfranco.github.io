/**
 * Audit S12 — worker-auth hardening.
 *
 *   (a) POST /auth/login and /admin/__seed accept only `Content-Type:
 *       application/json` and an allowlisted Origin. A `text/plain` POST is a
 *       "simple request" a hostile page can send cross-site without a CORS
 *       preflight, so without this a third-party page could log a victim's
 *       browser into an attacker-chosen account (login CSRF).
 *       POST /auth/logout has no body, so only the Origin rule applies.
 *   (b) The seed token travels in the `X-Seed-Token` header (query strings land
 *       in access logs and browser history) and is compared in constant time.
 *   (c) With the LOGIN_LIMITER Durable Object bound, concurrent login attempts
 *       from one IP cannot slip past the 5-per-window limit.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker, { LoginRateLimiter } from '../src/index.js';
import { constantTimeEqual } from '../src/lib/crypto.js';
import { LOGIN_MAX } from '../src/lib/ratelimit.js';
import { makeEnv, call, seedUser, ORIGIN } from './_helpers.mjs';

const SEED_BODY = {
  users: [{ email: 'root@resistancezero.com', password: 'root-pw-1', tier: 'root', role: 'root' }],
  tiers: [{ name: 'root', label: 'Root', priority: 99 }],
};

async function rawPost(env, pathname, { origin = ORIGIN, contentType = 'application/json', body = '{}', headers = {} } = {}) {
  const h = { ...headers };
  if (origin) h.Origin = origin;
  if (contentType) h['Content-Type'] = contentType;
  h['cf-connecting-ip'] = '203.0.113.9';
  const res = await worker.fetch(
    new Request(`https://gateway.example${pathname}`, { method: 'POST', headers: h, body }),
    env, {});
  return res;
}

// ---------------------------------------------------------------- (a) login CSRF

test('S12a login: text/plain body with valid credentials is refused (415), no cookie set', async () => {
  const env = makeEnv();
  await seedUser(env, { email: 'csrf@resistancezero.com', password: 'pw-csrf-1' });
  const res = await rawPost(env, '/auth/login', {
    contentType: 'text/plain',
    body: JSON.stringify({ email: 'csrf@resistancezero.com', password: 'pw-csrf-1' }),
  });
  assert.equal(res.status, 415);
  assert.equal(res.headers.get('Set-Cookie'), null);
});

test('S12a login: foreign Origin is refused (403) even with JSON + valid credentials', async () => {
  const env = makeEnv();
  await seedUser(env, { email: 'csrf2@resistancezero.com', password: 'pw-csrf-2' });
  const res = await rawPost(env, '/auth/login', {
    origin: 'https://evil.example',
    body: JSON.stringify({ email: 'csrf2@resistancezero.com', password: 'pw-csrf-2' }),
  });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('Set-Cookie'), null);
});

test('S12a login: missing Origin is refused (403)', async () => {
  const env = makeEnv();
  await seedUser(env, { email: 'csrf3@resistancezero.com', password: 'pw-csrf-3' });
  const res = await rawPost(env, '/auth/login', {
    origin: null,
    body: JSON.stringify({ email: 'csrf3@resistancezero.com', password: 'pw-csrf-3' }),
  });
  assert.equal(res.status, 403);
});

test('S12a login: application/json with charset + allowlisted Origin still logs in (200)', async () => {
  const env = makeEnv();
  await seedUser(env, { email: 'ok@resistancezero.com', password: 'pw-ok-1' });
  const res = await rawPost(env, '/auth/login', {
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ email: 'ok@resistancezero.com', password: 'pw-ok-1' }),
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Set-Cookie') || '', /rz_sess=/);
});

test('S12a seed: text/plain body is refused (415) even with the right token header', async () => {
  const env = makeEnv();
  const res = await rawPost(env, '/admin/__seed', {
    contentType: 'text/plain',
    body: JSON.stringify(SEED_BODY),
    headers: { 'X-Seed-Token': 'test-bootstrap' },
  });
  assert.equal(res.status, 415);
  assert.equal(await env.RZ_AUTH_KV.get('config/seeded'), null);
});

test('S12a logout: foreign Origin is refused (403)', async () => {
  const env = makeEnv();
  const res = await rawPost(env, '/auth/logout', { origin: 'https://evil.example', contentType: null, body: null });
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------- (b) seed token

test('S12b seed: correct token in the QUERY STRING is no longer accepted (403)', async () => {
  const env = makeEnv();
  const { res } = await call(worker, 'POST', '/admin/__seed?token=test-bootstrap', { env, body: SEED_BODY });
  assert.equal(res.status, 403);
  assert.equal(await env.RZ_AUTH_KV.get('config/seeded'), null);
});

test('S12b seed: correct token in the X-Seed-Token header seeds (200)', async () => {
  const env = makeEnv();
  const res = await rawPost(env, '/admin/__seed', {
    body: JSON.stringify(SEED_BODY),
    headers: { 'X-Seed-Token': 'test-bootstrap' },
  });
  assert.equal(res.status, 200);
  assert.ok(await env.RZ_AUTH_KV.get('config/seeded'));
});

test('S12b seed: wrong header token, and a prefix of the right one, are refused (403)', async () => {
  for (const bad of ['wrong', 'test-bootstra', 'test-bootstrap-x', '']) {
    const env = makeEnv();
    const res = await rawPost(env, '/admin/__seed', {
      body: JSON.stringify(SEED_BODY),
      headers: { 'X-Seed-Token': bad },
    });
    assert.equal(res.status, 403, `token ${JSON.stringify(bad)}`);
  }
});

test('S12b constantTimeEqual compares digests: equal, unequal, different length, non-string', async () => {
  assert.equal(await constantTimeEqual('abc', 'abc'), true);
  assert.equal(await constantTimeEqual('abc', 'abd'), false);
  assert.equal(await constantTimeEqual('abc', 'abcd'), false);
  assert.equal(await constantTimeEqual('', ''), false, 'empty secret never matches');
  assert.equal(await constantTimeEqual(null, 'abc'), false);
});

test('S12b handleSeed no longer compares the token with !== / === (source check)', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const seed = src.slice(src.indexOf('async function handleSeed'), src.indexOf('// Gate 2'));
  assert.ok(seed.length > 0);
  assert.doesNotMatch(seed, /searchParams\.get\(['"]token['"]\)/);
  assert.doesNotMatch(seed, /[!=]==\s*expected/);
  assert.match(seed, /constantTimeEqual\(/);
});

// ---------------------------------------------------------------- (c) atomic limiter

/** In-process stand-in for a Durable Object namespace: one instance per name. */
function makeLimiterNamespace() {
  const instances = new Map();
  const storage = () => {
    const m = new Map();
    return {
      async get(k) { return m.get(k); },
      async put(k, v) { m.set(k, v); },
      async delete(k) { m.delete(k); },
    };
  };
  return {
    idFromName(name) { return name; },
    get(id) {
      if (!instances.has(id)) instances.set(id, new LoginRateLimiter({ storage: storage() }, {}));
      const obj = instances.get(id);
      return { fetch: (input, init) => obj.fetch(new Request(input, init)) };
    },
  };
}

test('S12c 10 CONCURRENT login attempts from one IP: at most LOGIN_MAX get past the limiter', async () => {
  const env = makeEnv({ LOGIN_LIMITER: makeLimiterNamespace() });
  const attempts = Array.from({ length: 10 }, () =>
    call(worker, 'POST', '/auth/login', { env, body: { email: 'x@resistancezero.com', password: 'nope' } }));
  const results = await Promise.all(attempts);
  const notBlocked = results.filter((r) => r.res.status !== 429).length;
  assert.equal(notBlocked, LOGIN_MAX, `statuses ${results.map((r) => r.res.status).join(',')}`);
});
