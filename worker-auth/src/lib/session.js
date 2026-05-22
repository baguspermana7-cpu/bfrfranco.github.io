/**
 * Session + CSRF token lifecycle.
 *
 * Storage layout in KV:
 *   key:   sessions/<token>
 *   value: { email, role, tier, csrf, expiresAt }
 *
 * KV TTL is set to SESSION_TTL_SEC so expired sessions self-purge; the
 * `expiresAt` field is also checked on read as defence-in-depth against
 * edge-cache lag.
 *
 * The session cookie is HttpOnly + SameSite=Strict + Secure. CSRF lives in
 * a per-session token returned in the login response body so the client
 * can mirror it back in the X-CSRF-Token header (double-submit pattern).
 */

import { kvGet, kvPut, kvDelete } from './kv.js';
import { randomToken } from './crypto.js';

export const SESSION_TTL_SEC = 8 * 60 * 60;
const CSRF_BYTES = 16;

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export async function createSession({ email, role, tier }, env) {
  if (!email || !role || !tier) {
    throw new Error('createSession requires email + role + tier');
  }
  const token = randomToken(32);
  const csrf = randomToken(CSRF_BYTES);
  const expiresAt = nowSec() + SESSION_TTL_SEC;
  await kvPut(env.RZ_AUTH_KV, `sessions/${token}`,
    { email, role, tier, csrf, expiresAt },
    { expirationTtl: SESSION_TTL_SEC });
  return { token, csrf, expiresAt };
}

export async function readSession(token, env) {
  if (!token) return null;
  const rec = await kvGet(env.RZ_AUTH_KV, `sessions/${token}`);
  if (!rec) return null;
  if (typeof rec.expiresAt !== 'number' || rec.expiresAt <= nowSec()) return null;
  return rec;
}

export async function revokeSession(token, env) {
  if (!token) return;
  await kvDelete(env.RZ_AUTH_KV, `sessions/${token}`);
}

export function sessionCookie(token, { secure = true } = {}) {
  const parts = [
    `rz_sess=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${SESSION_TTL_SEC}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function parseCookie(cookieHeader, name) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const parts = cookieHeader.split(/;\s*/);
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    if (p.slice(0, eq) === name) return p.slice(eq + 1);
  }
  return null;
}
