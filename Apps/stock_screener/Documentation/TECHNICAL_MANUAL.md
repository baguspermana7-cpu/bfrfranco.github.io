# Technical Manual

## Prototype structure

Root prototype folder:

`/home/baguspermana7/rz-work/Apps/stock_screener/prototype`

Runtime entry point:

`/home/baguspermana7/rz-work/Apps/stock_screener/server.mjs`

Package scripts:

`/home/baguspermana7/rz-work/Apps/stock_screener/package.json`

Pages:

1. `index.html`
2. `app.html`
3. `methodology.html`
4. `affiliate.html`
5. `terms.html`
6. `entity.html`

Assets:

1. `assets/styles.css`
2. `assets/mock-data.js`
3. `assets/utils.js`
4. `assets/site.js`
5. `assets/app.js`
6. `assets/entity.js`

Runtime:

1. `package.json`
2. `server.mjs`

## Script responsibilities

### `mock-data.js`

Provides:

1. Landing stats
2. Feature cards
3. Dashboard lists
4. Aggregate free-float rows for non-authored symbols
5. Hidden position tables
6. Heatmap and sector metadata for synthetic screener coverage
7. Heatmap data
8. Methodology data
9. Sector exposure fallbacks
10. Spotlight notes
11. Entity data for tickers, investors, and groups
12. Search index with aliases

### `utils.js`

Handles shared logic used across landing, app, and entity pages:

1. DOM helpers
2. HTML escaping
3. Alias-aware search corpus and scoring
4. Token validation
5. Strategic-versus-float holder classification
6. Computed free-float analytics from authored holder tables
7. Derived strategic-held, visible-coverage, blind-spot, HHI, and concentration metrics
8. Weighted sector exposure from authored ticker pages
9. Derived investor and ticker network scenarios
10. CSV serialization
11. Local AI-answer helper for prototype Q&A

### `site.js`

Handles:

1. Landing search suggestions
2. Landing content rendering
3. Feature and preview population
4. Countdown behavior
5. Methodology rendering
6. Affiliate flow rendering
7. Landing network preview from derived network scenarios

### `app.js`

Handles:

1. Direct-open dashboard boot
2. Dashboard search suggestions with ranking
3. Sidebar jump navigation
4. Screener filtering and sorting
5. Screener analytics summary cards
6. CSV export for the screener
7. Dashboard list rendering
8. Dashboard charts
9. Derived network scenario rendering
10. Hidden positions rendering
11. Spotlight rendering
12. Local AI-style Q&A panel
13. Analysis Lab rendering
14. Watchlist persistence via `localStorage`

### `entity.js`

Handles:

1. Parsing `kind` and `id`
2. Resolving authored entities
3. Recomputing authored ticker metrics from holder tables
4. Building fallback entities when needed
5. Rendering metrics, notes, related entities, and tables
6. Rendering charts for entity detail pages

### `server.mjs`

Handles:

1. Local static serving with Node built-ins only
2. Friendly route shortcuts:
   `/`
   `/app`
   `/methodology`
   `/affiliate`
   `/entity`
   `/terms`
   `/docs`
3. MIME handling for HTML, JS, CSS, markdown, and image assets

## Route behavior

### `index.html`

Public marketing and preview surface.

### `server.mjs`

Local development server for the full package without external dependencies.

### `app.html`

Direct-open app shell.

Behavior:

1. Dashboard opens immediately
2. No login wall is presented

### `entity.html`

Query-driven entity route with direct access.

Supported URL shapes:

1. `entity.html?kind=ticker&id=BBCA`
2. `entity.html?kind=investor&id=government-of-norway`
3. `entity.html?kind=group&id=salim-group`

## Chart engine

Charts use `ECharts` from CDN.

Current chart types:

1. Pie
2. Treemap
3. Graph
4. Bar

## Known prototype constraints

1. Static HTML only
2. No persistence beyond browser storage
3. No real API fetches
4. No server-side routing
5. Non-authored ticker rows still depend on synthesized aggregates plus sector-level fallbacks rather than real holder tables
6. Network evidence is still prototype-authored, not audit-grade source provenance
