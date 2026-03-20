# Hyperscaler & Cloud Company-Specific RFS Requirements
## Comprehensive Commissioning & Ready-for-Service Standards by Company
### Research Date: 2026-03-18

---

## Table of Contents

1. [Google Cloud / Google DeepMind](#1-google-cloud--google-deepmind)
2. [Microsoft Azure](#2-microsoft-azure)
3. [Amazon Web Services (AWS)](#3-amazon-web-services-aws)
4. [Meta (Facebook)](#4-meta-facebook)
5. [Oracle Cloud Infrastructure (OCI)](#5-oracle-cloud-infrastructure-oci)
6. [Apple](#6-apple)
7. [OpenAI / Stargate](#7-openai--stargate)
8. [xAI (Elon Musk)](#8-xai-elon-musk)
9. [NVIDIA DGX Cloud](#9-nvidia-dgx-cloud)
10. [Equinix / Digital Realty / CyrusOne (Colocation)](#10-equinix--digital-realty--cyrusone-colocation)
11. [Comparative Summary Table](#11-comparative-summary-table)
12. [Sources](#12-sources)

---

## 1. Google Cloud / Google DeepMind

### RFS Timeline
- **Construction phase:** 18-24 months (confirmed by Google Regional Head of Data Center Public Affairs)
- **Total site selection to RFS:** ~36+ months when including pre-construction (site selection, permitting, utility agreements, procurement)
- **Example:** Google broke ground on first Kansas City, MO campus in 2024; still under construction as of February 2026

### Commissioning Methodology & Testing Protocols
- Google's internal commissioning processes and RFS checklists are **proprietary and not publicly disclosed**; shared under NDA with contractors and vendors
- Follows industry-standard L0-L5 commissioning framework with Google-specific enhancements
- Google acknowledges that during commissioning, all chillers and air movers are run simultaneously to test proper operation, while IT load is small (early deployment stage), causing temporarily elevated PUE readings
- **DeepMind AI integration:** Google's autonomous AI cooling system gathers thousands of sensor readings every 5 minutes, feeding deep neural networks to predict impact of cooling adjustments; examines 21 input variables including outside air temperature, barometric pressure, wet-bulb/dry-bulb temperature, dew point, power load, and air pressure
- **72-hour full-load test:** While not explicitly documented in public sources as a Google-specific requirement, the 72-hour full-load burn-in test is a well-known hyperscaler IST (Integrated Systems Testing) practice. Google's Level 5 commissioning includes comprehensive full-load and overload/stress testing

### PUE Targets
- **2024 global fleet average PUE: 1.09** (vs. industry average of 1.56)
- Multiple sites report quarterly PUE < 1.10; two sites achieved PUE of 1.08
- Best-performing site: 1.04 (Ohio)
- DeepMind AI cooling system achieved 40% reduction in cooling energy and 15% reduction in overall PUE overhead
- Commissioning target for newest GPU-optimized facilities: **PUE ~1.08**

### Sustainability Requirements for New DCs
- 100% renewable energy match globally every year since 2017
- Over 170 agreements for 22+ GW of clean energy worldwide; $3.7B+ invested in clean energy
- Goal: Carbon-free energy every hour of every day (24/7 CFE)
- Water-cooled DCs use ~10% less energy and emit ~10% less carbon than air-cooled equivalents
- Water cooling reduced energy-related carbon footprint by ~300,000 tons CO2 (2021)
- **Bifurcated cooling strategy by geography:** Liquid cooling default for Europe; advanced air cooling for water-stressed US states (Texas, Nevada)

### Modular Construction Approach
- Standardized modular, liquid-ready data centers in Europe (e.g., EUR5.5B German expansion)
- **Project Mt. Diablo:** Disaggregated power rack (AC-to-DC sidecar) separating power components from IT rack; improves end-to-end efficiency by ~3%; joint project with Meta and Microsoft via OCP
- **+/-400 VDC power delivery:** Leveraging EV supply chain for up to 1 MW per rack; replaces earlier 48 VDC distribution
- Modular CDU (Coolant Distribution Unit) architecture with redundant components and UPS

### Liquid Cooling Adoption Timeline
- **2018:** First liquid cooling deployment with TPU v3
- **2023:** Liquid-cooled TPU pods at scale
- **2024-2025:** ~50% of Google's global DC footprint has liquid cooling enabled/deployed (~1 GW capacity across 2,000+ TPU pods)
- **Uptime:** 99.999% across liquid-cooled deployments since 2020
- **Project Deschutes:** 5th-generation CDU contributed to OCP; 2 MW class cooling capacity at 80 PSI; prototypes by Nidec and Boyd showcased at SC25 and OCP Summit 2025
- **Future target:** >500 kW per IT rack before 2030; 1 MW per rack with +/-400 VDC

### Power Density Requirements
- Current TPU pods: High density (specific kW not disclosed but enabled liquid cooling at ~1 GW across fleet)
- **Future roadmap:** >500 kW per rack before 2030, up to 1 MW per rack
- Liquid-cooled ML servers have nearly half the geometrical volume of air-cooled counterparts
- Quadrupled compute density within existing DC footprints via liquid cooling adoption

### Redundancy Requirements
- Google uses N+1 minimum for cooling CDUs (redundant pump and heat exchanger per CDU)
- Fleet-wide CDU availability: ~99.999% since 2020
- Power distribution: Transitioning from 48 VDC to +/-400 VDC with redundant paths
- Minimum 3 power sources per rack for high-density configurations (per NVIDIA reference architecture compatibility)

### Proprietary Testing Tools / Methodologies
- **DeepMind AI cooling agent:** Deep reinforcement learning system for autonomous cooling control
- **21-variable monitoring system:** Real-time sensor data feeding neural networks
- Internal commissioning tools and checklists are proprietary (NDA-restricted)
- Digital twin capabilities for system simulation

### Staffing Requirements
- Not publicly disclosed for commissioning specifically
- Industry benchmark: Hyperscale facilities >100 MW operate with fewer people per MW due to automation
- Google's AI-driven autonomous cooling reduces human intervention requirements

### Construction Costs
- Not publicly disclosed per MW
- Industry benchmark for hyperscale self-builds: $7-12M per MW
- AI-optimized facilities with liquid cooling: $15-20M+ per MW

---

## 2. Microsoft Azure

### RFS Timeline
- **New datacenter construction:** 6 months to 3 years (per Microsoft's own documentation)
- **Improving trajectory:** Compass tool helping reduce timelines
- **Modular approach:** Each building ~250,000 sq ft with 48 MW critical IT capacity, divided into 5 data halls (9.6 MW each)

### Commissioning Methodology: The Compass Tool
- **Platform:** Built on Microsoft Dynamics 365
- **Developed by:** Microsoft Datacenter Planning and Execution Engineering (DPXE) team within Cloud Operations + Innovation Engineering (CO+I E)
- **Led by:** Danielle Harden (Senior Engineering PM) and Venkatesh Muthiah (Principal Software Engineer)
- **Capabilities:**
  - Manages and orchestrates procurement, cost management, change management, safety, and commissioning
  - Multi-step process tracking with stage gates
  - Replaced third-party legacy systems with scalability/security issues
  - Document organization and centralized visibility
  - Phase-completion enforcement before moving to next stage
- **Purpose:** "Compass helps us take all of those very hard-to-find documents and organizes them... This system looks at a multi-step process and tells us what we need to complete before moving on to the next phase"

### Azure RFS Requirements
- Stage-gated process aligned with industry L0-L5/L6 commissioning
- Compass enforces completion gates before phase progression
- Internal processes are proprietary; specifics shared under NDA with construction partners
- Microsoft uses color-coded tag system for commissioning levels (industry standard: Green Tag L3, Blue Tag L4, White Tag L5)

### PUE Targets
- **Design PUE for newest generation:** 1.12
- **Best performing site:** 1.11 (Wyoming, USA)
- **Worst performing site:** 1.35 (Illinois)
- **Global average (2024):** 1.16-1.18
- **Target for newest GPU-optimized (Fairwater) facilities:** PUE ~1.08
- In almost every region, actual operating PUE is more efficient than design targets
- Microsoft's sustainability targets notably don't specifically mention PUE as a primary metric

### Sustainability Commitments
- **Carbon negative by 2030** (all three scopes of emissions)
- **By 2050:** Remove all carbon emitted since founding in 1975
- **By 2030:** 100/100/0 target (100% electricity matched, 100% of time, zero-carbon purchases)
- **By 2030:** Diesel-free operations
- **$1 billion Climate Innovation Fund** for carbon reduction/removal technologies
- **Water positive by 2030:** 40% improvement in water-use intensity
- **2024 WUE:** 0.30 L/kWh (39% improvement from 2021)
- **$45 million** allocated to innovative water solutions
- 76 water replenishment projects across 25 locations (100M+ cubic meters replenishment)

### Nuclear/Clean Energy
- **Three Mile Island restart:** 20-year PPA with Constellation Energy for 837 MW; $1.6B restart cost; expected 2028
- **Small Modular Reactors (SMRs):** Hired Principal PM for Nuclear Technology (October 2023) for global SMR/microreactor strategy
- Nuclear costs: $6,417-$12,681/kW vs. $1,290/kW for natural gas

### Cooling & Power Density
- **Traditional cloud racks:** <20 kW
- **Current AI racks (GB200/GB300 NVL72):** ~136-140 kW per rack with custom liquid cooling HXU
- **Per row:** 1,360 kW per row in Fairwater AI datacenters
- **Fairwater AI datacenters:** Zero water for cooling; chip-level cooling; avoids 125M+ liters of water per year per DC; water used in initial fill equivalent to 20 homes/year, designed for 6+ years
- **Zero-water cooling design launched August 2024**

### Redundancy Requirements
- **Standard:** 2N power distribution with independent busway pairs (A-side and B-side)
- **"Catcher" design:** N+1 with multiple smaller UPS (3x1 MW) and Static Transfer Switches (STS) instead of traditional 2x3 MW 2N
- **4N3R configuration:** Four independent power systems, three needed for operation
- **Fairwater AI DCs:** Novel approach - forgoing traditional resiliency (generators, UPS, dual-corded) for GPU fleet by securing highly available grid power (4x9 availability at 3x9 cost)
- **Power distribution:** Direct three-phase 480V AC to rack; eliminates traditional UPS and step-down stages

### Proprietary Tools
- **Compass (Dynamics 365):** Construction/commissioning management
- **AI-driven power optimization:** PUE ratios < 1.12
- Mt. Diablo open rack design (joint with Meta and Google via OCP)

### Staffing Requirements
- Each building (~250k sq ft, 48 MW) divided into 5 data halls with dedicated electrical equipment per pod
- Not publicly disclosed for commissioning team sizes

### Construction Costs
- **Data center-related emissions context:** 280,782 metric tons CO2e (2022, market-based); 6.1M metric tons (location-based)
- Industry benchmark: $10-14M per MW; AI-optimized $20M+ per MW

---

## 3. Amazon Web Services (AWS)

### RFS Timeline
- **Project Rainier (Indiana):** Spring 2023 (site scouting) --> September 2024 (construction began) --> October 2025 (7 of 30 buildings operational) = ~13 months from construction start to first buildings online
- **Standard hyperscale self-build:** 18-24 months construction; 36+ months total with pre-construction
- **Compressed Rainier timeline:** 4 general contractors deployed simultaneously; facility design updated mid-construction to speed deployment; 4,000+ construction workers at peak

### Commissioning: Operational Readiness Review (ORR)
- **ORR definition:** Review and inspection process using checklist of requirements; self-service experience for team certification
- **ORR composition:** Architectural recommendations, operational process, event management, and release quality
- **Lifecycle integration:** ORR built into entire SDLC, not just pre-launch:
  - ORR Cycle Start: During design phase (design/architecture questions)
  - Mid-Cycle Check-in: Development and testing questions
  - Conclusion and Follow-up: Narrative reviewed by senior AWS leadership
- **Correction of Errors (COE):** Closed-loop post-incident analysis; major driver of ORR items
- **Inspection processes:**
  - Weekly operational metrics meeting attended by thousands of engineers up to SVP level
  - Teams present metrics/dashboards including when last ORR was performed and outstanding action items
- **ORR Tools:**
  - AWS Well-Architected Tool with Custom Lens capability (launched Nov 2021)
  - AWS Trusted Advisor, AWS Systems Manager, AWS Config
- **Physical commissioning (ACx):** Internal team structure not publicly disclosed; follows industry L1-L5 framework

### PUE Targets
- **2024 global PUE:** 1.15
- **Best performing site (Europe):** 1.04
- **Best Americas site:** 1.05
- **Best APAC site:** 1.07
- **Target with new components (2025+):** PUE 1.08
- Better than public cloud average of 1.25 and enterprise on-premises average of 1.63

### Project Rainier Specifics
- **Location:** New Carlisle, Indiana (1,200 acres)
- **Initial investment:** $11 billion (largest in Indiana history)
- **Additional investment (Nov 2025):** $15 billion for 2.4 GW more capacity
- **Current state:** 7 buildings with ~500,000 Trainium2 chips (expected to top 1M by end of 2025)
- **Full plan:** 30 buildings, 2.2 GW total
- **Hardware:** 100% AWS Trainium2 chips (largest known non-NVIDIA compute deployment)
- **Efficiency gains:** Mechanical components reduce energy consumption by 46%; concrete cuts embodied carbon by 35%
- **Community impact:** 1,000+ jobs; $7M highway improvements; $114M utility upgrades; $100M community fund

### Cooling Specifications
- **Custom liquid cooling system:** Designed and deployed in 11 months (design to production)
- **Direct-to-chip methodology:** Cold plates directly on processors; closed-loop circulation
- **IRHX platform (July 2025):** Rack-level liquid cooling with water-distribution cabinet, integrated pumping unit, and in-row fan-coil modules
- **Custom CDU:** Invented specifically for AWS needs; optimized for lower cost, greater efficiency, higher capacity
- **Efficiency:** Reduces mechanical energy consumption by up to 46% during peak cooling; no additional water required
- **Liquid is 900x denser than air** for heat absorption
- **Multimodal cooling:** Seamlessly integrates air and liquid cooling for different hardware types
- **2024 WUE:** 0.15 L/kWh (17% improvement YoY, 40% improvement since 2021)
- **Water positive target:** By 2030 (53% progress as of 2024)

### Power Density
- **Current trajectory:** 6x increase in rack power density over next 2 years, additional 3x increase after
- **AI training racks:** 100+ kW per rack (Trainium2/GB200 NVL72)
- **Enables:** 12% increase in compute power at every site

### Redundancy
- **Design standard:** Tier III/IV with redundant power and cooling
- **Multi-AZ architecture:** Each AWS Region has multiple isolated Availability Zones; each AZ = one or more physical DCs
- **AZ interconnection:** High-bandwidth, low-latency fully redundant metro fiber with encryption
- **Custom hardware:** Graviton4 (96 Arm cores, 60% less energy per performance vs comparable EC2), Trainium2 (4x faster training, 2x energy efficiency vs Trainium1)

### Proprietary Tools
- **ORR process with Custom Lens** in Well-Architected Tool
- **AI/ML-driven rack placement** using generative AI to minimize stranded power
- **COE (Correction of Errors)** closed-loop incident analysis
- Internal physical commissioning tools not publicly disclosed

### Staffing
- **Project Rainier peak:** 4,000+ construction workers/day (town population: 1,900)
- 4 general contractors running simultaneously
- **Operational:** 1,000+ permanent jobs at Indiana campus
- Industry benchmark: 20-50 FTEs for operational staffing per facility

### Construction Costs
- **Project Rainier:** $11B initial for ~2.2 GW planned = ~$5M/MW (infrastructure shell)
- **Industry benchmark:** $10-14M/MW; AI-optimized $20M+/MW
- **Amazon total DC capex 2025:** >$100 billion
- **Fully loaded with custom silicon:** Significantly higher per MW

---

## 4. Meta (Facebook)

### RFS Timeline
- **Typical hyperscale build:** 24-36 months from initial mobilization
- **Phased delivery model:** First mission-critical zones come online well before full completion
- **Build model:** Speed and repeatability; overlapping construction waves across campus
- **Template-based:** Standardized templates, modular components, rapid procurement, prequalified trade partners
- **Richland Parish, LA (2025 announcement):** 4M+ sq ft hyperscale AI campus; phased delivery following Meta's high-efficiency model

### Phased Data Hall Delivery Approach
- Early turnover zones prioritized for core IT infrastructure installation and commissioning while other areas still under construction
- Commissioning of data halls, networking, and power systems proceeds independently of full campus completion
- Same model used across all Meta hyperscale builds

### Open Compute Project (OCP) Standards
- **Founded 2011** by Meta (then Facebook); open-sourced designs from Prineville, Oregon DC
- **400+ member companies** including Google, Microsoft, AWS, NVIDIA, Intel, Dell, etc.
- **Key OCP standards affecting commissioning:**
  - **Open Rack V3.1:** 600mm external width, 537mm (21") internal width, OpenU (48mm) sizing
  - **High Power Rack (HPR):** 92+ kW per rack (Meta + Rittal, May 2024)
  - **Power distribution:** Three-phase 277/480 VAC (eliminates one transformer stage); single 12.5 VDC supply; 48 VDC battery backup
  - **Mt. Diablo:** Disaggregated AI rack design (joint with Microsoft and Google); separate power and compute cabinets
  - **FBOSS with SAI:** Open networking switch API for multi-vendor ASIC compatibility
  - **Project Deschutes CDU:** (Google-originated, OCP-contributed) for liquid cooling standardization

### PUE Targets
- **2024 reported PUE:** 1.08
- **Recently completed buildings:** 1.09
- **Gallatin, TN facility (with liquid cooling):** 1.10
- **Original Prineville, OR facility:** 1.07 (at launch in 2011)
- **Industry context:** Among the most energy-efficient data centers globally

### Sustainability/Efficiency Targets
- **Net zero emissions** across value chain by 2030
- **Water positive by 2030**
- All owned DCs certified **LEED Gold or higher**
- 100% of owned/operated DC electricity matched with clean and renewable energy
- Piloting low-carbon concrete (AI-optimized formulas, fly ash/slag substitution)
- Construction waste diverted from landfills (2024)

### Custom Server & Rack Impact on Commissioning
- OCP-based custom hardware requires commissioning teams familiar with non-standard rack formats (21" OpenU vs. standard 19")
- HPR ecosystem at 92+ kW per rack requires liquid cooling commissioning expertise
- Three-phase 277/480 VAC direct distribution changes electrical commissioning procedures vs. traditional architectures
- 48 VDC battery backup differs from traditional UPS commissioning
- Disaggregated power (Mt. Diablo) introduces separate power cabinet testing and integration

### Cooling Specifications
- **Gallatin, TN:** Combination of chilled water systems and direct-to-chip liquid cooling
- **Next-gen DCs:** Designed for high-density computing with fewer square feet for similar compute capacity
- **Industry-leading cooling innovation via OCP contributions**

### Power Density
- **Current HPR standard:** 92+ kW per rack (May 2024)
- **AI training/inference targets:** 50-100+ kW per rack
- **OCP roadmap:** Supporting 100+ kW with liquid cooling as standard

### Redundancy
- Not publicly specified in detail
- OCP rack designs support both N+1 and 2N power configurations
- 48 VDC battery backup provides per-rack resilience

### Proprietary Tools
- OCP open-source hardware specifications and testing protocols
- FBOSS (Facebook Open Switching System) with SAI
- Internal commissioning tools not publicly disclosed

### Staffing
- Large-scale construction with prequalified trade partners
- Industry benchmark applies: Hyperscale commissioning teams of 50-200+ during peak

### Construction Costs
- **Prineville, OR (2011):** 38% energy savings, 24% lower infrastructure cost vs. industry standard
- OCP hardware reduces DC infrastructure cost by ~24%
- Industry benchmark: $7-12M/MW for hyperscale; AI-optimized higher

---

## 5. Oracle Cloud Infrastructure (OCI)

### RFS Timeline
- **Standard OCI deployment:** Varies widely; Oracle leases most DCs rather than self-building
- **Stargate Abilene (Oracle-built):** Phase 1 (2 buildings, ~200 MW) went from construction to operational in ~15 months
- **Fast-track approach:** Some facilities brought online in "several months" (e.g., Abilene SuperCluster with ~200,000 GPUs)
- **Wisconsin campus (Oracle/OpenAI/Vantage):** Slated for 2028 completion
- **Challenges:** Several Stargate facilities delayed from 2027 to 2028 due to supply chain constraints

### Fast-Track DC Deployment
- Oracle brings capacity online rapidly when leasing: 400 MW stood up in single quarter (Q3 FY2026)
- **Bloom Energy partnership:** Fuel cell technology delivering onsite power for entire DC within 90 days
- Modular approach with leased facilities from partners like Aligned Data Centers, Crusoe, and CoreWeave

### Stargate Involvement & Commissioning
- **Primary cloud infrastructure partner** for Stargate; leading 3 of 5 new sites
- 4.5 GW additional Stargate capacity agreement with OpenAI (July 2025)
- >$300 billion partnership over 5 years
- **Abilene first deliveries:** NVIDIA GB200 racks delivered; early training and inference workloads running
- **Planned GPU deployment:** 450,000+ GB200 GPUs at Abilene under 15-year lease
- **Zettascale10:** AI supercomputer connecting hundreds of thousands of GPUs across multiple DCs; expected H2 2026

### Distributed Cloud Strategy
- **Only hyperscaler** delivering 200+ AI and cloud services across public, dedicated, and hybrid cloud
- **Environments:** Public cloud regions, Government Cloud (US, UK, Australia), EU Sovereign Cloud, Cloud@Customer (on-premises)
- **Key differentiator:** Cloud@Customer can be completely disconnected from cloud control plane (unlike AWS Outposts, Azure Stack)
- 160+ public and private data centers (ranging from 25 kW to 800 MW)

### Power Density
- **Stargate sites:** 100-150 kW per rack expected
- **Aligned Data Centers (partner):** Supports variable rack densities up to 50 kW per rack within same row
- **Stargate ultra-high-density:** 120+ kW per rack with direct-to-chip liquid cooling

### PUE
- No publicly disclosed Oracle-specific PUE numbers
- Partner facilities (e.g., Aligned) use waterless design for low PUE
- Stargate sites targeting 1.1-1.2 range with liquid cooling

### Sustainability
- Goal: 100% renewable energy in all OCI DCs by 2025 (Europe and Latin America already met)
- Dry coolers and closed-loop chiller systems with zero water wastage
- Direct-to-chip liquid cooling for AI hardware

### Redundancy
- Varies by facility type and partner
- OCI regions built with isolated availability domains
- Government/sovereign cloud with cryptographic and operational isolation

### Construction Costs
- **Abilene Phase 1:** ~$1.1B for ~200 MW = ~$5.5M/MW (infrastructure only)
- **Abilene fully loaded:** ~$12-16.5M/MW (including GPUs)
- **Total Abilene campus:** ~$12-15B for 1.2 GW
- **Oracle capex trajectory:** $6.9B (2024) --> $21.2B (2025) --> ~$35B (2026 projected)
- **Debt concerns:** Planning to raise up to $50B in debt and equity; $455B revenue backlog

---

## 6. Apple

### RFS Timeline
- **Typical Apple DC build:** Multi-year; Apple has experienced significant delays
- **Waukee, Iowa example:** Announced 2017, originally due 2020; extended to August 2022, then to August 2027; one building confirmed operational as of 2025; total 8+ years from announcement
- **Maiden, NC:** Multiple phased expansions over years; campus now ~1 million sq ft across 4 buildings

### Commissioning Requirements
- Apple's internal commissioning requirements are **not publicly disclosed**
- All facilities must meet **100% renewable energy from Day 1** of operation
- Facilities must achieve **LEED Platinum certification** (highest rating)
- Commissioning must verify renewable energy systems integration
- Cooling system commissioning includes verification of water-free cooling capabilities

### 100% Renewable Energy Approach
- **Since 2014:** All Apple data centers powered by 100% renewable energy
- **Since 2018:** Global facilities (stores, offices, DCs) powered by 100% clean energy in 43 countries
- **25 operational renewable energy projects** totaling 626+ MW; 15+ more in construction; 1.4+ GW at full build
- **80%+ of renewable energy** from Apple-created projects
- **Sources:** Solar, wind, biogas fuel cells, low-impact hydropower
- **2023 energy by facility:**
  - Mesa, AZ: 488M kWh (82% solar, 18% wind)
  - Maiden, NC: 453M kWh (82% solar, 12% wind)
  - Reno, NV: 440M kWh (100% solar)
  - Prineville, OR: 269M kWh (60% wind, 38% solar, 2% micro-hydro)

### Environmental Standards
- **Carbon neutral** across all corporate emissions since 2020
- **By 2030:** Reduce emissions by 75%; carbon removal for remaining 25%
- Proprietary server design (2021) achieved additional 36M kWh/year energy savings
- Custom Apple silicon AI servers designed for performance-per-watt optimization
- Piloting plant-based water treatment for cooling water efficiency
- Denmark DC captures excess heat for district heating

### PUE
- Apple does **not publicly disclose specific PUE numbers**
- Fan energy cut by 35% using K&N reusable air filters
- Maiden, NC facility is **LEED Platinum certified**
- Design philosophy prioritizes energy efficiency and renewable matching

### Cooling Specifications
- **Outside air cooling** during night and cold-weather hours reduces chiller usage by 75% (NC campus)
- **Water-free cooling systems** in recent designs
- **Waste heat recapture** for district heating (Denmark)
- Closely monitors water-usage efficiency; recycles water (especially AZ, NV desert facilities)
- Developing innovative cooling technologies to increase capacity within existing footprints

### Power Density
- Apple does **not publicly disclose rack power density** specifications
- Historically operated custom server designs (not industry-standard configurations)
- Custom Apple silicon (M-series based) AI servers designed for efficiency over raw density
- Private Compute Cloud infrastructure optimized for inference workloads

### Redundancy
- Not publicly specified
- Given LEED Platinum and high-reliability service requirements, likely Tier III+ equivalent
- Multiple data center locations provide geographic redundancy

### Construction Costs
- **Planned investment:** $10 billion over 5 years in US DC construction ($4.5B in first 2 years)
- **Waukee, IA:** $1.3B for 400,000 sq ft facility (potential 1.9M sq ft at full build on 2,000 acres)
- **Maiden, NC:** 10 MW Bloom Energy fuel cell installation using biogas from nearby landfill

### Staffing
- 550+ construction and operations jobs projected per major campus
- Internal commissioning teams; specifics not publicly disclosed

---

## 7. OpenAI / Stargate

### Stargate Overview
- **Joint venture:** OpenAI, SoftBank, Oracle, MGX (investment firm)
- **Total planned investment:** Up to $500 billion by 2029
- **Total planned capacity:** ~10 GW across US
- **Announced January 21, 2025** by President Trump at White House

### Abilene, TX Campus
- **Site:** 875-1,000 acres
- **Design:** 8 H-shaped buildings, ~440,000 sq ft each
- **Capacity:** 1.2 GW total; 30 MW data halls per building
- **GPU target:** 450,000+ NVIDIA GB200 GPUs
- **Infrastructure partner:** Crusoe (on OCI)
- **Each building:** ~50,000 GB200 NVL72 GPUs on single integrated network fabric; ~$6B real assets; ~30 technical staff

### Timeline: Construction to First GPU Deployment
| Phase | Timeline | Details |
|-------|----------|---------|
| Site preparation | June 2024 | Construction begins |
| Phase 1 complete | September 2025 | 2 buildings operational (~200 MW); ~15 months from groundbreaking |
| First GPU workloads | September 2025 | NVIDIA GB200 racks delivered; early training and inference |
| Phase 2 | March 2025 start --> mid-2026 target | 6 additional buildings, ~1 GW more |
| Full campus | Mid-2026 target | 8 buildings, 1.2 GW |

### Specific Testing Requirements for AI Workloads
- Direct-to-chip liquid cooling validation (mandatory for GB200 NVL72)
- Closed-loop zero-water-evaporation cooling system verification
- Network fabric testing across 50,000 GPU single-fabric domains per building
- **Known failure:** Winter 2026 weather event disrupted liquid cooling infrastructure at Abilene, knocking multiple buildings offline for days -- highlighting the critical importance of cooling system commissioning in extreme weather
- Power redundancy validation including 360 MW on-site natural gas backup
- Battery storage validation (1,000 MW / 4,000 MWh on-site)
- Solar farm integration testing

### Power & Cooling Specifications
- **Power density:** 100-150 kW per rack (GB200 NVL72 at 120-140 kW)
- **Cooling:** Direct-to-chip liquid cooling; closed-loop; "zero-water-evaporation" after initial ~1M gallon charge
- **Annual water per building after fill:** ~12,000 gallons (maintenance top-up only)
- **On-site power:** 360.5 MW natural gas turbines (~$500M); 1,000 MW/4,000 MWh battery; dedicated solar farm
- **Grid connection:** ERCOT (Texas grid)

### Construction Costs
- **Infrastructure only:** ~$5.5M/MW
- **Fully loaded with GPUs:** ~$12.5-16.5M/MW
- **Phase 1 (2 buildings):** ~$1.1B construction + ~$2.3B GPUs = ~$3.4B total
- **Total Abilene campus:** ~$12-15B (Crusoe financing: $11.6B debt/equity + $15B JV)
- **GPU procurement:** ~$40B for 400,000 GB200 chips (Oracle order)

### Broader Expansion
- 5 new sites announced September 2025: Shackelford County TX, Dona Ana County NM, Lordstown OH, Milam County TX, undisclosed Midwest
- Combined capacity: ~7 GW planned, >$400B investment over 3 years
- **Cancelled:** 600 MW Abilene expansion dropped due to financing/weather issues; OpenAI waiting for Vera Rubin architecture

---

## 8. xAI (Elon Musk)

### Colossus Memphis: Fast-Track Commissioning
- **The most extreme compressed timeline in DC history**
- **Phase 1:** 100,000 H100 GPUs online in **122 days** from conception to completion
- **Rack-to-training:** Only **19 days** from server racks on floor to first mass training run
- **Phase 2:** Doubled to 200,000 GPUs in additional **92 days** (50,000 H200 units added)
- **Colossus 2:** 200 MW live in 6 months from site acquisition (vs. 15 months for Oracle/Crusoe at comparable scale)
- **Industry comparison:** Traditional DC planning alone takes average 4 years

### Compressed Timeline Approach
- **Site selection:** Repurposed existing industrial buildings (abandoned 2012 Electrolux factory; 1M sq ft warehouse)
- **Ready in 19 days** from conception to construction start
- **Parallel workstreams:** Facility preparation, power infrastructure, cooling, and compute deployment running simultaneously
- **Temporary infrastructure:** Leased generators and ~25% of US mobile cooling capacity to kickstart operations while permanent systems completed
- **Fast-track approvals:** Greater Memphis Chamber fast-tracked approvals and negotiations
- **Multiple OEM partners:** Dell Technologies and Supermicro simultaneously building server infrastructure

### Current State (as of early 2026)
- **Phase 1 (Colossus 1):** 150,000 H100 + 50,000 H200 + 30,000 GB200 = 230,000 GPUs
- **Phase 2 (Colossus 2):** Expanding to 555,000 GPUs; 2 GW total capacity; $18B in GPU procurement
- **World's largest single-site AI training installation**
- **Colossus 2 building permit:** $659M for 312,000 sq ft (March 2026)

### Power Specifications
- **Colossus 1:** 250-300 MW
- **Colossus 2 target:** 2 GW total
- **Initial grid connection:** Only 8 MW; supplemented with gas turbines
- **On-site generation:** Solaris Energy Infrastructure fleet of 600 MW gas turbines (~400 MW serving xAI); 1.1+ GW expected by Q2 2027
- **Substation upgrade:** MLGW upgrading to 50 MW ($760K taxpayer cost); xAI spending $24M for additional 150 MW substation

### Power Density & Cooling
- **H100/H200 racks:** 64 GPUs per rack (8x 4U servers with 8 GPUs each), 1,500 GPU racks total for 100K deployment
- **GB200 NVL72:** ~7,700+ compute racks at full deployment
- **Custom liquid cooling:** Developed with Supermicro; CDU per rack circulating coolant
- **Colossus 2 cooling:** 119 air-cooled chillers providing ~200 MW cooling capacity
- **Water usage:** Up to 1.3M gallons/day from Memphis Aquifer
- **Mitigation:** $78M graywater recycling facility planned (could reduce aquifer strain by 10M gallons/day)
- **Direct-to-chip:** 0.1 L/s makeup water per MW of IT load

### PUE
- **Achieved: 1.18** (well below industry average of 1.4 for high-density AI)
- **Target: 1.10** (described as "ambitious benchmark")

### Networking
- Spectrum-X Ethernet: 95% throughput (vs. 60% on traditional Ethernet)
- 194 PB/s total memory bandwidth
- 3.6 TB/s network bandwidth per server
- 1+ EB storage capacity

### Staffing
- **Phase 1 target:** Up to 500 jobs in Memphis
- **Current:** ~320 jobs added
- NVIDIA, Dell, Supermicro also establishing Memphis operations

### Construction Costs
- **GPU procurement:** ~$18B for 555,000 GPUs
- **Colossus 2 site acquisition:** $80M
- **Substation:** $24M (xAI) + $760K (taxpayer)
- **Graywater facility:** $78M
- **Building permit:** $659M (Colossus 2)
- **Per MW estimate:** Infrastructure costs lower than industry average due to repurposed buildings; GPU costs dominate

---

## 9. NVIDIA DGX Cloud

### DGX SuperPOD Reference Architecture (GB200)
- **Base unit:** Scalable Unit (SU) = 8 DGX GB200 systems
- **Each SU:** 1.2 MW Thermal Design Power (TDP)
- **Scalability:** Up to 128+ racks with 9,216 GPUs per SuperPOD
- **Deployment model:** On-premises or co-located; customer owns and manages hardware

### GB200 NVL72 Rack Specifications
- **Per rack:** 72 Blackwell GPUs + 36 Grace CPUs (Arm Neoverse V2)
- **Configuration:** 18x 1RU compute trays, each with 2 Grace CPUs + 4 Blackwell GPUs
- **Performance:** 1.4 exaflops of AI compute per rack
- **Power:** 120-140 kW per rack
- **NVLink bandwidth:** 130 TB/s total GPU communications
- **Memory:** HBM3e across all GPUs

### Liquid Cooling Specifications (Mandatory)
- **DLC-2 technology:** Captures 98% of heat via direct liquid cooling
- **Hybrid cooling:** Compute trays cooled by liquid (manifolds, cold plates on CPUs/GPUs); networking and storage devices are air cooled with fans
- **Closed-loop liquid circulation** through rack manifolds
- **Facility requirement:** Purpose-built liquid cooling infrastructure (CDUs, piping, heat rejection)
- **Upgrade cost:** Typical DC supporting 10 DGX H100 systems needs **$5-10M in upgrades** to support even one NVL72 (reinforced flooring, 480V power distribution, liquid cooling, expanded network)

### Facility Requirements
- **Minimum standard:** Uptime Institute Tier 3 (or TIA942-B Rated 3, or EN50600 Availability Class 3)
- **Requirements:** Concurrent maintainability, no single point of failure
- **Power per SU:** 1.2 MW
- **Minimum 3 power sources** (rPDUs from discrete upstream distribution paths) per rack
- **N+1 power minimum** (N=2 power sources, each sized for 50% of total peak load)
- **Flooring:** Must support high rack weights with liquid cooling infrastructure
- **480V power distribution** required

### Commissioning & Deployment Timeline
- **Lead time (order to delivery):** 6-9 months
- **Facility preparation (power + cooling upgrades):** 3-4 months
- **Installation and commissioning:** 2-3 weeks per system
- **Software optimization:** 2-3 months for full architecture exploitation
- **Total decision to full production:** 12-15 months

### Management Software
- **NVIDIA Mission Control:** Full-stack software for all DGX GB200 SuperPOD deployments
  - Full-stack resiliency
  - Predictive maintenance
  - Unified error reporting
  - Data center optimizations
  - Cluster health checks
  - Automated node management
  - Automated failure handling

### Support & Costs
- **NVIDIA Enterprise Support (NVEX):** Comprehensive service covering compute, storage, network, and software
- **Service contracts:** ~$300,000/year with 4-hour response time
- **Facility upgrade costs:** Often exceed the cost of the systems themselves

### Future Roadmap
- **GB300 NVL72 and Rubin platforms:** Forward-thinking operators provisioning 250-600 kW per rack
- **Liquid cooling adoption:** ~10% of AI chips used liquid cooling in late 2024; growing rapidly with Blackwell shipments (~60,000 racks projected through 2025)
- **Vera Rubin architecture:** Next-generation; expected late 2026

---

## 10. Equinix / Digital Realty / CyrusOne (Colocation)

### Equinix

#### Commissioning Standards
- **Standards maintained:** SSAE16, ISO 27001:2022, ISO 22301:2019, ISO 9001:2015, LEED, NIST, HIPAA, FISC, ASAE 3402 Type II
- **Scope:** Global provision, maintenance, and operations of 24x7 IBX data centers
- **Auditing:** Schellman Compliance LLC (annual surveillance audits)
- **Uptime:** >99.9999% (six nines)

#### Specifications
- **PUE:** 1.39 (2024); baseline 1.54 (2019); target 1.33 by 2030
- **Redundancy:** N+1 or greater across portfolio; backup generators for full DC load; battery UPS with 8-second generator switchover
- **Power density:** Standard 42U racks; high-density up to 100 kW; powered base options
- **Liquid cooling:** Direct liquid cooling retrofits; 30% efficiency gains reported; piloted in Silicon Valley
- **Renewable energy:** 250+ DCs covered by 100% renewable energy
- **Facilities:** 260 DCs in 33 countries across 5 continents
- **xScale program:** Pre-built hyperscale capacity; pre-secured power; reduced design/construction time
- **ASHRAE A1A standards:** Phased in since 2022; higher operating temperatures save cooling energy
- **ISO 50001** aligned operations

#### Construction Timeline
- **xScale pre-built:** Significantly reduced design and construction time
- **Standard colocation:** Less than 3 months for existing space; ~12 months for custom builds

### Digital Realty

#### Commissioning Standards
- **Compliance:** ISO 27001, SOC 1, SOC 2, PCI-DSS
- **PUE target:** 1.5 baseline (not publicly reported in detail)
- **Energy:** 6,904 GWh consumed in 2024; 30% from renewable sources
- **Deployment:** Better suited for larger organizations; does not offer rack-lease spacing

### CyrusOne

#### Commissioning Standards
- **Certifications:** ISO 27001, ISO 14001, ISO 45001, ISO 50001 (select facilities); SOC 1, SOC 2; PCI-DSS; HIPAA; TRUSTe
- **Environmental:** Comprehensive environmental management system covering sustainability, biodiversity, water conservation, circular economy
- **Power density:** 250 W/sq ft to 900 W/sq ft; both 2N and N power configurations
- **Flexibility:** Design architectures supporting flexible power requirements

### Multi-Tenant Commissioning Requirements
- All three providers require independent third-party audits for compliance maintenance
- **Key certifications baseline:**
  - SOC 1 and SOC 2 Type II (annual audits)
  - ISO 27001 (Information Security Management System)
  - PCI-DSS (for payment data handling tenants)
  - HIPAA (for healthcare tenants)
- **Physical security:** Multi-layered approach combining physical, cybersecurity, and operational controls
- **Commissioning process:** L1-L5 framework; emphasis on L5 IST before any tenant deployment
- **Tenant-specific commissioning:** Each cage/suite may require individual power and cooling verification

### Industry Compliance Matrix (All Three Providers)

| Standard | Equinix | Digital Realty | CyrusOne |
|----------|---------|---------------|----------|
| ISO 27001 | Yes | Yes | Yes |
| SOC 1 Type II | Yes | Yes | Yes |
| SOC 2 Type II | Yes | Yes | Yes |
| PCI-DSS | Yes | Yes | Yes |
| HIPAA | Yes | Yes | Yes |
| ISO 14001 | Select | N/A | Select |
| ISO 50001 | Yes | N/A | Select |
| LEED | Select | N/A | N/A |
| SSAE16/18 | Yes | Yes | Yes |

### Construction Costs (Colocation Benchmark)
- Industry average: $10-12M/MW
- Colocation providers can achieve lower per-MW costs through multi-tenant efficiency
- Equinix xScale: Pre-built capacity shifts CAPEX to predictable OPEX for tenants

---

## 11. Comparative Summary Table

### RFS Timeline (Construction Start to Operational)

| Company | Typical RFS Timeline | Fastest Achieved | Notes |
|---------|---------------------|-----------------|-------|
| Google | 18-24 months (construction); 36+ total | N/A | Pre-construction adds 12-18 months |
| Microsoft | 6 months - 3 years | Improving via Compass | Modular 48 MW buildings |
| AWS | 18-24 months standard | 13 months (Rainier Phase 1) | 4 GCs, 4,000+ workers |
| Meta | 24-36 months | N/A | Phased delivery; first zones earlier |
| Oracle | 12-24 months (leased) | "Several months" (SuperCluster) | Primarily leases, doesn't self-build |
| Apple | Multi-year (2-8 years total) | N/A | Significant delays common |
| OpenAI/Stargate | 15 months (Phase 1) | 15 months (Abilene) | Crusoe/Oracle partnership |
| xAI | 122 days (Phase 1) | 122 days (100K GPU) | Repurposed industrial building |
| NVIDIA DGX | 12-15 months (decision to production) | N/A | Includes 6-9 month lead time |
| Equinix | <3 months (existing); 12 months (custom) | <3 months | xScale pre-built |

### PUE Targets

| Company | Global Average PUE | Best Site PUE | Target PUE |
|---------|-------------------|--------------|------------|
| Google | 1.09 | 1.04 (Ohio) | 1.08 (GPU-optimized) |
| Microsoft | 1.16-1.18 | 1.11 (Wyoming) | 1.08 (Fairwater) |
| AWS | 1.15 | 1.04 (Europe) | 1.08 (new components) |
| Meta | 1.08-1.09 | 1.07 (Prineville) | <1.10 |
| Oracle | Not disclosed | N/A | 1.1-1.2 (partners) |
| Apple | Not disclosed | N/A | N/A (focuses on renewable %) |
| OpenAI/Stargate | Not disclosed | N/A | ~1.1-1.2 (estimated) |
| xAI | 1.18 | 1.18 | 1.10 (target) |
| Equinix | 1.39 | N/A | 1.33 by 2030 |
| Digital Realty | ~1.5 | N/A | 1.5 baseline |

### Power Density (kW per Rack)

| Company | Traditional | AI/GPU Racks | Future Target |
|---------|------------|-------------|--------------|
| Google | Not disclosed | 100+ kW (TPU pods) | 500+ kW; 1 MW per rack |
| Microsoft | <20 kW | 136-140 kW (GB300 NVL72) | Higher with Fairwater |
| AWS | 5-10 kW | 100+ kW (Trainium2/GB200) | 6x increase, then 3x more |
| Meta | 10-20 kW | 92+ kW (HPR) | 100+ kW via OCP |
| Oracle | Varies | 100-150 kW (Stargate) | 120+ kW |
| Apple | Not disclosed | Not disclosed | Custom silicon efficiency focus |
| OpenAI/Stargate | N/A | 100-150 kW (GB200) | 120-140 kW |
| xAI | N/A | 64 GPU/rack (H100/H200); 72 GPU/rack (GB200) | Higher density planned |
| NVIDIA DGX | N/A | 120-140 kW (GB200 NVL72) | 250-600 kW (GB300/Rubin) |
| Equinix | 7-10 kW | Up to 100 kW | Liquid cooling retrofits |

### Redundancy Requirements

| Company | Standard Configuration | Notes |
|---------|----------------------|-------|
| Google | N+1 (CDUs); transitioning power architectures | 99.999% CDU availability |
| Microsoft | 2N (standard); N+1 "Catcher"; 4N3R; Fairwater = grid-reliant | Multiple configurations per site |
| AWS | Tier III/IV; multi-AZ isolation | Redundant metro fiber between AZs |
| Meta | OCP-based; N+1 or 2N per design | 48 VDC per-rack battery backup |
| Oracle | Varies by facility/partner | Isolated availability domains |
| Apple | Not disclosed | Likely Tier III+ equivalent |
| OpenAI/Stargate | On-site gas turbines + battery + solar + grid | 360 MW gas, 1 GW/4 GWh battery |
| xAI | On-site gas turbines + grid | Solaris 600 MW fleet; 400 MW serving xAI |
| NVIDIA DGX | Tier 3 minimum; N+1 power; 3 power sources per rack | Mandatory for SuperPOD deployment |
| Equinix | N+1 or greater; backup generators | >99.9999% uptime |

### Cooling Type Preferences

| Company | Primary Cooling | Secondary | Notes |
|---------|---------------|-----------|-------|
| Google | Liquid (DLC) | Advanced air (water-stressed regions) | 50% fleet liquid-cooled; Project Deschutes CDU |
| Microsoft | Liquid (Fairwater HXU) | Air (legacy) | Zero-water design since Aug 2024 |
| AWS | Liquid (IRHX) + Air hybrid | Evaporative (legacy) | Custom CDU built in 11 months |
| Meta | Liquid (DLC) + Chilled water | Evaporative | OCP HPR ecosystem |
| Oracle | Liquid (DLC) | Dry coolers; waterless (partners) | Zero water wastage closed-loop |
| Apple | Outside air + Water-free | Evaporative (legacy) | Waste heat recapture (Denmark) |
| OpenAI/Stargate | Liquid (DLC closed-loop) | Air (legacy areas) | Zero-water-evaporation design |
| xAI | Liquid (Supermicro custom CDU) | Air-cooled chillers | 119 chillers for 200 MW cooling |
| NVIDIA DGX | Liquid (DLC-2, mandatory for GB200) | Air (networking/storage) | 98% heat capture via DLC |
| Equinix | Air (standard) | Liquid (retrofits) | 30% efficiency gains with DLC |

### Construction Costs per MW

| Company | Infrastructure Only | Fully Loaded (with IT) | Notes |
|---------|-------------------|----------------------|-------|
| Google | $7-12M/MW (est.) | $15-20M+/MW (AI) | Not publicly disclosed |
| Microsoft | $10-14M/MW | $20M+/MW (AI) | Industry benchmark |
| AWS | ~$5M/MW (Rainier shell) | $15-20M+/MW | $11B for 2.2 GW planned |
| Meta | ~$7-8M/MW | Lower via OCP (24% savings) | OCP reduces infrastructure cost |
| Oracle | ~$5.5M/MW (Abilene shell) | ~$12.5-16.5M/MW | Primarily leases; Stargate different |
| Apple | Not disclosed | Not disclosed | $10B over 5 years US investment |
| OpenAI/Stargate | ~$5.5M/MW | ~$12.5-16.5M/MW | $12-15B for 1.2 GW Abilene |
| xAI | Below average (repurposed) | GPU costs dominate (~$18B) | Building permits $659M |
| NVIDIA DGX | N/A (hardware vendor) | $5-10M to upgrade existing DC for 1 NVL72 | Facility upgrades often exceed system cost |
| Equinix | $10-12M/MW | Tenant-supplied IT | xScale CAPEX to OPEX model |

### Sustainability Requirements Affecting Commissioning

| Company | Key Sustainability Requirement | Impact on Commissioning |
|---------|-------------------------------|------------------------|
| Google | 24/7 CFE; water-free in water-stressed areas | Must verify renewable energy integration, water-free cooling systems |
| Microsoft | Carbon negative 2030; water positive 2030; diesel-free 2030 | Must verify zero-water cooling, renewable integration, no diesel generators |
| AWS | Water positive 2030; custom silicon efficiency | Must verify liquid cooling, custom chip thermal performance |
| Meta | Net zero 2030; water positive 2030; LEED Gold+ | Must verify LEED compliance, renewable energy, low-carbon concrete |
| Oracle | 100% renewable by 2025 | Must verify renewable energy procurement, zero-water cooling |
| Apple | 100% renewable from Day 1; LEED Platinum | Must verify renewable systems operational before DC goes live |
| OpenAI/Stargate | Zero-water-evaporation cooling | Must verify closed-loop cooling, on-site generation, battery storage |
| xAI | Graywater recycling (planned) | Cooling water monitoring, aquifer impact mitigation |
| NVIDIA | N/A (hardware vendor) | DLC-2 liquid cooling commissioning mandatory for GB200+ |
| Equinix | 100% renewable (250+ sites); ISO 50001 | Energy management system verification, renewable energy matching |

### Staffing Requirements for Commissioning

| Company | Commissioning Staff | Operational Staff | Notes |
|---------|-------------------|------------------|-------|
| Google | Not disclosed | Fewer per MW (AI automation) | DeepMind reduces human intervention |
| Microsoft | Not disclosed | Per 48 MW building module | Compass tool streamlines coordination |
| AWS | 4,000+ peak construction (Rainier) | 1,000+ permanent (Rainier) | 4 GCs simultaneously |
| Meta | 50-200+ (industry benchmark) | Prequalified trade partners | Template-based approach |
| Oracle | Not disclosed | Varies by partner | Primarily lease model |
| Apple | Not disclosed | 550+ per major campus | Internal teams |
| OpenAI/Stargate | 6,400+ construction workers (Abilene) | ~30 per building (technical) | Massive construction workforce |
| xAI | Not disclosed (compressed) | 320-500 in Memphis | Dell + Supermicro partner staff |
| NVIDIA | 2-3 weeks install per system | NVEX support contracts ($300K/yr) | Customer-managed; NVIDIA support |
| Equinix | Industry standard Cx teams | 20-50 FTEs per 12 MW | Hybrid model: core + contract + consultants |

---

## 12. Sources

### Google
- [Google Data Centers - Power Usage Effectiveness](https://datacenters.google/efficiency/)
- [Google Operating Sustainably](https://datacenters.google/operating-sustainably/)
- [DeepMind AI Reduces Google Data Centre Cooling Bill by 40%](https://deepmind.google/discover/blog/deepmind-ai-reduces-google-data-centre-cooling-bill-by-40/)
- [Google - Climate-Conscious Data Center Cooling](https://blog.google/outreach-initiatives/sustainability/our-commitment-to-climate-conscious-data-center-cooling/)
- [Google Cloud Blog - Enabling 1 MW IT Racks and Liquid Cooling](https://cloud.google.com/blog/topics/systems/enabling-1-mw-it-racks-and-liquid-cooling-at-ocp-emea-summit)
- [Google Data Center Sustainability](https://sustainability.google/progress/projects/machine-learning/)
- [Liquid Cooling 2025: Google's $40B AI Power Play - EnkiAI](https://enkiai.com/data-center/liquid-cooling-2025-googles-40b-ai-power-play)
- [Nidec Develops Prototype CDU for Google OCP Spec](https://www.nidec.com/en/product/news/2025/news1203-01/)
- [Google's New Data Center Model - Latitude Media](https://www.latitudemedia.com/news/googles-new-data-center-model-signals-a-massive-market-shift/)
- [The Register - Google Details 1 MW IT Rack Plans](https://www.theregister.com/2025/05/01/google_details_plans_for_1/)

### Microsoft
- [Microsoft Inside Track - Compass Tool](https://www.microsoft.com/insidetrack/blog/datacenter-construction-at-microsoft-transforms-thanks-to-compass/)
- [Microsoft Carbon Negative by 2030](https://blogs.microsoft.com/blog/2020/01/16/microsoft-will-be-carbon-negative-by-2030/)
- [Microsoft Sustainability - Data Centers](https://datacenters.microsoft.com/sustainability/)
- [Microsoft Measuring Efficiency](https://datacenters.microsoft.com/sustainability/efficiency/)
- [Microsoft Zero-Water Cooling Design](https://www.microsoft.com/en-us/microsoft-cloud/blog/2024/12/09/sustainable-by-design-next-generation-datacenters-consume-zero-water-for-cooling/)
- [Microsoft Azure Efficiency Improvements](https://azure.microsoft.com/en-us/blog/sharing-the-latest-improvements-to-efficiency-in-microsoft-s-datacenters/)
- [Three Mile Island Nuclear PPA - DCD](https://www.datacenterdynamics.com/en/news/three-mile-island-nuclear-power-plant-to-return-as-microsoft-signs-20-year-835mw-ai-data-center-ppa/)
- [Microsoft Infinite Scale Architecture](https://blogs.microsoft.com/blog/2025/11/12/infinite-scale-the-architecture-behind-the-azure-ai-superfactory/)
- [Microsoft and Meta Open AI Rack Design - DCD](https://www.datacenterdynamics.com/en/news/microsoft-and-meta-reveal-open-ai-rack-design-with-separate-power-and-compute-cabinets/)
- [Azure PUE Data - Baxtel](https://baxtel.com/news/microsoft-shares-data-center-pue-and-wue-data-for-the-first-time)

### AWS
- [AWS Operational Readiness Reviews](https://docs.aws.amazon.com/wellarchitected/latest/operational-readiness-reviews/wa-operational-readiness-reviews.html)
- [AWS Well-Architected Framework - ORR](https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_ready_to_support_const_orr.html)
- [AWS Sustainability - Data Centers](https://aws.amazon.com/sustainability/data-centers/)
- [AWS Liquid Cooling for AI Servers - TechCrunch](https://techcrunch.com/2024/12/02/aws-bets-on-liquid-cooling-for-its-ai-servers/)
- [AWS 6X Density Increase - DCF](https://www.datacenterfrontier.com/design/article/55247074/aws-unveils-ai-data-center-designs-supporting-6x-increase-in-density)
- [AWS Custom Liquid Cooling in 11 Months - DCM](https://datacentremagazine.com/technology-and-ai/aws-builds-custom-liquid-cooling-in-11-months-for-ai-chips)
- [AWS Global PUE 1.15 in 2023 - DCD](https://www.datacenterdynamics.com/en/news/aws-global-data-centers-achieved-pue-of-115-in-2023/)
- [Project Rainier $11B Indiana - CNBC](https://www.cnbc.com/2025/10/29/amazon-opens-11-billion-ai-data-center-project-rainier-in-indiana.html)
- [AWS Accelerates Indiana Build - Aterio](https://www.aterio.io/blog/from-2023-to-2026-aws-accelerates-indiana-s-largest-data-center-build)
- [AWS Activates Rainier - DCD](https://www.datacenterdynamics.com/en/news/aws-activates-project-rainier-cluster-of-nearly-500000-trainium2-chips/)
- [Amazon $15B Northern Indiana - About Amazon](https://www.aboutamazon.com/news/company-news/amazon-15-billion-indiana-data-centers)

### Meta
- [Facebook Launches Open Compute Project](https://about.fb.com/news/2011/04/facebook-launches-open-compute-project/)
- [Meta Data Centers Sustainability](https://sustainability.atmeta.com/data-centers/)
- [OCP - Building Efficient Data Centers](https://engineering.fb.com/2011/04/07/data-center-engineering/building-efficient-data-centers-with-the-open-compute-project/)
- [Open Compute Project - Wikipedia](https://en.wikipedia.org/wiki/Open_Compute_Project)
- [Meta Engineering - Data Center Engineering](https://engineering.fb.com/category/data-center-engineering/)
- [Meta Richland Parish DC Timeline - StruxHub](https://struxhub.com/blog/what-is-the-construction-timeline-for-the-meta-richland-parish-louisiana-ai-data-center-project/)

### Oracle
- [OpenAI, Oracle, SoftBank Expand Stargate](https://openai.com/index/five-new-stargate-sites/)
- [Oracle Distributed Cloud Services](https://www.oracle.com/cloud/distributed-cloud/)
- [Oracle First Principles DC Innovations](https://blogs.oracle.com/cloud-infrastructure/first-principles-data-center-innovations)
- [Oracle Green Cloud](https://www.oracle.com/sustainability/green-cloud/)
- [Oracle 400MW in Latest Quarter - DCD](https://www.datacenterdynamics.com/en/news/oracle-stood-up-400mw-of-data-center-capacity-in-latest-quarter-has-secured-10gw-of-power-for-the-next-three-years/)
- [Stargate Advances with Oracle 4.5 GW - OpenAI](https://openai.com/index/stargate-advances-with-partnership-with-oracle/)

### Apple
- [Apple 100% Renewable Energy](https://www.apple.com/newsroom/2018/04/apple-now-globally-powered-by-100-percent-renewable-energy/)
- [Apple Carbon Neutral 2030](https://www.apple.com/newsroom/2020/07/apple-commits-to-be-100-percent-carbon-neutral-for-its-supply-chain-and-products-by-2030/)
- [Apple Data Centres - DCM](https://datacentremagazine.com/hyperscale/apple-data-centres-fuelling-a-sustainable-revolution)
- [Apple DC Locations - Dgtl Infra](https://dgtlinfra.com/apple-data-center-locations/)
- [Apple $10B US DC Construction - DCK](https://www.datacenterknowledge.com/apple/apple-spend-10b-us-data-center-construction-over-five-years)
- [Apple Iowa Data Center - DCD](https://www.datacenterdynamics.com/en/news/apple-launches-data-center-in-waukee-iowa/)

### OpenAI / Stargate
- [Stargate LLC - Wikipedia](https://en.wikipedia.org/wiki/Stargate_LLC)
- [OpenAI Stargate Infrastructure Guide - IntuitionLabs](https://intuitionlabs.ai/articles/openai-stargate-datacenter-details)
- [Stargate First DC Open in Texas - CNBC](https://www.cnbc.com/2025/09/23/openai-first-data-center-in-500-billion-stargate-project-up-in-texas.html)
- [Crusoe Abilene DC Live](https://www.crusoe.ai/resources/newsroom/crusoe-announces-flagship-abilene-data-center-is-live)
- [Stargate Abilene Lessons - Site Selection Group](https://info.siteselectiongroup.com/blog/stargate-and-the-new-ai-data-center-playbook-abilene-lessons)
- [Scaling Stargate - DCF](https://www.datacenterfrontier.com/machine-learning/article/55319132/scaling-stargate-openais-five-new-us-data-centers-push-toward-10-gw-ai-infrastructure)
- [Stargate Project - Glenn Klockwood](https://www.glennklockwood.com/garden/Stargate)

### xAI
- [xAI Memphis Colossus - Introl](https://introl.com/blog/xai-memphis-colossus-100000-gpu-supercomputer-infrastructure)
- [xAI Colossus 2 GW Expansion - Introl](https://introl.com/blog/xai-colossus-2-gigawatt-expansion-555k-gpus-january-2026)
- [How xAI Built Colossus - RD World Online](https://www.rdworldonline.com/how-xai-turned-a-factory-shell-into-an-ai-colossus-to-power-grok-3-and-beyond/)
- [Colossus Wikipedia](https://en.wikipedia.org/wiki/Colossus_(supercomputer))
- [xAI Colossus 2 - SemiAnalysis](https://newsletter.semianalysis.com/p/xais-colossus-2-first-gigawatt-datacenter)
- [Colossus xAI Official](https://x.ai/colossus)
- [xAI Memphis Power - Greater Memphis Chamber](https://memphischamber.com/economic-development/xai/)

### NVIDIA
- [DGX SuperPOD Architecture - GB200](https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-gb200/latest/dgx-superpod-architecture.html)
- [NVIDIA HGX Data Center Requirements - IntuitionLabs](https://intuitionlabs.ai/articles/nvidia-hgx-data-center-requirements)
- [DGX GB200 Datasheet](https://resources.nvidia.com/en-us-dgx-systems/dgx-superpod-gb200-datasheet)
- [GB200 NVL72 Deployment - Introl](https://introl.com/blog/gb200-nvl72-deployment-72-gpu-liquid-cooled)
- [DGX SuperPOD Components](https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-gb200/latest/dgx-superpod-components.html)

### Colocation Providers
- [Equinix Standards & Compliance](https://www.equinix.com/data-centers/design/standards-compliance)
- [Digital Realty Certifications](https://www.digitalrealty.com/data-centers/design/certifications-compliance)
- [CyrusOne Compliance](https://www.cyrusone.com/commitments/compliance)
- [Equinix Data Center Excellence](https://www.equinix.com/data-centers/data-center-excellence)
- [Equinix Sustainability](https://sustainability.equinix.com/environment/operational-sustainability/)
- [Equinix xScale](https://www.equinix.com/data-centers/hyperscale-data-centers)

### Industry & Commissioning
- [Data Center Commissioning Checklist - ConstructAndCommission](https://constructandcommission.com/data-center-commissioning-checklist/)
- [5 Levels of Commissioning - ConstructAndCommission](https://constructandcommission.com/5-levels-of-commissioning-explained-data-center/)
- [Guide to Data Center Commissioning - Bluerithm](https://bluerithm.com/guide-to-data-center-commissioning/)
- [Commissioning Critical Systems in Hyperscale - Techsite](https://techsiteplan.com/commissioning-critical-systems-in-hyperscale-data-centers/)
- [Data Center Construction Costs 2025 - Cushman & Wakefield](https://www.cushmanwakefield.com/en/united-states/insights/data-center-development-cost-guide)
- [Hyperscaler Construction $6M/MW - DCD](https://www.datacenterdynamics.com/en/news/building-scale-hyperscalers-aim-build-6m-mw/)
- [Data Center Staffing Levels - Broadstaff](https://broadstaffglobal.com/data-center-staffing-levels-how-many-people-does-a-facility-need)
- [Commissioning Staffing Bottleneck - Broadstaff](https://broadstaffglobal.com/data-center-commissioning-bottleneck)
- [Cloud PUE Comparison - The New Stack](https://thenewstack.io/cloud-pue-comparing-aws-azure-and-gcp-global-regions/)
- [Data Center Cooling State of Play 2025 - Tom's Hardware](https://www.tomshardware.com/pc-components/cooling/the-data-center-cooling-state-of-play-2025-liquid-cooling-is-on-the-rise-thermal-density-demands-skyrocket-in-ai-data-centers-and-tsmc-leads-with-direct-to-silicon-solutions)
- [Robust IST for New Data Center - Aggreko](https://www.aggreko.com/en-us/case-studies/data-centres/robust-ist-for-new-data-centre)
- [Data Center Commissioning - Aggreko](https://www.aggreko.com/en-us/sectors/data-centres/data-centre-commissioning)
