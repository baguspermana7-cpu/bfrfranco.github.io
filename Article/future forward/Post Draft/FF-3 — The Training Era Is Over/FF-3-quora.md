# Quora Post

Target Questions:
1. Is AI training or inference more expensive?
2. Why are AI API prices dropping so fast?
3. How much energy does AI inference consume?
4. What is the difference between AI training and inference?
5. Will AI inference costs keep decreasing?

---

## Answer

This is a question I deal with daily as a data center engineer managing critical infrastructure for AI workloads.

The short answer: training is more expensive per event, but inference is more expensive in total — and the gap is widening rapidly.

Training a frontier model like GPT-4 reportedly cost $100 million or more. That sounds enormous, and it is. But it is a one-time cost per model version. You train the model, then you are done with that expense.

Inference — running the trained model every time a user sends a query — is the ongoing operational cost. It runs 24/7, scales with every new user and API integration, and by 2026 accounts for approximately two-thirds of all AI compute globally according to Deloitte.

Here is what makes this counterintuitive: API prices have collapsed. GPT-4 launched at $30 per million input tokens in March 2023. GPT-4o-mini is now available at $0.15 per million tokens — a 99.5% price reduction in roughly two years. Claude and Google models followed similar trajectories.

Yet AI infrastructure spending is accelerating, not declining. Goldman Sachs estimated $450 billion in AI infrastructure capex in 2025 alone. The explanation is Jevons Paradox: as inference becomes cheaper per query, usage grows exponentially, and total compute demand increases despite falling per-unit costs.

The hardware landscape reflects this shift. NVIDIA's Blackwell B200 GPUs — optimized for inference, not training — now generate 70% of their data center revenue. Groq was acquired for approximately $20 billion specifically because their LPU architecture delivers 10x lower inference latency than traditional GPUs. AWS and Google are building custom inference silicon to reduce their NVIDIA dependence.

SemiAnalysis projects 93.3 GW of inference-specific power demand by 2030. A single ChatGPT query uses roughly 10 times the energy of a Google search. The energy equation alone makes inference the defining challenge of AI infrastructure for the next decade.

To answer whether inference costs will keep decreasing: per-token costs will continue falling through hardware improvements, quantization techniques, and competitive pressure. But total inference spending will keep rising because cheaper costs drive proportionally greater usage. The industry learned this lesson with cloud computing, with mobile data, and with bandwidth. AI inference is following the same pattern.

Full analysis with interactive cost calculator: [resistancezero.com/FF-3.html](https://resistancezero.com/FF-3.html)
