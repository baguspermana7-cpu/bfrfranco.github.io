# Line model standard — v1.42.0+

Foundation library for the BMS cockpit semantic line model. Every line / pipe / busbar / cable in a topology diagram must carry structured metadata so operators can trace medium, direction, state, capacity, and redundancy.

This standard responds to the team review docs:

- `Documents/screenshot bms rz/dc ai/review/27-deep-rereview-2026-05-24-uiux-engineering.md` §3.1
- `Documents/screenshot bms rz/dc ai/review/28-screen-by-screen-action-list-2026-05-24.md` (every screenshot's line callouts)
- `Documents/screenshot bms rz/conv/review/17-deep-rereview-2026-05-24-uiux-engineering.md` §3.2 + §5.1
- `Documents/screenshot bms rz/conv/review/18-screen-by-screen-action-list-2026-05-24.md` EPMS line callouts

> "Setiap line wajib punya `from_id`, `to_id`, `medium`, `direction`, `state`,
> `capacity`, `current_value`, dan `redundancy_role`. Gunakan connector
> orthogonal 90 derajat untuk SLD dan piping, bukan freeform line yang mudah
> overlap."

The library `js/rz-line-model.js` (loaded by `datahallAI.html` from v1.42.0; ported to other cockpit pages across v1.42.x → v1.45.x) provides:

- A canonical schema (data-* attributes).
- A builder API that emits SVG with the metadata baked in.
- A DOM auditor that the probe consumes.

## Schema

Every line emitted via `RZLineModel.line()` carries these `data-*` attributes:

| Attribute | Required | Description |
|---|---|---|
| `data-rz-line` | YES | always `"1"` — marker that this element is registered |
| `data-id` | YES | unique line identifier within the page (e.g. `cool-tcs-return`) |
| `data-from` | YES | source equipment ID or zone (e.g. `RACK-MANIFOLD`) |
| `data-to` | YES | destination equipment ID or zone (e.g. `CDU-ARRAY`) |
| `data-medium` | YES | enum from `MEDIUMS` table below |
| `data-direction` | YES | `forward` / `reverse` / `bidirectional` |
| `data-state` | YES | enum from `STATES` table below |
| `data-capacity` | recommended | nominal rated capacity (e.g. `DN300 600 m³/h`) |
| `data-current` | recommended | live operating value (e.g. `38.0°C`) |
| `data-redundancy` | recommended | enum from `REDUNDANCY` table below |
| `data-sensor` | optional | ISA-5.1 sensor tag (e.g. `TT-FWS-301`) |
| `data-tag` | optional | drawing tag (e.g. `P-001`) |

## Mediums

Defined in `RZLineModel.MEDIUMS`. Each medium maps to a default colour, base-RGB triplet (for opacity-scaled returns), and default dash pattern. The line builder allows `spec.style.stroke` to override the default colour while preserving the data-* tagging — used during palette-preservation pilots before the color-discipline pass.

| Medium key | Label | Default colour | Dashed |
|---|---|---|---|
| `chws` | Chilled Water Supply | cyan | no |
| `chwr` | Chilled Water Return | amber | yes |
| `tcs_supply` | Tech Cooling Supply (liquid loop) | cyan | no |
| `tcs_return` | Tech Cooling Return | amber | yes |
| `cw_supply` | Condenser Water Supply | purple | no |
| `cw_return` | Condenser Water Return | purple | yes |
| `fws` | Facility Water Supply | cyan | no |
| `fwr` | Facility Water Return | amber | yes |
| `dry_loop` | Dry Cooler Glycol Loop | purple | no |
| `liquid_supply` | Liquid-Cooling Supply (generic) | bright cyan | no |
| `liquid_return` | Liquid-Cooling Return | bright cyan | yes |
| `power_hv` | High-Voltage Power (≥35 kV) | red | no |
| `power_mv` | Medium-Voltage Power | amber | no |
| `power_lv` | Low-Voltage Power | green | no |
| `busway` | Busway / Bus-Duct | green | no |
| `ups_feed` | UPS Feed (A/B redundant) | green | no |
| `signal` | BMS / Control Signal | grey | no |
| `fiber` | Fibre Optic | cyan | no |
| `copper` | Copper Network (RJ45) | green | no |
| `fire` | Fire Signal / Suppression | red | no |
| `leak` | Leak Detection | amber | no |
| `drain` | Drain / Effluent | amber | no |
| `fuel` | Fuel (Diesel) | amber | no |

## States

Defined in `RZLineModel.STATES`. State drives opacity (and future pulse animation). Stroke colour is computed as `rgba(baseRGB, state.opacity)` when state ≠ `energized`; for `energized` it uses the medium's default CSS variable.

| State | Opacity | Pulse | Meaning |
|---|---|---|---|
| `energized` | 1.00 | no | Normal in-service line |
| `de-energized` | 0.35 | no | Offline / not carrying medium |
| `standby` | 0.55 | no | Available, ready, N+1 spare |
| `fault` | 1.00 | yes | Trip / fault — alarm visual |
| `isolated` | 0.30 | no | Manually isolated for maintenance |
| `maintenance` | 0.55 | no | Maintenance mode (LOTO) |
| `simulated` | 0.85 | no | Telemetry simulated, not live |

## Redundancy roles

Defined in `RZLineModel.REDUNDANCY`.

| Role | Description |
|---|---|
| `duty` | Primary, in service |
| `standby` | N+1 spare |
| `redundant_a` | Redundant feed A (2N) |
| `redundant_b` | Redundant feed B (2N) |
| `bypass` | Bypass path |
| `tie` | Tie / cross-couple |
| `maintenance` | Maintenance loop |
| `common` | Common / non-redundant |

## Builder API

```js
window.RZLineModel.line({
  id: 'cool-tcs-return',
  from: 'RACK-MANIFOLD',
  to: 'CDU-ARRAY',
  medium: 'tcs_return',
  direction: 'reverse',
  state: 'energized',
  capacity: 'DN150 SS316L',
  current: '45.0°C',
  redundancy: 'duty',
  sensor: 'TT-TCS-451',
  geometry: { x1: 925, y1: 205, x2: 800, y2: 205 },
  style: {                       /* optional overrides */
    stroke: 'var(--o)',         /* override default colour */
    strokeWidth: 2.5,
    cssClass: 'fL',             /* preserves existing animation hooks */
    dashPattern: '4 2',
    markerEnd: 'url(#arrow)'
  }
});
```

Also available:
- `RZLineModel.path({ d, ...spec })` — for orthogonal connectors using SVG paths
- `RZLineModel.polyline({ points, ...spec })`

The output is a string containing the full SVG element with both the visual rendering attributes and the data-* metadata — drop directly into an `s+=` IIFE accumulator.

## Validator

```js
const report = window.RZLineModel.audit(document);
/* {
 *   tagged: 7,
 *   untagged: 1352,
 *   total: 1359,
 *   coverage: 1,
 *   issues: []   // missing-field / unknown-medium / unknown-state
 * } */
```

Used by `tools/probe-line-model.mjs` to enforce the per-page adoption schedule.

## Adoption schedule (per ship)

| Ship | Page | Lines tagged | Verifier |
|---|---|---|---|
| v1.42.0 | `datahallAI.html` Cooling P&ID | 7 (pilot — major loop supply + return) | `node tools/probe-line-model.mjs` ≥ 7 |
| **v1.42.1** | `datahallAI.html` Electrical SLD overview | **+25** (PLN→meter→VCB×2 + bus drops + tie + 8 feeders × 2 segments). Cumulative **32**. | `ADOPTION_TARGETS = 32` |
| **v1.42.2** | `datahallAI.html` per-DH SLDs (elecDH1-4) — L0 substation + L1 RMU | **+80** (11 L0 lines + 9 L1 lines × 4 halls) + **+32 breakers** (5 L0 + 3 L1 × 4 halls). Cumulative **112 lines + 36 breakers**. | `ADOPTION_TARGETS = 112`, `BREAKER_TARGETS = 36` |
| v1.42.3 (pending) | `datahallAI.html` Network fabric | +15 | bump `ADOPTION_TARGETS` |
| v1.42.3 (pending) | `dc-conventional.html` chiller plant + EPMS | +25 | bump `ADOPTION_TARGETS` |
| v1.42.4 (pending) | `water-system.html` + `chiller-plant.html` | +30 | bump `ADOPTION_TARGETS` |
| v1.45.x | full coverage target | 80–90 % of major-loop lines tagged | coverage ≥ 80 % |

Engine files (`js/datahall-model.js`, `js/datahall-calculations.js`, `js/conv-engine.js`) remain byte-identical across all ports. Tagging is additive — un-tagged primitives continue to render exactly as before.

## Authoring guidelines

1. **Tag major-loop lines first.** Short visual stubs (label decorations, badge connectors) can stay un-tagged. The probe measures absolute count, not coverage, until v1.45.x.
2. **`from` and `to` must reference equipment IDs that exist elsewhere in the diagram** — when v1.42.1 ships the inspector pattern, hover-on-line will use these IDs to highlight upstream / downstream equipment.
3. **Preserve existing animation hooks.** The `class="fR"` / `class="fL"` animation classes (flow direction shimmer) survive the port via `style.cssClass`.
4. **Don't change colours during the port.** Use `style.stroke` to keep the existing palette identical. The color-discipline pass (status > domain > decorative — review §3.3) is a separate ship and will retire the overrides in one disciplined sweep.
5. **The `</script>` escape rule still applies** when the builder is invoked inside a PDF print-window template literal (rare, but possible) — write `<\/script>` if the literal includes one.

## Out of scope this standard

- Orthogonal connector routing helpers (90° L / Z / U-bends). Plan v32 deferred this; revisit when the line model is widely adopted.
- Auto-collision detection on shared anchor points (pipe-junction dots). Future v1.45.x candidate.
- Live binding from engine snapshots to `data-current` (real-time telemetry stream). Future v1.42.3 candidate (data-quality service).
