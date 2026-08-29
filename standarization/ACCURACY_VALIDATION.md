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

- `Primary CHWS / CHWR` (19.4 / 27.0 °C at the current governed point)
- `Secondary loop SP` (follows the primary CHWS floor: 19.4 °C at the
  current governed point and may be raised for bypass; NEVER labelled "CHWS SP")

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
suite. **Shipped as headless Puppeteer probes in v1.32.9**:
`tools/probe-accuracy-validation.mjs`.

```bash
# 1. Spin a local server (one-time per session):
python3 -m http.server 8081

# 2. Run the probe (~30 s, headless Chrome via Puppeteer):
node tools/probe-accuracy-validation.mjs

# OR — no server needed, slower:
RZ_BASE=file node tools/probe-accuracy-validation.mjs
```

Exit code 0 on PASS, 1 on FAIL. The probe covers:

- DC AI: tests 1a–1f (headline consistency), 2 (reload determinism),
  3a–3b (terminology), 4 (CDU count), 5 (generator arithmetic),
  6 (colour grammar), 7a–7g (basis drawer contract).
- DC Conv: tests 1a–1b (carbon denominator), 2a (chiller loop label),
  3a–3b (PUE reconciliation), 4 (WUE reconciliation), 5 (fuel
  autonomy scope), 6 (UPS 2N normal+failover), 7 (reload
  determinism), 8a–8d (basis drawer).

Approximate runtime: 25–35 s headless. Adopt as a per-ship gate
alongside the four audit scripts (`audit-script-tags`,
`audit-js-syntax`, `audit-version-stamp`, `audit-mobile-responsive`).

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
2. **Chiller loop label** — the load-loop setpoint never appears as "CHWS SP";
   always "Secondary loop SP", with the current primary CHWS as its lower bound.
3. **PUE reconciliation** — 1.45 on every page.
4. **WUE reconciliation** — 600.0 L/min × 60 ÷ 30,000 kW = 1.20 L/kWh IT.
5. **Fuel autonomy** — 972,737 × 0.90 × 0.85 ÷ 15,503 = 48 hr; label =
   "bulk-tank at site load".
6. **UPS 2N** — normal sharing + failover percentages both visible.
7. **Rack basis** — physical count and rack-equivalent count never
   mixed without explicit label.
8. **Data mode** — simulated / derived / measured / target chips
   propagated consistently.
9. **Thermal semantics** — 25.4 °C rack inlet is normal green inside the
   adopted 18–27 °C envelope; power-density bands are not reused for temperature.
10. **Hall metering** — rack sum versus hall EPMS is `UNAVAILABLE` until a
    governed hall submeter exists; equal-share planning arithmetic is neutral evidence.
11. **Continuous state** — chiller temperatures and flow remain within the
    current engine-derived bands after at least one scheduled simulation update.
12. **Authority fan-out** — missing, request-mismatch, matched-legacy or same-version-incomplete
    authority makes every duplicated KPI, path, tooltip, hidden drawer and status consumer
    unavailable, never plausibly healthy. The governed Conventional engine is pinned to v2.0.0.
13. **Thermal-plane naming** — 943.0 L/s is the IT sensible-load CHW reference; 982.3 L/s is
    the current evaporator-duty reference; measured header flow is unavailable. The 31,250 kW
    compatibility field is evaporator duty, while 36,403.4 kW is condenser/tower rejection.

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

- **v1.134.14** (2026-08-30): Operator-cockpit continuity and complete-authority gates added. Data Hall thermal
  colors and hall-metering scope, post-tick chiller envelopes, site-wide municipal water,
  all-path Fire fail-closed behavior, Design Studio selection and responsive AI header
  reachability, shared-drawer provenance and linked-document parity are now exercised by
  adversarial Puppeteer probes. CHW reference flow, evaporator duty and tower rejection are
  labeled as distinct thermodynamic quantities.

- **v1.32.1** (2026-05-24): Critical fixes shipped — AI-ACC-01/02/05/06/07/08
  + CONV-ACC-01/02/04/08. Dashboard randomisation stripped; CUE
  denominator clarified; Tech Spec corrected. (Authored as v1.32.0;
  parallel session shipped its own v1.32.0 mid-push.)
- **v1.32.6** (2026-05-24): Terminology + UPS 2N + CHW reconciliation —
  AI-ACC-04/09/10 + CONV-ACC-03/05/06/09. NVL72 rack → rack-pos labels;
  UPS rows show normal-vs-failover; chiller-plant adds CHW flow
  reconciliation card. (Authored as v1.32.2; renumbered after parallel
  session's v1.32.5 doc-propagation patch.)
- **v1.32.8** (2026-05-24): Basis drawers per Rule 6 SHIPPED. Every top
  KPI on both cockpit dashboards (8 DC AI + 7 DC Conv = 15 total) opens
  a drawer with formula / inputs / output / scope / denominator /
  source / data-mode / last-update. Closes the reviewer's "Required
  KPI Display Contract" finding. (Authored as v1.32.7; renumbered after
  parallel session's v1.32.7 Network Hub plan v2.)
- **v1.32.9** (2026-05-24): Puppeteer probes SHIPPED. The 15 reviewer
  acceptance tests across DC AI + DC Conv are now codified as runnable
  assertions in `tools/probe-accuracy-validation.mjs`. Owner can
  invoke per ship; future automation can wire to CI gates.
- **v1.33.1** (2026-05-24): Probe ran on first attempt, **found 2
  real bugs** (FAQ_ITEMS `ReferenceError: sc is not defined` shipped
  in v1.30.1; probe `page.click()` needed DOM-API fallback for
  headless reliability). Both fixed. **32/32 PASS**. The probe earned
  its keep on day 1. (Authored as v1.32.10; renumbered after parallel
  session's v1.32.10 + v1.33.0 Network Hub work.)
- **v1.33.2** (2026-05-24): Rule 6 extended to `datahall.html`
  ops-rollup top-strip (5 KPIs: Hall State / Rack Load / Cooling
  Margin / PUE / Power Density). Probe extended +5 tests. **37/37
  PASS**.
- **v1.33.3** (2026-05-24): Rule 1 (one source of truth) verified
  CROSS-PAGE. Probe asserts PUE 1.45 identical on 3 surfaces, WUE
  1.20 identical on 4 surfaces; at that historical release, IT load reconciled
  the then-governed dc-conv "1,850 kW" = datahall "1.85 MW" basis. Those values
  are historical evidence, not the current 30 MW authority. The reviewer's chief concern — "deeper tabs
  can be correct while the first screen tells a different story" —
  is now demonstrably ruled out for these metrics. **40/40 PASS**.
- **v1.36.1** (2026-05-24): Probe wired into per-ship gate
  sequence (`tools/ship-gate.sh`). Mobile patch on 6 Network Hub
  pages. Gate runner caught defects across sessions.
- **v1.36.2** (2026-05-24): Tech Spec PDF probe coverage added.
  Caught **CRITICAL silent bug**: DC AI Generate Design returned
  EMPTY PDF since v1.31.2 (~24 hr in production) because
  `buildTechSpecHtml()` referenced `sldSVG` declared only in
  `buildBodPdfHtml()` scope. Fixed by local var declaration. **60/60
  PASS** (was 40; +20 Tech Spec assertions).
- **v1.37.1** (2026-05-24): BoD Export PDF probe coverage added —
  separate code path from Generate Design. PDF was healthy on first
  run; now mechanically verified. **67/67 PASS** (was 60; +7 BoD).
  (Authored as v1.36.3; renumbered after parallel v1.37.0 Network Hub.)
- **v1.37.2** (2026-05-24): FAQ dialog probe coverage. Caught
  **bug #5**: DC Conv FAQ button TypeError (`s.datahall.racks_total`
  undefined — `CONV_CALC.snapshot` has no `datahall` key). Fixed
  by hardcoding 200 racks design constant with defensive guard.
  **75/75 PASS** (was 67; +8 FAQ assertions).
