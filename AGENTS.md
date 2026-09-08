# AGENTS.md — resistancezero.com (Codex entry point)

> **Concurrent Codex editorial audit, 2026-09-08:** article/readability, shared editorial CSS/runtime,
> decorative CSS sweep and crawler/audit-tool edits are IN PROGRESS and NOT authorized for publication.
> Do not stage these into the separate DC AI network release. See
> `docs/handoff/2026-09-08-editorial-audit.md`; keep Chromium sweeps serial.
> **Browser coordination request (22:39 WIB):** the editorial audit owns the next whole-site browser
> window. Let running jobs finish, but please do not launch another Chromium suite while
> `tools/audit-site-render.mjs` or this audit's dark-coverage job runs. Keep the pending DC AI release
> separate; the editorial source/evidence is not approved for staging or publication.

> ⚠️ **HANDBACK 2026-09-08 — Codex Astra ran out of tokens mid-session; the owner moved orchestration back
> to Claude Code, which continues to follow Codex's plan and the visual review it commissioned.**
>
> **UNFINISHED CODEX WORK LEFT DIRTY IN THIS TREE — NOT COMMITTED BY CLAUDE, and it currently breaks a
> ship gate.** `tools/build-sitemap.py` (rewritten, lost the `'prd': 'prd'` mapping that
> `tools/test-telemetry-discovery.mjs` asserts → **ship gate 58 FAILS**), plus rewritten
> `tools/build-llms-txt.py`, `tools/build-llms-full.py`, `tools/build-changelog-html.py`,
> `tools/generate-city-pages.py`, `tools/audit-vibecode.mjs`, and untracked
> `tools/audit-site-render.mjs`, `tools/crawler_*.py`, `tools/SITE_RENDER_AUDIT.md`,
> `docs/plans/2026-09-08-editorial-site-audit.md`, `docs/handoff/2026-09-08-editorial-audit.md`.
> Claude verified the gate-58 failure is NOT caused by its own change: `git show HEAD:tools/build-sitemap.py`
> still carries the mapping, the working copy does not. Whoever resumes that work must either restore the
> mapping or update the gate — do not push those files until gate 58 is green again.
> Claude session: `session_01NDq7nMDQWWV65zwjNDG8So` · transcript
> `~/.claude/projects/-home-baguspermana7/5bf49aaa-2375-4b70-aa12-7d3d7fa024d8.jsonl`.
> `origin/main` = **`25610142` (v2.12.0)**, all 65 ship gates + probe 82/82 green at that commit.
>
> **Owner ledger state** (plan `~/.claude/plans/cheerful-cuddling-mitten.md` §7, 20 comments):
> Track B comments 12–18 SHIPPED v2.5.0–v2.11.0 (chiller 13, fire 14, fuel 15, water 16, ICT 17,
> data hall 12, nav 18). Track A comment 2 (rack architecture) SHIPPED v2.12.0.
> **Remaining: (4) Network sub-tabs §A7 · (6) BMS tab cards · (3) modal type/proportion/animation.**
>
> **SHIPPED by Claude — item 4 (§A7 network sub-tabs) is v2.13.0. Files it owns:**
> `datahallAI.html` (the `#p-net` panel, the `netC` builder ~line 7780–8020, `netCards`, the tab CSS
> block ~line 118), `js/dcai-model.js` / `js/dcai-engine.js` (frozen unless I bump them),
> `tools/lib/cockpit-tabs.mjs`, `tools/test-dcai-coverage.mjs`, `tools/probe-line-model.mjs`,
> `js/rz-version.js`, `CHANGELOG.md`, `changelog.html`, `sw.js`, `data/dcai-parameters.json`,
> `js/dcai-parameters.js`.
>
> **NEXT, in Codex's planned order (Claude now runs them):**
> 1. **(6) BMS tab cards** — owner: *"BMS: no modals, cards are AI design slop."* Lives in
>    `datahallAI.html` `#p-bms` + the `bmsC` / `bmsCards` builders and `css/datahall-ai-operator.css`.
>    Coordinate: tell me before you touch `datahallAI.html` and I will stage/commit my A7 work first,
>    so we never hold the same file dirty. Rules: no new engine parameters, every rendered numeral
>    hooked (`bo('field')`) or `data-rz-authored-basis` ≥40 chars, gate
>    `node tools/test-dcai-coverage.mjs --strict --settle=9000 --modals`.
> 2. **(3) Modal type / proportion / animation** — `js/rz-inspector.js` + the DHModal block in
>    `datahallAI.html` (~line 11700+) + `css/datahall-ai-operator.css`. Same coordination rule.
>
> **Non-negotiables (both of us):** `git add <specific paths>` — NEVER `git add -A`;
> `git pull --rebase --autostash origin main` before every push; bump `js/rz-version.js` +
> `CHANGELOG.md` + `python3 tools/build-changelog-html.py --apply` + `python3 tools/sync-sw-version.py`;
> registries only via `node tools/build-dcai-parameter-registry.mjs` /
> `node tools/build-conv-parameter-registry.mjs`; full gate before push
> (`bash tools/ship-gate.sh` — Chromium gates must run SERIALLY, this box OOMs otherwise) plus
> `RZ_BASE=file node tools/probe-accuracy-validation.mjs` (82/82). Never invent a number.
>
> **OWNER DIRECTIVE 2026-09-08 (applies to BOTH of us, every cockpit view):**
> *"Jgn bentuk bnyak tulisan, berikan setiap block atau gambar itu pop up modal yg sangat detail dan presisi."*
> → A drawing is a DRAWING. Do not pile tables and paragraphs onto the sheet. Each block, symbol or
> equipment group carries only its identity and one or two headline figures; **every detail goes into a
> pop-up modal opened by clicking that block** (DHModal panel; the v2.4.0 gesture order stands — plain
> click opens the modal, Shift/right-click opens the right-side inspector). The modal must be
> *detailed and precise*: identity and tag, the arithmetic that produced every figure, ratings vs
> operating point, dependencies and failure domain, alarms/limits, and the basis of every number
> (engine hook or written declaration). Applies to the BMS cards (item 6) and the modal design pass
> (item 3) as well — Codex, take this as the acceptance bar for both.
>
> **Acceptance bar for both remaining items = the owner directive above plus the A7 visual review:**
> per-object panels never borrow campus alarm state, identity colour is never an alarm colour, every label
> agrees with the model it describes, and each ship proves 375 px, 768 px, light theme and modal keyboard
> behaviour (focus trap, Escape closes, focus returns to the clicked block).
>
> **Owner action still pending:** `python3 tools/indexnow-submit.py --since HEAD~10` (v2.2.0→v2.12.0
> were never submitted — the permission classifier blocks it from an agent session).

> ⚠️ **HANDOFF FROM CLAUDE (2026-08-23) — READ BEFORE COMMITTING `tools/ship-gate.sh`.**
> Claude ran the anti-vibecode sweep on branch `fix/ship-gate-automation` and **pushed** two commits:
> `e94cb176` (batch-1: font Inter→IBM Plex Sans + shared-CSS #8B5CF6 removal), `2c85a580` (batch-2:
> per-page #8B5CF6→#64748b purge, glassmorphism→opaque tokens, EPMS dot-grid→line-grid, rfs
> fa-magic→fa-bolt, new `tools/audit-vibecode.mjs` gate + `standarization/ANTI_VIBECODE_STANDARD.md`),
> and `3520b3b5` (batch-3: decorative emoji UI icons→Font Awesome across 9 pages + new `emoji-ui-icon`
> gate rule; functional 🔒/⚠/⚡/★/flags/arrows/checks kept). Audit CLEAN (exit 0).
> plus `755d55b2` (batch-4: entity-encoded emoji `&#128214;`→Font Awesome across 43 pages; audit now
> DECODES numeric HTML entities — a headless live render caught the 📖 pill that a literal scan missed).
> **`origin/main` was fast-forwarded to `755d55b2` and is LIVE (IndexNow pinged; headless render of
> cdu-hub/tools/datahallAI = 0 console errors, 0 slop emoji, FA icons paint).** These 4 commits carry NO
> version bump (that's your pending 1.128.0) — the public version stamp still reads 1.127.x until you land
> it; reconcile CHANGELOG/rz-version.js when you ship. `main` = branch tip, so a later
> `git push origin fix/ship-gate-automation:main` from you still fast-forwards.
> Both are **specific-path** commits — they do NOT touch `js/rz-version.js`, `CHANGELOG.md`,
> `changelog.html`, `Taskfile.yml`, `auth.js`, `sw.js` (yours, left untouched in the working tree).
> **Action for Codex:** `tools/ship-gate.sh` in the shared working tree has YOUR uncommitted changes
> PLUS Claude's `+2` lines wiring the `audit-vibecode --strict` product gate (right after
> `audit-hero-images`). When you commit ship-gate.sh, **keep those 2 lines** — do NOT `git checkout`/
> clobber them, or the anti-vibecode gate won't run. The audit currently passes CLEAN (`node
> tools/audit-vibecode.mjs --strict` = exit 0); keep it green. Delete this block once you've landed it.

> Codex is now the primary driver for this repo. **Read `CLAUDE.md` in this directory first** — it is
> the canonical, full project spec (460 lines). This file surfaces the non-negotiables so they are
> always in front of you; `CLAUDE.md` has the complete detail and the war stories behind each rule.

- **Domain**: https://resistancezero.com · **Host**: GitHub Pages (`baguspermana7-cpu/bfrfranco.github.io`)
- **Build**: zero-build, files served as-is · **Tech**: HTML5 + CSS3 + vanilla ES5 JS + Python tooling
- **Local server**: `python3 -m http.server 8081` · **Owner**: Bagus Dwi Permana (Eng Ops Leader)

## SHIP DISCIPLINE (required on every shipped change)
1. Bump `js/rz-version.js` (`window.RZ_VERSION`) per semver (PATCH fix / MINOR feature / MAJOR breaking).
2. Add a `## v1.X.Y — YYYY-MM-DD` entry to `CHANGELOG.md`, then `python3 tools/build-changelog-html.py --apply`.
3. Run the strict audit gates (see below). If any fail, do NOT push — investigate.
4. Commit with **specific file paths** (never `git add -A` — a parallel session's `git add -A` can sweep
   your uncommitted work). `git pull --rebase --autostash origin main`, then push.
5. After push: `python3 tools/indexnow-submit.py --since HEAD~1`.
6. Mirror every bug find/fix into `CHANGELOG.md` + the tracker (see Memory).

### Strict gates (block a push)
```
python3 tools/audit-script-tags.py --strict        # </script> inside JS strings
python3 tools/audit-js-syntax.py --strict          # unterminated strings / CSS-in-JS
python3 tools/audit-version-stamp.py --strict      # version stamp on all pages
python3 tools/audit-mobile-responsive.py --strict  # 8 responsive checkpoints
node   tools/audit-responsive-layout.mjs --strict  # real horizontal-scroll render gate
node   tools/audit-dark-coverage.mjs --strict      # no white body/content in dark mode
node   tools/audit-a11y.mjs --strict               # axe-core: 0 critical/serious, 8 pages x 2 themes
node   tools/audit-interactions.mjs --strict       # palette / living diagrams / scrolly
node   tools/audit-article-charts.mjs --strict     # every chart carries source + basisTag
node   tools/audit-page-gates.mjs --strict         # tier access-gate wiring
node   tools/audit-hero-images.mjs --strict        # hero pages load js/rz-hero-fit.js
```

### Engine chain — run when `rz-engine.js` or `fin-engine.js` changes
`terser rz-engine.js -c -m -o rz-engine.min.js` → `node tools/build-engine-catalog.mjs` →
`node tools/test-value-bindings.mjs` (SHIP GATE) → bump the shared `?v=` on pages that load it +
`dcmoc/src/app/layout.tsx`. Also: `node tools/test-rz-engine.mjs`, `test-fin-engine.mjs`,
`test-reference-parity.mjs`, and the DCMOC `_dcmoc_trace_parity_probe.mjs` (214/214 baseline),
`test-model-calibration.mjs`, `audit-dcmoc-enum-coverage.mjs`. `fin-engine.js models.technical` MUST stay
parity-identical to `cf-worker/src/ta.js`. FIN Engine is educational-only (disclaimer gate-asserted).

## CRITICAL gotchas (each caused a real regression — see CLAUDE.md)
- **2-stylesheet architecture**: `index.html` loads ONLY `styles-index.min.css`; all other pages load
  `styles.css`/`styles.min.css`. Any CSS affecting index MUST go in BOTH `styles.css` AND
  `styles-index.css`, then re-minify with `cleancss` + bump the `?v=`.
- **`</script>` in JS strings**: the HTML tokenizer isn't JS-aware — a literal `</script>` in a JS string
  kills every function below. Always write `<\/script>`. (audit-script-tags catches it.)
- **Dark-mode `:root` cascade bug**: write light fallbacks as `:root:not([data-theme="dark"])`, never
  `:root, [data-theme="light"]` (bare `:root` wins in all themes → white body in dark). Every content page
  needs a `[data-theme="dark"]` palette or the standard skin; pass `audit-dark-coverage`.
- **Hamburger nav is mandatory**: never remove the `js/rz-mobile-nav.js` script tag or the open-state CSS.
- **Auth tiers**: 4-tier (free→demo→pro→root) + 5-role overlay (…→educator→root). Educators have
  `tier==='pro'` + `role==='educator'`. Page gates use `enforceTierFeatureAccess(pageKey)` +
  `js/rz-feature-flags.js` `page-access`. DC AI/HPC + DC Conventional are root+educator only.

## Shared modules — REUSE, never re-implement per page (cache-bust `?v=` when edited)
`js/rz-command-palette.js` (Ctrl/Cmd+K search) · `js/rz-article-editorial.js` · `js/rz-article-chart.js`
· `js/rz-article-diagram.js` · `js/rz-scrolly.js` · `js/rz-mobile-nav.js` · `js/rz-calc-utils.js` ·
`css/rz-finance-suite.css` · `js/rz-explain.js`+`rz-explain-db.js` (tooltips; DB generated) ·
`js/rz-cookie-consent.js`. See CLAUDE.md "Shared modules" + `standarization/*`.

## Rejected patterns — DO NOT reintroduce
Dot-grid hero noise · rotated floating side-cards on index · Anthropic-purple `#8B5CF6` user pill ·
cursor-tracking/3D-tilt effects · visible GitHub URL · saturated emerald bento · gradient callout fills +
3-4px accent borders · translucent card washes / highlight spans in article bodies · white text on
category-gradient badges · `ch`-based centered article measure. (Full list + rationale in CLAUDE.md.)

## Memory (project state + decisions + bug tracker)
Persistent notes live in `~/.claude/projects/-home-baguspermana7/memory/` — **`MEMORY.md` is the index**
(one line per topic). Read it at session start for prior decisions, gotchas, and ongoing work. Key files:
`project_rz_bug_request_tracker.md` (live PENDING/SOLVED bug list — read + keep updated),
`project_rz_versioning.md`, `feedback_*` (hard-won rules). Convert relative dates to absolute when noting.

## Local tooling (this machine)
- **Finance gateway Worker** `cf-worker/` → `rz-finance-gateway.resistancezero0us.workers.dev` (news/quote/
  candles/calendar/analyze, keyless via CORS whitelist). Deploy: `cd cf-worker && npx wrangler deploy`.
- **OmniRoute** free AI gateway on `localhost:20128` (OpenAI-compatible `/v1`). `codex -p <profile>` uses
  the generated `~/.codex/*.config.toml` profiles.
- **RDCST** local-frontier system: `rz-ai ask|code|chat|bench` (`~/.claude/rdcst/`) — distilled skill-cards
  + cascade to Claude. **rzorc** multi-agent review IDE at `:8770` (`~/.claude/rzsessions/`).

## Process
Minimal surgical changes for the literal request; don't refactor surrounding code. Verify before claiming
fixed (screenshot / gate output). Pre-flight grep related state. Walk
`standarization/CONTENT_LINKAGE_PLAYBOOK.md` §1–4 before AND after any content/feature task (a green build
with a stale cross-reference is still a failure). Update `standarization/*` after any new pattern.
