# PRD-CONV-OPS-DEPTH · 03 Water System — the water plant reads like a real operator screen: levels that drain, pumps that turn, a make-up balance that closes with the heat

Status: DRAFT for owner (2026-11-22). Parent: PRD-CONV-OPS-DEPTH/README.md (common rules C1–C7 apply).
Page: `water-system.html` (sheet WT-M-101, `js/conv/water-sheet.js`, page script inline, engine `js/conv-engine.js`).
Measured on tree `01c9aa43f` (v3.93.0), headless Chrome at 1440 and 390 px, 2026-11-22.

## 1. Owner request

> "chiller plant itu juga masih sangat kurang ... dan juga page2 lain selain chiller plant ini, rancang masing2 prd utk
> perbaikan dan improvement."
> "banyak dah yang belum ada, ini masih kurang komprehensive"

Meaning for this page: show every operating parameter of a data-centre water plant: make-up water, storage tanks (level %,
hours of autonomy), transfer/booster pumps (running count, speed %, pressure), water treatment (conductivity, cycles of
concentration, blowdown rate, chemical dosing), tower make-up = evaporation + drift + blowdown with the relation, WUE,
filtration DP, leak detection, valve positions, and animation of flows and levels. "Implement all."

## 2. Measured state today

### 2.1 Headline counts

| # | measurement | value | how |
|---|---|---|---|
| M1 | Sheet symbols (nodes) / lines (edges) | 19 drawn nodes (26 incl. 7 junctions) / 29 edges (18 potable, 6 drain, 2 condenser water, 1 chemical, 2 instrument) | `RZWaterSheets.pid`, DOM `.hmi-node`, `path.hmi-edge` |
| M2 | Value tags on the sheet | 27; 10 read an engine key, 17 are page-typed or simulated; 2 have no point id (XV-202 state, P-301B state) | `[data-val]`, `water-system.html` consts |
| M3 | **Engine pin** | the page requests `conv-engine.js?v=2.5.0`, the engine is `2.6.0` (`js/rz-engine-versions.js`). The page fails closed: **27 of 27 sheet tags read UNAVAILABLE and 0 lines move, at 1440 and 390 px.** 7 pages carry the 2.5.0 token. With the token patched in a proxy, the numbers below are what the page shows | puppeteer run, `scrollWidth` = viewport, 0 page errors |
| M4 | Moving flow lines (token patched) | 23 of 29, **all at one period, 0.5 s**: the 608 L/min raw line, the 8 L/min domestic line and the 149 L/min blowdown line move at the same rate (`RZConvVfx.bind(host, sheet, flow)` passes no `ratio`, so `dashSeconds(1)` applies to all) | `data-vfx-speed` set = {0.5} |
| M5 | Rotating pumps | **0 of 2** (`[data-spin]` = 0: `bind` passes no `speed`). The standby leg `e-pb1/e-pb2` is hard-coded `stopped`; P-301B prints "AVAILABLE" | `waterFlow()` line 1044 |
| M6 | Valves drawn / showing a position | 3 (XV-202, XV-501, XV-502) / **0** with an opening or stem; XV-501 (the make-up control valve) carries no value at all; XV-502 is hard-coded `open` | `waterRead` |
| M7 | Tanks | 2 drawn (TK-101, TK-402) with a liquid fill (2); level, volume and autonomy are static seeds (82 %, 88 %); the tower basin (62 %) has a number but no fill; the level never changes | `hmi-depth` `levels`, `rawPct`, `domPct`, `BASIN_PCT` |
| M8 | Page-typed constants behind the numbers | 14: `rawPct 82`, `domPct 88`, `BASIN_PCT 62`, `pt301Bar 4.2`, `filterDp 0.40`, `tds 140`, `cl2 0.85`, `cl2Res 0.6`, `uvInt 99.8`, `pumpKw 7.5`, `RAW_TANK_M3 150`, `DOM_TANK_M3 30`, inline `2.1` (mains bar) and `2.4` (filter inlet bar) | grep, lines 799–808, 855–880 |
| M9 | Points with a limits row and a history shape | 6 of the 25 distinct sheet points (raw tank, domestic tank, filter DP, TDS, UV, WUE). PT-301, P-301A kW, CT-501 basin, blowdown, evaporation, autonomy: none | `data/conv-limits.curated.json`, `data/conv-points.json` |
| M10 | Alarm list | 6 rows; 1 (`Dosing DOS-302 running`) is a literal OK, not a measurement | `renderAlarmList` |
| M11 | Scenario controls | 3 buttons. "Simulation Mode" only ripples the trend line with `Math.random` (2 calls, `water-system.html` ~1388–1392); "Simulate Backwash" toggles a flag for 5 s and **leaves `filterDp` at 0.40** (the modal text says the cycle is 5 min); the 3 test-seam trips (`rawtank`, `filter`, `domtank`) change one number and nothing responds to it | `toggleSimulation`, `triggerBackwash`, `TRIPS` |
| M12 | Equipment modal classes (water) | 5 payload classes (`water:tankStorage`, `pumpCentrifugal`, `instField`, `flowMeter`, `filterCartridge`); none for valve, dosing pot, UV, tower cell on this sheet; 0 "inside" views for water (internals exist only for chiller, pumps of the cooling kinds, tower, CRAH, electrical) | `js/conv/payloads.js`, `js/conv/internals/` |
| M13 | Tower cells | engine: 10 cells, 7 running, fan 89.3 %, 4,923 kW per cell; the sheet draws 1 cell and prints none of it | `cooling.tower_cells_running`, `tower_fan_speed_pct` |
| M14 | Trend | 1 chart, 2 series (filter DP, make-up); the DP series is a flat 0.40 plus random ripple | `pressureTrend` |

### 2.2 The water balance does not close with the heat (engine, not display)

Engine today (`water.*`): make-up 600.0 L/min (= WUE 1.2 L/kWh × 30,000 kW / 60), drift 3.00, blowdown 149.3, evaporation 447.8,
C = 4.0. M = D + B + E closes to −0.1 L/min (rounding). But the same engine rejects **34,462.5 kW_th** through the towers
(`cooling.tower_rejection_kw_th`; circulation 7 × 235.2 L/s = 98,784 L/min, range 5 K, so m·cp·range = 34,460 kW, consistent).
Energy balance: E_max = Q / h_fg = 34,462.5 / 2,419.5 kJ/kg (h_fg = 2,501 − 2.361·T at the 34.5 °C mean water) = 14.24 kg/s =
**854.6 L/min**. The engine evaporates **447.8, 52 % of the physical upper bound**. Consequences:

- WUE 1.2 L/kWh is below the thermodynamic floor of this plant: evaporation alone is 854.6 × 60 / 30,000 = **1.71 L/kWh** even at
  infinite cycles. At C = 4 the make-up must be M = E·C/(C−1) = 855–1,140 L/min (WUE **1.71–2.28**) for a sensible share of 25–0 % (§3.3).
- In the engine, raising C from 4 to 6 at fixed make-up *raises* evaporation (447.8 → 497.6 L/min). Evaporation is set by heat,
  not by cycles. Today the split is a formula on a fixed total, so the displayed "EVAP" cannot be right.
- "CH-PLANT heat rejected 31,250 kW" is the chilled-water load (`cooling.heat_rejection_kw`); the tower rejects 34,462.5. The tag
  mislabels the condenser loop.
- Blowdown uses B = (M − D)/C = 149.3; the solids balance with drift carrying basin water gives B = M/C − D = 147.0. The
  definition is not stated anywhere an operator can read.
This was already recorded in PRD-CONV-EQUIPMENT-INSIDE (§ tower: "per-cell share would be wrong by about half"). This PRD
closes it (P1) once the owner picks the basis (Q1).

### 2.3 Equipment class by class (what is shown, what a real plant screen shows and this one lacks)

| class / tag | shown now (value tags, source) | missing for a real operator (count) |
|---|---|---|
| Mains inlet, FM-101 | flow 608.0 L/min (ENG `water.total_treated_lpm`), mains 2.1 bar (typed) | raw inflow vs outflow balance, totaliser (daily m³), mains-fail state, second feed / tanker fill (4) |
| Raw tank TK-101 + LIT-101 | level 82 % (SIM), volume 123.0 m³, autonomy 3.4 h at total flow (derived); fill drawn | net fill/draw L/min, time to low (40 %) and low-low (30 %), level trend, inlet valve, hi level, overflow (6). Autonomy 3.4 h vs 4 h sizing text |
| Media filter FLT-201 | DP 0.40 bar (typed), 2.4 → 2.0 bar (typed) | filtration velocity, clean DP, DP loading %, last backwash, backwash count, backwash volume (6) |
| Backwash valve XV-202 | INHIBIT / ACTIVE text | position feedback, cycle step and time left, inhibit reason (3) |
| Booster P-301A/B | RUN · 7.5 kW (typed); AVAILABLE | running count, speed %, flow each, suction and discharge bar, dP, kW from the hydraulic chain (derived 3.0 kW), alternation, fault state, standby-running (8). Rotor still |
| PT-301 | 4.2 bar (typed) | setpoint vs actual, suction pressure PT-300 (2) |
| Chlorine DOS-302 | 0.85 L/h (typed), residual 0.6 ppm (typed) | flow pacing, dose mg/L, tank level, pump stroke %, residual vs setpoint (5) |
| UV-401 | intensity 99.8 % (typed) | UV dose mJ/cm² at current flow, lamp hours, transmittance, flow-through (3) |
| Domestic tank TK-402 + service | 88 %, 26.4 m³, 55.0 h autonomy, draw 8.0 L/min | hours to low (50 %) and low-low (40 %), refill rate (2) |
| Make-up FT-501 / XV-501 | FT-501 600.0 L/min (ENG) | **valve opening %**, basin level controller SP/PV/OUT, totaliser (3) |
| Tower CT-501 | basin 62 % (typed), EVAP 447.8, DRIFT 3.00, COC 4 (ENG, see 2.2) | cells running N/M, fan speed %, make-up per cell, basin conductivity, basin level fill, CDW flow (6) |
| Blowdown XV-502 | 149.3 L/min (ENG), state open (typed) | conductivity SP and PV, valve open/closed + duty %, blowdown as % of circulation (3) |
| Chemical treatment (tower) | none drawn | inhibitor dosing, biocide dosing, conductivity probe AIT, pH/ORP, side-stream filter, make-up softener/RO (6 equipment, all absent) |
| Leak detection | none | mass-balance residual, alarm, drill (3) |
| Conductivity / TDS | one KPI "Treated TDS 140 ppm" (typed; limits 350/500) | basin TDS/conductivity (the typed 500 ppm limit would already be exceeded by 4 × 140 = 560 ppm) (3) |

Total: 27 value tags today; this PRD adds about 60 operating parameters (§5) and 6 pieces of equipment.

## 3. Reference design (how a modern DC water plant is built and run)

### 3.1 Sources and storage
- Two independent supply routes where available plus on-site storage sized for a declared autonomy; a tanker fill connection.
  Storage hours are a project requirement (the Uptime Institute Tier standard asks for on-site water autonomy for water-cooled
  sites; the hours come from the owner's declared class, commonly 12 h at Tier III/IV; EN 50600-2-3 for the environmental
  control availability class). Tank level shown with time-to-alarm, not only hours-at-full: t = (L − L_alarm)·V / Q_draw.
- Tank alarms: LAL (low), LALL (low-low), LAH; inlet valve on level control; overflow to drain (ISA-5.1 tagging).

### 3.2 Booster / transfer sets (pump skid)
- 2 × 100 % (N+1) VFD pumps on a common header holding a discharge-pressure setpoint (PIC), duty/assist staging, weekly
  alternation of lead. Modern design is **standby-running**: both pumps run at the shared speed so a trip is seamless;
  speed follows flow by the affinity laws (Q ∝ n, H ∝ n², P ∝ n³; ISO 9906, Hydraulic Institute). Minimum speed 30 % (ASHRAE HVAC
  Systems and Equipment, pumps); below it a pump stages off. Hydraulic power P = ΔP·Q (IEC/ISO 9906), electrical = P / (η_p η_m η_VFD).

### 3.3 Cooling-tower water balance and treatment
- Evaporation is fixed by the heat rejected: E = Q_latent / h_fg, Q_latent = f·Q_tower. Sensible share (1 − f) depends on dry-bulb
  versus water temperature; at the engine design point (wet-bulb 27 °C, CDW 32 → 37 °C) the mean water temperature (34.5 °C) is
  near the dry bulb, so f is close to 1 (band 0.75–1.0 declared below). Sources: ASHRAE Handbook — HVAC Systems and Equipment,
  cooling towers; CTI.
- Cycles of concentration C = κ_basin / κ_makeup = M / (B + D). Solids balance: M·κ_m = (B + D)·κ_b. Therefore
  **E = M·(1 − 1/C)**, **B + D = E / (C − 1)**, **M = E + B + D**. Increasing C reduces blowdown and make-up and leaves E unchanged.
- Blowdown is controlled by a conductivity controller (AIC) opening XV-502 above the setpoint κ_SP = C_target·κ_makeup, closing
  with a hysteresis; the time-averaged valve duty = B / B_valve.
- Chemical programme (ASHRAE Standard 188 and Guideline 12 water-management programme; vendor programme): scale/corrosion
  inhibitor paced by the make-up meter (dose ∝ M), alternating oxidising/non-oxidising biocide on a timer with ORP/residual
  feedback, pH, side-stream filtration of the loop, optional make-up softener or RO. WUE per The Green Grid WP#35: site water ÷ IT energy.

### 3.4 Filtration and disinfection
- Media filter: Darcy flow through the bed, ΔP_clean ∝ Q (laminar), loading raises ΔP; backwash on ΔP, time or volume, with an
  inhibit when the downstream tank is low. UV disinfection dose D = I·t = I·V_reactor / Q; NSF/ANSI 55 Class A requires 40 mJ/cm²
  (US EPA UV guidance). Chlorine is flow-paced: dose [mg/L] = pump [L/h] · conc [g/L] · 1000 / Q [L/h]; residual limits come from the
  site water safety plan (WHO GDWQ).

### 3.5 Valves and leaks
- Control valves are sized with IEC 60534 / ISA-75.01 (linear trim: opening = Q / Q_max at constant ΔP, authority β ≥ 0.5); discrete
  valves carry ZSO/ZSC feedback. Leak detection = continuity balance of meters (AWWA M36 water audit): unaccounted =
  inflow − Σ(consumers) − dV/dt, alarmed above a threshold; floor leak cables belong to the data-hall PRD (02).

## 4. Goals / non-goals

Goals: G1 the page binds the engine it loads (M3); G2 make-up, evaporation, drift, blowdown and WUE follow one stated physical
relation; G3 every pump, valve, tank, filter, doser and the tower cell shows its operating parameters (§5); G4 flow, rotors, fans, stems
and levels move at a rate set by the number beside them; G5 scenarios have consequences (mains loss, pump trip, fouled filter,
leak, IT load); G6 limits, history and tooltips for every new point; G7 390 px and 1440 px clean.

Non-goals: fire-water (PRD 04) and fuel (PRD 05) storage; data-hall leak cables (PRD 02); softener/RO/UF design (Q3); dynamic PID
transients (steady-state relations only); real telemetry (data stays "Simulated"); changing the engine WUE figure without Q1.

## 5. Parameter catalogue

Legend: ENG = existing engine key; ENG+ = new engine key (formula given, §8); SIM = page simulation, pure function in the new
`js/conv/water-ops.js` (node-testable); NM = "not modelled" printed as such. Where: S1 sheet tag at fit (lod 1), S2 sheet tag when
zoomed (lod 2), T tooltip, M equipment modal, TR trend. ADOPTED/ASSUMED follow the engine's evidence classes (vendor or BoD to confirm).

### 5.1 Mains and raw storage
| parameter | unit | source | where | limits |
|---|---|---|---|---|
| Mains flow in | L/min | ENG `water.total_treated_lpm` + SIM backwash average | S1 | none |
| Mains pressure | bar | SIM 2.1 → ENG+ `water.mains_bar` ADOPTED | S2 | LAL ASSUMED |
| Raw level TK-101 | % | SIM, seed ENG+ `water.raw_level_seed_pct` | S1, TR | existing row 30/40 |
| Raw volume | m³ | ENG+ `water.raw_tank_m3` (150, ADOPTED, sized 4 h) × level | S2 | none |
| Net fill/draw | L/min | SIM = inflow − draw | S2, T | none |
| Autonomy, full | h | V·L / Q_draw | S2 | none |
| **Time to LAL / LALL** | h | (L − L_alarm)·V / Q_draw (82 %: 1.73 h / 2.14 h) | S1, T | warn < 4 h ASSUMED, alarm < 2 h |
| Daily intake | m³ | SIM integral | T | none |

### 5.2 Filtration
| parameter | unit | source | where | limits |
|---|---|---|---|---|
| DP FLT-201 | bar | SIM: DP = (DP_c + λ·(DP_bw − DP_c))·Q/Q_des; DP_c = 0.20 ASSUMED (vendor), DP_bw = 0.80 (limit row) | S1, TR | 0.65 / 0.80 existing |
| Loading λ | % | SIM state; seed = (0.40 − 0.20)/(0.80 − 0.20) = 33 % | S2 | none |
| Filtration velocity | m/h | Q / A, A ENG+ ADOPTED | T | NM until A declared |
| Backwash step / time left | state, s | SIM state machine (§6.2) | S1 (XV-202), M | none |
| Backwashes today, last backwash | n, h | SIM counter | T | none |
| Inlet / outlet pressure | bar | SIM (typed 2.4 today) → ENG+ `water.filter_inlet_bar` ADOPTED, outlet = inlet − DP | S2 | none |

### 5.3 Booster set P-301A/B
| parameter | unit | source | where | limits |
|---|---|---|---|---|
| State per pump | RUN / STBY-RUN / OFF / FAULT | SIM (§6.1) | S1 | FAULT = alarm |
| Running count | N of 2 | SIM | S1 title, T | N < required = alarm |
| Flow each | L/min | Q_total / N | S2 | none |
| **Speed** | % (and Hz at 50 Hz) | ENG+ `water.booster_speed_pct` = Q_each / Q_rated · 100 (affinity Q ∝ n, friction-dominated; pressure reset not modelled) | S1, T, M | min 30 % |
| Suction / discharge / dP | bar | SIM / SIM / ENG+ `water.booster_dp_bar` = discharge − suction | S2 | discharge LAL/HAH ASSUMED |
| Hydraulic and electrical kW each | kW | ENG+: P_h = ΔP·Q_each, P_e = P_h / (0.80 · 0.95 · 0.97) via the engine's `pumpElectricalKw` chain (3.0 kW total today vs 7.5 typed) | S2, M | none |
| Alternation / run hours | h | SIM | T | none |
| Arrangement | text | ENG+ policy `water.booster_standby_running` ADOPTED true | T | none |

### 5.4 Disinfection and dosing
| parameter | unit | source | where | limits |
|---|---|---|---|---|
| Cl₂ dose | L/h and mg/L | ENG+ `water.cl2_dose_lph` = Q_total·60 · dose_mg_L / (conc_g_L · 1000), dose and conc ADOPTED | S1 | high/low dose |
| Cl₂ residual | ppm | SIM = dose − demand (ASSUMED) | S2 | site safety plan |
| Chlorine tank level | % | NM | – | – |
| UV intensity | % | SIM (existing) | S1 | 70 / 85 existing |
| **UV dose** | mJ/cm² | ENG+ `water.uv_dose_mj_cm2` = I_nom·(I %/100)·V_uv·60 / Q_total; I_nom, V_uv ADOPTED | S2, T | alarm < 40 (NSF/ANSI 55 A) |
| Lamp hours, transmittance | h, % | NM | – | – |
| Inhibitor dose (new DOS-601) | L/h | ENG+ `water.inhibitor_dose_lph` = M·60 · mg_L / (density · 1000), mg/L ADOPTED (vendor) | S1 | deviation > 10 % |
| Biocide dose (new DOS-602) | L/slug, slugs/week | ASSUMED timer; NM for ORP | T | – |

### 5.5 Treated tank TK-402 and service
| parameter | unit | source | where | limits |
|---|---|---|---|---|
| Level, volume | %, m³ | SIM + `water.dom_tank_m3` 30 | S1 | 40 / 50 existing |
| Time to LAL / LALL | h | (L − L_alarm)·V / Q_draw: 88 % at 8 L/min = 23.8 h / 30.0 h | S2 | – |
| Draw | L/min | ENG `water.domestic_lpm` | S1 | none |
| Refill rate | L/min | SIM = inflow − draw | T | none |

### 5.6 Make-up valve, tower and blowdown
| parameter | unit | source | where | limits |
|---|---|---|---|---|
| Make-up flow | L/min | ENG `water.flow_lpm_for_wue` (P1b: ENG+ energy-based, Q1) | S1 | none |
| **XV-501 opening** | % | ENG+ `water.makeup_valve_opening_pct` = Q / Q_max · 100, Q_max = 1.25 × design make-up (ADOPTED sizing margin, linear trim, β ≥ 0.5) = 80 % today | S1 stem, T | > 95 % warn |
| Basin level (LIC-501) | % | SIM (seed 62) | S1 fill | 40 / 30 ASSUMED |
| Cells running, fan speed | N of 10, % | ENG `cooling.tower_cells_running`, `cooling.tower_fan_speed_pct` | S1, M | existing |
| CDW circulation | L/s | ENG+ `water.tower_circulation_lps` = `cdw_pump_flow_lps` × `cdw_pumps_running` = 1,646.4 | T | none |
| Evaporation | L/min | ENG+ `water.tower_evaporation_lpm` = f·Q_tower / h_fg·60 (P1b); today ENG | S1 | none |
| Energy-balance bound | L/min | ENG+ `water.tower_evaporation_max_lpm` = 854.6 (f = 1) | T | engine < 0.75 × max = flag |
| Drift | L/min | ENG `water.drift_lpm` (0.5 % of M) | S2 | none |
| **Blowdown** | L/min, % of circulation | ENG; ENG+ `water.blowdown_pct_circulation` (0.15 %) | S1 | none |
| XV-502 state, duty | OPEN/CLOSED, % | SIM state; duty = B / B_valve (ENG+ `water.blowdown_valve_lpm` ADOPTED) | S1 | none |
| **Basin conductivity** | µS/cm | ENG+ `water.basin_conductivity_us_cm` = C · κ_m; κ_m = TDS_m / 0.65 (TDS/κ ratio ADOPTED, Standard Methods 2510) = 861 | S1, TR | high = C_max·κ_m, C_max ASSUMED 6 |
| Make-up conductivity | µS/cm | ENG+ 215 | S2 | none |
| Basin TDS | ppm | ENG+ = C · TDS_m = 560 | T | separate row from the 350/500 treated limit |
| Cycles of concentration | – | ENG+ `water.coc_actual` = κ_b / κ_m = M / (B + D); setpoint `water.tower_cycles_of_concentration` | S1 | deviation > 10 % |
| pH, ORP | – | NM | – | – |
| Side-stream filter FLT-601 | L/s, DP | flow = s × circulation, s ADOPTED (Q3) | S2 | DP row ASSUMED |

### 5.7 Balance, WUE, leak
| parameter | unit | source | where | limits |
|---|---|---|---|---|
| WUE (cooling) | L/kWh | ENG `water.wue_l_per_kwh` = M·60 / IT_kW; target ENG 1.30 | S1 | existing |
| WUE all treated | L/kWh | ENG `water.wue_all_treated_l_per_kwh` | T | none |
| **Reconciliation** | L/min, % | ENG+ `water.makeup_energy_balance_lpm` for f ∈ [0.75, 1.0] = 855–1,140; ratio = engine / band low = 0.70 | T, M | flag when engine make-up < band low (flag today) |
| Closure | L/min | M − (E + D + B), unrounded | T | > 0.05 = alarm |
| **Leak residual** | L/min | SIM = FM-101 − (FT-501 + service + backwash avg) − dV/dt | S1, TR | warn > 1 %, alarm > 2 % of inflow, ASSUMED (AWWA M36) |

## 6. Control logic to model (steady-state relations, no fake dynamics)

6.1 **Booster staging.** N_req = ceil(Q / (Q_rated·0.9)); standby-running: N_run = N_installed, speed = Q/(N_run·Q_rated);
if speed < 30 % → N_run −1; trip of A → B alone at speed Q/Q_rated (608/608 = 100 %), alarm "standby carries 100 %", A state FAULT.
Lead alternates each 168 h (SIM counter). Hydraulic power is ΔP·Q; part-speed efficiency loss is not modelled.
6.2 **Backwash.** IDLE → request when DP ≥ 0.80 bar (or λ ≥ 100 %), inhibit while TK-402 < 40 % → BACKWASH 5 min (XV-202 open,
`e-bw1/e-bw2` run) → RINSE → IDLE with λ = 0. The page shows a simulation clock factor (×60: 5 s ≡ 5 min) so the 5 s demo and the
5 min text no longer disagree.
6.3 **Make-up and basin level.** LIC-501 holds the basin at 62 %: XV-501 opening = Q / Q_max. Scenario "XV-501 stuck closed":
basin falls at (E + D + B)/A_basin, closed form; time to LAL is shown.
6.4 **Blowdown.** AIC opens XV-502 above κ_SP = C_target·κ_m, closes below with hysteresis; steady-state duty = B / B_valve. C_target
is the one tuning input (3–6); scenario "C_target 6" (f = 1): B + D falls from 284.9 to 170.9 L/min, M from 1,139.5 to 1,025.5, E stays 854.6.
6.5 **Dosing.** inhibitor ∝ M, Cl₂ ∝ Q_total; both change with the IT-load scenario.
6.6 **Tanks.** Mains-loss drill: inflow 0; level(t) = L0 − Q_draw·t / V; the alarm fires at the closed-form t*; TK-101 reaches LAL in
1.73 h and LALL in 2.14 h from today's seed. Leak drill adds a loss of ℓ L/min at the basin; the residual shows ℓ.
6.7 **Scenario buttons (replace "Simulation Mode"):** select = Normal, Mains loss, Booster A trip, Filter fouled (λ 90 %), Leak 2 %,
C_target 6, IT load 50 %. Each changes named inputs; nothing is random. The old random trend ripple is removed (C3).

## 7. Drawing and animation changes

| symbol | add | animation rule | phone |
|---|---|---|---|
| Flow lines (29) | none new | dash period from `RZConvVfx.dashSeconds(flow / design flow of the line)`; design flows from ENG (608, 600, 8, 149.3, CDW 1,646.4 L/s, dose lines) | unchanged |
| P-301A/B | speed % and kW tags, STBY-RUN grey dashed → green running | `data-spin`, `rotorSeconds(speed)`: 50 % each = 2.0 s/turn; standby leg `e-pb1/e-pb2` flows at its share | 1 value at fit (speed), rest lod 2 |
| Tanks TK-101, TK-402, basin | level fill on the basin, level and time-to-LAL tags | fill height = level %; changes only when the scenario changes it (no idle motion) | fill only at fit |
| XV-501 | valve glyph with stem and opening tag | stem travel = opening %; no motion when steady | tag lod 2 |
| XV-202, XV-502 | open/closed glyph (ZSO/ZSC), duty on 502 | position follows command | tag lod 2 |
| CT-501 | fan rotor, N/M cells, conductivity tag | `rotorSeconds(89.3 %)` = 1.12 s | 2 tags at fit |
| FLT-201 | DP bar fill against 0.65/0.80 marks | none | – |
| DOS-302, new DOS-601/602, AIT-601, FLT-601, PT-300 | symbols from `RZEngSymbols` (`dosingPot`, `instField`, `filterCartridge`) | dose lines: `agent` medium, period ∝ L/h | lod 2 |
| UV-401 | dose tag | none | lod 2 |
Reduced motion: still, every value text stays. State colours only from `--rz-pt-*` (running green, warning amber, alarm red,
standby grey dashed); no glow, no shadow; the sheet keeps the declutter budget (`BUDGET['water-system.html']` = 200 words outside the drawing).
Value tags go on lod 2 when more than one value shares a symbol at 390 px; the rest live in tooltip and modal.
`RZConvVfx.bind` gains an options argument `{ratio, speed}` (shared with PRDs 01/04/05).

## 8. Engine changes

Next conv-engine minor (first of the OPS-DEPTH PRDs to ship takes it; later ones rebase). Add under `water`: ENG+ keys of §5 (about
24) from existing inputs only: `cooling.tower_rejection_kw_th`, `cdw_pump_flow_lps`, `cdw_pumps_running`, `cdw_range_k`,
`water_cp_kj_per_kg_k`, `water_density_kg_m3`, `pump_efficiency`, `pump_motor_efficiency`, `pump_vfd_efficiency`, `site.it_load_kw`,
plus ADOPTED/ASSUMED inputs each with `evidence_class` and a source line (h_fg 2,501 − 2.361·T kJ/kg; f band 0.75–1.0; DP_c; κ ratio 0.65;
valve margin 1.25; tank volumes; chemical dose). `evaporation_lpm`, `blowdown_lpm` keep their meaning in P1a; P1b (after Q1) re-bases them
on the heat balance and moves WUE. Registry: rows in `data/conv-parameters.curated.json`, limits in `data/conv-limits.curated.json`,
history shapes in `data/conv-points.json`, regenerate with `tools/build-conv-parameter-registry.mjs`; bump `js/rz-engine-versions.js`
and every page's `conv-engine.js?v=` token in the same commit; update `standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md` and
`UIUX_AUDIT_LEDGER.md`.

## 9. Laws and proofs

Node proofs in `tools/test-conv-water-ops.mjs` (engine + `water-ops.js`), browser proofs in the same file (puppeteer, 1440 and 390),
wired into `tools/ship-gate.sh` and `tools/run-conv-release-gates.sh`. "Red today" = fails on tree `01c9aa43f`.

| ID | claim | proof | red today? |
|---|---|---|---|
| W0 | the page requests the engine version it ships with | node: `conv-engine.js?v=` token in `water-system.html` = `RZ_ENGINE_VERSIONS.conv`; browser: 0 of 27 `[data-val]` read UNAVAILABLE | red: 2.5.0 ≠ 2.6.0, 27/27 unavailable |
| W1 | M = E + D + B within 0.05 L/min on unrounded values at IT 10/20/30 MW | node on ENG+ unrounded keys | red: keys absent (published rounded residual −0.1) |
| W2 | evaporation does not change when C changes 3 → 6 | node: E(C=3) = E(C=6) ± 0.1 | red: 398 → 498 |
| W3 | evaporation = f·Q_tower / h_fg; with f = 1 it is 854.6 ± 1 L/min | node | red: 447.8 |
| W4 | reconciliation flag: engine make-up < band low raises a warning row on the page and in the tooltip | node + browser: row present | red: no row |
| W5 | C = κ_b/κ_m = M/(B + D); B = E/(C − 1) − D under the declared definition | node, C ∈ {3, 4, 6} | red |
| W6 | booster: N_run = 2 under standby-running, speed = Q/(N·Q_rated) = 50 %; trip A → B 100 %; speed ≥ 30 % or stage down | node | red: standby `stopped` |
| W7 | booster kW = ΔP·Q/(η_p η_m η_VFD) = 3.0 ± 0.05 kW, equal to the engine chain | node vs `pumpElectricalKw` | red: 7.5 typed |
| W8 | tank: time to LAL = (L − L_alarm)·V/Q; mains-loss level(t) = L0 − Q·t/V ± 0.1 %; alarm at t* | node + browser drill | red |
| W9 | XV-501 opening = Q/Q_max: IT 30 → 15 MW halves it ± 1 %; stem offset ∝ opening | node + DOM attribute | red: no opening |
| W10 | blowdown duty = B/B_valve; state follows the controller (open above κ_SP, closed below with hysteresis) | node | red: constant "open" |
| W11 | dosing is flow-paced: IT load ×2 → inhibitor and Cl₂ L/h ×2 ± 1 % | node | red: 0.85 constant |
| W12 | UV dose = I·V/Q; falls as Q rises; alarm < 40 mJ/cm² | node | red |
| W13 | filter DP = f(Q, λ); backwash sets λ = 0 and DP to the clean value; DP after < DP before | node + browser: button, DP | red: unchanged 0.40 |
| W14 | leak residual = injected ℓ ± 0.1 L/min; ≤ 0.1 with none; alarm at > 2 % | node + browser | red |
| W15 | flow dash period = `dashSeconds(flow/design)`; distinct periods ≥ 4 across the 23 running lines | browser: set of `data-vfx-speed` | red: 1 distinct (0.5 s) |
| W16 | every running pump rotor has `data-spin` and duration = `rotorSeconds(speed)`; standby-running 2 of 2 | browser | red: 0 of 2 |
| W17 | tower fan rotor duration = `rotorSeconds(cooling.tower_fan_speed_pct)` = 1.12 s | browser | red: none |
| W18 | reduced motion: 0 running animations; value text unchanged | browser `emulateMediaFeatures` | red-by-mutation (no new motion today) |
| W19 | colour: new nodes only use `--rz-pt-*` or medium palette; 0 box/drop shadow, 0 filter glow | browser computed style | pass today, must stay |
| W20 | no fake numbers: every `[data-val]` has `data-basis-param` or class SIM/NM; 0 `Math.random` in the page | node grep + browser | red: 2 `Math.random`, 17 tags w/o ENG basis |
| W21 | each alarmed new point has a row in the limits registry with lo_alarm ≤ lo_warn < hi_warn ≤ hi_alarm; ≥ 30 rows for `water.*` (6 today) | node over `conv-limits.curated.json` | red: 6 |
| W22 | scenario consequences: Mains loss, Booster A trip, Filter fouled each change ≥ 3 distinct tags and add an alarm row | browser | red: trip changes 1 tag |
| W23 | equipment modal classes for water ≥ 9 (valve, doser, UV, tower cell added) | node over `payloads.js` | red: 5 |
| W24 | CT-501 prints cells N of M and fan % equal to the engine keys | browser | red |
| W25 | 390 and 1440 px: 0 overlapping value tags, 0 values outside the viewBox, `scrollWidth` = viewport, 0 page errors, declutter budget ≤ 200 | browser + `test-conv-declutter.mjs` | pass at 1440 when W0 fixed; must stay |

Mutations that must go red: engine token back to 2.5.0 (W0); compute E from M and C again (W2, W3); drop `ratio` from `bind` (W15); drop
`speed` (W16); make the standby leg `stopped` (W6); hard-code `cl2` (W11); reset λ not on backwash (W13); add `Math.random` (W20);
add a `box-shadow` to a new symbol (W19).

## 10. Phases (each shippable alone)

| phase | content | laws |
|---|---|---|
| P0 | engine token + remove `Math.random` ripple (hot-fix, hours) | W0, W20 |
| P1a | engine water keys, closure, reconciliation row, `CH-PLANT` relabel (tower rejection vs CHW load), blowdown definition in tooltip | W1, W3 (bound), W4, W5, W21 |
| P1b | re-base evaporation/make-up/WUE on the heat balance — only after Q1 | W2, W3 |
| P2 | animation truth: `bind` ratio/speed, rotors, basin fill, tower fan, valve stems | W9 (stem), W15–W19, W24, W25 |
| P3 | booster set standby-running, pressures, kW, XV-501/502 opening and duty, alternation | W6, W7, W9, W10 |
| P4 | chemistry: conductivity, C, basin TDS, dosing, UV dose, filter DP model, backwash fix | W5, W11, W12, W13 |
| P5 | storage autonomy to alarm, mains-loss and leak drills, scenario select, limits and trend (tanks, DP, make-up/blow/evap, conductivity) | W8, W14, W21, W22 |
| P6 | equipment modal insides: tank, valve, doser, UV, filter (follow PRD-CONV-EQUIPMENT-INSIDE P5–P7) | W23 |

Risks: R1 every engine minor requires the token bump on 7+ pages (P0 gate); R2 P1b moves WUE 1.20 → about 1.7–2.3 and every page that
quotes it (dc-conventional, chiller KPIs) must follow in the same commit; R3 affinity-law speed ignores static head, so the label says
"flow-following speed"; R4 vendor numbers (DP_c, valve margin, dose mg/L, TDS/κ ratio) stay ASSUMED until a vendor datasheet; R5
`vfx.bind` change is shared with three other PRDs; R6 phone: more tags need the lod 2 discipline or the declutter budget breaks.

## Open questions for the owner (max 3)

Q1. WUE basis. The engine's WUE 1.2 L/kWh is below the 1.71 L/kWh physical floor for this plant's own 34.5 MW tower duty. (a) keep
1.2 as the adopted target, show the energy-balance cross-check as a flagged mismatch (P1a only); (b) derive make-up from heat so WUE
becomes 1.71–2.28 and the 1.30 target is no longer met; (c) declare a hybrid/adiabatic tower (a dry share), which needs a new input.
Recommendation: (a) now, (b) after your decision.
Q2. Raw-tank autonomy. Today 150 m³ = 4 h at full flow (3.4 h at 82 %). Keep, or declare the project's required hours (commonly 12 h
at Tier III/IV, about 440 m³)? This resizes TK-101 and the "time to LAL" numbers.
Q3. Scope of added hardware on the sheet: dosing skids DOS-601/602, conductivity probe, side-stream filter FLT-601, make-up softener/RO.
Draw the first three (this PRD) and leave softener/RO as a later basis-of-design item, or draw all four?
