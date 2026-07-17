# /calc — server-side DC-OS engine (anti-theft) — deploy guide

The DC-OS math (RZEngine) now runs on the Cloudflare Worker so the model source
never ships to the browser. A public static site cannot hide served JS — making
the GitHub repo private does NOT protect the math; running it server-side does.
This is the real IP protection.

## What it is
- `src/calc.js` + `src/engine-shim.js` load repo-root `rz-engine.js` inside the
  Worker (browser-global stubs first) and expose one endpoint:
  - `POST /calc` `{ "model": "capex.detailed", "args": [ {…inputs} ] }` → runs
    the allow-listed `RZEngine.models.<path>` and returns `{ok,data}`.
  - `POST /calc` `{ "data": "capexDetail.cityCapexPerW" }` → an allow-listed
    `RZEngine.data.<path>` read.
  - `GET /calc/models` → the allow-list (introspection).
- Defence-in-depth: only the model/data namespaces in the ALLOWED sets are
  reachable (no `auth`/`ui`/arbitrary property access), origin-locked CORS
  (`cors.js`), optional Supabase-JWT gate, best-effort `audit_log` insert.
- Verified: `node cf-worker/test/calc.test.mjs` (7/7 — engine loads + dispatches
  server-side).

## One-time owner deploy
1. Set secrets (Cloudflare dashboard or wrangler):
   - `wrangler secret put SUPABASE_URL` (project URL)
   - `wrangler secret put SUPABASE_ANON_KEY`
   - `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (for audit; optional)
   - Optionally `REQUIRE_AUTH=1` (env var, in `wrangler.toml [vars]`) to force a
     valid Supabase session on every `/calc` call.
2. `wrangler deploy` (bundles `../../rz-engine.js` inline via esbuild).
3. Confirm: `curl -X POST https://<worker>/calc -d '{"model":"reliability.tierTarget","args":[4]}'`
   → `{"ok":true,"data":0.99995,...}`.

## Client migration (later, incremental)
The DCMOC bridge (`dcmoc/src/lib/rz-engine.ts`) + calculators keep using the
window-global engine today. To move a consumer server-side, swap its transport to
`fetch('<worker>/calc', {method:'POST', body: JSON.stringify({model, args}), headers:{Authorization:'Bearer '+token}})`
behind the same facade — callers unchanged. Do this per-consumer once the endpoint
is live; the window-global stays as a dev/fallback. Full migration = the math stops
shipping to the browser.

## Note
Making the repo private is good hygiene but does not protect the served JS. Only
this server-side path does. If the site itself must be non-public, that's a
separate hosting change (auth-gated app, not GitHub Pages).
