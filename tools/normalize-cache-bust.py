#!/usr/bin/env python3
"""v2.19.0 — one shared asset, one cache-bust token.

Reports (default) or repairs (--apply) `?v=` drift on real `<script src=>` and
`<link href=>` tags, never on documentation prose.

WHY THIS WAS REWRITTEN
----------------------
The v1.10.12 version hardcoded ``NEW_BUST = "2026-05-09-v1"`` and always wrote,
with no argument parsing at all — so ``--check`` was accepted silently and the
tool rewrote 294 tokens across 155 files, reverting every cache-bust bump made
since May, ``index.html``'s ``styles-index.min.css?v=2026-09-06-slop`` included.
A normalizer that walks tokens BACKWARDS is a regression generator: the stale
`.min` twin it is supposed to prevent is exactly what it causes.

Two rules follow from that:

* the target token is the NEWEST one already in the tree for that asset, chosen
  by how the tokens sort, never a constant baked into this file;
* writing requires ``--apply``. ``--check`` is the default and exits 1 on drift
  so a gate can call it.
"""
import argparse
import glob
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Assets served to more than one page. One token each, or a fix reaches only
# some of the pages that load it.
NORMALIZE_TARGETS = {
    'styles.min.css',
    'styles-index.min.css',
    'styles.css',
    'styles-index.css',
    'script.min.js',
    'script.js',
    'auth.js',
    'rz-engine.js',
}

TAG = re.compile(r'\b(src|href)="([^"?]+)\?v=([^"]+)"', re.IGNORECASE)


def scan(pages):
    """{asset: {token: [file, ...]}} across every tag that loads a shared asset."""
    seen = {}
    for path in pages:
        content = path.read_text(encoding='utf-8')
        for _attr, ref, token in TAG.findall(content):
            name = ref.split('/')[-1]
            if name not in NORMALIZE_TARGETS:
                continue
            seen.setdefault(name, {}).setdefault(token, []).append(path)
    return seen


def newest(tokens):
    """The token to converge on.

    Tokens are date-led (`2026-09-06-slop`, `20260908-editorial`), so the digits
    order them. Comparing on the digit run alone keeps `2026-09-06-slop` ahead of
    `2026-05-09-v1` whatever the suffix says, and a token carrying no digits at
    all sorts last so it never wins by accident.
    """
    def key(token):
        digits = ''.join(re.findall(r'\d', token))
        return (len(digits) > 0, digits, token)
    return sorted(tokens, key=key)[-1]


def rewrite(content, asset, token):
    def sub(m):
        attr, ref, current = m.group(1), m.group(2), m.group(3)
        if ref.split('/')[-1] != asset or current == token:
            return m.group(0)
        return f'{attr}="{ref}?v={token}"'
    return TAG.sub(sub, content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true',
                        help='write the repair; without it nothing is modified')
    # --check is what every ship gate on this site types, and the v1.10.12 tool ACCEPTED it while
    # writing 294 tokens backwards. Reporting is already the default, so this flag changes nothing —
    # it exists so the word a caller types is a word this tool answers to rather than an error or,
    # worse, a silent write. Naming it and refusing --check --apply keeps both readings honest.
    parser.add_argument('--check', action='store_true',
                        help='report drift and exit 1 on any (the default; accepted explicitly)')
    args = parser.parse_args()
    if args.check and args.apply:
        parser.error('--check reports and --apply writes: pick one')

    pages = sorted(Path(p) for p in glob.glob(str(ROOT / '*.html')))
    seen = scan(pages)

    drift = {a: t for a, t in seen.items() if len(t) > 1}
    if not drift:
        print(f'CACHE-BUST — CLEAN. {len(seen)} shared asset(s), one token each '
              f'across {len(pages)} root pages.')
        return 0

    written = 0
    for asset, tokens in sorted(drift.items()):
        target = newest(tokens)
        print(f'\n{asset}: {len(tokens)} different tokens — converge on {target}')
        for token, files in sorted(tokens.items()):
            if token == target:
                continue
            print(f'    {token}  ({len(files)} file(s)): '
                  + ', '.join(f.name for f in files[:4])
                  + (' …' if len(files) > 4 else ''))
        if args.apply:
            for token, files in tokens.items():
                if token == target:
                    continue
                for path in files:
                    path.write_text(rewrite(path.read_text(encoding='utf-8'), asset, target),
                                    encoding='utf-8')
                    written += 1

    if args.apply:
        print(f'\nRepaired {written} file reference(s). Re-run to confirm CLEAN.')
        return 0
    print('\nDrift only reported. Re-run with --apply to converge on the newest token.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
