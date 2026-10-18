#!/usr/bin/env python3
"""
sync-graph.py — Vault ↔ Second Brain auto-sync checker
Usage: python3 sync-graph.py [--fix] [--strict]

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
STRICT = '--strict' in sys.argv   # exit 1 on any issue, so a gate can run it

# ── --sync-journal: generate a node + edges for every journal page the curated graph lacks (2026-10-19) ──
# The curated nodes stay hand-written; the rest are GENERATED from data/journal.json between
# /* journal:auto:start */ … /* journal:auto:end */ markers in RAW and E, so one command keeps the graph whole.
if '--sync-journal' in sys.argv:
    with open(HTML, encoding='utf-8') as f:
        page = f.read()
    raw0 = re.search(r'const RAW=\[(.*?)\];', page, re.DOTALL)
    START, END = '/* journal:auto:start */', '/* journal:auto:end */'
    def strip_block(s):
        return re.sub(re.escape(START) + r'.*?' + re.escape(END) + r'\n?', '', s, flags=re.DOTALL)
    curated = strip_block(raw0.group(1))
    by_url = {m.group(2): m.group(1) for m in re.finditer(r"\{id:'([^']+)'.*?url:'([^']*)'", curated, re.DOTALL)}
    with open(os.path.join(RZ, 'data', 'journal.json'), encoding='utf-8') as f:
        jd = json.load(f)
    entries = sorted(jd['articles'] if isinstance(jd, dict) else jd, key=lambda a: a['url'])
    def esc(s):
        return str(s).replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ')
    def nid(a):
        return by_url.get(a['url']) or 'j-' + a['url'][:-5]
    def short(a):
        u = a['url'][:-5]
        tag = ('Art-' + u.split('-')[1]) if u.startswith('article-') else ('Geo-' + u.split('-')[1]) if u.startswith('geopolitics-') else u
        title = a['title'] if len(a['title']) <= 34 else a['title'][:33].rsplit(' ', 1)[0] + '…'
        return tag + ': ' + title
    nodes_out, edges_out = [], []
    for a in entries:
        if a['url'] in by_url:
            continue
        desc = (a.get('section') or '') + ' — ' + (a.get('excerpt') or '')
        desc = desc if len(desc) <= 180 else desc[:179].rsplit(' ', 1)[0] + '…'
        tags = [t for t in (a.get('topic'), a.get('series')) if t]
        nodes_out.append("  {id:'%s',label:'%s',group:'articles',url:'%s',desc:'%s',tags:[%s],path:'rz-work/%s'},"
                         % (nid(a), esc(short(a)), a['url'], esc(desc), ','.join("'%s'" % esc(x) for x in tags), a['url']))
        edges_out.append("['%s','arts']" % nid(a))
        if a.get('series') == 'ff':
            edges_out.append("['%s','ff']" % nid(a))
        if a['url'].startswith('geopolitics-'):
            edges_out.append("['%s','geo']" % nid(a))
    arts = [a for a in entries if a['url'].startswith('article-')]
    arts.sort(key=lambda a: int(a['url'][8:-5]))
    for x, y in zip(arts, arts[1:]):   # the reading order: each article links the next
        if not (x['url'] in by_url and y['url'] in by_url):
            edges_out.append("['%s','%s']" % (nid(x), nid(y)))
    block_n = START + '\n' + '\n'.join(nodes_out) + '\n  ' + END + '\n'
    block_e = START + '\n  ' + ','.join(edges_out) + ',\n  ' + END + '\n'
    new_raw = curated.rstrip() + '\n  ' + block_n
    page = page[:raw0.start(1)] + new_raw + page[raw0.end(1):]
    e0 = re.search(r'const E=\[(.*?)\];', page, re.DOTALL)
    new_e = strip_block(e0.group(1)).rstrip() + '\n  ' + block_e
    page = page[:e0.start(1)] + new_e + page[e0.end(1):]
    with open(HTML, 'w', encoding='utf-8') as f:
        f.write(page)
    print(f"journal:auto — {len(nodes_out)} generated node(s), {len(edges_out)} edge(s); curated nodes untouched")
    sys.exit(0)

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

# ── Check 5: every journal page is in the graph (2026-10-19) ─────────────────
# Checks 1-3 only test the graph against ITSELF, so they said "healthy" while articles 28-30 were missing.
# data/journal.json is generated from the pages on disk; each of its URLs must be some node's url.
print("\n━━━  5. Journal coverage (pages in data/journal.json with no node)  ━━━")
missing_pages = []
JOURNAL = os.path.join(RZ, 'data', 'journal.json')
if os.path.exists(JOURNAL):
    with open(JOURNAL, encoding='utf-8') as f:
        jd = json.load(f)
    entries = jd['articles'] if isinstance(jd, dict) else jd
    node_urls = {n[3].strip("'") for n in nodes if n[3] != 'null'}
    for a in entries:
        url = a.get('url', '')
        if url and url not in node_urls:
            missing_pages.append(url)
    for u in missing_pages:
        print(f"  ❌  {u}")
    if not missing_pages:
        print(f"  ✅  All {len(entries)} journal pages have a node")
else:
    print("  ⚠  data/journal.json not found — coverage not checked")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n━━━  Summary  ━━━")
print(f"  Dead URLs:     {len(dead)}")
print(f"  Isolated nodes:{len(isolated)}")
print(f"  Missing notes: {len(no_note)}")
print(f"  Missing pages: {len(missing_pages)}")

total_issues = len(dead) + len(isolated) + len(missing_pages)
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

if STRICT and total_issues:
    sys.exit(1)
