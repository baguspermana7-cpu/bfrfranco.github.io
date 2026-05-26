# Risk Formula v0.2 — Maintenance Intelligence Workbench

> **Status**: Spec (v1.41.10, 2026-05-26)
> **Scope**: How the workbench computes a *priority recommendation*
> from FMECA rank + business context. Keeps RPN strictly ordinal and
> moves monetary / scheduling decisions into a separate composite.

## §1 — Two distinct numbers, never collapsed

The engine emits **two** numbers per fault hypothesis. They are
displayed separately in the UI and never combined.

### 1.1 FMECA priority rank (ordinal)

```
fmeca_priority_rank = severity × occurrence × detection
```

- Range: 1–1000
- Units: dimensionless ordinal
- **Use**: ranking the FMECA library within a single asset class,
  reviewer attention triage, library curation.
- **DO NOT use**: as monetary risk, work-order priority, scheduling
  weight. RPN of 200 is not "twice as risky" as 100 — it's just higher
  in the queue.

### 1.2 Production priority recommendation (composite)

```
priority_class ∈ {P1_safety, P2_critical, P3_routine, P4_deferred}
```

Determined by the **score breakdown** with multi-factor inputs (NOT by
RPN alone):

| Factor | Source | Influence |
|---|---|---|
| `fmeca_priority_rank_ordinal` | FaultHypothesis | Tier-1 attention only |
| `sla_class` | Asset Registry | Defines max acceptable downtime |
| `safety_class` | FMECA + Asset Registry | `sif` / `general_industry` / `non_safety` |
| `redundancy_state` | Topology + live state | `lost` / `degraded` / `healthy` |
| `spares_readiness` | Spares engine | `stocked` / `transit` / `long_lead` / `out_of_stock` |
| `human_approval_required` | Always `true` per advisory-only posture | — |

Schema-level enforcement lives in
`work-order-draft.schema.json::priority_recommendation.score_breakdown`:
all six fields required, `human_approval_required: true` is `const`.

## §2 — Priority class decision rules

```
IF safety_class == 'sif' AND redundancy_state == 'lost':
    P1_safety       # Always SIF + redundancy loss
ELIF safety_class == 'sif':
    P2_critical
ELIF redundancy_state == 'lost' AND sla_class IN ('tier-3-24x7','tier-4'):
    P2_critical
ELIF redundancy_state == 'degraded' AND fmeca_priority_rank_ordinal >= 150:
    P2_critical
ELIF sla_class == 'tier-1-batch' AND fmeca_priority_rank_ordinal < 100:
    P4_deferred
ELSE:
    P3_routine     # default
```

`spares_readiness` does **not** change `priority_class` — it changes
the *plan*: a `P2_critical` recommendation with `spares = out_of_stock`
becomes a P2 with an expedite-order action attached, not a P3.

## §3 — Why not "Expected risk = probability × cost"?

Reviewer P1.6: expected-risk model is not computable from current data.

| Required | Available in v1.41.7 seed? |
|---|---|
| Probability of failure (model_confidence_calibrated) | Partial — calibration pipeline not yet shipped |
| Downtime distribution (P50/P90) per fault | No — `effects.csv` uses string ranges like "12-168" |
| Repair-cost distribution per action | No — not in `actions.csv` |
| Safety penalty model | No — `safety_class` is categorical only |
| SLA exposure model | Partial — `sla_class` known per asset |
| Redundancy modifier | Yes — live state |
| Site-specific modifiers (climate, location, regulatory) | No |

Until all six categories ship typed fields (per the v1.41.6 data
completeness banner), monetary risk is **out of scope**. The engine
emits `expected_risk_p50 = "blocked — effects.csv chain incomplete"`
instead of a number it cannot defend.

## §4 — Formula versioning

```
formula_version = "risk.v0.2"
```

Stored on every DiagnosticCase and propagated to AuditEvent. Version
bumps require:

1. Replay of the last 1000 closed cases through the new formula.
2. Diff report: how many priority_class assignments change? Which
   direction? Are any high-stakes cases (P1/P2) downgraded? Why?
3. Reviewer sign-off via the KGDiff workflow.
4. Roll-out cadence: shadow mode (compute new, display old) for 2
   weeks; flag mode (display both) for 2 weeks; cutover.

Old formula version remains queryable on archived cases — never
silently re-scored.

## §5 — Field-name discipline

The legacy name `RPN` is allowed only for **library-display** purposes.
The composite output uses these field names everywhere else:

| UI / contract field | Definition |
|---|---|
| `fmeca_priority_rank` | Ordinal rank (1–1000) — display this in evidence panels |
| `priority_class` | Composite class (P1_safety / P2_critical / P3_routine / P4_deferred) |
| `priority_rationale` | Human-readable single-sentence explanation |
| `score_breakdown` | Object with all six contributing factors |
| `expected_risk_p50` | Monetary risk (BLOCKED until data complete; never use `rpn`) |

Code search for `rpn` returns ≤2 hits site-wide post-v1.41.10 — both
in the library-display path of `ai-engineering-maintenance.html`.

## §6 — Out of scope of v0.2

- Time-discounted risk (Bayesian posterior over time-to-failure).
- Multi-fault concurrent reasoning (one fault at a time for now).
- Tenant-level priority class re-mapping (e.g. a tenant that maps
  `P2_critical → P1_safety` for their own escalation).
- Cost-of-action vs cost-of-no-action breakeven analysis.

These land in v0.3 once RUL + Expected-Risk pipelines exist (review-v3
P1.8 — currently blocked by data).
