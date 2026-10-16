# Article 29 — Outline
## How a Large Language Model Actually Works — From Tokens to Frontier Agents

**Reader journey:** you know racks, kW and PUE. You leave knowing what an LLM computes, why it needs the hardware
you run, and how to size, cost and power it. Each H2 opens with a plain-language paragraph ("in one breath"),
then goes to depth: maths, then numbers, then the data-center consequence. Figures D1–D11 are in DIAGRAMS.md.
Calculators C-i to C-v are in CALCULATORS.md. Citations `[Sn]` are in RESEARCH.md §11.

Target length: about 9–11k words (comparable to the site's deep-dive articles; owner to confirm). Cross-links:
article 23 (Colossus, 150 MW in 122 days), the DC AI cockpit, the PUE calculator.

---

### H2 1. The one-paragraph answer
- An LLM is a next-token probability engine. It is a stack of identical transformer blocks, it runs on matrix
  multiplies, and it is limited by memory bandwidth when it talks and by compute when it reads or learns.
- **Key claims:** training ≈ 6·N·D FLOPs; inference ≈ 2·N_active per token [S7]. Figure: D1.

### H2 2. Tokens: the unit everything is billed in
- H3 2.1 What a tokenizer does (BPE, byte-level, SentencePiece, tiktoken)
- H3 2.2 Vocabulary sizes: 100K–200K
- H3 2.3 English vs Indonesian vs code (measured table)
- H3 2.4 Why it sets cost and context
- **Key claims:**
  - Llama 3 vocab 128K; 3.17 → 3.94 chars/token [S2]
  - Qwen3 vocab 151,669 [S3]
  - Indonesian costs 1.19–1.51× the tokens of English for the same content, depending on tokenizer [S72]
  - On the current Claude tokenizer, 1M tokens ≈ 555k words [S27]
- Figure D11. Calculator C-v.

### H2 3. Inside one block: embeddings, position, attention
- H3 3.1 Embeddings: a lookup table of meaning-vectors
- H3 3.2 Position: sinusoidal → RoPE → ALiBi → YaRN → 1M–10M contexts
- H3 3.3 Attention, step by step (Q, K, V, softmax(QKᵀ/√d)V, causal mask)
- H3 3.4 Many heads, fewer KV heads: MHA → MQA → GQA → MLA
- H3 3.5 The feed-forward network and the residual stream (LayerNorm vs RMSNorm)
- **Key claims:**
  - RoPE base 500,000 in Llama 3 [S2]
  - ALiBi extrapolation result [S48]; YaRN 10× fewer tokens [S49]
  - FlashAttention [S50]
  - GQA with 8 KV heads in Llama 3 [S2]; MLA caches 576 values/layer, 57× smaller than MHA (derived from [S1])
  - Llama 4 Scout 10M context [S23]; DeepSeek-V4 1M context at 10% of V3.2's KV [S26]
- Figures D1, D2.

### H2 4. The KV cache: where your HBM goes
- H3 4.1 Formula and worked table (8B / 70B / 405B / Qwen3 / DeepSeek-V3)
- H3 4.2 Long context vs concurrent users
- **Key claims:**
  - 320 KiB/token and 40 GiB at 128K for Llama 3 70B (derived [S2])
  - OPT-13B 800 KB/token check [S30]
  - Old serving systems used 20.4–38.2% of KV memory for real token state [S30]
- Figure D3. Calculator C-i.

### H2 5. Mixture of Experts: big brain, small bill
- H3 5.1 Routing and load balancing (aux-loss-free bias)
- H3 5.2 Total vs active parameters and what each costs you (memory vs compute)
- H3 5.3 The network bill: expert parallelism and all-to-all
- **Key claims:**
  - DeepSeek-V3: 256 + 1 experts, top-8, ≤4 nodes, 671B / 37B; decode unit 320 GPUs [S1]
  - Kimi K2 1T / 32B [S25]; Qwen3-235B-A22B [S3]; Llama 4 Maverick 400B / 17B [S23]; DeepSeek-V4-Pro 1.6T / 49B [S26]
- Figure D4.

### H2 6. A guessing engine: logits, softmax and sampling
- H3 6.1 From logits to probabilities
- H3 6.2 Temperature, top-k, top-p, min-p, penalties
- H3 6.3 Why it hallucinates, and why that is not a bug in the sampler
- H3 6.4 Speculative decoding: guessing ahead without changing the answer
- **Key claims:**
  - R1 recommended T = 0.6 [S4]
  - Speculative decoding 2–3× with identical outputs [S32]; 2–2.5× on Chinchilla 70B [S33]

### H2 7. Model families in 2026: who is how big
- H3 7.1 Dense vs MoE; open vs closed
- H3 7.2 The table (≈16 rows with licences)
- H3 7.3 Tokens per parameter: why small models are "over-trained"
- **Key claims:** RESEARCH §3.2 table [S1][S3][S4][S23]–[S29][S69][S74]. Closed-model parameter counts are not disclosed.

### H2 8. Training: from 15 trillion tokens to a base model
- H3 8.1 Data pipeline and the data mix
- H3 8.2 Objective, optimiser, learning-rate schedule, batch, precision (BF16 → FP8 → FP4)
- H3 8.3 Scaling laws: Kaplan → Chinchilla → replication → inference-aware over-training
- H3 8.4 Parallelism: DP/FSDP/ZeRO, TP, PP, CP, EP
- H3 8.5 Worked budget: 70B × 15T → GPU-hours → $ → MWh → MW
- H3 8.6 What a 16K-GPU job does to your power system (tens of MW swings; 419 interruptions in 54 days)
- **Key claims:**
  - Data mix and 3.8e25 FLOP [S2]; Chinchilla rule [S5]; replication constants [S6]
  - MFU 38–43% [S2]
  - DeepSeek-V3 FP8 and the $5.576M with its caveat [S1]; R1 RL $294k [S73]
  - Llama 3.1 405B 30.84M GPU-h [S69]
  - Worked example: 6.30e24 FLOP, 4.42M GPU-h, 11.3 days on 16,384 GPUs, $8.9–13.3M, 6.8 GWh, 25.1 MW (derived)
- Figure D5. Calculator C-ii.

### H2 9. Post-training: from autocomplete to assistant to reasoner
- H3 9.1 SFT, RLHF/PPO, DPO, Constitutional AI
- H3 9.2 GRPO and verifiable rewards (DeepSeek-R1)
- H3 9.3 Reasoning models and test-time compute
- **Key claims:**
  - InstructGPT 1.3B > 175B [S52]; DPO [S53]; CAI [S55]
  - GRPO [S54]; pure-RL reasoning [S4]
  - Test-time compute beats a 14× larger model in FLOP-matched tests [S57]
  - gpt-oss SWE-bench 47.9 → 62.4 by reasoning effort [S24]

### H2 10. Distillation, fine-tuning and quantization: making it small
- H3 10.1 Distillation (logit vs sequence; the R1-Distill table)
- H3 10.2 LoRA and QLoRA: the maths and the memory
- H3 10.3 Quantization: INT8, GPTQ, AWQ, FP8/FP4, GGUF; quality cost
- H3 10.4 What hardware for 7B / 14B / 70B fine-tunes
- **Key claims:**
  - R1-Distill-Qwen-32B 72.6 vs R1 79.8 AIME [S4]; Qwen3 distillation ≈1/10 GPU-h [S3]
  - LoRA 10,000× fewer parameters [S34]; QLoRA 65B on 48 GB [S35]
  - GPTQ 175B in ≈4 GPU-h [S36]; AWQ [S37]; LLM.int8 [S38]; GGUF bpw table [S39]
- Figure D9. Calculator C-iv.

### H2 11. "Uncensored" models: what abliteration actually is
- H3 11.1 How refusal is trained in
- H3 11.2 The single-direction finding (mechanism only)
- H3 11.3 What it does and does not change
- H3 11.4 Licences, liability and the operator's responsibility
- **Key claims:**
  - 13 models up to 72B; ASR 79–84% (Qwen) vs 4–23% (Llama-2); TruthfulQA −1 to −3.5 [S40]
  - The authors' ethics statement [S40]
  - Llama 4 AUP and the 700M MAU clause [S23]
- **Editorial:** no procedures, code or model links. Neutral tone.

### H2 12. Serving: how one GPU talks to a thousand users
- H3 12.1 Prefill vs decode
- H3 12.2 The metrics: TTFT, TPOT/ITL, throughput, goodput
- H3 12.3 Engines: vLLM (PagedAttention), SGLang (RadixAttention), TensorRT-LLM, llama.cpp/Ollama
- H3 12.4 Continuous batching, prefix caching, disaggregated prefill/decode
- H3 12.5 The roofline and the bandwidth ceiling (worked table)
- H3 12.6 Batching and the cost per million tokens; joules per token
- **Key claims:**
  - vLLM 2–4× [S30]; SGLang up to 6.4× [S31]; DistServe 7.4× / 12.6× [S44]
  - Disaggregation does not raise throughput [S63]
  - Ceilings: 68 tok/s for 70B FP8 on H200, etc. (derived)
  - $0.72–1.20 per M tokens at batch 32 (derived, assumptions stated); ≈1 J/token → ≈0.27 Wh per 1,000-token answer (derived), consistent with 0.24–0.3 Wh [S18][S66]
- Figures D6, D10. Calculator C-iii.

### H2 13. The hardware ladder, rung by rung
- H3 13.1 Laptop and Mac Studio
- H3 13.2 Workstation GPU (RTX 4090 / 5090)
- H3 13.3 One server (H100/H200/B200/MI355X)
- H3 13.4 One rack (GB200/GB300 NVL72): 132 kW and liquid
- H3 13.5 A pod (InfiniBand/RoCE; TPU Ironwood)
- H3 13.6 A campus (Colossus, Stargate)
- H3 13.7 Inference ASICs (Groq, Cerebras)
- H3 13.8 What it means for your facility: density, DLC, PUE, power transients
- **Key claims:** [S8]–[S17], [S19]–[S21], [S68], [S70], [S71]. Derived: 1.83 kW per GPU (NVL72); 100k GB200 ≈ 220 MW at PUE 1.2; 100k H100 ≈ 153 MW.
- Figure D7. Calculator C-i (fit) and C-ii (energy).

### H2 14. Agents and harnesses
- H3 14.1 Tool calling, ReAct, workflows vs agents
- H3 14.2 MCP
- H3 14.3 Designing the harness: context, verification, sandbox, budgets
- H3 14.4 Failure modes: hallucination, prompt injection, loops
- H3 14.5 Evaluating agents (SWE-bench, GAIA) and why scores disagree
- H3 14.6 RAG vs long context vs fine-tuning
- **Key claims:**
  - ReAct +34/+10 [S42]; Anthropic's patterns [S62]; MCP roles, features and security [S61]
  - SWE-bench official top 79.2% [S22] vs launch 1.96% [S58]; GAIA 92% human vs 15% GPT-4 [S43]
  - Agent-run cost example (derived)
- Figure D8.

### H2 15. The frontier and its limits
- H3 15.1 Compute ×5/year and what the largest runs used
- H3 15.2 The data wall and synthetic data
- H3 15.3 Test-time compute as the new scaling axis
- H3 15.4 Energy: per query, per run, per grid
- H3 15.5 Open vs closed
- **Key claims:**
  - 5×/yr, 3.5×/yr cost, 49%/yr price-performance [S64]
  - GPT-6 Astra ≈9.4e26 (CI 5e26–2e27), ≈233 MW; Grok 3 3.5e26; GPT-4.5 3.8e26 [S65]
  - Data wall 2026–2032 [S41]
  - 0.24 Wh / 0.26 mL [S18]; 0.3 Wh [S66]; 415 → 945 TWh [S67]

### H2 16. Engineer's checklist (summary table)
One row per topic: the formula, the default and the source, as the article's take-home card.

---

## Glossary terms to define (RZExplain keys)
token, tokenizer, BPE, vocabulary, embedding, d_model, positional encoding, RoPE, ALiBi, YaRN, attention, query/key/value,
softmax, causal mask, multi-head attention, MQA, GQA, MLA, FFN, SwiGLU, residual stream, LayerNorm, RMSNorm, MoE, expert,
router, active parameters, logits, temperature, top-k, top-p, min-p, perplexity, cross-entropy, speculative decoding, KV cache,
prefill, decode, TTFT, TPOT/ITL, goodput, continuous batching, PagedAttention, RadixAttention, prefix caching,
disaggregated serving, roofline, arithmetic intensity, ridge point, MFU, FLOP/FLOPS, BF16, FP8, FP4/MXFP4/NVFP4, quantization,
GGUF, GPTQ, AWQ, NF4, LoRA, QLoRA, full fine-tune, ZeRO/FSDP, tensor/pipeline/expert/context parallelism, Chinchilla scaling,
tokens per parameter, SFT, RLHF, PPO, DPO, GRPO, RLVR, Constitutional AI, reasoning model, test-time compute, distillation,
abliteration / refusal direction, agent, harness, tool calling, ReAct, MCP, prompt injection, RAG, context window, SWE-bench,
GAIA, NVLink, NVL72, HBM, InfiniBand/RoCE, TPU, LPU, wafer-scale engine, DLC (direct liquid cooling), PUE.

---

## Claims I could NOT verify (must stay marked or be cut)
1. SWE-bench Verified scores above 79.2% for 2026 models (the 93–97% figures from aggregators for Claude Opus 5 /
   Fable 5 / GPT-5.x / DeepSeek V4). Not on the official board [S22].
2. Current GAIA leaderboard values (the page is dynamic and was not readable).
3. xAI Colossus beyond 200k GPUs (555k / 850k / 1.1M H100e; 1–2 GW). Only x.ai's "200k" and Epoch's "1.1M H100e" label were seen [S19][S64].
4. Stargate Abilene build state in October 2026 (6 of 8 buildings, 618 MW). Epoch tracker gives full 1.2 GW by Q4 2026 [S20].
5. Vera Rubin NVL144 specs (288 GB HBM4, 3.6 EF FP4, 120–130 kW). NVIDIA page not found [S75].
6. GB300 NVL72 dense FP4 (1,080 PF); the page text was garbled [S11].
7. B200 "72 PF FP8" sparse/dense basis [S12].
8. Cerebras "250 PF" (WSE-3 Turbo page) vs the 125 PF sparse datasheet figure [S16].
9. RTX 4090 1,008 GB/s (secondary sources only).
10. H800 peak FLOPs (assumed equal to H100 for the DeepSeek MFU estimate).
11. Market GPU rental prices ($2–3.50/GPU-h) are assumptions, not sourced.
12. Gemini 3.x context window (1M from secondary sources; not on the docs pages fetched).
13. gpt-oss-120b context length (not in the card extract).
14. Llama 3 70B FFN dim 28,672 and 8B FFN dim 14,336 (public configs, not re-read this session).
15. The R1-Distill training-set size (800k samples) and the composition of DeepSeek's $294k R1 figure.
16. EU AI Act GPAI obligation date (2 Aug 2025), from the regulation text but not re-fetched.
17. Engine efficiency fractions (50–80% of bandwidth ceiling), runtime memory overhead (10–20%), and activation
    heuristics. These are engineering assumptions, labelled as such in the calculators.
18. Apple silicon newer than M4 Max / M3 Ultra (an Oct 2026 lineup may include M5-class parts that were not checked).
19. Any capex or price per rack, GPU or campus (no primary price lists).
