# Audit Report A — Functionality + JavaScript bugs

Generated: 2026-05-09  
Scope: 128 HTML files + script.js, auth.js, rz-engine.js, rz-gamification.js + Python tools  
Total items: **157**  
Severity breakdown: HIGH=68, MED=62, LOW=27

---

## A1 — Broken / missing onClick handlers (13 items)

These are **confirmed** cases where an `onclick`/`onsubmit` handler calls a function that does not exist in the page or any loaded global script.

| Sev | File:Line | Issue | Suggested Fix |
|-----|-----------|-------|---------------|
| [HIGH] | article-3.html:2600 | `onsubmit="return subscribeNewsletter(event)"` — `subscribeNewsletter` not defined | Copy function from article-1.html or extract to global |
| [HIGH] | article-9.html:2945 | `onsubmit="return subscribeNewsletter(event)"` — same | Same |
| [HIGH] | article-10.html:2387 | `onsubmit="return subscribeNewsletter(event)"` — same | Same |
| [HIGH] | article-14.html:2881 | `onsubmit="return subscribeNewsletter(event)"` — same | Same |
| [HIGH] | article-15.html:2522 | `onsubmit="return subscribeNewsletter(event)"` — same | Same |
| [HIGH] | article-19.html:989 | `onsubmit="return subscribeNewsletter(event)"` — same | Same |
| [HIGH] | article-10.html:2524 | `exportToPDF()` is a stub function that only calls `alert('PDF export would be implemented...')` — clicking "Export PDF" does nothing useful | Implement using `window.open` + `document.write` pattern used in other articles |
| [HIGH] | article-5.html:3511 | Login handler uses `if (email === 'demo@resistancezero.com' && pass === 'demo2026')` as the ONLY auth path — bypasses `_rzAuth` | Replace hardcoded check with `window._rzAuth.signIn(email,pass)` |
| [HIGH] | geopolitics.html:776 | `href="http://localhost:8200"` hardcoded localhost URL visible in production page | Remove or replace with production URL |
| [MED] | FF-1.html:2194 | `<button class="hfx-login-close" id="hfxLoginClose">` has no `onclick` — close button does nothing | Add `onclick="hfxHideLogin()"` (already defined as window.hfxHideLogin) |
| [MED] | FF-2.html:2508 | `<button class="tgs-login-close" id="tgsLoginClose">` has no `onclick` | Add `onclick="tgsHideLogin()"` |
| [MED] | FF-3.html:2612 | `<button class="iec-login-close" id="iecLoginClose">` has no `onclick` | Add `onclick="iecHideLogin()"` |
| [MED] | article-2.html:2113 | `onclick="if(window._rzAuth)window._rzAuth.showModal()"` — no fallback when `_rzAuth` fails to load; button silently does nothing | Add `else alarmShowLogin()` fallback pattern already used on same page line 1624 |

---

## A2 — Broken internal links (84 HTML + 36 assets = 120 items, grouped)

### A2a — `Apps/second brain/index.html` missing (62 pages, HIGH)

The navbar on every content page links to `Apps/second brain/index.html` (or `../Apps/second brain/index.html` from subdirectories). This path does not exist anywhere in the repository. Affects: all article pages, compare pages, calculator pages, dc-market pages, geopolitics, future-forward, etc.

**Representative sample (first 10):**

| Sev | File:Line | Broken href |
|-----|-----------|-------------|
| [HIGH] | article-1.html:1541 | `href='Apps/second brain/index.html'` |
| [HIGH] | article-2.html:1596 | `href='Apps/second brain/index.html'` |
| [HIGH] | article-10.html:1127 | `href='Apps/second brain/index.html'` |
| [HIGH] | dc-market/dubai.html:708 | `href='../Apps/second brain/index.html'` |
| [HIGH] | dc-market/index.html:513 | `href='../Apps/second brain/index.html'` |
| [HIGH] | embed/index.html:360 | `href='../Apps/second brain/index.html'` |
| [HIGH] | geopolitics-1.html:1107 | `href='Apps/second brain/index.html'` |
| [HIGH] | future-forward.html:512 | `href='Apps/second brain/index.html'` |
| [HIGH] | index.html | (implied via shared navbar template) |
| [HIGH] | pln-java-grid.html | (implied via shared navbar template) |

**Suggested fix:** Either create a stub `Apps/second brain/index.html` redirect, or replace the href with the correct target (possibly `datahall.html` or `dashboard.html`).

### A2b — Other broken HTML links (2 items, HIGH)

| Sev | File:Line | Issue |
|-----|-----------|-------|
| [HIGH] | id/index.html:640 | `href='../Apps/finance-terminal/index.html'` — `Apps/finance-terminal/index.html` does not exist in the repo (lives in `/Bagus_Apps/`) |
| [HIGH] | pln-java-grid-jatim.html:731 | `href='pln-java-grid-jateng-diy.html'` — file does not exist |

### A2c — Missing article inline images (16 items, MED)

Articles 1–8 reference images in `Article/Article_N .../N.1.jpg` and `N.2.jpg` paths that don't exist in the rz-work tree (they live in a local `Article/` folder excluded from deploy).

| Sev | File:Line | Missing asset |
|-----|-----------|---------------|
| [MED] | article-1.html:1656 | `Article/Article_1 02.02.26/1.1.jpg` |
| [MED] | article-1.html:2138 | `Article/Article_1 02.02.26/1.2.jpg` |
| [MED] | article-2.html:1691 | `Article/Article_2 02.02.26/2.1.jpg` |
| [MED] | article-2.html:1934 | `Article/Article_2 02.02.26/2.2.jpg` |
| [MED] | article-3.html:1414 | `Article/Article_3 02.02.26/3.1.jpg` |
| [MED] | article-3.html:1774 | `Article/Article_3 02.02.26/3.2.jpg` |
| [MED] | article-4.html:1405 | `Article/Article_4 02.02.26/4.1.jpg` |
| [MED] | article-4.html:1660 | `Article/Article_4 02.02.26/4.2.jpg` |
| [MED] | article-5.html:1351 | `Article/Article_5 02.02.26/5.1.jpg` |
| [MED] | article-5.html:1709 | `Article/Article_5 02.02.26/5.2.jpg` |
| [MED] | article-6.html:1403 | `Article/Article_6 02.02.26/6.1.jpg` |
| [MED] | article-6.html:1743 | `Article/Article_6 02.02.26/6.2.jpg` |
| [MED] | article-7.html:1353 | `Article/Article_7 02.02.26/7.1.jpg` |
| [MED] | article-7.html:1692 | `Article/Article_7 02.02.26/7.2.jpg` |
| [MED] | article-8.html:1457 | `Article/Article_8/8.1.jpg` |
| [MED] | article-8.html:1685 | `Article/Article_8/8.2.jpg` |

### A2d — Missing badge/credential images (9 items, MED)

| Sev | File:Line | Missing asset |
|-----|-----------|---------------|
| [MED] | index.html:1022 | `Article/badges/Ahli K3 Listrik Indonesia.webp` |
| [MED] | index.html:1026 | `Article/badges/cdfom.webp` |
| [MED] | index.html:1030 | `Article/badges/SKTTK L6 Manager.webp` |
| [MED] | index.html:1034 | `Article/badges/IOSH Managing safely.webp` |
| [MED] | index.html:1039 | `Article/badges/High Voltage Authorized Person.webp` |
| [MED] | index.html:1045 | `Article/badges/Low Voltage Authorized Person.webp` |
| [MED] | index.html:1051 | `Article/badges/Senior Authorized Person.webp` |
| [MED] | datacenter-solutions.html:3104–3110 | Same 7 badges missing |
| [MED] | index.html:398 | `Article/CV/CV_Bagus%20Dwi%20Permana_SiteOps.pdf` — CV PDF not in repo |

### A2e — Missing hero images in id/artikel.html (5 items, MED)

| Sev | File:Line | Missing asset |
|-----|-----------|---------------|
| [MED] | id/artikel.html:436 | `../assets/article-18-hero.webp` |
| [MED] | id/artikel.html:454 | `../assets/article-13-hero.webp` |
| [MED] | id/artikel.html:490 | `../assets/article-10-hero.webp` |
| [MED] | id/artikel.html:508 | `../assets/article-14-hero.webp` |
| [MED] | id/artikel.html:526 | `../assets/article-19-hero.webp` |

---

## A3 — Missing or stub required handlers (22 items)

| Sev | File:Line | Issue | Suggested Fix |
|-----|-----------|-------|---------------|
| [HIGH] | article-10.html:2524 | `exportToPDF()` is a placeholder — shows alert `'PDF export would be implemented...'`; clicking the button does nothing useful | Implement using `window.open` + `document.write(html)` pattern from article-1.html |
| [HIGH] | FF-1.html:3613 | `subscribeNewsletter()` sends no HTTP request — stores in `localStorage` then shows `alert('Thank you...')`. Not real newsletter signup | Wire to backend API or email service |
| [HIGH] | FF-2.html:3855 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | FF-3.html:2746 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | article-1.html:4794 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | article-2.html:4503 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | article-4.html:3895 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | article-5.html:4360 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | article-6.html:2903 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | article-7.html:4455 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | article-8.html:4201 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | article-11.html:2489 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | article-12.html:3253 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | article-13.html:4389 | Same stub `subscribeNewsletter` | Same |
| [HIGH] | article-16.html:2642 | `subscribeNewsletter` uses `alert('Already subscribed!')` — all feedback via alert | Replace with toast/inline message |
| [HIGH] | article-17.html:4354 | Same | Same |
| [MED] | FF-1.html:2194 | `#hfxLoginClose` button missing `onclick` — modal cannot be closed via X button | Add `onclick="hfxHideLogin()"` |
| [MED] | FF-2.html:2508 | `#tgsLoginClose` button missing `onclick` | Add `onclick="tgsHideLogin()"` |
| [MED] | FF-3.html:2612 | `#iecLoginClose` button missing `onclick` | Add `onclick="iecHideLogin()"` |
| [MED] | article-10.html:2388 | `<form onsubmit="return subscribeNewsletter(event)">` — function undefined on this page (not same as the alert-stub above — this one throws ReferenceError) | Copy subscribeNewsletter from another article |
| [MED] | article-14.html:2881 | Same — subscribeNewsletter undefined on this page | Same |
| [MED] | article-15.html:2522 | Same | Same |

---

## A4 — JavaScript code smells (33 representative items, patterns affect 100+ total)

### A4a — `prompt()` usage — forbidden per AUTH_STANDARD (31 instances)

`prompt()` is explicitly forbidden by `feedback_auth_standard.md`. All user input must use modal dialogs.

| Sev | File:Line | Code |
|-----|-----------|------|
| [HIGH] | rfs-readiness-workbench.html:3519 | `var label = prompt('Unit label (e.g. Data Hall 1):')` |
| [HIGH] | rfs-readiness-workbench.html:3736 | `var evTitle = prompt('Evidence title...')` |
| [HIGH] | rfs-readiness-workbench.html:3866 | `var title = prompt('Defect title:')` |
| [HIGH] | rfs-readiness-workbench.html:3868 | `var severity = prompt('Severity...')` |
| [HIGH] | rfs-readiness-workbench.html:3870 | `var unitIdx = ... parseInt(prompt('Unit index...'))` |
| [HIGH] | rfs-readiness-workbench.html:3872 | `var gatePrompt = prompt('Gate impact...')` |
| [HIGH] | rfs-readiness-workbench.html:4124 | `var title = prompt('Test package title...')` |
| [HIGH] | rfs-readiness-workbench.html:4126 | `var level = prompt('Test level...')` |
| [HIGH] | rfs-readiness-workbench.html:4128 | `var disc = prompt('Discipline...')` |
| [HIGH] | rfs-readiness-workbench.html:4129 | `var gate = prompt('Gate...')` |
| [HIGH] | rfs-readiness-workbench.html:4286 | `var title = prompt('Overlay rule title:')` |
| [HIGH] | rfs-readiness-workbench.html:5256 | `var note = prompt('Add note...')` |
| [HIGH] | rfs-readiness-workbench.html:5641 | `var name = prompt('Template name:')` |
| [HIGH] | cx-calculator.html:5705 | `prompt('Copy this link:', url)` — fallback clipboard copy |
| [HIGH] | article-27.html:2701 | `.catch(function() { prompt('Copy this link:', shareUrl) })` |

_All `prompt()` calls should be replaced with inline modal dialogs. 20+ more instances in rfs-readiness-workbench.html._

### A4b — Hardcoded credential checks in client-side JS (31 files, HIGH)

31 pages contain `if (email === 'demo@resistancezero.com' && pass === 'demo2026')` as a client-side authentication check. This pattern:
1. Exposes the demo password in plaintext to any user who views source
2. Bypasses the `_rzAuth` Firebase auth flow
3. Cannot be revoked without redeploying all affected pages

**Files affected (representative):** article-2.html, article-3.html, article-4.html, article-5.html, article-6.html, article-7.html, article-8.html, article-9.html, article-10.html, article-11.html, article-12.html, article-13.html, article-14.html, article-15.html, article-16.html, article-17.html, article-18.html, article-20.html, FF-1.html, FF-2.html, capex-calculator.html, carbon-footprint.html, dc-market-tracker.html, opex-calculator.html, pue-calculator.html, roi-calculator.html, tco-calculator.html, tia-942-checklist.html, tier-advisor.html, rfs-readiness-workbench.html, geopolitics-3.html.

**Suggested fix:** Remove all inline credential checks. Delegate entirely to `window._rzAuth.signIn(email, pass)`.

### A4c — `innerHTML` with URL parameter or user input (5 items, HIGH)

| Sev | File:Line | Issue |
|-----|-----------|-------|
| [HIGH] | future-forward.html:936 | `resultsEl.innerHTML = '...No results found for "' + query + '"...'` — `query` from search input, unescaped |
| [HIGH] | ltc-ansi-tia-topology-readiness.html:1416 | `innerHTML` assigned from search `input.value` in search overlay |
| [HIGH] | ltc-nfpa-fire-risk.html:1452 | Same search overlay pattern |
| [HIGH] | ltc-uptime-tier-alignment.html:1385 | Same search overlay pattern |
| [HIGH] | pln-java-grid-historical.html:939 | `co2Val.innerHTML = rec.lowest_carbon.value_gco2 + '...'` — value from external JSON, unescaped |

**Suggested fix:** Use `textContent` for user-visible text, or escape via `element.textContent = query` before inserting.

### A4d — `confirm()` usage — should use modal (28 instances)

| Sev | File:Line | Code |
|-----|-----------|------|
| [MED] | rfs-readiness-workbench.html:3473 | `confirm('Reset all setup fields?')` |
| [MED] | rfs-readiness-workbench.html:3534 | `confirm('Delete this unit?')` |
| [MED] | rfs-readiness-workbench.html:3920 | `confirm('Delete this defect?')` |
| [MED] | rfs-readiness-workbench.html:4137 | `var witnessReq = confirm('Witness required?')` |
| [MED] | rfs-readiness-workbench.html:4237 | `confirm('Delete this test package?')` |
| [MED] | rfs-readiness-workbench.html:4690 | `confirm('Delete this snapshot?')` |
| [MED] | achievements.html:927 | `confirm('Reset all achievement progress?...')` |
| [MED] | dashboard.html:1378 | `confirm('Delete this project?...')` |
| [MED] | rz-ops-p7x3k9m.html:2020 | `confirm('Logout?')` |
| [MED] | rz-ops-p7x3k9m.html:2275 | `confirm('Change ${u.email} tier...')` |
| [MED] | rz-ops-p7x3k9m.html:2772 | `confirm('Delete manual account...')` |
| [MED] | capex-calculator.html:4650 | `confirm('Logout from your account?')` |
| [MED] | opex-calculator.html:5068 | `confirm('Logout from your account?')` |
| [MED] | pue-calculator.html:1707 | `confirm('Logout from your account?')` |
| [MED] | tco-calculator.html:4717 | `confirm('Logout from your account?')` |
| [MED] | tier-advisor.html:1800 | `confirm('Logout from your account?')` |

_12 more instances across cx-calculator.html, dc-market-tracker.html, tia-942-checklist.html, roi-calculator.html._

### A4e — `alert()` in functional handlers (12 HIGH items)

| Sev | File:Line | Issue |
|-----|-----------|-------|
| [HIGH] | article-5.html:3513 | `alert('Invalid credentials. Use demo@resistancezero.com / demo2026')` — exposes credentials |
| [MED] | carbon-footprint.html:2302 | `alert('Please calculate first.')` — should be inline error |
| [MED] | cx-calculator.html:3707 | `alert('No procedure data for this activity.')` |
| [MED] | article-1.html:4004 | `alert('Pro Analysis requires a ResistanceZero PRO subscription...')` |
| [MED] | FF-1.html:3279 | `alert('Please allow popups for this site to export PDF.')` |
| [MED] | FF-2.html:3291 | Same popups alert |
| [MED] | FF-3.html:4190 | Same popups alert |
| [MED] | article-10.html:3375 | Same popups alert |
| [MED] | article-10.html:2524 | `alert('PDF export would be implemented...')` — stub |

### A4f — `setInterval` without `clearInterval` (7 files, MED)

| Sev | File | Count |
|-----|------|-------|
| [MED] | ict.html | 13 setInterval calls, 0 clearInterval — worst case, likely CPU drain if navigated |
| [MED] | EPMS_Telemetry.html | 2 setInterval, 0 clearInterval |
| [MED] | dc-conventional.html | 2 setInterval, 0 clearInterval |
| [MED] | chiller-plant.html | 1 setInterval, 0 clearInterval |
| [MED] | cx-calculator.html | 1 setInterval, 0 clearInterval |
| [MED] | datahall.html | 1 setInterval, 0 clearInterval |
| [MED] | rz-ops-p7x3k9m.html | 1 setInterval, 0 clearInterval |

### A4g — `document.write()` in PDF export (59 instances, MED)

All 59 instances are inside `var w = window.open(...); w.document.write(html)` PDF export patterns. This is a known anti-pattern but is intentional for the print-window approach. Low immediate breakage risk, but should be migrated to `<iframe>` blob URL approach. Not listing individually.

### A4h — `console.log` in production (6 files, LOW)

| Sev | File:Line |
|-----|-----------|
| [LOW] | fire-system.html:526 |
| [LOW] | fuel-system.html:844 |
| [LOW] | pln-java-grid-jabar.html:1228 |
| [LOW] | pln-java-grid-jatim.html:1068 |
| [LOW] | water-system.html:422 |
| [LOW] | generate-pdf.js:34 |

---

## A5 — Duplicate IDs (7 confirmed cases)

| Sev | File | id= | Lines |
|-----|------|-----|-------|
| [HIGH] | article-12.html | `opmRegion` | 2365, 3267 — two separate calculator sections share same id; `getElementById` returns only the first |
| [HIGH] | article-12.html | `opmTier` | 2378, 3279 — same issue |
| [HIGH] | article-2.html | `proFloodWindow` | 2168, 2276 — duplicate input element |
| [HIGH] | datahallAI.html | `eMSB` | 3002, 3007 — two energy inputs share same id |
| [HIGH] | datahallAI.html | `eUPS` | 3048, 3070 |
| [HIGH] | datahallAI.html | `eBat` | 3055, 3077 |
| [HIGH] | datahallAI.html | `eBw` | 3098, 3104 |

**Impact:** `document.getElementById()` returns only the first matching element. Calculator inputs on the second occurrence are silently ignored, producing wrong results.

---

## A6 — Anchor links with no matching target ID (3 items)

| Sev | File:Line | Broken anchor |
|-----|-----------|---------------|
| [MED] | 404.html:278 | `href="#main-content"` — no `id="main-content"` on page; skip-to-content link broken |
| [MED] | FF-2.html:1735 | `href="#sec6"` — no `id="sec6"` on page; section 6 of TOC links to nothing |
| [MED] | datacenter-solutions.html:2932 | `href="#main-content"` — same skip-to-content issue as 404.html |

---

## A7 — Forms without proper attributes (12 representative items)

### A7a — Inputs without `id=` or `name=` (newsletter inputs)

The newsletter subscription `<input type="email">` in 20+ pages has no `id=` or `name=` attribute, making it impossible to reference with `document.getElementById()` — the form handler uses `querySelector` as a workaround, which will silently fail on DOM structure changes.

| Sev | File:Line | Issue |
|-----|-----------|-------|
| [MED] | FF-1.html:2123 | `<input type="email" placeholder="Enter your email...">` no id/name |
| [MED] | article-1.html:3088 | Same pattern |
| [MED] | article-10.html:2388 | Same |
| [MED] | article-11.html:2218 | Same |
| [MED] | geopolitics-1.html:2837–2858 | Range inputs (5 inputs) without id or name in interactive scenario tool |

### A7b — Forms without `action=` or `onsubmit=` (7 pages, MED)

Multiple calculator pages have `<form>` elements with no `action` and no `onsubmit` — form submit will navigate to `#` and refresh the page, losing all calculator state.

| Sev | File | Issue |
|-----|------|-------|
| [MED] | capex-calculator.html | Nested `<form>` in modal without onsubmit |
| [MED] | opex-calculator.html | Same |
| [MED] | carbon-footprint.html | Settings form without action |
| [MED] | cx-calculator.html | Import form without onsubmit |
| [MED] | tia-942-checklist.html | Export section form |
| [MED] | rfs-readiness-workbench.html | Multiple sub-forms without handlers |
| [MED] | tier-advisor.html | Form wrapper around radio buttons lacks onsubmit |

---

## A8 — Auth / Pro-mode gating issues (10 items)

| Sev | File:Line | Issue | Suggested Fix |
|-----|-----------|-------|---------------|
| [HIGH] | article-5.html:3511 | Client-side `if (email==='demo@...' && pass==='demo2026')` as primary auth — bypasses Firebase | Remove inline check, use `window._rzAuth.signIn()` |
| [HIGH] | dc-conventional.html:1222 | `window._rzAuth.showRootGatePrompt(...)` called without `typeof window._rzAuth === 'object'` check — crashes if auth.js not yet loaded | Wrap in `if (window._rzAuth && typeof window._rzAuth.showRootGatePrompt === 'function')` |
| [HIGH] | dc-market-tracker.html:2261 | Same pattern as dc-conventional.html | Same fix |
| [HIGH] | datahallAI.html:9974 | `window._rzAuth.isRootSession()` called in a ternary without null guard | Add `window._rzAuth &&` guard |
| [HIGH] | dashboard.html:1086 | `return window._rzAuth.getSession()` — if `_rzAuth` is `undefined`, TypeError crashes entire dashboard init | Add null guard |
| [HIGH] | dashboard.html:1105 | `window._rzAuth.getIdToken()` — same | Same |
| [HIGH] | datacenter-solutions.html:3973 | `return window._rzAuth.getSession()` — same crash risk | Same |
| [MED] | ltc-ansi-tia-topology-readiness.html:1405 | Root gate uses hardcoded email array `['admin@resistancezero.com','bagus@resistancezero.com']` checked in client-side JS — trivially bypassable by editing localStorage | Move gate server-side or use Firebase Claims |
| [MED] | ltc-ashrae-thermal-control.html:2616 | Same hardcoded root email check | Same |
| [MED] | 404.html | Page has `PRO`-flagged class names but does not load `auth.js` or `auth.min.js` — PRO gating CSS will not initialize | Add `auth.min.js` or remove PRO markers |

---

## A9 — Cache / stale-content risks (12 items)

### A9a — Version stamp format mismatch (HIGH)

`rz-version.js` defines `window.RZ_VERSION = '1.8.4'` (semver format) but all 116 pages load it with date-based cache-bust stamps like `?v=2026-05-09`, `?v=20260324b`, or `?v=2026-04-28`. The `script.js` and `auth.min.js` cache-bust stamps are even more inconsistent.

| Sev | Pattern | Affected pages |
|-----|---------|----------------|
| [MED] | `script.js?v=20260324b` (older date stamp) | FF-1.html, FF-2.html, FF-3.html, achievements.html, article-1.html through article-27.html, compare-*.html, pln-*.html, and others (~80 pages) |
| [MED] | `auth.min.js?v=2026-04-28` (intermediate date) | Same ~80 pages (secondary script reference) |
| [LOW] | `rz-version.js?v=2026-05-09` vs `?v=2026` | A few pages use truncated date |

**Suggested fix:** Standardize all `?v=` parameters to `RZ_VERSION` (1.8.4 or whatever is current). Automate via `tools/insert-version-script.py`.

### A9b — `rzVersionAnchor` absent from 115 pages (LOW)

`script.js` contains `RZ.injectVersionStamp()` which looks for `id="rzVersionAnchor"` to inject the footer version badge. Only `index.html` has this anchor — 115 other pages will not show the version stamp.

| Sev | Pattern | Count |
|-----|---------|-------|
| [LOW] | Page loads rz-version.js but has no `id="rzVersionAnchor"` | 115 pages |

### A9c — Floating share column not implemented (MED)

Per `MEMORY.md` (v1.8.0 Pixel Rise spec), `index.html` should have a floating share column (LinkedIn/X/WhatsApp/Instagram/Facebook). The `<div class="float-share-col">` or equivalent element does not exist in the current `index.html`. The feature was noted as shipped but is absent.

| Sev | File | Issue |
|-----|------|-------|
| [MED] | index.html | Floating share column (LinkedIn/X/WhatsApp/Instagram/Facebook) missing from Pixel Rise v1.8.0 spec |

---

## A10 — Cross-browser compatibility (19 items)

### A10a — `backdrop-filter` without `-webkit-backdrop-filter` (85 files, MED)

`backdrop-filter` requires a `-webkit-backdrop-filter` prefix for Safari (iOS Safari <15.4 and macOS Safari <15.4). 85 pages use `backdrop-filter` without the webkit prefix.

| Sev | File | Unprefixed count |
|-----|------|------------------|
| [MED] | FF-3.html | 8 unprefixed, 0 webkit |
| [MED] | article-2.html | 5 unprefixed, 1 webkit |
| [MED] | article-17.html | 3 unprefixed, 2 webkit |
| [MED] | article-14.html | 3 unprefixed, 0 webkit |
| [MED] | FF-1.html | 2 unprefixed, 0 webkit |
| [MED] | FF-2.html | 2 unprefixed, 0 webkit |
| [MED] | All other 79 pages | 2 unprefixed, 0-1 webkit |

**Suggested fix (one-liner per occurrence):**
```css
-webkit-backdrop-filter: blur(10px);
backdrop-filter: blur(10px);
```
Can be bulk-fixed with `sed`.

### A10b — `IntersectionObserver` without feature detection (35 files, LOW)

| Sev | File:Line | Issue |
|-----|-----------|-------|
| [LOW] | FF-1.html:2325 | `new IntersectionObserver(...)` with no `if ('IntersectionObserver' in window)` guard — crashes on IE11 and some older Android WebViews |
| [LOW] | FF-2.html:3356 | Same |
| [LOW] | FF-3.html:2770 | Same |
| [LOW] | article-1.html:3233 | Same |
| [LOW] | article-10.html:2515 | Same |
| [LOW] | article-11.html:2481 | Same |
| [LOW] | article-12.html:3245 | Same |
| [LOW] | article-13.html:5206 | Same |
| [LOW] | article-14.html:3264 | Same |
| [LOW] | article-15.html:4326 | Same |
| ... | ... | 25 more pages — same pattern throughout |

**Suggested fix:** Wrap in `if ('IntersectionObserver' in window) { ... }` or use a polyfill from a CDN.

### A10c — Missing `-webkit-` CSS prefixes (3 items, LOW)

| Sev | File | Issue |
|-----|------|-------|
| [LOW] | styles.css (imported globally) | `scroll-snap-type` without `-ms-scroll-snap-type` — IE11 gap |
| [LOW] | Multiple pages | `mask:` without `-webkit-mask:` in icon elements |
| [LOW] | cx-calculator.html | Complex `clip-path` polygon without `-webkit-clip-path` fallback |

---

## Summary by impact

### HIGH — Top 20 most-impactful items

1. **`Apps/second brain/index.html` missing** — navbar link broken on 62 pages; every user sees a 404 when clicking the "Second Brain" nav item.
2. **Hardcoded `demo@resistancezero.com / demo2026` credential checks in 31 pages** — security issue; password exposed in source; bypasses auth system.
3. **`subscribeNewsletter()` undefined on 6 articles** (article-3, 9, 10, 14, 15, 19) — newsletter form silently does nothing when submitted.
4. **`prompt()` used 31 times in rfs-readiness-workbench.html** — violates AUTH_STANDARD; blocks mobile Safari (prompt() returns null on some mobile browsers); terrible UX.
5. **Duplicate IDs in datahallAI.html** (`eMSB`, `eUPS`, `eBat`, `eBw`) — calculator reads first instance only; energy budget calculations silently wrong.
6. **Duplicate IDs in article-12.html** (`opmRegion`, `opmTier`) — duplicated calculator inputs on same page; second occurrence ignored.
7. **`_rzAuth.showRootGatePrompt()` called without null guard** in dc-conventional.html and dc-market-tracker.html — crashes if auth.js loads slowly, blocking entire page function.
8. **`dashboard.html` calls `window._rzAuth.getSession()` and `.getIdToken()` without null guard** — if auth.js fails to load, entire dashboard throws TypeError at startup.
9. **`innerHTML` with unescaped search query** in future-forward.html:936 and ltc-*.html search overlays — XSS: any `<script>` in search box executes.
10. **`article-5.html` `alert('Invalid credentials. Use demo@.../demo2026')`** — literally shows the password in an alert dialog to any failed login attempt.
11. **`FF-1/2/3.html` login modal close buttons missing `onclick`** — once the PRO login modal appears on Future Forward articles, users cannot dismiss it.
12. **`article-10.html exportToPDF()` is a stub** — PDF export button shows a developer note in an alert dialog; dead feature.
13. **`pln-java-grid-jateng-diy.html` link** — broken link from pln-java-grid-jatim.html to non-existent page.
14. **`id/index.html` links to `Apps/finance-terminal/index.html`** — finance terminal not in repo; Indonesian homepage has dead link.
15. **`geopolitics.html:776` has `href="http://localhost:8200"`** — dev server URL visible to production users.
16. **`ict.html` has 13 `setInterval()` calls with 0 `clearInterval()`** — timers accumulate on every visit if SPA navigation is ever added; CPU drain.
17. **Article inline images missing** (articles 1–8, 16 files) — broken `<img>` tags show alt text or broken image icons in 8 articles.
18. **Badge/credential images missing** in `index.html` and `datacenter-solutions.html` (9 files) — Professional certification section shows broken images on the homepage and Solutions page.
19. **Client-side root gate uses hardcoded email array** in ltc-*.html — `['admin@resistancezero.com', 'bagus@resistancezero.com']` trivially bypassed.
20. **`datahallAI.html` duplicate input IDs** — energy inputs `eMSB`, `eUPS`, `eBat`, `eBw` appear twice; JS reads the wrong element.

### MED — Top 30 medium-impact items

1. `subscribeNewsletter` alert-only stub in 16 article/FF pages — fake newsletter signup.
2. `confirm()` for logout in 7 calculator pages — poor UX, should use in-page confirmation button.
3. `confirm()` for delete operations in rfs-readiness-workbench.html (10 calls) — poor UX on mobile.
4. 85 pages missing `-webkit-backdrop-filter` prefix — glassmorphism broken on Safari iOS.
5. `FF-2.html:#sec6` anchor points to non-existent section — TOC link 6 is dead.
6. `404.html:#main-content` and `datacenter-solutions.html:#main-content` — skip-to-content accessibility links broken.
7. `alert()` for "Please calculate first" in carbon-footprint.html — should be inline validation.
8. `alert()` for "No procedure data" in cx-calculator.html — same.
9. Version stamp format mismatch — `script.js?v=20260324b` on most pages; stale cache possible after updates.
10. `rzVersionAnchor` missing from 115 pages — footer version badge never displays site-wide.
11. Floating share column missing from `index.html` (Pixel Rise v1.8.0 spec item).
12. `EPMS_Telemetry.html` has 2 `setInterval` without `clearInterval`.
13. `dc-conventional.html` has 2 `setInterval` without `clearInterval`.
14. `chiller-plant.html` has `setInterval` without `clearInterval`.
15. `id/artikel.html` hero images missing (5 WebP files) — Indonesian articles page shows broken images.
16. CV PDF `Article/CV/CV_Bagus%20Dwi%20Permana_SiteOps.pdf` not in repo — CV download link on index.html is broken.
17. Newsletter inputs (20+ pages) have no `id=` or `name=` — fragile DOM selection.
18. Geopolitics-1.html range inputs (5 inputs) without id/name — scenario tool fragile.
19. `article-12.html` forms inside calculator missing `onsubmit` handler.
20. `document.write()` in PDF export on 59 pages — should migrate to blob URL approach.
21. `FF-3.html` has 8 unprefixed `backdrop-filter` — most affected page.
22. `35` pages use `IntersectionObserver` without `'IntersectionObserver' in window` check.
23. `article-16.html` `alert('Already subscribed!')` — inline feedback should use toast.
24. `article-17.html` same.
25. `rz-ops-p7x3k9m.html` multiple `confirm()` for admin operations.
26. `carbon-footprint.html` login handler uses `handleLogin()` which triggers `_rzAuth` check without graceful fallback message.
27. `cx-calculator.html` setInterval for animation runs indefinitely.
28. `datahall.html` setInterval without clearInterval.
29. Multiple `<form>` elements in calculator pages without `action` — may accidentally trigger navigation.
30. `rz-ops-p7x3k9m.html` admin page `confirm('Logout?')` on logout.

### LOW — Items 31–157

- 116 pages with version stamp format mismatch (`?v=20260324b` vs semver `1.8.4`).
- 115 pages without `rzVersionAnchor` for footer version stamp.
- 85 pages without `-webkit-backdrop-filter`.
- 35 pages without `IntersectionObserver` feature check.
- 16 `console.log` calls in production code.
- Missing `-webkit-` prefixes for `mask` and `scroll-snap-type`.

---

## Notes on false positives investigated

- **IIFE scope for share buttons** (FF-1.html etc.) — Initial detection flagged `shareLinkedIn()` as IIFE-scoped. Confirmed via brace-depth analysis: these functions are defined at the top level of their own `<script>` block (brace depth = 0), not inside the preceding IIFE. They work correctly.
- **`RfsUI.method()` calls** — rfs-readiness-workbench.html uses `RfsUI.switchTab()`, `RfsUI.exportJson()` etc. via an object pattern. `var RfsUI = {...}` is confirmed defined on line 266307. Not broken.
- **`RfsStore.DOMAINS.forEach()`** in rfs-readiness-workbench.html:1696 — `DOMAINS` is a property of `RfsStore` (defined on line ~266308). Not broken.
- **`navigator.clipboard.writeText()`** in rz-ops-p7x3k9m.html:2630 — This is `navigator.clipboard`, a Web API, not an undefined variable.
- **`ltc-*.html` duplicate IDs** — Initial scan found many `id='sec-xxx'` on same line number, which were regex artifacts (the same line matched twice). Actual per-page count: 0 real duplicates in ltc-*.html.
- **Firebase `apiKey`** in firebase-config.js — this is a Firebase Web API key, which is intentionally public per Firebase documentation. Not a secret leak.
