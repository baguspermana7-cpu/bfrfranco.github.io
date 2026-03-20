# RFS App V2 - Static HTML Implementation Spec

Date: 2026-03-18

Status: Build-ready product and engineering specification for a single HTML app with localStorage persistence.

Extension note: this specification is further hardened by the adopted enhancement pack in [rfs-v3-50-adopted-enhancements-2026-03-18.md](/home/baguspermana7/rz-work/Article/RFS/Codex%20Review/rfs-v3-50-adopted-enhancements-2026-03-18.md). Where there is tension, the adopted enhancement pack takes precedence.

## 1. Product Definition

### Product name

`RFS Readiness Workbench`

### Product type

Single-page static HTML application for data center Ready-for-Service planning and execution support.

### Product promise

The app helps a delivery team answer four operational questions fast:
- what unit is at what gate
- what is blocking progression
- what evidence or sign-off is missing
- how credible the current forecast is

### Product anti-promise

The app is not:
- a replacement for CMMS
- a replacement for document management systems
- a replacement for Primavera or MS Project
- a replacement for customer-controlled standards repositories
- a legally auditable multi-user workflow platform

This anti-scope must be explicit in the UI and documentation.

## 2. Source Basis and Accuracy Boundaries

This implementation spec is grounded in the user's local draft package, especially:
- L0-L5 and full RFS hierarchy in [dc-commissioning-calculator-spec.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-calculator-spec.md#L780)
- IST prerequisites and punch-list gating in [dc-commissioning-test-protocols.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-test-protocols.md#L1055) and [dc-commissioning-test-protocols.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-test-protocols.md#L1329)
- training and operational readiness elements in [dc-commissioning-calculator-spec.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-calculator-spec.md#L1663)
- customer acceptance and commercial readiness in [dc-commissioning-calculator-spec.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-calculator-spec.md#L1715)

### Accuracy policy

The app may provide:
- engineering baseline estimates
- rules-based gate evaluation
- directional forecasting
- benchmark assumptions with confidence labels

The app must not claim:
- customer-specific certainty without confirmed overlay data
- exact cost or schedule certainty
- contractual compliance by default
- formal certification readiness unless all required evidence is explicitly registered

### Source classes

Every non-user-entered rule or assumption must carry one source class:
- `A` primary standard, contract exhibit, OEM requirement, or regulatory requirement
- `B` credible secondary engineering source
- `C` inferred benchmark
- `D` directional or exploratory only

Rules:
- gate blockers may only be generated from `A` or `B` items
- benchmark narratives may use `C`
- `D` may not affect gate status automatically

## 3. Users and Decision Context

### Primary users

- commissioning manager
- project director
- operations readiness lead
- customer interface lead
- executive sponsor

### Secondary users

- MEP discipline leads
- controls lead
- quality or document control lead
- commercial or contract lead

### Primary decisions supported

- can this unit move to the next gate
- what are the red blockers
- what evidence is missing
- what is the likely slip driver
- what is the delta between baseline and customer overlay

## 4. Delivery Model and Technology Constraints

### Technology stack

- one static `.html` file
- vanilla JavaScript
- localStorage persistence
- print-to-PDF export via `window.open()` or print stylesheet
- optional Chart.js only if already part of your existing pattern

### Must not require

- backend API
- service worker
- authentication server
- IndexedDB in V1
- file upload persistence

### Browser expectation

The app should work reliably on:
- Chromium desktop
- Chromium mobile
- Safari desktop
- Safari mobile
- Firefox desktop

## 5. Product Scope

### V1 in scope

- project baseline setup
- archetype-based defaults
- multiple delivery units
- gate board
- test package tracking
- defect management
- evidence metadata tracking
- sign-off tracking
- customer overlay management
- directional forecast engine
- executive and gate report export
- JSON snapshot import and export
- free and pro gating

### V1 out of scope

- attachment storage
- per-user accounts
- cross-device sync
- comments thread
- digital signatures
- advanced schedule network editor
- actual standards editor UI

## 6. Domain Model

### 6.1 Core entities

The app requires 12 first-class entities:
- Project
- DeliveryUnit
- GateState
- Requirement
- TestPackage
- Defect
- EvidenceItem
- SignOff
- OverlayRule
- Waiver
- ForecastSnapshot
- AuditEvent

### 6.2 Entity contracts

#### Project

Required fields:
- `id`
- `name`
- `region`
- `facilityType`
- `archetype`
- `phasingModel`
- `customerMode`
- `createdAt`
- `updatedAt`
- `schemaVersion`

Validation:
- `name` length 3 to 120
- `schemaVersion` integer
- `facilityType` enum
- `archetype` enum

#### DeliveryUnit

Required fields:
- `id`
- `projectId`
- `label`
- `type`
- `parentId`
- `criticality`
- `ownerRole`
- `targetGate`
- `targetDate`
- `status`

Validation:
- `type` in `campus|building|hall|pod|electrical_block|mechanical_plant|support_space`
- `criticality` in `high|medium|low`
- `targetGate` in `G0..G7`

#### GateState

Required fields:
- `id`
- `projectId`
- `unitId`
- `gateCode`
- `status`
- `readinessPct`
- `confidencePct`
- `blockerIds`
- `missingEvidenceIds`
- `missingApproverRoles`
- `updatedAt`

Validation:
- `readinessPct` 0 to 100
- `confidencePct` 0 to 100
- `status` enum

#### Requirement

Required fields:
- `id`
- `gateCode`
- `discipline`
- `title`
- `acceptanceCriteria`
- `evidenceType`
- `blockerClass`
- `defaultWeight`
- `sourceClass`
- `isMandatory`

Validation:
- `sourceClass` in `A|B|C|D`
- `blockerClass` in `hard|soft|info`
- `defaultWeight` 0 to 100

#### TestPackage

Required fields:
- `id`
- `projectId`
- `unitId`
- `discipline`
- `phase`
- `packageName`
- `status`
- `witnessRequired`
- `plannedDate`
- `linkedRequirementIds`

Validation:
- `phase` in `L0|L1|L2|L3|L4|L5|L6`
- `status` enum
- `witnessRequired` boolean

#### Defect

Required fields:
- `id`
- `projectId`
- `unitId`
- `title`
- `severity`
- `status`
- `owner`
- `gateImpact`
- `retestRequired`
- `createdAt`

Validation:
- `severity` in `critical|major|moderate|minor|observation`
- `status` in `open|in_review|assigned|fix_in_progress|ready_for_retest|closed|waived`

#### EvidenceItem

Required fields:
- `id`
- `projectId`
- `unitId`
- `requirementId`
- `type`
- `label`
- `received`
- `signoffStatus`
- `storageMode`

Validation:
- `storageMode` fixed to `metadata_only`
- `signoffStatus` in `missing|pending|accepted|rejected`

#### SignOff

Required fields:
- `id`
- `projectId`
- `unitId`
- `gateCode`
- `role`
- `status`
- `signedAt`

Validation:
- `status` in `not_requested|requested|approved|rejected|waived`

#### OverlayRule

Required fields:
- `id`
- `projectId`
- `kind`
- `sourceClass`
- `sourceRef`
- `appliesTo`
- `effect`
- `status`

Validation:
- `kind` in `customer_requirement|witness_requirement|evidence_requirement|gate_tightening|deviation|waiver_rule`

#### Waiver

Required fields:
- `id`
- `projectId`
- `unitId`
- `scopeType`
- `scopeId`
- `reason`
- `approvedBy`
- `expiresAt`
- `residualRisk`

Validation:
- waiver cannot close a hard life-safety blocker
- waiver cannot auto-approve sign-off

#### ForecastSnapshot

Required fields:
- `id`
- `projectId`
- `scenarioName`
- `generatedAt`
- `unitForecasts`
- `assumptions`

#### AuditEvent

Required fields:
- `ts`
- `event`
- `refType`
- `refId`
- `summary`

## 7. Enumerations

### 7.1 Facility type

- enterprise
- colo_retail
- colo_wholesale
- hyperscale
- ai_hpc
- edge

### 7.2 Archetype

- enterprise_owner_operator
- retail_colo
- wholesale_hyperscale
- hyperscale_self_build
- ai_fast_track_retrofit
- regulated_sovereign

### 7.3 Gate codes

- G0 Program Baseline Locked
- G1 Safe to Energize
- G2 System Startup Ready
- G3 FPT Ready
- G4 IST Ready
- G5 Facility RFS Ready
- G6 Customer Acceptance Ready
- G7 Turnover Complete

### 7.4 Gate status

- not_started
- in_progress
- blocked
- at_risk
- ready_for_signoff
- approved

### 7.5 Test package status

- not_started
- planned
- in_progress
- complete_pending_review
- retest_required
- approved

## 8. localStorage Architecture

### 8.1 Storage keys

Global:
- `rfs_app_version`
- `rfs_active_project_id`
- `rfs_projects_index_v1`
- `rfs_ui_state_v1`
- `rfs_settings_v1`
- `rz_premium_session`

Per project:
- `rfs_project_<id>_core_v1`
- `rfs_project_<id>_units_v1`
- `rfs_project_<id>_gates_v1`
- `rfs_project_<id>_tests_v1`
- `rfs_project_<id>_defects_v1`
- `rfs_project_<id>_evidence_v1`
- `rfs_project_<id>_signoff_v1`
- `rfs_project_<id>_overlay_v1`
- `rfs_project_<id>_waivers_v1`
- `rfs_project_<id>_forecast_v1`
- `rfs_project_<id>_audit_v1`

### 8.2 Storage budget guidance

Approximate target budgets:
- core: 5 KB
- units: 30 KB
- gates: 40 KB
- tests: 120 KB
- defects: 80 KB
- evidence metadata: 120 KB
- overlay: 40 KB
- forecast snapshots: 80 KB
- audit: 40 KB

Target total per active project:
- under 600 KB

Hard warning threshold:
- 2 MB

UI behavior:
- if project storage crosses 1.5 MB, warn user to export and archive

### 8.3 Persistence rules

- all writes must be debounced
- write only the domain that changed
- maintain `updatedAt` on all modified domains
- keep max 10 forecast snapshots per project
- keep max 200 audit entries per project

## 9. Rules Engine Architecture

### 9.1 Engine modules

Required JS modules:
- `RfsStore`
- `RfsLibrary`
- `RfsValidator`
- `RfsGateEngine`
- `RfsForecastEngine`
- `RfsNarrativeEngine`
- `RfsReportEngine`
- `RfsUI`

### 9.2 Execution sequence

On project load:
1. load project domains
2. validate schemas
3. migrate if needed
4. evaluate overlays
5. evaluate defects
6. evaluate gates
7. generate forecast
8. generate narratives
9. render current mode

## 10. Gate Evaluation Logic

### 10.1 Gate evaluation inputs

Each gate must evaluate:
- mandatory requirements
- hard blockers
- open defects by severity
- missing evidence items
- missing sign-off roles
- open waivers
- overlay modifications
- overdue tasks

### 10.2 Gate readiness calculation

Use weighted completion for non-blocking items only.

Formula:

```js
readinessPct = Math.round(
  completedWeight / Math.max(1, applicableWeight) * 100
);
```

Rules:
- hard blockers do not reduce weight; they block status
- waived soft items count as completed with waiver flag
- missing mandatory evidence caps readiness at 95
- missing sign-off caps readiness at 99

### 10.3 Gate confidence calculation

Use confidence as a forecast stability indicator, not readiness.

Base formula:

```js
confidencePct =
  100
  - (openCritical * 18)
  - (openMajor * 8)
  - (missingMandatoryEvidence * 7)
  - (missingApprovals * 6)
  - (retestRequiredCount * 5)
  - overduePenalty
  - overlayUnconfirmedPenalty;
```

Clamp:
- minimum 5
- maximum 100

Banding:
- 80 to 100 high
- 60 to 79 moderate
- 40 to 59 weak
- below 40 unstable

### 10.4 Blocker logic

A gate is `blocked` if any of the following is true:
- open critical defect affects the gate
- mandatory prior gate not approved
- mandatory evidence item missing for the gate
- hard overlay requirement not met
- safety prerequisite not complete

A gate is `at_risk` if:
- no hard blocker exists
- but major defects, missing sign-offs, or overdue prerequisites remain

A gate is `ready_for_signoff` if:
- no blockers
- no missing mandatory evidence
- readiness is 100
- approvals still pending

A gate is `approved` if:
- all required approvers are approved

## 11. Defect Logic

### 11.1 Defect severity intent

- `critical`: blocks gate progression immediately
- `major`: does not always block, but heavily penalizes confidence and may block when tied to gate-critical requirement
- `moderate`: tracked and visible, normally non-blocking
- `minor`: informational, no gate block
- `observation`: advisory only

### 11.2 Auto-block mapping

Auto-block examples:
- life-safety system functional failure
- protective relay misoperation
- UPS bypass or transfer outside threshold where acceptance criteria fail
- cooling failover failure in gate-critical scenario
- missing mandatory L1-L4 signoff before IST
- lack of safety briefing before IST execution

These are aligned with local draft logic in [dc-commissioning-test-protocols.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-test-protocols.md#L1061) and [dc-commissioning-test-protocols.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-test-protocols.md#L1336).

### 11.3 Aging thresholds

- critical: warning at 2 days, overdue at 5 days
- major: warning at 5 days, overdue at 10 days
- moderate: warning at 10 days, overdue at 20 days
- minor: warning at 20 days, overdue at 40 days

These thresholds should be editable in settings.

## 12. Forecast Logic

### 12.1 Forecast model

Forecast is unit-level first, project-level second.

For each unit:

```js
forecastDaysToNextGate =
  baselineGateDays
  + blockerDrag
  + evidenceDrag
  + signoffDrag
  + retestDrag
  + overlayWitnessDrag
  + unitComplexityDrag;
```

### 12.2 Baseline days by gate

Recommended defaults:
- G0 to G1: 7
- G1 to G2: 10
- G2 to G3: 14
- G3 to G4: 10
- G4 to G5: 14
- G5 to G6: 7
- G6 to G7: 7

These are not project promises. They are default directional settings editable in admin constants.

### 12.3 Drag rules

- open critical defect: +3 days each
- open major defect: +1 day each
- missing mandatory evidence: +1 day each
- missing sign-off role: +1 day each
- retest required: +2 days each package
- customer witness required and unscheduled: +2 days per event
- overlay from source class C only: +1 day uncertainty penalty

### 12.4 Project-level forecast

Project forecast date is:
- the max forecast among critical-path delivery units, not the average

Critical path for V1 should be simplified:
- highest criticality unit at lowest approved gate

## 13. Cost Logic

The app should expose only directional readiness cost, not full project CAPEX.

### 13.1 Cost categories

- baseline commissioning effort
- retest cost
- witness cost
- documentation burden cost
- delay cost
- overlay premium cost

### 13.2 Delay cost

Allow user-configurable cost of delay:
- per day
- per week
- per unit

If user does not set it:
- hide monetary delay output
- show schedule drag only

### 13.3 Accuracy warning

All cost outputs must show:
- `Directional estimate only. Not a vendor quote or contractual value.`

## 14. Customer Overlay Logic

### 14.1 Overlay categories

- stricter witness rule
- extra evidence requirement
- tighter acceptance threshold
- additional sign-off role
- additional customer acceptance step
- approved deviation
- temporary waiver

### 14.2 Overlay UI warning

If source class is C or D, show:
- `Benchmark only`
- `Requires customer confirmation`

### 14.3 Overlay precedence

Order of precedence:
1. safety and regulatory rules
2. confirmed customer overlay
3. project baseline
4. benchmark archetype

## 15. Validation Rules

### 15.1 Setup validation

- project name required
- at least one delivery unit required before gates can be evaluated
- archetype required
- facility type required

### 15.2 Gate validation

- no gate can be approved unless prior gate is approved
- no gate can be approved with missing mandatory evidence
- no gate can be approved with unresolved critical blocker

### 15.3 Defect validation

- defect must have owner before it can move to `fix_in_progress`
- defect must have retest outcome before it can close if `retestRequired=true`
- waiver requires approver, expiry, and residual risk

### 15.4 Evidence validation

- evidence item marked received must include source note or filename
- evidence item marked accepted must have sign-off role and accepted date

## 16. UX States

Every screen must define:
- empty state
- loading state
- populated state
- validation error state

### 16.1 Empty states

Examples:
- `No delivery units yet. Create a unit or generate a standard set.`
- `No defects recorded.`
- `No customer overlays applied.`

### 16.2 Error states

Examples:
- corrupted localStorage
- invalid imported JSON
- project exceeds recommended storage size
- schema mismatch

### 16.3 Warning states

Examples:
- benchmark-only overlay applied
- missing critical evidence
- low confidence forecast
- overdue critical defects

## 17. UI Components Required

### Core cards

- KPI card
- status pill
- severity badge
- gate card
- defect row
- evidence row
- narrative panel
- drawer panel
- confirmation modal
- import and export modal
- premium gate overlay

### Charts

V1 charts should be minimal:
- defect severity bar
- defect aging bar
- confidence dial
- delivery-unit gate heatmap

Do not overinvest in charts before the underlying workflow is correct.

## 18. Import and Export

### 18.1 Export JSON

Export format:
- one file per project
- include `meta`, `domains`, `schemaVersion`, `exportedAt`

### 18.2 Import JSON

Rules:
- validate project schema before import
- reject if required domains missing
- offer merge or replace
- record import event in audit log

### 18.3 PDF export

Required report packs:
- executive summary
- gate report for selected unit
- defect aging report
- customer acceptance pack

## 19. Report Narratives

The app should auto-generate short narratives from state.

### 19.1 Narrative patterns

Examples:
- `Hall 1 remains blocked at G4 because two critical defects in UPS transfer performance remain open and one mandatory IST witness plan is not yet confirmed.`
- `Confidence for Hall 2 improved from 54 to 73 after closure of three major mechanical defects and receipt of the final load bank report.`

### 19.2 Narrative rules

- one headline sentence
- two supporting bullets max
- no fake certainty
- mention blockers before percentages

## 20. Free and Pro Product Rules

### Free

- one project only
- up to three delivery units
- up to twenty-five defects
- no overlay tab
- no multi-scenario compare
- no advanced report packs

### Pro

- unlimited project domains within localStorage limits
- overlays enabled
- advanced reports
- snapshots and scenario compare
- richer forecast detail

## 21. Non-Functional Requirements

### Performance

- initial render under 1.5 seconds on desktop for empty project
- save latency under 100 ms for normal edits
- gate recalculation under 50 ms for one defect update
- import under 1 second for 500 KB project

### Reliability

- never lose project data on simple refresh
- detect invalid JSON import safely
- maintain backwards-compatible migrations between schema versions

### Accessibility

- all buttons keyboard reachable
- visible focus states
- color is not the only gate status signal
- tooltips optional, not mandatory for understanding

### Security

Because there is no backend:
- do not position the app as secure storage
- do not store secrets
- do not store customer-confidential documents in localStorage

## 22. Legal and UX Disclaimers

The app should display a standing disclaimer:

`This tool provides engineering workflow support and directional forecasting. It does not replace customer standards, regulatory review, certification requirements, or formal project controls.`

Additional disclaimer when benchmark overlays are used:

`Some benchmark assumptions are public-source or inferred references and must not be treated as confirmed customer requirements without direct validation.`

## 23. Build Order

### Build slice 1

- shell
- setup
- units
- store
- migration

### Build slice 2

- defects
- gate engine
- gate board
- narratives

### Build slice 3

- tests
- evidence metadata
- sign-off states

### Build slice 4

- overlay
- forecast
- report export

### Build slice 5

- premium gating
- scenario compare
- polish and hardening

## 24. Acceptance Criteria

The implementation is acceptable only if all of these are true:

- user can create a project and define units without reading documentation
- gate board updates immediately after defect state changes
- missing evidence visibly blocks relevant gates
- JSON export and import work cleanly
- storage pressure is surfaced before corruption risk
- benchmark assumptions are visually separated from customer-confirmed overlays
- narratives explain blockers in plain language
- mobile layout remains usable for gates and defects

## 25. What "Mature Enough" Means Here

For this delivery model, "mature" does not mean enterprise-complete.

It means:
- precise state model
- explicit gate logic
- honest accuracy boundaries
- resilient persistence
- usable execution workflow
- no false certainty

That is the maturity threshold this static app should target.

## 26. Immediate Next Artifact

The next artifact should be the actual scaffold file:

`/home/baguspermana7/rz-work/rfs-readiness-workbench.html`

And it should implement first:
- global shell
- setup mode
- units mode
- defects mode
- gate board
- localStorage store
- import and export JSON
