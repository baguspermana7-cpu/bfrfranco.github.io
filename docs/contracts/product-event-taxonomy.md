# Product Event Taxonomy

> **Status**: Spec (v1.41.10, 2026-05-26)
> **Origin**: review-v3 P1.10 — *"The page has a cookie analytics
> banner, but not product analytics events."*
> **Scope**: Every product event the workbench emits, with payload
> shape and universal context fields. Drives the future analytics
> pipeline, drift detection, and operator-research dashboards.

## §1 — Universal context (every event carries these)

| Field | Type | Why |
|---|---|---|
| `tenant_id` | uuid | Multi-tenant scope |
| `site_id` | uuid | Per-site SLA, climate, regulatory split |
| `asset_id` | string | Which asset is the subject |
| `case_id` | string | FK into DiagnosticCase when applicable |
| `model_version` | string | Reproducibility — which model emitted this |
| `formula_version` | string | `risk.v0.2` etc. |
| `kg_release` | string | `kg.v0.1.0` etc. |
| `actor_id` | uuid | Who took the action (or `system` for engine) |
| `actor_role` | enum | operator / reliability_engineer / planner / technician / engineering_manager / admin / system / connector |
| `timestamp` | ISO-8601 datetime | UTC, millisecond precision |
| `outcome` | enum | success / failed / rejected / warned / noop |
| `engine_release` | string | Engine binary version |

Every event also writes a corresponding `AuditEvent` row (the
analytics pipeline reads from AuditEvent; the event taxonomy is just
the dashboard / drift / research view of the same chain).

## §2 — Event types (v0.1, 12 total)

### Diagnosis lifecycle

#### `case_created`
- Subject: `diagnostic_case`
- Triggered when: engine spins up a new case from a DQ-pass window or operator manual triage
- Payload extras:
  - `dq_score` (number)
  - `dq_verdict` (pass / soft_warn / fail)
  - `recommendation_readiness` (analysis_only / advisory_possible / draft_wo_possible / production_ready)
  - `severity` (sev_1 / sev_2 / sev_3 / info)

#### `dq_gate_passed`
- Subject: `diagnostic_case`
- Triggered when: DQ verdict ∈ {pass, soft_warn}
- Payload extras:
  - `dq_score`
  - `threshold_version`
  - `features_failed_count`

#### `dq_gate_failed`
- Subject: `diagnostic_case`
- Triggered when: DQ verdict = fail
- Payload extras:
  - `dq_score`
  - `threshold_version`
  - `features_failed_count`
  - `failed_features_list` (array of feature_id)

#### `hypothesis_emitted`
- Subject: `diagnostic_case`
- Triggered when: model emits top-k hypotheses for a case
- Payload extras:
  - `top_k` (typically 3)
  - `top1_fault_id`
  - `top1_model_confidence_calibrated`
  - `top1_source_confidence_tier`
  - `decision_route`

### Recommendation lifecycle

#### `recommendation_proposed`
- Subject: `diagnostic_case`
- Triggered when: at least one hypothesis routes to `draft_wo_eligible` and a recommendation is shown to a reviewer
- Payload extras:
  - `hypothesis_id`
  - `priority_class`
  - `model_confidence_calibrated`

#### `recommendation_approved`
- Subject: `recommendation_review`
- Triggered when: reviewer verdict = approved
- Payload extras:
  - `hypothesis_id`
  - `time_to_decision_ms`
  - `priority_class`

#### `recommendation_rejected`
- Subject: `recommendation_review`
- Triggered when: reviewer verdict = rejected
- Payload extras:
  - `hypothesis_id`
  - `rejection_reason_code`
  - `time_to_decision_ms`

#### `recommendation_needs_more_evidence`
- Subject: `recommendation_review`
- Triggered when: reviewer verdict = needs_more_evidence
- Payload extras:
  - `additional_evidence_required` (array)
  - `hypothesis_id`

### CMMS lifecycle

#### `wo_draft_created`
- Subject: `work_order_draft`
- Triggered when: engine emits a WorkOrderDraft after recommendation_approved
- Payload extras:
  - `priority_class`
  - `work_type`
  - `estimated_downtime_hours`
  - `idempotency_key` (for dedup analytics)

#### `wo_planner_approved`
- Subject: `work_order_draft`
- Triggered when: planner approves; state→planner_approved
- Payload extras:
  - `time_to_planner_approval_ms` (since wo_draft_created)
  - `score_breakdown` snapshot

#### `wo_closed`
- Subject: `work_order_draft`
- Triggered when: state→closed (technician finished)
- Payload extras:
  - `actual_fault_id` (if known — for closed-loop learning)
  - `actual_action_id`
  - `time_to_close_ms`

### Learning lifecycle

#### `actual_fault_recorded`
- Subject: `diagnostic_case`
- Triggered when: technician confirms the actual root cause at closeout
- Payload extras:
  - `predicted_fault_id` (top hypothesis at the time)
  - `actual_fault_id`
  - `match` (boolean — did prediction match?)
  - This is the **gold-label** for model improvement; emitting it
    correctly is the #1 priority for the closed-loop pipeline.

## §3 — What does NOT need an event

- View rendering / navigation clicks (covered by cookie analytics for
  page-load only; not by the workbench taxonomy).
- Read-only inspection (operator opening a case to read).
- UI control state changes (tab switches, accordion expands).

Product events are about **state changes in the case/recommendation/WO/KG
chains**, not UI noise.

## §4 — Sinks

| Sink | Use |
|---|---|
| `AuditEvent` ledger | Tamper-evident chain, regulatory queries |
| Product analytics warehouse | Drift detection, time-to-decision metrics, conversion funnels |
| Operator research dashboard | Reviewer load per role, rejection-reason distribution |
| Model retraining pipeline | `actual_fault_recorded` is the gold label |

Each event SHOULD write to all sinks that subscribe; sinks are decoupled
from the event emitter.

## §5 — Privacy considerations

- `actor_id` is a tenant-scoped UUID; no email addresses or names in the
  payload.
- `narrative` / free-text fields are deliberately excluded from product
  events; full text stays in the case / review record.
- Tenant boundary is enforced before the event reaches the warehouse —
  a tenant CANNOT query another tenant's events through the dashboard.

## §6 — Out of scope of v0.1

- Custom per-tenant event extensions.
- Server-Sent-Events / WebSocket push for live dashboards.
- Long-tail rare-event taxonomy (e.g. `connector_oauth_token_expired`,
  `model_artefact_corrupt`). Future v0.2 adds connector + system
  events.
- Cross-event correlation IDs beyond `case_id` + `audit_event_id` chain.
