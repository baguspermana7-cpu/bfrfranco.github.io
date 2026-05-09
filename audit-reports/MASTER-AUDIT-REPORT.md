# Master Audit Report — resistancezero.com

> Generated: 2026-05-09 (v1.8.5 baseline)
> Total items: **759 across 6 categories**
> User-mandated minimum: 500 (target exceeded by 259)

---

## Item count by category

| Report | Items | Top concern |
|---|---|---|
| **A — Functionality + JS bugs** | **157** | `subscribeNewsletter()` missing on 6 articles · "Second Brain" navbar link broken on 62 pages · plaintext passwords in 31 pages · 31 `prompt()` calls · `datahallAI.html` 4 duplicate input IDs |
| **B — Accessibility** | **119** | 75 files with no `<th scope=>` · 49 pages no skip-link · 23 pages double `<h1>` · color contrast 2.96:1 (fails WCAG AA) |
| **C — Performance** | **124** | Lighthouse 0.59 / LCP 5.0s · 208 imgs without width/height (CLS) · 911 KB ltc-system-modelling-lab.html · auth.js+rz-engine.js loaded twice on calc pages |
| **D — SEO + AI search** | **111** | 67 pages missing ai-content-declaration · glossary.html broken JSON-LD · 4 orphan pages · llms-full.txt incorrectly listed as Sitemap |
| **E — Mobile/Consistency/Security** | **155** | GA before GDPR consent on 98 pages · 113 `target=_blank` without noopener · `new Function()` w/ user input · no CSP · malformed `target="<em>blank"` in changelog |
| **F — Code quality / tech debt** | **93** | localhost:8200 link in geopolitics · plaintext `RZ@Premium2026!` password in 10+ pages · Firebase API key committed · zero unit tests |
| **TOTAL** | **759** | — |

---

## Top 50 highest-impact items (auto-fix candidates)

Severity HIGH + medium-effort or low-effort. Prioritized by impact × ease.

### Security (ship in v1.9.0)

1. **A4-XSS-01** — `geopolitics.html:776` hardcoded `http://localhost:8200` link in production. **Fix**: remove or replace with proper URL.
2. **F7-04** — Firebase API key committed in `firebase-config.js` (public GitHub repo). **Fix**: rotate key + move to env var pattern (note: GitHub Pages has no env vars; consider deleting if unused).
3. **F7-05** — Plaintext password `RZ@Premium2026!` in 10+ HTML files + `auth.js` + `firebase-auth.js`. **Fix**: client-side passwords are inherently insecure; document this is demo-only OR move to server-side validation.
4. **E3-2** — 113 `target="_blank"` without `rel="noopener noreferrer"`. **Fix**: regex sweep adds `rel="noopener noreferrer"` everywhere.
5. **E3-3** — `new Function()` with user-controlled input in `ltc-system-modelling-lab.html:7294`. **Fix**: replace with safe parser (Math.js or whitelist allowed operations).
6. **E10-1** — Google Analytics fires before GDPR consent on 98 pages. **Fix**: gate `gtag()` calls behind cookie-banner consent check.
7. **E2-MAL-1** — Malformed `target="<em>blank"` in `changelog.html:1351` (HTML injection in CHANGELOG.md content rendering). **Fix**: HTML-escape changelog rendering.
8. **F11-02** — `.gitignore` only guards `.env`, not `.env.production`/`.env.staging`. **Fix**: extend gitignore.

### Functionality (ship in v1.9.1)

9. **A1-NEW-01** — `subscribeNewsletter()` missing/undefined on 6 articles (3, 9, 10, 14, 15, 19). **Fix**: implement or remove the form.
10. **A3-NEW-01** — `subscribeNewsletter()` is a fake handler on 16 pages (localStorage only, no HTTP). **Fix**: integrate real backend OR document as demo / remove.
11. **A1-EXP-01** — `exportToPDF()` in `article-10.html` is a dev stub showing alert. **Fix**: implement or remove button.
12. **A1-FF-MODAL-01** — FF-1/2/3 modal close buttons have NO `onclick` handler. **Fix**: wire up close.
13. **A2-SECONDBRAIN-01** — "Second Brain" navbar link points to non-existent `Apps/second brain/index.html` on 62+ pages. **Fix**: remove or redirect to actual page.
14. **A2-IMAGES-01** — 16 article inline images missing (article-1 through article-8). **Fix**: regenerate or remove broken refs.
15. **A2-BADGES-01** — 9 badge/CV assets missing on index.html + datacenter-solutions.html. **Fix**: regenerate or remove.
16. **A5-DUP-01** — `datahallAI.html` 4 duplicate input IDs (eMSB, eUPS, eBat, eBw) — calculator reads wrong element silently. **Fix**: rename to unique IDs.
17. **A5-DUP-02** — `article-12.html` 2 duplicate IDs — calculator broken. **Fix**: rename.
18. **A6-SKIP-01** — Skip-to-content link on `404.html` + `datacenter-solutions.html` points to non-existent target. **Fix**: add `id="main-content"` to main element.
19. **A8-AUTH-01** — `_rzAuth.getSession()` called without null guard on dashboard, dc-conventional, dc-market-tracker, datahallAI. **Fix**: wrap in `if (window._rzAuth) { ... }`.
20. **A1-PROMPT-01** — 31 `prompt()`/`alert()`/`confirm()` calls violating AUTH_STANDARD. **Fix**: replace with auth.js modal.

### SEO + AI search (ship in v1.9.2)

21. **D1-001** to **D1-024** — 24 pages with title or meta-description out of 30-60 / 120-160 char range. **Fix**: trim to range.
22. **D2-001** — `glossary.html` JSON-LD has empty `@type` (validators reject). **Fix**: set proper @type.
23. **D2-002** — `datahallAI.html` + `ltc-system-modelling-lab.html` have ZERO JSON-LD. **Fix**: add Article + WebApplication schemas.
24. **D3-001** — `pln-java-grid-jatim.html` has 3 links to non-existent `pln-java-grid-jateng-diy.html`. **Fix**: update to existing path.
25. **D3-002** — 3 pillar pages + achievements.html are completely orphaned. **Fix**: link from articles or solutions hub.
26. **D4-001** — `changelog.html` (noindex) + `404.html` are in sitemap.xml (shouldn't be). **Fix**: regen sitemap with proper exclusion.
27. **D5-001** — 7 recent articles missing `hreflang="x-default"`. **Fix**: add the tag.
28. **D6-002** — `Applebot`, `FacebookBot`, `LinkedInBot`, `DuckDuckBot`, `CCBot` not in robots.txt. **Fix**: add explicit allows.
29. **D7-001** — 67 pages missing `ai-content-declaration` meta. **Fix**: extend `tools/insert-version-script.py` to include this.
30. **D8-001** — 35 pages use `assets/profile-photo.jpg` (200px portrait) as og:image. **Fix**: extend `tools/build-og-images.py` TARGETS list.

### Performance (ship in v1.9.3)

31. **C1-PNG-01** — `assets/article-18-mid.png` is 2.4 MB without WebP. **Fix**: convert to WebP @ 85%, ≤200 KB.
32. **C1-DC-FOLDER** — `assets/DC/` 68 PNG files averaging 9-11 MB (~650 MB total). **Fix**: bulk WebP convert.
33. **C1-DIM-01** — 208 `<img>` elements lack width/height (primary CLS source). **Fix**: extract dimensions + inject attrs.
34. **C3-CHART** — `chart.js` (200 KB CDN) loaded synchronously without `defer` on 22 pages. **Fix**: add `defer`.
35. **C3-AUTH** — `auth.js` (31 KB) without `defer` on 94 pages. **Fix**: add `defer` everywhere.
36. **C5-DUP-AUTH** — `auth.js` + `rz-engine.js` loaded TWICE on capex/opex/roi calculators. **Fix**: dedup.
37. **C7-LTC** — `ltc-system-modelling-lab.html` is 911 KB. **Fix**: extract inline JS + lazy-load.
38. **C12-NOMIN** — `rz-engine.js` (41 KB) has no minified version. **Fix**: minify with terser.

### Accessibility (ship in v1.9.4)

39. **B1-PATTERN** — All article-card image thumbnails have `alt=""` (should describe content). **Fix**: regex to populate alt with article title.
40. **B2-001** — 23 pages have double `<h1>` (PDF templates leaking into DOM). **Fix**: change inner h1 to h2 inside print-window template strings.
41. **B3-FORM-01** — All `<input>` in calculator pages lack associated `<label for=>` (60+ inputs). **Fix**: add `for=` attributes.
42. **B5-CONTRAST-01** — `#6b7280` on `#0f172a` = 2.96:1 (fails AA 4.5:1). Affects `.bento-tag`, `.bento-exp-desc`. **Fix**: bump to `#94a3b8` (4.6:1).
43. **B11-TABLES** — All 75 files with tables have ZERO `scope=` on `<th>`. **Fix**: regex sweep adds `scope="col"` / `scope="row"`.
44. **B12-SKIP** — 49 pages have NO skip-link. **Fix**: inject `<a href="#main-content" class="skip-link">` site-wide.

### Tech debt (ship in v1.9.5)

45. **F2-01** — `.share-buttons` block duplicated in styles.css + styles-index.css. **Fix**: extract to `rz-shared.css` referenced by both.
46. **F1-01** — `rz-share-results.js` exists but loaded by zero pages; 130 duplicate function defs across 33 pages. **Fix**: load the shared file, remove inline copies.
47. **F16-01** — `script.min.js` has 6 different `?v=` cache-bust strings across 70 pages. **Fix**: normalize to one.
48. **F18-01** — 91 of 103 pages have no per-page OG image; build-og-images.py covers only 12. **Fix**: extend TARGETS to all main pages.
49. **F10-01** — 5 session-note `.md` files at site root served publicly by GitHub Pages. **Fix**: move to `Article/sessions/` (gitignored).
50. **E15-1** — Service Worker pre-cache URL mismatch with versioned assets (cache miss on every nav). **Fix**: dynamic version-aware cache list.

---

## Aggregate severity (estimate across all reports)

- **HIGH**: ~140 items (privacy, security, broken functionality)
- **MEDIUM**: ~430 items (UX gaps, perf, SEO, a11y) 
- **LOW**: ~190 items (polish, consistency, comments)

---

## Per-report links

- [A — Functionality + JS bugs](./A-functionality.md)
- [B — Accessibility](./B-accessibility.md)
- [C — Performance + Core Web Vitals](./C-performance.md)
- [D — SEO + AI search + structured data](./D-seo.md)
- [E — Mobile UX + cross-page consistency + security](./E-mobile-consistency-security.md)
- [F — Code quality / tech debt](./F-tech-debt.md)

---

## Next-step roadmap

| Phase | Version | Scope | Estimated commits |
|---|---|---|---|
| **Critical security + privacy** | v1.9.0 | Items 1-8 | 4-6 commits |
| **Broken functionality** | v1.9.1 | Items 9-20 | 6-10 commits |
| **SEO sweep** | v1.9.2 | Items 21-30 | 3-5 commits |
| **Performance** | v1.9.3 | Items 31-38 | 5-8 commits (incl WebP batch convert) |
| **Accessibility** | v1.9.4 | Items 39-44 | 4-6 commits |
| **Tech debt** | v1.9.5 | Items 45-50 | 6-8 commits |
| **Long tail** | v2.0.0 | Remaining 700+ items | rolling |

Total estimated commits: 28-43 (excluding the long tail).
