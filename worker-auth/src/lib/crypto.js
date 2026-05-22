/**
 * Crypto primitives for rz-auth-gateway.
 *
 * Pure functions, no I/O. Uses Workers `crypto.subtle` (Web Crypto), which
 * is also available on Node 18+ as `globalThis.crypto`, so the unit tests
 * run directly under `node --test` with no shim.
 *
 * Password hashing: PBKDF2-SHA-256, 100 000 iterations, 16-byte random salt,
 * 32-byte (256-bit) derived key. The salt is stored alongside the hash in
 * KV — see session.js + user records (Phase 1).
 */

export const PBKDF2_ITERS = 100_000;
const KEY_LEN_BYTES = 32;
const SALT_LEN_BYTES = 16;

const subtle = globalThis.crypto && globalThis.crypto.subtle;
if (!subtle) {
  // Fail loud at module load — better than a runtime null-deref later.
  throw new Error('crypto.subtle is not available in this runtime');
}

const enc = new TextEncoder();

export function b64encode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64decode(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function newSalt() {
  return globalThis.crypto.getRandomValues(new Uint8Array(SALT_LEN_BYTES));
}

export async function hashPassword(password, saltBytes, iters = PBKDF2_ITERS) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('password must be a non-empty string');
  }
  if (!(saltBytes instanceof Uint8Array) || saltBytes.length !== SALT_LEN_BYTES) {
    throw new Error('salt must be a Uint8Array(16)');
  }
  const keyMaterial = await subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: iters, hash: 'SHA-256' },
    keyMaterial,
    KEY_LEN_BYTES * 8
  );
  return b64encode(bits);
}

/**
 * Constant-time string compare. Both strings are walked to completion so the
 * total runtime depends only on length, not on where they diverge.
 */
function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPassword(password, salt, hash, iters = PBKDF2_ITERS) {
  if (typeof hash !== 'string') return false;
  const saltBytes = salt instanceof Uint8Array ? salt : b64decode(salt);
  const candidate = await hashPassword(password, saltBytes, iters);
  return timingSafeEqualStr(candidate, hash);
}

/**
 * URL-safe base64 random token. `bytes=32` → 43-char token (256 bits).
 * Used for session tokens, CSRF tokens, and bootstrap seed tokens.
 */
export function randomToken(bytes = 32) {
  const buf = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
  return b64encode(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hmac(secret, message) {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('hmac secret must be a non-empty string');
  }
  const key = await subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await subtle.sign('HMAC', key, enc.encode(message));
  return b64encode(sig);
}
