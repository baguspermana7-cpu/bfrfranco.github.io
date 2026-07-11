# FIN_ENGINE.md — the finance engine standard

> Sibling of [SUPER_ENGINE.md](./SUPER_ENGINE.md). RZ Engine covers data-centre technical math;
> **FIN Engine (`fin-engine.js`) covers finance.** ONE shared, gate-tested, provenance-sourced brain
> for every finance surface (Finance Terminal screener + advisor scorecard, StockMap, future pages).

## What it is
`fin-engine.js` (repo root) + reproducible `fin-engine.min.js` (terser) exposes `window.FINEngine`:
`{ version, DISCLAIMER, data, models, format, events }`.

- **`data`** — single source of truth: `markets` (US, ID — currency, benchmark index `^GSPC`/`^JKSE`,
  risk-free snapshot), `universes` (US large-caps + IDX `.JK` blue chips, each sourced), `sectors`,
  `scoreBands` (metric → 0-100 normalization), `factorWeights` (preset strategies), `floatBands`,
  `verdictBands`, plus `sources` (provenance sidecar) and `provenance[]` (citations).
- **`models.ratios`** — P/E, P/B, PEG, EV/EBITDA, ROE, net margin, current/quick, D/E.
- **`models.valuation`** — DCF (two-stage), Graham number, dividend-discount (Gordon), multiples fair value.
- **`models.technical`** — sma/ema/rsi/macd/bollinger/stochastic/atr + `analyze()` (0-100 gauge). **Ported
  verbatim from `cf-worker/src/ta.js`** and **parity-tested** so the client and the gateway agree exactly.
- **`models.risk`** — returns, volatility, beta, sharpe, max-drawdown, position size.
- **`models.score`** — the shared multi-factor algorithm (below). Powers **both** the screener ranking and
  the per-stock scorecard → all finance features correlate through one engine.
- **`models.portfolio`** — equal/score weights, correlation, diversification.
- **`format`** — multi-currency (incl **IDR** → `Rp`), percent, T/B/M abbrev, `.JK` ticker handling.

## The scoring algorithm (`models.score`)
Seven factors, each normalized 0-100 via `scoreBands`: **value** (inv P/E, P/B, EV/EBITDA), **quality**
(ROE, margins, low D/E), **momentum** (day + multi-day change), **dividend** (yield), **liquidity** (mcap,
volume), **float** (free-float health), **technical** (the gauge). A **preset** is a factor-weight config
(`factorWeights`), not a threshold. `score.stock(s, {preset, market})` blends the factors that have data,
**re-normalizing weights** over them and returning `confidence` = fraction of weight covered. Output:
`{ score, verdict, factors, rationale, confidence, disclaimer }`. `score.rank(list, opts)` scores + sorts.

- **Float** is first-class. True free-float isn't in Finnhub's free tier, so: **ID** tickers use the
  StockMap sourced free-float dataset; **US** uses a shares/insider proxy where available, else float is
  `null` and excluded (recorded in `confidence`). Never faked. Bands: float-trap <5%, tight 5-15%,
  institutional ≥35%.
- **Market-aware:** US gets full value/quality; ID (Yahoo `.JK`) leans momentum/liquidity/float.

## Non-negotiable rules
1. **Not advice.** This is educational analysis / decision-support — NOT personalized investment advice and
   NOT a licensed financial advisor. **Every scored/technical output carries `FINEngine.DISCLAIMER`** (the
   gate asserts it). Outputs are descriptive signals/scores, never "you should buy X."
2. **Provenance (SUPER_ENGINE §Z).** Every economically-material value lives in `DATA` with a
   `DATA.sources[path] = {source, asOf, unit?, method?}` entry; no buried constants in `models.*` bodies.
   The gate fails if any `sources` entry lacks `source`+`asOf`.
3. **Engine ↔ gateway coupling.** The engine holds only sourced methodology/structural constants +
   deterministic math. **Live prices/fundamentals come from the deployed Cloudflare gateway**
   (`rz-finance-gateway`, `/screener /q /candles /analyze /metric /profile`), never from `DATA`.
4. **Single version + reproducible min.** `DATA.version` is the one content version. Regenerate the min with
   `terser fin-engine.js -c -m -o fin-engine.min.js` (never hand-edit) and bump the shared `?v=` on every
   page that loads it. The gate + a min-parity check confirm the min matches the source.
5. **ta.js parity.** If `cf-worker/src/ta.js` changes, update `models.technical` to match and keep the parity
   test green (the client and server gauge must never diverge).

## Accuracy — backtest harness `tools/backtest-fin-screener.mjs` (Phase 4)
Walk-forward backtest of the **technical gauge** over real gateway `/candles` history (5Y weekly): at each
step it scores the history-to-date and measures the forward return, bucketing by signal (Buy ≥60 / Sell ≤40
/ Neutral) vs baseline. Needs network (hits the live Worker). **Honest scope + finding:** it backtests the
price/technical gauge only — the fundamental factors (value/quality/dividend) can't be cheaply backtested (no
free historical fundamentals). On a 15-ticker large-cap sample (~3k obs) the gauge showed **no clean forward
edge** (mean-reversion dominates) — so the gauge is a **descriptive** read of current technicals, **not a
predictor**. This is *why* the engine blends multiple factors and disclaims; the harness prints this verdict.

## Free-float data (honest position)
The `float` factor is first-class, but true numeric free-float is not on the free data tier. **US** has no
free-float → `null`, shown "n/a", excluded from the blend (recorded in `confidence`). **ID** likewise stays
`null` until a *sourced numeric* free-float dataset is wired — the StockMap app holds a **qualitative**
ownership ledger (not clean percentages), and numbers are never fabricated (provenance rule). StockMap is
intentionally "official-source-only" (no live data), so live FIN scoring is NOT grafted onto it; the engine
instead borrows StockMap's float taxonomy (`floatBands`).

## Gate — `tools/test-fin-engine.mjs` (SHIP GATE, mirrors `test-rz-engine.mjs`)
Node-vm load + assertions: worked examples (ratios/valuation/technical/score/risk), **ta.js parity**
(dynamic-imports the real `ta.js`), data invariants (currencies resolvable, universes sourced, factor
weights sum ~1), provenance audit, and disclaimer presence. Keep it green on every engine change.

## Consumers
- `Apps/finance-terminal/index.html` — the screener (`FINEngine.models.score.rank`) + the per-stock advisor
  scorecard (`FINEngine.models.score.stock`), both loading `fin-engine.min.js?v=…`.
- `Apps/stock_screener/prototype` (StockMap) — Phase 4, same scoring.
- Any future finance page reuses the same engine — never re-implement finance math per page.
