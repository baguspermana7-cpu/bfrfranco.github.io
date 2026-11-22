# R-134a thermophysical properties — NIST Chemistry WebBook (source files)

Downloaded 2026-11-22 from the NIST Chemistry WebBook, SRD 69, "Thermophysical Properties of Fluid Systems"
(E.W. Lemmon, I.H. Bell, M.L. Huber and M.O. McLinden; equation of state for R-134a by Tillner-Roth and Baehr, 1994),
https://webbook.nist.gov/chemistry/fluid/ , fluid ID C811972, default reference state (IIR: h = 200 kJ/kg and
s = 1.0 kJ/(kg·K) for saturated liquid at 0 °C), units °C, kPa, kJ/kg, J/(g·K) = kJ/(kg·K).

| file | request |
|---|---|
| `saturation.tsv` | `Type=SatT`, the service returned its saturation table on the default pressure grid (−103 … 101 °C); used as is |
| `isobar-<P>.tsv` | `Type=IsoBar`, P = 300 … 1700 kPa in 100 kPa steps, 0 … 100 °C in 1 K steps (liquid, saturation and vapour rows) |

`tools/build-conv-r134a.mjs` copies the rows `js/conv-engine.js` needs (saturation −12 … 72 °C; vapour rows at even
temperatures plus the saturated-vapour row of each isobar) into the engine between the `R134A-PROPS` markers, rounded
to the printed digits. `--check` fails when the engine block differs from a fresh build of these files. No value is
fitted or extrapolated: the engine interpolates linearly between rows and returns null outside them.
