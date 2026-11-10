# PRD-PX-DEFECTS: Verified defects owned by this session (X2, X3; X9 routed to P13)

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-PX-DEFECTS |
| Version | 1.0, 2026-11-10 |
| Status | X2 IMPLEMENTED (v3.35.10, gate running). X3 approved, Wave 1. X9 tracked in PRD-P13. |
| Priority | Wave 1 (defects ahead of features) |
| Source | Addendum X2, X3, X9 (LTC session), re-verified here |
| Modules | `js/rz-scenario.js`, `tia-942-checklist.html` |
| Approval | Directive; defect fixes are non-disruptive |

## 2. Executive summary
Two verified defects make visible controls fail:
- **X2:** Open on a saved scenario reached a 404 page for 5 calculators.
- **X3:** The theme button on the TIA-942 checklist does nothing and throws an error.

Both are fixed with gates that fail on the old code.

## 3. Problem statement
- **X2.** `js/rz-scenario.js:85` built `<id>-calculator.html` for ids outside 5 known ones. Measured by `test-scenario-open-routes.mjs` on v3.35.9: carbon, rfs, spares, tia, tier went to wrong pages, and unknown ids navigated.
- **X3.** `tia-942-checklist.html:197` calls `toggleCalcTheme()`. None of the page's 7 scripts defines it; 7 other calculators each define it inline. The page also has no theme initialisation, so it ignores the saved `theme` preference. Clicking throws `ReferenceError: toggleCalcTheme is not defined`. Dark mode is unreachable, although `css/rz-tool.css` already carries 81 `[data-theme="dark"]` rules.
- **X9.** The spares calculator parses query parameters that no page sends. This is a missing sender, not a broken control, so it is handled in PRD-P13.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Open routes correct | correct routes | 11/11 |
| Unknown ids do not navigate | stray navigations | 0 |
| tia theme works | click toggles `data-theme`, persists in `localStorage.theme`, survives reload | yes |
| tia console clean | pageerror count on click | 0 |
| Saved preference honoured | dark preference set on another calculator → tia loads dark | yes |

## 5. Scope
- **In:** the route map (done); theme init and toggle on tia.
- **Out:** consolidating the 7 duplicated inline toggles into one module. That is a refactor, and it is listed as an improvement candidate in the tracker.
- **Reuse:** the exact `toggleCalcTheme` and head-init snippets from `capex-calculator.html:232` and `:3416`, so behaviour is identical across pages.

## 6. Personas
Any visitor on these pages.

## 7. User journey
**X3:**
1. The visitor opens tia. The page renders in the saved theme, light by default.
2. The visitor clicks the moon icon. The page switches to dark and the icon changes to a sun.
3. The visitor reloads. The page is still dark.
4. Failure: localStorage is blocked. The toggle still works for the session, and the error is caught.

## 8. Functional requirements
| ID | Description | Acceptance |
|---|---|---|
| FR-PX-1 | Explicit route per `data-rz-calc` page; unknown ids are a no-op | `test-scenario-open-routes.mjs` GREEN |
| FR-PX-2 | tia head script sets `data-theme` from `localStorage.theme`, default light, before first paint | headless: with `localStorage.theme='dark'`, `documentElement.dataset.theme === 'dark'` at DOMContentLoaded |
| FR-PX-3 | `toggleCalcTheme()` defined on tia: flips the theme, persists it, updates the icon; localStorage access wrapped in try/catch | click flips the theme; 0 pageerror |
| FR-PX-4 | Gate: every `onclick="fn()"` on the 11 calculators resolves to a function defined after load | new `test-calc-onclick-handlers.mjs` RED on tia today |

## 9. UI/UX specification
- No new controls.
- The existing button becomes functional.
- Icon states: `fa-moon` (light) and `fa-sun` (dark).
- Both themes must pass the existing a11y audit for tia, which is added to the audit-a11y page list in dark too.

## 10. Data model
`localStorage.theme`: `'light'` or `'dark'`. Already used site-wide.

## 11. API contracts
None.

## 12. Business rules
- Theme preference is global across pages (same key).
- A control whose handler is undefined is a defect, and the gate fails on it.

## 13. Cross-module integration
- The theme is shared with every page reading `localStorage.theme`.
- PDF export on tia prints its own light document and is unaffected.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
- No flash of the wrong theme: the init script runs in `<head>` before the stylesheet paints.
- Contrast is AA in dark. Verified by `audit-a11y` with dark mode on tia.

## 16. Security
None. No new input.

## 17. Edge cases
- localStorage throws (Safari private): try/catch, so the theme falls back to light.
- An unexpected value, e.g. `'rainbow'` from the index page's third theme: anything other than `'dark'` renders light here. Same as the other calculators.

## 18. Technical architecture
Inline snippets, copied verbatim from the reference page; no new module. The onclick gate is a Puppeteer walker over `[onclick]` attributes that checks `typeof window[name] === 'function'` for simple `name(...)` handlers.

## 19. Implementation breakdown
| Task | Files | Effort | Verify |
|---|---|---|---|
| T-PX-1 X2 route map + gate | rz-scenario.js, tools/test-scenario-open-routes.mjs | done | RED→GREEN shown |
| T-PX-2 onclick gate (RED first) | tools/test-calc-onclick-handlers.mjs, ship-gate.sh | 0.25 d | RED on tia |
| T-PX-3 tia init + toggle | tia-942-checklist.html | 0.1 d | gate GREEN, screenshot dark/light |
| T-PX-4 a11y dark check on tia | tools/audit-a11y.mjs page list | 0.1 d | green |

## 20. Test strategy
- **Unit:** the route gate.
- **E2E:** the onclick gate; a theme persistence test on tia.
- **Accessibility:** axe in both themes.
- **Regression:** the full ship gate.

## 21. Acceptance criteria
- **Given** tia in light, **when** the theme button is clicked, **then** `data-theme` is `dark`, `localStorage.theme` is `dark`, and no error is logged.
- **Given** `localStorage.theme='dark'`, **when** tia loads, **then** it renders dark before first paint.
- **Given** any of the 11 calculators, **when** the onclick gate runs, **then** every simple handler resolves.

## 22. Rollout
Normal release. Rollback by revert.

## 23. Risks
- Dark styles on tia may have contrast gaps never seen before, because dark mode was unreachable. Mitigated by the axe run in dark; any finding is fixed in the same release.

## 24. Definition of done
- Both gates are green in the ship gate.
- Screenshots in both themes reviewed.
- a11y passes in dark.
- The change is live and verified.
