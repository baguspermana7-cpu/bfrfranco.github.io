#!/usr/bin/env python3
"""sweep-manual-structure.py — the manual family's callouts stay a panel with one 1 px hairline.

Owner 2026-11-07 ("kenapa masih ada yang ai design slop"): the render scan (tools/audit-slop-render.mjs) found the
36 manual pages carrying a 2-3 px coloured left rail on .mn-hero/.mn-note/.mn-formula, a two-stop gradient hero and
8-9 px radii. The site sweep had recoloured them, not restructured them. In the CSS blocks of those four selectors
this drops any left/right rail wider than 1 px, flattens a gradient background to the surface token and caps the
radius at 4 px. Idempotent. --apply writes; --check exits 1 if any page would change.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SELS = ('.mn-hero', '.mn-note', '.mn-formula', '.mn-worked')
BLOCK = re.compile(r'([^{}]*)\{([^{}]*)\}')


def fix_body(body):
    body = re.sub(r'\s*border-(?:left|right)\s*:\s*(?:[2-9]|\d{2,})px[^;]*;', '', body)
    body = re.sub(r'background\s*:\s*linear-gradient\([^;]*\)\s*;', 'background: var(--mn-surface);', body)
    body = re.sub(r'border-radius\s*:\s*(?:[5-9]|\d{2,})px', 'border-radius: 4px', body)
    return body


def fix(css):
    def rep(m):
        sel = m.group(1)
        bare = re.sub(r'/\*.*?\*/', '', sel, flags=re.S)
        heads = [s.strip() for s in bare.split(',')]
        if any(h in SELS for h in heads):
            return sel + '{' + fix_body(m.group(2)) + '}'
        return m.group(0)
    return BLOCK.sub(rep, css)


def run(apply):
    changed = []
    for p in sorted((ROOT / 'manual').glob('*.html')):
        text = p.read_text(encoding='utf-8')
        new = re.sub(r'(<style[^>]*>)(.*?)(</style>)', lambda m: m.group(1) + fix(m.group(2)) + m.group(3), text, flags=re.S)
        if new != text:
            changed.append(p.name)
            if apply:
                p.write_text(new, encoding='utf-8')
    return changed


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    ch = run(apply)
    print(('wrote ' if apply else 'would change ') + f'{len(ch)} manual page(s)' + (': ' + ', '.join(ch[:8]) if ch else ''))
    sys.exit(1 if ('--check' in sys.argv and ch) else 0)
