#!/usr/bin/env python3
"""
build-sitemap.py — regenerate sitemap.xml from filesystem walk.
Idempotent. Run with --apply to write sitemap.xml, --dry-run to print only.
Usage:
  python3 tools/build-sitemap.py --apply
  python3 tools/build-sitemap.py --dry-run
"""

import os
import re
import subprocess
import argparse
from datetime import datetime, timezone

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = "https://resistancezero.com"
OUTPUT_FILE = os.path.join(SITE_ROOT, "sitemap.xml")

# Directories to exclude (relative to SITE_ROOT)
EXCLUDE_DIRS = {
    "node_modules", ".git", "archive", "dcmoc", "Dunia-Emosi", "Apps",
    "Automation", "Article", ".qa-screens", "embed", "prompts", "Data",
    "standarization", "tools", "js", "assets", "css", "images", "fonts",
    "games", "documentation", "scripts", "shared", "pokemondb_hd_alt2",
}

# Subdirectories to INCLUDE (relative to SITE_ROOT) with their URL prefix
INCLUDE_SUBDIRS = {
    "id": "id",
    "manual": "manual",
    "prd": "prd",
}

# Files to exclude
EXCLUDE_FILES = {
    "article-9-paper.html",  # print variant with noindex
    "rz-ops-p7x3k9m.html",   # admin console
    "google1b98e0817bd5aa88.html",  # google verification
    "changelog.html",        # noindex — changelog is internal; excluded per Item 26 (v1.9.3)
    "404.html",              # 404 error page should never be in sitemap
}

# Priority and changefreq by path pattern
PRIORITY_MAP = [
    ({"index.html", "datacenter-solutions.html", "datahallAI.html",
      "dc-conventional.html", "dc-market-tracker.html"}, 1.0, "weekly"),
    ({"articles.html", "glossary.html", "insights.html",
      "dc-market-tracker.html"}, 0.9, "weekly"),
    ({"pue-calculator.html", "capex-calculator.html", "opex-calculator.html",
      "roi-calculator.html", "tco-calculator.html", "cx-calculator.html",
      "carbon-footprint.html"}, 0.85, "monthly"),
    ({"future-forward.html", "geopolitics.html"}, 0.85, "monthly"),
]

PRIORITY_PATTERNS = [
    (re.compile(r'^article-\d+\.html$'), 0.8, "monthly"),
    (re.compile(r'^FF-\d+\.html$'), 0.8, "monthly"),
    (re.compile(r'^future-forward.*\.html$'), 0.8, "monthly"),
    (re.compile(r'^geopolitics.*\.html$'), 0.8, "monthly"),
    (re.compile(r'^compare-.*\.html$'), 0.75, "monthly"),
    (re.compile(r'^(tia-942|tier-advisor|ltc-|pln-java|rfs-|asean-|infographic-|chiller-|pillar-|standards-|ict|fire-|fuel-|water-|EPMS|dashboard|datahall\.html)'), 0.75, "monthly"),
    (re.compile(r'^(privacy|terms|cookies|404)\.html$'), 0.4, "yearly"),
]


def get_priority_changefreq(filename):
    """Determine priority and changefreq for a given filename."""
    for fileset, priority, freq in PRIORITY_MAP:
        if filename in fileset:
            return priority, freq
    for pattern, priority, freq in PRIORITY_PATTERNS:
        if pattern.match(filename):
            return priority, freq
    return 0.7, "monthly"


def get_lastmod(filepath):
    """Get lastmod from git log, fall back to file mtime."""
    try:
        result = subprocess.run(
            ["git", "-C", SITE_ROOT, "log", "-1", "--format=%cI", "--", filepath],
            capture_output=True, text=True, timeout=10
        )
        ts = result.stdout.strip()
        if ts:
            # Normalize to date only for cleaner output
            return ts[:10]
    except Exception:
        pass
    # Fallback to file mtime
    mtime = os.path.getmtime(filepath)
    return datetime.fromtimestamp(mtime, tz=timezone.utc).strftime("%Y-%m-%d")


def get_canonical(filepath):
    """Extract canonical URL from file, or construct from path."""
    try:
        with open(filepath, encoding="utf-8", errors="ignore") as fh:
            head = fh.read(3000)
        m = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']', head, re.IGNORECASE)
        if not m:
            m = re.search(r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']canonical["\']', head, re.IGNORECASE)
        if m:
            url = m.group(1).strip()
            if url.startswith("https://resistancezero.com"):
                return url
    except Exception:
        pass
    return None


def is_noindex(filepath):
    """Check if page has noindex robots meta."""
    try:
        with open(filepath, encoding="utf-8", errors="ignore") as fh:
            head = fh.read(3000)
        m = re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']+)["\']', head, re.IGNORECASE)
        if not m:
            m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']robots["\']', head, re.IGNORECASE)
        if m and "noindex" in m.group(1).lower():
            return True
    except Exception:
        pass
    return False


def get_priority_changefreq_subdir(subdir, fname):
    """Determine priority/changefreq for subdir pages."""
    if subdir == "id":
        if fname == "index.html":
            return 0.85, "weekly"
        return 0.8, "monthly"
    if subdir == "manual":
        if fname == "index.html":
            return 0.8, "weekly"
        return 0.7, "monthly"
    if subdir == "prd":
        if fname == "index.html":
            return 0.8, "weekly"
        return 0.75, "monthly"
    return 0.7, "monthly"


def walk_html_files():
    """Walk SITE_ROOT for HTML files, applying exclusion rules."""
    results = []

    # Walk root-level files
    for fname in os.listdir(SITE_ROOT):
        if not fname.endswith(".html"):
            continue
        if fname in EXCLUDE_FILES:
            continue
        filepath = os.path.join(SITE_ROOT, fname)
        if not os.path.isfile(filepath):
            continue

        if is_noindex(filepath):
            print(f"  [skip noindex] {fname}")
            continue

        canonical = get_canonical(filepath)
        if canonical:
            url = canonical
        else:
            url = f"{SITE_URL}/{fname}"

        lastmod = get_lastmod(filepath)
        priority, changefreq = get_priority_changefreq(fname)
        results.append((url, lastmod, changefreq, priority, fname))

    # Walk included subdirectories
    for subdir, url_prefix in INCLUDE_SUBDIRS.items():
        subdir_path = os.path.join(SITE_ROOT, subdir)
        if not os.path.isdir(subdir_path):
            continue
        for fname in sorted(os.listdir(subdir_path)):
            if not fname.endswith(".html"):
                continue
            filepath = os.path.join(subdir_path, fname)
            if not os.path.isfile(filepath):
                continue
            if is_noindex(filepath):
                print(f"  [skip noindex] {subdir}/{fname}")
                continue

            canonical = get_canonical(filepath)
            if canonical:
                url = canonical
            else:
                url = f"{SITE_URL}/{url_prefix}/{fname}"

            lastmod = get_lastmod(filepath)
            priority, changefreq = get_priority_changefreq_subdir(subdir, fname)
            results.append((url, lastmod, changefreq, priority, f"{subdir}/{fname}"))

    results.sort(key=lambda x: (-x[3], x[4]))  # sort by priority desc, then name
    return results


def build_sitemap(entries):
    """Build sitemap XML string."""
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml"',
        '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ]
    for url, lastmod, changefreq, priority, _ in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{url}</loc>")
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append(f"    <changefreq>{changefreq}</changefreq>")
        lines.append(f"    <priority>{priority:.2f}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Regenerate sitemap.xml")
    parser.add_argument("--apply", action="store_true", help="Write sitemap.xml")
    parser.add_argument("--dry-run", action="store_true", help="Print URLs only")
    args = parser.parse_args()

    print(f"Walking {SITE_ROOT} for HTML files...")
    entries = walk_html_files()
    print(f"Found {len(entries)} indexable URLs")

    if args.dry_run:
        for url, lastmod, changefreq, priority, fname in entries:
            print(f"  [{priority:.2f}] {url} ({lastmod})")
        return

    xml = build_sitemap(entries)

    if args.apply:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
            fh.write(xml)
        print(f"Written: {OUTPUT_FILE} ({len(entries)} URLs)")
    else:
        print(xml)
        print(f"\n({len(entries)} URLs — use --apply to write)")


if __name__ == "__main__":
    main()
