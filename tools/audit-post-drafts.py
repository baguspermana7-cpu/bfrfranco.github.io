#!/usr/bin/env python3
"""
audit-post-drafts.py
Per mandate feedback_post_draft_mandate.md (2026-05-13/14): every public-facing
page (HTML at site root) shipped to production MUST have a corresponding folder
under Article/Post Draft/ containing 5 platform-specific MD drafts.

Usage:
  python3 tools/audit-post-drafts.py            # report gaps
  python3 tools/audit-post-drafts.py --strict   # exit 1 on any missing folder/file

The audit:
1. Lists every *.html at repo root (excluding admin/test/utility pages)
2. Computes the expected post-draft folder name (Title Case Of Page)
3. Checks Article/Post Draft/<folder>/ exists
4. Confirms 5 MD files inside: x-post-1.md, linkedin.md, mastodon.md, medium.md, facebook.md
5. Reports gaps
"""
import argparse
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRAFTS_DIR = os.path.join(REPO_ROOT, 'Article', 'Post Draft')
REQUIRED_MDS = ['x-post-1.md', 'linkedin.md', 'mastodon.md', 'medium.md', 'facebook.md']

# HTML files at root that are NOT user-facing (skip audit)
EXCLUDED = {
    '404.html',
    'rz-ops-p7x3k9m.html',   # admin console
    'changelog.html',         # auto-generated
    'sitemap.xml',
    'achievements.html',      # gamification, no social post
    'EPMS_Telemetry.html',    # internal tool
}

# Page → expected folder-name mappings (where the default title-case isn't right)
EXPLICIT_FOLDER_NAMES = {
    'spares-readiness-calculator': 'Spares Readiness Calculator',
    'pln-java-grid': 'PLN Java-Bali Grid Monitor',
    'pln-java-grid-historical': 'PLN Java-Bali - Historical',
    'pln-java-grid-jakarta-banten': 'PLN Java-Bali - Jakarta+Banten',
    'pln-java-grid-jabar': 'PLN Java-Bali - Jabar',
    'pln-java-grid-jateng': 'PLN Java-Bali - Jateng',
    'pln-java-grid-jatim': 'PLN Java-Bali - Jatim',
    'asean-dc-report-2026': 'ASEAN DC Report 2026',
    'tia-942-checklist': 'TIA-942 Checklist',
    'tier-advisor': 'Tier Advisor',
    'rfs-readiness-workbench': 'RFS Readiness Workbench',
    'capex-calculator': 'CAPEX Calculator',
    'opex-calculator': 'OPEX Calculator',
    'pue-calculator': 'PUE Calculator',
    'roi-calculator': 'ROI Calculator',
    'tco-calculator': 'TCO Calculator',
    'cx-calculator': 'CX Calculator',
    'carbon-footprint': 'Carbon Footprint Calculator',
    'tools': 'Tools Hub',
    'datacenter-solutions': 'Datacenter Solutions',
    'datahallAI': 'DC AI HPC Simulation',
    'dc-conventional': 'DC Conventional Simulation',
    'dc-market-tracker': 'DC Market Tracker',
    'tia-942-checklist': 'TIA-942 Checklist',
}

# Articles use their own naming scheme ("Article N - Slug")
ARTICLE_PATTERN = re.compile(r'^article-(\d+)\.html$')


def candidate_folders_for(slug: str):
    """Return list of folder names that satisfy this page's audit."""
    if slug in EXPLICIT_FOLDER_NAMES:
        n = EXPLICIT_FOLDER_NAMES[slug]
        return [n, n + ' - MD']  # accept '<name>' or '<name> - MD' (the parallel folder pattern)
    if slug.startswith('article-'):
        m = ARTICLE_PATTERN.match(slug + '.html')
        if m:
            n = int(m.group(1))
            return [f'Article {n}']  # any folder starting with "Article N" is acceptable
    if slug.startswith('FF-'):
        return [f'Future Forward - {slug}']
    if slug.startswith('geopolitics'):
        return [f'Geopolitics - {slug}']
    # Default: Title Case
    title = slug.replace('-', ' ').title()
    return [title]


def folder_matches(slug: str, available_folders):
    """Return matching folder name if found, else None."""
    candidates = candidate_folders_for(slug)
    for cand in candidates:
        for folder in available_folders:
            if folder == cand or folder.startswith(cand + ' -') or folder.startswith(cand + ' ') or folder.startswith(cand + '-'):
                return folder
    return None


def audit_folder(folder_path: str):
    """Return list of missing MD files in the folder."""
    if not os.path.isdir(folder_path):
        return REQUIRED_MDS[:]
    files = set(os.listdir(folder_path))
    return [md for md in REQUIRED_MDS if md not in files]


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--strict', action='store_true', help='Exit 1 on any missing folder/file')
    p.add_argument('--show-passing', action='store_true', help='Show passing pages too')
    args = p.parse_args()

    if not os.path.isdir(DRAFTS_DIR):
        print(f'[audit-post-drafts] No Article/Post Draft/ folder at {DRAFTS_DIR}')
        sys.exit(2)

    # List available folders
    available = [d for d in os.listdir(DRAFTS_DIR) if os.path.isdir(os.path.join(DRAFTS_DIR, d))]

    # Enumerate public HTML pages
    html_files = sorted(
        f for f in os.listdir(REPO_ROOT)
        if f.endswith('.html') and f not in EXCLUDED
    )

    missing_folder = []
    missing_files = []
    passing = []

    for html in html_files:
        slug = html.replace('.html', '')
        folder = folder_matches(slug, available)
        if not folder:
            missing_folder.append({'slug': slug, 'expected': candidate_folders_for(slug)})
            continue
        # Audit the folder contents
        folder_path = os.path.join(DRAFTS_DIR, folder)
        missing_mds = audit_folder(folder_path)
        if missing_mds:
            missing_files.append({'slug': slug, 'folder': folder, 'missing': missing_mds})
        else:
            passing.append({'slug': slug, 'folder': folder})

    total = len(html_files)
    print(f'[audit-post-drafts] HTML pages audited: {total}')
    print(f'  Passing (folder + 5 MDs): {len(passing)}')
    print(f'  Missing folder:           {len(missing_folder)}')
    print(f'  Folder exists, MDs gap:   {len(missing_files)}')
    print()

    if missing_folder:
        print(f'MISSING FOLDER ({len(missing_folder)} pages):')
        for m in missing_folder:
            cands = ' | '.join(m['expected'])
            print(f'  - {m["slug"]:30}  → expected one of: {cands}')
        print()

    if missing_files:
        print(f'FOLDER EXISTS BUT MDs MISSING ({len(missing_files)}):')
        for m in missing_files:
            print(f'  - {m["slug"]:30}  folder={m["folder"]}')
            for md in m['missing']:
                print(f'      missing: {md}')
        print()

    if args.show_passing:
        print(f'PASSING ({len(passing)}):')
        for p in passing[:30]:
            print(f'  + {p["slug"]:30}  → {p["folder"]}')
        if len(passing) > 30:
            print(f'  ... and {len(passing)-30} more')

    has_issues = bool(missing_folder or missing_files)
    if args.strict and has_issues:
        print('[STRICT] Issues detected. Exiting 1.')
        sys.exit(1)
    elif not has_issues:
        print('[OK] All public pages have post-draft folders with 5 MDs.')
        sys.exit(0)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
