# Feature Manual

## Active features
1. Sourced search across ready tickers and holder-table investors.
2. Coverage overview with ready/review counts and latest issuer dates.
3. AI-style Q&A based only on sourced screener and network data.
4. Ownership Priority Queue with two modes: `Allocation` and `Multibagger`.
5. Free-float screener with sorting, sector filter, decision filter, risk labels, and CSV export.
6. Investor-ticker network scenarios derived from issuer holder tables.
7. Source ledger with status, direct source URL, as-of date, note, and save action.
8. Saved tickers using browser `localStorage`.
9. Ticker detail pages with visible holder tables and source-aware summary notes.
10. Investor detail pages derived from sourced holder-table references.
11. Methodology page with strategic/free-float logic and source limitations.
12. FAQ page that explains float screener, issuer overlap, source ledger, and action labels in detail.
13. Decision table that merges ownership evidence with issuer-side operating releases.
14. Ticker entity pages now expose `Decision Layer` cards for earnings, balance, catalyst, and valuation gate review.

## Feature rules
1. No synthetic screener rows are rendered.
2. No fallback entity records are rendered.
3. Review-required tickers remain out of analytics until classification is defensible.
4. L/F mix is shown only when nationality disclosure is sufficient.
5. Network edges are built from issuer holder-table evidence, not manual relationship guesses.
6. `Accumulate / Watch / Avoid` labels are research-priority signals, not live execution advice.
7. Decision mode uses source-linked issuer releases and still requires a live valuation check.

## Removed or quarantined features
1. Market heatmap based on unsourced market-cap and daily-change data.
2. Hidden-position showcase tables that were not tied to current issuer evidence.
3. Placeholder market overview, hot searches, top foreign, and conglomerate cards.
4. Price-analysis widgets that relied on authored market data instead of official-source ownership disclosures.
