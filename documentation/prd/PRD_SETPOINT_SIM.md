# PRD-SETPOINT-SIM — every setpoint visible, simulated, and its control logic readable

Status: **APPROVED 2026-11-22 (R187).** Builder: session polish-electrical-sld-bms.

## B0. Context

Owner, verbatim: "semuanya pasti ada settingan baik itu thresold atau set point dan sekarang valuenya berapa itu hars terlihat, semuanya literally semuanya dan saat ci chart juga terlihat garis set point dll, dan saat control atau block di double click modal itu memperlihatkan juga set pointnnya berapa dan bisa di simulate misal set point itu di adjust apa eddectnya, dan juga misal di chiller itu emergency mode logicnya seperti apa, atau p&id dll jadi bisa di analisa respond seystem".

What exists (survey, wt-elec):

- **Conventional:**
  - `RZPointStatus` limits (HH/H/L/LL, deadband) cover 33 of 423 stateful points. There is no SP field; `nominal.value` is the nearest thing.
  - Setpoint-like parameters are model values (`cooling.rack_inlet_target_c`, `cdw_supply_c`, derived `chws_c` = `crahSupplyAirC − chw_coil_approach_k`, `conv-engine.js:339`).
- **DC AI:** `js/datahall-ai/points.js` already has `sp` per record (53 records), limits relative to SP, and `table(snap)` with a setpoint column. Payloads hold SP text literals ("45 % RH setpoint", "18 °C MMR supply setpoint").
- **Trend:** `rz-trend.js` 3.0.0 draws limits plus an optional `ref` dashed line. There is no SP line. It is peer read-only.
- **Modal:** `RZConvModal` blocks; `internals/chiller.js` mentions SP in text only. The DC AI inspector uses `payload.actions.custom` → `[data-rz-action]`.
- **What-if:** only `chiller-plant.html` sliders (#spChws, #spDp, #spFlow): a first-order lag plus noise, not an engine recompute.
- **Engines:** `CONV_CALC.recompute(m)` (conv-engine.js:1965) and `DCAI_CALC.compute(m)` / `operatingPoint` (dcai-engine.js:803).
- **Control logic:** no sequence of operations, emergency mode or control loop anywhere. "PID" in the code means the P&ID drawing (`rz-pid-*`).
- **Peer split (8a):** PRD-CONV-OPS-DEPTH covers actual values only. SP, SP line, what-if and emergency logic are delegated here.

## B1. Model: one control registry, both cockpits

New data file `data/control-points.json`, built by `tools/build-control-registry.mjs` from:

1. the conv limits registry (`data/conv-parameters.json limits`);
2. DC AI `points.js` records;
3. a curated file `data/control-points.curated.json` for the SPs that live only as payload text today.

Record:

```
{ id, cockpit: 'conv'|'dcai', equipment: '<cls>', label, unit,
  sp:   { value | param: '<engine param id>', adjustable: {min, max, step}, basis, evidenceClass },
  limits: { lo_alarm, lo_warn, hi_warn, hi_alarm, deadband, delay_s },        // from the existing registries
  loop: { id: 'CHW-SUP-TEMP', pv: '<point id>', mv: '<actuator>', action: 'direct'|'reverse',
          kind: 'PI'|'staging'|'reset'|'interlock', tuning: {kp, ti_s} | null, basis },
  modes: ['normal','emergency',…] }
```

Rules:

- Every SP names its source and evidence class. A value with no defensible source is `assumed`, and the UI says so; it is never invented (same rule as `points.js`).
- SP precedence: user what-if (session only, never saved as live) > Supabase `conv_points` row > registry.
- **"Literally everything"** = every point the coverage gates count: 423 conv stateful + DC AI points. A point with no SP and no limit shows "no setpoint — monitored only". This is listed by the gate, never hidden.

## B2. Where it shows

1. **Next to every live value:** a muted `SP 7.0` / limit range in the tooltip and, on desktop, inline after the value (one ink line, no chips). On phones, the tooltip only (owner R: less visible text).
2. **Trend:**
   - The SP is drawn as a dashed ink line, labelled `SP 7.0`. Limits keep their solid hairlines.
   - A what-if SP draws a second dashed line labelled `SP' 6.0 (sim)`.
   - The line uses the existing `ref`/`refLabel` hook. If 8a agrees, `rz-trend.js` gets `sp`/`spSim` keys in their release; until then, `ref` = SP.
3. **Double-click modal (Conv `RZConvModal`, DC AI inspector + `hmi-v2` openers):**
   - A new block **Setpoints & limits**: a table of SP, the live PV, error PV−SP, HH/H/L/LL, deadband, delay and source. Every row has a slider within `adjustable`.
   - A **Control** block: the loop it belongs to (PV → controller → MV), action, mode, tuning or "not modelled".
4. **What-if (simulate):**
   - Moving an SP slider recomputes the engine with that parameter: `CONV_CALC.recompute({…m, [param]: v})` / `DCAI_CALC.compute(m)`.
   - The modal then shows a before/after table of the dependent outputs:
     - CHWS SP +1 K → chiller kW, COP, CHW flow, rack inlet, PUE;
     - CDW SP → tower fan kW and chiller lift;
     - Rack inlet SP → CRAH fan and CHWS chain.
   - A **response preview** plots PV against time to the new SP using the loop model: a first-order plus dead time from the registry (τ, θ, with source). For loops with no defensible τ, the preview shows only the steady-state result and says "dynamics not modelled".
   - Every number is labelled `SIMULATED`. Reset returns to live. Nothing persists.
   - The chiller-plant sliders migrate to this same path (their noise lag is replaced by the engine recompute plus the FOPDT preview).
5. **Emergency and sequence logic** (new, docs-as-data):
   - A `data/sequences/<equipment>.json` per class holds modes, entry conditions (point + limit + delay), actions in order, and exit conditions. Each carries a basis (ASHRAE Guideline 36 for AHU/CRAH/chilled-water plant sequences, vendor practice marked `assumed`).
   - **Chiller first:** normal staging (lead/lag on load % and CHWS error), low-flow / freeze protection, high condenser pressure unload, loss of CDW, power failure → restart sequence on genset (staggered restart), and emergency mode (all available chillers, CHWS reset to the minimum SP, TES discharge if modelled).
   - The modal shows them as a state diagram rendered through `RZDiagram` (the engine, no hand SVG).
   - A **Simulate** button steps the plant through the sequence with the engine:
     - the active state is highlighted;
     - the PV trends show the response;
     - planted faults reuse the Cx scenarios (PRD_CX_SCENARIOS) where they exist.
   - Then: CRAH, pumps, towers, genset/ATS (electrical is already partly in EPMS), UPS, and DC AI CDU / dry cooler / free-cooling switchover (`p04_free_cooling_margin_k` exists).
6. **P&ID control loops:**
   - On the existing P&ID sheets (`rz-pid-*`, conv `*-sheet.js`, DC AI `hmi-sheets.js`), instrument bubbles (TIC, PIC, FIC per ISA-5.1) are drawn and joined by signal lines to their final element (valve, VSD).
   - Hovering a loop highlights PV → controller → MV.
   - Double-clicking the bubble opens the same Setpoints & Control modal.
   - Loop tags come from the registry, never typed on the sheet.

## B3. Laws (gate `tools/test-setpoint-sim.mjs`, plus node core `test-control-registry.mjs`)

| law | claim |
|---|---|
| S1 | Every counted point (coverage baseline) has a registry row, and each row is either an SP/limit with a source or "monitored only"; 0 rows without a source. The count is printed. |
| S2 | Each SP shown on the page equals the registry/engine value (tooltip = modal = trend label). |
| S3 | A trend of a point with an SP draws exactly one SP line at that value; a what-if adds one `sim` line; the limits are unchanged. |
| S4 | Double-click on the chiller, CRAH, pump, tower, CDU and breaker opens the Setpoints block with ≥ 1 row and a slider per adjustable SP. |
| S5 | What-if: CHWS SP +1 K changes chiller kW and PUE in the direction the engine predicts (same numbers as a direct Node recompute ± 0.1 %); Reset restores live exactly; nothing is written to localStorage or Supabase. |
| S6 | Response preview: the FOPDT curve reaches 63 % at τ+θ from the registry (± 1 sample); a loop without τ shows "dynamics not modelled". |
| S7 | Chiller sequence: every mode has entry, actions and exit with a basis; Simulate of "loss of CDW" walks the states in the order of the JSON, and the PV trend moves in the predicted direction. |
| S8 | P&ID: each loop in the registry has a bubble on its sheet, joined to its MV; hover highlights 3 elements; 0 orphan bubbles. |
| S9 | 390 and 1440, both themes, axe 0 serious, 0 page errors; reduced motion = no animated preview. |
| S10 | Red first: the gate fails on the current main (S1–S8), quoted. |

## B4. Phases

| phase | content | release |
|---|---|---|
| P0 | Registry builder + curated SPs for the chiller plant, DC AI points; gate red | — |
| P1 | SP visible: tooltip / inline, trend SP line (via `ref` or with 8a), modal Setpoints block | v3.96 |
| P2 | What-if engine recompute + before/after + FOPDT preview; chiller-plant sliders migrated | v3.97 |
| P3 | Chiller sequences + emergency mode + Simulate | v3.98 |
| P4 | P&ID loop bubbles + other equipment classes (CRAH, pumps, tower, genset/ATS, UPS, CDU, free cooling) | v3.99+ |

## B5. Ownership and peer commands (to send after approval)

- **8a (Conventional):**
  - Keep actuals (PRD-CONV-OPS-DEPTH).
  - In your release, add the keys `sp`, `spLabel` and `spSim` to `RZTrend.register`, drawn as dashed ink. I send the spec.
  - Do not add SP rows to the modal internals; the Setpoints block is mine.
- **02 (DC AI Data Hall):** no SP literals in new payloads; use `RZDatahallAIPoints.setpoint()` / the registry. Tell me before touching `points.js`.
- All sessions: SP and limits come from `data/control-points.json` only. A page never types an SP.
- The PRD is committed to `documentation/prd/PRD_SETPOINT_SIM.md`, and the path goes to the peers. Standards: new `standarization/CONTROL_SETPOINT_STANDARD.md`, plus HMI_DRAWING_STANDARD §ISA-5.1 bubbles, in the same release as P1.

## Verification

Each phase: `tools/test-setpoint-sim.mjs` red on main with quoted fails, then green; guards `run-conv-release-gates.sh` and the DC AI ship-gate set. After push: live shots at 1440 and 390, dark and light, of a modal with Setpoints and a what-if, a trend SP line and a chiller sequence simulation, looked at and sent.

## B6. P0 delivered (2026-11-23, owner R196 "Continue improve", R195 "Harus sangat accurate")

- `tools/build-control-registry.mjs` writes `data/control-points.json` (99 rows): the 33 conv limit bands, the 61 DC AI
  point classes, and 5 conv setpoints held by engine parameters (`data/control-points.curated.json`).
- **Setpoint vs reference (accuracy rule added in P0).** A value is a *setpoint* only on the equipment whose controller
  holds it: CDU for TCS supply, dry cooler for its leaving water, chiller for CHW supply, CRAH for supply air and RH,
  the dosing and blowdown controllers for water chemistry, and the five conv parameters (CHWS, CRAH supply air, rack inlet
  target, CDW supply, secondary DP). The same plane read downstream (TCS supply at a manifold or rack) is a *reference*
  with `heldBy` naming the controller; nameplate current, nominal voltage, design head and normal winding temperature are
  references. Result: 14 setpoints, 42 reference values, 84 bands, 10 monitored only. The UI writes "SP" only for a
  setpoint and "Ref" for a reference.
- A conv band's `nominal` stays a nominal; a DC AI value typed in `points.js` is ASSUMED unless the curated file says
  why it is a standard or design value (20 kV, 50 Hz, 48 VDC, pH 8.5).
- `adjustable` only with a written basis: rack inlet 18–27 °C (ASHRAE A1), secondary DP 60–140 kPa (the page range).
  CHWS and CRAH supply air are derived (they move with their drivers); CDW supply waits for a declared floor.
- Gate `tools/test-control-registry.mjs` C1–C9 (546 checks): red with no file, red on a planted value / range / role, and
  C9 red on the first classification (TCS supply called a setpoint on five classes).
- The browser law S1 (every counted number on screen has a row) is P1, when the values show their SP or Ref.


## B7. P1 delivered (2026-11-24)

- Each curated Conventional setpoint names the live points it governs (`sp.pv`) and the modal class that shows it
  (`sp.classKey`). The builder writes the browser twin `js/rz-control-points.js` (`spOf`, `tipFor`, `forClass`).
- Tooltip: `RZPointStatus.tooltipText` appends `SP 19.4 °C · <name> · <evidence>`. Trend: the pen's reference line
  is the SP, labelled in muted ink, moved off any limit label (rz-trend `refLab`). Both hooks are null-safe, and
  peer 8a agreed to both edits.
- Modal "Setpoints & limits" (chiller, CRAH, tower cell, secondary CHW pump): SP, Live, Error, alarm band,
  adjustable range, evidence, what holds it.
  - Live is the page's own value. Where the page does not show the point, it is the engine snapshot value, and
    the cell's title says which. Example: the CRAH supply air on chiller-plant shows 25.4 °C from the engine.
  - The rack inlet is shown on datahall only, so on chiller-plant its Live cell is "—".
  - On a phone the table keeps 4 columns; the rest is in the row tooltip.
- Laws (red first):
  - C10–C12 (registry gate, 585 checks): before P1 the 5 setpoints named no pv and there was no twin (7 fails).
  - S2/S3/S4 (`tools/test-setpoint-sim.mjs`, 44 checks): with no twin served, every law fails (28 fails).
  - L13 (`test-conv-trend-ranges`, 331 checks): with plant `refstack` the label lands on "H 37.0".
- Standard: `standarization/CONTROL_SETPOINT_STANDARD.md`.
- Not yet: DC AI cockpit display of its 14 setpoints (the DC AI inspector, P1b); SP sliders and the what-if
  recompute (P2).

## B8. P2 delivered, part 1: what-if in the modal (2026-11-24)

- **Slider:** every adjustable setpoint (rack inlet 18–27 °C, CHW secondary DP 60–140 kPa) has a slider in the
  equipment modal's "Setpoints & limits" section. Moving it recomputes the engine on a copy of the model with that one
  parameter changed (`CONV_CALC.recompute`), and the modal shows the outputs the registry lists: Engine now,
  SIMULATED, Change. Reset puts the SP back. Nothing is stored. Gate S5 compares every simulated value with a direct
  Node recompute (± 0.1 %).
- **Measured response, rack inlet 25.4 → 26.4 °C:**

  | Output | Now | Simulated |
  |---|---|---|
  | CHWS | 19.4 °C | 20.4 °C |
  | Lift | 20.6 K | 19.6 K |
  | Chiller input | 3212.5 kW | 3043 kW |
  | Plant COP | 9.73 | 10.27 |
  | Mechanical plant input | 4622.1 kW | 4449.9 kW |

- **What the engine does not move, said in the note instead of shown as a change:**
  - PUE is a model input (`site.pue` 1.45).
  - Secondary pump power stayed at the design duty point in engine 2.9. Engine 2.10.0 (peer 8a, v3.104.0) computes it
    at the operating head, so the DP setpoint what-if now lists pump input power, each and fleet: 95.3 / 95.6 / 96.2 kW
    each at 60 / 90 / 140 kPa. Law C13 now requires every listed output to move across the adjustable range.
- **Registry fix:** the rack inlet step was 0.5 K from 18 °C, so SP 25.4 was off the grid and a slider snapped it to
  25.5. The step is now 0.1 K, the resolution of the engine parameter. Law C5 now fails any SP or max off its grid
  (red first: "SP 25.4 or max 27 is not on the step grid 18 + k·0.5").
- **Law C13:** what-if outputs appear only on an adjustable setpoint. Each output is an engine number, and one step
  moves at least one of them. Red: listing the pump kW fails "moves none of its what-if outputs".
- **Red first:** S5 failed with "no what-if slider" on the CRAH and secondary-pump modals before the code existed.
- **Not yet in P2:**
  - FOPDT response preview. No τ/θ has a written source, so the modal says "dynamics not modelled" (S6, honest form).
  - Migration of the chiller-plant page sliders.

## B9. P3 delivered, part 1: chiller sequence of operations (2026-11-24)

- `data/sequences/chiller.json`: 10 modes (Normal lead/lag, Stage up, Stage down, Chiller trip, Loss of condenser
  water, Low evaporator flow, Low entering condenser water, High condenser water, Power failure, Emergency cooling),
  each with entry, ordered actions and exit; 3 scenarios (one chiller trips, a condenser pump trips, plant supply lost).
  Structure from ASHRAE Guideline 36-2021 (RP-1711). Plant facts from the engine: one condenser pump per chiller (so a
  condenser pump trip trips its chiller), primary-secondary with a decoupler, N+1, DP bypass at the minimum evaporator
  flow, tower 3-way holding the minimum ECWT.
- Thresholds resolved, never typed: CHWS H 20.9 / HH 22.4 °C and CDW supply H 33.5 °C from the limits registry
  (ASSUMED there), minimum evaporator flow 40 % and minimum ECWT 15 °C from the engine (ASSUMED there). Unsourced delays
  (900 s staging, 300 s CDW confirmation, 60 s CHWS HH confirmation), the 90 % stage-down hysteresis and the 120 s restart
  stagger are listed as assumed with a reason and shown "(assumed)".
- Scenario walk on the engine's plant (load 31,250 kW, 7 of 10 × 5,000 kW): a trip leaves 6 running, capacity short
  1,250 kW, CHWS rises until the standby is proven; power failure restarts 7 chillers, the last at +720 s from the return
  of supply. Part load is capped at 100 %: a chiller cannot run above its rating, the remainder is "capacity short".
- Not modelled, said so: thermal storage (none in this plant), pump ride-through on UPS, rapid-restart time, how fast
  CHWS rises.
- Modal: `js/conv/sequence-view.js` (RZConvSequence) after "Setpoints & limits" on chiller-plant.html; the path drawn
  through RZDiagram at its own size (the 10-mode list stays text: the figure budget is 9 nodes).
- Gates: `tools/test-sequences.mjs` Q1–Q5 (243 checks; red: no twin → Q5, `RZ_SEQ_PLANT=typed` → Q3,
  `orphan` → Q2); `tools/test-setpoint-sim.mjs` S7 (128 checks with S2–S5; red: `RZ_SP_PLANT=no-sequence` → S7). S4's
  Live read now takes cell and page value in one tick and allows the cell 2 s to follow a live point (the header DP
  moves every tick; a 25 s longer run read them a tick apart).
- Part 1b, same day: the builder is generic over a `fleet` (running / total / unit rating / load read from engine keys the
  JSON names, plus the PV that answers a shortfall). Added `chw_secondary_pump.json` (5 modes; header DP held at the
  registry setpoint 90 kPa, a new condition kind `setpoint` resolved from data/control-points.json; a trip leaves 3 of
  4 duty pumps, 232.4 L/s short of 982.4 L/s at design flow, header DP falls until the standby runs) and
  `tower_cell.json` (5 modes; one cell per chiller, no standby cells; a fan trip leaves 6 × 5,514 kW = 33,084 kW against
  34,462.5 kW, 1,378.5 kW short, CDW supply rises until an idle cell runs; whether the cells share one header is not
  stated by the engine and is said so). Q-gate 400 checks; S4/S7 now open the tower cell on the CH-M-102 sheet
  (176 checks).
- `crah.json` (3 modes; per hall 58 duty + 1 standby × 130 kW sensible against 7,500 kW; a failure leaves 7,410 kW,
  90 kW short, rack inlet rises until the standby runs; supply air setpoint 25.4 °C and rack inlet H 27 °C from the
  registries). Q-gate 462 checks, S-gate 194.
- Remaining for P3: Simulate driving the PV trends; sequences for genset/ATS, UPS and the DC AI CDU /
  free-cooling switchover (P4).

## P2 part 2 — chiller-plant setpoint sliders on the engine (2026-11-25)

Decisions (the builder's, owner pattern "Kamu yg tentukan"; 8a released the MAINT/slider lines of chiller-plant.html):

- **DP SP** (`#spDp`) is the engine parameter `cooling.chw_secondary_dp_setpoint_kpa`. Under the slider the page shows the
  engine's steady-state secondary pump response at that DP (`CONV_CALC.recompute` on a copy of the model, the outputs
  the registry's what-if lists: speed, drive frequency, kW each, kW running fleet), labelled SIMULATED, "Dynamics not
  modelled". At 120 kPa: 98.8 %, 96 kW each, 383.9 kW fleet (90 kPa: 98.7 %, 95.6 kW, 382.5 kW).
- **MAINT holds the steady state.** The first-order lags (0.22–0.28 per tick) and the noise on flow, loop DP and the
  secondary supply/return had no source for a time constant; they are gone. A running loop sits at the setpoints:
  flow = branch reference SP, DP = DP SP, supply = secondary SP, return = supply + engine ΔT. No FOPDT preview until a
  source states τ and θ for this loop.
- **Ranges from the first paint.** The secondary SP (primary CHWS … +4 K) and branch flow ranges were bound only when a
  scenario was picked; before that the secondary SP slider ran 0–100 and could dial a supply below the primary CHWS.
  `bindSpSliders()` now runs at boot and on every scenario. The free-run band (+1.6 K) no longer caps a MAINT setpoint.
- Not changed: the branch reference flow and the secondary SP are page quantities (the engine has no per-branch flow
  setpoint and no decoupler mixing temperature), so they carry no engine response; FREE-RUN is untouched.

Law S6 (`tools/test-setpoint-sim.mjs`): first-paint ranges = engine CHWS … +4 K; in MAINT every running loop equals the
setpoints and does not move between ticks; the DP response = a Node recompute ± 0.1 %, SIMULATED, "not modelled".
Red on v3.105.0: 10 fails (unbound ranges, loops moved 52.4 → 19.6 L/s and 103 → 112 kPa between ticks, no response).
Green: 218 checks, twice; `test-operator-cockpit-regressions` passes.

## P3 part 2 — standby generating sets (2026-11-25)

- `data/sequences/genset.json` (7 modes: on utility, utility failure, start and synchronise, on generators, set trip,
  load shedding, retransfer; basis NFPA 110-2022 + IEEE 446). Numbers from the engine: hall A facility load
  10,875 kW (`campus.halls.0.facility_load_kw`), 8 sets per hall, usable 2,400 kW each (3,000 kW × 0.8 maximum loading),
  1 spare. The fuel cockpit's rule decides who runs: on a utility loss the 7 duty sets carry the hall (64.7 % of usable),
  the spare stays on standby; a set trip leaves 6 × 2,400 = 14,400 kW ≥ 10,875 kW, no load short, and the spare
  starts. Retransfer after 30 min of stable utility is ASSUMED (no source in the repo); battery autonomy, outage length,
  start time (NFPA 110 Type 10 would be 10 s) and the shedding priority list are said to be not modelled.
- Builder: fleet quantities may be a product or a count of the engine's unit-state table; `source` (utility / gen /
  none) for a standby supply; `running: "duty" | "all"`; a step may carry a `note`. The four existing sequences walk
  exactly as before (scenarios and modes byte-identical in the twin).
- Modal: fuel-system.html loads the diagram engine, `js/rz-sequences.js` and `js/conv/sequence-view.js`; a generating
  set's modal shows the sequence ("Load on" column; "Load / usable" for a product unit).
- Laws: Q4 reads the new quantity forms independently and checks the source per step (planted "nothing carries = 0
  short" fails 4 checks); S7 now also opens GEN-A1 on fuel-system.html (red: "no Sequence of operations block" on the
  old page; a first green found an RZDiagram node overflow on "Retransfer to utility and cool-down", label shortened).
  Q-gate 583, S-gate 255.

## P3 part 3 — UPS 2N (2026-11-25)

- `data/sequences/ups.json` (6 modes: normal double conversion, stored energy, module fault, high load, static bypass,
  system lost; basis IEC 62040-3:2021 + Uptime Tier IV 2N). Per hall, as the EPMS LV sheet draws it: stream A and B,
  10,000 kW each (`ups_system_rated_kw` 40,000 / 4 halls = 8 × 1,250 kW), hall IT load 7,500 kW. Normal 37.5 %, one
  system lost 75 %: equal to the engine's `ups_load_pct_normal` and `ups_load_pct_on_failover` (a law). High load enters
  on the limits registry `electrical.ups_load_pct_normal` H 45 % (ASSUMED class shown). Battery autonomy and
  single-corded loads behind an STS are said to be not modelled.
- A first version used the campus totals (30,000 kW on 2 × 40,000 kW): the same percentages, a different scale from the
  modal's own 8 × 1,250 kW. Q4 now checks the unit against the EPMS LV sheet's UPS battery ratings (red on the campus
  unit: "unit 40000 kW ≠ the EPMS LV sheet's UPS ratings 10000,10000"). Builder: `ratio` quantity.
- EPMS_Telemetry.html loads the diagram engine and the sequence scripts (outside the deep-options block); S7 opens
  UPS-AA on the LV view (red on the old page: "no Sequence of operations block"). Q-gate 685, S-gate 290.

## P4 part 1 — control loops on the chiller-plant P&ID (2026-11-25)

- Registry: `loop` on three curated setpoints. PDIC-01 (secondary DP, reverse acting PI, PDT-01 at the most remote CRAH
  bank, drives every secondary pump VSD), TIC-CDWS (condenser water supply, direct acting PI, TT-CDWS, drives every tower
  cell fan), and the CHWS setpoint's unit controller (not drawn: inside each chiller). Basis ASHRAE Guideline 36-2021;
  tuning not modelled (no source).
- CH-M-101: PDT-01 + PDIC-01 bubbles, signals to the 5 secondary pumps; CH-M-102: TIC-CDWS in the free left column,
  signals to the 10 cells. SP from the registry, OUT = engine mean speed (98.7 % / 89.3 % at the design point).
- Accuracy finding while drawing it: the KPI "Header DP" (80 kPa) averages the primary loops' authored DPS1/DPS2 with
  noise, yet the registry named it the PV of the 90 kPa remote DP setpoint, so its tooltip said SP 90 over a value that
  can never reach it. The DP setpoint's PV is now `chiller-plant.CHW.remote_dp` (PDT-01, engine steady state = SP).
  The KPI itself (authored primary DP with noise) is left as it was and logged for the accuracy backlog.
- Gate S8, red with `RZ_SP_PLANT=no-loops` (2 fails). Hover or focus on any loop member marks PV → controller → MV
  (`data-loop` on nodes and signal lines, `.is-loop`); red with `RZ_SP_PLANT=no-loop-hover` (2 fails), green 311.
