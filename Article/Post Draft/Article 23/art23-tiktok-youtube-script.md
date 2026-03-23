# YouTube / TikTok Script — xAI Colossus: 122 Days from Empty Field to Supercomputer

Duration: 7-10 minutes
Style: Talking head + B-roll + data overlay
Tone: Engineer explaining, not news anchor reporting

---

## HOOK (0:00 - 0:30)

What if I told you someone built the world's largest AI supercomputer in just 122 days?

Not 122 weeks. Not 122 months. 122 days.

That's four months. From an empty factory floor to 100,000 GPUs running live AI training workloads.

The industry standard for this kind of build? 18 to 24 months. NVIDIA's Jensen Huang said it should take four years.

I'm a data center engineer with 12 years of experience. And today I'm going to break down exactly how xAI pulled this off — and what it cost the city of Memphis.

---

## SECTION 1: THE TIMELINE (0:30 - 2:00)

[B-roll: aerial shots of industrial buildings, construction sites]

In early 2024, Elon Musk's AI company xAI made a decision. They needed the biggest AI training cluster in the world, and they needed it now.

They found a 750,000 square foot former Electrolux appliance factory in South Memphis, Tennessee. The factory had been shut down since 2022. Phoenix Investors had purchased the facility plus 580 acres of industrial land.

xAI took that building and went from conception to construction in 19 days. Let me say that again. 19 days from "let's do this" to actual construction starting.

By July 22nd, 2024 — 122 days after the decision — 100,000 NVIDIA H100 GPUs were live and running training workloads.

[Text overlay: Timeline comparison]
- Normal hyperscale DC: 18-24 months
- Complex AI facility: 24-36 months
- Jensen Huang's estimate: 4 years
- xAI Colossus: 122 days

Then they doubled it. 92 days later, in February 2025, the cluster hit 200,000 GPUs. They trained Grok 3 on it — what Musk called "the smartest AI on Earth."

---

## SECTION 2: INSIDE THE MACHINE (2:00 - 3:30)

[B-roll: server racks, GPU close-ups, liquid cooling systems]

Let me walk you through what's actually inside this facility.

The cluster currently runs about 230,000 GPUs. That's 150,000 H100s, 50,000 H200s, and 30,000 of the newer GB200s.

The racks are built by Supermicro — liquid-cooled, 64 GPUs per rack. Cold plates sit directly on the silicon, with coolant distribution units cycling liquid through each rack.

On the air side, there are 119 industrial chillers providing roughly 200 megawatts of cooling capacity. It's a hybrid approach — liquid for the GPUs, air for everything else.

The networking is NVIDIA Spectrum-X Ethernet with BlueField-3 DPUs — 400 gigabit Ethernet per server, 3.6 terabits total bandwidth per node. They chose Ethernet over InfiniBand, which is interesting for a training cluster of this scale.

And to buffer the power supply, 168 Tesla Megapacks — $430 million worth of batteries — sit between the grid and the GPUs. Because GPU training workloads have millisecond-level power demands that the grid alone can't handle.

[Text overlay: Key specs]
- 230,000 GPUs
- 150+ MW power draw
- 119 chillers
- 168 Tesla Megapacks
- 400GbE per server

---

## SECTION 3: THE PART THEY DON'T TALK ABOUT (3:30 - 5:30)

[Tone shift — slower, more serious]

Now here's where this story gets complicated. And honestly, this is the part that matters most.

Before the grid connection was fully ready, xAI needed power. Their solution? Install dozens of methane gas turbines. These turbines could generate up to 495 megawatts. That's the output of a conventional power plant.

And they did this without a single Clean Air Act permit.

Let me put that in perspective. 495 megawatts of methane gas turbines, running without permits, in a neighborhood that already hosts 22 of Tennessee's 30 largest industrial polluters.

South Memphis and the Boxtown community have the highest childhood asthma hospitalization rate in Tennessee. These are real people. Real families. And they had zero input before the turbines were installed.

The Southern Environmental Law Center called it — and I quote — "an illegal power plant."

The NAACP filed intent to sue. Harvard researchers estimated that running 41 permanent turbines at this site would cause $44 million per year in health damages. The pollutants include nitrogen oxides, fine particulate matter, and formaldehyde — which is a known carcinogen.

[Text overlay]
- 495 MW of unpermitted turbines
- 22 of TN's 30 largest polluters already in the area
- Highest childhood asthma rate in Tennessee
- $44M/year estimated health damages (Harvard)

In January 2026, the EPA updated their Clean Air Act standards specifically clarifying that temporary gas turbines of this type require permits. That was partly in response to what happened at Colossus.

---

## SECTION 4: WHAT SPEED ACTUALLY COSTS (5:30 - 7:00)

[Back to talking head]

Look, as an engineer, I understand the pressure to build fast. Every month a GPU sits idle costs millions in depreciation and lost competitive advantage. H100 GPUs cost $30,000 to $40,000 each. At 100,000 units, that's 3 to 4 billion dollars of hardware depreciating whether it's training or not.

But there's a difference between building fast and building without accountability.

Environmental permits aren't red tape for the sake of red tape. They exist because emissions have measurable health impacts on real people. Skipping them doesn't eliminate the cost. It transfers the cost from the company's balance sheet to the community's hospital bills.

The 122-day timeline was partly possible because they retrofitted an existing building — that's a legitimate strategy, and honestly a smart one. But it was also possible because they treated environmental compliance as something to deal with later instead of a constraint to design around.

---

## SECTION 5: THE EXPANSION (7:00 - 8:30)

[B-roll: construction, aerial views]

Despite the controversy, Colossus keeps growing.

In March 2025, xAI acquired a million square foot warehouse and 100 acres for Colossus 2. In January 2026, they bought a third building and branded it "MACROHARDRR" on the rooftop — a jab at Microsoft.

The numbers are staggering:
- Target: 555,000 GPUs, scaling to 1 million
- Power: 1.2 gigawatts initially, 2 gigawatts total
- A $659 million expansion permit filed in March 2026
- An $80 million wastewater recycling plant to reduce aquifer impact
- $18 billion just for the GPU procurement

To put 2 gigawatts in perspective — that's enough electricity to power about 1.5 million homes.

xAI's total investment in the Memphis complex is estimated at over $40 billion.

---

## CLOSING: THE ENGINEER'S VERDICT (8:30 - 9:30)

[Direct to camera, personal tone]

So here's my take as someone who has spent over 12 years building and operating data centers.

Colossus is a genuine engineering achievement. The speed, the logistics, the scale — it's impressive. And the retrofit approach is something every hyperscaler should study.

But it's also a cautionary tale. Speed without environmental compliance creates consequences that outlast any training run. The NAACP lawsuit, the EPA rule changes, the community health impacts — those aren't abstract costs. They're real.

We don't build data centers for 122 days. We build them for decades. And the communities around them live there for generations.

The question isn't whether we can build this fast. Colossus proved we can. The question is whether we can build this fast AND do it responsibly.

I wrote a full engineering analysis with an interactive calculator where you can model your own data center build speed and costs. Link in the description.

If you found this breakdown useful, like and subscribe. I publish engineering analyses on AI infrastructure, data center operations, and the real-world impact of the AI buildout.

I'm Bagus Dwi Permana, Engineering Operations Manager. Thanks for watching.

---

## VIDEO DESCRIPTION

xAI built the world's largest AI supercomputer in 122 days — but at what cost to Memphis? A data center engineer breaks down the timeline, the technical specs, the environmental controversy, and the $40B expansion plan.

Full article + interactive calculator: https://resistancezero.com/article-23.html

TIMESTAMPS:
0:00 - Hook
0:30 - The 122-Day Timeline
2:00 - Inside the Machine (230K GPUs)
3:30 - The Environmental Cost
5:30 - What Speed Actually Costs
7:00 - The 2 GW Expansion
8:30 - The Engineer's Verdict

#xAI #Colossus #DataCenter #ElonMusk #NVIDIA #GPU #AI #EnvironmentalJustice #Memphis #Engineering

---

## TIKTOK CUTS (60-90 sec versions)

**Cut 1 — "122 Days" (Hook + Timeline)**
Use 0:00-0:30 hook + 0:30-1:30 timeline condensed. End with "Full breakdown on my YouTube."

**Cut 2 — "The Part They Don't Talk About" (Environmental)**
Use 3:30-5:00 condensed. Strong hook: "xAI ran 495 MW of gas turbines without a single permit." End with impact stats.

**Cut 3 — "230,000 GPUs" (Specs)**
Use 2:00-3:00 condensed. Visual-heavy with text overlays on every stat. End with "2 GW target — enough for 1.5 million homes."
