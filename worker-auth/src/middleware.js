/**
 * Request-level helpers shared by every endpoint.
 *
 * Kept tiny on purpose: each function does ONE thing the router would
 * otherwise re-implement inline. They throw `Error('<reason>')` rather
 * than returning Responses so the router stays the single place that
 * decides status codes and envelope shape.
 */

import { parseCookie, readSession } from './lib/session.js';

const COOKIE_NAME = 'rz_sess';
const DEFAULT_MAX_BYTES = 10 * 1024; // 10 KB body cap (plan §3, §6).

export function originOf(request) {
  return request.headers.get('Origin') || null;
}

/**
 * Best-effort client IP extraction. CF-Connecting-IP is set by Cloudflare on
 * every Worker request; X-Forwarded-For is the curl/dev fallback. Returns
 * the literal string `'unknown'` so callers always get a valid KV key — never
 * `null`/`undefined` (which would explode `kvPut`).
 */
export function clientIp(request) {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0];
    if (first) {
      const trimmed = first.trim();
      if (trimmed) return trimmed;
    }
  }
  return 'unknown';
}

/**
 * Read + parse a JSON request body with a strict size cap. Throws
 * `Error('bad body')` on any failure (oversize, non-JSON, empty) so the
 * router can map every failure mode to a single 400 path without leaking
 * which check tripped.
 */
export async function readJsonBody(request, maxBytes = DEFAULT_MAX_BYTES) {
  let text;
  try {
    text = await request.text();
  } catch {
    throw new Error('bad body');
  }
  if (text == null) throw new Error('bad body');
  if (text.length > maxBytes) throw new Error('bad body');
  if (text.length === 0) throw new Error('bad body');
  try {
    const parsed = JSON.parse(text);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('bad body');
    }
    return parsed;
  } catch {
    throw new Error('bad body');
  }
}

/**
 * Resolve the calling session from the rz_sess cookie. Throws
 * `Error('unauthenticated')` on any miss/expired so the router maps to 401
 * uniformly. The exact failure reason stays server-side (audit log) — the
 * wire response never distinguishes "no cookie" from "expired".
 */
export async function requireSession(request, env) {
  const token = parseCookie(request.headers.get('Cookie'), COOKIE_NAME);
  if (!token) throw new Error('unauthenticated');
  const session = await readSession(token, env);
  if (!session) throw new Error('unauthenticated');
  return { session, token };
}

export function getSessionCookieToken(request) {
  return parseCookie(request.headers.get('Cookie'), COOKIE_NAME);
}

export { COOKIE_NAME };
