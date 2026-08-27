# Telemetry/Cockpit Docs Standard — PRD + Manual + doc-button contract

> Permanent contract for the cockpit documentation program (EPMS Telemetry, DC-AI, DC-Conventional,
> Data Hall, CDU mini-BMS, RZ cockpit). This file is the **single source of truth** every builder and
> evaluator agent reads BEFORE writing a line (harness spec §2.1/§2.4 — define "done" before build).
> A doc ships only when it satisfies the depth floor here AND an INDEPENDENT evaluator confirms it
> (INV-03) with puppeteer evidence (INV-04). Never weaken these criteria to make a page pass (INV-02).

---

## 0 · What we produce, per cockpit
Two SEPARATE public pages + two contract buttons on the cockpit:
- **PRD** → `prd/<slug>.html` — the product-requirements document.
- **Manual** → `manual/<slug>.html` — the engineering methodology/formulas manual (existing editorial pattern).
- **Buttons** on the cockpit's own toolbar: `PRD` + `Manual`. Their initial introduction is additive;
  later owner-approved cockpit work may evolve the page while both unique routes remain intact.

Slugs: `epms-telemetry` · `datahallai` · `dc-conventional` · `datahall` · `cdu-mini-bms` · `rz-cockpit-mockup`.

Docs are **PUBLIC** (methodology/product docs; SEO-valuable) even when the cockpit is tier-gated — matches
today's `manual/` being public for gated cockpits. Do NOT put an access-gate on a doc page.

---

## 1 · Depth floor — PRD structure (super-detail, all sections mandatory)
Numbered `.mn-section` blocks, in order. "Sourced" = traceable to the cockpit code, the engine
(`rz-engine.js`), a `manual/` page, or a named standard — NEVER an invented number.

1. **Purpose & problem** — what the cockpit is, who it serves, the operational problem it solves.
2. **Users & personas** — each persona (DC operator, commissioning engineer, design reviewer, educator/student…) with their goals + what they read on the page.
3. **Scope & non-goals** — explicit in/out; what the cockpit is NOT (e.g. not a live SCADA; a modelled/locked-basis teaching cockpit).
4. **Functional requirements** — EVERY telemetry element, KPI tile, node, breaker, control, tab, and legend on the page as a numbered requirement `FR-nn` (id · description · acceptance). Miss nothing visible on the cockpit.
5. **Data model & telemetry points** — a TABLE of every signal: name · symbol/id · unit · nominal range · color/alarm-state semantics · source binding (which model object / engine call / constant). One row per telemetry point.
6. **Formulas & derivations** — every derived value with its formula, linked to the Manual section + engine function; no economically/physically material number without a source.
7. **UX / interaction spec** — zoom/fit, pan, export (PDF/CSV), alarm behavior, color-state legend, responsive/mobile behavior, keyboard/a11y.
8. **Acceptance criteria** — deterministic `AC-nn` (given/when/then) that a test or puppeteer check can verify.
9. **Non-functional** — performance budget, accessibility (WCAG 2.2 AA), responsive breakpoints, browser support.
10. **Provenance & sources** — every external standard (ASHRAE, ISO/IEC 30134, IEEE, NFPA, Uptime, IEC 60909…) with what it governs; internal sources (engine, manual, ACCURACY_VALIDATION).
11. **Open questions / risks** — honest gaps, modelling assumptions, disputed values — stated, never papered over.

## 2 · Depth floor — Manual structure
Follow the existing `manual/` editorial pattern (`manual/datahallai.html` is the reference): navbar +
numbered `.mn-section` with `.mn-num`, `.mn-lead`, `.mn-mono`. Mandatory sections: Purpose & engineering
basis · Inputs (locked basis) · **Calculation methodology** (every formula, symbol-defined) · Worked
examples (from the cockpit's locked model, real numbers) · Standards mapping · Glossary/RZExplain hooks.
Enhancing an EXISTING manual: **NON-DESTRUCTIVE** — never delete a sourced fact, formula, or worked
example; only add depth, fix errors against sources, and tighten. Prove via `git diff` (no sourced-line deletions).

## 3 · Site-shell requirements (so all ship-gates pass)
Every PRD/Manual page MUST:
- Load the site shell: `<nav class="navbar">` + `js/rz-mobile-nav.js` (hamburger), `js/rz-version.js` (version stamp), `js/rz-cookie-consent.js`, and RZExplain (`js/rz-explain.js` + `data-explain`/`data-explain-scan`) for term tooltips.
- Define a dark palette: `[data-theme="dark"]{ --bg/--surface/--text… }` AND light as `:root:not([data-theme="dark"])` (NEVER `:root,[data-theme="light"]` — cascade bug). Pass `audit-dark-coverage`.
- Be responsive (`@media (max-width:768px)` checkpoints; `html,body{overflow-x:hidden}`; images `max-width:100%`). Pass `audit-mobile-responsive` + `audit-responsive-layout`.
- Carry SEO: `<title>`, meta description (120–160), canonical, OG card path, and Article/TechArticle + BreadcrumbList JSON-LD.
- Escape `</script>` as `<\/script>` inside any JS string. Pass `audit-script-tags` + `audit-js-syntax`.
- Editorial/instrument register — NO AI-slop (no full-round pills, neon/glow, uniform undifferentiated bars, decorative emoji); thin hairlines, mono tabular numerics, square-ish radii. Match the site brand (`documentation/design.md`).
- Paths from `prd/` and `manual/` are one level deep → assets/js use `../` prefix.

## 4 · Cockpit button pattern (non-destructive contract — INV-09)
Inject exactly two links into the cockpit's OWN toolbar, styled with that page's existing button class:
```html
<a class="<page-btn-class>" href="prd/<slug>.html">PRD</a>
<a class="<page-btn-class>" href="manual/<slug>.html">Manual</a>
```
Per-page hook + class: EPMS_Telemetry `.topbar` → `.btn`; datahallAI Back/Portfolio row → its nav-btn class;
dc-conventional `.header-left`; datahall `.nav-btn`; cdu-mini-bms `.nav-container`; rz-cockpit-mockup (inspect).
RULES: the documentation-link migration itself adds only the two anchors. Do not alter unrelated controls,
event handlers, or scripts while wiring those routes. Later product changes use their own frozen work-item
contract; the durable telemetry-doc gate then requires exactly one PRD link and one Manual link per cockpit,
semantic preservation of sourced formulas/results/references (with explicit replacement contracts for
corrections), and a representative browser control flow. Do not use the original migration revision as a
permanent whole-page freeze.

## 5 · Acceptance checklist (evaluator — INDEPENDENT, adversarial, two-dimensional)
A page ships only if the evaluator (NOT the builder) confirms ALL:
**A · Content correctness**
- [ ] PRD has all 11 sections; §04 covers EVERY visible cockpit element (cross-check against the page); §05 telemetry table has one row per signal with unit + source.
- [ ] Every material number is sourced (engine/manual/standard); no fabrication; gaps disclosed (§11).
- [ ] Manual meets §2 floor; an enhanced manual deleted no sourced fact (git-diff check).
**B · Render/behavior correctness (puppeteer — inspect the rendered page, not just HTML)**
- [ ] PRD + Manual load with 0 console errors; dark-mode has no white body/block; no horizontal overflow at 360px.
- [ ] Cockpit `PRD`/`Manual` buttons are visible, correctly placed, and navigate to the right page.
- [ ] The cockpit STILL renders and a representative control (zoom/fit/tab/export) still works after button injection — flow not broken.
- [ ] Doc pages are NOT access-gated; gated cockpits keep their existing gate intact.

## 6 · Process (harness discipline)
Planner → contract/outline per page (this standard, filled). Builder(s) → PRD + Manual + button diff.
Independent evaluator → §5 checklist + puppeteer evidence (screenshots). Controller → wire `manual/index.html`
+ `prd/index.html`, cross-linkage (sitemap/llms/search-index), full ship-gate suite, version + CHANGELOG,
commit + push + IndexNow. Batched ≤3 cockpits/run; review evidence between batches (clean-resume, INV-06).

## 7 · Required change and lesson ledger

Every telemetry-document change must record the symptom, root cause, decision, regression test, verification
evidence and reusable lesson in this standard plus `CHANGELOG.md`. Rejected review findings and known cockpit
defects remain visible until a separately scoped contract resolves them; documentation must never turn an
unverified limitation into a completion claim.

### 2026-08-23 · Six-cockpit documentation program

| Finding / symptom | Root cause | Decision and machine-checkable prevention | Reusable lesson |
|---|---|---|---|
| Existing manuals contained 184–229 character meta descriptions. | Earlier manual depth work had no 120–160 character SEO gate. | Correct metadata without rewriting sourced engineering content; `tools/test-telemetry-docs.mjs` enforces the range on all 12 pages. | Non-destructive does not mean immutable metadata; preserve evidence-bearing facts, formulas, results and references, while fixing objectively invalid shell metadata. |
| A blanket “no deleted manual lines” rule would reject legitimate metadata corrections and structured additions. | The original requirement did not distinguish evidence from presentation markup. | Snapshot and compare sourced `.mn-eq`, `.mn-result`, `.mn-src` and reference-list fragments instead of forbidding every changed line. | Source preservation must target semantic evidence, not byte-for-byte page stagnation. |
| The telemetry-doc gate rejected an approved EPMS fix and richer PRD TOCs because it permanently required zero cockpit deletions, exactly two additions, and counted the TOC as a numbered PRD section. | A migration-time additive invariant was treated as a lifetime source freeze; section counting matched a CSS substring instead of document semantics. | Require one unique PRD/Manual route, exclude `.mn-toc` from the 11-section count, and retain exact semantic evidence checks plus explicit correction mappings. | Freeze the work-item boundary, not future product evolution; structural tests must select semantic roles rather than incidental class substrings. |
| The offline-root security cleanup also deleted the unrelated network-first public-contract bridge, stranding PRD/Manual links behind restricted cockpit overlays. | A security patch removed a broad contiguous block instead of proving which symbols belonged to the credential feature. | Restore only `PUBLIC_CONTRACTS`/`exposePublicContractLinks`, keep offline recovery as a no-op, and gate both the source symbol and logged-out cached-navigation flow. | Security deletion scopes require a dependency-aware diff; adjacent code is not automatically part of the vulnerable feature. |
| Telemetry browser tests hardcoded release `1.129.1` and failed every legitimate site version bump. | The test duplicated the version source of truth. | Parse `window.RZ_VERSION` from `js/rz-version.js` and assert every rendered document matches it. | Version parity should be compared to the canonical artifact, never another literal. |
| The sitemap, `llms.txt`, and full-content LLM inventory ignored some public documentation routes. | Their directory collectors predated public product requirements; `build-llms-full.py` scanned root HTML only. | Add `prd/` to the sitemap and compact LLM builders, add `manual/` + `prd/` to the full-content builder, and assert all 12 paired routes across search, sitemap, `llms.txt`, and `llms-full.txt`. | A page linked from a hub is still undiscoverable when generated indexes omit its directory. |
| A PRD initially linked a Manual fragment that did not exist. | Cross-page prose and anchor IDs were authored independently. | Link to a verified page URL unless a fragment is proven; browser/link gates must resolve every final target. | Never infer a fragment from a section name—validate the literal destination. |
| The RZ cockpit mockup is a small visual prototype; its Before and After columns intentionally repeat the same four fixtures, and it has no standard shell/reduced-motion behavior. | It was built to compare surface character, not as a production cockpit. | Document the prototype boundary and verified gaps; keep this task's cockpit diff to exactly the two authorized links. Resolve implementation defects only under a separate frozen contract. | Honest documentation is preferable to silently broadening scope or presenting a prototype as operational telemetry. |
| Additive documentation buttons could accidentally disturb complex cockpit code. | Six legacy pages use different toolbar hooks and button classes. | For every cockpit, compare against the immutable pre-feature revision `2348d9ab6ebf121332c48d7b02f1c6398c232039`: zero removed lines and exactly two added anchors with the page's existing class; then exercise one representative cockpit control in browser E2E. | A tiny navigation change still needs both source-diff proof and user-flow proof; mutable branch baselines become vacuous after merge. |
| Gated AI/conventional cockpits need searchable engineering documentation. | Cockpit authorization and documentation visibility are separate concerns. | Keep PRDs/Manuals public and free of gate code while preserving the existing cockpit gate. | Public methodology improves auditability without weakening operational feature authorization. |
| The Manual hub advertised 33 manuals while 42 public manual pages existed after this batch. | The count was hand-maintained and had drifted from the filesystem. | Reconcile the visible count to public manual files and include hub-count validation in the documentation audit. | Visible inventory numbers are data and require the same drift checks as links. |

### 2026-08-24 · Anti–AI-slop and responsive hardening

| Finding / symptom | Root cause | Decision and machine-checkable prevention | Reusable lesson |
|---|---|---|---|
| Shared telemetry/manual surfaces still inherited glass blur, translucent white washes, large radii, and decorative gradients after the adjacent Claude session removed AI-design slop elsewhere. | The documentation batch initially optimized structure and discovery without mirroring the latest shared visual-system decisions. | Use opaque instrument surfaces, thin borders, small radii, IBM Plex Sans + JetBrains Mono, and semantic signal colors through shared `rz-documentation-ui.css`; run the anti-vibecode audit and browser contract on all 14 documentation surfaces. | Cross-session visual work is one design system: synchronize shared tokens and anti-pattern removals before declaring a feature visually complete. |
| Wide telemetry tables were difficult to discover or read on phones. | Documentation tables relied on implicit horizontal scrolling without an orientation cue. | Add a doc-scoped scroll affordance and sticky first column; exercise all 14 documentation routes at mobile and desktop widths. | Responsive correctness includes orientation cues, not only absence of body overflow. |
| New PRD/Manual pages and both documentation hubs used 3 px colored left stripes. | The first documentation template copied a common editorial callout trope that conflicts with RZ thin-line discipline, while the initial regression check covered only the 12 paired pages. | Reduce every documentation accent edge to a 1 px hairline and reject borders thicker than 1 px across all 14 documentation surfaces, including both hubs. | A flat surface can still look like AI slop when accent geometry is oversized; a gate is incomplete when shared entry hubs are outside its inventory. |
| E2E mobile reload occasionally retained scroll/timing state and sampled before layout settled. | The direct reload path skipped the same settle-and-scroll reset used by route navigation. | Route both navigation and post-viewport reload through the same bounded settle routine before assertions. | A browser gate must normalize its own state before treating layout variance as product failure. |

### 2026-08-26 · Adversarial accessibility and gated-route review

| Finding / symptom | Root cause | Decision and machine-checkable prevention | Reusable lesson |
|---|---|---|---|
| Eight documentation surfaces had serious light-theme contrast failures; breadcrumbs and inline links relied on color alone. | Page-local cyan/amber tokens were visually consistent but too light on white, and the shared layer did not provide a non-color link cue. | Override light documentation tokens with AA-safe cyan, amber and green values; use white text on filled CTA controls; underline breadcrumb and prose links; run vendored axe on all 14 surfaces in both themes. | Shared visual tokens need measured contrast in every theme; brand consistency is not accessibility evidence. |
| Horizontally scrolling formulas could not be reached from the keyboard. | Only wide tables received a labelled focus region. | The shared documentation controller now detects overflow on `.mn-formula`, adds a labelled `role="region"` and `tabindex="0"` only while scrolling is required, and updates this state through `ResizeObserver`. | Every overflow mechanism needs an equivalent keyboard path, not only the largest tables. |
| The first formula regression check filtered to overflowing nodes before calling `every()`, so it passed with no exercised nodes and ignored non-overflowing formulas left in the tab order. | The assertion encoded only the positive branch of the intended state machine. | Assert every formula in both directions, then require suite-level evidence for at least one overflowing and one non-overflowing formula. | A conditional UI contract needs positive, negative, and non-vacuity evidence. |
| Cookie-banner policy links on nested `/prd/` and `/manual/` routes resolved to a 404. | The shared default used the relative path `privacy.html`. | Resolve the default from site root (`/privacy.html`) and assert the rendered pathname on every documentation route. | Shared navigation defaults must be depth-independent; test final browser resolution, not the source string alone. |
| Non-live telemetry banners intercepted new mobile documentation links. | A fixed status surface accepted pointer events across its full rectangle. | Make the banner pointer-transparent, restore pointer events only on its close button, and dock it at the bottom on narrow screens; the E2E checks link hit-testing at 375 px. | Informational overlays must not own an interaction plane they do not use. |
| Public PRD/Manual links on restricted AI and Conventional cockpits were hidden behind auth overlays; an initial whole-header elevation also exposed restricted sibling controls. | The links lived inside a gated header whose shared instrument layer forced `z-index:1`; the earlier E2E removed gates before clicking and therefore masked the logged-out flow, while elevating that header crossed the authorization boundary. | Move only the exact public-contract anchors into a dedicated public layer, leave an inert layout slot in the header, and keep the original header inert while locked. Click both public links while logged out, then assert mouse and keyboard cannot activate restricted header controls. | Authorization is an interaction boundary, not a visual one: expose individual public routes without promoting their restricted container. |
| Shared fixes could be masked by cache-first Service Worker entries carrying older query keys; changing only the new worker still left the first old-controller navigation broken. | Local E2E served files directly and did not model a mixed release, while the cockpit frozen-diff rule prevented editing its existing asset tags. | Give mutable documentation shells release cache keys, keep changed shared assets network-first in the new worker, and run the restricted-link bootstrap from `auth.js`, which is already network-first in the previous worker. The browser gate replaces navigation with a cached pre-release stub and still requires both public links plus an inert protected header. | Deployment correctness includes the transition controlled by the previous worker, not only a clean-browser render or the newly activated cache policy. |
| Added CDU links compressed the hamburger below 44 px, while the prototype's new links inherited a 16 px text-line target. | Legacy toolbars were designed before the two additive controls. | Apply route-scoped shared mobile sizing for CDU controls and inline target sizing on the two authorized prototype anchors; assert 44 px targets and unobstructed hit-testing. | Additive markup can still change flex allocation; mobile target geometry belongs in the acceptance contract. |
| The preserved cockpit prototype remains 50 px wider than a 375 px viewport. | Its four-column fixture comparison predates this documentation contract, and the frozen cockpit invariant permits only two inserted anchor lines. | Record the 50 px baseline explicitly and fail on any increase; do not claim the prototype itself responsive until a separately frozen cockpit-remediation contract authorizes source changes. | A known baseline exception must be bounded and visible; never hide it by weakening the global documentation standard or silently expanding scope. |
| Browser reload checks occasionally inherited delayed scroll restoration after viewport changes. | Chromium could restore scroll after the first explicit reset. | Set `history.scrollRestoration='manual'`, reset before and after two animation frames, and support scoped `docs`/`cockpits` reruns for deterministic diagnosis. | Reliability fixes belong in the gate itself when the product state is already correct and the sampler is unstable. |
| Telemetry-specific contracts were runnable only as ad-hoc commands. | The canonical ship task predated these public cockpit documents. | Run structure, generated-discovery, and full browser/a11y/gate-safety checks from `tools/ship-gate.sh`, with `task verify` as the stable entry point. | A regression test is durable only when the normal release path cannot skip it. |
| The shared Manual FAB was keyboard-focusable and inside the viewport on a locked page but still could not be clicked; an earlier `nav` wrapper inherited the page's lock filter, and the first elevation also placed the FAB above the login modal. Its rendered height was only 31–33 px. | The first regression checked focus and geometry but not the topmost hit target, modal precedence, or the 44 px target floor; changing the wrapper fixed one broad selector while the FAB's original z-index remained below the full-screen gate. | Use a neutral `div[role=navigation]`, keep the normal z-index, elevate only `body.locked` above the gate but below auth dialogs, apply a 44 px minimum target, and require `elementFromPoint`, modal precedence, and real logged-out click/navigation on desktop and 375 px. | Focusability and visible bounds do not prove pointer access; overlay-adjacent controls need topmost-element, modal-order, target-size, and end-to-end navigation evidence. |

### 2026-08-27 · Conventional DC current/study and operator documentation

| Finding / symptom | Root cause | Decision and machine-checkable prevention | Reusable lesson |
|---|---|---|---|
| The proposed four-hall capacity appeared beside a much smaller current simulation without a stable adoption boundary. | Current telemetry and capacity planning were expressed as page literals. | Keep the installed simulation on `CONV_CALC`; generate the 4 × 10 MW study from one immutable reconciler and fail closed when its rack, thermal, resilience or part-load contract is incomplete. | Current state and design intent need separate authorities, labels and tests. |
| Subsystem manuals were individually detailed but did not share the same campus assumptions or navigation depth. | Documentation evolved page by page without a master Conventional product contract. | Use `prd/dc-conventional.html` as the master contract, retain subsystem methodology manuals with accessible TOCs, and mirror the governed operating standard into Obsidian. | A multi-system cockpit needs one campus contract plus discipline-specific evidence, not duplicated prose. |
| Alarm history could look like current active alarm state. | Lifecycle-at-capture and live KPI ownership were not explicit. | Label the deterministic dataset as a historian training snapshot, preserve run/source provenance and assert that filtering never mutates live strips. | Historical state is evidence about an event, not proof of current plant state. |
| Adding subsystem operator contracts created a twelfth top-level PRD section and corrected legacy ASHRAE, ISO WUE and Uptime statements tripped the preservation gate. | Discipline detail was promoted to a new document level, while legitimate source corrections lacked explicit old-to-new evidence mappings. | Nest subsystem contracts under provenance so the canonical 11-section structure remains stable; enumerate each corrected protected fragment and its accepted replacement in the gate. | Expand depth inside the document contract, and make accuracy corrections explicit rather than weakening semantic preservation. |
