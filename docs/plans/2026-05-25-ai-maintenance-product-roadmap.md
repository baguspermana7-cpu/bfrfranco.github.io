# AI Engineering Maintenance — Production Product Roadmap

> **Status**: Aspirational long-term roadmap · 2026-05-25
> **Origin**: 2026-05-24 production-readiness review at
> `/home/baguspermana7/Documents/AI maintenance/2026-05-24-ai-engineering-maintenance-production-review.md`
> and `2026-05-24-ai-engineering-maintenance-industrial-product-review-v2.md`.
> **Scope**: NOT a Phase-0 work item. This document captures what an
> industrial Maintenance Intelligence Workbench would look like as a real
> product. Requires a team, multi-year timeline, and budget that exceeds
> the resistancezero.com portfolio site's current scope by 2-3 orders of
> magnitude.
> **Working state**: `ai-engineering-maintenance.html` remains the
> **concept page / research basis**. v1.40.0 corrected the lies (CSV
> columns, row count, "auto-action" wording) and added an honest framing
> banner pointing here.

---

## What this roadmap is

A faithful capture of the reviewer's Addendum A "Industrial Build Blueprint"
plus the review's P0 and P1 findings, organised as **future work** to be
considered if/when the AI Maintenance concept evolves into a real product.

This roadmap explicitly **defers** all production-app build work. It exists
so that:
- The reviewer's analysis isn't lost.
- A future scope decision can pull from it.
- The concept page can credibly point at it ("we know what production would
  require; here is the blueprint").

It is **not** "what we are building this quarter."

---

## §1 — North Star

Product name (proposed): **Maintenance Intelligence Workbench**

Core promise:

> Diagnose asset degradation, explain the evidence, recommend the safest
> next action, prepare the work order, and learn from field outcomes.

Industrial product loop:

```
Sense → Diagnose → Explain → Decide → Plan → Execute → Verify → Learn
```

Five questions the product must answer:

1. What asset is at risk?
2. What evidence supports that risk?
3. What action should be taken?
4. When should it be done?
5. What changed after the work was done?

---

## §2 — Personas + role-based UX

Industrial RBAC (separate from subscription tiers):

| Role | Default screen | Main actions |
|------|---------------|--------------|
| Technician | Mobile Workbench | scan asset, follow procedure, capture readings/photos, close task |
| Planner | Schedule Board | prioritise work, reserve spares, allocate crew, schedule window |
| Reliability engineer | Review Queue | inspect evidence, approve/override diagnosis, approve KG changes |
| Supervisor | Site Command Center | approve high-impact work, watch SLA risk, escalate blockers |
| Integrator | Data Health | map sensor tags, test CMMS/BMS connector, monitor syncs |
| Auditor | Audit Export | inspect model/KG/action lineage and decision history |
| Admin | Admin | tenant config, role management, integration credentials |
| Root | (all) | platform-level controls |

Note: today's site has `free / demo / pro / educator / root` for
subscription gating. Industrial RBAC is **orthogonal** — would coexist
with subscription tiers in a real product.

---

## §3 — Product surface (11 screens)

1. **Command Center** — supervisor situational awareness
2. **Triage Queue** — daily operational worklist
3. **Diagnostic Case Detail** — single case trust + decision (the most
   important screen; 8 evidence tabs)
4. **Planner Board** — calendar / kanban / spares timeline
5. **Technician Mobile Workbench** — offline-capable field execution
6. **Asset Registry** — hierarchy + sensor-tag mapping
7. **Knowledge Graph / FMECA Admin** — claim-level provenance + diff +
   rollback
8. **Model Monitor** — confidence distribution / drift / calibration /
   conformal coverage
9. **Integrations Health** — CMMS / historian / BMS / spares / edge
   connector status
10. **Audit & Reports** — recommendation acceptance, false +/-, MTTR
    impact, model/KG version history
11. **Admin** — tenant + roles + releases

---

## §4 — Service architecture (cloud control plane + edge data plane)

Cloud control plane:
- Auth + Tenant Service
- Asset Registry
- Knowledge Graph Service (Neo4j primary)
- Model Registry
- KG Release Registry
- CMMS Integration Service
- Spares Integration Service
- Work Order Service
- Review Workflow Service
- Audit Ledger Service
- Notification Service
- Reporting / Export Service

Edge data plane (Pi5 / Jetson per asset cluster):
- Local sensor ingest
- Local feature extraction
- Local inference
- Read-only local KG package
- Offline work pack
- Store-and-forward queue
- Health telemetry
- Signed OTA updates

Boundary: cloud-to-controller direct access is **forbidden**. All OT
ingest goes through OT DMZ (historian or OPC UA gateway).

---

## §5 — Calculation engine (deterministic, versioned, tested)

### Risk math layered beyond RPN

```
fmeca_priority = severity * occurrence * detection           # RPN, ranking only

failure_probability_horizon = calibrated P(failure within T)
                              # MTBF/exponential or Weibull/aging

expected_consequence = downtime_hours * cost_per_hour
                     + repair_cost
                     + safety_penalty
                     + SLA_penalty
                     + redundancy_penalty

expected_risk = failure_probability_horizon
              * expected_consequence
              * evidence_confidence_modifier
              * site_context_modifier

action_value = expected_risk_without_action
             - expected_risk_with_action
             - planned_intervention_cost
```

UI must show every number with: formula ID, input data version, source
reference, unit, timestamp, model version, confidence tier, validation
status, owner/reviewer.

### RUL as distribution (P10 / P50 / P90), not single number

Requires run-to-failure + censored survival data + degradation trajectory
data. Current CSV seed does NOT contain enough to support real RUL.

### Calibration

`CalibratedClassifierCV` with sigmoid/Platt or isotonic. Separate
calibration set. Multiclass via OvR. Report Brier + ECE + reliability
diagrams. Layer conformal prediction on top.

### Conformal coverage caveat

```
95% conformal coverage assumes calibration and deployment data are
exchangeable. Site drift, time-series autocorrelation, and new asset
families can break coverage.
```

UI must show coverage scope: valid-for / not-validated-for.

---

## §6 — Knowledge governance

Claim-level provenance (not just row-level):

```text
EvidenceClaim {
  claim_id, claim_type, subject_id, object_id/value,
  confidence_tier, source_ref, source_type, reviewer,
  valid_from, valid_to
}
```

KG release pipeline (signed, reviewable, rollback-able):

```
Source research → evidence extraction → candidate claims
→ schema validation → staged graph load → data-steward review
→ reliability-engineer approval → signed KG release
→ tenant rollout → rollback available
```

Field-learning pipeline (closeout to KG, never direct):

```
Work-order closeout → NER extraction → candidate KG diff
→ site SME review → reliability approval → tenant-local overlay
→ possible global promotion after evidence threshold
```

---

## §7 — Safety + cybersecurity boundary

### Functional safety (IEC 61508)

AI is **advisory-only by default**. No physical control by AI:

Allowed by default:
- advisory recommendation
- draft work order
- evidence package
- review queue

NOT allowed without formal safety lifecycle:
- auto shutdown / throttle
- setpoint write
- breaker operation
- alarm disable
- interlock bypass
- trip reset
- maintenance release approval

### OT cybersecurity (IEC 62443 / ISA-95)

```
Level 0/1: sensors, actuators
Level 2:   PLC / DDC / BMS controllers
Level 3:   SCADA / BMS / historian / site operations
Level 3.5: OT DMZ broker / API gateway       ← advisor reads from here
Level 4:   enterprise maintenance advisor / cloud
```

Preferred protocols: OPC UA with certs, BACnet/SC, historian API or MQTT
broker in OT DMZ with cert auth.

Avoided: unsecured BACnet/IP, exposed Modbus TCP, direct cloud-to-controller,
anonymous OPC UA, shared certs, browser-side OT API calls.

---

## §8 — Build phases (each gated by Definition of Done)

### Phase A — Correct the foundation (DONE in v1.40.0)
- ✅ Fix demo/access UX
- ✅ Correct row count (826 not 834)
- ✅ Add `confidence_tier` + `source_ref` to all CSVs (auto-inferred)
- ✅ Add `effective_date`, `last_verified_by`, `license_class`
- ✅ Fix orphaned step → action FK
- ✅ Tighten "auto-action" language to advisory-only
- ✅ Honest banner on concept page

### Phase B — Research basis to product shell
- App shell with role-based navigation
- Command Center + Triage Queue + Diagnostic Case skeleton
- Synthetic demo data
- Audit event model
- Move current concept page into `/research-basis` route

### Phase C — Deterministic engine
- Calculation engine Python package with strict tests
- Feature extraction package (versioned, with golden fixtures)
- Typed data contracts (pandera/pydantic)
- KG staging load
- API boundaries (OpenAPI + AsyncAPI)

### Phase D — MVP advisory workflow
- Upload sensor file → schema validation → feature extraction → model
  inference → KG lookup → evidence display → draft work-order →
  human-approval gate

### Phase E — Industrial integration
- CMMS sandbox connector
- Historian read-only ingest
- Spares connector
- Edge read-only inference
- Audit export
- SLO dashboards

### Phase F — Accuracy + governance
- Calibration (CalibratedClassifierCV + Brier + ECE)
- Conformal prediction
- Anomaly detection
- RUL where data supports it
- Model registry + drift monitoring
- KG release governance

### Phase G — Enterprise hardening
- Multi-tenant isolation
- SSO + MFA
- Edge signed updates
- Backup / restore drills
- Incident response runbooks
- Security review (SBOM, dep pinning, CSP)
- Tenant onboarding process

### Phase H — (Optional) Safety-critical extension
- Only if pursued: formal IEC 61508 safety lifecycle, HAZOP/LOPA, SIL
  allocation, independent verification, proof testing, MoC.

---

## §9 — Vertical-slice pilot recommendation

Do not attempt 20 asset families at once. First vertical slice:

```
Asset family: CDU pump or chiller pump (DC-relevant, well-instrumented)
Fault modes:  pump degradation, flow obstruction, sensor fault
Data:         synthetic + one sample telemetry schema
Output:       diagnostic case + draft work order
Integration:  mock CMMS connector
Knowledge:    small KG subset (~30 nodes)
Users:        reliability engineer + planner
```

Success criteria:
- data quality > threshold
- model repeatability across 3 independent runs
- human acceptance rate > 70%
- no unsafe recommendation
- CMMS draft success
- measurable planning value

---

## §10 — External standards anchor (cite, don't claim compliance)

Production design should be anchored to:

- **IEC 60812:2018** — FMEA/FMECA planning, performance, documentation
- **IEC 61508:2010** — functional safety of E/E/PE safety-related systems
- **ISA/IEC 62443** — industrial automation and control systems cybersecurity
- **ISO 14224:2016** — reliability and maintenance data collection
- **ISO 55001:2024** — asset management system requirements
- **NIST SP 800-82 Rev. 3** — Guide to Operational Technology Security
- **ISA-95 / IEC 62264** — enterprise-control system integration
- **ISA-101** — HMI design for safer high-performance operations
- **NIST AI RMF 1.0** — trustworthy AI risk management
- **NIST SSDF SP 800-218** — secure software development framework
- **MIMOSA OSA-CBM** — condition-based maintenance architecture
- **OPC UA** — secure industrial interoperability
- **ASHRAE BACnet + BACnet/SC** — building automation secure connect
- **scikit-learn calibration** + **SHAP TreeExplainer** — ML method anchors

**Concept-page disclosure rule**: this roadmap CITES these standards as
references. The concept page does NOT claim compliance with any of them.
Compliance work happens only inside an actual product build phase, with
appropriate standards purchases, auditor engagement, and documented QMS.

---

## §11 — What is NOT in scope for resistancezero.com

The resistancezero.com portfolio site will NOT itself host:

- multi-tenant industrial SaaS
- real CMMS / BMS / OPC UA connectors
- physical edge gateways
- closed-loop control of any kind
- safety-rated functions
- enterprise auth (SSO / MFA / cert-based device auth)
- standards-compliance audit deliverables

If this product is pursued, it would be a **separate codebase + business**.
The resistancezero.com concept page links here as documentation of intent.

---

## §12 — Acceptance bar for "production"

Do not call any system "production" until **all** of:

- Real backend auth + tenant authorization enforced
- No hardcoded operational credentials
- UI supports technician / planner / reliability engineer / supervisor /
  admin minimum
- ≥1 complete workflow from signal → recommendation → draft WO → closeout
- All calculation formulas versioned + tested
- CSV/KG schema validates in CI
- Data provenance + confidence enforceable
- RPN not treated as probability
- Model validation avoids leakage (grouped splits)
- Calibration + conformal claims have evidence
- RUL only shown with valid survival/degradation data
- CMMS writes draft / approved / idempotent / audited
- OT ingest read-only through DMZ
- No physical control by AI
- Audit records tamper-evident
- Backup-restore tested
- Rollback tested
- Observability dashboards + alerts exist
- Incident runbooks exist
- Pilot success criteria defined and met

---

## §13 — Acknowledgements

This roadmap is a faithful capture of the 2026-05-24 production-readiness
review and Industrial Product Review v2 (3,092 lines). The reviewer's
work has been preserved verbatim where it represents genuine industrial
practice; the framing has been corrected to distinguish concept-page
critique from production-app blueprint.

Where the review and the maintained concept page diverge in scope, this
roadmap is the **future-work** artefact. The concept page at
`ai-engineering-maintenance.html` is the **as-shipped** artefact, now
honestly labeled.

---

## Status

- Phase A: **DONE** in v1.40.0 (2026-05-25)
- Phase B onward: **NOT STARTED** — requires scope decision
