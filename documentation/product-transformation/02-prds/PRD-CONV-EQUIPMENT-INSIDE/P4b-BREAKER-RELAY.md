# PRD-CONV-EQUIPMENT-INSIDE · P4b — Breakers, relays and switchboards open up (v3.93.0)

Delivery (2026-11-22): v3.93.0 ships the breaker class, the relay class, the modal action footer (M11–M13) and EB0–EB6, EB8 in `tools/test-conv-internals-p4b.mjs`. The switchboard class (§4.3, EB7, the `goto` navigation) moves to P4c: it needs a board model the E-S-102 builder does not expose yet, and shipping breakers without it changes no rule of this PRD.

Status: APPROVED by standing order (owner 2026-11-22: "Continue to improve, selalu rancang prd yang sangat detail dan
comprehensive dan sempurna"). Parent: `PRD.md` §9 phase P4; electrical frame: `P4-ELECTRICAL.md` §4.3–4.5, §6.3–6.5.
This file is the build contract for P4b. Where it differs from `P4-ELECTRICAL.md`, this file wins, because it rests
on counts measured on the P4a tree.

## 0. The request, for this phase

The owner's rule (R186): one click on a block shows the process inside that block. P4a did this for the transformer
and the UPS. In P4b the same click works on the devices the operator touches most: the circuit breaker, the
protection relay and the switchboard. After P4b, a click on CB-FA4 shows contacts, arc chamber, mechanism, coils,
trip path and interlocks, with the breaker's live position and current. A click on R-FA4 shows CT inputs, the
function blocks and the trip output to CB-FA4. A click on LVMSB-AA shows its incomers, bus sections, tie and feeders.

## 1. Measured state (P4a tree, engine 2.6.0, 2026-11-22)

| # | fact | evidence (node, P4a tree) |
|---|---|---|
| M1 | E-S-101 draws 21 `cbIec`, 20 `protectionRelay`, 12 `disconnector`, 2 `earthSwitch`, 14 `currentTransformer`, 2 `resistor`, 2 `voltageTransformer`, 2 `surgeArrester`, 2 `utilitySource`, 1 `generatorIec` | sym census of `RZEpmsSheets.sld` |
| M2 | E-S-102 draws per hall 27 `cbIec`, 2 `protectionRelay` (LSIG), 4 `switchgear` (MVSB-xA/xB, LVMSB-xA/xB), 8 `generatorIec`. Over four halls: 108 breakers, 8 relays, 16 boards | sym census of `RZEpmsLv.build(h, …)` |
| M3 | `P4-ELECTRICAL.md` §4.3/4.4 said 48 breakers and 22 relays. Measured: 129 breakers, 28 relays. This PRD uses the measured counts | M1 + M2 |
| M4 | A breaker node carries `sw`, `kv`, `relay` (its relay id), `es` (earthing switch), `normal`, and on E-S-102 `section`, `incomer`, `set` | key census of breaker nodes |
| M5 | A relay node carries `name` (ANSI functions, e.g. `87T · 50/51`, `50/51 50N/51N`, `LSIG`, `87B`, `51G`, `50BF`, `87L · 21`), `prot` (`hv`, `incomer`, `feeder`, `lsig`) and `cb` (the breaker it trips). R-BB (87B) has no `cb` | relay key census |
| M6 | Engine settings exist only for the graded chain: `pro_lv_ir_a`, `pro_lv_isd_a`, `pro_lv_tsd_s`, `pro_lv_tr_s`, `pro_feeder_is_a`/`_tms`/`_curve`/`_inst_a`/`_inst_s`, `pro_incomer_is_a`/`_tms`/`_curve`, `pro_hv_is_a`/`_tms`/`_curve`. No settings exist for 87L, 21, 87T, 87B, 50BF, 51G (G5) | `Object.keys(snapshot.electrical)` filtered `pro_` |
| M7 | Breaking capacity exists only at HV: `hv_switchgear_rated_ka`. The MV and LV ratings are absent; the fault levels `mv_fault_level_ka` and `lv_fault_level_ka` exist | same |
| M8 | Switching already exists. On E-S-101 it is direct: the inspector button "SIMULATION · Open/Close" calls `RZEpmsSim.operate`. On E-S-102 it is select-before-operate: `Select · Open`, then `Execute` or `Cancel` (`epms-lv-view.js:149-152`), via `RZEpmsLv.command/operate`. Interlock refusals return `{ ok:false, reason }` | source lines quoted |
| M9 | Relays with `prot` already open the TCC modal ("Time–current curves", `RZEpmsTccSpec`) | `EPMS_Telemetry.html:1368`, `epms-lv-view.js:156` |
| M10 | Today a breaker, relay or board click opens the side inspector; nothing draws the device's inside | P4a gate E3 inspector branch still passes for these devices |
| M11 | The modal's lower part renders the payload's `sections` and provenance, NOT its `custom` action list: no operate button reaches the modal today | `equipment-modal.js` `intLower()` (P4b-0 reading, 2026-11-22) |
| M12 | The modal refreshes itself: a timer (`opts.period`, default 4000 ms) calls `refreshInt()`, which re-reads `fleet()` and `snapshot()`. After an operation the drawing follows within one period unless the handler asks for a refresh | `equipment-modal.js:425-428` |
| M13 | Defect carried from P4a: the modal's source note reads "fleet row … and plant cooling values" on EPMS units, whose values come from the single-line solve | `intLower()` note text; seen on TX-DA and UPS-AA |

## 2. Goal and non-goals

Goals:
- G-a: one click on any of the 129 breakers, 28 relays and 16 boards opens the equipment modal on its drawn inside.
- G-b: every value on those drawings comes from the page's own solve or from the engine. A value that neither holds
  reads "not modelled".
- G-c: switching from inside the modal keeps the same safety rules as the sheet: direct on E-S-101,
  select-before-operate on E-S-102, and interlock refusals with their reason. The drawing repaints from the new
  solve.
- G-d: a relay drawing shows only the function blocks its `name` lists. Settings appear only for the graded chain
  (M6). Every other function block says "settings not modelled".

Non-goals:
- Do not invent settings for 87L/21/87T/87B/50BF/51G, MV/LV breaking capacity, operation counters, contact wear or
  spring-charge state.
- No new switching semantics. The modal calls the existing `operate`/`command`; it never writes `state` itself.
- No D3 classes (P4c): disconnector, earth switch, CT, VT, arrester, NGR, source, generator.

## 3. Interaction

| # | rule |
|---|---|
| I1 | One click on a breaker, relay or board symbol opens the modal on its drawing. The inspector stays reachable from the modal's "Details" link. This is the same rule as P1–P4a |
| I2 | A breaker modal shows the same operate buttons the inspector shows today (M8), in the modal footer, built from the same payload `custom` list. After an operation the modal re-reads `fleet()`/`snapshot()`, and the drawing and rows show the new position |
| I3 | An interlock refusal shows its `reason` in the modal's message line, and the position does not change |
| I4 | A relay modal has a "Time–current curves" button for a relay with `prot` (M9). It opens the existing TCC modal |
| I5 | A board modal lists its feeders as rows (tag, position, kW, A). A click on a feeder row moves the modal to that breaker (fleet index change; breadcrumb "LVMSB-AA › CB-UIAA"). Back returns to the board |
| I6 | The unit strip of a breaker modal holds the breakers of the same board (E-S-102) or the same voltage level (E-S-101), at most 14 (measured: E-S-101 MV = 14, relays MV = 12). It never holds the whole sheet: 27 tiles at 390 px are unusable |

## 4. Classes and drawings

### 4.1 `breaker` — D2

Nodes (sheet geometry like `transformer.js`, size about [600, 520]):
- `line`: from the upstream bus or device. Its tag is read from the sheet edge walk, the same walk `epms-internals.js`
  `nearest()` uses.
- `mc`: main contacts, drawn as the `cbIec` symbol at large size, with a position value.
- `arc`: arc chamber. Its medium comes from `kv`: `hv` = SF6, `mv` = vacuum, `lv` = air. This is a drawing class, not
  a number. Standards: IEC 62271-100 for HV and MV, IEC 60947-2 for LV.
- `mech`: stored-energy spring mechanism. Its state is NM.
- `tc` / `cc`: trip coil and close coil, with signal lines from `mech`.
- `ct`: the current transformer that feeds the relay or the trip unit.
- `trip`: on LV, the electronic trip unit LSIG with Ir / Isd / tsd / tr from the engine. On MV and HV, a link to the
  relay tag (`n.relay`); a click on it moves the modal to the relay (I5 rule).
- `aux`: auxiliary contacts 52a / 52b. Their state follows the position.
- `il`: interlocks. One row per `n.es` / disconnector that names this breaker as `cb`, each with its live position.
- `load`: to the downstream device (edge walk).

Values: position and kW/A from the solve; breaking capacity at HV only (M7); the rest NM.

### 4.2 `relay` — D2

Nodes:
- `ct`: CT inputs, one per measured circuit.
- `vt`: VT input, drawn only when `name` contains 21.
- `me`: measuring element.
- One function block per ANSI code in `name`, laid out in a column. Each block shows its pickup and time when the
  engine holds them. Otherwise it shows "settings not modelled".
- `tl`: trip logic.
- `out`: trip output, with an edge to the tripped breaker's tag (`n.cb`). R-BB draws "to every bus breaker of the
  section" as text, not invented edges.
- `wd`: self-supervision watchdog, NM.

Trip state: "TRIPPED" when the breaker named in `n.cb` is open and the solve marks it as opened by protection. The
P4b scope has no protection-trip simulation, so this is always "normal" and the row says so. A relay never shows
TRIPPED because an operator opened its breaker.

### 4.3 `switchboard` — D2 (E-S-102 MVSB / LVMSB)

Nodes:
- `inc`: incomer breakers (`n.incomer`).
- `bus`: one busbar per `section`.
- `tie`: the bus tie, when the board has one.
- `fdr`: feeders as a compact vertical list, one row each, value = position · kW. The drawing stays fixed when the
  feeder count changes, because the list scrolls inside the block detail and the drawing shows the first 6 plus
  "+N more".
- `met`: metering, giving the bus voltage (engine `lv_voltage_v` or `mv_voltage_kv`) and the bus kW (solve).

The busbar rating is NM.

## 5. Truth table

| class | value | source |
|---|---|---|
| breaker | position | SIM `state.closed[id]` |
| breaker | kW, A | SIM `res.dev[id]` |
| breaker | interrupting medium | `kv` class (text) |
| breaker | breaking capacity | ENG `hv_switchgear_rated_ka` (HV); NM for MV and LV (M7) |
| breaker | fault level at the bus | ENG `hv_/mv_/lv_fault_level_ka` by `kv` |
| breaker | LV trip unit Ir, Isd, tsd, tr | ENG `pro_lv_ir_a`, `pro_lv_isd_a`, `pro_lv_tsd_s`, `pro_lv_tr_s` (LV mains with relay `prot:'lsig'` only) |
| breaker | interlocks | sheet `es` / `ds.cb` lists + SIM positions |
| breaker | operation counter, contact wear, spring charged, coil supervision | NM |
| relay | functions | sheet `name`, split on spaces and `·` |
| relay | graded settings | ENG `pro_<prot>_is_a`, `_tms`, `_curve`, `_inst_a`, `_inst_s`, `_t_s` by `prot` |
| relay | 87L, 21, 87T, 87B, 50BF, 51G settings | NM (G5) |
| relay | trip state | "normal" (no protection-trip simulation in scope) |
| relay | watchdog | NM |
| switchboard | feeder position, kW, A | SIM |
| switchboard | bus voltage | ENG by `kv` |
| switchboard | bus kW | SIM, the sum of incomer kW |
| switchboard | busbar rating | NM |

## 6. Architecture

- `js/conv/internals/breaker.js`, `relay.js`, `switchboard.js`: one class each, registered with `RZConvInternals`.
  They obey the same digit law as P1–P4a: no digit outside the GEOMETRY / FORMATS blocks.
- `js/conv/epms-internals.js` 1.1.0 gains three functions:
  - `breakerUnits(sheet, state, res, scope)`: scope is the board (E-S-102) or the voltage level (E-S-101), per I6.
  - `relayUnits(sheet, state, res)`.
  - `boardUnits(sheet, state, res)`.

  `unitOf()` routes `cbIec`/`cbDrawout` → breaker, `protectionRelay` → relay, `switchgear` → switchboard.
- Operate from the modal (settled by P4b-0, M11/M12): the modal gains an action footer that renders
  `payloadFor(i).custom` as buttons. A button dispatches the page's existing handler by name (`epmsSimSwitch`,
  `epmsLvSelect`, `epmsLvExecute`, `epmsLvCancel`, `epmsTcc`, `epmsLvTcc`), the same registry the inspector uses.
  After the handler returns, the modal calls `refreshInt()` at once rather than waiting for the 4 s timer. The page
  keeps every safety rule because it still owns the handlers.
- Source note (M13): `opts.internal.source` (a string) replaces the default "fleet row … plant cooling values" note.
  The EPMS pages pass "the E-S-101 / E-S-102 simulation solve". The fix applies to the P4a classes too.
- Cross-navigation (I5, trip link): `opts.internal.goto(classKey, id)` swaps the modal's class and fleet in place and
  pushes a breadcrumb. It is a new modal API, so its code and its test ship together.

## 7. Laws (`tools/test-conv-internals-p4.mjs`, extended; node + browser)

| law | claim | proof |
|---|---|---|
| EB0 | Every breaker, relay and board on both sheets (all four halls) maps to a unit: 129 + 28 + 16 = 173 | node: `unitOf` non-null for each node of those syms. Red before the code: 0 of 173 |
| EB1 | Every engine-basis row equals the engine (tolerance from the printed decimals); every NM row is declared; no number lacks a source | node, same scheme as EL1 |
| EB1b | Digit law on breaker.js, relay.js, switchboard.js | node |
| EB2 | One click opens the drawing for CB-FA4, CB-LVA, CB-UIAA, R-FA4, R-T1, R-BB, R-LVAA, LVMSB-AA, MVSB-AA at 1440 and 390 | browser |
| EB3 | Drawn values equal `read()` equals the sheet: position, kW and A of the breaker; board feeder rows equal the solve | browser + node |
| EB4 | Operating from the modal: open CB-UIAA (select, then execute) turns its position OPEN in the drawing, on the sheet, and in UPS-AA's mode (BATTERY) without closing the modal. Closing CB-ES1 (earthing) on a live feeder is refused with the sheet's reason and the position does not change | browser |
| EB5 | A relay draws exactly the functions in its `name` (R-T1: 87T and 50/51; R-FA4: 50/51 and 50N/51N); graded settings equal the engine; the other functions read "settings not modelled" | node |
| EB6 | No text overlap, no text outside the drawing, no line through text (EL5 rule) for all EB2 cases | browser |
| EB8 | The source note on every EPMS modal (TX, UPS, breaker, relay, board) names the single-line solve, never "plant cooling values" | browser |
| EB7 | A feeder row click on LVMSB-AA moves the modal to that breaker, Back returns. The trip link on CB-FA4 moves the modal to R-FA4 | browser |

Red before green: each law runs on the P4a tree first and must fail there. Mutations:
- swap the LSIG Ir key for Isd;
- draw a function the relay does not have;
- drop the `refresh` call after an operation;
- take board feeder kW from the design load.

## 8. Phases inside P4b

1. P4b-0: measurement. Count the breakers, relays and boards again on the P4a tree, write the EB0 red, and settle
   the modal refresh path (does a custom action refresh the modal?).
2. P4b-1: breaker class, adapter, EB0, EB1, EB1b, EB2, EB3 for breakers.
3. P4b-2: relay class, EB5, TCC button inside the relay modal.
4. P4b-3: switchboard class, EB7 navigation (the new `goto` API).
5. P4b-4: operate from the modal, EB4.
6. Release v3.93.0, done the same way as P4a:
   - full Conventional gate on lane 2;
   - live check;
   - screenshots at 1440 and 390 of CB-FA4, R-T1, LVMSB-AA, CB-UIAA after it opens, each looked at;
   - CHANGELOG, standards item 23f, ledger row R186-P4b, CLAUDE.md modal row.

## 9. Risks

| risk | answer |
|---|---|
| 27 breaker tiles per hall overflow the unit strip | I6 scope: one board's breakers per strip (≤ 9) |
| Operating from the modal bypasses select-before-operate | the modal only renders the page's own `custom` buttons, so SBO is unchanged (EB4 proves the two-step on E-S-102) |
| A relay showing TRIPPED after a manual open would teach a wrong cause | trip state fixed "normal" with a NM reason until a protection-trip simulation exists |
| `goto` grows the modal API | one function, tested by EB7; no other modal change |
| The browser gate time grows (9 cases × 2 widths) | one page load per width per sheet, cases clicked in sequence with Escape between them, as E3 already does |

## 10. Before and after, for the operator

| before (P4a) | after (v3.93.0) |
|---|---|
| A click on CB-FA4 opens a list of values | A click on CB-FA4 shows the contacts, vacuum chamber, mechanism, coils, CT, trip link to R-FA4 and interlocks, with live position and current |
| A relay is a tag and an ANSI string | The relay shows its function blocks, the graded settings where the engine has them, and its trip output to the breaker |
| LVMSB-AA is a box on the sheet | LVMSB-AA shows incomers, bus sections, tie and feeders with live kW; a feeder row opens that breaker |
