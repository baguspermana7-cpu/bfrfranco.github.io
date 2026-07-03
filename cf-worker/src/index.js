// rz-finance-gateway — Cloudflare Worker.
// Server-side Finnhub key + Yahoo/CoinGecko/Frankfurter + KV cache. The browser
// never sees a token. Every successful response is the {ok:true,data} envelope the
// Finance-Terminal client's gw() helper expects; the aggregate endpoints return the
// exact shapes each V2 loader destructures (see plan Endpoint spec).
//
// Aggregate endpoints (client contract):
//   /sectors  /economy  /futures  /q?syms=  /candles?sym=&tf=  /crypto
//   /screener?minMcap&maxPe&sector&minDiv&dayChange  /fx  /fx-history?from&to&days
//   /news?topic=  /analyze?sym=&tf=
// Primitives (bonus, enveloped): /quote?symbol=  /profile?symbol=  /metric?symbol=  /search?q=
// Ops: /  /healthz  /version   ·   POST /finnhub-webhook (Phase 2 stub)

import { preflight } from "./cors.js";
import { okData, fail, statusFromError, reqParam } from "./respond.js";
import { getOrFetch } from "./cache.js";
import { finnhub } from "./finnhub.js";
import * as agg from "./aggregates.js";

const VERSION = "1.0.0-phase1";

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return preflight(request, env);

    const url = new URL(request.url);
    const p = url.pathname.replace(/\/+$/, "") || "/";

    try {
      // ── Ops ──
      if (p === "/" || p === "/healthz") return okData(request, env, { ok: true, version: VERSION });
      if (p === "/version") return okData(request, env, { version: VERSION });

      // ── Aggregate endpoints (the client V2 contract) ──
      if (p === "/sectors") return okData(request, env, await agg.sectors(request, env));
      if (p === "/economy") return okData(request, env, await agg.economy(request, env));
      if (p === "/futures") return okData(request, env, await agg.futures(request, env));
      if (p === "/q") return okData(request, env, await agg.batchQ(request, env, url));
      if (p === "/candles") return okData(request, env, await agg.candles(request, env, url));
      if (p === "/crypto") return okData(request, env, await agg.crypto(request, env));
      if (p === "/screener") return okData(request, env, await agg.screener(request, env, url));
      if (p === "/fx") return okData(request, env, await agg.fx(request, env));
      if (p === "/fx-history") return okData(request, env, await agg.fxHist(request, env, url));
      if (p === "/news") return okData(request, env, await agg.news(request, env, url));
      if (p === "/analyze") return okData(request, env, await agg.analyzeEndpoint(request, env, url));

      // ── Primitives (single-symbol, enveloped) ──
      if (p === "/quote") {
        const sym = reqParam(url, "symbol");
        const r = await getOrFetch(env.QUOTE_CACHE, `q1:${sym}`, +env.QUOTE_TTL_SEC || 30, () => finnhub.quote(sym, env));
        return okData(request, env, r.data, { source: r.source, ageMs: r.ageMs });
      }
      if (p === "/profile") {
        const sym = reqParam(url, "symbol");
        const r = await getOrFetch(env.META_CACHE, `p:${sym}`, +env.PROFILE_TTL_SEC || 86400, () => finnhub.profile(sym, env));
        return okData(request, env, r.data, { source: r.source, ageMs: r.ageMs });
      }
      if (p === "/metric") {
        const sym = reqParam(url, "symbol");
        const r = await getOrFetch(env.META_CACHE, `m:${sym}`, +env.PROFILE_TTL_SEC || 86400, () => finnhub.metric(sym, env));
        return okData(request, env, r.data, { source: r.source, ageMs: r.ageMs });
      }
      if (p === "/search") {
        const q = reqParam(url, "q");
        const r = await getOrFetch(env.META_CACHE, `s:${q.toLowerCase()}`, +env.PROFILE_TTL_SEC || 86400, () => finnhub.symbolSearch(q, env));
        return okData(request, env, r.data, { source: r.source, ageMs: r.ageMs });
      }

      // ── Phase 2 stub ──
      if (p === "/finnhub-webhook" && request.method === "POST") {
        return await handleFinnhubWebhook(request, env, ctx);
      }

      return fail(request, env, 404, "not_found", `unknown path ${p}`);
    } catch (e) {
      return fail(request, env, statusFromError(e), e.code || "internal", String(e.message || e));
    }
  },

  async scheduled(_event, _env, _ctx) {
    // Phase 2: cron cache-warm. Enable in wrangler.toml [triggers] when ready.
  },
};

// ── Finnhub webhook receiver (Phase 2 scaffold) ──
async function handleFinnhubWebhook(request, env, ctx) {
  const got = request.headers.get("X-Finnhub-Secret") || "";
  const want = env.FINNHUB_WEBHOOK_SECRET || "";
  if (!want || !timingSafeEqual(got, want)) return fail(request, env, 401, "unauthorized", "bad secret");
  ctx.waitUntil(Promise.resolve()); // TODO Phase 2: parse trade payload, update cache, eval alerts
  return okData(request, env, { ok: true });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
