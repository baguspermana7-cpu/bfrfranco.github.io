#!/usr/bin/env python3
"""v1.10.10 — add aria-label to all unlabeled form inputs (a11y)."""
import re
import glob
import sys
from pathlib import Path

ROOT = Path("/home/baguspermana7/rz-work")

# Known mappings for common id patterns
ID_TO_LABEL = {
    'searchInput': 'Search',
    'searchInput2': 'Search',
    'searchInputMobile': 'Search',
    'navSearchInput': 'Search',
    'searchQuery': 'Search',
}


def humanize(s: str) -> str:
    """Convert camelCase / snake_case / kebab-case id to readable label."""
    if s in ID_TO_LABEL:
        return ID_TO_LABEL[s]
    # camelCase → space separated
    s = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)
    # underscores / hyphens → space
    s = re.sub(r'[-_]+', ' ', s)
    # Common abbreviation fixes
    repl = {
        'pue': 'PUE', 'capex': 'CAPEX', 'opex': 'OPEX', 'roi': 'ROI',
        'tco': 'TCO', 'cx': 'CX', 'dc': 'DC', 'mtbf': 'MTBF', 'mttr': 'MTTR',
        'gpu': 'GPU', 'cpu': 'CPU', 'ups': 'UPS', 'mw': 'MW', 'kw': 'kW',
        'kva': 'kVA', 'usd': 'USD', 'idr': 'IDR', 'mva': 'MVA',
    }
    parts = s.split()
    parts = [repl.get(p.lower(), p) for p in parts]
    s = ' '.join(parts)
    s = s.strip()
    # Capitalize first letter if not already
    if s and s[0].islower():
        s = s[0].upper() + s[1:]
    return s.replace('"', '').replace("'", "")


def fix_page(path: Path) -> int:
    """Add aria-label to unlabeled inputs. Returns count of fixes applied."""
    content = path.read_text(encoding='utf-8')
    original = content

    # Find all label for= relationships
    labels_for = set(re.findall(r'<label[^>]*\bfor\s*=\s*["\']([^"\']+)["\']', content))

    # Find all inputs with id
    pattern = re.compile(
        r'(<(?:input|select|textarea)\b[^>]*?\bid\s*=\s*["\']([^"\']+)["\'][^>]*?>)',
        re.IGNORECASE
    )

    # Build all replacements first to avoid offset shifts
    replacements = []
    for match in pattern.finditer(content):
        full_tag = match.group(1)
        input_id = match.group(2)
        # Skip if already has aria-label / aria-labelledby
        if re.search(r'\baria-label(?:ledby)?\s*=', full_tag):
            continue
        # Skip if has matching <label for=>
        if input_id in labels_for:
            continue
        # Skip excluded types
        type_match = re.search(r'\btype\s*=\s*["\']([^"\']+)["\']', full_tag)
        input_type = type_match.group(1) if type_match else 'text'
        if input_type in ('hidden', 'submit', 'button', 'image', 'reset'):
            continue

        # Determine label text
        label = ''
        # Prefer placeholder
        ph_match = re.search(r'\bplaceholder\s*=\s*["\']([^"\']+)["\']', full_tag)
        if ph_match:
            label = ph_match.group(1)
        else:
            # Fallback to humanized id
            label = humanize(input_id)

        if not label:
            continue

        # Insert aria-label at end of opening tag, before the closing >
        # Handle self-closing (<input ... />) and regular (<select ...>)
        if full_tag.endswith('/>'):
            new_tag = full_tag[:-2].rstrip() + f' aria-label="{label}" />'
        else:
            new_tag = full_tag[:-1].rstrip() + f' aria-label="{label}">'
        replacements.append((full_tag, new_tag))

    # Apply replacements (deduplicate first)
    seen = set()
    count = 0
    for old, new in replacements:
        if old in seen:
            continue
        seen.add(old)
        # Replace ONLY the first occurrence (since each instance unique by id)
        if old in content:
            content = content.replace(old, new, 1)
            count += 1

    if content != original:
        path.write_text(content, encoding='utf-8')
    return count


def main():
    pages = sorted([Path(p) for p in glob.glob(str(ROOT / '*.html'))])
    total_fixes = 0
    files_changed = 0
    for page in pages:
        n = fix_page(page)
        if n:
            files_changed += 1
            total_fixes += n
            print(f"[fix] {page.name}: {n} aria-label added")
    print(f"\nDone. {total_fixes} aria-label attributes added across {files_changed} pages.")


if __name__ == '__main__':
    main()
