# Article 30 diagrams: build notes

Definitions: `AGENTIC_FIGURES` in `tools/build-article-diagrams.mjs` (after `LLM_FIGURES`, reusing `gridFigure()`; ids `agentic-d1` ... `agentic-d8`, page `article-30.html`).
PNG renders: `Article/Article_30/build/fig-agentic-dN.png` (1.5x, rendered on a 1000 px viewport, not 900, so the 928 px D8 and 896 px D2/D3 are shown whole; in the article they scroll inside the 736 px track like the article-29 figures).
Method as article 29: nodes by column/row, widths measured by the engine, zones from named nodes, engine routing, no coordinates, no hex. Strokes used: accent, ink, soft, muted, alarm-caution, alarm-fault, rule-solid; fills paper, paper-2 only. No gradient, glow or other fill.
Convention: probabilistic = accent + paper-2; deterministic = ink; human gate = alarm-caution + dashed; safety-rated = alarm-fault + paper fill + tag. In the article's token bridge alarm-* all map to the accent, so every distinction also rides on a second channel (dash, tag, fill) and a legend entry.

## Gates (final)
- `node tools/build-article-diagrams.mjs` PASS, `--check` PASS (against the temporary 8-placeholder page, since deleted).
- `node tools/test-article-diagrams-engine.mjs` PASS. `node tools/test-rz-diagram-engine.mjs` PASS 128/128.
- Engine warnings in the final build: 0 for all eight.

## Per figure (warnings before -> after; "before" = first build, all fixed by layout)
| Fig | Nodes / edges / zones | viewBox | Warnings | Deviations from DIAGRAMS.md (and why) |
|---|---|---|---|---|
| D1 | 9 / 8 / 2 | 804x500 | 3 (2 label-unplaced, 1 colour-only) -> 0 | Spec has 11 nodes. Merged `py`+`api` into one node ("python opentable.py -> OpenTable API"), dropped `u2` (the user is already in zone A) and merged `x`+`w` into "Executor". Confirm gate moved INTO the line harness -> gate -> executor (spec draws `l2 -> g -> x` as a side branch; the side branch produced a jogged route through the harness->executor connector). Edge labels "decided by model / executed by code" removed (no clear position); carried by line pattern (solid accent vs dashed ink) and legend instead. Only the return edge keeps a label. |
| D2 | 8 / 10 / 0 | 896x492 | 1 (label-unplaced "proposal", an invented label) -> 0 | As specified (8 nodes). Dropped my own "proposal" label. Dashed muted = reject/halt. |
| D3 | 6 / 5 / 2 | 896x260 | 0 -> 0 | The "three small rows under each level" (18 nodes) are NOT drawn: they break the 9-node budget. Replaced by one node tag per level naming what the LLM decides ("output: LLM", "branch: LLM", "move: LLM", "steps: LLM", "all: code"), stroke ink vs accent. The "cron, RPA, expert systems: decades old" tag is in the caption only (a zone over c0-c2 would overlap the workflow zone). Sublabels shortened to keep the figure under 900 px. |
| D4 | 9 / 12 / 0 | 848x584 | 0 -> 0 | Spec has 14 nodes. Merged `req` into spec-writer, `rv1..rv4` into one "4 reviewers" node, `mg`+`main` into "Merge to main". Dotted state edges to `board.json` drawn from verdict, DECIDE and approver only; the gate -> board edge is omitted because it crossed the "rounds exhausted" connector and its label. Gate sublabel is "lint . test . build" with tag "never overridable" (the other four checks and [S60] are in the caption). Tag no longer carries [S60] (caption does). |
| D5 | 8 / 8 / 2 | 808x500 | 0 -> 0 | Spec has 10 nodes. Merged `p1`+`p2` ("Read text, logs, screens / and choose among options") and `d1`+`d4` ("Validate + enforce"). `d2 -> d5` ("Log and replay") added as a plain connector. `p4` (Explain) is dashed with tag "may be unfaithful [S3]". |
| D6 | 5 / 4 / 2 | 592x408 | 0 -> 0 | 20 step nodes per row cannot fit the budget: each row is ONE "Step x 20" node. The per-step loop-back is a Step <-> Verifier pair labelled "detected: retry". `valueKey` NOT bound: C-ii keys do not exist yet. **Number correction:** the spec and sec-05 say `0.995^20 = 0.899`; `0.995^20` is 0.905. Per CALCULATORS C-ii, Ps = p*E = 0.95 x 1.04706 = 0.9947 and Ps^20 = 0.8993. The figure shows "99.47 % per step" and "0.899 over 20 steps"; the sec-05 sentence should read 0.9947^20 (or "about 0.995"). The 0.358 side is exact (0.95^20 = 0.3585). |
| D7 | 8 / 0 / 3 | 828x548 | 0 -> 0 | Spec has 16 dated events (budget 9). Merged by lane and period: capability 2, capital 3, critique 3. Laid out with time running DOWN and the three lanes as columns (a left-to-right axis would be ~1,300 px). No time-axis edge is drawn (nodes carry date tags and rows are ordered). Merged events: Dec 2024 + Mar 2025 + Jun 2025 -> "Limits found" [S53][S3][S5][S6]; METR Jan + Apr 2026 -> one node; Anthropic May + S-1 Jun -> one; capex Jul + IPO Sep -> one; Gartner + MIT -> one; LeCun + SWE-bench -> one; Elder video + safety departures -> one. |
| D8 | 9 / 11 / 4 | 928x736 | 4 (zone-label-overflow, 2 label-unplaced, colour-only) -> 0 | Spec has 10 nodes. Merged `kb`+`tkt` ("SOP library / CMMS", edges "SOPs" in, "draft WO" out). No `plc` glyph exists in `RZEngSymbols`, so PLC has none; BMS and Chiller carry the `bms` and `chiller` symbols. Zone label "Safety (IEC 61511 / SIS)" shortened to "Safety" (standard is the SIS node's tag). Edge labels shortened ("change + evidence", "setpoint"). The "no edge from agent to bms/plc/sis" rule is drawn as absence and stated in the caption. |

## What each figure adds beyond a table (`because`)
- D1, D2, D4, D8 are topology (return path, who can halt whom, loops back to the builder, the single path from agent to plant). D5 is the seam. D3, D7 and D6 are the weakest: D3 restates a list of six levels (value: five levels on one side of the line), D7 restates dated events (value: lane density by period), D6 restates one multiplication (value: where the verifier sits).

## For the coordinator
- Placeholders: `<figure class="rz-figure" data-rz-figure="agentic-d1"></figure>` ... `agentic-d8` in `article-30.html`, then `node tools/build-article-diagrams.mjs`.
- Widths over the 736 px column (scroll in-track, none past 1.3x): D1 804, D2 896, D3 896, D4 848, D5 808, D7 828, D8 928. D6 (592) fits.
- Captions carry the key number and [Sn]; check the D6 correction above against sec-05 before shipping.
