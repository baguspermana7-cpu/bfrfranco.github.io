# PRD-CONV-EQUIPMENT-INSIDE — one click shows the process inside the equipment (owner R186)

Status: P1 BUILT v3.90.0 (gates test-conv-equipment-inside IN1, test-conv-point-truth TR1); P2a BUILT v3.91.0 (engine 2.5.0 cycle, gate test-conv-chiller-cycle CY0–CY5); P2b P-h chart BUILT v3.91.0 (js/conv/ph-chart.js, gate test-conv-ph-chart PH1–PH6); P3 BUILT v3.91.0 for the CDW / secondary CHW pump, cooling-tower cell and CRAH (js/conv/internals/pump.js, tower.js, crah.js, gate test-conv-internals-p3 P3-1..P3-6; still open in P3: pump curve tab, valve %/Cv, expansion tank, psychrometric chart, primary CHW pump symbols open the loop inspector because their readings are the page's loop simulation); still open in P2: phase slugs on refrigerant lines (§5.3), compressor level 2 and surge map (§5.4), fault states (§5.6); P3–P7 open. Implemented drive rule (supersedes §5.4 text): speed = max(min speed, √(lift / rating lift), load), IGV = load / speed (centrifugal flow ∝ speed). Written 2026-11-22 for execution (owner rule: comments → PRD first; "Jangan tanya saya": the defaults of
§13 stand unless the owner overrides them).
Scope: the Conventional BMS pages `chiller-plant`, `water-system`, `fuel-system`, `fire-system`, `EPMS_Telemetry`,
`datahall`, `ict`, `dc-conventional`. `datahallAI.html` and `js/datahall-ai/*` are out of scope (DC AI session).
Builds on `PRD-CONV-EQUIPMENT-TRUTH` (2026-11-18, modal v2, `js/conv/internals.js`). Where they disagree, this one wins.

---

## 0. The owner's comment

> "Saat block di klik itu harus ada diagram dari equipment itu ya. Misal saya klik chiller 1 ya keluarnya proses di
> dalamnya terlihat evap-compressor-condensor-expansion valve dll. Rancang prd nya dg sangat detail" (2026-11-22)

He asked for the same on 2026-11-18 (PRD-CONV-EQUIPMENT-TRUTH T1). That PRD built the internal sheet for 2 classes and
put it behind a second button. He clicked a chiller, saw a list of numbers, and asked again. This PRD fixes the entry
point, finishes the chiller as a real refrigeration process, and gives every equipment class its inside.

## 1. Measured state (live v3.86.1, 2026-11-22, 1440 × 900; screenshots in the release notes)

| # | fact | evidence |
|---|---|---|
| M1 | A click on CH-01 opens the right-hand inspector (`js/rz-inspector.js`): tabs LIVE / CAPACITY / DEPS / ALARMS / TREND / MAINT and 7 readings. No drawing. | click on `.hmi-node[aria-label^="CH-01"]` |
| M2 | The internal drawing exists, but only behind the inspector's "OPEN EQUIPMENT HMI" button: two clicks, and the button reads as a link to another page. | same; `js/conv/equipment-modal.js` v2 |
| M3 | Internal drawings exist for 2 classes: `chillerWater` (`js/conv/internals/chiller.js`, 19 blocks) and `gensetDiesel` (`internals/genset.js`). Every other class opens the v1 modal: "DRAWING" = a clone of the one clicked symbol (CHWP-01A: 1 block). | modal `.hmi-node` count per class |
| M4 | The chiller internal draws evaporator, condenser, two-stage centrifugal compressor, economiser, EXV, HGBV, purge, oil sump/pump/cooler, motor, VFD, UCP, PSV, IGV. Nine readings say "not modelled": discharge temperature (TD), subcooling (SC), superheat (SH), IGV position, economiser pressure, VFD speed, oil pump pressure, and the two inter-stage points. | modal text |
| M5 | Every refrigerant line in the chiller internal is painted by STATE (green = running). Nothing shows where the refrigerant is liquid, two-phase or vapour, or high or low pressure, so the cycle cannot be read. | modal screenshot |
| M6 | Truth defect: CHWP-01A speed/current read 59 % / 71 A in the hover tooltip, 75 % / 91 A in the inspector and 81 % / 95 A in the modal, at the same moment. Each view seeds its own SIM value. | three readings, one click sequence |
| M7 | The engine already publishes the cycle anchors (engine 2.4.0 `withPlantInternals`): unit duty 4,464.3 kW_th, unit input 736.2 kW_e, condenser 5,200.5 kW_th, evap sat 17.9 °C / 535.3 kPa abs, cond sat 38.5 °C / 977.1 kPa abs, lift 20.6 K, pressure ratio 1.825, Carnot COP 14.13, Carnot fraction 0.429, refrigerant R-134a (Antoine fit for saturation pressure only, no enthalpy). | `js/conv-engine.js:1101-1230` |
| M8 | Equipment classes drawn on the sheets (symbol kinds): chiller 12, water 13, fuel 11, fire 20, EPMS HV 14, plus the LV view (UPS, ATS, PDU, busway), the data-hall floor (CRAH, rack) and the ICT topology (router, switch, firewall, scrubber). About 45 distinct classes, of which 2 have an inside. | `js/conv/*-sheet.js` symbol census |

## 2. Goal and non-goals

Goal: one click (tap, Enter, Space) on any piece of equipment opens its process diagram: the parts inside it, what flows
between them, the state of each part, and the numbers that make it run. All values come from the engine, a stated
formula, a cited design constant, or a marked simulation. Nothing is decoration.

Non-goals: no 3D model, no photo, no vendor-specific drawings or brand names, no new pages (the modal is the surface),
no change to the sheets' own layout, no CFD.

## 3. Interaction

I1 · Entry. A single click/tap/Enter/Space on an equipment node (`.hmi-node` whose class is registered, §6) opens the
Equipment modal straight onto its INSIDE tab. The right-hand inspector is no longer opened by equipment clicks. It stays
for lines, instruments and junctions, which have no inside. Hover (pointer: fine) keeps the existing quick tooltip.
Instruments (TT, PT, FT, LT …) keep opening their trend (`js/rz-trend.js`).

I2 · Layout at ≥ 1200 px (modal `min(1280px, 100vw − 32px)`, height `100vh − 32px`):
```
┌ header: kind · sheet ─────────────────────────────── ◂ 01 of 10 ▸  × ┐
│ CH-01 — Water-cooled centrifugal chiller · RUNNING · LOAD 89.3 %      │
│ fleet strip: 01 RUN 89 % │ 02 … │ 08 STBY │ …   (one cell per unit)    │
├ tabs: INSIDE · CYCLE (P-h) · READINGS · TREND · ALARMS · BASIS ───────┤
│ ┌ internal drawing (≥ 62 % width) ─────────┐ ┌ block detail ────────┐ │
│ │ blocks, process lines, live values,       │ │ selected block: role, │ │
│ │ state points ①…⑧ on the refrigerant loop  │ │ readings with basis,  │ │
│ │ view bar: State · Thermal · Medium · Phase │ │ standard, sub-blocks  │ │
│ └───────────────────────────────────────────┘ └───────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```
At < 1200 px the block detail drops under the drawing; at 390 px the drawing fits the width (Fit on open) and pans.

I3 · Inside the inside. A click on an internal block selects it (detail on the right, block outlined in the selection
colour). A block that has its own inside (compressor → stages, IGV, motor, VFD; UPS → rectifier, inverter, battery
string) opens a breadcrumb level: `CH-01 › Compressor`. Back with the breadcrumb or Backspace. Maximum depth 2.

I4 · Units. ◂ ▸ and the fleet strip switch to the same class's next unit without closing. Standby and failed units show
their own state (§5.7).

I5 · Deep link and history. The open modal writes `#eq=<tag>&tab=<tab>&blk=<block>` (replaceState, no history spam);
loading a page with that hash opens it. Esc closes and returns focus to the clicked node.

I6 · Accessibility. `role="dialog"`, `aria-modal`, focus trap, labelled by the title; every internal block is a button
with `aria-label="<name> — <state>, <key reading>"`; the P-h chart has a table view; colours always carry a second
signal (dash pattern or text); `prefers-reduced-motion` stops slugs and rotors (colour stays).

I7 · Text. The owner's rule: values and one-word labels on the drawing; explanations in the block detail and tooltips;
no sentence on the drawing (`test-conv-text-budget` T4 applies inside the modal).

## 4. Truth rules (every number in the modal)

| class | meaning | marking | where computed |
|---|---|---|---|
| ENGINE | published by `conv-engine.js` / `fire-engine.js` | evidence dot, click → basis drawer | engine |
| DERIVED | formula over ENGINE values and cited constants | dot + formula in the basis drawer | engine (additive block), never in the page |
| AUTHORED | a design constant with a source (standard, handbook, typical datasheet range) | dot + source | engine `MODEL` |
| SIM | seeded simulation of a plant-state value with no engine meaning (oil sump temperature, vibration) | visible `SIM` mark | `js/conv/sim-points.js` (new), ONE seed per point id |
| not modelled | a value that cannot be derived honestly | the words "not modelled" | — |

T1 one value per point: the same point id shows the same value in the hover tooltip, inspector, modal, trend and the
sheet at the same tick (fixes M6). All SIM values come from one store keyed by point id; views never seed.
T2 "not modelled" is allowed only with a reason in the basis drawer; the count per class is declared in its registry
entry and may only fall (ratchet).
T3 Energy closes: for every heat-moving class the modal's balance holds within 1 % (chiller: Q_evap + W_comp = Q_cond;
HX: Q_hot = Q_cold; UPS: P_in = P_out + losses; transformer: P_in = P_out + P0 + Pk·load²).

## 5. The chiller (the reference class, CH-01 … CH-10)

### 5.1 Blocks (internal sheet `CH-xx-INT`)

| block | tag | what it shows |
|---|---|---|
| Evaporator, flooded shell-and-tube | EVAP | CHW in/out, duty kW_th, sat T/P, approach, refrigerant level (SIM) |
| Compressor stage 1 (impeller 1) | C1 | suction state ①, discharge state ②, stage work |
| Inter-stage mixing / economiser injection | — | state ③ (vapour from economiser joins) |
| Compressor stage 2 (impeller 2) | C2 | state ③ → ④, discharge temperature |
| Inlet guide vanes | IGV | position % (DERIVED, §5.4) |
| Hermetic motor | M | shaft kW, motor efficiency, winding temperature (SIM) |
| Variable-speed drive | VFD | speed % (DERIVED), input kW_e = engine unit input |
| Condenser, shell-and-tube | COND | CDW in/out, duty, sat T/P, approach, subcooled liquid ⑤ |
| Main expansion valve (to economiser) | EXV-1 | ⑤ → ⑥, opening % (DERIVED from mass flow) |
| Economiser (flash tank) | ECO | intermediate pressure, flash fraction, ⑦ liquid, vapour to ③ |
| Second expansion (to evaporator) | EXV-2 | ⑦ → ⑧ |
| Hot-gas bypass valve | HGBV | closed above minimum load; opens below (§5.6) |
| Oil system: sump, pump, cooler, filter | OS/OP/OC/OF | oil ΔP, sump T (SIM), cooler duty (AUTHORED % of input) |
| Purge unit | PURGE | run hours/day (SIM), non-condensables (SIM) |
| Relief valves | PSV-E / PSV-C | set pressure (AUTHORED, ASHRAE 15 / EN 378), margin to set |
| Unit control panel | UCP | mode, COP, kW/RT, alarms |

### 5.2 The cycle (two-stage economised vapour compression, R-134a)

State points, all DERIVED in the engine (new additive block `chiller_cycle`, engine 2.5.0):

| pt | where | pressure | definition |
|---|---|---|---|
| ① | evaporator outlet | P_evap | saturated vapour + superheat SH (AUTHORED 0.5–1.0 K, flooded) |
| ② | stage-1 discharge | P_int | isentropic from ① with η_is,1 |
| ③ | stage-2 suction | P_int | mix of ② (1 − x_f) and economiser vapour (x_f, saturated) |
| ④ | stage-2 discharge | P_cond | isentropic from ③ with η_is,2 → discharge temperature T_d |
| ⑤ | condenser outlet | P_cond | saturated liquid − subcooling SC (AUTHORED 2–5 K) |
| ⑥ | after EXV-1 | P_int | isenthalpic: h⑥ = h⑤, quality x_f = flash fraction |
| ⑦ | economiser liquid out | P_int | saturated liquid |
| ⑧ | after EXV-2 | P_evap | isenthalpic: h⑧ = h⑦ |

- P_int = √(P_evap · P_cond) (equal pressure ratio per stage, the textbook optimum; AUTHORED with source).
- Refrigerant mass flow through the evaporator ṁ_e = Q_evap / (h① − h⑧); through the condenser ṁ_c = ṁ_e / (1 − x_f).
- η_is is not assumed: the engine solves it so the cycle's shaft work equals the engine's published unit input after
  motor and VFD efficiency (AUTHORED 0.96 and 0.97): ṁ_e·(h② − h①) + ṁ_c·(h④ − h③) = W_input · η_motor · η_vfd. One
  equal η_is for both stages. Law CY3: the solved η_is lies in 0.65–0.88 (a centrifugal at part load); outside it the
  modal says so (red basis dot) instead of hiding it.
- Property data: an R-134a saturation table (T, P, h_f, h_g, s_f, s_g; −10 … 60 °C, 1 K steps) and a superheated table
  (P 400–1,600 kPa, T sat … 90 °C) embedded in the engine with their source (NIST Chemistry WebBook / REFPROP, IIR
  reference state h = 200 kJ/kg, s = 1.0 kJ/kg·K at 0 °C saturated liquid). Linear interpolation; a value outside the
  table returns null ("not modelled", never extrapolated). The existing Antoine fit stays for the published pressures;
  law CY1 checks the two agree within 0.5 %.
- Results published per running unit: h, s, T, P, quality at ①–⑧; ṁ_e, ṁ_c, x_f, T_d, η_is, COP_cycle (= Q_evap / W
  shaft), closure Q_evap + W_shaft − Q_cond (law CY2 ≤ 1 % of Q_cond; the condenser duty is the engine's).

At the adopted design point the chain reads (to be confirmed by the implementation, numbers here are the targets the gate
recomputes from tables, not values to copy): evap 17.9 °C / 535 kPa, cond 38.5 °C / 977 kPa, P_int ≈ 723 kPa, x_f ≈ 0.04,
T_d ≈ 45–50 °C, ṁ_e ≈ 25–27 kg/s, η_is ≈ 0.7–0.8.

### 5.3 Phase colouring and motion (view "Phase", default inside the modal)

- Line colour by refrigerant phase and pressure side, new medium tokens in `css/rz-hmi.css`:
  `--hmi-m-ref-lpv` low-pressure vapour (cool blue), `--hmi-m-ref-hpv` high-pressure vapour (warm red-orange),
  `--hmi-m-ref-hpl` high-pressure liquid (amber), `--hmi-m-ref-2ph` two-phase (striped: liquid and vapour dashes
  alternate), `--hmi-m-oil` oil (olive). Light and dark values validated for contrast ≥ 3:1 against the sheet
  (`scripts/validate_palette.js` style check in the gate). No glow.
- Slugs (the R184 grammar) on every refrigerant line; speed ∝ the line's mass flow ṁ / ṁ_design (`RZConvVfx.dashSeconds`).
  Water sides (CHW, CDW) keep their medium colours and flow speed from the unit's water flows.
- Rotors: compressor impellers turn at the VFD speed (`rotorSeconds(speed)`), the oil pump at its fixed speed.
- State points ①–⑧ are small numbered markers on the lines; hover shows T, P, h, quality.
- Standby unit: everything still and grey-blue; refrigerant at standstill pressure = saturation at the plant-room
  temperature (AUTHORED 25 °C → ~665 kPa abs): both shells show the SAME pressure. Failed unit: red, last values greyed.

### 5.4 Compressor detail (breadcrumb level 2: `CH-01 › Compressor`)

- Stage view: two impellers, IGV ring, diffuser, volute, economiser port, with ②③④.
- Speed: centrifugal head ∝ N² → N/N_design = √(lift / lift_design) (AUTHORED lift_design and minimum speed 60 %),
  clamped; IGV opening carries the rest of the capacity: IGV % = f(load, speed) by the declared rule
  load / (N/N_design)³ → %, clamped 20–100 %. Both DERIVED, both say "rule" in the basis drawer.
- Surge margin: distance of (load, lift) from an AUTHORED normalised surge line; < 10 % = warning (the HGBV opens).
- Small chart: compressor map (normalised flow vs head) with speed lines, the surge line and the live operating point.

### 5.5 CYCLE tab (P-h diagram)

- Axes: h (kJ/kg) linear, P (kPa abs) logarithmic; saturation dome from the table; isotherms at 10 K steps
  (thin, recessive); the cycle polygon ①→②→③→④→⑤→⑥(→⑦)→⑧→① drawn over it, each segment in its phase colour,
  points labelled. A design-point ghost polygon (thin, dashed) for comparison.
- Live: the polygon moves when CHWS, CDW or load changes (scenario seam), e.g. a tower fan failure raises P_cond, the
  polygon stretches up, the work arrow grows, COP falls.
- A table view lists the 8 points (T, P, h, s, x).
- Follows the dataviz rules: one axis per measure, recessive grid, direct labels, a table alternative.

### 5.6 Operating states and faults the drawing must show

| condition | trigger (engine/scenario) | what the inside shows |
|---|---|---|
| Normal running | unit running | phase colours, slugs, rotors, numbers |
| Low load | load < HGBV threshold (AUTHORED 20 %) | HGBV open, hot gas line runs, COP falls |
| High condenser pressure | CDW supply up (tower degraded) | P_cond up, ④ up, warning at AUTHORED limit, alarm at PSV − margin |
| Low evaporator temperature | CHWS setpoint low | evap sat near 2 °C → freeze warning |
| Surge risk | lift high at low load | surge margin < 10 %: warning on C1/C2 |
| Oil ΔP low | SIM fault seam | oil block red, trip sequence text in the detail |
| Standby | not running | §5.3 standstill |
| Tripped | alarm | red outline, last values greyed, alarm text in the detail |

### 5.7 Readings shown on the drawing (values, no sentences)

EVAP: duty, CHW in/out, sat T, P, approach. COND: duty, CDW in/out, sat T, P, approach. Compressor: kW_e, speed %, IGV %,
T_d, PR. ECO: P_int, x_f. EXV: opening %. UCP: COP, kW/RT, Carnot fraction. Oil: ΔP. All with the basis dot.

## 6. Every other class (inside, flows, numbers, depth)

Depth: D1 = process drawing with a model (balance law T3); D2 = functional block diagram with live states and the
values the engine has; D3 = component cut-away (parts, positions, ratings), for passive items.

### 6.1 Chiller plant (`chiller-plant.html`)

| class | depth | inside | key values (basis) |
|---|---|---|---|
| CHW / CDW pump | D1 | suction, impeller, volute, mechanical seal, bearings, coupling, motor, VFD; + pump curve tab | flow, head (engine), speed (affinity: N ∝ Q at fixed system curve, DERIVED), shaft kW, η (AUTHORED), operating point on the H-Q curve with the system curve, BEP distance |
| Cooling tower cell | D1 | distribution basin/nozzles, fill, drift eliminators, fan + gearbox + motor + VFD, cold-water basin, make-up valve, blowdown | range, approach, wet bulb (AUTHORED), cell load %, fan kW (cube law, engine), evaporation/blowdown (engine water balance), psychrometric mini-chart |
| CRAH (cooling coil) | D1 | filter, CHW coil, valve, EC fans, supply/return plenum | sensible duty, airflow, air ΔT, CHW flow (engine crahDuty, crahChw), valve % (DERIVED), fan speed (cube) |
| Expansion tank | D3 | diaphragm, air charge, system port | pre-charge (AUTHORED), system pressure |
| Butterfly / balancing / check valve, air vent | D3 | body, disc, actuator, position | position, Cv, ΔP = (Q/Cv)² (DERIVED where flow exists) |

Built (v3.91.0, P3) and the gaps it found:
- Pump hydraulic power, shaft power and ΔP are engine 2.5.0 keys (`cooling.<service>_pump_hydraulic_kw`, `_shaft_kw`,
  `_dp_kpa`); shaft / (motor η × VFD η) closes on the published `_kw_e`. No pump curve exists yet, so speed is the
  engine's design speed (100 %) and there is no BEP distance.
- Tower evaporation, make-up and blowdown are NOT drawn per cell. The engine's water balance is set from the site
  WUE: `water.evaporation_lpm` = 447.8 L/min. The heat rejected (34,462.5 kW at h_fg ≈ 2,400 kJ/kg) would evaporate
  about 860 L/min. Until the water balance is heat-based (an engine change that moves WUE, owner decision), a per-cell
  share of the WUE figure would be wrong by about half, so the cell says "not modelled".
- CRAH airflow = duty / (ρ cp ΔT_air) with ASHRAE dry-air ρ 1.204 kg/m³, cp 1.006 kJ/(kg K): 9.71 m³/s per unit.
  Valve position and fan power need a coil and fan curve; not modelled.
- The modal's plant readings (`js/conv/payloads.js`) printed seeded waves for motor current, vibration and basin level
  beside a drawing that said "not modelled". A page row that says "not modelled" now wins over the wave (TR1 rule).

### 6.2 Water (`water-system.html`)

| class | depth | inside | key values |
|---|---|---|---|
| Storage tank | D3 | shell, level transmitter, overflow, vent | level, volume (existing) |
| Cartridge filter | D1 | housing, cartridges, dirty/clean side, DP transmitter | DP vs clean DP and backwash limit (existing) |
| UV steriliser | D2 | lamp, quartz sleeve, UV sensor, ballast | intensity, dose = I × t (DERIVED with AUTHORED residence time) |
| Dosing pot / pump | D2 | tank, metering pump, injection quill | dose rate, residual (SIM marked) |
| Shell-and-tube HX | D1 | shell, tube bundle, baffles | Q both sides (T3), LMTD, UA (DERIVED) |
| Flow meter | D3 | principle (electromagnetic: coils, electrodes) | flow |
| Control / solenoid valve | D3 | body, actuator | position |

### 6.3 Fuel (`fuel-system.html`)

| class | depth | inside | key values |
|---|---|---|---|
| Genset (exists, extend) | D1 | engine block, turbo, aftercooler, radiator, fuel injection, governor, alternator, AVR, starter + battery, breaker | load kW, fuel L/h (engine), BSFC, jacket water T (SIM), battery V (SIM) |
| UST / day tank | D2 | tank, level, vent, fill, leak interstitial, overfill | level, usable L, autonomy (engine) |
| Transfer pump | D1 | as pump, + strainer | flow, head |
| Filter / water separator / polisher | D2 | stages, WIF sensor, DP | DP, WIF |
| Leak sensor | D3 | probe, sump | state |

### 6.4 Fire (`fire-system.html`, engine `fire-engine.js`)

| class | depth | inside | key values |
|---|---|---|---|
| FACP | D2 | CPU, loops, devices, NACs, PSU + batteries, network | loop states, battery standby hours (DERIVED from load) |
| Aspirating detector (VESDA) | D2 | aspirator fan, pipe network, filter, laser chamber, thresholds Alert/Action/Fire1/Fire2 | obscuration %/m vs thresholds (SIM marked), transport time |
| Pre-action valve | D2 | clapper, priming chamber, solenoid, supervisory air, double-interlock logic | stage 0–6 (existing), air pressure, interlock state |
| Alarm valve | D3 | clapper, retard chamber, pressure switch | state |
| Fire pump / jockey | D1 | as pump; NFPA 20 curve (rated, 150 % at ≥ 65 % head) | operating point, churn |
| Air compressor | D2 | compressor, receiver, pressure switch | pressure |
| Sprinkler head | D3 | bulb, deflector, K-factor | Q = K√P at the head pressure (DERIVED) |
| Release panel / manual station / abort | D2 | cause-and-effect matrix rows | stage, timers |

### 6.5 Electrical (`EPMS_Telemetry.html`)

| class | depth | inside | key values |
|---|---|---|---|
| Transformer | D1 | core, HV/LV windings, tap changer, cooling (ONAN/ONAF), Buchholz/temperature | load %, losses P0 + Pk·L² (AUTHORED datasheet range), efficiency, top-oil rise (DERIVED rule), T3 balance |
| Circuit breaker | D2 | poles, trip unit (L-S-I-G), operating mechanism; links to the existing TCC modal | state, current, trip settings |
| Protection relay | D2 | functions 50/51/87, CT inputs, trip outputs | pickups, state |
| Disconnector / earth switch / CT / VT / arrester | D3 | parts, ratio | position, ratio |
| Utility source / generator (IEC) | D2 | source, breaker, metering | kW, kV, kA |
| UPS (LV view) | D1 | rectifier, DC bus, battery string, inverter, static bypass, maintenance bypass; modes normal / battery / bypass / eco | P_in, P_out, losses (engine ups_loss_kw), efficiency, battery autonomy (DERIVED), T3 balance |
| ATS / STS | D2 | sources, transfer logic | source, transfer time |
| PDU / busway | D2 | feeds, breakers, branch loads | load % |

### 6.6 Data hall and ICT

| class | depth | inside | key values |
|---|---|---|---|
| CRAH (floor) | as §6.1 | | |
| Rack | D2 | PDU A/B, IT load, inlet/outlet air | kW, inlet/outlet T, ΔT = P / (ρ·cp·V̇) |
| Router / switch / firewall / scrubber | D2 | line cards, fabric, PSU A/B, fans, ports | port load (existing), PSU state, redundancy |

## 7. Architecture

- `js/conv/internals/<class>.js` registers each class (existing registry `RZConvInternals.register`); one file per
  class family; drawn with `RZHmiSheet` symbols; coloured by `RZConvVfx` (Phase view added for refrigerant).
- `js/conv/equipment-modal.js` v3: opens on the first click (I1), tabs INSIDE / CYCLE / READINGS / TREND / ALARMS /
  BASIS, breadcrumb, deep link. The inspector hook in `js/rz-inspector.js` hands equipment nodes to the modal.
- `js/conv/ph-chart.js` (new): the P-h diagram (SVG, no library).
- `js/conv/sim-points.js` (new): the one SIM store (T1).
- Engine: `conv-engine.js` 2.5.0 additive blocks `chiller_cycle`, `pump_curves`, `transformer_losses`,
  `ups_balance`; no 2.4.0 key changes (flattened snapshot diff gate). Engine version pins: every page that pins the
  engine version is updated in the same release (memory: an unbumped pin blanks the cockpits).
- Performance: the modal draws once per open and repaints only changed values at the page tick; slugs follow the
  in-view clock rules of v3.86.1 (24 Hz dash-offset layer, nothing repainted per step).

## 8. Laws and gates

| law | check | gate |
|---|---|---|
| IN1 | every registered equipment node on the 6 sheets opens the modal on ONE click, with the INSIDE tab and ≥ 3 internal blocks (D3) / ≥ 6 (D2) / ≥ 8 (D1); the inspector is not opened | `tools/test-conv-equipment-inside.mjs` |
| IN2 | every class in the symbol census (§1 M8) is registered or listed as "no inside" with a reason (junction, off-sheet, earth) | same |
| IN3 | keyboard: Enter opens, Esc closes, focus returns; deep link reopens | same |
| CY1 | table vs Antoine saturation pressure within 0.5 % at 0–50 °C | `tools/test-conv-chiller-cycle.mjs` (node, no browser) |
| CY2 | energy closure Q_evap + W_shaft − Q_cond ≤ 1 % of Q_cond for every running unit and scenario | same |
| CY3 | solved η_is in 0.65–0.88; T_d > T_cond,sat; h⑥ = h⑤, h⑧ = h⑦; x_f in 0–0.2; P_evap < P_int < P_cond | same |
| CY4 | P-h polygon in the modal equals the engine state points (pixel position within 1 px of the scale) | browser part |
| CY5 | perturbation: CDW supply +3 K raises P_cond, T_d and W and lowers COP (the binding is real) | same |
| TR1 | one point, one value: tooltip, inspector, modal and trend show the same value for 20 sampled SIM points (red today: M6) | `tools/test-conv-point-truth.mjs` |
| TR2 | "not modelled" count per class ≤ its declared ratchet; chiller 0 on ①–⑧ | IN gate |
| PH1 | refrigerant lines carry the phase token of their segment; two-phase lines show both dashes | IN gate |
| PH2 | slug period on each refrigerant line = dashSeconds(ṁ/ṁ_design); a standby unit has 0 moving marks | IN gate |
| BAL | T3 balances (HX, UPS, transformer) within 1 % | engine unit tests |
| A11Y | axe 0 serious/critical in the open modal, 1440 and 390, both themes | `audit-a11y` page list + modal |
| PERF | modal open → drawn ≤ 300 ms (p95, 5 runs); idle CPU with the modal open ≤ the PERF1 law | IN gate |
| TXT | no sentence (≥ 6 words) inside the internal drawing | `test-conv-text-budget` T4 extended to the modal |

Every gate is proven red first on v3.87.0 (IN1 fails for every class but the chiller and genset, TR1 fails on M6, CY*
fail because the block does not exist).

## 9. Phases and releases

| phase | content | release |
|---|---|---|
| P1 | I1–I6 entry (click → modal INSIDE), deep link, inspector hand-off; TR1 one SIM store (fixes M6); IN gate | v3.90.0 |
| P2 | chiller cycle engine block + R-134a tables + Phase view + P-h tab + compressor level 2; CY gates | v3.91.0 |
| P3 | chiller plant rest: pumps (curve), tower cell, CRAH, valves, expansion tank | v3.90.0 |
| P4 | electrical: UPS, transformer, breaker/relay, ATS/PDU | v3.91.0 |
| P5 | fire classes | v3.92.0 |
| P6 | water and fuel classes, genset extension | v3.93.0 |
| P7 | data hall rack/CRAH, ICT devices; coverage IN2 at 100 % | v3.94.0 |

Each release: full Conventional release gate, live screenshots of 3 classes, owner-facing summary.

## 10. Risks

- Property data transcription: a wrong table row shifts every enthalpy. Mitigation: CY1 cross-check against the
  independent Antoine fit, plus 5 spot values checked against the source in the gate (memory: a register cannot catch a
  transcription error, a second source can).
- η_is solved from the engine input could hide an inconsistent engine specific power. Mitigation: CY3 range, shown in
  red when outside; never clamped silently.
- Modal weight on phones: the internal sheet must fit at 390 px (Fit on open), 44 px targets.
- Engine version bump: every pin updated in the same commit (engine-version gate).

## 11. What changes for the operator (before → after)

Before: click CH-01 → a list of 7 numbers on the right; the drawing is hidden behind "OPEN EQUIPMENT HMI"; the drawing
is green everywhere and nine values say "not modelled". After: click CH-01 → the chiller opens: cold vapour leaves the
evaporator, is compressed in two stages, hot gas condenses, liquid flashes through the economiser and the expansion
valve back to the evaporator, each line in its phase colour and moving at its mass flow, the state points and the P-h
cycle beside it. The same for every pump, tower, CRAH, UPS, transformer and the rest.

## 12. Out of scope

Vendor curves and brands, real BMS integration, refrigerants other than the engine's (R-134a) until §13 D1 changes it.

## 13. Owner decisions (defaults stand)

| id | decision | default |
|---|---|---|
| D1 | refrigerant | R-134a (the engine's `chiller_refrigerant`); R-1233zd would need a second table set |
| D2 | entry | one click opens the modal; the right-hand inspector stays only for lines and instruments |
| D3 | modal vs docked panel | modal, `min(1280px, 100vw − 32px)` |
| D4 | the Phase view as the default view inside the chiller | yes (State view one click away) |

## 14. Nothing needed from the owner to start

All inputs are in the repository or public references. The only owner task still open in the project is unrelated:
running the Supabase migration `supabase/migrations/2026-11-20-conv-points.sql`.
