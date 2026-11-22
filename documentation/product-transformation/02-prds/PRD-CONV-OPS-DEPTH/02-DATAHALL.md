# PRD-CONV-OPS-DEPTH · 02 Data hall — an operator reads four temperatures per aisle, each CRAH's return air, fan speed, valve opening and airflow, humidity, mixing and pressure, in 3D and in Plan, each number from one physical model

Status: DRAFT for owner (2026-11-22). Parent: PRD-CONV-OPS-DEPTH/README.md (rules C1–C7 apply unchanged).
Page: `datahall.html` (172 kB, inline script lines ~900–2140), both projections of the floor drawing (`js/conv/floor-plan.js`, 806 lines,
the 3D / Plan toggle), the Air path section (`js/conv/air-section.js`, 132 lines), the CRAH inside (`js/conv/internals/crah.js`, 132 lines).
Engine: `js/conv-engine.js` 2.6.0. Does not contradict, and builds on: `documentation/prd/PRD_DATAHALL_BMS_ISO.md` (3D / Plan are two
projections of one drawing, grey = normal, state colour only, value tags, air that moves), PRD-CONV-DATAHALL-FLOOR (row tag and
legend rules; its P2 / P3 are superseded by BMS-ISO), PRD-CONV-DATAHALL-SPACE (the hall gets the room; text budget),
PRD-CONV-BMS-MOTION (no pulse, no blink, no glow), PRD-CONV-EQUIPMENT-INSIDE §6.1 (CRAH inside).

## 1. Owner request

> "dan yang datahall baik 3d dan plan, ini sangat kurang banyak parameter2 operation belum ada, misal temp di 4 titik per aisle/row,
> kemudian return air tempnya, animasi dari crah, dll. ini masih sangat kurang implement all, rancang prdnya" (R187)
> "terus di chiller itu misal pakai ACC itu condensornya sedang running berapa dan speednya sedang berapa. terus speed CRAH, opening
> control valve ya crah, banyak dah yang belum ada, ini masih kurang komprehensive" (R189, the CRAH half)

Meaning for this page: temperature at four points per aisle (ASHRAE TC 9.9 rack-inlet practice), return air per CRAH and per hot aisle, CRAH
fan speed % and airflow, CRAH chilled-water valve opening %, supply air against setpoint, humidity and dew point, containment and underfloor
differential pressure, rack kW per row, ΔT across racks, bypass and recirculation (RCI, RTI), and CRAH animation (fan turns at its speed,
air moves at its airflow). All of it in 3D and in Plan, at 390 px and at 1440 px, without clutter.

## 2. Measured state today

### 2.0 Method

Tree `01c9aa43f` (v3.93.0, detached worktree; `origin/main` is `2b6721123`, v3.92.0). Real headless Chrome (puppeteer) against a local static
server, authorised audit state (`tools/lib/cockpit-audit-state.mjs`), dark theme, 2.5 s settle, 1440 × 1000 and 390 × 844. Because of defect
D1 below, the measuring server rewrote the one `conv-engine.js?v=2.5.0` pin to `2.6.0` in the response; the repo was not touched. Engine
numbers come from running `js/conv-engine.js` in node. Scripts are in the session scratchpad, not the repo.

### 2.1 Counts

| measure | 1440 | 390 |
|---|---|---|
| default projection | 3D | Plan |
| stage (`#zone-field`) | 1098 × 720 px | 372 × 284 px |
| SVG nodes in the stage | 4,635 | 4,108 |
| cabinets | 500 (463 occupied, 37 spare) | same |
| CRAH cells (`.crah-cell`) | 59 (58 run, 1 standby) | same |
| `[data-point]` nodes in the page DOM | 254 (225 unique ids) | same |
| …of which CRAH leaving / return air | 116 (58 units × 2) | same |
| …of which row inlet avg / min / max | 75 (25 rows × 3) | same |
| `.fp-air` paths (air arrows) | 77, all 77 animate, periods 1.28–1.64 s (20 distinct) | same |
| `.cr-fan` shapes (CRAH fan) | 59 static 12-gon polygons, 0 animate | same |
| numbers visible in the plan area (law FL10, max 30) | 30 in `temp` mode: headroom 0 | — |
| words on the page | 299 | 318 |
| page horizontal scroll / page errors | none / 0 | none / 0 |
| `[data-point]` ids that carry station, per-CRAH fan / valve / airflow, RCI, RTI, ΔP | 0 | 0 |

### 2.2 Equipment classes and the parameters they show now

| class (count) | shown today (where) | what a real operator expects and cannot read |
|---|---|---|
| Cabinet (500) | kW, % of the 30 kW rating, one inlet °C, state word (tooltip, `floor-plan.js` `showTip`); lamp = state | inlet at three heights, inlet at the aisle ends against the middle, rack ΔT, rack airflow |
| Row / aisle (25) | row tag = letter + the current mode's value (25 values); row panel: heat kW, inlet, hot aisle, ΔT air, load min/avg/max, inlet min/avg/max, 20 per-cabinet inlets | four stations per aisle face, return air of the row, supply airflow of the row, recirculation %, bypass %, RCI, RTI, humidity, ΔP |
| CRAH (59) | lamp, number, tag "CRAH LA 25.4 → RA 36.4 °C" (one tag for the hall); per unit: leaving air, return air (116 points), fan %, valve %, duty kW, CHWS/CHWR (CRAH panel, `datahall.html:1962–1980`) | fan speed from the engine, airflow m³/s, valve opening that means something, CHW flow, supply air against setpoint, unit status beyond RUN / STBY, per-unit return air that differs |
| Hot aisle / return | one hall hot-aisle average and one return average (environment rows) | per hot aisle, per CRAH |
| Environment | RH 48 % (engine), dew point 13.6 °C, hottest inlet | RH and dew point against the ASHRAE envelope, condensation margin of the coil |
| Containment / underfloor | perforated tiles and hot-aisle roofs are drawn | any pressure, any leakage |
| Motion | 77 air arrows at a period bound to row heat (0.6–3 s around a constant 1.4 s) | fan blades at fan speed, arrows at airflow, stopped unit = still |
| Simulation | one "excursion" button path: a random row to 27.5–30 °C for 10–15 s, a random CRAH "affected" (`datahall.html:2084–2134`, 3 × `Math.random`) | named, deterministic causes (CRAH trip, containment breach, CHWS rise) |

### 2.3 Defects found while measuring (each re-proved against the code)

| id | defect | evidence |
|---|---|---|
| D1 | The page renders "Authority UNAVAILABLE": no racks, no CRAH, 88 words. `datahall.html:472` pins `conv-engine.js?v=2.5.0`; `js/rz-engine-versions.js:5` says `2.6.0` at HEAD, and `datahall.html:1062` blanks the page when they differ. Seven of the eight Conventional pages pin 2.5.0 (chiller-plant, datahall, dc-conventional, fire-system, fuel-system, ict, water-system); only EPMS_Telemetry pins 2.6.0. `origin/main` is consistent (2.5.0 both), so the mismatch is the unpushed v3.93.0 commit. | screenshot at 1440 and 390 ("COMMS LOST — AUTHORITY UNAVAILABLE"); `git show origin/main:js/rz-engine-versions.js` |
| D2 | CRAH fan 72 % and valve 64 % are literals (`datahall.html:1385–1386`: `fan: running ? 72 : 0, valve: running ? 64 : 0`). The engine says fan speed 99.47 % (`cooling.crah_fan_speed_pct`) and the CRAH modal says "valve position: not modelled" (`internals/crah.js:76`). The Air path section reads the same literals (`datahall.html:1836`). Three surfaces, three answers. | node: `getFleet('crah','A')[0].fanSpeedPct` = 99.47; browser CRAH inspector "Fan speed 72 % CHW valve 64 %" |
| D3 | 11 of 25 rows have a rack inlet below the CRAH leaving air (25.1–25.3 against 25.4 °C): an authored per-row offset `((z·7919) % 7 − 3) · 0.1` (`datahall.html:1310`). A cold aisle cannot be colder than its supply. | row A inlet 25.1 against supply 25.4 |
| D4 | Every running CRAH shows the same return air: the hall mean (`datahall.html:1381`). 58 per-unit points carry one number. | 58 identical `datahall.CRAH-Axx.return_air_c` |
| D5 | The fan of each CRAH (59 polygons) never turns. The air arrows' period follows row heat, not airflow; the airflow of every row is the same constant, 22.59 m³/s, so "bound to airflow" (BMS-ISO rule 4) is not what runs. | 0 of 59 animate; periods 1.28–1.64 s |
| D6 | The excursion simulator uses `Math.random` (3 calls) and marks a random CRAH "affected" without changing that CRAH's state, airflow or the row it feeds. It breaks rule C3. | `datahall.html:2084–2091, 2108` |
| D7 | The fleet is sized on the scenario load, not the design load: `crahRequired = ceil(7,500 / 130) = 58`, so every running unit reads 99.5 % and the standby is the 59th. A real 10 MW hall installs for design and runs at part speed. | engine `crahRequired` (`js/conv-engine.js:322`); Day-1 scenario (4,500 kW) would also read ~99 % on 35 units |
| D8 | Humidity mixes two planes: RH 48 % is the engine's white-space average beside `environment.avg_temp_c` 22.4 °C, but the page computes the dew point at the rack inlet temperature 25.4 °C (13.6 °C; the same pair at 22.4 °C gives 11.1 °C), and each row's RH is a synthetic ±2 (`(z·3571) % 5 − 2`). The limit file's RH-only band (20–80 %) is not the ASHRAE dew-point envelope. | `datahall.html:1315, 1325`; `data/conv-limits.curated.json:99` |
| D9 | The Air path section gets design heat 400 kW per row while its airflow design is 300 kW per row. | `__airSectionData(0)`: `designHeatKw` 400; `designAirflowM3s` 22.59 = 300 kW / (ρ·cp·11 K) |
| D10 | Gate `tools/test-conv-datahall-air.mjs` reads 12 of 48 red (the known pre-existing red). Cause and count in §2.5. | run with the pin rewritten: "FAIL — 12 of 48 checks" |

### 2.4 What a modern data hall BMS shows and this page does not (counted)

Status P = present, S = partial or wrong source, M = missing. 46 items.

| # | item | st | # | item | st |
|---|---|---|---|---|---|
| 1 | rack inlet, one value per row | P | 24 | CRAH status beyond RUN / STBY (fault, tripped, standby-started, manual) | M |
| 2 | rack inlet per cabinet | S (D3) | 25 | CRAH supply air against its setpoint, deviation | S (setpoint only) |
| 3 | four stations along each aisle face | M | 26 | CRAH running N of installed | P |
| 4 | three heights (bottom, middle, top) at a station | M | 27 | fan power index (affinity law) | M |
| 5 | min / avg / max inlet per row | P | 28 | CRAH duty kW | S (equal on all units) |
| 6 | inlet limit lines (18–27 recommended, 15–32 A1 allowable) | P | 29 | CRAH leaving-air trend per unit | S |
| 7 | inlet rate of change | M | 30 | RH per hall | P |
| 8 | hot-aisle temperature per row | P | 31 | RH per aisle / station | S (synthetic, D8) |
| 9 | hot-aisle temperature per station | M | 32 | dew point per hall | S (D8) |
| 10 | return air per hot aisle | M | 33 | dew point against the ASHRAE envelope | M |
| 11 | return air per CRAH | S (D4) | 34 | coil condensation margin (CHWS − dew point) | M |
| 12 | return air hall average | P | 35 | underfloor plenum ΔP | M |
| 13 | air-side ΔT per row | P | 36 | cold aisle to hot aisle ΔP | M |
| 14 | ΔT across racks per station | M | 37 | filter ΔP | M (stays NM) |
| 15 | row kW | P | 38 | recirculation fraction per row | M |
| 16 | kW per cabinet and % of rating | P | 39 | bypass fraction per row | M |
| 17 | row kW density vs design | M | 40 | RCI (HI and LO) | M |
| 18 | CRAH fan speed % | S (literal, D2) | 41 | RTI | M |
| 19 | CRAH airflow m³/s | M | 42 | rotating fan blades | M |
| 20 | row airflow supplied vs demanded | M | 43 | air arrows at airflow, still when stopped | S (D5) |
| 21 | CRAH CHW valve opening % | S (literal, D2) | 44 | valve stem position glyph | M |
| 22 | CRAH CHW flow l/s | M | 45 | standby unit drawn grey dashed, takes over on a trip | S |
| 23 | CHWS / CHWR / ΔT (hall) | P | 46 | named deterministic scenarios | M |

Count: P = 11, S = 11, M = 24 (11 + 11 + 24 = 46).

### 2.5 The known red gate, `test-conv-datahall-air.mjs` 12 of 48

Reproduced with the pin rewritten (D1), on both the committed gate and the working-tree edit (see below). The 12 failures, by cause:

| cause | failures | explanation |
|---|---|---|
| A. The test reads the row tag as "row kW" | 9 (1440: D1 strip, D3 rows A, M, Y; 390: D1 strip, D1 restate, D3 rows A, M, Y) | `.zf-kw` is the row tag; `datahall.html:1810` repaints it with `rowTagHtml(z)`, the current mode's value. The default mode is `temp`, so it prints the row's average inlet (25.3), and the test wants the integer row kW (322). The contract changed in v3.89.0 (BMS-ISO "row tag = letter + value"); the test did not. |
| B. The test clicks the geometric centre of `.zone[data-z="0"]` | 3 (1440 only: row panel does not open, state `hall`; panel does not restate; panel lacks ΔT) | in the default 3D projection the centre of a row's box is a cabinet or an aisle, not the row tag. At 390 (Plan) the panel opens. |
| total | 12 | 9 + 3; 1440 = 7, 390 = 5 |

The tree also carries an uncommitted edit to this gate that pins Plan through `localStorage['rz.dh.proj'] = 'plan'`. Measured with it: still
12 of 48, the same twelve lines. Pinning the projection is not the fix; the gate encodes the pre-v3.89.0 row contract.

## 3. Reference design (how a modern contained data hall is built and run)

| claim | source |
|---|---|
| Inlet air temperature is measured at the equipment air intake, not in the room or at the CRAH. The recommended envelope is 18–27 °C; Class A1 allowable 15–32 °C. Humidity limits are dew-point based, with an RH ceiling. | ASHRAE TC 9.9, Thermal Guidelines (the repo carries the 2015 table: `data/conv-limits.curated.json`, "ASHRAE 2015 Thermal Guidelines" read 2026-11-20) |
| Monitoring uses an array of intake sensors per aisle: along the aisle (including both ends, where recirculation is worst) and at several heights (bottom, middle, top of the cabinet face). This PRD uses four stations along the aisle and three heights, and states them as the PRD's choice; the exact clause is attached in Phase 3 (the standard text is not in the repo). | ASHRAE TC 9.9 practice; Herrlin 2005 uses every intake |
| CRAH control: the chilled-water valve holds supply-air temperature; the EC fan speed follows airflow demand (aisle differential pressure, or return-air ΔT). Fans are variable speed. Running every installed unit at lower speed beats cold standby, because fan power falls with the cube of speed. | ASHRAE 90.4 (data centre energy standard, variable-speed fans); fan affinity laws (ISO 5801 / ASHRAE Fundamentals) |
| Redundancy N+1 is concurrently running: all N+1 units run, each at N/(N+1) of the speed it would need alone. On a trip the rest speed up; no start delay. | Uptime Institute Tier practice; same reading as the owner's "standby running" for the chiller (R188) |
| Supply air equals the demanded IT airflow in a balanced hall. Supply less than demand makes IT intakes ingest exhaust (recirculation); supply more than demand wastes cold air back to the CRAH (bypass). | Herrlin 2005, 2008; Sharma, Bash, Patel 2002 |
| RCI measures how much intake temperature leaves the recommended band: RCI_HI = [1 − Σ(T_i − T_max,rec)⁺ / ((T_max,all − T_max,rec)·n)] × 100 %; RCI_LO the same for the low side. 100 % is ideal. | Herrlin 2005 (ASHRAE Trans. 111(2)) |
| RTI = (T_return − T_supply) / ΔT_equipment × 100 %. 100 % is balanced; above 100 % is recirculation, below 100 % is bypass. | Herrlin 2008 (ASHRAE Trans. 114(2)) |
| Cold side is held slightly above the hot side so air flows one way through the IT; the control variable is the cold-to-hot ΔP, or the plenum static pressure in a raised-floor hall. | ASHRAE TC 9.9 best-practice guide; vendor sequences |
| A chilled-water coil above the room dew point stays dry; below it the coil condenses and the unit adds latent load. | ASHRAE Fundamentals, psychrometrics |
| Control valve characteristic: equal-percentage, flow ratio = R^(x − 1) for opening x in 0..1. | IEC 60534-2-4 (inherent characteristics) |

## 4. Goals and non-goals

Goals
1. Four stations per aisle face (and three heights on demand) from one stated model; return air per hot aisle and per CRAH; per-CRAH fan %,
   airflow, valve %, CHW flow, supply air against setpoint; humidity and dew point against the ASHRAE envelope; recirculation, bypass, RCI,
   RTI, ΔT per row; plenum and containment ΔP; row kW density.
2. CRAH animation: fan blades turn at their speed, air arrows move at the row airflow, a stopped unit is still, in 3D and in Plan.
3. Every value is the engine, a named page function, or "not modelled". No literal in a drawing (closes D2).
4. 3D and Plan carry the same points; at rest the drawing prints no more numbers than law FL10 allows (30). Detail is in tooltips, the row
   panel, the CRAH inspector, the equipment modal and the trend.
5. Phase 0 clears the two gate causes of §2.5 and D1 before anything else lands.

Non-goals
- No CFD, no transient dynamics, no PID tuning: steady-state relations only (C3). The hall is one zone model, not a field solution.
- The DC AI hall (`datahallAI.html`) is the peer's (BMS-ISO F4) and is not changed here.
- No new cabinet-level airflow measurement: rack airflow stays "not modelled"; ΔT across racks is row hot aisle minus station inlet.
- No filter ΔP, no fan kW (no rated fan power is authored): the fan power index is relative only.
- SHI / RHI (Sharma) are not added; RCI and RTI cover the owner's list.

## 5. Parameter catalogue

Source tags: ENG = existing engine key; ENG+ = new engine key (formula given); SIM = page simulation function (named); NM = "not modelled".
Constants: ρ·cp = 1.2 × 1.006 kJ/(m³·K) as the page and engine use; ΔT_IT = `cooling.airside_delta_t_k` = 11 K (adopted).
Limits come from the curated limits file; a new point gets a row there with its `evidenceClass`. Where a standard gives a limit it is named;
otherwise the basis is the physical saturation (below).

### 5.1 Stations and row (per row, 25 rows; Plan and 3D)

Station geometry. A row is two lines of ten cabinets (L, R) with a contained hot aisle between and a cold aisle on each outer face.
Stations sit at cabinets 1, 4, 7, 10 of a line: 0, ⅓, ⅔, 1 of the aisle length; S1 and S4 are the two aisle ends. Eight stations per row, 200
in the hall. Each station reads at mid-height by default.

| parameter | unit | source | shown | limit basis |
|---|---|---|---|---|
| `datahall.row.<R>.inlet_s<k><L|R>_c`, k = 1..4 (8 per row) | °C | ENG+ `getRowAir`: T_in(p) = T_sup + k_row + a(p) (§6.4); a(p) is the aisle-end allowance A2 | 4 state dots per line (no text); values in the row panel as a 2 × 4 grid; tooltip of a dot | rack inlet limits reused (18–27 rec., 15–32 A1) |
| station height triple `…_s<k><L|R>_<b|m|t>_c` | °C | ENG+ vertical profile (§6.4, A3); equal at adopted 0 K | station inspector only (12 values, 3 per station) | same |
| `datahall.row.<R>.hot_aisle_c` | °C | ENG+ T_in,row + ΔT_IT | row panel, tooltip | none authored (informative) |
| `datahall.row.<R>.return_air_c` | °C | ENG+ flow-weighted mix of IT exhaust and bypass (§6.4) | row panel | none |
| `datahall.row.<R>.air_delta_t_c` | K | hot aisle − supply air at the row | row panel (exists, new source) | none |
| `datahall.row.<R>.airflow_supply_m3s`, `…_demand_m3s` | m³/s | ENG+ Σ V̇_CRAH·w (§6.1); demand = Q_row / (ρ·cp·ΔT_IT) | row panel | none |
| `datahall.row.<R>.recirc_pct`, `…bypass_pct` | % | ENG+ β, γ (§6.4) | row panel; tooltip | warn when recirc > 0 raises any station above 27 °C (derived) |
| `datahall.row.<R>.rci_hi_pct`, `…rci_lo_pct`, `…rti_pct` | % | ENG+ Herrlin formulas on the row's 8 stations (RCI), return/hot (RTI) | row panel | RCI bands per Herrlin 2005 (to confirm in Phase 4); RTI state only |
| `datahall.row.<R>.rh_pct`, `…dew_point_c` | % / °C | ENG+ §6.5 | row panel | ASHRAE envelope (§6.5) |
| `datahall.row.<R>.heat_kw`, `…load_*_kw` | kW | existing | row tag (mode power), row panel | existing |
| `datahall.row.<R>.kw_per_rack_avg`, `…density_pct_of_design` | kW, % | SIM row heat / occupied racks; ENG `hall.rack_design_avg_kw` (20 kW) | row panel | none |
| `datahall.row.<R>.plenum_dp_pa`, `…containment_dp_pa` | Pa | ENG+ §6.6 (Phase 5); NM until A5, A6 are authored | row panel | sign check: cold side positive |

### 5.2 CRAH (per unit, 59)

| parameter | unit | source | shown | limit basis |
|---|---|---|---|---|
| `datahall.<tag>.state` RUN / STBY / TRIP / MAN | — | ENG+ `getFleet('crah')` extended (§6.2) | lamp + unit tooltip; BMS state colours | trip = alarm |
| `datahall.<tag>.fan_speed_pct` | % | ENG+ = duty_j / rated sensible × 100 (constant air ΔT; the engine's own rule, `crah_fan_speed_pct`), now per unit | rotor speed; tooltip; inspector | warn above 100·(n − 1)/n % (the fleet could not lose a unit) — derived |
| `datahall.<tag>.airflow_m3s` | m³/s | ENG+ `crah_unit_airflow_m3_s` × speed (affinity: V̇ ∝ N) | arrow speed; tooltip; inspector | none |
| `datahall.<tag>.valve_pct` | % | ENG+ inverse of the valve characteristic (§6.3, A1) | stem glyph (LOD 2); tooltip; inspector; modal `valvePos` | alarm at 100 % with supply-air deviation > 0 (saturated) — derived |
| `datahall.<tag>.chw_flow_lps` | l/s | ENG `crah_unit_chw_flow_lps`, per unit by duty | inspector; modal | none |
| `datahall.<tag>.leaving_air_c` (supply) and `…sat_setpoint_c`, `…sat_dev_k` | °C, K | ENG `crah_supply_air_c` = SP; PV = SP + deviation (§6.3, A4) | tooltip: "SAT 25.4 / SP 25.4 / +0.0 K"; inspector | alarm on deviation (limit authored, ASSUMED) |
| `datahall.<tag>.return_air_c` | °C | ENG+ flow-weighted over the rows the unit draws from (§6.1, §6.4); differs unit to unit | tooltip; inspector; trend | none |
| `datahall.<tag>.duty_kw`, `…load_pct` | kW, % | ENG `crah_unit_duty_kw` shape: V̇·ρ·cp·(T_ret − T_sup), per unit | inspector | with fan speed |
| `datahall.<tag>.fan_power_index_pct` | % | ENG+ (speed/100)³ × 100 (affinity cube law) | inspector; hall tag tooltip as fleet mean | none (relative only) |
| `datahall.<tag>.filter_dp`, `…fan_kw`, `…rpm` | — | NM | inspector shows "not modelled" | — |
| hall: `datahall.crah.running_count`, `…fan_speed_mean_pct`, `…airflow_total_m3s`, `…fan_power_index_pct` | | ENG+ fleet sums / means | the one hall tag's tooltip; hall panel | n−1 check |

### 5.3 Hall: humidity, mixing indices

| parameter | unit | source | shown | limit basis |
|---|---|---|---|---|
| `environment.dew_point_c` | °C | ENG+ Magnus on the engine pair (`avg_temp_c`, `avg_rh_pct`): constant across the hall, because cooling is sensible only | environment row | ASHRAE 2015 envelope: recommended dew point −9 to 15 °C and RH ≤ 60 %; A1 allowable up to 17 °C dp and 80 % RH (to be read against the repo's cited table in Phase 3) |
| station / row RH | % | ENG+ RH(T) = 100·exp(γ(T_dp) − γ(T)), γ the Magnus term | row panel; station tooltip | same |
| `datahall.hall.condensation_margin_k` | K | ENG+ `chws_c` − `dew_point_c` (19.4 − 11.1 = 8.3 K today) | environment row | alarm ≤ 0 K (the coil would condense): derived |
| `datahall.hall.rci_hi_pct`, `…rci_lo_pct`, `…rti_pct` | % | ENG+ over all 200 stations / 25 rows | hall panel; hall tag tooltip | as 5.1 |
| `datahall.hall.recirc_pct_mean`, `…bypass_pct_mean`, `…inlet_spread_k` | % / K | ENG+ | hall panel | — |

### 5.4 Authored assumptions (each declared in the engine with a ref, ASSUMED until the owner replaces it)

| id | assumption | why it is needed | what changes if the owner replaces it |
|---|---|---|---|
| A1 | CRAH valve is two-way equal-percentage, rangeability R = 50, authority 1 (installed = inherent) | the modal says valve position is "not modelled"; a position needs a characteristic | `valve_pct` only |
| A2 | aisle-end allowance a(p) = [0.6, 0.3, 0 × 6, 0.3, 0.6] K (the page's existing simulated array, `datahall.html:1700`) | positional spread along an aisle | station values only |
| A3 | a local airflow deficit decays linearly along the aisle to zero at the far end; vertical rise is linear from 0 at the bottom to k_top at the top, k_top = 0 in the adopted scenario | shapes for scenarios; no effect at 0 | scenario views only |
| A4 | coil capacity scales with (T_air,in − T_CHWS) at constant effectiveness (ε-NTU; AHRI 410 coil rating basis) | supply-air deviation when the valve saturates | `sat_dev_k` only |
| A5 | perforated-tile open fraction 25 %, discharge coefficient 0.6 | plenum ΔP | `plenum_dp_pa` (Phase 5) |
| A6 | one equivalent containment leakage area per row | containment ΔP | `containment_dp_pa` (Phase 5) |
| A7 | RH 48 % is referenced to `avg_temp_c` 22.4 °C, the engine's own pair (not to the 25.4 °C rack inlet) | D8 | dew point 11.1 °C instead of 13.6 °C; one constant flips it |

## 6. Control logic to model (steady state, deterministic, no `Math.random`)

### 6.1 Airflow distribution: CRAH to rows

- Each CRAH j delivers V̇_j = (speed_j / 100) · V̇_rated, V̇_rated = (`crah_unit_sensible_kw`) / (ρ·cp·ΔT_IT) = 130 / (1.2072 × 11) = 9.79 m³/s.
- Geometry (declared, from the drawing): the north and south galleries each span all 25 rows. Unit k of a gallery of n_g serves the rows
  its x-interval [(k − 1)·25/n_g, k·25/n_g] overlaps; weight w_jz = overlap length / interval length. The floor drawing already assigns the
  nearest unit to each aisle end (`nearestCrah`); this makes that mapping explicit and testable.
- Row supply V̇_sup,z = Σ_j V̇_j · w_jz. Row demand V̇_IT,z = Q_z / (ρ·cp·ΔT_IT), Q_z = row heat (the page's deterministic row field).
- Today V̇_sup,z is the constant 22.59 m³/s for every row (D5). After this change it is the sum above; with 58 or 59 evenly spread units it is
  about 22.5 m³/s per row, so the hall total is unchanged (563 against 565 m³/s today) and the rows differ only by geometry.

### 6.2 CRAH state machine and standby-running

| state | rule |
|---|---|
| RUN | counts toward the fleet; speed from §6.3 |
| TRIP | scenario input (§6.6); speed 0, airflow 0, lamp alarm; the others share its heat |
| STBY | only when the owner keeps cold standby (open question Q1); grey dashed, speed 0 |
| MAN | scenario input: speed fixed by the operator override (`__setCrahSpeed`) |

Reference behaviour (default, Q1 = all run): every installed unit runs. speed_j = Q_hall / (n_running · Q_rated) × 100 with n_running = installed
(59). Today's 58 + 1 standby reads 99.5 % on 58 units; all-run reads 97.8 % on 59 (7,500 / (59 × 130)). Fleet fan power index falls from
58 × 0.995³ = 57.1 to 59 × 0.978³ = 55.2 unit-powers (−3.3 %); the saving grows as the hall loads less (cube law) once D7 is fixed (installed
count follows design load). On a trip the n−1 units rise to Q / ((n − 1) · Q_rated); above 100 % the fan saturates and §6.3 shows the consequence.
`crah_running`, `crah_available_kw` and `crah_n1_available_kw` keep their meaning and values (N-sized availability) so other pages do not move.

### 6.3 Fan, valve and supply air

- Fan speed (constant air ΔT, the engine's rule): speed = duty / rated × 100, saturated at 100 %.
- Valve: flow ratio q = CHW flow / CHW flow at full duty = duty / rated (same ΔT). Equal-percentage: q = R^(x − 1), so the opening is
  x = 1 + ln(q) / ln(R), clamped to 0..1 (A1). At 99.5 % load x = 99.9 %; at 50 % load x = 82 %; at 25 % load x = 65 %. The valve is nearly
  fully open at high load by construction: an operator reading 64 % today (D2) was reading a number that no relation supports.
- Supply air against setpoint: with the valve below 100 %, SAT = SP (25.4 °C, `crah_supply_air_c`) and the deviation is 0.0 K. When duty
  demand exceeds the coil capacity at the present CHWS (A4: Q_cap = Q_rated · (T_ret − T_CHWS) / (T_ret,rated − T_CHWS,rated)), the valve is
  at 100 % and SAT = T_ret − Q_cap / (V̇·ρ·cp): the deviation is positive and the row inlets rise with it.

### 6.4 Row mixing, return air, RCI, RTI (closed energy balance)

For row z: R_z = max(0, V̇_IT − V̇_sup), B_z = max(0, V̇_sup − V̇_IT); β = R / V̇_IT (recirculation), γ = B / V̇_sup (bypass).
- Rack inlet (mean): T_in = T_sup + β·ΔT_IT / (1 − β) + (scenario terms); station: add a(p) (A2) and scenario shapes (A3).
- Rack exhaust (hot aisle): T_hot = T_in + ΔT_IT.
- Return from the row at the CRAH: T_ret = ((V̇_IT − R)·T_hot + B·T_sup) / V̇_sup.
- Check (a law): V̇_sup·ρ·cp·(T_ret − T_sup) = Q_z for every row (energy closes), so Σ over units = the hall heat.
- Per CRAH: T_ret,j = Σ_z (V̇_j w_jz · T_ret,z) / V̇_j; duty_j = V̇_j·ρ·cp·(T_ret,j − T_sup).
- RTI_z = (T_ret − T_sup) / (T_hot − T_in) × 100. RCI over the 8 stations of a row (or 200 of the hall) per §3.
- Engine's adopted contained-aisle mixing (`supply_path_mixing_k`, `return_path_mixing_k`, both 0) stays the scenario input at row level: a
  non-zero value adds to k_row / the return, and β, γ read back as β = k/(ΔT_IT + k), γ = −k_ret/(T_hot − T_sup).

Preview on today's row heats (25 rows, 256.7–328.9 kW, mean 300, uniform CRAH airflow 22.59 m³/s): 14 of 25 rows recirculate (β up to
8.8 %); 11 bypass (γ up to 14.4 %); station-mean inlet 25.40–26.46 °C (hall mean 25.76 °C, 0.36 K above the adopted 25.4 target); return
34.8–37.5 °C with hall mean 36.40 °C, equal to the engine's `crah_return_air_c`; RTI 86–110 %; no row above 27 °C, so RCI_HI = RCI_LO = 100 %.
The spread that was a synthetic ±0.3 K offset (D3) is now caused by load imbalance.

### 6.5 Humidity

Dew point is conserved in sensible-only cooling, so T_dp = Magnus(avg_temp_c 22.4, avg_rh_pct 48) = 11.1 °C hall-wide. RH at a station follows
its temperature: at 25.4 °C RH = 40 %, at 26.5 °C RH = 37 %. The synthetic ±2 % RH per row (D8) is removed. The coil margin CHWS − T_dp =
19.4 − 11.1 = 8.3 K is the dry-coil check. A7 records the reference plane.

### 6.6 Pressure (Phase 5) and scenarios

- Plenum ΔP (raised-floor supply): ΔP = (ρ/2) · (V̇_row / (Cd · A_perf,row))², A_perf = tile open fraction × tile area × tiles on the row (A5).
- Containment ΔP (cold to hot aisle): ΔP = sign(Δ)·(ρ/2) · (|V̇_sup − V̇_IT| / (Cd · A_leak))² (A6). Positive = bypass side, negative = recirculation side.
  Both read "not modelled" until A5 and A6 are authored; nothing else depends on them.
- Scenarios (a collapsed "Simulate" menu in the existing scenario row; each is a named, deterministic input, no random pick):
  1. CRAH trip (select unit; standby-run or standby-start);
  2. containment breach on a row (sets k_top and a local deficit, A3);
  3. CHWS rise (+K; moves coil capacity, valve, SAT);
  4. row load step (+kW on one row);
  5. CRAH fan override (%).
  The old `fireExcursion` random pick (D6) is retired; the existing alarm and banner paths are reused with the named cause in the text.

## 7. Drawing and animation changes

### 7.1 Level of detail (one rule for 3D and Plan, driven by the drawing unit u that `floor-plan.js` already computes)

| LOD | when | adds |
|---|---|---|
| 0 | any u | what exists now: row tags (25), the hall CRAH tag, cabinet and CRAH lamps, air arrows. No new number is printed at rest (FL10 has headroom 0). |
| 1 | u ≥ 7 px (FL11 floor) | CRAH fan rotor (the site's broken-ring rotor, `css/conv-vfx.css .vfx-rotor`, period `RZConvVfx.rotorSeconds(speed)`); 4 station dots per line (state colour, no text) in Inlet-temp mode |
| 2 | u ≥ 12 px (3D at 1440) | valve stem glyph on each running CRAH; station dots in every mode; hot-aisle roof tint step by T_hot (the existing 3 steps, now from the row value) |
| tip | hover, focus, tap | tooltip with the full list for that symbol (cabinet, station, CRAH, row) |
| panel | click / tap | row panel (§5.1 table), station inspector (3 heights), CRAH inspector (§5.2), "Open equipment" → the CRAH modal |

### 7.2 Per symbol

| symbol | change | animation rule | state colour |
|---|---|---|---|
| CRAH fan | replace the static 12-gon with the broken-ring rotor inside an affine group (the face's iso matrix) so it turns in the face plane in 3D and flat in Plan | `animation-duration = rotorSeconds(speed_j)`; bucketed to 5 % steps so at most about 6 distinct durations; below 5 % or TRIP or STBY: no animation | running green lamp; trip alarm; standby grey dashed |
| CRAH valve | two-way valve glyph (ISA-5.1 / ISO 10628-2 bow-tie) on the unit's side face with a stem bar whose length = valve % | none (position, not motion); the bar steps to the value | amber at saturation, else ink |
| Air arrows | period from airflow ratio: `RZConvVfx.dashSeconds(V̇ / V̇_design, v0)` with a declared air design velocity v0 chosen so the period at ratio 1 is the present 1.4 s; cold arrows per aisle end from the serving unit's V̇, hot arrows from the row return | a TRIP unit's arrows stop (as today for an off unit, now by airflow, not by heat); reduced motion: still, arrowheads stay | cold blue, hot by T_hot step |
| Station dots | 8 per row; one dot per station | none | inlet state tokens (`--rz-pt-*`) |
| Hall CRAH tag | keeps "LA → RA"; fan mean, airflow total, running count go to its tooltip | none | point state |
| Row tag | unchanged shape (letter + current-mode value); tooltip carries return air, recirculation, bypass, RCI | none | point state |

### 7.3 Phone (390 px)

Plan is the default; the page does not scroll sideways (FL11). The stage keeps the per-band scroll. Stations appear as dots only when a row is
selected or the Inlet-temp mode is active; the row chip (44 px target) opens the row panel, which holds the 2 × 4 station grid, the three-height
triple, return air, β, γ, RCI, RTI. CRAH rotors draw only at u ≥ 7 px; below that a unit is a lamp. No extra text appears under the stage.

### 7.4 1440 px

3D default. All LOD 2 symbols draw. Numbers at rest stay at 30 or fewer (FL10); the new reads show on hover and in the right-hand panel, which
today lists 8 environment rows and adds: dew point margin, RCI, RTI, fan mean, airflow total.

## 8. Engine changes (conv-engine 2.6.0 → one shared minor, proposed 2.7.0 for all OPS-DEPTH PRDs)

| addition | content |
|---|---|
| `CONV_CALC.getRowAir(hallCode, rowKw[], scenario)` pure | per row and per station: V̇_sup, V̇_IT, β, γ, T_in, T_hot, T_ret, ΔT, RH, dew point, RCI, RTI; hall roll-ups; per CRAH: T_ret,j, duty_j, plus the §6.1 weight matrix |
| `getFleet('crah', hall)` extended | adds `airflowM3s`, `valvePct`, `returnC`, `satC`, `satSetpointC`, `satDevK`, `fanPowerIndexPct`, `status` (RUN / STBY / TRIP / MAN); `fanSpeedPct` becomes the §6.2 distribution; `state` for the 59th unit becomes `running` when Q1 = all run |
| new `cooling.*` keys | `crah_unit_airflow_rated_m3_s` (9.79), `crah_valve_rangeability` (50, A1), `crah_running_mode` ('all-run'), `crah_fan_power_index_pct`; `environment.dew_point_c`, `environment.condensation_margin_k` |
| compatibility | `crah_running`, `crah_available_kw`, `crah_n1_available_kw` keep their values; `crah_fan_speed_pct` stays the load-based figure for the legacy single-unit reader and is documented as the mean |
| registry | `data/conv-parameters.json` is generated: about 790 new ids (25 rows × 17, 59 CRAH × 6, hall 10); `data/conv-limits.curated.json` rows with `evidenceClass`; the point-coverage gate stays green |
| page | `buildZoneField()` and `crahUnits` call `getRowAir`; the literals `fan: 72`, `valve: 64` and the offset `((z·7919)%7−3)·0.1` are deleted; the Air path section and the CRAH modal read the same fleet |

DOM budget: at rest the page adds at most 40 `[data-point]` nodes (row panel and hall panel only); per-row and per-CRAH ids render when selected.
SVG budget: station dots + rotors + valve glyphs add at most 600 nodes (4,635 → ≤ 5,235, +13 %); build time ≤ 1.3 × today's 123 ms median (the
existing controlled A/B method from BMS-ISO §8).

## 9. Laws (each has a proof; "red today" is what the proof shows on tree `01c9aa43f`)

Proof files: node `tools/test-conv-datahall-depth.mjs` (engine, no browser, runs in `tools/run-conv-release-gates.sh`); browser
`tools/test-conv-datahall-depth-browser.mjs` (1440 and 390, authorised audit state, 3D and Plan); existing `tools/test-conv-datahall-air.mjs`,
`test-conv-floor-plan.mjs`, `test-conv-point-coverage.mjs` stay in `tools/ship-gate.sh`.

| id | claim | proof | red on today? | mutation that turns it red after |
|---|---|---|---|---|
| DH-L01 | every page that loads `conv-engine.js` has `?v=` equal to `RZ_ENGINE_VERSIONS.conv`; datahall draws 500 cabinets and 59 CRAH cells in an authorised state | node: read the 8 HTML pins; browser: count `[data-idx]` and `[data-crah]` | red: 7 of 8 pages mismatch; 0 cabinets | set one pin back to 2.5.0 |
| DH-L02 | `test-conv-datahall-air.mjs` passes with ≥ 48 checks on the post-v3.89.0 row contract (row tag = letter + current-mode point; click target = the tag in both projections; D3 reads the row's `datahall.row.<R>.*` points) | run the gate | red: 12 of 48 | make the tag value differ from the row point by 0.1 |
| DH-L03 | energy balance: Σ_rows Q = hall IT kW (±0.5 kW); Σ_j duty_j = hall heat (±0.5 kW) | node, normal and a trip scenario | n/a (no per-unit duty varies today) | change a weight so Σ w ≠ 1 |
| DH-L04 | airflow conservation: Σ_j V̇_j = Σ_z V̇_sup,z (±0.1 %) | node | red: constant 22.59 per row, 563 ≠ 565 | drop one CRAH from the map |
| DH-L05 | every row closes: V̇_sup·ρ·cp·(T_ret − T_sup) = Q_z (±0.5 kW) | node, 25 rows | n/a | use ΔT_IT = 10 in T_hot only |
| DH-L06 | no station is colder than the supply air: T_in(s) ≥ T_sup for all 200 stations | node | red: 11 of 25 rows below supply | restore the ±0.3 offset |
| DH-L07 | station array: 4 per line, positions cabinet 1, 4, 7, 10, 8 per row; the row panel shows 8 values equal to the points | browser: count dots and compare to `[data-point]` | red: 0 | draw 3 dots |
| DH-L08 | the three heights are equal at the adopted scenario and ordered bottom ≤ middle ≤ top when k_top > 0 | node | n/a | invert the profile |
| DH-L09 | per-CRAH return air: flow-weighted mean over units = hall mean return (±0.05 K); not all equal when row heats differ (SD > 0.05 K) | node | red: 58 identical | return the hall mean for each unit |
| DH-L10 | no literal fan % or valve % in `datahall.html`; CRAH inspector, Air path, modal and engine agree on fan %, airflow, valve % for unit 1 | grep for `fan: running ? 7` and compare four surfaces | red: 72 against 99.47 | restore `fan: running ? 72 : 0` |
| DH-L11 | valve opening follows q = R^(x − 1): x(q = 0.995) = 99.9 %, x(0.5) = 82 %, x(0.25) = 65 % (±0.5); never above 100 | node | red: constant 64 | use linear x = q |
| DH-L12 | all-run: 59 running at 97.8 %; fleet fan power index 55.2 against 57.1 for 58 + 1; a trip of unit 23 raises the others to 99.5 % and unit 23 reads 0 | node | red: 58 run, 1 standby | keep the 59th at 0 |
| DH-L13 | supply-air deviation is 0.0 K while the valve is below 100 %, positive above saturation; a CHWS rise of +K moves valve % up and, past capacity, SAT | node, scenario 3 | n/a | cap the valve at 90 % |
| DH-L14 | mixing: β = max(0, V̇_IT − V̇_sup)/V̇_IT and γ = max(0, V̇_sup − V̇_IT)/V̇_sup; never both > 0 in one row; RTI = (T_ret − T_sup)/(T_hot − T_in) | node | n/a | let both be positive |
| DH-L15 | RCI_HI = 100 % when all stations ≤ 27 °C and falls with a planted 28.5 °C station by the Herrlin formula; RCI_LO likewise at 17 °C | node: closed-form check on a fixture | red: no RCI | swap the two bands |
| DH-L16 | humidity: dew point 11.1 °C hall-wide; station RH from dew point and T; condensation margin = CHWS − dew point = 8.3 K; no synthetic ±2 % per row | node | red: 13.6 °C, per-row ±2 | reintroduce `(z·3571)%5 − 2` |
| DH-L17 | CRAH animation: running unit fan period = `rotorSeconds(speed)` within 1 % (bucketed); TRIP, STBY, speed < 5 % and reduced motion: 0 running animations; off screen: paused | browser: `getAnimations()` per `.cr-fan` | red: 0 of 59 animate | constant period |
| DH-L18 | air arrows: period = `dashSeconds(ratio)`; trip a unit and its aisle end's arrows stop; arrows follow airflow, not heat (raise a row's kW and the period does not change while airflow does not) | browser, perturbation seam | red: period follows heat | bind back to heat |
| DH-L19 | FL10: ≤ 30 numbers visible at rest in every mode at 1440; FL11 at 390: no sideways scroll, u ≥ 7 px, 44 px targets; no overlap between tags, dots, rotors and valve glyphs (bounding boxes) | existing `test-conv-floor-plan.mjs --target=datahall.html` plus a new overlap pass | green today (FL10 at 30 of 30) — must stay green | print one extra number |
| DH-L20 | 3D and Plan carry the same points: the set of `data-point` ids is equal across the two projections for the same selected row | browser | n/a | omit a station dot in Plan |
| DH-L21 | state colour only: every new glyph and dot uses `--rz-pt-*` or ink; 0 gradients, filters, glows; no blink | existing FL1 / FL6 / FL7 scan | green today; must stay | add a glow |
| DH-L22 | no `Math.random` in `datahall.html`; every scenario run twice gives identical output | grep + browser | red: 3 calls | add one back |
| DH-L23 | pressure points read "not modelled" until A5 / A6 are authored; when authored, plenum ΔP > 0 and containment ΔP has the sign of the airflow imbalance | node | n/a | return a number with A5 unset |
| DH-L24 | per-point trend and state: every new id resolves in the registry and the curated limits; point-coverage PC laws stay green | existing `test-conv-point-coverage.mjs` | green today; must stay | add an id without a registry row |
| DH-L25 | modal and sheet agree: CRAH modal values (fan %, airflow, valve %) equal the inspector | browser: open unit 1 modal | red: modal says "not modelled" | change one source |
| DH-L26 | scenarios: CRAH trip raises recirculation on rows near the unit, never lowers any station below supply; standby-run absorbs a trip with fans below 100 % while 59 run | node | n/a | skip the redistribution |
| DH-L27 | eye: screenshots at 1440 and 390, 3D and Plan, rest and planted trip, dark and light, looked at before the report | screenshots | — | — |

Red before green: the proofs marked "red" are run on `01c9aa43f` first and the output quoted in the phase's commit; each mutation is run once
and the gate shown red before it is reverted.

## 10. Phases (each shippable alone)

| phase | content | laws | notes |
|---|---|---|---|
| P0 | stamp the pin and add the pin gate (D1); re-point `test-conv-datahall-air.mjs` to the post-v3.89.0 contract (§2.5); drop the uncommitted Plan-pin edit | DH-L01, DH-L02 | no page behaviour change; small |
| P1 | engine 2.7.0: `getRowAir`, extended CRAH fleet, new keys, registry and limits rows; node tests; page reads them but still draws as today (D2, D3, D4, D9 fixed in the data) | DH-L03–L06, L09–L14, L16, L22 | closes the literal and the offset defects; no drawing change |
| P2 | CRAH depth in 3D and Plan: rotors, valve glyph, fan / airflow / valve / SAT in tooltip, inspector, modal, Air path; all-run N+1; arrows at airflow | DH-L10–L13, L17, L18, L21, L25 | owner question Q1 |
| P3 | temperatures: 4 stations per line, three heights on demand, return air per hot aisle and per CRAH, humidity and dew point against the envelope, row panel grid | DH-L07, L08, L16, L19, L20 | attach the TC 9.9 clause; confirm A7 |
| P4 | indices: recirculation, bypass, RCI, RTI, ΔT across racks, row density; hall panel | DH-L14, L15 | Herrlin bands confirmed from the paper first |
| P5 | pressure and scenarios: A5, A6 authored by the owner; plenum and containment ΔP; named scenarios replace the random excursion | DH-L23, L26, L22 | needs owner values (Q3) |

Risks
- Changing the row model moves existing numbers (hall mean inlet +0.36 K, hot-aisle and ΔT per row, dew point 13.6 → 11.1 °C). Existing
  laws that read these (D3 of the air gate, FL laws, the dc-conventional rollup) are re-pointed in the same release; no ratchet is re-recorded
  silently. The hall mean stays within 0.5 K of the engine's 25.4 °C target (a law in P1).
- 59 rotating elements in a 4.6k-node SVG: bucketed durations and the existing off-screen pause keep it inside the §8 budget; the A/B is
  repeated in one browser on one lane (controlled, per the BMS-ISO measurement rule).
- FL10 has zero headroom: any printed number at rest needs an owner decision to raise the law; this PRD prints none.
- The ASHRAE envelope numbers and Herrlin bands are cited from memory of the papers and the repo's 2015 table; each is checked against the
  source before it becomes an alarm limit (the standard texts are paywalled; the repo's limits file is the working source).
- Parallel sessions share the `rz-work` checkout: stage by hunk; the v3.93.0 release commit is another session's work.

Open questions for the owner (only taste or scope)
1. Q1: CRAH N+1 as all 59 running at 97.8 % (reference, this PRD's default, same idea as the chiller "standby running") or keep 58 + 1 cold standby?
2. Q2: row spread as derived physics (rows differ 25.4–26.5 °C because load differs while CRAH air is spread evenly; this PRD's default) or a
   balanced hall where every row reads 25.4 °C and the differences appear only under a scenario?
3. Q3: for pressure, can I author a perforated-tile open fraction and a containment leakage area as declared ASSUMED values (A5, A6), or is
   containment ΔP to stay "not modelled" until real hall data exists?
