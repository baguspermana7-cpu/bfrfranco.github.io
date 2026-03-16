# Implementation Status

## Completed
1. App is now in `official-source-only` mode.
2. Synthetic screener rows are removed from active analytics.
3. Fallback entity pages are removed.
4. Source ledger exists for 25 tickers.
5. 24 tickers are `ready` in analytics.
6. 1 ticker is `review_required` and excluded from screener/network calculations.
7. 10 investor scenarios now recur across sourced issuer holder tables.
8. Landing page is rewritten to match sourced coverage mode.
9. App dashboard is rewritten around sourced overview, screener, network, source ledger, and saved tickers.
10. Methodology page is aligned to source-discipline language.
11. Entity pages are rebuilt around sourced ticker and investor logic.
12. Direct source URLs are rendered in the source ledger and landing preview.
13. GIAA post-PMTHMETD ownership is corrected to the official Danantara-led structure.
14. FAQ route now explains float, overlap, source ledger, and action labels in detail.
15. Decision queue now supports `Allocation` and `Multibagger` modes.
16. Decision queue merges ownership metrics with issuer-side operating releases through `decisionLedger`.
17. Eleven additional sourced tickers are active beyond the first coverage batch: `KLBF`, `UNTR`, `JSMR`, `INDF`, `ICBP`, `WTON`, `WEGE`, `AUTO`, `AALI`, `WIKA`, and `SMGR`.
18. Ticker entity pages now render a source-linked decision layer.
19. `WTON` and `WEGE` add a WIKA-family recurring-holder scenario through `PT Wijaya Karya (Persero) Tbk`.
20. `AUTO` and `AALI` deepen the `PT Astra International Tbk` recurring-holder scenario to three sourced positions.
21. `WIKA` deepens the `PT Danantara Asset Management` scenario to three sourced positions.
22. `SMGR` adds an updated BKI-mediated state-linked holder structure rather than the older direct-government snapshot.

## Current limits
1. Coverage is not the full IDX universe.
2. Some issuers expose only controlling blocks plus public categories, not full named top-holder tables.
3. Review-required names still need strategic-classification work before entering analytics.
4. Network depth depends on recurrence across issuer disclosures, not on inferred relationships.
5. Live valuation is still not hardcoded, by design, because execution price and market multiples can change daily.

## Next meaningful expansions
1. Add more issuer-sourced tickers with ready-status source ledger entries.
2. Expand recurring investor coverage using additional official annual reports and shareholder-composition disclosures.
3. Keep replacing generic issuer landing links with exact document URLs when the issuer publishes stable direct files.
