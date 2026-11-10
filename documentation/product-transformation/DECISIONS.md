# Owner decisions, product-transformation program

One file for every owner decision that a PRD needs before it can ship (coordinator decision D5, QA batch 1, 2026-11-11).
PRDs reference a decision by its id and never keep their own decision format.

- Id: `D-<PRD>-<n>`, for example `D-Q04-3`. Ids are never reused; a withdrawn question stays in the table as REJECTED.
- Status:
  - PROPOSED: written by a PRD, waiting for the owner.
  - ACCEPTED: the owner chose an option (the chosen option is written into "recommended default" if it differs, with the word "chosen").
  - REJECTED: the owner declined every option, or declined the question; the PRD's "if rejected" path applies.
  - DEFAULTED: the owner let the recommended default stand without choosing (it must still be recorded by the session with the request id of the owner message that said so).
- "Decided by" holds `owner (R<nnn>)`, the request id of the owner message, or `main session (R<nnn>)` where the PRD says the
  main session owns the call. "Date" is the date of that message. Both stay `—` while PROPOSED.
- A session changes a row only from an owner message that names the id. Per-record acceptance inside a feature (one relation
  edge, one reproduce entry, one scenario file) is still recorded in that record by the PRD's own CLI with the request id;
  this file holds the decision to accept the batch.

All rows below were written on 2026-11-11 from PRD-Q01, Q03, Q04, Q06 and Q07 version 1.1. Total: 22.

| Id | Question | Options | Recommended default | Status | Decided by | Date |
|---|---|---|---|---|---|---|
| D-Q01-1 | PRD-Q01 §5.2, §16: the incident library is root-only. Should public article and tool pages show dossier rows? | A keep the library root-only and show dossier rows with the word "Root access" and the root prompt (FR-13). B keep it root-only and render no dossier rows on public pages. C open the library to other tiers (a separate change, outside Q01) | A | PROPOSED | — | — |
| D-Q01-2 | PRD-Q01 §5.6 A2, BR2: how does the owner accept relation edges? | A the owner names edge ids in chat; the session runs `build-relations.py decide … --request R<nnn>`. B the owner edits `data/relations.json` by hand | A | PROPOSED | — | — |
| D-Q01-3 | PRD-Q01 FR-13 (auth boundary, `STATE.md` approval list): change `isRootOnlyHref` in `auth.js` and `auth.min.js` so `/incident-*.html` matches the `/incident-` prefix | A approve; phase 2 (incident rows, dossier `#related`) ships. B decline; phase 2 does not ship, phase 1 (tool and term rows) is unaffected | A | PROPOSED | — | — |
| D-Q03-1 | PRD-Q03 §1 (addendum marks Q3 "needs owner approval"): build the Reproduce feature? | A yes. B no | A | PROPOSED | — | — |
| D-Q03-2 | PRD-Q03 BR-2: inputs the dossier does not state come from a named, generated baseline, shown as "Baseline", never as a fact about the site | A yes. B only the stated inputs, every other input at the page default (on TIA that shows almost every item as a gap) | A | PROPOSED | — | — |
| D-Q03-3 | PRD-Q03 Appendix A: accept the 4 entries (OVH TIA, OVH tier, Equinix LD8 TIA, Delta TIA). Each entry is then recorded by `incidents_reproduce.py decide` with the request id | A accept all 4. B accept a subset (name them). C accept none | A | PROPOSED | — | — |
| D-Q03-4 | PRD-Q03 RV11: Delta's violated item rests on Availability Digest (not an official postmortem). Is that source enough? | A yes, with the row labelled "official postmortem: no". B no; drop the Delta entry (3 entries remain) | A | PROPOSED | — | — |
| D-Q04-1 | PRD-Q04 §12.3 (was D-1): which carbon price do cost, levy and tax lines use? | A compliance price per country (`DATA.envCosts`); shadow price only for avoided-carbon values, labelled. B keep the blended table | A (evidence `05-test-evidence/Q4/D-Q04-1.md`) | PROPOSED | — | — |
| D-Q04-2 | PRD-Q04 §12.3 (was D-2): which grid factor? | A `DATA.countries` per country (40), aggregates only for aggregate codes. B `DATA.carbon.gridFactor` (9 codes, US for the rest) | A, after the T-4 Ember check of six countries | PROPOSED | — | — |
| D-Q04-3 | PRD-Q04 §12.3 (was D-3): opex, which PUE is shown and charged? | A show the PUE the energy model implies (energy cost unchanged in 42/42). B charge the shown PUE (cost changes in 41/42, up to 16.0 %) | A | PROPOSED | — | — |
| D-Q04-4 | PRD-Q04 §12.3 (was D-4): carbon-footprint and DCMOC Scope 1 and 3 method | A engine data (`DATA.fuelGen`, `DATA.refrigerants`, HVO 0.268 kg/L; Scope 3 = life-cycle total ÷ life). B keep the page factors | A | PROPOSED | — | — |
| D-Q04-5 | PRD-Q04 §12.3 (was D-5): tco cooling labels and capex grid factor | A tco labels without numbers; capex `resolveGrid` with the FR-13 region map. B tco labels with engine values for air and DLC only | A | PROPOSED | — | — |
| D-Q04-6 | PRD-Q04 §12.3 (was D-6): DCMOC tier-aware PUE in every module | A yes (8 of 12 cooling × tier pairs change by −4.3 % to +8.0 %). B Tier 3 everywhere, and the summary changes instead | A | PROPOSED | — | — |
| D-Q04-7 | PRD-Q04 §12.3 (was D-7): pue-calculator what-if baselines use the main build-up | A yes. B keep `estimatePue` | A | PROPOSED | — | — |
| D-Q04-8 | PRD-Q04 §12.3 (was D-8): the five calculators without the engine. Also confirms whether removing the five silent local fallbacks counts as "feature removal" (`STATE.md`) | A no numbers: the Q06 `Fallback` line and "—" (FR-16). B a parity-proven fallback per page with a visible line | A, and "not a feature removal" | PROPOSED | — | — |
| D-Q04-9 | PRD-Q04 §12.3 (was D-9): rear-door PUE key | A point `rearDoor` at the `rdhx` row. B leave it on `liquid` | A | PROPOSED | — | — |
| D-Q06-1 | PRD-Q06 §9.10, §14: accept the copy as final, including the SEO-visible title and meta-description rewrites that remove "Live" and "real-time" claims | A accept as written. B the owner edits named strings before T-14 | A | PROPOSED | — | — |
| D-Q06-2 | PRD-Q06 §1 "Overlap to resolve": PRD-X-DEFECTS also lists X4 interim and X6. Which PRD specifies them? (owned by the main session) | A Q06 specifies both; PRD-X-DEFECTS points to Q06. B PRD-X-DEFECTS specifies them; Q06 drops FR-6, FR-7, FR-10 | A | PROPOSED | — | — |
| D-Q07-1 | PRD-Q07 FR-12 (was OQ-1): Phase C thermal model, hall thermal capacitance | A adopt the Hall A air volume, or an effective capacitance with its source. B adopt the air-only bound, labelled "fastest possible rise". C no Phase C | C until a sourced value exists (Phase C stays off; Phases A and B ship) | PROPOSED | — | — |
| D-Q07-2 | PRD-Q07 FR-12 (was OQ-2): standby CRAH start delay | A adopt a sequence-of-operation value with its source. B keep "not modelled" (standby shown running from the next second, said in the debrief) | B | PROPOSED | — | — |
| D-Q07-3 | PRD-Q07 §10, R5 (was OQ-3): basis for alarm acknowledgement and action time budgets | A keep the Cx handbook MSC-1 alarm classes, every budget line says "worked example". B the owner supplies the site's alarm philosophy (the "doc-03 Alarm Rules" cited at `datahall.html:1409` is not in the repository) | A | PROPOSED | — | — |
| D-Q07-4 | PRD-Q07 Appendix C (was OQ-4): accept the four scenario files for publication (`status: approved`) | A accept all four. B accept a subset (name them). C none | A | PROPOSED | — | — |
