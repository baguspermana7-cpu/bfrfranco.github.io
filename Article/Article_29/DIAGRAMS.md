# Article 29 — Diagram Specifications (RZDiagram engine)

Every figure is drawn through `js/rz-diagram.js` (`create → zone → node → text → edge → fit → render`). The specs
give no coordinates; the engine sizes and routes. Rules from `standarization/DIAGRAM_ENGINE_STANDARD.md`:
- Colours are roles only (`ink`, `muted`, `accent`, `link`, `alarm-normal`, `alarm-caution`, `alarm-fault`, `paper-2`).
- An IEC `symbol` goes **only** on a node that *is* equipment: GPU, rack, CDU, chiller, transformer. Concepts get none.
- Every number shown on a figure carries the source tag listed here, and the caption repeats it.
- Fill `title` and `desc` on every figure.
- Live values use `valueKey` (and `state: 'flow'` for animated connectors).

Notation: `node(id, "Name", "sublabel")`; `edge(a → b, "label")`; `zone("Caption", [members])`.

---

## D1 — Transformer decoder block
- **title:** "One decoder block". **desc:** "Token vectors pass through attention and a feed-forward network; each adds its result back to the residual stream."
- **Nodes:**
  - `in("Residual stream in", "x ∈ ℝ^d, d = 8,192 (Llama 3 70B) [S2]")`
  - `n1("RMSNorm")`
  - `att("Self-attention", "64 query heads · 8 KV heads (GQA) [S2]")`
  - `add1("+", "residual add")`
  - `n2("RMSNorm")`
  - `ffn("Feed-forward (SwiGLU)", "≈⅔ of block weights (derived)")`
  - `add2("+")`
  - `out("Residual stream out")`
  - `kv("KV cache", "320 KiB/token (derived)")`
- **Edges:** in→n1, n1→att, att→add1, in→add1 ("skip"), add1→n2, n2→ffn, ffn→add2, add1→add2 ("skip"), add2→out, att→kv ("write K,V"), kv→att ("read past K,V").
- **Zone:** "× 80 layers [S2]" around n1…add2.
- **Key number on figure:** 80 layers; 320 KiB per token.

## D2 — One attention head, with the maths
- **title:** "Attention head". **desc:** "Queries score keys; softmax turns scores into weights; weights average values."
- **Nodes:**
  - `x("Token vectors X", "n × d")`
  - `q("Q = X·W_Q")`, `k("K = X·W_K")`, `v("V = X·W_V")`
  - `s("Scores", "Q·Kᵀ / √d_h, d_h = 128")`
  - `m("Causal mask", "future = −∞")`
  - `sm("Softmax", "rows sum to 1")`
  - `o("Output", "A·V")`
- **Edges:** x→q, x→k, x→v, q→s, k→s ("transpose"), s→m, m→sm, sm→o ("weights A"), v→o.
- **Zone:** "cost O(n²·d) — FlashAttention keeps it in SRAM [S50]" around s, m, sm.
- **Key number:** √128 = 11.3 scaling (derived).

## D3 — KV-cache growth vs context (block plus bar strip)
- **title:** "Why context fills a GPU". **desc:** "KV memory grows linearly with tokens; at 128K one Llama 3 70B conversation needs 40 GiB."
- **Nodes:**
  - `w("Weights FP8", "70.6 GB")`
  - `k8("KV at 8K", "2.5 GiB")`, `k32("KV at 32K", "10 GiB")`, `k128("KV at 128K", "40 GiB")`
  - `gpu("H200 HBM", "141 GB [S9]")` with symbol GPU
- **Edges:** w→gpu ("resident"), k128→gpu ("+40 GiB"), k8→k32→k128 ("×4"), all labelled.
- **Comparison zone:** "Same 128K context". Nodes: `l70("Llama 3 70B GQA", "40 GiB")`, `ds("DeepSeek-V3 MLA", "8.6 GiB")`, `opt("OPT-13B MHA", "100 GiB")`.
- **Key numbers:** 40 / 8.6 / 100 GiB (derived from [S2][S1][S30]).
- `valueKey: kvGiB` hooks into calculator (i), so the figure updates as the context slider moves.

## D4 — MoE routing (DeepSeek-V3)
- **title:** "Mixture of Experts routing". **desc:** "A router sends each token to 8 of 256 experts plus one shared expert; only 37B of 671B parameters run."
- **Nodes:**
  - `tok("Token vector", "d = 7,168 [S1]")`
  - `r("Router", "sigmoid affinity + per-expert bias (routing only) [S1]")`
  - `sh("Shared expert", "always on")`
  - `e1("Expert 17")`, `e2("Expert 88")`, `e3("… 6 more")`
  - `idle("248 idle experts", "not computed")` (muted)
  - `sum("Weighted sum", "gates from original affinities")`
  - `out("To next layer")`
- **Edges:** tok→r, r→e1 / e2 / e3 ("top-8"), tok→sh, e1/e2/e3/sh→sum, sum→out. r→idle as a dashed muted edge, label "skipped".
- **Zone:** "≤ 4 nodes per token (limits all-to-all) [S1]".
- **Key numbers:** 256 + 1, top-8, 37B / 671B active (5.5%, derived).

## D5 — Training pipeline end to end
- **title:** "From web text to assistant". **desc:** "Data is filtered and mixed, pre-trained at scale, then post-trained with SFT and RL."
- **Nodes, in a left-to-right chain:**
  - `crawl("Raw sources", "web · code · books · synthetic")`
  - `dedup("Dedup + filter", "quality & PII")`
  - `mix("Data mix", "50% general · 25% math · 17% code · 8% multilingual [S2]")`
  - `tokz("Tokenize", "128K vocab [S2]")`
  - `pre("Pre-training", "15.6T tokens · 3.8e25 FLOP [S2]")`
  - `ext("Context extension", "4K→32K→128K [S1]")`
  - `sft("SFT")`
  - `rl("RL: RLHF / DPO / GRPO", "verifiable rewards [S4][S54]")`
  - `eval("Evals + safety")`
  - `rel("Release", "weights or API")`
- **Side branch:** `dist("Distill to students", "32B keeps 91% of AIME [S4]")` from rl.
- **Zone:** "Compute: 16K H100 · ≈25 MW (derived)" around pre.
- **Key numbers:** 15.6T, 3.8e25, 25 MW.

## D6 — Prefill vs decode timeline (swimlane)
- **title:** "What a GPU does when you hit Enter". **desc:** "Prefill processes the whole prompt in parallel; decode emits one token per step and is bandwidth-bound."
- **Lanes (zones):** "Scheduler", "GPU compute", "HBM traffic".
- **Nodes:**
  - `q("Request queued")`
  - `pf("Prefill 4,000 tokens", "≈0.57 s on H200 (derived)")` (compute-bound, accent)
  - `ttft("First token", "TTFT")`
  - `d1("Decode step 1", "reads 70.6 GB weights + KV")`, `d2("Decode step 2")`, `dn("… step n")`
  - `done("EOS")`
  - `hb("Weights + KV read per step", "≈114 GB at batch 32 (derived)")`
- **Edges:** q→pf→ttft→d1→d2→dn→done. Each decode step → hb, dashed, labelled "memory-bound". A `join` node in the scheduler lane shows "continuous batching: new requests join here [S30]".
- **Key numbers:** TTFT 0.57 s; TPOT 23.7 ms ideal / 39.4 ms at 60% (derived).

## D7 — The hardware ladder
- **title:** "From laptop to gigawatt campus". **desc:** "Each rung multiplies memory, bandwidth and power; the model you can serve or train follows."
- **Nodes, in a vertical chain with symbols on the equipment nodes:**
  - `L0("Laptop / Mac Studio", "≤512 GB unified · 819 GB/s [S71] — serves 70B Q4")`
  - `L1("Workstation GPU", "RTX 5090 32 GB · 1.79 TB/s · 575 W [S15] — serves 8–32B")` (symbol GPU)
  - `L2("8-GPU server", "8×H200 1.13 TB · ≈10–14 kW [S9][S70][S12] — serves 405B FP8")` (symbol server)
  - `L3("NVL72 rack", "72 GPUs · 13.4 TB HBM · 132 kW liquid [S10][S68] — 1T-param MoE")` (symbol rack)
  - `L4("Pod", "Ironwood 9,216 chips · 42.5 EF · ≈10 MW [S14]")`
  - `L5("Campus", "100k–200k+ GPUs · 150 MW–1.2 GW [S19][S20]")`
- **Edges:** L0→L1→…→L5, each labelled with its multiplier (e.g. L2→L3 "×9 GPUs, ×10 kW").
- **Side zone:** "Cooling regime": air (L0–L2), DLC mandatory (L3–L5) [S10][S14].
- **Key numbers:** 132 kW per rack, 10 MW per pod, 1.2 GW campus.

## D8 — Agent loop and harness
- **title:** "An agent is a loop the harness controls". **desc:** "The model proposes; the harness executes in a sandbox, verifies, and decides whether to continue."
- **Nodes:**
  - `user("Goal / task")`
  - `ctx("Context manager", "system prompt · memory · compaction · cache")`
  - `llm("Model", "plan → tool call (JSON)")`
  - `gate("Policy gate", "allowlist · human approval for irreversible [S61]")`
  - `sbx("Sandbox", "container · no secrets · egress control")`
  - `tools("Tools via MCP", "resources · prompts · tools [S61]")`
  - `obs("Observation", "UNTRUSTED input")` (alarm-caution)
  - `ver("Verifier", "tests · linters · evaluator")`
  - `bud("Budget", "steps · tokens · time")`
  - `done("Result + log")`
- **Edges:** user→ctx→llm→gate→sbx→tools→obs→ctx ("loop"); llm→ver ("candidate"); ver→done ("pass"); ver→ctx ("fail: feedback"); bud→llm (dashed, "stop when exceeded").
- **Zone:** "Harness (your code)" around ctx, gate, sbx, ver, bud. "Model (vendor)" around llm.
- **Key number:** example run of 30 steps ≈ $2.64 uncached → ≈$0.36 with caching (derived, §8.2).

## D9 — Distillation teacher → student
- **title:** "Distillation". **desc:** "A large teacher's outputs train a small student that keeps most of the skill at a fraction of the size."
- **Nodes:**
  - `t("Teacher: DeepSeek-R1", "671B / 37B active · AIME24 79.8 [S4]")`
  - `gen("Generate reasoning traces", "sequence-level")`
  - `logit("Soft targets (logits, T)", "logit-level [S56]")` (muted, "alternative")
  - `s("Student: Qwen2.5-32B base")`
  - `sft("SFT on traces")`
  - `res("R1-Distill-Qwen-32B", "AIME24 72.6 · 91% of teacher [S4]")`
- **Edges:** t→gen→sft→res, s→sft, t→logit→sft (dashed).
- **Side note node:** `q3("Qwen3 strong-to-weak", "≈1/10 the GPU-hours of RL [S3]")`.
- **Key numbers:** 79.8 → 72.6; 4.8% of the parameters.

## D10 — Roofline
- **title:** "Roofline: why decode waits on memory". **desc:** "Below the ridge point performance is set by bandwidth; above it, by compute."
- This is a chart, not a block diagram. Render it with `js/rz-article-chart.js` (log-log) and carry `source` and `basisTag`.
- **Series:**
  - H100 roofline: slope 3.35 TB/s, flat at 989 TF BF16, ridge 295 FLOP/B [S8]
  - H200 roofline: 4.8 TB/s, ridge 206 [S9]
  - MI355X FP8: 8 TB/s, 5 PF, ridge 625 [S13]
- **Points:**
  - "Decode B = 1" at intensity ≈ 1
  - "Decode B = 32" ≈ 32
  - "Prefill 4K prompt" ≈ 4,000 (labelled)
- **basisTag:** "Derived from vendor peak and bandwidth; dense FLOPs".

## D11 (optional) — Tokenization strip
- **title:** "What the model sees". **desc:** "The same sentence costs more tokens in Indonesian."
- **Nodes:**
  - `en("‘pendinginan’ · ‘dikonsumsi’ · ‘Transformer’")`
  - `tokid("pending|inan · dik|onsum|si · Transformer", "o200k, measured [S72]")`
  - `ids("integer IDs")`
  - `emb("Embedding rows")`
- **Ratio chips:** "EN 1.20 tok/word", "ID 1.60–2.05 tok/word [S72]".
- **Edges:** en→tokid→ids→emb.
