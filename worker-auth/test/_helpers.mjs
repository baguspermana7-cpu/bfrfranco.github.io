/**
 * Test helpers — fake KV + env factory + Request synthesiser.
 *
 * The fake KV mimics the bits of the Workers KV API our code touches:
 *   - get(key)              → string | null
 *   - put(key, val, opts?)  → void   (expirationTtl recorded but not enforced)
 *   - delete(key)           → void
 *   - list({prefix, limit}) → { keys: [{name}], list_complete, cursor }
 *
 * `expirationTtl` is recorded so a test can assert it was set, but we don't
 * actually expire entries — that's the live Workers runtime's job, and
 * faking time in unit tests buys nothing here.
 */

export function makeFakeKv() {
  const store = new Map(); // key -> { value: string, ttl: number|null }
  return {
    store,
    async get(key) {
      const rec = store.get(key);
      return rec ? rec.value : null;
    },
    async put(key, value, opts) {
      store.set(key, { value: String(value), ttl: opts?.expirationTtl ?? null });
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [];
      for (const k of store.keys()) {
        if (prefix && !k.startsWith(prefix)) continue;
        keys.push({ name: k });
        if (keys.length >= limit) break;
      }
      return { keys, list_complete: true, cursor: undefined };
    },
  };
}

export function makeEnv(overrides = {}) {
  return {
    RZ_AUTH_KV: makeFakeKv(),
    ADMIN_SESSION_SECRET: 'test-secret',
    BOOTSTRAP_SEED_TOKEN: 'test-bootstrap',
    ...overrides,
  };
}

export const ORIGIN = 'https://resistancezero.com';

export async function call(worker, method, pathname, {
  origin = ORIGIN,
  body = null,
  cookie = null,
  ip = '203.0.113.7',
  env = null,
} = {}) {
  const headers = { 'Origin': origin };
  if (body != null) headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;
  if (ip) headers['cf-connecting-ip'] = ip;
  const init = { method, headers };
  if (body != null) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  const req = new Request(`https://gateway.example${pathname}`, init);
  const res = await worker.fetch(req, env || makeEnv(), {});
  let parsed = null;
  const text = await res.text();
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }
  return { res, body: parsed };
}

/**
 * Extract the rz_sess cookie value from a Set-Cookie header (or null).
 */
export function extractSessionCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  const m = /(?:^|;\s*|,\s*)rz_sess=([^;,\s]+)/.exec(setCookieHeader);
  return m ? m[1] : null;
}
