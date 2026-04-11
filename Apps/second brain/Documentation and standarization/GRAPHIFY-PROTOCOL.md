# Graphify Protocol — AI Token Efficiency Guide

> Version: 1.0 | Created: 2026-04-11

---

## What Is Graphify?

Graphify is a **query protocol** for using the Second Brain vault to reduce token consumption when asking AI assistants about the rz-work codebase. Instead of loading full file contents, reference nodes by ID and ask about **relationships**.

---

## Core Principle

```
INEFFICIENT: "Read article-26.html and tell me about PFAS"
EFFICIENT:   "Node art-26 (PFAS) — what connects to cmp-fire and infog-sustain?"
```

By pre-indexing relationships in this vault, a single AI query can traverse the graph without re-reading source files.

---

## Node ID Reference

### Quick Lookup

| Prefix | Category | Example |
|---|---|---|
| `art-N` | Articles 1-26 | `art-26` = PFAS article |
| `geo-N` | Geopolitics series | `geo-1` = 72-Hour Warning |
| `calc-xxx` | Calculators | `calc-tco` = TCO calculator |
| `cmp-xxx` | Comparisons | `cmp-tier` = Tier 3 vs 4 |
| `infog-xxx` | Infographics | `infog-pue` = PUE infographic |
| `app-xxx` | Apps | `app-finance` = Finance Terminal |
| `sys-xxx` | DC Systems | `sys-chiller` = Chiller SCADA |

### Highly Connected Nodes (Impact Analysis)

Changing these affects the most downstream nodes:

1. **`index`** → affects 7 nodes (all core nav)
2. **`articles`** → affects 30+ nodes (all articles)
3. **`dashboard`** → affects 7 nodes (all calculators)
4. **`calc-pue`** → upstream of `cmp-cool`, `cmp-pue`, `infog-pue`
5. **`calc-capex`** → upstream of `calc-opex`, `calc-roi`, `calc-tco`, `infog-cost`

---

## Query Templates

### Cross-Reference Query
```
Using the graph index:
Node [ID-A] connects to Node [ID-B].
Source: [Folder/File-A]
Documentation: [Folder/File-B]
What is the relationship and where is it represented in the Obsidian graph?
```

### Impact Analysis Query
```
If I change [node-id] (file: [filename]):
- What nodes have inbound edges from [node-id]?
- What nodes have outbound edges to [node-id]?
- Which categories are affected?
Answer using graph nodes only.
```

### Efficiency Query
```
[Question about the codebase]
Constraints: Answer using node IDs, avoid reading source files.
Reference vault: /home/baguspermana7/rz-work/Apps/second brain/obsidian-knowledge-vault/
```

---

## Relationship Types

| Edge Type | Meaning | Example |
|---|---|---|
| `belongs_to` | Content belongs to a hub | `art-24` → `ff-hub` |
| `references` | Page references another | `infog-pue` → `calc-pue` |
| `financial_cluster` | Financial tools chain | `calc-capex` → `calc-opex` → `calc-roi` |
| `compares` | Comparison page vs topic | `cmp-tier` → `tier-advisor` |
| `part_of` | Feature belongs to system | `calc-pue` → `dashboard` |

---

## Reducing Token Usage

1. **Reference hub files first** — `00-Hub/README.md` has all node IDs
2. **Ask about edges, not content** — "what connects to X?" not "what does X contain?"
3. **Use node IDs in follow-up queries** — prevents AI from re-searching
4. **Batch related queries** — "Tell me about nodes: art-26, cmp-fire, infog-sustain"

---

## Updating the Index

When new content is added:
1. Add node to `rawNodes` in `index.html`
2. Add edges to `rawEdges` in `index.html`
3. Create vault note in appropriate folder
4. Update `00-Hub/README.md` counts
5. Update this protocol if new node prefix added
