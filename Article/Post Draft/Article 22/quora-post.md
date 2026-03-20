Target Questions:
1. Why did NVIDIA invest $4 billion in Lumentum and Coherent?
2. What is co-packaged optics and why is it important for AI data centers?
3. Why can't copper keep up with AI training cluster demands?
4. What is silicon photonics and how does it work?
5. What is Jensen Huang's AI factory concept?

---

Answer (adapt for first-person Quora style):

I work in data center engineering, so I've been tracking NVIDIA's photonics moves closely. Here's the engineering explanation.

On March 2, 2026, NVIDIA announced $2 billion investments in both Lumentum and Coherent — two photonics companies. This was not about buying fiber optic cables. It was about controlling the most critical bottleneck in next-generation AI infrastructure: the optical interconnect.

Here's the problem. As AI clusters grow beyond 100,000 GPUs, the performance bottleneck shifts from raw compute to how fast data moves between GPUs. At 200G+ SerDes lane speeds, copper electrical traces hit physics limits — power per bit increases, signal integrity degrades, realistic copper distance shrinks to under 1 meter at 800G.

The solution is co-packaged optics (CPO). Instead of running electrical signals across 12+ inches of PCB before converting to light at a pluggable module on the front panel, CPO places the optical engine directly next to the switch ASIC. The electrical trace drops to less than half an inch. Power drops. Latency drops. Bandwidth density goes up.

But there's a catch. Silicon — the same material GPUs are made from — cannot efficiently generate laser light. It has an indirect bandgap. You need III-V semiconductor materials like Indium Phosphide (InP) for lasers. That's where Lumentum and Coherent come in.

Lumentum provides the laser source backbone — CW lasers, ultra-high-power lasers, and external laser source modules. Coherent provides the broader optical stack — transceivers, VCSELs, silicon photonics integration, and protocol-agnostic components that work across Ethernet, InfiniBand, and NVLink.

NVIDIA's Spectrum-X Photonics and Quantum-X Photonics switches are designed to deliver 409.6 Tb/s of system bandwidth using these technologies — enough to scale AI factories to millions of GPUs.

I wrote a detailed engineering analysis with an interactive calculator that compares copper DAC, pluggable optics, and CPO for different AI cluster configurations:

https://resistancezero.com/article-22.html