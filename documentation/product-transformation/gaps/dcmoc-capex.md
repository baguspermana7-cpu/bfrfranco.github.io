# R120 gap file — DCMOC and site CAPEX (2026-11-12)

Plan: `documentation/product-transformation/R120_TOOLS_GAP_PLAN.md`, tool 2 of the order (reliability + CAPEX). Gate:
`tools/test-capex-reference.mjs`, wired in `tools/ship-gate.sh` since v3.54.0.

## Reference

Koomey, Brill, Turner, Stanley and Taylor, *A Simple Model for Determining True Total Cost of Ownership for Data
Centers*, Uptime Institute white paper TUI3011B (2007), Table 1 and notes 1–46. Hosted by LBNL:
https://datacenters.lbl.gov/sites/default/files/(TUI3011B)SimpleModelDetermingTrueTCO.pdf (read 2026-11-12).

It is the only public CAPEX/TCO model found with a complete worked example: every row, every constant and the
annualization method are printed. Its dollar figures are 2007 dollars (Turner and Seader 2006 escalated), so they
are used for the METHOD, not as today's prices. Today's prices come from the engine's own city table
(`DATA.capexDetail.cityCapexPerW`, sourced "Turner & Townsend DCCI 2025 + Cushman & Wakefield DC Cost Guide 2025").

What the reference does:

- Power-related facility cost in $/kW of UPS output by Tier (note 26: Tier III $23,801/kW; 2,176 kW → $51.8 M).
- Area-related facility cost in $/ft² of electrically active floor (note 27: $262/ft² × 20,000 ft² → $5.2 M).
- IT, racks, cabling, POP, interest during construction, land, A&E, fire suppression as separate lines.
- Capital annualized with the capital recovery factor, CRF = d(1+d)^L / ((1+d)^L − 1), at a 7 % real rate, with
  a 3-year life for IT and 15 years for the rest (notes 32–34): 29.5 M$ × CRF(3) + 72.3 M$ × CRF(15) = 19.1 M$/yr.
- Total annualized cost per unit of electrically active floor ($1,249/ft²/yr).

## Capability matrix

| Capability | Reference | RZ today | Kind |
|---|---|---|---|
| Power-related cost per kW | note 26, by Tier | `capex.detailed` 14 per-kW categories × redundancy/cooling/rack multipliers | RZ ahead (finer) |
| Area-related cost per ft² | note 27 | none: building is per kW × rack multiplier, so a low-density hall is under-costed and a dense one over-costed | **parity gap F3** |
| Annualized capital by asset life (CRF) | notes 32–34 | none: `tco.lifecycle` adds capex once plus a refresh %; `tco.lifecycleNPV` discounts flows; CRF exists only inside the LCOE helper | **parity gap F1, F2** |
| Accuracy band | — | AACE 18R-97 class range (`capex.accuracyRange`) | RZ ahead |
| City market $/W | — | 60+ cities, sourced | RZ ahead |
| One CAPEX for one project | — | two engines: site `capex.detailed` (anchor 4.65 $/W) and DCMOC `CapexEngine.ts` (anchor 13.0 $/W), same city table | **defect D1** |
| Reproduce the city's own $/W at its basis spec | — | neither engine does | **defect D2** |

## Findings

| # | Case | Expected | RZ | Result |
|---|---|---|---|---|
| F1 | CRF(7 %, 15 y), CRF(7 %, 3 y) | 0.10979, 0.38105 | not exposed | fail |
| F2 | annualized capital, Table 1 | 19.1 M$/yr | not computable | fail |
| F3 | area-driven cost term | present | absent | fail |
| D1 | 2,176 kW, N+1, air, medium density, Virginia: site vs DCMOC | equal | site 18.14 $/W, DCMOC 8.83 $/W (2.05×) | fail |
| D2 | same case vs the city table (Virginia 13.40, Dallas 14.30, San Antonio 9.30 $/W) | within 10 % | site +35 %, DCMOC −34 % (all three cities) | fail |

Cause of D1/D2. Both engines scale per-kW base costs by `locMult = city.perW / anchor`. The site engine's anchor is
4.65 $/W (its category sum before multipliers), so a city factor of 13.40/4.65 = 2.88 lands on top of redundancy,
rack, seismic, fire and soft-cost multipliers: the total overshoots the city's all-in figure. DCMOC's anchor is
13.0 $/W while its own base sums far lower, so the city factor is about 1.0 and the total undershoots. Without a city,
the site engine gives 6.30 $/W and DCMOC 8.56 $/W for the same US project.

Who sees it: the CAPEX calculator page (site engine) shows roughly twice what DCMOC shows for one project, and
DCMOC's CAPEX feeds its TCO, ROI and financial pages.

## Owner decision O-R120-CAPEX — DECIDED 2026-11-13: option (a), live in v3.54.0

The owner chose "Yg terbaik" (option a) and approved the mock ("Live"). After the fix `tools/test-capex-reference.mjs`
passes F1, F2, D1–D3 (F3 open, stage 2); on v3.53.0 it failed 5 laws. The findings table above shows the state before.

### Options as presented

- **(a) Recommended.** One CAPEX engine. DCMOC calls `capex.detailed` (it already reads the multiplier tables from
  it). The city figure becomes the total at a stated basis spec (Tier III / N+1, air, medium density, purpose-built,
  the engines' default seismic zone 2); every other spec scales relative to that basis, so the basis spec reproduces the city's $/W (D2).
  Add the CRF and annualized capital by asset life (F1, F2) and an area term (F3). Every CAPEX number moves:
  roughly −25 % on the calculator page and +50 % on DCMOC for US cities. Mock first, then live.
- (b) Keep two engines; label the calculator "budgetary, market all-in" and DCMOC "category build-up". D1/D2 stay.

## Beyond the reference (each with a gate law, after (a))

1. Explain the total: each category's share, with the multiplier chain in a tooltip. Law: shares sum to 100 % ± 0.1.
2. Basis badge: the spec the city figure assumes, shown beside the result. Law: at the basis spec the result equals
   the city $/W within 10 %.
3. Annualized cost per kW-year and per m²-year beside the one-off total. Law: equals Table 1's method on its inputs.
