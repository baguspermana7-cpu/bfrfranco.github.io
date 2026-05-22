/**
 * Login rate-limit (per-IP fixed window).
 *
 * 5 attempts per 15-minute window — once exceeded, return blocked until the
 * window rolls. The window is reset on successful login by the caller
 * (caller deletes `ratelimit/login/<ip>`).
 *
 * Storage layout in KV:
 *   key:   ratelimit/login/<ipKey>
 *   value: { count, windowStart }
 *
 * `windowStart` is epoch-seconds of the first attempt in the window. The TTL
 * on the KV entry is set to the window length so stale entries self-clean.
 */

import { kvGet, kvPut } from './kv.js';
import { nowSec } from './session.js';

export const LOGIN_WINDOW_SEC = 15 * 60;
export const LOGIN_MAX = 5;

export async function loginCheckAndTick(env, ipKey) {
  if (!ipKey) throw new Error('loginCheckAndTick requires ipKey');
  const key = `ratelimit/login/${ipKey}`;
  const now = nowSec();
  const prev = await kvGet(env.RZ_AUTH_KV, key);

  if (!prev || (now - prev.windowStart) >= LOGIN_WINDOW_SEC) {
    // New window — first attempt.
    await kvPut(env.RZ_AUTH_KV, key,
      { count: 1, windowStart: now },
      { expirationTtl: LOGIN_WINDOW_SEC });
    return { blocked: false, count: 1 };
  }

  const count = prev.count + 1;
  if (count > LOGIN_MAX) {
    const retryAfter = prev.windowStart + LOGIN_WINDOW_SEC - now;
    return { blocked: true, retryAfter: Math.max(retryAfter, 1) };
  }

  const remainingTtl = Math.max(prev.windowStart + LOGIN_WINDOW_SEC - now, 1);
  await kvPut(env.RZ_AUTH_KV, key,
    { count, windowStart: prev.windowStart },
    { expirationTtl: remainingTtl });
  return { blocked: false, count };
}
