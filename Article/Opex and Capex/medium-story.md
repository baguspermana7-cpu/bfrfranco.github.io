MEDIUM DRAFT SETTINGS (fill these in before publishing):

SEO Title: How Much Does It Cost to Build a Data Center?
(Preview: "How Much Does It Cost to Build a Data Center? | by Bagusdpermana | Medium" = 73 chars, fits 74 limit)

SEO Description: I asked 3 vendors to quote a 10 MW data center. Got $95M, $142M, and $187M. Same spec. So I built a free CAPEX calculator to see where the real costs hide.
(161 / 195 chars)

Tags: Data Center, CAPEX, Infrastructure, Construction, Cost Estimation

Images (from Opex and Capex folder):
1. CAPEX.png or capex1.png — Place after title/subtitle, as cover image
   Caption: "Same spec, same city, same tier. Three vendors, three wildly different numbers."
2. Opex.png or opex1.png — Place after "Where does the money actually go" section
   Caption: "Cost breakdown of a 10 MW Tier III facility. Electrical and cooling dominate."

---

# How Much Does It Actually Cost to Build a Data Center?

I asked 3 vendors to quote a 10 MW data center. Same spec. Same city. Same tier.

The answers: $95M, $142M, and $187M.

That's not a rounding error. That's someone's career on the line. And it happens more often than anyone wants to admit.

---

Why CAPEX estimates are all over the place

Most people build their cost model after they've already committed to a design. They pick the cooling system first, then discover it added $18M. They spec 2N redundancy "just in case," then wonder where $30M went. They forget seismic bracing, fire suppression upgrades, or generator fuel storage, and the change orders start piling up.

The problem isn't that data center construction is inherently unpredictable. It's that most early-stage estimates don't account for how design decisions cascade through every cost line.

A decision as simple as "air-cooled vs liquid-cooled" doesn't just change the cooling budget. It changes the building footprint, the electrical distribution design, the structural loading, the fire suppression requirements, and the commissioning timeline. Each of those changes ripples into the next.

---

What actually drives the cost

For a typical Tier III facility, the rough breakdown looks like this:

Land and site preparation: 8-15% of total CAPEX, heavily location-dependent. A greenfield site in Southeast Asia looks very different from a retrofit in Northern Virginia or London.

Civil and structural: 15-20%. Building type matters enormously. A purpose-built concrete shell costs more upfront but accommodates higher rack densities and better seismic performance. A converted warehouse is cheaper to start but limits your options later.

Electrical systems: 25-35%. This is usually the single biggest line item. UPS systems, generators, medium-voltage switchgear, PDUs, busway, and the entire power distribution chain from utility connection to rack. Redundancy configuration is the biggest multiplier here. Going from N+1 to 2N on the electrical side can add 40-60% to this category alone.

Mechanical and cooling: 15-25%. Cooling type selection has the widest cost variance. Traditional raised-floor CRAH units are the cheapest to install but least efficient to operate. In-row cooling improves efficiency but costs more. Rear-door heat exchangers or direct liquid cooling for high-density AI/HPC loads can cost 2-3x more upfront but may be the only option above 30 kW per rack.

Fire suppression: 3-5%. Often underestimated until late in design. Clean agent systems (FM-200, Novec 1230) for IT spaces, pre-action sprinkler for support areas. The choice of agent affects both CAPEX and ongoing maintenance costs.

IT infrastructure: 5-10%. Structured cabling, racks, containment, monitoring systems, DCIM.

Soft costs: 10-15%. Design, project management, commissioning, permits, contingency. This is where budgets quietly overrun because contingency gets consumed by scope changes that weren't caught in design.

---

The variables that move the number most

After years of seeing how projects go sideways, these are the decisions that create the biggest budget swings:

Redundancy level. The jump from N+1 to 2N doesn't double the cost, but it's close to a 50-60% increase on electrical systems and 30-40% on mechanical. For a 10 MW facility, that's easily a $20-30M difference. The question isn't "what's the right redundancy" but "what redundancy does my SLA actually require?"

Cooling architecture. Air-cooled at 8-10 kW/rack vs direct liquid cooling at 50-100 kW/rack are fundamentally different buildings. If you're building for AI/HPC workloads, the cooling decision is the design decision.

Location factor. Construction costs vary 40-80% between markets. A facility in Singapore or Tokyo costs significantly more than the same design in Malaysia or Indonesia, driven by labor costs, material logistics, and regulatory requirements.

Seismic zone. Zone 3 or 4 adds 8-15% to structural costs through reinforced foundations, braced equipment, and seismic-rated cable tray and piping systems. Easy to miss in early estimates, expensive to add later.

Building type. Purpose-built vs retrofit vs modular. Each has a different cost profile and timeline. Modular deployments can be 20-30% faster to commission but may cost more per MW at scale.

---

Why I built a calculator for this

I kept seeing the same problem. Someone needs a defensible cost range for a board meeting, an investment committee, or a land acquisition decision. They don't need a full engineering estimate yet. They need to understand how their key design choices affect the total, and they need it in hours, not weeks.

So I built a free CAPEX calculator that lets you:

Set your IT load from 100 kW to 100 MW.
Choose between 4 cooling architectures (air, in-row, rear-door heat exchanger, direct liquid cooling).
Toggle redundancy from N to 2N+1.
Adjust for seismic zones, building types, and regional location factors.
See how each variable moves the total in real time.

It breaks the cost into land, civil, electrical, mechanical, fire suppression, IT infrastructure, and soft costs. Per-MW benchmarking so you can compare against industry ranges.

Is it a replacement for a full engineering estimate? No. Is it the fastest way to build a defensible cost range before committing to a design? I think so.

---

The Pro version goes deeper

The free calculator gives you the cost breakdown and per-MW benchmarks. The Pro version adds:

Equipment specifications. Maps your configuration to real-world equipment: specific UPS models (Vertiv Trinergy, Schneider Galaxy VX), cooling systems, generators, and fire suppression agents with capacity ranges.

Construction timeline. Estimates project duration from design through commissioning based on your configuration, including procurement lead times.

Sustainability metrics. Annual energy consumption, CO2 emissions, water usage, and refrigerant GWP impact. Because if your CAPEX model doesn't include environmental footprint in 2026, you're not building for the market that's coming.

Scenario comparison. Run two configurations side by side to see exactly what changes and by how much.

Executive narrative. A plain-English summary of your design, costs, and key considerations. The page you paste into your board memo.

---

What this won't do

It won't replace site-specific engineering. It doesn't know about your specific utility connection costs, local permitting timelines, or that the access road to your site needs widening. It uses industry-benchmarked cost ranges, not quotes from your local contractors.

What it does is give you a structured starting point that accounts for the interactions between design decisions. So when a vendor quotes $187M for the same spec another vendor priced at $95M, you have the framework to understand where those numbers diverge and which questions to ask.

---

Try it free at resistancezero.com/capex-calculator.html

All calculations run in your browser. No data sent to any server.

---

References:
Uptime Institute. Tier Classification System and Cost Benchmarks.
ASHRAE TC 9.9. Thermal Guidelines for Data Processing Environments.
EN 50600 Series. Data Centre Facilities and Infrastructures.
