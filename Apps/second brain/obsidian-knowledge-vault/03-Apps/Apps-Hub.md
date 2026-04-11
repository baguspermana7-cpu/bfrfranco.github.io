# Apps Hub

> 4 web applications built on or alongside rz-work

---

## App Index

| ID | Name | Path | Stack | Status |
|---|---|---|---|---|
| app-fin | [[Finance-Terminal]] | `Apps/finance-terminal/index.html` | Vanilla JS | Live |
| app-sb | [[Second-Brain]] | `Apps/second brain/index.html` | vis.js | Live (this app) |
| app-dca | [[DCA-App]] | `Apps/dca-app/index.html` | Vanilla JS | Live |
| dcmoc | [[DC-MOC]] | `dcmoc/` | Next.js 16 | Live |

---

## Finance Terminal

**File**: `Apps/finance-terminal/index.html` (~3072 lines)
**Purpose**: Real-time financial data with quote caching
**Key features**:
- `QUOTE_CACHE` — 5-min TTL
- `batchQuotes()` — with retry logic
- `RateLimiter` — 5 concurrent requests
- CORS: codetabs first (working), allorigins last (408)

---

## Second Brain (this app)

**File**: `Apps/second brain/index.html`
**Purpose**: Interactive knowledge graph of rz-work
**Stack**: vis.js 9.1.9 (CDN), Inter + Space Grotesk fonts, vanilla JS IIFE
**Graph**: 60 nodes, ~70 edges, 9 categories
**Key features**: Filter/search, click sidebar, DOM-element tooltips (no HTML leak)

---

## DCA App

**File**: `Apps/dca-app/index.html`
**Purpose**: Dollar Cost Averaging calculator for systematic investment

---

## DC MOC App

**Path**: `dcmoc/`
**Stack**: Next.js 16, React 19, TypeScript, Tailwind CSS v4, Zustand
**Build**: Static export (`next build`)
**Key modules**:
- `src/modules/analytics/CarbonEngine.ts` — carbon pricing, solar/BESS costs
- `src/modules/analytics/RevenueEngine.ts` — MRC $165/kW
- `src/constants/countries.ts` — Japan inflation, MY electricity rates
**Type check**: `npx tsc --noEmit`
**Serve**: static files after `next build` → `out/`
**Pending**: Full `next build` test (only `tsc --noEmit` verified)

---

## Relationships

```
app-sb → app-fin (knowledge mapping)
app-sb → dcmoc   (knowledge mapping)
dcmoc  → dashboard (operations data)
```
