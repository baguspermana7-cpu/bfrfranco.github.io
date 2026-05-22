/**
 * rz-auth-gateway — Cloudflare Worker entry point.
 *
 * Phase 1 surface (this file):
 *   - GET  /health                — Phase 0
 *   - POST /auth/login            — PBKDF2 verify, per-IP rate limit, HttpOnly cookie, CSRF in body
 *   - POST /auth/logout           — revoke session, clear cookie
 *   - GET  /auth/me               — current session info (auth.js hydrate)
 *   - GET  /auth/tiers/public     — tier list (no feature matrix)
 *   - GET  /auth/features         — resolved tier defaults + per-user overrides
 *   - POST /admin/__seed          — one-time bootstrap migration (token-gated, self-disabling)
 *
 * Future admin CRUD endpoints land in Phase 2 (see plan §3 + §5 Task 2).
 *
 * Constraints honoured here:
 *   - Login errors never distinguish "unknown email" vs "wrong password"
 *     (plan §6: account enumeration → information leak).
 *   - Rate-limit is per-IP via cf-connecting-ip, fixed 5/15min window.
 *   - All unexpected errors fail CLOSED with opaque 500.
 *   - Cookie is HttpOnly + SameSite=Strict; Secure auto-on for https requests.
 *   - Origin-reflecting CORS allowlist (cookies require credentials:true, so
 *     wildcards are forbidden).
 *   - Audit log records every login attempt + the seed event; the seed handler
 *     NEVER logs plaintext passwords (only counts).
 */

import { kvGet, kvPut, kvList } from './lib/kv.js';
import {
  hashPassword,
  verifyPassword,
  newSalt,
  b64encode,
  PBKDF2_ITERS,
} from './lib/crypto.js';
import {
  createSession,
  revokeSession,
  sessionCookie,
  SESSION_TTL_SEC,
  nowSec,
} from './lib/session.js';
import { loginCheckAndTick } from './lib/ratelimit.js';
import { audit } from './lib/audit.js';
import {
  originOf,
  clientIp,
  readJsonBody,
  requireSession,
  getSessionCookieToken,
  COOKIE_NAME,
} from './middleware.js';

const ALLOWED_ORIGINS = new Set([
  'https://resistancezero.com',
  'https://www.resistancezero.com',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8090',
]);

const CORS_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, X-CSRF-Token';

function corsHeadersFor(origin) {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': CORS_METHODS,
    'Access-Control-Allow-Headers': CORS_HEADERS,
    'Vary': 'Origin',
  };
}

function json(data, { status = 200, error = null, origin = null, extraHeaders = null } = {}) {
  const body = JSON.stringify({
    ok: error == null,
    data: error == null ? (data ?? null) : null,
    error: error ?? null,
    ts: Date.now(),
  });
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeadersFor(origin),
  };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return new Response(body, { status, headers });
}

function handlePreflight(origin) {
  const headers = corsHeadersFor(origin);
  if (!headers['Access-Control-Allow-Origin']) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers });
}

function handleHealth(origin) {
  return json({ status: 'ok', name: 'rz-auth-gateway' }, { origin });
}

/**
 * Determine whether the cookie should carry the Secure attribute. Production
 * (https) always gets it; localhost http loses it because browsers won't
 * store a Secure cookie over a non-TLS connection.
 */
function isSecureRequest(request) {
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

function normaliseEmail(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  // Minimal shape check — actual deliverability isn't this endpoint's concern.
  if (!trimmed.includes('@') || trimmed.length > 254) return null;
  return trimmed;
}

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

async function handleLogin(request, env, origin) {
  const ip = clientIp(request);
  const ua = request.headers.get('user-agent') || null;

  // Rate limit FIRST so we don't burn PBKDF2 cycles on a brute-forcer.
  const rl = await loginCheckAndTick(env, ip);
  if (rl.blocked) {
    await audit(env, { actor: null, action: 'login.blocked', target: ip, ip, ua });
    return json(null, {
      status: 429,
      error: `too many attempts, retry in ${rl.retryAfter}s`,
      origin,
      extraHeaders: { 'Retry-After': String(rl.retryAfter) },
    });
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return json(null, { status: 400, error: 'bad request', origin });
  }
  const email = normaliseEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : null;
  if (!email || !password) {
    return json(null, { status: 400, error: 'bad request', origin });
  }

  const user = await kvGet(env.RZ_AUTH_KV, `users/${email}`);
  if (!user) {
    await audit(env, { actor: email, action: 'login.fail.unknown', target: email, ip, ua });
    return json(null, { status: 401, error: 'invalid credentials', origin });
  }

  let ok = false;
  try {
    ok = await verifyPassword(password, user.salt, user.passwordHash, user.iters || PBKDF2_ITERS);
  } catch {
    ok = false;
  }
  if (!ok) {
    await audit(env, { actor: email, action: 'login.fail.password', target: email, ip, ua });
    return json(null, { status: 401, error: 'invalid credentials', origin });
  }

  if (user.status === 'disabled') {
    await audit(env, { actor: email, action: 'login.fail.disabled', target: email, ip, ua });
    return json(null, { status: 403, error: 'account disabled', origin });
  }

  // Success — mint session, stamp lastLoginAt, audit, set cookie.
  const { token, csrf, expiresAt } = await createSession(
    { email: user.email, role: user.role, tier: user.tier },
    env,
  );

  const updatedUser = { ...user, lastLoginAt: nowSec() };
  try {
    await kvPut(env.RZ_AUTH_KV, `users/${email}`, updatedUser);
  } catch (err) {
    // lastLoginAt is informational — never block login on a KV hiccup here.
    console.warn('[rz-auth-gateway] lastLoginAt update failed:', err && err.message || err);
  }

  await audit(env, { actor: email, action: 'login.ok', target: email, ip, ua });

  const cookie = sessionCookie(token, { secure: isSecureRequest(request) });
  return json(
    { email: user.email, role: user.role, tier: user.tier, csrf, expiresAt },
    { origin, extraHeaders: { 'Set-Cookie': cookie } },
  );
}

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

async function handleLogout(request, env, origin) {
  const ip = clientIp(request);
  const ua = request.headers.get('user-agent') || null;
  const token = getSessionCookieToken(request);
  if (token) {
    try {
      await revokeSession(token, env);
    } catch (err) {
      console.warn('[rz-auth-gateway] revoke session failed:', err && err.message || err);
    }
  }
  await audit(env, { actor: null, action: 'logout', target: token || null, ip, ua });

  const clearCookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
  return json({ ok: true }, {
    origin,
    extraHeaders: { 'Set-Cookie': clearCookie },
  });
}

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------

async function handleMe(request, env, origin) {
  let session;
  try {
    ({ session } = await requireSession(request, env));
  } catch {
    return json(null, { status: 401, error: 'not authenticated', origin });
  }
  return json(
    {
      email: session.email,
      role: session.role,
      tier: session.tier,
      expiresAt: session.expiresAt,
    },
    { origin },
  );
}

// ---------------------------------------------------------------------------
// GET /auth/tiers/public
// ---------------------------------------------------------------------------

async function handleTiersPublic(env, origin) {
  const listing = await kvList(env.RZ_AUTH_KV, { prefix: 'tiers/' });
  const out = [];
  for (const k of listing.keys) {
    const rec = await kvGet(env.RZ_AUTH_KV, k.name);
    if (!rec) continue;
    // Project to the public shape — defaultFeatures + isSystem stay server-side.
    out.push({
      name: rec.name,
      label: rec.label,
      priority: typeof rec.priority === 'number' ? rec.priority : 0,
      color: rec.color || null,
    });
  }
  out.sort((a, b) => a.priority - b.priority);
  return json(out, { origin });
}

// ---------------------------------------------------------------------------
// GET /auth/features
// ---------------------------------------------------------------------------

async function handleFeatures(request, env, origin) {
  let session;
  try {
    ({ session } = await requireSession(request, env));
  } catch {
    // Unauthenticated callers get the free tier shape — same envelope, no leak.
    return json({ tier: 'free', role: null, features: {} }, { origin });
  }
  const tier = await kvGet(env.RZ_AUTH_KV, `tiers/${session.tier}`);
  const user = await kvGet(env.RZ_AUTH_KV, `users/${session.email}`);
  const tierDefaults = tier && tier.defaultFeatures && typeof tier.defaultFeatures === 'object'
    ? tier.defaultFeatures
    : {};
  const overrides = user && user.featureOverrides && typeof user.featureOverrides === 'object'
    ? user.featureOverrides
    : {};
  const features = { ...tierDefaults, ...overrides };
  return json(
    { tier: session.tier, role: session.role, features },
    { origin },
  );
}

// ---------------------------------------------------------------------------
// POST /admin/__seed
// ---------------------------------------------------------------------------

function isNonEmptyArray(v) {
  return Array.isArray(v) && v.length > 0;
}

async function handleSeed(request, env, origin) {
  const ip = clientIp(request);
  const ua = request.headers.get('user-agent') || null;

  // Gate 1: token must match the secret. Missing secret → reject (NOT permit).
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  const expected = env.BOOTSTRAP_SEED_TOKEN;
  if (!expected || !queryToken || queryToken !== expected) {
    await audit(env, { actor: null, action: 'seed.fail.token', target: null, ip, ua });
    return json(null, { status: 403, error: 'forbidden', origin });
  }

  // Gate 2: self-disable on second run.
  const already = await kvGet(env.RZ_AUTH_KV, 'config/seeded');
  if (already) {
    await audit(env, { actor: null, action: 'seed.fail.already', target: null, ip, ua });
    return json(null, { status: 403, error: 'already seeded', origin });
  }

  let body;
  try {
    body = await readJsonBody(request, 64 * 1024); // larger cap — seed payload may exceed 10 KB
  } catch {
    return json(null, { status: 400, error: 'bad request', origin });
  }
  if (!isNonEmptyArray(body.users) || !isNonEmptyArray(body.tiers)) {
    return json(null, { status: 400, error: 'users and tiers required', origin });
  }

  // Validate shapes BEFORE writing anything — fail loudly on partial input.
  for (const u of body.users) {
    if (!u || typeof u !== 'object') return json(null, { status: 400, error: 'bad user record', origin });
    if (!normaliseEmail(u.email)) return json(null, { status: 400, error: 'bad user email', origin });
    if (typeof u.password !== 'string' || u.password.length < 4) return json(null, { status: 400, error: 'bad user password', origin });
    if (typeof u.tier !== 'string' || !u.tier) return json(null, { status: 400, error: 'bad user tier', origin });
    if (typeof u.role !== 'string' || !u.role) return json(null, { status: 400, error: 'bad user role', origin });
  }
  for (const t of body.tiers) {
    if (!t || typeof t !== 'object') return json(null, { status: 400, error: 'bad tier record', origin });
    if (typeof t.name !== 'string' || !t.name) return json(null, { status: 400, error: 'bad tier name', origin });
    if (typeof t.label !== 'string' || !t.label) return json(null, { status: 400, error: 'bad tier label', origin });
    if (typeof t.priority !== 'number') return json(null, { status: 400, error: 'bad tier priority', origin });
  }

  // Write users.
  const tsNow = nowSec();
  let userCount = 0;
  for (const u of body.users) {
    const email = normaliseEmail(u.email);
    const salt = newSalt();
    const passwordHash = await hashPassword(u.password, salt);
    const rec = {
      email,
      passwordHash,
      salt: b64encode(salt),
      iters: PBKDF2_ITERS,
      tier: u.tier,
      role: u.role,
      status: 'active',
      featureOverrides: (u.featureOverrides && typeof u.featureOverrides === 'object') ? u.featureOverrides : {},
      createdAt: tsNow,
      createdBy: 'seed',
      updatedAt: tsNow,
    };
    await kvPut(env.RZ_AUTH_KV, `users/${email}`, rec);
    userCount++;
  }

  // Write tiers.
  let tierCount = 0;
  for (const t of body.tiers) {
    const rec = {
      name: t.name,
      label: t.label,
      priority: t.priority,
      color: t.color || null,
      defaultFeatures: (t.defaultFeatures && typeof t.defaultFeatures === 'object') ? t.defaultFeatures : {},
      isSystem: true,
    };
    await kvPut(env.RZ_AUTH_KV, `tiers/${t.name}`, rec);
    tierCount++;
  }

  // Self-disable marker — written LAST so a partial-write failure doesn't lock
  // out a retry.
  await kvPut(env.RZ_AUTH_KV, 'config/seeded', { at: tsNow, users: userCount, tiers: tierCount });
  await audit(env, {
    actor: null,
    action: 'seed',
    target: null,
    after: { users: userCount, tiers: tierCount },
    ip,
    ua,
  });

  return json({ seeded: { users: userCount, tiers: tierCount } }, { origin });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, _ctx) {
    const origin = originOf(request);
    try {
      const { method } = request;
      const { pathname } = new URL(request.url);

      if (method === 'OPTIONS') return handlePreflight(origin);

      if (method === 'GET' && pathname === '/health') return handleHealth(origin);

      if (method === 'POST' && pathname === '/auth/login') {
        return handleLogin(request, env, origin);
      }
      if (method === 'POST' && pathname === '/auth/logout') {
        return handleLogout(request, env, origin);
      }
      if (method === 'GET' && pathname === '/auth/me') {
        return handleMe(request, env, origin);
      }
      if (method === 'GET' && pathname === '/auth/tiers/public') {
        return handleTiersPublic(env, origin);
      }
      if (method === 'GET' && pathname === '/auth/features') {
        return handleFeatures(request, env, origin);
      }
      if (method === 'POST' && pathname === '/admin/__seed') {
        return handleSeed(request, env, origin);
      }

      return json(null, { status: 404, error: 'not found', origin });
    } catch (err) {
      console.error('[rz-auth-gateway] unhandled error:', err && err.stack || err);
      return json(null, { status: 500, error: 'internal error', origin });
    }
  },
};
