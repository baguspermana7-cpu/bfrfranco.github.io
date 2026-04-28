# Calculator Models Engine Plan — ResistanceZero

> **Version**: 1.0 | **Created**: 2026-04-28
> **Status**: Roadmap (no code shipped yet)
> **Parent vision**: [`SUPER_ENGINE.md`](./SUPER_ENGINE.md) — master architectural design unifying this document and `CALC_ENGINE_PLAN.md` under a single `window.RZEngine.*` API.
> **Sibling plan**: [`CALC_ENGINE_PLAN.md`](./CALC_ENGINE_PLAN.md) — covers plumbing (auth, modal, PDF, charts). This document covers the **calculation math layer** (workforce, capex, opex, ROI, TCO, PUE).

---

## Why This Document Exists

User-raised concern (2026-04-28):

> "Concern jika tidak ada big engine yang calculate semua BIG literally, itu nantinya diverse sedikit harus buat calculator baru dan beda, walaupun mungkin ada 1-2 parameter calculation yang sharing agar lebih effective dan efficient dan accurate dan presisi. Dan seamless untuk update atau pembaharuan."

**Translation:** without a unified calculation engine, every minor variation in calculator requirements forces a new from-scratch calculator. Even when 80% of the math is shared, today's static-HTML codebase forces operators to duplicate, drift, and lose precision over time.

`CALC_ENGINE_PLAN.md` already covers the **plumbing** consolidation (auth, modal HTML, PDF export, Chart.js setup) — but does NOT cover the **mathematical models** themselves. Salary benchmarks, regional cost multipliers, attrition factors, PUE formulas, ROI calculations, and TCO lifecycle math are scattered across 18+ calculators and inevitably drift.

**DCMOC** (`/dcmoc/src/lib/`) demonstrates the right pattern in TypeScript:
- `lib/CapexEngine.ts` — single source of truth for CAPEX math
- `lib/capex-data.ts` — single source of truth for CAPEX constants
- `lib/format.ts` — shared formatters
- `modules/staffing/ShiftEngine.ts` — domain-specific engine for workforce math

The static-HTML side needs a parallel JavaScript layer.

---

## Target Architecture: `calc-models.js`

A single shared library exposing one global namespace organized by domain:

```js
window.CalcModels = {
    // === Shared constants (single source of truth) ===
    data: {
        regions: {
            US:    { salaryMult: 1.00, powerKwh: 0.12, label: 'United States' },
            EU:    { salaryMult: 0.85, powerKwh: 0.30, label: 'Europe' },
            APAC:  { salaryMult: 0.45, powerKwh: 0.10, label: 'Asia-Pacific' },
            LATAM: { salaryMult: 0.55, powerKwh: 0.15, label: 'Latin America' }
        },
        salaryBenchmarks: {
            // From article-24, Uptime 2024, AFCOM 2024 — verified 2026-04-28
            dcTechMid:           { US: 75100, EU: 64000, APAC: 34000, LATAM: 41000 },
            electricianJourneyman: { US: 120000, EU: 92000, APAC: 38000, LATAM: 54000 },
            cdfomSenior:         { US: 155000, EU: 132000, APAC: 78000, LATAM: 95000 }
        },
        attritionFactors: {
            replacementCostMult: 2.13,    // Center for American Progress
            voluntaryAttritionAvg: 0.25,  // 25% — DataX Connect 2024
            apprenticeRetention: 0.78     // 4-year DOL apprenticeship retention
        },
        years: [2025, 2026, 2027, 2028, 2029, 2030],
        currency: { USD: 1.0, EUR: 0.92, IDR: 15700 },
        pueDefaults: {
            airCooledTier3: 1.58,
            liquidCooledTier3: 1.20,
            immersionTier3: 1.05
        }
    },

    // === Domain models ===
    workforce: {
        annualHiresRequired(currentStaff, targetStaff, attritionRate, yearsToTarget),
        attritionCost(staff, attritionRate, avgSalary, replacementMult),
        strategyFitScore(strategyId, workforceMix),  // physical-heavy vs NOC-heavy
        cumulativeHires(annualHires, years, retentionFactor),
        yearsToCloseGap(staffGap, annualHires, strategyCoverage)
    },
    capex: {
        datacenterBuildCost(mw, tier, region),     // tier 1-4
        modularPremium(baseCost, modularPct),
        mepDistribution(totalCapex, region)        // typically 35-45% MEP
    },
    opex: {
        powerCostAnnual(mw, pue, regionPower, hoursPerYear),
        coolingEfficiency(climate, designDeltaT),
        staffingCostAnnual(headcount, region, role),
        contractCostAnnual(scope, region)
    },
    roi: {
        paybackPeriod(initialCost, annualBenefit, annualCost),
        npv(cashflows, discountRate),
        irr(cashflows)
    },
    tco: {
        lifecycle(capex, opex, years, refreshPct),
        replacementCycles(assetLife, totalYears)
    },
    pue: {
        pueFromInputs(itLoad, totalLoad),
        dcie(pue),                                  // reciprocal
        annualEnergyCost(itKw, pue, kwhRate)
    },
    forecast: {
        compoundGrowth(base, ratePct, years),
        linearTrend(points)
    }
};
```

This composes with `CalcEngine` from the plumbing plan:

```js
window.CalcEngine = {
    auth, modal, pdf, charts, format,           // CALC_ENGINE_PLAN
    models, data: CalcModels.data               // CALC_MODELS_PLAN (re-exported)
};
```

---

## Why this matters (concrete examples)

### Today (drift problem)
`article-24.html`, `article-27.html`, and `roi-calculator.html` each hardcode `avgSalary = 72000` for a US DC tech. When the user wants to update to the 2026 benchmark of `$75,100`, three files must be edited — and three months later a new article-29 calculator will ship with `72000` again because the author copy-pasted from an old template.

### After CALC_MODELS_PLAN
Edit `CalcModels.data.salaryBenchmarks.dcTechMid.US` from `75100` to `78500` in **one place**. All 3 calculators reflect the change instantly. No drift, no copy-paste regression.

### Adding a new calculator with 1-2 parameter difference
Today: clone the most-similar calculator HTML (~3,000 lines), strip out 80% of the IIFE, rewire constants. ~1 day of work + multiple bugs.
After: write a new IIFE that calls `CalcModels.workforce.annualHiresRequired(...)` and overrides only the parameters that differ. ~2 hours of work, mathematically identical to the others wherever it shares logic.

---

## Four-Phase Rollout

### Phase M1 — Skeleton + Data Namespace (~1 week)

**Scope:** Create `/calc-models.js` with the `data` namespace populated from currently-scattered constants. Empty function stubs in each domain namespace.

**Deliverables:**
- `/calc-models.js` (~200 LOC) at repo root
- Pilot in `article-27.html`: replace inline `avgSalary = 72000`, `replacementFactor = 2.13`, region multipliers with `CalcModels.data.*` references
- Document the namespace in this file

**Expected savings:** modest (~30 LOC in article-27); main value is **establishing the convention**.

### Phase M2 — Workforce + ROI Domains (~2 weeks)

**Scope:** Implement workforce + ROI math functions. Pilot in 3 files.

**Deliverables:**
- `CalcModels.workforce.{annualHiresRequired, attritionCost, strategyFitScore, cumulativeHires, yearsToCloseGap}`
- `CalcModels.roi.{paybackPeriod, npv, irr}`
- Migrate `article-24.html`, `article-27.html`, `roi-calculator.html` to call the model functions instead of inline math

**Expected savings:** ~150 LOC across 3 calculators; precision improvements (consistent rounding, edge-case handling).

### Phase M3 — Capex + Opex + TCO (~2 weeks)

**Scope:** Most-used domains. Migrate the standalone calculators.

**Deliverables:**
- `CalcModels.capex.*`
- `CalcModels.opex.*`
- `CalcModels.tco.*`
- Migrate `capex-calculator.html`, `opex-calculator.html`, `tco-calculator.html` and the embedded calculators in articles that use this math

**Expected savings:** ~500 LOC; significant, since CAPEX math is the most duplicated.

### Phase M4 — PUE + Forecast + Final Consolidation (~1 week)

**Scope:** Remaining domains and final unification under `window.CalcEngine.models.*`.

**Deliverables:**
- `CalcModels.pue.*`
- `CalcModels.forecast.*`
- Re-export under `window.CalcEngine.models` (alongside `CalcEngine.{auth, pdf, charts}` from CALC_ENGINE_PLAN Phase 4)
- Final standard: `CALC_MODELS_STANDARD.md` (this doc evolves into the standard)

**Expected savings:** ~100 LOC; main value is the unified API.

---

## Migration Checklist (per calculator)

When migrating a calc page to `calc-models.js`:

- [ ] Replace inline constants (`avgSalary`, `replacementFactor`, region multipliers, PUE defaults, etc.) with `CalcModels.data.*` references.
- [ ] Replace inline math functions with `CalcModels.<domain>.<fn>()` calls.
- [ ] Add `<script src="calc-models.js" defer></script>` (load order: after `auth.js`, before the IIFE).
- [ ] Verify localhost:8081 — page renders, calculations produce identical results to the pre-migration version (run a regression diff with screenshot or log dump).
- [ ] Add a CHANGELOG entry under the appropriate phase.

---

## Per-Domain Risk Matrix

| Domain | Risk | Reason |
|---|---|---|
| workforce | Low | Currently used in only 3-4 calculators; well-bounded math. |
| roi | Low-Medium | Standard NPV/IRR formulas; pure functions. |
| pue | Low | Single formula. |
| capex | High | Complex region/tier multipliers; ~6 calculators currently use scattered versions. Requires careful regression test. |
| opex | High | Same as capex. Currency conversion edge cases. |
| tco | Medium | Composes capex + opex; depends on stability of those phases. |
| forecast | Low | Pure-math helpers. |

---

## Cross-References

| Standard | What changes when this plan ships |
|---|---|
| [`CALC_ENGINE_PLAN.md`](./CALC_ENGINE_PLAN.md) | Phase 4 final API will include `models` namespace from this plan |
| `CALCULATOR_PROMPT_STANDARD.md` | New calculators must use `CalcModels.data.*` for any constant that has a benchmark value; checklist updated |
| `CHANGELOG.md` | Each phase ships with a CHANGELOG entry |
| `MEMORY.md` | Calculator engine consolidation memory entry references both PLAN docs |

---

## Out of Scope

- DCMOC TypeScript engines stay separate; this plan is for static HTML side only. The two architectures don't share runtime code but the `CalcModels.data` constants should mirror DCMOC's `lib/*-data.ts` values where applicable (manual sync).
- Server-side validation / API. Everything in `calc-models.js` runs client-side.
- Database / persistence. Constants live in code; values change via PR review.
