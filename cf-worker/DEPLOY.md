# Deploy — rz-finance-gateway (Finance Terminal Phase 1)

A Cloudflare Worker that fronts Finnhub + Yahoo + CoinGecko + Frankfurter with a
**server-side** Finnhub key and KV caching, so the browser never sees a token and the
Finance Terminal stops depending on flaky public CORS proxies. Closes B-006 / B-008 /
B-009 / B-010 / B-011 / B-012 at the root.

Everything here is a **one-time owner task** (needs your Cloudflare account). The Worker
code + endpoints are already built and tested locally (`npm test`).

## 0. Prerequisites
- A free Cloudflare account.
- Your Finnhub API token (the 40-char key; a free key is fine — 55 req/min, the Worker
  caches so that's plenty). You can rotate to a fresh/private key here — the browser
  never sees it.

Run the static preflight first (no wrangler/login/network needed) — it confirms the
package is sound and reminds you of the pre-deploy steps:
```bash
cd cf-worker
npm run preflight
```
It parses every worker module, checks the endpoint↔docs contract + secret hygiene, and
warns if the KV ids in `wrangler.toml` are still placeholders. "READY" (or "READY with
warnings" for the expected KV step) = good to proceed.

## 1. Log in
```bash
cd cf-worker
npx wrangler login          # opens a browser to authorize
```

## 2. Create the two KV namespaces, paste the IDs into wrangler.toml
```bash
npx wrangler kv namespace create rz_ft_quote_cache
npx wrangler kv namespace create rz_ft_meta_cache
```
Each prints an `id`. Edit `wrangler.toml` and replace the placeholders:
- `QUOTE_CACHE` → id from `rz_ft_quote_cache`
- `META_CACHE`  → id from `rz_ft_meta_cache`
(You can leave `preview_id` as the same id, or create `--preview` namespaces.)

## 3. Set the Finnhub secret (never committed)
```bash
npx wrangler secret put FINNHUB_TOKEN
# paste your token when prompted
```

## 4. Deploy
```bash
npx wrangler deploy
```
Wrangler prints the URL, e.g. `https://rz-finance-gateway.<your-subdomain>.workers.dev`.
Smoke-test it:
```bash
curl https://rz-finance-gateway.<your-subdomain>.workers.dev/healthz
curl https://rz-finance-gateway.<your-subdomain>.workers.dev/sectors
```

## 5. Turn the client on (no code deploy needed)
The Finance Terminal already has the V2 code path. Enable it by setting two
localStorage values in the browser (DevTools console on the terminal page, or a
bookmarklet). Paste your deployed URL:
```js
localStorage.setItem('rz_ft_gw','https://rz-finance-gateway.<your-subdomain>.workers.dev');
localStorage.setItem('rz_ft_v2','1');
location.reload();
```
Sectors / Economy / Futures / Commodities / News now load from the gateway. To turn it
off: `localStorage.removeItem('rz_ft_v2'); location.reload();`

**Later (optional, coordinate with whoever owns `Apps/finance-terminal/index.html`):**
flip the defaults so every visitor uses the gateway — set `CFG.GW` to the deployed URL
and `V2:true` in the `CFG` object (one line each). That's the only edit to the client.

## Endpoints
`/healthz /version` · `/sectors /economy /futures /q?syms= /candles?sym=&tf= /crypto
/screener?minMcap&maxPe&sector&minDiv&dayChange /fx /fx-history?from&to&days /news?topic=
/analyze?sym=&tf=` · primitives `/quote /profile /metric /search`.

Every response is `{ok:true,data:…}` (or `{ok:false,error,…}`). CORS is locked to
`ALLOWED_ORIGINS` in `wrangler.toml` (production = `https://resistancezero.com`; the
localhost entries are for local dev and are harmless in prod).

## CoinGecko note
`/crypto` calls CoinGecko's keyless public API with a browser-like User-Agent. If
Cloudflare→CoinGecko is rate-limited/403 in production, either (a) the client already
falls back to direct browser→CoinGecko for crypto (it works without a proxy), or (b)
add a free CoinGecko demo key later. Not a blocker for the other tabs.

## Local development
```bash
cd cf-worker
# .dev.vars already holds a Finnhub token for local testing (gitignored)
npx wrangler dev --local --port 8787
node test/gateway.test.mjs           # 18 endpoint assertions
```

## Cost
Free tier: 100k Worker requests/day + generous KV reads. With KV caching (quotes 30s,
profiles 24h, candles 5m) a normal user session is a few dozen origin fetches. Well
within free limits.

## Phase 2 (later)
Finnhub webhook receiver (`POST /finnhub-webhook`, secret-verified — stub present) +
cron cache-warm (`[triggers]` in wrangler.toml) + alert push (Telegram/email). See R-009 / R-012.
