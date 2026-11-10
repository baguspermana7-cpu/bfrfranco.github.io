# PRD-P10: Click any calculator result to see its basis

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P10 |
| Version | 1.0, 2026-11-10 |
| Status | Approved (directive) for **stage 1**: a results-level basis on the 6 project calculators. Stage 2 (all 11, every numeral) is planned work and is not started. |
| Priority | Wave 4 (rank 8, priority 65.0) |
| Dependencies | None technically. P01 adds "value from project" provenance. |
| Modules | `js/rz-basis-drawer.js` (configurable registry since v2.0.0: `data-rz-registry` / `window.RZBasisDrawerRegistry`), new `tools/build-calc-parameter-registry.mjs`, new `data/calc-parameters.{json,curated.json,schema.json}`, new `js/calc-parameters.js` twin, 6 calculators |
| Approval | Directive |

## 2. Executive summary
The cockpits let a user click a number and see:
- the formula;
- the inputs;
- the evidence class;
- the source standard.

That traceability is the site's distinguishing rule (ACCURACY_VALIDATION). The 11 calculators have none of it: zero `data-basis-param` hooks.

This PRD brings the same drawer to the calculators' headline results. It uses a registry generated from the shared engine and the pages' own declared formulas. The generator and coverage pattern are the ones that took the Conventional cockpits from 24 % to 100 % traced.

## 3. Problem statement (measured)
- `data-basis-param` count on all 11 calculators: 0.
- `data-rz-authored-basis` (the declared-exception attribute) on capex/tco: 0.
- Registry builders exist for conv and dcai (`tools/build-conv-parameter-registry.mjs`, `build-dcai-parameter-registry.mjs`). Their schemas are in `data/*-parameters.schema.json`. None exists for `rz-engine.js` (30 models).
- Consequence: a reader cannot check how a TCO or carbon number was derived without reading the page source.

## 4. Objectives and success metrics
| Objective | Metric | Target (stage 1) |
|---|---|---|
| Headline results traceable | headline result cells hooked to a registry record that resolves | 100 % on capex, opex, tco, roi, carbon, pue (list per page in §8) |
| Record parity | the registry value equals the rendered value at defaults | 100 % (parity gate, same rule as conv R-gates) |
| Every record complete | formula, inputs, evidence class, source | schema gate 100 % |

## 5. Scope
**In scope, stage 1:**
- Registry for the headline outputs of 6 calculators, roughly 8–12 each, about 60 records.
- Hooks on those cells.
- The drawer is loaded on the 6 pages.
- A coverage gate, reported for **headline results only**, labelled as such.

**Out of scope, stage 1:** every numeral (tables, charts) and the other 5 calculators. Both are stage 2, which needs its own measurement.

**Reuse:**
- The drawer: modal in HTML context, inspector in SVG.
- The registry schema shape: id, value, unit, evidence class, formula, inputs, source, curated note.
- The generator approach: resolve the value by running the engine/page at defaults.

**Constraints:**
- Evidence vocabulary = the ten-term taxonomy in ACCURACY_VALIDATION Rule 6.
- No invented sources. A record without a citable source is classed ASSUMED and says so.

**Assumption:** the headline values are computed by `rz-engine.js` models callable in Node (engine is an IIFE; tests already load it in vm). Verified per model in T-P10-1.

## 6. Personas
- **Reviewer** checks a TCO.
- **Student** learns the method.

## 7. User journey
1. A headline result shows a small evidence dot (the existing mark style).
2. Clicking it, or pressing Enter when focused, opens the basis drawer: value, unit, formula in plain notation, the inputs with their current values (read live from the page), evidence class with its note, source, and "computed by rz-engine models.tco.<fn>".
3. Esc closes and focus returns.
4. **Failure.** Registry missing: the hook is inert and the dot is hidden. The coverage gate catches this.

## 8. Functional requirements
| ID | Description | Acceptance |
|---|---|---|
| FR-P10-1 | Generator builds `data/calc-parameters.json` from the engine at defaults + curated formula/source notes (`calc-parameters.curated.json`) | build + schema gate |
| FR-P10-2 | Twin `js/calc-parameters.js` (window global) | freshness gate |
| FR-P10-3 | Hooks on headline cells: capex total + 6 cost blocks; opex annual + 5 components; tco total + 3 options; roi NPV, IRR, payback, DSCR; carbon annual tCO2e, scope 2, intensity; pue annual PUE, DCiE, partial-load PUE | coverage gate (headline list per page, declared) |
| FR-P10-4 | Parity: rendered text equals registry value at defaults (format-aware) | parity gate |
| FR-P10-5 | Live inputs in the drawer read from the DOM at open time | E2E |
| FR-P10-6 | Drawer loaded with `data-rz-registry="RZ_CALC_PARAMETERS"` | E2E |

## 9. UI/UX specification
- **Evidence mark.** The existing basis mark: 6 px dot in the evidence colour beside the value, `tabindex=0 role=button`, with an `aria-label` like "Basis for Total CAPEX".
- **Drawer.** The existing modal. Its rows are unchanged; a new row "Inputs now" shows the live values.
- Keyboard and focus behave as in the existing drawer (already a11y-gated).
- Both themes.

## 10. Data model
`calc-parameters.json` record:
```
{id: 'calc.tco.total_usd', calc: 'tco', label, value, unit, evidence: 'DERIVED' | ..., formula, inputs: [field ids], engine_fn, source, note}
```
The schema file is new, modelled on `conv-parameters.schema.json`. No database.

## 11. API contracts
None over the network. The drawer API is unchanged.

## 12. Business rules
- A hooked value without a resolving record fails the gate.
- Values at non-default inputs are not in the registry; the drawer shows the live value plus the formula.

## 13. Cross-module integration
| Module | Effect |
|---|---|
| P01 | Inputs that came from the project are labelled in the "Inputs now" row |
| P04 | The pack appendix can list the records |
| P07 | Sensitivity factors can link to records |

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
- The registry twin is about 30 KB (estimate) and deferred.
- The drawer opens in under 100 ms (existing).

## 16. Security
Static data. The drawer renders text via its existing escaping.

## 17. Edge cases
- A page recomputes while the drawer is open: the inputs row refreshes on the next open (no live binding).
- Formatting (M, k): the parity gate uses the page's own formatter rules, declared per record.

## 18. Technical architecture
engine (vm) → generator → registry JSON + twin → drawer; pages carry hooks → gates (schema, parity, coverage).

## 19. Implementation breakdown
| Task | Files | Effort | Verify |
|---|---|---|---|
| T-P10-1 Engine-at-defaults extraction per page | tools/build-calc-parameter-registry.mjs | 1.5 d | unit |
| T-P10-2 Curated notes (formulas, sources) | data/calc-parameters.curated.json | 1.5 d | schema gate |
| T-P10-3 Hooks + drawer tag on 6 pages | 6 pages | 1 d | coverage gate RED→GREEN |
| T-P10-4 Parity gate | tools/test-calc-parameter-registry.mjs | 0.5 d | gate |
| T-P10-5 Docs: ACCURACY_VALIDATION calculator rule | standarization | 0.25 d | — |

## 20. Test strategy
- **Schema gate:** schema-valid, and the twin equals the JSON.
- **Parity gate.**
- **Coverage gate:** headline lists.
- **E2E:** open the drawer from 1 result per page; keyboard path.
- **Accessibility:** axe.
- **Regression:** the conv drawer gates are unchanged (default registry).

## 21. Acceptance criteria
- **Given** the tco page at defaults, **when** the total is clicked, **then** the drawer shows a value equal to the rendered total, the formula, and the engine function name.
- **Given** a hooked id with no record, **then** the coverage gate fails.

## 22. Rollout
Additive. Rollback by revert.

## 23. Risks
| Risk | Mitigation |
|---|---|
| Page-side arithmetic not in the engine (the result is computed inline) | The record says `engine_fn: null`, with the page function named. This is a finding for P-later consolidation (LTC Q4 "one engine path per metric"). It is not hidden. |
| Effort above estimate | Stage 1 is limited to headline results |

## 24. Definition of done
- Stage 1 FRs are implemented.
- The schema, parity and coverage (headline) gates are green.
- Screenshots of the drawer from a calculator are reviewed.
- Docs are updated.
- The change is live and verified.
- Stage 2 is listed as NOT STARTED in the tracker.
