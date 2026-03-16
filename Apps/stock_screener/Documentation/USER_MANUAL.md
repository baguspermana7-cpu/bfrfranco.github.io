# User Manual

## Opening the prototype

Recommended local run:

1. Open a terminal in `/home/baguspermana7/rz-work/Apps/stock_screener`
2. Run `npm run dev`
3. Open `http://127.0.0.1:4173`

Primary entry pages:

1. `/home/baguspermana7/rz-work/Apps/stock_screener/prototype/index.html`
2. `/home/baguspermana7/rz-work/Apps/stock_screener/prototype/app.html`
3. `/home/baguspermana7/rz-work/Apps/stock_screener/prototype/methodology.html`
4. `/home/baguspermana7/rz-work/Apps/stock_screener/prototype/entity.html`

Suggested open sequence:

1. Open `prototype/index.html`
2. Review landing sections and previews
3. Open `prototype/app.html`
4. Use the dashboard directly
5. Open ticker, investor, and group detail pages through search or links

## Main user flows

### Landing flow

The landing page includes:

1. Affiliate banner
2. Hero with direct-open access copy
3. Stats ribbon
4. Feature grid
5. Dashboard preview
6. Mutual fund preview
7. Free float preview
8. Hidden positions sample
9. Network graph
10. Entity drilldown section
11. Heatmap

### Direct access flow

The app now opens directly in `prototype/app.html`.

Behavior:

1. The local build enters dashboard mode immediately.
2. No login dialog is shown.
3. Entity pages also open directly.

### Dashboard flow

The dashboard contains:

1. Search suggestions
2. KPI ribbon
3. Market overview cards
4. Hot searches
5. Top foreign investors
6. Conglomerate cards
7. AI spotlight
8. Local AI-style question box
9. Free float screener with filter tabs, sector and source filters, sorting, and CSV export
10. Runtime-derived analytics cards for free float, strategic held, blind spot, coverage, and HHI
11. Scenario composition chart
12. Investor-ticker network graph
13. Scenario selector for investor-led and ticker-led maps
14. Network evidence ledger and connection highlights
15. Analysis Lab with price chart, technical indicators, fundamentals, and peer comparison
16. Market heatmap
17. Local vs foreign by sector chart
18. Hidden positions sample
19. Local-storage watchlist

### Entity flow

Entity pages are reached from:

1. Search results
2. Hot search list
3. Top foreign investor list
4. Conglomerate list
5. Ticker columns in tables
6. Entity drilldown cards on the landing page

Supported kinds:

1. `ticker`
2. `investor`
3. `group`

## Notes for prototype use

1. Charts use ECharts from CDN. If the CDN fails to load, chart areas fall back to text placeholders.
2. Some entities use fallback detail generation when a fully-authored page is not yet present in mock data.
3. Screener analytics are now fully runtime-derived:
   Authored tickers use holder-table calculations, while non-authored rows use synthesized aggregate analytics from the placeholder dataset.
4. Network scenarios are also runtime-derived:
   investor pages, ticker holder tables, overlap holdings, and blind-spot estimates are merged into each scenario graph.
5. Watchlist state is stored in the browser and is not shared across devices or users.
