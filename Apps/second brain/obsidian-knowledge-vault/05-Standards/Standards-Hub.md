# Standards & Labs Hub

> 6 standards tools + 4 DC system pages

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

| ID | Name | File | Topic |
|---|---|---|---|
| s-chill | Chiller Plant | chiller-plant.html | Chiller SCADA, cooling overview |
| s-fire | Fire System | fire-system.html | Fire suppression documentation |
| s-fuel | Fuel System | fuel-system.html | Generator fuel management |
| s-water | Water System | water-system.html | Cooling water treatment |

All connected to `dc-solutions` (datacenter-solutions.html).

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
