---
id: pjg
title: PLN Java-Bali Grid Monitor
file: pln-java-grid.html
url: https://resistancezero.com/pln-java-grid.html
group: reports
tags: [pln, grid, indonesia, sld, leaflet, osm]
last_updated: 2026-05-01
parent: [[Reports-Hub]]
---

# PLN Java-Bali Grid Monitor

Live geographic + single-line-diagram view of the Jamali transmission system. **744 nodes / 698 edges** sourced from OpenStreetMap Overpass + hand-curated YAML overlay + topology inference.

## Architecture

- **Page**: `pln-java-grid.html` (~1730 LOC)
- **Map engine**: [[Apps-Hub#rz-map|js/rz-map.js]] (shared Leaflet wrapper, 317 LOC)
- **Tooltip module**: `js/pln-tooltip.js` (471 LOC) — IEC 62443-style hover panels
- **Dataset**: `js/pln-java-grid-data.js` (~270 KB, regenerated quarterly via `tools/build-osm-dataset.py`)
- **Curated overlay**: `tools/pln-java-grid-overlay.yaml` (annotations + edges block)
- **Refresh routine**: scheduled remote agent `pln-osm-quarterly-refresh` (`trig_01D2sJPrGrirosAJ8H7iNAqp`)

## Province Children

- [[PLN-Jakarta-Banten]] — DKI + Banten with 20 kV DC operator overlay
- [[PLN-Jawa-Barat]] — Cirata hydro + geothermal cluster
- [[PLN-Jateng-DIY]] — Tanjung Jati coal anchor
- [[PLN-Jawa-Timur]] — Paiton + Java-Bali submarine to Bali

## Edge Topology Sources

| source | count | meaning |
|---|---|---|
| `osm` | ~80 | matched OSM `power=line` features |
| `pln-p2b-2016` | ~40 | curated backbone from PLN P2B 2016 SLD |
| `pln-jbi-submarine` | 4 | Java-Bali submarine cable (4×150 kV) |
| `inferred-nn` | ~480 | nearest-neighbour fallback for sparse regions |
| `inferred-evacuation` | ~90 | plant-to-substation auto-connect |

Inferred edges render dimmed (`opacity:0.35`, no animation) to signal lower confidence.

## Voltage Tiers

| kV | colour | stroke-width | animation | typical role |
|---|---|---|---|---|
| 500 | `#3b82f6` | 1.6 px | laser-flow 2.4 s | backbone |
| 275 | `#a78bfa` | 1.4 px | laser-flow 2.6 s | submarine + special |
| 150 | `#f87171` | 1.0 px | laser-flow 2.8 s | regional distribution |
| 70 | `#f59e0b` | 0.7 px | static | legacy subtransmission |
| 20 | `#14b8a6` | 0.6 px | static | DC feeder + industrial |

## Layer Toggle Defaults

- **Overview** ([[PLN-Java-Grid]]): 500/275/150 ON, 70/20 OFF, labels OFF
- **Province sub-pages**: 500/275/150 ON, 20 ON (province-scope), 70 OFF, labels OFF

## Audit

Run `python3 tools/audit-dataset.py` for a quality dashboard. Current state (v8): 0 CRITICAL, 38 HIGH (32 remote-orphan stations >50 km from neighbours, 5 OSM lazy-tagged cross-tier jumps, 1 statistical confidence skew on the lone 275 kV node).

## Related

- [[DC-Market-Tracker]] — same Leaflet engine, different scope
- [[Site-Architecture]] — full rz-work routing
- [[../05-Standards/Standards-Hub|Standards Hub]] — TIA-942 naming convention
