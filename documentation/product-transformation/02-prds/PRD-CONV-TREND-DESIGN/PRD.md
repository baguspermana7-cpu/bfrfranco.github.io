# PRD-CONV-TREND-DESIGN — the trend modal reads like an instrument, not a template

Status: BUILT 2026-11-21 on conv-t23 (rz-trend 3.0.0). Owner approved execution with the floor-plan comment ("Sempurnakan lalu execute"); OD-T1 = ink default. Gate `tools/test-conv-trend-ranges.mjs` 328 checks incl. D1–D13, red first (29 failures on 2.2.0). Deviation: three compare slots cannot pass the validator without a state or banned hue, so compare is capped at two pens (`MAX_PENS = 3`), see §3.1 note in `js/rz-trend.js`.
Parent: PRD-CONV-POINT-STATUS-TREND (T1/T1b built the modal; this PRD replaces its visual design).
Scope: `js/rz-trend.js` (panel, plot, header, stats, phone sheet), `css/conv-point.css` (state tokens only). The modal
is used by all nine Conventional cockpits and by the fixture. `datahallAI.html` (peer) has not adopted it yet.

## 0. The owner's words

2026-11-21: "Warna chart sangat ai design slop dan uiuxnya, design prdnya. Find a gap."

The owner judged the rendered modal: the colours and the UI/UX. Section 1 lists what makes it read as a template,
measured on the current tree (`conv-t23` 671323456, gate screenshots `test-conv-trend-ranges --shots`). Each gap
has an id that a law in §5 closes.

## 1. Gaps (measured)

### 1a. Colour

| id | gap | evidence |
|---|---|---|
| G1 | **The compare pens are GitHub Primer's dark palette** (`#56c2f5 #e8b563 #3fb950 #f0883e #d2a8ff #ff7b9c #8b93a1 #79c0ff`). This is a palette any template would ship. It has a violet (`#d2a8ff`) and a pink: hues this site's register rejects (ANTI_VIBECODE §A15, CLAUDE.md rejected pattern 3). It was never run through a CVD validator. | `js/rz-trend.js:47`, 22 hex literals in one file |
| G2 | **The main pen is cyan `#56c2f5`.** No other element on the cockpits is this blue, so the trend brings in a second accent hue (rejected pattern 12). | 7D/1D dark screenshots |
| G3 | **Status colours are reused as series colours.** Pen 2 is `#e8b563`, the warn colour, and pen 3 is `#3fb950`, the ok colour. A compared point drawn in amber reads as "in warning". | `PEN[1]`, `PEN[2]` vs `--rz-pt-warn` / `--rz-pt-ok` |
| G4 | **Full-width colour washes behind the plot.** Red at 9 % above HH and below LL, amber at 9 % between H and HH, green at 6 % across the whole normal range. The plot is a striped flag. In light mode the green wash turns muddy grey-green and the red washes turn pink. The owner already rejected "wash" fills on cards (UX law 14). | `.band-*` fill-opacity .06/.09/.09 |
| G5 | **Text wears status colour.** The limit labels `HH 40.0` and `LL 15.0` are painted red, and `H 37.0` and `L 18.0` amber. Four coloured words sit at the right edge even when nothing is wrong. | `.llab.warn/.alarm` |
| G6 | **Four coloured dashed limit lines and dashed grey reference lines.** Dashes read as "projection"; together with the washes there are 7 horizontal decorations before the data. | 3 `stroke-dasharray` rules |
| G7 | **The pen does not show WHEN the point was abnormal.** In the 1D fixture the point is in warning 66 % of the window, but the line stays one cyan from end to end. The reader has to compare a 1.5 px line against a dashed line. This is the one question a trend must answer. | 1D screenshots, stats "IN WARNING 66.3 %" |

### 1b. Layout and reading

| id | gap | evidence |
|---|---|---|
| G8 | **The y-axis wastes 80 % of the plot.** The axis spans 13–42 so that every limit fits, and the data (36–39 °C) is pressed into the top strip. The ticks `34.8 · 27.5 · 20.3` are not round numbers. | 1D/7D screenshots |
| G9 | **A stat-tile strip.** Six boxed cells with tracked uppercase labels (MIN · MAX · MEAN · IN WARNING · IN ALARM · EXCURSIONS). The owner rejected stat-tile strips (rejected pattern 14) and tracked mono-uppercase chrome (pattern 13). | `.rz-trend-stats`, 2 `text-transform:uppercase` |
| G10 | **Too much visible text.** The header has two chips (`SIMULATED`, `Limits ASSUMED`). The footer has a 25-word sentence. The read line says "Hover or drag to read". The owner wants values plus one word, with explanations in tooltips (2026-11-12). | header, `.rz-trend-note`, `.rz-trend-read` |
| G11 | **The footer contradicts the source.** With the database as the source, the footer still says "SIMULATED history: a deterministic training series … no historian is read". It also mentions "dashed grey is the engine reference" on charts that have no reference line. | DB 7D screenshot |
| G12 | **A false step at the database seam.** The database series ends at its last 30-minute bucket. The renderer then joins the live page value with a solid line, which draws a vertical cliff (31 → 37.4 °C) that never happened. | DB 7D screenshot, right edge |
| G13 | **No "now" on the line.** The current value is not marked at the right end, so the eye cannot connect the big number in the header with the line. | all screenshots |
| G14 | **Vertical day gridlines plus horizontal gridlines** cross the washes and form a lattice. | 7D screenshots |
| G15 | **Jargon on the user surface.** The tag reads `Database (simulated, pg_cron)`, and `pg_cron` means nothing to an operator. | DB screenshot |
| G16 | **Phone header wraps.** The value, state, chip and Close button take three lines, and `Limits ASSUMED` sits alone on a line. | 390 screenshot |

## 2. Reference: what an operator trend looks like

- ISA-101 / High-Performance HMI trends: a neutral pen on a quiet panel, and the normal operating range shown as one
  light neutral band. Colour appears only where the process is abnormal. Limits are thin lines, labelled small, with
  no colour in the text.
- The data-viz method (the `dataviz` skill): one axis; recessive solid hairline grid; text in ink, never in a series
  or status colour; status colours reserved and never reused for a series; a categorical order validated by
  `validate_palette.js` for CVD separation in both modes; selective direct labels (the endpoint); a hover crosshair
  and tooltip by default; a table view.
- The site register (CLAUDE.md "Canonical patterns"): graphite surfaces, ONE accent (signal amber), Plex Sans for
  words, mono only for numbers, 1 px hairlines, radius ≤ 4 px.

## 3. Design

### 3.1 Colour: three inks, state colour only on abnormal data

| element | dark | light | rule |
|---|---|---|---|
| panel | `#121316` | `#ffffff` | unchanged |
| plot surface | `#121316` (no separate box) | `#ffffff` | the plot loses its own bordered box; one hairline baseline |
| normal operating band (L…H) | ink at 5 % | ink at 4 % | ONE neutral band, no hue; outside it nothing |
| grid | horizontal only, solid hairline, ink 7 % | ink 8 % | no vertical gridlines; day ticks are axis ticks only |
| limit lines H / L | solid 1 px, ink 35 % | ink 40 % | no dash, no hue |
| limit lines HH / LL | solid 1 px, ink 55 % | ink 60 % | stronger than H/L, still no hue |
| limit labels | muted ink, small, right edge: `H 37`, `HH 40` | same | text never wears a status colour (closes G5) |
| main pen, normal segments | ink `#e8edf5`, 2 px | `#1b2430`, 2 px | the data is the darkest thing on the plot (G2) |
| main pen, segments beyond H/L | `--rz-pt-warn` 2 px | same token | state over time (G7) |
| main pen, segments beyond HH/LL | `--rz-pt-alarm` 2.5 px | same token | |
| state ribbon | a 4 px strip under the plot, one segment per run of samples, coloured ok/warn/alarm; ok is ink 12 %, not green | same | answers "when" at a glance; hover gives start, end and duration |
| now marker | 6 px dot in the pen's current state colour, 2 px surface ring, value label beside it in ink | same | closes G13 |
| compare pens 2–4 | slots from a validated categorical order that has **no amber, no green, no red, no violet, no pink**; run through `validate_palette.js` in both modes (ΔE ≥ 8 adjacent under CVD) and dashed-free | — | closes G1, G3; candidates: steel blue, teal-grey, sand — final hexes are what the validator passes |
| min/max envelope (DB buckets) | the pen's own colour at 14 % | 12 % | unchanged idea, quieter |

Owner decision **OD-T1** (default in bold): the normal pen is **neutral ink** (ISA-101), or green. Green on the
numbers stays (OD-1 of the parent PRD); on a line, a green that covers 100 % of a normal day is a wash in another form.

### 3.2 Axis

- The y-range fits the data with 10 % padding. A limit is included only if it lies within 25 % of the data span
  from the data. A limit outside the view is shown as an edge marker at the top or bottom: `HH 40 ↑` in muted ink.
  This closes G8.
- Ticks use "nice numbers" (1, 2, 2.5, 5 × 10ⁿ): `36 · 37 · 38 · 39`, never `34.8`.
- One axis only. A compared point with another unit gets its own small-multiple strip under the main plot, never
  a second y-scale. Today, two units share the plot with a left and a right scale; that is a dual axis.

### 3.3 Header (one line on desktop, two on a phone)

`TCS supply · TT-01` (name in ink, tag in muted ink) · `37.4 °C` (mono, state colour on the number as on the page) ·
`▲ Warning` (state word with glyph) · `ⓘ`

- The `ⓘ` tooltip holds everything that is not a reading: source (`Database, 5-min samples` / `Local model,
  database unreachable` / `Simulated`), limits basis (`Limits assumed — owner can replace`), the time zone, and
  the reference line when there is one. This closes G10, G11 and G15. `pg_cron` stays in the runbook.
- The two header chips and the footer note are removed.
- On a phone, line 1 is the name plus Close (44 px); line 2 is value, state and ⓘ. This closes G16.

### 3.4 Under the plot: one stats line, not tiles

`min 36.2 · max 38.7 · mean 37.4 · warning 66 % · alarm 0 % · 2 excursions`

The line is in Plex Sans muted, with the numbers in mono ink. There are no boxes and no uppercase. It wraps on a
phone. This closes G9.

### 3.5 Interaction

- Hover or drag shows a crosshair and a floating tooltip near the cursor: local time, value, and state word. The
  "Hover or drag to read" line is removed (G10).
- Ranges `1H 8H 1D 7D 30D` stay; the active range keeps its amber underline (the one accent).
- `+ Compare…` becomes a quiet text button that opens the list. `Export CSV` moves to the same row as a text button.
- `View as table` (text button) toggles the existing table (accessibility; the method's table view).

### 3.6 Truth at the seam (G12)

- When the database series ends before now, the gap from the last bucket to now is drawn as a dotted pen segment in
  muted ink, and the tooltip on it says "no samples since HH:MM". The last point is the page value as before, but
  it is never joined with a solid line across a gap longer than two sample steps.
- In the local model the series runs up to now, so this does not apply.

## 4. What does not change

- Ranges, keyboard keys 1–5, phone sheet at 88 %, focus trap, Esc, the database provider, fallback rules, the local
  time axis (OD-8), stats maths, CSV content.
- Point colours on the pages (`css/conv-point.css` OD-1) are not in scope.

## 5. Laws (each red on today's tree before it is trusted)

Gate: a new block in `tools/test-conv-trend-ranges.mjs` (or a new `tools/test-conv-trend-design.mjs`) that reads
COMPUTED styles and SVG attributes in a real browser, at 1440 dark, 1440 light and 390 dark, for 1D local and
7D database.

| law | claim | red today |
|---|---|---|
| D1 | Every painted colour in the panel is one of: ink, muted ink, grid, the amber accent (range underline, focus), a state token (`--rz-pt-*`), or a validated compare slot. 0 other hues. | cyan pen, Primer violet/pink |
| D2 | No text node in the panel has a fill or colour equal to a state token, except the state word and the header value. | 4 limit labels |
| D3 | No band or wash: every plot rect/path with a fill has opacity ≤ 0.06 and no hue (chroma < 0.02 OKLCH), except the min/max envelope and the ribbon. | red/amber/green washes |
| D4 | No dashed stroke in the plot except the seam segment. | 3 dash rules |
| D5 | Every main-pen segment whose samples are outside H/L carries the warn token, and outside HH/LL the alarm token. Normal segments carry ink. Checked against the samples the gate itself feeds. | one cyan polyline |
| D6 | The y-range covers ≤ 1.6 × the data span (plus edge markers for limits outside), and every y-tick label is a nice number. | 13–42 for 36–39; `34.8` |
| D7 | No uppercase-transformed text and no boxed stat cells in the panel. The stats line exists and its numbers equal today's stats. | 6 tiles, 2 uppercase rules |
| D8 | Visible text in the panel, outside the plot, is ≤ 30 words at 1D. The ⓘ tooltip holds the source and the limits basis, and it matches the actual source (database vs local vs simulated). | header chips + 25-word footer + read line; footer says SIMULATED on DB |
| D9 | No vertical pen jump at the DB seam: a gap > 2 steps is drawn as a dashed muted segment. | 31 → 37.4 cliff |
| D10 | Compare slots pass `validate_palette.js` in light and dark (no FAIL), and none is within ΔE 15 of a state token. | Primer palette not validated; pen 2 = warn |
| D11 | The now marker exists at the last sample, in the current state colour. | none |
| D12 | Phone 390: the header is ≤ 2 lines, there is no sideways scroll, and every control is ≥ 44 px. | 3 lines |
| D13 | Existing laws L1–L12 and D1–D5 (database) still pass. | — |

Then screenshots at 1440 dark/light and 390 for 1D, 7D DB and the compare view. Each one is looked at, and the
before/after pairs go to the owner.

## 6. Phases

| phase | content | release |
|---|---|---|
| TD0 | This PRD, plus a static mockup (before/after, both themes, 1440 + 390) for the owner | none |
| TD1 | Colour and marks: §3.1, §3.2, the now marker, the seam; laws D1–D6, D9–D11 | MINOR, with T3 |
| TD2 | Header, ⓘ tooltip, stats line, interaction, phone header; laws D7, D8, D12 | same release |
| TD3 | Standards: CONVENTIONAL_DC_OPERATIONS_STANDARD § point status (trend design rules), UIUX ledger row, CLAUDE.md shared-module row (`rz-trend.js` 3.0.0) | same release |

## 7. Risks

- **The fixture series is not the plant.** The laws feed their own samples, so D5 and D6 do not depend on the
  model.
- **The peer's DC AI page will adopt this modal later.** The API does not change; only the look does.
- **The compare slots might not pass the validator on the graphite surface without a hue the register rejects.**
  If so, compare pens fall back to ink with distinct dash-free widths and direct end labels, and no third hue
  enters.
