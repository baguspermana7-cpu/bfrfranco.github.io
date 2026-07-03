# rz-finance-gateway

Cloudflare Worker gateway for the resistancezero.com Finance Terminal.
Phase 1 of the Finance-Terminal initiative (closes B-002..B-012 + R-011).

## Why

Today `Apps/finance-terminal/index.html` fetches Finnhub directly from the
browser (the user is prompted to paste their own key) and uses three
flaky public CORS proxies (codetabs / corsproxy.io / allorigins) for
Yahoo candles. Result: client-exposed key, slow loads, "Error loading
forex" and empty Sectors / Economy / Futures panels (the B-002..B-010
class — see `~/.claude/projects/.../memory/project_rz_bug_request_tracker.md`).

This Worker:

- holds the Finnhub token as a `wrangler secret` (the browser never sees it),
- caches every Finnhub / Yahoo response in KV with a per-endpoint TTL,
- normalises Yahoo candles to `{t,o,h,l,c,v}`,
- accepts CORS only from `resistancezero.com` + `127.0.0.1:8081` /
  `localhost:8081` (dev),
- exposes a typed REST surface the finance-terminal can swap to once
  feature-flagged.

## Setup (one-time)

```bash
cd cf-worker
npm install
npx wrangler login
# create the two KV namespaces and copy the IDs into wrangler.toml:
npm run kv:create:quote
npm run kv:create:meta
# put the secrets (you'll be prompted to paste):
npm run secret:finnhub
npm run secret:webhook   # any random string, also paste into the Finnhub webhook config
```

Then edit `wrangler.toml` and replace the `PLACEHOLDER_*` IDs with the
ones `wrangler kv:namespace create` printed.

## Dev

```bash
npm run dev
# Worker is served at http://127.0.0.1:8787
curl 'http://127.0.0.1:8787/healthz'
curl 'http://127.0.0.1:8787/quote?symbol=AAPL'
curl 'http://127.0.0.1:8787/candles?symbol=AAPL&range=1mo&interval=1d'
```

## Deploy

```bash
npm run deploy
# default workers.dev URL: https://rz-finance-gateway.<account>.workers.dev
```

## Endpoints (Phase 1)

| Method | Path | Cache TTL (s) |
|---|---|---|
| GET | `/healthz` · `/version` | — |
| GET | `/quote?symbol=AAPL` | 30 |
| GET | `/quotes?symbols=A,B,C` (max 50) | 30 (per symbol) |
| GET | `/profile?symbol=AAPL` | 86400 |
| GET | `/metric?symbol=AAPL` | 86400 |
| GET | `/candles?symbol=AAPL&range=1y&interval=1d` (Yahoo) | 300 |
| GET | `/candles-fh?symbol=AAPL&resolution=D&from=...&to=...` (Finnhub) | 300 |
| GET | `/forex?base=USD` | 300 |
| GET | `/news?symbol=AAPL&from=YYYY-MM-DD&to=YYYY-MM-DD` | 120 |
| GET | `/news-general?category=general` | 120 |
| GET | `/calendar/earnings?from=...&to=...` | 600 |
| GET | `/calendar/ipo?from=...&to=...` | 600 |
| GET | `/calendar/economic?from=...&to=...` | 1800 |
| GET | `/search?q=apple` | 86400 |
| POST | `/finnhub-webhook` (verifies `X-Finnhub-Secret`) | — |

Each response is JSON `{ ..., data, _source: "cache" \| "origin", _ageMs }`
so the client can show a freshness badge.

## Phase 2 (next)

- Enable `[triggers] crons = ["*/15 * * * *"]` in `wrangler.toml` and
  implement `scheduled()` to warm the high-traffic keys (`/quote` for
  the ticker tape symbols, top-25 sector ETFs, FX bases).
- Implement `processWebhook()` to ingest Finnhub trade events → update
  `QUOTE_CACHE` immediately + evaluate alert rules.
- Add `/alerts` endpoints + Telegram / Resend push (R-009).

## Phase 3 (later)

- IDR-stock free-float ownership correlation (R-010).
- Multi-engine prediction aggregator (R-004).

## Rollout discipline

- **DO NOT** edit `Apps/finance-terminal/index.html` to point at this
  Worker until: (a) all Phase 1 endpoints respond < 500 ms p95 against
  the deployed Worker; (b) a feature-flag (`?worker=1` query or a
  user-toggle) gates the new data path so the old terminal stays
  reachable.
- **DO NOT** commit the placeholder KV IDs as real once you've populated
  them — `wrangler.toml` IDs are not secret, but committing them now
  before you've created the namespaces just confuses the next reader.
- Token rotation: if `FINNHUB_TOKEN` ever leaks (Cloudflare dashboard
  preview, `wrangler tail` paste, etc.), rotate at finnhub.io and
  `wrangler secret put FINNHUB_TOKEN` again — no client redeploy needed.
