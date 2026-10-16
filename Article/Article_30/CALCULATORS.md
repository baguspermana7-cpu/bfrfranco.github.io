# Article 30 — Calculator Specifications

Four embedded calculators. Source tags `[Sn]` resolve in `RESEARCH.md` §9. Every worked example below was run through the
formulas in Python on 2026-10-16 and the printed values are that run. Implementation notes for the site: use
`js/rz-calc-utils.js` (`window.RZCalc`) for validation and CSV export, RZExplain `data-explain` keys for tooltips, and a
basis chip on every output ("model — illustrative", "list price on 2026-10-16", "assumption — user-set"). Calculators i and
iv are **judgement aids**, not measurements: their weights are the dossier's design choices and must be labelled so.

Shared constants (one JS object, each entry with `source` + `asOf`):

| Key | Value | Unit | Source |
|---|---|---|---|
| `price.in` | 2.00 | $ per 1M input tokens | A29 [S27] via [S59] (Sonnet-class list price, 2026-10-16) |
| `price.out` | 10.00 | $ per 1M output tokens | same |
| `price.cacheReadFrac` | 0.10 | fraction of input price | A29 [S27] via [S59] (cache reads 2.5–10% across vendors; 10% used) |
| `ttft` | 0.5 | s | assumption (A29 §8.2) |
| `tpot` | 0.020 | s per output token | assumption (A29 §8.2) |
| `ctxWindow` | 200,000 | tokens | assumption (common default; 1M windows exist, A29 §8.5) |
| `metr.p50_vs_p80` | Mythos 1,045 vs 186 min; Opus 4.6 719 vs 70 min | min | [S27] — used as a caption, not a constant |

---

## C-i — "Agent or script?" decision scorer

**Purpose.** Turn the decision table of RESEARCH §6.1 into a transparent score so a reader can see *why* a task lands on
"script", "hybrid" or "agent".

**Inputs** (integer sliders 1–5, default 3):

| Input | 1 means | 5 means |
|---|---|---|
| `V` variability of input | fixed format, rule fits on a page | free text, screenshots, logs, never the same twice |
| `E` cost of an error | trivial, reversible | safety, money or outage; irreversible |
| `Vf` verifiability | no mechanical check exists | a deterministic oracle exists (tests, schema, simulator) |
| `F` frequency | rare | many times per day |
| `L` latency budget | sub-second / real-time | minutes or more |

**Formulas.**
```
N    = (V − 1) / 4                       need for language understanding, 0..1
Risk = ((E − 1) / 4) · (1 − (Vf − 1) / 4) residual risk after verification, 0..1
Lp   = (5 − L) / 4                       latency penalty, 0..1
Score = 100 · N · (1 − Risk) · (1 − 0.5·Lp)
```
**Bands.** Score < 35 → **Script / workflow** (deterministic code; LLM optional at design time). 35 ≤ Score < 65 → **Hybrid**
(LLM classifies/extracts/drafts; deterministic code validates and executes; human approves side effects). Score ≥ 65 →
**Agent loop with verifiers** (LLM chooses steps; every action checked by the oracle; budgets enforced).

**Hard overrides (applied after the score, shown as red flags):**
1. `E = 5` and `Vf ≤ 2` → "No autonomous action. LLM may propose; a human executes through the existing control system"
   (CISA AI-in-OT HITL principle [S33]).
2. `L = 1` → "Real-time path: not an LLM" (decode latency, A29 §6).
3. `V ≤ 2` → "Script" regardless of score.
4. `F ≥ 4` and `V ≤ 3` → note "Codify: once the agent's path is stable, replace it with a script."

**Rationale text** is generated from the largest of the three factors (e.g. "Low score because errors are costly and hard to
check (Risk = 0.75)").

**Worked examples (run):**

| Task | V,E,Vf,F,L | N | Risk | Lp | Score | Result |
|---|---|---|---|---|---|---|
| BMS alarm triage summary for the shift lead | 4,4,3,5,3 | 0.75 | 0.375 | 0.50 | 35.2 | Hybrid (just) |
| Code change with a test suite | 4,2,5,3,5 | 0.75 | 0.000 | 0.00 | 75.0 | Agent + verifiers |
| Monthly PUE report from the historian | 1,2,5,2,5 | 0.00 | 0.000 | 0.00 | 0.0 | Script (override 3) |
| Chiller setpoint write | 3,5,2,4,2 | 0.50 | 0.750 | 0.75 | 7.8 | Script + red flag 1 |
| CMMS work-order drafting from technician notes | 5,2,3,4,4 | 1.00 | 0.125 | 0.25 | 76.6 | Agent (drafts only write a ticket) |
| MOP/SOP lookup Q&A | 5,3,3,4,4 | 1.00 | 0.250 | 0.25 | 65.6 | Agent (read-only) |

Check (BMS row): Risk = 0.75 × (1 − 0.5) = 0.375; 100 × 0.75 × 0.625 × (1 − 0.25) = 35.16.

---

## C-ii — Agent run cost and reliability estimator (compounding error)

**Purpose.** Show why a 95%-per-step agent fails most 20-step runs, and how a verifier with retries changes that.

**Inputs (defaults):** steps `n` = 20 (1–200); per-step success `p` = 0.95 (0.5–0.9999); verifier detection rate `d` = 0.9
(0–1; 0 = no verifier); retries per step `k` = 2 (0–5); input tokens per attempt `Tin` = 40,000; output tokens per attempt
`Tout` = 800; prices from constants; cached input share `c` = 0 (0–0.95).

**Model (independent steps).** Each attempt: good with probability p; bad-and-detected with q = (1−p)·d (→ retry); bad-and-
undetected with (1−p)(1−d) (→ silent failure). With up to k retries (k+1 attempts):
```
q   = (1 − p) · d
E   = (1 − q^(k+1)) / (1 − q)              expected attempts per step (E = 1 when q = 0)
Ps  = p · E                                  step succeeds
Pu  = (1 − p)(1 − d) · E                     step fails silently
Px  = q^(k+1)                                step exhausts retries (detected failure)
check: Ps + Pu + Px = 1
P_run      = Ps^n
retries    = n · (E − 1)
cost_att   = Tin·[(1−c)·price.in + c·price.in·price.cacheReadFrac]/1e6 + Tout·price.out/1e6
cost_run   = n · E · cost_att                (upper bound: assumes the run is not aborted early)
cost_per_success = cost_run / P_run          (if a failed run is restarted from scratch)
p_needed(target, n) = target^(1/n)
```
Display both "silent failure" (Pu-driven, dangerous) and "detected failure" (Px-driven, safe) because they have different
operational meaning.

**Worked examples (run, c = 0, cost_att = 40,000×2/1e6 + 800×10/1e6 = $0.088):**

| n | p | d | k | E | Ps | P_run | Retries | Cost/run | Cost/success |
|---|---|---|---|---|---|---|---|---|---|
| 20 | 0.95 | 0 | 0 | 1.00000 | 0.95000 | **0.3585** | 0 | $1.760 | $4.910 |
| 20 | 0.95 | 0.9 | 2 | 1.04703 | 0.99467 | **0.8987** | 0.94 | $1.843 | $2.050 |
| 50 | 0.99 | 0 | 0 | 1.00000 | 0.99000 | 0.6050 | 0 | $4.400 | $7.273 |
| 50 | 0.99 | 0.9 | 2 | 1.00908 | 0.99899 | 0.9507 | 0.45 | $4.440 | $4.670 |
| 10 | 0.90 | 0.95 | 3 | 1.10488 | 0.99439 | 0.9453 | 1.05 | $0.972 | $1.029 |
| 100 | 0.99 | 0 | 0 | 1.00000 | 0.99000 | 0.3660 | 0 | $8.800 | $24.042 |
| 100 | 0.999 | 0 | 0 | 1.00000 | 0.99900 | 0.9048 | 0 | $8.800 | $9.726 |

Required per-step success for a 90% run: n = 10 → 0.98952; 20 → 0.99475; 50 → 0.99790; 100 → 0.99895. For 50%: 0.93303,
0.96594, 0.98623, 0.99309.

**Lesson printed under the output:** "A verifier that catches 90% of bad steps raises a 20-step run from 36% to 90% for 5%
more tokens. The cheapest reliability is a deterministic check, not a bigger model."
**Caveats shown:** independence is optimistic (errors correlate); a model-based verifier may share the generator's blind
spots; METR's 50%-vs-80% horizon gap is the empirical version of this curve [S27].

---

## C-iii — Tool-loop budget planner

**Purpose.** Set `max_steps`, timeouts and a cost cap before the run, from the three limits that actually bind: money, wall
clock and context window.

**Inputs (defaults):** initial context `c0` = 20,000 tokens; context growth per step `g` = 3,000 (tool results + history);
output per step `o` = 800; cost cap `C` = $5.00; wall-clock cap `Tw` = 600 s; tool latency `tt` = 5 s; TTFT, TPOT, prices,
window W and cached share `f` (default 0) from constants; compaction threshold 80% of W.

**Formulas.**
```
input tokens to step S (cumulative) = S·c0 + g·S(S−1)/2           (context re-sent each step)
pin_eff = price.in·(1−f) + price.in·price.cacheReadFrac·f
Cost(S) = pin_eff·[S·c0 + g·S(S−1)/2]/1e6 + price.out·S·o/1e6
S_cost  = largest S with Cost(S) ≤ C:  solve a·S² + b·S − C = 0,
          a = pin_eff·g/2/1e6,  b = (pin_eff·(c0 − g/2) + price.out·o)/1e6
t_step  = ttft + o·tpot + tt
S_time  = floor(Tw / t_step)
S_ctx   = floor((0.8·W − c0)/g) + 1          (step at which compaction/summarisation is needed)
max_steps = min(S_cost, S_time, S_ctx, S_policy)
per-step timeout = 3 · t_step  (suggested; user-editable)
```
Output: the binding limit highlighted, a cost-vs-step curve (quadratic), and the step at which compaction must run.

**Worked example (run, f = 0):** Cost(10) = $0.75, Cost(20) = $2.10, Cost(30) = $4.05, Cost(40) = $6.60, Cost(60) = $13.50.
S_cost = 34.0 → 34 steps. With 90% cached input, pin_eff = $0.38/M and S_cost = 81.4 → 81 steps. t_step = 0.5 + 800×0.02 + 5 =
21.5 s → S_time = floor(600/21.5) = 27. S_ctx = floor((160,000 − 20,000)/3,000) + 1 = 47. **max_steps = 27 (wall clock binds)**;
per-step timeout ≈ 65 s. Context at step 27 = 20,000 + 26×3,000 = 98,000 tokens.
Note in the UI: "Cost grows with the square of the step count because every step re-reads the history. Caching changes the
slope, not the shape."

---

## C-iv — Verification-ladder coverage score (optional)

**Purpose.** Let a reader see how much each gate in a pipeline contributes, and why stacking *independent* gates beats one
strong one. Catch rates are **user assumptions**; no measured per-gate catch rates were found for LLM pipelines, and the
factory has run one demo job only [S61].

**Inputs:** a list of gates, each with a catch rate `dᵢ` (0–1) and a toggle "same model family as the generator" with a
correlation factor `ρ` (default 0.5). Default ladder (illustrative, labelled ASSUMPTION): tests 0.60, lint 0.10, type check
0.15, LLM code review 0.50, human gate 0.50.

**Formulas.**
```
d_eff,i = dᵢ · (1 − ρ)   if the gate shares the generator's model family, else dᵢ
P_escape = Π (1 − d_eff,i)
Coverage = 1 − P_escape
Marginal value of gate j = P_escape(without j) − P_escape(with j)
Hard gates (cannot be overridden) are drawn as solid rungs; advisory gates as dashed.
```

**Worked examples (run):**
- Default ladder, independent: P_escape = 0.4 × 0.9 × 0.85 × 0.5 × 0.5 = 0.0765 → coverage 92.35%.
- Same, LLM review correlated (ρ = 0.5 → d_eff = 0.25): P_escape = 0.4 × 0.9 × 0.85 × 0.75 × 0.5 = 0.11475 → coverage 88.5%.
- Factory-shaped ladder (tests 0.6, lint 0.1, tests_added 0, security review 0.4, code review 0.4, ux 0.2, ui 0.2):
  P_escape = 0.082944 → coverage 91.7%. Preset mirrors the factory's gate order [S60]; values are not measured.

**Caption:** "These numbers are what-ifs. The structural lesson holds regardless of the values: an escaped defect has to get
past every rung, so add rungs that fail for *different* reasons."
