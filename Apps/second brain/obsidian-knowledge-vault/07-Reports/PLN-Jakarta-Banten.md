---
id: pjg-jkb
title: PLN Jakarta+Banten Provincial Grid Detail
file: pln-java-grid-jakarta-banten.html
url: https://resistancezero.com/pln-java-grid-jakarta-banten.html
group: reports
tags: [pln, jakarta, banten, dc, hyperscale, 20kv]
last_updated: 2026-04-30
parent: [[PLN-Java-Grid]]
siblings: [[PLN-Jawa-Barat]], [[PLN-Jateng-DIY]], [[PLN-Jawa-Timur]]
---

# PLN Jakarta + Banten Provincial Grid

Province sub-page with **20 kV DC + industrial overlay**. CSS prefix `pjgkb-`. Map fitBounds `[[-7.0, 105.5], [-5.7, 107.5]]`.

## Provincial Stats

- **Peak load**: 11,500 MW (largest in Java-Bali)
- **Reserve margin**: 25 %
- **Renewable mix**: ~10 %
- **DC operators**: 18 (densest cluster in Indonesia)
- **DC capacity**: 690 MW IT load

## DC Operator Cluster

Major players visible on the 20 kV overlay:

| Operator | Sites | Anchor substation |
|---|---|---|
| DCI Indonesia | JK1 Cibitung, JK2-3 Cikarang, JK4 Karawang Timur, JK5 | GI Cibitung 150 kV |
| NTT GDC | Bekasi JKT1, Cikarang JKT2-3 | GI Cikarang 150 kV |
| BDx Indonesia | Cikarang CGK1-2 | GI Cikarang 150 kV |
| Equinix | JK1 Sentul, JK2 West Jakarta | GI Sentul 150 kV |
| Princeton Digital Group | Cibitung JC1-2 | GI Cibitung 150 kV |
| GDS | Cibitung JH1 | GI Cibitung 150 kV |
| Telkomsigma | SCB Sudirman, Serpong, Sentul | GI CSB / Sentul |
| EdgeConneX | EDJK01 | TBD |
| Bridge / ChinaData | Jakarta | TBD |

## Key Substations

- **GITET Bekasi** — 500/150 kV, 5,000 MVA, 1992. Main IBT for north Bekasi 150 kV ring.
- **GITET Cibatu** — 500/150 kV, 4,000 MVA, 2001. PLTGU Muara Tawar evacuation.
- **GI Cibitung** — 150/20 kV, 500 MVA, 1996. North-Bekasi industrial-belt distribution feed.
- **GIS Bekasi II / Summarecon** — 150 kV indoor GIS, 60 MVA, 2018. Serves Summarecon Bekasi residential + mall, Pekayon, Galaxy, BTC. Also feeds GI Traksi Halim (KCIC HSR traction). NOT to be confused with GIS Summarecon Serpong (Tangerang Selatan).

## Power Plant Anchors

- PLTU Suralaya 1-7 — coal — 3,400 MW — Banten (1984)
- PLTU Lontar 1-3 — coal — 945 MW — Banten (2011)
- PLTGU Muara Karang — gas — 1,750 MW — Jakarta Utara (1978)
- PLTGU Tanjung Priok — gas — 1,120 MW — Jakarta Utara (1990)
- PLTGU Muara Tawar — gas — 920 MW — Bekasi north coast (1996)
- PLTU Banten Jawa-7 — coal USC — 2×1000 MW — Banten (2019)

## Page Defaults

- v4 readability: labels OFF, tier-graded thin lines, animation only ≥150 kV
- 20 kV layer ON by default (province-scope)
- Tooltips on every node + edge midpoint kV badge
- Inferred edges dimmed at opacity 0.35

## Related

- [[PLN-Java-Grid]] — parent overview
- [[PLN-Jawa-Barat]] — sibling (West Java cross-link)
- [[Apps-Hub#dcmkt|DC Market Tracker]] — Jakarta market entry
- [[../03-Apps/Apps-Hub]] — DCMOC app references
