# PRD-P22: A render gate for the type, spacing and radius scale (UIUX A)

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P22 |
| Version | 1.0, 2026-11-10 |
| Status | Approved (directive) |
| Priority | Wave 5 (hardening) |
| Modules | new `tools/audit-editorial-render.mjs`; `documentation/design.md` scale tables; `ship-gate.sh` |

## 2. Executive summary
The design system defines a scale for font sizes, spacing and corner radii. No tool checks that rendered pages use it.

Off-scale values are a recurring source of the "AI design slop" findings the owner has raised. They have been caught by eye, not by a gate.

This PRD adds a render gate. It measures computed styles on rendered pages and flags values off the scale.

## 3. Problem statement
- UIUX audit item A is open: `audit-editorial-render.mjs` does not exist.
- B4 (2026-09) measured 30 distinct rem spacings in `styles-index.css`, 16 of them off any 0.25 rem grid. That was a source measurement; there is no render measurement.
- Existing gates check radius and shadow in source (audit-vibecode). Computed values (after cascade and inheritance) are not checked.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Baseline | per-page count of off-scale computed values on text and container elements | recorded for all root pages (MONITOR) |
| Ratchet | the count per page may not rise | gate STRICT on the ratchet from day one |
| Accuracy | a planted off-scale element is reported; a scale element is not | fixture gate |

## 5. Scope
- **In:**
  - Scale definition, extracted from design.md tokens into `data/design-scale.json`.
  - A Puppeteer walker over visible elements collecting font-size, line-height, margin, padding, gap and border-radius.
  - Tolerance of 0.5 px.
  - Per-page counts.
  - A ratchet file.
  - A fixture.
- **Out:** auto-fixing pages. The ratchet makes counts fall over time.

## 6. Personas
Maintainer. Owner.

## 7. User journey
None at runtime. In CI: a page that adds off-scale values fails, with the selector and value printed.

## 8. Functional requirements
| ID | Description | Acceptance |
|---|---|---|
| FR-P22-1 | `data/design-scale.json`: font sizes, spacing steps, radii (from design.md §4/§5) | schema check |
| FR-P22-2 | Walker: visible elements only (non-zero box, not `display:none`), excluding SVG internals and third-party iframes | fixture |
| FR-P22-3 | Ratchet `tools/editorial-render-ratchet.json` per page | gate |
| FR-P22-4 | `--measure` mode prints the top 10 offenders per page | — |

## 9. UI/UX specification
None. CLI output follows the existing gates' style.

## 10. Data model
Two JSON files.

## 11. API contracts
CLI: `node tools/audit-editorial-render.mjs [--measure|--strict] [--page=x]`.

## 12. Business rules
- Counts may only fall.
- A ratchet increase needs an explicit owner-approved exemption entry with a reason.

## 13. Cross-module integration
- Uses the browser lane (rz-lane), so it is serialized with the other render gates.
- It runs once per release in `ship-gate.sh`.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
Runtime for about 180 pages at 1 viewport: about 6 minutes (estimate from similar walkers). Measured; if longer, the gate splits into page shards.

## 16. Security
None.

## 17. Edge cases
- Fluid typography (`clamp`): computed px at 1440 is checked against the scale at that viewport, with tolerance.
- Icons fonts: excluded by class.

## 18. Technical architecture
Puppeteer walker → counts → ratchet compare.

## 19. Implementation breakdown
| Task | Effort | Verify |
|---|---|---|
| Scale JSON | 0.25 d | — |
| Walker + fixture | 1 d | fixture RED/GREEN |
| Baseline + ratchet + wiring | 0.5 d | gate |

## 20. Test strategy
- Fixture page with 3 planted off-scale elements: exactly 3 reported.
- Run on 5 representative pages and review the false positives by hand (memory: render-audit false positives) before trusting the baseline.

## 21. Acceptance criteria
- **Given** a fixture with a 13.37 px font, **then** it is reported.
- **Given** the current tree, **then** the gate passes, and adding one off-scale element to any page fails it.

## 22. Rollout
- MONITOR + ratchet in one release.
- Rollback by removing the gate line.

## 23. Risks
- False positives. Mitigated by the manual review of 5 pages before freezing the baseline.

## 24. Definition of done
- Fixture is green.
- The baseline is reviewed and frozen.
- The gate is wired.
- The ledger row is updated.
