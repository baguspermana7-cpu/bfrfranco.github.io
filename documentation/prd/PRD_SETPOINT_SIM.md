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
