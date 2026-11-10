# Improvement register: accepted ideas, owners and PRD ids

The owner accepted every idea in R110/R111 (2026-11-10). The two sessions split ownership on 2026-11-10, and the peer confirmed
the split by message.

Priority = 10 × (0.40 I + 0.15 N + 0.20 C + 0.25 (11 − E)). The formula is shared by both registers.

## Owned by this session (homepage/LTC)

| Id | Idea | Priority | PRD | Approval class (R111) |
|---|---|---|---|---|
| Q6 | Simulation honesty layer | 74.5 | `02-prds/PRD-Q06/PRD.md` | ordinary |
| Q1 | Article / tool / incident / term relation file | 74.5 | `02-prds/PRD-Q01/PRD.md` | ordinary |
| Q7 | Scripted fault scenarios (training mode) | 73.0 | `02-prds/PRD-Q07/PRD.md` | ordinary (replaces random alarms, adds a feature) |
| Q3 | Reproduce an incident in a calculator | 71.0 | `02-prds/PRD-Q03/PRD.md` | ordinary; depends on P2 |
| Q18 | Incident pattern analytics | 70.0 | `02-prds/PRD-Q18/PRD.md` | ordinary |
| Q4 | One engine path per metric | 67.5 | `02-prds/PRD-Q04/PRD.md` | ordinary; any change in output needs evidence |
| Q17 | Learning paths | 65.5 | `02-prds/PRD-Q17/PRD.md` | ordinary |
| Q12 | Finance terminal sync, or removal of the dead path | 63.0 | `02-prds/PRD-Q12/PRD.md` | removal needs owner approval |
| Q15 | Indonesian layer | 60.5 | `02-prds/PRD-Q15/PRD.md` | translations need owner review |
| Q11 | Server-side feature flags | 57.5 | `02-prds/PRD-Q11/PRD.md` | **auth boundary: approval needed** |
| Q9 | Finish the incident library | 57.0 | `02-prds/PRD-Q09/PRD.md` | ordinary (content) |
| Q10 | Admin console on real data | 56.0 | `02-prds/PRD-Q10/PRD.md` | **auth/privacy boundary: approval needed** |
| X-DEFECTS | X1 code part, X4 interim, X6, X7, X8, X10, X11, X12 | n/a | `02-prds/PRD-X-DEFECTS/PRD.md` | X8 deleting a Worker = approval; X12 removing a section = approval |

## Owned by the peer session

| Id | Contents |
|---|---|
| P1–P26 | The peer's ideas |
| Merged into P ideas | Q2 into P14, Q5 into P8, Q8 into P26, Q13 into P13, Q14 into P19, Q16 into P25 |
| Defects | X2, X3, X5, X9 |

## Owner only

- **X1:** rotate the Finnhub API key. The code removal is in PRD-X-DEFECTS and waits for the rotation.
