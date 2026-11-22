# PRD-CONV-OPS-DEPTH · 07 DC-Conventional (site overview) — one screen that tells the operator, in numbers, whether the site is healthy, redundant, and where its capacity runs out

Status: DRAFT for owner (2026-11-22). Parent: PRD-CONV-OPS-DEPTH/README.md.
Page: `dc-conventional.html` (174,984 B), scripts it loads: `js/conv-engine.js`, `js/conv/point-status.js`, `js/conv/motion.js`, `js/conv/quiet.js`, `js/conv/shell.js`, `js/conv-alarm-events.js`, `js/conv-alarm-workspace.js`, `js/rz-trend.js`, `js/rz-sheet.js`.
Peer PRD: **PRD-ELECTRICAL-BMS** owns EPMS (`EPMS_Telemetry.html`, SLD, breakers, ATS, relays). This PRD reads EPMS through a summary contract only (section 7.3) and does not redesign any EPMS symbol, view or logic.

---

## 1. Owner request

Verbatim lines (2026-11-22, Indonesian) that apply to the overview:

- "ini masih sangat kurang implement all, rancang prdnya"
- "dan juga page2 lain selain chiller plant ini, rancang masing2 prd utk perbaikan dan improvement."
- "banyak dah yang belum ada, ini masih kurang komprehensive"

Meaning for this page: the overview is the screen an operator looks at first and most. It must read like a real site BMS summary: each subsystem shows the few operating numbers that decide its health (PUE and partial PUE, IT kW, cooling kW, chillers running N of M, CRAH running and average fan speed, UPS load %, genset state, fuel hours, water autonomy, fire state), alarms are counted by ISA-18.2 priority, redundancy is shown as what is actually available now, capacity headroom is explicit, and energy flow is drawn as a Sankey whose bands and motion are proportional to kW. Every number is the engine, the page's simulation, or the text "not modelled".

## 2. Measured state today

Measured on the worktree at commit `01c9aa43f` (v3.93.0) with `grep`, `node` and the engine loaded in a `vm` context.

### 2.1 What the page is

| Item | Count | Where |
|---|---|---|
| Site drawing | 1 raster photo, `assets/DC_Conventional.jpg`, 173,557 B, `alt="Conventional Data Center"`. Not a schematic, no live element in it | `dc-conventional.html` "Dashboard Image with Callouts" |
| Callouts laid over the photo | 6 (PUE, IT load, CHW, Temp, Fuel, RH outdoor), absolutely positioned in % | `.callout` |
| KPI cards | 8 (PUE, WUE, Grid factor, IT load, Uptime, Temp, Chillers, Alarms) | `.kpi-strip` |
| Stats-panel rows | 34 rows in 8 sections (Design basis, Efficiency, Power, Cooling, Network and Reliability, Environment, Safety, Fuel) | `aside.stats-panel` |
| Subsystem links | 7 (EPMS, Data Hall, Chiller Plant, Fire, Fuel, Water, ICT), each is a bare link with a tooltip, no number | `nav.rz-cockpit-nav` |
| Distinct `data-point` ids (click opens trend) | 14 in the file, 13 in the dashboard body | grep |
| Distinct `data-basis-param` ids | 22 | grep |
| Rows that print UNAVAILABLE | 9: Uptime (KPI), CRAHs, Network, UPS Topology, Uptime YTD, DP, FACP, VESDA, Day Tank | `title="UNAVAILABLE — …"` |
| Engine snapshot keys the dashboard reads | 36 of 322 registry parameters (11 %); 122 registry parameters have zero page consumers anywhere | `updateData()` lines 1553-1745; `data/conv-parameters.json` |
| Refresh | `setInterval(updateData, 5000)` repaints a frozen snapshot: nothing can change between ticks | line ~1744 |
| Scenario control | none. `ACTIVE_SCENARIO_ID = 'normal'` is hard-coded in `js/conv-engine.js:108`; 4 scenarios exist (day1-low 4,500 kW, normal 30,000, peak 36,000, capacity-test-100 40,000) and the operator cannot select one | engine |
| Hall A to D selector | none, although `standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md` section 3 item 2 requires it | standard |
| Schematic | none (item 3 of the same hierarchy) | standard |
| Redundancy and consequence panel | none (item 5): the strings "2N" and "N+1" appear only as design-basis text rows `sbUpsRed`, `sbChRed` | standard |
| Accent colours on non-state numbers | 4 inline (`kpiPue` cyan, `kpiCarbon` green, `kpiChillers` cyan, `kpiAlarms` green) plus 6 coloured callouts | KPI markup, `.callout.cyan/.orange/.green/.purple/.blue` |

### 2.2 Operator's list against what is shown (16 items)

| # | Item the owner and an operator expect | Shown today | Basis today |
|---|---|---|---|
| 1 | PUE live | partial | `kpiPue`, `cPue`, `sPue` print `site.pue` = 1.45, a constant. The engine holds `site.pue` at 1.45 in all 4 scenarios (it is `STUDY_INPUT.pue.designPoint`, `conv-engine.js:541`); it is a design value, not a live one, and the page does not say so |
| 2 | Partial PUE (electrical, mechanical) | no | none. The engine already has the terms (UPS loss 1,250 kW, mechanical plant 4,622.1 kW at normal) and nothing reads `cooling.mech_plant_input_kw` |
| 3 | IT kW | yes | `site.it_load_kw` (`kpiIt`, `cIt`, `sItLoad`) |
| 4 | Cooling kW (mechanical input) | no | `cooling.mech_plant_input_kw` = 4,622.1 kW exists, 0 consumers |
| 5 | Chillers running N of M | yes, count only | `kpiChillers`, `sChillers` = 7/10; the 3 standby units are not distinguished from units in maintenance (see 2.3) |
| 6 | CRAH running N of M | no | `sCrahs` is UNAVAILABLE; yet `getFleet('crah', hall)` returns 58 running and 1 standby of 59 per hall (232 of 236 for 4 halls) |
| 7 | CRAH average fan speed | no | `cooling.crah_fan_speed_pct` = 99.5 exists, 0 consumers |
| 8 | UPS load % | yes | `sUpsA`, `sUpsB` print the same two numbers (37.5 % normal, 75 % failover); 2 rows, 1 truth |
| 9 | Genset state | no | `getFleet('genset', hall)` returns 8 units per hall, all `standby`, 32 total; not shown |
| 10 | Fuel hours | yes | `sAutonomy` 48 h from `fuel.autonomy_hr` |
| 11 | Water autonomy | no | not on the page; the raw-tank number lives only in `water-system.html` (`RAW_TANK_M3 = 150`, `rawPct = 82`) as a page literal, not an engine key |
| 12 | Fire state | no | the Safety section is two UNAVAILABLE rows (FACP, VESDA). The engine reports fire-water reserve level 92 %, duration 42 min against 60 min required, shortfall 36 m³ and the page shows none of it |
| 13 | Alarms by ISA-18.2 priority | no | strip shows 2 levels (Critical, Warning) from 4 page-local rules (PUE > 1.5, environment band, fuel autonomy, chillers_running <= 1). No priority, no state, no consequence |
| 14 | Redundancy available now | no | design strings only (2.1) |
| 15 | Capacity headroom | partial | campus utilisation 75 % (`campus.utilisation_pct`) only; no per-chain headroom, no binding constraint |
| 16 | Energy flow, proportional to kW | no | the photo is static |

Score: 4 present, 2 partial, 10 absent of 16.

### 2.3 Defects measured in the existing alarm strip (`paintAlarmStrip`, lines 1563-1620)

1. **Standby counted as maintenance.** `maint = chillers_total - chillers_running` = 3 at normal. The engine has only two fleet states, `running` and `standby`; no unit is in maintenance. The strip shows "Maint / Bypass 3".
2. **False critical at Day-1.** Rule `if (chRun <= 1) crit++` ("no spare capacity") fires when the engine runs 1 of 10 chillers (day1-low), with 9 units ready. Measured: `ch 1/10`, `n1 margin 40,313 kW_th`. The strip would say ALARM on the quietest, safest scenario.
3. **Two thresholds for one quantity.** Fuel autonomy: the strip warns below 24 h and is critical below 12 h; the limits registry (`fuel.autonomy_hr`, `lo_alarm: 24`) makes 24 h a red alarm in the point colour. Same value, amber in the strip and red in the number.
4. **Missing real alarm.** Fire-water reserve covers 42 min of a required 60 min (36 m³ short). The strip reads NORMAL at the same time.
5. **Loaded but unreachable from the counts.** `js/rz-alarm-state.js` (the ISA-18.2 state machine, 4 tiers critical/high/medium/low) is not loaded on this page (0 references). `js/conv-alarm-events.js` carries 14 seeded events (3 critical, 4 high, 5 medium, 1 low, 1 info) dated 2026-08-27 across 7 systems; none of the strip counts is derived from them and they carry no link to the snapshot.

### 2.4 Authority state on this tree (reported, not part of this PRD's design)

`dc-conventional.html:932` loads `js/conv-engine.js?v=2.5.0` while the engine publishes `meta.version = '2.6.0'` and `js/rz-engine-versions.js` pins `conv: '2.6.0'`. `convCurrentAuthority()` compares the `?v=` token with the pin and returns null on mismatch, so this page (and 6 other cockpits: chiller-plant, datahall, fire, fuel, ict, water; only `EPMS_Telemetry.html` carries 2.6.0) renders UNAVAILABLE. `node tools/test-conv-engine-version-pins.mjs` fails (`actual: '2.5.0', expected: '2.6.0'`). This is the known "one-line staleness blanks every cockpit" trap; Phase 0 below closes it for this page.

## 3. Reference design

How a real mission-critical site overview is built and operated.

| Topic | Design | Basis |
|---|---|---|
| Information order | alarm and state strip first, then site efficiency and capacity, then subsystem summaries, then drill-down links | `CONVENTIONAL_DC_OPERATIONS_STANDARD.md` section 3; ISA-101 (HMI) level-1 overview |
| Level-1 overview rule | the overview shows the state of every subsystem and the 4 to 6 numbers that decide it; detail lives one click away (sheet, trend, modal). Normal state is visually quiet | ISA-101 hierarchy; standard section 3 |
| Alarm priority | each alarm has a priority by consequence and allowed response time, a state (unacknowledged, acknowledged, returned-to-normal, shelved, suppressed), and a stated consequence and operator action. Counts by priority are the level-1 summary | ISA-18.2 / IEC 62682 rationalisation and lifecycle. The distribution of roughly 5 % high, 15 % medium, 80 % low is an informative review target in ISA-18.2 and EEMUA 191, never a gate |
| Redundancy | state "available now" as spare units after removing failed and maintenance units, not the design label. N means no spare, N+1 one spare, 2N two independent paths each able to carry 100 % | Uptime Institute Tier standard (Tier III N+1 concurrently maintainable, Tier IV fault tolerant 2N); IEC 62040-3 for UPS; ASHRAE 90.4 for the efficiency side |
| Standby-running | modern plants keep the standby unit running at low load (or hot, ready) so a failure is a load shift, not a start; the page must show duty and standby as separate counts and never count standby as fault or maintenance | ASHRAE Guideline 36 sequences (stage by demand, rotate lead/lag); owner request item 2 |
| PUE and partial PUE | PUE = total facility energy / IT energy. pPUE = (IT + the energy of one boundary subsystem) / IT, reported per subsystem, so that the sum of excess terms explains the PUE. Terms not measured must show as an explicit remainder, never be folded into a plausible total | ISO/IEC 30134-2; The Green Grid WP#49 (pPUE); ASHRAE 90.4 |
| Capacity | headroom is per chain at N-1 (electrical, cooling, fuel, water), and the site's usable capacity is the smallest of them (the binding constraint) | Uptime Institute (capacity at failure), ASHRAE TC9.9 for the thermal envelope |
| Energy flow | Sankey: band width proportional to kW, conservation at every node, losses shown as bands leaving the diagram | Sankey convention; first-law energy balance |
| Contingency drill | operator can ask "what if this unit trips" and see the resulting redundancy and priority, clearly labelled as a simulation | Uptime Institute operational sustainability; common BMS "what-if" panels |

## 4. Goals and non-goals

Goals
- G1 Replace the photo with a level-1 overview: alarm strip by ISA-18.2 priority, efficiency block (PUE and partial PUE), energy-flow Sankey, 8 subsystem tiles (7 subsystems + redundancy), capacity headroom row.
- G2 Every tile number is an engine key, a page simulation function, or "not modelled".
- G3 Redundancy is "available now", derived; a contingency selector (simulation) shows the effect of one unit lost.
- G4 One alarm computation feeds the strip, the KPI, the tile badges and the Alarm History count.
- G5 Phone (390 px) and desktop (1440 px): no overlap, no text outside drawings, no line through text, no sideways scroll.
- G6 Fill what the engine already has but the page does not show (CRAH counts close 1 of the 9 UNAVAILABLE rows; fire reserve, genset state, mechanical kW, CRAH fan speed are added as new rows); keep the other 8 honestly "not modelled".

Non-goals
- No EPMS redesign (PRD-ELECTRICAL-BMS owns SLD, breakers, ATS, relays, protection). The overview consumes a summary only.
- No new dynamics. Everything is a steady-state relation on the frozen snapshot or a scenario switch.
- No uptime percentage, no network health, no VESDA state: no source exists; they stay "not modelled" until their page PRDs publish shared keys.
- No design-report change (sections 1 to 10 of the generated report, lines 1953-2640, are untouched).

## 5. Parameter catalogue

Source codes: ENG = existing engine key; ENG-NEW = new engine key (section 8); SIM = page simulation function (named); NM = not modelled. "Shown" uses: T = tile value, S = strip, K = tooltip, M = modal/drill-down link, R = trend (click). Every value is a `data-point` (state from the limits registry, click opens the trend) or `data-const` (rating or design value).

### 5.1 Alarm strip (ISA-18.2)

| Parameter | Unit | Source | Shown | Limits / basis |
|---|---|---|---|---|
| Active alarms P1 critical | count | SIM `RZConvOverview.alarms(snapshot)` | S | priority table 6.2 |
| P2 high / P3 medium / P4 low | count | SIM same | S | 6.2 |
| Unacknowledged | count | SIM (operator state, per browser session, labelled SIM) | S | ISA-18.2 state UNACK |
| Shelved / suppressed | count | SIM | S, K | ISA-18.2 SHLV / SUP |
| Standing > 1 h (stale alarms) | count | NM (frozen snapshot has no alarm clock) | K | needs event time |
| Maintenance / out of service | count | NM (engine fleets have `running`/`standby` only) | S | replaces today's wrong "Maint / Bypass" |
| Comms / data quality / scenario / page clock | text | ENG `meta.data_quality`, `meta.scenario`, browser clock | S | unchanged |

### 5.2 Efficiency block

| Parameter | Unit | Source | Shown | Basis |
|---|---|---|---|---|
| PUE (design basis) | – | ENG `site.pue` = 1.45, labelled "design, adopted" | T | ISO/IEC 30134-2; constant in all 4 scenarios (measured) |
| Electrical pPUE | – | ENG-NEW `site.ppue_electrical` = 1 + `electrical.ups_loss_kw` / `site.it_load_kw` (1.042 at normal) | T | Green Grid WP#49 |
| Mechanical pPUE | – | ENG-NEW `site.ppue_mechanical` = 1 + `cooling.mech_plant_input_kw` / `site.it_load_kw` (1.154 at normal) | T | WP#49 |
| PUE not modelled | – | ENG-NEW `site.pue_unmodelled` = `cooling.mech_plant_headroom_kw` / `site.it_load_kw` (0.254 at normal; CRAH fans, lighting, controls, distribution losses are not in the 4,622.1 kW per standard section 23c) | T | remainder, shown dashed grey |
| Cooling kW (mechanical input) | kW | ENG `cooling.mech_plant_input_kw` = chillers 3,212.5 + pumps 1,135.6 + tower fans 274.0 | T | ASHRAE 90.4 mechanical load |
| Plant kW/RT | kW/RT | ENG `cooling.plant_kw_per_rt` = 0.36 | K | AHRI 550/590 basis |
| IT kW / facility kW / non-IT kW | kW | ENG `site.it_load_kw`, `site.facility_load_kw`, `site.non_it_load_kw` | T | – |
| WUE | L/kWh | ENG `environment.wue_l_per_kwh` | T | limit `hi_warn 1.3` exists |
| Grid factor | kg/kWh | ENG `environment.carbon_kg_per_facility_kwh` | K | ISO/IEC 30134-8 (CUE) |
| Live PUE vs load / wet-bulb | – | NM: the engine holds plant specific power constant (`plant_kw_per_rt` 0.36 in every scenario, pPUE moves 0.001) and has no ambient wet-bulb input; PUE cannot honestly move until it does | K | stated on the tooltip |

### 5.3 Subsystem tiles (max 6 numbers each, all click to trend; the tile title links to the subsystem page)

| Tile | Parameter | Unit | Source | Limits / basis |
|---|---|---|---|---|
| **Chiller plant** | Chillers duty (running) / total | N of M | ENG `cooling.chillers_running`, `chillers_total` | – |
| | Standby ready | N | ENG-NEW `cooling.chillers_standby_ready` = total − running (fleet state `standby` count) | – |
| | Plant load | % | ENG `cooling.chiller_part_load_pct` | – |
| | CHWS / CHWR / ΔT | °C | ENG `cooling.chws_c`, `chwr_c`, `chw_delta_t` | limits exist for CHWS, CHWR |
| | CHW secondary / CDW pumps running | N of M | ENG `chw_secondary_pumps_running`, `cdw_pumps_running` (+ fleet totals) | – |
| | Tower cells running / fan speed | N of M, % | ENG `tower_cells_running`, `tower_cell_count`, `tower_fan_speed_pct` | – |
| **Data Hall** | IT kW per hall A to D | kW | ENG `getHallSnapshot(h).it_load_kw` | – |
| | CRAH running / installed (campus) | N of M | ENG-NEW `cooling.crah_running_total`, `crah_installed_total` = Σ over halls of `crah_required`, `crah_required + 1` (232 of 236 at normal) | – |
| | CRAH average fan speed | % | ENG `cooling.crah_fan_speed_pct` (0 consumers today) | affinity: fan speed = unit load % at constant air ΔT |
| | Supply / return air | °C | ENG `crah_supply_air_c` (limit exists), `crah_return_air_c` | ASHRAE TC9.9 |
| | Average white-space temp / RH | °C, % | ENG `environment.avg_temp_c`, `avg_rh_pct` | limits exist (ASHRAE A1 18 to 27 °C, 20 to 80 %) |
| **EPMS** (summary only, PRD-ELECTRICAL-BMS owns the rest) | UPS load per side normal / on failover | % | ENG `electrical.ups_load_pct_normal` (37.5), `ups_load_pct_on_failover` (75) | limit exists on normal (45 warn, 50 alarm) |
| | UPS 2N available | yes/no | SIM: both systems energised and `on_failover` <= 100 | IEC 62040-3 |
| | Genset state | N running of M | ENG fleet: `getFleet('genset', h)` states (0 running, 32 standby at normal) | – |
| | HV transformer load at N-1 | % | ENG `electrical.hv_tx_load_pct_n1` (72.7) | – |
| | EPMS total vs facility | kW | ENG `electrical.epms_total_kw` vs `site.facility_load_kw` | metering tolerance `electrical.metering_tolerance_pct` |
| | Breaker, ATS, relay state | – | NM here; read through the EPMS summary contract (7.3) when the peer ships it | – |
| **Fire** | Fire-water reserve level | % | ENG `fire.level_pct` (92) | limit exists (60 alarm, 80 warn) |
| | Duration at demand vs required | min | ENG `fire.duration_min` (42) vs `fire.required_duration_min` (60); shortfall `fire.capacity_shortfall_m3` (36) | NFPA 13 / NFPA 20 basis in the engine |
| | Zones / static pressure | N, bar | ENG `fire.zone_count`, `fire.static_pressure_bar` | limit exists on pressure |
| | FACP / VESDA state | – | NM until the fire page publishes shared keys | – |
| **Fuel** | Bulk tank level / usable | %, L | ENG `fuel.level_pct`, `fuel.usable_l` | limits exist (30/60/95) |
| | Autonomy at campus load | h | ENG `fuel.autonomy_hr` (48) | limit exists (24 alarm) |
| | Consumption at campus load | L/h | ENG `fuel.generator_consumption_lph` | – |
| | Day-tank level | % | NM (stays UNAVAILABLE; engine has no day tank) | – |
| **Water** | WUE and makeup | L/kWh, L/min | ENG `water.wue_l_per_kwh`, `water.total_treated_lpm` (608) | limit exists (1.3) |
| | Cooling-tower makeup parts | L/min | ENG `water.evaporation_lpm` (447.8), `blowdown_lpm` (149.3), `drift_lpm` (3) | – |
| | Raw-water storage and autonomy | m³, h | ENG-NEW `water.raw_tank_m3`, `water.raw_autonomy_h` = `raw_tank_m3` × level% × 1000 / `total_treated_lpm` / 60 (3.4 h at 150 m³, 82 %) | limits exist on level (`water.raw_tank_pct`); shared with the Water page PRD |
| **ICT** | Network health, bandwidth | – | NM on the overview (no engine source; `ict.util_pct` and `ict.poll_freshness_s` are the ICT page's own simulation) | – |
| **Redundancy** (8th tile) | per class: required, available, spare | N | 6.1 | Uptime Institute |

### 5.4 Capacity headroom row

| Parameter | Unit | Source | Basis |
|---|---|---|---|
| IT headroom (design − load) | kW | ENG `site.it_design_kw − site.it_load_kw` (10,000 at normal) | – |
| Electrical headroom at N-1 | kW IT | SIM = `ups_system_rated_kw` − `it_load_kw` (2N: one system must carry all) | IEC 62040-3, Tier IV 2N |
| Cooling headroom at N-1 | kW IT | SIM = `cooling.chiller_n1_margin_kw_th` / (`heat_rejection_kw` / `it_load_kw`) (13,750 / 1.0417 = 13,200 at normal) | first law: heat rejected = IT + UPS loss |
| CRAH headroom at N-1 | kW | ENG `crah_n1_available_kw` − hall sensible demand | – |
| Genset headroom at N-1 | % | ENG `electrical.genset_n1_margin_pct` (15.9) | – |
| Fuel headroom | h above the 24 h floor | ENG `fuel.autonomy_hr` minus the `lo_alarm` of the `fuel.autonomy_hr` limit (24, read from the limits registry, never typed) | – |
| Binding constraint | name | SIM = argmin of the IT-equivalent headrooms | Uptime Institute |

## 6. Control logic to model

All steady-state relations on the snapshot, all deterministic (no `Math.random`).

### 6.1 Redundancy available now

For each class c with required duty units R_c and available healthy units A_c = running + standby-ready − units the operator has tripped in the contingency selector:
- spare_c = A_c − R_c. Label: spare < 0 "DEFICIT" (P1), 0 "N", 1 "N+1", k "N+k". The design label (`cooling.chiller_redundancy`, `electrical.ups_redundancy`) is shown in the tooltip next to it.
- Classes and keys: chillers (R = `chillers_running`, A = total), CHW primary / secondary pumps, CDW pumps, tower cells (fleet counts), CRAH per hall (R = `crah_required`, A = `crah_installed`), UPS systems (2N: both energised and `on_failover` <= 100 gives "2N"; one lost gives "N, single path"), gensets per hall (N-1 test via `genset_n1_margin_pct`), HV transformers (`hv_tx_load_pct_n1` <= 100).
- Result today at normal (engine): chillers 7 duty + 3 standby (N+3, design N+1), CHW secondary pumps 4 + 1, CRAH 58 + 1 per hall, UPS 2N, gensets 0 running of 32.

Contingency selector (SIM, labelled "SIMULATION — not a plant state"): choose class and unit, "trip one" or "trip two". The model recomputes spare, redundancy labels and the alarm list. At capacity-test-100 (engine: 9 of 10 chillers duty, N-1 margin 3,333 kW_th) tripping one running unit leaves spare 0 (N) and tripping two gives DEFICIT. Nothing writes to the engine; reload restores the snapshot.

### 6.2 Alarm rationalisation (ISA-18.2) — priority, consequence, action

Four tiers match `js/rz-alarm-state.js` (critical, high, medium, low), shown as P1 to P4. Each rule names its source, so no number is typed on the page.

| Rule | Source | Priority | Consequence | Operator action |
|---|---|---|---|---|
| Redundancy deficit on cooling, UPS, genset (A < R) | 6.1 | P1 | IT load at risk on next fault | start standby, shed load, call on-call |
| Spare = 0 (N) on cooling, UPS, genset | 6.1 | P2 | next fault loses capacity | restore unit, plan maintenance window |
| UPS `on_failover` > 100 % | ENG | P1 | one UPS side cannot carry the load | shed load |
| UPS normal load above limit | ENG limit (45 warn → P3, 50 alarm → P2) | P3 / P2 | 2N no longer holds on a side loss | rebalance |
| Fuel autonomy < 24 h | ENG limit `lo_alarm 24` | P2 | generator SLA missed | order fuel |
| Fuel level < 30 % | ENG limit | P1 | – | order fuel now |
| Fire reserve duration < required (42 < 60 min today) | ENG | P2 | suppression water below the design basis | reserve top-up; compensating measures |
| Fire reserve level < 60 % | ENG limit | P1 | – | – |
| White-space temp > 32 °C | ENG limit | P1 | ASHRAE A1 envelope breached | per Data Hall page |
| White-space temp > 27 °C or < 18 °C | ENG limit | P3 | outside recommended | check CRAH |
| CHWS outside alarm band | ENG limit | P2 | cooling capacity change | per Chiller page |
| PUE > 1.5 | ENG | P4 | efficiency | advisory |

Priority assignment is owner-ratifiable (open question 2). Counts are a function of the same rule table that renders the strip, the KPI, the tile badges and the Alarm History badge (one computation, many sinks). Alarm History keeps its 14 seeded events as a modelled ledger and labels them "modelled history"; they are not mixed into the live counts.

Existing page rules removed or changed: `chillers_running <= 1` critical (false at Day-1), `maint = total − running` (standby is not maintenance), strip fuel 12/24 h (replaced by the registry's limits so the number and the strip agree).

### 6.3 What the scenario buttons change

A scenario selector (4 buttons, labelled SIMULATED) sets the model and recomputes. The engine currently hard-codes the active scenario; Phase 2 exposes `CONV_CALC.setScenario(id)` (re-runs `compute`, republishes the snapshot, same version). Measured effect, to be asserted by law L8: day1-low shows 1 of 10 chillers duty and 9 spare, 9 of 10 CRAH per hall, UPS 5.6 %; peak 8 of 10 chillers, UPS 45 %; capacity-test-100 UPS 50 % and 3,333 kW_th chiller N-1 margin. The selector stays hidden in a production build flag until the owner accepts it (open question 1).

## 7. Drawing and animation

### 7.1 Layout (desktop 1440 px, top to bottom)

1. **Alarm strip** (existing component, rebuilt): state word, P1 to P4 counts as 4 chips, unacknowledged count, Alarm History button, scenario chip, data quality, page clock.
2. **Efficiency block**: IT kW, facility kW, PUE (design), electrical pPUE, mechanical pPUE, "not modelled" remainder as a dashed segment of one horizontal stacked bar whose segment widths are the excess terms (1.000 + 0.042 + 0.154 + 0.254 = 1.45).
3. **Sankey** (7.2).
4. **Tiles**: 4 columns by 2 rows (7.4).
5. **Capacity headroom row**: 6 horizontal bars (IT, electrical N-1, cooling N-1, CRAH N-1, genset, fuel), the shortest bar outlined and named "binding".
6. Design basis stats panel moves into a collapsed "Design basis" disclosure (22 `data-basis-param` rows are kept, nothing is deleted).

### 7.2 Energy-flow Sankey

Bands (kW, electrical, at normal): Utility 43,500 → UPS path 31,250 → IT 30,000 and UPS loss 1,250 (leaves as heat); Utility → Mechanical plant 4,622.1 → chillers 3,212.5, CHW and CDW pumps 1,135.6, tower fans 274.0; Utility → Not modelled 7,627.9 (hatched grey dashed, labelled "not modelled", CRAH fans, lighting, controls, distribution). A second strip below shows the thermal path in kW_th: IT heat + UPS loss 31,250 → CRAH and CHW → chillers → condenser water → towers → ambient (`cooling.tower_rejection_kw_th`).

Rules
- Band width = kW × k, with k chosen so the Utility band is 28 px at 1440 px and 16 px at 390 px; any band below 2 px is drawn as a 2 px hairline and labelled in its value tag (e.g. "tower fans 274 kW"). Widths are computed in `RZConvOverview.sankey(snapshot)`, a pure function.
- Conservation at every node within 0.5 kW; a node whose outputs do not sum to its input draws the difference as a red "unaccounted" band and raises a P3 data-quality alarm (this cannot fire with the current engine; it protects the next change).
- Flow motion: dashes along each band move at `RZConvVfx.dashSeconds(ratio)` with ratio = band kW / design facility kW (`site.it_design_kw × site.pue` = 58,000 kW). A band at 0 has no motion. Reduced motion: no dashes move; widths, values, direction arrows stay.
- State colours only: running green for live bands, amber when its source alarm is P2/P3, red for P1, grey dashed for "not modelled" and standby. No glow, no gradient, no decorative motion.
- Labels: value tag at each node and band, 11 px minimum (HMI standard L5), none under a band; the test checks no band polygon intersects a label box.
- Phone (390 px): the Sankey rotates to vertical (top to bottom), the same bands, labels to the right of the nodes. No horizontal scroll.

### 7.3 EPMS summary contract (peer PRD)

The EPMS tile reads `window.RZConvEpms.summary()` if PRD-ELECTRICAL-BMS publishes it (fields: `sourceState`, `atsState`, `upsMode` per side, `gensetsRunning`, `breakerOpenCount`, `relayTripCount`, each with quality and timestamp). Until then the tile shows the ENG values in 5.3 and "not modelled" for the rest. This PRD does not define EPMS symbols, views, or logic.

### 7.4 Tile design

- Tile = title (links to the subsystem page), state badge (worst priority inside it, from the alarm list), 4 to 6 numbers as `data-point` values, a pip row for unit counts.
- Pip row: one pip per unit, solid green = running, dashed grey = standby-ready, amber = warning, red = alarm; fixed 8 px pips, wraps; for 236 CRAH units the pip row is replaced by per-hall bars (58+1 each).
- Two small rotor glyphs only where a speed is shown: CRAH average fan speed and tower fan speed. Blades turn at `RZConvVfx.rotorSeconds(speed %)` (100 % = 1.0 s per turn, below 5 % no turn).
- No other animation. Reduced motion: rotors stand still, values remain.
- Text budget: tile detail goes into the tooltip and the drill-down; the page passes `tools/test-conv-text-budget.mjs`.
- Phone: tiles stack to 1 column, the collapsed tile shows title, badge and its first 2 numbers; the others open on tap.

### 7.5 Open-issue replacement of the photo

`assets/DC_Conventional.jpg` and the 6 callouts are removed (their 6 numbers are in tiles and the efficiency block). The file stays on disk until the owner confirms.

## 8. Engine changes (conv-engine 2.6.0 → 2.7.0, additive, no removed key)

| New key | Formula | Source / standard | Scope |
|---|---|---|---|
| `site.ppue_electrical` | 1 + `electrical.ups_loss_kw` / `site.it_load_kw` | Green Grid WP#49, ISO/IEC 30134-2 | site |
| `site.ppue_mechanical` | 1 + `cooling.mech_plant_input_kw` / `site.it_load_kw` | same | site |
| `site.pue_unmodelled` | `cooling.mech_plant_headroom_kw` / `site.it_load_kw` | remainder of `non_it_load_kw − ups_loss_kw − mech_plant_input_kw` | site |
| `cooling.chillers_standby_ready` | `chillers_total − chillers_running` (fleet `standby` count) | fleet state | plant |
| `cooling.crah_running_total` / `crah_installed_total` | Σ over halls of `crah_required` / `crah_required + 1` | fleet totals (per-hall keys exist) | plant |
| `water.raw_tank_m3` | ADOPTED authored: 4 h × `water.total_treated_lpm` × 60 / 1000, rounded up to 50 m³ (= 150) | the value now typed in `water-system.html` (`RAW_TANK_M3`) | plant |
| `water.raw_level_pct` | ADOPTED authored 82 (the value now typed in `water-system.html`) | page literal moved into the engine | plant |
| `water.raw_autonomy_h` | `raw_tank_m3 × raw_level_pct/100 × 1000 / total_treated_lpm / 60` | mass balance | plant |
| `CONV_CALC.setScenario(id)` | re-run `compute` with the scenario from `listScenarios()`; same `meta.version` | scenario table | – |

Shared work: the three water keys are shared with the Water page PRD in this family; whichever ships first adds them, the other reads them. CRAH fan electrical kW is not added: it needs a rated fan kW per CRAH that no engine input provides; it stays "not modelled" until the owner approves an ASSUMED nameplate input (then P = P_rated × (speed %)³, affinity law, ASHRAE Handbook HVAC Systems and Equipment). Registry regeneration (`tools/build-conv-parameter-registry.mjs`) and limits additions: new limits only where a basis exists (`site.ppue_mechanical` has none, so it is `info`, never coloured).
Engine version pin: `js/rz-engine-versions.js` is generated; the `?v=` token on `dc-conventional.html` follows it (gate `test-conv-engine-version-pins.mjs`).

## 9. Laws and proof

"Red today" is stated for the worktree at `01c9aa43f`. Browser tests use the puppeteer pattern of `tools/test-conv-dashboard-authority.mjs` (engine source served with `ACTIVE_SCENARIO_ID` replaced to run another scenario). New node tests live in `tools/test-conv-overview-*.mjs`; the pure module `js/conv/overview-model.js` (`RZConvOverview`) is Node-testable.

| ID | Law | Proof (test, assertion) | Red on today? |
|---|---|---|---|
| L1 | The page's pinned engine version equals the engine's | `test-conv-engine-version-pins.mjs` V2 for `dc-conventional.html` (`?v=` token = `meta.version`) and a browser load shows `#convAuthorityBadge` not "AUTHORITY UNAVAILABLE" | Yes: `actual '2.5.0', expected '2.6.0'`. Mutation: set the token to 2.4.0 → red |
| L2 | Every number on a tile is a `data-point`, a `data-const`, or the text "not modelled"; no literal digits in tile markup | `test-conv-overview-bindings.mjs`: each tile key exists in `data/conv-parameters.json`; regex over tile HTML finds 0 bare numeric literals; `test-conv-point-coverage.mjs` baseline unchanged or lower | Module absent → red. Mutation: type "58" into a tile → red |
| L3 | Chillers duty N of M and standby-ready equal the fleet, in all 4 scenarios | `overview-model` vs `getFleet('chiller')` counts for each scenario engine (normal 7/10 + 3, day1-low 1/10 + 9, peak 8/10 + 2, capacity-test-100 9/10 + 1) | No tile today → red. Mutation: swap running and standby → red |
| L4 | CRAH running and installed (campus) equal Σ over halls of the fleet; average fan speed equals the mean of running-unit `fanSpeedPct` within 0.1 | node test: normal 232 of 236, mean 99.47 vs `crah_fan_speed_pct` 99.5 | `sCrahs` UNAVAILABLE → red. Mutation: use hall A only → 58 → red |
| L5 | pPUE terms close: (ppue_electrical − 1) + (ppue_mechanical − 1) + pue_unmodelled = `site.pue` − 1 within 0.001, and `pue_unmodelled` ≥ 0 | node test in each scenario | Keys absent → red. Mutation: multiply `tower_fan_fleet_kw` by 50 → `pue_unmodelled` < 0 → red |
| L6 | PUE is labelled "design, adopted", never "live", while the engine holds it constant | browser: tooltip text of the PUE value contains "design"; node: `site.pue` identical across the 4 scenario engines (asserts the label is still true; if the engine ever varies it, the label rule fails and forces review) | Label absent → red |
| L7 | Alarm counts are one computation: strip P1..P4, KPI, tile badges and Alarm History count agree | browser: read all sinks, compare to `RZConvOverview.alarms(snapshot).length` by priority | Sinks disagree on principle (2 levels vs 4) → red |
| L8 | Day-1 (1 of 10 chillers, 9 ready) raises no P1 and Maintenance count is 0 when no unit is in maintenance | browser with `ACTIVE_SCENARIO_ID='day1-low'` and `'normal'`: `#as-crit` = 0; maintenance count = 0 | Yes: today `chRun <= 1` → crit 1 at day1-low; `as-maint` = 3 at normal. Mutation: restore `chRun <= 1` → red |
| L9 | The fire-water shortfall is an alarm: 42 min against 60 min required gives one P2 at normal | node test of `alarms()` at normal: exactly one P2 (fire), P1 = 0 | Strip reads NORMAL today → red |
| L10 | Priority rules use registry limits, not typed thresholds | node: no numeric literal in the rule table other than 0 and 100 (redundancy and `on_failover`); fuel and temperature thresholds read from `limits(id)`; strip fuel alarm at 24 h agrees with the point colour | Today 12/24 in the strip, 24 red in the point → red |
| L11 | Redundancy available equals (running + standby − tripped) − required for every class; the contingency model gives the stated labels | node: capacity-test-100 trip 1 chiller → spare 0 "N", trip 2 → "DEFICIT"; normal: 7 duty + 3 standby → "N+3"; UPS 2N true iff `on_failover` ≤ 100 | Absent → red. Mutation: count standby as zero → red |
| L12 | Capacity headrooms use the stated relations; binding constraint is the smallest | node: normal cooling 13,200 kW IT (13,750 / 1.0417), electrical 10,000; capacity-test-100 binding = electrical N-1 (0 kW) | Absent → red |
| L13 | Sankey conserves energy and widths are proportional | node: Utility = IT + UPS loss + mechanical + unmodelled within 0.5 kW (43,500 = 30,000 + 1,250 + 4,622.1 + 7,627.9); browser: band stroke-width ratios equal kW ratios within 1 px (bands < 2 px excluded) | No Sankey → red. Mutation: drop the unmodelled band → conservation red |
| L14 | Flow motion is monotonic in kW and zero at zero | node: `dashSeconds(ratio)` smaller for the larger band; a 0 kW band has no animation | No Sankey → red |
| L15 | Reduced motion leaves no running animation, values remain | browser with `prefers-reduced-motion: reduce`: `document.getAnimations()` for `.cv-flow` and rotors = 0; value text unchanged | Rotor/flow absent → red |
| L16 | State colours only on numbers: computed colour of each tile and strip value is page ink or one of `--rz-pt-ok/warn/alarm`; no inline accent colour | browser: scan overview values | Yes: 4 inline accent KPIs + 6 coloured callouts. Mutation: add `style="color:cyan"` → red |
| L17 | Layout: at 390 and 1440 px no overlap, no text outside its drawing, no band across a label, no sideways scroll | browser geometry test (pattern of `test-conv-declutter.mjs`): bounding boxes of tile text, Sankey labels, bands; `scrollWidth <= clientWidth` | New layout absent → red. Mutation: widen a tile to 500 px → overflow red |
| L18 | No fabricated function: contingency and scenario controls are labelled SIM, write nothing to the engine, and a reload restores the snapshot; no `Math.random` in the overview module | node: grep module; browser: trip, reload, state equals baseline | Controls absent → red |
| L19 | Every UNAVAILABLE row left is a true "not modelled" (no engine key exists); every row the engine can fill is filled | node: for each remaining NM row assert no registry key matches; closes 1 of 9 (CRAHs); the remaining 8 are true NM and each must name why: uptime KPI, uptime YTD (no downtime log), network, UPS topology, DP, FACP, VESDA, day tank | 9 UNAVAILABLE today → red |
| L20 | Existing gates stay green | `node tools/run-conv-release-gates.sh` subset: dashboard-authority, text-budget, declutter, point-coverage, snapshot-binding, motion | Baseline: green except L1 (V2) |

Mutations that must go red are listed beside each law; each law's check is run once on the unmodified or mutated state and the red output quoted in the release note (red before green, proof law 3).

## 10. Phases, risks, open questions

### Phases (each shippable alone)

| Phase | Content | Depends on | Laws |
|---|---|---|---|
| P0 | Fix the `?v=` pin to the generated version for this page; no design change. Prove the page renders again | none (owner of the pin fix is the release that bumped the engine; coordinate with the other 6 cockpit PRDs) | L1 |
| P1 | New overview markup: tiles and efficiency block from existing keys only; fill CRAH counts (via fleet, closes the CRAHs UNAVAILABLE row), add fire reserve, genset state, fuel inventory, `crah_fan_speed_pct`, `mech_plant_input_kw` rows; state colour discipline; rotors | P0 | L2 L3 L4 L16 L17 L19 |
| P2 | `RZConvOverview` model: ISA-18.2 alarm list, redundancy, contingency selector, `setScenario`, priority table; alarm strip rebuilt; load `rz-alarm-state.js`; remove the 3 strip defects | P1 | L7 L8 L9 L10 L11 L18 |
| P3 | Engine 2.7.0: pPUE keys, Sankey and thermal strip, motion | P1 | L5 L6 L13 L14 L15 |
| P4 | Capacity headroom row, water raw-tank keys (with Water PRD), EPMS summary read (with PRD-ELECTRICAL-BMS) | P2, peers | L12 |

### Risks

- Blanking risk: bumping the engine blanks every cockpit (proven in v1.134.23). Mitigation: the pin gate L1 runs before any engine change.
- Parallel sessions: `dc-conventional.html` is also touched by other PRDs of this family (nav, shell). Stage by hunk, never `git add` the file blindly.
- Honest PUE: a plant that does not vary PUE looks dull. Mitigation: show the remainder and say "design". Do not tune constants to make it move.
- Alarm count rule drift: the priority table is a product decision. It lives in one file, covered by L10.
- CRAH tile with 236 units: aggregated by hall; per-unit detail stays on the Data Hall page.
- Performance: the Sankey is ≤ 14 bands, SVG; offscreen pause follows `css/conv-hmi-depth.css`.

### Open questions for the owner (taste and scope only)

1. Should the scenario selector (day1-low, normal, peak, capacity-test-100) be visible to every visitor, or only behind a flag as a training/what-if mode?
2. Is the priority mapping in 6.2 acceptable (for example fire-reserve shortfall as P2, standby exhausted as P2, redundancy deficit as P1), or do you want a different ranking for fire and fuel?
3. Remove the photo `DC_Conventional.jpg` and its 6 callouts entirely, or keep it as a collapsible "Site photo" for orientation?
