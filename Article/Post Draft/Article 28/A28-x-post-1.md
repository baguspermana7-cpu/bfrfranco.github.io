# X / Twitter — Article 28 (thread)

1/ Can you compress 300 TB of AI training data to 1 KB? Can a laptop equal a 1 GW datacenter?

Literally: no. Both hit the hardest walls in science.

But the real answer is wilder than yes. 🧵

2/ Wall 1 — information. Shannon + Kolmogorov: most data is incompressible. You can't beat its information content. 300 TB of independent bits ≠ 1 KB. Ever.

3/ Wall 2 — thermodynamics. Landauer: erasing a bit costs ≥2.8 zeptojoules. Matching a gigawatt's op-rate in a laptop's power is off by ~20,000,000×.

4/ But we never needed the bytes or the FLOPs. We need the *capability*. And capability compresses like magic:

~60 TB corpus → 140 GB weights → ~14 GB at 1.58 bits (BitNet). A ~4,000× collapse of ability. Runs on a workstation.

5/ Inference ≪ training → a laptop RUNS what a gigawatt TRAINED.
And compute-per-capability halves ~every 8 months (Epoch AI), faster than Moore's Law. Yesterday's gigawatt mind lands on tomorrow's laptop.

6/ The honest metric isn't "1 KB / 1 GW." It's Capability Density: usable intelligence per byte + per watt.

7/ Practical payoff: make a default local model genuinely smart with ZERO training — base + quantize + RAG + tools. No GPU needed for ~80% of the win.

Full piece 👇
https://resistancezero.com/article-28.html
