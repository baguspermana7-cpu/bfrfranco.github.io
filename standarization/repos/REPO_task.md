# REPO: go-task/task

**GitHub**: https://github.com/go-task/task  
**Type**: Task Runner / Build Tool  
**Runtime**: Single binary (Go), no runtime dependency  

---

## 1. What It Is

Task adalah modern replacement untuk Makefile yang menggunakan YAML (`Taskfile.yml`) sebagai format konfigurasi. It handles task dependencies, environment variables, file-change detection, and parallel execution with a syntax that is far more readable than Makefile. Used by projects ranging from solo developers to large open-source repos as a unified "run anything" entry point.

---

## 2. Tech Stack

- **Config format**: `Taskfile.yml` (YAML)
- **Runtime**: Single binary — no Go installation required on target machine
- **OS Support**: Linux, macOS, Windows
- **Dependencies**: None at runtime. Optional: `dotenv` support, shell variable expansion
- **Version**: v3.x (current stable)

---

## 3. Kegunaan untuk ResistanceZero

**NOW (paling langsung berguna):**
- Gantikan semua manual commands yang sering diketik: `python3 -m http.server 8081`, `terser script.js -o script.min.js`, `git push origin main`
- Buat standar `task build`, `task serve`, `task deploy` sebagai single source of truth untuk semua developer commands rz-work
- `task pln:build` — jalankan `tools/build-osm-dataset.py` dengan environment yang benar
- `task minify` — jalankan terser + cleancss secara paralel untuk semua JS/CSS

**FUTURE:**
- `task dunia-emosi:sync` — trigger deploy dari folder `Dunia-Emosi/`
- `task weknora:sync` — trigger WeKnora re-index setelah Obsidian vault update
- `task check:links` — jalankan link checker terhadap semua HTML pages
- CI integration: gunakan Taskfile sebagai canonical build script di Harness CI pipelines

---

## 4. Installation

```bash
# Install via official installer (no sudo needed, installs to ~/.local/bin)
sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b ~/.local/bin

# Verify installation
task --version

# Initialize Taskfile in rz-work root
cd /home/baguspermana7/rz-work
task --init
```

---

## 5. Integrasi

| Tool rz-work | Cara Integrasi |
|---|---|
| `build-osm-dataset.py` | `task pln:build` → `python3 tools/build-osm-dataset.py` |
| terser / cleancss | `task minify` → parallel terser + cleancss tasks |
| GitHub Pages deploy | `task deploy` → `git add -A && git commit && git push` dengan checks |
| WeKnora | `task weknora:sync` → curl POST ke WeKnora ingest API |
| `python3 -m http.server` | `task serve` → start server dengan configurable port via `PORT` env var |
| Cobra CLI | Cobra CLI bisa call `task` internally, atau keduanya hidup berdampingan |

---

## 6. Contoh Penggunaan

```yaml
# Taskfile.yml (letakkan di /home/baguspermana7/rz-work/Taskfile.yml)
version: '3'

vars:
  PORT: '8081'
  RZ_ROOT: '/home/baguspermana7/rz-work'

tasks:
  serve:
    desc: "Start local HTTP server"
    cmds:
      - python3 -m http.server {{.PORT}}
    dir: "{{.RZ_ROOT}}"

  minify:
    desc: "Minify JS and CSS in parallel"
    deps: [minify:js, minify:css]

  minify:js:
    cmds:
      - terser script.js -o script.min.js --compress --mangle

  minify:css:
    cmds:
      - cleancss styles.css -o styles.min.css

  pln:build:
    desc: "Rebuild PLN Java-Bali grid dataset"
    cmds:
      - python3 tools/build-osm-dataset.py
    dir: "{{.RZ_ROOT}}"

  deploy:
    desc: "Push to GitHub Pages"
    deps: [minify]
    cmds:
      - git add script.min.js styles.min.css
      - git commit -m "chore: minify assets"
      - git push origin main
```

```bash
# Usage examples
task serve
task minify
task pln:build
task deploy
task --list   # show all available tasks
```

---

## 7. Batasan & Risiko

- **YAML indentation sensitivity**: Typo di indentation Taskfile.yml bisa menyebabkan task tidak run tanpa error yang jelas. Selalu validate dengan `task --list` setelah edit.
- **No built-in file watching**: Task tidak auto-run saat file berubah. Perlu kombinasi dengan `entr` atau `fswatch` untuk watch mode.
- **Shell compatibility**: Default shell adalah `sh`, bukan `bash`. Bash-specific syntax (arrays, `[[...]]`) perlu explicit `sh: bash` di task definition.
- **Bukan CI system**: Task adalah task runner, bukan CI/CD. Untuk pipeline otomatis dengan triggers (push, schedule), tetap butuh Harness atau GitHub Actions.
- **Windows users**: Path separator bisa jadi masalah jika ada kolaborator di Windows. Gunakan forward slash dan hindari Windows-specific paths.
