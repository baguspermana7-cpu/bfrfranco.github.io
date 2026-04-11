#!/usr/bin/env python3
"""
validate-links.py — Internal link checker for ResistanceZero
Finds: broken internal hrefs, disabled series nav that should be enabled
Run from: /home/baguspermana7/rz-work
"""

import os
import re
from pathlib import Path

SITE_ROOT = '/home/baguspermana7/rz-work'

# All article files in order
ARTICLES = [f'article-{i}.html' for i in range(1, 27)]

def get_all_html_files():
    files = []
    root = Path(SITE_ROOT)
    for f in root.rglob('*.html'):
        # Skip node_modules, .git, .qa-screens
        parts = str(f).split(os.sep)
        if any(p.startswith('.') or p == 'node_modules' for p in parts):
            continue
        files.append(str(f))
    return sorted(files)

def get_internal_hrefs(html_content):
    """Extract all href values that look internal (not http/https/mailto/#)"""
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html_content)
    internal = []
    for h in hrefs:
        if h.startswith('#') or h.startswith('http') or h.startswith('mailto') or h.startswith('javascript'):
            continue
        internal.append(h)
    return internal

def resolve_href(href, page_path):
    """Resolve relative href to absolute path"""
    page_dir = os.path.dirname(page_path)
    if href.startswith('/'):
        return os.path.join(SITE_ROOT, href.lstrip('/'))
    return os.path.normpath(os.path.join(page_dir, href))

def check_series_nav_disabled(html_content, filename):
    """Check if 'Next' series nav link is disabled but the next article exists"""
    issues = []
    # Find disabled next links: pointer-events:none on a series nav link
    disabled = re.findall(
        r'<a[^>]*pointer-events:none[^>]*class=["\'][^"\']*series-nav-next[^"\']*["\'][^>]*>|'
        r'<a[^>]*class=["\'][^"\']*series-nav-next[^"\']*["\'][^>]*pointer-events:none[^>]*>',
        html_content
    )
    if disabled:
        # Find what article number this is
        match = re.search(r'article-(\d+)\.html', filename)
        if match:
            n = int(match.group(1))
            next_file = f'article-{n+1}.html'
            if os.path.exists(os.path.join(SITE_ROOT, next_file)):
                issues.append(f"WARNING: {filename} — 'Next' nav is disabled but {next_file} EXISTS. Update the link!")
    return issues

def main():
    print("=== validate-links.py ===\n")
    html_files = get_all_html_files()
    print(f"Scanning {len(html_files)} HTML files...\n")

    broken = []
    series_issues = []

    for filepath in html_files:
        with open(filepath, 'r', errors='ignore') as f:
            content = f.read()

        # Check series nav
        rel_path = os.path.relpath(filepath, SITE_ROOT)
        issues = check_series_nav_disabled(content, rel_path)
        series_issues.extend(issues)

        # Check internal hrefs
        hrefs = get_internal_hrefs(content)
        for href in hrefs:
            # Strip query/anchor
            clean = href.split('?')[0].split('#')[0]
            if not clean:
                continue
            resolved = resolve_href(clean, filepath)
            if not os.path.exists(resolved):
                broken.append(f"BROKEN: {rel_path} → {href}")

    print("--- Series Nav Issues ---")
    if series_issues:
        for issue in series_issues:
            print(issue)
    else:
        print("PASS: All series nav links look correct")

    print("\n--- Broken Internal Links ---")
    if broken:
        # Deduplicate
        seen = set()
        for b in broken:
            if b not in seen:
                print(b)
                seen.add(b)
    else:
        print("PASS: No broken internal links found")

    print(f"\nTotal issues found: {len(series_issues) + len(broken)}")

if __name__ == '__main__':
    main()
