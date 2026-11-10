# PRD-P21: "Explain this number", grounded in the registries

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P21 |
| Version | 1.1, 2026-11-10 (review revision: UI states, acceptance) |
| Status | **Stage 1** (deterministic, no AI) approved under the directive: answers are composed from the registry records and manual sections by rules. **Stage 2** (an LLM answer layer) needs owner approval: model choice, an API key held server-side, cost, and the risk of fabricated answers against the site's accuracy rules. BLOCKED. |
| Priority | Wave 4 |
| Dependencies | P10 (calculator registry), the existing conv/dcai registries, manual sections (K26 ids) |

## 2. Executive summary
Readers ask "why is this number what it is". The answer already exists in structured form:
- a registry record: formula, inputs, evidence class, source;
- a manual section.

Stage 1 adds a question box that matches a question to those records by keyword and returns a composed answer with links. It never generates text that is not in a record.

Stage 2 would add an LLM to phrase answers. It is specified here with strict grounding rules and is only to be built if the owner approves.

## 3. Problem statement
- There is no in-product help beyond the basis drawers and the manuals.
- Finding the right drawer or section takes knowledge of the page.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Grounded | every answer cites at least one registry id or manual anchor that exists | 100 % (gate) |
| Honest miss | a question with no match returns "Not covered by this tool's records" | fixture set of 10 off-topic questions |
| Useful hit | 20 fixture questions return the expected record in the top 3 | ≥ 18/20 |

## 5. Scope
- **Stage 1 (in):** a keyword index built from the registries + manual headings; a question box on the cockpits and calculators; answers composed from a template ("<label> = <value> <unit>. It is <evidence>: <note>. Formula: <formula>. Source: <source>. Read more: <manual link>").
- **Stage 2 (blocked):**
  - A server function (a Cloudflare Worker already exists for finance; a new route would be new infrastructure).
  - Model: the latest Claude model per policy, with strict tool use over the index.
  - Answers must quote record ids. The response is rejected if any cited id does not exist.
  - Rate limits.
  - Cost cap.
- **Out:** chat history; open-domain questions.

## 6. Personas
Student. Reviewer.

## 7. User journey
1. "Ask about this page" box → type "why is PUE 1.165".
2. Up to 3 answer cards, each with a "Open basis" button (opens the drawer) and a manual link.
3. No match: the honest-miss text, with a link to the manual index.

## 8. Functional requirements
| ID | Description |
|---|---|
| FR-P21-1 | Index generator over the registries + manual headings (tokens, synonyms list curated) |
| FR-P21-2 | Matcher: BM25-style scoring in the client; threshold for the honest miss |
| FR-P21-3 | Answer template filled only from record fields |
| FR-P21-4 | Grounding gate: every rendered citation resolves |
| FR-P21-5 (S2) | LLM layer spec as in §5, with a citation validator |

## 9. UI/UX specification
- **Ask field.** A labelled text input, "Ask about this page", in the tool header area, with an Ask button. Enter submits.
- **Index loading.** On first focus the index loads; while it loads, the button reads "Loading…" and is disabled (with that reason). A failed load shows "Search of this page's records is unavailable" with a Retry button.
- **Answers.** Up to 3 cards. Each card has a label, the composed sentence, an Open basis button (opens the existing drawer), and a manual link.
- **No match.** The honest-miss text, plus a link to the manual.
- Labelled "Answers come from this page's records" (stage 1 makes no AI claim).
- AA contrast in both themes; at 390 px the cards stack.

## 10. Data model
Generated index JSON (about 200 KB estimate, lazy).

## 11. API contracts
- S1: none.
- S2: `POST /api/explain {page, question}` → `{answers: [{text, citations: [id]}]}`. Blocked.

## 12. Business rules
- No answer without a citation.
- Stage 1 never paraphrases; it only fills templates.

## 13. Cross-module integration
P10, P14 (palette action "Ask about this number"), P17.

## 14. AI and automation
- **Stage 1 deliberately uses none.** Retrieval + templates are deterministic and testable, which suits a site whose rule is that every number is traceable.
- **Stage 2 requirements (if approved):**
  - human approval of the prompt and tool set;
  - evaluation on the fixture set before launch;
  - logging without personal data;
  - deterministic fallback to stage 1 on any error.

## 15. Non-functional requirements
- Index lazy-loaded on first focus.
- Answer in under 50 ms client-side.

## 16. Security
- S1: static data; text rendered as text.
- S2: key server-side only, rate limit, prompt-injection containment (the model sees only the records, not page HTML).

## 17. Edge cases
- Indonesian questions: synonym list support (LTC Q15 can extend).
- Numbers in the question: matched to record values within 1 % as an extra signal.

## 18. Technical architecture
registries + manuals → index generator → client matcher → answer cards → drawer.

## 19. Implementation breakdown
S1: index 1 d, matcher + UI 1.5 d, fixtures + gates 0.5 d. S2: spec only.

## 20. Test strategy
- Fixture questions (20 hits, 10 misses).
- Grounding gate.
- axe.

## 21. Acceptance criteria
- **Given** "why is PUE 1.165" on datahallAI, **then** the top answer cites `pue.design_day` and opens its drawer.
- **Given** "what is the weather", **then** the honest-miss text is shown with no card.
- **Given** the index fails to load, **then** the field shows the unavailable message and Retry works.

## 22. Rollout
S1: one release. S2: after approval.

## 23. Risks
- Low recall from keyword matching. Mitigated by a curated synonyms list and the measured fixture score.

## 24. Definition of done
- S1 gates green, the change live.
- S2: BLOCKED (owner).
