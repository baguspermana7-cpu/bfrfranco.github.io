SEO Title: Water Stress and AI Data Centers in SEA
SEO Description: 58% of global data centers sit in water-stressed regions. This analysis maps 11 SEA hubs from Jakarta's 85% crisis to low-stress alternatives in Johor Bahru and Da Nang.
Tags: Data Centers, Water Stress, AI, Southeast Asia, Sustainability

---

# Water Stress and AI Data Centers: The Hidden Crisis in Southeast Asia

Fifty-eight percent of global data centers sit in water-stressed regions. That number, sourced from S&P Global Sustainable1, gets cited in passing and then everyone moves on to talking about power. But water is the constraint that will define where the next generation of AI infrastructure can actually operate.

I spent the last few months mapping water stress across 11 data center hubs in Southeast Asia. The findings are both alarming and, in some cases, encouraging. The region is not uniformly water-stressed. There are clear winners and losers. And the operators who understand that distinction early will have a structural advantage over those who keep building in the same saturated corridors.

---

# The Scale of the Problem

A typical data center uses millions of liters of water annually for cooling. Most of that water goes through evaporative cooling towers, which reject heat by evaporating water into the atmosphere. The hotter the climate, the more water you need. Southeast Asia, with its tropical heat and humidity, is among the worst environments for evaporative cooling efficiency.

Here is what the numbers look like in practice. Water Usage Effectiveness, or WUE, is the standard metric. It measures liters of water consumed per kilowatt-hour of IT energy. Industry WUE ranges from 0.5 to 2.0 L/kWh. A facility running at WUE 1.5 with 10MW of IT load consumes approximately 131 million liters of water per year. That is 52 Olympic swimming pools worth of water, drawn from a single facility in a single year.

Scale that up to AI. A 100MW AI data center can consume 1 to 2 billion liters annually. GPU-intensive workloads generate two to three times more heat than traditional compute. A single NVIDIA H100 GPU produces 700W of thermal energy. A rack of eight GPUs puts out 5.6 kW from GPUs alone, before you add networking, storage, and power conversion overhead.

Traditional air-cooled facilities ran at rack densities of 8 to 12 kW. Modern AI facilities need 25 to 40 kW per rack, and often more for GPU-dense configurations. That heat has to go somewhere. In most cases, it goes into water.

The distinction matters because AI training workloads run 24/7 at maximum utilization. This is not the burst compute pattern that traditional data centers were designed around. A training cluster does not have off-peak hours. The cooling systems run at full capacity, day and night, for weeks or months straight. That sustained load translates directly into sustained water consumption.

---

# The Global Baseline

The World Resources Institute (WRI) Aqueduct 4.0 Dataset provides the most comprehensive water stress mapping available. Their baseline water stress indicator measures the ratio of total water withdrawals to available renewable surface and groundwater supplies.

Across all global data centers, the distribution breaks down like this:

- 58% are in high or extremely high water stress areas
- 32% are in medium stress areas
- 10% are in low stress areas

Market forecasts project data center investment in Southeast Asia reaching $30 billion by 2030, according to Planet Tracker. The majority of announced capacity targets water-stressed regions, specifically Jakarta and Singapore. That trajectory is not sustainable without serious changes in how operators think about site selection and cooling technology.

---

# Southeast Asia: A Regional Water Stress Map

I mapped 11 data center hubs across the region using WRI Aqueduct 4.0 data. The variation is significant.

Starting at the top: Jakarta and Bekasi sit at 85% water stress, classified as Extremely High. Singapore comes in at 72%, rated High. These are the two largest data center markets in the region, and they are both deep in the red zone.

The middle tier includes Kuala Lumpur at 45% (High), Bangkok at 38% (Medium-High), Manila at 35% (Medium-High), Ho Chi Minh City at 28% (Medium-High), and Clark Freeport Zone in the Philippines at 25% (Medium).

Then there are the markets that rarely get discussed. Hanoi sits at 22% water stress (Medium). Johor Bahru and Da Nang both come in at 18% (Low). Batam, Indonesia, registers at 30% (Medium).

The gap between Jakarta at 85% and Johor Bahru at 18% represents a fundamentally different operating environment. One requires aggressive water mitigation just to maintain a social license to operate. The other offers headroom for growth without competing directly with residential and agricultural water supplies.

---

# Jakarta and Bekasi: The Epicenter of Tension

Indonesia's data center market is experiencing explosive growth. Jakarta has emerged as Southeast Asia's fastest-growing data center market. But this growth is concentrated in one of the region's most water-stressed areas.

The Bekasi corridor alone has over 1,050MW of planned capacity across multiple campuses. The largest is Digital Edge's US$4.5 billion, 500MW campus in the Greenland International Industrial Center (GIIC). Additional projects include an enterprise campus at 150MW (US$1.2B), a colocation facility in Cibitung at 80MW (US$600M), a cloud provider campus in Deltamas at 200MW (US$1.8B), and a regional hub in Marunda at 120MW (US$900M). All of these sit in high water stress zones.

The numbers tell a story of rapid urbanization colliding with environmental limits. According to BAPPENAS data, the Bekasi Regency has a population of approximately 3.1 million people. Research published in the Indonesian Journal of Geography documented a 43% increase in built-up areas in the Bekasi River Basin between 1990 and 2018. Major flood events recorded by BNPB in 2020, 2021, and 2024 affected over 100,000 residents.

This is the Bekasi Paradox. It floods during wet seasons and faces severe water scarcity during dry seasons. Groundwater over-extraction drives land subsidence, which worsens flooding, which damages infrastructure, which increases extraction pressure on remaining water sources. Adding over a gigawatt of data center capacity into this cycle creates direct competition between industrial cooling demand and community water needs.

The operators moving into Bekasi are not ignoring this. Conservation measures being deployed include direct-to-chip liquid cooling to reduce evaporative tower dependency, recycled water systems, rainwater harvesting to capture tropical precipitation, and closed-loop cooling to minimize evaporative losses. Digital Edge specifically has committed to direct-to-chip cooling with recycled water systems at its CGK campus. But technology alone cannot resolve the fundamental supply-demand imbalance in an 85% water stress environment.

---

# Regional Innovations Worth Watching

Several initiatives across the region are tackling the water challenge directly.

Singapore launched the Sustainable Tropical Data Centre Testbed (STDCT) in 2023. It is the world's first full-scale facility focused on tropical data center cooling. The collaboration between the National University of Singapore, Nanyang Technological University, and 20 industry partners targets a 40% reduction in energy and water consumption. Given Singapore's 72% water stress index, this research carries real urgency.

In Malaysia, AirTrunk has partnered with Johor Special Water (JSW) to develop the country's largest recycled water supply scheme for data centers. This model, if it scales, could be replicated across the region and represents a shift from treating municipal water as the default supply.

These are not theoretical exercises. They are responses to an operating constraint that is already shaping investment decisions. The technology pipeline is promising, but adoption across the broader market remains uneven. Most facilities in the region still rely on conventional evaporative cooling towers as their primary heat rejection method.

---

# The Underutilized Markets

The most interesting part of the regional analysis is what emerges when you look beyond Jakarta, Singapore, and Kuala Lumpur. Several markets offer compelling alternatives with lower water stress, favorable demographics, and untapped capacity.

Hanoi presents a striking contrast to the saturated southern markets. Water stress indices around 15 to 22%. Abundant Red River basin resources. A growing tech-savvy workforce drawn from a population of 97 million. The Vietnamese government's National Digital Transformation Program targets 100,000 ICT enterprises by 2030. Combined data center capacity in Hanoi and Da Nang currently sits under 50MW, compared to 500MW or more planned for Ho Chi Minh City alone.

Da Nang, positioned as Vietnam's Silicon Valley of the East, benefits from cooler coastal climates that reduce cooling loads, water stress below 18%, and proximity to submarine cable landing stations. The city's infrastructure utilization remains under 40%. This is green-field territory.

Johor Bahru and the Iskandar Malaysia economic zone represent what might be the most balanced opportunity in the region. Water stress indices of 15 to 20%, which is significantly lower than Singapore's 72%. It sits 1 kilometer from Singapore via the causeway, which enables low-latency connectivity to the Lion City's financial hub. Land costs run 60 to 70% lower than Singapore. The Johor River basin provides established water infrastructure, and Malaysia's Digital Economy Blueprint offers tax holidays and grants.

Think about that for a moment. Johor Bahru offers proximity to Singapore's demand, a fraction of Singapore's water stress, and dramatically lower land costs. The trade-off is cross-border complexity and slightly higher latency. For disaster recovery, backup, and non-latency-sensitive workloads, the math is hard to argue with.

The Philippines has its own diversification story. Metro Manila's 35% water stress masks regional variation. Clark Freeport Zone, the former US air base, offers abundant land, dedicated power infrastructure, and water stress around 20 to 25%. Cebu, the second city, has growing fiber connectivity, water stress under 22%, and a BPO talent pool of over 150,000 professionals.

In Indonesia, alternatives to the Jakarta corridor include Batam (a free trade zone with Singapore proximity, 30% water stress, and duty-free equipment imports), Surabaya (Indonesia's second city serving East Java's 40 million people with moderate 35% water stress), and Nusantara, the planned new capital in East Kalimantan, which presents a long-term opportunity with greenfield infrastructure and projected water stress of 25 to 30%.

Thailand's Eastern Economic Corridor in Chonburi offers 28% water stress, lower than Bangkok's 38%, with dedicated data center power substations and tax incentives under the Thailand 4.0 initiative.

---

# A Framework for Mitigation

For operators already committed to water-stressed locations, or those building new capacity, the mitigation approach breaks into three tiers.

Immediate actions include implementing WUE monitoring (you cannot manage what you do not measure), optimizing cooling tower concentration ratios to reduce blowdown, deploying leak detection systems (small leaks compound to significant annual losses), and reviewing supply temperature setpoints to reduce cooling demand.

Medium-term investments mean transitioning to air-side economization where ambient conditions allow free cooling, installing rainwater collection systems (particularly valuable in tropical climates with consistent rainfall), deploying direct-to-chip liquid cooling for high-density racks, and implementing water recycling to treat and reuse cooling tower blowdown.

Strategic decisions are the ones that matter most. Site selection should factor in water stress alongside power availability. Technology choices for new builds should prioritize air-cooled or closed-loop liquid systems. Community engagement with local water utilities on supply security is not optional. And climate modeling should design for 2050 water conditions, not current averages.

---

# The Portfolio Approach

The practical answer is not to avoid Jakarta or Singapore. These are major demand centers with established ecosystems and connectivity. The answer is portfolio diversification.

A balanced SEA data center strategy pairs high-demand, high-stress markets with emerging low-stress locations. The framework has three layers.

First, latency tiers. Place primary workloads in established hubs and route disaster recovery and non-latency-sensitive operations to emerging markets.

Second, a water portfolio. Concentrate water-intensive cooling in low-stress regions and deploy advanced cooling technology in stressed areas.

Third, risk distribution. Diversify across regulatory environments, climate zones, and infrastructure maturity levels within ASEAN.

The operators who treat water stress as a portfolio risk rather than a site-level problem will build more resilient businesses. This is not abstract strategy. It is how you avoid having 85% of your cooling capacity dependent on water supplies that are already oversubscribed.

---

# Looking Forward

The data center industry in Southeast Asia stands at an inflection point. The decisions made between 2026 and 2030 will determine whether the region's digital infrastructure becomes part of the water crisis or part of the solution.

The $30 billion flowing into SEA data centers over the next five years represents an opportunity to build digital infrastructure that respects planetary boundaries. Water stress is a constraint, but it is also a catalyst for innovation. The operators who master water efficiency in tropical, water-stressed environments will have a competitive advantage as these challenges go global.

The solutions exist. Singapore's tropical cooling research. Malaysia's recycled water schemes. Vietnam's emerging green-field opportunities. Indonesia's geographic diversification options. The question is not whether sustainable data center growth is possible in Southeast Asia. The question is whether the industry will embrace the regional diversity that makes it achievable.

One more thing. Water Usage Effectiveness reporting should receive the same scrutiny that Power Usage Effectiveness has received over the past decade. PUE drove an industry-wide improvement in energy efficiency because it gave operators, investors, and regulators a common metric. WUE can do the same for water, but only if operators commit to transparent reporting rather than burying the number in sustainability reports nobody reads.

Every liter consumed must be measured, managed, and minimized. That is not a slogan. It is an operating requirement for the next decade of AI infrastructure in this region.

The full article, including an interactive water consumption calculator that lets you model your own facility across eight Southeast Asian regions, is available on resistancezero.com.

---

# References

1. S&P Global Sustainable1 (2024). "Beneath the Surface: Water Stress in Data Centers." Analysis of 58% water stress statistic.
2. World Resources Institute (2024). "Aqueduct 4.0 Water Risk Atlas." Baseline water stress indicator methodology.
3. Planet Tracker (2024). "Will Asian AI Ambitions Be Constrained by Water Resources?" $30B SEA investment projection.
4. Data Center Knowledge (2024). "Digital Edge to Develop 500 MW Data Center Campus in Indonesia." Bekasi CGK Campus details.
5. DataCenters.com (2024). "Jakarta Emerges as Southeast Asia's Fastest-Growing Data Center Market."
6. Brookings Institution (2024). "AI, Data Centers, and Water." Water usage effectiveness standards.
7. Undark Magazine (Dec 2025). "How Much Water Do AI Data Centers Really Use?" GPU heat generation data.
8. GovInsider Asia (2024). "Water Resilient Data Centres Can Drive Asia's Digital Economy." Singapore tropical cooling research.
9. NVIDIA Corporation (2024). "H100 Tensor Core GPU Specifications." 700W TDP specification.
10. BPS-Statistics Indonesia (2023). "Proyeksi Penduduk Indonesia." Bekasi Regency population data.
11. Rustiadi, E., et al. (2020). "Land Use Changes and Urban Sprawl in Bekasi Regency." Indonesian Journal of Geography, Vol. 52, No. 2. 43% built-up area increase (1990-2018).
12. BNPB (2024). "BNPB Disaster Database (DIBI)." Flood event records for Bekasi.
13. Industry standard: WUE = Annual Water Consumption (L) / IT Energy (kWh).

---

Originally published at [resistancezero.com](https://resistancezero.com/article-10.html)
