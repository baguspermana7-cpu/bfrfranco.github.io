# Dark-Mode Rollout — `/ultraplan`

> Obsidian mirror of [`standarization/DARK_MODE_ROLLOUT_TRACKER.md`](../../../../standarization/DARK_MODE_ROLLOUT_TRACKER.md).
> **Living note — update on every increment.** Part of [[Standards-Hub]].

**Direction (owner-locked):** POLISH + unify tokens — **NOT** reskin. Keep each page's character
(fonts, accent hues); fix concrete dark-mode defects + bring all pages under one structural token
language (`css/rz-dark.css` polish-track: radius · elevation · `.rz-surface`). The Fraunces
*editorial register* was rejected for content pages. **No card movement on hover.**

Last updated: **2026-06-21** · Scope: **98 public pages**

---

## Shipped (live)

- **v1.43.14 / .18** — `index.html` bento polish, dark + light (layered surfaces · per-card accent glow · staggered reveal)
- **v1.43.22** — removed dead hover-lift · retoned rejected-purple disclaimer · `.bento-sap` dark tint
- **v1.43.24** — killed card-hover flicker (stale `script.min.js` cache-bust) · toned logo pop
- **v1.43.26** — AWS dark logo white fix · added polish-track tokens to `css/rz-dark.css`
- **v1.43.33** — /ultraplan batch 1: `.references-section` light-on-dark fixed on 4 report pages (`!important` shared rule)
- **v1.43.35** — /ultraplan batch 2: geopolitics-2/3 + FF-1/2 status badges (`.confidence-low` + `.prob-*`) dark overrides
- **v1.43.36** — /ultraplan batch 3: site-wide `#64748b` disclaimer/nav contrast lift across 52 pages (1 shared rule)
- **v1.43.38** — /ultraplan batch 4: articles `.philosophy-section` + tia-942 + dc-market-tracker chrome dark overrides
- **v1.43.39** — /ultraplan batch 5: cockpit cookie banners dark (`css/rz-bms-shell.css`, probe-gated 75/75 PASS) — **rollout COMPLETE**

## `/ultraplan` audit (9-agent parallel, read-only)

- **58 pages checked · 56 defects · 0 critical · 38 high · 18 medium · 32 pages clean.**
- **Key finding:** no page is *missing* dark mode (all inherit from `styles.min.css`); work = fix
  concrete defects + unify tokens, not rescue broken pages.
- **Dominant real-defect patterns:**
  - Light `.references-section` (`#f8fafc`) blocks on 4 infographic/report pages → light-on-dark.
  - Light status badges (`.confidence-low` / `.prob-medium` / `.prob-high`) on geopolitics-2/3 + FF-1/2.
  - White cookie banners / buttons (cockpits, dc-market-tracker, tia-942) → light-on-dark.
  - `#64748b` disclaimer text on 5 pillar pages → low contrast.
  - (Some flagged compare-table accent headers + dark-hero white gradients = conservative/likely-OK; verify before editing.)

## Status by family

| Family | Defects | Status |
|---|---|---|
| index | — | ✅ shipped |
| articles (28) | clean | parallel session editorial skin |
| infographics/reports (4) | 4 high | ✅ fixed v1.43.33 |
| geopolitics + FF (4) | 12 high | ✅ fixed v1.43.35 |
| pillar (5) + 52-page disclaimer | 5 high + 1 nav | ✅ fixed v1.43.36 |
| checklists/misc (tia-942, dc-market) | 5 high | ⏳ batch |
| cockpits (cookie banners) | ~10 | ✅ fixed v1.43.39 (probe 75/75) |
| compare-* (4) | 8 (verify) | ⏳ verify-first |

Related: [[Standards-Hub]] · [[06-Comparisons/Comparisons-Hub]] · [[07-Reports/Reports-Hub]]
