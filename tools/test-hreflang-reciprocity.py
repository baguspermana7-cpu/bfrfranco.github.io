#!/usr/bin/env python3
"""test-hreflang-reciprocity.py — hreflang alternates must be reciprocal (audit G4).

H1  every page's hreflang alternate to another site page is returned: the target lists this page back
H2  the page's own-language hreflang URL equals its canonical (index.html: '/', never '/index.html')
P1  one author: every schema.org jobTitle on the site is identical, and the Person nodes of index/tools/articles carry
    @id https://resistancezero.com/#person (audit G6)
Pages: the EN/ID pairs index, articles, glossary and their id/ twins. Exit 1 on any finding.
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://resistancezero.com'
PAGES = ['index.html', 'articles.html', 'glossary.html', 'id/index.html', 'id/artikel.html', 'id/glosarium.html']


def head(page):
    return (ROOT / page).read_text(encoding='utf-8').split('</head>')[0]


def page_of(url):
    path = url[len(SITE):] if url.startswith(SITE) else None
    if path is None:
        return None
    path = path.lstrip('/')
    return path + 'index.html' if path == '' or path.endswith('/') else path


def alts(page):
    h = head(page)
    out = {}
    for m in re.finditer(r'<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"', h):
        out[m.group(1)] = m.group(2)
    canon = re.search(r'<link rel="canonical" href="([^"]+)"', h)
    return out, canon.group(1) if canon else None


bad = []
for p in PAGES:
    a, canon = alts(p)
    lang = 'id' if p.startswith('id/') else 'en'
    if a.get(lang) != canon:
        bad.append(f'H2 {p}: hreflang {lang}={a.get(lang)} != canonical {canon}')
    other = 'en' if lang == 'id' else 'id'
    if other not in a:
        bad.append(f'H1 {p}: no hreflang={other} alternate')
        continue
    tp = page_of(a[other])
    if not tp or not (ROOT / tp).exists():
        bad.append(f'H1 {p}: hreflang {other} target {a[other]} is not a page')
        continue
    ta, _ = alts(tp) if tp in PAGES else ({}, None)
    back = ta.get(lang)
    if page_of(back or '') != p:
        bad.append(f'H1 {p}: target {tp} does not list {lang} alternate back (has {back})')
titles = {}
for f in ROOT.glob('**/*.html'):
    if any(x in f.parts for x in ('node_modules', 'Article', 'standarization', 'Apps', 'Data', 'dcmoc', 'games', 'Dunia-Emosi')):
        continue
    for m in re.finditer(r'"jobTitle"\s*:\s*"([^"]*)"', f.read_text(encoding='utf-8', errors='replace')):
        titles.setdefault(m.group(1), []).append(f.name)
if len(titles) > 1:
    bad.append('P1 jobTitle varies: ' + '; '.join(f'{k!r} x{len(v)} ({v[0]})' for k, v in titles.items()))
for f in ('index.html', 'tools.html', 'articles.html'):
    if '"@id": "https://resistancezero.com/#person"' not in (ROOT / f).read_text(encoding='utf-8').replace('"@id":"', '"@id": "'):
        bad.append(f'P1 {f}: Person node has no @id #person')
for b in bad:
    print('FAIL', b)
print(('FAIL' if bad else 'PASS') + f' hreflang reciprocity + author identity: {len(bad)} finding(s) over {len(PAGES)} pages')
sys.exit(1 if bad else 0)
