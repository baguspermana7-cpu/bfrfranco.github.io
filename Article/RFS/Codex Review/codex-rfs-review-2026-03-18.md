# Codex Review - RFS App Draft

Date: 2026-03-18

Scope reviewed:
- `dc-commissioning-calculator-spec.md`
- `dc-commissioning-research.md`
- `dc-commissioning-test-protocols.md`
- `hyperscaler-rfs-requirements.md`

## Executive Verdict

The strongest part of this draft is the technical commissioning content. The weakest part is the product abstraction wrapped around it.

Right now, the draft is trying to be five products at once:
- a commissioning calculator
- an RFS readiness platform
- a customer standards benchmarker
- a commercial and regulatory turnover tracker
- a schedule and cost forecaster

That breadth creates the appearance of completeness, but it will not create trust with serious cloud or hyperscale customers unless the evidence model, readiness gates, and source discipline are redesigned. The current version is rich in detail but still too brittle, too deterministic, and too monolithic to be called precise.

My direct assessment:
- The technical core is worth keeping.
- The hyperscaler preset layer is not safe in its current form.
- The scoring, timeline, and cost models are too blunt for the precision the draft claims.
- The interface and workflow need to shift from "giant calculator + giant checklist" to "readiness operating system with role-based workspaces and evidence-backed gates."

## Findings

### 1. Critical: The draft over-claims precision relative to the quality of its evidence base

`dc-commissioning-calculator-spec.md:7` claims "playbook-grade accuracy" and says every cost, timeline, and staffing figure is benchmarked against real hyperscaler data. The same document then hardcodes company-level multipliers, timelines, and target values in `CLOUD_PROFILES` and the comparative table at `dc-commissioning-calculator-spec.md:147-223` and `dc-commissioning-calculator-spec.md:735-751`.

This is not supportable as written.

Evidence:
- `hyperscaler-rfs-requirements.md:32` says Google internal commissioning processes are proprietary and not publicly disclosed, then still assigns Google-specific timeline, PUE, testing, and tooling assumptions.
- `hyperscaler-rfs-requirements.md:119` says Microsoft specifics are proprietary and NDA-bound, then still derives detailed process assumptions.
- `hyperscaler-rfs-requirements.md:197` explicitly says AWS physical commissioning details are not publicly disclosed.
- `dc-commissioning-research.md:908-910` includes sources such as Introl and Wikipedia.
- `hyperscaler-rfs-requirements.md:850`, `hyperscaler-rfs-requirements.md:865`, `hyperscaler-rfs-requirements.md:871-877`, `hyperscaler-rfs-requirements.md:886`, `hyperscaler-rfs-requirements.md:906`, and `hyperscaler-rfs-requirements.md:914-918` rely heavily on trade press, blogs, newsletters, and secondary commentary.

Why this matters:
- Large cloud customers will detect false precision quickly.
- Public-source inference is acceptable for directional benchmarking, but not for deterministic customer presets.
- If the UI says "AWS standard" or "Google standard" and the underlying logic is inferred, the trust model breaks immediately.

What to change:
- Replace provider-specific deterministic presets with operating archetypes.
- Add source confidence tiers to every assumption.
- Require internal or customer-provided standards before enabling named-customer overlays.

Recommended model:
- Archetype 1: self-build hyperscale
- Archetype 2: wholesale colo for hyperscaler
- Archetype 3: retail multi-tenant colo
- Archetype 4: AI fast-track retrofit
- Archetype 5: sovereign or regulated environment
- Archetype 6: enterprise mission critical owner-operator

Then add:
- Customer overlay: only populated from actual customer standards, contract exhibits, or agreed deviations
- Confidence tag per rule: `A Primary`, `B Credible secondary`, `C Inferred benchmark`, `D Directional only`

### 2. Critical: The app is built around the wrong abstraction

The draft is not actually a calculator. It is an attempted end-to-end readiness platform disguised as a calculator.

Evidence:
- `dc-commissioning-calculator-spec.md:4` says the tool covers inputs, algorithms, data structures, cost models, Gantt logic, cloud profiles, UI hierarchy, testing protocols, and PDF export.
- `dc-commissioning-calculator-spec.md:757-775` expands RFS into 10 categories and about 740 items.
- `dc-commissioning-calculator-spec.md:1814-1824` includes not only commissioning cost but documentation, certification, SOPs, spares, maintenance, fuel, insurance, staffing, and customer readiness.
- `dc-commissioning-calculator-spec.md:2152-2175` puts total cost, timeline, readiness score, Gantt, and checklist progress into a single dashboard concept.

Why this matters:
- A calculator implies a bounded problem with a stable formula.
- RFS in your own draft is a governance problem, not only a formula problem.
- The current abstraction will produce a UI that looks comprehensive but behaves like a crowded spreadsheet with icons.

What to change:
- Reframe the product as `RFS Readiness Platform`.
- Keep a calculator inside it, but only as one module.

Recommended product architecture:
- Module 1: Technical commissioning engine
- Module 2: Readiness gates and evidence room
- Module 3: Customer acceptance and deviation management
- Module 4: Commercial, contract, and regulatory closeout
- Module 5: Forecasting and scenario simulation

This matches how large programs are actually managed.

### 3. Critical: AWS ORR is conceptually mixed with physical data center commissioning

This is the most obvious trust-breaking technical mismatch in the draft.

Evidence:
- `dc-commissioning-calculator-spec.md:314-317` lists AWS ACx, ORR, and COE together under tools or process signals.
- `dc-commissioning-calculator-spec.md:983` lists "AWS: ORR completion, COE integration check" under `A6.7 Cloud Company-Specific IST`.
- `hyperscaler-rfs-requirements.md:183-197` correctly describes ORR as a software and service operations lifecycle process built into the SDLC and Well-Architected framework, not as a physical data center commissioning gate.

Why this matters:
- A cloud customer or ex-hyperscaler operator will immediately see this as category error.
- ORR can be relevant to service launch readiness, but it is not a valid stand-in for physical RFS or IST completion.

What to change:
- Split readiness into separate layers:
- `Facility readiness`
- `Operations readiness`
- `Customer launch readiness`
- `Service readiness`

If you want to support software-layer or service-layer launch readiness, that should be a separate overlay, not embedded into L5 physical commissioning logic.

### 4. High: The timeline engine is too simple to support critical-path claims

The timeline model is elegant, but not credible enough for real project forecasting.

Evidence:
- `dc-commissioning-calculator-spec.md:2038-2066` calculates duration from facility type, size, cloud multiplier, tier multiplier, DLC percentage, and lead time multiplier.
- `dc-commissioning-calculator-spec.md:2085-2130` defines overlaps mechanically and returns a fixed critical path of `['L3', 'L4', 'L5']`.

What is missing:
- utility energization dependency
- AHJ and fire marshal sequencing
- substation and grid availability
- FAT failure or deferred release risk
- controls integration maturity
- sequence-of-operations completeness
- witness scheduling constraints
- defect closure aging
- phased building or hall turnover
- long-lead reschedule events
- retest loops
- contractor productivity variance
- access restrictions and shift windows

Why this matters:
- Large data center programs rarely hand over as one monolithic object.
- Halls, blocks, electrical lineups, or cooling trains often move through readiness at different speeds.
- A site-level single-path Gantt becomes misleading very quickly.

What to change:
- Move from static multiplier schedule logic to dependency-based forecasting.
- Model schedule at least at `delivery unit` level:
- campus
- building
- data hall or pod
- electrical block
- mechanical plant

Recommended schedule engine:
- Rules-based dependency network
- Gate-based predecessor logic
- Defect-driven hold points
- Optional Monte Carlo ranges for critical durations
- Scenario modes: `baseline`, `aggressive`, `customer witness constrained`, `supply constrained`

### 5. High: The cost model is too blunt for the precision level promised

The cost logic is still too top-down even though the draft claims bottom-up accuracy.

Evidence:
- `dc-commissioning-calculator-spec.md:1829-1883` derives commissioning cost primarily from construction cost, CxA fee rate, fixed allocations, and multipliers.
- `dc-commissioning-calculator-spec.md:1888-1914` uses broad facility-type and location multipliers for cost per MW.
- `dc-commissioning-calculator-spec.md:1919-1957` uses simplified equipment rental assumptions.
- `dc-commissioning-calculator-spec.md:1964-2028` uses fixed role counts and day rates by facility size band.

Why this matters:
- Real commissioning cost is often driven by test packages, witness requirements, mobilization, retests, overtime, specialist OEM support, temporary conditions, and documentation burden.
- A 50 MW site and another 50 MW site can have very different commissioning cost depending on phasing, redundancy philosophy, controls maturity, customer witness intensity, and deficiency closure performance.

What to change:
- Build an activity-based costing layer.

Recommended cost objects:
- FAT campaigns by equipment family
- L2 inspections by installed asset count
- L3 startup packages by system
- L4 FPT packages by scenario count
- L5 IST campaigns by scripted event count
- Witness days and customer attendance
- OEM attendance and specialist technician packages
- Retest loops
- Temporary plant and load bank mobilization
- Travel and shift premium
- Documentation pack production and closeout effort

The current model can remain for directional planning, but it cannot be the "precision" engine.

### 6. High: The draft exposes a readiness score without a defensible scoring framework

Evidence:
- `dc-commissioning-calculator-spec.md:2155-2158` includes `Readiness Score` as a headline KPI.
- The checklist structure is extensive, but there is no inspected scoring method that shows blockers, mandatory gates, weighted evidence, waivers, or authority thresholds.
- `dc-commissioning-test-protocols.md:1332-1345` contains a much stronger gate concept: every issue enters the punch list, closure is approved by the owner's commissioning authority, and serious open items should block IST.
- `dc-commissioning-calculator-spec.md:1034-1036` also indicates "0 open critical items" for test and commissioning records, but this is not converted into a rules engine.

Why this matters:
- Serious customers do not trust a single readiness percentage unless they can drill down into gate logic and blockers.
- A site with 92 percent checklist completion can still be non-ready if one fire cause-and-effect defect or one controls interlock failure remains open.

What to change:
- Replace one global score with gate-based readiness classes.

Recommended gate model:
- Gate 1: Safe to energize
- Gate 2: System startup ready
- Gate 3: FPT ready
- Gate 4: IST ready
- Gate 5: Facility RFS ready
- Gate 6: Customer acceptance ready
- Gate 7: Revenue or turnover ready

Each gate should have:
- hard blockers
- weighted non-blockers
- required evidence types
- required sign-off authorities
- waiver path with expiry date and residual risk note

If you still want a score, make it secondary:
- `Gate status` is primary
- `Readiness percentage` is informational only

### 7. High: Evidence, ownership, and sign-off are mentioned but not modeled as first-class data

The draft repeatedly references witness requirements, resolution evidence, sign-offs, and acceptance, but the data model still behaves like a checklist.

Evidence:
- `dc-commissioning-calculator-spec.md:806` includes FAT witness requirements.
- `dc-commissioning-calculator-spec.md:1036` mentions deficiency log with resolution evidence.
- `dc-commissioning-calculator-spec.md:1087-1088` includes permit and engineer sign-offs.
- `dc-commissioning-calculator-spec.md:1780` includes customer sign-off or acceptance certificate.
- `dc-commissioning-test-protocols.md:1331-1345` lays out owner approval, item ownership, and closure governance more clearly than the spec itself.

Why this matters:
- Cloud customers care about evidence chains, not only percentages.
- The real question is not "how many items are done?" It is "which gate is blocked, by whom, based on what evidence, with what residual risk?"

What to change:
- Define a first-class readiness item schema.

Minimum readiness item fields:
- unique ID
- domain
- gate
- delivery unit
- system and subsystem
- requirement statement
- acceptance criteria
- evidence type
- evidence link
- owner
- due date
- status
- severity
- witness required yes or no
- sign-off authority
- waiver allowed yes or no
- waiver status
- source confidence
- customer source reference

This is the backbone the product currently lacks.

### 8. Medium-High: Named hyperscaler comparative tables and multipliers are too brittle and too easy to misuse

Evidence:
- `dc-commissioning-calculator-spec.md:737-751` creates a side-by-side table of exact RFS months, PUE, power density, DLC percent, redundancy, renewable percent, methodology, cost multipliers, and timeline multipliers.
- `dc-commissioning-calculator-spec.md:398-399`, `dc-commissioning-calculator-spec.md:483-484`, and `dc-commissioning-calculator-spec.md:533-534` encode aggressive timeline multipliers for Oracle, Stargate, and xAI.
- `hyperscaler-rfs-requirements.md:723-730` and `hyperscaler-rfs-requirements.md:798-805` show that many of these numbers are partly inferred, partly anecdotal, or dependent on specific projects.

Why this matters:
- Exceptional projects become mistaken for reusable standards.
- Outliers are not templates.
- Customers may treat these values as promises or standards when they are really directional market observations.

What to change:
- Convert exact comparison tables into bounded benchmark ranges.
- Mark outliers explicitly.
- Separate `public market intelligence` from `customer-specific standard`.

Example:
- Instead of `xAI timelineMultiplier: 0.30`, use `fast-track AI retrofit archetype: highly exceptional, not baseline, requires major risk acceptance and non-standard constraints`.

### 9. Medium: The UI concept will likely overwhelm users and reduce signal-to-noise

Evidence:
- `dc-commissioning-calculator-spec.md:759` describes a four-level hierarchy.
- `dc-commissioning-calculator-spec.md:765-775` introduces about 740 items across 10 categories.
- `dc-commissioning-calculator-spec.md:2148-2175` combines executive KPIs, cost, Gantt, and checklist progress in the same conceptual dashboard.

Why this matters:
- Different roles need different abstractions.
- A Cx manager, PM, ops lead, customer rep, and executive sponsor should not all see the same default screen.

What to change:
- Build role-based workspaces.

Recommended primary views:
- Executive view: blockers, gate status, defect aging, next customer witnesses, confidence to RFS date
- Cx manager view: system matrix, test campaigns, retest queue, unresolved defects by severity
- PM view: dependency risks, upcoming milestones, cross-functional hold points
- Ops readiness view: SOP/MOP/EOP completion, staffing and training readiness, spares coverage
- Customer view: contractual deliverables, evidence packages, acceptance status, deviations and waivers

The giant expandable tree should still exist, but not as the main interaction model.

### 10. Medium: The draft collapses too many end states into one RFS outcome

Evidence:
- `dc-commissioning-calculator-spec.md:757-775` defines RFS as the total package of technical, legal, operational, commercial, and supply-chain readiness.
- `dc-commissioning-calculator-spec.md:990-1004` includes closeout and post-handover support.

Why this matters:
- In large programs, "ready for service" is not always the same as:
- mechanical completion
- safe energization
- IST completion
- substantial completion
- customer acceptance
- revenue service
- final turnover

If you collapse these states, schedule, governance, and accountability become muddy.

What to change:
- Make readiness states explicit and separate.

Recommended states:
- Construction complete
- Mechanical completion
- Safe energization ready
- System startup complete
- FPT complete
- IST complete
- Facility RFS ready
- Customer acceptance ready
- Revenue ready
- Final closeout complete

### 11. Medium: The draft correctly broadens RFS beyond testing, but the non-technical domains should not all live inside one scoring engine

Evidence:
- `dc-commissioning-calculator-spec.md:757` explicitly broadens RFS into administrative, legal, operational, commercial, contractual, and supply-chain readiness.
- Category groups B through J include documents, permits, SOPs, spares, maintenance contracts, fuel, insurance, staffing, and customer readiness.

Why this matters:
- The instinct is right.
- The implementation choice is wrong.

The right move is not to delete these domains. The right move is to separate them from the technical test engine while still letting them affect gate status where appropriate.

Recommended treatment:
- Technical domains drive facility gate progression directly.
- Commercial and regulatory domains drive acceptance and turnover gates.
- Insurance and fuel contracts influence operational continuity and handover, but should not distort physical FPT or IST scoring.

### 12. Positive finding: The technical test protocols are the best foundation in the whole draft

Evidence:
- `dc-commissioning-test-protocols.md:25` anchors MV switchgear testing to ANSI/NETA ATS-2025 and IEEE C37.
- `dc-commissioning-test-protocols.md:108` anchors transformer testing to IEEE C57 family.
- `dc-commissioning-test-protocols.md:206` anchors generator testing to NFPA 110 and NETA ATS.
- `dc-commissioning-test-protocols.md:1332-1345` gives a workable deficiency and gate model.

Why this matters:
- This document contains the part that can actually differentiate the product.
- It is closer to engineering truth than the customer-profile inference layer.

What to do:
- Make the standards-based technical test library the core engine.
- Build the readiness platform around that core instead of around named hyperscaler presets.

## Recommended Product Redesign

### 1. Reframe the product

Do not ship this as a single "Data Center Commissioning & RFS Calculator."

Ship it as:

`Data Center RFS Readiness Platform`

With modules:
- `Benchmark Calculator` for early directional estimates
- `Commissioning Engine` for L0-L5 test planning and execution
- `Gate Engine` for readiness decisions
- `Evidence Room` for documents, witness records, and approvals
- `Customer Overlay` for contract-specific standards and deviations
- `Forecasting Engine` for schedule and cost scenarios

### 2. Use a layered rules model

Layer 1: Standards library
- NETA, IEEE, NFPA, ASHRAE, OEM, local code

Layer 2: Program baseline
- delivery model
- facility type
- redundancy philosophy
- cooling architecture
- phasing strategy

Layer 3: Customer overlay
- actual customer standards
- witness matrix
- acceptance criteria
- contractual milestones

Layer 4: Project-specific deviations
- waivers
- residual risks
- approved exceptions

This is much more credible than saying "select cloud provider and the tool knows their standard."

### 3. Build around delivery units, not only site-level totals

The product should let users define:
- campus
- building
- hall or pod
- electrical block
- mechanical plant
- control zone

Every gate, score, forecast, and evidence package should be tied to a delivery unit. This is how phased handover actually works at scale.

### 4. Replace the global readiness score with gate-based status and confidence

Primary outputs should be:
- current gate per delivery unit
- blockers by severity
- evidence completeness
- defect aging
- confidence band to next gate
- forecast RFS window, not only one date

Secondary outputs can include:
- readiness percent by domain
- weighted completion percent
- risk trend over time

### 5. Redesign the customer-fit model

For cloud customers, the product should foreground:
- witness status
- deviation register
- unresolved blockers
- evidence package completeness
- sign-off matrix
- gap to contract requirements
- hall-by-hall or block-by-block turnover readiness

That matters more than a generic benchmark score.

## Recommended Data Model

Core entities:
- `Program`
- `DeliveryUnit`
- `System`
- `Subsystem`
- `Requirement`
- `TestPackage`
- `TestEvent`
- `Defect`
- `Evidence`
- `SignOff`
- `Waiver`
- `Gate`
- `CustomerOverlay`
- `Deviation`

Critical relationships:
- A `Requirement` belongs to one or more `Gates`.
- A `TestEvent` can generate multiple `Defects`.
- A `Gate` cannot close if blocker defects remain open.
- An `Evidence` object must be typed and versioned.
- A `Waiver` must include approver, expiry, scope, and residual risk.
- A `CustomerOverlay` can tighten, loosen, or add requirements, but must retain traceability to source.

## Recommended Scoring and Gate Logic

For each gate:
- Define non-negotiable blockers.
- Define weighted supporting requirements.
- Define mandatory evidence.
- Define required approvers.
- Define waiver policy.

Example:

`IST Ready`
- No open critical life-safety issues
- No open critical controls interlock failures
- All prerequisite FPT packages closed
- Temporary works and test method statements approved
- Witness plan issued
- Load bank strategy approved
- Emergency response coverage confirmed

`Facility RFS Ready`
- IST complete
- No unresolved blocker defects
- Required documentation package complete
- Operations staffing minimum achieved
- Training matrix complete for required roles
- Spares minimum stock in place
- Maintenance and fuel continuity arrangements active where applicable

This is far stronger than a simple 0 to 100 metric.

## Recommended UI and Workflow

### Primary screens

1. Executive dashboard
- gate status by delivery unit
- red blockers
- date confidence
- defect aging
- top cross-functional risks

2. Commissioning operations board
- L0-L5 package tracker
- upcoming tests
- witness attendance
- retests
- system matrix

3. Evidence room
- required vs received
- version control
- missing mandatory evidence
- sign-off history

4. Customer acceptance workspace
- contract deliverables
- deviation register
- witness reports
- acceptance certificates

5. Closeout workspace
- permits
- insurance
- maintenance contracts
- SOP/MOP/EOP
- training
- spares

### Interaction model

Use the 740-item hierarchy as drill-down detail only.

Default interaction should start from:
- blockers
- upcoming gates
- unresolved defects
- missing evidence

Not from a giant checklist tree.

## Source Governance Standard You Should Adopt

Every rule, multiplier, default, or preset should carry a source class:

- `A Primary`: standards body, OEM manual, AHJ rule, customer standard, contract document
- `B Credible secondary`: established trade publication, consultant white paper, audited public report
- `C Inferred benchmark`: derived from public patterns or reasonable engineering judgment
- `D Directional only`: anecdotal, emerging, weakly supported

Rules:
- Customer-facing defaults should use A or B only.
- C can be used for internal benchmark mode.
- D should never drive automated customer-specific outputs.

Also add:
- `Public benchmark, not customer standard`
- `Requires customer confirmation`
- `NDA-only assumption; disable in external mode`

## What to Keep

Keep and strengthen:
- the technical test protocol library
- the broad understanding that RFS extends beyond commissioning
- the inclusion of witness and handover concepts
- the ambition to connect cost, schedule, and readiness

## What to Remove or Downgrade

Remove or downgrade:
- hardcoded named-customer multipliers presented as precise
- single global readiness score as primary KPI
- single-path critical path logic
- the idea that one calculator can truthfully model the whole program at precision level
- AWS ORR as an IST or facility-RFS requirement

## Priority Fix Order

### Priority 1

Refactor the product model:
- calculator becomes one module
- gate and evidence model becomes the core

### Priority 2

Delete or quarantine the named hyperscaler preset logic until:
- source tiers are added
- inference is clearly labeled
- actual customer overlays are available

### Priority 3

Implement the readiness item schema and blocker logic:
- owner
- evidence
- severity
- sign-off
- waiver
- gate linkage

### Priority 4

Rebuild schedule and cost engines around delivery units and activity packages rather than coarse multipliers only.

### Priority 5

Redesign the UI around role-based views and blocker-first workflows.

## Bottom Line

You do not have a detail problem. You have a product-model problem.

If you keep building the current direction, you will likely end up with a very large interface that feels impressive but is weak where hyperscaler and cloud customers care most: evidence, traceability, gate logic, and source credibility.

If you pivot now and keep the standards-based commissioning core, this can become a much stronger product:
- more credible
- more dynamic
- more useful in execution
- more defensible in front of serious customers

My single-line recommendation:

Build this as an evidence-backed, gate-driven RFS readiness platform with customer overlays, not as a monolithic hyperscaler calculator.
