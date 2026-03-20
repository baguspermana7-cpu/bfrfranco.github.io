# RFS App V2 Blueprint - Static HTML + localStorage

Date: 2026-03-18

## Purpose

This document turns the prior review into a concrete implementation direction for a static HTML app with localStorage only.

The target is not "perfect enterprise software." The target is a credible, high-signal, offline-capable RFS playbook app that:
- feels dynamic
- is implementable in one HTML app
- aligns better with large data center and cloud customer expectations
- avoids false precision
- stays within the limits of localStorage

## Hard Constraints

### 1. Delivery model

The app will be:
- single-page HTML
- inline or bundled CSS and JavaScript
- no backend
- no database
- no real-time collaboration
- localStorage only for persistence

### 2. What this means technically

You can build:
- calculators
- gated workflows
- project state tracking
- delivery-unit tracking
- defect registers
- evidence metadata registers
- scenario compare
- PDF or print export
- JSON import and export
- premium gating using the same pattern you already use

You cannot credibly build:
- true multi-user collaboration
- true audit immutability
- binary evidence repository
- large document storage
- secure role-based access control
- enterprise history and traceability across devices

### 3. localStorage limitations you must respect

localStorage is the biggest design constraint.

Practical implications:
- storage is usually around 5 MB per origin, sometimes slightly more
- values are string-only
- every write is synchronous
- large writes can block the UI
- storing attachments is not realistic
- storing full evidence documents is not realistic
- storing thousands of large denormalized objects is risky

Conclusion:
- store metadata, not files
- store compact normalized objects
- export snapshots frequently
- design for one active project at a time, with optional archived projects

## What To Build

Do not build a giant "RFS calculator."

Build:

`RFS Readiness Workbench`

Inside one static HTML app with 6 logical engines:
- `Profile Engine`
- `Standards Engine`
- `Gate Engine`
- `Defect Engine`
- `Forecast Engine`
- `Report Engine`

This keeps the app dynamic without pretending it is a full enterprise system.

## Fit With Your Existing HTML App Pattern

Your current calculator pattern already gives a workable front-end shell:
- sticky nav, hero, and input area in [cx-calculator.html](/home/baguspermana7/rz-work/cx-calculator.html#L40)
- mode buttons and premium badge in [cx-calculator.html](/home/baguspermana7/rz-work/cx-calculator.html#L61)
- KPI grid, narrative block, and pro panels in [cx-calculator.html](/home/baguspermana7/rz-work/cx-calculator.html#L96)
- premium session persistence via `rz_premium_session` in [capex-calculator.html](/home/baguspermana7/rz-work/capex-calculator.html#L4257)

Recommendation:
- reuse that interaction grammar
- do not reuse the product logic

UI style you can preserve:
- hero + short framing paragraph
- mode tabs
- executive KPI cards
- narrative insight block
- gated pro panels
- export buttons
- mobile-first stacked sections

## Recommended Product Scope

### Free scope

Free mode should do only directional work:
- setup wizard
- one project
- one delivery unit
- baseline archetype
- simple readiness dashboard
- simple timeline estimate
- simple cost estimate
- defect log capped
- no customer overlay
- no deep evidence register

### Pro scope

Pro mode should unlock the execution-grade features:
- multiple delivery units
- gate board
- evidence metadata register
- sign-off matrix
- customer overlay
- deviations and waivers
- scenario compare
- dynamic risk and confidence scoring
- PDF export
- import and restore snapshots

This fits your existing `rz_premium_session` pattern and avoids feature sprawl in free mode.

## Core Product Reframe

The app should answer five questions:

1. What are we trying to make ready?
2. What gate are we trying to clear?
3. What is still blocking that gate?
4. What evidence exists and what is still missing?
5. How confident are we in the target RFS date?

If a screen cannot help answer one of those five questions, it is probably noise.

## Information Architecture

### Recommended top-level modes

Use mode tabs, but make them operational:

1. `Setup`
2. `Units`
3. `Gates`
4. `Tests`
5. `Defects`
6. `Overlay`
7. `Forecast`
8. `Report`

### Screen intent

#### 1. Setup

Purpose:
- define project profile
- choose operating archetype
- choose phasing strategy
- configure baseline assumptions

Inputs:
- program name
- facility model
- region
- delivery model
- cooling architecture
- redundancy class
- archetype
- customer type
- commissioning scope
- phase ambition

Output:
- baseline profile narrative
- baseline risk tags
- initial gate roadmap

#### 2. Units

Purpose:
- define the delivery units that move through readiness

Unit examples:
- campus
- building
- hall
- pod
- electrical block
- mechanical plant

This is mandatory if you want the app to feel aligned with real large DC turnover.

Output:
- unit matrix
- owner per unit
- target dates per unit
- unit-specific blocker count

#### 3. Gates

Purpose:
- make readiness decisions visible

Recommended gates:
- `G0` Program Baseline Locked
- `G1` Safe to Energize
- `G2` L3 Startup Ready
- `G3` L4 FPT Ready
- `G4` L5 IST Ready
- `G5` Facility RFS Ready
- `G6` Customer Acceptance Ready
- `G7` Turnover Complete

Output:
- gate board by delivery unit
- blockers
- missing mandatory evidence
- gate confidence
- sign-off readiness

#### 4. Tests

Purpose:
- track L0-L5 packages without making the whole app feel like a test spreadsheet

Structure:
- discipline
- system
- subsystem
- package
- event

Examples:
- Electrical > UPS > UPS-A > L4 FPT Package
- Mechanical > CDU Train 1 > L5 integrated failover event

Output:
- completion by package
- witness requirements
- retest queue
- linked defects

#### 5. Defects

Purpose:
- give the app an operational center of gravity

Defect is the right object for a local app because it is:
- concrete
- dynamic
- actionable
- naturally linked to gates and dates

Output:
- open defects by severity
- aging
- owner
- gate impact
- retest required yes or no

#### 6. Overlay

Purpose:
- capture customer-specific requirements without pretending public benchmarks are customer standards

Overlay types:
- customer contract requirement
- customer witness requirement
- customer acceptance criteria
- approved deviation
- waiver

Output:
- delta to baseline
- extra witness events
- stricter evidence requirements
- gate conditions changed by overlay

#### 7. Forecast

Purpose:
- calculate schedule confidence and cost direction

Output:
- estimated RFS window
- blocker-adjusted confidence
- retest drag
- evidence drag
- customer-witness drag
- cost of delay and cost of additional rigor

#### 8. Report

Purpose:
- export something useful for executives and customer meetings

Output:
- executive summary
- gate matrix
- major blockers
- delivery unit status
- defect aging
- evidence completeness
- forecast to next gate
- key assumptions and caveats

## Recommended App Layout

### Layout shell

Keep a single-page shell:
- sticky header
- hero summary
- mode bar
- main grid
- right-side detail drawer on desktop
- stacked cards on mobile

### Default dashboard layout

Top row:
- active project
- current gate
- next target gate
- blocker count
- forecast confidence
- projected RFS window

Second row:
- delivery-unit status heatmap
- defects aging chart
- evidence completeness ring
- upcoming witness events

Third row:
- blocker narrative
- recommended next actions

### Do not default to

Do not default to:
- full checklist tree
- all 740 items visible
- giant one-page form
- one big Gantt before the user has defined delivery units

## Data Model For localStorage

### Design principle

Do not store everything in one huge object.

Use:
- one index
- one active project pointer
- one compact object per project domain

This reduces corruption risk and reduces full-object rewrites.

### Recommended localStorage keys

Global keys:
- `rfs_app_version`
- `rfs_active_project_id`
- `rfs_projects_index_v1`
- `rfs_ui_state_v1`
- `rfs_settings_v1`
- `rz_premium_session`

Per-project keys:
- `rfs_project_<id>_core_v1`
- `rfs_project_<id>_units_v1`
- `rfs_project_<id>_gates_v1`
- `rfs_project_<id>_tests_v1`
- `rfs_project_<id>_defects_v1`
- `rfs_project_<id>_evidence_v1`
- `rfs_project_<id>_overlay_v1`
- `rfs_project_<id>_forecast_v1`
- `rfs_project_<id>_audit_v1`
- `rfs_project_<id>_snapshots_v1`

### Recommended object shapes

#### 1. Project core

```js
{
  id: "proj_20260318_001",
  name: "JKT AI Campus Phase 1",
  archetype: "wholesale_hyperscale",
  region: "apac",
  customerMode: "overlay_confirmed",
  phasingModel: "hall_by_hall",
  baselineGate: "G0",
  createdAt: "2026-03-18T10:00:00.000Z",
  updatedAt: "2026-03-18T12:15:00.000Z",
  lastCalculatedAt: "2026-03-18T12:20:00.000Z",
  schemaVersion: 1
}
```

#### 2. Delivery units

```js
[
  {
    id: "unit_b1_h1",
    type: "hall",
    label: "Building 1 - Hall 1",
    parentId: "unit_b1",
    owner: "Cx Manager",
    targetGate: "G5",
    targetRfsDate: "2026-10-30",
    systemCount: 14,
    criticality: "high"
  }
]
```

#### 3. Gate state

```js
[
  {
    id: "gate_unit_b1_h1_G4",
    unitId: "unit_b1_h1",
    gateCode: "G4",
    status: "blocked",
    blockerIds: ["def_019", "def_022"],
    missingEvidenceIds: ["evreq_044"],
    readinessPct: 78,
    confidencePct: 61,
    dueDate: "2026-09-18",
    signoffRequired: ["Cx Lead", "Ops Lead", "Customer Witness"],
    waiverIds: []
  }
]
```

#### 4. Test packages

```js
[
  {
    id: "tp_ups_a_l4",
    unitId: "unit_b1_h1",
    discipline: "electrical",
    system: "UPS",
    subsystem: "UPS-A",
    phase: "L4",
    packageName: "UPS-A Functional Performance",
    required: true,
    status: "retest_required",
    witnessRequired: true,
    linkedDefectIds: ["def_019"],
    plannedDate: "2026-09-12",
    completedDate: null
  }
]
```

#### 5. Defects

```js
[
  {
    id: "def_019",
    unitId: "unit_b1_h1",
    sourceType: "test_package",
    sourceId: "tp_ups_a_l4",
    title: "UPS bypass transfer exceeds threshold",
    severity: "critical",
    gateImpact: ["G4", "G5"],
    owner: "Electrical Contractor",
    status: "open",
    createdAt: "2026-09-12T03:20:00.000Z",
    agingDays: 0,
    retestRequired: true,
    rootCauseKnown: false,
    waiverAllowed: false
  }
]
```

#### 6. Evidence metadata

```js
[
  {
    id: "ev_044",
    unitId: "unit_b1_h1",
    requirementId: "req_l5_loadbank_report",
    type: "test_report",
    label: "L5 load bank final report",
    storageMode: "metadata_only",
    fileName: "L5_LoadBank_Final.pdf",
    linkedDefectIds: [],
    received: false,
    signoffStatus: "missing"
  }
]
```

#### 7. Overlay

```js
[
  {
    id: "ov_008",
    kind: "customer_witness",
    sourceClass: "A",
    sourceRef: "Contract Exhibit C Section 4.2",
    appliesTo: ["unit_b1_h1", "unit_b1_h2"],
    effect: {
      addsWitness: true,
      addsEvidence: ["thermal_steady_state_report"],
      tightensGate: "G5"
    }
  }
]
```

#### 8. Audit trail

Keep it compact.

```js
[
  {
    ts: "2026-03-18T12:22:12.000Z",
    event: "DEFECT_STATUS_CHANGED",
    refId: "def_019",
    payload: "open -> in_review"
  }
]
```

Do not try to make this legally immutable. It is only a user convenience log.

## Storage Strategy

### What to store

Store:
- project structure
- user-entered inputs
- derived gate state
- defect records
- evidence metadata
- customer overlays
- small audit trail
- saved scenarios

### What not to store

Do not store:
- uploaded PDFs
- images
- videos
- full standards libraries in editable form
- verbose duplicated text on every object
- large narrative histories

### Storage optimization

Recommended tactics:
- normalize repeated values into IDs
- store library content as in-code constants, not local project data
- debounce writes at 250 to 500 ms
- write only changed domains
- cap audit records, for example latest 200 entries
- allow manual snapshot export
- optionally compress large JSON blobs if needed

If you later exceed storage limits, the first escalation path should be IndexedDB, not backend. But for now, stay inside localStorage by design.

## Standards Engine Design

### Core principle

The standards library should be embedded as read-only constants in the app code.

Example categories:
- electrical FAT/FPT/IST
- mechanical FAT/FPT/IST
- fire and life safety
- controls and EPMS/BMS
- security and ICT
- operations readiness
- documentation and handover

Each standard item should have:
- `requirementId`
- `phase`
- `discipline`
- `title`
- `description`
- `acceptanceCriteria`
- `defaultWeight`
- `blockerClass`
- `evidenceType`
- `witnessDefault`
- `sourceClass`

This lets the app feel rich without bloating storage.

## Gate Engine Design

### Gate logic principle

A gate is not a percentage. A gate is a decision.

Each gate should compute:
- status
- readiness percentage
- confidence percentage
- blocker list
- missing evidence list
- required sign-off list

### Gate status algorithm

Recommended statuses:
- `not_started`
- `in_progress`
- `at_risk`
- `blocked`
- `ready_for_signoff`
- `approved`

### Gate evaluation rules

Pseudo-logic:

```js
function evaluateGate(gate, unit, project) {
  const blockers = getOpenBlockers(gate, unit, project);
  const missingEvidence = getMissingMandatoryEvidence(gate, unit, project);
  const missingApprovals = getMissingApprovals(gate, unit, project);
  const weightedCompletion = getWeightedCompletion(gate, unit, project);

  let status = "in_progress";
  if (blockers.length) status = "blocked";
  else if (missingEvidence.length || missingApprovals.length) status = "at_risk";
  else if (weightedCompletion >= 100) status = "ready_for_signoff";

  return {
    status,
    blockers,
    missingEvidence,
    missingApprovals,
    readinessPct: Math.min(100, weightedCompletion),
    confidencePct: calcConfidence(gate, unit, blockers, missingEvidence)
  };
}
```

### Confidence logic

Confidence should not pretend to predict the future exactly.

Use a penalty model:

```js
confidence = 100
  - blockerPenalty
  - overduePenalty
  - evidenceGapPenalty
  - retestPenalty
  - customerWitnessPenalty
  - sourceConfidencePenalty;
```

Then band it:
- `High` = 80-100
- `Medium` = 60-79
- `Low` = below 60

This is honest and still useful.

## Defect Engine Design

### Why defects matter

In execution, users care more about open critical issues than about giant checklist trees.

Your defect engine should drive:
- gate block status
- retest queue
- schedule slip
- confidence drop
- executive attention

### Defect severity model

Use:
- `critical`
- `major`
- `moderate`
- `minor`
- `observation`

### Defect status model

Use:
- `open`
- `in_review`
- `assigned`
- `fix_in_progress`
- `ready_for_retest`
- `closed`
- `waived`

### Defect aging model

Track:
- age
- days since last update
- days beyond target close
- gate impact count

This makes the app feel alive even without backend infrastructure.

## Forecast Engine Design

### Forecast scope

Within static HTML, keep forecasting useful but bounded.

Compute:
- baseline RFS window
- gate-specific target window
- slip from blockers
- slip from evidence gaps
- slip from retests
- slip from witness constraints

### Recommended schedule approach

Do not build a fake Primavera clone.

Build a compact dependency model:
- each gate has base duration
- each unit has modifiers
- defects add drag
- retests add drag
- overlay witness rules add drag

Pseudo-logic:

```js
forecastDays =
  baseDays
  + blockerDrag
  + evidenceDrag
  + retestDrag
  + witnessDrag
  + phasingComplexityDrag;
```

### Cost scope

Within localStorage mode, cost should be directional.

Compute:
- commissioning effort cost
- retest cost
- witness-day cost
- delay cost
- customer overlay premium

Do not present:
- exact commercial certainty
- exact vendor quote equivalence
- customer-specific deterministic benchmarks without confirmed overlay data

## Overlay Engine Design

### Overlay philosophy

Customer overlay is where hyperscaler relevance should live.

But it must be explicit and traceable.

Overlay types:
- added requirement
- tightened acceptance threshold
- added witness
- added evidence item
- added sign-off authority
- approved deviation
- waiver

### Source discipline

Every overlay must carry:
- source class
- source reference
- owner
- effective date

Recommended source classes:
- `A` customer document or contract exhibit
- `B` OEM or standard
- `C` inferred benchmark
- `D` directional note only

If source class is `C` or `D`, the UI should visually warn:
- `Benchmark only`
- `Not a confirmed customer standard`

## Report Engine Design

### Report types

1. Executive snapshot
2. Gate readiness pack
3. Customer witness pack
4. Defect aging summary
5. Forecast summary

### Minimum content for executive snapshot

- project profile
- delivery units
- current gate per unit
- red blockers
- top 10 aging defects
- missing mandatory evidence
- confidence to next gate
- RFS forecast window
- assumptions and caveats

### Export format

Use:
- print-optimized HTML
- `window.open()` PDF print flow similar to your existing calculators

Do not attempt:
- embedded file annexes
- complex binary packaging

## UI Dynamics You Should Prioritize

To make the app feel dynamic and addictive to use, prioritize:
- live blocker count
- gate status changing in real time as defects are updated
- confidence dial that moves with user actions
- delivery-unit heatmap
- defect aging bands
- "what changed since last snapshot"
- next-best action suggestions

Examples:
- Close a critical defect and watch `G4` move from `blocked` to `at_risk`
- Add missing evidence and watch readiness move to `ready_for_signoff`
- Apply a customer overlay and watch witness count, drag, and sign-off requirements update

This creates genuine interactivity without fake complexity.

## UX Rules

### Rule 1

Default to blockers, not forms.

### Rule 2

Make delivery units visible early.

### Rule 3

Show benchmark assumptions separately from customer-confirmed overlays.

### Rule 4

Use badges everywhere:
- `Blocker`
- `Witness`
- `Waiver`
- `Customer`
- `Benchmark only`

### Rule 5

Use progressive disclosure:
- top-level summary
- click into gate
- click into package
- click into defect

### Rule 6

No giant tree as the home screen.

## Recommended File Architecture

Even if the app is one HTML file, structure the code as modules inside the script:

```js
const RfsStore = {};
const RfsLibrary = {};
const RfsCalculator = {};
const RfsGateEngine = {};
const RfsForecastEngine = {};
const RfsReportEngine = {};
const RfsUI = {};
```

Recommended responsibilities:
- `RfsStore`: read, write, migrate, snapshot
- `RfsLibrary`: standards and archetypes
- `RfsCalculator`: setup-derived baseline values
- `RfsGateEngine`: gate evaluation
- `RfsForecastEngine`: schedule and cost drag
- `RfsReportEngine`: export content
- `RfsUI`: render and event binding

This prevents the app from becoming one giant anonymous script block.

## Migration and Recovery

Because localStorage can break or be cleared, you need resilience features:

### Required features

- schema versioning
- migration on load
- export snapshot to JSON
- import restore from JSON
- reset current project
- archive current project
- corruption fallback

### Recovery flow

On load:
- check `rfs_app_version`
- validate current project schema
- attempt migration
- if invalid, offer restore from last JSON export

This matters more in localStorage mode than in backend mode.

## What Not To Build In V1

Do not build these first:
- embedded evidence file store
- real user roles and permissions
- full multi-project portfolio analytics
- hyperscaler-by-name deterministic templates
- massive schedule engine with hundreds of interdependencies
- free text everything
- large editable standards databases

Build the narrowest version that feels credible.

## Recommended V1 Build Order

### Phase 1

Build the shell:
- hero
- mode tabs
- setup
- units
- executive KPI cards
- save and restore

### Phase 2

Build core state:
- project core
- unit registry
- defect registry
- basic gate engine

### Phase 3

Build intelligence:
- blocker logic
- evidence metadata
- confidence engine
- forecast drag model

### Phase 4

Build premium depth:
- customer overlay
- scenarios
- advanced reports
- waiver and sign-off tracking

### Phase 5

Polish:
- mobile optimization
- print export
- keyboard efficiency
- snapshot diff

## Proposed V1 Success Criteria

The app is successful if a user can:
- define a project in under 5 minutes
- break it into delivery units
- see which gate each unit is stuck at
- know the top blockers immediately
- understand why the forecast moved
- export a clean executive summary

The app is not successful just because it contains many fields.

## Direct Recommendation

For a static HTML app with localStorage only, the right product is:

`a gate-driven RFS readiness workbench with compact forecasting and metadata-based evidence tracking`

It is not:

`a monolithic hyperscaler calculator with pseudo-precise company presets`

## Suggested Next Artifact

The next useful artifact after this blueprint is not more narrative. It is:

1. a screen-by-screen wireframe spec
2. a localStorage schema JSON example pack
3. the actual HTML shell scaffold

If you want, I can do the next step directly and produce:
- the wireframe spec, or
- the first implementation scaffold as a real `.html` app file.
