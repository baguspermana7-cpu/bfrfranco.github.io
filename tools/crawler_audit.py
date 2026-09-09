#!/usr/bin/env python3
"""Audit crawler inventory, robots policy and sitemap coverage without network access."""

import argparse
from collections import Counter
import json
import importlib.util
from pathlib import Path
import subprocess
import re
import sys
import xml.etree.ElementTree as ET

from crawler_inventory import SITE_URL, RobotsPolicy, collect_inventory


NAMESPACE = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
PRIVATE_PATHS = (
    "/node_modules/", "/Article/", "/Data/", "/prompts/", "/Automation/",
    "/standarization/", "/tools/", "/Apps/", "/Dunia-Emosi/", "/dcmoc/", "/.qa-screens/",
)


def audit_sitemap(path, inventory):
    try:
        root = ET.parse(path).getroot()
    except (OSError, ET.ParseError) as error:
        return [f"sitemap unreadable: {error}"]
    errors = []
    if root.tag != NAMESPACE + "urlset":
        errors.append("sitemap must have the sitemap 0.9 urlset root")
    locs = []
    for node in root:
        locations = node.findall(NAMESPACE + "loc")
        if node.tag != NAMESPACE + "url" or len(locations) != 1 or not locations[0].text:
            errors.append("sitemap URL entry requires exactly one nonempty loc")
            continue
        locs.append(locations[0].text)
        if node.find(NAMESPACE + "lastmod") is not None:
            errors.append(f"unverified lastmod: {locations[0].text}; omit until significant-change evidence exists")
    counts = Counter(locs)
    expected = {page["loc"] for page in inventory["pages"] if page["status"] == "included"}
    errors.extend(f"duplicate loc: {loc}" for loc, count in counts.items() if count > 1)
    errors.extend(f"missing loc: {loc}" for loc in sorted(expected - set(locs)))
    errors.extend(f"unexpected loc: {loc}" for loc in sorted(set(locs) - expected))
    return errors


def audit_robots(root):
    policy = RobotsPolicy((root / "robots.txt").read_text(encoding="utf-8"))
    errors = policy.restriction_errors()
    if policy.sitemaps != [SITE_URL + "/sitemap.xml"]:
        errors.append("robots Sitemap must name sitemap.xml exactly once; llms.txt is not a sitemap")
    for agent in policy.agents:
        for path in PRIVATE_PATHS:
            if policy.allowed(agent, path + "crawler-probe.html"):
                errors.append(f"robots missing private-path restriction: {agent} {path}")
        for path in ("/sitemap.xml", "/llms.txt", "/styles.css", "/js/rz-version.js"):
            if not policy.allowed(agent, path):
                errors.append(f"robots blocks crawler discovery/rendering resource: {agent} {path}")
    return errors


def audit_llms(root, inventory):
    expected = {page["loc"] for page in inventory["pages"] if page["status"] == "included"}
    patterns = {
        "llms.txt": r"^- \[(?:\\.|[^\]])*\]\((https://[^)]+)\)",
        "llms-full.txt": r"^={70}\n# [^\n]+ — (https://[^\s]+)\n",
    }
    builders = {"llms.txt": "build-llms-txt.py", "llms-full.txt": "build-llms-full.py"}
    errors = []
    for filename, pattern in patterns.items():
        try:
            content = (root / filename).read_text(encoding="utf-8")
        except OSError as error:
            errors.append(f"{filename} unreadable: {error}")
            continue
        counts = Counter(re.findall(pattern, content, flags=re.MULTILINE))
        errors.extend(f"{filename} duplicate loc: {loc}" for loc, count in counts.items() if count > 1)
        errors.extend(f"{filename} missing loc: {loc}" for loc in sorted(expected - set(counts)))
        errors.extend(f"{filename} unexpected loc: {loc}" for loc in sorted(set(counts) - expected))
        spec = importlib.util.spec_from_file_location("crawler_export", Path(__file__).parent / builders[filename])
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if not inventory["errors"] and module.build_content(root, inventory) != content:
            errors.append(f"{filename} stale content or unsafe body export; regenerate from shared inventory")
    return errors


def audit(root):
    inventory = collect_inventory(root)
    errors = (inventory["errors"] + audit_sitemap(root / "sitemap.xml", inventory)
              + audit_robots(root) + audit_llms(root, inventory))
    return {**inventory, "errors": sorted(set(errors)), "passed": not errors,
            "verification": {"local_inventory": True, "live_http_headers": False,
                             "search_engine_indexing": False, "visual_readability": False}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--json", action="store_true", help="Print machine-readable coverage only")
    parser.add_argument("--strict", action="store_true", help="Explicit alias; failures always exit nonzero")
    args = parser.parse_args()
    try:
        report = audit(args.root)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        report = {"passed": False, "errors": [f"crawler evidence unavailable: {error}"]}
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(f"Crawler audit: {'PASS' if report['passed'] else 'FAIL'}")
        print(json.dumps(report.get("counts", {}), sort_keys=True))
        for field in ("errors", "warnings"):
            for finding in report.get(field, []):
                print(f"{field.upper()}: {finding}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
