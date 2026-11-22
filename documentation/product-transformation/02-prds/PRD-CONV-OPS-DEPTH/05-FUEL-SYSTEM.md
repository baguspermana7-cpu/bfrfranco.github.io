# PRD-CONV-OPS-DEPTH · 05 Fuel system — an operator reads fuel autonomy, tank, pump, polishing, leak and genset burn from one screen, each number from the engine

Status: DRAFT for owner (2026-11-22). Parent: PRD-CONV-OPS-DEPTH/README.md (rules C1–C7 apply unchanged).
Page: `fuel-system.html` (2,354 lines, 160 kB; inline script lines 975–2354), sheet `js/conv/fuel-sheet.js` (FU-M-101, 153 lines),
genset inside `js/conv/internals/genset.js` (195 lines, class `genset`). Engine: `js/conv-engine.js` 2.6.0.

## 1. Owner request

> "dan juga page2 lain selain chiller plant ini, rancang masing2 prd utk perbaikan dan improvement." (R188)
> "ini masih kurang komprehensive … implement all." (R187–R189)

Meaning for this page: bulk and day tanks (level %, litres, hours of runtime at the load the set carries now), transfer pumps
(lead/lag, running, flow), polishing, water-in-fuel, leak detection, fill point, fuel burn per running genset from its load,
genset parameters seen from the fuel side, valve positions, and animation of transfer flow and level. Standards the page is judged
against: NFPA 110 (EPSS), NFPA 30 (liquids storage and transfer), NFPA 37 (stationary engines), Uptime Institute Tier Standard
Topology (on-site fuel hours), ISO 8528 / ISO 3046-1 (genset ratings and fuel consumption).

## 2. Measured state today

Measured 2026-11-22 on this tree by reading the page, the sheet module and by running `build()` plus the engine in node
(`CONV_CALC.snapshot.meta.version` = 2.6.0, 4 halls, 8 gensets per hall = 32).

### 2.1 Counts

| quantity | today |
|---|---|
| Bulk tanks | **1** (UST-01, 972,737 L, one level 85 %). No second tank, no isolation valve, no tank selection |
| Day tanks | 8 per hall (one per genset, 32 on the site); the page draws the selected hall only |
| Transfer pumps | 2 (P-101 duty, P-102 lag). A detail card exists for **P-101 only** (6 cells); P-102 has 2 sheet tags (`cmd`, `st`) |
| Polishing | 1 loop FPU-01, 3 filter nodes (pre-filter, coalescer, final); **0 numbers** (state text POLISHING / FAULT) |
| Leak / containment | 2 sensors on the sheet (LD-101, LD-201), 6 interlock cards, 4 containment rows: **all boolean** |
| Fill point | 1; state CONNECTED/CLOSED + rate constant `FILL_LPM = 210` (page literal, line 1631) |
| Sheet FU-M-101 (hall A) | 49 nodes, 48 edges, **54 value tags, 29 carrying a `data-point`**; symbols: 9 tanks, 8 solenoid valves, 8 gensets, 2 pumps, 2 check valves, 12 junctions, 3 filters, 2 leak sensors, 1 flow meter, 1 pressure transmitter |
| Static `data-point` ids in the HTML | 12 distinct (plus table rows built at run time) |
| Engine `fuel.*` keys | **11** (`level_pct`, `tank_capacity_l`, `usable_l`, `usable_fraction`, `specific_consumption_l_per_kwh`, `generator_consumption_lph`, `autonomy_hr`, 3 level limits, `nameplate_evidence_class`) |
| Engine genset fleet row fields | **6** (`n`, `tag`, `state`, `loadPct`, `ratingKw`, `outputKw`); every row published STANDBY / 0 kW (`conv-engine.js:1578`) |
| Genset inside (`internals/genset.js` model) | 26 keys, **7 are "not modelled"**: `rpm`, `hz`, `coolantT`, `oilP`, `batV`, `exhT`, `filterDp` |
| Permanently empty cells on the page | **6**: TIT-101 tank temperature, Last Delivery, P-101 Run Hours, P-101 Starter, polisher diff-pressure, water-in-fuel ppm (`fuel-system.html:846,847,892,893,911,912`) |
| Rotating symbols that turn | **0** (page passes no `speed()` to `js/conv/vfx.js`; rotor needs `speed(nodeId)`, `vfx.js:109`) |
| Flow dashes scaled to flow | **0** (page passes no `ratio(e)`; dash period is the default for every line, `vfx.js:125`). Level fill: yes, 9 tanks via `RZHmiDepth` `levels` (UST + day tanks) |
| Trends | 1 UST level polyline (inline SVG, 60 samples, hand-drawn, not `rz-trend`) |
| Hours of runtime per day tank | shown **at rated burn only** (4.0 h basis × level). **0 of 8** sets show hours at the load they carry now |

### 2.2 Equipment classes and parameters shown

| class | parameters shown today | source today |
|---|---|---|
| UST-01 bulk | level % (LIT-101), gross L, usable L, 3 thresholds (overfill 95, low 60, low-low 30), autonomy h, SLA margin h | ENG `fuel.*` (good). Tank temperature: `—` |
| Day tank DT-GEN-xn | level %, litres, hours at rated, fill-valve open | SIM: `state.halls[h].lv` (line 1193); capacity = `DT_CAP_HR 4` × rating × SFC (page constants line 1184) |
| Genset (fuel side) | RUNNING/STANDBY, kW, L/h | ENG rows + page rule "all sets but `genset_spare_per_hall` run in utility loss, equal share" (line 1201); burn = kW × SFC |
| P-101 / P-102 | cmd, run feedback, flow (FT-101), pressure (PT-101), current, vibration | SIM ramp: amps +1.2 A/scan to 14.4 A, flow +14 L/min/scan to `PUMP_LPM = 180`, dp `jitter(4.2)`, vibration `jitter(2.25)` (lines 1475–1485) |
| FPU-01 | state only | `state.interlocks.polish` (boolean) |
| Water-in-fuel | boolean card | `state.interlocks.water`, set only by the test seam |
| Leak / bund | boolean cards | `state.interlocks.leak/bund`, set only by the test seam (`installFuelSeam`, line 2198) |
| XV-xn fill valves | OPEN / CLOSED text | `hs.open` |
| Fill point | state, rate | SIM `state.filling` (+0.25 %/scan to 98 %) |

### 2.3 Defects found while measuring (each re-proved against the code)

1. **Consumption is a straight line with no no-load term.** `generatorConsumptionLph = facility kW × 0.356384` (`conv-engine.js:469`); the
   0.356384 L/kWh is the sourced pair 956 L/h at 2,682.5 kW. A running diesel set burns fuel at zero output; seven sets sharing a hall at 51.8 % each
   burn the same litres as five at 72.5 % on this model, which no real plant does. Source of the curve today: **one sourced point**, no ISO 3046-1 curve.
2. **P-101 current disagrees with its own flow and pressure.** 180 L/min × 4.2 bar = 1.26 kW hydraulic; the sim ramps current to 14.4 A
   (about 8 kW electrical at 400 V, `electrical.lv_voltage_v`). The two printed numbers cannot both satisfy P = Q·Δp/η.
3. **Day-tank limits are stated twice and disagree.** `data/conv-limits.curated.json` (`fuel-system.DT.level_pct`) warns below 30 %; the page refills
   at 50 % (`DT_FILL_START`), warns below 45 % (`DT_LOW_PCT`) and alarms below 25 %. The registry still cites "DT_LOW = 30" from a line that no longer exists.
4. **Tag names differ between the drawing and the panel.** Sheet: LD-101, LD-201. Containment panel: LDS-101, LS-102 (`fuel-system.html:935–936`).
5. **Genset run rule lives in the page**, not the engine (comment at line 1161 says the engine "does not yet publish this run split"). It runs 7 of 8
   sets at 51.8 % load; the engine's own sizing rule (`conv-engine.js:991`, N = ceil(kW ÷ (unit × 0.8)) + spare) needs 5 sets at the present 10,875 kW per hall.
6. **Autonomy is reported at current load only** (48.0 h). Autonomy at the **design** facility load (4 × 14,500 kW × 0.356384 = 20,670 L/h)
   is 744,144 ÷ 20,670 = **36.0 h**; an operator and a Tier III / IV audit read the design figure.
7. **A single 972,737 L underground tank** is the whole bulk store. A real plant of this size has several isolable bulk tanks, each with its own gauge (see Q1).
8. **P-102 never runs unless P-101 fails**: no alternation, no run-hour equalisation, no standby proof.

### 2.4 What an operator on a real plant expects and is missing (counted: 41 items)

Bulk: per-tank level (LIT) + volume + water-bottom level + temperature + isolation valve position + high-high / low-low state (6 × per tank).
Day tank: level, litres, **hours at current load**, high-high float, fill-valve position, low-low interlock, fill demand (6). Transfer pumps:
per pump run state, run hours, starts, motor current, flow, discharge pressure, vibration, lead/lag role, alternation, suction/discharge isolation
position (10). Header: pressure, flow, strainer ΔP, isolation valves (4). Polishing: flow, 3 filter ΔP, water-separator drain, water-in-fuel ppm,
run mode, last filter change (7). Leak: interstitial state with sensor-fault, sump level, per tank (3). Fill: delivered litres, rate, OFP state (3).
Gensets fuel side: burn L/h from curve, specific consumption now, hours at current load, hours at rated, fuel SOV position, fuel filter ΔP, cumulative
litres burned (7). The page shows 6 of the 41 with a real number today.

## 3. Reference design (how a modern plant is built and run)

| topic | practice | basis |
|---|---|---|
| On-site fuel | Class designation in hours at full rated load; Tier III = 12 h, Tier IV = 96 h of on-site fuel at N capacity; contractual SLA here 24 h | NFPA 110 §4 (Class); Uptime Tier Standard: Topology |
| Autonomy figures | State both: at current load and at design (full N) load. The design figure sizes the tank | Uptime Tier Standard: Topology; NFPA 110 |
| Bulk storage | Two or more isolable tanks on a common suction manifold, each with ATG probe (level, water-bottom, temperature), overfill prevention, interstitial / double-wall monitoring | NFPA 30 ch. 21–22 (tanks, secondary containment, overfill); 40 CFR 280 (UST leak detection) / EN 13160 |
| Transfer | Duplex pumps lead/lag with automatic alternation, fixed-speed (no VFD needed for a transfer duty); lag starts on lead fail-to-prove or on high demand; each pump has check valve and isolation valves | NFPA 37, NFPA 30 ch. 27; generator-plant practice |
| Day tank | One per set, ≥ 2 h at full set load under ISO 8528 rating, level-controlled fill (start/stop), independent high-high float closing the fill valve, low-low alarm, return line, vent, local spill containment | NFPA 110 (fuel supply), NFPA 37, UL 142 |
| Burn model | Fuel flow of a diesel set is linear in output with a no-load intercept (Willans line): Q = Q_rated × (a + (1 − a) × x), x = kW ÷ rated kW. Rated-point fuel consumption is declared at 100 / 75 / 50 / 25 % load | ISO 3046-1, ISO 8528-1 (vendor curve overrides the default `a`) |
| Genset sequencing | Load-demand start/stop: run the fewest sets that keep each ≤ max loading (0.8 here); keep ≥ 30 % load on a running set (wet-stacking); the rest wait as standby | NFPA 110 ch. 8 (exercise ≥ 30 % rated or OEM exhaust temperature); OEM guidance |
| Fuel quality | Polish continuously or on schedule; water-in-fuel is a first alarm: ≤ 0.05 vol % (500 ppm) water and sediment as delivered; solid contamination to the OEM ISO 4406 code; water drained from the coalescer / tank bottom | ASTM D975; ASTM D6469 (microbial); ISO 4406 |
| Leak response | Wet interstitial or high sump → stop transfer and inhibit fill; alarm latches until acknowledged and reset | NFPA 30 ch. 22/27; 40 CFR 280.43 |
| Fill | Fill from a spill-contained coupling with a drop-tube overfill valve; fill permitted only if the tank can take the load and containment is dry; alarm at high (95 %) | NFPA 30 ch. 27; 40 CFR 280.20(c) |

## 4. Goals and non-goals

Goals
- G1 Every tank, pump, valve, polishing, leak, fill and genset-fuel parameter in the §2.4 list is an engine key, a named page simulation function, or "not modelled".
- G2 Fuel burn per genset comes from its load through one stated curve (§6.1), and the hall, site and autonomy figures are sums of it.
- G3 Autonomy is shown at current load and at design load; hours of runtime per tank is at the load the set carries now.
- G4 Pumps run lead/lag with alternation and run hours; valves show a position; polishing, water and leak read as numbers and 3 states, not booleans.
- G5 Physical animation: flow dashes at a rate ∝ flow, level fill, stem position = valve state, no glow.
- G6 One source for every limit (engine), so the page, the registry and the alarm agree.

Non-goals
- No fake dynamics (no PID, no transients, no random). No real Modbus/BACnet. No fuel procurement, price or delivery scheduling.
- No VFD on the transfer pumps: they are fixed-speed (not modelled as variable). The sheet shows RUN % = 0 or 100 and says so in the tooltip.
- No generator electrical protection (EPMS page owns it); only what the fuel system sees.
- No expansion-study hall sizing change (`STUDY ONLY` card unchanged).

## 5. Parameter catalogue

Source codes: ENG = engine existing key, ENG-NEW = new key with formula (§8), SIM = page simulation function (named), NM = "not modelled". Evidence class on a
new design selection is ASSUMED (as the engine does for `tank_capacity_l`), never shown as measured.

### 5.1 Bulk tanks (UST-01 … n)

| parameter | unit | source | shown where | limits (warn / alarm) |
|---|---|---|---|---|
| Level LIT-10n | % | ENG `fuel.level_pct` (shared inventory) split by `bulk_tank_count` | sheet tag, tank table, trend | ENG `level_low_pct` 60 / `level_low_low_pct` 30; high ENG `level_overfill_pct` 95 |
| Volume gross / usable | L | ENG `tank_capacity_l`, `usable_l`; per tank = ÷ count | tag, table | as level |
| Tank count, unit size | – / L | ENG-NEW `fuel.bulk_tank_count`, `fuel.bulk_tank_unit_l` | modal | – |
| Isolation valve XV-U0n position | OPEN/CLOSED | SIM `bulkValve(k)` (all open at start) | glyph + tag | CLOSED while pump runs = alarm (suction starved) |
| Water-bottom level | mm | SIM `waterBottom()` = ∫(ingress − drain) ÷ tank area, ENG-NEW `fuel.bulk_tank_area_m2` = unit_l ÷ 1000 ÷ height_m (`bulk_tank_height_m` ASSUMED) | modal, trend | warn > 25 mm, alarm > 50 mm (ASSUMED, replaced by OEM / site SOP) |
| Tank temperature TIT-101 | °C | ENG ambient annual-mean key if present, else NM (underground tank ≈ ground temperature) | modal | NM |
| Interstitial LDS-10n | DRY / WET / FAULT | SIM from `state.interlocks.leak` + sensor-fault flag (3-state) | tag + card | WET = alarm, FAULT = warn |
| Autonomy now | h | ENG `fuel.autonomy_hr` | KPI | alarm < ENG `fuel.sla_hr` 24 |
| **Autonomy at design load** | h | ENG-NEW `fuel.autonomy_design_hr` = `usable_l` ÷ (Σ hall `it_design_kw` × `site.pue` × `specific_consumption`) = 36.0 h today | KPI sub-line, tooltip | warn < Tier hours (12 / 96 per site tier key, `site.tier` if present else 24 SLA) |

### 5.2 Day tanks (DT-GEN-xn, 8 per hall)

| parameter | unit | source | shown where | limits |
|---|---|---|---|---|
| Level LIT | % | SIM `stepPhysics` (existing) | tag, row, trend | ENG-NEW (moved from the page) `fuel.day_tank_low_pct` 45, `day_tank_lowlow_pct` 25 |
| Volume | L | SIM = cap × level; cap = ENG-NEW `fuel.day_tank_cap_hr` (4) × rated L/h | tag | – |
| **Hours at current load** | h | SIM = litres ÷ burn of that set (§6.1); "–" while standby | tag, tooltip | warn < 2 h, alarm < 1 h of run at current load (ASSUMED, NFPA 110 2 h minimum design reading) |
| Hours at rated load | h | SIM = litres ÷ rated L/h (kept; tooltip) | tooltip | – |
| Fill valve XV-xn | OPEN/CLOSED | SIM `hs.open` | glyph + tag | feedback ≠ command = warn |
| Fill demand | bool | SIM `hs.req` (latch, start 50 / stop 90) | tooltip | – |
| High-high float LSHH | NORMAL/TRIP | SIM = level ≥ ENG `level_overfill_pct` 95; trips closes XV | modal | trip = alarm |
| Low-low interlock | NORMAL/TRIP | SIM = level < `day_tank_lowlow_pct` | existing card | trip = alarm |

### 5.3 Transfer pumps P-101 duty, P-102 lag

| parameter | unit | source | shown | limits |
|---|---|---|---|---|
| Role (lead / lag) | – | SIM `pumpRole()`; alternates at each fill cycle end (steady state, no timer) | tag text, modal | – |
| Command / feedback | on/off | SIM `pumpCmd/pumpFb` (existing, both pumps now carded) | tag | mismatch > `PUMP_PROVE_TICKS` = alarm |
| Flow | L/min | SIM (existing ramp), design = ENG-NEW `fuel.transfer_pump_lpm` (180) | tag, card, flow meter | – |
| Discharge pressure | bar | SIM: design `fuel.transfer_pump_dp_bar` (4.2 ASSUMED) × (flow ÷ design)^0 at fixed speed = design ΔP; zero when stopped | tag | alarm low/high ±20 % of design (ASSUMED) |
| Motor current | A | **derived**: I = Q·Δp ÷ (η_p · η_m · √3 · V · pf), V = ENG `electrical.lv_voltage_v`, η_p, η_m, pf ENG-NEW `fuel.transfer_pump_eff` ASSUMED | card | warn > 100 % of nameplate FLA (derived at design flow) |
| Run hours, starts | h / n | SIM counters: += SIM_MIN_PER_SCAN ÷ 60 per running scan; start on 0→1 edge. Session-scoped, labelled "since page load" | card | – |
| Vibration | mm/s | NM (no basis) — the seeded jitter shown today is removed (it is cosmetic, §2.3) | card | NM |
| Suction / discharge isolation | OPEN/CLOSED | SIM (open) | glyph | closed while command ON = alarm |
| Check valve position | OPEN/CLOSED | SIM = flow > 0 | glyph | – |
| Header pressure PT-101 | bar | SIM = discharge pressure of the running pump (lead or lag) | tag | as discharge |
| Strainer ΔP | bar | NM until a strainer symbol and basis exist | – | NM |

### 5.4 Polishing FPU-01, water, leak, containment

| parameter | unit | source | shown | limits |
|---|---|---|---|---|
| Mode | OFF / STANDBY / POLISHING | SIM (existing `interlocks.polish` + schedule rule: continuous while water-in-fuel high) | tag | fault = warn |
| Polish flow | L/min | ENG-NEW `fuel.polish_lpm` = `tank_capacity_l` ÷ (`polish_turnover_days` × 1440), turnover 7 d ASSUMED (≈ 96.5 L/min at today's tank) | tag | – |
| Filter ΔP (pre / coalescer / final) | bar | SIM = ΔP_clean + (ΔP_change − ΔP_clean) × (litres polished ÷ dirt capacity); three ASSUMED constants per filter, with change-out alarm at ΔP_change | tooltip, modal | warn 80 %, alarm 100 % of ΔP_change |
| Water-in-fuel WIF | ppm | SIM well-mixed mass balance: V·dC/dt = q_in − Q_pol·η_sep·C; steady state C = q_in ÷ (Q_pol·η_sep); q_in = 0 unless a scenario injects; `η_sep` ASSUMED. Value "0" is never printed as measured when no sensor basis: shows NM until the scenario or a sensor point exists | tag, card, trend | warn 200 ppm, alarm 500 ppm (ASTM D975 0.05 vol % = 500 ppm) |
| Water drained | L | SIM ∫ (separator drain) | modal | – |
| Last filter change | date | NM | – | NM |
| Interstitial / sump state | DRY / WET / FAULT | SIM 3-state (§5.1) | cards | WET = alarm + STOP TRANSFER |
| Containment chain | 4 permissives | existing `evaluateContainment` (unchanged logic) | panel | – |

### 5.5 Fill point

| parameter | unit | source | shown | limits |
|---|---|---|---|---|
| Coupling | CONNECTED / CLOSED | SIM `state.filling` | tag | – |
| Fill rate | L/min | ENG-NEW `fuel.fill_lpm` (210, moved off the page) | tag | – |
| Delivered this session | L | SIM ∫ flow; replaces "Last Delivery —" | row | – |
| Time to high level | min | SIM = (overfill % − level %) × capacity ÷ rate | tooltip | – |
| Overfill prevention | ARMED / TRIPPED | SIM = level ≥ `level_overfill_pct` closes drop-tube valve and stops the fill | row | trip = alarm |
| Fill permissive | bool | existing `containment.fillPermissive` | row | – |

### 5.6 Genset, seen from the fuel side (per running or standby set)

| parameter | unit | source | shown | limits |
|---|---|---|---|---|
| State, kW, load % | – | ENG-NEW `CONV_CALC.gensetRun(hall, mode)` (moves the page rule into the engine, §6.2) | tag, modal | load < 30 % running = warn (wet-stacking), > ENG `genset_max_loading` 0.8 = warn, 100 % = alarm |
| Fuel burn | L/h | ENG-NEW `fuel.genset_lph(loadPct)` §6.1 curve | tag | – |
| Specific consumption now | L/kWh | = burn ÷ kW | tooltip | – |
| Hours at current load / at rated | h | day-tank litres ÷ burn | tag, tooltip | §5.2 |
| Cumulative burn since utility loss | L | SIM ∫ burn | modal | – |
| Fuel SOV position | OPEN/CLOSED | follows state (existing node `fv`) | glyph | – |
| Fuel filter ΔP | bar | NM (7 genset NM keys remain NM unless a key below is added) | modal | NM |
| Speed | rpm | ENG-NEW `electrical.grid_frequency_hz` 50 (ASSUMED site frequency) and `genset_poles` 4 (ASSUMED): n = 120·f ÷ p = 1,500 rpm when running, 0 when standby | modal tag | – |
| Frequency | Hz | = ENG-NEW `grid_frequency_hz` when running (synchronised) | modal | ±1 % warn (IEC / ISO 8528-5 class G2 band, ASSUMED) |
| Coolant, oil pressure, battery V, exhaust T | – | remain NM (no basis in the engine) | modal | NM |
| Day-tank hours basis | h | see §5.2 | tooltip | – |

## 6. Control logic to model (steady-state relations, no dynamics)

### 6.1 The burn curve (source stated)

Relation (Willans line, ISO 3046-1 / ISO 8528-1 practice): `Q(P) = Q_100 · (a + (1 − a) · x)`, `x = P ÷ P_rated`.
- `Q_100` = fuel flow at rated output; `a` = no-load fuel fraction. Both are ENG-NEW constants, evidence class ASSUMED until a vendor curve (100/75/50/25 %
  points) is supplied; the vendor points replace them with no code change (keys hold a 4-point table when present).
- Calibration constraint (law L2): at the sourced design point (4 halls × hall facility kW, sets per the engine run rule) the site burn must equal today's
  `generator_consumption_lph` 15,503 L/h within 0.5 %, so autonomy 48.0 h is preserved. Q_100 is solved from this once, in the engine, not typed.
- The linear sourced rate `fuel.specific_consumption_l_per_kwh` stays as the campus-average anchor; `generator_consumption_lph` stays as the reference sum.
- Hall burn = Σ set burn; site burn = Σ hall; `fuel.autonomy_hr` = `usable_l` ÷ site burn (engine value changes by < 0.5 % at the anchor).

### 6.2 Genset run rule (engine, replaces the page rule)

`N_run = min(count, max(1, ceil(hall_load_kw ÷ (genset_unit_kw × genset_max_loading))))`, share = hall_load ÷ N_run (equal sharing), others STANDBY
(`gensetRun(hall, mode)` returns the rows). Today: 10,875 ÷ 2,400 → 5 running at 72.5 %, 3 standby. The old "all but spare" is kept as scenario
"N+1 spinning reserve" (6 running at 60.4 %). Mode `utility-loss` or `normal` as now.

### 6.3 Transfer and day-tank fill

- Demand latch per day tank: start 50 %, stop 90 % (moved to ENG-NEW `fuel.day_tank_fill_start_pct`, `fuel.day_tank_fill_stop_pct`).
- Lead pump runs while any day tank of the hall demands and `transferPermissive`; lag starts only if lead feedback is absent for `PUMP_PROVE_TICKS`, or flow
  demand > lead design flow. Alternation: at the end of each fill cycle the roles swap (steady-state rule: role = cycle parity). Both can run on high demand.
- Flow splits equally across open XVs (existing rule); XV closes on day-tank ≥ 90 % or LSHH at 95 %.
- Check: transfer demand of hall A today = 3,875.7 L/h = 64.6 L/min = 36 % of one pump; refilling one day tank 50→90 % = 1,710.6 L = 9.5 min at 180 L/min (derived, §2).

### 6.4 Scenario / fault controls (placed in the existing Mode area, collapsed menu)

| control | changes | expected |
|---|---|---|
| Mode: Normal / Utility loss | run rule §6.2 | burn, hours at current load, level drain |
| N+1 spinning reserve | §6.2 | 6 sets run; total burn up (curve intercept), shown in the hall sum |
| Fault: P-101 fail-to-run | pump feedback absent | lag starts after `PUMP_PROVE_TICKS`; if both fail STOP TRANSFER |
| Fault: leak / bund wet | LDS / sump | STOP TRANSFER + INHIBIT FILL (existing logic) |
| Fault: water ingress | `q_in` > 0 | WIF rises toward C = q_in ÷ (Q_pol·η_sep); POLISH CONTINUOUS |
| Fault: polisher off | polish stopped | WIF rises with no removal; warn |
| Isolate bulk tank k | XV-U0k closed | its volume leaves usable; autonomy drops by 1 ÷ count |
| Tanker delivery | fill on | level rises; OFP at 95 % |

## 7. Drawing and animation changes

Sheet FU-M-101 keeps its layout (`ROW0 150`, `PITCH 96`, 1260 wide). Additions are geometry only; values come from `read()`.

| symbol | add | animation rule | phone (390 px) |
|---|---|---|---|
| Bulk tank(s) | per-tank tag + level % + volume; water-bottom band at the base; isolation valve at suction | level fill (existing `RZHmiDepth`), water band height ∝ mm; band hidden when 0 | tags LOD1 only; panel scrolls horizontally (sheet `minScale 1`) |
| Valves XV-U, pump isolation, XV-xn | solenoid / ball valve glyph with stem: up = OPEN, down = CLOSED; tag OPEN/CLOSED | stem snaps to position (no tween on a binary valve) | tag below glyph; hidden below LOD1 |
| P-101 / P-102 | LEAD / LAG badge + RUN %; pump symbol rotor turns | rotor via `vfx.js` `speed(id)` = 100 when running, 0 when stopped; period 1.0 s per turn (the vfx rule) | RUN % only |
| Transfer lines | dashes ∝ flow | `ratio(e)` = flow ÷ `fuel.transfer_pump_lpm` for suction, header, branch; dash seconds = `dashSeconds(ratio)`; stopped = no dash, standby line grey dashed | – |
| FPU-01 | flow, 3 ΔP tags (tooltip), WIF ppm tag | polish loop dashes at ratio = polish_lpm ÷ polish design | tags collapse into tooltip |
| Day tank | add hours at current load tag, LSHH state in modal | level fill (existing) | existing |
| Genset | burn L/h, load %, shaft rotor | rotor ∝ rpm ÷ 1,500 (`speed(id)` = running ? 100 : 0); fuel line to the engine dashes ∝ burn ÷ rated L/h | existing |
| Leak sensors | 3-state glyph (dry / wet / fault) | static; WET = red mark only | – |
| Trend | per-tank level and hall burn through `rz-trend` points (replace the inline polyline) | – | trend below the sheet |

Page text rules (C5): no new always-visible lines except the autonomy design-load sub-line; all detail in tooltips and the modal (`internals/genset.js` blocks extend
by Fuel-side block: burn, hours, SOV, filter; plus new class `internals/fuel-pump.js`, `internals/fuel-tank.js` registered in `js/conv/internals.js`). State colours only
`--rz-pt-*`; reduced motion = no rotor, no dash movement, value text unchanged.

## 8. Engine changes (conv-engine 2.6.0 → next shared minor, proposed 2.7.0, one bump for all OPS-DEPTH PRDs)

| new key | formula / value | source / evidence |
|---|---|---|
| `fuel.sla_hr` | 24 (moved from page `SLA_HR`) | contractual SLA; SOURCED to page today |
| `fuel.autonomy_design_hr` | `usable_l` ÷ (Σ halls `it_design_kw` × `site.pue` × `specific_consumption`) | derived; 36.0 h today |
| `fuel.genset_noload_fraction` (a) | 0.10 default | ASSUMED, ISO 3046-1 / OEM curve replaces |
| `fuel.genset_lph(loadPct, ratingKw)` | §6.1 | derived; calibrated to 15,503 L/h at the sourced point |
| `electrical.genset_run_count(hall, loadKw)` and `CONV_CALC.gensetRun(hall, mode)` | §6.2 | derived from `genset_unit_kw`, `genset_max_loading`, `genset_spare_per_hall` |
| `fuel.day_tank_cap_hr` 4, `_fill_start_pct` 50, `_fill_stop_pct` 90, `_low_pct` 45, `_lowlow_pct` 25 | moved from page lines 1184 | ASSUMED, now one source for page + registry |
| `fuel.bulk_tank_count`, `fuel.bulk_tank_unit_l`, `bulk_tank_height_m` | count = ceil(`tank_capacity_l` ÷ unit_l) | ASSUMED design selection (Q1) |
| `fuel.transfer_pump_lpm` 180, `_dp_bar` 4.2, `_eff` (η_p, η_m, pf) | I = Q·Δp ÷ (η_p·η_m·√3·V·pf) | ASSUMED nameplate (page `PUMP_LPM` today) |
| `fuel.fill_lpm` 210; `fuel.polish_turnover_days` 7; `fuel.polish_water_sep_eff` | `polish_lpm` = capacity ÷ (days × 1440) | ASSUMED |
| `electrical.grid_frequency_hz` 50, `electrical.genset_poles` 4 | rpm = 120·f ÷ p | ASSUMED (site 50 Hz) |

`data/conv-parameters.curated.json` and `data/conv-limits.curated.json` follow: new rows for each; `fuel-system.DT.level_pct` limits re-pointed at the engine keys (fixes §2.3.3);
`standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md` gets the burn curve, run rule and day-tank basis (standards docs follow every change).

## 9. Laws (proof file: new `tools/test-conv-fuel-depth.mjs` node tests and `tools/test-conv-fuel-depth-browser.mjs`; both wired into `tools/run-conv-release-gates.sh`)

"Red today" means the proof fails on the current tree (verified by reading the cited line or by running the node probe in §2).

| ID | law | proof (test name: assertion) | red today? |
|---|---|---|---|
| F1 | Fuel burn follows a curve with a no-load term | `engine-burn-curve`: `fuel.genset_lph(0, 3000) > 0` and `lph(100) / lph(50) < 2` | yes (linear, `lph(0) = 0`) |
| F2 | Curve preserves the sourced anchor | `engine-anchor`: Σ burn at the sourced point = 15,503 L/h ± 0.5 %; `autonomy_hr` = 48.0 ± 0.3 | yes (curve missing) |
| F3 | Run rule is the engine's | `engine-run-rule`: `gensetRun('A','utility-loss')` has 5 running at 72.5 % ± 0.1; page contains no `genset_spare_per_hall` arithmetic (`grep` 0) | yes (7 at 51.8 %) |
| F4 | Autonomy at design load is shown and equals the relation | `engine-autonomy-design`: key = 36.0 ± 0.1; KPI sub-line text contains it | yes (key absent) |
| F5 | Every day-tank limit has one source | `limits-single-source`: registry `lo_warn` for `fuel-system.DT.level_pct` = engine `day_tank_low_pct`; page `grep "DT_LOW\|DT_FILL_START"` = 0 literals | yes (30 vs 45/50) |
| F6 | Hours of runtime at current load for every running set | `browser-dt-hours`: in utility loss each running set's tooltip hours = litres ÷ burn, 5 of 5 | yes (0 of 8, only "at rated") |
| F7 | Bulk tanks are N isolable tanks | `browser-bulk-count`: nodes `ust1…n` = `fuel.bulk_tank_count`; closing XV-U02 drops usable L by 1/n | yes (1 tank) |
| F8 | Valve position drawn and stated | `browser-valve-pos`: every `valve*` node has `data-vstate` open/closed and a stem attribute matching the tag text | partial (tag text only, no stem) |
| F9 | Pumps alternate and count hours | `sim-pump-alternate`: two fill cycles: lead role swaps; run hours of P-101 + P-102 = scans × 1/60 × `SIM_MIN` | yes (no alternation, hours `—`) |
| F10 | P-102 carded like P-101 | `browser-pump-card`: both pumps have flow, current, pressure, hours cells | yes (P-102 has none) |
| F11 | Motor current is derived | `engine-pump-current`: I at design flow = Q·Δp ÷ (η_p η_m √3 V pf) ± 2 %; a stopped pump = 0 | yes (14.4 A ramp) |
| F12 | No cosmetic jitter is displayed as a measurement | `sim-no-jitter`: no `jitter(` call feeds a `data-point` (grep + two ticks equal) | yes (`jitter(2.25)`, `jitter(4.2)`) |
| F13 | Water-in-fuel has a number | `sim-wif`: inject `q_in`; after 600 scans WIF within 2 % of Q·η-relation steady state; baseline prints NM | yes (boolean) |
| F14 | Polisher has flow and 3 filter ΔP | `browser-polish`: flow = capacity ÷ (days × 1440) ± 1 %; ΔP monotonic with litres polished | yes (0 numbers) |
| F15 | Leak sensors are 3-state, names agree | `browser-leak`: states DRY/WET/FAULT; tag set on sheet = tag set in panel | yes (booleans; LD-101 vs LDS-101) |
| F16 | Fill point has delivered litres and OFP | `sim-fill`: after fill, delivered L = Δlevel × capacity ± 1 L; OFP closes at 95 % | yes (`—`, no OFP value) |
| F17 | Flow dashes scale with flow | `browser-dash-ratio`: dash period of the header at 2 pumps ≠ at 1 pump; stopped line has none | yes (0 `ratio` passes) |
| F18 | Pump and genset rotors turn at their speed | `browser-rotor`: running pump and genset rotors have `data-vfx-speed` 1.0 s per turn; standby = none | yes (0 rotors) |
| F19 | Level fill follows the model | `browser-level-paint`: painted liquid height = level % ± 2 for every tank, 2 consecutive scans | partial (UST + DT yes, water band no) |
| F20 | No NM masquerades as a value | `browser-nm`: each NM cell text is `not modelled`/`—` and carries no unit | yes (6 dead cells silently `—`) |
| F21 | 390 px and 1440 px clean | `test-conv-sheet-text-clear.mjs --page=fuel-system.html` at both widths, 0 overlap, 0 line through text, 0 console errors | pass today (must stay) |
| F22 | Reduced motion is still | `browser-reduced-motion`: with `prefers-reduced-motion`, no `animation-name` running, values present | pass today (must stay) |
| F23 | State colours only | `browser-colours`: every state paint resolves to a `--rz-pt-*` token | pass today (must stay) |
| F24 | Burn conserved | `sim-burn-conservation`: UST litres lost = Σ day-tank fill; day-tank litres gained = Σ XV flow; engine burned = Σ burn over N scans, ± 0.1 % | partial (UST/DT yes, no burn ledger) |
| F25 | Engine version bump and registry coverage | `engine-version`: `meta.version` = `RZ_ENGINE_VERSIONS.conv`; every new key has a registry row | yes (new keys absent) |

Mutations that must turn a law red: set `a = 0` → F1; change `genset_max_loading` 0.8 → 0.5 → F3 red (run count 5 → 8) and F2 red (anchor moves); delete the
`speed()`/`ratio()` pass in `refreshFuelSheet` → F17, F18; re-add `jitter()` into `state.amps` → F12; change `day_tank_low_pct` in the engine only → F5; remove the alternation line → F9;
flip a valve glyph class → F8; set tank unit to 1 → F7; print `0 ppm` with `q_in = 0` and no sensor → F20.

## 10. Phases (each shippable alone)

| phase | content | laws |
|---|---|---|
| P0 | Engine keys (`fuel.*`, `electrical.grid_*`, `gensetRun`), registry/limits fix, standards doc; page reads them, nothing new drawn | F2, F4, F5, F25 |
| P1 | Burn curve + run rule on the page; hours at current load; autonomy-design line; genset fuel block in the modal | F1, F3, F6, F24 |
| P2 | Pump pair: alternation, run hours, derived current, jitter removed, P-102 card | F9–F12 |
| P3 | Polishing numbers, water-in-fuel model, 3-state leak, tag names unified, fault menu | F13–F15 |
| P4 | Bulk tanks (count, isolation, water band), fill point (delivered L, OFP), valve stems | F7, F8, F16, F19 |
| P5 | Animation: `ratio()`, `speed()`, `rz-trend` points replace the inline polyline | F17, F18, F20–F23 |

Risks: (1) the curve changes burn in utility loss by a few % versus today; protected by F2 (anchor). (2) A single 972,737 L tank split into N tanks changes the sheet height; geometry
reuses `PITCH 96`. (3) ASSUMED constants (a, η, turnover days, water-sep efficiency) are labelled ASSUMED on the registry row and in the tooltip, never shown as measured.
(4) Parallel sessions edit `conv-engine.js`; the bump and the new keys ship in one commit over a fresh `origin/main` (see memory: port a release over a moved main).

Open questions for the owner (taste/scope only)
1. Bulk store: keep one 972,737 L tank, or split into N isolable tanks (recommended: 4, one per hall, 243,184 L each)?
2. Genset run rule in utility loss: switch to load-demand (5 running per hall, recommended) or keep "all but spare" (7 running at 51.8 % each)?
3. Fault menu: show it on the page behind a "Scenario" toggle (recommended), or only through the test seam as today?
