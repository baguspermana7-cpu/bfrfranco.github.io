#!/usr/bin/env python3
"""
Audit Open Graph image quality for every public HTML page on resistancezero.com.

Usage:
    python3 tools/audit-og-images.py             # full report
    python3 tools/audit-og-images.py --strict    # exit 1 on any FAIL
    python3 tools/audit-og-images.py --json      # JSON output

Checks per page:
    1. og:image present
    2. og:image resolves to assets/og/<slug>.webp (not a generic fallback)
    3. og:image:width = 1200
    4. og:image:height = 630
    5. og:image:alt present and non-empty
    6. twitter:card = summary_large_image
    7. twitter:image present and matches og:image
    8. Local file exists at resolved path

Result codes:
    PASS         — all 8 checks pass
    FAIL         — one or more checks fail
    FALLBACK     — og:image points to generic asset (not per-page og/)
    SKIP         — page excluded from audit (non-public / embed-only)
"""

import argparse
import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
OG_DIR = REPO_ROOT / "assets" / "og"
SITE_BASE = "https://resistancezero.com"

# Pages excluded from audit — not public-facing content
EXCLUDED_SLUGS = {
    "google1b98e0817bd5aa88",  # Google verification file
    "rz-ops-p7x3k9m",         # Admin console (private)
    "future-forward-1",        # Redirect shim only
    "article-9-paper",         # Supplementary paper view
    "404",                     # Error page (no social sharing expected)
}

# Generic fallback images that trigger FALLBACK status
FALLBACK_IMAGES = {
    "/assets/profile-photo.jpg",
    "/assets/DashboardDC_80.jpg",
    "/assets/og-default.webp",
}

# Required values
REQUIRED_WIDTH = "1200"
REQUIRED_HEIGHT = "630"
REQUIRED_TWITTER_CARD = "summary_large_image"


# ---------------------------------------------------------------------------
# Parser helpers
# ---------------------------------------------------------------------------
def _get_meta(text: str, prop_attr: str, prop_val: str, content_attr: str = "content") -> str:
    """Extract a meta tag value by property/name attribute."""
    pattern = (
        rf'<meta\s+(?:[^>]*\s+)?{prop_attr}=["\']'
        rf'{re.escape(prop_val)}["\'][^>]*\s+{content_attr}=["\']([^"\']*)["\']'
        r'|'
        rf'<meta\s+(?:[^>]*\s+)?{content_attr}=["\']([^"\']*)["\'][^>]*\s+{prop_attr}=["\']'
        rf'{re.escape(prop_val)}["\']'
    )
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        return (m.group(1) or m.group(2) or "").strip()
    return ""


def _parse_og_tags(html_path: Path) -> dict:
    """Parse all required OG / Twitter meta tags from an HTML file."""
    try:
        text = html_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        return {"error": str(e)}

    # Extract only the <head> portion for speed
    head_m = re.search(r"<head[^>]*>(.*?)</head>", text, re.IGNORECASE | re.DOTALL)
    head = head_m.group(1) if head_m else text[:8000]

    return {
        "og_image": _get_meta(head, "property", "og:image"),
        "og_image_width": _get_meta(head, "property", "og:image:width"),
        "og_image_height": _get_meta(head, "property", "og:image:height"),
        "og_image_alt": _get_meta(head, "property", "og:image:alt"),
        "twitter_card": _get_meta(head, "name", "twitter:card"),
        "twitter_image": _get_meta(head, "name", "twitter:image"),
    }


def _resolve_local(url: str) -> Path | None:
    """Convert an absolute URL to a local repo path."""
    if url.startswith(SITE_BASE):
        rel = url[len(SITE_BASE):]
    elif url.startswith("/"):
        rel = url
    else:
        return None
    return REPO_ROOT / rel.lstrip("/")


def _is_fallback(url: str) -> bool:
    for fb in FALLBACK_IMAGES:
        if fb in url:
            return True
    return False


def _is_per_page_og(url: str, slug: str) -> bool:
    """Return True if URL points to assets/og/<slug>.webp."""
    return f"/assets/og/{slug}.webp" in url


# ---------------------------------------------------------------------------
# Audit logic
# ---------------------------------------------------------------------------
def audit_page(html_path: Path) -> dict:
    slug = html_path.stem
    tags = _parse_og_tags(html_path)

    if "error" in tags:
        return {"slug": slug, "status": "FAIL", "issues": [f"Read error: {tags['error']}"]}

    issues = []
    warnings = []

    og_image = tags["og_image"]
    twitter_card = tags["twitter_card"]
    twitter_image = tags["twitter_image"]
    og_width = tags["og_image_width"]
    og_height = tags["og_image_height"]
    og_alt = tags["og_image_alt"]

    # Check 1: og:image present
    if not og_image:
        issues.append("og:image missing")

    fallback = False
    per_page = False

    if og_image:
        fallback = _is_fallback(og_image)
        per_page = _is_per_page_og(og_image, slug)

        if fallback:
            issues.append(f"og:image is generic fallback: {og_image}")
        elif not per_page:
            issues.append(f"og:image does not point to assets/og/{slug}.webp: {og_image}")
        else:
            # Check 2: local file exists
            local = _resolve_local(og_image)
            if local and not local.exists():
                issues.append(f"File missing: {local.relative_to(REPO_ROOT)}")

    # Check 3: width
    if og_width != REQUIRED_WIDTH:
        issues.append(f"og:image:width is '{og_width}', expected '1200'")

    # Check 4: height
    if og_height != REQUIRED_HEIGHT:
        issues.append(f"og:image:height is '{og_height}', expected '630'")

    # Check 5: alt
    if not og_alt:
        issues.append("og:image:alt missing or empty")

    # Check 6: twitter:card
    if twitter_card != REQUIRED_TWITTER_CARD:
        issues.append(f"twitter:card is '{twitter_card}', expected 'summary_large_image'")

    # Check 7: twitter:image present
    if not twitter_image:
        issues.append("twitter:image missing")
    elif og_image and twitter_image != og_image:
        warnings.append(f"twitter:image '{twitter_image}' != og:image '{og_image}'")

    # Determine status
    if issues:
        status = "FAIL"
    else:
        status = "PASS"

    return {
        "slug": slug,
        "status": status,
        "issues": issues,
        "warnings": warnings,
        "og_image": og_image,
        "twitter_card": twitter_card,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Audit OG image quality for all public HTML pages."
    )
    parser.add_argument("--strict", action="store_true", help="Exit 1 on any FAIL")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    args = parser.parse_args()

    html_files = sorted(REPO_ROOT.glob("*.html"))
    results = []

    for html_path in html_files:
        slug = html_path.stem
        if slug in EXCLUDED_SLUGS:
            results.append({"slug": slug, "status": "SKIP", "issues": [], "warnings": []})
            continue
        results.append(audit_page(html_path))

    pass_count = sum(1 for r in results if r["status"] == "PASS")
    fail_count = sum(1 for r in results if r["status"] == "FAIL")
    skip_count = sum(1 for r in results if r["status"] == "SKIP")
    total = len(results)

    if args.json:
        print(json.dumps({"summary": {
            "total": total, "pass": pass_count, "fail": fail_count, "skip": skip_count
        }, "pages": results}, indent=2))
        if args.strict and fail_count > 0:
            sys.exit(1)
        return

    # Human-readable report
    print(f"\nOG Image Audit — resistancezero.com")
    print(f"{'=' * 60}")
    print(f"Total pages: {total}  |  PASS: {pass_count}  |  FAIL: {fail_count}  |  SKIP: {skip_count}")
    print()

    # Print FAILs first
    fails = [r for r in results if r["status"] == "FAIL"]
    if fails:
        print(f"FAILURES ({len(fails)}):")
        for r in fails:
            print(f"  FAIL  {r['slug']}")
            for issue in r["issues"]:
                print(f"        - {issue}")
            for warn in r.get("warnings", []):
                print(f"        ~ {warn}")
        print()

    # Then PASSes
    passes = [r for r in results if r["status"] == "PASS"]
    if passes:
        print(f"PASSING ({len(passes)}):")
        for r in passes:
            warn_flag = " [W]" if r.get("warnings") else ""
            print(f"  PASS  {r['slug']}{warn_flag}")
            for warn in r.get("warnings", []):
                print(f"        ~ {warn}")
        print()

    skips = [r for r in results if r["status"] == "SKIP"]
    if skips:
        print(f"SKIPPED ({len(skips)}): {', '.join(r['slug'] for r in skips)}")
        print()

    print(f"{'=' * 60}")
    if fail_count == 0:
        print("CLEAN — all public pages have valid per-page OG images.")
    else:
        print(f"ACTION REQUIRED — {fail_count} page(s) fail OG image checks.")

    if args.strict and fail_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
