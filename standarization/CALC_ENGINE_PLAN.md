# Calculator Engine Consolidation Plan — ResistanceZero

> **Version**: 1.0 | **Created**: 2026-04-28
> **Status**: Roadmap (no code shipped yet)
> **Parent vision**: [`SUPER_ENGINE.md`](./SUPER_ENGINE.md) — master architectural design unifying this document and `CALC_MODELS_PLAN.md` under a single `window.RZEngine.*` API.
> **Sibling plan**: [`CALC_MODELS_PLAN.md`](./CALC_MODELS_PLAN.md) — covers the **calculation math layer** (workforce, capex, opex, ROI, TCO, PUE). This document covers **plumbing** (auth, modal, PDF, charts).
> **Related standards**: `AUTH_STANDARD.md`, `CALCULATOR_PROMPT_STANDARD.md`, `PRO_MODE_STANDARDIZATION.md`, `PDF_EXPORT_STANDARD.md`

---

## Why This Document Exists

Audit on 2026-04-28 found ~5,800 lines of duplicated JavaScript and HTML across
18+ calculator pages (6 standalone calculators at the site root + 12+ embedded
article calculators). Every calculator re-implements:

- Credential validation (`VALID_USERS` arrays)
- Session check against `localStorage.rz_premium_session`
- Login modal HTML/CSS
- `rz-auth-change` event dispatch & listen
- PDF export via `window.open()` (with table generators, currency formatters, color theming)
- Chart.js setup (histograms, tornado charts, ROI lines, sensitivity panels)

`auth.js` (569 LOC) already handles the **navbar** auth UI (login button,
session check on page load for navbar state, cross-page event broadcast) but
does NOT export utilities calculators can call. So calculators end up duplicating
session and credential logic that is structurally identical.

The DCMOC Next.js app (`/dcmoc/src/`) is the architectural model — it separates
calculation engines (`lib/CapexEngine.ts`), state (`store/auth.ts`), and UI
(React components). The standalone HTML side of the site needs a parallel
shared layer.

---

## Duplication Inventory (audit baseline)

| Pattern | Approx. LOC per file | Files | Total LOC |
|---|---|---|---|
| Auth + session check | ~45 | 18 | ~810 |
| Login modal HTML + CSS | ~150 | 18 | ~2,700 |
| PDF export `window.open()` | ~200 | 7 | ~1,400 |
| Chart.js setup | ~50/chart × 12 charts avg | 18 | ~600 |
| `rz-auth-change` dispatch/listen | ~15 | 18 | ~270 |
| **Total duplicated** | — | — | **~5,800 LOC** |

Per-file impact varies. Article-27 alone has ~700 LOC of duplicated patterns.
Standalone CAPEX calculator has ~600 LOC. cx-calculator has ~750 LOC.

---

## Target Architecture: `calc-engine.js`

A single shared library exposing one global namespace:

```js
window.CalcEngine = {
    auth:   { validateLogin, getSession, setSession, logout },
    modal:  { create(options), show, hide },
    pdf:    { generateTable, exportPDF(opts) },
    charts: { histogram, tornado, sensitivity, roiLine },
    events: { dispatch(action, detail), onAuthChange(fn) },
    format: { currency, percent, number, weeks }
};
```

Calculators call `window.CalcEngine.auth.getSession()` instead of inlining 45
lines of localStorage parsing. New calculators ship in roughly half the lines
they do today.

This is **not a framework** — calculators stay vanilla JS. `calc-engine.js` is
just shared utilities.

---

## Four-Phase Rollout

Each phase lands as its own PR with measurable LOC savings.

### Phase 1 — Auth Engine (1 day, low risk)

**Scope**: extract auth + login modal + session helpers into `calc-auth.js`.

**Deliverables**:
- `/calc-auth.js` (~150 LOC) exposing `window.CalcAuth.{validateLogin, getSession, setSession, logout, createLoginModal, dispatchAuthChange}`.
- Pilot rollout in 3 pages: `article-26.html`, `article-27.html`, `roi-calculator.html`. These remove their inline `VALID_USERS`, session check, and modal HTML.
- Update `AUTH_STANDARD.md` Section "Implementation Pattern" to recommend `CalcAuth.*` over inline code.

**Expected savings**: ~135 LOC across 3 pilot files. Validates the approach
without big-bang refactor.

**Verification**:
- `localhost:8081` — login still works in all 3 pilot pages.
- Cross-page: log in on roi-calculator, navigate to article-27, Pro panels stay unlocked (`rz-auth-change` event).

### Phase 2 — PDF Engine (~2 weeks, multiple sessions)

**Scope**: `calc-pdf.js` with table generator, currency formatter, scenario
comparison renderer, and per-calculator color templates.

**Deliverables**:
- `/calc-pdf.js` (~250 LOC) with `CalcPDF.{exportPDF(opts), generateTable, formatCurrency, applyTheme}`.
- Migrate capex, opex, roi, tco standalone calculators.
- Migrate embedded calculators in articles 26 and 27.
- Update `PDF_EXPORT_STANDARD.md` to reference `CalcPDF`.

**Expected savings**: ~900 LOC across 6 calculators.

**Risk**: PDF output has subtle visual differences across calculators
(branding, color palette). Templates must support per-calculator theming via
a small options object.

### Phase 3 — Chart Engine (~1 week)

**Scope**: `calc-charts.js` factories for histogram, tornado, sensitivity, and
ROI line charts.

**Deliverables**:
- `/calc-charts.js` (~200 LOC) with `CalcCharts.{histogram(canvas, data, opts), tornado, sensitivity, roiLine}`.
- Migrate article-26 (3 charts), article-27 (3 charts), and Pro panels in
  capex/opex/roi/tco.

**Expected savings**: ~400 LOC.

### Phase 4 — Consolidation (~2 weeks)

**Scope**: merge `calc-auth.js` + `calc-pdf.js` + `calc-charts.js` into a
single `calc-engine.js` with the unified `window.CalcEngine` API. Migrate all
remaining calc pages.

**Deliverables**:
- `/calc-engine.js` (~600–800 LOC).
- All 18 calc pages migrated; inline duplication removed.
- New standard: `CALC_ENGINE_STANDARD.md` (this doc evolves into the standard).

**Expected savings**: full ~5,800 LOC duplicated → ~700 LOC shared library +
~50 LOC per calc page wiring it up = ~3,800 LOC freed.

---

## Migration Checklist (per calculator)

When migrating a calc page to `calc-engine.js`:

- [ ] Replace inline `VALID_USERS` and login validation with
      `window.CalcEngine.auth.validateLogin(email, pass)`.
- [ ] Replace `localStorage.getItem('rz_premium_session')` parsing with
      `window.CalcEngine.auth.getSession()`.
- [ ] Replace inline login modal HTML with
      `window.CalcEngine.modal.create({ title, color, onSubmit })`.
- [ ] Replace `window.open()` PDF block with
      `window.CalcEngine.pdf.exportPDF({ filename, data, theme })`.
- [ ] Replace inline Chart.js setup with appropriate
      `window.CalcEngine.charts.*` factory.
- [ ] Add `<script src="calc-engine.js" defer></script>` (or `calc-auth.js`
      etc. during phased rollout).
- [ ] Verify localhost:8081 — page renders, login works, charts render, PDF
      exports successfully.

---

## Out of Scope

- DCMOC (`/dcmoc/`) is a separate Next.js app with its own engine modules. It
  does not use `calc-engine.js`. The static HTML site uses `calc-engine.js`
  to mirror DCMOC's separation pattern within JS constraints, but the two
  codebases stay independent.
- Server-side validation. `calc-engine.js` is browser-only. Auth is still
  client-side validation against a hardcoded `VALID_USERS` (per AUTH_STANDARD).

---

## Cross-References

| Standard | What changes when this plan ships |
|---|---|
| `AUTH_STANDARD.md` | Section "Implementation Pattern" updated to recommend `CalcAuth.*` |
| `CALCULATOR_PROMPT_STANDARD.md` | New calculators must use `calc-engine.js`; checklist updated |
| `PRO_MODE_STANDARDIZATION.md` | Login modal section references `CalcEngine.modal.create()` |
| `PDF_EXPORT_STANDARD.md` | PDF templates referenced as `CalcEngine.pdf.exportPDF()` |
| `CHANGELOG.md` | Each phase ships with a CHANGELOG entry |
