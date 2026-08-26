---
id: sdcv
label: DC Conventional
group: standards
url: dc-conventional.html
tags: [bms, scada, conventional-dc, capacity-study, design-studio]
last_updated: 2026-08-26
---

# DC Conventional

> Conventional DC design reference and specifications. v1.130.0 separates the current `CONV_CALC` operating snapshot from a 4 × 10 MW planning study.

## Notes

- **Current truth:** 1.850 MW IT, 2.6825 MW facility load and PUE 1.45 remain the immutable simulated operating basis.
- **Capacity study:** four halls at 10 MW IT each (40 MW campus IT) is planning scope only and requires Engineer-of-Record validation. It is never presented as current telemetry.
- **Shared Design Studio:** current basis is the safe default; selecting current + study appends a controlled comparison page to the generated technical specification without writing to `CONV_CALC`.
- Preserve existing subsystem routes, calculations and approved operations-console visuals while follow-on chiller, fire, fuel, water and ICT redesign work proceeds as separate controlled tasks.

## Connections

- [[dhall|DataHall AI]]
- [[s-epms|EPMS Telemetry]]
- [[s-dh|DC Conv Datahall Ops]]
- [[Standards-Hub]]
