# Master implementation program: P-series, 2026-11-10

**Owner of these rows:** session "Cx/K-series" (this one). LTC owns the Q rows.

**Effort estimates.** Engineer-days, from the PRDs. They are estimates, labelled as such.

**Release discipline for every task:**
1. Ship gate (`tools/ship-gate.sh --probe`) green.
2. Push.
3. Live byte-compare.
4. IndexNow.
5. Standards docs and CHANGELOG updated in the same release.

## Wave 1: defects and foundations
| Task | Source | Depends | Files | Est | Verification | Done when |
|---|---|---|---|---|---|---|
| W1-1 X2 open routes | PX | — | rz-scenario.js, test-scenario-open-routes | done | RED 5 routes → GREEN | v3.35.10 live |
| W1-2 X3 tia theme + onclick gate | PX | — | tia page, test-calc-onclick-handlers | 0.5 | RED on tia → GREEN | live |
| W1-3 F1 calculator registry + gate | ARCH C1 | — | data/calculators.json, test-calculator-registry | 1 | gate RED on a planted bad selector | live |
| W1-4 F2 embed-compute module | ARCH C2 | W1-3 | js/rz-embed-compute.js, embed flag | 1 | unit fixture page | live |
| W1-5 P02 share links (+ 4 pages get rz-scenario) | P02 | W1-1 | rz-scenario.js, account.html, 4 pages | 2 | share E2E 11/11, security fixture | live |
| W1-6 P08 seeded uncertainty | P08 | — | rz-engine.js, 7 pages | 3 | determinism gate RED → GREEN | live |
| W1-7 P23 register CSS | P23 | — | 7 pages, gate | 0.75 | gate RED 7 → 0 | live |
| W1-8 P25 offline calculators | P25 | — | sw.js, register module, vendor Chart.js, 9 pages | 2.5 | precache gate, offline E2E 11/11 | live |
| W1-9 P16 version module | P16 | — | generator, 9 cockpits | 0.75 | freshness + fail-closed fixture | live |

## Wave 2: core journeys
| Task | Source | Depends | Est | Verification |
|---|---|---|---|---|
| W2-1 P01 stage 1 facility project | P01 | W1-3, W1-5 | 6 | journey gate, field-map gate |
| W2-2 P14 search + palette | P14 | W1-5 | 2.5 | coverage, freshness, query gates |
| W2-3 P15 part A activity history | P15 | W1-5 | 1.75 | unit + stub E2E |
| W2-4 P07 sensitivity + correctness gate | P07 | W1-4 | 3 | correctness gate on 8, panels on 3 |

## Wave 3: cross-module integration
| Task | Source | Depends | Est | Verification |
|---|---|---|---|---|
| W3-1 P03 compare | P03 | W1-4, W2-1 | 4 | A vs A zero-delta gate |
| W3-2 P04 report pack | P04 | W3-1 | 3.5 | number-compare gate |
| W3-3 P11 location dataset | P11 | W2-1 | 2.75 | consistency gate |
| W3-4 P26 part A as-of stamps | P26 | W3-3 | 1.25 | clock unit tests |
| W3-5 P13 hand-offs | P13 | W2-1, W1-3 | 2.5 | contract gate, E2E |
| W3-6 P17 manual links | P17 | W1-3 | 2 | link gate |
| W3-7 P06 stage 1 Cx records workspace | P06 | — | 4.25 | 13 law fixtures |
| W3-8 P12 schedule export | P12 | — | 2 | round-trip gate |

## Wave 4: advanced experience
| Task | Source | Depends | Est | Verification |
|---|---|---|---|---|
| W4-1 P05 stage 1 replay | P05 | message to LTC (Q6/Q7) | 4.25 | value-equality, no-network, exit gates |
| W4-2 P10 stage 1 calculator basis | P10 | — | 4.75 | parity + coverage (headline) |
| W4-3 P20 part A article embeds | P20 | W1-4, W1-5 | 3.5 | height + guard E2E |
| W4-4 P21 stage 1 grounded explain | P21 | W4-2 | 3 | 20/10 fixture |
| W4-5 P19 part A ESM build | P19 | — | 1 | parity gate |

## Wave 5: hardening
| Task | Source | Depends | Est | Verification |
|---|---|---|---|---|
| W5-1 P09 global map (analysis) | P09 | — | 1 | map report, then PRD revised to ≥ 4 |
| W5-2 P09 stages 1–2 | P09 | W5-1 | 3.5 | all datahallAI gates + LCP A/B |
| W5-3 P22 render scale gate | P22 | — | 1.75 | fixture + frozen baseline |

## Wave 6: final integration and acceptance
| Task | Verification |
|---|---|
| W6-1 Cross-module E2E journey | project → capex → roi → compare → pack → link → offline reopen |
| W6-2 Responsive sweep | 360/390/768/1280/1440, both themes, every new surface |
| W6-3 Console and error sweep | 0 pageerror on all touched pages |
| W6-4 Independent audit | 09-final-audit, run fresh against the PRDs, not this plan |

## Blocked: needs the owner

| Item | Needs |
|---|---|
| P24 | Decision: preview/Apply or direct + undo; 24 or 30 fps |
| P01 stage 2, P06 stage 2, P15 part B, P18 | Owner approval + applying the C7 SQL bundle |
| P19 part B | Owner decision on a public npm package |
| P20 part B | Decision on a third-party embed policy |
| P21 stage 2 | Approval of an LLM layer (key, cost, model) |
| P26 part B | Approval of a scheduled external fetch job |

**Totals.** Approved scope is about 70 engineer-days at the PRD estimates. That cannot be finished in one session, so the program runs wave by wave across sessions. Each task is closed only with evidence in TRACKER.md.
