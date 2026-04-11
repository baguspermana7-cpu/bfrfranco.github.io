# Obsidian Setup Guide

> How to open the ResistanceZero knowledge vault in Obsidian

---

## 1. Open as Vault

1. Install Obsidian from https://obsidian.md (free, all platforms)
2. Open Obsidian → **Open folder as vault**
3. Navigate to:
   ```
   /home/baguspermana7/rz-work/Apps/second brain/obsidian-knowledge-vault/
   ```
4. Click **Open**
5. Trust the vault when prompted

The vault opens with `00-Hub/README.md` as the starting note.

---

## 2. Enable Graph View

- Press `Ctrl+G` to open Graph View
- Colors are pre-configured in `.obsidian/graph.json`:
  - Cyan: Articles
  - Amber: Calculators
  - Pink: Apps
  - Purple: Series hubs
  - Green: Comparisons
  - Red: Reports
  - Slate: Standards
  - Violet: Core/Hub

---

## 3. Recommended Plugins

Install via Settings → Community Plugins:

| Plugin | Purpose | Priority |
|---|---|---|
| **Dataview** | Query notes like a database | HIGH |
| **Graph Analysis** | Enhanced graph with link prediction | HIGH |
| **Obsidian Git** | Sync vault with git | MEDIUM |
| **Kanban** | Track pending work (e.g., Share Results integration) | MEDIUM |
| **Templater** | Consistent new node creation | LOW |

---

## 4. Dataview Query Examples

After installing Dataview, use these queries:

**List all calculators:**
```dataview
LIST
FROM "02-Calculators"
SORT file.name ASC
```

**Find all nodes with "PFAS" in name:**
```dataview
LIST
FROM ""
WHERE contains(file.name, "PFAS") OR contains(file.tags, "pfas")
```

**Show connection counts (requires inline metadata):**
```dataview
TABLE length(file.outlinks) AS "Out Links", length(file.inlinks) AS "In Links"
FROM ""
SORT length(file.inlinks) DESC
LIMIT 10
```

---

## 5. Adding the Web App to Obsidian

To view the web app inside Obsidian:
1. Install **Surfing** plugin (web browser in Obsidian)
2. Create a note with:
   ```markdown
   [Open Web Graph](obsidian://open?vault=obsidian-knowledge-vault&file=00-Hub/README)
   ```
3. Or use the **iframe** plugin to embed:
   ```
   ![[http://localhost:8081/Apps/second brain/index.html]]
   ```
   (requires dev server running: `python3 serve.py`)

---

## 6. Vault Structure Quick Reference

```
obsidian-knowledge-vault/
├── .obsidian/          ← Obsidian config (DO NOT edit manually)
│   ├── app.json
│   ├── graph.json      ← Graph colors + physics settings
│   └── workspace.json  ← Default open file
│
├── 00-Hub/
│   ├── README.md       ← MASTER INDEX — start here
│   ├── Site-Architecture.md
│   └── Tech-Stack.md
│
├── 01-Articles/        ← article-1 through article-26 + geo + FF
├── 02-Calculators/     ← 7 calculators + share module
├── 03-Apps/            ← Finance Terminal, DCMOC, DCA, Second Brain
├── 04-Series/          ← Geopolitics + Future Forward series
├── 05-Standards/       ← TIA-942, Tier Advisor, LTC, DC systems
├── 06-Comparisons/     ← 10 comparison pages
└── 07-Reports/         ← Infographics + market reports
```
