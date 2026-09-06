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

**v2.2.0 (Track A §A5) — the rule at full depth.** `datahallAI.html` no longer defines `R()` /
`RI()`, and the 22 deep-mimic renderers read every value from their equipment payload
(`RZ_HMI_P`). The "random IS allowed" list above now means *seeded*: a sensor-class value comes from
`js/datahall-ai/sim-telemetry.js` as a function of `(point id, 4 s tick)`, anchored to an engine
plane or a declared rating with a stated band, and is declared on the cell as simulated. Reloading
inside one tick gives identical values everywhere — including inside every open modal — which is
what `tools/test-datahall-ai-inspector-runtime.mjs` asserts with `window.__rzSimTick` pinned; the
same gate counts `Math.random` calls while each modal is open and requires zero. A state (alarm
badge, pump running, bypass, dry/wet) is never a die roll: it comes from the electrical, cooling or
fire scenario engine. The static half of the rule: `tools/test-datahall-ai-hmi-payloads.mjs` fails
on any `Math.random`, `R(` or `RI(` inside a `@rz-hmi` marker block or in the payload modules.

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

For DC AI's **GB300 NVL72** topology (adopted 2026-09-06, live since v2.0.0), **one rack IS one
NVLink domain** — there is no split-domain footprint any more. Use:

- `NVL72 rack` (one physical rack = one 72-GPU NVLink domain; **142 kW** per rack)
- `rack row` (a physical aggregation unit for the hall mimic and floor plan; **88 racks**)
- `RPP group` (the electrical aggregation unit fed by one busway trunk; **22 racks**, ≈3.12 MW,
  ≈4.7 kA at 400 V — four groups per row, 40 groups per hall)

NEVER use, for the current GB300 basis:

- `rack-pos` / `physical rack position` (that vocabulary describes the RETIRED GB200 split-domain
  footprint, where a domain spanned 2 racks)
- `66 kW` (the retired GB200 per-rack-position figure)
- `132 kW per NVL72` (the retired GB200 per-domain figure; the GB300 figure is 142 kW per rack)

The retired GB200 vocabulary (`NVL72 domain` / `physical rack position`, 132 / 66 kW) still applies
**only** when describing the byte-frozen `js/datahall-model.js` + `js/datahall-calculations.js`
pair as a named historical reference (e.g. the platform-comparison selector), and any such mention
must be labelled as the retired basis, never presented as the page's current numbers.

For DC Conv, separate:

- `Primary CHWS / CHWR` (19.4 / 27.0 °C at the current governed point)
- `Secondary loop SP` (follows the primary CHWS floor: 19.4 °C at the
  current governed point and may be raised for bypass; NEVER labelled "CHWS SP")

### Rule 5 — status note (v2.0.0)

**`datahallAI.html` is switched.** As of v2.0.0 (Track A §A2b, 2026-09-06) the page loads
`js/dcai-model.js` + `js/dcai-engine.js` + `js/dcai-parameters.js` (spec
`gb300-500mw-2026-09-06`, asset version `1.0.0`) as its authority, not the GB200 pair. Rule 5's
vocabulary above is the CURRENT text contract, enforced by `tools/probe-accuracy-validation.mjs`
AI-Test-3 (now INVERTED versus the pre-v2.0.0 wording: it forbids `rack-pos`/`66 kW` and requires
`142 kW`) and by `tools/test-datahall-ai-no-retired-literals.mjs`. The GB200 pair
(`js/datahall-model.js` + `js/datahall-calculations.js`) is RETIRED the way `conv-engine.js`
retired the 1.85 MW hall — frozen byte-identical by the ship gate, still reproducing its own 57
worked examples via `tools/test-datahall-calc.mjs`, no longer the page's basis. **Known open
gap** (tracked, not silently accepted): the Tech Spec PDF builder (`buildTechSpecHtml()`) and
its §3.4–3.6 worked sections have not yet completed their GB300 rewrite — they still contain
`rack-pos` vocabulary and a `legacyView().eq.busway` field mismatch (`selectedRatingA` /
`undersizedRatingA` are not published by the current adapter) that throws
`Non-finite numeric input: NaN` and aborts Generate-Design PDF export. The Basis-of-Design PDF
builder (`buildBodPdfHtml()`) is fully rewritten and carries none of the retired vocabulary.

### Rule 6 — Traceability symbol on every published number (v1.32.2, rewritten v2.1.0)

Every number a cockpit renders carries **one of the ten registry evidence classes**, published once
in `js/rz-evidence.js` and read by the basis drawer, the right-side inspector and the SVG mark:

| Class | Colour | Meaning |
|---|---|---|
| PUBLISHED | blue | Printed by the vendor or standards body named in the source; not measured here |
| STANDARD | blue | A physical constant or a code value |
| VENDOR | blue | Vendor-quoted for this project; screening grade until confirmed |
| DERIVED | green | Computed by the engine from other parameters; nothing typed |
| ADOPTED | amber | A project or owner design decision, stated as such |
| ASSUMED | amber | A textbook or mid-band value chosen before the result was looked at |
| SIMULATED | violet | A modelled operating value or a simulated sensor; never a field reading |
| MEASURED | green | A real instrument reading — nothing on these pages is MEASURED today |
| LABEL | grey | A name, a version or a nameplate figure used as a label — never a denominator |
| UNAVAILABLE | red | Not published by the source and not derivable here; shown as an em dash |

The old six-term chip vocabulary (MEASURED / DERIVED / TARGET / SIMULATED / BOD LOCKED / MANUAL) is
retired: BOD LOCKED → ADOPTED, SIM SENSOR → SIMULATED, TARGET → LABEL. MANUAL is dropped — nothing on
these pages is operator input.

**On the drawings (A3, v2.1.0).** A number drawn inside an SVG mimic is emitted by
`RZSvgBasis.tag()` as ONE declared group: the `<text>` plus a **non-text mark** — a 2.2-unit circle
on the value's baseline coloured by evidence class — with `data-basis-param="<registry id>"`,
`tabindex="0"`, `role="button"` and a `<title>` naming label, class and id. The mark is not text, so
the legibility and collision gates never see it; the group declares the pair so they cannot collide
with each other. A composite string names every id it prints in `data-basis-params`; a repeated row
(a 40-line RPP ladder) stays hooked but draws no mark (`data-rz-nomark`) — **one symbol per
parameter per diagram, not one per mention**. A click on a mark opens the **right-side inspector**
in basis mode (never the centre modal — review doc-27 §3.2); a pan that moved the sheet is not a
click. HTML cells keep the centre drawer and show the same evidence dot.

A number with no registry twin sits inside a `data-rz-authored-basis="<reason ≥ 40 chars>"` scope
that says what it is (a page-authored specification, a published label, a simulated telemetry
reading, an identity over marked parameters). **A number that is neither hooked nor declared fails
`tools/test-dcai-coverage.mjs --strict`** — value-string coincidence with a registry value counts
for nothing on the AI page. The gate measures with `--settle` so every ticker has fired: a hook whose
value a die roll overwrites shows up as MISMATCH, which is the live-page form of Rule 2.

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
  3a–3c (terminology, INVERTED at GB300 vs the pre-v2.0.0 wording), 4 (CDU count),
  5 (generator arithmetic), 6 (colour grammar), 7a–7e (shared basis-drawer contract).
- DC Conv: tests 1a–1b (carbon denominator), 2a (chiller loop label),
  3a–3b (PUE reconciliation), 4 (WUE reconciliation), 5 (fuel
  autonomy scope), 6 (UPS 2N normal+failover), 7 (reload
  determinism), 8a–8d (basis drawer).

Approximate runtime: 25–35 s headless. Adopt as a per-ship gate
alongside the four audit scripts (`audit-script-tags`,
`audit-js-syntax`, `audit-version-stamp`, `audit-mobile-responsive`).

### DC AI (GB300 basis, v2.0.0)

1. **Headline consistency** — rack IT = 499.84 MW, total IT (the PUE denominator) = 539.05 MW,
   PUE (design day) = 1.165, WUE = 0.00, CUE_IT = 0.80 (grid 0.69 × PUE), GPUs = 253,440, NVL72
   racks = 3,520 — identical on every surface that renders them (`#dkIt`/`#dkPue`/… and the
   generated PDFs).
2. **No random basis values** — reload 20× and PUE/WUE/CUE/IT/facility/
   GPU/NVL72/CDU/genset are byte-identical.
3. **Market terminology (INVERTED vs the GB200 wording)** — the page MUST NOT contain `rack-pos`
   or `66 kW` (retired GB200 vocabulary), and MUST contain `142 kW` (the GB300 per-rack figure —
   at GB300 a rack IS the NVL72 domain, so no disambiguating "rack position" language is needed
   or correct any more).
4. **CDU count math** — `equipment.cdu_duty_per_hall` = 107 running + 1 standby =
   `equipment.cdu_installed_per_hall` 108 per hall; × 4 halls = `equipment.cdu_installed_facility`
   432.
5. **Generator arithmetic** — total = units × rating. Facility electrical load ≈ 628 MW:
   169 running (duty) + 2 standby = 171 installed (N+2) × 4 MW gensets.
6. **KPI colour grammar** — green only when inside band; PUE stays cyan (informational, Rule 4).
7. **Basis drawer** — every top KPI carries `data-basis-param` onto a `RZ_DCAI_PARAMETERS`
   registry id and opens the shared `#rz-basis-drawer` (`js/rz-basis-drawer.js`), same drawer as
   the Conventional cockpits (v2.0.0 — replaces the retired page-local `#kpiBasisDrawer` +
   `basisFor` dictionary).
8. **First-paint truth** — authority KPIs render their exact engine value from the first frame.
   Count-up animation, easing through plausible values and delayed restoration are prohibited.

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

- **v1.134.15** (2026-08-30): First-paint truth is release-gated for the AI authority KPIs; the visual
  harness now verifies the exact route-owned `data-rz-cockpit-root` after removing only exact authentication
  blockers. Non-auth feature dialogs survive, and error/missing-capture evidence makes the audit CLI exit
  non-zero. Mobile telemetry disclosure and BoD table evidence are exercised with real pointer and geometry
  checks; local preview clears stale geolocation caches before installing a blank deterministic fallback.

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
- **v2.0.0** (2026-09-06, Track A §A2b WP1–WP5): `datahallAI.html` switched from the GB200 pair
  to the GB300 basis engine (`js/dcai-model.js` + `js/dcai-engine.js` + `js/dcai-parameters.js`,
  spec `gb300-500mw-2026-09-06`). Rule 5 rewritten for GB300 vocabulary (above); DC AI acceptance
  tests 1/3/4/5/7 re-pinned to the new snapshot (539.05 MW total IT, 1.165 PUE, 142 kW/rack,
  108/432 CDU, 171 gensets). `tools/test-datahall-ai-authority.mjs`,
  `tools/test-datahall-ai-cdu-basis.mjs` and `tools/test-datahall-ai-operator-ui.mjs` rewritten for
  the new authority contract. `tools/probe-accuracy-validation.mjs` now executes **73 total
  assertions** (was quoted 83/83 in `tools/ship-gate.sh` before this measurement; the gap is the 9
  Tech Spec assertions TS-AI-2..10 that are skipped while TS-AI-1 fails — see below). **71/73
  PASS** at time of writing; the 2 open failures are BOTH inside `datahallAI.html`'s still-in-flight
  Tech Spec PDF rewrite, not gate defects:
  - `AI-Test-3a` — `rack-pos` / `rack position` GB200 vocabulary still appears in the Tech Spec's
    §3.4–3.6 worked sections (per-domain power matrix, floor-loading note, cable-schedule preview).
  - `TS-AI-1` — clicking Generate Design throws `Non-finite numeric input: NaN` inside
    `buildTechSpecHtml()` because it reads `legacyView().eq.busway.selectedRatingA` /
    `.undersizedRatingA`, fields the current adapter does not publish (`eq.busway` only has
    `trunkRatingA` / `groupCurrentA` / `loadingPct`); this aborts PDF generation entirely, so
    TS-AI-2..10 never execute in this run.
  The Basis-of-Design PDF builder (`buildBodPdfHtml()`) is fully rewritten: BoD-AI-3/4/5/7
  re-pinned to the GB300 snapshot, and BoD-AI-6 was INVERTED (it no longer cites "Scenario A" —
  confirmed absent from the rewritten BoD PDF source) rather than left asserting retired wording.
