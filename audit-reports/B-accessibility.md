# Audit Report B — Accessibility (a11y)
Generated: 2026-05-09
Total items: 119
Severity: HIGH=18, MED=68, LOW=33

---

## B1 — Image alt text gaps

- [MED] index.html:1039 — `<img src="Article/badges/High Voltage Authorized Person.webp"` has no `alt=` attribute; badge images are content and need descriptive alt text
- [MED] index.html:1045 — `<img src="Article/badges/Low Voltage Authorized Person.webp"` has no `alt=` attribute
- [MED] index.html:1051 — `<img src="Article/badges/Senior Authorized Person.webp"` has no `alt=` attribute
- [LOW] article-25.html:2469 — JS-generated `<img src="canvas.toDataURL(...)">` emitted into print HTML with no `alt=`; screen readers reading exported reports see blank content
- [LOW] article-1.html:3911 — JS template generates `<input type="range">` inside a `<div>` with no alt concern on the image side, but the dynamically-built weight-row omits any visible label text accessible to AT (the label text is only in a sibling div with no `for=` binding)
- [MED] (global pattern — 29 files) All pages use `var imgHtml = item.image ? '<img class="search-preview-img" src="..." alt="">` for search result previews — the `alt=""` marks them as decorative but they show article thumbnails that carry meaning; should have descriptive alt text pulled from the article title. Affected: article-1 through article-27, articles.html, datacenter-solutions.html, geopolitics-1/2/3.html, FF-1.html, index.html, insights.html, geopolitics.html (29 files, one pattern each)

---

## B2 — Heading hierarchy violations

- [HIGH] article-1.html — two `<h1>` tags: the article title (line 1594) and a PDF report `<h1>` injected into `window.open()` HTML (line 4509). The live page renders two H1 in the DOM.
- [HIGH] article-2.html — two `<h1>` tags (same pattern as article-1: article title + PDF export template)
- [HIGH] article-4.html — two `<h1>` tags
- [HIGH] article-6.html — two `<h1>` tags
- [HIGH] article-7.html through article-27.html — two `<h1>` tags each (articles 10–18, 20, 22, 24–27); 17 additional pages share this same dual-H1 pattern
- [MED] cx-calculator.html — four `<h1>` tags: one live page heading (line 634) plus three inside JS-generated print-window HTML strings (lines 3725, 3881, 4208). Three of the four are inside `window.open()` templates and do not appear on the live page; however the live page still has one H1 that is correct.
- [HIGH] rz-ops-p7x3k9m.html — 13 `<h1>` tags; admin panel uses H1 as visual section styling throughout rather than actual document structure
- [MED] rfs-readiness-workbench.html — four `<h1>` tags (one live, three in PDF export strings)
- [MED] ltc-system-modelling-lab.html — four `<h1>` tags (one live at line 4085, three in PDF export strings)
- [MED] article-14.html:1548 — `<h3>` appears at line 1548 before the first `<h2>` at line 1563; skips H2 level
- [MED] article-18.html:1422 — `<h3>` at line 1422 before first `<h2>` at line 1438; heading level skipped
- [MED] asean-dc-report-2026.html:338 — `<h3>` at line 338 before first `<h2>` at line 355
- [MED] capex-calculator.html — `<h3>` appears at line 1197 while the first `<h2>` is at line 3413 (deep in PDF content); the live interactive form section uses H3 without a parent H2
- [MED] carbon-footprint.html — `<h3>` at line 649 before first `<h2>` at line 2469 (H2 is inside PDF template, not the live UI)
- [MED] pue-calculator.html — `<h3>` at line 539 before first `<h2>` at line 2073 (H2 is inside PDF print template)
- [MED] roi-calculator.html — `<h3>` at line 608 before first `<h2>` at line 1919
- [MED] tco-calculator.html — `<h3>` at line 2160 before first `<h2>` at line 4456
- [MED] tia-942-checklist.html — `<h3>` at line 441 before first `<h2>` at line 1617
- [MED] tier-advisor.html — `<h3>` at line 343 before first `<h2>` at line 1517
- [LOW] changelog.html — has `<h3>` elements but no `<h2>` anywhere in the document
- [LOW] chiller-plant.html — has `<h3>` but no `<h2>`
- [LOW] datahall.html — has `<h3>` but no `<h2>`
- [LOW] fire-system.html — has `<h3>` but no `<h2>`
- [LOW] water-system.html — has `<h3>` but no `<h2>`
- [LOW] chiller-plant.html, datahall.html, fire-system.html, future-forward-1.html, ict.html — no `<h1>` at all; these simulation/SCADA pages lack a top-level document heading

---

## B3 — Form accessibility

**Login modal inputs (no label for= binding — pattern across all article/calculator login overlays):**
- [HIGH] article-6.html:2324–2325 — `#rcaLoginEmail` and `#rcaLoginPass` inputs have no `<label for="rcaLoginEmail">` or `aria-label`; rely only on `placeholder=` text which is not accessible to all AT
- [HIGH] article-16.html:2690–2691 — `#bubLoginEmail` / `#bubLoginPass` without label association
- [HIGH] article-22.html:1491–1492 — `#a22LoginEmail` / `#a22LoginPass` without label association
- [HIGH] article-15.html:3350–3351 — `#mclLoginEmail` / `#mclLoginPass` without label association
- [HIGH] article-18.html:2088–2089 — `#aifLoginEmail` / `#aifLoginPass` without label association
- [HIGH] article-20.html:3129–3130 — `#wcLoginEmail` / `#wcLoginPass` without label association
- [HIGH] article-17.html:2578–2579 — `#seaLoginEmail` / `#seaLoginPass` without label association
- [HIGH] article-3.html:2724–2728 — `#maintLoginEmail` / `#maintLoginPass` without label association
- [HIGH] article-27.html:1463–1464 — `#wsLoginEmail` / `#wsLoginPass` without label association
- [HIGH] article-2.html:2647–2651 — `#alarmLoginEmail` / `#alarmLoginPassword` without label association
- [HIGH] article-26.html:1352–1353 — `#pfasLoginEmail` / `#pfasLoginPass` without label association
- [HIGH] article-25.html:1485–1486 — `#pjmLoginEmail` / `#pjmLoginPass` without label association
- [MED] carbon-footprint.html:1327–1328 — `#loginEmail` / `#loginPassword` have no `<label for="loginEmail">`
- [MED] tier-advisor.html:752–756 — `#loginEmail` / `#loginPassword` have no `<label for="loginEmail">`
- [MED] capex-calculator.html:1206–1210 — `#loginEmail` / `#loginPassword` have no `<label for="loginEmail">`
- [MED] pue-calculator.html:999–1003 — `#loginEmail` / `#loginPassword` have no `<label for="loginEmail">`; the visual `<label>` elements above the inputs lack `for=` attribute
- [MED] tia-942-checklist.html:650–654 — `#loginEmail` / `#loginPassword` without label binding
- [MED] roi-calculator.html:1002–1003 — `#loginEmail` / `#loginPassword` without label binding
- [MED] article-4.html:2252–2253 — `#loginEmail` / `#loginPass` (class="login-input") without label binding

**Calculator form labels missing `for=` attribute (visual proximity only):**
- [MED] pue-calculator.html:600–844 — all `<label class="input-label">` elements throughout the calculator are not bound to their `<input>`/`<select>` via `for=` attribute; screen readers cannot associate them. Affects ~20 input groups (itLoad, rackDensity, rackCount, coolingType, containment, climateZone, upsType, redundancy, lighting, security, fire, economizer, supplyTemp, transformerLoss, loadGrowth, greenGridLevel, ashraeClass, energyCost, utilization, upsLoadFactor)
- [MED] capex-calculator.html:1404–1766 — same pattern; `<select>` elements (buildingType, seismicZone, fireType, alarmType, upsType, genType, locationFactor, cityMarket, projYear, substationType) have preceding visual labels but no `for=` binding

**Range inputs without aria-label or label binding:**
- [MED] article-3.html:2253 — `#frictionSlider` range input; label text exists visually but no `for=` or `aria-label`
- [MED] article-3.html:2265 — `#evidenceSlider` range input; same issue
- [MED] article-2.html:2158 — `#shelvingPct` range input; no label association
- [MED] article-8.html:1894 — `#driftSlider` range input; no label association
- [MED] article-8.html:1899 — `#suppressionSlider` range input; no label association
- [MED] article-9.html:2611 — `#loadSlider` no label association
- [MED] article-9.html:2617 — `#rateSlider` no label association
- [MED] article-14.html:2562 — `#msfRiskAppetite` range input; no `aria-label`
- [MED] article-17.html:2362 — `#seaInJevons` range; no aria-label
- [MED] article-17.html:2370 — `#seaInSovereign` range; no aria-label
- [MED] article-17.html:2378 — `#seaInAlloc` range; no aria-label
- [MED] article-4.html:1964 — `#skillSlider` no label association
- [MED] article-5.html:2112 — `#ageSlider` no label association
- [MED] article-5.html:2118 — `#debtSlider` no label association
- [MED] article-5.html:2210 — `#calcCritical` no label association
- [MED] article-5.html:2217 — `#calcMajor` no label association
- [MED] article-6.html:1953 — `#authSlider` no label association
- [MED] article-10.html:1630 — `#powerSlider` no label association
- [MED] article-10.html:1643 — `#pueSlider` no label association
- [MED] infographic-pue-global.html:827 — `#pueSlider` range; no aria-label
- [MED] FF-3.html:2176 — `#iecLatency` range; no aria-label
- [MED] FF-3.html:2260 — `#iecGrowthRate` range; no aria-label

**Newsletter email inputs without labels:**
- [MED] article-1.html:3088 — `<input type="email" placeholder="Enter your email">` in newsletter form; no `<label>` or `aria-label`
- [MED] article-2.html:2532 — same pattern; newsletter email input without label
- [MED] article-3.html:2601 — newsletter email input without label
- [MED] article-6.html:2468 — newsletter email input without label
- [MED] article-8.html:2414 — newsletter email input without label
- [MED] article-9.html:2946 — newsletter email input without label
- [MED] article-12.html:2776 — newsletter email input without label
- [MED] article-13.html:4187 — newsletter email input without label
- [MED] article-14.html:2882 — newsletter email input without label
- [MED] article-15.html:2523 — newsletter email input without label
- [MED] article-16.html:2309 — newsletter email input without label
- [MED] article-19.html:990 — newsletter email input without label

**Search inputs without aria-label:**
- [MED] article-10.html:1042 — `#searchInput` `<input type="text" class="search-input">` has no `aria-label`; the search icon is a decorative SVG beside it but no accessible label is provided
- [MED] (same pattern — all article pages with searchInput) — article-11 through article-27, articles.html, geopolitics series, FF series: all `#searchInput` instances lack `aria-label="Search"`. Approximately 25 pages.

**Form error announcement:**
- [HIGH] All login forms across article pages and calculator pages — login error messages (incorrect password etc.) are shown via DOM text but none use `role="alert"` or `aria-live="assertive"` to announce the error to screen readers. Zero pages have this pattern in login context.

---

## B4 — ARIA misuse

- [MED] index.html:1606 — `<a href="..." class="ticker-item" aria-hidden="true">` — ticker items are anchor links with `aria-hidden="true"`, making them invisible to AT but still keyboard-focusable (they're in the tab order). This creates ghost focus stops for keyboard users. Duplicate ticker items are rendered for visual effect; if they are truly duplicates the focusable anchor should also have `tabindex="-1"`.
- [MED] index.html:1635 — same issue: `<a href="articles.html" class="ticker-item" aria-hidden="true">` is focusable but hidden from AT
- [MED] rz-ops-p7x3k9m.html:776 — `<button class="hamburger" onclick="toggleSidebar()">` has no `aria-label` and no `aria-expanded`; screen readers announce it as just "button"
- [MED] tier-advisor.html:327 — `<button class="hamburger" id="hamburgerBtn" onclick="toggleMobileMenu()">` has no `aria-label` and no `aria-expanded`
- [MED] dc-conventional.html:824 — `<button class="theme-toggle" id="themeToggle" title="Toggle theme">` uses only `title=`; `title` is unreliable for AT; needs `aria-label`
- [MED] datahallAI.html:430 — `<button class="theme-toggle" id="themeToggle" title="Toggle theme">` only has `title=`; same issue
- [MED] tier-advisor.html:309 — `<button class="theme-toggle" onclick="toggleTheme()" title="Toggle dark mode">` — has `title=` but no `aria-label`
- [MED] rz-ops-p7x3k9m.html:781 — `<button class="theme-toggle-btn" onclick="toggleAdminTheme()" title="Toggle theme">` — title only, no aria-label
- [MED] (all calc pages) `<button class="nav-user-btn" id="navUserBtn" onclick="toggleUserDropdown()">` — present in pue-calculator.html:503, capex-calculator.html:1119, tco-calculator.html:2083, roi-calculator.html:578, carbon-footprint.html:618, dc-market-tracker.html:675, tia-942-checklist.html:409 — all lack `aria-label` and `aria-expanded`
- [MED] rz-ops-p7x3k9m.html:1348–1366 — five `<button class="modal-close" ...>&times;</button>` buttons have no `aria-label`; screen readers announce "times" or "×" as the button name
- [MED] datahall.html:396 — `<span class="close-modal" onclick="closeModal()">×</span>` — interactive close element is a `<span>` not a `<button>`, and has no `aria-label`, no `role="button"`, no `tabindex`
- [MED] ltc-ansi-tia-topology-readiness.html:646–1006 — multiple `<div class="comparison-card" onclick="this.classList.toggle('expanded')">` elements — no `role="button"`, no `tabindex="0"`, no `aria-expanded`; keyboard users and AT cannot interact with them
- [MED] ltc-uptime-tier-alignment.html:775–780 — same `<div class="comparison-card" onclick="...toggle('expanded')">` pattern without role/tabindex/aria-expanded
- [MED] ltc-ashrae-thermal-control.html:1811–1826 — four more comparison-card divs with onclick but no keyboard accessibility
- [LOW] datahall.html:540 — `<div class="toggle-sw toggle-active" onclick="toggleUnit('${id}')">` generated toggle switches have no `role="switch"`, no `aria-checked`, no `tabindex`

**Missing aria-label on nav landmarks:**
- [MED] (site-wide pattern) The vast majority of `<nav class="navbar">` elements have no `aria-label`. When a page has multiple nav elements (e.g., ltc-ansi-tia-topology-readiness.html has both `.navbar` and `.section-nav`), AT users cannot distinguish them. Affects: article-11.html, article-18.html, article-24.html, article-5.html, asean-dc-report-2026.html, compare-diesel-vs-gas-generator.html, compare-wet-vs-preaction.html, dc-market-tracker.html, ltc-ansi-tia-topology-readiness.html (2 navs), pillar-cooling.html, roi-calculator.html, tools.html, and ~20 more pages

---

## B5 — Color contrast

- [MED] styles.css:1108 — `.bento-tag { color: #6b7280 }` — on the dark theme background `#0f172a` (L≈0.027), `#6b7280` (L≈0.178) yields contrast ratio ≈ 2.96:1, below WCAG AA minimum 4.5:1 for normal text
- [MED] styles.css:1418 — `.bento-exp-desc { color: #6b7280 }` — same contrast failure in dark mode
- [MED] styles.css:1423 — `[data-theme="dark"] .bento-exp-desc { color: #64748b }` — `#64748b` on `#0f172a` ≈ 2.96:1 contrast; explicit dark-mode override still fails
- [MED] styles.css:4414 — `[data-theme="dark"] .stat-before { color: #64748b }` — dark theme override with `#64748b`; fails AA contrast
- [MED] styles.css:5612 — `.search-kbd { color: #6b7280 }` — keyboard hint badges likely on light backgrounds (borderline) but in dark mode fails
- [MED] styles.css:5834 — filter chip/pill `color: #6b7280` — contrast risk on mid-dark backgrounds
- [MED] article-22.html:386 — `.a22-company-card p { color: #6b7280 }` — card body text on what is likely a dark card background; contrast insufficient
- [MED] article-22.html:395 — `.a22-company-card .a22-deal-stat span:first-child { color: #6b7280 }` — same
- [MED] article-23.html:457 — `.col-card p { color: #6b7280 }` — same pattern on dark card
- [MED] article-23.html:466 — `.col-card .col-card-stat span:first-child { color: #6b7280 }` — same
- [LOW] styles.css:4751,4757,4832,4857 — `color: #94a3b8` on `#1e293b` background — `#94a3b8` (L≈0.374) on `#1e293b` (L≈0.031) ≈ 5.3:1 — passes AA but fails AAA (7:1); acceptable for non-UI text but marginal for small text at 0.72rem
- [LOW] Multiple article inline styles: `color: #64748b` used in article-2.html PDF export templates at `font-size: 8-11px` — print output fails AA at those sizes (need 4.5:1, get ~2.96:1)

---

## B6 — Keyboard navigation

- [HIGH] All gate/login overlay divs (article-12.html:2410–2495, article-6.html:2233–2280, article-14.html:2572–2777, article-20.html:1531–1705, article-8.html:2181–2221, article-16.html:2178–2217) — `<div class="*-gate-overlay" onclick="showLogin()">` elements have no `tabindex`, no `role="button"`, no `aria-label`; keyboard users cannot activate them at all
- [HIGH] article-20.html — login modal has no Escape key handler (confirmed by grep); pressing Escape does not close the overlay, creating a focus trap
- [HIGH] article-22.html — same: login modal has no Escape key handler
- [MED] datahall.html — modal `#unitModal` has no `role="dialog"`, no `aria-modal`, no `aria-labelledby`; focus is not trapped inside it, allowing keyboard users to navigate behind the modal
- [MED] rz-ops-p7x3k9m.html:1346–1366 — four modal overlays (`dcOperatorModal`, `dcCountryPanel`, `dcCompareModal`, `dcChartFullscreen`) have no `role="dialog"`, no `aria-modal`, no `aria-labelledby`
- [MED] capex-calculator.html:2185–2240 — `<div class="per-kw-display" onclick="handlePremiumTab()">` and `<span class="gated-badge" onclick="...">` and `<div class="free-watermark" onclick="...">` — interactive divs/spans with onclick but no keyboard access (no tabindex, no role="button")
- [MED] tia-942-checklist.html:904 — checklist categories are built as `<div class="cat-header" onclick="toggleCat(this)">` inside JS-generated HTML; no tabindex, no role="button", no aria-expanded
- [LOW] EPMS_Telemetry.html:426 — `<div class="btn active" id="btn-u-a" onclick="toggleSource('A')">` — interactive div with no tabindex or role

---

## B7 — Touch target sizing

- [MED] rz-ops-p7x3k9m.html:1348–1366 — modal close buttons `&times;` are typically rendered at ~24×24px; no explicit min-height/min-width or padding to reach 44×44px is set in the local inline styles; styles.css has no `.modal-close` rule
- [MED] datahall.html:396 — `<span class="close-modal">×</span>` is a `<span>` used as close; typically renders at ~20×20px with no sizing guarantees
- [MED] article-6.html:2321, article-16.html:2687 — `.rca-login-close` / `.bub-login-close` are `<button>` elements containing only `&times;`; their CSS does not enforce 44×44px minimum
- [LOW] Various article pages — `.nav-user-btn` has `padding: 6px 12px 6px 6px`; the total clickable height is ~32px, below the 44px guideline on mobile
- [LOW] styles.css search-kbd badges — `padding: 2px 6px`; keyboard shortcut hints are not interactive but their very small size (≈24px height) could be an issue if they double as buttons in any context

---

## B8 — Semantic HTML

- [MED] 404.html — uses `<div class="footer">` instead of semantic `<footer>` element
- [MED] rz-ops-p7x3k9m.html — uses `<div class="footer">` instead of `<footer>` element
- [MED] achievements.html — site navbar is wrapped in a `<div class="nav-container">` but there is no `<header>` wrapping element; the global navigation is not inside a `<header>` landmark
- [MED] (pattern — ~35+ pages) The following pages all have `<nav class="navbar">` but no enclosing `<header>` element: article-1 through article-27 (27 pages), articles.html, asean-dc-report-2026.html, capex-calculator.html, carbon-footprint.html, changelog.html, compare-* pages (~8 pages). Without a `<header>` landmark, screen reader users navigating by landmarks cannot jump directly to site navigation.
- [LOW] article-18.html — page has two `<main>` elements (confirmed by grep), violating the one-main-per-page rule
- [LOW] Multiple pages — footer sections use `<div class="footer-grid">`, `<div class="footer-brand">`, `<div class="footer-nav">` inside `<footer>` — the inner `<div class="footer-nav">` should be a `<nav aria-label="Footer navigation">` for semantic correctness

---

## B9 — `prefers-reduced-motion` not honoured

- [MED] datahallAI.html — 17 `@keyframes` animations (flow lines, pulse effects, rotation, particle emissions) with zero `@media (prefers-reduced-motion: reduce)` guards. This is a live dashboard shown to all users with no opt-out.
- [MED] datahall.html — 9 `@keyframes` animations; zero reduced-motion guards
- [MED] fire-system.html — 4 `@keyframes`; zero reduced-motion guards
- [MED] fuel-system.html — 5 `@keyframes`; zero reduced-motion guards
- [MED] ict.html — 5 `@keyframes`; zero reduced-motion guards
- [MED] rz-ops-p7x3k9m.html — 8 `@keyframes`; zero reduced-motion guards
- [MED] tco-calculator.html — 5 `@keyframes`; zero reduced-motion guards
- [LOW] achievements.html — 3 `@keyframes`; zero reduced-motion guards
- [LOW] capex-calculator.html — 3 `@keyframes`; zero reduced-motion guards
- [LOW] chiller-plant.html — 3 `@keyframes`; zero reduced-motion guards
- [LOW] cx-calculator.html — 3 `@keyframes`; zero reduced-motion guards
- [LOW] dc-market-tracker.html — 3 `@keyframes`; zero reduced-motion guards
- [LOW] ltc-system-modelling-lab.html — 3 `@keyframes`; zero reduced-motion guards
- [MED] styles.css — 34 `@keyframes` defined globally, but only 5 `prefers-reduced-motion` blocks; the scroll-down arrow, floating share column, and hero entrance animations have no reduced-motion guard (the ticker animation is correctly guarded at line 6467)
- [LOW] index.html — ticker animation CSS is inherited from styles.css and IS guarded; however JS-driven `setInterval` counter animations (162 `setInterval` calls site-wide) have no reduced-motion check via `matchMedia('(prefers-reduced-motion: reduce)')` before starting

---

## B10 — Language declaration

- [LOW] All 103 HTML pages use `lang="en"` — this is appropriate for the primary English content on the site
- [LOW] terms.html — mentions "Bahasa Indonesia" as a dispute resolution language but the page itself is English; no `lang=` override on the Indonesian phrase span; low severity as it's a proper noun
- [LOW] 16 PDF export templates in JS strings (article-1, article-3, article-7, article-9, article-13, article-16, article-17, article-20 ×3, article-22, article-25, article-26, carbon-footprint, FF-1, pue-calculator, tia-942-checklist) use `<!DOCTYPE html><html>` without `lang=` on the inner generated document, so exported PDFs/print windows have no language declaration

---

## B11 — Tables without `scope=`

- [HIGH] (site-wide) Every single HTML file with data tables — 75 files totalling hundreds of tables — has `<th>` elements but **zero** `scope=` attributes anywhere in the codebase. `scope="col"` or `scope="row"` is required for screen readers to correctly associate headers with data cells. The most complex cases:
  - article-13.html: 27 tables, 141 `<th>` elements, 0 scope
  - opex-calculator.html: 56 tables, 73 `<th>` elements, 0 scope
  - ltc-system-modelling-lab.html: 48 tables, 83 `<th>` elements, 0 scope
  - capex-calculator.html: 46 tables, 45 `<th>` elements, 0 scope
  - rz-ops-p7x3k9m.html: 25 tables, 53 `<th>` elements, 0 scope
  - rfs-readiness-workbench.html: 24 tables, 70 `<th>` elements, 0 scope
- [HIGH] carbon-footprint.html — 1 table with **no `<th>` at all** (line ~2470): data is presented in a `<table>` using only `<td>` elements; no column or row headers for AT navigation

---

## B12 — Skip-link

- [HIGH] (49 pages) The following pages have no skip-link at all:
  - article-18 through article-27 (10 pages)
  - carbon-footprint.html, changelog.html, chiller-plant.html
  - compare-diesel-vs-gas-generator.html, compare-n1-vs-2n.html, compare-raised-floor-vs-slab.html, compare-ups-online-vs-offline.html, compare-wet-vs-preaction.html
  - cx-calculator.html, dashboard.html, datahall.html, dc-conventional.html, dc-market-tracker.html
  - EPMS_Telemetry.html, fire-system.html, fuel-system.html, future-forward-1.html
  - google1b98e0817bd5aa88.html, ict.html
  - ltc-ansi-tia-topology-readiness.html, ltc-ashrae-thermal-control.html, ltc-iso-energy-governance.html, ltc-nfpa-fire-risk.html, ltc-system-modelling-lab.html, ltc-uptime-tier-alignment.html
  - pln-java-grid*.html (6 pages), privacy.html, pue-calculator.html, roi-calculator.html
  - rz-ops-p7x3k9m.html, standards-ltc-lab.html, terms.html, tia-942-checklist.html, tier-advisor.html, water-system.html

- [MED] 404.html — has `<a href="#main-content" class="skip-link">` but there is no element with `id="main-content"` in the page; the skip-link target is broken (keyboard user presses the link and focus goes nowhere)
- [MED] datacenter-solutions.html — same broken skip-link: has skip-link href but no `#main-content` target
- [MED] rfs-readiness-workbench.html — has skip-link (`class="skip-link"`) but no `id="main-content"` target
- [MED] tco-calculator.html — has skip-link but no `id="main-content"` target

---

## Summary by impact

| Severity | Count | Primary issues |
|----------|-------|---------------|
| HIGH     | 18    | Login modals with no label-input binding (12 articles); form errors not announced (role="alert" missing); gate overlay divs not keyboard accessible; article-20/22 login traps; all tables missing scope=; carbon-footprint table with no th; rz-ops-p7x3k9m 13 H1; 49 pages with no skip-link |
| MED      | 68    | Calculator labels without for= (pue, capex); all range sliders missing aria-label; newsletter inputs unlabeled; search inputs unlabeled; nav without aria-label (20+ pages); theme/user buttons missing aria-label; ticker anchors aria-hidden while focusable; comparison-card divs not keyboard accessible; close buttons without aria-label; 34 global keyframes missing reduced-motion in styles.css; simulation pages (datahallAI, datahall, fire-system, ict, tco) no reduced-motion guard; H3-before-H2 hierarchy issues (9 pages); skip-link target ID missing (4 pages); main landmark missing header wrapper (~35 pages); color contrast failures (#6b7280 on dark) |
| LOW      | 33    | Search preview images with alt="" (meaningful content); lang attribute on PDF templates; terms.html Bahasa phrase; no header wrapping nav (semantic); multiple minor animation pages; footer-nav div should be semantic nav; nav-user-btn small touch target; no h1 on simulation pages |

### Top-priority fixes (biggest user impact)
1. **B11** — Add `scope="col"/"row"` to all `<th>` elements (affects every table on the site)
2. **B3** — Add `<label for="...">` to all login modal inputs (affects 12+ article pages + 6 calculator pages)
3. **B3** — Add `aria-label` to all `#searchInput` elements (25+ pages)
4. **B12** — Add skip-links to the 49 pages missing them; fix broken skip-link targets on 4 pages
5. **B6** — Add `role="button"`, `tabindex="0"`, `aria-expanded` to gate overlay divs and comparison-card divs
6. **B3** — Add `role="alert"` on login error message containers site-wide
7. **B4** — Add `aria-label` and `aria-expanded` to hamburger/user-dropdown/theme-toggle buttons
8. **B9** — Add `prefers-reduced-motion` guards to datahallAI.html (17 keyframes), datahall.html, fire-system, fuel-system, ict
