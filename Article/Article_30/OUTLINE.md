# Article 30 — Outline
## Is "Agentic AI" a Fraud? What an Agent Actually Is, From Token Prediction to a Software Factory

**Reader journey:** the reader has read article 29 (how an LLM works) and has seen, or been forwarded, John Elder's video.
They leave able to (1) say exactly which parts of the "fraud" argument are correct, (2) describe an agent as a control
loop with a probabilistic planner and deterministic executors, (3) estimate an agent's reliability and cost before
building it, and (4) answer "put an agent on the BMS" with a safe architecture. Each H2 opens with a plain-language
paragraph, then evidence, then the engineering consequence. Figures D1–D8 in DIAGRAMS.md; calculators C-i–C-iv in
CALCULATORS.md; citations `[Sn]` in RESEARCH.md §9.

Tone: steelman the critic first, then test each claim. No "fraud" or "revolution" in the author's own voice. State the
disclosure (Claude-assisted; several Anthropic sources) near the top.

Target length: about 6–8k words (owner to confirm). Cross-links: article 29 §2.7 (sampling), §4.6 (RL), §8 (agents
basics); the DC AI cockpit; incident dossiers (for "codify what repeats").

---

### H2 1. The claim, in his words
- Who, when, what: video 2026-08-27, 11 min 27 s [S1]; the 14 claims table (RESEARCH §1.2), quoted with timestamps.
- The description concedes "The language model is AI" while the video says "no AI involved whatsoever" [S1].
- Commercial context stated neutrally: he sells agent-building courses and a book [S1][S2].
- Key claim: the critique bundles three different kinds of statement — mechanism, economics, naming — and they need different evidence.

### H2 2. Where he is right: the mechanism
- H3 2.1 Token by token (one paragraph, link to A29 §2.7).
- H3 2.2 The model never runs anything: vendor docs quoted [S15][S16]. D1 top half.
- H3 2.3 No calculator, no encyclopaedia, no weight updates at inference.
- Key claim: E1, E4, E5-generic SUPPORTED.

### H2 3. Where the absolutes break: "no reasoning, no maths"
- H3 3.1 Inside 36+59: two pathways, lookup features, and the model's false account of "carrying the 1" [S3][S4].
- H3 3.2 Dallas → Texas → Austin and the rhyme planned before the line [S3][S4]; method caveats [S4].
- H3 3.3 Reasoning models: RL on verifiable rewards [S8].
- H3 3.4 The strongest case against: stochastic parrots [S9], GSM-Symbolic "up to 65%" [S7], Illusion of Thinking [S5] and its rebuttal [S6], ARC-AGI-2 gap [S11][S12], Sutskever on generalisation [S54].
- H3 3.5 An operational definition of "reasoning", and the verdict: computation yes, reliability and self-knowledge no.
- Key claim: E2/E3 PARTLY; design rule = "treat output as a proposal checked by something deterministic".

### H2 4. What an agent actually is
- H3 4.1 Division of labour in one step (RESEARCH §3.2 table); the PLC analogy.
- H3 4.2 The restaurant demo, re-examined: Operator used a vision browser agent, not an API script [S58]. D1 bottom half.
- H3 4.3 History: thermostat-as-agent [S21], cron/RPA/expert systems, ReAct [S18], Toolformer [S17], MCP [S19]. What is old, what is new.
- H3 4.4 The spectrum: workflow vs agent [S14]; six levels [S20]. D3.
- Key claim: E6 UNSUPPORTED, E7 PARTLY; C2 SUPPORTED.

### H2 5. Does it work? The measured record
- H3 5.1 Coding benchmarks and their decay: SWE-bench Verified 79.2% and its retirement [S22][S23][S24]; Terminal-Bench 2.0 ≈85%, harness effects [S25].
- H3 5.2 Time horizons: 17 h at 50%, 3 h at 80% [S27]; doubling ≈4 months [S26]. Why the gap is the story.
- H3 5.3 Developers: the 19% slowdown and why METR withdrew it as current [S28][S29].
- H3 5.4 Compounding error, with C-ii embedded; D6.
- Key claim: E11 PARTLY; reliability, not capability, is the binding constraint.

### H2 6. How agents fail
- Prompt injection via tool output [S31]; OWASP Agentic Top 10 [S32]; simulated misalignment with its caveat [S30]; unfaithful self-reports [S3]; loops and quadratic cost (C-iii).
- Key claim: every listed failure is mitigated by a check outside the model.

### H2 7. Follow the money: the "IPO story" claim
- H3 7.1 Capex ≈ $0.7T in 2026 from four firms [S40]–[S45]; debt and negative FCF signals [S40][S44]. "$3T" unverified.
- H3 7.2 Revenue and rounds: $65B / ≈$50B run-rates [S46][S47]; $122B and $65B rounds [S48][S51]; draft S-1 [S49]; OpenAI IPO deferred [S52]; bear valuation view [S50].
- H3 7.3 The "wall": Sutskever [S53][S54], data limits (A29 §9), and why agents are the new scaling axis.
- H3 7.4 Who actually left, and why: LeCun [S55]; Jumper moved labs [S57]; 2026 safety departures [S56]; Pachocki stayed [S63]. D7.
- H3 7.5 Enterprise reality: NANDA's 95% and its method [S37][S38]; Gartner's >40% and "agent washing" [S39].
- Key claim: E9 UNSUPPORTED; E12 PARTLY; E13 UNSUPPORTED; but marketing inflation is real (C6 caveat).

### H2 8. The name: is it "AI", is it an "agent"?
- Definitions table (RESEARCH §5). Elder's rename vs "LLM-orchestrated automation". The CISA page title oddity (cite the PDF).
- Key claim: the dispute is definitional; regulators regulate the system, not the label [S33].

### H2 9. The engineering stance
- H3 9.1 Agent or script? Decision table + C-i embedded.
- H3 9.2 Reference architecture: planner → typed interface → executors → verifiers → human gate → log; D2, D5.
- H3 9.3 Worked example: the factory (roles, hard gates, fix-round caps, re-gated merge, opt-in push) [S60]; the one demo job [S61]; C-iv embedded; D4. What no gate catches.
- H3 9.4 Budgets: C-iii embedded.

### H2 10. "Put an agent on the BMS": a checklist for operations
- The 10-point list (RESEARCH §6.4) with CISA principles [S33], NIST AI RMF [S34], ISO/IEC 42001 [S35], IEC 62443/61511 [S36], OWASP [S31][S32]. D8.
- Good first targets: alarm-flood summaries, CMMS drafting, MOP retrieval, shift handover notes. Out of scope: setpoints, sequences, safety functions.

### H2 11. Verdict
- One paragraph per side; the graded tables (RESEARCH §7.1, §7.2) as a collapsible summary.
- Closing line candidate: "The model is a guessing engine. Engineering is deciding which guesses get to touch the plant."

---

## Glossary terms to define (RZExplain keys)
agent (Russell & Norvig), agentic system, workflow (Anthropic sense), agent loop, tool calling / function calling, client
tool vs server tool, tool_result, harness, orchestrator, router, ReAct, Toolformer, MCP, computer-using agent (CUA),
RPA, expert system, attribution graph, circuit tracing, feature (interpretability), chain-of-thought faithfulness,
reasoning model, test-time compute, RLVR, GSM8K / GSM-Symbolic, ARC-AGI, pass@k, SWE-bench Verified / Pro, Terminal-Bench,
time horizon (50% / 80%), METR, RCT, contamination, compounding error, verifier / oracle, hard gate, human-in-the-loop,
prompt injection (direct / indirect), least privilege, sandbox, agentic misalignment, agent washing, run-rate revenue,
capex, finance lease, S-1 (confidential draft), OT, IT/OT DMZ, IEC 62443 zone and conduit, SIS (IEC 61511), NIST AI RMF,
ISO/IEC 42001.

---

## Claims I could NOT verify (must stay marked or be cut)
1. Elder's "$3 trillion of compute" (no source; big-four 2026 capex ≈ $0.7T is the nearest sourced figure).
2. Whether OpenTable was a named Operator launch partner (TechCrunch lists six others) [S58].
3. Exact text of Gartner's 2025-06-25 release beyond its headline: the ≈130 "real" agentic vendors, the 15%/33% 2028 forecasts, the poll figures (page 403) [S39].
4. OpenAI's SWE-bench Verified audit percentages (59.4% of a 27.6% subset; ~70%→~23% on Pro) — page 403; via Decrypt and snippets [S23][S24].
5. Anthropic 2025 revenue $4.6B and net loss $42B (leaked prospectus via Reuters via CNBC) [S50]; the reported $2T IPO target.
6. ARC-AGI-2 2026 scores (Kaggle ≈88%, aggregator 92–95%) — search snippets only [S13].
7. DeepSeek-R1 AIME figures (15.6% → 71.0%, R1 79.8%) — from the paper, not re-read [S8].
8. Stochastic-parrots quote wording (ACM 403) [S9]; Russell & Norvig wording [S21]; NIST AI RMF function names [S34]; ISO/IEC 42001 scope [S35]; IEC 62443/61511 content [S36] — background, not re-read.
9. Current GAIA and τ-bench leaderboard values (not read).
10. Absence of any securities-fraud complaint or regulator action about "agentic AI" marketing (negative result of a limited search).
11. Jakub Pachocki's current title (OpenAI page 403; co-authorship seen in a listing) [S63].
12. Factory per-gate catch rates — only one demo job exists [S61]; C-iv values are assumptions.
13. Microsoft's capex basis (calendar vs fiscal year; the $190B → $175B accounting restatement) as reported by Business Insider, not read in Microsoft's filing [S41].
