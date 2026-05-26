# Inspector standard — v1.43.0+

Companion to [`LINE_MODEL.md`](LINE_MODEL.md) + [`BREAKER_SYMBOLS.md`](BREAKER_SYMBOLS.md). Responds to team review docs:

- `Documents/screenshot bms rz/dc ai/review/27-deep-rereview-2026-05-24-uiux-engineering.md` §3.2
- `Documents/screenshot bms rz/conv/review/17-deep-rereview-2026-05-24-uiux-engineering.md` §3.2

> "Equipment popup masih MODAL CENTER, menutup topology. Jadikan click
> equipment membuka right-side inspector, bukan modal tengah. Inspector
> harus sticky dan tidak menutup line topology. Inspector perlu tab ringkas:
> Live / Capacity / Dependencies / Alarms / Trend / Maintenance."

`js/rz-inspector.js` exposes `window.RZInspector` — a self-attaching right-side panel that opens when an operator clicks any tagged line or breaker.

## What it does

- Listens for click on `[data-rz-line="1"]` and `[data-rz-breaker="1"]` (delegated, so dynamically-rendered elements work automatically).
- Slides in from the right (360px desktop, full-width on ≤640px viewport).
- Renders 6 tabs from the element's `data-*` metadata.
- ESC key + outside-click close.
- Dependency cards (Deps tab) are clickable — navigates to the linked equipment ID if it exists.
- **Visual identical for everything else** — pure overlay, never modifies the SVG.

## Tabs

| Tab | Content |
|---|---|
| **Live** | `data-state`, `data-current`, `data-direction`, `data-medium` (lines) / `data-voltage` + `data-interlock` (breakers). Pulsing dot when state = energized. |
| **Capacity** | `data-capacity`, `data-rating-a`, `data-rating-ka`, `data-ct`, `data-current` loading, `data-redundancy`. |
| **Deps** | `data-from` / `data-to` (lines) or `data-upstream` / `data-downstream` (breakers). Clickable cards navigate to the connected element if its `data-id` exists. Plus `data-tag` (failure-domain) + `data-redundancy`. |
| **Alarms** | State-derived alarm summary + state. For breakers: ANSI device functions + arc-flash PPE. |
| **Trend** | Placeholder. Sparkline arrives with the data-quality service ship (v1.43.x). |
| **Maint** | `data-sensor`, ANSI device functions, AF PPE category, CT ratio, interlock, last update. |

## Public API

```js
window.RZInspector.open(element);   /* manually open inspector for an element */
window.RZInspector.close();         /* close */
window.RZInspector.isOpen();        /* boolean */
```

## Authoring guidelines

1. **Just add the script tag.** `<script src="js/rz-inspector.js?v=1.43.0" defer></script>` after `js/rz-line-model.js` + `js/rz-breaker-symbols.js`. The inspector auto-initialises on `DOMContentLoaded`.
2. **No HTML changes required.** Every tagged line/breaker becomes clickable for inspection.
3. **Don't put inspector-aware elements inside `<a>` or `<button>`.** The delegated handler skips those to preserve native semantics.
4. **The inspector is page-scoped.** If a page renders inside an iframe, mount the script in the iframe document, not the host page.
5. **Dependency navigation works only if `data-id` matches another tagged element on the same page.** Cross-page navigation is a future enhancement.

## Adoption status

| Ship | Page | Status |
|---|---|---|
| v1.43.0 | `datahallAI.html` | Loaded. Verified via probe — clicks open inspector. |
| v1.43.1 (planned) | `chiller-plant.html`, `water-system.html`, `fire-system.html` | Pending — additive load only. |
| v1.43.2 (planned) | `datahall.html`, `ict.html`, `EPMS_Telemetry.html` | EPMS deferred per owner mandate; datahall + ict on standard track. |

## Visual

- Width: 360px desktop, full viewport on ≤640px.
- Background: rgba(15,23,42,0.97) + 8px backdrop blur (preserves topology readability behind it).
- Tabs: cyan accent on active. State pills colour-coded: green (energized), red (fault/tripped), amber (standby/open), purple (maintenance/isolated).
- No external CSS — styles injected into `<head>` on first init, scoped to `.rz-inspector*`.

## Out of scope this standard

- Trend sparklines (v1.43.x data-quality service ship).
- Edit / command-out actions (require operator-auth gate).
- Multi-select compare (review doc-27 §4.2 — separate ship).
- Mobile gesture customisation (defaults to tap-to-open, ESC equivalent = back gesture pending).
