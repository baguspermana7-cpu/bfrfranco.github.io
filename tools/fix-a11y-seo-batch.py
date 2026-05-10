#!/usr/bin/env python3
"""v1.10.16 — multi-fix: <th scope=col> + ai-content-declaration meta.

Fixes B11-TABLES (12 remaining) + D7-001 (13 remaining).
"""
import re
import glob
from pathlib import Path

ROOT = Path("/home/baguspermana7/rz-work")


def fix_th_scope(content: str) -> tuple[str, int]:
    """Add scope='col' to <th> tags that lack scope attribute."""
    count = 0

    def repl(m):
        nonlocal count
        tag = m.group(0)
        if 'scope=' in tag.lower():
            return tag
        # Insert scope="col" before the closing >
        new_tag = tag[:-1].rstrip() + ' scope="col">'
        count += 1
        return new_tag

    # Match <th ...> (opening tag, not </th>)
    new_content = re.sub(r'<th\b[^>]*>', repl, content, flags=re.IGNORECASE)
    return new_content, count


def fix_ai_decl(content: str) -> tuple[str, int]:
    """Add <meta name='ai-content-declaration' content='human-authored'> to <head>."""
    if 'ai-content-declaration' in content:
        return content, 0
    # Find a good insertion point — after meta description or after viewport
    # Prefer right after charset/viewport
    insert_after = re.search(
        r'(<meta\s+name="description"\s[^>]*>)',
        content,
        re.IGNORECASE,
    )
    if not insert_after:
        insert_after = re.search(
            r'(<meta\s+name="viewport"\s[^>]*>)',
            content,
            re.IGNORECASE,
        )
    if not insert_after:
        return content, 0
    insert_pos = insert_after.end()
    new_meta = '\n    <meta name="ai-content-declaration" content="human-authored">'
    new_content = content[:insert_pos] + new_meta + content[insert_pos:]
    return new_content, 1


def main():
    pages = sorted(glob.glob(str(ROOT / '*.html')))
    th_total = 0
    th_files = 0
    decl_total = 0
    decl_files = 0
    for p in pages:
        path = Path(p)
        c = path.read_text(encoding='utf-8')
        original = c
        c, th_count = fix_th_scope(c)
        c, decl_count = fix_ai_decl(c)
        if c != original:
            path.write_text(c, encoding='utf-8')
        if th_count:
            th_total += th_count
            th_files += 1
        if decl_count:
            decl_total += decl_count
            decl_files += 1

    print(f"<th scope='col'> added: {th_total} on {th_files} pages")
    print(f"ai-content-declaration meta added on {decl_files} pages")


if __name__ == '__main__':
    main()
