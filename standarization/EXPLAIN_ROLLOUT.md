# RZExplain rollout tracker

Engine: `js/rz-explain.js` · DB: `js/rz-explain-db.js` (generated). Contract: EXPLAIN_ENGINE_STANDARD.md.

## Adopted (v1.59.0)

| Surface | Mechanism | Status |
|---|---|---|
| capex-calculator.html | 37 inline `.tooltip-trigger` REMOVED → `data-explain-scan` (2 containers) + curated keys | ✅ probe PASS |
| pue-calculator.html | `data-explain-scan` on main | ✅ |
| glossary.html | every `.term-name` wired (cross-hover, 354) | ✅ |
| Articles (37 editorial pages) | `rz-article-editorial.js` → `RZExplain.scanText` (first occurrence, cap 40, idle-callback) | ✅ article-13: 40 terms live |
| Finance Terminal | 12 tabs `data-explain` (ft-*) | ✅ |
| DCMOC | layout DB script + `Explain.tsx` (Tooltip.tsx consumer): 24 tabs + Sensitivity variables + finance KPIs | ✅ |

## Legacy families pending migration (DEPRECATED — no new instances)

tco-calculator (`.tco-tooltip-*`), opex (`.opm-tooltip-*`), cx (`.cx-tooltip-*`), monte-carlo
(`.mcl-tooltip-*`), SLD/diagram (`.sld-tooltip`, `.pjm-*`, `.hfx-*`, `.tgs-*`), equipment
(`.equipment-tooltip`, `.eeq-*`, `.iec-*`), result/KPI (`.result-tooltip`, `.kpi-tooltip`) —
~40 families. Migration = move content into `tools/explain-extra.json`, wire `data-explain`,
delete the local CSS/JS. One page per pass; run `tools/_explain_probe.mjs` + axe after each.
