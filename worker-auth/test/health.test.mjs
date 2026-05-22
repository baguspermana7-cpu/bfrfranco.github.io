/**
 * Boot-level tests for src/index.js — router + envelope + CORS.
 *
 * No KV needed for /health, so env is just `{}`. Synthesises Request objects
 * against the default export and asserts envelope shape + CORS headers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

const ORIGIN = 'https://resistancezero.com';

async function call(method, pathname, { origin } = {}) {
  const headers = {};
  if (origin) headers['Origin'] = origin;
  const req = new Request(`https://gateway.example${pathname}`, { method, headers });
  const res = await worker.fetch(req, {}, {});
  let body = null;
  const text = await res.text();
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { res, body };
}

test('GET /health returns ok envelope', async () => {
  const { res, body } = await call('GET', '/health', { origin: ORIGIN });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(body.ok, true);
  assert.equal(body.error, null);
  assert.equal(body.data.status, 'ok');
  assert.equal(body.data.name, 'rz-auth-gateway');
  assert.equal(typeof body.ts, 'number');
});

test('GET /health reflects allowlisted Origin in CORS header', async () => {
  const { res } = await call('GET', '/health', { origin: ORIGIN });
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(res.headers.get('Access-Control-Allow-Credentials'), 'true');
  assert.equal(res.headers.get('Vary'), 'Origin');
});

test('OPTIONS preflight from allowlisted origin returns 204 + CORS headers', async () => {
  const { res } = await call('OPTIONS', '/anything', { origin: ORIGIN });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(res.headers.get('Access-Control-Allow-Methods'), 'GET, POST, PATCH, DELETE, OPTIONS');
  assert.equal(res.headers.get('Access-Control-Allow-Headers'), 'Content-Type, X-CSRF-Token');
  assert.equal(res.headers.get('Access-Control-Allow-Credentials'), 'true');
});

test('OPTIONS preflight from non-allowlisted origin is rejected with 403', async () => {
  const { res } = await call('OPTIONS', '/anything', { origin: 'https://evil.example' });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

test('OPTIONS preflight with no Origin is rejected with 403', async () => {
  const { res } = await call('OPTIONS', '/anything');
  assert.equal(res.status, 403);
});

test('GET /unknown returns 404 envelope with error message', async () => {
  const { res, body } = await call('GET', '/unknown', { origin: ORIGIN });
  assert.equal(res.status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.data, null);
  assert.equal(body.error, 'not found');
});

test('local dev origin is allowlisted', async () => {
  const { res } = await call('GET', '/health', { origin: 'http://127.0.0.1:8081' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:8081');
});
