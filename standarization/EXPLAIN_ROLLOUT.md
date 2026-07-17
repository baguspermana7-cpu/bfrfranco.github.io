# RZExplain rollout tracker

Engine: `js/rz-explain.js` · DB: `js/rz-explain-db.js` (generated — builder auto-merges
`tools/explain-extra.json` + `tools/explain-extra-batch*.json`). Contract: EXPLAIN_ENGINE_STANDARD.md.

## Adopted

| Surface | Mechanism | Since |
|---|---|---|
| capex-calculator | 37 inline tooltips removed → scan + curated keys | v1.59.0 |
| pue-calculator | data-explain-scan | v1.59.0 |
| glossary.html | 354 term names cross-hover | v1.59.0 |
| 37 editorial/article pages | scanText via rz-article-editorial (idle) | v1.59.0 |
| Finance Terminal | 12 tabs data-explain | v1.59.0 |
| DCMOC | Explain.tsx: 24 tabs + Sensitivity vars + 5 KPIs | v1.59.0 |
| tco-calculator (`.tco-tooltip-*` 14) · cx-calculator (`.cx-tooltip-*` 14) · rz-ops (`.dc-kpi-tooltip` 8, JS-template) | migrated, legacy removed | v1.60.0 |
| 6 LTC labs + article-3 (`term-tooltip`) | migrated (modelling-lab = scanText; family CSS deleted) | v1.60.0 |
| article-4/11/12/13/15/16/17/18/20/25, FF-1/2/3, geopolitics-3 (`calc/opm/eeq/mcl/aig/pjm/tgs/hfx/iec-tooltip`) | static triggers migrated; dead hover systems + CSS deleted | v1.60.0 |
| Command palette | 341 glossary terms searchable (search-terms.json, generated) | v1.60.0 |

## Intentionally N/A (dynamic data readouts, NOT explanations)

- `sld-tooltip` (datahallAI) — live SLD value readout; accuracy-gated cockpit. Leave.
- chart-hover tooltips (Chart.js/echarts) — computed data displays.
- `iec-tooltip` strings inside changelog.html — generated artifact of CHANGELOG text.

## Pending

- (none known) — `.tip[data-tip]` output-KPI micro-family migrated in batch4 (`a16dca71`).
- Any per-page one-off family discovered later: migrate on touch, never extend.
