# UI Features Standardization

> **Created**: 2026-02-24
> **Applies to**: All article pages (article-1 through article-18) + geopolitics-1.html
> **Dependencies**: `styles.css` (global), `search-index.json`, Fuse.js CDN

---

## Overview

Seven UI features are implemented across all articles:

| # | Feature | Purpose | Effort |
|---|---------|---------|--------|
| 21 | Global Search | Navbar search with instant fuzzy results | Medium |
| 22 | Reading Progress Bar | Scroll progress indicator at top | Small |
| 23 | TOC Sidebar | Sticky table of contents with section highlighting | Medium |
| 24 | Series Navigation | Article series badge with prev/next links | Small |
| 28 | Cookie Consent Banner | GDPR-style cookie consent with GA toggle | Small |
| 29 | Reading Time Badge | Estimated reading time on article cards | Small |
| 30 | Scroll to Top Button | Fixed button to smooth-scroll to page top | Small |

---

## Feature 21: Global Search

### How It Works
- **Trigger**: Click search icon in navbar OR press `Ctrl+K` / `Cmd+K`
- **Engine**: Fuse.js v7.0.0 (CDN, loaded with `defer`)
- **Index**: `search-index.json` — 29 entries (18 articles + 7 calculators + 3 tools + geopolitics-1)
- **Matching**: Fuzzy search across title (0.4), description (0.25), keywords (0.25), category (0.1)
- **Threshold**: 0.35 fuzzy tolerance, minimum 2 character match length
- **Navigation**: Arrow keys to navigate, Enter to open, ESC to close
- **Results**: Max 8 shown, with icon (article number / category icon), title, description

### Enhanced Features (added 2026-02-25)

#### Hover Preview Panel
- **Width**: Modal expanded to 780px (from 600px); right-side preview pane is 220px
- **Content**: Hero image thumbnail, category, title, description, reading time badge
- **Trigger**: Hover on result item or keyboard-focus (arrow keys)
- **Mobile**: Hidden below 768px; modal reverts to 92vw

#### Match Highlighting
- **Config**: `includeMatches: true` in Fuse.js options
- **Rendering**: Match indices wrapped in `<mark class="search-highlight">`
- **Applied to**: title and description fields
- **Styling**: Yellow/amber in light mode, blue tint in dark mode

#### Category Filter Chips
- **Chips**: All | Articles | Calculators | Tools
- **Position**: Between search input and results area
- **Behavior**: Filter results by category; "All" shows everything
- **Active chip**: Accent color fill
- **Scrollable**: Horizontal scroll on mobile

#### Recent Searches
- **Storage**: `localStorage` key `rz-search-recent`, stores last 3 queries as JSON array
- **Display**: On empty modal open (no query), shows recent searches with clock icons
- **Save trigger**: When user clicks a result or presses Enter on focused result
- **Clear**: "Clear" button removes all recent searches

### CSS Classes
| Class | Purpose |
|-------|---------|
| `.nav-search-btn` | Search icon button in navbar |
| `.search-overlay` | Dark backdrop behind modal |
| `.search-modal` | Modal container (780px desktop, 92vw mobile) |
| `.search-input-wrap` | Input row with icon + kbd hint |
| `.search-input` | The text input |
| `.search-chips` | Category filter chip row |
| `.search-chip` | Individual filter chip button |
| `.search-chip.active` | Currently active filter |
| `.search-body` | Flex container for results + preview |
| `.search-results` | Scrollable results container |
| `.search-result-item` | Individual result link |
| `.search-result-icon` | Left icon (article number or category) |
| `.search-result-icon.calc` | Yellow icon for calculators |
| `.search-result-icon.tool` | Green icon for tools |
| `.search-result-title` | Result title |
| `.search-result-desc` | Result description |
| `.search-result-category` | Category label above title |
| `.search-highlight` | `<mark>` tag for fuzzy match highlighting |
| `.search-preview` | Right-side preview pane |
| `.search-preview.visible` | Preview pane shown state |
| `.search-preview-img` | Hero image thumbnail (16:9 aspect) |
| `.search-preview-cat` | Category label in preview |
| `.search-preview-title` | Title in preview |
| `.search-preview-desc` | Description in preview |
| `.search-preview-badge` | Reading time badge in preview |
| `.search-preview-empty` | Placeholder when no item hovered |
| `.search-recent` | Recent searches container |
| `.search-recent-header` | Header row (label + clear button) |
| `.search-recent-label` | "Recent" label |
| `.search-recent-clear` | Clear button |
| `.search-recent-item` | Individual recent search row |
| `.search-empty` | "No results" placeholder |
| `.search-footer` | Bottom bar with keyboard hints |
| `.search-kbd` | Keyboard shortcut badge styling |

### HTML Structure (in `<body>`, before navbar)
```html
<div class="search-overlay" id="searchOverlay"></div>
<div class="search-modal" id="searchModal">
    <div class="search-input-wrap">
        <svg>...</svg>
        <input class="search-input" id="searchInput" ...>
        <kbd class="search-kbd">ESC</kbd>
    </div>
    <div class="search-chips" id="searchChips">
        <button class="search-chip active" data-filter="all">All</button>
        <button class="search-chip" data-filter="articles">Articles</button>
        <button class="search-chip" data-filter="calculators">Calculators</button>
        <button class="search-chip" data-filter="tools">Tools</button>
    </div>
    <div class="search-body">
        <div class="search-results" id="searchResults">
            <div class="search-empty">Type to search across all content</div>
        </div>
        <div class="search-preview" id="searchPreview">
            <div class="search-preview-empty">Hover a result to preview</div>
        </div>
    </div>
    <div class="search-footer">
        <span><kbd>&uarr;&darr;</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Open</span>
    </div>
</div>
```

### Navbar Button (between `</ul>` and theme-toggle)
```html
<button class="nav-search-btn" id="navSearchBtn" aria-label="Search" title="Search (Ctrl+K)">
    <svg>...</svg>
</button>
```

### Search Index Format (`search-index.json`)
```json
[
  {
    "id": 1,
    "title": "Article Title",
    "url": "article-1.html",
    "description": "Short description",
    "category": "Operations",
    "keywords": ["keyword1", "keyword2"],
    "image": "assets/article-1-cover.webp",
    "readingTime": 6
  }
]
```

**Fields**:
- `id`: Sequential integer
- `title`: Display title
- `url`: Relative URL
- `description`: Short summary (shown in results + preview)
- `category`: One of: Operations, Engineering, Policy, Analysis, Sustainability, Leadership, Business, Geopolitics, Calculator, Tool
- `keywords`: Array of 5-8 relevant terms
- `image`: Relative path to cover image (webp preferred), or `null` for tools/calculators without covers
- `readingTime`: Estimated reading time in minutes (integer)

### Category Filter Mapping
| Category value | Filter chip |
|----------------|-------------|
| Operations, Engineering, Policy, Analysis, Sustainability, Leadership, Business, Geopolitics | Articles |
| Calculator | Calculators |
| Tool | Tools |

### localStorage Keys
| Key | Purpose | Format |
|-----|---------|--------|
| `rz-search-recent` | Recent search queries | JSON array of up to 3 strings |

### Pages with Search (24 total)
article-1 through article-18, geopolitics-1, index.html, articles.html, geopolitics.html, insights.html, datacenter-solutions.html

### When Adding New Articles
1. Add entry to `search-index.json` with next sequential ID (include `image` and `readingTime`)
2. Include 5-8 relevant keywords
3. Copy the search modal HTML block (overlay + modal with chips + preview) from any existing article
4. Copy the search IIFE `<script>` block from any existing article
5. Category options: Operations, Engineering, Policy, Analysis, Sustainability, Leadership, Business, Geopolitics, Calculator, Tool

---

## Feature 22: Reading Progress Bar

### How It Works
- 4px gradient bar fixed to viewport top (`z-index: 9999`)
- Width updates via `requestAnimationFrame` on scroll (passive listener)
- Light mode: gold → orange → coral gradient with glow
- Dark mode: blue → gold → orange gradient with glow

### CSS Classes
| Class | Purpose |
|-------|---------|
| `.scroll-progress` | The progress bar element (already in styles.css since initial build) |

### HTML (first element after `<body>`)
```html
<div class="scroll-progress" id="scrollProgress"></div>
```

### JS Logic
```javascript
var pct = (scrollTop / (docHeight - windowHeight)) * 100;
bar.style.width = Math.min(pct, 100) + '%';
```

---

## Feature 23: TOC Sidebar

### How It Works
- **Desktop (>1440px)**: Fixed sidebar on LEFT, vertically centered (`top: 50%`)
- **Tablet/small desktop (<1440px)**: Sidebar hidden; floating toggle button at `bottom: 90px, left: 16px`
- **Mobile**: Toggle opens bottom drawer with full TOC list
- **Active highlighting**: `IntersectionObserver` with `rootMargin: '-80px 0px -70% 0px'`
- **Auto-generation**: JS scans `h2[id]` elements; if none found, auto-generates IDs from all H2s in `.article-body`

### H2 ID Patterns Supported
| Pattern | Articles |
|---------|----------|
| `section-#` (hyphen) | 1, 5, 9, 13, 17 |
| `sec#` (short) | 2 |
| `section#` (no hyphen) | 18 |
| Auto-generated `toc-section-#` | geopolitics-1 (no IDs on H2s) |

### CSS Classes
| Class | Purpose |
|-------|---------|
| `.toc-sidebar` | Fixed sidebar container |
| `.toc-sidebar.visible` | Shown when article content is in viewport |
| `.toc-sidebar-label` | "On this page" label |
| `.toc-sidebar-list` | UL container |
| `.toc-sidebar-item` | LI wrapper |
| `.toc-sidebar-link` | Anchor link |
| `.toc-sidebar-link.active` | Currently visible section |
| `.toc-sidebar-num` | Section number span |
| `.toc-mobile-toggle` | Floating button (mobile/tablet) |
| `.toc-mobile-backdrop` | Dark backdrop for drawer |
| `.toc-mobile-drawer` | Bottom sheet drawer |
| `.toc-mobile-drawer.active` | Drawer open state |
| `.toc-drawer-header` | Drawer title row |
| `.toc-drawer-close` | Close button |
| `.toc-mobile-list` | UL in drawer |

### Position Coordination with Share Buttons
- **Desktop**: TOC sidebar LEFT (`left: 20px`), share buttons RIGHT (`right: 20px`)
- **Mobile**: TOC toggle at `bottom: 90px` (above share bottom bar at `bottom: 0`)
- Share button tooltips point LEFT (`.share-btn::after { right: calc(100% + 12px) }`)

### HTML Structure (in `<body>`, before navbar)
```html
<nav class="toc-sidebar" id="tocSidebar" aria-label="Table of Contents">
    <div class="toc-sidebar-label">On this page</div>
    <ul class="toc-sidebar-list" id="tocSidebarList"></ul>
</nav>

<button class="toc-mobile-toggle" id="tocMobileToggle">...</button>
<div class="toc-mobile-backdrop" id="tocMobileBackdrop"></div>
<div class="toc-mobile-drawer" id="tocMobileDrawer">
    <div class="toc-drawer-header">...</div>
    <ul class="toc-mobile-list" id="tocMobileList"></ul>
</div>
```

---

## Feature 24: Series Navigation

### How It Works
- Horizontal bar between hero section and article content
- Shows: series badge (article number), series name, prev/next links
- Disabled state (`.series-link.disabled`) for first/last articles
- Responsive: collapses to compact layout on mobile (<640px)

### Series Data
| File | Series | Number | Prev | Next |
|------|--------|--------|------|------|
| article-1.html | Engineering Journal | 1 of 18 | — | article-2 |
| article-2.html | Engineering Journal | 2 of 18 | article-1 | article-3 |
| ... | ... | ... | ... | ... |
| article-18.html | Engineering Journal | 18 of 18 | article-17 | — |
| geopolitics-1.html | Global Analysis | 1 of 1 | — | — |

### CSS Classes
| Class | Purpose |
|-------|---------|
| `.series-nav` | Container bar |
| `.series-badge` | Left section with number + series name |
| `.series-badge-icon` | Numbered square |
| `.series-title` | Article title (hidden on mobile) |
| `.series-links` | Right section with nav links |
| `.series-link` | Prev/Next link |
| `.series-link.disabled` | Greyed out, non-clickable |

### HTML Placement
Inserted after the hero `</section>` (or `</header>` for article-18):
```html
<div class="series-nav" style="margin-top: 1rem;">
    <div class="series-badge">
        <span class="series-badge-icon">01</span>
        Engineering Journal &mdash; Article 1 of 18
    </div>
    <span class="series-title"></span>
    <div class="series-links">
        <span class="series-link disabled">...</span>
        <a href="article-2.html" class="series-link">...</a>
    </div>
</div>
```

---

## Adding Features to a New Article

When creating a new article (e.g., article-19.html):

1. **In `<head>`**: Add `<script src="https://cdn.jsdelivr.net/npm/fuse.js@7.0.0" defer></script>`
2. **After `<body>`**: Add scroll-progress div, search overlay/modal, TOC sidebar, mobile TOC elements
3. **In navbar**: Add search button before theme-toggle
4. **After hero section**: Add series nav with correct numbering
5. **Before `</body>`**: Add the 3 JS script blocks (progress, TOC, search)
6. **Update `search-index.json`**: Add new entry with ID 30+
7. **Update article-18.html**: Change series nav "Next" from disabled to linking to article-19

### JS Script Order (before `</body>`)
1. Reading Progress Bar (scroll listener)
2. TOC Sidebar (IntersectionObserver)
3. Global Search (Fuse.js)

---

---

## Feature 28: Cookie Consent Banner

### How It Works
- Fixed banner at `bottom: 0`, full width, `z-index: 10002` (above everything)
- Glass-morphic background (`backdrop-filter: blur(12px)`)
- Starts hidden (`.hidden` class); shown if `localStorage.getItem('rz_cookie_consent')` is null
- **Accept**: Sets `rz_cookie_consent = 'accepted'`, hides banner
- **Decline**: Sets `rz_cookie_consent = 'declined'`, hides banner, disables GA (`window['ga-disable-G-GED7FX8RTV'] = true`)
- Slide animation via `transform: translateY(100%)`

### CSS Classes
| Class | Purpose |
|-------|---------|
| `.cookie-banner` | Fixed banner container |
| `.cookie-banner.hidden` | Hidden state (translateY 100%) |
| `.cookie-actions` | Button group (flex row) |
| `.cookie-accept` | Primary blue accept button |
| `.cookie-decline` | Secondary decline button |

### localStorage Key
- **Key**: `rz_cookie_consent`
- **Values**: `'accepted'` or `'declined'`

### Deployed On
All 29 HTML pages (19 articles + index + articles + geopolitics + insights + datacenter-solutions + 5 calculators)

---

## Feature 29: Reading Time Badge

### How It Works
- Clock icon + "X min" text shown in article card meta row on `articles.html`
- Positioned between the date span and "Read →" link
- Reading time calculated at 200 words/minute from article content word counts

### CSS Classes (defined inline in `articles.html`)
| Class | Purpose |
|-------|---------|
| `.article-card-readtime` | Badge container (flex, 0.72rem) |

### Reading Times
| Article | Time |
|---------|------|
| 1 | 34 min |
| 2 | 16 min |
| 3 | 32 min |
| 4 | 34 min |
| 5 | 33 min |
| 6 | 30 min |
| 7 | 35 min |
| 8 | 30 min |
| 9 | 10 min |
| 10 | 16 min |
| 11 | 15 min |
| 12 | 24 min |
| 13 | 31 min |
| 14 | 26 min |
| 15 | 35 min |
| 16 | 20 min |
| 17 | 32 min |
| 18 | 17 min |

### When Adding New Articles
Add a `<span class="article-card-readtime">` with clock SVG between the date and "Read →" spans.

---

## Feature 30: Scroll to Top Button

### How It Works
- Fixed 44px circle button at bottom-right corner
- Hidden by default (`opacity: 0, visibility: hidden`)
- Shows (`.visible` class) after scrolling 500px, via `requestAnimationFrame`-throttled scroll listener
- Click triggers `window.scrollTo({ top: 0, behavior: 'smooth' })`

### CSS Classes
| Class | Purpose |
|-------|---------|
| `.scroll-top-btn` | Button container |
| `.scroll-top-btn.visible` | Shown state |

### Position Coordination
| Viewport | Position | Notes |
|----------|----------|-------|
| Desktop (>1024px) | `bottom: 24px; right: 24px` | Clear of all other elements |
| Mobile (≤1024px) | `bottom: 90px; right: 16px` | Above share bottom bar; TOC toggle is on LEFT |

### Deployed On
Same 29 files as cookie banner.

---

## CRITICAL: Script Placement Rules

> **Lesson learned 2026-02-25**: A batch insertion of Feature 22/23/21 scripts broke Pro mode, PDF export, and calculator JS across 17 articles because scripts were inserted INSIDE calculator IIFEs instead of AFTER them.

### Rule 1: Feature scripts MUST be in separate `<script>` blocks
```
WRONG:
<script>
  (function(){ /* calculator IIFE */
    ...
    <!-- Feature 22 -->     <-- BREAKS EVERYTHING
    <script>...</script>
    ...
  })();
</script>

CORRECT:
<script>
  (function(){ /* calculator IIFE */ })();
</script>
<!-- Feature 22 -->
<script>(function(){ /* reading progress */ })();</script>
<!-- Feature 23 -->
<script>(function(){ /* TOC sidebar */ })();</script>
<!-- Feature 21 -->
<script>(function(){ /* global search */ })();</script>
```

### Rule 2: Never place `</script>` inside JS string literals
The HTML parser terminates `<script>` blocks at the FIRST `</script>` it encounters, regardless of JS string context. Use `<\/script>` or string concatenation instead.

### Rule 3: Multi-line strings in JS must use backticks or concatenation
Single-quoted strings (`'...'`) cannot contain raw newlines. If a batch script splits a string across lines, it creates "Invalid or unexpected token" errors.

### Rule 4: PDF export functions write to new windows
Calculator PDF export functions use `w.document.write(html)` where `html` is a string built via concatenation. Never insert code between the string building and `w.document.write()` call.

### Rule 5: Validate after batch edits
After any batch modification across articles, run this Node.js check:
```js
// Extracts all <script> blocks and parses them
const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
let match;
while ((match = scriptRegex.exec(html)) !== null) {
    try { new Function(match[1]); }
    catch(e) { console.error("Syntax error at line " + lineNum); }
}
```

### Script Order in Articles
1. `<script src="script.min.js">` — Shared utilities
2. `<script>` — Free calculator IIFE
3. `<script>` — Pro Mode calculator IIFE (exports `window.switchXxxMode`, `window.exportXxxPDF`)
4. `<!-- Feature 22 -->` `<script>` — Reading Progress Bar
5. `<!-- Feature 23 -->` `<script>` — TOC Sidebar
6. `<!-- Feature 21 -->` `<script>` — Global Search
7. `<script>` — Tooltip positioning
8. `<script>` — Newsletter subscription
9. `<script src="auth.js">` — Authentication module
10. `<script src="rz-tracker.js">` — Analytics tracker
11. `<script>` — Cookie consent + scroll-to-top

---

## Calculator Disclaimer Standard

### Requirement
ALL pages with calculators MUST have a disclaimer block. This includes:
- 9 standalone calculator pages (pue, capex, opex, roi, carbon-footprint, datahallAI, dc-conventional, tia-942-checklist, tier-advisor)
- Article-embedded calculators (articles 1-7, 9, 12, 13, 17, 18)

### Placement
- **Standalone pages**: Before the `<!-- Footer -->` section
- **Article-embedded**: After the benchmark-meta/privacy-badge div, before the calculator container's closing `</div>` or before the next `<h2>` section

### HTML Template
```html
<div style="background:rgba(30,41,59,0.6);border:1px solid rgba(148,163,184,0.15);border-radius:12px;padding:1.25rem 1.5rem;margin-top:1.5rem;">
    <div style="display:flex;align-items:flex-start;gap:0.75rem;">
        <div style="color:#f59e0b;font-size:1rem;margin-top:2px;flex-shrink:0;">
            <i class="fas fa-triangle-exclamation"></i>
        </div>
        <div>
            <div style="font-weight:700;font-size:0.8rem;color:#e2e8f0;margin-bottom:0.5rem;">
                Disclaimer &amp; Data Sources
            </div>
            <p style="font-size:0.72rem;color:#94a3b8;line-height:1.65;margin:0 0 0.5rem 0;">
                This calculator is provided for <strong style="color:#cbd5e1;">educational and
                estimation purposes only</strong>. Results are approximations based on industry
                benchmarks and publicly available data.
            </p>
            <p style="font-size:0.72rem;color:#94a3b8;line-height:1.65;margin:0 0 0.5rem 0;">
                <strong style="color:#cbd5e1;">Algorithm &amp; methodology sources:</strong>
                [SPECIFIC SOURCES FOR THIS CALCULATOR]
            </p>
            <p style="font-size:0.72rem;color:#94a3b8;line-height:1.65;margin:0 0 0.5rem 0;">
                All calculations are performed entirely in your browser. No data is transmitted
                to any server. See our <a href="privacy.html" style="color:#60a5fa;">Privacy Policy</a>.
            </p>
            <p style="font-size:0.68rem;color:#64748b;line-height:1.5;margin:0;">
                By using this tool you agree to our
                <a href="terms.html" style="color:#60a5fa;">Terms of Service</a>.
                All content on ResistanceZero is independent personal research.
            </p>
        </div>
    </div>
</div>
```

### Per-Calculator Sources
| Calculator | Algorithm Sources |
|-----------|-----------------|
| PUE (standalone + article-9) | ASHRAE TC 9.9, Green Grid, ISO/IEC 30134-2, Uptime Institute 2024 |
| CAPEX | Turner & Townsend, JLL, Uptime Institute Tier Standards, CBRE |
| OPEX | Uptime Institute, US EIA, BLS, JLL, CBRE, IEC 62040 |
| ROI | NPV DCF, IRR Newton-Raphson, Uptime Institute, JLL, CBRE |
| Carbon Footprint | GHG Protocol Scope 1/2/3, IEA, EPA eGRID, SBTi |
| AI Data Hall | ASHRAE TC 9.9, OCP, NVIDIA DGX, Uptime Institute, Green Grid |
| DC Conventional | ASHRAE TC 9.9, Uptime Institute Tier I-IV, IEC 62040, TIA-942 |
| TIA-942 Checklist | TIA-942-B, Uptime Institute, BICSI 002-2019 |
| Tier Advisor | Uptime Institute Tier Classification, TIA-942, IEEE 493 |
| Maturity (article-1) | Uptime Institute 2023-2024, EN 50600, ISO 55001 |
| Alarm (article-2) | ISA-18.2-2022, EEMUA 191, IEC 62682, Poisson/Erlang-C |
| Maintenance (article-3) | Palmer (2006), Smith & Hinchcliffe (2004), RCM III |
| MTTR (article-4) | 5-phase MTTR decomposition, IEEE 493, vendor mobilization |
| Tech Debt (article-5) | NIST Weibull, ISO 55001, Uptime Institute 2023 |
| RCA (article-6) | DOE-HDBK-1208, Leveson STAMP 2011, ISO 45001 |
| Resilience (article-7) | Hollnagel 2014, EN 50600, Uptime Institute 2023 |
| Availability (article-13) | Uptime Institute Tier I-IV, IEEE 1584-2018, EU AI Act Art 13 |

---

## Dark Mode Support

All features support dark mode via `[data-theme="dark"]` selectors:
- Search modal: `#1e293b` background
- TOC sidebar links: `var(--light-blue)` active color
- Series nav: Blue-tinted glassmorphic background
- Progress bar: Blue → gold → orange gradient
- Cookie banner: `rgba(30,41,59,0.92)` background
- Scroll-to-top: `#3b82f6` background, `#60a5fa` on hover

## Files Modified

| File | What Changed |
|------|-------------|
| `styles.css` | +520 lines: search, TOC sidebar, series nav CSS; +90 lines: cookie, scroll-top, readtime |
| `search-index.json` | 29-entry search index with image + readingTime fields |
| `article-1.html` through `article-18.html` | +321 lines each: HTML elements + JS; +cookie/scroll-top snippet |
| `geopolitics-1.html` | +321 lines: same features; +cookie/scroll-top snippet |
| `articles.html` | Reading time badges in all 18 article cards; +cookie/scroll-top snippet |
| `index.html`, `insights.html`, `geopolitics.html`, etc. | +cookie/scroll-top snippet |
| Calculator pages (5 files) | +cookie/scroll-top snippet |
