#!/usr/bin/env python3
"""apply-tool-register.py: put the hub calculators on the TOOL register (css/rz-tool.css).

The calculator template carried its own chrome: a navy page, a teal or cyan accent per page,
rainbow nav links, glass panels, a Fraunces display face (via css/rz-calc-editorial.css and a
Google Fonts request) and cyan floating buttons. A computed scan of what a visitor sees found a
navy cast on every one of them (pue 74, tco 81, capex 71 ... elements). The hub itself is
graphite + one amber + Plex Sans; css/rz-tool.css re-points the template's tokens to that and
outranks the pages' pinned !important colours. This tool wires each page to it, idempotently:

  W1  <html ... data-rz-register="tool">   (replaces editorial / adds the attribute)
  W2  css/rz-calc-editorial.css link        removed (its rules are scoped to "editorial")
  W3  Fraunces in a Google Fonts URL        family dropped from the request (the face is banned)
  W4  css/rz-tool.css link                  added as the last stylesheet in <head>

Run:  python3 tools/apply-tool-register.py            (dry run: what would change per page)
      python3 tools/apply-tool-register.py --apply    (rewrite)
      python3 tools/apply-tool-register.py --check    (exit 1 if any page is not wired)
"""
import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The calculator-template family on datacenter-solutions.html. Cockpits (instrument register)
# and the maps are a separate phase.
PAGES = [
    'capex-calculator.html', 'opex-calculator.html', 'pue-calculator.html', 'roi-calculator.html',
    'tco-calculator.html', 'tier-advisor.html', 'carbon-footprint.html', 'cx-calculator.html',
    'spares-readiness-calculator.html', 'rfs-readiness-workbench.html', 'fire-calculator.html',
    'fire-checklist.html', 'tia-942-checklist.html',
    # explorer pages (release R1 of the hub-tools refit: no inputs / toolbar / results; tools/refit_shell/explorer.py)
    'cdu-hub.html', 'compare-air-vs-liquid-cooling.html', 'compare-raised-floor-vs-slab.html',
    'pln-sumatra-grid.html', 'network-visualization-hub.html', 'ai-engineering-maintenance.html',
]

TOOL_LINK = '<link rel="stylesheet" href="css/rz-tool.css?v=0">'
HTML_TAG = re.compile(r'<html\b[^>]*>', re.I)
EDITORIAL_LINK = re.compile(r'[ \t]*<link[^>]*css/rz-calc-editorial\.css[^>]*>[ \t]*\n?', re.I)
FRAUNCES = re.compile(r'family=Fraunces[^&"\']*&')


def wire(src):
    out, hits = src, []
    tag = HTML_TAG.search(out).group(0)
    if 'data-rz-register="tool"' not in tag:
        new = re.sub(r'\sdata-rz-register="[a-z]+"', '', tag)
        new = new[:-1] + ' data-rz-register="tool">'
        out = out.replace(tag, new, 1)
        hits.append('W1')
    out, n = EDITORIAL_LINK.subn('', out)
    if n:
        hits.append('W2')
    out, n = FRAUNCES.subn('', out)
    if n:
        hits.append('W3')
    if 'css/rz-tool.css' not in out:
        i = out.lower().index('</head>')
        out = out[:i] + '    ' + TOOL_LINK + '\n' + out[i:]
        hits.append('W4')
    return out, hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    pending = 0
    for page in PAGES:
        path = os.path.join(ROOT, page)
        with open(path, encoding='utf-8') as fh:
            src = fh.read()
        out, hits = wire(src)
        if not hits:
            continue
        pending += 1
        print(f'{page:36s} {" ".join(hits)}')
        if args.apply:
            with open(path, 'w', encoding='utf-8') as fh:
                fh.write(out)
    if args.check and pending:
        print(f'FAIL: {pending} page(s) not on the tool register; run with --apply')
        return 1
    print(f'{"applied" if args.apply else "pending"}: {pending} of {len(PAGES)} page(s)'
          if pending else f'PASS: all {len(PAGES)} calculator pages on the tool register')
    return 0


if __name__ == '__main__':
    sys.exit(main())
