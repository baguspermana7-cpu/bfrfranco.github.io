# Verified baseline, 2026-11-10 (P-series, owned by this session)

Re-checked against `main` at 803253314, plus the v3.35.10 working tree. The source audit is
`documentation/PRODUCT_INNOVATION_ASSESSMENT_2026-11.md`. The Q-series and the X-defect baseline
belong to the LTC session (addendum).

**Categories:** FUNCTIONAL, INCOMPLETE, DEFECTIVE, MOCKED, MISSING, PROPOSED, DEPENDENCY, IN-PROGRESS.

## Corrections to my own audit
The re-check overturned four of the audit's claims:

| Audit claim | Re-measured | Consequence |
|---|---|---|
| P7: "calculator users get no 'which input matters' view" | Tornado or sensitivity present on 8 of 11 calculators (capex, opex, tco, roi, carbon, cx, spares, tier). Absent on pue, tia, rfs. | P7 narrows to the 3 missing pages plus a correctness gate. |
| P8: "tco, roi, spares each carry their own Monte Carlo" | A shared seeded simulator already exists: `RZEngine.models.sim.monteCarlo` (rz-engine.js:12182). roi and tco call it and fall back to `Math.random` when it is absent. carbon (1619-1621) draws `Math.random` directly. | P8 becomes: every MC site uses the seeded simulator, and the random fallbacks go. |
| P11: "calculators take grid factor and tariff as free inputs" | carbon, opex and tco already have country selectors (`countrySelect`, `tcoCountry`/`tcoRegion`). pue has `greenGridLevel`. | P11 narrows to one shared, sourced location dataset in place of the per-page lists. |
| P16: "8 cockpits hardcode versions and fail closed" | Still true, but `tools/test-conv-engine-version-pins.mjs` (V1-V3) already turns a missed bump into a red gate instead of a blank site. | P16 drops to low value (removes chore, not outage). |

## Capability matrix (P ideas)

| ID | Category | Evidence |
|---|---|---|
| P1 shared project | MISSING | No project entity in `supabase/schema.sql`. `saved_scenarios(id,user_id,calc,name,payload jsonb ≤64KB,created_at)` has no project link. |
| P2 scenario links | INCOMPLETE → IN-PROGRESS | `openInCalc` was wrong for 5 of 11 calculators; fixed in v3.35.10 (X2). Still no shareable link. |
| P3 compare | MISSING | account.html has 0 compare references. |
| P4 report pack | INCOMPLETE | Each calculator has its own PDF builder; none of the 11 load `js/rz-pdf-export.js`. |
| P5 telemetry replay | MISSING | 6 cockpits are `data-rz-data-mode="simulated"`; there is no ingest path. |
| P6 Cx records | MOCKED | Records come from `data/cx/demo-records.json`. |
| P7 sensitivity | INCOMPLETE (8/11) | Shown in the matrix above. |
| P8 shared MC | INCOMPLETE / DEFECTIVE | Random fallbacks in roi and tco; direct random in carbon. tier and tia (X5) have random confidence bands. |
| P9 datahallAI weight | DEFECTIVE (perf) | 1,366,717 B, 47 script blocks. SEO #8 LCP 6.7 s. |
| P10 calculator basis | MISSING | 0 `data-basis-param` on all 11 calculators. |
| P11 location data | INCOMPLETE | Per-page country lists. Sources and dates not yet audited. |
| P12 schedule export | MISSING | No MSPDI/ICS writer (the "xer" hits are the word "exerciser"). |
| P13 lifecycle links + Q13/X9 | MISSING / DEFECTIVE | The spares query-string receiver has no sender. |
| P14 palette + Q2 | INCOMPLETE | `js/rz-command-palette.js` is on 48 of 181 pages. capex, tco and cx lack it. |
| P15 activity history | INCOMPLETE | `logEvent()` (rz-supabase.js:413) has 0 callers. `listAuditLog()` has 0 callers. The table and RPC exist with RLS (own rows, root all). |
| P16 version manifest | INCOMPLETE (mitigated) | See the corrections table. |
| P17 manual links | MISSING | — |
| P18 classroom | MISSING | The educator role exists (tier=pro); there are no assignment tables. |
| P19 engine package + Q14 | MISSING | No public calculation API exists. `worker/` and `cf-worker/` are finance gateways. |
| P20 embeds | MISSING | — |
| P21 assistant | MISSING | — |
| P22 scale auditor | MISSING | `audit-editorial-render.mjs` does not exist. |
| P23 register CSS | INCOMPLETE (needs re-measure) | 124 pages declare `data-rz-register` (71 editorial, 33 tool, 20 instrument). The rule sheets are spread over 8 files. The original "loaded by 3" claim was too coarse; P23 measures it per register. |
| P24 K22 items 8/9 | DEPENDENCY (owner) | — |
| P25 offline + Q16 | DEFECTIVE | `sw.js:56` `cache.addAll(...).catch(() => {})`: one failed URL leaves the whole precache empty and silent. No calculator page is precached. |
| P26 as-of stamps + Q8 | INCOMPLETE | The market tracker has 4 asOf references and 1 "as of H1 2026". There is no per-figure stamp. |
| X3 tia theme button | DEFECTIVE | `tia-942-checklist.html:197` calls an undefined `toggleCalcTheme()`. |

## Existing commitments (Workstream A, kept separate)
These stay tracked separately:
- K22 items 8 and 9 (owner).
- UIUX A = P22.
- UIUX B = P23.
- SEO #8 = P9.
- Owner tasks: O-PAT, O-ART, O-FIG, O-PRD38.
