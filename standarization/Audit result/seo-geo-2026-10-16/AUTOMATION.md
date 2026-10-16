# Automation specs — SEO/GEO recurring work at zero effort
House conventions (from tools/): Python 3 in `tools/`, `--check` (no writes, exit 1 on drift), `--apply` (write), `--dry-run`,
deterministic output, fail closed, exemption lists that expire (as `test-meta-description-fit.mjs` M4). Every gate must be **wired** into the
release checklist that already runs `node tools/test-page-metadata.mjs` (CONTENT_LINKAGE_PLAYBOOK §3). A gate that exists but is not wired
is not a gate. Each gate must be proven RED on today's tree before it is called closed.

## 1. `tools/test-answer-blocks.py` (F22, A1)
- Scope: `article-*.html`, `geopolitics-*.html`, `future-forward-*.html`, indexable incident briefs.
- Rules:
  - K1: `<section id="key-numbers">` within the first 2 `<h2>` after the H1.
  - K2: 3–6 `<li>`, each containing a digit and an `<a href="#ref-…">` or external `href`.
  - K3: an answer paragraph of 40–90 words directly after the list.
  - K4: every `#ref-n` target exists.
- Modes: `--warn` (default for 30 days), `--strict`; exemptions in `tools/answer-blocks-exempt.json` with `expires` dates.
- Expected RED today: ≥17 articles.

## 2. `tools/render-visible-faq.py` + `tools/test-structured-visible.py` (F11, A2)
- Renderer: reads each page's FAQPage/HowTo JSON-LD and writes/updates a visible block between `<!-- rz:faq:start -->`…`<!-- rz:faq:end -->` before the References section. Each question becomes `<h3>` and each answer `<p>`, HTML-escaped, with no `</script>` inside strings (see the over-escape trap). Idempotent; `--check` diffs.
- Gate:
  - S1: every `Question.name` and `acceptedAnswer.text` (whitespace-normalised) appears in text outside `<script>`/`<template>`.
  - S2: the same for `HowToStep.text`.
  - S3: `DefinedTerm.name` exists on the page.
  - Expected RED today: 100 of 101 questions.
- Also amend `SEO_OPTIMIZATION_STANDARD.md` §FAQ Placement: "JSON-LD in head AND identical visible section".

## 3. `tools/apply-entity-graph.py` + `tools/test-entity-graph.py` (F13, F18, E3, A3, A4)
- Single source: `data/author-entity.json` (name, jobTitle, credentials, sameAs[], image, url).
- Apply: on index/about, emit the full `Person` (`@id …/#person`) + `Organization` (`@id …/#org`). Everywhere else, `author`/`creator` = `{"@id":"…/#person"}`, `publisher` = `{"@id":"…/#org"}`. Byline wrapped in `<a href="/about.html" rel="author">`.
- Gate:
  - P1: 0 anonymous Person nodes outside index/about.
  - P2: one jobTitle value site-wide.
  - P3: sameAs equals the JSON exactly.
  - P4: a byline link on every article.
  - R: `dateModified` present ⇒ equals the newest `<li><time>` in `#revisions`; otherwise absent.

## 4. `tools/build-worked-examples.mjs` (C1)
- Imports each calculator's engine module (same modules the pages load) with its declared defaults, computes the headline outputs, and writes one sentence between `<!-- rz:worked-example -->` markers on the calculator page and its `manual/` page.
- `--check` recomputes and fails on a numeric drift. This is the "binding gate" pattern: a perturbed engine must change the sentence.

## 5. `tools/ai-visibility-log.py` (F15, §8)
- `--import-bing <csv>` (AI Performance: daily / pages / grounding queries), `--import-gsc <csv>`, `--import-ga4 <csv>` (AI channel sessions by landing page) → `standarization/Audit result/ai-visibility/YYYY-MM.json`.
- `--report` prints month-over-month: cited pages, new grounding queries not answered by any page (a content-gap list for REPORT §7), AI sessions.
- `--panel prompts.yaml`: 20 fixed questions (e.g. "What caused the OVHcloud SBG2 fire?", "How much energy per LLM token?", "PFAS vapour loss in two-phase immersion cooling", "PJM 2027 capacity shortfall"). Optional `--run` only through official APIs that return citations, with keys from env, never hardcoded. Records whether `resistancezero.com` is cited.

## 6. `tools/build-post-drafts.py` + `audit-post-drafts.py --strict` extension (F16, F24)
- Generates or refreshes per-page drafts from title, description, Key numbers and URL. Every link is `?utm_source=<platform>&utm_medium=social&utm_campaign=<slug>`. Medium drafts start with "Publish via medium.com/p/import (sets canonical)".
- Claim trace: any first-person sentence ("I …", "my …", "we …") in a draft must fuzzy-match a sentence in the source article, or be listed in `claims-approved.json` by the owner.
- Audit rules:
  - D1: UTM on every resistancezero.com link.
  - D2: Medium import line present.
  - D3: claim trace passes.

## 7. `.github/workflows/indexnow.yml` (F23)
- Trigger: `push` to `main` (Pages source). Steps: checkout with `fetch-depth: 2`, wait for the Pages build (poll the `pages/builds/latest` API until `built`, and fail if it errored, since a green push is not a deploy), then `python3 tools/indexnow-submit.py --since ${{ github.event.before }}`.
- The key is the public `/<key>.txt`, so no secret is needed.
- Also verify the live `rz-version` equals the commit before submitting.

## 8. `build-llms-full.py --split` (F20)
- Writes `llms-full/<section>.txt` (articles, manuals, calculators, network, prd), each ≤400 KB. `llms.txt` links each file. `test-generator-freshness.py` covers them. Keep the existing metadata-only rules for gated pages.

## 9. `audit-seo.py` title rule (F21)
- Replace `LONG (want 30-60)` with: the subject (text before ` | ` / ` — `) must fit in 60 chars. Keep the `--strict` semantics.

## 10. `tools/build-incident-briefs.py` + `tools/test-incident-briefs.py` (F12, after the owner decision)
- Builds the public brief block + `Article`/`Event` JSON-LD from each dossier's structured fields, and the hub `ItemList` + table + `data/incidents.csv`.
- Gate:
  - B1: ≥270 words of brief.
  - B2: a timeline table with ≥3 rows, each with a source.
  - B3: ≥1 primary source (the operator post-mortem).
  - B4: `index, follow`, and the page is in sitemap and llms.txt via `crawler_inventory.py`.
  - B5: the CSV row count equals the dossier count.

## 11. `tools/build-glossary-schema.py` (F19)
- DOM → `DefinedTermSet` of all `#term-*` (`@id`, `name`, description = first sentence). `--check` fails when terms and schema diverge.
