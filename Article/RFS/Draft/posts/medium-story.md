# Why Data Center RFS Needs a Gate Board, Not a Spreadsheet

Most data center commissioning teams track Ready-for-Service readiness in spreadsheets. Rows of systems, color-coded status columns, percentage-complete formulas. It works when the project is on track. It fails spectacularly when it is not.

The problem is structural. Commissioning readiness is gate-driven, not percentage-driven. You cannot be "87% ready for RFS." You are either blocked at a gate, or you are not. And the blockers cascade.

## The cascade problem

Consider a typical commissioning sequence. Gate G3 (Startup and Individual Testing) covers component-level verification: energizing the MV switchgear, soaking the transformer for 72 hours, commissioning the UPS, starting the generators, bringing up the chillers.

Gate G4 (Functional Performance Tests) tests system-level behavior: simulating a utility loss to verify generator transfer, testing UPS bypass under load, running chiller redundancy failover.

You cannot run a utility loss simulation (G4) until every power component is individually verified (G3). If a critical defect on the UPS remains open at G3, it blocks G4. Which blocks G5 (Integrated Systems Tests). Which blocks G6 (Operational Readiness). Which blocks G7 (Turnover and customer handover).

One unresolved defect. Four gates delayed. Three to six weeks of schedule drag.

Spreadsheets show you a percentage. What you need is blocker visibility.

## Building the gate model

After working with several commissioning programs, I built the RFS Readiness Workbench -- a browser-based tool that models commissioning as an 8-gate progression system (G0 through G7) with hard blocker logic.

The gate engine evaluates each delivery unit at each gate using a specific sequence:

First, hard blockers. Open critical defects, missing mandatory evidence, unmet prior gate prerequisites, and unconfirmed hard overlay requirements all prevent gate progression. Period. No percentage can override a hard blocker.

Second, weighted completion. Each gate has requirements with assigned weights. Readiness percentage is the ratio of completed weight to applicable weight. But it is capped: 95% maximum if mandatory evidence is still missing, 99% maximum if sign-offs are pending. You can never reach 100% without both evidence and approvals.

Third, confidence scoring. This is the most useful metric. A 7-term penalty formula starts at 100% and deducts:

- 18 points per open critical defect
- 8 points per open major defect
- 7 points per missing mandatory evidence item
- 6 points per missing approval
- 5 points per pending retest
- Variable overdue aging penalty
- Variable unconfirmed overlay penalty

The result, clamped between 5% and 100%, tells you how trustworthy the readiness number actually is. A gate showing 90% readiness with 35% confidence should alarm you far more than a gate showing 60% readiness with 85% confidence.

## Source confidence matters

Hyperscale customer overlays are one of the biggest sources of RFS delay. A requirement tagged as "customer-specific" can block turnover -- but the confidence you should place in that requirement depends on its source.

The workbench uses a 4-tier source classification:

- Source A (Contract): Explicit contractual obligation. Hard blocker eligible.
- Source B (Industry Standard): Published standard (IEEE, NFPA, ASHRAE). Hard blocker eligible.
- Source C (Benchmark): Derived from industry benchmarks or competitor analysis. Cannot auto-block gates. Displays a "Benchmark only" badge.
- Source D (Internal): Internal best practice or assumption. Cannot auto-block gates.

This distinction matters more than most teams realize. Over-engineering based on inferred benchmarks (Source C) is almost as dangerous as under-engineering based on contractual requirements (Source A). Both waste time. Only one creates legal exposure.

## Drag-based forecasting

The forecast engine does not estimate a single date. It decomposes delay into 7 drag components per delivery unit:

1. Base days (calibrated by facility archetype)
2. Blocker drag (critical defects x3 days, major x1 day)
3. Evidence drag (missing mandatory evidence per next gate)
4. Sign-off drag (missing role approvals)
5. Retest drag (pending retests from closed defects)
6. Witness drag (customer witness test packages awaiting scheduling)
7. Uncertainty drag (unconfirmed Source C/D overlays)

Project RFS is the critical path: the worst-performing delivery unit determines the date. This is intentional. In phased data center delivery, the campus cannot go live until the last data hall clears G7.

## Six archetypes, not custom presets

Rather than hardcoding hyperscaler-specific presets (which become stale), the workbench uses 6 facility archetypes:

1. Enterprise Owner-Operator (baseline 1.0x)
2. Retail Colocation (1.15x -- multi-tenant complexity)
3. Wholesale for Hyperscaler (1.2x -- overlay-heavy, witness-intensive)
4. Hyperscale Self-Build (1.0x -- highest rigor but own team)
5. AI Fast-Track Retrofit (0.65x -- compressed timeline, higher risk tolerance)
6. Regulated / Sovereign (1.4x -- maximum compliance, extended approval cycles)

The archetype multiplier calibrates base gate durations. It does not change the requirements -- those remain the same 99 items across all types.

## Client-side, no backend

Everything runs in the browser. localStorage with debounced writes, JSON export/import, no backend dependency. Your data never leaves your machine.

This was a deliberate choice. Commissioning data often includes commercially sensitive information (customer requirements, defect details, schedule timelines). A client-side tool eliminates the "where does my data go" question entirely.

The workbench is free to use at resistancezero.com/rfs-readiness-workbench.html

If you work in data center commissioning, construction, or critical infrastructure operations, I would appreciate feedback on the gate model and requirement taxonomy. This is an engineering tool built for the field, and field feedback makes it better.
