# Conventional DC engineering accuracy audit (read-only)

Worktree: `~/.cache/rz-w5` · engine `js/conv-engine.js` v2.2.0 · registry `data/conv-parameters.json` (138 params) · date 2026-11-16.

## Method and evidence

The engine was loaded in a `vm` sandbox the same way `tools/build-conv-parameter-registry.mjs loadEngine()` loads it. `CONV_CALC.snapshot` was read for the adopted `normal` scenario, then `CONV_CALC.recompute()` was run with every hall set to 1,125 / 7,500 / 9,000 / 10,000 kW.

Snapshot at the adopted scenario: IT 30,000 kW · PUE 1.45 · facility 43,500 kW · non-IT 13,500 kW · UPS loss 1,250 kW · evaporator duty 31,250 kW · chiller input 5,153.4 kW · tower rejection 36,403.4 kW · CHWS/CHWR 19.4/27.0 °C · CDW 32/37 °C · chillers 7 running of 10 · CRAH 58 required / 59 installed per hall · WUE 1.2 · makeup 600 L/min · evaporation 447.8 L/min · fuel 15,503 L/h, 48.0 h · fire 114 m³, 42 min.

Scenario sweep (`recompute`, per-hall IT kW):

| hall kW | facility kW | CRAH req/inst | chillers run/total | fuel h | evap L/min | tower kW |
|---|---|---|---|---|---|---|
| 1,125 | 6,525 | 9 / 10 | 1 / 10 | 320 | 67.2 | 5,460 |
| 7,500 | 43,500 | 58 / 59 | 7 / 10 | 48 | 447.8 | 36,403 |
| 9,000 | 52,200 | 70 / 71 | 8 / 10 | 40 | 537.3 | 43,684 |
| 10,000 | 58,000 | 77 / 78 | 9 / 10 | 36 | 597.0 | 48,538 |

Arithmetic that closes and is therefore **not** listed below: facility = IT × PUE; UPS loss = IT(1/η − 1); tower = Q_evap(1 + kWe/kWth); 2N UPS loading of 37.5 % normal and 75 % failover; chiller N+1 count of ceil(41,667/5,000)+1 = 10; fuel usable and autonomy; fire duration and shortfall; makeup = evaporation + blowdown + drift (600.1). Chiller COP 6.06 against Carnot is also fine: T_evap ≈ 18.1 °C, T_cond ≈ 38 °C, COP_Carnot ≈ 14.6, so the machine runs at 41 % of Carnot, a conservative but plausible figure for a centrifugal. The air-side and coil temperatures are monotonic: 19.4 < 25.4 and 27.0 < 36.4.

Severity counts: **CRITICAL 2 · HIGH 7 · MEDIUM 10 · LOW 5** (24 findings).

---

## CRITICAL

### C1. The generator fleet is about one-sixth of the load it is drawn carrying, and the "N+1" claim cannot hold
- **Where:** `EPMS_Telemetry.html:841` (and the B/C entries) prints `spec:'2.5 MW'` for GEN-A/B/C, and lines 1903-1905 export the same in the CSV. `fuel-system.html:1119-1137` lists Gensets A/B/C, and the running set shows `Load = FACILITY_MW`. `fuel-system.html:1414,1468` puts "FACILITY_MW on the running genset, 0 on the others". `fuel-system.html:723` says "holds with 1 genset down (same burn)". The engine declares `generator: 'N+1'` (`js/conv-design-basis.js` STUDY_INPUT.resilience) but sizes no gensets.
- **Numbers:**
  - Installed: 3 × 2.5 MW = 7.5 MW against 43.5 MW facility load now and 58.0 MW at design.
  - One running set is shown carrying 43.5 MW, which is 17.4× a 2.5 MW rating.
  - A real N+1 fleet would be ceil(58,000 / 2,500) + 1 = 24 × 2.5 MW sets, or ceil(58,000 / 3,000) + 1 = 21 × 3 MW sets.
  - Fuel path: the transfer pump P-101 is rated 180 L/min = 10.8 m³/h (`fuel-system.html:800,1774`), but the burn is 15,503 L/h = 15.5 m³/h, so the lead pump cannot keep up with consumption.
  - Day tank: `DT_CAP = 1000` L (`fuel-system.html:1083`) ÷ 15,503 L/h = 3.9 min of buffer.
- **Accepted range:** Largest standby diesel gensets are about 3-4 MWe (CAT 3520 / Cummins QSK95 class). NFPA 110 §5.2 and Uptime Tier III intent require N+1 *units*, each carrying its share. Transfer-pump capacity must exceed the simultaneous burn of every set it feeds (NFPA 110 §7.9 / NFPA 37).
- **Fix:**
  - Add `generator_unit_kw` (ASSUMED, e.g. 2,500 kWe) and `generators_total = ceil(design facility kW / unit) + 1` and `generators_running = ceil(facility / unit)` to the engine.
  - Render one row per set, or a grouped bank, with load = facility ÷ running.
  - Size the day tanks and transfer pumps per set, or per bank, against that set's burn.
- **verify:** `node -e` engine check that `generators_total*unit_kw >= it_design_kw*pue + unit_kw`. `grep -n "FACILITY_MW + 'MW'" fuel-system.html` must return 0 hits. `grep -c "spec:'2.5 MW'" EPMS_Telemetry.html` must equal `generators_total` or 0 after the fix.

### C2. The EPMS single-line puts 21.75 MW through a 3,150 kVA transformer and prints a 34,882 A running current on a 400 V board
- **Where:** `EPMS_Telemetry.html:839/854/868` print `'20kV/400V', spec:'DYN5, 3150KVA'`. `EPMS_Telemetry.html:791-812` sets `lvsbKw = facility/systems` = 21,750 kW and `upsKw` = 15,000 kW. Line 1161 computes `amps = kW*1000/(1.732*V*0.9)`. The comment at line 801 calls this "the drawing's topology showing through honestly".
- **Numbers:**
  - LVSB-A current: 21,750,000 / (1.732 × 400 × 0.9) = 34,882 A.
  - Transformer full-load current: 3,150,000 / (1.732 × 400) = 4,547 A.
  - Transformer loading: 21,750 / 0.9 = 24,167 kVA, which is 767 % of 3,150 kVA.
  - UPS feeder: 15,000 kW at 400 V = 24,056 A.
  - PDU feeder: `pduKw` = 30,000 / 20 = 1,500 kW, i.e. 2,405 A per "PDU".
  - Total transformer capacity is 3 × 3,150 = 9,450 kVA, about 8.5 MW at PF 0.9, against 43.5 MW.
- **Accepted range:**
  - Largest LV ACB / busbar is about 6,300 A, roughly 4 MVA at 400 V (IEC 61439-2, IEC 60947-2).
  - Transformers run at ≤ 100 % of nameplate (IEC 60076-7 loading guide). For 2N they run at ≤ 50 % each in normal operation.
  - Rack PDUs are typically 15-60 kVA. Floor PDUs / RPPs are 150-500 kVA.
- **Fix:** Derive the transformer count from the engine as `ceil(facility_design_kVA / (tx_kVA × 0.5))` per side for 2N. Either draw a representative block ("1 of N") with per-block kW = facility ÷ N, or label the stream as an aggregate and drop the A figure. Never print an ampere figure for a conductor whose kW exceeds the drawn device rating.
- **verify:** In the EPMS ladder, assert that `lvsbKw/0.9 <= tx_kVA` and that `amps <= 6300` for every 400 V wire. Both fail today, at 767 % and 34,882 A.

---

## HIGH

### H1. WUE 1.2 L/kWh and evaporation 447.8 L/min break the engine's own 36.4 MW tower energy balance
- **Where:**
  - `js/conv-engine.js:461` sets `waterFlowLpmForWue = WUE × IT / 60`.
  - `js/conv-engine.js:993` sets `evaporation_lpm = (M − D)(C − 1)/C` = 447.8.
  - The WUE is authored at `MODEL.environment.wue_l_per_kwh` = 1.2. The registry marks it ADOPTED from doc-09, the retired 1.85 MW basis.
  - `water-system.html:907-908` prints evaporation next to "Heat rejected".
- **Numbers:**
  - Latent heat rejected by 447.8 L/min: 7.46 kg/s × 2,430 kJ/kg = 18.1 MW. That is 50 % of the 36,403 kW tower duty.
  - Physical evaporation with 85-100 % of the heat rejected as latent: 36,403 × 0.85-1.0 / 2,430 = 12.7-15.0 kg/s = 764-899 L/min.
  - The CTI rule of thumb gives the same answer. Circulating flow is 36,403 / (4.186 × 5) = 1,739 L/s = 27,570 gpm, so E = 0.00085 × 9 °F × 27,570 = 211 gpm = 798 L/min.
  - Makeup at C = 4: M = E × C/(C − 1) = 1,019-1,199 L/min, so WUE = M × 60 / 30,000 = 2.0-2.4 L/kWh_IT.
  - The site is tropical (Bekasi, see M10), so there is no economiser hours relief.
- **Accepted range:**
  - The Green Grid WUE white paper (WP#35) and LBNL 2016 put evaporative-tower DCs at about 1.8 L/kWh average, higher in hot-humid climates.
  - CTI / ASHRAE Handbook HVAC Systems Ch.40 put evaporation at about 1 % of circulating flow per 5.6 K of range.
- **Fix:** Derive evaporation from `tower_rejection_kw_th × latent_fraction / h_fg`, with `latent_fraction` ASSUMED at 0.85 and `h_fg` STANDARD at 2,430 kJ/kg. Then compute blowdown, makeup and WUE from it. Keep 1.2 / 1.3 only as a labelled target, which will then show as missed.
- **verify:** Engine identity `abs(evaporation_lpm*60/3600*2430 - tower_rejection_kw_th*latent_fraction)/tower_rejection_kw_th < 0.02`. It fails today: 18.1 MW vs 30.9 MW.

### H2. The "installed" CRAH count changes with the operating scenario, so at the design load the halls are 24 % short of air-side capacity
- **Where:** `js/conv-engine.js:287-291` sizes `crahRequired` on `site.it_load_kw / halls`, i.e. the current scenario. `js/conv-engine.js:855` sets `crah_installed = crahRequired + 1`. The chillers, by contrast, are sized on `it_design_kw` (`js/conv-engine.js:335-350`).
- **Numbers:**
  - Installed CRAH per hall is 10 / 59 / 71 / 78 at 1,125 / 7,500 / 9,000 / 10,000 kW. Installed equipment cannot depend on load.
  - The 59 units "installed" at the adopted scenario give (59 − 1) × 130 = 7,540 kW N+1 capacity, against 10,000 kW design per hall: 24.6 % short.
  - The N+1 margin at the adopted load is 7,540 − 7,500 = 40 kW (0.5 %), before any fan heat.
- **Accepted range:**
  - ASHRAE TC9.9 / Uptime Tier III: installed capacity is sized on design IT plus redundancy.
  - Typical CRAH redundancy is N+1 per 8-10 units or N+20 %, with 10-15 % sizing margin (CIBSE Guide B / vendor practice).
- **Fix:** Use `crah_required_design = ceil(it_design_kw_per_hall / unit)` = 77, so `crah_installed` = 78. Keep `crah_running = ceil(it_load/unit)` for the scenario.
- **verify:** `recompute` with hall load 1,125 and with 10,000 must return the same `cooling.crah_installed`. Today it returns 10 vs 78.

### H3. The design-point PUE 1.45 is applied at 75 % and 11 % load, which the design basis says is UNAVAILABLE
- **Where:**
  - `js/conv-engine.js:260-262` computes `facility = it_load × pue` for every scenario.
  - `js/conv-design-basis.js` STUDY_INPUT.pue sets `designLoadFraction: 1, offDesignPolicy: 'unavailable-without-approved-curve'`, and `evaluateLoad()` returns `status:'unavailable'` off-design.
  - The registry method for `site.pue` says "Off-design values are UNAVAILABLE without an approved curve".
- **Numbers:**
  - Adopted: 30,000 kW is 75 % of 40,000, and facility 43,500 = 30,000 × 1.45 is printed as fact on every page.
  - Day-1-low: 4,500 kW is 11.25 % of design, and facility 6,525 kW still uses 1.45.
  - At 11 % load the fixed losses alone exceed that: transformer no-load, lighting, minimum chiller/pump/tower duty, and 40 CRAH running.
- **Accepted range:** ISO/IEC 30134-2 defines dPUE at the stated design point. The Green Grid / ASHRAE 90.4 note that part-load PUE rises sharply below about 50 % load (typically 1.8-3 at 10-20 %).
- **Fix:** Either (a) label facility, non-IT, EPMS, fuel burn and carbon at non-design scenarios as "PUE at design point, applied off-design: ASSUMED", with the evidence class shown, or (b) return UNAVAILABLE off-design as `evaluateLoad()` already does, or (c) adopt a part-load curve.
- **verify:** `RZConvDesignBasis.evaluateLoad(STUDY_INPUT, 0.75).status === 'unavailable'` while `CONV_CALC.snapshot.site.facility_load_kw` is a number. After the fix, either the engine carries an off-design flag or both agree.

### H4. `environment.avg_temp_c` = 22.4 °C is printed as the cold-aisle setpoint, three degrees below the engine's own 25.4 °C rack inlet
- **Where:**
  - `dc-conventional.html:2135` prints `['Cold-aisle setpoint', avg_temp_c …, 'ASHRAE TC 9.9 recommended']`.
  - The KPI tiles at `dc-conventional.html:1140-1142, 1198, 1331`.
  - The registry label is "Average cold-aisle temperature".
  - `chiller-plant.html:1611-1614` describes the same parameter as "a site annual average".
- **Numbers:**
  - The engine thermal chain is rack inlet 25.4 °C with 0 K supply-path mixing, so CRAH supply = cold aisle = 25.4 °C. A 22.4 °C cold aisle would need 3 K of sub-cooling below the CRAH supply, which is impossible with containment.
  - Read as a site annual average instead, 22.4 °C is about 5 K below the Bekasi/Jakarta annual mean of about 27-28 °C (BMKG; ASHRAE Handbook Fundamentals climatic data WMO 967450/967490).
- **Accepted range:** One parameter carries one meaning (ACCURACY_VALIDATION Rule 5, terminology must match the basis).
- **Fix:** Bind the cold-aisle tiles to `cooling.rack_inlet_target_c` (25.4). Delete `avg_temp_c`, or rename it `site_ambient_annual_mean_c` with a sourced climatic value. Correct the chiller-plant basis string.
- **verify:** `grep -n "Cold-aisle setpoint',s.environment.avg_temp_c" dc-conventional.html` must return 0 hits. Engine identity: printed cold-aisle value == `cooling.crah_supply_air_c + supply_path_mixing_k`.

### H5. Fire-pump and jockey-pump motors are smaller than the hydraulic power of their own rated duty
- **Where:** `fire-system.html:825` and `1391` print FP-01 as "227 m³/h @ 120 m · 75 kW". `fire-system.html:823` and `1402` print JP-01 as "18 m³/h @ 140 m · 5.5 kW".
- **Numbers:**
  - FP-01 hydraulic power: ρ g Q H = 1000 × 9.81 × (227/3600) × 120 = 74.2 kW. A 75 kW motor would need a 99 % efficient pump. At 70-78 % pump efficiency the shaft needs 95-106 kW at the rated point, and more at the 150 % point.
  - JP-01: 1000 × 9.81 × (18/3600) × 140 = 6.87 kW hydraulic, already more than the 5.5 kW motor before any losses (pump efficiency about 40-55 % for multistage jockeys gives 12-17 kW shaft).
- **Accepted range:** NFPA 20 §9.5.2.2: the motor must not exceed its service-factor rating at any pump load up to 150 % of rated flow. Fire-pump efficiency is typically 65-80 % (Hydraulic Institute).
- **Fix:** Re-state the motors (e.g. FP-01 132 kW, JP-01 15 kW), or reduce flow/head to a consistent vendor point. Add a page assertion `motor_kW >= 1.15 × ρgQH/η` with η = 0.75.
- **verify:** The node check `9.81*227/3.6*120/1000/0.75 <= 75` must evaluate true. Today it is 98.9 > 75.

### H6. The Tech Spec prints "UPS module count 2" and labels the total UPS output as per-system
- **Where:** `dc-conventional.html:2374` prints `['UPS module count','2 (A + B feed)','MODEL.electrical.ups_module_count']`. `dc-conventional.html:2371` prints `['UPS output (per system)', epms_ups_output_kw …]`.
- **Numbers:**
  - The engine reports `ups_module_count` = 64 (2 systems × 32 × 1,250 kW). The literal 2 is off by 32×. The cited source path `MODEL.electrical.ups_module_count` does not exist; it is a snapshot-derived value.
  - `epms_ups_output_kw` = 30,000 kW is the total. Per system it is `ups_system_kw` = 15,000 kW.
- **Accepted range:** ACCURACY_VALIDATION Rule 1, one source of truth, and Rule 3, explicit denominator.
- **Fix:** Render `s.electrical.ups_module_count` (64) and `s.electrical.ups_system_kw` (15,000) with the correct labels.
- **verify:** `grep -n "'2 (A + B feed)'" dc-conventional.html` must return 0 hits. The probe asserts that the rendered "UPS output (per system)" equals `snapshot.electrical.ups_system_kw`.

### H7. The ICT access layer is sized for about 20 racks, not 2,000
- **Where:** `ict.html:929-931` sets `access.installedSwitches: 20`, core 2 × 40G, and fabric 4 × 100G. `ict.html:974` derives 500/12 = 42 access groups per hall. `ict.html` node list shows "ToR 01-05 · Hall A" against "study 500 racks · 42 grp".
- **Numbers:**
  - 20 ToR for 2,000 racks is 100 racks per "top-of-rack" switch.
  - The page's own study gives 4 × 42 = 168 access groups, i.e. ≥ 168 access switches, or 336 with A/B redundancy.
  - Uplink oversubscription: even at 2 × 25G per rack, 2,000 × 50 = 100 Tbps of edge against 400 Gbps of fabric is 250:1. A 30 MW hall typically runs 3:1 to 5:1 leaf-to-spine.
- **Accepted range:** ANSI/TIA-942-B and BICSI 002-2019: one ToR (or two) per rack, or EoR/MoR per row of 10-20 racks. Typical leaf oversubscription is 3:1 enterprise and 1:1 to 2:1 AI/HPC.
- **Fix:** Derive `access_switches = 4 halls × 42 groups × 2 (A/B)` and show the fabric oversubscription from it. Keep traffic as an authored scenario, but label the capacity basis as illustrative if it is not resized.
- **verify:** `TOR_COUNT >= 4*Math.ceil(500/12)` in an ict.html probe. Today it is 20 vs 168.

---

## MEDIUM

### M1. The heat balance and PUE are not reconciled bottom-up, and the PUE residual is labelled "Cooling overhead"
- **Where:**
  - `js/conv-engine.js:313-315` sets heat rejection = IT + UPS loss only.
  - `dc-conventional.html:2042` and `2129` carry `WK('Cooling overhead share', '(PUE − 1) × IT')`.
- **Numbers:**
  - Non-IT is 13,500 kW. The engine attributes only UPS loss 1,250 + chillers 5,153 = 6,403 kW, leaving 7,097 kW (53 %) unattributed.
  - A typical bottom-up for this plant:
    - CHW pumps: 982 L/s × 300 kPa / 0.75 = 393 kW.
    - CDW pumps: 1,739 × 250 / 0.75 = 580 kW.
    - Tower fans: about 1-1.5 % of 36.4 MW = 360-550 kW.
    - CRAH fans: 232 units × 6-8 kW = 1.4-1.9 MW.
    - LV/MV distribution losses: about 1.5 % = 650 kW.
    - Lighting and misc: about 300 kW.
    - Total: about 3.7-4.4 MW, leaving roughly 2.7-3.4 MW unexplained.
  - The CRAH fan heat (about 1.6 MW) and in-hall distribution heat also land in the CHW loop but are excluded from the evaporator duty. At design that cuts the chiller N+1 margin from 45,000 − 41,667 = 3,333 kW to about 1,100 kW (2.4 %).
  - "Cooling overhead = (PUE − 1) × IT = 13,500 kW" counts the 1,250 kW UPS loss and every electrical loss as cooling.
- **Accepted range:** ISO/IEC 30134-2 (PUE components); ASHRAE 90.4 MLC/ELC split; Uptime/TGG PUE breakdown.
- **Fix:**
  - Rename the row "Non-IT overhead (PUE residual)".
  - Add ASSUMED fan, pump and distribution terms and publish `non_it_unattributed_kw`.
  - Add CRAH fan heat to `heat_rejection_kw` or `chiller_design_duty_kw_th`.
- **verify:** `grep -n "Cooling overhead share" dc-conventional.html` must return 0 hits. Engine identity: `ups_loss + chiller_input + pumps + fans + distribution + unattributed == non_it_load_kw`.

### M2. The per-chiller flow setpoint uses the IT-only flow, so each evaporator runs at ΔT 7.92 K, not the printed 7.6 K
- **Where:** `js/conv-engine.js:919-921` computes `flow_per_machine_lps = chwFlowLps / running` = 943.0/7 = 134.7 L/s. The chiller P&ID and the setpoint card read it (`chiller-plant.html:948`).
- **Numbers:** The per-machine duty is 31,250/7 = 4,464 kW. ΔT = 4,464 / (4.186 × 134.7) = 7.92 K, against `chw_delta_t` 7.6 K. At 7.6 K the machine needs 982.3/7 = 140.3 L/s.
- **Accepted range:** Mass and energy balance, Q = ṁ c_p ΔT (ASHRAE Fundamentals Ch.1).
- **Fix:** `flow_per_machine_lps = plant_duty_flow_lps / chillers_running`.
- **verify:** `abs(heat_rejection_kw/chillers_running/(4.186*flow_per_machine_lps) - chw_delta_t) < 0.05`. Today the difference is 0.32.

### M3. "Plant COP" and "plant kW/RT" are compressor-only figures
- **Where:** `js/conv-engine.js:900-901` computes `plant_cop = 1/0.16491` and `plant_kw_per_rt = 0.16491 × 3.517`. The registry labels it "Plant COP", and chiller-plant.html renders "COP".
- **Numbers:**
  - 0.58 kW/RT is chiller input only.
  - Adding CHW + CDW pumps (about 973 kW) and tower fans (about 450 kW) gives (5,153 + 973 + 450) / 8,885 RT = 0.74 kW/RT. All-plant COP is then about 4.75, not 6.06.
- **Accepted range:** ASHRAE 90.1 Appendix G and Taylor "all-variable-speed plant" define plant kW/ton as chillers + pumps + towers. Typical efficient water-cooled plants run 0.6-0.9 kW/RT all-plant.
- **Fix:** Rename the fields `chiller_cop` / `chiller_kw_per_rt`, or add the auxiliaries and keep the "plant" name.
- **verify:** The registry label for `cooling.plant_cop` must not contain "Plant" unless the formula includes pump and tower terms.

### M4. Fuel specific consumption is 30-40 % above full-load diesel data, and the 48 h target holds only at 75 % load
- **Where:** `js/conv-engine.js:619` sets `specific_consumption_l_per_kwh: 0.356384`. It came from the pair 956 L/h at 2,682.5 kW on the retired small plant (`js/conv-engine.js:425-431`). `dc-conventional.html:2352` says "matches 48 hr canonical".
- **Numbers:**
  - Typical standby diesel at 75-100 % load uses 0.25-0.28 L/kWh (e.g. a 2.5 MWe set burns about 640-680 L/h at full load). The model's 0.356 overstates burn by 27-43 %.
  - At design facility load of 58,000 kW: 744,144 / (58,000 × 0.356) = 36.0 h at 85 % level, not 48 h.
- **Accepted range:** Vendor spec sheets (CAT 3516C, Cummins QSK78/95) give 0.24-0.28 L/kWh at 75-100 %. NFPA 110 Class designations are at full rated load.
- **Fix:** Re-source the consumption from a named genset curve at the actual per-set loading. State the autonomy at design load next to the current load.
- **verify:** `recompute` at 10,000 kW/hall gives `fuel.autonomy_hr` = 36. Any page that prints "48 hr" must name the load it holds at (`grep -n "48 hr canonical" dc-conventional.html`).

### M5. The EPMS topology (A/B plus a "catcher" stream C, with mechanical UPS) contradicts the engine's 2N with mechanical not on UPS
- **Where:**
  - `EPMS_Telemetry.html:849` defines UPS-M-A/B as "Cooling Support".
  - `EPMS_Telemetry.html:869-873` defines LVSB-C "Catcher Main" and UPS-IT-C.
  - The engine at `js/conv-engine.js:372-381` sets "Critical mech on UPS taken as 0" and `ups_redundancy: '2N'`, `ups_system_count: 2`.
- **Numbers:** EPMS draws three IT UPS streams plus two mechanical UPS. The engine has two systems of 32 modules and 0 kW mechanical on UPS. A catcher topology is block-redundant (N+1 catcher), not 2N.
- **Accepted range:** Uptime Tier Standard: Topology, and IEC 62040-3, both distinguish 2N, distributed redundant and block-redundant (catcher) architectures.
- **Fix:** Redraw EPMS as 2N A/B with mechanical on the generator-backed board. Alternatively, change the engine to catcher redundancy and publish mechanical UPS load. One basis either way.
- **verify:** `grep -c "Catcher\|UPS-M-" EPMS_Telemetry.html` must be 0 while `ups_redundancy==='2N'` and `epmsUpsOutputKw==it_load_kw`.

### M6. Fire-main static pressure exceeds the standard 175 psi component rating
- **Where:** `js/conv-engine.js:667` sets `static_pressure_bar: 12.5`. `fire-system.html:688` sets jockey stop 12.8 bar. Pump head is 120 m (11.8 bar) at rated flow (`fire-system.html:1391`).
- **Numbers:** 12.5 bar = 181 psi and 12.8 bar = 186 psi, both above 12.07 bar (175 psi). Centrifugal churn is at most 140 % of rated head (NFPA 20 §4.8): 168 m = 16.5 bar plus suction.
- **Accepted range:** NFPA 13 §7.1.1 / §8.1 (2022): system components are listed for 175 psi unless high-pressure-listed. NFPA 20 §4.8.1 governs churn.
- **Fix:** State 300 psi-rated components and PRVs as a design assumption, or lower the static/jockey setpoints below 12.07 bar.
- **verify:** `snapshot.fire.static_pressure_bar <= 12.07` or a registry note naming high-pressure-rated components.

### M7. The suppression agent is stated four different ways, and an N2 generator is presented as the suppression agent
- **Where:**
  - `fire-system.html:12` meta says "FM-200 status".
  - `dc-conventional.html:1029` says "FM200/Novec suppression".
  - `dc-conventional.html:2320` says "NOVEC 1230 / FK-5-1-12 / IG-541 (candidate)".
  - `fire-system.html:1405-1410` says "N2-GEN-01 · Inert Gas Generator … Protected zones … Hold time target 600 s", and `fire-system.html:1338` says "DISCHARGE. Inert gas / pre-action released".
- **Numbers:** None needed. A nitrogen generator supervises dry/pre-action pipe at 0.7-2.8 bar (the page itself prints 2.4 bar header). It cannot deliver an NFPA 2001 inert-gas design concentration (IG-541 at about 38-43 % by volume within 60 s), which needs stored cylinders.
- **Accepted range:**
  - NFPA 2001 (2022) §5.7.1.2: halocarbon 10 s, inert 60 s. §5.6: retention (hold) time.
  - NFPA 13 §8.3.2.5 / §16.10: N2 for pre-action supervision.
- **Fix:**
  - Rename N2-GEN-01 to "Pre-action N2 supervision generator" and drop "Protected zones" and "Hold time" from it.
  - Add a separate clean-agent row (agent, cylinders, design concentration) or state UNAVAILABLE.
  - Align the meta description and the nav label to one agent.
- **verify:** `grep -n "FM-200\|FM200" fire-system.html dc-conventional.html` must return 0 hits, or exactly one agent name across both pages.

### M8. Fire storage is sized on 2,500 L/min, but the pumps are rated at 3,783 L/min
- **Where:** `js/conv-engine.js` `fire.pump_demand_lpm` = 2,500 (ASSUMED). The pumps on `fire-system.html:825,1391,1397` are 227 m³/h each.
- **Numbers:** 227 m³/h = 3,783 L/min is 151 % of the demand. The 114 m³ tank lasts 114,000 / 3,783 = 30 min at rated flow and 20 min at the 150 % point, against the 60 min required. The engine already flags a 36 m³ shortfall at 2,500 L/min, which is honest. The pump rating and the demand basis just disagree.
- **Accepted range:** NFPA 20 §4.8: the pump is selected at system demand. NFPA 13 Table 19.3.3.1.2 gives OH duration of 60-90 min including hose allowance.
- **Fix:** Select the pump rated flow at or just above the 2,500 L/min demand (e.g. 150 m³/h), or size the storage on the rated flow, and state which governs.
- **verify:** Page assertion `pump_rated_lpm <= 1.1*pump_demand_lpm` or `reserve_capacity_m3 >= pump_rated_lpm*required_duration_min/1000`.

### M9. Refrigerant pressures disagree with R-1234ze(E) saturation at the printed saturation temperatures
- **Where:** `chiller-plant.html:1309-1312` sets `evapSat = t1 − 1.3`, `condSat = t2 + 10.4`, `suction = 245 + idx×7.2`, `discharge = 690 + idx×14.1` in kPa (`chiller-plant.html:891,894`). The refrigerant is R-1234ze(E) (`chiller-plant.html:1686`).
- **Numbers:**
  - At full load (idx 18): suction 375 kPa and discharge 944 kPa.
  - R-1234ze(E) saturation is about 16 °C at 375 kPa abs and about 48 °C at 944 kPa abs.
  - Printed condSat = CHW return 27 + 10.4 ≈ 37.4-38 °C, so the discharge pressure is about 10 K off.
  - condSat is also keyed to the *chilled-water* return, not the condenser water (37 °C leaving). A condensing temperature must sit above the CDW leaving temperature by 1-2 K, and this one does so only by coincidence.
  - If the pressures are gauge, the suction becomes 476 kPa abs ≈ 23.5 °C, above the 19.4 °C CHWS, which is impossible.
- **Accepted range:** NIST REFPROP / ASHRAE Fundamentals Ch.30 property tables. Centrifugal condenser approach is 0.5-2 K.
- **Fix:** Compute condSat = `cdw_return_c + approach`. Compute the pressures from a saturation fit of the refrigerant, and state abs or gauge.
- **verify:** `|Psat_R1234ze(condSat) - discharge| / discharge < 0.05` at full load. Today it is about 0.24.

### M10. The grid carbon factor 0.42 kgCO2/kWh is about half the Java-Bali grid factor for the site the pages place in Bekasi
- **Where:** `js/conv-engine.js:523` sets `carbon_kg_per_facility_kwh: 0.42`, ADOPTED from doc-09. The site is placed in Bekasi by `ict.html` (RTR-BKS01, "DCI BKS01-MKS") and by `dc-conventional.html:2256` ("Pergub discharge limits").
- **Numbers:** 43,500 × 0.42 = 18,270 kgCO2/h. At 0.80-0.87 it would be 34,800-37,850 kgCO2/h, about 1.9-2.1× higher.
- **Accepted range:** Indonesia MEMR/KESDM (Ditjen Gatrik) JAMALI grid emission factor, about 0.80-0.87 tCO2/MWh (2019-2023). IEA Indonesia average is about 0.75. 0.42 matches Singapore (EMA 2023: 0.41) rather than Indonesia.
- **Fix:** Source the factor for the stated grid (name the publication and year). If the site is generic, remove the Bekasi identifiers.
- **verify:** The registry source for `environment.carbon_kg_per_facility_kwh` names a grid. The value must lie within that publication's ±5 %.

---

## LOW

### L1. Rack-equivalents at 6/8/10 kW (5,000 / 3,750 / 3,000) exceed the 2,000 physical positions
- **Where:** `js/conv-engine.js:485-487,1006-1008`; `dc-conventional.html:2546-2550` ("…dense AI hall (compact)"); `ict.html:1996`.
- **Numbers:** 30,000 / 6 = 5,000 racks, but the campus has 2,000 racks at 15 kW actual average (20 kW design). Every listed density gives more racks than exist, and "10 kW" is not an AI density (ASHRAE TC9.9 / Uptime 2024 put AI at 40-130 kW).
- **Fix:** Bracket the densities around the real basis (15 / 20 / 30 kW gives 2,000 / 1,500 / 1,000) and drop the "AI hall" wording.
- **verify:** Every `racks.at_*` value must be ≤ `campus.racks_total`.

### L2. Tower blowdown/drift use a non-standard formula and a basis 100× off from the Tech Spec
- **Where:** `js/conv-engine.js:172,990-993`; `dc-conventional.html:2148-2149,2169`.
- **Numbers:**
  - Engine: drift = 0.5 % of *makeup* = 3 L/min, and B = (M − D)/C = 149.3.
  - Standard (CTI WTP-148, ASHRAE Handbook HVAC Applications Ch.50): B = E/(C − 1) − D = 447.8/3 − 3 = 146.3. Drift is specified as a % of *circulating* flow: 0.0005-0.005 % gives 0.5-5.2 L/min on 104,340 L/min.
  - The Tech Spec prints "drift < 0.005 %", while the engine uses 0.005 (0.5 %). The Tech Spec also says "assumes 6 cycles of concentration", while the engine uses 4.
- **Fix:** Use `drift = circ_flow × 0.00005` and `B = E/(C − 1) − D`. Bind the Tech Spec COC and drift text to the engine values.
- **verify:** `grep -n "assumes 6 cycles" dc-conventional.html` must return 0 hits. Engine identity `M == E*C/(C-1)` within 1 %.

### L3. UPS efficiency is a flat 96 % at 37.5 % load
- **Where:** `js/conv-engine.js` `electrical.ups_efficiency` = 0.96, applied at a normal 2N loading of 37.5 %.
- **Numbers:** Double-conversion efficiency at 25-50 % load is typically 94.5-95.5 %. At 95 %: loss = 30,000 × (1/0.95 − 1) = 1,579 kW, against 1,250 kW (+329 kW).
- **Accepted range:** IEC 62040-3 Annex efficiency classes; vendor curves (Eaton 93PM, Vertiv EXL S1, Galaxy VX).
- **Fix:** Use an efficiency-vs-load table, or state "96 % at design loading" with the evidence class.
- **verify:** The registry method for `electrical.ups_efficiency` names the load fraction it applies at.

### L4. Day-tank capacity differs between pages
- **Where:** `dc-conventional.html:2355` says "2,000 L (typical day tank)". `fuel-system.html:1083` sets `DT_CAP = 1000`.
- **Numbers:** 2,000 vs 1,000 L. Both are divided by the full campus burn: 2,000/15,503 = 7.7 min and 1,000/15,503 = 3.9 min "per refill". This is the C1 one-genset error carried into the tank sizing.
- **Fix:** One engine parameter, `day_tank_l`, sized per set against per-set burn.
- **verify:** `grep -nE "2,000 L \(typical day tank\)|DT_CAP = 1000" *.html` must resolve to one value.

### L5. Evidence-class honesty: the tank is ASSUMED but was back-solved from the 48 h target, and the ICT page hard-codes PUE
- **Where:**
  - The registry `fuel.tank_capacity_l` is ASSUMED, with method "Sized to hold the autonomy target", while `fuel.autonomy_hr` is DERIVED = 48. 972,737 = 48 × 15,503 / (0.85 × 0.9), so the "derived" autonomy only restates its input.
  - `ict.html:1996` prints the literal `PUE <b>1.45</b>`.
  - `js/conv-engine.js:244-249` calls a 1,250 kW unit a "standard modular-UPS building block". Modular UPS modules are 25-300 kW, and 1,250 kW is a monolithic frame. 32 frames in one parallel bus (40 MW at 400 V) is not buildable.
- **Fix:**
  - Mark `fuel.tank_capacity_l` as DERIVED from `autonomy_target_hr` (ADOPTED) and publish the target separately.
  - Bind the ICT PUE to `SNAP.site.pue`.
  - Describe the UPS as "1,250 kW block UPS, per-hall 2N pairs".
- **verify:** `grep -n "PUE <b>1.45" ict.html` must return 0 hits. The registry `fuel.tank_capacity_l.evidenceClass === 'DERIVED'`.

---

## Top 5

1. **C1:** 3 × 2.5 MW gensets (EPMS/fuel) shown carrying a 43.5 MW facility on one set. The N+1 claim cannot hold, and the 180 L/min transfer pump is below the 258 L/min burn.
2. **C2:** EPMS 3,150 kVA transformers carry 21.75 MW (767 %), and the page prints a 34,882 A running current on a 400 V board.
3. **H1:** WUE 1.2 and evaporation 447.8 L/min reject only 18 MW of the 36.4 MW tower duty. Physical WUE is about 2.0-2.4 L/kWh.
4. **H2:** The CRAH "installed" count tracks scenario load (10→78). At design the halls are 24.6 % short, and the N+1 margin is 40 kW.
5. **H3:** The design-point dPUE 1.45 is applied at 75 % and 11 % load, against the design basis's own "UNAVAILABLE off-design" contract.

## Not checked or not available
- Pipe sizes, pump heads and fan powers: none are published for CHW/CDW, so velocity and affinity-law checks are impossible. M1 gives typical estimates instead.
- Battery autonomy: no UPS battery kWh or minutes are printed anywhere.
- NFPA 72 detector spacing and clean-agent quantities: no detector counts, areas or agent masses are printed (see M7).
- Tower approach to wet bulb: no wet-bulb parameter exists. A CDW supply of 32 °C against a Bekasi 0.4 % design WB of about 27.5 °C gives a plausible 4.5 K.
