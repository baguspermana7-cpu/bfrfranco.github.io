# Finance Terminal → Bloomberg-grade Upgrade — Design Spec

- **Date:** 2026-05-19
- **Status:** Approved design (user sign-off 2026-05-19); ready for implementation plan
- **Owner:** Bagus Dwi Permana
- **Tracker:** all bugs/requests in `~/.claude/projects/-home-baguspermana7/memory/project_rz_bug_request_tracker.md`
- **Rollout decision:** Cloudflare Worker gateway · free tiers only · bugs-first phasing · **feature-flagged** new version (old stays live until Phase 1 verified)
- **Key decision (locked 2026-05-19):** Finnhub token lives **only** in the Worker secret store. **No client-side key, no interim default.** Stock Investment stays key-gated until Worker Phase 1 ships, then the key modal is removed for all users. The pasted key is treated as exposed → rotate.

---

## 1. Problem statement

The admin console `rz-ops-p7x3k9m.html` embeds three finance apps via iframe:

| Surface | Iframe src | Stack |
|---|---|---|
| Finance Terminal | `Apps/finance-terminal/index.html` | 1 file, 3072 lines, vanilla ES, untouched since 2026-03-24 |
| Stock Investment | `Apps/dca-app/dist/index.html` | built app (DCA Portfolio Intelligence) |
| IDR Stocks | `Apps/stock_screener/prototype/index.html` | StockMap (official-source-only ownership) |

Every data-dependent tab is broken or hangs 2–3 min. **Single root cause:** the
client calls free APIs directly from the browser; anything not CORS-open
(Yahoo Finance, Finnhub) is funneled through three dead/throttled **public CORS
proxies** (codetabs / corsproxy / allorigins) **serially with no fallback**, on
a stale Frankfurter FX endpoint. Only **Crypto** works — CoinGecko allows direct
browser CORS. Stock Investment additionally blocks the UI with a Finnhub-key
modal (client-side key). Fixing the data layer once resolves B-002…B-012.

## 2. Goals / non-goals

**Goals**
- Eliminate the CORS-proxy bottleneck → every tab loads < 5 s with real data.
- Fix all enumerated bugs (B-002…B-012) and the genuine client bugs
  (Screener, Name-sort/filter, Market Dominance, candlesticks).
- Add per-surface depth: TradingView-grade charts, technical analysis,
  fundamentals + financial-statement correlation, related news, a buy/sell
  gauge, and a transparent multi-engine prediction with rationale.
- Server-side alert evaluation + delivery to Telegram and/or email (free).
- Keep cost at **$0** (free tiers only). No paid data feeds.

**Non-goals**
- Real-time tick data, deep paid fundamentals, licensed analyst feeds — not
  free; out of scope. Quotes are ~15-min delayed.
- The prediction is **not** a guaranteed forecast (see §7).
- B-001 (changelog.html generator escaping bug) is tracked separately and is
  **not** part of this initiative.

## 3. Architecture — Cloudflare Worker data gateway

The site's DNS is already on Cloudflare → zero new vendor. A single Worker
becomes the data brain; clients call it instead of any third-party API.

### 3.1 Responsibilities
1. **CORS killer** — server-side `fetch` of Yahoo/Finnhub/Stooq/etc. No browser
   CORS, no public proxy. This alone kills the 2–3 min hangs.
2. **Multi-source fallback** per data type:
   - FX: Frankfurter → exchangerate.host → open.er-api.com
   - Quotes/candles: Yahoo Finance → Stooq → Finnhub
   - News: Finnhub → Yahoo RSS → GDELT
   - Fundamentals: Finnhub free → Yahoo quoteSummary
   One source down ≠ broken tab.
3. **Edge cache (Workers KV) + Cron pre-warm** — TTLs: quotes ~60 s,
   candles ~10 min, fundamentals ~24 h, news ~10 min. A free Cron Trigger
   pre-warms popular symbols every minute so the client gets instant cached
   JSON. This is what makes load < 5 s instead of 2–3 min.
4. **Server-side analytics (Phase 2)** — TA indicators (RSI, MACD, SMA/EMA,
   Bollinger, ATR, Stochastic), a composite buy/sell **gauge**, and a
   **multi-engine prediction** = normalized ensemble of free signals
   (TA score + momentum + Finnhub analyst-rec trend + news sentiment) with a
   plain-language **rationale** ("top gainer because: earnings beat / inflow /
   sector rotation"). Recomputed each (cached) fetch.
5. **Secret management** — Finnhub (and any free-tier keys) live in Worker
   secrets, never in client. Removes the Stock-Investment key modal (B-012).

### 3.2 Endpoint surface (unified JSON)
`/health`, `/q?syms=`, `/candles?sym=&tf=`, `/fx`, `/news?topic=`,
`/screener?...`, `/sectors`, `/economy`, `/futures`, `/crypto`,
`/analyze?sym=` (TA + gauge + prediction + reason + related news),
`/idx/top` (IDR free-float + financials ranked table + top-buy rec),
`/alerts/eval` (cron-invoked), `/finnhub-webhook` (Finnhub push receiver:
verify `X-Finnhub-Secret`, 200-ack first, then KV update + alert push).

### 3.3 Client refactor
- Replace direct-API + `CORS_PROXIES` with one `API_BASE` → Worker.
- Parallelize tab loads (`Promise.all`); skeleton loaders; **hard 8 s timeout**
  with graceful "data unavailable — retry" (no infinite spinners → fixes B-008).
- Candlesticks via TradingView open-source **`lightweight-charts`** (candles +
  volume + indicators + crosshair = the TradingView/Bloomberg feel).
- Fix genuine client bugs: Screener active-state + result render (B-007);
  sortable/filterable tables incl. **Name double-click sort** (B-004);
  Market Dominance cards (B-005).
- Per-tab **Analytics + Gauge + Reason + related-news** panels (R-002/3/8).

## 4. Bug / request → phase map

| ID | Item | Phase |
|---|---|---|
| ROOT, B-002,003 | CORS/proxy/serial/stale FX → slow + forex error | 1 |
| B-004 | Name double-click sort + table filtering | 1 |
| B-005 | Market Dominance empty | 1 |
| B-006 | Commodity (and all) candlesticks / TV-grade chart | 1 |
| B-007 | Screener active-state + no results | 1 |
| B-008 | News infinite "Loading…" | 1 |
| B-009,010,011 | Sectors / Economy / Futures empty | 1 |
| B-012 | Stock Investment Finnhub-key modal | 1 (key moves to Worker) |
| R-001 | Bloomberg-level depth (robust) | 1→2 |
| R-002,003,008 | Fundamentals + reason + TA + gauge + related news | 2 |
| R-004 | Multi-engine prediction (labeled ensemble) | 2 |
| R-005 | Exchange/Bloomberg feature breadth | 1→2 |
| R-006 | Stocks parity (Stock Investment + IDR) | 3 |
| R-009 | Alert delivery: Telegram + email (free) | 2 |
| R-010 | IDR StockMap: free-float × financials × news + top-buy table | 3 |

## 5. Phasing

- **Phase 0 — Foundation.** Stand up Worker + KV + Cron + `/health`; wire
  client `API_BASE` behind a feature flag (`rz_ft_v2`). Old terminal stays live.
- **Phase 1 — BUGS.** Worker proxy+fallback+cache for FX/quotes/candles/news/
  screener/sectors/economy/futures; Finnhub key server-side. Client: parallel
  loads, timeouts/skeletons, lightweight-charts candlesticks, sort/filter +
  Name-sort, Market Dominance, Screener fix. **Exit: every tab < 5 s with real
  data, no infinite spinners, feature flag flipped on after browser-probe
  verify.**
- **Phase 2 — DEPTH.** Worker `/analyze`: TA + gauge + ensemble prediction +
  rationale + sentiment + related news, rolled across tabs (Crypto/Stocks as
  reference template). Alerts: Worker Cron evaluates server-side, pushes to
  Telegram Bot API (free; reuse existing bot) and/or email via Resend free tier
  (~3k/mo); per-alert channel choice in UI. Register the **Finnhub Webhook**
  (R-012) → Worker `/finnhub-webhook` for push-based price/news/earnings
  (near-real-time, conserves free REST quota) — fallback to polling if the free
  tier doesn't push a given event type.
- **Phase 3 — STOCKS parity.** Same gateway + analytics applied to
  `Apps/dca-app` (Stock Investment) and `Apps/stock_screener/prototype`
  (IDR StockMap). IDR: `.JK` tickers + free IDX sources via Worker; landing
  surfaces a highly intuitive **table** ranking by free-float + financial
  statements with a **top-buy recommendation + explanation**, correlated with
  related news. Preserve StockMap's "official-source-only / defensible source"
  integrity rule.

## 6. Per-ship discipline (every phase)
1. Tracker: flip PENDING→SOLVED(version, commit); keep the row.
2. `CHANGELOG.md` entry + `python3 tools/build-changelog-html.py --apply`.
3. Bump `js/rz-version.js` (PATCH/MINOR per semver) + `sw.js` cache version.
4. Audits: `audit-js-syntax --strict`, `audit-script-tags --strict`,
   `audit-mobile-responsive --strict`, `audit-version-stamp --strict`.
5. Walk `standarization/CONTENT_LINKAGE_PLAYBOOK.md` §1–§4 (start + end).
6. Browser-truth verify via `tools/probe-all-pageerrors.mjs` before claiming
   fixed (verify-before-claim mandate).
7. Update `standarization/` if a new pattern/lesson is introduced; record
   architecture change (zero-build site now has a Worker backend) in
   `rz-work/CLAUDE.md` + a memory entry.

## 7. Honest constraints (must be stated in-product)
- Free tiers cap depth: ~15-min-delayed quotes, EOD+intraday candles, basic
  fundamentals, free news, **derived** TA/prediction. The Worker makes data
  robust + fast; it cannot conjure paid real-time/analyst feeds.
- The prediction is a transparent **ensemble of free signals with rationale,
  explicitly labeled "not investment advice / not a guaranteed forecast"** —
  consistent with the no-fabrication discipline. No back-solved or invented
  numbers; every figure carries its source.
- This deliberately adds a backend to a previously zero-build static site —
  documented as an architecture change.

## 8. Risks / open items
- Cloudflare account must allow adding a Worker + KV namespace + Cron on the
  existing zone (user to provision; exact steps provided at implementation).
- Yahoo unofficial endpoints can change shape — fallback chain + schema guards
  mitigate; Stooq as deterministic backup.
- Free-tier rate limits — mitigated by KV cache + cron pre-warm + source
  rotation; Worker returns last-good cached payload on upstream failure.
- IDR data sourcing on free tiers is thinner than US — StockMap's
  official-source-only rule must not be diluted (show "no defensible source"
  rather than fabricate).
- **Key hygiene:** the Finnhub API token must be the single ~20-char string
  from the "API Key" panel — *not* the webhook secret, and *not* the two
  concatenated (a wrong/concatenated token is itself a likely cause of the
  data-load errors). The token lives in the Worker secret store; it is **not**
  committed to the repo or hardcoded in client HTML (public static site). Any
  interim client default (locked decision: **none** — Worker-only); the pasted
  value is treated as exposed and rotated.

## 9. Acceptance criteria (Phase 1, the bug gate)
- Forex, Commodities, Screener, News, Sectors, Economy, Futures, Overview
  ticker all render real data within 5 s of tab open.
- No infinite spinner anywhere (8 s timeout → retry affordance).
- Name column double-click sorts; tables filterable; Market Dominance cards
  populated; every chart supports candlesticks + ≥1 timeframe.
- Stock Investment opens without demanding a Finnhub key.
- Old terminal remains reachable until the flag is flipped; all per-ship
  discipline items green.
