# X / Twitter — Future Forward 3: AI Inference Economics (thread)

1/ Training builds the model once. Inference runs it every time anyone sends a prompt. Inference now takes two-thirds of AI compute. A thread on the economics of running models. 🧵

2/ The flip: for years training dominated compute budgets. By 2026 two-thirds of AI compute is inference. Jensen Huang said at GTC 2025 that 70% of NVIDIA's data center revenue now comes from inference-optimized chips.

3/ Prices are collapsing. In 14 months, from GPT-4 (March 2023) to GPT-4o (May 2024), the cost of frontier-quality inference fell 92%. From the original GPT-4 to GPT-4o-mini the reduction is 99.5%.

4/ Cheaper per token does not mean cheaper overall. Inference scales linearly with usage, 24 hours a day, while training is a one-time cost amortized over billions of requests.

5/ Where it runs is a choice: hyperscaler GPUs, dedicated infrastructure, on-premise hardware or on-device. Cost, latency and privacy decide which fits a workload.

6/ The constraint is power. SemiAnalysis projects 93.3 GW of inference-specific demand by 2030. AI data centers took about 4% of US electricity in 2025, up from 2.5% in 2023 (EIA). Training a frontier model is a 50-100 GWh one-off.

7/ Business model filter: revenue per request must exceed cost per request. GitHub Copilot reportedly lost an average of $20 per user per month in 2023, then reached profitability by mid-2025 with cheaper models and better routing.

8/ It is geopolitical too: US export controls (October 2022, updated October 2023 and January 2025) target inference-optimized chips, not just A100 and H100 training GPUs.

9/ The full analysis, with an AI Inference Economics Analyzer covering 10 regions, 8 accelerator types and 3 workload patterns:
https://resistancezero.com/FF-3.html?utm_source=x&utm_medium=social&utm_campaign=ff3
