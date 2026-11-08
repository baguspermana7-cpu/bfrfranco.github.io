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

## 4 Gates (all wired in `tools/ship-gate.sh`; a gate that exists but is not wired is the defect, see UIUX ledger)

| Gate | Proves | Red proof recorded |
|---|---|---|
| `tools/test-cx-plan-core.mjs` | level math, gates, tags, totals pure functions of the plan | v3.26.0 |
| `tools/test-cx-calendar.mjs` | work-day shifts, baseline fields, witness slot float, clamped overrides | v3.26.1 |
| `tools/test-cx-io.mjs` | CSV round-trip, cell hygiene, duplicate ids, release rows | v3.26.1 |
| `tools/test-cx-assets.mjs` | every family a shaped, bounded, deterministic geometry; campus wires `RZCxAssets.build` | v3.28.0 |
| `tools/test-cx-glb.mjs --regen` | one low + one `_hi` mesh per family, footprints, budgets, shades ≥ 0.40, byte-identical regeneration | v3.28.0; v3.29.0 on the old glb (missing `_hi`, shades 0.25) |
| `tools/test-cx-campus-basis.mjs` | counts, CDUs, flows, callout text follow the engine basis; light palette; capacity text | v3.29.0 (old module has no `layout()`) |
| `tools/test-cx-records.mjs` | Tier 3 record layer: PRD v1.0 invariants (R1–R13) on `data/cx/demo-records.json`, overlay on `statusAt`, register import reasons (R14) | v3.29.0 (one mutation per law) |
| `tools/test-dcmoc-cx-plan.mjs` | DCMOC bridge returns the site module's plan and status (deep-equal), store clamps/persists/caps scenarios at 5; needs `dcmoc/node_modules` (symlink in a worktree, git-ignored) | v3.29.0 (site module swapped for a copy with one planning-day changed) |
| `tools/test-cx-analysis.mjs` | browser: plan editor, schematic, 3D (glb 15/15, ≤ 300 draw calls, ≥ 24 fps, callouts, hulls, K16 probe both themes, K17 LOD, K18 re-layout), Tier 1.5 calendar, 390 px, no errors | each release |

Run under `rz-lane -l 1` (lane 0 = LTC). A Navigation-timeout row under lane contention is UNMEASURED: re-run alone,
never waive.

## 5 Ledger

Owner comments K1–K18 and their state live in the harness PRD v1.1 §41
(`~/.local/state/rzharness/projects/PRJ-RZ-WEB/work-items/WI-CX-SUPERAPP-001/PRD_v1_1.md`); every new owner comment
is a new K-row there before any code. Tier 3 discovery: `TIER3_DISCOVERY.md` in the same directory.
