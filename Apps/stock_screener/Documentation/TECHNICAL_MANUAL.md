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
3. `getFloatRows()`
   Builds screener rows from `ready` tickers only.
4. `collectInvestorPositions()`
   Derives investor pages and investor scenarios only from sourced ticker holder tables.
5. `getNetworkScenarios()`
   Builds investor and ticker graphs from the sourced coverage universe.

## Integrity rules in code
1. `getFloatRows()` no longer falls back to `freeFloat` aggregate rows.
2. Search corpus no longer expands from `heatmap` or synthetic market lists.
3. Entity pages no longer generate fallback ticker or investor records from placeholder tables.
4. `review_required` tickers stay in the ledger but are excluded from analytics.
5. Local-vs-foreign mix is suppressed when row nationality is incomplete.

## Runtime verification targets
1. JS must pass `node --check` for `utils.js`, `app.js`, `site.js`, and `entity.js`.
2. `getFloatRows()` should return 13 rows.
3. `getSourceLedgerRows({ includeReview: true })` should return 14 rows.
4. `getNetworkScenarios()` should expose 7 investor scenarios and 13 ticker scenarios from recurring sourced holders.
