# X / Twitter — Article 29 (thread)

1/ You run the racks that run the LLMs. Here is what the machine inside actually computes, from one token to a 1 GW campus. A thread of sourced numbers. 🧵

2/ An LLM is a next-token probability engine. Text → tokens → a stack of identical transformer blocks → a probability for the next token. That is the whole mechanism. Everything else is scale.

3/ Training compute ≈ 6 × parameters × tokens. Llama 3 405B: 6 × 405e9 × 15.6e12 = 3.79e25 FLOP (paper: 3.8e25). Inference ≈ 2 × active parameters per token.

4/ The KV cache is where your HBM goes. Llama 3 70B: 320 KiB per token, so one 128K-token session = 40 GiB before serving a second user. DeepSeek-V3's MLA needs 57× less.

5/ Mixture of experts: DeepSeek-V3 is 671B total, 37B active. Memory bills the total; compute bills the active.

6/ Decoding is memory-bandwidth-bound. 70B in FP8 on one H200: 4.8 TB/s ÷ 70 GB = at most 68 tokens/s per user. Batching users is how the GPU gets busy.

7/ One GB200 NVL72 rack: 72 GPUs, 13.4 TB HBM, 130 TB/s NVLink, 132 kW nominal, liquid-cooled. 100k GB200 ≈ 220 MW at PUE 1.2.

8/ A training run moves your site load by tens of megawatts (Meta, Llama 3, 16K H100s), with 419 unexpected interruptions in 54 days, 78% hardware.

9/ A median Gemini text prompt: 0.24 Wh, 0.26 mL water (Google, Aug 2025). A 1,000-token answer on a 70B model derives to about 0.27 Wh.

10/ The full chain, 16 sections, 5 calculators, every number sourced:
https://resistancezero.com/article-29.html?utm_source=x&utm_medium=social&utm_campaign=a29
