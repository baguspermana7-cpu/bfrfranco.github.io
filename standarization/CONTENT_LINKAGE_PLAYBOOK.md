# Content Linkage Playbook & Handoff

> **Mandate (user, 2026-05-18):** *"jika ada keterkaitan begini, tidak hanya
> ini, tapi untuk semuanya — anda harus ingat di suatu document (changelog /
> standarization) dan di memory. Anggap ini playbook dan handoff agar tidak
> terlewat jika ada article atau improvement baru."*
>
> Root cause this prevents: `insights.html` "Latest Publications" was stale
> at article-13 while articles 14–27 existed — a cross-page linkage was
> missed because no checklist enforced it.

**Read this at the START and the END of any content/feature task.** If you
add or change anything in the left column, you MUST update everything in the
right column in the SAME change. Verify, then tick it in the CHANGELOG entry.

---

## 1. New / updated ARTICLE (`article-N.html`, geopolitics, FF series)

| Touch | Update (same commit) |
|---|---|
| `insights.html` | "Latest Publications" feed — prepend newest with **real** `datePublished` (read from the article's JSON-LD/meta — never fabricate dates), real `<title>`, correct `feed-category` (`engineering` / `global` / `future-forward`). Keep ~8 most-recent. |
| `articles.html` | Article index/grid card + count. |
| Series landing | `future-forward.html` (FF-n) or `geopolitics.html` (geopolitics-n) — add the entry + update series counts/stats (no `0 / New` placeholders). |
| `glossary.html` | ≥5 new terms with backlinks (existing glossary mandate — `TOOLTIP_STANDARD.md`). |
| `sitemap.xml` | `python3 tools/build-sitemap.py --apply`. |
| `search-index.json` | Add the page entry. |
| `llms.txt` / `llms-full.txt` | `python3 tools/build-llms-txt.py --apply` + `build-llms-full.py --apply`. |
| `standarization/Indexing gconsole/top-urls-request-indexing.txt` | Add the new URL. |
| Related-articles | Cross-link from 2–3 sibling articles. |
| `Article/Post Draft/<Name>/` | 5 platform MDs (x, linkedin, mastodon, medium, facebook) — `feedback_post_draft_mandate`. |

## 2. New / updated CALCULATOR or TOOL

| Touch | Update |
|---|---|
| `tools.html`, `datacenter-solutions.html` | Add the tool card. |
| `insights.html` | "Reports & Trackers" card if analytical. |
| `rz-ops-p7x3k9m.html` | 3-tier feature-flag row (`rz-feature-flags.js`). |
| sitemap / search-index / llms / top-urls | As §1. |
| `standarization/UI_FEATURES_STANDARD.md` | Document the new pattern. |
| Post Draft folder | 5 platform MDs. |

## 2.5 NEW KNOWLEDGE LABS topic page (Network Hub / standards lab / concept page)

> Added v1.36.x — per `KNOWLEDGE_LABS_STANDARD.md` (2026-05-24) and
> `POST_DRAFT_STANDARD.md` (2026-05-24).

| Touch | Update |
|---|---|
| `datacenter-solutions.html` Knowledge Labs section | Add or update the card. |
| `network-visualization-hub.html` (for Network Hub topics) | Flip the card status from `PHASE X` → `LIVE`. |
| `js/network-anim/topics/<slug>.js` (Network Hub only) | Topic module with `_timbre` per Appendix E. |
| `js/network-anim/topics/<slug>.js` audit | `python3 tools/audit-network-anim.py --strict` MUST pass (palette / banned-CSS / timbre fields / variation budget / pairwise-within-lane anti-monotony). |
| `tools/test-network-anim-determinism.py` | Must pass for Network Hub topics (`seek(N) ≡ reset() + seek(N)`). |
| `js/rz-feature-flags.js` | `network-<slug>` `page-access` entry (public-tier default). |
| `sitemap.xml`, `llms.txt` | Manual entry (sitemap builder doesn't scan subdirectories yet). |
| OG image | `python3 tools/build-og-images.py --apply` (use `--force` for regeneration). |
| `Article/Post Draft/<Topic Name>/` | At minimum: `linkedin.md`, `x-post-1.md`, `mastodon-1.md`. |

## 2.6 NEW / updated MAINTENANCE TOOL or CDU ↔ FMECA integration

> Added v1.50.x (2026-06-27). A maintenance-oriented tool (or any page with a
> maintenance/fault aspect) must be cross-wired to the AI-maintenance/FMECA layer
> + the spares engine + the interactive sourced-chart system — not stand alone.

| Touch | Update |
|---|---|
| Tool/page with a maintenance aspect | Add a "Maintenance intelligence" card/row linking to `ai-engineering-maintenance.html` (FMECA-KG) + `spares-readiness-calculator.html`. (Both are plain links — the spares calc reads only financial query params.) |
| Fault scenarios / symptom tables | Tag with the matching **FMECA fault ID** from `docs/research/csv/faults.csv` (e.g. liquid-cooling **F11.1–F11.5**) + link to `ai-engineering-maintenance.html#sec-knowledge-base`. CDU map: leak→F11.3, pump-fail→F11.2, clog→F11.5. |
| `docs/research/csv/` | If a new asset family / fault mode is added, regenerate the FMECA seed files + bump the count cited on `ai-engineering-maintenance.html` (coordinate — that file is parallel-session-owned). |
| Interactive charts | Number-driven maintenance pages carry ≥1 `data-rz-chart` (rz-article-chart.js) with `source`+`basisTag`; dataset in `data/<slug>/` with `source`/`basis_tag` columns; **must pass `node tools/audit-article-charts.mjs --strict`** (`ARTICLE_DATAVIZ_STANDARD.md`). |
| Obsidian second-brain | Add/refresh the suite note in `Apps/second brain/obsidian-knowledge-vault/` + the web-graph nodes/edges in `Apps/second brain/index.html`. |

## 3. EVERY shipped change (always — no exceptions)

1. `js/rz-version.js` — bump semver **and** `RZ_VERSION_DATE` (today's date).
2. `CHANGELOG.md` — entry quoting the user's request; then
   `python3 tools/build-changelog-html.py --apply`.
3. `python3 tools/sync-sw-version.py`.
4. Pre-push gates ALL green: `audit-script-tags.py --strict`,
   `audit-js-syntax.py --strict`, `audit-version-stamp.py --strict`,
   `audit-mobile-responsive.py --strict`.
5. Update the relevant `standarization/*.md` doc.
6. Update memory: the session file + `MEMORY.md` one-line index.
7. `git push origin main`, then
   `python3 tools/indexnow-submit.py --since HEAD~1`.

## 4. Cross-page invariants (must always hold)

- **Changelog is easter-egg-only**: reachable ONLY via the footer version
  stamp (`script.js injectVersionStamp()` → `changelog.html`; standalone
  pages use `<span class="version-stamp"><a href="changelog.html">`). It is
  **never** a nav-menu `<li>` item. (Removed from index/articles/tools nav
  2026-05-18 v1.20.8.)
- Default theme = **DAY/light** (v1.19.1); only an explicit toggle picks dark.
- Diagram/SVG: `viewBox` + `preserveAspectRatio`, 0 px overflow @390px,
  0 line/text overlap.
- DC-dashboard tab in `datahallAI.html` is excluded from the redesign —
  keep byte-identical unless the owner un-excludes it.
- Sub-agent claims are NEVER trusted unverified — re-run gates + browser +
  byte-diff yourself.

## 5. Handoff

This file + `~/.claude/.../memory/` is the handoff. A new session/agent
picking up content or feature work reads §1–§4 first. When a linkage class
not listed here is discovered, ADD it here in the same change (this doc is
itself under the §3 "every change" rule).
