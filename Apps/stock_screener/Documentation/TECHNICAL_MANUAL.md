# Technical Manual

## Core files
- `prototype/assets/mock-data.js`
- `prototype/assets/utils.js`
- `prototype/assets/app.js`
- `prototype/assets/site.js`
- `prototype/assets/entity.js`

## Data model
1. `sourceLedger`
   Holds `status`, `asOf`, `sourceLabel`, `sourceUrl`, and `note` per ticker.
2. `entities.tickers[*].holderTable`
   Main ownership source for float analytics and network generation.
3. `decisionLedger`
   Holds issuer-side operating context, decision source label, and mode-fit annotations per ready ticker.
4. `getFloatRows()`
   Builds screener rows from `ready` tickers only.
5. `collectInvestorPositions()`
   Derives investor pages and investor scenarios only from sourced ticker holder tables.
6. `getNetworkScenarios()`
   Builds investor and ticker graphs from the sourced coverage universe.
7. `getDecisionRows()`
   Joins `getFloatRows()` with `decisionLedger` so the decision table can stay source-linked.

## Integrity rules in code
1. `getFloatRows()` no longer falls back to `freeFloat` aggregate rows.
2. Search corpus no longer expands from `heatmap` or synthetic market lists.
3. Entity pages no longer generate fallback ticker or investor records from placeholder tables.
4. `review_required` tickers stay in the ledger but are excluded from analytics.
5. Local-vs-foreign mix is suppressed when row nationality is incomplete.
6. Decision mode never hardcodes a final valuation multiple; it keeps a `valuationGate` warning instead.

## Runtime verification targets
1. JS must pass `node --check` for `utils.js`, `app.js`, `site.js`, and `entity.js`.
2. `getFloatRows()` should return 24 rows.
3. `getSourceLedgerRows({ includeReview: true })` should return 25 rows.
4. `getNetworkScenarios()` should expose 10 investor scenarios and 24 ticker scenarios from recurring sourced holders.
