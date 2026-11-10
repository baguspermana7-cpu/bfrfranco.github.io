# PRD-P07: "What drives this result" on every calculator, with a correctness check

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P07 |
| Version | 1.1, 2026-11-10 (review revision: failure handling added) |
| Status | Approved (directive) |
| Priority | Wave 2. The audit rank was 4 (70.5); the scope was narrowed after re-baseline. |
| Re-baseline | The audit claimed no calculator had sensitivity. The re-check found tornado/sensitivity on 8 of 11 (capex, opex, tco, roi, carbon, cx, spares, tier). Missing on pue, tia and rfs. No gate checks that the existing tornados are correct. |
| Modules | pue-calculator.html, tia-942-checklist.html, rfs-readiness-workbench.html; tco/roi/capex/opex/carbon (gate only); new `js/rz-sensitivity.js` |

## 2. Executive summary
Eight calculators already rank their inputs by influence. This PRD does two things:
- It adds the same panel to the three that lack it.
- It adds a gate that proves every tornado bar equals an actual recomputation, so a bar cannot drift from the model it claims to describe.

## 3. Problem statement
- **Missing panels.** pue, tia and rfs show a result with no indication of which input matters.
- **No proof.** Each existing tornado is page code that perturbs its own copy of inputs. Example: `tco-calculator.html:2080 renderTornado()` with 8 factors (power, construction, PUE, utilisation, colo, cloud discount, staff, growth). Nothing proves the bars equal what the calculator would show if the user moved that input by the same amount. A tornado that re-implements part of the model can disagree with the model silently.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Coverage | calculators with a sensitivity panel | 11/11. For tia and rfs, "sensitivity" means "which unmet items move the score most", because their output is a score, not a cost. |
| Correctness | for each tornado factor, the bar value equals the headline result after setting that input to base ×(1±δ) through the UI path | within display rounding, on 8 + 3 pages |

## 5. Scope
**In scope:**
- A shared `rz-sensitivity.js` for the 3 new panels. It perturbs inputs through the UI path (set field, fire events, read result) in a hidden iframe (P03 loop), so it cannot diverge from the page model.
- A correctness gate for the 8 existing tornados.
- Fixes for any tornado the gate finds wrong.

**Out of scope:**
- Rewriting the 8 existing tornados to the shared module. That is only done if the gate fails for one of them.
- Two-way interaction effects.

**Reuse:** the P03/P04 `rz-embed-compute.js` iframe loop; the existing tornado chart styles.

**Constraints:** compute cost. An iframe perturbation loop is slow (about 1.5 s per run), so the new panels compute on demand ("Compute sensitivity" button), not on every keystroke.

**Assumption:** δ = ±10 % for continuous inputs. For selects and steps it is the adjacent option.

## 6. Personas
- **Engineer:** which input to refine first.
- **Reviewer:** is the tornado trustworthy.

## 7. User journey
1. On pue, the user opens the "What drives this result" panel. It is collapsed by default.
2. The panel shows a button **Compute sensitivity** and the text "Moves each input ±10 % and recomputes this page. About 15 s for 8 inputs".
3. Progress: "3 of 8".
4. Result: a horizontal bar chart ranked by swing. Each bar is labelled with the low and high result values. Clicking a bar focuses its input.
5. Failure: an input that breaks computation at ±10 % (out of range) is clamped to the field min/max, and the bar label says "clamped".

## 8. Functional requirements
| ID | Description | Acceptance |
|---|---|---|
| FR-P07-1 | Factor declaration per page in `data/sensitivity-factors.json` (field, kind: continuous / step, result selector) | gate: fields exist |
| FR-P07-2 | UI-path perturbation via the iframe loop | unit with a fixture page whose result = 2·x → swing exact |
| FR-P07-3 | Panels on pue, tia, rfs | E2E |
| FR-P07-4 | Correctness gate for the 8 existing tornados: for each factor, compare the page's bar value against the UI-path recompute | gate; any mismatch fixed at the page or reported |
| FR-P07-5 | Bar click focuses the input (scrollIntoView + focus) | E2E |
| FR-P07-6 | Failure handling: a perturbation whose iframe does not settle within 10 s, or whose result is not a finite number, is recorded as `failed` with the reason. The bar is drawn hatched with "could not compute", the other bars still render, and the run never aborts as a whole. | E2E with a stalled fixture |
| FR-P07-7 | Cancel stops after the current perturbation; the partial bars are shown with "partial: n of m". | E2E |

## 9. UI/UX specification
- A collapsible section titled "What drives this result", using the native `<details>` element (keyboard-accessible by default).
- **Chart.** SVG bars from the centre baseline. Neutral colours, except low/high carried by two tones from the page tokens. Mono value labels.
- **Button.** Secondary. While running, its label reads "Computing… 3/8" and a Cancel text button appears.
- At 390 px the bars stack, with labels above them.

## 10. Data model
`data/sensitivity-factors.json` only. No storage.

## 11. API contracts
Internal: `rzSensitivity.run(calc, factors, {delta}) → Promise<[{field, low, high, base, clamped}]>`.

## 12. Business rules
- Bars are sorted by |high − low|.
- Ties are ordered by the declaration order.
- A factor with zero swing is shown with "no effect at this point" (it is not hidden), because the information is real.

## 13. Cross-module integration
- P01: the panel runs on the current page state, project-applied or not.
- P04: the pack may include the panel if it has been computed.
- P03: shares the iframe loop.

**Phase 3 amendment C1:** the per-page map this PRD defines lives in the shared calculator registry `data/calculators.json` (task F1), not in a separate file. The gate is `test-calculator-registry.mjs`. See 03-architecture/ARCHITECTURE-P.md.
**Phase 3 amendment C2:** the hidden-iframe compute loop is the shared `js/rz-embed-compute.js` (task F2). It is driven by `?embed=<mode>`.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
- About 1.5 s per perturbation (assumption, measured). Each run is cancellable.
- AA contrast on the bars.

## 16. Security
Same-origin only. Not security-relevant.

## 17. Edge cases
- A select input has only one option: skipped and listed.
- The result is non-numeric (tia grade): the score is used numerically; letter grades are mapped by a declared order.

## 18. Technical architecture
Page → `rz-sensitivity.js` → `rz-embed-compute.js` (iframe, set field, settle, read) → bars.

## 19. Implementation breakdown
| Task | Files | Effort | Verify |
|---|---|---|---|
| T-P07-1 Factors JSON + gate | data/, tools/test-sensitivity-factors.mjs | 0.5 d | gate |
| T-P07-2 rz-sensitivity.js | js/ | 0.75 d | unit fixture |
| T-P07-3 3 panels | 3 pages | 0.75 d | E2E + screenshots |
| T-P07-4 Correctness gate on the 8 existing | tools/test-tornado-correctness.mjs | 1 d | gate; fixes logged |

## 20. Test strategy
- **Unit:** fixture page.
- **Gate:** correctness on 8 pages.
- **E2E:** 3 panels.
- **Accessibility:** axe on `<details>` and the chart (`role=img` + table fallback listing values).
- **Regression:** the calculator gates.

## 21. Acceptance criteria
- **Given** pue at defaults, **when** Compute sensitivity runs, **then** each bar's low and high equal the result after setting that input to −10 % and +10 % on the page.
- **Given** the tco tornado, **then** every bar is within display rounding of the UI-path recompute.
- **Given** a factor whose perturbation stalls, **when** the run completes, **then** that bar reads "could not compute" and the rest are ranked normally.
- **Given** the user cancels at 3 of 8, **then** three bars are shown with "partial: 3 of 8".

## 22. Rollout
Additive. Rollback by revert.

## 23. Risks
| Risk | Mitigation |
|---|---|
| The correctness gate finds an existing tornado wrong | That is the point; fix in the same release and record the finding in the changelog |
| Slow runs | On-demand + cancel |

## 24. Definition of done
- 11/11 calculators have a panel.
- The correctness gate is green on 8 pages.
- Screenshots reviewed.
- Docs are updated.
- The change is live and verified.
