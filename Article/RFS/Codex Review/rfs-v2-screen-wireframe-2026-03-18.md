# RFS App V2 Screen Wireframe Spec - Static HTML

Date: 2026-03-18

## Goal

This document defines the actual screen structure for a single HTML RFS app. It is designed to be implemented as one page with hidden and shown sections, consistent with your existing calculator style.

## Global Shell

### Header

Left:
- app mark
- app title
- active project name

Center:
- quick search box

Right:
- last saved time
- import JSON
- export JSON
- export PDF
- premium button

Recommended IDs:
- `rfsAppTitle`
- `rfsActiveProjectLabel`
- `rfsSearchInput`
- `rfsLastSaved`
- `rfsBtnImport`
- `rfsBtnExportJson`
- `rfsBtnExportPdf`
- `rfsPremiumBtn`

### Hero strip

Purpose:
- explain current project state in one sentence

Content:
- current gate headline
- blocker summary
- next milestone
- confidence badge

Recommended IDs:
- `rfsHeroGate`
- `rfsHeroBlockers`
- `rfsHeroNextMilestone`
- `rfsHeroConfidence`

### Mode bar

Tabs:
- Setup
- Units
- Gates
- Tests
- Defects
- Overlay
- Forecast
- Report

Recommended IDs:
- `rfsModeSetup`
- `rfsModeUnits`
- `rfsModeGates`
- `rfsModeTests`
- `rfsModeDefects`
- `rfsModeOverlay`
- `rfsModeForecast`
- `rfsModeReport`

## Page Sections

All screens should exist in one DOM tree and be toggled by `display:none`.

Recommended section IDs:
- `rfsSectionSetup`
- `rfsSectionUnits`
- `rfsSectionGates`
- `rfsSectionTests`
- `rfsSectionDefects`
- `rfsSectionOverlay`
- `rfsSectionForecast`
- `rfsSectionReport`

## Screen 1 - Setup

### Purpose

Create or edit the project baseline.

### Layout

Left column:
- project profile card
- facility profile card
- operating archetype card

Right column:
- baseline readiness preview
- risk tags
- caveat box

### Fields

Project profile:
- project name
- region
- customer type
- project phase

Facility profile:
- facility type
- IT load
- redundancy class
- cooling type
- phasing model

Archetype profile:
- enterprise
- colo retail
- colo wholesale
- hyperscale self-build
- AI retrofit
- sovereign regulated

### Buttons

- `Save Baseline`
- `Reset`
- `Create Default Units`

Recommended IDs:
- `rfsProjectName`
- `rfsRegion`
- `rfsCustomerType`
- `rfsFacilityType`
- `rfsItLoad`
- `rfsRedundancy`
- `rfsCoolingType`
- `rfsPhasingModel`
- `rfsArchetype`
- `rfsBtnSaveBaseline`
- `rfsBtnCreateUnits`

### Dynamic behavior

When inputs change:
- archetype narrative updates
- baseline risks update
- suggested gates update
- default delivery-unit template updates

## Screen 2 - Units

### Purpose

Define the units that will move through readiness.

### Layout

Top:
- unit creation toolbar

Main:
- unit matrix table on left
- selected unit detail panel on right

### Unit matrix columns

- label
- type
- parent
- target gate
- target date
- blocker count
- confidence

### Unit detail panel

- unit identity
- responsible owner
- unit-specific scope
- linked systems
- linked gates
- linked defects

### Buttons

- `Add Unit`
- `Duplicate Unit`
- `Delete Unit`
- `Generate Standard Unit Set`

Recommended IDs:
- `rfsUnitsTable`
- `rfsUnitDetail`
- `rfsBtnAddUnit`
- `rfsBtnDuplicateUnit`
- `rfsBtnDeleteUnit`
- `rfsBtnGenerateUnits`

### Dynamic behavior

Selecting a unit should update:
- gate panel
- defect summary
- evidence summary
- forecast panel

## Screen 3 - Gates

### Purpose

Show where readiness is blocked.

### Layout

Top row KPI cards:
- active unit
- current gate
- next gate
- blocker count
- missing evidence
- confidence

Main area:
- gate board on left
- blocker detail drawer on right

### Gate board design

Rows:
- delivery units

Columns:
- G0
- G1
- G2
- G3
- G4
- G5
- G6
- G7

Cell states:
- not started
- in progress
- blocked
- at risk
- ready for signoff
- approved

### Clicking a gate cell opens

- blockers
- missing evidence
- open defects
- missing approvals
- required witness events

Recommended IDs:
- `rfsGateBoard`
- `rfsGateBlockersPanel`
- `rfsGateEvidencePanel`
- `rfsGateApprovalsPanel`

### Dynamic behavior

Gate cell color updates live based on:
- open critical defects
- evidence completion
- sign-off status
- overlay requirements

## Screen 4 - Tests

### Purpose

Track test package execution by system and phase.

### Layout

Top:
- filters for unit, discipline, phase, status

Main:
- test package table
- selected package drawer

### Table columns

- phase
- discipline
- system
- package name
- planned date
- witness
- status
- linked defects

### Package drawer

- package summary
- acceptance criteria
- evidence requirements
- linked defects
- retest required
- notes

Recommended IDs:
- `rfsTestsFilterUnit`
- `rfsTestsFilterDiscipline`
- `rfsTestsFilterPhase`
- `rfsTestsTable`
- `rfsTestPackageDrawer`

### Dynamic behavior

Changing package status should update:
- gate readiness
- forecast drag
- defect queue

## Screen 5 - Defects

### Purpose

Make unresolved issues the operational center of the app.

### Layout

Top row:
- severity counters
- aging counters
- blocked gate count

Main:
- defects table
- selected defect panel

### Table columns

- ID
- title
- unit
- severity
- owner
- status
- aging
- gate impact
- retest

### Defect panel

- description
- source test package
- linked gate impact
- owner
- due date
- action plan
- waiver allowed
- retest status

### Quick actions

- `New Defect`
- `Assign`
- `Mark Ready for Retest`
- `Close`
- `Waive`

Recommended IDs:
- `rfsDefectCounters`
- `rfsDefectsTable`
- `rfsDefectDrawer`
- `rfsBtnNewDefect`
- `rfsBtnDefectAssign`
- `rfsBtnDefectRetest`
- `rfsBtnDefectClose`
- `rfsBtnDefectWaive`

### Dynamic behavior

When a defect becomes `closed`:
- gate reevaluates
- confidence recalculates
- blocker narrative updates

## Screen 6 - Overlay

### Purpose

Apply customer and contract-specific overlays without polluting baseline assumptions.

### Layout

Left:
- overlay list

Right:
- selected overlay detail
- impact preview

### Overlay table columns

- type
- source class
- applies to
- gate impact
- witness impact
- evidence impact

### Overlay form fields

- overlay type
- source class
- source reference
- applies to units
- adds witness yes or no
- adds evidence yes or no
- tightens gate yes or no
- notes

Recommended IDs:
- `rfsOverlayTable`
- `rfsOverlayDrawer`
- `rfsBtnAddOverlay`
- `rfsOverlayImpactPreview`

### Dynamic behavior

Before saving, preview should show:
- added witness count
- added evidence items
- changed gate status
- forecast drag

## Screen 7 - Forecast

### Purpose

Explain schedule and cost movement.

### Layout

Top:
- scenario selector
- save scenario button
- compare toggle

Main row 1:
- RFS window card
- next gate window card
- confidence dial
- delay driver chart

Main row 2:
- unit forecast table
- scenario comparison panel

### Forecast table columns

- unit
- current gate
- next gate
- target date
- forecast date
- variance
- confidence
- primary drag

Recommended IDs:
- `rfsForecastScenario`
- `rfsBtnSaveScenario`
- `rfsForecastKpis`
- `rfsDelayDriverChart`
- `rfsForecastTable`
- `rfsScenarioCompare`

### Dynamic behavior

Changing assumptions should update:
- forecast date range
- confidence
- top drag drivers
- scenario delta

## Screen 8 - Report

### Purpose

Generate communication-ready outputs.

### Layout

Top:
- report type selector
- target scope selector

Main:
- report preview canvas

Bottom:
- export actions

### Report types

- Executive snapshot
- Gate readiness pack
- Defect aging summary
- Customer witness pack
- Forecast summary

Recommended IDs:
- `rfsReportType`
- `rfsReportScope`
- `rfsReportPreview`
- `rfsBtnPrintReport`
- `rfsBtnExportPdf`

## Shared Components

### KPI card

Use for:
- blocker count
- current gate
- missing evidence
- confidence
- forecast variance

Recommended class:
- `.rfs-kpi-card`

### Status pill

Use consistent status pills:
- blocked
- at risk
- ready
- approved
- waived
- benchmark only

Recommended class:
- `.rfs-status-pill`

### Right-side detail drawer

Use on desktop for:
- gate details
- defect details
- package details
- overlay details

On mobile:
- convert to full-width stacked card below table

### Narrative insight block

Use to explain:
- why gate is blocked
- why confidence moved
- why forecast shifted

This should be generated, not manually written every time.

Recommended IDs:
- `rfsNarrativeBlock`

## Free vs Pro Gating

### Free

Visible:
- Setup
- Units
- Gates
- simple Forecast
- simple Report

Gated:
- Tests detail
- Overlay
- multi-scenario compare
- advanced Report types

### Pro

Unlock:
- all tabs
- advanced KPIs
- scenario compare
- overlay preview
- export packs

Reuse the same visual pattern you already apply in `cx-calculator.html` and `capex-calculator.html`.

## Mobile Rules

### Mobile priorities

On mobile:
- show KPI cards in 2 columns
- collapse tables into cards
- move detail drawer below selected row
- keep mode tabs horizontally scrollable
- put export buttons into one actions dropdown if needed

### Do not do on mobile

Do not show:
- giant matrix by default
- full-width dense tables without filters

## Interaction Rules

### Rule 1

Every major user action should trigger:
- save to localStorage
- recompute gate state
- recompute forecast
- rerender visible section only

### Rule 2

Never rerender the full page for one defect update.

### Rule 3

Show confirmation toasts for:
- saved
- imported
- exported
- gate changed
- defect closed

Recommended IDs:
- `rfsToastStack`

## Suggested DOM Initialization Order

1. load schema version
2. load active project
3. load project domains
4. run migration if needed
5. evaluate all gates
6. calculate forecasts
7. render hero
8. render active mode

## Suggested Event Flow

Example: defect closure

1. user clicks `Close`
2. update defect object
3. save defects domain
4. reevaluate impacted gates
5. recalculate impacted units
6. rerender defect table
7. rerender gate board
8. rerender hero KPIs
9. show toast

This is the right behavior for a dynamic static app.

## Implementation Advice

Start by building these first:
- Setup screen
- Units screen
- Gates screen
- Defects screen

Do not start with:
- giant Gantt
- huge report engine
- full standards tree UI

The first version should prove that:
- delivery units work
- gates recalculate
- defects drive readiness
- localStorage persists cleanly

## Next Build Step

The next direct implementation artifact should be:

`rfs-readiness-workbench.html`

With:
- shell
- mode tabs
- setup form
- units table
- gate board
- defects board
- localStorage store object

That is the narrowest useful app slice.
