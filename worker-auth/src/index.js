/**
 * rz-auth-gateway — Cloudflare Worker entry point.
 *
 * Phase 0 surface (this file):
 *   - Single default fetch handler with try/catch wrapper.
 *   - Envelope helper { ok, data, error, ts } shared with the rest of the
 *     resistancezero.com gateways (matches the finance gateway shape).
 *   - Origin-reflecting CORS (NOT wildcard) because future endpoints will set
 *     credentialled cookies; `Access-Control-Allow-Origin: *` + cookies is
 *     rejected by browsers, so the only safe option is an allowlist + reflect.
 *   - GET /health → 200.
 *   - OPTIONS preflight handled with 204 when Origin is allowlisted.
 *   - Everything else → 404.
 *
 * Protected endpoints (/auth/*, /admin/*) land in Phase 1.
 * See docs/plans/2026-05-22-user-mgmt-self-service.md §3.
 */

const ALLOWED_ORIGINS = new Set([
  'https://resistancezero.com',
  'https://www.resistancezero.com',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8090',
]);

const CORS_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, X-CSRF-Token';

function corsHeadersFor(origin) {
  // Only reflect allowlisted origins. Returns {} when origin is missing or
  // not in the allowlist — the caller decides whether to 403 or proceed
  // (e.g. /health responds 200 with no CORS headers for same-origin curl).
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': CORS_METHODS,
    'Access-Control-Allow-Headers': CORS_HEADERS,
    'Vary': 'Origin',
  };
}

function json(data, { status = 200, error = null, origin = null } = {}) {
  const body = JSON.stringify({
    ok: error == null,
    data: error == null ? (data ?? null) : null,
    error: error ?? null,
    ts: Date.now(),
  });
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeadersFor(origin),
    },
  });
}

function handlePreflight(origin) {
  const headers = corsHeadersFor(origin);
  if (!headers['Access-Control-Allow-Origin']) {
    // Disallowed origin — explicit refusal beats silent CORS error in browser.
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers });
}

function handleHealth(origin) {
  return json({ status: 'ok', name: 'rz-auth-gateway' }, { origin });
}

export default {
  async fetch(request, env, _ctx) {
    const origin = request.headers.get('Origin');
    try {
      const { method } = request;
      const { pathname } = new URL(request.url);

      if (method === 'OPTIONS') return handlePreflight(origin);

      if (method === 'GET' && pathname === '/health') return handleHealth(origin);

      return json(null, { status: 404, error: 'not found', origin });
    } catch (err) {
      // Never leak err.message to the client — log on server, opaque on wire.
      console.error('[rz-auth-gateway] unhandled error:', err && err.stack || err);
      return json(null, { status: 500, error: 'internal error', origin });
    }
  },
};
