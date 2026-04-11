# Second Brain — Standardization Guide

> Version: 1.0 | Created: 2026-04-11
> Applies to: `/home/baguspermana7/rz-work/Apps/second brain/`

---

## 1. What Is Second Brain?

Second Brain is a dual-interface knowledge mapping system for the ResistanceZero website:

| Interface | Path | Purpose |
|---|---|---|
| Web App | `Apps/second brain/index.html` | Interactive vis.js knowledge graph, embeddable in website |
| Obsidian Vault | `obsidian-knowledge-vault/` | Local Markdown vault with bidirectional links for AI queries |

---

## 2. Web App Architecture

### File Structure
```
Apps/second brain/
├── index.html                    ← Single-file web app (vis.js network)
├── obsidian-knowledge-vault/     ← Obsidian vault (open as new vault)
│   ├── .obsidian/                ← Obsidian config (graph, workspace)
│   ├── 00-Hub/                   ← README, site architecture, tech stack
│   ├── 01-Articles/              ← All 26 articles
│   ├── 02-Calculators/           ← 7 calculators
│   ├── 03-Apps/                  ← Tools + DC MOC
│   ├── 04-Series/                ← Geopolitics + Future Forward
│   ├── 05-Standards/             ← TIA-942, Tier Advisor, LTC labs
│   ├── 06-Comparisons/           ← 10 head-to-head comparisons
│   └── 07-Reports/               ← Infographics + market reports
└── Documentation and standarization/
    ├── SECOND-BRAIN-STANDARD.md  ← This file
    ├── GRAPHIFY-PROTOCOL.md      ← AI token efficiency guide
    ├── NODE-REGISTRY.md          ← Complete node + edge registry
    └── OBSIDIAN-SETUP.md         ← How to open vault + plugins
```

### Node Categories & Colors

| Category | Color | Border | Description |
|---|---|---|---|
| `core` | `#c4b5fd` | `#8b5cf6` | Core navigation pages |
| `articles` | `#06b6d4` | `#0284c7` | 26 engineering articles |
| `calculators` | `#f59e0b` | `#d97706` | 7 interactive tools |
| `comparisons` | `#10b981` | `#059669` | 10 head-to-head pages |
| `reports` | `#ef4444` | `#dc2626` | Infographics + reports |
| `apps` | `#ec4899` | `#db2777` | Web apps + terminals |
| `series` | `#a78bfa` | `#7c3aed` | Named article series |
| `standards` | `#64748b` | `#475569` | Standards, labs, DC systems |

---

## 3. Adding New Nodes

When a new page/tool is added to rz-work, update **both** interfaces:

### Web App (`index.html`)

Add to `rawNodes` array:
```js
{
  id: 'unique-id',
  label: 'Display Name',
  group: 'articles',           // see category table above
  url: 'filename.html',        // relative to rz-work root
  desc: 'One-sentence description of this page.',
  tags: ['tag1', 'tag2'],
},
```

Add relationships to `rawEdges` array:
```js
{ from: 'parent-id', to: 'unique-id' },
```

### Obsidian Vault

Create `XX-Category/Node-Name.md`:
```markdown
# Node Name

> Related: [[parent-node]], [[sibling-node]]
> URL: `filename.html`

Description of this node.

## Connections
- [[related-node-1]] — reason for connection
- [[related-node-2]] — reason for connection

## Key Data
- Data point 1
- Data point 2
```

---

## 4. Navbar Integration

Second Brain is accessible via the **Insights dropdown** on `.nav-menu` pages:

```html
<li role="menuitem">
  <a href="Apps/second brain/index.html" style="color: #8b5cf6; font-weight: 600;">
    Second Brain
  </a>
</li>
```

Position: between "Future Forward" and the separator before "All Insights".

**Pages using `.nav-menu`** (must update manually or via script):
- index.html, articles.html, insights.html, dashboard.html
- article-1.html through article-26.html
- geopolitics*.html, future-forward.html
- Most non-calculator content pages

**Pages using `.nav-links`** (calculators — do NOT update in mass):
- pue-calculator.html, capex-calculator.html, opex-calculator.html
- roi-calculator.html, tco-calculator.html, carbon-footprint.html

---

## 5. Maintenance Schedule

| Trigger | Action |
|---|---|
| New article added | Add node to `rawNodes` + Obsidian file |
| New calculator added | Add node + edges to financial cluster |
| Data source updated | Update `07-Reports/` vault notes |
| Q2 2026 | Refresh CBRE H2 2025 + T&T 2026 DCCI data |

---

## 6. GitHub Repository

Obsidian config is NOT committed to git (add to `.gitignore` if needed).
Web app `index.html` IS committed and deployed via GitHub Pages.
