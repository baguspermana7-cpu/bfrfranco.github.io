# Medium Post

SEO Title: xAI Built a 100,000-GPU Supercomputer in 122 Days. Here's What It Cost.
Subtitle: An engineer's analysis of the fastest data center build in history — the achievement and the consequences.

NOTE: Run through humanizer before publishing. Free Medium account — no markdown bold.

---

The fastest data center build in history happened in Memphis, Tennessee. And it created both a technological milestone and an environmental justice crisis.

In March 2024, xAI — Elon Musk's AI company — decided to build the world's largest AI training cluster. They found a 750,000 square foot former Electrolux appliance factory in South Memphis, and 122 days later, 100,000 NVIDIA H100 GPUs were running training workloads.

The industry standard for a hyperscale data center is 18 to 24 months from groundbreaking to operations. Jensen Huang, NVIDIA's CEO, said a project at this scale normally takes four years. xAI was told it would take 24 months. They did it in four.

## The Engineering Achievement

The speed is genuinely remarkable. Hardware went from shipping containers to first training run in 19 days. Supermicro provided liquid-cooled racks packing 64 GPUs each. 119 air-cooled chillers handle roughly 200 MW of cooling capacity. NVIDIA's Spectrum-X Ethernet platform connects everything with 400GbE NICs delivering 3.6 Tbps per server. 168 Tesla Megapacks buffer the power supply between the grid and GPUs that demand millisecond-level power stability.

By February 2025, the cluster doubled to 200,000 GPUs in another 92 days. Grok 3 was trained on this expanded cluster — what Musk called "the smartest AI on Earth."

The current fleet runs approximately 230,000 GPUs: 150,000 H100s, 50,000 H200s, and 30,000 GB200s. Phase 2, called Colossus 2, targets 555,000 GPUs at 1.2 gigawatts. A third building pushes the target to 2 GW and eventually 1 million GPUs. The GPU bill alone for 555,000 units is estimated at $18 billion.

## The Environmental Cost

Before the grid connection was ready, xAI needed power. Their solution: install dozens of methane gas turbines capable of generating up to 495 MW. That is the output of a conventional power plant.

They did this without obtaining a single Clean Air Act permit.

The turbines emit nitrogen oxides, particulate matter, and formaldehyde — a known carcinogen. A Harvard study estimated that operating 41 permanent turbines at the site would cause approximately $44 million per year in health damages.

The location amplifies the problem. South Memphis and the adjacent Boxtown neighborhood already host 22 of Tennessee's 30 largest polluters. The area has the highest childhood asthma hospitalization rate in the state. The community had no input before the turbines were installed.

The Southern Environmental Law Center called it "an illegal power plant." The NAACP filed intent to sue. Over 2,000 public comments were submitted opposing the turbine permits. In January 2026, the EPA updated Clean Air Act standards explicitly affirming that temporary gas turbines of this type require permits.

## What Speed Actually Costs

As a data center engineer with over 12 years in critical infrastructure, I understand the pressure to build fast. Every month a GPU sits idle represents millions in depreciation and lost competitive advantage. The AI training race creates genuine urgency.

But there is a difference between building fast and building without accountability. Environmental permits exist because emissions have measurable health impacts on real people. Skipping them does not eliminate the cost — it transfers it from the company's balance sheet to the community's hospital bills.

The 122-day timeline was possible partly because xAI retrofitted an existing building rather than constructing from scratch. That is a legitimate engineering strategy. But it was also possible because environmental compliance was treated as something to deal with later rather than a constraint to design around.

## The Expansion Continues

Despite the controversy, Colossus keeps growing. In March 2025, xAI acquired a 1 million square foot warehouse and 100 acres for Colossus 2. In January 2026, a third building was purchased and branded "MACROHARDRR" on the rooftop — a reference to challenging Microsoft. A $659 million expansion permit was filed in March 2026. An $80 million wastewater recycling plant is under construction to reduce aquifer withdrawals.

The Memphis site is transforming into one of the largest AI infrastructure complexes in the world. The question is not whether it will be built. It is whether it will be built responsibly.

## The Lesson

Colossus proves that speed is achievable. But it also proves that speed without environmental compliance creates consequences that outlast any training run. The NAACP lawsuit, the EPA rule changes, the community health impacts — these are not abstract costs. They are the price of treating a community as an externality.

As data center engineers, we build infrastructure that operates for decades. The 122-day sprint is a remarkable achievement. But we build for decades, not deadlines.

---

*Originally published at [resistancezero.com](https://resistancezero.com/article-23.html)*
