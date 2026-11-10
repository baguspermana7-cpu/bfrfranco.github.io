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
| PRD-Q06 | Q6 | 0 (PRD) | — | Opus agent A | IN PROGRESS | — |
| PRD-Q04 | Q4 | 0 | — | Opus agent A | IN PROGRESS | — |
| PRD-Q01 | Q1 | 0 | — | Opus agent B | IN PROGRESS | — |
| PRD-Q03 | Q3 | 0 | P2 | Opus agent B | IN PROGRESS | — |
| PRD-Q07 | Q7 | 0 | Q6 | next wave | NOT STARTED | — |
| PRD-Q17 | Q17 | 0 | Q1, P2 | next wave | NOT STARTED | — |
| PRD-Q18 | Q18 | 0 | Q1 | next wave | NOT STARTED | — |
| PRD-Q09 | Q9 | 0 | — | next wave | NOT STARTED | — |
| PRD-Q15 | Q15 | 0 | — | next wave | NOT STARTED | — |
| PRD-Q10 | Q10 | 0 | owner approval | next wave | NOT STARTED | — |
| PRD-Q11 | Q11 | 0 | owner approval | next wave | NOT STARTED | — |
| PRD-Q12 | Q12 | 0 | X1 | next wave | NOT STARTED | — |
| PRD-X-DEFECTS | X1, X4, X6–X8, X10–X12 | 0 | — | next wave | NOT STARTED | — |
| QA review | all of this session's PRDs | 0b | PRDs | main | NOT STARTED | — |
| Cross-PRD review | all of this session's PRDs + interfaces with the peer | 0c | QA | main | NOT STARTED | — |

<!-- peer rows below this line -->
