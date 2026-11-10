# Product Innovation Assessment, November 2026

Scope: resistancezero.com static site (root HTML pages, `manual/`, `id/`, `dcmoc/` export), engines in `js/`, Supabase persistence. Written 2026-11-10 from repository measurements on `main` at v3.35.9 (4cccad1d5). No user research, analytics or market data were available; nothing below claims user demand. Where a fact was not measured it is marked UNVERIFIED.

This file is new. It replaces nothing. It recommends; it does not authorise implementation. Items marked *needs approval* are major features.

## Deliverable 1: Product maturity assessment

### What exists, measured

| Area | Evidence (command-level) | Status |
|---|---|---|
| Site size | 181 root HTML pages; 31 `article-*`, 4 `pillar-*`, 7 `pln-*`, 3 `FF-*`; 42 `manual/*.html`; 3 `id/*` | Implemented |
| Calculators | 11 distinct `data-rz-calc` values (capex, carbon, cx, opex, pue, rfs, roi, spares, tco, tia, tier) | Implemented |
| Engines | `rz-engine.js` 1.1 MB with 30 models; separate dcai, conv, cdu, fire, datahall, line-model engines | Implemented |
| Traceability | Basis drawer on 10 pages (cockpits); parameter registries for DC AI and Conventional with strict coverage gates | Implemented on cockpits, missing on calculators |
| Persistence | Supabase tables saved_scenarios, dcmoc_projects, profiles, app_state, audit_log, educator_allowlist, feature_overrides, newsletter_subscribers; `rz-scenario.js` on 9 pages | Partial: per-calculator only |
| Cross-calculator flow | `openInCalc` covers 5 calculators, called only from account.html; tco reads only `models.opex.powerCostAnnual`, roi only `models.roi.irr/npv` | Missing |
| Live data | Only fetch targets: `ipapi.co/json`, `data/cx/demo-records.json`; no WebSocket / EventSource / MQTT | Missing by design |
| Cockpits | 6 pages declare `data-rz-data-mode="simulated"` (chiller-plant, fire-system, datahallAI, ict, datahall, water-system); seeded simulation, no random state | Mocked (declared) |
| Cx super-app | Plan editor, baseline, schematic sheets, 3D campus, issue register, readiness, heatmap, records Tier 3 on demo JSON, PDF/CSV | Implemented UI; records mocked |
| Uncertainty | Monte Carlo code in tco, roi, spares (2/4/3 references), each separate | Partial |
| Exports | PDF on 42 pages, shared `js/rz-pdf-export.js` used by 11; 44 CSV references | Implemented per page |
| File input | Uploads only in ltc-system-modelling-lab, rfs-readiness-workbench, rz-cx-ext.js | Partial |
| Navigation | Command palette on 48 pages; manual contents rail on 35 long manuals | Partial |
| AI in product | AI/LLM appears only as article subject matter | Missing |
| Quality system | 163 test files, 35 audit tools, ~167 gates in `tools/ship-gate.sh` | Mature |
| Performance | datahallAI.html 1,366,717 B, 47 script blocks; SEO ledger #8: mobile LCP 6.7 s | Weak on largest page |

### Maturity by dimension (1 = absent, 5 = mature)

| Dimension | Score | Reason |
|---|---|---|
| Engineering correctness and traceability | 4 | Registries, basis drawers, strict coverage on cockpits; calculators lack basis hooks |
| Calculation breadth | 4 | 30 models, 11 calculators, 6 cockpits |
| Workflow integration | 2 | No shared project; scenarios do not flow between tools |
| Data connectivity | 1 | No ingest path; simulation is declared, which is honest but limits use |
| Collaboration | 1 | No sharing of scenarios or Cx records between users |
| Reporting | 3 | Per-page PDF good; no combined pack |
| Performance | 3 | Most pages fine; datahallAI heavy |
| Release discipline | 5 | Ship gate, freshness generators, live byte compare, IndexNow |

Summary: the product is strong at **correct, explained single calculations** and weak at **connecting them into a workflow**. Most of the high-ranked ideas below address that gap and reuse engines that already exist.

## Deliverable 2: Ranked ideas register

### Scoring framework

Each idea is rated 1-10 on Impact (I), Innovation (N), Confidence (C) and Effort (E, 10 = largest). Priority = 10 x (0.40 I + 0.15 N + 0.20 C + 0.25 (11 - E)), range 10-100. Impact weighs most; effort is inverted so cheap work ranks higher; innovation weighs least because novelty alone does not help users. Ratings are engineering judgement from the code, not user data. The scores are computed by a script, not typed.

| Rank | ID | Idea | I | N | C | E | Effort (wk) | Priority |
|---|---|---|---|---|---|---|---|---|
| 1 | P2 | openInCalc for every calculator plus shareable scenario links | 7 | 4 | 9 | 2 | 1.5 | 74.5 |
| 2 | P1 | Shared project workspace across calculators | 10 | 7 | 8 | 8 | 8 | 74.0 |
| 3 | P3 | Scenario compare view | 8 | 5 | 8 | 4 | 3 | 73.0 |
| 4 | P7 | Sensitivity (tornado) panel on every calculator | 7 | 6 | 8 | 4 | 3 | 70.5 |
| 5 | P4 | Multi-calculator report pack | 8 | 5 | 7 | 5 | 4 | 68.5 |
| 6 | P16 | Engine version manifest | 6 | 2 | 9 | 2 | 1 | 67.5 |
| 7 | P5 | Telemetry replay adapter for simulated cockpits | 8 | 8 | 6 | 7 | 6 | 66.0 |
| 8 | P10 | Basis drawer on all calculators | 8 | 6 | 7 | 7 | 6 | 65.0 |
| 9 | P14 | Command palette actions everywhere | 5 | 4 | 8 | 2 | 1.5 | 64.5 |
| 10 | P8 | Shared risk / Monte Carlo module | 6 | 4 | 8 | 4 | 3 | 63.5 |
| 11 | P24 | Cx plan editor decisions (K22 items 8, 9) | 5 | 2 | 9 | 2 | 1 | 63.5 |
| 12 | P6 | Cx records: real project records with access control | 8 | 6 | 6 | 7 | 6 | 63.0 |
| 13 | P17 | Manual <-> calculator deep links | 5 | 4 | 8 | 3 | 2 | 62.0 |
| 14 | P13 | Readiness to Cx to spares linkage | 6 | 6 | 5 | 4 | 3 | 60.5 |
| 15 | P12 | Cx schedule export (ICS / Primavera / MS Project XML) | 5 | 4 | 7 | 3 | 2 | 60.0 |
| 16 | P11 | Location presets (grid factor, tariff, climate) | 6 | 4 | 6 | 4 | 3 | 59.5 |
| 17 | P22 | Design-scale conformance auditor (UIUX A) | 5 | 3 | 7 | 3 | 2 | 58.5 |
| 18 | P23 | Register system stylesheet coverage (UIUX B) | 4 | 2 | 8 | 2 | 1 | 57.5 |
| 19 | P15 | Visible activity history for the user | 4 | 3 | 7 | 2 | 1.5 | 57.0 |
| 20 | P20 | Embeddable calculator widget | 5 | 5 | 6 | 4 | 3 | 57.0 |
| 21 | P25 | Offline-capable calculators | 5 | 3 | 6 | 3 | 2 | 56.5 |
| 22 | P21 | Explain-this-number assistant (registry-grounded) | 6 | 9 | 4 | 7 | 6 | 55.5 |
| 23 | P18 | Classroom mode for educators | 6 | 7 | 4 | 6 | 5 | 55.0 |
| 24 | P26 | Market tracker data freshness | 4 | 3 | 6 | 2 | 1.5 | 55.0 |
| 25 | P19 | Engine as an importable ES module | 4 | 5 | 6 | 4 | 3 | 53.0 |
| 26 | P9 | datahallAI page weight split | 6 | 2 | 7 | 7 | 5 | 51.0 |

### 1. P2: openInCalc for every calculator plus shareable scenario links (priority 74.5)

- **Current limitation:** `openInCalc` maps only capex/opex/roi/tco/pue and is called only from account.html. A saved scenario cannot be opened from a link.
- **Transformation:** Every calculator can be opened with a saved scenario by id or by an encoded input hash.
- **User experience:** 'Copy link to this scenario' button; the recipient sees the same inputs with a 'shared scenario' banner.
- **Workflow:** Run calculator, copy link, colleague opens, sees same numbers, saves a copy.
- **Value:** Quick win: makes existing persistence reachable and shareable without new backend.
- **Technical implementation:** Extend the openInCalc map to 11 pages; `#s=<base64url JSON>` reader in rz-scenario.js with schema validation and a size cap; no PII in the URL.
- **Integration points:** rz-scenario.js, account.html, 11 calculators.
- **Complexity:** Low
- **Effort:** 1.5 engineer-weeks (score 2)
- **Impact:** 7/10
- **Innovation:** 4/10
- **Confidence:** 9/10
- **Dependencies and risks:** Long hashes; schema changes break old links (version the payload).
- **Acceptance criteria:** For each of 11 calculators: link round-trip reproduces every input (gate); malformed hash shows a message, never throws; account page opens all 11.

### 2. P1: Shared project workspace across calculators (priority 74.0)

- **Current limitation:** Each of the 11 `data-rz-calc` calculators is an island. `rz-scenario.js` saves DOM inputs per calculator into `saved_scenarios`; no object links a CAPEX run to the OPEX, TCO, ROI or carbon run of the same facility.
- **Transformation:** One `project` record (site, IT MW, tier, tariff, grid factor, horizon) that every calculator reads as defaults and writes its outputs back to.
- **User experience:** A project chip in the calculator header: select or create a project; inputs prefill; a 'from CAPEX' badge marks inherited values; an override is one click and stays visible.
- **Workflow:** Create project, run CAPEX, open TCO (CAPEX prefilled), open ROI (TCO cash flows prefilled), open carbon (energy prefilled), export one pack.
- **Value:** Removes re-typing of the same facility 4-5 times and the inconsistencies that follow; makes the suite a planning tool instead of separate widgets.
- **Technical implementation:** New `js/rz-project.js` (pure state + Supabase adapter); table `projects` with RLS on `owner_id`; `saved_scenarios.project_id` FK; per-calculator input map (field id to project key) declared in one JSON.
- **Integration points:** rz-scenario.js, rz-supabase.js, account.html, all 11 calculators, rz-engine.js models (capex, opex, roi, carbon).
- **Complexity:** High
- **Effort:** 8 engineer-weeks (score 8)
- **Impact:** 10/10
- **Innovation:** 7/10
- **Confidence:** 8/10
- **Dependencies and risks:** Schema migration on live Supabase; per-calculator field maps drift when a page changes (needs a gate); anonymous users need a local-only mode.
- **Acceptance criteria:** A project created on CAPEX prefills TCO, ROI and carbon with identical values (gate compares rendered inputs); an override on one page does not change the project; RLS test: user B cannot read user A's project.

### 3. P3: Scenario compare view (priority 73.0)

- **Current limitation:** Users can save scenarios but cannot see two side by side; the Cx page has a baseline concept, the calculators do not.
- **Transformation:** Pick 2-4 saved scenarios of one calculator; show inputs and outputs in columns with deltas.
- **User experience:** Compare drawer: columns per scenario, changed inputs highlighted, output delta with sign.
- **Workflow:** Save A, change tariff, save B, open compare, read delta on NPV / TCO.
- **Value:** Decision support: the question users actually ask is 'what changes if'.
- **Technical implementation:** Re-run the engine for each stored input set (pure functions in rz-engine.js), render a table; no stored outputs trusted.
- **Integration points:** rz-scenario.js, rz-engine.js, calculator pages.
- **Complexity:** Medium
- **Effort:** 3 engineer-weeks (score 4)
- **Impact:** 8/10
- **Innovation:** 5/10
- **Confidence:** 8/10
- **Dependencies and risks:** Engine version drift between save and compare (show the version per column).
- **Acceptance criteria:** Compare of A vs A shows zero deltas; changing one input shows a non-zero delta only on dependent outputs (gate via perturbation).

### 4. P7: Sensitivity (tornado) panel on every calculator (priority 70.5)

- **Current limitation:** The registry builders already perturb parameters for the cockpits, but calculator users get no 'which input matters' view.
- **Transformation:** Tornado chart per calculator: each input +/-X % and the output swing, ranked.
- **User experience:** Collapsible 'What drives this result' panel under results.
- **Workflow:** Run, open panel, see top 5 drivers, adjust the top one.
- **Value:** Teaches engineering judgement; directly answers the most common review question.
- **Technical implementation:** Generic perturbation loop over the calculator's pure compute function; inputs declared with ranges in one map.
- **Integration points:** rz-engine.js models, calculator pages.
- **Complexity:** Medium
- **Effort:** 3 engineer-weeks (score 4)
- **Impact:** 7/10
- **Innovation:** 6/10
- **Confidence:** 8/10
- **Dependencies and risks:** Non-linear and ceil() models need two-sided sweeps (lesson from dcai registry).
- **Acceptance criteria:** Tornado bars equal recomputed output deltas (gate); an input with no effect shows zero.

### 5. P4: Multi-calculator report pack (priority 68.5)

- **Current limitation:** 42 pages export PDF, each on its own; `js/rz-pdf-export.js` exists but there is no combined document.
- **Transformation:** One PDF for a project: cover, assumptions register, CAPEX, OPEX, TCO, ROI, carbon, with page numbers and one basis appendix.
- **User experience:** 'Export project pack' with section checkboxes.
- **Workflow:** Project complete, choose sections, export, review pagination.
- **Value:** The deliverable engineers hand to a client or committee.
- **Technical implementation:** Section renderers per calculator returning DOM fragments; rz-pdf-export assembles with @page counters (memory: report-pdf traps).
- **Integration points:** rz-pdf-export.js, P1 project object.
- **Complexity:** Medium
- **Effort:** 4 engineer-weeks (score 5)
- **Impact:** 8/10
- **Innovation:** 5/10
- **Confidence:** 7/10
- **Dependencies and risks:** Depends on P1; print CSS colour-token scoping traps already known.
- **Acceptance criteria:** Pack page count equals sum of sections; every number in the pack equals the on-screen value (text compare gate); page n of m correct.

### 6. P16: Engine version manifest (priority 67.5)

- **Current limitation:** Memory: 8 cockpits hardcode engine versions and fail closed; one bump blanked all.
- **Transformation:** One manifest file read by every page's pin check; bump in one place.
- **User experience:** No user-visible change except no blanking.
- **Workflow:** Release bumps engine, manifest updates, all pages agree.
- **Value:** Removes a recurring outage class.
- **Technical implementation:** data/engine-versions.json + loader; gate compares engine meta to manifest.
- **Integration points:** Conventional cockpits, datahallAI, ship-gate.
- **Complexity:** Low
- **Effort:** 1 engineer-weeks (score 2)
- **Impact:** 6/10
- **Innovation:** 2/10
- **Confidence:** 9/10
- **Dependencies and risks:** Load order (manifest must be ready before pin check).
- **Acceptance criteria:** Bumping an engine without the manifest fails the gate; with it all cockpits render.

### 7. P5: Telemetry replay adapter for simulated cockpits (priority 66.0)

- **Current limitation:** 6 cockpits declare `data-rz-data-mode="simulated"`; no fetch, WebSocket or upload path brings real data in (only ltc lab, rfs workbench and Cx ext accept files).
- **Transformation:** A file adapter: user loads a CSV/JSON time series mapped to point ids; the cockpit replays it in place of seeded simulation, labelled REPLAY.
- **User experience:** Mode switch SIMULATED / REPLAY; mapping dialog shows unmatched columns; timeline scrubber.
- **Workflow:** Export a BMS trend, load it, map columns, scrub through the incident.
- **Value:** Turns teaching cockpits into an incident-review tool for real sites without any live connection or security exposure.
- **Technical implementation:** Client-side parser, point-id mapping schema, a `source` provider interface beside sim-telemetry (seeded); no network.
- **Integration points:** sim-telemetry.js, hmi-payloads.js, rz-bms-shell.js, the 6 cockpits.
- **Complexity:** High
- **Effort:** 6 engineer-weeks (score 7)
- **Impact:** 8/10
- **Innovation:** 8/10
- **Confidence:** 6/10
- **Dependencies and risks:** Point naming varies per BMS; large files in browser memory; must never be mistaken for live (label + mode attribute).
- **Acceptance criteria:** Replay of a fixture file renders exactly the fixture values at chosen ticks (gate); unmapped columns listed; mode attribute changes to replay.

### 8. P10: Basis drawer on all calculators (priority 65.0)

- **Current limitation:** Basis drawer runs on 10 pages (cockpits); calculators show results without a click-to-source path.
- **Transformation:** Every calculator result cell gets a basis hook to the engine formula and its inputs.
- **User experience:** Click a result, drawer shows formula, inputs, evidence class, standard reference.
- **Workflow:** Read result, open basis, check assumption, adjust.
- **Value:** Trust: makes each number auditable, the site's core differentiator.
- **Technical implementation:** Registry for rz-engine models (same generator pattern as dcai/conv), data-basis-param hooks, coverage gate per calculator.
- **Integration points:** rz-basis-drawer.js, rz-engine.js, 11 calculators.
- **Complexity:** High
- **Effort:** 6 engineer-weeks (score 7)
- **Impact:** 8/10
- **Innovation:** 6/10
- **Confidence:** 7/10
- **Dependencies and risks:** 30 engine models; registry generation must handle shared leaves.
- **Acceptance criteria:** Coverage gate: every rendered result numeral hooked or declared on all 11 calculators.

### 9. P14: Command palette actions everywhere (priority 64.5)

- **Current limitation:** Palette exists on 48 pages; navigation only.
- **Transformation:** Palette on all pages plus actions: open calculator with project, export, switch theme, open basis.
- **User experience:** Ctrl/Cmd+K, type 'tco project X'.
- **Workflow:** Keyboard-first navigation for repeat users.
- **Value:** Speed for power users; consistent shell.
- **Technical implementation:** Action registry in the palette module; pages register actions.
- **Integration points:** palette script, P1.
- **Complexity:** Low
- **Effort:** 1.5 engineer-weeks (score 2)
- **Impact:** 5/10
- **Innovation:** 4/10
- **Confidence:** 8/10
- **Dependencies and risks:** Action list sprawl.
- **Acceptance criteria:** Palette present on every HTML page (gate); each action executes in a headless test.

### 10. P8: Shared risk / Monte Carlo module (priority 63.5)

- **Current limitation:** tco, roi and spares each carry their own Monte Carlo code (grep: 2/4/3 references) with `Math.random` and different conventions.
- **Transformation:** One seeded Monte Carlo module with distributions, percentiles and a histogram renderer used by all three.
- **User experience:** P10/P50/P90 band with the same visual on every calculator; seed shown so a result is reproducible.
- **Workflow:** Toggle uncertainty, set ranges, read P50/P90.
- **Value:** Consistency and reproducibility (same seed, same answer).
- **Technical implementation:** `js/rz-montecarlo.js` (mulberry32 like sim-telemetry), port the three call sites.
- **Integration points:** tco, roi, spares pages, rz-engine.js.
- **Complexity:** Medium
- **Effort:** 3 engineer-weeks (score 4)
- **Impact:** 6/10
- **Innovation:** 4/10
- **Confidence:** 8/10
- **Dependencies and risks:** Port must preserve current outputs at the old defaults or document the change.
- **Acceptance criteria:** Same seed twice gives identical percentiles; static scan finds no Math.random in the three pages' MC paths.

### 11. P24: Cx plan editor decisions (K22 items 8, 9) (priority 63.5)

- **Current limitation:** Open owner decisions: preview-then-Apply vs direct edit + undo; animation 24 fps vs PRD 30 fps.
- **Transformation:** Close both per owner choice.
- **User experience:** Edit behaviour as chosen.
- **Workflow:** Edit plan, apply or undo.
- **Value:** Finishes an in-flight feature.
- **Technical implementation:** Plan editor state machine change.
- **Integration points:** rz-cx plan editor.
- **Complexity:** Low
- **Effort:** 1 engineer-weeks (score 2)
- **Impact:** 5/10
- **Innovation:** 2/10
- **Confidence:** 9/10
- **Dependencies and risks:** Blocked on owner.
- **Acceptance criteria:** Behaviour gate per chosen option.

### 12. P6: Cx records: real project records with access control (priority 63.0)

- **Current limitation:** Cx records are demo-only (`data/cx/demo-records.json`); the issue register, checklist and records Tier 3 cannot hold a user's project.
- **Transformation:** Persist Cx issues, checklist states and records per project in Supabase with RLS; demo stays as a read-only sample.
- **User experience:** Same UI, project selector, 'saved' state per item, export unchanged.
- **Workflow:** Create project, raise issues during L3, close them with evidence notes, export the register.
- **Value:** Moves the Cx super-app from demonstration to working tool.
- **Technical implementation:** Tables cx_items / cx_records keyed by project_id, RLS by owner; optimistic UI with conflict check on updated_at.
- **Integration points:** rz-cx-*.js, rz-supabase.js, P1.
- **Complexity:** High
- **Effort:** 6 engineer-weeks (score 7)
- **Impact:** 8/10
- **Innovation:** 6/10
- **Confidence:** 6/10
- **Dependencies and risks:** Data custody: users will store client data; needs clear terms, export and delete; file attachments out of scope initially.
- **Acceptance criteria:** Item created by A invisible to B (RLS test); reload keeps state; export equals stored rows.

### 13. P17: Manual <-> calculator deep links (priority 62.0)

- **Current limitation:** 42 manuals now have contents navigation but do not link to the field or result they explain, nor back.
- **Transformation:** Each manual section anchors to a calculator field; calculator '?' icons open the manual section.
- **User experience:** Help icon beside a field opens the exact manual section.
- **Workflow:** Confused by an input, click ?, read, return.
- **Value:** Self-serve learning; reuses existing content.
- **Technical implementation:** data-rz-manual attributes + slug map; link gate.
- **Integration points:** manual/*.html, calculators, rz-manual-toc.js.
- **Complexity:** Low
- **Effort:** 2 engineer-weeks (score 3)
- **Impact:** 5/10
- **Innovation:** 4/10
- **Confidence:** 8/10
- **Dependencies and risks:** Slug drift when headings change (gate catches).
- **Acceptance criteria:** Every link resolves to an existing id (gate).

### 14. P13: Readiness to Cx to spares linkage (priority 60.5)

- **Current limitation:** rfs-readiness-workbench, cx-calculator and spares calculator do not exchange data.
- **Transformation:** Readiness gaps create Cx issues; Cx scope sets the spares list basis.
- **User experience:** 'Send to Cx' on a readiness gap; spares page shows 'from Cx scope'.
- **Workflow:** Assess readiness, push gaps, plan Cx, size spares.
- **Value:** Connects the lifecycle tools into one flow.
- **Technical implementation:** Uses P1 project object as the bus.
- **Integration points:** rfs workbench, cx, spares, P1.
- **Complexity:** Medium
- **Effort:** 3 engineer-weeks (score 4)
- **Impact:** 6/10
- **Innovation:** 6/10
- **Confidence:** 5/10
- **Dependencies and risks:** Depends on P1 and P6.
- **Acceptance criteria:** A gap pushed appears once in the Cx register with a back-link (gate).

### 15. P12: Cx schedule export (ICS / Primavera / MS Project XML) (priority 60.0)

- **Current limitation:** Cx exports PDF/CSV; schedulers live in P6 or MS Project.
- **Transformation:** Export the L0-L6 plan as MSPDI XML and ICS.
- **User experience:** Export menu with format choice.
- **Workflow:** Edit plan, export XML, import into MS Project.
- **Value:** Removes re-entry into the scheduling tool.
- **Technical implementation:** Serializer from the plan model; validate against MSPDI schema subset.
- **Integration points:** rz-cx-*.js plan model.
- **Complexity:** Medium
- **Effort:** 2 engineer-weeks (score 3)
- **Impact:** 5/10
- **Innovation:** 4/10
- **Confidence:** 7/10
- **Dependencies and risks:** Format fidelity (calendars, dependencies).
- **Acceptance criteria:** Round-trip fixture: exported task count, durations and links equal the plan (parser gate).

### 16. P11: Location presets (grid factor, tariff, climate) (priority 59.5)

- **Current limitation:** Calculators take grid factor and tariff as free inputs; DCMOC has tariff data (v3.25.0) but calculators do not use it.
- **Transformation:** A location selector filling grid emission factor, energy tariff and climate bin with cited sources and dates.
- **User experience:** Country/region dropdown; filled fields show source and year; user can override.
- **Workflow:** Pick Jakarta, values fill, run carbon and OPEX.
- **Value:** Faster, more consistent inputs.
- **Technical implementation:** data/locations.json with source URL and retrieval date per value; schema gate rejects a value without a source.
- **Integration points:** carbon, opex, tco, pue calculators; dcmoc tariff data.
- **Complexity:** Medium
- **Effort:** 3 engineer-weeks (score 4)
- **Impact:** 6/10
- **Innovation:** 4/10
- **Confidence:** 6/10
- **Dependencies and risks:** Data goes stale; values must be sourced, not invented (needs owner-approved sources).
- **Acceptance criteria:** Every value in locations.json has source + date (gate); selecting a location changes only the declared fields.

### 17. P22: Design-scale conformance auditor (UIUX A) (priority 58.5)

- **Current limitation:** Open audit item: no `audit-editorial-render.mjs`; type/spacing scale conformance is not measured on render.
- **Transformation:** Render gate that measures font sizes, spacing and radii against the token scale.
- **User experience:** None directly; fewer inconsistencies reach users.
- **Workflow:** Gate runs in ship-gate.
- **Value:** Prevents the slop regressions the owner keeps finding.
- **Technical implementation:** Puppeteer walker collecting computed styles; allowlist of scale values.
- **Integration points:** ship-gate.sh, styles.
- **Complexity:** Medium
- **Effort:** 2 engineer-weeks (score 3)
- **Impact:** 5/10
- **Innovation:** 3/10
- **Confidence:** 7/10
- **Dependencies and risks:** False positives (memory: render-audit false positives).
- **Acceptance criteria:** Planted off-scale element fails; current pages produce a baseline table.

### 18. P23: Register system stylesheet coverage (UIUX B) (priority 57.5)

- **Current limitation:** Register system declared on 90 pages, its CSS loaded by 3.
- **Transformation:** Load the register CSS where declared, or remove the declaration.
- **User experience:** Consistent register styling.
- **Workflow:** Sweep, gate.
- **Value:** Removes a silent design inconsistency.
- **Technical implementation:** Gate: declared register implies stylesheet linked.
- **Integration points:** 90 pages.
- **Complexity:** Low
- **Effort:** 1 engineer-weeks (score 2)
- **Impact:** 4/10
- **Innovation:** 2/10
- **Confidence:** 8/10
- **Dependencies and risks:** Visual changes on 87 pages need screenshot review.
- **Acceptance criteria:** Gate passes; screenshots reviewed both themes.

### 19. P15: Visible activity history for the user (priority 57.0)

- **Current limitation:** `audit_log` exists in Supabase and is referenced only in rz-supabase.js; users cannot see their own history.
- **Transformation:** Account page lists the user's own saves, exports and edits.
- **User experience:** Timeline on account.html, filter by project.
- **Workflow:** Find what changed last week on a scenario.
- **Value:** Accountability and recovery.
- **Technical implementation:** RLS select on own rows; read-only view.
- **Integration points:** account.html, rz-supabase.js.
- **Complexity:** Low
- **Effort:** 1.5 engineer-weeks (score 2)
- **Impact:** 4/10
- **Innovation:** 3/10
- **Confidence:** 7/10
- **Dependencies and risks:** Must check what audit_log currently records (UNVERIFIED) before relying on it.
- **Acceptance criteria:** User sees only own rows (RLS test); entries appear after a save.

### 20. P20: Embeddable calculator widget (priority 57.0)

- **Current limitation:** Calculators exist only as full pages.
- **Transformation:** A minimal embed (iframe with postMessage size) for article pages and external sites.
- **User experience:** Article shows a live mini-calculator.
- **Workflow:** Reader adjusts input inside the article.
- **Value:** Brings tools into the 31 articles where readers already are.
- **Technical implementation:** Embed mode CSS + query flag; size messaging.
- **Integration points:** articles, calculators.
- **Complexity:** Medium
- **Effort:** 3 engineer-weeks (score 4)
- **Impact:** 5/10
- **Innovation:** 5/10
- **Confidence:** 6/10
- **Dependencies and risks:** Clickjacking headers; layout in narrow frames.
- **Acceptance criteria:** Embed renders at 360 px with no overflow; parent cannot script the frame.

### 21. P25: Offline-capable calculators (priority 56.5)

- **Current limitation:** sw.js and manifest.json exist; offline behaviour of calculators is UNVERIFIED (memory: precache traps).
- **Transformation:** Precache calculator pages and engine so they work offline after first visit.
- **User experience:** Works on site with no signal.
- **Workflow:** Visit once, go offline, calculate.
- **Value:** Field engineers on site.
- **Technical implementation:** Non-atomic precache with per-file reporting; offline gate.
- **Integration points:** sw.js.
- **Complexity:** Medium
- **Effort:** 2 engineer-weeks (score 3)
- **Impact:** 5/10
- **Innovation:** 3/10
- **Confidence:** 6/10
- **Dependencies and risks:** Cache staleness vs cache-bust tokens.
- **Acceptance criteria:** Offline headless run computes a result on each calculator.

### 22. P21: Explain-this-number assistant (registry-grounded) (priority 55.5)

- **Current limitation:** No in-product AI; explanations come from basis drawers and manuals.
- **Transformation:** A question box that answers only from the registry, formulas and manuals, citing the record.
- **User experience:** Ask 'why is PUE 1.165', get the formula path with links.
- **Workflow:** Ask, read cited answer, click through to basis.
- **Value:** Lowers the learning curve.
- **Technical implementation:** Retrieval over registry JSON + manuals; deterministic template answers first; an LLM only with owner approval and a server key.
- **Integration points:** registries, manuals, basis drawer.
- **Complexity:** High
- **Effort:** 6 engineer-weeks (score 7)
- **Impact:** 6/10
- **Innovation:** 9/10
- **Confidence:** 4/10
- **Dependencies and risks:** Hallucination risk contradicts the site's accuracy rules; cost; key management. Requires approval.
- **Acceptance criteria:** Every answer cites a registry id that exists; a question outside scope returns 'not covered'.

### 23. P18: Classroom mode for educators (priority 55.0)

- **Current limitation:** `educator_allowlist` and feature flags exist; no assignment or cohort feature (UNVERIFIED scope of current educator features).
- **Transformation:** Educator shares a preset scenario set; students submit their scenario links.
- **User experience:** Educator page with assignment link; submission list.
- **Workflow:** Educator sets task, students solve, educator compares (uses P3).
- **Value:** Extends reach in teaching contexts the site already targets.
- **Technical implementation:** Tables assignments/submissions with RLS; reuse P2 links.
- **Integration points:** rz-feature-flags.js, rz-supabase.js, P2, P3.
- **Complexity:** High
- **Effort:** 5 engineer-weeks (score 6)
- **Impact:** 6/10
- **Innovation:** 7/10
- **Confidence:** 4/10
- **Dependencies and risks:** Privacy of student data; scope creep; needs owner decision on audience.
- **Acceptance criteria:** Student sees only own submission; educator sees cohort (RLS tests).

### 24. P26: Market tracker data freshness (priority 55.0)

- **Current limitation:** dc-market-tracker loads rz-engine; data dates per figure UNVERIFIED.
- **Transformation:** Every market figure shows source and as-of date; stale ones flagged.
- **User experience:** Small date stamp per figure; amber when older than 12 months.
- **Workflow:** Read figure, see date, decide trust.
- **Value:** Honesty about time-sensitive data.
- **Technical implementation:** Data schema with asOf; render rule.
- **Integration points:** dc-market-tracker.html.
- **Complexity:** Low
- **Effort:** 1.5 engineer-weeks (score 2)
- **Impact:** 4/10
- **Innovation:** 3/10
- **Confidence:** 6/10
- **Dependencies and risks:** Requires sourcing each existing value.
- **Acceptance criteria:** Gate: no figure without asOf.

### 25. P19: Engine as an importable ES module (priority 53.0)

- **Current limitation:** rz-engine.js (1.1 MB, 30 models) is a browser global; it cannot be used from Node scripts or notebooks except via test harnesses.
- **Transformation:** Publish a UMD/ESM build with typed JSDoc for programmatic use.
- **User experience:** Developers import and call models.
- **Workflow:** npm install, call models.capex(...).
- **Value:** Reuse by engineers who script studies.
- **Technical implementation:** Wrap existing IIFE exports; JSDoc types; versioned build.
- **Integration points:** rz-engine.js.
- **Complexity:** Medium
- **Effort:** 3 engineer-weeks (score 4)
- **Impact:** 4/10
- **Innovation:** 5/10
- **Confidence:** 6/10
- **Dependencies and risks:** Publishing is public and permanent (owner decision); API stability commitment.
- **Acceptance criteria:** Node import returns same outputs as browser for fixtures.

### 26. P9: datahallAI page weight split (priority 51.0)

- **Current limitation:** datahallAI.html is 1,366,717 B with 47 script blocks; SEO ledger #8 records mobile LCP 6.7 s (88 % inline JS).
- **Transformation:** Move inline tab builders to deferred modules loaded on first tab activation.
- **User experience:** Dashboard paints first; other tabs load on click with a skeleton.
- **Workflow:** Open page, dashboard visible quickly, click Cooling, module loads.
- **Value:** Performance on phones; lower parse cost on every visit.
- **Technical implementation:** Extract per-tab IIFEs into js/datahall-ai/tab-*.js, dynamic loader, keep gates (coverage, inspector) green.
- **Integration points:** datahallAI.html, ~20 gates that open tabs.
- **Complexity:** High
- **Effort:** 5 engineer-weeks (score 7)
- **Impact:** 6/10
- **Innovation:** 2/10
- **Confidence:** 7/10
- **Dependencies and risks:** Very large inline script; ordering bugs; many gates pin behaviour.
- **Acceptance criteria:** Mobile LCP measured below 2.5 s in a controlled A/B (memory: perf A/B traps); all existing datahallAI gates green.

## Deliverable 3: Top-10 transformation blueprint

| Rank | ID | Idea | Priority | Needs approval |
|---|---|---|---|---|
| 1 | P2 | openInCalc for every calculator plus shareable scenario links | 74.5 | no |
| 2 | P1 | Shared project workspace across calculators | 74.0 | yes |
| 3 | P3 | Scenario compare view | 73.0 | no |
| 4 | P7 | Sensitivity (tornado) panel on every calculator | 70.5 | no |
| 5 | P4 | Multi-calculator report pack | 68.5 | no |
| 6 | P16 | Engine version manifest | 67.5 | no |
| 7 | P5 | Telemetry replay adapter for simulated cockpits | 66.0 | yes |
| 8 | P10 | Basis drawer on all calculators | 65.0 | yes |
| 9 | P14 | Command palette actions everywhere | 64.5 | no |
| 10 | P8 | Shared risk / Monte Carlo module | 63.5 | no |

### Complete workflows for the top ideas

#### P2: openInCalc for every calculator plus shareable scenario links

1. User finishes a run and clicks `Copy link`.
2. Inputs are encoded as a versioned, size-capped hash; no personal data.
3. Recipient opens; page validates schema; on failure shows `link not readable`, keeps defaults.
4. Recipient saves a copy to their own account.

Done when: For each of 11 calculators: link round-trip reproduces every input (gate); malformed hash shows a message, never throws; account page opens all 11.

#### P1: Shared project workspace across calculators

1. User opens CAPEX, clicks the project chip, creates `Site A, 20 MW, Tier III`.
2. CAPEX inputs prefill from the project; user runs; outputs (capex total, schedule) are written to the project.
3. User opens TCO from the chip; CAPEX and power cost arrive with a `from CAPEX` badge.
4. User overrides electricity tariff on TCO; the override is stored on the TCO scenario, not on the project, and stays visible.
5. ROI and carbon open with the TCO cash flows and energy; user exports the pack (P4).
6. Error path: project deleted while open, pages fall back to local inputs with a notice; offline, project is read-only from local cache.

Done when: A project created on CAPEX prefills TCO, ROI and carbon with identical values (gate compares rendered inputs); an override on one page does not change the project; RLS test: user B cannot read user A's project.

#### P3: Scenario compare view

1. User saves scenario A and B on the same calculator.
2. Opens Compare, picks both.
3. The engine recomputes both from stored inputs; table shows inputs and outputs with deltas; engine version per column.
4. User exports the comparison as CSV.

Done when: Compare of A vs A shows zero deltas; changing one input shows a non-zero delta only on dependent outputs (gate via perturbation).

#### P7: Sensitivity (tornado) panel on every calculator

1. User runs a calculator and opens `What drives this result`.
2. Each declared input is moved +/-10 % (two-sided); output change computed by the pure model.
3. Bars ranked by swing; clicking a bar focuses the input.

Done when: Tornado bars equal recomputed output deltas (gate); an input with no effect shows zero.

#### P4: Multi-calculator report pack

1. From a project, user chooses `Export pack` and ticks sections.
2. Each calculator renders its section from the project state.
3. rz-pdf-export assembles cover, assumptions register, sections, basis appendix with page n of m.
4. User downloads; gate compares PDF text against on-screen values.

Done when: Pack page count equals sum of sections; every number in the pack equals the on-screen value (text compare gate); page n of m correct.

#### P16: Engine version manifest

1. Engineer bumps an engine version.
2. Manifest updated in the same commit; pages read the manifest for their pin.
3. Ship gate fails if engine meta and manifest disagree.

Done when: Bumping an engine without the manifest fails the gate; with it all cockpits render.

#### P5: Telemetry replay adapter for simulated cockpits

1. User switches a cockpit to REPLAY and loads a CSV.
2. Mapping dialog matches columns to point ids, lists unmatched ones.
3. Cockpit renders the file values at the scrubbed tick; header shows REPLAY and file name.
4. Leaving replay restores seeded simulation.

Done when: Replay of a fixture file renders exactly the fixture values at chosen ticks (gate); unmapped columns listed; mode attribute changes to replay.

#### P10: Basis drawer on all calculators

1. Registry generated for rz-engine models.
2. Each calculator result carries `data-basis-param`.
3. Click opens the drawer with formula, inputs, evidence class.
4. Coverage gate per calculator turns strict when it reaches zero untraced.

Done when: Coverage gate: every rendered result numeral hooked or declared on all 11 calculators.

#### P14: Command palette actions everywhere

1. User presses Ctrl/Cmd+K anywhere.
2. Types an action; palette lists navigation and actions.
3. Enter executes; failures show a message.

Done when: Palette present on every HTML page (gate); each action executes in a headless test.

#### P8: Shared risk / Monte Carlo module

1. Calculator toggles uncertainty.
2. Shared module runs N seeded draws; P10/P50/P90 shown with seed.
3. Same seed reproduces identical percentiles.

Done when: Same seed twice gives identical percentiles; static scan finds no Math.random in the three pages' MC paths.

## Deliverable 4: Implementation roadmap

### Quick wins (2 weeks or less each, no approval needed unless marked)

- P2 openInCalc for every calculator plus shareable scenario links: 1.5 wk, priority 74.5
- P16 Engine version manifest: 1 wk, priority 67.5
- P14 Command palette actions everywhere: 1.5 wk, priority 64.5
- P24 Cx plan editor decisions (K22 items 8, 9): 1 wk, priority 63.5
- P17 Manual <-> calculator deep links: 2 wk, priority 62.0
- P12 Cx schedule export (ICS / Primavera / MS Project XML): 2 wk, priority 60.0
- P22 Design-scale conformance auditor (UIUX A): 2 wk, priority 58.5
- P23 Register system stylesheet coverage (UIUX B): 1 wk, priority 57.5
- P15 Visible activity history for the user: 1.5 wk, priority 57.0
- P25 Offline-capable calculators: 2 wk, priority 56.5
- P26 Market tracker data freshness: 1.5 wk, priority 55.0

### Phase A: foundations (weeks 1-6)
- P16 engine version manifest, P2 scenario links, P14 palette actions, P23 register coverage, P17 manual links.
- P1 design spec and Supabase migration plan for owner review (no live schema change before approval).
- Exit: all quick-win gates strict; P1 spec approved or rejected.

### Phase B: connected workflow (weeks 7-16, after approval of P1)
- P1 shared project, then P3 compare and P4 report pack on top of it.
- P7 sensitivity and P8 shared Monte Carlo (independent, can run in parallel).
- P10 basis drawer on calculators (registry generator for rz-engine).
- Exit: a project flows CAPEX to carbon with identical values proven by gate; pack text equals screen.

### Phase C: strategic (weeks 17+, each needs approval)
- P5 telemetry replay, P6 Cx real records, P9 datahallAI split, P13 lifecycle linkage, P18 classroom, P21 grounded assistant, P19 engine package.
- Exit per item: its acceptance criteria above, plus security review for anything storing user data.

### Sequencing logic
P1 is the dependency for P3, P4, P6, P13 and P18, so it is designed first and built only after approval. Work that does not depend on it (P2, P7, P8, P16, P17, P23) fills Phase A and B in parallel.

## Deliverable 5: Existing task completion report

Releases shipped in this session, each byte-verified on the live site with IndexNow sent:

| Version | Commit | Content |
|---|---|---|
| v3.35.4 | 77d5b6850 | K29b Cx schematic work |
| v3.35.6 | 6285aae34 | K34 Cx gradient (owner request), narrow exemption, `test-cx-gradient.mjs` |
| v3.35.9 | 4cccad1d5 | K26 stage 2: manual contents rail on 35 long manuals, `test-manual-toc.mjs`; id/index meta description fit |

Owner ledger (PRD v1.1) status:

| Item | Status |
|---|---|
| K22 | Partial 7/9. Items 8 (preview/Apply vs direct edit + undo) and 9 (24 vs 30 fps) wait for owner decision (P24) |
| K23, K24, K25, K27, K30 | Live |
| K26 | Stage 2 live in v3.35.9; readability beyond contents not started |
| K29, K34 | Done, live |
| K33 | Owned by the parallel LTC session |

Open audit items, not started (need authorisation as work packages): UIUX A scale auditor (P22), UIUX B register CSS on 3 of 90 pages (P23), SEO #8 datahallAI mobile LCP 6.7 s (P9).

Owner-only tasks: O-PAT (revoke the GitHub token pasted in chat on 2026-11-05), O-ART, O-FIG, O-PRD38.

## Limits of this assessment

- No analytics, user interviews or market data were used; impact scores are engineering judgement.
- Some facts are UNVERIFIED and marked where used (audit_log contents, educator feature scope, offline behaviour, market tracker dates).
- Effort estimates assume one engineer familiar with the repository and its gate system.
