# User Manual

## Open the app
1. Open `prototype/index.html` for the sourced-coverage landing page.
2. Open `prototype/app.html` for the main dashboard.
3. Open `prototype/methodology.html` for classification rules and limitations.
4. Open `prototype/faq.html` for detailed glossary and usage notes.
5. Open `prototype/entity.html?kind=ticker&id=BBCA` or another sourced entity for detail pages.

## Main workflow
1. Search a sourced ticker or investor from the landing page or app header.
2. Review `Overview` to see sourced coverage status, latest issuer dates, and recurring holders.
3. Review `Ownership Priority Queue` in `Allocation Mode` first to see where core research should start.
4. Switch to `Multibagger Mode` only if you want optionality, project, cycle, or turnaround screens.
5. Use `Free Float Screener` to sort and filter sourced rows by sector, float band, and decision state.
6. Use `Investor-Ticker Network` to inspect overlap derived from issuer holder tables.
7. Use `Source Ledger` to inspect primary source labels and save tickers locally.
8. Use `Saved Tickers` for a local shortlist with source date, free float, and risk.
9. Use `FAQ` when you need precise definitions for fields like `blind spot`, `visible coverage`, `issuer overlap`, or affiliated-holder classification.

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
- `KLBF`
- `UNTR`
- `JSMR`
- `INDF`
- `ICBP`
- `WTON`
- `WEGE`
- `AUTO`
- `AALI`
- `WIKA`
- `SMGR`
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
