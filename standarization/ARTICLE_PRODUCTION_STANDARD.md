# Article Production Standard — from research dossier to shipped page

> Written 2026-10-17 (v3.24.1), from article 29 ("How a Large Language Model Actually Works"), the
> first article produced end-to-end on this pipeline. Owner: *"Update standarization etc any doc
> standard when create article. Including drafting post for linkedin, x, mastodon etc. Ensure all
> article have that."* This document is the checklist; `standarization/CONTENT_LINKAGE_PLAYBOOK.md` §1
> remains the cross-reference table, and every command here is gated.

## 0. What an article is on this site

An article is a sourced engineering document, not a blog post: every number traces to a source list
with stable ids, every figure is drawn by the diagram engine from a definition, every calculator is a
pure engine with a test, and the page ships with its social drafts, glossary terms, journal entry,
OG card and crawl artefacts in the same commit. The register is the editorial register
(`css/rz-article-dark.css`, `html[data-rz-register="editorial"]`): graphite surfaces, one amber
accent, IBM Plex Sans headings, mono for numbers, no stat tiles, no gradient text, no hover lift
(`ANTI_VIBECODE_STANDARD.md` §A27–34, strict on the journal family).

## 1. Research dossier (before any prose)

Folder `Article/Article_<N>/`, produced by a research agent or by hand:

| File | Contents |
|---|---|
| `RESEARCH.md` | §0 the ten headline numbers; one section per topic, each "plain language → mechanism → numbers → data-center consequence"; arithmetic shown for every derived number; a "claims checked" section grading claims SUPPORTED / PARTLY / UNSUPPORTED; §Sources: a table `\| S1 \| title \| url \| date \| taken \|` — the `S` ids are stable and become `#src-N` on the page |
| `CALCULATORS.md` | one spec per calculator: inputs with defaults and valid ranges, exact formulas, constants with a source each, worked examples (they become test assertions) |
| `DIAGRAMS.md` | one spec per figure: title, desc, nodes (label + sub-label), edges (with labels), zones, the key number the figure must show with its source — never coordinates |
| `OUTLINE.md` | H2/H3 plan with ids, reader journey, key claims per section with [Sn], glossary terms to add, and the list of claims that could NOT be verified (they stay marked "unverified" or are cut) |

Rules: primary sources first (papers, vendor spec pages, official docs); 2025–2026 freshness; anything
unverifiable is marked UNVERIFIED in the dossier and either omitted or labelled in the prose; a number
that is not in `RESEARCH.md` does not appear on the page.

## 2. Prose fragments

`Article/Article_<N>/build/sec-01.html … sec-NN.html`, one per H2, written by agents in parallel (two
agents, 8 sections each, worked for 16 sections / 16k words). Each fragment:

- starts with `<h2 id="…">` and uses the ids from `OUTLINE.md`; H3s carry ids too;
- opens with an "in one breath" paragraph for a non-specialist, then goes to depth: formulas in
  `<code>` or `<pre class="formula">`, numbers, then the plant-room consequence;
- cites as `<a href="#src-N">[SN]</a>`; links glossary terms on first use
  (`glossary.html#term-<slug>`, slugs agreed in advance with the glossary step);
- tables as `<div class="table-wrap"><table class="ws-table">` with `<caption>` and `<td class="n">`
  for numbers; at most one `data-rz-chart` figure per section (config needs `source` + `basisTag`
  from the audit's list: published/standard/vendor/derived/modelled/illustrative/representative/measured);
- figure placeholders `<figure class="rz-figure" data-rz-figure="<article-slug>-dN"></figure>` where
  `DIAGRAMS.md` puts them; calculator placeholders `<div class="llm-calc" data-llm-calc="<key>"></div>`
  (or the article's own module key) where `CALCULATORS.md` puts them;
- at most one `<div class="ws-insight-box">` per section (the operator takeaway);
- no inline `style=`, no emoji, no stat-tile grids, no marketing adjectives, no "it's not X, it's Y",
  no `</script>` inside strings; `&mdash;`, `&nbsp;` before units, `&times;`.
- a `NOTES.md` per batch: word counts, [Sn] cited, placeholders placed, claims dropped as unverified.

## 3. Calculators

- `js/rz-<article>-calc.js`: ES5 IIFE, `window.RZ<Name>Calc = { constants, presets, <fn>(inputs)…,
  mount(root) }`. The functions are pure (object in, object out); every output carries
  `{value, unit, formula, inputs}`; every constant lives in `constants` with its `source`; `mount`
  renders from a declarative field list using the existing `calc-*` classes, recomputes on input,
  prints "—" for an invalid input, shows the formula on demand, offers Copy CSV through
  `js/rz-calc-utils.js` (load it before the module). Guard against double init.
- `tools/test-<article>-calc.mjs`: every worked example in `CALCULATORS.md` as an assertion
  (article 29: 375), invalid inputs, monotonicity, every constant has a source, formula strings match
  the spec. Wired into `tools/ship-gate.sh`.
- Every `data-explain` key the labels use gets an entry in `tools/explain-extra.json`
  (`{t, d, u}`), then `python3 tools/build-explain-db.py --apply` and `node tools/test-explain-db.mjs`.
- Fragments `build/calc-<key>.html`: `<section class="llm-calc-block">` with an `<h3>`, one plain
  paragraph stating what is computed and the formula, the mount point, and a `<p class="calc-basis">`
  naming the constants' sources. The assembler splices them over the prose placeholders.

## 4. Figures

Definitions appended to `tools/build-article-diagrams.mjs` (`{ id, page, caption, because, build() }`,
`D.create` + `ctx.node/ports/edge/zone`; measured text, no coordinates, no hex). `caption` carries the
key number and its [Sn]; `because` says what the drawing adds that the prose cannot. Gates:
`node tools/build-article-diagrams.mjs` then `--check`, `node tools/test-article-diagrams-engine.mjs`
(zero engine warnings), `node tools/test-rz-diagram-engine.mjs`. Render each figure to PNG and look at
it before accepting (overlaps, arrows through boxes, legend off page are layout failures).

## 5. Assembly (the page)

An assembler script (article 29: `mk-article-29.py` in the session scratchpad; promote the pattern to
`tools/` when the third article uses it) builds `article-N.html` from the previous article's
register-clean shell plus the fragments:

1. **Head** from the previous article, retargeted: title (subject ≤ 60 chars before the colon),
   `description` ≤ 160 chars and a complete sentence (`node tools/test-meta-description-fit.mjs`),
   keywords, canonical/OG/twitter URLs and image (`assets/og/article-N.webp`), `article:published_time`
   = the real date, `article:section`, `article:tag` ×4–5, three JSON-LD blocks regenerated
   (TechnicalArticle with `wordCount`, BreadcrumbList, FAQPage whose Q/As are IDENTICAL to the visible FAQ).
2. **Hero**: `article-category`, `article-title` with a `.highlight` second clause, subtitle,
   `article-meta` (author, date, "N min read" = words ÷ 230), the cover `<figure class="article-cover">`
   (`assets/article-N-hero.webp`, 1600×900, `fetchpriority="high"`, a figcaption), then the evidence
   block: `<div data-rz-fact-list class="col-evidence-grid">` with 5–6 `col-evidence-card`s (value ·
   label · sub-text with [Sn]) — the register renders it as a fact list, never tiles.
3. **Key numbers** (SEO/GEO A1): `<section id="key-numbers">` with 6–8 `<li>` "formula/figure — what
   it means [Sn]" and a 3-sentence standalone answer paragraph.
4. **Series nav** block (`29 of 29`, Prev link, Next disabled) — `tools/sync-article-series.py --apply`
   then rewrites every sibling's count and the previous article's tail; `python3 tools/test-article-series.py`.
5. **Body**: the fragments in order, calculator fragments spliced in, cross-links added
   (sibling articles by href).
6. **FAQ** (SEO/GEO A2): `<h2 id="faq">` + 5–6 `ws-insight-box` Q/As, visible, same text as the JSON-LD.
7. **Sources**: `<h2 id="sources">` + `<ul class="ws-sources">` with `<li id="src-N">[SN] title — host (date). Taken: …</li>`
   generated from the dossier's table; every `#src-N` the prose cites must exist.
8. **Article nav** (`.article-nav`: Previous · All Articles · `<span>Latest Article</span>` — the series
   tool turns the span into the Next link when the next article ships), author bio, related
   (4 siblings), the previous article's script tail plus `js/rz-calc-utils.js` and the calculator module.
9. Inline `<style>` = the previous article's (already swept) plus a small block for the new classes,
   register tokens only (`var(--rz-art-*)`); the sweep (`tools/sweep-journal-register.py --check`) must be a no-op on it.

## 6. Siblings and crawl artefacts (same commit)

| Step | Command |
|---|---|
| Journal map | add `article-N` to `TOPIC_OF` (one topic) and, if not Engineering Journal, `SERIES_OF` in `tools/build-journal.py`; raise the `PAGES` range; `python3 tools/build-journal.py --apply` (hub + landings grids, data/journal.json) |
| Glossary | ≥ 5 terms (article 29: 57) as `<div class="term" id="term-<slug>">`, each with a backlink to the article section; `python3 tools/build-explain-db.py --apply`; `node tools/test-explain-db.mjs` |
| Search index | append the entry to `search-index.json` (`id` = next integer, title, url, description, category, keywords, image, date, readingTime) |
| Series nav | `python3 tools/sync-article-series.py --apply`; `python3 tools/test-article-series.py` |
| OG card | never a hand-made card: `python3 tools/build-og-images.py --apply` renders `assets/og/article-N.webp` from the page's title and its first content image; `python3 tools/test-og-card-freshness.py` |
| Stage first | `git add article-N.html …` — the crawler inventory only sees TRACKED files, so sitemap/llms skip an unstaged page |
| Crawl artefacts | in this order: `build-sitemap.py --apply`, `build-llms-txt.py --apply`, `build-llms-full.py --apply`, `build-search-sections.py --apply`, `build-indexing-list.py --apply`; then `python3 tools/test-generator-freshness.py`, `python3 tools/crawler_audit.py --strict`, `node tools/test-page-metadata.mjs` |
| Tokens | `node tools/test-asset-cache-tokens.mjs --fix <every asset you added or changed>` |
| Social drafts | §7 |
| Version | `js/rz-version.js` + CHANGELOG (quote the owner) + `sync-sw-version.py` + `build-changelog-html.py --apply` |

## 7. Social drafts (mandatory, gated)

Folder `Article/Post Draft/Article <N>/` (FF: `Future Forward <N> - <short title>/`, geopolitics:
`Geopolitics <N> - <short title>/`) with five files, `A<N>-x-post-1.md`, `A<N>-linkedin.md`,
`A<N>-mastodon-1.md`, `A<N>-medium.md`, `A<N>-facebook.md` (FF uses `FF<N>-`, geopolitics `G<N>-`).
Each draft is written from the page's own numbers; no first-person experience the article does not
state. Every resistancezero.com link carries `?utm_source=<platform>&utm_medium=social&utm_campaign=<slug>`
(Medium: `utm_medium=syndication`; slug `a<N>` / `ff<N>` / `g<N>`); the Medium draft states
"Publish via medium.com/p/import (sets the canonical)". Gate: `python3 tools/audit-post-drafts.py --strict`
(strict on the journal family, monitored elsewhere); `--fix-utm` adds the parameters to older drafts.
Lengths: LinkedIn 150–220 words; X a 6–9-post thread; Mastodon ≤ 500 chars; Medium a 250–350-word
excerpt ending with the canonical link; Facebook 90–150 words.

## 8. Gates before the push

Static: `test-<article>-calc.mjs`, `build-explain-db.py --check`, `audit-article-charts.mjs --strict`,
`build-article-diagrams.mjs --check`, `test-article-diagrams-engine.mjs`, `test-journal.mjs --static`,
`audit-vibecode.mjs --strict`, `audit-css-structure.mjs --strict`, `audit-script-tags.py --strict`,
`audit-js-syntax.py --strict`, `audit-mobile-responsive.py --strict`, `test-inline-prose-styles.py`,
`test-meta-description-fit.mjs`, `test-page-metadata.mjs`, `crawler_audit.py --strict`,
`test-generator-freshness.py`, `test-asset-cache-tokens.mjs`, `test-og-card-freshness.py`,
`audit-post-drafts.py --strict`, `test-article-series.py`, `sweep-journal-register.py --check`.
Browser (one at a time, under `flock /tmp/claude-1000/kereta-browser.lock`): `test-journal.mjs`,
`audit-dark-coverage.mjs --strict`, `audit-legibility.mjs --strict`, `audit-responsive-layout.mjs --strict`,
`audit-a11y.mjs --strict`, `audit-interactions.mjs`, `test-flatten-ratchet.mjs --strict`, and the
article's own screenshots at 390 and 1440 in both themes, looked at, plus one calculator exercised.

## 9. After the push

Live check of `rz-version.js`, the article URL (figures present, calculators mount, no console
errors), `python3 tools/indexnow-submit.py --since HEAD~1`, screenshots to the owner, memory note.
