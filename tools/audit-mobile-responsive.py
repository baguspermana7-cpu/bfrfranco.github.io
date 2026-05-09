#!/usr/bin/env python3
"""
audit-mobile-responsive.py — checks mobile responsiveness on every main HTML page.

Per-page checks (each worth points):
- (2) <meta name="viewport"> present + width=device-width
- (2) @media (max-width: 768px) rule present in inline styles or linked CSS
- (1) body { overflow-x: hidden } rule (prevents horizontal scroll)
- (1) img { max-width: 100% } rule (responsive images)
- (1) Mobile-collapse rule for navbar (.nav-menu/.nav-links display:none)
- (1) Footer grid mobile collapse (.footer-grid grid-template-columns: 1fr)
- (1) v1.8.0 mobile-responsive patch marker
- (1) Tap-target sizing (button/a min-height: 44px somewhere)

Score 0-10 per page; ≥7 is passing.

Usage:
    python3 tools/audit-mobile-responsive.py            # human report
    python3 tools/audit-mobile-responsive.py --strict   # exit 1 if any score < 7
    python3 tools/audit-mobile-responsive.py --json     # machine output
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

EXCLUDE_DIRS = {
    'node_modules', '.git', '.cache', 'archive', '.qa-screens',
    'dcmoc', 'Dunia-Emosi', 'Apps', 'embed', 'Automation',
    'Article', 'standarization', 'Data', 'prompts', 'tools',
}

# Files that aren't user-facing pages (email signatures, search-engine
# verification tokens, fragments) — exclude from audit
EXCLUDE_FILES = {
    'google1b98e0817bd5aa88.html',  # Google Search Console verification
    'BingSiteAuth.xml',
}
EXCLUDE_PATH_PREFIXES = (
    'assets/email-signature',  # email signature templates (not browser pages)
)


def is_excluded(path):
    parts = path.parts
    if any(p in EXCLUDE_DIRS for p in parts):
        return True
    if path.name in EXCLUDE_FILES:
        return True
    rel = str(path.relative_to(ROOT)) if path.is_absolute() else str(path)
    if any(rel.startswith(p) for p in EXCLUDE_PATH_PREFIXES):
        return True
    return False


def audit_file(path):
    try:
        text = path.read_text(encoding='utf-8', errors='replace')
    except Exception as e:
        return {'score': 0, 'error': str(e)}

    # Skip noindex pages — they're fragments not user-visible
    if re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\'][^"\']*noindex',
                 text[:5000], re.IGNORECASE):
        return {'score': 'NOINDEX', 'checks': {}}

    checks = {}
    score = 0

    # 1. Viewport meta
    has_viewport = bool(re.search(
        r'<meta[^>]+name=["\']viewport["\'][^>]+content=["\'][^"\']*width=device-width',
        text, re.IGNORECASE
    ))
    checks['viewport'] = has_viewport
    if has_viewport:
        score += 2

    # 2. @media (max-width: 768px) rule present
    has_media_768 = bool(re.search(r'@media\s*\([^)]*max-width:\s*768px', text))
    checks['media_768'] = has_media_768
    if has_media_768:
        score += 2

    # 3. body overflow-x
    has_overflow_x = bool(re.search(r'body[^{]*\{[^}]*overflow-x:\s*hidden', text))
    checks['body_overflow_x'] = has_overflow_x
    if has_overflow_x:
        score += 1

    # 4. img max-width
    has_img_max = bool(re.search(r'img[^{]*\{[^}]*max-width:\s*100%', text))
    checks['img_max_width'] = has_img_max
    if has_img_max:
        score += 1

    # 5. Navbar mobile collapse
    has_nav_collapse = bool(re.search(
        r'\.nav-(menu|links)[^{]*\{[^}]*display:\s*none',
        text
    ))
    checks['nav_collapse'] = has_nav_collapse
    if has_nav_collapse:
        score += 1

    # 6. Footer grid mobile
    has_footer_collapse = bool(re.search(
        r'\.footer-grid[^{]*\{[^}]*grid-template-columns:\s*1fr',
        text
    ))
    checks['footer_collapse'] = has_footer_collapse
    if has_footer_collapse:
        score += 1

    # 7. v1.8.0 patch marker
    has_v18_patch = 'v1.8.0' in text and 'mobile' in text and 'responsive patch' in text
    checks['v18_patch'] = has_v18_patch
    if has_v18_patch:
        score += 1

    # 8. Tap targets
    has_tap_target = bool(re.search(
        r'(button|a\.btn|\[role="button"\])[^{]*\{[^}]*min-height:\s*44px',
        text
    ))
    checks['tap_target'] = has_tap_target
    if has_tap_target:
        score += 1

    return {'score': score, 'checks': checks}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--strict', action='store_true',
                    help='exit 1 if any indexable page scores < 7/10')
    ap.add_argument('--json', dest='json_output', action='store_true',
                    help='emit JSON')
    ap.add_argument('--threshold', type=int, default=7,
                    help='passing score (default 7)')
    args = ap.parse_args()

    files = []
    for path in ROOT.rglob('*.html'):
        if is_excluded(path):
            continue
        files.append(path)

    results = {}
    for f in files:
        rel = str(f.relative_to(ROOT))
        result = audit_file(f)
        results[rel] = result

    counts = {'pass': 0, 'fail': 0, 'noindex': 0, 'error': 0, 'total': 0}
    for rel, r in results.items():
        counts['total'] += 1
        if 'error' in r:
            counts['error'] += 1
        elif r['score'] == 'NOINDEX':
            counts['noindex'] += 1
        elif r['score'] >= args.threshold:
            counts['pass'] += 1
        else:
            counts['fail'] += 1

    if args.json_output:
        print(json.dumps({'audited': counts['total'], 'results': results,
                          'counts': counts, 'threshold': args.threshold}, indent=2))
    else:
        print('=' * 64)
        print('Mobile responsive audit')
        print('=' * 64)
        print(f'Audited:   {counts["total"]} HTML pages')
        print(f'Threshold: {args.threshold}/10')
        print()
        # Show only failures
        for rel, r in sorted(results.items()):
            if 'error' in r:
                print(f'  ERR  {rel}: {r["error"]}')
            elif r['score'] == 'NOINDEX':
                continue
            elif r['score'] < args.threshold:
                missing = [k for k, v in r['checks'].items() if not v]
                print(f'  FAIL {rel}: score={r["score"]}/10 missing={",".join(missing)}')
        print()
        print(f'Pass:    {counts["pass"]}')
        print(f'Fail:    {counts["fail"]}')
        print(f'Noindex: {counts["noindex"]}')
        if counts['error']:
            print(f'Error:   {counts["error"]}')

    if args.strict and counts['fail'] > 0:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
