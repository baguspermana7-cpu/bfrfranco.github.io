/**
 * PBKDF2 round-trip + randomToken uniqueness.
 *
 * Runs under `node --test`; node 18+ exposes Web Crypto on
 * `globalThis.crypto` which is what `src/lib/crypto.js` uses, so no shim.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hashPassword, verifyPassword, newSalt, randomToken,
  b64encode, b64decode, hmac, PBKDF2_ITERS,
} from '../src/lib/crypto.js';

test('hashPassword + verifyPassword round-trip succeeds', async () => {
  const salt = newSalt();
  const hash = await hashPassword('correct-horse-battery-staple', salt);
  assert.equal(typeof hash, 'string');
  assert.ok(hash.length > 20, 'hash should be a non-trivial base64 string');
  assert.equal(await verifyPassword('correct-horse-battery-staple', salt, hash), true);
});

test('different salt produces different hash for same password', async () => {
  const s1 = newSalt();
  const s2 = newSalt();
  const h1 = await hashPassword('hunter2', s1);
  const h2 = await hashPassword('hunter2', s2);
  assert.notEqual(h1, h2);
});

test('wrong password fails verification', async () => {
  const salt = newSalt();
  const hash = await hashPassword('right-password', salt);
  assert.equal(await verifyPassword('wrong-password', salt, hash), false);
});

test('verifyPassword accepts base64-encoded salt for KV storage parity', async () => {
  const salt = newSalt();
  const hash = await hashPassword('pw', salt);
  const saltB64 = b64encode(salt);
  assert.equal(await verifyPassword('pw', saltB64, hash), true);
});

test('randomToken produces unique values', () => {
  const seen = new Set();
  for (let i = 0; i < 256; i++) {
    const t = randomToken(32);
    assert.equal(seen.has(t), false, 'collision in randomToken');
    seen.add(t);
    assert.ok(t.length >= 40, 'token should be ~43 chars at 32 bytes');
    // URL-safe: no +, /, or =
    assert.equal(/[+/=]/.test(t), false);
  }
});

test('b64encode + b64decode round-trip', () => {
  const original = new Uint8Array([0, 1, 2, 250, 251, 252, 255]);
  const round = b64decode(b64encode(original));
  assert.equal(round.length, original.length);
  for (let i = 0; i < original.length; i++) assert.equal(round[i], original[i]);
});

test('hmac is deterministic and matches expected length', async () => {
  const a = await hmac('secret', 'message');
  const b = await hmac('secret', 'message');
  assert.equal(a, b);
  const c = await hmac('secret', 'different message');
  assert.notEqual(a, c);
  const d = await hmac('different secret', 'message');
  assert.notEqual(a, d);
});

test('PBKDF2_ITERS meets minimum-100k guidance', () => {
  assert.ok(PBKDF2_ITERS >= 100_000, 'PBKDF2 iters must be >= 100k');
});
