# Accuracy Validation Standard

> Standardisation for engineering-grade accuracy on the BMS / DCIM cockpit
> pages. Codified 2026-05-24 from the team's review docs
> `Documents/screenshot bms rz/dc ai/review/26-accuracy-validation-and-correction-list.md`
> and `.../conv/review/16-accuracy-validation-and-correction-list.md`.

## Core rules

### Rule 1 — One source of truth

Every engineering KPI on every page MUST resolve to the same canonical
value as the engine snapshot. `DATAHALL_CALC.lockedState()` + `pueBasis()`
+ `DATAHALL_MODEL` for DC AI; `CONV_CALC.snapshot` for DC Conv. The
dashboard, the deeper tabs, the Tech Spec PDF, and the FAQ dialog all
read from the same value at the same time.

### Rule 2 — No `Math.random()` on basis / derived KPIs

`Math.random()` (or any `R(min, max)` / `RI(min, max)` helper) MUST NOT
touch the following classes of value:

- IT load (per hall / per facility)
- PUE / WUE / CUE / CUE_IT
- Facility load
- Per-hall load
- GPU / NVL72 / rack count
- CDU / chiller / generator / UPS / transformer counts
- Anything cited from `lockedState()` or `pueBasis()`

Random IS allowed for:

- Outdoor weather (temperature, RH, wind speed)
- Wet-bulb temperature
- Sensor jitter on TCS supply / return (small band)
- People count, last-update time, door-access events

**Acceptance test:** reload the page 20 times. The KPI strip + DC
callouts + per-hall metrics + facility totals MUST be identical every
time. Only outdoor weather values change.

### Rule 3 — Every metric carries a denominator

PUE, WUE, CUE, CUE_IT, kVA loading, autonomy, flow rate — every
ratio-shaped or rate-shaped KPI must show its denominator in tooltip or
inline label. Examples:

| Metric | Required denominator |
|---|---|
| PUE | facility kW ÷ IT kW |
| WUE | L_water ÷ IT kWh (cooling-tower scope) |
| CUE_IT (ISO/IEC 30134-8) | kgCO₂ ÷ IT kWh |
| Grid factor | kgCO₂ ÷ facility kWh |
| Autonomy | usable_fuel_L ÷ site-total LPH |
| UPS loading | protected_load ÷ rated_load |
| Transformer loading | kVA_load ÷ kVA_rating |

If the engine variable carries a denominator suffix (e.g.
`carbon_kg_per_facility_kwh`), the UI MUST honour that denominator —
never display it under a label that implies a different one.

### Rule 4 — Marketing target ≠ derived value

`Target PUE ≤ 1.12` and `PUE 1.30 derived` are TWO DIFFERENT NUMBERS
with TWO DIFFERENT colour meanings. Never display the target as the
operational result.

Colour grammar:

| Colour | Meaning |
|---|---|
| Green | Inside operational band — meeting current threshold |
| Cyan / Blue | Derived value (informational, neutral) |
| Amber | Outside target but safe |
| Red | Alarm / trip / safety issue |
| Grey | Not calculated / source missing |
| Blue / Purple | Target / basis / source reference (informational) |

The PUE 1.30 derived value is shown CYAN (informational neutral), not
GREEN (which would falsely imply it's inside the ≤1.12 target band).

### Rule 5 — Terminology must match the engineering basis

For DC AI's GB200 NVL72 + 2-rack-footprint topology, use:

- `NVL72 domain` (logical 72-GPU unit; 132 kW per domain footprint)
- `physical rack position` (one of 2 racks carrying the NVL72 split;
  66 kW per position)

NEVER call a 66 kW position an "NVL72 rack" — NVIDIA reference spec
says ~120 kW per NVL72 rack-scale system.

For DC Conv, separate:

- `Primary CHWS / CHWR` (7.2 / 14.8 °C — chiller-plant side)
- `Secondary loop SP` (18.8 °C — CRAH/AHU side, NEVER labelled
  "CHWS SP")

### Rule 6 — Basis chip on every critical KPI (v1.32.2+)

Each critical KPI carries one of these chips:

| Chip | Meaning |
|---|---|
| MEASURED | Real / simulated sensor reading |
| DERIVED | Computed from engine |
| TARGET | Design threshold (BOD) |
| SIMULATED | Modelled value (not field) |
| BOD LOCKED | Immutable Basis-of-Design |
| MANUAL | Operator input |

A KPI click opens a basis drawer with: formula, inputs, output, scope,
denominator, source object, data-mode, last update.

## Acceptance tests (CI-gateable)

These are the reviewer's acceptance tests adopted as the validation
suite. Run as headless Puppeteer probes once v1.32.3 lands them.

### DC AI

1. **Headline consistency** — IT facility load = 14.26 MW on every
   page; PUE = 1.30 on every page; facility load = 18.55 MW on every
   page.
2. **No random basis values** — reload 20× and PUE/WUE/CUE/IT/facility/
   GPU/NVL72/CDU/genset are byte-identical.
3. **Market terminology** — no UI text implies 66 kW is a single
   NVIDIA NVL72 rack.
4. **CDU count math** — for 350 kW basis: 9 running × 4 halls = 36;
   12 installed × 4 halls = 48.
5. **Generator arithmetic** — total = units × rating. For 18.55 MW
   facility: 7 running + 1 N+1 = 8 × 2.75 MW.
6. **KPI colour grammar** — green only when inside band.
7. **Basis drawer** on every top KPI (v1.32.2+).

### DC Conv

1. **Carbon metric denominator** — if value = 0.42, label = "Grid
   factor" with facility-kWh denominator. If label = "CUE_IT", value
   = 0.61 (× PUE).
2. **Chiller loop label** — 18.8 °C never appears as "CHWS SP";
   always "Secondary loop SP".
3. **PUE reconciliation** — 1.45 on every page.
4. **WUE reconciliation** — 37 L/min × 60 ÷ 1850 = 1.20 L/kWh IT.
5. **Fuel autonomy** — 60,000 × 0.90 × 0.85 ÷ 956 = 48 hr; label =
   "bulk-tank at site load".
6. **UPS 2N** — normal sharing + failover percentages both visible.
7. **Rack basis** — physical count and rack-equivalent count never
   mixed without explicit label.
8. **Data mode** — simulated / derived / measured / target chips
   propagated consistently.

## Owner exclusions (status as of 2026-05-24)

| Zone | Status |
|---|---|
| `#p-dash` panel + `updateDashKPI()` + `dcCallouts` | **LIFTED 2026-05-24** by owner directive on this review. Future fixes may modify these. |
| `js/datahall-model.js` byte-identical | STILL LOCKED |
| `js/datahall-calculations.js` byte-identical | STILL LOCKED |
| `js/conv-engine.js` byte-identical | STILL LOCKED |
| `tools/test-datahall-calc.mjs` 57/57 must pass | STILL LOCKED |
| `tools/test-conv-calc.mjs` 22/22 must pass | STILL LOCKED |

## Implementation history

- **v1.32.0** (2026-05-24): Critical fixes shipped — AI-ACC-01/02/05/06/07
  + CONV-ACC-01/02/04/08. Dashboard randomisation stripped; CUE
  denominator clarified; Tech Spec corrected.
- **v1.32.1** (planned): Terminology + label sweep — AI-ACC-03/04/08/09/10
  + CONV-ACC-03/05/06/09.
- **v1.32.2** (planned): Basis drawers per Rule 6.
- **v1.32.3** (planned): Puppeteer probes for the acceptance tests above.
