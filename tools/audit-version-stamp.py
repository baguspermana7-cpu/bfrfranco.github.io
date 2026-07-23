#!/usr/bin/env python3
"""
audit-version-stamp.py — walks all HTML files (same exclusions as
insert-version-script.py) and validates each one references js/rz-version.js.

Usage:
    python3 tools/audit-version-stamp.py            # human-readable report
    python3 tools/audit-version-stamp.py --json     # JSON output
    python3 tools/audit-version-stamp.py --strict   # exit 1 if any page misses stamp

Output columns:
    OK      path/to/file.html   — has the rz-version.js script tag
    MISS    path/to/file.html   — missing the tag
    WARN    path/to/file.html   — no </head> / unparseable

Part of Plan v12 Phase K — 2026-05-09
"""

import os
import sys
import re
import json
import argparse

# Detection pattern (matches any src containing js/rz-version.js)
SCRIPT_PATTERN = re.compile(r'<script[^>]+src=["\']([^"\']*js/rz-version\.js)[^"\']*["\']', re.IGNORECASE)

# Directories to exclude (mirrors insert-version-script.py)
EXCLUDED_DIRS = {
    'node_modules',
    '.git',
    '.cache',
    'archive',
    '.qa-screens',
    'dcmoc',
    'Dunia-Emosi',
    'Apps',
    'embed',
    'Automation',
    '__pycache__',
    'dc-corpus',   # crawl raw artifacts (tools/dc-corpus/raw/*.html) — not site pages
}


def should_exclude_dir(dirname: str) -> bool:
    return dirname in EXCLUDED_DIRS or dirname.startswith('.')


def find_html_files(root: str):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not should_exclude_dir(d)]
        for fname in filenames:
            if fname.lower().endswith('.html'):
                yield os.path.join(dirpath, fname)


def audit_file(filepath: str) -> dict:
    """
    Audit a single file.
    Returns dict: { path, status, has_head }
      status: 'ok' | 'miss' | 'warn' | 'error'
    """
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as fh:
            content = fh.read()
    except OSError as exc:
        return {'path': filepath, 'status': 'error', 'detail': str(exc)}

    has_stamp = bool(SCRIPT_PATTERN.search(content))
    has_head = bool(re.search(r'</head>', content, re.IGNORECASE))

    if has_stamp:
        return {'path': filepath, 'status': 'ok', 'has_head': has_head}
    elif not has_head:
        return {'path': filepath, 'status': 'warn', 'has_head': False, 'detail': 'no </head>'}
    else:
        return {'path': filepath, 'status': 'miss', 'has_head': True}


def main():
    parser = argparse.ArgumentParser(
        description='Audit HTML files for js/rz-version.js script tag.'
    )
    parser.add_argument(
        '--strict',
        action='store_true',
        help='Exit with code 1 if any HTML file is missing the version stamp.',
    )
    parser.add_argument(
        '--json',
        action='store_true',
        dest='json_output',
        help='Output results as JSON.',
    )
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)

    results = []
    for filepath in sorted(find_html_files(repo_root)):
        result = audit_file(filepath)
        result['rel'] = os.path.relpath(filepath, repo_root)
        results.append(result)

    # Tally
    counts = {'ok': 0, 'miss': 0, 'warn': 0, 'error': 0}
    for r in results:
        counts[r['status']] = counts.get(r['status'], 0) + 1

    if args.json_output:
        output = {
            'summary': counts,
            'files': results,
        }
        print(json.dumps(output, indent=2))
    else:
        print('=== audit-version-stamp.py ===')
        print()
        # Show misses and warns first (actionable), then OK
        misses = [r for r in results if r['status'] == 'miss']
        warns  = [r for r in results if r['status'] == 'warn']
        oks    = [r for r in results if r['status'] == 'ok']
        errors = [r for r in results if r['status'] == 'error']

        if misses:
            print(f'--- MISSING ({len(misses)}) ---')
            for r in misses:
                print(f'  MISS  {r["rel"]}')
            print()

        if warns:
            print(f'--- WARNINGS ({len(warns)}) ---')
            for r in warns:
                detail = r.get('detail', '')
                print(f'  WARN  {r["rel"]}  [{detail}]')
            print()

        if errors:
            print(f'--- ERRORS ({len(errors)}) ---')
            for r in errors:
                print(f'  ERR   {r["rel"]}  [{r.get("detail", "")}]')
            print()

        print(f'--- OK ({len(oks)}) ---')
        for r in oks:
            print(f'  OK    {r["rel"]}')

        print()
        print('=== Summary ===')
        print(f'  OK (stamp present):   {counts["ok"]}')
        print(f'  MISS (stamp absent):  {counts["miss"]}')
        print(f'  WARN (no </head>):    {counts["warn"]}')
        if counts.get('error', 0):
            print(f'  Errors:               {counts["error"]}')

        total = sum(counts.values())
        pct = (counts['ok'] / total * 100) if total else 0
        print(f'  Coverage:             {counts["ok"]}/{total} ({pct:.0f}%)')

        if args.strict and counts['miss'] > 0:
            print()
            print('STRICT MODE: exiting 1 — some pages are missing the version stamp.')
            sys.exit(1)

    if args.strict and args.json_output and counts['miss'] > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
