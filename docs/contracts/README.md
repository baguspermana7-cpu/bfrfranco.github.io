# Data Contracts — Maintenance Intelligence Workbench

> **Status**: Concept blueprint (v1.41.7, 2026-05-26)
> **Origin**: 2026-05-26 in-progress review v3, Sprint 3 backlog
> **Scope**: Schemas for the production workbench shape. Not consumed by
> any running engine yet — they exist to lock the contract before any
> screen, calculator, or connector is built so that backlog, UI, and
> data work don't drift.

These are JSON Schema (draft 2020-12) documents that define the
canonical shape of every entity the Maintenance Intelligence Workbench
exchanges between layers. They're written before the engine because
review-v3 P0.6 finding was that "UI cannot be implemented cleanly,
analytics cannot be tested, backend cannot enforce guardrails" until
contracts exist.

## Contract index

| Contract | Layer | Purpose |
|---|---|---|
| `diagnostic-case.schema.json` | Core | A single fault diagnosis instance from creation through closeout. The atom of the workbench. |
| `telemetry-window.schema.json` | Ingest | A bounded slice of sensor data attached to a case for evidence. |
| `data-quality-result.schema.json` | Ingest | Per-feature DQ score with rejection reasons; gates whether a case is eligible for diagnosis. |
| `fault-hypothesis.schema.json` | Inference | A single ranked fault candidate with calibrated confidence + evidence path. |
| `recommendation-review.schema.json` | Decision | A reviewer's verdict on a recommendation (approve / reject / ask for more evidence). |
| `work-order-draft.schema.json` | Execute | The CMMS-ready draft that planner approves before dispatch. Includes the state machine. |
| `kg-diff.schema.json` | Learn | A proposed knowledge-graph modification (add / change / retire) with claim-level provenance. |
| `audit-event.schema.json` | Govern | A single immutable audit ledger entry. Every state transition emits one. |
| `integration-sync.schema.json` | Operate | Connector health snapshot (BMS / SCADA / CMMS) with idempotency tracking. |

## Design principles

1. **Every payload carries provenance.** `tenant`, `site`, `asset`,
   `case_id`, `model_version`, `formula_version`, `kg_release`, `actor`,
   `role`, `timestamp`, `outcome` are universal context fields.
2. **No type ambiguity.** Numeric fields are typed; string-encoded
   ranges (like `"12-168"`) are rejected. Use `*_min` / `*_p50` /
   `*_p90` typed fields instead.
3. **Confidence is disambiguated.** `source_confidence_tier`,
   `model_confidence_calibrated`, `data_quality_score`, and
   `evidence_coverage_score` are separate fields, not overloaded onto
   one `confidence` value.
4. **Advisory-only is structural.** `work-order-draft.schema.json`
   *requires* a `planner_approved_at` timestamp + `planner_approved_by`
   actor before `state` can transition to `dispatched`. Schema enforces
   the safety posture, not just the UI.
5. **RPN is ordinal, not monetary.** `fmeca_priority_rank` is the
   canonical field name; `rpn` exists as a deprecated alias for one
   release.
6. **Audit before action.** Every state-mutating contract has an
   `audit_event_id` foreign-key field that must point at a written
   `audit-event` row.

## Out of scope for v1.41.7

- OpenAPI / AsyncAPI generation (Sprint 5 work)
- Runtime validation library (would need a JSON-schema validator in the
  engine; not yet shipped)
- Server-side enforcement via API gateway (multi-year scope)
- Tenant boundary policy schema (RBAC scope)

These contracts define the *what*. Implementing the *how* is captured
in `docs/plans/2026-05-25-ai-maintenance-product-roadmap.md` Phase C.
