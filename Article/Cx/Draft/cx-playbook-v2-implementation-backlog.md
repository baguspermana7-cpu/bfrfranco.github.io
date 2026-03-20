# Data Center Commissioning Playbook App
## Implementation Backlog / Build Tickets

Scope: `commissioning-only`
Date: 2026-03-18
Primary spec:
- [cx-playbook-spec-v2-commissioning-only.md](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-playbook-spec-v2-commissioning-only.md)

Purpose:
- translate the commissioning-only spec into executable build work
- give the downstream engine team a ticketed roadmap
- make schedule/equipment/gate logic concrete before any UI implementation

Priority legend:
- `P0` must exist for the product to be valid
- `P1` required for usable v2 alpha
- `P2` required for strong production candidate
- `P3` enhancement after core stability

Status legend:
- `todo`
- `ready`
- `blocked`
- `in_progress`
- `done`

---

## Epic 00. Product Foundations

### CX-001

Title: Define canonical commissioning schema
Priority: `P0`
Status: `todo`
Dependencies: none

Scope:
- define core entities
- define enums
- define object relationships
- define required fields and nullable fields

Acceptance:
- schema covers project, node, gate, checklist item, defect, evidence, source, resource, and rate card
- schema supports recursive hierarchy
- schema supports equipment-level schedule rows

### CX-002

Title: Define lifecycle constants L0-L6 and gate-family enums
Priority: `P0`
Status: `todo`
Dependencies: `CX-001`

Acceptance:
- lifecycle phase list finalized
- gate family enum finalized
- phase-to-gate baseline map exists

### CX-003

Title: Define standards overlay model for ASHRAE / TIA / Uptime
Priority: `P0`
Status: `todo`
Dependencies: `CX-001`

Acceptance:
- ASHRAE process alignment fields exist
- TIA infrastructure domain alignment fields exist
- optional Uptime overlay exists and is not merged incorrectly with TIA

### CX-004

Title: Create sizing assumptions library
Priority: `P0`
Status: `todo`
Dependencies: `CX-001`

Acceptance:
- assumptions library supports electrical, mechanical, fire, controls, security, ICT, and AI/fabric families
- each sizing assumption has source confidence metadata

### CX-005

Title: Create seed project presets
Priority: `P1`
Status: `todo`
Dependencies: `CX-001`, `CX-004`

Acceptance:
- presets exist for enterprise, colo, hyperscale, AI factory, modular, brownfield, and fast-track archetypes
- presets generate valid project objects without manual editing

---

## Epic 01. Input-Driven Equipment Derivation

### CX-010

Title: Implement derivation modes auto / hybrid / manual
Priority: `P0`
Status: `todo`
Dependencies: `CX-001`, `CX-004`

Acceptance:
- project can switch derivation mode
- auto mode creates equipment from assumptions
- hybrid mode allows selective override
- manual mode respects explicit equipment counts

### CX-011

Title: Build electrical equipment derivation engine
Priority: `P0`
Status: `todo`
Dependencies: `CX-010`

Scope:
- substation
- transformers
- switchgear
- generators
- ATS/STS
- UPS groups
- batteries
- PDU / RPP / busway

Acceptance:
- counts generated from IT load, topology, redundancy, and explicit overrides
- derived assets can map to schedule level 4 equipment rows

### CX-012

Title: Build mechanical equipment derivation engine
Priority: `P0`
Status: `todo`
Dependencies: `CX-010`

Scope:
- chillers
- pumps
- cooling towers / dry coolers
- CRAH / CRAC / in-row
- CDU / manifold / liquid loops

Acceptance:
- air and liquid systems can co-exist
- derived assets follow cooling type and liquid coverage inputs

### CX-013

Title: Build controls, fire, security, ICT, and AI/fabric derivation engine
Priority: `P1`
Status: `todo`
Dependencies: `CX-010`

Acceptance:
- system families appear only when applicable
- AI/fabric families activate only for AI scope
- fire and controls domain coverage aligns to TIA domain set

### CX-014

Title: Implement equipment override and reconciliation view
Priority: `P1`
Status: `todo`
Dependencies: `CX-011`, `CX-012`, `CX-013`

Acceptance:
- user can compare derived vs overridden equipment counts
- override delta is logged
- downstream schedule and cost update correctly

---

## Epic 02. Recursive Playbook Tree

### CX-020

Title: Build recursive node engine
Priority: `P0`
Status: `todo`
Dependencies: `CX-001`

Acceptance:
- arbitrary-depth tree supported
- parent-child relationships validated
- rollup-ready node structure exists

### CX-021

Title: Build default 5-level schedule projection
Priority: `P0`
Status: `todo`
Dependencies: `CX-020`, `CX-011`, `CX-012`, `CX-013`

Acceptance:
- schedule can always render:
  - phase
  - discipline
  - system group
  - equipment
  - activity / test package
- expansion works at all five levels

### CX-022

Title: Implement applicability engine
Priority: `P0`
Status: `todo`
Dependencies: `CX-020`

Acceptance:
- nodes can be enabled/disabled by input rules
- disabled nodes do not appear in schedule or cost rollup

### CX-023

Title: Implement parent rollup logic
Priority: `P1`
Status: `todo`
Dependencies: `CX-020`

Acceptance:
- status rollup works
- progress rollup works
- evidence completeness rollup works
- defect rollup works

### CX-024

Title: Implement bulk actions and expansion-state persistence
Priority: `P2`
Status: `todo`
Dependencies: `CX-020`

Acceptance:
- multi-select works
- bulk assign/status works
- expansion state survives session reload

---

## Epic 03. Commissioning Packages and Checklist

### CX-030

Title: Implement checklist item engine
Priority: `P0`
Status: `todo`
Dependencies: `CX-001`, `CX-020`

Acceptance:
- checklist items support assignee, reviewer, due date, status, and evidence linkage
- completed and approved states are distinct

### CX-031

Title: Implement commissioning package library
Priority: `P0`
Status: `todo`
Dependencies: `CX-011`, `CX-012`, `CX-013`, `CX-030`

Acceptance:
- packages generated for all applicable equipment families
- package templates differ by phase and discipline

### CX-032

Title: Implement approval quorum rules
Priority: `P1`
Status: `todo`
Dependencies: `CX-030`

Acceptance:
- a package can require multiple approvers
- missing approvers prevent closure where required

### CX-033

Title: Implement waiver, hold point, and retest logic
Priority: `P1`
Status: `todo`
Dependencies: `CX-030`

Acceptance:
- hold point exists as its own state
- waivers capture reason, approver, expiry
- retest lineage is preserved

### CX-034

Title: Implement package-to-gate linkage
Priority: `P1`
Status: `todo`
Dependencies: `CX-031`, `CX-040`

Acceptance:
- each critical package can declare gate impact
- blocked package status can block linked phase gate

---

## Epic 04. Phase Gates

### CX-040

Title: Implement commissioning gate model
Priority: `P0`
Status: `todo`
Dependencies: `CX-002`, `CX-001`

Acceptance:
- gate objects support predecessors, evidence, approvals, and defect thresholds

### CX-041

Title: Build baseline gate library by lifecycle phase
Priority: `P0`
Status: `todo`
Dependencies: `CX-040`

Acceptance:
- gate library exists for L0-L6
- each gate has minimum closure criteria

### CX-042

Title: Implement gate blocking rules
Priority: `P0`
Status: `todo`
Dependencies: `CX-040`, `CX-033`

Acceptance:
- critical defects can block gates
- missing evidence can block gates
- missing approvals can block gates

### CX-043

Title: Implement gate progress and forecast logic
Priority: `P1`
Status: `todo`
Dependencies: `CX-040`, `CX-060`

Acceptance:
- gate completion status visible
- gate forecast slip visible

---

## Epic 05. Schedule Engine

### CX-050

Title: Generate level-5 activity rows from commissioning packages
Priority: `P0`
Status: `todo`
Dependencies: `CX-021`, `CX-031`

Acceptance:
- level 5 rows are generated from actual package templates
- level 5 rows are tied to equipment rows

### CX-051

Title: Implement dependency engine FS / SS / FF / SF
Priority: `P0`
Status: `todo`
Dependencies: `CX-050`

Acceptance:
- dependency types work
- lag/lead works
- recalculation works after date edits

### CX-052

Title: Implement calendars and restricted work windows
Priority: `P1`
Status: `todo`
Dependencies: `CX-051`

Acceptance:
- standard calendars exist
- live-site / restricted-access windows can be applied

### CX-053

Title: Implement baseline, rebaseline, and variance tracking
Priority: `P1`
Status: `todo`
Dependencies: `CX-051`

Acceptance:
- baseline dates are preserved
- rebaseline history exists
- variance fields calculate correctly

### CX-054

Title: Implement critical path engine
Priority: `P1`
Status: `todo`
Dependencies: `CX-051`

Acceptance:
- critical path can be calculated by program
- critical path can be filtered by phase or discipline

### CX-055

Title: Implement work-zone conflict detection
Priority: `P2`
Status: `todo`
Dependencies: `CX-052`

Acceptance:
- overlapping work in same area can be flagged
- conflict markers appear in analytics

---

## Epic 06. Evidence and Closeout

### CX-060

Title: Implement evidence object model
Priority: `P0`
Status: `todo`
Dependencies: `CX-001`

Acceptance:
- evidence supports revision, issuer, reviewer, date, and linked nodes

### CX-061

Title: Implement evidence completeness engine
Priority: `P1`
Status: `todo`
Dependencies: `CX-060`, `CX-030`

Acceptance:
- package evidence completeness can be calculated
- phase evidence completeness can be rolled up

### CX-062

Title: Implement commissioning closeout pack
Priority: `P1`
Status: `todo`
Dependencies: `CX-060`, `CX-061`

Acceptance:
- closeout pack can assemble required final documents
- closeout pack gaps are visible

### CX-063

Title: Implement final closeout report generator
Priority: `P2`
Status: `todo`
Dependencies: `CX-062`, `CX-071`

Acceptance:
- report contains summary, defects, evidence, and approvals

---

## Epic 07. Defects and Retests

### CX-070

Title: Implement defect object model
Priority: `P0`
Status: `todo`
Dependencies: `CX-001`

Acceptance:
- defects support severity, owner, due date, linked node, linked gate

### CX-071

Title: Implement defect-to-gate policy engine
Priority: `P1`
Status: `todo`
Dependencies: `CX-070`, `CX-042`

Acceptance:
- critical defects block relevant gates
- major/minor behavior is policy-driven

### CX-072

Title: Implement retest lineage
Priority: `P1`
Status: `todo`
Dependencies: `CX-070`, `CX-033`

Acceptance:
- retest chain is visible from original failure to final pass

---

## Epic 08. Cost and Resources

### CX-080

Title: Implement regional rate card model
Priority: `P0`
Status: `todo`
Dependencies: `CX-001`

Acceptance:
- role-based rates supported
- witness and OEM rates supported
- source confidence supported

### CX-081

Title: Implement package cost engine
Priority: `P0`
Status: `todo`
Dependencies: `CX-031`, `CX-080`

Acceptance:
- labor and non-labor roll up by package
- package costs roll up to equipment, system, discipline, phase, and project

### CX-082

Title: Implement load bank, fuel, and temporary utility cost logic
Priority: `P1`
Status: `todo`
Dependencies: `CX-081`

Acceptance:
- load bank is not a flat lump sum
- cost varies by size, duration, and scenario usage

### CX-083

Title: Implement resource loading engine
Priority: `P1`
Status: `todo`
Dependencies: `CX-031`, `CX-051`, `CX-080`

Acceptance:
- role loading view exists
- bottleneck windows can be identified

### CX-084

Title: Implement cost confidence bands
Priority: `P2`
Status: `todo`
Dependencies: `CX-081`

Acceptance:
- package and project confidence bands can be calculated

---

## Epic 09. Analytics

### CX-090

Title: Implement commissioning KPI engine
Priority: `P1`
Status: `todo`
Dependencies: `CX-023`, `CX-061`, `CX-070`

Acceptance:
- completion, evidence, defect, and approval KPIs exist

### CX-091

Title: Implement readiness heatmaps and exception inbox
Priority: `P1`
Status: `todo`
Dependencies: `CX-090`

Acceptance:
- heatmaps exist by phase and building
- exception inbox shows blocked work, missing evidence, overdue approvals, and critical defects

### CX-092

Title: Implement AI cluster commissioning dashboard
Priority: `P2`
Status: `todo`
Dependencies: `CX-013`, `CX-090`

Acceptance:
- AI templates show liquid path, fabric, and cluster-related commissioning metrics

### CX-093

Title: Implement forecast trendlines
Priority: `P2`
Status: `todo`
Dependencies: `CX-090`, `CX-053`

Acceptance:
- trendlines exist for completion, gate closure, and schedule variance

---

## Epic 10. Sources and Governance

### CX-100

Title: Implement source registry
Priority: `P0`
Status: `todo`
Dependencies: `CX-001`

Acceptance:
- every benchmark and assumption can point to a source record

### CX-101

Title: Implement benchmark provenance validation
Priority: `P1`
Status: `todo`
Dependencies: `CX-100`

Acceptance:
- internal estimates cannot be saved as official public benchmarks

### CX-102

Title: Implement overlay conflict log
Priority: `P2`
Status: `todo`
Dependencies: `CX-022`, `CX-100`

Acceptance:
- conflicting overlay rules are surfaced and logged

### CX-103

Title: Implement audit trail
Priority: `P2`
Status: `todo`
Dependencies: `CX-030`, `CX-040`, `CX-070`

Acceptance:
- status changes, waivers, approvals, and gate closures are auditable

---

## Epic 11. Exports and Interchange

### CX-110

Title: Implement JSON import/export
Priority: `P1`
Status: `todo`
Dependencies: `CX-001`

Acceptance:
- full project can be exported and imported without schema loss

### CX-111

Title: Implement CSV exports
Priority: `P2`
Status: `todo`
Dependencies: `CX-110`

Acceptance:
- checklist, cost, defects, and schedule can export to CSV

### CX-112

Title: Implement PDF executive export
Priority: `P2`
Status: `todo`
Dependencies: `CX-063`, `CX-090`

Acceptance:
- executive PDF includes summary, critical path, defects, and closeout status

---

## Epic 12. Platform and Non-Functional

### CX-120

Title: Implement LocalStorage autosave and recovery
Priority: `P1`
Status: `todo`
Dependencies: `CX-001`

Acceptance:
- session survives refresh
- corrupted state can be recovered or reset safely

### CX-121

Title: Implement virtualized tree rendering
Priority: `P1`
Status: `todo`
Dependencies: `CX-020`

Acceptance:
- app remains responsive with 20,000+ nodes

### CX-122

Title: Implement keyboard-first navigation
Priority: `P2`
Status: `todo`
Dependencies: `CX-020`

Acceptance:
- major navigation and row actions work without mouse-only dependency

### CX-123

Title: Implement synthetic demo data pack
Priority: `P2`
Status: `todo`
Dependencies: `CX-005`

Acceptance:
- demo project stresses deep hierarchy, multiple buildings, and AI scope

### CX-124

Title: Implement deterministic seed templates for QA
Priority: `P2`
Status: `todo`
Dependencies: `CX-005`

Acceptance:
- QA can recreate the same project states reliably

---

## Recommended Build Sequence

Wave 1:
- `CX-001` to `CX-021`
- `CX-030`
- `CX-040` to `CX-042`
- `CX-050` to `CX-051`
- `CX-080` to `CX-081`
- `CX-100`

Wave 2:
- `CX-022` to `CX-024`
- `CX-031` to `CX-034`
- `CX-052` to `CX-055`
- `CX-060` to `CX-062`
- `CX-070` to `CX-072`
- `CX-083`
- `CX-090` to `CX-091`
- `CX-110`
- `CX-120` to `CX-121`

Wave 3:
- `CX-043`
- `CX-053` to `CX-054`
- `CX-084`
- `CX-092` to `CX-093`
- `CX-101` to `CX-103`
- `CX-111` to `CX-124`

---

## Notes for the Engine Team

- do not start from HTML components
- start from schema, derivation, package library, and schedule logic
- the 5-level schedule hierarchy is mandatory for the default Gantt view
- equipment rows must be input-driven, not hand-authored per project
- ASHRAE, TIA, and Uptime alignment must be represented as overlays and validation rules, not collapsed into one standard
