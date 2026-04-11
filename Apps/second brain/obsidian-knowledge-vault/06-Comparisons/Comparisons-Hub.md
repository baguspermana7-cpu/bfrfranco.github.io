# Comparisons Hub

> 10 head-to-head technical comparisons with data tables and calculators

---

## Comparison Index

| ID | Name | File | Key Connection |
|---|---|---|---|
| cmp-tier | Tier 3 vs Tier 4 | compare-tier-3-vs-tier-4.html | → [[02-Calculators/Calculators-Hub#CAPEX]], → [[05-Standards/Standards-Hub#Tier Advisor]] |
| cmp-cool | Air vs Liquid Cooling | compare-air-vs-liquid-cooling.html | → calc-pue, calc-opex |
| cmp-gen | Diesel vs Gas Gen | compare-diesel-vs-gas-generator.html | — |
| cmp-pue | PUE vs DCiE | compare-pue-vs-dcie.html | → calc-pue |
| cmp-n1 | N+1 vs 2N | compare-n1-vs-2n.html | — |
| cmp-ash | ASHRAE vs Uptime | compare-ashrae-vs-uptime.html | → [[05-Standards/Standards-Hub#TIA-942]] |
| cmp-fire | FM200 vs Novec | compare-fm200-vs-novec.html | → s-fire, art-26 |
| cmp-floor | Raised Floor vs Slab | compare-raised-floor-vs-slab.html | — |
| cmp-ups | UPS Online vs Offline | compare-ups-online-vs-offline.html | — |
| cmp-wet | Wet vs Pre-Action | compare-wet-vs-preaction.html | — |

---

## Key Data Corrections (2026-03)

### Tier 3 vs Tier 4
- Premium corrected: 20-30% → **35-60%** (CBRE 2025)
- Tier IV notation corrected: 2N+1 → **2(N+1)** (Uptime Institute spec)

---

## Relationship Map

```
cmp-pue   → calc-pue        (metric source)
cmp-tier  → calc-capex      (cost data)
cmp-cool  → calc-pue        (efficiency impact)
cmp-cool  → calc-opex       (operating cost)
cmp-tier  → tier-adv        (decision tool)
cmp-ash   → tia-942         (standards reference)
cmp-fire  → sys-fire        (system page)
cmp-fire  → art-26          (PFAS article)
```

---

## Pattern

All comparison pages follow:
- Side-by-side data table
- Recommendation section
- Related calculator CTA
- FAQ with updated data
