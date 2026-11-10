# PRD-P16: Engine version declared once

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P16 |
| Version | 1.0, 2026-11-10 |
| Status | Approved (directive). Low priority after the re-baseline. |
| Priority | Wave 5 (hardening). The audit rank was 6; the value was downgraded because the outage class is already gated. |
| Modules | 8 Conventional cockpits (`CONV_CURRENT_ENGINE_VERSION`), datahallAI (`DATAHALL_CURRENT_ASSET_VERSION`), `tools/test-conv-engine-version-pins.mjs`, new `js/rz-engine-versions.js` |

## 2. Executive summary
Every cockpit writes the engine version it trusts twice: once as a constant and once as a `?v=` token.

A bump today needs 16 edits across 8 files for conv, plus 2 for datahallAI. The existing gate makes a missed edit fail the build rather than blank the site.

This PRD moves the trusted version into one generated module. A bump then becomes one edit, and the gate keeps proving agreement.

## 3. Problem statement (measured)
- `CONV_CURRENT_ENGINE_VERSION = '2.2.0'` is hardcoded in chiller-plant.html:918 and the 7 sibling cockpits.
- `conv-engine.js?v=2.2.0` appears on the same 8 pages.
- `DATAHALL_CURRENT_ASSET_VERSION='1.6.0'` is hardcoded in datahallAI.html:1445.
- Mitigation that exists: `test-conv-engine-version-pins.mjs` V1–V3, added after v1.134.23 blanked every cockpit.
- Residual cost: a repetitive multi-file edit on every engine bump, which is the class of mechanical change that collides with parallel sessions.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Single declaration | places a release must edit to bump conv | 1 (the engine) + the regenerated module |
| Pages agree | V1–V3 still pass; the pages read the version from the module | gate green |
| Fail closed kept | removing the module blanks to UNAVAILABLE (not to numbers) | gate |

## 5. Scope
- **In:**
  - A generator `tools/build-engine-versions.py` reads `meta.version` from conv-engine.js and dcai-engine.js and writes `js/rz-engine-versions.js` (`window.RZ_ENGINE_VERSIONS = {conv: '2.2.0', dcai: '1.6.0'}`).
  - Pages read from it.
  - Script `?v=` tokens are handled by the existing `test-asset-cache-tokens.mjs --fix` flow.
  - The freshness gate is extended.
- **Out:** engine API changes.

## 6. Personas
Maintainer.

## 7. User journey
Release engineer bumps the engine → runs the generators (already part of the release steps) → gates pass. End users see no change.

## 8. Functional requirements
| ID | Description | Acceptance |
|---|---|---|
| FR-P16-1 | Generator + freshness entry | freshness RED if stale |
| FR-P16-2 | Pages use `RZ_ENGINE_VERSIONS.conv` in place of the literal | static scan: 0 literals |
| FR-P16-3 | Module missing → authority false → UNAVAILABLE screen | gate (fixture removes the module) |
| FR-P16-4 | V1–V3 gate reads the module | gate green |

## 9. UI/UX specification
No UI.

## 10. Data model
One generated JS file.

## 11. API contracts
`window.RZ_ENGINE_VERSIONS`.

## 12. Business rules
The pin equals the engine's `meta.version`, always generated, never typed.

## 13. Cross-module integration
- The release steps list gains one generator.
- `ship-gate.sh` is unchanged except the freshness entry.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
One extra small script per cockpit, under 1 KB.

## 16. Security
None.

## 17. Edge cases
- Module loaded after the page script: the tag order is enforced by a gate (the module precedes the engine).

## 18. Technical architecture
engines → generator → module → pages.

## 19. Implementation breakdown
| Task | Effort | Verify |
|---|---|---|
| Generator + freshness | 0.25 d | RED/GREEN |
| 9 page edits (mechanical) | 0.25 d | static scan |
| Fail-closed fixture | 0.25 d | gate |

## 20. Test strategy
Freshness; static scan; fail-closed fixture; the existing cockpit gates.

## 21. Acceptance criteria
- **Given** the conv engine bumped to 2.3.0 and the generator run, **then** all 8 cockpits render without any other edit.

## 22. Rollout
- One release.
- Rollback by revert.

## 23. Risks
The edit touches 8 Conventional cockpits; it is mechanical, and those cockpits have strict gates.

## 24. Definition of done
- Gates are green.
- A bump rehearsal is done in a worktree: change the engine version, run the generator, all gates pass.
- The change is live.
