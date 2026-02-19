# Claude Code Session Notes
**Date:** 2026-02-18
**Project:** Portfolio Website - baguspermana7-cpu.github.io
**Domain:** resistancezero.com (Cloud Run)

## Current State
- Branch: `main`
- Working directory: `C:\Users\User\Sandbox` (all project files relocated here)
- All 334 files now under `Sandbox/`, `.gitignore` at repo root

---

## Session: 2026-02-18 — Critical Security Fix + File Relocation

### Summary
Scrubbed sensitive credentials from public git history, fixed article-7 dark mode gaps, and relocated all project files from repo root into `Sandbox/` directory for cleaner organization.

### Completed Work

#### A. CRITICAL: Git History Scrub (standarization/ credentials)
- **Problem**: `standarization/SUPABASE_FIREBASE_SETUP.md` contained Supabase service role key, DB password, and Firebase API key — was in git history of a PUBLIC repo even after `git rm --cached`
- **Fix**: `git filter-branch --index-filter` removed `standarization/` from ALL 68 commits
- **Cleanup**: `rm -rf .git/refs/original/`, `git reflog expire --expire=now --all`, `git gc --prune=now --aggressive`
- **Pushed**: `git push --force origin main` — all commit hashes rewritten
- **Verified**: `git log -p --all -- "standarization/"` returns 0 lines

#### B. Article-7 Dark Mode Fix
- **File**: `Sandbox/article-7.html` (line ~169)
- **Added 3 CSS rules**:
  - `[data-theme="dark"] .highlight-box` — blue tint
  - `[data-theme="dark"] .warning-box` — amber tint
  - `[data-theme="dark"] .result-box` — green tint

#### C. File Relocation (root → Sandbox/)
- **Before**: All 334 tracked files at `C:\Users\User\` (repo root) — cluttered with personal files
- **After**: All files under `C:\Users\User\Sandbox\` via `git mv`
- **Only `.gitignore` stays at root** (git requires it)
- **Updated `.gitignore`**: Added `Sandbox/standarization/` and `Sandbox/node_modules/`
- **Dockerfile + nginx.conf**: Already use relative paths, work from Sandbox/ context
- **Deploy note**: `gcloud run deploy --source .` must now run from `Sandbox/`

### Commits
1. `97f753c` — git history rewrite (filter-branch, force-pushed)
2. `922188a` — `refactor: relocate all project files into Sandbox/ directory`

### Pending User Actions
1. **URGENT: Rotate Supabase credentials** — DB password + service role key were exposed on public repo. Even though history is scrubbed, anyone who cloned before still has them.
2. **Rotate Firebase API key** if concerned (lower risk since Firebase keys are client-side)
3. **Deploy**: Run `gcloud run deploy --source .` from `Sandbox/` to update Cloud Run

---

## Session: 2026-02-17 — Article-1 Calculator v1.2 Enhancements + PDF Executive Upgrade + Social Media

### Summary
Major enhancements to article-1 Operational Maturity Calculator: added Visual Card Interface, RMI, ISO 55001 Roadmap, 4 executive summary cards, radar chart restyling with ISO target overlay & strategic insight, and PDF executive risk classification banner. Fixed Pro mode layout bug (results pushed below fold), dark mode CSS conflict, and radar label clipping. Also improved LinkedIn post and created 23 X posts for all content.

### Completed Work

#### A. Article-1 Calculator v1.2 Enhancements
1. **Visual Card Interface**: Replaced 8 `<select>` dropdowns with interactive score cards (JS-generated). Each card has: header with dimension name + tooltip + weight badge, description, 5 score buttons (1-5), level definition text. Hidden `<select>` maintained for backward compatibility.
2. **RMI (Risk Mitigation Index)**: New 5th KPI — `RMI = Σ(score × weight × impact) / Σ(5 × weight × impact) × 100`. Color-coded: green ≥80%, yellow ≥60%, orange ≥40%, red <40%.
3. **ISO 55001 Asset Management Roadmap**: 3-stage visual roadmap (Awareness → Managed → Optimization) with dynamic highlighting and mapping note.
4. **4 Executive Summary Cards** (above KPI row):
   - Operational Health: score/100 + nearest benchmark tier
   - Risk Exposure: MODERATE/ELEVATED/HIGH/LOW + est. annual $ exposure
   - Critical Bottleneck: weakest dimension by priority score
   - Next Milestone: target score + gap to next maturity level
5. **Radar Chart Restyling**:
   - Renamed to "Maturity Profile" with panel container
   - Added legend: solid blue = Current Maturity, dashed purple = ISO 55001 Target
   - ISO target polygon (Level 4 all dims) rendered as dashed purple overlay
   - "Strategic Insight" box below radar — dynamic narrative per score tier
6. **Radar Label Fix**: Reduced `maxR` from `0.375` to `0.28`, added multi-line word wrapping for long labels (3+ words split at midpoint), font 10px.
7. **Model version**: bumped to v1.2

#### B. PDF Export Executive Upgrade
1. **4 Executive Overview Cards** at top of PDF: Operational Health, Risk Exposure, Critical Bottleneck, Next Milestone
2. **Risk Classification Banner** (full-width, color-coded):
   - Operational Risk: CRITICAL/ELEVATED/MODERATE/LOW
   - Efficiency Leakage: SIGNIFICANT/DETECTED/MINIMAL
   - ISO 55001 Readiness: NOT READY/PARTIAL/READY
   - Annual Exposure: dollar figure + incidents/year
3. **Executive Summary** panel (dark overlay in banner): Dynamic narrative translating score to business language, names specific weakness, recommends action with timeline
4. **Maturity Profile** header + legend + ISO target polygon in radar SVG
5. **Strategic Insight** box between charts and dimension table
6. **RMI KPI card** in executive summary row
7. **ISO 55001 Roadmap** section with 3 visual stages

#### C. Bug Fixes
1. **Pro mode "results disappear"**: Root cause — exec cards + calc-results + radar were positioned AFTER `maturityProInputs` div. When Pro mode expanded (facility context, weights, sub-dimensions = 2000+ px), results pushed far below fold. Fix: moved all result elements BEFORE `maturityProInputs`. New order: dim cards → exec cards → KPI results → radar → Pro settings → dimension bars → Pro analysis.
2. **Dark mode black blocks on exec cards**: Root cause — `styles.css` global rule `[data-theme="dark"] .article-body [class*="-card"]` applied `background: rgba(15,23,42,0.8)` to `.exec-card`. Fix: used `style.setProperty('background', ..., 'important')` in JS + `background: none !important` on child elements. Also replaced all hex-alpha colors (`${color}20`) with proper `rgba()` via `hexToRgba()` helper.
3. **Articles.html green particles**: Canvas z-index fixed to 50 (above content z-index 1, below navbar z-index 1000). Full-page coverage with `position: fixed`.

#### D. LinkedIn Post Update
- Updated `Article/Article_1 02.02.26/linkedin-post-article1.txt`
- Moved paradox punchline to top (stronger hook)
- Updated Pro Mode features to v1.2: RMI, ISO 55001, Monte Carlo, Tornado, Risk Classification
- Added PDF sell ("Operational Risk: ELEVATED. Efficiency Leakage: DETECTED. Annual Exposure: $292K.")
- Removed "C-Level" text from PDF export label (changed to "Executive Summary")

#### E. X (Twitter) Posts — All Content
- Created `Article/Social Media/X/x-posts-all.txt`
- 23 posts total, all under 280 chars:
  - Articles 1-17 (each with hook + link)
  - Geopolitics 1
  - OPEX Calculator
  - CAPEX Calculator
  - Insights Hub
  - Datahall SCADA demo
  - Portfolio overview
- Professional tone, 1-2 hashtags each

### Key Files Modified
- `article-1.html` — calculator v1.2, PDF export, exec cards, radar panel
- `articles.html` — green particle effect (z-index fix)
- `Article/Article_1 02.02.26/linkedin-post-article1.txt` — updated post
- `Article/Social Media/X/x-posts-all.txt` — NEW, 23 X posts

### Architecture Notes
- Exec cards use `hexToRgba()` helper + `setProperty(..., 'important')` to override global dark mode CSS
- Radar chart draws ISO 55001 target at Level 4 as dashed purple polygon
- Strategic insight text is dynamic per score tier (4 levels)
- PDF risk classification banner uses IIFE for scoped variables

---

## Session: 2026-02-16 (Cont. #3) — Article-6 Enhancement + LinkedIn CAPEX Captions

### Summary
Implemented deep research review enhancements for article-6 (RCA + Design Authority). Built full Pro mode infrastructure from scratch with 4 gated panels, evidence block, CTA, TOC highlights, PDF export, privacy badge, and benchmark meta. Also created 5 LinkedIn comment captions for CAPEX Calculator PDF export pages.

### Completed Work

#### A. Article-6 Full Enhancement (based on deep research report — +514 lines)
1. **Font Awesome CDN**: Added
2. **TOC calculator highlights**: Sections 8 (RCA Authority Canvas) and 10 (RCA Effectiveness Scorecard) with "Interactive" badges
3. **Executive Evidence Block**: Key Evidence at a Glance:
   - 30%+ Incident Recurrence (within 12 months of completed RCA)
   - 60% Findings Unaddressed (contributing factors already identified)
   - 6x Faster Learning (with design authority integration)
   - 97% False Alarm Reduction (RCA-driven system redesign case)
   - $40-50K Annual OPEX Savings (achieved through design authority)
4. **CTA block**: "Is Your RCA Process Creating Reports or Driving Real Change?" + "Calculate Your RCA Score"
5. **Pro Mode infrastructure** (built from scratch):
   - Mode toggle: Free / Pro Analysis (cyan theme)
   - 4 gated Pro panels with lock overlays:
     1. Organizational Maturity Deep Dive (6 KPIs: maturity level, loop type, cultural gap, safety paradigm, CAPA, DA readiness)
     2. Cost Impact Analysis (6 KPIs: recurrence cost, DA ROI, cost/incident, 12mo savings, payback, risk exposure)
     3. Methodology Effectiveness Matrix (4 KPIs: recommended method, fit score, complexity class, team size)
     4. Predictive Analytics (4 KPIs: predicted incidents 6mo, trend direction, breakeven DA, time to grade A)
   - Login modal with demo credentials (demo@resistancezero.com / demo2026)
   - Session auth (localStorage, 30-day expiry, rz-auth-change events)
   - switchRcaMode() / rcaShowLogin() / rcaHandleLogin() / rcaResetDefaults()
6. **PDF export function**: exportRcaPDF() — full executive report with:
   - Score gauge and grade display (color-coded A-F)
   - Input parameter summary table
   - 4-metric derived results (Learning Rate, Predicted Recurrence, DA Gap, Total Recs)
   - 6-dimension score breakdown table
   - Top 3 recommendations
   - Methodology note (Leveson STAMP, Hollnagel Safety-II/FRAM, Uptime 2023)
7. **Toolbar row**: Mode toggle (left) + Reset + Export PDF (right) — consistent pattern
8. **Privacy badge**: "PDF generated in your browser — no data is sent to any server"
9. **Benchmark meta**: Model v1.0, Feb 2026, Uptime 2023/DOE-HDBK-1208/Leveson STAMP 2011, 6-dimension weighted scorecard

#### B. LinkedIn CAPEX Comment Captions
Created 5 brief comment drafts for LinkedIn post comments (one per PDF page):
- Comment 1: Configuration & Cost Breakdown (Page 1)
- Comment 2: Equipment Specifications (Page 2)
- Comment 3: Construction Timeline (Page 3)
- Comment 4: Sustainability Metrics (Page 4)
- Comment 5: Executive Narrative (Page 5)
File: `Sandbox/Article/Opex and Capex/LinkedIn_CAPEX_Calculator.txt`

### Consistency Matrix (Articles 1-6)

| Feature | Art 1 | Art 2 | Art 3 | Art 4 | Art 5 | Art 6 |
|---------|-------|-------|-------|-------|-------|-------|
| Evidence Block | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| CTA (results-oriented) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOC Calculator Highlight | — | ✅ | ✅ | — | ✅ | ✅ |
| Privacy Badge | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Benchmark Meta | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Export PDF at Top | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pro Mode | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Files Modified/Created
```
article-6.html  | Full enhancement: FA CDN, TOC, evidence, CTA, Pro mode (4 panels), login, PDF, privacy, benchmark (+514 lines)
Article/Opex and Capex/LinkedIn_CAPEX_Calculator.txt | 5 LinkedIn comment captions added
```

### Review Files Consumed
- `Data/Freemium Scheme/article 6 deep-research-report.md` (229 lines)

---

## Session: 2026-02-16 (Cont. #2) — Article Enhancements (2, 3, 5) + Export PDF Repositioning

### Summary
Continued implementing deep research review improvements across articles 2, 3, and 5. Added evidence blocks, CTA improvements, TOC calculator highlights, privacy badges, and benchmark meta to all three. Built full Pro mode infrastructure for article-5 from scratch. Repositioned Export PDF buttons from bottom of calculators to top toolbar row across all 5 articles.

### Completed Work

#### A. Export PDF Button Repositioning (ALL 5 ARTICLES)
**Problem**: Export PDF button was buried at the bottom of calculators after 5+ Pro panels — users wouldn't see it.
**Solution**: Created a toolbar row pattern with mode toggle on the left and action buttons (Reset + Export PDF) on the right, same row.

| Article | CSS Class | Old Position | New Position |
|---------|-----------|-------------|-------------|
| 1 | `.maturity-toolbar-row` | After benchmark grid (middle) | Toolbar row next to mode toggle |
| 2 | `.alarm-toolbar-row` | Bottom action toolbar after Pro panels | Toolbar row next to mode toggle |
| 3 | `.maint-toolbar-row` | Bottom action toolbar after Pro panels | Toolbar row next to mode toggle |
| 4 | `.mode-toolbar-row` | Bottom after narrative box | Toolbar row next to mode toggle |
| 5 | `.debt-toolbar-row` | N/A (didn't exist) | Toolbar row next to mode toggle |

#### B. Article-2 Enhancements (based on deep research report)
1. **Executive Evidence Block**: 5 metric cards after Abstract:
   - >90% Alarm Reduction (800+ → <80/day)
   - 12% → 89% ISA-18.2 Compliance
   - 75% Response Time Improvement
   - 0 Missed Critical Alarms (6-month track)
   - ≤1.0 Alarms/Op/10min (ISA target achieved)
2. **CTA copy improved**: "Find Out If Your Alarm System Is Overloading Your Operators" + "Start Assessment"
3. **TOC calculator highlight**: Section 10 with `.toc-calculator` class and "Interactive" badge (done in previous session)
4. **Privacy microcopy**: "PDF generated in your browser — no data is sent to any server"
5. **Benchmark meta tags**: Model v1.0, Feb 2026, ISA-18.2-2022/EEMUA 191/IEC 62682, Poisson flood model + Erlang-C

#### C. Article-3 Enhancements (based on deep research report)
1. **Executive Evidence Block**: 5 metric cards after Abstract:
   - 74% → 97.2% PM Compliance (+23.2 pts in 18 weeks)
   - 0 Headcount Added (systems-only interventions)
   - 5 Systemic Drivers Identified
   - 80% Failures from Planning (Smith & Hinchcliffe)
   - 18 weeks to Sustained >95%
2. **CTA copy improved**: "Find Out Why Your PM Compliance Is Stuck Below 85%" + "Start Assessment"
3. **TOC calculator highlights**: Sections 11 (Compliance Canvas) and 12 (Compliance Predictor Calculator) with "Interactive" badges
4. **Privacy badge**: Already added in repositioning work
5. **Benchmark meta tags**: Model v1.0, Feb 2026, Palmer (2006)/Smith & Hinchcliffe (2004)/RCM III
6. **CSS added**: TOC calculator, evidence block, benchmark meta styles (was missing)

#### D. Article-5 Full Enhancement (based on deep research report — built from scratch)
1. **Font Awesome CDN**: Added (was missing entirely)
2. **TOC calculator highlights**: Sections 9 (Debt Accumulation Chart) and 10 (Risk Analyzer) with gold-themed "Interactive" badges
3. **Executive Evidence Block**: Case Study: 15MW Facility — 127 Deferred Items
   - 127 Deferred Items (across 5 system categories)
   - 15%/yr Risk Compounding Rate (Weibull-modeled)
   - 2–3× Remediation Cost Multiplier
   - 44% Outages Preventable (Uptime Institute 2023)
   - β = 2.5 Weibull Shape Parameter
4. **CTA block**: "Quantify Your Facility's Deferred Maintenance Risk" + "Start Risk Analysis"
5. **Pro Mode infrastructure** (built from scratch):
   - Mode toggle: Free Assessment / Pro Analysis (gold theme #f59e0b)
   - 5 gated Pro panels with lock overlays:
     1. Monte Carlo Risk Distribution (6 KPIs: p50/p80/p95, confidence band, sim runs, shape)
     2. Cost & ROI Deep Dive (6 KPIs: NPV, inaction cost, break-even, ROI 3yr, SLA penalty, insurance)
     3. Weibull Parameter Analysis (6 KPIs: β, η, MTTF, reliability, hazard trend, B10 life)
     4. Remediation Capacity Planner (4 KPIs: crew-months, phasing, queue prob, throughput)
     5. Scenario Sensitivity (4 KPIs: fix top 20%, +50% budget, defer 2yr, shift criticality)
   - Login modal with demo credentials
   - Session auth (localStorage, 30-day expiry, rz-auth-change events)
   - switchDebtMode() / debtShowLogin() / debtHandleLogin() / debtResetDefaults()
6. **PDF export function**: exportDebtPDF() — full executive report with:
   - Risk score display with color-coded severity
   - Input parameter summary table
   - 8-metric results grid
   - Methodology note (Weibull β=2.5 η=60mo, 15% compounding, sources)
7. **Privacy badge**: "All calculations run in your browser — no data is sent to any server"
8. **Benchmark meta tags**: Model v1.0, Feb 2026, NIST Weibull/ISO 55001/Uptime 2023

#### E. Privacy Badges Added (Articles 3 & 4)
- Both articles now have "PDF generated in your browser — no data is sent to any server" (were missing)
- Article 4 also got `.privacy-badge` CSS added

### Consistency Matrix (Articles 1-5)

| Feature | Art 1 | Art 2 | Art 3 | Art 4 | Art 5 |
|---------|-------|-------|-------|-------|-------|
| Evidence Block | ✅ | ✅ | ✅ | — | ✅ |
| CTA (results-oriented) | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOC Calculator Highlight | — | ✅ | ✅ | — | ✅ |
| Privacy Badge | ✅ | ✅ | ✅ | ✅ | ✅ |
| Benchmark Meta | ✅ | ✅ | ✅ | — | ✅ |
| Export PDF at Top | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pro Mode | ✅ | ✅ | ✅ | ✅ | ✅ |

### Files Modified
```
article-1.html  | PDF button moved to toolbar, old bottom button removed
article-2.html  | Evidence block, CTA, PDF toolbar, privacy, benchmark meta
article-3.html  | Evidence block, CTA, TOC highlights, benchmark meta, PDF toolbar, CSS
article-4.html  | PDF button moved to toolbar, privacy badge + CSS added
article-5.html  | Full enhancement: FA, TOC, evidence, CTA, Pro mode, 5 panels, login, PDF, privacy, benchmark (+447 lines)
```

### Review Files Consumed
- `Data/Freemium Scheme/article 2 review after deep-research-report.md` (433 lines)
- `Data/Freemium Scheme/article-5 deep-research-report.md` (343 lines)
- `Data/Freemium Scheme/article 3 review after deep-research-report.md` (188 lines)

---

## Session: 2026-02-16 — Article-4 Pro Enhancement Mode + Article Navigation

### Summary
Implemented full Pro Enhancement Mode for Article 4 (In-House Capability Is a Reliability Strategy) and added prev/next navigation to all 17 article pages.

### Completed Work

#### A. Article-4 Pro Enhancement Mode (+761 lines)
- **Font Awesome CDN**: Added for icon support
- **Mode Toggle**: Free Assessment / Pro Analysis with blue theme (#3b82f6)
- **CTA Card**: Promoting Pro features (Monte Carlo, Erlang-C, PDF export)
- **Tooltips**: 15 engineering-grade tooltips across all inputs (Free + Pro), each with Title, Description, and Formula/Reference
- **7 Free Inputs** (existing, enhanced with tooltips): Category, Vendor SLA, Skill Level, Annual Incidents, Downtime $/hr, Vendor Callout $, Training Investment
- **8 Pro Inputs** (new): MTBF hours, Off-Hours SLA Multiplier, In-House Coverage model (24/7, 16/7, 12/5), Spare Parts Readiness %, Team Size (for Erlang-C), Vendor Retainer $/yr, Critical Severity %, Duration Variability
- **7 Free Output KPIs** (existing): Vendor MTTR, In-House MTTR, Vendor/In-House Annual Downtime, Net Savings, ROI, Breakeven
- **26 Pro KPIs across 5 panels**:
  1. MTTR Distribution (6): Mean, Median(p50), p90, Mobilization%, Bottleneck, Reduction%
  2. Availability & Downtime (6): Vendor/In-House Availability, Delta, p50 Downtime, Hours Saved
  3. Financial Deep Dive (6): 3-Year NPV, Cost/Incident Vendor vs In-House, Breakeven p50/p90, 3-Year Cumulative
  4. Staffing & Queueing (4): Erlang-C Wait Probability, Queue Delay, Optimal Team Size, Utilization Rate
  5. Scenario Sensitivity (4): +1 Technician, +1 Skill Level, 2x Incidents, -50% Vendor SLA
- **Monte Carlo Simulation**: 5,000 iterations with lognormal phase distributions, off-hours variance modeling, Poisson incident arrival
- **Erlang-C Queueing Model**: M/M/c model for staffing optimization — calculates wait probability, queue delay, optimal team size
- **Narrative Conclusion Algorithm**: Capability Maturity Grade (A-F) based on 5 weighted dimensions (skill, reduction, queueing, NPV, spares), executive summary paragraph, domain-specific analysis, prioritized actions (CRITICAL/HIGH/MEDIUM/LOW)
- **PDF Export**: Full executive report with grade box, 12-KPI grid, phase decomposition table, Monte Carlo distribution summary, prioritized recommendations
- **Login Modal**: Blue theme, demo credentials, session auth (localStorage 30-day)
- **Gated Overlays**: Blur + lock icon on all 5 Pro panels
- **Article Navigation**: Added prev (article-3) / next (article-5) links

#### B. Article Navigation — All 17 Pages
Added consistent prev/next article navigation links to 11 articles that were missing them:
- article-1: next→article-2
- article-5: prev→article-4, next→article-6
- article-8: prev→article-7, next→article-9
- article-10: updated next→article-11 (was "All Articles" only)
- article-11: prev→article-10, next→article-12
- article-12: prev→article-11, next→article-13
- article-13: prev→article-12, next→article-14
- article-14: prev→article-13, next→article-15
- article-15: prev→article-14, next→article-16
- article-16: prev→article-15, next→article-17
- article-17: prev→article-16, next→All Articles

Previously working: articles 2, 3, 4, 6, 7, 9 (verified)

### File Statistics
```
article-4.html    | +761 lines (2,181 → 2,974)
article-1.html    | +nav links
article-5.html    | +nav links + CSS
article-8.html    | +nav links + CSS
article-10.html   | +nav fix (next link)
article-11.html   | +nav links + CSS
article-12.html   | +nav links + CSS
article-13.html   | +nav links + CSS
article-14.html   | +nav links + CSS
article-15.html   | +nav links + CSS
article-16.html   | +nav links + CSS
article-17.html   | +nav links + CSS
```

---

## Session: 2026-02-16 (Cont.) — Article-1 Enhancements + Auth Fixes

### Summary
Implemented improvements to Article 1 based on deep research review, plus fixed auth/session inconsistencies across articles 1, 3, 4.

### Completed Work

#### A. Article-1 Enhancements (based on deep research report review)
1. **Executive Evidence Block**: Added prominent visual block after opening paragraphs showcasing key case data:
   - 12 Prevented Incidents, $1.2M+ Avoided Costs, 99.999% Uptime, PUE 1.65→1.48, ROI 4:1–10:1
   - Source attribution to article sections 5-7
2. **CTA Copy Improvement**: Changed from "Try the Calculator" to "Start Assessment" with results-oriented messaging: "Get Your 3 Operational Investment Priorities in 10 Minutes"
3. **Privacy Microcopy**: Added badge below PDF export: "PDF generated in your browser — no data is sent to any server"
4. **Benchmark Versioning**: Added metadata tags showing Model v1.1, Updated Feb 2026, Sources (Uptime 2023-2024, EN 50600), benchmark type (directional, median, enterprise+colo)
5. **Risk & Cost Translation Panel**: New panel below benchmark grid that maps maturity score to:
   - Operational Risk Level (LOW/MODERATE/ELEVATED/HIGH)
   - Est. Annual Exposure ($K-$M)
   - Est. Incidents/Year
   - Value of +10pt Improvement
   - Top Risk Drivers (weakest dimensions with severity descriptions)
   - Explicit assumptions stated (10MW facility, $200K avg outage cost)

#### B. Auth/Session Format Fixes (cross-article)
**Problem**: Session storage format inconsistency between auth.js (`{email, tier, expires: ISO}`) and article built-in logins (`{email, name, ts: epoch}`). This caused:
- Cross-page session detection failures
- Pro mode not auto-unlocking after navbar login

**Fixes applied**:
- **article-1.html**: Login now uses `window._rzAuth.showModal()` instead of alert(); `rz-auth-change` listener now checks `e.detail.action === 'login'` (was checking `e.detail.premium`); session check handles both `expires` and `ts` fields
- **article-3.html**: `handleLogin` now stores `{email, tier, expires}` format (was `{email, name, tier, ts}`); session restore handles both formats
- **article-4.html**: `handleLogin` now stores `{email, tier, expires}` format (was `{email, name, ts}`); dispatches `rz-auth-change` event on login; session restore handles both formats; added `position: relative` to `.calculator-section` (tooltip fix)

#### C. Article-4 Tooltip Fix
**Problem**: Tooltip content wasn't appearing on hover — only the "?" circle showed.
**Cause**: `.calculator-section` missing `position: relative`, so the absolutely-positioned `#calc-tooltip-container` anchored to the wrong parent.
**Fix**: Added `position: relative` to `.calculator-section` CSS.

### Files Modified
```
article-1.html    | +Evidence block, CTA, privacy, benchmarks, risk panel, auth fix
article-3.html    | Auth session format fix
article-4.html    | Tooltip fix + auth session format fix
```

---

## Session: 2026-02-15 (Cont.) — Article-3 Pro Mode + SEO Audit + CAPEX/OPEX Documentation

### Summary
Continuation session: completed Article-3 Pro Enhancement Mode (edits 6-7), comprehensive SEO audit across all 20+ pages with fixes, created detailed CAPEX/OPEX technical documentation, and updated sitemap.

### Completed Work

#### A. Article-3 Pro Enhancement Mode (Completed)
- **Edit 6**: Login modal with green maintenance theme (#10b981), demo credentials hint
- **Edit 7**: Replaced ~60-line calculator JS with ~400-line Pro engine including:
  - Mode toggle (Free Assessment / Pro Analysis)
  - Monte Carlo simulation (5000 iterations) for compliance confidence bands
  - 6 free outputs + 24 Pro KPIs across 5 panels (Capacity, Compliance Deep Dive, Backlog & Risk, Workforce Optimization, Scenario Sensitivity)
  - Narrative PDF export with compliance grade (A-F), risk assessment, prioritized actions
  - Session auth with localStorage (30-day expiry)
  - All 7 edits now complete (Font Awesome, CSS, navbar auth, CTA card, calculator HTML, login modal, JS engine)

#### B. SEO Audit & Fixes (All Pages >90/100)
Pages fixed:
- `capex-calculator.html` — added og:image:alt, og:locale, og:site_name, twitter:site
- `datacenter-solutions.html` — added Google Analytics gtag, theme-color, og:locale, og:site_name, twitter:site
- `opex-calculator.html` — added og:image:alt, og:locale, og:site_name
- `article-4.html` — added og:image:alt, apple-touch-icon
- `article-11.html` — added og:image:alt
- `article-12.html` — added og:image:alt
- `article-13.html` — added og:image:width/height, og:image:alt, apple-touch-icon
- `article-15.html` — added og:image:width/height, og:image:alt, apple-touch-icon

#### C. Sitemap Updates
- Added 3 missing articles (14, 16, 17) with image extensions
- Updated lastmod dates for recently modified pages

#### D. CAPEX/OPEX Technical Documentation (NEW FILE)
- `Article/Opex and Capex/CAPEX_OPEX_Technical_Documentation.html`
- 22 sections covering full calculator methodology
- Print-ready HTML with @media print styles
- Covers: parametric cost model, multiplier system, city data, timeline, sustainability, staffing FTE, maintenance model, TCO projections, industry benchmarks

---

## Session: 2026-02-15 — Pro Enhancement Mode + Auth System + Calculator Upgrades

### Summary
Major enhancement session implementing Pro Enhancement Mode across article calculators, auth system injection to all pages, and CAPEX/OPEX calculator overhauls.

### Completed Work

#### 1. Auth System (`auth.js`) — Injected to 33+ Pages
- Shared auth module with localStorage session (30-day expiry)
- Hardcoded demo credentials: `demo@resistancezero.com / demo2026`
- Auto-detects 4 navbar types and injects login button + user dropdown
- Files injected: all article pages, calculator pages, dashboard pages, index, articles, insights, geopolitics, etc.

#### 2. Article-1 Enhancement (Pro Enhancement Mode)
- **Mode toggle**: Free Assessment / Pro Analysis with PRO badge
- **28 weighted sub-dimensions** in Pro mode (8 main categories)
- **Tooltips**: Custom positioning system on key inputs
- **Gated overlays**: Blur + lock icon on Pro panels for free users
- **PDF export**: Full narrative conclusion with:
  - Executive Summary with risk level assessment
  - Domain-specific analysis (8 maturity dimensions)
  - Prioritized recommendations table (CRITICAL/HIGH/MEDIUM/LOW)
  - Scenario modeling & custom weight profiles
- **+1,345 lines** of enhancements

#### 3. Article-2 Enhancement (Pro Enhancement Mode)
- **Mode toggle**: Free Assessment / Pro Analysis
- **Free inputs**: 8 parameters with tooltips (ISA-18.2 references)
- **Pro inputs drawer**: 8 additional parameters (flood window, threshold, standing%, facility type, priority model, handling distribution, chattering%, authorized suppress%)
- **Free output**: 7 KPI cards (same as original)
- **Pro output**: 28 KPIs across 5 panels:
  - Burden & Capacity (8 cards: Erlang-C queueing, utilization band, overload margin)
  - Flood Risk Deep Dive (6 cards: Poisson model, 95th percentile burst, time-in-flood)
  - Priority & Quality (6 cards: distribution, chattering impact, quality score)
  - Compliance Drilldown (4 cards: ISA-18.2 criteria breakdown)
  - Scenario Sensitivity (4 cards: +1 operator, 50% faster response, etc.)
- **PDF export**: Narrative conclusion with risk assessment, domain analysis, prioritized actions
- **+847 lines** of enhancements

#### 4. CAPEX Calculator Major Overhaul
- **Pro Enhancement Mode**: Full premium feature set
- **Equipment specification database**: UPS, cooling, generator, fire suppression brands/models
- **Construction timeline**: Gantt chart with parallel phases
- **Sustainability section**: PUE, CO2, WUE, refrigerant analysis
- **Scenario comparison**: Save Scenario A, calculate B, compare side-by-side
- **Narrative conclusion**: Multi-section executive assessment
- **+1,928 lines** of enhancements

#### 5. OPEX Calculator Major Overhaul
- **Pro Enhancement Mode**: Gated premium analytics
- **8 operational domains**: Staffing, Energy, Maintenance, Compliance, Security, BMS, Inventory, Training
- **Narrative conclusion**: 5 domain-specific narratives + 8 prioritized actions
- **PDF export**: Executive report with benchmarks, risk assessment, recommendations
- **+1,327 lines** of enhancements

#### 6. CAPEX PDF Fix: Gantt Chart Text Overflow
- Bar height 14px → 18px
- Label width 150px → 120px with overflow:hidden
- Duration text ("3mo") positioned OUTSIDE bar when bar is narrow (<12% width)

#### 7. Datacenter Solutions Page
- Replaced inline calculator with links to dedicated calculator pages
- **-612 lines** (cleaned up)

#### 8. LinkedIn Post Drafts Created
- `Article/Article_1 02.02.26/linkedin-post-article1.txt` — Safety-II, operational maturity, Pro mode
- `Article/Article_2 02.02.26/linkedin-post-article2.txt` — Alarm fatigue, ISA-18.2, Erlang-C, Pro mode
- Both include demo account: `demo@resistancezero.com / demo2026`

#### 9. New Files Created
- `auth.js` — Shared authentication module
- `supabase-auth.js` — Supabase auth integration (future)
- `terms.html` — Terms of service page
- `rz-ops-panel.html` — Operations panel page

### Pending Work (Not Yet Completed)
- **CAPEX PDF A/B Comparison**: Design & Delivery Concept and Equipment Specification sections still show only Scenario B. Need to add these to `buildPremiumComparisonHTML()` function (lines 3253-3332 in capex-calculator.html). Timeline, Capacity, and Sustainability comparisons already work.

### File Statistics
```
article-1.html            | +1,345 lines
article-2.html            |   +847 lines
capex-calculator.html      | +1,928 lines
opex-calculator.html       | +1,327 lines
datacenter-solutions.html  |   -612 lines
34 modified files, 13 new files
Total: ~4,979 insertions, 1,116 deletions
```

---

## Session: 2026-02-11 - Geopolitics Article Improvements + Article Date Fixes

### Commit History (newest first)
```
0b23f0b docs: update session notes with all work completed
7e9334f fix: enable scroll on mobile menu when expanded
ca754ea fix: correct LinkedIn URLs in footer sections
271e25d feat: add LinkedIn post for article-13 and update insights
958ddd7 feat: add article-13 cover and infographic images
47851cd docs: add session notes for article-13 work
83c5704 feat: add article-13 cover image SVG
6cb611a feat(article-13): add ultra-comprehensive Data Center Power Distribution Design paper
8447292 feat: improve geopolitics article UX and fix article dates
13d1fcc feat: add Coming Soon badges to placeholder items
```

---

### Commit: `8447292` — feat: improve geopolitics article UX and fix article dates
**Files:** `geopolitics-1.html` (+410 lines), `articles.html` (+54 lines)
**Total diff:** 416 insertions, 48 deletions

#### Phase 1: SEO Optimization (geopolitics-1.html)

1. **Meta Title Optimization**
   - Before: `"The 72-Hour Warning: Why 20+ Nations Are Telling Citizens to Prepare for Crisis | Geopolitical Analysis"` (95 chars)
   - After: `"The 72-Hour Warning: Global Emergency Preparedness Guide 2026"` (58 chars)
   - Google recommends 50-60 chars for optimal SERP display

2. **Meta Description Optimization**
   - Before: `"Comprehensive analysis of the global 72-hour survival guide phenomenon. NEW START expiration, NATO Article 5 concerns, infrastructure sabotage, and why 20+ nations are urging citizen preparedness. Interactive survival kit calculator included."` (234 chars)
   - After: `"Why 20+ nations urge 72-hour preparedness. NEW START expired, NATO concerns, infrastructure attacks. Interactive survival kit calculator included."` (142 chars)
   - Google recommends 120-160 chars

3. **OG & Twitter Meta Tags Updated**
   - `og:title` → shortened to match new title
   - `twitter:title` → `"The 72-Hour Warning: Global Emergency Preparedness Guide 2026"`

4. **FAQ Schema (JSON-LD) Added**
   - 5 FAQ items for Google rich snippets:
     1. "What is the 72-hour rule for emergency preparedness?"
     2. "Why are governments suddenly issuing emergency preparedness guidance?"
     3. "What happened to the NEW START treaty?"
     4. "How much water do I need for a 72-hour emergency kit?"
     5. "Which countries have civil defense shelter systems?"
   - Structured as `FAQPage` schema type

#### Phase 2: Accessibility — WCAG AA Compliance (geopolitics-1.html)

5. **Color Contrast Fixes**
   All color changes improve contrast ratio to meet WCAG AA (4.5:1 minimum):

   | Element | Before | After | Location |
   |---------|--------|-------|----------|
   | `.calc-subtitle` | `#94a3b8` | `#cbd5e1` | Calculator subtitle text |
   | `.calc-input-group label` | `#94a3b8` | `#e2e8f0` | Input field labels |
   | `.result-item .label` | `#94a3b8` | `#cbd5e1` | Result labels |
   | `.result-item .subtext` | `#64748b` | `#94a3b8` | Result subtext |
   | `.checklist-item .qty` | `#94a3b8` | `#cbd5e1` | Checklist quantities |

6. **ARIA Labels Added (10 inputs/selects)**
   All calculator form controls now have descriptive `aria-label` attributes:
   - `#numAdults` → `"Number of adults aged 18 and older"`
   - `#numChildren` → `"Number of children aged 5 to 17"`
   - `#numElderly` → `"Number of elderly aged 65 and older"`
   - `#numInfants` → `"Number of infants aged 0 to 4"`
   - `#numDogs` → `"Number of dogs"`
   - `#dogSize` → `"Average dog size"` (NEW field)
   - `#numCats` → `"Number of cats"`
   - `#numOtherPets` → `"Number of other pets"`
   - `#chronicConditions` → `"Chronic health conditions level"`
   - `#numPrescriptions` → `"Number of prescription medications needed"`
   - `#medicalEquipment` → `"Special medical equipment needs"`
   - `#locationType` → `"Location type"`
   - `#climateZone` → `"Climate zone"`
   - `#durationDays` → `"Preparation duration in days"`
   - `#currencyDisplay` → `"Currency display preference"`

#### Phase 3: Source Citations (geopolitics-1.html)

7. **Inline Source Links Added (7 sources)**
   Replaced vague references with direct hyperlinks:

   | Section | Source | URL |
   |---------|--------|-----|
   | 1.2 NATO Article 5 | SIPRI Military Expenditure Database | sipri.org/databases/milex |
   | 1.4 Baltic Sabotage | Reuters coverage | reuters.com/world/europe/ |
   | 1.5 GPS Jamming table | Eurocontrol Network Manager Reports | eurocontrol.int |
   | 1.5 GPS Jamming table | GPSJAM.org live data | gpsjam.org |
   | 2.1 German Shelter Gap | BBK (Federal Office of Civil Protection) | bbk.bund.de |
   | 2.2 Nordic Model | MSB (Swedish Civil Contingencies Agency) | msb.se |
   | 2.2 Nordic Model | Finnish Ministry of the Interior | intermin.fi/en/rescue-services/preparedness |

8. **Quote Attribution Fix**
   - Before: `"— European Security Analyst, February 2025"`
   - After: `"— Munich Security Report 2025, reflecting widespread European defense community concerns"`

#### Phase 4: Content Enhancement (geopolitics-1.html)

9. **Executive Summary Box (NEW)**
   - Gradient card (`#1e293b` → `#334155`) with star icon
   - 5 color-coded key takeaways:
     - 🔴 NEW START expired Feb 5, 2026 (`#f87171`)
     - 🟡 NATO Article 5 questioned (`#fbbf24`)
     - 🟠 Infrastructure under attack (`#fb923c`)
     - 🟢 20+ nations issuing guidance (`#34d399`)
     - 🔵 Action required — calculator link (`#60a5fa`)
   - Footer: Reading time (30 min), Skip to Calculator link, View Sources link

10. **Section 1.0: Ukraine-Russia Conflict Context (NEW)**
    - New subsection before existing "1.1 NEW START Treaty"
    - Content covers:
      - Modern warfare realities (cities under siege)
      - Energy vulnerability exposure (Russian gas dependence)
      - Largest military buildup since Cold War
      - Proof that conventional war in Europe is possible
    - Warning box: "The Preparedness Driver" explaining why every European nation's guidance references this conflict
    - Transitional paragraph about "if" → "when" shift in European security thinking

11. **Interactive Timeline: The Escalation Path 2022-2026 (NEW)**
    - Visual vertical timeline with color-coded gradient line (green → red)
    - 5 year nodes with distinct colors:
      - **2022** (`#10b981` green): Russia invades Ukraine, Nord Stream sabotaged, Sweden updates guidance
      - **2023** (`#84cc16` lime): Russia suspends NEW START, Finland joins NATO, Balticconnector damaged
      - **2024** (`#f59e0b` amber): Sweden joins NATO, Poland 72-hour law, C-Lion1 cable severed
      - **2025** (`#f97316` orange): NATO policy uncertainty, Munich Security Conference, GPS jamming peaks, Zapad 2025
      - **2026** (`#dc2626` red): NEW START expires Feb 5, this analysis published Feb 9
    - Each node has colored circle, year label, and detail card with border-left accent

12. **Dog Size Selector (Calculator Enhancement)**
    - New `<select id="dogSize">` dropdown added after dog count
    - Options: Small (under 10kg), Medium (10-25kg, default), Large (over 25kg)
    - Tooltip: breed examples + water calculation formula (30-60ml/kg/day)
    - Affects water and food quantity calculations per dog

#### Phase 5: Checklist UX Improvements (geopolitics-1.html)

13. **Checklist CSS Improvements**
    - Added padding `0.5rem 0.75rem` (was `0.5rem 0`)
    - Added `border-radius: 4px`
    - Added `transition: all 0.2s ease`
    - Added `cursor: pointer` (entire row clickable)
    - New `:hover` state: `background: rgba(16, 185, 129, 0.1)`
    - Checkbox size increased: `16px × 16px`
    - Strikethrough on checked items: `text-decoration: line-through; color: #64748b`

14. **Checklist Header & Instructions (NEW)**
    - Header box with green accent (`rgba(16, 185, 129, 0.15)` background, `#10b981` left border)
    - "How to use" instructions text
    - Action buttons row: Check All, Uncheck All, Print Checklist

15. **Progress Tracking Bar (NEW)**
    - Progress bar with dynamic fill
    - Percentage counter text
    - Color transitions: gray (0%) → yellow (50%) → green (100%)
    - Updates on every checkbox change

#### Phase 6: Article Date Fixes (articles.html)

16. **Date Corrections (8 articles)**
    Fixed dates on `articles.html` to match actual `datePublished` in each article file:

    | Article | Title | Before | After |
    |---------|-------|--------|-------|
    | 13 | Data Center Power Distribution Design | Feb 11, 2026 | Feb 15, 2026 |
    | 12 | The Uncomfortable Truth: AI DC Funding Grid | Feb 10, 2026 | Feb 8, 2026 |
    | 11 | AI Data Centers vs Citizen Electricity Bills | Feb 9, 2026 | Feb 8, 2026 |
    | 10 | Water Stress and AI Data Centers | Feb 9, 2026 | Feb 8, 2026 |
    | 8 | Why "No Incident" Is Not Evidence of Safety | Nov 5, 2025 | Nov 2, 2025 |
    | 7 | From Reliability to Resilience | Nov 10, 2025 | Nov 9, 2025 |
    | 5 | Technical Debt in Live Data Centers | Nov 20, 2025 | Nov 16, 2025 |
    | 4 | In-House Capability Is a Reliability Strategy | Nov 25, 2025 | Nov 23, 2025 |

17. **Article 13 Card Added to articles.html**
    - New featured card at top of grid (`grid-column: 1 / -1`)
    - Category: "Technical Paper" (amber badge `#d97706`)
    - Badge: "NEW" (gradient `#f59e0b` → `#d97706`)
    - Title: "Data Center Power Distribution Design: Hyperscaler Architecture Deep Dive"
    - Excerpt: "Ultra-comprehensive 15,000+ word analysis of AWS, Google, Microsoft, xAI Colossus, and Anthropic power systems..."
    - Date: Feb 15, 2026

18. **Article 13 Schema.org Added**
    - New `ListItem` position 13 in `CollectionPage` schema
    - Headline: "Data Center Power Distribution Design: Hyperscaler Architecture Deep Dive"
    - URL: resistancezero.com/article-13.html

19. **Article 12 Badge Updated**
    - Changed from `"NEW"` badge → `"12"` number badge (standard article numbering)

20. **News Ticker Updated**
    - Slot 1: Article 13 (Power Distribution) — 15 Feb 2026
    - Slot 2: Article 12 (Grid Funding) — 08 Feb 2026
    - Slot 3: Article 11 (Electricity Bills) — 08 Feb 2026

---

### Commit: `ca754ea` — fix: correct LinkedIn URLs in footer sections
**Files:** article-13.html, geopolitics.html, insights.html

Fixed incorrect LinkedIn profile links:
- Before: `linkedin.com/in/bfrfranco`
- After: `linkedin.com/in/bagus-dwi-permana-ba90b092`

---

### Commit: `7e9334f` — fix: enable scroll on mobile menu when expanded
Fixed mobile hamburger menu scroll behavior.

---

### Fix: Article 13 Date Correction (this session, uncommitted)
**Files:** `articles.html`, `article-13.html`

Article 13 was incorrectly dated Feb 15, 2026 (a future date). Fixed to Feb 8, 2026:

| Location | File | Before | After |
|----------|------|--------|-------|
| Landing page card | articles.html:607 | Feb 15, 2026 | Feb 8, 2026 |
| News ticker | articles.html:892 | 15 Feb 2026 | 08 Feb 2026 |
| OG published_time | article-13.html:34 | 2026-02-15T00:00:00Z | 2026-02-08T00:00:00Z |
| Schema datePublished | article-13.html:63 | 2026-02-15 | 2026-02-08 |
| Article body date | article-13.html:805 | February 15, 2026 | February 8, 2026 |

---

### File Statistics After Commit `8447292`
```
geopolitics-1.html  — 2,510 lines (was ~2,100)
articles.html       — 916 lines (was ~862)
```

---

## Previous Session: 2026-02-10

## What Was Done This Session

### 1. Dark Mode Toggle Implementation
Added a complete dark mode system across all portfolio pages:

**CSS Changes (styles.css):**
- Added dark mode CSS variables in `[data-theme="dark"]` selector
- New body background variables: `--body-bg`, `--body-color`, `--card-bg`, `--section-alt-bg`
- Dark mode toggle button styles (`.theme-toggle`)
- Comprehensive dark mode overrides for all sections
- Smooth transitions for theme switching

**JavaScript Changes (script.js):**
- Added `initDarkMode()` function
- localStorage persistence for user preference
- System theme detection via `prefers-color-scheme`
- Automatic meta theme-color update for mobile browsers

**HTML Changes (13 files updated):**
- index.html
- articles.html
- article-1.html through article-11.html

**Toggle Button Features:**
- Moon icon (switch to dark mode)
- Sun icon (switch to light mode)
- Accessibility: `aria-label` and `title` attributes
- Responsive: adapts to mobile layout
- Persists across page navigation

### 2. Lazy Loading for Images
Added `loading="lazy"` to all below-the-fold images for performance:

**Files Updated:**
- article-1.html through article-11.html (author bio images)
- article-10.html, article-11.html (infographic images)

**Images Kept Eager Loading:**
- Hero image in index.html (above the fold, has `fetchpriority="high"`)

### 3. Mobile Responsiveness Verification
Conducted comprehensive mobile audit with **92/100 score**:

**Verified Components:**
- Breakpoints: 480px, 768px, 1024px, 1400px, 2000px
- Touch targets: All interactive elements 44px+
- No horizontal scroll issues
- Base font size: 16px
- Hamburger menu: Fully functional
- Images: Responsive with lazy loading
- Grid/Flex layouts: Properly adaptive

**Performance Optimizations (already in place):**
- Particles disabled on mobile
- Cursor spotlight disabled on mobile
- Floating shapes disabled on mobile
- Flow lines simplified on mobile

## Key Files Modified
```
C:\Users\User\Sandbox\
├── styles.css        (+180 lines - dark mode CSS)
├── script.js         (+45 lines - dark mode JS)
├── index.html        (+15 lines - dark mode toggle button)
├── articles.html     (+15 lines - dark mode toggle button)
├── article-1.html    (+15 lines toggle + lazy loading)
├── article-2.html    (+15 lines toggle + lazy loading)
├── article-3.html    (+15 lines toggle + lazy loading)
├── article-4.html    (+15 lines toggle + lazy loading)
├── article-5.html    (+15 lines toggle + lazy loading)
├── article-6.html    (+15 lines toggle + lazy loading)
├── article-7.html    (+15 lines toggle + lazy loading)
├── article-8.html    (+15 lines toggle + lazy loading)
├── article-9.html    (+15 lines toggle + lazy loading)
├── article-10.html   (+15 lines toggle + lazy loading)
└── article-11.html   (+15 lines toggle + lazy loading)
```

## How to Test Dark Mode
1. Open any page in browser
2. Click the moon/sun icon in the navbar (next to hamburger menu)
3. Theme persists across page navigation
4. Respects system preference on first visit

## Recent Commits (Previous Session)
```
7841cb0 fix(dashboards): improve mobile responsiveness and navigation consistency
ed9a20d feat(seo): comprehensive SEO optimization for perfect 100 score
1393136 fix(articles): remove redundant instruction text
0a5f4c8 fix(articles): move philosophy & framework sections below articles
6528c0e feat(article-11): add AI Data Centers vs Electricity Bills article
```

## How to Continue
```bash
cd /c/Users/User/Sandbox
git status
git add -A
git commit -m "feat: add dark mode toggle with localStorage persistence"
git push
```

## Completed Tasks (This Session)
- [x] Add dark mode toggle
- [x] Implement lazy loading for images
- [x] Mobile responsiveness verification (92/100 score)
- [x] **Article 12 Created** - "The Uncomfortable Truth: How AI Data Centers Are Secretly Funding Your Grid's Future"
  - 180-degree devil's advocate perspective from Article 11
  - Deep research covering: Big Tech renewables ($57B+), grid economics, load factor, PUE efficiency
  - **Interactive Calculator Features:**
    - Multi-tab configuration (Basic, Advanced, Scenario Compare)
    - Country-specific data (10 regions: SEA + US + EU)
    - DC Type selection (Hyperscale, Colocation, Enterprise, AI/HPC)
    - PUE configuration with efficiency comparison visualization
    - Renewable target options (100% 24/7 CFE, Annual Match, 80%, 50%, Grid)
    - Demand response participation modeling
    - Economic impact: CAPEX, OPEX, Energy Cost, Tax Revenue, Jobs
    - Grid value: PPA capacity, Grid surplus ($33,500/MW), Load factor benefit
    - Environmental: CO2 emissions, avoided emissions, tree equivalents
    - Visual comparisons: Economic multiplier bars, Load factor circles, PUE bars
- [x] Updated articles.html with Article 12 listing and Schema.org data
- [x] Updated news ticker with Article 12

---

## Session: 2026-02-17 (Cont. #6) — CSS Consistency Final + Dark Mode + Admin Login + PDF Fix

### Summary
Continued comprehensive CSS consistency audit and dark mode fixes. Fixed admin login UI/UX, auth.js modal transparency, PDF export for articles 9 & 10, and standardized font sizes across all 17 articles to match article-15 gold standard.

### Completed Work

#### A. Admin Console Login Redesign (rz-ops-p7x3k9m.html)
- Professional login form with glassmorphism card, animated background (grid + conic gradient + floating orbs)
- Show/hide password toggle, Remember Me checkbox, Forgot Password link
- Email validation, loading state with spinner, error shake animation
- Credentials: `bagus@resistancezero.com` / `admin@resistancezero.com` with `RZ@Premium2026!`
- Demo account (demo@resistancezero.com) visible in data but CANNOT login to admin
- Logo: Favicon.png instead of RZ text box
- Fixed checkbox garbled text (`\\2713` → `\2713`)

#### B. Auth.js Modal Transparency Fix
- Overlay opacity 0.6→0.75, blur 4px→8px
- Modal bg: gradient → solid `#0f172a`, inputs solid `#1e293b`
- Light theme modal: solid `#ffffff`

#### C. PDF Export Fix (Articles 9 & 10)
- Both used broken Blob URL pattern → fixed to window.open('','_blank') + document.write
- window.open MUST be called before computation (popup blocker prevention)

#### D. Comprehensive CSS Consistency (All 17 Articles)
Gold standard (article-15): body 0.95rem, line-height 1.7, h2 1.4rem, h3 1.1rem
- **Article 10** (biggest outlier): body 1.125→0.95, h2 1.75→1.4, h3 1.375→1.1, h2 color→#1e3a5f
- **Articles 1-9, 11-14, 16-17**: body 0.9→0.95, h2 1.35→1.4, h3 1.05→1.1
- **Dark mode h2 color**: 8 articles fixed (#f1f5f9 → #93c5fd): 1, 3, 5, 6, 8, 12, 13, 14
- **Dark mode callout boxes**: Added overrides to articles 9, 10, 11, 16
- **Article 16**: Added comprehensive dark mode content rules (was almost entirely missing)

### PENDING (Not Yet Done)
- **Article 7**: Missing dark mode content rules for `.article-body h2`, `h3`, `p`, `strong`, `a`, `ul li`, `ol li`
  - Has partial dark mode (info-box, key-insight, blockquote, comparison-card) but no text color overrides
  - Add after line 155 (after blockquote dark rule)
- **Article 17**: Almost no dark mode support — only has `[data-theme="dark"] .toc-item.toc-calculator`
  - Needs full dark mode content block before `/* Responsive */` at line 961
  - Include: article-content bg, h2 #93c5fd, h3 #cbd5e1, p, blockquote, info-box, highlight-box, warning-box, result-box, references, table, ul li, ol li, a, strong
- **Verify articles 2 & 4**: Check dark mode callout box support

### Files Modified This Session
```
rz-ops-p7x3k9m.html  | Complete login redesign + credential update
auth.js               | Modal transparency fix (solid backgrounds)
article-9.html        | PDF fix + font alignment + dark mode fixes
article-10.html       | PDF fix + comprehensive CSS overhaul + dark mode
article-1.html        | Font alignment + dark h2 color fix
article-2.html        | Font alignment
article-3.html        | Font alignment + dark h2 color fix
article-4.html        | Font alignment
article-5.html        | Font alignment + dark h2 color fix
article-6.html        | Font alignment + dark h2 color fix
article-7.html        | Font alignment (dark mode PENDING)
article-8.html        | Font alignment + dark h2 color fix
article-11.html       | Font alignment + dark mode callout boxes
article-12.html       | Font alignment + dark h2 color fix
article-13.html       | Font alignment + dark h2 color fix + 4 tooltips added
article-14.html       | Font alignment + dark h2 color fix
article-15.html       | 6 filter tooltips added
article-16.html       | Font alignment + full dark mode content rules added
article-17.html       | Font alignment (dark mode PENDING)
```

---

## Session: 2026-02-16 (Cont. #5) — Articles 12-15 Pro Mode + Dashboard

### Summary
Implemented Pro Enhancement Mode for articles 12, 13, 14, 15. Created dashboard.html page.

### Completed Work
- **Article 12**: Full Pro Mode with Strategic Intelligence Engine, 4 panels, Monte Carlo, PDF export
- **Article 13**: Full Pro Mode with AI Power Grid Analyzer, 4 panels, Monte Carlo, PDF export
- **Article 14**: Full Pro Mode with Risk Assessment Engine, 4 panels, Monte Carlo, PDF export
- **Article 15**: Full Pro Mode with Contract Intelligence Engine, 4 panels, Monte Carlo, PDF export
- **Dashboard.html**: User dashboard page with project management, export tracking

---

## Session: 2026-02-16 (Cont. #4) — Cross-Article Consistency + Pro Mode + SEO + Tooltips

### Summary
Massive cross-article standardization session: TOC consistency, Pro Mode implementations (articles 9, 10, 11), SEO audit fixes, author bio standardization, newsletter/related articles/share buttons, dark mode fixes, tooltip bugs, PDF optimization, and standardization doc updates.

### Completed Work

#### A. TOC Consistency Fix
- Added global `.toc-section` CSS to styles.css (articles 9, 10, 11 had HTML but no CSS)
- TOC calculator badges added to articles 9, 10, 11, 12

#### B. Pro Mode Implementations
- **Article 11**: Full Strategic Intelligence Engine from scratch (+1,508 lines)
  - 6 strategic inputs, 4 Pro panels, Monte Carlo 10K, PDF export
  - CSS prefix `.eeq-`, amber theme
  - Pro CTA teaser block added
- **Article 9**: Enhanced Pro Mode (+818 lines)
  - 8-region data expanded with 7 new fields per region
  - 4 panels upgraded with additional KPIs
  - Narrative rewritten to 4 structured paragraphs
- **Article 10**: Enhanced Pro Mode (+833 lines)
  - New Panel 5: Dedicated AI-Generated Narrative
  - 8-region data expanded with 6 new fields
  - New tornado sensitivity chart

#### C. Cross-Article Standardization
- Author bio Pattern A applied to articles 2, 4, 5, 6, 7, 8, 11, 12, 14, 15
- Newsletter signup added to articles 1-8, 11-13, 15
- Related articles/Continue Reading to articles 1-8, 11, 12, 13, 15
- Share buttons to articles 13, 15
- Articles 16, 17 fully standardized
- Prev/next nav to articles 3, 7
- Dark mode fixes for articles 1, 3, 5, 6, 8, 9, 10, 11, 12, 13, 14

#### D. SEO Audit Fixes
- og:image:alt + twitter:image:alt on all pages
- Skip navigation links (`#main-content`) on all pages
- `<main id="main-content">` landmark on all pages
- Hero image preload (`<link rel="preload">`) on all articles
- Title tag optimization for all pages

#### E. Article 3 Tooltip Bug Fixes
- Added missing `#maint-tooltip-container` div to DOM
- Fixed JS mechanism: `classList.add('visible')` instead of `style.display`
- Broadened JS selector from `#section-12` to global `.tooltip-trigger`
- Added wrench time term-tooltip

#### F. Standardization Doc Updates
- TOOLTIP_STANDARD.md v1.2: Added term-tooltip system, bug history (BUG-001 through BUG-004), pre-deployment checklist, article 11 entry
- PDF_EXPORT_STANDARD.md v1.1: Added white space minimization rules, side-by-side chart layout pattern, KPI grid layout, compact spacing rules, pre-deployment checklist, article 11 entry

#### G. PDF Layout Optimization (Partial — agent hit rate limit)
- Article 2: Full side-by-side optimization applied (config+KPIs, narratives, 6-col KPI grid)
- Remaining articles: Standardization rules documented for future application

### Files Changed (36 files, +4,095 / -722)

## Pending/Future Tasks
- Commit and push changes to GitHub
- Apply PDF side-by-side optimization to remaining articles (1, 4, 5, 6, 7, 8, 9, 10, 11, 15)
- Test dark mode on actual mobile devices
- Consider adding dark mode to dashboard pages (datahallAI.html, dc-conventional.html, etc.)
- Create cover image for Article 12 (assets/article-12-cover.jpg)

## Notes
- User prefers Indonesian language for communication
- Dark mode uses localStorage key: `theme`
- System preference detected via `prefers-color-scheme: dark`
- All pages share the same script.js for consistent dark mode behavior
