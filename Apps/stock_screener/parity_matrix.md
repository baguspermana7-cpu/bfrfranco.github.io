# Parity Matrix - Prototype vs Researched Product

Date: 2026-03-16

| Area | Researched behavior | Prototype status | File |
| --- | --- | --- | --- |
| Sticky affiliate banner | Present on landing | Implemented | `prototype/index.html` |
| Warm visual language | Instrument Serif + Sans + Mono, beige background, white cards | Implemented | `prototype/assets/styles.css` |
| Hero pricing | Early-bird lifetime access framing | Implemented with referral variant | `prototype/index.html` |
| `?ref=` behavior | Discounted price when referral exists | Implemented | `prototype/assets/site.js` |
| Landing previews | Dashboard, fund snippet, float preview, sample data, graph, heatmap | Implemented | `prototype/index.html` |
| Payment form | `POST /api/pay` in live site | Prototype-only local capture | `prototype/index.html` |
| Landing email recovery | `POST /api/recover` in live site | Prototype local token handoff | `prototype/index.html` |
| Gate page | Email login + access code | Implemented | `prototype/app.html` |
| Token storage | `sessionStorage.idx_token` | Implemented | `prototype/assets/app.js` |
| Direct app open | Opens dashboard without gate | Implemented | `prototype/assets/app.js` |
| Token validation | Gate rejects invalid codes | Implemented locally | `prototype/assets/app.js` |
| Dashboard shell | Search, KPI ribbon, side panels | Implemented | `prototype/app.html` |
| Search suggestions | Instant search UX | Implemented with ranked alias-aware search | `prototype/assets/utils.js` |
| Free Float tabs | Risk-oriented tabs | Implemented | `prototype/app.html` |
| Free Float filters | Low / below 15 / mid / high / all | Implemented | `prototype/assets/app.js` |
| Free Float computation | Methodology-backed formula | Implemented for authored rows and synthesized for non-authored rows | `prototype/assets/utils.js` |
| Screener sorting | Sort by visible columns | Implemented | `prototype/assets/app.js` |
| Screener export | CSV export | Implemented | `prototype/assets/app.js` |
| Network graph | Investor-ticker network | Implemented with ECharts graph | `prototype/assets/app.js` |
| Price / technical view | Deeper analysis per ticker | Implemented in Analysis Lab | `prototype/assets/app.js` |
| Peer comparison | Compare selected ticker vs peers | Implemented in Analysis Lab | `prototype/assets/app.js` |
| Watchlist | Persist user-selected tickers | Implemented with localStorage | `prototype/assets/app.js` |
| Market heatmap | Whole-market heatmap | Implemented with ECharts treemap | `prototype/assets/app.js` |
| Ownership mix chart | Quick composition chart | Added for richer dashboard | `prototype/assets/app.js` |
| Sector ownership chart | Local vs foreign by sector | Implemented with weighted holder-table coverage | `prototype/assets/app.js` |
| AI spotlight | Analyst-style research notes in dashboard | Implemented | `prototype/app.html` |
| AI Q&A | Natural-language prompt block | Implemented as local rule-based prototype | `prototype/assets/utils.js` |
| Entity drilldown | Ticker, investor, and group detail route | Implemented | `prototype/entity.html` |
| Entity auth gate | Entity pages require valid token | Implemented locally | `prototype/assets/entity.js` |
| Methodology page | MSCI-aligned classification explanation | Implemented | `prototype/methodology.html` |
| Affiliate page | Referral application flow | Implemented as local prototype | `prototype/affiliate.html` |
| Terms page | Legal link target for flow completeness | Implemented as placeholder | `prototype/terms.html` |
| Local server | Single command dev runtime | Implemented | `server.mjs` |

## Gaps to close for production parity

1. Replace mock data with real APIs and storage.
2. Replace prototype payment/recover handlers with backend endpoints.
3. Expand authored entity coverage beyond the current sample set.
4. Replace synthesized non-authored analytics with real holder tables.
5. Replace the local AI-answer helper with a real model-backed assistant and evidence citations.
6. Validate section spacing and copy against screenshot diff if visual parity must be tighter.
