# Calculators Hub

> 7 interactive financial/engineering calculators
> All linked from [[00-Hub/Site-Architecture]] → dashboard

## Calculator Index

| ID | Name | File | Accent | Key Feature |
|---|---|---|---|---|
| calc-pue | [[PUE-Calculator]] | pue-calculator.html | — | 12-location benchmarks |
| calc-capex | [[CAPEX-Calculator]] | capex-calculator.html | — | Multi-region build costs |
| calc-opex | [[OPEX-Calculator]] | opex-calculator.html | — | Energy cost escalation |
| calc-roi | [[ROI-Calculator]] | roi-calculator.html | — | Monte Carlo sensitivity |
| calc-tco | [[TCO-Calculator]] | tco-calculator.html | — | Build vs Colo vs Cloud |
| calc-carbon | [[Carbon-Calculator]] | carbon-footprint.html | — | Renewable offset model |
| calc-cx | CX Calculator | cx-calculator.html | — | SLA cost impact |

## Relationships

```
dashboard
├── calc-pue ←→ calc-carbon (efficiency cluster)
├── calc-capex ←→ calc-opex ←→ calc-roi ←→ calc-tco (financial cluster)
│   └── Inbound from: infog-cost, cmp-tier, asean-report
└── calc-cx
```

## Dark Mode Standard

All 5 major calcs (PUE, CAPEX, OPEX, ROI, TCO) have dark mode:
- Button: `.nav-theme-btn` in navbar
- Default: dark (`localStorage.getItem('theme') || 'dark'`)
- Inline `<script>` at top of `<body>` to prevent FOUC
- Key: `theme` in localStorage (shared with script.js)

## Share Results Module

`rz-share-results.js` (337 lines) — URL state encoding + social sharing.
Add to calculator pages:
```html
<script src="rz-share-results.min.js" data-calc-id="[id]" data-accent-color="[hex]"></script>
```
Status: Built but **NOT yet integrated** on any calculator page.
