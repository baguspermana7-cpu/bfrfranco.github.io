# Article 30 calculators — notes

Files: `js/rz-agent-calc.js` (`window.RZAgentCalc`), `tools/test-agent-calc.mjs`, fragments `calc-{decide,reliability,budget,ladder}.html`, `explain-extra-agent.json` (26 `agent-*` keys, to be merged into `tools/explain-extra.json`).

Load order on the page: `js/rz-calc-utils.js`, then `js/rz-agent-calc.js`. Mount points `<div class="agent-calc" data-agent-calc="decide|reliability|budget|ladder">` are already in sec-05 and sec-09; the fragments contain the same mount, so the assembler must splice a fragment OVER the bare `<div>` (not alongside it) or the calculator mounts twice (the double-init guard is per element, not per kind).

Spec ambiguities resolved:
- C-i overrides: E=5 & Vf<=2 caps the score at 25, so it can never reach Agent; it is shown as a red flag only. L=1 gives a score up to 50 (could be Hybrid), so it forces "Script / workflow". V<=2 forces Script. Output has both `band` (from the score) and `decision` (after overrides).
- C-i rationale: the largest of the three losses 1-N, Risk, 0.5*Lp (ties: Risk, then N, then latency); wording changes when the decision is Agent.
- C-ii: spec's "Retries" column is n*(E-1); cost/run is the upper bound n*E*cost_att. Silent (Pu) and detected (Px) failure are per-step, as specified. Prices come from constants only (not inputs). Added input `target` (default 0.9) for p_needed.
- C-iii: S_policy is not in the spec's input list; added as an input, default 100 (so the worked example still gives 27, wall clock). Per-step timeout multiplier (3) is an input. g min is 1 (S_ctx divides by g). S_cost is floored with a correction loop against Cost(S); the continuous root is also output (34.0, 81.4). The "cost-vs-step curve" is rendered as five result rows (Cost at 10/20/30/40/60 steps), not a chart, to avoid injecting colours. c0 must be below 80% of the window.
- C-iv: variable-length gate list implemented as 7 fixed slots (name, catch rate, shares-family yes/no, hard/advisory); an unused slot has catch rate 0 and an empty name. Coverage is shown in percent, marginal value in percentage points. Gate-shared defaults to "no" in both presets (spec examples 1 and 3 are independent; example 2 toggles the LLM review). Hard/advisory only affects the drawn ladder text (solid/dashed), not the arithmetic.
- Fragments: spec says one plain paragraph; sec-09 already shows each formula in a `<pre>`, so the fragment paragraph repeats it inline once.
