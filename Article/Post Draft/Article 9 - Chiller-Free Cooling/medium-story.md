MEDIUM DRAFT SETTINGS (fill these in before publishing):
SEO Title: No Chillers Does Not Mean No Cooling in Data Centers
(Preview: "No Chillers Does Not Mean No Cooling in Data Centers | by Bagusdpermana | Medium" = 68 chars, fits 74 limit)
SEO Description: Jensen Huang said "no water chillers are necessary." HVAC stocks dropped 7.5%. But heat rejection never disappears. Tropical physics, fault scenarios, and the real cooling shift.
(178 / 195 chars)
Tags: Data Center Cooling, Direct Liquid Cooling, HVAC Engineering, Nvidia, Chiller Free
Images: Cover image (article-9-cover_.jpg), Cooling infrastructure photo (article-9.1_.jpg)
---

# The HVAC Shock: No Chillers Does Not Mean No Cooling

CES 2026 was not supposed to be about HVAC. But a single line from Jensen Huang sent billions of market cap tumbling.

Onstage, he declared that "no water chillers are necessary for data centres" when describing the warm-water direct liquid cooling in Nvidia's Vera Rubin platform.

Within hours:

Johnson Controls: -7.5%
Trane Technologies: -5.3%
Carrier Global: -1.1%

Data centres represent roughly 10 to 15% of Johnson Controls' sales, approximately 10% for Trane, and 5% for Carrier. The market's linear assumption that "AI = more chiller demand" was suddenly under threat.

The market sold first and asked questions later. But the physics tells a different story.

---

## What Nvidia Actually Announced

Rubin is not a single chip. It is a rack-scale platform co-designed across compute, networking, power, and cooling. It combines GPUs, CPUs, and networking into one rack with sixth-generation NVLink interconnects and an MGX architecture for serviceability.

The relevant detail for facility operators: warm-water, single-phase direct liquid cooling operating at a supply temperature around 45 degrees Celsius. Liquid captures heat more efficiently than air, enabling higher operating temperatures and reducing fan and chiller energy. The higher supply temperature allows dry-cooler operation with minimal water usage. Rubin also doubles liquid flow rates at the same CDU pressure head to ensure rapid heat removal under sustained extreme workloads.

"The air flow is about the same and the water that goes into it is the same temperature, 45C... no water chillers are necessary for data centres." - Jensen Huang, CES 2026

The nuance lies in "necessary," not "no cooling."

---

## "No Chillers" Does Not Mean "No Cooling"

This is the critical distinction that the market missed. To understand it, you need to separate the terminology.

A chiller is a mechanical refrigeration plant that cools water to 6 to 12 degrees Celsius for CRAH/CRAC units. Energy-intensive (0.5 to 0.7 kW/ton) but decouples heat rejection from ambient temperature.

Heat rejection is the unavoidable requirement to dump IT heat into the environment. Whether via evaporative towers, dry coolers, or district heating, the heat has to go somewhere.

Direct Liquid Cooling (DLC) delivers coolant directly to heat-generating components via cold plates, capturing 70 to 80% of heat at the source.

A CDU (Coolant Distribution Unit) is the heart of liquid cooling: pumps, heat exchangers, and controls that manage coolant flow.

The traditional cooling stack looks like this: CRAH/CRAC units feed a chilled water loop at 7 degrees, connected to a chiller plant, connected to cooling towers. The warm-water DLC stack looks like this: direct-to-chip cold plates feed CDUs, connected to a warm water loop at 45 degrees, connected to dry coolers (plus optional chiller).

Heat rejection never disappears. Only the method changes. Components shift, complexity redistributes.

What Nvidia is saying is that the mechanical refrigeration step can be eliminated from the IT cooling loop because the warm supply temperature (45 degrees) is high enough to reject heat through dry coolers without the energy-intensive refrigeration cycle. That is a meaningful statement for temperate and cold climates. It is a problematic one for the tropics.

---

## Where "No Chillers" Actually Works

Plausible "no chillers": Cold or temperate climates where ambient air rarely exceeds approximately 40 degrees Celsius. Dry coolers can reject heat for most of the year. Stockholm gets 7,500 hours of free cooling annually (86% of the year).

Fewer chiller hours: Mixed or dry climates where warm months necessitate mechanical refrigeration during peak temperatures. Hybrid designs use smaller chillers running fewer hours. Frankfurt gets 5,200 hours (59%). Virginia gets 4,000 hours (46%).

Marketing spin: Hot and humid regions where warm-water loops would drive unacceptable outlet temperatures. Mechanical chillers remain primary, but marketing emphasises "reduced chiller load." Singapore gets only 400 hours of free cooling (4.5%). Jakarta gets 600 hours (6.8%).

---

## The Tropical Physics Problem

A warm and humid climate like Singapore or Jakarta is the worst-case scenario for free cooling. The combination of high temperature AND high humidity eliminates both primary free cooling mechanisms.

Challenge 1: High Ambient Temperature

Dry cooler physics requires that the fluid outlet temperature exceeds the ambient temperature plus an approach temperature (typically 5 degrees). In Stockholm with a summer peak of 25 degrees, you achieve a 30-degree minimum fluid outlet, leaving a 15-degree margin against 45-degree supply. That works year-round.

In Jakarta with frequent 35-degree ambient, you achieve 40-degree minimum fluid outlet. Against 45-degree supply, you have only 5 degrees of margin. Marginal. During heat waves at 38 to 40 degrees, fluid outlet climbs to 43 to 45 degrees, leaving 0 to 2 degrees of margin. Insufficient.

Challenge 2: High Humidity

Evaporative and adiabatic pre-cooling effectiveness depends on the wet bulb depression (the difference between dry bulb and wet bulb temperature). At 30% relative humidity (desert climate), you get 10 to 12 degrees of cooling. At 50% (Mediterranean), 6 to 8 degrees. At 70% (subtropical), 3 to 4 degrees. At 85% (tropical), only 1 to 2 degrees.

Jakarta and Singapore average 75 to 90% relative humidity. Evaporative pre-cooling provides minimal benefit.

Challenge 3: Limited Diurnal Temperature Swing

Frankfurt has a summer day/night swing of about 15 degrees (30 down to 15), giving 8 to 10 hours of free cooling per day. Jakarta's swing is only 8 degrees (33 down to 25), providing just 2 to 4 hours of marginal free cooling per day.

The data tells the story. Annual free cooling hours: Stockholm 7,500 (86%), Frankfurt 5,200 (59%), Virginia 4,000 (46%), Jakarta 600 (6.8%), Singapore 400 (4.5%).

For Southeast Asia, the verdict is clear: requires hybrid approach with 40 to 50% chiller backup capacity. High humidity limits evaporative cooling. Design for worst-case ambient of 38 to 40 degrees. Enhanced monitoring and 2N redundancy essential.

---

## Fault Scenario Analysis

There is a critical understanding that operations teams need to internalize: liquid cooling systems fail FASTER but also recover FASTER than traditional air-cooled systems. This changes the entire operational response paradigm and requires enhanced monitoring, faster detection, and more aggressive redundancy.

Primary pump failure. Motor burnout, impeller damage, or bearing seizure stops coolant flow to served racks. High severity. MTTR: 2 to 4 hours.

Seal/gasket failure. Coolant leak at pump seals, heat exchanger gaskets, or quick-disconnect fittings. High severity. MTTR: 1 to 3 hours.

VFD/motor controller failure. Variable frequency drive failure, power supply issues, or control board malfunction. MTTR: 2 to 4 hours.

Control system failure. PLC/BMS communication loss, sensor failure, or control logic malfunction.

In an air-cooled system, a CRAH failure gives you minutes of thermal buffer because the room itself is a thermal mass. In a liquid-cooled system, the coolant loop has much less thermal mass. A pump failure can cause chip junction temperatures to reach throttling limits in 30 to 60 seconds. There is less time to respond, which means you need better monitoring, faster automated failover, and properly maintained redundancy.

The flip side: liquid systems also recover faster. Restarting coolant flow brings temperatures back to normal within minutes rather than the 15 to 30 minutes required to re-establish air-cooled equilibrium across a data hall.

---

## Pros and Cons: Short-Term (0 to 3 Years)

Advantages: Immediate OPEX reduction with 30 to 60% cooling energy savings. ESG compliance and carbon credit benefits. Water conservation at 30 to 40% reduction with dry coolers. Simplified maintenance with fewer mechanical components. No refrigerant compliance concerns as HFC phase-out regulations tighten.

Disadvantages: High initial CAPEX at $500 to $2,000 per kW for liquid cooling infrastructure. Technology immaturity with limited vendor ecosystem. Staff retraining requirements for new skill sets. Compatibility issues as not all servers support liquid cooling. Limited component availability in the supply chain.

---

## Pros and Cons: Long-Term (3 to 10 Years)

Advantages: Future-proof architecture ready for 100+ kW per rack AI densities. Ahead of environmental regulations. Heat reuse potential generating district heating revenue at $20 to $50 per MWh. Green credentials for premium pricing. 30 to 40% TCO reduction over 10-year lifecycle.

Disadvantages: Stranded assets from existing chiller infrastructure devaluation. Vendor dependency and technology lock-in risks. Rising ambient temperatures from climate change reducing free cooling effectiveness. Dielectric fluid lifecycle and disposal challenges. Unknown failure modes from new technology that have not yet been encountered at scale.

---

## Regional Implementation Verdicts

The feasibility varies dramatically by geography.

Indonesia (Tropical): Proceed with caution. Requires hybrid approach with 40 to 50% chiller backup capacity. High humidity limits evaporative cooling. Design for worst-case ambient of 38 to 40 degrees. Score: 7.2 out of 10.

Singapore (Tropical): Similar constraints to Indonesia. 80 to 90% relative humidity year-round eliminates evaporative pre-cooling. Only 400 hours of annual free cooling (4.5% of the year).

UAE / Middle East (Hot-Arid): Better than tropical due to low humidity enabling effective evaporative cooling. But extreme temperatures (45 degrees plus) still require chiller backup for peak conditions.

Virginia, USA (Temperate): Strong candidate. 4,000 hours of free cooling. Hybrid design with seasonal chiller operation feasible.

Frankfurt, Germany (4-Season): Good candidate. 5,200 hours of free cooling. Winter provides extended chiller-free operation.

Stockholm, Sweden (Nordic): Near-ideal. 7,500 hours of free cooling (86% of year). Genuinely chiller-free operation is plausible for the majority of operations.

Ireland (Maritime): Excellent. Cool, stable maritime climate provides year-round mild conditions well suited to chiller-free operation.

---

## Conclusion

The market panic-sold HVAC stocks after one line about "no chillers." Rubin does not kill cooling. It reprices the cooling stack. Heat still flows. Investors and operators just need to follow it into pumps, CDUs, and control loops.

"The edge is knowing where the new bottleneck sits -- inside the plant room, not on a silicon slide."

For operations professionals managing critical infrastructure:

1. Understand the physics. "No chillers" works in cool climates. In tropics, it is "fewer chiller hours" at best.

2. Plan for hybrid. Target 60 to 70% chiller-free operation with robust backup for extreme conditions.

3. Invest in monitoring. Liquid cooling's faster thermal dynamics demand faster detection and response.

4. Train your teams. New technology introduces new failure modes requiring new skills and procedures.

5. Design for climate change. Build margin for 2050 conditions, not just today's averages.

The HVAC industry is not dying. It is transforming. The companies that adapt, building CDUs, controls, and hybrid systems, will capture the next wave of data center cooling demand. The companies that bet exclusively on traditional chiller-centric architectures face a structurally declining addressable market in temperate regions.

And for facility operators in the tropics: do not believe the headline. Your chillers are not going anywhere. But your cooling architecture is about to get significantly more interesting.

---

Originally published at resistancezero.com

Full analysis with interactive PUE impact calculator and regional comparison tool: https://resistancezero.com/article-9.html
