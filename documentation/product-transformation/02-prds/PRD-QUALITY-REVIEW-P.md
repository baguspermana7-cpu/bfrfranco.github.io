# PRD quality review: P-series (Phase 2), 2026-11-10

**Scale.** 0–5 per dimension. The minimum is 4 in every dimension; an average cannot hide a single score of 3.

**Columns:**
1. Completeness
2. Feasibility
3. Functional clarity
4. Journey
5. UI/UX depth
6. Data model
7. API
8. Cross-module
9. Error handling
10. Security
11. Testability
12. Implementation readiness

**Evidence basis.** I read every PRD again against its code facts. Structure counts were measured by script:
- All 27 PRDs have the 24 sections. P20, P23 and P24 merge trivially empty pairs into one heading ("10–11. Data model / API: none").
- FR tables: 3–15 rows.
- Given/When/Then criteria: 1–5 per PRD.

For a feature with no data or API (P16, P17, P22, P23), "Data model" and "API" score 5 when the PRD states "none" and that is true; empty-but-correct is complete.

## First pass (version 1.0): items below threshold

| PRD | Dimension | Score | Defect | Action |
|---|---|---|---|---|
| P12 | 3 Functional, 12 Readiness | 3, 3 | The plan model was assumed (tasks with predecessors) and marked UNVERIFIED | Verified `RZCxPlan`: level windows + per-system shares, no links. Rewrote the mapping. Now rev 1.1. |
| P13 | 8 Cross-module, 12 Readiness | 3, 3 | Cx intake API UNVERIFIED; severity scale wrong (low/med/high vs A/B/C) | Verified `RZCxIssues.store().add()` schema. Fixed severity, system, gate and the source map. Now rev 1.1. |
| P07 | 9 Error handling | 3 | No behaviour for a stalled or failed perturbation | Added FR-P07-6/7 + criteria. Now rev 1.1. |
| P20 | 5 UI, 11 Testability | 3, 3 | One criterion; no loading/error states | Added states + 3 criteria. Now rev 1.1. |
| P18 | 5 UI, 11 Testability | 3, 3 | UI listed, not specified; one criterion | Specified + 4 criteria. Now rev 1.1. |
| P21 | 5 UI | 3 | No index-loading or failure state | Added. Now rev 1.1. |
| P24 | 11 Testability | 3 | "Per §4" in place of criteria | Wrote GWT per option. Now rev 1.1. |
| P09 | 12 Readiness | 3 | Cross-block coupling unknown until the global map exists | **Not revisable by writing.** It needs T-P09-1 (a 1-day map). The moves stay blocked until the map is done and the PRD is revised (see the gate rule below). |

## Scores after revision

| PRD | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Min | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P01 | 5 | 4 | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 5 | 4 | 4 | yes |
| P02 | 5 | 5 | 5 | 5 | 4 | 5 | 4 | 4 | 5 | 5 | 5 | 5 | 4 | yes |
| P03 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes |
| P04 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes |
| P05 | 5 | 4 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 4 | 4 | yes |
| P06 | 4 | 4 | 5 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes |
| P07 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes |
| P08 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 4 | yes |
| P09 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **3** | 3 | **no: gated on T-P09-1** |
| P10 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes |
| P11 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes |
| P12 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes |
| P13 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes |
| P14 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 4 | yes |
| P15 | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 4 | 5 | 5 | 4 | 4 | 4 | yes |
| P16 | 4 | 5 | 4 | 4 | 5 | 5 | 5 | 4 | 4 | 5 | 4 | 5 | 4 | yes |
| P17 | 4 | 5 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes |
| P18 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes (BLOCKED: approval) |
| P19 | 4 | 4 | 4 | 4 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes (B blocked) |
| P20 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes (B blocked) |
| P21 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes (S2 blocked) |
| P22 | 4 | 4 | 4 | 4 | 5 | 4 | 5 | 4 | 4 | 5 | 5 | 4 | 4 | yes |
| P23 | 4 | 5 | 5 | 4 | 4 | 5 | 5 | 4 | 4 | 5 | 5 | 5 | 4 | yes |
| P24 | 4 | 5 | 4 | 4 | 4 | 5 | 5 | 4 | 4 | 5 | 4 | 4 | 4 | yes (BLOCKED: owner decision) |
| P25 | 5 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 4 | 4 | yes |
| P26 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | yes (B blocked) |
| PX | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 4 | 4 | 5 | 5 | 5 | 4 | yes |

## Honest notes behind the 4s
Many 4s are "sufficient, not exemplary". The usual reasons:
- **Estimates.** Effort and timing figures are labelled assumptions, to be measured.
- **Selector tables.** P03, P04, P07 and P17 rely on per-page selector or field tables that are produced by their first task, not yet written. Their gates make a missing entry fail, which is why readiness is 4 and not 5.
- **P10.** Writing about 60 curated formula and source notes is the real effort. The PRD sizes it at 1.5 days; that may be low.

## Gate rule for Phase 5
A PRD whose minimum score is below 4 does not enter implementation. Only P09 is in that state. Its first task, the global map, is analysis, not a code change. It is allowed and is scheduled.
