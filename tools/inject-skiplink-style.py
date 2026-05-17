#!/usr/bin/env python3
"""inject-skiplink-style.py — guarantee the accessibility skip-link is
visually-hidden-until-focus on EVERY page, consistently.

`tools/inject-skip-link.py` added `<a class="skip-link">Skip to main
content</a>` to 101 pages. The sr-only-until-focus CSS for `.skip-link`
lives in `styles.css` / `styles-index.css` — but ~36 standalone pages
(calculators, virtual labs, PLN grid, datahall, workbench, …) load
NEITHER global stylesheet, so on those pages the link rendered as a plain
visible blue link at the top-left (user: *"ini kenapa ada link tulisan
skip to main content. ini masih tidak konsisten"*).

This injects ONE idempotent `<style id="rz-skiplink-v1">` block —
**byte-identical to the canonical rule in `styles.css`** so behaviour is
consistent site-wide — before the document's first (structural) `</head>`.

Idempotent: skips a file already containing `id="rz-skiplink-v1"` or a
real `.skip-link {` rule.

USAGE
-----
    python3 tools/inject-skiplink-style.py [files...]
    python3 tools/inject-skiplink-style.py --dry-run [files...]
"""
from __future__ import annotations

import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SENTINEL = 'id="rz-skiplink-v1"'

# Mirrors styles.css lines 6-26 exactly (consistency is the whole point).
BLOCK = """<style id="rz-skiplink-v1">
.skip-link{position:absolute;top:-50px;left:0;background:#1e3a5f;color:#fff;padding:10px 20px;text-decoration:none;font-weight:600;font-size:.9rem;z-index:10000;border-radius:0 0 8px 0;transition:top .2s ease}
.skip-link:focus{top:0}
[data-theme="dark"] .skip-link{background:#60a5fa;color:#0f172a}
</style>
"""


def inject(fname: str, dry: bool) -> str:
    path = os.path.join(ROOT, fname)
    with open(path, "r", encoding="utf-8") as fh:
        html = fh.read()
    if SENTINEL in html or re.search(r"\.skip-link\s*\{", html):
        return f"skip {fname}: already styled"
    i = html.find("</head>")
    if i == -1:
        return f"SKIP {fname}: no </head>"
    new = html[:i] + BLOCK + html[i:]
    if dry:
        return f"DRY  {fname}: would inject canonical .skip-link style"
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(new)
    return f"ADD  {fname}: canonical .skip-link sr-only style injected ✓"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("files", nargs="+")
    args = ap.parse_args()
    for f in args.files:
        print(inject(f, args.dry_run))
    return 0


if __name__ == "__main__":
    sys.exit(main())
