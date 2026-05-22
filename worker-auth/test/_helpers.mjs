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

/**
 * Seed a user record into KV. Hashes the password with PBKDF2 so login
 * works end-to-end. Returns the stored record.
 */
export async function seedUser(env, {
  email,
  password,
  tier = 'pro',
  role = 'user',
  status = 'active',
  featureOverrides = {},
}) {
  const { hashPassword, newSalt, b64encode, PBKDF2_ITERS } =
    await import('../src/lib/crypto.js');
  const salt = newSalt();
  const passwordHash = await hashPassword(password, salt);
  const tsNow = Math.floor(Date.now() / 1000);
  const rec = {
    email,
    passwordHash,
    salt: b64encode(salt),
    iters: PBKDF2_ITERS,
    tier,
    role,
    status,
    featureOverrides,
    createdAt: tsNow,
    createdBy: 'test',
    updatedAt: tsNow,
  };
  await env.RZ_AUTH_KV.put(`users/${email}`, JSON.stringify(rec));
  return rec;
}

/**
 * Seed a tier record into KV.
 */
export async function seedTier(env, {
  name,
  label,
  priority,
  color = '#94a3b8',
  defaultFeatures = {},
  isSystem = true,
}) {
  const rec = { name, label, priority, color, defaultFeatures, isSystem };
  await env.RZ_AUTH_KV.put(`tiers/${name}`, JSON.stringify(rec));
  return rec;
}

/**
 * Log a user in via the public /auth/login endpoint, returning the cookie +
 * CSRF token so admin tests can issue authenticated state-changing calls.
 */
export async function loginAs(worker, env, email, password) {
  const login = await call(worker, 'POST', '/auth/login',
    { env, body: { email, password } });
  if (login.res.status !== 200) {
    throw new Error(`loginAs(${email}) failed: ${login.res.status} ${JSON.stringify(login.body)}`);
  }
  const token = extractSessionCookie(login.res.headers.get('Set-Cookie'));
  const csrf = login.body.data.csrf;
  return { cookie: `rz_sess=${token}`, csrf, token };
}

/**
 * Convenience: seed system tiers covering free/demo/pro/educator/root in the
 * same shape Phase 1 seed migration produces.
 */
export async function seedSystemTiers(env) {
  await seedTier(env, { name: 'free', label: 'Free', priority: 10, color: '#94a3b8' });
  await seedTier(env, { name: 'demo', label: 'Demo', priority: 20, color: '#a78bfa' });
  await seedTier(env, { name: 'educator', label: 'Educator', priority: 25, color: '#10b981' });
  await seedTier(env, { name: 'pro', label: 'Pro', priority: 30, color: '#8b5cf6' });
  await seedTier(env, { name: 'root', label: 'Root', priority: 99, color: '#ef4444' });
}

/**
 * Pass CSRF token in calls via { csrf } shortcut.
 */
export async function adminCall(worker, method, pathname, opts = {}) {
  const headers = {};
  if (opts.csrf) headers['X-CSRF-Token'] = opts.csrf;
  // Bridge: layer onto existing call() by injecting through a Request
  // synth path. We re-implement here so the CSRF header survives.
  const url = `https://gateway.example${pathname}`;
  const init = { method, headers: { 'Origin': opts.origin || ORIGIN, ...headers } };
  if (opts.cookie) init.headers['Cookie'] = opts.cookie;
  if (opts.ip !== null) init.headers['cf-connecting-ip'] = opts.ip || '203.0.113.7';
  if (opts.body != null) {
    init.headers['Content-Type'] = 'application/json';
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  const req = new Request(url, init);
  const env = opts.env || makeEnv();
  const res = await worker.fetch(req, env, {});
  let parsed = null;
  const text = await res.text();
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = text; } }
  return { res, body: parsed };
}
