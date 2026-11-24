# PRD-DCAI-HALL-DEPTH — Amendment 3: the floor shows what the scenario did (phase A5a)

Owner, 2026-11-23: "Continue improve more" (standing: "animasi state, indikasi banyak yg belum ada"; "Arrangement harus
accurate dan valid dan comprehensive"). Amendment 1 §7.3 and §8 asked for this, and its law table carried HV-S1 and HV-I1
as "A5".

Status: A5a (S1, I1), D6 (M3), A5b (I2, I3), D7 (U1) and D8 (P2) built and gated in the v3.104.0 candidate. A5c (flag opens its alarms) in Amendment 4. Red before green: S1/I1 4 of 36, M3 6 of 12, I2/I3 8 of 19, U1 4 of 4 (+ 2 of 8 tags cut by the stage), P2 9 of 12.

## 1 · What is wrong (measured on v3.103.0 candidate 5b8c2c33b, 1440 × 900, 2D)

| # | Measured | Should be |
|---|----------|-----------|
| M1 | `#coolingScenario` = `cdu-pump-fail`. The HMI payload of each of the 54 duty CDUs reads chip `fault` and one alarm `high PUMP-1`. The floor still draws all 54 with green lamps. | Each of the 54 CDUs shows an amber lamp and an amber body, and a flag names the point. |
| M2 | `leak-z07`: the payload of every rack in row R07 reads manifold `wet`, and the leak payload raises `LEAK-Z07 critical`. The floor draws row R07 grey with green lamps. | Row R07 is red and carries a flag. |
| M3 | `chiller-trip`: the payloads of the hall units do not change (the chiller is in the facility plant). | The floor does not change either, and the law says so. |
| M4 | No flag, no count and no "+n" exists on the floor. | Flags as in §2. |

Payload cost, measured in the page: 165 payloads (55 CDU, 90 fan-wall, 20 rack rows) take 24–49 ms, built once per
scenario change and never per tick.

## 2 · Design

- **D1 — One source.** The floor reads unit state from the same HMI payload that opens on click
  (`RZDatahallAIHmiPayloads.payload(class, id, buildContext(win, {noTrend: true}))`). The floor holds no state rule of
  its own. Per class:
  - **CDU and fan-wall:** chip `standby` gives standby; chip `fault`, or any alarm, gives an active state.
  - **Rack row:** `rack-unit:Rrr-01`; manifold `wet` sets every rack of the row to alarm.
- **D2 — Lamp colour from severity.** A critical alarm, or a manifold that is wet, gives `alarm` (red). Any other active
  alarm or fault chip gives `warn` (amber). This is the alarm-list priority, not a new scale.
  - A CDU on its standby pump still carries its full duty, so it shows amber.
  - A leak is critical, so it shows red.
- **D3 — Rotors follow physics, not alarms.**
  - Under a pump fault the standby pump takes duty at the same speed, so the rotor period does not change.
  - Under a leak the CDU auto-shutoff is armed but has not tripped, so nothing stops.
- **D4 — Flags.** A flag groups neighbouring units with the same point and severity:
  - **Neighbours:** one rack row, the CDU line, or one gallery.
  - **Text:** the first and last tag, the count, the point, and the state word or value. Example: `CDU-01…CDU-54 ×54 · PUMP-1 fault, standby pump on duty`.
  - **Anchor:** above the middle unit of the group, placed by a search over above, below, left and right so that it stays inside the stage and clear of other flags.
  - **Limit:** 8 flags at most. Red flags come first, then the larger groups. A "+n" chip at the stage corner counts the units that have no flag.
  - **Style:** ink text on the panel, a 1 px state-colour hairline, and the state glyph (▲ amber, ◆ red). No fill wash and no motion.
- **D5 — Everywhere the unit speaks.**
  - The tooltip adds the alarm line.
  - The "Show as table" State column reads `warning: PUMP-1 …` or `alarm: manifold wet` instead of `running`.
  - The rack override applies in every lens except Layout, because an alarm must be visible whichever lens is chosen.
- **D6 — Air only where the lens asks (Amendment 1 §7.1).** The 2D and 3D floor drew its air paths in every lens: 31 visible
  and animated in Status at 1440 and 390 (cold aisles from both galleries, hot-aisle roofs, across the corridor and the CDU line). In Status,
  Power and Layout they carried no reading and moved all the time. With `opts.airModes` (DC AI: Thermal, Cooling),
  the air layer is shown and animated in those lenses only. The Conventional hall passes no list and is unchanged.
- **D7 — Every number on the floor carries its unit.** The row-pair foot reads `6248`: 44 racks × 142 kW, with the unit
  only in a tooltip. That holds in 2D and 3D, at 1440 and at 390, so a reader cannot tell kW from W or from a count.
  With `opts.footText(zone)` (DC AI) the foot reads `6,248 kW`. Below 600 px it reads `6.2 MW`, which keeps the
  ≥ 3 px gap HV-F2b measures. The Conventional hall passes no formatter and is unchanged.
- **D8 — One operating point, floor and HMI (Amendment 1 §10, law HV-P2).** Measured on cf7eeb031, the HMI of a
  running unit contradicted the floor that opens it:

  | Value | Floor (dcai-engine 1.7.0) | HMI |
  |---|---|---|
  | Fan-wall fan speed | 99.7 % | 75–82 %, simulated around a typed 75 % ± 8 |
  | Fan-wall airflow per unit | 54,136 m³/h, the duty share | 55,325 m³/h, `design.flows.crah_air_m3s` / installed |
  | CDU pump | 98.9 % | 1,440 rpm, simulated around a 1,450 rpm nominal |

  The HMI now reads the engine:
  - `fan_pct` comes from `equipment.crah_fan_speed_pct`, and its trend is anchored on it.
  - `unit_air_m3h` comes from `equipment.crah_airflow_unit_m3h`. A `rated_air_m3h` row adds the module rating.
  - `pump_rpm` = `equipment.cdu_pump_speed_pct` × the 1,450 rpm pump nameplate (DECLARED). The DH-M-103 sheet rotor,
    which reads rpm / 1,450, therefore turns at the floor's speed.
  - Fan % and pump rpm stay telemetry points (VFD feedback): ±0.5 % and ±5 rpm around the engine value, and `—` under a
    replay with no sample (law O4b of `test-dh-operator`).
  - The old design-flow share stays, renamed `Design airflow share (installed)`.
- Not in this phase (A5b): status-strip counts per view equal to the alarm list (HV-I1 second half), the 8.3 inspector,
  and the MAN and STALE lamp variants.

## 3 · Laws (each red on 5b8c2c33b)

- **HV-S1.** For each of normal, cdu-pump-fail, chiller-trip and leak-z07, at 1440 in 2D:
  - The set of floor units in warn or alarm (`data-state`) equals the set the test computes on its own from the payloads, with the same severity mapping.
  - normal and chiller-trip leave 0 such units, and chiller-trip leaves the floor text identical to normal.
  - Every rotor period equals its period under normal.
- **HV-I1.** In each scenario with alarms, at 1440 and at 390:
  - 1 to 8 flags are visible.
  - The units counted on the flags plus "+n" equal the alarmed units.
  - Every flag names its point.
  - Flags lie inside the stage and do not overlap each other or a row head.
  - normal shows 0 flags.
- **HV-M3.**
  - In Status, Power and Layout there are 0 visible air paths and 0 running air animations.
  - In Thermal and Cooling, air paths are visible and each visible path runs one animation; under reduced motion, none runs.
  - This law is red on 5b8c2c33b: 31 paths in Status, Power and Layout (6 of 12).
- **HV-U1.**
  - Every visible row-pair foot on the 2D and 3D floor, at 1440 and at 390, ends in a unit (`kW` or `MW`).
  - Its value equals racks per pair × the engine rack kW, within one display step.
  - This law is red on 5b8c2c33b.
- **HV-P2.**
  - For 3 running fan-wall modules and 3 running CDUs, the floor's fan %, airflow, pump % and TCS L/min equal the HMI
    payload's, within the telemetry band plus the display step.
  - Red on cf7eeb031: 9 of 12 values differ.
- HV-F1, F2, G1, G2, M1, M2 and A1 stay green.

## 4 · Risks

- **R1 — The CDU pump fault is class-wide.** The payload faults pump 1 of every duty CDU, so the floor shows 54 amber CDUs; one flag carries them. If the owner meant one CDU, the change belongs to the payload (`COOLING_SCENARIOS`), and the floor follows it with no edit.
- **R2 — Changing the scenario costs ≤ 50 ms.** That is once per change, never per tick.

## 5 · Phase A5b — one alarm count for the floor, the strip and the alarm list

### Measured on e73d166db + 4db4d943b (1440, signed in, 2026-11-23)

| Scenario | Floor (A5a) | Status strip on Data Hall and on Alarms & Events | Alarms & Events list |
|---|---|---|---|
| normal | 0 flags | Critical 1 · Warning 0 | 6 rows, `LEAK-Z07` absent |
| cdu-pump-fail | 1 flag, 54 CDUs amber | Critical 1 · Warning 0 (unchanged) | 6 rows (unchanged) |
| leak-z07 | 1 flag, 22 racks red | Critical 1 · Warning 0 (unchanged) | 6 rows, `LEAK-Z07` absent |

The strip counts are produced by the page's doc-22 rules: rack inlet, margin, UPS load, TCS ΔT and the fire workstation. The
list holds recorded fixtures. Neither reads `#coolingScenario`. A scenario therefore reaches the floor, the unit
HMI and the tooltip, but never the alarm count. An operator sees red racks next to an unchanged strip.

### Design

- **B1 — One set.** `RZHallIso.alarms()` returns the payload alarms of the current hall under the current cooling
  scenario. These are the alarms of the CDU and fan-wall payloads, and the leak payload's `LEAK-Zxx` alarms. A wet row is
  the same event as its leak zone, so it raises no second alarm. Each is an alarm-list record (tag, point, severity, message, `scenario`). The floor
  flags are drawn from the same set.
- **B2 — The strip adds them.** In `rules()`, a critical alarm adds to Critical, and any other severity adds to Warning
  (the D2 mapping). The doc-22 rule counts stay as they are.
- **B3 — The list journals them.** The Alarms & Events workspace is append-only: the fire workstation already logs
  into it through `RZDatahallAIAlarmWorkspace.appendEvents`. A scenario change appends, for each new alarm, an
  `active_unack` record (quality `simulated`, `scenario` = the cooling scenario). For each alarm the change clears, it
  appends a `returned_unack` record, as an alarm journal does. The recorded fixtures stay.
- **B4 — Count once.** A row raises one alarm. Fifty-four CDUs with a pump-1 fault are 54 alarms in the list and in
  Warning, because ISA-18.2 counts one alarm per point. On the floor they are one flag.

### Laws (each red on the tree above)

- **HV-I2.** For each scenario, (strip Critical, Warning) − (normal's) = (critical, other) of `RZHallIso.alarms()`,
  on the Data Hall strip and on the Alarms & Events strip. normal and chiller-trip add 0.
- **HV-I3.** The Alarms & Events workspace holds an `active_unack` record for every alarm of the set: same tag, point
  and severity. After the switch back to normal, each of those alarms has a later `returned_unack` record, and none is
  active.

Owner of the files: `datahallAI.html` `rules()` (shared page; built after the peer's 3.102.0 lands) and
`js/datahall-ai/alarm-query.js` (list).
