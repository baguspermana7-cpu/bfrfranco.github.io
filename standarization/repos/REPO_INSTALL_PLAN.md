# REPO Install Plan — ResistanceZero rz-work

**Dibuat**: 2026-05-02  
**Scope**: 6 repos untuk integrasi ke rz-work (`/home/baguspermana7/rz-work`)

---

## Priority Order (Most Immediately Useful First)

| # | Repo | Priority | Rationale |
|---|------|----------|-----------|
| 1 | **go-task/task** | CRITICAL — install sekarang | Langsung berguna hari ini. Replaces manual commands, zero learning curve, no Docker needed. |
| 2 | **spf13/cobra** | HIGH — install minggu ini | Bangun `rz` CLI sebagai wrapper Python tools. Berguna setelah Taskfile sudah jalan. |
| 3 | **chenhg5/cc-connect** | HIGH — setelah cobra | Mobile control via Telegram — infrastruktur bot sudah ada (`@Moldbot#1`). |
| 4 | **Tencent/WeKnora** | MEDIUM — saat butuh knowledge search | Berguna hanya jika Obsidian vault sudah cukup besar dan sering perlu dicari. Butuh Docker + 8 GB RAM. |
| 5 | **harness/harness** | LOW — fase CI/CD | Worth it hanya jika ada 3+ pipelines. Jangan install sampai Taskfile sudah mature. |
| 6 | **gastownhall/gascity** | EKSPERIMENTAL — verifikasi dulu | Repo kecil, mungkin tidak aktif. Verify maintenance status sebelum depend. |

---

## Prerequisites

### Go (required for cobra, task, cc-connect, gascity)
```bash
# Check if Go is installed
go version

# Install Go 1.21+ if not present
sudo apt-get update && sudo apt-get install -y golang-go

# Verify
go version
```

### Docker (required for WeKnora, Harness)
```bash
# Check if Docker is installed
docker --version
docker compose version

# Install Docker if not present
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### tmux + jq (required for gascity)
```bash
sudo apt-get install -y tmux jq
```

---

## Combined Installation Sequence (in order)

```bash
# ============================================================
# STEP 1: go-task/task (NO prerequisites beyond ~/.local/bin)
# ============================================================
sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b ~/.local/bin
task --version

# Initialize Taskfile in rz-work
cd /home/baguspermana7/rz-work
task --init
# Then edit Taskfile.yml — see REPO_task.md for full example


# ============================================================
# STEP 2: spf13/cobra (requires Go)
# ============================================================
go install github.com/spf13/cobra-cli@latest

# Scaffold rz CLI project
mkdir -p /home/baguspermana7/rz-work/tools/rz-cli
cd /home/baguspermana7/rz-work/tools/rz-cli
go mod init github.com/baguspermana7/rz-cli
cobra-cli init
cobra-cli add build
cobra-cli add serve
cobra-cli add deploy

# Build and install binary
go build -o ~/.local/bin/rz .
rz --help


# ============================================================
# STEP 3: chenhg5/cc-connect (requires Go or binary download)
# ============================================================
go install github.com/chenhg5/cc-connect@latest
# OR download binary:
# wget https://github.com/chenhg5/cc-connect/releases/latest/download/cc-connect-linux-amd64 \
#   -O ~/.local/bin/cc-connect && chmod +x ~/.local/bin/cc-connect

# Configure (reuse existing TELEGRAM_BOT_TOKEN from ~/.bashrc)
echo 'export CC_PLATFORM=telegram' >> ~/.bashrc
echo 'export CC_ALLOWED_USERS=<your-telegram-user-id>' >> ~/.bashrc
source ~/.bashrc

# Test bridge
cc-connect --help


# ============================================================
# STEP 4: Tencent/WeKnora (requires Docker)
# ============================================================
git clone https://github.com/Tencent/WeKnora.git ~/Apps/weknora
cd ~/Apps/weknora
cp .env.example .env
# Edit .env: set LLM_PROVIDER, API_KEY, PORT=8085 (avoid conflicts)
nano .env

docker compose up -d
# Access: http://localhost:8085


# ============================================================
# STEP 5: harness/harness (requires Docker, port 3000)
# ============================================================
# NOTE: Change dcmoc Next.js dev port first if using 3000
mkdir -p ~/Apps/harness && cd ~/Apps/harness
curl -O https://raw.githubusercontent.com/harness/harness/main/docker-compose.yml
# Edit docker-compose.yml if port 3000 conflicts with dcmoc
docker compose up -d
# Setup via web UI: http://localhost:3000


# ============================================================
# STEP 6: gastownhall/gascity (requires Go + tmux + jq)
# ============================================================
# VERIFY repo is active before installing:
# Check: https://github.com/gastownhall/gascity/commits/main
go install github.com/gastownhall/gascity@latest
cd /home/baguspermana7/rz-work
gascity init
# Edit city.toml — see REPO_gascity.md for full example
```

---

## Port Allocation (avoid conflicts)

| Service | Port | Notes |
|---------|------|-------|
| rz-work HTTP server | 8081 | `python3 -m http.server 8081` |
| NemoClaw Docker | 8080 | `openshell-cluster-nemoclaw` |
| dcmoc Next.js | 3001 | (change from default 3000 if Harness installed) |
| Harness CI/CD | 3000 | default |
| WeKnora | 8085 | set in .env (avoid 8080/8081) |
| Affiliate site | 8082 | existing |

---

## Which Require Docker

| Repo | Docker Required? |
|------|-----------------|
| go-task/task | NO — single binary |
| spf13/cobra | NO — compiled Go binary |
| chenhg5/cc-connect | NO — single binary |
| Tencent/WeKnora | YES — Docker Compose |
| harness/harness | YES — Docker Compose |
| gastownhall/gascity | NO — Go binary (uses tmux) |

---

## Roadmap Penggunaan untuk rz-work 2026

### Phase 1: Developer Ergonomics (Mei 2026)
**Target**: Tidak perlu lagi ketik perintah panjang secara manual.

- [ ] Install `go-task/task` dan buat `Taskfile.yml` lengkap di rz-work root
- [ ] Tasks prioritas: `serve`, `minify`, `deploy`, `pln:build`, `dunia-emosi:deploy`
- [ ] Scaffold `rz` CLI dengan cobra untuk wrapping Python tools
- [ ] Tambahkan `Taskfile.yml` ke git repository

**Outcome**: Semua daily commands bisa dijalankan dengan `task <name>` atau `rz <command>`

---

### Phase 2: Mobile Control (Juni 2026)
**Target**: Bisa trigger rz-work tasks dari HP via Telegram.

- [ ] Install `cc-connect` dan bind ke bot Telegram yang sudah ada
- [ ] Test basic commands: trigger `task minify`, check git status, view deploy log
- [ ] Buat allowlist commands yang aman untuk remote execution
- [ ] Document di standarization/NEMOCLAW_STANDARD.md

**Outcome**: Deploy dari HP tanpa buka laptop

---

### Phase 3: Knowledge Base (Juli–Agustus 2026)
**Target**: Obsidian vault bisa di-query via natural language.

- [ ] Install WeKnora via Docker Compose
- [ ] Index seluruh `obsidian-knowledge-vault/` + `standarization/`
- [ ] Set up `task weknora:sync` untuk re-index otomatis setelah vault update
- [ ] Evaluate apakah query quality cukup baik untuk daily use

**Outcome**: "rzknow 'apa standard auth untuk login modal?'" jawab dalam 2 detik

---

### Phase 4: CI/CD Automation (September 2026)
**Target**: Push ke git = auto-deploy tanpa manual steps.

- [ ] Install Harness dan setup local Git mirror
- [ ] Build pipeline: push → minify → link-check → deploy ke GitHub Pages
- [ ] Integrate PLN dataset quarterly rebuild sebagai scheduled pipeline
- [ ] Connect Obsidian vault change detection → WeKnora re-index

**Outcome**: Zero manual deploy steps

---

### Phase 5: Multi-Agent Development (Oktober 2026+)
**Target**: Parallel Claude Code agents untuk large refactors.

- [ ] Verify `gastownhall/gascity` masih aktif di-maintain
- [ ] Test dengan small task (3 agents, 10 files)
- [ ] Buat `city.toml` template untuk common rz-work tasks
- [ ] Define agent roles: layout agent, logic agent, QA agent (sesuai Dunia-Emosi pattern)

**Outcome**: Large refactors selesai 3x lebih cepat dengan parallel agents

---

## Quick Reference: Binary Locations After Install

```
~/.local/bin/task          # go-task
~/.local/bin/rz            # cobra CLI (custom built)
~/.local/bin/cc-connect    # cc-connect
~/go/bin/cobra-cli         # cobra scaffolding tool
~/go/bin/gascity           # gascity (after step 6)
~/Apps/weknora/            # WeKnora (Docker Compose)
~/Apps/harness/            # Harness (Docker Compose)
```

---

*Untuk detail tiap repo, lihat file `REPO_<name>.md` di folder ini.*
