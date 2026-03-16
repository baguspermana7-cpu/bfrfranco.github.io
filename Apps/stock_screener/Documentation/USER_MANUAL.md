# User Manual

## Open the app
1. Open `prototype/index.html` for the sourced-coverage landing page.
2. Open `prototype/app.html` for the main dashboard.
3. Open `prototype/methodology.html` for classification rules and limitations.
4. Open `prototype/entity.html?kind=ticker&id=BBCA` or another sourced entity for detail pages.

## Main workflow
1. Search a sourced ticker or investor from the landing page or app header.
2. Review `Overview` to see sourced coverage status, latest issuer dates, and recurring holders.
3. Use `Free Float Screener` to sort and filter sourced rows by sector and float band.
4. Use `Investor-Ticker Network` to inspect overlap derived from issuer holder tables.
5. Use `Source Ledger` to inspect primary source labels and save tickers locally.
6. Use `Saved Tickers` for a local shortlist with source date, free float, and risk.

## Important behavior
1. The screener excludes `review_required` names.
2. Entity pages do not use fallback or aggregate placeholder records.
3. Investor pages are derived only from holder-table evidence inside sourced ticker coverage.
4. Every ticker row in analytics carries an explicit `as-of` date.

## Current sourced tickers in analytics
- `BBCA`
- `BBRI`
- `TLKM`
- `BMRI`
- `BBNI`
- `ASII`
- `TINS`
- `ITMG`
- `GIAA`
- `ANTM`
- `PTBA`
- `INCO`
- `PGAS`

## Review queue
- `BUMI`

## Removed from the active app surface
- placeholder heatmap
- placeholder hot-search and top-foreign cards
- synthetic float rows
- fallback entity pages
- placeholder analysis-lab pricing widgets
