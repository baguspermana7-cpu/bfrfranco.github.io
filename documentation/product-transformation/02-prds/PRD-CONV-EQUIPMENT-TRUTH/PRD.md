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

Known before the audit (from this session's own screenshots):

| # | finding | page |
|---|---|---|
| U-1 | Nine pages carry nine different headers (button order, sizes, title position, clock, export) | all |
| U-2 | The EPMS top strip still reads "Utility A+B · Gen Standby" from the legacy view while E-S-101 is shown | EPMS |
| U-3 | The LV view's top bar wraps its title to three lines | EPMS |
| U-4 | On the data hall, the heat-map mode buttons and the legend stay active in the Air path view where they do nothing | datahall |
| U-5 | Inspectors sit in different places and use different row styles per page | all |
| U-6 | Three modal families exist (equipment, network, TCC) with three looks | chiller/fire/fuel/water, ict, EPMS |
| U-7 | Status words differ per page for the same state (RUN / RUNNING / ONLINE / UP / DUTY) without a glossary | all |

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

## 14. Status

| phase | status |
|---|---|
| E1–E8 | NOT STARTED — PRD written 2026-11-18 |
