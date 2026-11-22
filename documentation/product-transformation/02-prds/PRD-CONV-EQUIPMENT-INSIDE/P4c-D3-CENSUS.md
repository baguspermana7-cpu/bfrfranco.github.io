# PRD-CONV-EQUIPMENT-INSIDE · P4c — Every remaining EPMS symbol opens up, or says why not (v3.95.0)

Status: APPROVED by standing order (owner 2026-11-22: "Continue to improve, selalu rancang prd yang sangat detail dan
comprehensive dan sempurna"). Parent: `PRD.md` §9 P4, `P4-ELECTRICAL.md` §4.6–§4.7 and law EL8. Follows P4b
(`P4b-BREAKER-RELAY.md`, v3.93.0), which moved the switchboard class here.

## 1. Problem

After v3.93.0 a click on a transformer, a UPS part, a breaker or a relay opens the inside of that device. Every other
symbol on the two EPMS single-lines still opens the side inspector, which lists values and draws nothing. The owner's
request (R186) was for every block. Measured on the v3.93.0 tree (E-S-101 plus E-S-102 for halls A–D):

| symbol | count | class after P4b | example |
|---|---:|---|---|
| junction | 187 | none (a drawing point) | — |
| cbIec | 129 | `breaker` | CB-L1 |
| generatorIec | 33 | **none** | GEN (E-S-101 block), GEN-A1…A8 |
| protectionRelay | 28 | `relay` | R-L1 |
| offSheet | 26 | none (navigates) | HALL A |
| switchgear | 16 | **none** | MVSB-AA, LVMSB-AA |
| currentTransformer | 14 | **none** | CT-L1 |
| disconnector | 12 | **none** | DSL-L1 |
| transformer2w | 12 | `hv_tx` / `dist_tx` | TX-1 |
| utilitySource | 10 | **none** | PLN LINE 1 |
| rectifier / batteryIec / inverterIec / staticSwitch | 8 each | `ups` | REC-AA |
| surgeArrester, voltageTransformer, earthSwitch, resistor, earth | 2 each | **none** (earth: a reference) | SA-L1, VT-L1, ES-L1, NGR-1 |

Nine symbol kinds (generatorIec, switchgear, currentTransformer, disconnector, utilitySource, surgeArrester,
voltageTransformer, earthSwitch, resistor: 93 symbols) have no inside and no stated reason.

## 2. Goals

- G1 Every symbol kind on both EPMS sheets is either registered with an internal drawing or listed in §6 with the
  reason it has none (law EC0, the census, at 100 %).
- G2 The generator on EPMS opens the SAME `genset` class the Genset cockpit uses (no second drawing of a genset), and
  its run state is the EPMS simulation's, so the sheet and the modal agree (P4-ELECTRICAL TR1).
- G3 A switchboard opens a board view: incomers, bus, feeders, each feeder's breaker position and kW from the solve;
  clicking a feeder in the board drawing selects that breaker's block (`goto`), it never opens a second modal.
- G4 Every number is the page's solve, the engine, or "not modelled". No number is typed into a drawing file
  (digit law, as P4a/P4b).

## 3. Non-goals

- No new engine keys except where §5 names one; no protection study (CT ratios, VT burdens stay "not modelled").
- No change to the simulation, to select-before-operate, or to the inspector.
- Junction, earth and offSheet keep their behaviour (§6).

## 4. Classes

All files under `js/conv/internals/`, one `R.register` each, geometry in GEOMETRY blocks, formats in FORMATS blocks.

### 4.1 `switchboard` (switchboard.js) — 16 boards, E-S-102 only

Drawing: incomer(s) at the top, the busbar as one horizontal bar, up to 8 feeder bays below (`cbIec` symbol, tag,
position, kW). A board with more feeders draws the first 7 and a "+N more" bay that lists the rest in the block detail.

| value | source |
|---|---|
| bus voltage | engine by `kv` (`mv_voltage_kv` / `lv_voltage_v`) |
| bus kW | SIM: sum of incomer kW (energised only) |
| feeder position, kW, A | SIM |
| fault level at the bus | engine `mv_fault_level_ka` / `lv_fault_level_ka` |
| busbar rating, form of separation | not modelled |

Adapter: `boardUnits(sheet, state, res)` in `epms-internals.js`. A board's members are the breakers whose power-edge
walk (P4b `nearestAny`) reaches the board node before any other switchboard. Strip = the boards of the same hall.
`goto`: a feeder bay click calls `selectBlock('feeder:<id>')`; the block detail shows that breaker's position, kW,
A and an "Open CB-xxx" button that switches the modal to the breaker class on that unit (same modal, new class), so
one click path reaches the breaker's inside from its board.

### 4.2 Generator — reuse `genset`

`classOf(generatorIec)` → `genset`. The unit passed to the class is the fleet row of that set
(`CONV_CALC.getFleet('genset', hall)`), with `state` overridden by the EPMS solve (`res.dev[id].energised` and the
breaker position): RUNNING only when the set's breaker is closed and the simulation runs the set. The E-S-101 `GEN`
block (the synchronised generator bus) opens the strip of all 32 sets with the first set selected; its title is
"GEN — generator bus (32 sets)". Law EC3 checks that the header state equals the sheet's drawn state for every set.

### 4.3 D3 classes (d3.js, one file, seven small classes)

| class | blocks | values |
|---|---|---|
| `disconnector` | blade + contacts, operator (motor or hand) | position (SIM); interlocked breaker (adapter); operator type not modelled |
| `earthSwitch` | blade + contacts, interlock | position (SIM); the breaker / disconnector it is interlocked with |
| `currentTransformer` | primary conductor, core, secondary, burden | primary current (SIM, the conductor's A); ratio, class, burden not modelled |
| `voltageTransformer` | primary, core, secondary | primary voltage engine by `kv`; secondary 110 V AUTHORED (IEC 61869-3 standard value); burden not modelled |
| `surgeArrester` | MOV stack, discharge counter | system voltage by `kv`; rated voltage, counter not modelled |
| `ngr` (resistor) | resistor element, CT, 51G | `mv_ngr_ohm` and `mv_earth_fault_a` (engine); time rating not modelled |
| `utilitySource` | incoming line, metering point | voltage by `kv`; fault level `hv_fault_level_ka`; kW and A (SIM) |

Each D3 strip holds the same kind on the same sheet (≤ 14; CT 14 is the largest).

## 5. Engine

No new key. The VT secondary 110 V is a standard value written in the GEOMETRY block as a label with
`standard: 'IEC 61869-3'`, not a number the drawing computes.

## 6. No inside, with a reason (EC0)

| symbol | reason shown in the inspector | behaviour |
|---|---|---|
| junction | "A drawing point: the conductors meet here." | inspector unchanged |
| earth | "The earth reference." | inspector unchanged |
| offSheet | "Continues on another sheet." | the click keeps navigating |

The list lives in one table in `epms-internals.js` (`NO_INSIDE`), so EC0 reads it and nothing is hard-coded twice.

## 7. Laws (all in `tools/test-conv-internals-p4c.mjs`, ship gate; red first)

| law | claim | proof |
|---|---|---|
| EC0 | census: every `sym` on E-S-101 and the four E-S-102 halls has `classOf()` ≠ null or is in `NO_INSIDE` | node; red on v3.93.0 (9 kinds, 93 symbols missing) |
| EC1 | every engine-basis row equals the engine key it names; every "not modelled" row is declared in the test's list | node, all units of all new classes |
| EC2 | digit law on switchboard.js and d3.js | node |
| EC3 | generator: modal header state = the sheet's drawn state for all 33 generator symbols; GEN opens a 32-set strip | node + browser |
| EC4 | switchboard bus kW = Σ incomer kW of the solve; every member breaker reaches the board before any other board | node |
| EC5 | one click on one symbol of each new kind (1440 + 390) opens the modal titled by its tag, drawn values = `read()` | browser |
| EC6 | `goto`: a feeder bay click selects that feeder; "Open CB-xxx" switches the same modal to the breaker class, no second dialog | browser |
| EC7 | no overlap, no text outside the drawing, no line through text, 0 page errors | browser |
| EC8 | strips ≤ 14 tiles | node |

Mutations that must go red: drop one kind from `classOf`; generator state from the fleet instead of the solve; bus kW
summed over feeders instead of incomers; a VT reading 0.11 kV typed in model(); goto opening a second modal.

## 8. Risks

| risk | mitigation |
|---|---|
| genset class expects fleet fields EPMS does not have | pass the fleet row; only `state` is overridden; EC1 covers every row |
| 32-set strip at 390 px | the strip already wraps; EC8 caps per-hall strips, the GEN block is the one exception and is tested at 390 |
| board membership ambiguous where two boards tie | EC4 asserts uniqueness; a tie fails the gate instead of drawing a guess |
| more modal classes slow the EPMS page | the class files are < 10 kB each and load deferred like P4a/P4b |

## 9. Release

v3.95.0: classes, adapter, census, tests, standards 23g, ledger R186-P4c, CLAUDE.md modal row, CHANGELOG. Full conv
release gate, live check (rz-version.js 3.94.0 and one live screenshot of a switchboard modal), IndexNow.
