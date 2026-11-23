# PRD-DCAI-HALL-DEPTH — Amendment 1: Flat 2D (default), a 3D worth reading, every unit with its operating state

Status: A0–A1 SHIPPED v3.99.0 (gate `test-dcai-hall-views.mjs` V1–V3, F1, F2, D1); A2 v3.101.0 (L1, S0, T1; F2 kept); A3 engine keys, tooltips and table + A4 rotors v3.102.0 (A1, M1, M2 + `test-dcai-unit-ops` U1–U4); A5–A6 in build · Author: Claude (Opus 5.5) for the owner · Date: 2026-11-23
Parent: `PRD.md` in this folder (census B1–B15, parameter catalogue §5, control relations §6, laws HD-*, phases P0–P5).
This amendment does NOT repeat the parent. It changes the **views**, adds the **display placement** of the parent's
parameters per view, the **state and animation grammar**, the **indicators**, and the laws and phases that prove them.
Where the two disagree, this amendment wins for views, placement, motion and indicators; the parent wins for every
number, formula and source class.

Owner request (2026-11-23, verbatim):
> "Datahallai itu juga 3dnya maaih jelek banyak parameter, animasi state, indikaai vanyak yg belum ada ops parameter.
> Dan yg button flat 2d nya belum ada. Rancang prd dengan sangan comprehensive , default ia 2d."

Read as four demands: (R1) the 3D is still ugly; (R2) many parameters, state animations and indicators are missing —
units carry no operating parameters; (R3) there is no Flat 2D button; (R4) the default view is 2D.

Owner standing rules that bind every line below: no fake functionality; laws → proof, red before green; BMS colours
green / amber / red only for state; no glow, no decorative motion; physical animation is wanted; less visible text
(explanations in tooltips); a value is an engine key, a named simulation, or the words "not modelled".

Ownership: `datahallAI.html` and `js/datahall-ai/*` belong to the peer session; `js/conv/floor-plan.js` is shared with
the Conventional hall (`datahall.html`). Build order and hand-off are in §13. Nothing here is built before the peer
agrees the split.

---

## 1. Census of today (measured 2026-11-23 on rz-cp1 = v3.95.0 candidate, headless Chrome 148)

Method: `tools/test-dcai-hall-iso.mjs --shots` plus a one-off probe (signed-in educator stub, Data Hall tab, DH-01),
1440×900 dark and light, 390×844 dark; counts read from the DOM, screenshots looked at.
Shots: `scratchpad/dcai/dcai-iso-dark-1440.png`, `dcai-iso-dark-390.png`, `v-iso-light-1440.png`, `v-plan-dark-1440.png`.

| # | finding | evidence | demand |
|---|---|---|---|
| V1 | Only two buttons, **3D** and **Plan**. "Plan" opens the engineering drawing `#hSvg`, not a flat operator floor. There is no Flat 2D. | `hall-iso.js:320` `[['iso','3D'],['plan','Plan']]`; `.fp-proj-btn` count 0 (floor-plan's own toggle not exposed) | R3 |
| V2 | Default is 3D on any stage ≥ 600 px, Plan (drawing) on a phone. | `hall-iso.js` header comment; key `rz.dcai.proj` | R4 |
| V3 | At 1440×900 the 3D stage starts at y = 434: the IT/liquid/air header cards sit above it, so 466 px of an 828 px stage shows on the first screen; the CDU line and the south fan-wall gallery are below the fold. | stage rect `[184,434,1254,828]` | R1 |
| V4 | At 390×844 the stage starts at y = 644 (200 px visible); a stale caption "DRAWN AT 3.3× SO EVERY LABEL CLEARS THE 8.5 PX FLOOR — SCROLL TO PAN" sits above it; pod tags overlap one another at the right edge. | stage rect `[8,644,376,371]`; `dcai-iso-dark-390.png` | R1 |
| V5 | The 3D floor carries **20 text nodes**, all of them the 10 pod tags (`R01/02 6248`). The number has no unit; the pod's cold/hot temperatures are in the DOM but not visible. No CRAH, CDU, row, busway or valve value anywhere. | census `texts 20, nums 20` | R2 |
| V6 | **0** elements carry `data-point`; no 3D value opens a trend; no limit state is computed for any 3D value. | census `pts 0` | R2 |
| V7 | 585 lamps = 440 racks + 90 fan-wall modules + 55 CDUs, every one green in NORMAL, including the module and the CDU the engine declares standby (89 duty + 1, 54 duty + 1). | census `lamps 585`; header text "89 duty + 1", "54 duty + 1" | R2 |
| V8 | No legend, no lens (mode) selector in 3D, although `floor-plan.js` already paints five modes (`power`, `temp`, `cooling-margin`, `alarms`, `space`) and writes a legend for each. The page fixes the mode. | `floor-plan.js:60`, `:780`; census `legend false` | R2 |
| V9 | Motion in 3D: 32 running animations, none of them tied to a quantity (no fan rotor period from fan %, no flow from L/min, no valve stem). The drawing has 143. | census `anim 32 / 143` | R2 |
| V10 | Cabinets are one grey extrusion with a green dot; pods, hot-aisle roofs, the CDU line and the fan walls share the same grey and the same height, so the eye cannot separate rack field from plant. Light theme: the floor washes into the page (low contrast between slab, cabinet top and side). | `v-iso-light-1440.png`, `dcai-iso-dark-1440.png` | R1 |
| V11 | The drawing's aisle sensors print a spread (hot 33.8 … 38.1 °C, cold 25.5 … 26.5 °C) while the engine's balanced hall is 25.0 / 36.0 everywhere. The parent PRD §6.4 already names this as simulation, not physics. 3D reads these sensors (`readSensors()`), so the noise reaches 3D too. | `v-plan-dark-1440.png`; `hall-iso.js:167` | R2 |
| V12 | One rack shows red in 3D (the status bar's "Critical 1"), but nothing on the floor says which point, which limit, or since when. | `dcai-iso-dark-1440.png` | R2 |

What is already good and must stay: one shared renderer (`floor-plan.js`), true 30° isometric, equal-height cabinets,
grey-is-normal, the equipment reference on every unit (a click opens the same HMI the drawing opens), the drawing
itself (dense and correct, it becomes the third view, unchanged).

---

## 2. Goals and non-goals

**Goals**
- G1. Three views on one switch: **2D** (default, every width), **3D**, **Drawing**. Same model, same selection, same
  lens, same scenario across a switch; a switch never re-runs the engine.
- G2. Every unit on the floor shows its **operating state** (lamp + state word in the tooltip) and, by lens, its
  **operating value** with unit and limit state. The catalogue is the parent's §5; §6 here says where each one shows.
- G3. **State animation is physical**: speed from the quantity, still when the quantity is zero, one rule per
  motion type (§7). Standby and trip look different from run without colour alone.
- G4. **Indicators**: an alarm on the floor names its point, its limit and its age; a summary strip counts by
  severity per view; every indicator opens the trend.
- G5. The 3D is readable at 1440×900 and 390×844: the whole hall fits, the rack field and the plant read as
  different things, labels never overlap (§5).

**Non-goals**
- Setpoint edits, what-if sliders (→ `PRD_SETPOINT_SIM.md`); electrical SLD sheets (→ `PRD_ELECTRICAL_BMS.md`);
  CFD; a WebGL renderer; any colour outside the BMS state set for state; decorative motion; a second copy of the
  engine arithmetic in the page.
- Removing the engineering drawing. It stays, renamed "Drawing".

---

## 3. The view switch

### 3.1 Control
- One segmented control, three buttons, in this order: **2D · 3D · Drawing**. `role="group"`, `aria-label="Hall view"`,
  each a `<button aria-pressed>`. Placement: where the 3D/Plan pair sits today (right of the KPI strip), same height
  (32 px desktop, 44 px touch target on a phone).
- Tooltip per button (no visible helper text): 2D "Top view of the floor, one symbol per unit, values by lens";
  3D "Isometric floor"; Drawing "Engineering drawing with every layer, sensor and dimension".
- Keyboard: Tab reaches the group; Left/Right move between buttons; Enter/Space selects. No animation on a keyboard
  switch (MOTION_STANDARD frequency rule); a pointer switch cross-fades 120 ms (`--rz-dur-*`), opacity only.

### 3.2 Storage and default
- New key `rz.dcai.view` ∈ {`flat`, `iso`, `drawing`}. Missing or invalid → **`flat`** at every width (R4).
- The old key `rz.dcai.proj` is **not migrated**: every visitor lands on 2D once (the owner's default), then their
  choice is kept. The old key is deleted on first load so it cannot come back.
- URL override `?view=flat|iso|drawing` for links from the manual and the alarm list; it does not write storage.

### 3.3 What persists across a switch
Selection (unit or row), lens, scenario, zoom-to-fit state (each view fits on entry; an explicit zoom is per view),
the open tooltip closes. The header cards (IT / liquid / air) show in every view; in 2D and 3D they collapse to one
line (§4.1) so the floor gets the screen.

---

## 4. Flat 2D (the default view)

### 4.1 Layout
- Renderer: `floor-plan.js` with `proj = 'plan'` — the same model 3D uses (racks, pods, roofs, CDU line, fan-wall
  galleries), drawn top-down. No new renderer, no new model.
- Stage first: the IT/liquid/air cards become one **summary line** above the stage (`IT 67,382 kW · Liquid 53,108 kWth
  (85 %) · Air 17,755 kWth`), full cards in a disclosure ("Hall totals"). The stage starts ≤ 200 px from the tab bar
  at 1440×900 and ≤ 260 px at 390×844.
- Fit: the whole hall (rack field + CDU line + both galleries) fits the stage on both axes on entry, at 1440×900 and
  390×844, with Fit / + / − / reset and wheel, pinch, drag, keyboard (+ − 0 arrows) as the parent's HD-F laws say.
- Orientation marks: north arrow, the four zone labels (FAN WALL N, RACK FIELD, CORRIDOR, CDU LINE, FAN WALL S) on
  the left margin, the scale bar (m) at the bottom-left. Pods named on the north edge (`R01/02` …).

### 4.2 Symbols (top view)
| unit | symbol | size | lamp | value chip (by lens) |
|---|---|---|---|---|
| rack (440) | rectangle, front edge on the cold aisle marked by a 1 px tick | cabinet footprint to scale | none per rack; the rack face **fill** carries the lens state | in a tooltip only (440 chips would be noise); row chip carries the row value |
| row (20) | the row's rack strip | – | – | row chip at the cold-aisle end: lens value + unit |
| pod / hot-aisle roof (10) | outlined roof between the row pair, hatched 45° at 8 % ink | – | – | pod chip on the north edge: lens value + unit |
| fan-wall module (90) | ISA fan symbol (circle + blades) in the gallery | 1.38 m pitch to scale | state lamp (§8.1) | fan % (Cooling lens), supply °C (Thermal) |
| CDU (55) | square with HX diagonal and pump circle | to scale | state lamp | duty kWth or TCS L/min (Cooling), TCS supply °C (Thermal) |
| TCS header supply / return | two lines along the corridor, supply above return | 2 px / 1.5 px | – | header value at the west end: 40.0 / 50.0 °C, hall L/min |
| busway trunk per row (Power lens only) | line over the row, A and B as two parallel lines | 1.5 px | feed lamp pair A/B at the row head | row kW, busway % |
| leak rope zones (24) | dashed line along the corridor, zone ticks | 1 px | zone lamp only when not normal | – |
| aisle stations (4 per aisle, Thermal lens) | small square on the aisle centre line | 6 px | – | value on hover; the aisle tint carries the state |

All geometry from `floor-plan.js` (`G.*`, counts from the engine through `hall-iso.js`). Symbol drawings follow the
ISA-5.1 / ISO 14617 forms already in `js/rz-hmi-symbols` where one exists; no new decorative glyph.

### 4.3 Lenses
One lens bar above the stage (left of the view switch), shared by 2D and 3D, stored in `rz.dcai.lens`:

| lens | rack fill | chips shown | legend |
|---|---|---|---|
| **Status** (default) | grey; amber/red only for a rack with a warning/alarm point | lamps only, no chips | lamp states (§8.1) |
| **Thermal** | rack inlet °C by limit state (normal = grey, never a heat ramp for normal) | pod cold/hot °C, module supply °C, CDU TCS supply °C | normal / warning / alarm + ASHRAE A1 band text in tooltip |
| **Cooling** | liquid share bar per rack is NOT drawn; rack grey | module fan %, CDU duty kWth, header L/min, pod liquid/air kWth | run / standby / trip, saturation (amber) |
| **Power** | rack kW against rating by limit state | row kW, busway %, feed A/B lamps | normal / warning / alarm, A/B feed |
| **Layout** | occupied / spare | area chips (m²) per zone | occupied / spare / zone names |

These map onto the existing `floor-plan.js` modes (`alarms`→Status, `temp`→Thermal, `cooling-margin`→Cooling,
`power`→Power, `space`→Layout). Each lens shows its legend in the bottom-left of the stage, one line, always visible.

### 4.4 Text budget
Visible text in 2D ≤ 60 strings at 1440 per lens (counted), ≤ 30 at 390; everything else in tooltips. A chip is
`value unit` in mono, 11 px desktop, 10 px phone, never below the 8.5 px rendered floor at the fitted zoom.

---

## 5. 3D quality (R1)

### 5.1 Composition
- Same stage-first layout as 2D (summary line, stage ≤ 200 px from the tab bar). Whole hall fits on entry at
  1440×900 and 390×844; the phone gets the same fit, not a 3.3× drawing that needs panning. The stale caption (V4)
  is deleted.
- **Three surface tones, not one** (both themes, from tokens): slab (darkest), equipment body (mid), equipment top
  (lightest). Plant (fan walls, CDUs) uses the body tone with a 1 px darker outline, racks the body tone without;
  hot-aisle roofs a translucent top at 35 % of the top tone. Light theme: slab `--bg2`, body 8 % darker than the slab,
  top 4 % lighter; contrast slab-to-body ≥ 1.25:1 (measured, §11 law).
- Height carries type: racks 2.2 m (to scale), CDUs 2.0 m, fan-wall modules 2.6 m, roof at 2.6 m. Equal height within
  a type (kept from today).
- Lamps: one per rack on the top front edge (kept), one per CDU and fan-wall module on its top face, coloured by
  §8.1, **grey for standby** (not green).
- Labels: pod tags on the north edge with unit (`6,248 kW`), placed by the label search of `floor-plan.js` with a
  collision check; a tag that cannot be placed without overlap moves into the pod tooltip (no overlap ever, §11).
  Zone labels on the slab edge. No other always-on text in Status lens.

### 5.2 What 3D adds over 2D
- The vertical: hot-aisle roof and plenum return shown as a roof plane; fan-wall supply direction as a short arrow
  on the gallery face (flow lens only, see §7); rack height.
- Rack face tint by lens (as 2D fill), front face only.

### 5.3 What 3D never does
Perspective camera, orbit, auto-rotate, shadows, reflections, glow, gradients on surfaces, colour for normal.

---

## 6. Operating parameters by unit and where they show (R2)

Every row's value, unit, source class and limits basis are the parent's §5 rows; the column "status today" is from
the census. ENG = engine leaf, ENG+ = new engine key (parent §8), SIM = named simulation, NM = "not modelled".

### 6.1 Fan-wall module (CRAH-nn, 90)
| parameter | 2D | 3D | tooltip | HMI | today |
|---|---|---|---|---|---|
| state RUN / STBY / TRIP / MAN | lamp | lamp | ✓ | ✓ | lamp always green (V7) |
| fan speed % | chip (Cooling) + rotor period | rotor period | ✓ | ✓ | absent on floor |
| airflow m³/h | – | – | ✓ | ✓ | absent |
| supply / return air °C | chip (Thermal) | – | ✓ | ✓ | absent |
| CHW valve % | stem fill (Cooling) | – | ✓ | ✓ | absent |
| CHWS / CHWR °C, coil ΔT | – | – | ✓ | ✓ | absent |
| input power kW (affinity) | – | – | ✓ | ✓ | absent |
| rpm, coil ΔP | – | – | "not modelled" | "not modelled" | – |
| filter ΔP Pa | – | – | SIM, labelled | ✓ | – |

### 6.2 CDU (CDU-nn, 55)
| parameter | 2D | 3D | tooltip | HMI | today |
|---|---|---|---|---|---|
| state RUN / STBY / TRIP | lamp | lamp | ✓ | ✓ | lamp always green (V7) |
| duty kWth / rating, load % | chip (Cooling) | – | ✓ | ✓ | absent on floor |
| TCS flow L/min | chip (Cooling) + header dash rate | – | ✓ | ✓ | absent |
| TCS supply / return °C | chip (Thermal) | – | ✓ | ✓ | absent |
| HTW in / out °C, approach K | – | – | ✓ | ✓ | absent |
| pumps P1/P2/P3 state, speed % | pump circle rotor (2 run, 1 still) | – | ✓ | ✓ | absent |
| primary valve TV-nn1 %, 3-way to HX % | stem fill (Cooling) | – | ✓ | ✓ | HMI literal 73 % (parent B-row) |
| DP, tank level, strainer ΔP | – | – | SIM labelled or NM | ✓ | – |

### 6.3 Row, pod, rack
| parameter | 2D | 3D | tooltip | today |
|---|---|---|---|---|
| pod IT kW | pod chip (Power, Status) | pod tag with unit | ✓ | number without unit (V5) |
| pod liquid / air kWth | pod chip (Cooling) | – | ✓ | absent |
| aisle stations cold W / cold E / hot, k = 1..4 | aisle tint + station squares (Thermal) | rack face tint | ✓ | spread is simulation (V11) |
| RTI, RCI_HI / RCI_LO | pod chip (Thermal, second line) | – | ✓ | absent |
| row kW, busway A / % | row chip + busway line (Power) | – | ✓ | absent |
| feed A / B energised, share % | lamp pair at the row head (Power) | – | ✓ | absent |
| row TCS L/min | header dash rate per row tap (Cooling) | – | ✓ | absent |
| rack kW, inlet °C, TCS L/min, feed current | rack fill by lens | rack face tint | ✓ | absent |
| manifold ΔP, QD pairs | – | – | NM | literal 0.87 bar (parent) |

### 6.4 Hall
Header summary line (§4.1); PUE, IT, GPU %, ΔT, DLC %, UP, W/GPU, FP4 stay in the KPI strip (owned by the parent's
dashboard rules). The GPU % that differs between two screenshots of one state (88 vs 92) is a SIM value and must
say so in its tooltip or be made deterministic — a law (HV-K1).

### 6.5 Binding rule
Every value above is a `[data-point]` registered through `RZPointStatus.define()` with the parent's limits record
(or `points.js`), so it gets the state glyph, the tooltip, and opens `RZTrend` on click/Enter. A value with no limits
record shows its value with no state colour and says "no limit set" in the tooltip — never a guessed limit.

---

## 7. State and animation grammar (R2 "animasi state", physical only)

### 7.1 One rule per motion type
| motion | where | driven by | rule | still when |
|---|---|---|---|---|
| fan rotor | fan-wall module (2D symbol; 3D top face) | fan % | period = `T_ref / (fan%/100)`, T_ref = 1.0 s at 100 %; three blades 120° apart, stepped on one shared 10 Hz layer (the chiller-plant P2 pattern) | STBY, TRIP, fan 0 % |
| pump rotor | CDU pump circles | pump speed % | same rule, T_ref = 0.8 s | standby pump, CDU STBY/TRIP |
| liquid flow | TCS supply/return headers and row taps (2D Cooling lens) | L/min per segment | dash speed = `RZConvVfx.dashSeconds(q / q_design)`; direction = flow sign | flow 0 |
| air arrows | gallery face (3D), gallery edge (2D Cooling/Thermal) | airflow m³/h per module | short dash on the arrow, same mapping | module not running |
| valve stem | CHW valve, TV-nn1, 3-way | opening % | stem fill height = opening; no motion | – (static) |
| state change | any lamp | state transition | one 160 ms opacity cross-fade from old to new colour; an entering ALARM pulses **once** (opacity 1 → 0.4 → 1, 600 ms), then steady | – |

Never: continuous blinking, glow, scale bounce, colour cycling, motion on a normal-state value, motion that does not
change when its quantity changes.

### 7.2 Performance envelope
- All rotors and dashes of a view on **one** overlay layer stepped by one interval (≤ 10 Hz); the floor SVG is
  never repainted per tick (the chiller-plant lesson: a whole-sheet repaint costs ~60 ms).
- Off screen (IntersectionObserver), hidden tab, or another view active → the interval stops (0 running animations).
- `prefers-reduced-motion: reduce` → no rotor or dash moves; values, lamps and stems stay; the alarm pulse becomes a
  plain colour change.
- Budget: main-thread CPU over 5 s idle at 1440 in 2D ≤ 1.5 s and ≤ 1.2 × the drawing view's figure; p95 frame
  interval while panning ≤ 20 ms at 1440, ≤ 34 ms at 390 with CPU ×4 (reported where the host cannot reach it, as
  `test-conv-sheet-perf.mjs` does).

### 7.3 Scenarios that must visibly change the floor
From the parent §6.5 (normal, cdu-pump-fail, chiller-trip, leak-z07, module trip, CDU trip). For each, the law is a
before/after diff on the floor: which lamps change, which rotors change period (and by how much, equal to the
engine's new speed), which chips change value. A scenario that changes nothing on the floor is a red law (HV-S1).

---

## 8. Indicators (R2 "indikasi")

### 8.1 Lamp states (one set for every unit, both views, both themes)
| state | fill | shape cue (not colour alone) | rotor |
|---|---|---|---|
| RUN normal | green (`--rz-pt-ok` family) | solid dot | turns |
| RUN warning | amber | dot + ▲ in tooltip and alarm list | turns |
| RUN alarm | red | dot + 1 px ring | turns or still per physics |
| STBY | grey, hollow (ring only) | hollow | still |
| TRIP | red | dot with a cross (×) | still |
| MAN (override) | green with an "M" in the tooltip; ring dashed | dashed ring | per speed |
| COMMS LOST / STALE | grey with a "?" in the tooltip; value shows "—" | dotted ring | still |

### 8.2 On the floor
- A unit or rack in warning/alarm carries a **flag**: a small tag above it (2D) or above its top face (3D) with the
  point short name and value (`CDU-07 TCS sup 42.3 °C`), placed by the label search; max 8 flags visible, the rest
  summarised as "+n" at the stage corner (opens the alarm list filtered to the hall).
- The status strip above the views (Critical / Warning / Maintenance / Comms / Stale, today's) gets per-view
  counts that equal the alarm list's counts for this hall (a law).
- Tooltip (every unit): tag, state word, the lens value with unit and limit state, the limit basis ("ASHRAE A1
  allowable 32 °C"), source class (ENG/SIM/NM), last change age ("since 12 s"), and "Open trend · Open HMI".

### 8.3 Selection
Click/Enter selects a unit: 2 px ink outline (not colour), the tooltip pins as an inspector on the right (desktop) or
a bottom sheet (`RZSheet`, phone); the same unit stays selected across a view switch.

---

## 9. Interaction and accessibility
- Every unit is focusable in reading order (gallery N left→right, rack field by row, CDU line, gallery S); arrows move
  between neighbours (the `floor-plan.js` cursor, kept), Enter opens the HMI, `T` opens the trend.
- Each view has an accessible text alternative: "Show as table" lists every unit with state and lens value (the
  same values; a law compares them).
- axe 0 critical/serious at 390 and 1440, both themes, each view. Contrast: chip text ≥ 4.5:1 against its local
  background; lamps ≥ 3:1 against the surface they sit on.
- Touch: targets ≥ 44 px for controls; on the floor a tap selects the nearest unit within 22 px.

---

## 10. Data rules (no fake functionality)
- No `Math.random` anywhere in the views. The aisle spread (V11) is removed from 3D and 2D until the parent's §6.4
  balance is built; until then, stations read the engine's balanced 25.0 / 36.0 with "balanced hall, no spread
  modelled" in the tooltip. (The Drawing keeps its own sensors until the parent's P-phase replaces them — the peer's
  call.)
- Every chip value equals the tooltip, the inspector, the HMI and the table for the same point (one source, a law).
- A parameter the engine does not have prints "not modelled", never a typed number.

---

## 11. Laws (each proven red on today's tree before green)

| law | claim | proof command (new gate `tools/test-dcai-hall-views.mjs` unless named) | red today |
|---|---|---|---|
| HV-V1 | Three buttons 2D · 3D · Drawing, aria-pressed, in that order | DOM | 2 buttons (V1) |
| HV-V2 | No stored view → 2D at 1440 and 390; `rz.dcai.proj` removed after load | clear storage, load | 3D/drawing (V2) |
| HV-V3 | A switch keeps selection, lens, scenario; the engine is not re-run (counter on `RZDatahallAI` calls) | DOM + counter | no lens/selection shared |
| HV-F1 | In 2D and 3D the whole hall (all 585 units) is inside the stage and the stage is on the first screen: stage top ≤ 200 px (1440) / ≤ 260 px (390), every unit's box inside the stage rect | rects | top 434 / 644 (V3, V4) |
| HV-F2 | 0 label overlaps in 2D and 3D at 1440 and 390 in every lens (box intersection of visible text) | rects | pod tags overlap at 390 (V4) |
| HV-L1 | Lenses Status/Thermal/Cooling/Power/Layout exist in 2D and 3D, each with a visible legend | DOM | no lens, no legend (V8) |
| HV-P1 | Every value in §6 marked for 2D/3D is on the floor with its unit in its lens, and each is a `[data-point]` opening a trend | DOM, click | 0 points (V5, V6) |
| HV-P2 | Chip = tooltip = HMI = table for 20 sampled points per view | DOM | – (new) |
| HV-S0 | Standby units (1 module, 1 CDU at design) show hollow grey lamps and still rotors; run units green | DOM | all green (V7) |
| HV-S1 | Each scenario of §7.3 changes the lamps/rotor periods/chips it must, and only those; rotor period × speed = T_ref within 5 % | scenario run, measured rotation | no rotors (V9) |
| HV-M1 | Rotors and dashes run on one layer; 0 running animations off screen, in a hidden tab, in another view, and under reduced motion | `getAnimations`, layer count | – |
| HV-M2 | Idle CPU over 5 s at 1440 in 2D ≤ 1.5 s and ≤ 1.2 × Drawing's | CDP `ThreadTime` (the `test-conv-quantity-truth` PERF1 method) | – |
| HV-I1 | A seeded alarm shows a flag naming point, value, unit; the status strip count equals the alarm list's count for the hall | seed via scenario | red rack, no flag (V12) |
| HV-D1 | No `Math.random` reachable from the view code; two loads of one state give identical floor values (incl. GPU %) | static + two loads | sensor spread, GPU % 88/92 (V11, §6.4) |
| HV-T1 | 3D surface tones: slab/body contrast ≥ 1.25:1 and body/top ≥ 1.1:1 in both themes (computed fills) | computed style | one grey (V10) |
| HV-A1 | axe 0 critical/serious, 3 views × 2 widths × 2 themes; "Show as table" lists 585 units | axe | – |
| HV-R1 | Conventional hall (`datahall.html`) unchanged: its existing floor-plan gates stay green | existing gates | – |

Each law's red proof is run on the current tree and pasted into the build PR before the code lands; a law that
cannot be made red on today's tree is rewritten until it can (or dropped).

---

## 12. Phases

| phase | scope | laws closed | owner of files |
|---|---|---|---|
| A0 | Gate `test-dcai-hall-views.mjs` written; every law red on today's tree (pasted) | – | me (tools/) |
| A1 ✔ v3.99.0 | View switch (2D · 3D · Drawing), `rz.dcai.view`, default 2D, `?view=`, stage-first layout with the summary line; 2D = `floor-plan.js` plan projection with today's paint | HV-V1–V3, HV-F1 | peer: `hall-iso.js`, `datahallAI.html`; me: `floor-plan.js` only if the plan projection needs a fix |
| A2 ✔ v3.101.0 | Lens bar + legend in 2D and 3D (map to existing modes); lamp states §8.1 incl. standby; 3D tones and heights; label collision → tooltip | HV-L1, HV-S0, HV-F2, HV-T1 | shared `floor-plan.js` (behind options so the Conventional hall is unchanged) |
| A3 ◐ v3.102.0 (engine keys + tooltip + table; chips → A5, D7) | Parameter binding §6 (engine keys ENG/ENG+ from the parent's P-phases), chips per lens, `[data-point]` + trend, table view, determinism | HV-P1, HV-P2, HV-D1, HV-A1 | peer (engine keys, payloads); me (binding layer if the peer hands it over) |
| A4 ◐ v3.102.0 (rotors M1, M2; header dashes, air arrows, stems → A5) | Motion layer §7 (rotors, pump rotors, header dashes, air arrows, stems), off-screen stop, reduced motion, perf budget | HV-M1, HV-M2, HV-S1 | shared |
| A5 | Indicators §8 (flags, counts, inspector/sheet), scenarios §7.3 | HV-I1, HV-S1 | peer |
| A6 | Release: full DC AI + Conventional gate sets, live check, screenshots read at 1440/390 both themes, CHANGELOG, standards (`DIAGRAM_ENGINE_STANDARD`, `MOTION_STANDARD` rotor rule, `UIUX_AUDIT_LEDGER` rows V1–V12) | HV-R1 + all | both |

The "owner of files" column was the proposal; §13 records the decision (this session builds every phase).

A1 alone answers R3 and R4 and is shippable on its own (owner sees the 2D button and the default). A2–A5 answer R1
and R2. Each phase ships only on a green full gate.

---

## 13. Coordination
- Decided with the peer session (2026-11-23): this session builds A0–A6. Handed over for this amendment:
  `js/datahall-ai/hall-iso.js`, `js/datahall-ai/points.js` and `payloads.js` (hall records only), the Data Hall tab
  block of `datahallAI.html` with its script tags and CSS. The peer keeps `js/rz-hmi-sheet.js`, `css/rz-hmi.css`,
  `js/rz-elec-voltage.js`, the `dh-e-*` sheets of `hmi-sheets.js`, the dh-e branch of `hmi-v2.js`
  (elecState / elecMap / vfxApply) and the Electrical SLD tab. Shared `datahallAI.html`: each side edits only its
  own tab block and script tags; asset tokens are re-run with `--fix` for one's own assets on every rebase. Any new
  `[data-point]` row for electrical equipment is agreed with the peer first.
- `floor-plan.js` changes are option-gated (`opts.lamps`, `opts.lens`, `opts.motionLayer`, `opts.tones`) with the
  Conventional defaults unchanged, proven by HV-R1.
- One release per phase; rebase over the peer's main before each gate (the port pattern).

## 14. Risks
| risk | mitigation |
|---|---|
| 585 units × motion = CPU (the chiller P2 PERF1 red) | one overlay layer, ≤ 10 Hz, only the units in view, off-screen stop; HV-M2 measured A/B before shipping |
| Labels at 390 | chips only for rows/pods/plant, never per rack; collision → tooltip; HV-F2 |
| Parent's engine keys (ENG+) not built yet | A3 binds what exists (ENG) first; ENG+ rows show "not modelled" until their key lands — never a placeholder number |
| Shared renderer regresses the Conventional hall | options with unchanged defaults; HV-R1 runs the Conventional gates every phase |
| Owner taste on 3D tones | screenshots at 1440/390 both themes in the A2 report, before A3 starts |

## 15. Decisions taken without asking (owner said "jangan tanya"; change any by one word)
- D1. Default 2D at every width, including desktop (R4 read literally).
- D2. "Plan" is renamed "Drawing" so "2D" is not confused with the engineering drawing.
- D3. Old stored view is not migrated (everyone lands on 2D once).
- D4. Status is the default lens (grey is normal, colour only for a problem).
- D5. No per-rack chips; rack values live in the tooltip and the rack fill.
- D6. The aisle spread is removed from 2D/3D until the parent's air balance exists (no simulation shown as physics).
- D7 (A3, measured 2026-11-23). There are no per-unit chips at the fitted zoom. At 1440 the fan-wall pitch is about 9.5 px,
  which is narrower than one 11 px chip, so 145 chips would break HV-F2. Each fan-wall module and CDU carries its
  engine operating point in its tooltip and in "Show as table". The engine (1.7.0) publishes it: fan speed by the fan
  law, airflow against rated airflow, CDU load %, TCS L/min against the published flow, and pump speed. Standby units
  read 0. HV-P1 (a chip per unit) is replaced by a gallery-level chip that appears once the zoom makes a unit chip
  legible. That chip is scheduled in A5 with the flags, and HV-P1 stays out of the gate line until then.
- D8 (A3). N+1 becomes an authored count (`equipment.crah.redundantUnits`, `equipment.cdu.redundantUnits` = 1,
  ADOPTED from the "N+1 per hall" rule). Before, the literal `+ 1` was repeated in six engine expressions.
- D9 (A4, measured). Rotors use one CSS keyframe in place of a JS 10 Hz loop: the browser pauses them when the floor
  is hidden, and no tick repaints the sheet. They appear in 2D only. The budget in §7.2 is relative: 2D adds +4 % CPU
  over the same floor without rotors. The absolute 1.5 s per 5 s cannot be met by the cockpit page at all. It
  measures 3.9 s with every rotor off and 4.8 s on the Drawing view in headless Chrome, so that line is reported
  here and not gated.

