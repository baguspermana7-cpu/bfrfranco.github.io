# Article 29 diagrams: build notes

Definitions: `LLM_FIGURES` + `gridFigure()` in `tools/build-article-diagrams.mjs` (ids `llm-d1` ... `llm-d11`, page `article-29.html`).
PNG renders (900 px page, 1.5x): `Article/Article_29/build/fig-llm-dN.png`.

## Method
`gridFigure()` places nodes by column/row. Column width = widest node in the column, measured with the engine's own metrics; row pitch = tallest node + gap; zones = bounding box of named nodes (it warns `zone-label-overflow` if the eyebrow does not fit); connector endpoints are box sides, fanned and ordered so they do not cross; the engine routes and places labels. No coordinates are typed. No hex. Colours used: accent, rule-solid, soft, muted, ink, paper, paper-2, alarm-caution.

## Gate results (final)
- `node tools/build-article-diagrams.mjs` PASS, then `--check` PASS (no drift) against the temporary 11-placeholder page.
- `node tools/test-article-diagrams-engine.mjs` PASS (34 engine figures).
- `node tools/test-rz-diagram-engine.mjs` PASS 128/128.
- Engine warnings in the final build: 0 for all eleven (node-overflow, label-unplaced, transit, over-budget, ports-crowded, colour-only, legend-*).
- `--check` on `article-29.html` fails until the coordinator's page carries the eleven placeholders (the temporary page was deleted as instructed).

## Per figure
Warnings "before" = first build; "after" = final.

| Fig | Nodes / edges / zones | Size (viewBox) | Warnings before -> after | Changes from spec (and why) |
|---|---|---|---|---|
| D1 | 9 / 11 / 1 | 812x756 | 0 -> 0 | Tag "d = 8,192" written "width 8,192" (tags are upper-cased, so `d` read as `D`). Spec's "2/3" in the FFN tag is "2/3 of block weights" (the fraction glyph is not in the width table). Zone label moved clear of the skip line by widening column 0. add1->n2 leaves add1's right side so the skip connector keeps the bottom side to itself (no jog). Labelled "skip" connectors are dashed. |
| D2 | 8 / 9 / 1 | 576x604 | 0 -> 0 | `K^T` and `d_h` written in ASCII (superscript T and subscript h are not reliably in the mono face). Zone label shortened to "O(n^2.d) . SRAM [S50]" (full sentence is in the caption). Q, K edges enter Scores from the left so none crosses the zone eyebrow. |
| D3 | 8 / 4 / 1 | 680x516 | 0 -> 0 | GPU symbol omitted: `RZEngSymbols` has no `gpu` glyph (see below). `valueKey: kvGiB` not wired: the calculator keys are not final; adding `valueKey` to k8/k32/k128 sublabels is a one-line change per node once they exist. The three comparison nodes sit in the zone, no edges (as specified). |
| D4 | 9 / 11 / 1 | 824x696 | 0 -> 0 | Router -> idle drawn as a dashed connector on the same bus as top-8 (a separate route overlapped tok->sh). Idle and shared expert swapped in row order so tok->sh runs under everything. Out node carries "37B of 671B run / 5.5 %" (derived). Spec's "Expert 17 / 88 / ... 6 more" kept. Zone label shortened to "<= 4 nodes [S1]". |
| D5 | 9 / 8 / 3 | 824x644 | 1 (zone overlap, seen in render, not a warning) -> 0 | Spec has 11 nodes; the budget is 9. Merged: crawl+dedup -> "Collect + filter"; eval+release -> "Evals + safety -> release". Data-mix sublabel abbreviated ("gen 50 . math 25 . code 17 . multi 8", % in caption). Compute zone label "16K H100 . 25 MW" (the "(derived)" is in the caption); it is short so the c->d connector does not cross it. Snaked 3 columns so it fits 824 px. Distillation drawn as a dashed branch from RL. |
| D6 | 9 / 10 / 3 lanes | 688x740 | 1 (label-unplaced "joins batch") -> 0 | Swimlane drawn with time running DOWN and three lane zones (Scheduler / GPU compute / HBM traffic), because seven time columns would be ~1,000 px wide. Added a `join -> decode step 1` dashed connector ("joins"), which the spec only implies. Decode step 2 carries 23.7 ms ideal / 39.4 ms at 60 %. |
| D7 | 6 / 5 / 2 | 404x1096 | 0 -> 0 | No `gpu` or `server` glyph exists in the library, so only the NVL72 rack carries one (`rack`). Multipliers were not given for every rung in the spec; derived: L0->L1 x2.2 bandwidth (1.79 TB/s / 819 GB/s), L1->L2 x8 GPUs, L2->L3 x9 GPUs and x10 kW (spec), L3->L4 x128 chips (9,216 / 72), L4->L5 x15-120 power (150 MW-1.2 GW / 10 MW). Cooling zones: "Air-cooled [S10]" and "Liquid cooling [S10][S14]". Narrow and tall by design. |
| D8 | 9 / 10 / 0 | 848x448 | 1 (colour-only legend) -> 0 | Spec has 10 nodes; sbx + tools merged into "Sandbox + MCP tools". The two zones ("Harness", "Model") are not drawn: the harness nodes are not contiguous in a loop layout, and a bounding-box zone would swallow the model. The split is carried by node treatment and legend instead (model = accent, observation = dashed caution, harness = plain). Budget -> model is a dashed legend entry, not a label. |
| D9 | 7 / 6 / 0 | 880x448 | 0 -> 0 | Unchanged structure. "4.8 % size" in the result node (32/671, derived). Qwen3 note kept as an unconnected dashed node (as specified). Widest figure, 1.20x the column (scrollable). |
| D10 | 6 / 5 / 2 | 816x464 | 1 (zone-label-overflow) -> 0 | **Block version, not the chart.** Two zones (bandwidth-bound / compute-bound), ridge point as the accent node between them, the two roofs as inputs to the ridge, three workloads. The log-log chart in `rz-article-chart.js` is still needed for the curves. Numbers from the spec only (ridge 295 / 206 / 625; 3.35 / 4.8 / 8 TB/s; 989 TF / 5 PF). |
| D11 | 6 / 6 / 0 | 596x508 | 0 -> 0 | The two ratio chips are nodes (dashed) joined to the tokenisation node by dotted connectors. English chip carries no source tag (the spec gave none). |

## What each figure adds beyond a table (the `because` field)
- D3, D10 and D11 are the weakest. D10 only restates the ridge-point table (kept minimal as instructed); D11's ratio is a table row, the added value is the visible split of one Indonesian phrase; D3's chain restates three numbers, the added value is that the 40 GiB lands on the same chip as the weights, and the 8.6 / 40 / 100 GiB comparison.
- D1, D4, D6, D8 are topology (skip connections plus cache loop, stored-not-computed experts, two-bottleneck timeline, who controls the loop).

## Things the coordinator should know
- Placeholders needed in `article-29.html`: `<figure class="rz-figure" data-rz-figure="llm-d1"></figure>` ... `llm-d11`, then run `node tools/build-article-diagrams.mjs`.
- Figure widths over the 736 px column (builder notes, not failures, scroll in-track): D1 812, D4 824, D5 824, D8 848, D9 880, D10 816 (D2, D3, D6, D7, D11 fit). None exceeds 1.2x.
- Figures use literal source tags (`[S2]`, `[S50]`...) in tags and sublabels as specified; the engine upper-cases tags, so a tag reads `[S2]` unchanged but `d` becomes `D`.
- The engine had to be left untouched: only `tools/build-article-diagrams.mjs` and this file were edited. The temporary `article-29.html` was deleted.
