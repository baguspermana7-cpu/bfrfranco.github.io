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

## 4b · Retrospective FMEA (v3.13.0) — every dossier carries one

Owner (2026-10-09): *"per incident tambahkan detail comprehensive FMEA analysis, ada visual dan detail
evidence atau supportive data."* Implemented in `tools/incidents_fmea.py`, rendered after
*Contributing factors* on every incident page, gated by `tools/test-incidents-fmea.py --strict`.

**What it is.** For each way the system could fail: item and function, failure mode, effect, cause,
the prevention and detection controls that existed at the time, Severity / Occurrence / Detection on
1–10 scales adapted from IEC 60812:2018 and the AIAG-VDA handbook, a written rationale for EVERY
score, the published corrective action, and the score that action earns. RPN = S × O × D is computed
by the builder, never typed. Priority is High when S ≥ 9 with O ≥ 4 or D ≥ 7, or RPN ≥ 300 —
severity overrides the product, because 9 × 2 × 9 hides a region-wide outage nothing would catch.

**Writer rules (embed verbatim in any FMEA authoring prompt):**
1. Nothing in the FMEA may be a fact the dossier does not hold — free text included (effect, cause,
   controls, rationale), not only the evidence list. No outside knowledge, no new research.
2. ≥ 4 modes, ≥ 2 evidence pointers each. A pointer names a dossier field — `soe|metric|coe|
   improvement|ref|factor` by 0-based index, or `rootCause|tech` by quote — and any quote must be a
   VERBATIM substring of the field it names. This is the anti-fabrication check, and it is machine-run.
3. A revised score only against an action that points at a COE or improvement item whose status the
   OPERATOR stated as done or committed. Analyst recommendations and undisclosed statuses are listed
   as actions with NO revised score. No action at all → `actions: []` and the mode is shown as
   **residual risk** — a legitimate finding, never softened.
4. Committed-but-unconfirmed actions say so in `revisedRationale`: the reduction is a claim about the
   action, not a confirmed outcome.
5. Press-sourced or disputed causes are stated as such in the scope and the affected rationales.
6. Calibrate: not every mode is S9; S10 is reserved for hazard to people or loss of a facility /
   several regions; one event is not counted at full weight in several modes.
7. Physical incidents cover the physical chain where the dossier supports it — initiating equipment,
   detection, protection/suppression, isolation/transfer, recovery.

**Exemplars.** Full official post-mortem: `aws-s3-us-east-1-2017`. Minimal disclosure, unconfirmed
cause, every action undisclosed so every mode residual: `alibaba-cloud-global-2023`.

**Visuals and their rules.**
- RPN bars are HTML rows, not an SVG: the first version was an SVG on a 0–1000 axis, half empty
  (worst RPN 504) and scaled with the column until labels rendered at 7–8 px — unreadable at 390 px.
- The severity × occurrence matrix draws one marker per occupied cell carrying every ID in it, and
  places labels by SEARCH (above → below → right → left, first slot clear of every marker and placed
  label). The first rule — "above, unless the left neighbour took it" — passed the pilot and failed the
  third dossier it met (AWS EBS 2011, a vertical collision). Before-and-after lives in the bars only;
  movement lines on the matrix read as a shape, not as movement.
- Summary is a `.metabar` line, never a four-up stat strip (the hero-metric template rejected in
  v3.12.3).

**Gates.** `python3 tools/test-incidents-fmea.py --strict [--require-all]` — schema, ranges,
rationale per score, every pointer resolves, every quote verbatim, revised only against an action,
and the rendered page carries the section with one row per mode (an invalid block is omitted by the
builder AND reported, never a quiet gap). `tools/incidents-visual-qa.mjs` screenshots the bars,
matrix and worksheet and fails on any matrix label overlapping another label or a marker that is not
its own — ownership by DOM identity, not by position (the first version exempted any marker sharing a
label's x, so a label stacked on a neighbour passed).

**Simulator (v3.13.1, `js/rz-fmea-sim.js`).** An upgrade over the static figures, which stand
alone without JS. Everything it shows is computed from the dossier's own scores (`#fmea-sim-data`,
emitted by `incidents_fmea.sim_data`); it types no fact of its own.
- *Replay* steps through the SOE and lights each mode at the first SOE entry its evidence cites. A
  mode citing no SOE entry is labelled **latent** and lights at the last step — never placed at a
  guessed time.
- *Scenarios*: As found · Published actions · two what-ifs labelled **Hypothetical** (D capped at 6,
  detected at onset; O capped at 2, cause guarded by design). The what-ifs show which lever carries
  the risk; they are not claims about the operator.
- *What-if* on one mode: S/O/D sliders with the rubric line for the dragged value and the analyst's
  written rationale at the scored value. The matrix draws ONE dashed path for the selected mode only —
  the v3.13.0 rule against movement lines stands for the whole set.
- Readout is a `.metabar` line, not a stat strip. The facts list (caught only after impact, which
  lever each action cuts, residual count) is a hairline fact list.
- Motion: bar length is `transform: scaleX` with a 200 ms transition, dimming is opacity 150 ms;
  reduced motion keeps opacity only. The inspector is built once per selection and updated in place:
  rebuilding it on `input` replaces the slider under the pointer and ends the drag.
- Gate: `node tools/test-fmea-sim.mjs --strict` — also cross-checks the simulator's totals against
  the builder's metabar, so the JS and Python scoring cannot drift apart unseen.

**Library-wide view (v3.13.2, `incidents_fmea.corpus_section`).** Summed from the per-incident
FMEAs, never re-scored. Detection histogram rows open to their modes and link to `#FM-nn` on the
incident page (worksheet rows carry `id`). A score between rubric anchors is labelled "Between x and
y" — borrowing the lower anchor's words mislabelled D 7 as "detected at onset". The category table
drops Incidents and Median RPN below 640 px rather than scrolling sideways.

**After two reviews (v3.13.3).** Criticality zones are hairline boundaries, never a tinted wash.
No coloured left stripe anywhere on an incident page (`.chip`, `.ca-block`, `.mag-trace` were
the last). SOE timeline labels wrap by word into two lines of ≤ 13 characters inside 46 px end
margins; `incidents-visual-qa.mjs` fails any overprint or edge cut. Run it over ALL pages
(`node tools/incidents-visual-qa.mjs <out> $(slugs)`) — the default is a five-page sample, which
is how 28 overprinting timelines went unseen.

**The generator was stale, and fixing it was a precondition.** Sweeps since v1.134.20 had edited
the 44 generated pages directly (timeline 1:1 fix, `.vz-tl-ph` 10 px, mobile `.chip` wrap, hub title
attributes, content-hash cache tokens) while `tools/build-incidents.py` was last changed 2026-08-02.
Any rebuild reverted all of it. Those fixes now live in the builder; tokens are read from what the
site already serves (`_asset_token`). **Never hand-edit an `incident-*.html` page again** — change
the builder or the dossier, then rebuild.

## 5 · Model + process

Research/QA runs on the **top Opus tier (Opus-5 class)**, multi-agent: crawlers (official · fire-authority/regulator · engineering/technical · facility-forensic) → assembler (this §2 prompt) → adversarial reviewer (this §3 checklist), minimum iterations until the depth floor is met with zero unverified claims. Batched (≤5 incidents/run) to respect session limits; ingest via `tools/_ingest_rca.py`; regenerate; run the §4 visual-QA gate; then the standard gate suite before ship.

See [DC_INCIDENTS_STANDARD.md](DC_INCIDENTS_STANDARD.md), [ARTICLE_DATAVIZ_STANDARD.md](ARTICLE_DATAVIZ_STANDARD.md), [EXPLAIN_ENGINE_STANDARD.md](EXPLAIN_ENGINE_STANDARD.md).
