# Facebook Post (2000 chars max)

Here is something most people get wrong about data center costs:

The cheapest option changes completely depending on where you build, how big you go, and how fast you grow.

A 5 MW facility in Northern Virginia costs roughly $85 million to build over 5 years. Colocation for the same capacity runs about $78 million. Cloud? Around $126 million. But move that same facility to Jakarta, and building drops to $60 million because construction and labor are 40% cheaper.

Construction costs per MW range from $7.5 million in Mumbai to $15.2 million in Tokyo. Colocation pricing swings from $125/kW/month to $390/kW/month. Power costs create a 3x spread between markets. These are not small differences.

Cloud is consistently 40-60% more expensive than colo for workloads running 24/7 beyond 3 years. The convenience premium compounds over time. Colo wins at smaller scale. Build-own wins above 10 MW if you can handle the 18-24 month construction timeline.

I built a free calculator that compares all three options across 12 global markets using real 2025 data from CBRE, Turner and Townsend, and IEA. You set your IT load, region, tier level, and growth rate, and it tells you which model wins and where the breakeven point is.

The pro features include Monte Carlo simulation with 10,000 iterations, sensitivity analysis showing which variables matter most, and multi-year projection charts. All runs in your browser with no data sent anywhere.

What surprised me most building this: power cost is the single biggest driver of TCO differences, not construction cost. A 20% swing in electricity rates changes the answer more than anything else.

Try it: https://resistancezero.com/tco-calculator.html
