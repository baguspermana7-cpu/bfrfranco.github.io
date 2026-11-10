# PRD-P24: Cx plan editor: edit model and animation rate (K22 items 8 and 9)

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P24 |
| Version | 1.0, 2026-11-10 |
| Status | **BLOCKED on owner decision.** Both options are fully specified below, so implementation can start the day the owner picks. |
| Priority | Existing commitment (Workstream A, K22) |
| Modules | Cx plan editor (`js/rz-cx-*.js`), the PRD v1.1 ledger |

## 2. Executive summary
Two decisions remain open on the Cx plan editor:

- **Item 8, the edit model.**
  - Option A, preview then Apply: edits are staged and shown as a ghost, and nothing changes until Apply.
  - Option B, direct edit with Undo: edits apply immediately, and an undo stack (Ctrl+Z) reverts them.
- **Item 9, the animation frame rate.** The current rate is 24 fps. The PRD says 30 fps.

## 3. Problem statement
- K22 is at 7 of 9 items.
- Items 8 and 9 need taste and ownership decisions that only the owner can make.

## 4. Objectives and success metrics
| Option | Metrics |
|---|---|
| A (preview / Apply) | No plan change before Apply (gate). Apply and Cancel are both keyboard reachable. |
| B (direct + undo) | Every edit undoable to the initial state (gate, 50 random edits then 50 undos gives a deep-equal plan). Redo with Ctrl+Shift+Z. |
| fps | Measured frame interval within ±10 % of the target in headless with GPU flags. Reduced motion means no animation. |

## 5. Scope
In scope: the chosen option only.

## 6–7. Personas and journey
Cx planner editing durations and dependencies:
- With A: edit fields, see the ghost bars, press Apply or Cancel.
- With B: edit, the bars move, press Ctrl+Z.

## 8. Functional requirements
| ID | A | B |
|---|---|---|
| FR-P24-1 | Staged change set; ghost render | Command pattern with an undo stack (cap 200) |
| FR-P24-2 | Apply commits and recomputes downstream (critical path, cost); Cancel discards | Each command recomputes downstream; undo restores the previous plan snapshot |
| FR-P24-3 | Leaving with unapplied changes prompts | The stack clears on reload; a persisted plan stays as is |
| FR-P24-4 (fps) | `FRAME_MS = 1000 / target` single constant | same |

## 9. UI/UX specification
- **A:** a sticky bar shows "3 changes staged · Apply · Cancel". Ghost bars have a dashed outline.
- **B:** Undo and Redo buttons in the toolbar, with a count. A toast "Undone: duration of L3-E-12".

## 10–11. Data model / API
In-memory only. No API.

## 12. Business rules
- The downstream recompute is identical in both options.

## 13. Cross-module integration
P12 export reads the committed plan only.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
Recompute under 50 ms for the default plan (measured).

## 16. Security
None.

## 17. Edge cases
- A: Apply after an invalid edit (cycle) is blocked, with the reason.
- B: an edit that creates a cycle is refused and is not pushed onto the stack.

## 18. Technical architecture
Option A wraps the plan in a staging layer. Option B wraps edits in commands.

## 19. Implementation breakdown
1–1.5 d either option, plus 0.25 d for fps.

## 20. Test strategy
Per §4 metrics.

## 21. Acceptance criteria
- **Option A. Given** three staged edits, **when** Cancel is pressed, **then** the plan deep-equals its state before the edits. **When** Apply is pressed, **then** the critical path and cost are recomputed once.
- **Option B. Given** 50 random valid edits, **when** Undo is pressed 50 times, **then** the plan deep-equals the initial plan. Redo re-applies them in order.
- **Either option. Given** an edit that creates a cycle, **then** it is refused with the reason, and the plan is unchanged.
- **fps. Given** the animation runs for 5 s in headless with GPU flags, **then** the median frame interval is within ±10 % of 1000/target ms. **Under** reduced motion, no frames are animated.

## 22. Rollout
One release after the decision.

## 23. Risks
None beyond the decision itself.

## 24. Definition of done
- The chosen option ships with its gate.
- The ledger K22 reads 9/9.
