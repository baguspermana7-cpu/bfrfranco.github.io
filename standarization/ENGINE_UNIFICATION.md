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
