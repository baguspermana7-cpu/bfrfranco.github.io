# PRD-CONV-DATAHALL-SPACE: the data hall page gives its space to the data hall

Status: BUILT v3.83.0 (2026-11-21) · Owner comment R182 · Companion of PRD-CONV-DATAHALL-FLOOR (how the floor is DRAWN).
This PRD decides how much of the page the floor GETS, and where the text goes.

## 0. The owner's words

> "Datahall nya sangat kurang, too much text malah yg penting gak ada cukup space datahall itu sendiri, rancang prd."

Read as three claims, each checked below:
1. The data hall drawing is too small.
2. The page carries too much text.
3. The important thing (the hall) lacks room because the text takes it.

## 1. Measured state (datahall.html on conv-t23 = live v3.81.0 layout, 2026-11-21, dark, rendered)

Measured in a real browser (puppeteer, 3.5 s settle). Screenshots: `qa-tmp/dh-layout/dh-now-1440.png`,
`dh-now-390-full.png`.

| Measure | 1440 × 900 | 390 × 844 |
|---|---|---|
| Floor (`#zone-field`) box | 888 × 162 px | 352 × 220 px |
| Floor share of the first screen | **11.1 %** | **0 %** |
| Floor top edge (page y) | 498 px | **1571 px** (1.9 screens down) |
| One rack cell | **11 × 4 px** | 11 × 9 px |
| Rows visible without sideways scroll | 22 of 25 (W–Y cut off) | 8 of 25 |
| Visible words, whole page | 438 | 361 |
| Visible words, first screen | **325** | 122 |
| Page scroll height | 900 (fits, but the 3 columns scroll INSIDE a 474 px box) | 2030 |
| Text budget gate (`test-conv-text-budget.mjs`) | budget 400 words: passes, so the gate cannot see this complaint | — |

### 1a. Where the 900 px go at 1440

| Band | Height | What it holds |
|---|---|---|
| Cockpit shell | 48 | back, portfolio, title, PRD, Manual, Alarm history, CTA, login, clock |
| Sim banner | 45 | "Simulated telemetry — engine-derived basis" + × |
| Alarm strip | 43 | NORMAL, CRITICAL 0, WARNING 0, MAINT 1, COMMS OK, PAGE CLOCK, data quality, scenario |
| Explainer line | ~20 | "Simulated · conv-engine.js scenario; comms = the page read a valid …" (one sentence, 19 words) |
| Operations rollup | ~44 | Hall NORMAL, Rack Load, Cooling Margin, PUE, Power Density |
| Hall bar | 43 | "Data Hall A" + Hall A–D buttons |
| Balance band | ~120 | 6 KPI cells, 3 sub-lines each, one reads UNAVAILABLE by design |
| Mode bar + legend | ~50 | Plan / Air path, 5 modes, legend sentence "rack · °C row foot · kW · in · hot · min · max · avg" |
| **Floor** | **256** (162 for racks) | CRAH dots north, 25 rows, 6-number footer per row, CRAH dots south |
| Event log | 116 | 4 lines + "deterministic — bound to single scenario basis (conv-engine)" |
| Manual link | 67 | "Technical Manual & Methodology" |

The left column (Chiller Plant Feed, 13 rows + a formula line; CRAH Air-Side Status) and the right column
(Active Alarms, Environment 9 rows, Rack Density Basis 3 cells, Selected) take 2 × ~240 px of width for the full
height. Six status bands are stacked before the floor begins: 498 px of the 900 are chrome and summaries.

### 1b. Gaps

| ID | Gap | Evidence |
|---|---|---|
| S1 | The floor gets 11 % of the screen; a cabinet is 11 × 4 px, smaller than a text glyph. | table 1 |
| S2 | Six stacked bands before the floor: banner, alarm strip, explainer line, rollup, hall bar, balance band. The same facts repeat: hall state (strip + rollup), IT load (rollup "Rack Load 7.50 MW" + balance "7.500 MW"), PUE (rollup + balance sub-line), density (rollup + Rack Density Basis + balance "avg 16.20"). | 1a |
| S3 | Two full-height side columns of key-value text (22 rows) compete with the floor for width; the floor is squeezed to 888 px and loses rows W–Y. | screenshot 1440 |
| S4 | The column box scrolls inside itself (474 px); the floor, the Air path, the CRAH list sit in nested scroll areas. | `.main-grid` 474 px |
| S5 | Each of 25 rows prints 6 numbers under it (kW, in, hot, min, max, avg) = 150 numbers + 6 row labels; the floor PRD already moves 5 of them to tooltip/row panel. | FLOOR PRD §3.6 |
| S6 | Sentences sit on the page: explainer line (19 words), event-log heading (8), legend sentence, "planning reference only · site EPMS 30.000 MW ÷ 4 halls = 7.500 MW", "headroom 40 kW · 0.53 % · 58 × 130 kW". Owner taste: explanations live in tooltips. | screenshot |
| S7 | A KPI cell whose value is UNAVAILABLE by design ("Hall IT reconciliation") takes a sixth of the balance band. | screenshot |
| S8 | Phone: the floor starts 1571 px down, after the alarm strip (191 px), the explainer, the rollup (177 px), the hall bar, the two side panels and six KPI cells; the cookie banner then covers the side panels. | 390 screenshot |
| S9 | The text-budget gate allows 400 words on this page, so the gate passes a page the owner calls "too much text". The budget was set from the old redraw, not from the owner's standard. | `BUDGET['datahall.html'] = 400` |
| S10 | The event log (116 px) shows four boot lines that never change in a deterministic scenario, on every visit. | screenshot |

## 2. Principles

P1. **The hall is the page.** At rest the floor takes most of the screen; everything else is a frame around it.
P2. **Say each fact once.** One hall bar carries the hall state and the four numbers that size the hall; no number
    appears in two places at rest.
P3. **Explanation on demand** (owner 2026-11-12, 2026-11-14): sentences move into ⓘ tooltips, the basis drawer
    (`data-basis-param`, unchanged) and the inspector. A label is one or two words.
P4. **Context follows selection.** The side columns become ONE inspector that shows what is selected (rack, row,
    CRAH) and, with nothing selected, the hall chain (inlet → hot aisle → return → CHWS/CHWR) and active alarms.
P5. **No number is lost.** Every value the page shows today stays reachable within one click or one hover, keeps
    its element id and its `data-basis-param`, and keeps passing every gate that reads it (§5).
P6. **One screen on a desktop.** At 1440 × 900 the page does not scroll and nothing scrolls inside a box at rest
    except the inspector body.

## 3. Design

### 3.1 Desktop (≥ 1100 px), 1440 × 900

```
┌ shell 48 ─────────────────────────────────────────────────────────────────────────────────────────────┐
├ hall bar 44 ─ [A|B|C|D]  ● Normal  0 crit · 0 warn · 1 maint │ IT 7.50 MW · 75 % │ Cooling 7.50/7.54 MW N+1 ✓ │ PUE 1.45 │ ⓘ │ Events 4 ┤
├ stage head 36 ─ [Plan|Air path]  Temp · Power · Margin · Alarms · Space        legend: ■ ok ■ warn ■ alarm ┤
│                                                                              │ INSPECTOR 320            │
│   CRAH north gallery                                                         │ nothing selected:         │
│   ┌───────────────────── floor plan, 25 rows, oblique (FLOOR PRD) ────────┐  │  Hall chain               │
│   │                                                                        │  │  inlet 25.4 → hot 36.4    │
│   │                        ≥ 1060 × 620 px                                 │  │  → return 36.4 °C         │
│   │                                                                        │  │  CHWS 19.4 · CHWR 27.0    │
│   └────────────────────────────────────────────────────────────────────────┘  │  flow 943 L/s · 7/10 ch   │
│   CRAH south gallery            row kW under each row (one number)            │  Alarms (none)            │
│                                                                              │ rack selected: its card   │
└──────────────────────────────────────────────────────────────────────────────┴───────────────────────────┘
```

- **Hall bar (one 44 px line)** replaces: sim banner, alarm strip, explainer line, operations rollup, hall bar and
  the balance band. Content, left to right: hall selector; state word with glyph; alarm counts; IT load + utilisation;
  cooling demand / available + N+1 pill; PUE; ⓘ (simulated basis, data quality, scenario, comms, page clock, the
  reconciliation note); Events (count) opens the event log as a drawer. Each number keeps its old id
  (`dh-rack-load`, `dh-pue`, `bb-itload`, `bb-util`, `bb-cool`, `bb-np1` …) and its `data-basis-param`.
  The "SIMULATED" fact stays visible as one chip in the bar (accuracy rule 6: basis chip on every critical KPI).
- **Stage head (36 px)**: view toggle, mode segmented bar (FLOOR PRD §3.4 styling), legend as swatches only;
  the legend sentence becomes the legend's tooltip.
- **Stage**: the floor plan sized to the space left: width = viewport − inspector − 2 × 16 px gutter, height =
  viewport − shell − hall bar − stage head − 24 px. The FLOOR PRD projection picks its unit `u` to fit all 25 rows
  without sideways scroll at ≥ 1100 px. The six-number row footer becomes one number (row kW); the rest is in the
  row tooltip and the inspector (FLOOR PRD §3.6).
- **Inspector (320 px, right)**: replaces both side columns.
  - Nothing selected: Hall chain (the 13 Chiller Plant Feed rows rendered as one vertical chain of 8 numbers;
    the mixing terms and coil approach collapse under "assumptions" in the same panel), Environment as 4 rows
    (inlet, hot aisle, RH, dew point; min/avg/max ranges in each row's tooltip), CRAH summary (58 run · 1 stby,
    LA/RA), Active alarms (list or "None").
  - Rack, row or CRAH selected: its card (what `#sel-detail` shows today) on top; the hall chain stays below it.
  - The inspector body is the only element allowed to scroll inside a box at rest.
- **Air path view**: the existing air section takes the stage, not a strip under the floor.
- **Event log**: a drawer opened from "Events"; the four boot lines no longer sit on the page.
- **Manual link**: in the shell (it already has Manual); the 67 px footer link goes.

### 3.2 Tablet (601–1099 px)

Hall bar wraps to two lines at most. The inspector becomes a drawer (right) opened by a selection or the ⓘ;
the stage takes the full width.

### 3.3 Phone (≤ 600 px), 390 × 844

```
shell 48 · hall bar 2 lines (selector chips; state + IT + cooling + ⓘ) · mode chips (one scroll row)
floor plan (FLOOR PRD §3.5 scroller, u ≥ 7 px) starts ≤ 300 px from the top
row picker A…Y · then tap = inspector as bottom sheet (RZSheet)
```

The side panels, the six KPI cells and the event log do not sit above the floor. They are in the inspector sheet
and the ⓘ.

### 3.4 What moves where (nothing is deleted)

| Today | Goes to |
|---|---|
| Sim banner + explainer sentence + data quality + scenario + comms + page clock | hall bar chip "Simulated" + ⓘ tooltip |
| Alarm strip counts | hall bar |
| Operations rollup (Rack Load, Cooling Margin, PUE, Power Density) | hall bar (IT, cooling margin as part of cooling, PUE); power density → tooltip on IT |
| Balance band (6 cells, 18 lines) | hall bar numbers; sub-lines → each number's tooltip / basis drawer; reconciliation cell → ⓘ |
| Chiller Plant Feed (13 rows + formula) | inspector "Hall chain" |
| CRAH Air-Side Status list | inspector CRAH summary; the full list under "CRAH units" in the inspector |
| Environment (9 rows) | inspector 4 rows + tooltips |
| Rack Density Basis (3 cells) | tooltip on the IT number + basis drawer |
| Selected | inspector top card |
| Event log | Events drawer |
| Row footer 6 numbers × 25 | 1 number × 25 + tooltip + inspector (FLOOR PRD) |

## 4. Scope

In: `datahall.html` markup and CSS for the bars and columns, the inspector, the Events drawer, the text-budget
entry for datahall, this page's gate. The shell (`js/conv/shell.js`) stays as it is.
Out: the floor drawing itself (PRD-CONV-DATAHALL-FLOOR, module `js/conv/floor-plan.js`), engine numbers, other
cockpits (a later PRD can apply the same hall-bar pattern to them once this one is proven).

Order with the floor PRD: FP1 (module) runs now; this PRD's SP1–SP2 (bars + inspector) land with FP2, so the floor
module is integrated into the new stage size once, not resized twice.

## 5. Gates that read today's elements (kept green, ids kept)

Every id below stays in the DOM with the same text; a gate that needs it visible opens the inspector or the drawer
first (selector-only edits allowed, never a loosened assertion):
`alarmStrip` (5 gates), `alarm-list` (5), `dh-rack-load` (4), `chws`/`chwr` (4), `dh-pd` (3), `env-dewpoint` (3),
`bb-util`, `bb-balance`, `bb-balsub`, `env-temp`, `dh-pue`, `sel-detail` (2 each), and one gate each for `ch-count`,
`th-*`, `chdt`, `chflow`, `f-flow`, `crah-list`, `crah-air-note`, `bb-*`, `env-*`, `density-*`.
Gates: `test-operator-cockpit-regressions`, `test-ict-datahall-operator-runtime`, `test-datahall-authority`,
`test-conv-datahall-air`, `probe-accuracy-validation`, `test-conv-snapshot-binding`, `test-conv-point-coverage`,
`test-conv-text-budget`, `test-conv-shell`, `test-conv-alarm-runtime`, the basis-drawer gates; the full set via
`tools/run-conv-release-gates.sh`. The three `data-rz-distribution` hosts stay (their sums are still checked).

## 6. Laws (gate `tools/test-conv-datahall-space.mjs`, rendered, authorized audit state, each red on today's tree)

| Law | Claim | Today |
|---|---|---|
| SP1 | Floor plan box ≥ 55 % of the viewport area at 1440 × 900 and ≥ 45 % at 1280 × 800. | 11.1 % |
| SP2 | All 25 rows inside the stage without sideways scroll at ≥ 1100 px; one cabinet top face ≥ 12 × 9 px at 1440. | 22 rows, 11 × 4 |
| SP3 | Floor top ≤ 150 px from the page top at 1440; ≤ 300 px at 390. | 498 / 1571 |
| SP4 | Visible words in the first screen ≤ 90 at 1440 and ≤ 50 at 390 (svg text, tooltips, drawers excluded); `test-conv-text-budget` datahall budget lowered 400 → 120. | 325 / 122 |
| SP5 | No sentence (≥ 8 words in one element's own text) visible at rest. | 6 |
| SP6 | Each number appears once at rest: no two visible elements show the same value+unit for hall IT, PUE, cooling, density, hall state. | 4 duplicates |
| SP7 | At 1440 × 900 the document does not scroll (scrollHeight ≤ innerHeight + 1) and no element except the inspector body scrolls inside a box at rest. | 474 px nested box |
| SP8 | No number lost: every id in §5 exists, its text equals the value before the change (captured from the old tree into a fixture), and each is reachable by one hover or one click (gate performs it). | — |
| SP9 | Selection: clicking a rack fills the inspector card within 300 ms; Escape clears it back to the hall chain. | — |
| SP10 | 0 page errors; 1440 dark + light, 1280, 768, 390 dark + light screenshots written and looked at; axe 0 serious. | — |

Red before green: SP1–SP7 fail on today's tree with the numbers in the "Today" column; the gate is run on the old
tree first and that output is quoted in the release notes.

## 7. Phases

| Phase | Work | Proof |
|---|---|---|
| SP-0 | Gate written, run red on today's tree; fixture of today's values per id (SP8). | red output |
| SP-1 | Hall bar replaces the six bands; ⓘ and Events drawer; ids moved. | SP3, SP4 (bar part), SP6, SP8 |
| SP-2 | Inspector replaces both columns; nothing-selected state; selection card. | SP5, SP7, SP9 |
| SP-3 | Stage sizing + FLOOR PRD FP2 integration (unit fits 25 rows). | SP1, SP2 |
| SP-4 | Phone + tablet; text budget 120; full conv release gates; screenshots. | SP3 (390), SP10, release gates |

## 8. Risks

- **Gates reading hidden elements.** Some gates may assert visibility of today's panels; they get selector-only edits
  that open the inspector first. A gate assertion is never loosened.
- **Accuracy rule 6 (basis chip on every critical KPI).** Kept: the hall-bar numbers keep `data-basis-param` and the
  "Simulated" chip stays visible.
- **The floor PRD's unit.** If the 25-row fit gives u below the legible minimum at 1100 px, the stage scrolls by
  5-row snaps there (FLOOR PRD §3.5) and SP2 applies from 1280 px.
- **Parallel sessions.** `datahall.html` is shared with the T3-c agent (points). This PRD's edits start after t3-c
  merges, on the same branch as FP2.

## 9. Open decision (default taken unless the owner says otherwise)

- OD-S1: the inspector sits on the RIGHT (default; the alarm column was there) or the LEFT (where the plant feed was).
