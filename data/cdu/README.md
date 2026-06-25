# CDU Engineering Data — Coolant Distribution Unit hub

Structured datasets backing the CDU resource suite (`cdu-hub`, `cdu-selection-guide`,
`cdu-checklist`, `cdu-mini-bms`, `cdu-comparison`) and the CDU calculator. These are the
data layer that the frozen calculation engine (`js/cdu-model.js` + `js/cdu-engine.js`,
validated by `tools/test-cdu-calc.mjs`) is anchored to.

| File | Rows | What it is |
|------|------|------------|
| [`coolant-fluid-properties.csv`](coolant-fluid-properties.csv) | 24 | Water + PG-25 density / cp / viscosity / thermal-conductivity / Prandtl across 5–60 °C. **Generated from the engine** — reproduce via `node data/cdu/build-fluid-properties.mjs`. |
| [`cdu-operating-bands.csv`](cdu-operating-bands.csv) | 20 | The acceptance windows every derived KPI is checked against (supply, ΔT, flow LPM/kW, dP, system pressure, approach, dew-point margin, pipe velocity, NPSH margin, water chemistry) — from `cdu-checklist §01–03` + ASHRAE/OCP. |
| [`cdu-models.csv`](cdu-models.csv) | 15 | Verified vendor CDU models (Vertiv, CoolIT, Boyd, Motivair, Delta, nVent, Stulz, ZutaCore, Lenovo…): capacity, secondary flow, dP, approach, fluid, BMS protocol, ASHRAE class, link status. |
| [`standards-references.csv`](standards-references.csv) | 10 | The standards register (ASHRAE TC9.9, OCP cold-plate / UQD / Deschutes, DMTF Redfish DSP2064, ASME B31.3, ISO 4406 / NAS 1638, ASTM D1193, PG-25). |

## Basis-tag legend (matches `js/cdu-model.js` + ACCURACY_VALIDATION rule 6)

- **STANDARD** — anchored to a published standard/code (ASHRAE / OCP / ASME / ISO / IAPWS)
- **VENDOR** — transcribed from a manufacturer datasheet (`verify_with_vendor=true`)
- **DERIVED** — computed downstream by the engine
- **ILLUSTRATIVE** — representative handbook-class value where a primary figure is not transcribable
  (PG-25 property coefficients, fitting K-values, TCO $) — the UI shows an amber chip for these.

## Link-validation mandate

Every vendor `product_url` / `datasheet_url` must be curl-verified before a `VERIFIED` tag is
applied (per the CDU resource link-validation discipline). `VENDOR_PORTAL` = reachable vendor
landing page where the exact datasheet is behind navigation. Confirm specs with the manufacturer
before design use.
