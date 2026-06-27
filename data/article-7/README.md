# data/article-7 — Uptime Institute Tier availability/downtime

Source-verified figures behind the chart in `article-7.html` ("From Reliability to Resilience").
Drives the Tier downtime bar via `js/rz-article-chart.js` (ARTICLE_DATAVIZ_STANDARD.md).

## basis-tag legend
- **standard** — Uptime Institute Tier Classification availability + max annual downtime (Tier I 99.671%/28.8h,
  II 99.741%/22.7h, III 99.982%/1.6h, IV 99.995%/0.4h). Stated in article-7's tier table.

Verification (2026-06-28): downtime = 8760 x (1 - availability); matches the published Uptime Tier figures.
