# 09 — Final audit of the P-series (W6-4), written from the PRDs (2026-11-14)

Source of truth for each verdict: the PRD's own acceptance criteria (mapped in `0b-qa-review.md`), the TRACKER row
that records the live release and its byte-compare, and the Wave 6 sweeps (`W6-sweeps.md`). Nothing here is taken
from the close-out plan's wording. "Live" means rz-version and every deployable changed file were byte-compared
against resistancezero.com after the push.

| PRD | Verdict | Live evidence | Acceptance (0b) |
|---|---|---|---|
| P01 project | SHIPPED stage 1; stage 2 = owner SQL | v3.42.0, live re-checked v3.46.0 | 5/5 covered |
| P02 share links | SHIPPED | v3.36.0, live v3.46.0 | 5/5 covered (exact sentence not asserted) |
| P03 compare | SHIPPED | v3.43.0, live v3.46.0 | 3/3 covered |
| P04 pack | SHIPPED | v3.45.0, live v3.46.0 | structure covered (U12 added); numeral equality CAPEX only |
| P05 replay | stage 1 SHIPPED; stage 2 BLOCKED on LTC Q7 | v3.55.0 live 3a08a7588 | 2/2 covered |
| P06 Cx records | stage 1 SHIPPED; C3 intake in v3.61.0; S2 = owner SQL | v3.51.0 live fcd766dc1 | 3/3 covered |
| P07 sensitivity | SHIPPED | v3.40.0 | 4/4 covered |
| P08 seeded bands | SHIPPED | v3.36.0, live v3.46.0 | 3/4 covered (X1, X2 added); pre-change equality not verifiable |
| P09 per-tab load | IN PROGRESS: FR-P09-1/2 in v3.61.0; stages 1–2 not built | — | 0/2 (stages pending) |
| P10 basis drawer | stage 1 SHIPPED | v3.52.0 live 8cb492829; registry v3.57.0 live 5876563c6 | 2/2 covered |
| P11 locations | SHIPPED | v3.47.0 live ce7cdf454 | 2/2 covered |
| P12 schedule export | SHIPPED | v3.51.0 live fcd766dc1 | 1/1 covered |
| P13 hand-offs | SHIPPED; FR-P13-5 in v3.61.0 | v3.49.0 live b95b26943 | 3/3 covered |
| P14 palette | SHIPPED | v3.38.0, live v3.46.0 | 4/4 covered |
| P15 activity | part A SHIPPED; part B = owner SQL | v3.39.0, live v3.46.0 | 3/3 covered (A5 added) |
| P16 engine version | SHIPPED | v3.37.0 | 1/1 covered |
| P17 field help | SHIPPED | v3.44.0, live v3.46.0 | 1/1 covered (64 px position not asserted) |
| P18 classroom | NOT STARTED — owner approval | — | — |
| P19 engine package | NOT STARTED — owner approval | — | — |
| P20 embeds | part A in v3.61.0; part B = owner | — (ships v3.61.0) | 4/4 covered; frame guard deviates (link, not top navigation), recorded |
| P21 Ask | stage 1 SHIPPED | v3.53.0 live 3b4d7323e | 3/3 covered |
| P22 render scale | in v3.61.0 | — (ships v3.61.0) | 2/2 covered |
| P23 register CSS | SHIPPED | v3.36.0, live v3.46.0 | 1/1 covered |
| P24 Cx plan editor | BLOCKED — owner decision (option A/B) | — | — |
| P25 offline | SHIPPED | v3.37.0, live v3.46.0 | 4/4 covered |
| P26 data age | part A SHIPPED; part B = owner | v3.46.0 | 1/1 covered |

Cross-cutting: 13 shared seams each have a wired gate (`0c-cross-prd-seams.md`); the reader journey, the responsive
sweep (38 pages × 2 themes × 5 widths) and the console sweep (157 pages) pass (`W6-sweeps.md`).

Open, with the reason each is open:
- P09 stages 1–2 — move the three heaviest builders, then the rest; announced to LTC before each stage (datahallAI.html
  is shared with their Q6/Q7 work).
- P05 stage 2 — needs LTC Q7 (the cockpit telemetry seam).
- P04 numeral equality for the five non-CAPEX pack sections; P08 pre-change equality (no recorded baseline).
- Owner decisions: P18, P19, P24, P01/P06/P15 stage-2 SQL, P20 part B, P26 part B, P21 stage 2, O-P11 tariffs, and
  revoking the GitHub token pasted in chat on 2026-11-05 (O-PAT).
- Finding outside the P surfaces: EPMS_Telemetry.html carries 82 px of hidden overflow at 1280 px (W6-sweeps.md).
