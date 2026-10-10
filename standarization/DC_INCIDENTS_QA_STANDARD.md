# DC Incidents QA Standard — Permanent Writer + Reviewer Contract

> This is the **canonical, permanent** instruction set for producing and reviewing every DC-incident dossier (`data/incidents/<slug>.json`). The multi-agent research/QA Workflow embeds these prompts verbatim. Any dossier that does not meet the depth floor and passes the reviewer checklist is NOT shippable. Companion: [DC_INCIDENTS_STANDARD.md](DC_INCIDENTS_STANDARD.md).

## Why this exists

Text/CSS review alone missed rendered corruption (clipped radar labels, truncated cascade boxes, colliding scatter labels) and content was too generic (no specific ignition source, no maintenance-failure root cause, no forensic sequence). This standard raises the depth floor and makes review catch **both** content thinness **and** rendered/output defects, permanently.

---

## 1 · Depth floor — the enriched dossier schema

Every field below is mandatory unless marked optional. "Sourced" = carries a `source`/quote traceable to `references[]`. Disclose **every** sourced fact; where a fact is genuinely unknown or disputed, state that explicitly — never paper over a gap with generic filler.

- **rootCause** (multi-paragraph) — the *specific* proximate cause: **ignition source / equipment make+model+age / the exact physical-technical failure mechanism**, and the **latent/organisational root** (design flaw, redundancy gap, **and any maintenance/inspection/testing lapse** where evidenced). Name components, chemistries, protocols. Never stop at "a fire broke out" / "a config change" — say *what* ignited/failed, *why*, and *what should have caught it*.
- **sequenceOfEvents** (phased, **minItems 14**) — the *physical + technical* timeline, not just service impact. For facility incidents it MUST cover, where the record allows: **detection** (which system sensed it — VESDA/aspirating smoke/thermal/spot smoke — and when), **alarm/notification**, **operator/NOC response**, **fire-suppression system** (type: gas/clean-agent/pre-action/sprinkler/none; did it activate; did it work; why not), **evacuation** (personnel count, when), **emergency-services** (call → arrival → firefighting actions), **power de-energisation/isolation**, **containment/spread**, **restoration**. Phases: `TRIGGER · DETECTION · MITIGATION · IMPACT · CASCADE · RECOVERY · RESTORED`. Each event carries a `source`.
- **contributingFactors** (≥4) — distinct latent factors; **name maintenance/inspection/testing gaps explicitly** when sourced (e.g. "batteries past rated service life", "suppression not tested to schedule").
- **coe** (correction of errors) — action · owner · status; keep the disclosed/undisclosed honesty.
- **improvements** — grouped and specific: **safety** (suppression upgrade, compartmentation, detection, battery chemistry/BMS) · **maintenance regime** (PM cadence, inspection, load-testing) · **design** (redundancy, isolation) · **process/org**.
- **lessonsLearnt** (≥4) — engineering-transferable, not platitudes.
- **metrics** (**minItems 6**) — quantified + sourced: temperatures, detection→suppression→de-energisation times, personnel evacuated, equipment lost (racks/MW), water/agent flow, capacity lost, financial, users. Numbers only if sourced.
- **technicalDeepDive** — engineering-level mechanism, grounded in the official/forensic record.
- **comprehensiveAnalysis** (≥4 `{heading,body}`) — deeper themed analysis (e.g. detection-to-suppression chain, redundancy topology, human factors, regulatory aftermath).
- **magnitude{}** — 4 sub-scores 0–10 + a sourced `note`.
- **references[]** — `title,url,type,quote,accessed`; official types `{official-postmortem,regulatory,vendor-status}`. Non-official ref needs a quote. `sourcing.officialPostmortem` true only if ≥1 official ref backs it.

## 2 · WRITER PROMPT (permanent — embed verbatim in the Workflow)

> You are an incident-forensics writer producing a root-gated engineering dossier. Depth and disclosure are the product. Reconstruct the incident from the crawled sources **faithfully and completely** — assemble fragmented/official material accurately, disclose every sourced fact, and where the record is silent or disputed say so plainly. Never fill a gap with generic prose.
>
> Produce the enriched schema (§1). Specifically:
> - **Root cause**: name the *specific* ignition source / equipment (make, model, age, chemistry) / the exact failure mechanism, AND the latent root — design, redundancy, and **maintenance/inspection/testing** lapses where evidenced. "A fire started" / "a bad config" is a FAIL; say what ignited or failed, why, and what safeguard should have caught it.
> - **Sequence of events (≥14, phased)**: give the *physical* forensics — detection system + time, alarms, operator response, **fire suppression** (type, activation, effectiveness, failure), **evacuation**, **emergency-services** response, power **de-energisation**, containment, restoration — not just the service-impact updates. Every event sourced.
> - **Improvements**: separate **safety enhancements** and **maintenance-regime** fixes from design/process.
> - **Metrics (≥6)**: quantify (temperatures, response times, personnel, equipment lost, flow, capacity, $) — sourced only.
> - Keep short attributed quotes only (copyright); the narrative is original and substantially shorter than sources.
> - **Viz-safe labels**: any string that will render inside a chart/diagram box (operator/node/axis label) MUST be a clean short form (≤18 chars, no parentheticals) provided in the dedicated short-label field — never rely on a long raw string that will be truncated. Full text goes in the tooltip/`title` field.
> - Honesty: no fabricated cause/number; screening/uncertainty flagged; disputed attribution labelled.

## 3 · REVIEWER CHECKLIST (permanent — adversarial, two-dimensional)

A dossier ships only if the reviewer confirms ALL of both dimensions.

**A · Content correctness (adversarial)**
- [ ] Root cause is **specific**, not generic: ignition source/equipment/mechanism named; latent root + any maintenance/inspection lapse addressed.
- [ ] SOE ≥14, phased, and covers the physical forensics (detection · suppression · evacuation · emergency response · de-energisation) for facility incidents.
- [ ] Every material claim traces to a `references[]` source; every non-official ref has a quote; `officialPostmortem` flag backed by an official-type ref.
- [ ] Improvements include **safety** and **maintenance-regime** items; contributing factors name maintenance/inspection gaps where evidenced.
- [ ] Metrics ≥6, quantified + sourced. Nothing fabricated; gaps/disputes disclosed, not smoothed over.
- [ ] No unsupported claim survives (strike or downgrade each).

**B · Output/render correctness (visual QA — inspect the rendered screenshots, not just the HTML)**
- [ ] No **truncated/clipped** text in any chart, diagram box, or axis label (radar axes, cascade nodes, bars).
- [ ] No **colliding/overlapping** labels on scatter plots or the geo map.
- [ ] No **corrupt/placeholder/orphaned** text (e.g. ".ast 6", "Finan", "impacted ten").
- [ ] Every viz element has a hover `<title>`/tooltip; cascade downstream nodes carry a **definition** + **impact-degree**.
- [ ] No AI-slop: no full-round pills, no neon/glow, no uniform undifferentiated bars, no decorative emoji; square-ish radii, hairline borders, mono tabular numerics, editorial register.
- [ ] Reading column + justified body; share buttons present; scores carry a magnitude trace.

## 4 · Mandatory visual-QA gate

Before any ship touching a dossier or the generator's viz: run `tools/incidents-visual-qa.mjs` — it renders the hub + a sample of incident pages headless (root-unblurred), screenshots each visualization region, and a review agent (or the human) checks them against §3B. **A ship is blocked on any §3B failure.** This gate is why text-only review is insufficient and is not optional.

## 5 · Model + process

Research/QA runs on the **top Opus tier (Opus-5 class)**, multi-agent: crawlers (official · fire-authority/regulator · engineering/technical · facility-forensic) → assembler (this §2 prompt) → adversarial reviewer (this §3 checklist), minimum iterations until the depth floor is met with zero unverified claims. Batched (≤5 incidents/run) to respect session limits; ingest via `tools/_ingest_rca.py`; regenerate; run the §4 visual-QA gate; then the standard gate suite before ship.

See [DC_INCIDENTS_STANDARD.md](DC_INCIDENTS_STANDARD.md), [ARTICLE_DATAVIZ_STANDARD.md](ARTICLE_DATAVIZ_STANDARD.md), [EXPLAIN_ENGINE_STANDARD.md](EXPLAIN_ENGINE_STANDARD.md).
