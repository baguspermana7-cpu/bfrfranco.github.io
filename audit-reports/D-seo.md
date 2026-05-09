# D — SEO, AI-Search Discoverability & Structured-Data Audit

**Site**: https://resistancezero.com  
**Audit date**: 2026-05-09  
**Pages crawled**: 103 root HTML + 11 dc-market/ + 3 id/ = 117 total  
**Source**: `tools/audit-seo.py --json` extended with manual scripted checks across all 12 categories  
**Total items**: 111  

Severity scale: `CRITICAL` · `HIGH` · `MEDIUM` · `LOW`

---

## D1 — Per-page meta gaps

| # | Severity | File | Issue |
|---|----------|------|-------|
| D1-001 | HIGH | `article-9.html` | `<meta name="description">` content is only 12 chars: `"Nvidia Rubin"` — effectively absent |
| D1-002 | HIGH | `article-26.html` | `<meta name="description">` truncated at 24 chars: `"PFAS in data centers isn"` — incomplete sentence |
| D1-003 | HIGH | `article-16.html` | `<meta name="description">` only 42 chars (want 120-160): `"6,068 MW pipeline in Southeast Asia. Johor"` |
| D1-004 | HIGH | `article-20.html` | `<meta name="description">` only 45 chars — insufficient for SERP snippet |
| D1-005 | MEDIUM | `article-21.html` | `<meta name="description">` 272 chars — more than double the 160-char cap; gets truncated in SERPs |
| D1-006 | MEDIUM | `article-22.html` | `<meta name="description">` 196 chars — over limit |
| D1-007 | MEDIUM | `article-23.html` | `<meta name="description">` 188 chars — over limit |
| D1-008 | MEDIUM | `article-24.html` | `<meta name="description">` 208 chars — over limit |
| D1-009 | MEDIUM | `article-25.html` | `<meta name="description">` 181 chars — over limit |
| D1-010 | MEDIUM | `article-27.html` | `<meta name="description">` 181 chars — over limit |
| D1-011 | MEDIUM | `cx-calculator.html` | `<meta name="description">` 247 chars — over limit |
| D1-012 | MEDIUM | `datacenter-solutions.html` | `<meta name="description">` 228 chars — over limit |
| D1-013 | MEDIUM | `compare-pue-vs-dcie.html` | `<meta name="description">` 114 chars — 6 chars under 120-char minimum |
| D1-014 | MEDIUM | `carbon-footprint.html` | `<meta name="description">` 118 chars — just under 120-char minimum |
| D1-015 | MEDIUM | `article-18.html` | `<title>` is 98 chars — nearly double the 60-char cap; Google truncates at ~60 |
| D1-016 | MEDIUM | `geopolitics-3.html` | `<title>` is 116 chars — worst title-length offender on the site |
| D1-017 | MEDIUM | `article-27.html` | `<title>` is 91 chars |
| D1-018 | MEDIUM | `article-23.html` | `<title>` is 93 chars |
| D1-019 | MEDIUM | `article-25.html` | `<title>` is 84 chars |
| D1-020 | MEDIUM | `FF-1.html` | `<title>` is 81 chars AND `<meta name="description">` is 168 chars (over cap) |
| D1-021 | MEDIUM | `FF-2.html` / `FF-3.html` | `<title>` 81 and 83 chars respectively |
| D1-022 | MEDIUM | `datacenter-solutions.html` | `<title>` is 95 chars |
| D1-023 | LOW | `dc-market-tracker.html` | `twitter:title` and `twitter:description` both missing while `twitter:card` is present |
| D1-024 | LOW | `achievements.html` | `<meta name="description">` 164 chars — slightly over |
| D1-025 | LOW | `glossary.html` | `<meta name="description">` 178 chars — over limit |
| D1-026 | LOW | `asean-dc-report-2026.html` | `<meta name="description">` 204 chars |
| D1-027 | LOW | `chiller-plant.html` | `<title>` 68 chars AND `<meta name="description">` 170 chars — both slightly over |
| D1-028 | LOW | All 5 pillar pages | `<title>` 72-80 chars AND `<meta name="description">` 165-177 chars on all five (`pillar-cooling`, `pillar-fire-safety`, `pillar-power`, `pillar-standards`, `pillar-sustainability`) |

---

## D2 — Structured data validity

| # | Severity | File | Issue |
|---|----------|------|-------|
| D2-001 | HIGH | `glossary.html` | Second JSON-LD block has `@context: "https://schema.org"` but **empty `@type`** — schema.org validators will reject it |
| D2-002 | HIGH | `datahallAI.html` | **Zero JSON-LD** — dashboard page has no structured data at all |
| D2-003 | HIGH | `ltc-system-modelling-lab.html` | **Zero JSON-LD** — interactive lab has no structured data |
| D2-004 | HIGH | `tools.html` | JSON-LD declares `CollectionPage` only — **no BreadcrumbList** on a major hub page |
| D2-005 | MEDIUM | `article-10.html` | `TechnicalArticle` missing `image` property (required for Google's rich results) |
| D2-006 | MEDIUM | `article-11.html` | `TechnicalArticle` missing `dateModified` and `image` |
| D2-007 | MEDIUM | `article-12.html` | `TechnicalArticle` missing `dateModified` and `image` |
| D2-008 | MEDIUM | `article-13.html` | `TechnicalArticle` missing `dateModified` and `publisher` |
| D2-009 | MEDIUM | `article-15.html` | `TechnicalArticle` missing `dateModified` and `publisher` |
| D2-010 | MEDIUM | `article-4.html` | `TechnicalArticle` missing `dateModified` and `publisher` |
| D2-011 | MEDIUM | `article-9.html` | `TechnicalArticle` missing `image` |
| D2-012 | MEDIUM | All 14 articles (art-1 through art-9, excl. art-14–27) | `TechnicalArticle` `author` object missing `sameAs` (LinkedIn URL) — weakens E-E-A-T credibility signal |
| D2-013 | MEDIUM | Articles art-11 through art-27, art-4 | `TechnicalArticle` `author` object missing `url` property — 18 pages total |
| D2-014 | MEDIUM | `cx-calculator.html` | `WebApplication` + `HowTo` + `BreadcrumbList` present but **missing `FAQPage`** while page has visible FAQ section |
| D2-015 | MEDIUM | `carbon-footprint.html` | `HowTo` + `WebApplication` + `BreadcrumbList` present but **missing `FAQPage`** |
| D2-016 | MEDIUM | `dc-market-tracker.html` | `WebApplication` + `BreadcrumbList` — missing `FAQPage` and missing `datePublished`/`dateModified` on WebApplication |
| D2-017 | MEDIUM | `tier-advisor.html` | `WebApplication` missing `datePublished`/`dateModified` |
| D2-018 | MEDIUM | `tia-942-checklist.html` | `WebApplication` missing `datePublished`/`dateModified` |
| D2-019 | MEDIUM | `dc-market/index.html` | `CollectionPage` — no `FAQPage` on collection hub (other dc-market city pages all have it) |
| D2-020 | LOW | `Organization` schema in `index.html` | `sameAs` array contains `wa.me/…` WhatsApp URL — not an authoritative social profile; dilutes schema credibility |
| D2-021 | LOW | `insights.html` / `articles.html` / `geopolitics.html` | `CollectionPage` + `BreadcrumbList` present but no `FAQPage` despite pages containing FAQ-style content |

---

## D3 — Internal link integrity

| # | Severity | File | Issue |
|---|----------|------|-------|
| D3-001 | HIGH | `pln-java-grid-jatim.html` | Three internal links point to **`pln-java-grid-jateng-diy.html`** — file does not exist |
| D3-002 | HIGH | `pillar-cooling.html`, `pillar-power.html`, `pillar-standards.html` | These 3 pillar pages have **zero inbound links** from other root-level pages (orphaned) — no PageRank flows in |
| D3-003 | MEDIUM | `achievements.html` | **Orphaned** — no inbound links from any other page |
| D3-004 | MEDIUM | `dashboard.html` | **Orphaned** — no inbound links from any other page |
| D3-005 | MEDIUM | `chiller-plant.html` | Only 2 outbound internal links — below minimum threshold of 3 for PageRank distribution |
| D3-006 | MEDIUM | `future-forward-1.html` | Redirect stub with only 1 outbound link; itself is orphaned with no inbound links |
| D3-007 | LOW | All 103 root-level pages | Every page has a nav link to `Apps/second brain/index.html` — this resolves because the directory exists, but it points to an internal app not meant for public SEO crawling |

---

## D4 — Sitemap + llms.txt completeness

| # | Severity | File | Issue |
|---|----------|------|-------|
| D4-001 | HIGH | `changelog.html` | Page has `<meta name="robots" content="noindex">` **but is listed in sitemap.xml** — crawlers will find a contradiction: sitemap says crawl, page says ignore |
| D4-002 | HIGH | `404.html` | **404 error page is in sitemap.xml** — should never be submitted; confuses crawlers |
| D4-003 | HIGH | `ltc-ansi-tia-topology-readiness.html` | Indexable public page **not in sitemap.xml** |
| D4-004 | HIGH | `ltc-ashrae-thermal-control.html` | Indexable public page **not in sitemap.xml** |
| D4-005 | HIGH | `ltc-iso-energy-governance.html` | Indexable public page **not in sitemap.xml** |
| D4-006 | HIGH | `ltc-nfpa-fire-risk.html` | Indexable public page **not in sitemap.xml** |
| D4-007 | HIGH | `ltc-uptime-tier-alignment.html` | Indexable public page **not in sitemap.xml** |
| D4-008 | MEDIUM | `ltc-system-modelling-lab.html` | Public interactive lab **not in sitemap.xml** |
| D4-009 | MEDIUM | `standards-ltc-lab.html` | Hub/landing for LTC labs **not in sitemap.xml** |
| D4-010 | MEDIUM | `privacy.html` | Legal page **not in sitemap.xml** — Bing/Google expect privacy pages to be listed |
| D4-011 | MEDIUM | `terms.html` | Legal page **not in sitemap.xml** |
| D4-012 | MEDIUM | `dashboard.html` | Indexable page **not in sitemap.xml** |
| D4-013 | MEDIUM | `future-forward-1.html` | Redirect stub is in sitemap as a fully indexable page — should either be excluded or `<changefreq>` set to signal minimal crawl priority |
| D4-014 | LOW | Sitemap `lastmod` | All 103 sitemap entries carry today's date (`2026-05-09`) — bulk-stamped dates reduce signal value; per-page actual modification dates would improve crawl prioritisation |
| D4-015 | LOW | `llms.txt` | References only 98 of 103+ indexable pages — the 5 LTC lab pages and `standards-ltc-lab.html` are absent |

---

## D5 — hreflang for multilingual

| # | Severity | File | Issue |
|---|----------|------|-------|
| D5-001 | HIGH | `article-21.html`, `article-22.html`, `article-23.html`, `article-24.html`, `article-25.html`, `article-26.html`, `article-27.html` | Each has only **one** `hreflang` tag (`hreflang="en"`) — missing the paired `hreflang="x-default"`. Google requires both to form a valid alternate set (7 pages) |
| D5-002 | HIGH | `datahallAI.html` | Only `hreflang="en"` — missing `hreflang="x-default"` counterpart |
| D5-003 | MEDIUM | `id/index.html`, `id/artikel.html`, `id/glosarium.html` | All 3 Indonesian pages confirm their own `hreflang="id"` but the **reciprocal** `hreflang="id"` link is missing from most corresponding English pages; only `index.html`, `articles.html`, and `glossary.html` have the reciprocal pair |
| D5-004 | MEDIUM | English article pages (art-1 through art-27), geopolitics, FF, pillar, compare, calc pages | **No `hreflang="id"`** pointing to any Indonesian alternate — while most content has no Indonesian translation, pages like `glossary.html` do; the pair exists correctly there but the pattern is not applied to closely related content such as `pillar-*.html` |
| D5-005 | LOW | `datahallAI.html`, `article-21.html` through `article-27.html` | `hreflang` self-referencing URL format inconsistent with majority of site — most pages use full absolute URLs, newer articles use the same pattern correctly but 1 hreflang tag is simply missing (see D5-001) |

---

## D6 — Robots.txt + crawl directives

| # | Severity | File | Issue |
|---|----------|------|-------|
| D6-001 | MEDIUM | `robots.txt` | `Disallow: /tools/` blocks the Python tooling directory — acceptable, but also prevents crawl of any public-facing sub-page if one is ever published under that path; current path is internal-only so status is borderline |
| D6-002 | MEDIUM | `robots.txt` | `Applebot` (Apple Siri/Spotlight), `FacebookBot`, `LinkedInBot`, `DuckDuckBot`, `CCBot`/`CommonCrawl` — none have explicit `User-agent:` rules; they fall through to `*` which allows `/` but without the deliberate explicit consent signal that newer AI crawlers like Applebot-Extended respect |
| D6-003 | MEDIUM | `robots.txt` | `Sitemap: https://resistancezero.com/llms.txt` — listing `llms.txt` as a Sitemap directive is non-standard (it is NOT XML Sitemap format); Googlebot will attempt to parse it as a sitemap and may log errors |
| D6-004 | LOW | `robots.txt` | `BingSiteAuth.xml` exists at root but contains placeholder `REPLACE_WITH_BING_VERIFICATION_TOKEN` — Bing Webmaster Tools site verification is not completed; without this, Bing's IndexNow integration and ownership verification are unverified |
| D6-005 | LOW | `robots.txt` | `Disallow: /Article/` blocks 38 internal post-draft files — correct behaviour, but `Article/` dir contains subdirectories with some future article HTML that may need indexing when published; review path before adding live content there |

---

## D7 — AI search optimisation

| # | Severity | File | Issue |
|---|----------|------|-------|
| D7-001 | HIGH | 67 pages total | **`<meta name="ai-content-declaration">` is missing** on 67 of 117 pages: all 10 compare pages, all 5 pillar pages, all 6 PLN Java-Bali pages, all 5 infographic pages, all 6 LTC lab pages, all 11 dc-market/ pages, all 3 id/ pages, FF-1/2/3, geopolitics-1/2/3, glossary, insights, future-forward, asean-dc-report-2026, dc-market-tracker, datahall, rfs-readiness-workbench, standards-ltc-lab, terms, privacy, EPMS_Telemetry, achievements, 404 — see full list above |
| D7-002 | HIGH | `future-forward-1.html` | **Thin content** — page is a bare HTTP-refresh redirect stub with ~8 words of visible text; LLM crawlers will ignore it or assign near-zero ingestion value; it should be excluded from sitemap and robots |
| D7-003 | HIGH | `datahallAI.html` | Zero JSON-LD blocks — AI search engines cannot infer entity type, topic, or author for this page |
| D7-004 | MEDIUM | `cx-calculator.html`, `carbon-footprint.html` | Both have visible FAQ sections in their HTML but are missing `FAQPage` schema — prevents Google/Bing AI from generating AI Overviews or SGE answers sourced from these pages |
| D7-005 | MEDIUM | `dc-market-tracker.html`, `insights.html`, `articles.html`, `geopolitics.html`, `tier-advisor.html`, `tia-942-checklist.html` | Pages contain Q&A or instructional step content but lack `FAQPage` or `HowTo` schema — missed opportunity for AI-citation rich snippets |
| D7-006 | MEDIUM | `article-9.html`, `article-16.html`, `article-20.html`, `article-26.html` | Meta descriptions so short (12, 42, 45, 24 chars) they provide almost no keyword-rich summary for LLM context extraction |
| D7-007 | LOW | `llms.txt` | 5 LTC lab pages and `standards-ltc-lab.html` are absent from `llms.txt` — AI agents following the `llms.txt` spec will not discover these pages |
| D7-008 | LOW | `index.html` only | `<meta name="msvalidate.01">` and IndexNow key meta exist only on the homepage — other pages do not need them, but the IndexNow key meta (`<meta name="indexnow-key">`) is only present on `index.html`; the key file itself (`768683436ffdfcc2bb9140345660b139.txt`) is correct and complete |

---

## D8 — Open Graph image quality

| # | Severity | File | Issue |
|---|----------|------|-------|
| D8-001 | HIGH | 35 pages | `og:image` resolves to **`assets/profile-photo.jpg`** (17 KB portrait photograph, ~200×200 px) — this is far below the 1200×630 requirement and appears as a tiny portrait on social shares; affected pages include all 10 compare pages, all 5 pillar pages, 3 infographic pages, glossary, insights, geopolitics, datahall, fire-system, fuel-system, water-system, ict, chiller-plant, achievements, asean-dc-report-2026, dashboard, privacy, terms |
| D8-002 | HIGH | 42 pages (all except the 12 with dedicated OG cards) | Missing **`og:image:width`** and **`og:image:height`** properties — Facebook, LinkedIn, and Slack preview renderers fall back to guessing dimensions which often results in wrong crop |
| D8-003 | MEDIUM | `asean-dc-report-2026.html` | Uses generic `profile-photo.jpg` fallback — a 2026 ASEAN market report is a high-value page that deserves a custom OG card |
| D8-004 | MEDIUM | All 5 pillar pages | Use `profile-photo.jpg` fallback — pillar pages are hub content and high-visibility; custom OG cards (via `tools/build-og-images.py`) would improve click-through rates on social shares |
| D8-005 | MEDIUM | All 10 compare pages | Use `profile-photo.jpg` fallback — comparison pages are frequently shared on LinkedIn; custom 1200×630 cards showing the two technologies head-to-head would significantly improve CTR |
| D8-006 | MEDIUM | 18 pages with `og:image` but no `og:image:alt` | Missing `og:image:alt` attribute reduces accessibility on social platforms and weakens LinkedIn / Facebook unfurl metadata: `404.html`, `changelog.html`, `chiller-plant.html`, 5 compare pages, `cx-calculator.html`, `dc-market-tracker.html`, 5 PLN pages, `rfs-readiness-workbench.html`, `tier-advisor.html` |
| D8-007 | LOW | `changelog.html` | Uses `assets/og/index.webp` (homepage card) as its OG image — wrong card for the changelog page |

---

## D9 — Author + credibility signals (E-E-A-T)

| # | Severity | File | Issue |
|---|----------|------|-------|
| D9-001 | HIGH | `article-1.html` through `article-9.html` (14 pages) | `TechnicalArticle` `author` object has `name` and `url` but **no `sameAs` LinkedIn URL** — LinkedIn is the primary professional E-E-A-T signal for an engineering author |
| D9-002 | HIGH | `article-11.html`, `article-12.html`, `article-13.html`, `article-15.html`, `article-4.html` | `TechnicalArticle` schema missing **`dateModified`** — Google recommends this for freshness assessment in E-E-A-T |
| D9-003 | HIGH | `article-10.html`, `article-11.html`, `article-12.html`, `article-9.html` | `TechnicalArticle` missing **`image`** property — required for Google rich result eligibility |
| D9-004 | MEDIUM | `article-11.html` through `article-27.html` + `article-4.html` (18 pages) | `TechnicalArticle` `author` object missing **`url`** property — reduces verifiability of author identity for AI credibility checks |
| D9-005 | MEDIUM | `article-13.html`, `article-15.html`, `article-4.html` | `TechnicalArticle` missing **`publisher`** object — required for Google rich result validation |
| D9-006 | MEDIUM | All 10 hub pages (`tools.html`, `articles.html`, `glossary.html`, `insights.html`, `datacenter-solutions.html`, all 5 pillar pages) | No **`Organization` schema** — hub pages benefit from Organisation markup that ties them to the site's identity and establishes topical authority |
| D9-007 | MEDIUM | `Organization` schema in `index.html` | `sameAs` array includes a WhatsApp link (`wa.me/…`) — this is not an authoritative profile URL and may reduce trust scoring |
| D9-008 | LOW | `asean-dc-report-2026.html` | Has no `Report` or `Article` schema — the page is a detailed research report but uses only `BreadcrumbList` + `FAQPage`; a `TechArticle` or `Report` schema would establish authorship and publication date |

---

## D10 — Internal linking density

| # | Severity | File | Issue |
|---|----------|------|-------|
| D10-001 | HIGH | `pillar-cooling.html`, `pillar-power.html`, `pillar-standards.html` | **Zero inbound links** from any other root-level page — PageRank cannot flow into these pages regardless of content quality |
| D10-002 | HIGH | `achievements.html` | **Zero inbound links** — complete PageRank isolation |
| D10-003 | MEDIUM | `chiller-plant.html` | Only 2 outbound internal links (below the 3-link minimum) — poor distribution of link equity to related pages |
| D10-004 | MEDIUM | `tools.html` | Missing **`BreadcrumbList`** schema — the main tools hub lacks breadcrumb structured data that would help search engines understand its position in the IA |
| D10-005 | MEDIUM | `datahallAI.html`, `ltc-system-modelling-lab.html` | Both pages have **zero JSON-LD** — no BreadcrumbList to signal navigation context |
| D10-006 | LOW | `dashboard.html` | Orphaned page: zero inbound links, not in sitemap, no BreadcrumbList |
| D10-007 | LOW | `future-forward-1.html` | Orphaned redirect stub: zero inbound links, in sitemap, 1 outbound link only |

---

## D11 — Content freshness signals

| # | Severity | File | Issue |
|---|----------|------|-------|
| D11-001 | HIGH | `article-9.html` | Meta description is `"Nvidia Rubin"` (12 chars) — almost certainly a draft/placeholder that was never completed |
| D11-002 | HIGH | `article-26.html` | Meta description is `"PFAS in data centers isn"` — sentence cut off, clearly a truncation artefact from authoring |
| D11-003 | HIGH | 56 pages | No `dateModified` in JSON-LD — affects all non-article pages that have custom JSON-LD plus 5 articles (see D2-006 through D2-011): all calculator pages, compare pages, LTC lab pages, PLN pages, pillar pages, infographic pages, hub pages, dashboards. Without `dateModified`, Googlebot has no freshness signal beyond `<lastmod>` in sitemap |
| D11-004 | MEDIUM | `BingSiteAuth.xml` | Contains placeholder `REPLACE_WITH_BING_VERIFICATION_TOKEN` — verification with Bing Webmaster Tools is incomplete; IndexNow and Bing crawl priority features remain unverified |
| D11-005 | MEDIUM | `article-4.html` | `datePublished: 2025-11-22` — this article is dated November 2025, over 5 months before today; `dateModified` is also missing; Google treats content with no `dateModified` and an old `datePublished` as stale |
| D11-006 | LOW | All 103 sitemap entries | `<lastmod>` uniformly set to `2026-05-09` (today) for every URL — bulk stamping all pages with today's date is a common pattern but degrades the signal value; it prevents crawlers from prioritising genuinely updated pages over static ones |
| D11-007 | LOW | `dc-market-tracker.html`, `tier-advisor.html`, `tia-942-checklist.html` | `WebApplication` schema has no `datePublished` or `dateModified` — tools have no temporal anchor for freshness scoring |

---

## D12 — IndexNow integration

| # | Severity | File | Issue |
|---|----------|------|-------|
| D12-001 | HIGH | `BingSiteAuth.xml` | Contains literal placeholder text `REPLACE_WITH_BING_VERIFICATION_TOKEN` — Bing Webmaster Tools ownership is **not verified**; without verified ownership, IndexNow submissions for Bing may be silently rejected |
| D12-002 | MEDIUM | IndexNow key meta | `<meta name="indexnow-key" content="768683436ffdfcc2bb9140345660b139">` exists **only on `index.html`** — while the key file itself at `768683436ffdfcc2bb9140345660b139.txt` is valid and correctly contains the key, not having it on other pages means some crawlers that expect the meta tag on the URL being submitted may fail validation |
| D12-003 | MEDIUM | `robots.txt` | Lists `Sitemap: https://resistancezero.com/llms-full.txt` — `llms-full.txt` is a Markdown dump (~1.9 MB), not a valid XML Sitemap; standard crawlers (Googlebot, Bingbot) will attempt to parse it as sitemap XML and log errors; this should be replaced with a direct link only in the `llms.txt` header, not in robots.txt `Sitemap:` |
| D12-004 | LOW | 5 LTC pages + `standards-ltc-lab.html` + `privacy.html` + `terms.html` (8 pages) | These pages exist and are indexable but have never been submitted to IndexNow because they are absent from `sitemap.xml` — new crawlers relying on sitemap to trigger IndexNow pings will miss them indefinitely |
| D12-005 | LOW | `tools/indexnow-submit.py` | Script exists and key file is valid, but without Bing Webmaster verification (D12-001) Bing submissions are effectively unverified; Yandex submission may still work but Yandex has a `Crawl-delay: 2` set in robots.txt with no explicit IndexNow block |

---

## Summary by severity

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 45 |
| MEDIUM | 46 |
| LOW | 20 |
| **Total** | **111** |

## Top 10 highest-impact fixes

1. **D8-001 / D8-002** — 35 pages serving a ~200px portrait photo as OG image and 42 pages missing `og:image:width`/`og:image:height`; run `tools/build-og-images.py` to generate missing cards
2. **D7-001** — 67 pages missing `<meta name="ai-content-declaration">`; can be bulk-injected
3. **D4-001 + D4-002** — `changelog.html` (noindex) and `404.html` are in `sitemap.xml`; remove both
4. **D4-003 through D4-007** — 5 LTC lab pages missing from sitemap; add to `tools/build-sitemap.py` include list
5. **D2-001** — `glossary.html` second JSON-LD block has an empty `@type`; structured data validator will flag this
6. **D1-001 through D1-004** — 4 article pages with near-empty meta descriptions (12, 24, 42, 45 chars)
7. **D5-001** — 7 recent articles missing `hreflang="x-default"` (missing the second of the required pair)
8. **D9-001** — 14 articles whose `TechnicalArticle` author object lacks `sameAs` LinkedIn URL
9. **D12-001** — BingSiteAuth.xml still has placeholder token; Bing site ownership unverified
10. **D3-001** — `pln-java-grid-jatim.html` has 3 links to non-existent `pln-java-grid-jateng-diy.html`
