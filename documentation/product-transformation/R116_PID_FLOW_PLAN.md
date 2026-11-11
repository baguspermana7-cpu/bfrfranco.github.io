# R116 — P&ID with flow explanation (plan, 2026-11-11)

Owner: "P&ID tiru gini. Jadi ada p&id kemudian penjelasan flownya ada. Tiru persis kemudian cari gap dan
sempurnakan secara visual, effect, accuracy dll." + "Pakai utk article2 atau apa lah di rz. Bener2 intuitive alurnya
jelas, accurate animasi yg smooth."

## What the reference is (read 2026-11-11)

`github.com/ScottDuncanAI/PID-to-Knowledge-Graph` (MIT, 201 stars, Python). A Claude skill: P&ID PDF → per-sheet
extraction JSON (equipment, lines, valves, instruments, signal lines, off-page connectors, each with a bbox and a
confidence) → typed property graph → `summary.md` (process flow, measurement, control loops) + `qa_report.md`.

- Edges: `FLOWS_TO`, derived `FEEDS` (equipment-level flow, pipes collapsed), `MEASURES`, `SIGNAL_TO`, derived
  `ACTUATES`, `MEMBER_OF` (role sensor/controller/relay/final_element), `CASCADES_TO`, `TRIPS`, `PART_OF`.
- Loops by ISA-5.1 key (first letter + number, FT-101/FIC-101/FV-101 → F-101), refined by tracing controller outputs
  through relays (I/P) to the final element; a controller→controller signal is a cascade; `purpose: trip` makes an
  interlock.
- Unreadable items are marked, never guessed; QA lists what could not be confirmed.

`github.com/jonathanwvd/awesome-industrial-datasets`: catalogue of ~600 public industrial datasets (JSON per
dataset). Use: pick processes whose P&ID and data are both public (e.g. Tennessee Eastman, BATADAL water network,
DAMADICS actuator benchmark) so a figure can be checked against data.

## What we copy exactly

The data model and the reasoning: the extraction schema v1.0 and the graph ontology above, the ISA-5.1 loop
inference rules, the "never guess, mark it" rule, and the three-part explanation (flow, measurement, control).
Ported to JS (`js/rz-pid.js`), MIT attribution in the file header.

## Gaps in the reference, and what RZ adds

| Gap in the reference | RZ version |
|---|---|
| No drawing: the output is JSON, DuckDB and Markdown | The P&ID is drawn from the graph through the RZ diagram engine (ISA-5.1 bubbles, line types: process, pneumatic, electrical, software) |
| Explanation is a separate text file | Explanation is a step list beside the drawing; each step lights its path on the drawing, and clicking a symbol jumps to its step |
| No motion | Flow runs along `FLOWS_TO` in flow direction (dash offset, transform/opacity only, `--rz-ease-*`/`--rz-dur-*`), signal pulses along `SIGNAL_TO` for a loop walk-through; reduced-motion = static highlight |
| Loops are a table | A loop walk-through: sensor → controller → relay → final element → effect on the process, one step each |
| Tags are opaque to a reader | Hover/tap any tag: ISA-5.1 decode (FIC = Flow Indicating Controller) via RZExplain |
| Confidence lives in JSON | Inferred directions and low-confidence items are drawn dashed and listed under the figure |
| Accuracy unchecked against numbers | Each plant carries sourced operating values; a gate recomputes mass/energy balance on the graph and fails on a mismatch |

## Where it goes

Articles (CDU secondary loop, chilled-water plant, fuel day-tank transfer, fire pre-action), cdu-mini-bms, the
incident library (failure chain on the real P&ID), manuals.

## Order

1. Mock: one plant (CDU secondary loop, values from the existing CDU engine/data), drawing + step list + motion, both
   themes, 1440/390; screenshots to the owner; stop for the verdict.
2. After approval: PRD (24 sections), `js/rz-pid.js` + gate (graph rules unit-tested against the reference's own test
   fixtures, render gate, motion gate), then rollout page by page.
