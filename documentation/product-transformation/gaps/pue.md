# R120 gap file — PUE calculator (2026-11-14)

Plan: `documentation/product-transformation/R120_TOOLS_GAP_PLAN.md`, tool 3 of the order (PUE + CDU). Gate:
`tools/test-pue-reference.mjs` (engine), wired in `tools/ship-gate.sh`.

## Reference

Data Center Metrics Task Force (7x24 Exchange, ASHRAE, The Green Grid, Silicon Valley Leadership Group, U.S. DOE Save
Energy Now and FEMP, U.S. EPA ENERGY STAR, USGBC, Uptime Institute), *Recommendations for Measuring and Reporting
Overall Data Center Efficiency, Version 2 — Measuring PUE for Data Centers*, 2011-05-17. Hosted by ENERGY STAR:
https://www.energystar.gov/sites/default/files/Data_Center_Metrics_Task_Force_Recommendations_V2.pdf
(read 2026-11-14, sha256 `cc3881ae7d884343ac73129ba22250c49918da34891ff77b0f4556f28ec84f4b`).

Chosen because it is public, carries a complete worked example and is the method The Green Grid WP#49 and
ISO/IEC 30134-2 build on. WP#49 (The Green Grid) needs a member sign-in; the LBNL copy returned an error page
(5.7 kB) on 2026-11-14. ISO/IEC 30134-2 is paywalled; its 2026 second edition (contents page read on the ANSI
preview) keeps categories 1–3 at the IT measurement points and adds dPUE and mPUE annexes. Neither is quoted here.

What the reference does:

- PUE = total data center energy / IT energy, both measured at the data center boundary over 12 consecutive months.
- Four categories (Table 1): 0 = peak demand (kW) at UPS output, all-electric sites only; 1 = 12-month kWh at UPS
  output; 2 = at PDU output; 3 = at the IT equipment input. The published value carries the subscript (PUE₁).
- Every energy type that crosses the boundary counts, weighted by its source-energy factor normalised to
  electricity (Table 2): electricity 1.0, natural gas 0.31, fuel oil 0.30, other fuels 0.30, district chilled water
  0.31, district hot water 0.40, district steam 0.43, condenser water 0.03.
- Appendix A, two worked cases: Case A all-electric 1,705,000 kWh / 1,000,000 kWh IT; Case B 1,305,000 kWh
  electricity + 1,300,000 kWh district chilled water × 0.31. The paper prints 1.70 for both. The exact quotients
  are 1.705 and 1.708: the paper truncates to two places. The gate checks the exact values.

## Capability matrix

| Capability | Reference | RZ today (v3.56.0) | Kind |
|---|---|---|---|
| PUE from measured annual energy | §3.1, 12 months | none: the page estimates a design PUE from 21 inputs | parity gap, **closed in the engine** (`models.pue.measured`) |
| Measurement category and IT meter point | Table 1, categories 0–3 | a "Green Grid Level" select (`greenGridLevel`, L1 annual / L2 monthly / L3 continuous) that names a reading interval but not the IT meter point, and is only echoed to `#greenGridValue` (no effect on any number) | parity gap, closed in the engine (`DATA.pueCategories`); defect D1 on the page |
| Non-electric energy (gas, district cooling, steam) | Table 2 source weighting | none: electricity only | parity gap, closed in the engine (`DATA.pueSourceWeights`) |
| Category 0 refused for mixed-fuel sites | §3.2 | — | closed in the engine (reason returned) |
| Input checks with a reason | not stated | — | beyond: IT ≤ 0, negative energy, unknown type, total below IT are refused, never turned into a number |
| Design estimate before a site exists | not in scope | `estimatePue` per component (cooling, UPS, transformer, lighting, economizer, climate) | RZ ahead |
| Partial-load PUE curve | not in scope | `models.pue.partialLoadPUE` + panel | RZ ahead |
| WUE companion | not in scope | `models.pue.wue` | RZ ahead |
| pPUE, dPUE, mPUE | ISO/IEC 30134-2 annexes (paywalled) | none | open, needs a readable source |

## Laws (gate `tools/test-pue-reference.mjs`, red 6/6 on v3.56.0 before the engine change)

- W1 `DATA.pueSourceWeights` equals Table 2, eight factors.
- F1 Case A = 1.705, label PUE1.
- F2 Case B = 1.708; the chilled-water line weighs 403,000 kWh.
- F3 category 0 refuses non-electric energy with a reason; all-electric 1,300 / 800 kW = 1.625 as PUE0.
- F4 categories 0–3 carry Table 1's IT meter location and the subscript.
- F5 IT 0, negative energy, unknown energy type, category 4 and a total below IT are refused with a reason.

## Defects found

- D1 `pue-calculator.html` `#greenGridLevel`: the levels are labelled by reading interval only. In the reference the
  category is fixed by WHERE the IT energy is metered (UPS output / PDU output / IT input), and categories 1–3 are
  all 12-month cumulative. The select changes no number. Fix with the Measured mode below (the category select
  there shows the meter point), not by relabelling the estimate.

## Page (owner R125, 2026-11-14: mock approved "Live")

`pue-calculator.html` gains a Measured tab beside Estimate (a `.tool-tabs` row, so the tool bar keeps its 6 controls):
category with its IT meter point, IT energy, one row per energy type that crosses the boundary (electricity shown,
the rest through "Add energy type"), the result as PUE₁/₂/₃ with each weighted line, and the design estimate beside it.
Starting values are Appendix A Case B (1.708). `js/rz-pue-measured.js` reads and writes only; the arithmetic is
`models.pue.measured`. A refused input shows the engine's reason and no number. Gate `tools/test-pue-measured.mjs`
M1–M7, red 11/11 on the page without the mode. M7 (added in the release gate): the estimate's sensitivity panel
(`data/calculators.json` anchor `#pmEstimateBench`, was `section.calculator-section`, which matched the hidden Measured
bench first) mounts after the Estimate bench and is hidden on Measured; red before the fix ("after #pmBench, on
Measured shown true"). Defect D1 is closed by the tab's category select, which names the
meter point; the old `greenGridLevel` select stays on the Estimate side (it labels the estimate's data quality only).
