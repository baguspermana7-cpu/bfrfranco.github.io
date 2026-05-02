# System Tree — ResistanceZero AI Assistant

> Last updated: 2026-05-02 | Environment: Claude Code (Sonnet 4.6) on Ubuntu Linux 6.17.0

---

## 1. Runtime Environment

| Property | Value |
|----------|-------|
| OS | Ubuntu Linux 6.17.0-22-generic |
| Shell | bash |
| Python | 3.13.7 |
| Go | 1.24.4 linux/amd64 |
| Node.js | v24.13.1 |
| npm | 11.8.0 |
| reportlab | 4.4.10 |
| Working directory | `/home/baguspermana7/rz-work` |
| Git remote (origin) | `https://github.com/baguspermana7-cpu/bfrfranco.github.io.git` |
| HTTP server | `python3 -m http.server 8081` (rz-work), 8080=NemoClaw, 8082=Affiliate |

---

## 2. Available Agents (18)

Located in `~/.claude/agents/`

| Agent | Purpose | When Auto-Triggered |
|-------|---------|---------------------|
| `architect` | System design and architectural decisions | When architectural decisions need to be made |
| `build-error-resolver` | Fix build errors and compilation failures | When build fails |
| `chief-of-staff` | High-level project orchestration | Complex multi-domain coordination |
| `code-reviewer` | Code review after writing | Immediately after code is written or modified |
| `database-reviewer` | Database schema and query review | When DB schema or queries are changed |
| `doc-updater` | Update documentation | When updating docs after code changes |
| `e2e-runner` | End-to-end testing of critical user flows | Critical user flows, pre-deploy checks |
| `go-build-resolver` | Fix Go-specific build errors | When Go build fails |
| `go-reviewer` | Go code review | After writing Go code |
| `harness-optimizer` | Optimize Harness CI/CD pipelines | When Harness pipeline config changes |
| `kotlin-build-resolver` | Fix Kotlin/Gradle build errors | When Kotlin build fails |
| `kotlin-reviewer` | Kotlin code review | After writing Kotlin code |
| `loop-operator` | Manage looped/recurring agent tasks | When setting up recurring operations |
| `planner` | Implementation planning, PRD/architecture docs | Complex features, refactoring, before coding |
| `python-reviewer` | Python code review | After writing Python code |
| `refactor-cleaner` | Dead code cleanup and refactoring | Code maintenance, tech debt reduction |
| `security-reviewer` | Security analysis before commits | Before commits, when auth/input code changes |
| `tdd-guide` | Test-driven development enforcement | New features, bug fixes — write tests first |

---

## 3. Available Skills (46+ installed)

Located in `~/.claude/skills/`

### Coding & Patterns
- `golang-patterns` — Go idiomatic patterns and best practices
- `golang-testing` — Go test patterns, table tests, benchmarks
- `python-patterns` — Python patterns (dataclasses, generators, context managers)
- `python-testing` — pytest, fixtures, mocking, coverage
- `backend-patterns` — REST API, service layers, repositories
- `frontend-patterns` — Component architecture, state management
- `frontend-slides` — Presentation/slides frontend patterns
- `coding-standards` — Language-agnostic code quality standards
- `java-coding-standards` — Java-specific coding conventions
- `jpa-patterns` — JPA/Hibernate ORM patterns
- `postgres-patterns` — PostgreSQL query and schema patterns
- `clickhouse-io` — ClickHouse analytics DB patterns
- `django-patterns` — Django models, views, serializers
- `springboot-patterns` — Spring Boot REST + config patterns

### Testing & TDD
- `tdd-workflow` — Full TDD red-green-refactor cycle
- `django-tdd` — Django test-driven development
- `springboot-tdd` — Spring Boot TDD patterns
- `kotlin-test` — Kotlin/JVM test patterns

### Security
- `security-review` — Code security analysis checklist
- `security-scan` — Automated security scanning patterns
- `django-security` — Django-specific security hardening
- `springboot-security` — Spring Boot security config

### Verification & Quality
- `verification-loop` — Iterative verification and self-checking
- `eval-harness` — Evaluation harness for AI outputs
- `django-verification` — Django deployment verification
- `springboot-verification` — Spring Boot health checks

### Content & Writing
- `article-writing` — Long-form article structure and SEO
- `humanizer` — Make AI-generated text sound human
- `content-engine` — Content production pipeline
- `crosspost` — Cross-platform content distribution
- `market-research` — Market analysis and competitor research
- `investor-materials` — Pitch decks, financial models
- `investor-outreach` — Investor communication templates
- `marketing-for-founders` — GTM strategy, growth tactics
- `strategic-compact` — Strategic planning frameworks

### AI & APIs
- `claude-api` — Claude API / Anthropic SDK integration, prompt caching
- `exa-search` — Exa semantic search integration
- `x-api` — X (Twitter) API v2 integration
- `fal-ai-media` — fal.ai media generation API
- `videodb` — Video database and retrieval
- `video-editing` — Programmatic video editing
- `deep-research` — Multi-step research with tool chains
- `iterative-retrieval` — RAG and retrieval patterns

### Workflow & Infrastructure
- `dmux-workflows` — tmux multi-pane workflow automation
- `continuous-learning` / `continuous-learning-v2` — Adaptive learning loops
- `ui-ux-pro-max` — Advanced UI/UX design patterns
- `find-skills` — Discover and load available skills

---

## 4. Project Tools (in `rz-work/tools/`)

| Script | Purpose |
|--------|---------|
| `build-osm-dataset.py` | OSM Overpass crawler for PLN Java-Bali grid. Queries Overpass API for substations/plants/lines, applies YAML overlay, emits `window.PLN_JAVA_GRID` JS data file. 24h cache TTL. |
| `audit-dataset.py` | Quality dashboard for `js/pln-java-grid-data.js`. Runs 8 structural/semantic checks (orphan nodes, geo outliers, cross-tier impossibles, confidence distribution, Bali isolation, province coverage, duplicate IDs, missing fields). Use `--strict` to gate CI. |
| `generate-city-pages.py` | Programmatic SEO generator. Reads `city-data.json`, generates self-contained HTML pages for each data center market city plus a hub index. |
| `pln-java-grid-overlay.yaml` | Curated annotation overlay merged into OSM-sourced dataset — adds inferred edges, custom labels, topology corrections. |
| `city-data.json` | Data source for city page generator — structured JSON of DC market cities. |
| `Auto Update All` | Shell script / update runner for batch operations. |

---

## 5. GitHub Repos — Installed/Documented

Located in `standarization/repos/`

| Repo | Priority | Docker? | Location/Doc | Purpose |
|------|----------|---------|--------------|---------|
| `go-task/task` | CRITICAL | No | `REPO_task.md` | Modern YAML-based task runner (Makefile replacement). `task serve`, `task minify`, `task deploy`. |
| `spf13/cobra` | HIGH | No | `REPO_cobra.md` | Go CLI framework. Build `rz` unified CLI wrapping Python tools with `--help`, flags, subcommands. |
| `chenhg5/cc-connect` | HIGH | No | `REPO_ccconnect.md` | Bridge Claude Code to Telegram bot — control rz-work from mobile via `@Moldbot#1`. |
| `Tencent/WeKnora` | MEDIUM | YES | `REPO_weknora.md` | LLM knowledge base (Wiki + RAG + Knowledge Graph). Index Obsidian vault + standarization/ docs. |
| `harness/harness` | LOW | YES | `REPO_harness.md` | Self-hosted CI/CD + Git hosting. Automate: push → minify → link-check → GitHub Pages deploy. |
| `gastownhall/gascity` | EXPERIMENTAL | No | `REPO_gascity.md` | Multi-agent Claude Code orchestration via tmux worktrees. Parallel refactors, security audits. |

**Install plan**: `REPO_INSTALL_PLAN.md` — phased roadmap May–Oct 2026.

**Port allocation**: rz-work=8081, NemoClaw=8080, Affiliate=8082, Harness=3000, WeKnora=8085, dcmoc=3001

---

## 6. Standardization Documents

Located in `standarization/`

| File | Description |
|------|-------------|
| `AUTH_STANDARD.md` | Login modal standard — ALWAYS follow for auth UI, never use prompt()/alert() |
| `CALCULATOR_PROMPT_STANDARD.md` | Standard for calculator page AI prompts and structure |
| `CALC_ENGINE_PLAN.md` | Calculator engine architecture plan |
| `CALC_MODELS_PLAN.md` | Calculator financial models design |
| `CHOROPLETH_MAP_STANDARD.md` | Standard for choropleth map implementations (Leaflet, CARTO dark) |
| `CONTENT_TAXONOMY_STANDARD.md` | Content categorization and tagging system |
| `DATAHALL_AI_STANDARD.md` | DataHall AI dashboard standard — simulation pages, no References sections |
| `EMAIL_DOMAIN_CONFIG.md` | Email domain and DNS configuration guide |
| `GCLOUD-MIGRATION-PLAN.md` | Google Cloud → GitHub Pages migration plan and steps |
| `LEGAL_COMPLIANCE_STANDARD.md` | Legal compliance, disclaimers, terms of service requirements |
| `PDF_EXPORT_STANDARD.md` | PDF export via inline SVG in window.open() — NOT canvas |
| `PLN_DATA_SCHEMA.md` | Schema definition for PLN Java-Bali grid data structures |
| `PRO_MODE_STANDARDIZATION.md` | Free/Pro mode UI pattern — separate buttons, not toggle |
| `SEO_OPTIMIZATION_STANDARD.md` | SEO checklist: meta tags, sitemap, search-index.json, structured data |
| `SUPABASE_FIREBASE_SETUP.md` | Supabase/Firebase auth and database setup guide |
| `SUPER_ENGINE.md` | Super engine architecture and integration spec |
| `TOOLTIP_STANDARD.md` | Glossary tooltip system — 5+ terms per article, backlinks required |
| `UI_FEATURES_STANDARD.md` | UI feature flags, dark mode, responsive design standards |
| `repos/REPO_INSTALL_PLAN.md` | Phased installation plan for 6 repos (May–Oct 2026) |
| `repos/REPO_weknora.md` | WeKnora LLM knowledge base — setup, integration, risks |
| `repos/REPO_cobra.md` | Cobra Go CLI framework — `rz` CLI design, code examples |
| `repos/REPO_task.md` | go-task Taskfile — full Taskfile.yml example for rz-work |
| `repos/REPO_ccconnect.md` | cc-connect Telegram bridge — security notes, systemd service |
| `repos/REPO_harness.md` | Harness CI/CD — pipeline YAML, port conflicts, Docker setup |
| `repos/REPO_gascity.md` | Gascity multi-agent SDK — city.toml example, worktree strategy |
| `Audit result/SEO_Audit_Report.html` | Full SEO audit report (HTML) |
| `Audit result/Security_Audit_Report.html` | Full security audit report (HTML) |
| `Audit result/UIUX_Audit_Report.html` | Full UI/UX audit report (HTML) |
| `Improvement Plan/100-Ideas-Batch-3.md` | 100 improvement ideas batch 3 |
| `Improvement Plan/50-Ideas-Batch-1.md` | 50 improvement ideas batch 1 |
| `Improvement Plan/50-Ideas-Batch-2.md` | 50 improvement ideas batch 2 |
| `Improvement Plan/enhance-datacenter-landing-page.md` | DataHall landing page enhancement plan |
| `prompts/ARTICLE_CREATION_PROMPT.md` | v1.2 canonical prompt for creating new articles — includes Facebook, FF series notes |

---

## 7. Active Project Modules

### `js/` — PLN Java-Bali Grid Data Layer

| Module | Purpose |
|--------|---------|
| `rz-map.js` | Shared Leaflet map engine (CARTO dark tiles, node/edge rendering, tier-graded line widths) |
| `pln-tooltip.js` | Hover tooltip module for map nodes |
| `pln-java-grid-data.js` | Master 744-node / 488-edge dataset (500/275/150/70/20 kV) |
| `pln-java-grid-data-jakarta-banten.js` | Jakarta-Banten 20 kV overlay (30 nodes) |
| `pln-java-grid-data-jabar.js` | West Java 20 kV overlay (22 nodes) |
| `pln-java-grid-data-jateng.js` | Central Java 20 kV overlay (17 nodes) |
| `pln-java-grid-data-jatim.js` | East Java 20 kV overlay (24 nodes) |
| `pln-energy-data.js` | PLN energy production/capacity data |
| `pln-energy-dashboard.js` | Dashboard logic for energy data visualization |
| `pln-indonesia-provinces.geojson` | Indonesia province boundary geometries for choropleth |
| `pln-java-grid-data.schema.json` | JSON schema for PLN grid data validation |

### Root-level JS modules

| Module | Purpose |
|--------|---------|
| `script.js` / `script.min.js` | Global site JavaScript — navigation, dark mode, animations (several effects disabled via early return) |
| `styles.css` / `styles.min.css` | Global CSS (~5950 lines) + minified build |
| `rz-engine.js` | Core site engine |
| `rz-gamification.js` | Gamification system (achievements, XP, streaks) |
| `rz-chat.js` | Chat/AI assistant integration |
| `rz-tracker.js` | Analytics/tracking module |
| `rz-share-results.js` / `.min.js` | Share results functionality |
| `supabase-auth.js` | Supabase authentication integration |
| `sw.js` | Service worker for PWA caching |

---

## 8. Key Workflow Commands

### Daily Development

```bash
# Serve rz-work locally
python3 -m http.server 8081

# Minify JS
terser script.js -o script.min.js --compress --mangle

# Minify CSS
cleancss styles.css -o styles.min.css

# Deploy (push to GitHub Pages)
git add . && git commit -m "chore: update" && git push origin main
```

### PLN Grid Dataset

```bash
# Rebuild OSM dataset
python3 tools/build-osm-dataset.py

# Audit data quality
python3 tools/audit-dataset.py
python3 tools/audit-dataset.py --strict   # exits 1 on critical findings

# Generate city SEO pages
python3 tools/generate-city-pages.py
```

### PDF Generation

```bash
# Generate repo documentation PDFs
python3 standarization/repos/generate_pdfs.py
```

### Git Workflow

```bash
# Commit with conventional commit format
git commit -m "feat: add new feature"
git commit -m "fix: correct bug in module"
git commit -m "chore: minify assets"
git commit -m "refactor: clean up dead code"

# Check remote
git remote -v
```

### Claude Code Agents

```bash
# Invoke agent via /agent syntax in Claude Code
# Planner: for complex features
# tdd-guide: before writing any new feature
# code-reviewer: after writing code
# security-reviewer: before committing auth/input changes
```

### Repo Tools (after install)

```bash
# go-task (after install to ~/.local/bin)
task serve
task minify
task pln:build
task deploy
task --list

# cobra rz CLI (after building)
rz serve --port 8081
rz build pln
rz deploy --dry-run

# cc-connect (Telegram bridge)
cc-connect  # runs alongside active claude session

# gascity (multi-agent)
gascity run --config city.toml
gascity status
```

---

## 9. Key Project Paths

| Path | Description |
|------|-------------|
| `/home/baguspermana7/rz-work/` | Main site project (resistancezero.com) |
| `/home/baguspermana7/rz-work/Dunia-Emosi/` | Kids game app (22+ modules, Pixi.js) |
| `/home/baguspermana7/rz-work/dcmoc/` | DCMOC Next.js app (React 19, TypeScript, Tailwind) |
| `/home/baguspermana7/rz-work/standarization/` | All standards, audit docs, plans |
| `/home/baguspermana7/rz-work/tools/` | Python build/generation scripts |
| `/home/baguspermana7/rz-work/js/` | PLN grid data modules |
| `/home/baguspermana7/rz-work/games/` | Dunia Emosi game modules (shared) |
| `/home/baguspermana7/rz-work/Article/` | Post drafts by series/platform |
| `/home/baguspermana7/Bagus_Apps/` | Standalone apps (MoneyPrinter, NemoClaw, video) |
| `~/.claude/agents/` | 18 specialized AI agents |
| `~/.claude/skills/` | 46+ skill modules |
| `~/.claude/rules/` | Common + language-specific coding rules |
| `~/Apps/second brain/obsidian-knowledge-vault/` | Obsidian knowledge vault (check BEFORE crawling rz-work) |

---

*This document describes the full capability surface available to Claude Code when working in the rz-work environment.*
