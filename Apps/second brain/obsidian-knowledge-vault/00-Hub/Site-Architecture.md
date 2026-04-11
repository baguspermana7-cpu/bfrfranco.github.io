# Site Architecture

> Related: [[README]], [[Tech-Stack]]

## Directory Structure

```
/home/baguspermana7/rz-work/
├── index.html              ← Main landing page
├── articles.html           ← Engineering Journal hub
├── insights.html           ← All insights aggregator
├── dashboard.html          ← Tools dashboard
├── glossary.html           ← DC terminology
├── geopolitics.html        ← Geopolitics series hub
├── future-forward.html     ← Future Forward series hub
│
├── article-1..26.html      ← 26 long-form articles
├── geopolitics-1..3.html   ← Geopolitics sub-articles
│
├── pue-calculator.html     ← [[02-Calculators/PUE-Calculator]]
├── capex-calculator.html   ← [[02-Calculators/CAPEX-Calculator]]
├── opex-calculator.html    ← [[02-Calculators/OPEX-Calculator]]
├── roi-calculator.html     ← [[02-Calculators/ROI-Calculator]]
├── tco-calculator.html     ← [[02-Calculators/TCO-Calculator]]
├── carbon-footprint.html   ← [[02-Calculators/Carbon-Calculator]]
│
├── compare-*.html          ← 10 comparison pages
├── infographic-*.html      ← 3 infographic pages
├── asean-dc-report-2026.html ← [[07-Reports/ASEAN-DC-Report]]
├── dc-market-tracker.html  ← [[07-Reports/DC-Market-Tracker]]
│
├── styles.css              ← Global styles (~5950 lines)
├── styles.min.css          ← Minified (cleancss)
├── script.js               ← Global scripts
├── script.min.js           ← Minified (terser)
├── rz-share-results.js     ← Share module (337 lines)
├── search-index.json       ← 82 entries for search
├── sitemap.xml             ← ~69 URLs
│
└── Apps/
    ├── finance-terminal/   ← [[03-Apps/Finance-Terminal]]
    ├── second brain/       ← This vault + web app
    ├── dca-app/            ← [[03-Apps/DCA-App]]
    └── dcmoc/              ← [[03-Apps/DCMOC]]
```

## Navbar Patterns

Two navbar patterns exist:
- **`.nav-menu`** — content pages (index, articles, calculators)
- **`.nav-links`** — calculator pages (custom nav, NOT updated in mass updates)

**Insights dropdown** (`.nav-menu` pages):
```
Insights
├── Engineering Journal  (cyan #06b6d4)
├── Global Analysis      (red #dc2626)
├── Future Forward       (violet #7c3aed)
├── ─────────────────
├── Second Brain         (purple #8b5cf6) ← NEW
└── All Insights         (slate #64748b)
```

## CSS Architecture

- Global: `styles.css` → `styles.min.css`
- Dark mode: `[data-theme="dark"]` on `<html>`
- CSS prefix per article series (e.g., `tgs-`, `iec-`, `ff-`)
- Calculator dark mode: inline `<script>` at top of `<body>`
- Accent colors per series/tool
