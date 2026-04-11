# Tech Stack

> Related: [[Site-Architecture]], [[README]]

## Frontend (rz-work)

| Layer | Tech | Notes |
|---|---|---|
| HTML | Static HTML5 | 97+ files, single-file pattern |
| CSS | Custom CSS | ~5950 lines, BEM-ish naming |
| JS | Vanilla ES6+ | No framework, IIFE pattern |
| Charts | Chart.js | Used in calculators |
| Network Graph | vis.js | Second Brain |
| Minification | terser + cleancss | script.min.js + styles.min.css |
| Dev Server | serve.py | Custom Python, correct MIME types |
| Hosting | GitHub Pages | `baguspermana7-cpu/bfrfranco.github.io` |

## DC MOC App (dcmoc/)

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js | 16 (static export) |
| UI | React | 19 |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | v4 |
| State | Zustand | — |
| Build | `next build` | Static HTML output |

## Build Commands

```bash
# Minify CSS
cleancss styles.css -o styles.min.css

# Minify JS
terser script.js -o script.min.js --compress --mangle

# Dev server (port 8081)
python3 serve.py

# DC MOC type check
cd dcmoc && npx tsc --noEmit

# DC MOC build
cd dcmoc && npm run build
```

## Data Sources

| Source | Used In | Last Updated |
|---|---|---|
| IRENA 2024 | PUE Infographic | 2026-03 |
| IEA 2025 | Sustainability Infographic | 2026-03 |
| CBRE H1 2025 | ASEAN Report, Market Tracker | 2026-03 |
| Uptime Institute 2025 | Tier comparisons, PUE data | 2026-03 |
| BNEF 2025 | Carbon Calculator | 2026-03 |
| BOJ 2024-2025 | Japan inflation (DCMOC) | 2026-03 |
