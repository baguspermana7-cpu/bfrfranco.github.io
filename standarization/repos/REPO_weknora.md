# REPO: Tencent/WeKnora

**GitHub**: https://github.com/Tencent/WeKnora  
**Type**: LLM Knowledge Base System  
**Runtime**: Docker Compose  

---

## 1. What It Is

WeKnora adalah sistem knowledge base berbasis LLM dari Tencent yang menggabungkan tiga mode: Wiki (structured browsing), RAG Q&A (retrieval-augmented generation), dan Knowledge Graph (entity/relationship mapping). It ingests Markdown files, PDFs, and web pages — then makes them queryable via natural language. Designed for teams that want a self-hosted "ChatGPT over your own docs" without external SaaS dependency.

---

## 2. Tech Stack

- **Backend**: Python (FastAPI), LangChain, Chroma / Milvus (vector DB)
- **Frontend**: Vue.js
- **Runtime**: Docker Compose (all services containerized)
- **LLM**: Configurable — supports OpenAI API, local Ollama, or Azure OpenAI
- **Dependencies**: Docker >= 24, Docker Compose v2, 8 GB RAM minimum

---

## 3. Kegunaan untuk ResistanceZero

**NOW:**
- Mount seluruh isi `Apps/second brain/obsidian-knowledge-vault/` sebagai knowledge source, lalu query via natural language ("apa pelajaran dari G13 modal bug?")
- Index semua file di `standarization/` (AUTH_STANDARD.md, TOOLTIP_STANDARD.md, dsb.) agar bisa di-query tanpa buka file satu per satu
- Gunakan Wiki Mode untuk membrowse artikel rz-work yang sudah publish

**FUTURE:**
- Auto-sync vault setiap hari via cron: Obsidian vault → WeKnora index → queryable via web UI
- Expose WeKnora sebagai internal search backend untuk `rz-ops` admin console
- Build knowledge graph dari relasi antar artikel (FF-1, FF-2, Art-26) untuk visualisasi di `glossary.html`

---

## 4. Installation

```bash
# Prerequisites: Docker + Docker Compose v2
git clone https://github.com/Tencent/WeKnora.git ~/Apps/weknora
cd ~/Apps/weknora

# Copy and edit config
cp .env.example .env
nano .env  # set LLM provider, API key, port

# Start all services
docker compose up -d

# Access UI
xdg-open http://localhost:8080
```

---

## 5. Integrasi

| Tool rz-work | Cara Integrasi |
|---|---|
| Obsidian vault | Mount vault path sebagai volume read-only di `docker-compose.yml` |
| Python tooling (`process-images.py`) | POST request ke WeKnora API setelah proses selesai — auto-log ke knowledge base |
| GitHub Pages deploy | Tidak terhubung langsung; WeKnora adalah internal dev tool saja |
| Taskfile (go-task) | `task weknora:sync` — shell task yang trigger re-index setelah vault update |

---

## 6. Contoh Penggunaan

```bash
# 1. Sync Obsidian vault ke WeKnora (manual)
curl -X POST http://localhost:8080/api/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{"path": "/home/baguspermana7/Apps/second brain/obsidian-knowledge-vault/"}'

# 2. Query via RAG API
curl -X POST http://localhost:8080/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the auth standard for login modals?"}'

# 3. Query via CLI (after setting alias)
alias rzknow='curl -s -X POST http://localhost:8080/api/v1/query -H "Content-Type: application/json" -d'
rzknow '{"question": "PLN Java grid topology rules"}'
```

---

## 7. Batasan & Risiko

- **Memory-heavy**: Chroma/Milvus + LLM inference membutuhkan 8–16 GB RAM. Jangan jalankan bersamaan dengan Docker containers lain (NemoClaw, Harness) di mesin yang sama tanpa cek resource.
- **LLM cost**: Jika pakai OpenAI API, setiap re-index atau query ada biaya token. Gunakan Ollama (local) untuk dev/testing.
- **Not for production public site**: WeKnora adalah internal tool — jangan expose ke internet tanpa auth layer. Tidak cocok sebagai search engine untuk resistancezero.com.
- **Obsidian vault path dengan spasi**: Path `Apps/second brain/` mengandung spasi — selalu quote path di docker volume config.
- **Stale index**: WeKnora tidak auto-watch file changes. Harus trigger re-index manual atau via cron setelah vault update.
