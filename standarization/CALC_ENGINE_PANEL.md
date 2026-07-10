# Additive Engine-Powered Calculator Panel — Pattern & Gotchas

> **What this is**: the repeatable recipe for adding an RZEngine-powered analytical panel
> (Monte-Carlo uncertainty, sensitivity tornado, partial-load curve, carbon/water, etc.) to an
> existing standalone calculator **without touching its own math/data**. Established across
> v1.51.2–v1.51.6 on capex / opex / roi / pue calculators.
>
> **Golden rule**: the calculators own their (often finer-grained, better-sourced) data and math.
> The engine ADDS capabilities they lack — it does NOT replace their models. Never rewire a hardened
> calculator to consume `RZEngine.data` defaults if that would coarsen it (see SUPER_ENGINE.md §Z).

---

## When to add a panel (and when NOT to)

1. **Check for an existing equivalent first.** roi and tco already ship their own Monte-Carlo + tornado
   (Pro-gated); capex/opex did not. Adding a duplicate panel is noise. `grep -niE "monte ?carlo|tornado|p10|p95|percentile"` the target page before building.
2. **Match the capability to the calculator.** Monte-Carlo uncertainty fits cost/return calcs
   (capex/opex/roi/tco). A deterministic calc (pue) doesn't want uncertainty — it wants the
   **partial-load curve** (`pue.partialLoadPUE`) + **WUE** (`pue.wue`) instead.
3. **Consume engine capabilities that are otherwise unused.** `pue.partialLoadPUE`/`pue.wue` and the
   `charts.*` SVG builders were built in v2.0 and had no consumer until the pue panel.

## The recipe

1. **DOM** — insert a hidden panel (`style="display:none"`) into the results area. Build it from the
   page's theme variables (`var(--bg-secondary)`, `var(--bg-primary)`, `var(--text-primary/muted)`)
   so it is **dark-mode-safe by construction** (the page already has `[data-theme="dark"]` overrides
   for those vars → no new dark CSS needed, `audit-dark-coverage.mjs` stays clean).
2. **Render fn** — `renderXxx(...)` that: bails to `display:none` if `!window.RZEngine` or inputs are
   invalid; computes via `RZEngine.models.*` + `RZEngine.charts.*` (SVG strings via `innerHTML`);
   sets `display:block` at the end. Feed charts ONLY numeric data + hardcoded labels (no user text).
3. **Hook into the calc** — call `renderXxx(...)` at the end of the calculator's compute fn, wrapped
   in `try { … } catch (e) {}` so the additive panel can NEVER break the calculator's main flow.
4. **Cache inputs + defer hook** (see gotcha #1).
5. **Verify** headlessly in BOTH themes (panel visible, sane values, chart SVG present, **0 console
   errors**), then run the ship gates (`audit-dark-coverage` renders it as the definitive visual check).

## GOTCHA #1 — `rz-engine.min.js` is `defer`-loaded

The engine loads with `defer`, so it is NOT ready when a calculator's compute runs **inline during
parse** (e.g. capex `calculateCosts()` at the bottom of the script) — the panel silently stays hidden.
Fix with a `window.load` hook that re-renders **only the panel** from cached inputs:

```js
var lastInputs = null;
// inside compute fn, after values are known:
lastInputs = { a: x, b: y };
try { renderXxx(x, y); } catch (e) {}
// once, near init:
window.addEventListener('load', function () {
  if (window.RZEngine && lastInputs) { try { renderXxx(lastInputs.a, lastInputs.b); } catch (e) {} }
});
```

Do **NOT** re-run the whole compute fn in the `window.load` hook (redundant full recompute — a real
review finding on pue v1.51.8). Re-render the panel only.
Note: if the compute fn runs inside a `DOMContentLoaded` handler (deferred scripts finish *before*
DOMContentLoaded), the engine is already ready and the hook is just a late-load safety net.

## GOTCHA #2 — don't land the panel inside a Pro-locked container

A panel with `display:block` is still invisible if an **ancestor** is a `.pro-section locked` overlay
container. On pue-calculator the improvement-table / what-if / ASHRAE blocks live inside
`<div class="pro-section locked" id="proResultsSection">` (and are rendered by a Pro-only
`renderProOutputs()`), so anchoring there hid the free panel behind the lock. Anchor free panels in
the **free** results area (e.g. after `#recommendations`), and call the render fn from the FREE compute
path (`calculate()`), not the Pro-only render fn. Verify placement:
`panel.closest('.pro-section') === null`.

## GOTCHA #3 — consolidating an existing inline Monte-Carlo onto the engine

roi/tco had their own `Math.random()` simulations (percentiles jittered every recalc). To route onto
`RZEngine.models.sim.monteCarlo` (seeded → reproducible):
- Factor the per-iteration body into a pure `fn(sample)` (compute only the needed output).
- Map the model's random vars to engine distributions (`uniform`/`normal`/`triangular`/`categorical`);
  correlated normals via `opts.correlations:[{a,b,rho}]` (single disjoint pairs only — chained pairs
  are transitively correlated, see SUPER_ENGINE.md §Z v2.1).
- Keep the inline `Math.random()` loop as a **fallback** when the engine is absent.
- **Correctness check**: run the panel engine-active vs engine-nulled (`window.RZEngine=undefined`) and
  confirm the P50 matches the fallback within a few % (tco matched to 0.1%). This proves the refactor
  is faithful before shipping.
- Only consolidate if the engine can express the model. tco needed correlation + discrete scenarios
  first; a model the generic driver can't express should NOT be forced (would regress it).

## Verifying a Pro-gated panel headlessly

Pro render fns are usually IIFE-scoped (not global). Inject a session and drive the real UI:

```js
await page.evaluateOnNewDocument(() => localStorage.setItem('rz_premium_session',
  JSON.stringify({ email: 'demo@resistancezero.com', tier: 'pro',
                   expires: new Date(Date.now() + 30*864e5).toISOString() })));
// then dispatch input events to trigger recalc; window.RZEngine IS global → nullable to force fallback.
```

## Ship checklist (per panel)

- Additive only — `git diff <page>` shows **no removed compute lines**.
- 0 console errors both themes (filter known-external ipapi/favicon noise).
- `audit-dark-coverage.mjs` CLEAN, `audit-js-syntax` + `audit-script-tags` CLEAN.
- If `rz-engine.js` changed: `terser rz-engine.js -c -m -o rz-engine.min.js`, then cache-bust
  `rz-engine.min.js?v=` across the ~52 consumer pages + `pdf.scriptTagsHTML()`. **Comment-only engine
  edits leave the min byte-identical → no cache-bust** (verify with a `diff` against a temp terser run).
- Version bump + CHANGELOG + `build-changelog-html.py` + `sync-sw-version.py` + indexnow.
