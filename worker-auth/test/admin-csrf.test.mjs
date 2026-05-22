/**
 * CSRF enforcement across admin state-changing endpoints.
 *
 * Every POST/PATCH/DELETE under /admin/* MUST require an X-CSRF-Token header
 * matching the per-session token issued by /auth/login (double-submit pattern).
 * GET endpoints are exempt (CSRF threat model = no state change).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import {
  makeEnv, adminCall, seedUser, seedSystemTiers, loginAs,
} from './_helpers.mjs';

async function asRoot(env) {
  await seedSystemTiers(env);
  await seedUser(env, { email: 'root@resistancezero.com', password: 'root-pw', tier: 'root', role: 'root' });
  return loginAs(worker, env, 'root@resistancezero.com', 'root-pw');
}

test('POST /admin/users without CSRF → 403 csrf failed', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  const { res, body } = await adminCall(worker, 'POST', '/admin/users', {
    env, cookie,
    body: { email: 'x@example.com', password: 'pw12345678', tier: 'free', role: 'free' },
  });
  assert.equal(res.status, 403);
  assert.equal(body.error, 'csrf failed');
});

test('POST /admin/users with wrong CSRF → 403 csrf failed', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  const { res, body } = await adminCall(worker, 'POST', '/admin/users', {
    env, cookie, csrf: 'wrong-csrf-token',
    body: { email: 'x@example.com', password: 'pw12345678', tier: 'free', role: 'free' },
  });
  assert.equal(res.status, 403);
  assert.equal(body.error, 'csrf failed');
});

test('PATCH /admin/users/:email without CSRF → 403', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  await seedUser(env, { email: 't@example.com', password: 'pw', tier: 'free', role: 'free' });
  const { res } = await adminCall(worker, 'PATCH', '/admin/users/t@example.com',
    { env, cookie, body: { tier: 'pro' } });
  assert.equal(res.status, 403);
});

test('DELETE /admin/users/:email without CSRF → 403', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  await seedUser(env, { email: 't@example.com', password: 'pw', tier: 'free', role: 'free' });
  const { res } = await adminCall(worker, 'DELETE', '/admin/users/t@example.com',
    { env, cookie });
  assert.equal(res.status, 403);
});

test('POST /admin/tiers without CSRF → 403', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  const { res } = await adminCall(worker, 'POST', '/admin/tiers', {
    env, cookie,
    body: { name: 'beta', label: 'Beta', priority: 40, color: '#22d3ee' },
  });
  assert.equal(res.status, 403);
});

test('GET /admin/users does not require CSRF', async () => {
  // GETs are CSRF-exempt — they don't change state.
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  const { res } = await adminCall(worker, 'GET', '/admin/users', { env, cookie });
  assert.equal(res.status, 200);
});
