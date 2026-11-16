# HMI drawing standard — datahallAI (and every later cockpit drawing)

Status: v3.60.0 (2026-11-14). Owner decisions R128–R134 (redraw), R143 ("jadikan ke prod aja lgsung": the mock
ships as-is, deep shading included; more detail continues in later releases). PRD: `documentation/prd/datahall-ai/PRD_DATAHALL_DRAWINGS.md`.
Scenario work on top of these drawings: `documentation/prd/datahall-ai/PRD_CX_SCENARIOS.md` (not started).

## 1. What a drawing is

A **sheet**: one SVG drawn by `js/rz-hmi-sheet.js` (`RZHmiSheet.render(host, sheet, {read, flow, open})`) from a sheet
object built in code (`js/datahall-ai/hmi-sheets.js`, `RZDatahallAISheets.build(id, snapshot, opts)`), using only the
shared symbol library `js/rz-eng-symbols.js`. The page mounts a sheet into the `.bx` of the tab it replaces
(`js/datahall-ai/hmi-v2.js mountAll`); the previous drawing in that box is retired (`data-dh2-retired`, hidden by
`css/rz-dh-shell.css`), never deleted in the same release. A sheet with no legacy drawing gets its own box after an anchor drawing (`mountNew`). A builder that throws
leaves the old drawing in place — never a blank box. A sheet is drawn only once its tab panel (`.pn`) is shown — on the tab click or key, never into a hidden panel at boot (gate `test-dcai-deferred-panels.mjs` D6: 6,127 attribute writes in hidden panels during 9 s before v3.62.1). `mount(..., {keep: true})` instead inserts the sheet right
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

## 6. Local mock

`node tools/build-dh-drawings-mock.mjs` writes `dh-drawings-mock.html` (noindex, never linked, not committed). On
`127.0.0.1` / `localhost` it opens unlocked through the documented premium **test seam** (`rz_premium_session`,
educator role, no credential) — the seam is inert on any other host (R142).

## 7. Open items (owner R139/R140, after v3.60.0)

Network DH-N-101, Room Layout DH-A-101, BMS DH-B-101, cooling sheets 101/102/104/105, electrical 002/003 (fire 102–104 shipped v3.61.1 / v3.63.0);
loop isolators and pipe end caps on DH-F-101; L3 schematics for the remaining classes (H3 ratchet); more detail per sheet (instrument bubbles, line numbers, valves on every branch).
