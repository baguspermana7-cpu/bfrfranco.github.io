# Article 29 calculators — build notes

Files: `js/rz-llm-calc.js`, `tools/test-llm-calc.mjs`, `Article/Article_29/build/calc-{fit,training,serve,lora,tokens}.html`.
Test: `node tools/test-llm-calc.mjs` -> `PASS llm-calc — 375 assertions`. `python3 tools/audit-js-syntax.py --strict` clean.
Also smoke-tested mount in headless Chrome (all five render, input recompute at 120 ms, invalid input prints a dash plus the RZCalc error box, double script load is guarded, zero inline styles).

## Worked examples asserted (CALCULATORS.md)
- C-i: defaults (W 70.6, KV/token 327,680 B, KV 2.68 GB / 2.50 GiB, Total 80.6, no fit 1xH100, fits 1xH200); ctx 131,072 (KV 42.9 / 40 GiB, Total 124.9, one H200); batch 8 (KV 343.6, Total 455.7, 8xH100); MLA KV/token; level capacities.
- C-ii: defaults at goodput 1 (C, rate, 4.424e6 GPU-h, 11.25 d, $11.06M, 5,640 / 6,768 MWh, 25.1 MW, N_opt 229B, D_opt 4.6T, 214 tok/param) and at 0.9 (12.5 d, $12.29M); Llama 3.1 405B (C 3.79e25, implied 342 TF, MFU 34.6%); DeepSeek-V3 (C 3.29e24, 343 TF/s, $5.576M).
- C-iii: all defaults (W, KV_seq, Mem, t_mem 23.7, t_comp 2.3, t_step 39.4, 25.4 tok/s, 812 tok/s, $1.20, 1.60 J, TTFT 0.571, ceiling 68) and RESEARCH 6.6 batch table 40/283/500/812.
- C-iv: QLoRA 8B (41.94M, 0.52%, 4.14, 0.67, 1.07, 5.9 GB), Full 8B (128.5 GB), 70B QLoRA (207M, 36.4, 3.3, total 41-45).
- C-v: Sonnet 5.5 EN ($0.054), o200k ID ($0.048), cl100k ID (20,500 in, $0.041 + $0.0205).
- Plus: invalid/out-of-range -> valid:false + NaN (19 cases), 19 monotonicity checks, every constant has source/asOf/unit/finite value, spec values of the constants table, trace shape {value, unit, formula, inputs}, formula strings are substrings of the spec text AND printed by the calculator.

## Ambiguities resolved
1. "Smallest hardware level that fits" (C-i): by usable memory the default case fits an Apple M4 Max (96 GB usable) before 1xH200, while the spec says "fits 1xH200". Output both `smallest` (any level, ascending usable memory) and `smallest_dc` (datacentre levels only; = 1x H200). The coordinator should quote `smallest_dc` in prose.
2. MoE weights read per step (C-iii): spec only says "active bytes at batch 1, approaches total at large B". Implemented `W = N_total_bytes x (1 - (1 - N_active/N_total)^B)` (uniform routing, assumption, flagged in notes). Dense gives N x w_bits/8; B = 1 gives active bytes exactly.
3. Does not fit (C-iii): spec says "does not fit". `fits` = false, step time / throughput / cost / J per token are NaN (dash), note explains. Memory and weights outputs remain.
4. KV unavailable presets (Llama 4 Scout, gpt-oss-120b, Kimi K2): `kv_type: none` -> KV = 0, weights-only, note "KV not modelled — architecture not published in sources". In C-iii the same note appears (KV omitted, so the ceiling is optimistic).
5. Claude tokenizer ratio: spec says 1.80 but the worked example needs 18,018 tokens, which is 1e6/555,000 = 1.8018. Constant stored unrounded with that note. Claude has no measured Indonesian ratio -> that combination is invalid (dash), not guessed. Code uses chars / 2.85 (midpoint of the measured 2.7-3.0); `chars` field only applies to language = code.
6. C-iv without gradient checkpointing: spec allows "range or omit". Omitted: activations and total are NaN, `smallest` = "activations not modelled". The +/-50% band (act_low/high, total_low/high) is always given for the checkpointed case.
7. C-iv recommendation: uses the C-i level list (no 12 GB level exists there), so 5.9 GB maps to "RTX 4090 (24 GB)"; the spec's "12 GB-class card" sentence is not reproduced as a level. 70B QLoRA total is 45.1 GB (spec: "approximately 41-45"); test accepts up to 45.5. The 70B d_ff 28,672 is UNVERIFIED (preset note says so).
8. 405B validation: spec gives implied MFU 34.6% and 342 TF; exact arithmetic gives 341.4 TF / 34.5% (tolerance +/-1 TF, +/-0.002 used). D = 15.6e12 from RESEARCH row 1.
9. Units: functions take SI inputs (N in parameters, BW in B/s, F in FLOP/s) and report GB/MWh/USD; the UI displays B / TB/s / TFLOP/s via per-field `scale`.
10. No clamping: out-of-range values make the result invalid (dash) rather than silently changing the user's number.
11. Spec constants look right against RESEARCH (S72 ratios, S70 power); B200 FP8 9e15 keeps the "sparse/dense basis not stated" flag in the constant's note and the preset label.

## For the coordinator
- `data-explain` keys used (llm-n-total, llm-kv-bits, llm-mfu, llm-goodput, ...) need entries in the RZExplain DB (`tools/explain-extra.json`); unknown keys are not registered by this work.
- The script injects a small `#llm-calc-css` (hidden, buttons, work line, basis chip); fold into article CSS if preferred. Load `js/rz-calc-utils.js` before it for validation and Copy CSV (CSV falls back to download if the clipboard is blocked). Add a `?v=` cache token via `node tools/test-asset-cache-tokens.mjs --fix js/rz-llm-calc.js` once wired in.
- Fragments carry no references block; the `[Sn]` tags in `calc-basis` lines resolve in the article's own source list.
