# Quora Post

Target Questions:
1. How was xAI Colossus built so fast?
2. What is the xAI Colossus supercomputer?
3. How many GPUs does xAI Colossus have?
4. What are the environmental concerns with xAI's Memphis data center?
5. How long does it take to build a data center?

---

## Answer

I can speak to this as a data center engineer with 12+ years managing critical infrastructure.

The xAI Colossus build in Memphis is genuinely unprecedented. They went from an empty factory to a running 100,000-GPU supercomputer in 122 days. For context, a hyperscale data center of that scale normally takes 18 to 24 months. Jensen Huang said it would typically take four years.

How did they do it?

First, they retrofitted an existing building. The site was a 750,000 square foot former Electrolux appliance factory in South Memphis. By reusing an existing industrial shell, they skipped months of ground-up construction. Second, they ran parallel workstreams at a pace closer to military logistics than typical construction. Hardware went from shipping containers to first training run in 19 days. Third, they had effectively unlimited capital — xAI raised over $20 billion.

The technical specs are significant. The cluster uses Supermicro liquid-cooled racks with 64 GPUs each. 119 air-cooled chillers provide approximately 200 MW of cooling capacity. NVIDIA's Spectrum-X Ethernet platform handles networking at 400GbE per server. 168 Tesla Megapacks buffer power between the grid and GPUs.

The cluster started at 100,000 H100 GPUs, doubled to 200,000 in another 92 days, and currently runs approximately 230,000 GPUs (150,000 H100s, 50,000 H200s, 30,000 GB200s). The target is 1 million GPUs at 2 GW total power capacity. The GPU procurement cost alone for 555,000 units is estimated at $18 billion.

However, speed came with significant environmental costs. Before grid power was fully available, xAI installed methane gas turbines capable of generating 495 MW without obtaining Clean Air Act permits. The Southern Environmental Law Center labeled it an illegal power plant. The NAACP filed intent to sue. A Harvard study estimated $44 million per year in health damages from emissions including nitrogen oxides, particulate matter, and formaldehyde.

The site location makes this worse — South Memphis already hosts 22 of Tennessee's 30 largest industrial polluters and has the highest childhood asthma hospitalization rate in the state.

The engineering achievement is real. The environmental compliance failure is also real. Both things are true simultaneously, and the industry needs to learn from both.

Full engineering analysis with an interactive calculator: [resistancezero.com/article-23.html](https://resistancezero.com/article-23.html)
