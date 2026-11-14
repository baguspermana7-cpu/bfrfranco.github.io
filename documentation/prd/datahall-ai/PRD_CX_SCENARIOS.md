# PRD — Commissioning scenarios on the HMI drawings (R135)

Status: CONCEPT + PRD, written 2026-11-14 · owner request R135 · execution **after** the R128–R134 visual redraw is
accepted ("ini di akhir aja setelah secara design visual dll sudah selesai semua") · shared by two sessions:
`datahallAI.html` (this session) and `datahall.html` + the Conventional family (peer session).
Companion: `PRD_DATAHALL_DRAWINGS.md` (sheets, symbols, modals, shell), `standarization/CX_ANALYSIS_STANDARD.md`,
`standarization/ACCURACY_VALIDATION.md`, `cx-handbook/28-integrated-systems-testing.html`.

## 0. What the owner asked (verbatim, Indonesian)

"ini di akhir aja setelah secara design visual dll sudah selesai semua, akan ada pilihan scenario based on Cx engine
failure scenario and see the respond. yang sudah ol yang electrical di dcconventional itu kan ada ya utility fail itu
respond system bagaimana, tapi memang ada yang perlu di improve, dan beberapa scenario2 utk melihat performa system,
P&ID setting dll. agar commisoining bisa di simulasikan pada engine dcai dan dcconventional. yang dc conventional akan
dilakukan oleh ssession lain" — then: "plan mode, sempurnakan konsep dan prd nya more detail dan comprehensive".

Read as: (1) a scenario selector whose scenarios are the Cx engine's failure scenarios; (2) the drawings show the
system response in time; (3) several scenarios, for system performance and for P&ID settings (setpoints); (4) the
same on both engines so commissioning can be simulated; (5) the existing utility-fail response needs improving.

## 1. What exists today (measured in the tree, 2026-11-14)

| Piece | Where | State |
|---|---|---|
| Scenario library S00–S30 (trigger / expected response / measured quantities / pass / abort), acceptance values with sources, abort table, worked scripts S01-S02, S16, S28, five-day plan, dependency map | `cx-handbook/28-integrated-systems-testing.html`; source `data/cx-handbook/chapters/28_integrated_systems_testing.md` (§28.7.1 :365, §28.8.1, §28.9 :423–470, §28.11–28.13 :545–626); `data/cx-handbook/figures_manifest.json` F28-2 (dependencies), F28-3 (S01 trends) | prose tables and one SVG; **no JSON, no code reads them**; values are MSC-1 worked-example values ("a project replaces them with its own OPR", :423) |
| IST planning templates: 10 `ist-*` ids with `appliesFrom`, `systems[]`, `acceptance`, `observe` | `rz-engine.js:7091` `DATA.commissioning.istScenarios` (source :9409) | read only by DCMOC `CommissioningEnginePage.tsx` |
| Electrical scenarios on **datahallAI** (`#electricalScenario`: normal, utility_a_fail, utility_b_fail, ups_a_bypass, busway_a_trip, genset_pool_start_failure, rack_psu_a_loss, transfer_failure) | `js/datahall-ai/electrical-topology.js` SCENARIOS :364–470, enums :27–37, `createState`/`validateState` :511–578, `evaluate` :860, `health` :841 | the `patch` is applied at T0 as a **final state**; `timeline[]` offsets (T+1 ATS sense, T+10 genset running, T+15 transfer) are only printed by `operator-ui.js:406–410`; UPS enum `online|bypass|fault|maintenance` has **no `battery`**, no state of charge; no pass/fail, only `health` NORMAL/DEGRADED/CRITICAL |
| Cooling scenarios (normal, cdu-pump-fail, chiller-trip, leak-z07) | `js/datahall-ai/hmi-payloads.js:58–63` | static flags, affect open payloads only, no time, no recovery |
| Fire cause-and-effect staged run (14 events × 12 zones) | `js/datahall-ai/fire-cause-effect.js` (`evaluateEvent` → commands / pending / blocked; only `CE-SUPPRESSION-RELEASE` has `delaySeconds 30`), `fire-points.js` STAGES :121, `stageOf` :240 (`RELEASE_DELAY_S 30`, `LOCKOUT_AFTER_S 300`), `fire-workstation.js startRun(eventId, zoneId)` :335 (one event; elapsed = ticks × 4 s) | works and is deterministic; tick-granular; one event per run; no acceptance record |
| Clock | `js/datahall-ai/sim-telemetry.js` `TICK_MS 4000`, `tickNow()` honours `window.__rzSimTick` :59–63; provider seam `setProvider` :114 (single slot, stamps `quality:'replay'` :103–108) | deterministic, 4 s granular |
| Alarms workspace | `js/datahall-ai/alarm-query.js validateEvents` :351 (required `id, timestamp, tag, point, location, system, severity ∈ critical/high/medium/low/info, lifecycle, kind, quality, event, action, scenario, operator, message, incidentId, sequence`; optional `runId`); `RZDatahallAIAlarmWorkspace.appendEvents` (`operator-ui.js:219`) | schema ready; today only the fire module emits (`fire-workstation.js:61–67`) |
| Records (Cx Tier 3) | `data/cx/demo-records.json` steps `{expected:{min,max,unit}, measured_value, instrument_id, mandatory, result}`; `js/rz-cx-records.js validate()` :31–98 | shape ready; `validate()` never compares expected to measured; `db.scenarios` already means plan what-ifs (`rz-cx-plan.js` `rz-cx-scenarios`) |
| HMI renderer (R128) | `js/rz-hmi-sheet.js` `update()` :264 (node `data-state`, value `data-alarm`, edge `data-flow` through `opts.flow(e)`), `trace(id, dir)` :289; `js/datahall-ai/hmi-v2.js read()/stateOf()` :129–142 hard-code breaker `closed` (except tie / maintenance bypass) and transformer `energized`; repaint on a 4 s `setInterval` :177 | the paint hooks exist; nothing feeds a scenario into them yet |
| Conventional **datahall.html** | `js/conv-engine.js` only | **no scenario selector at all** (the owner's "utility fail" lives on datahallAI); `crah_n1_available_kw` equals `crah_available_kw` (conv-engine.js:857–858) so "N+1 PASS" is the normal capacity check; `autonomyN1Hr(level){ return autonomyHr(level); }` (fuel-system.html:1136); fire-system.html countdown decrements 5 per second while labelled 1 Hz (:1597–1599); chiller-plant `degraded` = static CH-2 fault; the snapshot has no generator count and no battery runtime |
| Engine facts available | dcai `equipment.cdu_duty_per_hall`, `cdu_installed_per_hall` (= duty + 1), `cdu_duty_per_unit_kwth`, `cdu_flow_per_unit_lpm` (dcai-engine.js:384–395), `chillers_running_design/worst_bin/installed` (:396–399), `gensets_duty/installed/standby`, `generator_unit_kw` (:422–427), `ups_frame_kw`, `ups_frames_per_feed/total` (:403–407), `battery_kwh` (:408), `hall_volume_m3` (:504), `site.fuel_autonomy_h` (:742); conv `electrical.ups_system_count`, `ups_module_count`, `ups_load_pct_on_failover` (conv-engine.js:809–826), `cooling.crah_*`, `chillers_*`, `chiller_n1_*` (:854–915), `fuel.autonomy_hr` (:939–956), `water_cp_kj_per_kg_k` (:846) | **not published anywhere:** UPS autonomy minutes (dcai `ups.runtimeMin 5` only inside `dcai-model.js:299`), generator start time, ATS transfer time, coolant or buffer-tank volume, thermal mass |

The gap is not a dropdown. It is **one scenario schema, one deterministic response engine with time, acceptance and
abort, and one console**, which both pages render from with their own plant model and their own drawings.

## 2. Concept

A **commissioning scenario** is a script from the handbook library: a trigger at T0 on named equipment, the expected
response, pass and abort values with their source, prerequisites. The **response engine** (`js/rz-cx-sim.js`, pure, no
DOM) runs the script against the page's plant model as a deterministic simulation in continuous time `t` (seconds):
sources, breakers, ATS, UPS on battery with state of charge, generator start / synchronise / pickup, standby pump start
and CDU flow redistribution, chiller anti-recycle restart, first-order thermal response of TCS supply and rack inlet
against the pass lines, fire cause-and-effect outputs, alarms. The **drawings** paint the response — the same sheets,
no second graphic — by the ISA-101 rule (grey is normal, colour only where state is abnormal). A **scenario console**
beside the sheet shows the sequence of events, measured vs acceptance, the abort watch, the verdict and, in later
phases, trends, settings and the filled record. **P&ID settings** are what-if knobs on the plant model (setpoints,
delays, autonomy), logged in the record. Everything is deterministic, replayable and exportable.

Reference behaviour (what commercial tools do, so the owner can compare): EcoStruxure IT impact simulation (which loads
are affected by a failure), Cadence Reality DC / 6SigmaDCX transient failure runs (how temperatures evolve after a unit
trips), ETAP electrical what-if; and the commissioning practice itself (Uptime IST, NFPA 110 start-time test, ISO
8528-5 G3 transient class, IEC 62040-3 class 1, ITIC curve, ASHRAE TC 9.9 envelopes) as written in the handbook
chapters 15, 16, 19, 20, 28.

## 3. Decisions (combine the best; the owner may overrule any of them)

1. **One shared schema and one shared engine core** for dcai and conventional; page adapters differ. The peer builds
   the conventional adapter and fixes the §12 findings (agreed by message 2026-11-14).
2. **Clock.** The sim owns float `t` (seconds) and it is the determinism key. Integration step 0.1 s for `t < 60 s`,
   1 s after. The sim tick is derived (`startTick + floor(t / 4)`) and *set* by the sim, never read back. Display speed
   ×1 / ×10 / ×60 changes only how fast `t` advances per wall second, never the integration step. A pinned `t`
   reproduces a run (gate pattern of `test-datahall-ai-fire-runtime.mjs` R7/R8, but pinning `t`).
3. **Pass and abort values are relative to the engine's design values** (`rack.inlet.max.c <= design.inletMaxC`,
   `rack.flow.min.lpm >= design.rackFlowLpm`). The handbook literal (139.2 L/min, 27 °C, 15 s …) is kept as
   `example.msc1` for display and for the parity gate, never as the limit — ACCURACY_VALIDATION rule 1 (one source
   of truth; the dcai hall is 9/12 CDUs per hall and 440 racks, not MSC-1's 4 CDUs per zone).
4. **Ship in handbook groups.** S00 baseline + S01 utility loss (+ S30 black start, same model) first; all 31 rows by
   the end. Scenario text lives in the JSON, never typed into a page (R128 text budget still applies).
5. **Console = right panel of the active sheet**, collapsible like the sidebar modes; the selector "Scenario ▾" sits
   in the sheet bar (`.hmi-bar`), one control per drawing.
6. **Event markers live in the console's SOE list, not on the sheet** (law H5, ≤ 25 words per sheet, stays intact).
7. **No second graphic, no second source.** The response is painted on the R128 sheets; values come from the engine
   snapshot, standards limits from `rz-engine.js DATA` with sources, sequence timings from the scenario JSON with their
   handbook clause.

## 4. Scope, ownership, non-goals

- **datahallAI.html** (this session): every tab that carries an HMI sheet after R128 — Electrical (DH-E-101), Cooling
  (DH-M-103, CDU modal), Fire (DH-F-10x), Network (DH-N-10x), Rack, Data Hall.
- **datahall.html + Conventional family** (peer): the same schema and core; their own drawings; §12 findings.
- **Non-goals:** real control (nothing writes to a device), AI, cost, CFD, any new engine of record.

## 5. Scenario schema v1 — `data/cx/scenarios/<Snn>.json`

Validated by a Node gate (§10, C1). One file per handbook row.

```json
{
  "id": "S01", "title": "Utility loss on both 20 kV incomers at 100 % load",
  "group": "utility-generator",
  "src": { "doc": "cx-handbook/28", "clause": "28.9.2", "row": "S01" },
  "ist": "ist-blackbuilding",
  "prerequisites": ["S00"],
  "load": { "pct": 100 },
  "durationMin": 90,
  "systems": ["utility", "ups", "generators", "switchgear", "chillers", "bms"],
  "initialConditions": [
    { "target": "source.utility.*", "state": "online" },
    { "target": "ups.*", "state": "online" },
    { "target": "source.genset", "state": "standby" },
    { "target": "chiller.*", "state": "running" }
  ],
  "trigger": [ { "t": 0, "target": "breaker.mv-incomer.*", "action": "open", "by": "relay test trip" } ],
  "expected": [
    { "t": [0, 1],   "target": "ups.*",         "state": "battery" },
    { "t": [0, 15],  "target": "source.genset", "state": "running" },
    { "t": [0, 30],  "target": "pump.chw.*",    "state": "running" },
    { "t": [0, 300], "target": "chiller.*",     "state": "running" }
  ],
  "pass": [
    { "q": "rack.pdu.lost",        "op": "==", "v": 0,                                          "src": "OPR; Uptime Tier III/IV objective" },
    { "q": "ups.out.v.dev.pct",    "op": "<=", "v": { "limit": "iec62040_3.class1" },           "src": "IEC 62040-3:2021 class 1" },
    { "q": "genset.first.ready.s", "op": "<=", "v": { "limit": "nfpa110.type10.s" },            "example": { "msc1": 10 }, "src": "NFPA 110 Type 10" },
    { "q": "genset.bus.closed.s",  "op": "<=", "v": { "setting": "sim.genset.busClosedMax.s" }, "example": { "msc1": 15 }, "src": "project value for the standby plant (handbook 28.7.1)" },
    { "q": "bus.f.dip.pct",        "op": "<=", "v": { "limit": "iso8528_5.g3.fDipPct" },        "example": { "msc1": 7 },  "src": "ISO 8528-5:2022 Table 4 class G3" },
    { "q": "ups.soc.min",          "op": ">=", "v": 0.30,                                       "src": "handbook 28.8.1 (battery reserve)" },
    { "q": "chiller.restart.s",    "op": "<=", "v": { "setting": "sim.chiller.antiRecycle.s" }, "example": { "msc1": 300 }, "src": "sequence of operation" },
    { "q": "rack.inlet.max.c",     "op": "<=", "v": { "design": "inletMaxC" },                  "example": { "msc1": 27 }, "src": "ASHRAE TC 9.9 recommended" },
    { "q": "tcs.supply.max.c",     "op": "<=", "v": { "design": "tcsSupplyMaxC" },              "example": { "msc1": 47 }, "src": "OPR / IT vendor liquid-cooling specification" },
    { "q": "alarm.p1.unexpected",  "op": "==", "v": 0,                                          "src": "alarm matrix (28.7.1)" },
    { "q": "recovery.autoRestored","op": "==", "v": true,                                       "src": "28.7.1 recovery row" }
  ],
  "abort": [
    { "q": "ups.soc.min",      "op": "<", "v": 0.30 },
    { "q": "rack.inlet.max.c", "op": ">", "v": 35, "forS": 60 },
    { "q": "tcs.supply.max.c", "op": ">", "v": 50, "forS": 30 }
  ],
  "settings": [
    "engine.ups.runtimeMin", "engine.tcs.supplySpC",
    "sim.utility.confirmDelay.s", "sim.ats.senseDelay.s", "sim.genset.firstReady.s", "sim.genset.busClosedMax.s",
    "sim.chiller.antiRecycle.s", "sim.thermal.tauTcs.s", "sim.thermal.tauInlet.s"
  ],
  "steps": [
    { "t": -900, "role": "test-director",  "action": "hold point 1: confirm load, loggers, positions", "expect": "all leads report ready", "hold": true },
    { "t": -300, "role": "controls-lead",  "action": "mark start of event on BMS and EPMS logs",       "expect": "marker logged" },
    { "t": 0,    "role": "electrical-lead","action": "open both incomers by relay test trip",           "expect": "incomers open; SOE events" },
    { "t": 1,    "role": "electrical-lead","action": "read UPS mode",                                  "expect": "all blocks on battery; no output gap" },
    { "t": 15,   "role": "electrical-lead","action": "read generator bus",                             "expect": "generators synchronised, bus closed" },
    { "t": 30,   "role": "mechanical-lead","action": "read pump and CDU states",                       "expect": "UPS-fed pumps ran through; others restarted" },
    { "t": 300,  "role": "mechanical-lead","action": "read chiller states",                            "expect": "trim chillers restarted after anti-recycle delay" },
    { "t": 900,  "role": "test-director",  "action": "hold point 2: temperatures and battery state",   "expect": "all inside pass values", "hold": true }
  ],
  "verdictRule": "fail on any continuity, thermal or time quantity → fail; fail only on alarm or recovery quantities → conditional pass with an issue (28.7.2); load below pct → void"
}
```

Field rules:
- `v` is a number **or** a reference: `{design: key}` (page engine design value, resolved by the adapter),
  `{limit: key}` (standards limit in `rz-engine.js DATA.commissioning.limits`), `{setting: key}` (a `sim.*`
  setting default from the JSON). `example.msc1` is display and parity only.
- `group` ∈ `utility-generator | ups | electrical | cooling | controls | fire` (S12 EPO is in the handbook's
  electrical table, :439).
- `roles` ∈ `test-director | electrical-lead | mechanical-lead | controls-lead | fire-lead | safety-officer`.
- `steps[].hold = true` marks a hold point (handbook §28.6). Negative `t` = before T0.
- Verdict ∈ `pass | fail | conditional | void` (handbook 28.7.2: void when the load or a prerequisite is missing).
- Dropped on review: `measured[]` (it is `pass.q ∪ abort.q`), `appliesFrom` (lives in `istScenarios`).

**Role grammar** (page-neutral; restricted to classes a page topology enumerates):
`<system>.<class>[.<feed A|B>][.<index>|*]`

| System | Roles |
|---|---|
| electrical | `source.utility[.A|B]`, `source.genset`, `breaker.mv-incomer[.A|B]`, `breaker.<controller>`, `ats[.A|B]`, `ups[.A|B]`, `busway[.A|B]`, `rack.group.<n>` |
| cooling | `cdu.<nn>[.pump.<n>]`, `chiller.<nn>`, `pump.chw.<nn>`, `pump.fws.<nn>`, `drycooler.<nn>`, `fanwall.<nn>`, `tank.buffer` |
| fire / leak | `zone.<id>`, `event.<eventId>` (the 14 C&E event ids), `leak.zone.<n>` |
| controls | `bms.server`, `bms.ring`, `bms.controller.<id>`, `epms.server` |

No duty words (`chiller.trim`, `pump.ups-fed`): no engine publishes duty roles; the adapter chooses the unit
(highest index of the running set) and names it in the SOE.

**Bindings** `data/hmi/bindings/<page>.json` — per role, three columns:

| Column | dcai example |
|---|---|
| topology override key | `breaker.mv-incomer.A` → `breakers['BR-MV-INCOMER-A']`; `source.utility.A` → `sources['SRC-UTILITY-A']`; `ups.A` → `ups['UPS-A']`; `ats.A` → `ats['ATS-A']`; `busway.A` → `busways['BUSWAY-A']` (`electrical-topology.js:99–106, 251, 412`) |
| sheet node id(s) | `cb-mvA`, `atsA`, `invA` + `batA`, `qbwA` (`hmi-sheets.js:172–201`) |
| payload class:eqId | `sld-mv-sub:A01`, `sld-ups-a:A01`, `battery-a:A01`, `cdu:07` (`hmi-payloads.CLASSES`, 59 classes) |

Conventional gets a `scalar` kind (its electrical model is counts, not a graph). Gate C1 proves every role of every
scenario resolves on each page that claims the scenario.

## 6. Scenario library v1 — the 31 handbook rows

Trigger, pass and abort are the handbook's MSC-1 values (`example.msc1`); the JSON expresses each limit as
`design` / `limit` / `setting` references per §5. Sheets name where the response paints on datahallAI (R128 sheet ids).
Dependencies from F28-2: S00 before everything; S01 before S02, S03, S04, S20, S29, S30; S27 before S28; S12 last
(load banks only).

| Id | Group | Trigger (T0) | Pass (msc1 example) | Abort | dcai roles | Sheets |
|---|---|---|---|---|---|---|
| S00 | baseline | 100 % load, 4 h, no event | inlet 18–27 °C; TCS 45 ±1 °C; no alarm | any 28.8.1 value | all | all |
| S01 | utility-generator | open both MV incomers (relay test trip) | no rack loses power; genset bus ≤ 15 s; UPS back to mains on generator; inlet ≤ 27 °C | SoC < 30 %; inlet > 35 °C/60 s; TCS > 50 °C | `breaker.mv-incomer.*`, `ups.*`, `source.genset`, `chiller.*` | DH-E-101, DH-M-103 |
| S02 | utility-generator | utility restored after S01, 30 min timer | closed-transition retransfer; parallel ≤ 100 ms; no interruption | unplanned trip | `source.utility.*`, `source.genset` | DH-E-101 |
| S03 | utility-generator | one generator start signal blocked during S01 | N units carry load; frequency ±2 % | unit overload > 110 %/60 s | `source.genset` (one unit) | DH-E-101 |
| S04 | utility-generator | generator trips on load (80 % plant load) | f dip ≤ 7 %, recovery ≤ 3 s (ISO 8528-5 G3) | second unit trip | `source.genset` | DH-E-101 |
| S05 | ups | one UPS module forced off | output inside IEC 62040-3 class 1; no bypass | UPS on bypass; output loss | `ups.A` (module) | DH-E-101, UPS modal |
| S06 | ups | UPS block output breaker opened | no rack loss; B block below rating | B > 100 % | `ups.A`, `rack.group.*` | DH-E-101, rack PSU |
| S07 | ups | static bypass transfer and back | inside ITIC; transfer in SOE | output loss | `ups.A` | UPS modal |
| S08 | ups | maintenance bypass MOP | no interruption; interlocks | wrong interlock | `ups.A` | UPS modal |
| S09 | ups | battery autonomy, input open, no generator | autonomy trend ≥ 5 min design (`engine.ups.runtimeMin`) | SoC < 30 % | `ups.A` | UPS modal |
| S10 | electrical | one LV main board lost (TX upstream breaker opened) | no rack loss; source change time met | SoC < 30 % | `breaker.<msb>`, `ups.*` | DH-E-101 |
| S11 | electrical | MV ring section breaker opened under load | no interruption downstream of UPS | unplanned trips | `breaker.<ring>` | DH-E-002 (facility) |
| S12 | electrical | EPO of the hall, load banks only | all listed breakers open ≤ 1 s; none outside the list | breaker outside the list | `event.epo`, `zone.*` | DH-E-101, DH-F-103 |
| S13 | electrical | A side isolated (MOP), then utility loss | no rack loss; B within rating | B > 100 % | `ups.A`, `busway.A`, `breaker.mv-incomer.*` | DH-E-101 |
| S14 | electrical | mirror of S13 | as S13 | as S13 | `…B` | DH-E-101 |
| S15 | cooling | duty CHW pump tripped | flow ≥ 95 % within 30 s | inlet > 32 °C avg | `pump.chw.<nn>` | DH-M-105 |
| S16 | cooling | one CDU loses both feeds | rack flow ≥ design within 10 s; TCS peak ≤ 47 °C | TCS > 50 °C/30 s; flow < 50 %/60 s | `cdu.07` | DH-M-103, CDU modal |
| S17 | cooling | trim chiller tripped | CHW back to SP ±0.5 K within 15 min | CHW > 24 °C | `chiller.<nn>` | DH-M-105 |
| S18 | cooling | dry-cooler fan group off | FWS supply ≤ SP + 1 K at design ambient | FWS > 41 °C | `drycooler.<nn>` | DH-M-101 |
| S19 | cooling | fan-wall unit off | inlet ≤ 27 °C; DP within ±20 % | inlet > 32 °C avg | `fanwall.<nn>` | DH-M-105 |
| S20 | cooling | cooling ride-through during S01 | inlet ≤ 27 °C; TCS ≤ 47 °C | as S01 | `tank.buffer`, `pump.*` | DH-M-103, DH-M-105 |
| S21 | cooling | leak rope wetted under a row | alarm ≤ 10 s with correct zone; isolation per C&E | water outside tray | `leak.zone.<n>` | DH-M-104, DH-F-103 |
| S22 | cooling | TCS low pressure (loop drained at a test point) | alarm at set value; pumps protected | pressure < 0.5 bar | `cdu.<nn>` | CDU modal |
| S23 | controls | primary BMS server off | takeover ≤ 60 s; no controller stops | plant stops | `bms.server` | DH-N-103 |
| S24 | controls | EPMS server stopped | no SOE event lost | — | `epms.server` | DH-N-103 |
| S25 | controls | BMS ring fibre pulled | ring heals inside protocol value | controllers offline > 60 s | `bms.ring` | DH-N-103 |
| S26 | controls | CDU zone controller off | no loss of cooling; flow kept | flow < 50 % | `bms.controller.<id>`, `cdu.*` | DH-N-103, DH-M-103 |
| S27 | fire | one detector alarm (aerosol) | C&E actions within 10 s | real smoke | `event.vesda_fire_1`, `zone.<id>` | DH-F-101 |
| S28 | fire | second detector at T0+60 s, pre-action release | all C&E outputs; water at test point within project value | water outside pipe | `event.preaction_or_sprinkler`, `zone.<id>` | DH-F-102 |
| S29 | controls | BMS + EPMS off, then S01 | no loss of load or cooling; EOP times | as S01 | `bms.server`, `epms.server`, + S01 | DH-E-101, DH-N-103 |
| S30 | utility-generator | all utility and all generator start signals blocked 60 s, then released | no rack loss; SoC ≥ 30 % | SoC < 30 % | `breaker.mv-incomer.*`, `source.genset` | DH-E-101 |

Each row also carries: `ist` link (S01/S30 → `ist-blackbuilding`, S03/S04 → `ist-genstep-loadbank`, S05–S09 →
`ist-ups-transfer`, S13/S14 → `ist-dualsource-transfer`, S10/S11 → `ist-tiebreaker`, S15–S19 → `ist-cooling-failover`,
S20 → `ist-mech-degradation`, S12/S27/S28 → `ist-firetrip`, S23–S26/S29 → `ist-bms-failover`); `observe` text from
`istScenarios` as the console's "what to watch" tooltip; the handbook `steps` where a worked script exists (S01, S02,
S16, S28).

## 7. Response engine — `js/rz-cx-sim.js` (ES5, UMD, pure, no DOM)

```
RZCxSim.run(scenario, plant, settings) → {
  steps: [ { t, states: { role: { state, kw?, soc?, flowLpm?, tempC? } }, events: [ { t, code, text, target } ], measured: { q: value } } ],
  verdict: { result: 'pass'|'fail'|'conditional'|'void', pass: [q], fail: [q], conditional: [q], abort: null | { q, t, value } },
  hash }                                            // FNV-1a over the serialised steps = runId
RZCxSim.at(run, t) → the step at or before t
```

**Plant model** (page adapter, `js/datahall-ai/cx-plant.js` for dcai; peer's for conv) from the engine snapshot:
dcai `equipment.*` (CDU duty/installed/unit kWth/unit flow, chillers, dry coolers, gensets, UPS frames, battery_kwh),
`distribution.*`, `site.*`, `hall_volume_m3`, `compute.racks_per_hall`, `geometry.*`; conv `electrical.*`,
`cooling.*`, `fuel.*`. **Engine additions (with sources, in the same release as C1):** dcai publishes
`equipment.ups_runtime_min` (from `ups.runtimeMin`, ASSUMED); conv adds `electrical.ups_runtime_min` and
`electrical.generator_count`.

**Parameters live in three homes (no second source of truth):**

| Kind | Home | Examples |
|---|---|---|
| plant values | the page engine snapshot | counts, ratings, battery kWh, autonomy minutes, design temperatures and flows |
| standards limits | `rz-engine.js DATA.commissioning.limits` + `DATA.sources` (rebuild chain: terser → `build-engine-catalog` → `test-value-bindings` → `test-asof`) | ITIC points (0 V/20 ms, 70 %/0.5 s, 80 %/10 s, 90 %), ISO 8528-5 G3 (f dip 7 %, recovery 3 s; V dip 15 %, 4 s), IEC 62040-3 class 1, NFPA 110 Type 10 = 10 s, ASHRAE rate of change 5 K/15 min and 20 K/h |
| sequence timings and model constants | scenario `settings` defaults in the JSON, `src` = handbook clause, class ASSUMED | utility confirmation 1.0 s, first set ready 7–10 s, all sets ≤ 30 s, bus closed ≤ 15 s, anti-recycle 180–300 s, standby pump ≤ 10 s, CDU redistribution, thermal τ |

**Electrical.** Time-staged `overrides` keyed by `t` are fed to `RZDatahallAIElectrical.evaluateScenario('ist', overrides)`
— a new base id `ist` with an empty `patch`; `battery` is added to `VALID_UPS_STATES` and is conductive in
`edgeDeviceState`; SoC, kW and times stay sim-owned (`validateState` rejects unknown keys, :511–530). `health` is
kept as is (consumed by `operator-ui.js:398`, asserted 4× in `test-datahall-ai-electrical-topology.mjs`); the verdict
exists only in the sim output. The existing 8 presets keep working unchanged.

Sequence for S01 (defaults; all `sim.*`): T0 incomers open → UPS `battery`, SoC falls at `kw / battery_kwh` →
+1.0 s utility loss confirmed, start signal → first set ready at `sim.genset.firstReady.s` (7.2 default; handbook
record 7.15 s) → sets synchronise, bus closed at `firstReady + syncSpread` (12.4 default) → ATS transfer, UPS back to
`online` on generator → mechanical pickup, frequency dip computed from step kW / units on bus against the G3 limit →
chillers restart after `antiRecycle` → thermal recovery. S30 = the same with the start signal blocked for 60 s.

**Thermal.** First order per loop: `dT/dt = (Q − C(t)) / Cth`; `Q = load.pct × design IT kW` (dcai `it_design_kw`,
conv `site.it_load_kw`); `C(t) = running units × unit kWth` from `equipment.*`; `Cth` expressed as time constants
`sim.thermal.tauTcs.s`, `sim.thermal.tauInlet.s`, `sim.thermal.tauChw.s` (ASSUMED, in the JSON), **calibrated once so
that S01 reproduces the handbook record** — inlet 25.9 °C at T0 + 4 min, TCS 46.2 °C at T0 + 3 min
(`28_integrated_systems_testing.md:545–546`) within ±0.3 K. That reproduction is the C4 anchor. The console tooltip
says "first-order model, τ = … s, calibrated to handbook S01". No CFD claim.

**Cooling failover.** S16: remaining CDUs in the group take `zone load / (n − 1)`; rack flow = unit flow × running /
installed against `design.rackFlowLpm`; standby pump start after `sim.cdu.pumpStandby.s` (≤ 10). S15/S17/S19 the same
pattern with their unit class.

**Fire.** The sim scripts the event sequence into `fire-workstation.startRun(eventId, zoneId)` one event at a time
(tick derived from `t`); S28 = `vesda_fire_1` at T0 then `preaction_or_sprinkler` at T0 + 60. Acceptance =
`commands.length === Σ outputs of the matched C&E rows && blocked.length === 0` ("14 of 14" in the handbook is the
MSC-1 record, not this module's count) and the stage timings from `stageOf`.

**Alarms.** Every expected alarm → a full `validateEvents` record: `incidentId`, RFC3339 `timestamp` with
milliseconds from `t`, integer `sequence`, `scenario` = S-id, `runId` = hash, `severity` (P1 ≡ `critical`);
appended through `RZDatahallAIAlarmWorkspace.appendEvents`. An unexpected `critical` → conditional pass + issue.

## 8. Painting the response on the sheets (concrete)

- `hmi-v2.js read(n)` consults `sim.at(t).states[binding(n)]` before `stateOf()`; `flow(e)` returns `running |
  unavailable` from the energized-edge set of `evaluateScenario`; while a run is active the sim calls
  `sheet.update()` per display step (the 4 s interval is paused).
- `css/rz-hmi.css` states added: `de-energized`, `tripped`, `battery`, `stopped` (and the UPS/battery symbol state
  `battery` in the library manifest). De-energized conductor = `--hmi-line-2`; flow arrows hidden when stopped; alarm
  colour only on tripped / abnormal; a value is coloured only when out of band.
- "What lost power" = `trace(openedBreaker, 'down')` in `--hmi-info`.
- No text is added to the sheet (H5). Event markers are rows in the console.
- Payload rows (modal, points list) read the run through `buildContext(win, {scenario, cooling, fire, tick})`
  overrides — **not** through the replay provider seam (single slot, stamps `quality:'replay'`; PRD-P05: replay is not
  a third source and scenario states are untouched).

## 9. Scenario console — `js/rz-cx-console.js` + `css/rz-cx-console.css` (shared with the peer)

```
┌ Scenario ▾ S01 Utility loss · prerequisites ✓ S00 · [Run] [Pause] [×1 ×10 ×60] [Reset] ──────────────────┐
│ Sequence of events (T+)        │ Measured vs acceptance                                                   │
│   0.0 s  MV-IN-A / MV-IN-B open │ genset bus closed    12.4 s    ≤ 15 s (project)        ● pass           │
│   1.0 s  utility loss confirmed │ first set ready       7.2 s    ≤ 10 s (NFPA 110)       ● pass           │
│   7.2 s  first set ready        │ UPS SoC min          98 %      ≥ 30 %                  ● pass           │
│  12.4 s  generator bus closed   │ rack inlet max       25.9 °C   ≤ 27 °C (design)        ● pass           │
│  13.0 s  ATS-A/B on generator   │ TCS supply max       46.2 °C   ≤ 47 °C (design)        ● pass           │
│ 220.0 s  CH-03 restarted        │ unexpected P1 alarms  0        = 0                     ● pass           │
├ Abort watch: SoC < 30 % · inlet > 35 °C for 60 s · TCS > 50 °C for 30 s (grey until armed) ─────────────────┤
├ Verdict: PASS · Record ▾ ─────────────────────────────────────────────────────────────────────────────────────┤
└ phase C5: trends with pass lines (F28-3) · settings used (OPR → changed) · hold-point checklist · compare runs ┘
```
Cells, tags and numbers only; every row has a tooltip (source clause, "what to watch" from `istScenarios.observe`,
model note). Keyboard: Space run/pause, `.` / `,` step, Esc reset. 390 px: the console stacks under the sheet, trends
two-up. Placement: right panel of the sheet, collapsible like the sidebar modes (`dh_side_mode` pattern). Selected
scenario and speed persist per viewer (`localStorage`, try/catch).

## 10. P&ID settings (phase C5)

Knobs drawn **at their controller bubble** (ISA-5.1 `SP` beside TIC / PIC / DPIC; ATS and genset controllers as
`inst` nodes on the SLD). Two kinds, by prefix: `engine.*` overrides an engine input through the page's override
path (TCS supply SP, CHW SP, UPS autonomy); `sim.*` is a sequence or model parameter (ATS sense delay, genset start,
anti-recycle, τ). Change → "changed" mark on the bubble and in the record (OPR value → new value); Reset = OPR /
default; "Compare runs" overlays two runs in the trends.

## 11. Records (phase C5)

One pack per run in the `rz-cx-records.js` shape, table **`ist_runs`** (not `scenarios`, which already means plan
what-ifs); step `expected {min:null, max:15, unit:'s'}` for one-sided operators; a sim pack is never `accepted`
(rule R6). Export / import JSON (CSV later); Replay gets scenario markers (`rz-replay-cursor`).

## 12. Findings for the peer (conventional pages), quoted from code

1. `datahall.html` has no scenario selector; its `meta.scenario` is a fixed label (:686).
2. `crah_n1_available_kw` and `crah_available_kw` are the same expression (`conv-engine.js:857–858`), so
   `N1_PASS = COOL_AVAIL_N1_KW >= COOL_DEMAND_KW` (datahall.html:1359) is the normal capacity check.
3. `function autonomyN1Hr(levelPct) { return autonomyHr(levelPct); }` (fuel-system.html:1136).
4. fire-system.html: `state.countdown -= 5` every 1000 ms under a "1-Hz countdown" comment (:1597–1599) — the 30 s
   countdown ends in about 6 s.
5. chiller-plant.html `degraded` = static CH-2 fault (:2368–2381), no time response.
6. The conv snapshot has no `generator_count` and no `ups_runtime_min`; add both with sources before the conv adapter.

## 13. Laws (gates; each proven red by the named mutation before it is trusted)

| Law | Check | Red mutation |
|---|---|---|
| C1 schema | every `data/cx/scenarios/*.json` validates (fields, enums, role grammar); S00–S30 complete; every `pass` / `abort` has `src`; every role resolves in each page's bindings | drop one `src`; drop one binding |
| C2 handbook parity | `example.msc1` values and abort values equal the parsed §28.9 / §28.8.1 rows of `28_integrated_systems_testing.md` | change one JSON number |
| C3 reproducibility | `run()` hash equals the committed golden per scenario (Node); in the browser a pinned `t` repaints identically after reload | change the `sim.genset.firstReady.s` default |
| C4 physics red/green | `sim.genset.firstReady.s = 20` → S01 fails "bus ≤ 15 s"; `engine.ups.runtimeMin = 0.1` → abort on SoC; `cdu_installed_per_hall − 1` → S16 flow fails; S01 thermal reproduces the handbook record within ±0.3 K | each named mutation |
| C6 painting | at each event the bound node `data-state` / edge `data-flow` changes on the next display step; the de-energized set equals `trace(opened, 'down')` | skip `update()` on one step |
| C7 abort | the abort condition stops the run, paints the banner, Reset restores `initialConditions` | disable the abort check |
| C8 record | export → import → `verdict` deep-equal; every step `result` equals `f(expected, measured_value)` | flip one `result` |
| C10 alarms | every expected alarm arrives as a valid record carrying `runId`; an unexpected `critical` → conditional | drop `incidentId` |
| Subsumed | traceability ⊂ H3/H9; UI (axe 0 serious, text budget, tooltips, 390/1440 × 2 themes) ⊂ H5/H14 + the a11y set; engine sources ⊂ `test-asof` A1 + `test-value-bindings` | — |
| Re-run list (not a law) | `test-datahall-ai-{hmi-payloads, replay, replay-runtime, inspector-runtime, alarm-query, electrical-topology, electrical-visual-map, electrical-live, fire-cause-effect, fire-points, fire-runtime, operator-ui, operator-runtime, authority}.mjs`, `test-dcai-coverage.mjs`, `test-eng-symbols.mjs`, `test-dh-drawings.mjs` (exists, **not yet wired** in `ship-gate.sh` — wire it in the drawings release) | — |

Gate files: `tools/test-cx-scenarios.mjs` (C1–C4, C8, Node), `tools/test-dh-scenarios.mjs` (C6, C7, C10, browser);
standard doc `standarization/CX_SCENARIO_STANDARD.md` in the same release (R089).

## 14. Phases (after R128–R134 acceptance; each its own release, red → green, screenshots 1440/390 sent)

| Phase | Scope | Exit |
|---|---|---|
| C0 | this PRD committed; `CX_SCENARIO_STANDARD.md`; gate skeleton red; `test-dh-drawings` wired | laws quoted red |
| C1 | schema + bindings + S00, S01, S30 JSON; `rz-cx-sim.js` electrical + UPS SoC + first-order thermal; `cx-plant.js` adapter; engine additions (`ups_runtime_min`, `DATA.commissioning.limits` + chain); Node gates C1–C4, C8 | green in Node; no page change |
| C2 | dcai console (SOE + measured + verdict) on DH-E-101; painting (§8); alarms (C10) | C6, C7, C10 green on electrical |
| C3 | cooling rows S15–S20, S22 on DH-M-103 + the CDU modal (+ DH-M-101/105 as they land) | same |
| C4 | fire / controls / EPO rows S12, S21, S23–S29 on fire and network sheets; two-event scripts | same |
| C5 | settings (§10), compare runs, trends F28-3, hold-point checklist, records export (§11), replay markers; remaining electrical rows S02–S04, S05–S11, S13, S14 (need generator kW share, retransfer time, maintenance isolation in the model) | C8 |
| C6 | conventional pages — peer, same core; §12 findings | peer's gates |

## 15. Resolved ambiguities (so two engineers build the same thing)

- Integration step 0.1 s for `t < 60 s`, 1 s after; display speed never changes the step.
- "100 % load" = `load.pct` × design IT kW (dcai `it_design_kw`, conv `site.it_load_kw`); below `pct` → `void`.
- S00's 4 h hold runs in sim time at ×60 and is accepted when inlet Δ < 0.5 K and TCS Δ < 0.3 K over 30 sim-minutes
  (handbook :333).
- `engine.*` vs `sim.*` settings as §10; a `design` reference is resolved by the adapter from the snapshot, a `limit`
  from `DATA.commissioning.limits`, a `setting` from the JSON defaults.
- Conditional pass: only when every failed quantity is an alarm or recovery quantity (`verdictRule`); the issue text
  is generated from the failed row, never typed.
- P1 ≡ `severity:'critical'`; SOE timestamps carry milliseconds from `t`.
- The 8 legacy electrical presets and the 4 cooling flags stay until their rows are covered, then the selects are
  replaced by the console (same ids kept for `test-datahall-ai-authority.mjs CORE_ACTION_IDS` until that gate is updated).

## 16. Risks and constraints

- Honest thermal model: first order, declared τ, calibrated once to the handbook record, labelled as a model.
- MSC-1 numbers must never become dcai limits (rule 1); the parity gate C2 checks the `example` field only.
- `rz-engine.js` edits run the full rebuild chain; terser output never hand-edited.
- Peer-owned Cx files (`js/rz-cx-*`) stay read-only; new files are this session's (`data/cx/scenarios/`,
  `data/hmi/bindings/`, `js/rz-cx-sim.js`, `js/rz-cx-console.js`, `css/rz-cx-console.css`, `js/datahall-ai/cx-plant.js`).
- One full gate at a time; lanes 3–4 only.
- Page size: scenario JSON loads on first open of the console, not with the page.

## 17. Reuse map (nothing re-implemented)

| Need | Existing seam |
|---|---|
| deterministic clock | `sim-telemetry.js` `TICK_MS`, `tickNow()` with `__rzSimTick` (tick derived from `t`) |
| composed electrical faults, energized edges, rack redundancy | `RZDatahallAIElectrical.evaluateScenario(id, overrides)`, `edges[].semanticState`, `racks[].redundancyState` |
| fire sequence | `RZDatahallAIFireWorkstation.startRun`, `fire-cause-effect.evaluateEvent`, `fire-points.stageOf` |
| alarm records | `RZDatahallAIAlarmWorkspace.appendEvents`, `alarm-query.validateEvents`, `js/rz-alarm-state.js` |
| payload rows for modal / points | `hmi-payloads.buildContext(win, opts)`, `safePayload`, 59 `CLASSES` |
| drawing paint and trace | `RZHmiSheet.render(host, sheet, {read, flow, open})`, `update()`, `trace()` |
| replay idiom | `replay-ui.js` `SPEEDS [1,10,60]`, `#replayScrub`, `rz-replay-cursor` |
| records | `rz-cx-records.js validate()`, `data/cx/demo-records.json` step shape |
| planning templates | `rz-engine.js DATA.commissioning.istScenarios` (`appliesFrom`, `observe`, `systems`) |
| symbols | `js/rz-eng-symbols.js` (R128 library; UPS `battery` state to add) |

## 18. References

Handbook: `cx-handbook/28-integrated-systems-testing.html` (§28.7.1 acceptance sources, §28.8.1 abort, §28.9 library,
§28.10 five-day plan, §28.11–28.13 scripts, §28.14 analysis), `15-generators-fuel-synchronising.html` §15.9.1 (NFPA 110
Type 10 start-time record: bus live 7.15 s), `16-ups-batteries-transfer-rack-power.html` §16.6.10 (autonomy test),
`19-air-side-liquid-cooling-tab.html` §19.13 (CDU functional tests and failover), `20-fire-life-safety-cause-effect.html`
§20.11.2 (Level 5 fire scenarios), `22-bms-commissioning-procedure.html` §22.10.3 (CDU pump failover sequence record).
Standards named in those clauses: NFPA 110, ISO 8528-5:2022 Table 4, IEC 62040-3:2021, ITIC curve, ASHRAE TC 9.9 (5th
ed.), ASHRAE Thermal Guidelines footnote f, NFPA 13 / 72 / 75, Uptime Tier objectives. Commercial references for the
behaviour (not copied): EcoStruxure IT impact simulation, Cadence Reality DC transient failure runs, ETAP what-if.
