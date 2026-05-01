# Reports & Infographics Hub

> Data-driven visual reports. All use verified 2025-2026 industry sources.

## Report Index

| ID | Name | File | Key Data |
|---|---|---|---|
| asean-report | [[ASEAN-DC-Report]] | asean-dc-report-2026.html | SG 850MW, ID 350MW |
| datahallai | [[DataHall-AI]] | datahallAI.html | NVLink 1800 GB/s · BMS audit pending [[../08-Automation/DC-AI-Engineering-Audit]] |
| infog-pue | [[PUE-Infographic]] | infographic-pue-global.html | 1.40→1.55 forecast |
| infog-sustain | [[DC-Sustainability]] | infographic-dc-sustainability.html | 350→620 TWh |
| infog-cost | [[DC-Cost-Breakdown]] | infographic-dc-cost-breakdown.html | Tier IV 2(N+1) |
| dc-market | [[DC-Market-Tracker]] | dc-market-tracker.html | 25+ markets Leaflet/CARTO map |
| pjg | [[PLN-Java-Grid]] | pln-java-grid.html | 744 nodes / 698 edges OSM-sourced |
| pjg-jkb | [[PLN-Jakarta-Banten]] | pln-java-grid-jakarta-banten.html | 30-node 20kV DC overlay |
| pjg-jb | [[PLN-Jawa-Barat]] | pln-java-grid-jabar.html | Cirata hydro + geo cluster |
| pjg-jt | [[PLN-Jateng-DIY]] | pln-java-grid-jateng.html | Tanjung Jati B 2.64 GW anchor |
| pjg-jm | [[PLN-Jawa-Timur]] | pln-java-grid-jatim.html | Paiton 4.71 GW + Java-Bali submarine |

## Data Sources

| Source | Metric | File |
|---|---|---|
| IRENA 2024 | Renewable energy costs | infog-pue, infog-sustain |
| IEA 2025 | DC power consumption 620 TWh | infog-sustain |
| CBRE H1 2025 | SG 850MW, colocation pricing | asean-report, dc-market |
| Uptime Institute 2025 | PUE 1.55 global avg | infog-pue |
| BNEF 2025 | Solar/BESS costs | dcmoc/CarbonEngine.ts |

## Corrections Applied (2026-03)

- SG capacity: 1,050 → **850 MW** (CBRE 2025)
- ID capacity: 680 → **350 MW** (JLL 2025)
- SG PUE: 1.38 → **1.55** (Uptime 2025)
- NVLink: 900 → **1,800 GB/s** (NVIDIA H200)
- Global DC power: correct 350→620 TWh range
- AWS renewable: 90% → **100%** (2023 achievement)
