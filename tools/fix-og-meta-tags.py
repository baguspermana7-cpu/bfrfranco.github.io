#!/usr/bin/env python3
"""
fix-og-meta-tags.py
Batch-fix og:image / og:image:alt / twitter:image meta tags across HTML pages
based on the audit-og-images.py findings.

For each HTML page at site root:
1. Compute expected og:image URL: https://resistancezero.com/assets/og/<slug>.webp
2. If the local file `assets/og/<slug>.webp` exists, update the page's meta tags
3. If og:image meta is missing, INSERT it before </head>
4. If og:image:alt is missing, INSERT it next to og:image
5. If twitter:image is missing, INSERT it next to twitter:card
6. Use the page's <title> as og:image:alt content (truncated to 100 chars)

Idempotent — re-running on a fixed page is a no-op.

Usage:
  python3 tools/fix-og-meta-tags.py            # dry-run (default)
  python3 tools/fix-og-meta-tags.py --apply    # write changes
"""
import argparse
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OG_DIR = os.path.join(REPO_ROOT, 'assets', 'og')
SITE_BASE = 'https://resistancezero.com'

EXCLUDED = {'404.html', 'rz-ops-p7x3k9m.html', 'sitemap.xml'}


def page_slug(html_file: str) -> str:
    return html_file.replace('.html', '')


def og_image_url(slug: str) -> str:
    return f'{SITE_BASE}/assets/og/{slug}.webp'


def extract_title(html: str) -> str:
    m = re.search(r'<title>([^<]+)</title>', html, re.IGNORECASE)
    if not m:
        return ''
    title = m.group(1).strip()
    # Strip site-suffix
    title = re.sub(r'\s*[|—]\s*ResistanceZero.*$', '', title)
    title = re.sub(r'\s*[|—]\s*Bagus Dwi Permana.*$', '', title)
    return title[:100]


def get_meta(html: str, prop: str) -> str | None:
    """Get content value of <meta property="X" content="…"> or <meta name="X" content="…">."""
    for attr in ('property', 'name'):
        m = re.search(rf'<meta\s+{attr}="{re.escape(prop)}"\s+content="([^"]*)"', html, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def set_meta(html: str, prop: str, value: str, attr_type: str = 'property') -> str:
    """Update existing meta tag content, or insert before </head>."""
    pattern = rf'(<meta\s+{attr_type}="{re.escape(prop)}"\s+content=)"[^"]*"'
    if re.search(pattern, html, re.IGNORECASE):
        return re.sub(pattern, rf'\1"{value}"', html, count=1, flags=re.IGNORECASE)
    # Try the other attribute type
    other = 'name' if attr_type == 'property' else 'property'
    pattern_other = rf'(<meta\s+{other}="{re.escape(prop)}"\s+content=)"[^"]*"'
    if re.search(pattern_other, html, re.IGNORECASE):
        return re.sub(pattern_other, rf'\1"{value}"', html, count=1, flags=re.IGNORECASE)
    # Insert new tag before </head>
    new_tag = f'    <meta {attr_type}="{prop}" content="{value}">\n'
    return re.sub(r'(\s*</head>)', new_tag + r'\1', html, count=1, flags=re.IGNORECASE)


def fix_page(html_file: str, apply: bool) -> dict:
    slug = page_slug(html_file)
    og_path = os.path.join(OG_DIR, f'{slug}.webp')
    if not os.path.exists(og_path):
        return {'slug': slug, 'status': 'no-og-file', 'changes': []}

    full = os.path.join(REPO_ROOT, html_file)
    with open(full, encoding='utf-8') as f:
        html = f.read()

    title = extract_title(html)
    alt_text = title if title else f'{slug.replace("-", " ").title()} - resistancezero.com'
    expected_og = og_image_url(slug)

    changes = []
    new_html = html

    # 1. og:image
    cur_og = get_meta(new_html, 'og:image')
    if cur_og != expected_og:
        new_html = set_meta(new_html, 'og:image', expected_og, 'property')
        changes.append(f'og:image: {cur_og or "(missing)"} -> {expected_og}')

    # 2. og:image:width + og:image:height (1200x630 standard)
    cur_w = get_meta(new_html, 'og:image:width')
    if cur_w != '1200':
        new_html = set_meta(new_html, 'og:image:width', '1200', 'property')
        if cur_w is None:
            changes.append('og:image:width: (missing) -> 1200')

    cur_h = get_meta(new_html, 'og:image:height')
    if cur_h != '630':
        new_html = set_meta(new_html, 'og:image:height', '630', 'property')
        if cur_h is None:
            changes.append('og:image:height: (missing) -> 630')

    # 3. og:image:alt
    cur_alt = get_meta(new_html, 'og:image:alt')
    if not cur_alt:
        new_html = set_meta(new_html, 'og:image:alt', alt_text, 'property')
        changes.append(f'og:image:alt: (missing) -> "{alt_text[:60]}..."')

    # 4. twitter:image
    cur_tw = get_meta(new_html, 'twitter:image')
    if cur_tw != expected_og:
        new_html = set_meta(new_html, 'twitter:image', expected_og, 'name')
        if cur_tw is None:
            changes.append(f'twitter:image: (missing) -> {expected_og}')
        else:
            changes.append(f'twitter:image: {cur_tw} -> {expected_og}')

    # 5. twitter:card (ensure summary_large_image for 1200x630)
    cur_card = get_meta(new_html, 'twitter:card')
    if cur_card != 'summary_large_image':
        new_html = set_meta(new_html, 'twitter:card', 'summary_large_image', 'name')
        if cur_card != 'summary_large_image':
            changes.append(f'twitter:card: {cur_card or "(missing)"} -> summary_large_image')

    if changes and apply:
        with open(full, 'w', encoding='utf-8') as f:
            f.write(new_html)

    return {'slug': slug, 'status': 'fixed' if changes else 'clean', 'changes': changes}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--apply', action='store_true')
    args = p.parse_args()

    html_files = sorted(
        f for f in os.listdir(REPO_ROOT)
        if f.endswith('.html') and f not in EXCLUDED
    )

    fixed_count = 0
    clean_count = 0
    skip_count = 0
    for html_file in html_files:
        r = fix_page(html_file, args.apply)
        if r['status'] == 'fixed':
            fixed_count += 1
            print(f'{"[APPLY]" if args.apply else "[DRY]"} {r["slug"]}: {len(r["changes"])} change(s)')
            for c in r['changes']:
                print(f'    {c}')
        elif r['status'] == 'clean':
            clean_count += 1
        elif r['status'] == 'no-og-file':
            skip_count += 1

    print()
    print(f'TOTAL: {len(html_files)} pages')
    print(f'  Fixed:    {fixed_count}')
    print(f'  Clean:    {clean_count}')
    print(f'  Skipped (no og image):  {skip_count}')
    if not args.apply and fixed_count > 0:
        print('\nRe-run with --apply to write changes.')


if __name__ == '__main__':
    main()
