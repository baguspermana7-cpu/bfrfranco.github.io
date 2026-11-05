#!/usr/bin/env python3
"""test-cx-handbook.py — the published Cx field manual is complete, linked and clean.

  C1  one page per published chapter + the index (count from data/cx-handbook/chapters.json)
  C2  every manifest figure appears exactly once, as <figure id="Fnn-n">, on its own chapter's page
  C3  every prose "Fnn-n" reference (outside the figure blocks) is a link whose target id exists:
      "#Fnn-n" on the same page, or "<page>#Fnn-n" on the page that holds the figure
  C4  zero hits of the sensitive-term list in cx-handbook/ and data/cx-handbook/
      (word match, case-insensitive: microsoft, msft, interview*, candi, ranjith, whatsapp, confidential)

    python3 tools/test-cx-handbook.py [--root DIR]     # DIR defaults to the repository root
Exit 1 on any failure.
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(sys.argv[sys.argv.index('--root') + 1]) if '--root' in sys.argv else Path(__file__).resolve().parent.parent
PAGES = ROOT / 'cx-handbook'
SRC = ROOT / 'data' / 'cx-handbook'
SENSITIVE = re.compile(r'\b(microsoft|msft|interview\w*|candi|ranjith|whatsapp|confidential)\b|case_ledger|working files|research/R[FN]-\d+|field_r01', re.I)
FIGREF = re.compile(r'\bF\d{2}-\d+\b')


class Refs(HTMLParser):
    """Collect ids, and every figure-id text occurrence with the href of the <a> it sits in."""

    def __init__(self, fig_ids):
        super().__init__(convert_charrefs=True)
        self.fig_ids, self.ids, self.figures, self.refs = fig_ids, [], [], []
        self.href, self.in_fig, self.skip = [], 0, 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.append(a['id'])
        if tag == 'figure':
            self.in_fig += 1
            self.figures.append(a.get('id'))
        elif tag == 'a':
            self.href.append(a.get('href'))
        elif tag in ('script', 'style', 'head'):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag == 'figure':
            self.in_fig -= 1
        elif tag == 'a' and self.href:
            self.href.pop()
        elif tag in ('script', 'style', 'head'):
            self.skip -= 1

    def handle_data(self, data):
        if self.in_fig or self.skip:
            return
        for m in FIGREF.finditer(data):
            if m.group(0) in self.fig_ids:
                self.refs.append((m.group(0), self.href[-1] if self.href else None))


def main():
    fails = []
    spec = json.loads((SRC / 'chapters.json').read_text(encoding='utf-8'))
    figs = json.loads((SRC / 'figures_manifest.json').read_text(encoding='utf-8'))['figures']
    fig_ids = {f['id'] for f in figs}
    chapter_ids = [c['id'] for c in spec['chapters']]
    pages = sorted(PAGES.glob('*.html'))
    by_ch = {p.name[:2]: p for p in pages if re.match(r'\d{2}-', p.name)}

    # C1
    want = len(chapter_ids) + 1
    missing = [c for c in chapter_ids if c not in by_ch]
    ok1 = len(pages) == want and not missing and (PAGES / 'index.html').exists()
    print(f'  {"✓" if ok1 else "✗"} C1 pages: {len(pages)} = {len(chapter_ids)} chapters + 1 index (expected {want}); missing chapters: {missing or "none"}')
    if not ok1:
        fails.append('C1')

    parsed = {}
    for p in pages:
        r = Refs(fig_ids)
        r.feed(p.read_text(encoding='utf-8'))
        parsed[p.name] = r

    # C2
    seen = {}
    for name, r in parsed.items():
        for fid in r.figures:
            seen.setdefault(fid, []).append(name)
    bad2 = []
    for f in figs:
        where = seen.get(f['id'], [])
        own = by_ch.get(f['chapter'])
        if len(where) != 1 or not own or where[0] != own.name or parsed[own.name].ids.count(f['id']) != 1:
            bad2.append(f'{f["id"]} -> {where or "absent"}')
    ok2 = not bad2
    print(f'  {"✓" if ok2 else "✗"} C2 figures: {len(figs) - len(bad2)}/{len(figs)} placed exactly once on their chapter page'
          + (f'; e.g. {bad2[:3]}' if bad2 else ''))
    if not ok2:
        fails.append('C2')

    # C3
    total, bad3 = 0, []
    for name, r in parsed.items():
        for fid, href in r.refs:
            total += 1
            if not href or '#' not in href:
                bad3.append(f'{name}: {fid} not linked')
                continue
            page, _, frag = href.partition('#')
            target = parsed.get(page or name)
            if frag != fid or target is None or fid not in target.figures:
                bad3.append(f'{name}: {fid} -> {href} does not resolve')
    ok3 = not bad3
    print(f'  {"✓" if ok3 else "✗"} C3 prose figure references: {total - len(bad3)}/{total} link to an existing figure id'
          + (f'; e.g. {bad3[:3]}' if bad3 else ''))
    if not ok3:
        fails.append('C3')

    # C4
    hits = []
    for base in (PAGES, SRC):
        for p in sorted(base.rglob('*')):
            if p.is_file() and p.suffix in ('.html', '.md', '.svg', '.json'):
                for m in SENSITIVE.finditer(p.read_text(encoding='utf-8')):
                    hits.append(f'{p.relative_to(ROOT)}: {m.group(0)}')
    ok4 = not hits
    print(f'  {"✓" if ok4 else "✗"} C4 sensitive terms: {len(hits)} hits in cx-handbook/ + data/cx-handbook/'
          + (f'; e.g. {hits[:3]}' if hits else ''))
    if not ok4:
        fails.append('C4')

    print(('FAIL — ' + ', '.join(fails)) if fails else 'PASS — 4/4')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
