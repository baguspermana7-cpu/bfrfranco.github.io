# SEO Optimization Standard

> **Created**: 2026-02-24
> **Applies to**: All HTML pages in rz-work root
> **Batch**: Ideas 31-38 + 43 from Improvement Plan

---

## Overview

8 SEO/performance optimizations implemented across ~42 HTML pages:

| Idea | Feature | Scope |
|------|---------|-------|
| 31 | Meta Description Optimization | All 42 pages — trimmed to ≤155 chars |
| 32 | Internal Contextual Linking | 19 articles + geopolitics-1 — 3 links each |
| 33 | FAQ Schema Expansion | All 18 articles — 3-5 FAQs each |
| 34 | Image WebP Conversion | 19 covers → WebP with `<picture>` fallback |
| 35 | Canonical Tag Gaps | Added to privacy, terms, 404 |
| 36 | OG/Twitter Card Gaps | Fixed 6 pages (privacy, terms, 404, dashboard, pue-calc, tia-942) |
| 38 | hreflang Tags | All indexable pages — `hreflang="en"` |
| 43 | Preconnect/Prefetch Hints | All pages (jsdelivr + gtag preconnect/dns-prefetch) |

---

## Meta Descriptions (Idea 31)

### Rules
- **Max length**: 155 characters
- **Required**: All indexable pages must have `<meta name="description">`
- **Style**: Keyword-rich, action-oriented, specific to page content
- **Placement**: After `<title>` tag in `<head>`

### When Adding New Pages
Always include a meta description ≤155 chars. Use this pattern:
```html
<meta name="description" content="Your description here, max 155 characters.">
```

---

## Internal Linking (Idea 32)

### Link Map

| Article | Links To |
|---------|----------|
| 1 (Proactive) | → 7 (resilience), 8 (safety), 5 (tech debt) |
| 2 (Alarm) | → 1 (proactive), 8 (weak signals), 13 (power) |
| 3 (Maintenance) | → 5 (tech debt), 4 (in-house), 1 (maturity) |
| 4 (In-House) | → 3 (maintenance), 6 (RCA), 7 (resilience) |
| 5 (Tech Debt) | → 3 (maintenance), 1 (maturity), 8 (safety) |
| 6 (RCA) | → 8 (safety), 7 (resilience), 4 (design authority) |
| 7 (Resilience) | → 1 (maturity), 8 (safety), 13 (power) |
| 8 (Safety) | → 2 (alarm), 1 (proactive), 6 (RCA) |
| 9 (HVAC) | → 18 (AI factory), 10 (water), 13 (power) |
| 10 (Water) | → 9 (cooling), 11 (electricity), 12 (grid) |
| 11 (Electricity) | → 12 (grid value), 10 (water), 16 (SEA bubble) |
| 12 (Grid) | → 11 (electricity), 17 (SEA opportunity), 14 (community) |
| 13 (Power) | → 18 (AI factory), 9 (cooling), 7 (resilience) |
| 14 (Community) | → 11 (electricity), 12 (grid), 16 (SEA bubble) |
| 15 (Services) | → 17 (opportunity), 16 (market), 13 (power) |
| 16 (Bubble) | → 17 (opportunity), 14 (community), 11 (electricity) |
| 17 (Opportunity) | → 16 (bubble), 18 (AI factory), 15 (services) |
| 18 (AI Factory) | → 9 (cooling), 13 (power), 17 (opportunity) |
| geo-1 | → 16 (bubble), 17 (opportunity), 14 (community) |

### Rules for New Articles
- Add 3-5 in-prose contextual links to related articles
- Link text must be descriptive (not "click here")
- Place links mid-paragraph, not in headings/captions/calculators
- Use relative hrefs: `article-N.html`
- Update this link map when adding new articles

---

## FAQ Schema (Idea 33)

### Coverage
All 18 articles now have FAQPage JSON-LD. Each has 3-5 questions.

### Placement
After BreadcrumbList schema in `<head>`:
```
TechnicalArticle → BreadcrumbList → FAQPage
```

### Template
```html
<!-- Structured Data - FAQPage -->
<script type="application/ld+json">
{
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "Question text?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Answer text."
            }
        }
    ]
}
</script>
```

### Rules for New Articles
- Add 3-5 FAQs based on likely search queries for the article topic
- Keep answers concise (1-2 sentences)
- Place after BreadcrumbList schema

---

## WebP Images (Idea 34)

### Conversion
- 19 article covers converted: `assets/article-{N}-cover.webp`
- Quality: 80 (via Pillow)
- Average savings: 57-96% file size reduction

### `<picture>` Element Pattern
```html
<picture>
  <source srcset="assets/article-N-cover.webp" type="image/webp">
  <img loading="lazy" src="assets/article-N-cover.jpg" alt="...">
</picture>
```

### Applied In
- `articles.html` — all 18 card images wrapped in `<picture>`
- Individual article hero sections use CSS background-image (not `<img>`), so no `<picture>` wrapping needed

### Rules for New Articles
- Convert cover image to WebP (quality 80)
- Use `<picture>` element in articles.html card
- Keep JPG as fallback

---

## Canonical + hreflang (Ideas 35 & 38)

### Pattern
```html
<link rel="canonical" href="https://resistancezero.com/page.html">
<link rel="alternate" hreflang="en" href="https://resistancezero.com/page.html">
```

### Rules
- All indexable pages MUST have both canonical and hreflang tags
- noindex pages: skip hreflang, canonical is optional
- Placement: after `<meta name="robots">` or `<meta name="theme-color">`

---

## OG/Twitter Cards (Idea 36)

### Required Tags for All Pages
```html
<meta property="og:type" content="...">
<meta property="og:url" content="...">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:image" content="...">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
<meta name="twitter:image" content="...">
```

### Fallback Image
For pages without a custom cover: `assets/profile-photo.jpg`

---

## Preconnect/Prefetch (Idea 43)

### All Pages
```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
<link rel="dns-prefetch" href="https://www.googletagmanager.com">
```

### articles.html
```html
<link rel="prefetch" href="article-18.html">
<link rel="prefetch" href="article-17.html">
<link rel="prefetch" href="article-16.html">
```

### index.html
```html
<link rel="prefetch" href="articles.html">
```

### Rules
- Placement: after canonical/hreflang, before OG tags
- Update prefetch in articles.html when publishing new articles (always prefetch the 3 newest)

---

## Excluded Ideas

| Idea | Reason |
|------|--------|
| 37 (GSC Dashboard) | Requires server-side API + OAuth — incompatible with static site |
| 42 (CDN Setup) | Infrastructure-level, not code |
| 44 (Dead CSS Removal) | High risk for 5900+ line stylesheet without test coverage |
