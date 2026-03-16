# Route And Data Map

## Routes
1. `prototype/index.html`
   Landing page for sourced coverage.
2. `prototype/app.html`
   Main dashboard.
3. `prototype/methodology.html`
   Methodology and limitations.
4. `prototype/entity.html`
   Ticker and investor detail route.

## App sections
1. `overview-section`
   Coverage summary, source discipline, latest issuer dates, recurring holders.
2. `screener-section`
   Sourced free-float screener.
3. `network-section`
   Issuer-derived investor-ticker scenarios.
4. `source-section`
   Source ledger and sector exposure.
5. `saved-section`
   Local saved-ticker table.

## Data flow
1. `mock-data.js` defines `sourceLedger` and `entities.tickers[*].holderTable`.
2. `utils.js` converts those into screener rows and network scenarios.
3. `app.js` renders sourced dashboard sections only.
4. `site.js` renders landing and methodology sections using sourced coverage summaries.
5. `entity.js` resolves tickers from `sourceLedger` and investors from holder-table references.
