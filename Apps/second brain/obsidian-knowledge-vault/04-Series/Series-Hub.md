# Series Hub

Two named article series with distinct branding.

---

## Geopolitics Series

**Hub**: `geopolitics.html`
**Theme**: Red `#dc2626`, label "Global Analysis"

| Article | Title | File |
|---|---|---|
| [[geo-1]] | 72-Hour Warning | geopolitics-1.html |
| [[geo-2]] | $50T Shift | geopolitics-2.html |
| [[geo-3]] | Hormuz Fiber Shock | geopolitics-3.html |

---

## Future Forward Series

**Hub**: `future-forward.html`
**Theme**: Violet `#7c3aed` / `#a855f7`
**CSS prefix**: `-ff`
**Insights dropdown**: violet color

| Article | Title | File | Accent |
|---|---|---|---|
| [[art-24]] | FF-1: The Web Didn't Die. It Split | article-24.html | violet #6d28d9 |
| [[art-25]] | FF-2: The Engineer Shortage Is Fake | article-25.html | amber #b45309 |
| FF-3 | The Training Era Is Over | article-??.html | cyan #0891b2 |
| FF-4 (queued) | Grid Abandonment | TBD | TBD |

**CSS prefixes per FF article**: varies (see CODING-STANDARDS.md)
**Section IDs**: `sec0`–`sec7` (NOT `section-N`)

---

## Article 26 — Standalone Global Analysis

**File**: `article-26.html` (1524 lines)
**Series**: Global Analysis, red `#ef4444`
**Angle**: PFAS contamination from maintenance vapor release
**Hero**: `assets/article-26-hero.webp` ⚠️ MISSING
**Connections**: [[06-Comparisons/FM200-vs-Novec]], [[07-Reports/DC-Sustainability]]

---

## 3-Agent Build Pattern (for new articles)

```
Part A: HEAD + Hero + TOC + sec0-3
Part B: sec4-7 + calc HTML + footer
Part C: calc IIFE JS
```
