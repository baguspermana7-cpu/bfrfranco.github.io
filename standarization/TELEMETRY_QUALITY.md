# Telemetry quality standard — v1.43.4+

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
| `simulated` | SIM | instrument cyan | Engine-derived / modelled, not live sensors |
| `stale` | STALE | amber | Last update older than configured threshold |
| `manual` | MANUAL | cyan | Operator override, not live measurement |
| `comms_lost` | NO COMMS | red | Sensor / gateway unreachable |
| `inhibited` | INHIBITED | grey | Suppressed (maintenance, manual disable) |
| `demo` | DEMO | yellow | Training / educational values, not facility |

## Page-level data mode

Set `<body data-rz-data-mode="...">` to declare what the page is showing. The service:

1. Reads the attribute on `DOMContentLoaded`
2. Injects a dismissible banner with the matching colour + label into the explicit
   `[data-rz-telemetry-banner-slot]` immediately after the page header. A fixed fallback is retained
   only for legacy adopters and is not acceptable for a gated cockpit.
3. Skips the banner when mode = `live` (operators don't need a label when telemetry is genuine)
4. Treats `data-rz-basis-authority="unavailable"` or
   `data-datahall-authority="unavailable"` as dominant over the declared page mode. The banner and
   inherited point quality become `comms_lost` and read `COMMS LOST — AUTHORITY UNAVAILABLE`.

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
| v1.131.0 | `datahall.html` | `simulated` | ✓ in-flow | N/A |
| v1.131.0 | `ict.html` | `simulated` | ✓ in-flow | N/A |

At v1.134.14 all six current adopting cockpits (`datahallAI`, Data Hall, Chiller, Water, Fire and
ICT) provide an in-flow banner slot. A dense cockpit may use the compact variant inside a header
instrument rail, provided the header reserves its geometry, the label remains explicit, and the
44 px dismissal target is preserved. A 390 px browser gate verifies that provenance does not
overlap the tab rail and that the remaining cockpit is reachable through its owned scrollport.
On narrow screens the provenance slot is the first in-flow item after the protected header; no
navigation, tab or action may visually occupy its reserved row.

`EPMS_Telemetry.html` retains its own operator status strip rather than this shared banner; its
complete v2 authority gate independently withholds the single-line and commands on authority loss.

## Authoring guidelines

1. **Always declare a page mode.** Even `live` mode benefits from explicit declaration so future ports know what the baseline is — though the banner will only render for non-live modes.
2. **Tag individual exceptions.** If 99 % of a page is `simulated` but one panel pulls a real live feed, mark that panel with `data-quality-state="live"` — the inspector will surface it correctly.
3. **`comms_lost` is alarm-class.** A point in this state should also push to the alarm pipeline; the chip is the visual cue, not the alarm itself.
4. **`stale` threshold is page-dependent.** Set it appropriately for the medium being shown (chiller water: minutes; electrical: seconds).
5. **Banner is dismissible** — once an operator acks the simulated banner it stays dismissed until reload. Don't auto-redraw it during a session.
6. **Reserve layout space.** Every gated cockpit provides an explicit banner slot immediately after
   its header; moving a fixed banner from the top to the bottom is not a responsive fix.
7. **Dismissal is an accessible control.** It is at least 44 × 44 px, exposes a 2 px signal-amber
   `:focus-visible` outline, and remains keyboard reachable.
8. **Respect motion and theme.** Stop banner pulse/transition for `prefers-reduced-motion: reduce`;
   use semantic light-theme foreground/background pairs rather than reusing luminous dark-theme text.
9. **Compact is geometry, not weaker provenance.** `data-rz-telemetry-compact` may shorten the
   visible wording, but the full non-live meaning stays in its accessible title and the state
   remains instrument cyan. Purple is not part of the industrial cockpit state grammar.
10. **Authority outranks mode.** Never show a simulated engine-derived label when the engine/model
    validator has failed. Page and point quality become `comms_lost` until authority is restored.
11. **Provenance must be substantive.** Required scenario and data-quality fields are trimmed and
    must remain non-empty. Property presence alone is insufficient; blank provenance fails closed,
    and status clocks/timestamps cannot continue advancing while authority is unavailable.

## Out of scope this standard

- Live-data-staleness countdown timer (future v1.43.x).
- Quality-trend sparkline integration (future Trend-tab port).
- Persisted dismissal across reloads (uses sessionStorage — defer to future ship).
- Modal escalation when `comms_lost` count exceeds threshold (alarm-system territory).
