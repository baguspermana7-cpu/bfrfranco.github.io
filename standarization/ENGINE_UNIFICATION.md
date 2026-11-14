# ENGINE UNIFICATION — DC-OS single-brain charter

> Read BEFORE touching any calculator, DCMOC module, or `rz-engine.js`. This is
> the standard the DC-OS engine-unification program enforces. Extends
> [SUPER_ENGINE.md](./SUPER_ENGINE.md).

## The one rule
**`rz-engine.js` is the single brain.** Every DC Hub calculator page and every
DCMOC module is a *thin consumer* of shared `models.*` + shared `DATA`. No page
or module re-implements economically-material math or re-declares reference data.

## What this forbids (the anti-patterns the audit found)
1. **Hardcoded reference data in a page/module.** Region/country, PUE matrix,
   tier/redundancy labels, currency, grid-carbon — these live ONCE in
   `rz-engine.js DATA` and are read via `RZEngine.data.*` (static site) or the
   DCMOC bridge `rzData()` (`dcmoc/src/lib/rz-engine.ts`). Never inline a country
   table again (opex/carbon/tco calculators each had one → all divergent).
2. **Feeding a real engine function a hardcoded input to look "engine-real."**
   (DCMOC Commissioning fed `{L1:1,…}`; Site Intel fed a fixed factor vector →
   constant output regardless of user input.) Inputs must be live.
3. **Inline-only tool logic.** If a calculator page holds rich math the engine
   lacks (cx-calculator cost/schedule, spares FMECA, tier-advisor scoring), it is
   **promoted into `rz-engine.js` as a `models.*` namespace** and the page then
   consumes the model. Both the page and the DCMOC pillar share one implementation.

## Canonical sources of truth
| Reference | Canonical home | Consumers read via |
|---|---|---|
| Country / region economics | `DATA.countries` (generated from `dcmoc/src/constants/countries.ts`) | `RZEngine.data.countries[id]` / `rzData().countries[id]` |
| PUE by cooling×tier | `DATA.pueMatrix` | `RZEngine.data.pueMatrix` / `dcmoc constants/pue.ts` (already delegates) |
| Tier / redundancy labels | `DATA.tierCodes`, `DATA.redundancyLevels` | `RZEngine.data.*` |
| Cooling taxonomy | `DATA.coolingTypes` (label + capex/pue/wue keys) | `RZEngine.data.coolingTypes` |
| Currency | `DATA.currency` (26) | `RZEngine.data.currency` |
| DC markets (MW/colo/vacancy) | `DATA.markets` | already shared |
| O&M contract pricing bands | `DATA.omContracts` (v1.96.0) | DCMOC Maintenance SLA cost + Spares price band + Data Library |
| Spares list-price bands (8 classes) | `DATA.sparesPricing` (v1.96.0) | `spares-adapter` unitCost + Data Library |
| Environmental costs (carbon price 40 countries + waste bands) | `DATA.envCosts` (v1.97.0) | Sustainability "Environmental Costs" + trace nodes + Data Library |
| Labor statutory (6 fields × 40 countries) | `DATA.countries` (generated) | ShiftEngine / site-adapter / FuelGenEngine / capex-data |
| Every lifecycle calc | `models.*` (13 pillars) | `RZEngine.models.*` / `rzModels()` |

## New DATA tables — v1.96.0 → v1.97.0 (O&M pricing + env costs + labor statutory)
All three tables are **sourced screening bands** (`DATA.sources` rows
`omContracts` / `sparesPricing` / `envCosts`, asOf 2026-07) with gate asserts
(monotonic + sourced); DCMOC consumers keep verbatim fallbacks if the engine is
unavailable.

| DATA key | Contents | Consumer chain |
|---|---|---|
| `DATA.omContracts` | Contract tiers Comprehensive / Preventive / On-call, $/kW-yr bands 30-60 / 20-40 / 10-20 · multipliers third-party ×0.65, aging ×1.5 | DCMOC Maintenance SLA contract cost (mapping NBD≈on-call, 4hr≈preventive, 2hr≈comprehensive × IT kW), Spares tab price band, Data Library "O&M Contracts" dataset |
| `DATA.sparesPricing` | 8 spares classes (UPS 50kW module $25-60K, VRLA string $8-15K, genset PM kit & top-overhaul, chiller compressor $80-250K, CRAH EC-fan kit, MCCB, filters) | `dcmoc/src/state/adapters/spares-adapter.ts` unitCost (provenance chip flips to emerald `engine`; screening fallback), Data Library "Spares Pricing" |
| `DATA.envCosts` | Carbon compliance price 40 countries (SG $33, EU-ETS $61, SE $120, CH $130, NO $100, JP $2 …; no scheme → voluntary $10/t labeled) + waste bands (2 t/MW-IT + e-waste 150 kg/MW × developed/emerging) | Sustainability Environmental Costs section (water/carbon/waste/total + forecast ramp), `value-trace.ts` env nodes, Data Library "Env Costs" |

**Labor statutory fields (DM fase 1-2, v1.97.0)** — 6 new per-country fields in
the authoring source `dcmoc/src/constants/countries.ts`, flowed into
`DATA.countries` by the generator: `socialSecurityRate` (AU super 12%, GB NIC
15%, FR 38%, BR 28%, SG CPF 17% …), `benefitsOverheadRate`,
`nightShiftPremiumRate` (statutory JP 25% / KR 30% / VN 30% / BR 20%),
`workingHoursPerMonth` (150-161, from leave data), `constructionIndex` (now
40/40 — CapexEngine priority logic active; capex-data uses it fallback-only),
`environmentalPermitCostPerYear`. Consumers: `ShiftEngine` (×3 points),
`site-adapter` labor burden (was flat 1.3 → per-country), `FuelGenEngine`
permit cost.

**Regen rule (unchanged, now with more reach):** ANY edit to labor/economic
country fields happens in `countries.ts` → `node tools/build-countries-data.mjs`
→ terser → parity gate (155/0). ANY new DATA table needs its `DATA.sources` row
+ `test-rz-engine.mjs` asserts → `node tools/build-engine-catalog.mjs` →
`node tools/test-value-bindings.mjs` (staleness gate) — see AUTO-LINKING CHAIN.

## Generated data — never hand-edit
`DATA.countries` is written between `/* @@COUNTRIES_START */` … `/* @@COUNTRIES_END */`
by **`tools/build-countries-data.mjs`**. Edit the authoring source
`dcmoc/src/constants/countries.ts`, then rerun the generator. The parity gate
**`tools/test-reference-parity.mjs`** fails CI if the engine copy drifts.

## Definition of done for any engine/data change
1. `node tools/build-countries-data.mjs` (if country data changed).
2. `terser rz-engine.js -c -m -o rz-engine.min.js` (never hand-edit the min).
3. `node tools/test-rz-engine.mjs` (599/0 as of v1.97.0 — was 299/0 at program start) + `node tools/test-reference-parity.mjs` (155/0).
4. Bump `js/rz-version.js` + `CHANGELOG.md` + `python3 tools/build-changelog-html.py --apply`.
5. Bump `?v=` on pages loading `rz-engine.min.js`; for DCMOC rebuild + copy `out/`→`dcmoc/`.
6. Update this doc + `SUPER_ENGINE.md` if a new `models.*` namespace or DATA key was added.

## Program phases (status)
- **Phase A — single-source reference data:** `DATA.countries` + enums + parity gate — **LANDED v1.61.0** (engine + DCMOC). Root-calculator consumers still to migrate.
- **Phase 0 — engine completeness:** `site.deriveFactors` + `commissioning.programCost/programSchedule` **LANDED v1.62.0** (311/0). Still to build: `models.decision` (promote deterministic provider), `fire`/`cdu`/`tier`/`spares` (consolidate the standalone `js/fire-*.js`,`js/cdu-*.js` + inline tier/spares logic).
- **Phase B — de-fake modules:** Commissioning + Site Intel wired to live engine inputs — **LANDED v1.62.0** (no hardcoded vectors). **Commissioning upgraded compact→RICH v1.68.0** (DATA `2.5.0`): `models.commissioning.programRich/monteCarlo/sensitivity/equipScale/levelDurations/levelCosts/mapInput` are a faithful port of `cx-calculator.html` (equipment-scaled, 30 regional day-rates, gm^0.45 blend, Monte-Carlo band + tornado). DCMOC Layer-7 dashboard consumes them directly; the standalone calculator and DCMOC now share ONE brain (parity gated by golden values from cx-calculator's own `cxCalcTotalCost`). Compact `programCost/programSchedule` retained for back-compat.
- **Phase C/D — wire remaining modules + calculators:** **LANDED v1.62.0** — 9 DCMOC modules (Grid/Disaster/Compliance/Capacity/AssetLifecycle/CBM/FuelGen/Tax/Carbon) delegate to `rzModels()` with local fallback (Carbon reconciled to `models.carbon`); `opex`/`carbon`/`tco` calculators read `DATA.countries` + `pueMatrix` (SG rate 0.22 / air PUE 1.50 everywhere).
- **Phase E — UX layer:** **LANDED** — KPI value-on-hover + tooltips, QuickActions hover+tooltips, LifecycleStrip "View Engine Graph" + hover, AI-Assistant modal (+deterministic fallback), module KPI-grid responsive sweep (dashboard 0-overflow at 390/768).
- **Shared pillar engines — LANDED v1.63.0:** `models.tier`/`fire`/`cdu`/`spares`/`decision` promoted into `rz-engine.js` (backend-served via `/calc`). Layer-13 decision brain now in the engine. Engine gate 321/0.
- **Resolved accuracy decision:** DC electricity rate — `DATA.countries.economy.electricityRate` = retail/display (single-sourced everywhere the user sees a rate); `models.opex` keeps the calibrated DC-contract blend (cockpit-gate-validated). Documented distinction, `ppaRate` override available. NOT force-merged (would break cockpit accuracy + fabricate DC rates for 32 countries).
- **DCMOC apps LANDED v1.64.1:** the 8 Platform surfaces (Data Library / Templates / Projects / Settings / Knowledge / Integrations / Audit / Users) are real + engine-backed (`PlatformDashboards.tsx`). Strategic acquisition OPEX → `models.opex` (v1.64.2). Backend `/calc` redeployed with all v1.64 rich models live (Version 98973552).

## AUTO-LINKING CHAIN (owner mandate 2026-07-19: "bener2 auto linking satu sama lain — harus AUTO, tidak perlu Claude")
`rz-engine.js (single truth)` → **`tools/build-engine-catalog.mjs`** (generates `dcmoc/src/lib/engine-catalog.json`: every models.* namespace/function + param names + DATA.sources provenance + CONSUMERS grep-derived from real usage across site *.html + dcmoc/src) → **rendered LIVE** by DCMOC Knowledge Base "Engine Models" tab + FAQ "Engine & Data Reference" (auto-generated sections — never hand-written per change) → **`tools/test-value-bindings.mjs`** (SHIP GATE): (a) value-bindings.ts coherence — unique ids, engine-provenance entries carry engineFn, every engineFn resolves against the live engine, pages ⊆ real tab ids; (b) catalog STALENESS — regenerates in-memory and diffs vs committed JSON, so an engine change cannot ship with stale docs.
**VALUE TRACE (lihat `VALUE_TRACE_STANDARD.md`):** setiap angka baru yang dirender di DCMOC WAJIB registrasi traceId (graf `value-trace.ts` + wrap `TraceValue`) — klik-to-trace Excel-style sampai leaf + sumber eksternal.
**DECISION EXPLAINABILITY (v1.96.0-v1.97.4):** panel "kenapa?"/lever pada verdict & status chip (Phased Financial GO/NO-GO via `lib/decision-explain.ts`, threshold generik `explainThresholdMetric` bisection untuk Investment/Reliability, Site axis `axis-explain.ts`, Capacity chips, Results `dimension-explain.ts`) WAJIB menghitung lever lewat MODEL YANG SAMA dengan render (bisection atas rantai engine nyata) — bukan teks statis; target tak tercapai → catatan jujur "unreachable", bukan lever palsu.
**Definition of Done for ANY engine/algo/DATA/logic change now includes:** `node tools/build-engine-catalog.mjs` (regen) + `node tools/test-value-bindings.mjs` green + add a curated value-bindings.ts entry ONLY when a DCMOC KPI consumes the new value (cross-page semantics can't be grep'd) + check the auto-detected consumers list for related articles/calculators that must be re-verified.

## Article calculators → engine — **COMPLETE 22/22 (v1.96.0)**
**Final sweep (v1.96.0):** the remaining 14 pages landed — 12 wired to the
engine (`models.resilience`, `safetyCulture`, `hvac`, `water.stressCost`,
`dcValue`, reliability (a13), `communityImpact`, `opsBudget`,
`dcMarket.bubbleRisk/opportunity`, `interconnect`, `gridReserve`) + a19/a21 are
pure prose (no calculator — legitimate skip). 66 new asserts (goldens computed
independently from the original page formulas), headless probe 12/12, engine
gate 590/0 at ship. Every article calculator now delegates to `models.*` with
inline fallback.
**Earlier batches:** article-11 → `models.gridImpact.residentialBillImpact` + `DATA.gridImpact` · article-20 dcw/wfc/avh → `models.water.facilityFootprint` + `aiQueryFootprint` + `DATA.waterFootprint`/`aiWater` · article-18 → `models.aiFactory.readiness` (**×1000 annualEnergy unit bug FIXED at promotion**) · article-23 → `models.aiFactory.gpuBuild` · **batch 3:** article-1 → `models.opsMaturity` (score/label/riskExposure + `DATA.opsMaturity` 8-dimension weights, Uptime-2024 risk basis) · article-2 → `models.alarms` (ratePer10Min/cognitiveLoad/floodProbability/isaCompliance/erlangC/isaScore + `DATA.alarmMgmt` ISA-18.2 targets; Poisson via shared `models.spares.poissonCdf` kernel) · article-3 → `models.maintCompliance` (effectiveCapacity/demand/compliance/techsForTarget + `DATA.maintCompliance` FF/CMMS/evidence multipliers). All pages delegate w/ inline fallback, headless-verified (engine fn call-counted live, 0 errors). **batch 4:** article-4 → `models.mttr` (phases/compare + `DATA.mttrResponse` category/skill/coverage tables) · article-5 → `models.techDebt` (weibullHazard/riskScore/escalation/costRoi/weibullParams Lanczos-Γ/capacity + `DATA.techDebt`) · article-6 → `models.rca.effectivenessScore` (+ `DATA.rcaScore` 6-weight rubric). (The 12 then-remaining pages closed in the v1.96.0 final sweep above.)
**Scope (grep-verified 2026-07-18):** **21 of the 22** `article-*.html` interactive calculators are self-contained INLINE JS (only 1 uses `RZEngine`). Owner mandate: bring every calculator/parameter under the shared engine so DCMOC can wire from all of them (full / partial / even a single parameter), with complex algorithms in `rz-engine.js`.
**Pattern to apply per article calc** (same as the DC Hub tools):
1. Read the article's `<script>` calc: extract formula + inputs + outputs.
2. If the math overlaps an existing `models.*`, bind the page to it (fallback inline). If unique, promote it as a new `models.*` function + `DATA.*` constants + `DATA.sources` row + `test-rz-engine.mjs` asserts.
3. Rewire the article page to consume the engine (guard `window.RZEngine`; keep inline as fallback); verify headless (0 new console errors) + `audit-js-syntax`/`audit-script-tags` CLEAN.
4. Surface the reusable ones as DCMOC parameters where they add value.
**Execution note:** best done as a parallel sweep (one agent per article, worktree-isolated) once account/session limits are clear — do NOT batch-edit live article pages without per-page headless verification. The 21 inline pages: article-1/2/3/4/5/6/8/11/12/13/14/15/16/17/18/20/22/23/24/25/26 (+ re-scan 7/9/10/27).


## DC-OS UIUX program (2026-07-19, v1.68.1 → v1.84.1) — COMPLETE
All 13 DCMOC engine pages rebuilt to the DC-OS reference designs on a thin centralized
state layer (`dcmoc/src/state/registry.ts` namespaced params over the existing zustand
slices + `dependencies.ts` DEP_MAP + per-engine adapters in `src/state/adapters/`).
Conventions now binding for DCMOC work:
- **Absorb-by-composition**: legacy dashboards survive as tabs inside the new pages — never deleted before absorption.
- **Plan-Mode tracking stores** (construction/cx/financial/ops/sustainability): planning tool has no telemetry — actuals are user-entered with EXAMPLE-chipped seeds; derived indices (SPI/CPI) default 1.00; Financial consumes the Construction EVM as the single source.
- **Owner UX rules**: CreatableCombobox is dropdown-FIRST (simple select preserved; "Custom value…" row opt-in); no fabricated entities (sites start at 1, scenario-bound); editable inputs carry a violet left-accent label, generated values render as tinted read-only panels with provenance chips; RZExplain tooltips on technical KPI labels.
- **Engine additive-only**: the single engine change was v2.5.1 `models.opex.totalAnnual` basisPresets (dcContract/retailScreening) — default bit-identical, gate-asserted; opex-calculator.html untouched.
Traps catalogued in memory: pue.defaultFor key mismatch (use pueMatrix direct), zustand v5 object-selector infinite render, Shell leaf() crash on missing navItem, capacityPhases write-back, construction zero-duration mapping.


## Data dates and refresh intervals (P26A, v3.46.0)

- `DATA.sources[key].asOf` is the date of each dataset (`YYYY`, `YYYY-MM`, `YYYY-MM-DD` or `YYYY-Qn`; `const` for a
  calendar constant). `DATA.sourceRefresh` gives each data class (longest key prefix wins) a refresh interval in months,
  or `null` with a reason for a method, standard or physical constant. markets 6, tariffs 12, tariffs.gaas 3 (PRD-P26);
  the other intervals are stated in the table as assumptions.
- `js/rz-asof.js` renders `as of Mon YYYY` and, past the interval, `· older than N months` in the warning colour.
  Age is counted from the latest month the stamp allows, so the "older than" claim is always true.
- Gate `tools/test-asof.mjs`: every source key has a policy, every policy is used, every date parses and is not in the
  future, and `rz-engine.min.js` carries the same table (a stale twin showed the tracker date as current under a 2031
  clock — proven RED).
- Adopted on dc-market-tracker (dataset line) and tco (market rates under Country / Location: metro = markets,
  `country:XX` = countries, a metro the engine does not carry = "date not recorded"). roi reads no engine dataset, so it
  carries no stamp. Part B (a scheduled fetch of external sources) is BLOCKED on the owner.

## Location values (P11, v3.47.0)

- One dataset for country energy price and grid factor: `RZEngine.data.countries` (generated from
  `dcmoc/src/constants/countries.ts`). Calculators read it; a page table is a fallback only for a row the engine does not
  carry. Do not add a second copy (no `data/locations.json`).
- Every prefilled country value carries a source line from `js/rz-locations.js`. Since v3.49.0 (owner: less visible
  text) only the evidence word ASSUMED is visible; the sentence is its tooltip: "ASSUMED · DCMOC country reference, as of
  <date>" (the dataset cites its sources once, not per value), or "ASSUMED · legacy page value, no source on file" for a
  page-only row. The word ASSUMED is always visible beside an ASSUMED value.
- Open: `DATA.electricityTariffs` differs from `DATA.countries` for all 14 countries it covers, and its provenance note
  says it does not. Owner decision O-P11: adopt the cited tariff values into `countries.ts` (DCMOC financials move;
  rebuild DCMOC) or keep the current values and correct the tariff table's note. Until then nothing is merged and the
  field's title names the cited alternative.
- Gates: `tools/test-locations.mjs` (core) and `tools/test-locations-ui.mjs` (carbon, opex and tco render the same
  value as the engine for the same code).

## Calculator hand-offs (P13, v3.49.0)

- A calculator sends values to another only through a URL built by `RZHandoff.url(contract, values)` (`js/rz-handoff.js`).
  The receiving page reads them with `RZHandoff.parse()`: each value is checked against its type and range, applied
  values are tagged on their fields (`data-rz-handoff`), and invalid values are never applied. Hand-offs prefill and
  never lock; "Clear" removes the tags and keeps the values.
- The spares contract lives once in `data/calculators.json` → `spares.handoff` and is mirrored in the module; the gate
  asserts they are equal, that every target field exists, and that the enums equal the page's own option lists.
  Breaking the URL contract needs a version param (`hv=2`). LTC's incident links use the same contract (`from=incident`).
- `mtbf` is in years (the spares field is an annual failure rate); `tier` 1–4 maps to redundancy n / n1 / n1 / 2n and an
  explicit `redundancy` wins.
- Visible text is short ("From Tier Advisor · Tier 3 · N+1 · ID", "1 ignored"); the reasons and the how-to are tooltips.
- RFS → Cx (part B): a gap is queued only by the user ("→ Cx", system and level chosen in the row) in `rz_handoff_cx`
  (`js/rz-handoff-cx.js`: max 100, 7-day expiry, duplicate guard by `unitId:reqId` across the queue and the intaken
  issues). Cx adds it through `RZCxIssues.store().add()` with the UI's own store instance (its cache), never by writing
  the key; the back-link lives in `rz-cx-issue-sources` because the Tier 1 schema has no source field.
- Gates: `tools/test-handoff-contract.mjs`, `tools/test-handoff-cx.mjs`. Not yet: project → spares (spares and tier do
  not load `rz-project.js`).

## Reliability against a public reference (R120, 2026-11-12)

- Reference: NIST/SEMATECH e-Handbook §8.1.8.2–8.1.8.4 (public domain). Gap file:
  `documentation/product-transformation/gaps/dcmoc-reliability.md`.
- The engine's series, parallel and `kOutOfN` reproduce the reference exactly (F1–F4); these laws block.
- Defects found and fixed in v3.50.0 (owner chose option (a), 2026-11-12). Before, the headline mapped N+1 and 2N to
  the same 1-of-2 group, which understated N+1 downtime by about 10× at N=4, and the what-if row pooled 2N units as
  k of 2k. Now `models.reliability.redundantGroup(a, k, config)` gives N = k of k, N+1 = k of k+1, 2N = two systems of
  k, and 2N+1 = two systems of k of k+1. `systemAvailability(components, config, units)` and DCMOC
  `availabilityChain.ts` (`buildSystems`/`ccOverall`, used by the Reliability page, the RAM tab, the dashboard and the
  value trace) all use it. k comes from `commissioning.equipScale` (`unitsForLoad`). With k = 1 the old 1-of-2 value
  is kept. The value trace no longer keeps its own copy of the chain.
- Gate: `tools/test-reliability-reference.mjs`. F1–F4 and D1–D5 all block. Red on v3.48 (5 laws fail), green after.

## CAPEX against a public reference (R120, v3.54.0)

Reference: Koomey et al., *A Simple Model for Determining True Total Cost of Ownership for Data Centers*, Uptime
Institute TUI3011B (2007), Table 1 (LBNL-hosted). Gap file: `documentation/product-transformation/gaps/dcmoc-capex.md`.
Gate: `tools/test-capex-reference.mjs`.

- **One calibration for both CAPEX engines.** A city's `$/W` in `DATA.capexDetail.cityCapexPerW` is the all-in total
  of the basis spec `DATA.capexDetail.cityBasisSpec` (N+1, air, medium density, purpose-built, seismic zone 2;
  ASSUMED to be the typical Tier III build the cost guides describe). `models.capex.detailed` and DCMOC
  `CapexEngine.ts` price the basis spec at the same size and place with location multiplier 1 (`_locMult: 1`), then
  scale so it lands on the city figure; every other spec moves relative to it. Without a city the target is the
  region's median city `$/W` (site) or the median US city times the country index (DCMOC). Before v3.54.0 the anchors
  were 4.65 $/W (site) and 13.0 $/W (DCMOC): Virginia at the basis spec read 18.14 and 8.83 $/W against its own 13.40.
- The basis spec is priced at each engine's DEFAULT soft costs (site: simple mode; DCMOC: design 8 %, PM 5 %,
  contingency 10 %), so a user's own fees and contingency still move the result.
- `models.tco.crf(rate, life)` and `models.tco.annualizedCapital([{cost, lifeYears}], rate)` reproduce Table 1's
  annualization (19.1 M$/yr).
- Laws: F1–F2 parity, D1 site = DCMOC, D2 the basis spec equals the city figure, D3 the two engines agree within 2 %
  off the basis (2N, N, liquid + AI rack, 500 kW–20 MW, warehouse, zone 0). Red on v3.53.0 (5 laws, D3 worst 45 %).
- Open (stage 2): an area-driven `$/m²` term (F3) needs a current, sourced `$/m²`.

## Measured PUE against a public reference (R120 step 3a)

Reference: Data Center Metrics Task Force, *Recommendations for Measuring and Reporting Overall Data Center
Efficiency* v2 (2011), Table 1, Table 2, Appendix A (ENERGY STAR-hosted). Gap file:
`documentation/product-transformation/gaps/pue.md`. Gate: `tools/test-pue-reference.mjs`.

- `models.pue.measured({category, itKwh | itKw, energy})` is the one measured-PUE formula: every energy type that
  crosses the boundary times its `DATA.pueSourceWeights` factor, over IT energy at the category's meter
  (`DATA.pueCategories`: 0 peak kW, UPS output, all-electric only; 1 UPS output, 2 PDU output, 3 IT input, 12-month
  kWh). It returns `{ok:false, reason}` instead of a number for anything the reference does not allow.
- The design estimate on `pue-calculator.html` (`estimatePue`) is a different quantity and stays; a measured value
  is labelled with its subscript (PUE1) and never mixed into the estimate.
- Laws W1, F1–F5; red 6/6 before the engine change. The paper prints 1.70 for both Appendix A cases; the gate
  checks the exact 1.705 and 1.708.
