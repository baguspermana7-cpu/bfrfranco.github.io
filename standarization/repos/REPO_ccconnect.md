# REPO: chenhg5/cc-connect

**GitHub**: https://github.com/chenhg5/cc-connect  
**Type**: Claude Code Remote Control Bridge  
**Runtime**: Go binary, local machine  

---

## 1. What It Is

cc-connect adalah bridge lightweight yang menghubungkan Claude Code (AI coding agent yang berjalan di terminal lokal) dengan chat applications seperti Telegram, Slack, atau Discord. It acts as a relay: messages sent to your Telegram bot get forwarded to a running Claude Code session, and Claude's responses come back to the chat. No public IP, no server deployment — everything runs on your local machine.

---

## 2. Tech Stack

- **Language**: Go
- **Dependencies**: Minimal — uses chat platform webhooks/bots (Telegram Bot API, Slack Events API, Discord webhooks)
- **Runtime**: Single binary, runs alongside an active Claude Code session
- **Requirements**: Active `claude` session in terminal, bot token for chosen platform, internet connection
- **Config**: Environment variables or config file

---

## 3. Kegunaan untuk ResistanceZero

**NOW:**
- Kontrol `claude` dari HP via Telegram — berguna saat ingin trigger task rz-work (minify, serve, deploy) tanpa buka laptop
- Send command ke Claude Code dari Telegram: "run task minify and commit", lalu terima hasilnya di chat
- Review output dari long-running Python tools (`build-osm-dataset.py`) tanpa perlu ada di depan terminal
- Manfaatkan NemoClaw Telegram bot infrastruktur yang sudah ada (bot `@Moldbot#1`) — cc-connect bisa di-bind ke bot yang sama atau bot baru

**FUTURE:**
- Mobile-first deployment workflow: approve GitHub Pages deploy dari Telegram sebelum push
- Dapatkan notifikasi saat Harness CI pipeline selesai, langsung di Telegram
- Delegate task ringan ke Claude Code dari mana saja: "update sitemap.xml dengan URL terbaru"
- Pasangkan dengan multi-agent system (gascity) untuk monitoring status agents dari Telegram

---

## 4. Installation

```bash
# Option A: Install via Go
go install github.com/chenhg5/cc-connect@latest

# Option B: Download binary from GitHub Releases
# Check https://github.com/chenhg5/cc-connect/releases for latest version
wget https://github.com/chenhg5/cc-connect/releases/latest/download/cc-connect-linux-amd64 \
  -O ~/.local/bin/cc-connect
chmod +x ~/.local/bin/cc-connect

# Configure (example for Telegram)
export CC_PLATFORM=telegram
export CC_BOT_TOKEN=<your-telegram-bot-token>
export CC_ALLOWED_USERS=<your-telegram-user-id>

# Start bridge (must have active claude session)
cc-connect
```

---

## 5. Integrasi

| Tool rz-work | Cara Integrasi |
|---|---|
| NemoClaw Telegram bot (`@Moldbot#1`) | Pakai bot token yang sama atau buat bot terpisah; cc-connect listen di port lokal |
| Claude Code sessions | cc-connect inject commands ke stdin Claude Code session yang sedang berjalan |
| Taskfile (go-task) | Send `task minify` via Telegram → cc-connect → Claude Code → `task minify` runs locally |
| `~/.bashrc` TELEGRAM_BOT_TOKEN | Reuse env vars yang sudah ada untuk Telegram bot token |
| tmux sessions | cc-connect bisa target specific tmux pane where Claude Code is running |

---

## 6. Contoh Penggunaan

```bash
# Start cc-connect alongside Claude Code
# Terminal 1: start Claude Code
claude

# Terminal 2: start cc-connect bridge
CC_PLATFORM=telegram CC_BOT_TOKEN=$TELEGRAM_BOT_TOKEN cc-connect

# Now from Telegram, send to your bot:
# "run task pln:build"
# "what's the status of the last git commit?"
# "minify all CSS files in rz-work"
```

```bash
# Run as background service via systemd (optional)
cat > ~/.config/systemd/user/cc-connect.service << 'EOF'
[Unit]
Description=cc-connect Claude Code bridge
After=network.target

[Service]
Environment=CC_PLATFORM=telegram
EnvironmentFile=%h/.bashrc
ExecStart=%h/.local/bin/cc-connect
Restart=on-failure

[Install]
WantedBy=default.target
EOF

systemctl --user enable --now cc-connect
```

---

## 7. Batasan & Risiko

- **Security risk — CRITICAL**: cc-connect memberikan akses shell penuh ke mesin via chat. Wajib set `CC_ALLOWED_USERS` hanya untuk Telegram user ID kamu sendiri. Jangan expose ke grup atau orang lain. Treat ini setara dengan SSH access ke laptop.
- **Repo visibility**: Repo `chenhg5/cc-connect` adalah project kecil/eksperimental — verify aktif di-maintain sebelum depend terlalu dalam. Cek last commit date dan issue activity.
- **Claude Code session dependency**: Bridge tidak berguna tanpa active `claude` session. Jika Claude Code crash atau selesai, bridge juga berhenti.
- **Chat platform rate limits**: Telegram memiliki rate limit untuk bot API. Jangan kirim banyak commands berturut-turut dalam hitungan detik.
- **Tidak untuk multi-user**: Dirancang untuk satu user (developer) saja, bukan team collaboration tool.
