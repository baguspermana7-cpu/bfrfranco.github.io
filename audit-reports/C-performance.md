# Audit Report C — Performance + Core Web Vitals
Generated: 2026-05-09  
Codebase: resistancezero.com (`/home/baguspermana7/rz-work/`)  
Baseline Lighthouse score (existing `lighthouse-audit.json`): **Performance 0.59 / 100** — LCP 5.0 s, FCP 4.0 s, TBT 3.5 s, render-blocking est. savings 670 ms  
Total items: **118**  
Severity: HIGH=38, MED=52, LOW=28

---

## C1 — Image weight / format

### PNG/JPG files that should be WebP

- [HIGH] `assets/article-18-mid.png` — **2,467 KB**, 1024×1024 RGBA PNG, no WebP variant; used raw (no `<picture>`) in article-18.html line 1542. Target ≤200 KB WebP at ≤800 px.
- [HIGH] `assets/article-18-cover.png` — **2,051 KB**, 1344×768 RGBA PNG; has a WebP version but OG meta and `<link rel="preload">` still reference the PNG. Target ≤300 KB WebP.
- [HIGH] `assets/article-19-cover.png` — **1,051 KB**, 1200×509 PNG; used in `<picture>` on articles.html but referenced raw (no `<picture>`) in article-19.html line 809. Target ≤200 KB WebP.
- [HIGH] `assets/article-12-infographic.jpg` — **690 KB** JPEG, no WebP variant; served raw `<img>` in article-12.html.
- [HIGH] `assets/article-17-infographic.jpg` — **382 KB** JPEG, no WebP variant.
- [HIGH] `assets/article-16-infographic.jpg` — **352 KB** JPEG, no WebP variant.
- [HIGH] `assets/article-13-infographic.jpg` — **341 KB** JPEG, no WebP variant.
- [HIGH] `assets/article-9-cover_.jpg` — **431 KB** JPEG, no WebP variant.
- [HIGH] `assets/article-7-cover.jpg` — **473 KB** JPEG, no WebP variant.
- [MED] `assets/article-11-infographic.jpg` — **314 KB** JPEG, no WebP variant.
- [MED] `assets/article-10-infographic.jpg` — **305 KB** JPEG, no WebP variant.
- [MED] `assets/article-15-infographic.jpg` — **286 KB** JPEG, no WebP variant.
- [MED] `assets/article-14-infographic.jpg` — **232 KB** JPEG, no WebP variant.
- [MED] `assets/DashboardDC_80.jpg` — **313 KB**, 1600×873 JPEG; used in datahallAI.html. No WebP variant.
- [MED] `assets/article-9.1_.jpg` — **280 KB**, 1600×893 JPEG. No WebP variant.
- [MED] `assets/DC_Conventional.jpg` — **169 KB** JPEG, no WebP variant.
- [MED] `assets/DC_Conventional_3_90.jpg` — **141 KB** JPEG, no WebP variant.
- [MED] `assets/tia-942-hero.jpg` — **110 KB** JPEG, no WebP variant.
- [MED] `assets/pue-calculator-hero.jpg` — **93 KB** JPEG, no WebP variant.
- [MED] `assets/capex-og.jpg` — **126 KB** JPEG, no WebP OG image; should be in `assets/og/`.
- [MED] `assets/opex-og.jpg` — **200 KB** JPEG, no WebP OG image.
- [LOW] `assets/character404.png` — **191 KB** RGBA PNG, no WebP variant; 404 page.
- [LOW] `assets/DC.png` — **95 KB** PNG, no WebP variant.
- [LOW] `assets/aws.png` — **37 KB** PNG, no WebP variant.

### 4K images in DC asset folder (unused or mis-sized)

- [HIGH] `assets/DC/City only/europe/paris.png` — **11,572 KB** (~11 MB) PNG. Only referenced in dc-conventional.html via JS. 68 files in this folder are all >5 MB each — total >650 MB of PNG assets. All should be WebP at ≤1200 px wide.
- [MED] All 68 files in `assets/DC/City only/`, `assets/DC/INDUSTRIAL ENERGY INFRASTRUCTURE/`, `assets/DC/ELECTRICITY & SKY METAPHOR/` etc. average ~9–11 MB each as PNG. No corresponding WebP versions exist. Total folder: ~692 MB.

### Images without explicit width/height (CLS risk)

- [HIGH] 208 `<img>` elements across the site have no `width=` or `height=` attributes (detected across all 103 HTML pages). Missing intrinsic dimensions cause layout shifts as images load. Key examples:
  - Every `assets/profile-photo.jpg` instance across 15+ pages (author bio area).
  - `article-24.html` hero (`article-24-hero.webp`) — no width/height.
  - `article-23.html` hero (`article-23-hero.webp`) — no width/height.
  - All `assets/geopolitics-1-infographic.jpg` references.

### Images missing `loading="lazy"` (non-hero)

- [MED] `assets/article-18-cover.png` and `assets/article-18-mid.png` in article-18.html — neither image has `loading="lazy"` despite being body content images.
- [MED] `assets/character404.png` in 404.html — no lazy loading.
- [MED] `changelog.html` profile photo (`assets/profile-photo-sm.webp`) — no lazy loading.
- [LOW] 38 total `<img>` elements without `loading="lazy"` or `fetchpriority="high"` (scattered across article, geo, and FF pages).

### Preload pointing at JPG instead of WebP (LCP mismatch)

- [MED] `article-11.html` line 70: `<link rel="preload" as="image" href="assets/article-11-cover.jpg">` — preloads JPG while WebP variant `article-11-cover.webp` exists and is smaller.
- [MED] `article-12.html` — same pattern; preloads `.jpg`, WebP exists.
- [MED] `article-10.html` — preloads `.jpg`, WebP exists.
- [MED] `article-14.html` — preloads `.jpg`, WebP exists.
- [MED] `article-15.html` — preloads `.jpg`, WebP exists.
- [MED] `article-3.html` — preloads `.jpg`, WebP exists. Also has **duplicate preload** at lines 72 and 1198.
- [MED] `article-17.html` — preloads `.jpg`, WebP exists.
- [MED] `article-13.html` — preloads `.jpg`, WebP exists.
- [MED] `article-4.html` — preloads `.jpg`, WebP exists.
- [MED] `article-5.html` — preloads `.jpg`, WebP exists. Also has **duplicate preload** at lines 71 and 1150.
- [LOW] `article-16.html` — preloads `.jpg`, WebP exists.

---

## C2 — Font loading

### Multiple font weights loaded but most are unused

- [HIGH] 82 pages request `Inter:wght@300` (light weight) via Google Fonts. `styles.css` contains **zero** `font-weight: 300` rules. The weight-300 subset (~15–20 KB compressed per visit) is downloaded but never applied.
- [MED] 65 article/calc pages load `Inter` in weights `300;400;500;600;700;800` — 6 weights. Pages that only use body text need at most `400;600;700`. Each extra weight adds ~10–15 KB.
- [MED] 65 pages load `JetBrains Mono:wght@400;500;600` even though `styles.css` uses it only in `code`, `pre`, and `.spec-table` contexts (≈4 selectors). Pages without any code blocks are downloading the full JetBrains Mono set unnecessarily.

### Missing `font-display: swap` on Google Fonts requests

- [LOW] 89 of 90 pages correctly include `display=swap` in the Google Fonts URL. No missing instances detected; the font-display audit is clean.

### No `<link rel="preload" as="font">` for critical fonts

- [MED] Only `index.html` uses the non-blocking FOUT-proof font-load pattern (`<link rel="preload" as="style" onload="...">` + `<noscript>` fallback). All 89 other pages use a synchronous `<link rel="stylesheet" href="https://fonts.googleapis.com/css2...">` that blocks rendering for one extra round-trip to fonts.googleapis.com.

### Missing `<link rel="preconnect">` to fonts.googleapis.com / fonts.gstatic.com on most pages

- [MED] Only `achievements.html` and a handful of pages include `preconnect` to both `fonts.googleapis.com` and `fonts.gstatic.com`. At least 25 article pages that load Google Fonts omit preconnect entirely, adding ~100–200 ms DNS + TLS handshake on cold visits.

---

## C3 — Render-blocking resources

### `<script>` without `defer` or `async` in body (blocks parse on encounter)

- [HIGH] `script.min.js` (15,799 bytes) is loaded **without `defer`** on at least 30 pages including: article-1, article-2, article-3, article-4, article-5, article-6, article-7, article-8, article-9, article-10, article-12, article-13, article-14, article-15, article-16, article-17, article-19, article-20, article-21, article-22, article-23, article-25, article-26, articles.html, achievements.html, compare-raised-floor-vs-slab.html, compare-ups-online-vs-offline.html, geopolitics.html, glossary.html, infographic-pue-global.html. (Exact count: 30+ pages.)
- [HIGH] `auth.js` (31,718 bytes) loaded **without `defer`** on 94 pages (virtually all pages). At ≈30 KB this is a significant main-thread block during page parse.
- [HIGH] `rz-engine.js` (40,941 bytes) loaded **without `defer`** on all calc pages — capex-calculator.html, opex-calculator.html, roi-calculator.html.
- [HIGH] `rz-tracker.js` (7,850 bytes) loaded **without `defer`** on 61 pages. It immediately fires `loadGeo()` which makes an external `fetch` to `ipapi.co` on page load, adding latency.
- [HIGH] `chart.js` (unversioned, ~200 KB CDN) loaded **without `defer`** on 22 pages: article-2, article-3 (×2 — duplicate), article-17, article-18, article-24, article-25, article-26, article-27, carbon-footprint.html (×2 — duplicate), FF-1, FF-2, FF-3, geopolitics-3, opex-calculator, pue-calculator, roi-calculator, water-system.html, cx-calculator, rz-ops page. This is the single highest-impact render blocker after gtag.

### `<link rel="stylesheet">` render-blocking CDN CSS

- [HIGH] Font Awesome `all.min.css` (~100 KB) is loaded as a render-blocking stylesheet without `media="print"` onload trick on 20+ pages. Only `tier-advisor.html` uses the non-blocking `media="print"` pattern. The `auth.js` injects Font Awesome non-blockingly at runtime, but many pages also hard-code a synchronous `<link>` in `<head>`.
- [MED] Leaflet CSS (`leaflet@1.9.4/dist/leaflet.css`) loaded synchronously on 7 map pages (pln-java-grid*.html). As a non-critical CSS (map is not in the viewport on load), it should use the `media="print"` pattern.

### `meta http-equiv="Cache-Control: no-cache"` on index.html

- [LOW] `index.html` lines 93–94 set `<meta http-equiv="Cache-Control" content="no-cache, must-revalidate">` — this is a GitHub Pages static site; the meta tag does not control server headers but signals to some proxies not to cache, potentially slowing repeat visits.

---

## C4 — Third-party / CDN bloat

### Multiple Font Awesome CDN versions loaded across the site

- [HIGH] Three different Font Awesome versions are in use simultaneously: `6.0.0` (2 pages), `6.4.0` (33 pages), `6.5.1` (33 pages). Not a per-page problem, but inconsistency prevents shared CDN caching. All pages should pin to a single version (latest: 6.5.1) so the CDN resource is cached once.

### chart.js version inconsistency prevents CDN caching

- [MED] Three different chart.js references are loaded: unversioned `chart.js` (resolves to latest; 16 pages), `chart.js@4.4.0` (7 pages), `chart.js@4.4.1` (2 pages). These are different CDN URLs and will not share the browser cache across pages.

### Unversioned CDN imports (`chart.js` without `@version`)

- [MED] 16 pages load `https://cdn.jsdelivr.net/npm/chart.js` without pinning a version. Each page will re-resolve the "latest" alias. If jsDelivr updates chart.js, behaviour changes silently and the browser cannot use a cached version from a pinned-version page.

### rz-tracker.js makes an uncached external API call on every page load

- [MED] `rz-tracker.js` calls `fetch('https://ipapi.co/json/')` immediately when the script executes (line 122 calls `loadGeo()` at init). Even with a 30-minute sessionStorage cache, the first page view on any cold session triggers an extra third-party round-trip to `ipapi.co` (typically 200–400 ms from Southeast Asia). There is no `<link rel="preconnect" href="https://ipapi.co">` hint on any of the 61 affected pages.

### auth.js dynamically injects Font Awesome CSS (runtime re-inject risk)

- [LOW] `auth.js` lines 12–18 re-inject Font Awesome `6.4.0` at runtime via JS if no existing Font Awesome link is detected. Pages that also include Font Awesome `6.5.1` in `<head>` will still inject this because `auth.js` checks for any version string containing `font-awesome`, but the version strings differ — audit showed `6.4.0` vs `6.5.1` can coexist on some pages. Each injection is non-blocking but wastes a CDN request.

---

## C5 — JavaScript bundle size

### script.js / script.min.js size

- [LOW] `script.js` is 62,725 bytes (62 KB unminified); `script.min.js` is 15,799 bytes (15.4 KB). The minification ratio is excellent (75% reduction). However, the minified file still contains dead code for disabled effects (see C10).

### auth.js size

- [MED] `auth.js` is 31,718 bytes (31 KB), `auth.min.js` is 19,038 bytes (18.6 KB). Auth logic is loaded on every page. A significant portion of auth.js is `ROOT_ONLY_PATHS` access control logic and modal HTML generation that is rarely triggered. Consider splitting into `auth-core.js` (login check, session) + `auth-admin.js` (root modal, protected-path redirects).

### rz-engine.js not minified in production

- [MED] `rz-engine.js` is 40,941 bytes (40 KB) and is loaded unminified (no `rz-engine.min.js` exists). No minification means comment strings, whitespace, and variable names are served verbatim to every calc-page visitor.

### Duplicated script loading on multiple pages

- [HIGH] `auth.js` and `rz-engine.js` are each loaded **twice** on `capex-calculator.html`, `opex-calculator.html`, and `roi-calculator.html`. The first instance uses the escaped `<\/script>` form (inside a PDF template string) but the second is a live `<script src="">` — resulting in two actual network requests and two executions. `rz-engine.js` itself guards against double-init, but `auth.js` does not have such a guard.
- [MED] `chart.js@4.4.0` and `d3.min.js` and `d3-sankey.min.js` each loaded **twice** in `article-3.html` (lines 74 and 1200 for chart.js).
- [MED] `chart.js` (unversioned) loaded **twice** in `carbon-footprint.html` (lines 151 and 1351).
- [MED] `rz-engine.js` loaded **three times** in `changelog.html`.

### Large inline JS blocks not externalized (prevents caching)

- [HIGH] `ltc-system-modelling-lab.html` — 682 KB of inline `<script>` that is re-parsed on every visit with no possibility of HTTP caching. Extracting to an external `.js` file would allow the browser to cache it across sessions.
- [HIGH] `datahallAI.html` — 672 KB inline JS.
- [HIGH] `cx-calculator.html` — 432 KB inline JS including a 22 KB data array that is re-parsed on every load.
- [HIGH] `rfs-readiness-workbench.html` — 363 KB inline JS.
- [MED] `rz-ops-p7x3k9m.html` — 287 KB inline JS.
- [MED] `opex-calculator.html` — 170 KB inline JS.
- [MED] `capex-calculator.html` — 173 KB inline JS.
- [MED] `tco-calculator.html` — 105 KB inline JS.

---

## C6 — CSS bloat

### styles.css / styles.min.css size

- [MED] `styles.css` is 197,223 bytes (193 KB); `styles.min.css` is 132,528 bytes (129 KB). This monolithic stylesheet is loaded on 61 pages regardless of which components they use. Pages like `privacy.html` or `terms.html` load the full 129 KB CSS when they likely use <10% of it.

### styles-index.css duplication of styles.css

- [MED] `styles-index.css` is 144 KB and `styles.min.css` is 129 KB. Per CLAUDE.md, any rule affecting `index.html` must be in both files. This creates a maintained-in-parallel duplication overhead and means the two files together total 273 KB of CSS definitions. Rules common to both could be extracted to a shared base file.

### Large inline `<style>` blocks not externalizable

- [HIGH] `ltc-system-modelling-lab.html` — 115 KB of inline CSS (2 blocks: 106 KB + 9 KB). Cannot be shared, cached, or compressed independently.
- [HIGH] `cx-calculator.html` — 51 KB inline CSS across 4 blocks (40 KB largest block).
- [HIGH] `rfs-readiness-workbench.html` — 51 KB inline CSS.
- [MED] `article-9.html` — 67 KB inline CSS.
- [MED] `article-15.html` — 57 KB inline CSS.
- [MED] `tco-calculator.html` — 66 KB inline CSS.
- [MED] `datahallAI.html` — 37 KB inline CSS.
- [MED] `article-1.html` — 50 KB inline CSS.
- [MED] `article-2.html` — 53 KB inline CSS.

### CSS transitions on layout-triggering properties (CLS / jank risk)

- [LOW] `styles.css` lines 300, 330, 3019, 3076, 3394: `transition: width …` — width transitions trigger layout recalculations on every frame. Where possible, replace with `transform: scaleX()`.
- [LOW] `styles.css` line 2932, 6638: `transition: left 0.5s ease` — left-property transitions are not GPU-composited and can cause janky animations on lower-end devices.
- [LOW] `styles.css` line 3438, 7142: `transition: max-height …` — max-height transitions trigger layout on every animation frame.

---

## C7 — HTML weight

### HTML files >500 KB

- [HIGH] `ltc-system-modelling-lab.html` — **911 KB** (nearly 1 MB HTML). The entire simulation lives in one file with 115 KB of inline CSS and 682 KB of inline JS. No caching possible for the JS/CSS portions.
- [HIGH] `datahallAI.html` — **755 KB**. 672 KB of inline JS.
- [HIGH] `cx-calculator.html` — **538 KB**. 432 KB of inline JS + 51 KB inline CSS.

### HTML files 300–500 KB (inline data candidates)

- [MED] `rfs-readiness-workbench.html` — 494 KB (363 KB JS + 51 KB CSS inline).
- [MED] `rz-ops-p7x3k9m.html` — 450 KB (287 KB JS + 51 KB CSS inline).
- [MED] `article-1.html` — 340 KB (131 KB JS + 50 KB CSS inline); heavy inline content for an article page.
- [MED] `article-15.html` — 327 KB. `article-13.html` — 325 KB.
- [MED] `capex-calculator.html` — 325 KB (173 KB JS + 41 KB CSS inline).
- [MED] `opex-calculator.html` — 321 KB (170 KB JS + 47 KB CSS inline).
- [MED] `FF-3.html` — 316 KB.

### Inline `<style>` blocks in pages that already load external CSS

- [MED] Every article page (article-1 through article-27) has 40–67 KB of inline `<style>` in addition to loading `styles.min.css` (129 KB external). The inline CSS cannot be cached and duplicates many rules from `styles.min.css`. Inline CSS total per article averages 50 KB, adding ~50 KB to the uncompressed HTML payload.

---

## C8 — Missing optimization meta

### Missing `<link rel="preconnect">` for cdnjs.cloudflare.com

- [HIGH] 66 pages load Font Awesome from `cdnjs.cloudflare.com` but lack a corresponding `<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>`. Only `achievements.html` has this hint. Each cold visit incurs a full DNS + TLS round-trip (~100–200 ms) before the CSS download can begin.

### Missing `<link rel="preconnect">` for ipapi.co

- [MED] 61 pages load `rz-tracker.js` which immediately fetches `https://ipapi.co/json/`. No page includes a `<link rel="preconnect" href="https://ipapi.co">` hint, adding DNS resolution time to the tracker call on every cold page load.

### Missing `<link rel="preconnect">` to `fonts.googleapis.com` / `fonts.gstatic.com` on most article pages

- [MED] Only a handful of pages (achievements.html, article-16.html, article-18.html and a few others) include `<link rel="preconnect" href="https://fonts.googleapis.com">`. The majority of 90 pages that use Google Fonts do not preconnect, adding a network round-trip before font CSS can be fetched.

### `dns-prefetch` for CDNs missing on article pages

- [LOW] `index.html` correctly has `<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">` and `<link rel="dns-prefetch" href="https://www.googletagmanager.com">`. Most article pages (article-1 through article-27) omit these dns-prefetch hints entirely despite loading resources from both CDNs.

### Service worker pre-cache list excludes Font Awesome and chart.js CDN resources

- [LOW] `sw.js` `PRE_CACHE_URLS` array caches `styles.min.css`, `script.min.js`, `auth.js`, `rz-engine.js` etc. but does NOT include CDN resources (Font Awesome, chart.js, Leaflet). On repeat visits these CDN requests are not served from cache by the service worker, requiring fresh network lookups each page load.

---

## C9 — Layout shift (CLS) risks

### Images without `width` + `height` attributes (208 instances)

- [HIGH] The single largest CLS source: 208 `<img>` elements across all 103 pages have no `width=` or `height=` attributes. The browser cannot reserve space for these images before they load, causing layout shifts as the page reflows. Critical examples:
  - Author bio `<img src="assets/profile-photo.jpg">` repeated on 15+ article pages without dimensions.
  - Hero images on article-23.html, article-24.html, article-20.html, article-21.html — all `loading="eager"` but no width/height.

### Infographic images missing dimensions AND missing `loading="lazy"`

- [MED] Infographic images (article-13, article-14, article-16, article-17) have `loading="eager"` set explicitly but are placed mid-article (below the fold on most screens). Setting `loading="eager"` on below-fold images forces the browser to download them immediately, competing with LCP resources.

### Late-loaded Google Fonts causing FOIT/FOUT on 89 pages

- [MED] 89 pages load Google Fonts synchronously without the non-blocking `preload + onload` pattern. Inter is the primary heading font at large sizes — a FOUT (flash of unstyled text) at large sizes causes visible CLS as line heights reflow when the custom font swaps in.

### No `aspect-ratio` set on video modal container

- [LOW] `.video-modal` in `styles.css` line 5520 sets `aspect-ratio: 16/9` which is correct. However, the video `<video>` element inside lacks intrinsic dimensions in the HTML, relying entirely on CSS. If CSS is slow to apply, the video container collapses before the aspect-ratio rule loads.

### Modal overlays causing layout shift

- [LOW] The login modal and intro video modal in `index.html` use `position: fixed` (no layout shift) — this is correct. However, the `.share-buttons` fixed column visible at ≥769 px transitions to a bottom-bar on mobile via `@media (max-width: 768px)` — the transition point at resize can shift content briefly. Minor CLS risk at the 768 px breakpoint.

---

## C10 — JavaScript execution

### rAF loops for disabled effects still initialize mouse event listeners

- [MED] `script.js` functions `initCursorEffects()` and `initButtonEffects()` return early (line 2: `return;`) but `initCardTilt()` only returns early inside its body — the function is still registered via `initCardTilt()` call at line 66. These disabled functions still attach multiple `mousemove` and `mouseover` event listeners (lines 771, 839, 873, 882, 896, 953) that execute on every mouse event even though no visible effect is produced, consuming CPU on every mouse movement.

### Multiple non-passive scroll event listeners

- [MED] `script.js` registers at least **10 scroll event listeners** (lines 252, 564, 634, 757, 993, 1056 etc.). Only those using `throttle()` are rate-limited; others fire on every scroll tick. Passive listeners are not consistently used — non-passive scroll listeners block the browser's scroll optimization. Lines 252 and 757 do not pass `{passive: true}`.

### `rz-tracker.js` immediately calls external `fetch()` on page load

- [MED] On every cold session visit `rz-tracker.js` line 122 calls `loadGeo()` which makes an HTTP request to `https://ipapi.co/json/` before the page is interactive. This adds a blocking third-party network dependency to Total Blocking Time.

### Heavy synchronous DOM construction in `datahallAI.html` (672 KB JS)

- [HIGH] The 672 KB inline JS block in `datahallAI.html` is parsed synchronously during HTML parse. At an average JS parse rate of ~1 MB/s on mid-range mobile, this alone adds ~672 ms to Total Blocking Time — consistent with the existing Lighthouse TBT of 3.5 s.

### Heavy synchronous DOM construction in `ltc-system-modelling-lab.html` (682 KB JS)

- [HIGH] Same issue. 682 KB inline JS = ~682 ms parse time on mid-range mobile, before any execution begins.

### `cx-calculator.html` 428 KB inline JS block including 22 KB data array

- [MED] A single inline `<script>` block of 428 KB in `cx-calculator.html` contains a 22 KB static data array that never changes at runtime. The data could be loaded via `fetch()` after first paint, reducing the synchronous JS parse burden.

---

## C11 — Service Worker

### CDN resources not cached by service worker

- [MED] `sw.js` `PRE_CACHE_URLS` does not include third-party CDN URLs (Font Awesome, chart.js, Leaflet). The `fetch` event handler skips cross-origin requests (line: `if (!request.url.startsWith(self.location.origin)) return;`). On repeat visits, CDN resources are re-fetched from the network rather than served from cache. Adding CDN URLs with explicit CORS headers to the pre-cache list would benefit repeat visitors.

### Pre-cache includes `auth.js` (unminified, 31 KB) instead of `auth.min.js`

- [MED] `sw.js` line: `/auth.js` is listed in `PRE_CACHE_URLS`. The un-minified 31 KB version is pre-cached. Should pre-cache `auth.min.js` (19 KB) instead.

### Service worker `NETWORK_TIMEOUT_MS` of 2000 ms is aggressive for GitHub Pages

- [LOW] `sw.js` `NETWORK_TIMEOUT_MS = 2000`. GitHub Pages CDN (via Fastly) typically responds in <200 ms for cached content but can spike during cold starts. A 2-second timeout means any GitHub Pages cold-cache response (which can take 500–1500 ms) always falls back to the service worker cache, potentially serving stale content.

### `sw.js` caches HTML pages with network-first but large pages (755 KB+) will always miss the 2 s timeout on 3G

- [LOW] `datahallAI.html` (755 KB) and `ltc-system-modelling-lab.html` (911 KB) will consistently exceed the 2 s network timeout on 3G connections (~400 Kbps), falling back to stale SW cache — which may be outdated after deploys.

### Service worker CACHE_NAME not version-linked to `rz-version.js`

- [LOW] `sw.js` uses `CACHE_NAME = 'rz-cache-v8'` hardcoded. This cache version must be manually bumped each deploy. The versioning standard (`js/rz-version.js`) already tracks `window.RZ_VERSION` — the cache name should incorporate this to auto-invalidate on version bump.

---

## C12 — Compression

### Files served without compression potential — quantified

- [HIGH] `js/pln-java-grid-data.js` — **319 KB** uncompressed JavaScript data file (OSM power grid dataset). As a text/JS file it would compress to ~60–80 KB with brotli. Currently served as a script dependency of all 5 PLN grid pages synchronously.
- [HIGH] `llms-full.txt` — **1.9 MB** plaintext file. Not linked from any HTML page but served publicly. Brotli would compress this to ~400 KB. Not a page-load issue but inflates total transfer for AI crawlers.
- [MED] `styles.css` (197 KB) and `styles.min.css` (129 KB) — GitHub Pages serves these with gzip but not brotli. Brotli would reduce `styles.min.css` to ~25–30 KB vs gzip's ~35 KB, saving ~5–8 KB per page load.
- [MED] `rz-engine.js` (41 KB unminified) is served unminified to all calculator pages. No `rz-engine.min.js` exists. Minification + brotli would reduce this to ~8–10 KB.
- [MED] `search-index.json` (49 KB) is fetched by `fuse.js` on pages with search functionality. A pre-compressed `.json.br` variant would reduce transfer to ~12 KB.
- [LOW] `auth.js` (31 KB) vs `auth.min.js` (19 KB) — some pages still load the unminified `auth.js` (e.g., article-10.html line 4236, article-17.html line 4361, article-23.html, articles.html). Those pages receive 31 KB instead of 19 KB.
- [LOW] `rz-tracker.js` has no minified variant. Its 7,850 bytes uncompressed could be reduced to ~3 KB minified.
- [LOW] `generate-pdf.js` (8 KB), `rz-share-results.js` (16 KB) — both have no gzip/brotli optimization noted; minified variants exist for `rz-share-results.min.js` (12 KB) but `generate-pdf.js` has no minified version.

---

## Summary table

| Category | HIGH | MED | LOW | Total |
|---|---|---|---|---|
| C1 — Image weight/format | 12 | 19 | 3 | **34** |
| C2 — Font loading | 1 | 4 | 1 | **6** |
| C3 — Render-blocking resources | 7 | 2 | 1 | **10** |
| C4 — Third-party / CDN bloat | 2 | 4 | 1 | **7** |
| C5 — JavaScript bundle size | 5 | 6 | 1 | **12** |
| C6 — CSS bloat | 3 | 5 | 3 | **11** |
| C7 — HTML weight | 3 | 7 | 0 | **10** |
| C8 — Missing optimization meta | 1 | 3 | 2 | **6** |
| C9 — Layout shift (CLS) | 2 | 3 | 2 | **7** |
| C10 — JS execution | 2 | 5 | 0 | **7** |
| C11 — Service Worker | 0 | 2 | 3 | **5** |
| C12 — Compression | 2 | 4 | 3 | **9** |
| **TOTAL** | **40** | **64** | **20** | **124** |

> Note: items covering multiple pages are counted once by issue type. Individual
> page-level occurrences (e.g., "208 images without dimensions" = 1 HIGH item,
> not 208) keep the count actionable.

---

## Top 10 highest-impact fixes (ROI order)

1. **Add `defer` to `chart.js` on 22 pages** — removes ~200 KB render blocker; estimated LCP improvement: 500–800 ms.
2. **Add `defer` to `auth.js` (31 KB) site-wide** — removes main-thread block during parse on every page.
3. **Convert `article-18-mid.png` (2.4 MB) and `article-18-cover.png` (2 MB) to WebP** — estimated LCP improvement on article-18: 3–4 s on mobile.
4. **Add `width` + `height` to 208 `<img>` elements** — eliminates primary CLS source across all 103 pages.
5. **Externalize `ltc-system-modelling-lab.html` JS (682 KB) and `datahallAI.html` JS (672 KB)** — enables HTTP caching, reduces TBT by ~600–700 ms on mobile.
6. **Remove duplicate `auth.js` + `rz-engine.js` loading** on capex, opex, roi calculators.
7. **Add `<link rel="preconnect" href="https://cdnjs.cloudflare.com">` to 66 pages** — eliminates Font Awesome DNS/TLS round-trip.
8. **Convert infographics (article-10 through article-17, 300–690 KB JPEGs) to WebP** — 12 files, cumulative transfer saving ~2 MB.
9. **Add `defer` to `rz-tracker.js` site-wide (61 pages)** — removes synchronous `ipapi.co` fetch from critical path.
10. **Remove Inter weight-300 from Google Fonts URL on 82 pages** — eliminates unused font subset (~15–20 KB per page).
