# 0c — cross-PRD review: shared seams, one owner, one gate (2026-11-14, branch rel359)

Owners are taken from each module's header and the PRD titles (checked, not recalled). Method: every module or data file that more than one PRD writes to or reads from is listed with the PRD that owns its
contract and the gates that test it. A gate counts only if `tools/ship-gate.sh` runs it (checked by name). Measured with
a grep of `tools/test-*` for the file name, then a grep of `ship-gate.sh` for each test.

| Seam | Contract owner | Consumers (PRDs) | Gates (all wired) |
|---|---|---|---|
| `data/calculators.json` | ARCHITECTURE-P C1 / task F1 | P01 fields, P03 compare, P04 pack, P13 handoff + project map, P20 embed.keep, P25 offline, P17 manual links | test-calculator-registry, test-handoff-contract, test-embed-article, test-offline-calculators, test-manual-links + 4 more (9) |
| `js/rz-scenario.js` | P02 | P01, P15 activity log, P13, P20 open link | test-scenario-share-links, test-scenario-open-routes, test-calculator-registry, test-activity-log |
| `js/rz-project.js` | P01 | P04 pack, P13 spares (v3.61.0) | test-project-core, test-project-ui, test-pack-core, test-handoff-contract H6–H8 |
| `js/rz-handoff.js` | P13 part A | tier-advisor sender, spares receiver, LTC incident links (`from=incident`) | test-handoff-contract (C1–C4, H1–H8) |
| `js/rz-handoff-cx.js` | P13 part B | rfs sender, Cx intake, P06 C3 routing | test-handoff-cx (U1–U6, E1–E6) |
| `js/rz-embed-compute.js` | ARCHITECTURE-P C2 / task F2 | P03 compare, P04 pack, P07 sensitivity | test-embed-compute |
| `js/rz-embed.js` + `js/rz-embed-article.js` | P20 part A | 3 articles, 9 calculators | test-embed-article (A0–A10) |
| `data/calc-parameters.json` | P10 | P21 Ask, P10 basis drawer | test-calc-parameter-registry (S1–S6), test-explain-ask |
| `js/datahall-ai/sim-telemetry.js` | P05 (provider seam) | fire points, HMI payloads, replay | test-datahall-ai-replay, -hmi-payloads, -fire-points |
| `js/datahall-ai/tab-loader.js` | P09 | (not loaded yet; stage 1) | test-datahall-tab-loader |
| `js/rz-pack.js` | P04 | P01 | test-pack-core |
| `js/rz-compare.js` | P03 | compare.html, capex, opex, cx (Add to compare) | test-compare-core |

Result: 0 seams without a gate, 0 gates unwired. Two seams changed contract in v3.61.0 and their gates grew with them
(`rz-handoff.js` project map: C4 + H6–H8; `rz-handoff-cx.js` tier routing: U5–U6 + E4–E6), each red before green.
Open: none. Re-run this table when a new shared module appears; a seam with no wired gate is a finding.
