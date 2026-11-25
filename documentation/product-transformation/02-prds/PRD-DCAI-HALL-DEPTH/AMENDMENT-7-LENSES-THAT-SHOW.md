# PRD-DCAI-HALL-DEPTH — Amendment 7: each lens draws what it is about (phase A6)

Owner, 2026-11-26: "Masih kurang bagus datahall tampilannya." Standing, 2026-11-22 (PRD §1): "temp di 4 titik per
aisle/row, kemudian return air tempnya, animasi dari crah … speed CRAH, opening control valve … masih kurang
komprehensive". Standing taste: BMS colours green / amber / red, no glow, physical motion only, less visible text.

## 1 · Measured (tree 4a1b15c33, real browser, `#hIso` census per view × lens, 1440×900 and 390×844, dark)

| # | Measured | Consequence |
|---|----------|-------------|
| M1 | The five lenses (Status, Thermal, Cooling, Power, Layout) draw the **same element set**: 440 racks, 145 fan-wall/CDU cells, 145 rotors, 10 caps, 10 row tags. Only fills change. | Cooling, Power and Thermal look alike; the lens bar promises views it does not draw. |
| M2 | Text on the floor: **10 nodes** in every lens (the row-pair tags), each "6,248 kW" — also in Thermal and Cooling. | No temperature, flow, speed or loading is readable without hovering. |
| M3 | The sensor stations the Drawing view reads (`C{z}{s}t`, `H{z}{s}t`; `SENS_PTS` = **3** per aisle, e.g. C00t 25.5, H00t 37.0 °C) appear nowhere on the floor. | The owner's "temp di 4 titik per aisle" exists in data (3 points, the engine's count), not on the floor. |
| M4 | 2D 1440: the band between the rack line and the CDU line (the service corridor, 4.6 m to scale) and the band under the CDU line are empty grey: ~31 % of the stage height carries nothing. | Reads as a gap. In a DLC hall that corridor carries the TCS headers. |
| M5 | No piping is drawn: CDU → row manifolds → racks (53,108 kWth of liquid heat, 85 %) is invisible. | The main heat path of the hall is missing from its floor. |
| M6 | Fan-wall speed, air flow, supply / return air and CDU pump %, flow, TCS supply / return exist (engine 1.7.0, `__hallIsoGeo`) and print only in tooltips. | No hall-level operating point on the floor. |
| M7 | `buswayPct` (93.9 %, `distribution.busway_loading_pct`) is published to the adapter and drawn nowhere; no limit for it exists in any registry. | Power lens = rack fill only. |
| M8 | 3D: 0 running animations (rotors are Plan-only); 390 px: rack short side 3.5 px. | Noted; §5 phase A6c. |

## 2 · Design (A6a — this phase)

All drawing stays in `js/conv/floor-plan.js` behind ONE opt-in, `opts.overlay(api)`: after every build the floor hands the
page an overlay `<g class="fp-ovl">` placed under the rings, its projection (`P`, `XY`), geometry (`G`, bands, rows) and
`u`. The Conventional hall passes nothing and is byte-identical in behaviour. The DC AI adapter (`hall-iso.js`) draws:

- **D1 Cooling lens — the liquid path.** A TCS supply / return header pair runs along the service corridor across every
  row pair; from it each row pair gets a supply and a return branch up its contained hot aisle (the rack manifolds sit
  at the rear doors). Supply and return get two liquid tokens of the floor (`--fp-liq-sup` cool, `--fp-liq-ret` warm, both muted,
  per theme) — never the amber / red state tokens. The dash moves at `RZConvVfx.dashSeconds(flow / design flow)` — one period from the engine ratio
  `cduLoad / 100`; reduced motion: still. Each branch carries `<title>` "R03/04 TCS branch · 8,010 L/min · 40.0 → 50.0 °C".
- **D2 Thermal lens — the stations.** `SENS_PTS` dots per cold aisle side and per hot aisle of each row pair, evenly along
  the rack line (3 per aisle today), at the reading's own value: inlet dots state-classified on the lens thresholds (warn > 27 °C, alarm
  > 30 °C), hot-aisle dots neutral ink unless the page alarms them. `data-v` = the reading, `<title>` = "R03/04 cold
  aisle point 2 · 24.8 °C". No numbers painted at rest (less visible text); the row tag says the range (D4).
- **D3 Power lens — the busway.** One bar per row pair along its line head: length = `buswayPct`, neutral ink — the
  registry holds no busway limit, so the bar claims no state (an invented 80/90 % would be fake); `<title>`
  "R03/04 busway · 93.9 % of trunk rating (no limit registered)".
- **D4 Row tags speak the lens.** Status / Power: row kW (today). Thermal: "24.8 / 36.0 °C" (mean inlet / hot aisle of
  that pair from the same stations). Cooling: the pair's TCS flow (hall flow = `cduLpm` × running CDUs, ÷ row pairs: 8,010 L/min). Layout: the pair name only. Phone keeps its short forms.
- **D5 Operating point of the hall, beside the floor.** In Thermal and Cooling, three chips under the lens legend (the
  column right of the floor at 1440, under it on a phone; never over a unit): "FW-N 45 run · fan 99.7 % · 54,136 m³/h
  each", "FW-S 44 run …", "CDU 54 run · pump 98.9 % · TCS 40.0 → 50.0 °C". Mono numbers, 1 px hairline, no wash.
  Run counts are the gallery's running cells on the floor; every other number is `__hallIsoGeo` (engine 1.7.0); missing → "—".
- **D2b Readings move.** The page writes the aisle readouts every scan (declared simulated jitter about the engine air
  planes); it now dispatches `rz-hall-readings` right after, and the floor re-reads its stations and Thermal tags on it,
  so a dot always shows the number the Drawing view shows. A station without a reading is dotted (stale, as A5e).
- **D6 Fill M4.** D1's header occupies the corridor in Cooling; in every other lens the corridor gets a hairline label
  "SERVICE CORRIDOR · 4.6 m" at its west end (2D only), so the band reads as a place, not a gap.

Not built here: 3D rotors and the phone rotation (A6c), aisle numbers at rest (owner: less text), valve stems (no valve %
in the engine for fan-walls; inventing one would be fake).

## 3 · Laws (`tools/test-dcai-floor-lens.mjs`, 1440 2D + 3D, 390 2D)

- **FL1 Lenses differ.** Cooling shows ≥ 2 headers + 2 branches per row pair (≥ 22 visible `.ovl-pipe`); Status, Thermal,
  Power, Layout show 0 pipes. Thermal shows stations, the others 0.
- **FL2 Stations are the readings.** Thermal: stations = row pairs × 2 × `SENS_PTS`; each `data-v` equals the page's
  `C/H{z}{s}t` text (±0.05); a cold dot's state follows the thresholds.
- **FL3 Pipe motion is the engine's.** Each pipe's computed `animation-duration` = `RZConvVfx.dashSeconds(cduLoad/100)`
  ±5 %; with `prefers-reduced-motion: reduce` 0 running animations in `.fp-ovl`.
- **FL4 Tags speak the lens.** Thermal tags carry "°C", Cooling "L/min", Status "kW"; each value equals the adapter's
  source (station mean, `cduLpm`, row heat).
- **FL5 Hall chips equal the engine.** 3 chips in Thermal and Cooling, 0 in Status; their numbers equal
  `__hallIsoGeo` (fan %, air m³/h, run counts, pump %, TCS °C).
- **FL6 Power bars.** 10 bars in Power, length ratio = `buswayPct`/100 ±2 %, no state attribute, 0 elsewhere.
- **FL7 Nothing broken.** 0 page errors; the Conventional `datahall.html` draws no `.fp-ovl` (shared module unchanged
  for it); no chip lies over the floor, chips clear each other, at 1440 they sit in the column right of the floor; no
  row tag is cut by the stage edge after its text changes with the lens (3D: the tag slides left as at build).

Red on 4a1b15c33 expected: FL1–FL6 (no overlay exists). Neighbours: select, stale, flag-list, hall-views (ship `--only`),
hall-iso, unit-ops, conv floor-plan, datahall-space.

## 4 · Risks

- **R1 Shared module.** `floor-plan.js` gains one optional hook; SL5 / SP1–SP10 / conv floor-plan guard the default.
- **R2 Clutter.** Overlays show only in their lens; ≤ 3 chips; no numbers on stations at rest.
- **R3 Perf.** +20 pipes, +80 dots, 10 bars ≈ +110 nodes; one CSS dash animation per pipe, paused off-screen like `.fp-air`.

## 4b · Status (2026-11-26)

A6a built on 4a1b15c33 (`js/conv/floor-plan.js` `opts.overlay`, `js/datahall-ai/hall-iso.js`, `datahallAI.html`
`tcsSupC/tcsRetC` + `rz-hall-readings`). `tools/test-dcai-floor-lens.mjs`: red 60 of 95 before, green 114 / 114. The
cut-tag check was proven by mutation (slide disabled → 3 FL7 failures). Screenshots read: 1440 2D and 3D in Thermal,
Cooling, Power; 390 Thermal and Cooling. Found by the law while building: the chips first pushed the legend under the
floor (2D column is 158 px), and the 3D tag of R19/20 ran off the stage once it carried temperatures.

## 5 · Phases

| phase | content |
|---|---|
| A6a (this) | D1–D6, laws FL1–FL7 |
| A6b | per-station trends (click a dot → `RZTrend`), station alarm flags into the alarm list |
| A6c | 3D rotors, phone plan rotated so the long axis runs down the screen (rack short side ≥ 7 px at 390) |
