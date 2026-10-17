# Article 30 prose batch notes

Word counts (visible text; prose-only excludes tables, formulas, chart JSON):

| File | id | All | Prose only |
|---|---|---|---|
| sec-01 | claim | 1044 | 732 |
| sec-02 | right | 841 | 841 |
| sec-03 | absolutes | 1445 | 1445 |
| sec-04 | agent | 1216 | 1108 |
| sec-05 | record | 1110 | 1005 |
| sec-06 | failure | 836 | 697 |
| sec-07 | money | 1471 | 1270 |
| sec-08 | name | 597 | 431 |
| sec-09 | stance | 1567 | 1258 |
| sec-10 | bms | 972 | 871 |
| sec-11 | verdict | 1010 | 497 |
| Total | | 12109 | 10155 |

OVER the 6-8k target (prose ~10.2k, with tables ~12.1k). Cut candidates: sec-03 3.4 bullets, sec-07 7.4/7.5, sec-09 9.3 prose, sec-04 4.3.

[Sn] cited per section: 01: 1,2,3,4,14,30,49 | 02: 1,4,15,16,17,20 | 03: 3-13,54 | 04: 1,14-21,58 | 05: 14,22-29 | 06: 3,30-32 | 07: 1,23,25-29,37-57,62,63 | 08: 1,14,16,20,21,33,37,39 | 09: 14,31-33,60,61 | 10: 31-36 | 11: summary tables.

Placeholders: agentic-d1 and d3 (sec-04), d6 (sec-05), d7 (sec-07), d2, d5, d4 (sec-09), d8 (sec-10). D1 placed once, in sec-04 (4.2), not split across sec-02/04; sec-02 refers forward to it. Calculators: reliability (sec-05, 5.4), decide, ladder, budget (sec-09, 9.1/9.3/9.4). Charts: one, in sec-05 (METR 50 vs 80, basisTag published). Placeholder attr is `data-agent-calc` as instructed (the Standard text says llm-calc).
Insight boxes: one per section (sec-01 uses it for the disclosure).

Claims kept but labelled "reported, unverified": E8 $3T; SWE-bench audit percentages (59.4% of 27.6%, 70%->23%) [S23][S24]; ARC-AGI-2 2026 scores (mentioned only as not used) [S13]; DeepSeek-R1 AIME 15.6/71.0/79.8 [S8]; stochastic-parrots wording (not re-read) [S9]; Russell and Norvig wording [S21]; Anthropic 2025 $4.6B/-$42B and $2T target [S50]; Pachocki title [S63]; OpenTable partner status [S58]; Microsoft capex basis/restatement [S41]; Gartner detail (headline only) [S39]; NIST function names, ISO 42001, IEC 62443/61511 (not re-read); no securities-law action (negative result of a limited search); factory per-gate catch rates (assumptions).
Dropped: GAIA and tau-bench leaderboard values (not read); Gartner's ~130 vendors and 15%/33% forecasts; Sutskever SSI founding detail.
Style checks: no "fraud"/"revolution" in author voice (only inside quotations and the video title); no inline style; no emoji; no stat tiles.
Glossary slugs used: all requested slugs are linked: agent agentic-system workflow agent-loop tool-calling harness orchestrator react mcp computer-using-agent rpa expert-system attribution-graph circuit-tracing chain-of-thought-faithfulness reasoning-model test-time-compute rlvr gsm-symbolic arc-agi pass-at-k swe-bench time-horizon metr compounding-error verifier hard-gate human-in-the-loop prompt-injection least-privilege sandbox agentic-misalignment agent-washing run-rate-revenue ot iec-62443 sis nist-ai-rmf iso-42001. capex is in sec-07.
