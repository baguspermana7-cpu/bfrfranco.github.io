# DC Incidents Standard (Root-Gated Post-Incident Case Library)

> Single source: `data/incidents/<slug>.json` (one dossier per incident, provenance-mandatory) → `tools/build-incidents.py --apply` renders `dc-incidents.html` (ranked hub) + `incident-<slug>.html` (one per incident, **root-level, not a subfolder** — avoids `../` path + gate-skip issues). NEVER hand-edit the generated HTML; edit the JSON or the generator and rebuild.

## Core principle: every fact is traced to a public post-incident report

The library is engineering education, not journalism. Each dossier reconstructs a major data-center / cloud incident with a full **SOE** (sequence of events) → **root cause** → **contributing factors** → **COE** (correction of errors) → **lessons learnt** → **improvements** → **technical deep-dive**, and **every material claim carries provenance**. Summaries are original and substantially shorter than their sources; short attributed excerpts are provenance only, never a reproduction of the source. No fabricated cause or number — where an authoritative body published no root cause, the dossier says so plainly rather than invent one.

## Ranking is a transparent composite, not an opinion

`_score` = magnitude composite, each sub-score 0–10 in `magnitude{}`:

`blastRadius 0.35 · users 0.25 · financial 0.20 · duration 0.20`

The hub ranks strictly by `_score` and shows the weighting in the disclaimer. Sub-scores are sourced in `magnitude.note`. A rival "importance" number is never computed elsewhere.

## Dossier schema (`data/incidents/<slug>.json`)

`slug · title · operator · dcName · location{city,country,az,lat?,lng?} · date · durationMin · category[] · severity{} · brief · magnitude{usersScore,financialScore,durationScore,blastRadiusScore,note} · sequenceOfEvents[{t,phase,event,source}] · metrics[{label,value,source}] · rootCause · contributingFactors[] · coe[{action,owner,status}] · lessonsLearnt[] · improvements[] · comprehensiveAnalysis[{heading,body}] · technicalDeepDive · references[{title,url,type,quote,accessed}] · sourcing{officialPostmortem} · lastUpdated`

- **category** vocabulary (drives filters + domain colour): facility = `power · cooling · fire · flood`; network/logical = `network · software · human`; plus `supply` (supply-chain). `_domain()` maps category → facility|logical.
- **SOE phases**: `TRIGGER · DETECTION · MITIGATION · IMPACT · CASCADE · RECOVERY · RESTORED` (rendered as thin phase chips + a phased timeline SVG).

## Provenance gate — `tools/test-incidents-corpus.mjs`

- `references[] >= 2`; every ref has `url + type + title`; **non-official refs must carry a `quote`**.
- Official-ref types (the only ones that satisfy an official claim): **`{official-postmortem, regulatory, vendor-status}`**. `official`/`court` from research must be normalised into these on ingest (`_TYPE_MAP` in `_ingest_rca.py`).
- `sourcing.officialPostmortem === true` requires **≥1 official-type ref** actually present — the flag can never outrun the evidence.
- Non-empty SOE / COE / lessons / improvements; magnitude sub-scores in 0–10. `_`-prefixed files (master list, cluster, chunks) are skipped.

## Gating — root-only module

- `js/rz-feature-flags.js`: `'dc-incidents'` `page-access` `{free:false,demo:false,pro:false,root:true}`.
- Each page: inline `enforceTierFeatureAccess('dc-incidents')` + `<body class="locked">` + `.root-gate` overlay + `#rootLoginBtn` (the audit-page-gates idiom; gate `tools/audit-page-gates.mjs`). `.locked` **blurs** `.wrap` (keeps layout size — Leaflet still initialises).
- `auth.js`: `ROOT_ONLY_PATHS += '/dc-incidents.html','/incident-'`.
- **Excluded from public sitemap / llms.txt / search index**; `<meta robots="noindex,nofollow">`; **no IndexNow ping** on gated ships. The library must not leak into SEO.

## Visualizations (inline SVG + one real map, theme-aware, no runtime charting lib)

Per incident: **failure-cascade block diagram** · **magnitude radar** (4 sub-scores) · **phased SOE timeline**. Hub: **magnitude bars** · **category bars** · **risk map** (blast × duration quadrant) · **semantic map** (vector-index 2D projection). All labelled, scaled, legended (no bare floating dots): operator abbreviations (`op_abbrev()`), 0–10 axis ticks, quadrant framing, deterministic jitter + per-side label de-collision, domain colour legend, clickable dots → dossier.

**Geographic map** ("Where these happened"): real **Leaflet 1.9.4 + CARTO dark tiles** (same stack as `dc-market-tracker.html`), lazy-loaded via `page_shell(head_extra=LEAFLET_HEAD)` (hub only — incident pages stay lib-free). Markers plotted from `INCIDENT_COORDS` (slug→[lat,lng]; global logical failures anchored to the operator's origin region) with md5 jitter for co-located sites; domain-coloured, magnitude radius, dark popups linking to each dossier; `invalidateSize()` on reveal via IntersectionObserver (renders correctly behind the gate blur).

## Tooltips — RZExplain glossary

`linkify()` wraps the first occurrence of each known term in prose as a `data-explain` span (page-level `_used` dedupe); `js/rz-explain.js` `wire()` adds `.rzx-trigger` (subtle dotted underline, **not** neon). DC-outage glossary lives in `tools/explain-extra-batch-incidents.json` (glob `explain-extra-batch*.json` → `tools/build-explain-db.py`; gate `tools/test-explain-db.mjs` forbids cross-key duplicate aliases). GOTCHA: never put `data-explain-scan` on `<main>` — it caches an empty alias index before the DB loads; the inline init polls for `window.RZ_EXPLAIN_DB` instead.

## Vector-index preservation (research is never lost)

`tools/build-incidents-vectors.py` chunks every dossier by section → ollama `nomic-embed-text` (768-dim) → `data/incidents/incidents-chunks.jsonl` (**durable, git-committed** — the index rebuilds from this even with no embeddings) + `incidents-vectors.npz` (gitignored, regenerable, incremental by content-hash) + `_cluster.json` (per-incident mean embedding → 2D PCA/SVD, feeds the semantic map). Lock-free semantic search: `python3 tools/incidents-search.py "<query>"`.

## Research pipeline — multi-agent official-RCA program

Deep RCA is produced by a **Workflow** (Opus agents, `WebSearch`/`WebFetch`), reusable script args = `seeds[{slug,title,operator,dcName,date,location,hint}]`. Per incident, a 3-stage pipeline:

1. **CRAWL** — hunt the authoritative post-incident document(s) (vendor PIR, regulator/government, fire/police authority, court filing) and extract verbatim RCA fragments + short quotes.
2. **ASSEMBLE** — reconstruct a detailed causal narrative (trigger → mechanism → why safeguards failed → escalation → recovery) as a 5-whys chain, every claim mapped to a quote.
3. **VERIFY** — adversarial fact-check against the quotes; strike any unsupported claim; emit the final source-grounded fields; set `officialPostmortem` **only** on a genuine official/regulatory/court/vendor document.

Ingest via `tools/_ingest_rca.py <results.json> --apply` (reads the workflow `result` array — the task output file is a DICT with a `result` key, not a bare array): replaces `rootCause`/`technicalDeepDive`/`contributingFactors` when longer, merges `approvedSources` (dedup-by-url, `_TYPE_MAP` normalisation, upgrades a duplicate ref's type on an official match), and flips `officialPostmortem` only when an accepted-type ref backs it. `--sources-only` mode keeps an existing deep narrative and merely merges sources + appends an attributed **"Official confirmation"** paragraph (use when the finalize agent lacks the current narrative). Where a primary official document is genuinely unretrievable or the cause is disputed/unpublished, the dossier stays honestly `false` (e.g. Red Sea cable cuts, BA-2017 — UK Find Case Law confirms no judgment exists).

## Editorial palette — no neon, no AI-design-slop

Forest-green + warm-ivory, theme-aware via CSS vars. Dark-theme accents are **desaturated** (green `#6aa588` sage, gold `#c9a559`, red `#cf9384`) — never bright mint/neon. SOE timestamps use `--muted` (quiet grey mono), not the accent. Display serif Fraunces + IBM Plex Sans body + JetBrains Mono labels. Thin-line, evidence-class instrumentation character; no gradients / glassmorphism / glow.

## Guardrails (baked in)

Short attributed provenance quotes only (copyright — the assembled narrative is original + substantially shorter). No personal-data compilation on private individuals. LinkedIn / X public-only (auth-walled content is not bypassed). No fabricated RCA / numbers; screening/uncertainty is chipped and disclosed.

## Gates (all must pass before ship)

`tools/test-incidents-corpus.mjs` (provenance + structure) · `tools/audit-page-gates.mjs` (root-gate UI) · `tools/audit-script-tags.py` (no unescaped `</script>`) · `tools/audit-version-stamp.py` · dark-coverage / responsive (no horizontal overflow at 360px). Ship: version bump `js/rz-version.js` + CHANGELOG entry + `tools/build-changelog-html.py --apply`, run from repo root; gated ships skip IndexNow.

See [ARTICLE_DATAVIZ_STANDARD.md](ARTICLE_DATAVIZ_STANDARD.md), [EXPLAIN_ENGINE_STANDARD.md](EXPLAIN_ENGINE_STANDARD.md), [AUTH_STANDARD.md](AUTH_STANDARD.md), [DARK_MODE_STANDARD.md](DARK_MODE_STANDARD.md), [CONTENT_TAXONOMY_STANDARD.md](CONTENT_TAXONOMY_STANDARD.md).
