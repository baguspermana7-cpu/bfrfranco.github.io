# Diagram Engine Standard

> Every block diagram on resistancezero.com is drawn through the RZ diagram engine.
> This document says why the engine exists, what it guarantees, and what an author
> is still responsible for.

Adopted v3.10.0 (2026-09-20). Gate: `node tools/test-rz-diagram-engine.mjs`.

---

## 1. The defect this removes

The cockpit pages build SVG by concatenating strings with coordinates typed by hand:

```js
s += tx(860, RY - 5, 'TCS Return ' + d1(gv('tcsReturn')) + '°C', 'var(--o)', 4, 'middle');
```

That line was correct the day it was written. It is not correct now, and nothing in the
page said so. Three failures from one week, all the same shape:

| What broke | Why |
|---|---|
| The ISA-5.1 legend and the PUE badge overlapped by 50 units | Both were pinned to the top-right corner of a 960-wide viewBox. Neither measured the other. |
| The TCS and CDU parameter panels were painted on top of the return lines they annotate | Each panel grew rows over time; the `height` did not, and then did, past the line. |
| The CDU header bar carried a title about 170 units wide in a bar 148 units wide | Nothing measured the title before centring it. |

The common cause is not carelessness. **It is that the drawing code cannot ask how wide a
label is.** Every fix by hand is a fix for one render of one diagram at one viewport, and
survives until the next engine value changes length.

The geometry survey (`tools/test-conv-geometry.mjs`) measures the result: at adoption,
`datahallAI.html` reported 218 findings across four viewports and two themes, dominated by
the building isometric.

---

## 2. What the engine guarantees

Three modules, all DOM-free so the ship gate asserts the same numbers the browser draws.

### `js/rz-diagram-metrics.js` — measurement

A per-character width budget, from the `resistancezero` diagram-design profile:

- every Unicode wide or full-width character costs **1em**;
- every other character costs its face's Latin advance — **0.58em** IBM Plex Sans,
  **0.60em** JetBrains Mono (exact: it is monospaced);
- nonspacing and enclosing marks cost **nothing**;
- tracking is added **per character**, including after the last one, because that is how
  every SVG renderer applies `letter-spacing`. An 0.18em eyebrow is far wider than its
  untracked twin, which is why tracked labels collide.

Counting by script is the trap. `주문 v2.1` is two full-width syllables and five narrow
characters; a formula that tallies "Hangul plus Latin letters plus spaces" silently drops
`2`, `.` and `1` and sizes the box for four of its seven characters.

The sans budget carries a proportional correction — caps and digits cost more than the
mixed-case average, i-stems and punctuation less. All-caps eyebrows and tags are the common
case on this site, not an edge case, and a flat average undersizes exactly them.

`overlap()` reports **per axis**, not a boolean, and names the cheaper separation axis.
A boolean is what made one afternoon expensive: two attempts were spent nudging a label
down when the overlap was 27px horizontal and 2px vertical.

### `js/rz-diagram-layout.js` — placement and routing

`placeLabel()` **searches**: the preferred slot at 8px clearance, the same slot at the 6px
floor, then slid along the connector in 8-unit steps, taking the first position that hits
nothing already on the canvas. If every candidate is blocked it returns `placed:false`.

> **The engine never draws a label it could not place.** A silent overlap is the defect
> being removed; a caller that gets `placed:false` has a real layout problem and is told.

`route()` produces orthogonal connectors only, with quarter-arc elbows at r=8 that shrink to
6 when a leg is too short to carry them. It reroutes around any box that is not one of its
endpoints. When no route clears, it returns the shortest one with `transit:true`, and the
facade draws that dashed with no arrowhead on the intervening box.

`fanPoints()` spreads N connectors on one edge at `L · k / (N+1)`, and sets `crowded` when
the edge cannot hold them 12px apart.

A **zone is not an obstacle**. Zones are painted before labels, so a label over a container
is readable and is the normal case. Counting zones as obstacles makes every position inside
a container look occupied — it made a wide-open canvas report "no room" for four labels the
first time this engine drew a real diagram.

### `js/rz-diagram.js` — the surface pages call

`create()` → `zone()`, `node()`, `text()`, `edge()`, `fit()`, `render()`.

- A node is **sized from its own content** unless a width is passed; an explicit width too
  small for the content warns.
- `fit()` shrinks the frame to what was drawn. A viewBox typed in advance is defended until
  it stops being true.
- Paint order is **zones, connectors, nodes, labels**. Labels last means a label can never
  be clipped by a node painted after it — the failure is removed by construction rather
  than detected by a verifier afterwards.
- Colours resolve to the page's own CSS custom properties. **No literal hex leaves the
  engine**, so one edit to a cockpit's `:root` re-skins every diagram on it, both themes.

---

## 3. The design system it implements

Geometry and structure follow the `diagram-design` skill (installed at
`~/.claude/skills/diagram-design`), whose §6 connector rules this project adopted verbatim.
The skin is the `resistancezero` profile at `~/.diagram-design/profiles/resistancezero.md`,
selected by the `.diagram-design` marker at the repo root.

### Two of the skill's anti-patterns are deliberately overridden

`SKILL.md` §4 lists "dark mode + cyan/purple glow" and "never JetBrains Mono" as AI slop.
Both are documented decisions in `documentation/design.md`, and onboarding is the mechanism
for exactly this override:

- **Dark + instrument cyan is not a glow.** There is no glow, shadow or bloom anywhere in
  this system — §4's real complaint is decoration standing in for decisions. Here the
  palette is ISA-18.2: amber is caution, green is in-parameters, red is fault, cyan is
  informational. Each hue is a *channel*. The ban on glow stands.
- **JetBrains Mono is the data face**, chosen for its slashed zero and tabular figures; a
  0/O ambiguity is unacceptable in engineering data. §4's rule against blanket mono holds
  in full — names go in IBM Plex Sans, mono is numbers, units, ports and tags only.

Everything else — the six connector rules, the 4px grid, the complexity budget, the
focal-accent rule, the accessible-SVG contract — applies unchanged. **The skin is brand.
The geometry is not negotiable.**

### Contrast is measured, never inverted

Signal amber `#FFAA00` reads **1.82:1** on `#f8fafc` and fails every threshold. The light
face carries `#8A5A00` (5.7:1) instead. No role in the profile sits below 4.5:1 against its
own paper. Purple is banned by **hue band** (HSL 238–310), gated by
`tools/test-purple-family.mjs` — a hex grep left 1,238 same-hue literals live.

---

## 3b. The engine already reaches the existing drawings

Migration is per diagram, but one piece of the engine reaches every cockpit immediately.

`js/rz-svg-basis.js` places a provenance mark just past the end of its label. It sized that
label with `String(text).length * size * 0.6`, and the constant beside it said so out loud:

```js
var MARK_GAP = 2.4;  // gap between the text end and the mark centre (approx; text width unknown at build time)
```

It is knowable now. `approxWidth()` asks `RZDiagramMetrics` when the engine is on the page:

| label (size 6) | old estimate | measured |
|---|---|---|
| `440 kW` | 21.6 | 21.6 |
| `PIPE RACK` tracked 0.18em | 32.4 | **42.1** |
| `主控室` | 10.8 | **18.0** |
| `iiiiii` | 21.6 | **11.5** |

A flat per-character estimate puts the mark 10 units inside a tracked eyebrow and 7 inside a
CJK label, and 10 units adrift of a narrow one. Three rules hold this hand-off:

1. **The lookup is at call time, not load time.** A load-time capture would freeze whichever
   script happened to parse first.
2. **The fallback is the old estimate.** A page that has not adopted the engine keeps exactly
   the behaviour it had — this is an improvement where the engine is present, never a
   dependency.
3. **The engine's script tag is synchronous and before its consumer.** `defer` or a later tag
   leaves every mark silently on the approximation, which looks identical to working.

Gated by `B1`–`B3` in `tools/test-rz-diagram-engine.mjs`.

---

## 3c. The token contract, and how it fails

The engine emits **no literal hex**. Every colour resolves to a custom property, which is what
lets one edit to a cockpit's `:root` re-skin every diagram on it in both themes. The other half
of that bargain is that the adopting page must define the whole set:

| role | property |
|---|---|
| `paper` | `--bg1` |
| `paper-2` | `--bg3` |
| `ink` / `muted` / `soft` | `--t1` / `--t2` / `--t3` |
| `rule` / `rule-solid` | `--bd` / `--bd2` |
| `accent`, `alarm-caution` | `--o` |
| `link`, `alarm-info` | `--c` |
| `alarm-normal` | `--g` |
| `alarm-fault` | `--r` |

> **A missing custom property fails silently, and it fails in exactly one theme.**
>
> The demo page called its panel colour `--panel`. The engine asked for `--bg3`, the variable did
> not exist, and `fill="var(--bg3)"` resolved to an invalid value. Against dark paper the focal
> node looked correct. Against light paper it rendered solid black with unreadable text. Nothing
> logged, nothing threw, and the dark screenshot that had already been taken showed no defect.
>
> **Check both themes by rendering both**, not by reasoning about the palette. This is the same
> class as the `:root, [data-theme="light"]` cascade bug in `CLAUDE.md`: a colour that is wrong
> in one theme only is invisible to anyone working in the other.

---

## 3d. Geometry is not composition

The engine guarantees that nothing overlaps. It does not make a drawing good, and the first demo
proved the gap: zero collisions, zero warnings, and still a bad diagram.

Two faults, and only one of them was visual:

- **Five identical boxes in a row.** "Identical boxes for every node" is the first entry on the
  skill's §4 anti-pattern list, because it erases hierarchy — nothing tells the reader which box
  the drawing is about. Give each node the treatment its `type` earns (focal, load, plant,
  rejection, air), cap `accent` at one or two, and close with a legend naming every treatment
  used and none that is not.
- **A loop drawn as a line.** A cooling chain returns: hot out, cold back. One arrow per link says
  the water leaves and never comes home, which is not what the plant does. Two pipes per link —
  hot along the top, cold along the bottom with its arrowhead pointing the way the water actually
  travels — is both the drawing convention and the truth. `fanPoints(box, 2, side)` places the
  two ports.

Before drawing, also apply the deletion rule: the FWS pump station and the chiller plant always
travel together, so they are one node with the pumps as a sublabel. Six nodes became five.

---

## 3e. What the engine refuses to draw

Every guard below was added after the failure it prevents was found by RENDERING a figure,
not by reasoning about one. That is the pattern worth keeping: this engine fails silently,
and the only reliable detector has been a screenshot.

| Guard | What it caught |
|---|---|
| `colour-only` | Hot and cold streams separated by hue alone — lost in greyscale, in PDF export, and for a reader with colour-vision deficiency (WCAG 1.4.1). Found three more in the node treatments, where green and cyan were ISA **alarm** channels being used as categories. |
| `legend-indistinguishable` | Two legend entries drawn identically. Worse than a hue-only split: the legend offers two names for one swatch. Found three pairs in figures already shipped. |
| `legend-duplicate` | The same label on a node swatch and a line — one entry drawn twice, when it was the air handlers and the heat path. |
| `ports-crowded` | Five connectors on a 56-unit edge at 9-unit spacing. `fanPoints` had computed `crowded` from the start and nothing read it. **A computed warning nobody consumes is not a warning.** |
| `node-overflow` (height) | Height was trusted where width was checked, so `h:52` on a node needing 72 drew its sublabel across its own bottom border. |
| `unknown-option` | `sub` where `sublabel` was meant: the node quietly lost a line, nothing logged, nothing thrown. |
| `over-budget` | The tenth node. Miller's 7±2, which the skill fixes at nine. |
| figure too wide *(builder)* | 1,672 units renders 8-unit type under 6 px in an article column — below the 8.5 px floor this site enforces everywhere else. Wide is a legibility failure with a different name. |
| geometry self-audit *(builder)* | Compositions that overlap. The engine warns about what it was ASKED to do wrong; this catches what the composition did wrong. |

### Two rules that are not the same rule

**Spacing that satisfies rule 4 is not spacing that fits the content.** Three ports on a
128-unit edge sit 32 apart, which passes the 12-unit minimum, while the 72-unit nodes they
feed overlap by 40. Size the edge to what hangs off it.

**One blanket CSS rule produced two opposite failures.** `min-width:640px` on every figure
shrank the wide ones until their type vanished and stretched the narrow ones until they
shouted. Size bounds now travel with each figure, because they depend on its own viewBox:
`max-width` is the viewBox so it never upscales, `min-width` is the smaller of the viewBox
and 640 so a wide figure scrolls instead of shrinking.

---

## 4. Authoring rules

1. **New block diagrams go through the engine.** Do not add hand-typed coordinates.
2. **Treat `warnings` as failures.** `node-overflow`, `label-unplaced` and `transit` each
   mean the layout is wrong, not that the engine is fussy. Fix the layout.
3. **Derive spacing from content.** The demo's gap is computed from the widest arrow label.
   Picking a number by eye is what produced four unplaceable labels on the first run.
4. **Specification prose belongs in HTML cards, not in the SVG.** This predates the engine
   (`DATAHALL_AI_STANDARD.md`: *"Spec tables live in the HTML cards below the drawing"*) and
   still holds — the engine makes a dense drawing legible, it does not make it correct to
   put a spec table inside one.
5. **Every `bo(...)` that leaves a drawing must land in a card row.** The parameter registry
   counts rendered reads; R8 is STRICT.
6. **Fill in `title` and `desc`.** They are the accessible-figure contract, not decoration.

---

## 5. Verification

```bash
node tools/test-rz-diagram-engine.mjs         # 68 geometry assertions — SHIP GATE
node tools/test-diagram-engine-adoption.mjs   # adoption ratchet — SHIP GATE
node tools/demo-rz-diagram.mjs           # renders one real diagram, exits 1 on any collision
node tools/test-conv-geometry.mjs --page=<file>   # measures the rendered page
```

The engine test is mutation-checked: disabling the placement search, the router's obstacle
test, or the attach-point formula each turns three assertions red.

The **adoption ratchet** counts hand-authored geometry per cockpit file and fails when it
RISES. A falling count is the point, and asks for a re-record:

```bash
node tools/test-diagram-engine-adoption.mjs --baseline   # after a migration
```

A new cockpit file carrying any hand-authored geometry fails outright — a new diagram has
no excuse. Both failure paths were injected and observed.

---

## 6. Migration status

| Surface | State |
|---|---|
| Engine + gate | **shipped** v3.10.0 |
| `tools/demo-rz-diagram.mjs` — cooling chain | **drawn by the engine**, 30 boxes, 0 collisions |
| `datahallAI.html` — 21 measured drawings | **geometry CLEAN and STRICT** since v3.10.13 — 2,678 findings at entry → 0 |
| `dc-conventional.html` and the Track B cockpits | hand-typed coordinates; 462 across 9 files |
| Adoption ratchet | **shipped** v3.10.3 — baseline 3,114, may fall, never rise |
| Basis marks (every cockpit) | **measured** v3.10.2 — no longer `length × size × 0.6` |

### The gate is strict on this page

`MONITOR_PAGES` in `test-conv-geometry.mjs` is **empty**. Every page in `DIAGRAMS` gates.

`datahallAI.html` entered that gate in v1.135.0 carrying 2,678 findings, and was reported rather
than enforced on one written condition: *flip to strict once its rows read zero, and do not widen
the tolerance to get there.* They read zero, and the tolerances are unchanged from the day the page
arrived — 1.5 px overlap, 1.0 px clip, 8.5 px legibility floor. The sweep was paid, not the
threshold.

Keep that set empty. A page added to it is a page that stops being enforced.

### What the sweep actually taught

Twenty-seven distinct defects, and **not one was a crowded drawing**. Each was a coordinate that
was correct when it was typed and stopped being correct when something near it changed. The
recurring shapes, in the order they cost the most time:

1. **A helper drew a label the author never wrote.** `symNozzle()` emits its own `NZ` caption at
   `cy+20`; the BACnet bullet was drawn above its own circle. Neither is visible when reading the
   diagram code, because the diagram code does not mention them.
2. **A container outgrew its frame by one unit.** A pipe-rack frame ended at y=691 in a 690-tall
   viewBox. Its contents were fine.
3. **An element parked at the origin.** Flow dots with a *positive* `animateMotion begin` sit at
   `(0,0)` until their delay elapses, because `animateMotion` translates from the element's own
   position and they carry no `cx`/`cy`.
4. **A column that fit until the widest value arrived.** The chiller grid's value column met its
   longest label at `px+28` vs `px+29.4`.
5. **Moving one label onto another.** Raising the AHU caption off a room put it on the line above.
   This is why placement is a *search over the occupancy index*, not an offset: a nudge chosen by
   hand only knows about the collision it was asked to fix.

`getBBox` will not find any of these — it excludes stroke and ignores the transform
`animateMotion` applies, and it reported **zero** while the gate reported three. Use
`tools/probe-clipped-elements.mjs`, which asks the browser the same question the gate does and
then names the element.

---

**Correction (v3.10.7).** An earlier revision of this section claimed the geometry survey does
not reach the Track B cockpits, on the grounds that `TAB_SETS` names only `datahallAI.html`.
That was wrong, and the conclusion drawn from it was wrong too. `TAB_SETS` is the
*tab-activation* registry; `test-conv-geometry.mjs` keeps a separate `DIAGRAMS` list that
already covers `chiller-plant`, `fire-system`, `water-system`, `fuel-system`, `ict` and
`EPMS_Telemetry`. **Those pages are measured, and they measure clean** — the census found
defects only on `#bldgSvg`, `#coolSvg`, one floor plan, the data hall, the electrical overview
and the fire mimic.

The adoption ratchet still names every cockpit itself, for a narrower reason: it holds
surfaces the survey's list does not name (`all-in-one-dashboard`, `rz-cockpit-mockup`,
`js/ltc-system-modelling-lab.js`), and a drawing that is collision-free today says nothing
about the next hand-typed coordinate added to it.

Migration is per diagram, and each one is a separate ship with its own geometry
re-measurement. The isometric `#bldgSvg` is the largest single block and has its own plan;
its zone captions are the case the placement search was written for.

---

## Related

- `standarization/DATAHALL_AI_STANDARD.md` — spec tables live in cards, not in the SVG
- `standarization/ACCURACY_VALIDATION.md` — basis chips and denominators on every KPI
- `documentation/design.md` — the palette, the type pairing, the three stroke tiers
- `~/.diagram-design/profiles/resistancezero.md` — the active skin
