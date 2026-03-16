# Stock Screener — Comprehensive Critical Review

**Review Date:** 2026-03-16
**Reviewer:** Claude Opus 4.6 (automated deep audit)
**Scope:** Accuracy, precision, analytics, algorithms, UI/UX, code quality
**Verdict:** UI/UX prototype with zero analytical capability. Every number is hardcoded, every calculation is a static lookup, and several data points contradict each other.

---

## Severity Legend

- 🔴 **CRITICAL** — Must fix before production. Blocks credibility.
- 🟠 **MAJOR** — Significant gap. Hurts professional perception.
- 🟡 **MODERATE** — Should improve. Not blocking but noticeable.
- 🟢 **MINOR** — Nice to have. Polish level.

---

## 1. DATA ACCURACY & PRECISION

### 🔴 BBCA Free Float Contradicts Its Own Holder Table

**File:** `mock-data.js`, lines 127 vs 283
Header says free float = **47.0%**, total held = **53.0%**.
But holder table: PT Dwimuria Investama Andalan = 54.94% ALONE.
Adding Norway (1.21%) + UOB (1.44%) + Fidelity (1.08%) = **58.67% visible** — contradicts the 53.0% total held.
**Impact:** Core data integrity failure. Two numbers in the same entity tell contradicting stories.

### 🔴 BBRI Holder Table vs Free Float Mismatch

**File:** `mock-data.js`, line 124 vs 317
PT Danantara = 53.19%, but freeFloat entry says totalHeld = 58.5%.
Visible holders sum: 53.19% + 1.43% + 1.10% + 1.04% = **56.76%** — unexplained 1.74% gap.

### 🔴 TLKM Same Data Inconsistency

**File:** `mock-data.js`, line 350
PT Danantara = 52.09%, but totalHeld = 56.1%. Visible sum = 55.22%. Gap: 0.88%.

### 🟠 BUMI 0.2% Free Float is Unrealistically Low

**File:** `mock-data.js`, line 116
BUMI trades millions of shares daily on IDX. 0.2% float on Rp58T market cap ≈ Rp116B tradeable — inconsistent with actual volume. Real estimates: 1-3%. This makes data look fabricated rather than researched.

### 🟠 Market Cap Figures Are 2-3x Off For Some Stocks

**File:** `mock-data.js`, lines 171-194

| Ticker | App Says | Actual (2026) | Error |
|--------|----------|---------------|-------|
| BBCA | Rp980T | ~Rp1,100-1,200T | -15% to -18% |
| BBRI | Rp910T | ~Rp700-800T | +14% to +30% |
| TLKM | Rp720T | ~Rp350-450T | **+60% to +106%** |
| GOTO | Rp205T | ~Rp60-100T | **+105% to +242%** |

TLKM and GOTO are wildly wrong. Not rounding errors — order-of-magnitude misstatements.

### 🟠 Government of Norway Misclassified as "CP" (Corporate)

**File:** `mock-data.js`, lines 138-144
Norges Bank Investment Management (sovereign wealth fund) classified as CP = "Corporate/Cross-holding/Parent." Should be portfolio/institutional investor. By the app's own rules, CP is "Strategic by default" — this would incorrectly exclude Norway's holdings from free float. Norway's SWF is the opposite of strategic.

### 🟠 MAPI Incorrectly Listed Under Salim Group

**File:** `mock-data.js`, line 559
MAPI (Mitra Adiperkasa) listed as "Adjacent" to Salim Group. MAPI is controlled by the Mitra Adiperkasa founding family, not Salim. No evidence trail provided.

### 🟡 Sector Exposure Numbers Are Fabricated

**File:** `mock-data.js`, lines 237-243
Banking: 62% local / 38% foreign. But individual tickers show BBCA=61/39, BBRI=68/32. A proper weighted average by market cap would not produce exactly 62/38. These are rounded placeholders, not computed values.

### 🟡 Happy Hapsoro Network Graph: Questionable Cross-Links

**File:** `mock-data.js`, lines 146-168
Links between UNTR-BSSR and DSSA-HRUM are not substantiated by known ownership relationships. The graph fabricates connections that would mislead analysts.

### 🟡 UOB Kay Hian Claims 65 Positions, Shows 4

**File:** `mock-data.js`, line 475
Claims "65 pos" but only lists 4. One holding (BBRI at 0.96%) is below the stated KSEI 1% reporting threshold. Contradicts own methodology.

---

## 2. ALGORITHM & ANALYTICS QUALITY

### 🔴 Free Float Is a Static Lookup, Not a Calculation

**File:** `app.js`, lines 323-330
```javascript
function filterFloatRows(mode) {
    const rows = data.freeFloat.slice();
    if (mode === "low") return rows.filter(item => item.freeFloat < 5);
    // ...
}
```
The methodology page describes a formula (100% - Strategic Holdings), but **the code never implements it**. Free float values are hardcoded. The screener is just a static table viewer.

### 🔴 Risk Classification is a String Match, Not a Computation

**File:** `app.js`, lines 26-30
```javascript
function riskClass(value) {
    if (value === "High") return "risk-high";
    // ...
}
```
Risk labels are pre-assigned in mock data. No algorithm computes risk from float %, concentration ratio, liquidity, or any quantitative measure.

### 🟠 Search is Naive Substring Matching

**File:** `app.js`, lines 171-182
```javascript
.filter(item => `${item.label} ${item.subtitle || ""}`.toLowerCase().includes(query))
```
Problems:
- No fuzzy matching ("BBCCA" → nothing; "lo kheng" without last name → nothing)
- No relevance scoring (exact ticker matches rank same as partial name matches)
- No tokenized search ("Central Bank" won't find "Bank Central Asia")
- Hard limit of 6 results, no pagination
- Only 11 items in search index (claimed 955 tickers)

### 🟠 Network Graph Has Zero Graph Algorithms

**File:** `app.js`, lines 422-460
Static node+edge rendering only. No:
- Betweenness centrality
- Community detection
- Influence scoring
- Edge weight analysis
- Multi-hop exploration

### 🟠 Entity Fallback Uses Hardcoded 60/40 Split

**File:** `entity.js`, lines 41-43
Every fallback entity shows 60% local / 40% foreign regardless of actual ownership. Misleading.

### 🟡 No Column Sorting on Any Table

**File:** `app.js`, lines 332-351
Users cannot sort by any column. For a "screener" product, this is a core functional gap.

### 🟡 Heatmap Color Scale Saturates at ±4.2%

**File:** `app.js`, lines 32-40
Formula: `0.42 + |change| * 0.12` caps at alpha 0.92. Any move above ±4.2% looks identical. Indonesian small caps routinely move 10-25%.

---

## 3. METHODOLOGY REVIEW

### 🟠 Formula is Correct but Incomplete

**File:** `methodology.html`, lines 37-43
`Free Float = 100% - Strategic Holdings` is the standard MSCI approach. However:

**Missing treatments:**
1. **Treasury shares** — Not mentioned. Company's own shares should be excluded from float.
2. **Lock-up shares** — IPO lock-up periods restrict tradability. Not addressed.
3. **Cross-holding netting** — A owns 10% of B, B owns 5% of A. Not addressed.
4. **Foreign ownership limits (FOL)** — Many IDX stocks cap foreign holdings at 20-40%. Critical for foreign institutional users. Not addressed.
5. **Government-linked entity classification** — Norway SWF classified as CP contradicts own rules.

### 🟠 5% Multi-Company Rule is Flawed

**File:** `mock-data.js`, lines 209-210
Rule: "If individual holds ≥5% in ≥2 companies, classify as strategic."
Problem: Lo Kheng Hong (famous retail investor) holds sub-2% across 6+ companies — passes this rule. But a wealthy individual owning 6% of two unrelated small caps would be flagged as "strategic." Conflates diversified investor with corporate controller. MSCI does not use this heuristic.

### 🟡 KSEI 1% Blind Spot Not Quantified

Only holders ≥1% appear. If top 10 hold 60%, the remaining 40% is assumed free float. But sub-1% holders may include insiders, family trusts, or nominee accounts. No error bounds estimated.

### 🟡 No Historical Versioning

Methodology mentions versioning in implementation notes but no version numbers, change log, or data model support.

---

## 4. MISSING CRITICAL FEATURES

### 🔴 CRITICAL — Must Have For Any Stock Screener

| Feature | Status | Impact |
|---------|--------|--------|
| Valuation metrics (P/E, P/B, PEG, EV/EBITDA) | **ABSENT** | Cannot evaluate stock value |
| Price charts / history | **ABSENT** | No visual price context |
| Technical indicators (RSI, MACD, MA) | **ABSENT** | No trading signals |
| Fundamental screening (revenue, margins, ROE) | **ABSENT** | Cannot filter by financials |
| Real-time / delayed price data | **ABSENT** | App is a static snapshot |

### 🟠 MAJOR — Expected by Professional Users

| Feature | Status |
|---------|--------|
| Historical ownership changes | ABSENT |
| Alert / notification system | ABSENT |
| Portfolio / watchlist analytics | ABSENT |
| Peer comparison tools | ABSENT |
| Dividend analysis | ABSENT |
| Insider trading signals | ABSENT |
| Export (CSV, Excel, PDF) | ABSENT |
| API access for developers | ABSENT |

### 🟡 MODERATE — Expected for Competitive Parity

| Feature | Status |
|---------|--------|
| Risk metrics (Sharpe, beta, VaR) | ABSENT |
| Dark mode | ABSENT |
| Backtesting capability | ABSENT |
| Sector / industry benchmarks | ABSENT |
| Multi-language support (ID/EN) | ABSENT |

---

## 5. BLUEPRINT & DOCUMENTATION

### 🟠 AI-Powered Q&A Advertised but Nonexistent

Feature card claims "AI-Powered Q&A" with natural language queries. Zero AI in codebase. "AI Spotlight" is 3 hardcoded text blurbs.

### 🟠 Database Schema Never Implemented

Blueprint specifies 8 tables (tickers, investors, holdings, etc.). Entire app runs on `mock-data.js`.

### 🟠 Parity Matrix Overstates Implementation

Claims "Implemented" for features that are just static HTML renderings (AI spotlight, deep ownership tables). Should distinguish "UI skeleton" from "functionally complete."

### 🟡 Blueprint Recommends Next.js, Prototype is Vanilla HTML

Blueprint: Next.js + TypeScript + TanStack Table + D3 + React Query + Zustand.
Reality: 3 vanilla JS files, no build system, no package.json.

---

## 6. CODE QUALITY

### 🟠 XSS Vulnerability in Entity Links

**Files:** `app.js:20-25`, `site.js:22-26`, `entity.js:181`
```javascript
return `<a href="${entityHref(match.kind, match.id)}">${label}</a>`;
```
`label` inserted into innerHTML without sanitization. If data comes from API/user input in production, this is stored XSS.

### 🟠 150+ Lines of Duplicated Code Across 3 Files

Functions duplicated across `app.js`, `site.js`, `entity.js`:
- `$()`, `$$()`, `formatPct()`, `entityHref()`, `normalize()`, `findSearchItem()`, `entityAnchor()`, `riskClass()`, `colorByChange()`, search logic

Should be extracted to a shared `utils.js`.

### 🟡 No Error Handling

Zero try-catch blocks. If `window.StockMapMock` has a missing property, unhandled TypeError crashes the app.

### 🟡 No Authentication Security

Any non-empty string accepted as valid token. `app.html?token=anything` bypasses gate entirely. Session token displayed in UI.

### 🟡 Entity Page Has No Auth Gate

`entity.html` loads without token check. Bypasses the auth gate completely.

### 🟡 ECharts CDN Without Fallback

Charts fail silently if CDN is blocked (common in Indonesian corporate networks). No bundled fallback.

### 🟡 No Accessibility

- No ARIA labels
- No keyboard nav for search results
- No screen reader support for charts
- `#9c9890` on `#f8f6f2` may fail WCAG AA contrast
- No `scope` on table headers
- No skip navigation links

### 🟢 Chart Resize Listeners Accumulate

`window.addEventListener("resize", ...)` added per chart without cleanup.

### 🟢 Inconsistent Decimal Formatting

`formatPct(0.2)` → "0.2%" but `formatPct(1.23)` → "1.23%". Should use consistent decimal places for financial data.

---

## 7. SEVERITY SUMMARY

| Level | Count | Key Examples |
|-------|-------|--------------|
| 🔴 CRITICAL | 8 | Data contradictions, no real calculations, no valuation/technical/fundamental metrics |
| 🟠 MAJOR | 18 | Wrong market caps, misclassifications, no sorting, naive search, XSS, code duplication |
| 🟡 MODERATE | 13 | Fabricated sector data, no error handling, no auth, no accessibility, no dark mode |
| 🟢 MINOR | 7 | Timer drift, inconsistent decimals, no favicon, listener cleanup |

---

## 8. PRIORITY RECOMMENDATIONS

### Phase 1 — Data Integrity (Week 1)
1. Fix all free float vs holder table contradictions (BBCA, BBRI, TLKM)
2. Correct market cap figures against IDX/Bloomberg data
3. Reclassify Norway SWF from CP to institutional/portfolio
4. Adjust BUMI float from 0.2% to realistic 1-3%
5. Ensure all holder tables sum correctly to stated total

### Phase 2 — Core Analytics Engine (Week 2-3)
1. Implement actual free float calculation from holder data
2. Add computed risk classification (not string match)
3. Add column sorting to all tables
4. Implement proper fuzzy search (Fuse.js or similar)
5. Add basic valuation metrics (P/E, P/B, dividend yield) — use IDX public data

### Phase 3 — Professional Features (Week 4-6)
1. Add price charts (historical data from Yahoo/Finnhub API)
2. Add technical indicators (at minimum RSI, MA, volume)
3. Add fundamental screening (ROE, margins, debt ratios)
4. Add watchlist/portfolio tracking
5. Add export (CSV, PDF)

### Phase 4 — Production Readiness (Week 7-8)
1. Migrate to framework (Next.js/React)
2. Build real backend with PostgreSQL
3. Implement KSEI data pipeline
4. Fix XSS vulnerabilities
5. Add accessibility
6. Add real authentication (JWT/OAuth)
7. Deploy with CI/CD

---

## 9. FINAL VERDICT

**Score: 3/10 — Proof of Concept, Not a Product**

The visual design is above average — typography, color palette, and information hierarchy are well-considered. The ECharts integrations look professional. The documentation and blueprint show serious product thinking.

However, the app is fundamentally a **static HTML brochure with hardcoded data**. It has:
- Zero calculation capability
- Zero real-time data
- Zero analytical features
- Multiple data integrity failures
- No backend, no database, no APIs

It cannot be called a "screener" because it screens nothing. It cannot be called "analytics" because it analyzes nothing. It is a UI mockup of what a screener could look like.

The gap between the blueprint's ambition (AI-powered ownership intelligence platform) and the prototype's reality (static mock data viewer) is the single largest risk. Either scope down the claims to match current capability, or build the analytical engine before marketing the product.
