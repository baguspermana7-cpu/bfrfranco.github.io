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
| Every lifecycle calc | `models.*` (13 pillars) | `RZEngine.models.*` / `rzModels()` |

## Generated data — never hand-edit
`DATA.countries` is written between `/* @@COUNTRIES_START */` … `/* @@COUNTRIES_END */`
by **`tools/build-countries-data.mjs`**. Edit the authoring source
`dcmoc/src/constants/countries.ts`, then rerun the generator. The parity gate
**`tools/test-reference-parity.mjs`** fails CI if the engine copy drifts.

## Definition of done for any engine/data change
1. `node tools/build-countries-data.mjs` (if country data changed).
2. `terser rz-engine.js -c -m -o rz-engine.min.js` (never hand-edit the min).
3. `node tools/test-rz-engine.mjs` (299/0) + `node tools/test-reference-parity.mjs` (0 fail).
4. Bump `js/rz-version.js` + `CHANGELOG.md` + `python3 tools/build-changelog-html.py --apply`.
5. Bump `?v=` on pages loading `rz-engine.min.js`; for DCMOC rebuild + copy `out/`→`dcmoc/`.
6. Update this doc + `SUPER_ENGINE.md` if a new `models.*` namespace or DATA key was added.

## Program phases (status)
- **Phase A — single-source reference data:** `DATA.countries` + enums + parity gate — **LANDED v1.61.0** (engine + DCMOC). Root-calculator consumers still to migrate.
- **Phase 0 — engine completeness:** `site.deriveFactors` + `commissioning.programCost/programSchedule` **LANDED v1.62.0** (311/0). Still to build: `models.decision` (promote deterministic provider), `fire`/`cdu`/`tier`/`spares` (consolidate the standalone `js/fire-*.js`,`js/cdu-*.js` + inline tier/spares logic).
- **Phase B — de-fake modules:** Commissioning + Site Intel wired to live engine inputs — **LANDED v1.62.0** (no hardcoded vectors).
- **Phase C/D — wire remaining modules + calculators:** **LANDED v1.62.0** — 9 DCMOC modules (Grid/Disaster/Compliance/Capacity/AssetLifecycle/CBM/FuelGen/Tax/Carbon) delegate to `rzModels()` with local fallback (Carbon reconciled to `models.carbon`); `opex`/`carbon`/`tco` calculators read `DATA.countries` + `pueMatrix` (SG rate 0.22 / air PUE 1.50 everywhere).
- **Phase E — UX layer:** **LANDED** — KPI value-on-hover + tooltips, QuickActions hover+tooltips, LifecycleStrip "View Engine Graph" + hover, AI-Assistant modal (+deterministic fallback), module KPI-grid responsive sweep (dashboard 0-overflow at 390/768).
- **Shared pillar engines — LANDED v1.63.0:** `models.tier`/`fire`/`cdu`/`spares`/`decision` promoted into `rz-engine.js` (backend-served via `/calc`). Layer-13 decision brain now in the engine. Engine gate 321/0.
- **Resolved accuracy decision:** DC electricity rate — `DATA.countries.economy.electricityRate` = retail/display (single-sourced everywhere the user sees a rate); `models.opex` keeps the calibrated DC-contract blend (cockpit-gate-validated). Documented distinction, `ppaRate` override available. NOT force-merged (would break cockpit accuracy + fabricate DC rates for 32 countries).
- **DCMOC apps LANDED v1.64.1:** the 8 Platform surfaces (Data Library / Templates / Projects / Settings / Knowledge / Integrations / Audit / Users) are real + engine-backed (`PlatformDashboards.tsx`). Strategic acquisition OPEX → `models.opex` (v1.64.2). Backend `/calc` redeployed with all v1.64 rich models live (Version 98973552).

## NEXT PHASE — Article calculators → engine (scoped, not started)
**Scope (grep-verified 2026-07-18):** **21 of the 22** `article-*.html` interactive calculators are self-contained INLINE JS (only 1 uses `RZEngine`). Owner mandate: bring every calculator/parameter under the shared engine so DCMOC can wire from all of them (full / partial / even a single parameter), with complex algorithms in `rz-engine.js`.
**Pattern to apply per article calc** (same as the DC Hub tools):
1. Read the article's `<script>` calc: extract formula + inputs + outputs.
2. If the math overlaps an existing `models.*`, bind the page to it (fallback inline). If unique, promote it as a new `models.*` function + `DATA.*` constants + `DATA.sources` row + `test-rz-engine.mjs` asserts.
3. Rewire the article page to consume the engine (guard `window.RZEngine`; keep inline as fallback); verify headless (0 new console errors) + `audit-js-syntax`/`audit-script-tags` CLEAN.
4. Surface the reusable ones as DCMOC parameters where they add value.
**Execution note:** best done as a parallel sweep (one agent per article, worktree-isolated) once account/session limits are clear — do NOT batch-edit live article pages without per-page headless verification. The 21 inline pages: article-1/2/3/4/5/6/8/11/12/13/14/15/16/17/18/20/22/23/24/25/26 (+ re-scan 7/9/10/27).
