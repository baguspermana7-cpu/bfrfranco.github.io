# UI/UX audit ledger — resistancezero.com

**A living ledger, not a report.** Every finding carries a status. A finding is CLOSED only with the
version that closed it AND the gate that keeps it closed; a finding with no gate stays OPEN and says
why. Re-measure before trusting a row.

- Audit opened **2026-10-03** (site v3.11.11) · last updated **2026-10-03** (site v3.11.12)
- Population: the **74 pages that declare `data-rz-register="editorial"`**, measured from the
  filesystem, not the 29 `article-*.html` files. The instrument register is 18 further pages and is
  out of scope for this round.
- Trigger: owner report — the article theme "masih AI design slop dan aneh", a figure "terpotong
  dari framenya", and "sering sekali full analysisnya tidak bekerja" — with three screenshots.

---

## Read this first — why the previous audit could not have found any of this

`standarization/Audit result/UIUX_Audit_Report.html` (2026-02-17) states its own method twice:
*"manual code inspection and heuristic evaluation of the production codebase."* **It never opened a
browser.** Its citations reach `index.html` (17), `styles.css` (13), `auth.js` (8); the article
corpus is collapsed into a single "consistent template" claim written when there were 17 articles.
There are now 29, inside 74 editorial pages.

The gate suite has the same shape. Of roughly 60 written numeric visual rules across
`documentation/design.md`, `ANTI_VIBECODE_STANDARD.md`, `RESPONSIVE_STANDARD.md`,
`DARK_MODE_STANDARD.md` and `DIAGRAM_ENGINE_STANDARD.md`, about 28 are gated — and every gated one
is either **a banned token** ("is this hex present?") or **a rendered failure** ("does text vanish,
does the page scroll sideways"). Until v3.11.12 nothing measured **conformance to a scale**: line
weight (1.4/1.0/0.6/0.5px), radius per register, the 4pt spacing step, the type scale, animation
duration, caption tracking — all specified with numbers, none checked.

**Two numbers that look like findings and are not.** Recorded here rather than deleted, because
each needed a question before it meant anything:

| claim | truth | what was wrong with the measurement |
|---|---|---|
| `audit-vibecode` reports 0 findings, so the decorative rules are unwired | **wired, and exercised** | instrumenting the funnel: 252,319 CSS blocks scanned, 56,633 pass the decorative vocabulary, **1,869 reach the radius test**, 0 exceed their ceiling. The radius backlog really was swept. `ANTI_VIBECODE_STANDARD.md` still prints the pre-sweep baseline (1058 blocks / 169 files), which is what made the zero look like a dead rule. |
| 86 CSS blocks carry `border-radius >= 8px`, so the radius rule leaks | **mostly correct exemptions** | of the 86, the overwhelming majority are functional UI (`btn`, `nav`, `dropdown`, `modal`, `table`) which the standard exempts by design, or capsules, or images. Exactly **one** was a real escape — see row 5. |

---

## CLOSED

| # | finding | measured | closed in | kept closed by |
|---|---|---|---|---|
| 1 | The figure-width check had **never fired once**. `ARTICLE_TRACK_PX` was 1100 while the reading column is `--rz-measure: 46rem` = 736px, so the build reported PASS on all 12 built figures. It also measured the wrong mechanism — the type size a wide figure "would" shrink to — but `.rz-figure` scrolls the figure at 1:1 and never scales it. | 11 of 12 figures exceed the column, worst 1.45× (31% off-screen on arrival); 0 past the 2× fail line | v3.11.12 | `tools/build-article-diagrams.mjs --check` — reports every overflowing figure with its ratio and hidden fraction; proven in both directions (lowering the fail ratio to 1.4 produces exactly the 3 expected failures) |
| 2 | The scroll track that makes a wide figure readable was **invisible**: no scrollbar, no edge fade, no affordance of any kind. A reader saw a diagram stop mid-stroke. | 76px of 820 hidden at desktop, 370px at phone width | v3.11.12 | measured in-browser: `scrollbar-width:thin` + `overscroll-behavior-x:contain` applying on `.rz-figure`, token-driven so it is theme-aware |
| 3 | `#pfasProBtn` carried `fa-lock` hardcoded in markup, so a signed-in root saw unlocked panels behind a closed padlock. Signed out it had **no `aria-label` at all**. | both auth states measured: anon `fa-lock` + "sign in required", root `fa-lock-open` + "unlocked", gate hidden | v3.11.12 | `tools/audit-runtime-handlers.mjs` (both auth states) + the two-state probe in the release notes |
| 4 | `.pfas-chem-block` was two registers in one class. `white-space: pre-wrap` preserves alignment spaces **and** wraps, so the dot leaders never held and `overflow-x:auto` never engaged. | all 7 blocks wrapped: 8–16 extra lines at 741px, 15–22 at 390px; block 6 rendered 14 source lines as 30 | v3.11.12 | measured in-browser: 3 blocks are now tables (stacking below 560px), 4 are `.pfas-chem-calc` with `white-space:pre` whose 5 scrollers all reach their end on a phone viewport with 0 page-level horizontal scroll |
| 5 | `FUNC_SEL` was tested against the **whole selector string**, so any decorative block nested under a nav, tab, drawer or form vanished from all three decorative rules at once. | 31 decorative blocks exempted only by an ancestor compound; 1 carried an over-ceiling radius (`.ltc-tab-panel > div > .feature-block`, 10px) | v3.11.12 | `tools/audit-vibecode.mjs` now matches `FUNC_SEL` against the final compound — the element that actually gets painted |
| 6 | Three `cx-calculator.html` drawer callouts used the **explicitly rejected** pattern: translucent wash + 3px saturated accent border, in raw Tailwind hexes (`#10b981` / `#ef4444` / `#3b82f6`). | 3 blocks | v3.11.12 | `tools/audit-vibecode.mjs` `colored-left-stripe`, which reaches them now that row 5 is fixed. Replaced with the canonical editorial language (flat `color-mix` tint + 1px hairline + 2px semantic rail) |
| 7 | A rule with **no selector at all** in `cx-calculator.html` — `{ --accent-purple:…; }` straight after a comment — so the browser discarded it and none of those 7 tokens was ever defined. | 0 consumers (`var(--accent-` appears 0 times), so dead either way | v3.11.12 | removed; `tools/audit-js-syntax.py` does not read CSS, so this one is held by the removal, not a gate — see OPEN row C |
| 8 | A raw `&mdash;` inside a chart config's JSON `source:` string printed as literal text, because that field is rendered as text and not HTML. | 1 occurrence | v3.11.12 | measured in-browser: `document.body.innerText.includes('&mdash;')` is false in both auth states |
| 11 | `ANTI_VIBECODE_STANDARD.md` documented a "monitor + strict on `STRICT_SCOPE`" split for rules 10/11/12 and named a 3-file strict scope. **`STRICT_SCOPE` does not exist in the tool** — 0 occurrences — and every finding is hardcoded `monitor: false`, so all three rules gate everywhere. The section also still printed the **pre-sweep** baseline (rule 12 at 1058 blocks / 169 files) against a tool that now reports zero. | funnel instrumented: 252,319 blocks scanned, 56,633 pass the decorative vocabulary, 1,869 reach the radius test, 0 over ceiling | v3.11.12 | the section is marked OBSOLETE in place with the measured funnel and the date the baseline was true. A baseline in a standard needs the date it was true, or a working gate reads as an unwired one — which is the mistake this audit made first. |
| 9 | All five PFAS gate panels read "requires **Full access access**" — a find/replace that ran over "Pro access" and left the noun twice. | 5 panels | v3.11.12 | measured in-browser: `innerHTML.includes('Full access access')` is false |

## PARTIAL

| # | finding | measured | state | what is missing |
|---|---|---|---|---|
| 10 | Captions were arguing in an instrument voice. All 13 `.rz-figcaption` entries run **276–367 characters** in IBM Plex Mono at .78rem with .02em tracking — the register this site reserves for a reading, a unit or a timestamp. | 13/13 restructured; caption text verified character-for-character unchanged against HEAD | lead/note/provenance registers shipped in v3.11.12; the split lives in `captionMarkup()` in the build tool, not in the pages, because the tool owns everything between `<figure>` and `</figure>` and would have overwritten a hand-applied structure | no gate asserts a caption's argument is in prose type. A future author can write a 400-character single-sentence caption and nothing complains. Belongs in `tools/audit-editorial-render.mjs` (OPEN row A) |

## OPEN

| # | finding | measured | why it is still open |
|---|---|---|---|
| A | **Nothing measures conformance to a scale.** Line weight, radius per register, the 4pt spacing step, the type scale, animation duration and caption tracking are all specified as numbers and none is checked against its specified SET — only against one-sided floors. | ~60 written numeric rules, ~28 gated, 0 scale-conformance checks | `tools/audit-editorial-render.mjs` is not written yet. It must run at 390/768/1440 in both themes over all 74 editorial pages, measure element-vs-parent overflow (which no tool does today — `grep 'rz-figure' tools/` returned nothing before v3.11.12), and **run solo with transitions suppressed**: `test-mobile-nav.mjs` returned 4, then 3, then 1 finding on three runs of the unchanged gate, and `audit-dark-coverage.mjs` has the identical flake. |
| B | **32 of the 74 editorial-register pages do not load `css/rz-article-dark.css`.** Every rule in that file — the callout language that replaced the rejected 3–4px slab, the caption registers, the figure scroll affordance — reaches 43 pages, not 74. Spot-checked: `compare-tier-3-vs-tier-4.html` and `glossary.html` both contain callout boxes. | 74 declare the register, 43 load the stylesheet, 32 in the gap (one page is `article-9-paper.html`, a deliberate print exemption) | not yet measured in a browser what those 32 actually render. Declaring a register the stylesheet never arrives for is either a missing link or a register that means nothing on those pages, and the two have different fixes. Measure before changing anything. |
| C | `tools/audit-vibecode.mjs` reads CSS text but **nothing validates CSS structurally**. A selectorless rule (row 7) silently discarded 7 token definitions and no gate noticed. | 1 instance found by hand | no CSS parser in the gate suite. A structural check would also catch unbalanced braces and rules dropped by error recovery. |
| E | `flattenWashes()` in `js/rz-article-editorial.js` **repairs** wash violations at read time instead of failing a build, so a regression ships and is silently corrected in the browser. | not re-measured this round | a runtime repair is the right behaviour for a reader and the wrong one for a gate. Needs a build-time counterpart that fails on what the runtime would have had to fix. |
| F | The Kowalski feel-standard is not written down as measurable rules: animation ≤300ms, transitions rather than keyframes for dynamic UI, `prefers-reduced-motion` mandatory, and knowing when not to animate. No vanilla toast or bottom-sheet component exists. | not started | Phase 4 of `~/.claude/plans/cryptic-rolling-sonnet.md` |

## WITHDRAWN

| # | claim | why |
|---|---|---|
| W1 | "At ≤768px `article-26.html` sets `html,body{overflow-x:hidden}`, so the figure's intended scroll **clips** instead — on a phone the legend is unreachable." | Measured false. `.rz-figure` carries its own `overflow-x:auto`, so it scrolls inside the clipped page: `maxScrollReached: 370`. The claim came from reading CSS and reasoning about the cascade instead of scrolling the element. The real defect was adjacent and smaller — the scroll existed but had no affordance (CLOSED row 2). |
| W2 | "The radius gate contradicts the standard, so the project's own compliant value fails its own gate." | True as written, but **latent**: of 86 blocks at radius ≥8px, 2 are editorial-scoped (both exactly 8px, both already exempt by name) and 1 is instrument-scoped (4px, functional). Nothing sat in the gap. Made register-aware in v3.11.12 anyway — editorial ≤10, instrument ≤3, unscoped ≤8 — with seeded fixtures per register, because a rule nobody can test is how "0 findings" starts meaning nothing. |

---

## Decisions recorded (resolved 2026-10-03, v3.11.12)

**The reading measure is `--rz-measure: 46rem` = 736px.** Three documents stated three different
measures and the figure gate was calibrated to a fourth:

| source | said | status |
|---|---|---|
| `css/rz-article-dark.css:451` | `46rem` (736px), 16px, 1.75 leading | **canonical** |
| `documentation/design.md` typography-at-a-glance | 16px / 1.55 / 70ch | corrected — `70ch` is the pre-v1.49.10 value and is the exact defect that release removed (`ch` is font-size dependent, so the 1.14rem lead and 1rem body paragraphs landed on different left edges) |
| `standarization/RESPONSIVE_STANDARD.md:207` | 16px / 1.75 | leading was right |
| `standarization/RESPONSIVE_STANDARD.md:238` | `max-width: 760px`, centered | annotated as the v1.49.8 **generic** cap, overridden for editorial by `.article-body{max-width:none}` |
| `tools/build-article-diagrams.mjs` | 1100px | corrected to 736 |

One deliberate exception: `.rz-figcaption` keeps `max-width: 68ch`. A caption is a different element
with its own type size, and `ch` there is bounded by the prose column anyway.

**Radius ceilings are per register**, matching `design.md` §16.2 and `DARK_MODE_STANDARD.md` rule 5:
editorial ≤10px, instrument ≤3px, and a block that names no register ≤8px — because a rule that
names no register lands in both and has to satisfy the stricter of the two surfaces it will paint.

**A capsule is a shape, not a rounded panel.** `border-radius: 50px` on a 22px-tall inline pill is
how a pill is drawn. The exemption requires the painted element to name itself a capsule
(`pill|badge|chip|tag|dot`) **and** either a radius ≥24px or an inline display with ≤4px of vertical
padding and no declared height. A panel is disqualified first — by a declared block display or a
height past 32px — because the first version of this exemption checked the radius first and a seeded
`.probe-badge-panel{display:block;height:120px;border-radius:28px}` walked straight through the
exemption written to stop exactly that.
