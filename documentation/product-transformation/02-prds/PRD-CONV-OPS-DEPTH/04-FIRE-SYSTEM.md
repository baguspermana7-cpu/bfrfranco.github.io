# PRD-CONV-OPS-DEPTH · 04 Fire System — an operator can read the whole fire plant (detection, release, water, agent, interlocks) from the cockpit

Status: DRAFT for owner (2026-11-22). Parent: PRD-CONV-OPS-DEPTH/README.md.
Page: `fire-system.html` (inline script lines 620-1530) + `js/conv/fire-sheet.js` (FS-M-101, 130 lines) + the fire rows of `js/conv/payloads.js` (159-225).
Standards in scope: NFPA 72 (alarm, signals, emergency control functions), NFPA 75 / 76 (IT and telecom facilities), NFPA 2001 (clean agent), NFPA 13 (sprinkler, pre-action), NFPA 20 (fire pumps), NFPA 22 (tanks), NFPA 25 (ITM), NFPA 70 Art. 645 (IT room disconnect / EPO).

## 1. Owner request

Quoted from the shared brief (2026-11-22, Indonesian, verbatim):

> "dan juga page2 lain selain chiller plant ini, rancang masing2 prd utk perbaikan dan improvement."
> "ada banyak yang belum ada di chiller plant scada hmi ini, banyak" — "implement all"

Meaning for this page (brief, "Meaning" paragraph): the fire cockpit must read like a real SCADA/BMS operator screen. Every device shows its operating parameters (pressure, weight, obscuration, timer, running count, setpoint vs actual); the control logic is visible (cross-zone, double interlock, pre-discharge delay, abort, hold time, lockout, pump sequence); and physical motion is shown (impeller at its speed, water moving at its rate, tank level, agent weight falling). Nothing may be typed into a drawing.

## 2. Measured state today

Method: `node -e` over `js/conv/fire-sheet.js` (node/edge counts), `grep -c` / `grep -n` over `fire-system.html`, `js/conv/payloads.js`, `data/conv-parameters.json`, `data/conv-limits.curated.json`. Line numbers are from this worktree (engine 2.6.0).

### 2.1 Inventory of what the page draws and shows

| Equipment class | Count on FS-M-101 | Operating parameters shown today (where) | Count | Expected on a real plant and MISSING |
|---|---|---|---|---|
| FACP-01 | 1 | stage text NORMAL / PRE-ALARM / FIRE · Z1 / LOCKOUT (`fireRead` 989, sheet value `st`) | 1 text | first-out zone, alarm / supervisory / trouble counts per point, ACK / SILENCE / RESET state, battery V and charger (modal shows a simulated `S()` 27.2 V that does not follow the stage), loop health, disabled-point count (strip shows "—", `#as-disabled`) |
| VESDA-01/02 | 1 symbol (two units named) | state text NORMAL / ALERT / ACTION (`fireRead` 995) | 1 text, 0 numbers | obscuration %/m, the four thresholds Alert / Action / Fire 1 / Fire 2 (only Alert 0.05 and Fire 1 0.20 exist, as modal text `payloads.js:187`), airflow %, pipe-network fault, transport time (120 s NFPA 72 is a spec row only), per-zone reading |
| Zone detection chips ZONE 1..5 | 5 | text only; ZONE 1 reacts, ZONES 2-5 are constant NORMAL (`fireRead` 1001: `id === 'zd1' && v.st > 0`) | 5 texts, 4 dead | per-zone smoke detector (SD) and heat detector (HD) state, VESDA reading per zone, impaired / isolated state, cross-zone count |
| MCP-01, ABT-01 | 2 | ABT shows NORMAL / LIVE; MCP shows no value | 1 text | no operator action exists: 0 abort handlers, 0 manual-release handlers, 0 MCP handlers. Operator controls on the page = 3 buttons (ARM, SIMULATE FIRE EVENT, RESET) |
| RCP-01 (release panel) | 1 | none | 0 | circuit supervision mA (modal `S()` 12 mA static), solenoid state, pre-discharge timer, delay setting |
| Stage machine | 0..5 (6 reachable) | 7 chips drawn, `data-stage` 0..6 (`fs-chip` x7); CE matrix 6 rows | 7 chips / 6 rows | chip 6 and `ZONE_SHEET_STATE[6]` LOCKOUT are reachable only through the test seam `stageForTest` (787); the sim stops at 5 |
| Cause-and-effect interlock list | 9 rows (`FIRE_INTERLOCKS` 736-746) | command text per row | 9 | proven state: 6 of 9 rows say "NOT MODELED", 2 say "SIMULATED ... ONLY", 1 is manual-only (EPO). Standard line 124-129 requires commanded and proven separately: 0 of 9 comply |
| Fire / smoke dampers, CRAH / AHU stop, door holders, lift recall, sounders, strobes, voice evac | 0 drawn | list rows only | 0 symbols | library has `damperFire`, `sounder`, `strobe`, `epo`, `agentCylinder`, `nozzle` (`rz-eng-symbols.js:39-41,107-114`): 6 fire symbols exist, 0 are placed on FS-M-101. No `doorHolder` symbol exists |
| EPO | 0 | list row "NO AUTOMATIC EPO / MANUAL" | 1 text | EPO station, guarded state, operated state, which feeders it trips (NFPA 70 Art. 645, NFPA 75) |
| Clean-agent system (NFPA 2001) | 0 | none. `<meta name=description>` (line 12) promises "FM-200 status"; nothing on the page shows it | 0 | cylinders (count, pressure, weight, fill %), release valve / pilot, discharge time, pre-discharge timer, abort, manual release, hold time, nozzle state, pressure switch, door-fan retention. Standard line 126 lists "pre-action and agent paths" |
| N2-GEN-01 (pre-action supervisory gas) | 1 | sheet value `2.4 bar` or `ZONE 1 VENT` (`fireRead` 987-988); a point `fire.N2-GEN-01.pressure_bar` is bound | 1 literal | pressure per PAV zone, purity %, run state, low 1.7 / high 3.1 bar alarms (those limits exist only as modal text `payloads.js:210`) |
| PAV-01..05 pre-action valves | 5 | state open / closed; only PAV-1 reacts (`fireRead` 1003) | 1 state x1 live | supervisory N2 pressure, solenoid, flow switch, tamper, interlock type (single / double), trip reason |
| WAV-01..03 wet-pipe valves | 3 | state fixed `closed` (`fireRead` 1007) | 0 live | flow switch, tamper switch, water-flow alarm path; a wet zone can never alarm |
| Sprinkler heads | 8 (5 pre-action + 3 wet) | only `sp1` reacts (state `operated` at stage 5) | 1 live | head fusing as an input to the double interlock; any other head |
| TK-FW-01 tank | 1 | level %, volume m3, duration min (3 bound points, lod 1) | 3 | low / low-low drawn (standard), make-up valve state, refill time, level transmitter quality |
| FP-01 / JP-01 / FP-02 pumps | 3 | CMD ON/OFF over RUN/STOP (2 texts each) | 6 | per pump: suction pressure, discharge pressure, flow, controller state AUTO / MANUAL / OFF, run hours, starts per hour, last test, driver current, churn test; diesel: battery A/B, fuel level, crank attempts, engine rpm, coolant, oil. See 2.2 for the literals |
| Header / riser | PT-01, FE-01, FT-MU | 3 numbers (bar, m3/h, m3/h) | 3 | header pressure low / high bands drawn, flow-switch proof, test header flow (FE-01 is the only meter) |
| Dead CSS | page `<style>` 218-242 | 8 classes (`flow-fire`, `flow-supply`, `flow-n2`, `flow-idle`, `vesda-live`, `spinning`, `det-chip`, `impeller`) used 0 times in any `js/conv/*.js` or `rz-hmi-sheet.js`; 1 `drop-shadow` glow (`flow-fire`) | 8 / 1 | remove (glow and decorative pulse are banned) |

Totals: FS-M-101 = 77 nodes (28 junctions, 49 symbols in 20 classes), 76 edges, 32 tagged nodes, 21 value slots, 7 point-bound values. Numeric operating values drawn on the sheet = 6 real (tank %, tank m3, duration min, PT-01 bar, FE-01 m3/h, FT-MU m3/h) + 1 literal (N2 2.4 bar). The HTML side panels add 12 `metric-row` lines and 3 pump cards. Registry: 11 `fire.*` rows in `data/conv-parameters.json`; 2 of them carry limits (`fire.level_pct` 80 / 60, `fire.static_pressure_bar` 10.5 / 8.5 low, 14 / 16 high). Parameter rows for zones, pumps, valves, agent, interlocks: 0.

### 2.2 Operating logic today

| Item | What the code does | Defect against the standard or against itself |
|---|---|---|
| Cross-zone confirmation | Stage 3 log says "CONFIRMED (2-zone)" (`startStagedScenario` 1335) | only zone 1 ever alarms; 4 zones are constant NORMAL; "2-zone" is a label, not logic (NFPA 72 cross-zoning, NFPA 2001) |
| Pre-action release | PAV-1 goes `open` at stage >= 3 by detection alone; head `sp1` operates at stage 5 on a timer; spec row says "released at Stage 5 (detection AND sprinkler fusing)" (1467) | the page says double interlock, the sim behaves like single interlock; no input represents a head fusing (NFPA 13) |
| N2 | sheet shows `ZONE 1 VENT` and the N2 line animates from stage >= 3 (`fireFlow` 1030); spec row says "Discharge at Stage 5 only" (1441); log at stage 5 says "Inert gas / pre-action released" (1368) | three statements, two behaviours; N2 supervisory gas is not a suppression agent |
| Abort | 30 s countdown in the 1 Hz timer (`armCountdown` 1355); strip text "ABORT available" | no abort control, no hold, no timer reset; the countdown number is not on the sheet (only a log line every 5 s) |
| Pump run state | `renderPumps` 833-847: `RUN` iff `press <= start` else `AUTO`; the sheet uses the same rule (`fireView` 896-901) | the pump stops by itself when pressure recovers. NFPA 20 pump runs until manually stopped; the modal text (`payloads.js:165`) says exactly that. Two statements, one is wrong |
| Pressure | `press = max(P_FP2_ON-1, P_STATIC-(stage-2)*1.6)` then -0.08 bar/s in countdown (1347, 1362) | literals 1.6 and 0.08 have no relation to a pump curve or a demand |
| Tank draw | `tankPct - 0.4` per second during the countdown, floor 58 (1360) | 0.4 %/s x 114 m3 = 27.4 m3/min; the engine demand `fire.pump_demand_lpm` is 2.5 m3/min, 11x lower. Water is drawn in stage 4, before any head or PAV has released. The floor 58 is below the page's own low-low 60 |
| Make-up | `8 + (80 - pct) * 0.6` m3/h (875) | 8 and 0.6 are untraceable literals; no refill-time relation |
| FE-01 flow | 227 m3/h when FP-01 runs, 18 when the jockey runs (`fireView` 901) | 227 is the FP-01 nameplate; the engine demand is 150 m3/h (2500 L/min). The meter prints capacity, not demand |
| Setpoints | `P_JOCKEY_ON 11.5`, `P_JOCKEY_OFF 12.8`, `P_FP1_ON 10.5`, `P_FP2_ON 9.5`, `P_LOW_ALM 8.5` (692-700) | 5 setpoints typed on the page; only `P_LOW_ALM` / `P_FP1_ON` were mirrored into the limits file; none is a registry row |
| Modal vs page | modal fire pump discharge pressure `S('...', 'bar', 9.8, 0.2)` (`payloads.js:161`) while the page header is 12.5 bar; modal tank alarm text "Low < 90 % / Low-low < 75 %" (168) while the registry limits are 80 / 60 | the modal contradicts the sheet at the same instant |
| VESDA modal | obscuration `S('Obscuration','%/m',0.004,0.002)` (186) | static; stays 0.004 %/m while the sheet says ACTION |
| Literals in rows | fuel 88 % (x2), "battery charger OK", "controller power healthy", last test `2026-05-12` (x2), 227 / 75 / 18 / 5.5, hold time 600 s, countdown 30 | 17 `authorityState(...)` calls wrapping typed strings; none comes from the engine or the sim |
| Fail-closed | `HAS_FIRE_AUTHORITY` gate on all of it | good; keep and extend (FD-26) |

### 2.3 What is already right (keep)

Fail-closed authority gate and its gate `tools/test-fire-system-runtime-authority.mjs` (ship-gate line 247). Command / feedback / mismatch separation on the 3 pumps (`firePumpCmd` / `firePumpFb`). Flow follows a measured point (`fe:q`, `ftmu:q`) through `RZConvTruth`. The reserve finding (114 m3 against 150 m3 required: shortfall 36 m3, duration 42 min at 92 %). First screen word budget (fire <= 145 outside the drawing, standard 23a) and the sheet text-clear gate.

## 3. Reference design (how a modern DC fire plant is built and sequenced)

| # | Subject | Design and sequence | Source |
|---|---|---|---|
| R1 | Detection | Halls: aspirating smoke detection (ASD) as early warning, spot smoke and heat detectors as the confirming layer; ASD gives four levels Alert / Action / Fire 1 / Fire 2 with transport time <= 120 s. Each hall is >= 1 zone; release needs cross-zone (two independent detections) | NFPA 72 Ch. 17; NFPA 75; NFPA 2001 |
| R2 | Signals | Three distinct signals: alarm, supervisory (valve tamper, low supervisory gas, pump running, low tank), trouble (open circuit, earth fault, battery). Annunciation keeps first-out; silence is not reset | NFPA 72 Ch. 10, 18 |
| R3 | Emergency control functions | On confirmed alarm the FACP commands HVAC shutdown / smoke damper closure, door-holder release, elevator recall, sounders and strobes, voice evacuation, BMS notification. Each output is supervised and its proof (end switch, status) returns to the FACP | NFPA 72 Ch. 21; NFPA 75 (HVAC); NFPA 80 (doors) |
| R4 | EPO | Manual, at the exits, guarded; it is not tied to the release sequence; the AHJ approves any automatic shunt | NFPA 70 Art. 645; NFPA 75 |
| R5 | Clean agent | Pre-discharge alarm and time delay; abort is dead-man (held) and does not cancel the alarm; manual release is single action and bypasses delay and cross-zone; discharge time <= 10 s halocarbon, <= 60 s inert gas; hold time >= 10 min; container supervision: refill or replace at > 5 % agent loss by weight or > 10 % pressure loss (temperature adjusted); enclosure tested (door-fan) for retention | NFPA 2001 Ch. 5, 7, 8 |
| R6 | Pre-action sprinkler | Dry pipe held under supervisory gas (N2 here). Interlock types: non-interlock, single (detection opens the valve), double (detection AND head operation open it). Double interlock is the DC norm: a detector fault alone cannot flood the hall. Valve has solenoid, supervisory pressure switch, flow switch, tamper switch; low supervisory pressure is a supervisory signal | NFPA 13 Ch. 7; NFPA 75; NFPA 72 |
| R7 | Fire pump set | Electric main + diesel main + jockey, pressure-sensing start: jockey at the highest band, FP-01 then FP-02 at lower bands with a sequential-start delay; a main pump runs until manually stopped at its controller; churn <= 140 % of rated head, >= 65 % of rated head at 150 % of rated flow; diesel: dual battery sets, <= 6 cranking cycles, fuel for the run duration; weekly (diesel) / monthly (electric) churn run | NFPA 20 Ch. 4, 10, 11; NFPA 25 |
| R8 | Water supply | Tank sized to hazard x duration; low and low-low level supervised; automatic refill within a stated time; duration = stored volume / demand | NFPA 13; NFPA 22; NFPA 25 |
| R9 | Door holders | Magnetic holders released by the FACP on alarm; release is proven by a status contact; a held-open door at alarm is a fault | NFPA 72 Ch. 21; NFPA 80 |
| R10 | Operator actions | ACK, SILENCE, RESET (blocked while any initiating device is still in alarm), ABORT (held), MANUAL RELEASE, EPO. The training sim exposes the same set, gated by the existing ARM step, never a write path to equipment | NFPA 72 Ch. 10; page rule `fire-system.html:1292` |

Chapter numbers are pointers for the implementer to confirm against the licensed text when each registry row cites its clause; no clause text is reproduced here.

## 4. Goals / non-goals

Goals
- G1 Detection: every zone and the VESDA show a number, a state and four ordered thresholds; cross-zone is real logic; first-out is shown.
- G2 Cause-and-effect: every effect row has commanded and proven state with a declared stroke time; effects reach the BMS event feed.
- G3 Water supply: pump curve, sequential start, run-until-stop, jockey cycling, diesel auxiliaries (or "not modelled"), tank draw tied to the engine demand.
- G4 Pre-action: double interlock with a head-fusing input; supervisory N2 per zone; solenoid / flow switch / tamper per valve; wet valves can alarm.
- G5 Clean agent: cylinders, discharge sequence, pre-discharge timer, abort, manual release, hold time, post-discharge lockout.
- G6 Physical animation only: impeller at speed, water dashes at flow ratio, tank level, cylinder weight, a pending-proof dash on a signal line.
- G7 Remove every contradiction measured in 2.2.

Non-goals
- No real FACP, no field bus, no write path to equipment. Everything stays SIMULATION behind the ARM gate.
- No hydraulic calculation of the sprinkler network (needs hazard class and layout, not supplied; stays "not modelled").
- No agent selection engineering: agent and coefficients are inputs with a source; the PRD does not pick a vendor.
- No change to the electrical or CRAH cockpits; this page only publishes events they may consume (PRD 02 owns the CRAH side).
- No flashing strobes, no sirens, no pulsing glow.

## 5. Parameter catalogue

Legend: ENG = existing engine key; ENG+ = new engine key (formula in section 8); SIM = page simulation function (`js/conv/fire-model.js`, section 6); NM = "not modelled" text. Where shown: S = sheet tag (lod in brackets), T = tooltip, M = equipment modal block, TR = trend (`rz-trend.js`). Colours only `--rz-pt-*`.

### 5.1 Detection and FACP

| Parameter | Unit | Source | Where | Limits (warn / alarm basis) |
|---|---|---|---|---|
| Zone state (per zone 1..5): NORMAL / ALERT / ACTION / FIRE 1 / FIRE 2 / IMPAIRED / ISOLATED | enum | SIM `zoneState(i)` | S (lod1), M | state colour; IMPAIRED = trouble |
| VESDA obscuration per zone | %/m | SIM `obscuration(i)` = baseline until the zone's scenario step, then the threshold of its level | S (lod2), M, TR | Alert / Action / Fire 1 / Fire 2 rows below |
| VESDA baseline | %/m | ENG+ `fire.vesda.baseline_pct_m` (ADOPTED, today the literal 0.004) | M | - |
| VESDA thresholds Alert, Action, Fire 1, Fire 2 | %/m | ENG+ `fire.vesda.alert_pct_m` (0.05, exists in modal text), `.action_pct_m`, `.fire1_pct_m` (0.20, exists), `.fire2_pct_m` | S (limit marks lod2), M | ordering law alert < action < fire1 < fire2; Action and Fire 2 are ASSUMED until commissioning data exists; the implementer seeds them from the detector data sheet default set and cites it |
| VESDA airflow | % of commissioned | SIM `airflow(i)` (100 unless scenario "pipe fault") | M | +-20 % -> trouble, zone IMPAIRED (ENG+ `fire.vesda.airflow_fault_pct`, from modal text) |
| Transport time (max) | s | ENG+ `fire.vesda.transport_max_s` = 120 (NFPA 72) | T, M | - |
| Spot smoke detector SD and heat detector HD state per zone | enum | SIM `detectors(i)` (normal / alarm / trouble / isolated; the symbol library already has these states) | M, sheet symbol state | alarm = FIRE 1 for that zone |
| Zones in alarm (count) | n | SIM `zonesInAlarm()` | S (lod1 near FACP), strip | >= 2 or MCP -> confirmed (cross-zone) |
| First-out zone | id | SIM `firstOut` (set once, cleared by RESET) | S (lod1), M | - |
| FACP signal counts alarm / supervisory / trouble | n | SIM, derived from every device condition (replaces the stage rule at `updateAlarmStrip` 1155-1175) | strip, M | - |
| FACP ACK / SILENCE / RESET state | enum | SIM `facpOps` | M | RESET refused while any initiating device is in alarm |
| FACP battery | V | NM (the modal's static 27.2 V `S()` is removed) | M | - |
| Disabled points | n | SIM, 0 unless scenario "isolate zone" | strip (`#as-disabled`) | any > 0 = supervisory |

### 5.2 Cause and effect with proof

One list-form matrix (rows = effects, columns = stage / event) replaces the 9-row list; each cell shows requested and proven.

| Effect (row) | Commanded when | Proven by | Proof delay | Source of the delay | Where |
|---|---|---|---|---|---|
| 1st-stage sounder / strobe | FIRE 1 or higher | SIM output status | 0 s (supervised circuit) | SIM | S, M |
| Voice evacuation | confirmed | SIM status | 0 s | SIM | M |
| AHU / CRAH stop (HVAC shutdown) | confirmed (NFPA 75), per hall | SIM `crahStopped(hall)` | fan run-down declared per class | ENG+ `fire.interlock.hvac_stop_s` ADOPTED | S (per hall), M; event to feed |
| Fire / smoke damper close | confirmed, per damper | SIM end switch | damper stroke (damper data sheet class value) | ENG+ `fire.interlock.damper_stroke_s` ADOPTED | S, M |
| Door holders release | confirmed | SIM holder status | 0 s (de-energise) | SIM | S, M |
| Lift recall | confirmed | NM (no lift model) | - | - | M "not modelled" |
| Access / egress release | confirmed | NM (no ACS model) | - | - | M "not modelled" |
| BMS / DCIM / historian | alert and higher | SIM event written to the `conv-alarm-events.js` feed | 0 s | SIM | M; alarm workspace |
| Suppression release (pre-action PAV solenoid) | double-interlock rule (5.4) | PAV open status + flow switch | valve open time declared | ENG+ `fire.pav.open_s` ADOPTED | S |
| Suppression release (clean agent) | pre-discharge timer = 0 (5.5) | cylinder pressure switch + weight drop | discharge time (10 s halocarbon) | ENG+ `fire.agent.discharge_s` | S |
| EPO | operator action only, never automatic | breaker status NM | - | - | S (station), M; row text "manual" kept |

A row whose proof is NM shows "not modelled" in the proven cell; no row shows a proven state it cannot derive. Total effect rows: 11.

### 5.3 Water supply (NFPA 20 / 22 / 25)

| Parameter | Unit | Source | Where | Limits |
|---|---|---|---|---|
| Header pressure PT-01 | bar | SIM `headerBar(Q, set)` from the pump curve (relation below) | S (lod1), TR | ENG limits `fire.static_pressure_bar` (10.5 / 8.5 low, 14 / 16 high) |
| FE-01 flow | m3/h | SIM = ENG+ `fire.pump.q_demand_m3h` while a zone has water flowing, else 0 | S (lod1), TR | pump rating |
| Per-pump discharge pressure | bar | SIM `curve(Q)` + suction bar | S (lod2), M, TR | churn <= 1.4 x rated, at 1.5 x rated flow >= 0.65 x rated head |
| Per-pump suction pressure | bar | NM unless a tank-height key exists (then SIM = static head of the level) | M | low suction < 0.7 bar (modal text) |
| Per-pump flow | m3/h | SIM: sharing at equal head, jockey rating | S (lod2), M | - |
| Per-pump controller mode | enum | SIM AUTO / MANUAL / OFF | S (lod1), M | OFF = supervisory |
| Per-pump run feedback and command | enum | SIM (exists: `firePumpCmd`, `firePumpFb`) | S | mismatch = alarm (exists) |
| Run-until-stop latch | bool | SIM: a started main pump stays RUN until operator STOP | S, M | replaces the pressure-follows-state rule |
| Start sequence | s | ENG+ `fire.pump.start_delay_s` (NFPA 20 sequential start interval, ASSUMED within the range the standard gives) | M | - |
| Starts per hour (jockey) | n/h | SIM counter | M, TR | > 2 per hour = leak supervisory (modal text, NFPA 25) |
| Run hours, starts total | h, n | SIM counters since scenario start (labelled "sim") | M | - |
| Last test / next due | date | NM (typed dates `2026-05-12` removed) | M | interval: diesel weekly 30 min, electric monthly 10 min (NFPA 25) |
| Diesel FP-02: battery A / B, fuel, crank attempts, rpm, coolant, oil | V, %, n, rpm, degC, bar | crank attempts SIM (<= 6, NFPA 20); the others NM (no engine in the model; fuel 88 % literal removed) | M | - |
| Pump rated flow / head / power | m3/h, m, kW | ENG+ `fire.pump.rated_flow_m3h` 227, `.rated_head_m` 120, `.fp1_kw` 75, `.jockey_m3h` 18, `.jockey_kw` 5.5 (migrated from page literals) | M, T | - |
| Pump setpoints | bar | ENG+ `fire.pump.jockey_start_bar` 11.5, `.jockey_stop_bar` 12.8, `.fp1_start_bar` 10.5, `.fp2_start_bar` 9.5, `.low_alarm_bar` 8.5 (migrated) | T, M, drawn on the PT-01 band | - |
| Tank level, volume, duration, required capacity, shortfall | %, m3, min | ENG (exist) | S, TR | limits 80 / 60 (registry) |
| Tank draw | m3/h | SIM = ENG+ `fire.pump.q_demand_m3h` while a head or PAV flows; 0 otherwise | S, TR | replaces the 0.4 %/s literal |
| Make-up flow | m3/h | ENG+ `fire.makeup_m3h` = (100 - level)/100 x capacity / refill_h | S | `fire.refill_h` (NFPA 22 refill time, ASSUMED) |
| Test header flow | m3/h | SIM during "churn / flow test" scenario | S | - |

Pump curve relation (declared, no data): H(Q) = H0 - a Q^2, H0 = churn_ratio x H_rated, `a` fixed so that H(Q_rated) = H_rated; `churn_ratio` = ENG+ `fire.pump.churn_ratio` (ASSUMED, the standard caps it at 1.4). FD-13 asserts the NFPA 20 envelope on the result. Two mains in parallel share Q at equal head. Header pressure = H(Q) in bar (pipe friction not modelled).

### 5.4 Pre-action and wet valves

| Parameter | Unit | Source | Where | Limits |
|---|---|---|---|---|
| Interlock type per zone | enum | ENG+ `fire.pav.interlock` = "double" for halls (page spec already says double) | M, T | - |
| Supervisory N2 pressure per PAV zone | bar | SIM: equals the supervisory value at rest; scenario "N2 leak" ramps down; "head fused" drops it | S (lod2), M, TR | low 1.7 / high 3.1 bar -> supervisory (ENG+ `fire.n2.low_bar`, `.high_bar` from modal text; `fire.n2.supervisory_bar` 2.4 migrated) |
| N2 purity | % | NM (modal `S()` 98.2 removed) | M | target >= 98 % stays a spec row |
| N2 generator run state | enum | SIM: runs to refill after a pressure drop below the low band | S, M | - |
| PAV state | open / closed / fault | SIM: opens only when `detection(cross-zone) AND headFused(zone)` (double interlock) | S | - |
| PAV solenoid | energised / not | SIM: energised at the detection half of the rule | M | circuit mA NM |
| PAV flow switch | flow / no flow | SIM: flow after PAV open and a head fused | S (lod2), M | flow = water-flow alarm |
| PAV tamper switch | normal / off-normal | SIM, scenario "close isolation valve" | M | off-normal = supervisory |
| Head fused (per zone) | bool | SIM input from scenario ("sprinkler head fuses in zone n") | S (head state `operated`) | - |
| WAV-01..03 state, flow switch, tamper | enum | SIM: wet zones alarm on flow (scenario "wet zone flow") | S, M | flow = alarm; tamper = supervisory |

### 5.5 Clean agent (NFPA 2001) — protected enclosures

Scope decision is open question Q1 (recommended default: Zone 5 Electrical, the room class NFPA 75 / 76 normally gives to gas; halls stay pre-action). All values below are per protected enclosure e.

| Parameter | Unit | Source | Where | Limits |
|---|---|---|---|---|
| Enclosure floor area, ceiling height | m2, m | ENG+ `fire.agent.<e>.floor_m2`, `.ceiling_m` (ASSUMED until surveyed; the 7,200 m3 rack proxy stays banned as volume, standard rule 19; if absent the whole block fails closed UNAVAILABLE) | T, M | - |
| Design concentration | % v/v | ENG+ `fire.agent.<e>.design_pct` (agent listing, ADOPTED with source) | T, M | - |
| Agent mass required | kg | ENG+ `fire.agent.<e>.mass_kg` = V / S x C / (100 - C), S = k1 + k2 T (NFPA 2001 flooding relation) | M | - |
| Cylinders N, fill each | n, kg | ENG+ `.cylinder_count` = ceil(mass / fill_kg); `.fill_kg` ADOPTED (cylinder size from the listing) | S (lod1 "N x"), M | - |
| Cylinder pressure per cylinder | bar | SIM: nominal pressure at 21 degC from the listing, scaled to enclosure temperature with the declared pad-gas relation P = P21 x T/294.15 K (approximation; the manufacturer table replaces it when entered) | S (lod2 bank), M, TR | -10 % temperature-adjusted -> trouble |
| Cylinder weight per cylinder | kg | SIM: fill until discharge; during discharge falls linearly over `discharge_s` to the residual (residual NM, shown "residual not modelled") | S (lod1 as % bar), M, TR | -5 % -> trouble (NFPA 2001 refill rule) |
| Cylinder state | enum | SIM: NORMAL / RELEASING / DISCHARGED / TROUBLE | S | - |
| Release valve / pilot solenoid | energised / not | SIM | M | - |
| Pressure switch (discharge proof) | on / off | SIM: on during discharge | M | - |
| Pre-discharge timer | s | SIM countdown from ENG+ `fire.predischarge_s` (30, today a page literal) | S (lod1 digits and a fill bar), M | - |
| Abort switch | enum NORMAL / HELD | SIM operator action (hold); while held the timer is paused at its value; releasing the switch resets the timer to the full delay (the page's declared rule, `payloads.js:204`) | S, M | HELD at timer 0 has no effect |
| Manual release | enum | SIM operator action: bypasses cross-zone, delay and abort | S, M | - |
| Discharge time | s | ENG+ `fire.agent.discharge_s` = 10 (halocarbon; 60 s for inert gas) | M | - |
| Hold timer | min | SIM countdown from ENG+ `fire.agent.hold_min` = 10 (today literal 600 s on the wrong object, the N2 generator) | S, M | - |
| Enclosure retention (door-fan test) | min | NM until a test value is entered; shown as "retention: not tested" | M | < hold_min = impairment |
| Pre-discharge sounder / strobe, "do not enter" lamp | enum | SIM | M | - |
| Lockout | bool | SIM: after discharge the release is locked until RESET and "cylinders replaced" (weight restored to fill) | S, M | - |

### 5.6 EPO and door holders

| Parameter | Unit | Source | Where | Limits |
|---|---|---|---|---|
| EPO station state | GUARDED / OPERATED | SIM operator action (armed sim only) | S (symbol `epo`), M | OPERATED = alarm, event to feed |
| EPO scope | list | ENG+ `fire.epo.scope` text list of feeders (hall IT feeders, CRAH) ADOPTED by owner / AHJ | M | - |
| Door holders (per hall) | HELD / RELEASED | SIM, proven by status | S (new symbol `doorHolder`), M | HELD at confirmed + 30 s -> fault |

## 6. Control logic to model

All steady-state and event-stepped; no PID, no random. The logic moves out of the inline script into one pure module `js/conv/fire-model.js` (`window.RZFireModel`, also `require`-able in node), so the browser page and the node gate run the same code. The module exposes `initial(engine)`, `step(state, input, dtSec)` and pure readers.

1. Zone machine (per zone). `NORMAL -> ALERT (obs >= alert) -> ACTION (>= action) -> FIRE 1 (>= fire1 or SD/HD alarm) -> FIRE 2 (>= fire2)`. Airflow outside +-20 % or pipe fault -> IMPAIRED (trouble, never shown NORMAL). An isolated zone is skipped by the cross-zone count and raises supervisory.
2. System stage from the zone set. Stage 1 = any ALERT; stage 2 = any ACTION or FIRE 1 (first detection; sounder); stage 3 = confirmed = (zones in FIRE 1 or higher >= 2) OR MCP operated OR a FIRE 2 in one zone with its SD/HD alarm; stage 4 = pre-discharge running; stage 5 = discharged; stage 6 = LOCKOUT (post-discharge, until RESET). Stage 6 becomes reachable; the 7th chip stops being dead.
3. Pump logic (NFPA 20). Pressure below jockey start -> JP-01 starts, stops at jockey stop. Pressure below FP-01 start -> FP-01 starts; after `start_delay_s` and pressure still below FP-02 start (or FP-01 fail-to-start 10 s) -> FP-02 cranks (<= 6 attempts) and runs. Once started a main pump is latched RUN until the operator presses STOP at the controller; `press <= start` is a start condition, never a run condition.
4. Pressure and flow. Q = `fire.pump.q_demand_m3h` when a head or PAV is flowing, 0 otherwise. Header pressure = curve(Q). Tank volume integrates `-Q` (and `+makeup`) with the scenario clock. No draw in stage 4 (no water flows before release).
5. Pre-action double interlock. PAV opens only when (zone confirmed by cross-zone) AND (head fused in that zone, i.e. N2 pressure falls below the low band). Detection alone energises the solenoid but the valve stays closed. A head fusing without detection raises N2-low supervisory and flow alarm only.
6. Clean-agent sequence. Confirmed -> pre-discharge alarm + timer (30 s). ABORT held pauses; releasing the switch resets the timer to the full delay. Manual release or timer 0 -> release solenoid -> discharge for `discharge_s` s: weight falls, pressure switch on, stage 5 -> hold timer (10 min) -> LOCKOUT until RESET. HVAC stop and dampers are commanded at confirmation, before release, and their proof must be present or the release is held at 0 s with a trouble (NFPA 2001 / NFPA 75 intent; declared as the page rule).
7. Effects. For each effect row of 5.2: `requested(t)` at the commanded event; `proven(t) = requested AND t - t_req >= delay`. Pending-proof = requested AND NOT proven.
8. Operator actions (sim, gated by ARM): ACK, SILENCE (sounder off, stage unchanged), RESET (refused while any device is in alarm, or while the hold timer runs), ABORT (held), MANUAL RELEASE, EPO, pump STOP at controller, MANUAL / AUTO per pump.
9. Scenario selector (replaces the single SIMULATE FIRE EVENT button; one `<select>` + RUN; words in the tooltip). Each scenario is a list of `{ t, input }` steps, deterministic:

| Scenario | Inputs | Expected end state |
|---|---|---|
| S1 VESDA alert only | zone 1 obs to Alert, then back | stage 1 then 0; supervisory logged; no release |
| S2 single zone, no confirm | zone 1 to FIRE 1 | stage 2 forever; no pre-discharge, no PAV, no damper close |
| S3 two zone cross-zoned, abort | zone 1 then zone 2; hold ABORT during the delay | timer paused; on release resets to 30 s |
| S4 manual release | MCP at zone 1 | stage 3 immediately; release without cross-zone |
| S5 pre-action double interlock | zone 1 + zone 2 confirmed, head fuses in zone 1 | PAV-1 opens, FE-01 = demand, tank draws at demand |
| S6 pump fail to start | S5 with FP-01 start refused | FP-02 cranks after the delay, mismatch alarm on FP-01 |
| S7 N2 leak | N2 pressure ramps below 1.7 bar | zone trouble / supervisory, N2-GEN runs, no release |
| S8 detector impairment | airflow outside +-20 % | zone IMPAIRED, trouble, not NORMAL |
| S9 clean-agent discharge | confirmed zone in an agent enclosure | pre-discharge 30 s, discharge 10 s, hold 10 min, LOCKOUT |
| S10 cylinder leak | one cylinder weight -6 % | trouble, release stays available |
| S11 low tank | tank to low band (existing seam `trip('tank')`) | existing low alarm; duration recomputed from the engine |
| S12 EPO | operator presses EPO | EPO alarm, event, no other effect |

## 7. Drawing and animation changes

Two sheets behind a two-button switch (text buttons, default FS-M-101): FS-M-101 WATER (kept: tank, pumps, header, valves, N2) and a new FS-M-102 DETECTION · RELEASE · EMERGENCY CONTROL (detection chain, five zones, clean agent, effects). The same `RZHmiSheet.render` renders both; a node of FS-M-102 may reference a pump or valve of FS-M-101 only by tag text.

| Symbol | Change | Value tags (sheet lod) | Animation rule | Phone (390 px) |
|---|---|---|---|---|
| Zone chip (5) | add SD, HD sub-states; per-zone VESDA obscuration | `st` (1), `obs` %/m (2) | none (state colour only) | lod1 shows state; obs appears on zoom |
| FACP | add first-out and counts | `st` (1), `fo` (1) | none | as chip |
| VESDA | add airflow and four-level bar (thin gauge, thresholds as ticks) | `st` (1), `obs`, `af` (2) | none (the dead `vesda-live` pulse is deleted) | - |
| Pump x3 | add speed relation (100 % while running, 0 else; rated rpm for the diesel), discharge pressure, flow, mode | `cmd`/`st` (1), `p`, `q` (2) | impeller spins at `rotorSeconds(speed %)` from `RZConvVfx.apply(..., speed: fn)`; today the page calls `RZConvVfx.bind`, which carries no speed, so 0 of 3 pumps rotate; spins only while feedback = running; still otherwise | pumps keep tag + state only |
| Header and branches (76 edges, 10 fire-main edges) | dash period from `dashSeconds(Q / Q_rated)` through `ratio(e)`; pre-action branch carries water only after PAV-n opens | - | dash period inversely proportional to flow ratio (clamped by `vfx.js` 0.2..3.0 m/s); no flow = no dash; reduced motion = still | - |
| PT-01 | draw the setpoint band as ticks: low alarm 8.5, FP-02 9.5, FP-01 10.5, jockey 11.5 / 12.8 | `p` (1) | none | ticks hide under lod2 |
| Tank | draw low and low-low marks (limits from registry); make-up valve glyph with stem = open / closed | `lvl` `vol` `dur` (1) | level fill (`RZHmiDepth`, exists) | - |
| PAV-1..5 | add solenoid, flow switch, tamper marks; state fault | `st` | stem position = open / closed (two positions) | state only |
| WAV-1..3 | live state (flow switch) | `st` | none | - |
| Sprinkler head (8) | each reacts to its zone's `headFused` | state `operated` | none | - |
| Agent cylinder bank (new, `agentCylinder`) | per enclosure, "N x" tag | `wt` weight % (1), `p` bar (2), `st` | fill bar height = weight %, falls during the 10 s discharge; nothing else moves | one value only |
| Nozzle (new, `nozzle`) | state normal / discharged | - | none | hidden at lod1 |
| Pre-discharge timer (new tag on RCP-01) | digits and a linear fill = remaining / total | `t` (1) | fill length shrinks with time; no pulse | digits only |
| Damper per hall, CRAH-stop tag, door holder (new symbols; `doorHolder` is a new library symbol with states held / released / fault) | commanded vs proven | `cmd` / `prf` (2) | blade position = open / closed; the signal edge from the FACP dashes only while pending-proof, stops on proof (finite, bounded by the stroke time) | tags hide, rows in the matrix |
| EPO station | symbol + guarded / operated | `st` (1) | none | - |
| Matrix (HTML) | list-form 5.2 table replaces `fire-interlock-list`; two cells per row (requested, proven) | - | cell colour on state change only | one column pair, wraps, no inner scroll box |
| Dead CSS | delete the 8 unused classes and the `drop-shadow` | - | - | - |

Alarm propagation is shown by state change in causal order (zone -> FACP -> outputs), each output turning when its `requested` becomes true and again when `proven` does; the only moving line is the pending-proof dash. Discharge is shown by the cylinder weight falling and the nozzle state; there is no cloud, no flash.

Words outside the drawing stay <= 145 on the first screen (standard 23a): the new matrix, scenario select and timers live inside or beside the sheet; thresholds, formulas and standards go in tooltips (`data-quiet`) and the modal.

Equipment modal: new classes `agentCylinder`, `nozzle`, `damperFire`, `epo`, `sounder`, `strobe`, `doorHolder` in `js/conv/payloads.js`; existing fire rows lose their static `S()` series and read the same `RZFireModel` state as the sheet (FD-28). Two rows of today's modal text are corrected (tank alarm 80 / 60, pump discharge from the curve).

## 8. Engine changes

`conv-engine.js` gets a `fire` block v2 and a minor bump (2.6.0 -> next minor in README order; engine first, one minor per phase of the family). Every ENG+ key is a registry row with `evidenceClass`, source and (if displayed with a bound) a limits row.

| Group | New keys | Relation | Source / class |
|---|---|---|---|
| Pump nameplate (5) | `fire.pump.rated_flow_m3h` 227, `.rated_head_m` 120, `.fp1_kw` 75, `.jockey_m3h` 18, `.jockey_kw` 5.5 | migrated page literals | nameplate, ADOPTED |
| Pump setpoints (5) | `fire.pump.jockey_start_bar` 11.5, `.jockey_stop_bar` 12.8, `.fp1_start_bar` 10.5, `.fp2_start_bar` 9.5, `.low_alarm_bar` 8.5 | migrated | NFPA 20 pressure-sensing start, ADOPTED |
| Pump model (3) | `fire.pump.churn_ratio`, `.start_delay_s`, `.q_demand_m3h` | `q_demand_m3h = pump_demand_lpm x 60 / 1000` (150); curve H = H0 - a Q^2 | NFPA 20 envelope (<= 1.4, >= 0.65 at 1.5 Q); ASSUMED / derived |
| Tank (2) | `fire.refill_h`, `fire.makeup_m3h` | `makeup = (100 - level_pct)/100 x reserve_capacity_m3 / refill_h` | NFPA 22 refill time, ASSUMED |
| VESDA (7) | `fire.vesda.baseline_pct_m`, `.alert_pct_m`, `.action_pct_m`, `.fire1_pct_m`, `.fire2_pct_m`, `.airflow_fault_pct`, `.transport_max_s` | thresholds ordered; transport <= 120 s | NFPA 72 Ch. 17; detector data sheet |
| N2 and PAV (4) | `fire.n2.supervisory_bar` 2.4, `.low_bar` 1.7, `.high_bar` 3.1, `fire.pav.interlock` | migrated from modal text; interlock enum | NFPA 13, ADOPTED |
| Release timing (4) | `fire.predischarge_s` 30, `fire.pav.open_s`, `fire.interlock.damper_stroke_s`, `.hvac_stop_s` | declared times | NFPA 2001 / 72, ADOPTED |
| Clean agent per enclosure (10) | `fire.agent.<e>.floor_m2`, `.ceiling_m`, `.design_pct`, `.k1`, `.k2`, `.fill_kg`, `.mass_kg`, `.cylinder_count`; plus `fire.agent.discharge_s` 10, `.hold_min` 10 | `mass_kg = V/S x C/(100 - C)`, `V = floor_m2 x ceiling_m`, `S = k1 + k2 T`, `N = ceil(mass / fill_kg)` | NFPA 2001 flooding relation; k1, k2 and C come from the agent listing / NFPA 2001 annex table, transcribed by the implementer with the table cited in the row (the PRD does not type them from memory) |
| EPO (1) | `fire.epo.scope` | text list | owner / AHJ, ADOPTED |

New `fire.*` registry rows: 5 + 5 + 3 + 2 + 7 + 4 + 4 + 10 + 1 = 41 (per-enclosure keys counted once, for one enclosure; each further enclosure adds 8). The registry generator is re-run; `tools/test-conv-parameter-registry.mjs` and `test-conv-point-coverage.mjs` stay green. `test-conv-engine-version-pins.mjs` and the `?v=` on every cockpit script tag move with the bump.

## 9. Laws table

Proof files: N = `tools/test-fire-depth.mjs` (node, loads engine + `fire-model.js` + `fire-sheet.js`, no browser); B = `tools/test-fire-depth-browser.mjs` (puppeteer, headless, rz-lane, at 390 and 1440 px). Both join `tools/ship-gate.sh` and `tools/run-conv-release-gates.sh` (README rule C7). "Red today" = what the proof prints on the current tree.

| ID | Claim | Proof (asserts) | Red today? |
|---|---|---|---|
| FD-1 | Tank draw equals the engine demand, and only while water flows | N `tank-draw`: 60 s of S5 flow lowers stored volume by `pump_demand_lpm x 60 / 1000` m3 +-1 %; the stage-4 countdown lowers it by 0 | RED: draw 27.4 m3/min vs 2.5 (11x); draw occurs in stage 4 |
| FD-2 | FE-01 prints demand, not nameplate | N `fe01-demand`: FE-01 = 150 m3/h in S5; <= rated | RED: prints 227 |
| FD-3 | No setpoint literal on the page; thresholds agree everywhere | B `no-literals`: the inline script has 0 of 11.5 / 12.8 / 10.5 / 9.5 / 8.5; N `modal-vs-registry`: modal alarm texts equal registry limits | RED: 5 literals; modal says 90 / 75 vs 80 / 60 |
| FD-4 | Chips equal reachable stages | N `stages`: set of stages reached by S1..S12 = set of `data-stage` chips (0..6) | RED: 7 chips, stage 6 unreachable |
| FD-5 | Every zone carries a number, a state and 4 ordered thresholds | N `zone-numbers`: 5 zones, each `obscuration` finite, `alert < action < fire1 < fire2` | RED: 0 numbers |
| FD-6 | Cross-zone is logic | N `cross-zone`: S2 never exceeds stage 2 and never starts a timer; S3 reaches stage 3 only with 2 zones; MCP reaches stage 3 with 1 | RED: 1 zone reaches stage 4 |
| FD-7 | First-out is stable | N `first-out`: zone 2 alarms after zone 1 -> `firstOut = 1`; RESET clears | RED: no field |
| FD-8 | Detector impairment is never NORMAL | N `impaired`: S8 zone state IMPAIRED and trouble count >= 1 | RED: no such state |
| FD-9 | Every effect row has requested and proven | N `effects`: each of the 11 rows has `requested` and `proven` (or the literal "not modelled" for lift and access only); `proven` false until the delay elapsed | RED: 0 of 9 |
| FD-10 | Effects reach the BMS feed | N `events`: S3 adds >= 1 event per commanded effect to the `conv-alarm-events` feed with source `fire` | RED: row says "SIMULATED EVENT ONLY", 0 events |
| FD-11 | EPO is never automatic | N `epo-manual`: across S1..S12 `epoRequested` is false unless the operator action runs | GREEN today (guard); mutation M7 turns it red |
| FD-12 | A main pump runs until stopped | N `run-until-stop`: S5 with pressure restored above start -> FP-01 still RUN; STOP -> stops | RED: pump returns to AUTO when pressure recovers |
| FD-13 | Pump curve inside the NFPA 20 envelope | N `curve`: H(0) <= 1.4 H_rated; H(1.5 Q_rated) >= 0.65 H_rated; H(Q_rated) = H_rated | RED: no curve |
| FD-14 | Pump values come from the model, not strings | B `pump-values`: no `88%`, `2026-05-12`, `battery charger OK` literal in page or modal; diesel rows NM | RED: 2 + 2 + 1 literals |
| FD-15 | Jockey cycling is counted | N `jockey-count`: a leak scenario of 3 starts in 1 h raises the supervisory rule | RED: no counter |
| FD-16 | N2 pressure is simulated and bounded | N `n2`: S7 pressure < 1.7 bar -> supervisory; idle value equals `fire.n2.supervisory_bar` | RED: literal 2.4 bar |
| FD-17 | Double interlock | N `double-interlock`: detection without a fused head leaves PAV closed; a fused head without detection leaves it closed; both opens it | RED: PAV-1 opens on detection alone |
| FD-18 | Wet zones can alarm | N `wet-flow`: scenario "wet zone flow" sets the WAV flow switch and alarm | RED: `closed` always |
| FD-19 | Agent mass and cylinders follow the relation | N `agent-mass`: for the registry inputs, `mass_kg = V/S x C/(100-C)` to 0.1 %, `N = ceil(mass/fill)`; missing geometry -> UNAVAILABLE | RED: 0 cylinders |
| FD-20 | Pre-discharge, abort, hold | N `discharge-seq`: S9 timer 30 s; ABORT held pauses; release resets to 30 s; discharge 10 s; hold 10 min; then LOCKOUT; RESET refused during hold | RED: no abort handler (0), no timer on the sheet |
| FD-21 | Manual release overrides abort and cross-zone | N `manual-release`: S4 with ABORT held still discharges after the manual action | RED: no manual path |
| FD-22 | Cylinder supervision | N `cylinder-trouble`: S10 -6 % weight -> trouble; -4 % -> none | RED: no cylinders |
| FD-23 | Physical animation only, proportional | B `motion`: at flow ratios 1.0 and 0.5 the main-edge dash periods differ by 2x (+-10 %); 3 pump rotors turn only on feedback RUN (animation-duration = `rotorSeconds(100)` = 1.0 s); the signal dash animates only while pending-proof; with `prefers-reduced-motion` the running-animation count is 0 and every value text is unchanged | RED: 0 of 3 pump rotors; edge dash not ratio-driven |
| FD-24 | No glow, no dead motion CSS | B `css-clean`: 0 `drop-shadow` and 0 of the 8 dead classes in the page style | RED: 1 and 8 |
| FD-25 | Layout and word budget | B `layout`: at 390 and 1440 px no horizontal page scroll; existing `test-conv-sheet-text-clear` passes on FS-M-101 and FS-M-102; `test-conv-declutter` fire <= 145 words | GREEN on FS-M-101 today; RED on FS-M-102 (does not exist) |
| FD-26 | Fail-closed covers every new tag | extend `tools/test-fire-system-runtime-authority.mjs`: with authority absent every new value, cylinder, timer and matrix cell reads UNAVAILABLE and no `NORMAL` / `HELD` / `CHARGED` survives | RED for the new tags (they do not exist yet; the 13 fail-closed paths rise to 13 + n) |
| FD-27 | Every shown number has a registry row | N `registry`: each `data-point` / sheet `point` id in the fire sheets resolves to a `fire.*` row with evidenceClass and source | RED: 7 bound points, 1 literal (N2) |
| FD-28 | Modal equals sheet at every stage | N `modal-parity`: for pump discharge pressure, tank level, VESDA obscuration, N2 pressure, modal value = sheet value at stages 0..6 | RED: 9.8 vs 12.5 bar; 0.004 vs ACTION |

Mutations that must turn red (run once, reverted, quoted in the release note):
- M1 restore `tankPct - 0.4` per second -> FD-1 red.
- M2 let stage 3 trigger with one zone -> FD-6 red.
- M3 let PAV open on detection alone -> FD-17 red.
- M4 derive pump RUN from `press <= start` -> FD-12 red.
- M5 delete the abort hold branch -> FD-20 red.
- M6 set `alert_pct_m` above `action_pct_m` -> FD-5 red.
- M7 make stage >= 3 request EPO -> FD-11 red.
- M8 change one cylinder fill so `N` changes without the formula -> FD-19 red.
- M9 give the main edges a fixed dash period -> FD-23 red.
- M10 hardcode `2.4 bar` back into the sheet -> FD-16 / FD-27 red.

## 10. Phases (each shippable alone, about one release)

| Phase | Content | Laws it closes | Depends on |
|---|---|---|---|
| F0 truth | extract `fire-model.js` (behaviour-preserving first, test green before and after), then remove the measured contradictions: tank draw tied to demand, FE-01 demand, run-until-stop, stage 6 reachable or dropped, one N2 statement, modal corrections, dead CSS, typed literals to registry rows (pump setpoints and nameplate, N2 limits) | FD-1 FD-2 FD-3 FD-4 FD-12 FD-14 FD-16 FD-24 FD-27 FD-28 | engine minor (pump + N2 + tank keys) |
| F1 detection | per-zone VESDA / SD / HD, thresholds, cross-zone, first-out, impairment, FACP counts, scenarios S1-S4 S8 | FD-5 FD-6 FD-7 FD-8 | F0 |
| F2 emergency control | matrix with requested / proven, damper / CRAH / door-holder / EPO symbols on new FS-M-102, events to the feed | FD-9 FD-10 FD-11 FD-25 (FS-M-102) | F1 |
| F3 water supply | pump curve, sequential start, diesel crank, jockey counter, speed and rotor animation, flow-ratio dashes, test header | FD-13 FD-15 FD-23 | F0 |
| F4 pre-action | double interlock, head fusing, supervisory N2 per zone, solenoid / flow / tamper, wet-valve alarms | FD-17 FD-18 | F1 F3 |
| F5 clean agent | enclosures, cylinders, release sequence, abort, manual, hold, lockout, supervision (needs Q1) | FD-19 FD-20 FD-21 FD-22 | F2 and Q1 |
| F6 close | modal classes for the new symbols, fail-closed extension, phone pass, ship-gate wiring and standard text (standard lines 124-140 and the ratchet) | FD-26 FD-25 | all |

Risks
- Scope of the agent block depends on Q1; if the owner keeps water-only protection, F5 shrinks to a "not protected by gas" statement and FD-19..22 are dropped, not weakened.
- Agent coefficients and the Action / Fire 2 thresholds are not in the repository; typing them from memory would be an invented number (owner rule). Each is a registry row with its cited source added at implementation; until then the dependent value reads "not set".
- FS-M-102 adds nodes; the text-clear and declutter gates (standard 23a, 26) can fail on the first draft. Mitigation: lod1 carries state only, every number is lod2 or the modal.
- Moving the inline machine to `fire-model.js` touches `RZFireOperator` and the test seam `stageForTest`; keep their signatures.
- Gate flake under concurrent sessions (render gates under rz-lane): run each browser law three times and quote the red-before-green output.
- Cross-page effect (CRAH stop acting on the datahall cockpit) is only an event here; the consumer is PRD 02.

Open questions for the owner (taste / scope only)
- Q1 Clean agent scope: add gas protection for Zone 5 Electrical (recommended: NFPA 75 / 76 normally gives electrical and UPS rooms gas; the halls stay on pre-action water), keep Zone 5 on water only, or protect the halls with gas as well?
- Q2 Two sheets or one: add FS-M-102 behind a text switch (recommended, keeps FS-M-101 at today's density) or add everything to FS-M-101 and rely on zoom levels.
- Q3 Training controls: expose ACK, SILENCE, RESET, ABORT, MANUAL RELEASE, EPO as buttons behind the existing ARM step (recommended) or keep the single scenario selector and run the operator actions only inside scenarios.
