# PRD-CONV-OPS-DEPTH · 01 Chiller Plant — the plant reads like a real SCADA/BMS screen: speeds, valve openings, buffer tank, standby-running, ACC fans, turning fans

Status: DRAFT for owner (2026-11-22). Parent: PRD-CONV-OPS-DEPTH/README.md (rules C1–C7).
Page: `chiller-plant.html` + `js/conv/chiller-sheet.js` (CH-M-101, CH-M-102) + `js/conv/internals/{chiller,pump,tower,crah}.js` + `js/conv/vfx.js`
+ `css/conv-vfx.css` + `js/conv-engine.js` (2.6.0 today). Measured on the worktree `rz-prd` on 2026-11-22.

## 1. Owner request (R188 + R189, verbatim, Indonesian)

> "chiller plant itu juga masih sangat kurang, tambahkan animasi dan beberapa parameter2 seperti cwp itu speednya berapa dan misal ada
> PICV or MV tk bypass, buffer tank thermal belum ada, 3-way valve itu juga belum ada dan atur pembukaannya itu balancing, dan harusnya
> secara design yang modern chiller itu standby running jadi dia tetap running seperti yang duty, ada banyak yang belum ada di chiller
> plant scada hmi ini, banyak"
> "terus di chiller itu misal pakai ACC itu condensornya sedang running berapa dan speednya sedang berapa. terus speed CRAH, opening
> control valve ya crah, banyak dah yang belum ada, ini masih kurang komprehensive"

Items this PRD must close (the owner's own list): CWP/CHWP speed; PICV on the terminals and a modulating DP bypass MV; thermal buffer
tank; 3-way valve with opening and balancing; standby-running (all units share load); ACC condenser fans running and speed; animation;
plus the generic "many things missing" (chiller load %, temperatures, lift, kW/RT, COP, staging, tower approach/range, CRAH valve opening).

## 2. Measured state today

Method: `node` over `js/conv-engine.js` + `js/conv/chiller-sheet.js` (vm, no browser), plus grep of the page script. All counts reproducible.

### 2.1 The drawings (CH-M-101 chilled water, CH-M-102 condenser water + towers)

| measure | CH-M-101 | CH-M-102 | note |
|---|---|---|---|
| nodes / edges | 203 / 230 | 65 / 73 | built from `getFleet()`, no typed counts (good) |
| value tags / point-bound tags | 130 / 71 | 54 / 44 | = 115 points on the two sheets (+ 11 static `data-point` ids in the page chrome) |
| pumps drawn (`pumpCentrifugal`) | 25 (20 CHWP-nnA/B + 5 CHWP-S) | 10 (CDWP) | **35 pumps, 0 show a speed on the sheet** |
| isolation valves (`valveButterfly`) / check valves | 20 / 20 | 0 / 0 | no position, no feedback |
| **control valves** (`valveControlMotor`, `valve3Way*`, PICV) | **0** | **0** | symbols exist in `rz-eng-symbols.js` (`valve3Way`, `valve3WayMotor`, `valveControlMotor`, `valveBalancing`, `tankBuffer`, `tankStorage`, `pumpVfd`, `fanAxial`); the sheets use none of them |
| balancing valve (`valveBalancing`) | 1 (DECOUPLER, no flow, no direction, no setting) | 0 | |
| tanks | 1 (`tankExpansion` ET-01, no value) | 0 | **no buffer / thermal-storage tank** |
| fan glyphs (`fanAxial`) | 0 | **0** on 10 tower cells | cell tag shows "FAN n kW" only |
| chiller (`chillerWater`) | 10 trains | – | 7 run, 3 stand by (engine) |
| CRAH banks | 4 (one per hall), `× 59 · 58 RUN` | – | no fan speed, no valve opening |

### 2.2 Per equipment: what an operator sees now vs what a real plant screen carries

| class (installed / running, engine) | shown on the sheet today | shown only in tooltip / modal | MISSING (not anywhere, or `not modelled`) |
|---|---|---|---|
| Chiller CH-01..10 (10 / 7) | state, compressor kW, branch flow (calc ref), CHWS/CHWR temp per train (TT-n01/n02), CDWR/CDWS temp (7 tags per train, 70 total) | modal: speed %, IGV %, COP, lift, approach, saturation T/P, superheat/subcool (engine 2.5.0 cycle) | **load %** (engine has `loadPct` per unit, not drawn), speed % and Hz on the sheet, kW/RT per unit, lift on the sheet, staging position, EXV %, HGBV %, oil (modal says `not modelled`) |
| Primary CHWP-nnA/B (20 / 7) | `CMD ON/OFF`, `RUN/STOP` (2 tags per pump) | tooltip rows: Speed, Head, Current | Hz anywhere (**0 occurrences** in engine, sheet, modal), **speed % comes from two sources**: authored `LOOP_SEEDS` {85,57,77,78} % cycled over trains (`chiller-plant.html` L239) vs engine `pump_speed_pct` = 100 for the other 15 pumps |
| Secondary CHWP-S1..5 (5 / 4) | `DUTY/STBY` | tooltip: flow, kW, head, speed 100 %, current `not modelled` | speed % + Hz tag, DP setpoint vs actual, curve operating point |
| Condenser CDWP-01..10 (10 / 7) | `RUN/STBY`, flow | tooltip: speed 100 % | speed % + Hz tag, kW tag |
| Tower cells CT-01..10 (10 / 7) | `RUN n %` (load), kWth, `FAN n kW` | tooltip: fan speed 89.3 % | fan speed on the cell, Hz, count N of M on the header, **approach and range** (engine has `tower_approach_k` = 5.0 and `cdw_range_k` = 5, only in the modal), basin level, make-up, blowdown (`not modelled`) |
| CRAH bank (59 / 58 per hall) | `× 59 · 58 RUN`, IT kW, supply / return air | modal: fan speed 99.5 %, airflow | **CHW valve opening % (modal: `valvePos` = `not modelled`)**, fan speed on the sheet, valve type |
| Decoupler / headers | CHWS, CHWR, IT-ref flow, header DP (sim mean of authored dp1/dp2) | – | primary vs secondary flow difference and direction, DP setpoint, bypass MV |
| Plant | COP 9.73, kW/RT 0.36 (chiller only), ΔT 7.6 K, N+1 margin | – | **all-in plant kW/RT** (engine `mech_plant_input_kw` 4622.1 kW over `duty_rt` 8885.4 = 0.520), tank state, standby policy |

### 2.3 Engine (conv-engine 2.6.0) facts that bound the design

- **No part-speed operation.** `pump_speed_pct: 100` is an authored constant (engine L655 comment: "it IS the design point, so speed is 100 %; no part-speed
  operation is modelled"). Pump flow is the duty flow split equally; head is a constant (primary 15 m, secondary 30 m, CDW 25 m). No affinity law, no system curve, no DP setpoint.
- **No Hz, no valve, no tank, no bypass, no 3-way, no air-cooled machine.** grep: `buffer` 0, `PICV` 0, `valve3` 0, `_hz` 0, `standby_running` 0, `air-cooled` 2 (both comments). `chiller_type` is the single value `water-cooled-centrifugal`.
  `js/conv-design-basis.js` already allows `heatRejectionType` ∈ {`evaporative-cooling-tower`, `dry-cooler`, `hybrid`}; only the first is modelled.
- **Staging is `run = ceil(Q_heat / 5,000 kWth)`** (`chillersRunning`, L397): 31,250 / 5,000 → 7 run, 3 off; the N+1 spare is **not** run. Units 1..run run (lowest number leads).
  This is classic lead/lag with the spare off. `getFleet('chiller')` returns `state` running|standby only.
- **Chiller kW per kW_th does not depend on load share.** `chillerSpecificPower` solves the cycle at the plant's own lift with the η_is fitted at the AHRI 550/590 rating point;
  `chiller_input_kw_e` = 31,250 × 0.1028 = 3,212.5 kW whether 7 or 10 units share it. The engine already publishes per-unit `chiller_speed_pct` (89.3) and `chiller_igv_pct` (100):
  speed = max(min 60 %, √(lift/lift_rated), load fraction), IGV = load / speed. So part-load efficiency is **not modelled** (this matters for §3.4 and §6.4).
- **Tower fans:** engine already uses the cube law (`fanKw = 55 kW × load³`), fan speed = cell load % (89.3 %), all running cells at equal speed.
- **CRAH:** `crah_fan_speed_pct` = unit load % = 99.5; `crah_unit_chw_flow_lps` 4.06. No valve.
- **Registry:** `data/conv-parameters.json` 322 rows, 143 `cooling.*`; `data/conv-limits.curated.json` has limits for only **4** cooling keys (`chws_c`, `chwr_c`, `cdw_supply_c`, `crah_supply_air_c`).
  So a new operating point has no warn/alarm basis unless this PRD adds it.

### 2.4 Animation today

- Flow dashes: running lines carry marching dashes, period from flow ratio (`vfx.dashSeconds`), on a separate sparse SVG layer at native rate (good, keep).
- **Rotors exist on pump symbols only** (`vfx.apply`: `circle.b` + `/pump/`): 35 pumps, `rotorSeconds(pct)` = 100 / pct seconds per turn (100 % → 1.0 s). **0 fan rotors** on CH-M-102 (10 cells), none on CRAH, none on any compressor.
- **Rotors step on the 3 Hz `chwMotionClock`** (page L1949, PRD-CONV-BMS-LIVE L1). A 1.0 s/turn rotor sampled 3 times a second advances exactly 120 °/step: a 3-blade rotor looks **frozen** at 100 % and
  runs backwards between 100 % and 150 % (wagon-wheel aliasing). So "rotor rate ∝ speed" is not truthful on the sheet today above ≈ 50 % speed. This is a defect to fix, not only a feature to add (law OD-CP-23).
- Valve stems, tank level, thermocline: none exist.

### 2.5 Two defects found while measuring (fix in P0)

1. `tools/test-conv-engine-version-pins.mjs` is **red on this tree**: `chiller-plant.html: requests conv-engine.js?v=2.5.0 but the engine is 2.6.0` (7 pages carry `?v=2.5.0`, 1 carries `2.6.0`).
   Any engine bump in this PRD stays blocked until the pins are green (`feedback_engine_version_pin_blanks_cockpits`).
2. Two sources of pump speed (§2.2). The modal row for CHWP-01A prints the authored seed (85 %) while the engine says 100 %. One point, one value (TR1) is violated today.

## 3. Reference design — how a modern chilled-water / data-centre plant is built and controlled

### 3.1 Variable-speed pumping, affinity laws, DP setpoint reset
- Pumps run on VFDs; flow ∝ n, head ∝ n², power ∝ n³ on a homologous point (affinity laws; Hydraulic Institute / ASHRAE Handbook—HVAC Systems and Equipment, pump chapter).
  Supply frequency f = f_base × n/n_base; Indonesian grid 50 Hz (IEC 60196 standard frequencies), so 87.5 % = 43.75 Hz.
- ASHRAE 90.1 §6.5.4 (hydronic systems): variable-flow pumping with VSD, and a pump DP setpoint that is **reset** from the load, not fixed.
- ASHRAE Guideline 36 (high-performance sequences, central chilled-water plant): secondary pump speed holds the remote DP setpoint; the setpoint is reset by trim-and-respond
  from the coil-valve requests (the most-open valve stays about 85–95 % open: lowest DP that still satisfies the worst coil). Lower DP = lower speed = cube-law kW.
- The operating speed is the intersection of the system curve (DP setpoint + friction ∝ Q²) and the pump curve at speed n: n = √((H_sys + b·q²) / H0), with H0 the shut-off head, b the curve coefficient fitted so n = 1 at the design point.

### 3.2 Pressure-independent control valves (PICV), terminals, modulating DP bypass (MV)
- A PICV holds the flow at (opening % × preset maximum flow) over its working DP band (BSRIA BG 29/2012, "Pressure independent control valves"): flow is **linear in position**, so
  opening % = Q / Q_preset_max. It replaces the 2-way valve + manual balancing valve pair on every coil and removes valve-authority problems (β ≥ 0.5, ASHRAE Handbook—HVAC S&E, control valves).
- Variable-flow secondary loops need a **minimum-flow path**: a modulating bypass (MV) at the loop end holds the minimum flow through the running pumps and the chiller evaporators
  (manufacturer minimum evaporator flow; ASHRAE Guideline 36 minimum-flow bypass). Opening = flow to be bypassed / bypass capacity. Closed (0 %) whenever the load flow is above the minimum.
- Primary–secondary decoupler: flow in the common pipe = primary flow − secondary flow. Positive: surplus primary flow returns to the primary return (lowers the return temperature: low-ΔT syndrome);
  negative: return water enters the supply (secondary supply temperature rises). The page's "Degraded drill" is exactly this; today nothing is measured on the decoupler.

### 3.3 3-way valves and balancing
- A 3-way valve **diverts** (one inlet, two outlets) or **mixes** (two inlets, one outlet); it holds total flow constant and splits it by position (A-port % + B-port % = 100).
  In a data-centre plant the 3-way valve lives on the **condenser-water side**: the cooling-tower bypass (CDWR split between the tower cells and the basin-bypass line) that holds the minimum condenser-water
  entering temperature of the chiller (AHRI 550/590 / manufacturer minimum ECWT; ASHRAE Handbook—HVAC S&E, cooling towers, "bypass control").
- A 3-way valve only keeps constant flow if its bypass leg has the same pressure drop as the load leg: a **balancing valve** in the bypass leg is set so the two legs are equal at design flow
  (IEC 60534-2-1 flow capacity: Kv = Q [m³/h] · √(ρ_rel / ΔP [bar])). Commissioning reports design vs measured flow per branch and the valve setting (ASHRAE Guideline 1.1; NEBB / AABC proportional balancing, ±10 % typical).
- Legacy 3-way valves on coils (constant-flow terminals) are the alternative to PICV; the PRD draws PICV on the CRAH coils (variable flow) and keeps the 3-way where it belongs (tower bypass).

### 3.4 Standby-running ("all units run at part load")
- Classic lead/lag: duty units run near full load, the N+1 unit is OFF and starts only on a failure or a staging demand (start delay of minutes, load jump on the survivors).
- Modern design (owner's statement): **the N+1 unit — or every installed unit — runs and shares the load**, so the load per unit falls to Q/(n_run). Reasons that are physical and derivable:
  (a) pumps and fans: power ∝ n³ per branch, so the same heat on more units costs less pump/fan power (§6.4 numbers); (b) a VSD centrifugal is most efficient well below full load
  (AHRI 550/590 weights IPLV at 1 / 42 / 45 / 12 % at 100 / 75 / 50 / 25 % load for exactly this reason); (c) **no start delay on a trip**: the remaining units already run and only pick up a load share.
- Limits: unit load must stay above the stable minimum (surge / IGV limit), evaporator flow above the minimum, and the plant above its minimum-flow bypass condition. Uptime Institute Tier standard
  (continuous cooling) and TIA-942 are the reason a thermal buffer is added: it bridges the seconds–minutes a restart would take.
- **What the engine can and cannot say today:** pump and fan kW change as above (derivable). The chiller's own kW/RT does **not** (η_is fixed at the rating point): shown as `not modelled` with the speed/IGV that the engine does compute,
  until the owner supplies a part-load curve (open item, §10).

### 3.5 Thermal buffer / storage tank
- A stratified chilled-water tank (cold water at the bottom, warm at the top, thermocline between) sits across the headers. It (i) decouples chiller staging from load swings, (ii) carries the load
  while chillers restart after a power event (ride-through), (iii) smooths short-cycling. ASHRAE Handbook—HVAC Applications, thermal storage chapter; Uptime Tier Topology continuous-cooling.
- Ride-through minutes = V · ρ · cp · ΔT_usable · SoC / Q_load / 60, with ΔT_usable the design CHW ΔT (7.6 K). Instrumentation: three temperature sensors (top, middle, bottom) plus level/charge %.

### 3.6 Air-cooled chiller (ACC) option
- Air-cooled machines reject through condenser coils with axial fans; N fans per machine, staged or all on VSD at equal speed (modern: all fans, low speed, cube-law saving).
  Saturated condensing temperature = ambient dry-bulb + ITD (initial temperature difference); lift rises with ambient, so COP falls (AHRI 550/590 air-cooled rating: 35 °C entering air, 6.7 °C leaving water).
  Screw/scroll machines load by slide valve or compressor steps; centrifugal by VSD + IGV.

### 3.7 Staging and the all-in efficiency number
- Plant efficiency is reported all-in, kW/RT = (chillers + CHW pumps + CDW pumps + tower fans) / RT (ASHRAE Guideline 22; ISO 50001 EnPI practice). The page shows chiller-only 0.36 today; all-in is 0.520.
- Staging sequence is shown as a ladder (stage k active when Q_heat exceeds (k−1) · unit capacity under lead/lag, or per the standby-running rule) with the current stage marked.

## 4. Goals / non-goals

Goals
- G1 Every pump shows speed % (and Hz in tooltip + modal) from ONE source; every fan shows speed % and turns at that speed.
- G2 DP setpoint and reset are visible; the secondary pump speed follows the affinity relation, not a constant.
- G3 PICV on the CRAH bank (opening %), modulating DP bypass MV (opening %), decoupler flow with direction, 3-way tower-bypass valve (A/B split %) with a balancing table.
- G4 Buffer tank TK-01 with top/mid/bottom sensors, charge %, ride-through minutes.
- G5 Standby-running as an engine policy (default decided by the owner, §10 Q1), with the kW effect shown where derivable and `not modelled` where not.
- G6 ACC option: condenser fans running N of M and speed %, ambient-driven saturation and COP.
- G7 Chiller sheet tags: load %, LCHWT/ECHWT, LCDWT/ECDWT, lift, kW/RT, compressor speed/IGV; plant all-in kW/RT and COP; staging ladder; tower approach and range.
- G8 Truthful animation (§7.3), including the 3 Hz aliasing defect.

Non-goals
- No dynamic transient simulation (no PID, no valve stroke time constants, no start-up transients). Steady-state relations only (README C3). The ride-through integral is an energy balance over the drill clock, not a transient model.
- No CHWST (supply temperature) reset: the engine derives CHWS from the rack-inlet target by the thermal chain; a reset would change that basis.
- No oil, purge, EXV, HGBV values (stay `not modelled` unless the engine gains a basis; PRD-CONV-EQUIPMENT-INSIDE owns them).
- Datahall room temperatures are PRD 02. The CRAH key `cooling.crah_valve_open_pct` is defined here and reused there (one key, one name).

## 5. Parameter catalogue

Source column: `ENG` existing engine key; `ENG+` new engine key (formula in §8); `SIM` page simulation function; `NM` not modelled (printed as text, never a number).
Where: `tag` value on the sheet (always visible, lod 1), `tag2` sheet value visible after zoom (lod 2), `tip` tooltip, `modal` equipment-modal block, `trend` rz-trend point.
Limits: the basis for warn/alarm; a numeric limit lives in `data/conv-limits.curated.json` with its source, never in the drawing.

### 5.1 Chillers (water-cooled centrifugal; screw/slide valve = ACC only)
| parameter | unit | source | where | limits basis |
|---|---|---|---|---|
| state running / standby; **role duty / assist / standby** | – | ENG `state`; ENG+ `role` | tag | assist = running as N+1 share |
| load % | % rated | ENG `getFleet('chiller').loadPct` (89.29) | tag | warn > 100 %, alarm > 105 % of `chiller_unit_kw_th` |
| compressor speed % · Hz | %, Hz | ENG `chiller_speed_pct` (89.3) per unit → ENG+ fleet `speedPct`; Hz ENG+ | tag (%), tip (Hz), modal | warn < `chiller_min_speed_pct` (60) |
| IGV position | % | ENG `chiller_igv_pct` | tag2, modal | – |
| slide valve % (screw, ACC) | % | NM until a screw machine is adopted; shows load % meanwhile | modal | – |
| LCHWT / ECHWT | °C | ENG `chws_c`, `chwr_c` per train (SIM t1/t2 equal to the header) | tag | existing limits rows |
| LCDWT / ECDWT | °C | ENG `cdw_return_c` (37.0, leaving), `cdw_supply_c` (32.0, entering) | tag | existing `cdw_supply_c` limits |
| lift | K | ENG `chiller_lift_k` (20.6) | tag2, modal | – |
| kW/RT, COP (per unit) | kW/RT, – | ENG+ identity: `inputKwE / (dutyKwTh / 3.517)` = 0.362; COP = dutyKwTh / inputKwE | tag2, modal | warn > rated 0.58 kW/RT (`chiller_rated_specific_power` × 3.517) |
| evaporator / condenser approach, saturation T/P, superheat | K, °C, kPa | ENG (2.5.0 cycle) | modal | – |
| min stable load, surge margin | % | NM | – | – |

### 5.2 Primary CHW pumps (CHWP-nnA/B, 20), secondary (CHWP-S, 5), condenser (CDWP, 10)
| parameter | unit | source | where | limits basis |
|---|---|---|---|---|
| speed % | % | **ENG+** replaces constant `pump_speed_pct`; primary n = q/q_design (homologous, pure friction); secondary and CDW n = √((H_sys + b q²)/H0) | tag | warn ≥ 100 % (no headroom), warn < `pump_min_speed_pct` (ENG+ ASSUMED) |
| frequency | Hz | ENG+ `cooling.motor_base_frequency_hz` (50, ADOPTED, IEC 60196) × n | tip, modal, trend | – |
| flow | L/s | ENG `flowLps` | tag2 | – |
| head / DP | m / kPa | ENG+ H_sys(Q) (system curve), ENG `*_pump_dp_kpa` at design | tip, modal | – |
| shaft / electrical kW | kW | ENG+ ρ g Q H_sys / η (per unit); Σ = plant | tag2 | – |
| **DP setpoint vs actual** (secondary) | kPa | ENG+ SP from reset (§6.2); actual = H_sys at the index coil | tag at header | warn actual < SP − 10 % |
| command / feedback | on/off | SIM `chwPumpCmd/Fb` (exists) | tip, mismatch marker | mismatch = warn (exists) |
| motor current, vibration, bearing T | A, mm/s, °C | NM (the authored amp/vib formulas in `loopMetrics` are removed from the display, not kept as "values") | – | – |

### 5.3 Cooling towers CT-01..10 and the condenser circuit
| parameter | unit | source | where |
|---|---|---|---|
| cells running N of M | – | ENG `tower_cells_running` / `tower_cell_count` (7 of 10) | header tag on CH-M-102 |
| fan speed % · Hz | %, Hz | ENG `fanSpeedPct` (89.29); Hz ENG+ | tag (%), tip (Hz) |
| fan kW | kW | ENG `fanKw` (39.15), cube law | tag2 |
| approach | K | ENG `tower_approach_k` (CDWS − wet-bulb = 5.0) | header tag |
| range | K | ENG `cdw_range_k` (5.0) | header tag |
| wet-bulb | °C | ENG `tower_design_wet_bulb_c` (27); SIM operator input `wet_bulb_c` for the bypass drill (labelled OPERATOR INPUT like the ambient slider) | tip |
| **3-way bypass valve TV-01**: A-port (to cells) % / B-port (to basin bypass) % | % | ENG+ §6.3 | tag on the valve glyph |
| **balancing valve BV-01** (bypass leg): setting | Kv | ENG+ §6.3, IEC 60534-2-1 | tip, modal |
| basin level, make-up, blowdown, vibration | – | NM | modal |

### 5.4 CRAH bank (per hall, typical coil)
| parameter | unit | source | where |
|---|---|---|---|
| CHW valve type | – | declared: PICV (2-way, variable flow) | tip |
| **valve opening %** | % | ENG+ `cooling.crah_valve_open_pct` = `crah_unit_chw_flow_lps` / (`crah_unit_sensible_kw` / (cp · `chw_delta_t`)) × 100 = 4.06 / 4.086 = **99.4 %** | tag, modal `valvePos` |
| preset max flow | L/s | ENG+ `crah_valve_preset_flow_lps` = 4.086 (design coil flow) | tip |
| fan speed % · Hz | %, Hz | ENG `crah_fan_speed_pct` (99.5); Hz ENG+ | tag, tip |
| CHW ΔT across coil | K | ENG `chw_delta_t` | tip |

### 5.5 Distribution: decoupler, DP bypass MV, buffer tank
| parameter | unit | source | where | limits basis |
|---|---|---|---|---|
| primary flow Σ / secondary flow Σ | L/s | ENG+ Σ running primary `flowLps` / Σ running secondary `flowLps` | tip | – |
| decoupler flow and direction | L/s, ± | ENG+ = primary − secondary (0.0 in the adopted scenario by identity) | tag at DECOUPLER, arrow | warn \|flow\| > 10 % of plant flow |
| **DP bypass MV-01 opening** | % | ENG+ §6.2 | tag on valve glyph | warn > 0 % while load flow > minimum |
| DP setpoint (remote) | kPa | SIM `st.sp.dp` (slider 60–140, default 90) feeds ENG+ reset | tag | – |
| **TK-01 volume** | m³ | ENG+ `cooling.chw_buffer_volume_m3` (BoD input, §10 Q2) | tip | – |
| **TK-01 top / mid / bottom temperature** | °C | ENG+ two-layer stratified relation §6.5 (SIM readings, labelled) | 3 tags on the tank | warn top − bottom < 0.5 · design ΔT (thermocline lost) |
| **TK-01 charge %** | % | ENG+ SoC = 100 % at steady state; drill integrates the energy balance | tag | warn < 80 %, alarm < `ride_through_target` equivalent |
| **ride-through minutes** | min | ENG+ V ρ cp ΔT SoC / Q / 60 | tag | alarm < target (BoD, §10 Q2) |
| tank in/out flow | L/s | ENG+ = decoupler flow | arrow | – |

### 5.6 Plant
| parameter | unit | source | where |
|---|---|---|---|
| chillers running N of M, **standby policy** | – | ENG `chillers_running/total`; ENG+ `chiller_standby_policy` | header, KPI |
| staging ladder (stage k at Q > (k−1)·cap) | – | ENG identity over `chiller_unit_kw_th` | modal block, tip |
| load after one unit trips | % | ENG+ `chiller_load_after_trip_pct` = Q / ((run−1) · cap) | KPI |
| plant COP, chiller kW/RT | – | ENG `plant_cop` (9.73), `plant_kw_per_rt` (0.36) | KPI (exists) |
| **all-in kW/RT** | kW/RT | ENG+ `plant_all_in_kw_per_rt` = `mech_plant_input_kw` / `duty_rt` = 0.520 | KPI, trend (new) |
| plant kW split chillers / CHWP / CDWP / fans | kW | ENG `chiller_input_kw_e`, `*_fleet_kw_e`, `tower_fan_fleet_kw` | modal block |

### 5.7 ACC option (only when the design basis selects air-cooled or hybrid, §10 Q3)
| parameter | unit | source | where |
|---|---|---|---|
| condenser fans running N of M per machine | – | ENG+ §6.6 | tag |
| fan speed % · Hz | %, Hz | ENG+ §6.6 | tag, tip |
| ambient dry-bulb | °C | SIM operator input (exists as `ui.ambient`, 35.0) | tip |
| condensing saturation T, lift, COP, kW/RT | °C, K | ENG+ existing cycle (`cycleAt`) re-run at condSat = ambient + ITD | tag2, modal |
| compressor slide valve / step | % | NM (screw machine not adopted) | modal |

## 6. Control logic to model (steady-state relations, no random, no dynamics)

### 6.1 Pump speed (affinity + system curve)
Pump curve H(q, n) = n² · H0 − b · q² with H0 = r · H_d (r = `pump_shutoff_head_ratio`, ASSUMED 1.2, Hydraulic Institute typical 1.1–1.3) and b = (H0 − H_d) / q_d² so n = 1 at the design point.
System curve H_sys(Q) = H_sp + (H_d − H_sp) · (Q / Q_d)². Operating speed n = √((H_sys + b q²) / H0); Hz = f_base · n; kW = ρ g q H_sys / (η_p · η_m · η_v) (η constants as today, noted).
- Primary (one dedicated branch per chiller, H_sp = 0): n = q / q_d exactly.
- Secondary and CDW: H_sp is the remote DP setpoint (secondary) or the static lift (CDW: ENG+ `cdw_static_head_m`, ASSUMED, the 25 m already "includes tower static lift").
- **Worked example, today's scenario** (4 secondary duty pumps, 245.6 L/s each, H_d 30 m, SP 90 kPa = 9.2 m): n = 98.7 % = 49.3 Hz. With 5 secondary pumps sharing (standby-running): 196.5 L/s each, n = 95.7 % = 47.9 Hz.
  Because all pumps serve one shared system curve, total hydraulic power Q·H_sys is **unchanged** by the count of pumps: the secondary loop gains nothing from more pumps. Only the dedicated branches (primary, CDW,
  tower fans) gain. The PRD states this instead of promising a saving it cannot derive.

### 6.2 DP setpoint reset and the bypass MV (secondary)
- Reset (Guideline 36 trim-and-respond expressed as a steady-state relation): SP = SP_min + (SP_max − SP_min) · v, with v = (most-open coil valve opening − 0.85) / 0.15 clamped to 0..1,
  and the most-open valve opening = `crah_valve_open_pct` of the worst hall (all halls equal in the adopted scenario). SP_min, SP_max are the slider limits (60, 140 kPa, existing). In the adopted scenario the valves are 99.4 % open, so SP sits near SP_max: the plant is fully loaded — shown, not hidden.
- Bypass: Q_bp = max(0, Q_min_plant − Q_load), Q_min_plant = n_run_chillers · `chiller_min_evap_flow_pct` (ASSUMED 40 %, manufacturer data-sheet range) · q_design. Opening % = Q_bp / Q_bp_cap, Q_bp_cap = `chw_secondary_unit_flow_lps` · `pump_min_flow_pct` (ASSUMED 30 %).
  At 7 of 10 running at 89 % load: Q_load = 982.3 > Q_min = 280.7 L/s, so MV opening = **0 %, CLOSED** (printed). It opens in the scenario buttons (below).
- Scenario buttons: `High Load` raises SP and valve openings; `Degraded Drill` sets the decoupler negative (return water into supply) and raises CHWS_sec by `st.sp.chws` (exists); `Balanced` returns to the engine point. A NEW scenario `Low load 40 %` sets the heat load to 40 % so the MV and standby-running rules are visible.

### 6.3 3-way tower-bypass valve and balancing
- Mixed entering condenser temperature T_ecw = x · T_return + (1 − x) · T_cold, x = bypass fraction (B-port). Hold T_ecw ≥ `chiller_min_ecwt_c` (ASSUMED, manufacturer; AHRI 550/590 allows reduced ECWT): x = clamp((T_min − T_cold) / (T_return − T_cold), 0, 1).
  T_cold = wet-bulb + approach; adopted scenario: 32 °C ≫ T_min, so x = 0 → **A 100 % / B 0 %** is printed. The `Cold-weather drill` sets the SIM wet-bulb input low and the valve moves; the CDW temperatures follow the mix.
- Balancing: bypass leg pressure drop is matched to the tower leg at design flow: Kv_set = Q_bp,design [m³/h] · √(ρ_rel / ΔP_leg [bar]) (IEC 60534-2-1); the table lists design flow, engine flow, ratio, Kv set, deviation (green ±10 %, amber ±20 %, red beyond).
  The same table lists the 4 hall branches (design flow share = hall IT kW / plant IT kW × plant flow, from `listHalls()`) and the 7 running primary branches (engine unit flow vs mean).

### 6.4 Standby-running (engine policy) — how the fleet expresses it
- New input `cooling.chiller_standby_policy` ∈ {`lead-lag` (today, default until the owner decides), `standby-running`} and `cooling.chiller_standby_running_units` ∈ {`n+1`, `all`}.
- `chillersRunning(m)` = ceil(Q/cap) (lead-lag) or min(total, ceil(Q/cap) + spares_running, floor(Q / (cap · `chiller_min_load_pct`))) (standby-running); the last term keeps each unit above its stable minimum (ASSUMED 30 %).
- `getFleet('chiller')`: units 1..run get `state: 'running'` (unchanged vocabulary so every existing consumer keeps working), plus a new `role`: `duty` for the first ceil(Q/cap) units, `assist` for the extra running units, `standby` for the rest.
  Pumps and cells follow `run` (one primary pump, one CDW pump, one cell per running chiller, as today). loadPct per unit = Q / (run · cap).
- Effect on this plant (Q = 31,250 kWth, cap 5,000; chiller kW from the engine, other kW from the cube law, **upper bound** because CDW and tower have static terms):

  | policy | units run | load/unit | fan kW | primary pump kW | CDW pump kW | chiller kW | all-in kW/RT |
  |---|---|---|---|---|---|---|---|
  | lead-lag (today) | 7 | 89.3 % | 274 | 196 | 548 | 3,212.5 (engine) | 0.520 |
  | standby-running n+1 | 8 | 78.1 % | 210 | 150 | 419 | 3,212.5 (engine) | 0.493 (−5 %) |
  | standby-running all | 10 | 62.5 % | 134 | 96 | 268 | 3,212.5 (engine) | 0.462 (−11 %) |

  Secondary pumps 392 kW unchanged (§6.1). The chiller column is flat because the engine has no part-load η; the page prints `chiller part-load efficiency: not modelled` beside it so the saving is not read as more than it is.
- **Failover (derivable identity):** load on each survivor after one unit trips = Q / ((run − 1) · cap): lead-lag 7 units → 104.2 % **before** the spare is started (overload; hence the restart delay); standby-running 8 → 89.3 %; 10 → 69.4 %. Printed as `Load after 1 trip` with a warn above 100 %. This is the reason for the policy and the reason for the tank (§6.5).

### 6.5 Buffer tank TK-01
- Geometry: volume V (`chw_buffer_volume_m3`), three sensors at heights z = 0.9 (top), 0.5 (mid), 0.1 (bottom) of the water column. Cold (CHWS) enters the bottom, warm (CHWR) the top.
- State: SoC (0..1) = fraction of volume at supply temperature. Steady state SoC = 1: thermocline at the top. Two-layer stratified reading: T(z) = CHWS + ΔT · clamp((z − z_tc) / δ + 0.5, 0, 1), z_tc = SoC position, δ = thermocline thickness (ASSUMED 0.1 of height).
- Charge/discharge: tank flow = decoupler flow (§6.2). Drill `Chiller plant trip`: Q_load continues, chillers off, SoC(t) = SoC0 − ∫ Q_load dt / (V ρ cp ΔT) on the drill clock; ride-through = SoC · V ρ cp ΔT / Q_load / 60.
  Example from the engine's own numbers: Q = 31,250 kW, ΔT 7.6 K: 15 min needs **884 m³**, 5 min needs 295 m³ (the volume is the owner's BoD decision, §10 Q2).
- A cold-sensor spread below 0.5 · ΔT raises "thermocline lost".

### 6.6 ACC option (when selected)
- Per machine: N_f fans (ENG+ `acc_fans_per_unit`, ASSUMED by frame size; BoD). Required airflow fraction φ = Q_c / Q_c,design(at design ambient); modern control: all fans at equal speed s = max(s_min, φ), count N_f, kW = N_f · P_fan · s³
  (cube law, ASHRAE 90.1 §6.5.5 fan speed control principle); classic control: count = ceil(φ · N_f) at 100 %, kW = count · P_fan. The policy is an input; the sheet shows `N of M · s %`.
- Condensing: condSat = ambient + ITD (ENG+ `acc_itd_k`, ASSUMED); lift = condSat − evapSat; the **existing** `cycleAt(c, evapSat, condSat, η_is)` returns the shaft work per kW, so COP, kW/RT and the discharge temperature follow the ambient. At 35 °C ambient the lift is about 1.4× the water-cooled lift (47 °C vs 38.5 °C condensing),
  and the engine will say so; no typed COP.
- Hybrid: ACC trains beside water-cooled trains, one sheet CH-M-103 "AIR-COOLED CHILLERS" appears only if the design basis says `dry-cooler` or `hybrid` (recommendation; owner decides §10 Q3).

## 7. Drawing + animation changes

### 7.1 Symbols and tags (per symbol; C5: one value always visible, the rest on zoom/tooltip)
| symbol | added | tag lod 1 | tag lod 2 | tooltip |
|---|---|---|---|---|
| pump (35) | VFD marker (`pumpVfd`), rotor | `87 %` (running), `STBY` | `43.8 Hz`, kW, flow | cmd/fb, head, curve operating point, runtime `NM` |
| chiller (10) | role badge DUTY / ASSIST / STBY, load bar | `89 %` load | speed % · IGV %, lift, kW/RT | cycle summary (existing modal) |
| tower cell (10) | **`fanAxial` glyph on top with rotor** | `89 %` fan | Hz, kW, kWth | approach, range |
| CRAH bank (4) | PICV glyph with stem on the coil branch | `PICV 99 %` | fan %, ΔT | valve type, preset flow |
| DECOUPLER | arrow showing sign, `±0.0 L/s` | flow | – | primary vs secondary Σ |
| MV-01 (new, at the secondary loop end) | `valveControlMotor` + stem | `0 % CLOSED` | Q_bp | min-flow basis |
| TV-01 (new, CH-M-102 CDWR) | `valve3WayMotor`, A/B shown as filled legs | `A100 / B0` | T_ecw | balance table link |
| BV-01 (new, bypass leg) | `valveBalancing` | – | Kv set | design vs measured |
| TK-01 (new, at the decoupler) | `tankBuffer`: fill = SoC, thermocline line, 3 `instField` sensors | `100 % · 884 min` (ride-through, when V is adopted) | T top / mid / bottom | volume, thermocline |
| ET-01 | unchanged | – | – | – |

Valve glyph rule: the stem (a bar of 10 units) fills in proportion to the opening %; the fill is the only motion (≤ 300 ms transition, standard curve). A 3-way valve draws A and B legs with stroke weight ∝ split %.
State colours only: running green, warning amber, alarm red, standby grey dashed (`--rz-pt-*`). No glow, no pulse.

### 7.2 Layout and phone
CH-M-101 is 1020 wide with 10 train rows of 17-unit stacked tags: the new lod-1 tag per pump replaces the two existing lines (`CMD`, `RUN`; command/feedback mismatch keeps its marker and moves to the tooltip), so the tag count per row does not increase.
TK-01 and the valves sit in the DISTRIBUTION zone beside the decoupler; the zone grows by ≤ 90 units (check against the existing geometry gate `tools/test-conv-geometry.mjs` G1).
At 390 px the sheet keeps its pan/zoom behaviour (`minScale: 1`); only lod-1 text shows at first view; lod-2 appears after zoom (rz-hmi-sheet LOD). No text outside the drawing, no line through text (existing gates extended).

### 7.3 Animation (physical, truthful)
- **Fan and pump rotors ∝ speed**: period = 100 / speed % seconds per turn (existing `rotorSeconds`, 100 % = 1.0 s), applied to **fans** (tower, ACC, CRAH) as well as pumps. Below 5 % no rotation. Reduced motion: still, value text stays.
- **Aliasing fix (law OD-CP-23):** rotors move on their own thin overlay layer with a native CSS animation, as the flow dashes already do (page L1864 explains why: a full-sheet repaint costs ~60 ms). Not on the 3 Hz clock.
  Proof: measured angular step between two frames at 100 % and at 50 % must match 360 °/period within 10 %, which fails today (120 °/step aliasing).
- Flow dashes: unchanged mechanism; period ∝ 1/flow. New lines (bypass, tank, tower bypass) take the ratio from the new engine flows; a line with zero flow is static dashed grey.
- Valve stem and tank fill: transitions on value change only (no loop).
- Off-screen and hidden tab: paused (existing `is-offscreen`).

## 8. Engine changes (conv-engine 2.6.0 → one additive minor per phase; flattened-snapshot diff must show only additions)

New inputs (`MODEL.cooling`, each with `evidenceClass` and a source comment, as today): `motor_base_frequency_hz` 50 (ADOPTED, IEC 60196); `pump_shutoff_head_ratio` 1.2 (ASSUMED); `pump_min_speed_pct`, `pump_min_flow_pct` (ASSUMED);
`cdw_static_head_m` (ASSUMED); `chiller_min_evap_flow_pct`, `chiller_min_load_pct`, `chiller_min_ecwt_c` (ASSUMED, manufacturer); `chw_buffer_volume_m3` and `chw_buffer_target_min` (BoD, §10 Q2);
`chiller_standby_policy`, `chiller_standby_running_units`; ACC inputs `acc_fans_per_unit`, `acc_itd_k`, `acc_fan_kw`, `heat_rejection_type` (only P6).

New derived keys (formula in §5/§6): `pump_speed_pct` per class (replaces the constant 100; the old key stays as the design speed `pump_speed_design_pct` so no 2.6.0 key changes meaning), `chw_primary_pump_hz`, `chw_secondary_pump_hz`, `cdw_pump_hz`, `chw_secondary_dp_setpoint_kpa`, `chw_secondary_dp_actual_kpa`,
`chw_decoupler_flow_lps`, `chw_bypass_open_pct`, `chw_bypass_flow_lps`, `cdw_bypass_x_pct`, `cdw_balance_kv_set`, `tower_fan_hz`, `crah_fan_hz`, `crah_valve_open_pct`, `crah_valve_preset_flow_lps`,
`chiller_load_after_trip_pct`, `plant_all_in_kw_per_rt`, `chw_buffer_soc_pct`, `chw_buffer_ride_through_min`, `chw_buffer_t_top_c`, `_t_mid_c`, `_t_bottom_c`.
Fleet units gain: chiller `role`, `speedPct`, `hz`, `kwPerRt`, `cop`; pumps `hz`, `headM` (operating), `dpKpa`; tower cell `hz`; crah `hz`, `valvePct`.

Rules: every new key is registered in `data/conv-parameters.json` (regenerated) with a basis string (`data-basis-param` works), limits rows in `data/conv-limits.curated.json`, and point ids in `data/conv-points.json`
(`chiller-plant.<tag>.<quantity>`, `limitsOf` the registry row, `tools/test-conv-point-truth.mjs` TR1 must stay green).
**Version bump:** each phase that adds keys bumps `meta.version`, `js/rz-engine-versions.js`, and every `?v=` pin on the 8 cockpits (blank-page trap); `tools/test-conv-engine-version-pins.mjs` runs first (red today, §2.5).
The default policy stays `lead-lag` in P1–P4 so no existing number moves (`chillers_running` is referenced by **33 files**; 7 of them are node gates).

## 9. Laws → proof

Proof files: node `tools/test-conv-chiller-ops-engine.mjs` (E-cases, no browser) and browser `tools/test-conv-chiller-ops-ui.mjs` (U-cases, render at 1440 and 390, 0 page errors).
Each is wired into `tools/ship-gate.sh` and `tools/run-conv-release-gates.sh` (C7). "Red today" = what the case prints on the tree as it is now.

| ID | law (claim) | proof | red on today? |
|---|---|---|---|
| OD-CP-01 | engine-pin gate is green: page `?v=` = `meta.version` = `RZ_ENGINE_VERSIONS.conv` | `tools/test-conv-engine-version-pins.mjs` | **red** (`2.5.0 !== 2.6.0`) |
| OD-CP-02 | one speed per pump: modal row = tooltip = sheet tag = engine fleet `speedPct`, for all 35 pumps | U-case `pump-speed-one-source`; TR1 sampler | red: 20 primary pumps read authored 85/57/77/78 vs engine 100 |
| OD-CP-03 | every running pump has `0 < speedPct ≤ 100` and `hz = 50 × speedPct / 100` (±0.05) | E-case `pump-hz-identity` | red: no `hz` field |
| OD-CP-04 | primary pump speed = q / q_design (homologous); at 8 units run of 10 equals 87.5 % | E-case `primary-affinity` | red: speed is the constant 100 |
| OD-CP-05 | secondary speed from the pump/system curve is 98.7 % at today's scenario and drops with a lower DP setpoint (monotone over the 60–140 kPa slider) | E-case `secondary-curve` | red: no DP in the engine |
| OD-CP-06 | Σ hydraulic kW of the secondary set is independent of the number of pumps sharing (±0.1 %) | E-case `secondary-shared-curve` | red (no relation exists) |
| OD-CP-07 | `crah_valve_open_pct` = `crah_unit_chw_flow_lps` / design coil flow × 100 (99.4 %) and is drawn on all 4 CRAH banks | E-case `picv-identity`; U-case `crah-picv-drawn` (4 stems, stem fill = value ±1 %) | red: 0 valve glyphs |
| OD-CP-08 | DP bypass MV opening is 0 % at 89 % load and > 0 % when load flow < the minimum-flow condition; flow identity Q_bp = Q_min − Q_load | E-case `bypass-minflow` | red: no bypass |
| OD-CP-09 | decoupler flow = Σ primary − Σ secondary; 0.0 at the adopted scenario; sign flips in the `Degraded Drill` | E-case `decoupler-identity`; U-case `decoupler-arrow-sign` | red |
| OD-CP-10 | 3-way tower bypass: A% + B% = 100; T_ecw ≥ `chiller_min_ecwt_c` over a wet-bulb sweep; x = 0 at the adopted scenario | E-case `tower-bypass-mix` | red |
| OD-CP-11 | balancing table: for every branch ratio = measured/design; deviation colour follows ±10/20 %; Σ branch flows = plant flow (±0.5 %) | E-case `balance-sum`; U-case `balance-table-rows` (4 halls + 7 primary + bypass) | red |
| OD-CP-12 | TK-01: SoC = 100 % at steady state, T_top ≥ T_mid ≥ T_bottom, T_bottom = CHWS, T_top = CHWR; the three sensors are drawn | E-case `tank-stratified`; U-case `tank-three-sensors` | red: no tank |
| OD-CP-13 | ride-through minutes = V ρ cp ΔT SoC / Q / 60 and decreases monotonically in the trip drill | E-case `ride-through-balance` | red |
| OD-CP-14 | policy `standby-running`: running count ≥ ceil(Q/cap) + 1, every unit load ≥ `chiller_min_load_pct`, Σ unit duty = Q (±0.01 %) | E-case `standby-running-share` | red: no policy key |
| OD-CP-15 | policy `lead-lag` reproduces 2.6.0 for **every** existing key (flattened snapshot diff is additions only) | E-case `additive-only` against the stored 2.6.0 snapshot | green now, must stay green |
| OD-CP-16 | fleet `role` ∈ {duty, assist, standby}; `state` unchanged; running units = duty + assist | E-case `fleet-role` | red |
| OD-CP-17 | load after one trip = Q / ((run−1)·cap); 104.2 % lead-lag at 7, 69.4 % at 10 | E-case `failover-load` | red |
| OD-CP-18 | all-in kW/RT = `mech_plant_input_kw` / `duty_rt` (0.520) and is drawn on the page | E-case `allin-kwrt`; U-case `kpi-allin` | red |
| OD-CP-19 | tower fan Hz = 50 × `fanSpeedPct` / 100; N of M cells, approach and range drawn on CH-M-102 | E-case `tower-fan-hz`; U-case `tower-header-tags` | red: Hz 0 occurrences, approach not drawn |
| OD-CP-20 | every tower cell carries a fan glyph with a rotor; running cells have `data-spin`, standby cells do not (10 glyphs) | U-case `tower-fan-glyph-count` | red: 0 fan glyphs |
| OD-CP-21 | chiller tags show load %, role, LCHWT/ECHWT, LCDWT/ECDWT, lift, kW/RT; per-unit kW/RT = input/(duty/3.517) | E-case `chiller-unit-kwrt`; U-case `chiller-tags` | red: load % and kW/RT not drawn |
| OD-CP-22 | `NM` rows print the text `not modelled` and never a number (oil, purge, vibration, basin, slide valve) | U-case `nm-text-only` | green now, must stay green |
| OD-CP-23 | rotor angular step per rendered frame = 360° / period (±10 %) at 100 % and at 50 % speed (no 120°/step aliasing) | U-case `rotor-rate` (two screenshots / `getComputedStyle` animation sampling) | **red**: 3 Hz stepping |
| OD-CP-24 | rotor period ∝ 1/speed for pumps and fans across 3 speeds (monotone, ratio ±5 %) | U-case `rotor-proportional` | red for fans (none) |
| OD-CP-25 | valve stem fill = opening % (±1 %) for PICV, MV-01, TV-01 | U-case `stem-equals-value` | red: no stems |
| OD-CP-26 | reduced motion: every rotor/dash `animation-name: none` and the value texts remain | U-case `reduced-motion` | green for pumps, red for new glyphs until built |
| OD-CP-27 | 1440 and 390: no tag overlap, no text outside the drawing, no line through text, 0 console errors, on both sheets and in all scenarios | extended `tools/test-conv-geometry.mjs` G1 + U-case `layout-390-1440` | green now; must stay green with the new symbols |
| OD-CP-28 | every new point is registered (id, label, unit, limits row) and TR1 shows the same value in tooltip, inspector, modal, trend (20 sampled) | `tools/test-conv-point-truth.mjs` TR1 + E-case `registry-rows` | red until registered |
| OD-CP-29 | colours only from `--rz-pt-*`; no `filter`/glow/`box-shadow` on the new symbols | U-case `no-glow-palette-only` | green now |
| OD-CP-30 | ACC (P6): fans running N ≤ M, speed ∈ [s_min,100], fan kW cube law, COP falls monotonically with ambient (sweep 25–45 °C), no typed COP | E-case `acc-ambient-sweep` | red: no ACC |

Mutations that must turn a proof red (run each once, then revert):
M1 set `pump_speed_pct` back to a constant 100 in the fleet → OD-CP-04/05 red. M2 reintroduce the authored `LOOP_SEEDS` spd into the primary speed row → OD-CP-02 red.
M3 drop the `hz` field → OD-CP-03 red. M4 make `crah_valve_open_pct` = `crah_unit_load_pct` + 5 → OD-CP-07 red (identity broken).
M5 force MV-01 to a constant 12 % → OD-CP-08 red. M6 let A% + B% = 98 → OD-CP-10 red. M7 swap T_top and T_bottom → OD-CP-12 red.
M8 count the spare twice in `role` → OD-CP-16 red. M9 return `chillers_running` 8 under `lead-lag` → OD-CP-15 red (the binding gate over all existing keys).
M10 put the rotor back on the 3 Hz clock → OD-CP-23 red. M11 print a COP in the ACC sheet from a typed literal → OD-CP-30 / literal-scan red.
M12 render `0` instead of `not modelled` for a basin level → OD-CP-22 red.

## 10. Phases, risks, open questions

Each phase is one release with its own gate; engine first.

| phase | content | engine | laws closed |
|---|---|---|---|
| P0 | repair the pin gate (`?v=` on 7 pages), unify the primary-pump speed source (display from the engine), baseline gates for OD-CP-02/15/22/27 | none | 01, 02, 15, 22, 27 |
| P1 | affinity/system-curve speed, Hz, DP setpoint, kW per pump; fan/CRAH Hz; speed % + Hz tags | 2.7.0 | 03–06, 19, 28 |
| P2 | tower fan glyph + rotors on the overlay layer (fix aliasing), tower header N of M / approach / range, chiller tags (load, role badge, kW/RT, lift) | none (uses P1) | 20, 21, 23, 24, 26, 29 |
| P3 | PICV on CRAH banks, DP bypass MV, decoupler flow, 3-way tower bypass + balancing table, `Low load` and `Cold-weather` scenarios | 2.8.0 | 07–11, 25 |
| P4 | buffer tank TK-01, ride-through drill | 2.9.0 | 12, 13 |
| P5 | standby-running policy, role, load after trip, all-in kW/RT, staging ladder | 2.10.0 | 14, 16, 17, 18 |
| P6 | ACC option sheet CH-M-103 (only if §10 Q3 says yes) | 2.11.0 | 30 |

Risks
- R1 Blast radius of the policy default: 33 files reference `chillers_running`/`chillersRunning` (7 node gates, datahall, dcai). Mitigation: default stays `lead-lag` until the owner decides; OD-CP-15 guards byte-for-byte.
- R2 ASSUMED numbers (`pump_shutoff_head_ratio`, min flows, ITD, fan count) are not vendor data. They carry `evidenceClass: 'ASSUMED'`, show as ASSUMED in the basis drawer, and every displayed value says so in its tooltip; none is typed into a drawing.
- R3 The 3 Hz clock fix (P2) moves rotors to a second layer; the earlier PRD measured ~60 ms repaint per sheet tick. The overlay approach is the one already proven for flow dashes; verify main-thread time with the existing perf gate before shipping.
- R4 The sheet gets denser. Mitigation: one lod-1 tag per symbol; everything else lod 2 or tooltip (C5); phone gate OD-CP-27.
- R5 Chiller kW does not move under standby-running because the engine has no part-load η. The page says so (`not modelled`) rather than showing a saving it cannot derive; the pump/fan/tower saving (−5 % at n+1, −11 % at all) is an upper bound until `cdw_static_head_m` is adopted.
- R6 PRD 02 (datahall) needs the same CRAH valve and fan keys: names fixed here (`crah_valve_open_pct`, `crah_fan_hz`); README engine-key register must list them once.

Open questions for the owner (taste/scope only)
1. Default policy: switch the adopted scenario to **standby-running** (all 10 units, or n+1 only) now, which changes `chillers_running` from 7 to 8 or 10 across 33 files and several gates, or keep `lead-lag` as the default and show standby-running as a selectable mode first? (Recommendation: selectable first, adopt as default after P5 gates are green.)
2. Thermal buffer tank: what ride-through target (minutes) and therefore volume (15 min = 884 m³, 5 min = 295 m³ at today's heat load) should the Basis of Design carry? The engine will not invent it.
3. ACC: treat it as a plant-level design-basis alternative with its own sheet CH-M-103 (shown when `heatRejectionType` is `dry-cooler` or `hybrid`), or as a per-train option in a hybrid plant, or leave it out of this release? (Recommendation: plant-level alternative, P6, default off.)

## 11. Delivery notes

- **P1 (v3.95.0, engine 2.7.0).** Speed, Hz and setpoint keys shipped; gate `tools/test-conv-pump-speed.mjs`.
  - **Correction to OD-CP-04.** The rated branch flow is the chiller's rated duty at the design delta-T
    (5 000 kWth / (cp·ΔT)), not today's flow. Primary speed is therefore 89.3 % today (unit duty 4 464 / 5 000), not
    100 %. The "87.5 % at 8 of 10" figure assumed today = design. The law now asserts speed = q / q_design,
    homologous on a recomputed model.
  - **Deferred.** Electrical kW stays at the design head (`*_kw_e` keeps its 2.6.0 meaning, OD-CP-15). The
    system-curve kW comes with the P3 DP reset. Lod-1 speed tags on the sheet move to P2, with the rotor overlay.
- **P3 (v3.97.0, engine 2.8.0).** Valve keys and two off-design solves shipped; gate `tools/test-conv-plant-valves.mjs`
  (142 checks, red on 2.7.0).
  - **Drawn.** PICV-A..D on each CRAH bank return leg (opening = coil duty / rated, 99.5 % today), MV-01 minimum-flow
    bypass at the end of the hall headers (CLOSED today), TV-01 3-way tower bypass at the end of the CDWR header
    (B 0 % today). Values bind to the registry points; MV-01's leg carries the engine's bypass flow.
  - **Drills.** Scenario `Low-load Drill (40 %)` reads `CONV_CALC.bypassAtLoad(0.4)` (MV-01 10.7 %, 47.1 L/s);
    `Cold-weather Drill (WB 8 °C)` reads `towerBypassAt(8)` (B 40 %, ECWT held at 15 °C). Other values stay at today's
    load and say so in the drill row.
  - **Correction to OD-CP-08.** The bypass is sized for the whole minimum flow at zero load, so opening =
    Q_bp / Q_min (100 % at zero load), not Q_bp / (pump rated × min-flow %). `pump_min_flow_pct` was dropped as unused.
  - **Deferred.** OD-CP-11 balancing table (Kv is in TV-01's tooltip and asserted in node) and OD-CP-25 stem fill
    move to P2, with the rotor overlay. The decoupler sign flip in the Degraded Drill (OD-CP-09 U-case) waits for the
    page drill to drive the engine's primary flow.
- **P2 rotors (v3.97.0, with P3).** Gate `tools/test-conv-plant-rotors.mjs` (135 checks, red before: no tower fan rotor).
  - **OD-CP-20.** Every tower cell carries a fan rotor in its stack (`js/conv/vfx.js` `fanRotor`); running cells spin,
    standby cells do not.
  - **OD-CP-23 fixed.** Rotors left the page's 3 Hz clock (120 degrees a step at 1 s a turn: wagon wheel, and every step
    repainted the sheet). Each spinning rotor is copied onto its own thin layer (`svg.chw-rotor-layer`) and turned at
    10 Hz there (three blades, 120 degrees apart); the sheet rotor keeps its paused CSS animation, hidden.
  - **OD-CP-24.** Period = 100 / speed s from the engine fleet (tower `fanSpeedPct`, pump `speedPct`).
  - **OD-CP-26.** Reduced motion builds no rotor layer; `animation-name: none` on every rotor; values stay.
  - **Deferred.** OD-CP-21 chiller tags (load, role badge, kW/RT, lift) and the tower header N of M / approach / range.

## 12. Amendment E1 — pump power at the operating head (found 2026-11-24, conv-engine 2.9.0)

**Measured.** `recompute` with `cooling.chw_secondary_dp_setpoint_kpa` at 70, 90 and 110 kPa:

| DP setpoint | Speed | Pump kWe | Fleet kWe | Shaft kW |
|---|---|---|---|---|
| 70 kPa | 98.6 % | 98 | 392 | 90.31 |
| 90 kPa | 98.7 % | 98 | 392 | 90.31 |
| 110 kPa | 98.8 % | 98 | 392 | 90.31 |

The speed follows the setpoint through `pumpSpeedFraction`, but power does not move. The cause is in `conv-engine.js` ~1414: `pumpElectricalKw(c, secFlow, c.chw_secondary_head_m)` uses the design head H_d. §6.1 specifies the operating head H_sys. The setpoint what-if (PRD-SETPOINT-SIM P2) therefore shows only speed and Hz, and labels power "follows the design duty point".

**Change (conv-engine 2.10.0, additive).**
- Pump electrical kW = ρ g q H_sys / (η_p η_m η_v), with H_sys = H_sp + (H_d − H_sp)·x_s² of the same loop. This covers secondary, CDW (H_sp = static lift) and primary (H_sp = 0, so H_sys = H_d·x²).
- New field `chw_secondary_pump_head_op_m` (and the CDW / primary equivalents) shows the head used.
- `pumpElectricalKw` keeps its signature. Only the head argument changes.

**Laws (gate `test-conv-calc` + a new `test-conv-pump-affinity.mjs`).**
- **E1a.** Raising the DP setpoint raises secondary fleet kWe, and lowering it lowers fleet kWe. Red on 2.9.0: 392 at all three setpoints.
- **E1b.** At design flow (x_s = 1), H_sys = H_d, so power equals the 2.9.0 figure within 0.5 %. This anchors the design point.
- **E1c.** Fleet hydraulic power stays independent of the number of duty pumps at one system curve (§6.1 worked example).
- **E1d.** `site.pue` is a model input. No pump change moves it. The what-if says so and never shows a PUE delta.

**Release.** Engine version pins move on all 8 Conventional pages and on datahallAI's module. Run the full conv release gate. Then PRD-SETPOINT-SIM P2 can show the kW delta.

**Status (2026-11-24): built in conv-engine 2.10.0, gate `test-conv-pump-affinity.mjs` 25/25, red on 2.9.0 (14 of 18).**

| Measured on 2.10.0 | 70 kPa | 90 kPa | 110 kPa |
|---|---|---|---|
| Secondary H_op (m) | 29.20 | 29.27 | 29.34 |
| Secondary pump kWe | 95.4 | 95.6 | 95.8 |
| Secondary fleet kWe (4 duty) | 381.5 | 382.5 | 383.4 |

At the adopted point the loops run below design flow, so every head drops onto its system curve:

| Loop | x_s | H_d → H_op (m) | kWe per pump, 2.9.0 → 2.10.0 |
|---|---|---|---|
| Primary (H_sp = 0) | 0.893 | 15 → 11.96 | 28.0 → 22.3 |
| Secondary (H_sp = 9.18 m) | 0.982 | 30 → 29.27 | 98.0 → 95.6 |
| Condenser (H_sp = 4 m) | 0.908 | 25 → 20.74 | 78.2 → 64.9 |

Pump fleet input 1,135.6 → 993.0 kW. Mechanical plant input 4,622.1 → 4,479.5 kW, headroom 7,627.9 → 7,770.5 kW.
`site.pue` is unchanged (an input). The secondary moves only ±1 kW across 70–110 kPa because it already runs at
x_s = 0.98: the setpoint is a small share of a 30 m loop. That is the honest answer the what-if now gives.

- Fleet rows carry `headOpM` (operating) next to `headM` (design rating). `*_pump_dp_kpa` stays the design rating.
- `secondaryPumpSpeedAt(dp)` adds `headOpM`, `kwE` and `fleetKwE` at that setpoint (law E1g: equal to a full solve).
- Laws re-derived, not loosened: `test-conv-plant-internals` V1 hand calculation and L7 use H_op (doubling the whole
  system curve doubles power; a flow change scales power by q·H_op), `test-conv-internals-p3` P3-2 hydraulic and shaft
  use the fleet row's H_op.

## 13. Amendment E2 — the pump trend shows the operating dp of its own loop (found 2026-11-24, v3.104.0)

Measured on 110084672 (chiller-plant.html, 1440, the equipment modal of each pump):

| Pump | Differential head reading | Trend reference line | Should be |
|---|---|---|---|
| CHWP-01A primary, duty | 118 kPa (marked SIM) | 245 kPa, typed | 117.3 kPa, `cooling.chw_primary_pump_dp_op_kpa` |
| CHWP-01B primary, standby | 0 kPa | 245 kPa, typed | 0 kPa: a standing pump has no head |
| secondary pump 1, duty | 287.0 kPa (engine) | 245 kPa, typed | 287 kPa, `cooling.chw_secondary_pump_dp_op_kpa` |
| secondary pump 5, standby | 0.0 kPa | 245 kPa, typed | 0 kPa |

The condenser pump trend was anchored on `cooling.cdw_pump_dp_op_kpa` in v3.104.0; the two chilled-water classes kept the
typed 245 kPa, so the trend contradicted the reading above it by up to 170 kPa.

- **E2a.** The `chiller:pumpCentrifugal` trend anchors on the primary operating dp; a node of sheet class `chw-sec` anchors on
  the secondary one (`trBy`, picked in `classOf`). Amplitude 3 kPa (the reading band), not 9.
- **E2b.** A pump the page shows standing by (its Head row reads 0 m) trends a flat 0 kPa, and the first trend row reads
  "Standing by (reference line) 0 kPa", not the duty plane.
- **E2c.** The primary Head row carries the `engine` mark outside the maintenance simulation, as Speed does: it is
  H_d·n² with n the engine speed, which is the engine H_op of a dedicated primary branch (H_sp = 0).

Law P9 (`tools/test-conv-payloads.mjs`): every loop (primary, secondary, condenser) has a pump checked; a duty pump's trend
reference equals the registry value of its loop's `*_dp_op_kpa`; a standby pump, with and without the `engine` mark, trends
flat 0 and never prints the duty plane. Red on 110084672 (`245 vs 117.3`).

Status: built in the v3.105.x candidate. Browser, 1440: CHWP-01A 117.7 kPa engine / ref 117; CHWP-01B 0 / no plane;
secondary 1 287.0 / ref 287; secondary 5 0.0 / no plane; 0 page errors.
