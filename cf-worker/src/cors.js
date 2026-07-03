// CORS helpers. The Worker accepts only the origins listed in
// env.ALLOWED_ORIGINS (comma-separated). All other origins get no CORS
// header at all (the browser rejects), and OPTIONS preflight only succeeds
// for whitelisted origins.

export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ok = allowed.includes(origin);
  const h = new Headers();
  if (ok) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Vary", "Origin");
    h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    h.set("Access-Control-Allow-Headers", "Content-Type");
    h.set("Access-Control-Max-Age", "600");
  }
  return { headers: h, ok };
}

export function preflight(request, env) {
  const { headers, ok } = corsHeaders(request, env);
  return new Response(null, { status: ok ? 204 : 403, headers });
}

export function withCors(request, env, body, init = {}) {
  const { headers } = corsHeaders(request, env);
  const out = new Headers(init.headers || {});
  for (const [k, v] of headers) out.set(k, v);
  if (!out.has("Content-Type")) out.set("Content-Type", "application/json");
  return new Response(body, { ...init, headers: out });
}
