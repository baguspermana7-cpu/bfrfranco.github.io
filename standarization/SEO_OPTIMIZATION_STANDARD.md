# SEO Optimization Standard

> **Created**: 2026-02-24
> **Applies to**: Published HTML at the root and reviewed nested publication directories
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

## Growth Plan — Implemented (March 2026)

The following SEO growth features were implemented as part of the viral growth plan:

| Feature | Files Created | Impact |
|---------|---------------|--------|
| **Programmatic SEO** — 10 city-specific DC market pages | `dc-market/*.html` (10 cities + hub) | Long-tail keywords for Singapore, Jakarta, KL, Sydney, Tokyo, Mumbai, Dubai, London, Frankfurt, NoVA |
| **"vs" Comparison Pages** — 10 head-to-head comparison articles | `compare-*.html` (10 pages) | Featured snippet targeting: "X vs Y data center" |
| **Glossary Hub** — 300+ data center terms | `glossary.html` | DefinedTerm schema, A-Z navigation, search, featured snippets |
| **Topic Cluster Pillar Pages** — 5 authority hubs | `pillar-*.html` (cooling, power, fire-safety, standards, sustainability) | Topical authority, internal linking, CollectionPage schema |
| **ASEAN DC Standards Report** | `asean-dc-report-2026.html` | Annual report with data tables, CSS charts, investment forecast |
| **Multilingual (Bahasa Indonesia)** | `id/index.html`, `id/artikel.html`, `id/glosarium.html` | Indonesian market targeting, hreflang id/en |
| **Interactive Infographics** — 3 shareable visualizations | `infographic-pue-global.html`, `infographic-dc-cost-breakdown.html`, `infographic-dc-sustainability.html` | Social sharing, CSS-only animations, embedded calculators |
| **Embeddable Widgets** — iframe calculator versions | `embed/pue-widget.html`, `embed/capex-widget.html`, `embed/carbon-widget.html` | Backlink generation, "Powered by ResistanceZero" |
| **PWA** — Progressive Web App support | `manifest.json`, `sw.js` | Offline access, installable, cache-first for assets |
| **Gamification** — Achievement badges + tracking | `achievements.html`, `rz-gamification.js` | User engagement, 17 achievements across 5 categories |
| **Schema Markup Expansion** | BreadcrumbList on 24+ pages | Rich results, site links |
| **Core Web Vitals** | width/height on images, lazy loading | LCP, CLS optimization |
| **Bing/Yandex Submission** | IndexNow, robots.txt updates | Multi-engine indexing |

### Sitemap & Search Index Maintenance
- **Sitemap**: Started at 43 URLs → now 85+ URLs
- **Search index**: Started at 33 entries → now 73+ entries
- Both files MUST be updated whenever new pages are added

### New Page Checklist (for growth pages)
All new growth pages follow these standards:
- [ ] BreadcrumbList + FAQPage JSON-LD schema
- [ ] hreflang en + x-default (+ `id` for Indonesian pages)
- [ ] OG/Twitter meta tags
- [ ] `.nav-menu` navbar pattern (Type A)
- [ ] Dark/light mode support
- [ ] auth.js loaded before `</body>`
- [ ] Cookie banner
- [ ] Mobile responsive
- [ ] Added to `sitemap.xml` and `search-index.json` (MUST include `date` field — powers homepage ticker auto-update)
- [ ] `search-index.json` entry has: `title`, `url`, `description`, `category`, `keywords`, `date` (YYYY-MM-DD format)

---

## Excluded Ideas

| Idea | Reason |
|------|--------|
| 37 (GSC Dashboard) | Requires server-side API + OAuth — incompatible with static site |
| 42 (CDN Setup) | Infrastructure-level, not code |
| 44 (Dead CSS Removal) | High risk for 5900+ line stylesheet without test coverage |

---

## AI Search Optimisation (Plan v14 mandate, 2026-05-09)

### llms.txt + llms-full.txt

- `/llms.txt` — content map per https://llmstxt.org. Updated by `tools/build-llms-txt.py` after every batch of new pages.
- `/llms-full.txt` — full-content variant for one-shot LLM context loading. Regenerated weekly or after any meaningful content change.

### AI bot directives in robots.txt

Named crawlers and `*` share one rule group. Yandex keeps its separate crawl delay with the complete same disallow list. A specific group does not inherit the wildcard group's restrictions. Permission does not improve crawl priority or guarantee indexing. `llms.txt` is an AI discovery map, not a sitemap, and must not appear in a `Sitemap:` directive.

### ai-content-declaration meta

```html
<meta name="ai-content-declaration" content="human-authored">
```

Add to all human-authored articles + calc pages. Be honest — pages with AI-assisted content should declare `content="partially-ai-assisted"`.

### IndexNow workflow (Bing/Yandex/Seznam push indexing)

After each git push touching `*.html`:
```bash
python3 tools/indexnow-submit.py --since HEAD~1
```

Pushes changed URLs → Bing/Yandex re-crawl within minutes. The IndexNow key lives at `/<keyhex>.txt` site root (Bing reads to verify ownership; the key only authorises submissions for THIS domain so leakage is low-impact).

### FAQPage schema placement

Calc pages (PUE/CAPEX/OPEX/ROI/TCO) MUST have FAQPage schema covering:
1. "How is X calculated?"
2. "What inputs affect Y the most?"
3. "What's a typical range for Z in {region}?"

Tool pages (TIA-942 checklist, tier-advisor) MUST have HowTo schema.

### Audit gate

Run before every push:
```bash
python3 tools/audit-seo.py --strict
```

## Crawler publication contract (2026-09-08)

Owner request: total site/article anti-vibecode and readability coverage with no sitemap/robots omissions. This workstream owns crawler discovery only; it does not certify rendered readability, auth enforcement, deployed HTTP headers, or search-engine indexing. Release/version/changelog/service-worker work belongs to the coordinating owner.

### One inventory, three exports

`tools/crawler_inventory.py` is the publication-policy source for `build-sitemap.py`, `build-llms-txt.py`, and `build-llms-full.py`.

- Enumerate all Git-tracked HTML recursively, including staged additions. Report nonignored untracked HTML as `untracked`; local previews are not publication approval. Ignored local artifacts are outside the deployed inventory.
- Root pages and reviewed `id/`, `manual/`, `prd/`, `network/`, and `dc-market/` paths are candidates at every depth. Unknown tracked directories fail with `unreviewed-directory`, never silently enter the sitemap. The `dc-market/` category is historical publication policy, not evidence that those files currently exist.
- Preserve explicit internal/source-directory and file exclusions. In particular, `/Apps/` and `/dcmoc/` remain disallowed for every named crawler. Never remove exclusions merely to make URL counts match.
- Parse the complete HTML head, not the first 3,000 bytes: attribute order/case, repeated directives, `none`, and Googlebot/Bingbot-specific noindex are handled. Comments and script text cannot supply fake metadata. Noindex pages and refresh redirects do not enter any export.
- Require a clean exact-origin canonical, resolving relative canonicals against the source URL. Multiple/empty/off-origin canonicals fail closed. Aliases cannot create duplicate URLs; their target must independently be an included self-canonical page. Missing canonicals use the existing file URL and produce a warning for the page owner.
- Check both file URLs and canonical URLs against wildcard and named crawler groups. A public indexable page blocked by robots is an error. A blocked noindex page produces a warning: crawlers cannot read its noindex, but this audit never unblocks it automatically.
- Every tracked HTML path has an explicit disposition. Inclusion counts are generated, never hardcoded as a pass criterion.

### Truthful modification dates

`lastmod` is optional and is currently omitted for every URL. A Git commit can represent a shared footer/style update, and a checkout mtime is not publication history; neither proves a significant page update. Do not substitute the build date, silently fall back to mtime, or label an unverified commit date as content freshness. Introducing dates requires a reviewed significant-change evidence source plus new regression tests and audit support. Existing `priority`/`changefreq` values are retained for compatibility, not treated as Google ranking signals.

### LLM discovery and access boundaries

- Both LLM maps use exactly the same canonical URL set as the sitemap. Noindex incident dossiers, admin/design helpers, excluded directories, aliases, and local previews must never become full-text side doors.
- An indexable landing page can have an access-controlled body. `llms.txt` contains only its public head metadata; listing the URL is not permission to access the body.
- `llms-full.txt` conservatively emits a clearly marked **metadata-only** section when static markup indicates a root/pro/premium/gated/locked area, runtime access checks are present, or `auth.js` declares a matching `ROOT_ONLY_PATHS` entry. This also withholds public prose on some mixed public/premium pages rather than risk exporting protected analysis. Public manual/PRD pages remain independently eligible.
- Static gate detection is not a proof of arbitrary JavaScript authorization. Any new access-control convention must add a fail-closed export test before release. Restoring full prose from mixed-access pages requires verified anonymous-content extraction, not a blanket override.
- Export failures stop before writing; errors never become public `[ERROR ...]` body text. Content beyond 20 MB or an existing `llms-archive.txt` requires explicit archive/privacy review rather than creating, retaining, or deleting an unreviewed overflow silently.
- `--check` verifies deterministic exact output without writing. Both LLM builders retain their historical no-argument write behavior and accept explicit `--apply` and non-writing `--dry-run`.

### Required offline checks

```bash
python3 tools/test-crawler-seo.py
python3 tools/build-sitemap.py --apply
python3 tools/build-llms-txt.py --apply
python3 tools/build-llms-full.py --apply
python3 tools/build-sitemap.py --check
python3 tools/build-llms-txt.py --check
python3 tools/build-llms-full.py --check
python3 tools/crawler_audit.py --strict
python3 tools/crawler_audit.py --json
```

The crawler audit always exits nonzero for errors, including with `--json`; unavailable input is not a passing empty inventory. JSON includes all path dispositions, content-export policy, counts, duplicate/missing/unexpected URLs, warnings, and verification limits. It compares XML structurally and LLM exports both by URL coverage and exact expected content, including metadata-only protection. Keep generated evidence local, not in public discovery maps.

The earlier Content Linkage Playbook note about manually adding nested Network Hub sitemap entries is superseded by this recursive builder contract; do not hand-edit generated URL lists. Search-index and article/rendered-content maintenance remain separate workstreams.

### Official crawler references

- [Google robots.txt interpretation](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec): specific groups, shared agent groups, longest-path rules, and sitemap declarations.
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): canonical URLs, optional accurate significant-update `lastmod`, and ignored priority/change frequency signals.
- [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing): crawling must be allowed to observe noindex; robots is not authentication.
- [llms.txt proposal](https://llmstxt.org/): an LLM discovery map complements but does not replace robots/sitemaps or grant access.
