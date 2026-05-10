#!/usr/bin/env python3
"""v1.10.17 — inject skip-link on the 11 remaining pages.

Inserts `<a class="skip-link" href="#main-content">Skip to main content</a>`
right after <body...> and adds id="main-content" to first <main> or
first <section>/<div class="container"> if no <main>.
"""
import re
import glob
from pathlib import Path

ROOT = Path("/home/baguspermana7/rz-work")

# Pages that need skip-link
TARGETS = [
    'dashboard.html',
    'ltc-ansi-tia-topology-readiness.html',
    'ltc-ashrae-thermal-control.html',
    'ltc-iso-energy-governance.html',
    'ltc-nfpa-fire-risk.html',
    'ltc-system-modelling-lab.html',
    'ltc-uptime-tier-alignment.html',
    'privacy.html',
    'standards-ltc-lab.html',
]

SKIP_LINK = '\n    <a class="skip-link" href="#main-content">Skip to main content</a>'


def fix_page(path: Path) -> bool:
    content = path.read_text(encoding='utf-8')
    if 'skip-link' in content.lower():
        return False  # Already has

    # Find <body...> opening tag
    m = re.search(r'<body\b[^>]*>', content, re.IGNORECASE)
    if not m:
        return False

    # Inject skip-link right after <body>
    insert_pos = m.end()
    new_content = content[:insert_pos] + SKIP_LINK + content[insert_pos:]

    # Now ensure id="main-content" exists somewhere
    if 'id="main-content"' not in new_content:
        # Try to add to first <main>
        main_match = re.search(r'<main\b([^>]*)>', new_content, re.IGNORECASE)
        if main_match:
            attrs = main_match.group(1)
            if 'id=' not in attrs.lower():
                new_main = '<main' + attrs + ' id="main-content">'
                new_content = new_content[:main_match.start()] + new_main + new_content[main_match.end():]
        else:
            # Fall back: add to first <nav>'s SIBLING (i.e., the element after <nav>)
            # Or first <section>
            sec_match = re.search(r'<section\b([^>]*)>', new_content, re.IGNORECASE)
            if sec_match:
                attrs = sec_match.group(1)
                if 'id=' not in attrs.lower():
                    new_sec = '<section' + attrs + ' id="main-content">'
                    new_content = new_content[:sec_match.start()] + new_sec + new_content[sec_match.end():]

    path.write_text(new_content, encoding='utf-8')
    return True


def main():
    fixed = 0
    for name in TARGETS:
        path = ROOT / name
        if not path.exists():
            print(f"[miss] {name}")
            continue
        if fix_page(path):
            fixed += 1
            print(f"[skip] {name}: skip-link injected")
        else:
            print(f"[skip] {name}: already had skip-link")
    print(f"\nDone. {fixed} pages got skip-link.")


if __name__ == '__main__':
    main()
