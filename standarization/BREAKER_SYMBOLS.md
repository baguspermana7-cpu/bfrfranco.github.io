# Breaker symbol standard — v1.42.1+

Companion to [`LINE_MODEL.md`](LINE_MODEL.md). Responds to team review docs:

- `Documents/screenshot bms rz/dc ai/review/27-deep-rereview-2026-05-24-uiux-engineering.md` §3.1 + §5.3
- `Documents/screenshot bms rz/dc ai/review/28-screen-by-screen-action-list-2026-05-24.md` (EPMS / Electrical SLD screenshots)
- `Documents/screenshot bms rz/conv/review/17-deep-rereview-2026-05-24-uiux-engineering.md` §3.2
- `Documents/screenshot bms rz/conv/review/18-screen-by-screen-action-list-2026-05-24.md` EPMS

> "Gunakan IEC/ANSI-like SLD symbol untuk breaker, transformer, ATS/STS, UPS,
> busbar. Breaker harus punya state: open/closed/tripped/racked-out/test/
> maintenance. Red/green line dapat ditafsirkan sebagai energized/alarm/
> source. Breaker state belum cukup jelas jika hanya warna."

`js/rz-breaker-symbols.js` exposes `window.RZBreakerSymbols` with state-driven IEC 60617 / IEEE C37.2 compliant geometry. Same load posture as `rz-line-model.js` (non-deferred, before page IIFEs).

## Schema

Every breaker emitted via `RZBreakerSymbols.render()` carries these data-* attributes:

| Attribute | Required | Description |
|---|---|---|
| `data-rz-breaker` | YES | always `"1"` — marker |
| `data-id` | YES | unique breaker tag (e.g. `VCB-INC-A`) |
| `data-state` | YES | enum from `STATES` table |
| `data-upstream` | recommended | source bus / equipment ID |
| `data-downstream` | recommended | destination equipment ID |
| `data-voltage` | recommended | nominal voltage (e.g. `20 kV`) |
| `data-rating-a` | recommended | rated current (e.g. `630 A`) |
| `data-rating-ka` | recommended | short-circuit interrupt rating (e.g. `25`) |
| `data-device-fns` | optional | ANSI device functions, csv (e.g. `50,51,67N`) |
| `data-af` | optional | NFPA 70E PPE category (`PPE1`–`PPE4`) |
| `data-ct` | optional | CT ratio (e.g. `600/5`) |
| `data-interlock` | optional | interlock status (e.g. `permissive_ok`) |
| `data-redundancy` | optional | role (matches `RZLineModel.REDUNDANCY`) |

## States

Defined in `RZBreakerSymbols.STATES`. Each state has its own SVG glyph (no longer just color).

| State | Glyph | Default colour | Pulse | Meaning |
|---|---|---|---|---|
| `closed` | vertical mechanical link | green | no | In service, carrying load |
| `open` | angled arm separated from upper terminal | grey | no | Switched off, de-energized |
| `tripped` | open arm + red X overlay + pulse | red | YES | Fault / trip — alarm |
| `racked_out` | dashed cradle bracket + open arm | amber | no | Drawn out for maintenance |
| `test` | open arm + 'T' badge | cyan | no | Test position, no load |
| `maintenance` | open arm + padlock badge | purple | no | LOTO (lockout / tagout) |
| `disabled` | faint arm + diagonal slash | grey | no | Administratively disabled |

Color is a SECONDARY indicator. Operators read the GLYPH first.

## ANSI device function numbers (IEEE C37.2)

Defined in `RZBreakerSymbols.DEVICE_FUNCTIONS`. Common DC switchgear set.

| Code | Function |
|---|---|
| 25 | Synchronism-check |
| 27 | Undervoltage |
| 50 | Instantaneous overcurrent |
| 51 | Time overcurrent |
| 52 | AC circuit breaker |
| 67 | Directional overcurrent |
| 67N | Directional earth-fault |
| 81 | Frequency |
| 86 | Lockout |
| 87T | Differential protection (transformer) |
| 87B | Differential protection (bus) |

## Arc-flash PPE categories (NFPA 70E 2024)

Defined in `RZBreakerSymbols.AF_CATEGORIES`.

| Code | Incident energy |
|---|---|
| PPE1 | ≤4 cal/cm² |
| PPE2 | 4–8 cal/cm² |
| PPE3 | 8–25 cal/cm² |
| PPE4 | 25–40 cal/cm² |

## Builder API

```js
window.RZBreakerSymbols.render({
  id: 'VCB-INC-A',
  state: 'closed',                  /* glyph + color derived from state */
  x: 285, y: 80,
  color: 'var(--b)',                /* optional override */
  upstream: 'PLN-A',
  downstream: 'SM6-BUS-A',
  voltage: '20 kV',
  rating_a: '630 A',
  rating_ka: '25',
  deviceFunctions: ['50','51','67N'],
  afCategory: 'PPE2',
  ctRatio: '600/5',
  interlock: 'permissive_ok',
  redundancy: 'redundant_a'
});
```

The output is a complete SVG `<g>` element with both the visual glyph AND the data-* metadata. Drop directly into an `s+=` IIFE accumulator.

## Validator

```js
const report = window.RZBreakerSymbols.audit(document);
/* { tagged: 4, issues: [] } */
```

Used by `tools/probe-line-model.mjs` (extended in v1.42.1 to check breaker tagging alongside line tagging).

## Adoption schedule

| Ship | Page | Breakers tagged | Notes |
|---|---|---|---|
| v1.42.1 | `datahallAI.html` Electrical SLD overview | 4 (VCB-INC-A, VCB-INC-B, VCB-TIE, F1A) | Pilot — proves the schema |
| v1.42.2 (planned) | `datahallAI.html` per-DH SLDs (elecDH1-4) | +24 (6 per DH × 4 halls) | RMU + TX + LV main + UPS A/B + bypass |
| v1.42.3 (planned) | `dc-conventional.html` EPMS | +18 | Utility, genset, UPS, ATS, MSB feeders |
| v1.45.x | full coverage target | 80% of breaker count on EPMS pages tagged |

## Authoring guidelines

1. **State first, color second.** When porting an existing breaker, choose the right `state` value; the library will compute the glyph. Don't override color unless preserving an existing palette during a pilot.
2. **`upstream` and `downstream` should match equipment IDs used in `RZLineModel.line({from, to})`.** When the inspector pattern arrives (v1.42.4+), hover-on-breaker will use these IDs to highlight the connected lines.
3. **Coexists with existing `symCB` / `symCBe` helpers.** Adoption is additive — existing un-ported breakers continue to render unchanged.
4. **PDF print-window template literals: `<\/script>` escape rule still applies** if the builder is invoked inside one (rare but possible).

## Out of scope this standard

- Transformer / ATS / STS / UPS symbol library (planned v1.42.4 + v1.44.x).
- Live binding of `data-state` to engine snapshots (planned v1.42.3 — data-quality service).
- Click-to-open-inspector (planned v1.42.4 — inspector pattern on equipment).
