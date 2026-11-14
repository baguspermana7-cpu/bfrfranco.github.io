/**
 * Login rate-limit (per-IP fixed window).
 *
 * 5 attempts per 15-minute window — once exceeded, return blocked until the
 * window rolls.
 *
 * Two backends, same algorithm (`tickWindow` below):
 *
 *   1. Durable Object `LoginRateLimiter` (binding `LOGIN_LIMITER`, declared in
 *      wrangler.toml) — the PRODUCTION path. One object per IP
 *      (`idFromName(ip)`); every tick for that IP runs inside that single
 *      object, and the object chains ticks on one promise, so the
 *      read-count / write-count+1 step is atomic. Ten parallel attempts give
 *      exactly five passes (test/hardening-s12.test.mjs S12c).
 *
 *   2. KV fallback — used ONLY when `env.LOGIN_LIMITER` is absent (unit tests,
 *      a `wrangler dev` without the DO). KNOWN LIMITATION (audit S12c): KV has
 *      no compare-and-swap, so get → put is a non-atomic read-modify-write.
 *      Concurrent attempts from one IP all read the same count and each
 *      writes count+1, so a burst can exceed LOGIN_MAX; KV is also eventually
 *      consistent across colos (up to ~60 s). Never deploy without the DO
 *      binding. See standarization/AUTH_STANDARD.md §rz-auth-gateway.
 *
 * Why not the Workers native Rate Limiting binding: its period is 10 s or
 * 60 s only and its counters are per-colo, so it cannot express "5 per
 * 15 min per IP".
 *
 * Storage layout (both backends): { count, windowStart } — windowStart is
 * epoch-seconds of the first attempt in the window.
 *   KV key: ratelimit/login/<ipKey> (TTL = rest of the window)
 *   DO key: 'w' inside the per-IP object
 */

import { kvGet, kvPut } from './kv.js';
import { nowSec } from './session.js';

export const LOGIN_WINDOW_SEC = 15 * 60;
export const LOGIN_MAX = 5;

/** Pure window step: previous record + now → { result, next | null }. */
function tickWindow(prev, now) {
  if (!prev || (now - prev.windowStart) >= LOGIN_WINDOW_SEC) {
    return { result: { blocked: false, count: 1 }, next: { count: 1, windowStart: now } };
  }
  const count = prev.count + 1;
  if (count > LOGIN_MAX) {
    const retryAfter = prev.windowStart + LOGIN_WINDOW_SEC - now;
    return { result: { blocked: true, retryAfter: Math.max(retryAfter, 1) }, next: null };
  }
  return { result: { blocked: false, count }, next: { count, windowStart: prev.windowStart } };
}

/**
 * Durable Object: one instance per client IP. `fetch` is the only entry
 * point; it ignores the request body and performs one tick.
 */
export class LoginRateLimiter {
  constructor(state, _env) {
    this.storage = state.storage;
    this.chain = Promise.resolve();
  }

  async fetch(_request) {
    const run = this.chain.then(async () => {
      const prev = await this.storage.get('w');
      const { result, next } = tickWindow(prev, nowSec());
      if (next) await this.storage.put('w', next);
      return result;
    });
    // Keep the chain alive even if one tick throws.
    this.chain = run.catch(() => {});
    const result = await run;
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function tickViaDurableObject(ns, ipKey) {
  const stub = ns.get(ns.idFromName(ipKey));
  const res = await stub.fetch('https://login-limiter/tick', { method: 'POST' });
  if (!res.ok) throw new Error(`login limiter returned ${res.status}`);
  return res.json();
}

async function tickViaKv(env, ipKey) {
  const key = `ratelimit/login/${ipKey}`;
  const now = nowSec();
  const prev = await kvGet(env.RZ_AUTH_KV, key);
  const { result, next } = tickWindow(prev, now);
  if (next) {
    const ttl = Math.max(next.windowStart + LOGIN_WINDOW_SEC - now, 1);
    await kvPut(env.RZ_AUTH_KV, key, next, { expirationTtl: ttl });
  }
  return result;
}

export async function loginCheckAndTick(env, ipKey) {
  if (!ipKey) throw new Error('loginCheckAndTick requires ipKey');
  if (env.LOGIN_LIMITER) return tickViaDurableObject(env.LOGIN_LIMITER, ipKey);
  return tickViaKv(env, ipKey);
}
