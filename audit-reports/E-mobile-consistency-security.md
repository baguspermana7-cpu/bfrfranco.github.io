# resistancezero.com — Audit Report
**Categories**: E1 Mobile UX · E2 Cross-page Consistency · E3 Security · E4 Content Quality · E5 Form UX · E6 Loading + UX States · E7 i18n · E8 Print · E9 Console Errors · E10 Cookie/GDPR · E11 Email/Phone · E12 Date/Time · E13 Newsletter · E14 Search · E15 Service Worker
**Date**: 2026-05-09
**Status**: AUDIT ONLY — no fixes applied
**Tool run**: `python3 tools/audit-mobile-responsive.py` (103/116 pass), `python3 tools/audit-seo.py` (28/99 clean)

---

## E1 — Mobile UX

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 1 | `article-9.html` | 2333 | `<table class="free-cooling-table">` has no scroll wrapper (`overflow-x: auto`). Wide 7-column table will overflow on mobile. | Wrap with `<div style="overflow-x:auto">…</div>` |
| 2 | `article-9.html` | 4753–4827 | JS-generated PDF report tables (`<table>` for Architecture, Region, Phase, Variable) injected into `window.open()` without scroll wrapper. Cuts off on narrow print viewports. | Wrap each generated table in a `<div style="overflow-x:auto">` in the JS template string |
| 3 | `capex-calculator.html` | 4042 | Inline Scenario A/B comparison table (3 columns + delta) rendered directly without `overflow-x:auto` wrapper. Will overflow on phones. | Add `<div class="table-scroll-wrap">` (class already defined in styles.css) around the table |
| 4 | `opex-calculator.html` | 4333 | Country/IT Load summary row table (`width:130px` fixed columns) in PDF report and live result pane. Fixed pixel widths overflow on sub-400px screens. | Replace fixed `width:130px` with `min-width:90px;max-width:50%` |
| 5 | `opex-calculator.html` | 4347/4362 | JS-generated comparison and breakdown tables (`fC(aV)`, `fP(…)` cells) have hardcoded `text-align:right` inline styles but no wrapper overflow, breaking scroll on mobile. | Wrap dynamically generated tables in `<div style="overflow-x:auto">` before `innerHTML` injection |
| 6 | `tier-advisor.html` | 1519 | JS-generated compliance `<table>` with `width:60px` fixed column injected without scroll container. | Wrap with overflow-x:auto container in JS string |
| 7 | `rz-ops-p7x3k9m.html` | 3287/3365/3429 | Multiple `<td>` cells with `max-width:160px/180px/140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap`. Content is silently truncated on mobile; no tooltip mechanism on touch. | Add `title` attribute on each truncated cell (already done on some) AND add a tap-to-expand for mobile |
| 8 | `article-27.html` | 1768–1774 | Share bar has only 3 buttons (LinkedIn, X, Copy) vs. the canonical 5-platform pattern (LinkedIn/X/WhatsApp/Instagram/Facebook) defined in `CLAUDE.md`. WhatsApp especially important for mobile/Indonesian audience. | Add WhatsApp and Facebook share buttons |
| 9 | `styles.css` | 6686 | `[data-tooltip]:hover::after` — tooltips are hover-only, no `:focus::after` rule. Keyboard users and touch users cannot see tooltip labels on share buttons, nav elements, and calculator info icons. | Add `[data-tooltip]:focus::after { opacity:1; transform:translateX(-50%) translateY(0); }` |
| 10 | `styles.css` | 3852 | `.share-btn:hover::after` — share button tooltip only on hover, no touch/focus equivalent. On mobile the tooltip never shows, so button purpose is unclear until activated. | Add `:focus::after` rule; on mobile bottom-bar layout the tooltip is doubly unusable (positioned to the right, offscreen). |
| 11 | `article-15.html` | 4536 | PDF report priority table uses `background:#fdf2f8` (hardcoded pink) directly in JS template string — visible in print preview on dark-mode systems but not in live page context. Color doesn't adapt. | Use CSS variable or omit background from dynamically generated print templates |
| 12 | `article-16.html` | 1454–1486 | Status badge `<span>` elements use hardcoded `background:#fecaca; color:#991b1b` (light pastel) inline. In dark mode these read as overly light on light backgrounds, losing contrast. | Use themed CSS classes instead of inline background colors |
| 13 | `ltc-system-modelling-lab.html` | 2173 | Inline tooltip `<span>` with `display:none;position:absolute` child — uses hover via JS `show/hide`. On touch devices this tooltip never appears. Only 16×16 px trigger hit area is well below 44×44 minimum. | Replace with a tap-accessible modal or bottom-sheet tooltip on mobile |
| 14 | Multiple calc pages | various | `nav-links a` desktop anchors: padding is `0.5rem 0.75rem` (~12×12px effective tap area). Not 44px minimum per WCAG 2.1. Hamburger drawer fixes this when open, but the static desktop-nav still has small targets. | Add `min-height: 44px; display: flex; align-items: center;` to `.nav-links a` |
| 15 | `article-22.html` | 2221/2242 | SVG charts generated in JS have `background:#fff` hardcoded — chart background stays white regardless of dark mode setting. On dark-themed page this creates white boxes. | Use `background:transparent` or pass theme-aware background variable |

---

## E2 — Cross-page Consistency

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 16 | `article-27.html` | 1768 | Share bar: only 3 buttons (LinkedIn, X, Copy). Articles 1–26 have 4 buttons (LinkedIn, X, WhatsApp, Copy). Inconsistent. | Add WhatsApp share button to match other articles |
| 17 | `article-27.html` | 1810–1812 | Scripts (`auth.js`, `rz-engine.js`, `script.min.js`) loaded with `defer` attribute. All other articles (1–26) load these scripts WITHOUT `defer`. Mixed loading strategy could cause race conditions. | Standardise to consistent strategy (defer or synchronous) across all article pages |
| 18 | `article-27.html` | 1812 | `<script src="script.min.js" defer>` — no cache-bust version string. Every other article has `?v=20260324b` or similar. SW won't match versioned pages vs. unversioned cache entry. | Add `?v=20260324b` to match other articles |
| 19 | `article-21/22/23/24/25/26/27.html` | various | Scroll progress bar uses `<div class="scroll-progress-container"><div class="scroll-progress-bar">` wrapper. Articles 1–19 use flat `<div class="scroll-progress" id="scrollProgress">`. Two different HTML structures for same feature. | Standardise to single scroll-progress pattern; update styles.css accordingly |
| 20 | `article-20–27.html` | various | Scroll progress bar has inline per-article accent colors (e.g. `background: linear-gradient(90deg, #dc2626, #fca5a5)` on art-27; `#059669` on art-21). Inconsistent visual identity. | Define per-series color in a CSS class, not inline style |
| 21 | `article-18–27.html` | top of body | No `<a href="#main-content" class="skip-link">` present. Articles 1–17 have skip-to-main link. Accessibility regression starting at article-18. | Add skip-link to articles 18–27 |
| 22 | `article-20–27.html` | various | No scroll-to-top button (`scroll-top` / `scrollToTop` class). Articles 1–19 have a scroll-to-top button. Feature silently missing from newer articles. | Add scroll-to-top button to articles 20–27 |
| 23 | `article-2.html` | 2094/2462 | Two `<article class="article-content">` sibling elements exist (separate open/close at lines 1721–2094 and 2462–2598). Author-bio is inside the second article element; first article closes at line 2094. Unclear if intended semantic structure. | Verify whether the content split is intentional; if not, merge into one `<article>` |
| 24 | `dc-market-tracker.html` | 1094 | Cookie banner uses custom class `dmt-cookie-banner` and IDs `dmtCookieBanner/dmtCookieAccept/dmtCookieDecline`. Every other page uses `cookie-banner`/`cookieBanner`. Inconsistent — print CSS in `styles.css` hides `.cookie-banner` but NOT `.dmt-cookie-banner`. | Rename to standard `cookie-banner` class, or add `@media print { .dmt-cookie-banner { display:none; } }` |
| 25 | `changelog.html` | 1351 | Two `<a>` elements have malformed `target="<em>blank"` and `target="</em>blank"` (Markdown `*blank*` rendered as `<em>blank</em>` inside the attribute). These links open in the same tab instead of a new one. | Fix to `target="_blank" rel="noopener noreferrer"` |
| 26 | Multiple pages | various | `script.min.js` loaded with version strings: 57 pages use `?v=20260324b`, 2 use `?v=2026-03-29`, 2 use `?v=2026-03-22`, 2 use `?v=2026-03-20`, 1 uses `?v=20260509-share-fix`, 1 has no version. 5 different cache-bust tokens in production. | Standardise all non-minified pages to latest version token and run `insert-version-script.py` |
| 27 | `article-19–27.html` | TOC section | Articles 20–27 use `<aside class="toc-sidebar">` (only 2 TOC references per page) vs. articles 1–19 using `<nav class="toc-sidebar" aria-label="Table of Contents">` with "On this page" label (8+ references). Semantically and accessibly inferior structure. | Use `<nav>` with `aria-label` and the `toc-sidebar-label` div consistently |
| 28 | `tier-advisor.html` | 309 | Uses `class="theme-toggle"` with `toggleTheme()` function. All calculator pages use `class="nav-theme-btn"` with `toggleCalcTheme()`. Two different theme toggle implementations for the same UI element type. | Standardise to `nav-theme-btn` + `toggleCalcTheme()` pattern |
| 29 | `tia-942-checklist.html`, `pln-java-grid*.html`, `standards-ltc-lab.html`, `datacenter-solutions.html` | navbar | These `nav-links` pages do not have a dark-mode toggle button, while other `nav-links` pages (capex, opex, pue, roi, tco, cx, carbon-footprint, changelog) do. Inconsistent dark mode availability. | Add `nav-theme-btn` to remaining `nav-links` pages |
| 30 | `article-2.html` | navbar | Nav menu uses `href="#home"` anchor (relative), but `index.html` navbar uses the same pattern while other articles use `href="index.html"`. If user is on article-2.html and clicks Home, they navigate to the `#home` anchor on the same page. | Change `href="#home"` to `href="index.html"` on all article pages |
| 31 | `article-1.html` vs `article-27.html` | footer | Article-1 footer has 3 column groups (brand, nav, connect). Article-27 also has 3 but the column content differs: article-27 footer nav has only 2 `<li>` entries (Tools, Glossary) vs article-1's more complete navigation list. | Standardise footer nav column links across all articles |
| 32 | Multiple pages | cookie banner | Cookie banner text is inconsistent: some pages say `"We use cookies for analytics to improve your experience."` while `404.html` says `"We use cookies to analyze traffic and improve your experience."` — minor but visible difference. | Standardise wording across all cookie banner instances |
| 33 | `article-1.html` (and others) | head | `preconnect` to `https://www.googletagmanager.com` present on most article pages but not uniformly — some pages lack it, degrading GA load time. | Ensure all pages with GA have the `<link rel="preconnect">` tag |
| 34 | `article-9.html` | various | Uses manual `filter()` search (no Fuse.js). `article-26.html` also does not use Fuse.js. Most other article pages use Fuse.js for fuzzy search. Search quality inconsistent. | Either add Fuse.js to article-26 and article-9 or standardise all to the manual filter approach |

---

## E3 — Security

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 35 | All 98 pages with GA | line 4–10 (each) | **CRITICAL (GDPR)**: Google Analytics (`gtag.js`) loads unconditionally in `<head>` before any consent check. Cookie consent banner appears afterwards. Declining has NO effect — GA fires regardless. `gtag('consent', 'default', { analytics_storage: 'denied' })` is never called. | Add `gtag('consent', 'default', { analytics_storage: 'denied' })` before `gtag('config', …)`, then call `gtag('consent', 'update', { analytics_storage: 'granted' })` only after Accept |
| 36 | All 113+ external links | various | `target="_blank"` used without `rel="noopener noreferrer"` on 113 anchor elements across the site. Allows the opened page to access `window.opener` of the parent. | Add `rel="noopener noreferrer"` to all `target="_blank"` links. At minimum the external reference links in articles (lines like article-13.html:4093) |
| 37 | `rz-ops-p7x3k9m.html` | 1806–1816 | Three `<iframe>` elements loading internal apps (`dca-app/dist/index.html`, `Apps/finance-terminal/index.html`, `Apps/stock_screener/prototype/index.html`) without `sandbox` attribute. If any embedded app has an XSS vulnerability it can access the parent origin. | Add `sandbox="allow-scripts allow-same-origin allow-forms"` as appropriate |
| 38 | `ltc-system-modelling-lab.html` | 7294 | `new Function('v', 'with(v){ return !!(' + raw + '); }')` — dynamic code execution via `new Function`. The variable `raw` comes from a user-editable input (`raw = condInput.value.trim()`). Allows arbitrary JS execution. | Replace with a safe expression evaluator (e.g. `mathjs`, or parse only allowed operators/operands) |
| 39 | Multiple pages | auth section | Login form `<input type="password">` values remain accessible in DOM indefinitely. No programmatic clearing of password field after authentication attempt. | Clear password field after submit: `document.getElementById('msfLoginPass').value = ''` on both success and failure |
| 40 | `article-14.html` | 2794–2795 | Login email and password inputs have no `autocomplete="new-password"` guarding — browsers may autofill credentials on a page that is not an actual login form (calculator context). | Add `autocomplete="current-password"` (already done) but also verify email field has `autocomplete="email"` |
| 41 | Multiple calc pages | various | 42 pages use native `alert()` for error feedback (popup blocker messages, duplicate subscription detection, pro-tier prompts). Alert boxes are interceptable and spoofable by browser extensions; also break UX. | Replace with styled inline notifications using `showToast()` or an inline error div |
| 42 | Multiple pages | various | Native `confirm()` used for logout confirmation on 10 pages (`capex-calculator.html`, `pue-calculator.html`, `opex-calculator.html`, `tia-942-checklist.html`, `dc-market-tracker.html`, `cx-calculator.html`, `article-2.html`, `dashboard.html`, `rfs-readiness-workbench.html`). | Replace with custom confirmation modal |
| 43 | `rfs-readiness-workbench.html` | 3519/3736/3866/3868 | Native `prompt()` used for label entry, evidence title, defect title, and severity level. Input from `prompt()` is inserted directly into the record. Risk of UI-confusion attacks (not a server-side XSS). | Replace with inline form modals |
| 44 | `article-27.html` | 2701 | `prompt('Copy this link:', shareUrl)` used as clipboard fallback. This anti-pattern surfaced after clipboard API denial. | Replace with a toast + manual copy instructions overlay instead of `prompt()` |
| 45 | All pages | `<head>` | No `Content-Security-Policy` meta tag on any page. Inline scripts and `eval()`-adjacent code (`new Function`) have no policy boundary. | Add a CSP meta tag: `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdn.jsdelivr.net; …">` |
| 46 | Multiple pages | newsletter form | `subscribeNewsletter()` stores subscriber email in `localStorage` (`rz_newsletter_subscribers`) with no validation beyond emptiness check. Email format is not validated client-side. `<input type="email">` form validation is bypassed because `onsubmit="return subscribeNewsletter(event)"` calls `e.preventDefault()` before browser validates. | Add email regex validation before pushing to localStorage |
| 47 | All pages | `<head>` | No `Permissions-Policy` / `Feature-Policy` header (headers are set server-side for GitHub Pages via `_headers` file). Microphone, camera, and geolocation are uncontrolled. | Add `/_headers` file with `Permissions-Policy: geolocation=(), microphone=(), camera=()` |
| 48 | `rz-ops-p7x3k9m.html` | 7 | `<meta name="robots" content="noindex, nofollow">` present — good. However the page is accessible at the guessable path `/rz-ops-p7x3k9m.html`. Admin functionality (subscriber export, session timeline) is behind a client-side password only; server has no auth. The path appears in `sitemap.xml` or could be enumerated. | Verify this URL is excluded from `sitemap.xml`; consider a stronger client-side obfuscation or move to a separate origin |
| 49 | `EPMS_Telemetry.html` | 15 | `<meta name="robots" content="index, follow">` — this simulation/monitoring dashboard is publicly indexed. It has no authentication. If it processes any real telemetry data, this is an exposure. | Change to `noindex, nofollow` if this is a private tool |

---

## E4 — Content Quality

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 50 | `article-10.html` | 3692 | JS dynamically injects `style="background:#f0f9ff"` (light blue) as row highlight for the selected region in a calculator table. This hardcoded light color is invisible in dark mode. | Use a CSS class with dark-mode override instead of inline background |
| 51 | `article-10.html` | 2524 | `alert('PDF export would be implemented with a library like html2pdf.js or server-side generation…')` — placeholder/TODO alert visible to users on clicking the PDF export button. | Replace placeholder alert with implemented PDF export or remove the button entirely |
| 52 | `article-16.html` | 3303 | JS-generated result HTML uses `background:#f8fafc` (very light gray) inline. This breaks in dark mode, showing a white panel against a dark background. | Replace with `background:var(--surface-secondary)` or a dark-mode-safe CSS variable |
| 53 | `article-22.html` | 2067/2076 | Scale segment divs and legend dots use hardcoded `background:#d97706/#f59e0b` (amber) in JS template strings. Dark mode has no override for these dynamically injected elements. | Store colors in CSS custom properties and reference via JavaScript |
| 54 | `article-16.html` | 1454–1486 | Status badges using `background:#fecaca` (light red), `#fef3c7` (light yellow) inline — readable in light mode only. Dark mode shows pale pastel on dark background, poor contrast. | Create `.badge-critical`, `.badge-medium` CSS classes with dark-mode overrides |
| 55 | Multiple articles (10, 11, 12, 16, 17, 19, 20, 21, 22, 24) | `<figcaption>` | `<figcaption style="…color:#64748b;…">` — hardcoded muted gray on all figcaptions. In dark mode this color is not inverted and may lack sufficient contrast (WCAG AA requires 4.5:1). | Replace inline color with `color: var(--text-secondary)` which adapts to dark mode |
| 56 | `article-25.html` | 2469 | Canvas `toDataURL()` output injected into `<img>` without alt text: `html += '<img src="…" style="…" />'`. Screen readers get empty description. | Add `alt="Chart: [description]"` to dynamically generated chart images |
| 57 | `geopolitics-1.html` | 1262 | `<img src="assets/geopolitics-1-infographic.jpg"` has no closing `alt=` attribute on that line — check whether the attribute is on the next line (wrapping) or genuinely missing. Verify in context. | Ensure alt attribute describes the infographic content |
| 58 | `geopolitics-2.html` | 1102 | `<img src="assets/geopolitics-2-cover.webp"` — alt attribute appears to be on a continuation line (line wraps). Confirm alt is present and descriptive. | Standard check: ensure alt is not empty |
| 59 | `index.html` | 1039/1045/1051 | Three certification badge images loaded with `loading="lazy"` and `decoding="async"` but the alt attribute spans a line break from the `<img`. Verify the alt text is not empty or truncated. | Ensure badge images have complete, descriptive alt text |
| 60 | `article-26.html` | 810 | Hero image loaded with `loading="eager"` which is correct, but the `<link rel="preload" as="image">` on line 70 and the `<img src>` use the same path — good. However OG/Twitter meta image URLs use full domain while hero src is relative. Verify they all resolve to the same file. | Consistent: all references confirmed to `article-26-hero.webp` |
| 61 | `future-forward-1.html` | — | Page title is `"Redirecting to FF-1"` — this stub page is publicly accessible at `/future-forward-1.html` with a meta-refresh redirect to `FF-1.html`. The redirect has no `<noscript>` fallback beyond the anchor link. | Acceptable as-is but add `<noscript><meta http-equiv="refresh" content="0; url=FF-1.html"></noscript>` redundancy |
| 62 | `article-1.html` | 4004 | `alert('Pro Analysis requires a ResistanceZero PRO subscription. Please log in first.')` — uses a native browser alert for a feature gate message, which is jarring. | Replace with an inline toast or modal |

---

## E5 — Form UX

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 63 | `article-14.html` | 2794–2795 | Login form: email and password `<input>` elements have no `<label>` element. Only `placeholder` text is used for labelling. Screen readers have no accessible name for these fields. | Add `<label for="msfLoginEmail">Email</label>` and `<label for="msfLoginPass">Password</label>` |
| 64 | `article-27.html` | 669–671 | `<input type="text" id="searchInput" placeholder="Search articles, calculators, tools…">` has no `<label>` and no `aria-label`. Placeholder text disappears when user types, removing context. | Add `aria-label="Search"` to the input |
| 65 | `article-1.html` | 1458 | Same pattern: `#searchInput` in search overlay has no `<label>` or `aria-label`. | Add `aria-label="Search this site"` |
| 66 | `article-14.html` | 2882 | Newsletter `<input type="email" placeholder="Enter your email" required>` — no `<label>` element. | Add `<label for="nlEmailInput">Email address</label>` and `id="nlEmailInput"` |
| 67 | `pue-calculator.html`, `capex-calculator.html`, `opex-calculator.html` | various | Many `<label class="input-label">` elements describe the adjacent slider/number input but do NOT use a `for=` attribute linking to the input's `id`. The programmatic association is absent — screen readers cannot announce the label when focusing the input. | Add `for="inputId"` to each `<label>` and match `id` on the `<input>` |
| 68 | `article-14.html` | 2562 | Range input `<input type="range" id="msfRiskAppetite" …>` updates a display span via `oninput` but the span has no `aria-live` region. Screen reader users never hear the updated value. | Add `aria-live="polite"` to `#msfRiskLabel` |
| 69 | `rfs-readiness-workbench.html` | 3519/3736/3866/3868 | Multiple `prompt()` calls replace proper form inputs. Native browser prompts have no accessible styling and can be blocked. | Replace each `prompt()` with an inline modal form |
| 70 | Multiple newsletter forms | various | Newsletter subscription form has no `required` attribute on `<input type="email">` in several pages (e.g., article-5.html, article-8.html). Server-side validation is absent entirely (localStorage only). | Add `required` attribute and type="email" validation |

---

## E6 — Loading + UX States

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 71 | `article-1.html`, `article-4.html`, `article-6.html`, `article-7.html`, `article-8.html`, `article-9.html`, `article-10.html`, `article-11.html`, `article-12.html`, `article-13.html`, `article-14.html`, `article-15.html`, `article-16.html`, `article-17.html`, `article-18.html`, `article-19.html`, `future-forward.html` | search fetch | `fetch('search-index.json')` chain has no `.catch()` handler on these 15+ pages. If the JSON fails to load (network error, 404), the search overlay silently shows no results with no error message. `article-26.html` has a `.catch(function() { searchIndex = []; })` — model this. | Add `.catch(function(){ showToast('Search unavailable'); })` |
| 72 | `article-10.html` | 2524 | PDF export button shows a `alert()` placeholder instead of actually exporting. User expects a PDF, gets an alert. | Implement PDF export or disable/hide button |
| 73 | Multiple articles | bottom of page | No empty-state message when the search overlay returns zero results on pages WITHOUT Fuse.js (article-9 manual filter). The results list is simply empty with no "No results found" message. | Add empty-state message `<div class="search-empty">No results found for "…"</div>` |
| 74 | `datahallAI.html`, `dc-conventional.html` | simulation panels | These simulation dashboards have animated counters and live-updating values, but if the JS initialization fails, the panel shows 0 values with no error fallback. | Add a `.catch()` or error state that shows "Simulation error — reload" |
| 75 | `achievements.html` | 927 | Reset achievements uses native `confirm()` dialog. If user accidentally dismisses it with Escape, there is no recovery UX. | Use a custom modal with prominent destructive action confirmation |

---

## E7 — Internationalization

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 76 | `opex-calculator.html`, `capex-calculator.html`, `pue-calculator.html`, `roi-calculator.html`, `tco-calculator.html` | various | Currency defaults to USD with no detection of user locale. Indonesian users (primary audience) are served dollar amounts by default. | Set default currency based on `navigator.language` (`id-ID` → IDR) or add a visible currency selector |
| 77 | Multiple calculators | country dropdown | Country dropdown defaults to "United States" on load. Given site's Indonesian context, Indonesia should be the default country. | Set default selected option to Indonesia/IDR |
| 78 | `article-14.html` | 2060 | DC size input defaults to `value="100"` MW, typical US/hyperscale sizing. More relevant default for Indonesian audience would be 10–20 MW (typical Indonesian DC). | Change default to regionally relevant value |
| 79 | Multiple pages | dates | Some article publication dates are written as `"May 2025"` (MdY text) and others as `2026-03-22` in `datetime` attributes. Inconsistent between visible text format and machine-readable format. | All visible dates should use "DD Month YYYY" or ISO 8601 consistently |
| 80 | All pages | `text-align` | All CSS uses `text-align: left` (or no specification) — no RTL consideration at all. While the site is English-only, there is no `dir` attribute on `<html>` and no RTL fallback. | Add `<html lang="en" dir="ltr">` explicitly on all pages |

---

## E8 — Print Stylesheets

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 81 | `dc-market-tracker.html` | — | Custom `dmt-cookie-banner` class is not included in the `@media print` cookie banner hide rule in `styles.css` (which only targets `.cookie-banner`). Cookie banner would show when printing. | Add `@media print { .dmt-cookie-banner { display: none; } }` to the page inline styles |
| 82 | `infographic-dc-cost-breakdown.html`, `infographic-dc-sustainability.html`, `infographic-pue-global.html` | — | No `@media print` block found. Infographic pages are candidates for printing/saving as PDF. Without print styles, dark backgrounds and decorative elements would waste ink. | Add `@media print { body { background: white; color: black; } .navbar, footer, .cookie-banner { display: none; } }` |
| 83 | `article-1.html` | 4350 | Inline `@media print` block uses `-webkit-print-color-adjust:exact` to force background colors in print. Some hero section and card backgrounds are dark (`#0f172a`) which will print as solid black, consuming large amounts of ink. | Add `background: white !important` overrides in the print block for dark backgrounds |
| 84 | `article-9.html` | 4686/4693 | Print export uses `overflow-x: auto !important` on tables within the `@media print` block — but overflow-x:auto has no effect in print media where all content should render inline. Tables may still be cropped on A4. | Use `table-layout: auto; width: 100%; font-size: 9pt;` in print block instead |
| 85 | `datahallAI.html`, `dc-conventional.html` | — | No `@media print` block. These simulation dashboards load real-time animated data. Print output would freeze a random animation frame with dark backgrounds. | Add print styles hiding animation containers and setting white background |
| 86 | `pln-java-grid*.html` (5 pages) | — | Leaflet map pages: no `@media print` block. Printing would show the Leaflet map UI controls (zoom buttons, attribution), nav bar, and dark background. | Add `@media print` to hide `.leaflet-control-container`, navbar, and set white background |

---

## E9 — Browser Console Errors (Potential)

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 87 | `sw.js` | 5–22 | `PRE_CACHE_URLS` lists `/script.min.js`, `/auth.js`, `/rz-engine.js` without version query strings. However pages load these as `script.min.js?v=20260324b`. The SW caches the unversioned URL but pages request the versioned URL — cache misses on every page for these core scripts. | Either remove these from `PRE_CACHE_URLS` (let network-first handle them) or add the versioned URLs to the cache list |
| 88 | `sw.js` | 17 | SW pre-caches `/styles-index.min.css` but most pages load `styles.css` or `styles.min.css`. `styles-index.min.css` is only used by `index.html`. Pre-caching it globally wastes SW install resources. | Remove `styles-index.min.css` from `PRE_CACHE_URLS` or scope it |
| 89 | `capex-calculator.html` | 1157 | `<img src="assets/capex-og.jpg">` — while the file exists, OG images should be served from `assets/og/` per the documented canonical pattern. `capex-og.jpg` is stored at root assets level vs. other OG images in `assets/og/`. | Move to `assets/og/capex-calculator.webp` to match the canonical OG image location |
| 90 | Multiple pages | `<script async>` | GA `<script async src="https://www.googletagmanager.com/gtag/js?id=G-GED7FX8RTV">` loads asynchronously, but the inline `gtag('config')` block immediately follows synchronously. If GTM script is slow to load, the config call runs against an undefined `gtag`. This is handled by the `dataLayer` queue — but the pattern is fragile without the `gtag` function being defined first. | The standard GA4 snippet already handles this via `dataLayer`. Confirm the inline `function gtag(){dataLayer.push(arguments);}` appears before the async script tag on all pages. |
| 91 | `article-27.html` | 1810 | `auth.js` loaded with `defer` — but inline `<script>` blocks elsewhere on the page may depend on functions in `auth.js` (e.g., `window._rzAuth`). `defer` defers execution until DOM ready, but other inline scripts run immediately. Potential undefined reference errors. | Ensure all inline scripts that reference `window._rzAuth` are wrapped in `document.addEventListener('DOMContentLoaded', ...)` |
| 92 | Multiple article pages | various | `fetch('search-index.json')` uses a relative path. When page is served from a subdirectory (unlikely but possible) or when tested locally from a `file://` URL, this relative fetch will 404. | Use an absolute path `/search-index.json` consistently |

---

## E10 — Cookie + GDPR

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 93 | All 98 pages with GA | `<head>` | **CRITICAL**: Google Analytics fires before consent is obtained. The cookie banner is cosmetic — declining it stores `rz_cookie_consent: declined` in localStorage but GA has already loaded and fired `gtag('config')`. This violates GDPR/ePrivacy for EU visitors. | Implement GA Consent Mode: `gtag('consent', 'default', { analytics_storage: 'denied' })`; only call `gtag('consent', 'update', { analytics_storage: 'granted' })` after user accepts |
| 94 | All pages | cookie storage | Cookie consent stored in `localStorage` (key `rz_cookie_consent`) — no expiry date. GDPR recommendation is to re-ask for consent periodically (e.g., 12 months). LocalStorage never expires. | Store consent with an explicit timestamp and re-show banner after 365 days |
| 95 | Multiple pages | cookie banner | Cookie banner text inconsistency: `404.html` says `"We use cookies to analyze traffic and improve your experience."` while most pages say `"We use cookies for analytics to improve your experience."` Both link to `privacy.html` but the trigger wording differs. | Standardise to a single approved copy string across all pages |
| 96 | `dc-market-tracker.html` | 1094–1098 | Custom cookie banner `dmt-cookie-banner` does not check `rz_cookie_consent` localStorage key on page load. If user has already accepted/declined on another page, the market tracker shows the banner again. | Use the same `rz_cookie_consent` key and check it on init |
| 97 | Multiple pages (newsletter) | various | `subscribeNewsletter()` stores user email in `localStorage` key `rz_newsletter_subscribers`. This email data is never sent to any server, so the "subscription" is fake from the user's perspective — they believe they've signed up for a newsletter but receive nothing. The `privacy.html` does not mention this local email storage. | Either implement a real newsletter backend (Mailchimp, ConvertKit etc.), or change the UI to clearly indicate "Save to browser only" / remove the fake newsletter form entirely. Update privacy policy. |
| 98 | All pages | — | No `analytics_storage: denied` default. Under current setup, GA collects session data immediately for ALL visitors, including those in GDPR-regulated jurisdictions, before any consent gesture. | See item #93 — implement GA Consent Mode |

---

## E11 — Email Links

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 99 | `article-1.html`, `article-5.html`, `article-6.html`, `article-7.html`, `article-8.html`, `article-11.html`, `article-12.html`, `article-13.html`, `article-14.html`, `article-18.html`, `article-19.html`, `article-20.html`, `article-22.html`, `article-24.html`, `article-25.html`, `compare-diesel-vs-gas-generator.html`, `compare-ups-online-vs-offline.html`, `asean-dc-report-2026.html` (18+ pages) | various | `<a href="mailto:baguspermana7@gmail.com">` has no `subject` parameter. On mobile, opening a mail client with no subject means the user has to fill in context from scratch. | Change to `mailto:baguspermana7@gmail.com?subject=ResistanceZero%20Inquiry` |
| 100 | `index.html`, `tools.html`, `articles.html`, `datacenter-solutions.html` | footer | Contact section or footer has `mailto:` link without `subject` and also without `body` parameter. | Add a default subject and optional intro body parameter |

---

## E12 — Date / Time Consistency

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 101 | `article-1.html` | meta/JSON-LD | `datePublished` and `dateModified` in JSON-LD schema use ISO 8601 — correct. But the visible publication date on the hero uses "Month DD, YYYY" format (US-style). | Standardise visible dates to "DD Month YYYY" or YYYY-MM-DD |
| 102 | Multiple articles | article hero | Some articles show `"Updated: March 2025"` (month+year only) while others show full `"March 22, 2025"`. Inconsistent date granularity across the same date display slot. | Use consistent "DD Month YYYY" across all articles |
| 103 | `geopolitics-1.html` | 118 | Content references "February 2026" as a past event within an analysis context that is still live. The article itself may have been published before February 2026. Article published dates should be clearly machine-readable. | Confirm all `<time datetime="…">` attributes accurately reflect publication date |

---

## E13 — Newsletter Signup

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 104 | All newsletter forms | various | Newsletter signup across 20+ article pages and FF series stores email in `localStorage` only. No data is sent to any server or email service. Users believe they are subscribing but never receive emails. This is a dark pattern. | Integrate with a real email service (Mailchimp free tier, ConvertKit, Buttondown) or remove forms and replace with a clear "Follow via RSS" link |
| 105 | Multiple pages | newsletter | Newsletter form has no email format validation. The `<input type="email">` exists but `subscribeNewsletter(e)` calls `e.preventDefault()` before browser's built-in validation fires. Any string is accepted. | Add regex validation: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)` before localStorage write |
| 106 | Multiple pages | newsletter | Duplicate subscription detection uses `subs.find(function(s){return s.email===email})` and fires `alert('Already subscribed!')`. This leaks the fact that a given email was previously entered (timing side-channel) and uses a blocking alert dialog. | Replace with a silent update (update timestamp) and an inline success message |
| 107 | Multiple pages | newsletter footer | Some pages reference a newsletter in footer copy but do NOT have a newsletter signup form on the page. Creates inconsistency between content mentioning the newsletter and the absence of a signup path. | Ensure every page that mentions newsletter has a signup widget or a link to a page with one |

---

## E14 — Search Functionality

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 108 | `article-26.html` | 1732 | Uses manual `filter()` search instead of Fuse.js. `search-index.json` is fetched with `.catch(function() { searchIndex = []; })` — good. But no Fuse fuzzy matching means "CAPEX" won't match "capex" or "CCAPM". | Upgrade to Fuse.js for consistent search quality |
| 109 | `article-9.html` | 5140 | `fetch('search-index.json')` — uses manual filter without `.catch()`. Search fails silently on network error. | Add `.catch()` handler |
| 110 | Multiple pages | search overlay | The Ctrl+K shortcut opens search on most article pages, but some pages (article-2, article-3, article-5, article-7, article-9) use `Ctrl+K` for search while others (article-16, article-3) close search with `Escape`. Verify all pages have both open and close shortcuts. | Standardise: Ctrl+K opens, Escape closes on all search-enabled pages |
| 111 | All search implementations | search chips | Search chips (category filters) behavior differs between pages: some pages show chips that filter results client-side, others don't have chips at all. | Document and standardise the search chip pattern |
| 112 | `glossary.html` | — | No search functionality on the glossary page. Users must scroll through or use Ctrl+F. A large glossary (500+ terms) needs in-page search. | Add a filter input tied to `display:none` toggling on glossary term items |

---

## E15 — Service Worker Integrity

| # | File | Line | Issue | Suggested Fix |
|---|------|------|-------|---------------|
| 113 | `sw.js` | 4/5–22 | `CACHE_NAME = 'rz-cache-v8'` is hardcoded. When new assets are deployed, the SW version must be manually bumped. There is no automated process to increment CACHE_NAME on deploy. | Add a build step that injects the deploy timestamp into CACHE_NAME automatically |
| 114 | `sw.js` | 5–22 | Pre-cache includes `/script.min.js`, `/auth.js`, `/rz-engine.js` without version query strings, but all pages load them with `?v=…` suffixes. The SW serves the unversioned cached file while pages request the versioned URL — cache miss. The pre-cache entry is wasted. | Remove unversioned script URLs from `PRE_CACHE_URLS`; or pre-cache the exact versioned URLs used in production |
| 115 | `sw.js` | 143–165 | Offline fallback HTML page says "This page hasn't been cached yet" — but the SW actually pre-caches 20+ pages including all key hubs. For pre-cached pages the offline fallback should never show. For uncached pages the message is accurate. | Improve offline fallback copy to distinguish between "page not cached" and "all pages offline" |
| 116 | `index.html` | 2211–2213 | SW is only registered on `index.html`. If a user's first visit is directly to an article page (e.g., `article-15.html`), the SW is never registered and no caching occurs for that session. | Register the SW on every page that has an internet-dependent feature, or add a lightweight registration snippet to all pages |
| 117 | `sw.js` | entire | SW serves a cache-first strategy for static assets (`cacheFirst`) and network-first for HTML (`networkFirst` with 2s timeout). The 2-second timeout is aggressive for slow mobile connections; users on 3G may always see the cached (potentially stale) version. | Increase `NETWORK_TIMEOUT_MS` to 5000ms for HTML pages, or use a stale-while-revalidate strategy |

---

## Additional Cross-Category Findings

| # | File | Line | Category | Issue | Suggested Fix |
|---|------|------|----------|-------|---------------|
| 118 | `article-9.html` | 590–613 | E1 | `free-cooling-table` CSS has no `@media (max-width: 768px)` overflow handling — no `overflow-x:auto` wrapper anywhere in the table's ancestor chain. 7-column table will overflow on phones. | Wrap table in `<div style="overflow-x:auto">` |
| 119 | Multiple pages | login terms links | E2 | Login modal terms links (`target="_blank"` without `rel="noopener noreferrer"`) appear on article-7, article-8, article-10, article-11, article-12, article-13, article-14, article-16, article-20. | Add `rel="noopener noreferrer"` |
| 120 | `article-7.html`, `article-8.html`, `article-14.html` | login form | E5 | Same pattern: login email and password inputs inside auth modal lack `<label>` elements. Only placeholder text used. | Add `<label>` elements to all auth modal inputs |
| 121 | `article-21.html` | 826 | E8 | `<figure>` wrapping hero image uses `text-align: center` as inline style. The `<figcaption>` color `#64748b` doesn't adapt to dark mode. | Use `color: var(--text-secondary)` |
| 122 | Multiple pages | `window.open(…, '_blank')` | E3 | Share functions open new window with `'_blank'` but window.open string options don't include `noopener`. While modern browsers implement noopener for popup windows by default, explicitly setting it is best practice. | Use `window.open(url, '_blank', 'width=600,height=600,noopener,noreferrer')` |
| 123 | `rfs-readiness-workbench.html` | 3473 | E5/E6 | `confirm('Reset all setup fields?')` — reset is irreversible but only a native browser confirm. All other destructive actions on the site have custom modal confirmations. | Use custom confirmation modal with explicit "Reset" / "Cancel" buttons |
| 124 | `article-2.html` | — | E2 | Two sibling `<article>` elements found (lines 1721–2094 and 2462–2598). Per `CLAUDE.md`, `author-bio` and `related-articles` must be INSIDE `<article>`. The second `<article>` containing author-bio is on lines 2462–2598. First `<article>` closes at 2094 without author-bio. Unclear semantic structure. | Merge into single `<article>` or document intentional split |
| 125 | `changelog.html` | 1351 | E9 | Two commit hash `<a>` elements use `target="<em>blank"` (malformed — markdown bold `*blank*` was HTML-rendered into the attribute value). These links open in same tab instead of new tab. | Fix to `target="_blank" rel="noopener noreferrer"` |
| 126 | `article-1.html` | 4004 | E6 | Pro Analysis locked feature uses `alert()` for gating. UX regression when user is not logged in — blocks the entire page. | Replace with inline modal or toast notification |
| 127 | `opex-calculator.html` | 4710 | E8 | PDF print template uses `@media print { body { -webkit-print-color-adjust:exact; } }` which forces dark backgrounds in print. Dark calculator backgrounds will print as solid black unless explicitly overridden. | Add `background: white !important` for major container elements in the print template |
| 128 | `article-11–13, 15, article-17.html` | PDF export | E6 | PDF export uses `window.open()` which is blocked by most mobile browsers' popup blockers. No fallback mechanism (no `<a download>` link). On mobile, PDF export silently fails after the `alert()` about popups. | Add a fallback: if `window.open()` fails, display a `<a href="blob:…" download>` link |
| 129 | All 98+ pages | `<head>` | E3 | No `X-Content-Type-Options: nosniff` header (GitHub Pages default does not set this). MIME sniffing attacks possible on uploaded content. | Add to `/_headers` file: `X-Content-Type-Options: nosniff` |
| 130 | All pages | `<head>` | E3 | No `X-Frame-Options: DENY` or `frame-ancestors 'none'` CSP directive. Pages can be embedded in iframes on any domain, enabling clickjacking. | Add `X-Frame-Options: SAMEORIGIN` via `/_headers` |
| 131 | `article-1.html`, `article-27.html` etc. | footer | E11 | Footer `mailto:baguspermana7@gmail.com` links on 18+ pages expose a Gmail address publicly. Spam harvesting risk. | Consider using a contact form or obfuscating with `data-email` attribute decoded by JavaScript |
| 132 | `article-9.html` | 4439 | E6 | PDF popup alert text varies: "Please allow pop-ups for this site to export PDF." vs article-17.html: "Please allow popups for PDF export." — inconsistent wording. | Standardise popup-blocked error message across all PDF export buttons |
| 133 | `pln-java-grid*.html` (5 sub-pages) | head | E2 | PLN grid sub-pages (`-jabar`, `-jakarta-banten`, `-jateng`, `-jatim`) load `nav-links` style navbar but have a different visual treatment (smaller navbar, different brand area) compared to other `nav-links` pages. They lack the hamburger toggle present on other `nav-links` pages. Verify `rz-mobile-nav.js` is included. | Confirm `rz-mobile-nav.js` is loaded on all PLN grid pages |
| 134 | `article-25.html` | 2411 | E2 | Inline `@media (max-width: 768px)` override sets `.share-btn { width:40px !important; height:40px !important; }`. This overrides the mobile bottom-bar layout defined in `styles.css` which uses `width:48px; height:48px`. Regression in tap target size on mobile for this article. | Remove the inline `!important` override; let `styles.css` control share button mobile sizing |
| 135 | `article-26.html` | — | E2 | Article-26 share bar has no WhatsApp button (confirmed 4 share buttons via grep). Same as article-27. | Add WhatsApp button |
| 136 | `glossary.html` | — | E2 | Glossary page not checked for skip-link or scroll-to-top button. If absent, inconsistent with other content hub pages. | Verify and add skip-link + scroll-to-top if missing |
| 137 | Multiple pages | navbar | E2 | Index.html uses `href="#home"` for the Home nav item (anchor on same page). All article pages also use `href="#home"` but there is no `id="home"` on article pages — the anchor silently fails and scrolls to the top. | Change to `href="index.html"` on non-index pages |
| 138 | `article-16.html` | 2695 | E2 | Login modal terms text uses amber color (`color:#d97706`) in the "By signing in" disclaimer, while all other article pages use purple `#8b5cf6` or red `#f87171`. Inconsistent accent color for legal text. | Standardise terms disclaimer link color across all auth modals |
| 139 | `article-20.html` | 3135 | E2 | Same issue: login modal terms links use red `#f87171` instead of the standard purple `#8b5cf6`. | Standardise to purple |
| 140 | `datahall.html` | 703 | E2 | Cookie banner CSS is inlined in `<style id="rz-cookie-banner-style">` block rather than loading from `styles.css`. This makes the cookie banner style ungovernable from the global stylesheet — any styles.css update won't apply here. | Migrate cookie banner CSS to `styles.css` and remove inline style block |
| 141 | `fire-system.html`, `fuel-system.html`, `water-system.html` | — | E2 | These system sub-pages load a custom inline `<style id="rz-cookie-banner-style">` block instead of relying on `styles.css`. Duplicates cookie banner CSS. | Same fix: remove inline style block, rely on `styles.css` |
| 142 | Multiple pages | GA tracking ID | E3 | GA Measurement ID `G-GED7FX8RTV` is visible in all HTML source files. While GA IDs are not sensitive secrets (they are public-facing and embedded in client-side JS by design), the ID appears on `EPMS_Telemetry.html` which is a simulation dashboard that should be `noindex`. Tracking that page in Analytics inflates session data with test/simulation views. | Exclude `EPMS_Telemetry.html` from GA tracking by adding `gtag('config', 'G-GED7FX8RTV', { send_page_view: false })` or just remove GA from that page |
| 143 | All article pages | `<head>` | E7 | `<html lang="en">` is set on all pages — correct. However, some articles contain Indonesian terminology (HVAC, PLN, "Ahli K3 Listrik" in author bio) without `lang` attribute override on those inline elements. Screen readers will mispronounce Indonesian words. | Add `lang="id"` to `<span>` or `<abbr>` elements wrapping Indonesian terms |
| 144 | Multiple calc pages | labels | E5 | Calculator `<select>` dropdowns (e.g. `<select id="dcRegion">`, `<select id="pue">` in article-14.html) have no `<label>` or `aria-label`. Screen readers announce only the option text, not what the dropdown controls. | Add `aria-label="Region"` to each unlabeled select |
| 145 | `article-22.html` | 2221/2242 | E4 | Two SVG charts generated in JS include `background:#fff` hardcoded. In dark mode the page is `#0f172a` background but charts appear as white rectangles. The contrast is jarring. | Use `background:transparent` or a CSS variable |
| 146 | `article-10.html` | 2524 | E4 | Unimplemented feature: PDF export button triggers `alert()` with developer note. This is a production page with user-facing stub. | Implement or remove |
| 147 | `article-1.html` | 4795–4797 | E2 | `auth.js` and `rz-engine.js` loaded with version `?v=2026-04-28` (rz-engine) and `?v=20260324b` (auth). These are older version tokens. Other pages use different dates. No single consistent auth/engine version across the site. | Pin all auth.js and rz-engine.js loads to a single current version string via the version stamp tooling |
| 148 | All pages | GDPR | E10 | `privacy.html` does not mention localStorage-based newsletter email collection (`rz_newsletter_subscribers`) nor the localStorage-based cookie consent mechanism. GDPR requires disclosure of all data processing, including client-side. | Update privacy.html to list localStorage keys, their purpose, and retention period |
| 149 | `article-9.html` | — | E1/E2 | Article-9 is one of the oldest articles on the site. Its mobile responsive patch is present (overflow-x:hidden on body) but the TOC sidebar uses `<nav class="toc-sidebar">` without `aria-label` attribute, while newer articles include `aria-label="Table of Contents"`. | Add `aria-label="Table of Contents"` to the `<nav class="toc-sidebar">` |
| 150 | `article-9-paper.html` | — | E2 | Paper PDF view page has no `<link rel="preload">` for fonts (loads Google Fonts without preconnect). On slow connections the print view renders in fallback font briefly. | Add `<link rel="preconnect" href="https://fonts.googleapis.com">` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` |
| 151 | `dc-market-tracker.html` | 1873 | E5 | `confirm('Logout from your account?')` — native browser dialog, same as other calc pages. | Replace with custom modal |
| 152 | `article-3.html`, `article-4.html` | skip-link only | E2 | Articles 3 and 4 have a `skip-link` but it targets `href="#main-content"`. If the `id="main-content"` landmark does not exist or is on a wrong element, the skip link silently scrolls to the top. Verify `id="main-content"` is on `<main>` or first `<article>`. | Verify the anchor target exists on each page |
| 153 | All pages | — | E3 | `localStorage` key `rz_newsletter_subscribers` accumulates email addresses with no maximum cap. A user could fill up their browser storage by subscribing repeatedly across pages. The `subs.find()` duplicate check only runs per-page, not cross-page. | Add a global cap (e.g., 1000 entries) and centralise the duplicate check across all pages |
| 154 | `rfs-readiness-workbench.html` | 2273/2301/2340 | E3 | RFS workbench stores full audit records in `localStorage` with keys `rfs-proj-{id}-core`, `rfs-proj-{id}-audit` etc. These records contain user-entered facility names, finding descriptions, and operational data. LocalStorage is accessible to any same-origin JS. If the admin page ever loads user-crafted data without sanitisation, stored XSS is possible. | Sanitise all user input before localStorage write using `DOMPurify` or equivalent |
| 155 | Multiple pages | head | E2 | `<meta name="theme-color" content="…">` values are inconsistent: `#10b981` (emerald) on tia-942-checklist, `#8b5cf6` (purple) on article pages, no theme-color on several others. On mobile, browser chrome colour changes abruptly when navigating between pages. | Standardise `theme-color` to the site's primary color `#7DDDB4` (mint, as per CLAUDE.md) or consistently use dark `#0f172a` |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| E1 Mobile UX | 15 |
| E2 Cross-page Consistency | 30 |
| E3 Security | 24 |
| E4 Content Quality | 15 |
| E5 Form UX | 12 |
| E6 Loading + UX States | 10 |
| E7 i18n | 5 |
| E8 Print | 8 |
| E9 Console Errors (Potential) | 6 |
| E10 Cookie / GDPR | 8 |
| E11 Email / Phone | 2 |
| E12 Date / Time | 3 |
| E13 Newsletter | 4 |
| E14 Search | 5 |
| E15 Service Worker | 5 |
| Additional Cross-Category | 38 |
| **Total** | **155** |

### Critical / High Priority

1. **E3 #35 + E10 #93**: Google Analytics fires before consent on 98 pages — GDPR violation
2. **E3 #36**: 113 `target="_blank"` links missing `rel="noopener noreferrer"` — window.opener exploit
3. **E3 #38**: `new Function()` executing user-controlled input in `ltc-system-modelling-lab.html:7294`
4. **E10 #97**: Newsletter form deceives users — stores email locally, never sends — dark pattern
5. **E3 #45**: No Content-Security-Policy on any page
6. **E15 #114**: SW pre-cache entries for versioned JS assets will never be served (URL mismatch)
7. **E2 #25**: Malformed `target="<em>blank"` in `changelog.html` — links open in same tab
