# PRD-P26: Data age shown on every time-sensitive figure (merges Q8)

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P26 (absorbs Q8 "Scheduled data refresh with as-of stamps") |
| Version | 1.0, 2026-11-10 |
| Status | **Part A** (per-source stamps and stale flags from the engine's provenance) is approved under the directive. **Part B** (a scheduled job that fetches external sources) needs owner approval: it adds a recurring job and access to external systems the site does not query today. Part B is BLOCKED. |
| Priority | Wave 3 |
| Modules | `rz-engine.js` `RZEngine.data.sources` (provenance records, e.g. `markets.asOf '2026-07'`, `tariffs`), dc-market-tracker.html, the calculators' location data (P11), new `js/rz-asof.js` |

## 2. Executive summary
The market tracker already reads one dataset date from the engine's provenance record (`dmtAsOf`). That replaced a hand-written date which had gone stale (v3.24.24).

Two gaps remain:
- Other time-sensitive figures (tariffs, GPU-hour prices, location prices) show no date.
- Nothing warns when a dataset is old.

This PRD gives every figure from a dated source a visible date. The date turns amber when it is older than its declared refresh interval.

## 3. Problem statement (measured)
- `RZEngine.data.sources` carries `asOf` for markets (2026-07). The tariff and GaaS records carry dated text inside a free-form `source` string ("read 2026-11"), not a field.
- Only dc-market-tracker displays a date (one line, dataset level).
- There is no staleness rule. A 2026-07 dataset reads the same in 2027.
- `.github/workflows` contains only `supabase-keepalive.yml`, so no data is refreshed automatically.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Structured dates | provenance records with an `asOf` (YYYY-MM) and `refreshMonths` | 100 % of `RZEngine.data.sources` entries (gate) |
| Visible | figures rendered from a dated source show "as of Mon YYYY" | dc-market-tracker, tco/roi tariff fields, P11 location fields |
| Stale flag | age > refreshMonths: amber "older than N months" | unit with a fixed clock |
| Honesty | no figure claims "live" | gate (string scan for "live" near dated figures; coordinated with LTC X6) |

## 5. Scope
**Part A (in scope):**
- Add `asOf` and `refreshMonths` fields to every provenance record. Values come from the existing source strings; where a string has no date, the field is `null` and the UI shows "date not recorded".
- A shared renderer.
- A gate.

**Part B (BLOCKED, specified):** a GitHub Actions workflow on a monthly cron. It would fetch named public sources, write a dated JSON, open a pull request, and never auto-merge. It needs the owner's choice of sources and permission to run the job.

**Out of scope:** paid data feeds.

## 6. Personas
- **Analyst:** "how old is this price?"
- **Owner:** knows when to update.

## 7. User journey
1. A figure shows a small date beside it.
2. Hovering or focusing shows the title "Source: CBRE Global Data Center Trends 2026, as of Jul 2026, refresh every 6 months".
3. When stale, the date text is amber and the title adds "older than 6 months".

## 8. Functional requirements
| ID | Description | Acceptance |
|---|---|---|
| FR-P26-1 | Provenance schema: `{source, asOf: 'YYYY-MM'\|null, refreshMonths: int}` | gate over `RZEngine.data.sources` |
| FR-P26-2 | `rzAsOf.render(el, key)` | unit with clock injection |
| FR-P26-3 | Adoption on the tracker (per section), tco/roi tariff inputs, P11 fields | E2E |
| FR-P26-4 | Stale computation uses the visitor's current date (client clock). Documented: the clock is untrusted but harmless here. | unit |
| FR-P26-5 (B) | Workflow spec + PR template | owner approval |

## 9. UI/UX specification
- The date is mono 11 px, muted.
- Stale is shown in the warning token plus the word "older than N months". Colour is never the only signal.
- No icon.

## 10. Data model
Engine provenance fields. No database.

## 11. API contracts
`window.rzAsOf.render`. Part B writes a static JSON (no API).

## 12. Business rules
- `refreshMonths` defaults: markets 6, tariffs 12, GaaS 3. GPU prices move fast; this is an assumption stated in the record.

## 13. Cross-module integration
- P11 location values use the same schema.
- LTC X6 ("Live" over static): consistent wording.
- LTC Q8 is merged here.

## 14. AI and automation
Part B could use an agent to draft the dataset diff. Not proposed: a deterministic fetch and parse is safer, and any agent use would need owner approval.

## 15. Non-functional requirements
Negligible weight. AA contrast.

## 16. Security
- Part A: static data.
- Part B: workflow secrets none; public sources only; PR review is required.

## 17. Edge cases
- `asOf` null: the UI shows "date not recorded" (never a guess).
- Future date (typo): the gate rejects `asOf` later than the build date.

## 18. Technical architecture
engine sources → rz-asof.js → pages; (B) Actions cron → JSON → PR.

## 19. Implementation breakdown
| Task | Effort | Verify |
|---|---|---|
| Provenance fields + gate | 0.5 d | gate RED on the missing fields |
| Renderer + adoption | 0.75 d | E2E |
| B spec (written) | 0.25 d | owner review |

## 20. Test strategy
- Unit tests with a fixed clock (fresh / stale / null).
- Gate.
- E2E on the tracker.

## 21. Acceptance criteria
- **Given** markets asOf 2026-07 and refresh 6, **when** the clock reads 2027-02, **then** the tracker date shows amber "older than 6 months".

## 22. Rollout
- A: one release.
- B: after approval.

## 23. Risks
- Engine edits touch a shared 1.1 MB file. The change is small and gated by the engine tests.

## 24. Definition of done
- Part A: gates green, screenshots reviewed, the change live.
- Part B: spec delivered, status BLOCKED (owner).
