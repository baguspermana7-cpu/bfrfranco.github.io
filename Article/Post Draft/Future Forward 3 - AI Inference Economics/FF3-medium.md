# Medium — AI Inference Economics: The Cost of Running Models

*Publish via medium.com/p/import (sets the canonical). Canonical: https://resistancezero.com/FF-3.html?utm_source=medium&utm_medium=syndication&utm_campaign=ff3*

## Training builds the model once. Inference runs it forever.

Training builds a model once. Inference runs the model every time a user sends a prompt, an API call executes or an autonomous agent takes an action. Training is the R&D cost, amortized across billions of requests. Inference is the operating expense, running 24 hours a day and scaling linearly with usage. By 2026, two-thirds of AI compute is inference, and Jensen Huang disclosed at GTC 2025 that 70% of NVIDIA's data center revenue now comes from inference-optimized chips.

Prices have collapsed. In the 14 months from GPT-4's launch in March 2023 to GPT-4o in May 2024, the cost of frontier-quality inference dropped 92%. From the original GPT-4 to GPT-4o-mini, the total reduction is 99.5%. But cheaper tokens do not shrink the bill when usage scales faster than price falls.

The binding constraint is power. SemiAnalysis projects 93.3 GW of inference-specific demand globally by 2030, more than the generating capacity of most individual countries. The EIA puts AI data centers at roughly 4% of US electricity in 2025, up from 2.5% in 2023. Training a frontier model consumes 50-100 GWh as a one-time event, while inference for that model never stops.

Not every application survives the filter. Revenue per inference request has to exceed cost per request by a workable margin. GitHub Copilot reportedly lost an average of $20 per user per month in 2023, when inference costs were high, and reached profitability by mid-2025 with cheaper models and better routing.

The article also compares cloud, dedicated, on-premise and edge deployment, explains how US export controls from October 2022 to January 2025 target inference chips, and ends with a three-year outlook. An interactive analyzer models inference cost across 10 regions, 8 accelerator types and 3 workload patterns.

Read the full article on ResistanceZero: https://resistancezero.com/FF-3.html?utm_source=medium&utm_medium=syndication&utm_campaign=ff3
