# PRD-DCAI-HALL-DEPTH — Amendment 10: the hall operating, visible at rest (v3.116.0)

Owner, 2026-11-27: "Hampir nggak ada perubahan signifikan yg page datahall dan room layout" (almost no significant change
on the Data Hall page and the Room Layout).

## 1. Problem (measured on live v3.114.0, screenshots read)

Amendments 7–9 put real content on the floor: 80 aisle stations, valves, rotors, return air, no corridor. Almost all of
it was out of sight.

| where | what a first visit saw | cause |
|---|---|---|
| Data Hall, first screen | Status lens: grey racks, ten "6,248 kW" tags, the same picture as before A7 | default lens `status` |
| Thermal lens | 80 dots and no numbers; values only in tooltips | stations drew no text |
| Thermal / Cooling | supply air, return air and valve % only in three 150 px chips beside the floor | `drawOps` chips |
| Cooling lens | valve bars 1.5 px thick | floor-plan default stroke |
| Room Layout, building | drawn at 1.5× (a fixed 1860 px minimum width), so the title and the right half were cut off | `R('#bldgSvg', {minWidth:1860})` |
| Room Layout, DH-A-101 | Z01 printed above Z05 on one line: the CDU zone's tag in the rack field, the rack zone's in the CDU line (A9: cross aisle 0 put both tag rows at one y); the L2 support strip ran past the sheet's right edge | tag y from `bands[2]` / `bands[3]`, sheet width + 400 |

## 2. Decisions

1. **Default lens = Thermal.** A stored lens still wins for a returning user.
2. **Thermal prints the readings.** Each of the 80 stations prints its value under its point (mono 9 px with a halo
   stroke). Below 1000 px only the warmest inlet of each row pair prints (the point the A8b ring already marks).
   This trades against the owner's "less visible text" rule. Numbers print only in Thermal; Status stays quiet.
3. **Aisle tints.** Each pair's half of the cold aisle takes the state of its worst inlet point (warn or alarm in the
   state colours). At normal it carries the faint supply-liquid identity tint. The contained hot aisle carries the
   return identity tint, never a state colour. 2D only.
4. **Operating lines on the floor.** Thermal and Cooling print one line per band. FAN WALL N/S shows run count, SA, RA,
   fan % and CHW valve %. CDU LINE shows run count, TCS supply → return, pump % and FWS valve %. The run count is read
   off the drawn cells once the floor has marked its standbys. A phone (< 600 px) keeps the chips.
5. **Polish.** Operating lines sit on a graphite plate with a 1 px hairline. The Thermal key lists the two aisle
   identity tints.
6. **Cooling valve bars** are drawn 4 px thick (DC AI CSS only; Conv unchanged).
7. **Building overview** drops the 1860 px minimum. Its smallest label is 9 units in a 1200 viewBox, so a desktop pane
   shows it whole at 1.0×. A phone keeps the 8.5 px legibility floor and pans.
8. **DH-A-101.** Rack-zone tags Z05–Z08 sit in the CDU line's 1 m access aisle at the row ends. CDU-zone tags Z01–Z04
   sit on the CDU line's south edge. The sheet is as wide as the hall plus the support strip. Standby CDUs and
   fan-wall modules carry `standby` (engine duty counts).

## 3. Laws — `tools/test-dcai-visible-at-rest.mjs`

| law | claim | red on d5f06e3a9 | green |
|---|---|---|---|
| VR1 | 1440, fresh storage: lens Thermal; >= 80 printed readings, each = its station; none overlap | status, 0 printed | 80, 0 overlaps |
| VR2 | FAN WALL N/S lines carry SA, RA, fan, CHW valve; CDU line TCS, pump, FWS valve = adapter numbers; run counts sum to the running fan walls | no lines | 3 lines, 44 + 45 = 89 |
| VR3 | a planted 28.0 °C inlet turns that pair's cold aisle warn, the neighbour stays ok, the point prints 28.0 | no aisle | warn / ok |
| VR4 | 390: one printed reading per pair, no overlaps | 0 | 10 |
| VR5 | 1440: building at 1.0×, no sideways scroll; title inside the viewBox at every width | 1.50×, 1860 > 1240 | 1.00× |
| VR6 | DH-A-101: no tag overlaps; CDU-zone tags a row south of rack-zone tags; standby units = engine; support strip inside | Z01–Z04 above Z05–Z08 | 68 px apart |
| VR7 | 0 page errors | — | 0 |
| VR8 | each operating line sits on a plate that contains it | no plate | 3 plates |
| VR9 | the Thermal key names the cold and hot aisle tints; Status does not | 0 items | 2 / 0 |

`test-dcai-floor-lens` FL5 now reads the printed lines at >= 600 px and the chips on a phone. Writing that check
caught a real defect: the first version counted run cells before the floor had marked its standbys (45 + 45 ≠ 89).

## 4. Not done

- The building overview on a phone still pans (legibility floor).
- DH-A-101 still pans inside its pane at 1440 (its own legibility scale). The support strip is now inside the sheet.
- 3D draws no aisle tints (the printed readings and lines do show).

## Follow-up v3.117.0

Live check of v3.116.0 found the building's ground floor hidden at 1440 x 900: the shared `.svg-zi` cap
(`100vh - 160px` = 740 px) is shorter than the 879 px drawing. VR5 now asserts 0 px hidden below the zoom box (red
139 / 174 px, green after `.svg-zi:has(#bldgSvg){max-height:none}`).
