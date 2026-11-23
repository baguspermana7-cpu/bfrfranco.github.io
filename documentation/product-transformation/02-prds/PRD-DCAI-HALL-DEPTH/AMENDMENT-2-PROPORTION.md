# PRD-DCAI-HALL-DEPTH — Amendment 2: proportion (one placement for every view)

Owner, 2026-11-23: "Arrangement harus accurate dan valid dan comprehensive", then on the floor: "Sangat tidak
proportional positioning dan sizenya datahall. Jelek sekali."

Status: P1–P3 SHIPPED v3.103.0, together with A3/A4/D10 of Amendment 1. Laws HV-G1 (updated) and HV-G2 were red 8
of 18 on the allotment boxes. HV-F2 adds head centring and visible-head spacing at 390, red 2 of 6 and then 1 of 6
(every other head hidden).

## 1 · What is wrong (measured, not guessed)

| # | View | Measured | Should be |
|---|------|----------|-----------|
| M1 | 2D / 3D, live v3.101.0 | The hall is drawn as a schematic, a 35 × 41-unit portrait. At 1440 the floor takes 443 × 530 px of a 1060 px stage, leaving half the stage empty. | 62 × 31 m landscape, aspect 2.00, as wide as the stage. |
| M2 | 2D / 3D, live | Each rack takes 1.5 units along the row against a 1 unit depth, so a row reads long and thin. Galleries are 1.6 units, the CDU line hugs the racks, and the south gallery is not on a wall. | Rack 1.2 × 0.6 m, galleries on both long walls, the CDU line after the 4.6 m corridor. |
| M3 | 2D / 3D, v3.103.0 candidate (D10) | Each fan-wall module is drawn as its whole allotment, 1.38 × 3.0 m (4.1 m²) = 5.7 racks. Each CDU is drawn as 1.13 × 3.9 m (4.4 m²) = 6.1 racks. | Module body 1.0 m deep on the hall face of its 3 m gallery. CDU body 0.9 × 1.9 m. Both match the Drawing view. |
| M4 | 2D / 3D, candidate | The 55 CDUs are spread evenly over 62 m. | The Drawing view groups them under the containment pair they serve: 5 or 6 per pair at 0.95 m, centred on the pair. |
| M5 | all | Three views, two placements. The Drawing view places units by its own formulas, and the floor places them by slot. | One placement. The 2D and 3D floor box of a unit equals its Drawing-view box. |

## 2 · Design

- **P1 — One placement source.** The Drawing view's unit placement (module fill 0.86 of the module pitch, body
  1.0 m on the hall face; CDU 0.9 × 1.9 m, 1.0 m into the CDU line, 0.95 m pitch, grouped per pair) becomes one
  named object, `HALL_PLACE`. The Drawing reads it, and so does `__hallIsoGeo.m.place`. These are drawing
  allotments of the unit class, not engine quantities. They are declared as such in the tooltip basis.
- **P2 — The floor draws the unit, not its allotment.** `hall-iso.js` gives each fan-wall module and CDU a box in
  metres (`unit.box = {x, y, w, d}`), from the engine geometry and `HALL_PLACE`. `floor-plan.js` draws a unit at its
  box when `opts.geo` is set (fan grille, lamp, rotor and label follow the box). The Conventional hall is unchanged.
- **P3 — What the space is.** The gallery strip, the corridor and the CDU line keep their floor tone. The empty
  service strip and corridor are where they are in the building, so nothing is drawn into them to fill space.
- Not in scope: unit body height in 3D (it stays the renderer's 1.6 for galleries); per-unit chips (A5).

## 3 · Laws (each red on the state before it)

- **HV-G1 (updated).** The slab is 62 × 31 m at 1440 and at 390. The rack tops are 1.2 × 0.6 m, and the 20 row
  faces sit at the Drawing positions. Every fan-wall body lies inside its gallery (north 0–3 m, south 28–31 m) on
  the hall face. Every CDU body lies inside the CDU line (20.8–24.7 m). The engine gives 45 modules per gallery at
  1.378 m.
- **HV-G2 (new).** For every `crah:NN` and `cdu:N`, the 2D floor box equals the Drawing-view box of the same unit
  within 0.05 m on x, y, w and d. That is 145 units at 1440 and at 390. Red on the D10 candidate (allotment boxes,
  evenly spread CDUs).
- **HV-F1, F2, D1, M1, M2** stay green. The whole hall is on the first screen, there is no tag overlap, the floor is
  deterministic and the rotors still turn at speed.

## 4 · Risks

- A box narrower than the old slot makes the fan grille and rotor smaller. They take the box, so a rotor's period
  law is unaffected.
- The Drawing view is the reference. If its placement is wrong, every view is wrong together, and G2 cannot see
  that. The owner reviews the screenshot of all three views at the same scale.
</content>
</invoke>
