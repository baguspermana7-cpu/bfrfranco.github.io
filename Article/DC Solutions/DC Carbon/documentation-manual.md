# DC Carbon Footprint Calculator -- User Guide

## Table of Contents

1. Getting Started
2. Three Tabs Overview
3. Tab 1: Operational Emissions
4. Tab 2: Life-Cycle Assessment
5. Tab 3: Carbon Budget
6. Results Panel
7. Pro Features
8. PDF Export
9. Frequently Asked Questions

---

## 1. Getting Started

The DC Carbon Footprint Calculator estimates the total greenhouse gas emissions from a data center across three dimensions: operational emissions (GHG Protocol Scope 1/2/3), embodied carbon (EN 15978 life-cycle assessment), and national carbon budget alignment (Paris Agreement).

To begin:
- Open https://resistancezero.com/carbon-footprint.html
- The calculator loads in Free mode with default values for a 1 MW colocation facility in the United States
- Modify inputs on the left panel; results update automatically on the right panel
- Switch between the three tabs (Operational, Life-Cycle, Carbon Budget) using the tab bar at the top
- Use preset buttons for quick configuration of common scenarios (Edge, Enterprise, Colo, Hyperscale, Mega)

### Free vs Pro Mode

- Free mode provides the core calculation engine across all three tabs, including Scope 1/2/3 breakdown, life-cycle totals, carbon budget analysis, charts, and recommendations
- Pro mode adds Monte Carlo simulation, sensitivity tornado analysis, reduction scenarios, financial compliance assessment, executive narrative, and PDF export
- To access Pro, click "Pro Analysis" in the toolbar and log in (demo credentials are available on the login screen)

---

## 2. Three Tabs Overview

### Operational Tab
Calculates annual carbon emissions from data center operations: electricity consumption, diesel generator combustion, and refrigerant leakage. Covers GHG Protocol Scope 1, 2, and 3.

### Life-Cycle Tab
Estimates embodied carbon across the full building and equipment life cycle following the EN 15978 standard (modules A1 through D). Covers construction materials, MEP equipment, IT hardware, transport, and end-of-life recycling.

### Carbon Budget Tab
Allocates a share of the national carbon budget to your facility based on the country's Paris Agreement NDC targets, data center sector electricity share, growth projections, and workload mix.

---

## 3. Tab 1: Operational Emissions

### Section: Facility Profile

**IT Load (kW)**
Total IT power draw at the rack level. Includes servers, storage, and networking. Presets:
- 100 kW (Edge)
- 500 kW (Enterprise)
- 1,000 kW / 1 MW (Colocation) -- default
- 5,000 kW / 5 MW (Hyperscale)
- 10,000 kW / 10 MW (Mega)

**PUE (Power Usage Effectiveness)**
Ratio of total facility power to IT power. A PUE of 1.58 (the global average) means 58% of energy goes to cooling, lighting, and other overhead. Presets range from 1.2 (best-in-class) to 2.0 (poor legacy).

### Section: Location and Grid

**Country**
Select from 33 countries organized by region (APAC, EMEA, Americas, MENA, Africa, LATAM). The selection auto-populates grid carbon intensity and electricity rate.

**Grid Carbon Intensity (kgCO2/kWh)**
The carbon dioxide equivalent emitted per kilowatt-hour of grid electricity. Auto-populated from country selection. Read-only. Ranges from 0.04 (Sweden) to 0.90 (South Africa).

**Electricity Rate ($/kWh)**
Industrial electricity price for the selected country. Auto-populated. Read-only.

### Section: Cooling System

**Cooling Type**
Select from four options, each with a different refrigerant:
- Air / CRAC: R-410A (GWP 2,088)
- In-Row: R-410A (GWP 2,088)
- RDHX: R-134a (GWP 1,430)
- Direct Liquid: R-1234ze (GWP 675)

**Refrigerant GWP, Charge Rate, and Leak Rate**
GWP and charge rate auto-populate based on cooling type. Leak rate is adjustable (1-15%). Industry average for DX systems is 5-10%.

### Section: Backup Power

**Generator Type**
- Diesel: 2.68 kgCO2/L emission factor
- HVO Biodiesel: 0.54 kgCO2/L (80% lower emissions)

**Annual Generator Test Hours**
Slider from 50 to 500 hours. Default 200 hours covers monthly testing and unplanned outages.

### Section: Renewable Energy

**Renewable Strategy**
- None
- On-site Solar PV
- Solar + BESS (battery storage)
- 100% PPA (Green Tariff)

**Renewable Coverage**
Slider from 0% to 100%. At 100%, all grid electricity is matched with renewables, reducing Scope 2 market-based emissions to zero.

---

## 4. Tab 2: Life-Cycle Assessment

### Section: Building and Construction

**Facility Size (MW IT)**
Linked to IT Load from the Operational tab. Determines structural material quantities.

**Building Type**
- Purpose-built (1.0x material multiplier)
- Converted warehouse (0.7x -- reuses existing structure)
- Modular / prefab (0.85x)

**Concrete Grade**
- C30 standard: 150 kgCO2e/ton
- C40 high-strength: 250 kgCO2e/ton
- Low-carbon 50% GGBS: 100 kgCO2e/ton

**Steel Sourcing**
- World average 30% recycled: 1,850 kgCO2e/ton
- EAF recycled 90%+: 500 kgCO2e/ton
- Virgin BOF: 2,200 kgCO2e/ton

**Seismic Zone**
Zones 0 through 4. Higher zones increase steel and concrete quantities by 5-40% due to additional structural reinforcement.

### Section: MEP Equipment

**UPS Type**
- Modular (lighter, right-sized)
- Standalone double-conversion (heavier per kW)

**Battery Type**
- VRLA Lead-Acid: 68 kgCO2e/kWh, 5-year life
- Li-ion LFP: 62 kgCO2e/kWh, 10-year life
- Li-ion NMC: 74 kgCO2e/kWh, higher density

**Battery Runtime**
5, 10, 15, or 30 minutes of IT load support.

**Redundancy**
N, N+1, 2N, or 2N+1. Higher redundancy multiplies equipment quantities.

### Section: IT Equipment

**Workload Type**
- Traditional Enterprise: 1,200 kgCO2e/server, ~1,250 servers/MW
- Cloud / Hyperscale: 1,200 kgCO2e/server, ~1,000 servers/MW
- AI / GPU H100: 4,000 kgCO2e/server, ~140 servers/MW
- AI / GPU B200+: 3,500 kgCO2e/server, ~200 servers/MW

**Server Refresh Cycle**
3 to 7 years. Shorter cycles increase total embodied carbon over the project lifetime.

**Network Refresh Cycle**
4 to 8 years.

**Project Lifetime**
15 to 30 years. Determines how many refresh cycles occur and amortizes building embodied carbon.

### Section: Transport and Construction

**Equipment Origin**
- Local (<500 km)
- Regional (500-2,000 km)
- International (>5,000 km)

**Transport Mode**
- Truck only
- Truck + Ship (lowest per-ton-km emissions)
- Truck + Air (highest -- ~50x more than sea freight)

**Construction Duration**
12, 18, 24, or 36 months. Longer builds mean more on-site diesel, worker transport, and temporary facility energy.

### Section: End-of-Life

**Decommission Plan**
- Full demolition (highest end-of-life carbon)
- Partial refit (preserves shell)
- Building reuse (retains entire structure, earns Module D credits)

**E-waste Program**
- Standard recycling: 80% material recovery
- Advanced recovery: 90% with precious metal extraction
- Circular program: 95% through refurbishment and component reuse

**Steel Recycling Rate**
80-98% (default 92%). Determines Module D credit for avoided virgin steel production.

**Copper Recycling Rate**
80-95% (default 85%). Copper recycling saves approximately 4 kgCO2e per kg compared to virgin production.

---

## 5. Tab 3: Carbon Budget

### Section: Country NDC Profile

**Country**
Mirrors the country selected in the Operational tab. Auto-populates NDC data.

**NDC Target Year**
The year by which the country pledges to achieve its reduction target (typically 2030).

**NDC Reduction Target**
The pledged percentage reduction from a baseline year. Examples:
- US: 50-52% below 2005 levels by 2030
- EU: 55% below 1990 levels by 2030
- UK: 68% below 1990 levels by 2030

**Current Total Emissions (MtCO2)**
The country's total annual greenhouse gas emissions in megatons.

**DC Sector Share**
Percentage of national electricity consumed by data centers. Adjustable from 0.5% to 10%. Examples: Ireland ~18%, Singapore ~7%, US ~3.5%.

**DC Sector Growth Rate**
Projected annual capacity growth. 15% default. AI-driven demand is pushing rates to 15-30% in major markets.

### Section: Carbon Budget Parameters

**Budget Period**
Assessment timeframe: 2025-2030, 2025-2035, 2025-2040, or 2025-2050.

**Budget Methodology**
How the carbon budget is distributed over time:
- Linear decline: even annual reduction
- Front-loaded: steeper initial cuts (more ambitious)
- Back-loaded: higher near-term emissions, rapid reduction later

**Cumulative DC Budget (MtCO2)**
Auto-calculated. Total CO2 allowed for the DC sector in this country over the budget period.

**Annual Budget per MW (tCO2/MW/yr)**
Auto-calculated. Your facility's fair share. If your actual emissions exceed this, you are consuming more than your proportional allocation.

### Section: Workload Allocation

Five workload categories that must sum to 100%:
- AI Training (default 15%)
- AI Inference (default 20%)
- Cloud SaaS/IaaS (default 30%)
- Enterprise IT (default 20%)
- Government / Critical (default 15%)

Different workloads have different carbon intensity and economic value per MWh. The total allocation bar shows whether sliders sum to 100%.

### Section: Procurement Targets

**Current Renewable %**
Baseline renewable energy procurement percentage.

**Target Year Net-Zero**
Year by which your facility aims to achieve net-zero: 2030, 2035, 2040, or 2050.

**Carbon Credit Strategy**
- None
- Voluntary offsets (e.g., Verra VCS)
- Compliance credits (e.g., EU ETS allowances)
- Both

---

## 6. Results Panel

The results panel (right side of the calculator) updates in real time as you change inputs. It displays different metrics depending on the active tab.

### Operational Tab Results

- Total Annual Emissions (tCO2e/yr): Main headline figure
- Scope 1: Direct emissions (generators + refrigerant)
- Scope 2: Purchased electricity emissions (adjusted for renewables)
- Scope 3: Supply chain and embodied carbon estimate
- kgCO2/kWh IT: Carbon intensity per unit of IT energy
- Offset Cost: Annual cost to offset all emissions at $25/tCO2
- Carbon Tax: EU ETS exposure at $50/tCO2
- Annual MWh: Total facility energy consumption
- Efficiency Rating: Performance grade based on carbon intensity

### Charts

- Emissions Breakdown: Doughnut chart showing Scope 1/2/3 proportions
- Industry Comparison: Bar chart comparing your facility against industry average and best practice

### Life-Cycle Tab Results

Results switch to show embodied carbon metrics:
- Total Embodied Carbon (tCO2e over project lifetime)
- EN 15978 phase breakdown (A1-A3 Materials, B1-B7 Equipment, A4-A5 Construction, C1-C4 End-of-Life, D Recycling Credits)
- Phase comparison bar chart

### Carbon Budget Tab Results

Results switch to show budget alignment metrics:
- Cumulative sector carbon budget
- Annual budget per MW
- Your facility's emissions vs budget allocation
- Renewable procurement timeline chart

---

## 7. Pro Features

Pro mode unlocks four additional analysis panels below the main calculator:

### Monte Carlo Risk Distribution
Runs 10,000 iterations with randomized variation in PUE, grid intensity, and generator run hours. Outputs:
- P5 (best case, 5th percentile)
- P50 (median case, 50th percentile)
- P95 (worst case, 95th percentile)
- Standard deviation
- Histogram chart showing the full distribution

### Sensitivity Tornado
Identifies which input variables cause the greatest change in total emissions when varied by plus/minus 20%. Variables analyzed:
- PUE
- Grid Intensity
- IT Load
- Generator Hours
- Renewable %
- Leak Rate

Displayed as a horizontal bar chart sorted by impact magnitude.

### Reduction Scenarios
Models the cumulative impact of five sequential decarbonization strategies:
1. Current State (baseline)
2. Add Solar PV (30% of Scope 2)
3. Add Liquid Cooling (8% total reduction)
4. Add 100% PPA (95% of Scope 2)
5. Add Low-carbon Materials (5% total reduction)

### Financial Impact and Compliance
- Offset Cost/yr: At current voluntary market prices
- EU ETS Exposure: Carbon tax liability at $50/tCO2
- CBAM Risk: High/Medium/Low based on carbon intensity
- SEC/CSRD Gap: Regulatory disclosure readiness assessment

### Executive Narrative
Auto-generated text summarizing your carbon profile, financial exposure, life-cycle context, and priority recommendations.

---

## 8. PDF Export

Available in Pro mode only. Click the "Export PDF" button in the toolbar.

The PDF includes:
- Branded header with generation date
- Total emissions score with efficiency rating
- Scope 1/2/3 KPI grid
- Configuration summary table
- SVG emissions breakdown chart (donut)
- SVG industry comparison chart (bar)
- Life-cycle assessment summary (if Life-Cycle tab data entered)
- Executive narrative
- Methodology statement with all data sources
- Footer with privacy notice

The PDF is generated entirely in the browser using a print window. No data is sent to any server. Use Ctrl+P / Cmd+P in the print window to save as PDF.

---

## 9. Frequently Asked Questions

**What data sources are used for grid emission factors?**
Grid carbon intensity values are derived from the IEA World Energy Outlook (2024 edition). Values represent national average grid emission factors and may differ from regional or utility-specific factors.

**How are Scope 3 emissions calculated?**
Scope 3 includes embodied carbon from IT equipment manufacturing (server count multiplied by per-server embodied carbon) and a proportional allocation of building material emissions. Full Scope 3 breakdown is available in the Life-Cycle tab.

**What is the difference between location-based and market-based Scope 2?**
The calculator uses market-based Scope 2 accounting. When you set renewable coverage above 0%, it reduces Scope 2 proportionally, reflecting actual procurement of renewable energy through PPAs, RECs, or on-site generation. Location-based Scope 2 would use the grid emission factor regardless of renewable procurement.

**How does the Monte Carlo simulation work?**
The simulation runs 10,000 iterations where PUE, grid intensity, and generator utilization are each randomly varied (PUE: 0.9-1.1x, grid: 0.85-1.15x, generators: 0.7-1.3x of base values). Results are sorted to extract P5, P50, and P95 percentiles and standard deviation.

**What is the carbon budget methodology?**
The national carbon budget is calculated from the country's total emissions, its NDC reduction target, the data center sector's share of electricity consumption, and projected sector growth. The budget can be distributed over time using linear, front-loaded, or back-loaded pathways. The per-MW allocation divides the sector budget by total installed capacity.

**Is my data stored or transmitted?**
No. All calculations run client-side in your browser using JavaScript. No input data, results, or configuration is sent to any server. PDF generation also occurs locally in the browser.

**What does the efficiency rating mean?**
The rating grades your carbon intensity (kgCO2/kWh IT) against industry benchmarks. Lower intensity (below the industry average of 0.475 kgCO2/kWh) indicates cleaner operations. The rating considers PUE, grid carbon factor, and renewable energy procurement.

**Can I compare multiple scenarios?**
The Pro Reduction Scenarios panel models five sequential strategies. For manual scenario comparison, adjust the input parameters and note the results for each configuration. The PDF export captures a snapshot of any single configuration.

**What EN 15978 modules are covered?**
The calculator covers:
- A1-A3: Product stage (raw materials, transport to factory, manufacturing)
- A4-A5: Construction process stage (transport to site, construction)
- B1-B7: Use stage (IT equipment and battery replacements over project lifetime)
- C1-C4: End-of-life stage (demolition, transport, waste processing, disposal)
- D: Benefits beyond system boundary (recycling credits for steel, copper, aluminum)

**What countries are supported?**
33 countries across six regions:
- APAC: Indonesia, Singapore, Malaysia, Thailand, Vietnam, Philippines, India, China, Japan, South Korea, Australia, New Zealand, Taiwan
- EMEA: United Kingdom, Germany, Netherlands, Ireland, France, Sweden, Poland, Portugal
- Americas: United States
- MENA: UAE, Saudi Arabia, Qatar
- Africa: South Africa, Nigeria, Kenya
- LATAM: Brazil, Chile, Mexico, Colombia
