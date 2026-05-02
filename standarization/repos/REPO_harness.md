# REPO: harness/harness

**GitHub**: https://github.com/harness/harness  
**Type**: Open-source CI/CD + Git Hosting Platform  
**Runtime**: Docker (self-hosted), localhost:3000  

---

## 1. What It Is

Harness (open-source edition) adalah platform CI/CD + Git hosting yang bisa di-self-host. It combines a Gitea-compatible Git server, pipeline runner, and web UI into a single Docker deployment. Originally known as Drone CI, it has evolved into a full platform that handles code hosting, automated testing, build pipelines, and deployment triggers without requiring GitHub Actions or external CI services.

---

## 2. Tech Stack

- **Backend**: Go
- **Frontend**: React
- **Runtime**: Docker Compose — single `docker-compose up` starts Git server + CI runner + UI
- **Database**: SQLite (default, good for solo use) or PostgreSQL
- **Port**: 3000 (web UI + Git), configurable
- **Requirements**: Docker >= 24, 4 GB RAM minimum, port 3000 available

---

## 3. Kegunaan untuk ResistanceZero

**NOW:**
- Automate full deploy pipeline: push ke Harness Git → pipeline trigger → `task minify` → `git push origin main` ke GitHub Pages
- Replace manual build steps: setiap commit ke Harness repo otomatis run linting, minification, dan link checking
- Mirror rz-work repo ke local Harness instance sebagai backup + CI layer

**FUTURE:**
- **Obsidian sync pipeline**: vault update → Harness detects change → trigger WeKnora re-index
- **PLN dataset quarterly refresh**: pipeline terjadwal yang run `tools/build-osm-dataset.py` setiap Jan/Apr/Jul/Oct (complement ke scheduled routine yang sudah ada)
- **Multi-site deploy**: satu pipeline yang build Dunia-Emosi, rz-work, dan dcmoc secara paralel setelah merge ke main
- **Artifact storage**: simpan minified JS/CSS sebagai pipeline artifacts dengan versioning

---

## 4. Installation

```bash
# Create config directory
mkdir -p ~/Apps/harness && cd ~/Apps/harness

# Get docker-compose file
curl -O https://raw.githubusercontent.com/harness/harness/main/docker-compose.yml

# Configure ports and volumes (optional: edit docker-compose.yml)
# Default: port 3000, SQLite database

# Start Harness
docker compose up -d

# Access web UI
xdg-open http://localhost:3000

# Initial setup: create admin account via web UI wizard
# Register your rz-work repo as a new repository
```

---

## 5. Integrasi

| Tool rz-work | Cara Integrasi |
|---|---|
| Taskfile (go-task) | Pipeline steps call `task minify`, `task deploy`, etc. — Taskfile adalah canonical build interface |
| Python tools | `tools/build-osm-dataset.py` dijalankan sebagai pipeline step di Harness runner |
| GitHub Pages | Harness pipeline push ke `baguspermana7-cpu/bfrfranco.github.io` via git push dengan deploy key |
| WeKnora | Pipeline trigger: setelah vault files berubah, call WeKnora ingest API |
| `pln-osm-quarterly-refresh` cron | Harness bisa duplicate scheduled trigger ini sebagai fallback atau primary scheduler |

**Pipeline YAML example location**: `~/Apps/harness/pipelines/rz-deploy.yml`

---

## 6. Contoh Penggunaan

```yaml
# .harness/pipeline.yml — rz-work deploy pipeline
pipeline:
  name: rz-deploy
  identifier: rz_deploy
  stages:
    - stage:
        name: Build & Minify
        type: CI
        spec:
          steps:
            - step:
                name: Install deps
                type: Run
                spec:
                  command: |
                    npm install -g terser clean-css-cli
            - step:
                name: Minify assets
                type: Run
                spec:
                  command: task minify
            - step:
                name: Deploy to GitHub Pages
                type: Run
                spec:
                  command: task deploy
                  env:
                    GITHUB_TOKEN: <+secrets.getValue("github_token")>
```

```bash
# Trigger pipeline via API
curl -X POST http://localhost:3000/api/v1/repos/rz-work/hooks/trigger \
  -H "Authorization: Bearer $HARNESS_TOKEN" \
  -d '{"event": "push"}'
```

---

## 7. Batasan & Risiko

- **Resource heavy**: Harness Docker stack membutuhkan ~2–4 GB RAM secara idle. Di mesin yang sama dengan WeKnora + NemoClaw, bisa terjadi resource contention. Monitor dengan `docker stats`.
- **Overkill untuk solo project**: Untuk satu developer dengan manual deploy workflow yang sudah berjalan, ROI dari Harness baru terasa jika ada 3+ automated pipelines aktif. Pertimbangkan Taskfile saja untuk kebutuhan dasar.
- **Port 3000 conflict**: dcmoc Next.js dev server default juga port 3000. Salah satu harus diganti — Harness lebih mudah dikonfigurasi ulang.
- **Git hosting redundancy**: Jika sudah pakai GitHub sebagai canonical remote, menambah Harness Git server menambah satu lagi place to sync. Pertimbangkan Harness hanya sebagai CI runner (tanpa Git hosting).
- **Docker dependency**: Jika Docker daemon crash, seluruh CI pipeline berhenti. Bukan masalah untuk dev machine, tapi perlu diingat.
