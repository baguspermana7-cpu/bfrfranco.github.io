# PRD-DCAI-HALL-DEPTH — Amendment 9: no service corridor

Owner, 2026-11-26: "Gak perlu ada service corridor" (no service corridor is needed).

## 1. What was there (v3.113.0, engine 1.8.0)

The data hall had a 4.6 m **service corridor** between the rack row ends and the CDU line. It came from the engine
geometry (`geometry.crossAisleM: 4.6`, ADOPTED in v3.21.7: TCS headers overhead, busway feeders, egress). The hall width
was a typed 31 m, but the width stack (two 3 m fan-wall galleries + a 13.2 m row + the corridor + a 3.9 m CDU line) was
27.7 m. That left 3.3 m of empty floor behind the CDUs. The floor drew "SERVICE CORRIDOR · 4.6 m". The Drawing view drew
a grey band, a caption and egress doors in it.

| | v3.113.0 | without the corridor, hall kept 31 m | Amendment 9 |
|---|---|---|---|
| width stack | 27.7 m | 23.1 m | 23.1 m |
| hall width | 31 m | 31 m (7.9 m empty) | **23.1 m** (0 m empty) |
| hall area | 1,922 m² | 1,922 m² | **1,432.2 m²** |
| IT density | 32.5 kW/m² | 32.5 kW/m² | **43.6 kW/m²** |

Removing only the corridor would have left 7.9 m of empty floor, which is worse than before. So the ask means this:
the corridor goes, and the hall closes on its width the same way it already closes on its length (62 m = 10 × 6.2 m).

## 2. Decisions

1. `geometry.crossAisleM` 4.6 → **0**. The row ends face the CDU line's own north access aisle (1 m, inside
   `cduLineDepthM` 3.9 = 1 + 1.9 + 1). That aisle is the walkway along the row ends. **ASSUMED:** a 1 m aisle is enough
   for egress. It is not checked against a code clause.
2. `geometry.widthM` 31 → **23.1** (= the width stack). New engine output: `geometry.width_stack_slack_m` = width −
   stack = 0. Every consumer of the hall width follows by derivation, with no page edits: building plate, electrical
   wing, fire detector counts and PDF sheets.
3. The TCS supply and return headers run overhead above the north access aisle, and the leak rope runs under them. The
   busway feeders and trays run above the CDU line's south aisle, beside the HTW header.
4. "Corridor Service" HMI → **Row-end services** (same equipment: FWS instruments, leak rope, cable tray). The floor
   label, the Room Layout "Service corridor" row and the Drawing view corridor band and caption are removed.
5. Engine 1.8.0 → **1.9.0**; release v3.114.0.

## 3. Laws and proof

| law | check | red on 5b99e45c7 | green |
|---|---|---|---|
| NC1 engine: corridor 0 m and 0 m², hall width = width stack, slack 0, area 1,432.2 m² | `test-dcai-engine` | 4 fails (4.6 m; 31 vs 27.7; no slack; 1,922) | 609/0 |
| NC2 floor 2D/3D, Status/Cooling, 1440/390: no corridor text; CDU face ≤ 1.05 m from the row ends; south gallery ≤ 1.05 m behind the CDUs | `test-dcai-no-corridor` | "SERVICE CORRIDOR · 4.6 m"; 5.60 m; 4.30 m | 0.00–1.0 m |
| NC3 Drawing view: no corridor text; TCS headers inside the 1 m row-end aisle; drawn hall = engine L × W | `test-dcai-no-corridor` | "CORRIDOR", headers 56 px north of the aisle | pass |
| NC5 0 page errors; FL1–FL7, A8 (55), hall views (164) unchanged | gates | — | pass |

Found while building: `hall-iso.js metric()` refused a 0 m cross aisle, so the floor silently fell back to the
non-metric layout (HV-G1/G2 red, 8 of 13). A zero is now accepted for the cross aisle only. The 62 × 23.1 m hall is
width-bound on a desktop, so the floor now measures the wrap minus the legend column. Without that, the legend and the
operating-point chips were pushed under the floor (FL7 red).

## 4. Not done

- The egress adequacy of the 1 m row-end aisle (decision 1) is not checked against a code clause.
- `HV-P1` (Cooling lens values on every unit) is red on origin as well. It is not in the release gate set and is not
  changed here.

## Follow-up (2026-11-28): the 1 m row-end aisle against the egress clauses

Decision 1 leaves a 1 m walkway along the row ends and marks it ASSUMED. Checked on 2026-11-28 against published
adoptions of IBC 2021 chapter 10. The base ICC text was not retrieved; the figures below are from state and local
adoptions that carry the model-code values.

- **Aisle minimum (IBC §1018):** clear width by the occupant load served (§1005.1), and not less than 36 in (914 mm).
  Minnesota adoption, Minn. R. 1305.1018:
  https://www.law.cornell.edu/regulations/minnesota/Minn-R-1305-1018
- **Aisles outside assembly, Group B and Group M (§1018.5):** width by §1005.1 and not less than the corridor width the
  code requires. California guide: https://corada.com/documents/2022CBCPG/1018-5-aisles-in-other-than-assembly-spaces-and-groups-b-and-m
- **Corridor width table:** 44 in (1,118 mm) in general, 36 in (914 mm) where the occupant load is under 50, 24 in
  (610 mm) for access to mechanical, plumbing or electrical equipment. Chicago adoption:
  https://codelibrary.amlegal.com/codes/chicago/latest/chicago_il/0-0-0-2665038 (numbered 1020.2 there).

What that means for this hall (62 m x 23.1 m = 1,432 m² = 15,414 ft²):

| reading of the code | occupants | required | 1 m aisle |
|---|---|---|---|
| aisle minimum (§1018) | any | 914 mm | passes, +86 mm |
| equipment-access width | n/a | 610 mm | passes |
| §1018.5 -> corridor, occupant load < 50 | < 50 | 914 mm | passes |
| §1018.5 -> corridor, occupant load >= 50 | >= 50 | 1,118 mm | **short by 118 mm** |

The occupant load decides it. Table 1004.5 gives 300 ft² per occupant for storage/mechanical use, which is 52
occupants here (>= 50). An approved actual count (a data hall staffed by a few technicians) is permitted under §1004.
So the 1 m aisle is adequate only if the hall's occupant load is set below 50 by the authority, or the walkway counts
as equipment access.

**Status:** still ASSUMED, now with the condition named. Widening it to 1.12 m would add 0.12 m to the width stack
(`geometry.widthM` 23.1 -> 23.22) and move every derived consumer. That is a design decision for the owner, not a
silent fix. Not checked: NFPA 101 (life safety) and the local adoption that would govern a real site.
