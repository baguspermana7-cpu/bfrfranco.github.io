# Feature Manual

## Active features
1. Sourced search across ready tickers and holder-table investors.
2. Coverage overview with ready/review counts and latest issuer dates.
3. AI-style Q&A based only on sourced screener and network data.
4. Free-float screener with sorting, sector filter, risk labels, and CSV export.
5. Investor-ticker network scenarios derived from issuer holder tables.
6. Source ledger with status, direct source URL, as-of date, note, and save action.
7. Saved tickers using browser `localStorage`.
8. Ticker detail pages with visible holder tables and source-aware summary notes.
9. Investor detail pages derived from sourced holder-table references.
10. Methodology page with strategic/free-float logic and source limitations.

## Feature rules
1. No synthetic screener rows are rendered.
2. No fallback entity records are rendered.
3. Review-required tickers remain out of analytics until classification is defensible.
4. L/F mix is shown only when nationality disclosure is sufficient.
5. Network edges are built from issuer holder-table evidence, not manual relationship guesses.

## Removed or quarantined features
1. Market heatmap based on unsourced market-cap and daily-change data.
2. Hidden-position showcase tables that were not tied to current issuer evidence.
3. Placeholder market overview, hot searches, top foreign, and conglomerate cards.
4. Price-analysis widgets that relied on authored market data instead of official-source ownership disclosures.
