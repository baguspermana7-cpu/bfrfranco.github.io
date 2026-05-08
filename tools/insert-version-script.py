#!/usr/bin/env python3
"""
insert-version-script.py — idempotent helper that walks all *.html files
in the repo and inserts <script src="js/rz-version.js?v=..." defer></script>
BEFORE the closing </head> tag if not already present.

Usage:
    python3 tools/insert-version-script.py            # dry run (default)
    python3 tools/insert-version-script.py --dry-run  # explicit dry run
    python3 tools/insert-version-script.py --apply    # write changes

Output per file:
    ADDED   path/to/file.html
    SKIP    path/to/file.html  (already has the script tag)
    WARN    path/to/file.html  (no </head> found — needs manual review)

Part of Plan v12 Phase K — 2026-05-09
"""

import os
import sys
import re
import argparse

# Version tag string to insert (query param date matches RZ_VERSION_DATE)
VERSION_DATE = '2026-05-09'
SCRIPT_TAG = f'<script src="js/rz-version.js?v={VERSION_DATE}" defer></script>'

# The script src pattern used to detect existing presence (without query string too)
SCRIPT_PATTERN = re.compile(r'<script[^>]+src=["\']([^"\']*js/rz-version\.js)[^"\']*["\']', re.IGNORECASE)

# Directories to exclude (walk will skip these entirely)
EXCLUDED_DIRS = {
    'node_modules',
    '.git',
    '.cache',
    'archive',
    '.qa-screens',
    'dcmoc',
    'Dunia-Emosi',
    'Apps',          # covers 'Apps/second brain' and sub-dirs
    'embed',
    'Automation',
    '__pycache__',
}


def should_exclude_dir(dirname: str) -> bool:
    """Return True if the directory name matches an exclusion."""
    return dirname in EXCLUDED_DIRS or dirname.startswith('.')


def find_html_files(root: str):
    """Yield all .html files under root, skipping excluded directories."""
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune excluded dirs in-place so os.walk won't descend into them
        dirnames[:] = [d for d in dirnames if not should_exclude_dir(d)]
        for fname in filenames:
            if fname.lower().endswith('.html'):
                yield os.path.join(dirpath, fname)


def process_file(filepath: str, apply: bool) -> str:
    """
    Process a single HTML file.

    Returns one of:
        'added'    — tag was (or would be) inserted
        'skip'     — tag already present
        'warn'     — no </head> found
    """
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as fh:
            content = fh.read()
    except OSError as exc:
        print(f'ERROR   {filepath}  ({exc})')
        return 'error'

    # Check if already present
    if SCRIPT_PATTERN.search(content):
        return 'skip'

    # Find </head> (case-insensitive)
    head_close = re.search(r'</head>', content, re.IGNORECASE)
    if not head_close:
        return 'warn'

    # Build replacement: indent to match surrounding tag or use 4 spaces
    insert_pos = head_close.start()
    # Try to detect indentation of </head>
    line_start = content.rfind('\n', 0, insert_pos)
    indent = ''
    if line_start != -1:
        after_newline = content[line_start + 1:insert_pos]
        # grab leading whitespace
        m = re.match(r'^(\s+)', after_newline)
        if m:
            indent = m.group(1)
        else:
            indent = '    '
    else:
        indent = '    '

    insertion = f'{indent}{SCRIPT_TAG}\n'
    new_content = content[:insert_pos] + insertion + content[insert_pos:]

    if apply:
        try:
            with open(filepath, 'w', encoding='utf-8') as fh:
                fh.write(new_content)
        except OSError as exc:
            print(f'ERROR   {filepath}  ({exc})')
            return 'error'

    return 'added'


def main():
    parser = argparse.ArgumentParser(
        description='Insert js/rz-version.js script tag into all HTML files.'
    )
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Actually write changes. Default is dry-run (no files modified).',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        dest='dry_run',
        help='Explicit dry-run flag (default behaviour — files are not modified).',
    )
    args = parser.parse_args()

    apply = args.apply and not args.dry_run
    mode_label = 'APPLY' if apply else 'DRY-RUN'
    print(f'=== insert-version-script.py [{mode_label}] ===')
    if not apply:
        print('(Pass --apply to write changes)\n')
    else:
        print()

    # Resolve repo root relative to this script's location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)

    counts = {'added': 0, 'skip': 0, 'warn': 0, 'error': 0}

    for filepath in sorted(find_html_files(repo_root)):
        rel = os.path.relpath(filepath, repo_root)
        result = process_file(filepath, apply=apply)
        counts[result] = counts.get(result, 0) + 1

        if result == 'added':
            label = 'ADDED  ' if apply else 'WOULD-ADD'
            print(f'{label}  {rel}')
        elif result == 'warn':
            print(f'WARN    {rel}  [no </head> found]')
        elif result == 'error':
            pass  # already printed in process_file
        # skip: silent (suppress to keep output clean; count is shown in summary)

    print()
    print('=== Summary ===')
    action_label = 'Added' if apply else 'Would add'
    print(f'  {action_label}: {counts["added"]}')
    print(f'  Skipped (already present): {counts["skip"]}')
    print(f'  Warnings (no </head>): {counts["warn"]}')
    if counts.get('error', 0):
        print(f'  Errors: {counts["error"]}')

    if not apply and counts['added'] > 0:
        print()
        print(f'Run with --apply to insert the tag into {counts["added"]} file(s).')


if __name__ == '__main__':
    main()
