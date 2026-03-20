# Data Center Commissioning Playbook App
## Specification v2.0 - Commissioning Only

Status: Build-ready draft
Date: 2026-03-18

This document is intentionally `commissioning-only`.

Excluded from this session and this specification:
- service-readiness taxonomy
- external readiness gates
- commercial readiness
- tenant acceptance logic as a first-class workflow

Included in this specification:
- commissioning lifecycle L0-L6
- commissioning checklists
- commissioning phase gates
- factory / site / startup / FPT / IST packages
- cost, schedule, resources, evidence, defects, analytics, and turnover packs

Authoring basis:
- [cx-calculator-design.md](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md)
- [cx-rfs-playbook-review-2026-03-18.md](/home/baguspermana7/rz-work/Article/Cx/Codex%20Review/cx-rfs-playbook-review-2026-03-18.md)

---

## 0. Purpose

This v2 specification defines a build-oriented commissioning application for data center projects.

The product is not just a cost estimator.

It is a combined:
- commissioning playbook
- package library
- checklist engine
- phase gate tracker
- schedule engine
- cost engine
- evidence and closeout tracker
- analytics layer

The target outcome is a reusable internal commissioning standard that can be applied to:
- enterprise DC
- colocation
- hyperscale
- AI factory / GPU campus
- modular pod deployments
- brownfield expansion
- recommissioning
- fast-track repurposed facilities

---

## 1. Product Definition

### 1.1 Product Name

`Data Center Commissioning Playbook App`

Short label:

`Cx Playbook`

### 1.2 Product Purpose

Provide one system to define, estimate, track, and evidence the full commissioning program from design preparation through final turnover.

The app must answer:
- what commissioning scope exists
- what is applicable for this archetype
- what is complete or incomplete
- what phase gates are blocked
- what tests, evidence, and approvals are missing
- what the likely cost and schedule look like
- where the highest execution risk sits

### 1.3 Product Boundary

In scope:
- commissioning planning
- commissioning execution structure
- commissioning package tracking
- phase exit logic
- evidence and closeout
- commissioning analytics

Out of scope:
- full operations platform
- customer service-readiness framework
- commercial service activation
- live telemetry ingestion as a core requirement
- CMMS functionality

### 1.4 Product Principle

`Playbook-first, calculator-second`

The source of truth is the commissioning tree and its gate logic.

Charts, KPIs, and cost numbers are downstream views from that source of truth.

---

## 2. Core Design Decisions

### 2.1 Lifecycle Coverage Is L0-L6

The app must cover the full commissioning lifecycle:
- L0 design and planning
- L1 factory testing
- L2 installation and static verification
- L3 startup and pre-functional testing
- L4 functional performance testing
- L5 integrated systems testing
- L6 closeout and turnover

### 2.2 Recursive Hierarchy

The app must support arbitrary depth and must not be hard-limited to a 5-level model.

Typical hierarchy may include:
- program
- campus
- block
- building
- floor
- hall
- discipline
- system
- subsystem
- package
- scenario
- step
- evidence

### 2.3 Archetype-Driven Templates

The app must be driven by:
- a lifecycle base template
- an archetype template
- optional operator overlay
- optional regional overlay
- optional certification overlay

### 2.4 Public-Source Governance

Every exact benchmark or operator-specific assumption must be tagged by confidence:
- `official_public`
- `primary_public_non_official`
- `secondary_public`
- `internal_estimate`
- `expert_assumption`

### 2.5 Modular Authoring, Single-File Distribution Allowed

The source should be modular.

The output may still be distributed as a single HTML artifact.

### 2.6 Standards Alignment Model

This commissioning spec must align to ASHRAE, TIA, and Uptime, but it must not misuse them as if they were interchangeable.

Use them as follows:

- `ASHRAE` governs the commissioning process backbone:
  - OPR
  - BOD
  - commissioning planning
  - issue tracking
  - functional performance verification
  - systems manual and closeout philosophy

- `TIA-942` governs physical infrastructure domains and data center terminology:
  - telecommunications spaces
  - architectural, electrical, mechanical, fire, security, and telecom domains
  - infrastructure topology vocabulary
  - rated-site concepts and scope coverage

- `Uptime Institute` governs performance-based resiliency overlays when selected:
  - Tier intent
  - concurrently maintainable / fault tolerant expectations
  - constructed-facility performance demonstration overlays

Implementation rule:
- the equipment tree is not directly dictated by any one standard
- the equipment tree is generated from project inputs
- the generated tree is then validated against ASHRAE process requirements, TIA infrastructure domains, and optional Uptime performance overlays

Important caution:
- do not present TIA Rated-1..4 and Uptime Tier I..IV as if they are identical certifications
- if both appear in the product, show them as separate overlays with an optional advisory crosswalk, not as one merged classification

---

## 3. Users

| User | Primary Need |
|---|---|
| Owner PM | monitor cost, dates, gate status, and risk |
| CxA Lead | define commissioning logic, scripts, and closure rules |
| Discipline Cx Engineer | execute and review package-level commissioning |
| GC / EPC Lead | manage package completion and blockers |
| OEM Specialist | execute FAT/startup/vendor-specific tests |
| Operations Readiness Lead | receive turnover pack, training, and systems manual |
| Executive | view compressed summary and forecast risk |

---

## 4. Supported Project Archetypes

| Archetype ID | Name | Typical Characteristics |
|---|---|---|
| `enterprise_dc` | Enterprise / private DC | owner-operated, documentation-heavy |
| `retail_colo` | Retail colocation | multi-suite, repeatable halls, strong documentation and controls |
| `wholesale_bts` | Wholesale / BTS | phased buildings and fit-out boundaries |
| `hyperscale_region` | Hyperscale cloud region | multi-building, phased turnover, aggressive schedule |
| `ai_factory_campus` | AI factory / GPU campus | very high density, liquid cooling, cluster integration |
| `modular_pod` | Modular / prefab pod | factory-site split, integration-heavy site work |
| `brownfield_expansion` | Brownfield expansion | coexistence with live systems, restricted access windows |
| `recommissioning` | Recommissioning | heavy L3-L6 focus, verification of existing systems |
| `repurposed_fast_track` | Repurposed building fast-track | compressed timeline, temporary systems possible |

### 4.1 Optional Operator Overlays

Operator overlays adjust rigor, package emphasis, and benchmark assumptions without changing session scope away from commissioning.

Initial overlays:
- `generic_standard`
- `aws_like`
- `google_like`
- `microsoft_like`
- `oracle_ai_campus_like`
- `meta_like`
- `xai_fast_track_like`
- `colo_operator_like`

---

## 5. Public Benchmark Anchors

The app should be designed with awareness of publicly disclosed large-scale operator patterns.

As of 2026-03-18, public disclosures indicate:
- OpenAI announced Stargate on 2025-01-21 and later said on 2025-07-22 that more than `5 GW` was under development.
- Oracle publicly describes the Abilene campus as eight buildings, more than four million square feet, up to `1.2 GW`, and going live in less than a year from construction start.
- AWS publicly describes new power and cooling components for higher resilience and mixed air/liquid cooling.
- Google publicly describes infrastructure for `1 MW` IT racks, `+-400 VDC`, redundant CDUs, and high liquid-cooling maturity.
- Microsoft publicly describes AI superfactory architecture and availability-zone power/cooling/network separation.
- xAI publicly describes Colossus 2 at `200,000 GPUs` and a very compressed build model.

Commissioning implications:
- campus-scale phasing matters
- building-level and hall-level turnover matter
- liquid cooling must be native to the model
- cluster-related commissioning packages matter in AI archetypes
- fast-track and repurposed-building paths need dedicated templates

---

## 6. Product Modules

The v2 app must contain:
- `Program Setup`
- `Playbook`
- `Checklist`
- `Phase Gates`
- `Schedule`
- `Cost`
- `Resources`
- `Evidence`
- `Analytics`
- `Exports`
- `Sources`

### 6.1 Module Objectives

| Module | Objective |
|---|---|
| Program Setup | define archetype, overlays, topology, dates, and scope |
| Playbook | render the full commissioning tree |
| Checklist | manage package and step completion |
| Phase Gates | track commissioning phase exits and readiness to proceed |
| Schedule | render durations, dependencies, baselines, and critical path |
| Cost | estimate and roll up commissioning cost |
| Resources | plan role loading and vendor/witness presence |
| Evidence | track required records and closeout documentation |
| Analytics | expose progress, defects, forecast risk, and readiness |
| Exports | produce PDF, CSV, JSON, and closeout outputs |
| Sources | show benchmark provenance and confidence |

---

## 7. Lifecycle Model

### 7.1 Phase Definitions

| Phase | Name | Intent |
|---|---|---|
| L0 | Design & Planning | define what will be commissioned, how, when, and by whom |
| L1 | Factory Testing / FAT | validate equipment before shipment |
| L2 | Delivery / Installation / Static | verify installation completeness and safe readiness |
| L3 | Startup / SAT / Pre-Functional | prove standalone system operation |
| L4 | Functional Performance Testing | prove sequence, load, and design behavior |
| L5 | Integrated Systems Testing | prove integrated facility behavior under scenarios |
| L6 | Closeout / Turnover | transfer evidence, manuals, training, and residual risk record |

### 7.2 Mandatory Deliverables by Phase

| Phase | Mandatory Deliverables |
|---|---|
| L0 | OPR, BOD, SOO, cause-and-effect matrix, points list, commissioning plan, test strategy, energization plan |
| L1 | FAT scripts, FAT reports, supplier deviations log, release-to-ship records |
| L2 | installation checklists, receiving reports, static test results, redline markups, safe-to-energize packages |
| L3 | startup sheets, SAT results, OEM startup certificates, point-to-point checks |
| L4 | FPT scripts, performance logs, interlock validation, tuning records |
| L5 | IST scripts, witness records, event logs, retest results, integrated scenario reports |
| L6 | final Cx report, systems manual, O&M package, training sign-off, residual defect register |

### 7.3 Phase Exit Rules

A phase cannot close until:
- all mandatory deliverables exist or are formally waived
- phase-critical defects are below threshold
- mandatory approvals are recorded
- predecessor phase gates are closed

---

## 8. Commissioning Gate Model

This specification focuses on commissioning phase gates and package gates only.

### 8.1 Gate Families

Required gate families:
- `design_gate`
- `factory_gate`
- `installation_gate`
- `startup_gate`
- `performance_gate`
- `integration_gate`
- `turnover_gate`

### 8.2 Gate Object

```json
{
  "id": "gate_b1_safe_to_energize",
  "name": "Building B1 Safe to Energize",
  "gateFamily": "installation_gate",
  "scopeType": "building",
  "scopeRef": "B1",
  "status": "blocked",
  "predecessors": ["gate_b1_install_complete"],
  "requiredCriteria": ["static_tests_passed", "safety_docs_approved"],
  "requiredEvidence": ["signed_checklist", "test_report", "redline_markup"],
  "requiredApprovals": ["gc_elec_lead", "cxa_elec", "safety_reviewer"],
  "criticalDefectThreshold": 0,
  "majorDefectThreshold": 2
}
```

### 8.3 Standard Phase Gate Stack

| Phase | Minimum Gates |
|---|---|
| L0 | OPR approved, BOD approved, SOO frozen, test library ready |
| L1 | factory release, supplier docs complete |
| L2 | receiving complete, installation complete, static tests passed, safe to energize |
| L3 | startup complete, SAT complete, controls point-to-point complete |
| L4 | performance passed, controls sequence passed, pre-IST ready |
| L5 | IST passed, black start passed where applicable, extended soak passed where applicable |
| L6 | closeout pack complete, training complete, residual risk accepted, turnover complete |

### 8.4 Gate Closure Rules

A gate cannot close if:
- mandatory predecessor gates are open
- mandatory evidence is missing
- mandatory approvers are missing
- linked critical defects are open
- linked retest-required items are unresolved

---

## 9. Recursive Playbook Tree

### 9.1 Required Node Types

The tree must support:
- `program`
- `campus`
- `block`
- `building`
- `floor`
- `hall`
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
  "baseWorkHours": 48,
  "crewSize": 3,
  "calendarId": "standard_6x10",
  "predecessors": ["node_0007"],
  "requiredCriteria": ["startup_sheet_complete", "relay_settings_verified"],
  "requiredEvidenceIds": ["ev_1001", "ev_1002"],
  "requiredApprovalRoles": ["gc_elec_lead", "cxa_elec"],
  "linkedGateIds": ["gate_b1_safe_to_energize"],
  "riskLevel": "high",
  "costBucket": "labor",
  "applicabilityRules": ["substationConfig != 'utility_fed'"],
  "sourceConfidence": "internal_estimate"
}
```

### 9.3 Tree Behaviors

Required behaviors:
- arbitrary depth expansion
- status rollup to parents
- multi-select
- deep search
- filtering by archetype, phase, building, discipline, system, owner, status, criticality
- bulk actions on selected items

---

## 10. Template and Applicability Engine

The app must not hard-code one static tree.

### 10.1 Template Layers

Each project composes:
- lifecycle base template
- archetype template
- regional template
- operator overlay
- certification overlay
- project-specific overrides

### 10.2 Applicability Rule Syntax

```text
cooling.type in ['dlc','immersion']
archetype == 'ai_factory_campus'
electrical.topology in ['2N','2N+1']
program.buildingCount > 1
overlay == 'google_like'
```

### 10.3 Required Template Packs

The v2 app must ship with:
- lifecycle base pack
- electrical pack
- mechanical pack
- fire/life safety pack
- controls/DCIM pack
- security pack
- network/MMR pack
- documentation/turnover pack
- AI fabric/cluster commissioning pack

---

## 11. Checklist Engine

### 11.1 Checklist Item Fields

Every checklist item must support:
- status
- assignee
- reviewer
- due date
- priority
- prerequisites
- evidence requirement
- retest count
- comment history
- waiver flag
- severity if failed

### 11.2 Status Set

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

### 11.3 Checklist Rules

The system must:
- roll up child status to parent packages
- distinguish `completed` from `approved`
- surface overdue and blocked items
- prevent false completion if evidence is missing

---

## 12. Evidence and Closeout Engine

### 12.1 Evidence Types

Minimum evidence types:
- FAT report
- SAT report
- startup sheet
- FPT report
- IST report
- OEM certificate
- calibration certificate
- signed checklist
- redline markup
- as-built drawing
- photo
- video
- training sign-off
- systems manual
- residual defect register

### 12.2 Evidence Metadata

Each evidence item requires:
- evidence ID
- title
- type
- linked node IDs
- revision
- issuer
- reviewer
- date
- status
- required vs optional

### 12.3 Closeout Pack

The app must support a commissioning closeout pack containing:
- final Cx report
- systems manual
- training records
- critical test reports
- final approved redlines
- accepted residual defects

---

## 13. Defect, Punch, and Retest Model

### 13.1 Severity

Required severities:
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

Critical defects block gate closure by default.

Major defects may be allowed only if gate policy permits and approval is recorded.

Minor defects may carry to closeout if formally accepted.

---

## 14. Systems and Discipline Coverage

### 14.1 Electrical

- utility interface
- substation
- transformers
- HV/MV switchgear
- LV switchgear
- generators
- ATS / STS
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
- liquid loops
- leak detection
- coolant quality / water treatment

### 14.3 Fire / Life Safety

- fire alarm
- VESDA
- suppression
- cause-and-effect
- emergency interfaces

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
- biometrics
- mantraps
- CCTV
- intrusion

### 14.6 Network / ICT

- carrier / MMR readiness for commissioning scope
- diverse path verification
- structured cabling
- fiber backbone
- OOB management
- fabric readiness where applicable

### 14.7 AI / Cluster-Specific

- GPU liquid path validation
- rack manifold validation
- sidecar or rack-adjacent power systems
- high-density rack thermal acceptance
- cluster fabric bring-up commissioning
- storage / AI WAN commissioning packages where included in scope

---

## 15. Scenario Library

### 15.1 Scenario Families

The app must ship with:
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
  "requiredWitnessRoles": ["cxa_lead", "gc_pm", "oem_rep", "owner_pm"],
  "requiredEvidence": ["event_log", "test_sheet", "alarm_log", "video"],
  "passCriteria": ["generator_sequence_ok", "ups_transfer_ok", "cooling_recovery_ok"]
}
```

---

## 16. Schedule Engine

### 16.1 Schedule Modeling Principle

The underlying playbook data model remains recursive.

However, the default Gantt and schedule experience must present a standardized `5-level expandable hierarchy` so users can consistently navigate from phase to equipment package without ambiguity.

The required default hierarchy is:

| Level | Label | Purpose |
|---|---|---|
| 1 | Commissioning Phase | L0-L6 summary band |
| 2 | Discipline | Electrical, Mechanical, Fire/Life Safety, Controls, Security, ICT/Network, AI/Fabric |
| 3 | System Group | major system family inside the discipline |
| 4 | Equipment / Major Asset | lineup, generator, UPS module set, chiller, CDU, panel, pump, etc. |
| 5 | Activity / Test Package | actual schedulable commissioning package for that equipment |

Rule:
- level 5 is the lowest default schedule row in the Gantt
- deeper execution detail can still exist in checklist or inspector views
- schedule bars may be rendered at levels 1-5, but level 5 is the primary planning grain

### 16.2 Mandatory Expand / Collapse Behavior

The schedule must support:
- expand from phase to discipline
- expand from discipline to system group
- expand from system group to equipment
- expand from equipment to activity / test package
- collapse any level independently
- preserve expansion state per saved view

### 16.3 Row Population Rules

Level 1 rules:
- one row per lifecycle phase
- durations are rollups from child rows
- no direct manual progress entry unless explicitly enabled for executive override

Level 2 rules:
- rows exist only for disciplines applicable to the project
- non-applicable disciplines are suppressed by applicability rules

Level 3 rules:
- rows represent system groups, not generic labels
- system group naming must be normalized to avoid duplicate synonyms

Level 4 rules:
- rows represent actual equipment or equipment sets
- equipment rows may represent:
  - one named asset
  - one lineup
  - one plant train
  - one redundant pair
  - one package set if the project chooses grouped planning

Level 5 rules:
- rows represent schedulable commissioning work packages
- each row must have:
  - owner role
  - planned dates
  - duration basis
  - predecessor set
  - evidence expectation
  - linked phase gate where relevant

### 16.4 Standard Level 2 Discipline Library

| Discipline | Use Rule |
|---|---|
| Electrical | always applicable |
| Mechanical | always applicable |
| Fire/Life Safety | always applicable |
| Controls/DCIM | applicable if facility uses centralized controls or BMS/DCIM |
| Security | applicable if security systems are in commissioning scope |
| ICT/Network | applicable when network, carrier, MMR, or OOB systems are in commissioning scope |
| AI/Fabric | applicable for AI factory or any project with cluster/fabric commissioning scope |

### 16.5 Equipment-Level Schedule Library

The v2 app must ship with the following minimum schedule library.

| Discipline | Level 3 System Group | Level 4 Equipment / Asset Examples | Level 5 Activity / Test Package Examples |
|---|---|---|---|
| Electrical | Utility Interface / Substation | utility incomer, transformer T1, MV lineup A, relay panel RP-01 | utility coordination review, relay settings validation, HV static tests, energization package |
| Electrical | HV/MV Switchgear | lineup SWG-A, feeder cubicle A01, bus section A-B | visual/mechanical inspection, IR test, contact resistance, relay secondary injection, breaker timing |
| Electrical | Transformers | TX-01, TX-02 | TTR, winding resistance, insulation resistance, power factor, tap changer operation, oil sample review |
| Electrical | Generators | GEN-01, GEN-02, day tank set A | prestart inspection, fuel transfer test, engine start, load bank package, load rejection, control/alarm package |
| Electrical | UPS | UPS-A, UPS-B, battery string A1, STS-01 | IO verification, battery autonomy test, transfer test, bypass test, module swap test, communication test |
| Electrical | Distribution | PDU-A, RPP-01, busway section B1 | installation verification, metering check, breaker setting review, phase rotation, downstream load-path validation |
| Mechanical | Chiller Plant | CH-01, CH-02, primary pump P-1, secondary pump P-2 | prestart checklist, rotation check, safeties test, flow validation, sequence/startup package, performance package |
| Mechanical | Heat Rejection | CT-01, CT-02, dry cooler bank D-1 | fan sequence, valve operation, chemical/water treatment verification, temperature approach test |
| Mechanical | Airside Cooling | CRAH-01, CRAC-02, in-row unit IR-05 | fan package, valve/sensor package, airflow verification, alarm package, sequence package |
| Mechanical | Liquid Cooling | CDU-01, CDU-02, manifold M-1, liquid loop LL-A | flush and clean package, leak test, pump package, flow balance, alarm/interlock package, failover package |
| Mechanical | Fuel / Ancillary Mech | fuel transfer pump, day tank, exhaust fan, lube oil heater | auxiliary package, interlock package, fuel replenishment package |
| Fire/Life Safety | Detection | fire panel FP-01, loop L-A, VESDA V-01 | panel config review, loop test, detector test, VESDA alarm threshold test |
| Fire/Life Safety | Suppression | clean agent zone Z-01, release panel RP-01 | release circuit test, abort test, supervisory alarm test, cross-zone interlock test |
| Controls/DCIM | Field Controls | controller C-01, panel PLC-01, sensor group SG-1 | point-to-point test, sensor calibration verification, local logic test |
| Controls/DCIM | Head-End / Historian | BMS server, DCIM server, historian VM | graphics validation, trend logging, alarm routing, backup/restore, time sync |
| Security | Access Control | ACS panel, reader group R-01, mantrap MT-01 | reader validation, door status package, lock release logic, mantrap sequence test |
| Security | CCTV / Intrusion | camera set CAM-A, NVR-01, intrusion panel | image validation, retention check, motion/alarm integration, failover storage test |
| ICT/Network | Carrier / MMR | MMR-A, fiber panel FP-A, WAN handoff A | path verification, labeling, fiber test, failover path validation |
| ICT/Network | OOB / Core Network | OOB switch OOB-01, core switch pair C1/C2 | connectivity package, power-path validation, alerting package |
| AI/Fabric | Cluster Fabric | spine pair SP-01, leaf block LF-A, cluster management nodes | link bring-up package, redundancy validation, partition/fabric fail test |
| AI/Fabric | Rack Liquid Interface | rack manifold RM-01, rack CDU branch A | rack flow verification, leak alarm package, rack thermal acceptance package |

### 16.6 Input-Driven Equipment Derivation Rules

The schedule breakdown must be generated from input parameters.

The equipment library above is only the `possible vocabulary`, not the final instantiated schedule.

The engine must derive actual level 4 equipment rows from:
- project archetype
- building count
- hall count
- IT load
- electrical topology
- redundancy model
- cooling type
- liquid cooling percentage
- rack density class
- operator overlay
- optional explicit equipment counts entered by the user

Derivation priority:
1. explicit user-entered equipment counts
2. project-specific override rules
3. archetype sizing assumptions
4. default sizing assumptions library

The engine must support three derivation modes:
- `auto`
- `hybrid`
- `manual`

`auto`:
- all equipment counts are generated from input parameters and sizing assumptions

`hybrid`:
- engine generates defaults, user overrides selected equipment families

`manual`:
- engine uses user-entered counts and suppresses automatic count generation for those families

Example derivation rules:

```text
ups_group_count =
ceil(itLoadKw / upsGroupCapacityKw / allowedLoadFactor) adjusted by redundancy rule

generator_count =
ceil(requiredCriticalLoadKw / generatorCapacityKw) adjusted by redundancy rule

chiller_count =
ceil(coolingLoadKw / chillerNominalKw) adjusted by plant redundancy rule

crah_count =
ceil(airCooledHallLoadKw / crahNominalKw) adjusted by standby policy

cdu_count =
ceil(liquidCooledLoadKw / cduNominalKw) adjusted by redundancy rule
```

Implementation rules:
- standards alignment influences which equipment families must exist, not the exact count formula
- TIA alignment ensures the right physical infrastructure domains are represented
- ASHRAE alignment ensures lifecycle and process deliverables exist around those assets
- Uptime overlay can tighten redundancy and demonstration requirements, but only when selected

Required input-driven families:
- utility / substation equipment
- switchgear lineups
- transformers
- generators
- ATS / STS
- UPS groups and battery groups
- PDUs / RPPs / busway sections
- chillers
- pumps
- cooling towers / dry coolers
- CRAH / CRAC / in-row units
- CDUs / manifolds / liquid loops
- fire panels / detection zones / suppression zones
- control panels / servers / points groups
- security panels / reader groups / CCTV groups
- MMR / core network / OOB sets
- AI fabric sets / rack liquid interfaces where applicable

### 16.7 Example 5-Level Expanded Paths

The app must support expanded paths like these:

1. `L1 > Electrical > HV/MV Switchgear > Lineup SWG-A > Relay Secondary Injection`
2. `L1 > Electrical > Transformers > TX-01 > Power Factor Test`
3. `L2 > Electrical > UPS > UPS-A > Installation Verification`
4. `L2 > Mechanical > Liquid Cooling > CDU-01 > Leak Test`
5. `L3 > Mechanical > Chiller Plant > CH-01 > OEM Startup Package`
6. `L3 > Controls/DCIM > Field Controls > Controller C-01 > Point-to-Point Test`
7. `L4 > Mechanical > Airside Cooling > CRAH-03 > Performance Package`
8. `L4 > Controls/DCIM > Head-End / Historian > BMS Server > Sequence Validation`
9. `L5 > Electrical > Generators > GEN-01 > Black Start Package`
10. `L5 > AI/Fabric > Cluster Fabric > Spine Pair SP-01 > Fabric Partition Test`

### 16.8 Schedule Row Object

The default schedule row object for level 5 must store:

```json
{
  "rowId": "sch_L3_ELEC_UPS_UPS_A_BATT",
  "level": 5,
  "phase": "L3",
  "discipline": "electrical",
  "systemGroup": "ups",
  "equipmentRef": "UPS-A",
  "activityName": "Battery Autonomy Test",
  "ownerRole": "cxa_elec",
  "plannedStart": "2026-08-04",
  "plannedFinish": "2026-08-04",
  "durationHours": 4,
  "predecessorIds": ["sch_L3_ELEC_UPS_UPS_A_IO"],
  "evidenceIds": ["ev_startup_sheet_ups_a", "ev_batt_result_ups_a"],
  "gateImpactIds": ["gate_l3_sat_complete"]
}
```

### 16.9 Duration Formula

```text
Duration Days =
(Base Work Hours / Crew Size / Productive Hours Per Day)
* Complexity Factor
* Access Factor
* Overtime Adjustment
* Retest Allowance
```

### 16.10 Dependency Rules

Minimum dependency rules:
- L0 must finish before any L1 package is baselined for execution
- equipment energization packages cannot start before relevant L2 static checks pass
- L4 packages cannot start until their required L3 equipment packages are complete
- L5 integrated scenarios cannot start until all prerequisite L4 packages are approved
- grouped AI/Fabric packages may depend on both electrical and mechanical package completion

### 16.11 Mobile Rule

No deep level may be hidden on mobile.

Use drill-down and drawer patterns instead.

---

## 17. Cost Engine

### 17.1 Philosophy

The cost engine must be bottom-up and scope-driven.

`$/kW` may be used as a calibration signal, but not as the only basis.

### 17.2 Primary Cost Drivers

Minimum cost drivers:
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
- schedule aggressiveness
- retest allowance
- documentation burden

### 17.3 Cost Buckets

Required buckets:
- labor
- OEM/vendor support
- test equipment
- load bank
- fuel / temporary utilities
- travel and per diem
- documentation and reporting
- witness / certification
- contingency

### 17.4 Formula

```text
Package Labor Cost =
Resource Hours * Regional Blended Labor Rate * Shift Factor * Overtime Factor

Package Non-Labor Cost =
OEM Cost + Equipment Rental + Load Bank + Fuel + Travel + Witness + Documentation

Project Cx Cost =
sum(all package labor + all package non-labor)
+ certification fees
+ contingency
```

---

## 18. Resource Engine

### 18.1 Core Roles

Minimum roles:
- program manager
- commissioning manager
- CxA engineer
- electrical field engineer
- mechanical field engineer
- controls engineer
- network / ICT engineer
- security engineer
- OEM specialist
- GC trade support
- operator representative
- witness / certifier

### 18.2 Outputs

The app must show:
- peak manpower by phase
- peak manpower by discipline
- OEM day demand
- witness day demand
- bottleneck periods

---

## 19. Analytics Engine

### 19.1 Required KPIs

Minimum KPIs:
- overall commissioning completion
- phase gate completion
- evidence completeness
- defect closure rate
- retest burden
- critical path slip risk
- schedule variance
- cost variance
- package pass rate
- approval completion

### 19.2 Example Formulas

```text
Checklist Completion % =
completed applicable items / total applicable items * 100

Evidence Completeness % =
accepted required evidence / total required evidence * 100

Phase Gate Completion % =
closed gates / total applicable gates * 100
```

---

## 20. Program Setup

### 20.1 Minimum Inputs

Program setup must capture:
- project name
- region
- city / market
- archetype
- operator overlay
- standards overlay selection
- IT MW
- building count
- hall count
- delivery method
- electrical topology
- cooling topology
- liquid cooling percentage
- rack density class
- equipment derivation mode
- sizing assumptions profile
- optional explicit equipment counts
- target completion date
- certification targets
- schedule aggressiveness

### 20.2 Presets

The app must ship with:
- enterprise 2 MW
- retail colo 5 MW
- wholesale 20 MW
- hyperscale 50 MW
- AI factory 100 MW
- AI campus 200 MW
- modular 5 MW pod
- brownfield expansion 10 MW
- repurposed fast-track AI hall

---

## 21. UX / Interaction Specification

### 21.1 Layout

Desktop:
- left rail for filters and saved views
- center workspace for tree-grid and Gantt
- right inspector for node details, evidence, comments, and approvals

### 21.2 Required Columns

Default tree-grid columns:
- name
- phase
- owner
- status
- progress
- evidence
- planned finish
- variance
- critical

### 21.3 Required Interactions

The app must support:
- single click select
- double click open
- chevron expand/collapse
- keyboard navigation
- multi-select
- search and highlight
- save custom view
- bulk actions

---

## 22. Export and Reporting

### 22.1 Export Formats

Required exports:
- PDF executive report
- CSV checklist export
- CSV cost export
- JSON project export
- JSON template export

### 22.2 Required PDF Sections

Minimum PDF report sections:
- program summary
- archetype summary
- phase completion
- critical path
- cost summary
- major risks
- evidence completeness
- open critical defects
- closeout pack status

---

## 23. Source Registry

Every benchmark or operator assumption must have:
- source ID
- title
- URL
- publisher
- publication date
- source type
- confidence class
- note on use

---

## 24. Technical Architecture

### 24.1 Recommended Source Layout

```text
cx-playbook/
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
      gates.js
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
    cx-playbook.html
```

### 24.2 Persistence

v2 baseline:
- in-memory state
- LocalStorage autosave
- JSON import/export

### 24.3 Performance Target

The app must support at least 20,000 nodes with virtualization or incremental rendering.

---

## 25. Acceptance Criteria

The build passes if:
- arbitrary-depth tree rendering works
- gate logic blocks false completion
- evidence completeness updates correctly
- phased schedule logic works
- cost rolls up from packages
- large archetypes like hyperscale and AI factory are usable without manual tree rebuild

---

## 26. Implementation Roadmap

### 26.1 Phase A

- define base schema
- define lifecycle base template
- build recursive tree-grid
- build filter engine
- build LocalStorage persistence

### 26.2 Phase B

- build checklist engine
- build gate engine
- build evidence tracker
- build rollup logic

### 26.3 Phase C

- build schedule engine
- build Gantt view
- build resource engine
- build cost engine
- build baseline analytics

### 26.4 Phase D

- add operator overlays
- add AI factory template packs
- add certification packs
- add advanced exports

---

## Appendix A. Role and Approval Matrix

| Role ID | Role | Responsibility |
|---|---|---|
| `owner_pm` | Owner Program Manager | governance and milestone approvals |
| `owner_ops` | Operations Lead | turnover, training, systems manual acceptance |
| `cxa_lead` | CxA Lead | commissioning governance and gate closure recommendation |
| `cxa_elec` | CxA Electrical | electrical package review |
| `cxa_mech` | CxA Mechanical | mechanical package review |
| `gc_pm` | GC / EPC PM | execution ownership |
| `gc_elec_lead` | Electrical Lead | electrical execution and defect closure |
| `gc_mech_lead` | Mechanical Lead | mechanical execution and defect closure |
| `controls_lead` | Controls Lead | sequence and controls verification |
| `network_lead` | Network / ICT Lead | network and fabric commissioning scope |
| `oem_rep` | OEM Representative | FAT, startup, and specialized vendor tests |
| `witness_rep` | Witness / Certifier | independent witness or certification support |

---

## Appendix B. Commissioning Gate Library

| Gate ID | Gate Name | Minimum Closure Criteria |
|---|---|---|
| `l0_opr_approved` | OPR Approved | OPR issued and approved |
| `l0_bod_approved` | BOD Approved | BOD issued and aligned to OPR |
| `l0_test_library_ready` | Test Library Ready | scripts and pack mapping completed |
| `l1_factory_release` | Factory Release | FAT passed and release records issued |
| `l2_install_complete` | Installation Complete | installation checklists accepted |
| `l2_static_tests_passed` | Static Tests Passed | static package tests accepted |
| `l2_safe_to_energize` | Safe to Energize | safety approvals and evidence complete |
| `l3_startup_complete` | Startup Complete | startup sheets and OEM records complete |
| `l3_sat_complete` | SAT Complete | standalone site tests passed |
| `l4_performance_passed` | Performance Passed | FPT accepted |
| `l4_pre_ist_ready` | Pre-IST Ready | L4 critical defects closed and scripts frozen |
| `l5_ist_passed` | IST Passed | integrated scenarios accepted |
| `l5_extended_soak_passed` | Extended Soak Passed | soak requirements passed where applicable |
| `l6_closeout_pack_complete` | Closeout Pack Complete | final package accepted |
| `l6_turnover_complete` | Turnover Complete | turnover approvals complete |

---

## Appendix C. Fifty Commissioning Enhancement Directives

All items below are part of the commissioning-only build intent.

1. Add a project assumptions register.
2. Add a design deviation register.
3. Add `availability_zone` as a scope type for hyperscale templates.
4. Add `cluster` as a scope type for AI commissioning packs.
5. Add `temporary_system` as a node type for fast-track work.
6. Separate `package`, `scenario`, and `step` in the base schema.
7. Add document revision fields to all evidence.
8. Add a dedicated commissioning closeout pack object.
9. Add source confidence on every benchmarked rule.
10. Add operator overlay conflict logging.
11. Add approval quorum rules for critical gates.
12. Add defect threshold policies by gate.
13. Add waiver expiry and review date.
14. Add residual risk acceptance records.
15. Add witness planning objects.
16. Add OEM attendance planning by package.
17. Require rollback conditions for all high-risk scenarios.
18. Track retest lineage end-to-end.
19. Add `hold_point` separate from `blocked`.
20. Add multiple calendars for factory, site, and live-site windows.
21. Add baseline freeze and rebaseline history.
22. Add access-window factors for restricted work.
23. Add work-zone conflict detection.
24. Add load bank sizing objects instead of flat cost factors.
25. Add temporary utility and fuel consumption cost tracking.
26. Add documentation labor as an explicit bucket.
27. Add schedule aggressiveness factor.
28. Add cost confidence bands by package.
29. Add delay-cost of commissioning slippage by milestone.
30. Add saved views for discipline, building, and executive contexts.
31. Add deep search across nodes, evidence, defects, and gates.
32. Add bulk assign and bulk status update.
33. Add readiness heatmaps by building and phase.
34. Add AI cluster commissioning dashboard for AI archetypes.
35. Add closeout completeness dashboard.
36. Add forecast trendlines for completion and gate closure.
37. Add benchmark provenance panel in the UI.
38. Add an exception inbox for blocked work and overdue approvals.
39. Add JSON project import/export.
40. Add LocalStorage autosave and session recovery.
41. Add modular build-to-single-HTML pipeline.
42. Add tree virtualization for large projects.
43. Add keyboard-first navigation.
44. Add synthetic demo data packs.
45. Add deterministic seed templates for QA.
46. Add audit trail for status changes and approvals.
47. Add package-level resource bottleneck analytics.
48. Add scenario-family risk scoring.
49. Add final closeout report generator.
50. Add future adapter points for DCIM, document systems, and schedule tools.

---

## 27. Source Appendix

Primary public sources used as anchor references for commissioning design:
- OpenAI Stargate announcement: https://openai.com/index/announcing-the-stargate-project/
- OpenAI infrastructure update: https://openai.com/index/building-openai/
- Oracle Abilene campus: https://www.oracle.com/data-centers/abilene/
- AWS power and cooling components: https://press.aboutamazon.com/2024/12/aws-announces-new-data-center-components-to-support-ai-innovation-and-further-improve-energy-efficiency
- AWS Project Rainier: https://www.aboutamazon.com/news/aws/aws-project-rainier-ai-trainium-chips-compute-cluster
- Google infrastructure for 1 MW racks and liquid cooling: https://cloud.google.com/blog/topics/systems/enabling-1-mw-it-racks-and-liquid-cooling-at-ocp-emea-summit/
- Google cloud data center architecture: https://cloud.google.com/blog/products/infrastructure/understanding-cloud-datacenter-architecture-availability-zones
- Microsoft AI superfactory architecture: https://blogs.microsoft.com/blog/2025/11/12/infinite-scale-the-architecture-behind-the-azure-ai-superfactory/
- Microsoft AI data center profile: https://blogs.microsoft.com/blog/2025/09/18/inside-the-worlds-most-powerful-ai-datacenter/
- xAI Colossus: https://x.ai/colossus
- ASHRAE Guideline 0 overview: https://www.ashrae.org/technical-resources/bookstore/guideline-0-2019-the-commissioning-process
- ASHRAE titles, purposes and scopes: https://www.ashrae.org/technical-resources/standards-and-guidelines/titles-purposes-and-scopes
- Uptime Institute tier certification preparation: https://journal.uptimeinstitute.com/tiercertificationpreparation/

---

## 28. Final Build Position

This product should be built as a `commissioning governance and execution system`, not as a decorative calculator.

If built to this spec, it can become:
- a reusable internal commissioning standard
- a strong estimator grounded in package reality
- a credible hyperscale and AI-factory commissioning tool
- a clean commissioning baseline without spillover into adjacent readiness frameworks
