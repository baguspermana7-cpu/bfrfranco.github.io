# PRD-P20: Embeddable calculators

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P20 |
| Version | 1.1, 2026-11-10 (review revision: UI states, acceptance) |
| Status | **Part A** (embeds on the site's own article pages, same origin) approved under the directive. **Part B** (third-party sites embedding the calculators) needs owner approval: it changes the framing policy, a security boundary, and makes the site a public widget host. BLOCKED. |
| Priority | Wave 4 |
| Dependencies | P03 embed flag pattern (`?embed=`) |

## 2. Executive summary
31 articles discuss quantities that a calculator computes, but the reader has to leave the article to try them.

Part A lets an article embed a compact calculator view (inputs + headline result) in an iframe on the same site, sized automatically.

## 3. Problem statement
- Calculators exist only as full pages.
- Articles link out (for example to `spares-readiness-calculator.html`, 5 linking pages measured).
- Embedding is not possible without a compact mode.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Compact mode | `?embed=article` renders only the declared inputs and the result, with no nav/footer/pill/cookie banner | 11 calculators |
| Sizing | the parent iframe height matches the content (postMessage) with no inner scroll | E2E at 360/768/1280 |
| Isolation | a cross-origin parent cannot frame the page (Part A keeps the current policy) | header check documented (GitHub Pages cannot set headers; `frame-ancestors` via meta is not supported, so the JS frame-buster checks the parent origin) |

## 5. Scope
- **A, in:** embed mode, an `rz-embed` include snippet for articles, and auto-height.
- **B (blocked):** third-party embed policy.
- **Out:** a widget builder UI.

## 6–7. Personas and journey
- **Reader:** in article-12 there is a "Try it" box; changing the IT load updates the PUE result inline; "Open full calculator" carries the inputs via a P02 link.

## 8. Functional requirements
| ID | Description |
|---|---|
| FR-P20-1 | `data-rz-embed-keep` marks the elements kept in embed mode, declared per page |
| FR-P20-2 | Embed CSS hides everything else |
| FR-P20-3 | Auto-height: a ResizeObserver posts `{type: 'rz-embed-size', h}` to the parent; the parent script validates the same origin |
| FR-P20-4 | "Open full calculator" = a P02 link |
| FR-P20-5 | Frame guard: if `top.location.origin` is not same-origin, the page breaks out (Part A policy) |

## 9. UI/UX specification
- **Embedded box:** a hairline frame, a title ("Try it: PUE calculator"), the declared inputs, the headline result, and the link "Open full calculator".
- **Loading:** reserved min-height, plus the text "Loading calculator…" until the first size message.
- **Error:** if the iframe has not sent a size message within 8 s, the box is replaced by a plain link to the calculator with "The interactive version could not load."
- **Mobile:** full width; inputs stack.
- **Keyboard:** the iframe has a `title` attribute; focus moves into it with Tab; the link is reachable.
- **Both themes:** the embed reads the parent's `localStorage.theme` (same origin) on load.

## 10–11. Data model / API
None. postMessage contract as in FR-P20-3.

## 12. Business rules
Only same-origin parents.

## 13. Cross-module integration
P02, P14 (no palette in embed mode), P25 (cached).

**Phase 3 amendment C1:** the per-page map this PRD defines lives in the shared calculator registry `data/calculators.json` (task F1), not in a separate file. The gate is `test-calculator-registry.mjs`. See 03-architecture/ARCHITECTURE-P.md.
**Phase 3 amendment C2:** the hidden-iframe compute loop is the shared `js/rz-embed-compute.js` (task F2). It is driven by `?embed=<mode>`.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
The embed adds one iframe, lazy-loaded with `loading=lazy`.

## 16. Security
- Origin check on messages.
- Frame guard.

## 17. Edge cases
JS disabled: the iframe shows a link fallback.

## 18. Technical architecture
article → rz-embed.js → iframe(calc?embed=article) → postMessage size.

## 19. Implementation breakdown
Embed mode on 11 pages 2 d · snippet + auto-height 0.5 d · 3 article adoptions 0.5 d · gates 0.5 d.

## 20. Test strategy
- E2E: height, no inner scroll, result updates.
- Security: a cross-origin parent fixture is blocked.

## 21. Acceptance criteria
- **Given** article-12 with an embed, **then** changing the input updates the result and the iframe has no scrollbar at 360 px.
- **Given** the embed page opened inside a cross-origin parent fixture, **then** the page navigates the top window to the full calculator (frame guard) and posts no message.
- **Given** the iframe never reports a size, **then** after 8 s the box shows the fallback link.
- **Given** "Open full calculator" is clicked, **then** the full page opens with the same inputs (P02 link).

## 22. Rollout
A: one release. B: after approval.

## 23. Risks
- Layout shift in articles: a reserved min-height.

## 24. Definition of done
- A gates green, screenshots reviewed, the change live.
- B: BLOCKED.
