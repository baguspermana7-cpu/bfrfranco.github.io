# Finance Terminal → Bloomberg-grade — Implementation Plan (Phase 0 + Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Finance Terminal tab load real data in < 5 s by routing all market data through a free Cloudflare Worker gateway, and fix the 12 enumerated client bugs — behind a feature flag, with the old terminal live until verified.

**Architecture:** A single Cloudflare Worker (free tier) does server-side fetch + multi-source fallback + KV cache + cron pre-warm, exposing one unified JSON API. The vanilla client (`Apps/finance-terminal/index.html`) swaps direct-API/CORS-proxy calls for one `API_BASE`, parallelizes loads, adds 8 s timeouts/skeletons, candlesticks, sort/filter, and the Screener/Market-Dominance fixes. Finnhub key lives only in the Worker secret.

**Tech Stack:** Cloudflare Workers + Workers KV + Cron Triggers (`wrangler`), vanilla ES (client), TradingView `lightweight-charts` (CDN), existing Python audits + Puppeteer probes for verification.

**Spec:** `docs/specs/2026-05-19-finance-terminal-bloomberg-upgrade.md`
**Tracker:** `~/.claude/projects/-home-baguspermana7/memory/project_rz_bug_request_tracker.md` (flip PENDING→SOLVED per task)

---

## Scope (this plan)

- **Phase 0:** Worker scaffold, KV, secrets, `/health`, client `API_BASE` + `rz_ft_v2` flag wiring.
- **Phase 1:** Worker endpoints `/q /candles /fx /news /screener /sectors /economy /futures /crypto`; client refactor (parallel loads, timeouts, candlesticks, sort/filter, Market Dominance, Screener fix); flag flip after verify.
- **Out of scope (separate plans, written after Phase 1 ships):** Phase 2 `/analyze` (TA/gauge/prediction/sentiment) + alerts + Finnhub webhook; Phase 3 `dca-app` + `stock_screener` parity + IDR top-buy table.

## File structure map

| File | Responsibility | Action |
|---|---|---|
| `worker/wrangler.toml` | Worker config: name, KV binding, cron, routes | Create |
| `worker/src/index.js` | Router: dispatch path → handler; CORS headers; error envelope | Create |
| `worker/src/cache.js` | KV get/set with TTL + stale-on-error | Create |
| `worker/src/sources/yahoo.js` | Yahoo quote/candle/quoteSummary fetch + schema guard | Create |
| `worker/src/sources/stooq.js` | Stooq CSV quote/candle fallback | Create |
| `worker/src/sources/finnhub.js` | Finnhub quote/news (key from `env.FINNHUB_KEY`) | Create |
| `worker/src/sources/fx.js` | Frankfurter → exchangerate.host → open.er-api chain | Create |
| `worker/src/sources/news.js` | Finnhub → Yahoo RSS → GDELT chain | Create |
| `worker/src/handlers.js` | Per-endpoint orchestration (fallback order, cache key, shape) | Create |
| `worker/test/handlers.test.mjs` | Node test: fallback order, cache, envelope, schema guards | Create |
| `worker/cron.js` (in index) | Scheduled pre-warm of popular symbols | Create |
| `Apps/finance-terminal/index.html` | Client: API layer swap, flag, timeouts, candlesticks, bug fixes | Modify |
| `tools/probe-finance-terminal.mjs` | Puppeteer probe: every tab loads real data < timeout, 0 pageerror | Create |
| `CHANGELOG.md`, `js/rz-version.js`, `sw.js` | Per-ship discipline | Modify |

**Local Worker dev:** `cd worker && npx wrangler dev` (Worker on `:8787`). Client points `API_BASE` at `http://127.0.0.1:8787` in dev, `https://<worker-prod-url>` in prod (decided in Task 0.4).

---

## Phase 0 — Foundation

### Task 0.1: Worker scaffold + config

**Files:** Create `worker/wrangler.toml`, `worker/src/index.js`, `worker/package.json`

- [ ] **Step 1:** Create `worker/package.json`:
```json
{ "name": "rz-finance-gateway", "private": true, "type": "module",
  "scripts": { "dev": "wrangler dev", "deploy": "wrangler deploy", "test": "node --test test/" },
  "devDependencies": { "wrangler": "^3" } }
```
- [ ] **Step 2:** Create `worker/wrangler.toml`:
```toml
name = "rz-finance-gateway"
main = "src/index.js"
compatibility_date = "2026-05-01"
kv_namespaces = [{ binding = "FT_KV", id = "<FILL_AFTER_0.3>" }]
[triggers]
crons = ["* * * * *"]
```
- [ ] **Step 3:** Create `worker/src/index.js` minimal router returning a JSON envelope `{ok,data,error,ts,cached}` and CORS headers `Access-Control-Allow-Origin: *` (admin page is same-origin via iframe but Worker is cross-origin), handle `OPTIONS`.
- [ ] **Step 4:** `cd worker && npm i && npx wrangler dev` → `curl -s localhost:8787/health` returns `{"ok":true,...}`. Expected: 200 JSON.
- [ ] **Step 5:** Commit `feat(worker): scaffold rz-finance-gateway + /health`.

### Task 0.2: Account + KV + secret provisioning (USER STEP — documented, not automated)

**Files:** none (ops doc only)

- [ ] **Step 1:** Add `worker/SETUP.md` with exact commands the user runs:
  - `npx wrangler login` (opens browser; user authorizes on the existing Cloudflare account that holds the resistancezero.com zone).
  - `npx wrangler kv namespace create FT_KV` → paste returned `id` into `wrangler.toml`.
  - `npx wrangler secret put FINNHUB_KEY` → user pastes the **single ~20-char API-Key-panel token** (NOT the webhook secret, NOT concatenated).
  - (optional) bind a route or use the `*.workers.dev` URL.
- [ ] **Step 2:** Note in `SETUP.md`: the pasted-in-chat key must be **rotated** at finnhub.io before this token is used (treat as exposed).
- [ ] **Step 3:** Commit `docs(worker): SETUP.md provisioning + key-rotation note`.

> **Blocking:** Tasks needing live KV/secret can be developed against `wrangler dev` local KV simulation; production deploy waits on Step 1 by the user.

### Task 0.3: KV cache module (TDD)

**Files:** Create `worker/src/cache.js`, `worker/test/cache.test.mjs`

- [ ] **Step 1: Write failing test** `cache.test.mjs`: a fake KV (Map-backed) — `getCached` returns null when absent; `setCached` then `getCached` returns value when within TTL; returns `{stale:true,...}` when past TTL but `allowStale`.
- [ ] **Step 2:** Run `node --test worker/test/cache.test.mjs` → FAIL (module missing).
- [ ] **Step 3:** Implement `cache.js`: `getCached(kv,key,ttlMs,{allowStale})` / `setCached(kv,key,data)` storing `{d,t}` JSON; stale-on-error semantics.
- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** Commit `feat(worker): KV cache with TTL + stale-on-error`.

### Task 0.4: Client API_BASE + `rz_ft_v2` feature flag

**Files:** Modify `Apps/finance-terminal/index.html` (CFG block ~line 607; fetch helpers ~664-713)

- [ ] **Step 1:** Add to `CFG`: `GW: (localStorage.getItem('rz_ft_gw') || 'https://rz-finance-gateway.<acct>.workers.dev')` and `V2: localStorage.getItem('rz_ft_v2')==='1'`.
- [ ] **Step 2:** Add a thin `gw(path, params)` helper (fetch `CFG.GW+path` with 8 s `fetchWithTimeout`, returns parsed envelope `.data` or throws).
- [ ] **Step 3:** Guard: when `!CFG.V2`, all existing code paths remain byte-unchanged (old terminal intact). New gateway paths only execute under `CFG.V2`.
- [ ] **Step 4:** Verify `audit-js-syntax.py --strict` CLEAN + `probe-all-pageerrors.mjs` on the page (flag OFF) shows 0 pageerror (no regression to live terminal).
- [ ] **Step 5:** Commit `feat(finance-terminal): API_BASE gateway helper behind rz_ft_v2 flag (no-op when off)`.

---

## Phase 1 — Bugs (per data domain, then client fixes, then flag flip)

> Pattern for each data-domain task: (a) Worker handler with fallback chain + cache (TDD on fallback/shape with mocked `fetch`), (b) client renderer reads `gw()` under `V2`, (c) probe asserts the tab populates.

### Task 1.1: FX endpoint `/fx` (fixes B-002 forex error, part of B-003 speed)

**Files:** Create `worker/src/sources/fx.js`; modify `worker/src/handlers.js`, `worker/src/index.js`; modify `Apps/finance-terminal/index.html:1575 loadForex`; test `worker/test/handlers.test.mjs`

- [ ] **Step 1: Failing test:** mock `fetch` so Frankfurter throws, exchangerate.host returns rates → `handleFx()` returns normalized `{base:'USD',rates:{...}}` from the 2nd source; asserts cache key `fx:USD` set.
- [ ] **Step 2:** `node --test` → FAIL.
- [ ] **Step 3:** Implement `fx.js` chain (Frankfurter `/latest?from=USD` → exchangerate.host → open.er-api) returning a single normalized shape; `handleFx` wraps with `getCached/setCached` TTL 60 s, stale-on-error.
- [ ] **Step 4:** `node --test` → PASS.
- [ ] **Step 5:** Wire route `/fx` in `index.js`; client `loadForex` under `V2`: `const data = await gw('/fx'); S.fxBase=data.rates;` then existing `renderFxGrid/...`. Keep non-V2 path untouched.
- [ ] **Step 6:** `wrangler dev` + open page with `localStorage rz_ft_v2=1` → Forex tab shows rates < 5 s. Manual confirm + screenshot.
- [ ] **Step 7:** Commit `feat(worker,ft): /fx fallback chain — fixes Forex load (B-002)`.

### Task 1.2: Quotes `/q` (Overview ticker + indices; B-003)

**Files:** `worker/src/sources/yahoo.js`, `stooq.js`, `finnhub.js`; `handlers.js`; client index-strip loader.

- [ ] **Step 1: Failing test:** Yahoo `/q?syms=SPY,QQQ` mocked OK → normalized `[{sym,price,chg,chgPct,...}]`; Yahoo 429 → falls back to Stooq CSV parse; both fail → returns stale cache if present else `{ok:false}`.
- [ ] **Step 2:** `node --test` → FAIL.
- [ ] **Step 3:** Implement yahoo `v8/finance/chart` + `v7/finance/quote` parse with schema guard; stooq `q/l/?s=` CSV; finnhub `/quote`; `handleQuotes` batches, caches `q:<sym>` TTL 60 s.
- [ ] **Step 4:** `node --test` → PASS.
- [ ] **Step 5:** Client: Overview ticker + `CFG.INDICES` strip under `V2` use `gw('/q',{syms:...})`, `Promise.all` with the other Overview widgets; skeleton while loading; 8 s timeout → "retry" chip (no infinite spinner).
- [ ] **Step 6:** Probe: Overview ticker numeric within 5 s.
- [ ] **Step 7:** Commit `feat(worker,ft): /q quotes w/ Yahoo→Stooq→Finnhub fallback`.

### Task 1.3: Candles `/candles` + TradingView lightweight-charts (B-006, R-007 base)

**Files:** `worker/src/sources/yahoo.js` (candles), `handlers.js`; modify client chart code (commodity/fx/stock/futures chart builders); add CDN `<script>` for `lightweight-charts`.

- [ ] **Step 1: Failing test:** `handleCandles('GLD','3M')` mocked Yahoo → `{t[],o[],h[],l[],c[],v[]}` aligned arrays, invalid rows dropped; cache `candle:GLD:3M` TTL 600 s.
- [ ] **Step 2:** `node --test` → FAIL → implement → PASS.
- [ ] **Step 3:** Add `<script src="https://cdn.jsdelivr.net/npm/lightweight-charts@4/dist/lightweight-charts.standalone.production.js">` (NON-deferred, before the IIFE — matches project rule "scripts after IIFEs / non-deferred chart libs"; mirror the chart.js precedent).
- [ ] **Step 4:** Add `renderCandles(elId, candleData, {sma})` helper (candlestick + volume histogram + SMA line + crosshair) used by Commodity/FX/Stock/Futures chart panels under `V2`; keep Chart.js line as the non-V2 path.
- [ ] **Step 5:** `audit-js-syntax --strict` CLEAN (new script tag must not break tokenizer); probe Commodity tab → canvas/series present.
- [ ] **Step 6:** Commit `feat(ft): TradingView lightweight-charts candlesticks via /candles (B-006)`.

### Task 1.4: News `/news` (B-008 infinite spinner)

- [ ] **Step 1: Failing test:** Finnhub news mocked 403 → Yahoo RSS parsed → normalized `[{title,url,src,ts,summary}]`; cache `news:market` TTL 600 s.
- [ ] **Step 2–4:** TDD implement `news.js` chain (Finnhub `/news` → Yahoo RSS `https://feeds.finance.yahoo.com/rss/2.0/headline` → GDELT doc API) + `handleNews`.
- [ ] **Step 5:** Client News tab under `V2`: `gw('/news',{topic})` with 8 s timeout → on fail render "News unavailable — retry" (kills the infinite "Loading news…").
- [ ] **Step 6:** Probe News tab resolves (content OR retry affordance) within 9 s — never infinite.
- [ ] **Step 7:** Commit `feat(worker,ft): /news fallback — fixes infinite News spinner (B-008)`.

### Task 1.5: Sectors / Economy / Futures `/sectors /economy /futures` (B-009/010/011)

- [ ] **Step 1–4:** Each is ETF-proxy quote aggregation → reuse `/q` internals; TDD handler returns the table shapes the existing renderers expect (sector ETFs, treasury-yield ETF proxies, futures ETF proxies + day perf).
- [ ] **Step 5:** Client Sectors/Economy/Futures renderers under `V2` call the new endpoints with `Promise.all`; skeleton + timeout.
- [ ] **Step 6:** Probe: each of the three tabs populates its tables/charts < 5 s.
- [ ] **Step 7:** Commit `feat(worker,ft): /sectors /economy /futures — fixes empty tabs (B-009/10/11)`.

### Task 1.6: Screener `/screener` data + UI fix (B-007)

**Files:** `handlers.js`; client Screener (preset buttons ~CFG.PRESETS, `screen()` handler, results renderer)

- [ ] **Step 1: Failing test:** `handleScreener({preset:'High Dividend'})` → filtered list from a free fundamentals source (Finnhub `/stock/metric` per a bounded universe, cached `screener:<hash>` TTL 24 h).
- [ ] **Step 2–4:** TDD implement (bounded symbol universe to respect free limits; document the universe source).
- [ ] **Step 5:** Client bug fix — preset buttons: add/remove `.active` class on click (currently never set); `screen()` under `V2` calls `gw('/screener',...)` and renders rows (currently returns nothing). Verify both: active-state visible AND results table populated.
- [ ] **Step 6:** Probe: click preset → it shows active + results rows appear.
- [ ] **Step 7:** Commit `fix(ft): Screener active-state + results via /screener (B-007)`.

### Task 1.7: Crypto via `/crypto` + Market Dominance cards (B-005)

- [ ] **Step 1:** Crypto already works (CoinGecko direct) — route `/crypto` through Worker only for caching/quota safety; keep client behavior identical, just sourced via `gw()` under `V2`.
- [ ] **Step 2:** Client bug fix — Market Dominance cards: locate the empty render target; populate from CoinGecko `/global` (`market_cap_percentage`) already fetched for the crypto global stats; render top-N dominance cards.
- [ ] **Step 3:** Probe: Crypto tab Market Dominance cards non-empty.
- [ ] **Step 4:** Commit `fix(ft): Market Dominance cards populated; /crypto via gateway (B-005)`.

### Task 1.8: Name double-click sort + table filtering (B-004)

**Files:** client — shared table util

- [ ] **Step 1:** Add a small reusable `makeSortable(tableEl, {nameCol})` + `attachFilter(inputEl, tableEl)` util (event-delegated; double-click on Name header toggles asc/desc; text filter hides non-matching rows). DRY across Stocks/Crypto/Screener/Sectors tables.
- [ ] **Step 2:** Wire it (under `V2`) on every data table; ensure no conflict with row click handlers.
- [ ] **Step 3:** Probe: dblclick Name header reorders rows; typing in filter narrows rows.
- [ ] **Step 4:** Commit `fix(ft): sortable (Name dbl-click) + filterable tables (B-004)`.

### Task 1.9: Cron pre-warm + stale-on-error hardening (B-003 speed guarantee)

- [ ] **Step 1:** Implement the scheduled handler: every minute, refresh `q:` for `CFG.INDICES` + top crypto + `fx:USD` + `news:market` into KV.
- [ ] **Step 2:** Confirm handlers serve cached payload instantly; on all-source failure return last-good stale with `cached:true,stale:true`.
- [ ] **Step 3:** `wrangler dev --test-scheduled` (or trigger) → KV populated; cold tab open now < 2 s.
- [ ] **Step 4:** Commit `feat(worker): cron pre-warm + stale-on-error → sub-5s loads (B-003)`.

### Task 1.10: Finance Terminal probe (verification harness)

**Files:** Create `tools/probe-finance-terminal.mjs`

- [ ] **Step 1:** Puppeteer: set `localStorage rz_ft_v2=1`, open via local server, iterate all tabs, assert each renders expected non-empty selector within 9 s and `pageerror==0`. Print PASS/FAIL per tab.
- [ ] **Step 2:** Run against `wrangler dev` + `python3 -m http.server 8081` → all tabs PASS.
- [ ] **Step 3:** Commit `test(ft): probe-finance-terminal.mjs end-to-end tab verification`.

### Task 1.11: Ship Phase 1 (flag flip + per-ship discipline)

- [ ] **Step 1:** User deploys Worker: `cd worker && npx wrangler deploy`; set production `CFG.GW` default to the deployed URL.
- [ ] **Step 2:** Default `rz_ft_v2` to ON (flip the flag default in client) ONLY after `tools/probe-finance-terminal.mjs` and `tools/probe-all-pageerrors.mjs` are green against the deployed Worker.
- [ ] **Step 3:** Per-ship discipline: tracker B-002..B-012 → SOLVED(version, commit); `CHANGELOG.md` entry + `python3 tools/build-changelog-html.py --apply`; bump `js/rz-version.js` (MINOR — feature) + `sw.js`; run `audit-js-syntax/script-tags/mobile-responsive/version-stamp --strict`; walk `standarization/CONTENT_LINKAGE_PLAYBOOK.md` §1–§4; record the Worker-backend architecture change in `rz-work/CLAUDE.md` + a memory entry.
- [ ] **Step 4:** `tools/probe-all-pageerrors.mjs rz-ops-p7x3k9m.html` + finance-terminal probe green → commit `chore(ft): v1.21.0 — Phase 1 flag flip, Worker gateway live`.

---

## Acceptance (Phase 1 done)

Forex/Commodities/Screener/News/Sectors/Economy/Futures/Overview all render real data < 5 s; no infinite spinner anywhere; Name dbl-click sorts; tables filter; Market Dominance populated; every chart has candlesticks; Stock Investment no longer demands a Finnhub key (key is Worker-side; modal removed under V2); old terminal reachable until flag flip; all audits + probes green; tracker + CHANGELOG updated.

## Follow-up plans (write after Phase 1 ships)
- `docs/plans/<date>-finance-terminal-phase2-analytics.md` — `/analyze` (TA + buy/sell gauge + multi-engine prediction + sentiment + related news), Alerts delivery (Telegram/email), Finnhub webhook → `/finnhub-webhook`.
- `docs/plans/<date>-finance-terminal-phase3-stocks-parity.md` — `Apps/dca-app` + `Apps/stock_screener/prototype`; IDR `.JK` data; StockMap free-float × financials × news top-buy table (preserve official-source-only rule).
