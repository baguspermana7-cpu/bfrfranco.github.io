# Super Engine — Master Architectural Design

> **Version**: 1.0 | **Created**: 2026-04-28 | **Status**: Design (no code shipped yet)
>
> **What this is**: the unified vision for `window.RZEngine` — a single browser-side library that supplies every static-HTML calculator on resistancezero.com with shared data, math, plumbing, and UI primitives.
>
> **What this is not**: a replacement for custom calculators. New article calculators stay free to invent custom inputs, custom outputs, and custom math. The engine provides **anchors** — shared parameters and infrastructure that every calculator MUST consume so the site stays internally consistent.

> **Children plans**:
> - [`CALC_ENGINE_PLAN.md`](./CALC_ENGINE_PLAN.md) — phased implementation of plumbing layer (auth, modal, PDF, charts).
> - [`CALC_MODELS_PLAN.md`](./CALC_MODELS_PLAN.md) — phased implementation of math layer (workforce, capex, opex, ROI, TCO, PUE).

---

## A. Why a Super Engine

Every calculator on the site (6 standalone calculators + 12+ embedded article calculators, ~18 in total) currently re-implements:

- Auth + session check (`rz_premium_session` parsing)
- Login modal HTML/CSS
- `rz-auth-change` event handling (or _not_ — many forget, causing login bugs)
- PDF export via `window.open()`
- Chart.js setup boilerplate
- Regional cost multipliers (US/EU/APAC/LATAM)
- Salary benchmarks (DC tech, electrician, CDFOM)
- Attrition factors (213% replacement, 25% voluntary)
- PUE defaults (1.58 air, 1.20 liquid, 1.05 immersion)
- Power $/kWh by region
- Currency rates
- Year/horizon selectors

Quantified duplication audit (2026-04-28):
- **Plumbing** (auth, modal, PDF, charts): ~5,800 LOC duplicated across 18 files
- **Math + constants**: estimated ~2,000–3,000 LOC additional duplication

Concrete failure mode (observed 2026-04-28):
- User logs in via navbar (auth.js writes `rz_premium_session` with `{email, tier, role, expires:ISOString}`).
- User opens article-27 calculator → IIFE checks `localStorage` looking for `sess.exp` (numeric) — does not find it because navbar wrote `sess.expires` (ISOString).
- User is told to log in again. User loses trust.

This is exactly the kind of drift the Super Engine eliminates.

---

## B. Architecture: one global namespace

```js
window.RZEngine = {
    // === I. Shared data (single source of truth) ===
    data: {
        version:          '1.0.0',                                          // bumped on any constant change
        lastUpdated:      '2026-04-28',
        years:            [2025, 2026, 2027, 2028, 2029, 2030],             // Target Year selector
        regions: {
            US:    { salaryMult: 1.00, powerKwh: 0.12, label: 'United States', currency: 'USD' },
            EU:    { salaryMult: 0.85, powerKwh: 0.30, label: 'Europe',         currency: 'EUR' },
            APAC:  { salaryMult: 0.45, powerKwh: 0.10, label: 'Asia-Pacific',   currency: 'USD' },
            LATAM: { salaryMult: 0.55, powerKwh: 0.15, label: 'Latin America',  currency: 'USD' }
        },
        currency:         { USD: 1.0, EUR: 0.92, IDR: 15700, SGD: 1.34 },
        inflationAnnual:  { US: 0.025, EU: 0.022, APAC: 0.030, LATAM: 0.045 },
        salaryBenchmarks: {
            // Verified 2026-04-28 against Uptime 2024, AFCOM 2024, BLS 2024
            dcTechMid:             { US: 75100, EU: 64000, APAC: 34000, LATAM: 41000 },
            electricianJourneyman: { US: 120000, EU: 92000, APAC: 38000, LATAM: 54000 },
            cdfomSenior:           { US: 155000, EU: 132000, APAC: 78000, LATAM: 95000 }
        },
        attritionFactors: {
            replacementCostMult:  2.13,    // Center for American Progress
            voluntaryAttritionAvg: 0.25,   // 25% — DataX Connect 2024
            apprenticeRetention:   0.78    // 4-year DOL apprenticeship retention
        },
        pueDefaults: {
            airCooledTier3:     1.58,
            liquidCooledTier3:  1.20,
            immersionTier3:     1.05
        }
    },

    // === II. Math models (math layer) ===
    models: {
        workforce: {
            annualHiresRequired(currentStaff, targetStaff, attritionRate, yearsToTarget),
            attritionCost(staff, attritionRate, avgSalary, replacementMult),
            strategyFitScore(strategyId, workforceMix),
            cumulativeHires(annualHires, years, retentionFactor),
            yearsToCloseGap(staffGap, annualHires, strategyCoverage)
        },
        capex: {
            datacenterBuildCost(mw, tier, region),
            modularPremium(baseCost, modularPct),
            mepDistribution(totalCapex, region)
        },
        opex: {
            powerCostAnnual(mw, pue, regionPower, hoursPerYear),
            coolingEfficiency(climate, designDeltaT),
            staffingCostAnnual(headcount, region, role),
            contractCostAnnual(scope, region)
        },
        roi:      { paybackPeriod, npv, irr },
        tco:      { lifecycle, replacementCycles },
        pue:      { pueFromInputs, dcie, annualEnergyCost },
        forecast: { compoundGrowth, linearTrend, projectByYear }
    },

    // === III. Plumbing (UI/infra layer) ===
    auth: {
        validateLogin(email, pass),     // returns matched user or null
        getSession(),                   // returns active session or null
        setSession(email, tier, role),  // 30-day expiry, ISOString format compat with auth.js
        logout(),                       // clears session + emits rz-auth-change
        dispatchAuthChange(action, detail),
        onAuthChange(fn)                // window.addEventListener wrapper
    },
    modal: {
        create({ id, title, accentColor, onSubmit }),  // returns { show(), hide(), destroy() }
        show(id), hide(id)
    },
    pdf: {
        exportPDF({ filename, data, theme, layout }),
        generateTable(rows, columns, opts),
        applyTheme(themeName)            // 'red'|'cyan'|'violet'|'emerald'|...
    },
    charts: {
        histogram(canvas, data, opts),
        tornado(canvas, data, opts),
        sensitivity(canvas, data, opts),
        roiLine(canvas, data, opts),
        hiringTrajectory(canvas, data, opts),
        costStackedBar(canvas, data, opts),
        radar(canvas, datasets, opts)
    },
    format: {
        currency(n, region),  // formats per region's currency
        percent(n),
        number(n),
        weeks(n), months(n), ymd(date)
    },
    events: {
        dispatch(action, detail),
        on(action, fn),
        off(action, fn)
    },

    // === IV. Shared UI primitives ===
    ui: {
        gateOverlay(elementId, message, ctaLabel, ctaHandler),
        kpiCard(label, value, subLabel, accentColor),
        badge(text, variant),                    // 'create'|'sub'|'extend'|'fast'|'slow'|'cost1-4'
        tooltip(target, content),
        glossaryAnchor(term, slug)               // e.g. ('AIOps','aiops') → <a href="glossary.html#term-aiops">AIOps</a>
    }
};
```

---

## C. The "Shared Anchor Parameters" rule

**Even when a new calculator is custom-built for one article, these parameters MUST come from `RZEngine.data`** rather than being inlined in the IIFE:

| Parameter | Engine source | Used by |
|---|---|---|
| **Target Year / horizon** | `RZEngine.data.years` | Any forecasting calculator (workforce, capex, opex, ROI, TCO, PUE projections) |
| **Region** | `RZEngine.data.regions` | Any calculator with regional cost variance |
| **Currency** | `RZEngine.data.currency` | Any calculator displaying monetary values |
| **Inflation rate** | `RZEngine.data.inflationAnnual` | Multi-year cost projections |
| **Salary benchmarks** | `RZEngine.data.salaryBenchmarks` | Workforce / cost calculators |
| **Attrition factors** | `RZEngine.data.attritionFactors` | Workforce calculators |
| **PUE defaults** | `RZEngine.data.pueDefaults` | Energy / OpEx calculators |
| **Power $/kWh** | `RZEngine.data.regions[code].powerKwh` | Energy / OpEx calculators |

This is the **"1-parameter sharing"** principle. Even minimum sharing across otherwise-independent calculators preserves cross-site data consistency and seamless updates.

**Concrete example — when a benchmark refreshes:**
- Today: 2026 mid-tech salary updates from $72K → $75.1K → operator must edit 3+ HTML files manually, easy to miss one, drift accumulates.
- After Super Engine: operator changes ONE value in `RZEngine.data.salaryBenchmarks.dcTechMid.US`, bumps `RZEngine.data.version`, adds a CHANGELOG entry. Every calculator reflects the change instantly.

---

## D. New calculator template (consumer pattern)

Every new article calculator follows this skeleton. Custom math is welcome; custom anchor parameters are not.

```js
(function() {
    'use strict';
    if (!window.RZEngine) { console.error('RZEngine missing'); return; }
    var E = window.RZEngine;

    // 1. Read shared anchor params (NEVER inline these)
    var years      = E.data.years;
    var region     = document.getElementById('myc-region').value;
    var regionData = E.data.regions[region.toUpperCase()];
    var avgSalary  = E.data.salaryBenchmarks.dcTechMid[region.toUpperCase()];
    var pue        = E.data.pueDefaults.liquidCooledTier3;

    // 2. Custom math for this article (free to differ)
    function myCustomFormula(inputs) {
        // Use E.models.* where applicable, custom math otherwise
        var attritionCost = E.models.workforce.attritionCost(
            inputs.staff, inputs.attritionRate, avgSalary,
            E.data.attritionFactors.replacementCostMult
        );
        // ... custom downstream math
        return { ... };
    }

    // 3. Plumbing wired via engine
    E.auth.onAuthChange(function(action){ if(action==='login') unlockPro(); });
    E.charts.histogram(document.getElementById('myCanvas'), data, opts);
    E.pdf.exportPDF({ filename:'myc-report.pdf', data:results, theme:'red' });

    // 4. UI elements use shared primitives
    E.ui.kpiCard('Custom KPI', value, 'sub label', '#dc2626');
})();
```

---

## E. Versioning + change discipline

**Data layer (`RZEngine.data.*`):**
- `version` field is bumped on any constant change.
- CHANGELOG.md records the bump and lists which constants changed.
- Format: `MAJOR.MINOR.PATCH`. PATCH for benchmark refreshes; MINOR for new categories; MAJOR for restructuring.

**API surface (`RZEngine.models.*`, `RZEngine.auth.*`, etc.):**
- Methods may be added freely (additive changes are not breaking).
- Renames or removals require a deprecation cycle: console.warn for one MINOR version, then remove.
- Callers should never depend on internal details of methods (e.g., the exact rounding) without explicit guarantees.

---

## F. Migration roadmap

The Super Engine ships in **6 phases** that interleave plumbing and math work:

| Phase | Duration | Scope | Maps to |
|---|---|---|---|
| **S0** | ~3 days | Skeleton + `RZEngine.data` populated | (new) |
| **S1** | ~1 wk | `RZEngine.auth.*` | CALC_ENGINE_PLAN Phase 1 |
| **S2** | ~2 wk | `RZEngine.models.{workforce, roi}` | CALC_MODELS_PLAN Phase M1+M2 |
| **S3** | ~2 wk | `RZEngine.pdf.*` | CALC_ENGINE_PLAN Phase 2 |
| **S4** | ~2 wk | `RZEngine.models.{capex, opex, tco}` | CALC_MODELS_PLAN Phase M3 |
| **S5** | ~1 wk | `RZEngine.charts.*` + `RZEngine.ui.*` | CALC_ENGINE_PLAN Phase 3 |
| **S6** | ~1 wk | `RZEngine.models.{pue, forecast}` + final consolidation | CALC_MODELS_PLAN Phase M4 |

Total: ~10–11 weeks across phased rollout. Each phase ships its own DRAFT PR with measurable LOC delta. The remote agent already scheduled for 2026-05-05 picks up S1 (auth) per the existing CALC_ENGINE_PLAN.

**Pilot strategy:** every phase pilots on 3 calculators before broad rollout. Pilots: article-26 (PFAS), article-27 (workforce), and one of the 6 standalone calculators (rotated by phase: roi → capex → opex → tco → pue).

---

## G. DCMOC relationship

DCMOC (`/dcmoc/src/lib/*.ts`) is the TypeScript-side reference architecture. The Super Engine mirrors DCMOC's module separation but lives in vanilla JS for the static-HTML site.

**Sync rule:** Constants in `RZEngine.data.*` should be manually kept in sync with `dcmoc/src/lib/*-data.ts` values. A future `scripts/sync-dcmoc-constants.js` could automate this — out of scope until S6.

The two codebases stay independent at runtime (no shared bundle). DCMOC ships as a Next.js app with its own React components and TypeScript engines. Super Engine ships as a single `rz-engine.js` script tag included on every static HTML page after `auth.js`.

---

## H. Failure modes to avoid

1. **Don't make every calculator depend on RZEngine for ALL math.** Custom calculators stay custom. The engine provides constants + plumbing + commonly-needed math. Authors choose how much to consume — but anchor parameters (Section C) are non-optional.
2. **Don't break the boot order.** Required script load order: `auth.js` → `rz-engine.js` → article IIFE. Document this in PRO_MODE_STANDARDIZATION when S0 ships.
3. **Don't ship constant changes without a CHANGELOG entry and a `version` bump.** The data layer's audit trail is what makes "seamless update" credible.
4. **Don't add server-side state.** Super Engine is browser-only; no fetch calls, no PII leakage, no remote dependencies.
5. **Don't let `rz-engine.js` exceed ~50 KB minified.** It loads on every calc page. If it grows past that, split out a `rz-engine-charts.js` lazy-loaded only when Pro mode is unlocked.
6. **Don't proliferate copies of `RZEngine.data` for "draft" values.** If a benchmark is being researched but not yet authoritative, keep it in a separate `RZEngine.dataDraft` namespace that calculators DO NOT read by default.

---

## I. Cross-doc relationships (post-design)

After this document ships:

| Document | New role |
|---|---|
| `SUPER_ENGINE.md` (this file) | Master architectural vision; the "why" and "what" |
| `CALC_ENGINE_PLAN.md` | Plumbing **implementation plan** under Super Engine umbrella |
| `CALC_MODELS_PLAN.md` | Math **implementation plan** under Super Engine umbrella |
| `AUTH_STANDARD.md` | Per-page auth pattern (will reference `RZEngine.auth.*` post-S1) |
| `CALCULATOR_PROMPT_STANDARD.md` | Template for new calculators (will reference `RZEngine.*` post-S0) |
| `PRO_MODE_STANDARDIZATION.md` | Pro panel/modal pattern (will reference `RZEngine.modal.*` post-S1) |
| `PDF_EXPORT_STANDARD.md` | PDF style + theme (will reference `RZEngine.pdf.*` post-S3) |
| `TOOLTIP_STANDARD.md` | Tooltip + glossary workflow (will reference `RZEngine.ui.tooltip` + `RZEngine.ui.glossaryAnchor` post-S5) |
| `CHANGELOG.md` | Tracks every Super Engine release + every `RZEngine.data.version` bump |
| `MEMORY.md` | Index entry pointing to this document |

---

## J. Open questions (for review before S0)

1. **Naming**: `RZEngine` vs `CalcEngine` vs `RZ`. The doc currently uses `RZEngine`. Approve or pick alternative.
2. **Inflation default scope**: should `inflationAnnual` be flat per-region or have a year-by-year curve through 2030?
3. **Currency conversion**: client-side static rates risk staleness. Acceptable for an educational site? Or fetch live? (Default: static, with `lastUpdated` timestamp.)
4. **Versioning visibility**: should `RZEngine.data.version` be displayed in calculator PDF footers? (Recommendation: yes, alongside generation date.)
5. **Backward compat with current calculators**: during phased rollout, calculators that haven't been migrated need a shim. Default plan: `window.CalcEngine` and `window.CalcModels` exist as aliases pointing to subsets of `RZEngine.*` until S6 sunsets them.

These should be resolved by review comments before S0 starts.

---

## Z. v2.0.0 — Database + Model upgrade (2026-07-04)

`RZEngine.data.version` → **2.0.0** (`meta.schemaVersion` 2.0.0). Shipped as staged,
individually-verified changes, all backward-compatible (existing `models.*` signatures
unchanged; every addition is a new key or an OPTIONAL param). Verified by
`node tools/test-rz-engine.mjs` (79 assertions: model worked examples + data invariants +
reachability + provenance + sim capabilities).

### v2.1.0 (2026-07-05) — `sim.monteCarlo` correlated + categorical draws
`models.sim.monteCarlo(fn, distributions, iterations, seed, opts)` gained (backward-compatibly):
- a **`categorical`** distribution — `{ dist:'categorical', choices:[{value, weight}] }` draws a discrete
  value by weight (for macro-scenario selection);
- an optional **`opts.correlations: [{ a, b, rho }]`** — imposes pairwise correlation between two NORMAL
  keys (`z_b ← rho·z_a + √(1−rho²)·z_b`).
When `opts` is omitted the RNG path is byte-identical to v2.0 (capex/opex/roi panels unaffected). This let
**`tco-calculator`'s Monte-Carlo** (correlated construction/power r=0.65 + 4 macro scenarios) consolidate
onto the shared seeded simulator — reproducible percentiles, model preserved (engine vs. old inline
fallback match to 0.1% on P50). Engine bumped 2.0.0→2.1.0; min re-built with terser; cache-bust `2026-07-05-v21`.

### Rules now enforced

1. **No buried constants.** Every economically-material literal lives in `DATA`, never inside a
   function body. The A4 pass moved `coolingClimate`, `contractCostBase`, `staffingLoadFactor`,
   `opexDefaults`, `capexDefaults`, `refresh`, `workforceParams` out of `models.*`. A calculator
   that needs to override one sets the DATA-backed option; it never re-hardcodes the number.
2. **Every value is sourced.** `DATA.sources` is a sidecar keyed by DATA path → `{ source, asOf,
   unit?, method? }`, and `DATA.provenance[]` lists the citations. The harness fails if a
   registered `sources` entry is missing `source`+`asOf`. `DATA.meta` carries `schemaVersion`,
   `engineVersion`, `asOf`, `lastReviewed`, `license`.
3. **Single version source.** `DATA.version` is the one content-version; `pdf.scriptTagsHTML()`
   cache-bust and the page `?v=` query are bumped together (`2026-07-04-v2`). No more 3-way drift.
4. **Reproducible min build.** `rz-engine.min.js` is regenerated with
   `terser rz-engine.js -c -m -o rz-engine.min.js` — never hand-edited. A parity check confirms the
   min output matches the source engine's values.

### New capabilities (all additive)

- **Reachability fixes** — `capex.datacenterBuildCost(mw,tier,region,cooling)` +
  `pue.defaultFor(cooling,tier)` read the tier×cooling matrices (`capexPerMw` liquid/immersion
  tiers, `pueMatrix`), so liquid/immersion are no longer dead data.
- **Expansion tables** — `regionsCountry` (ID/SG/JP/IN/MY), `land`, `laborRates`, `carbon`,
  `water`, `aiDensity`, `coolingTypes`, `tiers`, `roles`+`salaryRolesExt`, `discountDefaults`,
  `refresh`, `pueMatrix`.
- **Model math** — corrected capex civil≥0 + no contingency double-count; AI/GPU density + land/
  commissioning/permitting line items; opex water/carbon/insurance/connectivity (opt-in) + PPA/TOU/
  demand + cooling-efficiency consumption; roi `npvAuto`/`discountedPayback` + Newton-with-bracket
  IRR honoring `guess`; forecast R²/confidence band + inflation wiring + scenario bands; tco
  `lifecycleNPV` (discounting + salvage + inflation-linked opex); workforce `hiringPlan` (growing
  base + ceiling + ramp), `attritionCostWeighted`, `cumulativeHiresCompounded`.
- **Uncertainty + new models** — `models.sim.monteCarlo/tornado/sensitivityGrid` (seeded, reproducible);
  `models.carbon.*` and `models.water.*`; `charts.*` implemented as framework-free SVG-string builders.

### Coupling rule (RZEngine ↔ dcmoc) — audited 2026-07-04

`dcmoc/` (Next.js) keeps its OWN engines, at a **finer granularity** than RZEngine:
- `dcmoc/src/lib/capex-data.ts` — **per-city $/W** (T&T 2025, C&W 2025, CBRE MENA 2025). e.g.
  Silicon Valley 13.30, Virginia 13.40, Jakarta 11.21, Singapore 14.53, Mumbai 6.64.
- `dcmoc/src/modules/analytics/CarbonEngine.ts` — 0.49 kgCO₂/kWh global avg (IEA 2024-2025) +
  grid-mix inputs + refrigerant GWP + Scope 1/2/3.

RZEngine is **coarse regional planning defaults** (`capexPerMw` $/MW by macro-region × tier ×
cooling; `carbon.gridFactor` by region). The 2026 audit found the two **consistent in magnitude and
NOT divergent** — RZEngine US air-Tier-III ≈ $11/W sits inside dcmoc's US city band ($9.3–14.3/W);
RZEngine's regional carbon factors (US 0.37 … APAC 0.55) bracket dcmoc's 0.49 global average.

**Rule**: do NOT overwrite dcmoc's city-level sourced numbers with RZEngine's coarser regional
estimates — that would *degrade* dcmoc. When RZEngine's regional capex/carbon is refreshed,
sanity-check that dcmoc's cities in that region stay within the new regional range; reconcile only if
they fall outside it. The two are intentionally different resolutions of the same reality. Future
work (optional): a shared upstream `data/engine/*.json` that RZEngine consumes coarsely and dcmoc
refines per-city — one provenance root without flattening dcmoc's granularity.
