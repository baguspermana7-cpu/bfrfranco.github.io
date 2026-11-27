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

---

# §C. Amendment 2 — control, simulation and analysis, every setpoint on both cockpits (approved 2026-11-26)

**Owner, 2026-11-26 (R197):** "Continue, kembangkan dan sempurnakan. Buat detail super detail prd" → "Kurang detail kurang massive".
**Standing:** "Harus sangat accurate" (R195), "semuanya literally semuanya" (R187).

**Status of this document.**
- §C amends `documentation/prd/PRD_SETPOINT_SIM.md`. B0–B5 and the phase notes P0 → P4 part 1 stay in force.
- §C is committed to that file in the release of its first phase.
- Every number below was measured on 2026-11-25/26 from the engines in `~/.cache/wt-sp4` (conv-engine 2.10.0, dcai-engine 1.7.0) or read from the file named beside it. Nothing below is an estimate unless it says ASSUMED.

---

## C0. Where the work stands

### C0.1 Shipped and candidate

| release | content | state |
|---|---|---|
| v3.105.0 | P0–P3 part 1: control registry, SP visible (tooltip, modal, trend SP line), what-if in the modal, chiller sequence (10 modes, 3 scenarios) | live |
| v3.106.0 a1c01cecf (peer 87) | floor flag → alarms; pump trend on the loop operating head | live |
| 0b5e8aafd (peer 87) | registry regenerated after a docs row | live |
| **v3.107.0** 214c9e150 (branch `rel107`, `~/.cache/wt-sp3`) | P2 part 2 chiller-plant sliders on the engine; P3 genset (7 modes) and UPS 2N (6 modes) sequences; P4 part 1 PDIC-01/PDT-01 + TIC-CDWS bubbles with hover | gates running (conv lane 3, DC AI 37 lane 4); before push: rebase onto 0b5e8aafd + a fresh registry build |

### C0.2 Control registry today (`data/control-points.json`, 99 rows)

| cockpit | setpoints | reference values | limits only | monitored only |
|---|---|---|---|---|
| conv | **5** (chws 19.4 °C, chw_dp 90 kPa, cdw_supply 32 °C, crah_supply_air 25.4 °C, rack_inlet 25.4 °C) | 0 | 33 | 0 |
| dcai | **9** (tcs_supply 40, htw 37/45, tcs_return 50, chiller chw 19/27 and cdw 37/43, crah air 25, rh 45, chem ×4 …) | 42 | — | 10 |

- Adjustable (slider plus what-if): 2 of 14. Both are conv: `rack_inlet_sp` and `chw_dp_sp`.
- Drawn loops: 2. PDIC-01 and TIC-CDWS. `chws_sp` is "not drawn".
- Sequences: 6 files, all conv.

| file | modes |
|---|---|
| chiller.json | normal, stage_up, stage_down, chiller_trip, loss_cdw, low_evap_flow, low_ecwt, high_cond, power_fail, emergency |
| chw_secondary_pump.json | normal, stage_up, stage_down, pump_trip, low_dp |
| crah.json | normal, crah_trip, high_inlet |
| genset.json | normal, utility_fail, start_sync, on_gen, gen_trip, load_shed, retransfer |
| tower_cell.json | normal, follow_chiller, cell_trip, high_cdw, low_ecwt |
| ups.json | normal, on_battery, module_fault, high_load, static_bypass, system_loss |

### C0.3 Gaps measured on the code (evidence, not opinion)

| # | gap | evidence |
|---|---|---|
| **G1** | The DC AI operator sees no registry setpoint. | `datahallAI.html` loads 20 `js/datahall-ai/*.js` files. Neither `points.js` nor `rz-control-points.js` is among them (`grep -c RZDatahallAIPoints datahallAI.html` = 0). The 53 DC AI records with `sp` reach only `tools/test-dcai-points.mjs`. |
| **G2** | DC AI setpoints are typed text (rule B1 broken). | `js/datahall-ai/hmi-payloads.js` has 8 literals: :406 `8.5 pH setpoint (window 8.2–8.8)`, :407 `800 µS/cm control setpoint`, :437 `45 % RH setpoint`, :702 `40 °C keep-warm setpoint`, :890 `2.5 mg/L aeration setpoint`, :899 `18 °C MMR supply setpoint`, :913 `24 °C support-room setpoint`, :914 `50 % RH setpoint`. |
| **G3** | Conv pages type their control numbers. | `fire-system.html:708` `P_JOCKEY_ON = 11.5, P_JOCKEY_OFF = 12.8`, :709 `P_FP1_ON = 10.5, P_FP2_ON = 9.5`, :710 `P_LOW_ALM = 8.5` (bar). `fuel-system.html:1190` `DT_FILL_START = 50`, `DT_FILL_STOP = 90` (% day-tank level). `cdu-mini-bms.html:680` `TCV-01 holds TT-01 = 18 °C (≥ dew point +3 °C)`, P-01 VFD on ΔP (PDT-02), no value. `water-system.html` booster lead/lag pressure: no registry row. None is in `data/control-points.json`. |
| **G4** | Unit loops are only words. | `js/conv/internals/crah.js:115` reads "The controller holds the supply-air temperature" with no bubble, no PV link, no SP. `internals/chiller.js:113` says CHWS "leaves at the plant supply set point", with no TIC. `chws_sp` and `crah_supply_air_sp` have no drawn loop. |
| **G5** | DC AI has no what-if. | `DCAI_CALC.compute(m)` derives P2…P20 from `m.thermal.tcsSupplyC` (40) and `airSupplyC` (25) (`js/dcai-engine.js:110-170`), but every DC AI row has `adjustable: null`. |
| **G6** | **The DC AI design point sits ON the free-cooling cliff, and nobody can see it.** | Design ambient 34 °C. The margin P4 = (40 − 3) − (34 + 3) = **0 K**. At 35 °C liquid free cooling ends: cooling power goes **61,187 → 106,122 kWe (+73 %)**, liquid chillers 0 → 35,405 kWe, and the worst bin runs **142 of 143 installed chillers**. Shaped bins (ASSUMED) give 8,600 of 8,760 h in free cooling. The engine knows this (`pue.free_cooling_cliff_ambient_c = 34`). No screen shows it as a control fact. |
| **G7** | No DC AI sequence. | Free-cooling switchover is binary in the engine (`liquidFreeCooling = margin >= 0`, :118), with no hysteresis and no transition. There is no CDU duty/standby failover sequence (engine: 54 duty + 1 standby per hall). |
| **G8** | Simulate does not move any trend. | `js/conv/sequence-view.js` reveals steady-state steps in a table. B2.5 promised "the PV trends show the response". |
| **G9** | Conv loops run at saturation, unreported. | CRAH valve `cooling.crah_valve_open_pct` 99.5 %, CRAH fan 99.5 %, secondary pumps 98.7 %, tower fans 89.3 %, chiller speed 89.3 % (min 60 %). A loop at 99.5 % output has 0.5 % authority left: one more kW of load and the PV leaves the SP. No screen says so. |
| **G10** | The engine clamps at copMax, silently. | DC AI P19 liquid-path COP = **12.00 at 35 and 36 °C ambient**: the `copMax: 12` ceiling, not the Carnot × 0.55 result. A clamped value is shown as if computed. |
| **G11** | Gate blind spot. | PDT-01 value at `dx -24, dy 16` sat on the CHW supply riser (screenshot `p4-101-sec.png`), yet `test-conv-sheet-text-clear.mjs` C1 passed (run baymtt2nj). Cause unknown; to be found, not assumed. |
| **G12** | KPI "Header DP" is authored. | Mean of the primary DPS1/DPS2 with `r(-3,3)` noise (80 kPa). It is not the remote DP that PDIC-01 controls (90 kPa) and not the primary operating DP (`cooling.chw_primary_pump_dp_op_kpa` 117.3 kPa). |

---

## C1. Principles (binding on every phase)

1. **One implementation per concept, both cockpits.**

   | concept | the one implementation | changes in §C |
   |---|---|---|
   | registry | `data/control-points.json` ← `tools/build-control-registry.mjs`; twin `js/rz-control-points.js` | — |
   | SP block | `spBlock` | moves out of `js/conv/equipment-modal.js` into new `js/rz-sp-block.js`; conv and DC AI both call it |
   | what-if | engine recompute | conv `CONV_CALC.recompute`; DC AI `DCAI_CALC.compute(clone)` |
   | sequence | `data/sequences/*.json` + `RZConvSequence` | the file stays at `js/conv/sequence-view.js`; it is cockpit-agnostic by data |
   | loop drawing | `instField`/`instPanel` symbols + `w:'signal'` edges + `loop:` tags in `rz-hmi-sheet.js` | — |
2. **A page never types a control number.** SP, cut-in, cut-out, fill start/stop and alarm thresholds come from the registry. A static gate counts typed control numbers per page; the ratchet may only fall, and must reach 0.
3. **No invented dynamics.** No τ, θ, Kp, Ti or ramp rate has a written source. Every simulated response is a sequence of steady states. The x-axis is "step", the label reads "dynamics not modelled", and nothing animates as if it were time.
4. **Ranges need a basis.** A slider range cites a standard or the plant design. Otherwise it is `ASSUMED` and the UI shows that word next to the range.
5. **Clamps and saturation are shown, never hidden.** An engine value that hit a ceiling (copMax, 100 % speed, valve 100 %) carries a mark `◆ at limit` and the limit's source.
6. **Simulated is labelled.** The word SIMULATED appears on every what-if number, every overlay pen and every sequence step. Reset restores live exactly. Nothing is written to localStorage, sessionStorage or Supabase.
7. **Peer files stay peer files.** A peer file gets an exact spec message; my gate proves the result. The peer files are `hmi-payloads.js`, `equipment-inspector.js`, `datahallAI.html` (outside script tags), `rz-trend.js`, `point-status.js`, the DC AI engine, the conv engine and the chiller-plant KPI row.
8. **Every phase:**
   - red before green, with the failing line quoted;
   - full conv release gates plus the DC AI 37;
   - shots at 1440/390 × dark/light, looked at by me;
   - live check after push;
   - standards doc and changelog in the same release.

---

## C2. The full inventory: every control number on both cockpits (target state)

Each row lists the target registry id, its current home and value, and the phase that moves it. "Loop" means a drawn bubble.

### C2.1 Conventional

| target id | what | value now | where it lives today | basis | phase | loop |
|---|---|---|---|---|---|---|
| conv.chiller-plant.chws_sp | CHW supply | 19.4 °C | engine derived (crahSupplyAir − coil approach 6 K) | engine | done (P1) | **P4b** TIC-CHWS on chiller internals |
| conv.chiller-plant.chw_dp_sp | secondary remote DP | 90 kPa | registry, adjustable | design ASSUMED | done | done PDIC-01 |
| conv.chiller-plant.cdw_supply_sp | CDW supply | 32 °C | registry | design | done | done TIC-CDWS |
| conv.datahall.crah_supply_air_sp | CRAH supply air | 25.4 °C | engine derived | ASHRAE TC9.9 A1 18–27 °C | done (P1) | **P4b** TIC-SAT on CRAH internals |
| conv.datahall.rack_inlet_sp | rack inlet (cascade master) | 25.4 °C | registry, adjustable | TC9.9 A1 | done | **P4b** cascade TIC-RI → TIC-SAT (modal) |
| conv.chiller-plant.chiller_min_speed | chiller minimum speed | 60 % | engine authored | vendor ASSUMED | **P9** | — |
| conv.fire.jockey_on / jockey_off | jockey start / stop | 11.5 / 12.8 bar | `fire-system.html:708` typed | NFPA 20 §14.2.6 practice (jockey stop at churn + static, start ≥ 0.7 bar above main pump start); values page design | **P9** | **P9** PSL/PSH on fire sheet |
| conv.fire.fp1_on / fp2_on | main pump 1 / 2 start | 10.5 / 9.5 bar | `fire-system.html:709` typed | NFPA 20 staggered start | **P9** | PS on fire sheet |
| conv.fire.low_pressure_alarm | low header pressure alarm | 8.5 bar | `fire-system.html:710` typed | design | **P9** | — |
| conv.fuel.day_tank_fill_start / stop | day tank refill start / stop | 50 / 90 % | `fuel-system.html:1190` typed | NFPA 110 / NFPA 30 practice, values ASSUMED | **P9** | **P9** LIC per day tank on fuel sheet |
| conv.water.booster_pressure_sp | booster discharge pressure | to read in P9 step 1 | `water-system.html` lead/lag block | design | **P9** | **P9** PIC on water sheet |
| conv.cdu-mini.tcv01_tt01_sp | CDU secondary supply (TCV-01 holds TT-01) | 18 °C | `cdu-mini-bms.html:680` typed text | dew point + 3 K (text cites it) | **P9** | **P9** TIC on cdu-mini sheet |
| conv.cdu-mini.p01_dp_sp | P-01 VFD on ΔP (PDT-02) | no value shown | `cdu-mini-bms.html:680` | — | **P9**: value from the cdu-mini model, else "not modelled" | PDIC |

### C2.2 DC AI

| target id | what | value now | where | phase |
|---|---|---|---|---|
| dcai.cdu/tcs_supply_c | TCS supply (CDU HX valve) | 40 °C | engine plane p07, registry | **P5** visible, **P6** adjustable 30–45 |
| dcai.crah/air_supply_c | fan-wall supply air (CHW valve) | 25 °C | plane p09 | **P5**, **P6** adjustable 18–27 |
| dcai.chiller/chw_supply_c | chiller leaving CHW | 19 °C | plane p12 (= p09 − 6 K) | **P5** (derived, not adjustable) |
| dcai.dry-cooler/leaving_c | dry cooler leaving water | 37 °C | plane p02 (= ambient + 3 K) | **P5**; it follows ambient, so it is a reference, not an SP |
| dcai.crah/supply_rh | supply RH | 45 % | `hmi-payloads.js:437` typed | **P5** |
| dcai.chem/ph, conductivity, orp, inhibitor_ppm | dosing control points | 8.5 / 800 µS/cm / 450 mV / 120 ppm | registry, plus 2 typed at :406-407 | **P5** |
| dcai.genset/jacket_c | keep-warm | 40 °C | `hmi-payloads.js:702` typed | **P5** (new row, NFPA 110 keep-warm practice, ASSUMED) |
| dcai.wwtp/do_mgl | aeration DO | 2.5 mg/L | :890 typed | **P5** (new row, ASSUMED) |
| dcai.mmr/supply_c | MMR supply air | 18 °C | :899 typed | **P5** (new row, ASSUMED) |
| dcai.support/temp_c, rh_pct | support rooms | 24 °C / 50 % | :913-914 typed | **P5** (new rows, ASSUMED) |

**Count target after P5 + P9:**
- registry setpoints: 14 → **≥ 31**;
- typed control numbers on pages: 18 → **0**;
- drawn loops: 2 → **≥ 10**.

---

## C3. Phases

Each phase below is one release, in this order.
- Conv-only phases ship through `run-conv-release-gates.sh`.
- DC AI phases ship through the DC AI 37 plus their own gate.

### P4b — unit loops and the cascade (conv)

**Goal:** every conv setpoint that has a controller shows that controller as an ISA-5.1 bubble on the drawing where its instruments are, or says why not.

**Content.**

| loop | where drawn | PV (engine, value) | controller | MV (engine, value) | action |
|---|---|---|---|---|---|
| TIC-CHWS | chiller internals mini-sheet (`js/conv/internals/chiller.js`), beside node `chws` (404, 450) | TT at CHWS OUT = `cooling.chws_c` 19.4 °C | TIC in the unit panel, PI | compressor capacity = `cooling.chiller_speed_pct` 89.3 % (floor 60 %) | direct: PV above SP → more capacity |
| TIC-SAT | CRAH internals (`js/conv/internals/crah.js`) | supply-air TT = `cooling.crah_supply_air_c` 25.4 °C | TIC, PI | CHW valve = `cooling.crah_valve_open_pct` **99.5 %** | reverse on cooling (PV above SP → open) |
| TIC-RI → TIC-SAT | not drawn (`datahall.html` has no P&ID; floor-plan.js is peer read-only) | rack inlet = `cooling.rack_inlet_target_c` 25.4 °C | cascade master; contained aisle, 0 K mixing, so slave SP = master SP | TIC-SAT SP | modal only, `notDrawn: 'no P&ID on the data hall page; the cascade sets TIC-SAT'` |

**Registry changes** (`data/control-points.curated.json` → `convSetpoints`):

```json
"conv.chiller-plant.chws_sp": { "loop": { "tag": "TIC-CHWS", "sheet": "int-chiller", "kind": "PI", "action": "direct",
   "pv": { "tag": "TT-CHWS", "node": "chws" }, "mv": { "classKey": "chiller", "what": "compressor capacity (VSD speed)" },
   "tuning": null, "tuningNote": "no source for Kp/Ti", "basis": "ASHRAE Guideline 36-2021 §5.20 (plant), vendor unit control" } },
"conv.datahall.crah_supply_air_sp": { "loop": { "tag": "TIC-SAT", "sheet": "int-crah", "kind": "PI", "action": "reverse",
   "pv": { "tag": "TT-SA", "node": "<crah supply node>" }, "mv": { "classKey": "crah", "what": "CHW valve" }, … } },
"conv.datahall.rack_inlet_sp": { "loop": { "tag": "TIC-RI", "kind": "cascade", "slave": "TIC-SAT", "sheet": null,
   "notDrawn": "no P&ID on the data hall page; the master resets TIC-SAT" } }
```

`tools/build-control-registry.mjs` validates:
- `kind ∈ {PI, PID, cascade, staging, on-off}`;
- a `cascade` has `slave` naming an existing loop tag;
- a sheet `int-<class>` names an existing internals file.

**UI — internals mini-sheet** (the modal "Inside" view; same symbol grammar as CH-M-101):

```
  CHWR IN ──▶ [ evaporator ]──▶ CHWS OUT ◀─TT─┐
                                      19.4 °C  ┆ (impulse)
                                          ╭────┴───╮
                                          │  TIC   │  TIC-CHWS
                                          │ CHWS   │  SP 19.4 °C
                                          ╰───┬────╯  OUT 89.3 %
                                              ┆ signal (dashed)
                                     [ compressor VSD ]  89.3 %  (min 60 %)
```

- Hover: TT, TIC, VSD and the two dashed lines take `.is-loop`.
- Double-click TIC: the modal Setpoints block opens with the loop line "PV TT-CHWS → TIC-CHWS → MV compressor capacity · direct PI · tuning not modelled · basis …".

**UI — modal Control block for the cascade** (`js/conv/equipment-modal.js` → `rz-sp-block.js`):

```
Control
  TIC-RI (rack inlet, cascade master)  SP 25.4 °C
     └─ sets TIC-SAT (CRAH supply air)  SP 25.4 °C   contained aisle, 0 K mixing
            └─ CHW valve  OUT 99.5 %   ◆ 0.5 % authority left   (see P10)
  Not drawn: no P&ID on the data hall page.
```

**States:** live; MAINT (the SP slider of rack inlet moves both SPs, the TIC-SAT SP follows within the same tick); reduced motion (no hover transition, the class change is instant); dark and light; 390 px (the internals sheet scrolls inside the modal, no page side-scroll).

**Laws** (extend `tools/test-setpoint-sim.mjs`):

| law | claim | red condition |
|---|---|---|
| S8b | Opening the chiller and CRAH modals → Inside, each internals loop in the registry has exactly one controller bubble. Its OUT = engine (89.3 %, 99.5 % ± 0.1). Its PV link and MV link exist. Hover marks PV + controller + MV + ≥ 2 signal lines. | `RZ_SP_PLANT=no-loops` → 0 bubbles |
| S8c | The cascade row prints master → slave, and slave SP = master SP. A rack inlet what-if of +1 K moves both by +1 K. | plant slave SP + 1 K |
| S8d | 0 orphan bubbles: every bubble tag on any conv sheet or internals view is a registry loop. | plant a typed `TIC-X` |
| keep | `test-conv-internals-render.mjs`, `test-conv-plant-internals.mjs`, `test-conv-internals-p3/p4.mjs`, text-clear C1–C5, geometry, point-coverage (unclassified 0) | — |

**Files:**
- `data/control-points.curated.json`
- `tools/build-control-registry.mjs`
- `js/rz-control-points.js` (generated)
- `js/conv/internals/chiller.js`
- `js/conv/internals/crah.js`
- `js/conv/equipment-modal.js`
- new `js/rz-sp-block.js`
- `tools/test-setpoint-sim.mjs`
- `standarization/CONTROL_SETPOINT_STANDARD.md` §4b (internals, cascade)
- HMI_DRAWING_STANDARD (loop on internals)
- CHANGELOG and version files

**Done when:**
- every law above is green and red-proven;
- shots of both internals views and the cascade block, both themes, at 1440 and 390, have been looked at.

### P5 — DC AI setpoints visible (closes G1, G2)

**Goal:** a DC AI operator sees, for every unit class, what each controller holds, the live value, the error and the limits, all from the registry. No setpoint is typed on the page.

**Content:**

1. `datahallAI.html` loads `js/rz-control-points.js` after `hmi-points.js`. It is one `<script>` tag. The page owner adds it, or I add it after their ack; the token comes with it.
2. `js/rz-sp-block.js`:
   - `RZSpBlock.render(host, rows, opts)` returns HTML;
   - `bind(host)` wires the sliders and what-if;
   - each row = { id, label, value, unit, role, ev, pv, holder, limits, adjustable, whatIf };
   - it is shared with conv (P4b extraction).
3. **DC AI inspector block.**
   - `equipment-inspector.js` calls `RZSpBlock.render` with `RZControlPoints.forClass('dcai:' + cls)` for the opened unit's class (cdu, crah, chiller, dry-cooler, cw-pump-station, fws-pump-station, chem, rack-manifold, tcs-manifold).
   - Live PV from `DCAI_CALC.snapshot()`.
   - Error = PV − SP.
   - Limits resolved by `RZDatahallAIPoints.limits(id, snap)` (relative to SP).
   - Holder from `dcaiPlaneController` ("the CDU holds TCS supply with its HX control valve").
4. **Typed literals out** (spec to the `hmi-payloads.js` owner, exact diff in the message):
   - **Before:** `{ value: 45, text: '45 % RH setpoint' }`.
   - **After:** `{ value: SP('dcai.crah/supply_rh'), text: SPT('dcai.crah/supply_rh') + ' setpoint' }`, where `SP = RZControlPoints.value` and `SPT` formats value plus unit.
   - The 8 lines are listed in C2.2.
   - The 5 new rows (jacket keep-warm, DO, MMR supply, support-room temp and RH) go into `points.js` with evidenceClass ASSUMED and a written basis line each. `points.js` is mine (registry); it is announced to peer 02/87 first.
5. **DC AI trends:** a point with an SP gets `ref`/`refLabel = 'SP 40.0 °C'` (the hook already used on conv).

**UI — DC AI inspector, desktop:**

```
CDU-07 · coolant distribution unit                                   [×]
Setpoints & limits                                         source: registry
 point          SP        live      error    warn / alarm    holder / evidence
 TCS supply     40.0 °C   40.2 °C   +0.2 K   41.0 / 43.0     CDU HX valve · DESIGN
 HTW supply     37.0 °C   37.0 °C    0.0 K   ±1.5 / ±3.0     dry cooler (ref) · DESIGN
 TCS return     50.0 °C   50.1 °C   +0.1 K   51.5 / 53.0     — (result of load) · DESIGN
 DP             1.8 bar   …                                  CDU pump VSD · ASSUMED
 ⓘ limits are relative to the setpoint; basis: ASHRAE TC9.9 W45 ceiling
```

- **Phone (390):** one card per point (SP, live, error on one line; limits and holder in the ⓘ tooltip), per owner taste "less visible text".

**Laws** (new `tools/test-dcai-setpoints.mjs`; serves the page through `audit-conv-text.mjs serve`, drives the inspector the way `test-dh-hall.mjs` does):

| law | claim | red today |
|---|---|---|
| D1 | For each of 9 classes, opening one unit shows the block. Each SP = `RZControlPoints.value` ± 0 (tcs 40, crah air 25, chiller chw 19 …). Live = snapshot ± display rounding. | block absent |
| D2 | Static: 0 control numbers next to the word setpoint in `js/datahall-ai/*.js` outside `RZControlPoints` calls. | 8 |
| D3 | A DC AI trend of a point with an SP draws one SP line at that value. | none |
| D4 | 390 and 1440, dark and light: axe 0 serious, 0 page errors, no sideways scroll, block text ≥ 11 px. | — |

**Risks:**
- `datahallAI.html` is large and peer-edited daily. The change is one script tag only.
- The inspector is shared with the hall iso view (peer A5d/A5e). The block is appended below the existing rows, behind `if (window.RZSpBlock)`.

### P6 — DC AI what-if, with the free-cooling cliff made visible (closes G5, G6)

**Goal:** the operator can move the TCS supply SP or the fan-wall supply-air SP and see, from the engine, what that does to free cooling, chillers, power and PUE. The cliff at 34 °C is visible as a control fact.

**Adjustable:**

| id | range | step | basis |
|---|---|---|---|
| dcai.cdu/tcs_supply_c | 30–45 °C | 0.5 | upper: ASHRAE TC9.9 liquid cooling W45 (facility water ≤ 45 °C); lower: dew-point margin, ASSUMED (labelled) |
| dcai.crah/air_supply_c | 18–27 °C | 0.5 | ASHRAE TC9.9 A1 recommended inlet; contained aisle, rack inlet = supply |

**Recompute:**
- `DCAI_CALC.compute(clone(m))` with `m.thermal.tcsSupplyC` or `airSupplyC` replaced.
- `DCAI_CALC.model` is exported, so the engine is not edited (peer read-only). The clone is a structured copy; the live model is never mutated.

**What the engine says (measured, these numbers go into the gate as worked checks):**

| TCS SP | switchover ambient (cliff) | free-cooling hours (shaped bins, ASSUMED) | annual PUE | design-day PUE | liquid chillers at 34 °C |
|---|---|---|---|---|---|
| 35 °C | 29 °C | 4,200 h | 1.2005 | 1.2572 | 40,771 kWe |
| 38 °C | 32 °C | 8,000 h | 1.1640 | 1.2468 | 35,405 kWe |
| **40 °C (design)** | **34 °C** | **8,600 h** | **1.1583** | **1.1652** | **0 (margin 0 K)** |
| 42 °C | 36 °C | 8,760 h | 1.1569 | 1.1652 | 0 |
| 45 °C | 39 °C | 8,760 h | 1.1569 | 1.1652 | 0 |

| air SP | CHW supply | air-path COP | air chillers | cooling power |
|---|---|---|---|---|
| 18 °C | 12 °C | 4.33 | 32,834 kWe | 68,515 kWe |
| 22 °C | 16 °C | 4.94 | 28,779 kWe | 64,283 kWe |
| **25 °C (design)** | 19 °C | 5.50 | 25,811 kWe | 61,187 kWe |
| 27 °C | 21 °C | 5.95 | 23,867 kWe | 59,157 kWe |

The design-ambient sweep at TCS 40 °C is the cliff itself:

| ambient | margin P4 | mode | liquid chillers | cooling power | COP P19 |
|---|---|---|---|---|---|
| 24 °C | +10 K | free | 0 | 51,899 kWe | — |
| 30 °C | +4 K | free | 0 | 57,472 kWe | — |
| **34 °C** | **0 K** | **free (edge)** | **0** | **61,187 kWe** | — |
| 35 °C | −1 K | mechanical | 35,405 kWe | 106,122 kWe | **12.00 ◆ copMax** |
| 36 °C | −2 K | mechanical | 35,405 kWe | 107,051 kWe | **12.00 ◆ copMax** |
| 38 °C | −4 K | mechanical | 37,602 kWe | 111,201 kWe | 11.30 |
| 40 °C | −6 K | mechanical | 42,616 kWe | 118,290 kWe | 9.97 |

**UI — DC AI inspector, CDU, what-if panel:**

```
What if TCS supply were …                                  SIMULATED · engine recompute
  [30 ───────●──────── 45] 41.0 °C   range: TC9.9 W45 ceiling; lower bound ASSUMED
                         live 40.0     →  sim 41.0
  free-cooling margin    0.0 K         →  +1.0 K
  cliff ambient          34 °C         →  35 °C        ┌ ambient ───────────────┐
  liquid chillers        0 kWe         →  0 kWe        │ 24 ▮▮▮▮▮▮▮▮▮▮ free      │
  cooling power          61,187 kWe    →  61,187 kWe   │ 34 ▮ edge (design)      │
  annual PUE             1.1583        →  1.15xx       │ 35 ▯ mechanical  +73 %  │
  design-day PUE         1.1652        →  1.1652       └─────────────────────────┘
  dynamics not modelled · nothing saved                 [Reset]
```

- **Cliff strip:** one row per weather bin (7 bins, hours), filled when in free cooling at the simulated SP. The design-ambient row is outlined. Ink only, no colour band; the alarm colour is used only for the bins that become mechanical.
- **Phone:** the slider plus the 5 key rows; the strip collapses into a `details` element.
- **Keyboard:** arrow keys step 0.5 K, with no animation (MOTION frequency rule).

**New mark (closes G10):** wherever P19 equals `copMax`, the value shows `12.00 ◆` with the tooltip "engine ceiling copMax = 12 (model input), not the Carnot × 0.55 result". This applies to the inspector, the what-if and the trend label.

**Laws** (`tools/test-dcai-setpoints.mjs`):

| law | claim | red condition |
|---|---|---|
| D5 | Every what-if row = a direct Node `DCAI_CALC.compute(clone)` ± 0.1 % for TCS 35/38/40/42/45 and air 18/22/25/27 (the tables above). | plant an inspector that recomputes with the live SP |
| D6 | The cliff ambient moves 1:1 with TCS SP (`tcs − cduApproach − dryCoolerApproach`): 40 → 34, 41 → 35. | plant +0.5 K offset |
| D7 | Reset restores every live number exactly; 0 writes to localStorage, sessionStorage or Supabase (requests intercepted). | plant a `localStorage.setItem` |
| D8 | Wherever P19 is clamped, the value carries `◆` and the copMax tooltip. | today: no mark |
| D9 | 390 and 1440, both themes: axe 0 serious; the slider is reachable and operable by keyboard; reduced motion = no transitions. | — |

### P7 — DC AI sequences of operations (closes G7)

**Goal:** the operator can read and step through what the DC AI plant does as ambient rises, a CDU pump trips, or the fan wall loses a unit, with the engine's numbers at each step.

**Files:** new `data/sequences/dcai-heat-rejection.json`, `dcai-cdu.json` and `dcai-fan-wall.json`. They use the same schema, validated by `tools/build-sequences.mjs`, and quantity forms key / minus / product / ratio / count.

**`dcai-heat-rejection.json`** (dry coolers + trim chillers on the liquid loop):

| mode | entry | actions in order | exit | basis |
|---|---|---|---|---|
| free_cooling | margin P4 ≥ 0 K (`design.planes.p04_free_cooling_margin_k`) | dry coolers hold HTW at P2 = ambient + 3 K; trim chillers off; HTW = P2 | margin < 0 K | ASHRAE 90.4 economizer intent |
| edge | 0 ≤ P4 < 1 K (deadband 1 K, ASSUMED) | alarm "free-cooling margin < 1 K"; pre-start one trim chiller (vendor practice, ASSUMED) | P4 ≥ 1 K or < 0 | ASSUMED, labelled |
| mechanical | P4 < 0 K | trim chillers make HTW at P3 = TCS SP − 3 K = 37 °C; dry coolers reject condenser heat; liquid chiller kWe from engine (35,405 at 35 °C) | P4 ≥ +1 K (hysteresis 1 K, ASSUMED) | engine |
| high_ambient | ambient > design 34 °C | alarm; chillers running = engine worst-bin count (142 of 143) | ambient ≤ design | engine |
| dry_cooler_loss | one dry cooler trips | running = engine design count 593 of 631 installed, so 38 spare cover the loss; if the engine has no per-unit derate: "margin effect not modelled" | unit back | engine counts |

- **Scenario `ambient_rise`:** 24 → 30 → 34 → 35 → 38 °C. Each step is a full `DCAI_CALC.compute` with `designAmbientDbC` set; the numbers are the table in P6.
- **Scenario `dry_cooler_trip`:** normal → loss → standby in.

**`dcai-cdu.json`:**

| mode | entry | actions | exit |
|---|---|---|---|
| normal | — | 54 duty + 1 standby per hall (engine), load 98.3 %, pump 98.9 % | — |
| duty_trip | a duty CDU trips | standby starts; load per unit stays 98.3 % because the count is restored | tripped unit repaired |
| low_flow | TCS flow < rated (1,500 L/min per unit, engine) | alarm | flow restored |
| high_tcs | TCS supply > SP + 3 K (registry alarm, never typed) | alarm; rack throttling is "not modelled" | below SP + 1 K |
| leak | leak zone active (existing `LEAK-Zxx` points) | isolate the row manifold (text from the existing payload) | reset |
| facility_water_loss | HTW flow lost | the CDU cannot reject heat; TCS rises; time to limit "not modelled" | restored |

- **Scenario `duty_trip`.**

**`dcai-fan-wall.json`:**
- normal: 89 duty + 1 standby per hall, fan 99.7 %.
- trip: standby in.
- high_inlet: alarm from the registry.

**Where:**
- the dry cooler, CDU and fan-wall inspectors, block "Sequence of operations", rendered by `RZConvSequence.render/bind`;
- `datahallAI.html` adds `js/rz-sequences.js` + `js/conv/sequence-view.js` (2 tags, after P5's tag).

**Laws:**

| law | claim | red condition |
|---|---|---|
| Q1–Q4 | extended to the 3 files (entry / actions / exit + basis; graph connected; no typed threshold, assumed values listed; scenario walk) | — |
| S7-DC1 | Simulate `ambient_rise`: the mode changes free → edge → mechanical at the engine cliff (34 °C ± 0); each step's cooling power = engine ± 0.1 %. | today: no block |
| S7-DC2 | Simulate `duty_trip`: running count stays 54, standby 0 after the step. | — |
| S7-DC3 | The edge and hysteresis rows show "ASSUMED". | plant one without the word |

### P8 — Simulate drives the PV trends (closes G8)

**Goal:** stepping through a sequence makes the named process values move on their own trends, as SIMULATED pens, so the system response is readable.

**Mechanism:**
1. Each sequence step already carries steady-state quantities. `sequence-view.js` maps each named quantity to its point id: conv through `data-point` ids, DC AI through `points.js` ids.
2. **Hook in `rz-trend.js`** (peer-owned, agreed hooks only; spec sent to peer 87):
   ```
   RZTrend.overlay(pointId, { rows: [{ x: stepIndex, v }], label: 'SIMULATED · step n/N', kind: 'sim' })
   RZTrend.clearOverlay(pointId)   // and clearOverlay() for all
   ```
   - Drawn as a second ink pen, dashed, its x axis labelled "step".
   - The real trend keeps its time axis in its own small multiple. It is never a dual axis, per the trend design rules.
3. **Fallback until the hook ships:** the sequence block draws its own step strip, one small multiple per named PV (≤ 4), as plain SVG from `sequence-view.js`, using the trend's nice-tick rules (copied as a 20-line function with a comment pointing to `rz-trend.js`). There is no chart library.
4. Reset clears every overlay and strip.

**UI — step strip in the sequence block:**

```
Simulate · loss of CDW · step 3 of 5            SIMULATED · dynamics not modelled
 CDW supply °C   32 ─●──●──●╮                      x = step, not time
                             ╰●──● 37.0 (step 4)
 chiller lift K  20.6 ─●──●──●──●╮
                                  ╰● 26.x
 [◀ step] [step ▶] [Reset]
```

**Laws** (S7 extended):

| law | claim | red condition |
|---|---|---|
| S7d | After Simulate of chiller `loss_cdw`, the CDW supply and chiller lift strips (or trend overlays) have N points = steps. The last value = the final step's engine value ± 0.1 %. | today: no pen |
| S7e | Reset leaves 0 overlays and 0 strips. | plant leftover |
| S7f | Reduced motion: no animated reveal. Keyboard step: no animation. | — |
| S7g | No pen is labelled with a time unit (the x-axis text is "step"). | plant "min" |

### P9 — conv typed control numbers into the registry (closes G3)

**Goal:** "literally everything". Every control number on fire, fuel, water and cdu-mini comes from the registry, carries a basis and has a loop where a controller exists.

| page | numbers | registry rows | loop drawn |
|---|---|---|---|
| fire-system | jockey on/off 11.5/12.8 bar; FP1/FP2 start 10.5/9.5 bar; low alarm 8.5 bar | 5 rows, `fire.*`, basis NFPA 20 (staggered start, jockey above main start), values = page design ASSUMED | PSL/PSH pressure switches on the fire sheet joined to the jockey / FP1 / FP2 starters (on-off, not PI) |
| fuel-system | day tank fill start/stop 50/90 % | 2 rows, basis NFPA 110 / 30 practice, ASSUMED | LIC per day tank → fill valve XV / pump (on-off with differential 40 %) |
| water-system | booster lead/lag discharge pressure (value read in step 1) | 1–2 rows | PIC → booster VSD |
| cdu-mini-bms | TCV-01 holds TT-01 18 °C (dew point + 3 K); P-01 VFD on ΔP PDT-02 | 2 rows (the ΔP value from the cdu-mini model, else "not modelled") | TIC → TCV-01; PDIC → P-01 |

- The pages read the registry: `fire-system.html:708` becomes `var P_JOCKEY_ON = CP.value('conv.fire.jockey_on')` and so on.
- The state machine and the drawn thresholds keep using one constant source (the existing comment at :1263 requires it).
- **New static gate:** `tools/test-typed-control-numbers.mjs`.
  - It scans the conv pages and `js/conv/*.js` for numeric literals bound to names matching `/(_ON|_OFF|START|STOP|SETPOINT|_SP)\b/` or text "… setpoint".
  - Ratchet: per-page counts may only fall, and the target is 0.
  - Red today: fire 5, fuel 2, cdu-mini 1 (+ DC AI 8 from P5).

**Laws:**
- **T1:** ratchet 0 on the 4 pages.
- **T2:** each new row shows in the page tooltip, modal and trend SP line (S2/S3 extended to fire, fuel, water, cdu-mini).
- **T3:** the fire pressure state machine starts the jockey at the registry value. Plant jockey_on 11.0 → the jockey starts at 11.0 in the sim.
- **S8e:** the new loops pass S8 (bubble, PV, MV, hover, no orphan).

### P10 — control authority and saturation (closes G9) — the "analyse the system response" view

**Goal:** for every drawn loop, show how much output is left before the controller can no longer hold its SP, and flag a loop that sits saturated.

- **Authority** = `100 − OUT %`, for a direct-acting output toward 100 %, and correspondingly for the minimum.
- **Measured today:**

| loop | OUT now | authority left |
|---|---|---|
| TIC-SAT CRAH valve | 99.5 % | 0.5 % |
| PDIC-01 secondary pumps | 98.7 % | 1.3 % |
| TIC-CDWS tower fans | 89.3 % | 10.7 % |
| TIC-CHWS chiller speed | 89.3 % | 10.7 % above, 29.3 % above the 60 % floor |
| DC AI CDU pumps | 98.9 % | 1.1 % |
| DC AI fan wall | 99.7 % | 0.3 % |
- **Saturation flag:** OUT ≥ 98 % (or ≤ the MV minimum + 2 %). The 2 % band is ASSUMED and labelled. The mark `◆ saturated`, with the tooltip "the controller cannot raise its output further; one more unit of load moves the PV off SP. Remedy in the design: …" (a stage-up rule from the sequence, if any).
- **Where:**
  - the bubble's OUT line (`OUT 99.5 % ◆`);
  - the modal Control block (`◆ 0.5 % authority left`);
  - a new compact "Loops" table on chiller-plant and in the DC AI inspector header: loop, SP, PV, error, OUT, authority, state.
- **What-if link:** in the rack inlet what-if, the CRAH valve and fan OUT after the change are shown. Lowering rack inlet 25.4 → 24.4 °C needs more coil capacity, so the valve would exceed 100 %. The engine's response is shown ("units required 58 → n" if the engine re-stages; else "cannot hold, not modelled").
- **This phase is analysis only.** It changes no engine.

**Laws** (`tools/test-setpoint-sim.mjs` S11):

| law | claim | red condition |
|---|---|---|
| S11a | Each drawn loop's authority = 100 − engine OUT ± 0.1. | plant a typed OUT |
| S11b | Loops with OUT ≥ 98 % carry `◆` (today: TIC-SAT, PDIC-01, DC AI CDU, fan wall). | today: none |
| S11c | The Loops table row count = registry loop count on that page. | — |

### P11 — accuracy and gate debt (closes G10 rest, G11, G12)

- **G11 (text over pipe).**
  - Reproduce: `RZ_TEXT_CLEAR_PLANT=pdt-riser` moves the PDT-01 value to `dx -24, dy 16`.
  - Find why C1 passed. Candidates to test one at a time: the riser path class (`hmi-edge` vs overlay), LOD hiding the value at the gate's zoom, the sampling step vs a 4 px riser, the text bbox from `getBBox` vs the rendered box.
  - Fix the gate. Red on the plant, green on the current position, and the 5 conv sheets stay green.
- **G12 (KPI Header DP).**
  - Bind the KPI to an engine quantity with an honest label. Two choices:
    - "Remote DP (PDT-01) 90 kPa", the quantity the loop controls;
    - "Primary loop DP 117.3 kPa" (`cooling.chw_primary_pump_dp_op_kpa`).
  - Recommended: the remote DP, since the KPI row sits under the secondary loop.
  - The noise goes.
  - This row is the peer's chiller-plant area: I send a spec; they ship it, or ack me.
  - **Law:** `probe-accuracy-validation.mjs` gains "Header DP KPI = engine ± 0"; it is red today.
- **G10:** the copMax mark is covered in P6 (D8).

---

## C4. Shared component spec: `js/rz-sp-block.js`

**API (UMD, Node-testable core):**

```
RZSpBlock.rows(classKey, ctx)        → [{ id, label, unit, sp, pv, err, limits:{loW,loA,hiW,hiA,db,delay}, ev, source,
                                          holder, loop:{tag,pv,mv,action,kind,tuning,basis,slave}|null,
                                          adjustable:{min,max,step,basis}|null, whatIf:{param, engine:'conv'|'dcai'}|null,
                                          authority:{out, left, saturated}|null }]
RZSpBlock.render(rows, { compact })  → HTML string (escaped; textContent for every value)
RZSpBlock.bind(host, { recompute })  → wires sliders (input → recompute → before/after), Reset, keyboard steps
```

**Copy rules:**
- Units always shown.
- Evidence words exactly DESIGN / ASSUMED / MEASURED.
- "not modelled" in lower case, never "N/A".

**Security:** no `innerHTML` of registry text without escape. Registry strings are build-time data, but escape anyway.

**Performance:**
- render ≤ 4 ms for 12 rows;
- the what-if recompute is debounced to the slider's `input` at 1 frame;
- a DC AI `compute` takes about 2 ms in Node (to be measured in the gate and stated).

---

## C5. Release plan and ownership

| order | release (number at push) | phases | lanes | peer messages before start |
|---|---|---|---|---|
| 0 | v3.107.0 (now) | P2 pt2, P3 pt2–3, P4 pt1 | 3 + 4 | SHA to 87 after push; 87 takes v3.108.0 |
| 1 | next free | **P4b** + **P11-G11** + `rz-sp-block.js` extraction | 3 | none (my files) |
| 2 | next | **P5** | 3 + 4 | to 87/02: `datahallAI.html` (1 tag), `equipment-inspector.js` (1 call + guard), `hmi-payloads.js` (8-line diff) |
| 3 | next | **P6** | 4 | none beyond P5 |
| 4 | next | **P7** | 4 | 2 more tags in `datahallAI.html` |
| 5 | next | **P9** | 3 | fire, fuel, water, cdu-mini pages: tell 87 which lines |
| 6 | next | **P10** | 3 + 4 | — |
| 7 | when the hook is agreed | **P8** (fallback strip may ship earlier with P7) | 3 + 4 | `rz-trend.js` overlay hook spec to 87 |
| 8 | with 87's next chiller-plant release | **P11-G12** | 3 | KPI spec to 87 |

**Every release carries:**
- the CHANGELOG entry;
- rz-version, sw cache, changelog.html;
- tokens (`--fix` on my assets only);
- `standarization/CONTROL_SETPOINT_STANDARD.md` and the PRD §C phase note;
- an OWNER_REQUESTS_STATUS line (R197);
- IndexNow after push.

---

## C6. Test matrix (every phase)

| dimension | values |
|---|---|
| widths | 390 × 844, 1440 × 900 (plus 1280 for text-clear C4) |
| themes | dark, light |
| motion | default, reduced |
| input | pointer (hover, double-click), keyboard (Tab, Enter, arrows, Escape) |
| states | live, MAINT (conv), scenario active, what-if active, Reset |
| failure | registry twin missing → the block says "registry not loaded" (no throw); engine throws → the what-if says "engine refused: <message>" |

**Gate commands:**
- `bash tools/run-conv-release-gates.sh` (lane 3);
- the DC AI 37 via `RZ_GATE_PICK` (lane 4);
- the phase gate on lane 5 (2 cores, thermal-checked).

---

## C7. Risks

| risk | effect | guard |
|---|---|---|
| peers edit `datahallAI.html` / inspector daily | merge conflicts, lost tags | one-line changes, announced first; token-only conflicts resolved by script; a fresh registry build after every rebase (peer rule) |
| the registry docs index makes `conv-parameters.json` stale on any doc naming a parameter | step 6 red (it happened twice) | rebuild the registry as the last step before every gate run |
| DC AI `compute` on every slider tick | jank | debounce 1 frame; measure p95 in the gate (budget 16 ms) |
| ASSUMED values read as facts | wrong decisions | the word ASSUMED in the UI next to every such number; gate S2/T2 checks the word |
| simulated pens read as real history | misread trends | dashed, labelled SIMULATED, step axis, never mixed into the time axis |
| shaped weather bins (ASSUMED) behind the free-cooling hours | overconfidence | the hours row carries "shaped bins, not a TMY file" (engine `weather.basis`) |

---

## C8. Definition of done (whole amendment)

**Registry:**
- setpoints ≥ 31;
- typed control numbers on pages = 0 (gate T1 + D2);
- drawn loops ≥ 10, 0 orphans;
- every loop shows authority.

**DC AI:**
- every unit class inspector shows SP/PV/error/limits;
- TCS and air SP what-ifs equal the engine;
- the cliff (34 °C, +73 %) is visible;
- 3 DC AI sequences simulate.

**Simulate:** moves PV pens (overlay or strip) in every sequence.

**Gates:** every law in §C is red-proven, then green. Shots of each phase at 390/1440 × dark/light have been looked at and sent. The live version is checked after each push.

---

## C9. P4b delivered (2026-11-26)

- **Registry.** `conv.chiller-plant.chws_sp` loop TIC-CHWS (sheet `int-chiller`, PV `TT-CHWS` node `ttchws`, MV node
  `vfd`); `conv.datahall.crah_supply_air_sp` loop TIC-SAT (sheet `int-crah`, PV node `st`, MV node `cv`);
  `conv.datahall.rack_inlet_sp` loop TIC-RI, `kind: 'reset'`, `slave: 'TIC-SAT'`, notDrawn (no P&ID on the data hall
  page). The builder now refuses an `int-*` sheet without its internals file and a reset without a registry slave.
- **Drawn.** Chiller inside: TT-CHWS right of the CHWS OUT nozzle, TIC-CHWS right of the oil circuit (the free corner;
  the C3 sketch above put it beside the nozzle, where the evaporator readings sit), PV signal along the sheet floor,
  MV signal into the VFD from the right; the VFD speed moved above the drive so the MV line clears it. CRAH inside:
  the unit controller is retagged TIC-SAT when the twin lists the loop, PV signal from the supply-air TT, the existing
  controller-to-valve line becomes a signal; the valve now reads OPEN = `cooling.crah_valve_open_pct` (coil flow /
  design flow), its stem position stays "not modelled". Measured: TIC-CHWS SP 19.4 °C OUT 89.3 %; TIC-SAT SP 25.4 °C
  OUT 99.5 %.
- **Correction to C3.** TIC-SAT is **direct** acting (supply air above SP → valve opens), not reverse: ISA direct =
  output rises with the PV, which a cooling coil valve does.
- **G11 closed.** `test-conv-sheet-text-clear.mjs` `vis()` rejected any element under 1 px in EITHER dimension, so a
  straight (vertical or horizontal) pipe never reached C1/C5. Now both dimensions must be under 1 px. Red proven:
  PDT-01's value moved back to dx -24 dy 16 → `FAIL C1 … "90 kPa" × edge e-hrDec` (the old gate passed it). The
  fixed gate found 12 hidden overlaps, all fixed: fire zone status "NORMAL" × its loop drop (5; value moved right of
  the drop), EPMS feeder relay names "50/51 50N/51N" × the next feeder's cable (6; tag and name centred between the
  two feeders) and CB-GB's power value × feeder FB1 (1; values on the open left side).
- **Deferred.** The `js/rz-sp-block.js` extraction moves to P5, where its second consumer (the DC AI inspector)
  appears; extracting it with one consumer would be an abstraction for a single use.
- **Gates.** `test-setpoint-sim.mjs` 311 → 332 checks (S8b red first: 0 controller bubbles tagged TIC-CHWS / TIC-SAT);
  text-clear 5 sheets C1–C5 PASS; geometry fire + EPMS exit 0; internals core / P3 PASS.

## C10. P10 part 1 delivered with P4b (2026-11-26)

- Grouped into the P4b release to save one full conv gate cycle (both touch only my files).
- Registry loops carry `out` {key, minKey, what}; the twin's `authority()` holds the one rule (saturated within 2 % of
  100 % or of the minimum, ASSUMED). Modal loop line: OUT, authority left, SATURATED with its meaning; inside-view
  bubbles append `· SAT`. **Correction to C3 P10:** the mark is the word SATURATED / SAT, not `◆`, which is the alarm
  glyph of `js/conv/point-status.js` (a second meaning for one glyph would misread an alarm).
- Measured: PDIC-01 OUT 98.7 % → 1.3 % left, SATURATED; TIC-SAT 99.5 % → 0.5 %, SATURATED; TIC-CDWS and TIC-CHWS
  89.3 % → 10.7 %.
- Gate S11a/b red first (4 loops without an out key), green: setpoint-sim 346 checks.
- Still open in P10: the mark on the plant-sheet bubbles (their OUT text is bound to a page point), the Loops table
  (S11c), the DC AI CDU and fan-wall loops (with P5), the rack-inlet what-if showing the valve beyond 100 %.
- `js/rz-sp-block.js` extracted (C4) in the same release: the modal's spBlock / what-if / Live-Error code moved
  unchanged in markup; the host passes recompute + live. Script tag on the 5 modal pages. Gate C14 red on the old modal
  (two writers), green after; setpoint-sim 346 and internals P4 671 unchanged.

## C11. P5 delivered (2026-11-26)

- **What the DC AI operator sees.** Opening a CDU, fan-wall CRAH, chiller or chemical-dosing unit in the inspector shows
  "Setpoints & limits" under the unit's own rows: TCS supply 40 °C; supply air 25 °C and supply RH 45 %; CHW supply
  19 °C; pH 8.5, conductivity 800 µS/cm, ORP 450 mV, inhibitor 120 ppm. Each has SP, Live (the number the inspector
  already shows) and Error. The band, range, evidence and controller sit in the row title.
- **Reference values are not repeated** as setpoints (HTW, CDW, CHW return, pump current): they are live rows already.
- **What-if.** TCS supply 30–45 °C and supply air 18–27 °C recompute `DCAI_CALC.compute` on a copy. The design point
  sits on the cliff: margin 0.0 K, liquid free cooling ends at 34 °C ambient; at 41 °C it ends at 35 °C. Numbers print
  to 4 significant figures (PUE 1.158, COP 5.503, 25,811 kWe), temperatures to 0.1.
- **Typed setpoints gone.** The 8 literals in `js/datahall-ai/hmi-payloads.js` read the registry through `SP()` /
  `SPT()`. Five new `points.js` records, each ASSUMED with its basis: genset jacket keep-warm 40 °C, aeration DO
  2.5 mg/L, MMR supply air 18 °C, support room 24 °C and 50 % RH. `test-dcai-points` now reads maintenance rows too
  (the keep-warm setpoint lives there).
- **Wiring.** `js/rz-inspector.js` fires `rz-inspector-payload` after each render; `js/datahall-ai/sp-inspector.js`
  appends the block. No change to `equipment-inspector.js`. `datahallAI.html` gains three script tags.
- **Correction to C0.3 G1:** the DC AI band now reaches the page through the twin (`limits` on each `dcai:` row, resolved
  on the design snapshot), because the page does not load `points.js`.
- Gate `tools/test-dcai-setpoints.mjs` D0–D7 (see CONTROL_SETPOINT_STANDARD §5). D3 (trend SP line) waits for the
  `rz-trend.js` hook.

## C12. P6 delivered with P5 (2026-11-26)

- **Cliff strip.** Under the CDU TCS supply what-if, the engine's 7 weather bins (24–36 °C, shaped, ASSUMED) show liquid
  free cooling or mechanical, now and at the simulated SP. At 39 °C the 34 °C design bin turns mechanical: free-cooling
  hours 8,600 → 8,000, liquid chillers 0 → 35,405 kWe, cooling power 61,187 → 105,193 kWe, annual PUE 1.158 → 1.164.
- **Clamp mark (G10).** The liquid-path COP row reads "off (free cooling)" at the design point and `12.00 ◆` at 39 °C:
  the copMax ceiling (a model input), not the Carnot-fraction result. The ceiling is read from the model at build.
- **Phone and inspector width.** The what-if keeps Output, Engine now and SIMULATED; Change (their difference) is
  dropped in the inspector. Cliff cells never wrap.
- Laws D6, D8, D9 and the stricter D4 (see CONTROL_SETPOINT_STANDARD §5).

## C13. P9 part 1 delivered (2026-11-26)

- **Registry.** 11 page control numbers in `convPageSetpoints`, built into `data/control-points.json` with kind
  (cut-in, cut-out, modulating, alarm, design), basis and evidence class (all ASSUMED: page design, no site document).
  Twin `RZControlPoints.value(id[, variant])` 1.3.0.
- **Pages.** `fire-system.html`, `fuel-system.html` and `cdu-mini-bms.html` read every control number from the twin;
  typed control numbers on the conv pages 10 → 0 (T1).
- **Two errors found and fixed by the laws.**
  - The fuel day-tank point band warned at 30 % (an older page's refill level) while the page fills at 50 % and keeps
    45 %: the band is now warn 45 / alarm 25 (C16 keeps band and page equal).
  - The CDU schematic said "TCV-01 holds TT-01 = 18 °C" while the model holds TT-01 at the type's supply (30–34 °C); 18 °C
    is the dew-point floor. The note now prints the type's setpoint and the floor, both from the registry; the CDU P&ID
    data (`data/pid/cdu-secondary-loop.json`) says the same.
- **Not in this part.** Water booster: the page states lead/lag with no pressure value, so there is no number to move
  ("not modelled"). Drawn loops for the pressure switches (fire), the day-tank LIC (fuel) and TIC/PDIC on the CDU sheet
  are P9 part 2. P-01 ΔP setpoint: the CDU model has no value ("not modelled").

## C14. P7 delivered (2026-11-26)

- Three DC AI sequences (`data/sequences/dcai-dry-cooler.json`, `dcai-cdu.json`, `dcai-crah.json`) in the inspector of
  those classes, through the one sequence view.
- **Heat rejection.** Normal (liquid free cooling) → edge (0 ≤ P4 < 1 K, ASSUMED band, alarm and trim-chiller pre-start)
  → mechanical (P4 < 0). Scenario "ambient rises": 24, 30, 34 (design), 35, 38 °C, each a full engine re-compute.
  Cooling power 51,899 → 57,472 → 61,187 → 106,122 → 111,201 kWe; liquid chillers 0 until 35 °C (35,405 kWe, 142 of 143
  chillers). **Finding:** at 38 °C the engine needs 634 dry coolers and 631 are installed: 2,875 kWth short. The
  step shows it ("HTW supply above setpoint").
- **CDU and fan wall.** One duty unit trips (short 108 kWth CDU, 154.6 kWth fan wall), the standby restores the duty
  count; high TCS / high supply air read the registry setpoints.
- Not in this part: the CDU low-flow, leak and facility-water-loss modes (no engine quantity to step), dry-cooler loss
  with derate (the engine has no per-unit derate). Hysteresis and edge band are ASSUMED and listed as such.

## C15. P10 part 2 delivered (2026-11-26): DC AI control authority

- The CDU TCS supply and the fan-wall supply-air setpoints name their loop and the engine output it moves (A8a valve
  stroke, engine 1.8.0). The inspector prints `OUT · authority left · SATURATED` from the one twin rule.
- Finding: at design both valves sit on full travel (CDU 99.6 %, fan wall 99.9 %), so the hall's design load uses every
  CDU and fan-wall valve to its stop; the N+1 standby is the only margin. The engine sizes the duty count by
  `ceil(load / unit)`, which leaves < 1 unit of slack by construction.
- Corrected during the work: the CDU loop is drawn on DH-M-103 (TT-nn3 → TIC-nn1 → TV-nn1); the registry carries the
  drawn tags and a law checks the drawing still joins them.
- Not done in this part: the compact Loops table (chiller-plant, inspector header) of §C3 P10.

## C16. P10 part 3 delivered (2026-11-26): the Loops table

- `RZSpBlock.loops()` + `RZControlPoints.loopRows()`: one compact table per page of the loops it owns, rows from the
  registry only. Chiller-plant side card "Control Loops" (PDIC-01 98.7 % ◆ saturated, TIC-CHWS and TIC-CDWS 89.3 %
  holding, 10.7 % left); DC AI inspector head of the Setpoints block (TIC-nn1 99.6 %, TIC-SA 99.9 %, both saturated).
- Laws S11c (row set = registry loops on CH-M-101, CH-M-102 and the chiller internals; SP, Live, OUT, left, state) and D12
  (one row per class loop, above the setpoints, OUT = engine valve stroke, state from the twin). Red first: S11c "Loops
  table rows [] ≠ registry loops on this page [TIC-CDWS,PDIC-01,TIC-CHWS]", D12 "Loops rows [] ≠ registry loops [TIC-nn1]".
- Layout: the chiller-plant phone patch forces every table into a 0.8 rem scrolling block with 8 × 12 px cells; the
  Loops table opts out (else OUT and State scrolled out of the card at 390 px).
- Datahall inspector: TIC-SAT 99.5 % ◆ saturated (0.5 % of CRAH valve left), TIC-RI "OUT not modelled" (a reset loop
  writes a setpoint, not an output). S11c datahall red on the old page (rows [] ≠ [TIC-SAT, TIC-RI]).
- Rack-inlet what-if (P10): the cascade moves TIC-SAT SP with rack inlet, but the engine does not re-rate the CRAH coil
  for a colder supply air, so `cooling.crah_valve_open_pct` does not move with this setpoint. The what-if lists only
  quantities that move (chws_c, lift, kWe, COP, kW/RT); the valve OUT stays at its live value and is named in the note,
  not in the rows. Whether a CRAH can hold a lower setpoint at 99.5 % is not modelled.

## C18. P8 delivered (fallback step strip, 2026-11-26)

- Simulate now draws the response: `RZConvSequence.strip` under every sequence's steps table, on both cockpits. A DC
  AI ambient sweep plots margin, chillers running, liquid-chiller kWe and cooling power per step; a conventional
  sequence plots running units, part load and shortfall.
- One point per step, revealed with its row. Dashed line, x = step, labelled SIMULATED · dynamics not modelled.
- Laws S7d (points = steps, last = the step value in the sequence file), S7e (Reset leaves none), S7g (x axis "step", no
  time unit). Red on the old view: 20 findings ("no step strip after Simulate").
- The rz-trend overlay pen (§C3 P8 item 2) stays a peer hook. The strip is the shipped form until then.

## C17. P9 part 2 delivered (2026-11-26): fire and fuel controllers drawn

- Fire, FS-M-101: PC-JP1 (11.5 / 12.8 bar), PC-FP1 (10.5 bar), PC-FP2 (9.5 bar) as panel bubbles. Each has its own
  sensing line, tapped between its pump's check valve and discharge valve (NFPA 20), and a signal to its pump. The main
  pumps stop by hand: the page models no automatic stop, and the registry says so.
- Fuel, FU-M-101: LIC-<set> beside every day tank (8 per hall). The level line runs from the tank to the bubble, and a
  signal goes to the row's fill valve XV-<set>. The bubble prints fill start / stop 50 / 90 %.
- Registry: `loop` on a `convPageSetpoints` cut-in (kind on-off, `stop` = the cut-out). The builder validates the side of
  the differential.
- Law S8e has three parts: structure, printed value = `value()`, and no orphan. Red on the old sheets. T3 now also moves
  the bubbles.
- Found while proving T3: the bubble first read `LOOPS[].value`. That is a second copy of the number, and the planted
  twin did not move it. Pages now read `value(sp)`.
- Not drawn, on purpose:
  - **cdu-mini-bms** (TIC → TCV-01, PDIC → P-01). Its schematic is hand-authored SVG outside the sheet engine. New
    bubbles would raise the diagram-engine ratchet, so this waits for the schematic's move onto RZHmiSheet.
  - **Water booster PIC.** The page has no registry row for the booster pressure yet. That row comes first.


## C19. P9 part 3 delivered (2026-11-27, v3.115.1 + v3.115.2): the booster PIC, the day tank's own numbers

- **v3.115.1, a controller's alarms.** "Open equipment HMI" on a controller bubble (`ctrl`) opens the unit it drives.
  The bubble's Alarms are the limits of the process value it holds, read from the limits registry by the id that unit
  prints. LIC-A3 → `fuel-system.DT.level_pct`, 45 / 25 %.
  - The first version borrowed the unit class's alarms and trend. The live screenshot showed the bulk tank's 85 %
    trend on a 90 % day tank.
- **Water, WT-M-101: PIC-301.**
  - Registry row: `conv.water-system.booster_discharge_sp`, 4.2 bar, kind modulating, loop PI reverse, ASSUMED. 4.2 bar
    is the drawing's own design value; no hydraulic calculation exists.
  - Signals run PT-301 → PIC-301 → P-301A. PT-301 prints the setpoint (steady state), so the page no longer types it.
  - OUT reads "not modelled". The builder now takes a PI / PID loop on a modulating page setpoint when it names its
    transmitter (`pv.node`).
- **The day tank's payload has its own class.** It used to borrow the bulk tank's class (`fuel.level_pct`, alarms
  60 / 30 / 95 %).
  - Its alarms and trend reference now come from `fuel-system.DT.level_pct` (45 / 25 %, nominal 70 %).
  - Clicking a day tank opens its genset's inside drawing. That drawing was already right, so the payload fix serves the
    inspector fallback and the gates.
- **Bubble names.** The sheet engine names a node "<tag> — <label>". 13 bubble labels on 4 pages started with the tag
  again, so the inspector title read "LIC-A3 — LIC-A3 — …".
  - Each label now says the tag once.
  - A bubble is named "Controller" in the inspector.
  - Its registry number is declared, not SIM.
- **Laws, each red first:**
  - T3 and S8e water;
  - S8f, no tag said twice (red on 13);
  - P10, a day tank reads no bulk parameter;
  - P11, the controller's kind and SP quality.
- **Still not drawn:** cdu-mini-bms (TIC → TCV-01, PDIC → P-01). The reason is unchanged: a hand-authored schematic,
  and the diagram-engine ratchet does not rise.

## C20. Inspector text (2026-11-27, v3.116.1)

- The v3.115.2 live screenshot of PIC-301 showed the inspector breaking words in half: "pai / r", "reve / rse".
  `js/rz-inspector.js` used `word-break: break-all`. A tag split at its hyphen ("PT- / 301"), and on a phone the
  title ran under the close button.
- Values and the title now wrap between words. A hyphenated tag stays on one line. The title is clear of the close
  button.
- Law: `tools/test-inspector-wrap.mjs` W1 and W2, in the Conventional release gate. It was red on 8 of 8 checks
  first, then red on 2 (the hyphen split) until the no-wrap tag span.
