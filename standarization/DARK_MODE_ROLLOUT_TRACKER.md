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

## Defect register (from parallel audit — fills on completion)

> Populated by the `rz-darkmode-defect-audit` workflow (9 families, read-only).
> Status: **AUDIT RUNNING** — table below updates when it returns.

| File | Element | Defect | Severity | Fix | Status |
|---|---|---|---|---|---|
| _pending audit_ | | | | | |

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
