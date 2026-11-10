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
| X2 | `openInCalc` routes for all 11 calculators | peer | IN PROGRESS | v3.35.10, gate running |

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
| PRD-Q09 | Q9 | 0 | — | Opus agent D | IN PROGRESS | — |
| PRD-Q15 | Q15 | 0 | — | Opus agent D | IN PROGRESS | — |
| PRD-Q10 | Q10 | 0 | owner approval | Opus agent E | IN PROGRESS | — |
| PRD-Q11 | Q11 | 0 | owner approval | Opus agent E | IN PROGRESS | — |
| PRD-Q12 | Q12 | 0 | X1 | Opus agent D | IN PROGRESS | — |
| PRD-X-DEFECTS | X1, X4, X6–X8, X10–X12 | 0 | — | Opus agent E | IN PROGRESS | — |
| QA review | all of this session's PRDs | 0b | PRDs | main | NOT STARTED | — |
| Cross-PRD review | all of this session's PRDs + interfaces with the peer | 0c | QA | main | NOT STARTED | — |

<!-- peer rows below this line -->
