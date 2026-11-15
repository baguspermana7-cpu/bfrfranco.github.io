# 0b — QA review: every acceptance criterion of the shipped P PRDs against a gate (2026-11-14, branch rel359)

Method: the "Acceptance criteria" bullets of every PRD (76) were extracted by script; each was matched to a check in a
gate by reading the gate's header and grepping its body (not from memory). A criterion counts as COVERED only when a
named check asserts the same thing and the gate runs in `ship-gate.sh`. The re-run is the v3.61.0 full gate.

| PRD | Criterion (short) | Gate · check | Verdict |
|---|---|---|---|
| P01 | tco IT load from project, tagged | test-project-ui E2 (opex) / journey-w6 J2 (roi) | COVERED (tco field name checked by test-project-ui map) |
| P01 | roi Total CAPEX from capex, tagged | test-project-ui E3, test-journey-w6 J2 | COVERED |
| P01 | IT load change → "out of date" | test-project-ui E5 | COVERED |
| P01 | user edit kept as "overridden" | test-project-ui E4 | COVERED |
| P01 | no project → defaults | test-project-ui E11 | COVERED |
| P02 | 11 calculators, fresh-context link equal | test-scenario-share-links E | COVERED |
| P02 | non-capturable ids ignored | test-scenario-share-links S/U | COVERED |
| P02 | malformed link → alert, defaults kept | test-scenario-share-links C | COVERED (asserts role=alert + defaults; the exact sentence is not asserted) |
| P02 | account Copy link reproduces | test-scenario-open-routes | COVERED |
| P02 | unknown calc → no navigation | test-scenario-open-routes | COVERED |
| P03 | A vs A deltas 0 / attribution / failed column | test-compare-ui U3, U4, U5 | COVERED |
| P04 | 6 calculators: cover, register, 6 sections, appendix, numerals equal | test-pack-ui U12 (added), U3 | CLOSED for structure: six sections with numbers, cover, register, appendix (red when one section fails to load). Numeral equality with the live page is asserted for CAPEX only (U3) |
| P04 | stale section line / failed calculator section | test-pack-ui U6, U5 | COVERED |
| P05 | replay value + REPLAY strip; exit restores | test-datahall-ai-replay-runtime B1–B10 | COVERED |
| P06 | R4 refusal, blocked L3, export/import deep-equal | test-cx-workspace-ui W1–W4, export→import | COVERED |
| P07 | pue bars = page recompute ±10 % | test-sensitivity U2 | COVERED |
| P07 | tco tornado within display rounding | test-tornado-correctness T1 | COVERED (my first grep looked only in test-sensitivity) |
| P07 | stalled factor "could not compute" / cancel → partial | test-sensitivity U1 (fixture) | COVERED (fixture cancels after 2, not 3 of 8) |
| P08 | 0 Math.random; same band twice | test-seeded-uncertainty S1, S2, R (7 pages run twice, identical text with a seed) | COVERED |
| P08 | tier band text "assumed score spread"; engine missing → no band numerals | test-seeded-uncertainty X1, X2 (added) | CLOSED — red when the word is dropped / when the fallback prints numbers |
| P08 | roi P5/P50/P95 equal the pre-change values | — | NOT VERIFIABLE NOW — the pre-P08 values were never recorded; R pins the band to identical text across fresh loads instead |
| P09 | LCP / identical diagrams | — | NOT YET — stages 1–2 not built (FR-P09-1/2 done) |
| P10 | drawer value = rendered, formula, engine fn | test-calc-parameter-registry B-checks | COVERED |
| P10 | hooked id with no record fails the gate | test-calc-parameter-registry B2 (page hooks must equal the records) | COVERED — proven 2026-11-14: a planted `calc.carbon.no_such_record` hook turns B2 red (`extra calc.carbon.no_such_record`) |
| P11 | same price + source line; ASSUMED shown | test-locations-ui L1, L2 | COVERED |
| P12 | MSPDI task count + durations | test-cx-export-schedule U1–U2 | COVERED |
| P13 | tier → spares; ?tier=7 ignored; gap twice → one issue | test-handoff-contract H1, H4; test-handoff-cx U2/U3 | COVERED |
| P14 | Ctrl+K, "ovh" top 3, Copy link action, stale index fails | test-search-palette S3, S4; test-generator-freshness | COVERED |
| P15 | log_event once on save; 5 rows newest first | test-activity-log A1–A3 | COVERED |
| P15 | RPC rejects → save still succeeds | test-activity-log A5 (added) | CLOSED — rejected / thrown / `{error}` log write: save reads "Saved", nothing unhandled; red when the save awaits `logEvent` unguarded |
| P16 | engine bump renders without other edits | test-conv-engine-version-pins | COVERED |
| P17 | "?" opens the manual section, Back works | test-manual-links M2–M3 | COVERED (the 64 px heading position is not asserted) |
| P18, P19, P24 | — | — | BLOCKED on the owner (not built) |
| P20 | input updates result, no scrollbar 360 px; 8 s fallback; Open full calculator | test-embed-article A1–A7 | COVERED on article-7/19/23 (the PRD named article-12, which has no matching calculator) |
| P20 | cross-origin parent → navigate top | test-embed-article A6 | DEVIATION, recorded in PRD-P20: Chrome blocks cross-origin top navigation, so the page renders a link and posts nothing |
| P21 | PUE question cites pue.design_day; honest miss; index fail + Retry | test-explain-ask N4, N5, B3–B4 | COVERED |
| P22 | 17.3 px reported; tree passes, +1 element fails | test-audit-editorial-render E1, E4 | COVERED |
| P23 | data-rz-register pages load the rules | test-register-css | COVERED |
| P25 | SW controls; offline renders + computes + chart; bad precache path fails; sw-kill | test-offline-calculators O1–O4; test-sw-precache W1–W6 | COVERED |
| P26 | markets 2026-07 at 2027-02 → amber | test-asof A3, A5 | COVERED |
| PX | tia theme toggle + no flash | test-tia-theme T1–T3 (added) | CLOSED — red when the head theme script is removed (data-theme null at <body>) |
| PX | onclick handlers resolve | test-calc-onclick-handlers | COVERED |

Gaps closed 2026-11-14 (each red before green): P04 six-section pack (U12), P10 unknown hook (B2, already there),
P15 failing log write (A5), PX tia theme (test-tia-theme), P08 tier text + engine missing (X1, X2). P07 tco was covered
(test-tornado-correctness T1). Open with reason: P08 pre-change equality (no recorded baseline), P04 numeral equality
for the five non-CAPEX sections, P09 (stages not built), P18/P19/P24 (owner).
