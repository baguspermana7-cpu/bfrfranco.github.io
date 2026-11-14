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
| G2 | `glossary.html` carried 26 links with href and anchor text swapped (`<a href="Workforce Strategies">article-27.html#section-4</a>`), all 404 — introduced `0120a8e48`; no generator writes the page (`build-explain-db.py` only reads it) | 26 → 0 | 2026-11-14 | `python3 tools/test-glossary.py` rule G5, RED at 26 on the old file |
| G4 | hreflang one-way: `/id/*` declared `en`, but `index`, `articles`, `glossary` listed no `id`; index pointed at `/index.html` while canonical is `/` | 7 findings → 0 | 2026-11-14 | `python3 tools/test-hreflang-reciprocity.py`, RED at 7 |
| G6 | Author Person node had no `@id` and 4 different `jobTitle`s (`articles.html`/`tools.html` "Independent Researcher", `article-9` "Data Center Operations Lead", `ltc-system-modelling-lab` "Engineering Operations Leader") | 4 titles → 1; `@id` `https://resistancezero.com/#person` on index, tools, articles | 2026-11-14 | `python3 tools/test-hreflang-reciprocity.py` rule P1, RED at 4 findings (row 13 stays open for the rest of the site) |
| S8 | `rz-tracker.js` called `ipapi.co` on every page view with no consent, undisclosed in `privacy.html` | 1 request with no consent / declined → 0 | 2026-11-14 | `node tools/test-tracker-consent.mjs`, RED at 2 of 4 on the old tracker |
| S13 | `test-no-client-secrets.mjs` skipped every text file over 5 MB (`llms-full.txt`, 5.8 MB) | now stream-scanned; only binaries are skipped | 2026-11-14 | `node tools/test-no-client-secrets.mjs --self-test` / `--law X1.2a` |

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

| 10 | `datahallAI.html` was indexed and in the sitemap while shipping a login wall | A blurred cockpit behind a fixed scrim and a **32-word** "access required" card: search traffic and rendering crawlers met a wall, and the indexed text described a cockpit no visitor could read. Of 5 root-gated pages the other 4 are `noindex` and sitemap-absent; this one is indexed on purpose. | **CLOSED v3.11.9** — option (c), delegated by the owner ("Yg terbaik walau ultraeffort"): the cockpit is hidden rather than blurred and the gate is now a public brief with 270+ words and 8 headline figures rendered from the parameter registry under the dashboard's own basis ids, each click-through to its basis record. Fails closed on a missing registry AND on a non-current engine authority. Gate: `node tools/test-dcai-public-brief.mjs` (P1-P9), proven RED against v3.11.8 with 8 findings. |

| 2 | 96 published descriptions truncated at the ~160-char display cut | 45 of them had no clause boundary anywhere inside the window, so a mechanical trim would have cut mid-phrase. | **CLOSED v3.11.10** — the row had recorded this as unfixable because trimming and leaving both destroy authored text. The third move: REWRITE each description to finish inside the cut. Most of the overflow was a redundant lead-in, not substance, so compression lost no information. All 96 rewritten by hand, longest 157 chars. Gate: `node tools/test-meta-description-fit.mjs` (M1-M4), proven RED at exactly 96 and now PASSING with an EMPTY exemption list. Three pages were briefly deferred by name while a parallel session had them open; rule M4 makes such a deferral expire by itself, and it did. **Reopened and re-closed v3.34.0:** the gate dropped every sitemap URL ending in `/`, so five pages served from a directory index (root, `id/`, `cx-handbook/`, `manual/`, `prd/`) were never measured; `manual/index.html` ran 206 chars live. Directory URLs now map to `index.html` (RED at 2, then GREEN); the manual hub was rewritten to 149, and `id/index.html` (191) is deferred by name because two other agent worktrees hold uncommitted edits to it. |

## OPEN

| # | finding | measured | why it is still open |
|---|---|---|---|
| 8 | `datahallAI.html` is heavy enough to fail Core Web Vitals on mobile | **Re-measured 2026-09-26.** 1,408 KB raw but **381 KB over the wire** (GitHub Pages gzips; index.html is 30 KB). Composition: **1,236 KB inline JS = 88%** of the document, 558 KB of that template-literal SVG strings; only 168 KB is markup outside `<script>`. Live on a 390px / 4x-CPU / Slow-4G profile: **LCP 6,672 ms · TBT 3,884 ms · longest task 1,438 ms · CLS 0.163**, against index.html's 1,884 / 922 / 541 / 0.003. Fetch is NOT the bottleneck — all 45 resources land by 2.5 s; the dominant profile frame is `(program)` at **2,981 ms**, i.e. parse and compile of the inline mass. | **Partly addressed in v3.11.6**: 635 KB of hidden-panel DOM construction no longer runs before first paint; controlled A/B on one harness gives LCP 3,952 → 3,148 ms, TBT 4,827 → 3,414 ms and longest task 1,596 → 895 ms, while the long-task count rises 24 → 28 (chunking, by design). Live it still measures LCP ~6.4 s / TBT ~5.0 s, so the row stays OPEN. Gated by `tools/test-dcai-deferred-panels.mjs`. **v3.11.7 goes further**: all eight hidden-panel containers are lazy and the idle drain is gone, so **1,011,614 characters** of markup are no longer built for a visitor who stays on the dashboard (LCP 3,696 → 2,984 ms, TBT 5,219 → 2,859 ms, long tasks 33 → 17; median of 5 on one harness). **The script-extraction plan this row carried is RETIRED**: a devtools.timeline trace puts `v8.compile` at **208 ms** against ParseHTML 2,237 ms, EvaluateScript 2,163 ms (FunctionCall 1,864 ms inside it) and Layout+UpdateLayoutTree 2,069 ms. The cost is running the builders and laying out their DOM, not compiling them, so extraction would have risked blinding 37 source-reading gates to chase 208 ms. **v3.11.8** closes the ticker half: six panel-local tickers were repainting hidden panels, **1,241 mutations per 20 s on the dash tab, now 0**, gated by D6/D7 of `tools/test-dcai-deferred-panels.mjs`. What remains is the eager work still needed at load — chiefly the fire inventory (~410 ms), which the page-wide sidebar counters derive from, so deferring it would show em dashes on the dashboard. **Re-traced live after both ships** (390px, 4x CPU, same harness as the original trace): FunctionCall 1,864 -> **428 ms** (-77%), ParseHTML 2,237 -> 1,064, UpdateLayoutTree 777 -> 306, Layout 1,292 -> 793, EvaluateScript 2,163 -> 1,431, Paint 260 -> 161. Roughly half the measured work is gone. This row stays OPEN because the page is still outside the CWV good band, not because a known fix is being skipped: what remains is dominated by the 1.4 MB document itself (ParseHTML and EvaluateScript), and the extraction that would address it was retired above on the measurement that `v8.compile` is only 160-208 ms of it, against a blast radius of 37 source-reading gates. Reopening that needs a new measurement, not a new opinion. |
| 9 | Commercial artefacts in a PUBLIC repository | `Data/Freemium Scheme/` (56 files incl. a Mayar webhook); `rz-ops-p7x3k9m.html` admin console | **RESOLVED 2026-10-09 (v3.11.14), owner decision.** `Data/Freemium Scheme/` moved to the private `baguspermana7-cpu/rz-private-ops` repo and deleted from this public tree (56 files); doc references repoint there. The rz-ops console STAYS (root-gated, noindex, no real secrets — keys read `process.env`, the Supabase token is the public anon key). Separately the owner asked that one operator's brand name (kept as an index employer card) not appear on any other surface: removed from the console data, the DC-intel seed, both stylesheets + min twins, the changelog self-reference and the legal-compliance doc. **History note:** deleting from the working tree does not rewrite git history; those files remain in past commits. Clearing history needs filter-repo + force-push, destructive, left to the owner. |

| 11 | FAQPage JSON-LD on every article has no visible counterpart | 28/28 articles, **101** questions; first-question text found **0×** outside `<script>` (article-1, -23, -26); fragment match 1/101 visible (article-21). Root cause: `SEO_OPTIMIZATION_STANDARD.md` §FAQ Placement puts it in `<head>` only; `tools/inject-schema-faq-howto.py` writes it there. Google: structured data must match visible text; FAQ rich results retired May 2026 (docs removed 2026-06-12) | **Re-verified 2026-11-14 (audit G3):** still open. No visible-FAQ renderer and no gate. Close with `tools/render-visible-faq.py --apply` + `tools/test-structured-visible.py` (RED at 100 on today's tree) and amend the standard |
| 12 | Incident library invisible to every engine | `dc-incidents.html` + **43** `incident-*.html` = `noindex, nofollow` since `d291ee100` (2026-07-31); hub has 0 JSON-LD; 0 in sitemap/llms.txt. Live `incident-ovhcloud-sbg2-fire-2021.html` = 200, 246,711 B (body served to anyone) | **Owner decision** (public brief + gated dossier, as row 10 did for datahallAI; all public; or status quo). Gate after decision: `tools/test-incident-briefs.py` |
| 13 | Author is not one entity | 0 pages with a Person `@id`; jobTitle = "Engineering Operations Manager" / "Data Center Operations Lead" (article-9) / "Independent Researcher" (articles.html) / 3-title array (index) / none (article-11, -12); article sameAs = [LinkedIn, resistancezero.com], index = [LinkedIn, GitHub]; byline plain text, 0 author links, no `rel="author"` | **Partly closed 2026-11-14 (audit G6):** `index.html`, `tools.html`, `articles.html` Person nodes now carry `@id` `https://resistancezero.com/#person`, and every `jobTitle` on the site reads "Engineering Operations Manager" (`articles.html`/`tools.html` said "Independent Researcher", `article-9`/`ltc-system-modelling-lab` other titles). The other ~80 pages still carry no `@id`; sameAs, bylines and ORCID remain. Needs the owner's identity line (E1) and ORCID; then `tools/apply-entity-graph.py --apply` + `tools/test-entity-graph.py` |
| 14 | HTTP not redirected to HTTPS | `curl -I http://resistancezero.com/` and `/article-28.html` → `HTTP/1.1 200 OK` | **Re-verified 2026-11-14 (audit S-HTTPS):** no HSTS either; still the owner toggle. Owner toggle: Settings → Pages → Enforce HTTPS. Verify: first line 301 |
| 15 | No AI-visibility measurement | No runbook mentions the GSC Generative AI report, the Bing WMT AI Performance report or a GA4 AI channel; Bing verification files exist | Owner account actions; then monthly import via `tools/ai-visibility-log.py` |
| 16 | Syndication unattributable; Medium copies risk duplicates | `Article/Post Draft/`: 0/230 `.md` contain `utm_`; 15/52 `*medium*.md` mention import/canonical | Extend `tools/audit-post-drafts.py --strict` (UTM + Medium import rules) and rewrite the drafts with `tools/build-post-drafts.py --apply` |
| 17 | Brand term collides with an engineering parameter; author has no web footprint | `"resistancezero"` → Elipse E3 `ResistanceZero` docs; `"Bagus Dwi Permana" data center` → nothing (single US search tool, inferred) | No gate possible; Organization `@id` + consistent naming + distribution plan; re-probe monthly |
| 18 | Ledger row 3's `dateModified` rule contradicts the tree | Row 3 says it is "deliberately absent"; **23/28** articles carry it, 17 equal to `datePublished`; article-26 has 58 commit dates incl. a substantive correction, nothing visible says so | Decide: visible `#revisions` section drives `dateModified`; gate rule R in `test-entity-graph.py` |
| 19 | Glossary schema covers 20 of 360 terms | `DefinedTermSet` = 20 `DefinedTerm` nodes; 360 `id="term-…"` anchors | **Re-measured 2026-11-14 (audit G7):** 20 `DefinedTerm` nodes against **449** `id="term-…"` anchors. `tools/build-glossary-schema.py --apply/--check` |
| 20 | `llms-full.txt` exceeds its stated "one-shot loading" purpose | live 2,873,225 B (~700k tokens) | **Re-measured 2026-11-14 (audit G8):** `llms-full.txt` is now **5,822,020 B** (was 2,873,225). `build-llms-full.py --split` (per-section files ≤400 KB) + freshness gate |
| 21 | `audit-seo.py` still applies the withdrawn 30–60-char title rule | 50 of 52 warnings are `title: LONG (… want 30-60)`, the artifact this ledger re-measured to 2 | Replace with the "subject survives ~60-char cut" rule |
| 22 | Most articles have no answer-first summary | phrase scan (key takeaways / TL;DR / bottom line / key numbers / at a glance): 11/28; article-28's hero stat strip is the model | Content work; `tools/test-answer-blocks.py` (warn → strict with expiring exemptions, as M4) |
| 23 | IndexNow is manual | `.github/workflows/` has only `supabase-keepalive.yml`; `tools/indexnow-submit.py` last changed 2026-05-09 | Add `.github/workflows/indexnow.yml` (AUTOMATION §7) |
| 24 | Post drafts escalate first-person experience claims beyond the article | `A26-linkedin.md:1` "I've opened hundreds of two-phase cooling systems"; `A26-facebook.md:5`, `A26-tiktok-script.md:52` "hundreds of times"; `article-26.html:1072` "The first time I opened a Novec 7000 two-phase system" | Owner must confirm or correct; claim-trace rule in `build-post-drafts.py --check` |


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
