# data/article-20 — AI data-center water use (Altman fact-check)

Source-verified figures behind the interactive chart in `article-20.html`
("AI Data Center Water Use: Altman vs the Data"). Drives the **water-use trajectory**
chart via `js/rz-article-chart.js` (ARTICLE_DATAVIZ_STANDARD.md).

## Files
- `water-usage.csv` — the two anchor figures (2023 measured, 2028 projected).

## basis-tag legend
- **published** — figure from a named peer-reviewed source / industry projection.
  - 2023 = ~17 billion gallons, measured, *Joule* (peer-reviewed).
  - 2028 = ~68 billion gallons, projected (≈4× 2023), Global Water Intelligence.

## Provenance
Both anchors are stated and cited in `article-20.html`'s body + Schema.org FAQ. The chart shows
only these two sourced points (no interpolated/invented trajectory); the caption labels the 2028
point as a projection. Verification (2026-06-27): figures cross-checked against the article's own
citations (Joule; Global Water Intelligence).
