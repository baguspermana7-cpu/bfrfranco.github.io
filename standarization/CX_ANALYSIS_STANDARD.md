# Cx Analysis standard — the commissioning programme as an app (cx-calculator.html, tab "Cx Analysis")

> Owner work item WI-CX-SUPERAPP-001 (PRD v1.0 by the owner, PRD v1.1 §41 ledger). Shipped v3.26.0 → v3.29.0.
> Read before touching `js/rz-cx-*.js`, `css/rz-cx-analysis.css`, `assets/cx/campus-equipment.glb`,
> `tools/cx-assets/build-cx-assets.py` or any `tools/test-cx-*.mjs`.

## 1 One source of numbers

Every number on the tab comes from `RZEngine.models.commissioning.programPlan(input, overrides)` (schedule, cost, MH)
and `RZEngine.models.commissioning.mapInput` + `equipScale` (equipment counts). `js/rz-cx-plan.js` holds the level
math (`compute`, `gateMonths`, `statusAt`) as pure functions; the UI (`js/rz-cx-analysis.js`), the schematic
(`js/rz-cx-schematic.js`) and the 3D campus (`js/rz-cx-campus.js`) draw what those return and never add arithmetic.
Grand total must agree with the calculator tab within 1 %. Sources per row: Cx Field Manual ch 02 §2.4–2.7, 07, 11,
28, 30 (linked from each row).

## 2 Status is four things, drawn as four things

Level (L1–L5 accepted), tag colour (handbook 02.6: red/yellow/green/blue/white), "in test" (next level's window is
open) and "changed this month" are separate fields of `statusAt()`; the schematic, the 3D tint and the status table
read the same row. Untagged = `none`. No colour is derived from a second source.

## 3 The 3D campus (P3, P6, P7)

- **Palette is the PRD's, not the page theme's** (K16, owner 2026-11-08 "Jangan gelap2"): canvas `#F4F6F8`, ground
  `#EEF2F6`, text `#17212F`, lines `#D9E0E8` in BOTH page themes; `.cx-3d-stage` re-scopes the `--rzt-*` tokens so the
  dark page does not darken the instrument. Untagged equipment is light grey (`TAG_HEX.none = 0xd9e0e8`); two lights
  (hemisphere 1.25 + one sun 0.45) — a third light costs frames on software GL. Proven by a GL read-back
  (`api.probe()`: 5 pixels, **min** ≥ 0.6 and mean ≥ 0.75) in both themes, not by reading the source.
- **Equipment is the engine's** (K18): `layout(basis)` is a pure function of `{itKw, rackKw, coolingType, es}`;
  families are allocated at `CAP` and drawn at `im.count`; when the basis exceeds a cap the callout says
  "N of M drawn" (never a silent truncation). Changing an input re-lays the plant without a reload
  (`setBasis`). CDUs exist only for liquid cooling; loop particle speed ∝ design flow; air-cooled ⇒ FWS 0 L/s.
- **Detail where the camera is** (K17): every family has a low mesh (campus) and a `_hi` twin (focused building,
  LOD swap in `focus()`); outline hulls only on the focused building and never on a dense family (racks: 334 hulls at
  0.9 m pitch read as a grey mass). Budgets per mesh in `tools/test-cx-glb.mjs` BUDGET; whole library ≤ 32 000 tri,
  ≤ 1.4 MB, lazy-loaded after the page.
- **The glb is generated, never hand-edited**: `~/tools/blender/blender -b --python tools/cx-assets/build-cx-assets.py -- out.glb`
  (Blender 4.5, deterministic; FLOAT_COLOR shade factors ≥ 0.40 mirrored in `js/rz-cx-assets.js`). `box(w, h, d, …)`
  is w along X, **h = height (Z)**, d along Y — four `_hi` parts once shipped swapped and failed the footprint law.
  Look at the rendered grid (`render-fams.py` in the WI scratch) before trusting a shape.
- **Callouts**: one per family of the focused building, stacked at the stage margin (left/right columns, 26 px
  pitch), dashed leader to the first instance, text `<label> · <count> · <basis> · <state>`. Building labels yield
  to callouts (a label that would sit under a callout moves below it).
- No WebGL ⇒ one sentence and the schematic remains; page errors 0.
- **Motion is the reference video's** (K27, owner 2026-11-09 "seperti melihat plant itu hidup", PRD §2 Video B, §26):
  a focus is ONE eased camera move (`CAM_MS` 450, ease-out cubic) that carries target, zoom and orbit position
  together — never a cut, never two moves; the neighbours fade over `FADE_MS` 360 instead of blinking; Explode fans
  the layers out bottom-first (`EX_MS` 520, each layer its own ease, `EX_STAGGER` 0.22); a click on equipment inside
  the focused building **picks** that family: it is lit (emissive `#2563eb`), the rest of the building recede to 0.3,
  its callout is marked `data-picked`, the breadcrumb reads `Campus › building › family`, Esc un-picks then
  un-focuses. The first mount cuts (nothing to ease from). `prefers-reduced-motion`: camera cuts, no fades, Explode
  lands in one frame. No auto-orbit, no glow, no particles beyond the design flows. State: `api.motion()`.
  Every clock starts on the first DRAWN frame (rAF time, never `performance.now()`), every ease has a landing timer
  at 2× its duration (a throttled rAF must not leave the camera half-way), negative frame dt is clamped to 0, and
  `api.step(t)` is the test seam that draws one frame at a given time (software GL frames run 150–400 ms, so
  wall-clock polling cannot see an ease). Fit selection frames a building at `2.5 × 62 / max(w, d)` so the callout
  columns sit in the margins. **Callouts never cover what they name**: each column tries near / top / bottom and keeps
  the placement covering the fewest anchor points; under 640 px stage width one column, text `label · count`, clamped
  inside the stage (both proven red first: 3 anchors covered at 1440, 8 callouts out of the stage at 390).

## 3b Records (Tier 3 slice)

`js/rz-cx-records.js` is the record layer the plan does not have: assets, ports/connections, model mappings, gate
instances, approvals, test packs/attempts/steps, issues, cost allocations, observations, scenarios (TIER3_DISCOVERY.md
§1 contract). `validate(db)` returns one finding per broken invariant (law id R1–R13, record id, sentence);
`overlay(statusAt, db)` puts the ACTUAL accepted level per system next to the planned one with an explicit denominator
("3 of 10 L3"), "Model not verified (n of m)" when mappings are missing, and "no register" when a system has no
assets — never an invented count. Acceptance comes only from an accept decision whose `revision_hash` equals the
gate's; a pass result is not acceptance; an open blocking issue forces `blocked`. The Records panel
(`js/rz-cx-records-ui.js`) renders the overlay, the findings and a CSV register import whose rejected rows each carry
a reason. The shipped set is `data/cx/demo-records.json` and says so on the panel.

## 3c Workbench (K21, v3.31.0)

`js/rz-cx-workbench.js` makes the plan editor an application, PRD v1.1 §17 / §22 / §23. Every level bar on the
timeline is a slider: drag the body to MOVE (start; effort and cost unchanged), drag the right end to STRETCH
(duration; crew needed changes, L5 witness days move cost), 0.1-month steps, Esc cancels a drag, the same on the
keyboard (arrows move, Shift+arrows stretch, Alt for 1.0-month steps). Every change goes through the same
`S.overrides` path as the table, so the monthly curve, crew histogram, schematic and 3D follow it. Undo/redo keeps 50
states (buttons, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y); a drag is ONE history entry, not one per frame.

The Impact panel is `RZCxPlan.impact(plan, base, cap)`: differences of two engine plans (with and without the
overrides), never re-derived figures. It says WHY a level moved (`edited` or `carried from Lx — levels run in
series`), warns when a level is pulled in before its predecessor ends (the handbook gate sequence) and when months sit
above the site crew cap, and draws scenario − baseline per month (amber = more cost that month, grey = less), with a
CSV of baseline / scenario / Δ. Named scenarios are `RZCxPlan.scenarios(storage)`: up to 5 per browser (same cap as
the DCMOC store), name 1–40 characters, a repeated name replaces, a sixth new name is refused with a reason; the table
compares each against the baseline and the editor.

## 4 Gates (all wired in `tools/ship-gate.sh`; a gate that exists but is not wired is the defect, see UIUX ledger)

| Gate | Proves | Red proof recorded |
|---|---|---|
| `tools/test-cx-plan-core.mjs` | level math, gates, tags, totals pure functions of the plan; `impact()` (carry attribution, overlap, over-cap, Σ monthly Δ = Δ cost) and `scenarios()` (trim, sanitize, replace, cap 5, foreign/malformed store) | v3.26.0; v3.31.0 (missing functions, then one mutation each for carry, cap and the 5-limit) |
| `tools/test-cx-calendar.mjs` | work-day shifts, baseline fields, witness slot float, clamped overrides | v3.26.1 |
| `tools/test-cx-io.mjs` | CSV round-trip, cell hygiene, duplicate ids, release rows | v3.26.1 |
| `tools/test-cx-assets.mjs` | every family a shaped, bounded, deterministic geometry; campus wires `RZCxAssets.build` | v3.28.0 |
| `tools/test-cx-glb.mjs --regen` | one low + one `_hi` mesh per family, footprints, budgets, shades ≥ 0.40, byte-identical regeneration | v3.28.0; v3.29.0 on the old glb (missing `_hi`, shades 0.25) |
| `tools/test-cx-campus-basis.mjs` | counts, CDUs, flows, callout text follow the engine basis; light palette; capacity text | v3.29.0 (old module has no `layout()`) |
| `tools/test-cx-campus-motion.mjs` | K27 motion: eased camera frame by frame (step seam, lands at 450 ms), fades, staggered fan-out, pick lights one callout + 3-level breadcrumb, M7 390 px callouts inside/no overlap, M8 1440 no anchor covered, reduced motion instant | v3.33.0 (HEAD: no `motion()`, M7 8 callouts out; near-only columns: M8 3 covered) |
| `tools/test-cx-records.mjs` | Tier 3 record layer: PRD v1.0 invariants (R1–R13) on `data/cx/demo-records.json`, overlay on `statusAt`, register import reasons (R14) | v3.29.0 (one mutation per law) |
| `tools/test-dcmoc-cx-plan.mjs` | DCMOC bridge returns the site module's plan and status (deep-equal), store clamps/persists/caps scenarios at 5; needs `dcmoc/node_modules` (symlink in a worktree, git-ignored) | v3.29.0 (site module swapped for a copy with one planning-day changed) |
| `tools/test-cx-analysis.mjs` | browser: plan editor, schematic, 3D (glb 15/15, ≤ 300 draw calls, ≥ 24 fps, callouts, hulls, K16 probe both themes, K17 LOD, K18 re-layout), Tier 1.5 calendar, workbench W0–W8 (real pointer drag move/stretch, Esc, undo/redo, Ctrl+Z, keyboard, impact reasons, over-cap, Save as/Load/Delete, cap 5), 390 px, no errors | each release; W-laws v3.31.0 (absent on the old tree) |

Run under `rz-lane -l 1` (lane 0 = LTC). A Navigation-timeout row under lane contention is UNMEASURED: re-run alone,
never waive.

## 5 Ledger

Owner comments K1–K21 and their state live in the harness PRD v1.1 §41
(`~/.local/state/rzharness/projects/PRJ-RZ-WEB/work-items/WI-CX-SUPERAPP-001/PRD_v1_1.md`); every new owner comment
is a new K-row there before any code. Tier 3 discovery: `TIER3_DISCOVERY.md` in the same directory.

## Program tree — five-deep breakdown of L0–L6 (`js/rz-cx-tree.js`, owner K28 2026-11-08)

`RZCxTree.programTree(input, overrides)` breaks every commissioning level into
**level → system → subsystem → equipment type → activity**, five deep. Every number is an allocation of
`RZEngine.models.commissioning.programPlan(input, overrides.plan)`. The tree adds no cost of its own.

**Invariants.** `tools/test-cx-tree.mjs` gates each of these, on the 8 engine scenarios plus one edited plan:
- A level node equals its `programPlan` level exactly: cost, man-hours, start and finish.
- Every parent's cost and man-hours are exactly the sum of its children. The split uses largest remainder on
  integers, so it never drifts by a dollar. Labour days split the same way, to the hundredth of a day.
- A parent's window runs from its earliest child start to its latest child finish. Nothing leaves its level window.
- Every leaf is an activity at depth 4.

**Shares.**

| Level | System share | Source |
|---|---|---|
| L0 | handbook L2+L3+L4 planning days | 02.4.8: review effort follows system complexity |
| L1 | units factory-tested; only FAT equipment appears | `subActivities.l1`: "per-unit FATs … unit-count-driven" |
| L2–L4 | handbook planning days for that level | 02.4.8 (same table as `rz-cx-plan.js` SYSTEMS) |
| L5 | handbook L4 days | integration depth |
| L6 | assets handed over | `subActivities.l6`: "O&M, as-builts & CMMS load" |

Below the system level:
- Subsystems and equipment are shared by unit count. The counts come from `equipScale`; BMS points come from
  `bms[bmsComplexity].pts`.
- Activities are the level's `subActivities` that apply to the equipment's discipline, shared by their `w`.
  Electrical start-up, for example, does not appear under a chiller.

**Time.**
- Systems and equipment work in parallel inside the level window.
- Activities follow the handbook dependency chain (`dep`). The chain is stretched so its critical path fills the
  window. A chiller's start-up therefore begins when electrical start-up ends.
- Crew on any node = labour days ÷ (months × 22) ÷ shift productivity. This is the `programPlan` formula.

**Site rules (screening, each named in `SOURCES`).**
- CDUs and rack manifolds exist only for liquid cooling (dlc, immersion), counted as `cooling_units`.
- CRAH terminals exist only for air, in-row and RDHx cooling.
- There is one dry cooler per chiller.
- There are two DCIM servers per site.

**On the page — Program breakdown panel (`js/rz-cx-tree-ui.js`, K28 UI).** A treegrid (`role="treegrid"`,
`#cxTrGrid`) under the plan editor and its calendar panel (`#cxExPanel`, which gate P5 keeps directly under the
editor). Rules:
- Every row prints its node's numbers from `RZCxTree.programTree(cxReadInputs(), { plan, nodes })`, the same input
  and plan the editor uses. The panel computes nothing. Each row carries `data-path`, `data-cost`, `data-mh` and
  `data-finish` so a gate can compare it to the engine.
- Levels are edited only in the plan editor ("set only the parent"); a level row has no weight box. Changing a level
  re-renders the tree and every descendant moves with it.
- A node below a level takes a weight (0–100, ×1 by default) and an "include" box. Both go to the engine as
  `overrides.nodes[path]`; siblings re-share and the parent total holds.
- The engine drops a node whose weight is 0 or that is excluded. The UI keeps it on screen as a ghost row
  (`data-ghost`, dimmed, every number 0, its weight and include boxes live) in its baseline place, so an edit can
  be undone in the row where it was made. A ghost row must never be a node the engine still carries. An edit under a
  ghost parent stays stored but is out of reach until the parent is restored.
- Keyboard: one tab stop for the whole grid (the focused row and its two boxes; every other row and box is -1).
  An edit or any re-render (a plan hook) keeps focus where it was, in the same box. While Find is on, every match's
  path is open and open/close keys do nothing.
- Node overrides persist in `localStorage['rz-cx-tree']` = `{ version: 1, nodes }`. "Reset breakdown" clears
  them, and so does the editor's "Reset to baseline".
- Navigation: Level / System / Subsystem / Equipment / Activity open the tree to that depth; Find keeps the matching
  rows and their ancestors. Keys: ↑/↓ move, → opens or goes to the first child, ← closes or goes to the parent,
  Home/End, Enter/Space toggle. Only rows that are open render (1,269 nodes at 2 MW when fully open).
- The whole grid fits its panel at every width: item names wrap, indent is a CSS step per level (16 px, 8 px on a
  phone). At ≤ 640 px qty, share, window, crew and man-hours hide; item, cost, weight and include stay.

Gate: `tools/test-cx-tree-ui.mjs` (K1–K14): seven level rows under the editor; every shown row equals the engine,
collapsed and fully open (row count = engine node count); each parent = sum of its child rows; keyboard walk;
a longer L3 carries every L3 system; weight 0 and exclude zero a system while L3 holds; persistence and reset;
a zeroed system stays as a ghost row with a live weight box; find; no sideways scroll at 390 px; the grid
fits its panel with the include box on screen at 1440 and 390 px (K10); focus stays in the edited box and one row is
the grid's only tab stop (K11); Find on, the arrow keys walk without losing focus (K12); no page errors.
Density (K13, v3.34.1): the tool bar stays one row at 1440 px; the weight box is 48 px wide and 26 px tall (16 px type
on a phone, no iOS zoom); a row stays one line high (median ≤ 36 px over the first 60 rows) because the node kind is
the name cell's tooltip, not inline text that wraps; vertical hairlines mark each indent level; include uses the page
accent (`accent-color`), never the browser's default blue; Reset is disabled until a node carries an edit. Any
label used as a button (the two "Import … CSV" file pickers) is an inline-flex box at the sibling button's height
with its text centred (K14).

**Edits.**
- `overrides.plan` is the existing level contract. Setting only the level (start, months, crew, shift) moves every
  descendant.
- `overrides.nodes[path]` accepts `{ weight: 0…100 }` (a multiplier on that node's default share among its
  siblings) and `{ exclude: true }`. The parent total holds either way.
- Paths look like `L3/chillers/chillers/chiller/a1`. Junk paths and values are ignored.

**Proof.** The gate passes 128/128. It was proven red twice:
- Plain rounding instead of largest remainder: T2 fails, with parents off by $1–2.
- Ignoring `dep`: T9 fails, because mechanical start-up began at the level start.

## 3d The inside of a block (K29, 2026-11-09)

Owner: *"per block itu klw di klik harusnya ada sesuatu misal modal schematic lain"*. A click (or Enter) on a block of
the giant schematic selects it AND opens `#cxDetail` (`js/rz-cx-detail.js`, native `<dialog>`): the system's own sheet
from `js/rz-cx-subsheets.js` (17 sheets, RZDiagram + RZEngSymbols, zero engine warnings, ≤ 9 components), its L1–L5
gate months from `RZCxPlan.statusAt` at the viewed month, the L1–L5 test ladder (UPS, chiller, CRAH, BMS, EPMS and fire
ladders are handbook 02.7.1–02.7.6; the rest condensed from the owning chapter, each row with its anchor), a component
card, and one-hop Fed by / Feeds from `RZCxSchematic.EDGES` (a transitive trace lists half the plant around the closed
liquid loops). Escape closes it and focus returns to the block. Sheet arrangements are typical for the MSC-1 basis and
print no quantities. The main sheets carry `×n` per block from `equipScale(mapInput(input))` and a note naming that
source; without a scale no count is drawn. Gates: `tools/test-cx-detail.mjs` (D1–D5, RED 2/5 on the pre-K29 tree),
`tools/test-cx-schematic.mjs` K29 counts.

**K29b — the main electrical sheet follows the redundancy input (2026-11-09).** Owner: *"giant schematic … receh,
kurang detail"*. Sheet A draws the feed chain HV intake → main TX → MV board → unit subs → UPS → LV busway once for
N / N+1 and twice for 2N / 2N+1 (feed A on top, feed B below as `mirrorOf` twins), with a `BUS TIE · normally open`
between the MV sections, the IT load spanning both rows as dual-corded A + B, and the generator ATS labelled normally
open. Each system stays exactly one hit target; the twin carries the same state and every copy gets the
changed / in-test / selected marks (`js/rz-cx-analysis.js` marks with `querySelectorAll`). `×n` counts print on feed A
only. The trace never runs through the bus tie (it is not in `EDGES`). Gates: `tools/test-cx-schematic.mjs` K29b
(RED 4 failures on the pre-K29b tree, then 41/41), `tools/test-rz-diagram-engine.mjs` U2c/U2d (`mirrorOf`).

**Motion gates wait on conditions, not clocks (2026-11-09).** The campus camera and the explode each guarantee landing
by a timer (`CAM_MS × 2`, `EX_MS × 2`) when rAF is starved; the explode timer now moves the layers with the factor
(before, it set the factor to 1 and left the top layers mid-stagger until the next frame). Gates wait for the landed
state with a deadline (`waitForFunction`) instead of a fixed sleep shorter than the guarantee — M5 slept 800 ms against
a 900 ms guarantee and flaked under a loaded ship gate. Law M9 (rAF stubbed out, explode still lands, layers included)
was RED on the old timer, GREEN after.
