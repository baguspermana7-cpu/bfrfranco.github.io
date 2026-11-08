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
