#!/usr/bin/env python3
"""
validate-consistency.py — UI consistency checker for ResistanceZero
Checks: navbar pattern, footer presence, dark mode theme attribute, cookie banner
Run from: /home/baguspermana7/rz-work
"""

import os
import re
from pathlib import Path

SITE_ROOT = '/home/baguspermana7/rz-work'

SKIP_PATTERNS = ['node_modules', '.git', '.qa-screens', 'dcmoc', 'Apps',
                 'email-signature', 'google1b', 'rz-ops-p7x3k9m',
                 'Article', 'Automation', 'standarization', 'Data']

# Files that intentionally use .nav-links (calculator pattern)
CALC_NAV_FILES = [
    'pue-calculator.html', 'capex-calculator.html', 'opex-calculator.html',
    'roi-calculator.html', 'tco-calculator.html', 'cx-calculator.html',
    'tier-advisor.html', 'tia-942-checklist.html', 'rfs-readiness-workbench.html',
    'chiller-plant.html', 'fire-system.html', 'fuel-system.html',
    'water-system.html', 'ict.html', 'EPMS_Telemetry.html',
    'carbon-footprint.html', 'dc-market-tracker.html',
    'ltc-ansi-tia-topology-readiness.html', 'ltc-ashrae-thermal-control.html',
    'ltc-iso-energy-governance.html', 'ltc-nfpa-fire-risk.html',
    'ltc-system-modelling-lab.html', 'ltc-uptime-tier-alignment.html',
    'standards-ltc-lab.html',
]

def should_skip(filepath):
    rel = os.path.relpath(filepath, SITE_ROOT)
    return any(p in rel for p in SKIP_PATTERNS)

def get_html_files():
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

def check_file(filepath):
    rel = os.path.relpath(filepath, SITE_ROOT)
    filename = os.path.basename(filepath)
    issues = []

    with open(filepath, 'r', errors='ignore') as f:
        content = f.read()

    # 1. Check data-theme on <html> tag
    html_tag = re.search(r'<html[^>]*>', content)
    if html_tag:
        if 'data-theme' not in html_tag.group(0):
            issues.append(('INFO', rel, 'Missing data-theme attribute on <html> tag'))

    # 2. Check navbar pattern
    has_nav_menu = 'class="nav-menu"' in content or "class='nav-menu'" in content
    has_nav_links = 'class="nav-links"' in content or "class='nav-links'" in content
    has_navbar = 'class="navbar"' in content or "class='navbar'" in content

    if has_navbar:
        if not has_nav_menu and not has_nav_links:
            issues.append(('WARNING', rel, 'Has navbar but no nav-menu or nav-links class found'))
        elif has_nav_menu and filename in CALC_NAV_FILES:
            issues.append(('INFO', rel, 'Calculator page using .nav-menu (should use .nav-links)'))
        elif has_nav_links and filename not in CALC_NAV_FILES and 'compare-' not in filename:
            # Content page using .nav-links — might be intentional for some pages
            pass  # Known exception, skip

    # 3. Check footer
    if '<footer' not in content and 'class="footer"' not in content:
        if filename not in ['404.html', 'rz-ops-p7x3k9m.html']:
            issues.append(('WARNING', rel, 'Missing footer element'))

    # 4. Check cookie banner (major pages only)
    if filename in ['index.html', 'articles.html', 'dashboard.html']:
        if 'cookie' not in content.lower():
            issues.append(('WARNING', rel, 'Missing cookie consent banner on major page'))

    # 5. Dark mode toggle on standalone calculators
    if filename in ['pue-calculator.html', 'capex-calculator.html', 'opex-calculator.html',
                    'roi-calculator.html', 'tco-calculator.html']:
        if 'toggleCalcTheme' not in content:
            issues.append(('CRITICAL', rel, 'Missing toggleCalcTheme() dark mode function'))
        if 'nav-theme-btn' not in content:
            issues.append(('CRITICAL', rel, 'Missing .nav-theme-btn dark mode toggle button'))
        if "|| 'dark'" not in content:
            issues.append(('WARNING', rel, "Dark mode default not set to 'dark'"))

    # 6. Check script loading order (scripts after IIFE)
    if 'script.min.js' in content and '(function()' in content:
        iife_pos = content.rfind('(function()')
        script_pos = content.rfind('script.min.js')
        if script_pos < iife_pos:
            issues.append(('WARNING', rel, 'script.min.js loaded before IIFE — check order'))

    # 7. Motion effects — ensure disabled effects aren't re-enabled
    for bad_call in ['initCardTilt()', 'initCursorEffects()', 'initCursorSpotlight()']:
        if bad_call in content and 'return' not in content[max(0, content.find(bad_call)-100):content.find(bad_call)]:
            issues.append(('WARNING', rel, f'Potentially active motion effect: {bad_call}'))

    return issues

def main():
    print("=== validate-consistency.py ===\n")
    html_files = get_html_files()
    print(f"Scanning {len(html_files)} HTML files...\n")

    all_issues = {'CRITICAL': [], 'WARNING': [], 'INFO': []}

    for filepath in html_files:
        file_issues = check_file(filepath)
        for level, path, msg in file_issues:
            all_issues[level].append(f"{path}: {msg}")

    for level in ['CRITICAL', 'WARNING', 'INFO']:
        print(f"--- {level} ({len(all_issues[level])}) ---")
        for issue in all_issues[level]:
            print(f"  {level}: {issue}")
        if not all_issues[level]:
            print(f"  PASS")
        print()

    total = sum(len(v) for v in all_issues.values())
    print(f"Total consistency issues: {total}")

if __name__ == '__main__':
    main()
