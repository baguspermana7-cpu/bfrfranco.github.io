# Blueprint - StockMap Style Stock Screener (Deep Research v1)

Date: 2026-03-16
Location: /home/baguspermana7/rz-work/Apps/stock_screener

## 1) Goal
Build a stock ownership intelligence web app with UI/UX and feature parity to stockmap.jatevo.ai (landing + gate + dashboard behavior), starting from blueprint and concept only.

## 2) Research Inputs Used
1. Live homepage HTML from `https://stockmap.jatevo.ai/` (fetched and reverse engineered).
2. Live gate flow HTML from `https://stockmap.jatevo.ai/app` and `?gate=1`.
3. Methodology page HTML from `https://stockmap.jatevo.ai/methodology`.
4. Affiliate page HTML from `https://stockmap.jatevo.ai/affiliate`.
5. Video reference frames from:
   - `/home/baguspermana7/Downloads/POV- orang lain kerja 9-5, Luca bikin website semalam.Cuma pakai OpenClaw + AI agents, dia parsi.mp4`
   - Extracted to `/home/baguspermana7/rz-work/Apps/stock_screener/research_frames/`

## 3) Confirmed Product Structure (from research)
### Public side
- Sticky affiliate banner
- Landing hero + pricing + CTA
- Stats ribbon (tickers, investors, conglomerates, investor types)
- Feature grid
- Preview sections (dashboard, mutual fund, free float screener, sample data, network graph, market heatmap)
- Payment form (`/api/pay`)
- Email recovery on landing (`/api/recover`)

### Access side
- `/app` checks `sessionStorage.idx_token`
- If missing token: redirect to `/app?gate=1`
- Gate page supports:
  - Login with email (`/api/recover`)
  - Access code entry -> stores `idx_token` in sessionStorage

### Dashboard side (observed from video + landing previews)
- Top search bar: "Search investors, tickers, companies..."
- KPI strip (positions, local/foreign percentages, etc)
- Core modules:
  - Ownership table
  - Network graph (investor <-> ticker links)
  - Free Float Screener with risk tabs
  - Heatmap market view
  - Hot searches / top foreign investors / conglomerate cards

## 4) Visual DNA (high-confidence tokens)
Source style from live site:
- Fonts:
  - Instrument Serif (titles, italic branding)
  - Instrument Sans (UI body)
  - JetBrains Mono (numbers, table codes, labels)
- Core colors:
  - Background: `#F8F6F2`
  - Surface: `#FFFFFF`
  - Surface 2: `#F2EFE9`
  - Border soft: `rgba(0,0,0,.08)`
  - Text main: `#1A1916`
  - Text dim: `#5C5850`
  - Muted: `#9C9890`
  - Accent orange: `#E55300`
  - Accent hover: `#CC4A00`
  - Green: `#1A8754`
  - Blue: `#2563EB`
- Shape language:
  - Rounded corners 6-12px
  - Light borders, subtle shadow
  - Clean white cards over warm beige background

## 5) Free Float Logic (methodology-matched)
### Formula
`Free Float = 100% - Strategic Holdings`

### Type classification (KSEI code)
- Strategic (non free-float): `CP`, `IB`, `FD`, `OT`
- Conditional: `ID` (individual)
- Free-float: `MF`, `IS`, `PF`, `SC`

### Individual (ID) rule stack
1. If holding >= 20% -> strategic
2. Else if holds >= 5% in 2+ companies -> strategic heuristic
3. Else verify against insider/board/founder data:
   - insider -> strategic
   - non insider -> free-float

### Data limitation notes to keep in UI
- KSEI holder coverage is >= 1%
- Below 1% assumed free-float
- Monthly refresh cadence

## 6) Information Architecture Blueprint
1. Landing (`/`)
2. Payment intent (`POST /api/pay`)
3. Gate (`/app?gate=1`)
4. Auth session (`idx_token` in sessionStorage)
5. App shell (`/app?token=...`)
6. Dashboard routes (recommended)
   - `/app/overview`
   - `/app/screener/free-float`
   - `/app/heatmap`
   - `/app/network`
   - `/app/investor/:id`
   - `/app/ticker/:symbol`

## 7) Screen-by-Screen Concept Spec
### A. Landing page
- Hero headline + KSEI data date label
- Early bird price block with referral discount variant (`?ref=`)
- CTA: Unlock Full Access
- Large preview cards with blurred rows and CTA overlays

### B. Gate page
- Single centered card
- Email login + optional access code reveal
- Error message slot under button
- Keep minimal and very fast

### C. Dashboard shell
- Topbar:
  - Brand mark "StockMap."
  - Search box
  - Theme toggle (optional)
- KPI ribbon cards
- Main split:
  - Left: screener table + filters
  - Right: network graph and side insights
- Lower section:
  - Heatmap grid
  - Local vs Foreign summary

### D. Free Float Screener screen
- Header: "Free Float Screener"
- Tabs / chips:
  - "0-5% (High Regulatory Risk)"
  - "5-15%"
  - ">50%"
  - "All Tickers"
- Table columns (recommended):
  - Ticker
  - Company
  - Free Float %
  - Total Held %
  - Est. Value
  - Holders
  - Risk marker

### E. Investor/Ticker details
- Ownership rows with investor type badges
- Affiliated badge for insider individuals
- Linked network mini graph
- Holdings timeline placeholder

## 8) Data Model Blueprint
### Core tables
1. `tickers`
- `id`, `symbol`, `name`, `sector`, `market_cap`, `updated_at`

2. `investors`
- `id`, `name`, `type_code`, `nationality`, `is_affiliated`, `group_id`

3. `holdings`
- `id`, `ticker_id`, `investor_id`, `shares`, `pct`, `as_of_date`

4. `conglomerates`
- `id`, `name`, `description`

5. `conglomerate_members`
- `conglomerate_id`, `ticker_id`, `confidence_score`

6. `free_float_snapshots`
- `ticker_id`, `as_of_date`, `free_float_pct`, `strategic_pct`, `method_version`

7. `search_events`
- `id`, `query`, `entity_type`, `created_at`

8. `subscriptions`
- `id`, `email`, `status`, `token`, `source_ref`, `paid_at`

## 9) API Contract Blueprint
### Public/gate
- `POST /api/pay` -> create payment link
- `POST /api/recover` -> resolve paid account by email, return token

### App
- `GET /api/overview`
- `GET /api/search?q=`
- `GET /api/free-float?bucket=&sort=&page=`
- `GET /api/tickers/:symbol`
- `GET /api/investors/:id`
- `GET /api/network?entity=ticker:BBCA`
- `GET /api/heatmap?session=live`

## 10) Frontend Technical Blueprint (recommended)
- Framework: Next.js + TypeScript
- Styling: CSS variables + modular components (match warm visual language)
- Table: TanStack Table
- Network Graph: D3 force graph
- Heatmap and trend charts: ECharts (for fast rendering and interactions)
- Data fetching: React Query
- State: Zustand (small global state)
- Auth gate: token in session/local storage + server verify

## 11) Backend Technical Blueprint (recommended)
- API: Fastify or NestJS
- DB: Postgres
- Search: Postgres trigram + optional Meilisearch for instant autocomplete
- Cache: Redis for hot widgets and search ranking
- Jobs: monthly KSEI ingest + affiliation enrichment
- AI enrichment layer:
  - entity resolution (name normalization)
  - insider verification flags

## 12) "Exactly Same" Parity Checklist
- [ ] Typography stack identical family roles (serif/sans/mono)
- [ ] Color palette and spacing match
- [ ] Gate flow behavior identical (`idx_token`, redirect rules)
- [ ] Free Float tab names and risk framing aligned
- [ ] KPI + cards + table rhythm match
- [ ] Network graph style and node color logic match
- [ ] Heatmap color semantics (green/red by return) match
- [ ] Referral and price swap behavior with `?ref=` supported

## 13) Scope Guard (important)
This blueprint is for design and engineering planning. Before production release, ensure legal review for branding/content/IP differences if required.

## 14) Next Build Phase (if approved)
1. Build static high-fidelity frontend skeleton (no real data).
2. Plug mock API and fake dataset with same schema.
3. Wire real ingest pipeline + scoring rules.
4. Validate parity with screenshot-based visual diff.
