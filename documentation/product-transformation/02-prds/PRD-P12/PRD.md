# PRD-P12: Commissioning schedule export to MS Project (MSPDI XML) and calendar (ICS)

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P12 |
| Version | 1.1, 2026-11-10 (revised after review: plan model verified) |
| Status | Approved (directive) |
| Priority | Wave 4 |
| Dependencies | None |
| Modules | cx-calculator.html, js/rz-cx-*.js (plan model); new js/rz-cx-export-schedule.js |

## 2. Executive summary
Schedulers work in MS Project or Primavera P6. The Cx planner can build an L0–L6 plan and export it only as PDF or CSV.

This PRD adds two exports:
- **MSPDI XML**, the Microsoft Project XML interchange format, which P6 also imports.
- **ICS**, one event per milestone.

Both preserve tasks, durations, dependencies and levels.

## 3. Problem statement
- No MSPDI, ICS or XER writer exists. The "xer" hits found in the code are the word "exerciser" (verified).
- The user must re-key the plan into the scheduling tool.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Round-trip fidelity | exported XML re-parsed: task count, durations (working days), predecessor links equal the plan | 100 % (gate) |
| Validity | XML well-formed, MSPDI namespace, required elements present | gate |
| ICS validity | RFC 5545 lines folded at 75 octets, CRLF, unique UIDs | gate |

Not claimed: import into MS Project itself. That is not testable here because there is no MS Project licence on this machine. Stated as an untested assumption; the round-trip parse is the verified proxy.

## 5. Scope
- **In:** MSPDI writer (Project, Calendars: one standard calendar with the plan's working days, Tasks with UID / ID / Name / OutlineLevel / Start / Finish / Duration PTnH / PredecessorLink type FS); ICS writer (milestones and level gates); export menu entries.
- **Out:** XER (proprietary text format; on request later); resources and costs.
- **Reuse:** the plan model already used by CSV export.
- **Verified plan model (rev 1.1):** `RZCxPlan.compute(input, overrides)` returns `RZEngine.models.commissioning.programPlan`: level windows L0–L6 in months, and per-system shares inside L2–L4 ordered electrical → mechanical → controls (handbook 02.4.8). L1 and L5 are whole-window. There is **no task network with explicit predecessors**. Mapping: each level = a summary task (OutlineLevel 1); each system inside a level = a subtask (OutlineLevel 2) with start/finish from its share; FS links are generated between consecutive levels (L(n) → L(n+1)) and between consecutive systems inside a level, mirroring the stated ordering rule; gate dates (`gateMonths`) become milestones with Duration 0. Months are converted to dates from the plan's start month, using 21.67 working days per month (stated in the export's project notes).

## 6. Personas
Cx manager. Scheduler.

## 7. User journey
1. Plan tab → Export menu → "MS Project XML" or "Calendar (.ics)".
2. A file downloads (`cx-plan-<date>.xml`).
3. If the plan is empty, the menu entries show the reason in the menu itself ("Add tasks to export").

## 8. Functional requirements
| ID | Description | Acceptance |
|---|---|---|
| FR-P12-1 | Plan → MSPDI mapping as stated in §5 (levels → summary tasks, systems → subtasks, generated FS links, gates → milestones) | round-trip gate: summary count 7, subtask count = systems in L2–L4 × 3 levels + whole-window rows, milestone count = gate dates |
| FR-P12-2 | XML escaping of names | unit with `<&>"` |
| FR-P12-3 | ICS writer: milestones as all-day events; DTSTAMP UTC; UID = `<task uid>@resistancezero.com` | unit |
| FR-P12-4 | Export menu entries; entry disabled with the reason when the plan is empty | E2E |

## 9. UI/UX specification
Two items in the existing export menu, with the same pattern as CSV. The download uses a Blob plus an anchor with the `download` attribute.

## 10. Data model
None stored.

## 11. API contracts
`rzCxExport.mspdi(plan) → string`; `rzCxExport.ics(plan) → string`.

## 12. Business rules
- Durations are in working days × 8 h.
- Dependencies are generated FS links that restate the plan's ordering rule; the plan itself stores no links, so editing links in MS Project does not round-trip back (one-way export, stated in the menu tooltip).

## 13. Cross-module integration
P15 event `pdf_exported{format:'mspdi'|'ics'}`. P06 records unaffected.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
Export of 2,000 tasks in under 500 ms (estimate, measured).

## 16. Security
Client-side generation only. Escaping covered by FR-P12-2.

## 17. Edge cases
- Circular dependencies: the plan should prevent them. If present, the export fails with a list of the tasks.
- Non-ASCII names: UTF-8 with the XML declaration.

## 18. Technical architecture
plan model → writers → Blob download.

## 19. Implementation breakdown
| Task | Effort | Verify |
|---|---|---|
| T-P12-1 Plan model discovery | 0.25 d | notes |
| T-P12-2 MSPDI writer + round-trip gate | 1 d | gate |
| T-P12-3 ICS writer + gate | 0.5 d | gate |
| T-P12-4 Menu + E2E | 0.25 d | E2E |

## 20. Test strategy
Unit tests (escaping, ICS folding). Round-trip: the exported XML is parsed back by the browser's own DOMParser inside the headless page (Puppeteer `page.evaluate`), which needs no new dependency; task count, durations and links are compared with the plan. E2E: download captured via the CDP download path.

## 21. Acceptance criteria
- **Given** the default Cx plan, **when** exported as MSPDI and parsed, **then** the task count and the sum of durations equal the plan.

## 22. Rollout
Additive. Rollback by revert.

## 23. Risks
MSPDI import quirks in specific Project versions: documented as untested; feedback path via the owner.

## 24. Definition of done
- Gates are green.
- Sample files are attached in 05-test-evidence.
- The change is live and verified.
