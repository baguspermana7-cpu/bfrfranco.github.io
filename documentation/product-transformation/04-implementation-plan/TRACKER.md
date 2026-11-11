# Master execution tracker

Shared by two sessions. **Each session edits only its own rows.** Before touching a file outside your own area, message the
other session first.

| Status | Meaning |
|---|---|
| NOT STARTED | Work has not begun |
| IN PROGRESS | Work is under way |
| PARTIALLY IMPLEMENTED | Some of the scope is built |
| IMPLEMENTED — NOT VERIFIED | Built, but not yet proven |
| VERIFIED COMPLETE | Built and proven |
| BLOCKED | Cannot proceed; the reason is in the Evidence column |

**Evidence** means a commit SHA plus the gate output line, or a live check. Claims without evidence do not count.

## A. Existing commitments

| Id | Item | Owner | Status | Evidence |
|---|---|---|---|---|
| R001–R108 | Owner requests (homepage, LTC, index) | homepage/LTC | VERIFIED COMPLETE | Live v3.35.9 `4cccad1d5` carries `3983bea5c`; live micro, depth, r079 PASS; slop 0; a11y clean |
| X2 | `openInCalc` routes for all 11 calculators | peer | VERIFIED COMPLETE | live v3.35.10 5216448ca (gate 167/168, the one fail was the Cx fps under load, 112/112 on rerun; live byte-compare equal) |

## B. PRD-driven program (homepage/LTC session rows)

| Task | Source PRD | Wave | Depends on | Owner | Status | Evidence |
|---|---|---|---|---|---|---|
| PRD-Q06 | Q6 | 0 (PRD) | — | Opus agent A | IMPLEMENTED — NOT VERIFIED (PRD written, 1687 lines, self-score ≥4 all 12; main QA pending) | 02-prds/PRD-Q06/PRD.md |
| PRD-Q04 | Q4 | 0 | — | Opus agent A | IMPLEMENTED — NOT VERIFIED (PRD written, 1844 lines; 60 local PUE paths, DCMOC carbon levy country bug; owner decisions D-1..D-9) | 02-prds/PRD-Q04/PRD.md |
| PRD-Q01 | Q1 | 0 | — | Opus agent B | IMPLEMENTED — NOT VERIFIED (PRD written, 1041 lines, self-score ≥4 all 12; main QA pending) | 02-prds/PRD-Q01/PRD.md |
| PRD-Q03 | Q3 | 0 | P2 | Opus agent B | IMPLEMENTED — NOT VERIFIED (PRD written, 1023 lines; only 3 of 43 dossiers qualify; FR-13 asks peer P2 hooks) | 02-prds/PRD-Q03/PRD.md |
| PRD-Q07 | Q7 | 0 | Q6 | Opus agent C | IMPLEMENTED — NOT VERIFIED (PRD written, self-score ≥4 all 12; main QA pending) | 02-prds/PRD-Q07/PRD.md |
| PRD-Q17 | Q17 | 0 | Q1, P2 | Opus agent C | IMPLEMENTED — NOT VERIFIED (PRD written, self-score ≥4 all 12; main QA pending) | 02-prds/PRD-Q17/PRD.md |
| PRD-Q18 | Q18 | 0 | Q1 | Opus agent C | IMPLEMENTED — NOT VERIFIED (PRD written, self-score ≥4 all 12; main QA pending) | 02-prds/PRD-Q18/PRD.md |
| PRD-Q09 | Q9 | 0 | — | Opus agent D | IMPLEMENTED — NOT VERIFIED (PRD written, self-score ≥4 all 12; main QA pending) | 02-prds/PRD-Q09/PRD.md |
| PRD-Q15 | Q15 | 0 | — | Opus agent D | IMPLEMENTED — NOT VERIFIED (PRD written, self-score ≥4 all 12; main QA pending) | 02-prds/PRD-Q15/PRD.md |
| PRD-Q10 | Q10 | 0 | owner approval | Opus agent E | IN PROGRESS | — |
| PRD-Q11 | Q11 | 0 | owner approval | Opus agent E | IN PROGRESS | — |
| PRD-Q12 | Q12 | 0 | X1 | Opus agent D | IMPLEMENTED — NOT VERIFIED (PRD written, self-score ≥4 all 12; main QA pending) | 02-prds/PRD-Q12/PRD.md |
| PRD-X-DEFECTS | X1, X4, X6–X8, X10–X12 | 0 | — | Opus agent E | IN PROGRESS | — |
| QA review | all of this session's PRDs | 0b | PRDs | main | NOT STARTED | — |
| Cross-PRD review | all of this session's PRDs + interfaces with the peer | 0c | QA | main | NOT STARTED | — |

<!-- peer rows below this line -->

## C. PRD-driven program (calculator/product session rows: P1–P26, X2, X3, X5, X9)

| Task | Source PRD | Wave | Depends on | Owner | Status | Evidence |
|---|---|---|---|---|---|---|
| X2 | PX | 1 | — | calc session | VERIFIED COMPLETE | live v3.35.10 `5216448ca`; ship gate 167/168 + [131] Cx rerun alone 112/112; live byte-equal rz-version.js, rz-scenario.js, sw.js |
| X3 | PX | 1 | — | calc session | VERIFIED COMPLETE | v3.35.11 `57905e28d`; test-calc-onclick-handlers RED on tia → PASS; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| F1 calculator registry | ARCH C1 | 1 | — | calc session | VERIFIED COMPLETE | `dfff4b121`; test-calculator-registry RED 6 → "11 calculators, 17 fields, 22 results"; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| F2 embed compute | ARCH C2 | 1 | F1 | calc session | VERIFIED COMPLETE | `2f6374bda`; test-embed-compute E1–E7 8/8, RED on old consent script; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P02 share links | P02 | 1 | X2 | calc session | VERIFIED COMPLETE | v3.36.0 `c9964d039`; test-scenario-share-links 71 checks; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P08 seeded uncertainty | P08 | 1 | — | calc session | VERIFIED COMPLETE | v3.36.0; test-seeded-uncertainty 24 checks, RED in old tree; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P23 register CSS | P23 | 1 | — | calc session | VERIFIED COMPLETE | v3.36.0; test-register-css RED 6 → 96/96; a11y CLEAN 13 pages × 2 themes; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P25 offline calculators | P25 | 1 | — | calc session | VERIFIED COMPLETE | v3.37.0 `a48f6e62e`; test-sw-precache 60, test-offline-calculators 11/11 (RED on old tree); index.html swap = LTC; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P16 engine version module | P16 | 1 | — | calc session | VERIFIED COMPLETE | v3.37.0; pins gate RED ×2 → PASS; versions-missing fixture RED on literal pin → PASS; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| Ship v3.35.11–v3.37.0 | — | 1 | all above | calc session | VERIFIED COMPLETE | rolled into the v3.38.0 push (5f34cf631): full gate 175/177, both fails Cx timing under load |
| P14 discoverability | P14 | 2 | — | calc session | VERIFIED COMPLETE | v3.38.0 `5f34cf631`; Ctrl+K + search button on the calculators; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P15A activity history | P15 | 2 | — | calc session | VERIFIED COMPLETE | v3.39.0 `69b360f21`; test-activity-log; part B = owner SQL; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P07 sensitivity | P07 | 2 | F2 | calc session | VERIFIED COMPLETE | v3.40.0 `f1b6b5b39` + fixture fix `663d3071f`; test-sensitivity 34; sharded gate: shard 1 90/91 (Cx fps only), shard 2 running; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P01 facility project S1 | P01 | 3 | F1 | calc session | VERIFIED COMPLETE | v3.42.0 `882c0c352`; test-project-core 54, test-project-ui 46; S2 = owner SQL; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P03 compare | P03 | 3 | F2 | calc session | VERIFIED COMPLETE | v3.43.0 `6c0547e13` + `3d413685f`; test-compare-core 55, test-compare-ui 38; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P17 manual links | P17 | 3 | F1 | calc session | VERIFIED COMPLETE | v3.44.0 `e3b4ed7bc`; test-manual-links 202 (72 groups measured); live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P04 project pack | P04 | 3 | P01, F2 | calc session | VERIFIED COMPLETE | v3.45.0 `15d6b8bdb`; test-pack-core 21 (RED ×3), test-pack-ui 25 (RED ×2: page defaults, masked values); live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |
| P26A data freshness (as-of label) | P26 | 3 | — | calc session | VERIFIED COMPLETE | v3.46.0; js/rz-asof.js; test-hub-tools T4 regex for "as of <Mon YYYY>"; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live; P26B = owner decision |
| Ship v3.42.0–v3.46.0 | — | 3 | P01, P03, P17, P04, P26A | calc session | VERIFIED COMPLETE | rebased onto v3.41.0 as one squash `0214564e8`; live v3.46.0 `0214564e8` (2026-11-12): full gate 194/194 + probe 82/82, 243/243 changed files byte-equal live |

