# F — Technical Debt & Code Quality Audit
**Site**: resistancezero.com  
**Audited**: 2026-05-09  
**Auditor**: Claude Sonnet 4.6 (automated static analysis)  
**Scope**: `/home/baguspermana7/rz-work/` root HTML/CSS/JS (excluding Dunia-Emosi, dcmoc, node_modules)  
**Total items**: 93

---

## Legend
- **Sev**: H = High (causes bugs or security risk), M = Medium (causes drift / maintenance pain), L = Low (polish)
- **Effort**: S = Small (< 1 hr), M = Medium (1–4 hrs), L = Large (> 4 hrs)

---

## F1 — Duplicated Code Blocks

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F1-01 | 33 HTML pages | `copyLink()`, `shareLinkedIn()`, `shareTwitter()`, `shareWhatsApp()` re-declared inline on 33 pages (`grep` count: 130 function definitions). `rz-share-results.js` exists for exactly this purpose but is loaded on **zero** pages. | H | L |
| F1-02 | All 103 HTML pages | Cookie-banner HTML (`#cookieBanner`, `.cookie-accept`, `.cookie-decline`) + the ~3-line inline consent JS copied on every page (273 occurrences). Could be a shared `rz-cookie.js` injected once. | M | M |
| F1-03 | All 103 HTML pages | Google Analytics tag (`G-GED7FX8RTV` + `gtag()` config block) copy-pasted on all 103 pages (150 occurrences). No tag-manager consolidation. | M | L |
| F1-04 | Calc pages (5+) | `function debounce(fn, ms)` defined inside `tco-calculator.html` IIFE; a version also lives in `script.js`. Two distinct implementations of the same utility. | M | S |
| F1-05 | Calc pages (5+) | Number/currency formatting via `toLocaleString` scattered in 281 inline occurrences across HTML pages rather than using `RZEngine.format.*` already in `rz-engine.js`. | M | M |
| F1-06 | LTC pages (6 pages) | Full flashcard engine (~80 lines minified) copy-pasted identically into `ltc-uptime-tier-alignment.html` and `ltc-nfpa-fire-risk.html`. Each page independently initialises the same DOM, event listeners, and localStorage keys. | M | M |
| F1-07 | LTC pages (6 pages) | Sortable-table click handler (~30 lines) replicated across at least `ltc-uptime-tier-alignment.html` and `ltc-nfpa-fire-risk.html`. | L | S |
| F1-08 | Article pages | `scroll-to-top` button init repeated inline on 64+ pages (grep count: 64). `script.js` already handles this via `initNavbarScroll` but the init is duplicated in page-level `<script>` blocks. | L | M |

---

## F2 — Stylesheet Duplication

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F2-01 | `styles.css` + `styles-index.css` | `.share-buttons` / `.share-btn` CSS block duplicated: 27 rules in `styles.css`, 28 in `styles-index.css`. Divergence causes per-session regressions (documented in CLAUDE.md). A `@layer shared` or separate `rz-shared.css` would eliminate the 2-file maintenance burden. | H | L |
| F2-02 | `styles.css` + `styles-index.css` | Cookie-banner CSS (`.cookie-banner`, `.cookie-accept`, `.cookie-decline`) duplicated 13 rules in each stylesheet. | M | S |
| F2-03 | `styles.css` + `styles-index.css` | `.scroll-top-btn` / `.scroll-explore` / `.aurora-orb` CSS groups duplicated (27 rules vs 13 rules). | M | S |
| F2-04 | `styles.css` + `styles-index.css` | `.footer-copyright` / `.footer-brand` / `.footer-tagline` rules duplicated 5 times across both files. | M | S |
| F2-05 | `styles.css` + `styles-index.css` | `.nav-menu` block defined in both files with 15 occurrences vs 11 occurrences; drift between the two copies means a fix to one can miss the other (caused 3 documented regressions). | H | M |
| F2-06 | 193 HTML pages | Every page has at least one `<style>` block. Across 193 inline style blocks, an estimated 40–60 % of rules duplicate selectors already defined in `styles.css`. No audit has been run to quantify actual overlap. | M | L |
| F2-07 | Article pages (21–27) | Page-specific dark-mode overrides (e.g., `[data-theme="dark"] .a21-insight-box`) are all inline `<style>` blocks rather than in the shared stylesheet or a per-article external file. 7 articles × ~30 dark rules = ~210 duplicate-pattern rules. | L | L |

---

## F3 — JavaScript Global Pollution

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F3-01 | `script.js` | `initDarkMode`, `initNavigation`, `initNavbarScroll`, `initScrollAnimations`, `sendEmail`, `debounce`, `throttle`, `isValidEmail`, `showNotification` — 47 top-level named functions exposed on `window` without namespacing. Any page script can shadow them. | M | M |
| F3-02 | Multiple pages | Each of the 33 pages that inlines `copyLink()` / `shareLinkedIn()` declares a global function with the same name. If two `<script>` blocks load in the same page, the second silently overwrites the first. | M | S |
| F3-03 | `rz-share-results.js` | Entire file uses `var` throughout (21 top-level `var` declarations), polluting the IIFE scope with no `'use strict'` guard at the outermost level. | L | S |
| F3-04 | Multiple calc pages | Each calculator IIFE exposes a page-level `calculate` function globally (32 occurrences across HTML files). Cross-page name collisions possible if pages are embedded or tested in sequence. | L | S |

---

## F4 — Magic Numbers

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F4-01 | `styles.css` | z-index values `99999`, `99998`, `99997`, `99996`, `99995` hardcoded on lines 6849–7019 with no named constants or CSS custom properties. Adding a new overlay requires guessing the next safe value. | M | S |
| F4-02 | `styles-index.css` | Same pattern: z-index `99999`→`99995` plus `2002`, `2001`, `1001`, `1000` scattered without a documented stacking-context table. | M | S |
| F4-03 | 103 HTML pages | `z-index: 10002`, `9999`, `10000` found 26–58 times in inline `style=""` attributes — 497 total inline occurrences of hardcoded z-index. | M | L |
| F4-04 | 6+ HTML pages | `max-width: 1200px` hard-coded in inline `style=""` attributes 6 times; the CSS variable `--max-width` or a `.container` class could replace all instances. | L | S |
| F4-05 | 103 HTML pages | Top 20 most-repeated inline colour values: `#10b981` (92×), `#e2e8f0` (62×), `#f8fafc` (58×), `#1e293b` (46×), `#f1f5f9` (44×) — none mapped to the CSS custom properties already defined in `:root`. | M | L |
| F4-06 | `scripts.js`, HTML pages | `768px` breakpoint repeated 30+ times as a raw number in both CSS media queries and `window.innerWidth <= 768` JS checks. A single `--bp-mobile` variable would unify these. | M | M |

---

## F5 — Dead Code

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F5-01 | `script.js:645–650` | `initCursorSpotlight()` — entire function body is `return;` followed by 15 lines of disabled code. Shipped dead code. | M | S |
| F5-02 | `script.js:653–723` | `initCardTilt()` — early `return;` on line 655, followed by 68 lines of 3D-tilt logic that never executes. | M | S |
| F5-03 | `script.js:1207–1213` | Glitch-text timer commented out with `//` (4 lines). Has been disabled since at least v1.2. Should be removed or restored. | L | S |
| F5-04 | `styles-index.css:1646–1773` | `.floating-side-cards` / `.floating-side-card` block (~127 lines, 8 selectors) — these rotated side tabs were explicitly rejected (CLAUDE.md "Rejected patterns" §2). The HTML was removed from `index.html`; the CSS remains. Only `articles.html` still uses the class, but that page loads `styles.css` not `styles-index.css`. | M | S |
| F5-05 | `rz-chat.js` | Entire file (chat widget) is not loaded by any HTML page (grep finds zero `src="rz-chat.js"` references). 340-line orphan at site root. | M | S |
| F5-06 | `rz-gamification.js` | Only loaded by `achievements.html`. The achievements page contains a parallel, independent `// ═══ ACHIEVEMENT DEFINITIONS (mirrors rz-gamification.js)` block, meaning the file is loaded but its definitions are shadowed inline. | M | S |
| F5-07 | `firebase-auth.js` / `supabase-auth.js` | `firebase-auth.js` is loaded only by `dashboard.html`. `supabase-auth.js` appears to have no HTML consumers (verified via grep). Both represent an incomplete auth migration that has been superseded by `auth.js`. | H | M |
| F5-08 | `generate-pdf.js` | Uses `puppeteer` (Node.js). No HTML page loads it as a `<script>`. It is a build-time tool that has no `package.json` dependency entry (`puppeteer` not in root `package.json`). Misleading as a site-root file. | L | S |
| F5-09 | `script.js` (many functions) | `initMotionEffects`, `initButtonEffects`, `initCursorEffects` are called but each function guards with early returns based on reduced-motion or pointer checks. The inner logic for mouse-follow / magnetic-button effects (>200 lines) is never reached on any typical visit. | L | M |

---

## F6 — Inconsistent Naming

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F6-01 | PLN grid pages | `function global_PLNTooltip()` in `pln-java-grid-jabar.html` uses snake_case for the function name while all other page functions use camelCase. | L | S |
| F6-02 | `pln-java-grid.html` et al | Navbar IDs use page-prefixed camelCase (`pjgNavbar`, `pjgMobileToggle`, `pjgThemeToggle`) while other pages use plain `#navbar`, `#mainNav`, `#rfsNavbar`. No consistent convention. | L | S |
| F6-03 | `EPMS_Telemetry.html` | Only uppercase-named HTML file at root. All other pages use lowercase-kebab. Case-sensitive filesystems (Linux/GitHub Pages) make this a latent 404 risk if linked with lowercase. | M | S |
| F6-04 | Calc pages | `script.min.js` version strings mix formats: `20260324b`, `2026-03-22`, `2026-03-29`, `2026-03-20`, `20260225`, `20260509-share-fix` — 6 different version string formats across 70 pages. No single canonical format. | M | M |
| F6-05 | styles.css cache-bust strings | `styles.css?v=20260316m` (7 pages) vs `styles.min.css?v=20260324b` (98 pages) vs `styles.min.css?v=2026-04-28` (53 pages). Three different version strings for the same file. | H | M |
| F6-06 | CSS classes | camelCase IDs (`themeToggle`, `cookieBanner`, `introVideoModal`) mixed with kebab-case classes (`.theme-toggle`, `.cookie-banner`, `.video-modal`). Convention is not enforced — ID uses camelCase, class uses kebab. While internally consistent per type, mixing within the same component causes confusion. | L | L |

---

## F7 — Hardcoded Paths / URLs

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F7-01 | `geopolitics.html:776` | `href="http://localhost:8200"` baked into a production anchor element — wraps a styled card that links to a localhost port. Visible to all visitors; clicking it gives a connection-refused error. | H | S |
| F7-02 | `firebase-config.js:22` | `// const API_BASE = 'http://localhost:8080'; // Local dev` — commented-out localhost URL committed to the repo. Not dangerous but clutters the public file. | L | S |
| F7-03 | `rz-chat.js:9` + `firebase-config.js:21` + `firebase-auth.js` | `https://bfrfranco-github-io-586770625232.us-central1.run.app` hardcoded as `API_BASE` in three separate files. Changing the Cloud Run URL requires touching three files. | M | S |
| F7-04 | `firebase-config.js:8` | Firebase Web API key `AIzaSyCXlJbZyWHr74vkJOJaUsjVdv6iAa0kt6A` committed in plain text to a public GitHub repository. While Firebase public keys are intended to be client-visible, combined with the project ID it enables enumeration and abuse if Firebase security rules are misconfigured. | H | M |
| F7-05 | `auth.js:123-125`, `firebase-auth.js:58`, `article-24.html`, `article-25.html`, `article-26.html`, `article-11.html`, `article-8.html`, `article-3.html`, `capex-calculator.html`, `FF-2.html`, `tco-calculator.html` | Password `RZ@Premium2026!` and `demo2026` hardcoded in 10+ HTML/JS files visible to any visitor opening DevTools. This is the most critical security finding. | H | M |

---

## F8 — Inline Event Handlers

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F8-01 | 103 HTML pages | 1,478 `onclick=`, `onsubmit=`, `onload=`, `onchange=`, `onkeyup=` inline attributes across the codebase. The majority are on quiz options (`onclick="checkQuiz(this)"`), deep-link buttons (`onclick="copyDeepLink('id')"`), and share buttons. | M | L |
| F8-02 | `index.html:1243` | `<form onsubmit="return sendEmail(event)">` — one of the few remaining `onsubmit` on a production form; all others have been moved to `addEventListener`. | M | S |
| F8-03 | `article-9-paper.html:339` | `<button onclick="window.print()">` — minimal but still inline. | L | S |
| F8-04 | PLN grid comparison cards | `onclick="this.classList.toggle('expanded')"` on `<div>` comparison cards — no keyboard accessibility, no `role="button"`, purely mouse-driven toggle. | M | M |

---

## F9 — Comments / TODOs / FIXMEs

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F9-01 | `dc-market-tracker.html:1210` | `// TODO: migrate to RZMap.init() once it supports custom marker colors per maturity.` — undated TODO; RZMap has shipped, it's unclear if this migration is still needed. | M | S |
| F9-02 | `pln-java-grid.html:1818` | `// BUG FIX (2026-05-01-v5): computeProvinceAggregates returns an …` — inline multi-line bug-fix comment in production JS. Should be removed from shipped code and tracked in CHANGELOG only. | L | S |
| F9-03 | `script.js:1207–1213` | Four commented-out `// glitchTitles…` lines left in production code since at least early 2026. | L | S |
| F9-04 | `script.js:1082` | `// #20 word-split also disabled for same reason. #21 scramble kept (textContent only).` — numbered feature flags commented inline rather than tracked in a feature registry. | L | S |
| F9-05 | `rfs-readiness-workbench.html:5464–5467` | Template text literally contains `XXX` placeholder strings in document-template defaults (e.g., `Document ID: MOP-XXX`). These are user-facing template strings, not code comments, but could be confused with unfilled TODOs by automated scanners. | L | S |

---

## F10 — File Organization

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F10-01 | Root | `SESSION_ARTICLE13.md`, `SESSION_NOTES.md`, `OPEX_Calculator_Design.md`, `OPEX_Calculator_Design_v2.md`, `OPEX_Detailed_Breakdown_Analysis.md` — 5 developer session/design notes at site root. They are served publicly (GitHub Pages root). The Security Audit explicitly flagged these. | H | S |
| F10-02 | Root | `lighthouse-audit.json` (519 KB) at site root — development artifact served publicly. | M | S |
| F10-03 | Root | `nocache_server.py` and `serve.py` — development servers committed to a production repository root. Not harmful but confusing; should be in `tools/` or `.gitignored`. | L | S |
| F10-04 | Root | `Dockerfile` at site root describes a Cloud Run deployment that is no longer the hosting strategy (site is now on GitHub Pages). It's a stale artifact that could mislead future contributors. | M | S |
| F10-05 | Root | `BingSiteAuth.xml`, `google1b98e0817bd5aa88.html`, `768683436ffdfcc2bb9140345660b139.txt` — three search-engine verification files at root. These are necessary for SEO but should be excluded from Dockerfile COPY and have no `.dockerignore` guard. | L | S |
| F10-06 | Root | `EPMS_Telemetry.html` uses mixed case (Pascal + underscore) while all 102 other HTML files are lowercase-kebab. On Linux/GitHub Pages filesystems, a link using `epms_telemetry.html` would 404. | M | S |
| F10-07 | Root | `article-11-paper.pdf`, `article-12-paper.pdf`, `article-9-paper.pdf`, `geopolitics-1-paper.pdf` (4 PDF files, ~3.6 MB) at root alongside source HTML. PDFs belong in `assets/` or `assets/papers/`. | L | S |

---

## F11 — Build Artifacts in Repo

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F11-01 | `styles.min.css`, `styles-index.min.css`, `script.min.js`, `auth.min.js`, `rz-share-results.min.js` | Five minified build artifacts committed to the repo. On a zero-build site this is a deliberate choice, but they have no corresponding `.gitignore` guard, and updating the source without re-minifying (or vice versa) silently drifts the deployed code. | M | S |
| F11-02 | `.gitignore` | `*.env.local` is gitignored but `*.env` alone is not (only `.env` is, missing `.env.production`, `.env.staging`, etc.). Cloud-function `.env` files in `Data/Freemium Scheme/` are not protected. | H | S |
| F11-03 | Root | `.codex` (empty file, 0 bytes) committed. Appears to be an editor artefact from a Codex/OpenAI CLI session. | L | S |
| F11-04 | `.qa-screens/` directory | `overflow-check.html` in a `.qa-screens/` directory committed and served publicly. QA tooling artefact. | L | S |

---

## F12 — Stylesheet Imports

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F12-01 | 103 HTML pages | FontAwesome loaded via `<link>` from cdnjs CDN on every page (20 Leaflet CDN hits, 69 FontAwesome CDN hits). Each CDN link adds a new DNS lookup + TLS handshake. Self-hosting FA would save 1–3 roundtrips per page load. | M | L |
| F12-02 | 103 HTML pages | FontAwesome version is split: 34 pages use `6.4.0`, 33 pages use `6.5.1`, 2 pages (`fire-system.html`, `water-system.html`) still use `6.0.0`. Three different CDN URLs, preventing HTTP/2 stream reuse, and `6.0.0` is unsupported. | M | M |
| F12-03 | Google Fonts | `Inter` loaded via Google Fonts CDN (multiple `@import` equivalent via `<link>`) across pages, each triggering a `fonts.googleapis.com` DNS lookup. No `font-display: swap` fallback is universally applied. | L | M |

---

## F13 — Outdated Patterns

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F13-01 | All HTML pages | ~15,760 `var` declarations in HTML `<script>` blocks across the codebase. Modern ES6+ `const`/`let` would prevent accidental hoisting and scope issues. (`rz-tracker.js`, `rz-share-results.js` also use `var` exclusively.) | M | L |
| F13-02 | `rz-share-results.js` | Entire 250-line file written in ES5 with `var` throughout, despite the site already using ES6 in newer files. No clear reason for the downgrade. | L | S |
| F13-03 | `rz-tracker.js:25` | `.then(function(r){return r.json()}).then(function(d){…})` — Promise chain that could be a one-liner `async/await`. | L | S |
| F13-04 | `firebase-auth.js:431,455` | `.then(function(cred){…})` Promise chains for Firebase sign-in operations mixed with `async/await` in the same file (lines 330+). Inconsistent async style within one file. | L | S |
| F13-05 | `auth.js` | Font-Awesome lazy-load uses the `print`/`onload` trick (`fa.media = 'print'; fa.onload = function() { this.media = 'all'; }`). This pattern is a 2015-era workaround; modern `rel="preload"` with `as="style"` is cleaner and better-supported. | L | S |
| F13-06 | `document.write()` | 10 occurrences of `w.document.write(html)` for PDF print windows (calc pages, article pages). `document.write` is deprecated on documents that have already loaded. Using `document.open()` + `write()` + `close()` is a minor improvement but the pattern remains fragile. | M | M |

---

## F14 — Missing or Weak Documentation

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F14-01 | `rz-engine.js` | The `RZEngine.models.*` section (calc math: workforce, roi, forecast, capex, opex, tco, pue) has no JSDoc on exported model functions. The `SUPER_ENGINE.md` spec describes *what* it does but not the expected input/output types of each function. | M | M |
| F14-02 | `rz-tracker.js` | No JSDoc on any function. The tracker stores events in `localStorage` with a private key format (`rz_user_events`). The schema is undocumented — `rz-ops-p7x3k9m.html` must reverse-engineer the format. | M | S |
| F14-03 | `js/rz-map.js` | Shared Leaflet map engine used by all 5 PLN pages with no JSDoc or README. Functions like `RZMap.init()`, `RZMap.addNode()`, `RZMap.addEdge()` have no parameter documentation. | M | S |
| F14-04 | Complex calc pages | `capex-calculator.html` (4805 lines), `opex-calculator.html` (5316 lines), `tco-calculator.html` (4883 lines) — monolithic files with no section comments beyond the IIFE structure. The calculation logic for 30+ countries with 15+ variables has no inline documentation of assumptions or data sources. | M | L |
| F14-05 | `standarization/CALC_ENGINE_PLAN.md` | Phase 1 of the calc-engine consolidation (`calc-auth.js` extraction) is listed as a planned item in `changelog.html:1320` but the file has never been created. The roadmap exists but no implementation has started. | M | M |

---

## F15 — Bundling Opportunities

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F15-01 | Root JS files | 9 separate JS files served at root: `auth.js`, `rz-engine.js`, `rz-tracker.js`, `rz-gamification.js`, `rz-share-results.js`, `rz-chat.js`, `firebase-auth.js`, `firebase-config.js`, `supabase-auth.js`. Most pages load 3–5 of these as separate HTTP requests. A lightweight bundler (esbuild, rollup) could merge the active subset into one file. | M | L |
| F15-02 | `js/` directory | 13 JS files in `js/` including 5 large PLN-data files (`pln-java-grid-data-*.js`). These are page-specific and correctly separate, but `rz-version.js`, `rz-map.js`, `rz-mobile-nav.js`, and `pln-tooltip.js` (4 utility files loaded on many pages) could be concatenated into a single `rz-utils.js`. | L | M |
| F15-03 | Stylesheet split | The 2-stylesheet architecture (`styles.css` + `styles-index.css`, 13,684 lines combined) duplicates ~30–40% of rules. A build step that generates both from a single source with an `index`-flag variable would eliminate the manual sync burden. | M | L |

---

## F16 — Cache Strategy Issues

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F16-01 | 103 HTML pages | `script.min.js` cache-bust strings: 57 pages use `v=20260324b`, 6 use `v=20260225`, 2 use `v=2026-03-29`, 2 use `v=2026-03-22`, 2 use `v=2026-03-20`, 1 uses `v=20260509-share-fix`. Six different strings for the same file in production — stale-cache risk for users on older versions. | H | M |
| F16-02 | Multiple pages | `rz-tracker.js` loaded without any `?v=` cache-buster on `pillar-fire-safety.html`, `FF-2.html`, `article-7.html`, `article-9.html`, `article-2.html`, `dc-market-tracker.html`, `geopolitics-3.html`, `geopolitics-1.html`, `future-forward.html`, `pillar-cooling.html`, `tia-942-checklist.html`, `FF-1.html`. Any update to `rz-tracker.js` will be invisible to cached users. | M | S |
| F16-03 | `sw.js` | Service worker `PRE_CACHE_URLS` includes only 12 key pages out of 103. It references `humans.txt` (exists) but misses all articles, calculators, pillar pages, and LTC pages. Cache-first strategy means uncached pages fall back to network — partial coverage provides false confidence in offline support. | M | M |
| F16-04 | `rz-engine.js` | Loaded with `?v=2026-04-28` on 30+ pages but `js/rz-version.js` is at `v=20260509`. The engine version is 11 days behind the version stamp — no automated check ensures they stay in sync. | M | S |

---

## F17 — Test Coverage Gaps

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F17-01 | All calc pages | Zero unit tests for calculation math across all 5 calculators (PUE, CAPEX, OPEX, ROI, TCO). `rz-engine.js` exposes `RZEngine.models.*` functions that could be tested with Jest/Vitest but no test suite exists. | H | L |
| F17-02 | All calc pages | Zero integration tests for calculator UI flows (user changes country → cost updates → PDF export works). | H | L |
| F17-03 | All calc pages | Zero visual regression tests. Dark-mode regressions have been introduced and caught only by manual inspection (documented: 3 separate dark-mode regressions in CLAUDE.md). | M | L |
| F17-04 | Auth system | No tests for `auth.js` session logic (expiry, role detection, `rz-auth-change` event dispatch). The auth module is the gateway to all Pro features. | H | M |
| F17-05 | Tools directory | `tools/*.py` scripts (sitemap, llms.txt, OG images) have no test suite. A wrong regex or off-by-one in `build-sitemap.py` would silently produce a broken sitemap. | M | M |

---

## F18 — Generator Inputs Out of Sync

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F18-01 | `tools/build-og-images.py` | `TARGETS` list covers only 12 page types (verified by OG image count in `assets/og/`). 103 HTML pages exist; 91 pages use the fallback `profile-photo.jpg` OG image. All article pages (27), FF series (3), pillar pages (5), LTC pages (6), comparison pages (10), PLN pages (6), and infographic pages (3) have no dedicated OG card. The `TARGETS` list has not been updated since the initial 12 pages were generated. | H | L |
| F18-02 | `tools/build-og-images.py` | `article-27.html` (most recent article, added 2026-05) is missing from `TARGETS`. New pages are not automatically added. | M | S |
| F18-03 | `tools/build-llms-txt.py` | `CATEGORY_MAP` is a static dictionary requiring manual updates per new page. `article-27.html` is absent — confirmed by grep returning no match. The script does walk the filesystem but unmapped files get no category in `llms.txt`. | M | S |
| F18-04 | `tools/build-sitemap.py` | `PRIORITY_MAP` hardcodes specific filenames for `priority=1.0` and `priority=0.9`. New pages default to `0.7` (monthly) without manual triage. The set `{index.html, datacenter-solutions.html, datahallAI.html, dc-conventional.html, dc-market-tracker.html}` for priority 1.0 has not been reviewed since the PLN grid monitor and LTC pages were added. | L | S |

---

## F19 — Memory Leaks (Potential)

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F19-01 | `rz-ops-p7x3k9m.html:2067` | `setInterval(()=>{...}, 1000)` for the clock — interval is set once on page load with no reference stored, making `clearInterval()` impossible. Minor on a single-page admin console, but it leaks if the admin console is embedded in an iframe. | L | S |
| F19-02 | `pln-java-grid.html:2426` | `setInterval(updateClock, 60000)` — same pattern, no stored reference, no cleanup. | L | S |
| F19-03 | `cx-calculator.html:6111` | Top-level `setInterval(function(){…}, …)` with no reference stored and no cleanup path. | L | S |
| F19-04 | `fuel-system.html:707,712` | Two top-level `setInterval` calls without stored references. On SPA-style navigation these would stack if the page is re-initialised. | L | S |
| F19-05 | `ltc-uptime-tier-alignment.html` / `ltc-nfpa-fire-risk.html` | `document.addEventListener('keydown', function(e){…})` added inside the flashcard IIFE with no corresponding `removeEventListener`. If the IIFE ran twice (e.g., HMR or `<template>` cloning), listeners would stack. | L | S |
| F19-06 | Multiple pages | `script.js:350` — `const timer = setInterval(…)` is stored but there is no `clearInterval(timer)` in a cleanup hook. The interval fires indefinitely once the counter animation starts. | L | S |

---

## F20 — Future-Proofing

| # | File(s) | Finding | Sev | Effort |
|---|---------|---------|-----|--------|
| F20-01 | `auth.js:123,125` + 10 HTML pages | Password `RZ@Premium2026!` contains a hardcoded year. When 2026 ends, the credential will feel stale and require an update across 10+ files. (Related to F7-05 — should be moved server-side entirely.) | H | M |
| F20-02 | 103 HTML pages | `&copy; 2026 Bagus Dwi Permana` hardcoded in every footer (40+ pages found by grep). When the year rolls to 2027, all 103 pages need a manual update. JavaScript `new Date().getFullYear()` would eliminate this forever. | M | M |
| F20-03 | `index.html` JSON-LD | `"dateModified":"2026-03-16"` hardcoded in the `ProfilePage` schema. No automation updates this — it drifts immediately after any page change. | L | S |
| F20-04 | `rz-tracker.js` | `fetch('https://ipapi.co/json/')` — third-party geolocation API. `ipapi.co` free tier has rate limits (1000 req/day). No fallback if the API changes pricing or goes offline. | M | M |
| F20-05 | `rz-chat.js:9` | `API_BASE` points to a Google Cloud Run URL. Cloud Run URLs change if the service is redeployed to a new project or region. No environment-variable abstraction. | M | S |

---

## Summary by Category

| Category | Items | High | Medium | Low |
|----------|-------|------|--------|-----|
| F1 Duplicated code | 8 | 1 | 5 | 2 |
| F2 Stylesheet duplication | 7 | 2 | 4 | 1 |
| F3 Global pollution | 4 | 0 | 2 | 2 |
| F4 Magic numbers | 6 | 0 | 5 | 1 |
| F5 Dead code | 9 | 1 | 5 | 3 |
| F6 Inconsistent naming | 6 | 0 | 2 | 4 |
| F7 Hardcoded paths | 5 | 3 | 1 | 1 |
| F8 Inline event handlers | 4 | 0 | 3 | 1 |
| F9 Comments/TODOs | 5 | 0 | 1 | 4 |
| F10 File organization | 7 | 1 | 3 | 3 |
| F11 Build artifacts | 4 | 1 | 1 | 2 |
| F12 Stylesheet imports | 3 | 0 | 2 | 1 |
| F13 Outdated patterns | 6 | 0 | 2 | 4 |
| F14 Missing documentation | 5 | 0 | 4 | 1 |
| F15 Bundling | 3 | 0 | 2 | 1 |
| F16 Cache strategy | 4 | 1 | 3 | 0 |
| F17 Test coverage | 5 | 3 | 2 | 0 |
| F18 Generator sync | 4 | 1 | 2 | 1 |
| F19 Memory leaks | 6 | 0 | 0 | 6 |
| F20 Future-proofing | 5 | 2 | 2 | 1 |
| **TOTAL** | **93** | **16** | **51** | **39** |

---

## Top Priority Quick Wins (fix before next release)

1. **F7-01** — `localhost:8200` link in `geopolitics.html` (production 404, 1-line fix)
2. **F7-05 / F20-01** — Hardcoded passwords in 10+ HTML files (critical security)
3. **F10-01** — Move 5 session notes off site root (served publicly by GitHub Pages)
4. **F16-01** — Normalise `script.min.js` cache-bust string across all 70 pages
5. **F5-05** — Remove or integrate orphaned `rz-chat.js`
6. **F11-02** — Strengthen `.gitignore` for `.env.*` variants in `Data/`
7. **F18-01** — Run `build-og-images.py --apply` to generate 91 missing OG images
8. **F6-03** — Rename `EPMS_Telemetry.html` to `epms-telemetry.html`
