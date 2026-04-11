#!/usr/bin/env python3
"""
validate-seo.py — SEO health checker for ResistanceZero
Checks: meta tags, schema, sitemap sync, search-index sync
Run from: /home/baguspermana7/rz-work
"""

import os
import re
import json
from pathlib import Path

SITE_ROOT = '/home/baguspermana7/rz-work'
SITEMAP = os.path.join(SITE_ROOT, 'sitemap.xml')
SEARCH_INDEX = os.path.join(SITE_ROOT, 'search-index.json')
SITE_BASE = 'https://resistancezero.com/'

# Pages to skip (utility, secret, QA)
SKIP_PATTERNS = ['rz-ops-p7x3k9m', 'google1b', '.qa-screens', 'node_modules', 'email-signature',
                 'Automation/', 'Article/', 'Data/', 'Apps/', 'dcmoc/']

def should_skip(filepath):
    rel = os.path.relpath(filepath, SITE_ROOT)
    return any(p in rel for p in SKIP_PATTERNS)

def get_public_html_files():
    files = []
    root = Path(SITE_ROOT)
    for f in root.rglob('*.html'):
        parts = str(f).split(os.sep)
        if any(p.startswith('.') or p == 'node_modules' for p in parts):
            continue
        if should_skip(str(f)):
            continue
        files.append(str(f))
    return sorted(files)

def extract_meta(content):
    title = re.search(r'<title>([^<]+)</title>', content)
    desc = re.search(r'<meta\s+name=["\']description["\'][^>]*content=["\']([^"\']+)["\']', content, re.IGNORECASE)
    if not desc:
        desc = re.search(r'<meta\s+content=["\']([^"\']+)["\'][^>]*name=["\']description["\']', content, re.IGNORECASE)
    canonical = re.search(r'<link\s+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']', content, re.IGNORECASE)
    og_title = re.search(r'<meta\s+property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\']', content, re.IGNORECASE)
    return {
        'title': title.group(1).strip() if title else None,
        'description': desc.group(1).strip() if desc else None,
        'canonical': canonical.group(1).strip() if canonical else None,
        'og_title': og_title,
    }

def get_sitemap_urls():
    if not os.path.exists(SITEMAP):
        return set()
    with open(SITEMAP) as f:
        content = f.read()
    urls = re.findall(r'<loc>([^<]+)</loc>', content)
    # Normalize to relative paths
    relative = set()
    for u in urls:
        u = u.replace(SITE_BASE, '').strip('/')
        relative.add(u)
    return relative

def get_search_index_urls():
    if not os.path.exists(SEARCH_INDEX):
        return set()
    with open(SEARCH_INDEX) as f:
        data = json.load(f)
    return set(entry.get('url', '') for entry in data)

def main():
    print("=== validate-seo.py ===\n")
    html_files = get_public_html_files()
    sitemap_urls = get_sitemap_urls()
    search_urls = get_search_index_urls()

    print(f"Scanning {len(html_files)} HTML files...")
    print(f"Sitemap URLs: {len(sitemap_urls)}")
    print(f"Search index entries: {len(search_urls)}\n")

    issues = {'CRITICAL': [], 'WARNING': [], 'INFO': []}

    for filepath in html_files:
        rel = os.path.relpath(filepath, SITE_ROOT)
        with open(filepath, 'r', errors='ignore') as f:
            content = f.read()

        meta = extract_meta(content)

        # Title checks
        if not meta['title']:
            issues['CRITICAL'].append(f"{rel}: Missing <title>")
        elif len(meta['title']) > 65:
            issues['WARNING'].append(f"{rel}: Title too long ({len(meta['title'])} chars): {meta['title'][:50]}...")
        elif len(meta['title']) < 20:
            issues['WARNING'].append(f"{rel}: Title too short ({len(meta['title'])} chars): {meta['title']}")

        # Description checks
        if not meta['description']:
            issues['WARNING'].append(f"{rel}: Missing <meta name=description>")
        elif len(meta['description']) > 165:
            issues['INFO'].append(f"{rel}: Description too long ({len(meta['description'])} chars)")

        # Canonical check
        if not meta['canonical']:
            issues['INFO'].append(f"{rel}: Missing canonical link")

        # OG check (only for articles and major pages)
        if 'article-' in rel or rel in ['index.html', 'articles.html', 'future-forward.html']:
            if not meta['og_title']:
                issues['WARNING'].append(f"{rel}: Missing og:title")

        # Sitemap check (only for root-level and key subdir pages)
        if '/' not in rel or rel.startswith('dc-market/') or rel.startswith('id/') or rel.startswith('embed/'):
            # Check if it should be in sitemap
            if rel not in sitemap_urls and rel.replace('.html', '') not in sitemap_urls:
                # Skip known excluded pages
                if not any(p in rel for p in ['rz-ops', 'google1b', 'email-signature', 'dcmoc', 'Apps', '.qa']):
                    issues['WARNING'].append(f"{rel}: Not in sitemap.xml")

        # Search index check (articles and calculators)
        if re.match(r'article-\d+\.html', rel) or re.match(r'FF-\d+\.html', rel) or 'calculator' in rel:
            if rel not in search_urls:
                issues['WARNING'].append(f"{rel}: Not in search-index.json")

    # Print results
    for level in ['CRITICAL', 'WARNING', 'INFO']:
        print(f"--- {level} ({len(issues[level])}) ---")
        for issue in issues[level]:
            print(f"  {level}: {issue}")
        if not issues[level]:
            print(f"  PASS")
        print()

    total = sum(len(v) for v in issues.values())
    print(f"Total issues: {total} ({len(issues['CRITICAL'])} critical, {len(issues['WARNING'])} warnings, {len(issues['INFO'])} info)")

if __name__ == '__main__':
    main()
