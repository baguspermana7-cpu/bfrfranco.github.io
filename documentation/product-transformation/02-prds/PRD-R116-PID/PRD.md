# PRD-R116-PID — P&ID with the flow explained (RZPid)

## 1. Document control

| Field | Value |
|---|---|
| Id | PRD-R116-PID |
| Version | 1.0 (2026-11-11) |
| Owner request | R116 "P&ID tiru gini … tiru persis kemudian cari gap dan sempurnakan secara visual, effect, accuracy"; "Pakai utk article2 … intuitive, alurnya jelas, accurate, animasi yg smooth"; R117 "Continue. Go ahead. Sempurnakan konsep. Improve code" (mock approved) |
| Reference | github.com/ScottDuncanAI/PID-to-Knowledge-Graph (MIT) — schema v1.0, graph ontology, ISA-5.1 loop inference |
| Plan | documentation/product-transformation/R116_PID_FLOW_PLAN.md |
| Status | APPROVED direction (mock 2e54eed87); implementation in progress |

## 2. Executive summary

A reader of an RZ article sees a P&ID and, beside it, the flow explained step by step. The drawing and the steps
come from one graph (the reference's extraction schema and ontology, ported to ES5). Picking a step lights its
path; a symbol jumps to its step; a tag explains itself through RZExplain. Numbers on the drawing are checked by a
mass/energy balance; anything the source does not show or contradicts is marked, never guessed.

## 3. Problem statement

- Articles and cockpits draw P&IDs as hand-typed SVG with no explanation of the flow; a reader who does not read
  ISA-5.1 sees boxes and circles.
- The reference produces a correct graph and a Markdown summary but no drawing, no link between text and symbol,
  no motion, and no numeric check.
- The source page for the first plant (cdu-mini-bms.html) contradicts itself twice: TCV setpoint 18 °C vs in-row
  supply 32 °C, and 1.30 LPM/kW × 300 kW × 11 K PG25 = ≈276 kW, not 300 kW.

## 4. Objectives and success metrics

| Objective | Metric (checked by) |
|---|---|
| Faithful port | reference fixture pages normalise and yield the same loops/edges (test-rz-pid.mjs, fixture `pid-mini-plant`) |
| Clear flow | every step lights a non-empty path; every symbol maps to ≥ 1 step (gate) |
| Accurate | balance within 3 % or a marked discrepancy (gate law B1) |
| Smooth | 0 long tasks > 50 ms during a step change at 390 px; motion on tokens, reduced-motion static (gate) |
| Readable on a phone | scrollWidth ≤ 390; label ≥ 11 px rendered; active path inside the visible drawing (gate) |

## 5. Scope

In: `js/rz-pid-graph.js`, `js/rz-pid-render.js`, plant data under `data/pid/`, one plant generator per plant,
RZExplain entries for ISA-5.1, rollout to article pages and cdu-mini-bms. Out: PDF/vision extraction from images
(the reference's Claude-skill step) — plants are authored as schema JSON by a generator from a cited source page.

## 6. User personas and use cases

- Reader of an article (engineer or student): follows the coolant from heat exchanger to rack and back.
- Operator studying a cockpit: finds which instrument controls which valve.
- Incident-library reader: sees where in the loop a failure chain starts.

## 7. Complete user journey

Land on the figure → first step active (source of the flow) → Next / click a step → path lights, motion runs along
it in flow direction → click a valve → list scrolls to its step → hover/tap/focus a tag → RZExplain panel decodes it
→ open "marked, not guessed" → read each discrepancy with both quoted values and the arithmetic.

## 8. Functional requirements

- FR-1 Normalise schema v1.0 pages (tags, labels, confidence, bbox) as the reference does.
- FR-2 Build graph: FLOWS_TO, FEEDS, MEASURES, SIGNAL_TO, ACTUATES, MEMBER_OF, CASCADES_TO, TRIPS, PART_OF.
- FR-3 Infer loops by ISA-5.1 key; type control/interlock/cascade; order loops by flow position of the measured point.
- FR-4 `explain()` returns three parts: process flow, measurement, control loops; one step = one path.
- FR-5 `balance()` recomputes Q = V·ρ·cp·ΔT/60 with properties from `CDU_ENGINE`; mismatch > 3 % must be a
  marked discrepancy in the data.
- FR-6 Render: ISA bubbles, line types (process, signal, software), confidence < 0.7 dashed; legend; step list.
- FR-7 Tags carry `data-explain` and are focusable; content from the RZExplain DB.
- FR-8 Phone ≤ 600 px: one column, drawing fits width or crops to the active path; no sideways pan.
- FR-9 Attribution: MIT notice in the graph module header and in the figure footer.

## 9. UI/UX specification

Register: graphite panel, 1 px hairline, radius ≤ 4 px, ONE amber accent for the active path, IBM Plex Sans text,
mono for tags and values. No tiles, pills, gradients, glow. Step list: numbered rows, active row = amber number +
hairline. Discrepancy panel: plain rows "Source says A · source also says B · arithmetic".

## 10. Data model

`data/pid/<plant>.json`: `{about, plant{id,name}, sources{key:{file,ref}}, pages[ schema v1.0 ], layout{viewBox,
anchors, routes}}`. Every value names `attributes.src`. Discrepancies: `attributes.discrepancy` with both values,
both sources, and (for balance) the inputs.

## 11. API and integration contracts

`window.RZPid` (browser) / `module.exports` (Node): `normalize`, `buildGraph`, `explain`, `decodeTag`, `balance`,
`render(opts)` → `{select(stepId), destroy()}`. Load order: `cdu-engine.js` (when balance is shown),
`rz-explain-db.js`, `rz-explain.js`, `rz-pid-graph.js`, `rz-pid-render.js`, all defer.

## 12. Business rules and state machines

- Never guess: absent direction/value → confidence < 0.7, dashed, listed.
- Step state: idle → active(step) → active(next); reduced-motion: no travelling dash, static highlight.
- Balance: |Q_calc − Q_declared| / Q_declared ≤ 3 % → OK; else marked discrepancy required, gate fails if unmarked.

## 13. Cross-module integration

RZExplain (decode), CDU engine (fluid properties), RZDiagram conventions (no hand geometry in new figures beyond
the plant's own layout block), incident library (failure chain can reference a P&ID node id), provenance (figure
carries a Model/Snapshot line where it shows numbers).

## 14. AI and automation requirements

None at runtime. Authoring: a generator per plant; a future extraction from PDF stays out of scope until the owner
asks.

## 15. Non-functional requirements

ES5, no build, each file ≤ 800 lines; first render < 100 ms for 100 nodes on a mid phone (headless 4× CPU throttle);
no layout thrash on step change (transform/opacity/stroke-dashoffset only).

## 16. Security and access control

Static data only; text inserted with `textContent`; no `innerHTML` from data; public pages, no tier gate.

## 17. Edge cases and failure scenarios

Missing anchor → node placed from bbox, warning in `render().warnings`; unknown tag grammar → decoded as "not an
ISA-5.1 tag", still drawn; loop without final element → "indication only"; JSON fails to load → figure shows a plain
error line, not an empty frame.

## 18. Technical architecture

`rz-pid-graph.js` (pure model, Node-testable) → `rz-pid-render.js` (SVG, events, motion) → page markup
`<figure data-rz-pid="data/pid/x.json">`. Generator `tools/gen-pid-<plant>.py` → JSON (byte-identical rebuild).

## 19. Implementation breakdown

T-1 split + refactor (R117). T-2 balance + discrepancy. T-3 RZExplain decode. T-4 flow-ordered loops. T-5 phone
one-column. T-6 standards doc `standarization/PID_FIGURE_STANDARD.md`. T-7 first article placement (CDU article) +
cdu-mini-bms link. T-8 second plant (chilled-water) via generator. T-9 wire gate in ship-gate.sh. T-10 release.

## 20. Test strategy

`tools/test-rz-pid.mjs`: unit (normalise, loops vs reference fixture, decode, balance, loop order), mutation (an
unmarked mismatch must fail), render in a real browser at 390/1440 both themes (paths, overflow, label size,
reduced-motion, 0 page errors), generator freshness. Screenshots looked at before each push.

## 21. Acceptance criteria

AC1 gate green with each law proven red first. AC2 both discrepancies visible on the page with arithmetic. AC3 tag
focus opens RZExplain. AC4 390 px: no pan, every step's path visible. AC5 files ≤ 800 lines. AC6 placed on ≥ 1 live
article after the owner sees screenshots.

## 22. Rollout and migration

Mock page stays noindex. Then: CDU article figure → cdu-mini-bms "Read the P&ID" link → incident library → manuals.
Each placement: cache tokens, screenshots, live check.

## 23. Risks and dependencies

Source pages contradict themselves (handled by marking). RZExplain API may not accept dynamic text (fallback: a
generic ISA entry + per-letter entries). Peer-owned files are not touched.

## 24. Definition of done

All ACs met with quoted gate output; standards doc and CHANGELOG in the same release; owner sees live screenshots.
