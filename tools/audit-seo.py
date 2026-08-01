#!/usr/bin/env python3
"""
audit-seo.py — per-page SEO health check for resistancezero.com.
Walks all main HTML files and reports missing/short meta tags, canonical, OG, Twitter, JSON-LD.

Usage:
  python3 tools/audit-seo.py              # non-strict, always exits 0
  python3 tools/audit-seo.py --strict     # exits 1 on any REQUIRED tag missing
  python3 tools/audit-seo.py --json       # machine-readable JSON output
  python3 tools/audit-seo.py --file article-1.html  # check single file
"""

import os
import re
import sys
import json
import argparse

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = "https://resistancezero.com"

EXCLUDE_DIRS = {
    "node_modules", ".git", "archive", "dcmoc", "Dunia-Emosi", "Apps",
    "Automation", "Article", ".qa-screens", "embed", "prompts", "Data",
    "standarization", "tools", "js", "assets", "css", "images", "fonts",
    "games", "documentation", "scripts", "shared", "pokemondb_hd_alt2",
}

EXCLUDE_FILES = {
    "article-9-paper.html",
    "rz-ops-p7x3k9m.html",
    "google1b98e0817bd5aa88.html",
    "404.html",
}

REQUIRED = ["title", "meta_description", "canonical", "og_title", "og_description", "og_url", "og_type", "og_image"]
RECOMMENDED = ["twitter_card", "twitter_title", "twitter_description", "json_ld", "ai_content_declaration"]


def check_file(filepath):
    fname = os.path.basename(filepath)
    issues = {}

    try:
        with open(filepath, encoding="utf-8", errors="ignore") as fh:
            content = fh.read()
    except Exception as e:
        return {"error": str(e), "issues": {}, "warnings": {}}

    head_match = re.search(r'<head[^>]*>(.*?)</head>', content, re.DOTALL | re.IGNORECASE)
    head = head_match.group(1) if head_match else content[:5000]

    # Skip noindex pages — they're intentionally not for search engines so
    # missing meta tags isn't a real issue. Report STATUS=NOINDEX and bail.
    noindex_match = re.search(
        r'<meta[^>]+name=["\']robots["\'][^>]+content=["\'][^"\']*noindex',
        head, re.IGNORECASE
    )
    if noindex_match:
        return {"status": "NOINDEX", "issues": {}, "warnings": {}}

    errors = {}
    warnings = {}

    # <title>
    m = re.search(r'<title>(.*?)</title>', head, re.DOTALL | re.IGNORECASE)
    if not m:
        errors["title"] = "MISSING"
    else:
        t = m.group(1).strip()
        if len(t) < 30:
            warnings["title"] = f"SHORT ({len(t)} chars, want 30-60): {t!r}"
        elif len(t) > 60:
            warnings["title"] = f"LONG ({len(t)} chars, want 30-60): {t[:60]!r}..."

    # meta description
    # match the FULL attribute value: backreference the opening quote so an
    # apostrophe inside a double-quoted description (e.g. "Nvidia Rubin's …")
    # doesn't truncate it → false SHORT warnings (fixed 2026-08-01).
    m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=(?P<q>["\'])(?P<desc>.*?)(?P=q)', head, re.IGNORECASE)
    if not m:
        m = re.search(r'<meta[^>]+content=(?P<q>["\'])(?P<desc>.*?)(?P=q)[^>]+name=["\']description["\']', head, re.IGNORECASE)
    if not m:
        errors["meta_description"] = "MISSING"
    else:
        d = m.group("desc").strip()
        if len(d) < 120:
            warnings["meta_description"] = f"SHORT ({len(d)} chars, want 120-160)"
        elif len(d) > 160:
            warnings["meta_description"] = f"LONG ({len(d)} chars, want 120-160)"

    # canonical
    m = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\'](.*?)["\']', head, re.IGNORECASE)
    if not m:
        m = re.search(r'<link[^>]+href=["\'](.*?)["\'][^>]+rel=["\']canonical["\']', head, re.IGNORECASE)
    if not m:
        errors["canonical"] = "MISSING"
    else:
        url = m.group(1).strip()
        if not url.startswith("https://resistancezero.com"):
            warnings["canonical"] = f"URL does not start with site origin: {url!r}"

    # OG tags
    for og_tag in ["og:title", "og:description", "og:url", "og:type", "og:image"]:
        key = og_tag.replace(":", "_")
        m = re.search(rf'<meta[^>]+property=["\']og:{og_tag.split(":")[1]}["\'][^>]+content=["\'](.*?)["\']', head, re.IGNORECASE)
        if not m:
            m = re.search(rf'<meta[^>]+content=["\'](.*?)["\'][^>]+property=["\']og:{og_tag.split(":")[1]}["\']', head, re.IGNORECASE)
        if not m:
            errors[key] = "MISSING"

    # Twitter card
    m = re.search(r'<meta[^>]+name=["\']twitter:card["\'][^>]+content=["\'](.*?)["\']', head, re.IGNORECASE)
    if not m:
        m = re.search(r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']twitter:card["\']', head, re.IGNORECASE)
    if not m:
        warnings["twitter_card"] = "MISSING"

    for tw_tag in ["twitter:title", "twitter:description"]:
        key = tw_tag.replace(":", "_")
        m = re.search(rf'<meta[^>]+name=["\']twitter:{tw_tag.split(":")[1]}["\'][^>]+content=["\'](.*?)["\']', head, re.IGNORECASE)
        if not m:
            m = re.search(rf'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']twitter:{tw_tag.split(":")[1]}["\']', head, re.IGNORECASE)
        if not m:
            warnings[key] = "MISSING"

    # JSON-LD
    if not re.search(r'<script[^>]+type=["\']application/ld\+json["\']', content, re.IGNORECASE):
        warnings["json_ld"] = "MISSING"

    # ai-content-declaration
    if not re.search(r'ai-content-declaration', content, re.IGNORECASE):
        warnings["ai_content_declaration"] = "MISSING"

    return {"errors": errors, "warnings": warnings}


def walk_html_files():
    results = []
    for root, dirs, files in os.walk(SITE_ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]
        for fname in files:
            if not fname.endswith(".html"):
                continue
            if fname in EXCLUDE_FILES:
                continue
            filepath = os.path.join(root, fname)
            rel = os.path.relpath(filepath, SITE_ROOT)
            if os.sep in rel:
                continue
            results.append((fname, filepath))
    return sorted(results)


def main():
    parser = argparse.ArgumentParser(description="SEO audit for resistancezero.com")
    parser.add_argument("--strict", action="store_true", help="Exit 1 on any REQUIRED tag missing")
    parser.add_argument("--json", action="store_true", dest="json_out", help="JSON output")
    parser.add_argument("--file", help="Check a single file (basename or path)")
    args = parser.parse_args()

    if args.file:
        if os.path.isabs(args.file):
            filepath = args.file
            fname = os.path.basename(args.file)
        else:
            fname = args.file
            filepath = os.path.join(SITE_ROOT, args.file)
        files = [(fname, filepath)]
    else:
        files = walk_html_files()

    all_results = {}
    total_errors = 0
    total_warnings = 0

    for fname, filepath in files:
        result = check_file(filepath)
        all_results[fname] = result
        total_errors += len(result.get("errors", {}))
        total_warnings += len(result.get("warnings", {}))

    if args.json_out:
        print(json.dumps(all_results, indent=2))
    else:
        print(f"\n{'='*70}")
        print(f"SEO Audit — {SITE_URL}")
        print(f"{'='*70}")
        print(f"Pages checked: {len(files)}")
        print(f"Total ERRORS (required): {total_errors}")
        print(f"Total WARNINGS (recommended): {total_warnings}")
        print(f"{'='*70}\n")

        for fname, result in sorted(all_results.items()):
            errors = result.get("errors", {})
            warnings = result.get("warnings", {})
            if errors or warnings:
                status = "ERROR" if errors else "WARN"
                print(f"[{status}] {fname}")
                for tag, msg in errors.items():
                    print(f"  ERROR  {tag}: {msg}")
                for tag, msg in warnings.items():
                    print(f"  WARN   {tag}: {msg}")

        # Summary of clean pages
        clean = [f for f, r in all_results.items() if not r.get("errors") and not r.get("warnings")]
        print(f"\nClean pages (no issues): {len(clean)}/{len(files)}")

        pages_with_errors = [f for f, r in all_results.items() if r.get("errors")]
        if pages_with_errors:
            print(f"Pages with REQUIRED tag errors: {len(pages_with_errors)}")

    if args.strict and total_errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
