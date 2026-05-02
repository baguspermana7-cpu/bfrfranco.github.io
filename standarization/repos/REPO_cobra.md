# REPO: spf13/cobra

**GitHub**: https://github.com/spf13/cobra  
**Type**: Go CLI Framework Library  
**Runtime**: Go 1.21+  

---

## 1. What It Is

Cobra adalah Go library paling populer untuk membangun command-line applications, digunakan oleh kubectl, GitHub CLI (`gh`), Hugo, dan Terraform. It provides a structured pattern for defining commands, subcommands, flags, and help text. Think of it as the skeleton that turns a collection of Go functions into a polished, documented CLI tool with auto-complete and `--help` generation.

---

## 2. Tech Stack

- **Language**: Go 1.21+
- **Dependencies**: `github.com/spf13/pflag` (POSIX flag parsing), `github.com/spf13/viper` (optional config management)
- **Runtime**: Compiles to single static binary — no runtime dependency on target machine
- **Companion tool**: `cobra-cli` scaffolding generator

---

## 3. Kegunaan untuk ResistanceZero

**NOW:**
- Bangun `rz` CLI yang menjadi unified entry point untuk semua Python tools di rz-work:
  - `rz build pln` — run `tools/build-osm-dataset.py`
  - `rz minify` — run terser + cleancss
  - `rz serve` — start `python3 -m http.server 8081`
  - `rz deploy` — push ke GitHub Pages
- Lebih ergonomis dari raw shell scripts karena ada `--help`, flag validation, dan error messages

**FUTURE:**
- `rz article new --title "FF-4" --series future-forward` — scaffold HTML article dari template
- `rz check links` — crawl semua HTML files dan report broken links
- `rz calc validate` — run linting/validation terhadap semua calculator pages
- Distribute single binary ke kolaborator tanpa perlu install Python environment

---

## 4. Installation

```bash
# Install Go first (if not installed)
sudo apt-get install -y golang-go

# Install cobra-cli scaffolding tool
go install github.com/spf13/cobra-cli@latest

# Scaffold new CLI project
mkdir ~/rz-work/tools/rz-cli && cd ~/rz-work/tools/rz-cli
go mod init github.com/baguspermana7/rz-cli
cobra-cli init

# Add subcommands
cobra-cli add build
cobra-cli add serve
cobra-cli add deploy
```

---

## 5. Integrasi

| Tool rz-work | Cara Integrasi |
|---|---|
| Python tools (`build-osm-dataset.py`) | `cmd.RunE` calls `exec.Command("python3", "tools/build-osm-dataset.py")` |
| Taskfile (go-task) | Cobra dan Task bisa dipakai bersama — Task untuk dev orchestration, Cobra untuk distributable binary |
| `process-images.py` | `rz images process --input assets/` wraps Python script dengan path validation |
| GitHub Pages deploy | `rz deploy` wraps `git push origin main` dengan pre-deploy checks |

---

## 6. Contoh Penggunaan

```go
// cmd/serve.go — rz serve command
var serveCmd = &cobra.Command{
    Use:   "serve",
    Short: "Start local HTTP server at port 8081",
    RunE: func(cmd *cobra.Command, args []string) error {
        port, _ := cmd.Flags().GetString("port")
        return exec.Command("python3", "-m", "http.server", port).Run()
    },
}

func init() {
    rootCmd.AddCommand(serveCmd)
    serveCmd.Flags().StringP("port", "p", "8081", "Port to serve on")
}
```

```bash
# Build and use the CLI
cd ~/rz-work/tools/rz-cli
go build -o ~/.local/bin/rz .

# Usage
rz serve --port 8081
rz build pln --verbose
rz deploy --dry-run
```

---

## 7. Batasan & Risiko

- **Overkill untuk satu orang**: Jika rz-work hanya dikelola sendiri, Taskfile (`go-task`) sudah cukup untuk orchestration. Cobra worth it hanya jika ada rencana mendistribusikan binary ke orang lain atau ingin CLI yang sangat polished.
- **Maintenance overhead**: CLI Go perlu di-compile ulang setiap ada perubahan logic. Python scripts lebih cepat untuk iterasi.
- **Tidak menggantikan Python tools**: Cobra adalah wrapper/orchestrator — tidak menggantikan `build-osm-dataset.py` atau `process-images.py`. Tetap butuh Python environment.
- **Binary size**: Compiled Go binary ~5–10 MB untuk project kecil. Tidak cocok jika ingin distribusi via GitHub Pages (file statis).
