# Feature Manual

## Implemented features

### Public / landing

1. Sticky affiliate banner
2. Warm beige and white visual system based on researched site style
3. Direct-open hero with no pricing wall
4. Stats ribbon
5. Feature grid
6. Market overview preview
7. Mutual fund preview
8. Free float preview
9. Locked sample data tables
10. Network graph preview
11. Market heatmap preview
12. Entity drilldown cards

### Dashboard

1. Search suggestions with alias-aware ranking and typo tolerance
2. KPI cards
3. Market overview composition
4. Hot searches card
5. Top foreign investor card
6. Conglomerate card
7. AI spotlight card
8. Local AI-style question panel
9. Free float screener with strategic-held, visible-coverage, blind-spot, HHI, local/foreign, and signal columns
10. Screener tabs:
- `0-5%`
- `5-15%`
- `15-50%`
- `>50%`
- `All Tickers`
11. Screener sorting by every visible column
12. Screener sector and source filters
13. Screener CSV export
14. Scenario composition chart
15. Investor-ticker graph with multi-hop derived nodes
16. Network scenario selector
17. Network evidence ledger
18. Network brief and connection highlights
15. Analysis Lab:
   price history chart
   technical indicator cards
   fundamentals cards
   peer comparison table
19. Market heatmap
20. Local vs foreign by sector chart weighted from authored ticker holder tables
21. Hidden positions sample table
22. Local-storage watchlist

### Methodology

1. Formula card
2. Investor-type classification table
3. Individual-holder decision logic
4. Methodology stats
5. Limitations section

### Entity detail

1. Ticker detail page
2. Investor detail page
3. Conglomerate detail page
4. Metrics cards
5. Research notes
6. Related entities list
7. Pie chart
8. Bar chart
9. Visible records table
10. Fallback entity generation for partially-authored symbols

### Affiliate

1. Affiliate explanation steps
2. Application form

### Terms

1. Local terms placeholder page so the prototype flow is complete

## Research-driven logic included

1. MSCI-style free float framing
2. Strategic type classes: `CP`, `IB`, `FD`, `OT`
3. Free float classes: `MF`, `IS`, `PF`, `SC`
4. Conditional individual logic for `ID`
5. Long-form investor alias handling in entity resolution
6. Computed free-float and risk values for all screener rows
7. Authored ticker rows use full holder-table analytics
8. Non-authored ticker rows use synthesized aggregate analytics with sector-level local/foreign fallback
9. Derived network scenarios from investor pages and ticker holder tables
10. Blind-spot float estimates from `freeFloat - visibleFloat`
11. Visible-holder concentration metrics via HHI
12. Scenario evidence tables and overlap highlights

## Not yet production-complete

1. Real backend APIs
2. Full ticker coverage across 955 names
3. Real source traceability on each entity page
4. Real LLM-backed AI assistant
5. Real-time market data
