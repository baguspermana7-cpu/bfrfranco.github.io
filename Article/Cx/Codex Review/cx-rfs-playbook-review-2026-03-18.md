# Codex Review: Data Center Commissioning + RFS Playbook App

Date: 2026-03-18

Reviewed artifacts:
- [cx-calculator-design.md](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md)
- [cx-calculator.html](/home/baguspermana7/rz-work/cx-calculator.html)
- [dc-commissioning-research.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-research.md)

Scope of this review:
- Critique the current draft as a commissioning and RFS product specification.
- Test whether it can become a repeatable playbook for new DC programs.
- Align it with public signals from major hyperscale and AI data center operators.
- Recommend a better target architecture for HTML/checklist/calculator/analytics.

## Executive Verdict

The current draft is strong as a concept note, but it is not yet strong enough to become a global-standard DC commissioning and RFS playbook.

The core problem is structural: the spec is currently optimized as a `calculator`, while the real requirement is a `commissioning + RFS playbook engine` with checklists, gates, evidence, progressive turnover, cost logic, schedule logic, and operator-specific archetypes.

My conclusion is:
- Keep the calculator.
- Do not let the calculator be the center of the product.
- Re-center the product around `playbook tree + gated checklist + RFS tracker + schedule + cost + evidence + analytics`.

## Scorecard

| Dimension | Score | Comment |
|---|---:|---|
| Strategic direction | 7/10 | Good ambition, correct target market, useful domain framing |
| Implementation maturity | 1/10 | Actual HTML is incomplete and not runnable end-to-end |
| Commissioning depth | 6/10 | Good L1-L5 detail, but too equipment-centric and not enough package/gate logic |
| RFS depth | 3/10 | RFS is implied, not modeled as a first-class framework |
| Hyperscale/AI relevance | 4/10 | Mentions high density and DLC, but not enough for AI factory reality |
| Public-source defensibility | 3/10 | Too many hard numbers are presented as facts without traceable public support |
| UX for nested work | 4/10 | Expand/collapse exists conceptually, but fixed-depth and weak for real delivery use |
| Reusability across project types | 4/10 | Lacks archetype templates and phased turnover logic |

## High-Severity Findings

### 1. The HTML implementation is incomplete and should not be treated as a working product

The actual HTML file ends inside the JavaScript engine block and does not contain a finished calculator runtime. See [cx-calculator.html:594](/home/baguspermana7/rz-work/cx-calculator.html#L594).

Why this matters:
- The current artifact is a UI shell, not a functioning baseline.
- Any review that ignores the implementation gap will overestimate readiness.
- This is a P0 blocker before discussing polish or advanced analytics.

### 2. The product is mis-scoped as a calculator instead of a commissioning + RFS system

The design principles explicitly center a single self-contained HTML calculator and claim that accuracy comes from standards alone. See [cx-calculator-design.md:41](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md#L41) and [cx-calculator-design.md:45](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md#L45).

That is too narrow for real project delivery.

A DC delivery team does not only need:
- estimated cost
- estimated duration
- a nice Gantt

It also needs:
- gate definitions
- entry and exit criteria
- prerequisites
- evidence requirements
- scenario libraries
- progressive turnover logic
- customer-facing RFS definitions
- asset/system/package traceability
- exception and retest control

Without those, the tool is interesting but not operationally authoritative.

### 3. The draft stops at L1-L5, but a real RFS-grade playbook must include L0 and L6

Your Cx draft begins from L1 and ends at L5. The schedule hierarchy is phase-centric and starts with Factory Witness Testing. See [cx-calculator-design.md:2998](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md#L2998).

But your own RFS research already acknowledges that best practice extends to:
- L0 design and planning
- L6 closeout, turnover, and handover

See [dc-commissioning-research.md:22](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-research.md#L22) through [dc-commissioning-research.md:133](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-research.md#L133).

Why this matters:
- RFS success is often determined before L1 starts.
- Handover quality is often what customers remember, not only FAT or IST.
- Missing L0 means no OPR/BOD/SOO/Cause-and-Effect governance.
- Missing L6 means no formal turnover pack, training closure, residual risk register, or customer RFS sign-off.

### 4. The standards section overstates certainty and misattributes the phase model

The draft says `ASHRAE Guideline 0` is the master framework for the `L1-L5 structure`. See [cx-calculator-design.md:5192](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md#L5192).

That framing is too loose.

Public ASHRAE material describes Guideline 0 as the commissioning process for the full project lifecycle, from predesign through occupancy and operations, not as a fixed L1-L5 data center tagging scheme. Source: ASHRAE titles, purposes and scopes:
- https://www.ashrae.org/technical-resources/bookstore/guideline-0-2019-the-commissioning-process
- https://www.ashrae.org/technical-resources/standards-and-guidelines/titles-purposes-and-scopes

Implication:
- Keep ASHRAE Guideline 0 as the lifecycle/process backbone.
- Treat L1-L5 as project-delivery levels, not as if ASHRAE itself defines that exact hierarchy.

### 5. The schedule engine is too serial for real hyperscale or phased campus delivery

The current dependency logic is mostly sequential:
- L2 after L1
- L3 after L2
- L4 after L3
- L5 after L4

See [cx-calculator-design.md:3443](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md#L3443).

This is not how large DC programs are actually delivered at speed.

Real programs overlap:
- FAT with site prep and install
- block energization with remaining construction
- building-by-building turnover inside a larger campus
- white-space readiness before total campus completion
- package-specific IST while other systems are still progressing elsewhere

This is especially important for:
- wholesale colo
- build-to-suit
- phased hyperscale campuses
- AI factory clusters with early-live blocks

### 6. The cost model is too dependent on IT load and static multipliers

The base cost model hard-codes `$ / kW` by discipline and then multiplies by IT load and a stack of adjustment factors. See [cx-calculator-design.md:2768](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md#L2768) through [cx-calculator-design.md:2958](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md#L2958).

This is acceptable for rough educational estimates, but not for a playbook that claims to be highly accurate across:
- colo
- hyperscale
- AI/HPC
- modular
- retrofit
- recommissioning

Key issues:
- `IT load` is not enough to represent commissioning effort.
- Fixed `% of CAPEX` based on `inputs.itLoad * 8500` is not defensible across current AI factory projects.
- Campus-scale substation, utility interface, fuel strategy, liquid cooling topology, building count, and delivery phasing can dominate cost and schedule more than rack load alone.
- Some multipliers are presented with false precision.

### 7. The benchmark and case-study sections are not traceable enough

The draft uses many entries such as:
- `Industry survey (anonymized)`
- `Industry conference presentation`
- `BSRIA member project data`

See [cx-calculator-design.md:5282](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md#L5282) through [cx-calculator-design.md:5438](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md#L5438).

This creates a credibility problem.

Recommendation:
- Separate `publicly sourced benchmark data` from `internal heuristic assumptions`.
- Add a `source confidence` field for every benchmark:
  - `official_public`
  - `primary_public_non_official`
  - `secondary_public`
  - `internal_estimate`
  - `expert_assumption`
- Only present exact numbers as exact when the public source supports them.

### 8. The tree model is fixed at five levels, but the real requirement is recursive

The current Gantt/checklist hierarchy is fixed to:
- phase
- discipline
- system
- activity
- sub-task

See [cx-calculator-design.md:2996](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-calculator-design.md#L2996).

This is too rigid for real-world data center delivery, where users often need deeper and different nesting such as:
- program
- campus
- block
- building
- floor
- hall
- system
- subsystem
- asset
- test package
- scenario
- step
- evidence

If you keep a hard five-level model, the app will always feel too shallow.

### 9. The mobile UX directly breaks your stated requirement for deepest expandable content

The actual HTML hides level-5 rows on small screens. See [cx-calculator.html:204](/home/baguspermana7/rz-work/cx-calculator.html#L204).

That conflicts with the requirement that every item can expand to sub-items and deeper sub-items.

Correct pattern:
- do not hide the deepest level
- switch mobile to a drawer or stacked-detail interaction
- keep full depth accessible through drill-down

### 10. Cloud-customer relevance is under-modeled

For cloud and hyperscale customers, `RFS` is not only a question of MEP completion.

Customer-facing readiness often also depends on:
- network fabric readiness
- MMR/carrier readiness
- control plane readiness
- security zoning and access control closure
- monitoring and alarming completeness
- staffing and runbook readiness
- training sign-off
- spares and OEM support readiness
- evidence pack acceptance
- defect burn-down thresholds

The current draft is strong on equipment and testing, but too weak on service-readiness logic.

## What the Product Should Become

The correct target is not `a commissioning calculator`.

The correct target is:

`A data-center commissioning and RFS playbook application with checklist, schedule, cost, evidence, and analytics layers driven by one shared recursive data model.`

## Required Core Modules

### 1. Program Setup

Must capture:
- archetype
- region
- owner model
- customer model
- project scale
- building count
- hall count
- topology
- cooling architecture
- certification target
- target RFS date
- phasing strategy

### 2. Archetype Templates

You need separate templates for at least:
- retail colocation
- wholesale colocation / build-to-suit
- hyperscale cloud region / availability zone
- AI factory / GPU cluster campus
- modular / prefab pod deployment
- brownfield expansion
- recommissioning
- repurposed building fast-track

### 3. Recursive Playbook Tree

Do not hard-code five levels.

Use a recursive schema similar to:

```json
{
  "id": "node_001",
  "parentId": null,
  "nodeType": "gate",
  "name": "Building B1 - Electrical Ready for Energization",
  "status": "not_started",
  "phase": "L2",
  "rfsType": "internal_rfs",
  "discipline": "electrical",
  "system": "MV switchgear",
  "assetScope": ["B1", "B1-SWG-A"],
  "owner": "GC",
  "reviewer": "CxA",
  "predecessors": ["node_0007", "node_0008"],
  "acceptanceCriteria": [
    "Installation complete",
    "Static tests passed",
    "Safety documents approved"
  ],
  "evidenceRequired": [
    "signed checklist",
    "test report",
    "photo",
    "as-built markup"
  ],
  "plannedStart": "2026-07-10",
  "plannedFinish": "2026-07-14",
  "actualStart": null,
  "actualFinish": null,
  "resourceHours": 56,
  "costDrivers": ["labor", "test_equipment"],
  "applicabilityRules": ["substationConfig != utility_fed"],
  "confidence": "official_public"
}
```

Every view should be powered by this same node model:
- tree
- checklist
- Gantt
- cost rollup
- resource loading
- evidence completeness
- risk heatmap

### 4. Checklist Engine

Every node should support:
- status
- hold point
- prerequisite status
- acceptance criteria
- required evidence
- assigned owner
- due date
- review date
- retest count
- comment thread
- waiver / concession flag

### 5. RFS Gate Engine

RFS must become a first-class model.

Recommended RFS gate families:
- `internal_rfs`
- `customer_rfs`
- `mechanical_rfs`
- `electrical_rfs`
- `network_rfs`
- `security_rfs`
- `operational_rfs`
- `commercial_rfs`
- `cluster_rfs`

### 6. Cost Engine

The cost engine should roll up from actual scope drivers, not only IT kW.

Minimum drivers:
- IT MW
- utility / substation scope
- building count
- hall count
- topology complexity
- cooling topology
- liquid loop type
- test package count
- OEM attendance days
- witness / certification days
- load bank size and duration
- regional blended labor rate
- shift/overtime pattern
- travel model
- retest allowance
- documentation burden

### 7. Schedule Engine

The Gantt engine should support:
- recursive nodes
- finish-to-start
- start-to-start
- finish-to-finish
- lag
- lead
- phased turnover
- building/block filtering
- critical path by phase
- critical path by RFS gate

### 8. Evidence and Handover Pack

A playbook-grade app should generate or track:
- FAT reports
- SAT reports
- startup sheets
- FPT reports
- IST scripts
- IST results
- punch-list register
- risk register
- residual defects register
- training sign-off
- as-built record
- systems manual
- final Cx report
- customer RFS pack

### 9. Analytics

The analytics layer should go beyond Monte Carlo.

Must-have analytics:
- gate readiness score
- evidence completeness score
- retest burden by discipline
- late prerequisite heatmap
- critical path slip risk
- open defects by RFS gate
- vendor readiness score
- subsystem pass/fail trend
- liquid cooling risk dashboard
- cluster bring-up readiness
- forecasted RFS confidence

## Recommended RFS Model by Project Type

| Project Type | Minimum RFS Stack |
|---|---|
| Retail colo | shell/core ready -> suite ready -> MMR/carrier ready -> customer SAT ready -> customer RFS |
| Wholesale colo / BTS | utility ready -> white-space ready -> customer fit-out ready -> integrated test ready -> tenant RFS |
| Hyperscale cloud | building energized -> AZ utilities ready -> control/network ready -> hall/rack ready -> service RFS |
| AI factory | power train ready -> liquid loop ready -> fabric ready -> cluster bring-up ready -> training/inference RFS |
| Modular / pod | factory release -> site integration ready -> pod energized -> inter-pod coordination ready -> RFS |
| Brownfield expansion | existing operations protected -> isolation complete -> new block ready -> integrated failover passed -> expansion RFS |

This table is partly an inference from public operator architecture patterns and standard commissioning practice. Public companies rarely disclose their internal commissioning playbooks line by line, so the right method is to infer gate structure from what they do publicly disclose about topology, phasing, and service launch.

## Public Benchmark Implications from Major Operators

### OpenAI + Oracle + Stargate

Publicly confirmed:
- OpenAI announced Stargate on 2025-01-21 as a new company intending to invest `$500 billion` over four years, with `$100 billion` to be deployed immediately and Texas as the initial site.
- OpenAI later said on 2025-07-22 that Stargate is already developing more than `5 GW` and targets over `2 million chips`.
- Oracle publicly describes the Abilene site as eight buildings, more than four million square feet, and up to `1.2 GW`, with AI workloads going live in less than a year after construction began.

Sources:
- https://openai.com/index/announcing-the-stargate-project/
- https://openai.com/index/building-openai/
- https://www.oracle.com/data-centers/abilene/

Implication for your app:
- You must support `campus-scale phased turnover`.
- Building-level RFS is more important than only total-campus completion.
- The model must handle multi-building energization, high-density liquid cooling, and very fast partial go-live.

### AWS

Publicly confirmed:
- AWS says its new data center electrical design reduces potential failure points by 20% and brings backup power closer to the rack.
- AWS says the new mechanical design supports both air and liquid cooling and can deliver up to six times more cooling per rack with lower energy use.
- Amazon announced Project Rainier for Anthropic as a massive Trainium2 compute cluster intended to exceed one million chips.

Sources:
- https://press.aboutamazon.com/2024/12/aws-announces-new-data-center-components-to-support-ai-innovation-and-further-improve-energy-efficiency
- https://www.aboutamazon.com/news/aws/aws-project-rainier-ai-trainium-chips-compute-cluster
- https://www.aboutamazon.com/news/aws/project-rainier-ai-anthropic

Implication for your app:
- Add `mixed air/liquid cooling` logic, not only mutually exclusive cooling modes.
- Add `rack-proximate power resilience` test scenarios.
- Add `AI cluster ramp` archetypes where facility readiness and compute-ramp readiness overlap.

### Google

Publicly confirmed:
- Google states that its infrastructure is enabling `1 MW IT racks`.
- Google describes `+-400 VDC` rack architecture, sidecar power racks, redundant CDUs, and UPS-backed coolant distribution in support of future AI workloads.
- Google reports its TPU fleet has surpassed 2,000 pods with approximately `99.999%` uptime over eight years.

Sources:
- https://cloud.google.com/blog/topics/systems/enabling-1-mw-it-racks-and-liquid-cooling-at-ocp-emea-summit/
- https://cloud.google.com/blog/products/infrastructure/understanding-cloud-datacenter-architecture-availability-zones

Implication for your app:
- `AI/HPC` is not just a rack-density dropdown.
- You need data fields for CDU redundancy, DC bus architecture, sidecar power systems, liquid loop zoning, and rack-level thermal acceptance.

### Microsoft

Publicly confirmed:
- Microsoft says its future Saudi Arabia region will launch with three availability zones, each with independent power, cooling, and networking.
- Microsoft describes the Azure AI Superfactory as an AI datacenter architecture operating like a single flat computer with purpose-built placement for compute, storage, cooling, and AI WAN.
- Microsoft also describes supporting up to `140 kW` per rack in the facility profile it published.

Sources:
- https://news.microsoft.com/source/emea/2026/02/microsoft-confirms-saudi-arabia-datacenter-region-available-for-customers-to-run-cloud-workloads-from-q4-2026/
- https://blogs.microsoft.com/blog/2025/11/12/infinite-scale-the-architecture-behind-the-azure-ai-superfactory/
- https://blogs.microsoft.com/blog/2025/09/18/inside-the-worlds-most-powerful-ai-datacenter/

Implication for your app:
- `Availability zone` needs to be a modeled object, not just a note.
- The product must treat network/fabric/storage integration as first-class RFS items.
- AI-factory readiness should include cluster topology, not only facility systems.

### xAI

Publicly confirmed:
- xAI states that Colossus 1 with 100,000 GPUs became the largest AI supercomputer and that Colossus 2 now has 200,000 GPUs training `24/7`.
- xAI states Colossus 2 was built in `122 days` and that the longer-term goal is a million GPUs at the Memphis site.
- Memphis utility communications also confirm unusually high public attention on power delivery and permitting around the project.

Sources:
- https://x.ai/colossus
- https://www.mlgw.com/xai

Implication for your app:
- You need a `fast-track repurposed building` archetype.
- The playbook must support temporary/expedited infrastructure, compressed FAT/SAT/IST windows, and exceptional schedule-risk controls.

### Anthropic

Publicly confirmed:
- Anthropic publicly positions AWS as a primary training partner, with Project Rainier and Trainium2 deployment at very large scale.
- Anthropic also publicly said on 2025-10-23 that it is expanding use of Google Cloud TPUs and services, with plans for up to `one million TPUs` and more than `1 GW` of capacity online in 2026.

Sources:
- https://www.aboutamazon.com/news/aws/project-rainier-ai-anthropic
- https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services

Implication for your app:
- Anthropic should not be modeled as a classic self-built owner-operator campus unless you have private information.
- Publicly, the safer archetype is `partner-hosted hyperscale AI capacity`.
- Your playbook should therefore support `service readiness on hosted infrastructure`, not only owner-built facility readiness.

## What This Means for the Draft

Your current draft handles:
- equipment categories
- L1-L5 activity structure
- simplified cost logic
- simplified Gantt logic

It does not yet adequately handle:
- progressive turnover
- gate readiness
- service readiness
- customer acceptance logic
- hosted AI capacity models
- availability zones
- cluster/fabric readiness
- evidence completeness
- handover pack governance

## Specific Changes Needed in the Draft

### Replace "calculator-first" with "playbook-first"

Current state:
- hero, KPIs, charts, and cost are the center

Required state:
- tree and gates are the center
- cost and charts are downstream views

### Add L0 and L6 explicitly

L0 should include:
- OPR
- BOD
- SOO
- Cause-and-Effect
- points list
- testability review
- energization strategy
- RFS definition workshop

L6 should include:
- final defect review
- residual risk acceptance
- training closure
- spare parts confirmation
- systems manual
- customer RFS pack
- formal turnover sign-off

### Replace fixed-depth Gantt with a recursive tree-grid

Recommended UI:
- left: recursive tree with filters
- center: timeline / Gantt
- right: node inspector with prerequisites, evidence, owner, comments, and linked documents

### Split schedule views

Use at least four views:
- phase view
- building/block view
- system view
- RFS-gate view

### Split cost views

Use at least six views:
- by phase
- by discipline
- by building
- by package
- by vendor/OEM
- by RFS gate

### Add a source registry panel

Every benchmark, assumption, or rule should have:
- source title
- source type
- publication date
- jurisdiction
- confidence level
- note on whether it is public fact or internal estimate

## UI / Information Architecture Recommendation

Top-level tabs should be:
- `Playbook`
- `Checklist`
- `RFS Gates`
- `Schedule`
- `Cost`
- `Analytics`
- `Evidence`
- `Sources`

Inside `Playbook`, users should be able to expand indefinitely.

Recommended filter chips:
- region
- archetype
- phase
- building
- hall
- discipline
- system
- gate
- owner
- status
- critical path
- customer-facing

## Data Quality and Governance Rules

To make the app genuinely authoritative, enforce these rules:
- No hard number enters the product without source attribution or explicit internal-estimate labeling.
- No gate can be marked complete without required evidence.
- No RFS gate can close while prerequisite critical defects remain open.
- Every scenario must contain expected result and rollback condition.
- Every archetype template must declare what is in scope and what is intentionally excluded.

## Recommended Build Strategy

Even if the deployed artifact remains a single HTML file, do not author it as one giant hand-maintained HTML document.

Use this workflow instead:
- author source data in versioned JSON or YAML
- author UI logic in modular JavaScript
- compile/build into a single distributable HTML artifact only at release time

This preserves the `single-file` deployment goal without destroying maintainability.

## Priority Roadmap

### P0

- Finish the broken HTML implementation.
- Introduce a shared recursive node schema.
- Add L0 and L6.
- Add RFS gate definitions.
- Add source-confidence metadata.

### P1

- Replace the fixed 5-level renderer with recursive tree-grid logic.
- Rebuild schedule logic around phased turnover and building/block concurrency.
- Rebuild cost logic around scope drivers, not only IT kW.
- Add archetype templates for colo, hyperscale, AI factory, modular, brownfield.

### P2

- Add evidence tracking and handover packs.
- Add RFS confidence scoring.
- Add vendor readiness and retest analytics.
- Add cluster/fabric readiness for AI-oriented projects.

## Final Bottom Line

If you keep the current direction, you can build a visually impressive `commissioning calculator`.

If you make the changes above, you can build something much more valuable:

`a commissioning + RFS playbook system that is credible for colo, hyperscale, and AI factory delivery programs.`

That is the difference between:
- a content tool
- and a reusable execution tool

## Source Appendix

Primary public sources used for this review:
- ASHRAE Guideline 0 overview: https://www.ashrae.org/technical-resources/bookstore/guideline-0-2019-the-commissioning-process
- ASHRAE titles, purposes and scopes: https://www.ashrae.org/technical-resources/standards-and-guidelines/titles-purposes-and-scopes
- NETA ECS overview: https://netaworldjournal.org/2025/06/engineered-commissioning-specifications/
- Uptime tier certification preparation: https://journal.uptimeinstitute.com/tiercertificationpreparation/
- OpenAI Stargate announcement: https://openai.com/index/announcing-the-stargate-project/
- OpenAI infrastructure update: https://openai.com/index/building-openai/
- Oracle Abilene site: https://www.oracle.com/data-centers/abilene/
- AWS new data center components: https://press.aboutamazon.com/2024/12/aws-announces-new-data-center-components-to-support-ai-innovation-and-further-improve-energy-efficiency
- AWS Project Rainier: https://www.aboutamazon.com/news/aws/aws-project-rainier-ai-trainium-chips-compute-cluster
- Amazon on Anthropic and Rainier: https://www.aboutamazon.com/news/aws/project-rainier-ai-anthropic
- Google liquid cooling and 1 MW racks: https://cloud.google.com/blog/topics/systems/enabling-1-mw-it-racks-and-liquid-cooling-at-ocp-emea-summit/
- Google cloud datacenter architecture and availability zones: https://cloud.google.com/blog/products/infrastructure/understanding-cloud-datacenter-architecture-availability-zones
- Microsoft Saudi Arabia region with three availability zones: https://news.microsoft.com/source/emea/2026/02/microsoft-confirms-saudi-arabia-datacenter-region-available-for-customers-to-run-cloud-workloads-from-q4-2026/
- Microsoft AI Superfactory architecture: https://blogs.microsoft.com/blog/2025/11/12/infinite-scale-the-architecture-behind-the-azure-ai-superfactory/
- Microsoft AI datacenter facility profile: https://blogs.microsoft.com/blog/2025/09/18/inside-the-worlds-most-powerful-ai-datacenter/
- xAI Colossus: https://x.ai/colossus
- Memphis utility page on xAI: https://www.mlgw.com/xai
- Anthropic expanding use of Google Cloud TPUs and services: https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services
