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
| white cookie banner/buttons | datahallAI · dc-conventional · datahall · water-system · fire-system · dc-market-tracker | `rgba(255,255,255,.92)` bg / `#374151` text, no dark override (presentation-only) | high/med | ⏳ |
| tia-942 white buttons | tia-942-checklist | `.tia-btn-reset` / `.tier-btn.active` / `.dctype-btn.active` / `.nav-user-dropdown` white bg | high | ⏳ |
| disclaimer `#64748b` (site-wide, 52 pages) | pillars + articles + more | low-contrast inline disclaimer + nav `#64748b` | high/med | **✅ fixed v1.43.36** (1 shared rule) |
| articles `.philosophy-section` | articles.html | light gradient section bg, no dark override | med | ⏳ |
| **FALSE POSITIVES (verified OK, skip)** | compare-* table accent headers (amber/cyan/emerald + white text); insights `.insights-hero h1` white-gradient (dark hero) | read fine on dark | — | ✅ no action |

Full raw audit JSON: workflow `rz-darkmode-defect-audit` run `wf_a66cc0ed-021`.

---

## Per-family rollout status

| Family | Pages | Audit | Fixed | Notes |
|---|---|---|---|---|
| index | 1 | ✓ | ✓ shipped | polish pattern reference |
| articles | 28 | — | — | editorial skin done by parallel session (v1.43.12–17) |
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

- `plan-live-data-edge.html` (PLAN 03) — static-vs-edge deck, slides 1–5 rewritten, slides 6–8 + option-JS still hold ECC content. Uncommitted, unregistered. Finish + register in `planb.html` or revert.
