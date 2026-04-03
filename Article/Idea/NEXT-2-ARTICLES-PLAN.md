# Next 2 Articles — Production Plan

## Article 1: "PUE Is a Lie (Sort Of): Why the DC Industry's Favorite Metric Hides More Than It Reveals"

### Why This Article
- **#1 highest search volume gap** — "PUE explained" has massive search volume but NO article on resistancezero.com covers it
- **Viral 5/5** — contrarian title challenges industry dogma
- **Unique angle**: PUE gaming/manipulation + absolute waste paradox + tropical PUE disadvantage + EU EED mandatory reporting
- **Calculator pair**: PUE Estimator — the most natural calculator for the site

### Proposed Structure (10 Sections)
- sec0: Abstract — "Global average PUE stuck at 1.58 for a decade. But the number itself is broken."
- sec1: What PUE Actually Measures (and What It Doesn't)
- sec2: The Decade-Long Plateau — 1.58 and Going Nowhere (Uptime Institute data 2013-2023)
- sec3: PUE Gaming — How Operators Cheat the Number (measurement point manipulation, seasonal cherry-picking, Category 1 vs 3)
- sec4: The Absolute Waste Paradox — "Low PUE, High Waste" (PUE 1.1 at 200MW = 20MW overhead = 15,000 homes)
- sec5: Climate Zone Reality — Why Singapore Can Never Beat Sweden (tropical 1.4-1.8 vs Nordic 1.03-1.08)
- sec6: AI Changes Everything — GPU Racks Improve Ratio But Increase Absolute Consumption
- sec7: EU EED Article 12 — The Regulatory Forcing Function (mandatory public reporting, 10,000+ facilities)
- sec8: Beyond PUE — WUE, CUE, ERE and the Dashboard Future
- sec9: Interactive PUE Calculator (CTA)

### Calculator: PUE Estimator
**Free Mode Inputs (5):**
1. IT Load (kW): 100-100,000
2. Cooling Type: Air (CRAH) / Evaporative / DLC / Immersion / Hybrid
3. Climate Zone: Tropical / Arid / Temperate / Continental / Nordic
4. Redundancy: N / N+1 / 2N / 2N+1
5. Rack Density: 5-120 kW/rack

**Free Mode Outputs (4 KPI cards):**
1. Estimated PUE (range: best/typical/worst)
2. Annual Energy Overhead (MWh wasted on non-IT)
3. Industry Benchmark Comparison (vs 1.58 avg, vs 1.10 hyperscaler)
4. EU EED Compliance Status

**PRO Mode Additions:**
- What-If Comparison (toggle cooling type → instant PUE/cost delta)
- Annual Cost Calculator ($)
- CO2 Equivalent by region
- Water Consumption Estimate
- Sensitivity Analysis (which input has biggest PUE impact)
- PDF Export

### Key Stats for Virality
- "PUE stuck at 1.58 for a DECADE despite $billions in efficiency spend"
- "Google's PUE 1.10 at 200MW still wastes 20MW — enough to power 15,000 homes"
- "Singapore caps new DC PUE at 1.3 but average existing facility runs 1.6+"
- "EU forces 10,000+ DCs to publicly report PUE — no more hiding"
- "If every DC achieved Google's PUE, global savings = 200 TWh/year = entire Belgium"

### CSS Prefix: `pue-`
### Accent Color: `#06b6d4` (cyan — matches efficiency/cooling theme)
### Series: Engineering Journal (technical deep-dive with data)

---

## Article 2: "The Cloud's Toxic Secret: Why Nobody's Testing Data Centers for Forever Chemicals"

### Why This Article
- **Viral 5/5** — "forever chemicals" is a proven viral keyword (millions of searches)
- **ZERO overlap** with any existing article — completely untouched territory
- **Environmental + health + AI** intersection = maximum sharing potential
- **No other DC publication has covered this** — first-mover advantage
- **Calculator pair**: PFAS Exposure Risk Assessment — unique, never-seen-before tool

### Why NOT Underground DC for Article 2
Underground DC is interesting (5/5 viral) but:
- Niche audience (only relevant to Gulf market)
- Hard to build a compelling calculator
- PFAS has 10x broader audience appeal (everyone uses cloud, everyone fears chemicals)

### Proposed Structure (10 Sections)
- sec0: Abstract — "PFAS are in your cloud. Nobody's measuring it."
- sec1: What Are PFAS and Why Should Data Centers Care?
- sec2: Where PFAS Hide in Data Centers (cooling fluids, cable coatings, fire suppression, immersion coolant)
- sec3: The Cooling Fluid Problem — Fluorinert, Novec, 3M's Exit
- sec4: Fire Suppression — FM-200 and the PFAS Connection
- sec5: The Regulatory Black Hole — EPA Doesn't Require DC PFAS Testing
- sec6: Groundwater Contamination Risk Near DC Clusters (map of DC hotspots vs water sources)
- sec7: PFAS-Free Alternatives — ZutaCore, Mineral Oil, Water-Based Solutions (2026 landscape)
- sec8: What the Industry Should Do — Testing Protocol Proposal
- sec9: Interactive PFAS Risk Assessment Calculator (CTA)

### Calculator: PFAS Exposure Risk Assessment
**Free Mode Inputs (5):**
1. Cooling Type: Air / DLC (glycol) / DLC (fluorocarbon) / Immersion (fluorocarbon) / Immersion (mineral oil)
2. Fire Suppression: FM-200 / Novec 1230 / Inergen / N2 / Water Mist
3. Facility Age: <5yr / 5-10yr / 10-20yr / 20yr+
4. Distance to Water Source: <500m / 500m-2km / 2-5km / >5km
5. Region: US / EU / Asia / Middle East

**Free Mode Outputs (4 KPI cards):**
1. PFAS Risk Level (Low / Medium / High / Critical)
2. Estimated PFAS Compounds Present (#)
3. Regulatory Exposure Score (which regulations apply)
4. PFAS-Free Alternative Available? (Yes/No + recommendation)

**PRO Mode Additions:**
- Detailed compound breakdown (which PFAS, which component)
- Remediation cost estimate
- Timeline to regulation (when will testing become mandatory?)
- Transition roadmap to PFAS-free
- Comparison: PFAS vs PFAS-free TCO
- PDF Export

### Key Stats for Virality
- "PFAS are in data center cooling systems, cable coatings, and fire suppression — zero environmental testing required"
- "3M discontinued PFAS production, but the DC industry hasn't followed"
- "The EPA doesn't require PFAS reporting from data centers"
- "Your cloud data literally sits in a bath of forever chemicals"
- "ZutaCore launching PFAS-free cooling in 2026 — first mover in a $B market"

### CSS Prefix: `pfas-`
### Accent Color: `#ef4444` (red — danger/warning theme)
### Series: Global Analysis (environmental investigation angle)

---

## Production Order

### Week 1: PUE Article
1. Research verification (cross-check all stats against latest Uptime Institute 2025 data)
2. Write article HTML following ARTICLE_CREATION_PROMPT.md v1.3
3. Build PUE Calculator following CALCULATOR_PROMPT_STANDARD.md
4. Post drafts for all platforms (X, Mastodon, LinkedIn, Medium, Quora, Facebook)
5. Hero image generation (WebP, 1200px max)

### Week 2: PFAS Article
1. Deep research on PFAS compounds in DC equipment
2. Write article HTML
3. Build PFAS Risk Assessment Calculator
4. Post drafts
5. Hero image generation

### After Publishing
- Update RZ-Content-Tracker-2026.xlsx: S-34 → DONE (PUE), F-1 → DONE (PFAS)
- Update sitemap.xml and search-index.json
- Run security audit on new calculator code
- Run PageSpeed check on new pages

---

## Why These 2 Together?
1. **PUE**: Technical credibility article — establishes expertise, captures HIGH search volume, pairs with calculator that drives repeat visits
2. **PFAS**: Viral investigation article — breaks new ground, reaches beyond DC audience, creates urgency/fear that drives sharing
3. Together they cover BOTH the "expert audience" (PUE) and "general audience" (PFAS) — maximizing reach
