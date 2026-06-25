# Data & Evidence — "The Invisible Leak" (article-26)

Downloadable datasets supporting the article **The Invisible Leak: What Happens
When You Open a Two-Phase Cooling System — And Why Nobody Is Measuring It**
(`/article-26.html`). All files are CSV (UTF-8). Figures are tagged by source
class; representative/modelled values are labelled as such. Nothing here is a
substitute for site-specific sampling or a professional environmental
assessment.

| File | Rows | What it is |
|------|------|------------|
| [`worked-model-scenarios.csv`](worked-model-scenarios.csv) | 6,000 | The article's fluid-loss model evaluated across a grid of fluid charge (100–5,000 L) × make-up rate (0.5–20 %/yr) × 3 fluids → annual loss (L, kg), replacement cost ($), t CO₂e/yr, kg TFA/yr. Reproducible via `build-worked-model.py`. |
| [`fluid-properties.csv`](fluid-properties.csv) | 11 | Per-fluid physical/chemical properties (boiling point, vapour pressure, density, GWP, atmospheric lifetime, breakdown product, PFAS status) for the Novec / Galden / Opteon / Fluorinert fluids and the R-1234yf / R-1233zd(E) TFA-yield comparison. |
| [`loss-zones.csv`](loss-zones.csv) | 7 | The loss-zone taxonomy: each fluid-escape pathway with sourced magnitude, whether it is metered, and whether it is reportable. |
| [`regulatory-thresholds.csv`](regulatory-thresholds.csv) | 14 | EPA MCL / §608 leak triggers, EU Drinking Water Directive, EU F-Gas, ECHA TFA classification, and member-state TFA limits, with status + effective date. |
| [`tfa-pfas-reference-values.csv`](tfa-pfas-reference-values.csv) | 16 | Key published TFA/PFAS concentration values and regulatory limits (Kazil 2014 rainwater, member-state limits, EU/EPA limits, HFO→TFA molar yields), each cited. |
| [`external-databases.csv`](external-databases.csv) | 13 | Pointers to the large public databases the reader can download in full (EPA UCMR 5, TRI, CompTox; USGS Water Quality Portal; NOAA GML / AGAGE; EU EEA Waterbase; NORMAN; German UBA; CA GAMA; EPA GHGRP) — with the verified portal URL, format, and what claim each supports. |

## How to use

- **Want the modelled numbers behind the article's calculators?** Open
  `worked-model-scenarios.csv` and filter to your fluid + charge.
- **Want the raw measurement data (thousands–millions of rows)?** Use
  `external-databases.csv` — those portals host the full monitoring records;
  this repo links them rather than duplicating multi-hundred-MB government files.
- **Reproduce the model:** `python3 build-worked-model.py` regenerates
  `worked-model-scenarios.csv` from the documented constants.

## Source-class tags

- **published** — peer-reviewed study or field measurement
- **vendor** — manufacturer datasheet
- **regulator** — agency rule / standard
- **modelled / representative** — computed or mid-range value chosen for the worked example

See the reference list in `/article-26.html` (refs [1]–[23]) for the full citations.
