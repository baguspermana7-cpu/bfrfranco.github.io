# LinkedIn — Article 29: How a Large Language Model Actually Works

Every data-center engineer now runs the machines that run LLMs. Very few have been shown what the machine inside computes. Article 29 is that explanation, from one token to a 1 GW campus, written for the plant room.

Eight numbers carry it:

→ Training compute ≈ 6 × parameters × tokens. Llama 3 405B: 6 × 405e9 × 15.6e12 = 3.79e25 FLOP. The paper says 3.8e25.
→ Inference ≈ 2 × active parameters per generated token.
→ The KV cache for Llama 3 70B is 320 KiB per token: a single 128K-token session needs 40 GiB of HBM before the first user is served.
→ DeepSeek-V3 is 671B parameters but only 37B are active per token. You pay memory for the total and compute for the active.
→ Decoding is bandwidth-bound: 70B in FP8 on one H200 cannot exceed 4.8 TB/s ÷ 70 GB = 68 tokens per second per user.
→ One GB200 NVL72 rack is 132 kW nominal, liquid-cooled. 100k of them ≈ 220 MW at PUE 1.2.
→ Llama 3 ran on 16,384 H100s and reported power swings on the order of tens of megawatts, with 419 unexpected interruptions in 54 days.
→ A median Gemini text prompt costs 0.24 Wh (Google, Aug 2025).

The article walks the whole chain: tokenizer → embeddings → attention → KV cache → MoE → sampling → training → post-training → distillation/quantization → serving → the hardware ladder (laptop, workstation, server, NVL72 rack, pod, campus, inference ASICs) → agents and harnesses → the frontier and its limits. Every number has a source. Five calculators: will it fit, what a training run costs in dollars and megawatt-hours, tokens per second and dollars per million tokens, LoRA memory, token cost.

Read it: https://resistancezero.com/article-29.html?utm_source=linkedin&utm_medium=social&utm_campaign=a29

#DataCenter #AIInfrastructure #LLM #LiquidCooling #GPU #DCIM
