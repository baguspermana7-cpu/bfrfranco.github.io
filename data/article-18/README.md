# data/article-18 — rack power density by NVIDIA generation

Source-verified figures behind the chart in `article-18.html` ("AI Factories vs Traditional Data Centers").
Drives the rack-density evolution line via `js/rz-article-chart.js` (ARTICLE_DATAVIZ_STANDARD.md).

## basis-tag legend
- **vendor** — NVIDIA generation rack power densities (kW/rack), transcribed from the article-18 generation
  table: x86 5, A100 10-15, H100 30-40, GB300 NVL72 132-140, Vera Rubin NVL72 120-130, Rubin Ultra NVL576 ~600.
  Chart plots the per-generation midpoint; the 2026-27 Vera Rubin dip vs 2025-26 GB300 is shown faithfully.

Verification (2026-06-27): cross-checked against article-18's own generation table.
