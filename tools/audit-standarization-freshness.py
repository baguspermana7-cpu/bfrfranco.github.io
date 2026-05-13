#!/usr/bin/env python3
"""
audit-standarization-freshness.py
Walks standarization/ folder and flags files that are stale relative to site
content. Per mandate feedback_standarization_freshness.md (2026-05-14).

Stale criteria (configurable):
- File older than --stale-days days (default 30) AND
- The site (any *.html at repo root) has changed in past --recent-days days (default 7)

Special cases:
- top-urls-request-indexing.txt: ALWAYS stale if URL count diverges from
  sitemap.xml URL count by more than 10%.

Usage:
  python3 tools/audit-standarization-freshness.py
  python3 tools/audit-standarization-freshness.py --strict   # exit 1 on stale
  python3 tools/audit-standarization-freshness.py --stale-days 14 --recent-days 3
"""
import argparse
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta
from xml.etree import ElementTree as ET

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STANDARIZATION = os.path.join(REPO_ROOT, 'standarization')
SITEMAP = os.path.join(REPO_ROOT, 'sitemap.xml')
NS = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}


def last_modified(path: str) -> datetime:
    """Filesystem mtime — fast first check. Fall back to git log if needed."""
    try:
        return datetime.fromtimestamp(os.path.getmtime(path))
    except OSError:
        return datetime(1970, 1, 1)


def last_git_modified(path: str) -> datetime | None:
    """Return last commit date for the file, or None if not tracked."""
    rel = os.path.relpath(path, REPO_ROOT)
    try:
        out = subprocess.check_output(
            ['git', 'log', '-1', '--format=%cI', '--', rel],
            cwd=REPO_ROOT, stderr=subprocess.DEVNULL,
        ).decode().strip()
        if not out:
            return None
        return datetime.fromisoformat(out)
    except (subprocess.CalledProcessError, ValueError):
        return None


def site_changed_within(days: int) -> bool:
    """Return True if any *.html at repo root changed in past N days."""
    try:
        threshold = datetime.now() - timedelta(days=days)
        out = subprocess.check_output(
            ['git', 'log', f'--since={threshold.isoformat()}', '--name-only', '--pretty=format:'],
            cwd=REPO_ROOT, stderr=subprocess.DEVNULL,
        ).decode()
        for line in out.splitlines():
            if line.endswith('.html') and '/' not in line:
                return True
        return False
    except subprocess.CalledProcessError:
        return False


def sitemap_url_count() -> int | None:
    if not os.path.exists(SITEMAP):
        return None
    try:
        tree = ET.parse(SITEMAP)
        return len(tree.getroot().findall('sm:url', NS))
    except ET.ParseError:
        return None


def indexing_url_count() -> int | None:
    path = os.path.join(STANDARIZATION, 'Indexing gconsole', 'top-urls-request-indexing.txt')
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding='utf-8') as f:
            content = f.read()
        m = re.search(r'Total URLs:\s*(\d+)', content)
        if m:
            return int(m.group(1))
    except OSError:
        return None
    return None


def audit_file(path: str, stale_days: int, recent_days: int, site_changed: bool):
    name = os.path.relpath(path, REPO_ROOT)
    mtime = last_modified(path)
    git_mtime = last_git_modified(path)
    effective = git_mtime if git_mtime else mtime
    age_days = (datetime.now(tz=effective.tzinfo) - effective).days
    is_stale_age = age_days > stale_days
    is_stale = is_stale_age and site_changed

    return {
        'path': name,
        'age_days': age_days,
        'is_stale_age': is_stale_age,
        'is_stale': is_stale,
        'effective_date': effective.date().isoformat(),
    }


def special_audits():
    """Cross-data checks (sitemap vs indexing list, etc.)."""
    findings = []
    sitemap_count = sitemap_url_count()
    indexing_count = indexing_url_count()
    if sitemap_count and indexing_count:
        delta = abs(sitemap_count - indexing_count) / sitemap_count
        if delta > 0.1:
            findings.append({
                'path': 'standarization/Indexing gconsole/top-urls-request-indexing.txt',
                'severity': 'HIGH',
                'reason': f'URL count divergence: indexing={indexing_count} vs sitemap={sitemap_count} ({delta:.1%} delta > 10%)',
                'fix': 'Run: python3 tools/build-indexing-list.py --apply',
            })
    return findings


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--strict', action='store_true', help='Exit 1 on any stale finding')
    p.add_argument('--stale-days', type=int, default=30, help='Days threshold for staleness')
    p.add_argument('--recent-days', type=int, default=7, help='Days window for site changes')
    args = p.parse_args()

    if not os.path.isdir(STANDARIZATION):
        print(f'[audit-standarization-freshness] No standarization/ folder at {STANDARIZATION}')
        sys.exit(2)

    site_changed = site_changed_within(args.recent_days)
    print(f'[audit-standarization-freshness] Site changed in past {args.recent_days}d: {site_changed}')
    print(f'[audit-standarization-freshness] Stale threshold: {args.stale_days}d')
    print()

    stale = []
    fresh = []
    for root, dirs, files in os.walk(STANDARIZATION):
        for fn in files:
            if not (fn.endswith('.md') or fn.endswith('.txt')):
                continue
            full = os.path.join(root, fn)
            r = audit_file(full, args.stale_days, args.recent_days, site_changed)
            if r['is_stale']:
                stale.append(r)
            else:
                fresh.append(r)

    print(f'FRESH ({len(fresh)} files):')
    for r in sorted(fresh, key=lambda x: x['age_days']):
        print(f'  [{r["age_days"]:>3}d] {r["path"]}')
    print()

    if stale:
        print(f'STALE ({len(stale)} files — older than {args.stale_days}d AND site changed recently):')
        for r in sorted(stale, key=lambda x: -x['age_days']):
            print(f'  [{r["age_days"]:>3}d] {r["path"]}  (last modified {r["effective_date"]})')
        print()

    findings = special_audits()
    if findings:
        print(f'SPECIAL FINDINGS ({len(findings)}):')
        for f in findings:
            print(f'  [{f["severity"]}] {f["path"]}')
            print(f'    Reason: {f["reason"]}')
            print(f'    Fix:    {f["fix"]}')
        print()

    has_issues = bool(stale or findings)
    if args.strict and has_issues:
        print('[STRICT] Issues detected. Exiting 1.')
        sys.exit(1)
    elif not has_issues:
        print('[OK] All standarization files are fresh.')
        sys.exit(0)
    else:
        print(f'[INFO] {len(stale)} stale + {len(findings)} findings (non-strict: exit 0).')
        sys.exit(0)


if __name__ == '__main__':
    main()
