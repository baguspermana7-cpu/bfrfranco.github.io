# Dark-Mode Rollout Tracker — `/ultraplan`

> **Living document — update on EVERY increment.** This is the regularly-updated progress
> record for the site-wide dark-mode polish + token-unification rollout. Companion to
> [`DARK_MODE_STANDARD.md`](./DARK_MODE_STANDARD.md) (the spec) and the
> [Plan B hub](../planb.html) PLAN 02 page (`plan-dark-mode-standard.html`).
>
> **Direction (owner-locked):** **POLISH + unify tokens — NOT reskin.** Keep each page's
> character (fonts, accent hues); raise dark-mode quality + bring all pages under one
> structural token language (`css/rz-dark.css` polish-track: radius scale · elevation · `.rz-surface`).
> The full Fraunces *editorial register* was rejected for content pages (read "like an article").
> **No card movement on hover** (border/glow + logo colour-fade only).

Last updated: **2026-06-21** · Scope: **98 public pages**

---

## Shipped (live, verified)

| Ver | Date | Page(s) | What |
|---|---|---|---|
| v1.43.14 | 06-20 | `index.html` | Bento dark polish — layered surfaces · always-on per-card accent glow · staggered reveal |
| v1.43.18 | 06-20 | `index.html` | Bento light polish (day twin) — same 3 moves, theme-agnostic reveal |
| v1.43.22 | 06-20 | `index.html` | Removed dead hover-lift · retoned rejected-purple disclaimer · fixed no-op `.bento-sap` dark tint |
| v1.43.24 | 06-20 | `index.html` | Killed card-hover flicker (stale `script.min.js` cache-bust) · toned logo pop 1.15→1.04 |
| v1.43.26 | 06-20 | `index.html`, `css/rz-dark.css` | AWS dark logo white fix · added polish-track tokens (`--rz-r-*`, `--rz-elev-*`, `.rz-surface`, `.rz-reveal-on`) |
| v1.43.33 | 06-21 | `styles.css` (4 report pages) | **/ultraplan batch 1** — `.references-section` dark override → `!important` (fixes light-on-dark on infographic-* + asean-dc-report) |
| v1.43.35 | 06-21 | geopolitics-2/3 · FF-1/2 | **/ultraplan batch 2** — added missing `.confidence-low` + `.prob-*` dark badge overrides |
| v1.43.36 | 06-21 | `styles.css` (52 pages) | **/ultraplan batch 3** — site-wide `#64748b` disclaimer/nav contrast lift (1 shared `!important` rule) |
| v1.43.38 | 06-21 | articles · tia-942 · dc-market-tracker | **/ultraplan batch 4** — philosophy-section dark gradient + reset/dropdown/cookie-decline dark overrides |
| v1.43.39 | 06-21 | `css/rz-bms-shell.css` + 5 cockpits | **/ultraplan batch 5** — cockpit cookie banners dark (probe-gated, 75/75 PASS) |
| v1.43.46 | 06-21 | `index.html` (styles) | removed hero-name infinite animations ("blink") + OE hover-expand ("wobble") |
| v1.43.48 | 06-21 | article-27 · FF-2 · FF-3 | **article editorial skin catch-up** — §08 editorial register applied to the 3 missed articles (now 29/29) |
| v1.43.50 | 06-21 | 4 hubs + article-9-paper | **editorial consistency (no exceptions)** — read-progress JS on hubs; screen-only dark editorial on the print paper (print stays white, verified) |
| v1.43.52 | 06-21 | 31 articles | **editorial h2 underline bug fixed across ALL articles** (via `/ultraplan` 6-agent render-verify+fix) — base `border-bottom:3px` underline was sitting on the editorial rail; neutralized in dark. **33/33 render-PASS, independently re-probed.** |
| v1.46.3 | 06-26 | article hubs (articles/insights/future-forward) | **Hub editorial parity.** Added the no-FOUC guard to the 3 hubs (geopolitics already had it); fixed insights.html 6 white resource-card islands (`.reports-grid > a` used `var(--bg-card,#fff)`, undefined in dark → white; dark-toned to `#1e293b`). All 3: FOUC pre-paint, 0 light-on-dark, toggle clean, hero Fraunces both themes. |
| v1.46.2 | 06-26 | all 34 articles + `css/rz-article-dark.css` | **§08 editorial skin in BOTH themes + zero switching bugs.** Added a DAY/light editorial variant (`:not([data-theme="dark"])` mirror — Fraunces/mono/drop-cap/amber rail on warm-light gold palette) so the skin reads consistently in both modes (was dark-only). Added the no-FOUC `<head>` theme guard to all 34. Fixed: article-26 broken toggle (redundant inline `#themeToggle` double-bound w/ script.js → cancelled); dark light-on-dark gaps on art-10/11/13/16/17 + FF-3 (via `/ultraplan`, same-hue dark tints, white needles kept); art-2 chartjs-annotation `defer` TypeError. **Probes: dark 0 light-on-dark/0 err (34/34), toggle 0 broken (34/34), day editorial renders, FOUC pre-paint.** |
| v1.43.55 | 06-21 | index + 7 calculators | **planb §11 + E4** — §11 index identity hero editorial register (dark-only: Fraunces name · mono amber kicker · `.bento-readout` 4-KPI count-up; day untouched, reversible). E4: all 7 calc heroes get Fraunces + amber badge in dark via `css/rz-calc-editorial.css` (chrome only, engines untouched). **Track E COMPLETE.** Probes dark/light + screenshots verified, 0 new errors. |
| v1.43.54 | 06-21 | 34 editorial pages | **§08-mockup amber unification** — flipped every editorial page's `--rz-art-accent`/`--rz-art-accent2` to the mockup's exact `#E8B563`/`#6FBF9A` (was per-series navy/blue/cyan/emerald/red); fully re-toned the **9 red-series pages** (art-11/14/20/23/25/26/27 + geopolitics/-3) red→amber **in body too** (Tailwind red ladder → amber ladder), incl. art-27 `.ws-*` calculator (colour-only, calc still works, 0 errors). Semantic reds in non-red articles (art-8 good/bad green-vs-red) preserved. **Hue-accurate probe 9/9 = 0 residual red.** |

---

## planb PLAN 02 — full rollout status (2026-06-21, "semua di planb diimplementasikan")

Reconciliation of `plan-dark-mode-standard.html` §09 against the live site:

- **Track E (editorial) — 100% COMPLETE.** E0 plans ✓ · E1 article-26 pilot ✓ · E2 all 34
  editorial pages on the §08 amber ✓ (v1.43.54) · E3 hub read-progress ✓ (v1.43.50) ·
  **E4 calculator shells ✓ (v1.43.55)** — 7 calc heroes get Fraunces + amber badge in dark
  via `css/rz-calc-editorial.css`, chrome only.
- **§11 index editorial hero — ✓ SHIPPED v1.43.55** (dark-only, reversible; §10 bento-polish
  lock still in force for the grid). §12 light twin ✓ (v1.43.18).
- **Track I (instrument cockpits) — I0–I3 ALREADY LIVE.** Reality overtook the plan: the BMS
  track built/migrated all **9 cockpits** (datahallAI · dc-conventional · chiller-plant ·
  water-system · fire-system · fuel-system · ict · EPMS_Telemetry · datahall) directly in the
  instrument register — each carries `data-rz-register="instrument"` + loads the shared
  `css/rz-bms-shell.css` instrument component library (= the I1 deliverable) + JetBrains Mono +
  the I0 count-up. **Accuracy probe 75/75 green** (verified this session). No re-skin performed —
  it would risk the gate + collide with the in-flight BMS track.
- **I4 (market monitors) — ✓ SHIPPED v1.43.56.** dc-market-tracker + pln-java-grid (+4 province
  pages) now declare `data-rz-register="instrument"` + load `css/rz-monitor-instrument.css` —
  **chrome only** (`.nav-title` mono; `.pjg-section-title`/`.dmt-section-title` mono + phosphor
  cyan→green tick). The owner-locked SLD line widths / label defaults / voltage-tier colours /
  Leaflet map viz are left pixel-identical (CSS targets heading classes only; verified headless:
  maps render, tier legend unchanged, 0 errors). **Track I COMPLETE.**

**Net: planb PLAN 02 is 100% — every track shipped or already-live.**

---

## ✅ Rollout COMPLETE (batches 1–5, 2026-06-21)

All confirmed real dark-mode defects from the 9-agent audit are fixed and live; verified false
positives left as-is. ~70 pages improved across 5 batches. Cockpit changes were presentation-only
with the accuracy probe re-run green. Remaining dark-mode work is *polish/token-unification*
(optional, low-risk) via the `css/rz-dark.css` polish-track — not defects.

**Internal (no version bump — noindex surfaces):** `plan-dark-mode-standard.html` (§10–§12), `rz-index-polish.html`, `rz-index-mockup-day.html`, `planb.html` (PLAN 02 card + mini before/after), `DARK_MODE_STANDARD.md` (bento-polish pattern + Track E3).

---

## `/ultraplan` audit — key finding

**No page is actually *missing* dark mode.** All 98 pages inherit dark styling from `styles.min.css`
(ground-truthed via headless screenshots: compare-*, pillar-*, insights, cockpits all render dark).
The inline-`[data-theme="dark"]`-rule count is a **misleading** signal (50 pages have ≤3 inline rules
yet still go dark via the shared sheet). So the real work is:

1. **Concrete dark-mode defects** — specific elements that render light-on-dark / dark-on-dark
   (e.g. comparison tables, hardcoded-light infographic SVGs, badges). ← parallel audit in progress.
2. **Token consistency** — radius drift (dc-sol 20/12/10px · articles 14/20/12px · tools 50/999/14px)
   → unify on `css/rz-dark.css` polish-track scale.
3. **Polish quality** — layered surfaces + reveal where it lifts a page, matching the index pattern.

---

## Defect register (from 9-agent parallel audit, 2026-06-21)

**58 pages checked · 56 raw defects · 32 clean.** Verification (headless) reclassified some as
false positives. Real, grouped:

| Group | Pages | Defect | Sev | Status |
|---|---|---|---|---|
| `.references-section` light bg | infographic-dc-cost-breakdown · -sustainability · -pue-global · asean-dc-report-2026 | inline `#f8fafc` overrode dark rule → light text invisible | high | **✅ fixed v1.43.33** (shared rule → `!important`) |
| status badges light-on-dark | geopolitics-2 · -3 · FF-1 · FF-2 | `.confidence-low` / `.prob-medium` / `.prob-high` light bg, no dark override | high | **✅ fixed v1.43.35** |
| cookie banners (cockpits) | datahallAI · dc-conventional (+ accept-btn on datahall/water/fire) | white bg/`#374151` text (presentation-only) | high/med | **✅ fixed v1.43.39** — dark overrides in `css/rz-bms-shell.css`; probe re-run 75/75 PASS |
| white cookie/buttons (non-cockpit) | dc-market-tracker · tia-942-checklist | `.dmt-cookie-decline` / `.tia-btn-reset` / `.nav-user-dropdown` white bg | high | **✅ fixed v1.43.38** (active pills left white — intentional highlight) |
| disclaimer `#64748b` (site-wide, 52 pages) | pillars + articles + more | low-contrast inline disclaimer + nav `#64748b` | high/med | **✅ fixed v1.43.36** (1 shared rule) |
| articles `.philosophy-section` | articles.html | light gradient section bg, no dark override | med | **✅ fixed v1.43.38** |
| **FALSE POSITIVES (verified OK, skip)** | compare-* table accent headers (amber/cyan/emerald + white text); insights `.insights-hero h1` white-gradient (dark hero) | read fine on dark | — | ✅ no action |

Full raw audit JSON: workflow `rz-darkmode-defect-audit` run `wf_a66cc0ed-021`.

---

## Per-family rollout status

| Family | Pages | Audit | Fixed | Notes |
|---|---|---|---|---|
| index | 1 | ✓ | ✓ shipped | polish pattern reference |
| articles | 29 | ✓ | ✓ | editorial skin COMPLETE 29/29 — rollout did 1–26 (v1.43.12–17); **article-27 + FF-2 + FF-3 caught up v1.43.48** (`article-9-paper` = print variant, excluded) |
| compare-* | 10 | running | — | suspect: tables light-on-dark |
| pillar-* | 5 | running | — | |
| pln-grid-* | 6 | running | — | Leaflet legend/tooltip/panel |
| infographics + reports | 7 | running | — | highest defect risk (hardcoded-light SVG) |
| checklists + misc | 8 | running | — | |
| hubs/landing | 5 | running | — | insights / articles / dc-solutions / future-forward / geopolitics |
| cockpits | 11 | running | — | ⚠ accuracy-probe-gated · presentation-only · preserve alarm/SLD colors |
| geopolitics + FF | 6 | running | — | already token-heavy; verify gaps |

---

## Discipline (every fix MUST pass before ship)

1. ☐ 2-stylesheet rule — index-affecting CSS in **both** `styles.css` + `styles-index.css`, re-minify both.
2. ☐ Dark override for every hardcoded-light rule the page uses (no light-on-dark).
3. ☐ No card movement on hover (the global `transform:none!important` rule stays).
4. ☐ Cache-bust **both** CSS and JS `?v=` when shipping (stale cache served old code 3× this session).
5. ☐ Version bump (`js/rz-version.js`) + CHANGELOG entry + `build-changelog-html.py --apply`.
6. ☐ Audits: `audit-script-tags` · `audit-js-syntax` · `audit-version-stamp` · `audit-mobile-responsive`.
7. ☐ **Cockpit pages only:** engine + `#p-dash` byte-identical · 75/75 accuracy probe green · semantic alarm/SLD colors untouched.
8. ☐ Screenshot-verify the page in dark (and light) before claiming fixed.
9. ☐ Update THIS tracker + CHANGELOG.

---

## Parked

- ~~`plan-live-data-edge.html` (PLAN 03) — static-vs-edge deck~~ — **✅ DONE 2026-06-21.**
  Slides 6–8 + the option-JS `META` rewritten off the leftover ECC content to the static-vs-edge
  topic (edge-unlock mockups · skeleton→unlock→harden roadmap · 4 platform decisions with
  **verdict placeholders left open** for the owner). Registered as **PLAN 03 (Live)** in
  `planb.html`. Verified: 8 slides, option/ptab/SVG interactions work, 0 ECC leftovers, 0 errors.
  Internal/noindex — no version bump (planb convention).
