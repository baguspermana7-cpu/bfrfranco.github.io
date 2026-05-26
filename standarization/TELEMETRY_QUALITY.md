# Telemetry quality standard — v1.43.2+

Companion to [`LINE_MODEL.md`](LINE_MODEL.md), [`BREAKER_SYMBOLS.md`](BREAKER_SYMBOLS.md), and [`INSPECTOR.md`](INSPECTOR.md). Responds to team review docs:

- `Documents/screenshot bms rz/dc ai/review/27-deep-rereview-2026-05-24-uiux-engineering.md` §3.4 + §5.7
- `Documents/screenshot bms rz/dc ai/review/28-screen-by-screen-action-list-2026-05-24.md` Global UIUX Corrections

> "Setiap point penting punya data quality: live / stale / simulated /
> manual override / comms lost."
> "Tambahkan 'simulation mode' banner jika angka bukan live."
> "Tambahkan 'data freshness' badge pada top bar."

`js/rz-telemetry-quality.js` exposes `window.RZTelemetryQuality` — a service that surfaces data quality at both the **page level** (banner) and the **point level** (per-element attribute).

## States

| State | Chip label | Colour | Meaning |
|---|---|---|---|
| `live` | LIVE | green | Genuine telemetry, no qualifier needed |
| `simulated` | SIM | violet | Engine-derived / modelled, not live sensors |
| `stale` | STALE | amber | Last update older than configured threshold |
| `manual` | MANUAL | cyan | Operator override, not live measurement |
| `comms_lost` | NO COMMS | red | Sensor / gateway unreachable |
| `inhibited` | INHIBITED | grey | Suppressed (maintenance, manual disable) |
| `demo` | DEMO | yellow | Training / educational values, not facility |

## Page-level data mode

Set `<body data-rz-data-mode="...">` to declare what the page is showing. The service:

1. Reads the attribute on `DOMContentLoaded`
2. Injects a fixed top-of-viewport banner (dismissible) with the matching colour + label
3. Skips the banner when mode = `live` (operators don't need a label when telemetry is genuine)

All four BMS cockpit pages currently declare `data-rz-data-mode="simulated"`. Reviewer mandate (doc-28): "Jika menggunakan sample data, beri label sample/simulated agar tidak terlihat seperti live."

## Point-level quality

Mark a specific element with `data-quality-state="..."`. Common use-cases:

```html
<text data-quality-state="manual">14.8 °C</text>
<g data-quality-state="comms_lost"><!-- sensor disconnected --></g>
```

The inspector's Live tab automatically reads the element's quality state — falls back to the page mode if no explicit `data-quality-state` is set.

## Public API

```js
window.RZTelemetryQuality.setPageMode('simulated');
window.RZTelemetryQuality.markPoint(el, 'stale');
window.RZTelemetryQuality.getPointState(el);   /* string */
window.RZTelemetryQuality.chipHtml(state);     /* small inline chip <span> */
window.RZTelemetryQuality.audit(document);     /* { mode, bannerVisible, points, issues } */
```

## Adoption status

| Ship | Page | Mode | Banner | Inspector chip |
|---|---|---|---|---|
| v1.43.2 | `datahallAI.html` | `simulated` | ✓ | Live tab shows chip |
| v1.43.2 | `chiller-plant.html` | `simulated` | ✓ | Live tab shows chip |
| v1.43.2 | `water-system.html` | `simulated` | ✓ | Live tab shows chip |
| v1.43.2 | `fire-system.html` | `simulated` | ✓ | Live tab shows chip |

EPMS_Telemetry.html is untouched per the owner mandate.

## Authoring guidelines

1. **Always declare a page mode.** Even `live` mode benefits from explicit declaration so future ports know what the baseline is — though the banner will only render for non-live modes.
2. **Tag individual exceptions.** If 99 % of a page is `simulated` but one panel pulls a real live feed, mark that panel with `data-quality-state="live"` — the inspector will surface it correctly.
3. **`comms_lost` is alarm-class.** A point in this state should also push to the alarm pipeline; the chip is the visual cue, not the alarm itself.
4. **`stale` threshold is page-dependent.** Set it appropriately for the medium being shown (chiller water: minutes; electrical: seconds).
5. **Banner is dismissible** — once an operator acks the simulated banner it stays dismissed until reload. Don't auto-redraw it during a session.

## Out of scope this standard

- Live-data-staleness countdown timer (future v1.43.x).
- Quality-trend sparkline integration (future Trend-tab port).
- Persisted dismissal across reloads (uses sessionStorage — defer to future ship).
- Modal escalation when `comms_lost` count exceeds threshold (alarm-system territory).
