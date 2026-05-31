# Alarm state + color discipline standard — v1.43.4+

Companion to [`LINE_MODEL.md`](LINE_MODEL.md), [`BREAKER_SYMBOLS.md`](BREAKER_SYMBOLS.md), [`INSPECTOR.md`](INSPECTOR.md), [`TELEMETRY_QUALITY.md`](TELEMETRY_QUALITY.md). Responds to team review docs:

- `Documents/screenshot bms rz/dc ai/review/27-deep-rereview-2026-05-24-uiux-engineering.md` §3.3 + §4.3
- `Documents/screenshot bms rz/conv/review/17-deep-rereview-2026-05-24-uiux-engineering.md` §4.3

> "Warna status harus menang atas warna domain. Jika equipment fault, warna
> fault harus terlihat meskipun equipment termasuk domain cooling/network/
> electrical."
> "Alarm harus punya state: active, acknowledged, shelved, inhibited,
> returned-to-normal. Equipment dalam maintenance mode harus punya indicator
> berbeda dari fault."

`js/rz-alarm-state.js` exposes `window.RZAlarmState` — an ISA-18.2 alarm state machine + the colour-discipline arbiter that ensures status colour wins over domain colour.

## Alarm states (ISA-18.2)

| State | Abbr | Alarm active? | Colour | Meaning |
|---|---|---|---|---|
| `normal` | NORM | no | (domain) | No alarm — falls through to domain colour |
| `unack` | UNACK | yes | red | Active, unacknowledged |
| `ack` | ACK | yes | amber | Active, acknowledged by operator |
| `rtn_unack` | RTN | no | cyan | Returned-to-normal, ack pending |
| `shelved` | SHLV | no | violet | Operator-shelved (temporary suppression) |
| `suppressed` | SUPP | no | grey | Suppressed by design (de-energized line) |
| `oos` | OOS | no | purple | Out-of-service (maintenance / LOTO) |

`oos` is visually distinct from `unack`/`ack` — closes the review requirement "equipment dalam maintenance mode harus punya indicator berbeda dari fault."

## Severity tiers (orthogonal to state)

| Severity | Rank | Colour |
|---|---|---|
| `critical` | 4 | red `#ef4444` |
| `high` | 3 | orange `#f97316` |
| `medium` | 2 | amber `#f59e0b` |
| `low` | 1 | yellow `#eab308` |

## Color discipline — `resolveColor(alarmState, domainColor)`

The arbiter that closes review §3.3:

```js
RZAlarmState.resolveColor('unack', 'var(--c)')   // → '#fca5a5' (status WINS)
RZAlarmState.resolveColor('normal', 'var(--c)')  // → 'var(--c)' (domain colour)
```

**Rule: status colour wins over domain colour unless the state is `normal`.** A faulted cooling pipe shows fault-red, not cooling-cyan — exactly the reviewer mandate.

## Equipment-state mapping — `deriveFromEquipment(equipState)`

Maps a `RZLineModel` / `RZBreakerSymbols` `data-state` into an alarm state + severity + summary string. Used by the inspector Alarms tab:

| Equipment state | → Alarm state | Severity |
|---|---|---|
| `fault` / `tripped` | `unack` | critical |
| `isolated` / `maintenance` | `oos` | low |
| `standby` | `normal` | low |
| `de-energized` | `suppressed` | low |
| `simulated` / `energized` | `normal` | low |

## Public API

```js
window.RZAlarmState.resolveColor(alarmState, domainColor);  /* colour string */
window.RZAlarmState.deriveFromEquipment(equipState);        /* {alarm, severity, summary} */
window.RZAlarmState.chipHtml(alarmState, severity);         /* inline chip <span> */
window.RZAlarmState.audit(document);                        /* {points, issues} */
```

## Per-element attributes

Mark an element explicitly when the engine state is not the alarm authority:

```html
<g data-alarm-state="ack" data-alarm-severity="high"><!-- breaker acked --></g>
```

The auditor validates `data-alarm-state` / `data-alarm-severity` against the enums.

## Inspector integration

The inspector Alarms tab (v1.43.0) now renders:
- An alarm-state chip (`UNACK · CRITICAL`, `OOS · LOW`, `NORMAL`, …) via `chipHtml()`
- The derived summary string
- Falls back to the v1.43.0 inline logic if `RZAlarmState` is absent (graceful degradation)

## Adoption status

| Ship | Page | Library loaded | Inspector Alarms tab |
|---|---|---|---|
| v1.43.4 | `datahallAI.html` | ✓ | ISA-18.2 chip + summary |
| v1.43.4 | `chiller-plant.html` | ✓ | ISA-18.2 chip + summary |
| v1.43.4 | `water-system.html` | ✓ | ISA-18.2 chip + summary |
| v1.43.4 | `fire-system.html` | ✓ | ISA-18.2 chip + summary |

EPMS_Telemetry.html untouched per owner mandate.

## Authoring guidelines

1. **Never hard-code a status colour into a domain element.** Route it through `resolveColor()` so fault always wins.
2. **`oos` ≠ fault.** Maintenance equipment uses `oos` (purple), never the red fault state.
3. **Severity is orthogonal to state.** A `shelved` alarm can still be `critical` severity — both are tracked.
4. **`shelved` is temporary, `suppressed` is by-design.** Don't conflate them — shelved needs operator re-enable, suppressed is the normal de-energized state.

## Out of scope this standard

- Live alarm queue / annunciator panel (separate ship — needs alarm-source pipeline).
- Acknowledge / shelve actions (require operator-auth gate).
- Alarm flood suppression (ISA-18.2 §, future).
- First-out / sequence-of-events recording (future).
