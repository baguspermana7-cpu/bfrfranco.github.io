#!/usr/bin/env python3
"""Regenerate the sitemap from reviewed, tracked publication paths."""

import argparse
import os
from pathlib import Path
import re
import subprocess
import sys
from xml.sax.saxutils import escape

from crawler_inventory import (
    SITE_URL, EXCLUDE_DIRS, EXCLUDE_FILES, collect_inventory,
    local_url_path, read_metadata,
)

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_FILE = os.path.join(SITE_ROOT, "sitemap.xml")

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
    """Omit dates: Git commits and checkout mtimes do not prove significant updates."""
    return None


def get_canonical(filepath):
    metadata = read_metadata(filepath)
    if len(metadata.canonicals) != 1:
        return None
    canonical = metadata.canonicals[0]
    try:
        local_url_path(canonical)
    except ValueError:
        return None
    return canonical


def is_noindex(filepath):
    return read_metadata(filepath).noindex


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


def walk_html_files(inventory=None):
    inventory = inventory if inventory is not None else collect_inventory(SITE_ROOT)
    if inventory["errors"]:
        raise ValueError("\n".join(inventory["errors"]))
    entries = []
    for page in inventory["pages"]:
        if page["status"] != "included":
            continue
        parts = Path(page["path"]).parts
        priority, frequency = (get_priority_changefreq(parts[0]) if len(parts) == 1
                               else get_priority_changefreq_subdir(parts[0], parts[-1]))
        entries.append((page["loc"], get_lastmod(page["path"]), frequency, priority, page["path"]))
    return sorted(entries, key=lambda entry: (-entry[3], entry[4]))


def build_sitemap(entries):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url, lastmod, changefreq, priority, _ in entries:
        lines.extend(["  <url>", f"    <loc>{escape(url)}</loc>"])
        if lastmod is not None:
            lines.append(f"    <lastmod>{escape(lastmod)}</lastmod>")
        lines.extend([f"    <changefreq>{changefreq}</changefreq>",
                      f"    <priority>{priority:.2f}</priority>", "  </url>"])
    return "\n".join(lines + ["</urlset>"]) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Write sitemap.xml")
    mode.add_argument("--dry-run", action="store_true", help="Print URLs only")
    mode.add_argument("--check", action="store_true", help="Fail if sitemap.xml is stale")
    args = parser.parse_args()
    try:
        inventory = collect_inventory(SITE_ROOT)
        entries = walk_html_files(inventory)
        xml = build_sitemap(entries)
        if args.apply:
            Path(OUTPUT_FILE).write_text(xml, encoding="utf-8")
            print(f"Written sitemap.xml: {len(entries)} URLs; lastmod omitted without verified dates")
        elif args.check:
            if Path(OUTPUT_FILE).read_text(encoding="utf-8") != xml:
                raise ValueError("sitemap.xml is stale; run tools/build-sitemap.py --apply")
            print(f"Sitemap current: {len(entries)} URLs")
        elif args.dry_run:
            print("\n".join(entry[0] for entry in entries))
        else:
            print(xml, end="")
        for warning in inventory["warnings"]:
            print(f"WARNING: {warning}", file=sys.stderr)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"Crawler build failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
