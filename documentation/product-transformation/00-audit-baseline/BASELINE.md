# Verified baseline for the product-transformation program

Written 2026-11-10 by the homepage/LTC session. The baseline covers this session's half of the split (see `../STATE.md`). The peer
session keeps its own baseline for P1–P26 in `documentation/PRODUCT_INNOVATION_ASSESSMENT_2026-11.md`.

Every row below was re-checked against the tree at `803253314` (v3.35.9 + docs) on 2026-11-10 with the command shown. Where the
re-check changed an earlier audit claim, the row says **CORRECTED**.

## 1. Existing and fully functional

| Capability | Evidence |
|---|---|
| Journal: 36 pages, generated index | `data/journal.json` count 36, built by `tools/build-journal.py` |
| Glossary + explain engine | `glossary.html` has 449 `term-*` ids; `js/rz-explain-db.js` has 1,020 entries; loaded on 102 of 181 root pages |
| Incident library | 43 dossiers in `data/incidents/` (`ls data/incidents/*.json \| grep -vc /_` = 43) with 228 references |
| Saved scenarios | 7 calculators save to Supabase `saved_scenarios` through `js/rz-scenario.js`; listed on `account.html` |
| Manuals | 42 pages under `manual/` |
| Supabase auth | `auth.js` lazy-loads Supabase (around :439) |

## 2. Existing but incomplete

| Capability | Gap | Evidence |
|---|---|---|
| Cross-linking | All 36 journal pages carry the same 6 template tool links. There are 0 article↔incident links. | Audit agent 2. To be re-counted in PRD-Q01 §3. |
| Incident library | 15 dossiers are still seed-only. Only 43 of the 113 candidates are built. | `grep -l 'seed — pending' data/incidents/*.json \| wc -l` = 15 |
| Indonesian | 3 pages. The glossary has 90 term matches against 449 in English. 0 English pages carry `hreflang="id"`. | `grep -c` on `id/glosarium.html` = 90; `grep -l 'hreflang="id"' *.html` = 0 |
| tools.html | Lists none of: cdu-calculator, chiller-plant, ltc-system-modelling-lab, EPMS_Telemetry | `grep -c` on tools.html = 0 for each. **CORRECTED:** the EPMS page is `EPMS_Telemetry.html`. |

## 3. Existing but defective

| Defect | Evidence |
|---|---|
| X4 random alarms in the datahall cockpit | `datahall.html:2085-2090` (`dhRand` on `Math.random`) |
| X6 "Live" title over a static snapshot | `pln-java-grid.html:1290`; data file header v2026-04-29 |
| X7 noindex prototype listed in the sitemap | `rz-cockpit-mockup.html` matches `sitemap.xml` 2 times |
| X8 duplicate Worker name | `worker/wrangler.toml` and `cf-worker/wrangler.toml` both set `name = "rz-finance-gateway"` |
| X12 placeholders | `dashboard.html:1306` toast "Account settings coming soon."; `all-in-one-dashboard.html:403` "Live demo coming soon"; `account.html:159` "Coming to your account" |
| X2, X3, X5, X9 | Owned by the peer (X2 is being fixed in v3.35.10) |

## 4. Mocked or hardcoded

| Item | Evidence |
|---|---|
| Admin KPIs and analytics | `rz-ops-p7x3k9m.html`: 5 matches for `generateUsers` / `seedUADemoData` |
| datahallAI status pill | `datahallAI.html:1363`: a hardcoded inline-styled pill |
| X1 Finnhub token fallback | `Apps/finance-terminal/index.html:4358`. **Security:** the owner must rotate the key. |
| Simulated-data labelling | **CORRECTED:** fuel-system (15 matches), dc-conventional (14) and cdu-mini-bms (11) all mention "simulat". Whether each page has a visible banner on every panel is to be re-measured in PRD-Q06 §3. The earlier "no banner" claim is not trusted. |
| LTC lab fallback | **CORRECTED:** `js/ltc-system-modelling-lab.js:2701-2706` falls back to the legacy model on an exception and logs `console.error`. It is not silent in the console, but it is silent on screen. |

## 5. Missing

| Capability | Evidence |
|---|---|
| Content relation data | `journal.json` and the dossier JSON have no `tools`, `incidents` or `terms` fields |
| Fault scenarios | No scenario data exists. Cockpit alarms are random. |
| Learning paths | None. **CORRECTED (PRD-Q17):** `achievements.html` is not orphaned (3 inbound links, in the sitemap). The real defect: `rz-gamification.js` loads on only 2 pages, so badges cannot be earned. |
| Air-side thermal transient model | **CORRECTED (PRD-Q07):** none exists (rz-engine and conv-engine have none; ltc-plant covers the liquid loop only). Q7 must add a minimum sourced model. |
| Incident aggregate view | **CORRECTED (PRD-Q18):** `dc-incidents.html` already has a library-wide FMEA view. It groups by first category only, and 5 categories have no label. No mode × cause matrix exists. |
| Server-side feature flags | `feature_overrides` is referenced only inside `js/rz-supabase.js` |
| Finance terminal sync | `rz-ft-sync.js` is loaded only by `Apps/second brain/codebase-graph.html` |
| Data refresh automation | The only workflow is `supabase-keepalive.yml` (Q8 belongs to the peer) |

## 6. Proposed improvements (this session's scope)

Q1, Q3, Q4, Q6, Q7, Q9, Q10, Q11, Q12, Q15, Q17, Q18, plus defects X1, X4, X6–X8 and X10–X12. See
`../01-improvement-register/REGISTER.md`.

## 7. Architectural dependencies

| Dependency | Source |
|---|---|
| Q3 needs the peer's scenario links | P2 |
| Q17 needs relations and scenario links | Q1 + P2 |
| Q18 builds on the relation file | Q1 |
| Q7 needs the provenance labels and the engine's thermal model | Q6 |
| Q12 must not start before the key is rotated | X1 |
| Q11 and Q10 need RLS-protected tables | Both change auth boundaries, so they need explicit owner approval per R111 |

## 8. Development in progress

| Work | Owner |
|---|---|
| v3.35.10: `openInCalc` for all 11 `data-rz-calc` pages (X2), full gate running | peer |
| PRD bundles A (Q6, Q4) and B (Q1, Q3) | this session, Opus agents |
| Workstream A (R001–R108) | complete, live |
