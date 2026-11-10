# PRD-P17: Field help that opens the right manual section

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P17 |
| Version | 1.0, 2026-11-10 |
| Status | Approved (directive) |
| Priority | Wave 3 |
| Dependencies | K26 manual contents rail (v3.35.9). It already assigns slug ids to the manual h2 headings. |
| Modules | 11 calculators; manual/{capex,opex,tco,roi,pue,carbon,cx,spares,tier,tia-942-checklist,rfs}.html; new `data/manual-links.json`; `js/rz-manual-toc.js` |

## 2. Executive summary
Every calculator has a manual (11 of 11 exist under `manual/`), but no field links to it.

This PRD adds a small "?" link beside each major input group that opens the matching manual section. The manual gets a "Back to calculator" link that returns to the field.

## 3. Problem statement
- Manuals exist for all 11 calculators.
- There are no field-level links into them, and no section-level link back.
- The K26 rail made sections addressable (slug ids), but nothing uses those ids from the calculators.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Linked groups | input groups (fieldsets / section headings) with a help link | ≥ 1 per input section on all 11 pages; the list is declared in `data/manual-links.json` |
| Links resolve | every link target id exists in the manual | 100 % (gate) |
| Return path | the manual shows "Back to <calculator> · <field group>" when opened from a link | E2E |

## 5. Scope
- **In:** the link map; injected help links; return links; a gate.
- **Out:** rewriting manual content; tooltips with excerpts (a possible later phase).

## 6. Personas
New user. Student.

## 7. User journey
1. The user clicks "?" beside "Power & cooling".
2. `manual/tco.html?from=tco-calculator.html%23grpPower#power-and-cooling` opens (query before the hash, see §11).
3. The section is highlighted for 2 s (no highlight under reduced motion).
4. A banner at the top reads "Back to TCO calculator · Power & cooling".

## 8. Functional requirements
| ID | Description | Acceptance |
|---|---|---|
| FR-P17-1 | `data/manual-links.json`: `{calc, group_selector, manual, anchor, label}` | gate: anchors exist |
| FR-P17-2 | Injector adds `<a class="rz-help-link" aria-label="Help: <label>">?</a>` after the group heading | E2E |
| FR-P17-3 | Manual reads `from` (same-origin `.html` path only), shows the return banner | E2E |
| FR-P17-4 | Gate over the map: calculator selector exists, manual anchor exists | gate |

## 9. UI/UX specification
- **Help link.** 20 px circle-free glyph "?" in mono, hairline square 4 px radius, 44 px touch target via padding. Visible focus ring. Tooltip via `title`.
- **Return banner.** Hairline row under the manual header with a text link. Dismissible.
- Both themes.

## 10. Data model
JSON map. No storage.

## 11. API contracts
URL: `manual/<x>.html?from=<path>#<anchor>`. The query precedes the hash so that the browser can scroll natively. `from` is validated with `/^[a-z0-9-]+\.html(#[A-Za-z0-9_-]+)?$/`.

## 12. Business rules
- A help link exists only where its target exists (enforced by the gate).

## 13. Cross-module integration
- P14: palette action "Open manual for this calculator".
- K26: anchors.

**Phase 3 amendment C1:** the per-page map this PRD defines lives in the shared calculator registry `data/calculators.json` (task F1), not in a separate file. The gate is `test-calculator-registry.mjs`. See 03-architecture/ARCHITECTURE-P.md.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
Negligible weight. AA contrast.

## 16. Security
`from` is validated, so there is no open redirect.

## 17. Edge cases
- Heading renamed in the manual: the slug changes and the gate fails.
- Manual missing a matching section: that group gets no link, and the gap is listed in the register.

## 18. Technical architecture
map → injector (in `rz-scenario.js` or a small `rz-help-links.js`) → manual return banner (in `rz-manual-toc.js`).

## 19. Implementation breakdown
| Task | Effort | Verify |
|---|---|---|
| Map for 11 calculators (manual section audit) | 1 d | gate |
| Injector + styles | 0.5 d | E2E |
| Return banner | 0.25 d | E2E |
| Gate | 0.25 d | RED on a planted bad anchor |

## 20. Test strategy
Gate; E2E click → manual scrolled with the anchor in view; axe.

## 21. Acceptance criteria
- **Given** tco, **when** the user clicks "?" on Power & cooling, **then** the manual opens with that section's heading within 64 px of the top and a working Back link.

## 22. Rollout
Additive. Rollback by revert.

## 23. Risks
- Manuals with few sections give coarse links. Accepted; listed per page.

## 24. Definition of done
- Gate is green.
- E2E is green.
- Screenshots reviewed.
- The change is live and verified.
