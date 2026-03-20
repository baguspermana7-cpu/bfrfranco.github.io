# Data Center Commissioning + RFS Playbook App
## Specification v2.0

Status: Build-ready draft
Date: 2026-03-18
Authoring basis:
- [cx-calculator-design.md](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md)
- [dc-commissioning-calculator-spec.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-calculator-spec.md)
- [dc-commissioning-research.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-research.md)
- [cx-rfs-playbook-review-2026-03-18.md](/home/baguspermana7/rz-work/Article/Cx/Codex%20Review/cx-rfs-playbook-review-2026-03-18.md)

---

## 0. Document Intent

This document supersedes the earlier `calculator-first` concept and defines a build-oriented `commissioning + RFS playbook application` for data center projects.

This v2 spec is intentionally more prescriptive than the earlier drafts. It is designed to be:
- sufficiently detailed for UI, data-model, and engine implementation
- credible for colo, hyperscale, modular, and AI-factory programs
- structured so it can be built as a modern app and still distributed as a single HTML artifact if needed

This product is not just a calculator.

It is a combined:
- playbook
- checklist engine
- RFS gate tracker
- schedule engine
- cost engine
- evidence and handover tracker
- analytics layer

---

## 1. Product Definition

### 1.1 Product Name

`Data Center Commissioning + RFS Playbook App`

Short label:

`Cx/RFS Playbook`

### 1.2 Product Purpose

Provide a structured, evidence-based, expandable, and scenario-driven system to plan, track, and estimate:
- commissioning scope
- RFS requirements
- schedule and dependencies
- cost and resourcing
- gate readiness
- evidence completeness
- turnover and handover status

### 1.3 Product Boundary

This product covers:
- predesign through turnover for data center delivery
- commissioning and service-readiness governance
- internal and customer-facing RFS gates
- technical, documentation, testing, and acceptance requirements

This product does not aim to be a full operations platform.

It is not:
- a live BMS/DCIM replacement
- a CMMS
- a procurement suite
- a ticketing system for ongoing operations
- a real-time telemetry platform

It may interface conceptually with those domains, but they are outside scope for v2.

### 1.4 Product Outcome

The user should be able to answer these questions from one place:
- What exactly must be completed before this building, hall, or cluster can be declared RFS?
- Which packages, tests, documents, and approvals are still missing?
- What is the current cost, schedule, and slip risk?
- Which milestones are on the critical path?
- Which requirements are archetype-specific to colo, hyperscale, or AI factory projects?
- What evidence must be handed over to the owner, operator, or customer?

---

## 2. Core Design Decisions

### 2.1 Playbook-First, Calculator-Second

The primary object of the product is the playbook tree, not the cost widget.

All other views are derived from the same shared model:
- checklist
- Gantt
- cost rollup
- analytics
- evidence and handover

### 2.2 RFS Is a First-Class Entity

RFS is not a note, narrative, or final milestone label.

RFS must be explicitly modeled as:
- gate families
- gate definitions
- gate prerequisites
- acceptance criteria
- evidence requirements
- approvals
- confidence score

### 2.3 Recursive Hierarchy, Not Fixed 5 Levels

The app must support arbitrary depth.

The system cannot assume only:
- phase
- discipline
- system
- activity
- sub-task

Real projects require deeper nesting such as:
- program
- campus
- block
- building
- floor
- hall
- suite
- discipline
- system
- subsystem
- package
- scenario
- step
- evidence

### 2.4 Lifecycle Coverage Is L0-L6

The v2 playbook must explicitly cover:
- L0: design and planning
- L1: factory testing / FAT / witness
- L2: delivery, installation, static checks, pre-start
- L3: startup / pre-functional / SAT
- L4: functional performance testing
- L5: integrated systems testing / IST
- L6: closeout, turnover, and handover

### 2.5 Public-Source Discipline

Any exact benchmark, operator requirement, or market figure must be tagged by source confidence.

Accepted confidence classes:
- `official_public`
- `primary_public_non_official`
- `secondary_public`
- `internal_estimate`
- `expert_assumption`

### 2.6 Archetype-Driven, Not Company-Locked

The product should support cloud-customer overlays, but the core logic must be driven by delivery archetypes rather than pretending to know every private internal operator standard.

Primary structure:
- project archetype template
- optional customer overlay
- optional certification overlay
- optional regional overlay

### 2.7 Single-File Distribution, Modular Authoring

The final deployment artifact may remain a single HTML file.

However, the source must be authored modularly and built into the final artifact.

Do not hand-maintain a giant monolithic HTML file as the system of record.

---

## 3. Users and Jobs To Be Done

### 3.1 Primary Users

| User | Primary Need |
|---|---|
| Owner PM / Program Director | Understand readiness, cost, risk, and gate status across the project |
| Commissioning Authority (CxA) | Define test packages, track evidence, close levels, manage readiness logic |
| GC / EPC / Trade Lead | See scope, dependencies, blockers, dates, and closure requirements |
| Facility / Operations Readiness Lead | Confirm turnover, training, documents, spares, SOP/EOP readiness |
| Customer / Tenant Interface Lead | Track customer-facing RFS and turnover package status |
| Executive / Investor | See high-level cost, schedule, slip risk, and readiness confidence |

### 3.2 Secondary Users

| User | Primary Need |
|---|---|
| OEM / Vendor Specialist | See specific package tests, startup obligations, evidence required |
| Uptime / Third-Party Witness | Review certification-related scope and evidence |
| Controls / DCIM Lead | Verify points, sequences, alarms, and integration readiness |
| Network / Cluster Bring-Up Lead | Verify fabric readiness and AI/HPC cluster prerequisites |

---

## 4. In-Scope Project Archetypes

The app must ship with templates for the following archetypes.

| Archetype ID | Name | Notes |
|---|---|---|
| `retail_colo` | Retail colocation | Multi-tenant suites, customer SAT/RFS important |
| `wholesale_bts` | Wholesale colo / build-to-suit | Tenant-specific service requirements and fit-out boundaries |
| `enterprise_dc` | Enterprise / private data center | Owner-operated, often documentation-heavy |
| `hyperscale_region` | Hyperscale cloud region / AZ | Multi-building, phased turnover, service launch focus |
| `ai_factory_campus` | AI factory / GPU cluster campus | High-density power, liquid cooling, fabric readiness |
| `modular_pod` | Modular / prefab pod deployment | Factory-site split across L1-L4 and integration-heavy L5 |
| `brownfield_expansion` | Brownfield expansion | Isolation, coexistence with live ops, high change risk |
| `recommissioning` | Existing-facility recommissioning | Focus on L3-L6 re-validation and operational evidence |
| `repurposed_fast_track` | Repurposed building / fast-track AI deployment | Compressed schedule, exceptional risks, temporary systems possible |

### 4.1 Optional Customer Overlays

Customer overlays refine the archetype with additional gate requirements or target ranges.

Initial overlays:
- `generic_standard`
- `aws_like`
- `google_like`
- `microsoft_like`
- `oracle_stargate_like`
- `meta_like`
- `colo_operator_like`
- `ai_hosted_capacity_like`
- `xai_fast_track_like`

Important rule:

The app must clearly distinguish:
- `publicly supported facts`
- `internal inferred patterns`

Example:
- `Anthropic` in public sources behaves more like a hosted-capacity consumer overlay than a self-built facility archetype.

---

## 5. Public Benchmark Alignment Rules

This app must align design assumptions with public signals from major operators without overstating certainty.

### 5.1 Public Signals That Matter

As of 2026-03-18, public disclosures indicate:
- OpenAI announced Stargate on 2025-01-21 with an intended `$500B` four-year investment path and Texas as the initial location.
- OpenAI said on 2025-07-22 that Stargate was already developing more than `5 GW`.
- Oracle publicly describes Abilene as eight buildings, more than four million square feet, and up to `1.2 GW`, with AI workloads going live in less than a year after construction began.
- AWS publicly describes new data center power/cooling designs intended for higher resilience and mixed air/liquid cooling, and Project Rainier for Anthropic at scale beyond one million chips.
- Google publicly describes infrastructure for `1 MW` IT racks, `+-400 VDC`, sidecar power systems, redundant CDUs, and approximately `99.999%` uptime for its TPU pod fleet over eight years.
- Microsoft publicly describes AI superfactory architecture and also describes future regions with availability zones that have independent power, cooling, and networking.
- xAI publicly describes Colossus 2 at `200,000 GPUs`, built on a compressed schedule with a stated ambition toward one million GPUs at the site.
- Anthropic publicly states very large hosted-capacity plans on both AWS and Google Cloud.

### 5.2 Build Implications

The app must therefore support:
- campus-scale phased turnover
- building-level and hall-level RFS
- liquid cooling as a primary and mixed architecture
- AI cluster bring-up readiness
- availability-zone style structures
- fast-track and repurposed-building scenarios
- hosted-capacity readiness models

### 5.3 Source Rule

Every benchmark in the UI must have:
- title
- source URL
- publication date
- source type
- confidence class
- note on how the benchmark is used

---

## 6. Product Modules

The v2 app must contain these first-class modules:
- `Program Setup`
- `Playbook`
- `Checklist`
- `RFS Gates`
- `Schedule`
- `Cost`
- `Resources`
- `Analytics`
- `Evidence`
- `Exports`
- `Sources`

### 6.1 Module Objectives

| Module | Objective |
|---|---|
| Program Setup | Define archetype, overlays, scope, phasing, dates, and topology |
| Playbook | Display full recursive tree with statuses and applicability |
| Checklist | Manage tasks, criteria, approvals, waivers, and retests |
| RFS Gates | Show readiness of internal and customer-facing milestones |
| Schedule | Show Gantt, baselines, dependencies, critical path, phasing |
| Cost | Estimate and roll up cost by scope driver and package |
| Resources | Show team loading, vendor days, witness days, and discipline load |
| Analytics | Generate readiness, risk, defect, evidence, and forecast metrics |
| Evidence | Track required artifacts and handover-pack completeness |
| Exports | Generate PDF, CSV, JSON, and handover reports |
| Sources | Expose benchmark provenance and assumption traceability |

---

## 7. Lifecycle Model: L0-L6

### 7.1 Phase Definitions

| Phase | Name | Core Intent |
|---|---|---|
| L0 | Design & Planning | Make commissioning and RFS buildable before field execution |
| L1 | Factory Testing / FAT | Remove defects before shipment and prove supplier baseline |
| L2 | Delivery / Installation / Static | Verify installation completeness and safe readiness to start |
| L3 | Startup / SAT / Pre-Functional | Prove standalone operation of systems and packages |
| L4 | Functional Performance | Prove sequence, load, and design intent under conditions |
| L5 | Integrated Systems Testing | Prove facility-level behavior under integrated and failure scenarios |
| L6 | Closeout / Turnover / Handover | Transfer evidence, knowledge, and residual risk acceptance |

### 7.2 Mandatory Deliverables by Phase

| Phase | Mandatory Deliverables |
|---|---|
| L0 | OPR, BOD, SOO, cause-and-effect matrix, points list, commissioning plan, RFS gate map, energization strategy, test script index |
| L1 | FAT scripts, FAT reports, deviations log, ship-release records, OEM sign-off |
| L2 | delivery inspections, installation checklists, torque/continuity/static tests, redline markups, safe-to-energize packages |
| L3 | startup sheets, OEM startup records, SAT records, point-to-point checks, initial alarm validation |
| L4 | FPT scripts, load/performance data, interlock validation, sequence verification, tuning records |
| L5 | IST scripts, IST witness records, failure scenario results, synchronized event logs, retest records |
| L6 | final Cx report, systems manual, training sign-off, spare parts confirmation, residual defects register, final handover pack |

### 7.3 Phase Exit Rules

No phase closes without:
- all mandatory deliverables present or formally waived
- open critical defects below phase threshold
- all mandatory approvals recorded
- all required predecessor gates closed

---

## 8. RFS Model

### 8.1 RFS Gate Families

The product must support multiple gate families, each with its own logic.

Minimum families:
- `internal_rfs`
- `customer_rfs`
- `electrical_rfs`
- `mechanical_rfs`
- `controls_rfs`
- `network_rfs`
- `security_rfs`
- `operational_rfs`
- `commercial_rfs`
- `cluster_rfs`

### 8.2 RFS Gate Object

```json
{
  "id": "gate_b1_elec_ready",
  "name": "Building B1 Electrical Ready for Energization",
  "gateFamily": "electrical_rfs",
  "scopeType": "building",
  "scopeRef": "B1",
  "status": "blocked",
  "confidenceScore": 42,
  "predecessors": ["gate_b1_install_complete"],
  "requiredCriteria": ["static_tests_passed", "safety_docs_approved"],
  "requiredEvidence": ["signed_checklist", "test_report", "redline_markup"],
  "requiredApprovals": ["gc_lead", "cxa", "owner_rep"],
  "criticalDefectThreshold": 0,
  "majorDefectThreshold": 2,
  "applicabilityRules": ["discipline == 'electrical'"],
  "customerVisible": false
}
```

### 8.3 Standard RFS Gate Stack by Archetype

| Archetype | Minimum Gate Stack |
|---|---|
| `retail_colo` | shell/core ready -> suite ready -> MMR ready -> customer SAT ready -> customer RFS |
| `wholesale_bts` | utility ready -> building ready -> fit-out ready -> integrated test ready -> tenant RFS |
| `enterprise_dc` | facility ready -> IT room ready -> operations ready -> owner handover ready |
| `hyperscale_region` | building energized -> hall ready -> AZ ready -> network/control plane ready -> service RFS |
| `ai_factory_campus` | power train ready -> liquid loop ready -> hall ready -> fabric ready -> cluster ready -> workload RFS |
| `modular_pod` | factory release -> site integration ready -> pod energized -> pod integrated -> program RFS |
| `brownfield_expansion` | isolation complete -> new block ready -> coexistence validated -> expansion RFS |
| `recommissioning` | scope isolated -> re-validation complete -> residual risk accepted -> re-entry RFS |
| `repurposed_fast_track` | temporary infra ready -> permanent infra ready -> cluster ready -> accelerated RFS |

### 8.4 Gate Closure Rules

A gate cannot close if any of the following are true:
- mandatory predecessor gate is open
- required evidence is missing
- required approval is missing
- any critical defect linked to the gate remains open
- linked package has unresolved failed retest status

---

## 9. Recursive Playbook Tree

### 9.1 Required Node Types

The base schema must support these node types:
- `program`
- `campus`
- `block`
- `building`
- `floor`
- `hall`
- `suite`
- `discipline`
- `system`
- `subsystem`
- `asset_group`
- `asset`
- `package`
- `activity`
- `scenario`
- `step`
- `gate`
- `document`

### 9.2 Universal Node Schema

```json
{
  "id": "node_001",
  "parentId": null,
  "nodeType": "package",
  "name": "B1 MV Switchgear Startup Package",
  "phase": "L3",
  "discipline": "electrical",
  "system": "mv_switchgear",
  "scopeType": "building",
  "scopeRef": "B1",
  "status": "in_progress",
  "progressPct": 60,
  "ownerRole": "gc_electrical_lead",
  "reviewerRole": "cxa_electrical",
  "plannedStart": "2026-07-10",
  "plannedFinish": "2026-07-14",
  "actualStart": "2026-07-11",
  "actualFinish": null,
  "durationMode": "calculated",
  "baseWorkHours": 48,
  "crewSize": 3,
  "productiveHoursPerDay": 8,
  "calendarId": "standard_6x10",
  "predecessors": ["node_0007"],
  "successors": ["node_0012"],
  "requiredCriteria": ["startup_sheet_complete", "relay_settings_verified"],
  "requiredEvidenceIds": ["ev_1001", "ev_1002"],
  "requiredApprovalRoles": ["gc_lead", "cxa"],
  "linkedGateIds": ["gate_b1_elec_ready"],
  "riskLevel": "high",
  "costBucket": "labor",
  "applicabilityRules": ["substationConfig != 'utility_fed'"],
  "sourceConfidence": "internal_estimate"
}
```

### 9.3 Relationship Types

Required relation types:
- `contains`
- `depends_on`
- `blocks`
- `evidence_for`
- `approves`
- `drives_cost_for`
- `drives_rfs_for`

### 9.4 Tree Behavior

The tree must allow:
- infinite expand/collapse
- multi-select
- filter by any field
- preserve expansion state
- search by text or tag
- aggregate status rollup to parents
- quick actions from row context menu

---

## 10. Template and Applicability Engine

### 10.1 Why a Rule Engine Is Required

The system cannot hard-code one static tree for all projects.

Different templates must activate or deactivate nodes based on:
- archetype
- cooling type
- power topology
- rack density
- redundancy
- delivery method
- certification target
- region
- customer overlay

### 10.2 Applicability Rule Syntax

Use a simple expression format:

```text
cooling.type in ['dlc','immersion']
archetype == 'ai_factory_campus'
electrical.topology in ['2N','2N+1']
program.buildingCount > 1
customerOverlay == 'google_like'
```

### 10.3 Template Layers

Each project composes templates from these layers:
- base lifecycle template
- archetype template
- regional template
- customer overlay
- certification overlay
- project-specific custom overrides

### 10.4 Mandatory Template Packs

The v2 system must ship with:
- lifecycle base pack
- electrical pack
- mechanical pack
- fire/life safety pack
- controls/DCIM pack
- security pack
- network/MMR pack
- operational readiness pack
- documentation/handover pack
- AI fabric/cluster pack

---

## 11. Checklist Engine

### 11.1 Checklist Item Requirements

Each checklist item must support:
- status
- assignee
- reviewer
- due date
- priority
- prerequisite links
- evidence requirement
- retest count
- comment history
- waiver flag
- severity if failed

### 11.2 Checklist Status Set

Required statuses:
- `not_started`
- `ready`
- `in_progress`
- `blocked`
- `on_hold`
- `failed`
- `retest_required`
- `completed`
- `waived`

### 11.3 Mandatory Checklist Behaviors

The system must:
- roll up child progress to parent nodes
- surface blocking prerequisites
- highlight overdue required items
- prevent false completion where evidence is missing
- separate `completed` from `approved`

### 11.4 Waiver Rules

Any waiver must record:
- reason
- author
- approver
- date
- residual risk
- expiry or permanent status

---

## 12. Evidence and Handover Engine

### 12.1 Evidence Item Types

Minimum evidence types:
- signed checklist
- FAT report
- SAT report
- startup sheet
- FPT report
- IST record
- OEM certificate
- calibration certificate
- redline markup
- as-built drawing
- photo
- video
- training sign-off
- SOP/EOP/MOP document
- spare parts list
- punch-list closure evidence

### 12.2 Evidence Metadata

Each evidence item requires:
- evidence ID
- title
- type
- linked node IDs
- linked gate IDs
- revision
- date
- issuer
- reviewer
- status
- required vs optional

### 12.3 Handover Pack Templates

The app must ship with pack templates for:
- owner handover
- operator handover
- customer / tenant handover
- certification witness pack
- AI cluster readiness pack

### 12.4 Handover Completeness Score

Formula:

```text
Handover Completeness % =
required accepted evidence items / total required evidence items * 100
```

---

## 13. Defect, Punch, and Retest Model

### 13.1 Defect Severity

Required severity levels:
- `critical`
- `major`
- `minor`
- `observation`

### 13.2 Defect Fields

Each defect must store:
- title
- severity
- linked node
- linked gate
- discovery phase
- discovered date
- owner
- due date
- status
- retest required
- retest result

### 13.3 Gate Interaction

Critical defects must block linked gate closure by default.

Major defects may be allowed if threshold logic permits and approval is recorded.

Minor defects may roll into residual defects if approved at handover.

---

## 14. Systems and Discipline Coverage

The v2 scope must cover at minimum:

### 14.1 Electrical

- utility interface
- substation
- transformers
- HV/MV switchgear
- LV switchgear
- generators
- ATS/STS
- UPS
- batteries / energy storage
- PDU / RPP
- busway / cable
- grounding / lightning
- EPMS / metering

### 14.2 Mechanical

- chillers
- pumps
- cooling towers / dry coolers
- CRAH / CRAC
- in-row cooling
- RDHX
- CDU
- manifolds
- liquid distribution loops
- leak detection
- water treatment / coolant quality

### 14.3 Fire / Life Safety

- fire alarm
- VESDA
- suppression
- cause and effect
- emergency interfaces
- smoke control if applicable

### 14.4 Controls / Digital

- BMS
- DCIM
- historian
- alarm routing
- network time sync
- graphics / dashboards
- API integrations

### 14.5 Security

- access control
- biometric systems
- mantraps
- CCTV
- intrusion
- visitor flow

### 14.6 Network / ICT

- carrier / MMR readiness
- diverse path verification
- structured cabling
- fiber backbone
- OOB management
- fabric readiness

### 14.7 AI / Cluster-Specific

- GPU liquid path validation
- rack manifold validation
- sidecar / rack-adjacent power systems
- high-density rack thermal acceptance
- cluster fabric bring-up readiness
- storage and AI WAN readiness

---

## 15. Scenario Library

### 15.1 Scenario Families

The app must ship with prebuilt scenario families:
- `electrical_failover`
- `mechanical_failover`
- `controls_loss`
- `fire_integration`
- `security_event`
- `network_path_loss`
- `fabric_partition`
- `liquid_cooling_fault`
- `utility_event`
- `black_start`
- `extended_soak`

### 15.2 Scenario Object

```json
{
  "id": "scn_black_start_b1",
  "name": "Black Start - Building B1",
  "phase": "L5",
  "family": "black_start",
  "scopeRef": "B1",
  "expectedOutcome": "critical loads restored within acceptance window",
  "rollbackCondition": "unsafe condition or non-recoverable failure",
  "steps": ["step_01", "step_02", "step_03"],
  "requiredWitnessRoles": ["cxa", "gc", "oem_generator", "owner_ops"],
  "requiredEvidence": ["event_log", "test_sheet", "alarm_log", "video"],
  "passCriteria": ["generator_sequence_ok", "ups_transfer_ok", "cooling_recovery_ok"]
}
```

### 15.3 AI-Focused Scenario Requirements

AI factory templates must include scenarios for:
- CDU failover
- manifold leak isolation
- rack flow imbalance
- coolant loss detection
- fabric partition
- high-density rack thermal excursion
- cluster bring-up after facility event

---

## 16. Schedule Engine

### 16.1 Schedule Requirements

The schedule engine must support:
- recursive nodes
- multiple calendars
- dependency types
- lag and lead
- phased turnover
- baseline vs current
- critical path by program
- critical path by gate family
- building / hall / package filters

### 16.2 Dependency Types

Required dependency types:
- `FS` finish-to-start
- `SS` start-to-start
- `FF` finish-to-finish
- `SF` start-to-finish

### 16.3 Duration Formula

```text
Duration Days =
(Base Work Hours / Crew Size / Productive Hours Per Day)
* Complexity Factor
* Access Factor
* Overtime Adjustment
* Retest Allowance
```

### 16.4 Progressive Turnover Rules

The engine must allow:
- one building in L5 while another is still in L3
- one hall in customer RFS while campus civil works continue elsewhere
- modular pod factory completion overlapping site preparation
- AI cluster bring-up overlapping non-critical remainder works

### 16.5 Gantt Views

Required views:
- phase view
- building/block view
- discipline/system view
- RFS gate view
- critical-path-only view

### 16.6 Mobile Behavior

Do not hide deep levels on mobile.

Instead:
- switch to drill-down mode
- use drawer detail panel
- support breadcrumb navigation

---

## 17. Cost Engine

### 17.1 Cost Philosophy

The v2 cost engine must be bottom-up and scope-driven, not only `$ / kW`.

`$/kW` may be used as one calibration signal, but not as the sole basis.

### 17.2 Primary Cost Drivers

Minimum drivers:
- IT MW
- building count
- hall count
- substation scope
- cooling topology
- liquid cooling share
- rack density class
- package count
- scenario count
- witness days
- OEM days
- test equipment days
- load bank size and duration
- regional labor mix
- delivery aggressiveness
- retest allowance
- document burden

### 17.3 Cost Buckets

Required buckets:
- labor
- OEM/vendor support
- test equipment
- load bank
- fuel / utilities for testing
- travel and per diem
- documentation and reporting
- certification / witness
- contingency

### 17.4 Cost Formula

```text
Package Labor Cost =
Resource Hours * Regional Blended Labor Rate * Shift Factor * Overtime Factor

Package Non-Labor Cost =
OEM Cost + Equipment Rental + Load Bank + Fuel + Travel + Witness + Documentation

Project Cost =
sum(all package labor + all package non-labor)
+ certification fees
+ contingency
```

### 17.5 Regional Rate Model

Regional rate cards must support:
- city or market
- role-based rates
- witness rates
- travel/per diem
- currency
- tax treatment
- source confidence
- effective date

### 17.6 Calibration Layers

Use these calibration layers:
- archetype factor
- region factor
- topology factor
- cooling factor
- phasing factor
- aggressiveness factor
- confidence band

### 17.7 Monte Carlo Positioning

Monte Carlo remains optional in v2, but if included:
- it must vary multiple drivers, not only one base estimate
- it must produce P10 / P50 / P90 or P5 / P50 / P95
- assumptions must be visible

---

## 18. Resource Engine

### 18.1 Required Roles

Minimum roles:
- program manager
- commissioning manager
- CxA engineer
- electrical field engineer
- mechanical field engineer
- controls / BMS engineer
- network / ICT engineer
- security engineer
- OEM specialist
- GC trade support
- operator representative
- witness / certification rep

### 18.2 Resource Outputs

The app must show:
- peak manpower by phase
- peak manpower by discipline
- vendor day demand
- witness day demand
- resource bottleneck periods

---

## 19. Analytics Engine

### 19.1 Required KPIs

Minimum KPIs:
- overall readiness score
- gate readiness score
- evidence completeness score
- defect closure rate
- retest burden
- critical path slip risk
- schedule variance
- cost variance
- package pass rate
- owner approval completion
- customer RFS confidence

### 19.2 Example Formulas

```text
Checklist Completion % =
completed applicable items / total applicable items * 100

Evidence Completeness % =
accepted required evidence / total required evidence * 100

Gate Readiness Score =
weighted accepted criteria / weighted applicable criteria * 100

RFS Confidence Score =
0.25 * Gate Readiness
+ 0.20 * Evidence Completeness
+ 0.15 * Test Pass Rate
+ 0.15 * Critical Path Health
+ 0.15 * Defect Closure
+ 0.10 * Approval Completion
```

### 19.3 Required Analytics Views

Required views:
- readiness heatmap by building/hall
- evidence gaps by phase
- defect aging by discipline
- retest hotspots
- cost by gate family
- risk by scenario family
- cluster-readiness dashboard for AI archetypes

---

## 20. Program Setup and Input Model

### 20.1 Program Setup Tabs

Required setup tabs:
- program profile
- topology
- phasing
- archetype
- overlays
- schedule settings
- cost settings
- reporting settings

### 20.2 Minimum Inputs

Program setup must capture:
- project name
- region
- city / market
- archetype
- optional customer overlay
- IT MW
- building count
- hall count
- delivery method
- electrical topology
- cooling topology
- liquid cooling percentage
- rack density class
- target RFS date
- certification targets
- schedule aggressiveness

### 20.3 Input Presets

The app must ship with presets for:
- enterprise 2 MW
- retail colo 5 MW
- wholesale BTS 20 MW
- hyperscale 50 MW
- AI factory 100 MW
- Stargate-like 200 MW campus
- modular 5 MW pod deployment
- brownfield expansion 10 MW
- repurposed fast-track AI hall

---

## 21. UX / Interaction Specification

### 21.1 Primary Screen Layout

Desktop layout:
- left rail: filters and saved views
- center: tree-grid / Gantt workspace
- right inspector: node detail, evidence, comments, approvals

### 21.2 Playbook Grid Columns

Minimum default columns:
- name
- phase
- gate family
- owner
- status
- readiness
- evidence
- start
- finish
- variance
- critical

### 21.3 Interaction Requirements

The app must support:
- single click select
- double click open detail
- chevron expand/collapse
- shift multi-select
- keyboard navigation
- search and highlight
- save custom view

### 21.4 Deep Expansion Requirement

Every node that has children must be expandable.

No artificial cap may be imposed by the UI.

### 21.5 Accessibility and Usability

Minimum requirements:
- keyboard navigable
- visible focus states
- color not sole carrier of status
- screen-width adaptive
- print-friendly summary views

---

## 22. Export and Reporting

### 22.1 Export Formats

Required exports:
- PDF executive report
- CSV task export
- CSV cost export
- JSON full program export
- JSON template export

### 22.2 Required PDF Sections

Minimum PDF report sections:
- program summary
- archetype and overlay summary
- phase readiness
- gate readiness
- critical path
- cost summary
- major risks
- evidence completeness
- open critical defects
- handover pack status

### 22.3 Handover Reports

Required handover report types:
- owner turnover report
- customer turnover report
- witness/certification support report
- AI cluster readiness report

---

## 23. Source Registry

### 23.1 Source Registry Object

```json
{
  "id": "src_001",
  "title": "Oracle Abilene Data Center",
  "url": "https://www.oracle.com/data-centers/abilene/",
  "publisher": "Oracle",
  "publishedDate": "2025-10-09",
  "sourceType": "official_public",
  "jurisdiction": "global",
  "usedFor": ["campus_phasing", "ai_factory_scale", "liquid_cooling_context"],
  "notes": "Used as a public benchmark for campus-scale phased turnover"
}
```

### 23.2 Governance Rules

- No benchmark appears without a source record.
- No internal estimate masquerades as a public fact.
- Source dates must be retained.
- Stale source warnings should be possible in future versions.

---

## 24. Technical Architecture

### 24.1 Delivery Model

Recommended approach:
- author in modular source files
- bundle into a single deployable HTML artifact for distribution

### 24.2 Recommended Source Layout

```text
cx-rfs-playbook/
  src/
    app/
      main.js
      state.js
      router.js
    data/
      archetypes/
      overlays/
      templates/
      sources/
      rates/
    engines/
      applicability.js
      rollup.js
      schedule.js
      cost.js
      analytics.js
      evidence.js
      rfs.js
    ui/
      treeGrid.js
      gantt.js
      filters.js
      inspector.js
      charts.js
      reports.js
    styles/
      tokens.css
      layout.css
      components.css
  build/
    bundle-to-single-html.js
  dist/
    cx-rfs-playbook.html
```

### 24.3 Persistence

v2 should support:
- in-memory state
- LocalStorage autosave
- import/export JSON

Do not require a backend for v2 baseline.

### 24.4 Performance Targets

Target performance:
- initial load under 3 seconds on modern desktop
- filter response under 200 ms for typical projects
- support at least 20,000 nodes with virtualization or incremental rendering

### 24.5 Charting and Rendering

Recommended rendering approach:
- tree-grid with DOM virtualization
- Gantt with SVG for clarity and exportability
- charts with lightweight canvas or SVG charts

### 24.6 Auth and Free/Pro Gating

Auth and marketing gating are not P0.

If retained, they must not distort the data model.

Priority order:
1. data model
2. playbook and checklist
3. gates and schedule
4. cost and analytics
5. commercial gating

---

## 25. Acceptance Criteria

### 25.1 Data Model

The build passes if:
- arbitrary-depth tree works
- node rollups work
- applicability rules enable and disable nodes correctly
- gates can link to nodes, evidence, and approvals

### 25.2 Playbook and Checklist

The build passes if:
- a user can expand from program to deep scenario steps
- blockers are visible
- evidence requirements are visible
- gate closure prevents false-complete states

### 25.3 Schedule

The build passes if:
- phased turnover works
- dependency types work
- critical path updates after date changes
- building view and gate view can be toggled

### 25.4 Cost

The build passes if:
- cost rolls up from packages
- rates are region-aware
- scenario count and witness days affect cost
- results can be broken down by phase, discipline, building, and gate

### 25.5 Analytics

The build passes if:
- readiness, evidence, defect, and confidence metrics update from live state
- AI factory templates expose cluster-specific dashboards

---

## 26. Implementation Roadmap

### 26.1 Phase A: Foundation

- define source schema
- define lifecycle base template
- define archetype template structure
- build recursive tree-grid
- build filter engine
- build LocalStorage persistence

### 26.2 Phase B: Readiness Core

- build checklist engine
- build gate engine
- build evidence tracker
- build rollup logic
- build basic exports

### 26.3 Phase C: Schedule and Cost

- build schedule engine
- build Gantt view
- build resource engine
- build cost engine
- build baseline analytics

### 26.4 Phase D: Advanced Templates

- add colo overlays
- add hyperscale overlays
- add AI factory overlays
- add hosted-capacity overlays
- add certification overlays

### 26.5 Phase E: Advanced Analytics

- add slip-risk scoring
- add Monte Carlo
- add scenario sensitivity
- add AI cluster-readiness score

---

## 27. Immediate Build Recommendation

If development starts now, the first implementation target should be:

`v2.0 Alpha = Program Setup + Recursive Playbook + Checklist + RFS Gates + Basic Gantt + Basic Cost Rollup`

Do not start with:
- PDF polish
- premium login
- decorative charts
- marketing-driven gating

Start with the system of record.

---

## 28. Key Differences vs Older Drafts

This v2 spec intentionally changes the earlier direction in the following ways:

- from `calculator-first` to `playbook-first`
- from fixed `5-level tree` to recursive hierarchy
- from `L1-L5 emphasis` to full `L0-L6 lifecycle`
- from implied readiness to explicit `RFS gate model`
- from `$/kW-heavy` estimation to scope-driven cost logic
- from phase-only view to multi-view schedule and readiness model
- from static benchmarks to source-confidence governance
- from generic data center framing to archetype + overlay architecture

---

## Appendix A. Role and Approval Matrix

### A.1 Core Roles

| Role ID | Role | Typical Responsibility |
|---|---|---|
| `owner_pm` | Owner Program Manager | program governance, commercial and date approvals |
| `owner_ops` | Owner Operations Lead | handover readiness, staffing, SOP/EOP acceptance |
| `tenant_rep` | Customer / Tenant Representative | customer-facing acceptance and customer RFS |
| `cxa_lead` | Commissioning Authority Lead | commissioning governance, scripts, closure recommendation |
| `cxa_elec` | CxA Electrical Engineer | electrical package review and approvals |
| `cxa_mech` | CxA Mechanical Engineer | mechanical package review and approvals |
| `gc_pm` | GC / EPC Project Manager | field execution ownership |
| `gc_elec_lead` | GC Electrical Lead | electrical package execution and defect closure |
| `gc_mech_lead` | GC Mechanical Lead | mechanical package execution and defect closure |
| `controls_lead` | Controls / DCIM Lead | controls integration and sequence readiness |
| `network_lead` | Network / ICT Lead | network path, MMR, fabric, and cluster connectivity readiness |
| `security_lead` | Security Systems Lead | access, CCTV, intrusion, and site access readiness |
| `oem_rep` | OEM Representative | startup, factory, vendor-specific testing and certificates |
| `witness_rep` | Witness / Certifier | independent review, certification, or formal witness |

### A.2 Approval Requirements by Lifecycle Phase

| Phase | Minimum Required Approvers |
|---|---|
| L0 | `owner_pm`, `cxa_lead`, `gc_pm` |
| L1 | `oem_rep`, `cxa_lead` or delegated discipline lead, `gc_pm` |
| L2 | `gc_trade_lead`, `cxa_discipline`, safety reviewer if applicable |
| L3 | `oem_rep`, `gc_trade_lead`, `cxa_discipline` |
| L4 | `cxa_discipline`, `owner_pm` or delegate, `controls_lead` if controls-driven package |
| L5 | `cxa_lead`, `owner_pm`, `owner_ops`, relevant `oem_rep`, witness if required |
| L6 | `owner_pm`, `owner_ops`, `cxa_lead`, `tenant_rep` if customer-facing handover |

### A.3 Approval Logic Rules

- A checklist item may be `completed` by execution owner and still remain `unapproved`.
- A package may be `technically complete` and still not close if mandatory approvers are missing.
- Customer-facing RFS gates must require `tenant_rep` or a project-configured customer delegate.
- Certification-related gates must require `witness_rep` when certification overlay is active.

---

## Appendix B. Gate Library by Lifecycle Phase

This appendix defines the minimum gate set that the v2 app should ship with. These are baseline gates and may be extended by archetype and overlay.

### B.1 L0 Gate Library

| Gate ID | Gate Name | Minimum Closure Criteria |
|---|---|---|
| `l0_opr_approved` | OPR Approved | OPR issued, owner approved, revision locked |
| `l0_bod_approved` | BOD Approved | BOD issued, cross-checked to OPR, design lead approval |
| `l0_soe_frozen` | SOO / SOE Frozen | sequences, cause-and-effect, control narratives approved |
| `l0_rfs_map_approved` | RFS Map Approved | gate families, gate owners, and acceptance logic approved |
| `l0_test_library_ready` | Test Library Ready | FAT/SAT/FPT/IST script index created and mapped to systems |
| `l0_energization_strategy_ready` | Energization Strategy Ready | safe energization paths, hold points, and permits defined |

### B.2 L1 Gate Library

| Gate ID | Gate Name | Minimum Closure Criteria |
|---|---|---|
| `l1_factory_release` | Factory Release | FAT complete, deviations closed or accepted, ship release issued |
| `l1_supplier_docs_complete` | Supplier Documentation Complete | FAT records, certs, manuals, and drawings received |
| `l1_critical_vendor_signoff` | Critical Vendor Sign-Off | OEM sign-off for critical equipment captured |

### B.3 L2 Gate Library

| Gate ID | Gate Name | Minimum Closure Criteria |
|---|---|---|
| `l2_receiving_complete` | Receiving Complete | material delivered, inspected, and discrepancies logged |
| `l2_install_complete` | Installation Complete | physical installation checklists accepted |
| `l2_static_tests_passed` | Static Tests Passed | continuity, insulation, pressure, torque, labeling complete |
| `l2_safe_to_energize` | Safe to Energize | safety approvals, lockout review, permits, static evidence complete |

### B.4 L3 Gate Library

| Gate ID | Gate Name | Minimum Closure Criteria |
|---|---|---|
| `l3_startup_complete` | Startup Complete | OEM startup records and package startup sheets accepted |
| `l3_sat_complete` | SAT Complete | standalone site acceptance tests passed |
| `l3_controls_p2p_complete` | Controls Point-to-Point Complete | mapped points verified and alarm path validated |

### B.5 L4 Gate Library

| Gate ID | Gate Name | Minimum Closure Criteria |
|---|---|---|
| `l4_performance_passed` | Functional Performance Passed | load, sequence, interlock, and alarm expectations accepted |
| `l4_controls_sequence_passed` | Controls Sequence Passed | sequence verification complete with evidence |
| `l4_pre_ist_ready` | Pre-IST Ready | L4 critical defects closed, scripts frozen, witnesses scheduled |

### B.6 L5 Gate Library

| Gate ID | Gate Name | Minimum Closure Criteria |
|---|---|---|
| `l5_ist_passed` | IST Passed | integrated scenarios executed and accepted |
| `l5_black_start_passed` | Black Start Passed | applicable blackout/black start scenarios passed |
| `l5_extended_soak_passed` | Extended Soak Passed | soak duration complete with acceptable trend data |
| `l5_cluster_ready` | Cluster Ready | AI-only: fabric, liquid, and compute prerequisites accepted |

### B.7 L6 Gate Library

| Gate ID | Gate Name | Minimum Closure Criteria |
|---|---|---|
| `l6_handover_pack_complete` | Handover Pack Complete | required documents, as-builts, and evidence accepted |
| `l6_training_complete` | Training Complete | required training sessions completed and signed off |
| `l6_residual_risk_accepted` | Residual Risk Accepted | residual defect and risk register approved |
| `l6_owner_turnover_complete` | Owner Turnover Complete | owner acceptance and operational handover complete |
| `l6_customer_rfs_complete` | Customer RFS Complete | customer-facing ready-for-service acceptance complete |

---

## Appendix C. Archetype Overlay Matrix

### C.1 Overlay Matrix

| Overlay | Additional Required Gate Families | Additional Required Systems | Special Notes |
|---|---|---|---|
| `aws_like` | `network_rfs`, `cluster_rfs` for AI-heavy templates | mixed air/liquid cooling, rack-adjacent backup, high-density hall controls | model mixed cooling and rack-proximate resilience scenarios |
| `google_like` | `cluster_rfs`, `controls_rfs` | CDU redundancy, sidecar power racks, high-density rack liquid path, advanced telemetry | must support high-density rack and DC power distribution abstractions |
| `microsoft_like` | `network_rfs`, `cluster_rfs`, `operational_rfs` | AZ structure, AI fabric, storage/fabric separation, closed-loop cooling | availability zone as scope object is mandatory |
| `oracle_stargate_like` | `electrical_rfs`, `cluster_rfs`, `commercial_rfs` | multi-building campus, rapid partial go-live, liquid cooling backbone | phased campus turnover mandatory |
| `meta_like` | `network_rfs`, `operational_rfs` | OCP-style mechanical/electrical packs, large-scale campus phasing | heavy use of repeatable campus templates |
| `colo_operator_like` | `customer_rfs`, `commercial_rfs`, `security_rfs` | MMR, carrier, customer suite readiness, access control | customer-facing gates become default, not optional |
| `ai_hosted_capacity_like` | `cluster_rfs`, `commercial_rfs` | hosted-capacity onboarding, fabric/service acceptance, provider boundary documents | use when the user is not the facility owner |
| `xai_fast_track_like` | `electrical_rfs`, `mechanical_rfs`, `cluster_rfs` | fast-track power, temporary systems, compressed startup and soak windows | risk scoring and exception handling weighted more heavily |

### C.2 Overlay Precedence

Precedence order for rules:
1. project-specific overrides
2. certification overlay
3. customer overlay
4. archetype template
5. lifecycle base template

If two overlays conflict:
- the higher precedence overlay wins
- the conflict must be logged in an assumptions record

---

## Appendix D. UI State and Saved View Schema

### D.1 Saved View Use Cases

Users must be able to save views such as:
- `Critical Path - Electrical`
- `Customer RFS - Hall B`
- `AI Cluster Readiness - Campus 01`
- `L5 IST Open Blockers`
- `Handover Pack Gaps`

### D.2 Saved View Schema

```json
{
  "id": "view_critical_path_electrical",
  "name": "Critical Path - Electrical",
  "module": "Schedule",
  "filters": {
    "discipline": ["electrical"],
    "criticalOnly": true,
    "statusNotIn": ["completed", "waived"]
  },
  "columns": ["name", "owner", "status", "plannedFinish", "variance"],
  "sort": [
    { "field": "plannedFinish", "direction": "asc" }
  ],
  "layout": {
    "leftRailOpen": true,
    "inspectorOpen": false,
    "ganttZoom": "week"
  }
}
```

### D.3 UI State Requirements

The app must persist:
- last selected project
- expansion state
- active filters
- saved views
- panel widths where practical
- last opened module

---

## Appendix E. QA and Validation Matrix

### E.1 Core QA Matrix

| Test ID | Scenario | Expected Result |
|---|---|---|
| `qa_tree_001` | expand a 7-level hierarchy | all children render correctly and parent rollups remain accurate |
| `qa_gate_001` | attempt to close a gate with missing evidence | gate remains blocked and missing evidence is surfaced |
| `qa_gate_002` | close all criteria and approvals for a gate | gate closes and rollups update |
| `qa_cost_001` | change region and labor model | cost updates without corrupting package structure |
| `qa_sched_001` | move one predecessor task | dependent tasks and critical path update correctly |
| `qa_sched_002` | run phased turnover across two buildings | building B can reach RFS while building A remains in earlier phase |
| `qa_ai_001` | AI archetype with cluster gate enabled | cluster-specific packages and gates become applicable |
| `qa_mobile_001` | deep drill-down on mobile | no data level is hidden; drill-down remains possible |
| `qa_export_001` | export handover pack status | report contains gate, evidence, defect, and approval summaries |

### E.2 Benchmark Governance QA

| Test ID | Scenario | Expected Result |
|---|---|---|
| `qa_source_001` | create benchmark without source record | save blocked |
| `qa_source_002` | create internal estimate benchmark | source confidence must be `internal_estimate` |
| `qa_source_003` | update source date | stale warning mechanism remains compatible |

---

## Appendix F. Fifty Enhancement Directives

All items in this appendix are normative additions to the spec. They are not optional brainstorming notes. They are part of the v2 build intent.

### F.1 Data Model and Scope Enhancements

1. Add a `program assumptions register` object so project-level assumptions are explicit, versioned, and reviewable.
Affected areas: Program Setup, Source Registry, Exports.

2. Add a `design deviation register` object to track departures from base template, OPR, or customer overlay.
Affected areas: Lifecycle Model, Checklist, Evidence, Exports.

3. Add `availability_zone` as a first-class scope type for hyperscale-region templates.
Affected areas: Archetypes, Playbook Tree, RFS Model, Schedule.

4. Add `cluster` as a first-class scope type for AI factory templates.
Affected areas: Archetypes, RFS Model, Scenario Library, Analytics.

5. Add `customer_space` or `customer_suite` as a first-class scope type for colo templates.
Affected areas: Archetypes, Playbook Tree, Customer RFS, Exports.

6. Add `temporary_system` as a node type for fast-track and repurposed-building projects.
Affected areas: Playbook Tree, Applicability Engine, Schedule, Cost.

7. Separate `package` from `scenario` and `step` in the base schema so test execution and construction scope are not conflated.
Affected areas: Playbook Tree, Checklist, Scenario Library.

8. Add document revision workflow fields to every evidence record: `rev`, `supersedes`, `isCurrent`.
Affected areas: Evidence, Handover, Source Registry.

9. Add a distinct `handover_pack` object rather than modeling handover only as loose evidence items.
Affected areas: Evidence, Exports, RFS Model.

10. Require `sourceConfidence` and `sourceId` on every benchmarked template rule, rate card, or market assumption.
Affected areas: Cost, Source Registry, Analytics.

### F.2 Workflow and Gate Enhancements

11. Add a `gate quorum` rule so some gates can require multiple approvals, not only one approver per role.
Affected areas: RFS Model, Checklist, Role Matrix.

12. Add `defect threshold policy` by gate family so each gate can tolerate or block different classes of open items.
Affected areas: RFS Model, Defect Model, Analytics.

13. Add `waiver expiry` and `waiver review date` fields so temporary waivers do not become permanent by accident.
Affected areas: Checklist, Evidence, Handover.

14. Add a `residual risk acceptance` object with owner, approver, date, and linked defects.
Affected areas: L6, Defect Model, Exports.

15. Add a `customer acceptance log` separate from internal completion to capture external objections, comments, and acceptance dates.
Affected areas: Customer RFS, Handover, Exports.

16. Add `witness scheduling` as a first-class planning object to avoid witness dependency becoming an implicit note.
Affected areas: Schedule, Resources, Cost.

17. Add `OEM attendance planning` at package/scenario level so startup and witness days are calculable and schedulable.
Affected areas: Resources, Cost, Schedule.

18. Require `rollbackCondition` for every L5 scenario and any high-risk L4 scenario.
Affected areas: Scenario Library, Checklist, QA.

19. Add `retest lineage` so the app can show original test, failed retest, corrective action, and closure trace.
Affected areas: Defect Model, Checklist, Evidence, Analytics.

20. Add a `hold point` status distinct from `blocked` for user-controlled execution pauses that are not caused by unmet prerequisites.
Affected areas: Checklist, Schedule, Analytics.

### F.3 Schedule and Resource Enhancements

21. Support multiple calendars by project area such as `factory`, `site_day_shift`, `site_night_shift`, `live_site_window`.
Affected areas: Schedule, Archetypes, Resources.

22. Add `baseline freeze` and `rebaseline history` so schedule slippage is auditable over time.
Affected areas: Schedule, Analytics, Exports.

23. Add an `access window factor` for restricted work periods in live sites, brownfield projects, or customer areas.
Affected areas: Schedule, Cost, Archetypes.

24. Add `work zone conflict detection` so overlapping packages in the same physical area are flagged.
Affected areas: Schedule, Analytics, Playbook Tree.

25. Add a `load bank sizing object` with MW, power factor, redundancy path, and duration rather than a simple cost factor.
Affected areas: Cost, Scenario Library, Schedule.

26. Add `temporary utility consumption` and `fuel burn during test` as explicit cost and logistics fields.
Affected areas: Cost, Resources, Exports.

27. Add `documentation labor` as its own cost bucket instead of burying it inside generic contingency or overhead.
Affected areas: Cost, Resources, Handover.

28. Add `schedule aggressiveness` and `compression strategy` fields so fast-track projects can be modeled transparently.
Affected areas: Program Setup, Schedule, Cost, Archetypes.

29. Add `cost confidence bands` by package, not only one global project confidence band.
Affected areas: Cost, Analytics, Exports.

30. Add `delay-cost per gate` logic so missed internal or customer RFS gates can produce differentiated financial impact.
Affected areas: Cost, Analytics, Customer RFS.

### F.4 UX and Analytics Enhancements

31. Replace any mobile hidden-depth behavior with a `drill-down drawer` pattern that preserves full hierarchy access.
Affected areas: UX, Playbook Tree, Schedule.

32. Add `saved views` for discipline, building, customer, gate, and executive contexts.
Affected areas: UX, UI State, Exports.

33. Add `tag-based deep search` across nodes, evidence, gates, and defects.
Affected areas: UX, Playbook Tree, Evidence.

34. Add `bulk assign`, `bulk status update`, and `bulk evidence link` actions for large packages.
Affected areas: Checklist, Playbook Tree, UX.

35. Add `readiness heatmaps` by campus, building, hall, and gate family.
Affected areas: Analytics, UX.

36. Add `AI cluster readiness dashboard` showing liquid path, power path, fabric, storage, and witness status.
Affected areas: Analytics, Archetypes, Exports.

37. Add `handover completeness dashboard` broken down by owner, operator, customer, and witness pack.
Affected areas: Analytics, Handover, Exports.

38. Add `forecast trendlines` for readiness and confidence score rather than only current-state KPIs.
Affected areas: Analytics, Schedule.

39. Add a `benchmark provenance panel` in the UI so the user can see which public facts and which internal heuristics are shaping outputs.
Affected areas: Sources, Cost, Analytics.

40. Add an `exception inbox` view for blocked gates, overdue approvals, missing evidence, and critical defects.
Affected areas: Checklist, Analytics, UX.

### F.5 Governance, Build, and Platform Enhancements

41. Add `project JSON import/export` as a mandatory platform feature, not a later convenience feature.
Affected areas: Technical Architecture, Exports.

42. Add `LocalStorage autosave` plus recovery from corrupted or incomplete sessions.
Affected areas: Technical Architecture, QA.

43. Add a `build-to-single-html pipeline` so the source remains modular but deploys as one artifact.
Affected areas: Technical Architecture.

44. Add `virtualized tree rendering` for large projects with tens of thousands of nodes.
Affected areas: Technical Architecture, UX, Performance.

45. Add `keyboard-first navigation` and accessibility requirements as hard acceptance criteria.
Affected areas: UX, Acceptance Criteria, QA.

46. Add a `synthetic demo data pack` large enough to stress-test performance and deep hierarchy behavior.
Affected areas: QA, Technical Architecture.

47. Add deterministic `seed project templates` so QA and demos can be reproduced reliably.
Affected areas: Program Setup, QA, Archetypes.

48. Add an `overlay conflict log` so users can see when customer, archetype, or certification overlays disagree.
Affected areas: Applicability Engine, Source Registry, Analytics.

49. Add an `audit trail` for status changes, waivers, approvals, and gate closures.
Affected areas: Checklist, RFS Model, Technical Architecture.

50. Add `future adapter points` for DCIM, CMMS, document systems, and schedule tools even if v2 remains offline and client-side.
Affected areas: Technical Architecture, Source Registry, Exports.

---

## 29. Source Appendix

Primary public sources used as anchor references for v2 design:
- OpenAI Stargate announcement: https://openai.com/index/announcing-the-stargate-project/
- OpenAI infrastructure update: https://openai.com/index/building-openai/
- Oracle Abilene campus: https://www.oracle.com/data-centers/abilene/
- AWS new data center power/cooling components: https://press.aboutamazon.com/2024/12/aws-announces-new-data-center-components-to-support-ai-innovation-and-further-improve-energy-efficiency
- AWS Project Rainier: https://www.aboutamazon.com/news/aws/aws-project-rainier-ai-trainium-chips-compute-cluster
- Amazon on Anthropic and Rainier: https://www.aboutamazon.com/news/aws/project-rainier-ai-anthropic
- Google infrastructure for 1 MW racks and liquid cooling: https://cloud.google.com/blog/topics/systems/enabling-1-mw-it-racks-and-liquid-cooling-at-ocp-emea-summit/
- Google cloud data center architecture and availability zones: https://cloud.google.com/blog/products/infrastructure/understanding-cloud-datacenter-architecture-availability-zones
- Microsoft Saudi Arabia region and three availability zones: https://news.microsoft.com/source/emea/2026/02/microsoft-confirms-saudi-arabia-datacenter-region-available-for-customers-to-run-cloud-workloads-from-q4-2026/
- Microsoft Azure AI superfactory architecture: https://blogs.microsoft.com/blog/2025/11/12/infinite-scale-the-architecture-behind-the-azure-ai-superfactory/
- Microsoft AI data center profile: https://blogs.microsoft.com/blog/2025/09/18/inside-the-worlds-most-powerful-ai-datacenter/
- xAI Colossus: https://x.ai/colossus
- Memphis utility xAI information page: https://www.mlgw.com/xai
- Anthropic on Google Cloud TPUs and services: https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services
- ASHRAE Guideline 0 overview: https://www.ashrae.org/technical-resources/bookstore/guideline-0-2019-the-commissioning-process
- ASHRAE titles, purposes and scopes: https://www.ashrae.org/technical-resources/standards-and-guidelines/titles-purposes-and-scopes
- Uptime Institute tier certification preparation: https://journal.uptimeinstitute.com/tiercertificationpreparation/

---

## 30. Final Build Position

This product should be built as a `delivery governance system for commissioning + RFS`, not as a decorative estimator.

If implemented to this spec, it can become:
- a reusable internal playbook
- a customer-facing readiness framework
- a cost and schedule estimator grounded in execution reality
- a differentiated tool for colo, hyperscale, and AI-factory delivery programs
