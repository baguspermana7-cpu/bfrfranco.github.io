// ─── /calc — server-side DC-OS engine (anti-theft) ───────────────────────────
// Runs the RZEngine math on the server so the model source never ships to the
// browser. The client POSTs { model, args } (a dotted RZEngine.models path) or
// { data } (a dotted RZEngine.data path) and receives the {ok,data} envelope.
// Origin-locked CORS (cors.js) + optional Supabase-JWT gate + best-effort audit.
//
//   POST /calc        { "model": "capex.detailed", "args": [ {...inputs} ] }
//   POST /calc        { "data": "capexDetail.cityCapexPerW" }
//   GET  /calc/models → the allowed model list (introspection)

import "./engine-shim.js";                 // side-effect: browser stubs BEFORE the engine
import RZEngine from "../../rz-engine.js";  // CJS default export = the engine
import { okData, fail } from "./respond.js";

// Allow-list of model namespaces callable from the client (defence-in-depth: no
// arbitrary property access, no auth/ui/format side-channels).
const ALLOWED = new Set([
  "capex", "opex", "tco", "roi", "workforce", "carbon", "water", "market",
  "energy", "cooling", "forecast", "sim", "reliability", "site", "architecture",
  "construction", "commissioning", "asset", "maintenance", "fuel", "capacity",
  "grid", "tax", "risk", "compliance", "charts",
  "tier", "fire", "cdu", "spares", "decision",
]);
const ALLOWED_DATA = new Set([
  "capexDetail", "markets", "regions", "pueMatrix", "capexPerMw", "carbon",
  "water", "land", "laborRates", "reliability", "site", "commissioning",
  "asset", "maintenance", "fuelGen", "capacity", "gridReliability", "tax",
  "geoRisk", "compliance", "requirements", "architecture", "deepSeaCooling",
  "refrigerants", "energy", "sources",
  "countries", "tierCodes", "redundancyLevels", "tier", "fire", "cdu", "spares", "decision",
]);

function resolvePath(root, path) {
  const parts = String(path || "").split(".");
  let cur = root;
  for (const key of parts) {
    if (cur == null || typeof cur !== "object" || !Object.prototype.hasOwnProperty.call(cur, key)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Verify a Supabase access token via the Auth API (no JWKS crypto needed).
 *  Returns the user or null. Only enforced when env.REQUIRE_AUTH is set. */
async function verifyToken(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/** Best-effort audit row (service-role REST insert) — never blocks the response. */
function audit(env, ctx, actorId, model, ok) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const body = JSON.stringify({ actor_id: actorId || null, action: `calc:${model}`, target_type: "engine", meta: { ok } });
  const p = fetch(`${env.SUPABASE_URL}/rest/v1/audit_log`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body,
  }).catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(p);
}

export async function handleCalc(request, env, ctx, url) {
  // introspection
  if (request.method === "GET" && url.pathname.replace(/\/+$/, "") === "/calc/models") {
    return okData(request, env, { models: [...ALLOWED], data: [...ALLOWED_DATA], version: RZEngine.data && RZEngine.data.version });
  }
  if (request.method !== "POST") return fail(request, env, 405, "method_not_allowed", "POST required");

  // optional auth gate (origin-CORS always applies)
  const user = await verifyToken(request, env);
  if (env.REQUIRE_AUTH === "1" && !user) return fail(request, env, 401, "unauthorized", "valid session required");

  let body;
  try { body = await request.json(); } catch { return fail(request, env, 400, "bad_json", "invalid JSON body"); }

  // data read
  if (body && body.data) {
    const top = String(body.data).split(".")[0];
    if (!ALLOWED_DATA.has(top)) return fail(request, env, 403, "data_forbidden", `data path not allowed: ${top}`);
    const val = resolvePath(RZEngine.data, body.data);
    if (val === undefined) return fail(request, env, 404, "data_not_found", body.data);
    return okData(request, env, val);
  }

  // model call
  const model = body && body.model;
  if (!model) return fail(request, env, 400, "bad_request", "model or data required");
  const ns = String(model).split(".")[0];
  if (!ALLOWED.has(ns)) { audit(env, ctx, user && user.id, model, false); return fail(request, env, 403, "model_forbidden", `model namespace not allowed: ${ns}`); }
  const fn = resolvePath(RZEngine.models, model);
  if (typeof fn !== "function") return fail(request, env, 404, "model_not_found", model);

  const args = Array.isArray(body.args) ? body.args : [];
  try {
    const out = fn.apply(null, args);
    audit(env, ctx, user && user.id, model, true);
    return okData(request, env, out, { engineVersion: RZEngine.data && RZEngine.data.version });
  } catch (e) {
    audit(env, ctx, user && user.id, model, false);
    return fail(request, env, 500, "calc_error", String((e && e.message) || e));
  }
}
