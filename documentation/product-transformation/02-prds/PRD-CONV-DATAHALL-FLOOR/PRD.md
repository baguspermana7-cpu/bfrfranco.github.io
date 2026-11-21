# PRD-CONV-DATAHALL-FLOOR — the data hall floor plan gets depth, and its colours mean one thing each

Status: APPROVED to execute by the owner in the same message ("Rancang detail dan comprehensive prdnya dulu.
Sempurnakan lalu execute perbaikannya"), 2026-11-21.
Page: `datahall.html`, centre stage, Plan view. That means the mode bar, the legend, the CRAH rails, the rack field
and the row footers. The Air path view (`js/conv/air-section.js`) and the side panels are out of scope except where
§4.6 names them.
Related: PRD-CONV-POINT-STATUS-TREND (point state and trend on every number; the T3 branch makes the row footers
points), PRD-CONV-TREND-DESIGN (same colour rules for the trend modal).

## 0. The owner's words

2026-11-21: "Floor plannya terlalu flat dan terlalu ai design slop warnanya gradiennya dll. Rancang detail dan
comprehensive prdnya dulu. Sempurnakan lalu execute perbaikannya."

The record shows a reversal that this PRD must not repeat. v2.10.0 introduced the continuous ramp because of an
earlier owner comment ("rack-grid gradient", comment 12): with discrete tiers, 463 cabinets were painted one flat
green and their differences were invisible. The owner has now rejected that ramp. Both complaints have to be
answered at once:
- the differences between cabinets must stay visible;
- the colour must not be a multi-hue gradient.

The answer is to move magnitude off hue (§3).

## 1. Measured state (live v3.81.0, 2026-11-21, 1440 dark/light and 390 dark; screenshots `qa-tmp/fp/`)

### 1a. Colour

| id | gap | evidence |
|---|---|---|
| F1 | **Three multi-hue continuous ramps.** Power: slate → teal-blue → green → olive → orange → red (`RAMP_POWER`, 6 stops). Temperature: blue → green → olive → red, also called a "jet" ramp (`RAMP_TEMP`). Cooling margin: the same ramp reversed (`RAMP_MARGIN`). A rainbow on a magnitude is the first anti-pattern of the data-viz method; the eye reads hue boundaries as category changes that do not exist. | `datahall.html:1756–1758` |
| F2 | **The legend is a gradient bar** (`linear-gradient` from `rampCss`) with ticks. It is the "gradien" the owner names. | `.lg-bar`, `rampCss()` |
| F3 | **Interpolated colours are muddy.** `hexLerp` in sRGB between green and amber passes through olive/khaki. 463 cabinets in Power mode show up as a field of mustard and khaki, which reads as "everything is warning" while the hall is NORMAL. | Power screenshot: almost every cabinet is olive or mustard |
| F4 | **Cooling-margin mode paints a NORMAL hall orange.** The margin to the 27 °C recommended maximum is about 1.6 K. On the ramp that sits between the 1 K and 3 K stops, so it shows as orange. The status strip says NORMAL, 0 warnings, and the rack inlets are inside the envelope. The colour contradicts the alarm system. | Cooling Margin screenshot: all cabinets orange |
| F5 | **A second accent hue: cyan.** The active mode button is filled `rgba(56,189,248,.14)` with a cyan border, the selection outline is cyan (`--sel`), the in-°C footer is cyan `#7dd3fc` and the Scenario chip is cyan. The register carries one accent, signal amber (CLAUDE.md rejected pattern 12). | `.mode-btn.active`, `.rack.sel`, `.zf-in` |
| F6 | **Text in series and status colours.** Every row footer prints the inlet in cyan and the hot aisle in amber, 25 + 25 coloured numbers. Amber is the warning colour, so 25 "warnings" are printed while nothing is wrong. | `.zone-foot > .zf-in / .zf-hot` |
| F7 | **A green dot on every CRAH chip** (58 dots) and the chip rail. That is decoration repeated 58 times; the dot only says "running", which is the normal case. | `.crah-cell .cc-dot` |
| F8 | **Glow and blink:** `.crah-cell.cc-affected` has a red 1.5 px glow ring, `.alarm .cc-dot` blinks, and `.rack.excursion` pulses. | CSS 344, 399, 451 |

### 1b. Form: why it is "terlalu flat"

| id | gap | evidence |
|---|---|---|
| F9 | **It is not a floor plan, it is a table.** Rows are table columns, racks are table cells and CRAHs are a strip of pills. There is no wall, no aisle, no containment, no floor and no orientation. The only spatial idea left is "north rail / south rail". | Plan screenshot |
| F10 | **No third dimension carries data.** Every cabinet is the same flat square. Rack load (kW), the main physical quantity of a data hall, appears only as a colour, and in Temperature mode it does not appear at all. | — |
| F11 | **Hot and cold aisles are invisible.** The page states "hot aisle 36.9 °C, contained", but the plan draws no aisle and no containment, so the air-path story (Air path view) has nothing to anchor to on the plan. | Air path tab vs Plan tab |
| F12 | **Six stacked numbers under every row** (kW, in, hot, min, max, avg) make 150 numbers in a 13 px column, read as a table under the "plan". The labels live in a key column on the far left that scrolls away. | row footers |
| F13 | **At 390 px the field scrolls sideways with tiny cells,** and the row footers become an unreadable stack. | 390 screenshot |

## 2. Principles (each becomes a law in §6)

- **P1 Colour has one job per mode: STATE.** In every mode, a cabinet is ok, warn, alarm or spare. The same tokens
  are used as everywhere else on the cockpits: `--rz-pt-ok/warn/alarm` from `css/conv-point.css` (OD-1 of
  PRD-CONV-POINT-STATUS-TREND: normal is green). There are no interpolated colours and no gradient bars. The state
  thresholds are the ones the alarm philosophy already uses; only the presentation changes.
- **P2 Magnitude goes to geometry and lightness, not hue.**
  - Height: every cabinet is extruded by its load, kW over the design rating, in every mode, because heat load is
    the physical quantity of the hall.
  - Lightness: within a state, three discrete lightness steps (low / mid / high third of that state's band) keep
    the differences between cabinets visible. That answers owner comment 12 without a ramp.
- **P3 Depth is drawn, not faked.**
  - The view is an oblique 2.5D projection: a floor slab, a perimeter wall, CRAH units standing on the north and
    south walls, cabinet pairs facing a contained hot aisle with a cap, and cold aisles between the pairs.
  - Each solid has three faces (top, front, side) in three lightness steps of the SAME colour.
  - No gradients, blur, glow or shadows. Hairlines are 1 px.
- **P4 One accent.** Selection, the active mode and focus use signal amber (the register accent), with an underline
  or a 1.5 px outline. There is no cyan anywhere in the stage.
- **P5 Text is ink.** Numbers and labels are ink or muted ink. The only coloured text is a state word paired with its
  glyph (▲ ◆), as on the point-status pages.
- **P6 Values on demand.** The plan carries row letters, CRAH numbers and one value line per row. The rest goes into
  hover tooltips and into the row panel that opens on a click. The six-number footer stack becomes one footer row
  per column: row heat in kW. Inlet and hot-aisle temperatures go into the tooltip and the row panel, with points
  and trends from the T3 branch.
- **P7 Not to scale, and the plan says so in its ⓘ tooltip.** The cabinet proportions are schematic so that 500
  cabinets fit the panel at a legible size.

## 3. Design

### 3.1 Projection and geometry

- **Coordinates.** Plan coordinates are (x across rows A → Y, y along a row from north to south). Cabinet height h is
  load over rating, 0 … 1.05.
- **Projection (oblique cabinet projection).**
  - screen X = x·u + y·u·0.42
  - screen Y = y·u·0.62 − h·H
  - u is the plan unit, sized from the panel width so the hall fits 1440 without scrolling. H is the maximum
    extrusion, ≈ 1.6 u.
- **Rows.** Rows are drawn back to front (north first) and left to right, so that nearer solids cover farther ones
  without sorting each frame.
- **Units.** Per row:
  - cabinet line L (10 cabinets);
  - hot aisle (0.8 u) with a containment cap: a hairline rectangle at cabinet height + 0.15, ink at 6 %;
  - cabinet line R (10 cabinets);
  - cold aisle (0.6 u) up to the next row.
- **CRAH galleries.** One along the north wall and one along the south wall. Each CRAH is a low box (h = 0.5) with a
  fan circle on its top face and its number under the front face. Running units are ink-faced; standby units are
  outline-only; a unit in warn or alarm has its top face in the state token. There is no dot.
- **Floor slab.** A thin slab: the top face is ink at 3 % with a raised-floor tile grid of hairlines at ink 5 %
  every 2 u; the front face is 4 px of ink at 8 %. The perimeter wall is a 2 u-high hairline outline on the north
  and west edges only, so the room reads as a room without hiding cabinets.
- **Spare slots.** A floor footprint only: a hairline outline, no fill, no height.

### 3.2 Colour tokens (both themes)

| element | dark | light |
|---|---|---|
| ok top / front / side | `--rz-pt-ok` at 3 lightness steps: L 0.62 / 0.50 / 0.42 (OKLCH) | L 0.55 / 0.45 / 0.38 |
| warn top / front / side | `--rz-pt-warn` the same way | same |
| alarm top / front / side | `--rz-pt-alarm` the same way | same |
| magnitude steps inside a state (top face only) | ΔL −0.06 / 0 / +0.06 for the low / mid / high third of the state band | same |
| spare footprint | ink at 22 % hairline | ink at 25 % |
| containment cap | ink at 6 %, hairline ink at 20 % | 5 % / 22 % |
| selection | amber 1.5 px outline on the top face and the row letter | `#7A4800` |
| hover | 1 px ink outline | — |

- The steps are computed once per theme in OKLCH and written as discrete hex values.
- The palette goes through `validate_palette.js` for status contrast against the stage surface.
- **Mode → state thresholds (existing alarm philosophy, unchanged):**

| mode | ok | warn | alarm | spare |
|---|---|---|---|---|
| Power density | util < 0.85 | 0.85 ≤ util < 0.95 | ≥ 0.95 | — |
| Rack-inlet temp | 18 … 27 °C | < 18 or 27 … 30 | > 30 | — |
| Cooling margin | margin ≥ 0 K to the 27 °C recommended maximum | −3 … 0 K | < −3 K | — |
| Alarms | no alarm | warn alarm | alarm | — |
| Space | occupied (ink, not green: Space is not a state) | — | — | footprint |

  The Cooling-margin row closes F4: a positive margin is ok, and a NORMAL hall is green.
- The Power mode's old 70–85 % "elevated" band stays visible as the lightness step "high third of ok", not as amber.
  Amber only means warn.

### 3.3 Legend

The legend is one line of discrete keys, with no bar:
- `■ normal  ■ warning  ■ alarm  □ spare` (3 swatches + an outline);
- `height = rack load (kW / 20 kW rating)`;
- in Temperature and Margin modes, the thresholds in text: `warn > 27 °C · alarm > 30 °C`.

### 3.4 Interaction

- Hover over a cabinet shows a tooltip with tag, kW and % of rating, inlet °C, state word, and "Click for detail".
- Click on a cabinet opens the existing rack inspector (`wireRacks` behaviour).
- Click on a row letter or a row footer selects the row (amber), opens the row panel and keeps the existing
  shortcut to the Air path section.
- Click on a CRAH opens the existing CRAH popover (`__inspectCrah`).
- Keyboard: the plan is one focusable group. Arrow keys move the cabinet focus; Enter opens the focused item.
- The mode bar becomes a segmented control like the trend range bar: transparent, with an amber underline on the
  active mode and no cyan fill. Plan and Air path become one two-segment control in the same style.

### 3.5 Phone (≤ 600 px)

- The plan is drawn at a legible minimum unit (u ≥ 7 px) inside a horizontal scroller with scroll-snap per 5 rows.
  The page itself never scrolls sideways.
- A row picker (A … Y chips) under the plan opens the row panel. The panel shows the two cabinet lines as two flat
  lists of 10 with values (44 px rows).

### 3.6 Row footer and row panel

- **Footer.** One line per column: row heat in kW, ink, mono. It is a point (from the T3 branch) with state and
  trend. The inlet and hot-aisle spans stay in the DOM for the gates and the coverage reconciliation, but they move
  into the row panel and the tooltip, so they are not printed 25 times.
- **Row panel.** It opens beside the plan at 1440 and below the plan on a phone. It shows heat, inlet,
  hot aisle, ΔT and airflow (all points), min / avg / max of cabinet load and of inlet, and the CRAH units serving
  the row.
  - *Built (FP2, 2026-11-21):* heat, inlet, hot aisle, air-side ΔT and min / avg / max of load and inlet are points in
    the row panel; `test-conv-datahall-air` D1 proves the strip prints one number and the panel restates the strip.
    Not built: airflow per row and the serving CRAH units. The engine sizes one CRAH pool for the hall and has no
    row-to-unit assignment, so naming units per row would be invented.

### 3.7 Motion

- No pulse, blink or glow.
- An excursion is shown by the state colour, the glyph in the tooltip and the alarm list.
- Mode changes recolour instantly. A keyboard shortcut gets no animation (MOTION_STANDARD).

### 3.8 Implementation shape

- **New module `js/conv/floor-plan.js` (`window.RZFloorPlan`).**
  - It is pure SVG with no inline hex: colours come from CSS custom properties defined in the page's stage scope.
  - `render(host, model, opts)` draws once. `paint(mode)` changes only fills and heights by attribute, never the DOM
    tree.
  - The model it reads is the page's existing `racks`, `zones`, `crahUnits` and `rackInletFor`, and the page's
    thresholds. No engine arithmetic moves.
- **DOM contract kept for the gates and the T3 points.**
  - Each cabinet is `<g class="rack" data-idx>` with `<text class="rk-id">` and `<text class="rk-val">`; the text is
    visible only in the row panel or at zoom.
  - `#zone-field[data-unit]` stays.
  - The `.zone[data-z]` row columns with `.zone-head` and `.zone-foot > .zf-kw/.zf-in/.zf-hot/.zf-stats` stay as an
    HTML strip aligned under the SVG columns (row letters and footers). `.zf-in/.zf-hot/.zf-stats` are in the row
    panel and visually hidden in the strip (`.sr-only`, still in the accessibility tree).
  - CRAH units are `<g class="crah-cell" data-crah>` inside `#crah-top` / `#crah-bottom`, which become SVG groups.
- **Gates that read the floor and change only their reading, never their claim.**
  - `test-operator-cockpit-regressions` reads `getComputedStyle(rack).backgroundColor`. It switches to the top-face
    `fill` and keeps the claim "a 25.x °C inlet renders on the normal (green) side".
  - `test-ict-datahall-operator-runtime` clicks `.rack` and `.crah-cell`. An SVG `g` with a bounding box is
    clickable, so this needs no change, or a selector update if necessary.
  - `test-datahall-authority` counts the floor children (`.rack`, `.crah-cell`) when the authority is unavailable;
    the count rule stays.
  - `test-conv-datahall-air` reads `.zone-key .zk-foot` and `.zone[data-z] .zone-foot` spans; the spans stay.

## 4. Scope boundaries

1. `datahall.html` stage only. `dc-conventional` and `ict` have their own floors and are not touched.
2. Engine numbers, thresholds and the alarm philosophy do not change. Only presentation and the cooling-margin
   state mapping change. The margin mapping is a presentation bug: it contradicted the page's own status.
3. The Air path view keeps its schematic. Its colour bar is checked against the same rules in a later pass,
   recorded in the ledger.
4. `datahallAI.html`, `js/datahall-ai/*`, `js/conv/vfx.js` and `css/conv-vfx.css` are not touched (peer).
5. The side KPI strip keeps its layout. Its cyan chips (Scenario, `PASS`) are recoloured with the P4/P5 tokens only.

## 5. Phases

| phase | content |
|---|---|
| FP0 | This PRD; ledger row; red proofs of the laws on today's tree |
| FP1 | `js/conv/floor-plan.js` + a fixture page `tools/fixtures/floor-plan.html` + `tools/test-conv-floor-plan.mjs` (laws FL1–FL12) green on the fixture |
| FP2 | Integration into `datahall.html`: renderFloor/repaintRacks call RZFloorPlan; the mode bar and legend restyled; the cooling-margin mapping fixed; row panel; phone layout; gates that read the floor updated by selector only |
| FP3 | The whole conv release gate set; screenshots of 6 modes × (1440 dark, 1440 light, 390 dark) looked at; standards: CONVENTIONAL_DC_OPERATIONS_STANDARD § data hall floor, UIUX_AUDIT_LEDGER row, CLAUDE.md shared-module row; MINOR release together with the T3 / trend work |

## 6. Laws (gate `tools/test-conv-floor-plan.mjs`; computed values in a real browser; each red on today's tree)

| law | claim | red today |
|---|---|---|
| FL1 | 0 elements in the stage have a `linear-gradient` / `radial-gradient` background or an SVG gradient paint | `.lg-bar` gradient |
| FL2 | Every cabinet top-face fill is one of the 3 × 3 discrete state steps of the current theme (or none for spare); the number of distinct cabinet fills in any mode is ≤ 9 | 300+ interpolated colours |
| FL3 | In the default NORMAL scenario, every occupied cabinet in Power, Temp and Cooling-margin modes is in the ok family (0 warn, 0 alarm), matching the status strip (0 warnings) | Cooling margin: all orange; Power: mustard |
| FL4 | A planted cabinet at util 0.97 shows the alarm family in Power mode, and one at inlet 28 °C shows warn in Temp mode | (passes today; kept as the non-vacuous half) |
| FL5 | Cabinet height in px is monotonic in kW (Spearman ρ = 1 over the occupied set) and spare cabinets have height 0 | flat cells |
| FL6 | 0 painted colours in the stage within ΔE 12 of cyan (hue 190–215°, chroma > 0.06 OKLCH), in both themes | cyan active mode, selection, in-°C text |
| FL7 | No text node in the stage has a colour from the state tokens or a series colour, except state words with a glyph | 25 cyan + 25 amber footer numbers |
| FL8 | No `animation` on any stage element in the NORMAL scenario except the process air paths (`.fp-air path`, keyframes `fp-air`, speed from airflow; PRD-CONV-BMS-LIVE L4, v3.86.1); no `box-shadow` glow | pulse / blink / glow rules |
| FL9 | The plan draws hot-aisle caps (25), CRAH units (installed count from the engine), a floor slab and a wall | none |
| FL10 | Visible numbers in the plan area ≤ 30 at 1440 (footer kW per row + legend) | 150+ footer numbers |
| FL11 | 390 px: no page-level sideways scroll; the plan scroller holds u ≥ 7 px; the row panel opens with 44 px targets | tiny cells |
| FL12 | The existing gates that read the floor still pass, with selector-only edits: test-operator-cockpit-regressions, test-ict-datahall-operator-runtime, test-datahall-authority, test-conv-datahall-air, probe-accuracy-validation (82/0), test-conv-point-coverage (datahall STRICT after T3) | — |

## 7. Risks

- **The ramp reversal.** Owner comment 12 asked to see differences between cabinets. Height and lightness steps
  carry them; FL5 holds the height, and the screenshots go to the owner in the release report.
- **SVG cost: 500 cabinets × 3 faces plus text.** No filters, no per-element animation, and fills changed by
  attribute only. Measure main-thread time against origin/main in the same run, as E3 did; the budget is ≤ 1.2× the
  current page.
- **Gates pinned to DOM details.** Selector-only edits are listed in §3.8. A gate whose claim would have to change
  stops the work and is reported.
- **Conflict with the T3 branch.** T3 makes `.zf-*` and `.rk-val` points on `datahall.html`. FP2 starts after T3
  merges, and the point attributes ride on the kept spans.
