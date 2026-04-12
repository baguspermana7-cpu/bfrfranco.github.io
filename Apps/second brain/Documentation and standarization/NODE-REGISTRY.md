# Node Registry

> Complete registry of all graph nodes and relationships.
> Source of truth for both `index.html` rawNodes and Obsidian vault.
> Last updated: 2026-04-11 | Total: 118 nodes, ~150 edges
>
> **New in this version**: LTC lab cross-links, isolated comparison nodes connected,
> pillar page extensions, +3 documentation nodes (vault, sbdoc, rzstd), +40 edges.

---

## Core Nodes (7)

| ID | Label | URL | Group |
|---|---|---|---|
| index | Home | index.html | core |
| articles | Engineering Journal | articles.html | core |
| insights | All Insights | insights.html | core |
| dashboard | Dashboard | dashboard.html | core |
| glossary | Glossary | glossary.html | core |
| dc-solutions | DC Solutions | datacenter-solutions.html | core |
| achievements | Achievements | achievements.html | core |

## Series Hubs (2)

| ID | Label | URL | Group |
|---|---|---|---|
| geo-hub | Geopolitics Series | geopolitics.html | series |
| ff-hub | Future Forward Series | future-forward.html | series |

## Articles (29)

| ID | Label | URL | Series |
|---|---|---|---|
| art-1 to art-23 | Art-1 to Art-23 | article-N.html | Engineering Journal |
| art-24 | FF-1: The Web Didn't Die | article-24.html | Future Forward |
| art-25 | FF-2: Engineer Shortage Is Fake | article-25.html | Future Forward |
| art-26 | Art-26: PFAS Investigation | article-26.html | Global Analysis |
| geo-1 | Geo-1: 72-Hour Warning | geopolitics-1.html | Geopolitics |
| geo-2 | Geo-2: $50T Shift | geopolitics-2.html | Geopolitics |
| geo-3 | Geo-3: Hormuz Fiber Shock | geopolitics-3.html | Geopolitics |

## Calculators (7)

| ID | Label | URL | Dark Mode |
|---|---|---|---|
| calc-pue | PUE Calculator | pue-calculator.html | YES |
| calc-capex | CAPEX Calculator | capex-calculator.html | YES |
| calc-opex | OPEX Calculator | opex-calculator.html | YES |
| calc-roi | ROI Calculator | roi-calculator.html | YES |
| calc-tco | TCO Calculator | tco-calculator.html | YES |
| calc-carbon | Carbon Footprint | carbon-footprint.html | NO |
| calc-cx | CX Calculator | cx-calculator.html | NO |

## Comparisons (10)

| ID | Label | URL |
|---|---|---|
| cmp-tier | Tier 3 vs Tier 4 | compare-tier-3-vs-tier-4.html |
| cmp-cool | Air vs Liquid Cooling | compare-air-vs-liquid-cooling.html |
| cmp-gen | Diesel vs Gas Gen | compare-diesel-vs-gas-generator.html |
| cmp-pue | PUE vs DCiE | compare-pue-vs-dcie.html |
| cmp-n1 | N+1 vs 2N | compare-n1-vs-2n.html |
| cmp-ashrae | ASHRAE vs Uptime | compare-ashrae-vs-uptime.html |
| cmp-fire | FM200 vs Novec | compare-fm200-vs-novec.html |
| cmp-floor | Raised Floor vs Slab | compare-raised-floor-vs-slab.html |
| cmp-ups | UPS Online vs Offline | compare-ups-online-vs-offline.html |
| cmp-wet | Wet vs Pre-Action | compare-wet-vs-preaction.html |

## Reports & Infographics (6)

| ID | Label | URL | Key Data |
|---|---|---|---|
| asean-report | ASEAN DC Report 2026 | asean-dc-report-2026.html | SG 850MW, ID 350MW |
| datahallai | DataHall AI | datahallAI.html | NVLink 1800 GB/s |
| infog-pue | PUE Global Infographic | infographic-pue-global.html | 1.40→1.55 |
| infog-sustain | DC Sustainability | infographic-dc-sustainability.html | 350→620 TWh |
| infog-cost | DC Cost Breakdown | infographic-dc-cost-breakdown.html | Tier IV 2(N+1) |
| dc-market | DC Market Tracker | dc-market-tracker.html | 25+ markets |

## Apps (4)

| ID | Label | URL | Stack |
|---|---|---|---|
| app-finance | Finance Terminal | Apps/finance-terminal/index.html | Vanilla JS |
| app-second | Second Brain | Apps/second brain/index.html | vis.js |
| app-dca | DCA App | Apps/dca-app/index.html | Vanilla JS |
| dcmoc | DC MOC App | dcmoc/ | Next.js 16 |

## Standards & Labs (6)

| ID | Label | URL |
|---|---|---|
| tia-942 | TIA-942 Checklist | tia-942-checklist.html |
| tier-advisor | Tier Advisor | tier-advisor.html |
| rfs-wb | RFS Readiness Workbench | rfs-readiness-workbench.html |
| ltc-lab | LTC System Lab | ltc-system-modelling-lab.html |
| std-ltc | Standards LTC Lab | standards-ltc-lab.html |
| dc-conv | DC Conventional | dc-conventional.html |

## DC Systems (4)

| ID | Label | URL |
|---|---|---|
| sys-chiller | Chiller Plant | chiller-plant.html |
| sys-fire | Fire System | fire-system.html |
| sys-fuel | Fuel System | fuel-system.html |
| sys-water | Water System | water-system.html |

---

## Edge Types Summary

| From | To | Type | Count |
|---|---|---|---|
| articles → art-N | All articles | belongs_to | 29 |
| geo-hub → geo-N | Geopolitics articles | series_member | 3 |
| ff-hub → art-24/25 | FF articles | series_member | 2 |
| dashboard → calc-* | All calculators | contains | 6 |
| calc-* ↔ calc-* | Financial cluster | cross_ref | 5 |
| infog-* → calc-* | Infographic sources | references | 3 |
| cmp-* → calc-* | Comparison tools | related | 3 |
| dc-solutions → sys-* | DC systems | contains | 4 |

**Total edges**: ~70
