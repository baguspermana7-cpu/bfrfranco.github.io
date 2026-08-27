# RZ CODEX CONTEXT — drag this one file into Codex to load everything

> Single self-contained brief for resistancezero.com + owner standards + project state.
> Drop it into an active Codex session and it has the full operating context. (Also mirrored to
> `~/rz-work/AGENTS.md` + `~/.codex/AGENTS.md`, which Codex auto-loads; this file is the all-in-one.)

Owner: Bagus Dwi Permana (Engineering Operations Leader, Bekasi). Domain: https://resistancezero.com.
Host: GitHub Pages (`baguspermana7-cpu/bfrfranco.github.io`, main = live). Zero-build: HTML5 + CSS3 +
vanilla ES5 JS + Python tooling. Local server: `python3 -m http.server 8081`.

═══════════════════════════════════════════════════════════════════════════════
## 1) SHIP DISCIPLINE — required on every shipped change
═══════════════════════════════════════════════════════════════════════════════
1. Bump `js/rz-version.js` (`window.RZ_VERSION`) — PATCH fix / MINOR feature / MAJOR breaking.
2. Add `## v1.X.Y — YYYY-MM-DD` to `CHANGELOG.md`; run `python3 tools/build-changelog-html.py --apply`.
3. Run the strict gates (§2). Any fail → do NOT push; investigate.
4. `git add <specific paths>` (NEVER `git add -A` — a parallel session's `-A` sweeps your uncommitted
   work). `git pull --rebase --autostash origin main`, then push.
5. After push: `python3 tools/indexnow-submit.py --since HEAD~1`.
6. Mirror every bug find/fix into `CHANGELOG.md` + the tracker (§6).

### 2) Strict gates (block a push)
```
python3 tools/audit-script-tags.py --strict        # </script> in JS strings
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
### Engine chain — when `rz-engine.js` / `fin-engine.js` changes
`terser rz-engine.js -c -m -o rz-engine.min.js` → `node tools/build-engine-catalog.mjs` →
`node tools/test-value-bindings.mjs` (SHIP GATE) → bump shared `?v=` on loading pages +
`dcmoc/src/app/layout.tsx`. Plus `test-rz-engine.mjs`, `test-fin-engine.mjs`, `test-reference-parity.mjs`,
DCMOC `_dcmoc_trace_parity_probe.mjs` (214/214), `test-model-calibration.mjs`, `audit-dcmoc-enum-coverage.mjs`.
`fin-engine.js models.technical` MUST stay parity-identical to `cf-worker/src/ta.js`. FIN Engine =
educational-only (disclaimer gate-asserted).

═══════════════════════════════════════════════════════════════════════════════
## 3) CRITICAL gotchas — each caused a real regression
═══════════════════════════════════════════════════════════════════════════════
- **2-stylesheet architecture**: `index.html` loads ONLY `styles-index.min.css`; other pages load
  `styles.css`/`styles.min.css`. CSS affecting index MUST go in BOTH `styles.css` AND `styles-index.css`,
  re-minify with `cleancss`, bump `?v=`.
- **`</script>` in JS strings** → write `<\/script>` (HTML tokenizer isn't JS-aware; a literal closer kills
  every function below). audit-script-tags catches it.
- **Dark-mode `:root` cascade**: light fallback = `:root:not([data-theme="dark"])`, NEVER
  `:root, [data-theme="light"]` (bare `:root` wins all themes → white body in dark). Every content page
  needs a `[data-theme="dark"]` palette or standard skin; pass audit-dark-coverage.
- **Hamburger nav mandatory**: never remove `js/rz-mobile-nav.js` tag or the open-state CSS.
- **Auth**: 4-tier (free→demo→pro→root) + 5-role (…→educator→root). Educator = `tier==='pro'` +
  `role==='educator'`. Page gates: `enforceTierFeatureAccess(pageKey)` + `js/rz-feature-flags.js`
  `page-access`. DC AI/HPC + DC Conventional = root+educator only.
- **Shared modules — REUSE, never re-implement per page** (cache-bust `?v=` on edit):
  `rz-command-palette.js` (Ctrl/Cmd+K), `rz-article-editorial/chart/diagram.js`, `rz-scrolly.js`,
  `rz-mobile-nav.js`, `rz-calc-utils.js`, `css/rz-finance-suite.css`, `rz-explain.js`(+`-db`),
  `rz-cookie-consent.js`.
- **Rejected patterns — DO NOT reintroduce**: dot-grid hero noise; rotated floating side-cards on index;
  Anthropic-purple `#8B5CF6` pill; cursor-tracking/3D-tilt; visible GitHub URL; saturated emerald bento;
  gradient callout fills + thick accent borders; translucent card washes / highlight spans in article
  bodies; white text on category-gradient badges; `ch`-based centered article measure.

═══════════════════════════════════════════════════════════════════════════════
## 4) PERSONAL ENGINEERING STANDARDS (all projects)
═══════════════════════════════════════════════════════════════════════════════
- **Immutability**: never mutate inputs — return new copies. **Many small files** (200–400 typ, 800 max);
  functions < 50 lines; nesting ≤ 4. **Errors**: handle at every level, friendly UI + detailed logs, never
  swallow. **Validate** all external input at boundaries (schema-based). No hardcoded values; no
  `console.log` in prod.
- **Types (TS/JS)**: explicit on public APIs + React props; avoid `any` (use `unknown` + narrow);
  `interface` for shapes, `type` for unions; string-literal unions over enum.
- **Git**: conventional commits (`feat|fix|refactor|docs|test|chore|perf|ci`); branch, never commit on
  default; NO co-author/attribution lines; commit/push only when asked.
- **Testing**: 80% coverage (unit+integration+e2e); TDD RED→GREEN→refactor; fix impl not the test.
- **Security (pre-commit)**: no hardcoded secrets (env/secret-manager, validate at startup); parameterized
  queries; sanitize HTML (XSS); CSRF; authz verified; rate-limit; errors don't leak internals; rotate
  exposed secrets.

═══════════════════════════════════════════════════════════════════════════════
## 5) TOOLS (MCP + local)
═══════════════════════════════════════════════════════════════════════════════
- **Code discovery — prefer MCP over grep**: `codebase-memory-mcp` → `search_graph` (find fn/class/route),
  `trace_path` (callers/callees), `get_code_snippet`, `query_graph` (Cypher), `get_architecture`. Run
  `index_repository` first if unindexed. Fall back to grep for string literals / non-code / config.
- **Memory (MCP `rzmemory`)**: semantic recall of past decisions + KB. Single-process DB — don't run
  alongside a Claude memory session (lock). Files always readable: `~/.claude/projects/-home-baguspermana7/memory/`.
- **Finance gateway Worker** `cf-worker/` → `rz-finance-gateway.resistancezero0us.workers.dev` (news/quote/
  candles/calendar/analyze; keyless via CORS whitelist). Deploy: `cd cf-worker && npx wrangler deploy`.
- **OmniRoute** free AI gateway `localhost:20128` (`/v1`). Free Codex profiles: `codex -p auto-best-coding`
  / `codex -p oc-deepseek-v4-flash-free`. **RDCST**: `rz-ai ask|code|chat|bench` (`~/.claude/rdcst/`).
  **rzorc** review IDE `:8770` (`~/.claude/rzsessions/`).

═══════════════════════════════════════════════════════════════════════════════
## 6) PROJECT STATE + BUG TRACKER (read the memory dir for full detail)
═══════════════════════════════════════════════════════════════════════════════
Index: `~/.claude/projects/-home-baguspermana7/memory/MEMORY.md` (one line per topic). At session start,
read it + the relevant topic file. Live bug list: `project_rz_bug_request_tracker.md` (read + keep updated).

Current highlights (as of 2026-08-08):
- **Finance Terminal**: news + earnings/IPO keyless via deployed gateway Worker (v1.126.5); per-tab
  technical buy/sell gauge on stock/forex/crypto/commodities/futures (R-003 done, v1.126.6–.7). Bugs
  B-008/B-012 verified SOLVED. OPEN feature reqs: R-002 fundamental "why", R-009 alerts (Telegram/email
  via Worker Cron), R-007 charting.
- **DCMOC** (`dcmoc/`, Next.js static-export): deep-audit CLOSED (v1.124.x); trace-parity gate 214/214.
  GOTCHA: a build killed mid-`cp -r out/. ./` gives FALSE trace-parity fails — clean-rebuild in
  BACKGROUND before diagnosing.
- **Local AI**: RDCST (71 skill-cards, 7 domains, cascade), rzorc (review-baseline + cascade builder),
  OmniRoute (99 free profiles). See `tool_*` memory files.
- **Concurrency GOTCHA**: another session driving headless Chrome makes dark-coverage/responsive-layout
  gates give FALSE white-in-dark; reproduce solo before "fixing". A parallel session's `git add -A` can
  sweep your files — always stage specific paths.

═══════════════════════════════════════════════════════════════════════════════
## 7) PROCESS
═══════════════════════════════════════════════════════════════════════════════
Minimal surgical changes for the literal request; don't refactor surrounding code. Verify before claiming
fixed (screenshot / gate output; especially for 2nd-attempt bugs). Pre-flight grep related state. Walk
`standarization/CONTENT_LINKAGE_PLAYBOOK.md` §1–4 before AND after any content/feature task (green build +
stale cross-reference = still a failure). Update `standarization/*` after any new pattern. Full canonical
spec: `CLAUDE.md` (460 lines) in the repo root.
