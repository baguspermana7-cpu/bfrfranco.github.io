#!/usr/bin/env python3
"""Audit external CDN references for SRI (Sub-Resource Integrity).

Per review-v3 P2.1 and `docs/contracts/csp-plan.md` Phase 1:
every `<link>` and `<script>` that points at a third-party CDN MUST
declare an `integrity="sha384-..."` attribute and `crossorigin`.

Usage:
    python3 tools/audit-cdn-sri.py             # report only
    python3 tools/audit-cdn-sri.py --strict    # exit non-zero on missing SRI
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

# Domains we treat as third-party CDNs that MUST have SRI.
CDN_DOMAINS = [
    "cdnjs.cloudflare.com",
    "cdn.jsdelivr.net",
    "unpkg.com",
    "stackpath.bootstrapcdn.com",
]

# Known-safe CDN URLs that don't need SRI (data: URIs, same-origin, fonts).
SKIP_PATTERNS = [
    re.compile(r"^data:"),
    re.compile(r"https?://fonts\.googleapis\.com/"),  # Google Fonts dynamic CSS — no SRI by design
    re.compile(r"https?://fonts\.gstatic\.com/"),
    re.compile(r"https?://www\.googletagmanager\.com/"),  # GTM is dynamic
    re.compile(r"https?://www\.google-analytics\.com/"),
]


def is_cdn_url(url: str) -> bool:
    if any(p.search(url) for p in SKIP_PATTERNS):
        return False
    return any(domain in url for domain in CDN_DOMAINS)


def find_external_references(html: str) -> list[tuple[str, str, bool, bool]]:
    """Return list of (tag, url, has_integrity, has_crossorigin) tuples for CDN refs."""
    results: list[tuple[str, str, bool, bool]] = []

    # <link href="..." ... >
    for m in re.finditer(r"<link\s[^>]*>", html, re.IGNORECASE):
        tag = m.group(0)
        href_match = re.search(r'href=["\']([^"\']+)["\']', tag, re.IGNORECASE)
        if not href_match:
            continue
        url = href_match.group(1)
        if not is_cdn_url(url):
            continue
        has_integrity = "integrity=" in tag.lower()
        has_crossorigin = "crossorigin" in tag.lower()
        results.append(("link", url, has_integrity, has_crossorigin))

    # <script src="..." ... >
    for m in re.finditer(r"<script\s[^>]*\bsrc=[^>]*>", html, re.IGNORECASE):
        tag = m.group(0)
        src_match = re.search(r'src=["\']([^"\']+)["\']', tag, re.IGNORECASE)
        if not src_match:
            continue
        url = src_match.group(1)
        if not is_cdn_url(url):
            continue
        has_integrity = "integrity=" in tag.lower()
        has_crossorigin = "crossorigin" in tag.lower()
        results.append(("script", url, has_integrity, has_crossorigin))

    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true",
                        help="Exit non-zero on missing SRI.")
    args = parser.parse_args()

    print("=" * 68)
    print("CDN SRI audit — Sub-Resource Integrity coverage")
    print("=" * 68)

    files = sorted(REPO_ROOT.glob("*.html"))
    total_refs = 0
    missing_integrity = 0
    missing_crossorigin = 0
    pages_with_issues: dict[str, list[str]] = {}

    for path in files:
        try:
            html = path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            print(f"  WARN  cannot read {path.name}: {e}", file=sys.stderr)
            continue
        refs = find_external_references(html)
        for tag, url, has_int, has_cor in refs:
            total_refs += 1
            issues = []
            if not has_int:
                missing_integrity += 1
                issues.append("no integrity")
            if not has_cor:
                missing_crossorigin += 1
                issues.append("no crossorigin")
            if issues:
                pages_with_issues.setdefault(path.name, []).append(
                    f"{tag}: {url}  [{', '.join(issues)}]"
                )

    print()
    print(f"HTML files audited:        {len(files)}")
    print(f"CDN references found:      {total_refs}")
    print(f"Missing 'integrity':       {missing_integrity}")
    print(f"Missing 'crossorigin':     {missing_crossorigin}")
    print(f"Pages with issues:         {len(pages_with_issues)}")

    if pages_with_issues:
        print()
        print("Per-page findings (first 20 pages):")
        for i, (page, issues) in enumerate(sorted(pages_with_issues.items())[:20]):
            print(f"  [{page}]")
            for issue in issues[:3]:
                print(f"      {issue}")
            if len(issues) > 3:
                print(f"      ... +{len(issues) - 3} more on this page")
        if len(pages_with_issues) > 20:
            print(f"  ... +{len(pages_with_issues) - 20} more pages")
    else:
        print()
        print("✓ Every CDN reference has SRI integrity + crossorigin.")

    if args.strict and missing_integrity:
        print()
        print(f"STRICT FAIL: {missing_integrity} CDN reference(s) without SRI.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
