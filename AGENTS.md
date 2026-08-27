# AGENTS.md — resistancezero.com (Codex entry point)

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
