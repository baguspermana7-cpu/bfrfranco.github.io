# PRD-CONV-OPS-DEPTH — Every Conventional cockpit reads like a real SCADA/BMS operator screen

Status: DRAFT for owner (2026-11-22). Owner requests R187 (datahall 3D + plan), R188 (chiller plant and every other
page), R189 (ACC condenser fans, CRAH speed and valve opening).

## 1. Owner request (verbatim)

> "dan yang datahall baik 3d dan plan, ini sangat kurang banyak parameter2 operation belum ada, misal temp di 4 titik
> per aisle/row, kemudian return air tempnya, animasi dari crah, dll. ini masih sangat kurang implemetnt all, rancang prdnnya"

> "chiller plant itu juga masih sanga2 kurang, tambahkan animasi dan beberapa parameter2 seperti cwp itu speednya berapa
> dan misal ada PICV or MV tk bypass, buffert tankl thermal belum ada, 3-wayvalve itu juga belum ada dan atur pembukaannya
> itu balancing, dan harusnya secara design yang modern chiller itu stanby running jadi dia tetap runnign seper yang duty,
> ada banyak yang belum ada di chiller plan scada hmi ini, banyak, dan juga page2 lain selain chiller plan ini, rancang
> masing2 prd utk peraikan dan improvement."

> "terus di chiller itu misal pakai ACC itu condensornya sedang running berapa dan speednya sedang berapa. terus speed
> CRAH, openign control valve ya crah, banyak dah yang belum ada, ini masih kurang komprehensive"

## 2. The common rule set (applies to every page PRD)

| # | rule |
|---|---|
| C1 | Every operating parameter a real operator reads on that equipment is shown: speed % and Hz, valve opening %, running N of M, setpoint vs actual, ΔT, flow, pressure, sensor arrays. |
| C2 | Every number is the engine (`js/conv-engine.js`, existing key or a NEW key with its physical relation and source), the page's simulation, or "not modelled". Nothing is typed into a drawing. |
| C3 | Control logic is visible as steady-state relations: staging, standby-running, DP reset, bypass, balancing. No fake dynamics, no `Math.random`. |
| C4 | Physical animation only: fan blades at a rate ∝ speed %, flow dashes at a rate ∝ flow, valve stem = opening %, tank level. No glow, no decorative motion; reduced motion = still with the value text. |
| C5 | Less visible text: tags and one value per symbol on the sheet; the rest in tooltips, the equipment modal (PRD-CONV-EQUIPMENT-INSIDE) and the trend. State colours only from `--rz-pt-*`. |
| C6 | 390 px and 1440 px: no overlap, no text outside the drawing, no line through text, 0 page errors. |
| C7 | Laws → proof, red before green; every law named in the page PRD has a gate in `tools/ship-gate.sh` and runs in `tools/run-conv-release-gates.sh`. |

## 3. Page PRDs

| # | file | page | owner items it must close |
|---|---|---|---|
| 01 | `01-CHILLER-PLANT.md` | chiller-plant.html | CWP/CHWP speed, PICV + bypass MV, buffer tank, 3-way valve + balancing, standby-running, ACC condenser fans N + speed, animation |
| 02 | `02-DATAHALL.md` | datahall.html (3D + Plan) | 4 temperatures per aisle/row, return air, CRAH fan speed, CRAH valve opening, CRAH animation |
| 03 | `03-WATER-SYSTEM.md` | water-system.html | "page2 lain" |
| 04 | `04-FIRE-SYSTEM.md` | fire-system.html | "page2 lain" |
| 05 | `05-FUEL-SYSTEM.md` | fuel-system.html | "page2 lain" |
| 06 | `06-ICT.md` | ict.html | "page2 lain" |
| 07 | `07-DC-CONVENTIONAL.md` | dc-conventional.html | "page2 lain" (overview) |
| — | peer PRD-ELECTRICAL-BMS | EPMS_Telemetry.html | owned by the peer session (R186 electrical); not redesigned here |

## 4. Order

Engine first (shared keys, one conv-engine minor per phase), then 01 chiller and 02 datahall (named by the owner), then
07 overview (it reads the new keys), then 03–06. Each page phase is one release with its own gate; the equipment-modal
classes (PRD-CONV-EQUIPMENT-INSIDE P5–P7) pick up the same keys so the sheet and the modal never disagree.

## 5. Related PRDs owned by the peer session (approved 2026-11-22)

- `documentation/prd/PRD_SETPOINT_SIM.md` (R187): setpoints and thresholds next to every live value, the SP line on trends
  (`RZTrend.register` keys `sp` / `spLabel` / `spSim`, dashed ink), what-if on an SP in the modal, emergency sequences and
  P&ID control loops. Every SP display, SP line, what-if and emergency sequence named in pages 01–07 is delivered by that
  PRD; this programme supplies only the actual values those rows sit next to.
- `documentation/prd/PRD_ELECTRICAL_BMS.md` (R186, R190, R191): EPMS and DC AI electrical sheets, true fit-to-screen,
  trapped-key interlocks, UPS module quantity per stream, LV path to PDU / RPP / rack.

Both live on the peer branch `electrical-bms` until they ship; the paths are the paths they will have on main.

## 6. Decisions taken (2026-11-23)

On 2026-11-23 the owner said "Selesaikan" and earlier "Jangan tanya saya". The open questions are therefore closed with the
owner's stated direction where one exists, and with the PRD recommendation otherwise. The owner can overturn any of them.

| PRD | Question | Decision | Basis |
|---|---|---|---|
| 01 | Q1 standby-running | Selectable mode first (`lead-lag` stays default). The adopted default changes to standby-running in a later release, after the P5 gates are green. | Owner R188: "modern chiller itu standby running". 33 files and their gates move with `chillers_running`, so the change is staged. |
| 01 | Q2 buffer tank | 15 min ride-through (884 m³ at today's heat load), declared ASSUMED in the Basis of Design. | Covers a chiller restart after a utility outage (typically 10–15 min). 5 min would not. |
| 01 | Q3 ACC | Plant-level design alternative, sheet CH-M-103, P6, default off | PRD recommendation |
| 02 | Q1 CRAH N+1 | All 59 run at 97.8 % (no cold standby) | Same rule as the chiller standby-running request |
| 02 | Q2 row spread | Derived physics (rows differ by load) | No invented balance; the engine's load decides |
| 02 | Q3 tile / leakage | Declared ASSUMED values A5, A6, each labelled with its source | Better than leaving it "not modelled"; every value carries its basis |
| DCAI | Q1 standby-running | All installed fan-wall and CDU units run (no cold standby) | Owner R188 |
| DCAI | Q2 sibling tabs | Keep as separate reference sheets, with the shared Fit and the label fixes | Smallest change; the owner asked for fit, not for removal |
| DCAI | Q3 DH-1…DH-8 | Keep eight buttons; 2–8 say "identical to DH-1" | Honest: the engine has no per-hall differences |

Execution order: 01 chiller → 02 datahall → DC AI hall → 07 overview → 03 water / 04 fire / 05 fuel / 06 ICT.
