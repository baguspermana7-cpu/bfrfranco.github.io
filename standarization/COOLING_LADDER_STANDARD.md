# Cooling Ladder + Advanced/Emerging Cooling Standard (Ship-B)

> Single source: `rz-engine.js` — `DATA.coolingTech`, `DATA.pueMatrix`, `DATA.requirements.coolingMaxRackKw`, `DATA.capexDetail.coolingMult`. DCMOC consumes via `rzData()`. NEVER hardcode a vendor/TRL/PUE/rack-kW in a component.

## The ladder (monotonic, design-basis tier-3 PUE)

| Cooling | Max kW/rack | PUE t3 | CAPEX mult | Status |
|---|---|---|---|---|
| air | 20 | 1.50 | 1.0 | commercial |
| inrow | 30 | 1.27 | 1.2 | commercial |
| rdhx | 50 | 1.18 | 1.35 | commercial |
| liquid (DLC) | 132 | 1.15 | 1.6 | commercial |
| immersion_1p | 200 | 1.04 | 1.8 | commercial |
| immersion_2p | 200 | 1.03 | 2.0 | **emerging** (PFAS/F-gas pressure) |
| microfluidic (in-chip) | 250 | 1.03 | 2.2 (SCREENING) | **emerging** (TRL 6-7 pilot/research) |

`immersion` (legacy) kept as backward-compat alias ≈ immersion_1p. PUE ladder invariant asserted: `immersion_2p ≤ immersion_1p ≤ liquid`.

## `DATA.coolingTech` vendor/TRL database

Fields: `{ vendor, tech, family, trl(1-9), rackKwClaim, coolant, wueBasis, confidence, ref, source }`.

- **COMMERCIAL (TRL 8-9, shipping):** CoolIT (DLC cold plate), JetCool/Flex (microconvective DLC), ZutaCore (2φ waterless DLC), GRC/Submer/Iceotope (1φ immersion).
- **EMERGING (TRL 5-7, pilot/lab):** LiquidStack (2φ immersion — best PUE but PFAS-limited), Corintis/TSMC/IMEC/IBM (in-chip microfluidic).

## Honesty rules (non-negotiable)

1. `confidence: 'emerging'` MUST render with a distinct amber chip + "pilot/riset" wording; never as a deployable datasheet.
2. **Microfluidic in-chip is NEVER encoded as an NVIDIA architecture fact.** Official Rubin roadmap = warm-water DLC 45°C + 800VDC. Microfluidic is an EMERGING enabler for >200kW→1MW racks (~2027-28), validated in pilots (Corintis + Microsoft, TSMC DSLC, IMEC >600 W/cm²), NOT a shipped NVIDIA design.
3. **No public per-rack CAPEX exists for microfluidic** → its `capexDetail.coolingMult` (2.2) is SCREENING-only, disclosed as such.
4. Selectable in DCMOC for scenario modelling, but always visually flagged not-production.

## Gates

`test-rz-engine.mjs` Ship-B block asserts: coolingTech 6 entries sourced, each trl 1-9 + confidence ∈ {commercial,emerging} + rackKwClaim/vendor/ref present; microfluidic emerging + TRL<8 + ref flags research; immersion_2p emerging; dlc/1p commercial; pueMatrix ladder monotonic; microfluidic best-in-class ≤ liquid; coolingMaxRackKw microfluidic=250 highest; coolingMult microfluidic>2p>1p>liquid. `test-model-calibration.mjs` unaffected (mapping-1 checks air/inrow/rdhx/liquid only; new immersion rows out of band-check scope). See also [AI_ARCH_STANDARD.md](AI_ARCH_STANDARD.md).
