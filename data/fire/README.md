# DC Fire-Safety Engineering Data

Structured datasets backing the fire-safety hub (`pillar-fire-safety.html`, `fire-calculator.html`,
`fire-checklist.html`, `fire-system.html`) and the frozen calculation engine (`js/fire-model.js` +
`js/fire-engine.js`, validated by `tools/test-fire-calc.mjs` — 31/31).

| File | Rows | What it is |
|------|------|------------|
| [`clean-agent-properties.csv`](clean-agent-properties.csv) | 5 | Clean-agent suppression data — Novec 1230, FM-200, IG-541/IG-55, CO₂: NFPA 2001 design concentrations, min-extinguishing, NOAEL/LOAEL occupant-safety, the s = k1 + k2·T mass coefficients, GWP, discharge time. |
| [`li-ion-chemistry.csv`](li-ion-chemistry.csv) | 5 | Battery thermal-runaway risk — NMC/LFP/LCO/VRLA: runaway onset temperature (NMC 150 °C, LFP 166.8 °C), energy density, off-gas volume (L/Wh) + species, TR heat factor, and the governing vent-gas LFL (H₂ 4%). |
| [`standards-references.csv`](standards-references.csv) | 12 | The standards register — NFPA 75/76/2001/72/13/855, NFPA 70 (EPO), UL 9540/9540A, IEC 62619, FM Global DS 5-32, ISO 14520. |

## basis-tag legend (matches `js/fire-model.js` + ACCURACY_VALIDATION rule 6)

- **STANDARD** — anchored to a published code/standard (NFPA / UL / IEC / IPCC)
- **VENDOR** — manufacturer datasheet
- **DERIVED** — computed by the engine
- **ILLUSTRATIVE** — representative value where a primary figure is not transcribable (amber chip)

## Key engineering facts

- **Halocarbon agent mass** (NFPA 2001): `W = (V / s)·(C / (100 − C))`, `s = k1 + k2·T` (m³/kg).
- **Inert agent volume**: `X = ln(100 / (100 − C))` m³ agent per m³ hazard.
- **Occupant safety**: design concentration must stay **≤ NOAEL** for a normally-occupied space.
- **Li-ion off-gas** vastly exceeds the flammable limit in any practical room volume — early off-gas
  (H₂/CO) detection per **UL 9540A / NFPA 855** + ventilation is the primary mitigation, *ahead* of
  suppression. A 1,333 kWh NMC pack can release ~5,000 m³ of vent gas and ~12 GJ in full runaway.
