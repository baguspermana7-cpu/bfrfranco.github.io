#!/usr/bin/env python3
"""v1.10.12 — normalize cache-bust query strings on script/link tags only.

Targets actual <script src=> and <link href=> tags, not documentation prose.
"""
import re
import glob
from pathlib import Path

ROOT = Path("/home/baguspermana7/rz-work")
NEW_BUST = "2026-05-09-v1"

# These files participate in cache normalization
NORMALIZE_TARGETS = {
    'styles.min.css',
    'styles-index.min.css',
    'styles.css',
    'styles-index.css',
    'script.min.js',
    'script.js',
    'auth.js',
    'rz-engine.js',
}


def normalize_in_html(content: str) -> tuple[str, int]:
    """Normalize cache-bust on script/link tags only.

    Pattern: src="<file>?v=<old>" or href="<file>?v=<old>"
    """
    count = 0

    def replace_src(m):
        nonlocal count
        attr = m.group(1)
        path = m.group(2)
        bust = m.group(3)
        # Extract just the filename
        fname = path.split('/')[-1]
        if fname not in NORMALIZE_TARGETS:
            return m.group(0)
        if bust == NEW_BUST:
            return m.group(0)
        count += 1
        return f'{attr}="{path}?v={NEW_BUST}"'

    pattern = re.compile(
        r'\b(src|href)="([^"?]+)\?v=([^"]+)"',
        re.IGNORECASE
    )
    new_content = pattern.sub(replace_src, content)
    return new_content, count


def main():
    pages = sorted(glob.glob(str(ROOT / '*.html')))
    total_files = 0
    total_replacements = 0
    for p in pages:
        path = Path(p)
        content = path.read_text(encoding='utf-8')
        new_content, count = normalize_in_html(content)
        if count > 0:
            path.write_text(new_content, encoding='utf-8')
            total_files += 1
            total_replacements += count
            print(f"[norm] {path.name}: {count} replacements")
    print(f"\nDone. {total_replacements} cache-bust strings normalized across {total_files} files.")


if __name__ == '__main__':
    main()
