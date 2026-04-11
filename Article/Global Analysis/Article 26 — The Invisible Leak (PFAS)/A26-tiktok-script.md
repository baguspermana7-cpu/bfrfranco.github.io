TikTok Script — "The Invisible Leak"
Article 26 — The Invisible PFAS Problem in Data Centers
Target length: 7-9 minutes
Format: Talking head + text overlays + visual cues

---

HOOK (0:00 — 0:08)

[Camera tight on face, direct address, low ambient sound]

"There's a chemical in AI data centers that doesn't break down. Ever. And the way it gets into the environment isn't a leak — it's routine maintenance. I've personally done this hundreds of times. Let me show you what nobody is measuring."

[TEXT OVERLAY: "PFAS. Data Centers. No reporting required."]

---

SECTION 1: What PFAS Is and Why Data Centers Use It (0:08 — 2:00)

[Step back slightly, more relaxed posture, begin explaining]

"So first — what is PFAS? Per- and polyfluoroalkyl substances. The carbon-fluorine bond is one of the strongest in chemistry. It doesn't break down in the environment. It doesn't break down in your body. It just accumulates. That's why they call them forever chemicals."

[TEXT OVERLAY: "12,000+ PFAS compounds identified"]

"There are over 12,000 known variants. You've probably heard about PFAS in non-stick pans, firefighting foam — those are the ones that made news. But there's a version that showed up quietly in data centers, and it's been there for over a decade."

[TEXT OVERLAY: "Why cooling matters in data centers"]

"Here's the problem data centers are trying to solve. AI chips — the ones running ChatGPT, image generators, everything you use — generate enormous heat. A modern GPU cluster can run 100 kilowatts per rack. Traditional air cooling can't keep up at that density. So the industry turned to liquid cooling. And the liquid they landed on for the most extreme cases? A PFAS-based dielectric fluid."

[TEXT OVERLAY: "Dielectric = won't conduct electricity = safe to submerge chips"]

"The most common one is called Novec 7000. It's made by 3M — or it was. 3M actually exited PFAS manufacturing entirely at the end of 2025. But the industry is still running on stockpiled supply."

[Pause]

"And here's the thing nobody talks about at infrastructure conferences: how does it get out?"

---

SECTION 2: The Maintenance Sequence — What Actually Happens (2:00 — 4:30)

[Slightly leaning forward, more intense delivery]

"Everyone assumes the contamination risk is a failed seal. A crack. A slow drip. That's what people picture when they think environmental leak."

[TEXT OVERLAY: "Sealed leak = small problem"]

"But that's not the main event. The main event is maintenance day."

"I've opened these systems hundreds of times. Here's what happens. You get a work order — component swap, inspection, fluid top-off. You suit up. You follow the procedure. And then you open the tank."

[TEXT OVERLAY: "Novec 7000 vapor pressure: 270 hPa"]
[TEXT OVERLAY: "Water vapor pressure: 32 hPa"]

"Novec 7000 has a vapor pressure of 270 hPa. Water is 32. That means the moment you expose the fluid surface — the moment that lid comes off — it starts vaporizing at eight times the rate of water. Into the room. Into the HVAC system. Out of the building."

[Beat]

"And maintenance doesn't happen once. In a hyperscale facility, you're doing this on a regular cycle. Weekly inspections. Monthly top-offs. Component swaps every time a GPU fails, which is often."

[TEXT OVERLAY: "Maintenance releases = 20-30x more PFAS than sealed leaks"]

"Research and engineering assessments put maintenance vapor releases at 20 to 30 times higher than what escapes from intact sealed systems over the same period. The thing everyone is worried about — the leak — is not the dominant pathway. Opening the tank is."

[Direct to camera]

"Here's what makes this a policy problem and not just an engineering problem: there is no federal requirement for data center operators to measure this. The EPA's Toxic Release Inventory applies to PFAS manufacturers. Not to the facilities that buy the fluid, store it, handle it, and vent it during routine operations. Zero mandatory reporting. For any of the 12,000-plus compounds."

[TEXT OVERLAY: "12,000+ PFAS compounds. 0 mandatory DC reporting requirements."]

---

SECTION 3: The "PFAS-Free" Scam — Opteon and TFA (4:30 — 6:30)

[Slight change in tone — more skeptical, one hand gesture]

"So the industry recognized there was a problem. And the solution the cooling vendors came up with was: switch to PFAS-free alternatives. HFO-based fluids. Hydrofluoroolefins. The leading product is called Opteon 2P50."

[TEXT OVERLAY: "HFO = 'hydrofluoroolefin' = marketed as PFAS-free"]

"And to be fair, HFOs have lower global warming potential. The product sheets look much better. Environmental responsibility box: checked."

[Pause, slight lean]

"Except for one thing. HFOs degrade."

[TEXT OVERLAY: "Opteon 2P50 degrades into: TFA"]

"In the environment, Opteon 2P50 breaks down into trifluoroacetic acid. TFA. And TFA is persistent in water. It doesn't break down. It accumulates in aquatic systems. Studies have linked it to effects on plant growth and aquatic organisms."

[TEXT OVERLAY: "TFA = persistent + unregulated + building up in water systems"]

"And here's the part that matters for regulation: TFA is classified differently from PFAS. So it doesn't fall under most existing PFAS frameworks. It's not counted in the contamination measurements. It doesn't trigger reporting requirements."

"We renamed the forever chemical. We moved it into a different regulatory bucket. And the industry called it solved."

[Beat]

"The EPA is still reviewing whether to fast-track HFO-containing fluids for continued use. Meanwhile, the cooling fluid market has already moved, the stockpiles are building, and the environmental accumulation of TFA is already underway."

---

SECTION 4: The 5% Problem — Most Data Centers Didn't Need It (6:30 — 8:00)

[More conversational, stepping back slightly]

"Here's the part that genuinely surprised me when I worked through the numbers."

[TEXT OVERLAY: "<5% of data centers need two-phase PFAS cooling"]

"Two-phase immersion cooling — the kind that requires PFAS dielectric fluids — is engineered for extreme rack densities. You need to be above roughly 100 kilowatts per rack to actually justify it thermally."

"Less than five percent of operating data centers reach that density."

"The rest adopted it during the AI infrastructure boom because competitors were doing it. Because vendors made it easy. Because 'advanced liquid cooling' became a differentiator in sales conversations."

[TEXT OVERLAY: "PFAS disposal: $8-15 per liter"]
[TEXT OVERLAY: "100,000-liter system = $1M disposal liability"]

"And they took on disposal liability they haven't priced. PFAS disposal currently costs eight to fifteen dollars per liter. A facility running a 100,000-liter system is sitting on approximately one million dollars in future liability — not on any balance sheet, not in any environmental disclosure."

[TEXT OVERLAY: "Mid-life cooling swap: 30-45% of original capex"]

"If you need to swap out mid-life — and with 3M out of the manufacturing business, that timeline is uncertain — you're looking at 30 to 45 percent of your original capex. For a system you may not have needed in the first place."

[Direct to camera]

"The AI buildout created real demand for advanced cooling. But the chemical choice, the regulatory gap, and the unnecessary deployment spread that followed — that combination is how you end up with an environmental liability that nobody is measuring and nobody is disclosing."

---

CTA (8:00 — 8:20)

[Close, direct, measured delivery]

"I wrote the full breakdown at resistancezero.com/article-26.html — including the maintenance vapor pathway, the TFA chemistry, and a framework for calculating PFAS exposure across a cooling fleet."

"If you work in infrastructure, or you're just trying to understand what's actually going into the environment around AI systems, it's worth a read."

[TEXT OVERLAY: "resistancezero.com/article-26.html"]

"Full breakdown and risk calculator: resistancezero.com/article-26.html"

[End card]
