# Content Taxonomy Standard — ResistanceZero

> **Version**: 1.0 | **Created**: 2026-03-23

---

## Overview

All content on ResistanceZero falls into one of **3 series**, each with defined sub-categories. This document is the single source of truth for deciding where a new article belongs.

---

## The Boundary Test

Before writing, ask **one question** to determine the series:

| Question | If YES → |
|----------|----------|
| "I can explain this because I've **physically done this work**" | **Engineering Journal** |
| "This affects **millions of people, governments, and markets**" | **Global Analysis** |
| "Everyone thinks X, but actually **Y**" (contrarian, forward-looking) | **Future Forward** |

If an article could fit two series, use the **primary lens**:
- A nuclear SMR article from an engineer's cooling/power perspective → **Engineering Journal**
- A nuclear SMR article about government policy and grid impact → **Global Analysis**
- A nuclear SMR article arguing "everyone's wrong about nuclear timelines" → **Future Forward**

---

## Series Definitions

### 1. Engineering Journal (cyan #06b6d4)

**Landing page**: `articles.html`
**File naming**: `article-[NN].html`
**Voice**: Technical authority. First-person operational experience. Data-backed.
**Audience**: DC engineers, facility managers, infrastructure professionals.

#### Sub-Categories

| Sub-Category | Definition | Examples |
|---|---|---|
| **Operations & Reliability** | Hands-on DC ops: alarm management, RCA, maintenance, HVAC, power distribution, redundancy. *You've touched the equipment.* | art 1-9, 13, 15 |
| **AI Infrastructure** | Physical systems powering AI: cooling tech, rack density, power architecture, chip/photonics hardware. *Engineering analysis of AI's hardware layer.* | art 18, 20, 21, 22 |
| **Site Selection & Design** | Location analysis, cost comparison, regulatory environment, build vs buy. | art 19 |

#### What DOES NOT belong here:
- Policy debates about electricity pricing → Global Analysis
- Community opposition to data centers → Global Analysis
- "The future of cooling is X" (opinion/prediction) → Future Forward

---

### 2. Global Analysis (red #ef4444)

**Landing page**: `geopolitics.html`
**File naming**: `geopolitics-[N].html` (pure geopolitics) or `article-[NN].html` (energy/policy)
**Voice**: Analytical, macro-level, data-driven. Impact on populations, economies, markets.
**Audience**: Business leaders, policy makers, investors, informed public.

#### Sub-Categories

| Sub-Category | Definition | Examples |
|---|---|---|
| **Geopolitics & Security** | Emergency preparedness, infrastructure vulnerability, military/conflict scenarios, cable/fiber security. *What happens when things break at nation-scale.* | geo 1, 3 |
| **Energy & Policy** | Water stress politics, electricity bills & public impact, grid investment, community opposition, market regulation. *Money, regulation, and who wins/loses.* | art 10-12, 14 |
| **Market & Industry** | Regional market analysis, investment trends, bubble/opportunity assessment, site selection economics at macro scale. *Where the money flows and why.* | art 16-17, geo 2 |

#### What DOES NOT belong here:
- How to fix an HVAC chiller → Engineering Journal
- "AI will change everything" predictions → Future Forward
- Technical deep-dive on rack density → Engineering Journal

---

### 3. Future Forward (violet #a855f7)

**Landing page**: `future-forward.html`
**File naming**: `FF-[N].html`
**Voice**: Contrarian, provocative, forward-looking. Challenges conventional wisdom with data.
**Tone**: "Everyone thinks X. Here's why they're wrong."
**Audience**: Tech industry, AI professionals, forward-thinking engineers, general public.

#### Sub-Categories

| Sub-Category | Definition | Examples |
|---|---|---|
| **Digital Shifts** | Platform changes, interface evolution, web/app/AI paradigm shifts. *How we interact with technology is changing.* | FF-1 |
| **Industry Disruption** | Talent market myths, economic reframing, business model shifts. *The industry narrative is wrong.* | FF-2, FF-3 |

#### What DOES NOT belong here:
- Step-by-step technical guide → Engineering Journal
- Government policy analysis → Global Analysis
- Reporting on current events without a contrarian angle → Global Analysis

---

## Decision Flowchart

```
New Article Idea
    │
    ├─ Is it based on your hands-on operational experience?
    │   └─ YES → Engineering Journal
    │       ├─ About day-to-day DC ops? → Operations & Reliability
    │       ├─ About AI hardware/cooling/power? → AI Infrastructure
    │       └─ About location/cost analysis? → Site Selection & Design
    │
    ├─ Does it analyze impact on populations, markets, or governments?
    │   └─ YES → Global Analysis
    │       ├─ About security/conflict/emergency? → Geopolitics & Security
    │       ├─ About bills/water/grid/community? → Energy & Policy
    │       └─ About market trends/investment? → Market & Industry
    │
    └─ Does it challenge conventional wisdom with a forward-looking thesis?
        └─ YES → Future Forward
            ├─ About platform/interface/web shifts? → Digital Shifts
            └─ About industry myths/economic reframing? → Industry Disruption
```

---

## Cross-Reference with Existing Articles

### Engineering Journal (articles.html)
| # | Title | Sub-Category |
|---|-------|-------------|
| 1 | When Nothing Happens, Engineering Is Working | Operations & Reliability |
| 2 | Alarm Fatigue Is Not a Human Problem | Operations & Reliability |
| 3 | How to Achieve 97%+ Maintenance Compliance | Operations & Reliability |
| 4 | In-House Capability Is a Reliability Strategy | Operations & Reliability |
| 5 | Technical Debt in Live Data Centers | Operations & Reliability |
| 6 | Why Post-Incident RCA Fails Without Design Authority | Operations & Reliability |
| 7 | From Reliability to Resilience | Operations & Reliability |
| 8 | Why 'No Incident' Is Not Evidence of Safety | Operations & Reliability |
| 9 | The HVAC Shock: No Chillers Doesn't Mean No Cooling | Operations & Reliability |
| 13 | Power Distribution Design: Hyperscaler Architecture | Operations & Reliability |
| 15 | Data Center Service Catalog: 135+ Services | Operations & Reliability |
| 18 | AI Factories: Traditional DC Architecture Faces Extinction | AI Infrastructure |
| 19 | Singapore vs Batam Data Centers | Site Selection & Design |
| 20 | Sam Altman Says Water Concerns Are "Fake" | AI Infrastructure |
| 21 | Nuclear SMRs for AI: $10B Bet | AI Infrastructure |
| 22 | NVIDIA's $4B Photonics Play | AI Infrastructure |

### Global Analysis (geopolitics.html)
| # | Title | Sub-Category |
|---|-------|-------------|
| 10 | Water Stress and AI Data Centers (SEA) | Energy & Policy |
| 11 | AI Data Centers vs Citizen Electricity Bills | Energy & Policy |
| 12 | How AI Data Centers Fund $57B Grid Modernization | Energy & Policy |
| 14 | The $64 Billion Rebellion: Communities vs DC | Energy & Policy |
| 16 | The Great SEA Data Center Bubble | Market & Industry |
| 17 | The $37 Billion Opportunity: SEA DC Surge | Market & Industry |
| geo-1 | The 72-Hour Warning | Geopolitics & Security |
| geo-2 | The $50 Trillion Shift | Market & Industry |
| geo-3 | Hormuz Fiber Shock | Geopolitics & Security |

### Future Forward (future-forward.html)
| # | Title | Sub-Category |
|---|-------|-------------|
| FF-1 | The Web Didn't Die. It Split | Digital Shifts |
| FF-2 | The Engineer Shortage Is Fake | Industry Disruption |
| FF-3 | The Training Era Is Over | Industry Disruption |

---

## Notes

- Articles 10-14, 16-17 are currently listed on `articles.html` but **logically belong to Global Analysis**. Migration to `geopolitics.html` is planned but not yet implemented in the HTML.
- When migrating, update: landing page cards, sitemap, search-index.json, navbar breadcrumbs.
- Each series has its own color identity — never mix colors across series.
- The ARTICLE_CREATION_PROMPT.md `SERIES` field must match one of these 3 series exactly.
