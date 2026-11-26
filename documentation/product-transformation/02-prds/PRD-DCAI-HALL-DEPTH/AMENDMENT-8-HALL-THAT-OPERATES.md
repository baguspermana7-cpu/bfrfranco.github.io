# PRD-DCAI-HALL-DEPTH — Amendment 8: a hall an operator can run from the floor (phases A8a–A8f)

Owner, 2026-11-26 (after A6a was shown): "Continue, kembangkan dan sempurnakan. Buat detail super detail prd. Sangat
kurang." Standing asks this amendment must close (PRD §1, 2026-11-22): "temp di 4 titik per aisle/row, kemudian return
air tempnya, animasi dari crah … speed CRAH, opening control valve … masih kurang komprehensive". Standing taste: BMS
colours green / amber / red for state only; no glow, no decorative motion; physical motion wanted (things that move in
the plant move on the screen, at the plant's speed); less visible text at rest, detail on hover / tap; no invented
numbers ("no fake functionality").

Builds on A6a (Amendment 7, commit 32dc56952, not yet released). Target release: v3.108.0 carries A5d + A5e + A6a; A8
phases ship as v3.109.0 onward, one phase per release, each behind its own gate.

---

## 0 · Reading guide

| § | Content |
|---|---|
| 1 | What was measured on 32dc56952 (numbers, not impressions) |
| 2 | Traceability: every owner ask → where it stands → which phase closes it |
| 3 | Rules this amendment obeys (honesty, colour, motion, text, shared module) |
| 4 | Engine additions (valve model, station grid), with worked examples on today's numbers |
| 5 | Design per phase A8a–A8f (geometry, tokens, data source of every number) |
| 6 | Laws per phase, each with the red state it must fail on first |
| 7 | Test plan (files, widths, themes, motion preferences, neighbours) |
| 8 | Risks and how each is held |
| 9 | Order, releases, effort |
| 10 | Out of scope, and why |
| 11 | Decisions taken without asking (owner may overrule) |

---

## 1 · Measured (tree 32dc56952, real browser via `rz-lane`, `#hIso`, 1440×900 dark + light, 390×844 dark)

Engine values read from `DHE` on the page (GB300 NVL72 basis, engine 1.7.0):
fan-wall unit duty 199 of 200 kWth, fan 99.7 %, 54,136 of 54,274 m³/h, face velocity 2.5 m/s, 89 of 90 running,
45 modules × 2 galleries; CDU 983.5 of 1,000 kWth (98.3 %), 1,483 of 1,500 L/min, pump 98.9 %, 54 of 55 running;
air 25 → 36 °C; CHW 19 → 27 °C; TCS 40 → 50 °C; TCS per rack 182 L/min; 142 kW and 213 A per rack; 20 rows × 22 racks;
hall height 5.5 m. `SENS_PTS` = 3 (a page constant, `datahallAI.html:3498`, not an engine value).

| # | Measured | Consequence |
|---|----------|-------------|
| M1 | **3D Status: 0 running animations** (2D Status: 143 — the plan rotors). 3D Thermal 31, 3D Cooling 53. | In 3D nothing in the plant moves unless a lens adds a dash. The fan walls — the loudest moving thing in the room — stand still. |
| M2 | **Cooling 3D: the 20 branch pipes are drawn at h = 0.15 m and hidden behind the racks**; only the two corridor headers per band show. | The A6a claim "a branch up each hot aisle" is true in 2D, invisible in 3D. |
| M3 | **CDU "Control valve" = constant 70 % ("70 % design opening")**, `hmi-payloads.js:288`; MMR AHU "CHW valve" constant 55 %, `:902`. Fan-wall (CRAH) HMI has **no valve point at all**. | The owner's "opening control valve" is shown as a fixed number on CDUs and absent on fan walls. A fixed number dressed as a live reading is the kind of fake this site removes. |
| M4 | Fan-wall supply / return air exists only as **hall planes** (25 / 36 °C) in tooltips and the chip; no unit has its own SAT / RAT point. | "return air tempnya" per unit: not shown. |
| M5 | Fan speed is shown once per gallery (chip "fan 99.7 %"); no unit shows its own speed; the plan rotor's turn rate is the only per-unit cue. | "speed CRAH" per unit: not readable. |
| M6 | **3 stations per aisle** (`SENS_PTS` 3); the Drawing view and the floor both use 3. Cold-aisle RH points exist on the Drawing view (`C{z}{s}h`, simulated 40–65 %) and appear nowhere on the floor. | Owner asked 4 per aisle / row. RH and dew point — the second half of an ASHRAE inlet check — are not on the floor. |
| M7 | Station dots: 8 px at 1440 2D, 6.2 px in 3D, **4 px at 390**. No number at rest (by design); hover shows a `<title>` only (no styled tooltip, no tap on a phone). | On a phone a station cannot be read at all. |
| M8 | **Phone 390: rack 6.9 × 3.5 px, fan-wall cell 6.8 × 5.8 px**, stage 374 × 289 px; the plan's long axis runs across the screen. | Nothing on the phone floor can be tapped reliably (44 px target law) or read. |
| M9 | 2D 1440: the band **between the CDU line and the south fan-wall gallery** (~75 px, ≈ 12 % of the stage height) carries only dashed air-path lines; the corridor label is 9 px muted. | Still reads partly as a gap. |
| M10 | Cooling legend says "warning < 0 K", "alarm < −3 K". | An operator must know that this is cooling margin; the words do not say so. |
| M11 | Every rack draws the same: 440 racks at one fill; rack-level numbers (inlet, kW, TCS L/min, feed A) exist in the engine or the stations but no rack hover shows them together. | "What is this rack doing?" needs the HMI modal (two clicks). |
| M12 | Station readings are declared simulated jitter about the engine planes (Drawing view, v3.3.0); they never trend and never alarm: no `RZTrend` registration, no alarm-list entry. | A station going warm is visible only if the operator happens to be in Thermal. |
| M13 | Light theme 1440: overlays legible (liquid tokens per theme hold); no contrast defect seen. | No action; keep under the gate. |
| M14 | Running animations, 2D Cooling 196: 145 rotors + 22 pipe dashes + 29 others (air-path). Off-screen pause exists (`.fp-offscreen`). | Budget for A8 motion: hold ≤ 260 running in any view, all paused off-screen. |

---

## 2 · Traceability of the owner's asks

| Ask (owner words) | Today (32dc56952) | Closes in |
|---|---|---|
| "temp di 4 titik per aisle/row" | 3 stations per aisle, Thermal lens, hover title only | **A8b** (4 per aisle, both sides, styled tooltip, tap on phone) |
| "return air tempnya" | hall plane 36 °C in chip / tooltip | **A8a** (per-unit RAT + SAT points, hot-aisle stations = return path) |
| "animasi dari crah" | 2D rotors turn; 3D still | **A8c** (3D rotors at fan %, air ribbons at face velocity) |
| "speed CRAH" | one gallery number | **A8a** (per-unit fan %, rotor rate = fan %, cell readout in Cooling) |
| "opening control valve" | CDU constant 70 %; fan wall none | **A8a** (engine valve model: fan-wall CHW valve, CDU FWS valve; glyph on the floor) |
| "masih kurang komprehensive" | lenses differ since A6a | **A8d** rack drill, **A8e** station trends + alarms, **A8f** phone |
| "Sangat kurang" (2026-11-26) | — | all of A8, gated, screenshots read before each release |

---

## 3 · Rules this amendment obeys

1. **One source per number.** Every number on the floor is an engine field (`DHE` / `__hallIsoGeo`), a page reading the
   Drawing view already shows (`C/H{z}{s}{t|h}`), or a model added to the engine in §4 with its basis written. Nothing
   is typed into the floor code.
2. **A model is labelled as a model.** Valve stroke is computed, not measured: its tooltip says
   "modelled: equal-percentage, R 50 (ASHRAE Handbook — HVAC Systems and Equipment, ch. 47)". A telemetry jitter point
   says "simulated about the engine plane" exactly as the Drawing view does.
3. **Colour.** State colours (`--rz-pt-ok/warn/alarm`) only for a point that has a registered limit. Liquid loops use
   `--fp-liq-sup/ret` (A6a). Air uses one new pair `--fp-air-sup` (cool neutral) / `--fp-air-ret` (warm neutral), muted,
   per theme, ≥ 15 ΔE from every state token (checked by the same validator as `RZTrend.slots()`). No glow, no wash,
   no gradient fill.
4. **Motion is physical.** A thing moves only if it moves in the plant, at a rate derived from the engine
   (`RZConvVfx.dashSeconds(ratio)` for flow; rotor period from fan % / pump %). `prefers-reduced-motion: reduce` → all
   still, state still readable. Off-screen → paused.
5. **Text at rest stays low.** At rest a lens adds ≤ 1 short tag per row pair (A6a) and ≤ 1 short tag per gallery /
   CDU line. Everything else is on hover (desktop), tap (phone) or the side column.
6. **Shared module stays shared.** All drawing stays behind `floor-plan.js` `opts.overlay` (A6a) and new opt-in hooks;
   `datahall.html` (Conventional) is byte-identical in behaviour, proven by its own gates.

---

## 4 · Engine additions

### 4.1 Control-valve stroke (A8a)

Basis: a modulating valve with an **equal-percentage** characteristic, rangeability R = 50, authority taken as 1 (ideal
installed characteristic — stated, because the hall has no pipe-network model to compute authority). Relative flow φ =
Q / Q_design; stroke s (0–1):

    s = 1 + ln(φ) / ln(R)          for φ ≥ 1/R;   s = 0 below (valve at its shut-off floor)

Required flow ratio at a fixed design ΔT is the load ratio (Q ∝ duty at constant ΔT):

| Unit | φ (engine fields) | today | stroke |
|---|---|---|---|
| Fan-wall CHW coil valve | `crah_fan_speed_pct / 100` (= unit duty / rating) | 199.49 / 200 = 0.99745 (the 199 printed is rounded) | 1 + ln 0.99745 / ln 50 = **99.93 %** |
| CDU facility-water (FWS) valve | `cdu_load_pct / 100` | 983.5 / 1,000 = 0.98348 | **99.57 %** |
| Standby unit | — | — | **0 %** (shut, as the HMI's standby text already says) |

Honest reading: the design point runs at 89 of 90 fan walls and 54 of 55 CDUs at ~99 % duty, so the valves sit nearly
wide open. The number moves when the engine's duty moves (replay, a scenario, a unit trip that spreads load onto
fewer units — then φ > 1 and the stroke clamps at 100 % with the tooltip "valve at full stroke: unit above design
duty"). Implementation: `models.valve.eqPct(phi, R)` in the hall engine section of `datahallAI.html` (where `DH` is
built) with `DATA.sources`-style basis text; `valvePct` fields `crahValvePct`, `cduValvePct` published on `DHE`.
The HMI constants at `hmi-payloads.js:288` (CDU) are replaced by `{ field: 'cduValvePct' }`; the CRAH payload gains
`valve_pct` = `{ field: 'crahValvePct' }`. The MMR AHU (`:902`) is not in the hall and keeps its constant, now labelled
"design value, not modelled" (it is outside this PRD's floor).

### 4.2 Per-unit air points (A8a) — as built

Built simpler than drafted: the fan-wall HMI already printed supply and return air from the engine planes (`b.P`
`p09_air_supply_c`, `p11_air_return_c`), so no jitter point was added; the floor tooltip prints the same plane
("return air 36.0 °C"). Every running unit returns the same air in this engine (one plane per hall) — printing invented
per-unit spreads would be fake. Fan % per unit = `crah_fan_speed_pct` (one VFD speed, as the engine models).

### 4.3 Station grid (A8b)

`SENS_PTS` 3 → **4** stations per aisle, evenly along the rack line at (s + 0.5) / 4 of its length, on every cold aisle
side and every hot aisle. Each cold station carries T and RH (exists on the Drawing view), and a derived dew point
(Magnus, a = 17.62, b = 243.12 °C; basis written in the tooltip). Hot stations carry T. Counts at today's hall: the page keeps one
cold-aisle series (`C{z}{s}`, the cold aisle a pair faces) and one hot-aisle series (`H{z}{s}`) per row pair, so 10 pairs ×
2 aisles × 4 = **80 stations** (A6a: 60). (The first draft said 120 by counting each cold aisle twice; corrected on build.) The Drawing view's readout layout
gains its fourth point (it already loops `SP`; its geometry is checked by the Drawing gates).

---

## 4b · Status (2026-11-26, tree cp5 on 0040a76cf)

- Engine 1.7.0 → **1.8.0**: `equipment.controlValve` in `js/dcai-model.js` (sourced), `valveStroke()` +
  `equipment.crah_chw_valve_pct` (99.93 %) / `cdu_fws_valve_pct` (99.57 %) in `js/dcai-engine.js`, `calc.valveStroke(phi)`;
  pins moved (page, datacenter-solutions, two manuals), `rz-engine-versions.js`, registry 336 parameters.
  `test-dcai-engine.mjs` 604/0 (red 7 before); `test-dcai-engine-version-pin.mjs` PASS.
- HMI: CDU `valve_pct` was a typed 70 % → engine field; CRAH gains `valve_pct`; standby 0 with a reason.
  `test-datahall-ai-hmi-payloads.mjs` H8 (red under the typed-70 mutation, green after).
- Floor: valve bar per cell (opt-in `opts.valves`, shown in Cooling), rotors in 3D on the grille face, tooltips name
  return air and the valve "(modelled)"; `SENS_PTS` one constant = 4 (it was typed twice: drawing and readout writer);
  stations carry RH and Magnus dew point; one ink ring per pair on the warmest inlet point.
- HMI valves are telemetry points (`b.S`, ±0.3 % position feedback, 0.1 % resolution) anchored on the engine field, not
  fixed engine values: a replayed BMS file must still override them (found by `test-datahall-ai-replay-runtime.mjs` B4,
  which went red when the CDU valve became a fixed engine value — the file's 64 % was ignored). B4 now compares numbers.
- Cold-aisle RH: the readout writer publishes every point's RH (`window.__hallRH`) even where the Drawing view prints
  none; the stations read it (ST4-2 was red: 40 of 40 cold stations without RH).
- FL4 (A6a) compares a row tag to its station mean within half a display step: with 4 one-decimal points the mean often
  sits on x.x5 and may round either way.
- Law test `tools/test-dcai-air-stations.mjs` (AV0, AV3, AV4, AV5, ST4-1, ST4-2, ST4-4, RD1, RD2): **red 14 failures on
  0040a76cf, green 31/31**; ship-gate line added. Neighbour DC AI set (51 gates): 49 green on the first pass, the two
  reds above fixed and re-run green. Screenshots read: 1440 2D/3D Cooling (valve bars, 3D rotors), 2D Thermal (4 points
  per aisle, one ring per pair).
- **A8c built:** 3D pipes overhead (header capH + 0.6 m, branches capH + 0.3 m with a drop at the row end; `data-h` per
  pipe, 2D keeps the plan at 0). Laws 3M1 (3D Status rotors = 143 running cells; Cooling 3D ≤ 260 running), 3M2 (red
  22 of 22 pipes at floor height on the A8a tree, green), 3M3 (off screen 0 running, back on screen rotors run). 3M2 as
  written in §6 (elementFromPoint sampling) could not work: the overlay paints above the racks and has no pointer
  events, so every sample missed; the law checks the drawn height instead and the screenshot was read.
- Committed in cp5; releases as v3.112.0 after the peer's v3.111.0 (order agreed 2026-11-26).
- **Finding outside A8 (peer, P7 sequences):** at design ambient 38 °C the engine needs 634 dry coolers and 631 are
  installed — 2,875 kWth short. Recorded for the heat-rejection PRD; not changed here.

## 5 · Design per phase

### A8a — the air side and the valves (owner: return air, CRAH speed, valve)

- **Cooling lens, each fan-wall cell (2D and 3D):** the existing rotor turns with period T = 1.0 s × 100 / fan % (A4 §7.1; pump 0.8 s) (still
  under reduced motion, stopped on standby). A **valve glyph** (bow-tie, 2 triangles, 6 × 4 px at 1440) sits on the
  cell's CHW stub; its inner fill height = stroke %. Ink only — a valve has no limit, so it carries no state colour.
- **Hover / tap a fan-wall cell (Cooling):** a styled tooltip (the floor's existing tip box, not `<title>`):
  "FW-N-07 · run · fan 99.7 % · 54,136 m³/h · SAT 25.1 · RAT 36.2 °C · CHW valve 99.9 % (modelled)". Standby:
  "FW-N-45 · standby · fan 0 % · valve 0 % (shut)".
- **Air ribbons (2D Cooling):** from each gallery a thin `--fp-air-sup` dash runs into each cold aisle head
  (one per cold aisle, 11 per gallery), dash period from `RZConvVfx.dashSeconds(crahAir / crahAirRated)`. Return:
  one `--fp-air-ret` dash per contained hot aisle up to the ceiling plenum mark at the row end. Replaces nothing in
  Status (air-path already there); in Cooling it is the only air drawing.
- **Gallery chips (A6a D5) gain:** "SAT 25.0 · RAT 36.0 °C · valve 99.9 %". CDU chip gains "FWS valve 99.6 %".
- **HMI:** CRAH payload gets `valve_pct`, `sat_c`, `rat_c` (engine / declared jitter); CDU `valve_pct` from the model.
- **Legend (Cooling):** "cooling margin < 0 K (warning)", "cooling margin < −3 K (alarm)", plus "valve stroke
  (modelled)", "air supply / return", "TCS supply / return" swatches. (Fixes M10.)

### A8b — four stations per aisle, readable (owner: 4 titik)

- 4 stations per aisle as §4.3; dot 8 px at 1440 2D (hit area 24 px), 7 px in 3D on a 1.2 m post (so it clears rack
  tops at capH), 10 px dot with 44 px hit area on a phone.
- **Styled tooltip / tap card:** "R03/04 cold aisle A · point 2 of 4 · 25.6 °C · 48 % RH · dew 13.8 °C · simulated about
  the engine plane". Hot: "R03/04 hot aisle · point 2 of 4 · 36.4 °C return".
- **Row tag (Thermal)** stays "mean inlet / mean hot °C" (A6a), now over 4 points; the hottest cold station of the pair
  gets a 1 px ink ring (no colour, so it is a pointer, not a state).
- **Drawing view** shows the same 4 points (one source; `SENS_PTS` is read by both).

### A8c — 3D that moves (owner: animasi CRAH)

- **Rotors on the 3D fan-wall faces:** each running cell gets a 3-blade rotor projected onto its gallery face, turning
  at the A8a period; standby still; off-screen paused. 3D Status then runs ≥ 89 rotors (M1: 0).
- **Pipes raised:** in 3D the TCS headers run **overhead** at h = capH + 0.6 m (≈ rack top + 0.6) along the corridor, and
  each branch drops to the hot-aisle rack line (vertical segment at the row end + horizontal run over the hot aisle at
  capH + 0.3). 2D keeps the A6a plan geometry. Fixes M2 (every branch visible in 3D).
- **Busway (Power) in 3D:** already at capH + 0.35 — unchanged.
- Budget: rotors 89 + pipes 22 + ribbons ≤ 44 → ≤ 160 running in 3D Cooling (M14 budget 260).

### A8d — rack drill (owner: "kurang komprehensive")

- **Hover / tap a rack (any lens):** one tooltip: "R07-12 · 142 kW of 150 kW shelf · inlet 25.8 °C (point 2, cold aisle A)
  · TCS 182 L/min · 40 → 50 °C · feed A 213 A". Inlet = the nearest cold station on its aisle (named, never interpolated
  — an interpolated value would be invented).
- **Thermal lens:** the rack face toward its cold aisle takes the state of its nearest cold station (ok / warn / alarm);
  at the design point all are ok, so the floor stays calm; a warm station paints its 5–6 racks, not the whole row.
- Click opens the existing rack HMI (A5d selection kept).

### A8e — stations that trend and alarm

- Every station registers with `RZTrend` (`RZPointStatus.define('dh.st.C0312', { warn: 27, alarm: 30, unit: '°C' })` for
  cold, hot without limits), history from the page's sample buffer; click a dot → the trend dialog (RZSheet on a
  phone).
- A cold station above 27 °C raises a floor flag (A3 flags) and an alarm-list row ("R03/04 cold aisle A point 2 · inlet
  27.4 °C > 27 °C"); the A5c flag → list link works for it. Replay without a sample → stale lamp (A5e rule).

### A8f — phone floor (M8)

- At ≤ 600 px the 2D plan is **rotated 90°** (rows run down the screen): stage height grows to fit the long axis,
  racks ≥ 13 × 7 px, fan-wall cells ≥ 12 px. Pinch / double-tap zoom on the stage (2× and 4×), pan by drag, a "Fit"
  button resets. Tags move to the row ends (left edge). 3D on a phone keeps the iso but starts zoomed on the first
  band with the same zoom controls.
- Hit areas: any unit ≥ 44 × 44 px at 2× zoom; at 1× a tap opens the nearest unit within 22 px with its tooltip card.

---

## 6 · Laws (each must be red on 32dc56952 before it is trusted green)

**A8a** (`tools/test-dcai-air-valve.mjs`)
- AV1 `DHE.crahValvePct` = 100 × (1 + ln(crah_fan_speed_pct/100)/ln 50) ± 1e-9 (99.93 today) and `cduValvePct` likewise; φ > 1 clamps to 100; φ < 1/50
  → 0. *Red: fields absent.*
- AV2 CDU HMI `valve_pct` = `cduValvePct` (not 70); CRAH HMI has `valve_pct` = `crahValvePct`. *Red: 70 / absent.*
- AV3 every running fan-wall cell in Cooling has a valve glyph whose fill ratio = stroke ± 2 %; standby 0. *Red: none.*
- AV4 rotor period per cell = 1.0 × 100 / fan % (CDU 0.8 × 100 / pump %) ± 5 %, in 2D and 3D; standby 0 running; reduced motion 0 running. *Red: period not
  bound to fan %.*
- AV5 tooltip of a cell names SAT, RAT, fan %, m³/h, valve % "(modelled)"; SAT within ±0.3 K of `airSupplyC`, RAT ±0.6 K
  of `airReturnC`. *Red: no tooltip.*
- AV6 ribbons: one supply per cold aisle head per gallery, dash period = `dashSeconds(crahAir/crahAirRated)` ± 5 %.
- AV7 Cooling legend contains "cooling margin" and "modelled". *Red: "warning < 0 K".*

**A8b** (`tools/test-dcai-stations.mjs`)
- ST4-1 stations = pairs × 2 aisles × 4 = 80 (today's hall); Drawing view shows 4 points per aisle. *Red: 60 / 3.*
- ST4-2 each cold tooltip: T = `C{z}{s}t`, RH = `C{z}{s}h`, dew = Magnus(T, RH) ± 0.1. *Red: no RH / dew.*
- ST4-3 hit area ≥ 24 px (1440) / ≥ 44 px (390); a tap on a phone opens the card. *Red: 4 px, no tap.*
- ST4-4 hottest cold station of each pair carries the ink ring, exactly one per pair.

**A8c** (`tools/test-dcai-3d-motion.mjs`)
- 3M1 3D Status running rotors = running fan walls (89); 3D Cooling ≤ 260 running total. *Red: 0.*
- 3M2 every 3D branch path has ≥ 60 % of its length unoccluded (elementFromPoint sampling at 10 points). *Red: ~0 %.*
- 3M3 reduced motion: 0 running in `#hIso`; off-screen: 0 running.

**A8d** (`tools/test-dcai-rack-drill.mjs`)
- RD1 a rack tooltip's kW, shelf, TCS L/min, feed A = engine fields; inlet = named nearest cold station's reading.
- RD2 forcing one station to 28 °C (test hook writes its readout) paints only the racks nearest it warn; 0 others.
  *Red: racks never change.*

**A8e** (`tools/test-dcai-station-alarms.mjs`)
- SA1 click a station → trend dialog titled with its name, last value = its reading.
- SA2 station forced to 28 °C → one floor flag + one alarm-list row naming it; flag click opens that row (A5c).
- SA3 replay without a sample → station stale (dotted), no alarm.

**A8f** (`tools/test-dcai-phone-floor.mjs`)
- PF1 390: rack short side ≥ 7 px at 1×, ≥ 14 px at 2×; fan-wall cell ≥ 12 px at 1×. *Red: 3.5 / 5.8.*
- PF2 page `scrollX` 0; stage inside viewport width; zoom keeps the selected unit centred; Fit restores.
- PF3 tap within 22 px of a unit opens its card; no double-fire with the HMI.

**All phases:** 0 page errors; FL1–FL7 (A6a) stay green; Conventional `datahall.html` draws no DC AI overlay; axe 0
serious on the hall panel in both themes.

---

## 7 · Test plan

- Widths 1440 (2D, 3D), 1024 (2D), 390 (2D, 3D); themes dark + light; motion default + reduce; every lens.
- Neighbours run with the ship-gate command lines: select, stale, flag-list, floor-lens, hall-iso, hall-views
  (`--only=…`), unit-ops, dh-operator, conv floor-plan ×2, datahall-space, datahall-air, coverage `--strict --settle
  --modals`, test-dh-hall (DH11 reads sensor names: update for 4 points in the same commit), hmi-payloads.
- Screenshots per phase: `~/.cache/qa-tmp/a8/<phase>-<W>-<theme>-<view>-<lens>.png`, read before each commit; the
  release report lists which were read.
- Perf: running-animation count and a 5 s `performance` trace on 2D / 3D Cooling at 1440 (long tasks ≤ 50 ms; frame
  budget held), before and after each motion phase.

---

## 8 · Risks

| Risk | Hold |
|---|---|
| R1 The valve model reads as a measurement | "(modelled)" in every tooltip and the legend; basis in the HMI point's source line; law AV7. |
| R2 4 stations break the Drawing view layout or DH11 | Same commit updates the Drawing geometry and DH11; Drawing gates in the neighbour set. |
| R3 Motion budget / laptop heat | ≤ 260 running; off-screen pause; one rotor = one CSS rotate on a `<g>`; thermal-aware lane for gates. |
| R4 3D overhead pipes clutter the iso | Pipes only in Cooling; 2 px, muted tokens; 3M2 law checks visibility, screenshot read checks clutter. |
| R5 Phone rotation breaks selection / flags placement | Selection, flags, tags read the same `XY` projection; A5d / A3 gates run at 390. |
| R6 Shared module drift | All new hooks opt-in; Conventional gates in every phase. |
| R7 Peer session edits the same files | Rebase before each phase; generated files rebuilt, never merged by hand. |

---

## 9 · Order, releases, effort

| Phase | Ships in | Files | Effort |
|---|---|---|---|
| A8a air + valves | v3.109.0 | datahallAI.html (engine), hmi-payloads.js, hall-iso.js, floor-plan.js (cell hook) | L |
| A8b 4 stations | v3.109.0 | datahallAI.html (SENS_PTS, Drawing), hall-iso.js, test-dh-hall | M |
| A8c 3D motion | v3.110.0 | floor-plan.js (iso rotor), hall-iso.js | M |
| A8d rack drill | v3.110.0 | hall-iso.js | S |
| A8e trends + alarms | v3.111.0 | hall-iso.js, alarm list adapter, RZTrend registration | M |
| A8f phone floor | v3.111.0 | floor-plan.js (rotation, zoom), hall-iso.js | L |

Each phase: laws red → build → laws green → neighbours → screenshots read → CHANGELOG + standards + ledger → full
release gates → push → live check with screenshots → IndexNow.

---

## 10 · Out of scope

- A pipe-network hydraulic model (valve authority, pump curves per loop): the valve model states authority 1 instead.
- Vertical (top / middle / bottom) inlet sensors per rack: the owner asked for points along the aisle; a vertical
  profile would need an engine stratification model that does not exist.
- A continuous temperature heat map between stations: it would paint numbers nobody measured.
- The MMR AHU valve (outside the hall floor).

## 11 · Decisions taken without asking (owner may overrule)

1. Valve characteristic equal-percentage, R = 50, authority 1 — the common HVAC control-valve default.
2. 4 stations per aisle (owner's number) on every cold side and every hot aisle — 120 in today's hall.
3. Station inlet limits 27 / 30 °C kept: 27 °C is the ASHRAE recommended upper inlet; 30 °C is the page alarm limit used since A6a (allowable A1 upper is 32 °C).
4. Phone plan rotated rather than scrolled sideways (page `scrollX` must stay 0).
5. Release split as §9 so each release stays gate-able in one evening.
