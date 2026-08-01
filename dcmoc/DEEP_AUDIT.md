# DCMOC — Deep Multi-Dimensional Audit (5 Opus agents, live-render + code)

Date: 2026-08-01 · Method: 5 Opus specialist agents, each live-rendering the app past the root-gate + auditing the code, scored + evidence-backed (no blind claims).

## Scorecard
| Dimension | Score | Headline |
|---|---:|---|
| Algorithm / engine correctness | **72** | 2 HIGH: per-country labor→US-salary fallback; CapexEngine electrical double-counts UPS mult |
| Data wiring / integration | **72** | 2 HIGH: annual-OPEX diverges 3 ways across pages; Dashboard OPEX structurally under-counted (feeds EBITDA/IRR) |
| UI / UX / tampilan | **86** | high-craft; 1 HIGH: EBITDA hero renders raw `$-295156`; tour overlaps; ID/EN mixing |
| Skin / design system | **78** | instrument core excellent; 2 BLOCKER indigo toggle/button; indigo/blue-500 leak ~14 dashboards; no reduced-motion |
| Bug / runtime errors | **91** | 0 console errors across 36 dashboards; 1 MED: unguarded ÷itLoad → $NaN at itLoad=0 |
| **OVERALL** | **~80** | Genuinely strong product; the deep pass found real correctness/consistency defects the feature-level audits missed. |

## Findings → fix status

### Correctness (algorithm + wired-data) — highest impact
| ID | Sev | Finding | File | Status |
|---|---|---|---|---|
| C1 | HIGH | staffing region-map (country→region, US fallback removed) | rz-engine.js:11538 | ✅ |
| C2 | HIGH | Annual OPEX **3-way divergence**: Dashboard $4.40M / Financial $5.1-5.36M / Operations $4.70M — same project, all labeled "annual OPEX" | useDashboardData:67, FinancialPage:70, fullBreakdown | ⏳ |
| C3 | HIGH | Dashboard OPEX **structurally under-counted** — `totalAnnual` called w/o capex+extendedOpex → maintenance=$0 → poisons headline EBITDA/IRR/LCC (optimistic $300-950k/yr) | useDashboardData:66 | ⏳ |
| C4 | HIGH | electrical upsMult double-count removed | CapexEngine.ts:231 | ✅ |
| C5 | MED | electricity tariff single-sourced (country rate) | rz-engine.js:11573 | ✅ |
| C6 | MED | Dashboard/Financial OPEX use RAW headcount, ignore `staffingAutoMode` (default ON) + disagree on Janitor scope | useDashboardData:66, FinancialPage:72 | ⏳ |
| C7 | MED | Balance-sheet "✓ Balances" is a **tautology** (cash = plug); negative cash rendered as asset; interest/principal inconsistent | FinancialStatements.tsx:102 | ⏳ |
| C8 | MED | `CapexEngine` FOM multipliers applied GLOBALLY (qualityM on all disciplines) instead of scoping power/transformer to electrical | CapexEngine.ts:291 | ⏳ |

### Bugs
| ID | Sev | Finding | File | Status |
|---|---|---|---|---|
| B1 | MED | itLoad=0 guards + persist re-clamp | CapexEngine.ts:368,simulation.ts,portfolio.ts | ✅ |

### UI/UX
| ID | Sev | Finding | Status |
|---|---|---|---|
| U1 | HIGH | EBITDA hero KPI renders raw `$-295156` not compact `-$295K` | ⏳ |
| U2 | MED | Onboarding tour overlaps content + intercepts clicks on every tab | ⏳ |
| U3 | MED | Indonesian/English string mixing on "PRO" UI | ⏳ |
| U4 | MED | "AVAILABILITY 99.9980 2%" wraps mid-number (over-precision) | ⏳ |
| U5 | LOW | RANK #0 off-by-one; Risk/Strategic header inconsistent; 9px readability floor | ⏳ |

### Skin/design
| ID | Sev | Finding | Status |
|---|---|---|---|
| K1 | BLOCKER | Maintenance "Hybrid" toggle solid indigo (MaintenanceDashboard:433) | ✅ |
| K2 | BLOCKER | Portfolio primary button solid indigo (PortfolioDashboard:79) | ✅ |
| K3 | HIGH | Tailwind-default palette leak (indigo 70× + blue-500 categorical) across ~14 dashboards | ✅ |
| K4 | HIGH | No `prefers-reduced-motion` handling anywhere | ✅ |
| K5 | MED | Residual `#8b5cf6` in Gantt/PDF/benchmarks; consumer radii; glassmorphism residue | ✅ |

## Verified-GOOD (no defect — kept)
CAPEX total single-sourced across all pages · country/IT-load/tier/revenue consistent · PUE design-vs-at-load split correct · IRR/NPV honest (n/a not fabricated 0) · BOQ reconciliation invariant holds · reliability full-precision · empty-states graceful · 0 NaN at default inputs · 0 console errors · dual-theme coherent · no dead state.
