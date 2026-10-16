# Article 29 — Calculator Specifications

Five embedded calculators. Source tags `[Sn]` resolve in `RESEARCH.md` §11. Every default below was run through
the formulas, and each worked example is that run (Python, 2026-10-16). Units: GB = 1e9 B, GiB = 2³⁰ B.
Implementation notes for the site: use `js/rz-calc-utils.js` (`window.RZCalc`) for validation and CSV export,
use RZExplain `data-explain` keys for tooltips, and show a basis chip on every output ("estimate — roofline
ceiling", "list price on 2026-10-16", …) per ACCURACY_VALIDATION.

A shared constants table (one JS object, each entry carrying `source` + `asOf`) feeds all five calculators:

| Key | Value | Unit | Source |
|---|---|---|---|
| `H100.bw` / `H100.mem` / `H100.bf16` / `H100.fp8` | 3.35e12 / 80e9 / 989e12 / 1979e12 | B/s, B, FLOP/s dense | [S8] |
| `H200.bw` / `.mem` | 4.8e12 / 141e9 (same FLOPs as H100) | | [S9] |
| `B200.bw` / `.mem` / `.fp8` | 8e12 / 180e9 / 9e15 (72 PF ÷ 8; sparse/dense basis not stated, flag it) | | [S12] |
| `MI355X.bw` / `.mem` / `.bf16` / `.fp8` / `.tbp` | 8e12 / 288e9 / 2.5e15 / 5e15 / 1400 W | | [S13] |
| `GB200.gpu_mem` / `.gpu_bw` / `.bf16` | 186e9 (13.4 TB ÷ 72) / 8e12 (576 TB/s ÷ 72) / 2.5e15 (360 PF sparse ÷ 2 ÷ 72) | | [S10] (derived) |
| `TPUv7.bw` / `.mem` / `.fp8` | 7.37e12 / 192e9 / 4.614e15 | | [S14] |
| `RTX4090.bw` / `.mem` | 1.008e12 / 24e9 | | [S15b] secondary |
| `RTX5090.bw` / `.mem` / `.tgp` | 1.792e12 (512-bit × 28 Gbps ÷ 8) / 32e9 / 575 W | | [S15] (derived) |
| `M4Max.bw` / `.mem` | 546e9 / 128e9 | | [S71] |
| `M3Ultra.bw` / `.mem` | 819e9 / 512e9 | | [S71] |
| `kW_per_GPU.H100_node` | 1.275 (DGX H100 10.2 kW ÷ 8) | kW | [S70] |
| `kW_per_GPU.B200_node` | 1.79 (DGX B200 14.3 kW ÷ 8) | kW | [S12] (derived) |
| `kW_per_GPU.GB200_rack` | 1.83 (132 kW ÷ 72) | kW | [S68] (derived) |
| `bpw` | BF16 16, FP8 8, INT8 8, Q8_0 8.5008, Q6_K 6.5633, Q5_K_M 5.7036, Q4_K_M 4.8944, IQ4_XS 4.4597, Q3_K_M 3.9960, Q2_K 3.1593, NF4+DQ 4.127 | bits | [S39] [S35] |
| `train_bytes_per_param` | 16 (mixed-precision AdamW) | B | [S60] |
| `tok_per_word` | EN 1.20 (o200k), ID 1.60 (o200k), ID 2.05 (cl100k/Qwen3), ID 1.72 (DeepSeek-V3), Claude-current 1.80 | | [S72] [S27] |

Model presets (architecture inputs used by calculators i and iii):

| Preset | N_total | N_active | layers | kv_heads | d_head | KV type | Source |
|---|---|---|---|---|---|---|---|
| Llama 3.1 8B | 8.03e9 | same | 32 | 8 | 128 | GQA | [S2] |
| Llama 3.1 70B | 70.6e9 | same | 80 | 8 | 128 | GQA | [S2] |
| Llama 3.1 405B | 405e9 | same | 126 | 8 | 128 | GQA | [S2] |
| Qwen3-32B | 32.8e9 (UNVERIFIED exact; report says 32B) | same | 64 | 8 | 128 | GQA | [S3] |
| Qwen3-235B-A22B | 235e9 | 22e9 | 94 | 4 | 128 | GQA | [S3] |
| DeepSeek-V3 / R1 | 671e9 | 37e9 | 61 | — | — | MLA: 576 values per layer per token | [S1] |
| Llama 4 Scout | 109e9 | 17e9 | UNVERIFIED (not sourced) | — | — | — | [S23] |
| gpt-oss-120b | 117e9 | 5.1e9 | UNVERIFIED | — | — | — | [S24] |
| Kimi K2 | 1e12 | 32e9 | 61 | — | — | MLA (dims UNVERIFIED) | [S25] |

Presets marked UNVERIFIED for layers have no KV inputs, so the calculator shows weights-only memory and the label
"KV not modelled — architecture not published in sources".

---

## (i) Model memory and hardware fit

**Inputs** (default; valid range)
- `N_total`: parameters (preset Llama 3.1 70B = 70.6e9; 1e8–2e12)
- `precision`: weight bits per parameter (FP8 = 8; 2–32, from `bpw`)
- `layers`, `kv_heads`, `d_head` (80, 8, 128; integers ≥1), or `mla_width` for MLA presets (576)
- `kv_bits`: KV-cache precision (16; 4–16)
- `context`: tokens per sequence (8,192; 1–10,000,000)
- `batch`: concurrent sequences (1; 1–4,096)
- `overhead`: runtime fraction (0.10; 0–0.5). It is a rule of thumb, so label it as such.

**Formulas**
```
W_bytes  = N_total × precision / 8
KV_tok   = 2 × layers × kv_heads × d_head × kv_bits/8          (GQA/MHA)
KV_tok   = layers × mla_width × kv_bits/8                       (MLA)
KV_bytes = KV_tok × context × batch
Total    = (W_bytes + KV_bytes) × (1 + overhead)
Fit(level) = Total ≤ usable_mem(level)
usable_mem: M4 Max 128 GB × 0.75 (OS share, assumption, flagged), M3 Ultra 512 × 0.75, RTX 4090 24, RTX 5090 32,
            1×H100 80, 1×H200 141, 8×H100 640, 8×H200 1,128, 8×B200 1,440, 8×MI355X 2,304, GB200 NVL72 13,400 GB
```
Output: GB per component; the smallest hardware level that fits; for the multi-GPU levels, GPUs needed =
ceil(Total / per-GPU memory).

**Worked example (defaults):**
- W = 70.6e9 × 1 = 70.6 GB.
- KV per token = 2 × 80 × 8 × 128 × 2 = 327,680 B, so KV = 327,680 × 8,192 × 1 = 2.68 GB (2.50 GiB).
- Total = (70.6 + 2.68) × 1.10 = 80.6 GB. That does not fit 1×H100 (80 GB) but fits 1×H200 (141 GB).
- Context changed to 131,072 at batch 1: KV = 42.9 GB (40 GiB); Total = (70.6 + 42.9) × 1.1 = 124.9 GB, which still fits one H200.
- Batch changed to 8 at 131,072: KV = 343.6 GB; Total = 455.7 GB, which needs 8×H100 (640 GB).

**Validity:** ignores activation memory during prefill chunks, paged-block rounding (vLLM wastes less than one
block per sequence [S30]), MoE expert-offload, and KV quantisation quality. Weights are exact; KV is exact for
the stated architecture.

---

## (ii) Training compute, cost and energy

**Inputs**
- `N` (active parameters; 70e9; 1e8–2e12). For MoE use N_active and say so, matching DeepSeek's cost [S1].
- `D` tokens (15e12; 1e9–1e14)
- `gpu` (H100 BF16 dense 989e12; any preset peak)
- `MFU` (0.40; 0.10–0.60). Llama 3 measured 0.38–0.43 [S2]; Epoch's GB200 estimate assumes 0.25 FP8 [S65].
- `n_gpus` (16,384; 1–1,000,000)
- `price` $/GPU-h (2.50; 0.5–15). The DeepSeek-V3 report assumes $2 for H800 [S1]; any market price is a user assumption.
- `kW_per_GPU` all-in IT (1.275; 0.3–3) [S70]
- `PUE` (1.2; 1.03–2.0)
- `goodput` fraction of wall time that is useful (0.90; 0.5–1.0). Llama 3 achieved >90% [S2].

**Formulas**
```
C          = 6 × N × D                                  [S7]
rate       = peak × MFU                                  FLOP/s per GPU
GPU_hours  = C / rate / 3600
wall_days  = GPU_hours / n_gpus / goodput / 24
cost_$     = GPU_hours / goodput × price
E_IT_MWh   = GPU_hours / goodput × kW_per_GPU / 1000
E_fac_MWh  = E_IT_MWh × PUE
avg_MW     = n_gpus × kW_per_GPU × PUE / 1000
Chinchilla check: N_opt = sqrt(C/120), D_opt = 20·N_opt   [S5][S6]; show D/N tokens per param
```

**Worked example (defaults, goodput = 1 for the raw figures):**
- C = 6 × 70e9 × 15e12 = 6.30e24 FLOP.
- rate = 989e12 × 0.40 = 3.956e14 FLOP/s, so GPU-h = 6.30e24 / 3.956e14 / 3600 = 4.424e6.
- Wall time = 4.424e6 / 16,384 / 24 = 11.25 days (12.5 days at goodput 0.9).
- Cost = $11.06M at $2.50 ($12.29M at goodput 0.9).
- E_IT = 4.424e6 × 1.275 / 1000 = 5,640 MWh; facility = 6,768 MWh; average 25.1 MW.
- Chinchilla: N_opt = sqrt(6.30e24 / 120) = 229B with D_opt 4.6T. The chosen 70B / 15T is 214 tokens per
  parameter, i.e. "over-trained for cheaper inference".

**Validation presets (the calculator must reproduce these):**
- Llama 3.1 405B: C = 3.79e25 (paper 3.8e25 [S2]). Meta reports 30.84M GPU-h [S69], which implies an effective
  rate of 342 TF, or MFU 34.6% on BF16 dense.
- DeepSeek-V3: N_active 37e9, D 14.8e12 gives C = 3.29e24. At 2.664M GPU-h the effective rate is 343 TF/s.
  2.788M total GPU-h × $2 = $5.576M [S1].

**Validity:** 6ND omits attention FLOPs, so it under-counts by n_ctx/(6·d_model)-scale terms for long sequences
[S7]. It is also not valid for RL post-training, where rollouts are inference.

---

## (iii) Inference throughput and cost per million tokens

**Inputs**
- Model preset (Llama 3.1 70B), `N_active`, KV architecture (from preset)
- `w_bits` (8; 2–16), `kv_bits` (16)
- `gpu` bandwidth `BW` and dense peak `F` for the chosen precision (H200: 4.8e12, 1.979e15)
- `n_gpus` for tensor-parallel sharding (1; 1–72). Aggregate BW = n × BW; add no communication model, and label it "ideal".
- `batch B` (32; 1–1,024)
- `ctx_avg` average tokens in cache per sequence (4,096)
- `prompt` tokens for TTFT (4,000)
- `eff_bw` achieved fraction of bandwidth (0.6; 0.3–0.9) and `mfu_prefill` (0.5; 0.2–0.7). Both are assumptions; label them.
- `price` $/GPU-h (3.50) and `kW_per_GPU` (1.3)

**Formulas**
```
W        = N_active_bytes  (for dense: N × w_bits/8; for MoE at batch 1 use active bytes, at large B approach total)
KV_seq   = KV_tok × ctx_avg
Mem      = N_total × w_bits/8 + B × KV_seq           (must be ≤ n_gpus × gpu_mem, else "does not fit")
t_mem    = (W + B × KV_seq) / (n_gpus × BW)
t_comp   = 2 × N_active × B / (n_gpus × F)
t_step   = max(t_mem, t_comp) / eff_bw                (seconds per decode step)
TPOT     = t_step;  per-user tok/s = 1 / t_step
throughput = B / t_step                               tokens/s per replica
TTFT     ≈ 2 × N_active × prompt / (n_gpus × F × mfu_prefill)   (+ queueing, not modelled)
$/Mtok   = (n_gpus × price) / (throughput × 3600) × 1e6
J/token  = n_gpus × kW_per_GPU × 1000 / throughput
Ridge    = F / BW;  decode intensity ≈ 2B/(w_bits/8) FLOP/byte;  compute-bound when intensity > ridge
```

**Worked example (defaults; Llama 3.1 70B FP8, 1×H200, B = 32, ctx 4,096):**
- W = 70.6 GB; KV_seq = 327,680 × 4,096 = 1.342 GB; Mem = 70.6 + 32 × 1.342 = 113.5 GB ≤ 141, so it fits.
- t_mem = (70.6e9 + 42.9e9) / 4.8e12 = 23.7 ms; t_comp = 2 × 70.6e9 × 32 / 1.979e15 = 2.3 ms, so memory-bound.
- t_step = 23.7 / 0.6 = 39.4 ms, giving 25.4 tok/s per user and 812 tok/s per GPU.
- $/Mtok = 3.50 / (812 × 3600) × 1e6 = $1.20. J/token = 1,300 / 812 = 1.60.
- TTFT (4,000-token prompt) = 2 × 70.6e9 × 4,000 / (1.979e15 × 0.5) = 0.571 s.
- Batch-1 ceiling with eff 1.0 = 4.8e12 / 70.6e9 = 68 tok/s.
- Cross-reference table, RESEARCH.md §6.6: B = 1/8/16/32 → 40/283/500/812 tok/s at eff 0.6.

**Validity:** a roofline upper bound. It ignores scheduler overhead, prefill/decode interference (mitigated by
chunked prefill or disaggregation [S44][S63]), speculative decoding gains (2–3× [S32][S33]), MoE all-to-all, and
quantisation-kernel efficiency. The output must say "ceiling-based estimate, not a benchmark".

---

## (iv) LoRA / QLoRA fine-tune memory

**Inputs**
- Preset dims: `N_base` (8.03e9), `layers` (32), `d_model` (4,096), `kv_dim` (1,024), `d_ff` (14,336)
- `targets` (q, k, v, o, gate, up, down: all on)
- `r` rank (16; 1–256)
- `mode`: Full / LoRA-BF16 / QLoRA-NF4
- `seq_len` (2,048) and `micro_batch` (1), for the activation estimate
- `grad_ckpt` (on)

**Formulas**
```
params per target matrix = r × (d_in + d_out)                     [S34]
q:(d,d) k:(d,kv) v:(d,kv) o:(d,d) gate:(d,ff) up:(d,ff) down:(ff,d)
P_lora   = layers × Σ_targets r × (d_in + d_out)
Base mem = N_base × {Full: 2, LoRA: 2, QLoRA: 4.127/8} bytes        [S35]
Train-state mem = {Full: N_base × 14 (grad 2 + Adam/master 12); LoRA/QLoRA: P_lora × 16}   [S60]
Activations ≈ layers × seq_len × micro_batch × d_model × k_act × 2 B
   k_act = 2 with gradient checkpointing (store layer inputs only; ASSUMPTION — label "rough");
   k_act ≈ 34 without (UNVERIFIED heuristic, so show only as a range; or omit and label "activations not modelled")
Total = Base + Train-state + Activations  →  recommend hardware level from calculator (i)'s list
```

**Worked example (defaults, QLoRA):**
- Per layer = 16 × [(4096+4096) + 2×(4096+1024) + (4096+4096) + 3×(4096+14336)] = 1,310,720; × 32 = 41.94M (0.52% of 8.03B).
- Base = 8.03e9 × 4.127 / 8 = 4.14 GB. Train-state = 41.94e6 × 16 = 0.67 GB.
- Activations (checkpointed) = 32 × 2,048 × 1 × 4,096 × 2 × 2 = 1.07 GB.
- Total ≈ 5.9 GB, which fits a 12 GB-class card (RTX 4090/5090 with headroom).
- Same model, Full mode: 8.03e9 × 16 = 128.5 GB plus activations, so ≥2×H100 sharded (ZeRO/FSDP [S60]).
- 70B QLoRA: base 36.4 GB + adapters (r = 16; dims d 8,192, kv 1,024, ff 28,672 (UNVERIFIED from this session),
  80 layers → 207M params × 16 B = 3.3 GB) + activations, totalling ≈ 41–45 GB. That is a 48 GB card,
  consistent with QLoRA's "65B on a single 48GB GPU" [S35].

**Validity:** optimiser state assumes AdamW in FP32. Paged or 8-bit optimisers reduce it. Activations are the
uncertain term, so the output carries a ±50% band, flagged as an assumption.

---

## (v) Tokens per document and cost estimator

**Inputs**
- `words` (10,000; 1–10,000,000), or `chars` with chars-per-token
- `language` (EN / ID / code)
- `tokenizer` family (o200k-class, cl100k/Qwen-class, DeepSeek-class, Claude-current)
- `in_price`, `out_price` $/M tokens (preset list prices on 2026-10-16 [S27][S28][S29], editable)
- `output_ratio` output tokens ÷ input tokens (0.1; 0–5)
- `calls` (1), `cached_fraction` of input billed as cache read (0; 0–1), `cache_read_mult` (0.05 for Opus/Sonnet 5.5 [S27])

**Formulas**
```
tokens_in  = words × tok_per_word[language][tokenizer]   (code: chars / chars_per_tok, 2.7–3.0 measured [S72])
tokens_out = tokens_in × output_ratio
cost/call  = tokens_in × [(1−cached)×in_price + cached×in_price×cache_read_mult]/1e6 + tokens_out × out_price/1e6
total      = cost/call × calls
context check: tokens_in ≤ model context (1M for current Claude/GPT-6/Gemini 3.x [S27][S28][S29]); 128K for Llama 3.1/Qwen3/DeepSeek-V3
```

**Lookup values** (measured on one parallel EN/ID paragraph [S72]; the article must say "sample of one paragraph"):
EN 1.20 tok/word (all four tokenizers 1.19–1.20). ID: o200k 1.60, DeepSeek-V3 1.72, cl100k / Qwen3 2.05.
Claude current tokenizer 1.80 per English word, from the vendor statement of 555k words per 1M tokens [S27].

**Worked example:**
- 10,000-word English report, Claude Sonnet 5.5 ($2 / $10), output ratio 0.1, one call:
  - tokens_in = 10,000 × 1.80 = 18,018 → $0.0360; tokens_out = 1,802 → $0.0180; total $0.054.
- Same report in Indonesian on an o200k-class model at $2 / $10: 16,000 tokens in → $0.032; 1,600 out → $0.016; total $0.048.
- Same Indonesian text on a cl100k-class tokenizer: 20,500 in → $0.041 plus $0.0205 out.

**Validity:** token ratios vary with domain, formatting and numerals. Present them as ±15% (assumption, flagged).
Prices change, so show the as-of date beside them.
