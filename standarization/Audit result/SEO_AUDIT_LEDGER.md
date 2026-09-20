# SEO / GEO audit ledger — resistancezero.com

**A living ledger, not a report.** Every finding carries a status. When a finding is closed, the
line records the version that closed it and the gate that now keeps it closed; when it is open, it
records why it has not been swept. Re-run the measurements below before trusting any row.

- Audit opened: **2026-09-20** (site v3.10.15)
- Last updated: **2026-09-20** (site v3.10.17)
- Scope: the 176 HTML pages `sitemap.xml` publishes. `standarization/`, `Apps/`, `Data/`,
  `Article/`, `dcmoc/`, `games/`, `Dunia-Emosi/` are robots-Disallowed and out of scope.

---

## Score at the time of the audit — 78 / 100

| area | score | basis |
|---|---:|---|
| Indexability & crawl | 85 | 180 sitemap URLs, 0 noindex conflicts, robots.txt correct |
| On-page metadata | 62 | title/description/canonical 100%, but 94 titles + 96 descriptions out of band |
| Structured data | 88 | 93 FAQPage, 55 TechArticle, 42 HowTo, 159 BreadcrumbList |
| AI / answer engines | 90 | llms.txt 180 entries, llms-full.txt 2.88 MB, 15 AI agents named in robots |
| Internal linking | 80 | 7 orphans; index.html 904 inbound |
| Performance | 72 | median page 55 KB, gzip on; datahallAI.html 1,375 KB |
| E-E-A-T | 75 | Person schema 125/176; dates on only 39/176 |

**Caveats that must travel with the score:** these are STATIC SOURCE measurements, not Lighthouse
runs and not Search Console data. Core Web Vitals are inferred from page weight, never measured.
An SEO score is a proxy for discoverability and never a ranking prediction.

---

## CLOSED

| # | finding | measured | closed in | kept closed by |
|---|---|---|---|---|
| A | Cache-token gate walked the repository root only (`readdir(ROOT)`); **79 of 90 sub-directory pages** served a shared asset under a stale/legacy token — `rz-version.js` on 78, `styles.min.css` on 76 (`?v=20260908-editorial`), `auth.js` on 43 | 266 pages now scanned, up from 179; 253 retokened | v3.10.17 | `tools/test-asset-cache-tokens.mjs` |
| B | The 25 `network/**` protocol explainers carried **no `og:*`, no `twitter:card`, no JSON-LD** — the most citable pages on the site, the least marked up. `build-og-images.py` had the identical root-only glob | og:title/og:image/JSON-LD/twitter:card all 86–81% → **100%** | v3.10.17 | — (see OPEN-7) |
| C | Newsletter capture on 22 pages + `subscribeNewsletter()`; PRO/Premium tier copy on ~40 pages | 114 findings → 0 | v3.10.16 | `tools/test-no-commercial-surface.mjs` |
| D | `articles.html` drew article-15's thumbnail from `assets/og/index.webp`, which v3.9.0 repainted into the owner's portrait | repointed to `assets/article-15-cover.webp`, real 800×1433 declared | v3.10.16 | — |
| E | Search Console indexing list four months stale — 102 URLs where the sitemap publishes 180, naming a product retired in v2.0.0 | 102 → 180 | v3.10.14 | `tools/test-generator-freshness.py` |

---

## WITHDRAWN

| # | recommendation | why it was withdrawn |
|---|---|---|
| W1 | Add `<lastmod>` to sitemap.xml (180 `priority` + 180 `changefreq` ship, both ignored by Google; zero `lastmod`, which it uses) | `tools/build-sitemap.py:53` omits it **deliberately**: *"Omit dates: Git commits and checkout mtimes do not prove significant updates."* A checkout mtime or a cache-token commit is not a content update, and Google discards a `lastmod` it finds unreliable. Recommended without reading the code. If ever wanted, the only honest source is the page's own authored `dateModified`, omitted where the page makes no claim. |

---

## OPEN — needs authored judgement, not a sweep

| # | finding | measured 2026-09-20 | why it is not mechanical |
|---|---|---|---|
| 1 | Titles outside 30–60 chars | **94 of 176**; worst `manual/dc-conventional.html` at 94 chars | Rewriting 94 titles is authoring. A generated title is worse than a long one. |
| 2 | Meta descriptions outside 70–160 chars | **96 of 176**; worst `pln-java-grid-jateng.html` at 267 | Same — the snippet you wrote is not the snippet shown, but truncating mechanically loses the point of the sentence. |
| 3 | No `datePublished` / `dateModified` | **137 of 176** | A date cannot be invented. Answer engines weight freshness; an undated technical page reads as stale. Needs the real authoring date per page. |
| 4 | More than one `<h1>` | **41 pages** | Which heading is the page's subject is an editorial decision. |
| 5 | No `<h1>` at all | **4** — `chiller-plant.html`, `datahall.html`, `ict.html`, +1 | Cockpit pages; the title lives in the instrument chrome. Needs a design decision, not an inserted tag. |
| 6 | Orphan pages, zero internal inbound links | **7** — `id/artikel.html`, `id/glosarium.html`, `manual/opex.html`, `manual/dcmoc.html`, `manual/research-roadmap.html`, `manual/ltc-system-modelling-lab.html`, `manual/standards-ltc-lab.html` | Where a link belongs is editorial placement. |
| 7 | No gate asserts metadata completeness | og/twitter/JSON-LD are at 100% today and nothing holds them there | A gate is warranted; it was not written in v3.10.17 and that is why this row is open. |
| 8 | `datahallAI.html` is 1,375 KB against a 55 KB median | 25× the median | Core Web Vitals liability on mobile; splitting it is a large change, tracked with Track A. |
| 9 | Commercial artefacts remain in a PUBLIC repository | `rz-ops-p7x3k9m.html` (root-gated, noindex, sitemap-absent: Revenue Analytics, Mayar Payments, Tier Manager); `Data/Freemium Scheme/` (56 tracked files incl. a Mayar payment webhook) | No reader can reach either. **Deleting the files would not remove them from git history**, so deletion alone does not achieve what it appears to. Owner's decision. |

---

## How to re-measure

```bash
node tools/test-asset-cache-tokens.mjs          # A
node tools/test-no-commercial-surface.mjs       # C
python3 tools/test-generator-freshness.py       # E
```

Metadata coverage, orphans, title/description bands and `<h1>` counts are measured by the ad-hoc
scripts recorded in the v3.10.17 changelog entry; OPEN-7 exists because they are not yet a gate.
