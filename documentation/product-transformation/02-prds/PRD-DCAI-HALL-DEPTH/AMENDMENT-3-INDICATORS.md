# PRD-DCAI-HALL-DEPTH — Amendment 3: the floor shows what the scenario did (phase A5a)

Owner, 2026-11-23: "Continue improve more" (standing: "animasi state, indikasi banyak yg belum ada"; "Arrangement harus
accurate dan valid dan comprehensive"). Amendment 1 §7.3 and §8 asked for this, and its law table carried HV-S1 and HV-I1
as "A5".

Status: in build (v3.104.0 candidate).

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
- HV-F1, F2, G1, G2, M1, M2 and A1 stay green.

## 4 · Risks

- **R1 — The CDU pump fault is class-wide.** The payload faults pump 1 of every duty CDU, so the floor shows 54 amber CDUs; one flag carries them. If the owner meant one CDU, the change belongs to the payload (`COOLING_SCENARIOS`), and the floor follows it with no edit.
- **R2 — Changing the scenario costs ≤ 50 ms.** That is once per change, never per tick.
