# RFS App V3 - 50 Adopted Enhancements

Date: 2026-03-18

Status: all 50 items below are adopted into the design direction for the static HTML + localStorage RFS app.

Purpose: this document turns "ideas" into implementation-grade requirements. Each enhancement includes:
- what changes
- why it matters
- how it should be implemented in the app

This is not a loose wishlist. It is an adopted enhancement pack for the RFS product model.

## A. Product Architecture and Scope

### 1. Replace one monolithic calculator with a gate-driven readiness workbench

What changes:
- the app stops behaving like one giant formula screen
- the app becomes a readiness workbench with modules for setup, units, gates, tests, defects, overlays, forecast, and report

Why it matters:
- RFS is not one calculation
- users need to operate on blockers, evidence, and gate decisions, not only on inputs and totals

Implementation:
- default home state shows gate board, blocker summary, and forecast confidence
- calculation logic becomes one subsystem, not the main product identity

### 2. Make delivery units first-class objects

What changes:
- campus, building, hall, pod, electrical block, and mechanical plant become visible units

Why it matters:
- real data center turnover rarely happens as one monolithic object
- phased delivery is a core reality for hyperscale, colo, and AI facilities

Implementation:
- no project can move beyond setup without at least one delivery unit
- each unit carries its own gate state, blockers, evidence, and forecast

### 3. Split readiness into distinct states instead of one endpoint

What changes:
- the app separates energization, startup readiness, FPT readiness, IST readiness, facility RFS, customer acceptance, and turnover

Why it matters:
- many projects confuse "technically tested" with "commercially ready" or "customer accepted"

Implementation:
- gate set becomes `G0` to `G7`
- no single readiness label hides these distinct states

### 4. Replace named hyperscaler presets with archetypes plus customer overlays

What changes:
- remove deterministic named-customer defaults as the main operating model

Why it matters:
- public-source assumptions are too weak to claim customer-specific precision

Implementation:
- use archetypes such as `wholesale_hyperscale`, `retail_colo`, `ai_fast_track_retrofit`, `regulated_sovereign`
- use customer overlays only when the user has actual customer or contract-backed requirements

### 5. Introduce a strict source-confidence system

What changes:
- every rule, default, or benchmark is tagged with `A`, `B`, `C`, or `D`

Why it matters:
- this prevents benchmark assumptions from masquerading as confirmed customer standards

Implementation:
- UI badge on every rule-driven item
- only `A` and `B` can create automatic hard blockers

### 6. Separate baseline rules from customer-confirmed requirements

What changes:
- baseline engineering practice and customer overlay are stored separately

Why it matters:
- users need to know whether a requirement is universal, owner-driven, or customer-specific

Implementation:
- dual view in UI: `Baseline` and `Customer Delta`
- reports show both layers clearly

### 7. Add a project baseline lock gate

What changes:
- setup is not considered complete until the project baseline is formally locked

Why it matters:
- many readiness problems begin from moving targets, not only poor execution

Implementation:
- `G0 Program Baseline Locked`
- requires archetype, phasing model, unit structure, owner model, and minimum rules package

## B. Gate, Blocker, and Decision Logic

### 8. Add hard blocker logic per gate

What changes:
- gates cannot advance just because percentages are high

Why it matters:
- one critical fire, controls, power, or legal blocker can invalidate a 90 percent complete dashboard

Implementation:
- gate engine checks hard blockers first, weighted completion second

### 9. Use prerequisite inheritance across gates

What changes:
- later gates inherit certain unresolved conditions from earlier gates

Why it matters:
- missing sign-off from earlier phases should not disappear just because a later checklist was opened

Implementation:
- unresolved prerequisite items cascade into downstream gate status

### 10. Add conditional gate logic, not only fixed requirements

What changes:
- some requirements appear only when relevant

Why it matters:
- a facility with generators, customer acceptance testing, or carrier diversity obligations should not be treated like one without them

Implementation:
- requirement applicability is based on facility type, delivery model, utility design, customer mode, and overlay rules

### 11. Introduce a sign-off matrix by gate

What changes:
- each gate has required approver roles

Why it matters:
- readiness is not real until the responsible authorities approve it

Implementation:
- roles such as `Cx Lead`, `Ops Lead`, `Project Director`, `Customer Witness`, `Fire Authority`, or `Commercial Lead` are mapped to gates

### 12. Introduce a waiver lifecycle instead of ad hoc exceptions

What changes:
- waivers become first-class governed objects

Why it matters:
- soft deviations may be acceptable, but only with explicit approver, scope, expiry, and residual risk

Implementation:
- waiver object includes reason, approver, expiry, residual risk, linked item, and linked gate

### 13. Add hold points and witness points

What changes:
- the app distinguishes between internal prerequisites and formal hold points where external or customer witness is required

Why it matters:
- witness scheduling is a major real-world source of delay

Implementation:
- test packages and gates can carry `witnessRequired=true`
- forecast adds drag if witness is required but unscheduled

### 14. Add gate readiness and gate confidence as separate metrics

What changes:
- readiness and confidence are no longer merged

Why it matters:
- a gate can be nearly complete but still have low confidence because of unresolved risk, retests, or witness uncertainty

Implementation:
- readiness is driven by requirement completion
- confidence is driven by defects, evidence gaps, approvals, and forecast drag

### 15. Cap readiness when critical evidence is missing

What changes:
- readiness percentages cannot reach false 100

Why it matters:
- teams often tick activity items but still lack the documents, logs, or approvals required to support closure

Implementation:
- missing mandatory evidence caps readiness at 95
- missing approvals cap readiness at 99

## C. Defects, Retests, and Risk Handling

### 16. Make defects the operational center of the app

What changes:
- unresolved defects become primary objects driving status, not passive notes

Why it matters:
- in execution, open defects decide whether a gate can move

Implementation:
- home dashboard shows blocker defects, aging, and gate impact

### 17. Add severity-driven blocker behavior

What changes:
- defect severity affects gate status, confidence, and forecast drag differently

Why it matters:
- not all issues should be treated equally

Implementation:
- `critical` auto-blocks gate
- `major` heavily penalizes confidence and may block if linked to gate-critical requirement
- `moderate`, `minor`, and `observation` behave progressively lighter

### 18. Add retest dependency tracking

What changes:
- if a defect requires retest, the gate remains exposed until retest outcome is accepted

Why it matters:
- closure without verification is not closure

Implementation:
- test package state `retest_required`
- defect cannot close until retest result is logged if `retestRequired=true`

### 19. Add defect aging discipline with response thresholds

What changes:
- defects gain warning and overdue states by severity

Why it matters:
- stale issues are a major hidden delay driver

Implementation:
- aging thresholds configurable in settings
- dashboard shows overdue criticals separately

### 20. Add a root cause and recurrence field

What changes:
- defects capture whether root cause is known and whether the issue is recurrent

Why it matters:
- repeat failures are more important than isolated defects

Implementation:
- defect form includes `rootCauseKnown`, `recurrenceClass`, and `preventiveAction`

### 21. Add defect-to-gate many-to-many mapping

What changes:
- one defect can affect multiple gates and multiple units if necessary

Why it matters:
- system-level issues can block more than one readiness step

Implementation:
- `gateImpact` array on defect object
- `unitScope` supports local or cross-unit defects

## D. Evidence, Documentation, and Revision Control

### 22. Build an evidence metadata register, not a file bucket

What changes:
- the app stores evidence metadata only

Why it matters:
- localStorage cannot safely hold real document repositories

Implementation:
- each evidence item stores type, label, status, source note, file name, and sign-off state, but not the binary itself

### 23. Add evidence type taxonomy

What changes:
- evidence is categorized consistently

Why it matters:
- users need predictable document expectations

Implementation:
- evidence types such as `test_report`, `certificate`, `permit`, `training_record`, `contract`, `insurance_cert`, `witness_sheet`, `as_built`, `waiver`, `risk_assessment`

### 24. Add revision-control metadata on evidence

What changes:
- evidence objects can track version and supersession state

Why it matters:
- outdated documents often survive unnoticed and create false confidence

Implementation:
- fields: `revision`, `issueDate`, `supersedesId`, `isCurrent`

### 25. Add evidence completeness scoring by domain

What changes:
- evidence completeness is visible at domain and gate level

Why it matters:
- teams need to see whether the gap is technical, legal, commercial, or operational

Implementation:
- completeness ring or stacked bar by domain
- missing mandatory evidence shown separately from optional evidence

### 26. Add as-built and asset-register completeness checks

What changes:
- documentation coverage becomes measurable

Why it matters:
- handover often fails because the site is physically complete but digitally undocumented

Implementation:
- compare required drawing families and asset categories against loaded metadata

### 27. Add training and drill evidence as formal closure requirements

What changes:
- training completion and emergency drill evidence are no longer soft notes

Why it matters:
- RFS should mean operators are ready, not only equipment

Implementation:
- training items and drill records become evidence objects linked to `G5` or `G6`

## E. SOP, MOP, EOP, and Operational Playbook Depth

### 28. Split SOP, MOP, and EOP into separate libraries

What changes:
- the app stops treating all procedures as one checklist bucket

Why it matters:
- normal operations, maintenance execution, and emergency response are different control systems

Implementation:
- `opsProcedures`
- `changeProcedures`
- `emergencyProcedures`

### 29. Add change-execution MOP templates

What changes:
- critical maintenance and isolation procedures become structured templates

Why it matters:
- RFS without executable MOPs is still operationally immature

Implementation:
- template fields: preconditions, risk statement, steps, rollback, communications, approvals

### 30. Add emergency drill and rehearsal tracking

What changes:
- emergency procedures must show rehearsal state

Why it matters:
- unread EOPs are not readiness

Implementation:
- each EOP can carry `drillRequired`, `lastDrilledAt`, `participants`, `lessonsLearned`

### 31. Add management-of-change governance as an active control

What changes:
- MOC is not only a procedure on paper; it becomes a trackable status

Why it matters:
- uncontrolled change after commissioning can invalidate readiness assumptions

Implementation:
- MOC register with open change count, approvals, risk review, and rollback readiness

## F. Contracts, Legal Readiness, and Service Assurance

### 32. Create a clause-level contract register

What changes:
- contracts are not only stored as existence yes or no

Why it matters:
- the operational risk usually sits in missing clauses, weak SLAs, or unclear coverage

Implementation:
- contract object stores service type, dates, SLA response, resolution targets, coverage window, parts inclusion, warranty obligations, termination rights

### 33. Add contract continuity and expiry control

What changes:
- contract start dates, gap risks, and renewals become visible

Why it matters:
- many teams think they are covered but have a gap between provisional and live support periods

Implementation:
- expiry alarms
- upcoming gap warnings
- RFS block if critical contract not active by gate date

### 34. Add customer legal and commercial clause validation

What changes:
- customer readiness includes legal and commercial completeness, not only technical acceptance

Why it matters:
- you cannot call a service ready if pricing, credits, liability, or maintenance notice terms are unresolved

Implementation:
- customer contract checklist tracks SLA terms, pricing schedule, maintenance notice window, access rights, reporting cadence, legal obligations

### 35. Add utility and fuel continuity assurance checks

What changes:
- supply continuity becomes a governed workstream

Why it matters:
- a site with generators but weak fuel continuity planning is not resilience-ready

Implementation:
- supplier diversity, delivery-time guarantee, tank level, fuel quality, utility agreement, and water continuity all have explicit objects

## G. Vendor Due Diligence and Serviceability

### 36. Add a critical vendor due diligence register

What changes:
- critical vendor evaluation becomes explicit

Why it matters:
- contract signature is not proof of capability

Implementation:
- separate register for OEMs, service partners, carriers, fuel suppliers, controls integrators, and safety vendors

### 37. Add OEM authorization and warranty-preservation checks

What changes:
- the app verifies whether service vendors preserve OEM warranty

Why it matters:
- unauthorized intervention on UPS, generators, chillers, or fire systems can create real post-RFS risk

Implementation:
- vendor DD object includes `oemAuthorized`, `authorizationRef`, `warrantyCompatible`

### 38. Add vendor emergency support capability checks

What changes:
- vendors are assessed for real emergency responsiveness

Why it matters:
- a vendor with no local 24/7 support should not be treated as equal to one with proven rapid response

Implementation:
- DD captures local footprint, response commitment, escalation contacts, regional depot or stock, and after-hours path

### 39. Add financial and continuity screening for critical vendors

What changes:
- critical service and supply vendors receive minimum continuity review

Why it matters:
- a financially weak sole-source vendor can become a hidden RFS risk

Implementation:
- DD fields for credit or financial confidence, BCP summary, dependency on subcontractors, and alternate supplier availability

### 40. Add cyber and remote-access due diligence for digital vendors

What changes:
- BMS, DCIM, security, EPMS, and remote monitoring vendors must pass a minimum cyber posture check

Why it matters:
- digital critical systems are now operational dependencies, not optional extras

Implementation:
- DD captures remote access method, MFA use, logging, patching cadence, and credential ownership model

## H. Staffing, Competency, and Human Readiness

### 41. Add a minimum staffing model by facility scale and delivery model

What changes:
- staffing readiness is no longer generic

Why it matters:
- a colo facility, owner-operator enterprise site, and hyperscale shell-and-core program do not need the same headcount pattern

Implementation:
- baseline staffing bands by facility type and MW range
- editable by project

### 42. Add a role-by-role competency matrix

What changes:
- readiness checks whether specific roles are trained and assessed

Why it matters:
- staffing numbers alone do not prove readiness

Implementation:
- matrix by role and competency: electrical, mechanical, controls, safety, incident response, customer operations

### 43. Add training validity and expiry control

What changes:
- some training expires or becomes stale

Why it matters:
- a certificate from long before turnover may not support live readiness

Implementation:
- training items track `completedAt`, `validUntil`, `renewalRequired`

### 44. Add on-call, escalation, and external contact validation

What changes:
- the app validates human response chain readiness

Why it matters:
- emergency support is as much about response chain clarity as technical assets

Implementation:
- on-call roster, escalation tree, OEM hotline, utility contact, fire liaison, insurer claims contact are all explicit objects

## I. Customer Acceptance and Commercial Readiness

### 45. Add a customer acceptance workspace

What changes:
- customer readiness becomes its own view, not just a tail-end checklist

Why it matters:
- customer acceptance often has different blockers than facility commissioning

Implementation:
- dedicated view for walkthroughs, witness tests, burn-in, sign-off certificates, access credentials, portal setup, and communication rules

### 46. Add phased handover and shell-core versus white-space distinction

What changes:
- the app distinguishes shell and core readiness from white-space or customer fit-out readiness

Why it matters:
- this is essential for wholesale and hyperscale delivery

Implementation:
- unit types can be shell-core, white-space, support plant, or customer area
- reports show readiness by delivery layer

### 47. Add burn-in and post-handover stabilization tracking

What changes:
- the app continues tracking the burn-in window after nominal RFS

Why it matters:
- many customer acceptances are conditional on a stable initial operation period

Implementation:
- burn-in duration field
- early-life incidents and unresolved post-RFS issues linked back into acceptance status

## J. Forecast, Analytics, and Reporting

### 48. Add a delay-drag forecast engine

What changes:
- forecast is based on blockers, evidence gaps, approvals, retests, and witness constraints

Why it matters:
- timeline multipliers alone are too blunt

Implementation:
- each issue type contributes drag days
- forecast is unit-level first, project-level second

### 49. Add scenario compare and narrative explanations

What changes:
- users can compare baseline, aggressive, and constrained scenarios

Why it matters:
- decisions are easier when changes in risk, date, and effort are visible side by side

Implementation:
- save scenario snapshots
- narrative engine explains why Scenario B is later or more expensive than Scenario A

### 50. Add blocker-first executive reporting and integrity guardrails

What changes:
- reports lead with blockers, confidence, and assumptions, not vanity percentages

Why it matters:
- serious stakeholders care first about what prevents readiness

Implementation:
- executive snapshot starts with blocked units, overdue critical defects, missing mandatory evidence, and confidence band
- every report carries benchmark and legal disclaimer text

## 11. What “Implement All” Means Here

All 50 enhancements above are now treated as adopted requirements at the design and build-spec level.

That means:
- they are not optional ideas anymore
- they should shape the data model
- they should shape the UI
- they should shape the gate engine
- they should shape the reporting logic

They do not mean the app code has already been built. They mean the design package has been hardened so the implementation can now be built against a more mature target.

## 12. Recommended Next Execution Step

The right next move is not another abstract note.

The right next move is one of these:
- generate the JSON seed library from these 50 enhancements
- generate the full object schema file from these 50 enhancements
- build the first `rfs-readiness-workbench.html` scaffold using these 50 enhancements as the implementation base
