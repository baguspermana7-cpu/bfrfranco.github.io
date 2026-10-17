#!/usr/bin/env python3
"""
audit-post-drafts.py — every published article carries its five social drafts, with UTM links.

Owner mandate (feedback_post_draft_mandate.md, 2026-05-13/14; re-stated 2026-10-17: "Ensure all
article have that"): every article page ships with platform drafts under Article/Post Draft/. The
v1 of this audit expected files named exactly `linkedin.md` etc., which no folder ever used (the
corpus has `linkedin-post.txt`, `A28-linkedin.md`, `mastodon-post-1.txt` …), so it never passed and
was never wired into the ship gate. v2 (v3.24.1):

  * STRICT scope = the journal family: article-N.html, FF-N.html, geopolitics-N.html. Every other
    public page is MONITORED (reported, exit 0) until it has a folder.
  * A platform counts as present when any file in the folder matches its name pattern, whatever the
    extension or prefix: x-post / twitter, linkedin, mastodon, medium, facebook.
  * Every link to resistancezero.com inside a draft carries utm_source=<platform>, utm_medium
    (social, or syndication for Medium) and utm_campaign (SEO/GEO audit 2026-10-16, F16: 0 of 230
    drafts could be attributed). `--fix-utm` rewrites bare links in place.
  * A Medium draft states how it is published: "medium.com/p/import" (sets the canonical) or the
    word "canonical" (F16).

Usage:
  python3 tools/audit-post-drafts.py              # report
  python3 tools/audit-post-drafts.py --strict     # exit 1 on any journal-family gap
  python3 tools/audit-post-drafts.py --fix-utm    # add UTM parameters to bare resistancezero links
  python3 tools/audit-post-drafts.py --show-passing
"""
import argparse
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRAFTS_DIR = os.path.join(REPO_ROOT, 'Article', 'Post Draft')

PLATFORMS = {
    'x': re.compile(r'x-post|twitter|\bx\.md$|-x\b', re.I),
    'linkedin': re.compile(r'linkedin', re.I),
    'mastodon': re.compile(r'mastodon', re.I),
    'medium': re.compile(r'medium', re.I),
    'facebook': re.compile(r'facebook', re.I),
}
UTM_MEDIUM = {'medium': 'syndication', 'quora': 'social'}
DRAFT_EXT = ('.md', '.txt')
LINK_RE = re.compile(r'https?://resistancezero\.com/[^\s)\]>"\'<]*')
ARTICLE_RE = re.compile(r'^(article|FF|geopolitics)-(\d+)\.html$')

EXCLUDED = {
    '404.html', 'rz-ops-p7x3k9m.html', 'changelog.html', 'sitemap.xml', 'achievements.html',
    'EPMS_Telemetry.html', 'index1.html', 'datacenter-solutions1.html', 'articles1.html',
}
EXPLICIT_FOLDER_NAMES = {
    'spares-readiness-calculator': 'Spares Readiness Calculator', 'pln-java-grid': 'PLN Java-Bali Grid Monitor',
    'pln-java-grid-historical': 'PLN Java-Bali - Historical', 'pln-java-grid-jakarta-banten': 'PLN Java-Bali - Jakarta+Banten',
    'pln-java-grid-jabar': 'PLN Java-Bali - Jabar', 'pln-java-grid-jateng': 'PLN Java-Bali - Jateng',
    'pln-java-grid-jatim': 'PLN Java-Bali - Jatim', 'asean-dc-report-2026': 'ASEAN DC Report 2026',
    'tia-942-checklist': 'TIA-942 Checklist', 'tier-advisor': 'Tier Advisor', 'rfs-readiness-workbench': 'RFS Readiness Workbench',
    'capex-calculator': 'CAPEX Calculator', 'opex-calculator': 'OPEX Calculator', 'pue-calculator': 'PUE Calculator',
    'roi-calculator': 'ROI Calculator', 'tco-calculator': 'TCO Calculator', 'cx-calculator': 'CX Calculator',
    'carbon-footprint': 'Carbon Footprint Calculator', 'tools': 'Tools Hub', 'datacenter-solutions': 'Datacenter Solutions',
    'datahallAI': 'DC AI HPC Simulation', 'dc-conventional': 'DC Conventional Simulation', 'dc-market-tracker': 'DC Market Tracker',
}


def is_journal(slug):
    return bool(ARTICLE_RE.match(slug + '.html'))


def candidate_folders_for(slug):
    if slug in EXPLICIT_FOLDER_NAMES:
        n = EXPLICIT_FOLDER_NAMES[slug]
        return [n, n + ' - MD']
    m = ARTICLE_RE.match(slug + '.html')
    if m:
        kind, n = m.group(1), int(m.group(2))
        if kind == 'article':
            return [f'Article {n}']
        if kind == 'FF':
            return [f'Future Forward {n}', f'Future Forward - FF-{n}', f'FF-{n}', f'FF {n}']
        return [f'Geopolitics {n}', f'Geopolitics-{n}', f'Geopolitics - geopolitics-{n}']
    return [slug.replace('-', ' ').title()]


def folder_matches(slug, available):
    for cand in candidate_folders_for(slug):
        for folder in available:
            if folder == cand or folder.startswith(cand + ' -') or folder.startswith(cand + ' ') or folder.startswith(cand + '-'):
                # "Article 1" must not match "Article 10": the character after the number is a separator
                return folder
    return None


def platform_of(filename):
    for name, rx in PLATFORMS.items():
        if rx.search(filename):
            return name
    if re.search(r'quora', filename, re.I):
        return 'quora'
    return None


def utm_for(platform, slug):
    medium = UTM_MEDIUM.get(platform, 'social')
    camp = re.sub(r'[^a-z0-9]+', '', slug.lower().replace('article-', 'a').replace('geopolitics-', 'g').replace('ff-', 'ff'))
    return f'utm_source={platform}&utm_medium={medium}&utm_campaign={camp}'


def audit_folder(folder, slug, fix=False):
    """Return (missing platforms, list of issue strings, fixed count)."""
    path = os.path.join(DRAFTS_DIR, folder)
    files = sorted(f for f in os.listdir(path) if f.lower().endswith(DRAFT_EXT))
    present = {p: any(rx.search(f) for f in files) for p, rx in PLATFORMS.items()}
    missing = [p for p, ok in present.items() if not ok]
    issues, fixed = [], 0
    for f in files:
        platform = platform_of(f)
        if not platform:
            continue
        fp = os.path.join(path, f)
        text = open(fp, encoding='utf-8', errors='replace').read()
        bare = [u for u in LINK_RE.findall(text) if 'utm_' not in u]
        if bare and fix:
            def add(m):
                u = m.group(0)
                if 'utm_' in u:
                    return u
                return u + ('&' if '?' in u else '?') + utm_for(platform, slug)
            text = LINK_RE.sub(add, text)
            open(fp, 'w', encoding='utf-8').write(text)
            fixed += len(bare)
            bare = []
        if bare:
            issues.append(f'{f}: {len(bare)} resistancezero link(s) without UTM')
        wrong = [u for u in LINK_RE.findall(text) if 'utm_' in u and f'utm_source={platform}' not in u]
        if wrong:
            issues.append(f'{f}: utm_source does not name the platform ({platform})')
        if platform == 'medium' and not re.search(r'medium\.com/p/import|canonical', text, re.I):
            issues.append(f'{f}: Medium draft does not say how it is published (import / canonical)')
    return missing, issues, fixed


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--strict', action='store_true', help='exit 1 on any journal-family gap')
    ap.add_argument('--fix-utm', action='store_true', help='add UTM parameters to bare resistancezero links in drafts')
    ap.add_argument('--show-passing', action='store_true')
    args = ap.parse_args()
    if not os.path.isdir(DRAFTS_DIR):
        print(f'ERROR: {DRAFTS_DIR} missing'); return 1
    folders = os.listdir(DRAFTS_DIR)
    pages = sorted(f[:-5] for f in os.listdir(REPO_ROOT) if f.endswith('.html') and f not in EXCLUDED and not f.startswith('plan-') and not f.startswith('rz-'))
    strict_gaps, monitored, passing, fixed_total = [], [], [], 0
    for slug in pages:
        folder = folder_matches(slug, folders)
        journal = is_journal(slug)
        if not folder:
            (strict_gaps if journal else monitored).append(f'{slug}: no folder (expected one of {", ".join(candidate_folders_for(slug))})')
            continue
        missing, issues, fixed = audit_folder(folder, slug, fix=args.fix_utm and journal)
        fixed_total += fixed
        problems = [f'missing {p} draft' for p in missing] + issues
        if problems:
            (strict_gaps if journal else monitored).append(f'{slug} [{folder}]: ' + '; '.join(problems))
        else:
            passing.append(slug)
    print('POST-DRAFT AUDIT — journal family strict (article-N, FF-N, geopolitics-N), other pages monitored')
    if fixed_total:
        print(f'  --fix-utm: {fixed_total} link(s) given UTM parameters')
    if args.show_passing:
        for s in passing:
            print(f'  ok  {s}')
    if strict_gaps:
        print(f'\n✗ JOURNAL GAPS ({len(strict_gaps)}):')
        for g in strict_gaps:
            print('  ' + g)
    if monitored:
        print(f'\n○ monitored, not gating: {len(monitored)} other page(s) without a complete draft set')
    if strict_gaps:
        print(f'\nFAIL — {len(strict_gaps)} journal page(s) short of the five-platform, UTM-tagged draft set.')
        return 1 if args.strict else 0
    print(f'\nPASS — every journal page has its five drafts with UTM links ({len(passing)} pages passing).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
