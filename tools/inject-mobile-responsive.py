#!/usr/bin/env python3
"""inject-mobile-responsive.py — add the canonical v1.8.0 mobile-responsive
rules into a page's REAL <head> (never a JS string).

The original v1.8.x patch tools matched a ``</style>``/``</head>`` that was
actually inside a PDF-builder JS string and spliced their CSS there,
breaking ~33 pages (see v1.19.0). After that regression was reverted, the
affected pages legitimately need the mobile-responsive CSS — but in the
correct place: a real ``<style>`` block in ``<head>``.

This injects ONE idempotent ``<style id="rz-mobile-v18">`` block right
before the document's first ``</head>`` (the structural head close, which
always precedes the body and any inline PDF-builder ``<script>``). The
block satisfies every checkpoint in ``tools/audit-mobile-responsive.py``
(media-768, body overflow-x, img max-width, nav collapse, footer collapse,
v1.8.0 marker, 44px tap targets).

Idempotent: skips a file that already contains ``id="rz-mobile-v18"``.

USAGE
-----
    python3 tools/inject-mobile-responsive.py [files...]
    python3 tools/inject-mobile-responsive.py --dry-run [files...]
"""
from __future__ import annotations

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SENTINEL = 'id="rz-mobile-v18"'

BLOCK = """<style id="rz-mobile-v18">
/* v1.8.0 — mobile responsive patch */
@media (max-width: 768px) {
  html, body { overflow-x: hidden; max-width: 100vw; }
  img, picture, video { max-width: 100%; height: auto; display: block; }
  .nav-menu, .nav-links { display: none; }
  .footer-grid { grid-template-columns: 1fr; gap: 1.25rem; padding: 1rem; }
  button, a.btn, [role="button"] { min-height: 44px; }
}
</style>
"""


def inject(fname: str, dry: bool) -> str:
    path = os.path.join(ROOT, fname)
    with open(path, "r", encoding="utf-8") as fh:
        html = fh.read()
    if SENTINEL in html:
        return f"skip {fname}: already has rz-mobile-v18"
    i = html.find("</head>")
    if i == -1:
        return f"SKIP {fname}: no </head>"
    # the FIRST </head> is the structural head close (head precedes body
    # and every inline PDF-builder <script>), so this is never a JS string
    new = html[:i] + BLOCK + html[i:]
    if dry:
        return f"DRY  {fname}: would insert canonical block before </head>"
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(new)
    return f"ADD  {fname}: canonical mobile-responsive <style> injected ✓"


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
