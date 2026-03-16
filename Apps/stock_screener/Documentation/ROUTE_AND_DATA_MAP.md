# Route And Data Map

## Routes
1. `prototype/index.html`
   Landing page for sourced coverage.
2. `prototype/app.html`
   Main dashboard.
3. `prototype/methodology.html`
   Methodology and limitations.
4. `prototype/faq.html`
   Detailed glossary and usage guide.
5. `prototype/entity.html`
   Ticker and investor detail route.
   Ticker pages now include a source-linked decision layer.

## App sections
1. `overview-section`
   Coverage summary, source discipline, latest issuer dates, recurring holders.
2. `priority-section`
   Allocation mode and multibagger mode decision queue.
3. `screener-section`
   Sourced free-float screener.
4. `network-section`
   Issuer-derived investor-ticker scenarios.
5. `source-section`
   Source ledger and sector exposure.
6. `saved-section`
   Local saved-ticker table.

## Data flow
1. `mock-data.js` defines `sourceLedger` and `entities.tickers[*].holderTable`.
2. `mock-data.js` also defines `decisionLedger` for source-linked issuer-side operating context.
3. `utils.js` converts ownership data into screener rows, network scenarios, and decision rows.
4. `app.js` renders sourced dashboard sections and mode-specific decision ranking.
4. `site.js` renders landing and methodology sections using sourced coverage summaries.
5. `entity.js` resolves tickers from `sourceLedger` and investors from holder-table references.
