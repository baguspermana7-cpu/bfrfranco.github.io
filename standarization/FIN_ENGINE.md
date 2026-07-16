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
The `float` factor is first-class. True numeric free-float is not on the *market-data* free tier, so:
- **ID (Indonesian):** `DATA.idxFundamentals` carries **sourced** free-float (+ snapshot pe/pb/roe) for 18
  IDX blue chips, compiled from the **StockMap sourced ledger** (issuer ownership disclosures / IDX pages,
  per-ticker `asOf`). `FINEngine.idxEnrich(sym, stock)` fills these into a `.JK` stock (only where the caller
  left them null) → the terminal's ID screener + scorecard score Float/Value/Quality with real data
  (confidence rises accordingly). Tickers without a sourced value keep `floatPct=null` (honest "n/a") — the
  pe/pb/roe are issuer-disclosure **snapshots** (as-of), NOT live. Numbers are never fabricated.
- **US:** no free-float on free data → `null`, shown "n/a", excluded (recorded in `confidence`).

StockMap itself is intentionally "official-source-only" (no live data), so live FIN scoring is NOT grafted
onto it; the engine instead *borrows* StockMap's float taxonomy (`floatBands`) + its sourced free-float.

## Factor Zoo + Investment Committee (v1.52.7 — deterministic adaptation of Vibe-Trading, NO LLM)
- **`models.alphas`** — a deterministic Factor Zoo of well-known formulaic alphas (Jegadeesh-Titman 12-1
  momentum, George-Hwang 52-week-high, low-volatility, short reversal, trend-vs-200d, volume trend, Amihud
  illiquidity, alpha101 intraday strength). Each is a pure function of a candle series → `{value, score,
  vote, label}`; literature cites live in `DATA.sources['alphas.*']`. `alphas.compute(candles)` → composite.
- **`models.committee`** — the no-LLM "swarm": `run(stock, candles, opts)` executes 4 fixed rule-based
  **panels** (Fundamental via `models.score` · Technical via `models.technical` · Quant via `models.alphas`
  · Risk via volatility/drawdown/Amihud), each votes, then a weighted consensus (`COMMITTEE_WEIGHTS`,
  re-normalized over panels present) → `{verdict, score, confidence, panels[], bullCase[], bearCase[],
  disclaimer}`. The **bull/bear case** = the strongest supporting vs opposing signals across panels — a
  deterministic stand-in for an agent debate. Descriptive, disclaimed; never a prediction (the backtest
  confirms the technical gauge isn't predictive). The terminal scorecard renders this as an Investment
  Committee.

## Berkshire Value Gate + conviction (v1.53.0 — deterministic adaptation of ai-berkshire, NO LLM)
- **`models.valueGate.run(stock, opts)`** — a deterministic Buffett/Munger value screen (adapted from
  **xbtlin/ai-berkshire**): hard checks — **ROE ≥ 15%**, **Debt/Equity ≤ 0.5**, **net margin ≥ 10%**,
  **P/E ≤ market median** (`DATA.peMedian`), **earnings-yield ≥ risk-free** — each `null` when its input is
  missing; a sector-baseline **moat** heuristic (`DATA.moatBySector`, 1–5★ with durability bumps from
  ROE/margin); a **weighted composite** (`DATA.valueGate.weights` = valuation·0.30 / moat·0.25 / growth·0.20
  / risk·0.15 / certainty·0.10, re-normalized over components with data) → **Pass / Gray / Fail**. Returns
  `{ rating, score, checks[], moat, mirrorTest[≤5], dataGrade:'A'|'B'|'C', components, disclaimer }`. A broken
  balance sheet (**D/E > 2**) hard-caps the rating to at most Gray; **no fundamental data → `rating:null`**
  (moat+certainty alone can't judge value — never guessed). All thresholds/weights/medians live in `DATA` with
  `DATA.sources` provenance (ai-berkshire methodology + Buffett/Damodaran).
- **`models.committee`** seats a **5th "Value (Berkshire)" panel** driven by `valueGate` (present whenever
  fundamentals exist, skipped otherwise). Weights rebalanced: Fundamental 0.25 / **Value 0.25** / Technical
  0.20 / Quant 0.20 / Risk 0.10. The run now returns a descriptive **`conviction`** (High / Medium / Low from
  consensus × confidence × panel agreement × data grade) plus the surfaced `valueGate` + `dataGrade`. The
  terminal scorecard shows the Pass/Gray/Fail chip + moat + Mirror Test + conviction + data grade.

## Crypto market (v1.53.1 — technical-only)
Crypto has **no fundamentals**, so the engine treats it honestly as a **technical-only** asset class:
- **Committee** — `models.committee.run({}, candles, {preset:'momentum'})` naturally yields a **Technical +
  Quant (Factor Zoo) + Risk** committee: the Fundamental panel (`models.score`) and the Berkshire **Value**
  panel both self-skip on empty fundamentals. `conviction` cannot reach **High** (no data grade). The terminal
  renders this in the crypto detail modal (`loadCryptoCommittee`) with an explicit **high-risk / technical-only**
  banner; candles come from the gateway `/candles` (Yahoo `BTC-USD`).
- **Screener** — the Crypto screener mode runs `models.score.rank` over the CoinGecko universe; only the
  factors crypto has (**momentum + liquidity + volatility/technical**) contribute, weights re-normalize, and
  `confidence` reflects the absent value/quality/dividend/float factors. Each coin gets a FIN Score; clicking a
  row opens the coin detail + its technical-only committee.
- Crypto emphasizes the disclaimer (elevated volatility/risk) — descriptive signals, **never** advice, **no**
  price targets or position sizing.

## Gate — `tools/test-fin-engine.mjs` (SHIP GATE, mirrors `test-rz-engine.mjs`)
Node-vm load + assertions: worked examples (ratios/valuation/technical/score/risk), **ta.js parity**
(dynamic-imports the real `ta.js`), data invariants (currencies resolvable, universes sourced, factor
weights sum ~1), provenance audit, and disclaimer presence. Keep it green on every engine change.

## Consumers
- `Apps/finance-terminal/index.html` — the screener (`FINEngine.models.score.rank`) + the per-stock advisor
  scorecard (`FINEngine.models.score.stock`), both loading `fin-engine.min.js?v=…`.
- `Apps/stock_screener/prototype` (StockMap) — Phase 4, same scoring.
- Any future finance page reuses the same engine — never re-implement finance math per page.


## Portfolio Doctor + Compare committee (2026-07-14, v1.57.0)

**Engine**: `DATA.portfolioBands` (HHI warn .18 / high .25, top-weight .25/.40, corrHigh .80 —
Herfindahl + Markowitz provenance) + `models.portfolio.concentration(weights)` → {hhi, topWeight,
effectiveN (1/HHI), flag}. Gate-tested (368 asserts).

**Terminal Portfolio tab — `#portDoctor` card** (rendered by `renderPortfolioDoctor` inside
`loadPortfolioAnalytics`, reusing its 1-year candles): value-weighted committee consensus per holding
(technical/quant/risk panels — no per-holding fundamentals fetched), per-holding score/verdict/conviction
table, concentration read (HHI + effective positions), diversification score, highly-correlated pairs
(≥ corrHigh). **Descriptive flags ONLY — no trade prescriptions / target weights / position sizing**;
`FINEngine.DISCLAIMER` rendered.

**Compare panel** — FIN committee row per compared symbol (score/verdict/conviction/Value-Gate/top
bull/top bear) from the already-fetched 3-month candles, keyless; window labeled; disclaimed.

**Build discipline reminder (paid for)**: any `fin-engine.js` change REQUIRES `terser fin-engine.js -c -m
-o fin-engine.min.js` + `?v=` bump — the terminal loads the MIN twin; a stale min made
`DATA.portfolioBands` undefined at runtime while the gate (which reads fin-engine.js) stayed green.

Probe: `tools/_portdoctor_probe.mjs` (offline: gateway stub + deterministic yahooCandles override).
