/**
 * Admin CRUD endpoints — R-015 Phase 2.
 *
 * All endpoints in this module:
 *   1. require an authenticated session via the rz_sess cookie
 *   2. require `session.role === 'root'`
 *   3. require `X-CSRF-Token === session.csrf` on POST/PATCH/DELETE
 *   4. write an audit-log entry for every state change
 *   5. return the standard `{ok, data, error, ts}` envelope
 *
 * Routing is centralised in `handleAdminRoute` so `src/index.js` stays a
 * thin dispatcher. Each handler is invoked with `(request, env, ctx,
 * session, urlObj)` so it has everything needed without re-parsing.
 *
 * NEVER return passwordHash / salt / iters — the sanitisation layer is
 * applied at every read site (`sanitizeUser`) so accidental leaks fail
 * loud in code review.
 */

import { kvGet, kvPut, kvDelete, kvList } from '../lib/kv.js';
import {
  hashPassword, newSalt, b64encode, PBKDF2_ITERS,
} from '../lib/crypto.js';
import { nowSec } from '../lib/session.js';
import { audit } from '../lib/audit.js';
import { readJsonBody, requireAdmin, requireCsrf, clientIp } from '../middleware.js';
import { PAGE_KEYS } from '../data/page-keys.js';

const VALID_ROLES = new Set(['free', 'demo', 'pro', 'educator', 'root']);
const VALID_STATUSES = new Set(['active', 'disabled']);
const TIER_NAME_RE = /^[a-z0-9-]{2,20}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MIN_PASSWORD = 8;

// ---------------------------------------------------------------------------
// Tiny envelope helpers (mirror the shape used in src/index.js — kept local
// so admin.js has no circular import on the router module).
// ---------------------------------------------------------------------------

function envelope(data, error = null) {
  return {
    ok: error == null,
    data: error == null ? (data ?? null) : null,
    error: error ?? null,
    ts: Date.now(),
  };
}

function json(data, { status = 200, error = null, headers = {} } = {}) {
  return new Response(JSON.stringify(envelope(data, error)), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeUser(rec) {
  if (!rec) return null;
  const { passwordHash, salt, iters, ...safe } = rec;
  return safe;
}

function normaliseEmail(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (!trimmed.includes('@') || trimmed.length > 254) return null;
  return trimmed;
}

function decodeEmailPath(segment) {
  // The router strips the prefix and hands the remaining `:email`. URLs may
  // be percent-encoded — decode + normalise so casing/whitespace don't slip
  // through.
  try {
    return normaliseEmail(decodeURIComponent(segment));
  } catch {
    return null;
  }
}

async function tierExists(env, name) {
  const rec = await kvGet(env.RZ_AUTH_KV, `tiers/${name}`);
  return rec != null;
}

async function countUsersByTier(env, tierName) {
  const list = await kvList(env.RZ_AUTH_KV, { prefix: 'users/' });
  let n = 0;
  for (const k of list.keys) {
    const u = await kvGet(env.RZ_AUTH_KV, k.name);
    if (u && u.tier === tierName) n++;
  }
  return n;
}

async function revokeAllSessionsForEmail(env, email) {
  // Best-effort — admin reset/disable should always succeed even if we
  // can't enumerate every session (KV list has a soft 1000-key page cap;
  // production sessions are < 1k anyway).
  const list = await kvList(env.RZ_AUTH_KV, { prefix: 'sessions/' });
  for (const k of list.keys) {
    const rec = await kvGet(env.RZ_AUTH_KV, k.name);
    if (rec && rec.email === email) {
      try { await kvDelete(env.RZ_AUTH_KV, k.name); } catch { /* swallow */ }
    }
  }
}

// ---------------------------------------------------------------------------
// GET /admin/users
// ---------------------------------------------------------------------------

async function handleListUsers(request, env, _session, urlObj) {
  const limit = Math.min(parseInt(urlObj.searchParams.get('limit') || '50', 10) || 50, 1000);
  const cursor = urlObj.searchParams.get('cursor') || undefined;
  const q = (urlObj.searchParams.get('q') || '').trim().toLowerCase();

  const list = await kvList(env.RZ_AUTH_KV, { prefix: 'users/', limit, cursor });
  const users = [];
  for (const k of list.keys) {
    const rec = await kvGet(env.RZ_AUTH_KV, k.name);
    if (!rec) continue;
    if (q && !String(rec.email || '').toLowerCase().includes(q)) continue;
    users.push(sanitizeUser(rec));
  }
  return json({ users, cursor: list.cursor || null, listComplete: !!list.list_complete });
}

// ---------------------------------------------------------------------------
// POST /admin/users
// ---------------------------------------------------------------------------

async function handleCreateUser(request, env, session) {
  requireCsrf(request, session);

  let body;
  try { body = await readJsonBody(request); }
  catch { return json(null, { status: 400, error: 'bad request' }); }

  const email = normaliseEmail(body.email);
  if (!email) return json(null, { status: 400, error: 'bad email' });
  if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD) {
    return json(null, { status: 400, error: `password must be at least ${MIN_PASSWORD} chars` });
  }
  if (typeof body.tier !== 'string' || !body.tier) {
    return json(null, { status: 400, error: 'tier required' });
  }
  if (!(await tierExists(env, body.tier))) {
    return json(null, { status: 400, error: 'unknown tier' });
  }
  if (typeof body.role !== 'string' || !VALID_ROLES.has(body.role)) {
    return json(null, { status: 400, error: 'invalid role' });
  }
  const status = typeof body.status === 'string' ? body.status : 'active';
  if (!VALID_STATUSES.has(status)) {
    return json(null, { status: 400, error: 'invalid status' });
  }

  const existing = await kvGet(env.RZ_AUTH_KV, `users/${email}`);
  if (existing) return json(null, { status: 409, error: 'email exists' });

  const salt = newSalt();
  const passwordHash = await hashPassword(body.password, salt);
  const tsNow = nowSec();
  const featureOverrides = (body.featureOverrides && typeof body.featureOverrides === 'object')
    ? body.featureOverrides
    : {};

  const rec = {
    email,
    passwordHash,
    salt: b64encode(salt),
    iters: PBKDF2_ITERS,
    tier: body.tier,
    role: body.role,
    status,
    featureOverrides,
    createdAt: tsNow,
    createdBy: session.email,
    updatedAt: tsNow,
  };
  await kvPut(env.RZ_AUTH_KV, `users/${email}`, rec);

  await audit(env, {
    actor: session.email,
    action: 'user.create',
    target: email,
    after: { tier: rec.tier, role: rec.role, status: rec.status },
    ip: clientIp(request),
    ua: request.headers.get('user-agent') || null,
  });

  return json({ user: sanitizeUser(rec) });
}

// ---------------------------------------------------------------------------
// PATCH /admin/users/:email
// ---------------------------------------------------------------------------

async function handleUpdateUser(request, env, session, email) {
  requireCsrf(request, session);

  let body;
  try { body = await readJsonBody(request); }
  catch { return json(null, { status: 400, error: 'bad request' }); }

  const before = await kvGet(env.RZ_AUTH_KV, `users/${email}`);
  if (!before) return json(null, { status: 404, error: 'not found' });

  const next = { ...before };
  if (body.tier !== undefined) {
    if (typeof body.tier !== 'string' || !(await tierExists(env, body.tier))) {
      return json(null, { status: 400, error: 'unknown tier' });
    }
    next.tier = body.tier;
  }
  if (body.role !== undefined) {
    if (typeof body.role !== 'string' || !VALID_ROLES.has(body.role)) {
      return json(null, { status: 400, error: 'invalid role' });
    }
    next.role = body.role;
  }
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.has(body.status)) {
      return json(null, { status: 400, error: 'invalid status' });
    }
    next.status = body.status;
  }
  if (body.featureOverrides !== undefined) {
    if (!body.featureOverrides || typeof body.featureOverrides !== 'object' || Array.isArray(body.featureOverrides)) {
      return json(null, { status: 400, error: 'invalid featureOverrides' });
    }
    next.featureOverrides = body.featureOverrides;
  }
  next.updatedAt = nowSec();
  next.updatedBy = session.email;

  await kvPut(env.RZ_AUTH_KV, `users/${email}`, next);

  await audit(env, {
    actor: session.email,
    action: 'user.update',
    target: email,
    before: { tier: before.tier, role: before.role, status: before.status,
              featureOverrides: before.featureOverrides },
    after:  { tier: next.tier,  role: next.role,  status: next.status,
              featureOverrides: next.featureOverrides },
    ip: clientIp(request),
    ua: request.headers.get('user-agent') || null,
  });

  return json({ user: sanitizeUser(next) });
}

// ---------------------------------------------------------------------------
// POST /admin/users/:email/reset-password
// ---------------------------------------------------------------------------

async function handleResetPassword(request, env, session, email) {
  requireCsrf(request, session);

  let body;
  try { body = await readJsonBody(request); }
  catch { return json(null, { status: 400, error: 'bad request' }); }

  if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD) {
    return json(null, { status: 400, error: `password must be at least ${MIN_PASSWORD} chars` });
  }

  const existing = await kvGet(env.RZ_AUTH_KV, `users/${email}`);
  if (!existing) return json(null, { status: 404, error: 'not found' });

  const salt = newSalt();
  const passwordHash = await hashPassword(body.password, salt);
  const next = {
    ...existing,
    passwordHash,
    salt: b64encode(salt),
    iters: PBKDF2_ITERS,
    updatedAt: nowSec(),
    updatedBy: session.email,
  };
  await kvPut(env.RZ_AUTH_KV, `users/${email}`, next);
  await revokeAllSessionsForEmail(env, email);

  // Audit entry NEVER carries the plaintext password — only the event itself.
  await audit(env, {
    actor: session.email,
    action: 'user.reset-password',
    target: email,
    ip: clientIp(request),
    ua: request.headers.get('user-agent') || null,
  });

  return json({ email, reset: true });
}

// ---------------------------------------------------------------------------
// DELETE /admin/users/:email
// ---------------------------------------------------------------------------

async function handleDeleteUser(request, env, session, email, urlObj) {
  requireCsrf(request, session);

  const hard = urlObj.searchParams.get('hard') === '1';
  const existing = await kvGet(env.RZ_AUTH_KV, `users/${email}`);
  if (!existing) return json(null, { status: 404, error: 'not found' });

  if (hard && existing.role === 'root') {
    return json(null, { status: 403, error: 'cannot hard-delete root user' });
  }

  if (hard) {
    await kvDelete(env.RZ_AUTH_KV, `users/${email}`);
    await revokeAllSessionsForEmail(env, email);
    await audit(env, {
      actor: session.email,
      action: 'user.delete',
      target: email,
      before: { tier: existing.tier, role: existing.role, status: existing.status },
      ip: clientIp(request),
      ua: request.headers.get('user-agent') || null,
    });
    return json({ email, deleted: 'hard' });
  }

  const next = {
    ...existing,
    status: 'disabled',
    disabledAt: nowSec(),
    updatedAt: nowSec(),
    updatedBy: session.email,
  };
  await kvPut(env.RZ_AUTH_KV, `users/${email}`, next);
  await revokeAllSessionsForEmail(env, email);
  await audit(env, {
    actor: session.email,
    action: 'user.disable',
    target: email,
    before: { status: existing.status },
    after:  { status: 'disabled' },
    ip: clientIp(request),
    ua: request.headers.get('user-agent') || null,
  });
  return json({ user: sanitizeUser(next) });
}

// ---------------------------------------------------------------------------
// GET /admin/tiers
// ---------------------------------------------------------------------------

async function handleListTiers(request, env) {
  const list = await kvList(env.RZ_AUTH_KV, { prefix: 'tiers/' });
  const tiers = [];
  for (const k of list.keys) {
    const rec = await kvGet(env.RZ_AUTH_KV, k.name);
    if (!rec) continue;
    tiers.push({
      name: rec.name,
      label: rec.label,
      priority: typeof rec.priority === 'number' ? rec.priority : 0,
      color: rec.color || null,
      defaultFeatures: rec.defaultFeatures || {},
      isSystem: !!rec.isSystem,
    });
  }
  tiers.sort((a, b) => a.priority - b.priority);
  return json({ tiers });
}

// ---------------------------------------------------------------------------
// POST /admin/tiers
// ---------------------------------------------------------------------------

async function handleCreateTier(request, env, session) {
  requireCsrf(request, session);

  let body;
  try { body = await readJsonBody(request); }
  catch { return json(null, { status: 400, error: 'bad request' }); }

  if (typeof body.name !== 'string' || !TIER_NAME_RE.test(body.name)) {
    return json(null, { status: 400, error: 'invalid tier name (must match [a-z0-9-]{2,20})' });
  }
  if (typeof body.label !== 'string' || body.label.length === 0 || body.label.length > 60) {
    return json(null, { status: 400, error: 'invalid label' });
  }
  if (typeof body.priority !== 'number' || !Number.isFinite(body.priority) ||
      body.priority < 0 || body.priority > 1000) {
    return json(null, { status: 400, error: 'priority must be 0..1000' });
  }
  if (typeof body.color !== 'string' || !HEX_COLOR_RE.test(body.color)) {
    return json(null, { status: 400, error: 'color must be a 6-digit hex (e.g. #22d3ee)' });
  }
  if (body.defaultFeatures !== undefined &&
      (body.defaultFeatures === null || typeof body.defaultFeatures !== 'object' || Array.isArray(body.defaultFeatures))) {
    return json(null, { status: 400, error: 'defaultFeatures must be an object' });
  }

  const existing = await kvGet(env.RZ_AUTH_KV, `tiers/${body.name}`);
  if (existing) return json(null, { status: 409, error: 'tier exists' });

  const rec = {
    name: body.name,
    label: body.label,
    priority: body.priority,
    color: body.color,
    defaultFeatures: body.defaultFeatures || {},
    isSystem: false,
  };
  await kvPut(env.RZ_AUTH_KV, `tiers/${body.name}`, rec);

  await audit(env, {
    actor: session.email,
    action: 'tier.create',
    target: body.name,
    after: { label: rec.label, priority: rec.priority, color: rec.color },
    ip: clientIp(request),
    ua: request.headers.get('user-agent') || null,
  });

  return json({ tier: rec });
}

// ---------------------------------------------------------------------------
// PATCH /admin/tiers/:name
// ---------------------------------------------------------------------------

async function handleUpdateTier(request, env, session, name) {
  requireCsrf(request, session);

  if (typeof name !== 'string' || !TIER_NAME_RE.test(name)) {
    return json(null, { status: 400, error: 'invalid tier name' });
  }

  let body;
  try { body = await readJsonBody(request); }
  catch { return json(null, { status: 400, error: 'bad request' }); }

  const before = await kvGet(env.RZ_AUTH_KV, `tiers/${name}`);
  if (!before) return json(null, { status: 404, error: 'not found' });

  const next = { ...before };
  if (body.label !== undefined) {
    if (typeof body.label !== 'string' || !body.label || body.label.length > 60) {
      return json(null, { status: 400, error: 'invalid label' });
    }
    next.label = body.label;
  }
  if (body.priority !== undefined) {
    if (typeof body.priority !== 'number' || !Number.isFinite(body.priority) ||
        body.priority < 0 || body.priority > 1000) {
      return json(null, { status: 400, error: 'priority must be 0..1000' });
    }
    // System tiers can't be shuffled below 10 — that range is reserved for
    // the foundational free→demo→pro→root ladder.
    if (before.isSystem && body.priority < 10) {
      return json(null, { status: 400, error: 'system tier priority must stay >= 10' });
    }
    next.priority = body.priority;
  }
  if (body.color !== undefined) {
    if (typeof body.color !== 'string' || !HEX_COLOR_RE.test(body.color)) {
      return json(null, { status: 400, error: 'color must be a 6-digit hex' });
    }
    next.color = body.color;
  }
  if (body.defaultFeatures !== undefined) {
    if (!body.defaultFeatures || typeof body.defaultFeatures !== 'object' || Array.isArray(body.defaultFeatures)) {
      return json(null, { status: 400, error: 'defaultFeatures must be an object' });
    }
    next.defaultFeatures = body.defaultFeatures;
  }
  await kvPut(env.RZ_AUTH_KV, `tiers/${name}`, next);

  await audit(env, {
    actor: session.email,
    action: 'tier.update',
    target: name,
    before: { label: before.label, priority: before.priority, color: before.color, defaultFeatures: before.defaultFeatures },
    after:  { label: next.label,   priority: next.priority,   color: next.color,   defaultFeatures: next.defaultFeatures },
    ip: clientIp(request),
    ua: request.headers.get('user-agent') || null,
  });

  return json({ tier: next });
}

// ---------------------------------------------------------------------------
// DELETE /admin/tiers/:name
// ---------------------------------------------------------------------------

async function handleDeleteTier(request, env, session, name) {
  requireCsrf(request, session);

  const before = await kvGet(env.RZ_AUTH_KV, `tiers/${name}`);
  if (!before) return json(null, { status: 404, error: 'not found' });
  if (before.isSystem) {
    return json(null, { status: 403, error: 'cannot delete system tier' });
  }
  const userCount = await countUsersByTier(env, name);
  if (userCount > 0) {
    // Return the count so the UI can render a meaningful banner.
    return new Response(JSON.stringify({
      ok: false,
      data: { userCount },
      error: `cannot delete: ${userCount} user(s) still attached`,
      ts: Date.now(),
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  await kvDelete(env.RZ_AUTH_KV, `tiers/${name}`);
  await audit(env, {
    actor: session.email,
    action: 'tier.delete',
    target: name,
    before: { label: before.label, priority: before.priority, color: before.color },
    ip: clientIp(request),
    ua: request.headers.get('user-agent') || null,
  });
  return json({ name, deleted: true });
}

// ---------------------------------------------------------------------------
// GET /admin/pages
// ---------------------------------------------------------------------------

function handleListPages() {
  return json({ pages: PAGE_KEYS });
}

// ---------------------------------------------------------------------------
// GET /admin/audit
// ---------------------------------------------------------------------------

async function handleListAudit(request, env, _session, urlObj) {
  const limit = Math.min(parseInt(urlObj.searchParams.get('limit') || '50', 10) || 50, 1000);
  const cursor = urlObj.searchParams.get('cursor') || undefined;
  const actorFilter = urlObj.searchParams.get('actor') || null;
  const actionFilter = urlObj.searchParams.get('action') || null;
  const sinceRaw = urlObj.searchParams.get('since');
  const untilRaw = urlObj.searchParams.get('until');
  const since = sinceRaw ? Date.parse(sinceRaw) : null;
  const until = untilRaw ? Date.parse(untilRaw) : null;

  // kvList prefix scan returns keys in lexicographic order; because audit
  // keys are ISO-timestamp prefixed, that's already chronological.
  const list = await kvList(env.RZ_AUTH_KV, { prefix: 'audit/', limit: 1000, cursor });
  const entries = [];
  for (const k of list.keys) {
    const rec = await kvGet(env.RZ_AUTH_KV, k.name);
    if (!rec) continue;
    if (actorFilter && rec.actor !== actorFilter) continue;
    if (actionFilter && rec.action !== actionFilter) continue;
    if (since != null && !Number.isNaN(since) && rec.ts < since) continue;
    if (until != null && !Number.isNaN(until) && rec.ts > until) continue;
    entries.push(rec);
    if (entries.length >= limit) break;
  }
  return json({ entries, cursor: list.cursor || null, listComplete: !!list.list_complete });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Route an `/admin/*` request (excluding the legacy `/admin/__seed`).
 * Returns a `Response` directly so the index.js dispatcher can pass it
 * through to its CORS-decorating helper.
 */
export async function handleAdminRoute(request, env, _ctx, urlObj) {
  const { pathname } = urlObj;
  const { method } = request;

  // Auth + role gate runs for every /admin/* path. The thrown
  // {status, message} shape is mapped directly onto the envelope.
  let session;
  try {
    ({ session } = await requireAdmin(request, env));
  } catch (err) {
    return json(null, { status: err.status || 401, error: err.message || 'unauthorized' });
  }

  try {
    // NB: each branch awaits its handler INSIDE the try so synchronous
    // throws from `requireCsrf(...)` (and async-throws from the validators)
    // land in the catch below rather than escaping as unhandled rejections.

    // --- /admin/users -----------------------------------------------------
    if (pathname === '/admin/users') {
      if (method === 'GET')  return await handleListUsers(request, env, session, urlObj);
      if (method === 'POST') return await handleCreateUser(request, env, session);
      return json(null, { status: 405, error: 'method not allowed' });
    }

    // /admin/users/:email + sub-paths
    if (pathname.startsWith('/admin/users/')) {
      const rest = pathname.slice('/admin/users/'.length);
      if (rest.endsWith('/reset-password')) {
        const emailSegment = rest.slice(0, -'/reset-password'.length);
        const email = decodeEmailPath(emailSegment);
        if (!email) return json(null, { status: 400, error: 'bad email' });
        if (method !== 'POST') return json(null, { status: 405, error: 'method not allowed' });
        return await handleResetPassword(request, env, session, email);
      }
      // No further slashes allowed in :email segment.
      if (rest.includes('/')) {
        return json(null, { status: 404, error: 'not found' });
      }
      const email = decodeEmailPath(rest);
      if (!email) return json(null, { status: 400, error: 'bad email' });
      if (method === 'PATCH')  return await handleUpdateUser(request, env, session, email);
      if (method === 'DELETE') return await handleDeleteUser(request, env, session, email, urlObj);
      return json(null, { status: 405, error: 'method not allowed' });
    }

    // --- /admin/tiers -----------------------------------------------------
    if (pathname === '/admin/tiers') {
      if (method === 'GET')  return await handleListTiers(request, env);
      if (method === 'POST') return await handleCreateTier(request, env, session);
      return json(null, { status: 405, error: 'method not allowed' });
    }
    if (pathname.startsWith('/admin/tiers/')) {
      const name = pathname.slice('/admin/tiers/'.length);
      if (!name || name.includes('/')) return json(null, { status: 404, error: 'not found' });
      if (method === 'PATCH')  return await handleUpdateTier(request, env, session, name);
      if (method === 'DELETE') return await handleDeleteTier(request, env, session, name);
      return json(null, { status: 405, error: 'method not allowed' });
    }

    // --- /admin/pages -----------------------------------------------------
    if (pathname === '/admin/pages') {
      if (method === 'GET') return handleListPages();
      return json(null, { status: 405, error: 'method not allowed' });
    }

    // --- /admin/audit -----------------------------------------------------
    if (pathname === '/admin/audit') {
      if (method === 'GET') return await handleListAudit(request, env, session, urlObj);
      return json(null, { status: 405, error: 'method not allowed' });
    }

    return json(null, { status: 404, error: 'not found' });
  } catch (err) {
    // requireCsrf / nested validators throw {status, message}.
    if (err && typeof err === 'object' && 'status' in err) {
      return json(null, { status: err.status, error: err.message || 'forbidden' });
    }
    console.error('[rz-auth-gateway:admin] unhandled error:', err && err.stack || err);
    return json(null, { status: 500, error: 'internal error' });
  }
}
