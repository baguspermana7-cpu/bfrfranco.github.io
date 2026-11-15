# PRD-CONV-REDRAW — Conventional cockpits: the drawing first, the words behind it

## 1. Document control
| Field | Value |
|---|---|
| Id | PRD-CONV-REDRAW |
| Version | 1.0 (2026-11-14) |
| Owner requests (verbatim) | chiller-plant: "parah sih ini super jelek tampilannya"; fire-system: "tampilan, icon, block, p&id sangat tidak akurat melenceng2 dan tidak standard, animasinya tidak ada, dan terlalu ai design slop"; fuel-system and water-system: "sudah meet 60% dari ekspektasi saya, tapi masih banyak yang perlu di polish … terlalu banyak tulisan dan ai design slop, ingat pakai tooltip, traceable dan modal. jangan semua tulisan ada disini"; ict and datahall: the same sentence. Split (R133): datahallAI.html = LTC session, datahall.html + the Conventional family = this session. |
| Pages | datahall.html, chiller-plant.html, fire-system.html, fuel-system.html, water-system.html, ict.html |
| Aligned with | LTC's datahallAI redraw (R128–R132: real P&ID symbols, no gradient, proper flow, unclear words removed, sidebar pin/auto-hide, top BMS UIs as reference) |

## 2. Problem, measured (1440 px, dark, authorized state, `tools/test-conv-text-budget.mjs --measure`, 2026-11-14)
| Page | words at rest outside drawings | prose blocks (>= 10 words) | sentences inside the drawing (>= 6 words) | visible defects (screenshots) |
|---|---:|---:|---:|---|
| datahall | 858 | 11 | 0 | three stacked status/explainer strips; KPI cards hold sentences; rack field is boxes of stripes with clipped labels, not a floor plan; event log is sentences |
| chiller-plant | 332 | 3 | 28 (658 words in the SVG) | each chiller is a box of boxes of 7 px text; refrigerant cycle drawn inside a card; CRAH banks are text tables in rectangles; pipes run as many parallel rails without a readable loop |
| fire-system | 487 | 10 | 3 | tank is a flat 300 px cyan block; pump labels overlap ("Jockey Pump · pressure maintenance" over its valve); zone blocks cut at the right edge; no flow animation; sprinkler/pre-action/riser not drawn; cause & effect as prose cards |
| fuel-system | 451 | 5 | 3 | best of the family (owner: 60 %): real tank/pump/valve/instrument symbols, flow-state lines. Left: icon flow-chain row duplicating the P&ID, basis sentences, wordy panels |
| water-system | 390 | 5 | 1 | 60 %: P&ID readable; KPI table and reconciliation prose; filter/dosing as text boxes |
| ict | 497 | 5 | 0 | 60 %: architecture diagram right edge out of view at 1440; chips row of gateways; segment descriptions as sentences |

Out of scope for law T1: the provenance line `[data-rz-provenance]` (PRD-Q06, LTC; text fixed by its registry). Its words still count.

## 3. Objectives and laws (each a gate, red on today's tree)
| Law | Statement | Gate |
|---|---|---|
| T1 | 0 prose blocks at rest outside drawings, dialogs, tooltips, the basis drawer and the inspector | test-conv-text-budget |
| T2 | visible words at rest <= 400 per page (today 332–858) | same |
| T3 | the main drawing is never cut by its container without scroll or zoom | same |
| T4 | 0 sentences inside a drawing: a drawing carries tags, values and short labels | same |
| T5 | every relocated explanation is reachable through RZExplain: the element carries `data-explain="conv-<page>-<topic>"`, the entry exists in `tools/explain-extra.json` and the generated DB; RZExplain already gives hover, focus, tap, Esc and `aria-describedby` | test-conv-explain-wiring + a T5 check in test-conv-text-budget |
| T6 | every number keeps its trace: the coverage gates (`test-conv-coverage --strict`) and basis-drawer gates stay green | existing |
| T7 | flow is animated on running lines only, direction = process direction, static encoding under reduced motion (solid = flowing, dashed = stopped, hairline = unavailable) | existing line-model gates + per-page drawing laws |
| T8 | no overlap of drawing labels (G1) and no label below the legibility floor on the redrawn drawings | test-conv-geometry, audit-legibility (strict) |

## 4. Design rules (one register for the family, same as LTC's datahallAI redraw)
- Page = header row (title, scenario, alarms, back) + ONE status strip + the drawing + a compact data rail. No second explainer strip, no "CURRENT · ENGINE BOUND" / "STUDY ONLY" banners at rest: they become one chip each whose note holds the sentence.
- Words move, they are not deleted: a sentence becomes (a) a curated RZExplain entry (`tools/explain-extra.json`, key `conv-<page>-<topic>`, CLAUDE.md: RZExplain is THE tooltip engine, no per-page tooltip code) referenced by `data-explain` on the label or value it explains, (b) a basis-drawer entry when it is the derivation of a number, or (c) a row in an equipment modal/inspector when it describes one device.
- Drawings: ISA-5.1 instrument bubbles, IEC/ISO pump, valve, tank, heat-exchanger, cooling-tower and fan symbols; one stroke tier per medium (`RZLineModel.MEDIUMS`); tags in mono, values beside the symbol; no gradients, glows, glass, tiles or icon washes; radius <= 4 px; one amber accent.
- Motion: dash travel along running lines in flow direction at a speed scaled to flow; stopped lines dashed and still; reduced motion static.
- Phone (390 px): drawing fits width or pans inside its own frame; no page sideways scroll.

## 5. Work packages
| WP | Content | Done = |
|---|---|---|
| W0 | `tools/test-conv-text-budget.mjs` (T1–T5) red on today | gate written, red recorded |
| Wt | text pass on all six pages (sentences to RZExplain entries, derivations to the basis drawer, device detail to modals), one status strip per page | T1, T2, T5, T6 green |
| W1 | fire-system: redraw the fire-water and suppression P&ID — tank as a vessel with level, jockey + electric + diesel pumps with valves and check valves, PSL/PSH, flow switch, alarm valve, riser, pre-action valve, sprinkler branch per zone, N2 generator; zones as a strip that fits; cause & effect as a matrix (event × output) with the stage descriptions in notes; flow animation on the running path | T1–T8 |
| W2 | chiller-plant: redraw as one plant loop — chillers as evaporator/condenser symbols with compressor, primary pumps, common header, decoupler, secondary pumps, CRAH coil per hall, cooling towers on the condenser side; per-chiller detail moves to the existing modal; loop table stays | T1–T8 |
| W3 | datahall: one status strip; KPI cards without sentences; rack field as a floor plan (rows, cold/hot aisles, CRAH positions) with heat colour per rack and per-row min/avg/max in the note; event log as tag + state rows | T1–T6, T8 |
| W4 | fuel-system polish: drop the duplicate flow-chain row, basis sentences to notes/drawer, tighten panels | T1–T6 |
| W5 | water-system polish: KPI table compact, reconciliation to the basis drawer, filter/dosing/UV as symbols | T1–T6 |
| W6 | ict polish: architecture fits or pans; gateway chips to one strip; segment descriptions to notes | T1–T6 |
| W7 | standards (ANTI_VIBECODE, design.md cockpit rules, CONV standard), CHANGELOG, release | full gate |

## 6. Risks
- Coverage gate is strict on these pages: removing a number's declaration turns it red — every move keeps `data-basis-param` / `data-rz-authored-basis` on the value.
- Gates that assert old copy (probe, conv gates) may read moved sentences; each such assertion is updated to read the note, never deleted.
- One symbol library (agreed with LTC 2026-11-14): `assets/engineering/*.svg` + manifest -> `tools/build-engineering-symbols.mjs` -> `js/rz-eng-symbols.js`, extended by LTC with ports/states/`use()`; sheets as `data/hmi/drawings/<page>/<sheet>.json` rendered by LTC's `js/rz-hmi-sheet.js`. W1/W2 (fire, chiller redraw) build on it, so they add no hand-typed SVG coordinates (diagram-adoption ratchet: fire 137, chiller 9, may only fall).

## 7. Honest boundary
These remain simulated teaching cockpits on the conv-engine basis. A redraw changes how the plant is drawn and where words live; it does not change a single engine number.
