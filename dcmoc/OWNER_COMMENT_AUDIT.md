# DCMOC — Owner Comment Audit Ledger

> Mandate M-301: every owner comment tracked with status (addressed / half-done / broken / not-started).
> Reconstructed from plan files (`cheerful-cuddling-mitten.md`) + memory. Each item must be
> **live-verified against the current code** — a memory "SHIPPED" claim is NOT proof; the owner
> reported sloppy execution, so every row needs a code check.
>
> Status legend: ✅ verified-in-code · ⚠️ half-done/conditional · ❌ broken/missing · 🔍 needs live-verify (memory claims done)

Last updated: 2026-07-26 (audit reopened after owner: "semua comment saya tidak di eksekusi dengan proper")

## VERDICT (19 items + C-001, all live-verified vs code by 3 adversarial agents)
Owner was **right that sloppiness existed** — but it was **2 items**, not everything:
- **✅ 17 items genuinely done + engine-wired** (A 7/7 · B 5/5 · C-01,C-02 · D 4/4) — no phantom inputs, statements reconcile, dedup truly non-editable.
- **⚠️→✅ 2 real defects, both FIXED this session** (the exact "wired-but-degraded" pattern):
  - **C-001** Strategic Planning: land/grid/climate/PUE were conditional-locked → editable phantom seed when no site. Now always read-only + empty-state.
  - **C-03** rackForm was a fake cost driver (only fed a display metric, $0 CAPEX effect). Now multiplies the `building` category → real CAPEX impact.
- Both fixes: tsc 0, built, deployed to `dcmoc/`. **NOT pushed** — pending version bump + ship gates.

---

## NEW — this session

| ID | Comment (verbatim / paraphrase) | Status | Evidence |
|----|----|----|----|
| C-001 | "[Strategic Planning screenshot] kenapa ada isian ini" — Total Land Area / Grid Capacity editable though banner says "LOCKED (single source)" | ✅ FIXED | `StrategicPlanningDashboard.tsx`: land/grid/climate/targetPUE now **always** read-only mirrors; when no site → empty-state "Select a site to run feasibility" (no phantom seed 10000/20). Was conditional-lock (`disabled={derived!=null}`) → editable when no site fed it. tsc 0, built, deployed. |

---

## Program A — Owner-review batch A/D/12/H/10/F/G (memory: v1.115.72–.78 SHIPPED)

| ID | Item | Memory status | Live-verify |
|----|----|----|----|
| A-01 | Power-source + fuel-type end-to-end (grid/prime/hybrid, diesel/HVO/gas) | ✅ | rz-engine.js:8717 powerSourceModel/fuelTypeModel; FuelGenEngine prime 8760×util; CapexEngine gridCapexMult:0 prime; CarbonEngine co2PerUnit; store wired |
| A-02 | CDU `models.water.coolingLoop` water+glycol+tower → WUE | ✅ | rz-engine.js:12181 model + DesignToolsDashboards CDU "Water & Glycol Balance" table; engine-ready gate OMITS section when null (correct, no phantom) |
| A-03 | Sim KPIs + cause-effect → DiagnosticModal `variant='explain'` | ✅ | RedValue.tsx:76 variant='explain'; SimulationDashboard 4 KPI diagnoses real fmtMoney (no `$X/yr` placeholder) |
| A-04 | `PageDescription` registry ~48 tabs | ✅ | PageDescription.tsx 48 entries; Shell.tsx:833 injected once |
| A-05 | `maintenance.ops.pmRegime` → headcount | ✅ | rz-engine.js:8683 all 5 regimes distinct → opsHeadcount + availabilityImpact; MaintenanceDashboard dropdown writes store |
| A-06 | PhasedFinancial recommendations panel + auto-optimize | ✅ | PhasedFinancialDashboard:497 panel + Auto-optimize → optimizeRevenueForHurdle bisection (real, previews before Apply) |
| A-07 | Commissioning "IST Scenarios" 10 scripted L5 tests | ✅ | rz-engine.js:6908 exactly 10 scenarios; CommissioningEnginePage IstScenariosTab + appliesFrom redundancy gate |

## Program B — Owner-review 12-workstream batch (#375–384)

| ID | Item | Memory status | Live-verify |
|----|----|----|----|
| B-01 | Trace collapse/expand reusable (`useCollapsibleTree`) | ✅ | hooks/useCollapsibleTree.ts:20, used in TraceValue + CollapsibleTree |
| B-02 | CAPEX total trace decompose | ✅ | value-trace.ts:193 capex.total → [hard,soft,contingency,fom] real nodes |
| B-03 | Simulation KPIs trace + diagnostic | ✅ | SimulationDashboard kpiDiag → DiagnosticModal variant='explain', live values |
| B-04 | utilization>100% root fix (gensets on facility not IT) | ✅ | capacity-adapter.ts:212 genCountFacility=ceil(facilityKw/2000); at-risk chips are buttons→DiagnosticModal |
| B-05 | CAPEX canonicals read-only + Setup-Wizard dedup | ✅ | SimulationDashboard:313 wizard removed; canonicals RedMirror |

## Program C — IA-dedup + auto-derive (A/B/C, memory: v1.115.88–.92 DONE)

| ID | Item | Memory status | Live-verify |
|----|----|----|----|
| C-01 | CAPEX Assumptions dedup (Gantt/buildingType/site/market → RedMirror) | ✅ | CapexDashboard RedMirror display-only, Gantt→Construction; truly non-editable |
| C-02 | Site Intel tooltips + `countryBaselineEnums` auto-derive + autoOptimizeSite | ✅ | SiteEditorDrawer SITE_PARAM_HELP; site-adapter countryBaselineEnums from DATA.countries; autoOptimizeSite wired |
| C-03 | Time-to-COD hint + rack density auto-from-arch + rackForm cost driver | ✅ FIXED | COD ✅ + density-auto ✅. rackForm was display-only (floorSpace metric); NOW `rackFormFactor` multiplies the space-driven `building` category (CapexEngine.ts:229) → std42u/tall48u/ocp actually move CAPEX total. DATA keys match UI select values (std42u 1.0 / tall48u 0.90 / ocp 1.15, sourced EIA-310/OCP v3). tsc 0, built, deployed. |

## Program D — OPEX program WS0–WS4 (memory: v1.116–1.119 ALL SHIPPED)

| ID | Item | Memory status | Live-verify |
|----|----|----|----|
| D-01 | WS1 per-country OPEX model + Operations breakdown | ✅ | rz-engine.js:11643 fullBreakdown 8 groups, each line → real DATA factor; reconciles total=subtotal+overhead; OpexBreakdown.tsx on Operations |
| D-02 | WS2 Finance P&L + Balance Sheet + Sankey | ✅ | FinancialStatements.tsx under "Pro Forma (Full)"; netIncome=ebitda−tax; BS balances (cash = identity plug, disclosed); Sankey recharts |
| D-03 | WS3 maintenance 5-strategy deep-dive | ✅ | 5 pmRegime distinct pmHoursMult/failureMult/cost; MaintenanceDashboard dropdown→store→engine; outputs differ per strategy (FTE floor-bound at small MW, disclosed) |
| D-04 | WS4 CAPEX input-dedup (7 fields → RedMirror) | ✅ | CapexDashboard 7 fields RedMirror display-only (0 input/onChange); all 7 editable in Requirements. Truly non-editable — no conditional-lock trap |

---

## Program E — A–L overnight (v1.115.23–.33) — audited 2026-07-31
11/11 ✅ genuinely wired end-to-end (SLD, 838-entry tooltip DB, Cx day-cost, 4-level recursive Gantt+WBS, RedValue+optimizer, BESS/PV+mech view, computed availability, Delivery-Governance dossier, EnPI+bankability, capacity coherence).
- ⚠️ **AL-03/06 (minor cosmetic, FIX PENDING):** Commissioning per-level cost BARS render a fixed `levelProportions` split (rz-engine.js:12594/7079) instead of the real per-level `levelCosts` the engine already computes (:12540). Grand total + durations are real; only the per-level bar proportions are fake. Wire bars → levelCosts.
- Nits (no action): tooltip DB is 838 entries not 818; "7832" is a comment, not consumed.

## Program F — UIUX 16-keluhan (v1.85–.87) — audited 2026-07-31
11/12 ✅ genuinely real (PrintReport, NETA/IEEE Cx refs, newsvendor spares, tooltip portal+resize, computed nines, 5-engine site scoring, MC 10k+Strategic derived, deep-sea, symbol palette, Settings/Integrations, hover sweep).
- ⚠️ **UX-07 20kV option (FIX PENDING, same class as rackForm):** use-case auto-profile is REAL, but the 20kV grid-voltage option renders + drives the SLD yet has **$0 CAPEX effect** — `gridVoltage` never appears in CapexEngine; 20kV silently reuses 33kV rates (admitted inline InfrastructureOptionsSection.tsx:23). Give it a distinct, sourced CAPEX effect on the electrical/switchgear category.

## Program G — mega-slice M–X (v1.115.37–.46) — audited 2026-07-31
8/11 solid; fabricated-PDF-financials kill VERIFIED holds ✅ (MX-10a). 2 overstated (FIX PENDING):
- ⚠️ **MX-08** "REAL 3-objective optimization" overstated — only Objective 1 (Blended IRR) is actually optimized (40-iter bisection, genuine); Objectives 2 (util) & 3 (budget vs P80) are **report-only flags**, no search, no carbon/reliability objective. Fix: relabel honestly OR implement.
- ⚠️ **MX-10(b)** residual divergent revenue hardcodes despite "ONE revenue basis": **280** in site-adapter.ts:306 + value-trace.ts:1453, **120** in diagnostics.ts:330. Single source = constants/finance.ts:14 (150). Fix: route these to the single source.
- Nit: analogies grew to 80 (claimed 41) — content growth, no action.

## FINAL — all fixes SHIPPED
- **v1.120.1**: C-001 Strategic Planning lock + C-03 rackForm cost driver.
- **v1.120.2**: MX-10(b) revenue hardcodes (280/120→single source) ✅ · AL-03/06 commissioning per-level real levelCosts share ✅ · MX-08 honest relabel ✅.
- **UX-07 20kV**: NOT a defect (false positive) — substationType drives CAPEX correctly; gridVoltage=SLD only. No change (avoided double-count).

## Grand total: ~52 items across 6 programs (A/B/C/D/E/F+M–X)
- **48 genuinely engine-wired + working** on first audit.
- **6 real defects** ("wired-but-degraded" class the owner suspected) — ALL fixed: C-001, C-03, MX-10b, AL-03/06, MX-08. (UX-07 investigated → false positive.)
- Owner was right that sloppiness existed; it was ~11% of items, now 0.

## Audit method (per row)
1. Open the actual component/engine path.
2. Confirm the feature exists AND works as the comment asked (not a stub / not conditional-degraded like C-001).
3. Mark ✅ / ⚠️ / ❌ with the file:line evidence.
4. Fix every ⚠️/❌ properly (comprehensive, not receh), batch-ship with version bump + gates.
