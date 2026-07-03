# Calculator Production-Hardening Rollout

Tracks the site-wide rollout of two production-readiness features across the
engine-backed calculators: **input validation with error states** and **CSV export**.

## Shared utility (use this — don't re-hardcode per page)

`js/rz-calc-utils.js` → `window.RZCalc` (M-303 mandate: cross-cutting concern = one
shared engine). Self-contained, injects its own theme-aware CSS. API:

- `RZCalc.validateNumbers([{id,label,optional}])` → `{ok, errors}`. Reads `min`/`max`
  from the element; marks offenders `.rz-invalid` + `aria-invalid`. Skip auto-derived
  fields (e.g. a rack-count the calc overwrites).
- `RZCalc.showErrors(boxId, errors)` → toggles a `.rz-calc-validation` summary box.
- `RZCalc.downloadCSV(filename, headerLines, rows)` + `RZCalc.csvEscape(v)`.

**Integration pattern (per page):**
1. `<script src="js/rz-calc-utils.js?v=…" defer></script>` after `rz-version.js`.
2. Add `<div class="rz-calc-validation" id="<page>Validation" role="alert" aria-live="polite" hidden></div>` near the results.
3. At the top of the calc function: `var r=RZCalc.validateNumbers([...]); RZCalc.showErrors('<page>Validation', r.errors);` — **gate** the compute (`if(!r.ok) return`) when the engine would otherwise emit `NaN`; leave **non-gating** when the calc is already defensive (`parseFloat()||default`).
4. Add an "Export CSV" button → a small `export<Page>CSV()` reading inputs + result elements into `RZCalc.downloadCSV`.

## Status

| Calculator | Validation | CSV | Notes |
|---|---|---|---|
| cdu-calculator | ✅ v1.50.28 | ✅ | inline (pre-util); gated (engine NaN-sensitive) |
| fire-calculator | ✅ v1.50.29 | ✅ | inline (pre-util); gated; concentration optional |
| **pue-calculator** | ✅ v1.50.30 | ✅ | **shared `RZCalc`**; non-gating (calc uses `||default`); validate `itLoad` only (rackCount is auto-derived) |
| capex-calculator | ✅ v1.50.31 | ✅ | shared `RZCalc`; non-gating; validate itLoad + fuelHours |
| opex-calculator | ✅ v1.50.31 | ✅ | shared `RZCalc`; non-gating; validate itLoad |
| roi-calculator | ✅ v1.50.31 | ✅ | shared `RZCalc`; non-gating (defensive `||default`); 10 inputs validated |
| tco-calculator | ✅ v1.50.31 | ✅ | shared `RZCalc`; non-gating (`getVal(id,default)`); validate 4 core inputs |
| carbon-footprint | ✅ v1.50.31 | ✅ | shared `RZCalc`; non-gating; validate 4 editable inputs (readonly/derived excluded) |
| cx-calculator | ✅ v1.50.31 | ✅ (pre-existing Gantt CSV kept) | shared `RZCalc`; validation on `cxCalculate()` (button-triggered) |

## Verification (per page, headless)
Valid state renders results + N CSV rows; out-of-range/cleared field → summary shown +
field `.rz-invalid`; restore → summary hidden + field cleared; 0 console errors; gates
CLEAN (dark both modes, responsive, version-stamp, js-syntax, script-tags).
