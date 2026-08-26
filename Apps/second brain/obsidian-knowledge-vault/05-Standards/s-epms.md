---
id: s-epms
label: EPMS Telemetry
group: standards
url: EPMS_Telemetry.html
tags: [epms, sld, semantic-state, power-flow, bms]
last_updated: 2026-08-26
---

# EPMS Telemetry

> EPMS one-line + telemetry cockpit. Conv-engine bound. v1.130.0 fixes ATS-to-rack source-color inheritance.

## Notes

- The final conductor from ATS to rack must inherit the evaluated source: Feed A/generator-A red, Feed B green, de-energized quiet gray.
- Never hard-code a green rack tail when the upstream ATS is supplied by A. Visual state is a projection of electrical truth, not its source.
- Regression gate: `node tools/test-epms-ats-rack-color.mjs` covers normal A, tie/B, generator and isolated cases.

## Connections

- [[dhall|DataHall AI]]
- [[sdcv|DC Conventional]]
- [[Standards-Hub]]
