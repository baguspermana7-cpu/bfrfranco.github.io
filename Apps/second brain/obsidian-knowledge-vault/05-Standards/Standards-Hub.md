# Standards & Labs Hub

> 6 standards tools + 4 DC system pages + 4 cockpit operations pages + 1 dashboard showcase

---

## Standards Tools

| ID | Name | File | Purpose |
|---|---|---|---|
| tia | TIA-942 Checklist | tia-942-checklist.html | Interactive compliance checklist with scoring |
| tier-adv | Tier Advisor | tier-advisor.html | Wizard to determine optimal Uptime Institute tier |
| rfs | RFS Workbench | rfs-readiness-workbench.html | Ready For Service assessment |
| ltc-lab | LTC System Lab | ltc-system-modelling-lab.html | Electrical system modelling |
| ltc-std | Standards LTC Lab | standards-ltc-lab.html | LTC design reference |
| dc-conv | DC Conventional | dc-conventional.html | Conventional DC design reference |

### LTC Lab Key Data
- `elecPrice`: `0.065` (Virginia, corrected from 0.11)
- Related: [[ltc-std]]

### TIA-942 → Tier Advisor
Both tools are cross-linked: `tia → tier-adv`

---

## DC System Pages

| ID | Name | File | Topic | v1.41.x state |
|---|---|---|---|---|
| s-chill | Chiller Plant | chiller-plant.html | Chiller SCADA, cooling overview | — |
| s-fire | Fire System | fire-system.html | Fire suppression documentation | — |
| s-fuel | Fuel System | fuel-system.html | Generator fuel management | — |
| s-water | Water System | water-system.html | Cooling water treatment | v1.41.5 — MK-501 retag (was CT-MK), TK-402 dual-pipe fixed, UV-401/DOS-302 label overlap fixed |

All connected to `dc-solutions` (datacenter-solutions.html).

---

## Cockpit Operations Pages (v1.41.x family)

| ID | Name | File | Topic | v1.41.x state |
|---|---|---|---|---|
| dhall | DataHall AI | datahallAI.html | AI cockpit (DC AI baseline) | v1.41.1 STP modal + MMR · v1.41.2 water-quality Tech Spec §5.11-5.17 · v1.41.3 chillers GF + P&ID labels |
| s-dh | DC Conv Datahall Ops | datahall.html | DC Conv data hall SCADA | v1.41.4 — CRAH popover, inline rack ID+per-mode value, 22°C cold-aisle normalisation, excursion simulator |
| s-ict | ICT Network Console | ict.html | DC Conv ICT network ops | v1.41.6 — Security HMI tri-panel (CCTV mosaic + Doors list + Intrusion donut), data 4→8/4→8/3→9 |
| s-epms | EPMS Telemetry | EPMS_Telemetry.html | EPMS one-line + telemetry | (no v1.41.x changes — engine-locked) |
| s-dcv | DC Conventional | dc-conventional.html | Conv DC dashboard | v1.41.2 water-quality Tech Spec §5.5-5.13 |

### Engineering decision — water-cooled chiller + dry-cooler hybrid

Owner asked "kenapa chiller plan ini membutuhkan dry cooler? ini air cooled chiller kan?" Answer: DC AI baseline is **water-cooled centrifugal chiller** (Carrier 19XR R-1234ze COP 6.8 mag-bearing) with **dry-cooler closed-loop heat rejection** (no evaporative cooling tower). Hybrid achieves WUE=0 while using the more efficient water-cooled chiller cycle. Chillers physically belong in the Chiller Plant Hall on the Ground Floor; only dry coolers live on the roof.

### Cockpit family edge graph (vis.js)

```
sdcv → [s-dh, s-ict, s-epms, sch, swt, sfr, sfu]
s-dh → [sch, swt, s-epms]
s-ict → [s-dh, s-epms]
dhall → [swt, sch, sdcv]
```

---

## All-In-One Dashboard (v1.41.0)

| ID | Name | File | Topic |
|---|---|---|---|
| aiod | All-In-One Dashboard | all-in-one-dashboard.html | Self-hosted Glance dashboard showcase — 8 module catalogue (RSS/weather/stocks/calendar/news/monitoring/youtube/custom), Docker quickstart, sample YAML, alternative-tools comparison |

Connected from `geo` (geopolitics card) + `idx` (home) + `dash` (dashboard nav).

---

## LTC Series (ltc-*.html)

5 LTC lab pages in rz-work root:
- `ltc-ansi-tia-topology-readiness.html`
- `ltc-ashrae-thermal-control.html`
- `ltc-iso-energy-governance.html`
- `ltc-nfpa-fire-risk.html`
- `ltc-uptime-tier-alignment.html`

---

## Relationships

```
dc-solutions → [s-chill, s-fire, s-fuel, s-water]
tia → tier-adv
ltc-lab → ltc-std
cmp-tier (Comparisons) → tier-adv
cmp-ash (Comparisons) → tia
cmp-fire (Comparisons) → s-fire
```

Related: [[06-Comparisons/Comparisons-Hub]]
