# PRD-P23: Every page that declares a design register loads its rules (UIUX B)

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P23 |
| Version | 1.0, 2026-11-10 |
| Status | Approved (directive) |
| Priority | Wave 1 quick win |
| Re-baseline | The ledger said "declared on 90 pages, CSS loaded by 3". Re-measured per register on 2026-11-10: the real gap is 7 pages. |

## 2. Executive summary
A page opts into a design register (editorial, tool, instrument) with `data-rz-register` on `<html>`. That attribute does nothing unless the page also loads a stylesheet carrying that register's rules.

Seven pages declare a register without loading its rules. This PRD:
- fixes those 7 pages;
- adds a gate so a page cannot declare a register it does not load.

## 3. Problem statement (measured)
| Register | Pages | Loading a rule file | Missing |
|---|---|---|---|
| editorial | 49 | 44 | article-9-paper, asean-dc-report-2026, glossary, pillar-cooling, pillar-power |
| tool | 33 | 33 | — |
| instrument | 18 | 16 | cdu-mini-bms, rz-dark-beforeafter |

Rule files:
- editorial: rz-article-dark, rz-dark, rz-calc-editorial
- tool: rz-tool, rz-explorer
- instrument: rz-cockpit-instrument, rz-monitor-instrument, rz-dark

**Consequence.** These pages miss the register's typography, colour tokens and dark-mode rules, so they render inconsistently with their family.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Correct pages | pages with a register and a rule file | 100 % |
| Guard | gate fails on a declared register without a rule file | RED on today's tree |

## 5. Scope
- **In:**
  - For each of the 7 pages, decide by inspection: add the family's rule file, or remove the declaration if the page is not of that family. `rz-dark-beforeafter` is a comparison page that may intentionally avoid the register; decided by looking at its rendering.
  - The gate.
- **Out:** redesigning the pages.

## 6. Personas
Readers of those pages.

## 7. User journey
None. The pages render in their family style in both themes.

## 8. Functional requirements
| ID | Description | Acceptance |
|---|---|---|
| FR-P23-1 | Gate `test-register-css.mjs`: register → rule-file map is derived from the CSS (files containing `[data-rz-register="X"]`), not typed | RED with 7 |
| FR-P23-2 | 7 page fixes | gate GREEN |
| FR-P23-3 | Screenshots before/after, both themes, 390/1440 | reviewed |

## 9. UI/UX specification
The visual result must match sibling pages of the same family. Any contrast regression is caught by the a11y and dark-coverage gates.

## 10–11. Data model / API
None.

## 12. Business rules
A declared register requires a loaded rule file.

## 13. Cross-module integration
- LTC owns the editorial articles' content. The pillar pages and glossary are shared.
- Touching their `<head>` is mechanical; the LTC session is told by message first.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
One extra stylesheet per page, which is cached.

## 16. Security
None.

## 17. Edge cases
A page whose inline styles conflict with the register file: fixed by inspection, with screenshots.

## 18. Technical architecture
Static gate over the HTML and CSS.

## 19. Implementation breakdown
| Task | Effort | Verify |
|---|---|---|
| Gate (RED) | 0.25 d | — |
| 7 fixes | 0.5 d | Gate GREEN + screenshots + dark-coverage + a11y |

## 20. Test strategy
Gate; render audits on the 7 pages.

## 21. Acceptance criteria
- **Given** any page with `data-rz-register`, **then** it loads a file containing that register's rules.

## 22. Rollout
One release. Rollback by revert.

## 23. Risks
Visual shifts on the 7 pages. Mitigated with before/after screenshots.

## 24. Definition of done
- Gate is green.
- Screenshots are reviewed.
- The UIUX ledger row is closed.
- The change is live.
