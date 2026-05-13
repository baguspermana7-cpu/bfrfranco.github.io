#!/usr/bin/env python3
"""
build-indexing-list.py
Regenerates standarization/Indexing gconsole/top-urls-request-indexing.txt
from sitemap.xml. Idempotent. Groups URLs by priority into HARI N batches of 10.

Usage:
  python3 tools/build-indexing-list.py            # dry-run, print to stdout
  python3 tools/build-indexing-list.py --apply    # write to disk

Per mandate feedback_standarization_freshness.md (2026-05-14).
"""
import os
import sys
import re
from datetime import datetime
from xml.etree import ElementTree as ET

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = os.path.join(REPO_ROOT, 'sitemap.xml')
OUT_FILE = os.path.join(REPO_ROOT, 'standarization', 'Indexing gconsole', 'top-urls-request-indexing.txt')
NS = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}


def page_title_hint(url: str) -> str:
    """Extract a slug-based hint for the page title."""
    path = url.rstrip('/').split('/')[-1]
    if path == '' or path == 'resistancezero.com':
        return 'Homepage'
    slug = path.replace('.html', '').replace('-', ' ').replace('_', ' ').strip()
    return slug.title()


def read_sitemap():
    if not os.path.exists(SITEMAP):
        print(f"ERROR: sitemap.xml not found at {SITEMAP}")
        sys.exit(2)
    tree = ET.parse(SITEMAP)
    root = tree.getroot()
    urls = []
    for url_el in root.findall('sm:url', NS):
        loc = url_el.find('sm:loc', NS)
        prio = url_el.find('sm:priority', NS)
        lastmod = url_el.find('sm:lastmod', NS)
        if loc is None:
            continue
        urls.append({
            'url': loc.text.strip(),
            'priority': float(prio.text) if prio is not None and prio.text else 0.5,
            'lastmod': lastmod.text if lastmod is not None and lastmod.text else '',
        })
    return urls


def title_from_html(url: str) -> str:
    """Try to read the actual <title> from the local HTML file."""
    path = url.replace('https://resistancezero.com/', '').rstrip('/')
    if not path:
        path = 'index.html'
    if not path.endswith('.html') and '/' not in path:
        path = path + '.html'
    local = os.path.join(REPO_ROOT, path)
    if not os.path.exists(local):
        # try /index.html for folders
        local = os.path.join(REPO_ROOT, path, 'index.html')
        if not os.path.exists(local):
            return page_title_hint(url)
    try:
        with open(local, encoding='utf-8') as f:
            content = f.read(8192)
        m = re.search(r'<title>([^<]+)</title>', content, re.IGNORECASE)
        if m:
            title = m.group(1).strip()
            title = re.sub(r' \| ResistanceZero.*$', '', title)
            title = re.sub(r' — ResistanceZero.*$', '', title)
            return title[:80]
    except Exception:
        pass
    return page_title_hint(url)


def build_output(urls):
    """Group URLs by priority, batch into HARI N of 10."""
    urls_sorted = sorted(urls, key=lambda u: (-u['priority'], u['url']))
    total = len(urls_sorted)
    today = datetime.now().strftime('%Y-%m-%d')

    lines = []
    lines.append('=' * 80)
    lines.append(' RESISTANCEZERO.COM — GOOGLE SEARCH CONSOLE: REQUEST INDEXING URL LIST')
    lines.append('=' * 80)
    lines.append(f' Generated: {today}')
    lines.append(f' Total URLs: {total} (indexable public pages)')
    lines.append(' Quota GSC: ~10-15 request indexing per hari')
    lines.append(f' Strategy: Mulai dari Priority tertinggi, 10 URL/hari selama ~{(total + 9) // 10} hari')
    lines.append('=' * 80)
    lines.append('')
    lines.append(' CARA PAKAI:')
    lines.append(' 1. Buka Google Search Console → URL Inspection')
    lines.append(' 2. Paste URL satu per satu')
    lines.append(' 3. Klik "Request Indexing"')
    lines.append(' 4. Centang ([X]) di kolom kiri setelah di-submit')
    lines.append(' 5. Lanjut besok untuk batch berikutnya')
    lines.append('')

    batch_size = 10
    for batch_idx in range(0, total, batch_size):
        day = (batch_idx // batch_size) + 1
        batch = urls_sorted[batch_idx:batch_idx + batch_size]
        prio_min = min(u['priority'] for u in batch)
        prio_max = max(u['priority'] for u in batch)
        prio_label = f'{prio_max:.2f}' if prio_min == prio_max else f'{prio_min:.2f} - {prio_max:.2f}'
        lines.append('=' * 80)
        lines.append(f' HARI {day} — PRIORITY {prio_label} ({len(batch)} URLs)')
        lines.append('=' * 80)
        lines.append('')
        for u in batch:
            title = title_from_html(u['url'])
            lines.append(f"[ ] {u['url']}")
            lines.append(f"    Priority: {u['priority']:.2f} | {title}")
            lines.append('')

    lines.append('=' * 80)
    lines.append(f' END — {total} URLs across {(total + 9) // 10} days')
    lines.append('=' * 80)
    lines.append(f' Regenerated from sitemap.xml by tools/build-indexing-list.py')
    lines.append(f' Last review: {today}')
    return '\n'.join(lines)


def main():
    apply = '--apply' in sys.argv
    urls = read_sitemap()
    out = build_output(urls)
    if apply:
        os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
        with open(OUT_FILE, 'w', encoding='utf-8') as f:
            f.write(out)
        print(f'[apply] Wrote {len(urls)} URLs to {OUT_FILE}')
    else:
        print(out[:2000])
        print('\n... (truncated)')
        print(f'\nDry-run complete. Total URLs: {len(urls)}. Use --apply to write.')


if __name__ == '__main__':
    main()
