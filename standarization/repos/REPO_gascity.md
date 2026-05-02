# REPO: gastownhall/gascity

**GitHub**: https://github.com/gastownhall/gascity  
**Type**: Multi-Agent AI Orchestration SDK (Go)  
**Runtime**: Go binary, requires tmux + git + jq  

---

## 1. What It Is

Gascity adalah SDK/framework di Go untuk mengkoordinasikan multiple Claude Code instances yang berjalan secara paralel di tmux sessions. It manages agent spawning, task assignment, inter-agent communication via git worktrees, and result aggregation. Think of it as a conductor that splits a large task (e.g., "refactor all calculators") into sub-tasks assigned to different Claude Code agents running simultaneously.

---

## 2. Tech Stack

- **Language**: Go
- **Config**: `city.toml` (TOML)
- **Dependencies**: `tmux`, `git`, `jq` (all required at runtime), Go 1.21+
- **Mechanism**: Each agent gets an isolated git worktree; communication via shared git branches or file-based message passing
- **Requirements**: Claude Code API key, tmux installed, git repo initialized

---

## 3. Kegunaan untuk ResistanceZero

**NOW:**
- Parallel refactor task: spawn 3 agents — one handles calculator pages, one handles article pages, one handles shared `script.js/styles.css` — semua berjalan bersamaan tanpa conflict karena isolated worktrees
- Parallel security audit: Agent 1 audit auth code, Agent 2 audit calculator inputs, Agent 3 audit external API calls
- Split large migration tasks: migrasi semua `localStorage` ke avatar-keyed scheme (`pkey()`) ke 9 game pages secara paralel

**FUTURE:**
- "Build Dunia-Emosi game" pipeline: Agent 1 (HTML/layout), Agent 2 (PixiJS logic), Agent 3 (test + QA) — sesuai dengan pola yang sudah disebut di user rules (`dispatch sonnet for execution`)
- Weekly automated code review: gascity spawns code-reviewer agents setiap Sunday untuk semua file yang berubah minggu itu
- Parallel article generation: tiga FF-series draft ditulis oleh tiga agents bersamaan

---

## 4. Installation

```bash
# Prerequisites
sudo apt-get install -y tmux jq

# Install gascity
go install github.com/gastownhall/gascity@latest

# Verify
gascity --version

# Initialize config in rz-work
cd /home/baguspermana7/rz-work
gascity init

# This creates city.toml — edit to define agents and tasks
```

---

## 5. Integrasi

| Tool rz-work | Cara Integrasi |
|---|---|
| Claude Code (`claude`) | Gascity spawns multiple `claude` instances, each in a separate tmux window |
| git worktrees | Each agent works on a dedicated branch/worktree — no merge conflicts during parallel work |
| Taskfile (go-task) | `task agents:run --config city.toml` — Task sebagai outer orchestrator, gascity sebagai inner agent manager |
| cc-connect | Monitor multi-agent progress via Telegram: cc-connect relays gascity status messages ke chat |
| Harness CI | Gascity bisa di-trigger dari Harness pipeline step untuk large automated refactors |

---

## 6. Contoh Penggunaan

```toml
# city.toml — multi-agent config untuk rz-work parallel refactor
[city]
name = "rz-refactor"
base_branch = "main"

[[agents]]
name = "calc-agent"
worktree = "worktrees/calc"
task = "Refactor all calculator pages to use dark mode toggle standard from CALCULATOR_PROMPT_STANDARD.md"
model = "claude-sonnet-4-6"

[[agents]]
name = "article-agent"
worktree = "worktrees/articles"
task = "Add 5 glossary terms per article to glossary.html with backlinks, articles 20-26"
model = "claude-sonnet-4-6"

[[agents]]
name = "security-agent"
worktree = "worktrees/security"
task = "Run security audit on all pages: check for XSS, hardcoded secrets, missing CSRF"
model = "claude-sonnet-4-6"
```

```bash
# Start all agents in parallel
gascity run --config city.toml

# Monitor via tmux
tmux attach -t gascity

# Check status
gascity status

# Merge completed agents
gascity merge --agent calc-agent
```

---

## 7. Batasan & Risiko

- **Repo is experimental / low activity**: `gastownhall/gascity` adalah project kecil yang mungkin tidak aktif di-maintain. Verify last commit date, issues, dan apakah API masih compatible dengan Claude Code versi terbaru sebelum depend.
- **Worktree disk usage**: Setiap agent butuh full worktree copy. Untuk rz-work yang besar, 3 agents = 3x disk usage. Pastikan ada ruang cukup di `/home`.
- **Merge conflicts tetap mungkin**: Walaupun worktrees terisolasi, jika dua agents edit file yang sama (mis. `script.js`), merge tetap butuh manual resolution.
- **tmux dependency**: Jika tidak familiar dengan tmux, debugging multi-agent sessions bisa membingungkan. Pelajari basic tmux navigation dulu.
- **Claude API cost multiplier**: 3 agents berjalan paralel = 3x token consumption. Monitor usage dan set spending limit di Anthropic console.
- **Tidak cocok untuk perubahan kecil**: Overhead setup gascity worth it hanya untuk task besar (50+ files, multi-session work). Untuk single-file edits, gunakan Claude Code biasa.
