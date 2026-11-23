# HMI drawing standard — datahallAI (and every later cockpit drawing)

Status: v3.60.0 (2026-11-14); §4g electrical sheets v3.94.0 (2026-11-23). Owner decisions R128–R134 (redraw), R143 ("jadikan ke prod aja lgsung": the mock
ships as-is, deep shading included; more detail continues in later releases). PRD: `documentation/prd/datahall-ai/PRD_DATAHALL_DRAWINGS.md`.
Scenario work on top of these drawings: `documentation/prd/datahall-ai/PRD_CX_SCENARIOS.md` (not started).

## 1. What a drawing is

A **sheet**: one SVG drawn by `js/rz-hmi-sheet.js` (`RZHmiSheet.render(host, sheet, {read, flow, open})`) from a sheet
object built in code (`js/datahall-ai/hmi-sheets.js`, `RZDatahallAISheets.build(id, snapshot, opts)`), using only the
shared symbol library `js/rz-eng-symbols.js`. The page mounts a sheet into the `.bx` of the tab it replaces
(`js/datahall-ai/hmi-v2.js mountAll`); the previous drawing in that box is retired (`data-dh2-retired`, hidden by
`css/rz-dh-shell.css`), never deleted in the same release. A sheet with no legacy drawing gets its own box after an anchor drawing (`mountNew`). A builder that throws
leaves the old drawing in place — never a blank box. A sheet is drawn only once its tab panel (`.pn`) is shown — on the tab click or key, never into a hidden panel at boot (gate `test-dcai-deferred-panels.mjs` D6: 6,127 attribute writes in hidden panels during 9 s before v3.62.1). The sheet is mounted in the animation frame that follows the tab click, before the browser paints: the page's own tab handler shows the panel and draws the legacy mimic synchronously, so a mount that waited for a 60 ms timer let the retired drawing paint first (owner R177, v3.77.0: "sekilas lihat tampilan bms yang lama" on Cooling & Piping; it happened on rack, cooling, electrical, network and BMS). Law **F0** (`tools/test-dh-drawings.mjs`) records the visible legacy `svg[id]` in the first frame after each tab click and fails any that is retired 1.5 s later. `mount(..., {keep: true})` instead inserts the sheet right
after the drawing it complements and retires nothing — used where another contract still reads the old drawing
(Room Layout: `#floorSvg` reveal, `hall-interact`).

| Sheet | Builder | Tab | Data |
|---|---|---|---|
| DH-M-102 heat rejection (dry-cooler field, HTW and CW loops, chillers) | `dhM102` | Cooling (own box, `mountNew`) | `equipment.dry_coolers_*`, `chillers_*`, `design.planes.*` |
| DH-M-104 TCS to the rack rows, DH-01 | `dhM104` | Cooling (own box) | `geometry.rack_rows`, `racks_per_row`, `design.flows.tcs_rack_lpm`, planes |
| DH-M-103 CDU line, DH-01 | `dhM103` | Cooling | `DCAI_CALC.snapshot.equipment.cdu_*`, design planes |
| CDU-nn in full (L3 modal) | `cduSheet` | Cooling → click a CDU | same + `cdu` payload |
| DH-E-101 … DH-E-108 single-line, DH-01 … DH-08 | `dhE101` (`o.hall`) | Electrical → DH-01 … DH-08 (hall sheets mount when their sub-tab draws) | `distribution.*`, `equipment.ups_*`, `transformer_*`; hall count = `equipment.cdu_installed_facility / cdu_installed_per_hall` |
| DH-R-101 GB300 NVL72 rack | `dhR101` | Rack | `compute.*`, `power.*` |
| DH-F-101 fire detection, DH-01 | `dhF101` | Fire → Mimic | `RZDatahallAIFirePoints.buildInventory` (133 drawn devices, 12 zones per hall) |
| DH-F-102 clean-agent release, DH-01 | `dhF102` | Fire → Mimic (own box, under DH-F-101) | fire inventory release zones |
| DH-F-103 fire interlocks, DH-01 | `dhF103` | Fire → Cause & effect (above the matrix) | the systems `RZDatahallAIFireCauseEffect.BASE_ROWS` command (15 control modules) |
| DH-F-104 fire zone map, DH-01 | `dhF104` | Fire → Zones (above the zone tiles) | `geometry.*` bands of DH-A-101 + the fire inventory zones (Z09–Z12 square to their stated area) |
| Fire zone L3 (loops through isolators, every device, aspirating unit on its pipe, EPO, abort - release - pre-action to DH-F-102) | `fireZoneL3` | a fire zone click (tiles, DH-F-101 / DH-F-104 zone heads) — hmi-v2 modal via opener `fire`, the fire-zone payload's tier-2; points still open the inspector (isolation workflow), Shift+click a zone for its inspector | fire inventory |
| BMS block L3 (server pair, supervisory ring, protocol gateway, LDC) | `bmsNodeL3` (`o.kind`) | BMS → click a block (above the specification tables; controller keeps `bmsCtlL3`) | page `BMS_MODEL` (authored architecture) |
| DH-E-001 site single-line | `dhE001` | Electrical → Overview | `distribution.*`, `equipment.gensets_*`, `site.fuel_autonomy_h` |
| DH-N-101 compute fabric | `dhN101` | Network → Compute fabric | `network.*` (cores, spines, leaves, link counts) |
| DH-A-101 room layout, DH-01 (1 : 100 at fit) | `dhA101` | Room Layout (keep mode — joins the building isometric and per-level plans) | `geometry.*`, `equipment.cdu_installed_per_hall`, `crah_installed_per_hall`, fire zones |
| DH-B-101 BMS architecture | `dhB101` | BMS | page `BMS_MODEL` + engine counts |
| DH-N-102 WAN edge | `dhN102` | Network → Corporate & DC internet | page `WAN_NODES` (authored architecture) |
| DH-N-104 security zones (IEC 62443) | `dhN104` | Network → Security network | page `ZONES` (authored zoning, SL-T targets) |

Every count on a sheet is a formula over the engine snapshot or the fire inventory — never a literal
(`Sheet()` builders throw when the snapshot lacks a path; `need(snap, path)`).

## 2. Visual language (ISA-101, PRD §3)

- Grey line work; **colour only for abnormal state**. Alarm hues `--hmi-alm-1/2/3` are used by nothing else.
  **Exception, owner C8 (2026-11-17):** on the Cooling & Piping sheets the default view is the *State* view of §4d —
  the grey practice stays one click away as *Flat*.
- Filled body = running (`--hmi-fill-run`), outline = stopped, `--hmi-fill-run-2` = standby. Selected / traced = `--hmi-info`.
- Feed A/B and media identity (HTW, TCS supply/return, CHW, CW, agent, fuel, air, data) live on the **stroke** only.
- Line weights: main 2.0, branch 1.4, instrument 1.0, signal 0.8 dashed 4-2, zone boundary 1.0 dashed 8-4, dimension 0.6.
- Flow: arrowheads and the dash march only on running lines, only under `prefers-reduced-motion: no-preference`.
- Typography by role (`data-role`): tag = JetBrains Mono 600 10 px UPPER; value = Mono 500 9.5 px tabular; label =
  IBM Plex Sans 400 9.5 px; line / cable id = Mono 400 8.5 px; `data-lod="2"` text hides below the LOD floor.
- **A sheet is a BMS / PME screen (owner R144): tags, values, line ids and nothing else.** No descriptive notes,
  band names, basis strings, "duty / standby" prose or title block — the bar carries the sheet number and a short
  upper-case title (`DH-01 CDU LINE`). Budget ≤ 8 words per sheet outside tags / values / line ids (gates H5, F7).
  Explanations are tooltips (`<title>` + the payload rows), never drawing text. Area labels are tags (`CDU-01`,
  `L2 RING`).
- **Edges are routed by the RZ diagram engine (owner R147, one toolchain):** an edge without `via` points that would
  cross another symbol body is re-routed orthogonally by `RZDiagramLayout.route` (`js/rz-diagram-layout.js`); box
  nodes (zones, slots, racks, field groups) are containers a line may pass through. Gate H16 counts edges through a
  body they do not end on (reported until the sweep lands). Symbols come from one pipeline:
  `tools/hmi-symbol-defs.py` → `assets/engineering/*.svg` + `manifest.json` (115 kinds) →
  `tools/build-engineering-symbols.mjs` → `js/rz-eng-symbols.js`; FigCraft mocks a layout before it is coded.
- **Shading filters apply per layer, never per symbol** (gate H17, ≤ 12 filtered elements per sheet): 599 per-node
  drop shadows made the Room Layout tab take 25–36 s to ready in headless.
- Radius ≤ 2 px inside a drawing.
- **Shading (owner R139/R140, v3.60.0).** Default mode is *deep*: symbol bodies carry a vertical shade (light above,
  dark below) and a short soft shadow, pipes and buses read as tubes (dark under-stroke, medium-coloured body, thin
  light crest), zones and panels sit on a faint panel gradient, the canvas has a vertical fall-off, alarm P1/P2
  symbols glow in their own hue. Shading adds depth, never a hue: the colour rules above are unchanged. The *Shade*
  button in the sheet bar turns it off (flat ISA-101 line work), persisted per browser in `localStorage rz_hmi_shade`.
  Every painted thing comes from the renderer's one shared `<defs>` block (`.hmi-defs`, ids `hmi-g-*` gradients and
  `hmi-f-*` filters, stops coloured by the `--hmi-sh-*` tokens per theme); gate H1 accepts exactly those references
  and fails any other gradient, filter, shadow or `url()` in a drawing or a modal. Gate H15 proves default deep →
  Shade off → flat → survives reload. Under `prefers-reduced-motion: reduce` the per-symbol shadow filter is dropped.

## 3. Sheet object v1

```
sheet { id, no, title, rev, sheet:'n/m', basis, size:[w,h], svgId, nodes:[…], edges:[…], areas:[…], notes:[…] }
node  { id, tag, sym, x, y, size?, rot?, cls?, eqId?, label, tagAt:'below'|'right'|'left'|'none', values?, lod?, standby? }
      box node: { box:[w,h], boxSym, text, textRole, textAt, name?, values?, marks } (rack slots, busbar, zones; a box
                with `name` / `values` prints them inside, top-left, 12 px apart — a shallow box puts its one value
                right-aligned on the name line)
      junction: s.j(id, x, y, dot) — a point an edge may start or end on
edge  { from:'node.port'|'id'|[x,y], to, via:[[x,y]…], medium, w:'main'|'branch'|'signal'|'bus', line? }
area  { x, y, w, h, kind:'zone'|'box', label? }     note { x, y, text, role, anchor?, lod? }
```
Ports come from the library (`RZEngSymbols.ports(sym, {x, y, size, rot})`); a node referenced without a port resolves
to its centre (symbols without ports: detectors, call points, EPO). An unresolved edge is a console warning and a gate red.

## 4. Live binding

`hmi-v2.js read(node)` returns `{state, alarm?, values, rows}` from the HMI payload of `node.cls` (`CLS_PAYLOAD`):
equipment classes strip the prefix of `eqId` (`CDU-07` → `07`); **fire classes pass the full inventory id**
(`DH-01-Z05-SD1-02`) and map the workstation point state — alarm/active/discharged → `fault` + P1, pre-alarm /
trouble / impaired → P2, isolated / expired → `standby` + P3, no payload → `unknown` (gate F5 fails on any); the
payload's own alarm list counts too (O5) — the highest priority wins, so an impaired zone (a `high` alarm) is P1. A
fire zone with `values: [{k:'means'}]` prints its detection means available / total from the isolation register
(`n/m MEANS`, P1 below two). **Interlocks (DH-F-103, class `fire-output`, `eqId` = C&E system):** state from the C&E
evaluation of the *running* training event (the run's own event and zone, elapsed seconds, runtime rows, release
interlocks): a blocked command → `fault` + P1, due → P2, pending (engineered delay) → P3; no event running → `normal`
on every module — the panel commands nothing at rest. The payload context key carries the fire workstation snapshot's
identity, so an isolation, a restore or a run repaints at once, not at the next tick (gate F17). The sheet repaints
every 4 s (`sheet.update()`), only while visible.

Click → `open(node)` → the L3 modal (`cdu` class draws its own sheet; other classes keep the current HMI modal).

## 4b. Operator truth (owner brief "BMS_UIUX_Master_Prompt", 2026-11-15; PRD `PRD_BMS_OPERATOR_HMI.md`)

- **One state model.** `hmi-v2.js stateOf()` takes a node's state only from its payload: a pump's own `pump_state_n`
  row, the unit's status chip, a scenario state row. **No payload = `data-state="na"`** (not instrumented, drawn
  neutral) — never a guessed running / open / closed / energized.
- **Flow only with evidence.** `flowMap()` joins edges into branches through passive items; a branch flows when its
  mover runs, else when the equipment it joins runs; a plain header inherits from a running neighbour. Missing samples
  → `unknown` (dimmed, no motion); a stopped / tripped mover → `stopped`. Signal lines never flow.
- **Quality on every node** (`data-quality`): `simulated`, `replay`, `design` (engine values only), `partial`,
  `nosample` (dashed outline); a missing value prints the dash, a valid zero prints `0`.
- **Alarm without colour.** A diamond badge with the ISA priority digit sits top-right of an alarmed symbol, hollow
  once acknowledged, kept while the source is active. Gate `tools/test-dh-operator.mjs` (O1–O5, O8), proven red 9/12 on
  8fdf0a429.

## 4d. The living plant (PRD-DCAI-LIVING-PLANT phase A1, owner C8 "jangan abu-abu semua … hijau, orange atau merah tergantung kondisi")

- **One grammar for both cockpits.** DH-M-101…104 take `js/conv/vfx.js` (`RZConvVfx`) and `css/conv-vfx.css` exactly as
  the Conventional pages do (PRD-CONV-LIVING-PLANT §4.1: running · warning · alarm · standby · stopped · mismatch ·
  no data). No second table, no DC AI hex literals; the view bar offers State (default) · Thermal · Medium · Flat, the
  choice is shared with the Conventional cockpits (`rz_conv_vfx_mode`, convenience only).
- **Inputs are the flow pass of the same repaint** (`hmi-v2.js vfxApply`, after `update()`): line state = `flowMap()`
  (`na` signal / tap lines take none); a branch whose pumps or unit are all on standby is *charged* → standby (solid),
  not stopped; a node that makes no claim (`na`) takes no condition colour, `nosample` reads no data.
- **Motion is a measurement.** Dash period = `dashSeconds(ratio)`, ratio = the driving pump's speed ÷ nominal (flow ∝
  speed): CDU pump `pump_rpm` ÷ 1450 rpm, HTW station `vfd_hz` ÷ 50 Hz; a running branch with no pump of its own on the
  sheet moves at design (ratio 1); the CDW station publishes no drive speed and turns at design while it runs
  (declared). The rotor of a running pump turns at `rotorSeconds(speed %)`; a standby or tripped pump is still.
  `data-vfx-ratio` on each moving flow path is the number the gate checks.
- **DH-M-104 (TCS rows)** has no pump: its off-sheet references carry `flowSrc: 'tcs'` and read the CDU line (running
  while any CDU of the hall has a running secondary pump) — before A1 all 104 lines were `unknown`.
- **Thermal** paints TCS supply / return by the engine planes p07 / p08 on the declared range [p05 HTW supply, p08 TCS
  return]; HTW / CHW / CW lines are drawn as one medium without a leg, so they stay neutral there (no invented split).
- **Budget.** Off screen a sheet pauses its dashes and rotors (`.hmi-host.is-offscreen`, IntersectionObserver);
  under `prefers-reduced-motion` nothing moves, colours and dash patterns stay.
- Gate `tools/test-dh-vfx.mjs` (V0–V5, 80 checks; red 45/76 on 2bc05a8b5): bar and views, every process line tagged,
  running painted, dash period and rotor equal to the published speed, the CDU-pump-failure scenario stops that pump's
  rotor and discharge dashes, second signal per state, reduced motion and off-screen pause, Thermal = engine planes,
  Flat = grey, 390 px without overflow.

## 4e. Chrome budget (PRD-COCKPIT-QUIET, owner R182 2026-11-21: "tulisan2 yg over ... saya bisa lihat di mimic ui nya ... Nggak perlu di tampilkan ... hirarki yg di hide/expand")

The drawing is the page. Text above it in the drawing's column has three levels.

- **L0, at rest:** the cockpit top bar, the sheet tabs, the view bar with its one legend, the drawing.
- **L1, one tap:** a `<details data-cockpit-details>` (or a button with `aria-expanded`) holds strips that repeat the
  drawing (a KPI strip, a ticker, basis or planning cards) and introductions. It is closed at rest, and on a phone
  its summary is at least 44 px tall.
- **L2, hover, focus or tap:** sentences that explain (what SIMULATED means, a scenario cause at NORMAL, how to read a
  tile) go into a tooltip or the basis drawer.

Rules:
- A value drawn on the mimic is not repeated in chrome above it.
- File names, code identifiers and definitions ("conv-engine.js scenario", "since render = …") never show.
- A framed box never holds only empty space.
- Nothing is deleted: ids and `data-basis-param` hooks stay in the DOM, so the coverage gates keep reading them.

Budget, measured rendered by `tools/test-cockpit-quiet.mjs` at 1440 × 900 and 390 × 844:
- the drawing starts at or above 220 px (1440) and 300 px (390);
- at most 25 words above it in its column, not counting the L0 bar and tabs;
- 0 repeated values, 0 developer prose, 0 empty framed boxes.

Applied in v3.84.0:
- `datahallAI.html`: the dashboard KPI strip is one tap down; the picture's callouts carry the numbers.
- `cdu-mini-bms.html`: the hero is compact, with About ▾, and the cockpit comes first.

Applied to the Conventional cockpits through the shared shell (`SITE_CHROME_STANDARD.md` §9a): chiller-plant,
water-system, fire-system, fuel-system, EPMS_Telemetry, ict, and the dc-conventional hub (text laws only: its KPI strip
is its content, R6). Measured at 1440 / 390: chiller 453/766 → 218/297 px, water 678/987 → 213/246, fire 440/840 →
170/203, fuel 616/1508 → 218/291, EPMS 347/498 → 214/287, ict 458/972 → 213/282. datahall follows once the
Conventional session's DATAHALL-SPACE release is on main (Q3).

## 4f. Floor graphics (PRD-DATAHALL-BMS-ISO, owner R185 2026-11-22: "Kenapa tampilan UIUX datahall jadi 3d jadi kayak bukan BMS")

A floor graphic is a drawing of equipment in a room. It is not a chart of the equipment's numbers. The source is
`js/conv/floor-plan.js` 2.1.0, with `js/conv/floor-plan-color.js` loaded first. `datahall.html` uses it, and so does the DC AI
Data Hall tab (F4, v3.92.0) through its adapter `js/datahall-ai/hall-iso.js` (below).

- **Two projections of one drawing.**
  - **3D** is true isometric: both plan axes at 30°. It is the default on a stage 600 px wide or more.
  - **Plan** is the top view. It is the default on a phone.
  - The `.fp-proj` toggle has two buttons with `aria-pressed`. The choice is stored per page (`rz.dh.proj` on
    datahall.html, wrapped in try/catch).
  - Both projections keep the same ids, points, selection and mode. A switch rebuilds the geometry only.
- **One height.**
  - Every cabinet is drawn 42U tall (`CAB_H`). Its load is a value: the row tag, the tooltip and the row panel. Load is
    never a height and never a colour step.
  - A spare slot is its footprint outline on the floor.
- **Grey body, green lamp.**
  - Normal equipment has a neutral body (OKLCH C < 0.03) and a green status lamp. The lamp answers owner C8 (§4d).
  - A warn or alarm cabinet or CRAH paints its whole body in `--rz-pt-warn` / `--rz-pt-alarm`, and its tag point carries
    the ▲ / ◆ glyph from `RZPointStatus`.
  - Selection is the amber ring.
  - A point's text keeps its state colour, green when normal (`test-conv-point-coverage` PC3), as on every cockpit.
- **Equipment detail.**
  - Each cabinet has a door frame on its east face and a vent line on its roof.
  - The hot-aisle containment is a translucent roof at cabinet height, with posts and end doors.
  - The cold aisles have perforated tile seams.
  - Each CRAH has a fan grille on the face toward the cabinets and a lamp on its roof.
  - Only the north and west walls are drawn, so no wall hides the room.
- **Value tags.**
  - Each row has one boxed tag: the row letter and the row's point for the mode. Temp and Margin show the rack inlet
    average `datahall.row.<R>.inlet_avg_c`, which aliases the rack-inlet limits. Other modes show the row heat.
  - The hall has one CRAH tag: the running average leaving air → return air.
  - In 3D a row tag stands in the screen column of its row's head, its foot above the roof line of the gallery
    behind. A tag never covers a unit, so a click on equipment always reaches it (FX3), and it stays nearer its own
    row than the next (B3).
  - At most 30 numbers are visible on the plan (FL10).
- **Air is the only motion.** It is the PRD-CONV-BMS-LIVE L4 paths: supply along every cold aisle, exhaust along every
  containment roof. Speed follows row heat, and a stopped CRAH stops its supply. Air pauses off screen and does not move
  under reduced motion.
- **Painter's order.** Rows are drawn west to east. Within a row the order is the west line (north to south), the roof,
  then the east line. Rows apart on the floor never overlap on the screen.
- **Gate:** `tools/test-conv-floor-plan.mjs`.
  - B1–B7 are added: grey normal, equal height, 30° axes and row letters, tags, air, phone Plan ≥ 8 px, and the toggle by
    keyboard with memory and selection kept.
  - Red on fcf6383bb (the v3.87.0 candidate it builds on): B1, B2, B3, B4, B6 and B7 fail. B5 is proven red by a constant-speed mutation.
- **Another page's hall goes through an adapter, never a copy (F4).**
  - The adapter turns the page's engine counts into the renderer's model. `racksPerZone` sets the line length.
    `cduUnits` adds a CDU line between the cabinets and the south gallery (no fan). `racks[i].ref` and `unit.ref`
    become `data-rz-equipment`, so the page's own click opens its HMI.
  - The page may own the switch (`opts.toggle: false`). On DC AI, Plan is the page's engineering drawing (`#hSvg`),
    kept whole. In 3D that drawing keeps only its header band, and its layer bar and key are hidden. The stored key is
    `rz.dcai.proj`.
  - Every number the 3D floor prints is hooked or declared for `test-dcai-coverage`.
  - Gate: `tools/test-dcai-hall-iso.mjs` D1–D7.

## 4g. Electrical sheets (PRD-ELECTRICAL-BMS, owner R186/R190/R192/R193, v3.94.0)

Applies to every single-line sheet: EPMS E-S-101 / E-S-102 and DC AI E-001 / E-101. PRD:
`documentation/prd/PRD_ELECTRICAL_BMS.md`. Gates: `tools/test-electrical-bms.mjs` (E1-E5, E19 in `ship-gate.sh`),
`tools/test-elec-voltage.mjs`.

- **Fit on open.** At 1440 px a sheet opens at its reading scale and spans 90-102 % of its stage width (E1). A sheet
  that cannot fit at the reading scale is relaid out, not shrunk under the 8.5 px label floor. EPMS E-S-101 is laid out
  from named columns (`LX`, `TXX`, `FA`, `FB`, ... in `js/conv/epms-sheet.js`); move a column, never one node.
- **Whole.** The `Whole` control shows the full sheet in both axes (`fitAll`, E1b); labels under the floor hide by
  LOD. Fit returns to the reading scale.
- **Crop** is opt-in (`sheet.crop === true`): the canvas shrinks to the drawn content plus 28 units. Only DC AI E-001
  uses it; a sheet whose readings sit near its edge keeps its canvas.
- **Stage and status bar.** No equipment tag the operator can see (inside the stage's scroll box) sits under the
  status bar (E1).
- **Breaker grammar (E3, E3c).** Every breaker carries an IEC state glyph (filled closed, hollow open), a lamp, and a
  value tag with a number. The glyph and lamp are placed by `settleBrk()` clear of text and conductors; they never
  cover a word. The breaker's rating line and last value line are its tag (`data-brk-tag-of`).
- **Relay grammar (E10).** Every protection relay shows its IEEE C37.2 function inside its box (the sheet's `inst`,
  else the first function of its name: `87L · 21` -> 87L, `50/51 50N/51N` -> 51) and a lamp over the box: healthy
  (grey ink) while it supervises its bay, picked-up (warning), tripped (alarm) when its breaker tripped. The lamp is
  placed by `settleBrk()` like a breaker lamp.
- **Every drawn item opens (E15).** Every node except a junction dot carries `data-rz-equipment`. A DC AI electrical
  item with no plant class gets `sld-item:<sheet>~<node>` (hmi-sheets.js `finish()`): its inspector names the drawing
  tag, the state the sheet paints, and "not modelled" for values. Never an item that opens nothing.
- **Trapped keys are drawn and enforced (E16).** Castell-type key groups come from the sheet's interlock data
  (`RZEpmsSheets.keysFrom`): an earthing switch against its disconnectors (key exchange), the 20 kV incomers + tie
  (2 keys for 3 locks, 2-out-of-3), ring vs generator incomer of one LV section (1 key). Each member carries a key
  glyph with its number (filled = trapped in this closed device, hollow = free) and the group a dashed orthogonal
  link (only within 520 units; wider groups are matched by number). The simulation refuses a close whose key is
  trapped elsewhere and names it ("K1 trapped in DSL-L1"); the modal lists each key and where it is.
- **Parallel units are a stack (E17).** N identical units in parallel (UPS rectifier/inverter modules) draw two offset
  outlines behind the symbol (`stack: N`), the name `× N · <redundancy>`, and the value `N × <module kW>`, all from the
  engine (`ups_modules_per_system / halls`, `ups_module_kw_rated`, `ups_redundancy`).
- **Long runs name themselves (E14).** An electrical conductor (power, feed A/B, DC) longer than 400 sheet units
  carries its own line label (`line`, linked by `data-line-of`), visible at the opening zoom (`lineLod: 1`). A bus is
  exempt: its bus tag names it (E19). An LV trip unit (LSIG) shows `51` in its relay box; the name keeps LSIG.
- **State grammar (E2).** In State view flow overlays and arrows on electrical media use the running ink
  (`--hmi-text-2`), never the feed hue.
- **Bus voltages (E19).** A bus prints its voltage under load from `js/rz-elec-voltage.js`:
  V = Vn (1 - loading Z% (cos φ R/Z + sin φ X/Z) / 100), states ±5 % warn, ±10 % alarm, `0 V DEAD` when no segment is
  energised. Inputs come from the engine; constants the engine does not publish come from `RZElecVoltage.ASSUMED`,
  each with its source text. An HV bus with no transformer upstream prints the engine nominal; a 20 kV section prints
  the nominal first (the basis drawer explains a label's first number), then its value under load
  (`BUS A · 20 kV nom · 19.69 kV · 13.5 kA`). Sheets repaint voltages through `api.volts()`.
- **Power walk.** An ATS conducts one way, from the selected source to its load; a converter (rectifier, inverter)
  seeds only its output port, so a generator never back-feeds the MSB and a rectifier never lights the UPS AC input.

## 4c. Repaint cost (v3.63.0, O11)

A repaint is a function of the payload context key (tick, both scenarios, replay, fire workstation snapshot): `hmi-v2
read()` returns the same reading object while that key holds and the renderer skips a node whose reading object is
unchanged (`g.__d`); the flow pass re-runs only when a node state changed; alarm badges are cached per node. Sheet reads
build no trend series (`buildContext({noTrend: true})` — the inspector's own context builds them), and the fire
inventory indexes its points per zone once (`pointsByZone`, WeakMap). Measured at 390 px, DPR 3, CPU 4x, software
raster, DH-A-101 zoomed continuously with a repaint every second: p95 frame 50.1 ms → 33.4 ms (budget 34), a repaint
with nothing new 24.8 → ~5 ms, a new-tick repaint 310–430 → 116–248 ms; desktop 1440 p95 16.8 ms (budget 20).
The O11 page is signed in through the Supabase stub: an unsigned page re-locks and the audit observer fought the lock
on every mutation (median 50 ms per frame on any renderer — the harness, not the cockpit).

## 5. Laws (gates)

`tools/test-dh-drawings.mjs` (wired into `tools/ship-gate.sh` in v3.60.0): H0 ratchet (≥ 14 HMI sheets), H1 paint (renderer shading only), H2 library-only, H3 own L3
schematic per class (ratchet), H4 title + focus, H5 text budget, H6 fit-to-width 1440 and 390, H11 shell,
H12 sidebar persistence, H13 Room Layout / Rack non-zero, H15 shading mode. H3, H11, H12, H13 and H1 on the legacy
modals are *reported* until their phases land (`--strict-all` makes them block). Fire sheet: F1 mounted, F2 12 zones, F3 devices drawn =
inventory (133 for DH-01), F4 title + focus on every node, F5 no `unknown` state, F6 no overlapping symbols,
F7 words ≤ 25 and 0 gradient/filter, F8 no page overflow at 390, F9 0 console errors — in
`tools/test-dh-drawings.mjs` as the `fire` block (browser) and the Node geometry check (133/133 devices, 50/50
sampling ports, 0 overlaps, 0 nodes outside the sheet).
Interlocks DH-F-103: F10 one control module per C&E system (15), F11 nothing marked at rest, F12 title + focus and
the text budget, F13 a running `vesda_fire_2` in Z05 marks exactly the systems the C&E engine has due / pending /
blocked, F14 Stop clears. Zone map DH-F-104: F15 every zone of the hall once, F16 means = the register, F17 a zone
isolated below two means is P1 and no zone without an isolated point is marked, F18 Clear restores.
M2: a fire zone click opens its schematic with every device of the zone (10 / 10 on Z11) and Shift+click still opens
the inspector (fails on v3.62.1: no schematic). `test-dcai-coverage --modals` measures hmi-v2's own sheet modal when
no page modal is on the DHModal stack.
M3: the battery modal draws its L3 sheet — a second `wrapOpener('bat')` (the title-basis declaration came first) was
skipped because `wrapOpener` never wraps an opener twice, so since v3.61.1 the battery modal kept its legacy mimic.
One wrapper per opener.
M4 (v3.63.1, audit): a reading is memoised per sheet, node id, class and equipment id — one modal slot draws Z11 then
Z12 with the same node ids, and a key of sheet + node id showed Z12 with Z11's alarm (red on v3.63.0). M5: an opener
that cannot draw returns false and the inspector opens instead. Modal markup built from payload strings is escaped.
H6 at 390 also requires the sheet number on one line (it wrapped to 2-3 lines on 13 sheets) and the frame as wide as
its host (`.hmi-host { clear: both }` — the page's floated svg zoom buttons squeezed Room Layout to 227 of 362 px).
M1: every BMS block kind (server, ring switch, gateway, LDC, controller) opens with its own L3 schematic holding the
opened block (fails on v3.62.1: only the controller drew one). H3 (reported) read `data-rz-modal-class`, which no
renderer sets, after a double-click no opener listens to — 0 / 45 on every tree. Since v3.63.0 it clicks and counts a
visible dialog that holds an HMI sheet: 15 / 45 classes with >= 8 symbols, 9 drawn with fewer, 21 still text — the
worklist it prints.

Red proofs on record: the fire block fails F1 on a tree without the `fireSvg` mount; H5 read 1,056 / 1,639 / 1,592
words on the pre-redraw sheets; H13 read `floorSvg 0×0`. v3.63.0: F10 and F15 fail on v3.62.1 (not drawn); F17
read the drawing one register behind (cache keyed on the tick only) and the impaired zone at P2, F18 read the cleared
register stale (`clearRegister` rendered without evaluating) — all three fixed in the same release.

**A modal never redraws the sheet the click came from (PRD-DCAI-LIVING-PLANT A0, owner C10: "konyol").** v3.65.0 made
a WAN node, a security zone, a BMS application and a field group open the architecture sheet they sit on with the item
selected, and v3.65.2 did the same for the cylinder bank on DH-F-102. That is withdrawn: those five classes have no
tier-2 opener (`tier2: null`), a click opens the inspector, and each gets a drawing of its own in a later phase (A2b,
A5). Law **M10** compares the SET OF DRAWN NODE IDS of a modal with its parent sheet (under 50 % shared), so a renamed
copy still fails; it replaces M6, which asserted the opposite. A class with an own drawing of few items is fine — a
conduit (`net-conduit`, `conduit-l3`: source zone and what it holds, the enforcement elements, the destination zone,
the allowed protocol on the line) is drawn from `ZONES` alone and shares only its two zone blocks with DH-N-104.

**L3 by own data (v3.65.0).** A class with
its own data draws its own sheet: `leak-l3` (24 zones, one loop; a node with `pumpState` carries the payload alarm only
when its own row is in fault), `fws-l3` (branches from the engine's CDU count). Nothing is drawn that the payload or
the engine does not state. Law M7 (`tools/test-dh-drawings.mjs`), red on v3.64.1.

**Opened item in view (v3.65.3).** `RZHmiSheet` exposes `center(nodeId)`: scrolls the frame so the node is in its
middle, no zoom. `openSheetModal` centres the opened item after render (a phone shows part of a sheet). Law U8.

**Counted, not typed (v3.65.2).** `facp-l3` draws one symbol per circuit and device type and takes each count from
the fire point inventory at draw time (`address` prefix × `type`); law M9 compares the drawn counts with the
inventory's. An
isolable fire point (detector, VESDA unit, call point, EPO) keeps the inspector on a plain click: its isolation
workflow is there, so H3 will not count those four classes. Phone: a modal header whose only button is Close stays on
one line (law U7).

**Sheet modal (v3.65.1).** A class with its own L3 and no legacy modal opens through `openSheetModal({ cls, id, tag,
name, sheet, o, read })` in `hmi-v2.js`: the sheet, the payload's points and alarms, the CDU / fire-zone shell. `read`
names the sheet whose scenario mapping the nodes use (`dh-e-001` for `main-tx-l3` and `genset-l3`, whose node ids are
the site SLD's). The payload names the opener (`tier2('maintx', [feed])`, `tier2('genset', [])`). Law M8. H3 counts a
schematic's symbols before the modal closes (the sheet modal empties its drawing on close).

**U1 (v3.64.1).** Every drawing — an `<svg>` with an id, legacy or HMI — has an accessible name: `aria-label`, an
`aria-labelledby` that resolves (a modal drawing points at its modal title), or `aria-hidden` for decoration. An
interactive drawing takes `role="group"`, never `role="img"` (that would hide its focusable items). 28 of 50 failed
on v3.64.0.

**Lifecycle and identity laws (v3.63.3, audit 2026-11-16).** `tools/test-dh-drawings.mjs`:
- **L1** a destroyed sheet leaves nothing behind: 20 modal open / close cycles keep the number of `pointermove` /
  `pointerup` listeners on `window` constant (read through CDP `DOMDebugger.getEventListeners`), and no tooltip appears
  after the modal closed. Rule: every listener a renderer adds outside its own SVG is a named function removed in
  `destroy()`; every timer is cleared there.
- **L2** a record id is never reused in a page session: the isolation sequence survives "Clear register"
  (`createRegister(seq)`). **L7** an isolation reason is capped (`REASON_MAX`, 500) so its record always passes the
  alarm schema; a record offered while the Alarms workspace is not ready stays unseen and is offered again, a batch the
  schema refuses is dropped (kept, it would block every later record).
- **L3** an item belongs to its sheet's hall: a hall SLD (`dh-e-1NN`) reads a context built for hall NN and its host
  carries `data-rz-hall`, which the inspector resolves (two-digit halls included).
- **L4** a table's row cache is keyed on the ids it shows, never on their count.
- **L5** an item's id carries its own number (`rack-ct:R07-CT-18` opens CT-18).
- **L9** a `data-tip` is text (`textContent`), never parsed as HTML.
Each failed on v3.63.2: listeners 66 → 106; `FIRE-ISO-1001` twice with 0 records in Alarms; "MSB-1A/B — DH-01" on the
DH-03 sheet; Z05 rows under a Z06 run; CT-01 for CT-18; 5,016 characters stored and no record; markup rendered on 9
drawings with `onerror` fired. Node: `test-datahall-ai-hmi-payloads` H7, `-replay` R11, `-fire-points` F13.

## 6. Local mock

`node tools/build-dh-drawings-mock.mjs` writes `dh-drawings-mock.html` (noindex, never linked, not committed). On
`127.0.0.1` / `localhost` it opens unlocked through the documented premium **test seam** (`rz_premium_session`,
educator role, no credential) — the seam is inert on any other host (R142).

## 7. Open items (owner R139/R140, after v3.60.0)

Network DH-N-101, Room Layout DH-A-101, BMS DH-B-101, cooling sheets 101/102/104/105, electrical 002/003 (fire 102–104 shipped v3.61.1 / v3.63.0);
loop isolators and pipe end caps on DH-F-101; L3 schematics for the remaining classes (H3 ratchet); more detail per sheet (instrument bubbles, line numbers, valves on every branch).
