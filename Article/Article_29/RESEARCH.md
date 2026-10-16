# Article 29 — Research Dossier
## How a Large Language Model Actually Works — From Tokens to Frontier Agents

Prepared 2026-10-16 for resistancezero.com. Reader: a data-center operations engineer.
Rules applied: every number carries an `[Sn]` tag that resolves in §11 *Sources*. A number marked
**(derived)** was computed for this dossier from tagged inputs; the arithmetic is shown inline.
**UNVERIFIED** means no primary source was found this session. **(measured)** means it was measured
locally for this dossier, and the method is in [S72].

Conventions: GB = 10⁹ bytes; GiB = 2³⁰ bytes. "Dense" FLOPs exclude 2:4 structured sparsity. Vendor
headline tensor numbers are usually quoted *with* sparsity, so this dossier halves them and labels the result.

---

## 0. Executive numbers (the ten that carry the article)

| # | Number | Source |
|---|---|---|
| 1 | Training compute ≈ 6·N·D FLOPs; Llama 3 405B: 6 × 405e9 × 15.6e12 = 3.79e25 (paper states 3.8e25) | [S7][S2] (derived check) |
| 2 | Inference ≈ 2·N_active FLOPs per generated token | [S7] (forward pass = 1/3 of the 6ND training cost) |
| 3 | Llama 3 70B KV cache = 320 KiB per token in BF16, so a 128K-token context needs 40 GiB per sequence | (derived) from [S2] |
| 4 | DeepSeek-V3: 671B total / 37B active; 2.788M H800 GPU-h; $5.576M at an assumed $2/GPU-h | [S1] |
| 5 | Chinchilla: compute-optimal training uses ≈20 tokens per parameter, confirmed by the 2024 replication | [S5][S6] |
| 6 | Decode is memory-bandwidth-bound: at batch 1, tokens/s ≤ HBM bandwidth ÷ bytes of weights. 70B FP8 on H200 (4.8 TB/s) gives ≤ 68 tok/s | (derived) [S9] |
| 7 | GB200 NVL72: 72 GPUs, 13.4 TB HBM3E, 130 TB/s NVLink, liquid-cooled; rack TDP 132 kW nominal, about 192 kW peak electrical design power | [S10][S68] |
| 8 | Llama 3 training: power swings "on the order of tens of megawatts"; 419 unexpected interruptions in 54 days on 16K H100s | [S2] |
| 9 | Median Gemini Apps text prompt: 0.24 Wh, 0.26 mL water (Aug 2025); Epoch's estimate for a GPT-4o query is ≈0.3 Wh | [S18][S66] |
| 10 | Frontier training compute has grown ≈5×/year since 2020; the largest 2026 run is estimated at ≈9.4e26 FLOP (GPT-6 Astra, ≥100k GB200, Epoch estimate with CI 5e26–2e27) | [S64][S65] |

---

## 1. Tokens and tokenizers

### 1.1 Plain language
A model never sees letters or words. A tokenizer cuts text into pieces called tokens, drawn from a fixed
vocabulary, and replaces each piece with an integer ID. Common English words are usually one token. Rare
words, other languages and code break into several tokens. Price, context limits and speed are all
counted in tokens, so the tokenizer sets how much a page of text costs.

### 1.2 Mechanism
- **BPE (byte-pair encoding):** start from bytes (256 symbols). Repeatedly merge the most frequent adjacent
  pair into a new symbol until the vocabulary reaches the target size V. Encoding replays the learned merges.
  "Byte-level" BPE (GPT-2 onward, tiktoken, Llama 3, Qwen, DeepSeek) never meets an unknown character,
  because every string is bytes.
- **SentencePiece:** a library that treats the input as a raw stream, with whitespace encoded as `▁`. It
  implements BPE and Unigram-LM. It was used by Llama 1/2, T5 and Gemma. (Background; library docs were not
  re-read for this dossier.)
- **tiktoken:** OpenAI's fast BPE implementation. Encodings include `cl100k_base` (GPT-4 era) and `o200k_base`
  (GPT-4o era and gpt-oss).

### 1.3 Vocabulary sizes (verified)

| Tokenizer / model | Vocab | Source |
|---|---|---|
| cl100k_base | 100,277 IDs incl. specials (measured `n_vocab`) | [S72] |
| o200k_base | 200,019 (measured `n_vocab`) | [S72] |
| Llama 3 / 3.1 | 128K = 100K from tiktoken + 28K added for non-English | [S2] |
| Qwen3 | 151,669 | [S3] (also measured [S72]) |
| DeepSeek-V3 | 128,815 in `tokenizer.json` (measured); the report calls it 128K | [S72][S1] |
| Kimi K2 | 160K | [S25] |

### 1.4 Tokens per word: English vs Indonesian vs code (measured)
Method [S72]: one 133-word English paragraph about data-center cooling, its 118-word Indonesian translation,
and a 7-line Python function. Each was encoded with four tokenizers. The sample is small, so treat the ratios
as indicative, not definitive.

| Tokenizer | EN tok/word | EN chars/tok | ID tok/word | ID ÷ EN (same content) | Code chars/tok |
|---|---|---|---|---|---|
| cl100k_base | 1.20 | 4.88 | 2.05 | 1.51× | 2.98 |
| o200k_base | 1.20 | 4.91 | 1.60 | 1.19× | 2.94 |
| Qwen3 | 1.20 | 4.88 | 2.05 | 1.51× | 2.70 |
| DeepSeek-V3 | 1.19 | 4.94 | 1.72 | 1.28× | 2.80 |

- Examples (o200k): "pendinginan" → `pending|inan`; "dikonsumsi" → `dik|onsum|si`; "megawatt" → `meg|aw|att`;
  "Transformer" → one token [S72].
- Vendor statements, which vary by tokenizer generation: Meta reports Llama 3 English compression
  improved from 3.17 to 3.94 characters per token versus Llama 2 [S2]. Anthropic states that on the current
  Claude tokenizer (introduced with Claude Opus 4.7), 1M tokens ≈ 555k words ≈ 2.5M characters. That is
  1.80 tokens/word and 2.5 chars/token **(derived)**. Earlier Claude models fit about 750k words in 1M tokens,
  i.e. 1.33 tokens/word [S27]. The rule "1 token ≈ ¾ of an English word" is therefore tokenizer-specific.
  Measured values here span 1.19–1.80 tokens per English word.
- **Why it matters.** Cost is (input tokens × input price) + (output tokens × output price). The same
  Indonesian document costs 1.19–1.51× its English equivalent, and fills the context window that much
  faster. The ratio depends on the tokenizer [S72].

### 1.5 Worked example
A 10,000-word document at $2 per million input tokens [S27 price, Sonnet 5.5]:
- English, o200k: 10,000 × 1.20 = 12,000 tokens → $0.024.
- Indonesian, o200k: 16,000 tokens → $0.032. Indonesian, cl100k/Qwen3: 20,500 tokens → $0.041.
- Claude's current tokenizer at 1.80 tok/word: 18,018 tokens → $0.036 (derived).

---

## 2. Inside the model: embeddings, position, attention, FFN, norms, MoE, FLOPs, sampling

### 2.1 Embeddings
Plain: each token ID looks up a row in a table of vectors, d_model numbers long. This vector is the token's
"meaning coordinates", and the model refines it layer by layer.
Depth: E ∈ ℝ^{V×d}. Parameter count is V·d. Llama 3 70B: 128,256 × 8,192 ≈ 1.05B parameters for input
embeddings, and about the same again for the untied output head **(derived; V=128,256 is the exact Llama 3
vocab, consistent with "128K" [S2])**. Small Qwen3 models tie the input and output embeddings (0.6B, 1.7B
and 4B "Tie Embedding: Yes") [S3].

### 2.2 Positional encoding
Attention on its own is order-blind, so position has to be injected.
- **Sinusoidal (2017):** PE(pos,2i)=sin(pos/10000^{2i/d}), PE(pos,2i+1)=cos(…), added to the embeddings [S51].
- **Learned absolute:** a trained table of position vectors (GPT-2 era). It cannot extend past the trained length.
- **RoPE:** rotates each 2-D pair of query/key dimensions by angle pos·θ_i, with θ_i = base^{-2i/d}. The dot
  product q·k then depends only on the relative distance m−n [S47]. Llama 3 uses base θ = 500,000 [S2].
- **ALiBi:** no position embeddings. It adds a head-specific linear penalty −m·|i−j| to the attention scores. A
  1.3B model trained at 1,024 tokens extrapolated to 2,048 tokens, matching the perplexity of a sinusoidal
  model trained at 2,048, while training 11% faster with 11% less memory [S48].
- **YaRN:** rescales the RoPE frequencies to extend context, needing "10x less tokens and 2.5x less training
  steps than previous methods" [S49].
- **Long context in practice:** DeepSeek-V3 is pre-trained at 4K and extended to 32K, then 128K [S1]. Llama 4
  Scout claims 10M tokens and Maverick 1M [S23]. DeepSeek-V4 claims 1M and replaces dense attention with
  hybrid compressed-sparse attention (CSA + HCA). At 1M context it needs 27% of V3.2's per-token FLOPs and 10%
  of its KV cache [S26].

### 2.3 Attention: the full maths
Plain: for every token, the model asks "which earlier tokens matter to me, and how much?" Then it takes a
weighted average of their information.

Depth (one head; X ∈ ℝ^{n×d} are the token vectors):
```
Q = X·W_Q,  K = X·W_K,  V = X·W_V            (W_* ∈ ℝ^{d×d_h})
S = Q·Kᵀ / √d_h                               (n×n similarity scores)
S_ij = −∞ for j > i                           (causal mask: no peeking at the future)
A = softmax_row(S)                            (each row sums to 1)
head = A·V
MultiHead(X) = concat(head_1 … head_h)·W_O    [S51]
```
- **Why √d_h:** if q and k have unit-variance components, q·k has variance d_h. Dividing by √d_h keeps the
  softmax out of its saturated region [S51].
- **Cost:** scoring is O(n²·d) FLOPs and the n×n matrix is O(n²) memory. FlashAttention computes exact
  attention in tiles held in SRAM, so the n×n matrix is never written to HBM. Reported results: 3× speed-up on
  GPT-2 at 1K context, and the first better-than-chance result on Path-X (16K) [S50].
- **MQA:** all query heads share one K/V head [S46]. **GQA:** g K/V groups, with 1 < g < h [S45]. Llama 3
  uses 8 KV heads for every model size [S2]; Qwen3 MoE uses 4 [S3]. The KV cache shrinks by a factor of h/g.
  Llama 3 70B: 64/8 = 8× smaller than MHA **(derived)**.
- **MLA (DeepSeek-V2/V3):** keys and values are down-projected into a shared latent c_KV ∈ ℝ^{d_c}, with
  d_c = 512. A separate 64-dim RoPE key k_R is carried alongside. Only c_KV and k_R are cached; K and V are
  re-expanded from the latent with W_UK and W_UV [S1]. DeepSeek-V3: 61 layers × (512 + 64) values × 2 bytes
  = **70,272 B ≈ 68.6 KiB per token**. Full MHA with 128 heads × 128 dims would be 2 × 61 × 128 × 128 × 2 B =
  3.81 MiB per token. MLA is therefore 1.76% of MHA, about 57× smaller **(derived)**.

### 2.4 FFN / MLP, residuals, normalisation
- **FFN:** a position-wise two- or three-matrix MLP. With SwiGLU, as in Llama: FFN(x) = W_down·(SiLU(W_gate x) ⊙ W_up x).
  Llama 3 70B: d = 8,192, FFN dim 28,672 (Meta Table 3 [S2]; the FFN dim came from the table and was not re-quoted
  this session). Llama 3 8B FFN dim = 14,336 (used in the LoRA example, §4.8; from the public config).
  Parameter share: in a dense transformer the FFN holds about two-thirds of the per-layer weights (derived:
  attention ≈ 4d² with MHA, FFN ≈ 3·d·d_ff ≈ 8–10.5 d²).
- **Residual stream:** each sub-layer adds its output back: x ← x + Sublayer(Norm(x)) (the "pre-norm" form).
- **LayerNorm:** (x−μ)/σ·γ+β. **RMSNorm:** x/RMS(x)·γ. It skips mean-centring, which is cheaper.
  DeepSeek-V3 applies extra RMSNorms after its compressed latents [S1].

### 2.5 Mixture of Experts (MoE)
Plain: in place of one big FFN, there are many smaller "expert" FFNs. A router sends each token to a
few of them. Total parameters (knowledge capacity) grow while per-token compute (active parameters) stays small.

Depth, using DeepSeek-V3 [S1]:
- Every layer except the first three is MoE: 1 shared expert + 256 routed experts. Each expert has
  intermediate width 2,048. 8 routed experts are active per token, and each token goes to at most 4 nodes.
- Routing: a sigmoid affinity s_{i,t} = σ(u_tᵀe_i), top-K selection, and normalisation over the selected experts.
- **Auxiliary-loss-free load balancing:** each expert has a bias b_i that is added *only for routing*. After each
  step, b_i is lowered by γ if the expert was overloaded and raised by γ if underloaded. A small
  sequence-wise balance loss remains as a safety net. Earlier MoEs (Switch [S59], GShard) relied on auxiliary
  losses, which the DeepSeek authors say "impair the model performance" when too large [S1].
- Result: 671B total, 37B active (5.5% active, derived). Inference deployment: one decode unit spans 40 nodes /
  320 GPUs, using expert parallelism EP320 with one expert per GPU, plus 64 GPUs for redundant and shared
  experts [S1].
- Other MoEs (verified): Qwen3-235B-A22B (128 experts, 8 active) [S3]; Llama 4 Maverick (17B active / 400B
  total, 128 experts) and Scout (17B / 109B, 16 experts) [S23]; Kimi K2 (1T / 32B, 384 experts, 8 selected) [S25];
  gpt-oss-120b (117B / 5.1B) [S24]; DeepSeek-V4-Pro (1.6T / 49B) and V4-Flash (284B / 13B) [S26].
- Engineering consequence: memory is sized by *total* parameters, but per-token compute and bandwidth scale with
  *active* parameters. At high batch the experts are all touched anyway, so aggregate bandwidth demand returns
  toward the total. Expert-parallel all-to-all traffic (InfiniBand/NVLink) becomes a first-class cost [S1].

### 2.6 FLOPs and memory formulas (the core physics)
- Training: **C ≈ 6·N·D**. Forward ≈ 2N per token (one multiply plus one add per weight); backward ≈ 4N [S7]
  ("C ≈ 6NBS… total non-embedding training compute", with B·S = tokens). Attention adds ≈ 2·n_layer·n_ctx·d_attn
  per token, small unless the context is long [S7].
- Inference: **≈ 2·N_active FLOPs per token**, plus attention over the cache.
- Weight memory = N × bytes/param (BF16 2, FP8 1, INT4 0.5, GGUF Q4_K_M 4.894 bits/8 [S39]).
- **KV cache bytes = 2 (K and V) × n_layers × n_kv_heads × d_head × bytes × tokens × batch.**
  Check against the vLLM paper: OPT-13B gives 2 × 5,120 × 40 × 2 = 800 KB per token, as stated in [S30].

Worked KV-cache table, BF16 cache, per sequence **(derived)**:

| Model | Layers / KV heads / d_head | KiB per token | 8K ctx | 32K | 128K |
|---|---|---|---|---|---|
| Llama 3 8B | 32/8/128 [S2] | 128 | 1.0 GiB | 4.0 | 16.0 |
| Llama 3 70B | 80/8/128 [S2] | 320 | 2.5 | 10.0 | 40.0 |
| Llama 3 405B | 126/8/128 [S2] | 504 | 3.9 | 15.8 | 63.0 |
| Qwen3-32B | 64/8/128 [S3] | 256 | 2.0 | 8.0 | 32.0 |
| Qwen3-235B-A22B | 94/4/128 [S3] | 188 | 1.5 | 5.9 | 23.5 |
| DeepSeek-V3 (MLA) | 61 × (512+64) [S1] | 68.6 | 0.54 | 2.1 | 8.6 |
| OPT-13B (MHA, check) | 40/40/128 [S30] | 800 | 6.25 | 25 | 100 |

d_head = 128 for Qwen3 comes from the model configs, not from the report table; it is consistent with 64 heads × 128 = 8,192.
At a 128K context, the cache of one Llama 3 70B conversation (40 GiB) is more than half of the FP8 weights (≈70 GB).
This is why long context, not parameter count, often caps how many users a GPU can serve.

### 2.7 The "guessing engine": logits → probabilities → token
Plain: after the last layer, the model scores every vocabulary entry (100k–200k of them). The scores become
probabilities, and the software picks one token, appends it, and runs again. Nothing is looked up. Each token
is a draw from a learned probability distribution.

Depth:
- Logits z = h_L·W_outᵀ ∈ ℝ^V. p_i = exp(z_i/T) / Σ_j exp(z_j/T).
- **Greedy** (T→0): always argmax. It is deterministic but tends to loop.
- **Temperature T:** T < 1 sharpens the distribution, T > 1 flattens it. DeepSeek recommends T = 0.5–0.7 (0.6) for R1 [S4].
- **Top-k:** keep the k highest-probability tokens and renormalise. **Top-p (nucleus):** keep the smallest set
  whose cumulative p ≥ p. **Min-p:** keep tokens with p_i ≥ min_p · p_max, which scales with confidence
  (Nguyen et al., arXiv 2407.01082; background, not re-read).
- **Repetition / frequency / presence penalties:** subtract from, or divide, the logits of tokens already
  generated. These are heuristics, not part of the trained model.
- **Training objective:** cross-entropy L = −Σ_t log p_θ(x_t | x_<t). Perplexity = exp(L). Minimising it is
  "next-token prediction".
- **Speculative decoding:** a small draft model proposes γ tokens and the large model verifies them in one
  parallel forward pass. A modified rejection-sampling rule keeps the output distribution *identical* to the
  large model's. Reported speed-ups: 2–3× on T5-XXL with identical outputs [S32], and 2–2.5× on Chinchilla 70B
  [S33]. It works because decode is bandwidth-bound (§6.5): verifying k tokens costs about the same as
  generating one. DeepSeek-V3's multi-token-prediction (MTP) module, depth 1, can serve as the draft [S1].

---

## 3. Scale and model families (state as of 2026-10-16)

### 3.1 Dense vs MoE, total vs active
A dense model has N_total = N_active. An MoE model has N_total ≫ N_active. Memory (and therefore the hardware
tier) is set by the total; per-token compute is set by the active count. Parameter counts for closed models
are **not published** by Anthropic, OpenAI or Google, and any figure seen online for them is UNVERIFIED.

### 3.2 Model table

| Model | Type | Total / active | Context | Pretrain tokens | Licence | Source |
|---|---|---|---|---|---|---|
| Llama 3.1 8B / 70B / 405B | dense | 8B / 70B / 405B | 128K | ~15T (15.6T for 405B) | Llama 3.1 Community | [S69][S2] |
| Llama 4 Scout | MoE 16E | 109B / 17B | 10M | ~40T | Llama 4 Community (700M MAU clause) | [S23] |
| Llama 4 Maverick | MoE 128E | 400B / 17B | 1M | ~22T | Llama 4 Community | [S23] |
| Qwen3-32B | dense | 32B | 128K | 36T | Apache 2.0 | [S3] |
| Qwen3-30B-A3B | MoE 128/8 | 30B / 3B | 128K | 36T | Apache 2.0 | [S3] |
| Qwen3-235B-A22B | MoE 128/8 | 235B / 22B | 128K | 36T | Apache 2.0 | [S3] |
| DeepSeek-V3 | MoE 256+1 / 8 | 671B / 37B | 128K | 14.8T | MIT (weights; see repo) | [S1] |
| DeepSeek-R1 | MoE (V3 base) | 671B / 37B | 128K | (V3 base) | MIT | [S4] |
| DeepSeek-V4-Pro | MoE, CSA+HCA | 1.6T / 49B | 1M | >32T | MIT | [S26] |
| DeepSeek-V4-Flash | MoE | 284B / 13B | 1M | >32T | MIT | [S26] |
| Kimi K2 | MoE 384/8, MLA | 1T / 32B | 128K | 15.5T | Modified MIT | [S25] |
| gpt-oss-120b | MoE, MXFP4 | 117B / 5.1B | UNVERIFIED (not on card extract) | n/p | Apache 2.0 | [S24] |
| Mistral 7B | dense | 7B | — | n/p | Apache 2.0 | [S74] |
| Claude Opus 5.5 / Sonnet 5.5 / Haiku 5.5 / Fable 5.1 | closed | not disclosed | 1M, 128K max output | n/p | proprietary | [S27] |
| GPT-6 Astra / GPT-6.1 Sol / GPT-6 Luna | closed | not disclosed | 1.05M, 128K out | n/p | proprietary | [S28] |
| Gemini 3.1 Pro (preview), 3.8 Flash | closed | not disclosed | 1M (secondary sources; not on the docs page fetched) | n/p | proprietary | [S29] |

API list prices (per million tokens, input/output) on 2026-10-16:
- Claude: Fable 5.1 $10/$50; Opus 5.5 $4/$20; Sonnet 5.5 $2/$10; Haiku 5.5 from $0.10/$0.50. Batch is 50% off;
  cache reads cost 5–10% of the input price [S27].
- OpenAI: GPT-6 Astra $10/$50; GPT-6.1 Sol $2/$10; GPT-6 Luna $0.10/$0.50 [S28].
- Gemini: 3.1 Pro Preview $2/$12 (≤200K prompt) and $4/$18 (>200K); 3.8 Flash $0.75/$3.75 until 2026-12-31 [S29].

### 3.3 Tokens per parameter (derived, showing where Chinchilla sits)
Chinchilla 70B/1.4T = 20 · Llama 3 405B = 39 · Llama 3 8B ≈ 1,875 · Qwen3-0.6B on 36T = 60,000 ·
DeepSeek-V3 = 22 per total parameter, 400 per active · Llama 4 Scout = 367 per total · Kimi K2 = 16 per total.
Small models are deliberately "over-trained": extra training compute is spent once to buy cheaper inference forever.

---

## 4. Training end to end

### 4.1 Data pipeline
- **Sources:** web crawl, code, books, papers, multilingual text, synthetic data. Llama 3's final mix: about 50%
  general knowledge, 25% maths and reasoning, 17% code, 8% multilingual [S2]. Qwen3 covers 36T tokens in 119
  languages and dialects. It adds OCR'd PDF text (Qwen2.5-VL, then refined by Qwen2.5) and "trillions" of
  synthetic tokens from Qwen2.5-Math/Coder [S3].
- **Processing:** URL/document/line-level deduplication, heuristic and model-based quality filters, PII removal, a
  knowledge classifier used to down-sample over-represented topics, and data mixes chosen by small-model
  scaling-law experiments [S2]. DeepSeek-V3 uses document packing without cross-sample attention masking, and
  Fill-in-the-Middle (PSM) in pre-training [S1].
- **Data wall:** Villalobos et al. project that, if trends hold, models will be trained on datasets "roughly equal in
  size to the available stock of public human text data between 2026 and 2032" [S41]. 2026 is inside that window,
  so synthetic data and RL become the growth levers (§9).

### 4.2 Pre-training objective, optimiser and schedule
- Objective: next-token cross-entropy (§2.7). DeepSeek-V3 adds an MTP loss with depth 1 [S1].
- Optimiser: AdamW. DeepSeek-V3 uses β₁ 0.9, β₂ 0.95, weight decay 0.1, peak LR 2.2e-4 after a 2K-step linear
  warm-up, then constant, then cosine decay. It uses a batch-size schedule, sequence length 4K, and gradient clip 1.0 [S1].
  Llama 3 peak LRs: 3e-4 (8B), 1.5e-4 (70B), 8e-5 (405B) [S2]. Kimi K2 uses the Muon optimiser (MuonClip) [S25].
- Batch: Llama 3 405B ran 16M tokens per batch at sequence length 8,192 [S2].
- **Precision:** BF16 is the default. DeepSeek-V3 ran its GEMMs (Fprop, Dgrad, Wgrad) in FP8 with fine-grained
  1×N_c tile and N_c×N_c block scaling, while sensitive operators stayed in higher precision [S1].
  DeepSeek-V4 ships its MoE experts in FP4 and other weights in FP8 [S26].

### 4.3 Scaling laws
- **Kaplan 2020:** L(N) = (N_c/N)^{α_N}, α_N ≈ 0.076, N_c ≈ 8.8e13; L(D) = (D_c/D)^{α_D}, α_D ≈ 0.095,
  D_c ≈ 5.4e13; L(C_min) with α_C ≈ 0.050. The optimal-allocation fit is N ∝ C^0.73 [S7]. Read naively, it
  says to scale model size much faster than data.
- **Chinchilla 2022:** L(N,D) = E + A/N^α + B/D^β. For each doubling of model size, double the tokens.
  Chinchilla (70B, 1.4T, same compute as the 280B Gopher) reached MMLU 67.5% [S5]. Fitted values: E 1.6934,
  A 406.4, B 410.7, α 0.3392, β 0.2849 [S6 quoting S5].
- **Replication (Besiroglu et al. 2024):** the parametric fit was inconsistent (it implied ≈70 tokens/param).
  The re-estimate is E 1.8172, A 482.01, B 2085.43, α 0.3478, β 0.3658, which gives "around 20 tokens per
  parameter", consistent with the original paper's other two methods [S6].
- **Rule of thumb (derived):** with D = 20N, C = 6·N·20N = 120N², so N_opt = √(C/120).
  - C = 5.76e23 (Chinchilla) → 69B / 1.4T ✓.
  - C = 3.8e25 (Llama 3 405B budget) → 563B / 11.3T. Meta reports its own data-specific laws made 405B "approximately compute-optimal" [S2].
  - C = 9.4e26 → 2.8T / 56T.
- **Revisions in practice:** inference-aware training goes far past 20 tokens/param (§3.3). Test-time compute
  adds a second scaling axis (§4.6, §9).

### 4.4 Parallelism
- **Data parallel (DP):** each GPU holds a full replica; gradients are all-reduced. **ZeRO/FSDP:** shard optimiser
  state, gradients and parameters across DP ranks. Mixed-precision Adam needs 16 bytes per parameter
  (2 weights + 2 gradients + 12 for the FP32 master copy plus moments), which ZeRO partitions [S60]. It trained
  >100B models on 400 GPUs at 15 PFLOPS [S60].
- **Tensor parallel (TP):** split each matrix across GPUs. It needs NVLink-class bandwidth and is kept inside one
  NVLink domain (8 GPUs on HGX; 72 on NVL72).
- **Pipeline parallel (PP):** split layers into stages, using micro-batches to hide the pipeline "bubble".
- **Context/sequence parallel (CP/SP):** split a long sequence across GPUs.
- **Expert parallel (EP):** place different experts on different GPUs, linked by all-to-all communication [S1].
- Llama 3 405B used "4D" TP + CP + PP + FSDP. On 8,192 GPUs it ran TP8 × PP16 × DP64 at 430 TFLOPs/GPU,
  43% BF16 MFU; the reported MFU range is 38–43% [S2].

### 4.5 Compute-budget worked example (all arithmetic shown, derived)
Assumptions: dense 70B, 15T tokens, H100 SXM BF16 dense peak 989 TFLOP/s [S8], MFU 40% (inside Llama 3's
38–43% [S2]), $2.00–3.00 per GPU-hour (assumed market range; UNVERIFIED as a price), 1.275 kW per GPU of IT
power (DGX H100 system maximum 10.2 kW ÷ 8 [S70]), PUE 1.2 (assumed).
1. C = 6 × 70e9 × 15e12 = **6.30e24 FLOP**.
2. Sustained per GPU = 989e12 × 0.40 = 3.956e14 FLOP/s.
3. GPU-seconds = 6.30e24 / 3.956e14 = 1.593e10 s → **4.42M GPU-hours**.
4. Wall-clock: on 16,384 GPUs, 270 h = **11.3 days**; on 4,096 GPUs, 45 days. Excludes restarts. Llama 3
   achieved >90% effective training time [S2].
5. Cost: $8.85M at $2, $11.06M at $2.50, $13.27M at $3 per GPU-hour.
6. Energy: IT = 4.42M × 1.275 kW = **5.64 GWh**. Facility at PUE 1.2 = **6.77 GWh**. GPU-board-only
   (700 W) = 3.10 GWh.
7. Average facility power while running on 16,384 GPUs = 16,384 × 1.275 × 1.2 = **25.1 MW**.

Cross-checks:
- **Llama 3.1 405B:** Meta reports 30.84M H100 GPU-hours [S69]. 3.8e25 / (30.84e6 × 3600 s) = 342 TFLOP/s per
  GPU average, i.e. 34.6% of the 989 TF dense peak. That sits below the 38–43% steady-state MFU because the
  GPU-hours include downtime and context extension (derived). 30.84M GPU-h ÷ 16,384 GPUs = 78 days.
  Epoch estimates the training power draw at ≈22.6 MW [S65], consistent with step 7.
- **DeepSeek-V3:** 6 × 37e9 × 14.8e12 = 3.29e24 FLOP over 2.664M pre-training GPU-hours = 343 TFLOP/s per
  GPU. That is 35% of the BF16 dense peak or 17% of the FP8 dense peak (1,979 TF), assuming H800 ≈ H100
  compute (derived; the H800 peak is not separately sourced, UNVERIFIED). On the 2,048-GPU cluster, 2.788M
  GPU-h = 56.7 days. The $5.576M covers the final run only at a rented-H800 rate and "excludes the costs
  associated with prior research and ablation experiments" [S1]. The R1 RL stage was reported in Nature as
  $294k on 512 H800s for 80 hours [S73]. 512 × 80 = 40,960 GPU-h, which is $82k at $2, so the $294k evidently
  includes more than that one run; the composition was not verified.

### 4.6 Post-training
- **SFT:** supervised fine-tuning on demonstration (prompt, response) pairs.
- **RLHF (PPO):** train a reward model on human preference pairs, then optimise the policy with PPO plus a KL
  penalty to the SFT model. A 1.3B InstructGPT was preferred to 175B GPT-3 by human raters [S52].
- **DPO:** solve the RLHF objective in closed form as a classification loss on preference pairs. No reward
  model and no RL loop [S53].
- **Constitutional AI / RLAIF:** the model critiques and revises its own outputs against written principles, and
  AI preference labels replace human ones for harmlessness [S55].
- **GRPO:** sample a group of G answers per prompt. Each answer's advantage is its reward standardised within the
  group, A_i = (r_i − mean(r)) / std(r), so no value/critic network is needed. A KL term to a reference policy
  remains [S54]. Introduced in DeepSeekMath 7B (51.7% on MATH; 60.9% with 64-sample self-consistency) [S54], and
  used for DeepSeek-R1's large-scale RL [S4].
- **RLVR (RL with verifiable rewards):** the reward is a program (unit tests pass, the maths answer matches)
  instead of a learned model. R1's thesis: reasoning "can be incentivized through pure reinforcement learning,
  obviating the need for human-labeled reasoning trajectories" [S4].
- **Reasoning models / test-time compute:** the model emits a long chain of thought before answering. Spending
  more tokens raises accuracy. Snell et al.: compute-optimal test-time scaling is >4× more efficient than
  best-of-N, and in FLOP-matched tests it can beat a 14× larger model on problems the small model can partly
  solve [S57]. Verifiers (process reward models, unit tests) rank or prune candidates.
- **Agentic post-training:** gpt-oss exposes "configurable reasoning effort" (low/medium/high). SWE-bench rises
  from 47.9 (low) to 52.6 (medium) to 62.4 (high) [S24]. The Claude API exposes "effort" and adaptive thinking [S27].

### 4.7 Distillation
- **Definition:** train a small student to imitate a large teacher. **Logit (soft-label) distillation** minimises
  KL(teacher ∥ student) over the full next-token distribution at temperature T, scaling the loss by T² [S56].
  **Sequence-level distillation** fine-tunes the student on text the teacher generated. This is plain SFT and needs
  only the teacher's outputs, not its logits.
- **DeepSeek-R1-Distill:** sequence-level SFT on R1-generated samples (800k according to the R1 paper; that number
  was not re-quoted this session, UNVERIFIED), into Qwen2.5 and Llama 3 bases [S4].

| Student (base) | AIME24 pass@1 | MATH-500 | GPQA-D | LiveCodeBench | CF rating |
|---|---|---|---|---|---|
| R1-Distill-Qwen-1.5B (Qwen2.5-Math-1.5B) | 28.9 | 83.9 | 33.8 | 16.9 | 954 |
| R1-Distill-Qwen-7B (Qwen2.5-Math-7B) | 55.5 | 92.8 | 49.1 | 37.6 | 1189 |
| R1-Distill-Qwen-14B (Qwen2.5-14B) | 69.7 | 93.9 | 59.1 | 53.1 | 1481 |
| R1-Distill-Qwen-32B (Qwen2.5-32B) | 72.6 | 94.3 | 62.1 | 57.2 | 1691 |
| R1-Distill-Llama-70B (Llama-3.3-70B-Instruct) | 70.0 | 94.5 | 65.2 | 57.5 | 1633 |
| Reference: o1-mini | 63.6 | 90.0 | 60.0 | 53.8 | 1820 |
| Reference: GPT-4o-0513 | 9.3 | 74.6 | 49.9 | 32.9 | 759 |
| Teacher DeepSeek-R1 (AIME24) | 79.8 | — | — | — | — |
[S4, HF model card]

- **Retention (derived):** the 32B student keeps 72.6/79.8 = 91% of the teacher's AIME score while holding
  4.8% of its total parameters (32/671).
- **Qwen3 strong-to-weak distillation:** "significantly better performance than reinforcement learning while
  requiring approximately only 1/10 of the GPU hours" [S3].
- **Legal note:** some API terms forbid using outputs to train competing models. Check the licence before
  distilling from any model.

### 4.8 Fine-tuning for practitioners: LoRA / QLoRA
- **LoRA:** freeze W ∈ ℝ^{d_out×d_in} and learn ΔW = B·A, with B ∈ ℝ^{d_out×r}, A ∈ ℝ^{r×d_in}, r ≪ d,
  scaled by α/r. Trainable parameters per adapted matrix = r·(d_in + d_out). On GPT-3 175B it gives 10,000×
  fewer trainable parameters and 3× less GPU memory than full Adam fine-tuning, with no added inference latency
  once merged [S34].
- **Worked example (derived):** Llama 3 8B, rank 16, all linear layers (q, k, v, o, gate, up, down); d = 4,096,
  KV dim 1,024, FFN 14,336, 32 layers.
  Per layer = 16 × [(4096+4096) + 2×(4096+1024) + (4096+4096) + 3×(4096+14336)] = 1,310,720 parameters.
  × 32 = **41.9M** trainable (0.52% of 8.03B).
- **QLoRA:** the frozen base is stored in 4-bit NormalFloat (NF4) with double quantisation (≈0.127 bits/param of
  constants, from the paper body; not re-quoted this session). Paged optimisers handle memory spikes. Result:
  fine-tune 65B on a single 48 GB GPU while preserving 16-bit fine-tuning performance; Guanaco reached 99.3% of
  ChatGPT on Vicuna in 24 h on one GPU [S35].
- **Memory formula (derived):**
  - Full fine-tune ≈ 16 B/param + activations [S60]: 8B → 128 GB; 70B → 1.13 TB; 405B → 6.5 TB.
  - LoRA (BF16 base) ≈ 2 B/param base + 16 B per trainable param + activations.
  - QLoRA ≈ 0.516 B/param base (4.127 bits) + 16 B per trainable param + activations. 8B → 4.1 GB base;
    70B → 36.4 GB base.
- **Hardware guide (derived):**
  - 7–8B: QLoRA on a 12–24 GB GPU; LoRA BF16 on 24–32 GB (RTX 4090/5090); full fine-tune needs ≥128 GB
    sharded (2× H100).
  - 14B: QLoRA on 24 GB; LoRA on 48–80 GB.
  - 70B: QLoRA on one 48–80 GB GPU; LoRA BF16 on 2–4× 80 GB; full fine-tune needs ≥16× 80 GB (a 2-node HGX).
  - Activations depend on sequence length and batch, and gradient checkpointing trades compute for memory.

### 4.9 Quantization
- **Memory** = N × bits/8. Llama-3.1-8B in GGUF [S39]: F16 16.0 bpw / 14.96 GiB · Q8_0 8.50 / 7.95 · Q6_K 6.56 / 6.14
  · Q5_K_M 5.70 / 5.33 · Q4_K_M 4.89 / 4.58 · IQ4_XS 4.46 / 4.17 · Q3_K_M 4.00 / 3.74 · Q2_K 3.16 / 2.95.
  Effective bpw exceeds the nominal bits because block scales are stored alongside the weights.
- **LLM.int8():** cuts inference memory in half with no degradation, by keeping outlier dimensions in 16-bit;
  >99.9% of values are still multiplied in 8-bit [S38].
- **GPTQ:** one-shot second-order post-training quantisation to 3–4 bits; 175B is quantised in ≈4 GPU-hours with
  negligible accuracy loss [S36].
- **AWQ:** protect the ≈1% salient weights chosen by *activation* magnitude; TinyChat runs >3× faster than HF FP16 [S37].
- **FP8 / FP4 (hardware formats):** E4M3/E5M2 FP8 on Hopper/Blackwell/MI355X. NVFP4 and MXFP4 on Blackwell and
  MI355X [S10][S13]. gpt-oss ships MoE weights in MXFP4 so that 117B fits on one 80 GB GPU [S24].
- **Quality cost:** 8-bit is near lossless [S38]. 4-bit is usually small but task-dependent. Below 3 bits the loss
  rises sharply. llama.cpp measures it with perplexity and KL divergence against FP16 [S39].
- **Weight memory examples (derived):**
  - 70B: BF16 141 GB, FP8 71 GB, Q4_K_M 43 GB.
  - DeepSeek-V3 671B: FP8 671 GB. Fits 8× H200 (1,128 GB) but not 8× H100 (640 GB).
  - Llama 4 Scout: int4 ≈ 55 GB, which fits one H100, consistent with Meta's "single H100" claim [S23].

---

## 5. "Uncensored" and abliterated models (factual and neutral)

- **Refusal training:** during SFT/RLHF/constitutional training, models learn to decline certain requests (§4.6)
  [S52][S55]. With open weights, users can modify that behaviour.
- **What the research found:** Arditi et al. show that refusal "is mediated by a one-dimensional subspace, across 13
  popular open-source chat models up to 72B" [S40]. They take the difference in mean residual-stream activations
  between harmful and harmless prompts and call it the "refusal direction". Two interventions follow:
  - *Directional ablation* at inference zeroes that component in every residual activation.
  - *Weight orthogonalisation* edits the weights so they never write to that direction. This is the technique
    the community calls "abliteration".
- **Measured effects [S40]:** refusal on JailbreakBench harmful prompts drops sharply. Adding the direction makes
  models refuse harmless prompts. Attack success ranged from 79–84% on Qwen models to 4–23% on Llama-2.
  MMLU, ARC and GSM8K were largely preserved, and TruthfulQA fell 1–3.5 points.
- **Fine-tuning route:** SFT on data that contains no refusals achieves the same effect more coarsely. It can also
  degrade other behaviours (general knowledge, not quantified in sources here).
- **What it does not do:** neither method adds knowledge or capability. It removes a learned behaviour. The model's
  factual errors and hallucinations are unchanged.
- **The authors' ethics statement:** the method "marginally lowers the bar for jailbreaking open-source model
  weights", but they argue it "does not substantially alter the risk profile of open sourcing models" given
  that fine-tuning already worked [S40].
- **Licences and responsibilities:** open-weight licences still bind derivatives. The Llama 4 Community License
  requires compliance with Meta's Acceptable Use Policy and a separate licence above 700M MAU [S23]. Apache 2.0
  (Qwen3, gpt-oss) and MIT (DeepSeek) impose no use policy, but the deployer remains liable under applicable law.
  The EU AI Act (Regulation (EU) 2024/1689) places obligations on general-purpose AI model providers from
  2 August 2025 (from the regulation text; not re-fetched this session, so treat the date as UNVERIFIED here). An
  operator who hosts a modified model is the responsible deployer.
- **Editorial position for the site:** describe the mechanism (it is a published, peer-reviewed interpretability
  result), cite [S40], and give no procedure, code or model links.

---

## 6. Inference engines and serving

### 6.1 Two phases
- **Prefill:** process the whole prompt in one parallel pass. It is compute-bound: 2·N·n_prompt FLOPs, and it
  fills the KV cache.
- **Decode:** generate one token per step per sequence. Each step reads all the weights plus the KV cache for a
  tiny amount of compute, so it is **memory-bandwidth-bound** (§6.5).

### 6.2 Metrics
- **TTFT** (time to first token) ≈ queueing + prefill time.
- **TPOT / ITL** (time per output token / inter-token latency) = the decode step time.
- **Throughput** = total tokens/s per GPU or node.
- **Goodput** = requests/s that meet both TTFT and TPOT SLOs. DistServe served "7.4x more requests or 12.6x tighter
  SLO" by disaggregating [S44].

### 6.3 Engines
- **vLLM / PagedAttention:** the KV cache is stored in fixed-size blocks, like OS virtual-memory pages, so memory is
  allocated on demand and blocks can be shared across requests (prefix sharing, parallel sampling). Existing
  systems used only "20.4%–38.2%" of their KV memory for actual token states; vLLM achieves "near-zero waste" and
  2–4× throughput at the same latency versus FasterTransformer and Orca [S30]. vLLM's disaggregated prefill lets
  TTFT and ITL be tuned separately and controls tail ITL; it "DOES NOT improve throughput" and is marked
  experimental. Connectors include NIXL, LMCache and Mooncake [S63].
- **SGLang / RadixAttention:** a radix tree of cached prefixes for automatic KV reuse across calls, plus a
  front-end language for structured programs. Up to 6.4× throughput on agent, JSON, RAG and multi-turn workloads [S31].
- **TensorRT-LLM:** NVIDIA's compiled engine with in-flight batching, FP8/FP4 kernels and paged KV (background;
  docs not re-read this session).
- **llama.cpp / Ollama:** C/C++ inference on CPU, Apple Metal, CUDA and ROCm using GGUF quantised weights [S39].
  Ollama wraps llama.cpp (background).
- **Continuous (in-flight) batching:** finished sequences leave and new ones join at every decode step, instead of
  waiting for a whole batch to finish. vLLM, SGLang and TRT-LLM all do this [S30][S31].
- **Prefix caching:** reuse the KV cache for a shared system prompt or document. API vendors price cache reads at
  2.5–10% of normal input [S27].
- **Disaggregated prefill/decode:** run prefill and decode on separate GPU pools and ship the KV cache between them
  over NVLink or RDMA [S44][S63]. DeepSeek deploys it at scale: the decode unit is 320 GPUs [S1].

### 6.4 The roofline in one paragraph
Attainable FLOP/s = min(peak FLOP/s, arithmetic intensity × memory bandwidth). Arithmetic intensity = FLOPs ÷ bytes
moved. The **ridge point** is peak ÷ bandwidth (derived):

| Device | Precision | Peak (dense) | BW | Ridge FLOP/byte |
|---|---|---|---|---|
| H100 SXM | BF16 | 989 TF [S8] | 3.35 TB/s | 295 |
| H100 SXM | FP8 | 1,979 TF [S8] | 3.35 | 591 |
| H200 | BF16 | 989 TF [S9] | 4.8 | 206 |
| B200 (DGX) | FP8 | 9 PF (= 72 PF ÷ 8) [S12] | 8 | 1,125 |
| MI355X | FP8 | 5 PF [S13] | 8 | 625 |

The B200 FP8 figure comes from DGX B200's "FP8 72 PFLOPS". Whether that figure is sparse or dense is not stated on
the page, so the ridge point is UNVERIFIED (562 if sparse).

Decode at batch B with weights at b bytes/param: FLOPs = 2·N·B and bytes ≈ N·b, so intensity ≈ 2B/b FLOP/byte.
BF16 (b = 2) gives intensity ≈ B. Decode only becomes compute-bound at a batch of about 200–300 on Hopper, and the
KV cache usually runs out first. Prefill with a 4,000-token prompt has intensity ≈ 4,000 and is compute-bound.

### 6.5 Worked decode ceilings at batch 1 (tokens/s ≤ bandwidth ÷ weight bytes; derived)

| Model / precision | Hardware (BW) | Weight bytes | Ceiling tok/s |
|---|---|---|---|
| 8B BF16 | RTX 4090 (1,008 GB/s) | 16.1 GB | 63 |
| 8B Q4_K_M | RTX 4090 | 4.9 GB | 205 |
| 8B Q4_K_M | RTX 5090 (1,792 GB/s) | 4.9 GB | 364 |
| 70B Q4_K_M | Mac Studio M3 Ultra (819 GB/s) | 43.2 GB | 19 |
| 70B Q4_K_M | M4 Max (546 GB/s) | 43.2 GB | 13 |
| 70B FP8 | H100 (3.35 TB/s) | 70.6 GB | 47 |
| 70B FP8 | H200 (4.8 TB/s) | 70.6 GB | 68 |
| 70B FP8 | B200 / MI355X (8 TB/s) | 70.6 GB | 113 |

Bandwidth sources: [S15] (5090: 512-bit × 28 Gbps ÷ 8 = 1,792 GB/s, derived from NVIDIA's bus width and the
reported 28 Gbps), [S71], [S8], [S9], [S12], [S13]. The RTX 4090's 1,008 GB/s is from secondary sources [S15b].
Real engines reach roughly 50–80% of the ceiling. That range is an engineering rule of thumb, UNVERIFIED as a
sourced figure.

### 6.6 Batching and cost per million tokens (derived)
Setup: Llama 3 70B in FP8 (70.6 GB) on one H200 (141 GB, 4.8 TB/s, 1,979 TF FP8 dense). Average context 4,096
tokens with a BF16 KV cache (1.34 GB per sequence). $3.50/GPU-h (assumed rental, UNVERIFIED). 1.3 kW all-in IT
power per GPU (assumed, from [S70]). "eff" is the fraction of ideal bandwidth achieved (assumed).

Step time = max((W + B·KV) / BW, 2·N·B / peak) / eff.

| Batch | Memory used | Step (eff 1.0 / 0.6) | Per-user tok/s | Total tok/s | $/M tokens | J per token |
|---|---|---|---|---|---|---|
| 1 | 72 GB | 15.0 / 25.0 ms | 67 / 40 | 67 / 40 | 14.57 / 24.29 | 19.5 / 32.5 |
| 8 | 81 GB | 16.9 / 28.2 ms | 59 / 35 | 472 / 283 | 2.06 / 3.43 | 2.8 / 4.6 |
| 16 | 92 GB | 19.2 / 32.0 ms | 52 / 31 | 834 / 500 | 1.17 / 1.94 | 1.6 / 2.6 |
| 32 | 114 GB | 23.7 / 39.4 ms | 42 / 25 | 1,353 / 812 | 0.72 / 1.20 | 0.96 / 1.6 |

Lessons:
- Batching cuts cost per token 12–20× while per-user speed falls only about 37%.
- The KV cache, not compute, ends the batch growth. Compute time at B = 32 is just 2.3 ms against a 23.7 ms memory time.
- At about 1 J/token, a 1,000-token answer is about 1 kJ ≈ 0.27 Wh. That is the same order as the vendor
  per-prompt figures of 0.24–0.3 Wh [S18][S66]. This is an illustration, not a measurement.
- **TTFT example:** a 4,000-token prompt takes 2 × 70.6e9 × 4,000 = 5.65e14 FLOP. At 50% of 1,979 TF that is
  ≈0.57 s on one H200 (derived; MFU assumed).

---

## 7. Hardware ladder (what fits, what it draws, how it is cooled)

Memory rule for serving: weights (N × bytes) + KV (§2.6) + about 10–20% runtime overhead (engine workspace,
activations; rule of thumb, UNVERIFIED). Training needs ≈16 B/param plus activations [S60].

| Level | Example (verified specs) | Memory / BW | Power | Serve (fits) | Fine-tune | Train from scratch |
|---|---|---|---|---|---|---|
| L0 Laptop / desktop SoC | Apple M4 Max; Mac Studio M3 Ultra | up to 128 GB @ 546 GB/s; up to 512 GB @ 819 GB/s [S71] | tens–hundreds of W (not sourced) | M4 Max: 70B Q4 (43 GB). M3 Ultra: DeepSeek-V3 at ≈4-bit (≈336–410 GB) fits in 512 GB (derived) | QLoRA ≤ 8B (slow) | toy models only |
| L1 Workstation GPU | RTX 4090 24 GB, 1,008 GB/s; RTX 5090 32 GB GDDR7, 1,792 GB/s, 575 W, 1,000 W PSU [S15] | 24–32 GB | 0.45–0.6 kW per card | 8B BF16; 14B Q8; 32B Q4 (≈20 GB, derived) | QLoRA 8–14B; LoRA 8B | <1B research |
| L2 Single server | HGX/DGX H100 8×80 GB (10.2 kW) [S70][S8]; H200 141 GB 4.8 TB/s [S9]; DGX B200 8×180 GB, 64 TB/s, 14.3 kW [S12]; MI355X 288 GB, 8 TB/s, 1,400 W [S13] | 640 GB – 2.3 TB per node | 10–15 kW per node (air or liquid) | 70B BF16; 405B FP8 on H200/B200; DeepSeek-V3 FP8 on 8×H200/B200 | full fine-tune 8B; LoRA 70B; QLoRA 405B (derived) | ≤ 7B on ≤1T tokens takes months (derived from §4.5 formula) |
| L3 Rack | GB200 NVL72: 72 GPUs + 36 Grace, 13.4 TB HBM3E, 576 TB/s, NVLink 130 TB/s [S10]; GB300 NVL72: 20 TB HBM, 800 Gb/s/GPU NICs [S11] | 13.4–20 TB in one NVLink domain | 132 kW nominal TDP, ≈192 kW peak electrical design (HPE) [S68]; 1.83 kW per GPU (derived) | trillion-parameter MoE with long context (Kimi K2 1T FP8 ≈ 1 TB, derived) | full fine-tune of 70B (1.13 TB) fits in HBM | 70B in months (derived) |
| L4 Pod / cluster | Ironwood pod: 9,216 TPUs, 42.5 EF FP8, ≈10 MW, liquid-cooled [S14]; Vertiv/NVIDIA 7 MW GB200 reference architecture [S68] | scale-out over InfiniBand/RoCE at 400–800 Gb/s per GPU [S2][S11] | 7–30 MW | — | — | Llama 3 405B class: 16K H100s, ≈25 MW (derived) |
| L5 Frontier campus | xAI Colossus: built in 122 days, then doubled in 92 days to 200k GPUs [S19]. Stargate Abilene: 1.2 GW planned, full capacity estimated Q4 2026 [S20], GB200, GPT-5.5 trained there [S21] | 100k–1M GPUs | 0.15–2 GW | — | — | frontier runs of ≈1e26–1e27 FLOP [S65] |

Notes for the operator audience:
- **Rack density.** An HGX H100 node (10.2 kW) is already 2–3× a classic 4–8 kW enterprise rack (classic range
  is industry norm, not sourced here). NVL72 at 132 kW nominal needs direct-to-chip liquid cooling. Vertiv's
  reference design supports "up to 132kW per rack" with hybrid liquid and air cooling [S68].
- **Liquid cooling.** GB200/GB300 NVL72 and Ironwood are liquid-cooled [S10][S11][S14]. Google says liquid can
  "reliably sustain up to twice the performance of standard air cooling" [S14].
- **Power quality.** Synchronous training makes power swing by tens of MW within seconds [S2]. UPS, generator and
  utility interconnects have to be designed for that load step. Cross-link the site's article 23 (Colossus).
- **Cluster power examples (derived):**
  - 100k H100 × 1.275 kW = 127.5 MW IT, ≈153 MW at PUE 1.2. This matches the ≈150 MW public figure for Colossus
    phase 1 in the site's article 23.
  - 100k GB200 = 1,389 NVL72 racks × 132 kW = 183 MW IT, ≈220 MW at PUE 1.2. Epoch's GPT-6 Astra power estimate
    is ≈233 MW [S65].
  - Ironwood: 10 MW ÷ 9,216 chips = 1.09 kW per chip all-in [S14].
- **Colossus scale beyond 200k GPUs** (secondary sources: 555k GPUs / ≈2 GW; Colossus 2 at 1–1.5 GW in 2026) is
  UNVERIFIED. Epoch's dashboard lists "Colossus 2" at 1.1M H100-equivalents [S64].
- **Inference ASICs:**
  - *Groq LPU (GroqChip):* 230 MB on-die SRAM at 80 TB/s, 750 TOPS INT8 / 188 TFLOPS FP16 @ 900 MHz, 14 nm, 26.8B
    transistors, 215 W TDP (300 W max). The compiler schedules every operation deterministically [S17]. With only
    230 MB per chip, a 70B FP8 model needs ≈307 chips for weights alone (70.6 GB / 230 MB, derived). That is why
    Groq deploys many-chip racks.
  - *Cerebras WSE-3:* 4T transistors, 900k cores, 46,225 mm², 44 GB on-wafer SRAM at 21 PB/s, 125 PF FP16 (sparse,
    per datasheet footnote), CS-3 system ≈27 kW, 16 RU, liquid-cooled [S16]. Cerebras's current web page says
    "250 petaflops" for "WSE-3 Turbo". The two figures disagree and the basis of the second is not stated, so
    report 125 PF (sparse, datasheet) and note the Turbo claim [S16].
  - *Google TPU v7 Ironwood:* 4,614 TFLOPs FP8, 192 GB HBM, 7.37 TB/s, 1.2 TB/s ICI per chip [S14].
- **Rubin:** Vera Rubin NVL144 is reported for H2 2026 with 288 GB HBM4 per GPU, ≈3.6 EF FP4 inference per rack and
  ≈120–130 kW per rack. These come from secondary reporting of NVIDIA's GTC roadmap; NVIDIA's product page was not
  found (404), so the figures are **UNVERIFIED** [S75].
- **Rough capex:** UNVERIFIED (no primary price lists). Present only as "order of magnitude" with an explicit caveat,
  or omit.

---

## 8. Agentic AI and harnesses

### 8.1 Concepts
- **Tool use / function calling:** the model emits a structured call (a JSON function name and arguments). The
  harness executes it and returns the result as a new message. The model never runs code itself.
- **ReAct:** interleave Reason → Act → Observe. On ALFWorld/WebShop it beat imitation and RL methods by 34 and
  10 absolute points with one or two in-context examples [S42].
- **Workflows vs agents (Anthropic, 2024-12-19):** "Workflows are systems where LLMs and tools are orchestrated
  through predefined code paths. Agents are systems where LLMs dynamically direct their own processes and tool
  usage." Patterns: prompt chaining, routing, parallelisation, orchestrator-workers, evaluator-optimiser. Advice:
  start simple and design the agent-computer interface (ACI) as carefully as a human UI [S62].
- **MCP (Model Context Protocol):** JSON-RPC 2.0 between *hosts* (LLM apps), *clients* (connectors) and *servers*.
  Servers expose **resources**, **prompts** and **tools**; clients may offer **elicitation**. Spec revision
  2026-07-28. Its security principles: user consent and control, data privacy, and tool safety. Tools "represent
  arbitrary code execution", and tool descriptions are untrusted unless the server is trusted [S61].
- **Memory:** in-context (the window itself), retrieval memory (vector or keyword store), and persisted notes or
  files. Context management covers summarisation/compaction, sub-agents with their own windows, and prompt caching.
- **Harness design checklist:** a tight tool set with clear schemas [S62]; a verification step (tests, linters,
  evaluator model); a sandbox (container, no secrets, network egress control); budgets (max steps, tokens, wall
  time); human approval for irreversible actions [S61]; logging and replay; evals.
- **Multi-agent orchestration:** an orchestrator-worker pattern with parallel sub-agents. It costs tokens linearly
  with the number of agents, so it is worth it only when the subtasks are separable [S62].

### 8.2 Cost and latency budget (derived example)
An agent loop of 30 steps, each re-sending a 40k-token context and generating 800 tokens, at Sonnet 5.5 prices
($2 in, $10 out [S27]):
- Uncached input: 30 × 40,000 = 1.2M tokens → $2.40. Output: 30 × 800 = 24k tokens → $0.24. Total ≈ $2.64.
- With prompt caching (cache reads at 5% of the input price [S27]): input ≈ 1.2M × $0.10/M = $0.12 plus cache
  writes (not modelled), so the total falls to about $0.36.
- Latency: 30 × (TTFT + 800 × TPOT). At an assumed 0.5 s + 800 × 20 ms ≈ 16.5 s per step, the run takes ≈8 min (assumed rates).

### 8.3 Failure modes
- **Hallucination:** the sampler always produces *some* plausible token sequence (§2.7). It must be checked by tools or retrieval.
- **Prompt injection:** instructions hidden in retrieved web pages, files or tool output hijack the agent. MCP's
  spec treats tool descriptions as untrusted [S61]. Mitigations: least-privilege tools, human confirmation, and
  isolating untrusted content.
- **Loops and drift:** repeated tool calls or a forgotten goal. Mitigations: step and token budgets, and progress checks.
- **Over-trust in self-verification:** a model grading itself shares its own blind spots. Use external checks (tests).

### 8.4 Evaluation
- **SWE-bench:** 2,294 real GitHub issues from 12 Python repositories. At launch the best model (Claude 2) solved
  1.96% [S58]. On the official SWE-bench Verified leaderboard (swebench.com data, read 2026-10-16), the top entry is
  79.2% (Claude 4.5 Opus with Sonar Foundation Agent, and with live-SWE-agent, Dec 2025), followed by 78.8%
  (TRAE + Doubao-Seed-Code) and 77.4% (live-SWE-agent + Gemini 3 Pro Preview) [S22].
  Vendor and aggregator claims of 93–97% for 2026 models (Claude Opus 5 / Fable 5, GPT-5.x, DeepSeek V4) are
  **UNVERIFIED**: they do not appear on the official board, and the aggregators disagree with each other.
  Vendor-run examples: gpt-oss-120b 62.4 at high effort [S24]; Kimi K2 65.8 [S25].
- **GAIA:** 466 real-assistant questions. Humans score 92% against 15% for GPT-4 with plugins (2023); answers to
  300 questions are held back for the leaderboard [S43]. Current leaderboard values could not be read (dynamic
  page), so they are UNVERIFIED.
- **Benchmark caveats:** contamination, saturation, harness-dependence (the same model scores differently under
  different agent scaffolds, as visible in [S22]), and pass@1 versus pass@k.

### 8.5 RAG vs long context vs fine-tuning (decision guide)
| Need | Best tool | Why |
|---|---|---|
| Facts that change often or are private | RAG (retrieve, then generate) | Fresh, citable, cheap to update. Cost grows with the chunks retrieved |
| One large document set per session (≤1M tokens) | Long context plus prompt caching | Current windows are 1M tokens [S27][S28][S26]. Cache reads cost 2.5–10% of input [S27]. KV memory is the server's problem (§2.6) |
| A behaviour, format, tone or narrow skill | Fine-tune (LoRA) | Changes how the model answers, not what it knows (§4.8) |
| Smaller and cheaper at a fixed task | Distil (§4.7) | A 32B student keeps 91% of R1's AIME score [S4] |

---

## 9. Frontier and limits

- **Compute trend:** frontier LLM training compute has grown about 5× per year since 2020. Training cost has grown
  about 3.5× per year. Chip price-performance has improved about 49% per year since 2023 (dashboard updated
  2026-02-05) [S64].
- **Largest known runs (Epoch "frontier models" CSV, read 2026-10-16) [S65]:**

| Model | Date | Est. training FLOP | Confidence | Hardware | Est. power |
|---|---|---|---|---|---|
| GPT-6 Astra | 2026-09-03 | 9.4e26 (CI ≈5e26–2e27) | Likely | ≥100k GB200, Abilene | ≈233 MW |
| Grok 4 | 2025-07-09 | 5.0e26 | Speculative | ≈200k GPUs | — |
| GPT-4.5 | 2025-02-27 | 3.8e26 | Likely | — | — |
| Grok 3 | 2025-02-17 | 3.5e26 | Likely | ≈80k H100 | ≈110 MW |
| Llama 4 Behemoth (preview) | 2025-04-05 | 5.2e25 | Likely | H100 | ≈44 MW |
| Llama 3.1 405B | 2024-07-23 | 3.8e25 | Confident | 16,384 H100 | ≈22.6 MW |

  14 models in the dataset exceed 1e25 FLOP and 4 exceed 1e26 [S65]. Epoch's GPT-6 Astra estimate assumes ≈100k
  GB200 for 90 days at 25% FP8 MFU [S65]. Implied sustained rate (derived) = 9.4e26 / (1e5 × 90 × 86,400 s) =
  1.21 PFLOP/s per GPU.
- **Data wall:** the public human text stock could be exhausted by 2026–2032 [S41]. The responses are synthetic
  data (Qwen3 used "trillions" of synthetic tokens [S3]), multimodal data, RL on verifiable tasks [S4], and
  distillation [S3].
- **Test-time compute:** a second scaling law. Accuracy rises with thinking tokens [S57][S24]. This moves cost from
  training to inference, which means more data-center capacity for serving.
- **Energy:**
  - Per query: the median Gemini Apps text prompt is 0.24 Wh, 0.03 gCO₂e and 0.26 mL water, with energy per prompt
    down 33× in 12 months (Google, Aug 2025) [S18]. Epoch estimates ≈0.3 Wh per typical GPT-4o query, against an
    older 3 Wh claim [S66]. Long reasoning or agent runs can be one to two orders of magnitude more, because energy
    scales with tokens (derived from §6.6; not measured).
  - Aggregate: data centres used about 415 TWh in 2024 (≈1.5% of world electricity), projected at ≈945 TWh in 2030.
    The US accounts for 45% of data-centre use [S67].
  - Scale illustration (derived): 1 billion prompts per day at 0.24 Wh = 240 MWh/day ≈ 10 MW average.
- **Open vs closed:** open-weight frontier MoEs (DeepSeek-V4-Pro 1.6T [S26], Kimi K2 1T [S25], Qwen3 [S3], gpt-oss
  [S24]) under MIT or Apache licences, against closed models with undisclosed sizes [S27][S28][S29]. On the official
  SWE-bench board the gap between top closed and open entries is small (79.2 vs 78.8, the latter a vendor agent
  around Doubao-Seed-Code, whose weights may not be open: UNVERIFIED) [S22].
- **What is known about frontier runs:** compute and power come from Epoch estimates, built on vendor statements
  about cluster sizes [S65]. OpenAI states GPT-5.5 was trained at Stargate Abilene on GB200 systems [S21]. xAI states
  Colossus reached 200k GPUs [S19]. Exact closed-model FLOPs, costs and parameter counts are **not public**.

---

## 10. Claims checked and rejected or downgraded this session
- "SWE-bench Verified top score 96–97% (Oct 2026)" comes from aggregators and is absent from the official board. Downgraded to UNVERIFIED [S22].
- "Colossus = 555k GPUs / 2 GW" and "Colossus 2 = 850k GPUs at 1.5 GW" come from secondary blogs only. UNVERIFIED.
- "Stargate Abilene 6 of 8 buildings, 618 MW, Oct 2026" is secondary. Epoch's primary-quality tracker estimates full
  1.2 GW in Q4 2026 [S20]. The secondary figure is not used.
- MI355X "4.6 PF FP8 / 9.2 PF FP4" (press) vs AMD's page "5 PF FP8 dense, 10.1 PF MXFP4" → AMD's figures are used [S13].
- WSE-3 125 PF (datasheet, sparse) vs 250 PF ("Turbo", web) → both reported, basis of the 250 PF unknown [S16].
- GB300 FP4 dense: the page text was garbled ("1440 | 10802"); sparse 1,440 PF is the reliable figure [S11]. Dense
  1,080 PF is UNVERIFIED.

---

## 11. Sources
Accessed 2026-10-16 unless noted. "Taken" = what was used.

| ID | Title / publisher | URL | Date of source | Taken |
|---|---|---|---|---|
| S1 | DeepSeek-V3 Technical Report (DeepSeek-AI), arXiv 2412.19437v2 | https://arxiv.org/abs/2412.19437 | Dec 2024 | params, MLA dims, MoE config, GPU-h, FP8, LR, deployment |
| S2 | The Llama 3 Herd of Models (Meta), arXiv 2407.21783v3 | https://arxiv.org/abs/2407.21783 | Jul 2024 | 405B FLOPs, tokens, 16K H100, MFU, 4D parallel, data mix, interruptions, MW swings, vocab |
| S3 | Qwen3 Technical Report, arXiv 2505.09388 | https://arxiv.org/abs/2505.09388 | May 2025 | architecture tables, 36T, 119 langs, vocab, Apache, distillation 1/10 GPU-h |
| S4 | DeepSeek-R1, arXiv 2501.12948, and HF model card | https://arxiv.org/abs/2501.12948 ; https://huggingface.co/deepseek-ai/DeepSeek-R1 | Jan 2025 / Nature Sep 2025 | pure-RL claim, distill table, MIT, temperature |
| S5 | Training Compute-Optimal LLMs (Chinchilla), arXiv 2203.15556 | https://arxiv.org/abs/2203.15556 | Mar 2022 | 70B/4× data, doubling rule, MMLU 67.5 |
| S6 | Chinchilla Scaling: A replication attempt (Besiroglu et al.), arXiv 2404.10102 | https://arxiv.org/abs/2404.10102 | Apr 2024 | original and re-fit constants, ≈20 tok/param |
| S7 | Scaling Laws for Neural Language Models (Kaplan et al.), arXiv 2001.08361 | https://arxiv.org/abs/2001.08361 | Jan 2020 | α_N, α_D, α_C, N∝C^0.73, C≈6NBS |
| S8 | NVIDIA H100 product page | https://www.nvidia.com/en-us/data-center/h100/ | current | SXM/NVL specs |
| S9 | NVIDIA H200 product page | https://www.nvidia.com/en-us/data-center/h200/ | current | 141 GB, 4.8 TB/s |
| S10 | NVIDIA GB200 NVL72 page | https://www.nvidia.com/en-us/data-center/gb200-nvl72/ | current | rack specs |
| S11 | NVIDIA GB300 NVL72 page | https://www.nvidia.com/en-us/data-center/gb300-nvl72/ | current | rack specs |
| S12 | NVIDIA DGX B200 page | https://www.nvidia.com/en-us/data-center/dgx-b200/ | current | 1,440 GB, 64 TB/s, 72 PF FP8, 14.3 kW |
| S13 | AMD Instinct MI355X product page | https://www.amd.com/en/products/accelerators/instinct/mi350/mi355x.html | current (AMD calc. May 2025) | 288 GB, 8 TB/s, 1,400 W TBP, BF16 2.5 PF, FP8 5 / 10.1 PF, MXFP4 10.1 PF |
| S14 | Google blog: Ironwood TPU | https://blog.google/products/google-cloud/ironwood-tpu-age-of-inference/ | Apr 2025 | per-chip and pod specs, 10 MW |
| S15 | NVIDIA RTX 5090 page; PCGamesN RTX 5090 specs (28 Gbps) | https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/ ; https://www.pcgamesn.com/nvidia/geforce-rtx-5090-release-date-price-specs-benchmarks | 2025 | 32 GB, 512-bit, 575 W; 28 Gbps → 1,792 GB/s |
| S15b | Secondary (PCGamesN/TechRadar) for RTX 4090 1,008 GB/s | as above | 2025 | 4090 BW (secondary) |
| S16 | Cerebras chip page; WSE-3/CS-3 spec sheet mirror (flopper.io) | https://cerebras.ai/chip/ ; https://flopper.io/gpu/cerebras-wse-3 | current | 4T transistors, 900k cores, 44 GB, 21 PB/s, 125 PF sparse, 27 kW; "250 PF Turbo" |
| S17 | GroqChip Processor Product Brief v1.7 | https://groq.com/wp-content/uploads/2024/08/GroqChip™-Processor-Product-Brief-v1.7.pdf | Aug 2024 | 230 MB SRAM, 80 TB/s, TOPS, power |
| S18 | Google Cloud blog: Measuring the environmental impact of AI inference | https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference | Aug 2025 | 0.24 Wh, 0.03 g, 0.26 mL, 33× |
| S19 | xAI Colossus page | https://x.ai/colossus | current | 122 days; doubled in 92 days to 200k GPUs |
| S20 | Epoch AI: OpenAI Stargate — where the US sites stand | https://epoch.ai/publications/openai-stargate-where-the-us-sites-stand | 2026 | Abilene ≈0.3 GW (Apr), 1.2 GW by Q4 2026 |
| S21 | OpenAI: five new Stargate sites / Stargate posts | https://openai.com/index/five-new-stargate-sites/ | 2025–2026 | Abilene GB200, ~7 GW planned, GPT-5.5 trained at Abilene |
| S22 | SWE-bench official leaderboard data (leaderboards.json) | https://github.com/SWE-bench/swe-bench.github.io/blob/master/data/leaderboards.json | read 2026-10-16 | Verified top entries |
| S23 | Llama 4 Maverick/Scout model card | https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E-Instruct | Apr 2025 | params, context, tokens, GPU-h, licence |
| S24 | gpt-oss-120b model card | https://huggingface.co/openai/gpt-oss-120b | Aug 2025 | 117B/5.1B, MXFP4, Apache, 80 GB, SWE-bench by effort |
| S25 | Kimi K2 Instruct model card | https://huggingface.co/moonshotai/Kimi-K2-Instruct | Jul 2025 | 1T/32B, 384E, MLA, 15.5T, 160K vocab |
| S26 | DeepSeek-V4-Pro model card (and arXiv 2606.19348) | https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro | Apr–Jun 2026 | 1.6T/49B, 284B/13B, 1M ctx, CSA+HCA, 27% FLOPs, 10% KV, >32T, FP4+FP8, MIT |
| S27 | Claude Docs: Models overview | https://platform.claude.com/docs/en/about-claude/models/overview | read 2026-10-16 | lineup, prices, 1M ctx, tokenizer words/token |
| S28 | OpenAI API docs: Models | https://developers.openai.com/api/docs/models | read 2026-10-16 | GPT-6 family context and prices |
| S29 | Gemini API docs: Models; Pricing | https://ai.google.dev/gemini-api/docs/models ; https://ai.google.dev/gemini-api/docs/pricing | read 2026-10-16 | model list, prices |
| S30 | Efficient Memory Management for LLM Serving with PagedAttention, arXiv 2309.06180 | https://arxiv.org/abs/2309.06180 | Sep 2023 | 20.4–38.2% utilisation, 800 KB/token OPT-13B, 2–4× |
| S31 | SGLang, arXiv 2312.07104 | https://arxiv.org/abs/2312.07104 | Dec 2023 | RadixAttention, 6.4× |
| S32 | Fast Inference via Speculative Decoding (Leviathan et al.), arXiv 2211.17192 | https://arxiv.org/abs/2211.17192 | Nov 2022 | 2–3×, identical outputs |
| S33 | Accelerating LLM Decoding with Speculative Sampling (Chen et al.), arXiv 2302.01318 | https://arxiv.org/abs/2302.01318 | Feb 2023 | 2–2.5× on Chinchilla 70B |
| S34 | LoRA, arXiv 2106.09685 | https://arxiv.org/abs/2106.09685 | Jun 2021 | 10,000× params, 3× memory |
| S35 | QLoRA, arXiv 2305.14314 | https://arxiv.org/abs/2305.14314 | May 2023 | 65B on 48 GB, NF4, 99.3% |
| S36 | GPTQ, arXiv 2210.17323 | https://arxiv.org/abs/2210.17323 | Oct 2022 | 3–4 bit, 4 GPU-h for 175B |
| S37 | AWQ, arXiv 2306.00978 | https://arxiv.org/abs/2306.00978 | Jun 2023 | 1% salient, >3× |
| S38 | LLM.int8(), arXiv 2208.07339 | https://arxiv.org/abs/2208.07339 | Aug 2022 | half memory, 99.9% 8-bit |
| S39 | llama.cpp quantize README | https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md | current | GGUF bpw and sizes for Llama-3.1-8B |
| S40 | Refusal in LMs Is Mediated by a Single Direction (Arditi et al.), arXiv 2406.11717v3 | https://arxiv.org/abs/2406.11717 | Jun 2024 (NeurIPS 2024) | method, 13 models ≤72B, ASR, capability, ethics |
| S41 | Will we run out of data? (Villalobos et al.), arXiv 2211.04325 | https://arxiv.org/abs/2211.04325 | Oct 2022 (rev. 2024) | 2026–2032 |
| S42 | ReAct, arXiv 2210.03629 | https://arxiv.org/abs/2210.03629 | Oct 2022 | +34/+10 points |
| S43 | GAIA, arXiv 2311.12983 | https://arxiv.org/abs/2311.12983 | Nov 2023 | 92% vs 15%, 466 questions |
| S44 | DistServe, arXiv 2401.09670 | https://arxiv.org/abs/2401.09670 | Jan 2024 | 7.4× requests / 12.6× SLO |
| S45 | GQA, arXiv 2305.13245 | https://arxiv.org/abs/2305.13245 | May 2023 | GQA definition, 5% uptrain |
| S46 | Fast Transformer Decoding: One Write-Head (MQA), arXiv 1911.02150 | https://arxiv.org/abs/1911.02150 | Nov 2019 | MQA |
| S47 | RoFormer (RoPE), arXiv 2104.09864 | https://arxiv.org/abs/2104.09864 | Apr 2021 | RoPE |
| S48 | ALiBi (Train Short, Test Long), arXiv 2108.12409 | https://arxiv.org/abs/2108.12409 | Aug 2021 | 1,024→2,048, 11% |
| S49 | YaRN, arXiv 2309.00071 | https://arxiv.org/abs/2309.00071 | Aug 2023 | 10× fewer tokens, 2.5× fewer steps |
| S50 | FlashAttention, arXiv 2205.14135 | https://arxiv.org/abs/2205.14135 | May 2022 | 3× GPT-2, Path-X |
| S51 | Attention Is All You Need, arXiv 1706.03762 | https://arxiv.org/abs/1706.03762 | Jun 2017 | attention, sinusoidal PE |
| S52 | InstructGPT, arXiv 2203.02155 | https://arxiv.org/abs/2203.02155 | Mar 2022 | RLHF, 1.3B > 175B |
| S53 | DPO, arXiv 2305.18290 | https://arxiv.org/abs/2305.18290 | May 2023 | DPO |
| S54 | DeepSeekMath (GRPO), arXiv 2402.03300 | https://arxiv.org/abs/2402.03300 | Feb 2024 | GRPO, 51.7%/60.9% |
| S55 | Constitutional AI, arXiv 2212.08073 | https://arxiv.org/abs/2212.08073 | Dec 2022 | CAI/RLAIF |
| S56 | Distilling the Knowledge in a Neural Network (Hinton et al.), arXiv 1503.02531 | https://arxiv.org/abs/1503.02531 | Mar 2015 | soft-target distillation |
| S57 | Scaling LLM Test-Time Compute Optimally (Snell et al.), arXiv 2408.03314 | https://arxiv.org/abs/2408.03314 | Aug 2024 | >4×, 14× larger |
| S58 | SWE-bench, arXiv 2310.06770 | https://arxiv.org/abs/2310.06770 | Oct 2023 | 2,294 issues, 1.96% |
| S59 | Switch Transformers, arXiv 2101.03961 | https://arxiv.org/abs/2101.03961 | Jan 2021 | MoE history, 7× |
| S60 | ZeRO, arXiv 1910.02054 | https://arxiv.org/abs/1910.02054 | Oct 2019 | 16 B/param (2+2+12), 15 PF on 400 GPUs |
| S61 | Model Context Protocol specification (rev. 2026-07-28) | https://modelcontextprotocol.io/specification/latest | 2026-07-28 | roles, features, security |
| S62 | Anthropic: Building effective agents | https://www.anthropic.com/engineering/building-effective-agents | 2024-12-19 | workflows vs agents, patterns, ACI |
| S63 | vLLM docs: Disaggregated prefilling | https://docs.vllm.ai/en/latest/features/disagg_prefill.html | current | purpose, no throughput gain, connectors |
| S64 | Epoch AI Trends dashboard | https://epoch.ai/trends | updated 2026-02-05 | 5×/yr, 3.5×/yr, 49%/yr, Colossus 2 H100e |
| S65 | Epoch AI frontier models dataset (CSV) | https://epoch.ai/data/frontier_ai_models.csv | read 2026-10-16 | FLOP, power, hardware estimates |
| S66 | Epoch AI: How much energy does ChatGPT use? | https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use | Feb 2025 | ≈0.3 Wh |
| S67 | IEA: Energy and AI, executive summary | https://www.iea.org/reports/energy-and-ai/executive-summary | Apr 2025 | 415 TWh 2024, 945 TWh 2030, regional shares |
| S68 | HPE GB200 NVL72 doc (132 kW TDP, EDPp ≈192 kW); DCD: Vertiv–NVIDIA 7 MW GB200 NVL72 reference architecture | https://www.hpe.com/us/en/collaterals/collateral.a50009224enw.html ; https://www.datacenterdynamics.com/en/news/vertiv-and-nvidia-collab-on-7mw-reference-architecture-for-gb200-nvl72 | Oct 2024 / 2025 | rack power |
| S69 | Llama 3.1 405B model card | https://huggingface.co/meta-llama/Llama-3.1-405B | Jul 2024 | 30.84M GPU-h, 39.3M total, 11,390 t CO₂e |
| S70 | NVIDIA DGX SuperPOD H100 electrical design guide | https://docs.nvidia.com/dgx-superpod/design-guides/dgx-superpod-data-center-design-h100/latest/electrical.html | current | DGX H100 ≈10.2 kW max (via search snippet) |
| S71 | Apple Mac Studio page | https://www.apple.com/mac-studio/ | 2025 lineup | M4 Max 128 GB / 546 GB/s; M3 Ultra 512 GB / 819 GB/s (any newer Apple silicon was not checked) |
| S72 | Self-measurement for this dossier: tiktoken (cl100k_base, o200k_base) and HF `tokenizers` with Qwen/Qwen3-8B and deepseek-ai/DeepSeek-V3 tokenizer.json | — | 2026-10-16 | tokens/word table |
| S73 | Reuters via BNN Bloomberg: DeepSeek says R1 cost $294,000 to train (Nature paper) | https://www.bnnbloomberg.ca/business/artificial-intelligence/2025/09/18/chinas-deepseek-says-its-hit-ai-model-cost-just-us294000-to-train/ | 2025-09-18 | $294k, 512 H800, 80 h |
| S74 | Mistral 7B, arXiv 2310.06825 | https://arxiv.org/abs/2310.06825 | Oct 2023 | Apache 2.0 |
| S75 | The Register: Nvidia charts course for 600 kW racks (GTC 2025 roadmap); NADDOD Rubin NVL144 blog | https://www.theregister.com/2025/03/19/nvidia_charts_course_for_600kw ; https://www.naddod.com/blog/nvidia-vera-rubin-nvl144-next-generation-high-performance-computing-platform | 2025 | Rubin roadmap figures (UNVERIFIED) |

Background references used for definitions only, not re-read this session: SentencePiece (Kudo & Richardson 2018,
arXiv 1808.06226); RMSNorm (arXiv 1910.07467); SwiGLU (arXiv 2002.05202); PPO (arXiv 1707.06347); min-p
(arXiv 2407.01082); Megatron-LM (arXiv 1909.08053); EU AI Act, Regulation (EU) 2024/1689 (eur-lex.europa.eu).
