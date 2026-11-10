# PRD-P11: One sourced location dataset for all calculators

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P11 |
| Version | 1.0, 2026-11-10 |
| Status | Approved for implementation (directive) of the mechanism and of reconciling the existing values. Adding new values requires citable sources; any value without a source ships labelled ASSUMED, never as fact. |
| Priority | Wave 3 (re-baselined from "missing" to "inconsistent") |
| Dependencies | P01 (country is a project key) |
| Modules | new `data/locations.json`, `js/rz-locations.js`; carbon-footprint, opex, tco, capex (`cityMarket`), pue (`greenGridLevel`) |

## 2. Executive summary
Three calculators carry their own country table. The tables disagree.

| Page | Indonesia energy price | Indonesia grid factor |
|---|---|---|
| carbon-footprint | $0.08/kWh | 0.70 kg/kWh |
| opex | $0.075/kWh | — |

This PRD:
- replaces the per-page tables with one dataset, where every value carries a source and an as-of date;
- has all calculators read that dataset;
- shows the source next to each prefilled value.

## 3. Problem statement (measured 2026-11-10)
- carbon: `ID: {grid: 0.70, rate: 0.08}`
- opex: `ID: {energyRate: 0.075, laborMult, maintMult, …}`
- tco: `country:XX` options under regions
- capex: a separate `cityMarket` list

No value cites a source or a date in the data structure. A user running OPEX and carbon for the same Indonesian site gets two energy prices.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| One source | pages reading country data from `data/locations.json` | 4/4 (carbon, opex, tco, capex); pue adopts the grid factor where applicable |
| Provenance | values with `source` + `as_of` | 100 %. A value without either is marked `"evidence": "ASSUMED"` and is shown with that word. |
| Consistency | the same country gives the same price and grid factor on every page | gate |
| Behaviour change visible | every default that changes value is listed in the CHANGELOG with old → new | 100 % |

## 5. Scope
**In scope:**
- The dataset (union of the existing country sets).
- A reconciliation table: for each field where pages disagree, pick one value with its stated source. When no source exists for either value, keep the existing **carbon** value for grid factors and the **opex** value for prices, and mark both ASSUMED with the reason "legacy page value, no source on file". The owner can supply sources later.
- The loader module.
- Page adapters.
- A gate.

**Out of scope:**
- Live price feeds (LTC Q8 covers scheduled data refresh).
- Currencies.

**Constraints:**
- No invented numbers or sources.
- Values change only by reconciliation, with the old and new values recorded.

**Assumption:** the union set is about 40 countries (to be measured in T-P11-1).

## 6. Personas
Planner (consistent inputs). Reviewer (where did 0.70 come from?).

## 7. User journey
1. The user picks a country.
2. Fields prefill.
3. Each prefilled field shows a source line, for example "Grid 0.70 kg/kWh · ASSUMED (legacy page value)" or "· IEA 2025, as of 2025-11".
4. The user can override. The source line then reads "your value".

## 8. Functional requirements
| ID | Description | Acceptance |
|---|---|---|
| FR-P11-1 | `data/locations.json` schema: `{code, name, region, energy_price_usd_kwh: {value, source, as_of, evidence}, grid_kg_per_kwh: {...}, labor_mult: {...}, ...}` | schema gate |
| FR-P11-2 | Reconciliation script outputs the diff table (country, field, page values) | report in 01-improvement-register |
| FR-P11-3 | Loader `rzLocations.get(code)` (fetch once, cache in memory) | unit |
| FR-P11-4 | Page adapters replace inline tables; option lists generated from the dataset | E2E per page |
| FR-P11-5 | Source line under each prefilled field | E2E |
| FR-P11-6 | Consistency gate: the same code gives the same value on all pages | gate |

## 9. UI/UX specification
- The source line is mono 11 px, muted; the evidence word is in its token colour (ASSUMED uses the warning token).
- Selects keep their current position and labels.
- Both themes, 390/1440 px.

## 10. Data model
Dataset JSON in the repo. No database.

## 11. API contracts
Static fetch `data/locations.json?v=<token>`.

## 12. Business rules
- A displayed value always carries its evidence class.
- An ASSUMED value is never shown without the word.

## 13. Cross-module integration
P01 country key; P04 assumptions register shows the sources; LTC Q8 can later refresh values with dates.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
Dataset under 30 KB (estimate) and cached by the service worker (P25).

## 16. Security
Static. Values are rendered as text.

## 17. Edge cases
- A country present on one page only: kept, with the fields it has. The others are absent and the page shows "not available for this country".
- Fetch failure: the page falls back to a disabled select with the message "Location data unavailable". Calculation continues with manual inputs.

## 18. Technical architecture
`data/locations.json` → `rz-locations.js` → page adapters.

## 19. Implementation breakdown
| Task | Effort | Verify |
|---|---|---|
| T-P11-1 Extract the 4 page tables + diff report | 0.5 d | report |
| T-P11-2 Dataset + schema + evidence marking | 0.75 d | schema gate |
| T-P11-3 Loader + adapters | 1 d | E2E |
| T-P11-4 Consistency gate | 0.25 d | gate |
| T-P11-5 CHANGELOG old→new table | 0.25 d | — |

## 20. Test strategy
- Schema gate.
- Consistency gate.
- E2E country switch on 4 pages.
- Regression of the calculator gates: default values change only where listed.

## 21. Acceptance criteria
- **Given** Indonesia, **then** opex and carbon show the same energy price with the same source line.
- **Given** a value without a source, **then** the word ASSUMED is visible beside it.

## 22. Rollout
- One release, listing every changed default.
- Rollback by revert.

## 23. Risks
- Changed defaults shift published examples in articles. Mitigation: grep the articles for affected numbers and list them in the release notes.

## 24. Definition of done
- Gates are green.
- The diff report is published.
- Every changed default is listed.
- Screenshots reviewed.
- The change is live and verified.
