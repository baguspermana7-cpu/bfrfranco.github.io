# data/article-27 — AI data-center workforce crisis

Source-verified statistics backing the interactive chart in `article-27.html`
("No Humans, No Data Centers"). Drives the **aging-workforce** chart via
`js/rz-article-chart.js` (ARTICLE_DATAVIZ_STANDARD.md).

## Files
- `workforce-stats.csv` — the cited figures used in the article body and chart.

## basis-tag legend (matches the site-wide convention — see data/fire/README.md)
- **published** — figure transcribed from a named published source/survey
  (7x24 Exchange / MCGA, Uptime Institute 2024, AFCOM 2024).
- **derived** — computed from published figures (e.g. under-45 = 100% − 70%).

## Provenance
Every row carries a `source` + `basis_tag` + `verified_source`. The aging-workforce
breakdown (under-45 30% / 45–pre-retirement 37% / at-or-near-retirement 33%) is
derived from AFCOM 2024's two published anchors (70% aged 45+, 33% at/near
retirement) and sums to 100%. No projected/modelled values are charted.

Verification (2026-06-27): figures cross-checked against the citations already in
`article-27.html` (Schema.org FAQ + body) — 7x24 Exchange/MCGA 467,000–498,000,
Uptime Institute 2024 (65% hiring difficulty, 30%/yr capacity), AFCOM 2024 (70% / 33%).
