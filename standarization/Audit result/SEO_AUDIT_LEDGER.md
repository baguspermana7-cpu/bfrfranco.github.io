# SEO / GEO audit ledger — resistancezero.com

**A living ledger, not a report.** Every finding carries a status. A finding is CLOSED only with the
version that closed it AND the gate that keeps it closed; a finding with no gate stays OPEN and
says why. Re-measure before trusting a row.

- Audit opened: **2026-09-20** (site v3.10.15) · last updated **2026-09-20** (site v3.10.18)
- Population: the 176 HTML pages `sitemap.xml` publishes. `standarization/`, `Apps/`, `Data/`,
  `Article/`, `dcmoc/`, `games/`, `Dunia-Emosi/` are robots-Disallowed and out of scope.

---

## Read this first — four of the original findings were measurement artifacts

The first pass of this audit was scanned with ad-hoc scripts, and four rows did not survive being
re-measured properly. They are recorded here rather than quietly deleted, because the mistakes are
the same class the site's own gates exist to prevent:

| original claim | truth | what was wrong with the measurement |
|---|---|---|
| 7 orphan pages | **0** | hrefs were compared as raw strings instead of being resolved against the linking page's directory, and sitemap URLs in directory form (`manual/`) were excluded from the source list — which is exactly where all of them are linked from |
| 41 pages with multiple `<h1>` | **0** | `<h1>` occurrences inside `<script>` string literals were counted as markup (one calculator holds 11 report templates for its PDF export) |
| 94 titles "out of band" | **2** | a generic 30–60 char rule applied to titles that deliberately carry `\| ResistanceZero`. Measured properly — does the SUBJECT survive the ~60-char display cut — 174 of 176 are fine |
| 96 descriptions "out of band" | **90, and cosmetic** | length alone is not the defect; truncation is. 86 of 176 end on a complete clause; the rest are comma-separated keyword lists cut mid-item, which is untidy in a SERP and loses no meaning |

**A count is not a finding.** Each of those needed a question about what the number means before it
meant anything.

---

## Score

**78 / 100 at open (v3.10.15).** Re-scored **88 / 100** at v3.10.18.

| area | open | now | why it moved |
|---|---:|---:|---|
| Indexability & crawl | 85 | 85 | unchanged; robots.txt and sitemap were already correct |
| On-page metadata | 62 | **95** | og/twitter/JSON-LD 86–81% → 100%, every article dated, and a gate holds it |
| Structured data | 88 | **94** | 111 article nodes now carry `datePublished`; every block parses |
| AI / answer engines | 90 | **95** | the 25 protocol explainers are now citable |
| Internal linking | 80 | **92** | re-measured: 0 orphans |
| Performance | 72 | 72 | unchanged; `datahallAI.html` is still 1,375 KB |
| E-E-A-T | 75 | **85** | dates present, author schema unchanged |

**Caveats that must travel with the score:** these are STATIC SOURCE measurements, not Lighthouse
runs and not Search Console data. Core Web Vitals are inferred from page weight, never measured. An
SEO score is a proxy for discoverability and never a ranking prediction.

---

## CLOSED

| # | finding | measured | closed in | kept closed by |
|---|---|---|---|---|
| A | Cache-token gate walked the repository root only; **79 of 90 sub-directory pages** served a shared asset under a stale token — `styles.min.css` on 76 (`?v=20260908-editorial`), `auth.js` on 43 | 266 pages scanned (was 179); 253 retokened | v3.10.17 | `tools/test-asset-cache-tokens.mjs` |
| B | The 25 `network/**` protocol explainers carried no `og:*`, no `twitter:card`, no JSON-LD | four signals 86–81% → **100%** | v3.10.17 | `tools/test-page-metadata.mjs` |
| C | Newsletter capture on 22 pages + `subscribeNewsletter()`; PRO/Premium tier copy on ~40 pages | 114 findings → 0 | v3.10.16 | `tools/test-no-commercial-surface.mjs` |
| D | `articles.html` drew article-15's thumbnail from `assets/og/index.webp`, which v3.9.0 repainted into the owner's portrait | repointed, real dimensions declared | v3.10.16 | — |
| E | Search Console indexing list four months stale — 102 URLs where the sitemap publishes 180 | 102 → 180 | v3.10.14 | `tools/test-generator-freshness.py` |
| 3 | 137 pages carried no `datePublished`; 76 of them declared an article type | **111 article nodes, 0 without a date** | v3.10.18 | `tools/test-page-metadata.mjs` |
| 4 | Multiple `<h1>` per page | artifact — **0** in the rendered outline | v3.10.18 | — |
| 5 | Pages with no `<h1>` | 5 → **0** (`chiller-plant`, `datahall`, `ict`, `water-system`, `EPMS_Telemetry`) | v3.10.18 | — |
| 6 | Orphan pages | artifact — **0** | v3.10.18 | — |
| 7 | Nothing asserted metadata completeness | RED at 193 missing signals across 34 pages on the pre-fix tree | v3.10.18 | `tools/test-page-metadata.mjs` |
| 1 | Two titles whose subject exceeds the ~60-char display cut | judged, no action: `geopolitics-1.html` is **one character** over, and `article-28.html`'s colon-led hook ("The Compression Horizon:", 24 chars) survives the cut intact. Shortening either would cost the question the article is about | v3.10.18 | — |

**On the dates (row 3).** `datePublished` is the commit that ADDED the page — when it was published
here, which git records exactly. That is a different claim from sitemap `<lastmod>`, which
`tools/build-sitemap.py:53` refuses precisely because a commit does not prove a CONTENT update.
First appearance is not an update; it is a publication. **`dateModified` is deliberately absent**:
nothing in this repository can prove one.

---

## WITHDRAWN

| # | recommendation | why |
|---|---|---|
| W1 | Add `<lastmod>` to sitemap.xml | `tools/build-sitemap.py:53` omits it **deliberately**: *"Git commits and checkout mtimes do not prove significant updates."* Recommended without reading the code. Google discards a `lastmod` it finds unreliable. Do not re-raise. |

---

## OPEN

| # | finding | measured | why it is still open |
|---|---|---|---|
| 2 | 96 descriptions truncate mid-clause at the ~160-char display cut | **70** are a single list with no sentence boundary inside the window — there is nothing to trim *to*; the other **26** could end at a boundary only by DISCARDING the text after it | Not fixable mechanically: both paths delete authored content. This is a cosmetic SERP issue, not a loss of meaning, and it stays open rather than being "fixed" by deletion. |
| 8 | `datahallAI.html` is heavy enough to fail Core Web Vitals on mobile | **Re-measured 2026-09-26.** 1,408 KB raw but **381 KB over the wire** (GitHub Pages gzips; index.html is 30 KB). Composition: **1,236 KB inline JS = 88%** of the document, 558 KB of that template-literal SVG strings; only 168 KB is markup outside `<script>`. Live on a 390px / 4x-CPU / Slow-4G profile: **LCP 6,672 ms · TBT 3,884 ms · longest task 1,438 ms · CLS 0.163**, against index.html's 1,884 / 922 / 541 / 0.003. Fetch is NOT the bottleneck — all 45 resources land by 2.5 s; the dominant profile frame is `(program)` at **2,981 ms**, i.e. parse and compile of the inline mass. | **Partly addressed in v3.11.6**: 635 KB of hidden-panel DOM construction no longer runs before first paint; controlled A/B on one harness gives LCP 3,952 → 3,148 ms, TBT 4,827 → 3,414 ms and longest task 1,596 → 895 ms, while the long-task count rises 24 → 28 (chunking, by design). Live it still measures LCP ~6.4 s / TBT ~5.0 s, so the row stays OPEN. Gated by `tools/test-dcai-deferred-panels.mjs`. **v3.11.7 goes further**: all eight hidden-panel containers are lazy and the idle drain is gone, so **1,011,614 characters** of markup are no longer built for a visitor who stays on the dashboard (LCP 3,696 → 2,984 ms, TBT 5,219 → 2,859 ms, long tasks 33 → 17; median of 5 on one harness). **The script-extraction plan this row carried is RETIRED**: a devtools.timeline trace puts `v8.compile` at **208 ms** against ParseHTML 2,237 ms, EvaluateScript 2,163 ms (FunctionCall 1,864 ms inside it) and Layout+UpdateLayoutTree 2,069 ms. The cost is running the builders and laying out their DOM, not compiling them, so extraction would have risked blinding 37 source-reading gates to chase 208 ms. **v3.11.8** closes the ticker half: six panel-local tickers were repainting hidden panels, **1,241 mutations per 20 s on the dash tab, now 0**, gated by D6/D7 of `tools/test-dcai-deferred-panels.mjs`. What remains is the eager work still needed at load — chiefly the fire inventory (~410 ms), which the page-wide sidebar counters derive from, so deferring it would show em dashes on the dashboard. **Re-traced live after both ships** (390px, 4x CPU, same harness as the original trace): FunctionCall 1,864 -> **428 ms** (-77%), ParseHTML 2,237 -> 1,064, UpdateLayoutTree 777 -> 306, Layout 1,292 -> 793, EvaluateScript 2,163 -> 1,431, Paint 260 -> 161. Roughly half the measured work is gone. This row stays OPEN because the page is still outside the CWV good band, not because a known fix is being skipped: what remains is dominated by the 1.4 MB document itself (ParseHTML and EvaluateScript), and the extraction that would address it was retired above on the measurement that `v8.compile` is only 160-208 ms of it, against a blast radius of 37 source-reading gates. Reopening that needs a new measurement, not a new opinion. |
| 9 | Commercial artefacts in a PUBLIC repository | `rz-ops-p7x3k9m.html` (root-gated, noindex, sitemap-absent: Revenue Analytics, Mayar Payments, Tier Manager); `Data/Freemium Scheme/` (56 tracked files incl. a Mayar payment webhook) | No reader can reach either. **Deleting the files would not remove them from git history**, so deletion alone does not achieve what it appears to. Owner's decision. |

| 10 | `datahallAI.html` is indexed and in the sitemap while shipping a login wall | **Measured 2026-09-27.** The page ships `<body class="locked">` in its STATIC html, and `body.locked` applies `filter:blur(4px); pointer-events:none` to `.wrap`/`.mn` behind a `#rootGate` overlay. So an anonymous visitor — including a rendering crawler — gets the full text in the HTML but a blurred, non-interactive page on screen. Meanwhile `robots` says `index, follow` and the URL is in `sitemap.xml`. **Of the 5 root-gated pages on the site, the other 4 are `noindex, nofollow` AND sitemap-absent**, so this one is the exception to the site's own convention. | **OWNER DECISION, not a defect to fix unilaterally** — changing the indexability of the flagship cockpit is a product call, and there is a real argument for keeping it discoverable. The three options: (a) leave as is and accept that search visitors meet a wall; (b) `noindex, nofollow` + drop from the sitemap, matching the other four gated pages; (c) un-gate a public summary section so a searcher gets something, and gate only the live cockpit. Nothing is changed pending that decision. |

---

## How to re-measure

```bash
node tools/test-page-metadata.mjs            # rows B, 3, 7
node tools/test-asset-cache-tokens.mjs       # row A
node tools/test-no-commercial-surface.mjs    # row C
python3 tools/test-generator-freshness.py    # row E
```

Rows 2 and 9 have no gate — which is why they are open rather than closed. Row 8 now has a PARTIAL one
(`node tools/test-dcai-deferred-panels.mjs`, v3.11.6): it holds the hidden panels off the critical path, but
nothing gates the page's total parse cost, and nothing can until the inline scripts are extracted.

Also verified at v3.10.18 and found clean, so no row was opened for them: **0 pages carry more than
one `<title>` in `<head>`**, and **0 titles are duplicated across pages**.
