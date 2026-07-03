// Response envelope. The client's gw() helper requires { ok:true, data:... } and
// throws on ok!==true, so EVERY successful gateway response is wrapped this way.
// Errors return { ok:false, error, message } (with a matching HTTP status).

import { withCors } from "./cors.js";

export function okData(request, env, data, meta) {
  const body = { ok: true, data };
  if (meta) body.meta = meta;
  return withCors(request, env, JSON.stringify(body), { status: 200 });
}

export function fail(request, env, status, error, message) {
  return withCors(
    request,
    env,
    JSON.stringify({ ok: false, error, message: message || error }),
    { status }
  );
}

export function statusFromError(e) {
  if (e && e.code === "bad_request") return 400;
  if (e && e.code === "no_token") return 503;
  if (e && typeof e.code === "string" && e.code.startsWith("upstream_")) {
    const n = parseInt(e.code.slice(9), 10);
    if (n >= 400 && n < 600) return n;
  }
  return 500;
}

// Require a query param or throw a typed bad_request.
export function reqParam(url, k) {
  const v = url.searchParams.get(k);
  if (!v) {
    const e = new Error(`missing required param: ${k}`);
    e.code = "bad_request";
    throw e;
  }
  return v;
}
