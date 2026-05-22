/**
 * GET /admin/pages — static page-key registry.
 *
 * Drives the rz-ops Feature Access matrix UI (Phase 4). Server-side static
 * source of truth so the client never invents page keys.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { makeEnv, call, seedUser, seedSystemTiers, loginAs } from './_helpers.mjs';

async function asRoot(env) {
  await seedSystemTiers(env);
  await seedUser(env, { email: 'root@resistancezero.com', password: 'root-pw', tier: 'root', role: 'root' });
  return loginAs(worker, env, 'root@resistancezero.com', 'root-pw');
}

test('GET /admin/pages → 401 without session', async () => {
  const env = makeEnv();
  const { res } = await call(worker, 'GET', '/admin/pages', { env });
  assert.equal(res.status, 401);
});

test('GET /admin/pages → 200 returns static list of {key,label}', async () => {
  const env = makeEnv();
  const { cookie } = await asRoot(env);
  const { res, body } = await call(worker, 'GET', '/admin/pages', { env, cookie });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data.pages), 'pages must be an array');
  assert.ok(body.data.pages.length >= 20, `expected >=20 pages, got ${body.data.pages.length}`);

  // Spot-check a few high-signal keys.
  const keys = body.data.pages.map(p => p.key);
  for (const required of ['datahall-ai', 'dcmoc', 'pue-calculator', 'finance-terminal', 'tier-advisor']) {
    assert.ok(keys.includes(required), `missing required page key: ${required}`);
  }
  for (const p of body.data.pages) {
    assert.equal(typeof p.key, 'string');
    assert.equal(typeof p.label, 'string');
  }
});
