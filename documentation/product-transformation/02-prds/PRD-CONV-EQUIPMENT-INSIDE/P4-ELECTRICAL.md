# PRD-CONV-EQUIPMENT-INSIDE · P4 — the inside of the electrical plant (EPMS_Telemetry)

Status: APPROVED by standing order (owner 2026-11-22: "Continue to improve, selalu rancang prd yang sangat detail dan
comprehensive dan sempurna"; "Jangan tanya saya"). Parent: `PRD.md` §6.5, §8, §9. Builder: the session that shipped P1–P3.
Release plan: P4a + P4b v3.93.0 (one release; a peer release took v3.92.0), P4c v3.95.0 (renumbered in the parent §9).
Built: P4a (v3.93.0) — `js/conv/internals/transformer.js`, `ups.js`, `js/conv/epms-internals.js`, engine 2.6.0, `epms-lv.js` 1.2.0 / `epms-sim.js` 1.2.0, gate `tools/test-conv-internals-p4.mjs`. Review fixes in the same release: UPS loss proportional to the inverter output (two-pass solve), mode from the sheet's predicates, breaker current from the breaker, no loss on a dead transformer.

## 0. The owner's request, applied to the electrical page

R186: "Saat block di klik itu harus ada diagram dari equipment itu … klik chiller 1 ya keluarnya proses di dalamnya."
P1–P3 did this for the chiller plant. On `EPMS_Telemetry.html` a click on a transformer, a UPS or a breaker still opens
the side inspector, which lists values and has no drawing of the machine. P4 makes the same click open the equipment
modal on the inside of that machine. The modal draws its parts, shows how power flows through them, and gives a number on
each part only where the engine or the page simulation computes one.

## 1. Measured state (tree c0dd01dbf, engine 2.5.0, 2026-11-22)

| # | fact | evidence |
|---|---|---|
| M1 | E-S-101 (HV/MV single-line) has 137 nodes: junction 43, cbIec 21, protectionRelay 20, currentTransformer 14, disconnector 12, offSheet 10, transformer2w 4, utilitySource 2, surgeArrester 2, voltageTransformer 2, earthSwitch 2, resistor 2, earth 2, generatorIec 1 | `RZEpmsSheets.sld.nodes` counted in node |
| M2 | E-S-102 (LV/UPS view, per hall) has 93 nodes: junction 36, cbIec 27, generatorIec 8, switchgear 4, offSheet 4, transformer2w 2, protectionRelay 2, utilitySource 2, rectifier 2, batteryIec 2, inverterIec 2, staticSwitch 2 | `RZEpmsLv.build(0, snapshot, getFleet('genset','A'))` |
| M3 | One click on any node opens `RZInspector` with `RZConvTruth.sheetPayload(...)`; breakers carry `SIMULATION · Open/Close`; protected devices carry `Time–current curves` (`RZConvTccModal`) | `EPMS_Telemetry.html` `payload(n)` (≈ line 1353) |
| M4 | `RZConvInternals` has no electrical class; `CONV_CALC.fleetKinds` = chiller, chw_primary_pump, chw_secondary_pump, cdw_pump, tower_cell, crah, genset | node |
| M5 | The engine publishes 93 `electrical.*` keys: UPS (η 0.96, module 1250 kW rated, 32 per system, 2 systems, 2N, load 37.5 % / 75 % on fail-over), HV (150 kV, 2 × 63 MVA, 12.5 % Z, 36.3 % load, N-1 72.7 %), MV (20 kV, 13.5 kA, NGR 12 Ω, 962 A earth fault), distribution (40 × 3150 kVA, 7 % Z, 48.5 % normal / 96.9 % contingency, LV 59.25 kA), protection (curves, pickups, TMS, operate times for LV/feeder/incomer/HV) | `CONV_CALC.snapshot.electrical` |
| M6 | The page simulation gives per device `{energised, kw, a, pct}` (e.g. TX-AA 5437.5 kW, 165.2 A, 36.34 %; REC-AA 3750 kW; INV-AA 3750 kW; BAT-AA 0 kW) | `RZEpmsLv.solve(...)` |
| G1 | **The UPS is lossless in the simulation** (REC-AA in = INV-AA out = 3750 kW) while the engine says η = 0.96 (site loss 1250 kW = 30 000 × (1/0.96 − 1)). The loss is booked inside the stream's "mech" load (`epms-lv.js` line 160 label). A UPS inside that shows P_in = P_out would contradict the engine | node output above, `upsLossKw()` |
| G2 | Battery autonomy is not in the engine; E-S-102 already labels BAT "autonomy not modelled" | `epms-lv.js:126` |
| G3 | No transformer loss parameter exists (no P0, no Pk) | grep `js/conv-engine.js` |
| G4 | The distribution transformer type (liquid-immersed or dry) is not stated; `dist_tx_kva: 3150` is ASSUMED (plan E-1) | `js/conv-engine.js:754` |
| G5 | Relay settings exist only for the four graded devices (LV LSIG, 20 kV feeder, 20 kV incomer, 150 kV transformer bay); 87L, 21, 87B, 87T, 50BF and 51G carry no setting | `pro_*` keys |
| G6 | **One distribution transformer, two loads.** The simulation loads a unit at 36.34 % (adopted hall load 5437.5 kW per stream / 5 units / (3150 kVA × 0.95)). The engine's `dist_tx_load_pct_normal` is 48.5 % because it uses the hall DESIGN load (`hall_facility_design_kw` 14 500 / 2 streams / 5 units). Each is right for what it measures. A modal that mixed them would show two loads for one machine | node: `res.dev['ta-tx'].pct` 36.34; snapshot 48.5 |

## 2. Goal and non-goals

Goal: one click on a transformer, a UPS (any of its four symbols), a breaker, a relay or a switchboard on E-S-101 or
E-S-102 opens `RZConvModal` on that machine's INSIDE. Every number equals the page simulation or the engine, and the
modal and the sheet show the same value for the same point (TR1). Anything not computed reads "not modelled", and §6
gives the reason for each.

Non-goals:
- No transient, harmonic or arc-flash model.
- No thermal model of a transformer. IEC 60076-7 parameters are not freely available, so top-oil and hot-spot read
  "not modelled".
- No battery discharge curve.
- No new switching logic. Open and close stay the existing interlocked `SIM.operate`.
- No change to the TCC modal. The modal links to it.

## 3. Interaction (same as P1–P3, with one electrical rule)

| rule | behaviour |
|---|---|
| E1 | One click (or Enter) on a node whose class is registered opens the modal on the INSIDE tab. The inspector does not open |
| E2 | A UPS is one machine drawn as four symbols. A click on REC, INV, BAT or SS opens the UPS inside of that unit (UPS-AA) with the clicked part focused (outline + its value row first) |
| E3 | A breaker inside keeps the operator actions the inspector had, as modal buttons: `Open` / `Close` (calls the page's `operate(id)`, interlock refusal shown in the modal's state line) and `Time–current curves` (opens `RZConvTccModal`, focus returns to the modal on close) |
| E4 | After a switching command the modal repaints from the new `res`; no second source of state |
| E5 | Nodes without an inside (junction, earth, offSheet) keep their current behaviour; the census gate lists each with its reason |
| E6 | Unit navigator: transformers TX-1, TX-2, TX-DA, TX-DB (E-S-101) / TX-AA, TX-AB (E-S-102); UPS UPS-AA, UPS-AB; breakers by bay. The fleet comes from the page simulation adapter (§7), never from `getFleet` |
| E7 | The EPMS page is dark only (`theme: 'dark'`), as the TCC modal is today |

## 4. Classes, depth and the drawing of each

Depth: D1 ≥ 8 internal blocks, D2 ≥ 6, D3 ≥ 3 (parent IN1).

### 4.1 `hv_tx` (TX-1, TX-2) and `dist_tx` (TX-DA, TX-DB, TX-AA, TX-AB) — D1

Built as two classes from one drawing, because their ratings, cooling, neutral and loss rows differ (`js/conv/internals/transformer.js`).

Blocks:
- HV bushings and HV winding (delta).
- Core (three-limb).
- LV winding (star, neutral brought out to the NGR on TX-1/2 and to the LV N/PE on the distribution units).
- Off-circuit tap changer (distribution) or on-load tap changer (TX-1/2, drawn as OLTC, state "not modelled").
- Cooling: ONAN radiators for TX-1/2 and AN for a dry-type distribution unit.
- Protection devices: Buchholz relay and pressure-relief for TX-1/2; winding temperature sensors (PT100) for a dry unit.
- Upstream breaker and downstream breaker, as off-sheet arrows naming the real tags.

Flows: power HV → core → LV. The loss is drawn as a heat arrow out of the core (P0) and the windings (Pk·L²).

### 4.2 `ups` — D1 (UPS-AA, UPS-AB per hall)

Blocks:
- Input breaker CB-UI.
- Rectifier (AC/DC).
- DC bus.
- Battery breaker CB-BAT and battery strings.
- Inverter (DC/AC).
- Static bypass switch (SS).
- Maintenance bypass (drawn, state "not modelled").
- Output breaker CB-UO.

Modes come from the page simulation:
- NORMAL: rectifier → inverter.
- BATTERY: battery → inverter, because the simulation's `state.batt` is derived.
- BYPASS: SS closed.

The active path carries the flow token. Idle paths are drawn at idle weight.

### 4.3 `breaker` — D2 (cbIec on both sheets; measured 129, see `P4b-BREAKER-RELAY.md`, which governs P4b)

Blocks:
- Main contacts (3 poles).
- Arc-quenching chamber: SF6 at HV, vacuum at MV, air at LV (from the node's `kv`).
- Stored-energy spring mechanism.
- Trip coil and close coil.
- Trip unit or relay link: the LV main draws an electronic trip unit LSIG; an MV/HV breaker draws a wire to its relay tag.
- Current transformer.
- Auxiliary contacts.
- Interlocks: the earthing switches and disconnectors from `n.es` / `n.ds` / `n.cb`, drawn as interlock lines with their tags.

### 4.4 `relay` — D2 (protectionRelay; measured 28)

Blocks:
- CT inputs.
- VT input, for the 21 relay only.
- Measuring element.
- Function blocks, one per ANSI code from `n.name` (87L, 21, 87T, 50/51, 50N/51N, 50BF, 87B, 51G, LSIG).
- Trip logic.
- Trip output to the breaker tag.
- Self-supervision (watchdog), state "not modelled".

### 4.5 `switchboard` — D2 (switchgear MVSB-x, LVMSB-x)

Blocks: incomer(s), busbar section(s), bus tie, outgoing feeders, metering. Each feeder is a row with its simulated kW
and A. Clicking a feeder row navigates the modal to that breaker (breadcrumb `LVMSB-AA › CB-UI`).

### 4.6 D3 classes (P4c)

| class | blocks | values |
|---|---|---|
| disconnector | blade, contacts, motor or hand operator | position (simulation) |
| earthSwitch | blade, contacts, interlock | position, interlock list |
| currentTransformer | primary, core, secondary, burden | ratio not modelled |
| voltageTransformer | primary, core, secondary | 150 kV / 0.11 kV class |
| surgeArrester | MOV stack, counter | not modelled |
| resistor (NGR) | resistor element, CT, 51G | 12 Ω, 962 A |
| utilitySource | line, metering | voltage, fault level |
| generatorIec | reuses the existing `genset` class | P4c rule below |

The generator rule: the EPMS run state overrides the fleet state, so the modal and the sheet agree (TR1).

### 4.7 No inside, with a reason (IN2)

| class | reason |
|---|---|
| junction | a drawing point |
| earth | a reference |
| offSheet | a continuation to another sheet; the click keeps navigating there |

## 5. Engine 2.6.0 (additive; no 2.5.0 key changes)

| key | value | class | source |
|---|---|---|---|
| `electrical.dist_tx_type` | `'dry'` | ASSUMED | indoor unit substation, cast resin (IEC 60076-11); with `dist_tx_kva` an E-1 plan assumption |
| `electrical.dist_tx_p0_w` | 3420 | AUTHORED | Regulation (EU) No 548/2014 Annex I Table I.2, 3 150 kVA, Tier 2 (1 July 2021), maximum no-load losses (Um ≤ 24 kV / ≤ 1.1 kV, so Table I.3 gives no correction for 20/0.4 kV) |
| `electrical.dist_tx_pk_w` | 22000 | AUTHORED | same row, maximum load losses |
| `electrical.hv_tx_pei_min` | 0.99745 | AUTHORED | same regulation Table I.7, liquid-immersed large power, 63 MVA, Tier 2 |
| `electrical.dist_tx_loss_kw_normal` | P0 + Pk · L², L = `dist_tx_load_pct_normal`/100 | DERIVED | IEC 60076-1 loss split; L² scaling of load loss |
| `electrical.dist_tx_eff_normal` | P_out / (P_out + loss), P_out = S · L · pf | DERIVED | definition |
| `electrical.ups_system_in_kw` | `ups_system_kw / ups_efficiency` | DERIVED | same rule as `upsLossKw()` |
| `electrical.ups_system_loss_kw` | `ups_system_in_kw − ups_system_kw` | DERIVED | idem (sum over systems = `ups_loss_kw`) |

The Tier 2 values are regulatory maxima. The modal labels them "≤ EU Tier 2". A loss computed from them is an upper
bound, shown with "≤". The basis tab says why: no vendor test report exists for the assumed unit.

The TX-1/2 losses are not modelled. Only a PEI floor is published, and splitting it into P0 and Pk needs a ratio
nobody has stated. The modal shows "PEI ≥ 99.745 %" as a constant.

Transcription law: `data/sources/eu-548-2014/README.md` quotes the three rows verbatim, with URL and access date (fetched
2026-11-22 from `eur-lex.europa.eu/eli/reg/2014/548/oj/eng`). A node test reads that file, not the engine, and compares
it with the engine. Two independent transcriptions must agree (memory: a register cannot catch a transcription error).

G6 rule:
- The engine keys `dist_tx_loss_kw_normal` and `dist_tx_eff_normal` are at DESIGN load. The basis tab says so.
- The modal's loss and η use the SIMULATED load of the opened unit (P0 and Pk from the engine, L from SIM), labelled
  "at present load".
- The design-load pair appears once, as the row "at design load".

Hand checks per distribution unit, default scenario:
- Design load, L = 0.4850: loss ≤ 3.42 + 22 × 0.4850² = 8.595 kW; P_out = 3150 × 0.4850 × 0.95 = 1451.4 kW;
  η ≥ 99.41 %.
- Present load (SIM), L = 0.3634: loss ≤ 3.42 + 22 × 0.3634² = 6.325 kW; P_out = 1087.5 kW; η ≥ 99.42 %.

The gate recomputes these numbers. It does not copy them from this PRD.

## 6. Truth table (every value on every drawing)

Each value comes from one of three sources:
- SIM: the page simulation, `res.dev[id]`.
- ENG: the engine snapshot key.
- NM: not modelled. Each NM row gives its reason.

### 6.1 transformer

| value | source |
|---|---|
| state, kW, A (HV side), load % | SIM |
| rating MVA/kVA, impedance %, voltage ratio | ENG `hv_tx_mva`/`dist_tx_kva`, `*_impedance_pct`, `hv_voltage_kv`/`mv_voltage_kv`/`lv_voltage_v` |
| full-load current | ENG `hv_tx_fla_a`, `mv_tx_fla_a`, `dist_tx_fla_mv_a`, `dist_tx_fla_lv_a` |
| N-1 / contingency load | ENG `hv_tx_load_pct_n1`, `dist_tx_load_pct_contingency` |
| P0, Pk, loss at the simulated load, η | distribution unit: ENG (§5) applied to the SIM load % ("≤"). TX-1/2: NM, because only the PEI floor is published |
| through-fault level | ENG `mv_fault_level_ka`, `lv_fault_level_ka` |
| top-oil and hot-spot temperature | NM: IEC 60076-7 thermal constants not available to the engine |
| tap position | NM: no tap model |
| Buchholz and pressure-relief state | NM: no gas or pressure model |

### 6.2 ups

| value | source |
|---|---|
| mode (NORMAL / BATTERY / BYPASS), each block energised | SIM |
| P_out (inverter) | SIM |
| P_in (rectifier) | SIM after G1 fix: P_out / η |
| loss | P_in − P_out, with T3 balance ≤ 1 % against ENG `ups_system_loss_kw` scaled to the stream |
| η | ENG `ups_efficiency` (flat; part-load curve NM: no free source of a curve) |
| load % | SIM P_out / unit rating (rating = modules per hall × `ups_module_kw_rated`) |
| modules, module rating, redundancy | ENG |
| battery autonomy, state of charge, DC bus voltage, string count | NM: no battery model (G2) |
| maintenance bypass position | NM: not drawn on the sheet |

### 6.3 breaker

| value | source |
|---|---|
| position, kW, A | SIM |
| interrupting medium | from `kv` (drawing class, not a number) |
| LV trip unit Ir, Isd, tsd, tr | ENG `pro_lv_ir_a`, `pro_lv_isd_a`, `pro_lv_tsd_s`, `pro_lv_tr_s` |
| MV/HV pickups | via the linked relay (§6.4) |
| breaking capacity | ENG `hv_switchgear_rated_ka` at HV. MV and LV are NM: no rated breaking capacity in the engine |
| interlocks | the node's `es`/`ds`/`cb` lists, with the live position of each from SIM |
| operation counter, contact wear, spring charged | NM |

### 6.4 relay

| value | source |
|---|---|
| graded functions (LV LSIG, feeder 50/51, incomer 50/51, HV bay 50/51) | ENG `pro_*_is_a`, `pro_*_tms`, `pro_*_curve`, `pro_*_t_s` for the device whose `n.prot` names it |
| 87L, 21, 87T, 87B, 50BF, 51G | each function block is drawn; its settings are NM (G5) |
| trip state | SIM: the breaker it trips is open with no command, so the relay is "tripped". Otherwise "normal" |

### 6.5 switchboard

Feeder rows show SIM kW and A. The busbar rating is NM.

## 7. Architecture

- New files:
  - `js/conv/internals/transformer.js` and `js/conv/internals/ups.js` (P4a).
  - `breaker.js`, `relay.js` and `switchboard.js` (P4b).
  - `electrical-d3.js` (P4c).
  - Each file follows the class contract: GEOMETRY and FORMATS blocks, no number literal elsewhere,
    `R.register(classKey, {…})`, `basis: 'electrical.<key>'`, `R.NOT_MODELLED`.
- The EPMS page passes a fleet adapter in the modal call:
  `opts.internal = { classKey, fleet: () => units from SHEET + sim + res, unitIndex, focus }`.
  The adapter is the only reader of `res` for the modal, which is how TR1 holds.
- `js/conv/epms-lv.js` 1.2.0 (G1). Version 1.1.0 is unchanged in its API.
  - The UPS rectifier draws P_out / η from the bus.
  - The stream's mech load drops by the same UPS loss.
  - The transformer load is therefore unchanged. Law EL-G1 is the regression check.
- `chwDeepOpts` equivalent: `epmsDeepOpts(n)` decides "inside" (registered class) or "inspector" (not registered).
  Rollout is per class with no flag, so a half-built class never opens (IN1x).
- Engine 2.6.0:
  - Bump the version pins on every page that pins the engine in the same release (memory: an unbumped pin blanks
    the cockpits).
  - Add curated registry entries for the 8 new keys.
  - Rebuild the registry.

## 8. Laws and gates (`tools/test-conv-internals-p4.mjs`, node part + browser part, `--node-only`, `--width=`)

| law | check |
|---|---|
| EL0 | The engine 2.6.0 keys exist and equal their formulas. `ups_system_loss_kw` × systems = `ups_loss_kw` within 0.1 kW. Distribution loss and η match the hand recomputation in the test (not copied from the PRD) |
| EL0s | The source file quotes Table I.2 3 150 kVA Tier 2 = 22 000 / 3 420 W and Table I.7 63 MVA Tier 2 = 99,745. The engine equals the file |
| EL-G1 | After the epms-lv 1.2.0 change: REC-AA kW = INV-AA kW / η within 0.1 kW. TX-AA kW is unchanged against 1.1.0 (5437.5 at default). The sum served at each stream is unchanged |
| EL1 | Every registered class has blocks whose engine-basis values equal the engine, and every NM row is in the declared list per class. Ratchet: NM count per class ≤ declared |
| EL1b | No number literal outside GEOMETRY/FORMATS (same regex as P3-1b; a planted literal must turn it red) |
| EL2 | One click on TX-1, TX-DA (E-S-101) and on TX-AA, REC-AA, INV-AA, BAT-AA, SS-AA (E-S-102) at 1440 and 390 opens the modal INSIDE with ≥ 8 blocks. REC/INV/BAT/SS all open UPS-AA, each with its own part focused. The inspector stays closed |
| EL3 | Drawn values = adapter `read()` = the sheet's own value for the same device (TR1). The present-load loss uses the SIM L, never the engine's design L (G6) |
| EL4 | Switching: open CB-UI-AA in the modal. Mode turns BATTERY, BAT kW > 0, the drawing repaints, and the sheet shows the same. Close CB-UI-AA. An interlock refusal (closing an earthed feeder) shows the refusal reason in the modal P4a proves the solve side in node (open CB-UI → BATTERY, battery kW > 0, the drawing reads BATTERY); the modal buttons and the browser round trip come with P4b (E3) |
| EL5 | No text overlap, no text outside the drawing, at both widths Built: also no edge path through a text box (sampled every 2 units in screen space) |
| EL6 | Modal readings: the declared NM rows read "not modelled" (transformer temperatures, battery autonomy). No page errors |
| EL7 | Breaker and relay (P4b): the LV LSIG values equal `pro_lv_*`. The feeder relay shows `pro_feeder_is_a`, TMS and t. The TCC button opens `RZConvTccModal` and focus returns |
| EL8 | Census (IN2 extended to EPMS): every symbol kind on both sheets is registered or listed in §4.7 |
| A11Y/PERF/TXT | Parent laws: axe 0 serious, open ≤ 300 ms p95, no sentence in the drawing |

Red first:
- EL2 and EL3 on c0dd01dbf: no class, so no drawing.
- EL0 and EL0s on engine 2.5.0: the keys are missing.
- EL-G1 on epms-lv 1.1.0: REC = INV.
- EL1b with a planted literal.

The gate line goes into `tools/ship-gate.sh` beside the P3 line, so it is in the Conventional release list.

## 9. Phases

| phase | content | release |
|---|---|---|
| P4a | engine 2.6.0 keys + source file, epms-lv 1.2.0 (G1), transformer + ups classes, adapter, EL0–EL6 | v3.93.0 |
| P4b | breaker, relay, switchboard classes, modal operator buttons (E3), EL7 | v3.93.0 |
| P4c | D3 classes, generator on EPMS, census EL8 at 100 % for EPMS | v3.95.0 |

Each release:
- Full Conventional release gate on lane 2.
- Live check of `rz-version.js`.
- Screenshots of the modal (TX-AA, UPS-AA in NORMAL and BATTERY) at 1440 and 390, looked at.
- CHANGELOG, `CONVENTIONAL_DC_OPERATIONS_STANDARD` item, `UIUX_AUDIT_LEDGER` row R186-P4x, CLAUDE.md modal row.

## 10. Risks

| risk | control |
|---|---|
| G1 changes a number operators already see (REC kW) | EL-G1 keeps the TX and stream totals equal; the changelog names the change |
| "≤ Tier 2" read as a measured loss | "≤" on every derived loss, and the basis tab text |
| EPMS is the heaviest cockpit (sheet perf budget) | modal draws once per open; repaint only on `rz-epms-change` or the page tick; sheet-perf gate in the release list |
| A peer session ships EPMS changes mid-gate | port procedure from memory (reset to origin, re-apply my files, regenerate) |
| The TCC modal and the equipment modal open together | E3: the TCC modal opens above; Esc closes the top one first; EL7 checks focus |

## 11. Before → after for the operator

| before | after |
|---|---|
| A click on TX-AA lists values in a side panel | The transformer opens with its windings, core and cooling. Load, losses ("≤ EU Tier 2") and efficiency are written on the parts |
| A UPS is four symbols, each opening its own list | One UPS opens. The power path lights up NORMAL, BATTERY or BYPASS. Loss = in − out agrees with the engine |
| A breaker's trip settings are only in the TCC modal | The breaker shows its contacts, mechanism, trip unit and interlocks. Open/Close and the TCC are one button away |

## 12. Owner decisions (defaults stand, recorded)

| id | decision | default |
|---|---|---|
| D-P4-1 | Distribution transformer type | dry-type cast resin (ASSUMED, labelled). Changing it to liquid means Table I.1: 23 000 / 1 980 W |
| D-P4-2 | Show regulatory maxima as losses | yes, with "≤", until a vendor test report exists |
| D-P4-3 | Move the UPS loss from the mech load to the UPS input (G1) | yes; totals unchanged |

Nothing is needed from the owner to start P4a.
