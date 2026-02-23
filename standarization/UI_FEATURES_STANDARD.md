# UI Features Standardization

> **Created**: 2026-02-24
> **Applies to**: All article pages (article-1 through article-18) + geopolitics-1.html
> **Dependencies**: `styles.css` (global), `search-index.json`, Fuse.js CDN

---

## Overview

Four UI features are implemented across all articles:

| # | Feature | Purpose | Effort |
|---|---------|---------|--------|
| 21 | Global Search | Navbar search with instant fuzzy results | Medium |
| 22 | Reading Progress Bar | Scroll progress indicator at top | Small |
| 23 | TOC Sidebar | Sticky table of contents with section highlighting | Medium |
| 24 | Series Navigation | Article series badge with prev/next links | Small |

---

## Feature 21: Global Search

### How It Works
- **Trigger**: Click search icon in navbar OR press `Ctrl+K` / `Cmd+K`
- **Engine**: Fuse.js v7.0.0 (CDN, loaded with `defer`)
- **Index**: `search-index.json` — 27 entries (18 articles + 5 calculators + 3 tools + geopolitics-1)
- **Matching**: Fuzzy search across title (0.4), description (0.25), keywords (0.25), category (0.1)
- **Navigation**: Arrow keys to navigate, Enter to open, ESC to close
- **Results**: Max 8 shown, with icon (article number / category icon), title, description

### CSS Classes
| Class | Purpose |
|-------|---------|
| `.nav-search-btn` | Search icon button in navbar |
| `.search-overlay` | Dark backdrop behind modal |
| `.search-modal` | Modal container |
| `.search-input-wrap` | Input row with icon + kbd hint |
| `.search-input` | The text input |
| `.search-results` | Scrollable results container |
| `.search-result-item` | Individual result link |
| `.search-result-icon` | Left icon (article number or category) |
| `.search-result-icon.calc` | Yellow icon for calculators |
| `.search-result-icon.tool` | Green icon for tools |
| `.search-result-title` | Result title |
| `.search-result-desc` | Result description |
| `.search-result-category` | Category label above title |
| `.search-empty` | "No results" placeholder |
| `.search-footer` | Bottom bar with keyboard hints |
| `.search-kbd` | Keyboard shortcut badge styling |

### HTML Structure (in `<body>`, before navbar)
```html
<div class="search-overlay" id="searchOverlay"></div>
<div class="search-modal" id="searchModal">
    <div class="search-input-wrap">...</div>
    <div class="search-results" id="searchResults">...</div>
    <div class="search-footer">...</div>
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
    "keywords": ["keyword1", "keyword2"]
  }
]
```

### When Adding New Articles
1. Add entry to `search-index.json` with next sequential ID
2. Include 5-8 relevant keywords
3. Category options: Operations, Engineering, Policy, Analysis, Sustainability, Leadership, Business, Geopolitics, Calculator, Tool

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
6. **Update `search-index.json`**: Add new entry with ID 28+
7. **Update article-18.html**: Change series nav "Next" from disabled to linking to article-19

### JS Script Order (before `</body>`)
1. Reading Progress Bar (scroll listener)
2. TOC Sidebar (IntersectionObserver)
3. Global Search (Fuse.js)

---

## Dark Mode Support

All features support dark mode via `[data-theme="dark"]` selectors:
- Search modal: `#1e293b` background
- TOC sidebar links: `var(--light-blue)` active color
- Series nav: Blue-tinted glassmorphic background
- Progress bar: Blue → gold → orange gradient

## Files Modified

| File | What Changed |
|------|-------------|
| `styles.css` | +520 lines: search, TOC sidebar, series nav CSS |
| `search-index.json` | Created: 27-entry search index |
| `article-1.html` through `article-18.html` | +321 lines each: HTML elements + JS |
| `geopolitics-1.html` | +321 lines: same features |
