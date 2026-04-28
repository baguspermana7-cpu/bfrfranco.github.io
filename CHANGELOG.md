# Changelog — ResistanceZero

All notable changes to the ResistanceZero website. Format follows the spirit of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with calendar-versioned
release sections rather than semver.

> **Maintenance rule**: Every code or content change shipped to production must
> add an entry here. Entries are grouped by date. Within a date, group by
> `Added`, `Changed`, `Fixed`, `Removed`, `Security`. Cross-reference the
> related standardization document(s) when applicable.

---

## [Unreleased]

### Planned
- Extract `calc-auth.js` shared engine (Phase 1 of calculator consolidation roadmap, see `standarization/CALC_ENGINE_PLAN.md`).
- Tier 1 legal compliance fixes for articles 19–27 — add cookie banner, independence disclaimer, and terms/privacy footer links per `standarization/LEGAL_COMPLIANCE_STANDARD.md`.
- Hero images for articles 1–19 (currently missing `assets/article-N-hero.webp`).
- References sections for articles 2, 4, 5, 6, 8–12, 14–22 (the older articles still missing references after the 2026-04-28 batch).
- Article-16 `<div class="article-nav">` block (currently missing).

---

## [2026-04-28j] — Article-26 PFAS migrated to RZEngine.auth + bulk script-tag wiring

### Changed
- **article-26.html PFAS calculator IIFE** migrated from inline `VALID_USERS` array + bespoke session check to `RZEngine.auth.validateLogin`, `RZEngine.auth.getSession`, `RZEngine.auth.setSession`, `RZEngine.auth.dispatchAuthChange`. Inline `VALID_USERS` declaration removed entirely. Legacy fallback retained for safety if engine fails to load.
- **`<script src="rz-engine.js?v=2026-04-28">` wired into 30 additional pages** (articles 1–22 + articles.html + 5 standalone calcs + dashboard adjacents). Total rz-engine.js consumers across the site now: **35 pages**. Most don't yet consume the engine API but are now set up for future migration without another script-tag pass.

### Status: Super Engine consumers
| Article | Loads engine | Uses `auth.*` | Uses `models.*` | Uses `data.*` |
|---|---|---|---|---|
| article-23 | ✅ | — | — | — |
| article-24 | ✅ | ✅ | — | — |
| article-25 | ✅ | — | — | — |
| article-26 | ✅ | ✅ | — | — |
| article-27 | ✅ | ✅ (S2 pilot) | ✅ workforce.* | ✅ regions, salaryBenchmarks, attritionFactors |
| article-1 through article-22, articles.html, +standalone calcs | ✅ (script tag only) | — | — | — |

## [2026-04-28i] — Standalone calc nav glossary link

### Added
- Glossary link (`#14b8a6` teal) inserted into the `.nav-links` custom navbars on **12 standalone calc/tool pages**:
  - capex-calculator, opex-calculator, roi-calculator, tco-calculator, pue-calculator (5 main calcs)
  - carbon-footprint, dc-market-tracker (2 trackers)
  - tia-942-checklist, tier-advisor (2 standards tools)
  - ltc-system-modelling-lab, standards-ltc-lab (2 LTC labs — used `.nav-back` style for these)
  - datacenter-solutions (1 solutions hub)

This closes the standalone-calculator nav backlog from `[Unreleased]` (2026-04-28g). Glossary is now reachable from every page on the site that has any kind of navbar — main-pattern (`.nav-menu`), custom (`.nav-links`), or LTC-lab (`.nav-back`).

### Status
The discoverability audit is now functionally complete:
- ✅ Glossary linked from every page with a navbar (~77 pages total).
- ✅ Glossary linked from footer NAVIGATION across 60 pages.
- ✅ All Tier-1 and Tier-2 report pages have References sections.
- ✅ insights.html surfaces the Reports cluster.
- ✅ Second Brain graph reflects current site truth.

### Remaining backlog (small)
- Article-26 PFAS IIFE migration to `RZEngine.auth.*` (currently kept as A/B control).
- `dashboard.html` and `datacenter-solutions.html` References — optional, these are tool pages.

## [2026-04-28h] — Tier-2 Discoverability backlog cleared

### Added
- **References sections** on all 10 `dc-market/*.html` city pages (~6 region-specific citations each, 60 citations total). Each uses authoritative regional sources:
  - Singapore: IMDA, EMA, NEA, CBRE APAC, JLL Asia, IEA.
  - Jakarta: Kominfo, PLN, BPS, JLL Indonesia, CBRE Indonesia, Asia Cloud Computing Association.
  - Kuala Lumpur: MyDigital, MCMC, TNB, JLL/Cushman/EPU Malaysia.
  - Tokyo: METI, MIC, TEPCO, JEMA, JLL/CBRE Japan.
  - Sydney: AEMO, AER, ACMA, JLL Australia, Clean Energy Council, CBRE Pacific.
  - London: Ofgem, National Grid ESO, Ofcom, JLL UK, CBRE EMEA, techUK.
  - Frankfurt: Bundesnetzagentur, BMWK, DENA, JLL/CBRE Germany, eco Association.
  - Dubai: TDRA, DEWA, RTA, JLL/Cushman MENA, UAE Ministry of Energy.
  - Mumbai: TRAI, CEA, MAHADISCOM, JLL/CBRE India, NIXI.
  - Northern Virginia: Dominion Energy IRP, FERC, NERC, PJM, Loudoun County EDA, JLL Mid-Atlantic.
- **References sections** on all 3 infographic pages (~6 citations each, 18 citations total):
  - PUE Global: IRENA, Uptime, IEA, LBNL, ASHRAE, Green Grid.
  - DC Sustainability: IEA, AWS, Google, Microsoft, Greenpeace, CDP.
  - DC Cost Breakdown: CBRE, JLL, Uptime, NVIDIA, OCP, Schneider.
- `<script src="rz-engine.js">` wired into `article-23.html`, `article-25.html` (joining article-24, article-26, article-27 as Super Engine consumers — 5 of 27 articles now load the engine).

### Status of discoverability audit
- ✅ All Tier-1 (high-traffic report pages) have References.
- ✅ All Tier-2 (10 city pages + 3 infographics) have References.
- ✅ Glossary navigation in navbar + footer across 65 pages.
- ✅ Reports & Trackers cluster surfaces all reports from `insights.html`.
- ✅ Second Brain graph: 0-edge nodes (CX, Glossary) connected; stale labels fixed; RZEngine + 3 plan docs added.

### Remaining
- `dashboard.html` and `datacenter-solutions.html` References — these are tool pages, references optional.
- ~29 standalone calculator pages with `.nav-links` (custom navbar pattern) still need glossary link addition. Separate audit.
- IIFE migration of article-26's PFAS calculator to `RZEngine.auth.*` (kept as A/B control through the v1.2.0 ship; can migrate now since the engine is stable).

## [2026-04-28g] — Discoverability Audit (glossary nav + report refs + graph sync)

### Added
- **Glossary navigation surfaces:** glossary link in navbar Insights dropdown across 65 HTML pages (color #14b8a6) and in the footer NAVIGATION column across 60 HTML pages.
- **References sections** for the three highest-traffic report pages:
  - `dc-market-tracker.html` — 10 citations (CBRE 2025 Global DC Trends, JLL 2025, Cushman &amp; Wakefield 2025, Synergy Research 2024, Uptime 2024, IEA 2024, McKinsey, BloombergNEF, Data Center Frontier, government / utility filings).
  - `asean-dc-report-2026.html` — 10 citations (CBRE APAC, JLL Asia Outlook, Synergy, IMDA Singapore, Kominfo Indonesia, MyDigital Malaysia, DEPA Thailand, Cushman, IEA, Uptime APAC). This page was previously orphaned with zero inbound visible links — now linked from `insights.html`.
  - `datahallAI.html` — 10 citations (NVIDIA H100/GB200 datasheets, Uptime AI Survey, Equinix AI-Ready, ASHRAE TC 9.9, OCP, Schneider EcoStruxure, SemiAnalysis, IEA, LBNL).
- **Reports &amp; Trackers cluster** on `insights.html` — 6 cards surfacing `dc-market-tracker`, `asean-dc-report-2026`, `datahallAI`, and the 3 infographics. Closes the inbound-link gap.
- **Second Brain graph** new nodes: `a27` (Article 27 Workforce Crisis), `rzeng` (RZEngine v1.2.0), `sse` (SUPER_ENGINE.md), `scep` (CALC_ENGINE_PLAN.md), `scmp` (CALC_MODELS_PLAN.md).

### Fixed
- **Second Brain graph CX Calculator (`ccx`)** was 0-connection — now linked to dash, sdcv, copx, croi, rzeng (5 edges).
- **Second Brain graph Glossary (`glos`)** was 0-connection — now linked to idx, arts, ins, articles 23-27, calculators with terms (cpue, cpp, cpa), rzeng (12 edges).
- **Second Brain graph stale labels:** `a24` was "FF-1: The Web Didn't Die" → now "Art-24: Manpower Shortage". `a25` was "FF-2: Engineer Shortage" → now "Art-25: PJM 6 GW Short". Both moved out of Future Forward tagging into their actual content categories.

### Unreleased follow-ups (logged for next session)
- References sections for the 10 `dc-market/*.html` city pages (~5 region-specific refs each).
- References sections for `infographic-pue-global.html`, `infographic-dc-sustainability.html`, `infographic-dc-cost-breakdown.html`.
- References sections for `dashboard.html` and `datacenter-solutions.html`.
- Glossary link insertion for the ~29 standalone calculator pages with `.nav-links` (custom navbar pattern, separate audit).

## [2026-04-28f] — Super Engine S4 + S5 + S6 (capex/opex/tco/pue math + UI primitives)

### Added
- **`RZEngine.data.capexPerMw`** — per-MW build cost baselines for `airCooledTier2/3/4`, `liquidCooledTier3`, `immersionTier3` (sources: 451 Research 2024, JLL DC OpCost 2024, Cushman & Wakefield 2024).
- **`RZEngine.data.mepPctOfCapex`** — MEP percentage by tier (36/42/48% for T2/T3/T4).
- **`RZEngine.data.modularPremiumPct`** — modular vs stick-built premium by tier.
- **`RZEngine.data.hoursPerYear`** — `8760` constant.
- **`RZEngine.models.capex`** — `datacenterBuildCost(mw, tier, region)`, `modularPremium(baseCost, modularPct, tier)`, `mepDistribution(totalCapex, tier)`. Pulls regional multipliers from `RZEngine.data.regions`.
- **`RZEngine.models.opex`** — `powerCostAnnual(mw, pue, regionPower, hoursPerYear)`, `coolingEfficiency(climate, designDeltaT)`, `staffingCostAnnual(headcount, region, role)` (uses 1.30× fully-loaded mult), `contractCostAnnual(scope, region)`.
- **`RZEngine.models.tco`** — `lifecycle(capex, opexAnnual, years, refreshPct)` (default 5-yr refresh cycle), `replacementCycles(assetLife, totalYears)`.
- **`RZEngine.models.pue`** — `pueFromInputs(itLoad, totalLoad)`, `dcie(pue)`, `annualEnergyCost(itKw, pue, kwhRate, hoursPerYear)`.
- **`RZEngine.ui`** — `gateOverlay(message, ctaLabel, ctaHandlerName)`, `kpiCard(label, value, subLabel, accentColor)`, `badge(text, variant)` (12 variants matching CALCULATOR_PROMPT_STANDARD palette), `glossaryAnchor(term, slug)`, `tooltip(el, content)`.
- Engine bumped to **`v1.2.0`**. Now `35 KB / 711 LOC`, still under 50 KB SUPER_ENGINE §H budget.

### Verified (node smoke tests)
- `datacenterBuildCost(10, 3, 'US') = $105M`; `…'APAC' = $47.25M` (regional scaling correct).
- `mepDistribution(100M, 3) = $42M` (42% of capex).
- `powerCostAnnual(10MW, 1.4, $0.12, 8760h) = $14.72M`.
- `coolingEfficiency('temperate', 12) = 0.84`.
- `staffingCostAnnual(20, 'US', 'dcTechMid') = $1.95M` (20 × $75,100 × 1.30).
- `lifecycle(150M, 8M, 10yr, 40%) = $350M`.
- `pueFromInputs(8000, 11200) = 1.400`; `dcie(1.4) = 71.4%`.
- `ui.badge`, `ui.kpiCard`, `ui.gateOverlay`, `ui.glossaryAnchor` all return well-formed HTML strings.

### Status
All 4 math domains (workforce / capex / opex / tco / pue / roi / forecast) and core UI primitives now live in the engine. **Phases S0–S2, S4, S5, S6 of SUPER_ENGINE.md are SHIPPED** (S3 PDF consolidation deferred to remote agent on 2026-05-05).

## [2026-04-28e] — Super Engine S2 (workforce + ROI + forecast models) + modal helper

### Added
- **`RZEngine.models.workforce`** — `annualHiresRequired`, `attritionCost`, `strategyFitScore`, `cumulativeHires`, `yearsToCloseGap`. Closed-form math, defaults pulled from `RZEngine.data.attritionFactors` so a single benchmark refresh propagates to every workforce calculator.
- **`RZEngine.models.roi`** — `paybackPeriod`, `npv` (with discount rate), `irr` (bisection over [-0.99, 10]).
- **`RZEngine.models.forecast`** — `compoundGrowth`, `linearTrend` (returns `{slope, intercept, predict}`), `projectByYear` (year-by-year array).
- **`RZEngine.modal.create({id, title, accentColor, subtitle, bodyHTML, submitLabel, onSubmit})`** — singleton modal helper. Auto-injects backdrop with `rgba(0,0,0,0.85)` + `backdrop-filter:blur(8px)` per PRO_MODE standard. Returns `{show, hide, destroy}` controls. Reuses existing element on repeat calls (idempotent).
- Engine bumped to `v1.1.0`.

### Changed
- **article-27 IIFE** now calls `RZEngine.models.workforce.attritionCost(...)` and `RZEngine.models.workforce.annualHiresRequired(...)` for the corresponding KPIs (with hardcoded fallbacks if engine missing). This is the first calculator on the site to share math via the engine, not just constants.

### Verified
- Node smoke tests pass: `annualHiresRequired(25,35,25,5)=9`, `attritionCost(25,25,75100)=$999,769`, `paybackPeriod(100K,30K,5K)=4 yr`, `npv([-100,40×4],0.10)=$26.79`, `compoundGrowth(75100,0.025,5)=$84,969`, `linearTrend(slope=2)`.
- localhost: `rz-engine.js` now `23 KB / 499 LOC` (well under 50 KB budget per SUPER_ENGINE §H).

## [2026-04-28d] — Super Engine S0 + S1 Shipped (skeleton + auth + data + format + events)

### Added
- **`rz-engine.js`** at repo root (~290 LOC, 12 KB unminified, vanilla ES5/ES6, zero deps).
  Implements Phases S0 + S1 of `standarization/SUPER_ENGINE.md`:
  - `RZEngine.data` — single source of truth for `version`, `lastUpdated`, `years` (2025–2030),
    `baselineYear`, `regions` (US/EU/APAC/LATAM with salaryMult/powerKwh/currency),
    `currency`, `inflationAnnual`, `salaryBenchmarks` (dcTechMid, electricianJourneyman, cdfomSenior),
    `attritionFactors` (replacementCostMult, voluntaryAttritionAvg, apprenticeRetention),
    `pueDefaults` (air/liquid/immersion Tier-3 baselines).
  - `RZEngine.auth.{VALID_USERS, validateLogin, getSession, setSession, logout, dispatchAuthChange, onAuthChange}`
    — auth.js-compatible session format, accepts both `{expires:ISOString}` and legacy `{exp:number}`.
  - `RZEngine.format.{currency, percent, number, weeks, months, ymd}` — display helpers.
  - `RZEngine.events.{dispatch, on, off}` — generic CustomEvent bus.
  - Stubs for `RZEngine.{models, modal, pdf, charts, ui}` filled in S2–S6.
- Script tag added to `article-27.html` (after auth.js, before script.min.js) and `article-26.html` (after auth.js).

### Changed
- **article-27 pilot** (S0 first consumer):
  - `wsCheckSession` now delegates to `RZEngine.auth.getSession()` with legacy fallback.
  - `REGION_MULT` and `REGION_LABEL` derived from `RZEngine.data.regions` at IIFE init (with hardcoded fallback if engine missing).
  - `avgSalary` baseline pulled from `RZEngine.data.salaryBenchmarks.dcTechMid.US` ($75,100, was hardcoded $72,000 — refresh to 2024 BLS / Uptime number).
  - `replacementFactor` pulled from `RZEngine.data.attritionFactors.replacementCostMult` (213%).
- Constants are now editable in ONE place (`rz-engine.js`) and propagate to article-27. Future migrations move article-26 + standalone calculators to the same engine in subsequent phases.

### Verified
- Node smoke test: `RZEngine.auth.validateLogin('demo@resistancezero.com','demo2026')` returns `{email, tier:'pro', role:'demo'}`; bad password returns `null`.
- localhost: `art-27=200, art-26=200, rz-engine.js=200 (12KB)`.

## [2026-04-28c] — Modal + Auth Hotfix + Super Engine Design

### Fixed
- article-27 + article-26 modal backdrop now `rgba(0,0,0,0.85)` + `backdrop-filter:blur(8px)` (was `rgba(0,0,0,0.7)` no blur — caused article body to bleed through behind the Pro Analysis modal).
- article-27 IIFE now listens for `rz-auth-change` event so navbar login propagates to the embedded calculator without a page reload. Also fixed a session-format mismatch: IIFE was reading `sess.exp` (numeric timestamp) while `auth.js` writes `sess.expires` (ISOString) — IIFE now accepts both formats. Local IIFE login now writes the auth.js-compatible format and emits `rz-auth-change` so the navbar reflects the login state immediately. (Article-26 already had this listener; only the modal fix applied there.)

### Added
- `standarization/SUPER_ENGINE.md` — master architectural design unifying `CALC_ENGINE_PLAN.md` (plumbing) and `CALC_MODELS_PLAN.md` (math) under a single `window.RZEngine.*` API. Documents the **"Shared Anchor Parameters"** rule: even when a new calculator is custom-built, parameters like Target Year, Region, Currency, Inflation, salary benchmarks, attrition factors, PUE defaults, and power costs MUST be sourced from `RZEngine.data` rather than inlined. Includes 6-phase rollout (~10–11 weeks), versioning discipline, consumer template, DCMOC relationship, failure modes, and 5 open questions for review before S0 starts.
- Cross-references: `CALC_ENGINE_PLAN.md` and `CALC_MODELS_PLAN.md` now declare `SUPER_ENGINE.md` as their parent vision.

## [2026-04-28b] — Article-27 Polish + Calc Models Roadmap

### Fixed
- article-27 dark-mode group-header badges (CREATE/SUBSTITUTE/EXTEND) now have `[data-theme="dark"]` overrides; they were the empty-rectangle badges visible at the top of each strategy group in earlier dark-mode screenshots.

### Changed
- article-27 calculator expanded from 8 → 12 inputs and 7 → 10 KPIs.
  - New inputs: **Target Year (2025–2030)**, **Region (US/EU/APAC/LATAM)**, **Workforce Mix (Physical-heavy/Balanced/NOC-heavy)**, **Risk Tolerance (Conservative/Balanced/Aggressive)**.
  - New KPIs: Annual Hires Required, Cumulative Hires by [Target Year], Years to Close Gap.
  - Cost-related KPIs now scale by region multiplier (US 1.00 / EU 0.85 / APAC 0.45 / LATAM 0.55).
  - 5-Year Investment renamed to N-Year Investment, length driven by Target Year.
  - Narrative auto-references Target Year, Region, Workforce Mix, and Risk Tolerance.
- article-27 added a 5th Pro panel: **Year-by-Year Hiring Trajectory** chart (multi-line: Remaining Staff Gap, Cumulative Hires, Strategy Capacity with maturity ramp).
- article-27 PDF export now includes the new KPIs and Target Year/Region in the header.
- article-27 in-prose first occurrences of `AIOps`, `NOCaaS`, and `apprenticeship` now link to `glossary.html#term-[slug]` per the new glossary workflow.

### Added
- `standarization/CALC_MODELS_PLAN.md` — sibling roadmap to `CALC_ENGINE_PLAN.md` covering the **calculation math layer** (`CalcModels.{workforce, capex, opex, roi, tco, pue, forecast}` plus `CalcModels.data` for shared constants like salary benchmarks, region multipliers, attrition factors). 4-phase rollout. Closes user concern about scattered math without a "big engine" for shared parameters.
- Cross-reference between `CALC_ENGINE_PLAN.md` and `CALC_MODELS_PLAN.md`.

## [2026-04-28] — Glossary Sync, Standards & Calculator Engine Roadmap

### Added
- 21 new glossary entries in `glossary.html` covering articles 23–27 domain
  vocabulary (AIOps, Apprenticeship, BICSI RCDD, Capacity Auction, CDCTP,
  Colossus, DCDC, Digital Twin, Galden HT, Interconnection Queue, Lights-Out
  DC, Maintenance Vapor Release, Megapack, Memphis Turbine Deployment, NOCaaS,
  Novec 7000, PFAS, PJM Interconnection, Reliability Pricing Model, Reserve
  Margin, Spectrum-X, Two-Phase Immersion Cooling). Each entry links back to
  its originating article via `term-links`. Total terms: 300 → 321.
- `CHANGELOG.md` (this file) — establishes the maintenance log.
- `standarization/CALC_ENGINE_PLAN.md` — 4-phase consolidation roadmap to
  extract ~5,800 LOC of duplicated auth, login modal, PDF export, and
  Chart.js setup code from 18+ calculator pages into a shared
  `calc-engine.js`. References DCMOC's TypeScript engine pattern as the
  architectural model.
- `standarization/TOOLTIP_STANDARD.md` new section: "Glossary Maintenance
  Workflow" — every new article must add 5+ glossary entries with
  `term-links` back to the article; in-prose first-occurrence terms link to
  `glossary.html#term-[slug]`.
- `standarization/article prompt/ARTICLE_CREATION_PROMPT.md` checklist 9.7:
  glossary update items added.
- Cross-reference notes in `AUTH_STANDARD.md`, `CALCULATOR_PROMPT_STANDARD.md`,
  `PRO_MODE_STANDARDIZATION.md`, and `PDF_EXPORT_STANDARD.md` pointing to
  `CALC_ENGINE_PLAN.md` so future calculator work consults the consolidation
  roadmap before adding more inline duplication.

### Changed
- Expanded existing `term-novec` entry to clarify Novec 1230 vs Novec 7000
  (different products) and added a new `term-novec-7000` entry.

---

## [2026-04-27] — Article 23–27 References + Standards Update

### Added
- References sections (academic format) for articles 23–27 with 12–25 cited
  primary sources each, linking to Uptime Institute, AFCOM, McKinsey, EPA,
  FERC, NERC, IBEW, NVIDIA, Microsoft, Google, and other authoritative sources.
- `assets/article-27-hero.webp` (1200×509 WebP @ q80, 60 KB).
- `ARTICLE_CREATION_PROMPT.md` §3.8 References pattern (mandatory) and
  checklist 9.6 — closes the standards gap that allowed articles 23–27 to ship
  without references.

### Fixed
- `article-27.html` dark-mode badge classes (12 classes covering CREATE/SUB/
  EXTEND, speed tiers, and cost tiers) now have `[data-theme="dark"]`
  overrides for readability.
- `article-26.html` series-nav next link now points to `article-27.html`.
- `article-24.html` SEO `<title>`, `og:title`, JSON-LD headline, share title,
  and H1 lead with "Data Center Manpower Shortage" for crawler clarity.
- `articles.html` updated with article-27 card, article-24 title fix, and
  structured-data headline updates.

---

## [2026-04-12] — Article 27 Published

### Added
- `article-27.html` — "No Humans, No Data Centers: 20 Strategies to Solve the
  AI Workforce Crisis" (Global Analysis series, 2,258 lines, ~133 KB).
- Embedded Workforce Strategy Planner calculator: 8 free inputs → 6 KPIs +
  narrative; 4 Pro panels (radar comparison, 36-month HTML Gantt chart,
  year-by-year cost stacked bar, ROI projection line); auth via shared
  session pattern; PDF export via `window.open()`.
- 25 reference citations (academic format).
- Article-27 card on `articles.html` (gradient styling matching Global
  Analysis red).

---

## Earlier history

For changes before 2026-04-12, refer to `git log` and the per-session memory
files in `~/.claude/projects/-home-baguspermana7/memory/`. This CHANGELOG was
introduced on 2026-04-28; older changes were not retroactively recorded.
