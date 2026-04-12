#!/usr/bin/env python3
"""
sync-graph.py — Vault ↔ Second Brain auto-sync checker
Usage: python3 sync-graph.py [--fix]

Reads index.html RAW node array and cross-checks against:
1. Obsidian vault .md files (missing vault notes for existing nodes)
2. HTML files existence (dead links in RAW nodes)
3. Edge connectivity (nodes with zero edges = isolated)

Run from: rz-work/Apps/second brain/
"""
import os, re, sys, json

BASE = os.path.dirname(os.path.abspath(__file__))
RZ   = os.path.abspath(os.path.join(BASE, '../../'))
VAULT = os.path.join(BASE, 'obsidian-knowledge-vault')
HTML  = os.path.join(BASE, 'index.html')

FIX_MODE = '--fix' in sys.argv

# ── Parse RAW nodes from index.html ──────────────────────────────────────────
with open(HTML, encoding='utf-8') as f:
    src = f.read()

raw_block = re.search(r'const RAW=\[(.*?)\];', src, re.DOTALL)
if not raw_block:
    print("❌  Could not find RAW array in index.html"); sys.exit(1)

nodes = re.findall(
    r'\{id:\'([^\']+)\'.*?label:\'([^\']+)\'.*?group:\'([^\']+)\'.*?url:(null|\'[^\']*\').*?desc:\'([^\']*?)\'',
    raw_block.group(1), re.DOTALL
)
edges_block = re.search(r'const E=\[(.*?)\];', src, re.DOTALL)
edge_pairs = re.findall(r"\['([^']+)','([^']+)'\]", edges_block.group(1)) if edges_block else []

print(f"\n📊  Second Brain Graph Sync Report")
print(f"    {len(nodes)} nodes  ·  {len(edge_pairs)} edges\n")

# ── Check 1: Dead URLs ────────────────────────────────────────────────────────
print("━━━  1. Dead URLs (node URL file doesn't exist on disk)  ━━━")
dead = []
for nid, label, group, url, desc in nodes:
    if url == 'null' or url.startswith("'http"):
        continue
    url_clean = url.strip("'")
    full_path = os.path.join(RZ, url_clean)
    if not os.path.exists(full_path):
        dead.append((nid, label, url_clean))

if dead:
    for nid, label, url_clean in dead:
        print(f"  ⚠️  [{nid}] {label}\n       → {url_clean}")
else:
    print("  ✅  All URLs valid")

# ── Check 2: Isolated nodes (degree 0) ───────────────────────────────────────
print("\n━━━  2. Isolated nodes (no edges)  ━━━")
node_ids = {n[0] for n in nodes}
connected = set()
for a, b in edge_pairs:
    connected.add(a); connected.add(b)
isolated = node_ids - connected
if isolated:
    for nid in sorted(isolated):
        label = next((n[1] for n in nodes if n[0]==nid), nid)
        group = next((n[2] for n in nodes if n[0]==nid), '?')
        print(f"  🔴  [{nid}] {label}  ({group})")
else:
    print("  ✅  All nodes have at least one edge")

# ── Check 3: Vault notes vs nodes ────────────────────────────────────────────
print("\n━━━  3. Vault coverage (nodes missing an Obsidian note)  ━━━")
# Collect all vault .md filenames (without extension, lowercased)
vault_files = set()
for root, dirs, files in os.walk(VAULT):
    for f in files:
        if f.endswith('.md'):
            vault_files.add(f[:-3].lower().replace(' ', '-'))

# Group nodes by their group for hub-level checking
hub_groups = {'articles', 'comparisons', 'calculators', 'reports', 'standards', 'apps', 'series', 'core'}
no_note = []
for nid, label, group, url, desc in nodes:
    if group in ('memory', 'projects'):
        continue  # these are local-only, no vault note expected
    # Check if a vault note exists with similar name
    label_slug = re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-')
    nid_slug = nid.lower().replace('_', '-')
    has_note = any(
        label_slug in vf or nid_slug in vf or vf in label_slug
        for vf in vault_files
    )
    if not has_note:
        no_note.append((nid, label, group))

if no_note:
    print(f"  {len(no_note)} nodes without a dedicated vault note:")
    for nid, label, group in no_note[:20]:
        print(f"  📝  [{nid}] {label}  ({group})")
    if len(no_note) > 20:
        print(f"  … and {len(no_note)-20} more")
else:
    print("  ✅  All nodes have corresponding vault notes")

# ── Check 4: Hub pages in vault ──────────────────────────────────────────────
print("\n━━━  4. Vault hub files  ━━━")
expected_hubs = [
    '00-Hub/README.md', '00-Hub/Site-Architecture.md', '00-Hub/Tech-Stack.md',
    '01-Articles/Articles-Hub.md', '02-Calculators/Calculators-Hub.md',
    '03-Apps/Apps-Hub.md', '04-Series/Series-Hub.md',
    '05-Standards/Standards-Hub.md', '06-Comparisons/Comparisons-Hub.md',
    '07-Reports/Reports-Hub.md',
]
for hub in expected_hubs:
    path = os.path.join(VAULT, hub)
    status = '✅' if os.path.exists(path) else '❌ MISSING'
    print(f"  {status}  {hub}")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n━━━  Summary  ━━━")
print(f"  Dead URLs:     {len(dead)}")
print(f"  Isolated nodes:{len(isolated)}")
print(f"  Missing notes: {len(no_note)}")

total_issues = len(dead) + len(isolated)
if total_issues == 0:
    print("\n  🟢  Graph is healthy — all links valid, no orphans\n")
else:
    print(f"\n  🟡  {total_issues} issue(s) found. Run with --fix to generate stub notes.\n")

# ── Fix mode: generate stub vault notes for nodes missing them ───────────────
if FIX_MODE and no_note:
    print("━━━  Fix mode: generating stub vault notes  ━━━")
    for nid, label, group in no_note:
        url = next((n[3].strip("'") for n in nodes if n[0]==nid), '')
        desc_txt = next((n[4] for n in nodes if n[0]==nid), '')
        stub = f"""---
id: {nid}
label: {label}
group: {group}
url: {url}
tags: []
last_updated: 2026-04-11
---

# {label}

> {desc_txt}

## Notes

_Add details here._

## Connections

_Add `[[wikilinks]]` to related nodes._
"""
        # Place in correct hub folder
        folder_map = {
            'articles':'01-Articles','calculators':'02-Calculators',
            'apps':'03-Apps','series':'04-Series','standards':'05-Standards',
            'comparisons':'06-Comparisons','reports':'07-Reports','core':'00-Hub',
        }
        folder = os.path.join(VAULT, folder_map.get(group, '00-Hub'))
        os.makedirs(folder, exist_ok=True)
        fname = os.path.join(folder, f"{nid}.md")
        if not os.path.exists(fname):
            with open(fname, 'w', encoding='utf-8') as f:
                f.write(stub)
            print(f"  📄  Created {folder_map.get(group,'00-Hub')}/{nid}.md")
        else:
            print(f"  ⏭️  Skipped {nid}.md (already exists)")
    print()
