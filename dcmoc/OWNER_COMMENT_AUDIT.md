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

## Audit method (per row)
1. Open the actual component/engine path.
2. Confirm the feature exists AND works as the comment asked (not a stub / not conditional-degraded like C-001).
3. Mark ✅ / ⚠️ / ❌ with the file:line evidence.
4. Fix every ⚠️/❌ properly (comprehensive, not receh), batch-ship with version bump + gates.
