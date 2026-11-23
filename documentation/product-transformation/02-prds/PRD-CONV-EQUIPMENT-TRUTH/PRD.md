# PRD-CONV-EQUIPMENT-TRUTH — what is inside the equipment, how many there are, and one cockpit language

Status: **APPROVED TO EXECUTE 2026-11-18 — the owner asked for the PRD and its execution in one message ("rancang detail
super comprehensive prd dan eksekusi"). Defaults of §13 stand unless he overrides them.**
Scope: the 9 DC Conventional pages (`dc-conventional`, `datahall`, `chiller-plant`, `water-system`, `fire-system`,
`fuel-system`, `ict`, `EPMS_Telemetry`, `cdu-mini-bms`). `datahallAI.html` and `js/datahall-ai/*` are out of scope.
Continues `PRD-CONV-LIVING-PLANT` (P0–P6 partly shipped, v3.66.0 … v3.74.0). Where the two disagree, this one wins.

---

## 0. The owner's comments this PRD answers (2026-11-18, wording kept)

| id | comment | answered in |
|---|---|---|
| T1 | "kok ini modal saat click itu drawing hmi itu harus dalamnya, misal chiller ya harus terlihat condensor-evaporator-compressor-exv-economizer dll. harus semua block equipment bisa terlihat" | §4, §5 |
| T2 | "cek semuanya bukan hanya yang chiller" | §5 (every class), §9 (coverage gate) |
| T3 | "disitu kok aneh crah-a masak cuma satu di p&id, harus bener2 accurate qty dan parameter2 operation" | §3, §6 |
| T4 | "coba analisa semua uiux, improve more improve better terkait designnya, engineering juga" | §7, §8 |
| T5 | "rancang detail super comprehensive prd dan eksekusi" | this document, §11 |

---

## 1. Where the pages are today (measured)

| fact | evidence |
|---|---|
| The equipment modal's "Drawing" is a clone of the one symbol that was clicked. Nothing inside the equipment is drawn. | `js/conv/equipment-modal.js:86-107` (`mimic(sym)` clones the sheet's `.hmi-node`) |
| The chiller P&ID draws 4 chillers; the engine has 10 installed, 7 running. | `js/conv/chiller-sheet.js` tags `CH-01…CH-04`; `snapshot.cooling.chillers_total = 10`, `chillers_running = 7` |
| The chiller P&ID draws one cooling coil per hall, tagged `CRAH-A…CRAH-D`, with no count. The engine has 59 installed and 58 running per hall. | same sheet, 4 × `coolingCoil`; `cooling.crah_installed = 59`, `crah_running = 58` |
| The condenser-water loop and the cooling towers are not on the chiller sheet (`CDWS` / `CDWR` leave the sheet). The water sheet draws one tower cell. Tower and condenser-pump counts are not in the engine. | `chiller-sheet.js` `offSheet` nodes; `water-sheet.js` `CT-501`; no `tower_count` key |
| The fuel sheet and the EPMS LV view draw 3 generating sets; the engine derives 32 (8 per hall, N+1). | `fuel-sheet.js` `GEN-A/B/C`; `electrical.genset_count = 32` |
| Pump fleets are drawn (2 secondary, 2 per chiller train) but no pump count, head, flow or motor rating is an engine parameter. | registry: no `cooling.*pump*` key |
| The engine holds no refrigeration-cycle quantity (evaporator / condenser saturation, lift, superheat, subcooling), no pump curve, no tower approach. | `data/conv-parameters.json`, 215 ids |
| Internal drawings exist nowhere on the 9 pages. | `ls js/conv/` — no `internals/` |

The UI/UX audit of the 9 pages (screenshots at 1440 and 390, every equipment class clicked) is `§7`; its evidence
files are `~/.cache/qa-tmp/audit-ux/inventory.md` and `findings.md`.

---

## 2. Product goal

1. **Open any equipment and see how it works inside**: its real internal blocks, the medium flowing between them,
   and the operating values at each block — drawn as an HMI, to the same symbol standard as the plant sheet.
2. **Every count on a drawing is the engine's count.** A sheet either draws every unit, or draws one typical unit and
   says "× N" with N from the engine and a way to step through the N units.
3. **Operating parameters are physically consistent**: per-unit load, flow, temperature and power add up to the plant
   values the page already shows (energy balance and mass balance as gated laws).
4. **One cockpit language** across the 9 pages: the same header, status strip, legend, inspector, modal, type scale
   and control sizes.

Non-goals: a vendor-accurate machine model; a relay study; real telemetry. Everything stays a declared simulation
bound to the engine.

---

## 3. Principles (each is a law a gate can check)

- **P-1 Inside is a drawing, not a photo of the outside.** A modal never shows only the symbol it was opened from.
- **P-2 Every internal block is a real part of that machine class** (named in the class catalogue §5 with its
  standard), is clickable, and has at least one of: a state, a value, or "not modelled" with the reason.
- **P-3 No value without a source.** A value in an internal drawing is an engine parameter, a value derived from
  engine parameters by a formula written in the registry, or it is not shown. Vendor-style numbers are never typed in.
- **P-4 Balance.** Inside a machine: heat in = heat out ± 1 % (chiller: evaporator duty + compressor power =
  condenser duty), flow in = flow out, and the sum over the N units = the plant value on the page.
- **P-5 Quantity truth.** Count on the drawing = engine count, or "typical × N". Running / standby / maintenance
  split = engine split. Tags are numbered 01…N.
- **P-6 Same state grammar** as the plant sheets (`RZConvVfx`): colour + pattern, motion only where something flows,
  reduced motion honoured.
- **P-7 One modal.** Internals live in the one equipment modal (`RZConvModal`), not in per-page pop-ups.
- **P-8 Readable.** No text under 11 px; internal drawings pass the same text-clear and geometry gates as sheets.

---

## 4. The equipment modal, version 2

Layout (1440): header (tag, class, state chip, unit navigator `◂ 03 of 10 ▸`, close) · left 62 %: **Internal
drawing** (governed mini-sheet, pan/zoom, view-mode bar State / Thermal / Flat, legend) · right 38 %: **Block
detail** for the selected internal block (values with unit and basis, alarms of that block, "what this part does" in
two lines) · below, tabs: Readings · Trend · Design basis · Alarms · Maintenance · Dependencies.
Layout (390): drawing on top in its own horizontal scroller (min-width 640), block detail as a bottom sheet, tabs
below.

Behaviour:
- Opens on double-click, Enter on a focused symbol then "Open equipment HMI", or the inspector button.
- **Unit navigator** steps through the N units of the fleet (P-5); the drawing and every value re-bind to that unit.
- **Fleet strip** above the drawing: one cell per unit (state colour + pattern, load %), click selects.
- Clicking an internal block selects it (inspector-in-modal); double-click on a block that is itself a machine
  (e.g. the chiller's oil pump, the UPS battery string) drills one level down; a breadcrumb returns.
- A number is clickable → trend (existing `RZTrend`), with the same-quantity pens of sibling units offered first.
- Escape closes one level; focus returns to the opener; the modal never contains the sheet it came from (gate
  `test-conv-modal-no-self-repeat.mjs`).

Modules: `js/conv/internals/<class>.js` (geometry + block catalogue, one file per class), `js/conv/internals.js`
(registry + `model(class, unitState)` pure functions, Node-tested), `js/conv/equipment-modal.js` v2 (shell),
drawn by the existing `RZHmiSheet` and coloured by `RZConvVfx`. Symbols come from `js/rz-eng-symbols.js`; missing
ones are added to the library (`tools/hmi-symbol-defs.py`), never drawn ad hoc.

---

## 5. Internal drawings — class catalogue (T1, T2)

Each row is one deliverable: the blocks that must be visible, what flows between them, the values shown, and where
each value comes from (E = existing engine parameter, N = new engine parameter of §6, — = stated as not modelled).

### 5.1 Cooling plant

| class | internal blocks (all clickable) | media / paths | values at the blocks |
|---|---|---|---|
| **Water-cooled centrifugal chiller** | evaporator (flooded shell-and-tube), compressor (centrifugal, inlet guide vanes), VFD + motor, condenser (shell-and-tube), economiser / flash tank, expansion device (EXV or orifice), oil sump + oil pump + oil cooler, purge unit, hot-gas bypass valve, control panel; CHW in/out nozzles, CDW in/out nozzles, refrigerant relief | refrigerant: low-pressure vapour evaporator → compressor; high-pressure vapour → condenser; liquid → economiser → EXV → evaporator; flash gas economiser → compressor interstage; chilled water through the evaporator tubes; condenser water through the condenser tubes; oil loop | CHW in / out °C and flow (E, per unit N); CDW in / out °C and flow (E supply/range, N flow); evaporator duty kWth (N per unit, sums to E); compressor input kW (E per machine), load % (E), speed % (N); condenser duty (N = evap + power, P-4); evaporator and condenser saturation temperature and pressure, lift, COP (N, refrigeration model §6.2); superheat, subcooling, oil pressure, IGV position (— unless §6.2 derives them) |
| **Chilled-water / condenser-water pump set** | suction isolation valve, strainer, flexible connectors, pump casing + impeller, mechanical seal, bearing housing (DE / NDE), coupling, motor, VFD, discharge check valve, discharge isolation valve, PT suction / discharge, vibration and bearing-temperature points | water suction → discharge | flow, head (ΔP), speed %, motor kW, efficiency, duty point on the pump curve (N, §6.3); NPSH margin (N); bearing temperature, vibration (—) |
| **Cooling tower cell** (induced-draft counter-flow) | fan + gearbox / direct drive + motor + VFD, drift eliminators, hot-water distribution / spray nozzles, fill, air inlet louvres, cold-water basin, make-up valve + float, blowdown valve + conductivity controller, basin heater, vibration switch | hot condenser water in at the top → fill → basin → out; air in through the louvres, up through the fill, out at the fan; make-up in; blowdown out | water in / out °C, range, approach to wet-bulb, flow, heat rejected (N §6.4, sums to E `tower_rejection_kw_th`); fan speed % (N); make-up, evaporation, drift, blowdown L/min (E on the water page: cycles of concentration, drift fraction); basin level (—) |
| **CRAH unit** | return-air filter bank, cooling coil, 2-way control valve + actuator, EC fan wall, condensate pan + pump, supply and return air temperature / humidity sensors, leak detector, controller | return air → filter → coil → fans → supply air; chilled water in → valve → coil → out | supply / return air °C (E), airflow (E per row), sensible duty kW (E `crah_unit_sensible_kw`), fan % and valve % (page state today → engine N), CHW in / out °C (E), filter ΔP (—) |
| **Plate / shell-and-tube heat exchanger** | primary and secondary nozzles, plate pack or tube bundle, isolation valves, temperature points on four ports | two counter-flowing streams | four temperatures, duty, approach, effectiveness (N where the streams are engine values) |
| **Expansion tank, buffer tank, storage tank** | shell, bladder / air cushion or vent, level instrument, fill and drain, relief valve, manway | — | level, volume, pressure (E where present) |
| **Control / isolation valve** | body, trim, actuator, positioner, position feedback, hand-wheel / manual override | — | command %, feedback %, mismatch, Cv / ΔP (—) |
| **Field instrument (TT, PT, FT, LT)** | process connection, sensing element, transmitter, 4–20 mA / fieldbus loop, PLC / BMS input card, HMI tag | signal path sensor → card → tag | process value with unit, range, alarm limits (E), signal quality |

### 5.2 Electrical

| class | internal blocks | values |
|---|---|---|
| **Power transformer 150/20 kV** | HV and LV bushings, core, HV / LV windings, on-load tap changer, conservator + breather, Buchholz relay, pressure-relief device, oil and winding temperature indicators, radiators + fans (ONAN / ONAF), neutral bushing → NGR | rating, impedance, tap position (N), load %, HV / LV current (E via solver), oil / winding temperature (N thermal model or —), losses (N) |
| **GIS bay / MV circuit breaker** | busbar disconnector(s), breaker interrupter (SF₆ or vacuum), operating mechanism (spring charge), earthing switch, CT, VT, cable compartment, gas compartments with density monitor, bay control unit + relay | state of each device, interlock conditions (E-S-101 simulation), operation counter (—), gas density (—) |
| **Distribution transformer 20/0.4 kV** | HV fuses or breaker, windings, tap links, temperature relay, LV terminals | rating, impedance, load %, LV current (E) |
| **UPS system** | input breaker, rectifier / charger, DC bus, battery breaker + strings, inverter, static bypass switch, maintenance bypass, output breaker, control | mode (double conversion / bypass / battery), input / output kW, load %, efficiency (E), DC bus V, battery state of charge and autonomy (N), per-module state (E module count) |
| **Diesel generating set** | engine (cylinders, turbochargers), governor / ECU, alternator, AVR, radiator + fan, jacket-water heater, starter batteries + charger, air intake filter, exhaust + silencer, day tank + fuel lines, generator breaker, synchroniser | kW, kVA, pf, frequency, rpm, load % of rating (E fleet rule), fuel rate L/h (E), coolant / oil temperature and pressure (—), start-battery V (—) |
| **Floor PDU (class `pdu`, E18, v3.100.0)** — `internals/transformer.js` kind `pdu` | input breaker, isolation transformer (windings + core), temperature relay 26/49, natural-air cooling, secondary star point to N-PE, output breaker | rating `pdu_kva_rated`, PDUs per stream, racks per PDU, pf, usable kW, continuous loading limit, design and one-stream-out loading (E, conv-engine 2.9.0); load % and kW of one unit (S); impedance, currents, fault level, losses, output voltage: not modelled — the distribution-transformer keys never stand in |
| **LV switchboard / PDU / RPP** | incomer, bus sections, tie, outgoing feeders, metering, surge protection | per feeder kW and A from the solver |

### 5.3 Fire, fuel, water, network

| class | internal blocks | values |
|---|---|---|
| **Fire pump set** (electric / diesel, NFPA 20) | suction OS&Y valve, pump, driver (motor or engine), controller, relief valve, discharge check and OS&Y valve, test header + flow meter, pressure-sensing line, jockey pump + controller | pressure, flow, duty point on the NFPA 20 curve (shut-off ≤ 140 %, 150 % flow at ≥ 65 % of rated head — N), start pressure settings (E) |
| **Pre-action valve trim** | supply control valve, deluge / pre-action valve, solenoid release, priming line, supervisory air or N₂ line + low-air switch, alarm line + pressure switch + water-motor gong, main drain, inspector's test | state of each element per the stage machine (E), supervisory pressure |
| **Wet alarm valve** | clapper, retard chamber, alarm line, pressure switch, trim gauges, main drain | flow / alarm state |
| **Nitrogen generator, FACP, release panel, aspirating detector** | cabinet, membrane + receiver; loops / zones / outputs; detector chamber + sampling pipes | states (E) |
| **Fuel storage tank, day tank, polisher, transfer pump** | double-wall shell + interstitial sensor, fill, vent, suction, return, level gauge, overfill valve; day-tank solenoid, level switches, overflow return, bund + leak sensor; pre-filter, coalescer, final filter, pump | level, volume, usable volume, autonomy (E), transfer flow (E) |
| **Water treatment** (filter, UV, dosing, softener) | vessel / chamber, media or lamp, valves, instrument points | flow, ΔP, dose (E where present) |
| **Network device** | shipped in v3.72.0 as `RZNetModal` (zones, policy, ports, protocol). Gains the same shell as §4 in phase E6. | — |

Coverage law (T2): the set of equipment classes found on the 9 pages by the audit inventory = the set of classes
with an internal drawing or a written exemption (a junction, an off-sheet connector, a piece of pipe).

---

## 6. Quantity and operating-parameter truth (T3)

### 6.1 Sheet counts versus engine counts — to be closed

| sheet | drawn today | engine | target |
|---|---|---|---|
| CH-M-101 chillers | 4 | 10 installed, 7 running (N+1) | all 10 trains, tagged CH-01…CH-10, 7 running, 3 standby per the engine split |
| CH-M-101 primary pumps | 2 per train (8) | not in the engine | per train from the new fleet rule (§6.3) |
| CH-M-101 secondary pumps | 2 | not in the engine | from the fleet rule; N+1 |
| CH-M-101 CRAH | 1 coil per hall, no count | 59 installed, 58 running per hall; 236 / 232 site | one typical coil bank per hall labelled "× 59 · 58 run" from the engine, hall selector steps the halls, and the bank opens the CRAH fleet strip of that hall |
| condenser loop + towers | absent | rejection 36,403 kWth; no tower count | new sheet CH-M-102 "Condenser water and cooling towers": tower cells and condenser pumps from the fleet rule |
| FU-M-101 gensets and day tanks | 3 | 32 (8 per hall, N+1) | per-hall view: 8 sets + day tanks drawn, hall selector; site total stated |
| EPMS LV view | 3 gensets, 20 kV utility | 32 sets, 150 kV supply | LV distribution redrawn as governed sheet E-S-102 (typical hall stream, × N from the engine) |
| FS-M-101 zones | 5 | `fire.zone_count` 5 | keep; assert by gate |
| datahall | 25 rows × 20 racks, 59 CRAH | 500 racks, 59 CRAH | keep; assert by gate |

### 6.2 New engine family: refrigeration cycle per chiller (engine 2.4.0)

Derived, never typed: evaporator saturation = leaving CHW − evaporator approach; condenser saturation = leaving CDW
+ condenser approach (both approaches ASSUMED design values with the AHRI 550/590 rating context as the stated
basis); saturation pressures from a published refrigerant property correlation for the selected refrigerant
(R-134a or R-1233zd, an owner decision, §13) with its source; lift = condenser − evaporator saturation; Carnot COP
and cycle efficiency against the engine's existing specific power (the two must reconcile: COP = duty / input
within tolerance, P-4); condenser duty = evaporator duty + input power; CDW flow = condenser duty / (ρ·cp·range).
Superheat, subcooling, IGV position and oil pressure are shown only if the model derives them; otherwise the block
says "not modelled".

### 6.3 New engine family: hydronic fleet

Per-chiller duty and CHW flow (plant flow ÷ running units), primary pump per train (duty + standby), secondary and
condenser pump counts from flow ÷ a declared unit flow with N+1, pump head from a declared system curve, shaft and
motor power from flow × head ÷ efficiency, speed from the affinity laws. Laws: Σ unit flow = plant flow; pump power
is inside the engine's existing non-IT (mechanical) load.

### 6.4 New engine family: heat rejection

Tower cell count from rejection ÷ a declared cell capacity with N+1, range from the engine (`cdw_range_k`),
approach from a declared design wet-bulb (the PRD-CONV engine already flags the wet-bulb basis as ASSUMED), fan
speed from load by the cube law, evaporation / drift / blowdown from the existing water-balance parameters.
Law: Σ cell rejection = `tower_rejection_kw_th`.

### 6.5 Per-unit operating states

One deterministic unit-state table per fleet (which units run, lead/lag order, load share) published by the engine
so every page, sheet, fleet strip and modal reads the same split. No page decides on its own which unit runs.

---

## 7. UI/UX and engineering-design audit (T4)

The audit is run on the live tree with screenshots at 1440 and 390 of all 9 pages, every inspector and modal. Its
ranked findings are copied here when it returns (file `findings.md`); each accepted finding becomes a work item of
phase E6 with its gate. The audit judges against: this site's register and rejected patterns (`CLAUDE.md`),
ISA-101 (muted normal, colour for abnormal, overview → unit → equipment → diagnostics), ISA-5.1 / ISO 10628-2 /
IEC 60617 symbols, units on every number, 11 px minimum text, 44 px touch targets, no sideways scroll.

### 7.1 Audit result (2026-11-18, tree v3.73.0 + branch conv-p5; 173 screenshots, every finding re-observed in a browser)

Evidence: `~/.cache/qa-tmp/audit-ux/findings.md` (43 findings), `inventory.md` (every clickable equipment class per
page), `shots/`. Inventory: chiller-plant 10 classes / 57 nodes, water 12 / 19, fire 19 / 49, fuel 10 / 22, EPMS
E-S-101 13 / 94 — on all 64 classes the modal Drawing is the cloned symbol (2–12 primitives). No modal exists for
the EPMS legacy view (84 devices open nothing), the data-hall racks and CRAH list, and `cdu-mini-bms` equipment.

| id | sev | finding | work package |
|---|---|---|---|
| F1 | CRITICAL | Modal Drawing = clone of the one symbol on all 64 classes; nothing internal | E2, E4–E6 |
| F2 | CRITICAL | Three generator fleets: fuel page 3 sets with GEN-B alone "RUNNING 43.5 MW"; EPMS legacy GEN A/B/C; E-S-101 32 sets | E5 (fuel sheet per hall, 8 sets; standby in normal) |
| F3 | HIGH | EPMS legacy: a click on "Utility A" de-energises feed A and starts gensets while the page still reads NORMAL, 0 alarms, 43,500 kW | E5 (E-S-102 replaces the legacy view) |
| F4 | HIGH | EPMS legacy: 84 devices open nothing; 98 breakers and 6 sources operate on one click, no select-before-operate | E5 |
| F5 | HIGH | Fuel in NORMAL: a set at 43.5 MW with every day-tank fill valve closed and P-101 stopped; DT-GEN-B 455 L = 1.8 min of burn; no alarm | E5 (day tank sized per set burn, fill logic, low-level alarm) |
| F6 | HIGH | Inspector is navy `rgba(15,23,42,.97)` with an 8 px backdrop blur — two rejected patterns | E7 |
| F7 | HIGH | Sheet tags: light text with a dark halo on a light canvas | **fixed v3.74.1** (theme pin of the shared gradient defs) |
| F8 | HIGH | Nine pages, nine top bars; 8 button classes, 28–52 px; `cdu-mini-bms` has no Back / Portfolio / Alarm history | E7 |
| F9–F10 | HIGH | Light theme works on 2 of 9 pages; `dc-conventional` light callouts at 2.45–3.9 : 1 | E7 (decision OD-7) |
| F11–F13 | HIGH | 390 px: `dc-conventional` bar overlaps and runs off screen; sheets open on an empty pan; text under 11 px on every page (CDU P&ID 6 px) | E7 |
| F14 | HIGH | EPMS legacy "Fit" removes all 84 device labels | E5 |
| F15–F16 | HIGH | Normal state in saturated colour (ISA-101); coloured left rails (rejected pattern) on five pages | E7 |
| F17 | MEDIUM | Internal ids as equipment titles (`vs1`, `cka1`, `cv0`, `t1-pe`, `ictlink-it-0`); untagged valves | E3–E6 (ISA-5.1 tag on every symbol) |
| F18 | MEDIUM | Units: ΔT printed in "C" instead of K; raw `kW_th`; "30.000 MW" beside "30.00 MW" and "30,000 kW" | E7 (one unit formatter) |
| F19 | MEDIUM | Chiller sheet draws 4 of 10 machines | E3 |
| F20 | MEDIUM | ICT chip "Active/Active" against a drawing with DUTY / STANDBY | E7 |
| F21 | MEDIUM | EPMS "Per system 15,000 kW" is the load; the rating is 32 × 1,250 = 40,000 kW | E5 |
| F22 | MEDIUM | Water page evaporation 447.8 L/min carries about half the condenser heat as latent; basis not shown | E1b (engine: state the evaporation basis) |
| F23 | MEDIUM | TCC opened from the 150 kV bay plots the 3,150 kVA unit's damage and inrush curves, not TX-1's | E5 |
| F24 | MEDIUM | Two legends on the HV / MV view (legacy feed legend + sheet legend) | E5 |

Engine findings from phase E1 (2026-11-18), to close in E1b: `cooling.flow_per_machine_lps` (134.7) divides the
IT-only flow by the machines, while the machines carry IT + UPS loss (140.3 L/s); the 1,250 kW of UPS loss has no
terminal unit in the model (the CRAH fleet is sized on IT load only) — electrical rooms need their own cooling units.

---

## 8. One cockpit language (phase E6)

- **Shell**: one header component for the 9 pages (back · title · hall / scope selector · view switch · actions),
  one status strip (state, alarms, data quality, scenario, clock), one legend component, one inspector component,
  one modal shell (§4) used by equipment, network and TCC.
- **Type and space**: the existing scale (11, 13, 14, 16, 20 …) and the 4 px grid, enforced per page by the render
  ratchet; no text under 11 px in a drawing or a table.
- **State vocabulary**: one table of state words and colours + patterns shared by sheets, strips, chips and modals.
- **Navigation model** (ISA-101 levels): L1 campus (`dc-conventional`) → L2 system page → L3 equipment modal →
  L4 internal block / trend / TCC. Every level names where it is and how to go up.
- Each accepted audit finding lists its own acceptance check.

---

## 9. Gates (each red on today's tree or on a planted defect before it is trusted)

| gate | proves |
|---|---|
| `test-conv-internals-core.mjs` (Node) | every class model: energy balance ± 1 %, flow balance, Σ units = plant value, deterministic, no random / clock; planted defects: condenser duty without the compressor power, a unit share that does not sum |
| `test-conv-internals-coverage.mjs` | every equipment class on the 9 pages has an internal drawing or a written exemption; every catalogue block of §5 is on its drawing, tagged and clickable; no modal shows only the outer symbol (P-1) |
| `test-conv-internals-render.mjs` | per class at 1440 and 390: the drawing renders, blocks select, values equal the model, text-clear and geometry laws, unit navigator steps N units and re-binds, focus and Escape, no sideways scroll |
| `test-conv-quantity-truth.mjs` | per sheet: count of each class drawn = engine count or the "× N" label equals the engine; running split = engine; tags run 01…N |
| `test-conv-engine-hydronic.mjs`, `…-refrigeration.mjs` (Node) | the new families: worked values recomputed independently, reconciliation with the existing specific power and rejection, monotonic directions |
| `test-conv-shell.mjs` | the 9 pages share header, strip, legend, inspector and modal shell (structure and computed sizes); state words come from the one table |
| existing conv gates + the **whole** conv family list of `ship-gate.sh` | no regression. Lesson of v3.70.0: the release filter ran only `test-conv-*`; the conv-family gates with other names must be in the release run |

Every drawing gets screenshots at 1440 and 390 that are looked at before release.

---

## 10. Architecture

| module | role | status |
|---|---|---|
| `js/conv-engine.js` 2.4.0 | hydronic fleet, refrigeration cycle, heat rejection, unit-state tables | new families, additive |
| `js/conv/internals.js` | pure class models + registry of internal sheets | new |
| `js/conv/internals/*.js` | one governed mini-sheet per class | new |
| `js/conv/equipment-modal.js` | v2 shell: drawing + block detail + unit navigator + fleet strip + tabs | rewrite, same public API |
| `js/conv/chiller-sheet.js`, `condenser-sheet.js`, `fuel-sheet.js`, `epms-lv-sheet.js` | quantity truth | changed / new |
| `js/conv/shell.js`, `css/conv-shell.css` | the shared header, strip, legend, inspector | new (E6) |
| `js/rz-eng-symbols.js` | internal-part symbols missing from the library (flash tank, purge unit, oil pump, tap changer, Buchholz …) | additive |

No new dependency. Zero-build. Shared modules change additively.

---

## 11. Phases and releases

| phase | content | release |
|---|---|---|
| **E1** | Engine 2.4.0: hydronic fleet, refrigeration cycle, heat rejection, unit-state tables, Node gates | MINOR, engine |
| **E2** | Modal v2 shell + **chiller internals** (the owner's example) + unit navigator + fleet strip | visible proof |
| **E3** | Quantity truth on CH-M-101 (10 trains, CRAH banks × N) + new CH-M-102 condenser / tower sheet | |
| **E4** | Internals: pump set, cooling tower, CRAH, heat exchanger, valves, tanks, instruments | |
| **E5** | Internals: transformer, GIS bay / breaker, UPS, genset, switchboard; fuel sheet per hall (8 sets) and E-S-102 LV sheet | |
| **E6** | Internals: fire pump set, pre-action / alarm valve trim, FACP, tanks, polisher, water treatment | |
| **E7** | One cockpit language: shell, inspector, modal family merge, audit findings | |
| **E8** | Manuals, tooltip corpus, standards, the remaining PRD-CONV-LIVING-PLANT items (fire water front, fault sequences) | |

Each phase: laws → red → build → green → screenshots looked at → standards doc in the same release → gates of the
whole conv family → push → verify live.

---

## 12. Risks and limits

- **A cycle model is not a selection program.** Saturation states come from two declared approaches and a property
  correlation; they are consistent and labelled, and they will differ from a vendor's rating sheet.
- **Ten chiller trains on one sheet** need a wider sheet and level-of-detail; the text-clear gate decides, not taste.
- **Modal weight.** A mini-sheet per class adds drawing code; each file is loaded only by the pages whose classes
  need it.
- **Parallel releases.** Another session ships site-chrome phases on the same `main`; every release here is ported
  onto the moved `main`, never rebased across the token churn.

## 13. Owner decisions (defaults stand if not overridden)

| id | decision | default |
|---|---|---|
| OD-1 | Chiller refrigerant for the cycle model | R-134a (the common centrifugal fluid; property data widely published) |
| OD-2 | Draw all units or a typical × N | chillers, towers, gensets per hall: all units; CRAH: a bank per hall × N with a fleet strip |
| OD-3 | Tower arrangement | one induced-draft cell per chiller + N+1 |
| OD-4 | Pump arrangement | primary: one duty + one standby per chiller train (as drawn today); secondary and condenser: N+1 on headers |
| OD-5 | Depth of drill-down | two levels (machine → sub-assembly) |
| OD-6 | Order | E1 → E8 as listed; the chiller is the first visible proof |
| OD-7 | Light theme on the cockpits | dark only; the toggle is hidden on the 7 pages that never switched |
| OD-3/4 note | Tower cells and condenser pumps | one per chiller train, so their redundancy is the chillers' N+1 (10 installed for 7 running) |

## 15. Orchestration (owner 2026-11-18: "kamu yang lakukan, autonomous, rancang kolaborasi dan orkestranya, jangan tanya saya")

One integrator, several executors, one release train. Decisions are taken by the integrator from the PRD defaults
and recorded here or in §13; nothing waits for a question.

| role | who | where | does |
|---|---|---|---|
| Integrator | the main session (Fable) | worktree `rz-w5`, branch `conv-w6` | plans, writes briefs, reviews every screenshot and number, ports branches onto the moved `main`, runs the release gates, pushes, verifies live |
| Executor | one Opus agent per work package | its own worktree and branch (`rz-e1` `conv-e1`, `rz-e7` `conv-e7a`, …) | builds one package to its laws, runs its gates, looks at its screenshots, commits locally, never pushes |
| Auditor | read-only Opus agent | `rz-p1` | measures and screenshots; changes no tracked file |
| Peer | the DC AI / site-chrome session | its own trees | ships on the same `main`; shared tables and files are agreed by message before either side edits them |

Rules of the train:
- **Two browser lanes, no third browser.** Lane 1 and lane 2 belong to this session; an executor is told its lane
  and queues on `rz-lane`. Node-only packages run beside them.
- **One package = one branch = one release**, except where a package only supplies the basis of the next (engine
  2.4.0 ships with the modal that draws it).
- **Order by conflict, not by wish**: packages that touch the same file are released one after the other; the
  integrator ports each branch onto the moved `main` (checkout of the real files, regeneration of every generated
  artefact, token fix) — never a rebase across the version-token churn.
- **Release gate = `tools/run-conv-release-gates.sh`** (70 gates selected by what they cover) inside a lane, plus
  the package's own new gates. A gate red for a reason outside the package is proven on `origin/main` before it is
  set aside, and named in the release note.
- **Evidence before words**: every executor report is checked by the integrator on at least the decisive numbers and
  the screenshots before it is repeated to the owner.

Train as of 2026-11-18:

| # | release | package | branch | state |
|---|---|---|---|---|
| R1 | v3.74.1 | sheet labels readable (audit F7) | `conv-w6` | gates running |
| R2 | next MINOR | E1 engine 2.4.0 + E2 modal v2 with chiller internals | `conv-e1` | E1 built, E2 in gates |
| R3 | — | E7a one cockpit top bar, bare Login, primary CTA with lift, glow, label swap, plane loop | `conv-e7a` | executor running |
| R4 | — | E3 CH-M-101 with 10 trains + CRAH banks × N + CH-M-102 condenser / towers | to open after R2 | queued |
| R5 | — | fuel truth (audit F2, F5): 8 sets per hall, standby in normal, day tanks sized per set burn | to open after R2 | queued |
| R6+ | — | E4–E6 internals by class; E5 E-S-102 LV sheet; PRD-APP-CLARITY packages from the app-pattern audit | — | queued |

## 14. Status

| phase | status |
|---|---|
| E1 | RELEASED v3.75.0 (7b5391b30, 2026-11-19) — engine 2.4.0: refrigeration cycle (R-134a Antoine fit), hydronic fleet, tower cells, CRAH per unit, mechanical headroom, `CONV_CALC.getFleet`; additive (0 of 252 published 2.3.0 keys changed except `meta.version`); gate `tools/test-conv-plant-internals.mjs` with 3 red proofs; Node gates only — browser gates not run (lanes busy). Gate name differs from §9 (`…-hydronic` / `…-refrigeration`): one file covers both. Tower standby 0 and one condenser pump per chiller follow the E1 brief, not OD-3/OD-4 N+1 — open. |
| E2 | RELEASED v3.75.0 (7b5391b30, 2026-11-19) — modal v2 (`RZConvModal` 2.0.0, same API + `internal` option): unit navigator, fleet strip (10 cells, 7 running), internal drawing + block detail, plant-sheet sections below; `js/conv/internals.js` registry + `js/conv/internals/chiller.js` (17 catalogue blocks of §5.1, 19 nodes, 22 lines in 7 media classes); 8 symbols added additively; wired on `chiller-plant.html` for CH-01…CH-04 (navigator reaches CH-01…CH-10). Gates `test-conv-internals-core.mjs` (Node, 7 laws, 4 planted defects red) and `test-conv-internals-render.mjs` (1440 + 390, 5 planted defects red), registered in `ship-gate.sh`. Values the engine does not model read "not modelled" (superheat, subcooling, IGV, oil, discharge T, VFD speed). Open: drill-down to a second level (§4) and trend-on-click inside the block detail are not built; the plant sheet still draws 4 chillers (E3). |
| E3 | RELEASED v3.81.0 (2026-11-21) — CH-M-101 draws every unit of `getFleet('chiller')` (10 trains, 7 running / 3 standby, tags CH-01..CH-10), primary pumps from `getFleet('chw_primary_pump')` (20), secondary pumps from `getFleet('chw_secondary_pump')` (5); one CRAH coil bank per hall labelled `× 59 · 58 RUN` from `getFleet('crah', hall)`, the hall selector marks its bank, the bank opens `RZConvModal` 2.1.0 in fleet-only mode on the hall's 59 units. New CH-M-102 (sheet switch on the page): 10 tower cells + 10 CDW pumps from the engine, CDWS/CDWR from `cooling.cdw_*`, Σ cell rejection = `cooling.tower_rejection_kw_th` within 0.5 %. Payload classes `condenser:*`. Gate `tools/test-conv-quantity-truth.mjs` (L1–L5 at 1440 + 390, both themes, plus a getFleet stub of 8 chillers / 6 secondary / 8 cells / 30 CRAH the sheets must follow; planted defects font / unit / sum / ignore go red). Integrator review of 2c3ff83d1 closed in the same branch: PERF1/PERF2 (sheet motion on a 3 Hz clock, depth layers kept), Q1 labels clear of pipes and CH-M-102 fits the 1440 panel, Q2 standby trains show no loop temperature, Q3 branch flow = engine `chwFlowLps`, Q4 NORMAL 60 s = 0 warnings |
| Fuel truth (R5, audit F2 + F5) | RELEASED v3.81.0 (2026-11-21) — FU-M-101 is a per-hall view: hall selector from `listHalls()`, one XV + day tank + genset per row of `getFleet('genset', hall)` (8 per hall, tags GEN-A1…A8), site total 32 stated with `electrical.genset_count`; NORMAL = every set STANDBY 0 kW, XVs closed, P-101 stopped, 0 alarms; UTILITY LOSS = 7 duty sets per hall share the hall `facility_load_kw` (1,553.6 kW each, ≤ 3,000 kW), spare STANDBY; day tank per set = 4 h at rated burn (4,277 L), fill 50 → 90 %, ≥ 1.8 h kept while fill works, `LAL-DT-<set> LO` when fill is unavailable; genset / day-tank symbols open the modal on that set's inside (`js/conv/internals/genset.js`, navigator over the hall's 8). Gate `tools/test-conv-fuel-truth.mjs` (N1–N3, F1–F5, 8 planted defects red). Open: the engine does not publish the run split (§6.5), the page states the rule; transfer pumps are drawn per hall with the P-101/P-102 tags. |
| E5-EPMS | RELEASED v3.81.0 (2026-11-21) — E-S-102 "LV distribution — typical hall" replaces the legacy LV drawing of `EPMS_Telemetry.html` (`js/conv/epms-lv.js`, `js/conv/epms-lv-view.js`, `js/conv/epms-sim.js` 1.1.0 additive): hall selector A–D, gensets per hall from `getFleet` on a hall generator bus, × N counts from the engine, select-before-operate, one page status from both sheets (F3 F4), fit keeps labels ≥ 11 px (F14), F21 rating vs load, F23 TCC per bay, F24 one legend; gate `tools/test-conv-epms-lv.mjs` with three planted defects; `test-epms-ats-rack-color` retired; contract in `standarization/CONVENTIONAL_DC_OPERATIONS_STANDARD.md` §10 |
| E4, E5 (electrical internals), E6–E8 | NOT STARTED |
